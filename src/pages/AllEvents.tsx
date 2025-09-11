import React, { useState, useEffect } from 'react';
import axios from "axios";
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Eye, Filter, Calendar, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import EventCard from '@/components/EventCard';
import ProfileDropdown from '@/components/ProfileDropdown';
import ParticipantReports from '@/components/ParticipantReports';
import EventSettings from '@/components/EventSettings';
import FeedbackFormManager from '@/components/FeedbackFormManager';
import { Link, useNavigate } from 'react-router-dom';

interface Event {
  id: string;
  _id: string;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  status: 'upcoming' | 'active' | 'completed';
  totalParticipants: number;
  checkedIn: number;
  currentlyPresent: number;
  eventCode: string;
}

const AllEvents = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [hiddenEventIds, setHiddenEventIds] = useState<string[]>(() => {
    const stored = localStorage.getItem("hiddenEventIds");
    return stored ? JSON.parse(stored) : [];
  });
  
  // Modal states
  const [selectedEventForReports, setSelectedEventForReports] = useState<string | null>(null);
  const [selectedEventForSettings, setSelectedEventForSettings] = useState<string | null>(null);
  const [selectedEventForFeedback, setSelectedEventForFeedback] = useState<string | null>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/events', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        const result = await response.json();
        if (result.success) {
          // Add fallback for missing fields
          const processed = result.data.events.map((e: any) => ({
            ...e,
            id: e._id,
            location: e.location?.address || 'Unknown',
            totalParticipants: e.totalParticipants || 0,
            checkedIn: e.checkedIn || 0,
            currentlyPresent: e.currentlyPresent || 0,
            geofence: {
              center: e.location?.coordinates?.coordinates
                ? [e.location.coordinates.coordinates[1], e.location.coordinates.coordinates[0]]
                : [0, 0],
              radius: e.geofenceRadius || 100
            }
          }));

          setEvents(processed);
        } else {
          console.error(result.message);
        }
      } catch (error) {
        console.error('Error fetching events:', error);
        setError('Failed to load events. Please refresh the page.');
        setEvents([]); // Set empty array as fallback
        toast({
          title: "Error",
          description: "Failed to load events. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [toast]);

  useEffect(() => {
    localStorage.setItem("hiddenEventIds", JSON.stringify(hiddenEventIds));
  }, [hiddenEventIds]);

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
        setEvents(prev => prev.filter(e => e.id !== eventId));
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

        setEvents(prevEvents =>
          prevEvents.map(event =>
            event.id === eventId
              ? {
                  ...event,
                  geofence: { center, radius },
                  location: newAddress
                }
              : event
          )
        );
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

  if (loading) {
    return (
      <div className="min-h-[60vh] bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading events...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Something went wrong</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()} className="bg-blue-600 hover:bg-blue-700 text-white">
            Refresh Page
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 relative">
      <ProfileDropdown />
      <div className="bg-white border-b px-6 py-4 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">All Events</h1>
            <p className="text-gray-600 mt-1">View and manage all your events</p>
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
              <h2 className="text-lg font-semibold text-gray-900">
                {showAllEvents ? 'All Events' : 'Active & Upcoming Events'}
              </h2>
              <p className="text-gray-600 text-sm">
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
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Calendar className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {showAllEvents ? 'No events found' : 'No active or upcoming events'}
              </h3>
              <p className="text-gray-600 text-center mb-6">
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
      </div>
    </div>
  );
};

export default AllEvents;