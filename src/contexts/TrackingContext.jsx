import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { trackingAPI } from '../services/api.service';
import { getSocket, isSocketConnected, onConnectionStateChange, emitLocation, emitTrackingStarted, emitTrackingStopped } from '../services/socket.service';
import { queueCoordinates, getQueuedCoordinates, markCoordinatesSynced, getUnsyncedCount } from '../utils/offlineQueue';
import { networkMonitor } from '../utils/networkMonitor';
import toast from 'react-hot-toast';

const TrackingContext = createContext();

const LOCATION_INTERVAL = 10000;
const BATCH_SIZE = 5;
const SYNC_CHECK_INTERVAL = 5000; // Check for offline coordinates every 5s

export const TrackingProvider = ({ children }) => {
  const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [totalDistance, setTotalDistance] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [routePath, setRoutePath] = useState([]);
  const [error, setError] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [unsyncedCount, setUnsyncedCount] = useState(0);

  const watchIdRef = useRef(null);
  const coordsBuffer = useRef([]);
  const flushTimerRef = useRef(null);
  const sessionIdRef = useRef(null);
  const syncCheckRef = useRef(null);
  const bufferIdsRef = useRef([]); // Track IDs for offline queue items

  // Monitor network status
  useEffect(() => {
    const unsubscribe = networkMonitor.subscribe((isOnline) => {
      setIsOnline(isOnline);
      if (isOnline && sessionIdRef.current) {
        console.log('🔄 Network restored, syncing offline data...');
        syncOfflineCoordinates();
      }
    });
    return unsubscribe;
  }, []);

  // Monitor socket connection
  useEffect(() => {
    const unsubscribe = onConnectionStateChange((isConnected) => {
      if (isConnected && sessionIdRef.current) {
        syncOfflineCoordinates();
      }
    });
    return unsubscribe;
  }, []);

  // Update unsynced count periodically
  useEffect(() => {
    const updateCount = async () => {
      const count = await getUnsyncedCount();
      setUnsyncedCount(count);
    };

    syncCheckRef.current = setInterval(updateCount, SYNC_CHECK_INTERVAL);
    return () => clearInterval(syncCheckRef.current);
  }, []);

  /**
   * Sync offline coordinates when connection is restored
   */
  const syncOfflineCoordinates = useCallback(async () => {
    try {
      if (!sessionIdRef.current || !isOnline) return;

      const queuedCoords = await getQueuedCoordinates(sessionIdRef.current);
      if (queuedCoords.length === 0) return;

      console.log(`📤 Syncing ${queuedCoords.length} offline coordinates...`);

      // Send all queued coordinates
      const { data } = await trackingAPI.update({
        sessionId: sessionIdRef.current,
        coordinates: queuedCoords.map(({ queuedAt, synced, ...coord }) => coord),
      });

      // Mark as synced
      const ids = queuedCoords.map(q => q.id);
      await markCoordinatesSynced(ids);

      setTotalDistance(data.totalDistance || 0);
      setUnsyncedCount(0);

      console.log('✅ Offline coordinates synced successfully');
      toast.success(`✅ ${queuedCoords.length} locations synced`);
    } catch (err) {
      console.error('Error syncing offline coordinates:', err);
    }
  }, [isOnline]);

  const flushCoords = useCallback(async () => {
    if (!coordsBuffer.current.length || !sessionIdRef.current) return;

    const batch = [...coordsBuffer.current];
    coordsBuffer.current = [];

    try {
      const { data } = await trackingAPI.update({
        sessionId: sessionIdRef.current,
        coordinates: batch,
      });
      setTotalDistance(data.totalDistance || 0);
    } catch (err) {
      console.warn('⚠️ Failed to upload coordinates, queuing offline:', err.message);
      // Queue in IndexedDB for later sync
      try {
        await queueCoordinates(sessionIdRef.current, batch);
        setUnsyncedCount(prev => prev + batch.length);
        if (isOnline) {
          toast.error('Network error - coordinates queued for sync');
        }
      } catch (dbErr) {
        console.error('Failed to queue coordinates:', dbErr);
      }
      // Don't re-queue in memory, it's now in IndexedDB
    }
  }, [isOnline]);

  const startTracking = useCallback(async () => {
    if (!navigator.geolocation) {
      toast.error('GPS not supported');
      setError('GPS not supported on this device');
      return;
    }

    try {
      setError(null);
      const pos = await new Promise((res, rej) => {
        navigator.geolocation.getCurrentPosition(
          (p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
          rej,
          { enableHighAccuracy: true, timeout: 15000 }
        );
      });

      const { data } = await trackingAPI.start(pos);
      const sid = data.session.sessionId;
      sessionIdRef.current = sid;
      setSessionId(sid);
      setIsTracking(true);
      setRoutePath([pos]);
      setCurrentLocation(pos);

      // Emit tracking started
      emitTrackingStarted({ ...pos, sessionId: sid });

      toast.success('📍 Tracking started!');

      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const coord = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            speed: position.coords.speed || 0,
            accuracy: position.coords.accuracy,
            timestamp: new Date().toISOString(),
          };

          setCurrentLocation({ lat: coord.lat, lng: coord.lng });
          setCurrentSpeed(Math.round((coord.speed || 0) * 3.6)); // m/s to km/h
          setRoutePath(prev => [...prev, { lat: coord.lat, lng: coord.lng }]);
          coordsBuffer.current.push(coord);

          emitLocation({
            lat: coord.lat,
            lng: coord.lng,
            speed: coord.speed,
            accuracy: coord.accuracy,
            sessionId: sid,
          });

          if (coordsBuffer.current.length >= BATCH_SIZE) {
            flushCoords();
          }
        },
        (err) => {
          console.error('GPS error:', err);
          setError(err.message);
          if (err.code === 1) {
            toast.error('❌ Permission denied - Enable GPS location access');
          } else if (err.code === 3) {
            toast.error('⚠️ GPS timeout - Poor signal, retrying...');
          }
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
      );

      // Flush timer every 30s
      flushTimerRef.current = setInterval(flushCoords, 30000);
    } catch (err) {
      console.error('Error starting tracking:', err);
      setError(err.message);
      toast.error('Could not start tracking: ' + err.message);
      setIsTracking(false);
    }
  }, [flushCoords]);

  const stopTracking = useCallback(async () => {
    if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    clearInterval(flushTimerRef.current);

    // Final flush
    await flushCoords();

    try {
      const sid = sessionIdRef.current;
      if (sid) {
        const { data } = await trackingAPI.stop({ sessionId: sid });
        setTotalDistance(data.totalDistance || 0);

        emitTrackingStopped({
          sessionId: sid,
          totalDistance: data.totalDistance,
        });

        toast.success(
          `✅ Tracking stopped — ${(data.totalDistance || 0).toFixed(2)} km`
        );
      }
    } catch (err) {
      console.error('Error stopping tracking:', err);
      toast.error('Error stopping tracking');
    }

    setIsTracking(false);
    setSessionId(null);
    sessionIdRef.current = null;
    coordsBuffer.current = [];
    setError(null);
  }, [flushCoords]);

  const toggleTracking = useCallback(() => {
    if (isTracking) {
      stopTracking();
    } else {
      startTracking();
    }
  }, [isTracking, startTracking, stopTracking]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
      clearInterval(flushTimerRef.current);
      clearInterval(syncCheckRef.current);
    };
  }, []);

  return (
    <TrackingContext.Provider
      value={{
        isTracking,
        currentLocation,
        totalDistance,
        currentSpeed,
        routePath,
        error,
        sessionId,
        isOnline,
        unsyncedCount,
        toggleTracking,
        startTracking,
        stopTracking,
        syncOfflineCoordinates,
      }}
    >
      {children}
    </TrackingContext.Provider>
  );
};

export const useTracking = () => {
  const ctx = useContext(TrackingContext);
  if (!ctx) {
    throw new Error('useTracking must be used within TrackingProvider');
  }
  return ctx;
};
