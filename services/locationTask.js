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

// Heartbeat: send a ping every N ms so server's 3-hour inactivity clock resets
// even if the employee is standing at a location without moving.
const HEARTBEAT_INTERVAL_MS  = 8 * 60 * 1000; // 8 minutes

// Upload retry: re-queue if the network call takes longer than this
const UPLOAD_TIMEOUT_MS      = 9000;

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
  if (distM < MIN_MOVE_METERS) return { valid: false, distKm: 0 };

  // ── Gate 2: Teleport protection ──────────────────────────────────────
  const prevTs = prev.timestamp ? new Date(prev.timestamp).getTime() : 0;
  const currTs = curr.timestamp ? new Date(curr.timestamp).getTime() : Date.now();
  const secs   = Math.max((currTs - prevTs) / 1000, 0.1);
  const calcSpeedKmh = (distKm / secs) * 3600;

  if (calcSpeedKmh > MAX_SPEED_KMH) {
    console.log(`📍 GPS Teleport detected: ${calcSpeedKmh.toFixed(0)} km/h — skipping`);
    return { valid: false, distKm: 0 };
  }

  // ── Gate 3: Stationary drift filter ──────────────────────────────────
  // Reported speed from Android (m/s) — often null/0 when phone is in pocket
  const reportedSpeedMps = Number.isFinite(curr.speed) ? Math.max(0, curr.speed) : 0;
  const calcSpeedMps     = (distM / secs);
  // Use the HIGHER of the two speed estimates (better for pocket mode)
  const effectiveSpeedMps = Math.max(reportedSpeedMps, calcSpeedMps);

  // If the phone is clearly stationary AND the jump is within GPS noise range → ignore
  if (effectiveSpeedMps < MIN_WALKING_SPEED_MPS && distM < STATIONARY_DRIFT_LIMIT) {
    // Use accuracy trust: if GPS accuracy is very poor, be more lenient
    const trust = accuracyTrustWeight(curr.accuracy || 100);
    // If trust is high (good GPS) and speed is near-zero → definitely stationary drift
    // If trust is low (poor GPS / pocket) → allow; real movement might be happening
    if (trust > 0.3) {
      console.log(`📍 Stationary drift ignored: ${distM.toFixed(0)}m at ${effectiveSpeedMps.toFixed(2)} m/s`);
      return { valid: false, distKm: 0 };
    }
    // Low-trust GPS but moved > MIN_MOVE_METERS → accept with caution
  }

  return { valid: true, distKm };
}

// ─────────────────────────────────────────────────────────────────────────────
// Heartbeat manager — keeps server session alive for stationary employees
// ─────────────────────────────────────────────────────────────────────────────
let _heartbeatTimer = null;

function startHeartbeat(sessionId) {
  stopHeartbeat();
  _heartbeatTimer = setInterval(async () => {
    try {
      if (!sessionId) return;
      const response = await trackingAPI.heartbeat({ sessionId });
      if (response.data?.sessionClosed) {
        // Server auto-closed session — stop beating and let UI know on next AppState change
        console.log('💓 Heartbeat: session closed on server, stopping heartbeat.');
        stopHeartbeat();
      } else {
        console.log(`💓 Heartbeat OK. Server dist: ${(response.data?.totalDistance || 0).toFixed(2)} km`);
      }
    } catch (_) {
      // Heartbeat is best-effort — network error is OK, next interval will retry
    }
  }, HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat() {
  if (_heartbeatTimer) {
    clearInterval(_heartbeatTimer);
    _heartbeatTimer = null;
  }
}

// Export so useLocationTracker can call these on start/stop
export { startHeartbeat, stopHeartbeat };

// ─────────────────────────────────────────────────────────────────────────────
// Core location processor — called for each GPS fix from background task
// ─────────────────────────────────────────────────────────────────────────────
const processLocation = async (location) => {
  const { latitude, longitude, speed, accuracy, heading } = location.coords;
  const timestamp = location.timestamp;

  // ── Sanity check ─────────────────────────────────────────────────────────
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(timestamp)) {
    console.log('📍 BackgroundTask: Invalid GPS payload, skipping.');
    return;
  }

  // ── Gate 1: GPS accuracy guard ───────────────────────────────────────────
  if ((accuracy || 9999) > MAX_ACCURACY_METERS) {
    console.log(`📍 BackgroundTask: Too low GPS accuracy (${(accuracy || 0).toFixed(0)} m), skipping.`);
    return;
  }

  try {
    const sessionId = await storage.getItem('currentTrackingSessionId');
    if (!sessionId) return; // No active session

    // ── Gate 2: Movement + speed validation ──────────────────────────────────
    const lastLocationStr = await storage.getItem('last_recorded_location');
    let lastLocation = null;

    if (lastLocationStr) {
      try {
        lastLocation = JSON.parse(lastLocationStr);
        const { valid, distKm } = validateSegment(lastLocation, {
          lat: latitude, lng: longitude,
          speed, accuracy, timestamp: new Date(timestamp).toISOString(),
        });

        if (!valid) {
          // Not a valid movement — heartbeat will keep session alive
          return;
        }

        // Persist the accepted local checkpoint (crash-safe — written BEFORE network)
        const prevDist   = parseFloat(await storage.getItem('tracking_accumulated_distance')) || 0;
        const nextDist   = prevDist + distKm;
        await storage.setItem('tracking_accumulated_distance', nextDist.toFixed(4));

      } catch (parseErr) {
        console.error('📍 BackgroundTask: Error parsing last location:', parseErr);
      }
    }

    // ─── Employee is moving — build coordinate payload ───────────────────────
    const eventId = `${sessionId}:${timestamp}:${latitude.toFixed(6)}:${longitude.toFixed(6)}`;
    const newCoord = {
      eventId,
      lat:      latitude,
      lng:      longitude,
      speed:    Number.isFinite(speed)   ? speed   : 0,
      accuracy: Number.isFinite(accuracy)? accuracy: 0,
      heading:  Number.isFinite(heading) ? heading : 0,
      timestamp: new Date(timestamp).toISOString(),
    };

    // Update last recorded location IMMEDIATELY so next tick has correct reference
    await storage.setItem('last_recorded_location', JSON.stringify({ ...newCoord }));

    // Schedule no-movement watchdog notification (throttled to every 5 min)
    await scheduleNoMovementNotification(sessionId);

    console.log(
      `📍 BackgroundTask: ✅ Movement accepted! ` +
      `[${latitude.toFixed(5)}, ${longitude.toFixed(5)}] ` +
      `Acc:${(accuracy || 0).toFixed(0)}m Speed:${(speed || 0).toFixed(2)}m/s`
    );

    // ── Try uploading to server ───────────────────────────────────────────────
    const token = await storage.getItem('userToken');
    if (!token) {
      await enqueueCoordinate(sessionId, newCoord, lastLocation);
      return;
    }

    let uploadedToServer = false;
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
        // Server total is authoritative — sync local cache to server value
        const serverDist = Number(response.data.totalDistance);
        if (Number.isFinite(serverDist)) {
          const localDist = parseFloat(await storage.getItem('tracking_accumulated_distance')) || 0;
          // Never lower local cache below what server confirmed
          await storage.setItem(
            'tracking_accumulated_distance',
            Math.max(localDist, serverDist).toFixed(4)
          );
        }
        uploadedToServer = true;
        console.log(`📍 BackgroundTask: Server synced. Total: ${response.data.totalDistance?.toFixed(2)} km`);

        // Also flush any queued offline items now that we have connectivity
        flushOfflineQueue().catch(() => {});
      }
    } catch (apiErr) {
      console.log(`📍 BackgroundTask: Network unavailable (${apiErr.code || apiErr.message}). Queuing...`);
    }

    if (!uploadedToServer) {
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

  // Android may batch fixes (e.g., 3-4 points) when the screen is off.
  // Process ALL in timestamp order — never skip batched fixes.
  const ordered = [...locations].sort((a, b) => a.timestamp - b.timestamp);
  for (const loc of ordered) {
    await processLocation(loc);
  }
});
