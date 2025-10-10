import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  MapPin,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Bell,
  BellOff
} from 'lucide-react';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { useToast } from '@/hooks/use-toast';

interface LocationStatusDisplayProps {
  eventId: string;
}

// Live Timer Component that counts up in real-time
const LiveTimer: React.FC<{
  startTime: Date;
  isStale: boolean;
  baseSeconds: number;
}> = ({ startTime, isStale, baseSeconds }) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    // Update every second for live counting
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const elapsedSeconds = isStale
    ? baseSeconds + Math.floor((currentTime.getTime() - new Date().getTime()) / 1000)
    : Math.floor((currentTime.getTime() - startTime.getTime()) / 1000);

  const formatTime = (seconds: number): string => {
    const absSeconds = Math.abs(seconds);
    const hours = Math.floor(absSeconds / 3600);
    const minutes = Math.floor((absSeconds % 3600) / 60);
    const secs = absSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  return (
    <span className="font-mono">
      {formatTime(elapsedSeconds)}
    </span>
  );
};

const LocationStatusDisplay: React.FC<LocationStatusDisplayProps> = ({ eventId }) => {
  const { toast } = useToast();
  const [acknowledgingAlerts, setAcknowledgingAlerts] = useState<Set<string>>(new Set());
  
  const { 
    locationStatuses, 
    summary, 
    loading, 
    error, 
    refreshLocationData,
    acknowledgeAlert 
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
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: string): React.ReactNode => {
    switch (status) {
      case 'inside': return <CheckCircle className="w-4 h-4" />;
      case 'outside': return <MapPin className="w-4 h-4" />;
      case 'warning': return <AlertTriangle className="w-4 h-4" />;
      case 'exceeded_limit': return <XCircle className="w-4 h-4" />;
      default: return <MapPin className="w-4 h-4" />;
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'inside': return 'Inside Premises';
      case 'outside': return 'Outside Premises';
      case 'warning': return 'Warning - Time Limit Approaching';
      case 'exceeded_limit': return 'Exceeded Time Limit';
      default: return 'Unknown Status';
    }
  };

  const handleAcknowledgeAlert = async (statusId: string, alertId: string) => {
    const alertKey = `${statusId}-${alertId}`;
    
    if (acknowledgingAlerts.has(alertKey)) return;

    try {
      setAcknowledgingAlerts(prev => new Set(prev).add(alertKey));
      await acknowledgeAlert(statusId, alertId);
      
      toast({
        title: "Alert Acknowledged",
        description: "The alert has been marked as acknowledged.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to acknowledge alert. Please try again.",
        variant: "destructive",
      });
    } finally {
      setAcknowledgingAlerts(prev => {
        const newSet = new Set(prev);
        newSet.delete(alertKey);
        return newSet;
      });
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
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Location Tracking Error:</strong><br />
              {error}
              <br /><br />
              <Button onClick={refreshLocationData} variant="outline" size="sm" className="mt-2">
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
                <p className="text-2xl font-bold text-yellow-600">{summary.warningStatus}</p>
                <p className="text-xs text-gray-600">Warning Status</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{summary.exceededLimit}</p>
                <p className="text-xs text-gray-600">Exceeded Limit</p>
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
              locationStatuses.map((status) => (
                <div key={status._id} className="border rounded-lg p-4 space-y-3">
                  {/* Participant Info and Status */}
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-lg">{status.participant.name}</h3>
                      <p className="text-sm text-gray-600">{status.participant.email}</p>
                    </div>
                    <Badge variant={getStatusColor(status.status)} className="flex items-center gap-1">
                      {getStatusIcon(status.status)}
                      {getStatusText(status.status)}
                    </Badge>
                  </div>

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
                          return minutesSinceUpdate > 5 ? 'text-gray-400' : 'text-gray-600';
                        })()
                      }`}>
                        {status.isWithinGeofence ? 'Yes' : 'No'}
                        {(() => {
                          const lastUpdate = new Date(status.lastLocationUpdate);
                          const now = new Date();
                          const minutesSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
                          if (minutesSinceUpdate > 5) {
                            return <span className="text-yellow-600 ml-1">(stale)</span>;
                          }
                          return null;
                        })()}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">Time Outside</p>
                      <p className="text-gray-600">
                        {(() => {
                          const lastUpdate = new Date(status.lastLocationUpdate);
                          const now = new Date();
                          const minutesSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
                          const isStale = minutesSinceUpdate > 5;

                          // If stale and timer is active, show live counting timer
                          if (isStale && status.outsideTimer.isActive) {
                            return (
                              <>
                                <LiveTimer
                                  startTime={new Date(status.outsideTimer.startTime || status.lastLocationUpdate)}
                                  isStale={isStale}
                                  baseSeconds={status.currentTimeOutside}
                                />
                                <span className="text-orange-600 ml-1">(counting...)</span>
                              </>
                            );
                          }

                          // Otherwise show static time
                          return (
                            <>
                              {formatTime(status.currentTimeOutside)}
                              {status.outsideTimer.isActive && !isStale && (
                                <span className="text-orange-600 ml-1">(counting...)</span>
                              )}
                            </>
                          );
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
                          if (minutesSinceUpdate > 5) return 'text-yellow-600 font-semibold';
                          return 'text-gray-600';
                        })()
                      }`}>
                        {new Date(status.lastLocationUpdate).toLocaleTimeString('en-US', { hour12: true })}
                      </p>
                    </div>
                  </div>

                  {/* Stale Data Warning */}
                  {(() => {
                    const lastUpdate = new Date(status.lastLocationUpdate);
                    const now = new Date();
                    const minutesSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
                    if (minutesSinceUpdate > 5) {
                      return (
                        <Alert variant="destructive" className="mt-3">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            <strong>Location data is stale!</strong> Last update was {Math.round(minutesSinceUpdate)} minutes ago.
                            The participant's device may be offline, in power-saving mode, or the browser tab may be backgrounded.
                            Current location status may not be accurate.
                          </AlertDescription>
                        </Alert>
                      );
                    }
                    return null;
                  })()}

                  {/* Timer Display */}
                  {(status.outsideTimer?.isActive || status.currentTimeOutside > 0) && (
                    <div className="bg-orange-50 border border-orange-200 rounded p-3">
                      <div className="flex items-center gap-2 text-orange-700">
                        <Clock className="w-4 h-4" />
                        <span className="font-medium">
                          {status.outsideTimer?.isActive ? 'Timer Active' : 'Time Outside'}:{' '}
                          {(() => {
                            const lastUpdate = new Date(status.lastLocationUpdate);
                            const now = new Date();
                            const minutesSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
                            const isStale = minutesSinceUpdate > 5;

                            // If stale and timer active, show live timer
                            if (isStale && status.outsideTimer.isActive) {
                              return (
                                <LiveTimer
                                  startTime={new Date(status.outsideTimer.startTime || status.lastLocationUpdate)}
                                  isStale={isStale}
                                  baseSeconds={status.currentTimeOutside}
                                />
                              );
                            }

                            // Otherwise show static time
                            return formatTime(status.currentTimeOutside);
                          })()}
                        </span>
                      </div>
                      {status.outsideTimer?.startTime && (
                        <p className="text-sm text-orange-600 mt-1">
                          Started at: {new Date(status.outsideTimer.startTime).toLocaleTimeString('en-US', { hour12: true })}
                        </p>
                      )}
                      {!status.outsideTimer?.isActive && status.currentTimeOutside > 0 && (
                        <p className="text-sm text-orange-600 mt-1">
                          No recent location data - timer started from check-in
                        </p>
                      )}
                    </div>
                  )}

                  {/* Alerts */}
                  {status.alertsSent.length > 0 && (
                    <div className="space-y-2">
                      <p className="font-medium text-sm text-gray-700">Recent Alerts:</p>
                      {status.alertsSent
                        .filter(alert => !alert.acknowledged)
                        .slice(0, 3)
                        .map((alert) => {
                          const alertKey = `${status._id}-${alert._id}`;
                          const isAcknowledging = acknowledgingAlerts.has(alertKey);
                          
                          return (
                            <div key={alert._id} className="flex items-center justify-between bg-red-50 border border-red-200 rounded p-2">
                              <div className="flex items-center gap-2 text-red-700">
                                <Bell className="w-4 h-4" />
                                <span className="text-sm font-medium">
                                  {alert.type === 'warning' && 'Approaching Time Limit'}
                                  {alert.type === 'exceeded_limit' && 'Exceeded Time Limit'}
                                  {alert.type === 'returned' && 'Returned to Premises'}
                                </span>
                                <span className="text-xs text-red-500">
                                  {new Date(alert.timestamp).toLocaleTimeString('en-US', { hour12: true })}
                                </span>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAcknowledgeAlert(status._id, alert._id)}
                                disabled={isAcknowledging}
                                className="text-red-700 border-red-300 hover:bg-red-100"
                              >
                                <BellOff className="w-3 h-3 mr-1" />
                                {isAcknowledging ? 'Acknowledging...' : 'Acknowledge'}
                              </Button>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LocationStatusDisplay;