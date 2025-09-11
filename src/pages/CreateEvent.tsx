import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import GeofenceMap from '@/components/GeofenceMap';
import ProfileDropdown from '@/components/ProfileDropdown';

const CreateEvent = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    startTime: '',
    endTime: '',
    location: '',
    maxTimeOutside: '15',
    geofenceRadius: '100',
    eventCode: ''
  });

  const [tempCenter, setTempCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [geofenceRadius, setGeofenceRadius] = useState(100);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const generateEventCode = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setFormData(prev => ({ ...prev, eventCode: code }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLoadingLocation) {
      toast({
        title: "Please wait",
        description: "Still fetching location details...",
        variant: "default",
      });
      return;
    }

    if (!formData.title || !formData.date || !formData.startTime || !tempCenter || !formData.location) {
      toast({
        title: "Missing required fields",
        description: "Please fill in all required fields including geofence",
        variant: "destructive",
      });
      return;
    }

    const selectedDate = new Date(`${formData.date}T${formData.startTime}`);
    const now = new Date();

    if (selectedDate < now) {
      toast({
        title: "Invalid Date",
        description: "You cannot create an event in the past.",
        variant: "destructive",
      });
      return;
    }

    const start = new Date(`${formData.date}T${formData.startTime}`);
    const end = new Date(`${formData.date}T${formData.endTime}`);

    if (formData.endTime && start >= end) {
      toast({
        title: "Invalid Time",
        description: "End time must be later than start time.",
        variant: "destructive",
      });
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast({
          title: "Unauthorized",
          description: "Please login again.",
          variant: "destructive",
        });
        return;
      }

      const payload = {
        title: formData.title,
        description: formData.description,
        date: formData.date,
        startTime: formData.startTime,
        endTime: formData.endTime,
        location: {
          address: formData.location || "Unknown",
          coordinates: {
            type: "Point",
            coordinates: [tempCenter.lng, tempCenter.lat]
          }
        },
        geofenceRadius: parseInt(formData.geofenceRadius),
        maxTimeOutside: parseInt(formData.maxTimeOutside),
        eventCode: formData.eventCode,
        maxParticipants: 100
      };

      const res = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const result = await res.json();

      if (res.ok && result.success) {
        toast({
          title: "Event created",
          description: `${result.data.event.title} has been saved.`,
        });
        
        // FIX: Use the correct route path that matches App.tsx
        navigate(`/events/${result.data.event._id || result.data.event.id}/registration/create`, { 
          state: { 
            eventId: result.data.event._id || result.data.event.id, 
            eventTitle: formData.title 
          } 
        });
      } else {
        console.error('Validation failed:', result.errors || result.message);
        toast({
          title: "Creation failed",
          description: result.message || "Please check your inputs",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      console.error("Error creating event:", err);
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-full bg-gray-50 relative">
      <ProfileDropdown />
      <div className="bg-white border-b px-6 py-4 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create New Event</h1>
            <p className="text-gray-600 mt-1">Set up your event with location-based attendance tracking</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/organizer-dashboard')}>
            Back to Dashboard
          </Button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Event Details</CardTitle>
            <CardDescription>
              Set up your event with attendance tracking and GPS verification
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Event Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="e.g., Annual Tech Conference 2024"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Describe your event..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleInputChange('date', e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startTime">Start Time *</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => handleInputChange('startTime', e.target.value)}
                    required
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
                <Label>Event Location & Geofence *</Label>
                <GeofenceMap
                  eventId="new-event"
                  initialCenter={tempCenter ? [tempCenter.lat, tempCenter.lng] : undefined}
                  initialRadius={geofenceRadius}
                  showSaveButton={false}
                  onGeofenceUpdate={(center, radius) => {
                    setTempCenter({ lat: center[0], lng: center[1] });
                    setGeofenceRadius(radius);
                    setIsLoadingLocation(true);

                    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${center[0]}&lon=${center[1]}&format=json`)
                      .then(res => res.json())
                      .then(data => {
                        const displayName = data.display_name || `${center[0].toFixed(6)}, ${center[1].toFixed(6)}`;
                        setFormData(prev => ({
                          ...prev,
                          location: displayName,
                          geofenceRadius: radius.toString()
                        }));
                      })
                      .catch(() => {
                        setFormData(prev => ({
                          ...prev,
                          location: `${center[0].toFixed(6)}, ${center[1].toFixed(6)}`,
                          geofenceRadius: radius.toString()
                        }));
                      })
                      .finally(() => setIsLoadingLocation(false));
                  }}
                />

              </div>

              <div className="space-y-2">
                <Label htmlFor="maxTimeOutside">Max Time Outside (minutes)</Label>
                <Input
                  id="maxTimeOutside"
                  type="number"
                  value={formData.maxTimeOutside}
                  onChange={(e) => handleInputChange('maxTimeOutside', e.target.value)}
                  placeholder="15"
                />
                <p className="text-xs text-gray-500">
                  Maximum time participants can be outside the geofence
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="eventCode">Event Code</Label>
                <div className="flex gap-2">
                  <Input
                    id="eventCode"
                    value={formData.eventCode}
                    onChange={(e) => handleInputChange('eventCode', e.target.value)}
                    placeholder="AUTO-GENERATED"
                    readOnly
                  />
                  <Button type="button" variant="outline" onClick={generateEventCode}>
                    Generate
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  Participants will use this code to join the event
                </p>
              </div>

              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
                {isLoadingLocation ? "Please wait..." : "Create Event"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CreateEvent;