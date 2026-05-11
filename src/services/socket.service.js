import { io } from 'socket.io-client';

let socket = null;

export const initSocket = (token) => {
  if (socket?.connected) return socket;
  
  socket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000', {
    auth: { token },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  });

  socket.on('connect', () => console.log('🔌 Socket connected:', socket.id));
  socket.on('disconnect', (reason) => console.log('🔌 Socket disconnected:', reason));
  socket.on('connect_error', (err) => console.error('Socket error:', err.message));

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

// Emit location ping
export const emitLocation = (data) => {
  if (socket?.connected) {
    socket.emit('location_ping', data);
  }
};

export const emitTrackingStarted = (data) => {
  if (socket?.connected) socket.emit('tracking_started', data);
};

export const emitTrackingStopped = (data) => {
  if (socket?.connected) socket.emit('tracking_stopped', data);
};

export default { initSocket, getSocket, disconnectSocket, emitLocation, emitTrackingStarted, emitTrackingStopped };
