/**
 * tripPlannerBackground.js
 * 
 * Persistent Background GPS Tracking Engine for Trip Planner
 * ─────────────────────────────────────────────────────────────────────────────
 * Ensures that when an employee locks their phone screen (display off) and
 * moves towards their planned destination:
 *   1. GPS fixes continue to be collected via Android Foreground Service.
 *   2. Physical movement meters are persistently accumulated in AsyncStorage.
 *   3. When employee enters within 500m radius of destination, an immediate
 *      lock-screen notification is pushed and arrival flag is recorded.
 *   4. Full KM claim is ONLY available when employee is within 500m of destination.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Platform } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { storage } from './storage';

let Notifications = null;
try {
  Notifications = require('expo-notifications');
} catch (_) {}

export const BACKGROUND_TRIP_PLANNER_TASK = 'BACKGROUND_TRIP_PLANNER_TASK';

// ── Haversine Distance in Meters ──
export function haversineMeters(lat1, lon1, lat2, lon2) {
  if (!Number.isFinite(lat1) || !Number.isFinite(lon1) || !Number.isFinite(lat2) || !Number.isFinite(lon2)) {
    return 0;
  }
  const R = 6371000; // Radius of Earth in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ─────────────────────────────────────────────────────────────────────────────
// Define OS Background Task for Trip Planner
// ─────────────────────────────────────────────────────────────────────────────
TaskManager.defineTask(BACKGROUND_TRIP_PLANNER_TASK, async ({ data: { locations }, error }) => {
  if (error) {
    console.error('🚗 [TRIP_BG] Task Error:', error.message);
    return;
  }
  if (!locations || locations.length === 0) return;

  try {
    const status = await storage.getItem('active_trip_planner_status');
    if (status !== 'IN_PROGRESS') {
      // Trip is no longer in progress, skip processing
      return;
    }

    const destStr = await storage.getItem('active_trip_planner_destination');
    const destination = destStr ? JSON.parse(destStr) : null;

    const prevLocStr = await storage.getItem('active_trip_planner_last_loc');
    let prevLoc = prevLocStr ? JSON.parse(prevLocStr) : null;

    let currentM = parseInt(await storage.getItem('active_trip_planner_traveled_m'), 10) || 0;

    // Process incoming GPS fixes in chronological order
    const ordered = [...locations].sort((a, b) => a.timestamp - b.timestamp);

    for (const loc of ordered) {
      if (!loc?.coords) continue;
      const { latitude, longitude, speed, accuracy } = loc.coords;
      const timestamp = loc.timestamp || Date.now();

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
      if (loc.mocked || loc.coords?.isMocked) continue; // anti-spoof

      const currLoc = { lat: latitude, lng: longitude, speed: speed || 0, accuracy: accuracy || 10, timestamp };

      if (prevLoc) {
        const distM = haversineMeters(prevLoc.lat, prevLoc.lng, latitude, longitude);
        const timeDiffSec = Math.max(1, (timestamp - (prevLoc.timestamp || timestamp)) / 1000);
        const calcSpeedKmh = (distM / 1000 / timeDiffSec) * 3600;

        // Validation gate:
        // Accept if moved >= 4m and realistic speed (< 180 km/h)
        if (distM >= 4.0 && calcSpeedKmh < 180) {
          currentM += Math.round(distM);
          prevLoc = currLoc;
          console.log(`🚗 [TRIP_BG] Moved +${distM.toFixed(1)}m. Total: ${currentM}m (${(currentM / 1000).toFixed(2)} KM)`);
        }
      } else {
        prevLoc = currLoc;
      }

      // Check distance to destination
      if (destination?.lat && destination?.lng) {
        const distToDest = haversineMeters(latitude, longitude, Number(destination.lat), Number(destination.lng));
        console.log(`🚗 [TRIP_BG] Distance to destination: ${distToDest.toFixed(0)}m`);

        // 500M Arrival Trigger:
        if (distToDest <= 500) {
          await storage.setItem('active_trip_planner_is_within_500m', 'true');
          const alreadyNotified = await storage.getItem('active_trip_planner_notified_500m');

          if (alreadyNotified !== 'true') {
            await storage.setItem('active_trip_planner_notified_500m', 'true');
            console.log('🎯 [TRIP_BG] ARRIVED within 500m of destination! Pushing lock-screen notification.');

            if (Notifications && typeof Notifications.scheduleNotificationAsync === 'function') {
              try {
                await Notifications.scheduleNotificationAsync({
                  content: {
                    title: '🎯 Destination Reached!',
                    body: 'Aap destination ke 500m radius me aa chuke hain! Tap karke apna full planned KM credit karein.',
                    sound: true,
                    priority: Notifications.AndroidNotificationPriority.HIGH,
                  },
                  trigger: null,
                });
              } catch (nErr) {
                console.warn('⚠️ Notification trigger notice:', nErr.message);
              }
            }
          }
        }
      }
    }

    // Persist latest state to AsyncStorage
    await storage.setItem('active_trip_planner_traveled_m', String(currentM));
    if (prevLoc) {
      await storage.setItem('active_trip_planner_last_loc', JSON.stringify(prevLoc));
    }
  } catch (err) {
    console.error('🚗 [TRIP_BG] Error handling background location tick:', err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Start Background Tracking for Planned Trip
// ─────────────────────────────────────────────────────────────────────────────
export async function startTripBackgroundTracking(destination) {
  if (Platform.OS === 'web') return false;

  try {
    // 1. Verify / Request foreground permissions
    const fg = await Location.getForegroundPermissionsAsync();
    if (fg.status !== 'granted') {
      const fgReq = await Location.requestForegroundPermissionsAsync();
      if (fgReq.status !== 'granted') return false;
    }

    // 2. Request background permission for display-off tracking
    try {
      const bg = await Location.getBackgroundPermissionsAsync();
      if (bg.status !== 'granted') {
        await Location.requestBackgroundPermissionsAsync();
      }
    } catch (_) {}

    // 3. Reset 500m arrival notification locks
    await storage.setItem('active_trip_planner_is_within_500m', 'false');
    await storage.setItem('active_trip_planner_notified_500m', 'false');

    // 4. Start OS-level location updates with Sticky Foreground Service
    const isStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TRIP_PLANNER_TASK).catch(() => false);
    if (!isStarted) {
      await Location.startLocationUpdatesAsync(BACKGROUND_TRIP_PLANNER_TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 3000,
        distanceInterval: 4,
        deferredUpdatesInterval: 3000,
        showsBackgroundLocationIndicator: true,
        pausesUpdatesAutomatically: false,
        foregroundService: {
          notificationTitle: '🚗 Trip In Progress',
          notificationBody: destination?.address
            ? `Heading to: ${destination.address.slice(0, 36)}...`
            : 'Recording trip distance in background.',
          notificationColor: '#10b981',
          killServiceOnDestroy: false,
        },
      });
      console.log('🚗 [TRIP_BG] Background tracking task successfully started with foreground service!');
    }
    return true;
  } catch (err) {
    console.warn('🚗 [TRIP_BG] Failed to start trip background task:', err.message);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stop Background Tracking
// ─────────────────────────────────────────────────────────────────────────────
export async function stopTripBackgroundTracking() {
  if (Platform.OS === 'web') return;

  try {
    const isStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TRIP_PLANNER_TASK).catch(() => false);
    if (isStarted) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_TRIP_PLANNER_TASK);
      console.log('🚗 [TRIP_BG] Background tracking task stopped.');
    }
  } catch (err) {
    console.warn('🚗 [TRIP_BG] Failed to stop trip background task:', err.message);
  }
}
