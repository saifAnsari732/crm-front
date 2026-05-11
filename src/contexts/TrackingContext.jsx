import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { trackingAPI } from '../services/api.service';
import { getSocket } from '../services/socket.service';
import toast from 'react-hot-toast';

const TrackingContext = createContext();

const LOCATION_INTERVAL = 10000;
const BATCH_SIZE = 5;

export const TrackingProvider = ({ children }) => {
  const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [totalDistance, setTotalDistance] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [routePath, setRoutePath] = useState([]);
  const [error, setError] = useState(null);

  const watchIdRef = useRef(null);
  const coordsBuffer = useRef([]);
  const flushTimerRef = useRef(null);
  const sessionIdRef = useRef(null);

  const flushCoords = useCallback(async () => {
    if (!coordsBuffer.current.length || !sessionIdRef.current) return;
    const batch = [...coordsBuffer.current];
    coordsBuffer.current = [];
    try {
      const { data } = await trackingAPI.update({ sessionId: sessionIdRef.current, coordinates: batch });
      setTotalDistance(data.totalDistance || 0);
    } catch (err) {
      coordsBuffer.current = [...batch, ...coordsBuffer.current];
    }
  }, []);

  const startTracking = useCallback(async () => {
    if (!navigator.geolocation) {
      toast.error('GPS not supported');
      return;
    }
    try {
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

      const socket = getSocket();
      if (socket) socket.emit('tracking_started', { ...pos, sessionId: sid });

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
          setCurrentSpeed(Math.round((coord.speed || 0) * 3.6));
          setRoutePath(prev => [...prev, { lat: coord.lat, lng: coord.lng }]);
          coordsBuffer.current.push(coord);
          
          if (socket) {
            socket.emit('location_ping', {
              lat: coord.lat,
              lng: coord.lng,
              speed: coord.speed,
              accuracy: coord.accuracy,
              sessionId: sid
            });
          }

          if (coordsBuffer.current.length >= BATCH_SIZE) flushCoords();
        },
        (err) => setError(err.message),
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
      );

      flushTimerRef.current = setInterval(flushCoords, 30000);
    } catch (err) {
      toast.error('Could not get location');
    }
  }, [flushCoords]);

  const stopTracking = useCallback(async () => {
    if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    clearInterval(flushTimerRef.current);
    await flushCoords();

    try {
      const sid = sessionIdRef.current;
      if (sid) {
        const { data } = await trackingAPI.stop({ sessionId: sid });
        setTotalDistance(data.totalDistance || 0);
        const socket = getSocket();
        if (socket) socket.emit('tracking_stopped', { sessionId: sid, totalDistance: data.totalDistance });
        toast.success(`✅ Tracking stopped — ${(data.totalDistance || 0).toFixed(2)} km`);
      }
    } catch (err) {
      toast.error('Error stopping tracking');
    }

    setIsTracking(false);
    setSessionId(null);
    sessionIdRef.current = null;
    coordsBuffer.current = [];
  }, [flushCoords]);

  const toggleTracking = () => isTracking ? stopTracking() : startTracking();

  return (
    <TrackingContext.Provider value={{
      isTracking, currentLocation, totalDistance, currentSpeed, routePath, error, sessionId,
      toggleTracking, startTracking, stopTracking
    }}>
      {children}
    </TrackingContext.Provider>
  );
};

export const useTracking = () => useContext(TrackingContext);
