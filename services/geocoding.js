import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { tripAPI } from './api';

const GOOGLE_MAPS_KEY =
  Constants.expoConfig?.extra?.googleMapsApiKey ||
  Constants.expoConfig?.android?.config?.googleMaps?.apiKey ||
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
  '';

// 📏 Haversine distance in meters
export function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toR = (d) => (d * Math.PI) / 180;
  const dLat = toR(lat2 - lat1);
  const dLon = toR(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * 1. Reverse Geocode Coordinates to Clean Human-Readable Address
 * e.g. (26.7975, 80.9021) -> "Alambagh, Lucknow"
 */
export async function reverseGeocodeLocation(lat, lng) {
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) return 'Current Location';

  // Strategy A: OpenStreetMap Nominatim Reverse (works on Web & Native with full CORS)
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${nLat}&lon=${nLng}&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'FieldApp-TripPlanner/1.0' },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.address) {
        const a = data.address;
        const locality =
          a.suburb ||
          a.neighbourhood ||
          a.residential ||
          a.village ||
          a.town ||
          a.city_district ||
          a.road ||
          '';
        const city = a.city || a.county || a.state_district || '';
        const clean = [locality, city].filter(Boolean).join(', ');
        if (clean.length > 2) return clean;
      }
      if (data && data.display_name) {
        const parts = data.display_name.split(',').map((p) => p.trim());
        return parts.slice(0, 3).join(', ');
      }
    }
  } catch (err) {
    console.warn('⚠️ [Geocoding] Nominatim reverse geocode failed:', err.message);
  }

  // Strategy B: BigDataCloud Free Reverse Geocode (100% CORS compliant)
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${nLat}&longitude=${nLng}&localityLanguage=en`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const locality = data.locality || data.principalSubdivisionCity || '';
      const city = data.city || data.principalSubdivision || '';
      const clean = [locality, city].filter(Boolean).join(', ');
      if (clean.length > 2) return clean;
    }
  } catch (_) {}

  // Strategy C: Google Geocoding API (if on Native)
  if (GOOGLE_MAPS_KEY && Platform.OS !== 'web') {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${nLat},${nLng}&key=${GOOGLE_MAPS_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === 'OK' && data.results && data.results[0]) {
        return data.results[0].formatted_address;
      }
    } catch (_) {}
  }

  return 'Current Location';
}

let googleMapsPromise = null;

export function loadGoogleMapsWeb() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Browser required'));
  if (!GOOGLE_MAPS_KEY) return Promise.reject(new Error('No Google Maps key'));
  if (window.google?.maps?.places?.AutocompleteService) return Promise.resolve(window.google.maps);

  if (!googleMapsPromise) {
    googleMapsPromise = new Promise((resolve, reject) => {
      const checkAndFinish = () => {
        if (window.google?.maps?.places?.AutocompleteService) resolve(window.google.maps);
        else setTimeout(checkAndFinish, 120);
      };

      const existing = document.querySelector('script[data-google-maps]');
      if (existing) {
        existing.addEventListener('load', checkAndFinish);
        setTimeout(checkAndFinish, 300);
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
        GOOGLE_MAPS_KEY
      )}&libraries=places&loading=async`;
      script.async = true;
      script.defer = true;
      script.dataset.googleMaps = 'true';
      script.onload = checkAndFinish;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  return googleMapsPromise;
}

// Automatically initiate Google Maps SDK loading on web as early as possible
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  loadGoogleMapsWeb().catch(() => {});
}

// 📍 Fast local index of Lucknow & UP locations for instant 0ms suggestions & typo forgiveness
const LOCAL_DIRECTORY = [
  { title: 'Dubagga', subtitle: 'Dubagga, Hardoi Road, Lucknow, Uttar Pradesh', lat: 26.8624, lng: 80.8492 },
  { title: 'Beri', subtitle: 'Beri, Hamirpur / Kanpur Region, Uttar Pradesh', lat: 25.9031, lng: 79.8902 },
  { title: 'Beri (Jhajjar)', subtitle: 'Beri, Jhajjar, Haryana (NCR)', lat: 28.7194, lng: 76.5530 },
  { title: 'Alambagh', subtitle: 'Alambagh, Kanpur Road, Lucknow, Uttar Pradesh', lat: 26.8123, lng: 80.9067 },
  { title: 'Hazratganj', subtitle: 'Hazratganj, Central Lucknow, Uttar Pradesh', lat: 26.8504, lng: 80.9499 },
  { title: 'Charbagh', subtitle: 'Charbagh Railway Station, Lucknow, Uttar Pradesh', lat: 26.8322, lng: 80.9231 },
  { title: 'Gomti Nagar', subtitle: 'Gomti Nagar, Lucknow, Uttar Pradesh', lat: 26.8524, lng: 80.9992 },
  { title: 'Aminabad', subtitle: 'Aminabad Market, Lucknow, Uttar Pradesh', lat: 26.8447, lng: 80.9248 },
  { title: 'Chowk', subtitle: 'Chowk, Old Lucknow, Uttar Pradesh', lat: 26.8698, lng: 80.9085 },
  { title: 'Indiranagar', subtitle: 'Indira Nagar, Lucknow, Uttar Pradesh', lat: 26.8858, lng: 80.9959 },
  { title: 'Mahanagar', subtitle: 'Mahanagar, Lucknow, Uttar Pradesh', lat: 26.8791, lng: 80.9529 },
  { title: 'Ashiyana', subtitle: 'Ashiyana Colony, Lucknow, Uttar Pradesh', lat: 26.7865, lng: 80.9135 },
  { title: 'Rajajipuram', subtitle: 'Rajajipuram, Lucknow, Uttar Pradesh', lat: 26.8458, lng: 80.8872 },
  { title: 'Telibagh', subtitle: 'Telibagh, Raebareli Road, Lucknow, Uttar Pradesh', lat: 26.7797, lng: 80.9385 },
  { title: 'Transport Nagar', subtitle: 'Transport Nagar, Kanpur Road, Lucknow', lat: 26.7758, lng: 80.8854 },
  { title: 'Chinhat', subtitle: 'Chinhat, Faizabad Road, Lucknow, Uttar Pradesh', lat: 26.8904, lng: 81.0487 },
  { title: 'Kakori', subtitle: 'Kakori, Lucknow, Uttar Pradesh', lat: 26.8814, lng: 80.7963 },
  { title: 'Malihabad', subtitle: 'Malihabad, Lucknow, Uttar Pradesh', lat: 26.9209, lng: 80.7139 },
  { title: 'Mohanlalganj', subtitle: 'Mohanlalganj, Lucknow, Uttar Pradesh', lat: 26.6853, lng: 80.9851 },
  { title: 'Bakshi Ka Talab (BKT)', subtitle: 'BKT, Sitapur Road, Lucknow, Uttar Pradesh', lat: 27.0025, lng: 80.9168 },
  { title: 'Kanpur Central', subtitle: 'Kanpur, Uttar Pradesh', lat: 26.4499, lng: 80.3319 },
  { title: 'Unnao', subtitle: 'Unnao, Uttar Pradesh', lat: 26.5452, lng: 80.4878 },
  { title: 'Barabanki', subtitle: 'Barabanki, Uttar Pradesh', lat: 26.9274, lng: 81.1843 },
  { title: 'Sitapur', subtitle: 'Sitapur, Uttar Pradesh', lat: 27.5644, lng: 80.6829 },
  { title: 'Raebareli', subtitle: 'Raebareli, Uttar Pradesh', lat: 26.2294, lng: 81.2407 },
  { title: 'Hardoi', subtitle: 'Hardoi, Uttar Pradesh', lat: 27.3989, lng: 80.1309 },
  { title: 'Fatehpur', subtitle: 'Fatehpur, Uttar Pradesh', lat: 25.9318, lng: 80.8129 },
  { title: 'Ayodhya', subtitle: 'Ayodhya / Faizabad, Uttar Pradesh', lat: 26.7922, lng: 82.1998 },
  { title: 'Hamirpur', subtitle: 'Hamirpur, Uttar Pradesh', lat: 25.9558, lng: 80.1508 },
  { title: 'Jhansi', subtitle: 'Jhansi, Uttar Pradesh', lat: 25.4484, lng: 78.5685 },
  { title: 'Prayagraj', subtitle: 'Prayagraj (Allahabad), Uttar Pradesh', lat: 25.4358, lng: 81.8463 },
  { title: 'Varanasi', subtitle: 'Varanasi, Uttar Pradesh', lat: 25.3176, lng: 82.9739 },
];

/**
 * 2. Search Place Predictions (Autocomplete)
 * Handles typo-tolerance (e.g. "dubb" -> "Dubagga", "beri" -> "Beri")
 * Completely client-side & direct (Zero 404s guaranteed)
 */
export async function searchPlacesAutocomplete(query, refLat = null, refLng = null) {
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    // 🌟 Return top popular destinations in city for instant 1-tap selection on focus!
    return LOCAL_DIRECTORY.slice(0, 15).map((loc) => ({
      placeId: `local:${loc.title}`,
      title: loc.title,
      subtitle: loc.subtitle,
      description: loc.subtitle,
      lat: loc.lat,
      lng: loc.lng,
      source: 'local_directory',
    }));
  }
  const cleanQuery = query.trim().toLowerCase();
  const collected = [];
  const seenTitles = new Set();

  const addUnique = (item) => {
    const key = (item.title || item.description || '').trim().toLowerCase();
    if (!key || seenTitles.has(key)) return;
    seenTitles.add(key);
    collected.push(item);
  };

  function normalizeFuzzy(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/(.)\1+/g, (m, c) => c);
  }

  // ── 1. FAST LOCAL DIRECTORY MATCH (Instant 0ms UI feedback + typo tolerance) ──
  const fuzzyQuery = normalizeFuzzy(cleanQuery);
  for (const loc of LOCAL_DIRECTORY) {
    const locLower = loc.title.toLowerCase();
    const subLower = loc.subtitle.toLowerCase();
    const fuzzyTitle = normalizeFuzzy(loc.title);
    const fuzzySub = normalizeFuzzy(loc.subtitle);

    const isMatch =
      locLower.includes(cleanQuery) ||
      cleanQuery.includes(locLower) ||
      subLower.includes(cleanQuery) ||
      (fuzzyQuery.length >= 3 &&
        (fuzzyTitle.includes(fuzzyQuery) ||
          fuzzyQuery.includes(fuzzyTitle) ||
          fuzzySub.includes(fuzzyQuery)));

    if (isMatch) {
      addUnique({
        placeId: `local:${loc.title}`,
        title: loc.title,
        subtitle: loc.subtitle,
        description: loc.subtitle,
        lat: loc.lat,
        lng: loc.lng,
        source: 'local_directory',
      });
    }
  }

  // ── 2. GOOGLE MAPS WEB AUTOCOMPLETE (If on Web) ──
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      if (!window.google?.maps?.places?.AutocompleteService) {
        await Promise.race([
          loadGoogleMapsWeb(),
          new Promise((r) => setTimeout(r, 600)),
        ]);
      }

      if (window.google?.maps?.places?.AutocompleteService) {
        const service = new window.google.maps.places.AutocompleteService();
        const predictions = await new Promise((resolve) => {
          const req = {
            input: query.trim(),
            componentRestrictions: { country: 'in' },
          };
          if (Number.isFinite(refLat) && Number.isFinite(refLng)) {
            req.locationBias = {
              radius: 50000,
              center: { lat: Number(refLat), lng: Number(refLng) },
            };
          }
          service.getPlacePredictions(req, (results, status) => {
            if (
              status === window.google.maps.places.PlacesServiceStatus.OK &&
              Array.isArray(results)
            ) {
              resolve(results);
            } else {
              resolve([]);
            }
          });
        });

        for (const p of predictions || []) {
          addUnique({
            placeId: p.place_id,
            title: p.structured_formatting?.main_text || p.description.split(',')[0],
            subtitle: p.structured_formatting?.secondary_text || p.description,
            description: p.description,
            source: 'google_web',
          });
        }
      }
    } catch (_) {}
  }

  // ── 3. GOOGLE PLACES REST API (If on Native) ──
  if (Platform.OS !== 'web' && GOOGLE_MAPS_KEY) {
    try {
      let url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
        query.trim()
      )}&key=${GOOGLE_MAPS_KEY}&components=country:in&language=en`;
      if (Number.isFinite(refLat) && Number.isFinite(refLng)) {
        url += `&location=${refLat},${refLng}&radius=50000`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === 'OK' && Array.isArray(data.predictions)) {
        for (const p of data.predictions) {
          addUnique({
            placeId: p.place_id,
            title: p.structured_formatting?.main_text || p.description.split(',')[0],
            subtitle: p.structured_formatting?.secondary_text || p.description,
            description: p.description,
            source: 'google_native',
          });
        }
      }
    } catch (_) {}
  }

  // ── 4. PHOTON REAL-TIME TYPEAHEAD API (OSM powered, with India prioritization) ──
  if (collected.length < 8) {
    try {
      const biasLat = Number.isFinite(refLat) ? refLat : 26.8467;
      const biasLng = Number.isFinite(refLng) ? refLng : 80.9462;
      const pUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(
        query.trim()
      )}&limit=10&lat=${biasLat}&lon=${biasLng}`;
      const pRes = await fetch(pUrl);
      if (pRes.ok) {
        const pData = await pRes.json();
        if (Array.isArray(pData.features)) {
          const inFeatures = pData.features.filter(
            (f) => !f.properties?.countrycode || f.properties?.countrycode === 'IN'
          );
          const otherFeatures = pData.features.filter(
            (f) => f.properties?.countrycode && f.properties?.countrycode !== 'IN'
          );
          const allFeats = [...inFeatures, ...otherFeatures];

          for (const feat of allFeats) {
            const props = feat.properties || {};
            const coords = feat.geometry?.coordinates;
            if (coords && coords.length >= 2 && props.name) {
              const sub = [props.street, props.district, props.city, props.state, props.country]
                .filter(Boolean)
                .join(', ');
              addUnique({
                placeId: `photon:${props.osm_id || Math.random()}`,
                title: props.name,
                subtitle: sub || props.name,
                description: `${props.name}${sub ? ', ' + sub : ''}`,
                lat: coords[1],
                lng: coords[0],
                source: 'photon',
              });
            }
          }
        }
      }
    } catch (_) {}
  }

  // ── 5. OPENSTREETMAP NOMINATIM SEARCH (CORS Fallback for India) ──
  if (collected.length < 8) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        query.trim()
      )}&countrycodes=in&limit=8&addressdetails=1`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'FieldApp-TripPlanner/1.0' },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          for (const item of data) {
            addUnique({
              placeId: `osm:${item.place_id}`,
              title: item.name || item.display_name.split(',')[0],
              subtitle: item.display_name,
              description: item.display_name,
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon),
              source: 'osm',
            });
          }
        }
      }
    } catch (_) {}
  }

  return collected;
}

/**
 * 3. Resolve Place Coordinates (lat, lng, formatted address)
 */
export async function resolvePlaceDetails(item) {
  if (!item) return null;

  // 1. If coordinates already attached (Local Directory, Photon, Nominatim)
  if (Number.isFinite(item.lat) && Number.isFinite(item.lng)) {
    return {
      lat: Number(item.lat),
      lng: Number(item.lng),
      address: item.description || item.subtitle || item.title,
    };
  }

  // 2. Google Web PlacesService Details
  if (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    window.google?.maps?.places?.PlacesService &&
    item.placeId
  ) {
    try {
      const dummy = document.createElement('div');
      const service = new window.google.maps.places.PlacesService(dummy);
      const place = await new Promise((resolve) => {
        service.getDetails(
          {
            placeId: item.placeId,
            fields: ['geometry', 'formatted_address', 'name'],
          },
          (res, status) => {
            if (
              status === window.google.maps.places.PlacesServiceStatus.OK &&
              res?.geometry?.location
            ) {
              resolve(res);
            } else {
              resolve(null);
            }
          }
        );
      });

      if (place) {
        return {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          address: place.formatted_address || place.name || item.description,
        };
      }
    } catch (err) {
      console.warn('⚠️ [Geocoding] Google Web Places details failed:', err.message);
    }
  }

  // 3. Native Google Place Details REST API
  if (Platform.OS !== 'web' && GOOGLE_MAPS_KEY && item.placeId && !item.placeId.startsWith('osm:') && !item.placeId.startsWith('photon:')) {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${item.placeId}&fields=geometry,formatted_address,name&key=${GOOGLE_MAPS_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === 'OK' && data.result?.geometry?.location) {
        return {
          lat: data.result.geometry.location.lat,
          lng: data.result.geometry.location.lng,
          address: data.result.formatted_address || data.result.name,
        };
      }
    } catch (_) {}
  }

  // 4. Fallback Geocoding query by description string (Nominatim)
  const queryStr = item.description || item.title || '';
  if (queryStr) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        queryStr
      )}&countrycodes=in&limit=1`;
      const res = await fetch(url, { headers: { 'User-Agent': 'FieldApp-TripPlanner/1.0' } });
      const data = await res.json();
      if (Array.isArray(data) && data[0]) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          address: data[0].display_name,
        };
      }
    } catch (_) {}
  }

  return null;
}

/**
 * 4. Calculate Driving Route between Origin & Destination
 * Uses High-Resolution OSRM Driving Engine with fallback to Indian Road Factor Haversine.
 * Guaranteed 100% Client-Side Direct Execution (Zero 404s).
 */
export async function calculateDrivingRouteDirect(origin, destination) {
  if (!origin || !destination) {
    throw new Error('Both origin and destination coordinates are required.');
  }

  const oLat = Number(origin.lat);
  const oLng = Number(origin.lng);
  const dLat = Number(destination.lat);
  const dLng = Number(destination.lng);

  if (!Number.isFinite(oLat) || !Number.isFinite(oLng) || !Number.isFinite(dLat) || !Number.isFinite(dLng)) {
    throw new Error('Invalid coordinates supplied for route calculation.');
  }

  // ── ATTEMPT 1: High-Resolution OSRM Driving Engine (Universal CORS, real road turn-by-turn) ──
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${oLng},${oLat};${dLng},${dLat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.code === 'Ok' && Array.isArray(data.routes) && data.routes.length > 0) {
        const best = data.routes[0];
        const distanceKm = Math.round((best.distance / 1000) * 100) / 100;
        const durationMins = Math.max(1, Math.round(best.duration / 60));
        const polyline = (best.geometry?.coordinates || []).map((coord) => ({
          latitude: coord[1],
          longitude: coord[0],
        }));

        return {
          distanceKm,
          durationMins,
          polyline,
          engine: 'OSRM_CLIENT',
          origin,
          destination,
        };
      }
    }
  } catch (err) {
    console.warn('⚠️ [Geocoding] OSRM client route failed, falling back:', err.message);
  }

  // ── ATTEMPT 2: Geodesic + Indian Road Factor (1.32x) Real Road Estimate Fallback ──
  const straightMeters = haversineMeters(oLat, oLng, dLat, dLng);
  const roadFactor = 1.32;
  const distanceKm = Math.round(((straightMeters * roadFactor) / 1000) * 100) / 100;
  const durationMins = Math.max(1, Math.round((distanceKm / 28) * 60));

  const polyline = [];
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    polyline.push({
      latitude: oLat + (dLat - oLat) * t,
      longitude: oLng + (dLng - oLng) * t,
    });
  }

  return {
    distanceKm,
    durationMins,
    polyline,
    engine: 'GEODESIC_ROAD_ESTIMATE',
    origin,
    destination,
  };
}
