import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { Platform, PermissionsAndroid, DeviceEventEmitter, Alert, AppState, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';
import { showCustomAlert } from '../components/GlobalAlert';
import { storage } from '../services/storage';
import { trackingApi } from '../services/api';
import socketService from '../services/socket';
import { BACKGROUND_TRACKING_TASK, startHeartbeat, stopHeartbeat, sendHeartbeatNow, detectTrackingFailure, safeRecoverLocation } from '../services/locationTask';
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

const haversineMeters = (lat1, lon1, lat2, lon2) => {
  if (!Number.isFinite(lat1) || !Number.isFinite(lon1) || !Number.isFinite(lat2) || !Number.isFinite(lon2)) return 0;
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

let _globalWatchdogInterval = null;
let _watchdogSubscribers = 0;

export default function useLocationTracker() {
  const [isTracking, setIsTracking] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  // Sync active tracking state and launch Immortal Background Watchdog
  useEffect(() => {
    checkActiveSession();
    cancelNoMovementNotification().catch(() => {});
    
    // Show battery optimization dialog once (first-ever app launch)
    showBatteryOptimizationDialog();
    
    // Listen for global tracking state changes (syncs across multiple hook instances)
    const subscription = DeviceEventEmitter.addListener('TrackingStateChanged', (newState) => {
      setIsTracking(newState);
    });
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        checkActiveSession();
        if (Platform.OS !== 'web') {
          Location.getBackgroundPermissionsAsync().then(({ status }) => {
            if (status === 'granted') setPermissionStatus('granted');
          }).catch(() => {});
        }
      }
    });

    // ─── SINGLETON IMMORTAL TRACKING WATCHDOG (Fires every 15s) ───────────
    // Multi-screen guard: ensures only ONE global timer runs across all screens
    _watchdogSubscribers++;
    if (!_globalWatchdogInterval) {
      console.log('🛡️ [SINGLETON_WATCHDOG] Initialized single global immortal watchdog.');
      _globalWatchdogInterval = setInterval(async () => {
        try {
          const sessionId = await storage.getItem('currentTrackingSessionId');
          if (sessionId) {
            const health = await detectTrackingFailure();
            if (health === 'SERVICE_INTERRUPTED' || health === 'GPS_STALE') {
              console.log(`🔄 Watchdog: Tracking health state [${health}]. Triggering safe recovery...`);
              await safeRecoverLocation(health);
            }
          }
        } catch (_) {}
      }, 15000);
    }
    
    return () => {
      subscription.remove();
      appStateSubscription.remove();
      _watchdogSubscribers = Math.max(0, _watchdogSubscribers - 1);
      if (_watchdogSubscribers === 0 && _globalWatchdogInterval) {
        clearInterval(_globalWatchdogInterval);
        _globalWatchdogInterval = null;
        console.log('🛡️ [SINGLETON_WATCHDOG] Cleared global watchdog interval.');
      }
    };
  }, []);

  const checkActiveSession = async () => {
    try {
      let activeSession = await storage.getItem('currentTrackingSessionId');

      // ─── SELF-HEALING AUTO-START ENGINE ────────────────────────────────────
      // If local storage was cleared or phone rebooted, verify with server if today's shift is active
      if (!activeSession && Platform.OS !== 'web') {
        try {
          const userToken = await storage.getItem('userToken');
          if (userToken) {
            const todayRes = await trackingApi.getTodaySessions();
            if (todayRes.data?.success && Array.isArray(todayRes.data?.sessions)) {
              const liveTodaySession = todayRes.data.sessions.find((s) => s.isActive === true);
              if (liveTodaySession && liveTodaySession.sessionId) {
                console.log('🛡️ [AUTO_HEAL] Active shift found on server. Auto-starting local tracking:', liveTodaySession.sessionId);
                await storage.setItem('currentTrackingSessionId', liveTodaySession.sessionId);
                await storage.setItem('tracking_accumulated_session_id', liveTodaySession.sessionId);
                await storage.setItem('trackingStartTime', liveTodaySession.startTime || new Date().toISOString());
                const serverDist = (Number(liveTodaySession.totalDistance) || 0).toFixed(2);
                await storage.setItem('tracking_accumulated_distance', serverDist);
                activeSession = liveTodaySession.sessionId;
              }
            }
          }
        } catch (healErr) {
          // Best-effort auto-heal
        }
      }

      if (!activeSession) {
        setIsTracking(false);
        // ─── 5-MINUTE CONTINUOUS TRAVEL MOTION AUTO-START ENGINE ─────────────
        // If employee forgot to punch in, monitor for 5 continuous minutes of travel.
        // Captures minute-0 start anchor so 0% distance from the 5-minute trip is lost!
        if (Platform.OS !== 'web' && !isExpoGo) {
          try {
            const userToken = await storage.getItem('userToken');
            if (userToken) {
              const currentPos = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
              });
              if (
                currentPos &&
                currentPos.coords &&
                Number.isFinite(currentPos.coords.latitude) &&
                Number.isFinite(currentPos.coords.longitude)
              ) {
                const now = Date.now();
                const currLat = currentPos.coords.latitude;
                const currLng = currentPos.coords.longitude;
                const currentAcc = currentPos.coords.accuracy || 100;
                const rawSpeedKmh =
                  currentPos.coords.speed && currentPos.coords.speed > 0
                    ? currentPos.coords.speed * 3.6
                    : 0;

                // Read last passive sample
                const lastLatStr = await storage.getItem('passive_last_lat');
                const lastLngStr = await storage.getItem('passive_last_lng');
                const lastTimeStr = await storage.getItem('passive_last_time');

                let movedDistMeters = 0;
                let deltaSpeedKmh = 0;

                if (lastLatStr && lastLngStr && lastTimeStr) {
                  const lastLat = parseFloat(lastLatStr);
                  const lastLng = parseFloat(lastLngStr);
                  const lastTime = parseInt(lastTimeStr, 10);
                  const elapsedSec = (now - lastTime) / 1000;

                  if (elapsedSec >= 5 && elapsedSec <= 120) {
                    movedDistMeters = haversineMeters(lastLat, lastLng, currLat, currLng);
                    deltaSpeedKmh = (movedDistMeters / elapsedSec) * 3.6;
                  }
                }

                // Update passive location checkpoint
                await storage.setItem('passive_last_lat', String(currLat));
                await storage.setItem('passive_last_lng', String(currLng));
                await storage.setItem('passive_last_time', String(now));

                const effectiveSpeedKmh = Math.max(rawSpeedKmh, deltaSpeedKmh);

                // Sustained travel signal: moving >= 5 km/h with >= 15m displacement OR raw GPS speed >= 6 km/h with reasonable accuracy
                const isTravelling =
                  (effectiveSpeedKmh >= 5.0 && movedDistMeters >= 15 && currentAcc <= 200) ||
                  (rawSpeedKmh >= 6.0 && currentAcc <= 150);

                if (isTravelling) {
                  const firstSeenStr = await storage.getItem('passive_motion_first_seen');
                  const firstSeen = firstSeenStr ? parseInt(firstSeenStr, 10) : null;

                  if (!firstSeen) {
                    // First movement observation: start 5-minute countdown and record start anchor
                    await storage.setItem('passive_motion_first_seen', String(now));
                    await storage.setItem('passive_motion_last_seen', String(now));
                    await storage.setItem(
                      'passive_motion_start_coords',
                      JSON.stringify({
                        lat: currLat,
                        lng: currLng,
                        timestamp: new Date(currentPos.timestamp || now).toISOString(),
                      })
                    );
                    console.log(
                      `⏳ [SMART_AUTO_START] Travel detected (${effectiveSpeedKmh.toFixed(1)} km/h, moved ${movedDistMeters.toFixed(0)}m). 5-minute continuous travel countdown started...`
                    );
                  } else {
                    const elapsedMs = now - firstSeen;
                    await storage.setItem('passive_motion_last_seen', String(now));

                    if (elapsedMs >= 5 * 60 * 1000) {
                      // 5 minutes of continuous travel confirmed!
                      console.log(
                        `🚀 [SMART_AUTO_START] 5 minutes of continuous travel confirmed (${(elapsedMs / 60000).toFixed(1)} min at ${effectiveSpeedKmh.toFixed(1)} km/h). Auto-starting duty tracking!`
                      );
                      const startCoordsStr = await storage.getItem('passive_motion_start_coords');
                      let initialCoords = null;
                      try {
                        if (startCoordsStr) initialCoords = JSON.parse(startCoordsStr);
                      } catch (_) {}

                      await storage.removeItem('passive_motion_first_seen');
                      await storage.removeItem('passive_motion_last_seen');
                      await storage.removeItem('passive_motion_start_coords');
                      await storage.removeItem('passive_last_lat');
                      await storage.removeItem('passive_last_lng');
                      await storage.removeItem('passive_last_time');

                      await startTracking('', true, initialCoords);
                      return;
                    } else {
                      console.log(
                        `⏳ [SMART_AUTO_START] Continuous travel in progress: ${(elapsedMs / 60000).toFixed(1)} / 5.0 mins (${effectiveSpeedKmh.toFixed(1)} km/h, moved ${movedDistMeters.toFixed(0)}m)...`
                      );
                    }
                  }
                } else if (effectiveSpeedKmh < 3.0 && movedDistMeters < 10) {
                  // If stationary for > 2.5 minutes, reset the 5-minute countdown
                  const lastSeenStr = await storage.getItem('passive_motion_last_seen');
                  if (lastSeenStr) {
                    const lastSeen = parseInt(lastSeenStr, 10);
                    if (now - lastSeen > 2.5 * 60 * 1000) {
                      await storage.removeItem('passive_motion_first_seen');
                      await storage.removeItem('passive_motion_last_seen');
                      await storage.removeItem('passive_motion_start_coords');
                      console.log(
                        'ℹ️ [SMART_AUTO_START] Stopped for > 2.5 mins before 5-minute threshold. Continuous travel timer reset.'
                      );
                    }
                  }
                }
              }
            }
          } catch (passiveErr) {
            // Best effort
          }
        }
        return;
      }

      if (Platform.OS === 'web') {
        setIsTracking(true);
        return;
      }
      
      // Best-effort server sync & heartbeat ping
      try {
        await sendHeartbeatNow(false);
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
      if (Platform.OS !== 'web' && !isExpoGo) {
        const isTaskRegistered = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TRACKING_TASK).catch(() => false);
        if (!isTaskRegistered) {
          try {
            console.log('🛡️ [IMMORTAL_WATCHDOG] Active session detected in storage but OS task was dead. Auto-resurrecting background GPS task...');
            await Location.startLocationUpdatesAsync(BACKGROUND_TRACKING_TASK, {
              accuracy: Location.Accuracy.BestForNavigation,
              timeInterval: 10000,
              distanceInterval: 0,
              foregroundService: {
                notificationTitle: '🟢 Kisan Team — Duty Active (ON)',
                notificationBody: 'Live distance tracking is running. Tap to open Kisan Team.',
                notificationColor: '#0a3d3c',
                killServiceOnDestroy: false,
              },
              showsBackgroundLocationIndicator: true,
              pausesUpdatesAutomatically: false,
            });
            console.log('🛡️ [IMMORTAL_WATCHDOG] Background GPS task resurrected successfully! ✅');
          } catch (recoverErr) {
            console.log('⚠️ [IMMORTAL_WATCHDOG] Auto-recovery of location task failed:', recoverErr.message);
          }
        }
      }

      // Dual-Layer Redundancy: Active Watchdog position poll to guarantee zero point loss
      if (Platform.OS !== 'web' && !isExpoGo) {
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High, maximumAge: 5000 })
          .then((pos) => {
            if (pos && pos.coords) {
              const locationTaskModule = require('../services/locationTask');
              if (locationTaskModule && typeof locationTaskModule.processLocation === 'function') {
                locationTaskModule.processLocation(pos).catch(() => {});
              }
            }
          }).catch(() => {});
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
  const requestPermissions = async (isAutoStart = false) => {
    try {
      if (!isAutoStart) setLoading(true);
      
      if (Platform.OS === 'web') {
        setPermissionStatus('granted');
        return true;
      }

      // 0. Check if device Location Services (GPS) are turned ON
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        if (!isAutoStart) {
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
        }
        return false;
      }

      // 1. Request notification permission on Android 13+ (API 33+) to keep background task active
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        try {
          const hasNotificationPermission = await PermissionsAndroid.check(
            'android.permission.POST_NOTIFICATIONS'
          );
          if (!hasNotificationPermission && !isAutoStart) {
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
      if (isAutoStart) {
        const { status: currentFgStatus } = await Location.getForegroundPermissionsAsync();
        if (currentFgStatus !== 'granted') return false;
      } else {
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
      }

      // 3. Background Location Permission ("Allow all the time")
      if (!isExpoGo) {
        const { status: currentBgStatus } = await Location.getBackgroundPermissionsAsync();

        if (currentBgStatus !== 'granted') {
          if (isAutoStart) {
            // Background permission must be granted beforehand for auto-start
            return false;
          }

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

      // 4. Camera Permission (Mandatory for Selfie Check-in on manual start)
      if (!isAutoStart) {
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
      }

      setPermissionStatus('granted');
      return true;
    } catch (err) {
      console.error('📍 useLocationTracker: Permission request error:', err);
      return false;
    } finally {
      if (!isAutoStart) setLoading(false);
    }
  };

  /**
   * Start GPS Background Tracking session
   */
  const startTracking = async (selfieUrl = '', isAutoStart = false, initialStartCoords = null) => {
    if (isTracking) return { success: true, message: 'Already tracking.' };

    try {
      setLoading(true);

      // Verify permissions first
      const hasPermission = await requestPermissions(isAutoStart);
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
      // Anchor this shift at initial start location if motion auto-started,
      // preserving distance from the initial detection point.
      const anchorLat = (initialStartCoords && Number.isFinite(Number(initialStartCoords.lat))) ? Number(initialStartCoords.lat) : latitude;
      const anchorLng = (initialStartCoords && Number.isFinite(Number(initialStartCoords.lng))) ? Number(initialStartCoords.lng) : longitude;
      const anchorTs = initialStartCoords?.timestamp || session.startTime || new Date().toISOString();

      await storage.setItem('last_recorded_location', JSON.stringify({
        lat: anchorLat,
        lng: anchorLng,
        speed: 0,
        accuracy: 0,
        timestamp: anchorTs,
      }));
      await storage.setItem('currentTrackingSessionId', sessionId);
      await storage.setItem('tracking_accumulated_session_id', sessionId);
      await storage.setItem('trackingStartTime', anchorTs);
      const initialDist = typeof startResponse?.data?.totalDistanceToday === 'number'
        ? startResponse.data.totalDistanceToday.toFixed(2)
        : '0.00';
      await storage.setItem('tracking_accumulated_distance', initialDist);
      await scheduleNoMovementNotification(sessionId);

      // If motion auto-started with a 5-minute travel segment, immediately upload both points to backend
      if (initialStartCoords && (anchorLat !== latitude || anchorLng !== longitude)) {
        try {
          const backfillCoords = [
            {
              eventId: `${sessionId}:auto:0:${anchorLat.toFixed(6)}:${anchorLng.toFixed(6)}`,
              lat: anchorLat,
              lng: anchorLng,
              speed: 0,
              accuracy: 20,
              timestamp: anchorTs,
              motionState: 'VEHICLE'
            },
            {
              eventId: `${sessionId}:auto:1:${latitude.toFixed(6)}:${longitude.toFixed(6)}`,
              lat: latitude,
              lng: longitude,
              speed: 10,
              accuracy: 20,
              timestamp: new Date().toISOString(),
              motionState: 'VEHICLE'
            }
          ];
          trackingApi.updateLocation(sessionId, backfillCoords).then((res) => {
            if (res.data?.success && typeof res.data.totalDistance === 'number') {
              storage.setItem('tracking_accumulated_distance', String(res.data.totalDistance.toFixed(2)));
            }
          }).catch(() => {});
        } catch (_) {}
      }

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
            // BestForNavigation accuracy forces true hardware GPS chip to remain active
            accuracy: Location.Accuracy.BestForNavigation,

            // Android: poll continuously every 10 seconds without stopping
            timeInterval: 10000,

            // Set distanceInterval to 0 so Android FusedLocationProvider never suppresses callbacks when stopped
            distanceInterval: 0,

            // ── CRITICAL: Android Foreground Service config ────────────────────
            // This is what allows GPS to continue running after the USER swipes the app away.
            // Android requires a visible persistent notification for this — Uber, Ola, Rapido all do this.
            foregroundService: {
              notificationTitle: '🟢 Kisan Team — Duty Active (ON)',
              notificationBody: 'Live distance tracking is running. Tap to open Kisan Team.',
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
          console.warn('⚠️ useLocationTracker: Background TaskManager registration deferred, watchdog/foreground engine will recover:', taskErr.message);
          // Zero Data Loss Policy: NEVER auto-rollback or cancel active shift. Keep session in storage.
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
        // Fallback: stop task if registered (Mobile native only)
        if (Platform.OS !== 'web' && !isExpoGo) {
          try {
            const isRegistered = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TRACKING_TASK).catch(() => false);
            if (isRegistered) {
              await Location.stopLocationUpdatesAsync(BACKGROUND_TRACKING_TASK).catch(() => {});
            }
          } catch (_) {}
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
            const confirmedDist = Number(finalResponse.data.totalDistance) || 0;
            await storage.setItem('tracking_accumulated_distance', String(confirmedDist));
          }
        } catch (finalErr) {
          console.log('⚠️ useLocationTracker: Final coordinate upload deferred:', finalErr.message);
          const previousLocation = await storage.getItem('last_recorded_location');
          await enqueueCoordinate(sessionId, finalCoordinate, previousLocation ? JSON.parse(previousLocation) : null);
        }
      }

      // 2. Stop native TaskManager location feeds
      if (Platform.OS !== 'web' && !isExpoGo) {
        try {
          const isRegistered = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TRACKING_TASK).catch(() => false);
          if (isRegistered) {
            await Location.stopLocationUpdatesAsync(BACKGROUND_TRACKING_TASK).catch(() => {});
          }
        } catch (_) {}
      }

      // 3. Stop backend session via REST API
      let totalDistance = 0;
      let stopSucceeded = false;
      try {
        const response = await trackingApi.stopTracking(sessionId, new Date().toISOString());
        const localAcc = parseFloat(await storage.getItem('tracking_accumulated_distance')) || 0;
        totalDistance = typeof response.data?.totalDistance === 'number' ? response.data.totalDistance : localAcc;
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
      if (Platform.OS !== 'web' && !isExpoGo) {
        try {
          await Location.stopLocationUpdatesAsync(BACKGROUND_TRACKING_TASK).catch(() => {});
        } catch {}
      }
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
