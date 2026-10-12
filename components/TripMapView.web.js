import React, { useEffect, useRef, useState, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';

const GOOGLE_MAPS_KEY =
  Constants.expoConfig?.extra?.googleMapsApiKey ||
  Constants.expoConfig?.android?.config?.googleMaps?.apiKey ||
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

// 🌟 Uber Iconic Minimal Silver/Pale Map Styling for Google Maps
const UBER_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
  {
    featureType: 'administrative.land_parcel',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#bdbdbd' }],
  },
  {
    featureType: 'poi',
    elementType: 'geometry',
    stylers: [{ color: '#eeeeee' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#757575' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#dcfce7' }], // Soft pale fresh green
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#16a34a' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#ffffff' }], // Crisp white roads
  },
  {
    featureType: 'road.arterial',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#757575' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#dadada' }], // Silver highway
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#616161' }],
  },
  {
    featureType: 'road.local',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#9e9e9e' }],
  },
  {
    featureType: 'transit.line',
    elementType: 'geometry',
    stylers: [{ color: '#e5e5e5' }],
  },
  {
    featureType: 'transit.station',
    elementType: 'geometry',
    stylers: [{ color: '#eeeeee' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#c7e9fb' }], // Soft light blue water
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#0284c7' }],
  },
];

// Helper to compute bearing/heading angle between two coordinates
function calculateBearing(start, end) {
  if (!start || !end) return 0;
  const lat1 = (Number(start.latitude || start.lat) * Math.PI) / 180;
  const lat2 = (Number(end.latitude || end.lat) * Math.PI) / 180;
  const dLng = ((Number(end.longitude || end.lng) - Number(start.longitude || start.lng)) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

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

// SVG strings for markers
function createUberDestSvg(durationText = '16 min') {
  const safeText = String(durationText).replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `data:image/svg+xml;utf-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="100" height="76" viewBox="0 0 100 76">
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" flood-opacity="0.25"/>
        </filter>
      </defs>
      <!-- Callout Bubble -->
      <rect x="8" y="2" width="84" height="36" rx="8" fill="#ffffff" stroke="#e2e8f0" stroke-width="1" filter="url(#shadow)"/>
      <text x="50" y="16" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif" font-size="8.5" font-weight="700" fill="#64748b" text-anchor="middle" letter-spacing="0.5">ARRIVAL</text>
      <text x="50" y="30" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif" font-size="13" font-weight="900" fill="#0f172a" text-anchor="middle">${safeText}</text>
      <!-- Downward Pointer Arrow -->
      <polygon points="45,38 55,38 50,44" fill="#ffffff"/>
      <!-- Target Pulse Ring -->
      <circle cx="50" cy="58" r="13" fill="rgba(59,130,246,0.22)" stroke="rgba(59,130,246,0.5)" stroke-width="1.5"/>
      <!-- Outer Black Circle -->
      <circle cx="50" cy="58" r="8" fill="#000000"/>
      <!-- Inner White Ring -->
      <circle cx="50" cy="58" r="4.5" fill="#ffffff"/>
      <!-- Core Black Dot -->
      <circle cx="50" cy="58" r="2" fill="#000000"/>
    </svg>
  `)}`;
}

const UBER_ORIGIN_SVG = `data:image/svg+xml;utf-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
    <!-- Pulse Ring -->
    <circle cx="14" cy="14" r="12" fill="rgba(16,185,129,0.2)" stroke="rgba(16,185,129,0.4)" stroke-width="1"/>
    <!-- Outer Black Circle -->
    <circle cx="14" cy="14" r="7" fill="#000000" stroke="#ffffff" stroke-width="2.5"/>
    <!-- Inner Core Dot -->
    <circle cx="14" cy="14" r="2" fill="#ffffff"/>
  </svg>
`)}`;

function createUberCarSvg(heading = 0) {
  return `data:image/svg+xml;utf-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="56" viewBox="0 0 36 56">
      <defs>
        <filter id="carShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="4" stdDeviation="3" flood-opacity="0.32"/>
        </filter>
      </defs>
      <g transform="rotate(${heading} 18 28)">
        <!-- Car Body -->
        <rect x="7" y="6" width="22" height="44" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" filter="url(#carShadow)"/>
        <!-- Front Headlights -->
        <rect x="8.5" y="7" width="3" height="2" rx="1" fill="#fef08a"/>
        <rect x="24.5" y="7" width="3" height="2" rx="1" fill="#fef08a"/>
        <!-- Front Windshield -->
        <rect x="10" y="11" width="16" height="6" rx="2" fill="#1e293b"/>
        <!-- Panoramic Glass Roof -->
        <rect x="11" y="19" width="14" height="15" rx="2" fill="#0f172a"/>
        <!-- Rear Windshield -->
        <rect x="10" y="36" width="16" height="4" rx="1" fill="#1e293b"/>
        <!-- Rear Red Taillights -->
        <rect x="8.5" y="47.5" width="3" height="1.8" rx="0.9" fill="#ef4444"/>
        <rect x="24.5" y="47.5" width="3" height="1.8" rx="0.9" fill="#ef4444"/>
      </g>
    </svg>
  `)}`;
}

export default function TripMapViewWeb({
  origin,
  destination,
  polyline = [],
  traveledTrail = [],
  currentLocation,
  durationText,
  distanceKm,
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
  const googleVehicleMarkerRef = useRef(null);

  // Leaflet references
  const leafletMapRef = useRef(null);
  const leafletOriginMarkerRef = useRef(null);
  const leafletDestMarkerRef = useRef(null);
  const leafletPolylineRef = useRef(null);
  const leafletCasingRef = useRef(null);
  const leafletVehicleMarkerRef = useRef(null);

  const [engineReady, setEngineReady] = useState(null); // 'google' | 'leaflet' | null

  // 1. Initialize Map Engine (Google Maps with seamless Leaflet fallback)
  useEffect(() => {
    let isMounted = true;

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
        if (!GOOGLE_MAPS_KEY) throw new Error('No Google Maps Key provided');

        const maps = await loadGoogleMaps();
        if (!isMounted || !containerRef.current) return;

        const centerLat = Number(origin?.lat || destination?.lat || 26.8467);
        const centerLng = Number(origin?.lng || destination?.lng || 80.9462);

        googleMapRef.current = new maps.Map(containerRef.current, {
          center: { lat: centerLat, lng: centerLng },
          zoom: 14,
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

  // Compute vehicle position and bearing
  const vehicleState = useMemo(() => {
    if (currentLocation?.latitude && currentLocation?.longitude) {
      const heading = currentLocation.heading ?? (
        polyline.length >= 2
          ? calculateBearing(polyline[0], polyline[1])
          : 0
      );
      return {
        lat: Number(currentLocation.latitude),
        lng: Number(currentLocation.longitude),
        heading: Math.round(heading),
      };
    }
    if (polyline && polyline.length >= 2) {
      return {
        lat: Number(polyline[0].latitude),
        lng: Number(polyline[0].longitude),
        heading: Math.round(calculateBearing(polyline[0], polyline[1])),
      };
    } else if (origin?.lat && origin?.lng && destination?.lat && destination?.lng) {
      return {
        lat: Number(origin.lat),
        lng: Number(origin.lng),
        heading: Math.round(calculateBearing(origin, destination)),
      };
    }
    return null;
  }, [currentLocation, polyline, origin, destination]);

  // 2. Render Markers and Polyline on Active Map Engine
  useEffect(() => {
    if (!engineReady) return;

    const displayDuration = durationText || (distanceKm ? `${Math.round(distanceKm * 2)} min` : '16 min');

    // ── CASE A: LEAFLET ENGINE ──
    if (engineReady === 'leaflet' && leafletMapRef.current && window.L) {
      const L = window.L;
      const map = leafletMapRef.current;

      // Clear previous overlays
      if (leafletOriginMarkerRef.current) leafletOriginMarkerRef.current.remove();
      if (leafletDestMarkerRef.current) leafletDestMarkerRef.current.remove();
      if (leafletPolylineRef.current) leafletPolylineRef.current.remove();
      if (leafletCasingRef.current) leafletCasingRef.current.remove();
      if (leafletVehicleMarkerRef.current) leafletVehicleMarkerRef.current.remove();

      const points = [];

      // ── Point A Marker (Uber Origin Pickup Dot) ──
      if (origin?.lat && origin?.lng) {
        const pos = [Number(origin.lat), Number(origin.lng)];
        const iconA = L.divIcon({
          className: 'uber-pin-origin',
          html: `<div style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;position:relative;">
            <div style="position:absolute;width:22px;height:22px;border-radius:11px;background:rgba(16,185,129,0.22);border:1px solid rgba(16,185,129,0.45);"></div>
            <div style="width:14px;height:14px;border-radius:7px;background:#000000;border:2.5px solid #ffffff;box-shadow:0 3px 6px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;">
              <div style="width:3px;height:3px;border-radius:1.5px;background:#ffffff;"></div>
            </div>
          </div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
        leafletOriginMarkerRef.current = L.marker(pos, { icon: iconA }).addTo(map);
        points.push(pos);
      }

      // ── Point B Marker (Uber Destination Arrival Badge + Target Pin) ──
      if (destination?.lat && destination?.lng) {
        const pos = [Number(destination.lat), Number(destination.lng)];
        const iconB = L.divIcon({
          className: 'uber-pin-dest',
          html: `<div style="display:flex;flex-direction:column;align-items:center;margin-top:-62px;margin-left:-40px;width:80px;">
            <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:3px 10px;box-shadow:0 4px 12px rgba(0,0,0,0.18);display:flex;flex-direction:column;align-items:center;min-width:64px;">
              <span style="font-size:8.5px;font-weight:700;color:#64748b;letter-spacing:0.5px;text-transform:uppercase;">ARRIVAL</span>
              <span style="font-size:13px;font-weight:900;color:#0f172a;line-height:16px;">${displayDuration}</span>
            </div>
            <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:5px solid #ffffff;margin-top:-1px;margin-bottom:2px;"></div>
            <div style="width:26px;height:26px;border-radius:13px;background:rgba(59,130,246,0.22);border:1.5px solid rgba(59,130,246,0.5);display:flex;align-items:center;justify-content:center;">
              <div style="width:16px;height:16px;border-radius:8px;background:#000000;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 5px rgba(0,0,0,0.3);">
                <div style="width:8px;height:8px;border-radius:4px;background:#ffffff;display:flex;align-items:center;justify-content:center;">
                  <div style="width:4px;height:4px;border-radius:2px;background:#000000;"></div>
                </div>
              </div>
            </div>
          </div>`,
          iconSize: [80, 70],
          iconAnchor: [40, 68],
        });
        leafletDestMarkerRef.current = L.marker(pos, { icon: iconB }).addTo(map);
        points.push(pos);
      }

      // ── Uber Route Polyline (White casing + Dark Charcoal Inner) ──
      if (polyline && polyline.length > 1) {
        const routePts = polyline.map((p) => [Number(p.latitude), Number(p.longitude)]);

        // Outer White Casing
        leafletCasingRef.current = L.polyline(routePts, {
          color: '#ffffff',
          opacity: 1,
          weight: 8,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);

        // Inner Jet Black / Dark Charcoal Uber Route Line
        leafletPolylineRef.current = L.polyline(routePts, {
          color: '#18181b',
          opacity: 1,
          weight: 5,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);

        points.push(...routePts);
      }

      // ── Uber 3D Top-Down Car Marker ──
      if (vehicleState) {
        const carIcon = L.divIcon({
          className: 'uber-car-marker',
          html: `<div style="transform: rotate(${vehicleState.heading}deg); transform-origin: center center; width: 34px; height: 50px;">
            <svg width="34" height="50" viewBox="0 0 34 50">
              <rect x="6" y="5" width="22" height="42" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.35));"/>
              <rect x="7.5" y="6" width="3" height="2" rx="1" fill="#fef08a"/>
              <rect x="23.5" y="6" width="3" height="2" rx="1" fill="#fef08a"/>
              <rect x="9" y="10" width="16" height="6" rx="2" fill="#1e293b"/>
              <rect x="10" y="18" width="14" height="15" rx="2" fill="#0f172a"/>
              <rect x="9" y="35" width="16" height="4" rx="1" fill="#1e293b"/>
              <rect x="7.5" y="45.5" width="3" height="1.8" rx="0.9" fill="#ef4444"/>
              <rect x="23.5" y="45.5" width="3" height="1.8" rx="0.9" fill="#ef4444"/>
            </svg>
          </div>`,
          iconSize: [34, 50],
          iconAnchor: [17, 25],
        });
        leafletVehicleMarkerRef.current = L.marker([vehicleState.lat, vehicleState.lng], { icon: carIcon }).addTo(map);
      }

      // Smart Camera Framing
      if (points.length >= 2) {
        map.fitBounds(L.latLngBounds(points), {
          paddingTopLeft: [50, 160],
          paddingBottomRight: [50, 220],
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
      if (googleVehicleMarkerRef.current) googleVehicleMarkerRef.current.setMap(null);

      const bounds = new maps.LatLngBounds();
      let pointCount = 0;

      // ── Origin Marker (Uber Pickup Dot) ──
      if (origin?.lat && origin?.lng) {
        const pos = { lat: Number(origin.lat), lng: Number(origin.lng) };
        googleOriginMarkerRef.current = new maps.Marker({
          position: pos,
          map,
          title: origin.address || 'Pickup Point',
          icon: {
            url: UBER_ORIGIN_SVG,
            scaledSize: new maps.Size(28, 28),
            anchor: new maps.Point(14, 14),
          },
        });
        bounds.extend(pos);
        pointCount++;
      }

      // ── Destination Marker (Uber Arrival Bubble + Target Pin) ──
      if (destination?.lat && destination?.lng) {
        const pos = { lat: Number(destination.lat), lng: Number(destination.lng) };
        googleDestMarkerRef.current = new maps.Marker({
          position: pos,
          map,
          title: destination.address || 'Destination',
          icon: {
            url: createUberDestSvg(displayDuration),
            scaledSize: new maps.Size(100, 76),
            anchor: new maps.Point(50, 58),
          },
        });
        bounds.extend(pos);
        pointCount++;
      }

      // ── Driving Route Polyline (White Casing + Jet Black Inner) ──
      if (polyline && polyline.length > 1) {
        const path = polyline.map((p) => ({
          lat: Number(p.latitude),
          lng: Number(p.longitude),
        }));

        googleCasingPolylineRef.current = new maps.Polyline({
          path,
          geodesic: true,
          strokeColor: '#ffffff',
          strokeOpacity: 1,
          strokeWeight: 8,
          map,
        });

        googlePolylineRef.current = new maps.Polyline({
          path,
          geodesic: true,
          strokeColor: '#18181b', // Uber signature dark charcoal / black line
          strokeOpacity: 1,
          strokeWeight: 5,
          map,
        });

        path.forEach((p) => bounds.extend(p));
        pointCount += path.length;
      }

      // ── Uber 3D Car Marker ──
      if (vehicleState) {
        googleVehicleMarkerRef.current = new maps.Marker({
          position: { lat: vehicleState.lat, lng: vehicleState.lng },
          map,
          title: 'Vehicle',
          icon: {
            url: createUberCarSvg(vehicleState.heading),
            scaledSize: new maps.Size(36, 56),
            anchor: new maps.Point(18, 28),
          },
        });
      }

      if (pointCount >= 2) {
        map.fitBounds(bounds, {
          top: 170,
          right: 50,
          bottom: 220,
          left: 50,
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
  }, [origin, destination, polyline, engineReady, durationText, distanceKm, vehicleState]);

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
