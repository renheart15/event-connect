import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  AlertTriangle, 
  MapPin, 
  Battery, 
  BatteryLow,
  Wifi,
  WifiOff,
  Clock,
  X,
  Bell,
  CheckCircle
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { notificationService } from '@/services/notificationService';

interface NotificationData {
  id: string;
  type: 'location' | 'battery' | 'network';
  severity: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  persistent: boolean;
  actionRequired: boolean;
}

interface ParticipantNotificationsProps {
  currentLocationStatus?: any;
  isTracking: boolean;
  className?: string;
}

const ParticipantNotifications: React.FC<ParticipantNotificationsProps> = ({ 
  currentLocationStatus, 
  isTracking,
  className 
}) => {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [isCharging, setIsCharging] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(
    // Uncomment the next line and comment the line after to simulate offline mode
    // false
    navigator.onLine
  );
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [timeOutsideSeconds, setTimeOutsideSeconds] = useState<number>(0);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [lastCriticalNotifications, setLastCriticalNotifications] = useState<string[]>([]);
  const [nativeNotificationsInitialized, setNativeNotificationsInitialized] = useState(false);
  const [lastLocationStatus, setLastLocationStatus] = useState<string | null>(null);
  const [sentNativeNotifications, setSentNativeNotifications] = useState<Set<string>>(new Set());

  // Testing mode - uncomment to simulate different scenarios
  // const SIMULATE_LOW_BATTERY = true;
  // const SIMULATE_OFFLINE = true;

  // Initialize native notifications on mount
  useEffect(() => {
    const initNotifications = async () => {
      if (Capacitor.isNativePlatform()) {
        const initialized = await notificationService.initialize();
        setNativeNotificationsInitialized(initialized);
        if (initialized) {
          console.log('✅ Native notifications initialized successfully');
        }
      }
    };

    initNotifications();
  }, []);

  // Send native notifications when location status changes
  useEffect(() => {
    if (!nativeNotificationsInitialized || !isTracking || !currentLocationStatus) {
      return;
    }

    const currentStatus = currentLocationStatus.status;
    const isWithinGeofence = currentLocationStatus.isWithinGeofence;
    const eventName = 'Event'; // We can get the actual event name if passed as prop

    // Format time remaining
    const timeOutside = Math.floor(timeOutsideSeconds);
    const minutes = Math.floor(timeOutside / 60);
    const seconds = timeOutside % 60;
    const timeRemainingStr = `${minutes}m ${seconds}s`;

    // Track status changes to avoid duplicate notifications
    const statusKey = `${currentStatus}-${isWithinGeofence}`;

    if (statusKey !== lastLocationStatus) {
      // Status has changed
      setLastLocationStatus(statusKey);

      if (!isWithinGeofence && !sentNativeNotifications.has('outside')) {
        // Just left geofence
        notificationService.sendOutsideGeofenceNotification(eventName, timeRemainingStr);
        setSentNativeNotifications(prev => new Set(prev).add('outside'));
      } else if (isWithinGeofence && sentNativeNotifications.has('outside')) {
        // Returned to geofence
        notificationService.sendReturnedToGeofenceNotification(eventName);
        setSentNativeNotifications(new Set()); // Reset notification tracking
      }

      if (currentStatus === 'warning' && !sentNativeNotifications.has('warning')) {
        notificationService.sendWarningNotification(eventName, timeRemainingStr);
        setSentNativeNotifications(prev => new Set(prev).add('warning'));
      }

      if (currentStatus === 'exceeded_limit' && !sentNativeNotifications.has('exceeded')) {
        notificationService.sendExceededLimitNotification(eventName);
        setSentNativeNotifications(prev => new Set(prev).add('exceeded'));
      }
    }
  }, [nativeNotificationsInitialized, isTracking, currentLocationStatus, timeOutsideSeconds, lastLocationStatus, sentNativeNotifications]);

  // Monitor battery status
  useEffect(() => {
    const updateBatteryInfo = async () => {
      try {
        // Try web Battery API first (works on both web and some mobile browsers)
        if ('getBattery' in navigator) {
          try {
            const battery = await (navigator as any).getBattery();
            setBatteryLevel(Math.round(battery.level * 100));
            setIsCharging(battery.charging);

            // Listen for battery changes
            battery.addEventListener('levelchange', () => {
              setBatteryLevel(Math.round(battery.level * 100));
            });
            battery.addEventListener('chargingchange', () => {
              setIsCharging(battery.charging);
            });
          } catch (error) {
            console.log('Web Battery API failed');
          }
        } else if (Capacitor.isNativePlatform()) {
          // For native platforms, we could implement battery monitoring via custom plugins
          // For now, we'll simulate battery levels for testing
          console.log('Native platform detected, but Device plugin not available');
          // You can enable simulation for testing by uncommenting SIMULATE_LOW_BATTERY above
          // if (SIMULATE_LOW_BATTERY) {
          //   setBatteryLevel(20); // Simulate 20% battery
          //   setIsCharging(false);
          // }
        }
        
        // Uncomment the following lines to test battery notifications
        // setBatteryLevel(20); // This will trigger low battery notification
        // setIsCharging(false);
      } catch (error) {
        console.log('Battery API not supported');
      }
    };

    updateBatteryInfo();

    // Request notification permission
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          setNotificationPermission(permission);
        });
      }
    }
  }, []);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast({
        title: "Connection Restored",
        description: "Internet connection has been restored.",
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: "Connection Lost", 
        description: "Internet connection lost. Some features may not work.",
        variant: "destructive",
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Monitor time outside premises
  useEffect(() => {
    if (currentLocationStatus?.outsideTimer?.isActive) {
      const interval = setInterval(() => {
        const currentTime = currentLocationStatus.currentTimeOutside || 0;
        setTimeOutsideSeconds(currentTime);
      }, 1000);

      return () => clearInterval(interval);
    } else {
      setTimeOutsideSeconds(0);
    }
  }, [currentLocationStatus?.outsideTimer?.isActive, currentLocationStatus?.currentTimeOutside]);

  // Memoize notifications to prevent unnecessary recalculations
  const currentNotifications = useMemo(() => {
    const newNotifications: NotificationData[] = [];

    // Location notifications
    if (isTracking && currentLocationStatus) {
      if (!currentLocationStatus.isWithinGeofence) {
        const timeOutside = Math.floor(timeOutsideSeconds);
        const minutes = Math.floor(timeOutside / 60);
        const seconds = timeOutside % 60;
        
        if (currentLocationStatus.status === 'exceeded_limit') {
          newNotifications.push({
            id: 'location-exceeded',
            type: 'location',
            severity: 'error',
            title: 'Time Limit Exceeded!',
            message: `You have been outside the event premises for ${minutes}m ${seconds}s. Please return immediately.`,
            timestamp: new Date(),
            persistent: true,
            actionRequired: true
          });
        } else if (currentLocationStatus.status === 'warning') {
          newNotifications.push({
            id: 'location-warning',
            type: 'location',
            severity: 'warning',
            title: 'Please Return to Premises',
            message: `You are outside the event area. Time outside: ${minutes}m ${seconds}s. Please return soon.`,
            timestamp: new Date(),
            persistent: true,
            actionRequired: true
          });
        } else {
          newNotifications.push({
            id: 'location-outside',
            type: 'location',
            severity: 'info',
            title: 'You are outside the event premises',
            message: `Time outside: ${minutes}m ${seconds}s. Please return when ready.`,
            timestamp: new Date(),
            persistent: true,
            actionRequired: false
          });
        }
      }
    }

    // Battery notifications
    if (batteryLevel !== null) {
      if (batteryLevel <= 10 && !isCharging) {
        newNotifications.push({
          id: 'battery-critical',
          type: 'battery',
          severity: 'error',
          title: 'Critical Battery Level!',
          message: `Battery: ${batteryLevel}%. Your device needs immediate charging to continue event tracking.`,
          timestamp: new Date(),
          persistent: true,
          actionRequired: true
        });
      } else if (batteryLevel <= 25 && !isCharging) {
        newNotifications.push({
          id: 'battery-low',
          type: 'battery',
          severity: 'warning',
          title: 'Low Battery',
          message: `Battery: ${batteryLevel}%. Please charge your device soon to ensure continuous tracking.`,
          timestamp: new Date(),
          persistent: false,
          actionRequired: true
        });
      }
    }

    // Network notifications
    if (!isOnline) {
      newNotifications.push({
        id: 'network-offline',
        type: 'network',
        severity: 'error',
        title: 'No Internet Connection',
        message: 'Your device is offline. Location tracking and check-in features are disabled.',
        timestamp: new Date(),
        persistent: true,
        actionRequired: true
      });
    }

    // Filter out dismissed notifications
    return newNotifications.filter(n => 
      !dismissedIds.has(n.id) || n.persistent
    );
  }, [isTracking, currentLocationStatus, batteryLevel, isCharging, isOnline, timeOutsideSeconds, dismissedIds]);

  // Update notifications and handle feedback separately
  useEffect(() => {
    setNotifications(currentNotifications);
  }, [currentNotifications]);

  // Handle haptic feedback and browser notifications for new critical alerts
  useEffect(() => {
    const criticalNotifications = currentNotifications.filter(n => n.severity === 'error');
    const newCriticalIds = criticalNotifications.map(n => n.id);
    
    // Check if there are new critical notifications
    const hasNewCritical = newCriticalIds.some(id => 
      !lastCriticalNotifications.includes(id)
    );

    if (hasNewCritical && criticalNotifications.length > 0) {
      triggerHapticFeedback('heavy');
      
      // Send browser notifications for new critical alerts only
      criticalNotifications.forEach(notification => {
        if (!lastCriticalNotifications.includes(notification.id)) {
          sendBrowserNotification(notification.title, notification.message, notification.type);
        }
      });
    }
    
    // Update tracked critical notifications
    if (JSON.stringify(newCriticalIds) !== JSON.stringify(lastCriticalNotifications)) {
      setLastCriticalNotifications(newCriticalIds);
    }
  }, [currentNotifications, lastCriticalNotifications]);

  // Memoized haptic feedback function
  const triggerHapticFeedback = useCallback(async (type: 'light' | 'medium' | 'heavy' = 'medium') => {
    try {
      if (Capacitor.isNativePlatform()) {
        let impactStyle: ImpactStyle;
        switch (type) {
          case 'light':
            impactStyle = ImpactStyle.Light;
            break;
          case 'heavy':
            impactStyle = ImpactStyle.Heavy;
            break;
          default:
            impactStyle = ImpactStyle.Medium;
        }
        await Haptics.impact({ style: impactStyle });
      } else {
        // Web vibration API fallback
        if (navigator.vibrate) {
          const duration = type === 'heavy' ? 200 : type === 'medium' ? 100 : 50;
          navigator.vibrate(duration);
        }
      }
    } catch (error) {
      console.log('Haptic feedback not available');
    }
  }, []);

  // Memoized browser notification function
  const sendBrowserNotification = useCallback((title: string, body: string, type: string) => {
    if (!('Notification' in window) || notificationPermission !== 'granted') {
      return;
    }

    try {
      const notification = new Notification(title, {
        body,
        icon: type === 'location' ? '/icons/location.png' : 
              type === 'battery' ? '/icons/battery.png' :
              '/icons/network.png',
        badge: '/icons/app-badge.png',
        requireInteraction: type === 'location' || type === 'battery', // Keep important notifications visible
        silent: false,
        tag: `participant-${type}`, // Replace previous notifications of same type
      });

      // Auto-close after 10 seconds for non-critical notifications
      if (type === 'network') {
        setTimeout(() => {
          notification.close();
        }, 10000);
      }

      // Handle notification click
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch (error) {
      console.log('Browser notification failed:', error);
    }
  }, [notificationPermission]);

  const dismissNotification = (id: string) => {
    setDismissedIds(prev => new Set(prev).add(id));
    setNotifications(prev => prev.filter(n => n.id !== id || n.persistent));
  };

  const getNotificationIcon = (type: string, severity: string) => {
    switch (type) {
      case 'location':
        return severity === 'error' ? 
          <AlertTriangle className="w-5 h-5 text-red-600" /> :
          <MapPin className="w-5 h-5 text-yellow-600" />;
      case 'battery':
        return severity === 'error' ?
          <BatteryLow className="w-5 h-5 text-red-600" /> :
          <Battery className="w-5 h-5 text-yellow-600" />;
      case 'network':
        return <WifiOff className="w-5 h-5 text-red-600" />;
      default:
        return <Bell className="w-5 h-5" />;
    }
  };

  const getNotificationStyle = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-700';
      case 'warning':
        return 'border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700';
      case 'info':
        return 'border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700';
      default:
        return 'border-gray-200 bg-gray-50 dark:bg-gray-900/20 dark:border-gray-700';
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {notifications.map((notification) => (
        <Card key={notification.id} className={`border ${getNotificationStyle(notification.severity)}`}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                {getNotificationIcon(notification.type, notification.severity)}
                <div className="min-w-0 flex-1">
                  <h4 className={`font-semibold text-sm ${
                    notification.severity === 'error' ? 'text-red-800 dark:text-red-200' :
                    notification.severity === 'warning' ? 'text-yellow-800 dark:text-yellow-200' :
                    'text-blue-800 dark:text-blue-200'
                  }`}>
                    {notification.title}
                  </h4>
                  <p className={`text-sm mt-1 ${
                    notification.severity === 'error' ? 'text-red-700 dark:text-red-300' :
                    notification.severity === 'warning' ? 'text-yellow-700 dark:text-yellow-300' :
                    'text-blue-700 dark:text-blue-300'
                  }`}>
                    {notification.message}
                  </p>
                  
                  {/* Real-time counter for location notifications */}
                  {notification.type === 'location' && !currentLocationStatus?.isWithinGeofence && (
                    <div className={`flex items-center gap-2 mt-2 text-xs ${
                      notification.severity === 'error' ? 'text-red-600 dark:text-red-400' :
                      'text-yellow-600 dark:text-yellow-400'
                    }`}>
                      <Clock className="w-3 h-3" />
                      <span className="font-mono">
                        Live: {formatTime(timeOutsideSeconds)}
                      </span>
                    </div>
                  )}

                  {/* Battery percentage for battery notifications */}
                  {notification.type === 'battery' && batteryLevel !== null && (
                    <div className={`flex items-center gap-2 mt-2 text-xs ${
                      notification.severity === 'error' ? 'text-red-600 dark:text-red-400' :
                      'text-yellow-600 dark:text-yellow-400'
                    }`}>
                      <Battery className="w-3 h-3" />
                      <span className="font-mono">
                        {batteryLevel}% {isCharging && '⚡ Charging'}
                      </span>
                    </div>
                  )}

                  {/* Network status for network notifications */}
                  {notification.type === 'network' && (
                    <div className="flex items-center gap-2 mt-2 text-xs text-red-600 dark:text-red-400">
                      <WifiOff className="w-3 h-3" />
                      <span>Check your internet connection</span>
                    </div>
                  )}
                </div>
              </div>
              
              {!notification.persistent && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => dismissNotification(notification.id)}
                  className="h-6 w-6 p-0 opacity-70 hover:opacity-100"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>

            {/* Action buttons for actionable notifications */}
            {notification.actionRequired && (
              <div className="mt-3 flex gap-2">
                {notification.type === 'location' && (
                  <Button size="sm" variant="outline" className="text-xs">
                    <MapPin className="w-3 h-3 mr-1" />
                    Show Direction
                  </Button>
                )}
                {notification.type === 'battery' && (
                  <Button size="sm" variant="outline" className="text-xs">
                    <Battery className="w-3 h-3 mr-1" />
                    Battery Settings
                  </Button>
                )}
                {notification.type === 'network' && (
                  <Button size="sm" variant="outline" className="text-xs">
                    <Wifi className="w-3 h-3 mr-1" />
                    Network Settings
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default ParticipantNotifications;