import { Platform } from 'react-native';
import { storage } from './storage';

let Notifications = null;
try {
  Notifications = require('expo-notifications');
} catch (e) {
  console.log('⚠️ expo-notifications not available in Expo Go:', e.message);
}

const WATCHDOG_KEY = 'tracking_no_movement_notification_id';
const WATCHDOG_SECONDS = 60 * 60;

const canUseNativeNotifications = async () => {
  if (Platform.OS === 'web' || !Notifications || typeof Notifications.scheduleNotificationAsync !== 'function') return false;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
};

export async function scheduleNoMovementNotification(sessionId) {
  if (Platform.OS === 'web' || !sessionId || !Notifications) return;
  try {
    const isEnabled = await canUseNativeNotifications();
    if (!isEnabled) return;

    await cancelNoMovementNotification();
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Tracking paused',
        body: 'No movement detected for 1 hour. Tracking will be stopped automatically.',
        data: { type: 'tracking_auto_stop', sessionId },
        sound: true,
        priority: Notifications.AndroidNotificationPriority?.HIGH,
        ...(Platform.OS === 'android' ? { channelId: 'crm-alerts' } : {}),
      },
      trigger: { type: 'timeInterval', seconds: WATCHDOG_SECONDS, repeats: false },
    });
    await storage.setItem(WATCHDOG_KEY, notificationId);
  } catch (error) {
    console.log('Tracking watchdog notification could not be scheduled:', error.message);
  }
}

export async function cancelNoMovementNotification() {
  if (Platform.OS === 'web' || !Notifications || typeof Notifications.cancelScheduledNotificationAsync !== 'function') return;
  try {
    const notificationId = await storage.getItem(WATCHDOG_KEY);
    if (notificationId) {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      await storage.removeItem(WATCHDOG_KEY);
    }
  } catch (error) {
    console.log('Tracking watchdog notification could not be cancelled:', error.message);
  }
}
