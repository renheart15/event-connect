import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

class NotificationService {
  private permissionGranted = false;
  private notificationId = 1;

  async initialize() {
    if (!Capacitor.isNativePlatform()) {
      console.log('📱 Not a native platform, skipping notification setup');
      return false;
    }

    try {
      // Check current permission status
      const permission = await LocalNotifications.checkPermissions();

      if (permission.display === 'granted') {
        this.permissionGranted = true;
        console.log('✅ Notification permissions already granted');
        return true;
      }

      // Request permissions if not granted
      const request = await LocalNotifications.requestPermissions();
      this.permissionGranted = request.display === 'granted';

      if (this.permissionGranted) {
        console.log('✅ Notification permissions granted');
      } else {
        console.warn('⚠️ Notification permissions denied');
      }

      return this.permissionGranted;
    } catch (error) {
      console.error('❌ Error initializing notifications:', error);
      return false;
    }
  }

  async sendOutsideGeofenceNotification(eventName: string, timeRemaining: string) {
    if (!this.permissionGranted || !Capacitor.isNativePlatform()) {
      return;
    }

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: this.notificationId++,
            title: '⚠️ Outside Event Area',
            body: `You have left the ${eventName} premises. Time remaining: ${timeRemaining}`,
            sound: 'default',
            smallIcon: 'ic_stat_notification',
            largeIcon: 'ic_launcher',
            extra: {
              type: 'outside_geofence',
              eventName
            }
          }
        ]
      });
      console.log('📢 Sent outside geofence notification');
    } catch (error) {
      console.error('❌ Error sending outside geofence notification:', error);
    }
  }

  async sendReturnedToGeofenceNotification(eventName: string) {
    if (!this.permissionGranted || !Capacitor.isNativePlatform()) {
      return;
    }

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: this.notificationId++,
            title: '✅ Back Inside Event Area',
            body: `You have returned to the ${eventName} premises. Timer paused.`,
            sound: 'default',
            smallIcon: 'ic_stat_notification',
            largeIcon: 'ic_launcher',
            extra: {
              type: 'returned_to_geofence',
              eventName
            }
          }
        ]
      });
      console.log('📢 Sent returned to geofence notification');
    } catch (error) {
      console.error('❌ Error sending returned notification:', error);
    }
  }

  async sendWarningNotification(eventName: string, timeRemaining: string) {
    if (!this.permissionGranted || !Capacitor.isNativePlatform()) {
      return;
    }

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: this.notificationId++,
            title: '⏰ Time Limit Warning',
            body: `You have ${timeRemaining} remaining outside ${eventName}. Return soon to avoid being marked absent!`,
            sound: 'default',
            smallIcon: 'ic_stat_notification',
            largeIcon: 'ic_launcher',
            extra: {
              type: 'warning',
              eventName
            }
          }
        ]
      });
      console.log('📢 Sent warning notification');
    } catch (error) {
      console.error('❌ Error sending warning notification:', error);
    }
  }

  async sendExceededLimitNotification(eventName: string) {
    if (!this.permissionGranted || !Capacitor.isNativePlatform()) {
      return;
    }

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: this.notificationId++,
            title: '🚫 Time Limit Exceeded',
            body: `You have exceeded the time limit outside ${eventName} and will be marked as absent. Please return immediately.`,
            sound: 'default',
            smallIcon: 'ic_stat_notification',
            largeIcon: 'ic_launcher',
            extra: {
              type: 'exceeded_limit',
              eventName
            }
          }
        ]
      });
      console.log('📢 Sent exceeded limit notification');
    } catch (error) {
      console.error('❌ Error sending exceeded limit notification:', error);
    }
  }

  async sendStaleDataNotification(eventName: string) {
    if (!this.permissionGranted || !Capacitor.isNativePlatform()) {
      return;
    }

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: this.notificationId++,
            title: '📡 Location Update Required',
            body: `Your location for ${eventName} hasn't updated recently. Please ensure GPS is enabled and app is running.`,
            sound: 'default',
            smallIcon: 'ic_stat_notification',
            largeIcon: 'ic_launcher',
            extra: {
              type: 'stale_data',
              eventName
            }
          }
        ]
      });
      console.log('📢 Sent stale data notification');
    } catch (error) {
      console.error('❌ Error sending stale data notification:', error);
    }
  }

  async clearAllNotifications() {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    try {
      await LocalNotifications.cancel({ notifications: [] });
      console.log('🧹 Cleared all notifications');
    } catch (error) {
      console.error('❌ Error clearing notifications:', error);
    }
  }
}

export const notificationService = new NotificationService();
