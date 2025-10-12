import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  MapPin,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { useToast } from '@/hooks/use-toast';

interface LocationStatusDisplayProps {
  eventId: string;
}

// Live Countdown Timer Component that counts down from maxTimeOutside to zero
const LiveCountdownTimer: React.FC<{
  startTime: Date;
  baseSeconds: number;
  maxTimeSeconds: number;
}> = ({ startTime, baseSeconds, maxTimeSeconds }) => {
  const [remainingSeconds, setRemainingSeconds] = useState(maxTimeSeconds - baseSeconds);

  useEffect(() => {
    // Calculate initial remaining time
    const now = new Date();
    const elapsedSinceStart = Math.floor((now.getTime() - startTime.getTime()) / 1000);
    const totalElapsed = baseSeconds + elapsedSinceStart;
    const remaining = Math.max(0, maxTimeSeconds - totalElapsed);
    setRemainingSeconds(remaining);

    // Update every second (countdown)
    const interval = setInterval(() => {
      setRemainingSeconds(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, baseSeconds, maxTimeSeconds]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    // Format as HH:MM:SS or MM:SS
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    } else {
      return `${minutes}:${String(secs).padStart(2, '0')}`;
    }
  };

  return (
    <span className={`font-mono font-bold ${remainingSeconds <= 60 ? 'text-red-600' : remainingSeconds <= 180 ? 'text-orange-600' : ''}`}>
      {formatTime(remainingSeconds)}
    </span>
  );
};

const LocationStatusDisplay: React.FC<LocationStatusDisplayProps> = ({ eventId }) => {
  const { toast } = useToast();

  const {
    locationStatuses,
    summary,
    loading,
    error,
    refreshLocationData
  } = useLocationTracking(eventId);
  
  // Add error boundary for debugging
  if (!eventId) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-gray-500">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
            <p>Event ID is required for location tracking</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes === 0) {
      return `${remainingSeconds}s`;
    } else if (minutes < 60) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    }
  };

  const getStatusColor = (status: string): "default" | "destructive" | "secondary" | "outline" => {
    switch (status) {
      case 'inside': return 'default';
      case 'outside': return 'secondary';
      case 'warning': return 'destructive';
      case 'exceeded_limit': return 'destructive';
      case 'absent': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: string): React.ReactNode => {
    switch (status) {
      case 'inside': return <CheckCircle className="w-4 h-4" />;
      case 'outside': return <MapPin className="w-4 h-4" />;
      case 'warning': return <AlertTriangle className="w-4 h-4" />;
      case 'exceeded_limit': return <XCircle className="w-4 h-4" />;
      case 'absent': return <XCircle className="w-4 h-4" />;
      default: return <MapPin className="w-4 h-4" />;
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'inside': return 'Inside Premises';
      case 'outside': return 'Outside Premises';
      case 'warning': return 'Warning - Time Limit Approaching';
      case 'exceeded_limit': return 'Exceeded Time Limit';
      case 'absent': return 'Marked Absent';
      default: return 'Unknown Status';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <Clock className="w-8 h-8 animate-spin mx-auto mb-2" />
            <p className="text-gray-600">Loading location data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-500" />
            <p className="text-lg font-semibold text-red-600 mb-2">Location Tracking Error</p>
            <p className="text-sm text-gray-600 mb-4">{error}</p>
            <Button onClick={refreshLocationData} variant="outline" size="sm">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{summary.totalParticipants}</p>
                <p className="text-xs text-gray-600">Total Tracked</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{summary.insideGeofence}</p>
                <p className="text-xs text-gray-600">Inside Premises</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">{summary.outsideGeofence}</p>
                <p className="text-xs text-gray-600">Outside Premises</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{summary.absent || summary.exceededLimit || 0}</p>
                <p className="text-xs text-gray-600">Marked Absent</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Location Status List */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Participant Location Status
            </CardTitle>
            <Button onClick={refreshLocationData} variant="outline" size="sm">
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {locationStatuses.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <MapPin className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No participants are being tracked yet.</p>
                <p className="text-sm">Location tracking starts when participants check in.</p>
              </div>
            ) : (
              <Accordion type="multiple" className="space-y-4">
              {locationStatuses.map((status) => {
                // Debug: Check if timer should show
                const lastUpdate = new Date(status.lastLocationUpdate);
                const now = new Date();
                const minutesSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
                const isStale = minutesSinceUpdate > 3; // Changed from 5 to 3 minutes
                const isAbsent = status.status === 'absent';

                // Timer debug logging removed for production

                return (
                  <AccordionItem
                    key={status._id}
                    value={status._id}
                    className={`border rounded-lg ${
                      isAbsent ? 'opacity-50 bg-gray-100 dark:bg-gray-800' : ''
                    }`}
                  >
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      {/* Participant Info and Status */}
                      <div className="flex justify-between items-start w-full pr-4">
                        <div className="text-left">
                          <h3 className="font-semibold text-lg">{status.participant.name}</h3>
                          <p className="text-sm text-gray-600">{status.participant.email}</p>
                        </div>
                        <Badge variant={getStatusColor(status.status)} className="flex items-center gap-1">
                          {getStatusIcon(status.status)}
                          {getStatusText(status.status)}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 space-y-3">

                  {/* Location Details */}
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
                    <div>
                      <p className="font-medium text-gray-700">Current Location</p>
                      <p className="text-gray-600 font-mono text-xs">
                        {status.currentLocation?.latitude ?
                          `${status.currentLocation.latitude.toFixed(6)}, ${status.currentLocation.longitude.toFixed(6)}` :
                          'No location data'
                        }
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">Accuracy</p>
                      <p className="text-gray-600">
                        {status.currentLocation?.accuracy ? `${Math.round(status.currentLocation.accuracy)}m` : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">Distance from Center</p>
                      <p className="text-gray-600">{status.distanceFromCenter}m</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">Within Geofence</p>
                      <p className={`${
                        (() => {
                          const lastUpdate = new Date(status.lastLocationUpdate);
                          const now = new Date();
                          const minutesSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
                          return minutesSinceUpdate > 3 ? 'text-gray-400' : 'text-gray-600';
                        })()
                      }`}>
                        {status.isWithinGeofence ? 'Yes' : 'No'}
                        {(() => {
                          const lastUpdate = new Date(status.lastLocationUpdate);
                          const now = new Date();
                          const minutesSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
                          if (minutesSinceUpdate > 3) {
                            return <span className="text-yellow-600 ml-1">(stale)</span>;
                          }
                          return null;
                        })()}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">Time Remaining</p>
                      <p className="text-gray-600">
                        {(() => {
                          const lastUpdate = new Date(status.lastLocationUpdate);
                          const now = new Date();
                          const minutesSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
                          const isStale = minutesSinceUpdate > 3; // Changed from 5 to 3 minutes

                          // Don't show timer if marked absent
                          if (isAbsent) {
                            return <span className="text-gray-400">N/A (Absent)</span>;
                          }

                          // Get maxTimeOutside from event (with fallback to 15 minutes)
                          const maxTimeOutside = status.event?.maxTimeOutside || 15;
                          const maxTimeSeconds = maxTimeOutside * 60;
                          const remainingSeconds = Math.max(0, maxTimeSeconds - status.currentTimeOutside);

                          // Show live countdown timer if timer is active
                          if (status.outsideTimer.isActive) {
                            const timerStartTime = new Date(status.outsideTimer.startTime || status.lastLocationUpdate);

                            return (
                              <LiveCountdownTimer
                                startTime={timerStartTime}
                                baseSeconds={status.currentTimeOutside}
                                maxTimeSeconds={maxTimeSeconds}
                              />
                            );
                          }

                          // Otherwise show static remaining time
                          const minutes = Math.floor(remainingSeconds / 60);
                          const secs = remainingSeconds % 60;
                          return <span className="font-mono">{minutes}:{String(secs).padStart(2, '0')}</span>;
                        })()}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">Last Update</p>
                      <p className={`${
                        (() => {
                          const lastUpdate = new Date(status.lastLocationUpdate);
                          const now = new Date();
                          const minutesSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
                          if (minutesSinceUpdate > 10) return 'text-red-600 font-semibold';
                          if (minutesSinceUpdate > 3) return 'text-yellow-600 font-semibold'; // Changed from 5 to 3
                          return 'text-gray-600';
                        })()
                      }`}>
                        {new Date(status.lastLocationUpdate).toLocaleTimeString('en-US', { hour12: true })}
                      </p>
                    </div>
                  </div>

                  {/* Stale Data Warning removed - now shown in header bell icon */}

                  {/* Outside Premises Timer Display */}
                  {(() => {
                    const lastUpdate = new Date(status.lastLocationUpdate);
                    const now = new Date();
                    const minutesSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
                    const isStale = minutesSinceUpdate > 3;

                    // Don't show timer if marked absent
                    if (isAbsent) {
                      return null;
                    }

                    // Don't show outside timer if the timer reason is 'stale' - stale warning takes priority
                    if (status.outsideTimer?.reason === 'stale') {
                      return null;
                    }

                    // Only show timer if backend has activated it for 'outside' reason (not stale)
                    if (status.outsideTimer?.isActive && status.outsideTimer?.reason === 'outside') {
                      // Get maxTimeOutside from event (with fallback to 15 minutes)
                      const maxTimeOutside = status.event?.maxTimeOutside || 15;
                      const maxTimeSeconds = maxTimeOutside * 60;
                      const remainingSeconds = Math.max(0, maxTimeSeconds - status.currentTimeOutside);

                      return (
                        <div className="bg-orange-50 border-2 border-orange-400 rounded-lg p-4 shadow-sm">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="bg-orange-500 rounded-full p-1">
                              <Clock className="w-4 h-4 text-white" />
                            </div>
                            <span className="font-bold text-orange-800 text-lg">
                              📍 Outside Premises Timer
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-orange-700 mb-1">
                            <span className="font-medium">
                              Time Remaining:{' '}
                              {(() => {
                                // Show live countdown timer if timer is active
                                if (status.outsideTimer.isActive) {
                                  const timerStartTime = new Date(status.outsideTimer.startTime || status.lastLocationUpdate);

                                  return (
                                    <LiveCountdownTimer
                                      startTime={timerStartTime}
                                      baseSeconds={status.currentTimeOutside}
                                      maxTimeSeconds={maxTimeSeconds}
                                    />
                                  );
                                }

                                // Otherwise show static remaining time
                                const minutes = Math.floor(remainingSeconds / 60);
                                const secs = remainingSeconds % 60;
                                return <span className="font-mono font-bold">{minutes}:{String(secs).padStart(2, '0')}</span>;
                              })()}
                            </span>
                          </div>
                          {status.outsideTimer?.startTime && (
                            <p className="text-sm text-orange-600">
                              Started at: {new Date(status.outsideTimer.startTime).toLocaleTimeString('en-US', { hour12: true })}
                            </p>
                          )}
                          <p className="text-xs text-orange-700 mt-2 italic">
                            Participant is actively sending location but is outside the geofence boundary.
                          </p>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Alerts removed - now shown in header bell icon */}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
              </Accordion>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LocationStatusDisplay;