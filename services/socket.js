import io from 'socket.io-client';
import { storage } from './storage';
import { BASE_URL } from './api';

class SocketService {
  constructor() {
    this.socket = null;
    this.messageQueue = [];
    this.connectionListeners = [];
    this.stateRecoveryData = {};
    this.listeners = new Map();

    this.QUEUE_MAX_SIZE = 100;
    this.HEARTBEAT_INTERVAL = 30000; // 30 seconds
    this.heartbeatInterval = null;

    // Dynamically derive socket URL from the same resolved backend base URL.
    this.serverUrl = BASE_URL.replace(/\/api$/, '');
  }

  /**
   * Add callback to be notified of connection state changes
   */
  onConnectionStateChange(callback) {
    this.connectionListeners.push(callback);
    return () => {
      this.connectionListeners = this.connectionListeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Notify all listeners of connection state change
   */
  notifyConnectionStateChange(isConnected) {
    this.connectionListeners.forEach(callback => {
      try {
        callback(isConnected);
      } catch (err) {
        console.error('🔌 Socket: Connection listener error:', err);
      }
    });
  }

  /**
   * Queue message for later delivery
   */
  queueMessage(eventName, data) {
    if (this.messageQueue.length >= this.QUEUE_MAX_SIZE) {
      this.messageQueue.shift(); // Remove oldest if queue is full
    }
    this.messageQueue.push({ eventName, data, timestamp: Date.now() });
    console.log(`🔌 Socket: Queued message [${eventName}]. Total queued: ${this.messageQueue.length}`);
  }

  /**
   * Flush queued messages to server
   */
  flushMessageQueue() {
    if (!this.socket?.connected || this.messageQueue.length === 0) return;

    const messagesToSend = [...this.messageQueue];
    this.messageQueue = [];

    messagesToSend.forEach(({ eventName, data }) => {
      this.socket.emit(eventName, data);
    });

    console.log(`📤 Socket: Flushed ${messagesToSend.length} queued messages to Render server`);
  }

  /**
   * Start heartbeat to keep connection alive
   */
  startHeartbeat() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);

    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('heartbeat', { timestamp: Date.now() });
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Initializes and connects the WebSocket client
   */
  async connect() {
    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    try {
      const token = await storage.getItem('userToken') || await storage.getItem('token');
      if (!token) {
        console.log('🔌 Socket: Connection deferred. Auth token missing.');
        return null;
      }

      console.log('🔌 Socket: Launching handshake with Render production server...', this.serverUrl);
      
      this.socket = io(this.serverUrl, {
        auth: { token },
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000,
        transports: ['websocket', 'polling'],
      });

      // Bind common lifecycle handlers
      this.socket.on('connect', () => {
        console.log('🔌 Socket: Status CONNECTED successfully! Client ID:', this.socket.id);
        this.notifyConnectionStateChange(true);
        this.flushMessageQueue(); // Flush queued telemetry on reconnect
        this.startHeartbeat();
        
        // Re-register all custom listeners
        this.listeners.forEach((callbacks, event) => {
          callbacks.forEach(cb => this.socket.on(event, cb));
        });
      });

      this.socket.on('disconnect', (reason) => {
        console.log('🔌 Socket: Status DISCONNECTED. Reason:', reason);
        this.notifyConnectionStateChange(false);
        this.stopHeartbeat();
        // Socket.io v4: If the server explicitly initiates the disconnect, auto-reconnect is paused.
        // Calling this.socket.connect() restores auto-reconnection seamlessly.
        if (reason === 'io server disconnect') {
          try { this.socket.connect(); } catch (_) {}
        }
      });

      this.socket.on('connect_error', (error) => {
        // Silenced to prevent terminal spam when using temporary tunnels or offline.
        // console.log('🔌 Socket: Connection handshake failure:', error.message);
        this.notifyConnectionStateChange(false);
      });

      this.socket.on('error', (err) => {
        console.error('🔌 Socket: Server error:', err);
      });

      this.socket.on('heartbeat_ack', (data) => {
        if (data?.timestamp) {
          const rtt = Date.now() - data.timestamp;
          this.networkLatency = rtt;
          if (rtt > 1500) {
            console.log(`🔌 Socket: Slow network connection detected (RTT: ${rtt}ms)`);
          }
        }
      });

      return this.socket;
    } catch (e) {
      console.error('🔌 Socket: Initialization error:', e);
      return null;
    }
  }

  /**
   * Register listener for events
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  /**
   * Unregister listener
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }

    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  /**
   * Disconnect socket safely
   */
  disconnect() {
    this.stopHeartbeat();
    if (this.socket) {
      console.log('🔌 Socket: Graceful logout teardown initiated.');
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Stream Location telemetry pings with offline queuing fallback
   */
  emitLocationPing(data) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('location_ping', data);
      return true;
    } else {
      this.queueMessage('location_ping', data);
      return false;
    }
  }

  /**
   * Notify shifts start with offline queuing fallback
   */
  emitTrackingStarted(data) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('tracking_started', data);
      return true;
    } else {
      this.queueMessage('tracking_started', data);
      return false;
    }
  }

  /**
   * Notify shift termination with offline queuing fallback
   */
  emitTrackingStopped(data) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('tracking_stopped', data);
      return true;
    } else {
      this.queueMessage('tracking_stopped', data);
      return false;
    }
  }

  /**
   * Get number of queued messages
   */
  getQueuedMessageCount() {
    return this.messageQueue.length;
  }

  /**
   * Register state recovery data
   */
  setStateRecoveryData(key, data) {
    this.stateRecoveryData[key] = data;
  }

  /**
   * Get state recovery data
   */
  getStateRecoveryData(key) {
    const data = this.stateRecoveryData[key];
    if (key) delete this.stateRecoveryData[key];
    return data;
  }
}

const socketService = new SocketService();

//Support both export defaults and standalone naming exports for absolute flexibility
export const initSocket = (token) => socketService.connect();
export const getSocket = () => socketService.socket;
export const isSocketConnected = () => socketService.socket?.connected ?? false;
export const disconnectSocket = () => socketService.disconnect();
export const emitLocation = (data) => socketService.emitLocationPing(data);
export const emitTrackingStarted = (data) => socketService.emitTrackingStarted(data);
export const emitTrackingStopped = (data) => socketService.emitTrackingStopped(data);
export const onConnectionStateChange = (callback) => socketService.onConnectionStateChange(callback);
export const getQueuedMessageCount = () => socketService.getQueuedMessageCount();
export const setStateRecoveryData = (key, data) => socketService.setStateRecoveryData(key, data);
export const getStateRecoveryData = (key) => socketService.getStateRecoveryData(key);

export default socketService;
