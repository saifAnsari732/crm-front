import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { storage } from './storage';
import axios from 'axios';
import { BASE_URL } from './api';
import { enqueueCoordinate, flushOfflineQueue, haversineKm } from './offlineSync';
import { scheduleNoMovementNotification } from './trackingNotification';

export const BACKGROUND_TRACKING_TASK = 'BACKGROUND_TRACKING';

// ─── Thresholds ───────────────────────────────────────────────────────────────
const MIN_ACCURACY_METERS = 120;
const MIN_MOVE_METERS = 5;       // Must move at least 10m to count as movement (captures road curves perfectly)
const STATIONARY_SPEED_MPS = 0.5; // Below this, GPS fixes are treated as stationary unless the jump is substantial.
const STATIONARY_DRIFT_METERS = 120;
const MAX_SPEED_KMH = 200;        // Anything faster is a GPS teleport glitch, ignore

// ─── Haversine in meters ──────────────────────────────────────────────────────
function getDistanceMeters(lat1, lon1, lat2, lon2) {
  return haversineKm(lat1, lon1, lat2, lon2) * 1000;
}

// ─── Background Task Definition ───────────────────────────────────────────────
const processLocation = async (location) => {
  const { latitude, longitude, speed, accuracy, heading } = location.coords;
  const timestamp = location.timestamp;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(timestamp)) {
    console.log('📍 BackgroundTask: Invalid GPS payload, skipping.');
    return;
  }

  // ── Gate 1: Poor GPS accuracy → ignore ──────────────────────────────────
  if (accuracy > MIN_ACCURACY_METERS) {
    console.log(`📍 BackgroundTask: Low accuracy (${accuracy.toFixed(0)}m), skipping.`);
    return;
  }

  try {
    const sessionId = await storage.getItem('currentTrackingSessionId');
    if (!sessionId) return; // No active shift

    // ── Gate 2: Movement check vs last position ──────────────────────────────
    const lastLocationStr = await storage.getItem('last_recorded_location');
    let lastLocation = null;

    if (lastLocationStr) {
      try {
        lastLocation = JSON.parse(lastLocationStr);
        const distMeters = getDistanceMeters(lastLocation.lat, lastLocation.lng, latitude, longitude);

        // Dynamic threshold: if GPS accuracy is poor, require slightly more distance to prevent drift
        // BUT cap at 50m max — otherwise pocket GPS (accuracy 200-400m) would need 200m+ movement to register!
        // Keep the movement gate small enough for slow starts and short GPS intervals.
        // Android often reports 0 or an unknown speed while the phone is in a pocket,
        // so distance and the backend teleport guard are the reliable signals.
        const rawThreshold = accuracy > 30 ? Math.max(MIN_MOVE_METERS, accuracy * 0.15) : MIN_MOVE_METERS;
        const movementThreshold = Math.min(rawThreshold, 25);
        const distTooShort = distMeters < movementThreshold;

        if (distTooShort) {
          // Not moving. Skip this point entirely.
          return;
        }

        // A parked phone can wander tens of metres between fixes. Do not turn
        // low-speed accuracy drift into distance; a moving bike normally
        // exceeds this distance between 10-second GPS updates.
        const timeDiffSecs = lastLocation.timestamp
          ? (timestamp - new Date(lastLocation.timestamp).getTime()) / 1000
          : 0;
        const reportedSpeedMps = Number(speed);
        // A fix with no reliable speed and mediocre accuracy is GPS drift, not
        // travelled distance. Do not let a location jump inflate the cache.
        if ((!Number.isFinite(reportedSpeedMps) || reportedSpeedMps < STATIONARY_SPEED_MPS) && accuracy > 30) {
          return;
        }
        const accuracyDriftLimit = Math.max(STATIONARY_DRIFT_METERS, (accuracy || 0) * 0.75);
        const calculatedSpeedMps = timeDiffSecs > 0 ? distMeters / timeDiffSecs : 0;
        const effectiveSpeedMps = Math.max(reportedSpeedMps || 0, calculatedSpeedMps);
        if (effectiveSpeedMps < STATIONARY_SPEED_MPS && distMeters < accuracyDriftLimit) {
          return;
        }

        // ── Gate 3: Unrealistic teleport check ────────────────────────────────

        if (timeDiffSecs > 0) {
          const calculatedSpeedKmh = (distMeters / 1000) / (timeDiffSecs / 3600);
          if (calculatedSpeedKmh > MAX_SPEED_KMH) {
            console.log(`📍 BackgroundTask: GPS teleport detected (${calculatedSpeedKmh.toFixed(0)} km/h). Ignoring.`);
            return;
          }
        }

      } catch (parseErr) {
        console.error('📍 BackgroundTask: Error parsing last location:', parseErr);
      }
    }

    // ─── Employee is genuinely moving. Process this point. ───────────────────
    const newCoord = {
      eventId: `${sessionId}:${timestamp}:${latitude.toFixed(6)}:${longitude.toFixed(6)}`,
      lat: latitude,
      lng: longitude,
      speed: speed || 0,
      accuracy: accuracy || 0,
      heading: heading || 0,
      timestamp: new Date(timestamp).toISOString(),
    };

    // Update last recorded location in storage FIRST (so next tick has reference)
    await storage.setItem('last_recorded_location', JSON.stringify(newCoord));
    await scheduleNoMovementNotification(sessionId);

    // Persist a monotonic local checkpoint immediately. This is the key no-loss
    // guarantee: even if the network drops or the OS kills the app, the accepted
    // movement is still retained in local storage before the server reply arrives.
    const previousLocalDistance = Number.parseFloat(await storage.getItem('tracking_accumulated_distance')) || 0;
    const segmentKm = lastLocation ? haversineKm(lastLocation.lat, lastLocation.lng, latitude, longitude) : 0;
    const nextLocalDistance = previousLocalDistance + (Number.isFinite(segmentKm) ? segmentKm : 0);
    await storage.setItem('tracking_accumulated_distance', Math.max(previousLocalDistance, nextLocalDistance).toFixed(3));

    console.log(`📍 BackgroundTask: ✅ Movement detected! [${latitude.toFixed(5)}, ${longitude.toFixed(5)}] | Acc:${accuracy.toFixed(0)}m | Speed:${(speed || 0).toFixed(1)}m/s`);

    // ─── Try uploading to server ─────────────────────────────────────────────
    const token = await storage.getItem('userToken');
    if (!token) {
      // No token → accumulate locally only
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
          timeout: 7000, // Generous timeout for background
        }
      );

      if (response.data?.success) {
        // Server confirms distance. Sync local cache with server's authoritative value.
        const serverDistance = response.data.totalDistance || 0;
        await storage.setItem('tracking_accumulated_distance', serverDistance.toFixed(3));
        uploadedToServer = true;
        console.log(`📍 BackgroundTask: Server synced. Total: ${serverDistance.toFixed(2)} km`);
      }
    } catch (apiErr) {
      console.log(`📍 BackgroundTask: Internet unavailable (${apiErr.code || apiErr.message}). Queuing locally...`);
    }

    // ─── If upload failed → save to offline queue ────────────────────────────
    if (!uploadedToServer) {
      await enqueueCoordinate(sessionId, newCoord, lastLocation);
    } else {
      // Upload succeeded — also flush any pending offline items in the background
      flushOfflineQueue().catch(() => {});
    }

  } catch (e) {
    console.error('📍 BackgroundTask: Unhandled error in background tick:', e);
  }
};

TaskManager.defineTask(BACKGROUND_TRACKING_TASK, async ({ data: { locations }, error }) => {
  if (error) {
    console.error('📍 BackgroundTask Error:', error.message);
    return;
  }

  if (!locations || locations.length === 0) return;

  // Android may batch several GPS fixes while the phone is locked or in a pocket.
  // Process every fix in timestamp order so route segments are never discarded.
  const orderedLocations = [...locations].sort((a, b) => a.timestamp - b.timestamp);
  for (const location of orderedLocations) {
    await processLocation(location);
  }
});
