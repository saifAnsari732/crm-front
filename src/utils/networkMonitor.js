/**
 * Network Status Monitor
 * Detects online/offline state and notifies subscribers
 */

class NetworkStatusMonitor {
  constructor() {
    this.isOnline = navigator.onLine;
    this.listeners = [];
    this.setupListeners();
  }

  setupListeners() {
    window.addEventListener('online', () => this.setOnline(true));
    window.addEventListener('offline', () => this.setOnline(false));
  }

  setOnline(isOnline) {
    if (this.isOnline !== isOnline) {
      this.isOnline = isOnline;
      this.notifyListeners();
    }
  }

  subscribe(callback) {
    this.listeners.push(callback);
    // Immediately call with current status
    callback(this.isOnline);
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback(this.isOnline);
      } catch (err) {
        console.error('Network status listener error:', err);
      }
    });
  }

  getStatus() {
    return this.isOnline;
  }
}

export const networkMonitor = new NetworkStatusMonitor();

export default networkMonitor;
