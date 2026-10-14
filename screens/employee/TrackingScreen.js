import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, View, ScrollView, TouchableOpacity, 
  ActivityIndicator, Alert, Platform, Dimensions, Linking, AppState 
} from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Navigation, Clock, Play, Square, MapPin, 
  Bus, Activity, RefreshCw, Compass, ChevronRight, Zap, Info
} from 'lucide-react-native';
import useLocationTracker from '../../hooks/useLocationTracker';
import { storage } from '../../services/storage';
import { trackingAPI as trackingApi } from '../../services/api';
import { processLocation } from '../../services/locationTask';
import { enqueueCoordinate, flushOfflineQueue } from '../../services/offlineSync';
import { openBatteryOptimizationSettings } from '../../services/batteryOptimization';
import * as Location from 'expo-location';
import MapViewComponent from '../../components/MapViewComponent';
import { cleanTrackingRoute } from '../../utils/trackingRoute';
import socketService from '../../services/socket';

const { width } = Dimensions.get('window');
const DEFAULT_MAP_REGION = {
  latitude: 26.797531,
  longitude: 80.901868,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
};

// 📏 Haversine distance in meters helper for precise movement detection
const haversineMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// 🧮 2D LatLng Extended Kalman Filter (EKF) with Adaptive Coarse-Accuracy Gain
// Prevents Acc:200m (cell/network/pocket GPS) from freezing position while smoothing indoor jitter
class LatLngKalmanFilter {
  constructor() {
    this.lat = 0;
    this.lng = 0;
    this.variance = -1;
    this.lastTimestampMs = 0;
  }

  process(lat, lng, accuracyM, timestampMs) {
    const clampedAcc = Math.min(Math.max(accuracyM || 15, 5), 35);
    if (this.variance < 0 || !this.lat || !this.lng) {
      this.lat = lat;
      this.lng = lng;
      this.variance = Math.pow(clampedAcc / 111320, 2);
      this.lastTimestampMs = timestampMs;
      return { lat, lng };
    }

    const dt = Math.max(0.5, (timestampMs - this.lastTimestampMs) / 1000);
    this.lastTimestampMs = timestampMs;

    const rawDispM = haversineMeters(this.lat, this.lng, lat, lng);
    const Q = (rawDispM >= 20 ? 0.0000008 : 0.0000001) * Math.min(dt, 15);
    const predVariance = this.variance + Q;
    const R = Math.pow(clampedAcc / 111320, 2);

    let K = predVariance / (predVariance + R);
    if (rawDispM >= 22) {
      K = Math.max(K, 0.82); // Instant responsiveness on real physical displacement >= 22m
    }
    this.lat = this.lat + K * (lat - this.lat);
    this.lng = this.lng + K * (lng - this.lng);
    this.variance = (1 - K) * predVariance;

    return { lat: this.lat, lng: this.lng };
  }

  reset() {
    this.variance = -1;
  }
}

export default function ActiveShiftMapScreen() {
  const { 
    isTracking, loading, startTracking, stopTracking 
  } = useLocationTracker();

  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const [latitude, setLatitude] = useState('26.797531');
  const [longitude, setLongitude] = useState('80.901868');
  const [address, setAddress] = useState(
    'Operational tracking inactive. Press START to begin shift.'
  );
  const [speed, setSpeed] = useState('0');
  const [distance, setDistance] = useState('0.00');
  const [transportMode, setTransportMode] = useState('PUBLIC TRANSPORT'); // PUBLIC TRANSPORT, WALKING, DRIVING
  const [routeCoords, setRouteCoords] = useState([]);
  
  // 🎯 Dynamic Motion State & Coordinate Engine state
  const [isMoving, setIsMoving] = useState(false);
  const isMovingRef = useRef(false);
  const [motionStatusLabel, setMotionStatusLabel] = useState('STATIONARY');
  
  const timerRef = useRef(null);
  const locationIntervalRef = useRef(null);
  const totalDistanceRef = useRef(0.0);
  const lastCoordRef = useRef(null);

  // Reference anchors for stationary micro-geofencing & movement accumulation
  const lastConfirmedCoordRef = useRef(null);
  const stationaryAnchorRef = useRef(null);
  const lastCapturedRawCoordRef = useRef(null);
  const departureBufferRef = useRef([]);

  // ⏱️ Dynamic 30-Minute Baseline & 1-Minute Coordinate Verification Engine
  // User: "ek baar dono lati , or longi ka digit store ker lo then her minut per verify kro same are not"
  // "Es lati , or longi ko const fix nhi store karna every 30minut per update new lati , or longi se conpare karna same are not"
  const baselineCoordRef = useRef({
    lat: 0,
    lng: 0,
    updatedAt: 0,
    lastVerifiedAt: 0,
    isSame: true,
  });

  // Smart Address Caching Ref & Persistent Zero-Drop Coordinate Outbox
  const lastGeocodedCoordRef = useRef(null);
  const lastGeocodedAddressRef = useRef('');
  const lastScreenServerPushRef = useRef({ lat: 0, lng: 0, address: '', ts: 0 });
  const screenOutboxRef = useRef([]);
  const isFlushingOutboxRef = useRef(false);
  const hasHydratedAnchorRef = useRef(false);

  // Extended Kalman Filter instance ref for continuous smoothing
  const kalmanRef = useRef(new LatLngKalmanFilter());

  // 🔋 Battery Optimization Whitelist Banner & Hardware GPS Pulse Ref
  const [showBatteryOptBanner, setShowBatteryOptBanner] = useState(Platform.OS === 'android');
  const fetchLiveCoordsRef = useRef(null);
  const [isForcingSync, setIsForcingSync] = useState(false);

  const handleForceGpsSync = async () => {
    if (isForcingSync) return;
    setIsForcingSync(true);
    try {
      console.log('⚡ [FORCE_GPS_SYNC] User tapped Re-Sync GPS button...');
      if (typeof fetchLiveCoordsRef.current === 'function') {
        await fetchLiveCoordsRef.current();
      } else {
        const freshPos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
          maximumAge: 1000,
        }).catch(() => Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        if (freshPos) {
          await handleCoordinateFix(freshPos);
        }
      }
      await flushScreenOutbox();
      await flushOfflineQueue();
    } catch (syncErr) {
      console.log('⚡ [FORCE_GPS_SYNC] Error:', syncErr.message);
    } finally {
      setTimeout(() => setIsForcingSync(false), 1200);
    }
  };

  // 1. Timer logic to track duration
  useEffect(() => {
    if (isTracking) {
      // Clear any legacy timers
      if (timerRef.current) clearInterval(timerRef.current);

      const updateTimer = async () => {
        try {
          const startTimeStr = await storage.getItem('trackingStartTime');
          if (startTimeStr) {
            const startMs = new Date(startTimeStr).getTime();
            const nowMs = Date.now();
            const diffSecs = Math.max(0, Math.floor((nowMs - startMs) / 1000));
            
            const hrs = String(Math.floor(diffSecs / 3600)).padStart(2, '0');
            const mins = String(Math.floor((diffSecs % 3600) / 60)).padStart(2, '0');
            const secs = String(diffSecs % 60).padStart(2, '0');
            
            setElapsedTime(`${hrs}:${mins}:${secs}`);
            
            // Distance and speed are driven solely by actual physical movement (Haversine GPS telemetry)
            // No default simulated timer increments
          }
        } catch (e) {
          console.log('📍 Tracking Screen: Timer calculations failed', e);
        }
      };

      updateTimer();
      timerRef.current = setInterval(updateTimer, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsedTime('00:00:00');
      setDistance('0.00');
      setSpeed('0');
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTracking, transportMode]);

  // ── Persistent Zero-Drop Screen Coordinate Outbox Flusher ──────────────────
  const enqueueAndFlushScreenCoord = async (coordPayload, currentAddr) => {
    try {
      if (coordPayload && coordPayload.eventId) {
        const exists = screenOutboxRef.current.some((c) => c.eventId === coordPayload.eventId);
        if (!exists) {
          screenOutboxRef.current = [...screenOutboxRef.current.slice(-99), coordPayload];
          await storage.setItem('tracking_screen_coord_outbox', JSON.stringify(screenOutboxRef.current)).catch(() => {});
        }
      }
      await flushScreenOutbox(currentAddr);
    } catch (_) {}
  };

  const flushScreenOutbox = async (overrideAddress = '') => {
    if (isFlushingOutboxRef.current) return;
    isFlushingOutboxRef.current = true;
    try {
      if (screenOutboxRef.current.length === 0) {
        const savedOutboxStr = await storage.getItem('tracking_screen_coord_outbox');
        if (savedOutboxStr) {
          const parsed = JSON.parse(savedOutboxStr);
          if (Array.isArray(parsed) && parsed.length > 0) {
            screenOutboxRef.current = parsed;
          }
        }
      }
      if (screenOutboxRef.current.length === 0) return;

      const manuallyOut = await storage.getItem('user_manually_punched_out');
      if (manuallyOut === 'true') {
        screenOutboxRef.current = [];
        await storage.removeItem('tracking_screen_coord_outbox').catch(() => {});
        return;
      }

      let activeSessionId = await storage.getItem('currentTrackingSessionId');
      if (!activeSessionId) {
        activeSessionId = 'AUTO_RECOVER_SESSION';
      }

      const batchToSend = [...screenOutboxRef.current];
      const sentEventIds = new Set(batchToSend.map((c) => c.eventId));
      const resolvedAddr = overrideAddress || lastGeocodedAddressRef.current || '';

      const res = await trackingApi.update({
        sessionId: activeSessionId,
        coordinates: batchToSend,
        currentAddress: resolvedAddr,
      });

      if (res?.data?.success) {
        if (res.data.sessionId && (activeSessionId === 'AUTO_RECOVER_SESSION' || res.data.sessionId !== activeSessionId)) {
          await storage.setItem('currentTrackingSessionId', res.data.sessionId).catch(() => {});
          await storage.setItem('tracking_accumulated_session_id', res.data.sessionId).catch(() => {});
          await storage.setItem('isTrackingActive', 'true').catch(() => {});
        }

        // Remove ACKed coordinates from persistent outbox
        screenOutboxRef.current = screenOutboxRef.current.filter((c) => !sentEventIds.has(c.eventId));
        await storage.setItem('tracking_screen_coord_outbox', JSON.stringify(screenOutboxRef.current)).catch(() => {});

        const srvDist = Number(res?.data?.totalDistanceToday ?? res?.data?.totalDistance);
        if (Number.isFinite(srvDist) && srvDist > totalDistanceRef.current) {
          totalDistanceRef.current = srvDist;
          const dStr = srvDist.toFixed(2);
          setDistance(dStr);
          await storage.setItem('tracking_accumulated_distance', dStr).catch(() => {});
        }
      }
    } catch (flushErr) {
      // Network drop or timeout: screenOutboxRef retains coordinates for the next 15s retry cycle.
      // No duplicate queue dumping needed.
    } finally {
      isFlushingOutboxRef.current = false;
    }
  };

  // 1.5. Local Cache & AppState Sync for Active Tracking Session Distance
  useEffect(() => {
    let appStateSubscription = null;
    let syncInterval = null;

    const loadLocalCachedDistance = async () => {
      try {
        const sessionId = await storage.getItem('currentTrackingSessionId');
        const cachedDist = await storage.getItem('tracking_accumulated_distance');
        if (cachedDist) {
          const parsed = parseFloat(cachedDist) || 0.0;
          if (parsed > 0 || sessionId) {
            totalDistanceRef.current = Math.max(totalDistanceRef.current || 0, parsed);
            setDistance(totalDistanceRef.current.toFixed(2));
            console.log('📍 Tracking Screen: Initialized distance from local cache:', totalDistanceRef.current);
          }
        }
        const cachedAddr = await storage.getItem('last_actual_address');
        if (cachedAddr && !lastGeocodedAddressRef.current) {
          lastGeocodedAddressRef.current = cachedAddr;
          setAddress(cachedAddr);
        }
        const lastLocStr = await storage.getItem('last_recorded_location');
        if (lastLocStr) {
          try {
            const lastLoc = JSON.parse(lastLocStr);
            if (Number.isFinite(Number(lastLoc?.lat)) && Number.isFinite(Number(lastLoc?.lng))) {
              setLatitude(Number(lastLoc.lat).toFixed(6));
              setLongitude(Number(lastLoc.lng).toFixed(6));
              if (!lastConfirmedCoordRef.current) {
                lastConfirmedCoordRef.current = { lat: Number(lastLoc.lat), lng: Number(lastLoc.lng), timestamp: Date.now() };
                stationaryAnchorRef.current = { lat: Number(lastLoc.lat), lng: Number(lastLoc.lng) };
              }
            }
          } catch (_) {}
        }
      } catch (err) {
        console.log('📍 Tracking Screen: Failed to load cached distance:', err);
      }
    };

    const syncDistanceWithBackend = async () => {
      try {
        const token = await storage.getItem('userToken') || await storage.getItem('token');
        if (!token) return;

        // Step A: Flush any pending screen outbox coordinates & offline queue first
        await flushScreenOutbox().catch(() => {});
        flushOfflineQueue().catch(() => {});

        const response = await trackingApi.getTodaySessions();
        if (response && response.data && response.data.success) {
          const totalToday = typeof response.data.totalDistanceToday === 'number'
            ? response.data.totalDistanceToday
            : null;

          let sessionId = await storage.getItem('currentTrackingSessionId');
          const activeSession = sessionId
            ? response.data.sessions.find(s => s.sessionId === sessionId) || response.data.sessions.find(s => s.isActive)
            : response.data.sessions.find(s => s.isActive) || response.data.sessions[0];

          if (activeSession?.sessionId && activeSession?.isActive) {
            sessionId = activeSession.sessionId;
            await storage.setItem('currentTrackingSessionId', sessionId);
            await storage.setItem('tracking_accumulated_session_id', sessionId);
            await storage.setItem('isTrackingActive', 'true');
            await storage.removeItem('user_manually_punched_out');
          }

          let backendDistance = parseFloat(activeSession?.totalDistance) || 0.0;
          let currentLocal = totalDistanceRef.current || 0.0;

          // 🛣️ POINT A TO POINT B ROAD GAP AUTO-RECOVERY:
          // If both local and backend show 0 KM, but session started at Point A and current screen is at Point B (>= 1.5 KM):
          const startPt = activeSession?.coordinates && activeSession.coordinates.length > 0 ? activeSession.coordinates[0] : null;
          if (backendDistance === 0 && currentLocal === 0 && startPt && lastCoordRef.current?.lat && lastCoordRef.current?.lng) {
            const straightGapKm = haversineMeters(startPt.lat, startPt.lng, lastCoordRef.current.lat, lastCoordRef.current.lng) / 1000;
            if (straightGapKm >= 1.5) {
              const roadGapKm = Math.round(straightGapKm * 1.20 * 100) / 100;
              currentLocal = roadGapKm;
              console.log(`🛣️ [SCREEN_ROAD_GAP] Recovered ${roadGapKm} KM road distance from start Point A to current Point B`);
            }
          }

          // Synchronized Distance: Use maximum of local screen and backend distance (strictly non-decreasing)
          const synchronizedDistance = Math.max(currentLocal, backendDistance);

          console.log('📍 Tracking Screen: Synchronized distance with backend:', synchronizedDistance);
          totalDistanceRef.current = synchronizedDistance;
          const distStr = synchronizedDistance.toFixed(2);
          setDistance(distStr);
          await storage.setItem('tracking_accumulated_distance', distStr);

          // Step B: Continuous Screen Coordinate & Distance Sync to Backend
          // User: "tracking screen se location / coordinate sync kro and then calculate Km show emp page"
          // Syncs the screen's live GPS coordinate to server so backend is 100% updated with screen:
          if (sessionId && lastCoordRef.current?.lat && lastCoordRef.current?.lng) {
            const nowTs = Date.now();
            const syncEventId = `${sessionId}:sync:${nowTs}:${lastCoordRef.current.lat.toFixed(6)}:${lastCoordRef.current.lng.toFixed(6)}`;
            await enqueueAndFlushScreenCoord({
              eventId: syncEventId,
              lat: lastCoordRef.current.lat,
              lng: lastCoordRef.current.lng,
              speed: isMovingRef.current ? (Number(speed) ? Number(speed) / 3.6 : 1.5) : 0,
              accuracy: 20,
              heading: 0,
              mocked: false,
              timestamp: new Date(nowTs).toISOString(),
              address: lastGeocodedAddressRef.current || '',
              motionState: isMovingRef.current ? 'WALKING' : 'STATIONARY',
              screenCaptured: true,
              screenMoving: isMovingRef.current,
              screenDistanceKm: Number(totalDistanceRef.current.toFixed(3)),
            }, lastGeocodedAddressRef.current || '');
          }
        }
      } catch (err) {
        console.log('📍 Tracking Screen: Failed to sync distance with backend:', err);
      }
    };

    let activeSocket = null;

    if (isTracking) {
      // Step 1: Load cache immediately on mount / when tracking becomes active
      loadLocalCachedDistance().then(() => {
        // Step 2: Proactively sync with backend once (online check)
        syncDistanceWithBackend();
      });

      // Step 3: Real-time WebSocket listener for calculated distance from backend
      socketService.connect().then((sock) => {
        if (!sock) return;
        activeSocket = sock;
        activeSocket.on('employee_location', (payload) => {
          if (!payload) return;
          const incomingKm = parseFloat(payload.sessionDistance || payload.totalDistance);
          if (!isNaN(incomingKm) && incomingKm >= 0) {
            const newKm = Math.max(totalDistanceRef.current || 0, incomingKm);
            totalDistanceRef.current = newKm;
            setDistance(newKm.toFixed(2));
            storage.setItem('tracking_accumulated_distance', newKm.toFixed(2)).catch(() => {});
          }
          if (payload.speed !== undefined) {
            setSpeed(String(payload.speed));
          }
          if (payload.motionState) {
            setMotionStatusLabel(payload.motionState);
          }
          if (payload.address && !lastGeocodedAddressRef.current) {
            setAddress(payload.address);
          }
        });
      }).catch(() => {});

      // Step 4: Set 15-second polling interval for backup reconciliation & outbox flush
      syncInterval = setInterval(() => {
        syncDistanceWithBackend();
      }, 15000);

      // Step 5: Register AppState listener to flush outbox when backgrounding and sync when returning to foreground
      appStateSubscription = AppState.addEventListener('change', async (nextAppState) => {
        if (nextAppState === 'active') {
          console.log('📍 Tracking Screen: App returned to active foreground. Syncing distance telemetry...');
          await loadLocalCachedDistance();
          await syncDistanceWithBackend();
        } else if (nextAppState === 'background' || nextAppState === 'inactive') {
          await flushScreenOutbox().catch(() => {});
        }
      });
    } else {
      // When not tracking, display today's total distance if available instead of resetting to 0.00
      (async () => {
        try {
          const token = await storage.getItem('userToken') || await storage.getItem('token');
          if (!token) {
            totalDistanceRef.current = 0.0;
            setDistance('0.00');
            return;
          }
          const response = await trackingApi.getTodaySessions();
          if (response?.data?.success && typeof response.data.totalDistanceToday === 'number') {
            const todayDist = response.data.totalDistanceToday;
            totalDistanceRef.current = todayDist;
            setDistance(todayDist.toFixed(2));
          } else {
            totalDistanceRef.current = 0.0;
            setDistance('0.00');
          }
        } catch {
          totalDistanceRef.current = 0.0;
          setDistance('0.00');
        }
      })();
    }

    return () => {
      if (activeSocket) {
        activeSocket.off('employee_location');
      }
      if (appStateSubscription) {
        appStateSubscription.remove();
      }
      if (syncInterval) {
        clearInterval(syncInterval);
      }
    };
  }, [isTracking]);

  // ⏱️ 1-Minute Cadence Coordinate Verification Timer against 30-Minute Dynamic Baseline
  // User: "ek baar dono lati , or longi ka digit store ker lo then her minut per verify kro same are not"
  // "Es lati , or longi ko const fix nhi store karna every 30minut per update new lati , or longi se conpare karna same are not"
  useEffect(() => {
    if (!isTracking) return;

    const minuteVerifyInterval = setInterval(() => {
      const curLat = lastCoordRef.current?.lat;
      const curLng = lastCoordRef.current?.lng;
      const base = baselineCoordRef.current;

      if (curLat && curLng && base.updatedAt > 0) {
        const dM = haversineMeters(base.lat, base.lng, curLat, curLng);
        // 🎯 50-METER DYNAMIC RADIUS GEOFENCE (User Requirement: "50 miter ka radia like yesa kuch")
        // If current coordinate is within 50 meters of dynamic baseline anchor:
        // Employee is STATIONARY at this spot!
        const isSame = dM <= 50.0;
        base.lastVerifiedAt = Date.now();
        base.isSame = isSame;

        console.log(`⏱️ [1-MIN 50M RADIUS VERIFY] Status: ${isSame ? 'SAME (INSIDE 50M RADIUS - 0.000 KM)' : 'NOT SAME (DEPARTURE DETECTED)'} | Dist: ${dM.toFixed(1)}m / 50m max`);

        if (isSame && !isMovingRef.current) {
          // Inside spot radius while already stationary: maintain STATIONARY and speed 0
          setMotionStatusLabel('STATIONARY');
          setSpeed('0');
          if (dM < 15.0) {
            departureBufferRef.current = [];
          }
        }

        // Renew baseline every 30 minutes dynamically (not hardcoded constant)
        if (Date.now() - base.updatedAt >= 30 * 60 * 1000) {
          console.log(`⏱️ [30-MIN BASELINE RENEWED] Updating baseline coordinates to [${curLat.toFixed(6)}, ${curLng.toFixed(6)}]`);
          baselineCoordRef.current = {
            lat: curLat,
            lng: curLng,
            updatedAt: Date.now(),
            lastVerifiedAt: Date.now(),
            isSame: true,
          };
        }
      }
    }, 60000);

    return () => clearInterval(minuteVerifyInterval);
  }, [isTracking]);

  // 2. Real-time Location telemetry updates (Tri-Channel: Hardware watchPositionAsync + 4s Active Poll + Persistent Outbox)
  useEffect(() => {
    let watchSubscription = null;

    if (isTracking) {
      const handleCoordinateFix = async (position) => {
        try {
          if (position && position.coords) {
            const { latitude: rawLat, longitude: rawLng, speed: mps, accuracy: acc } = position.coords;
            const fixTsMs = position.timestamp || Date.now();
            
            // 🛡️ GATE 1: IDENTICAL & MICRO-JITTER SUPPRESSION FILTER
            // User: "validate kro pahle same coordinate to nhi aa raha h baar baar : then server ko bhejo"
            // If the same coordinate (or within 2 meters) arrives repeatedly, exit immediately!
            const rawDistFromPrevM = lastCapturedRawCoordRef.current
              ? haversineMeters(lastCapturedRawCoordRef.current.lat, lastCapturedRawCoordRef.current.lng, rawLat, rawLng)
              : 999;

            if (rawDistFromPrevM < 0.5 && !isMovingRef.current && lastCapturedRawCoordRef.current) {
              setLatitude(rawLat.toFixed(6));
              setLongitude(rawLng.toFixed(6));
              return;
            }
            lastCapturedRawCoordRef.current = { lat: rawLat, lng: rawLng, ts: fixTsMs };

            // 🧮 Process raw fix through Adaptive 2D Extended Kalman Filter
            const smoothed = kalmanRef.current.process(rawLat, rawLng, acc, fixTsMs);
            const lat = smoothed.lat;
            const lng = smoothed.lng;

            setLatitude(lat.toFixed(6));
            setLongitude(lng.toFixed(6));

            // Hardware Doppler speed (m/s -> km/h) with noise floor filtering
            const rawSpeedKmh = Number.isFinite(mps) && mps > 0.5 ? Math.round(mps * 3.6) : 0;

            // 🔄 HYDRATE PREVIOUS MOTION ANCHOR ACROSS TAB SWITCHES / SCREEN REMOUNTS:
            if (!lastConfirmedCoordRef.current && !hasHydratedAnchorRef.current) {
              hasHydratedAnchorRef.current = true;
              try {
                const activeSid = await storage.getItem('currentTrackingSessionId');
                const savedMotionStr = await storage.getItem('tracking_screen_motion_state');
                if (savedMotionStr) {
                  const savedMotion = JSON.parse(savedMotionStr);
                  if (savedMotion && (!activeSid || savedMotion.sessionId === activeSid) && savedMotion.lastConfirmedCoord?.lat) {
                    lastConfirmedCoordRef.current = savedMotion.lastConfirmedCoord;
                    stationaryAnchorRef.current = savedMotion.stationaryAnchor || savedMotion.lastConfirmedCoord;
                    isMovingRef.current = Boolean(savedMotion.isMoving);
                    setIsMoving(isMovingRef.current);
                    setMotionStatusLabel(isMovingRef.current ? 'MOVING' : 'STATIONARY');
                  }
                }
              } catch (_) {}
            }

            let isInitialScreenFix = false;
            let didConfirmStep = false;

            // 🎯 ADVANCED CONSENSUS VERIFICATION ENGINE:
            if (!stationaryAnchorRef.current) {
              stationaryAnchorRef.current = { lat, lng };
            }

            if (!lastConfirmedCoordRef.current) {
              isInitialScreenFix = true;
              lastConfirmedCoordRef.current = { lat, lng, timestamp: fixTsMs };
              stationaryAnchorRef.current = { lat, lng };
              departureBufferRef.current = [];
              isMovingRef.current = false;
              setIsMoving(false);
              setMotionStatusLabel('STATIONARY');
              setSpeed('0');

              // 🛣️ INITIAL SCREEN FIX ROAD GAP AUTO-RECOVERY:
              // If employee traveled while screen was closed/backgrounded, recover road distance immediately:
              try {
                const prevLocStr = await storage.getItem('last_recorded_location');
                if (prevLocStr) {
                  const prevLoc = JSON.parse(prevLocStr);
                  if (prevLoc && prevLoc.lat && prevLoc.lng) {
                    const jumpM = haversineMeters(prevLoc.lat, prevLoc.lng, lat, lng);
                    if (jumpM >= 25 && jumpM <= 150000) {
                      const curveFactor = jumpM >= 1000 ? 1.18 : 1.04;
                      const roadKm = Math.round((jumpM / 1000) * curveFactor * 100) / 100;
                      totalDistanceRef.current += roadKm;
                      const dStr = totalDistanceRef.current.toFixed(2);
                      setDistance(dStr);
                      await storage.setItem('tracking_accumulated_distance', dStr).catch(() => {});
                      console.log(`🛣️ [INITIAL_ROAD_GAP_RECOVERY] Recovered ${roadKm} KM from previous anchor to initial screen fix!`);
                    }
                  }
                }
              } catch (_) {}

              // ⏱️ Initialize 30-Minute Dynamic Baseline
              baselineCoordRef.current = {
                lat,
                lng,
                updatedAt: fixTsMs,
                lastVerifiedAt: fixTsMs,
                isSame: true,
              };
            } else {
              // ⏱️ Dynamic 30-Minute Baseline Renewal Check on live fix:
              if (baselineCoordRef.current.updatedAt === 0) {
                baselineCoordRef.current = {
                  lat,
                  lng,
                  updatedAt: fixTsMs,
                  lastVerifiedAt: fixTsMs,
                  isSame: true,
                };
              } else if (isMovingRef.current) {
                baselineCoordRef.current = {
                  lat,
                  lng,
                  updatedAt: fixTsMs,
                  lastVerifiedAt: fixTsMs,
                  isSame: false,
                };
              } else if (fixTsMs - baselineCoordRef.current.updatedAt >= 30 * 60 * 1000) {
                // Only renew baseline coordinate if currently stationary or arriving at new spot
                if (!isMovingRef.current) {
                  console.log(`⏱️ [30-MIN BASELINE RENEWED] Updating stationary baseline coordinates to [${lat.toFixed(6)}, ${lng.toFixed(6)}]`);
                  baselineCoordRef.current = {
                    lat,
                    lng,
                    updatedAt: fixTsMs,
                    lastVerifiedAt: fixTsMs,
                    isSame: true,
                  };
                }
              }

              // 🎯 20-METER DYNAMIC SPOT RADIUS CHECK (Zero Fake KM while Stationary)
              const distFromBaselineM = haversineMeters(
                baselineCoordRef.current.lat,
                baselineCoordRef.current.lng,
                lat,
                lng
              );
              const isBaselineSame = distFromBaselineM <= 20.0;

              if (fixTsMs - baselineCoordRef.current.lastVerifiedAt >= 60 * 1000) {
                baselineCoordRef.current.lastVerifiedAt = fixTsMs;
                baselineCoordRef.current.isSame = isBaselineSame;
              }

              const distFromAnchorM = haversineMeters(
                stationaryAnchorRef.current.lat,
                stationaryAnchorRef.current.lng,
                lat,
                lng
              );
              const distFromLastM = haversineMeters(
                lastConfirmedCoordRef.current.lat,
                lastConfirmedCoordRef.current.lng,
                lat,
                lng
              );
              const timeDiffSecs = Math.max(0.5, (fixTsMs - (lastConfirmedCoordRef.current.timestamp || fixTsMs)) / 1000);
              const calculatedSpeedKmh = (distFromLastM / 1000) / (timeDiffSecs / 3600);

              if (!isMovingRef.current) {
                // 🛑 CURRENT STATE: STATIONARY (Employee is stopped at desk, home, or office)
                // True stationary check: within 10m of anchor AND speed < 1.5 km/h:
                const isWithinStationarySpot = distFromAnchorM < 10.0 && rawSpeedKmh < 1.5 && calculatedSpeedKmh < 2.0;

                if (isWithinStationarySpot) {
                  // Inside stationary spot: Zero distance added!
                  isMovingRef.current = false;
                  setIsMoving(false);
                  setMotionStatusLabel('STATIONARY');
                  setSpeed('0');
                  departureBufferRef.current = [];
                  lastCoordRef.current = { lat, lng };
                } else if (distFromAnchorM >= 12.0 || rawSpeedKmh >= 1.5 || calculatedSpeedKmh >= 2.0) {
                  // 🚗 DEPARTURE CONFIRMED: Employee stepped out or started riding/driving!
                  isMovingRef.current = true;
                  didConfirmStep = true;
                  setIsMoving(true);
                  setMotionStatusLabel('MOVING');

                  const travelSpeedKmh = Math.max(rawSpeedKmh, Math.round(calculatedSpeedKmh), 3);
                  setSpeed(Math.min(travelSpeedKmh, 120).toString());

                  const departureDistanceKm = distFromAnchorM / 1000;
                  if (departureDistanceKm >= 0.010 && departureDistanceKm <= 150.0) {
                    const roadFactor = departureDistanceKm >= 1.0 ? 1.18 : (travelSpeedKmh >= 8.0 ? 1.04 : 1.0);
                    const finalDepartureKm = Math.round(departureDistanceKm * roadFactor * 1000) / 1000;
                    totalDistanceRef.current += finalDepartureKm;
                    const dStr = totalDistanceRef.current.toFixed(2);
                    setDistance(dStr);
                    storage.setItem('tracking_accumulated_distance', dStr).catch(() => {});
                    console.log(`📍 TrackingScreen: Movement departure confirmed! +${finalDepartureKm.toFixed(3)} km, total: ${dStr} km`);
                  }

                  stationaryAnchorRef.current = { lat, lng };
                  lastConfirmedCoordRef.current = { lat, lng, timestamp: fixTsMs };
                  departureBufferRef.current = [];

                  setRouteCoords((previous) => cleanTrackingRoute([...previous, {
                    latitude: lat,
                    longitude: lng,
                    timestamp: fixTsMs,
                  }]).slice(-600));
                }
              } else {
                // 🚗 CURRENT STATE: MOVING ON ROAD
                // Only transition back to STATIONARY if prolonged stop (>= 45s) with zero movement
                if (rawSpeedKmh < 1.5 && distFromLastM < 5.0 && timeDiffSecs >= 45.0) {
                  isMovingRef.current = false;
                  setIsMoving(false);
                  setMotionStatusLabel('STATIONARY');
                  setSpeed('0');
                  stationaryAnchorRef.current = { lat, lng };
                  lastConfirmedCoordRef.current = { lat, lng, timestamp: fixTsMs };
                  departureBufferRef.current = [];
                  baselineCoordRef.current = {
                    lat,
                    lng,
                    updatedAt: fixTsMs,
                    lastVerifiedAt: fixTsMs,
                    isSame: true,
                  };
                } else if (distFromLastM >= 5.0 && distFromLastM <= 2500) {
                  if (calculatedSpeedKmh <= 160.0) {
                    didConfirmStep = true;
                    let addedKm = distFromLastM / 1000;
                    if ((rawSpeedKmh >= 8.0 || calculatedSpeedKmh >= 8.0) && distFromLastM >= 20.0) {
                      addedKm = Math.round(addedKm * 1.04 * 1000) / 1000;
                    }
                    totalDistanceRef.current += addedKm;
                    const dStr = totalDistanceRef.current.toFixed(2);
                    setDistance(dStr);
                    storage.setItem('tracking_accumulated_distance', dStr).catch(() => {});

                    const travelSpeedKmh = Math.max(rawSpeedKmh, Math.round(calculatedSpeedKmh));
                    setSpeed(Math.max(3, Math.round(Math.min(travelSpeedKmh, 120))).toString());

                    stationaryAnchorRef.current = { lat, lng };
                    lastConfirmedCoordRef.current = { lat, lng, timestamp: fixTsMs };

                    setRouteCoords((previous) => cleanTrackingRoute([...previous, {
                      latitude: lat,
                      longitude: lng,
                      timestamp: fixTsMs,
                    }]).slice(-600));
                  }
                } else if (distFromLastM > 2500 && (calculatedSpeedKmh <= 160.0 || timeDiffSecs >= 90.0)) {
                  // 🚗 Highway / Pocket Sleep Gap (> 2.5 KM)
                  didConfirmStep = true;
                  const curveFactor = 1.18; // Realistic Indian road winding factor
                  const addedKm = Math.round((distFromLastM / 1000) * curveFactor * 100) / 100;
                  totalDistanceRef.current += addedKm;
                  const dStr = totalDistanceRef.current.toFixed(2);
                  setDistance(dStr);
                  storage.setItem('tracking_accumulated_distance', dStr).catch(() => {});

                  const travelSpeedKmh = Math.max(rawSpeedKmh, Math.round(calculatedSpeedKmh));
                  setSpeed(Math.max(15, Math.min(travelSpeedKmh, 100)).toString());

                  stationaryAnchorRef.current = { lat, lng };
                  lastConfirmedCoordRef.current = { lat, lng, timestamp: fixTsMs };

                  setRouteCoords((previous) => cleanTrackingRoute([...previous, {
                    latitude: lat,
                    longitude: lng,
                    timestamp: fixTsMs,
                  }]).slice(-600));
                }
              }
            }

            lastCoordRef.current = { lat, lng };

            // Persist motion anchor state across tab switches / screen remounts
            storage.getItem('currentTrackingSessionId').then((sid) => {
              storage.setItem('tracking_screen_motion_state', JSON.stringify({
                sessionId: sid || 'ACTIVE',
                lastConfirmedCoord: lastConfirmedCoordRef.current,
                stationaryAnchor: stationaryAnchorRef.current,
                isMoving: isMovingRef.current,
                updatedAt: fixTsMs,
              })).catch(() => {});
            }).catch(() => {});

            // 🎯 NON-BLOCKING RESILIENT GEONAME RESOLVER:
            // Native geocoder on mobile + backend OSM/Google geocoder fallback so real address always shows
            let resolvedActualAddress = lastGeocodedAddressRef.current || '';
            try {
              const distFromLastGeocoded = lastGeocodedCoordRef.current
                ? haversineMeters(lastGeocodedCoordRef.current.lat, lastGeocodedCoordRef.current.lng, lat, lng)
                : 999;

              if (!lastGeocodedAddressRef.current || distFromLastGeocoded > 40) {
                let foundAddr = '';

                // Try device native reverse geocoding if on mobile
                if (Platform.OS !== 'web') {
                  try {
                    const geocoded = await Promise.race([
                      Location.reverseGeocodeAsync({ latitude: lat, longitude: lng }),
                      new Promise((_, reject) => setTimeout(() => reject(new Error('geocode_timeout')), 3500)),
                    ]);
                    if (geocoded && geocoded.length > 0) {
                      const res = geocoded[0];
                      const street = res.street || res.name || '';
                      const district = res.district || res.subregion || '';
                      const city = res.city || '';
                      const region = res.region || '';
                      const code = res.postalCode || '';
                      const built = [street, district, city, region, code]
                        .filter((part) => part && part.length > 0)
                        .join(', ');
                      if (built && built.length > 3) foundAddr = built;
                    }
                  } catch (_) {}
                }

                // If native reverse geocoding yielded nothing or on web, use authoritative backend geocode service
                if (!foundAddr) {
                  try {
                    const srvGeo = await Promise.race([
                      trackingApi.geocode(lat, lng),
                      new Promise((_, reject) => setTimeout(() => reject(new Error('srv_geo_timeout')), 3500)),
                    ]);
                    if (srvGeo?.data?.address && typeof srvGeo.data.address === 'string' && srvGeo.data.address.length > 3) {
                      foundAddr = srvGeo.data.address;
                    }
                  } catch (_) {}
                }

                const finalAddr = foundAddr || lastGeocodedAddressRef.current || `Near [${lat.toFixed(4)}, ${lng.toFixed(4)}]`;
                setAddress(finalAddr);
                lastGeocodedAddressRef.current = finalAddr;
                lastGeocodedCoordRef.current = { lat, lng };
                resolvedActualAddress = finalAddr;
                storage.setItem('last_actual_address', finalAddr).catch(() => {});
              } else if (lastGeocodedAddressRef.current) {
                setAddress(lastGeocodedAddressRef.current);
                resolvedActualAddress = lastGeocodedAddressRef.current;
              }
            } catch (geoErr) {
              const fallbackAddr = lastGeocodedAddressRef.current || `Near [${lat.toFixed(4)}, ${lng.toFixed(4)}]`;
              setAddress(fallbackAddr);
              resolvedActualAddress = fallbackAddr;
            }

            // Sync GPS heartbeat timestamp so watchdog knows foreground is actively receiving fixes
            storage.setItem('last_gps_received_at', String(Date.now())).catch(() => {});

            // 1. Feed screen GPS fix + Actual Address + Screen Moving state into background location processor FIRST (mutex-locked)
            if (resolvedActualAddress) {
              position.coords.address = resolvedActualAddress;
              storage.setItem('last_actual_address', resolvedActualAddress).catch(() => {});
            }
            position.coords.screenCaptured = true;
            position.coords.screenMoving = isMovingRef.current;
            position.coords.screenDistanceKm = Number((totalDistanceRef.current || 0).toFixed(3));

            await processLocation(position).catch(() => {});

            // 2. 📡 GUARANTEED ZERO-DROP SCREEN-TO-SERVER OUTBOX RELAY (SEQUENTIAL FALLBACK):
            // Works even if currentTrackingSessionId is missing (uses AUTO_RECOVER_SESSION) and retries via screenOutboxRef + offlineSync!
            try {
              const activeSessionId = (await storage.getItem('currentTrackingSessionId')) || 'AUTO_RECOVER_SESSION';
              const expectedEventId = `${activeSessionId}:${fixTsMs}:${rawLat.toFixed(6)}:${rawLng.toFixed(6)}`;
              const lastUploadedEventId = await storage.getItem('last_server_upload_event_id');

              const prevPush = lastScreenServerPushRef.current;
              const distFromLastPushM = prevPush.lat
                ? haversineMeters(prevPush.lat, prevPush.lng, rawLat, rawLng)
                : 999;
              const addressJustUpdated = Boolean(resolvedActualAddress && resolvedActualAddress !== prevPush.address);
              const elapsedSincePushMs = Date.now() - (prevPush.ts || 0);

              if (
                lastUploadedEventId !== expectedEventId &&
                (
                  isInitialScreenFix ||
                  didConfirmStep ||
                  (isMovingRef.current && (distFromLastPushM >= 8.0 || elapsedSincePushMs >= 5000)) ||
                  (addressJustUpdated && elapsedSincePushMs >= 15000) ||
                  elapsedSincePushMs >= 60000
                )
              ) {
                const effectiveMps = isMovingRef.current ? Math.max(Number(mps) || 0, 1.4) : 0;
                const displayLat = Number(lat.toFixed(6));
                const displayLng = Number(lng.toFixed(6));
                const screenCoordPayload = {
                  eventId: expectedEventId,
                  lat: displayLat,
                  lng: displayLng,
                  speed: effectiveMps,
                  accuracy: Math.min(Number.isFinite(acc) && acc > 0 ? acc : 15, 45),
                  heading: Number(position.coords?.heading) || 0,
                  mocked: Boolean(position.mocked || position.coords?.isMocked),
                  timestamp: new Date(fixTsMs).toISOString(),
                  address: resolvedActualAddress,
                  motionState: isMovingRef.current ? (effectiveMps >= 3.0 ? 'VEHICLE' : 'WALKING') : 'STATIONARY',
                  screenCaptured: true,
                  screenMoving: isMovingRef.current,
                  screenDistanceKm: Number((totalDistanceRef.current || 0).toFixed(3)),
                };

                lastScreenServerPushRef.current = {
                  lat: displayLat,
                  lng: displayLng,
                  address: resolvedActualAddress,
                  ts: Date.now(),
                };
                await storage.setItem('last_server_upload_event_id', expectedEventId).catch(() => {});
                await enqueueAndFlushScreenCoord(screenCoordPayload, resolvedActualAddress);
              } else if (lastUploadedEventId === expectedEventId) {
                lastScreenServerPushRef.current = {
                  lat: rawLat,
                  lng: rawLng,
                  address: resolvedActualAddress,
                  ts: Date.now(),
                };
                if (screenOutboxRef.current.length > 0) {
                  await flushScreenOutbox(resolvedActualAddress);
                }
              }
            } catch (_) {}
          }
        } catch (err) {
          console.log('📍 Tracking Screen: Could not query exact coordinates:', err.message);
          setSpeed('0');
          if (err.message && err.message.toLowerCase().includes('denied')) {
            setAddress('⚠️ Location Access Denied. Please allow location in browser/phone settings.');
          }
        }
      };

      const fetchLiveCoords = async () => {
        try {
          // If hardware watchPositionAsync is already delivering fresh fixes (< 4s), skip redundant hardware polling
          const lastFixAge = Date.now() - (lastCapturedRawCoordRef.current?.ts || 0);
          if (lastFixAge < 4000 && lastCapturedRawCoordRef.current?.ts) {
            return;
          }

          let position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
            maximumAge: 4000,
          }).catch(() => null);

          if (!position) {
            position = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
              maximumAge: 6000,
            }).catch(() => null);
          }
          if (position) {
            await handleCoordinateFix(position);
          }
        } catch (e) {
          console.log('📍 Tracking Screen: Polling fix error:', e.message);
        }
      };

      // Continuous OS & Web Hardware GPS Callbacks (BestForNavigation + timeInterval: 2000 + distanceInterval: 0)
      Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 2000,
          distanceInterval: 0,
        },
        (pos) => {
          handleCoordinateFix(pos);
        }
      ).then((sub) => {
        watchSubscription = sub;
        console.log('📡 Tracking Screen: Continuous hardware watchPositionAsync active! ✅');
      }).catch((err) => {
        console.log('⚠️ Tracking Screen: watchPositionAsync fallback to polling:', err.message);
      });

      fetchLiveCoordsRef.current = fetchLiveCoords;
      fetchLiveCoords();
      locationIntervalRef.current = setInterval(fetchLiveCoords, 5000);
    } else {
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
      // Protect active sessions: only wipe to inactive defaults if user has truly stopped tracking!
      storage.getItem('currentTrackingSessionId').then((activeSid) => {
        if (!activeSid) {
          hasHydratedAnchorRef.current = false;
          setSpeed('0');
          setIsMoving(false);
          setMotionStatusLabel('STATIONARY');
          setAddress('Tracking inactive. Press START to begin shift.');
        }
      }).catch(() => {});
    }

    return () => {
      if (watchSubscription) watchSubscription.remove();
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
    };
  }, [isTracking, transportMode]);

  const handleStartStop = async () => {
    if (isTracking) {
      const executeStop = async () => {
        const res = await stopTracking();
        if (res.success) {
          const msg = `Clock out complete. Logged ${res.totalDistance?.toFixed(2) || 0} km traveled.`;
          if (Platform.OS === 'web') {
            alert(`Shift Ended: ${msg}`);
          } else {
            Alert.alert('Shift Ended', msg);
          }
        } else {
          const errMsg = res.error || 'Failed to stop tracking session.';
          if (Platform.OS === 'web') {
            alert(`Error: ${errMsg}`);
          } else {
            Alert.alert('Error', errMsg);
          }
        }
      };

      if (Platform.OS === 'web') {
        const confirmStop = window.confirm('Are you sure you want to end your active operational tracking shift?');
        if (confirmStop) {
          await executeStop();
        }
      } else {
        Alert.alert(
          'Confirm Clock Out',
          'Are you sure you want to end your active operational tracking shift?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'End Shift',
              style: 'destructive',
              onPress: executeStop
            }
          ]
        );
      }
    } else {
      // 🚫 MUTUAL EXCLUSION GATE: Cannot Start Shift if a Trip Plan is ACTIVE!
      const activeTrip = await storage.getItem('active_trip_planner_is_active');
      if (activeTrip === 'true') {
        const msg = 'Aapka ek Trip Plan already chal raha hai! Dono me se koi ek hi feature active ho sakta hai (Trip Plan ya Selfie Punch In).\n\nPehle active trip ko complete ya cancel karein.';
        if (Platform.OS === 'web') alert(`Trip Plan Active: ${msg}`);
        else Alert.alert('Trip Plan Active', msg);
        return;
      }

      const res = await startTracking();
      if (res.success) {
        const msg = 'You are now ON DUTY. Background GPS tracking initialized.';
        if (Platform.OS === 'web') {
          alert(`Shift Started: ${msg}`);
        } else {
          Alert.alert('Shift Started', msg);
        }
      } else {
        const errMsg = res.error || 'Check permissions and try again.';
        if (Platform.OS === 'web') {
          alert(`Failed to Start Shift: ${errMsg}`);
        } else {
          Alert.alert('Failed to Start Shift', errMsg);
        }
      }
    }
  };

  const cycleTransportMode = () => {
    if (transportMode === 'PUBLIC TRANSPORT') {
      setTransportMode('WALKING');
    } else if (transportMode === 'WALKING') {
      setTransportMode('DRIVING');
    } else {
      setTransportMode('PUBLIC TRANSPORT');
    }
  };

  const openGoogleMaps = () => {
    const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open Google Maps link.');
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* 1. Title Section & Transport Selector */}
      <View style={styles.topHeader}>
        <View style={styles.titleGroup}>
          <View style={styles.liveIndicatorRow}>
            <Text style={styles.mainTitle}>Live Tracking</Text>
            <View style={[styles.liveBadge, { backgroundColor: isTracking ? '#e6fbf2' : '#fef2f2' }]}>
              <View style={[styles.liveDot, { backgroundColor: isTracking ? '#10b981' : '#ef4444' }]} />
              <Text style={[styles.liveBadgeText, { color: isTracking ? '#10b981' : '#ef4444' }]}>
                {isTracking ? 'LIVE' : 'INACTIVE'}
              </Text>
            </View>
          </View>
          <Text style={styles.subtitle}>Monitor your field activity in real-time</Text>
        </View>

       
      </View>

      {/* 2. Main Central Start/Stop Trigger */}
      <View style={styles.centerClockModule}>
        <View style={styles.pulseOuterCircle}>
          <View style={[styles.pulseInnerRing, { borderColor: isTracking ? 'rgba(16, 185, 129, 0.15)' : 'rgba(37, 99, 235, 0.15)' }]}>
            <TouchableOpacity 
              style={[styles.mainTriggerCircle, { backgroundColor: isTracking ? '#10b981' : '#2563eb' }]} 
              onPress={handleStartStop}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="large" />
              ) : isTracking ? (
                <>
                  <Square size={28} color="#fff" style={styles.controlIcon} />
                  <Text style={styles.controlText}>STOP</Text>
                </>
              ) : (
                <>
                  <Play size={28} color="#fff" style={styles.controlIcon} />
                  <Text style={styles.controlText}>START</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* 3. Metric Stack Grid (3 Columns) */}
      <View style={styles.metricGrid}>
        {/* Distance Card */}
        <Surface style={styles.metricCard} elevation={1}>
          <Navigation size={18} color="#3b82f6" style={styles.metricIcon} />
          <Text style={styles.metricValue}>{distance} km</Text>
          <Text style={styles.metricLabel}>DISTANCE</Text>
        </Surface>

        {/* Speed Card */}
        <Surface style={styles.metricCard} elevation={1}>
          <Activity size={18} color="#8b5cf6" style={styles.metricIcon} />
          <Text style={styles.metricValue}>{speed} km/h</Text>
          <Text style={styles.metricLabel}>SPEED</Text>
        </Surface>

        {/* Time Card */}
        <Surface style={styles.metricCard} elevation={1}>
          <Clock size={18} color="#f97316" style={styles.metricIcon} />
          <Text style={styles.metricValue}>{elapsedTime}</Text>
          <Text style={styles.metricLabel}>TIME</Text>
        </Surface>
      </View>

      {/* 🔋 Battery Optimization Whitelist Banner (Android OEM Keep-Alive) */}
      {showBatteryOptBanner && Platform.OS === 'android' && (
        <Surface style={styles.batteryBanner} elevation={1}>
          <View style={styles.batteryBannerContent}>
            <View style={styles.batteryIconWrap}>
              <Zap size={18} color="#eab308" />
            </View>
            <View style={styles.batteryTextWrap}>
              <Text style={styles.batteryBannerTitle}>Background GPS Protection</Text>
              <Text style={styles.batteryBannerSubtitle}>
                Set Battery to "Unrestricted" so Android never stops GPS when screen is locked.
              </Text>
            </View>
          </View>
          <View style={styles.batteryBannerActions}>
            <TouchableOpacity
              style={styles.batteryFixBtn}
              onPress={() => openBatteryOptimizationSettings()}
              activeOpacity={0.8}
            >
              <Text style={styles.batteryFixBtnText}>Fix Setting</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.batteryDismissBtn}
              onPress={() => setShowBatteryOptBanner(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.batteryDismissText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </Surface>
      )}

      {/* 4. Coordinate & Address Status Module */}
      <Surface style={styles.statusBox} elevation={1}>
        <View style={styles.statusBoxHeader}>
          <View style={styles.headerLeftIconLabel}>
            <MapPin size={18} color="#3b82f6" style={styles.gpsLabelIcon} />
            <Text style={styles.boxTitle}>CURRENT GPS STATUS</Text>
          </View>
          <View style={styles.headerRightActions}>
            {isTracking && (
              <TouchableOpacity
                style={[styles.forceSyncBtn, isForcingSync && styles.forceSyncBtnActive]}
                onPress={handleForceGpsSync}
                activeOpacity={0.7}
                disabled={isForcingSync}
              >
                <RefreshCw size={12} color={isForcingSync ? '#2563eb' : '#64748b'} />
                <Text style={[styles.forceSyncText, isForcingSync && styles.forceSyncTextActive]}>
                  {isForcingSync ? 'Syncing...' : 'Re-Sync'}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={openGoogleMaps}>
              <Text style={styles.googleMapsLink}>Google Maps ›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Dynamic Motion State Live Banner */}
        {isTracking && (
          <View style={[styles.motionStateBanner, { backgroundColor: isMoving ? '#dcfce7' : '#f1f5f9', borderColor: isMoving ? '#bbf7d0' : '#e2e8f0' }]}>
            <View style={[styles.motionStateDot, { backgroundColor: isMoving ? '#16a34a' : '#64748b' }]} />
            <Text style={[styles.motionStateText, { color: isMoving ? '#15803d' : '#475569' }]}>
              {isMoving ? `🟢 MOVING — Travel Recording Active (${speed} km/h)` : '⏸️ STATIONARY — 0 KM Added (At Spot)'}
            </Text>
          </View>
        )}

        <View style={styles.coordsRow}>
          <View style={styles.coordsCol}>
            <Text style={styles.coordsLabel}>LATITUDE</Text>
            <Text style={styles.coordsVal}>{latitude}</Text>
          </View>
          <View style={styles.coordsCol}>
            <Text style={styles.coordsLabel}>LONGITUDE</Text>
            <Text style={styles.coordsVal}>{longitude}</Text>
          </View>
        </View>

        {/* Actual Geocoded Address Card */}
        <LinearGradient 
          colors={['#eef2ff', '#e0e7ff']} 
          style={styles.addressContainer}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.addressHeader}>
            <Compass size={14} color="#4f46e5" style={styles.addressIcon} />
            <Text style={styles.addressHeading}>ACTUAL ADDRESS</Text>
          </View>
          <Text style={styles.addressBody}>{address}</Text>
        </LinearGradient>

        {/* ℹ️ Live Operational Guide Card */}
        {isTracking && (
          <View style={styles.trackingGuideBox}>
            <View style={styles.trackingGuideHeader}>
              <Info size={14} color="#2563eb" style={{ marginRight: 6 }} />
              <Text style={styles.trackingGuideTitle}>Live GPS & Distance Guide</Text>
            </View>
            <Text style={styles.trackingGuideText}>
              • <Text style={{ fontWeight: 'bold', color: '#1e293b' }}>Same Spot / Address Par</Text>: KM strictly <Text style={{ fontWeight: 'bold', color: '#dc2626' }}>0.00 par locked</Text> rahega (koi fake drift nahi judegi).{'\n'}
              • <Text style={{ fontWeight: 'bold', color: '#1e293b' }}>Always Connected</Text>: Satellite coordinates aur connection lagatar check hote rahenge.{'\n'}
              • <Text style={{ fontWeight: 'bold', color: '#1e293b' }}>Jab Actual Address Badlega</Text>: Jaise hi aap yahan se nikal kar chalenge, <Text style={{ fontWeight: 'bold', color: '#16a34a' }}>KM turant update hona shuru hoga</Text>.
            </Text>
          </View>
        )}
      </Surface>

      <Surface style={styles.mapCard} elevation={1}>
        <View style={styles.mapHeader}><View><Text style={styles.mapTitle}>Live route</Text><Text style={styles.mapSubtitle}>Your accepted GPS trail</Text></View><MapPin size={18} color="#0f766e" /></View>
        <View style={styles.employeeMap}><MapViewComponent initialRegion={DEFAULT_MAP_REGION} directoryStaff={latitude && longitude ? [{ _id: 'self', name: 'You', lat: latitude, lng: longitude, isTracking }] : []} routeCoords={routeCoords} onSelectEmployee={() => {}} /></View>
      </Surface>

      {/* 5. Telemetry Flashing Connection Module */}
      <Surface style={styles.mapCanvasPlaceholder} elevation={1}>
        <View style={styles.syncRow}>
          <View style={styles.flashingTargetDot}>
            <View style={[styles.targetCoreDot, { backgroundColor: isTracking ? '#10b981' : '#f59e0b' }]} />
            <View style={[styles.targetOuterDotRing, { borderColor: isTracking ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.4)' }]} />
          </View>
          <View style={styles.syncStatusBadge}>
            <RefreshCw size={10} color="#64748b" style={styles.syncIconAnim} />
            <Text style={styles.syncBadgeText}>SYNCING</Text>
          </View>
        </View>
      </Surface>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingTop: Platform.OS === 'ios' ? 48 : 40,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Platform.OS === 'ios' ? 30 : 10,
    marginBottom: 25,
  },
  titleGroup: {
    flex: 1,
  },
  liveIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  liveBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  transportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
  },
  transportIcon: {
    marginRight: 6,
  },
  transportBtnText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#475569',
    letterSpacing: 0.5,
  },
  centerClockModule: {
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 15,
  },
  pulseOuterCircle: {
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(241, 245, 249, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseInnerRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainTriggerCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  controlIcon: {
    marginBottom: 4,
  },
  controlText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  metricGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 25,
  },
  metricCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  metricIcon: {
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  metricLabel: {
    fontSize: 8.5,
    color: '#94a3b8',
    fontWeight: 'bold',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  statusBox: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 1,
  },
  statusBoxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 12,
    marginBottom: 14,
  },
  headerLeftIconLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gpsLabelIcon: {
    marginRight: 6,
  },
  boxTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#475569',
    letterSpacing: 0.5,
  },
  googleMapsLink: {
    fontSize: 10.5,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  motionStateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  motionStateDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 8,
  },
  motionStateText: {
    fontSize: 9.5,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  coordsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  coordsCol: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  coordsLabel: {
    fontSize: 7.5,
    color: '#94a3b8',
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  coordsVal: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0f172a',
    marginTop: 4,
  },
  addressContainer: {
    borderRadius: 16,
    padding: 14,
    borderColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 1.5,
    shadowColor: '#3b82f6',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 1,
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  addressIcon: {
    marginRight: 6,
  },
  addressHeading: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#4f46e5',
    letterSpacing: 0.5,
  },
  addressBody: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1e293b',
    lineHeight: 18,
  },
  mapCanvasPlaceholder: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 5,
    elevation: 1,
  },
  mapCard: { backgroundColor: '#ffffff', borderRadius: 18, borderWidth: 1, borderColor: '#dbe7ef', padding: 12, marginBottom: 20 },
  mapHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  mapTitle: { color: '#0f172a', fontSize: 13, fontWeight: 'bold' },
  mapSubtitle: { color: '#64748b', fontSize: 10, marginTop: 3 },
  employeeMap: { height: 230, overflow: 'hidden', borderRadius: 14 },
  syncRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  flashingTargetDot: {
    width: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  targetCoreDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    position: 'absolute',
  },
  targetOuterDotRing: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  syncStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  syncIconAnim: {
    transform: [{ rotate: '0deg' }],
  },
  syncBadgeText: {
    fontSize: 8.5,
    fontWeight: 'bold',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  // 🔋 Battery Optimization Whitelist Banner Styles
  batteryBanner: {
    backgroundColor: '#fffbeb',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#fef08a',
    padding: 14,
    marginBottom: 16,
  },
  batteryBannerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  batteryIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fef9c3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  batteryTextWrap: {
    flex: 1,
  },
  batteryBannerTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#854d0e',
    marginBottom: 2,
  },
  batteryBannerSubtitle: {
    fontSize: 11,
    color: '#a16207',
    lineHeight: 16,
  },
  batteryBannerActions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  batteryFixBtn: {
    backgroundColor: '#eab308',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  batteryFixBtnText: {
    fontSize: 11.5,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  batteryDismissBtn: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  batteryDismissText: {
    fontSize: 11.5,
    color: '#713f12',
    fontWeight: '600',
  },
  // Header Right Actions & Force Sync Button
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  forceSyncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  forceSyncBtnActive: {
    backgroundColor: '#dbeafe',
  },
  forceSyncText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  forceSyncTextActive: {
    color: '#2563eb',
  },
  // ℹ️ Live Operational Guide Card Styles
  trackingGuideBox: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    padding: 12,
    marginTop: 12,
  },
  trackingGuideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  trackingGuideTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1d4ed8',
    letterSpacing: 0.3,
  },
  trackingGuideText: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 17,
  },
});
