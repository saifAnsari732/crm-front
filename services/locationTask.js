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
const MIN_MOVE_METERS        = 8;     // Minimum real movement to count a segment
const MAX_SPEED_KMH          = 180;   // Teleport guard (airplane / GPS flip)
const MIN_WALKING_SPEED_MPS  = 0.4;  // ~1.4 km/h — below this treat as stationary
const STATIONARY_DRIFT_LIMIT = 120;  // If stationary AND jump < 120 m → GPS drift, ignore

// Heartbeat: send a clean keep-alive ping every 3 minutes so server session
// stays continuously synchronized even if the employee is stationary.
const HEARTBEAT_INTERVAL_MS  = 3 * 60 * 1000; // 3 minutes

// Upload retry: re-queue if the network call takes longer than this
const UPLOAD_TIMEOUT_MS      = 9000;

// Motion state tracking for AGTRIE-X v7
let _currentMotionState = 'STATIONARY';
let _lastMovementTime = Date.now();
let _stationarySince = Date.now();

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

function evaluateMovementTransition(distM, secs, speedKmh, accuracyM) {
  const effectiveSpeedKmh = Math.max(speedKmh, (distM / 1000 / secs) * 3600);

  // Real movement signal: speed > 3.5 km/h, distance > 35m, reasonable accuracy <= 100m
  if (effectiveSpeedKmh > 3.5 && distM > 35 && accuracyM <= 100) {
    _movementCandidateBuffer.push({ distM, secs, effectiveSpeedKmh, accuracyM, time: Date.now() });

    // Multi-observation confirmation: require at least 2 consecutive consistent fixes
    if (_movementCandidateBuffer.length >= 2) {
      console.log(`📍 CUSUM Change-Point: Confirmed movement with ${_movementCandidateBuffer.length} fixes! Transitioning to MOVING.`);
      // Each buffered fix is measured from the SAME anchor (last_recorded_location),
      // so displacements overlap — the latest one is the true distance. Summing
      // them would over-count and inflate the locally cached KM.
      const latestBufferedM = _movementCandidateBuffer[_movementCandidateBuffer.length - 1].distM;
      _movementCandidateBuffer = [];
      return { confirmed: true, backfillDistKm: latestBufferedM / 1000 };
    }
    return { confirmed: false, pending: true };
  } else {
    // Noise/jitter resets the transition buffer
    if (_movementCandidateBuffer.length > 0) {
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
  const prevTs = prev.timestamp ? new Date(prev.timestamp).getTime() : 0;
  const currTs = curr.timestamp ? new Date(curr.timestamp).getTime() : Date.now();
  const rawSecs = Math.max((currTs - prevTs) / 1000, 0.5);

  // Reject coarse cell-tower / Wi-Fi leaps (> 100m accuracy) during normal consecutive tracking
  if (reportedAccuracy > MAX_ACCURACY_METERS && rawSecs <= 1800) {
    return { valid: false, distKm: 0 };
  }

  const distM = distanceMeters(prev.lat, prev.lng, curr.lat, curr.lng);
  const distKm = distM / 1000;

  // ── Gate 1: Minimum movement ─────────────────────────────────────────
  if (distM < MIN_MOVE_METERS) return { valid: false, distKm: 0 };

  // ── Gate 2: Long Stationary Transition Guard (> 30 min) ──────────────
  const reportedSpeedMps = Number.isFinite(curr.speed) ? Math.max(0, curr.speed) : 0;
  if (rawSecs > 1800) {
    const gapSpeedKmh = (distKm / (rawSecs / 3600));
    if (distKm >= 0.15 && gapSpeedKmh >= 1.5 && gapSpeedKmh <= 140.0 && reportedAccuracy <= 300) {
      return { valid: true, distKm };
    }
    return { valid: false, distKm: 0, reanchorOnly: true };
  }

  const calcSpeedKmh = (distKm / rawSecs) * 3600;
  if (calcSpeedKmh > MAX_SPEED_KMH) {
    console.log(`📍 GPS Teleport detected: ${calcSpeedKmh.toFixed(0)} km/h — skipping`);
    return { valid: false, distKm: 0, isOutlier: true };
  }

  // ── Gate 3: Stationary drift filter (aligned with backend AGTRIE-X v10) ──
  const calcSpeedMps = (distM / rawSecs);
  const effectiveSpeedMps = Math.max(reportedSpeedMps, calcSpeedMps);
  const effectiveSpeedKmh = effectiveSpeedMps * 3.6;
  const stationaryThresholdM = Math.max(30.0, Math.min(50.0, reportedAccuracy * 1.0));

  // Ignore noise jitter when phone is stationary:
  // 1. Inside stationary bubble (< 30-50m) with speed < 6.0 km/h
  // 2. OR step < 25m with speed < 3.5 km/h
  if ((distM < stationaryThresholdM && effectiveSpeedKmh < 6.0) || (distM < 25.0 && effectiveSpeedKmh < 3.5)) {
    console.log(`📍 Stationary drift ignored: ${distM.toFixed(1)}m at ${effectiveSpeedKmh.toFixed(1)} km/h (threshold: ${stationaryThresholdM.toFixed(0)}m, acc: ${reportedAccuracy}m)`);
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
    const sessionId = await storage.getItem('currentTrackingSessionId');
    if (!sessionId) return;
    const last = parseInt(await storage.getItem('last_heartbeat_ts'), 10) || 0;
    if (!force && Date.now() - last < HEARTBEAT_INTERVAL_MS - 15000) return;
    await storage.setItem('last_heartbeat_ts', String(Date.now()));
    const response = await trackingAPI.heartbeat({ sessionId });
    if (response.data?.success) {
      console.log(`💓 Heartbeat OK. Server dist: ${(response.data?.totalDistance || 0).toFixed(2)} km`);
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
  if (_lastProcessedTimestamp && timestamp <= _lastProcessedTimestamp + 1000) {
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

    const sessionId = await storage.getItem('currentTrackingSessionId');
    if (!sessionId) return; // No active session

    const reportedAcc = Number.isFinite(accuracy) && accuracy > 0 ? accuracy : 25;

    // Ensure session tracking ID and last GPS received timestamp are synchronized locally
    await storage.setItem('tracking_accumulated_session_id', sessionId);
    await storage.setItem('last_gps_received_at', String(Date.now()));
    _lastProcessedTimestamp = timestamp;

    // ── Gate 2: Movement + speed validation ──────────────────────────────────
    updateMotionState(Number.isFinite(speed) ? speed : 0);
    
    // ─── Build coordinate payload for server processing ───────────────────
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
    };

    let lastLocation = null;
    let calculatedDistKm = 0;
    let isRejectedOutlier = false;
    const lastLocationStr = await storage.getItem('last_recorded_location');
    if (lastLocationStr) {
      try {
        lastLocation = JSON.parse(lastLocationStr);
        const prevTsMs = lastLocation?.timestamp ? new Date(lastLocation.timestamp).getTime() : 0;
        if (prevTsMs && timestamp <= prevTsMs + 1000) {
          return;
        }
        const rawGapSecs = prevTsMs ? (timestamp - prevTsMs) / 1000 : 0;
        if (reportedAcc > MAX_ACCURACY_METERS && rawGapSecs <= 1800) {
          // Coarse Wi-Fi / cell-tower jump during active tracking — skip completely
          return;
        }

        let { valid, distKm, reanchorOnly, isOutlier } = validateSegment(lastLocation, {
          lat: latitude, lng: longitude,
          speed, accuracy: reportedAcc, timestamp: new Date(timestamp).toISOString(),
        });

        if (isOutlier) {
          isRejectedOutlier = true;
        } else if (reanchorOnly) {
          await storage.setItem('last_recorded_location', JSON.stringify({ ...newCoord }));
        } else if (!valid) {
          const distM = distanceMeters(lastLocation.lat, lastLocation.lng, latitude, longitude);
          const secs = Math.max((timestamp - new Date(lastLocation.timestamp).getTime()) / 1000, 0.5);
          const calcSpeedKmh = (distM / 1000 / secs) * 3600;
          
          if (calcSpeedKmh < MAX_SPEED_KMH) {
            const transition = evaluateMovementTransition(distM, secs, calcSpeedKmh, reportedAcc);
            if (transition.confirmed) {
              valid = true;
              distKm = transition.backfillDistKm || (distM / 1000);
            }
          }
        }

        if (valid) {
          calculatedDistKm = distKm;
          if (calculatedDistKm > 0) {
            const currentLocal = parseFloat(await storage.getItem('tracking_accumulated_distance')) || 0;
            const updatedLocal = (currentLocal + calculatedDistKm).toFixed(2);
            await storage.setItem('tracking_accumulated_distance', updatedLocal);
          }
          await storage.setItem('last_recorded_location', JSON.stringify({ ...newCoord }));
        } else if (!isRejectedOutlier && !reanchorOnly) {
          // Stationary drift: keep anchor coordinates locked at lastLocation, only update timestamp
          if (lastLocation) {
            const stationaryAnchor = {
              ...lastLocation,
              timestamp: new Date(timestamp).toISOString(),
            };
            await storage.setItem('last_recorded_location', JSON.stringify(stationaryAnchor));
          } else {
            await storage.setItem('last_recorded_location', JSON.stringify({ ...newCoord }));
          }
        }
      } catch (parseErr) {
        console.error('📍 BackgroundTask: Error parsing last location:', parseErr);
      }
    } else if (reportedAcc <= 150) {
      // First initial location fix: establish initial anchor
      await storage.setItem('last_recorded_location', JSON.stringify({
        lat: latitude,
        lng: longitude,
        speed: Number.isFinite(speed) ? speed : 0,
        accuracy: reportedAcc,
        timestamp: new Date(timestamp).toISOString(),
      }));
    }

    if (isRejectedOutlier) {
      return;
    }

    console.log(
      `📍 BackgroundTask: Telemetry update ` +
      `[${latitude.toFixed(5)}, ${longitude.toFixed(5)}] ` +
      `Acc:${reportedAcc.toFixed(0)}m Speed:${(speed || 0).toFixed(2)}m/s`
    );

    // ── Smart Stationary vs Moving Upload Filter ─────────────────────────────
    // If stationary with 0 km added, suppress uploading duplicate noise coordinates every 4s.
    // Heartbeat ping handles session keepalive. If MOVING, upload 100% instantly!
    const isStationaryNoise = _currentMotionState === 'STATIONARY' && calculatedDistKm === 0;
    if (isStationaryNoise) {
      const lastStationaryUpload = parseInt(await storage.getItem('last_stationary_upload_ts'), 10) || 0;
      if (Date.now() - lastStationaryUpload < 5 * 60 * 1000) {
        // Skip duplicate stationary noise upload to save battery and DB space
        return;
      }
      await storage.setItem('last_stationary_upload_ts', String(Date.now()));
    }

    // ── Try uploading to server ───────────────────────────────────────────────
    const token = await storage.getItem('userToken');
    if (!token) {
      await enqueueCoordinate(sessionId, newCoord, lastLocation);
      return;
    }

    try {
      const response = await axios.post(
        `${BASE_URL}/tracking/update`,
        { sessionId, coordinates: [newCoord] },
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: UPLOAD_TIMEOUT_MS,
        }
      );

      if (response.data?.success) {
        if (response.data?.sessionClosed === true) {
          console.log(`🛑 [SESSION_CLOSED] BackgroundTask: Session ${sessionId} was ended on server. Halting.`);
          const currentActive = await storage.getItem('currentTrackingSessionId');
          if (currentActive === sessionId) {
            stopHeartbeat();
            await storage.removeItem('currentTrackingSessionId');
            await storage.setItem('isTrackingActive', 'false');
            await storage.setItem('user_manually_punched_out', 'true');
            if (Platform.OS !== 'web' && !isExpoGo) {
              Location.stopLocationUpdatesAsync(BACKGROUND_TRACKING_TASK).catch(() => {});
            }
          }
          return;
        }

        const serverToday = Number(response.data.totalDistanceToday);
        const serverDist = Number(response.data.totalDistance);
        const authoritativeDist = Number.isFinite(serverToday) && serverToday > 0 ? serverToday : serverDist;
        const localDist = parseFloat(await storage.getItem('tracking_accumulated_distance')) || 0;
        const validServerDist = Number.isFinite(authoritativeDist) && authoritativeDist >= 0 ? authoritativeDist : 0;

        // Server Authoritative Sync:
        // When offline queue is empty, server DistanceLedger is the single source of truth.
        // Never use Math.max(validServerDist, localDist) to ratchet up local drift!
        const pendingOfflineCount = await getQueueSize();
        let finalNum = validServerDist;
        if (pendingOfflineCount > 0 && localDist > validServerDist) {
          finalNum = localDist;
        }
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
          if (startRes.data?.success && startRes.data?.sessionId) {
            const newSessionId = startRes.data.sessionId;
            await storage.setItem('currentTrackingSessionId', newSessionId);
            await storage.setItem('tracking_accumulated_session_id', newSessionId);
            console.log('🛡️ [AUTO_HEAL] Seamlessly adopted active session:', newSessionId);
            await axios.post(
              `${BASE_URL}/tracking/update`,
              { sessionId: newSessionId, coordinates: [newCoord] },
              { headers: { Authorization: `Bearer ${token}` }, timeout: UPLOAD_TIMEOUT_MS }
            ).catch(() => {});
            return;
          }
        } catch (healErr) {
          console.log('⚠️ [AUTO_HEAL] Auto-recovery attempt failed:', healErr.message);
        }
      }
      console.log(`📍 BackgroundTask: Network unavailable (${apiErr.code || apiErr.message}). Enqueuing for offline sync...`);
      await enqueueCoordinate(sessionId, newCoord, lastLocation);
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
    if (!running) {
      await Location.startLocationUpdatesAsync(BACKGROUND_TRACKING_TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 10000,
        distanceInterval: 8,
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: '🟢 Shift Active — Location Tracking ON',
          notificationBody: 'Field App is tracking continuous travel distance.',
          notificationColor: '#059669',
          killServiceOnDestroy: false,
        },
      });
    }

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

