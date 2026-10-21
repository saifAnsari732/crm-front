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

import { Platform, DeviceEventEmitter } from 'react-native';
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
const MIN_MOVE_METERS        = 3.0;   // Minimum real physical movement to count a segment (supports walking & city traffic)
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
  const reportedSpeedKmh = (Number(reportedSpeedMps) > 0 ? Number(reportedSpeedMps) : 0) * 3.6;
  const effectiveSpeedKmh = Math.max(reportedSpeedKmh, Number.isFinite(calcSpeedKmh) ? calcSpeedKmh : 0);
  const stepSecs = Math.min(Math.max(secs, 1), 30);

  // 🛡️ ANTI-JITTER LOCK: Suppress stationary spot GPS bounce < 14m when Doppler speed < 2.5 km/h and screen not moving
  if (distM < 14.0 && reportedSpeedKmh < 2.5 && currCoord?.screenMoving !== true) {
    if (distM < 10.0 && _movementCandidateBuffer.length > 0) {
      _movementCandidateBuffer = [];
    }
    return { confirmed: false, pending: false };
  }

  // Reject coarse accuracy (> 140m) from triggering departure breakout
  if (accuracyM > 140) {
    return { confirmed: false, pending: false };
  }

  // Direct single-step departure when hardware Doppler confirms velocity (>= 2.5 km/h) or screen moving flag, with displacement >= 12m and accuracy <= 100m
  if (distM >= 12.0 && (reportedSpeedKmh >= 2.5 || currCoord?.screenMoving === true) && accuracyM <= 100) {
    console.log(`📍 Direct Departure: ${distM.toFixed(0)}m at Doppler speed ${reportedSpeedKmh.toFixed(1)} km/h. Transitioning to MOVING.`);
    _movementCandidateBuffer = [];
    _isConfirmedMoving = true;
    return { confirmed: true, backfillDistKm: distM / 1000, candidateCoord: null };
  }

  // 2-Point Progressive Departure Verification (blocks single-spike indoor bounces while capturing 100% of real departure distance)
  const minCandDistM = (reportedSpeedKmh >= 2.0 || currCoord?.screenMoving === true) ? 12.0 : 16.0;
  if (distM >= minCandDistM) {
    const firstCandidate = _movementCandidateBuffer.length > 0
      ? _movementCandidateBuffer[0]
      : null;

    if (firstCandidate) {
      if (Date.now() - firstCandidate.time > 120000) {
        _movementCandidateBuffer = [{ lat: currLat, lng: currLng, distM, secs: stepSecs, reportedSpeedKmh, calcSpeedKmh, accuracyM, time: Date.now(), coord: currCoord }];
        return { confirmed: false, pending: true };
      }

      const stepFromFirstCandidateM = distanceMeters(firstCandidate.lat, firstCandidate.lng, currLat, currLng);

      // Confirmed genuine travel: progressive movement away from anchor AND away from candidate 1
      if (
        distM >= minCandDistM + 4.0 &&
        stepFromFirstCandidateM >= 4.0 &&
        distM >= firstCandidate.distM + 3.0
      ) {
        console.log(`📍 Movement Confirmed: Progressive travel verified (${firstCandidate.distM.toFixed(0)}m → ${distM.toFixed(0)}m). Transitioning to MOVING.`);
        const savedCandidateCoord = firstCandidate.coord || null;
        _movementCandidateBuffer = [];
        _isConfirmedMoving = true;
        return { confirmed: true, backfillDistKm: distM / 1000, candidateCoord: savedCandidateCoord };
      }

      // If phone bounced back toward stationary spot (< 14m or closer than candidate), clear candidate buffer
      if (distM < 14.0 || distM < firstCandidate.distM - 5.0) {
        _movementCandidateBuffer = [];
        return { confirmed: false, pending: false };
      }
      return { confirmed: false, pending: true };
    }

    _movementCandidateBuffer = [{ lat: currLat, lng: currLng, distM, secs: stepSecs, reportedSpeedKmh, calcSpeedKmh, accuracyM, time: Date.now(), coord: currCoord }];
    return { confirmed: false, pending: true };
  }

  if (_movementCandidateBuffer.length > 0 && distM < 14.0) {
    _movementCandidateBuffer = [];
  }
  return { confirmed: false, pending: false };
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

  // Dynamic accuracy ceiling: 160m when moving, 120m otherwise
  const dynamicMaxAcc = _isConfirmedMoving ? 160 : 120;
  if (reportedAccuracy > dynamicMaxAcc && stepSecs <= 1800) {
    return { valid: false, distKm: 0, keepMovingAnchor: _isConfirmedMoving && rawSecs <= 60 };
  }

  // ── Gate 0: Stationary Spot Deadband ─────────────────────────────────
  const effectiveMovingSpeedKmh = Math.max(reportedSpeedKmh, (distKm / Math.max(rawSecs, 1)) * 3600);
  if (!_isConfirmedMoving) {
    if (distM < 14.0 && effectiveMovingSpeedKmh < 2.0 && reportedSpeedKmh < 2.0) {
      if (distM < 10.0) {
        _movementCandidateBuffer = [];
      }
      return { valid: false, distKm: 0 };
    }
  }

  // ── Gate 1: Minimum movement step ─────────────────────────────────────
  // Minimum physical step: 3.0m (for walking / tight road curves). Hold anchor across pauses up to 60s
  const minStepM = reportedAccuracy > 60 ? Math.max(5.0, reportedAccuracy * 0.10) : 3.0;
  if (distM < minStepM) {
    if (_isConfirmedMoving && rawSecs <= 60) {
      return { valid: false, distKm: 0, keepMovingAnchor: true };
    }
    if (rawSecs > 60) {
      _isConfirmedMoving = false;
    }
    return { valid: false, distKm: 0 };
  }

  // ── Gate 2: Long Stationary / 30-Min Dynamic Baseline Reset (> 30 min since anchor) ──
  if (rawSecs > 1800) {
    const stepSpeedKmh = (distKm / (Math.min(Math.max(stepSecs, 5), 60) / 3600));
    const effectiveGapKm = distKm;

    const latDelta30 = Math.abs(curr.lat - prev.lat);
    const lngDelta30 = Math.abs(curr.lng - prev.lng);
    const isSameAt30Min = distM < 30.0 || (latDelta30 < 0.000250 && lngDelta30 < 0.000250) || (reportedSpeedKmh < 2.0 && distM < 50.0);

    if (isSameAt30Min) {
      _isConfirmedMoving = false;
      console.log(`⏱️ [30-MIN BASELINE RESET] Employee stationary at spot after ${(rawSecs / 60).toFixed(0)}m. Re-anchoring baseline at [${curr.lat.toFixed(6)}, ${curr.lng.toFixed(6)}]. Distance: +0.000 KM.`);
      return { valid: false, distKm: 0, reanchorOnly: true };
    }

    // Genuine movement after 30-min stop: requires displacement >= 30m AND (speed >= 2.2 km/h OR displacement >= 60m)
    if ((distM >= 30 && (reportedSpeedKmh >= 2.2 || stepSpeedKmh >= 2.2) && reportedAccuracy <= 160) || (distM >= 60 && stepSpeedKmh <= 150 && reportedAccuracy <= 200)) {
      _isConfirmedMoving = true;
      console.log(`📍 [STATIONARY_WAKEUP] Genuine movement resumed after ${(rawSecs / 60).toFixed(0)}m stop: +${(effectiveGapKm * 1000).toFixed(0)}m`);
      return { valid: true, distKm: effectiveGapKm };
    }

    _isConfirmedMoving = false;
    return { valid: false, distKm: 0, reanchorOnly: true };
  }

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

  // ── Gate 4: Active Moving Step Acceptance (Pure Haversine, Zero Stationary Drift) ──
  // When confirmed moving: only zero-displacement pause (< 3.0m with speed < 1.2 km/h) holds anchor
  const activeStepSpeedKmh = Math.max(reportedSpeedKmh, calcSpeedKmh);
  if (distM < 3.0 && activeStepSpeedKmh < 1.2) {
    if (rawSecs > 60) {
      _isConfirmedMoving = false;
    }
    return { valid: false, distKm: 0, keepMovingAnchor: rawSecs <= 60 };
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
    if (!sessionId || sessionId === 'AUTO_RECOVER_SESSION' || isTrackingActive === 'false') {
      return;
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
    if (response.data?.success && !response.data?.sessionClosed) {
      if (response.data?.sessionId && response.data.sessionId !== sessionId) {
        await storage.setItem('currentTrackingSessionId', response.data.sessionId).catch(() => {});
        await storage.setItem('tracking_accumulated_session_id', response.data.sessionId).catch(() => {});
      }
      console.log(`💓 Heartbeat OK. Server dist: ${(response.data?.totalDistance || 0).toFixed(2)} km`);
    } else if (response.data?.sessionClosed === true) {
      const manualOut = await storage.getItem('user_manually_punched_out');
      if (manualOut === 'true') {
        console.log(`🛑 [HEARTBEAT_SESSION_CLOSED] User manually punched out & server closed session ${sessionId}. Halting background task.`);
        stopHeartbeat();
        await storage.removeItem('currentTrackingSessionId').catch(() => {});
        await storage.setItem('isTrackingActive', 'false').catch(() => {});
        if (Platform.OS !== 'web' && !isExpoGo) {
          Location.stopLocationUpdatesAsync(BACKGROUND_TRACKING_TASK).catch(() => {});
        }
        DeviceEventEmitter.emit('TrackingStateChanged', false);
      } else {
        console.log(`🛡️ [HEARTBEAT_IMMORTAL_SHIELD] Server reported sessionClosed for ${sessionId}, but user NEVER manually punched out! Keeping GPS task ALIVE.`);
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
  // ── Timestamp Deduplication Guard (drops sub-500ms duplicate ticks from foreground/background race) ──
  if (_lastProcessedTimestamp && timestamp <= _lastProcessedTimestamp + 500) {
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
    if (!sessionId || sessionId === 'AUTO_RECOVER_SESSION' || isTrackingActive === 'false') {
      return; // No active session — never invent AUTO_RECOVER_SESSION on login!
    }

    const reportedAcc = Number.isFinite(accuracy) && accuracy > 0 ? accuracy : 25;

    // Ensure session tracking ID and last GPS received timestamp are synchronized locally
    await storage.setItem('tracking_accumulated_session_id', sessionId);
    await storage.setItem('last_gps_received_at', String(Date.now()));

    // ── STEP 1: IMMEDIATELY RESTORE PREVIOUS STATE (Crucial for Android Screen-Off Headless JS) ──
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
        // Immediately restore movement state and candidate buffer from persistent storage BEFORE any gate checks!
        if (typeof lastLocation?.isConfirmedMoving === 'boolean') {
          _isConfirmedMoving = lastLocation.isConfirmedMoving;
        }
        if (Array.isArray(lastLocation?.movementCandidateBuffer)) {
          _movementCandidateBuffer = lastLocation.movementCandidateBuffer;
        }
      } catch (parseErr) {
        console.error('📍 BackgroundTask: Error parsing last location state:', parseErr);
      }
    }

    const prevTsMs = lastLocation?.timestamp ? new Date(lastLocation.timestamp).getTime() : 0;
    const lastTickTsMs = lastLocation?.lastTickTimestamp
      ? new Date(lastLocation.lastTickTimestamp).getTime()
      : prevTsMs;

    // Deduplication check: drop sub-500ms duplicates
    if (!isInitialSeed && lastTickTsMs && timestamp <= lastTickTsMs + 500) {
      return;
    }

    // ── STEP 2: CALCULATE PHYSICAL STEP DISPLACEMENT & HARDWARE DOPPLER SPEED ──
    const stepGapSecs = lastTickTsMs ? Math.max((timestamp - lastTickTsMs) / 1000, 0.5) : 1;
    const stepFromLastM = lastLocation ? distanceMeters(lastLocation.lat, lastLocation.lng, latitude, longitude) : 0;
    const rawSpeedMps = (Number.isFinite(speed) && speed >= 0) ? speed : 0;
    const reportedSpeedKmh = rawSpeedMps * 3.6;

    const maxAllowedAcc = (_isConfirmedMoving || reportedSpeedKmh >= 2.8) ? 200 : 150;
    if (!isInitialSeed && reportedAcc > maxAllowedAcc && stepGapSecs <= 1800) {
      return;
    }
    _lastProcessedTimestamp = timestamp;

    // Update motion state classification using hardware Doppler speed when stationary, or step speed when confirmed moving
    const calcStepSpeedKmh = (_isConfirmedMoving && stepGapSecs > 0 && stepFromLastM >= 3.0)
      ? Math.min((stepFromLastM / 1000 / stepGapSecs) * 3600, 140)
      : 0;
    const effectiveMovingSpeedKmh = _isConfirmedMoving ? Math.max(reportedSpeedKmh, calcStepSpeedKmh) : reportedSpeedKmh;
    updateMotionState(effectiveMovingSpeedKmh / 3.6);

    // ── STEP 3: DYNAMIC 30-MINUTE BASELINE & SPOT GEOFENCE ──
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

    // If ALREADY confirmed moving or screen/Doppler confirms motion, baseline follows current position
    const isScreenOrDopplerMoving = Boolean(location.coords?.screenMoving) || _isConfirmedMoving || reportedSpeedKmh >= 2.2 || calcStepSpeedKmh >= 2.2;
    if (isScreenOrDopplerMoving) {
      _isConfirmedMoving = true;
      _backgroundBaselineCoord = {
        lat: latitude,
        lng: longitude,
        updatedAt: bgNowMs,
        lastVerifiedAt: bgNowMs,
      };
    } else {
      // 🎯 TRUE INDOOR STATIONARY GEOFENCE (Sitting at desk / home):
      // Suppress only if tightly within 8m of baseline and speed < 1.5 km/h and step < 3m:
      const isBgStationarySpot = distFromBgBaseM < 8.0 && reportedSpeedKmh < 1.5 && stepFromLastM < 3.0;
      if (isBgStationarySpot) {
        _currentMotionState = 'STATIONARY';
        _isConfirmedMoving = false;
        if (distFromBgBaseM < 8.0) {
          _movementCandidateBuffer = [];
        }
        const storedDistNow = parseFloat(await storage.getItem('tracking_accumulated_distance')) || 0;
        DeviceEventEmitter.emit('LiveDistanceUpdated', {
          sessionId,
          totalDistance: storedDistNow,
          stepDistKm: 0,
          speed: 0,
          motionState: 'STATIONARY',
          isMoving: false,
          lat: latitude,
          lng: longitude,
        });
        sendHeartbeatNow(false).catch(() => {});
        return;
      }
    }

    // ── STEP 4: BUILD COORDINATE PAYLOAD (STRICTLY PRESERVING RAW HARDWARE DOPPLER SPEED) ──
    const cachedActualAddress = location.coords?.address || (await storage.getItem('last_actual_address')) || '';
    const storedLocalDist = parseFloat(await storage.getItem('tracking_accumulated_distance')) || 0;
    const eventId = `${sessionId}:${timestamp}:${latitude.toFixed(6)}:${longitude.toFixed(6)}`;

    let computedMotionState = _isConfirmedMoving ? _currentMotionState : 'STATIONARY';
    if (_isConfirmedMoving && computedMotionState === 'STATIONARY') {
      computedMotionState = effectiveMovingSpeedKmh >= 15 ? 'VEHICLE' : 'WALKING';
    }

    const newCoord = {
      eventId,
      lat:      latitude,
      lng:      longitude,
      speed:    rawSpeedMps, // Strictly hardware GNSS Doppler speed (never overwrite with indoor drift calcSpeed!)
      accuracy: reportedAcc,
      heading:  Number.isFinite(heading) ? heading : 0,
      mocked:   location.mocked || false,
      timestamp: new Date(timestamp).toISOString(),
      motionState: computedMotionState,
      address:  cachedActualAddress,
      screenCaptured: Boolean(location.coords?.screenCaptured),
      screenMoving: Boolean(_isConfirmedMoving || reportedSpeedKmh >= 3.2),
      screenDistanceKm: Number(storedLocalDist.toFixed(5)),
    };

    if (lastLocation) {
      try {
        let { valid, distKm, reanchorOnly, isOutlier, effectiveSecs, keepMovingAnchor } = validateSegment(lastLocation, {
          lat: latitude, lng: longitude,
          speed: rawSpeedMps,
          accuracy: reportedAcc,
          timestamp: new Date(timestamp).toISOString(),
          screenMoving: Boolean(_isConfirmedMoving || reportedSpeedKmh >= 3.2),
        });

        if (keepMovingAnchor) {
          // Sub-8m micro-step or brief pause (< 35s since last anchor):
          // Keep anchor lat/lng/timestamp untouched so distance accumulates cleanly when >= 8m is reached!
        } else if (isOutlier) {
          // 2-Point Satellite/Network Consensus Relock (supports up to 240m accuracy):
          const prevRelock = lastLocation.relockCandidate;
          if (reportedAcc <= 240 && prevRelock && timestamp > prevRelock.ts && (timestamp - prevRelock.ts) <= 120000) {
            const dRelockM = distanceMeters(prevRelock.lat, prevRelock.lng, latitude, longitude);
            const dtRelockS = Math.max((timestamp - prevRelock.ts) / 1000, 1);
            const relockSpeedKmh = (dRelockM / 1000 / dtRelockS) * 3600;
            if (dRelockM >= 25 && dRelockM <= 1500 && relockSpeedKmh >= 3.5 && relockSpeedKmh <= 140.0) {
              console.log(`🛡️ [SATELLITE_RELOCK] Mobile re-anchoring onto verified consensus fix (${dRelockM.toFixed(0)}m at ${relockSpeedKmh.toFixed(1)} km/h)`);
              valid = true;
              distKm = dRelockM / 1000;
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
              rawSpeedMps,
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
            const anchorTsMs = lastLocation.timestamp ? new Date(lastLocation.timestamp).getTime() : (timestamp - 4000);
            const stepSecsActual = Math.max((timestamp - anchorTsMs) / 1000, 1);
            const stepSpeedMps = Math.min((calculatedDistKm * 1000) / stepSecsActual, 40);
            const displaySpeedMps = rawSpeedMps >= 0.8 ? rawSpeedMps : stepSpeedMps;

            if (calculatedDistKm > 0) {
              const currentLocal = parseFloat(await storage.getItem('tracking_accumulated_distance')) || 0;
              // Store 5-decimal precision (1 cm) so sub-10m steps NEVER get distorted by .toFixed(2) rounding!
              const updatedLocalNum = Number((currentLocal + calculatedDistKm).toFixed(5));
              await storage.setItem('tracking_accumulated_distance', String(updatedLocalNum));
              newCoord.screenDistanceKm = updatedLocalNum;
              newCoord.motionState = displaySpeedMps >= 4.0 ? 'VEHICLE' : 'WALKING';
              newCoord.screenMoving = true;

              // Emit immediate local real-time distance event so UI updates instantly
              DeviceEventEmitter.emit('LiveDistanceUpdated', {
                sessionId,
                totalDistance: updatedLocalNum,
                stepDistKm: calculatedDistKm,
                speed: displaySpeedMps,
                motionState: newCoord.motionState,
                isMoving: true,
                lat: newCoord.lat,
                lng: newCoord.lng,
                address: newCoord.address || '',
              });
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
            // Stationary / unconfirmed step: keep anchor at lastLocation, update status to STATIONARY if not moving
            if (!_isConfirmedMoving) {
              const currentLocal = parseFloat(await storage.getItem('tracking_accumulated_distance')) || 0;
              DeviceEventEmitter.emit('LiveDistanceUpdated', {
                sessionId,
                totalDistance: currentLocal,
                stepDistKm: 0,
                speed: 0,
                motionState: 'STATIONARY',
                isMoving: false,
                lat: newCoord.lat,
                lng: newCoord.lng,
                address: newCoord.address || '',
              });
            }
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
        speed: rawSpeedMps,
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
    // Upload immediately ONLY on:
    //  1. Confirmed distance step (calculatedDistKm > 0)
    //  2. Initial seed or 30-min re-anchor (isInitialSeed || isReanchorUpload)
    //  3. Periodic 60s stationary keepalive so admin map stays live with 0 fake KM.
    // Do NOT upload intermediate sub-8m held-anchor ticks (`keepMovingAnchor`), so backend
    // receives the exact verified step trajectory!
    const nowMs = Date.now();
    const elapsedSinceLastUpload = nowMs - (_lastCoordUploadTs || 0);

    if (calculatedDistKm <= 0 && !isInitialSeed && !isReanchorUpload && elapsedSinceLastUpload < 30000) {
      sendHeartbeatNow(false).catch(() => {});
      return;
    }
    _lastCoordUploadTs = nowMs;
    _lastUploadedCoord = { lat: latitude, lng: longitude, timestamp };
    await storage.setItem('last_server_upload_event_id', eventId).catch(() => {});

    const coordsBatch = candidateCoordToUpload ? [candidateCoordToUpload, newCoord] : [newCoord];

    console.log(
      `📍 BackgroundTask: Uploading GPS telemetry (+${calculatedDistKm.toFixed(4)} km, ${coordsBatch.length} pt) ` +
      `[${latitude.toFixed(5)}, ${longitude.toFixed(5)}] ` +
      `Acc:${reportedAcc.toFixed(0)}m Speed:${rawSpeedMps.toFixed(2)}m/s`
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
        if (response.data?.sessionClosed === true) {
          const manualOut = await storage.getItem('user_manually_punched_out');
          if (manualOut === 'true') {
            console.log(`🛑 [SESSION_CLOSED] BackgroundTask: User manually punched out & server closed session ${sessionId}. Halting.`);
            stopHeartbeat();
            await storage.removeItem('currentTrackingSessionId').catch(() => {});
            await storage.setItem('isTrackingActive', 'false').catch(() => {});
            if (Platform.OS !== 'web' && !isExpoGo) {
              Location.stopLocationUpdatesAsync(BACKGROUND_TRACKING_TASK).catch(() => {});
            }
            DeviceEventEmitter.emit('TrackingStateChanged', false);
            return;
          }
          console.log(`🛡️ [IMMORTAL_SHIELD] BackgroundTask ignored false sessionClosed for ${sessionId} because user did not manually punch out.`);
          return;
        }

        if (response.data?.sessionId && response.data.sessionId !== sessionId) {
          sessionId = response.data.sessionId;
          const manualOut = await storage.getItem('user_manually_punched_out');
          if (manualOut !== 'true') {
            await storage.setItem('currentTrackingSessionId', sessionId).catch(() => {});
            await storage.setItem('tracking_accumulated_session_id', sessionId).catch(() => {});
            await storage.setItem('isTrackingActive', 'true').catch(() => {});
          }
        }

        const serverExact = Number(response.data.exactTotalDistanceToday ?? response.data.exactTotalDistance);
        const serverToday = Number(response.data.totalDistanceToday);
        const serverDist = Number(response.data.totalDistance);
        const authoritativeDist = Number.isFinite(serverExact) && serverExact >= 0
          ? serverExact
          : (Number.isFinite(serverToday) && serverToday > 0 ? serverToday : serverDist);
        const localDist = parseFloat(await storage.getItem('tracking_accumulated_distance')) || 0;
        const validServerDist = Number.isFinite(authoritativeDist) && authoritativeDist >= 0 ? authoritativeDist : 0;

        // Preserve 5-decimal precision: if server and local are within 20m rounding window, keep the higher 5-decimal value;
        // otherwise trust authoritative server distance when validServerDist > 0.
        let finalNum = localDist;
        if (validServerDist > 0) {
          finalNum = Math.abs(localDist - validServerDist) <= 0.025
            ? Math.max(localDist, validServerDist)
            : validServerDist;
        }
        const finalDistPrecisionStr = Number(finalNum.toFixed(5)).toString();

        const checkpointData = {
          sessionId,
          accumulatedDistance: finalNum.toFixed(2),
          lastRecordedLocation: newCoord,
          updatedAt: new Date().toISOString()
        };

        await Promise.all([
          storage.setItem('tracking_session_checkpoint', JSON.stringify(checkpointData)),
          storage.setItem('tracking_accumulated_distance', finalDistPrecisionStr),
        ]);

        const srvMotionState = response.data?.motionState || newCoord.motionState || 'STATIONARY';
        const isCurrentlyMoving = srvMotionState !== 'STATIONARY' && _isConfirmedMoving;

        DeviceEventEmitter.emit('LiveDistanceUpdated', {
          sessionId,
          totalDistance: finalNum,
          sessionDistance: Number(response.data.sessionDistance ?? response.data.totalDistance ?? finalNum),
          speed: isCurrentlyMoving ? (newCoord.speed || 0) : 0,
          motionState: isCurrentlyMoving ? srvMotionState : 'STATIONARY',
          isMoving: isCurrentlyMoving,
          lat: newCoord.lat,
          lng: newCoord.lng,
          address: newCoord.address || '',
        });

        console.log(`📍 BackgroundTask: Server synced. Day Total: ${finalNum.toFixed(2)} km (exact: ${finalDistPrecisionStr} km)`);

        flushOfflineQueue().catch(() => {});
      }
    } catch (apiErr) {
      if (apiErr.response?.status === 409 || apiErr.response?.data?.sessionClosed === true) {
        const manualOut = await storage.getItem('user_manually_punched_out');
        if (manualOut === 'true') {
          console.log('🛑 [SESSION_CLOSED] Server reported 409/sessionClosed after manual punch-out. Halting local session.');
          stopHeartbeat();
          await storage.removeItem('currentTrackingSessionId').catch(() => {});
          await storage.setItem('isTrackingActive', 'false').catch(() => {});
          if (Platform.OS !== 'web' && !isExpoGo) {
            Location.stopLocationUpdatesAsync(BACKGROUND_TRACKING_TASK).catch(() => {});
          }
          DeviceEventEmitter.emit('TrackingStateChanged', false);
          return;
        }
        console.log('🛡️ [IMMORTAL_SHIELD] Ignored 409/sessionClosed because user never manually punched out.');
        return;
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

  // Auto-flush any queued points that were delayed while screen was off/network sleep
  flushOfflineQueue().catch(() => {});
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
      timeInterval: 4000,
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

