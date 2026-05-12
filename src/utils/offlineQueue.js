/**
 * Offline Queue Manager using IndexedDB
 * Handles coordinate queuing when offline, syncs on reconnect
 */

const DB_NAME = 'fieldcrm_offline';
const STORE_NAME = 'coordinate_queue';
const DB_VERSION = 1;

let db = null;

/**
 * Initialize IndexedDB
 */
export const initOfflineDB = async () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('sessionId', 'sessionId', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
};

/**
 * Add coordinates to offline queue
 */
export const queueCoordinates = async (sessionId, coordinates) => {
  if (!db) await initOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    coordinates.forEach((coord) => {
      store.add({
        sessionId,
        ...coord,
        queuedAt: new Date().toISOString(),
        synced: false,
      });
    });

    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => resolve(coordinates.length);
  });
};

/**
 * Get all queued coordinates for a session
 */
export const getQueuedCoordinates = async (sessionId = null) => {
  if (!db) await initOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    let request;
    if (sessionId) {
      const index = store.index('sessionId');
      request = index.getAll(sessionId);
    } else {
      request = store.getAll();
    }

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result.filter(item => !item.synced));
  });
};

/**
 * Mark coordinates as synced after successful upload
 */
export const markCoordinatesSynced = async (ids) => {
  if (!db) await initOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    ids.forEach((id) => {
      store.get(id).onsuccess = (event) => {
        const record = event.target.result;
        if (record) {
          record.synced = true;
          store.put(record);
        }
      };
    });

    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => resolve(true);
  });
};

/**
 * Clear all synced coordinates (cleanup)
 */
export const clearSyncedCoordinates = async () => {
  if (!db) await initOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const request = store.getAll();
    request.onsuccess = () => {
      request.result.forEach((record) => {
        if (record.synced) {
          store.delete(record.id);
        }
      });
    };

    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => resolve(true);
  });
};

/**
 * Get queue size (for monitoring)
 */
export const getQueueSize = async () => {
  if (!db) await initOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.count();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

/**
 * Get number of unsynced coordinates
 */
export const getUnsyncedCount = async () => {
  if (!db) await initOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const unsynced = request.result.filter(item => !item.synced);
      resolve(unsynced.length);
    };
  });
};

export default {
  initOfflineDB,
  queueCoordinates,
  getQueuedCoordinates,
  markCoordinatesSynced,
  clearSyncedCoordinates,
  getQueueSize,
  getUnsyncedCount,
};
