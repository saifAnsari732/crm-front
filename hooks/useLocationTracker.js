import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { Platform, PermissionsAndroid, DeviceEventEmitter, Alert } from 'react-native';
import { storage } from '../services/storage';
import { trackingApi } from '../services/api';
import socketService from '../services/socket';
import { BACKGROUND_TRACKING_TASK } from '../services/locationTask';
import { showBatteryOptimizationDialog, remindBatteryOptimizationIfNeeded } from '../services/batteryOptimization';

/* =========================================================================
   NOTE FOR APK / PRODUCTION BUILD:
   Native Push Notifications Enabled for APK build.
========================================================================= */
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
/* ========================================================================= */

export default function useLocationTracker() {
  const [isTracking, setIsTracking] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  // Sync active tracking state from secure storage upon hook initialization
  useEffect(() => {
    checkActiveSession();
    
    // Show battery optimization dialog once (first-ever app launch)
    showBatteryOptimizationDialog();
    
    // Listen for global tracking state changes (syncs across multiple hook instances)
    const subscription = DeviceEventEmitter.addListener('TrackingStateChanged', (newState) => {
      setIsTracking(newState);
    });
    
    return () => subscription.remove();
  }, []);

  const checkActiveSession = async () => {
    try {
      const activeSession = await storage.getItem('currentTrackingSessionId');
      if (Platform.OS === 'web') {
        setIsTracking(!!activeSession);
        return;
      }
      
      const isTaskRegistered = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TRACKING_TASK);
      if (activeSession && isTaskRegistered) {
        setIsTracking(true);
      } else {
        setIsTracking(false);
      }
    } catch (e) {
      console.error('📍 useLocationTracker: Session check failed:', e);
    }
  };

  /**
   * Request precise foreground and background permissions sequentially
   */
  const requestPermissions = async () => {
    try {
      setLoading(true);
      
      if (Platform.OS === 'web') {
        setPermissionStatus('granted');
        return true;
      }

      // 0. Request notification permission on Android 13+ (API 33+) to keep background task active
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        try {
          const hasNotificationPermission = await PermissionsAndroid.check(
            'android.permission.POST_NOTIFICATIONS'
          );
          if (!hasNotificationPermission) {
            const status = await PermissionsAndroid.request(
              'android.permission.POST_NOTIFICATIONS',
              {
                title: 'Notification Permission Required',
                message: 'StaffSync requires notification permission to show active tracking logs in your system header.',
                buttonNeutral: 'Ask Me Later',
                buttonNegative: 'Cancel',
                buttonPositive: 'OK',
              }
            );
            if (status !== PermissionsAndroid.RESULTS.GRANTED) {
              console.log('📍 useLocationTracker: Post notification permission denied.');
            }
          }
        } catch (notifErr) {
          console.warn('⚠️ useLocationTracker: Failed to request notification permission:', notifErr.message);
        }
      }
      
      // 0.5. Check if device Location Services are turned on
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        alert('Please turn on your device GPS / Location Services before starting the shift.');
        return false;
      }
      
      // 1. Foreground Location Permission (Requirement #1)
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        setPermissionStatus('denied');
        alert('Foreground Location permission is required to log visits.');
        return false;
      }

      // 2. Background Location Permission (Requirement #2 - triggered after foreground)
      const { status: currentBgStatus } = await Location.getBackgroundPermissionsAsync();
      
      if (currentBgStatus !== 'granted') {
        // Prominent Disclosure before requesting background location (Google Play Policy Requirement)
        const userAgreed = await new Promise((resolve) => {
          Alert.alert(
            "Background Location Required",
            "This app collects location data to enable shift tracking and calculate distance travelled even when the app is closed or not in use.",
            [
              { text: "Decline", onPress: () => resolve(false), style: "cancel" },
              { text: "Agree", onPress: () => resolve(true) }
            ],
            { cancelable: false }
          );
        });

        if (!userAgreed) {
          setPermissionStatus('foreground_only');
          alert('Background Location permission is required for active tracking when minimized.');
          return false;
        }

        const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
        if (backgroundStatus !== 'granted') {
          setPermissionStatus('foreground_only');
          alert('Background Location permission is required for active tracking when minimized.');
          return false;
        }
      }

      setPermissionStatus('granted');
      return true;
    } catch (err) {
      console.error('📍 useLocationTracker: Permission request error:', err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Start GPS Background Tracking session
   */
  const startTracking = async (selfieUrl = '') => {
    if (isTracking) return { success: true, message: 'Already tracking.' };

    try {
      setLoading(true);

      // Verify permissions first
      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        return { success: false, error: 'Permission not granted.' };
      }

      // Show battery optimization reminder nudge before starting shift
      // (only shows if user never set it — non-blocking)
      remindBatteryOptimizationIfNeeded().catch(() => {});

      let latitude = 37.7749;
      let longitude = -122.4194;

      if (Platform.OS !== 'web') {
        // Fetch current coordinates to seed the session
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      } else {
        try {
          const webPosition = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 });
          });
          latitude = webPosition.coords.latitude;
          longitude = webPosition.coords.longitude;
        } catch (e) {
          console.log('📍 useLocationTracker: Web geolocation denied or timed out, utilizing standard coordinates');
        }
      }

      // 1. Create session via REST API check-in
      console.log('📍 useLocationTracker: Starting tracking session in backend...');
      let session;
      try {
        const latVal = parseFloat(latitude) || 26.797531;
        const lngVal = parseFloat(longitude) || 88.901868;

        const response = await trackingApi.startTracking(
          null, // sessionId is auto-generated by the backend in UUID format
          new Date().toISOString(),
          latVal,
          lngVal,
          '', // startAddress
          selfieUrl
        );

        if (response.data.success) {
          session = response.data.session;
        } else {
          return { success: false, error: 'Server failed to start session.' };
        }
      } catch (networkErr) {
        console.log('⚠️ useLocationTracker: Backend unreachable, initiating local offline shift.', networkErr.message);
        session = {
          sessionId: 'offline-shift-' + Math.random().toString(36).substring(2, 9),
          startTime: new Date().toISOString(),
          startAddress: 'Offline GPS Cache - Connection Deferred'
        };
      }

      const sessionId = session.sessionId;

      // 2. Cache session details locally
      await storage.setItem('currentTrackingSessionId', sessionId);
      await storage.setItem('trackingStartTime', session.startTime);
      await storage.setItem('tracking_accumulated_distance', '0.00');

      // 3. Connect socket & emit tracking_started
      try {
        const socket = await socketService.connect();
        if (socket?.connected) {
          socketService.emitTrackingStarted({
            sessionId,
            startTime: session.startTime,
            startAddress: session.startAddress,
            lat: latitude,
            lng: longitude,
          });
        }
      } catch (socketErr) {
        console.log('⚠️ useLocationTracker: Socket handshake deferred (offline mode).');
      }

      // 4. Register background location task with OS
      if (Platform.OS !== 'web') {
        try {
          console.log('📍 useLocationTracker: Initializing native background TaskManager...');

          // Stop any stale task first to avoid duplicate registration
          const alreadyRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TRACKING_TASK);
          if (alreadyRunning) {
            await Location.stopLocationUpdatesAsync(BACKGROUND_TRACKING_TASK);
          }

          await Location.startLocationUpdatesAsync(BACKGROUND_TRACKING_TASK, {
            // Balanced = battery friendly, High = more accurate. Use Balanced to save battery
            // but update frequently enough for realistic tracking.
            accuracy: Location.Accuracy.Balanced,

            // Android: poll every 15 seconds regardless of movement (keeps foreground service alive)
            timeInterval: 15000,

            // Only send update after moving at least 20 meters (pre-filter before locationTask.js gates)
            distanceInterval: 20,

            // ── CRITICAL: Android Foreground Service config ────────────────────
            // This is what allows GPS to continue running after the USER swipes the app away.
            // Android requires a visible persistent notification for this — Uber, Ola, Rapido all do this.
            foregroundService: {
              notificationTitle: '🟢 Shift Active — Tracking ON',
              notificationBody: 'Tap to open app. Tracking continues in background.',
              notificationColor: '#0a3d3c',
              // Show km in notification (React Native does NOT allow dynamic body update here,
              // but we keep it clear so user knows tracking is active)
              killServiceOnDestroy: false, // ← KEY: keeps the service alive even after app swipe
            },

            // iOS: show blue bar at top (like Google Maps / Uber)
            showsBackgroundLocationIndicator: true,

            // Don't let Android battery optimizer pause updates
            pausesUpdatesAutomatically: false,

            // Deferred updates: batch coordinates every 30s or 50m to save battery
            deferredUpdatesInterval: 30000,
            deferredUpdatesDistance: 50,
          });
          console.log('📍 useLocationTracker: Background GPS task started ✅ (survives app kill)');
        } catch (taskErr) {
          console.log('⚠️ useLocationTracker: Background TaskManager registration failed:', taskErr.message);
        }
      }

      setIsTracking(true);
      DeviceEventEmitter.emit('TrackingStateChanged', true);
      console.log('📍 useLocationTracker: Background tracking started successfully!');

      /* === NATIVE PUSH NOTIFICATIONS FOR APK === */
      if (Platform.OS !== 'web') {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "🟢 Shift Started (Punched In)",
            body: "Your attendance has been logged and background tracking is active.",
            sound: true,
          },
          trigger: null,
        });
      }
      /* ==================================================== */
      
      return { success: true, session };
    } catch (error) {
      console.error('📍 useLocationTracker: Start tracking failure:', error);
      return { success: false, error: error.response?.data?.message || error.message };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Stop background location tracking session
   */
  const stopTracking = async () => {
    try {
      setLoading(true);
      const sessionId = await storage.getItem('currentTrackingSessionId');
      
      if (!sessionId) {
        // Fallback: stop task if registered (Mobile only)
        if (Platform.OS !== 'web') {
          const isRegistered = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TRACKING_TASK);
          if (isRegistered) {
            await Location.stopLocationUpdatesAsync(BACKGROUND_TRACKING_TASK);
          }
        }
        setIsTracking(false);
        return { success: true };
      }

      console.log(`📍 useLocationTracker: Stopping session ${sessionId}...`);

      // 1. Fetch current final coordinates to log final distance
      let finalLat = 0;
      let finalLng = 0;
      if (Platform.OS !== 'web') {
        try {
          const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          finalLat = position.coords.latitude;
          finalLng = position.coords.longitude;
        } catch (posErr) {
          console.log('📍 useLocationTracker: Could not capture final coordinate:', posErr.message);
        }
      } else {
        try {
          const webPosition = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 });
          });
          finalLat = webPosition.coords.latitude;
          finalLng = webPosition.coords.longitude;
        } catch {}
      }

      // 2. Stop native TaskManager location feeds
      if (Platform.OS !== 'web') {
        const isRegistered = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TRACKING_TASK);
        if (isRegistered) {
          await Location.stopLocationUpdatesAsync(BACKGROUND_TRACKING_TASK);
        }
      }

      // 3. Stop backend session via REST API
      let totalDistance = 0;
      try {
        const response = await trackingApi.stopTracking(sessionId, new Date().toISOString());
        totalDistance = response.data.totalDistance || 0;
      } catch (netErr) {
        console.log('⚠️ useLocationTracker: Backend unreachable during stop, terminating local session.');
      }

      // 4. Emit tracking_stopped event over Socket
      try {
        if (socketService.socket?.connected) {
          socketService.emitTrackingStopped({
            sessionId,
            endTime: new Date().toISOString(),
            totalDistance,
          });
        }
      } catch (socketErr) {}

      // 5. Clean up local secure storage cache
      await storage.removeItem('currentTrackingSessionId');
      await storage.removeItem('trackingStartTime');
      await storage.removeItem('tracking_accumulated_distance');
      await storage.removeItem('last_recorded_location');

      setIsTracking(false);
      DeviceEventEmitter.emit('TrackingStateChanged', false);
      console.log('📍 useLocationTracker: Background tracking stopped. Distance:', totalDistance, 'km');

      /* === NATIVE PUSH NOTIFICATIONS FOR APK === */
      if (Platform.OS !== 'web') {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "🔴 Shift Ended (Punched Out)",
            body: `You have successfully clocked out. Distance logged: ${totalDistance.toFixed(2)} km.`,
            sound: true,
          },
          trigger: null,
        });
      }
      /* ==================================================== */

      return { success: true, totalDistance };
    } catch (error) {
      console.error('📍 useLocationTracker: Stop tracking failure:', error);
      
      // Force clean local cache if server is offline/fails
      await storage.removeItem('currentTrackingSessionId');
      await storage.removeItem('trackingStartTime');
      await storage.removeItem('tracking_accumulated_distance');
      await storage.removeItem('last_recorded_location');
      try {
        await Location.stopLocationUpdatesAsync(BACKGROUND_TRACKING_TASK);
      } catch {}
      setIsTracking(false);
      DeviceEventEmitter.emit('TrackingStateChanged', false);

      return { success: false, error: error.response?.data?.message || error.message };
    } finally {
      setLoading(false);
    }
  };

  return {
    isTracking,
    permissionStatus,
    loading,
    requestPermissions,
    startTracking,
    stopTracking,
  };
}
