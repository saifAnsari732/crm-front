import { io } from 'socket.io-client';
import { networkMonitor } from '../utils/networkMonitor';

let socket = null;
let messageQueue = [];
let connectionListeners = [];
let stateRecoveryData = {};

const QUEUE_MAX_SIZE = 100;
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
let heartbeatInterval = null;

/**
 * Add callback to be notified of connection state changes
 */
export const onConnectionStateChange = (callback) => {
  connectionListeners.push(callback);
  return () => {
    connectionListeners = connectionListeners.filter(cb => cb !== callback);
  };
};

/**
 * Notify all listeners of connection state change
 */
const notifyConnectionStateChange = (isConnected) => {
  connectionListeners.forEach(callback => {
    try {
      callback(isConnected);
    } catch (err) {
      console.error('Connection listener error:', err);
    }
  });
};

/**
 * Queue message for later delivery
 */
const queueMessage = (eventName, data) => {
  if (messageQueue.length >= QUEUE_MAX_SIZE) {
    messageQueue.shift(); // Remove oldest if queue is full
  }
  messageQueue.push({ eventName, data, timestamp: Date.now() });
};

/**
 * Flush queued messages to server
 */
const flushMessageQueue = () => {
  if (!socket?.connected || messageQueue.length === 0) return;

  const messagesToSend = [...messageQueue];
  messageQueue = [];

  messagesToSend.forEach(({ eventName, data }) => {
    socket.emit(eventName, data);
  });

  console.log(`📤 Flushed ${messagesToSend.length} queued messages`);
};

/**
 * Start heartbeat to keep connection alive
 */
const startHeartbeat = () => {
  if (heartbeatInterval) clearInterval(heartbeatInterval);

  heartbeatInterval = setInterval(() => {
    if (socket?.connected) {
      socket.emit('heartbeat', { timestamp: Date.now() });
    }
  }, HEARTBEAT_INTERVAL);
};

/**
 * Stop heartbeat
 */
const stopHeartbeat = () => {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
};

/**
 * Initialize Socket.IO with enhanced reliability
 */
export const initSocket = (token) => {
  if (socket?.connected) return socket;

  socket = io(
    // 'http://localhost:5000',
    'https://crm-b-y8rv.onrender.com',
    {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      transports: ['websocket', 'polling'],
    }
  );

  socket.on('connect', () => {
    console.log('✅ Socket connected:', socket.id);
    notifyConnectionStateChange(true);
    flushMessageQueue(); // Flush queued messages on reconnect
    startHeartbeat();
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ Socket disconnected:', reason);
    notifyConnectionStateChange(false);
    stopHeartbeat();
  });

  socket.on('connect_error', (err) => {
    console.error('⚠️ Socket error:', err.message);
    notifyConnectionStateChange(false);
  });

  socket.on('error', (err) => {
    console.error('⚠️ Socket server error:', err);
  });

  // Handle heartbeat from server
  socket.on('heartbeat_ack', (data) => {
    // Heartbeat acknowledged, connection is healthy
  });
 
  return socket;
};

export const getSocket = () => socket;

export const isSocketConnected = () => socket?.connected ?? false;

export const disconnectSocket = () => {
  stopHeartbeat();
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

/**
 * Emit location ping with fallback to queue if offline
 */
export const emitLocation = (data) => {
  if (socket?.connected) {
    socket.emit('location_ping', data);
  } else {
    // Queue for later delivery
    queueMessage('location_ping', data);
  }
};

export const emitTrackingStarted = (data) => {
  if (socket?.connected) {
    socket.emit('tracking_started', data);
  } else {
    queueMessage('tracking_started', data);
  }
};

export const emitTrackingStopped = (data) => {
  if (socket?.connected) {
    socket.emit('tracking_stopped', data);
  } else {
    queueMessage('tracking_stopped', data);
  }
};

/**
 * Get number of queued messages
 */
export const getQueuedMessageCount = () => messageQueue.length;

/**
 * Register state recovery data
 */
export const setStateRecoveryData = (key, data) => {
  stateRecoveryData[key] = data;
};

/**
 * Get state recovery data
 */
export const getStateRecoveryData = (key) => {
  const data = stateRecoveryData[key];
  if (key) delete stateRecoveryData[key];
  return data;
};

export default {
  initSocket,
  getSocket,
  isSocketConnected,
  disconnectSocket,
  emitLocation,
  emitTrackingStarted,
  emitTrackingStopped,
  onConnectionStateChange,
  getQueuedMessageCount,
  setStateRecoveryData,
  getStateRecoveryData,
};
