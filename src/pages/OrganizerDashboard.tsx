import React from 'react';
import axios from "axios";
import { useState, useEffect } from 'react';
import { useEvents } from '@/hooks/useEvents';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Eye, Filter, MoreHorizontal, Edit, Mail, Calendar, MapPin, Users, Settings, FileText, MessageSquare, Trash, QrCode, Map, Send, User, LogOut, Bell, Globe, Lock, WifiOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import DashboardStats from '@/components/DashboardStats';
import EventCard from '@/components/EventCard';
import ParticipantReports from '@/components/ParticipantReports';
import EventExportDialog from '@/components/EventExportDialog';
import EventSettings from '@/components/EventSettings';
import FeedbackFormBuilder from '@/components/FeedbackFormBuilder';
import FeedbackFormManager from '@/components/FeedbackFormManager';
import QRCodeDisplay from '@/components/QRCodeDisplay';
import GeofenceMap from '@/components/GeofenceMap';
import Profile from '@/components/Profile';
import { exportEventSummary, exportDetailedEventReport } from '@/utils/reportUtils';
import { useToast } from '@/hooks/use-toast';
import { API_CONFIG } from '@/config';

const OrganizerDashboard = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [selectedEventForReports, setSelectedEventForReports] = useState<string | null>(null);
  const [selectedEventForSettings, setSelectedEventForSettings] = useState<string | null>(null);
  const [selectedEventForFeedback, setSelectedEventForFeedback] = useState<string | null>(null);
  const [selectedEventForQR, setSelectedEventForQR] = useState<string | null>(null);
  const [selectedEventForGeofence, setSelectedEventForGeofence] = useState<string | null>(null);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isQRDialogOpen, setIsQRDialogOpen] = useState(false);
  const [isGeofenceDialogOpen, setIsGeofenceDialogOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [eventsWithUnpublishedChanges, setEventsWithUnpublishedChanges] = useState<Set<string>>(new Set());

  // Check for system-wide dark mode
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check localStorage first, then fallback to system preference
    const saved = localStorage.getItem('theme');
    if (saved) {
      return saved === 'dark';
    }
    // If no saved preference, check system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Initialize user data
  useEffect(() => {
    // ✅ Load user from localStorage
    const userData = localStorage.getItem("user");
    if (userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (error) {
        console.error("Error parsing user data:", error);
        setUser({ name: "Organizer", email: "organizer@example.com" });
      }
    } else {
      setUser({ name: "Organizer", email: "organizer@example.com" });
    }

    // ✅ Load hidden events from localStorage
    const storedHidden = localStorage.getItem("hiddenEventIds");
    if (storedHidden) {
      try {
        setHiddenEventIds(JSON.parse(storedHidden));
      } catch (error) {
        console.error("Error parsing hidden events:", error);
        setHiddenEventIds([]);
      }
    }
  }, []);

  // Apply theme to DOM on mount and when isDarkMode changes
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);

    if (newDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
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
      return new Date(event.date).toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = '/';
  };

  // Use optimized events hook with auto-refresh for real-time updates
  const {
    events,
    loading,
    error: eventsError,
    refreshEvents,
    updateEvent,
    lastRefresh
  } = useEvents({
    autoRefresh: true,
    refreshInterval: 30000, // 30 seconds
    cacheTime: 5 * 60 * 1000 // 5 minutes
  });


  // Set error state from events hook
  useEffect(() => {
    if (eventsError) {
      setError(eventsError);
    } else {
      setError(null);
    }
  }, [eventsError]);

  const [hiddenEventIds, setHiddenEventIds] = useState<string[]>([]);

  useEffect(() => {
    localStorage.setItem("hiddenEventIds", JSON.stringify(hiddenEventIds));
  }, [hiddenEventIds]);

  // Auto-checkout system for organizers - check for ended events and auto-checkout participants
  useEffect(() => {
    const checkForEndedEvents = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        const response = await fetch('/api/attendance/auto-checkout-ended-events', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        const result = await response.json();
        
        if (result.success && result.data.totalParticipantsCheckedOut > 0) {
          console.log('Auto-checkout completed:', result.data);
          
          toast({
            title: "Auto Checkout Completed",
            description: `${result.data.totalParticipantsCheckedOut} participant(s) were automatically checked out from ${result.data.totalEventsProcessed} ended event(s).`,
          });

          // Refresh events data to reflect the changes
          refreshEvents().catch(error => {
            console.error('Error refreshing events after auto-checkout:', error);
          });
        }
      } catch (error) {
        // Silently log errors to avoid spamming organizer with network issues
        console.error('Auto-checkout check failed:', error);
      }
    };

    // Initial check
    checkForEndedEvents();
    
    // Set up interval to check every 10 minutes for organizers
    const intervalId = setInterval(checkForEndedEvents, 10 * 60 * 1000);

    // Cleanup interval on component unmount
    return () => clearInterval(intervalId);
  }, [toast]);

  const handleDeleteClick = async (eventId: string, isCompleted: boolean) => {
    if (isCompleted) {
      // hide from UI permanently until reload
      setHiddenEventIds(prev => [...prev, eventId]);
    } else {
      // delete from DB
      try {
        await axios.delete(`/api/events/${eventId}`);
        // Remove from events cache instead of local state
        refreshEvents();
      } catch (error) {
        console.error("Failed to delete event:", error);
      }
    }
  };

  // Sort events by date and filter based on showAllEvents state and hidden events
  const sortedEvents = [...events]
    .filter(e => !hiddenEventIds.includes(e.id))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Sort by newest first
  const displayedEvents = showAllEvents
    ? sortedEvents
    : sortedEvents.filter(event => event.status === 'active' || event.status === 'upcoming');

  const stats = {
    totalEvents: events?.length || 0,
    activeEvents: events?.filter(e => e.status === 'active').length || 0,
    totalParticipants: events?.reduce((sum, e) => sum + (e.totalParticipants || 0), 0) || 0,
    currentlyPresent: events?.reduce((sum, e) => sum + (e.currentlyPresent || 0), 0) || 0
  };

  const handleGeofenceUpdate = async (eventId: string, center: [number, number], radius: number) => {
    console.log(`Updating geofence for event ${eventId}:`, { center, radius });

    try {
      const token = localStorage.getItem('token');

      // Reverse geocode the new center coordinates (lat, lng)
      const reverseGeocodeRes = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${center[0]}&lon=${center[1]}`,
        {
          headers: {
            'User-Agent': 'YourAppName/1.0' // Nominatim requires this
          }
        }
      );

      const geocodeData = await reverseGeocodeRes.json();
      const newAddress = geocodeData.display_name || 'Unknown';

      const response = await fetch(`/api/events/${eventId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          location: {
            address: newAddress,
            coordinates: {
              type: 'Point',
              coordinates: [center[1], center[0]] // [lng, lat]
            }
          },
          geofenceRadius: radius
        })
      });

      const result = await response.json();

      if (result.success) {
        // Mark event as having unpublished changes
        setEventsWithUnpublishedChanges(prev => new Set(prev).add(eventId));

        toast({
          title: 'Geofence Updated',
          description: `Geofence and location were saved for event "${result.data.event.title}"`,
        });

        updateEvent(eventId, {
          geofence: { center, radius },
          location: newAddress
        });
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      console.error('Failed to update geofence:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update geofence.',
        variant: 'destructive'
      });
    }
  };

  const handleExportReports = async () => {
    try {
      const token = localStorage.getItem('token');

      // Fetch attendance data for all events in parallel
      const fetchPromises = events.map(event =>
        fetch(`/api/attendance/event/${event._id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
          .then(response => response.ok ? response.json() : null)
          .then(result => ({ event, result }))
          .catch(error => {
            console.error(`Error fetching data for event ${event.title}:`, error);
            return { event, result: null, error };
          })
      );

      // Wait for all requests to complete
      const responses = await Promise.all(fetchPromises);

      // Process results into report data
      const detailedReportData = [];

      responses.forEach(({ event, result, error }) => {
        if (result?.success) {
          const attendanceLogs = result.data?.attendanceLogs || [];

          if (attendanceLogs.length > 0) {
            // Add each participant as a separate row
            attendanceLogs.forEach(log => {
              if (log.participant) {
                detailedReportData.push({
                  eventTitle: event.title,
                  eventDate: event.date,
                  eventLocation: event.location,
                  eventStatus: event.status,
                  participantName: log.participant.name,
                  participantEmail: log.participant.email,
                  checkInTime: log.checkInTime,
                  checkOutTime: log.checkOutTime,
                  duration: log.duration,
                  attendanceStatus: log.status
                });
              }
            });
          } else {
            // No participants
            detailedReportData.push({
              eventTitle: event.title,
              eventDate: event.date,
              eventLocation: event.location,
              eventStatus: event.status,
              participantName: 'No participants',
              participantEmail: '',
              checkInTime: '',
              checkOutTime: '',
              duration: '',
              attendanceStatus: ''
            });
          }
        } else {
          // API failed or error occurred
          detailedReportData.push({
            eventTitle: event.title,
            eventDate: event.date,
            eventLocation: event.location,
            eventStatus: event.status,
            participantName: error ? 'Error fetching data' : 'Data not available',
            participantEmail: '',
            checkInTime: '',
            checkOutTime: '',
            duration: '',
            attendanceStatus: ''
          });
        }
      });

      const success = exportDetailedEventReport(detailedReportData);
      if (success) {
        toast({
          title: "Reports Exported",
          description: "Detailed events report with participant names has been downloaded as CSV file.",
        });
      }
    } catch (error) {
      console.error('Error exporting reports:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export reports. Please try again.",
        variant: "destructive",
      });
    }
  };

  const openReportsDialog = (eventId: string) => {
    setSelectedEventForReports(eventId);
  };

  const closeReportsDialog = () => {
    setSelectedEventForReports(null);
  };

  const openSettingsDialog = (eventId: string) => {
    setSelectedEventForSettings(eventId);
  };

  const closeSettingsDialog = () => {
    setSelectedEventForSettings(null);
  };

  const openInvitationDialog = (eventId: string) => {
    const event = events.find(e => e.id === eventId);
    if (event) {
      const params = new URLSearchParams();
      params.set('eventId', eventId);
      params.set('eventTitle', event.title);
      navigate(`/send-invitations?${params.toString()}`);
    }
  };

  const openFeedbackDialog = (eventId: string) => {
    setSelectedEventForFeedback(eventId);
  };

  const openQRDialog = (eventId: string) => {
    setSelectedEventForQR(eventId);
    setIsQRDialogOpen(true);
  };

  const openGeofenceDialog = (eventId: string) => {
    setSelectedEventForGeofence(eventId);
    setIsGeofenceDialogOpen(true);
  };

  const closeFeedbackDialog = () => {
    setSelectedEventForFeedback(null);
  };

  const closeQRDialog = () => {
    setSelectedEventForQR(null);
    setIsQRDialogOpen(false);
  };

  const closeGeofenceDialog = () => {
    setSelectedEventForGeofence(null);
    setIsGeofenceDialogOpen(false);
  };


  const handleEventUpdate = (eventId: string, updatedData: any) => {
    console.log(`Updating event ${eventId}:`, updatedData);

    // Mark event as having unpublished changes
    setEventsWithUnpublishedChanges(prev => new Set(prev).add(eventId));

    toast({
      title: "Event Updated",
      description: "Event has been updated successfully.",
    });
  };

  const handleEventDelete = (eventId: string) => {
    console.log(`Deleting event ${eventId}`);
    toast({
      title: "Event Deleted",
      description: "Event has been deleted successfully.",
      variant: "destructive",
    });
  };

  // Toggle Public/Private visibility
  const handleTogglePublicPrivate = async (eventId: string) => {
    try {
      const event = events.find(e => e.id === eventId);
      if (!event) {
        toast({
          title: "Error",
          description: "Event not found.",
          variant: "destructive",
        });
        return;
      }

      // Toggle the published status
      const newPublishedStatus = !event.published;

      const token = localStorage.getItem('token');
      const response = await fetch(`${API_CONFIG.API_BASE}/events/${eventId}/publish`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          published: newPublishedStatus
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to update visibility');
      }

      // Update the event in cache
      updateEvent(eventId, { published: newPublishedStatus });

      toast({
        title: newPublishedStatus ? "Event Made Public" : "Event Made Private",
        description: `"${event.title}" is now ${newPublishedStatus ? 'visible to participants' : 'hidden from participants'}.`,
      });
    } catch (error: any) {
      console.error('Error updating visibility:', error);
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update visibility. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Publish changes to mobile apps immediately
  const handlePublishChanges = async (eventId: string) => {
    try {
      const event = events.find(e => e.id === eventId);
      if (!event) {
        toast({
          title: "Error",
          description: "Event not found.",
          variant: "destructive",
        });
        return;
      }

      const token = localStorage.getItem('token');
      // Touch the updatedAt field to trigger mobile app refresh
      const response = await fetch(`${API_CONFIG.API_BASE}/events/${eventId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          // Send minimal update to trigger updatedAt timestamp
          title: event.title
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to publish changes');
      }

      // Remove event from unpublished changes set
      setEventsWithUnpublishedChanges(prev => {
        const newSet = new Set(prev);
        newSet.delete(eventId);
        return newSet;
      });

      toast({
        title: "Changes Published",
        description: `Latest changes to "${event.title}" will appear in mobile apps within 2 minutes.`,
      });
    } catch (error: any) {
      console.error('Error publishing changes:', error);
      toast({
        title: "Publish Failed",
        description: error.message || "Failed to publish changes. Please try again.",
        variant: "destructive",
      });
    }
  };

  const selectedEvent = events.find(event => event.id === selectedEventForReports);
  const selectedEventForSettingsData = events.find(event => event.id === selectedEventForSettings);
  const selectedEventForFeedbackData = events.find(event => event.id === selectedEventForFeedback);
  const selectedEventForQRData = events.find(event => event.id === selectedEventForQR);
  const selectedEventForGeofenceData = events.find(event => event.id === selectedEventForGeofence);

  if (loading) {
    return (
      <div className="min-h-[60vh] bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Something went wrong</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()} className="bg-blue-600 hover:bg-blue-700 text-white">
            Refresh Page
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 min-h-screen">
      {/* Header Section */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Organizer Dashboard
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Welcome back, {user?.name || 'Organizer'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8 space-y-8">
        {/* Stats Section */}
        <div>
          {stats && <DashboardStats stats={stats} />}
        </div>

        {/* Actions Section */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Link to="/create-event" className="sm:flex-1">
            <Button className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 border-0 font-semibold py-3">
              <Plus className="w-5 h-5 mr-2" />
              Create New Event
            </Button>
          </Link>
          <Button 
            variant="outline" 
            onClick={() => setIsExportDialogOpen(true)}
            className="sm:flex-1 w-full rounded-xl hover:bg-accent transition-all duration-300 border-2 hover:border-primary font-semibold py-3 shadow-md hover:shadow-lg transform hover:scale-105"
          >
            Export Reports
          </Button>
        </div>

        {/* Events Section */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-foreground">
                {showAllEvents ? 'All Events' : 'Active & Upcoming Events'}
              </h2>
              <p className="text-muted-foreground text-sm">
                {showAllEvents
                  ? 'Manage and monitor all your events (newest first)'
                  : 'Currently active and upcoming events'
                }
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowAllEvents(!showAllEvents)}
              className="rounded-xl hover:bg-accent transition-all duration-300 border-2 hover:border-primary font-semibold shadow-md hover:shadow-lg transform hover:scale-105 whitespace-nowrap"
            >
              {showAllEvents ? (
                <>
                  <Filter className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Show Active & Upcoming</span>
                  <span className="sm:hidden">Filter</span>
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">View All Events</span>
                  <span className="sm:hidden">All</span>
                </>
              )}
            </Button>
          </div>

          {displayedEvents.length === 0 ? (
            <Card className="border-dashed border-2 border-muted-foreground/25">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  {eventsError ? (
                    <WifiOff className="w-8 h-8 text-muted-foreground" />
                  ) : (
                    <Plus className="w-8 h-8 text-muted-foreground" />
                  )}
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {eventsError
                    ? 'No internet connection'
                    : (showAllEvents ? 'No events yet' : 'No active or upcoming events')
                  }
                </h3>
                <p className="text-muted-foreground text-center mb-6">
                  {eventsError
                    ? 'Please check your internet connection and try again'
                    : (showAllEvents
                      ? 'Get started by creating your first event'
                      : 'All your events are completed. Create a new event or check all events.')
                  }
                </p>
                <div className="flex gap-3">
                  <Link to="/create-event">
                    <Button className="rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 border-0 font-semibold py-3">
                      <Plus className="w-5 h-5 mr-2" />
                      Create Event
                    </Button>
                  </Link>
                  {!showAllEvents && (
                    <Button
                      variant="outline"
                      onClick={() => setShowAllEvents(true)}
                      className="rounded-xl hover:bg-accent transition-all duration-300 border-2 hover:border-primary font-semibold shadow-md hover:shadow-lg transform hover:scale-105"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View All Events
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event Title</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Total</TableHead>
                      <TableHead className="text-center">Checked In</TableHead>
                      <TableHead className="text-center">Absent</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedEvents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No events found. Create your first event to get started!
                        </TableCell>
                      </TableRow>
                    ) : (
                      displayedEvents.map((event) => (
                        <TableRow key={event.id} className="hover:bg-muted/50 transition-colors">
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-muted-foreground" />
                              <span className="font-semibold">{event.title}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatEventDate(event)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-muted-foreground" />
                              <span className="truncate max-w-[150px] text-sm" title={typeof event.location === 'string' ? event.location : event.location?.address || 'Location not specified'}>
                                {typeof event.location === 'string' ? event.location : event.location?.address || 'Location not specified'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={`${
                                event.status === 'active'
                                  ? 'bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-950/30 dark:text-green-400'
                                  : event.status === 'completed'
                                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-400'
                                  : event.status === 'upcoming'
                                  ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100 dark:bg-yellow-950/30 dark:text-yellow-400'
                                  : 'bg-blue-100 text-blue-700 hover:bg-blue-100'
                              }`}
                            >
                              {event.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-muted/50">
                              <Users className="w-4 h-4 text-muted-foreground" />
                              <span className="font-bold">{event.totalParticipants}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-green-50 dark:bg-green-950/30">
                              <span className="font-bold text-green-600">
                                {event.status === 'completed'
                                  ? event.totalParticipants - event.currentlyPresent
                                  : event.checkedIn}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/30">
                              <span className="font-bold text-red-600">
                                {event.currentlyPresent}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {event.status === 'completed' ? (
                                  // Completed events: Only Reports, Manage Feedback, and Delete
                                  <>
                                    <DropdownMenuItem onClick={() => openReportsDialog(event.id)}>
                                      <FileText className="w-4 h-4 mr-2" />
                                      Reports
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => openFeedbackDialog(event.id)}>
                                      <MessageSquare className="w-4 h-4 mr-2" />
                                      Manage Feedback
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      onClick={() => handleDeleteClick(event.id, true)}
                                      className="text-red-600"
                                    >
                                      <Trash className="w-4 h-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </>
                                ) : (
                                  // Active/Upcoming events: All options
                                  <>
                                    <DropdownMenuItem onClick={() => openReportsDialog(event.id)}>
                                      <FileText className="w-4 h-4 mr-2" />
                                      Reports
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => openInvitationDialog(event.id)}>
                                      <Mail className="w-4 h-4 mr-2" />
                                      Invitations
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => openQRDialog(event.id)}>
                                      <QrCode className="w-4 h-4 mr-2" />
                                      QR Code
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => openGeofenceDialog(event.id)}>
                                      <Map className="w-4 h-4 mr-2" />
                                      Geofence
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => openSettingsDialog(event.id)}>
                                      <Settings className="w-4 h-4 mr-2" />
                                      Settings
                                    </DropdownMenuItem>
                                    {eventsWithUnpublishedChanges.has(event.id) && (
                                      <DropdownMenuItem onClick={() => handlePublishChanges(event.id)}>
                                        <Send className="w-4 h-4 mr-2" />
                                        Publish Changes
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem onClick={() => handleTogglePublicPrivate(event.id)}>
                                      {event.published ? (
                                        <>
                                          <Lock className="w-4 h-4 mr-2" />
                                          Make Private
                                        </>
                                      ) : (
                                        <>
                                          <Globe className="w-4 h-4 mr-2" />
                                          Make Public
                                        </>
                                      )}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => openFeedbackDialog(event.id)}>
                                      <MessageSquare className="w-4 h-4 mr-2" />
                                      Feedback
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Dialogs */}
        {selectedEvent && (
          <ParticipantReports
            eventId={selectedEvent.id}
            eventTitle={selectedEvent.title}
            isOpen={!!selectedEventForReports}
            onClose={closeReportsDialog}
          />
        )}

        {selectedEventForSettingsData && (
          <EventSettings
            event={selectedEventForSettingsData}
            isOpen={!!selectedEventForSettings}
            onClose={closeSettingsDialog}
            onEventUpdate={handleEventUpdate}
            onEventDelete={handleEventDelete}
          />
        )}


        {selectedEventForFeedbackData && (
          <FeedbackFormManager
            eventId={selectedEventForFeedbackData.id}
            eventTitle={selectedEventForFeedbackData.title}
            isOpen={!!selectedEventForFeedback}
            onClose={closeFeedbackDialog}
          />
        )}

        <EventExportDialog
          events={events.filter(event => event.status === 'completed')}
          isOpen={isExportDialogOpen}
          onClose={() => setIsExportDialogOpen(false)}
        />

        {selectedEventForQRData && (
          <Dialog open={isQRDialogOpen} onOpenChange={closeQRDialog}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>QR Code - {selectedEventForQRData.title}</DialogTitle>
              </DialogHeader>
              <QRCodeDisplay
                eventId={selectedEventForQRData.id}
                eventTitle={selectedEventForQRData.title}
                eventCode={selectedEventForQRData.eventCode}
                isPublished={selectedEventForQRData.published}
              />
            </DialogContent>
          </Dialog>
        )}

        {selectedEventForGeofenceData && (
          <Dialog open={isGeofenceDialogOpen} onOpenChange={closeGeofenceDialog}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Geofence - {selectedEventForGeofenceData.title}</DialogTitle>
              </DialogHeader>
              <div className="max-h-[70vh] overflow-y-auto">
                <GeofenceMap
                  eventId={selectedEventForGeofenceData.id}
                  initialCenter={selectedEventForGeofenceData.geofence?.center || [0, 0]}
                  initialRadius={selectedEventForGeofenceData.geofence?.radius || 100}
                  onGeofenceUpdate={(center, radius) => handleGeofenceUpdate(selectedEventForGeofenceData.id, center, radius)}
                />
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Profile Modal */}
        <Profile
          isOpen={showProfile}
          onClose={() => setShowProfile(false)}
        />
      </div>
    </div>
  );
};

export default OrganizerDashboard;