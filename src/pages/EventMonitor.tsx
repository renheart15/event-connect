
import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, MapPin, Clock, User, AlertTriangle, Loader2, Radar, Activity, TrendingUp, Wifi, WifiOff, RefreshCw, Battery } from 'lucide-react';
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
  const [isConnected, setIsConnected] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [connectionRetries, setConnectionRetries] = useState(0);
  const [availableEvents, setAvailableEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // Fetch real-time attendance data
  const fetchAttendanceData = useCallback(async () => {
    try {
      setRefreshing(true);
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
        checkInTime: new Date(log.checkInTime).toLocaleTimeString('en-US', { hour12: true }),
        checkOutTime: log.checkOutTime ? new Date(log.checkOutTime).toLocaleTimeString('en-US', { hour12: true }) : null,
        duration: log.duration || 0,
        lastSeen: getTimeAgo(log.lastLocationUpdate || log.checkInTime),
        batteryLevel: log.batteryLevel || Math.floor(Math.random() * 100) // Use actual battery level or mock data
      }));

      setParticipants(transformedParticipants);
      setStats(data.data.stats);
      setIsConnected(true);
      setConnectionRetries(0);
      setLastUpdate(new Date());
      setLoading(false);
      setRefreshing(false);
    } catch (error) {
      console.error('Failed to fetch attendance data:', error);
      setIsConnected(false);
      setConnectionRetries(prev => prev + 1);
      setRefreshing(false);
      
      let errorMessage = "Please check your connection and try again";
      if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
        errorMessage = "Backend server not running. Run 'npm run backend' to start the server on port 5000.";
      } else if (error.response?.status === 401) {
        errorMessage = "Authentication failed. Please log in again.";
        navigate('/login?role=organizer');
        return;
      } else if (error.response?.status === 429) {
        errorMessage = "Rate limit exceeded. Monitoring will resume automatically in a few minutes.";
        console.warn('Rate limited - will retry automatically');
        return;
      } else if (error.message?.includes('Unexpected token')) {
        errorMessage = "Server temporarily unavailable. Retrying automatically...";
        console.warn('JSON parsing error, likely due to rate limiting or server issue');
        return;
      }
      
      // Only show error toast for first few retries to avoid spam
      if (connectionRetries < 3) {
        toast({
          title: "Failed to fetch attendance data",
          description: errorMessage,
          variant: "destructive"
        });
      }
      setLoading(false);
    }
  }, [eventId, navigate, connectionRetries]);

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

  // Fetch available events for selection
  const fetchAvailableEvents = useCallback(async () => {
    try {
      setLoadingEvents(true);
      const token = localStorage.getItem('token');
      if (!token) {
        setLoadingEvents(false);
        navigate('/login?role=organizer');
        return;
      }

      const response = await fetch(`${API_CONFIG.API_BASE}/events?status=active`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        console.error('Failed to fetch events: HTTP', response.status);
        setAvailableEvents([]);
        setLoadingEvents(false);
        return;
      }

      const data = await response.json();
      if (data.success) {
        const events = data.data?.events || data.data || [];
        // Filter to only show active events for monitoring
        const activeEvents = events.filter(event => 
          event.status === 'active' || event.status === 'ongoing'
        );
        setAvailableEvents(activeEvents);
      } else {
        console.error('API returned error:', data.message);
        setAvailableEvents([]);
      }
      setLoadingEvents(false);
    } catch (error) {
      console.error('Failed to fetch events:', error);
      setLoadingEvents(false);
    }
  }, [navigate]);

  // Helper function to format time from HH:MM to 12-hour format
  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Helper function to format event date for multi-day events
  const formatEventDate = (event: any) => {
    if (event.endDate && event.endDate !== event.date) {
      // Multi-day event: show date range
      return `${new Date(event.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      })} - ${new Date(event.endDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })}`;
    } else {
      // Single-day event: show full date
      return new Date(event.date).toLocaleDateString();
    }
  };

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

  // Helper function to get battery color based on level
  const getBatteryColor = (level) => {
    if (level >= 50) return 'text-green-600';
    if (level >= 20) return 'text-yellow-600';
    return 'text-red-600';
  };

  useEffect(() => {
    // Check if eventId exists
    if (!eventId) {
      // If no eventId, fetch available events for selection instead of redirecting
      setLoading(false); // Important: Set loading to false when no eventId
      fetchAvailableEvents();
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
  }, [eventId, navigate, fetchEventData, fetchAttendanceData, fetchAvailableEvents]);


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

  if (loading || loadingEvents) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">{!eventId ? 'Loading events...' : 'Loading event monitor...'}</p>
        </div>
      </div>
    );
  }

  // Show event selection when no eventId is provided
  if (!eventId) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Select Active Event to Monitor</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">Choose an active event to start live attendance monitoring</p>
              </div>
              <Link to="/organizer-dashboard">
                <Button variant="outline">Back to Dashboard</Button>
              </Link>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Active Events
              </CardTitle>
              <CardDescription>
                Select an active event to start real-time attendance monitoring
              </CardDescription>
            </CardHeader>
            <CardContent>
              {availableEvents.length > 0 ? (
                <div className="grid gap-4">
                  {availableEvents.map((event) => (
                    <div key={event._id} className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">{event.title}</h3>
                          <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">{event.description}</p>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <div className="flex items-center gap-1">
                              <MapPin className="w-4 h-4" />
                              {event.location?.address || event.location || 'Location TBD'}
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {formatEventDate(event)} at {formatTime(event.startTime)}
                            </div>
                          </div>
                        </div>
                        <Button
                          onClick={() => navigate(`/event/${event._id}/monitor`)}
                          className="ml-4"
                        >
                          <Activity className="w-4 h-4 mr-2" />
                          Start Monitoring
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg mb-2">No Active Events Found</p>
                  <p className="text-sm mb-4">You don't have any active events to monitor.</p>
                  <Link to="/create-event">
                    <Button>
                      Create New Event
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">

      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Live Event Monitor</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">{eventData?.title || 'Loading...'}</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-gray-600 dark:text-gray-400">Current Time</p>
                <p className="font-mono text-lg">{currentTime.toLocaleTimeString('en-US', { hour12: true })}</p>
              </div>
              
              {/* Connection Status */}
              <div className="flex items-center space-x-2">
                {isConnected ? (
                  <div className="flex items-center text-green-600">
                    <Wifi className="w-4 h-4 mr-1" />
                    <span className="text-sm">Connected</span>
                  </div>
                ) : (
                  <div className="flex items-center text-red-600">
                    <WifiOff className="w-4 h-4 mr-1" />
                    <span className="text-sm">Disconnected</span>
                  </div>
                )}
                <div className="text-xs text-gray-500">
                  Last update: {lastUpdate.toLocaleTimeString('en-US', { hour12: true })}
                </div>
              </div>

              <Button 
                onClick={() => fetchAttendanceData()} 
                variant="outline" 
                size="sm"
                disabled={refreshing}
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing...' : 'Refresh Data'}
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="attendance" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Attendance Monitor
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Live Analytics
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
                    <p className="text-xs text-gray-600 dark:text-gray-400">Total Checked In</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{stats.currentlyPresent}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Currently Present</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">{stats.totalCheckedOut}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Checked Out</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-purple-600">
                      {Math.round(stats.averageDuration / 60) || 0}min
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Avg Duration</p>
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
                      <p className="font-medium text-gray-900 dark:text-white">Date</p>
                      <p className="text-gray-600 dark:text-gray-400">{formatEventDate(eventData)}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Time</p>
                      <p className="text-gray-600 dark:text-gray-400">{formatTime(eventData.startTime)} - {formatTime(eventData.endTime)}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Location</p>
                      <p className="text-gray-600 dark:text-gray-400">{eventData.location?.address || eventData.location || 'Location not specified'}</p>
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
                    <div key={participant.id} className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-semibold">{participant.name}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{participant.email}</p>
                        </div>
                        <Badge variant={getStatusColor(participant.status)} className="flex items-center gap-1">
                          {getStatusIcon(participant.status)}
                          {participant.status.replace('-', ' ')}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm text-gray-600 dark:text-gray-400">
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
                        <div>
                          <p className="font-medium flex items-center gap-1">
                            <Battery className="w-4 h-4" />
                            Battery
                          </p>
                          <p className={`font-semibold ${getBatteryColor(participant.batteryLevel)}`}>
                            {participant.batteryLevel}%
                          </p>
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

          <TabsContent value="analytics" className="mt-6">
            {/* Live Analytics Dashboard */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Attendance Trend */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                    Attendance Trends
                  </CardTitle>
                  <CardDescription>Real-time attendance patterns</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <span className="text-sm font-medium">Peak Attendance</span>
                      <span className="text-lg font-bold text-green-600">{stats.currentlyPresent}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <span className="text-sm font-medium">Check-in Rate</span>
                      <span className="text-lg font-bold text-blue-600">
                        {stats.totalCheckedIn > 0 ? Math.round((stats.totalCheckedIn / 60) * 100) / 100 : 0}/min
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                      <span className="text-sm font-medium">Retention Rate</span>
                      <span className="text-lg font-bold text-purple-600">
                        {stats.totalCheckedIn > 0 ? Math.round((stats.currentlyPresent / stats.totalCheckedIn) * 100) : 0}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Event Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-green-600" />
                    Event Health
                  </CardTitle>
                  <CardDescription>System status and performance</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Connection Status</span>
                      <Badge variant={isConnected ? "default" : "destructive"}>
                        {isConnected ? "Active" : "Disconnected"}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Data Freshness</span>
                      <Badge variant="secondary">
                        {Math.round((new Date() - lastUpdate) / 1000)}s ago
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Auto Refresh</span>
                      <Badge variant="outline">45s interval</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Connection Retries</span>
                      <Badge variant={connectionRetries > 0 ? "destructive" : "default"}>
                        {connectionRetries}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Participant Activity Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Participant Activity Summary</CardTitle>
                <CardDescription>Quick overview of participant engagement</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{participants.length}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Participants</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">
                      {participants.filter(p => p.status === 'present').length}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Currently Present</p>
                  </div>
                  <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                    <p className="text-2xl font-bold text-orange-600">
                      {participants.filter(p => p.status === 'left-early').length}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Left Early</p>
                  </div>
                  <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">
                      {participants.length > 0 ? Math.round(participants.reduce((acc, p) => acc + p.duration, 0) / participants.length / 60) : 0}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Avg Duration (min)</p>
                  </div>
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
