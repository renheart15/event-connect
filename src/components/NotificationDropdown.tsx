import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Bell,
  AlertTriangle,
  MapPin,
  Clock,
  Users,
  ExternalLink,
  RefreshCw,
  Check
} from 'lucide-react';
import { API_CONFIG } from '@/config';

interface LocationAlert {
  alertId: string;
  statusId: string;
  participantName: string;
  participantEmail: string;
  eventTitle: string;
  eventId: string;
  type: 'warning' | 'exceeded_limit' | 'returned';
  timestamp: string;
  acknowledged: boolean;
  currentStatus: 'inside' | 'outside' | 'warning' | 'exceeded_limit';
  isWithinGeofence: boolean;
  currentTimeOutside: number;
}

const NotificationDropdown: React.FC = () => {
  const [alerts, setAlerts] = useState<LocationAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acknowledgingAlerts, setAcknowledgingAlerts] = useState<Set<string>>(new Set());

  const fetchLocationAlerts = async (showRefreshing = false) => {
    try {
      if (showRefreshing) setRefreshing(true);

      const token = localStorage.getItem('token');
      if (!token) {
        console.log('[NotificationDropdown] No auth token found');
        return;
      }

      // Get all active events and their alerts
      const eventsResponse = await fetch(`${API_CONFIG.API_BASE}/events?status=active`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!eventsResponse.ok) {
        console.log('[NotificationDropdown] Events fetch failed:', eventsResponse.status);
        return;
      }

      const eventsData = await eventsResponse.json();
      console.log('[NotificationDropdown] All active events:', eventsData.data?.events?.length);

      // Check ALL active events for alerts, not just those with locationTracking.enabled flag
      const activeEvents = eventsData.data.events.filter((event: any) => event.status === 'active');
      console.log('[NotificationDropdown] Active events to check:', activeEvents.length);

      // Fetch alerts for active events
      const allAlerts: LocationAlert[] = [];

      for (const event of activeEvents) {
        try {
          console.log(`[NotificationDropdown] Fetching alerts for event: ${event.title} (${event._id})`);

          const alertsResponse = await fetch(
            `${API_CONFIG.API_BASE}/location-tracking/event/${event._id}/alerts?acknowledged=false`,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            }
          );

          console.log(`[NotificationDropdown] Alerts response status for ${event.title}:`, alertsResponse.status);

          if (alertsResponse.ok) {
            const alertsData = await alertsResponse.json();
            console.log(`[NotificationDropdown] Alerts for ${event.title}:`, alertsData.data?.length || 0);

            const eventAlerts = alertsData.data.map((alert: any) => ({
              ...alert,
              eventId: event._id
            }));
            allAlerts.push(...eventAlerts);
          }
        } catch (err) {
          console.error(`[NotificationDropdown] Error fetching alerts for event ${event._id}:`, err);
        }
      }

      // Sort by timestamp (newest first)
      allAlerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      console.log('[NotificationDropdown] Total alerts found:', allAlerts.length);
      setAlerts(allAlerts);

    } catch (err) {
      console.error('[NotificationDropdown] Error fetching location alerts:', err);
    } finally {
      setLoading(false);
      if (showRefreshing) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLocationAlerts();
    
    // Refresh every 30 seconds
    const interval = setInterval(() => fetchLocationAlerts(), 30000);
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
      default:
        return <Bell className="w-4 h-4" />;
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

  const acknowledgeAlert = async (statusId: string, alertId: string, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const alertKey = `${statusId}-${alertId}`;
    if (acknowledgingAlerts.has(alertKey)) return;

    try {
      setAcknowledgingAlerts(prev => new Set(prev).add(alertKey));

      const token = localStorage.getItem('token');
      const response = await fetch(`${API_CONFIG.API_BASE}/location-tracking/acknowledge-alert`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ statusId, alertId })
      });

      if (response.ok) {
        // Remove the acknowledged alert from the list
        setAlerts(prev => prev.filter(a => a.alertId !== alertId));
      }
    } catch (error) {
      console.error('Error acknowledging alert:', error);
    } finally {
      setAcknowledgingAlerts(prev => {
        const newSet = new Set(prev);
        newSet.delete(alertKey);
        return newSet;
      });
    }
  };

  const hasUnreadAlerts = alerts.length > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative p-2" title="Notifications">
          <Bell className="h-5 w-5" />
          {hasUnreadAlerts && (
            <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full flex items-center justify-center">
              <span className="text-[8px] text-white font-bold">
                {alerts.length > 9 ? '9+' : alerts.length}
              </span>
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
        <div className="px-3 py-2 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              <span className="font-semibold text-sm">Location Alerts</span>
              {alerts.length > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {alerts.length}
                </Badge>
              )}
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => fetchLocationAlerts(true)}
              disabled={refreshing}
              className="h-6 w-6 p-0"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        <div className="max-h-64 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Clock className="w-4 h-4 animate-spin mr-2" />
              <span className="text-sm text-gray-600">Loading alerts...</span>
            </div>
          ) : alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <Users className="w-8 h-8 mb-2 text-green-500" />
              <p className="text-sm text-green-600 font-medium">All participants are within premises</p>
              <p className="text-xs text-gray-500 mt-1">No active location alerts</p>
            </div>
          ) : (
            <div className="py-1">
              {alerts.slice(0, 10).map((alert) => {
                const alertKey = `${alert.statusId}-${alert.alertId}`;
                const isAcknowledging = acknowledgingAlerts.has(alertKey);

                return (
                  <div key={`${alert.alertId}-${alert.timestamp}`} className="border-b last:border-0">
                    <div className="flex items-start gap-2 p-3 hover:bg-gray-50">
                      {getAlertIcon(alert.type)}
                      <div className="min-w-0 flex-1">
                        <Link
                          to={`/event/${alert.eventId}/monitor`}
                          className="block"
                        >
                          <p className="font-medium text-sm truncate hover:underline">
                            {alert.participantName}
                          </p>
                          <p className="text-xs text-gray-600 truncate">
                            {alert.eventTitle}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {getAlertText(alert.type)} • {formatTime(alert.timestamp)}
                          </p>
                        </Link>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => acknowledgeAlert(alert.statusId, alert.alertId, e)}
                          disabled={isAcknowledging}
                          className="h-7 w-7 p-0"
                          title="Acknowledge alert"
                        >
                          <Check className="w-3 h-3" />
                        </Button>
                        <Link to={`/event/${alert.eventId}/monitor`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            title="View location tracking"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {alerts.length > 10 && (
                <div className="px-3 py-2 text-center border-t">
                  <p className="text-xs text-gray-500">
                    Showing latest 10 of {alerts.length} alerts
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationDropdown;