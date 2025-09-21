import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, Users, Clock, QrCode, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link, useNavigate } from 'react-router-dom';
import { API_CONFIG } from '@/config';

interface PublicEvent {
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
  eventCode: string;
  organizer: {
    name: string;
    email: string;
  };
  published: boolean;
}

const PublicEvents = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPublicEvents = async () => {
      try {
        const response = await fetch(`${API_CONFIG.API_BASE}/events/public`);
        const result = await response.json();

        if (result.success) {
          const processed = result.data.events.map((e: any) => ({
            ...e,
            id: e._id,
            location: e.location || {
              address: 'Location TBA',
              coordinates: {
                type: 'Point',
                coordinates: [0, 0]
              }
            },
            totalParticipants: e.totalParticipants || 0,
          }));

          setEvents(processed);
        } else {
          throw new Error(result.message || 'Failed to fetch public events');
        }
      } catch (error: any) {
        console.error('Error fetching public events:', error);
        setError('Failed to load public events. Please try again later.');
        toast({
          title: "Error",
          description: "Failed to load public events. Please try again later.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchPublicEvents();
  }, [toast]);

  const handleJoinEvent = (eventCode: string) => {
    navigate(`/join/${eventCode}`);
  };

  const formatTime = (time?: string) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour24 = parseInt(hours);
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    const ampm = hour24 >= 12 ? 'PM' : 'AM';
    return `${hour12}:${minutes} ${ampm}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700 hover:bg-green-100';
      case 'upcoming':
        return 'bg-blue-100 text-blue-700 hover:bg-blue-100';
      case 'completed':
        return 'bg-gray-100 text-gray-700 hover:bg-gray-100';
      default:
        return 'bg-gray-100 text-gray-700 hover:bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading public events...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
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
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Public Events</h1>
            <p className="text-lg text-gray-600">Discover and join exciting events in your area</p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {events.length === 0 ? (
          <Card className="border-dashed border-2 border-gray-300">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Calendar className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No public events available</h3>
              <p className="text-gray-600 text-center mb-6">
                There are currently no published events available to join.
              </p>
              <Link to="/participant">
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Eye className="w-4 h-4 mr-2" />
                  Go to Dashboard
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <Card key={event.id} className="group hover:shadow-lg transition-all duration-300 border-0 bg-white">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors mb-2">
                        {event.title}
                      </h3>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(event.status)}>
                          {event.status}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {event.eventCode}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 flex-shrink-0" />
                      <span>
                        {event.endDate && event.endDate !== event.date ? (
                          // Multi-day event: show date range
                          `${new Date(event.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric'
                          })} - ${new Date(event.endDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}`
                        ) : (
                          // Single-day event: show full date
                          formatDate(event.date)
                        )}
                      </span>
                    </div>
                    {(event.startTime || event.endTime) && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 flex-shrink-0" />
                        <span>
                          {event.startTime && formatTime(event.startTime)}
                          {event.startTime && event.endTime && ' - '}
                          {event.endTime && formatTime(event.endTime)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{event.location.address}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 flex-shrink-0" />
                      <span>{event.totalParticipants} participants</span>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  {event.description && (
                    <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                      {event.description}
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-500">
                      by {event.organizer.name}
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => handleJoinEvent(event.eventCode)}
                      className="bg-blue-600 hover:bg-blue-700"
                      disabled={event.status === 'completed'}
                    >
                      <QrCode className="w-4 h-4 mr-2" />
                      {event.status === 'completed' ? 'Completed' : 'Join Event'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicEvents;