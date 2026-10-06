import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Constants from 'expo-constants';
import { AlertCircle } from 'lucide-react-native';
import { getAvatarUrl } from '../services/api';

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
  const startMarkerRef = useRef(null);
  const endMarkerRef = useRef(null);
  const hasAutoFittedRef = useRef(false);

  const [mapError, setMapError] = useState('');
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.gm_authFailure = () => {
        setMapError('BillingNotEnabledMapError: Billing is not enabled on this Google Cloud Project.');
      };
    }
  }, []);

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
    if (!mapRef.current || !window.google?.maps || !mapReady) return;
    const maps = window.google.maps;
    if (markersRef.current) markersRef.current.forEach((marker) => marker.setMap(null));

    const validStaff = directoryStaff.filter((emp) => emp.lat && emp.lng && Number.isFinite(Number(emp.lat)) && Number.isFinite(Number(emp.lng)));

    markersRef.current = validStaff.map((emp) => {
      const lat = Number(emp.lat);
      const lng = Number(emp.lng);
      const isLive = emp.isTracking || emp.status === 'ON_FIELD';
      const pinColor = isLive ? '#10b981' : '#64748b';
      const kmText = `${parseFloat(emp.totalDistance || 0).toFixed(1)} km`;
      const avatarUrl = getAvatarUrl(emp.avatar);
      const initial = (emp.name || 'E').charAt(0).toUpperCase();
      const firstName = (emp.name || 'Agent').trim().split(' ')[0];

      // Sleek Unified Uber-Style Pill Pin for Google Maps Web
      const markerContainer = document.createElement('div');
      markerContainer.style.cursor = 'pointer';
      markerContainer.style.display = 'flex';
      markerContainer.style.flexDirection = 'column';
      markerContainer.style.alignItems = 'center';
      markerContainer.style.transform = 'translate(-50%, -100%)';

      const avatarHtml = avatarUrl
        ? `<img src="${avatarUrl}" style="width:26px;height:26px;border-radius:13px;object-fit:cover;" />`
        : `<div style="width:26px;height:26px;border-radius:13px;background:${isLive ? '#059669' : '#475569'};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:11px;">${initial}</div>`;

      markerContainer.innerHTML = `
        <div style="background:#ffffff;border:1.5px solid #cbd5e1;padding:3px 6px;border-radius:20px;display:flex;align-items:center;gap:5px;box-shadow:0 4px 12px rgba(15,23,42,0.18);white-space:nowrap;font-family:sans-serif;">
          ${avatarHtml}
          <span style="color:#0f172a;font-weight:700;font-size:11px;">${firstName}</span>
          <span style="background:${isLive ? '#ecfdf5' : '#f1f5f9'};color:${isLive ? '#047857' : '#475569'};padding:2px 6px;border-radius:10px;font-weight:800;font-size:10px;">${kmText}</span>
        </div>
        <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid #cbd5e1;margin-top:-1px;"></div>
      `;

      let marker;
      if (maps.OverlayView) {
        class CustomOverlay extends maps.OverlayView {
          constructor(position, element) {
            super();
            this.position = position;
            this.element = element;
          }
          onAdd() {
            const panes = this.getPanes();
            panes.overlayMouseTarget.appendChild(this.element);
            this.element.addEventListener('click', (e) => {
              e.stopPropagation();
              onSelectEmployee?.(emp);
            });
          }
          draw() {
            const overlayProjection = this.getProjection();
            if (!overlayProjection) return;
            const point = overlayProjection.fromLatLngToDivPixel(this.position);
            if (point) {
              this.element.style.position = 'absolute';
              this.element.style.left = point.x + 'px';
              this.element.style.top = point.y + 'px';
            }
          }
          onRemove() {
            if (this.element.parentNode) {
              this.element.parentNode.removeChild(this.element);
            }
          }
        }
        const overlay = new CustomOverlay(new maps.LatLng(lat, lng), markerContainer);
        overlay.setMap(mapRef.current);
        return overlay;
      } else {
        marker = new maps.Marker({
          map: mapRef.current,
          position: { lat, lng },
          title: `${emp.name} (${kmText})`,
        });
        marker.addListener('click', () => onSelectEmployee?.(emp));
        return marker;
      }
    });

    // Auto-fit camera bounds to show ALL employees automatically on initial load
    if (!hasAutoFittedRef.current && validStaff.length > 0) {
      hasAutoFittedRef.current = true;
      const bounds = new maps.LatLngBounds();
      validStaff.forEach((emp) => bounds.extend({ lat: Number(emp.lat), lng: Number(emp.lng) }));
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.fitBounds(bounds, { top: 80, right: 50, bottom: 220, left: 50 });
        }
      }, 350);
    }

    if (routeOutlineRef.current) routeOutlineRef.current.setMap(null);
    if (routeRef.current) routeRef.current.setMap(null);
    if (startMarkerRef.current) startMarkerRef.current.setMap(null);
    if (endMarkerRef.current) endMarkerRef.current.setMap(null);

    if (routeCoords.length > 1) {
      const routePath = routeCoords
        .map((point) => ({ lat: Number(point.latitude), lng: Number(point.longitude) }))
        .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));

      routeOutlineRef.current = new maps.Polyline({
        map: mapRef.current,
        path: routePath,
        strokeColor: '#ffffff',
        strokeOpacity: 0.9,
        strokeWeight: 6,
        geodesic: true,
        zIndex: 20,
      });
      routeRef.current = new maps.Polyline({
        map: mapRef.current,
        path: routePath,
        strokeColor: '#059669',
        strokeOpacity: 1,
        strokeWeight: 3.5,
        geodesic: true,
        zIndex: 21,
      });

      const routeStart = routePath[0];
      const routeEnd = routePath[routePath.length - 1];
      if (routeStart) {
        startMarkerRef.current = new maps.Marker({
          map: mapRef.current,
          position: routeStart,
          title: 'Shift start',
          icon: {
            path: maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: '#10b981',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
        });
      }
      if (routeEnd) {
        endMarkerRef.current = new maps.Marker({
          map: mapRef.current,
          position: routeEnd,
          title: 'Shift end',
          icon: {
            path: maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#ef4444',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
        });
      }

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
      {mapError ? (
        <View style={styles.error}>
          <View style={styles.errorHeader}>
            <AlertCircle size={20} color="#dc2626" />
            <Text style={styles.errorTitle}>Google Maps Billing Required</Text>
          </View>
          <Text style={styles.errorText}>{mapError}</Text>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  map: { flex: 1, minHeight: 0 },
  error: {
    position: 'absolute',
    top: 18,
    left: 18,
    right: 18,
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fecaca',
    shadowColor: '#0f172a',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  errorHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  errorTitle: { color: '#dc2626', fontWeight: '800', fontSize: 14 },
  errorText: { color: '#475569', fontSize: 12, fontWeight: '600' },
});

export default MapViewComponent;
