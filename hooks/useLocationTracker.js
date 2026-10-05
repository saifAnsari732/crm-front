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
import { enqueueCoordinate, enqueueStop, getQueueSize, flushOfflineQueue } from '../services/offlineSync';
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
      const wasClosed = await storage.getItem('tracking_session_closed_by_server');
      if (wasClosed === 'true') {
        await storage.removeItem('tracking_session_closed_by_server');
        await storage.removeItem('currentTrackingSessionId');
        await storage.removeItem('trackingStartTime');
        await storage.removeItem('tracking_accumulated_distance');
        await storage.removeItem('tracking_accumulated_session_id');
        await storage.removeItem('last_recorded_location');
        if (Platform.OS !== 'web' && !isExpoGo) {
          try {
            const isTaskRegistered = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TRACKING_TASK);
            if (isTaskRegistered) {
              await Location.stopLocationUpdatesAsync(BACKGROUND_TRACKING_TASK);
            }
          } catch {}
        }
        setIsTracking(false);
        DeviceEventEmitter.emit('TrackingStateChanged', false);
        return;
      }

      const activeSession = await storage.getItem('currentTrackingSessionId');
      if (!activeSession) {
        setIsTracking(false);
        return;
      }

      if (Platform.OS === 'web') {
        setIsTracking(true);
        return;
      }
      
      // Best-effort server sync & heartbeat ping
      try {
        await sendHeartbeatNow(true);
        startHeartbeat(activeSession);
        flushOfflineQueue().catch(() => {});
      } catch (serverError) {
        console.log('📍 useLocationTracker: Server session sync deferred:', serverError.message);
      }

      if (isExpoGo) {
        setIsTracking(true);
        return;
      }

      // Auto-recover background location task if OS killed it
      const isTaskRegistered = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TRACKING_TASK);
      if (!isTaskRegistered && Platform.OS !== 'web' && !isExpoGo) {
        try {
          console.log('📍 useLocationTracker: Active session found in storage but OS task died. Auto-recovering background GPS task...');
          await Location.startLocationUpdatesAsync(BACKGROUND_TRACKING_TASK, {
            accuracy: Location.Accuracy.High,
            timeInterval: 10000,
            distanceInterval: 10,
            foregroundService: {
              notificationTitle: '🟢 Shift Active — Tracking ON',
              notificationBody: 'Tap to open app. Tracking continues in background.',
              notificationColor: '#0a3d3c',
              killServiceOnDestroy: false,
            },
            showsBackgroundLocationIndicator: true,
            pausesUpdatesAutomatically: false,
          });
          console.log('📍 useLocationTracker: Background GPS task auto-recovered ✅');
        } catch (recoverErr) {
          console.log('⚠️ useLocationTracker: Auto-recovery of location task failed:', recoverErr.message);
        }
      }
      setIsTracking(true);
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
   * Request and strictly verify all precise permissions before starting Punch In:
   * 1. Device GPS / Location Services (Must be ON)
   * 2. Post Notification Permission (Android 13+ mandatory for foreground service)
   * 3. Foreground Location Permission
   * 4. Background Location Permission ("Allow all the time" mandatory)
   * 5. Camera Permission (Mandatory for selfie check-in)
   * 6. Battery Optimization check (Nudge to set "Unrestricted")
   */
  const requestPermissions = async () => {
    try {
      setLoading(true);
      
      if (Platform.OS === 'web') {
        setPermissionStatus('granted');
        return true;
      }

      // 0. Check if device Location Services (GPS) are turned ON
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        sendGpsDisabledNotification().catch(() => {});
        showCustomAlert(
          'GPS Location Disabled',
          'Phone ka Location / GPS Services OFF hai. Punch In karne se pehle kripya GPS ON karein.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() }
          ],
          'warning'
        );
        return false;
      }

      // 1. Request notification permission on Android 13+ (API 33+) to keep background task active
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
                message: 'Field App requires notification permission to keep background tracking active in system header.',
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

      // 2. Foreground Location Permission
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        setPermissionStatus('denied');
        showCustomAlert(
          'Location Permission Denied',
          'Location permission ("Allow") is required to log visits and track shift distance.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() }
          ],
          'error'
        );
        return false;
      }

      // 3. Background Location Permission ("Allow all the time")
      if (!isExpoGo) {
        const { status: currentBgStatus } = await Location.getBackgroundPermissionsAsync();

        if (currentBgStatus !== 'granted') {
          // Prominent Disclosure before requesting background location (Google Play Policy Requirement)
          const userAgreed = await new Promise((resolve) => {
            showCustomAlert(
              "Background Location Required",
              "This app collects background location data to track your shift route and calculate total distance travelled even when the app is closed or not in use.",
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
              'Background Permission Required',
              'Background Location permission ("Allow all the time") is required for tracking when app is minimized.',
              [{ text: 'OK' }],
              'error'
            );
            return false;
          }

          const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
          if (backgroundStatus !== 'granted') {
            setPermissionStatus('foreground_only');
            showCustomAlert(
              'Background Location "Allow All The Time" Required',
              'Punch In start karne ke liye Location permission me "Allow all the time" (Hamesha allow) select karna zaroori hai.\n\nKripya App Settings me jaakar Location ko "Allow all the time" par set karein.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open App Settings', onPress: () => Linking.openSettings() }
              ],
              'error'
            );
            return false;
          }
        }
      }

      // 4. Camera Permission (Mandatory for Selfie Check-in)
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
      let startResponse;
      try {
        const latVal = Number(latitude);
        const lngVal = Number(longitude);

        startResponse = await trackingApi.startTracking(
          null, // sessionId is auto-generated by the backend in UUID format
          new Date().toISOString(),
          latVal,
          lngVal,
          '', // startAddress
          selfieUrl
        );

        if (startResponse.data && startResponse.data.success) {
          session = startResponse.data.session;
        } else {
          return { success: false, error: startResponse.data?.message || 'Server failed to start session.' };
        }
      } catch (networkErr) {
        console.log('⚠️ useLocationTracker: Backend unreachable; tracking start cancelled.', networkErr.message);
        return { success: false, error: 'Server unavailable. Tracking was not started; please try again when connected.' };
      }

      if (!session || !session.sessionId) {
        return { success: false, error: 'Failed to obtain active tracking session from server.' };
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
      await storage.setItem('trackingStartTime', session.startTime || new Date().toISOString());
      const initialDist = typeof startResponse?.data?.totalDistanceToday === 'number'
        ? startResponse.data.totalDistanceToday.toFixed(2)
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
      let stopSucceeded = false;
      try {
        const response = await trackingApi.stopTracking(sessionId, new Date().toISOString());
        const localAcc = parseFloat(await storage.getItem('tracking_accumulated_distance')) || 0;
        totalDistance = Math.max(Number(response.data?.totalDistance) || 0, localAcc);
        stopSucceeded = true;
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

      // 5. Clean up local secure storage cache ONLY if stop was confirmed by server.
      // If offline, offlineSync will safely clean up storage after the stop item is flushed and confirmed.
      if (stopSucceeded) {
        await storage.removeItem('currentTrackingSessionId');
        await storage.removeItem('trackingStartTime');
        await storage.removeItem('tracking_accumulated_distance');
        await storage.removeItem('tracking_accumulated_session_id');
        await storage.removeItem('last_recorded_location');
      } else {
        console.log('📦 useLocationTracker: Local session metadata preserved until offline sync confirms stop.');
      }
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
      console.error('📍 useLocationTracker: Stop tracking error, safeguarding session queue:', error);
      
      const currentSessionId = await storage.getItem('currentTrackingSessionId');
      if (currentSessionId) {
        await enqueueStop(currentSessionId, new Date().toISOString()).catch(() => {});
      }
      await cancelNoMovementNotification();
      stopHeartbeat();
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
