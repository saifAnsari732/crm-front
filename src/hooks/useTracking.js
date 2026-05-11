import { useState, useEffect, useRef, useCallback } from 'react';
import { trackingAPI } from '../services/api.service';
import { emitLocation, emitTrackingStarted, emitTrackingStopped } from '../services/socket.service';
import toast from 'react-hot-toast';

const LOCATION_INTERVAL = 10000; // 10s
const BATCH_SIZE = 5;

export default function useTracking() {
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
      // re-queue on failure
      coordsBuffer.current = [...batch, ...coordsBuffer.current];
    }
  }, []);

  const startTracking = useCallback(async () => {
    if (!navigator.geolocation) {
      toast.error('GPS not supported on this device');
      return;
    }
    try {
      const pos = await getCurrentPosition();
      const { lat, lng } = pos;
      const { data } = await trackingAPI.start({ lat, lng });
      const sid = data.session.sessionId;
      sessionIdRef.current = sid;
      setSessionId(sid);
      setIsTracking(true);
      setRoutePath([{ lat, lng }]);
      setCurrentLocation({ lat, lng });
      emitTrackingStarted({ lat, lng, sessionId: sid });
      toast.success('📍 Tracking started!');

      // Watch position
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
          emitLocation({ lat: coord.lat, lng: coord.lng, speed: coord.speed, accuracy: coord.accuracy });

          if (coordsBuffer.current.length >= BATCH_SIZE) flushCoords();
        },
        (err) => setError(err.message),
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
      );

      // Flush timer every 30s
      flushTimerRef.current = setInterval(flushCoords, 30000);
    } catch (err) {
      toast.error('Could not get location: ' + err.message);
    }
  }, [flushCoords]);

  const stopTracking = useCallback(async () => {
    if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    clearInterval(flushTimerRef.current);
    await flushCoords(); // final flush

    try {
      const sid = sessionIdRef.current;
      if (sid) {
        const { data } = await trackingAPI.stop({ sessionId: sid });
        setTotalDistance(data.totalDistance || 0);
        emitTrackingStopped({ sessionId: sid, totalDistance: data.totalDistance });
        toast.success(`✅ Tracking stopped — ${(data.totalDistance || 0).toFixed(2)} km today`);
      }
    } catch (err) {
      toast.error('Error stopping tracking');
    }

    setIsTracking(false);
    setSessionId(null);
    sessionIdRef.current = null;
    coordsBuffer.current = [];
  }, [flushCoords]);

  const toggleTracking = useCallback(() => {
    if (isTracking) stopTracking();
    else startTracking();
  }, [isTracking, startTracking, stopTracking]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
      clearInterval(flushTimerRef.current);
    };
  }, []);

  return { isTracking, currentLocation, totalDistance, currentSpeed, routePath, error, sessionId, toggleTracking, startTracking, stopTracking };
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      reject,
      { enableHighAccuracy: true, timeout: 15000 }
    );
  });
}
