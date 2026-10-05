import { Platform } from 'react-native';
import { storage } from './storage';

let Notifications = null;
try {
  Notifications = require('expo-notifications');
} catch (e) {
  console.log('⚠️ expo-notifications not available in Expo Go:', e.message);
}

const WATCHDOG_KEY = 'tracking_no_movement_notification_ids';
const LAST_SCHEDULE_KEY = 'tracking_last_schedule_time';

const canUseNativeNotifications = async () => {
  if (Platform.OS === 'web' || !Notifications || typeof Notifications.scheduleNotificationAsync !== 'function') return false;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
};

/**
 * Clean Watchdog Engine:
 * We NO LONGER spam the employee with "Tracking Ruki Hui Hai" every 30/60/90 minutes while they are stationary.
 * Standing at a shop or sitting in a meeting is NORMAL.
 * This method now ensures any stale alarms are cleared so the phone stays quiet while stationary.
 */
export async function scheduleNoMovementNotification(sessionId) {
  // Clear any legacy interval alarms so phone is not spammed while stationary
  await cancelNoMovementNotification();
}

export async function cancelNoMovementNotification() {
  if (Platform.OS === 'web' || !Notifications) return;
  try {
    // 1. Clean both singular & plural legacy keys
    const legacyKeys = ['tracking_no_movement_notification_ids', 'tracking_no_movement_notification_id', 'tracking_last_schedule_time'];
    for (const key of legacyKeys) {
      const stored = await storage.getItem(key);
      if (stored) {
        let ids = [];
        try {
          ids = JSON.parse(stored);
        } catch {
          ids = [stored];
        }
        if (!Array.isArray(ids)) ids = [ids];
        for (const id of ids) {
          if (id && typeof Notifications.cancelScheduledNotificationAsync === 'function') {
            await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
          }
        }
        await storage.removeItem(key).catch(() => {});
      }
    }

    // 2. Scan OS scheduled notification queue for any legacy watchdog timers and cancel them
    if (typeof Notifications.getAllScheduledNotificationsAsync === 'function' && typeof Notifications.cancelScheduledNotificationAsync === 'function') {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
      for (const notif of scheduled) {
        const title = notif.content?.title || '';
        const body = notif.content?.body || '';
        const data = notif.content?.data || {};
        if (
          title.toLowerCase().includes('tracking') ||
          title.toLowerCase().includes('stopped') ||
          title.toLowerCase().includes('paused') ||
          body.toLowerCase().includes('no movement') ||
          body.toLowerCase().includes('stopped automatically') ||
          data.type === 'no_movement_watchdog'
        ) {
          await Notifications.cancelScheduledNotificationAsync(notif.identifier).catch(() => {});
        }
      }
    }
  } catch (error) {
    console.log('Tracking notification cancel error:', error.message);
  }
}

/**
 * INSTANT GPS DEAD / DISABLED ALERT:
 * Fires ONLY when the device Location Service (GPS) is turned OFF by the user
 * or when GPS hardware becomes completely unavailable.
 */
export async function sendGpsDisabledNotification() {
  if (Platform.OS === 'web' || !Notifications) return;
  try {
    const isEnabled = await canUseNativeNotifications();
    if (!isEnabled) return;

    // Prevent notification spam if GPS disabled check triggers repeatedly (throttle to once per 10 mins)
    const now = Date.now();
    const lastNotifStr = await storage.getItem('gps_disabled_last_notif');
    if (lastNotifStr && now - parseInt(lastNotifStr, 10) < 10 * 60 * 1000) return;
    await storage.setItem('gps_disabled_last_notif', now.toString());

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔴 Alert: GPS Location Band Hai!',
        body: 'Aapka device GPS location service band ho gaya hai. Kripya phone ki Location settings se GPS ko turant ON karein taaki aapka KM loss na ho.',
        data: { type: 'gps_disabled' },
        sound: true,
        priority: Notifications.AndroidNotificationPriority?.MAX,
        ...(Platform.OS === 'android' ? { channelId: 'crm-alerts' } : {}),
      },
      trigger: null, // Instant push notification
    });
  } catch (error) {
    console.log('GPS disabled push notification error:', error.message);
  }
}

export async function sendAutoClosedNotification() {
  // [PERMANENT ZERO AUTO-CLOSE POLICY]: Shifts never auto-close.
  // No auto-closed notifications are ever sent to the employee.
  return;
}
