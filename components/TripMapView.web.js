import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';

const GOOGLE_MAPS_KEY =
  Constants.expoConfig?.extra?.googleMapsApiKey ||
  Constants.expoConfig?.android?.config?.googleMaps?.apiKey ||
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

// 🌟 Uber/Rapido High-Contrast Modern Map Styling for Google Maps
const UBER_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#f1f5f9' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#334155' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }, { weight: 3 }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#0f172a' }, { weight: 'bold' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#dcfce7' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#ffffff' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#cbd5e1' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#475569' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#fed7aa' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#fdba74' }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry',
    stylers: [{ color: '#ffffff' }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#cbd5e1' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#bae6fd' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#0284c7' }],
  },
];

let googleMapsPromise = null;
export const loadGoogleMaps = () => {
  if (typeof window === 'undefined') return Promise.reject(new Error('Browser required'));
  if (!GOOGLE_MAPS_KEY) return Promise.reject(new Error('No Google Maps key'));
  if (window.google?.maps?.Map) return Promise.resolve(window.google.maps);

  if (!googleMapsPromise) {
    googleMapsPromise = new Promise((resolve, reject) => {
      const finish = () => {
        if (window.google?.maps?.Map) resolve(window.google.maps);
        else reject(new Error('Google Maps init failed'));
      };

      const existing = document.querySelector('script[data-google-maps]');
      if (existing) {
        existing.addEventListener('load', finish);
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
        GOOGLE_MAPS_KEY
      )}&libraries=places&loading=async`;
      script.async = true;
      script.defer = true;
      script.dataset.googleMaps = 'true';
      script.onload = finish;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  return googleMapsPromise;
};

// 🗺️ Universal Fallback: Leaflet + CartoDB Voyager tiles (0 API keys required, 100% uptime)
let leafletPromise = null;
export const loadLeaflet = () => {
  if (typeof window === 'undefined') return Promise.reject(new Error('Browser required'));
  if (window.L && window.L.map) return Promise.resolve(window.L);

  if (!leafletPromise) {
    leafletPromise = new Promise((resolve, reject) => {
      if (!document.querySelector('link[data-leaflet]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        link.dataset.leaflet = 'true';
        document.head.appendChild(link);
      }

      const existing = document.querySelector('script[data-leaflet]');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.L));
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.dataset.leaflet = 'true';
      script.onload = () => resolve(window.L);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  return leafletPromise;
};

export default function TripMapViewWeb({
  origin,
  destination,
  polyline = [],
  traveledTrail = [],
  currentLocation,
  style,
}) {
  const containerRef = useRef(null);
  const activeEngineRef = useRef(null); // 'google' | 'leaflet'

  // Google Maps references
  const googleMapRef = useRef(null);
  const googleOriginMarkerRef = useRef(null);
  const googleDestMarkerRef = useRef(null);
  const googlePolylineRef = useRef(null);
  const googleCasingPolylineRef = useRef(null);

  // Leaflet references
  const leafletMapRef = useRef(null);
  const leafletOriginMarkerRef = useRef(null);
  const leafletDestMarkerRef = useRef(null);
  const leafletPolylineRef = useRef(null);
  const leafletCasingRef = useRef(null);

  const [engineReady, setEngineReady] = useState(null); // 'google' | 'leaflet' | null

  // 1. Initialize Map Engine (Google Maps with seamless Leaflet fallback)
  useEffect(() => {
    let isMounted = true;

    // Listen for Google Maps billing/auth errors to instantly switch to Leaflet
    if (typeof window !== 'undefined') {
      const prevAuthFail = window.gm_authFailure;
      window.gm_authFailure = () => {
        if (prevAuthFail) prevAuthFail();
        console.warn('⚠️ Google Maps auth/billing issue detected. Switching to Leaflet engine.');
        if (isMounted) switchToLeaflet();
      };
    }

    const initGoogle = async () => {
      try {
        const maps = await Promise.race([
          loadGoogleMaps(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Google Maps timeout')), 1400)),
        ]);
        if (!isMounted || !containerRef.current) return;

        const centerLat = Number(origin?.lat || destination?.lat || 26.8467);
        const centerLng = Number(origin?.lng || destination?.lng || 80.9462);

        googleMapRef.current = new maps.Map(containerRef.current, {
          center: { lat: centerLat, lng: centerLng },
          zoom: 13,
          disableDefaultUI: true,
          zoomControl: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          styles: UBER_MAP_STYLE,
          gestureHandling: 'greedy',
        });

        activeEngineRef.current = 'google';
        setEngineReady('google');
      } catch (err) {
        if (isMounted) switchToLeaflet();
      }
    };

    const switchToLeaflet = async () => {
      try {
        const L = await loadLeaflet();
        if (!isMounted || !containerRef.current) return;

        // Clean any previous container content
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }

        const centerLat = Number(origin?.lat || destination?.lat || 26.8467);
        const centerLng = Number(origin?.lng || destination?.lng || 80.9462);

        const lMap = L.map(containerRef.current, {
          center: [centerLat, centerLng],
          zoom: 14,
          zoomControl: false,
          attributionControl: false,
        });

        // CartoDB Voyager tiles: Ultra clean, high-contrast, Uber-style pastel colors
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          maxZoom: 19,
          subdomains: 'abcd',
        }).addTo(lMap);

        leafletMapRef.current = lMap;
        activeEngineRef.current = 'leaflet';
        setEngineReady('leaflet');

        setTimeout(() => {
          if (lMap) lMap.invalidateSize();
        }, 250);
      } catch (lErr) {
        console.error('Failed to load Leaflet fallback:', lErr);
      }
    };

    initGoogle();

    return () => {
      isMounted = false;
      if (leafletMapRef.current) {
        try {
          leafletMapRef.current.remove();
        } catch (_) {}
      }
    };
  }, []);

  // 2. Render Markers and Polyline on Active Map Engine
  useEffect(() => {
    if (!engineReady) return;

    // ── CASE A: LEAFLET ENGINE ──
    if (engineReady === 'leaflet' && leafletMapRef.current && window.L) {
      const L = window.L;
      const map = leafletMapRef.current;

      // Clear previous overlays
      if (leafletOriginMarkerRef.current) leafletOriginMarkerRef.current.remove();
      if (leafletDestMarkerRef.current) leafletDestMarkerRef.current.remove();
      if (leafletPolylineRef.current) leafletPolylineRef.current.remove();
      if (leafletCasingRef.current) leafletCasingRef.current.remove();

      const points = [];

      // Point A Marker (Emerald Green Circle with 'A')
      if (origin?.lat && origin?.lng) {
        const pos = [Number(origin.lat), Number(origin.lng)];
        const iconA = L.divIcon({
          className: 'uber-pin-a',
          html: `<div style="width:26px;height:26px;border-radius:13px;background:#10b981;border:2.5px solid #ffffff;box-shadow:0 3px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;color:#ffffff;font-weight:900;font-size:12px;font-family:sans-serif;">A</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });
        leafletOriginMarkerRef.current = L.marker(pos, { icon: iconA }).addTo(map);
        points.push(pos);
      }

      // Point B Marker (Ruby Red Circle with 'B')
      if (destination?.lat && destination?.lng) {
        const pos = [Number(destination.lat), Number(destination.lng)];
        const iconB = L.divIcon({
          className: 'uber-pin-b',
          html: `<div style="width:26px;height:26px;border-radius:13px;background:#ef4444;border:2.5px solid #ffffff;box-shadow:0 3px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;color:#ffffff;font-weight:900;font-size:12px;font-family:sans-serif;">B</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });
        leafletDestMarkerRef.current = L.marker(pos, { icon: iconB }).addTo(map);
        points.push(pos);
      }

      // Driving Route Polyline
      if (polyline && polyline.length > 1) {
        const routePts = polyline.map((p) => [Number(p.latitude), Number(p.longitude)]);

        // Outer Dark Shadow Casing
        leafletCasingRef.current = L.polyline(routePts, {
          color: '#0f172a',
          opacity: 0.35,
          weight: 7,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);

        // Inner Vibrant Blue Driving Line
        leafletPolylineRef.current = L.polyline(routePts, {
          color: '#2563eb',
          opacity: 1,
          weight: 4.5,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);

        points.push(...routePts);
      }

      // Smart Camera Framing
      if (points.length >= 2) {
        map.fitBounds(L.latLngBounds(points), {
          paddingTopLeft: [40, 160],
          paddingBottomRight: [40, 210],
          maxZoom: 15,
          animate: true,
        });
      } else if (origin?.lat && origin?.lng) {
        map.setView([Number(origin.lat), Number(origin.lng)], 14);
      } else if (destination?.lat && destination?.lng) {
        map.setView([Number(destination.lat), Number(destination.lng)], 14);
      }

      setTimeout(() => {
        if (map) map.invalidateSize();
      }, 150);
      return;
    }

    // ── CASE B: GOOGLE MAPS ENGINE ──
    if (engineReady === 'google' && googleMapRef.current && window.google?.maps) {
      const maps = window.google.maps;
      const map = googleMapRef.current;

      if (googleOriginMarkerRef.current) googleOriginMarkerRef.current.setMap(null);
      if (googleDestMarkerRef.current) googleDestMarkerRef.current.setMap(null);
      if (googlePolylineRef.current) googlePolylineRef.current.setMap(null);
      if (googleCasingPolylineRef.current) googleCasingPolylineRef.current.setMap(null);

      const bounds = new maps.LatLngBounds();
      let pointCount = 0;

      if (origin?.lat && origin?.lng) {
        const pos = { lat: Number(origin.lat), lng: Number(origin.lng) };
        googleOriginMarkerRef.current = new maps.Marker({
          position: pos,
          map,
          title: origin.address || 'Pickup Point (A)',
          label: {
            text: 'A',
            color: '#ffffff',
            fontWeight: 'bold',
            fontSize: '11px',
          },
          icon: {
            path: maps.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: '#10b981',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 3,
          },
        });
        bounds.extend(pos);
        pointCount++;
      }

      if (destination?.lat && destination?.lng) {
        const pos = { lat: Number(destination.lat), lng: Number(destination.lng) };
        googleDestMarkerRef.current = new maps.Marker({
          position: pos,
          map,
          title: destination.address || 'Destination (B)',
          label: {
            text: 'B',
            color: '#ffffff',
            fontWeight: 'bold',
            fontSize: '11px',
          },
          icon: {
            path: maps.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: '#ef4444',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 3,
          },
        });
        bounds.extend(pos);
        pointCount++;
      }

      if (polyline && polyline.length > 1) {
        const path = polyline.map((p) => ({
          lat: Number(p.latitude),
          lng: Number(p.longitude),
        }));

        googleCasingPolylineRef.current = new maps.Polyline({
          path,
          geodesic: true,
          strokeColor: '#0f172a',
          strokeOpacity: 0.35,
          strokeWeight: 7,
          map,
        });

        googlePolylineRef.current = new maps.Polyline({
          path,
          geodesic: true,
          strokeColor: '#2563eb',
          strokeOpacity: 1,
          strokeWeight: 4.5,
          map,
        });

        path.forEach((p) => bounds.extend(p));
        pointCount += path.length;
      }

      if (pointCount >= 2) {
        map.fitBounds(bounds, {
          top: 170,
          right: 40,
          bottom: 210,
          left: 40,
        });
        maps.event.addListenerOnce(map, 'idle', () => {
          if (map && map.getZoom() > 15) {
            map.setZoom(14);
          }
        });
      } else if (origin?.lat && origin?.lng) {
        map.setCenter({ lat: Number(origin.lat), lng: Number(origin.lng) });
        map.setZoom(14);
      } else if (destination?.lat && destination?.lng) {
        map.setCenter({ lat: Number(destination.lat), lng: Number(destination.lng) });
        map.setZoom(14);
      }
    }
  }, [origin, destination, polyline, engineReady]);

  return (
    <View style={[styles.container, style]}>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          minHeight: 340,
          backgroundColor: '#f1f5f9',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    position: 'relative',
    backgroundColor: '#f1f5f9',
  },
});
