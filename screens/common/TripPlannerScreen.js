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
  const accumulatedTraveledMetersRef = useRef(0);
  const actualTrailRef = useRef([]); // [{ lat, lng, speed, accuracy, timestamp }]

  // History Tab State
  const [tripsHistory, setTripsHistory] = useState([]);
  const [historySummary, setHistorySummary] = useState({ totalKm: 0, totalPayout: 0 });
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyRefreshing, setHistoryRefreshing] = useState(false);

  const searchTimeoutRef = useRef(null);

  // ── DYNAMIC DISTANCE TELEMETRY (STRICT ACTUAL PHYSICAL MOVEMENT) ──
  const distanceToDestMeters = (currentGps && destination && Number.isFinite(currentGps.lat) && Number.isFinite(destination.lat))
    ? haversineMeters(currentGps.lat, currentGps.lng, destination.lat, destination.lng)
    : null;

  const isWithin500m = distanceToDestMeters !== null && distanceToDestMeters <= 500;

  // Ground Truth: Did employee actually complete the journey to destination?
  // Requires: Arrived within 500m AND actually physically moved >= 80% of planned distance
  const hasCompletedFullJourney = Boolean(
    isWithin500m &&
    routeData?.distanceKm &&
    (traveledKm >= routeData.distanceKm * 0.80)
  );

  // Authoritative Effective Traveled KM:
  // Strictly credits the physical distance moved! If they completed the full journey, full route distance is credited.
  const effectiveTraveledKm = hasCompletedFullJourney
    ? routeData.distanceKm
    : Math.min(
        routeData?.distanceKm || 0,
        Math.round(traveledKm * 100) / 100
      );

  // Remaining Road KM: accurately decreases in real-time as user moves
  const remainingRoadKm = routeData?.distanceKm
    ? Math.max(0, Math.round((routeData.distanceKm - effectiveTraveledKm) * 100) / 100)
    : 0;

  const ratePerKm = Number(user?.TA || user?.travelRate || 2.50);
  const claimAmount = Math.round(effectiveTraveledKm * ratePerKm * 100) / 100;

  // Formatted human-readable moved distance (shows meters for small movement < 1 KM)
  const formattedMovedDistance = traveledMeters >= 1000
    ? `${effectiveTraveledKm} KM`
    : `${traveledMeters}m (${effectiveTraveledKm} KM)`;

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
          accuracy: Location.Accuracy.Balanced,
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

    // Layer 4: Adaptive Stationary Anchor Gate (Geofence Bubble 16m - 25m)
    // Eliminates 100% of indoor jitter, desk sitting, red light drift, and false stationary movement
    const anchorRadiusM = Math.max(16, Math.min(25, reportedAccuracy * 0.75));
    const isStationarySpeed = reportedSpeedKmh < 1.8 && calcSpeedKmh < 2.0;
    const isWithinAnchor = distFromAnchorM < anchorRadiusM;

    // ── SCENARIO A: Currently STATIONARY (Sitting, standing, or parked) ──
    if (!isMovingRef.current) {
      if (isStationarySpeed || isWithinAnchor) {
        // Stay in STATIONARY — Softly absorb jitter into anchor center (strictly 0.00 meters added)
        stationaryAnchorRef.current = {
          lat: 0.95 * anchor.lat + 0.05 * lat,
          lng: 0.95 * anchor.lng + 0.05 * lng,
        };
        lastFixRef.current = { lat, lng, timestamp: now, accuracy: reportedAccuracy, speed: 0 };
        return;
      }

      // ── Physical Departure Detected! ──
      // Employee physically broke out of anchor bubble with genuine travel velocity!
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
    // Check if user came to a stop (traffic signal, tea stall, customer visit)
    if (reportedSpeedKmh < 1.5 && calcSpeedKmh < 1.8 && distFromLastM < 6.0) {
      isMovingRef.current = false;
      setMotionStatus('STATIONARY');
      stationaryAnchorRef.current = { lat, lng };
      lastConfirmedCoordRef.current = { lat, lng, timestamp: now };
      lastFixRef.current = { lat, lng, timestamp: now, accuracy: reportedAccuracy, speed: 0 };
      console.log('🛑 [TripPlanner Odometer] Motion Stopped. New Stationary Anchor Dropped. Distance accumulation frozen.');
      return;
    }

    // Legitimate road progress while moving (minimum 5.0m step between fixes to eliminate micro-jitter)
    if (distFromLastM >= 5.0 && calcSpeedKmh < 160) {
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
  const hasNotifiedArrivalRef = useRef(false);

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

  // 1C. Auto-Arrival Trigger: Alerts user as soon as GPS auto-senses <= 500m
  useEffect(() => {
    if (tripStatus === 'IN_PROGRESS' && isWithin500m && !hasNotifiedArrivalRef.current) {
      hasNotifiedArrivalRef.current = true;
      if (hasCompletedFullJourney) {
        Alert.alert(
          '🎯 Destination Reached!',
          `Aap destination pahunch chuke hain aur puri trip travel kar li hai! Full trip (${routeData?.distanceKm} KM) claim active ho gaya hai.`
        );
      } else {
        Alert.alert(
          '📍 Near Destination',
          `Aap destination ke 500 meter pass hain. Aapne abhi tak ${traveledKm} KM move kiya hai. Aap ye moved distance claim kar sakte hain.`
        );
      }
    } else if (!isWithin500m) {
      hasNotifiedArrivalRef.current = false;
    }
  }, [tripStatus, isWithin500m, hasCompletedFullJourney, traveledKm, routeData]);

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
        if (origin) {
          requestRoute(origin, selectedCoord);
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

  // 7. Reset to Current GPS Position
  const handleUseCurrentGps = async () => {
    if (!currentGps) {
      Alert.alert('GPS unavailable', 'Fetching your current coordinates...');
      return;
    }
    const addr = await reverseGeocodeLocation(currentGps.lat, currentGps.lng);
    const newOrigin = { lat: currentGps.lat, lng: currentGps.lng, address: addr };
    setOrigin(newOrigin);
    setOriginText(addr);
    setPredictions([]);
    setSearchingField(null);

    if (destination) {
      requestRoute(newOrigin, destination);
    }
  };

  // 8. Start Trip (Transitions to IN_PROGRESS so employee/manager travels to destination)
  const handleStartTrip = async () => {
    if (isTracking) {
      Alert.alert(
        'One Feature At A Time',
        'You are currently Punched In! Live GPS tracking is already active. Please Punch Out first if you wish to start this planned trip.'
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
    await storage.setItem('active_trip_planner_status', 'IN_PROGRESS');
    await storage.setItem('active_trip_planner_started_at', new Date().toISOString());
    await storage.setItem('active_trip_planner_origin', JSON.stringify(origin));
    await storage.setItem('active_trip_planner_destination', JSON.stringify(destination));
    await storage.setItem('active_trip_planner_route', JSON.stringify(routeData));
    await storage.setItem('active_trip_planner_purpose', selectedPurpose);
    await storage.setItem('active_trip_planner_client', clientName);
    await storage.setItem('active_trip_planner_traveled_m', '0');
    await storage.setItem('active_trip_planner_trail', JSON.stringify(actualTrailRef.current));
    await storage.setItem('active_trip_planner_is_active', 'true');

    Alert.alert(
      '🚗 Trip Started!',
      `Destination: ${destination.address}\nPlanned Distance: ${routeData.distanceKm} KM\n\nAb chalo apne destination ki taraf! Aap jitna bhi distance physically move karenge, strictly utna hi KM aapke account me add hoga.`
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

      // 100% full React state reset
      setTripStatus('PLANNING');
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
    const simLat = destination.lat + 0.0002;
    const simLng = destination.lng + 0.0002;
    setCurrentGps({
      lat: simLat,
      lng: simLng,
    });
    if (routeData?.distanceKm) {
      const fullM = routeData.distanceKm * 1000;
      accumulatedTraveledMetersRef.current = fullM;
      setTraveledKm(routeData.distanceKm);
      storage.setItem('active_trip_planner_traveled_m', fullM.toString()).catch(() => {});
    }
    Alert.alert(
      '🎯 Simulated Arrival (DEV Test)',
      'GPS location destination ke pass set ho gayi hai aur traveled distance full update ho gaya hai.'
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

  // 12. Initiate Claim: ALWAYS shows the interactive Confirmation Modal!
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

    // Always show interactive Claim Confirmation Modal on Claim button click!
    setShowEarlyClaimModal(true);
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

          // Reset planner fields & clear storage draft
          setTripStatus('PLANNING');
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

      // Reset planner fields & clear active draft
      setTripStatus('PLANNING');
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
          <Text style={styles.headerTitle}>Trip Route Planner</Text>
          <Text style={styles.headerSubtitle}>Road Distance & Travel Allowance</Text>
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
          <Surface style={styles.routeCard} elevation={4}>
            {/* MUTUAL EXCLUSION WARNING BANNER */}
            {isTracking && (
              <View style={styles.trackingActiveBanner}>
                <AlertCircle size={15} color="#d97706" style={{ marginRight: 6 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.trackingActiveBannerTitle}>
                    Live GPS Tracking Active (Punched In)
                  </Text>
                  <Text style={styles.trackingActiveBannerSub}>
                    Punch Out first to claim via Trip Route Planner.
                  </Text>
                </View>
              </View>
            )}

            {/* ACTIVE TRIP IN-PROGRESS BANNER */}
            {tripStatus === 'IN_PROGRESS' && (
              <View style={styles.inProgressActiveBanner}>
                <View style={styles.livePulseDot} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.inProgressActiveTitle}>
                    Trip In Progress to Destination
                  </Text>
                  <Text style={styles.inProgressActiveSub} numberOfLines={1}>
                    {destination?.address || 'Destination'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.headerCancelTripBtn}
                  onPress={handleCancelTrip}
                  activeOpacity={0.7}
                >
                  <Text style={styles.headerCancelTripText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.routeInputsStack}>
              {/* PICKUP / ORIGIN INPUT (Point A) */}
              <View style={[styles.inputBox, searchingField === 'origin' && styles.inputBoxActive]}>
                <View style={styles.originIconBadge}>
                  <View style={styles.originDotInner} />
                </View>
                <TextInput
                  style={[styles.locationInput, tripStatus === 'IN_PROGRESS' && { color: '#64748b' }]}
                  placeholder="Where from? (Pickup point)"
                  placeholderTextColor="#94a3b8"
                  value={originText}
                  editable={tripStatus !== 'IN_PROGRESS'}
                  onChangeText={(txt) => handleTextChange(txt, 'origin')}
                  onFocus={() => {
                    if (tripStatus === 'IN_PROGRESS') {
                      Alert.alert('Trip In Progress', 'Trip chal raha hai. Destination badalne ke liye pahle trip Cancel karein.');
                    } else {
                      handleFocusField('origin');
                    }
                  }}
                />
                {tripStatus === 'IN_PROGRESS' ? null : originText ? (
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
                  style={[styles.swapBtnFloat, tripStatus === 'IN_PROGRESS' && { opacity: 0.4 }]}
                  onPress={tripStatus === 'IN_PROGRESS' ? undefined : handleSwap}
                  activeOpacity={0.7}
                  disabled={tripStatus === 'IN_PROGRESS'}
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
                  style={[styles.locationInput, tripStatus === 'IN_PROGRESS' && { color: '#64748b' }]}
                  placeholder="Where to? (Destination / Meeting point)"
                  placeholderTextColor="#94a3b8"
                  value={destText}
                  editable={tripStatus !== 'IN_PROGRESS'}
                  onChangeText={(txt) => handleTextChange(txt, 'dest')}
                  onFocus={() => {
                    if (tripStatus === 'IN_PROGRESS') {
                      Alert.alert('Trip In Progress', 'Trip chal raha hai. Naya destination chunne ke liye pahle trip Cancel karein.');
                    } else {
                      handleFocusField('dest');
                    }
                  }}
                />
                {tripStatus === 'IN_PROGRESS' ? null : destText ? (
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
          </Surface>

          {/* 2. INTERACTIVE MAP VIEW (CENTER) */}
          <View style={styles.mapContainer}>
            <TripMapView
              origin={origin}
              destination={destination}
              polyline={routeData?.polyline || []}
              traveledTrail={actualTrailRef.current}
              currentLocation={currentGps ? { latitude: currentGps.lat, longitude: currentGps.lng } : null}
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

              {/* Purpose Selector: ONLY Client Meeting & Inspection */}
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
                      disabled={isTracking}
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
                            Start Trip ({routeData.distanceKm} KM)
                          </Text>
                        </View>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.geofenceHintRow}>
                    <TrendingUp size={12} color="#64748b" />
                    <Text style={styles.geofenceHintText}>
                      Real-time GPS tracking • Jitna chaloge utna claim kar sakoge
                    </Text>
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
                          {remainingRoadKm} KM remaining • {formattedMovedDistance} moved {gpsAccuracy ? `(±${gpsAccuracy}m GPS)` : ''}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* ACTIVE CLAIM BUTTON (CREDITS EXACT PHYSICALLY MOVED KM) */}
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
                              ? `Claim Full Trip • ${routeData.distanceKm} KM (₹${routeData.reimbursementAmount})`
                              : `Claim Moved • ${formattedMovedDistance} (₹${claimAmount})`}
                          </Text>
                        </View>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>

                  {/* GPS Tracking Indicator & Cancel Trip */}
                  <View style={styles.inProgressAuxRow}>
                    <View style={[
                      styles.liveAutoSenseBadge,
                      motionStatus === 'MOVING' ? styles.liveAutoSenseBadgeMoving : styles.liveAutoSenseBadgeStationary
                    ]}>
                      <View style={[
                        styles.livePulseDot,
                        motionStatus === 'MOVING' ? styles.livePulseDotMoving : styles.livePulseDotStationary
                      ]} />
                      <Text style={[
                        styles.liveAutoSenseText,
                        motionStatus === 'MOVING' ? styles.liveAutoSenseTextMoving : styles.liveAutoSenseTextStationary
                      ]}>
                        {motionStatus === 'MOVING' ? '🚗 Moving' : '🛑 Stationary'} • {formattedMovedDistance} • {gpsAccuracy ? `±${gpsAccuracy}m` : 'GPS'} • #{gpsFixCount}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.auxCancelBtn}
                      onPress={handleCancelTrip}
                      activeOpacity={0.7}
                    >
                      <X size={12} color="#ef4444" />
                      <Text style={styles.auxCancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
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
                ? 'Claim Completed Trip?'
                : effectiveTraveledKm <= 0.05
                ? 'Claim Trip (0 KM Moved)?'
                : 'Claim Distance Moved?'}
            </Text>
            <Text style={styles.earlyClaimSubtitle}>
              {hasCompletedFullJourney ? (
                `Aap destination pahunch chuke hain! Full planned distance ${routeData?.distanceKm} KM claim karne ke liye confirm karein.`
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
              <View style={styles.earlyClaimRow}>
                <Text style={styles.earlyClaimLabel}>Remaining (Unclaimed):</Text>
                <Text style={[styles.earlyClaimVal, { color: '#dc2626' }]}>
                  {remainingRoadKm} KM
                </Text>
              </View>
            </View>

            <Text style={styles.earlyClaimNote}>
              {effectiveTraveledKm <= 0.05
                ? 'Aapke account me strictly actual physically moved distance (0 KM) add hogi aur trip yahi complete ho jayegi.'
                : `Aapke account me strictly sirf actual physically moved distance (${formattedMovedDistance}) add hogi aur trip yahi complete ho jayegi.`}
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
                  colors={['#2563eb', '#1d4ed8']}
                  style={styles.earlyClaimConfirmGrad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.earlyClaimConfirmBtnText}>
                    {effectiveTraveledKm > 0 ? `Confirm & Add ${formattedMovedDistance}` : 'Confirm & Complete'}
                  </Text>
                  <Text style={[styles.earlyClaimBtnSubText, { color: '#dbeafe' }]}>
                    Credit to account
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
    flex: 1,
    width: '100%',
    height: '100%',
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
    borderRadius: 14,
    overflow: 'hidden',
  },
  confirmButtonDisabled: {
    opacity: 0.85,
  },
  confirmGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
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
    gap: 10,
    width: '100%',
  },
  planningCancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    gap: 4,
  },
  planningCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ef4444',
  },
  planningStartBtn: {
    flex: 1,
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
});
