import { Platform, DeviceEventEmitter } from 'react-native';

const webListeners = new Map();

export const appEvents = {
  emit: (eventName, payload) => {
    try {
      if (DeviceEventEmitter && typeof DeviceEventEmitter.emit === 'function') {
        DeviceEventEmitter.emit(eventName, payload);
        return;
      }
    } catch (_) {}

    const set = webListeners.get(eventName);
    if (set) {
      set.forEach((cb) => {
        try {
          cb(payload);
        } catch (_) {}
      });
    }
  },

  addListener: (eventName, callback) => {
    try {
      if (DeviceEventEmitter && typeof DeviceEventEmitter.addListener === 'function') {
        return DeviceEventEmitter.addListener(eventName, callback);
      }
    } catch (_) {}

    if (!webListeners.has(eventName)) {
      webListeners.set(eventName, new Set());
    }
    webListeners.get(eventName).add(callback);
    return {
      remove: () => {
        const set = webListeners.get(eventName);
        if (set) set.delete(callback);
      },
    };
  },
};
