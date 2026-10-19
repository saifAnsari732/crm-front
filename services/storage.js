import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const CHUNK_SIZE = 1500; // Well below Android Keystore's 2048-byte single value limit

export const storage = {
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

