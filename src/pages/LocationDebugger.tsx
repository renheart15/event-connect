import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_CONFIG } from '@/config';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, RefreshCw, MapPin, Clock, AlertTriangle, CheckCircle } from 'lucide-react';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: string;
  ageSeconds: number;
}

interface ParticipantData {
  participantId: string;
  participantName: string;
  participantEmail: string;
  participantPhone: string;
  currentLocation: LocationData;
  distanceFromCenter: number;
  isWithinGeofence: boolean;
  geofenceRadius: number;
  status: 'inside' | 'outside' | 'warning' | 'exceeded_limit';
  isActive: boolean;
  outsideTimer: {
    isActive: boolean;
    currentTimeOutsideSeconds: number;
    currentTimeOutsideFormatted: string;
    timeRemainingSeconds: number;
    timeRemainingFormatted: string;
    percentTimeUsed: string;
    maxAllowedFormatted: string;
  };
  alerts: Array<{
    id: string;
    type: string;
    timestamp: string;
    acknowledged: boolean;
    ageSeconds: number;
  }>;
  hasActiveMonitoringTimer: boolean;
  lastUpdateAgeSeconds: number;
}

interface DebugResponse {
  success: boolean;
  timestamp: string;
  data: {
    event: {
      eventId: string;
      eventTitle: string;
      eventStatus: string;
      organizer: {
        id: string;
        name: string;
        email: string;
      };
      location: {
        coordinates: {
          longitude: number;
          latitude: number;
        };
      };
      geofenceRadius: number;
      maxTimeOutside: number;
      maxTimeOutsideFormatted: string;
    };
    summary: {
      totalParticipants: number;
      activeParticipants: number;
      inactiveParticipants: number;
      insideGeofence: number;
      outsideGeofence: number;
      statusBreakdown: {
        inside: number;
        outside: number;
        warning: number;
        exceeded_limit: number;
      };
      activeTimersCount: number;
      participantsWithAlerts: number;
      totalAlerts: number;
      unacknowledgedAlerts: number;
    };
    participants: ParticipantData[];
    serviceState: {
      activeEventsInMemory: string[];
      activeParticipantsByEvent: string[];
      totalActiveTimers: number;
      activeTimers: Array<{
        statusId: string;
        participantId: string;
        participantName: string;
      }>;
    };
  };
}

export default function LocationDebugger() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<DebugResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchDebugData = async () => {
    try {
      setError(null);
      const token = localStorage.getItem('token');

      const response = await axios.get(
        `${API_CONFIG.API_BASE}/location-tracking/debug/event/${eventId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setData(response.data);
    } catch (err: any) {
      console.error('Error fetching debug data:', err);
      setError(err.response?.data?.message || 'Failed to fetch debug data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDebugData();
  }, [eventId]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchDebugData, 10000); // Refresh every 10 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh, eventId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'inside':
        return 'bg-green-500';
      case 'outside':
        return 'bg-yellow-500';
      case 'warning':
        return 'bg-orange-500';
      case 'exceeded_limit':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'inside':
        return <CheckCircle className="w-4 h-4" />;
      case 'outside':
      case 'warning':
      case 'exceeded_limit':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p>Loading debug data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <Button onClick={() => navigate(-1)} variant="ghost" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-red-600">{error}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button onClick={() => navigate(-1)} variant="ghost">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Location Debugger</h1>
              <p className="text-sm text-gray-600">{data.data.event.eventTitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={fetchDebugData}
              variant="outline"
              size="sm"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button
              onClick={() => setAutoRefresh(!autoRefresh)}
              variant={autoRefresh ? 'default' : 'outline'}
              size="sm"
            >
              {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
            </Button>
          </div>
        </div>

        {/* Event Info */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Event Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <Badge className={data.data.event.eventStatus === 'active' ? 'bg-green-500' : 'bg-gray-500'}>
                  {data.data.event.eventStatus}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-600">Geofence Radius</p>
                <p className="font-semibold">{data.data.event.geofenceRadius}m</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Max Time Outside</p>
                <p className="font-semibold">{data.data.event.maxTimeOutsideFormatted}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Location</p>
                <p className="text-xs font-mono">
                  {data.data.event.location.coordinates.latitude.toFixed(6)},
                  {data.data.event.location.coordinates.longitude.toFixed(6)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold">{data.data.summary.totalParticipants}</p>
              <p className="text-sm text-gray-600">Total Participants</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold text-green-600">{data.data.summary.insideGeofence}</p>
              <p className="text-sm text-gray-600">Inside Geofence</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold text-yellow-600">{data.data.summary.outsideGeofence}</p>
              <p className="text-sm text-gray-600">Outside Geofence</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold text-red-600">{data.data.summary.statusBreakdown.exceeded_limit}</p>
              <p className="text-sm text-gray-600">Exceeded Limit</p>
            </CardContent>
          </Card>
        </div>

        {/* Participants List */}
        <Card>
          <CardHeader>
            <CardTitle>Participants ({data.data.participants.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {data.data.participants.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No participants checked in yet</p>
                <p className="text-sm">Participants will appear here once they check in and share their location</p>
              </div>
            ) : (
              <div className="space-y-4">
                {data.data.participants.map((participant) => (
                  <Card key={participant.participantId} className="border-2">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-lg">{participant.participantName}</h3>
                          <p className="text-sm text-gray-600">{participant.participantEmail}</p>
                        </div>
                        <Badge className={getStatusColor(participant.status)}>
                          <span className="flex items-center gap-1">
                            {getStatusIcon(participant.status)}
                            {participant.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-gray-600">Current Location</p>
                          <p className="text-xs font-mono">
                            {participant.currentLocation.latitude.toFixed(6)},
                            {participant.currentLocation.longitude.toFixed(6)}
                          </p>
                          <p className="text-xs text-gray-500">
                            Accuracy: ±{participant.currentLocation.accuracy}m
                          </p>
                        </div>

                        <div>
                          <p className="text-sm text-gray-600">Distance from Center</p>
                          <p className="font-semibold">{participant.distanceFromCenter}m</p>
                          <p className="text-xs text-gray-500">
                            {participant.isWithinGeofence ? 'Within' : 'Outside'} {participant.geofenceRadius}m radius
                          </p>
                        </div>

                        <div>
                          <p className="text-sm text-gray-600">Time Outside</p>
                          <p className="font-semibold">{participant.outsideTimer.currentTimeOutsideFormatted}</p>
                          <p className="text-xs text-gray-500">
                            {participant.outsideTimer.percentTimeUsed}% used
                          </p>
                        </div>

                        <div>
                          <p className="text-sm text-gray-600">Time Remaining</p>
                          <p className="font-semibold">{participant.outsideTimer.timeRemainingFormatted}</p>
                          <p className="text-xs text-gray-500">
                            Max: {participant.outsideTimer.maxAllowedFormatted}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-600">
                            Last update: {participant.lastUpdateAgeSeconds}s ago
                          </span>
                        </div>
                        {participant.alerts.length > 0 && (
                          <Badge variant="outline" className="border-orange-500 text-orange-600">
                            {participant.alerts.length} alert{participant.alerts.length !== 1 ? 's' : ''}
                          </Badge>
                        )}
                        {participant.hasActiveMonitoringTimer && (
                          <Badge variant="outline" className="border-blue-500 text-blue-600">
                            Monitoring Active
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Service State */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Service State</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600">Active Events in Memory</p>
                <p className="font-semibold">{data.data.serviceState.activeEventsInMemory.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Active Monitoring Timers</p>
                <p className="font-semibold">{data.data.serviceState.totalActiveTimers}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Last Updated</p>
                <p className="text-xs font-mono">{new Date(data.timestamp).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
