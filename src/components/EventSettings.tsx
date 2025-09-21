
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Settings, Save, Trash2, Calendar, MapPin, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { API_CONFIG } from '@/config';

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
  eventCode?: string;
  description?: string;
  maxTimeOutside?: number;
  startTime?: string; // <-- added
  endTime?: string;   // <-- added
  published?: boolean;
  geofence: {
    center: [number, number];
    radius: number;
  };
}

interface EventSettingsProps {
  event: Event;
  isOpen: boolean;
  onClose: () => void;
  onEventUpdate?: (eventId: string, updatedData: Partial<Event>) => void;
  onEventDelete?: (eventId: string) => void;
}

const EventSettings = ({ event, isOpen, onClose, onEventUpdate, onEventDelete }: EventSettingsProps) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    title: event.title,
    date: new Date(event.date).toISOString().split('T')[0],
    endDate: event.endDate ? new Date(event.endDate).toISOString().split('T')[0] : '',
    eventType: event.eventType || 'single-day',
    description: event.description || '',
    eventCode: event.eventCode,
    maxTimeOutside: event.maxTimeOutside?.toString() || '15',
    startTime: event.startTime || '',
    endTime: event.endTime || '',
  });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => {
      const newData = {
        ...prev,
        [field]: value
      };

      // Clear endDate when switching to single-day
      if (field === 'eventType' && value === 'single-day') {
        newData.endDate = '';
      }

      return newData;
    });
  };

  const handleSave = async () => {
    const today = new Date();
    const eventDate = new Date(`${formData.date}T00:00`);

    if (eventDate < new Date(today.toDateString())) {
      toast({
        title: 'Invalid Date',
        description: 'You cannot set an event date in the past.',
        variant: 'destructive',
      });
      return;
    }

    // Validate multi-day event dates
    if (formData.eventType === 'multi-day') {
      if (!formData.endDate) {
        toast({
          title: 'Invalid End Date',
          description: 'End date is required for multi-day events.',
          variant: 'destructive',
        });
        return;
      }

      const endDate = new Date(`${formData.endDate}T00:00`);
      if (endDate <= eventDate) {
        toast({
          title: 'Invalid Date Range',
          description: 'End date must be after start date.',
          variant: 'destructive',
        });
        return;
      }
    }

    if (formData.startTime && formData.endTime) {
      const start = new Date(`${formData.date}T${formData.startTime}`);
      const end = new Date(`${formData.date}T${formData.endTime}`);

      if (start >= end) {
        toast({
          title: 'Invalid Time',
          description: 'End time must be later than start time.',
          variant: 'destructive',
        });
        return;
      }
    }

    try {
      const res = await fetch(`${API_CONFIG.API_BASE}/events/${event.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          title: formData.title,
          date: formData.date,
          endDate: formData.eventType === 'multi-day' ? formData.endDate : undefined,
          eventType: formData.eventType,
          description: formData.description,
          eventCode: formData.eventCode,
          maxTimeOutside: formData.maxTimeOutside.trim() === '' ? 15 : parseInt(formData.maxTimeOutside),
          startTime: formData.startTime,
          endTime: formData.endTime,
        }),
      });

      const result = await res.json();

      if (!res.ok) throw new Error(result.message || 'Failed to update event');

      // 🔁 Optionally update backend status
      await fetch(`${API_CONFIG.API_BASE}/events/${event.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ status: 'active' }), // You can make this dynamic if needed
      });

      if (onEventUpdate) {
        onEventUpdate(event.id, result.data.event);
      }

      toast({
        title: 'Event Updated',
        description: 'Event settings have been saved successfully.',
      });

      setTimeout(() => {
        window.location.reload();
      }, 500);

      onClose();
    } catch (error: any) {
      toast({
        title: 'Update Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      const token = localStorage.getItem('token');
      
      const url = `${API_CONFIG.API_BASE}/events/${event.id}`;

      const res = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      let result;
      const responseText = await res.text();
      
      if (responseText) {
        result = JSON.parse(responseText);
      } else {
        result = { message: `Empty response with status ${res.status}` };
      }

      if (!res.ok) {
        throw new Error(result.message || `Failed to delete event: ${res.status}`);
      }


      if (onEventDelete) {
        onEventDelete(event.id);
      }

      toast({
        title: 'Event Deleted',
        description: 'The event has been permanently deleted.',
      });

      setShowDeleteConfirm(false);
      onClose();

      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (error: any) {
      console.error('🔥 Delete error:', error);
      toast({
        title: 'Deletion Failed',
        description: error.message || 'An error occurred while deleting the event.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Event Settings
          </DialogTitle>
          <DialogDescription>
            Manage the settings and configuration for "{event.title}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Event Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Event Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Current Status</p>
                  <Badge variant={event.status === 'active' ? 'default' : 'secondary'}>
                    {event.status}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="text-center">
                    <Users className="w-4 h-4 mx-auto mb-1 text-gray-500" />
                    <p className="font-medium">{event.totalParticipants}</p>
                    <p className="text-gray-500">Total</p>
                  </div>
                  <div className="text-center">
                    <Calendar className="w-4 h-4 mx-auto mb-1 text-green-500" />
                    <p className="font-medium text-green-600">{event.checkedIn}</p>
                    <p className="text-gray-500">Checked In</p>
                  </div>
                  <div className="text-center">
                    <MapPin className="w-4 h-4 mx-auto mb-1 text-blue-500" />
                    <p className="font-medium text-blue-600">{event.currentlyPresent}</p>
                    <p className="text-gray-500">Present</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Event Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eventCode">Event Code</Label>
                  <Input
                    id="eventCode"
                    value={formData.eventCode}
                    onChange={(e) => handleInputChange('eventCode', e.target.value)}
                  />
                </div>
              </div>

              {/* Event Type Selection */}
              <div className="space-y-2">
                <Label htmlFor="eventType">Event Type</Label>
                <Select value={formData.eventType} onValueChange={(value) => handleInputChange('eventType', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select event type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single-day">Single Day Event</SelectItem>
                    <SelectItem value="multi-day">Multi-Day Event</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date Fields */}
              {formData.eventType === 'multi-day' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Start Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => handleInputChange('date', e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">End Date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => handleInputChange('endDate', e.target.value)}
                      min={formData.date || new Date().toISOString().split('T')[0]}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleInputChange('date', e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="maxTimeOutside">Max Time Outside (minutes)</Label>
                <Input
                  id="maxTimeOutside"
                  type="number"
                  value={formData.maxTimeOutside}
                  onChange={(e) => handleInputChange('maxTimeOutside', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startTime">Start Time</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => handleInputChange('startTime', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime">End Time</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => handleInputChange('endTime', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Event description (optional)"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Geofence Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Geofence Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium text-gray-700">Center Coordinates</p>
                  <p className="text-gray-600">
                    {event.geofence.center[0].toFixed(6)}, {event.geofence.center[1].toFixed(6)}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-gray-700">Radius</p>
                  <p className="text-gray-600">{event.geofence.radius} meters</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Use the Geofence tab to modify these settings
              </p>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-between">
            <Button
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete Event
            </Button>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleSave} className="flex items-center gap-2">
                <Save className="w-4 h-4" />
                Save Changes
              </Button>
            </div>
          </div>
        </div>

      </DialogContent>
    </Dialog>

    {/* Delete Confirmation Dialog */}
    <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Event</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete "{event.title}"? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 justify-end mt-4">
          <Button
            variant="outline"
            onClick={() => {
              setShowDeleteConfirm(false);
            }}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              handleDelete();
            }}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default EventSettings;