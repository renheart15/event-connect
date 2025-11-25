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

  async sendReturnedToGeofenceNotification(eventName: string, timeRemaining?: string) {
    if (!this.permissionGranted || !Capacitor.isNativePlatform()) {
      return;
    }

    try {
      // CRITICAL FIX: Include time remaining in notification body
      const bodyText = timeRemaining
        ? `You have returned to the ${eventName} premises. Timer paused. Time remaining: ${timeRemaining}`
        : `You have returned to the ${eventName} premises. Timer paused.`;

      await LocalNotifications.schedule({
        notifications: [
          {
            id: this.notificationId++,
            title: '✅ Back Inside Event Area',
            body: bodyText,
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
            title: '⏱️ Countdown Has Begun',
            body: `Your location for ${eventName} hasn't updated recently. Countdown timer is active. Update your location or you may be marked absent.`,
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

  async sendCountdownBeganNotification(eventName: string, timeRemaining: string) {
    if (!this.permissionGranted || !Capacitor.isNativePlatform()) {
      return;
    }

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: this.notificationId++,
            title: '⏱️ Countdown Has Begun',
            body: `You left ${eventName} premises. Countdown timer started: ${timeRemaining} remaining. Return soon or you may be marked absent.`,
            sound: 'default',
            smallIcon: 'ic_stat_notification',
            largeIcon: 'ic_launcher',
            extra: {
              type: 'countdown_began',
              eventName
            }
          }
        ]
      });
      console.log('📢 Sent countdown began notification');
    } catch (error) {
      console.error('❌ Error sending countdown began notification:', error);
    }
  }

  async sendOneMinuteLeftNotification(eventName: string) {
    if (!this.permissionGranted || !Capacitor.isNativePlatform()) {
      return;
    }

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: this.notificationId++,
            title: '🚨 Only 1 Minute Left!',
            body: `Critical: Only 1 minute remaining outside ${eventName}! Return immediately or you will be marked absent.`,
            sound: 'default',
            smallIcon: 'ic_stat_notification',
            largeIcon: 'ic_launcher',
            extra: {
              type: 'one_minute_left',
              eventName
            }
          }
        ]
      });
      console.log('📢 Sent 1 minute left notification');
    } catch (error) {
      console.error('❌ Error sending 1 minute left notification:', error);
    }
  }

  async sendCheckInNotification(eventName: string) {
    if (!this.permissionGranted || !Capacitor.isNativePlatform()) {
      return;
    }

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: this.notificationId++,
            title: '✅ Check-in Successful!',
            body: `Welcome to ${eventName}. Your attendance has been recorded.`,
            sound: 'default',
            smallIcon: 'ic_stat_notification',
            largeIcon: 'ic_launcher',
            extra: {
              type: 'check_in',
              eventName
            }
          }
        ]
      });
      console.log('📢 Sent check-in notification');
    } catch (error) {
      console.error('❌ Error sending check-in notification:', error);
    }
  }

  async sendAutoCheckInNotification(eventName: string) {
    if (!this.permissionGranted || !Capacitor.isNativePlatform()) {
      return;
    }

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: this.notificationId++,
            title: '🎉 Auto Check-in Successful!',
            body: `Automatically checked into ${eventName}. Location tracking is active.`,
            sound: 'default',
            smallIcon: 'ic_stat_notification',
            largeIcon: 'ic_launcher',
            extra: {
              type: 'auto_check_in',
              eventName
            }
          }
        ]
      });
      console.log('📢 Sent auto check-in notification');
    } catch (error) {
      console.error('❌ Error sending auto check-in notification:', error);
    }
  }

  async sendCheckOutNotification(eventName: string) {
    if (!this.permissionGranted || !Capacitor.isNativePlatform()) {
      return;
    }

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: this.notificationId++,
            title: '👋 Check-out Complete',
            body: `You have been checked out of ${eventName}. Thank you for attending!`,
            sound: 'default',
            smallIcon: 'ic_stat_notification',
            largeIcon: 'ic_launcher',
            extra: {
              type: 'check_out',
              eventName
            }
          }
        ]
      });
      console.log('📢 Sent check-out notification');
    } catch (error) {
      console.error('❌ Error sending check-out notification:', error);
    }
  }

  async sendAutoCheckOutNotification(eventName: string) {
    if (!this.permissionGranted || !Capacitor.isNativePlatform()) {
      return;
    }

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: this.notificationId++,
            title: '✔️ Auto Check-out Completed',
            body: `Automatically checked out of ${eventName}. Location tracking has stopped.`,
            sound: 'default',
            smallIcon: 'ic_stat_notification',
            largeIcon: 'ic_launcher',
            extra: {
              type: 'auto_check_out',
              eventName
            }
          }
        ]
      });
      console.log('📢 Sent auto check-out notification');
    } catch (error) {
      console.error('❌ Error sending auto check-out notification:', error);
    }
  }

  async sendEventJoinedNotification(eventName: string) {
    if (!this.permissionGranted || !Capacitor.isNativePlatform()) {
      return;
    }

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: this.notificationId++,
            title: '🎊 Joined Event Successfully!',
            body: `You have been added to ${eventName}. You can now check in.`,
            sound: 'default',
            smallIcon: 'ic_stat_notification',
            largeIcon: 'ic_launcher',
            extra: {
              type: 'event_joined',
              eventName
            }
          }
        ]
      });
      console.log('📢 Sent event joined notification');
    } catch (error) {
      console.error('❌ Error sending event joined notification:', error);
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
