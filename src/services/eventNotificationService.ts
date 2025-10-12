import { LocalNotifications, ScheduleOptions } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

export interface EventInfo {
  id: string;
  title: string;
  date: string;
  startTime: string;
  location: string;
}

class EventNotificationService {
  private notificationIds: Map<string, number[]> = new Map();
  private nextNotificationId = 1;

  /**
   * Request notification permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await LocalNotifications.requestPermissions();
        return result.display === 'granted';
      } else {
        // Fallback to web Notification API
        if ('Notification' in window) {
          const permission = await Notification.requestPermission();
          return permission === 'granted';
        }
      }
      return false;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }

  /**
   * Check if notifications are enabled
   */
  async checkPermissions(): Promise<boolean> {
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await LocalNotifications.checkPermissions();
        return result.display === 'granted';
      } else {
        if ('Notification' in window) {
          return Notification.permission === 'granted';
        }
      }
      return false;
    } catch (error) {
      console.error('Error checking notification permissions:', error);
      return false;
    }
  }

  /**
   * Schedule notifications for an upcoming event
   * Notifications are sent at:
   * - 1 hour before event starts
   * - 15 minutes before event starts
   * - When event starts (countdown complete)
   */
  async scheduleEventNotifications(event: EventInfo): Promise<void> {
    try {
      const hasPermission = await this.checkPermissions();
      if (!hasPermission) {
        const granted = await this.requestPermissions();
        if (!granted) {
          console.log('Notification permissions not granted');
          return;
        }
      }

      // Cancel any existing notifications for this event
      await this.cancelEventNotifications(event.id);

      // Parse event date and time
      const eventDateTime = new Date(`${event.date}T${event.startTime}`);
      const now = new Date();

      // If event has already started, don't schedule notifications
      if (eventDateTime <= now) {
        console.log('Event has already started, skipping notifications');
        return;
      }

      const notifications: ScheduleOptions['notifications'] = [];
      const scheduledIds: number[] = [];

      // 1 hour before
      const oneHourBefore = new Date(eventDateTime.getTime() - 60 * 60 * 1000);
      if (oneHourBefore > now) {
        const id = this.nextNotificationId++;
        scheduledIds.push(id);
        notifications.push({
          id,
          title: '⏰ Event Starting Soon',
          body: `${event.title} starts in 1 hour at ${event.location}`,
          schedule: { at: oneHourBefore },
          sound: 'beep.wav',
          attachments: undefined,
          actionTypeId: "",
          extra: {
            eventId: event.id,
            type: 'countdown',
            minutesBefore: 60
          }
        });
      }

      // 15 minutes before
      const fifteenMinBefore = new Date(eventDateTime.getTime() - 15 * 60 * 1000);
      if (fifteenMinBefore > now) {
        const id = this.nextNotificationId++;
        scheduledIds.push(id);
        notifications.push({
          id,
          title: '🔔 Event Starting Very Soon!',
          body: `${event.title} starts in 15 minutes. Get ready!`,
          schedule: { at: fifteenMinBefore },
          sound: 'beep.wav',
          attachments: undefined,
          actionTypeId: "",
          extra: {
            eventId: event.id,
            type: 'countdown',
            minutesBefore: 15
          }
        });
      }

      // At event start time
      const id = this.nextNotificationId++;
      scheduledIds.push(id);
      notifications.push({
        id,
        title: '🎉 Event is Starting Now!',
        body: `${event.title} has begun! Don't forget to check in.`,
        schedule: { at: eventDateTime },
        sound: 'beep.wav',
        attachments: undefined,
        actionTypeId: "",
        extra: {
          eventId: event.id,
          type: 'start',
          minutesBefore: 0
        }
      });

      if (notifications.length > 0) {
        if (Capacitor.isNativePlatform()) {
          await LocalNotifications.schedule({
            notifications
          });
          this.notificationIds.set(event.id, scheduledIds);
          console.log(`Scheduled ${notifications.length} notifications for event: ${event.title}`);
        } else {
          // Web fallback - use setTimeout for scheduling
          this.scheduleWebNotifications(notifications);
          this.notificationIds.set(event.id, scheduledIds);
          console.log(`Scheduled ${notifications.length} web notifications for event: ${event.title}`);
        }
      }
    } catch (error) {
      console.error('Error scheduling event notifications:', error);
    }
  }

  /**
   * Schedule notifications for web (non-native platforms)
   */
  private scheduleWebNotifications(notifications: ScheduleOptions['notifications']): void {
    notifications.forEach(notification => {
      if (notification.schedule && 'at' in notification.schedule) {
        const scheduleTime = new Date(notification.schedule.at).getTime();
        const now = Date.now();
        const delay = scheduleTime - now;

        if (delay > 0) {
          setTimeout(() => {
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(notification.title, {
                body: notification.body,
                icon: '/icon-192.png',
                badge: '/icon-192.png',
                tag: `event-${notification.extra?.eventId}`,
                requireInteraction: true
              });
            }
          }, delay);
        }
      }
    });
  }

  /**
   * Cancel all notifications for a specific event
   */
  async cancelEventNotifications(eventId: string): Promise<void> {
    try {
      const ids = this.notificationIds.get(eventId);
      if (ids && ids.length > 0) {
        if (Capacitor.isNativePlatform()) {
          await LocalNotifications.cancel({ notifications: ids.map(id => ({ id })) });
        }
        this.notificationIds.delete(eventId);
        console.log(`Cancelled notifications for event: ${eventId}`);
      }
    } catch (error) {
      console.error('Error cancelling event notifications:', error);
    }
  }

  /**
   * Cancel all scheduled notifications
   */
  async cancelAllNotifications(): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
        const pending = await LocalNotifications.getPending();
        if (pending.notifications.length > 0) {
          await LocalNotifications.cancel({
            notifications: pending.notifications
          });
        }
      }
      this.notificationIds.clear();
      console.log('Cancelled all event notifications');
    } catch (error) {
      console.error('Error cancelling all notifications:', error);
    }
  }

  /**
   * Get all pending notifications
   */
  async getPendingNotifications(): Promise<any[]> {
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await LocalNotifications.getPending();
        return result.notifications;
      }
      return [];
    } catch (error) {
      console.error('Error getting pending notifications:', error);
      return [];
    }
  }
}

export const eventNotificationService = new EventNotificationService();
