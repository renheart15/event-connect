import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { QrCode, Calendar, MapPin, Users, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const JoinEvent = () => {
  const { eventCode } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    const fetchEvent = async () => {
      if (!eventCode) {
        setError('No event code provided');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/events/code/${eventCode.toUpperCase()}`);
        const result = await response.json();

        if (result.success) {
          const eventData = result.data.event;

          // Check if event is published (available for public access)
          if (!eventData.published) {
            throw new Error('This event is not currently available for registration');
          }

          setEvent(eventData);

          // Check if user is already logged in, show join modal immediately
          const token = localStorage.getItem('token');
          if (token) {
            setShowJoinModal(true);
          }
        } else {
          throw new Error(result.message || 'Event not found');
        }
      } catch (error: any) {
        console.error('Error fetching event:', error);
        setError(error.message || 'Failed to load event');
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [eventCode]);

  const handleJoinEvent = () => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (!token) {
      toast({
        title: "Login Required",
        description: "Please login to join this event.",
        variant: "destructive",
      });
      navigate(`/login?redirect=/join/${eventCode}`);
      return;
    }

    // Show confirmation modal
    setShowJoinModal(true);
  };

  const confirmJoinEvent = async () => {
    setIsJoining(true);
    try {
      const token = localStorage.getItem('token');

      // First try to join the event
      const response = await fetch('/api/attendance/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          eventCode: eventCode?.toUpperCase()
        })
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Successfully Joined!",
          description: `You've joined "${event.title}"`,
        });

        // Redirect to participant dashboard
        navigate(`/participant-dashboard?eventCode=${eventCode}`);
      } else if (result.requiresRegistration) {
        // Event requires registration form to be filled first
        toast({
          title: "Registration Required",
          description: "Please complete the registration form first.",
        });

        // Navigate to the registration form
        navigate(`/registration-forms/${result.registrationForm._id}?eventCode=${eventCode}`);
      } else {
        throw new Error(result.message || 'Failed to join event');
      }
    } catch (error: any) {
      console.error('Error joining event:', error);
      toast({
        title: "Join Failed",
        description: error.message || "Failed to join the event. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsJoining(false);
      setShowJoinModal(false);
    }
  };

  const cancelJoinEvent = () => {
    setShowJoinModal(false);
    toast({
      title: "Cancelled",
      description: "You can join this event anytime by clicking the Join button.",
    });
  };

  const formatDate = (dateString: string, endDate?: string, eventType?: string) => {
    if (endDate && endDate !== dateString) {
      // Multi-day event: show date range
      return `${new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      })} - ${new Date(endDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })}`;
    } else {
      // Single-day event: show full date
      return new Date(dateString).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
  };

  const formatTime = (time?: string) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour24 = parseInt(hours);
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    const ampm = hour24 >= 12 ? 'PM' : 'AM';
    return `${hour12}:${minutes} ${ampm}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading event...</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <QrCode className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Event Not Found</h3>
          <p className="text-gray-600 mb-4">{error || 'The event you\'re looking for doesn\'t exist or has been removed.'}</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => navigate('/public-events')} variant="outline">
              Browse Events
            </Button>
            <Button onClick={() => navigate('/')}>
              Go Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <Card className="shadow-lg">
          <CardHeader className="text-center pb-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <QrCode className="w-8 h-8 text-blue-600" />
            </div>
            <CardTitle className="text-2xl text-gray-900 mb-2">{event.title}</CardTitle>
            <p className="text-gray-600">Event Code: <span className="font-mono font-semibold">{event.eventCode}</span></p>
          </CardHeader>

          <CardContent className="space-y-6">
            {event.description && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Description</h4>
                <p className="text-gray-600">{event.description}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-900">Date</p>
                  <p className="text-gray-600">{formatDate(event.date, event.endDate, event.eventType)}</p>
                </div>
              </div>

              {(event.startTime || event.endTime) && (
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900">Time</p>
                    <p className="text-gray-600">
                      {event.startTime && formatTime(event.startTime)}
                      {event.startTime && event.endTime && ' - '}
                      {event.endTime && formatTime(event.endTime)}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 md:col-span-2">
                <MapPin className="w-5 h-5 text-red-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-900">Location</p>
                  <p className="text-gray-600">{event.location?.address || 'Location TBA'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-purple-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-900">Organizer</p>
                  <p className="text-gray-600">{event.organizer?.name || 'Event Organizer'}</p>
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <div className="flex gap-3 justify-center">
                <Button onClick={() => navigate('/public-events')} variant="outline">
                  Browse More Events
                </Button>
                <Button 
                  onClick={handleJoinEvent}
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={event.status === 'completed'}
                >
                  <QrCode className="w-4 h-4 mr-2" />
                  {event.status === 'completed' ? 'Event Completed' : 'Join Event'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Join Confirmation Modal */}
        <Dialog open={showJoinModal} onOpenChange={setShowJoinModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-blue-600" />
                Join Event
              </DialogTitle>
              <DialogDescription>
                Do you want to join this event?
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                  {event?.title}
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Event Code: {event?.eventCode}
                </p>
                {event?.date && (
                  <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                    {formatDate(event.date, event.endDate, event.eventType)}
                    {event.startTime && ` at ${formatTime(event.startTime)}`}
                  </p>
                )}
              </div>

              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={cancelJoinEvent}
                  disabled={isJoining}
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmJoinEvent}
                  disabled={isJoining}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isJoining ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Joining...
                    </>
                  ) : (
                    <>
                      <QrCode className="w-4 h-4 mr-2" />
                      Yes, Join Event
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default JoinEvent;