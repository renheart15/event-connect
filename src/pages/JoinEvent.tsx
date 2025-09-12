import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QrCode, Calendar, MapPin, Users, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const JoinEvent = () => {
  const { eventCode } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          setEvent(result.data.event);
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

    // Redirect to participant dashboard with the event code
    navigate(`/participant-dashboard?eventCode=${eventCode}`);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
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
                  <p className="text-gray-600">{formatDate(event.date)}</p>
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
      </div>
    </div>
  );
};

export default JoinEvent;