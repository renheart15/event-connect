import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Calendar, MapPin, Users, Clock, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { API_CONFIG } from '@/config';
import ParticipantReports from '@/components/ParticipantReports';

interface Event {
  _id: string;
  title: string;
  description?: string;
  date: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  location?: {
    address?: string;
  } | string;
  status: string;
}

const Reports = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        toast({
          title: "Authentication Required",
          description: "Please log in to view reports",
          variant: "destructive"
        });
        return;
      }

      const response = await fetch(`${API_CONFIG.API_BASE}/events`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        const eventList = data.data?.events || data.data || [];
        // Sort events by date (most recent first)
        const sortedEvents = eventList.sort((a: Event, b: Event) => {
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
        setEvents(sortedEvents);
      } else {
        throw new Error(data.message || 'Failed to fetch events');
      }
    } catch (error) {
      console.error('Error fetching events:', error);
      toast({
        title: "Error",
        description: "Failed to load events. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewReport = (event: Event) => {
    setSelectedEvent(event);
    setReportOpen(true);
  };

  const handleCloseReport = () => {
    setReportOpen(false);
    setSelectedEvent(null);
  };

  const formatEventDate = (event: Event) => {
    if (!event?.date) return 'Date not specified';

    try {
      const startDate = new Date(event.date);
      if (isNaN(startDate.getTime())) return 'Invalid Date';

      if (event.endDate && event.endDate !== event.date) {
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

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'active':
      case 'ongoing':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'upcoming':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'completed':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-gray-600 dark:text-gray-400">Loading events...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <FileText className="w-6 h-6" />
                Event Reports
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">View and export participant attendance reports</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle>All Events</CardTitle>
            <CardDescription>
              Select an event to view its participant attendance report
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {events.length > 0 ? (
              <div className="text-xs">
                <Table>
                  <TableHeader>
                    <TableRow className="text-[10px]">
                      <TableHead className="py-2 h-8">Event Title</TableHead>
                      <TableHead className="py-2 h-8">Date</TableHead>
                      <TableHead className="py-2 h-8">Time</TableHead>
                      <TableHead className="py-2 h-8">Location</TableHead>
                      <TableHead className="py-2 h-8">Status</TableHead>
                      <TableHead className="py-2 h-8 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-[11px]">
                    {events.map((event) => (
                      <TableRow key={event._id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <TableCell className="py-1.5">
                          <p className="font-medium leading-tight">{event.title}</p>
                        </TableCell>
                        <TableCell className="py-1.5">
                          <div className="flex items-center gap-0.5">
                            <Calendar className="w-2.5 h-2.5 text-gray-500" />
                            {formatEventDate(event)}
                          </div>
                        </TableCell>
                        <TableCell className="py-1.5">
                          <div className="flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5 text-gray-500" />
                            {event.startTime ? (
                              <>
                                {formatTime(event.startTime)}
                                {event.endTime && event.endTime !== event.startTime && (
                                  <> - {formatTime(event.endTime)}</>
                                )}
                              </>
                            ) : (
                              'Not specified'
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-1.5">
                          <div className="flex items-center gap-0.5 max-w-xs">
                            <MapPin className="w-2.5 h-2.5 text-gray-500 flex-shrink-0" />
                            <span className="truncate" title={typeof event.location === 'object'
                              ? event.location?.address || 'Location TBD'
                              : event.location || 'Location TBD'}>
                              {typeof event.location === 'object'
                                ? event.location?.address || 'Location TBD'
                                : event.location || 'Location TBD'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Badge
                            variant={
                              event.status === 'active' || event.status === 'ongoing' ? 'default' :
                              event.status === 'upcoming' ? 'secondary' :
                              'outline'
                            }
                            className={`text-[10px] px-1.5 py-0 h-5 ${getStatusBadgeClass(event.status)}`}
                          >
                            {event.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-1.5 text-right">
                          <Button
                            onClick={() => handleViewReport(event)}
                            size="sm"
                            className="flex items-center gap-0.5 text-[10px] h-6 px-2"
                          >
                            <FileText className="w-2.5 h-2.5" />
                            View Report
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">No Events Found</p>
                <p className="text-sm">You don't have any events yet.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Participant Reports Modal */}
      {selectedEvent && (
        <ParticipantReports
          eventId={selectedEvent._id}
          eventTitle={selectedEvent.title}
          isOpen={reportOpen}
          onClose={handleCloseReport}
        />
      )}
    </div>
  );
};

export default Reports;
