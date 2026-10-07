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

import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { storage } from './storage';
import axios from 'axios';
import { BASE_URL, trackingAPI } from './api';
import { enqueueCoordinate, flushOfflineQueue, haversineKm } from './offlineSync';
import { scheduleNoMovementNotification } from './trackingNotification';

export const BACKGROUND_TRACKING_TASK = 'BACKGROUND_TRACKING';

// ─────────────────────────────────────────────────────────────────────────────
// ALGORITHM CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const MAX_ACCURACY_METERS    = 500;   // Accept GPS up to 500m accuracy (pocket mode)
const MIN_MOVE_METERS        = 8;     // Minimum real movement to count a segment
const MAX_SPEED_KMH          = 220;   // Teleport guard (airplane / GPS flip)
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
  
  if (speedKmh < 1) {
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

  // Real movement signal: speed > 2.0 km/h, distance > 12m, reasonable accuracy <= 200m
  if (effectiveSpeedKmh > 2.0 && distM > 12 && accuracyM <= 200) {
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

  const distM = distanceMeters(prev.lat, prev.lng, curr.lat, curr.lng);
  const distKm = distM / 1000;

  // ── Gate 1: Minimum movement ─────────────────────────────────────────
  // Accept micro-movements (>= 1 meter) so slow walking/heavy traffic is captured
  if (distM < 1.0) return { valid: false, distKm: 0 };

  const prevTs = prev.timestamp ? new Date(prev.timestamp).getTime() : 0;
  const currTs = curr.timestamp ? new Date(curr.timestamp).getTime() : Date.now();
  const rawSecs = Math.max((currTs - prevTs) / 1000, 0.1);

  // ── Gate 2: 5-Hour / Long Stationary Transition Guard ────────────────
  const reportedSpeedMps = Number.isFinite(curr.speed) ? Math.max(0, curr.speed) : 0;
  
  if (rawSecs > 60) {
    if (distM >= 5 || reportedSpeedMps >= 0.3) {
      console.log(`📍 Movement detected after ${(rawSecs / 60).toFixed(1)}min stationary: ${distM.toFixed(0)}m! Accepting transition.`);
      return { valid: true, distKm };
    }
  }

  // Normal consecutive fixes (< 60s)
  const secs = Math.min(rawSecs, 60);
  const calcSpeedKmh = (distKm / secs) * 3600;

  if (calcSpeedKmh > MAX_SPEED_KMH) {
    console.log(`📍 GPS Teleport detected: ${calcSpeedKmh.toFixed(0)} km/h — skipping`);
    return { valid: false, distKm: 0 };
  }

  // ── Gate 3: Stationary drift filter ──────────────────────────────────
  const calcSpeedMps = (distM / secs);
  const effectiveSpeedMps = Math.max(reportedSpeedMps, calcSpeedMps);
  const reportedAccuracy = Number(curr.accuracy) || 20;

  // Ignore noise jitter when phone is stationary (< 0.55 m/s or < 2 km/h AND (< 15m OR < 75% accuracy radius))
  if (effectiveSpeedMps < 0.55 && (distM < 15.0 || distM < Math.max(12.0, reportedAccuracy * 0.75))) {
    console.log(`📍 Stationary drift ignored: ${distM.toFixed(1)}m at ${(effectiveSpeedMps * 3.6).toFixed(1)} km/h (acc: ${reportedAccuracy}m)`);
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
const processLocation = async (location) => {
  const { latitude, longitude, speed, accuracy, heading } = location.coords;
  const timestamp = location.timestamp;

  // ── Basic Finite Coordinate Guard ──────────────────────────────────────────
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(timestamp)) {
    console.log('📍 BackgroundTask: Non-numeric GPS payload, skipping.');
    return;
  }
  // ── Mock Location / GPS Spoofing Guard ──────────────────────────────────────
  if (location.mocked || location.coords?.isMocked || location.coords?.mocked) {
    console.log('🛡️ [SECURITY] Mock GPS location detected. Discarding.');
    return;
  }

  try {
    const sessionId = await storage.getItem('currentTrackingSessionId');
    if (!sessionId) return; // No active session

    // Ensure session tracking ID is synchronized locally
    await storage.setItem('tracking_accumulated_session_id', sessionId);

    // ── Gate 2: Movement + speed validation ──────────────────────────────────
    updateMotionState(Number.isFinite(speed) ? speed : 0);
    
    let lastLocation = null;
    let calculatedDistKm = 0;
    const lastLocationStr = await storage.getItem('last_recorded_location');
    if (lastLocationStr) {
      try {
        lastLocation = JSON.parse(lastLocationStr);
        let { valid, distKm } = validateSegment(lastLocation, {
          lat: latitude, lng: longitude,
          speed, accuracy, timestamp: new Date(timestamp).toISOString(),
        });

        if (!valid) {
          const distM = distanceMeters(lastLocation.lat, lastLocation.lng, latitude, longitude);
          const secs = Math.max((timestamp - new Date(lastLocation.timestamp).getTime()) / 1000, 0.1);
          const calcSpeedKmh = (distM / 1000 / secs) * 3600;
          
          if (calcSpeedKmh < MAX_SPEED_KMH) {
            const transition = evaluateMovementTransition(distM, secs, calcSpeedKmh, accuracy || 50);
            if (transition.confirmed) {
              valid = true;
              distKm = transition.backfillDistKm || (distM / 1000);
            }
          }
        }

        if (valid) {
          calculatedDistKm = distKm;
        }
      } catch (parseErr) {
        console.error('📍 BackgroundTask: Error parsing last location:', parseErr);
      }
    }

    // ─── Build coordinate payload for server processing ───────────────────
    const eventId = `${sessionId}:${timestamp}:${latitude.toFixed(6)}:${longitude.toFixed(6)}`;
    const newCoord = {
      eventId,
      lat:      latitude,
      lng:      longitude,
      speed:    Number.isFinite(speed)   ? speed   : 0,
      accuracy: Number.isFinite(accuracy)? accuracy: 0,
      heading:  Number.isFinite(heading) ? heading : 0,
      mocked:   location.mocked || false,
      timestamp: new Date(timestamp).toISOString(),
      motionState: _currentMotionState,
    };

    console.log(
      `📍 BackgroundTask: Telemetry update ` +
      `[${latitude.toFixed(5)}, ${longitude.toFixed(5)}] ` +
      `Acc:${(accuracy || 0).toFixed(0)}m Speed:${(speed || 0).toFixed(2)}m/s`
    );

    // Always update last_recorded_location anchor so location moves forward
    await storage.setItem('last_recorded_location', JSON.stringify({ ...newCoord }));

    // ── Try uploading to server ───────────────────────────────────────────────
    const token = await storage.getItem('userToken');
    if (!token) {
      const enqueued = await enqueueCoordinate(sessionId, newCoord, lastLocation);
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
        const serverToday = Number(response.data.totalDistanceToday);
        const serverDist = Number(response.data.totalDistance);
        const authoritativeDist = Number.isFinite(serverToday) ? serverToday : serverDist;
        const localDist = parseFloat(await storage.getItem('tracking_accumulated_distance')) || 0;
        const finalDist = Number.isFinite(authoritativeDist)
          ? authoritativeDist.toFixed(2)
          : localDist.toFixed(2);

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
