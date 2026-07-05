import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { storage } from './storage';
import axios from 'axios';
import { BASE_URL } from './api';
import { enqueueCoordinate, flushOfflineQueue, haversineKm } from './offlineSync';

export const BACKGROUND_TRACKING_TASK = 'BACKGROUND_TRACKING';

// ─── Thresholds ───────────────────────────────────────────────────────────────
const MIN_ACCURACY_METERS = 50;   // Ignore readings worse than 50m accuracy
const MIN_MOVE_METERS = 30;       // Must move at least 30m to count as movement
const MIN_SPEED_MS = 0.5;         // Must be moving at ≥0.5 m/s (1.8 km/h) to count
const MAX_SPEED_KMH = 200;        // Anything faster is a GPS teleport glitch, ignore

// ─── Haversine in meters ──────────────────────────────────────────────────────
function getDistanceMeters(lat1, lon1, lat2, lon2) {
  return haversineKm(lat1, lon1, lat2, lon2) * 1000;
}

// ─── Background Task Definition ───────────────────────────────────────────────
TaskManager.defineTask(BACKGROUND_TRACKING_TASK, async ({ data: { locations }, error }) => {
  if (error) {
    console.error('📍 BackgroundTask Error:', error.message);
    return;
  }

  if (!locations || locations.length === 0) return;

  const location = locations[0];
  const { latitude, longitude, speed, accuracy, heading } = location.coords;
  const timestamp = location.timestamp;

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

        // Dynamic threshold: if GPS accuracy is borderline (20-50m), require more distance
        const movementThreshold = accuracy > 20 ? MIN_MOVE_METERS * 1.5 : MIN_MOVE_METERS;

        // Speed check: combined guard. If OS says speed < 0.5 m/s AND distance is small → definitely not moving
        const speedTooLow = speed >= 0 && speed < MIN_SPEED_MS && distMeters < 60;
        const distTooShort = distMeters < movementThreshold;

        if (distTooShort || speedTooLow) {
          // Not moving. Skip this point entirely.
          return;
        }

        // ── Gate 3: Unrealistic teleport check ────────────────────────────────
        const timeDiffSecs = lastLocation.timestamp
          ? (Date.now() - new Date(lastLocation.timestamp).getTime()) / 1000
          : 0;

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
      lat: latitude,
      lng: longitude,
      speed: speed || 0,
      accuracy: accuracy || 0,
      heading: heading || 0,
      timestamp: new Date(timestamp).toISOString(),
    };

    // Update last recorded location in storage FIRST (so next tick has reference)
    await storage.setItem('last_recorded_location', JSON.stringify(newCoord));

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
});
