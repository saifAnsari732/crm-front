import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Constants from 'expo-constants';

const GOOGLE_MAPS_KEY = Constants.expoConfig?.extra?.googleMapsApiKey
  || Constants.expoConfig?.android?.config?.googleMaps?.apiKey
  || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
let googleMapsPromise;

const loadGoogleMaps = () => {
  if (typeof window === 'undefined') return Promise.reject(new Error('Google Maps requires a browser'));
  if (!GOOGLE_MAPS_KEY) return Promise.reject(new Error('Google Maps API key is not configured'));
  if (window.google?.maps?.Map) return Promise.resolve(window.google.maps);
  if (!googleMapsPromise) {
    googleMapsPromise = new Promise((resolve, reject) => {
      const finish = async () => {
        try {
          if (window.google?.maps?.importLibrary) {
            await window.google.maps.importLibrary('maps');
            await window.google.maps.importLibrary('marker');
          }
          if (window.google?.maps?.Map) {
            resolve(window.google.maps);
            return;
          }
          reject(new Error('Google Maps library did not initialize'));
        } catch (e) {
          reject(e);
        }
      };

      if (window.google?.maps) {
        finish();
        return;
      }

      const existing = document.querySelector('script[data-google-maps]');
      if (existing) {
        existing.addEventListener('load', finish);
        existing.addEventListener('error', reject);
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_KEY)}&loading=async`;
      script.async = true;
      script.defer = true;
      script.dataset.googleMaps = 'true';
      script.onload = finish;
      script.onerror = () => {
        googleMapsPromise = null;
        reject(new Error('Google Maps failed to load'));
      };
      document.head.appendChild(script);
    });
  }
  return googleMapsPromise;
};

const MapViewComponent = forwardRef(({ initialRegion, directoryStaff = [], routeCoords = [], onSelectEmployee }, ref) => {
  const mapElement = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const routeOutlineRef = useRef(null);
  const routeRef = useRef(null);
  const [mapError, setMapError] = useState('');
  const [mapReady, setMapReady] = useState(false);

  useImperativeHandle(ref, () => ({
    animateToRegion: (region, duration = 600) => {
      if (!mapRef.current) return;
      const target = { lat: region.latitude, lng: region.longitude };
      mapRef.current.panTo(target);
      if (duration > 0) {
        mapRef.current.setZoom(15);
      }
    },
    fitToCoordinates: (coords, options = {}) => {
      if (!mapRef.current || !coords?.length) return;
      const bounds = new window.google.maps.LatLngBounds();
      coords.forEach((point) => bounds.extend({ lat: Number(point.latitude), lng: Number(point.longitude) }));
      mapRef.current.fitBounds(bounds, options.edgePadding || { top: 72, right: 44, bottom: 180, left: 44 });
    },
  }));

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps().then((maps) => {
      if (cancelled || !mapElement.current || mapRef.current) return;
      const center = {
        lat: Number(initialRegion?.latitude) || 26.4499,
        lng: Number(initialRegion?.longitude) || 80.3319,
      };
      mapRef.current = new maps.Map(mapElement.current, {
        center,
        zoom: 13,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        gestureHandling: 'greedy',
        zoomControl: true,
        disableDefaultUI: false,
      });
      setMapReady(true);
      setMapError('');
    }).catch((error) => { if (!cancelled) setMapError(error.message || 'Google Maps failed to initialize'); });
    return () => { cancelled = true; };
  }, [initialRegion]);

  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return;
    const maps = window.google.maps;
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = directoryStaff.filter((emp) => emp.lat && emp.lng).map((emp) => {
      const marker = new maps.Marker({
        map: mapRef.current,
        position: { lat: Number(emp.lat), lng: Number(emp.lng) },
        title: emp.name,
      });
      marker.addListener('click', () => onSelectEmployee?.(emp));
      return marker;
    });
    if (routeOutlineRef.current) routeOutlineRef.current.setMap(null);
    if (routeRef.current) routeRef.current.setMap(null);
    if (routeCoords.length > 1) {
      const routePath = routeCoords
        .map((point) => ({ lat: Number(point.latitude), lng: Number(point.longitude) }))
        .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
      routeOutlineRef.current = new maps.Polyline({
        map: mapRef.current,
        path: routePath,
        strokeColor: '#0f172a',
        strokeOpacity: 0.78,
        strokeWeight: 11,
        geodesic: true,
        zIndex: 20,
      });
      routeRef.current = new maps.Polyline({
        map: mapRef.current,
        path: routePath,
        strokeColor: '#14b8a6',
        strokeOpacity: 1,
        strokeWeight: 6,
        geodesic: true,
        zIndex: 21,
      });
      if (routePath.length > 1) {
        const bounds = new maps.LatLngBounds();
        routePath.forEach((point) => bounds.extend(point));
        mapRef.current.fitBounds(bounds, { top: 72, right: 44, bottom: 180, left: 44 });
      }
    }
  }, [directoryStaff, routeCoords, onSelectEmployee, mapReady]);

  return (
    <View style={styles.container}>
      <View ref={mapElement} style={styles.map} />
      {mapError ? <View style={styles.error}><Text style={styles.errorTitle}>Map unavailable</Text><Text style={styles.errorText}>{mapError}</Text></View> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e5e7eb' },
  map: { flex: 1, minHeight: 0 },
  error: { position: 'absolute', top: 18, left: 18, right: 18, padding: 12, borderRadius: 10, backgroundColor: '#fff' },
  errorTitle: { color: '#b91c1c', fontWeight: '700', fontSize: 13 },
  errorText: { color: '#64748b', fontSize: 11, marginTop: 3 },
});

export default MapViewComponent;
