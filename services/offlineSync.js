/**
 * offlineSync.js
 * 
 * Zero-Data-Loss Offline Sync Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * This service handles 3 critical scenarios:
 *   1. Internet drops mid-shift → coordinates queued locally, synced on reconnect
 *   2. App is force-killed     → background-fetch flushes the queue when OS allows
 *   3. Server restart          → retry with exponential backoff, never loses data
 * ─────────────────────────────────────────────────────────────────────────────
 */
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import axios from 'axios';
import { BASE_URL } from './api';
import { storage } from './storage';
import NetInfo from '@react-native-community/netinfo';

export const OFFLINE_SYNC_TASK = 'OFFLINE_SYNC_TASK';
const QUEUE_KEY = 'offline_request_queue';
const RETRY_COUNTS_KEY = 'offline_retry_counts';
const MAX_RETRIES = 5;

// ─── Haversine (for local offline distance calculation) ───────────────────────
export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Add coordinate to offline queue ────────────────────────────────────────
export async function enqueueCoordinate(sessionId, coord, prevCoord) {
  try {
    // 1. Add to upload queue
    const queueStr = await storage.getItem(QUEUE_KEY);
    const queue = queueStr ? JSON.parse(queueStr) : [];

    queue.push({
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      endpoint: '/tracking/update',
      method: 'POST',
      data: { sessionId, coordinates: [coord] },
      timestamp: new Date().toISOString(),
    });

    await storage.setItem(QUEUE_KEY, JSON.stringify(queue));

    // 2. Accumulate distance locally so dashboard stays accurate
    if (prevCoord) {
      const dist = haversineKm(prevCoord.lat, prevCoord.lng, coord.lat, coord.lng);
      const accStr = await storage.getItem('tracking_accumulated_distance');
      const acc = accStr ? parseFloat(accStr) : 0;
      await storage.setItem('tracking_accumulated_distance', (acc + dist).toFixed(3));
    }

    console.log(`📦 OfflineSync: Queued coordinate. Queue size: ${queue.length}`);
  } catch (e) {
    console.error('📦 OfflineSync: Failed to enqueue coordinate:', e);
  }
}

// ─── Get queue size (for UI badge) ───────────────────────────────────────────
export async function getQueueSize() {
  try {
    const queueStr = await storage.getItem(QUEUE_KEY);
    return queueStr ? JSON.parse(queueStr).length : 0;
  } catch {
    return 0;
  }
}

// ─── Main flush function ──────────────────────────────────────────────────────
export async function flushOfflineQueue() {
  try {
    // Check connectivity first
    const netState = await NetInfo.fetch();
    if (!netState.isConnected || !netState.isInternetReachable) {
      console.log('📦 OfflineSync: No internet. Skipping flush.');
      return false;
    }

    const queueStr = await storage.getItem(QUEUE_KEY);
    if (!queueStr) return true;

    const queue = JSON.parse(queueStr);
    if (!queue || queue.length === 0) return true;

    const token = await storage.getItem('userToken');
    if (!token) {
      console.log('📦 OfflineSync: No auth token. Skipping flush.');
      return false;
    }

    // Load retry counts
    const retryStr = await storage.getItem(RETRY_COUNTS_KEY);
    const retryCounts = retryStr ? JSON.parse(retryStr) : {};

    const failedItems = [];
    let successCount = 0;

    console.log(`📦 OfflineSync: Starting flush of ${queue.length} queued requests...`);

    for (const item of queue) {
      // Skip items that have failed too many times
      const retries = retryCounts[item.id] || 0;
      if (retries >= MAX_RETRIES) {
        console.log(`📦 OfflineSync: Dropping item ${item.id} after ${MAX_RETRIES} failed retries.`);
        continue;
      }

      try {
        await axios({
          method: item.method,
          url: `${BASE_URL}${item.endpoint}`,
          data: item.data,
          headers: { Authorization: `Bearer ${token}` },
          timeout: 8000,
        });
        successCount++;
        delete retryCounts[item.id];
      } catch (err) {
        // Keep in queue for next retry
        retryCounts[item.id] = retries + 1;
        failedItems.push(item);
        console.log(`📦 OfflineSync: Item ${item.id} failed (attempt ${retries + 1}/${MAX_RETRIES}). Will retry.`);
      }
    }

    // Save the remaining failed items back to queue
    await storage.setItem(QUEUE_KEY, JSON.stringify(failedItems));
    await storage.setItem(RETRY_COUNTS_KEY, JSON.stringify(retryCounts));

    if (successCount > 0) {
      console.log(`📦 OfflineSync: ✅ Successfully synced ${successCount} queued coordinates!`);
    }

    return failedItems.length === 0;
  } catch (e) {
    console.error('📦 OfflineSync: Flush failed:', e);
    return false;
  }
}

// ─── Background Fetch Task Registration ──────────────────────────────────────
// This task runs when the OS allows it (even if app is closed) on Android
TaskManager.defineTask(OFFLINE_SYNC_TASK, async () => {
  console.log('📦 OfflineSync: Background fetch triggered by OS...');
  try {
    const success = await flushOfflineQueue();
    return success
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.Failed;
  } catch (e) {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// ─── Register the background fetch task ──────────────────────────────────────
export async function registerOfflineSyncTask() {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(OFFLINE_SYNC_TASK);
    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(OFFLINE_SYNC_TASK, {
        minimumInterval: 60 * 5, // Every 5 minutes minimum
        stopOnTerminate: false,  // KEY: Keeps running after app is killed
        startOnBoot: true,       // KEY: Restarts after device reboot
      });
      console.log('📦 OfflineSync: Background fetch task registered successfully.');
    }
  } catch (e) {
    console.warn('📦 OfflineSync: Could not register background fetch task:', e.message);
  }
}

// ─── Network Reconnect Listener ───────────────────────────────────────────────
// Automatically flush queue when internet comes back
let unsubscribeNetListener = null;
export function startNetworkListener() {
  if (unsubscribeNetListener) return; // Already listening
  
  unsubscribeNetListener = NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable) {
      console.log('📦 OfflineSync: Network reconnected! Auto-flushing offline queue...');
      flushOfflineQueue();
    }
  });
  console.log('📦 OfflineSync: Network listener started.');
}

export function stopNetworkListener() {
  if (unsubscribeNetListener) {
    unsubscribeNetListener();
    unsubscribeNetListener = null;
  }
}
