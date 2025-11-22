 
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Users, MapPin, Clock, User, AlertTriangle, Loader2, Radar, Activity, Wifi, WifiOff, RefreshCw, Battery, UserX } from 'lucide-react';
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
    totalAbsent: 0,
    averageDuration: 0
  });
  const [isConnected, setIsConnected] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [connectionRetries, setConnectionRetries] = useState(0);
  const [availableEvents, setAvailableEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [removingParticipant, setRemovingParticipant] = useState<string | null>(null);
  const eventStatusRef = useRef<string | null>(null);

  // Update ref when eventData changes
  useEffect(() => {
    eventStatusRef.current = eventData?.status || null;
  }, [eventData?.status]);

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

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Attendance fetch error:', response.status, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message);
      }

      // Transform attendance data for display
      const transformedParticipants = data.data.attendanceLogs.map(log => {
        // Calculate real-time duration for checked-in participants
        let duration = log.duration || 0;
        if (log.status === 'checked-in' && log.checkInTime) {
          // For active participants, calculate real-time duration
          const checkInTime = new Date(log.checkInTime);
          const now = new Date();
          duration = Math.round((now.getTime() - checkInTime.getTime()) / (1000 * 60)); // Duration in minutes
        }

        return {
          id: log._id,
          participantId: log.participant._id, // Actual participant (user) ID for removal
          name: log.participant.name,
          email: log.participant.email,
          status: log.status === 'checked-in' ? 'present' : 'left-early',
          checkInTime: new Date(log.checkInTime).toLocaleTimeString('en-US', { hour12: true }),
          checkOutTime: log.checkOutTime ? new Date(log.checkOutTime).toLocaleTimeString('en-US', { hour12: true }) : null,
          duration: duration, // Duration already in minutes
          lastSeen: getTimeAgo(log.lastLocationUpdate || log.checkInTime),
          batteryLevel: log.batteryLevel || null // Use actual battery level or null if not available
        };
      });

      setParticipants(transformedParticipants);
      setStats(data.data.stats);

      // Set event data if returned from attendance endpoint
      if (data.data.event) {
        console.log('📍 [ATTENDANCE] Event location data:', {
          hasLocation: !!data.data.event.location,
          hasAddress: !!data.data.event.location?.address,
          address: data.data.event.location?.address,
          fullLocation: data.data.event.location
        });
        setEventData(data.data.event);
      }

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
        // Handle nested event structure: data.data.event or data.data
        const eventInfo = data.data?.event || data.data;
        console.log('📍 [EVENTS] Event location data:', {
          hasLocation: !!eventInfo.location,
          hasAddress: !!eventInfo.location?.address,
          address: eventInfo.location?.address,
          fullLocation: eventInfo.location
        });
        setEventData(eventInfo);
      } else {
        console.error('Failed to fetch event:', data.message);
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
    if (!timeString) return 'Not specified';
    try {
      const date = new Date(`2000-01-01T${timeString}`);
      if (isNaN(date.getTime())) return 'Invalid time';
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.error('Error formatting time:', error);
      return 'Invalid time';
    }
  };

  // Helper function to format event date for multi-day events
  const formatEventDate = (event: any) => {
    if (!event?.date) return 'Date not specified';

    try {
      const startDate = new Date(event.date);
      if (isNaN(startDate.getTime())) return 'Invalid Date';

      if (event.endDate && event.endDate !== event.date) {
        // Multi-day event: show date range
        const endDate = new Date(event.endDate);
        if (isNaN(endDate.getTime())) {
          return startDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
        }
        return `${startDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        })} - ${endDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        })}`;
      } else {
        // Single-day event: show full date
        return startDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid Date';
    }
  };

  // Helper function to calculate time ago
  const getTimeAgo = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));

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

  // Remove participant from event
  const handleRemoveParticipant = async (participant: any) => {
    if (!confirm(`Are you sure you want to remove ${participant.name} from this event? They will be able to join again if they want.`)) {
      return;
    }

    try {
      setRemovingParticipant(participant.id);
      const token = localStorage.getItem('token');

      const response = await fetch(`${API_CONFIG.API_BASE}/attendance/remove-participant`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          eventId: eventId,
          participantId: participant.participantId
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to remove participant');
      }

      toast({
        title: "Participant Removed",
        description: `${participant.name} has been removed from the event`,
      });

      // Refresh attendance data
      await fetchAttendanceData();
    } catch (error: any) {
      console.error('Remove participant error:', error);
      toast({
        title: "Failed to remove participant",
        description: error.message || "Please try again",
        variant: "destructive"
      });
    } finally {
      setRemovingParticipant(null);
    }
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

    // Refresh attendance data every 45 seconds for rate limit friendliness (skip if event completed)
    const dataRefreshInterval = setInterval(() => {
      if (eventStatusRef.current !== 'completed') {
        fetchAttendanceData();
      }
    }, 45000);

    // Also refresh event data every 30 seconds to check if event ended (skip if completed)
    const eventRefreshInterval = setInterval(() => {
      if (eventStatusRef.current !== 'completed') {
        fetchEventData();
      }
    }, 30000);

    return () => {
      clearInterval(timer);
      clearInterval(dataRefreshInterval);
      clearInterval(eventRefreshInterval);
    };
  }, [eventId, navigate, fetchEventData, fetchAttendanceData, fetchAvailableEvents]);

  // Stop monitoring when event is completed and redirect
  useEffect(() => {
    if (eventData?.status === 'completed') {
      toast({
        title: "Event Ended",
        description: "This event has ended. Redirecting to event monitor...",
        variant: "default"
      });

      // Redirect to event monitor page after 2 seconds
      const redirectTimer = setTimeout(() => {
        navigate('/event-monitor');
      }, 2000);

      return () => clearTimeout(redirectTimer);
    }
  }, [eventData?.status, navigate]);


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
              <Link to="/all-events">
                <Button variant="outline">Back to All Events</Button>
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

      {/* Event Completed Banner */}
      {eventData?.status === 'completed' && (
        <div className="bg-gray-700 text-white py-3 px-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-semibold">Event Ended - Live monitoring has stopped</span>
          </div>
        </div>
      )}

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
                disabled={refreshing || eventData?.status === 'completed'}
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
                {eventData?.status === 'completed' ? 'Event Ended' : refreshing ? 'Refreshing...' : 'Refresh Data'}
              </Button>
              <Link to="/event-monitor">
                <Button variant="outline">Back to Event Monitor</Button>
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
                    <p className="text-xs text-gray-600 dark:text-gray-400">Late</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-600">
                      {stats.totalAbsent || 0}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Absent</p>
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
                      <p className="text-gray-600 dark:text-gray-400">
                        {eventData.startTime || eventData.endTime ? (
                          <>
                            {formatTime(eventData.startTime)}
                            {eventData.endTime && eventData.endTime !== eventData.startTime && (
                              <> - {formatTime(eventData.endTime)}</>
                            )}
                          </>
                        ) : (
                          'Time not specified'
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Location</p>
                      <p
                        className="text-gray-600 dark:text-gray-400 truncate max-w-full"
                        title={eventData.location?.address || 'Location not specified'}
                      >
                        {eventData.location?.address || 'Location not specified'}
                      </p>
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
                  {participants && participants.length > 0 ? (
                    <Accordion type="multiple" className="space-y-4">
                      {participants.map((participant) => (
                        <AccordionItem
                          key={participant.id}
                          value={participant.id}
                          className="border rounded-lg"
                        >
                          <AccordionTrigger className="px-4 py-3 hover:no-underline">
                            <div className="flex justify-between items-start w-full pr-4">
                              <div className="text-left">
                                <h3 className="font-semibold">{participant.name}</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">{participant.email}</p>
                              </div>
                              <Badge variant={getStatusColor(participant.status)} className="flex items-center gap-1">
                                {getStatusIcon(participant.status)}
                                {participant.status.replace('-', ' ')}
                              </Badge>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-4 pb-4">
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm text-gray-600 dark:text-gray-400 mb-4">
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
                                <p>{participant.duration || 0} minutes</p>
                              </div>
                              <div>
                                <p className="font-medium">Status</p>
                                <p className="capitalize">{participant.status.replace('-', ' ')}</p>
                              </div>
                              <div>
                                <p className="font-medium flex items-center gap-1">
                                  <Battery className="w-4 h-4" />
                                  Battery
                                </p>
                                <p className={`font-semibold ${participant.batteryLevel ? getBatteryColor(participant.batteryLevel) : 'text-gray-400'}`}>
                                  {participant.batteryLevel ? `${participant.batteryLevel}%` : 'N/A'}
                                </p>
                              </div>
                            </div>

                            {/* Remove Participant Button */}
                            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleRemoveParticipant(participant)}
                                disabled={removingParticipant === participant.id}
                                className="w-full sm:w-auto"
                              >
                                {removingParticipant === participant.id ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Removing...
                                  </>
                                ) : (
                                  <>
                                    <UserX className="w-4 h-4 mr-2" />
                                    Remove from Event
                                  </>
                                )}
                              </Button>
                              <p className="text-xs text-gray-500 mt-2">
                                Removing this participant will allow them to join the event again if they choose to.
                              </p>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  ) : (
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
