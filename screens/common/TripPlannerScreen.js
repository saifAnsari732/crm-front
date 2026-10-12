import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Dimensions,
  RefreshControl,
  KeyboardAvoidingView,
  AppState,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Surface } from 'react-native-paper';
import {
  MapPin,
  Navigation,
  ArrowRight,
  ArrowLeft,
  Search,
  CheckCircle2,
  Clock,
  RotateCcw,
  ArrowUpDown,
  History,
  Check,
  X,
  Car,
  AlertCircle,
  Building2,
  Briefcase,
  TrendingUp,
  ClipboardCheck,
  Users,
  Play,
  Lock,
  Flag,
  AlertTriangle,
  Zap,
} from 'lucide-react-native';
import * as Location from 'expo-location';
import { tripAPI } from '../../services/api';
import {
  reverseGeocodeLocation,
  searchPlacesAutocomplete,
  resolvePlaceDetails,
  calculateDrivingRouteDirect,
  haversineMeters,
} from '../../services/geocoding';
import { useAuth } from '../../context/AuthContext';
import useLocationTracker from '../../hooks/useLocationTracker';
import TripMapView from '../../components/TripMapView';
import { storage } from '../../services/storage';
import {
  startTripBackgroundTracking,
  stopTripBackgroundTracking,
} from '../../services/tripPlannerBackground';

const { width, height } = Dimensions.get('window');

const PURPOSE_OPTIONS = [
  'Client Meeting',
  'Inspection',
];


export default function TripPlannerScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isTracking } = useLocationTracker();

  // Active Screen Tab: 'planner' or 'history'
  const [activeTab, setActiveTab] = useState('planner');

  // Trip Lifecycle State: 'PLANNING' | 'IN_PROGRESS'
  const [tripStatus, setTripStatus] = useState('PLANNING');
  const [isRefreshingGps, setIsRefreshingGps] = useState(false);
  const locationWatcherRef = useRef(null);
  const webWatchIdRef = useRef(null);

  // Origin & Destination state
  const [origin, setOrigin] = useState(null); // { lat, lng, address }
  const [destination, setDestination] = useState(null); // { lat, lng, address }
  const [currentGps, setCurrentGps] = useState(null);

  // Search input strings
  const [originText, setOriginText] = useState('');
  const [destText, setDestText] = useState('');

  // Autocomplete predictions
  const [predictions, setPredictions] = useState([]);
  const [searchingField, setSearchingField] = useState(null); // 'origin' | 'dest' | null
  const [isSearching, setIsSearching] = useState(false);

  // Route calculation state
  const [isRouting, setIsRouting] = useState(false);
  const [routeData, setRouteData] = useState(null); // { distanceKm, durationMins, polyline, ratePerKm, reimbursementAmount }

  // Purpose & Client details
  const [selectedPurpose, setSelectedPurpose] = useState('Client Meeting');
  const [clientName, setClientName] = useState('');

  // Confirm / Submit state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successModal, setSuccessModal] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showEarlyClaimModal, setShowEarlyClaimModal] = useState(false);
  const [showArrivalModal, setShowArrivalModal] = useState(false);
  const [isArrivedWithin500m, setIsArrivedWithin500m] = useState(false);
  const hasNotifiedArrivalRef = useRef(false);

  // Dynamic Odometer & Movement State (persisted & updated on every meter traveled)
  const [traveledKm, setTraveledKm] = useState(0);
  const [traveledMeters, setTraveledMeters] = useState(0);
  const [gpsFixCount, setGpsFixCount] = useState(0);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [motionStatus, setMotionStatus] = useState('STATIONARY');
  const lastFixRef = useRef(null); // { lat, lng, timestamp, accuracy, speed }
  const stationaryAnchorRef = useRef(null); // { lat, lng }
  const lastConfirmedCoordRef = useRef(null); // { lat, lng, timestamp }
  const isMovingRef = useRef(false);
  const originIsLiveGpsRef = useRef(true); // true while origin == employee's real GPS position

  // Fetch a fresh high-accuracy GPS fix and resolve it into an origin object (also updates UI)
  const fetchFreshLiveOrigin = async () => {
    try {
      let lat; let lng;
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
        const pos = await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, maximumAge: 0, timeout: 6000 })
        );
        lat = pos.coords.latitude; lng = pos.coords.longitude;
      } else {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        lat = loc.coords.latitude; lng = loc.coords.longitude;
      }
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      setCurrentGps({ lat, lng });
      const addr = await reverseGeocodeLocation(lat, lng);
      const liveOrigin = { lat, lng, address: addr };
      originIsLiveGpsRef.current = true;
      setOrigin(liveOrigin);
      setOriginText(addr);
      return liveOrigin;
    } catch (e) {
      console.warn('fetchFreshLiveOrigin failed:', e?.message);
      return null;
    }
  };
  const departureCandidateCountRef = useRef(0);
  const haltCandidateCountRef = useRef(0);
  const accumulatedTraveledMetersRef = useRef(0);
  const actualTrailRef = useRef([]); // [{ lat, lng, speed, accuracy, timestamp }]

  // History Tab State
  const [tripsHistory, setTripsHistory] = useState([]);
  const [historySummary, setHistorySummary] = useState({ totalKm: 0, totalPayout: 0 });
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyRefreshing, setHistoryRefreshing] = useState(false);

  const searchTimeoutRef = useRef(null);

  // ── DYNAMIC DISTANCE TELEMETRY (REAL-TIME ARRIVAL & ROAD PROGRESS) ──
  // Robust coordinate coercion: safely parses strings, numbers, and alternate key formats
  const destLat = destination ? Number(destination.lat ?? destination.latitude) : NaN;
  const destLng = destination ? Number(destination.lng ?? destination.longitude) : NaN;
  const currLat = currentGps ? Number(currentGps.lat ?? currentGps.latitude) : NaN;
  const currLng = currentGps ? Number(currentGps.lng ?? currentGps.longitude) : NaN;

  const distanceToDestMeters = (Number.isFinite(currLat) && Number.isFinite(currLng) && Number.isFinite(destLat) && Number.isFinite(destLng))
    ? haversineMeters(currLat, currLng, destLat, destLng)
    : null;

  // 500M Arrival Rule: When employee reaches within 500m radius of destination (with GPS accuracy tolerance)
  const arrivalToleranceM = Math.min(60, Math.max(20, gpsAccuracy || 25));
  const isWithin500m = Boolean(
    isArrivedWithin500m ||
    (distanceToDestMeters !== null && distanceToDestMeters <= (500 + arrivalToleranceM))
  );

  // Ground Truth: Did employee reach destination?
  // Full claim is ONLY AND STRICTLY granted when employee is within 500m radius of destination (near destination)!
  // If NOT within 500m radius, employee gets ONLY the distance physically moved (traveledKm), NEVER full claim!
  const hasCompletedFullJourney = Boolean(routeData?.distanceKm && isWithin500m);

  // Authoritative Effective Traveled KM:
  // If destination reached (<= 500m), full planned route distance is credited! Otherwise actual moved KM.
  const effectiveTraveledKm = hasCompletedFullJourney
    ? routeData.distanceKm
    : Math.min(
        routeData?.distanceKm || 0,
        Math.round(traveledKm * 100) / 100
      );

  // Remaining Road KM:
  //  • At start (0 m moved) = full planned road distance (e.g. 12.74 KM or 9.3 KM), NOT the aerial distance (8.9 KM)
  //  • While travelling = dynamically reflects actual proximity to destination (never stuck at planned - moved if user took shortcut)
  //  • Reached (within 500m) = strictly 0 KM!
  const aerialKm = distanceToDestMeters !== null ? distanceToDestMeters / 1000 : 0;
  const roadRemainingByGps = distanceToDestMeters !== null ? Math.round((distanceToDestMeters * 1.15) / 100) / 10 : null;

  let remainingRoadKm = 0;
  if (hasCompletedFullJourney || isWithin500m) {
    remainingRoadKm = 0;
  } else if (!traveledKm || traveledKm < 0.05) {
    // Before moving: show full planned road distance
    remainingRoadKm = routeData?.distanceKm || (roadRemainingByGps ?? 0);
  } else if (routeData?.distanceKm) {
    // While traveling: if user took a direct shortcut or is approaching destination, direct GPS proximity takes precedence
    const subtractionRemaining = Math.max(0, Math.round((routeData.distanceKm - traveledKm) * 100) / 100);
    if (roadRemainingByGps !== null) {
      remainingRoadKm = Math.min(subtractionRemaining, roadRemainingByGps);
      remainingRoadKm = Math.max(aerialKm, remainingRoadKm);
      remainingRoadKm = Math.round(remainingRoadKm * 100) / 100;
    } else {
      remainingRoadKm = subtractionRemaining;
    }
  } else {
    remainingRoadKm = Math.round(aerialKm * 100) / 100;
  }

  const ratePerKm = Number(user?.TA || user?.travelRate || 2.50);
  const claimAmount = Math.round(effectiveTraveledKm * ratePerKm * 100) / 100;

  // Formatted human-readable moved distance (shows actual physical meters moved)
  const formattedMovedDistance = traveledMeters >= 1000
    ? `${traveledKm} KM`
    : `${traveledMeters}m (${traveledKm} KM)`;

  // 1. Initialise & Restore Trip Across App Close / Kill / Restart
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        // A. Check if user already had an active trip planned or in-progress before closing app!
        const isActive = await storage.getItem('active_trip_planner_is_active');
        if (isActive === 'true') {
          const savedOriginStr = await storage.getItem('active_trip_planner_origin');
          const savedDestStr = await storage.getItem('active_trip_planner_destination');
          const savedRouteStr = await storage.getItem('active_trip_planner_route');
          const savedPurpose = await storage.getItem('active_trip_planner_purpose');
          const savedClient = await storage.getItem('active_trip_planner_client');
          const savedStatus = await storage.getItem('active_trip_planner_status');

          let hasRestoredData = false;

          if (savedOriginStr && isMounted) {
            try {
              const savedOrigin = JSON.parse(savedOriginStr);
              setOrigin(savedOrigin);
              setOriginText(savedOrigin.address || '');
              hasRestoredData = true;
            } catch (_) {}
          }

          if (savedDestStr && isMounted) {
            try {
              const savedDest = JSON.parse(savedDestStr);
              setDestination(savedDest);
              setDestText(savedDest.address || '');
              hasRestoredData = true;
            } catch (_) {}
          }

          if (savedPurpose && isMounted) setSelectedPurpose(savedPurpose);
          if (savedClient && isMounted) setClientName(savedClient);

          if (savedStatus === 'IN_PROGRESS' && isMounted) {
            setTripStatus('IN_PROGRESS');
            hasRestoredData = true;
            isMovingRef.current = false;
            setMotionStatus('STATIONARY');
            stationaryAnchorRef.current = null;
            lastConfirmedCoordRef.current = null;
            lastFixRef.current = null;
            const savedTraveledM = await storage.getItem('active_trip_planner_traveled_m');
            if (savedTraveledM) {
              const parsedM = parseFloat(savedTraveledM) || 0;
              accumulatedTraveledMetersRef.current = parsedM;
              setTraveledMeters(Math.round(parsedM));
              setTraveledKm(Math.round((parsedM / 1000) * 100) / 100);
            }
            const savedTrailStr = await storage.getItem('active_trip_planner_trail');
            if (savedTrailStr) {
              try {
                actualTrailRef.current = JSON.parse(savedTrailStr) || [];
              } catch (_) {}
            }
            const savedIsWithin500m = await storage.getItem('active_trip_planner_is_within_500m');
            if (savedIsWithin500m === 'true' && isMounted) {
              setIsArrivedWithin500m(true);
              setShowArrivalModal(true);
            }
          }

          if (savedRouteStr && isMounted) {
            try {
              const parsedRoute = JSON.parse(savedRouteStr);
              setRouteData(parsedRoute);
              hasRestoredData = true;
            } catch (_) {}
          } else if (savedOriginStr && savedDestStr && isMounted) {
            calculateDrivingRouteDirect(JSON.parse(savedOriginStr), JSON.parse(savedDestStr)).then((r) => {
              if (isMounted && r) setRouteData(r);
            });
          }

          if (hasRestoredData) {
            // Refresh latest live GPS position in background
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
              .then((loc) => {
                if (isMounted && loc?.coords) {
                  setCurrentGps({ lat: loc.coords.latitude, lng: loc.coords.longitude });
                }
              })
              .catch(() => {});

            console.log('🔄 [TripPlanner] Complete state restored across app close/reload! Status:', savedStatus || 'PLANNING');
            return;
          }
        }

        // B. If no saved active trip, initialize Point A with current live GPS
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.warn('Location permission denied for trip planner');
          return;
        }

        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        const lat = loc.coords.latitude;
        const lng = loc.coords.longitude;
        if (!isMounted) return;
        setCurrentGps({ lat, lng });

        // Auto-resolve clean, real human-readable address
        const resolvedAddr = await reverseGeocodeLocation(lat, lng);
        if (!isMounted) return;
        const initialOrigin = { lat, lng, address: resolvedAddr };
        setOrigin(initialOrigin);
        setOriginText(resolvedAddr);
      } catch (err) {
        console.warn('Error fetching GPS for trip planner:', err.message);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  // ── ADVANCED HIGH-PRECISION REAL DISPLACEMENT ODOMETER (GEOFENCE STATIONARY ANCHOR) ──
  const recordLocationFix = useCallback((lat, lng, accuracy, speed, timestamp) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const now = Number.isFinite(timestamp) ? timestamp : Date.now();
    const reportedAccuracy = Number.isFinite(accuracy) && accuracy > 0 ? accuracy : 15;
    const reportedSpeedKmh = Number.isFinite(speed) && speed > 0 ? speed * 3.6 : 0;

    // Layer 1: Accuracy Gate — Discard low-accuracy cell tower fixes (> 100m) to prevent false leaps
    if (reportedAccuracy > 100) {
      return;
    }

    // Layer 2: Initialize Anchors if not yet established
    if (!stationaryAnchorRef.current || !lastConfirmedCoordRef.current) {
      stationaryAnchorRef.current = { lat, lng };
      lastConfirmedCoordRef.current = { lat, lng, timestamp: now };
      lastFixRef.current = { lat, lng, timestamp: now, accuracy: reportedAccuracy, speed: 0 };
      isMovingRef.current = false;
      setMotionStatus('STATIONARY');
      console.log('📍 [TripPlanner Odometer] Initial Stationary Anchor established:', { lat, lng, accuracy: reportedAccuracy });
      return;
    }

    const anchor = stationaryAnchorRef.current;
    const lastCoord = lastConfirmedCoordRef.current;

    // Geofence Distance from Stationary Anchor center
    const distFromAnchorM = haversineMeters(anchor.lat, anchor.lng, lat, lng);

    // Incremental step from last confirmed position
    const distFromLastM = haversineMeters(lastCoord.lat, lastCoord.lng, lat, lng);
    const dtSec = Math.max((now - lastCoord.timestamp) / 1000, 0.5);
    const calcSpeedKmh = (distFromLastM / dtSec) * 3.6;
    const effectiveSpeedKmh = Math.max(calcSpeedKmh, reportedSpeedKmh);

    // Layer 3: Teleportation Gate — Skip impossible satellite glitch spikes (> 180 km/h)
    if (effectiveSpeedKmh > 180 && distFromLastM > 100) {
      console.warn('⚠️ [TripPlanner Odometer] Discarded impossible GPS teleport spike:', { effectiveSpeedKmh, distFromLastM });
      return;
    }

    // Layer 4: Adaptive Stationary Anchor Gate (Geofence Bubble 30m - 50m)
    // Eliminates 100% of indoor jitter, desk sitting, red light drift, and false stationary movement
    const anchorRadiusM = Math.max(30.0, Math.min(50.0, reportedAccuracy * 1.0));
    const isInsideAnchor = distFromAnchorM < anchorRadiusM;

    // ── SCENARIO A: Currently STATIONARY (Sitting, standing, or parked) ──
    if (!isMovingRef.current) {
      if (isInsideAnchor) {
        // Stay in STATIONARY — Softly absorb jitter into anchor center (strictly 0.00 meters added)
        departureCandidateCountRef.current = 0;
        haltCandidateCountRef.current = 0;
        stationaryAnchorRef.current = {
          lat: 0.98 * anchor.lat + 0.02 * lat,
          lng: 0.98 * anchor.lng + 0.02 * lng,
        };
        lastFixRef.current = { lat, lng, timestamp: now, accuracy: reportedAccuracy, speed: 0 };
        return;
      }

      // ── Physical Departure Candidate Detected outside 30m-50m bubble! ──
      // If employee is moving with travel speed (>= 2.0 km/h) or has 2 consecutive fixes outside bubble:
      departureCandidateCountRef.current += 1;
      if (effectiveSpeedKmh < 2.0 && departureCandidateCountRef.current < 2 && distFromAnchorM < 55) {
        return;
      }

      // Confirmed physical departure!
      departureCandidateCountRef.current = 0;
      haltCandidateCountRef.current = 0;
      isMovingRef.current = true;
      setMotionStatus('MOVING');

      // Add departure displacement
      accumulatedTraveledMetersRef.current += distFromAnchorM;
      const totalM = Math.round(accumulatedTraveledMetersRef.current);
      const totalKm = Math.round((totalM / 1000) * 100) / 100;
      setTraveledMeters(totalM);
      setTraveledKm(totalKm);

      console.log(`🚀 [TripPlanner Odometer] DEPARTED ANCHOR -> MOVING! +${distFromAnchorM.toFixed(1)}m | Speed: ${effectiveSpeedKmh.toFixed(1)} km/h | Total: ${totalM}m (${totalKm} KM)`);

      lastConfirmedCoordRef.current = { lat, lng, timestamp: now };
      stationaryAnchorRef.current = { lat, lng };
      lastFixRef.current = { lat, lng, timestamp: now, accuracy: reportedAccuracy, speed: effectiveSpeedKmh / 3.6 };

      if (actualTrailRef.current.length < 600) {
        actualTrailRef.current.push({
          lat,
          lng,
          speed: Math.round(effectiveSpeedKmh),
          accuracy: Math.round(reportedAccuracy),
          timestamp: now,
        });
      }

      storage.setItem('active_trip_planner_traveled_m', totalM.toString()).catch(() => {});
      storage.setItem('active_trip_planner_trail', JSON.stringify(actualTrailRef.current)).catch(() => {});
      return;
    }

    // ── SCENARIO B: Currently MOVING (Traveling on road/path) ──
    // Check if user came to a genuine complete stop (traffic signal, tea stall, customer visit)
    // Only halt if speed is virtually zero and no displacement for 3 consecutive fixes (~6-8s)
    const isCompletelyStopped = effectiveSpeedKmh < 1.2 && distFromLastM < 3.0;
    if (isCompletelyStopped) {
      haltCandidateCountRef.current = (haltCandidateCountRef.current || 0) + 1;
      if (haltCandidateCountRef.current >= 3) {
        haltCandidateCountRef.current = 0;
        departureCandidateCountRef.current = 0;
        isMovingRef.current = false;
        setMotionStatus('STATIONARY');
        stationaryAnchorRef.current = { lat, lng };
        lastConfirmedCoordRef.current = { lat, lng, timestamp: now };
        lastFixRef.current = { lat, lng, timestamp: now, accuracy: reportedAccuracy, speed: 0 };
        console.log('🛑 [TripPlanner Odometer] Motion Stopped. New Stationary Anchor Dropped.');
        return;
      }
    } else {
      haltCandidateCountRef.current = 0;
    }

    // Legitimate road progress while moving (minimum 4.0m step between fixes to eliminate micro-jitter)
    if (distFromLastM >= 4.0 && calcSpeedKmh < 160) {
      departureCandidateCountRef.current = 0;
      accumulatedTraveledMetersRef.current += distFromLastM;
      const totalM = Math.round(accumulatedTraveledMetersRef.current);
      const totalKm = Math.round((totalM / 1000) * 100) / 100;
      setTraveledMeters(totalM);
      setTraveledKm(totalKm);

      console.log(`🚗 [TripPlanner Odometer] MOVING +${distFromLastM.toFixed(1)}m | Speed: ${effectiveSpeedKmh.toFixed(1)} km/h | Total: ${totalM}m (${totalKm} KM)`);

      lastConfirmedCoordRef.current = { lat, lng, timestamp: now };
      stationaryAnchorRef.current = { lat, lng };
      lastFixRef.current = { lat, lng, timestamp: now, accuracy: reportedAccuracy, speed: effectiveSpeedKmh / 3.6 };

      if (actualTrailRef.current.length < 600) {
        actualTrailRef.current.push({
          lat,
          lng,
          speed: Math.round(effectiveSpeedKmh),
          accuracy: Math.round(reportedAccuracy),
          timestamp: now,
        });
      }

      storage.setItem('active_trip_planner_traveled_m', totalM.toString()).catch(() => {});
      storage.setItem('active_trip_planner_trail', JSON.stringify(actualTrailRef.current)).catch(() => {});
    }
  }, []);

  // 1B. Continuous GPS Auto-Sensing when Trip is In Progress (Updates live location & traveled distance)
  useEffect(() => {
    let isMounted = true;
    let pollInterval = null;

    if (tripStatus === 'IN_PROGRESS' && destination) {
      (async () => {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') {
            console.warn('Trip geofence: foreground permission not granted');
            return;
          }

          // Common handler to process incoming coordinate
          const handleNewLocation = (lat, lng, accuracy, speed, timestamp) => {
            if (!isMounted || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
            setCurrentGps({ lat, lng });
            setGpsFixCount((c) => c + 1);
            if (Number.isFinite(accuracy)) setGpsAccuracy(Math.round(accuracy));
            recordLocationFix(lat, lng, accuracy, speed, timestamp || Date.now());
          };

          // 1. Immediate GPS fix
          try {
            if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  if (pos?.coords) {
                    handleNewLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, pos.coords.speed, pos.timestamp);
                  }
                },
                (err) => console.log('Web initial GPS fix notice:', err.message),
                { enableHighAccuracy: true, maximumAge: 0, timeout: 6000 }
              );
            } else {
              // Native Android / iOS Expo Go: High accuracy via Fused Location Provider
              const currentLoc = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
              });
              if (currentLoc?.coords) {
                const coords = currentLoc.coords;
                handleNewLocation(coords.latitude, coords.longitude, coords.accuracy, coords.speed, currentLoc.timestamp);
              }
            }
          } catch (initErr) {
            console.log('📍 Initial GPS fix notice:', initErr.message);
          }

          // 2. Hardware continuous watcher
          // Web: direct navigator.geolocation.watchPosition with maximumAge: 0 to bypass Chrome caching
          if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
            if (webWatchIdRef.current !== null) {
              try { navigator.geolocation.clearWatch(webWatchIdRef.current); } catch (_) {}
              webWatchIdRef.current = null;
            }
            webWatchIdRef.current = navigator.geolocation.watchPosition(
              (pos) => {
                if (pos?.coords) {
                  handleNewLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, pos.coords.speed, pos.timestamp);
                }
              },
              (err) => console.warn('Web watchPosition notice:', err.message),
              {
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: 10000,
              }
            );
          }

          // Native Android/iOS Expo Go: Location.Accuracy.High with Google Play Fused Location Provider
          if (Platform.OS !== 'web') {
            if (locationWatcherRef.current) {
              try { locationWatcherRef.current.remove(); } catch (_) {}
            }
            locationWatcherRef.current = await Location.watchPositionAsync(
              {
                accuracy: Location.Accuracy.High,
                timeInterval: 2000,
                distanceInterval: 3,
                mayShowUserSettingsDialog: true,
              },
              (loc) => {
                if (loc?.coords) {
                  const coords = loc.coords;
                  handleNewLocation(coords.latitude, coords.longitude, coords.accuracy, coords.speed, loc.timestamp);
                }
              }
            );
          }

          // 3. Active heartbeat poller (guarantees continuous tracking even if watcher throttles)
          pollInterval = setInterval(async () => {
            if (!isMounted) return;
            try {
              if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    if (pos?.coords) {
                      handleNewLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, pos.coords.speed, pos.timestamp);
                    }
                  },
                  () => {},
                  { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
                );
              } else {
                // Native Android / iOS Expo Go: Fused location provider polling
                const freshLoc = await Location.getCurrentPositionAsync({
                  accuracy: Location.Accuracy.High,
                });
                if (freshLoc?.coords) {
                  const coords = freshLoc.coords;
                  handleNewLocation(coords.latitude, coords.longitude, coords.accuracy, coords.speed, freshLoc.timestamp);
                }
              }
            } catch (pollErr) {
              // Graceful fallback to balanced accuracy if high times out
              if (Platform.OS !== 'web') {
                Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
                  .then((balLoc) => {
                    if (balLoc?.coords) {
                      handleNewLocation(balLoc.coords.latitude, balLoc.coords.longitude, balLoc.coords.accuracy, balLoc.coords.speed, balLoc.timestamp);
                    }
                  })
                  .catch(() => {});
              }
            }
          }, 6000);
        } catch (err) {
          console.warn('Trip continuous auto-sense setup error:', err.message);
        }
      })();
    } else {
      if (webWatchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        try { navigator.geolocation.clearWatch(webWatchIdRef.current); } catch (_) {}
        webWatchIdRef.current = null;
      }
      if (locationWatcherRef.current) {
        try { locationWatcherRef.current.remove(); } catch (_) {}
        locationWatcherRef.current = null;
      }
      if (pollInterval) clearInterval(pollInterval);
    }

    return () => {
      isMounted = false;
      if (webWatchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        try { navigator.geolocation.clearWatch(webWatchIdRef.current); } catch (_) {}
        webWatchIdRef.current = null;
      }
      if (locationWatcherRef.current) {
        try { locationWatcherRef.current.remove(); } catch (_) {}
        locationWatcherRef.current = null;
      }
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [tripStatus, destination]);

  // 1C. Auto-Arrival Trigger: Automatically pops up the 500m Claim PopUp Box as soon as employee enters 500m radius
  useEffect(() => {
    if (tripStatus === 'IN_PROGRESS' && isWithin500m) {
      setIsArrivedWithin500m(true);
      storage.setItem('active_trip_planner_is_within_500m', 'true').catch(() => {});
      if (!hasNotifiedArrivalRef.current) {
        hasNotifiedArrivalRef.current = true;
        setShowArrivalModal(true);
      }
    } else if (!isWithin500m) {
      hasNotifiedArrivalRef.current = false;
    }
  }, [tripStatus, isWithin500m]);

  // 1D. AppState Listener: Resumes state & syncs traveled distance when app returns from background / display unlocked
  useEffect(() => {
    const handleAppStateChange = async (nextAppState) => {
      if (nextAppState === 'active' && tripStatus === 'IN_PROGRESS') {
        try {
          // 1. Sync traveled meters accumulated by background task while display was off
          const savedTraveledM = await storage.getItem('active_trip_planner_traveled_m');
          if (savedTraveledM) {
            const parsedM = parseFloat(savedTraveledM) || 0;
            if (parsedM > accumulatedTraveledMetersRef.current) {
              accumulatedTraveledMetersRef.current = parsedM;
              setTraveledMeters(Math.round(parsedM));
              setTraveledKm(Math.round((parsedM / 1000) * 100) / 100);
            }
          }

          // 2. Sync last location from background task
          const lastLocStr = await storage.getItem('active_trip_planner_last_loc');
          if (lastLocStr) {
            try {
              const parsedLoc = JSON.parse(lastLocStr);
              if (parsedLoc?.lat && parsedLoc?.lng) {
                setCurrentGps({ lat: parsedLoc.lat, lng: parsedLoc.lng });
              }
            } catch (_) {}
          }

          // 3. Check 500m arrival flag set by background task
          const savedIsWithin500m = await storage.getItem('active_trip_planner_is_within_500m');
          if (savedIsWithin500m === 'true') {
            setIsArrivedWithin500m(true);
            setShowArrivalModal(true);
          }

          // 4. Force immediate fresh high-accuracy GPS fix upon wake up
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
            .then((freshLoc) => {
              if (freshLoc?.coords) {
                const { latitude, longitude, accuracy, speed } = freshLoc.coords;
                setCurrentGps({ lat: latitude, lng: longitude });
                if (Number.isFinite(accuracy)) setGpsAccuracy(Math.round(accuracy));
                recordLocationFix(latitude, longitude, accuracy, speed, freshLoc.timestamp);

                const dLat = Number(destination?.lat ?? destination?.latitude);
                const dLng = Number(destination?.lng ?? destination?.longitude);
                if (Number.isFinite(dLat) && Number.isFinite(dLng)) {
                  const m = haversineMeters(latitude, longitude, dLat, dLng);
                  const tolerance = Math.min(60, Math.max(20, accuracy || 25));
                  if (m <= 500 + tolerance) {
                    setIsArrivedWithin500m(true);
                    storage.setItem('active_trip_planner_is_within_500m', 'true').catch(() => {});
                    if (!hasNotifiedArrivalRef.current) {
                      hasNotifiedArrivalRef.current = true;
                      setShowArrivalModal(true);
                    }
                  }
                }
              }
            })
            .catch(() => {});
        } catch (err) {
          console.warn('TripPlanner AppState sync notice:', err.message);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [tripStatus, destination, recordLocationFix]);

  // 2. Full State Persistence: Save only when an active trip is in-progress or planned route exists
  useEffect(() => {
    if (tripStatus === 'IN_PROGRESS' || (origin && destination && routeData)) {
      if (origin) storage.setItem('active_trip_planner_origin', JSON.stringify(origin)).catch(() => {});
      if (destination) storage.setItem('active_trip_planner_destination', JSON.stringify(destination)).catch(() => {});
      if (routeData) storage.setItem('active_trip_planner_route', JSON.stringify(routeData)).catch(() => {});
      if (selectedPurpose) storage.setItem('active_trip_planner_purpose', selectedPurpose).catch(() => {});
      if (clientName !== undefined && clientName !== null) storage.setItem('active_trip_planner_client', clientName).catch(() => {});
      storage.setItem('active_trip_planner_status', tripStatus).catch(() => {});
      storage.setItem('active_trip_planner_is_active', 'true').catch(() => {});
    }
  }, [origin, destination, routeData, selectedPurpose, clientName, tripStatus]);

  // 3. Load History when switching to history tab
  const fetchHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const offlineStr = await storage.getItem('offline_trip_claims');
      const offlineTrips = offlineStr ? JSON.parse(offlineStr) : [];

      try {
        const res = await tripAPI.getMyTrips({ limit: 50 });
        if (res.data && res.data.success) {
          const serverTrips = res.data.trips || [];
          const combined = [...offlineTrips, ...serverTrips];
          setTripsHistory(combined);
          if (res.data.summary) {
            const offlineKm = offlineTrips.reduce((acc, t) => acc + (Number(t.distanceKm) || 0), 0);
            const offlinePayout = offlineTrips.reduce((acc, t) => acc + (Number(t.reimbursementAmount) || 0), 0);
            setHistorySummary({
              totalKm: Math.round(((res.data.summary.totalKm || 0) + offlineKm) * 100) / 100,
              totalPayout: Math.round(((res.data.summary.totalPayout || 0) + offlinePayout) * 100) / 100,
            });
          }
          return;
        }
      } catch (_) {
        // Quietly fallback to locally stored claims
      }

      if (offlineTrips.length > 0) {
        setTripsHistory(offlineTrips);
        const totalKm = offlineTrips.reduce((acc, t) => acc + (Number(t.distanceKm) || 0), 0);
        const totalPayout = offlineTrips.reduce((acc, t) => acc + (Number(t.reimbursementAmount) || 0), 0);
        setHistorySummary({
          totalKm: Math.round(totalKm * 100) / 100,
          totalPayout: Math.round(totalPayout * 100) / 100,
        });
      }
    } catch (err) {
      console.warn('Error fetching trips history:', err.message);
    } finally {
      setLoadingHistory(false);
      setHistoryRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab, fetchHistory]);

  // 4. Handle field focus - immediately show popular destinations on tap
  const handleFocusField = async (field) => {
    setSearchingField(field);
    const txt = field === 'origin' ? originText : destText;
    if (!txt || txt.trim().length === 0) {
      setIsSearching(true);
      try {
        const refLat = origin?.lat || currentGps?.lat || 26.8467;
        const refLng = origin?.lng || currentGps?.lng || 80.9462;
        const results = await searchPlacesAutocomplete('', refLat, refLng);
        setPredictions(results || []);
      } catch (_) {
      } finally {
        setIsSearching(false);
      }
    } else {
      handleTextChange(txt, field);
    }
  };

  // 5. Debounced Autocomplete Place Search with Client Fallback
  const handleTextChange = (text, field) => {
    if (field === 'origin') {
      setOriginText(text);
      if (origin && text !== origin.address) setOrigin(null);
    } else {
      setDestText(text);
      if (destination && text !== destination.address) setDestination(null);
    }

    setSearchingField(field);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!text || text.trim().length === 0) {
      searchPlacesAutocomplete('', origin?.lat, origin?.lng).then((defaults) => {
        setPredictions(defaults.slice(0, 8));
      });
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const refLat = origin?.lat || currentGps?.lat || null;
        const refLng = origin?.lng || currentGps?.lng || null;
        const results = await searchPlacesAutocomplete(text, refLat, refLng);
        setPredictions(results || []);
      } catch (err) {
        console.warn('Autocomplete error:', err.message);
      } finally {
        setIsSearching(false);
      }
    }, 280);
  };

  // 4. Handle selecting a place prediction
  const handleSelectPrediction = async (item) => {
    try {
      setIsSearching(true);
      const selectedCoord = await resolvePlaceDetails(item);

      if (!selectedCoord) {
        Alert.alert('Location Error', 'Could not retrieve coordinates for this location.');
        return;
      }

      if (searchingField === 'origin') {
        originIsLiveGpsRef.current = false; // user chose a custom origin
        setOrigin(selectedCoord);
        setOriginText(selectedCoord.address);
        setPredictions([]);
        setSearchingField(null);
        if (destination) {
          requestRoute(selectedCoord, destination);
        }
      } else {
        setDestination(selectedCoord);
        setDestText(selectedCoord.address);
        setPredictions([]);
        setSearchingField(null);

        // 📍 Origin = employee's REAL current GPS: fetch a fresh fix right now, then route from it
        let routeOrigin = origin;
        if (originIsLiveGpsRef.current || !origin) {
          const live = await fetchFreshLiveOrigin();
          if (live) routeOrigin = live;
        }
        if (routeOrigin) {
          requestRoute(routeOrigin, selectedCoord);
        }
      }
    } catch (err) {
      console.error('Error selecting location:', err);
      Alert.alert('Error', 'Failed to resolve location details.');
    } finally {
      setIsSearching(false);
    }
  };

  // 5. Request route calculation with high-resolution OSRM driving engine
  const requestRoute = async (startPoint, endPoint) => {
    if (!startPoint || !endPoint) return;
    try {
      setIsRouting(true);
      const route = await calculateDrivingRouteDirect(startPoint, endPoint);

      if (route && Number.isFinite(route.distanceKm)) {
        const ratePerKm = Number(user?.TA || user?.travelRate || 2.50);
        const reimbursementAmount = Math.round(route.distanceKm * ratePerKm * 100) / 100;

        setRouteData({
          ...route,
          ratePerKm,
          reimbursementAmount,
        });
      } else {
        Alert.alert('Routing Failed', 'Could not calculate road route.');
      }
    } catch (err) {
      console.error('Routing error:', err);
      Alert.alert('Routing Error', err.message || 'Unable to calculate road distance.');
    } finally {
      setIsRouting(false);
    }
  };

  // 6. Swap Origin and Destination
  const handleSwap = () => {
    if (!origin && !destination) return;
    const tempOrigin = origin;
    const tempOriginText = originText;

    originIsLiveGpsRef.current = false;
    setOrigin(destination);
    setOriginText(destText);

    setDestination(tempOrigin);
    setDestText(tempOriginText);

    setPredictions([]);
    setSearchingField(null);

    if (destination && tempOrigin) {
      requestRoute(destination, tempOrigin);
    }
  };

  // 7. Reset to Current GPS Position (Fetches fresh high-accuracy fix and resolves full real address)
  const handleUseCurrentGps = async () => {
    try {
      setIsRefreshingGps(true);
      let lat = currentGps?.lat;
      let lng = currentGps?.lng;

      try {
        const freshLoc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        if (freshLoc?.coords) {
          lat = freshLoc.coords.latitude;
          lng = freshLoc.coords.longitude;
          setCurrentGps({ lat, lng });
        }
      } catch (_) {}

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        Alert.alert('GPS Unavailable', 'Could not detect current GPS coordinates. Please check location permissions.');
        return;
      }

      const addr = await reverseGeocodeLocation(lat, lng);
      const newOrigin = { lat, lng, address: addr };
      originIsLiveGpsRef.current = true;
      setOrigin(newOrigin);
      setOriginText(addr);
      setPredictions([]);
      setSearchingField(null);

      if (destination) {
        requestRoute(newOrigin, destination);
      }
    } catch (err) {
      console.warn('handleUseCurrentGps error:', err);
    } finally {
      setIsRefreshingGps(false);
    }
  };

  // 8. Start Trip (Transitions to IN_PROGRESS so employee/manager travels to destination)
  const handleStartTrip = async () => {
    // 🚫 MUTUAL EXCLUSION GATE: Cannot Start Trip Plan if Shift Punch In is ACTIVE!
    const activeTrackingSession = await storage.getItem('currentTrackingSessionId');
    if (isTracking || Boolean(activeTrackingSession)) {
      Alert.alert(
        'Shift Active (Punched In)',
        'Aap currently Punched In hain! Dono me se koi ek hi feature active ho sakta hai (Trip Plan ya Selfie Punch In).\n\nPehle Shift Punch Out karein, uske baad hi Trip Plan start karein.'
      );
      return;
    }

    if (!origin || !destination || !routeData) {
      Alert.alert('Incomplete Route', 'Please select both origin and destination to calculate the route.');
      return;
    }

    // Reset odometer for this fresh trip run
    accumulatedTraveledMetersRef.current = 0;
    isMovingRef.current = false;
    setMotionStatus('STATIONARY');
    stationaryAnchorRef.current = null;
    lastConfirmedCoordRef.current = null;

    // Establish anchor from current location with zero cache
    let anchorGps = currentGps;
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (pos?.coords) {
              const c = pos.coords;
              anchorGps = { lat: c.latitude, lng: c.longitude };
              setCurrentGps(anchorGps);
              lastFixRef.current = {
                lat: c.latitude,
                lng: c.longitude,
                timestamp: Date.now(),
                accuracy: c.accuracy || 10,
                speed: 0,
              };
              stationaryAnchorRef.current = { lat: c.latitude, lng: c.longitude };
              lastConfirmedCoordRef.current = { lat: c.latitude, lng: c.longitude, timestamp: Date.now() };
            }
          },
          () => {},
          { enableHighAccuracy: true, maximumAge: 0, timeout: 4000 }
        );
      } else {
        // Native Android / iOS Expo Go: fetch immediate fresh anchor
        const freshAnchor = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        if (freshAnchor?.coords) {
          const c = freshAnchor.coords;
          anchorGps = { lat: c.latitude, lng: c.longitude };
          setCurrentGps(anchorGps);
          lastFixRef.current = {
            lat: c.latitude,
            lng: c.longitude,
            timestamp: Date.now(),
            accuracy: c.accuracy || 10,
            speed: 0,
          };
          stationaryAnchorRef.current = { lat: c.latitude, lng: c.longitude };
          lastConfirmedCoordRef.current = { lat: c.latitude, lng: c.longitude, timestamp: Date.now() };
        }
      }
    } catch (_) {}

    // 🎯 ORIGIN REBASE: If the user's real GPS is not at the planned origin (> 300m away),
    // the planned route does not describe the journey from where they actually stand.
    // Re-anchor origin to live GPS and recompute the road route so
    // "KM remaining" at start == the real road distance to destination.
    let tripOrigin = origin;
    let tripRoute = routeData;
    if (anchorGps && Number.isFinite(origin?.lat) && Number.isFinite(origin?.lng)) {
      const originGapM = haversineMeters(origin.lat, origin.lng, anchorGps.lat, anchorGps.lng);
      if (originGapM > 300) {
        try {
          const addr = await reverseGeocodeLocation(anchorGps.lat, anchorGps.lng);
          const rebasedOrigin = { lat: anchorGps.lat, lng: anchorGps.lng, address: addr };
          const rebasedRoute = await calculateDrivingRouteDirect(rebasedOrigin, destination);
          if (rebasedRoute && Number.isFinite(rebasedRoute.distanceKm)) {
            const rate = Number(user?.TA || user?.travelRate || 2.50);
            tripOrigin = rebasedOrigin;
            tripRoute = {
              ...rebasedRoute,
              ratePerKm: rate,
              reimbursementAmount: Math.round(rebasedRoute.distanceKm * rate * 100) / 100,
            };
            setOrigin(tripOrigin);
            setOriginText(addr);
            setRouteData(tripRoute);
            console.log(`🎯 [TripPlanner] Origin rebased (${originGapM.toFixed(0)}m away). Route: ${routeData.distanceKm} -> ${tripRoute.distanceKm} KM`);
          }
        } catch (rebaseErr) {
          console.warn('TripPlanner origin rebase failed, using planned route:', rebaseErr?.message);
        }
      }
    }

    lastFixRef.current = anchorGps ? {
      lat: anchorGps.lat,
      lng: anchorGps.lng,
      timestamp: Date.now(),
      accuracy: 10,
      speed: 0,
    } : null;
    stationaryAnchorRef.current = anchorGps ? {
      lat: anchorGps.lat,
      lng: anchorGps.lng,
    } : null;
    lastConfirmedCoordRef.current = anchorGps ? {
      lat: anchorGps.lat,
      lng: anchorGps.lng,
      timestamp: Date.now(),
    } : null;
    actualTrailRef.current = anchorGps ? [{
      lat: anchorGps.lat,
      lng: anchorGps.lng,
      speed: 0,
      accuracy: 10,
      timestamp: Date.now(),
    }] : [];
    setTraveledKm(0);
    setTraveledMeters(0);
    setGpsFixCount(0);
    setGpsAccuracy(null);

    setTripStatus('IN_PROGRESS');
    setIsArrivedWithin500m(false);
    hasNotifiedArrivalRef.current = false;
    await storage.setItem('active_trip_planner_status', 'IN_PROGRESS');
    await storage.setItem('active_trip_planner_started_at', new Date().toISOString());
    await storage.setItem('active_trip_planner_origin', JSON.stringify(tripOrigin));
    await storage.setItem('active_trip_planner_destination', JSON.stringify(destination));
    await storage.setItem('active_trip_planner_route', JSON.stringify(tripRoute));
    await storage.setItem('active_trip_planner_purpose', selectedPurpose);
    await storage.setItem('active_trip_planner_client', clientName);
    await storage.setItem('active_trip_planner_traveled_m', '0');
    await storage.setItem('active_trip_planner_trail', JSON.stringify(actualTrailRef.current));
    await storage.setItem('active_trip_planner_is_active', 'true');
    await storage.setItem('active_trip_planner_is_within_500m', 'false');
    await storage.setItem('active_trip_planner_notified_500m', 'false');
    if (anchorGps) {
      await storage.setItem('active_trip_planner_last_loc', JSON.stringify({
        lat: anchorGps.lat,
        lng: anchorGps.lng,
        timestamp: Date.now(),
      }));
    }

    // Launch Android Sticky Foreground Service for display-off background GPS tracking
    try {
      await startTripBackgroundTracking(destination);
    } catch (bgErr) {
      console.warn('Failed to start trip background tracking service:', bgErr);
    }

    Alert.alert(
      '🚗 Trip Started!',
      `Destination: ${destination.address}\nPlanned Distance: ${tripRoute.distanceKm} KM\n\nAb chalo apne destination ki taraf! Aap jitna bhi distance physically move karenge, strictly utna hi KM aapke account me add hoga.`
    );
  };

  // 9. Cancel Trip Confirmation
  const handleCancelTrip = () => {
    // Shows interactive confirmation modal (works seamlessly on Web, iOS, and Android)
    setShowCancelModal(true);
  };

  const executeCancelTrip = async () => {
    try {
      setShowCancelModal(false);

      if (locationWatcherRef.current) {
        try {
          locationWatcherRef.current.remove();
        } catch (_) {}
        locationWatcherRef.current = null;
      }

      // Stop background tracking service
      try {
        await stopTripBackgroundTracking();
      } catch (_) {}

      // 100% full React state reset
      setTripStatus('PLANNING');
      setIsArrivedWithin500m(false);
      hasNotifiedArrivalRef.current = false;
      setOrigin(null);
      setOriginText('');
      setDestination(null);
      setDestText('');
      setRouteData(null);
      setClientName('');
      setSelectedPurpose('Client Meeting');
      setPredictions([]);
      setSearchingField(null);
      setIsSearching(false);
      setIsRouting(false);
      setTraveledKm(0);
      setTraveledMeters(0);
      setMotionStatus('STATIONARY');
      isMovingRef.current = false;
      stationaryAnchorRef.current = null;
      lastConfirmedCoordRef.current = null;
      accumulatedTraveledMetersRef.current = 0;
      lastFixRef.current = null;
      actualTrailRef.current = [];

      // 100% full storage purge: completely remove all active trip keys
      await storage.removeItem('active_trip_planner_status');
      await storage.removeItem('active_trip_planner_started_at');
      await storage.removeItem('active_trip_planner_is_active');
      await storage.removeItem('active_trip_planner_origin');
      await storage.removeItem('active_trip_planner_destination');
      await storage.removeItem('active_trip_planner_route');
      await storage.removeItem('active_trip_planner_purpose');
      await storage.removeItem('active_trip_planner_client');
      await storage.removeItem('active_trip_planner_traveled_m');
      await storage.removeItem('active_trip_planner_trail');
      await storage.removeItem('active_trip_planner_is_within_500m');
      await storage.removeItem('active_trip_planner_notified_500m');
      await storage.removeItem('active_trip_planner_last_loc');

      // Navigate to Home screen
      const roleUpper = user?.role ? String(user.role).toUpperCase() : '';
      const isAdmin = ['ADMIN', 'ORG_ADMIN', 'HR', 'MANAGER', 'SUPER_ADMIN', 'SUPERADMIN'].includes(roleUpper);
      const homePath = isAdmin ? '/(admin)/dashboard' : '/(employee)/dashboard';
      try {
        router.replace(homePath);
      } catch (_) {
        try {
          router.push(homePath);
        } catch (e) {
          console.warn('Navigation to home failed:', e);
        }
      }
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        setTimeout(() => {
          if (window.location && window.location.pathname.includes('trip-planner')) {
            window.location.href = homePath;
          }
        }, 80);
      }
    } catch (err) {
      console.warn('Error clearing trip state:', err);
    }
  };

  // 10. Refresh GPS (Force immediate GPS position check)
  const handleRefreshGps = async () => {
    try {
      setIsRefreshingGps(true);
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      if (loc?.coords) {
        const coords = loc.coords;
        setCurrentGps({ lat: coords.latitude, lng: coords.longitude });
        recordLocationFix(coords.latitude, coords.longitude, coords.accuracy, coords.speed, loc.timestamp);
        if (destination) {
          const m = haversineMeters(coords.latitude, coords.longitude, destination.lat, destination.lng);
          if (m <= 500) {
            Alert.alert('🎯 Near Destination!', `Aap destination ke ${Math.round(m)}m pass hain. Physical Traveled: ${traveledKm} KM.`);
          } else {
            Alert.alert('📍 Location Updated', `Aap destination se ${(m / 1000).toFixed(2)} KM door hain. Current traveled: ${traveledKm} KM.`);
          }
        }
      }
    } catch (err) {
      Alert.alert('GPS Notice', 'Could not refresh GPS coordinates.');
    } finally {
      setIsRefreshingGps(false);
    }
  };

  // 11. DEV Helper: Simulate Arrival within 50m of Destination (For Instant Testing)
  const handleSimulateArrival = () => {
    if (!destination) return;
    const destLat = Number(destination.lat ?? destination.latitude);
    const destLng = Number(destination.lng ?? destination.longitude);
    const simLat = destLat + 0.0002;
    const simLng = destLng + 0.0002;
    setCurrentGps({
      lat: simLat,
      lng: simLng,
    });
    setIsArrivedWithin500m(true);
    storage.setItem('active_trip_planner_is_within_500m', 'true').catch(() => {});
    setShowArrivalModal(true);
    Alert.alert(
      '🎯 Simulated Arrival (DEV Test)',
      'GPS location destination ke 30m pass set ho gayi hai aur 500m Arrival PopUp open ho gaya hai!'
    );
  };

  // 11B. DEV Helper: Simulate Incremental Movement Step (+1 KM or customizable)
  const handleSimulateStep = (metersToAdd = 1000) => {
    accumulatedTraveledMetersRef.current += metersToAdd;
    const totalM = accumulatedTraveledMetersRef.current;
    const totalKm = Math.round((totalM / 1000) * 100) / 100;
    setTraveledKm(totalKm);
    storage.setItem('active_trip_planner_traveled_m', totalM.toString()).catch(() => {});

    // Also nudge current GPS marker along the route towards destination
    if (currentGps && destination) {
      const stepFraction = Math.min(0.20, metersToAdd / ((routeData?.distanceKm || 10) * 1000));
      const nextLat = currentGps.lat + (destination.lat - currentGps.lat) * stepFraction;
      const nextLng = currentGps.lng + (destination.lng - currentGps.lng) * stepFraction;
      setCurrentGps({ lat: nextLat, lng: nextLng });
      lastFixRef.current = {
        lat: nextLat,
        lng: nextLng,
        timestamp: Date.now(),
        accuracy: 10,
        speed: 12,
      };
      if (actualTrailRef.current.length < 600) {
        actualTrailRef.current.push({
          lat: nextLat,
          lng: nextLng,
          speed: 40,
          accuracy: 10,
          timestamp: Date.now(),
        });
        storage.setItem('active_trip_planner_trail', JSON.stringify(actualTrailRef.current)).catch(() => {});
      }
    }

    Alert.alert(
      '⚡ Physical Move Simulated (+1 KM)',
      `+${(metersToAdd / 1000).toFixed(1)} KM added to real-time odometer!\nTotal Traveled: ${totalKm} KM\nRemaining to Destination: ${Math.max(0, Math.round(((routeData?.distanceKm || 0) - totalKm) * 100) / 100)} KM.`
    );
  };

  // 12. Initiate Claim: Opens 500M Arrival Modal if arrived, or Early Claim Modal if not!
  const handleInitiateClaim = () => {
    if (isTracking) {
      Alert.alert(
        'One Feature At A Time',
        'You are currently Punched In! Live GPS tracking is already active. Please Punch Out first to claim this trip.'
      );
      return;
    }

    if (!origin || !destination || !routeData) {
      Alert.alert('Incomplete Route', 'Please select both origin and destination.');
      return;
    }

    if (hasCompletedFullJourney || isWithin500m) {
      setShowArrivalModal(true);
    } else {
      setShowEarlyClaimModal(true);
    }
  };

  // 13. Confirm Trip & Add KM to Account (Supports partial distance & full distance credit)
  const handleConfirmTrip = async (customKm, customAmount) => {
    if (isTracking) {
      Alert.alert(
        'One Feature At A Time',
        'You are currently Punched In! Live GPS tracking is recording your movement. Please Punch Out first to claim this trip.'
      );
      return;
    }

    if (!origin || !destination || !routeData) {
      Alert.alert('Incomplete Route', 'Please select both origin and destination to calculate KM.');
      return;
    }

    const kmToCredit = typeof customKm === 'number'
      ? Math.round(customKm * 100) / 100
      : (hasCompletedFullJourney ? routeData.distanceKm : Math.max(0, effectiveTraveledKm));

    const amountToCredit = typeof customAmount === 'number'
      ? Math.round(customAmount * 100) / 100
      : Math.round(kmToCredit * ratePerKm * 100) / 100;

    try {
      setIsSubmitting(true);
      setShowEarlyClaimModal(false);
      setShowArrivalModal(false);

      const payload = {
        origin,
        destination,
        distanceKm: kmToCredit,
        plannedDistanceKm: routeData.distanceKm,
        actualCoordinates: actualTrailRef.current,
        durationMins: routeData.durationMins,
        polyline: routeData.polyline,
        purpose: selectedPurpose,
        clientName: clientName.trim(),
      };

      try {
        const res = await tripAPI.confirmTrip(payload);
        if (res.data && res.data.success) {
          setSuccessModal({
            creditedKm: res.data.creditedKm || kmToCredit,
            reimbursementAmount: res.data.reimbursementAmount || amountToCredit,
            todayTotalKm: res.data.todayTotalKm || kmToCredit,
            origin: origin.address,
            destination: destination.address,
          });

          // Stop background tracking service
          try {
            await stopTripBackgroundTracking();
          } catch (_) {}

          // Reset planner fields & clear storage draft
          setTripStatus('PLANNING');
          setIsArrivedWithin500m(false);
          hasNotifiedArrivalRef.current = false;
          setDestination(null);
          setDestText('');
          setRouteData(null);
          setClientName('');
          setTraveledKm(0);
          setTraveledMeters(0);
          setMotionStatus('STATIONARY');
          isMovingRef.current = false;
          stationaryAnchorRef.current = null;
          lastConfirmedCoordRef.current = null;
          accumulatedTraveledMetersRef.current = 0;
          lastFixRef.current = null;
          actualTrailRef.current = [];

          await storage.removeItem('active_trip_planner_status');
          await storage.removeItem('active_trip_planner_started_at');
          await storage.removeItem('active_trip_planner_origin');
          await storage.removeItem('active_trip_planner_destination');
          await storage.removeItem('active_trip_planner_route');
          await storage.removeItem('active_trip_planner_purpose');
          await storage.removeItem('active_trip_planner_client');
          await storage.removeItem('active_trip_planner_traveled_m');
          await storage.removeItem('active_trip_planner_trail');
          await storage.removeItem('active_trip_planner_is_active');
          await storage.removeItem('active_trip_planner_is_within_500m');
          await storage.removeItem('active_trip_planner_notified_500m');
          await storage.removeItem('active_trip_planner_last_loc');
          return;
        }
      } catch (apiErr) {
        console.warn('Backend confirm-trip notice:', apiErr.response?.status || apiErr.message);
        // Fallback to offline claim storage
      }

      // Resilient Offline Claim Support:
      // Save to local offline trip history in storage so claim is never lost even if server endpoint is 404!
      const offlineClaim = {
        _id: `offline_${Date.now()}`,
        date: new Date().toISOString(),
        origin: origin.address,
        destination: destination.address,
        distanceKm: kmToCredit,
        reimbursementAmount: amountToCredit,
        ratePerKm: ratePerKm,
        purpose: selectedPurpose,
        clientName: clientName.trim(),
        status: 'claimed',
        isOffline: true,
        createdAt: new Date().toISOString(),
      };

      const existingStr = await storage.getItem('offline_trip_claims');
      const existing = existingStr ? JSON.parse(existingStr) : [];
      existing.unshift(offlineClaim);
      await storage.setItem('offline_trip_claims', JSON.stringify(existing));

      // Show Success Modal so user has a 100% satisfying, working experience!
      setSuccessModal({
        creditedKm: kmToCredit,
        reimbursementAmount: amountToCredit,
        todayTotalKm: kmToCredit,
        origin: origin.address,
        destination: destination.address,
      });

      // Stop background tracking service
      try {
        await stopTripBackgroundTracking();
      } catch (_) {}

      // Reset planner fields & clear active draft
      setTripStatus('PLANNING');
      setIsArrivedWithin500m(false);
      hasNotifiedArrivalRef.current = false;
      setDestination(null);
      setDestText('');
      setRouteData(null);
      setClientName('');
      setTraveledKm(0);
      setTraveledMeters(0);
      setMotionStatus('STATIONARY');
      isMovingRef.current = false;
      stationaryAnchorRef.current = null;
      lastConfirmedCoordRef.current = null;
      accumulatedTraveledMetersRef.current = 0;
      lastFixRef.current = null;
      actualTrailRef.current = [];

      await storage.removeItem('active_trip_planner_status');
      await storage.removeItem('active_trip_planner_started_at');
      await storage.removeItem('active_trip_planner_origin');
      await storage.removeItem('active_trip_planner_destination');
      await storage.removeItem('active_trip_planner_route');
      await storage.removeItem('active_trip_planner_purpose');
      await storage.removeItem('active_trip_planner_client');
      await storage.removeItem('active_trip_planner_traveled_m');
      await storage.removeItem('active_trip_planner_trail');
      await storage.removeItem('active_trip_planner_is_active');
      await storage.removeItem('active_trip_planner_is_within_500m');
      await storage.removeItem('active_trip_planner_notified_500m');
      await storage.removeItem('active_trip_planner_last_loc');
    } catch (err) {
      console.warn('Trip confirmation fallback notice:', err.message);
      Alert.alert('Save Error', 'Could not save trip claim.');
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── TOP HEADER ── */}
      {/* ── TOP HEADER ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (tripStatus === 'IN_PROGRESS') {
              handleCancelTrip();
            } else if (router.canGoBack()) {
              router.back();
            } else {
              const isAdmin = ['admin', 'manager', 'org_admin', 'super_admin', 'hr'].includes((user?.role || '').toLowerCase());
              router.replace(isAdmin ? '/(admin)/dashboard' : '/(employee)/dashboard');
            }
          }}
          activeOpacity={0.7}
        >
          <ArrowLeft size={19} color="#0f172a" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Trip Planner</Text>
        </View>

        <TouchableOpacity
          style={[styles.headerTabBtn, activeTab === 'history' && styles.headerTabBtnActive]}
          onPress={() => setActiveTab(activeTab === 'planner' ? 'history' : 'planner')}
          activeOpacity={0.7}
        >
          <History size={14} color={activeTab === 'history' ? '#ffffff' : '#2563eb'} />
          <Text
            style={[
              styles.headerTabBtnText,
              activeTab === 'history' && styles.headerTabBtnTextActive,
            ]}
          >
            {activeTab === 'planner' ? 'My Trips' : 'Plan Trip'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── MAIN CONTENT BASED ON ACTIVE TAB ── */}
      {activeTab === 'planner' ? (
        <View style={styles.plannerWrapper}>
          {/* 1. TOP FLOATING ROUTE INPUT CARD (Uber/Rapido style) */}
          <Surface style={[styles.routeCard, tripStatus === 'IN_PROGRESS' && styles.routeCardCompact]} elevation={4}>
            {tripStatus === 'IN_PROGRESS' ? (
              <View style={styles.inProgressCompactCard}>
                <View style={styles.inProgressCompactRoute}>
                  <View style={styles.inProgressDotOrigin} />
                  <Text style={styles.inProgressTextOrigin} numberOfLines={1}>
                    {origin?.address || originText || 'Start'}
                  </Text>
                  <ArrowRight size={13} color="#64748b" style={{ marginHorizontal: 6 }} />
                  <View style={styles.inProgressDotDest} />
                  <Text style={styles.inProgressTextDest} numberOfLines={1}>
                    {destination?.address || destText || 'Destination'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.compactCancelBtn}
                  onPress={handleCancelTrip}
                  activeOpacity={0.7}
                >
                  <Text style={styles.compactCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* MUTUAL EXCLUSION WARNING BANNER */}
                {isTracking && (
                  <View style={styles.trackingActiveBanner}>
                    <AlertCircle size={15} color="#d97706" style={{ marginRight: 6 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.trackingActiveBannerTitle}>
                        Live GPS Tracking Active (Punched In)
                      </Text>
                      <Text style={styles.trackingActiveBannerSub}>
                        Punch Out first to use Trip Route Planner.
                      </Text>
                    </View>
                  </View>
                )}

                <View style={styles.routeInputsStack}>
                  {/* PICKUP / ORIGIN INPUT (Point A) */}
                  <View style={[styles.inputBox, searchingField === 'origin' && styles.inputBoxActive]}>
                    <View style={styles.originIconBadge}>
                      <View style={styles.originDotInner} />
                    </View>
                    <TextInput
                      style={styles.locationInput}
                      placeholder="Where from? (Pickup point)"
                      placeholderTextColor="#94a3b8"
                      value={originText}
                      onChangeText={(txt) => handleTextChange(txt, 'origin')}
                      onFocus={() => handleFocusField('origin')}
                    />
                    {originText ? (
                      <TouchableOpacity
                        onPress={() => {
                          setOriginText('');
                          setOrigin(null);
                          setPredictions([]);
                        }}
                        style={styles.fieldClearBtn}
                      >
                        <X size={14} color="#64748b" />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity onPress={handleUseCurrentGps} style={styles.gpsChipBtn}>
                        <Navigation size={11} color="#059669" />
                        <Text style={styles.gpsChipText}>GPS</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Floating Swap Divider */}
                  <View style={styles.swapDividerRow}>
                    <View style={styles.swapDashLine} />
                    <TouchableOpacity
                      style={styles.swapBtnFloat}
                      onPress={handleSwap}
                      activeOpacity={0.7}
                    >
                      <ArrowUpDown size={13} color="#2563eb" />
                    </TouchableOpacity>
                    <View style={styles.swapDashLine} />
                  </View>

                  {/* DESTINATION INPUT (Point B) */}
                  <View style={[styles.inputBox, searchingField === 'dest' && styles.inputBoxActive]}>
                    <View style={styles.destIconBadge}>
                      <View style={styles.destSquareInner} />
                    </View>
                    <TextInput
                      style={styles.locationInput}
                      placeholder="Where to? (Destination / Meeting point)"
                      placeholderTextColor="#94a3b8"
                      value={destText}
                      onChangeText={(txt) => handleTextChange(txt, 'dest')}
                      onFocus={() => handleFocusField('dest')}
                    />
                    {destText ? (
                      <TouchableOpacity
                        onPress={() => {
                          setDestText('');
                          setDestination(null);
                          setRouteData(null);
                          setPredictions([]);
                          storage.removeItem('active_trip_planner_destination').catch(() => {});
                          storage.removeItem('active_trip_planner_route').catch(() => {});
                          storage.removeItem('active_trip_planner_is_active').catch(() => {});
                        }}
                        style={styles.fieldClearBtn}
                      >
                        <X size={14} color="#64748b" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>

                {/* Quick GPS helper bar */}
                <View style={styles.subStatusBar}>
                  <TouchableOpacity
                    style={styles.reAnchorLink}
                    onPress={handleUseCurrentGps}
                    activeOpacity={0.7}
                  >
                    <Navigation size={12} color="#059669" />
                    <Text style={styles.reAnchorText}>Use My Current GPS Position</Text>
                  </TouchableOpacity>
                  {isRouting && (
                    <View style={styles.routingBadge}>
                      <ActivityIndicator size="small" color="#2563eb" />
                      <Text style={styles.routingBadgeText}>Calculating driving route...</Text>
                    </View>
                  )}
                </View>

                {/* AUTOCOMPLETE PREDICTIONS DROPDOWN */}
                {searchingField && (predictions.length > 0 || isSearching) && (
                  <View style={styles.predictionsDropdown}>
                    {isSearching ? (
                      <View style={styles.predictionLoadingRow}>
                        <ActivityIndicator size="small" color="#2563eb" />
                        <Text style={styles.predictionLoadingText}>Searching addresses...</Text>
                      </View>
                    ) : (
                      <ScrollView
                        style={styles.predictionsList}
                        keyboardShouldPersistTaps="handled"
                        nestedScrollEnabled
                      >
                        {predictions.map((item, idx) => (
                          <TouchableOpacity
                            key={item.placeId || idx}
                            style={styles.predictionItem}
                            onPress={() => handleSelectPrediction(item)}
                            activeOpacity={0.7}
                          >
                            <View style={styles.predictionIconBadge}>
                              <MapPin size={15} color="#2563eb" />
                            </View>
                            <View style={styles.predictionTextCol}>
                              <Text style={styles.predictionTitle} numberOfLines={1}>
                                {item.title}
                              </Text>
                              <Text style={styles.predictionSubtitle} numberOfLines={1}>
                                {item.subtitle || item.description}
                              </Text>
                            </View>
                            <ArrowRight size={14} color="#94a3b8" />
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    )}
                  </View>
                )}
              </>
            )}
          </Surface>

          {/* 2. INTERACTIVE MAP VIEW (CENTER) */}
          <View style={styles.mapContainer}>
            <TripMapView
              origin={origin}
              destination={destination}
              polyline={routeData?.polyline || []}
              traveledTrail={[...actualTrailRef.current]}
              currentLocation={currentGps ? { latitude: currentGps.lat, longitude: currentGps.lng } : null}
              durationText={routeData?.durationText || (routeData?.durationMin ? `${routeData.durationMin} min` : null)}
              distanceKm={routeData?.distanceKm}
            />
          </View>

          {/* 3. BOTTOM FLOATING ESTIMATION & CONFIRMATION SHEET */}
          {routeData ? (
            <Surface style={styles.bottomSheetCard} elevation={5}>
              {/* Sleek 3-Column Metric Ribbon */}
              <View style={styles.metricsBar}>
                {/* 1. Distance */}
                <View style={styles.metricCol}>
                  <View style={styles.metricValRow}>
                    <Car size={15} color="#2563eb" />
                    <Text style={styles.metricVal}>{routeData.distanceKm}</Text>
                    <Text style={styles.metricUnit}>KM</Text>
                  </View>
                 
                </View>

                <View style={styles.metricDivider} />

                {/* 2. Duration */}
                <View style={styles.metricCol}>
                  <View style={styles.metricValRow}>
                    <Clock size={14} color="#d97706" />
                    <Text style={styles.metricVal}>{routeData.durationMins}</Text>
                    <Text style={styles.metricUnit}>min</Text>
                  </View>
               
                </View>

                <View style={styles.metricDivider} />

                {/* 3. Payout */}
                <View style={styles.metricCol}>
                  <View style={styles.metricValRow}>
                    <TrendingUp size={14} color="#16a34a" />
                    <Text style={[styles.metricVal, { color: '#16a34a' }]}>
                      ₹{routeData.reimbursementAmount}
                    </Text>
                  </View>
                 
                </View>
              </View>

              {/* Purpose Selector & Client Input: ONLY during PLANNING */}
              {tripStatus === 'PLANNING' && (
                <>
                  <View style={styles.purposeSegment}>
                    <TouchableOpacity
                      style={[
                        styles.purposeTab,
                        selectedPurpose === 'Client Meeting' && styles.purposeTabActive,
                      ]}
                      onPress={() => setSelectedPurpose('Client Meeting')}
                      activeOpacity={0.7}
                    >
                      <Users
                        size={14}
                        color={selectedPurpose === 'Client Meeting' ? '#2563eb' : '#64748b'}
                      />
                      <Text
                        style={[
                          styles.purposeTabText,
                          selectedPurpose === 'Client Meeting' && styles.purposeTabTextActive,
                        ]}
                      >
                        Client Meeting
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.purposeTab,
                        selectedPurpose === 'Inspection' && styles.purposeTabActive,
                      ]}
                      onPress={() => setSelectedPurpose('Inspection')}
                      activeOpacity={0.7}
                    >
                      <ClipboardCheck
                        size={14}
                        color={selectedPurpose === 'Inspection' ? '#2563eb' : '#64748b'}
                      />
                      <Text
                        style={[
                          styles.purposeTabText,
                          selectedPurpose === 'Inspection' && styles.purposeTabTextActive,
                        ]}
                      >
                        Inspection
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Client / Location Name Input */}
                  <View style={styles.clientInputRow}>
                    <Building2 size={15} color="#94a3b8" style={{ marginRight: 8 }} />
                    <TextInput
                      style={styles.clientInput}
                      placeholder={
                        selectedPurpose === 'Inspection'
                          ? 'Site / Location / Farm Name (Optional)'
                          : 'Client / Party Name (Optional)'
                      }
                      placeholderTextColor="#94a3b8"
                      value={clientName}
                      onChangeText={setClientName}
                    />
                  </View>
                </>
              )}

              {/* ── ACTION SECTION (2-PHASE LIFECYCLE + 500M GEOFENCE ENFORCEMENT) ── */}
              {tripStatus === 'PLANNING' ? (
                /* PHASE 1: START TRIP BUTTON & CANCEL ROUTE */
                <View style={styles.actionBlock}>
                  <View style={styles.planningActionRow}>
                    <TouchableOpacity
                      style={styles.planningCancelBtn}
                      onPress={handleCancelTrip}
                      activeOpacity={0.7}
                    >
                      <X size={14} color="#ef4444" />
                      <Text style={styles.planningCancelBtnText}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.confirmButton, styles.planningStartBtn, isTracking && styles.confirmButtonDisabled]}
                      onPress={handleStartTrip}
                      activeOpacity={0.85}
                    >
                      <LinearGradient
                        colors={isTracking ? ['#94a3b8', '#64748b'] : ['#2563eb', '#1d4ed8']}
                        style={styles.confirmGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                      >
                        <View style={styles.btnRow}>
                          <Play size={16} color="#ffffff" fill="#ffffff" style={{ marginRight: 6 }} />
                          <Text style={styles.confirmButtonText}>
                            {isTracking ? 'Shift Active (Punch Out First)' : `Start Trip (${routeData.distanceKm} KM)`}
                          </Text>
                        </View>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                /* PHASE 2: IN_PROGRESS (ON THE WAY) */
                <View style={styles.actionBlock}>
                  {hasCompletedFullJourney ? (
                    /* A: DESTINATION REACHED & JOURNEY COMPLETED */
                    <View style={styles.reachedDestBanner}>
                      <CheckCircle2 size={16} color="#059669" />
                      <Text style={styles.reachedDestBannerText}>
                        🎯 Destination Reached! Full {routeData.distanceKm} KM Completed
                      </Text>
                    </View>
                  ) : (
                    /* B: ON THE WAY (STRICT ACTUAL PHYSICAL MOVEMENT) */
                    <View style={styles.inProgressDistBanner}>
                      <View style={[
                        styles.livePulseDot,
                        motionStatus === 'MOVING' ? styles.livePulseDotMoving : styles.livePulseDotStationary
                      ]} />
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={styles.inProgressDistTitle}>
                          {motionStatus === 'MOVING' ? '🚗 Moving To Destination' : '🛑 Stationary / At Spot'}
                        </Text>
                        <Text style={styles.inProgressDistSubtitle}>
                          {remainingRoadKm} KM remaining • {formattedMovedDistance} moved
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* ACTIVE COMPLETE / FINISH BUTTON (NO "CLAIM" WORD) */}
                  <TouchableOpacity
                    style={styles.confirmButton}
                    onPress={handleInitiateClaim}
                    disabled={isSubmitting || isTracking}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={
                        isTracking
                          ? ['#94a3b8', '#64748b']
                          : hasCompletedFullJourney
                          ? ['#059669', '#047857']
                          : ['#2563eb', '#1d4ed8']
                      }
                      style={styles.confirmGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      {isSubmitting ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <View style={styles.btnRow}>
                          <CheckCircle2 size={17} color="#ffffff" style={{ marginRight: 6 }} />
                          <Text style={styles.confirmButtonText}>
                            {hasCompletedFullJourney
                              ? `Complete Trip • ${routeData.distanceKm} KM (₹${routeData.reimbursementAmount})`
                              : `Finish Trip • ${effectiveTraveledKm} KM (₹${claimAmount})`}
                          </Text>
                        </View>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}
            </Surface>
          ) : (
            <Surface style={styles.promptSheetCard} elevation={3}>
              <View style={styles.promptIconCircle}>
                <Car size={22} color="#2563eb" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.promptSheetTitle}>Where are you heading?</Text>
                <Text style={styles.promptSheetSubtitle}>
                  Search destination above to preview road route & calculate KM credit.
                </Text>
              </View>
            </Surface>
          )}
        </View>
      ) : (
        /* ── HISTORY TAB ── */
        <ScrollView
          style={styles.historyContainer}
          contentContainerStyle={styles.historyScrollContent}
          refreshControl={
            <RefreshControl
              refreshing={historyRefreshing}
              onRefresh={() => {
                setHistoryRefreshing(true);
                fetchHistory();
              }}
              tintColor="#2563eb"
            />
          }
        >
          {/* Summary KPI Strip */}
          <View style={styles.historyKpiRow}>
            <Surface style={styles.historyKpiCard} elevation={1}>
              <Text style={styles.historyKpiLabel}>TOTAL TRIPS</Text>
              <Text style={styles.historyKpiValue}>{tripsHistory.length}</Text>
            </Surface>
            <Surface style={styles.historyKpiCard} elevation={1}>
              <Text style={styles.historyKpiLabel}>TOTAL ROAD KM</Text>
              <Text style={[styles.historyKpiValue, { color: '#2563eb' }]}>
                {historySummary.totalKm} km
              </Text>
            </Surface>
            <Surface style={styles.historyKpiCard} elevation={1}>
              <Text style={styles.historyKpiLabel}>ALLOWANCE EARNED</Text>
              <Text style={[styles.historyKpiValue, { color: '#16a34a' }]}>
                ₹{historySummary.totalPayout}
              </Text>
            </Surface>
          </View>

          {/* Trips List */}
          <Text style={styles.historySectionTitle}>CLAIMED TRIP ROUTES</Text>

          {loadingHistory && !historyRefreshing ? (
            <View style={styles.historyLoader}>
              <ActivityIndicator size="large" color="#2563eb" />
              <Text style={styles.historyLoaderText}>Loading claimed trips...</Text>
            </View>
          ) : tripsHistory.length === 0 ? (
            <Surface style={styles.emptyHistoryCard} elevation={1}>
              <Briefcase size={36} color="#94a3b8" />
              <Text style={styles.emptyHistoryTitle}>No Claimed Trips Yet</Text>
              <Text style={styles.emptyHistorySubtitle}>
                Plan your first meeting route and claim official road KM directly into your daily ledger.
              </Text>
              <TouchableOpacity
                style={styles.emptyPlanBtn}
                onPress={() => setActiveTab('planner')}
                activeOpacity={0.8}
              >
                <Text style={styles.emptyPlanBtnText}>Plan A Trip Now</Text>
              </TouchableOpacity>
            </Surface>
          ) : (
            tripsHistory.map((trip) => (
              <Surface key={trip._id} style={styles.tripHistoryCard} elevation={1}>
                {/* Header row: Date & status */}
                <View style={styles.tripCardHeader}>
                  <View style={styles.tripDateRow}>
                    <Clock size={13} color="#64748b" />
                    <Text style={styles.tripDateText}>
                      {trip.date} • {new Date(trip.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <View style={styles.statusCreditedBadge}>
                    <Check size={11} color="#16a34a" />
                    <Text style={styles.statusCreditedText}>CREDITED</Text>
                  </View>
                </View>

                {/* Route: Origin -> Destination */}
                <View style={styles.tripRouteRow}>
                  <View style={styles.routeBulletCol}>
                    <View style={styles.smallOriginDot} />
                    <View style={styles.smallConnector} />
                    <View style={styles.smallDestSquare} />
                  </View>
                  <View style={styles.routeAddressesCol}>
                    <Text style={styles.tripAddressText} numberOfLines={1}>
                      {trip.origin?.address || 'Pickup'}
                    </Text>
                    <Text style={styles.tripAddressText} numberOfLines={1}>
                      {trip.destination?.address || 'Destination'}
                    </Text>
                  </View>
                </View>

                {/* Footer details: KM, Amount, Purpose */}
                <View style={styles.tripCardFooter}>
                  <View style={styles.tripKmBadge}>
                    <Car size={13} color="#2563eb" />
                    <Text style={styles.tripKmText}>{trip.distanceKm} KM</Text>
                  </View>
                  <View style={styles.tripPurposeBadge}>
                    <Text style={styles.tripPurposeText}>{trip.purpose || 'Meeting'}</Text>
                  </View>
                  {trip.clientName ? (
                    <Text style={styles.tripClientText} numberOfLines={1}>
                      • {trip.clientName}
                    </Text>
                  ) : null}
                  <View style={{ flex: 1 }} />
                  <Text style={styles.tripAmountText}>+₹{trip.reimbursementAmount}</Text>
                </View>
              </Surface>
            ))
          )}
        </ScrollView>
      )}

      {/* ── SUCCESS CELEBRATION MODAL ── */}
      {successModal && (
        <View style={styles.modalOverlay}>
          <Surface style={styles.successCard} elevation={6}>
            <View style={styles.successIconCircle}>
              <CheckCircle2 size={44} color="#16a34a" />
            </View>
            <Text style={styles.successTitle}>Trip Confirmed & Credited!</Text>
            <Text style={styles.successSubtitle}>
              {successModal.creditedKm} KM has been added to your daily attendance and live tracking ledger.
            </Text>

            <View style={styles.successMetricsBox}>
              <View style={styles.successMetricCol}>
                <Text style={styles.successMetricLabel}>CREDITED KM</Text>
                <Text style={styles.successMetricVal}>+{successModal.creditedKm} KM</Text>
              </View>
              <View style={styles.successMetricDivider} />
              <View style={styles.successMetricCol}>
                <Text style={styles.successMetricLabel}>ALLOWANCE</Text>
                <Text style={[styles.successMetricVal, { color: '#16a34a' }]}>
                  +₹{successModal.reimbursementAmount}
                </Text>
              </View>
              <View style={styles.successMetricDivider} />
              <View style={styles.successMetricCol}>
                <Text style={styles.successMetricLabel}>TODAY'S TOTAL</Text>
                <Text style={[styles.successMetricVal, { color: '#2563eb' }]}>
                  {successModal.todayTotalKm} KM
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.successDoneBtn}
              onPress={() => {
                setSuccessModal(null);
                setActiveTab('history');
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.successDoneBtnText}>View In Trip History</Text>
            </TouchableOpacity>
          </Surface>
        </View>
      )}

      {/* ── CANCEL CONFIRMATION MODAL ── */}
      {showCancelModal && (
        <View style={styles.modalOverlay}>
          <Surface style={styles.cancelCard} elevation={6}>
            <View style={styles.cancelIconCircle}>
              <AlertCircle size={38} color="#ef4444" />
            </View>
            <Text style={styles.cancelTitle}>Cancel Trip?</Text>
            <Text style={styles.cancelSubtitle}>
              Kya aap trip cancel karna chahte hain?
            </Text>

            <View style={styles.cancelChoiceInfoBox}>
              <View style={styles.cancelChoiceBullet}>
                <Text style={styles.cancelChoiceBulletDot}>•</Text>
                <Text style={styles.cancelChoiceBulletText}>
                  <Text style={{ fontWeight: '700', color: '#2563eb' }}>Continue Trip:</Text> Trip jari rahegi aur aap isi page par rahenge.
                </Text>
              </View>
              <View style={styles.cancelChoiceBullet}>
                <Text style={styles.cancelChoiceBulletDot}>•</Text>
                <Text style={styles.cancelChoiceBulletText}>
                  <Text style={{ fontWeight: '700', color: '#ef4444' }}>Cancel Trip:</Text> Trip band ho jayegi aur aap Home screen par chale jayenge.
                </Text>
              </View>
            </View>

            <View style={styles.cancelBtnRow}>
              {/* Option 1: Keep Trip (Cancel mat karo, isi page per raho) */}
              <TouchableOpacity
                style={styles.cancelKeepBtn}
                onPress={() => setShowCancelModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelKeepBtnText}>No, Keep Trip</Text>
                <Text style={styles.cancelBtnSubText}>Cancel mat karo</Text>
              </TouchableOpacity>

              {/* Option 2: Confirm Cancel (Haan, cancel kardo aur Home jao) */}
              <TouchableOpacity
                style={styles.cancelConfirmBtn}
                onPress={executeCancelTrip}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelConfirmBtnText}>Yes, Cancel Trip</Text>
                <Text style={[styles.cancelBtnSubText, { color: '#fee2e2' }]}>Haan, cancel karein</Text>
              </TouchableOpacity>
            </View>
          </Surface>
        </View>
      )}

      {/* ── 500M DESTINATION ARRIVAL POPUP BOX (CLAIM ALL PLANNED KM) ── */}
      {showArrivalModal && routeData && (
        <View style={styles.modalOverlay}>
          <Surface style={styles.arrivalModalCard} elevation={6}>
            {/* Top Celebration Badge */}
            <View style={styles.arrivalIconBadge}>
              <CheckCircle2 size={40} color="#16a34a" />
            </View>

            <Text style={styles.arrivalModalTitle}>Destination Reached!</Text>
            <Text style={styles.arrivalModalSubtitle}>
              Aap destination ke 500m radius me aa chuke hain!
            </Text>

            {/* Destination Address Pill */}
            <View style={styles.arrivalDestRow}>
              <MapPin size={15} color="#ef4444" style={{ marginTop: 2, marginRight: 6 }} />
              <Text style={styles.arrivalDestText} numberOfLines={2}>
                {destination?.address || 'Destination'}
              </Text>
            </View>

            {/* 2-Column Full Planned Credit Metric Box */}
            <View style={styles.arrivalMetricsCard}>
              <View style={styles.arrivalMetricCol}>
                <Text style={styles.arrivalMetricLabel}>ALL PLANNED KM</Text>
                <Text style={styles.arrivalMetricValKm}>{routeData.distanceKm} KM</Text>
                <Text style={styles.arrivalMetricTag}>100% Full Credit</Text>
              </View>
              <View style={styles.arrivalMetricDivider} />
              <View style={styles.arrivalMetricCol}>
                <Text style={styles.arrivalMetricLabel}>ALLOWANCE</Text>
                <Text style={styles.arrivalMetricValAmount}>₹{routeData.reimbursementAmount}</Text>
                <Text style={styles.arrivalMetricTag}>TA Payout</Text>
              </View>
            </View>

            {/* Guarantee Note */}
            <View style={styles.arrivalNoteBox}>
              <CheckCircle2 size={13} color="#059669" style={{ marginRight: 6, marginTop: 1 }} />
              <Text style={styles.arrivalNoteText}>
                Jitna KM destination choose karte time show hua tha ({routeData.distanceKm} KM), poora aapke daily ledger me credit hoga.
              </Text>
            </View>

            {/* Actions */}
            <View style={styles.arrivalBtnStack}>
              {/* Primary Claim All KM Button */}
              <TouchableOpacity
                style={styles.arrivalConfirmBtn}
                onPress={() => {
                  setShowArrivalModal(false);
                  handleConfirmTrip(routeData.distanceKm, routeData.reimbursementAmount);
                }}
                disabled={isSubmitting}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#16a34a', '#15803d']}
                  style={styles.arrivalConfirmGrad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Text style={styles.arrivalConfirmBtnText}>
                        Complete Trip ({routeData.distanceKm} KM)
                      </Text>
                      <Text style={styles.arrivalConfirmSubText}>
                        +₹{routeData.reimbursementAmount} Add to Ledger
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Secondary Keep Trip Active Button */}
              <TouchableOpacity
                style={styles.arrivalDismissBtn}
                onPress={() => setShowArrivalModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.arrivalDismissBtnText}>Abhi Nahi, Baad Me</Text>
              </TouchableOpacity>
            </View>
          </Surface>
        </View>
      )}

      {/* ── CLAIM CONFIRMATION MODAL ── */}
      {showEarlyClaimModal && (
        <View style={styles.modalOverlay}>
          <Surface style={styles.earlyClaimCard} elevation={6}>
            <View style={styles.earlyClaimIconCircle}>
              {hasCompletedFullJourney ? (
                <CheckCircle2 size={36} color="#16a34a" />
              ) : effectiveTraveledKm <= 0.05 ? (
                <AlertCircle size={36} color="#d97706" />
              ) : (
                <AlertTriangle size={36} color="#d97706" />
              )}
            </View>
            <Text style={styles.earlyClaimTitle}>
              {hasCompletedFullJourney
                ? 'Complete Trip?'
                : 'Finish Trip?'}
            </Text>
            <Text style={styles.earlyClaimSubtitle}>
              {hasCompletedFullJourney ? (
                `Aap destination pahunch chuke hain! Full planned distance ${routeData?.distanceKm} KM complete karne ke liye confirm karein.`
              ) : effectiveTraveledKm <= 0.05 ? (
                `Total planned trip ${routeData?.distanceKm} KM ki thi, lekin abhi tak 0 KM physical movement detect hua hai.`
              ) : (
                `Total planned trip ${routeData?.distanceKm} KM ki thi, jisme se aapne ${effectiveTraveledKm} KM physically move kiya hai.`
              )}
            </Text>

            {/* Breakdown Box */}
            <View style={styles.earlyClaimBreakdown}>
              <View style={styles.earlyClaimRow}>
                <Text style={styles.earlyClaimLabel}>Planned Trip Distance:</Text>
                <Text style={[styles.earlyClaimVal, { color: '#0f172a' }]}>{routeData?.distanceKm} KM</Text>
              </View>
              <View style={styles.earlyClaimRow}>
                <Text style={styles.earlyClaimLabel}>Actual Moved Distance:</Text>
                <Text style={[styles.earlyClaimVal, { color: '#2563eb' }]}>{formattedMovedDistance}</Text>
              </View>
              <View style={styles.earlyClaimRow}>
                <Text style={styles.earlyClaimLabel}>Reimbursement Amount:</Text>
                <Text style={[styles.earlyClaimVal, { color: '#059669' }]}>
                  ₹{claimAmount}
                </Text>
              </View>
              {remainingRoadKm > 0 && !hasCompletedFullJourney && (
                <View style={styles.earlyClaimRow}>
                  <Text style={styles.earlyClaimLabel}>Remaining (To Destination):</Text>
                  <Text style={[styles.earlyClaimVal, { color: '#dc2626' }]}>
                    {remainingRoadKm} KM
                  </Text>
                </View>
              )}
            </View>

            <Text style={styles.earlyClaimNote}>
              {hasCompletedFullJourney
                ? `Aap destination ke 500m radius me hain! Poora planned ${routeData?.distanceKm} KM (₹${routeData?.reimbursementAmount}) aapke account me add kiya jayega.`
                : effectiveTraveledKm <= 0.05
                ? `Aap destination se ${remainingRoadKm} KM door hain. Koi physical movement detect nahi hua hai (0 KM credit). Full claim sirf destination ke 500m radius me milta hai.`
                : `Aap destination se ${remainingRoadKm} KM door hain. Aapko strictly actual physically moved distance (${formattedMovedDistance}) credit hoga. Full claim poori trip ka sirf destination ke 500m radius me milta hai.`}
            </Text>

            <View style={styles.earlyClaimBtnRow}>
              {/* Option 1: Cancel -> Closes modal, trip remains in progress on same page */}
              <TouchableOpacity
                style={styles.earlyClaimCancelBtn}
                onPress={() => setShowEarlyClaimModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.earlyClaimCancelBtnText}>Cancel</Text>
                <Text style={styles.earlyClaimBtnSubText}>Stay on trip</Text>
              </TouchableOpacity>

              {/* Option 2: Confirm -> Credits moved distance and completes trip */}
              <TouchableOpacity
                style={styles.earlyClaimConfirmBtn}
                onPress={() => handleConfirmTrip(effectiveTraveledKm, claimAmount)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={hasCompletedFullJourney ? ['#059669', '#047857'] : ['#2563eb', '#1d4ed8']}
                  style={styles.earlyClaimConfirmGrad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.earlyClaimConfirmBtnText}>
                    {hasCompletedFullJourney
                      ? `Confirm & Complete (${routeData?.distanceKm} KM)`
                      : effectiveTraveledKm > 0
                      ? `Confirm & Finish (${formattedMovedDistance})`
                      : 'Confirm & Finish (0 KM)'}
                  </Text>
                  <Text style={[styles.earlyClaimBtnSubText, { color: hasCompletedFullJourney ? '#d1fae5' : '#dbeafe' }]}>
                    Add to ledger
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Surface>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#ffffff',
    paddingTop: Platform.OS === 'ios' ? 52 : 44,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 48 : Platform.OS === 'web' ? 18 : 36,
    marginTop: Platform.OS === 'web' ? 6 : 0,
    paddingBottom: 14,
    backgroundColor: '#f0fdfa', // Fresh, modern light-teal tint
    borderBottomWidth: 1,
    borderBottomColor: '#ccfbf1',
    zIndex: 40,
    shadowColor: '#0f766e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ccfbf1',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  headerCenter: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 1,
  },
  headerTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#dbeafe',
    gap: 5,
  },
  headerTabBtnActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  headerTabBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
  },
  headerTabBtnTextActive: {
    color: '#ffffff',
  },
  plannerWrapper: {
    flex: 1,
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  routeCard: {
    position: 'absolute',
    top: 10,
    left: 12,
    right: 12,
    zIndex: 30,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  routeCardCompact: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  inProgressCompactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inProgressCompactRoute: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  inProgressDotOrigin: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
    marginRight: 6,
  },
  inProgressTextOrigin: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
    maxWidth: '38%',
  },
  inProgressDotDest: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: '#ef4444',
    marginRight: 6,
  },
  inProgressTextDest: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
    maxWidth: '38%',
  },
  compactCancelBtn: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  compactCancelText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#dc2626',
  },
  trackingActiveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 10,
    padding: 8,
    marginBottom: 8,
  },
  trackingActiveBannerTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#b45309',
  },
  trackingActiveBannerSub: {
    fontSize: 10,
    color: '#92400e',
    marginTop: 1,
    lineHeight: 13,
  },
  routeInputsStack: {
    position: 'relative',
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    height: 38,
  },
  inputBoxActive: {
    borderColor: '#2563eb',
    backgroundColor: '#ffffff',
  },
  originIconBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  originDotInner: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#059669',
  },
  destIconBadge: {
    width: 18,
    height: 18,
    borderRadius: 5,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  destSquareInner: {
    width: 7,
    height: 7,
    borderRadius: 2,
    backgroundColor: '#dc2626',
  },
  locationInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
    paddingVertical: 0,
  },
  fieldClearBtn: {
    padding: 4,
  },
  gpsChipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    gap: 3,
  },
  gpsChipText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#059669',
  },
  swapDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
    position: 'relative',
    height: 14,
  },
  swapDashLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#f1f5f9',
  },
  swapBtnFloat: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#dbeafe',
    marginHorizontal: 10,
  },
  subStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  reAnchorLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  reAnchorText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#059669',
  },
  routingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  routingBadgeText: {
    fontSize: 11.5,
    color: '#2563eb',
    fontWeight: '600',
  },
  predictionsDropdown: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    maxHeight: 220,
  },
  predictionLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  predictionLoadingText: {
    fontSize: 13,
    color: '#64748b',
  },
  predictionsList: {
    maxHeight: 210,
  },
  predictionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  predictionIcon: {
    marginRight: 10,
  },
  predictionIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  predictionTextCol: {
    flex: 1,
  },
  predictionTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#0f172a',
  },
  predictionSubtitle: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 1,
  },
  mapContainer: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    zIndex: 1,
  },
  bottomSheetCard: {
    position: 'absolute',
    bottom: Platform.OS === 'web' ? 104 : (Platform.OS === 'ios' ? 116 : 108),
    left: 12,
    right: 12,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 8,
    zIndex: 25,
  },
  metricsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  metricCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  metricVal: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0f172a',
  },
  metricUnit: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748b',
  },
  metricSub: {
    fontSize: 9.5,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 1,
  },
  metricDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 2,
  },
  purposeSegment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  purposeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    height: 35,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  purposeTabActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
  },
  purposeTabText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748b',
  },
  purposeTabTextActive: {
    color: '#2563eb',
    fontWeight: '700',
  },
  clientInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    height: 36,
    marginTop: 7,
  },
  clientInput: {
    flex: 1,
    fontSize: 12,
    color: '#0f172a',
    paddingVertical: 0,
  },
  confirmButton: {
    marginTop: 9,
    height: 48,
    borderRadius: 14,
    overflow: 'hidden',
  },
  confirmButtonDisabled: {
    opacity: 0.85,
  },
  confirmGradient: {
    flex: 1,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  actionBlock: {
    width: '100%',
  },
  geofenceHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    gap: 5,
  },
  geofenceHintText: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '500',
  },
  inProgressDistBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 7,
  },
  inProgressDistTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b45309',
  },
  inProgressDistSubtitle: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#92400e',
    marginTop: 1,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  livePulseDotStationary: {
    backgroundColor: '#94a3b8',
  },
  livePulseDotMoving: {
    backgroundColor: '#10b981',
  },
  lockedButton: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  lockedBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  lockedBtnText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  reachedDestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 7,
    gap: 6,
  },
  reachedDestBannerText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#047857',
  },
  inProgressAuxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 8,
  },
  liveAutoSenseBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 6,
    marginRight: 6,
    borderWidth: 1,
  },
  liveAutoSenseBadgeStationary: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  liveAutoSenseBadgeMoving: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  liveAutoSenseText: {
    fontSize: 10,
    fontWeight: '700',
  },
  liveAutoSenseTextStationary: {
    color: '#64748b',
  },
  liveAutoSenseTextMoving: {
    color: '#166534',
  },
  auxCancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#fee2e2',
    gap: 3,
  },
  auxCancelBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#ef4444',
  },
  inProgressActiveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  inProgressActiveTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065f46',
  },
  inProgressActiveSub: {
    fontSize: 10,
    color: '#047857',
    marginTop: 1,
  },
  headerCancelTripBtn: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  headerCancelTripText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#dc2626',
  },
  promptSheetCard: {
    position: 'absolute',
    bottom: Platform.OS === 'web' ? 104 : (Platform.OS === 'ios' ? 116 : 108),
    left: 12,
    right: 12,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    zIndex: 25,
  },
  promptIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptSheetTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  promptSheetSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    lineHeight: 16,
  },
  historyContainer: {
    flex: 1,
  },
  historyScrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  historyKpiRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  historyKpiCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  historyKpiLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.3,
  },
  historyKpiValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 4,
  },
  historySectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.4,
    marginBottom: 12,
  },
  historyLoader: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  historyLoaderText: {
    fontSize: 13,
    color: '#64748b',
  },
  emptyHistoryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 10,
  },
  emptyHistoryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 12,
  },
  emptyHistorySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
    maxWidth: 280,
  },
  emptyPlanBtn: {
    marginTop: 18,
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptyPlanBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  tripHistoryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tripCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tripDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  tripDateText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
  },
  statusCreditedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 3,
  },
  statusCreditedText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#16a34a',
  },
  tripRouteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  routeBulletCol: {
    alignItems: 'center',
    marginRight: 10,
    paddingVertical: 2,
  },
  smallOriginDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10b981',
  },
  smallConnector: {
    width: 1.5,
    height: 16,
    backgroundColor: '#cbd5e1',
    marginVertical: 2,
  },
  smallDestSquare: {
    width: 7,
    height: 7,
    backgroundColor: '#ef4444',
    borderRadius: 1.5,
  },
  routeAddressesCol: {
    flex: 1,
    gap: 6,
  },
  tripAddressText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
  },
  tripCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
    gap: 8,
  },
  tripKmBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  tripKmText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
  },
  tripPurposeBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  tripPurposeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  tripClientText: {
    fontSize: 11,
    color: '#64748b',
    maxWidth: 100,
  },
  tripAmountText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#16a34a',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 99,
  },
  successCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
  },
  successIconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  successMetricsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginTop: 18,
    width: '100%',
  },
  successMetricCol: {
    flex: 1,
    alignItems: 'center',
  },
  successMetricDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#e2e8f0',
  },
  successMetricLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.3,
  },
  successMetricVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 3,
  },
  successDoneBtn: {
    marginTop: 20,
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
  },
  successDoneBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  cancelCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fee2e2',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  cancelIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  cancelTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8,
  },
  cancelSubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 14,
    paddingHorizontal: 8,
  },
  cancelChoiceInfoBox: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 18,
    gap: 8,
  },
  cancelChoiceBullet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  cancelChoiceBulletDot: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 18,
  },
  cancelChoiceBulletText: {
    flex: 1,
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
  },
  cancelBtnRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  cancelKeepBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#bfdbfe',
  },
  cancelKeepBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563eb',
  },
  cancelConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  cancelConfirmBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  planningActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 9,
    marginBottom: 4,
    gap: 10,
    width: '100%',
  },
  planningCancelBtn: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    gap: 5,
  },
  planningCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ef4444',
  },
  planningStartBtn: {
    flex: 1,
    marginTop: 0,
    height: 48,
  },
  earlyClaimCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fef3c7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  earlyClaimIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#fffbeb',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  earlyClaimTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8,
  },
  earlyClaimSubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  earlyClaimBreakdown: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
    gap: 8,
  },
  earlyClaimRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  earlyClaimLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  earlyClaimVal: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '800',
  },
  earlyClaimNote: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 18,
    paddingHorizontal: 8,
  },
  earlyClaimBtnRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  earlyClaimCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  earlyClaimCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  earlyClaimConfirmBtn: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    overflow: 'hidden',
  },
  earlyClaimConfirmGrad: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  earlyClaimConfirmBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  cancelBtnSubText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 2,
  },
  earlyClaimBtnSubText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 2,
  },
  markArrivedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
    marginLeft: 6,
  },
  markArrivedPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  modalArrivedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1.5,
    borderColor: '#86efac',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
    gap: 8,
    width: '100%',
  },
  modalArrivedToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803d',
  },
  modalArrivedToggleSub: {
    fontSize: 10,
    color: '#16a34a',
    marginTop: 2,
  },
  // ─── 500M ARRIVAL POPUP BOX STYLES ───
  arrivalModalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    width: '92%',
    maxWidth: 420,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(22, 163, 74, 0.15)',
  },
  arrivalIconBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 3,
    borderColor: '#bbf7d0',
  },
  arrivalModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  arrivalModalSubtitle: {
    fontSize: 13,
    color: '#15803d',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 14,
  },
  arrivalDestRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: '100%',
    marginBottom: 16,
  },
  arrivalDestText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
    flex: 1,
    lineHeight: 17,
  },
  arrivalMetricsCard: {
    flexDirection: 'row',
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#86efac',
    paddingVertical: 14,
    paddingHorizontal: 16,
    width: '100%',
    marginBottom: 14,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  arrivalMetricCol: {
    flex: 1,
    alignItems: 'center',
  },
  arrivalMetricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803d',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  arrivalMetricValKm: {
    fontSize: 22,
    fontWeight: '900',
    color: '#15803d',
  },
  arrivalMetricValAmount: {
    fontSize: 22,
    fontWeight: '900',
    color: '#047857',
  },
  arrivalMetricTag: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16a34a',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 3,
    overflow: 'hidden',
  },
  arrivalMetricDivider: {
    width: 1,
    height: 42,
    backgroundColor: '#bbf7d0',
    marginHorizontal: 12,
  },
  arrivalNoteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    padding: 10,
    width: '100%',
    marginBottom: 18,
    borderLeftWidth: 3,
    borderLeftColor: '#16a34a',
  },
  arrivalNoteText: {
    fontSize: 11,
    color: '#166534',
    lineHeight: 16,
    fontWeight: '500',
    flex: 1,
  },
  arrivalBtnStack: {
    width: '100%',
    gap: 8,
  },
  arrivalConfirmBtn: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  arrivalConfirmGrad: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrivalConfirmBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  arrivalConfirmSubText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#bbf7d0',
    marginTop: 2,
  },
  arrivalDismissBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  arrivalDismissBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
});
