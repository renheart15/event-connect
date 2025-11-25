import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { 
  AlertTriangle, 
  MapPin, 
  Bell, 
  Clock,
  Users,
  ExternalLink
} from 'lucide-react';
import { API_CONFIG } from '@/config';

interface LocationAlert {
  alertId: string;
  statusId: string;
  participantName: string;
  participantEmail: string;
  eventTitle: string;
  eventId: string;
  type: 'warning' | 'exceeded_limit' | 'returned' | 'left_geofence';
  timestamp: string;
  acknowledged: boolean;
  currentStatus: 'inside' | 'outside' | 'warning' | 'exceeded_limit';
  isWithinGeofence: boolean;
  currentTimeOutside: number;
}

interface LocationAlertsWidgetProps {
  className?: string;
}

const LocationAlertsWidget: React.FC<LocationAlertsWidgetProps> = ({ className }) => {
  const [alerts, setAlerts] = useState<LocationAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLocationAlerts = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Get all active events and their alerts
      const eventsResponse = await fetch(`${API_CONFIG.API_BASE}/events?status=active`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!eventsResponse.ok) return;

      const eventsData = await eventsResponse.json();
      const activeEvents = eventsData.data.events.filter((event: any) => 
        event.status === 'active' && event.locationTracking?.enabled
      );

      // Fetch alerts for active events
      const allAlerts: LocationAlert[] = [];
      
      for (const event of activeEvents) {
        try {
          const alertsResponse = await fetch(
            `${API_CONFIG.API_BASE}/location-tracking/event/${event._id}/alerts?acknowledged=false`,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            }
          );

          if (alertsResponse.ok) {
            const alertsData = await alertsResponse.json();
            const eventAlerts = alertsData.data.map((alert: any) => ({
              ...alert,
              eventId: event._id
            }));
            allAlerts.push(...eventAlerts);
          }
        } catch (err) {
          console.error(`Error fetching alerts for event ${event._id}:`, err);
        }
      }

      // Sort by timestamp (newest first) and take top 5
      allAlerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setAlerts(allAlerts.slice(0, 5));

    } catch (err) {
      console.error('Error fetching location alerts:', err);
      setError('Failed to load location alerts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocationAlerts();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchLocationAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case 'exceeded_limit':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'returned':
        return <MapPin className="w-4 h-4 text-green-600" />;
      case 'left_geofence':
        return <MapPin className="w-4 h-4 text-orange-600" />;
      default:
        return <Bell className="w-4 h-4" />;
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'exceeded_limit':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'returned':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'left_geofence':
        return 'bg-orange-50 border-orange-200 text-orange-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getAlertText = (type: string) => {
    switch (type) {
      case 'warning':
        return 'Approaching time limit';
      case 'exceeded_limit':
        return 'Exceeded time limit';
      case 'returned':
        return 'Returned to premises';
      case 'left_geofence':
        return 'Left event premises';
      default:
        return 'Unknown alert';
    }
  };

  const formatTime = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    return `${Math.floor(diffInHours / 24)}d ago`;
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Bell className="w-4 h-4" />
            Location Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <Clock className="w-6 h-6 animate-spin mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-gray-600">Loading alerts...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Bell className="w-4 h-4" />
            Location Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-red-500" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Bell className="w-4 h-4" />
            Location Alerts
            {alerts.length > 0 && (
              <Badge variant="destructive" className="text-xs">
                {alerts.length}
              </Badge>
            )}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchLocationAlerts}>
            <Clock className="w-3 h-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {alerts.length === 0 ? (
          <div className="text-center py-4">
            <Users className="w-8 h-8 mx-auto mb-2 text-green-500" />
            <p className="text-sm text-green-600 font-medium">All participants are within premises</p>
            <p className="text-xs text-gray-500 mt-1">No active location alerts</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div 
                key={`${alert.alertId}-${alert.timestamp}`}
                className={`border rounded-lg p-3 ${getAlertColor(alert.type)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2">
                    {getAlertIcon(alert.type)}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">
                        {alert.participantName}
                      </p>
                      <p className="text-xs opacity-80 truncate">
                        {alert.eventTitle}
                      </p>
                      <p className="text-xs opacity-70 mt-1">
                        {getAlertText(alert.type)} • {formatTime(alert.timestamp)}
                      </p>
                    </div>
                  </div>
                  <Link 
                    to={`/event/${alert.eventId}/monitor`}
                    className="p-1 hover:bg-black/10 rounded"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
            
            {alerts.length === 5 && (
              <div className="text-center pt-2">
                <p className="text-xs text-gray-500">
                  Showing latest 5 alerts • Check individual events for more
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LocationAlertsWidget;