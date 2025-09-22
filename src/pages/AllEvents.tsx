import { useState, useEffect } from 'react';
import axios from "axios";
import { useEvents } from '@/hooks/useEvents';
import { API_CONFIG } from '@/config';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Eye, Filter, Calendar, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import EventCard from '@/components/EventCard';
import ParticipantReports from '@/components/ParticipantReports';
import EventSettings from '@/components/EventSettings';
import FeedbackFormManager from '@/components/FeedbackFormManager';
import QRCodeDisplay from '@/components/QRCodeDisplay';
import GeofenceMap from '@/components/GeofenceMap';
import { Link, useNavigate } from 'react-router-dom';

interface Event {
  id: string;
  _id: string;
  title: string;
  description?: string;
  eventType?: 'single-day' | 'multi-day';
  date: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  location: {
    address: string;
    coordinates: {
      type: 'Point';
      coordinates: [number, number];
    };
  };
  status: 'upcoming' | 'active' | 'completed';
  totalParticipants: number;
  checkedIn: number;
  currentlyPresent: number;
  eventCode: string;
  maxTimeOutside?: number;
  published?: boolean;
  geofence: {
    center: [number, number];
    radius: number;
  };
}

const AllEvents = () => {
  const { toast } = useToast();
  const navigate = useNavigate();

  // Use optimized events hook
  const {
    events,
    loading,
    error: eventsError,
    refreshEvents,
    updateEvent
  } = useEvents();
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [hiddenEventIds, setHiddenEventIds] = useState<string[]>(() => {
    const stored = localStorage.getItem("hiddenEventIds");
    return stored ? JSON.parse(stored) : [];
  });

  // Track events with unpublished changes - persist in localStorage
  const [eventsWithChanges, setEventsWithChanges] = useState<Set<string>>(() => {
    const stored = localStorage.getItem("eventsWithChanges");
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });

  // Mark event as having changes when edited
  const markEventAsChanged = (eventId: string) => {
    setEventsWithChanges(prev => {
      const newSet = new Set(prev);
      newSet.add(eventId);
      return newSet;
    });
  };
  
  // Modal states
  const [selectedEventForReports, setSelectedEventForReports] = useState<string | null>(null);
  const [selectedEventForSettings, setSelectedEventForSettings] = useState<string | null>(null);
  const [selectedEventForFeedback, setSelectedEventForFeedback] = useState<string | null>(null);
  const [selectedEventForQR, setSelectedEventForQR] = useState<string | null>(null);
  const [selectedEventForGeofence, setSelectedEventForGeofence] = useState<string | null>(null);
  const [isQRDialogOpen, setIsQRDialogOpen] = useState(false);
  const [isGeofenceDialogOpen, setIsGeofenceDialogOpen] = useState(false);

  // Set local error state from events hook
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (eventsError) {
      setError(eventsError);
      toast({
        title: "Error",
        description: "Failed to load events. Please try again.",
        variant: "destructive",
      });
    } else {
      setError(null);
    }
  }, [eventsError, toast]);

  useEffect(() => {
    localStorage.setItem("hiddenEventIds", JSON.stringify(hiddenEventIds));
  }, [hiddenEventIds]);

  useEffect(() => {
    localStorage.setItem("eventsWithChanges", JSON.stringify(Array.from(eventsWithChanges)));
  }, [eventsWithChanges]);

  // Filter events based on showAllEvents state and hidden events
  const visibleEvents = events.filter(e => !hiddenEventIds.includes(e.id));
  const sortedEvents = [...visibleEvents].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const displayedEvents = showAllEvents 
    ? sortedEvents 
    : sortedEvents.filter(event => event.status === 'active' || event.status === 'upcoming');

  // Modal dialog handlers
  const handleInvitationClick = (eventId: string) => {
    const event = events.find(e => e.id === eventId);
    if (event) {
      const params = new URLSearchParams();
      params.set('eventId', eventId);
      params.set('eventTitle', event.title);
      navigate(`/send-invitations?${params.toString()}`);
    }
  };

  const handleReportsClick = (eventId: string) => {
    setSelectedEventForReports(eventId);
  };

  const handleSettingsClick = (eventId: string) => {
    setSelectedEventForSettings(eventId);
  };

  const handleFeedbackClick = (eventId: string) => {
    setSelectedEventForFeedback(eventId);
  };

  const handleDeleteClick = async (eventId: string, isCompleted: boolean) => {
    if (isCompleted) {
      // Hide from UI permanently until reload
      setHiddenEventIds(prev => [...prev, eventId]);
    } else {
      // Delete from DB
      try {
        await axios.delete(`/api/events/${eventId}`);
        // Refresh events to reflect deletion
        refreshEvents();
        toast({
          title: "Event Deleted",
          description: "Event has been deleted successfully.",
          variant: "destructive",
        });
      } catch (error) {
        console.error("Failed to delete event:", error);
        toast({
          title: "Error",
          description: "Failed to delete event. Please try again.",
          variant: "destructive",
        });
      }
    }
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
            'User-Agent': 'EventConnect/1.0'
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
        toast({
          title: 'Geofence Updated',
          description: `Geofence and location were saved for event "${result.data.event.title}"`,
        });

        // Update event in cache
        updateEvent(eventId, {
          geofence: { center, radius },
          location: {
            address: newAddress,
            coordinates: {
              type: 'Point',
              coordinates: [center[1], center[0]]
            }
          }
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

  // QR Code and Geofence modal handlers
  const openQRDialog = (eventId: string) => {
    setSelectedEventForQR(eventId);
    setIsQRDialogOpen(true);
  };

  const openGeofenceDialog = (eventId: string) => {
    setSelectedEventForGeofence(eventId);
    setIsGeofenceDialogOpen(true);
  };

  const closeQRDialog = () => {
    setSelectedEventForQR(null);
    setIsQRDialogOpen(false);
  };

  const closeGeofenceDialog = () => {
    setSelectedEventForGeofence(null);
    setIsGeofenceDialogOpen(false);
  };

  // Close modal handlers
  const closeReportsDialog = () => {
    setSelectedEventForReports(null);
  };

  const closeSettingsDialog = () => {
    setSelectedEventForSettings(null);
  };

  const closeFeedbackDialog = () => {
    setSelectedEventForFeedback(null);
  };

  const handleEventUpdate = (eventId: string, updatedData: any) => {
    console.log(`Updating event ${eventId}:`, updatedData);

    // Mark event as having unpublished changes
    markEventAsChanged(eventId);

    toast({
      title: "Event Updated",
      description: "Event has been updated successfully. Use 'Publish Changes' to notify participants.",
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

  const handlePublishClick = async (eventId: string) => {
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

      // Show confirmation dialog
      const newPublishedStatus = !event.published;
      const action = newPublishedStatus ? 'make public' : 'make private';
      const confirmMessage = newPublishedStatus
        ? `Are you sure you want to make "${event.title}" public? This will allow participants to see and register for this event.`
        : `Are you sure you want to make "${event.title}" private? This will hide it from participants.`;

      const confirmed = window.confirm(confirmMessage);
      if (!confirmed) {
        return;
      }

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
        throw new Error(result.message || 'Failed to update publish status');
      }

      // Update event in cache
      updateEvent(eventId, { published: newPublishedStatus });

      toast({
        title: newPublishedStatus ? "Public Event" : "Private Event",
        description: `"${event.title}" is now ${newPublishedStatus ? 'public' : 'private'} successfully.`,
      });
    } catch (error: any) {
      console.error('Error updating public status:', error);
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update public status. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle publishing changes for active events
  const handlePublishChangesClick = async (eventId: string) => {
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

      // Clear the changes flag for this event
      setEventsWithChanges(prev => {
        const newSet = new Set(prev);
        newSet.delete(eventId);
        return newSet;
      });

      toast({
        title: "Changes Published",
        description: `Updates to "${event.title}" have been published to all participants.`,
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

  if (loading) {
    return (
      <div className="min-h-[60vh] bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading events...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
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
    <div className="bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 px-6 py-4 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">All Events</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">View and manage all your events</p>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowAllEvents(!showAllEvents)}
            className="flex items-center gap-2"
          >
            {showAllEvents ? (
              <>
                <Filter className="w-4 h-4" />
                Show Active & Upcoming
              </>
            ) : (
              <>
                <Eye className="w-4 h-4" />
                View All Events
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-6 py-4">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {showAllEvents ? 'All Events' : 'Active & Upcoming Events'}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                {showAllEvents 
                  ? `Showing ${displayedEvents.length} of ${events.length} events (sorted by date)` 
                  : `${displayedEvents.length} active and upcoming events`
                }
              </p>
            </div>
          </div>
        </div>

        {displayedEvents.length === 0 ? (
          <Card className="border-dashed border-2 border-gray-300">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                <Calendar className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {showAllEvents ? 'No events found' : 'No active or upcoming events'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
                {showAllEvents 
                  ? 'You haven\'t created any events yet.'
                  : 'All your events are completed. Create a new event or view all events.'
                }
              </p>
              <div className="flex gap-3">
                <Link to="/create-event">
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Event
                  </Button>
                </Link>
                {!showAllEvents && (
                  <Button 
                    variant="outline" 
                    onClick={() => setShowAllEvents(true)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View All Events
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {displayedEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onInvitationClick={handleInvitationClick}
                onReportsClick={handleReportsClick}
                onSettingsClick={handleSettingsClick}
                onGeofenceUpdate={handleGeofenceUpdate}
                onFeedbackClick={handleFeedbackClick}
                onDeleteClick={handleDeleteClick}
                onPublishClick={handlePublishClick}
                onPublishChangesClick={handlePublishChangesClick}
                hasUnpublishedChanges={eventsWithChanges.has(event.id)}
                onQRClick={openQRDialog}
                onGeofenceClick={openGeofenceDialog}
              />
            ))}
          </div>
        )}

        {/* Modal Dialogs */}
        {selectedEventForReports && (
          <ParticipantReports
            eventId={selectedEventForReports}
            eventTitle={events.find(e => e.id === selectedEventForReports)?.title || ''}
            isOpen={!!selectedEventForReports}
            onClose={closeReportsDialog}
          />
        )}

        {selectedEventForSettings && (
          <EventSettings
            event={events.find(e => e.id === selectedEventForSettings)!}
            isOpen={!!selectedEventForSettings}
            onClose={closeSettingsDialog}
            onEventUpdate={handleEventUpdate}
            onEventDelete={handleEventDelete}
          />
        )}


        {selectedEventForFeedback && (
          <FeedbackFormManager
            eventId={selectedEventForFeedback}
            eventTitle={events.find(e => e.id === selectedEventForFeedback)?.title || ''}
            isOpen={!!selectedEventForFeedback}
            onClose={closeFeedbackDialog}
          />
        )}

        {/* QR Code Modal */}
        {selectedEventForQR && (
          <Dialog open={isQRDialogOpen} onOpenChange={closeQRDialog}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Event QR Code</DialogTitle>
              </DialogHeader>
              <div className="flex justify-center">
                <QRCodeDisplay
                  eventId={selectedEventForQR}
                  eventTitle={events.find(e => e.id === selectedEventForQR)?.title || ''}
                  eventCode={events.find(e => e.id === selectedEventForQR)?.eventCode || ''}
                  isPublished={events.find(e => e.id === selectedEventForQR)?.published}
                />
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Geofence Modal */}
        {selectedEventForGeofence && (
          <Dialog open={isGeofenceDialogOpen} onOpenChange={closeGeofenceDialog}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Configure Geofence</DialogTitle>
              </DialogHeader>
              <div className="max-h-[70vh] overflow-y-auto">
                <GeofenceMap
                  eventId={selectedEventForGeofence}
                  initialCenter={events.find(e => e.id === selectedEventForGeofence)?.geofence?.center}
                  initialRadius={events.find(e => e.id === selectedEventForGeofence)?.geofence?.radius}
                  onGeofenceUpdate={(center, radius) => handleGeofenceUpdate(selectedEventForGeofence, center, radius)}
                  showSaveButton={true}
                />
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
};

export default AllEvents;