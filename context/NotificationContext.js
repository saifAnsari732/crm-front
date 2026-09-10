import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Vibration, AppState, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import socketService from '../services/socket';
import { useAuth } from './AuthContext';
import { notificationAPI } from '../services/api';
import { storage } from '../services/storage';
import { showCustomAlert } from '../components/GlobalAlert';

// ─── Detect Expo Go vs Production APK ────────────────────────────────────────
// expo-notifications causes errors in Expo Go (SDK 53+).
// We only load it in production APK builds where it works fully.
const isExpoGo = Constants.appOwnership === 'expo';

let Notifications = null;
let nativeNotificationsAvailable = false;

if (!isExpoGo && Platform.OS !== 'web') {
  // Production APK — load expo-notifications safely
  try {
    Notifications = require('expo-notifications');
    if (Notifications?.setNotificationHandler) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
      nativeNotificationsAvailable = true;
      console.log('🔔 expo-notifications: Native OS alerts enabled (Production APK).');
    }
  } catch (e) {
    console.log('⚠️ expo-notifications failed to load:', e.message);
  }
} else {
  console.log('📱 Expo Go detected — using in-app banner + polling mode (no native OS alerts).');
}
// ─────────────────────────────────────────────────────────────────────────────

const NotificationContext = createContext({});

const POLL_INTERVAL = 8000; // 8 seconds

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const router = useRouter();
  const [activeNotification, setActiveNotification] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const lastNotificationIdRef = useRef(null);
  const pollingTimerRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const responseListenerRef = useRef(null);

  // ── Map notification type → route ─────────────────────────────────────────
  const getRouteForType = (type) => {
    switch (type) {
      case 'task':    return '/(employee)/tasks';
      case 'leave':   return '/(employee)/leaves';
      case 'expense': return '/(employee)/expenses';
      case 'lead':    return '/(employee)/leads';
      default:        return '/(employee)/dashboard';
    }
  };

  // ── Configure Android notification channel (Production APK only) ──────────
  useEffect(() => {
    if (!user || !nativeNotificationsAvailable) return;

    async function configureNativeNotifications() {
      try {
        const { status: existing } = await Notifications.getPermissionsAsync();
        let finalStatus = existing;
        if (existing !== 'granted') {
          // Pre-prompt for push notifications
          const userAgreed = await new Promise((resolve) => {
            showCustomAlert(
              "Enable Notifications",
              "We need notification permissions to send you important updates on tasks, leaves, and expenses.",
              [
                { text: "Not Now", onPress: () => resolve(false), style: "cancel" },
                { text: "Allow", onPress: () => resolve(true) }
              ],
              'notification'
            );
          });
          
          if (userAgreed) {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
          } else {
            finalStatus = 'denied';
          }
        }
        if (finalStatus !== 'granted') {
          console.log('⚠️ Native Notifications: Permission denied.');
          return;
        }
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('crm-alerts', {
            name: 'CRM Activity Alerts',
            importance: Notifications.AndroidImportance.MAX, // wakes screen
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#0a3d3c',
            bypassDnd: true,
          });
          console.log('🔔 Android channel "crm-alerts" configured.');
        }
      } catch (err) {
        console.log('⚠️ Native notification setup error:', err.message);
      }
    }

    configureNativeNotifications();
  }, [user]);

  // ── Core trigger: in-app banner + OS native alert (APK) ───────────────────
  const triggerSystemNotification = useCallback(async ({ title, message, type, route, data }) => {
    try { Vibration.vibrate([0, 80, 60, 80]); } catch {}

    // ✅ Always show in-app sliding banner (Expo Go + APK both)
    setActiveNotification({
      title,
      message,
      type: type || 'default',
      route: route || getRouteForType(type),
      data: data || {},
    });

    // ✅ OS-level lock screen alert — Production APK only
    if (nativeNotificationsAvailable) {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body: message,
            data: { route: route || '/(employee)/dashboard' },
            sound: true,
            priority: Notifications.AndroidNotificationPriority?.MAX,
            ...(Platform.OS === 'android' && { channelId: 'crm-alerts' }),
          },
          trigger: null, // instant
        });
      } catch (err) {
        console.log('⚠️ scheduleNotificationAsync error:', err.message);
      }
    }

    console.log(`🔔 Notification triggered: [${type}] ${title}`);
  }, []);

  // ── Polling fallback: detect new notifications every 8s ───────────────────
  const pollForNewNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const res = await notificationAPI.getAll();
      const notifications = res?.data?.notifications || [];
      if (!notifications.length) return;

      const unread = notifications.filter(n => !n.isRead).length;
      setUnreadCount(unread);

      const latest = notifications[0];
      if (!latest) return;

      // First poll — set baseline, don't show banner
      if (lastNotificationIdRef.current === null) {
        lastNotificationIdRef.current = latest._id;
        console.log('🔔 Polling baseline set:', latest._id);
        return;
      }

      // New notification detected!
      if (latest._id !== lastNotificationIdRef.current && !latest.isRead) {
        console.log('🔔 Polling: New notification!', latest.title);
        lastNotificationIdRef.current = latest._id;
        triggerSystemNotification({
          title: latest.title,
          message: latest.message,
          type: latest.type,
          route: getRouteForType(latest.type),
          data: latest.data || {},
        });
      }
    } catch {
      // Silent fail
    }
  }, [user, triggerSystemNotification]);

  // ── Start/stop polling ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      setActiveNotification(null);
      setUnreadCount(0);
      lastNotificationIdRef.current = null;
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
      return;
    }

    pollForNewNotifications(); // immediate first poll

    pollingTimerRef.current = setInterval(pollForNewNotifications, POLL_INTERVAL);
    console.log(`🔔 Notification polling started every ${POLL_INTERVAL / 1000}s`);

    // Poll instantly when app comes to foreground
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        pollForNewNotifications();
      }
      appStateRef.current = nextState;
    });

    return () => {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
      appStateSub.remove();
    };
  }, [user, pollForNewNotifications]);

  // ── Socket listeners (real-time bonus) ────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const handleSocketNotification = (notification) => {
      console.log('📡 Socket notification:', notification.title);
      if (notification._id) lastNotificationIdRef.current = notification._id;
      triggerSystemNotification({
        title: notification.title,
        message: notification.message,
        type: notification.type,
        route: getRouteForType(notification.type),
        data: notification.data,
      });
    };

    const handleNewTask = ({ task }) => {
      triggerSystemNotification({
        title: 'New Task Assigned',
        message: `You have been assigned: ${task?.title || 'a new task'}`,
        type: 'task',
        route: '/(employee)/tasks',
        data: { taskId: task?._id },
      });
    };

    const handleLeaveUpdate = ({ leaveId, status }) => {
      const s = status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Updated';
      triggerSystemNotification({
        title: `Leave ${s}`,
        message: `Your leave request has been ${status || 'updated'}.`,
        type: 'leave',
        route: '/(employee)/leaves',
        data: { leaveId },
      });
    };

    const handleExpenseUpdate = ({ expenseId, status }) => {
      const s = status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Updated';
      triggerSystemNotification({
        title: `Expense Claim ${s}`,
        message: `Your expense claim has been ${status || 'updated'}.`,
        type: 'expense',
        route: '/(employee)/expenses',
        data: { expenseId },
      });
    };

    const handleAccountApproved = ({ message }) => {
      triggerSystemNotification({
        title: 'Account Approved',
        message: message || 'Your account has been approved!',
        type: 'alert',
        route: '/(employee)/dashboard',
      });
    };

    socketService.on('notification',          handleSocketNotification);
    socketService.on('new_task',              handleNewTask);
    socketService.on('leave_status_update',   handleLeaveUpdate);
    socketService.on('expense_status_update', handleExpenseUpdate);
    socketService.on('account_approved',      handleAccountApproved);

    // Native tap → redirect (Production APK only)
    if (nativeNotificationsAvailable && Notifications?.addNotificationResponseReceivedListener) {
      try {
        responseListenerRef.current = Notifications.addNotificationResponseReceivedListener(response => {
          const route = response.notification.request.content.data?.route;
          if (route) {
            setTimeout(() => {
              try { router.push(route); } catch {}
            }, 300);
          }
        });
      } catch {}
    }

    return () => {
      socketService.off('notification',          handleSocketNotification);
      socketService.off('new_task',              handleNewTask);
      socketService.off('leave_status_update',   handleLeaveUpdate);
      socketService.off('expense_status_update', handleExpenseUpdate);
      socketService.off('account_approved',      handleAccountApproved);
      if (responseListenerRef.current) {
        try { responseListenerRef.current.remove(); } catch {}
        responseListenerRef.current = null;
      }
    };
  }, [user, triggerSystemNotification]);

  const dismissNotification = useCallback(() => setActiveNotification(null), []);

  return (
    <NotificationContext.Provider
      value={{
        activeNotification,
        dismissNotification,
        unreadCount,
        showLocalNotification: triggerSystemNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => useContext(NotificationContext);
