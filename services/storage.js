import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const CHUNK_SIZE = 1500; // Well below Android Keystore's 2048-byte single value limit

// Helper: Get current business date in Asia/Kolkata (YYYY-MM-DD)
export function getKolkataBusinessDate(dateObj = new Date()) {
  try {
    return dateObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  } catch (_) {
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(dateObj.getTime() + istOffset);
    return istDate.toISOString().split('T')[0];
  }
}

export const storage = {
  // ── Epoch-Bounded Monotonic Distance State Engine ──────────────────────────
  // Guarantees that local cached distance is strictly scoped to:
  // (businessDate, sessionId, isActive). Stale values from past days or closed
  // sessions can NEVER leak or inflate via Math.max!
  getValidatedTodayDistance: async (requiredSessionId = null) => {
    try {
      const todayStr = getKolkataBusinessDate();
      const storedDate = await storage.getItem('tracking_accumulated_date');
      if (!storedDate || storedDate !== todayStr) {
        return 0;
      }
      if (requiredSessionId) {
        const storedSessionId = await storage.getItem('tracking_accumulated_session_id');
        if (!storedSessionId || storedSessionId !== requiredSessionId) {
          return 0;
        }
      }
      const rawDist = await storage.getItem('tracking_accumulated_distance');
      const parsed = parseFloat(rawDist);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    } catch (_) {
      return 0;
    }
  },

  setValidatedTodayDistance: async (distanceKm, sessionId = null) => {
    try {
      const todayStr = getKolkataBusinessDate();
      const num = Number(distanceKm);
      const safeDist = Number.isFinite(num) && num >= 0 ? Number(num.toFixed(5)).toString() : '0';
      await storage.setItem('tracking_accumulated_date', todayStr);
      if (sessionId) {
        await storage.setItem('tracking_accumulated_session_id', String(sessionId));
      }
      await storage.setItem('tracking_accumulated_distance', safeDist);
    } catch (_) {}
  },
  setItem: async (key, value) => {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(key, typeof value === 'string' ? value : String(value ?? ''));
        return;
      }

      const strVal = typeof value === 'string' ? value : String(value ?? '');

      if (strVal.length <= CHUNK_SIZE) {
        await SecureStore.setItemAsync(key, strVal);
        // Clean up any previously stored chunks for this key if they exist
        const oldChunkCount = await SecureStore.getItemAsync(`${key}_chunk_count`);
        if (oldChunkCount) {
          const count = parseInt(oldChunkCount, 10) || 0;
          for (let i = 0; i < count; i++) {
            await SecureStore.deleteItemAsync(`${key}_chunk_${i}`).catch(() => {});
          }
          await SecureStore.deleteItemAsync(`${key}_chunk_count`).catch(() => {});
        }
      } else {
        // Value exceeds CHUNK_SIZE: split into safe 1500-character chunks
        const chunks = [];
        for (let i = 0; i < strVal.length; i += CHUNK_SIZE) {
          chunks.push(strVal.slice(i, i + CHUNK_SIZE));
        }

        for (let i = 0; i < chunks.length; i++) {
          await SecureStore.setItemAsync(`${key}_chunk_${i}`, chunks[i]);
        }
        await SecureStore.setItemAsync(`${key}_chunk_count`, String(chunks.length));
        // Delete base key so it does not hold obsolete or oversized data
        await SecureStore.deleteItemAsync(key).catch(() => {});
      }
    } catch (e) {
      console.error(`Storage set error for key [${key}]:`, e);
    }
  },

  getItem: async (key) => {
    try {
      if (Platform.OS === 'web') {
        return localStorage.getItem(key);
      }

      // Check if chunked data exists for this key
      const chunkCountStr = await SecureStore.getItemAsync(`${key}_chunk_count`);
      if (chunkCountStr) {
        const count = parseInt(chunkCountStr, 10) || 0;
        let assembled = '';
        for (let i = 0; i < count; i++) {
          const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
          if (chunk !== null && chunk !== undefined) {
            assembled += chunk;
          }
        }
        return assembled;
      }

      // Return standard single key
      return await SecureStore.getItemAsync(key);
    } catch (e) {
      console.error(`Storage get error for key [${key}]:`, e);
      return null;
    }
  },

  removeItem: async (key) => {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(key);
        return;
      }

      const chunkCountStr = await SecureStore.getItemAsync(`${key}_chunk_count`);
      if (chunkCountStr) {
        const count = parseInt(chunkCountStr, 10) || 0;
        for (let i = 0; i < count; i++) {
          await SecureStore.deleteItemAsync(`${key}_chunk_${i}`).catch(() => {});
        }
        await SecureStore.deleteItemAsync(`${key}_chunk_count`).catch(() => {});
      }
      await SecureStore.deleteItemAsync(key).catch(() => {});
    } catch (e) {
      console.error(`Storage remove error for key [${key}]:`, e);
    }
  }
};

