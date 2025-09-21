
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download } from 'lucide-react';
import { EventReportData, exportEventSummary } from '@/utils/reportUtils';
import { useToast } from '@/hooks/use-toast';

interface Event {
  id: string;
  title: string;
  date: string;
  endDate?: string;
  eventType?: 'single-day' | 'multi-day';
  status: string;
  totalParticipants: number;
  checkedIn: number;
  currentlyPresent: number;
  location: string | {
    address?: string;
    coordinates?: {
      type: 'Point';
      coordinates: [number, number];
    };
  };
}

interface EventExportDialogProps {
  events: Event[];
  isOpen: boolean;
  onClose: () => void;
}

const EventExportDialog = ({ events, isOpen, onClose }: EventExportDialogProps) => {
  // Helper function to format event date for multi-day events
  const formatEventDate = (event: Event) => {
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
      return event.date;
    }
  };
  const { toast } = useToast();
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  const handleEventToggle = (eventId: string, checked: boolean) => {
    if (checked) {
      setSelectedEvents(prev => [...prev, eventId]);
    } else {
      setSelectedEvents(prev => prev.filter(id => id !== eventId));
    }
  };

  const handleSelectAll = () => {
    if (selectedEvents.length === events.length) {
      setSelectedEvents([]);
    } else {
      setSelectedEvents(events.map(event => event.id));
    }
  };

  const handleExport = () => {
    if (selectedEvents.length === 0) {
      toast({
        title: "No Events Selected",
        description: "Please select at least one event to export.",
        variant: "destructive",
      });
      return;
    }

    const selectedEventData = events
      .filter(event => selectedEvents.includes(event.id))
      .map(event => ({
        eventTitle: event.title,
        eventDate: formatEventDate(event),
        totalParticipants: event.totalParticipants,
        checkedIn: event.checkedIn,
        currentlyPresent: event.currentlyPresent,
        location: typeof event.location === 'string' ? event.location : event.location?.address || 'Location not specified',
        status: event.status
      }));

    const success = exportEventSummary(selectedEventData);
    if (success) {
      toast({
        title: "Reports Exported",
        description: `${selectedEvents.length} event(s) summary has been downloaded as CSV file.`,
      });
      onClose();
      setSelectedEvents([]);
    }
  };

  const handleClose = () => {
    onClose();
    setSelectedEvents([]);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export Event Reports</DialogTitle>
          <DialogDescription>
            Select the events you want to include in the export
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
            >
              {selectedEvents.length === events.length ? 'Deselect All' : 'Select All'}
            </Button>
            <span className="text-sm text-gray-600">
              {selectedEvents.length} of {events.length} events selected
            </span>
          </div>

          <div className="space-y-3 max-h-64 overflow-y-auto">
            {events.map((event) => (
              <Card key={event.id} className="p-0">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id={event.id}
                      checked={selectedEvents.includes(event.id)}
                      onCheckedChange={(checked) => handleEventToggle(event.id, checked as boolean)}
                    />
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-2">
                        <label htmlFor={event.id} className="font-medium cursor-pointer">
                          {event.title}
                        </label>
                        <Badge variant={event.status === 'active' ? 'default' : 'secondary'}>
                          {event.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                        <div>Date: {formatEventDate(event)}</div>
                        <div>Location: {typeof event.location === 'string' ? event.location : event.location?.address || 'Location not specified'}</div>
                        <div>Participants: {event.totalParticipants}</div>
                        <div>Checked In: {event.checkedIn}</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleExport} className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export Selected ({selectedEvents.length})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EventExportDialog;
