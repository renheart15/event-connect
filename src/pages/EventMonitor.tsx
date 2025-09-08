
import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, MapPin, Clock, User, AlertTriangle, Loader2, Radar } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { API_CONFIG } from '@/config';
import LocationStatusDisplay from '@/components/LocationStatusDisplay';

const EventMonitor = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [eventData, setEventData] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [stats, setStats] = useState({
    totalCheckedIn: 0,
    currentlyPresent: 0,
    totalCheckedOut: 0,
    averageDuration: 0
  });

  // Fetch real-time attendance data
  const fetchAttendanceData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('No auth token found, redirecting to login');
        navigate('/login?role=organizer');
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${API_CONFIG.API_BASE}/attendance/event/${eventId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message);
      }

      // Transform attendance data for display
      const transformedParticipants = data.data.attendanceLogs.map(log => ({
        id: log._id,
        name: log.participant.name,
        email: log.participant.email,
        status: log.status === 'checked-in' ? 'present' : 'left-early',
        checkInTime: new Date(log.checkInTime).toLocaleTimeString(),
        checkOutTime: log.checkOutTime ? new Date(log.checkOutTime).toLocaleTimeString() : null,
        duration: log.duration || 0,
        lastSeen: getTimeAgo(log.lastLocationUpdate || log.checkInTime)
      }));

      setParticipants(transformedParticipants);
      setStats(data.data.stats);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch attendance data:', error);
      
      let errorMessage = "Please check your connection and try again";
      if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
        errorMessage = "Backend server not running. Run 'npm run backend' to start the server on port 5000.";
      } else if (error.response?.status === 401) {
        errorMessage = "Authentication failed. Please log in again.";
        navigate('/login?role=organizer');
        return;
      } else if (error.response?.status === 429) {
        errorMessage = "Rate limit exceeded. Monitoring will resume automatically in a few minutes.";
        // Don't show repeated rate limit errors
        console.warn('Rate limited - will retry automatically');
        return;
      } else if (error.message?.includes('Unexpected token')) {
        // Handle JSON parsing errors which often indicate rate limiting or server errors
        errorMessage = "Server temporarily unavailable. Retrying automatically...";
        console.warn('JSON parsing error, likely due to rate limiting or server issue');
        return;
      }
      
      toast({
        title: "Failed to fetch attendance data",
        description: errorMessage,
        variant: "destructive"
      });
      setLoading(false);
    }
  }, [eventId, navigate]);

  // Fetch event details
  const fetchEventData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${API_CONFIG.API_BASE}/events/${eventId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const data = await response.json();
      if (data.success) {
        setEventData(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch event data:', error);
      
      let errorMessage = "Please check your connection and try again";
      if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
        errorMessage = "Backend server not running. Run 'npm run backend' to start the server.";
      } else if (error.response?.status === 401) {
        errorMessage = "Authentication failed. Please log in again.";
        navigate('/login?role=organizer');
        return;
      } else if (error.response?.status === 429) {
        console.warn('Rate limited when fetching event data - will retry');
        return;
      } else if (error.message?.includes('Unexpected token')) {
        console.warn('JSON parsing error when fetching event data');
        return;
      }
      
      toast({
        title: "Failed to fetch event data",
        description: errorMessage,
        variant: "destructive"
      });
    }
  }, [eventId, navigate]);

  // Helper function to calculate time ago
  const getTimeAgo = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now - time) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    return `${Math.floor(diffInHours / 24)} days ago`;
  };

  useEffect(() => {
    // Check if eventId exists
    if (!eventId) {
      console.error('No eventId provided in URL');
      navigate('/organizer-dashboard');
      return;
    }

    // Fetch initial data
    fetchEventData();
    fetchAttendanceData();

    // Set up real-time updates
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Refresh attendance data every 45 seconds for rate limit friendliness
    const dataRefreshInterval = setInterval(() => {
      fetchAttendanceData();
    }, 45000);

    return () => {
      clearInterval(timer);
      clearInterval(dataRefreshInterval);
    };
  }, [eventId, navigate, fetchEventData, fetchAttendanceData]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'default';
      case 'on-break': return 'secondary';
      case 'low-battery': return 'destructive';
      case 'left-early': return 'outline';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present': return <User className="w-4 h-4" />;
      case 'on-break': return <Clock className="w-4 h-4" />;
      case 'low-battery': return <AlertTriangle className="w-4 h-4" />;
      case 'left-early': return <MapPin className="w-4 h-4" />;
      default: return <User className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading event monitor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Live Event Monitor</h1>
              <p className="text-sm text-gray-600">{eventData?.title || 'Loading...'}</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-gray-600">Current Time</p>
                <p className="font-mono text-lg">{currentTime.toLocaleTimeString()}</p>
              </div>
              <Button onClick={() => fetchAttendanceData()} variant="outline" size="sm">
                Refresh Data
              </Button>
              <Link to="/organizer-dashboard">
                <Button variant="outline">Back to Dashboard</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="attendance" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="attendance" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Attendance Monitor
            </TabsTrigger>
            <TabsTrigger value="location" className="flex items-center gap-2">
              <Radar className="w-4 h-4" />
              Location Tracking
            </TabsTrigger>
          </TabsList>

          <TabsContent value="attendance" className="mt-6">
            {/* Real-time Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <Card>
                <CardContent className="pt-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{stats.totalCheckedIn}</p>
                    <p className="text-xs text-gray-600">Total Checked In</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{stats.currentlyPresent}</p>
                    <p className="text-xs text-gray-600">Currently Present</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-600">{stats.totalCheckedOut}</p>
                    <p className="text-xs text-gray-600">Checked Out</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-purple-600">
                      {Math.round(stats.averageDuration / 60) || 0}min
                    </p>
                    <p className="text-xs text-gray-600">Avg Duration</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Event Info */}
            {eventData && (
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    Event Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="font-medium text-gray-900">Date</p>
                      <p className="text-gray-600">{new Date(eventData.date).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Time</p>
                      <p className="text-gray-600">{eventData.startTime} - {eventData.endTime}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Location</p>
                      <p className="text-gray-600">{eventData.location?.address || eventData.location || 'Location not specified'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Participants List */}
            <Card>
              <CardHeader>
                <CardTitle>Live Participant Status</CardTitle>
                <CardDescription>
                  Real-time tracking of all event participants
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {participants && participants.length > 0 ? participants.map((participant) => (
                    <div key={participant.id} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-semibold">{participant.name}</h3>
                          <p className="text-sm text-gray-600">{participant.email}</p>
                        </div>
                        <Badge variant={getStatusColor(participant.status)} className="flex items-center gap-1">
                          {getStatusIcon(participant.status)}
                          {participant.status.replace('-', ' ')}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                        <div>
                          <p className="font-medium">Check-in</p>
                          <p>{participant.checkInTime}</p>
                        </div>
                        {participant.checkOutTime && (
                          <div>
                            <p className="font-medium">Check-out</p>
                            <p>{participant.checkOutTime}</p>
                          </div>
                        )}
                        <div>
                          <p className="font-medium">Duration</p>
                          <p>{Math.round(participant.duration / 60) || 0} minutes</p>
                        </div>
                        <div>
                          <p className="font-medium">Last Seen</p>
                          <p>{participant.lastSeen}</p>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-8 text-gray-500">
                      <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No participants checked in yet</p>
                      <p className="text-sm">Participants will appear here when they check in with their QR codes</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="location" className="mt-6">
            {eventId ? (
              <LocationStatusDisplay eventId={eventId} />
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center text-gray-500">
                    <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Event ID not found</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default EventMonitor;
