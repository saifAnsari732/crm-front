import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { Platform, PermissionsAndroid, DeviceEventEmitter, Alert, AppState, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';
import { showCustomAlert } from '../components/GlobalAlert';
import { storage } from '../services/storage';
import { trackingApi } from '../services/api';
import socketService from '../services/socket';
import { BACKGROUND_TRACKING_TASK, startHeartbeat, stopHeartbeat, sendHeartbeatNow } from '../services/locationTask';
import { enqueueCoordinate, enqueueStop } from '../services/offlineSync';
import { cancelNoMovementNotification, scheduleNoMovementNotification, sendAutoClosedNotification, sendGpsDisabledNotification } from '../services/trackingNotification';
import { showBatteryOptimizationDialog, remindBatteryOptimizationIfNeeded } from '../services/batteryOptimization';

/* =========================================================================
   NOTE FOR APK / PRODUCTION BUILD:
   Native Push Notifications Enabled for APK build.
========================================================================= */
let Notifications = null;
const isExpoGo = Constants.appOwnership === 'expo';
try {
  Notifications = require('expo-notifications');
  if (Notifications?.setNotificationHandler) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }
} catch (e) {
  // Gracefully ignored in Expo Go
}

const canUseNativeLocalNotifications = async () => {
  if (Platform.OS === 'web' || !Notifications || typeof Notifications.scheduleNotificationAsync !== 'function') {
    return false;
  }

  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
};
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
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') checkActiveSession();
    });
    
    return () => {
      subscription.remove();
      appStateSubscription.remove();
    };
  }, []);

  const checkActiveSession = async () => {
    try {
      const activeSession = await storage.getItem('currentTrackingSessionId');
      if (Platform.OS === 'web') {
        setIsTracking(!!activeSession);
        return;
      }
      
      let serverSessionActive = true;
      try {
        if (activeSession) {
          // Heartbeat first: the server re-opens a same-day shift it auto-closed,
          // so the employee is not forced to punch in again and no KM is lost.
          await sendHeartbeatNow(true);
          startHeartbeat(activeSession);
        }
        const response = await trackingApi.getTodaySessions();
        const serverSession = response.data?.sessions?.find((session) => session.sessionId === activeSession);
        if (serverSession && serverSession.isActive === false) {
          serverSessionActive = false;
          await storage.removeItem('currentTrackingSessionId');
          await storage.removeItem('trackingStartTime');
          await storage.removeItem('tracking_accumulated_distance');
          await storage.removeItem('last_recorded_location');
          await cancelNoMovementNotification();
          await sendAutoClosedNotification();
          
          // Show alert to employee when session was auto-closed due to inactivity
          Alert.alert(
            "Shift Auto-Closed",
            "Aapki shift lambi Inactivity ki wajah se server dwara band ho gayi hai. Kripya naye safar ke liye dobara 'Punch In' karein."
          );
        }
      } catch (serverError) {
        console.log('📍 useLocationTracker: Server session check deferred:', serverError.message);
      }

      if (isExpoGo) {
        setIsTracking(!!activeSession && serverSessionActive);
        return;
      }

      const isTaskRegistered = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TRACKING_TASK);
      if (activeSession && serverSessionActive && isTaskRegistered) {
        setIsTracking(true);
      } else {
        setIsTracking(false);
      }
    } catch (e) {
      console.error('📍 useLocationTracker: Session check failed:', e);
    }
  };

  // Check if server auto-closed our session
  const checkSessionRecovery = async () => {
    const wasClosed = await storage.getItem('tracking_session_closed_by_server');
    if (wasClosed === 'true') {
      await storage.removeItem('tracking_session_closed_by_server');
      // The session was auto-closed, UI should show punch-in button
      return true;
    }
    return false;
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
        sendGpsDisabledNotification().catch(() => {});
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

      // Expo Go cannot provide Android background location. Use foreground-only
      // tracking there; full background tracking requires a development build.
      if (!isExpoGo) {
        // 2. Background Location Permission (Requirement #2 - triggered after foreground)
        const { status: currentBgStatus } = await Location.getBackgroundPermissionsAsync();

        if (currentBgStatus !== 'granted') {
        // Prominent Disclosure before requesting background location (Google Play Policy Requirement)
        const userAgreed = await new Promise((resolve) => {
          showCustomAlert(
            "Background Location Required",
            "This app collects location data to enable shift tracking and calculate distance travelled even when the app is closed or not in use.",
            [
              { text: "Decline", onPress: () => resolve(false), style: "cancel" },
              { text: "Agree", onPress: () => resolve(true) }
            ],
            'warning'
          );
        });

        if (!userAgreed) {
          setPermissionStatus('foreground_only');
          showCustomAlert(
            'Permission Denied', 
            'Background Location permission is required for active tracking when minimized.',
            [{ text: 'OK' }],
            'error'
          );
          return false;
        }

          const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
          if (backgroundStatus !== 'granted') {
            setPermissionStatus('foreground_only');
            alert('Background Location permission ("Allow all the time") is required for active tracking when minimized.');
            return false;
          }
        }
      }

      // 3. Camera Permission (Mandatory for Selfie Check-in)
      const { status: cameraStatus } = await ImagePicker.getCameraPermissionsAsync();
      if (cameraStatus !== 'granted') {
        const { status: reqCamStatus } = await ImagePicker.requestCameraPermissionsAsync();
        if (reqCamStatus !== 'granted') {
          showCustomAlert(
            'Camera Permission Required',
            'Camera permission is mandatory to capture a selfie check-in before starting your shift.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() }
            ],
            'error'
          );
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

      let latitude;
      let longitude;

      if (Platform.OS !== 'web') {
        // Fetch current coordinates to seed the session
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
          maximumAge: 0,
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
          console.log('📍 useLocationTracker: Web geolocation denied or timed out.');
        }
      }

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return { success: false, error: 'Current GPS location is unavailable. Please enable location and try again.' };
      }

      // 1. Create session via REST API check-in
      console.log('📍 useLocationTracker: Starting tracking session in backend...');
      let session;
      try {
        const latVal = Number(latitude);
        const lngVal = Number(longitude);

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
        console.log('⚠️ useLocationTracker: Backend unreachable; tracking start cancelled.', networkErr.message);
        return { success: false, error: 'Server unavailable. Tracking was not started; please try again when connected.' };
      }

      const sessionId = session.sessionId;

      // 2. Cache session details locally
      // Anchor this shift at its own start location. This prevents comparing
      // against the previous shift while preserving all distance from shift start.
      await storage.setItem('last_recorded_location', JSON.stringify({
        lat: latitude,
        lng: longitude,
        speed: 0,
        accuracy: 0,
        timestamp: session.startTime || new Date().toISOString(),
      }));
      await storage.setItem('currentTrackingSessionId', sessionId);
      await storage.setItem('tracking_accumulated_session_id', sessionId);
      await storage.setItem('trackingStartTime', session.startTime);
      const initialDist = typeof response.data?.totalDistanceToday === 'number'
        ? response.data.totalDistanceToday.toFixed(2)
        : '0.00';
      await storage.setItem('tracking_accumulated_distance', initialDist);
      await scheduleNoMovementNotification(sessionId);

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
      if (Platform.OS !== 'web' && !isExpoGo) {
        try {
          console.log('📍 useLocationTracker: Initializing native background TaskManager...');

          // Stop any stale task first to avoid duplicate registration
          const alreadyRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TRACKING_TASK);
          if (alreadyRunning) {
            await Location.stopLocationUpdatesAsync(BACKGROUND_TRACKING_TASK);
          }

          await Location.startLocationUpdatesAsync(BACKGROUND_TRACKING_TASK, {
            // High accuracy ensures real GPS chip is used, avoiding "cutting corners" on curved roads.
            accuracy: Location.Accuracy.High,

            // Android: poll every 10 seconds (was 15s). More frequent = better curve capture in pocket mode.
            timeInterval: 10000,

            // Send update after moving at least 10 meters to perfectly capture road curves
            distanceInterval: 10,

            // ── CRITICAL: Android Foreground Service config ────────────────────
            // This is what allows GPS to continue running after the USER swipes the app away.
            // Android requires a visible persistent notification for this — Uber, Ola, Rapido all do this.
            foregroundService: {
              notificationTitle: '🟢 Shift Active — Tracking ON',
              notificationBody: 'Tap to open app. Tracking continues in background.',
              notificationColor: '#0a3d3c',
              killServiceOnDestroy: false, // ← KEY: keeps the service alive even after app swipe
            },

            // iOS: show blue bar at top (like Google Maps / Uber)
            showsBackgroundLocationIndicator: true,

            // Don't let Android battery optimizer pause updates
            pausesUpdatesAutomatically: false,

            // ── REMOVED deferredUpdates ──────────────────────────────────────────
            // Previously had deferredUpdatesInterval: 30000 and deferredUpdatesDistance: 50
            // This was DELAYING GPS points in pocket/display-off mode by 30+ seconds,
            // causing Android Doze to stretch intervals to MINUTES. Without deferral,
            // points arrive in real-time every 10s keeping the tracking alive.
          });
          console.log('📍 useLocationTracker: Background GPS task started ✅ (survives app kill)');
        } catch (taskErr) {
          console.log('⚠️ useLocationTracker: Background TaskManager registration failed:', taskErr.message);
        }
      }

      setIsTracking(true);
      DeviceEventEmitter.emit('TrackingStateChanged', true);
      // Start heartbeat to keep server session alive even when stationary
      startHeartbeat(sessionId);
      console.log('📍 useLocationTracker: Background tracking started successfully!');

      /* === NATIVE PUSH NOTIFICATIONS FOR APK === */
      if (await canUseNativeLocalNotifications()) {
        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "🟢 Shift Started (Punched In)",
              body: "Your attendance has been logged and background tracking is active.",
              sound: true,
            },
            trigger: null,
          });
        } catch (notifErr) {}
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
      let finalAccuracy = null;
      let finalSpeed = null;
      let finalTimestamp = null;
      if (Platform.OS !== 'web' && !isExpoGo) {
        try {
          const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          finalLat = position.coords.latitude;
          finalLng = position.coords.longitude;
          finalAccuracy = position.coords.accuracy;
          finalSpeed = position.coords.speed;
          finalTimestamp = position.timestamp;
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
          finalAccuracy = webPosition.coords.accuracy;
          finalSpeed = webPosition.coords.speed;
          finalTimestamp = webPosition.timestamp;
        } catch {}
      }

      // Upload the final fix before stopping the native feed so the last ride segment is not lost.
      if (finalLat && finalLng) {
        const finalCoordinate = {
          eventId: `${sessionId}:final:${Date.now()}`,
          lat: finalLat,
          lng: finalLng,
          speed: Number.isFinite(finalSpeed) && finalSpeed >= 0 ? finalSpeed : 0,
          accuracy: Number.isFinite(finalAccuracy) && finalAccuracy >= 0 ? finalAccuracy : 999,
          heading: 0,
          timestamp: finalTimestamp ? new Date(finalTimestamp).toISOString() : new Date().toISOString(),
        };
        try {
          const finalResponse = await trackingApi.updateLocation(sessionId, [finalCoordinate]);
          if (finalResponse.data?.success) {
            const currentAcc = parseFloat(await storage.getItem('tracking_accumulated_distance')) || 0;
            const confirmedDist = Number(finalResponse.data.totalDistance) || 0;
            await storage.setItem('tracking_accumulated_distance', String(Math.max(currentAcc, confirmedDist)));
          }
        } catch (finalErr) {
          console.log('⚠️ useLocationTracker: Final coordinate upload deferred:', finalErr.message);
          const previousLocation = await storage.getItem('last_recorded_location');
          await enqueueCoordinate(sessionId, finalCoordinate, previousLocation ? JSON.parse(previousLocation) : null);
        }
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
        const localAcc = parseFloat(await storage.getItem('tracking_accumulated_distance')) || 0;
        totalDistance = Math.max(Number(response.data?.totalDistance) || 0, localAcc);
      } catch (netErr) {
        console.log('⚠️ useLocationTracker: Backend unreachable during stop, queueing stop for retry.');
        await enqueueStop(sessionId, new Date().toISOString());
        totalDistance = parseFloat(await storage.getItem('tracking_accumulated_distance')) || 0;
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
      await storage.removeItem('tracking_accumulated_session_id');
      await storage.removeItem('last_recorded_location');
      await cancelNoMovementNotification();
      // Stop heartbeat timer
      stopHeartbeat();

      setIsTracking(false);
      DeviceEventEmitter.emit('TrackingStateChanged', false);
      console.log('📍 useLocationTracker: Background tracking stopped. Distance:', totalDistance, 'km');

      /* === NATIVE PUSH NOTIFICATIONS FOR APK === */
      if (await canUseNativeLocalNotifications()) {
        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "🔴 Shift Ended (Punched Out)",
              body: `You have successfully clocked out. Distance logged: ${totalDistance.toFixed(2)} km.`,
              sound: true,
            },
            trigger: null,
          });
        } catch (notifErr) {}
      }
      /* ==================================================== */

      return { success: true, totalDistance };
    } catch (error) {
      console.error('📍 useLocationTracker: Stop tracking failure:', error);
      
      // Force clean local cache if server is offline/fails
      await storage.removeItem('currentTrackingSessionId');
      await storage.removeItem('trackingStartTime');
      await storage.removeItem('tracking_accumulated_distance');
      await storage.removeItem('tracking_accumulated_session_id');
      await storage.removeItem('last_recorded_location');
      await cancelNoMovementNotification();
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
    checkSessionRecovery,
  };
}
