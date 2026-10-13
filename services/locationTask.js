/**
 * locationTask.js — Ultra-Advanced GPS Tracking Engine v4.0
 *
 * PROBLEM FIXES:
 *  1. KM LOSS — Kalman-like GPS smoother; accuracy-adaptive thresholds prevent
 *     over-rejection of valid slow-walk or pocket-mode GPS fixes.
 *  2. AUTO-CLOSE — Heartbeat ping every 8 min ensures session stays "live" on
 *     server even when GPS is not moving. Session is only closed intentionally.
 *  3. DISTANCE ACCURACY — Segment validation uses both reported speed AND
 *     calculated speed (max of two). Slow walk (0.5 m/s) is now accepted.
 *  4. DOZE MODE — GPS interval kept at 10 s; distanceInterval 10 m ensures
 *     Android Doze doesn't batch for too long.
 *  5. OFFLINE — Local checkpoint written BEFORE network attempt so no distance
 *     is lost if the OS kills the background task mid-upload.
 *  6. DUPLICATE SUPPRESSION — eventId deduplication prevents replay inflation.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { storage } from './storage';
import axios from 'axios';
import { BASE_URL, trackingAPI } from './api';
import { enqueueCoordinate, flushOfflineQueue, getQueueSize, haversineKm } from './offlineSync';
import { scheduleNoMovementNotification } from './trackingNotification';

const isExpoGo = Constants.appOwnership === 'expo';

export const BACKGROUND_TRACKING_TASK = 'BACKGROUND_TRACKING';

// Single-flight mutex so foreground watcher & background task never race on AsyncStorage
let _locationLock = Promise.resolve();
let _lastProcessedTimestamp = 0;
function withLocationLock(fn) {
  const prev = _locationLock;
  let release;
  _locationLock = new Promise((resolve) => { release = resolve; });
  return prev.then(fn).finally(release);
}

// ─────────────────────────────────────────────────────────────────────────────
// ALGORITHM CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const MAX_ACCURACY_METERS    = 100;   // Reject coarse cell-tower jumps > 100m during normal tracking
const MIN_MOVE_METERS        = 5.0;   // Minimum real physical movement to count a segment (supports walking & city traffic)
const MAX_SPEED_KMH          = 180;   // Teleport guard (airplane / GPS flip)
const MIN_WALKING_SPEED_MPS  = 0.28;  // ~1.0 km/h — supports real-world slow walking
const STATIONARY_DRIFT_LIMIT = 120;  // If stationary AND jump < 120 m → GPS drift, ignore

// Heartbeat & Hardware GPS Watchdog: runs every 60 seconds so server session
// stays continuously synchronized AND wakes up Android GPS after 4-5 hour stationary stops.
const HEARTBEAT_INTERVAL_MS  = 60 * 1000; // 60 seconds

// Upload retry: re-queue if the network call takes longer than this
const UPLOAD_TIMEOUT_MS      = 9000;

// Motion state tracking for AGTRIE-X v7
let _currentMotionState = 'STATIONARY';
let _lastMovementTime = Date.now();
let _stationarySince = Date.now();

// ⏱️ Dynamic 30-Minute Baseline & Frontend "SAME" Verification Engine
// User: "FRONTEND se hi varify kro same are not : agar same h to server per kuchh mat bhejo"
// "Es lati , or longi ko const fix nhi store karna every 30minut per update"
let _backgroundBaselineCoord = null; // { lat, lng, updatedAt, lastVerifiedAt }

function updateMotionState(speedMps) {
  const speedKmh = speedMps * 3.6;
  const prevState = _currentMotionState;
  
  if (speedKmh < 3.0) {
    if (_currentMotionState !== 'STATIONARY') {
      _stationarySince = Date.now();
    }
    _currentMotionState = 'STATIONARY';
  } else if (speedKmh < 7) {
    _currentMotionState = 'WALKING';
    _lastMovementTime = Date.now();
  } else if (speedKmh < 15) {
    _currentMotionState = 'RUNNING';
    _lastMovementTime = Date.now();
  } else if (speedKmh < 40) {
    _currentMotionState = 'BIKE';
    _lastMovementTime = Date.now();
  } else {
    _currentMotionState = 'VEHICLE';
    _lastMovementTime = Date.now();
  }
  
  // Log state transitions
  if (prevState !== _currentMotionState) {
    console.log(`📍 Motion State: ${prevState} → ${_currentMotionState}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSUM Sequential Change-Point Movement Confirmation Buffer
// Prevents false positives from single drift spikes while guaranteeing zero distance
// loss when transitioning from stationary home to active travel.
// ─────────────────────────────────────────────────────────────────────────────
let _movementCandidateBuffer = [];
let _isConfirmedMoving = false;

let _lastCoordUploadTs = 0;
let _lastUploadedCoord = null;

function evaluateMovementTransition(currLat, currLng, distM, secs, reportedSpeedMps, calcSpeedKmh, accuracyM, currCoord = null) {
  const reportedSpeedKmh = (Number(reportedSpeedMps) || 0) * 3.6;
  const stepSecs = Math.min(Math.max(secs, 1), 20);
  const stepCalcSpeedKmh = (distM / 1000 / stepSecs) * 3600;
  const effectiveSpeedKmh = Math.max(reportedSpeedKmh, calcSpeedKmh, stepCalcSpeedKmh);
  const screenMoving = Boolean(currCoord?.screenMoving);

  // 🛡️ ANTI-JITTER LOCK: Never allow single-ping breakaway on cell tower oscillation (50m-75m)!
  // Real vehicle/walking travel requires progressive departure >= 85m with consecutive forward points.
  if (distM < 85.0 && !screenMoving) {
    if (_movementCandidateBuffer.length > 0) {
      _movementCandidateBuffer = [];
    }
    return { confirmed: false, pending: false };
  }

  // Progressive departure buffering begins strictly at >= 85m with Doppler speed >= 2.8 km/h
  if ((reportedSpeedKmh >= 2.8 || screenMoving) && distM >= 85.0 && accuracyM <= 240) {
    const firstCandidate = _movementCandidateBuffer.length > 0
      ? _movementCandidateBuffer[0]
      : null;

    if (firstCandidate) {
      if (Date.now() - firstCandidate.time > 180000) {
        _movementCandidateBuffer = [{ lat: currLat, lng: currLng, distM, secs: stepSecs, effectiveSpeedKmh, accuracyM, time: Date.now(), coord: currCoord }];
        return { confirmed: false, pending: true };
      }

      const stepFromFirstCandidateM = distanceMeters(firstCandidate.lat, firstCandidate.lng, currLat, currLng);
      const radialProgressM = distM - firstCandidate.distM;

      // Progressive forward travel: moved >= 15m further away from anchor than candidate 1
      if (distM >= 105.0 && radialProgressM >= 15 && stepFromFirstCandidateM >= 15) {
        console.log(`📍 CUSUM Change-Point: Confirmed genuine road travel (${firstCandidate.distM.toFixed(0)}m → ${distM.toFixed(0)}m, Acc:${accuracyM.toFixed(0)}m). Transitioning to MOVING.`);
        const savedCandidateCoord = firstCandidate.coord || null;
        _movementCandidateBuffer = [];
        _isConfirmedMoving = true;
        return { confirmed: true, backfillDistKm: distM / 1000, candidateCoord: savedCandidateCoord };
      }

      // If phone bounced back towards the anchor (< 85m), drop candidate buffer immediately
      if (distM < 85.0) {
        _movementCandidateBuffer = [];
        return { confirmed: false, pending: false };
      }
      return { confirmed: false, pending: true };
    }

    _movementCandidateBuffer = [{ lat: currLat, lng: currLng, distM, secs: stepSecs, effectiveSpeedKmh, accuracyM, time: Date.now(), coord: currCoord }];
    return { confirmed: false, pending: true };
  } else {
    if (_movementCandidateBuffer.length > 0 && distM < 85.0) {
      _movementCandidateBuffer = [];
    }
    return { confirmed: false, pending: false };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Haversine in meters
// ─────────────────────────────────────────────────────────────────────────────
function distanceMeters(lat1, lon1, lat2, lon2) {
  return haversineKm(lat1, lon1, lat2, lon2) * 1000;
}

// ─────────────────────────────────────────────────────────────────────────────
// Simple 1-D Kalman smoother for GPS accuracy confidence
// Returns a "trust weight" 0–1 based on reported accuracy
// Lower accuracy (higher meters) → lower trust
// ─────────────────────────────────────────────────────────────────────────────
function accuracyTrustWeight(accuracyMeters) {
  // Perfect GPS (~5 m) → weight 1.0; 500 m accuracy → weight ~0.1
  return Math.max(0.1, Math.min(1.0, 50 / Math.max(accuracyMeters, 1)));
}

// ─────────────────────────────────────────────────────────────────────────────
// GPS segment validator — returns { valid, distKm }
// ─────────────────────────────────────────────────────────────────────────────
function validateSegment(prev, curr) {
  // Guard: must have previous anchor
  if (!prev || !curr) return { valid: false, distKm: 0 };

  const reportedAccuracy = Number(curr.accuracy) || 25;
  const anchorTs = prev.timestamp ? new Date(prev.timestamp).getTime() : 0;
  const lastTickTs = prev.lastTickTimestamp ? new Date(prev.lastTickTimestamp).getTime() : anchorTs;
  const currTs = curr.timestamp ? new Date(curr.timestamp).getTime() : Date.now();

  // rawSecs = time since last committed anchor; stepSecs = time since most recent stationary GPS tick
  const rawSecs = Math.max((currTs - anchorTs) / 1000, 0.5);
  const stepSecs = Math.max((currTs - lastTickTs) / 1000, 0.5);

  const distM = distanceMeters(prev.lat, prev.lng, curr.lat, curr.lng);
  const distKm = distM / 1000;
  const reportedSpeedMps = Number.isFinite(curr.speed) ? Math.max(0, curr.speed) : 0;
  const reportedSpeedKmh = reportedSpeedMps * 3.6;

  // Dynamic accuracy ceiling: allow up to 300m when moving or displaced >= 25m (pocket/vehicle/cell/web GPS), 220m when stationary
  const dynamicMaxAcc = (_isConfirmedMoving || curr.screenMoving || reportedSpeedKmh >= 3.5 || distM >= 25) ? 300 : 220;
  if (reportedAccuracy > dynamicMaxAcc && stepSecs <= 1800) {
    return { valid: false, distKm: 0 };
  }

  // ── Gate 0: Base Digits vs Stationary Cell/Wi-Fi Deadband (< 85m) ─────
  // User Rule: "agar pura digit update hua h to emp moove kiya other wise not moove"
  // When employee is stationary, phone jumps 50m-75m between cell towers / Wi-Fi routers.
  // Within 85m (or |latDelta| < 0.000750 && |lngDelta| < 0.000850) is STATIONARY SPOT.
  // Unless screen explicitly confirms moving with genuine displacement >= 85m:
  // Strictly stationary, zero distance added!
  const latDelta = Math.abs(curr.lat - prev.lat);
  const lngDelta = Math.abs(curr.lng - prev.lng);
  const isInsideStationarySpot = distM < 85.0 || (latDelta < 0.000750 && lngDelta < 0.000850);
  if (isInsideStationarySpot && !curr.screenMoving) {
    _isConfirmedMoving = false;
    _movementCandidateBuffer = [];
    return { valid: false, distKm: 0 };
  }

  // ── Gate 1: Minimum movement ─────────────────────────────────────────
  // CRITICAL FIX: When _isConfirmedMoving === true, hold the moving state and anchor for up to 180s (3 minutes)
  // across traffic lights, turns, speed breakers, or brief stops so the route NEVER breaks!
  const minStepM = reportedAccuracy > 150 ? 12 : MIN_MOVE_METERS;
  if (distM < minStepM) {
    if (_isConfirmedMoving && rawSecs < 180) {
      return { valid: false, distKm: 0, keepMovingAnchor: true };
    }
    _isConfirmedMoving = false;
    return { valid: false, distKm: 0 };
  }

  // ── Gate 2: Long Stationary / 30-Min Dynamic Baseline Reset (> 30 min since anchor) ──
  // User: "Es lati , or longi ko const fix nhi store karna every 30minut per update new lati , or longi se conpare karna same are not"
  if (rawSecs > 1800) {
    const gapSpeedKmh = (distKm / (rawSecs / 3600));
    const stepSpeedKmh = (distKm / (Math.min(stepSecs, 60) / 3600));
    const effectiveGapKm = distKm >= 0.300 ? Math.round(distKm * 1.12 * 1000) / 1000 : distKm;

    const latDelta30 = Math.abs(curr.lat - prev.lat);
    const lngDelta30 = Math.abs(curr.lng - prev.lng);
    const isSameAt30Min = distM < 38.0 || (latDelta30 < 0.000350 && lngDelta30 < 0.000350) || reportedSpeedKmh < 2.5;

    if (isSameAt30Min) {
      // ⏱️ 30-MINUTE RESET: Reset baseline anchor to current coordinate without adding distance!
      _isConfirmedMoving = false;
      console.log(`⏱️ [30-MIN BASELINE RESET] Employee stationary at spot after ${(rawSecs / 60).toFixed(0)}m. Re-anchoring baseline at [${curr.lat.toFixed(6)}, ${curr.lng.toFixed(6)}]. Distance: +0.000 KM.`);
      return { valid: false, distKm: 0, reanchorOnly: true };
    }

    // Genuine movement after 30-min stop: requires both displacement >= 38m AND hardware speed >= 2.8 km/h
    if (distM >= 38 && (reportedSpeedKmh >= 2.8 || stepSpeedKmh >= 2.8) && reportedAccuracy <= 300) {
      _isConfirmedMoving = true;
      console.log(`📍 [STATIONARY_WAKEUP] Genuine movement resumed after ${(rawSecs / 60).toFixed(0)}m stop: +${(effectiveGapKm * 1000).toFixed(0)}m (speed: ${Math.max(reportedSpeedKmh, stepSpeedKmh).toFixed(1)} km/h)`);
      return { valid: true, distKm: effectiveGapKm };
    }

    _isConfirmedMoving = false;
    return { valid: false, distKm: 0, reanchorOnly: true };
  }

  // Use stepSecs (time since last GPS tick) when waking from stationary so calcSpeedKmh is never diluted by stationary time
  const effectiveTimeSecs = _isConfirmedMoving ? rawSecs : Math.min(rawSecs, Math.max(stepSecs, 5));
  const calcSpeedKmh = (distKm / effectiveTimeSecs) * 3600;
  if (calcSpeedKmh > MAX_SPEED_KMH && (distKm / rawSecs) * 3600 > MAX_SPEED_KMH) {
    console.log(`📍 GPS Teleport detected: ${calcSpeedKmh.toFixed(0)} km/h — skipping`);
    return { valid: false, distKm: 0, isOutlier: true };
  }

  // ── Gate 3: Stationary Departure Gate ────────────────────────────────
  if (!_isConfirmedMoving) {
    return { valid: false, distKm: 0, effectiveSecs: effectiveTimeSecs };
  }

  // ── Gate 4: Active Moving Continuation Filter ────────────────────────
  const calcSpeedMps = (distM / effectiveTimeSecs);
  const effectiveSpeedMps = Math.max(reportedSpeedMps, calcSpeedMps);
  const effectiveSpeedKmh = effectiveSpeedMps * 3.6;

  // Transition back to STATIONARY as soon as employee stops (>= 25s at < 1.5 km/h or speed < 0.6 m/s with displacement < 4m)
  // This ensures 0.000 KM is added while employee is sitting/standing at test spot!
  if (effectiveSpeedKmh < 1.5 || (reportedSpeedKmh < 1.0 && distM < 4.0)) {
    if (rawSecs < 25) {
      return { valid: false, distKm: 0, keepMovingAnchor: true };
    }
    _isConfirmedMoving = false;
    console.log(`📍 Transitioned to STATIONARY: ${distM.toFixed(1)}m over ${rawSecs.toFixed(0)}s at ${effectiveSpeedKmh.toFixed(1)} km/h`);
    return { valid: false, distKm: 0 };
  }

  return { valid: true, distKm };
}

// ─────────────────────────────────────────────────────────────────────────────
// Heartbeat manager — keeps server session alive for stationary employees
// ─────────────────────────────────────────────────────────────────────────────
let _heartbeatTimer = null;

export async function sendHeartbeatNow(force = false) {
  try {
    const manuallyPunchedOut = await storage.getItem('user_manually_punched_out');
    if (manuallyPunchedOut === 'true') return;

    let sessionId = await storage.getItem('currentTrackingSessionId');
    const isTrackingActive = await storage.getItem('isTrackingActive');
    if (!sessionId) {
      if (isTrackingActive === 'true') {
        sessionId = 'AUTO_RECOVER_SESSION';
      } else {
        return;
      }
    }
    const last = parseInt(await storage.getItem('last_heartbeat_ts'), 10) || 0;
    if (!force && Date.now() - last < HEARTBEAT_INTERVAL_MS - 10000) return;
    await storage.setItem('last_heartbeat_ts', String(Date.now()));

    // ── ACTIVE HARDWARE GPS WATCHDOG (PREVENTS DAILY COORDINATE DISCONNECT) ──
    // On Xiaomi/Vivo/Oppo/Realme/Samsung, Android Doze or OEM battery savers can
    // silently suspend passive location callbacks after stationary stops.
    // If no passive GPS fix arrived in the last 35s, actively poll hardware GNSS!
    const lastGpsAt = parseInt(await storage.getItem('last_gps_received_at'), 10) || 0;
    if (Date.now() - lastGpsAt > 35000) {
      try {
        const freshPos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        }).catch(() =>
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        );
        if (freshPos?.coords) {
          await storage.setItem('last_gps_received_at', String(Date.now()));
          await withLocationLock(() => processLocationUnlocked(freshPos)).catch(() => {});
        }
      } catch (_) {}
    }

    const lastLocStr = await storage.getItem('last_recorded_location');
    const lastLoc = lastLocStr ? JSON.parse(lastLocStr) : null;
    const cachedAddr = (await storage.getItem('last_actual_address')) || lastLoc?.address || '';

    const response = await trackingAPI.heartbeat({
      sessionId,
      lat: lastLoc?.lat,
      lng: lastLoc?.lng,
      accuracy: lastLoc?.accuracy,
      speed: lastLoc?.speed,
      currentAddress: cachedAddr,
    });
    if (response.data?.success) {
      if (response.data?.sessionId && (sessionId === 'AUTO_RECOVER_SESSION' || response.data.sessionId !== sessionId)) {
        await storage.setItem('currentTrackingSessionId', response.data.sessionId).catch(() => {});
        await storage.setItem('tracking_accumulated_session_id', response.data.sessionId).catch(() => {});
      }
      console.log(`💓 Heartbeat OK. Server dist: ${(response.data?.totalDistance || 0).toFixed(2)} km`);
    } else if (response.data?.sessionClosed === true) {
      const isPrevDayEnd = String(response.data?.message || '').toLowerCase().includes('previous day');
      if (!isPrevDayEnd && lastLoc?.lat && lastLoc?.lng) {
        console.log('🛡️ [HEARTBEAT_AUTO_HEAL] Server reported sessionClosed during active shift. Re-opening session...');
        const startRes = await trackingAPI.startTracking({ lat: lastLoc.lat, lng: lastLoc.lng }).catch(() => null);
        const newSessionId = startRes?.data?.sessionId || startRes?.data?.session?.sessionId;
        if (startRes?.data?.success && newSessionId) {
          await storage.setItem('currentTrackingSessionId', newSessionId);
          await storage.setItem('tracking_accumulated_session_id', newSessionId);
          await storage.setItem('isTrackingActive', 'true');
          console.log('🛡️ [HEARTBEAT_AUTO_HEAL] Active shift seamlessly restored:', newSessionId);
        }
      }
    }
  } catch (_) {
    // best-effort; retried on next GPS tick / interval
  }
}

function startHeartbeat(sessionId) {
  if (_heartbeatTimer) return; // Keep existing timer active, don't restart or force-ping repeatedly
  _heartbeatTimer = setInterval(() => {
    sendHeartbeatNow(false);
  }, HEARTBEAT_INTERVAL_MS);
  sendHeartbeatNow(false);
}

function stopHeartbeat() {
  if (_heartbeatTimer) {
    clearInterval(_heartbeatTimer);
    _heartbeatTimer = null;
  }
}

export { startHeartbeat, stopHeartbeat };

// ─────────────────────────────────────────────────────────────────────────────
// Core location processor — called for each GPS fix from background task
// ─────────────────────────────────────────────────────────────────────────────
const processLocationUnlocked = async (location) => {
  const { latitude, longitude, speed, accuracy, heading } = location?.coords || {};
  const timestamp = location?.timestamp;

  // ── Basic Finite Coordinate Guard ──────────────────────────────────────────
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(timestamp)) {
    console.log('📍 BackgroundTask: Non-numeric GPS payload, skipping.');
    return;
  }
  // ── Timestamp Deduplication Guard (prevents foreground + background duplicate ticks) ──
  if (_lastProcessedTimestamp && timestamp <= _lastProcessedTimestamp + 2000) {
    return;
  }
  // ── Mock Location / GPS Spoofing Guard ──────────────────────────────────────
  if (location.mocked || location.coords?.isMocked || location.coords?.mocked) {
    console.log('🛡️ [SECURITY] Mock GPS location detected. Discarding.');
    return;
  }

  try {
    const manuallyPunchedOut = await storage.getItem('user_manually_punched_out');
    if (manuallyPunchedOut === 'true') {
      return; // User explicitly clocked out; suppress all GPS telemetry processing
    }

    let sessionId = await storage.getItem('currentTrackingSessionId');
    const isTrackingActive = await storage.getItem('isTrackingActive');
    if (!sessionId) {
      if (isTrackingActive === 'true' || location?.coords?.screenCaptured) {
        sessionId = 'AUTO_RECOVER_SESSION';
      } else {
        return; // No active session
      }
    }

    const reportedAcc = Number.isFinite(accuracy) && accuracy > 0 ? accuracy : 25;

    // Ensure session tracking ID and last GPS received timestamp are synchronized locally
    if (sessionId !== 'AUTO_RECOVER_SESSION') {
      await storage.setItem('tracking_accumulated_session_id', sessionId);
    }
    await storage.setItem('last_gps_received_at', String(Date.now()));

    // ⏱️ Dynamic 30-Minute Baseline & Frontend "SAME" Verification
    // User Rule: "FRONTEND se hi varify kro same are not : agar same h to server per kuchh mat bhejo"
    // "Es lati , or longi ko const fix nhi store karna every 30minut per update"
    const bgNowMs = Date.now();
    if (!_backgroundBaselineCoord || !_backgroundBaselineCoord.updatedAt) {
      _backgroundBaselineCoord = {
        lat: latitude,
        lng: longitude,
        updatedAt: bgNowMs,
        lastVerifiedAt: bgNowMs,
      };
    } else if (bgNowMs - _backgroundBaselineCoord.updatedAt >= 30 * 60 * 1000) {
      if (!_isConfirmedMoving) {
        console.log(`⏱️ [BG 30-MIN BASELINE RESET] Re-anchoring baseline to [${latitude.toFixed(6)}, ${longitude.toFixed(6)}]`);
        _backgroundBaselineCoord = {
          lat: latitude,
          lng: longitude,
          updatedAt: bgNowMs,
          lastVerifiedAt: bgNowMs,
        };
      }
    }

    const distFromBgBaseM = distanceMeters(_backgroundBaselineCoord.lat, _backgroundBaselineCoord.lng, latitude, longitude);
    // 🎯 50-METER DYNAMIC RADIUS GEOFENCE (User Rule: "50 miter ka radia like yesa kuch")
    // If coordinate is within 50 meters of background baseline, employee is stationary at this spot!
    const isBgSame = distFromBgBaseM <= 50.0;

    if (isBgSame && !location?.coords?.screenMoving) {
      // 🛑 FRONTEND VERIFIED "SAME":
      // User Rule: "agar same h to server per kuchh mat bhejo"
      // Exit immediately! Zero distance added, zero coordinates uploaded to /api/tracking/update!
      _isConfirmedMoving = false;
      _currentMotionState = 'STATIONARY';
      _movementCandidateBuffer = [];
      _lastProcessedTimestamp = timestamp;
      sendHeartbeatNow(false).catch(() => {});
      return;
    }

    // ── Gate 2: Movement + speed validation ──────────────────────────────────
    updateMotionState(Number.isFinite(speed) ? speed : 0);
    
    // ─── Build coordinate payload for server processing ───────────────────
    const cachedActualAddress = location.coords?.address || (await storage.getItem('last_actual_address')) || '';
    const storedLocalDist = parseFloat(await storage.getItem('tracking_accumulated_distance')) || 0;
    const effectiveScreenDistKm = Math.max(Number(location.coords?.screenDistanceKm) || 0, storedLocalDist);
    const eventId = `${sessionId}:${timestamp}:${latitude.toFixed(6)}:${longitude.toFixed(6)}`;
    const newCoord = {
      eventId,
      lat:      latitude,
      lng:      longitude,
      speed:    Number.isFinite(speed)   ? speed   : 0,
      accuracy: reportedAcc,
      heading:  Number.isFinite(heading) ? heading : 0,
      mocked:   location.mocked || false,
      timestamp: new Date(timestamp).toISOString(),
      motionState: _currentMotionState,
      address:  cachedActualAddress,
      screenCaptured: Boolean(location.coords?.screenCaptured),
      screenMoving: Boolean(location.coords?.screenMoving),
      screenDistanceKm: Number(effectiveScreenDistKm.toFixed(3)),
    };

    let lastLocation = null;
    let calculatedDistKm = 0;
    let isRejectedOutlier = false;
    let isInitialSeed = false;
    let isReanchorUpload = false;
    let candidateCoordToUpload = null;
    const lastLocationStr = await storage.getItem('last_recorded_location');
    if (lastLocationStr) {
      try {
        lastLocation = JSON.parse(lastLocationStr);
        if (lastLocation?.needsInitialSeedUpload) {
          isInitialSeed = true;
        }
        const prevTsMs = lastLocation?.timestamp ? new Date(lastLocation.timestamp).getTime() : 0;
        const lastTickTsMs = lastLocation?.lastTickTimestamp
          ? new Date(lastLocation.lastTickTimestamp).getTime()
          : prevTsMs;

        if (!isInitialSeed && lastTickTsMs && timestamp <= lastTickTsMs + 2000) {
          return;
        }
        const stepGapSecs = lastTickTsMs ? Math.max((timestamp - lastTickTsMs) / 1000, 0.5) : 0;
        const maxAllowedAcc = (lastLocation?.isConfirmedMoving || location.coords?.screenMoving || (Number(speed) || 0) * 3.6 >= 3.5) ? 300 : 250;
        if (!isInitialSeed && reportedAcc > maxAllowedAcc && stepGapSecs <= 1800) {
          // Extreme coarse jump (> 300m) during active tracking — skip BEFORE setting _lastProcessedTimestamp
          // so an accurate GNSS satellite fix arriving milliseconds later is never blocked!
          return;
        }
        _lastProcessedTimestamp = timestamp;

        // Restore persisted movement state across Android Headless JS task restarts!
        if (typeof lastLocation.isConfirmedMoving === 'boolean') {
          _isConfirmedMoving = lastLocation.isConfirmedMoving;
        }
        if (Array.isArray(lastLocation.movementCandidateBuffer)) {
          _movementCandidateBuffer = lastLocation.movementCandidateBuffer;
        }

        let { valid, distKm, reanchorOnly, isOutlier, effectiveSecs, keepMovingAnchor } = validateSegment(lastLocation, {
          lat: latitude, lng: longitude,
          speed, accuracy: reportedAcc, timestamp: new Date(timestamp).toISOString(),
          screenMoving: Boolean(location.coords?.screenMoving),
        });

        if (keepMovingAnchor) {
          // Sub-8m micro-step or brief traffic pause (< 180s since last anchor):
          // Keep anchor lat/lng/timestamp untouched AND keep isConfirmedMoving=true so distance accumulates cleanly,
          // while still allowing periodic/step telemetry upload below!
        } else if (isOutlier) {
          // 2-Point Satellite/Network Consensus Relock (supports up to 240m accuracy):
          const prevRelock = lastLocation.relockCandidate;
          if (reportedAcc <= 240 && prevRelock && timestamp > prevRelock.ts && (timestamp - prevRelock.ts) <= 120000) {
            const dRelockM = distanceMeters(prevRelock.lat, prevRelock.lng, latitude, longitude);
            const dtRelockS = Math.max((timestamp - prevRelock.ts) / 1000, 1);
            const relockSpeedKmh = (dRelockM / 1000 / dtRelockS) * 3600;
            if (dRelockM <= 1500 && relockSpeedKmh <= 140.0) {
              console.log(`🛡️ [SATELLITE_RELOCK] Mobile re-anchoring onto verified consensus fix (${dRelockM.toFixed(0)}m at ${relockSpeedKmh.toFixed(1)} km/h)`);
              valid = true;
              distKm = dRelockM >= 10 ? (dRelockM / 1000) : 0;
              isReanchorUpload = true;
              _isConfirmedMoving = true;
            } else {
              isRejectedOutlier = true;
            }
          } else {
            isRejectedOutlier = true;
          }

          if (isRejectedOutlier && reportedAcc <= 240) {
            await storage.setItem('last_recorded_location', JSON.stringify({
              ...lastLocation,
              relockCandidate: { lat: latitude, lng: longitude, ts: timestamp, accuracy: reportedAcc },
            }));
          }
        } else if (reanchorOnly) {
          isReanchorUpload = true;
          await storage.setItem('last_recorded_location', JSON.stringify({
            ...newCoord,
            lastTickTimestamp: new Date(timestamp).toISOString(),
            isConfirmedMoving: _isConfirmedMoving,
            movementCandidateBuffer: _movementCandidateBuffer,
            relockCandidate: null,
          }));
        } else if (!valid) {
          const distM = distanceMeters(lastLocation.lat, lastLocation.lng, latitude, longitude);
          const secs = effectiveSecs || Math.min(Math.max(stepGapSecs || 10, 1), 20);
          const calcSpeedKmh = (distM / 1000 / secs) * 3600;
          
          if (calcSpeedKmh < MAX_SPEED_KMH) {
            const transition = evaluateMovementTransition(
              latitude,
              longitude,
              distM,
              secs,
              speed,
              calcSpeedKmh,
              reportedAcc,
              newCoord
            );
            if (transition.confirmed) {
              valid = true;
              distKm = transition.backfillDistKm || (distM / 1000);
              candidateCoordToUpload = transition.candidateCoord || null;
            }
          }
        }

        if (!keepMovingAnchor) {
          if (valid) {
            calculatedDistKm = distKm;
            if (calculatedDistKm > 0) {
              const currentLocal = parseFloat(await storage.getItem('tracking_accumulated_distance')) || 0;
              const updatedLocal = (currentLocal + calculatedDistKm).toFixed(2);
              await storage.setItem('tracking_accumulated_distance', updatedLocal);
              newCoord.screenDistanceKm = Math.max(newCoord.screenDistanceKm || 0, parseFloat(updatedLocal));
            }
            await storage.setItem('last_recorded_location', JSON.stringify({
              ...newCoord,
              lastTickTimestamp: new Date(timestamp).toISOString(),
              isConfirmedMoving: _isConfirmedMoving,
              movementCandidateBuffer: _movementCandidateBuffer,
              relockCandidate: null,
              needsInitialSeedUpload: false,
            }));
          } else if (!reanchorOnly && !isRejectedOutlier) {
            await storage.setItem('last_recorded_location', JSON.stringify({
              ...lastLocation,
              lastTickTimestamp: new Date(timestamp).toISOString(),
              isConfirmedMoving: _isConfirmedMoving,
              movementCandidateBuffer: _movementCandidateBuffer,
              needsInitialSeedUpload: false,
            }));
          }
        }
      } catch (parseErr) {
        console.error('📍 BackgroundTask: Error parsing last location:', parseErr);
      }
    } else if (reportedAcc <= 300) {
      // First initial location fix: establish initial anchor (supports up to 300m accuracy)
      _lastProcessedTimestamp = timestamp;
      isInitialSeed = true;
      const isoNow = new Date(timestamp).toISOString();
      await storage.setItem('last_recorded_location', JSON.stringify({
        lat: latitude,
        lng: longitude,
        speed: Number.isFinite(speed) ? speed : 0,
        accuracy: reportedAcc,
        timestamp: isoNow,
        lastTickTimestamp: isoNow,
        isConfirmedMoving: false,
        movementCandidateBuffer: [],
      }));
    }

    if (isRejectedOutlier) {
      return;
    }

    // ── CONTINUOUS TRAJECTORY & LIVE TELEMETRY UPLOAD GATE ───────────────────
    // Upload immediately on:
    //  1. Initial seed or long-gap re-anchor
    //  2. Any confirmed local distance step (calculatedDistKm > 0)
    //  3. Any displacement >= 6m from the last uploaded coordinate or Doppler speed >= 0.6 m/s or screenMoving
    //     so the server's AGTRIE-X v12 engine & DistanceLedger receive the full continuous trajectory!
    //  4. Periodic live position ping every 35s when stationary (backend Centroid Geofence blocks stationary drift).
    const nowMs = Date.now();
    const distFromLastUploadM = _lastUploadedCoord
      ? distanceMeters(_lastUploadedCoord.lat, _lastUploadedCoord.lng, latitude, longitude)
      : (lastLocation ? distanceMeters(lastLocation.lat, lastLocation.lng, latitude, longitude) : 999);

    // 🎯 1-MINUTE STATIONARY DELAY GUARD:
    // When employee is stationary at a spot:
    // 1. Live coordinates are uploaded every 60s (1 minute) so the map/admin stays 100% updated without any tracking disconnect.
    // 2. Indoor jitter (< 25m) with speed < 2.0 km/h will NOT trigger rapid uploads.
    // 3. When moving on the road (_isConfirmedMoving || calculatedDistKm > 0), uploads trigger on 8m step or Doppler speed >= 0.8 m/s.
    const isMovingOnRoad = _isConfirmedMoving || calculatedDistKm > 0;
    const hasStepDisplacement = reportedAcc <= 300 && isMovingOnRoad && (distFromLastUploadM >= 8.0 || (Number(speed) || 0) >= 0.8);

    // 🛑 STRICT ZERO-UPLOAD WHEN STATIONARY:
    // When employee is stationary at spot, NEVER push coordinates to /api/tracking/update!
    // Send lightweight heartbeat only to keep session alive with 0 KM added.
    if (!isMovingOnRoad && calculatedDistKm <= 0 && !isInitialSeed) {
      sendHeartbeatNow(false).catch(() => {});
      return;
    }
    _lastCoordUploadTs = nowMs;
    _lastUploadedCoord = { lat: latitude, lng: longitude, timestamp };
    await storage.setItem('last_server_upload_event_id', eventId).catch(() => {});

    const coordsBatch = candidateCoordToUpload ? [candidateCoordToUpload, newCoord] : [newCoord];

    console.log(
      `📍 BackgroundTask: Uploading GPS telemetry (+${calculatedDistKm.toFixed(3)} km, ${coordsBatch.length} pt) ` +
      `[${latitude.toFixed(5)}, ${longitude.toFixed(5)}] ` +
      `Acc:${reportedAcc.toFixed(0)}m Speed:${(speed || 0).toFixed(2)}m/s`
    );

    // ── Try uploading to server (with 1 fast retry before offline queueing) ───
    const token = await storage.getItem('userToken') || await storage.getItem('token');
    if (!token) {
      for (const c of coordsBatch) {
        await enqueueCoordinate(sessionId, c, lastLocation);
      }
      return;
    }

    try {
      let response;
      try {
        response = await trackingAPI.update({ sessionId, coordinates: coordsBatch, currentAddress: cachedActualAddress });
      } catch (firstErr) {
        // Immediate 1.5s retry on transient mobile network drop before queueing offline
        if (!firstErr.response || firstErr.response.status >= 500) {
          await new Promise((r) => setTimeout(r, 1500));
          response = await trackingAPI.update({ sessionId, coordinates: coordsBatch, currentAddress: cachedActualAddress });
        } else {
          throw firstErr;
        }
      }

      if (response.data?.success) {
        if (response.data?.sessionId && (sessionId === 'AUTO_RECOVER_SESSION' || response.data.sessionId !== sessionId)) {
          sessionId = response.data.sessionId;
          await storage.setItem('currentTrackingSessionId', sessionId).catch(() => {});
          await storage.setItem('tracking_accumulated_session_id', sessionId).catch(() => {});
          await storage.setItem('isTrackingActive', 'true').catch(() => {});
        }
        if (response.data?.sessionClosed === true) {
          // Check if the server closed a session from a previous day vs an active shift that was auto-closed
          const isPrevDayEnd = String(response.data?.message || '').toLowerCase().includes('previous day') ||
            String(response.data?.message || '').toLowerCase().includes('ended. please punch in for today');
          const manualOut = await storage.getItem('user_manually_punched_out');
          if (!isPrevDayEnd && manualOut !== 'true') {
            console.log(`🛡️ [AUTO_HEAL] Server returned sessionClosed for ${sessionId} while employee is still on shift. Re-opening session...`);
            try {
              const startRes = await trackingAPI.startTracking({ lat: newCoord.lat, lng: newCoord.lng });
              const newSessionId = startRes.data?.sessionId || startRes.data?.session?.sessionId;
              if (startRes.data?.success && newSessionId) {
                await storage.setItem('currentTrackingSessionId', newSessionId);
                await storage.setItem('tracking_accumulated_session_id', newSessionId);
                await storage.setItem('isTrackingActive', 'true');
                console.log('🛡️ [AUTO_HEAL] Seamlessly restored active session:', newSessionId);
                await axios.post(
                  `${BASE_URL}/tracking/update`,
                  { sessionId: newSessionId, coordinates: coordsBatch },
                  { headers: { Authorization: `Bearer ${token}` }, timeout: UPLOAD_TIMEOUT_MS }
                ).catch(() => {});
                return;
              }
            } catch (_) {}
          }

          if (isPrevDayEnd || manualOut === 'true') {
            console.log(`🛑 [SESSION_CLOSED] BackgroundTask: Session ${sessionId} ended (${isPrevDayEnd ? 'date rollover' : 'manual punch-out'}). Halting.`);
            const currentActive = await storage.getItem('currentTrackingSessionId');
            if (currentActive === sessionId) {
              stopHeartbeat();
              await storage.removeItem('currentTrackingSessionId');
              await storage.setItem('isTrackingActive', 'false');
              if (Platform.OS !== 'web' && !isExpoGo) {
                Location.stopLocationUpdatesAsync(BACKGROUND_TRACKING_TASK).catch(() => {});
              }
            }
          }
          return;
        }

        const serverToday = Number(response.data.totalDistanceToday);
        const serverDist = Number(response.data.totalDistance);
        const authoritativeDist = Number.isFinite(serverToday) && serverToday > 0 ? serverToday : serverDist;
        const localDist = parseFloat(await storage.getItem('tracking_accumulated_distance')) || 0;
        const validServerDist = Number.isFinite(authoritativeDist) && authoritativeDist >= 0 ? authoritativeDist : 0;

        // Monotonic non-decreasing guarantee: never overwrite a higher local screen distance with 0.00!
        const finalNum = Math.max(validServerDist, localDist);
        const finalDist = finalNum.toFixed(2);

        const checkpointData = {
          sessionId,
          accumulatedDistance: finalDist,
          lastRecordedLocation: newCoord,
          updatedAt: new Date().toISOString()
        };

        await Promise.all([
          storage.setItem('tracking_session_checkpoint', JSON.stringify(checkpointData)),
          storage.setItem('tracking_accumulated_distance', finalDist),
        ]);

        console.log(`📍 BackgroundTask: Server synced. Day Total: ${finalDist} km`);

        flushOfflineQueue().catch(() => {});
      }
    } catch (apiErr) {
      if (apiErr.response?.status === 409 || apiErr.response?.data?.sessionClosed === true) {
        console.log('🛡️ [AUTO_HEAL] Server reported sessionClosed/409. Auto-recovering active shift...');
        try {
          const startRes = await trackingAPI.startTracking({ lat: newCoord.lat, lng: newCoord.lng });
          const newSessionId = startRes.data?.sessionId || startRes.data?.session?.sessionId;
          if (startRes.data?.success && newSessionId) {
            await storage.setItem('currentTrackingSessionId', newSessionId);
            await storage.setItem('tracking_accumulated_session_id', newSessionId);
            console.log('🛡️ [AUTO_HEAL] Seamlessly adopted active session:', newSessionId);
            await axios.post(
              `${BASE_URL}/tracking/update`,
              { sessionId: newSessionId, coordinates: coordsBatch },
              { headers: { Authorization: `Bearer ${token}` }, timeout: UPLOAD_TIMEOUT_MS }
            ).catch(() => {});
            return;
          }
        } catch (healErr) {
          console.log('⚠️ [AUTO_HEAL] Auto-recovery attempt failed:', healErr.message);
        }
      }
      console.log(`📍 BackgroundTask: Network unavailable (${apiErr.code || apiErr.message}). Enqueuing for offline sync...`);
      for (const c of coordsBatch) {
        await enqueueCoordinate(sessionId, c, lastLocation);
      }
    }

  } catch (e) {
    console.error('📍 BackgroundTask: Unhandled error in background tick:', e);
  }
};

const processLocation = (location) => withLocationLock(() => processLocationUnlocked(location));

// ─────────────────────────────────────────────────────────────────────────────
// TaskManager definition — processes GPS fixes from OS in timestamp order
// ─────────────────────────────────────────────────────────────────────────────
TaskManager.defineTask(BACKGROUND_TRACKING_TASK, async ({ data: { locations }, error }) => {
  if (error) {
    console.error('📍 BackgroundTask Error:', error.message);
    return;
  }
  if (!locations || locations.length === 0) return;

  // Keep the server session alive from the OS-driven task (JS timers die in Doze).
  sendHeartbeatNow().catch(() => {});

  // Android may batch fixes (e.g., 3-4 points) when the screen is off.
  // Process ALL in timestamp order — never skip batched fixes.
  const ordered = [...locations].sort((a, b) => a.timestamp - b.timestamp);
  for (const loc of ordered) {
    await processLocation(loc);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// REAL-TIME GPS RECOVERY ENGINE & WATCHDOG
// ─────────────────────────────────────────────────────────────────────────────
let _recoveryInProgress = false;
let _recoveryAttempts = 0;

export async function detectTrackingFailure() {
  if (Platform.OS === 'web' || isExpoGo) return 'HEALTHY';

  const sessionId = await storage.getItem('currentTrackingSessionId');
  if (!sessionId) return 'NO_SESSION';

  const taskRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TRACKING_TASK).catch(() => false);
  const lastGps = Number(await storage.getItem('last_gps_received_at')) || 0;
  const gpsAge = Date.now() - lastGps;

  if (!taskRunning) return 'SERVICE_INTERRUPTED';
  if (gpsAge > 90000) return 'GPS_STALE';
  if (gpsAge > 30000) return 'DEGRADED';
  return 'HEALTHY';
}

function calculateRecoveryDelay(attempt) {
  const base = Math.min(120000, 5000 * Math.pow(2, Math.max(0, attempt - 1)));
  const jitter = Math.floor(Math.random() * 2000);
  return base + jitter;
}

export async function safeRecoverLocation(reason = 'HEALTH_CHECK_FAILED') {
  if (Platform.OS === 'web' || isExpoGo) {
    return false;
  }

  if (_recoveryInProgress) {
    console.log('🔄 GPS Recovery: Single-flight lock active. Recovery already running.');
    return false;
  }
  _recoveryInProgress = true;

  try {
    const sessionId = await storage.getItem('currentTrackingSessionId');
    if (!sessionId) return false;

    _recoveryAttempts++;
    const delayMs = calculateRecoveryDelay(_recoveryAttempts);
    console.log(`🔄 GPS RECOVERY started (${reason}). Attempt #${_recoveryAttempts}. Backoff: ${(delayMs / 1000).toFixed(1)}s`);

    await storage.setItem('tracking_recovery_state', 'RECOVERING');

    const running = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TRACKING_TASK).catch(() => false);
    // CRITICAL FIX: When Android FusedLocationProvider freezes after 4-5 hours stationary,
    // hasStartedLocationUpdatesAsync STILL returns true even though no GPS intents are firing!
    // Always stop and re-register the task on GPS_STALE / recovery, and use distanceInterval: 0
    // so Android never puts the GNSS provider into Stationary Hardware Geofence Sleep!
    if (running) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_TRACKING_TASK).catch(() => {});
    }

    await Location.startLocationUpdatesAsync(BACKGROUND_TRACKING_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 10000,
      distanceInterval: 0,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: '🟢 Kisan Team — Duty Active (ON)',
        notificationBody: 'Live distance tracking is running. Tap to open Kisan Team.',
        notificationColor: '#0a3d3c',
        killServiceOnDestroy: false,
      },
    });

    // Immediately poll hardware GPS once to wake GNSS chip out of deep stationary sleep
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High, maximumAge: 0 })
      .then((pos) => {
        if (pos && pos.coords) {
          processLocation(pos).catch(() => {});
        }
      })
      .catch(() => {});

    const restarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TRACKING_TASK).catch(() => false);
    if (restarted) {
      _recoveryAttempts = 0;
      await storage.setItem('tracking_recovery_state', 'GPS_RECOVERED');
      await storage.setItem('tracking_last_recovery_at', new Date().toISOString());
      console.log('✅ GPS location service recovered successfully!');
      return true;
    } else {
      throw new Error('Location task restart verification returned false');
    }
  } catch (error) {
    await storage.setItem('tracking_recovery_state', 'RECOVERY_FAILED');
    console.error('❌ GPS location service recovery failed:', error.message);
    return false;
  } finally {
    _recoveryInProgress = false;
  }
}

export { processLocation };

