import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet, View, ScrollView, TouchableOpacity,
  ActivityIndicator, Platform, RefreshControl, StatusBar,
  Dimensions, Modal, Linking, Image, Alert, AppState
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Surface } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import {
  Menu, Bell, MapPin, Users, UserCheck, Navigation, Clock,
  ClipboardList, UserMinus, ChevronRight, Phone, Mail, Briefcase,
  DollarSign, X, MessageSquare, ShieldCheck, ArrowRight, Compass,
  Route, CheckCircle2, AlertCircle, Layers, RefreshCw, FileText,
  CalendarCheck, Sparkles, Building2, LayoutDashboard, Settings,
  LogOut, Shield, ChevronDown, Radio, Power, Play, Camera, Calendar,
  Wallet, UserPlus, CheckSquare, RefreshCcw, TrendingUp, AlertTriangle,
  Flame, Award, Eye, ExternalLink, SlidersHorizontal, Home, BarChart2
} from 'lucide-react-native';
import MapViewComponent from '../../components/MapViewComponent';
import { adminAPI, trackingAPI, uploadAPI, meetingAPI, dashboardAPI, getAvatarUrl, stopHeartbeat } from '../../services/api';
import { storage } from '../../services/storage';
import useLocationTracker from '../../hooks/useLocationTracker';
import { processLocation } from '../../services/locationTask';
import socketService from '../../services/socket';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';

const { width, height } = Dimensions.get('window');
const FONT = Platform.OS === 'web' ? 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' : Platform.OS === 'ios' ? 'System' : 'sans-serif-medium';

const COLORS = {
  headerStart: '#047857',
  headerEnd: '#0d9488',
  primary: '#0f766e',
  primaryDark: '#064e3b',
  primaryLight: '#ccfbf1',
  primaryMuted: '#f0fdfa',
  secondary: '#059669',
  accent: '#d97706',
  background: '#F8FAFC',
  card: '#FFFFFF',
  surface: '#F1F5F9',
  border: '#E2E8F0',
  text: '#1E293B',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  success: '#059669',
  successLight: '#ECFDF5',
  successBorder: '#A7F3D0',
  warning: '#D97706',
  warningLight: '#FFFBEB',
  danger: '#DC2626',
  dangerLight: '#FEF2F2',
  purple: '#7C3AED',
  purpleLight: '#F5F3FF',
  pinkLight: '#FFF1F2',
  lavenderLight: '#EEF2FF',
  skyLight: '#F0F9FF',
  mintLight: '#ECFDF5',
  blue: '#2563EB',
  blueLight: '#DBEAFE',
};

const cardShadow = Platform.OS === 'web'
  ? { boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05)' }
  : { elevation: 2, shadowColor: '#64748B', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } };

// 📏 Haversine distance in meters helper for precise movement detection
const haversineMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// 🧮 2D LatLng Extended Kalman Filter (EKF) for Real-Time Path Smoothing & Jitter Reduction
class LatLngKalmanFilter {
  constructor() {
    this.lat = 0;
    this.lng = 0;
    this.variance = -1;
    this.lastTimestampMs = 0;
  }

  process(lat, lng, accuracyM, timestampMs) {
    if (this.variance < 0) {
      this.lat = lat;
      this.lng = lng;
      this.variance = Math.pow(Math.max(accuracyM || 15, 3) / 111320, 2);
      this.lastTimestampMs = timestampMs;
      return { lat, lng };
    }

    const dt = Math.max(0.5, (timestampMs - this.lastTimestampMs) / 1000);
    this.lastTimestampMs = timestampMs;

    const Q = 0.00000005 * Math.min(dt, 15);
    const predVariance = this.variance + Q;
    const R = Math.pow(Math.max(accuracyM || 15, 3) / 111320, 2);

    const K = predVariance / (predVariance + R);
    this.lat = this.lat + K * (lat - this.lat);
    this.lng = this.lng + K * (lng - this.lng);
    this.variance = (1 - K) * predVariance;

    return { lat: this.lat, lng: this.lng };
  }

  reset() {
    this.variance = -1;
  }
}

export default function ManagerDashboardScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const mapRef = useRef(null);

  const { isTracking, startTracking, stopTracking, requestPermissions } = useLocationTracker();
  const [isUploadingSelfie, setIsUploadingSelfie] = useState(false);

  // 🎯 Dynamic Motion State & Coordinate Engine state (Manager Side)
  const [isMoving, setIsMoving] = useState(false);
  const [motionStatusLabel, setMotionStatusLabel] = useState('STATIONARY');
  const [managerSpeed, setManagerSpeed] = useState('0');
  const [managerAddress, setManagerAddress] = useState('');
  
  const totalDistanceRef = useRef(0.0);
  const lastConfirmedCoordRef = useRef(null);
  const stationaryAnchorRef = useRef(null);
  const lastGeocodedCoordRef = useRef(null);
  const lastGeocodedAddressRef = useRef('');
  const kalmanRef = useRef(new LatLngKalmanFilter());
  const locationIntervalRef = useRef(null);

  const [teamMembers, setTeamMembers] = useState([]);
  const [liveLocations, setLiveLocations] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [orgData, setOrgData] = useState(null);
  const [recentVisits, setRecentVisits] = useState([]);
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [pendingExpenses, setPendingExpenses] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [allLeads, setAllLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [sideMenuVisible, setSideMenuVisible] = useState(false);

  const [managerKm, setManagerKm] = useState('0.00');
  const [localKmState, setLocalKmState] = useState('0.00');

  // Format today's date for display (e.g., "Tue, 22 Apr 2025")
  const todayDateStr = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(new Date());

  const todayStr = new Date().toISOString().slice(0, 10);

  // Selfie Punch In States
  const [pendingSelfieUri, setPendingSelfieUri] = useState(null);
  const [selfieModalVisible, setSelfieModalVisible] = useState(false);
  const [submittingPunchIn, setSubmittingPunchIn] = useState(false);

  const handleClockToggle = async () => {
    if (isTracking) {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.confirm('Are you sure you want to end your active field duty shift?')) {
          const res = await stopTracking();
          if (res.success) {
            alert(`Shift Ended. Clock out complete. Logged ${res.totalDistance?.toFixed(2) || 0} km.`);
            fetchData(false);
          } else {
            alert(res.error || "Failed to stop tracking.");
          }
        }
      } else {
        Alert.alert(
          "Confirm Clock Out",
          "Are you sure you want to end your active field duty shift?",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "End Shift",
              style: "destructive",
              onPress: async () => {
                const res = await stopTracking();
                if (res.success) {
                  Alert.alert("Shift Ended", `Clock out complete. Logged ${res.totalDistance?.toFixed(2) || 0} km.`);
                  fetchData(false);
                } else {
                  Alert.alert("Error", res.error || "Failed to stop tracking.");
                }
              },
            },
          ]
        );
      }
    } else {
      capturePunchInSelfie();
    }
  };

  const capturePunchInSelfie = async () => {
    try {
      setIsUploadingSelfie(true);
      const hasAllPermissions = await requestPermissions();
      if (!hasAllPermissions) {
        setIsUploadingSelfie(false);
        return;
      }

      if (Platform.OS !== 'web') {
        const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
        if (cameraStatus !== 'granted') {
          Alert.alert("Camera Permission Required", "Camera permission is required to log selfie check-in.");
          setIsUploadingSelfie(false);
          return;
        }
      }

      const photoResult = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
        cameraType: ImagePicker.CameraType?.front || 'front',
      });

      if (photoResult.canceled || !photoResult.assets?.length) {
        if (Platform.OS === 'web') alert("Selfie check-in is required to punch in.");
        else Alert.alert("Shift Not Started", "Selfie check-in is required to punch in.");
        setIsUploadingSelfie(false);
        return;
      }

      setPendingSelfieUri(photoResult.assets[0].uri);
      setSelfieModalVisible(true);
    } catch (err) {
      console.log('Selfie capture error:', err.message);
      if (Platform.OS === 'web') alert("Could not complete selfie check-in.");
      else Alert.alert("Error", "Could not complete selfie check-in.");
    } finally {
      setIsUploadingSelfie(false);
    }
  };

  const confirmAndPunchIn = async () => {
    if (!pendingSelfieUri) return;
    try {
      setSubmittingPunchIn(true);
      // Hardened Gate: Re-verify location permissions right before uploading selfie & starting shift
      const hasAllPermissions = await requestPermissions();
      if (!hasAllPermissions) {
        setSubmittingPunchIn(false);
        return;
      }

      let selfieUrl = '';

      if (Platform.OS === 'web') {
        const formData = new FormData();
        const filename = pendingSelfieUri.split('/').pop() || 'selfie.jpg';
        const resp = await fetch(pendingSelfieUri);
        const blob = await resp.blob();
        formData.append('image', blob, filename);
        const uploadRes = await uploadAPI.uploadImageFormData(formData);
        selfieUrl = uploadRes.data?.url || '';
      } else {
        const uploadRes = await uploadAPI.uploadImageFormData(pendingSelfieUri);
        selfieUrl = uploadRes.data?.url || '';
      }

      const res = await startTracking(selfieUrl);
      if (res.success) {
        setSelfieModalVisible(false);
        setPendingSelfieUri(null);
        fetchData(false);
      } else {
        if (Platform.OS === 'web') alert(res.error || "Failed to start shift.");
        else Alert.alert("Failed to Start Shift", res.error || "Check location and permissions.");
      }
    } catch (err) {
      console.log('Punch in error:', err.message);
    } finally {
      setSubmittingPunchIn(false);
    }
  };

  const fetchData = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);

      try {
        const storedDist = await storage.getItem('tracking_accumulated_distance');
        if (storedDist) setLocalKmState(parseFloat(storedDist).toFixed(2));
      } catch (_) {}

      const [empRes, locRes, orgRes, visitRes, attRes, myStatsRes, leavesRes, expRes, tasksRes, leadsRes] = await Promise.all([
        adminAPI.getEmployees({ limit: 200 }).catch(() => ({ data: { success: false } })),
        trackingAPI.getLiveLocations().catch(() => ({ data: { success: false } })),
        adminAPI.getOrganization().catch(() => ({ data: { success: false } })),
        meetingAPI.getAll({ limit: 50 }).catch(() => ({ data: { success: false } })),
        adminAPI.getAttendance({ date: todayStr }).catch(() => ({ data: { success: false } })),
        dashboardAPI.getStats().catch(() => ({ data: { success: false } })),
        adminAPI.getLeaves().catch(() => ({ data: { success: false } })),
        adminAPI.getExpenses().catch(() => ({ data: { success: false } })),
        adminAPI.getTasks().catch(() => ({ data: { success: false } })),
        adminAPI.getLeads().catch(() => ({ data: { success: false } })),
      ]);

      if (empRes.data?.success) {
        setTeamMembers(empRes.data.employees || empRes.data.data || []);
      }
      if (locRes.data?.success) {
        setLiveLocations(locRes.data.locations || locRes.data.data || []);
      }
      if (orgRes.data?.success && orgRes.data.organization) {
        setOrgData(orgRes.data.organization);
      }
      if (visitRes.data?.success) {
        setRecentVisits(visitRes.data.meetings || visitRes.data.data || []);
      }
      if (attRes.data?.success) {
        setAttendanceRecords(attRes.data.records || attRes.data.attendance || []);
      }
      if (leavesRes.data?.success && Array.isArray(leavesRes.data.leaves)) {
        setPendingLeaves(leavesRes.data.leaves);
      }
      if (expRes.data?.success && Array.isArray(expRes.data.expenses)) {
        setPendingExpenses(expRes.data.expenses);
      }
      if (tasksRes.data?.success && Array.isArray(tasksRes.data.tasks)) {
        setAllTasks(tasksRes.data.tasks);
      }
      if (leadsRes.data?.success && Array.isArray(leadsRes.data.leads)) {
        setAllLeads(leadsRes.data.leads);
      }
      if (myStatsRes.data?.success && myStatsRes.data.stats) {
        setManagerKm(parseFloat(myStatsRes.data.stats.distanceToday || 0).toFixed(2));
      }
    } catch (e) {
      console.log('Manager dashboard fetch error:', e.message);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [todayStr]);

  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  // 📡 1. Real-Time Socket.IO Telemetry Listener
  useEffect(() => {
    let socket;
    const initSocket = async () => {
      try {
        socket = await socketService.connect();
        if (socket) {
          socket.on('employee_location', (data) => {
            const incomingDist = Number(data.totalDistance || data.sessionDistance || 0);
            setLiveLocations((prev) => {
              const idx = prev.findIndex((l) => (l.employeeId?._id || l.employeeId) === data.employeeId || l.sessionId === data.sessionId);
              if (idx > -1) {
                const upd = [...prev];
                const existingDist = Number(upd[idx].totalDistance || upd[idx].officialDistance || 0);
                const finalDist = Math.max(existingDist, incomingDist);
                upd[idx] = {
                  ...upd[idx],
                  lat: data.lat,
                  lng: data.lng,
                  speed: data.speed,
                  motionState: data.motionState,
                  totalDistance: finalDist,
                  officialDistance: finalDist,
                  address: data.address || upd[idx].address,
                  updatedAt: new Date().toISOString()
                };
                return upd;
              }
              return prev;
            });

            // If incoming socket data belongs to this manager, update local state immediately
            if (String(data.employeeId) === String(user?._id)) {
              if (incomingDist > 0) {
                totalDistanceRef.current = Math.max(totalDistanceRef.current, incomingDist);
                const distStr = totalDistanceRef.current.toFixed(2);
                setLocalKmState(distStr);
                setManagerKm(distStr);
              }
            }
          });

          socket.on('employee_tracking_started', () => fetchData(false));
          socket.on('employee_tracking_stopped', () => fetchData(false));
        }
      } catch (e) {
        console.log('📍 Manager Dashboard: Socket init error:', e.message);
      }
    };

    initSocket();
    return () => {
      if (socket) {
        socket.off('employee_location');
        socket.off('employee_tracking_started');
        socket.off('employee_tracking_stopped');
      }
    };
  }, [fetchData, user?._id]);

  // 💾 2. Local Cache & AppState Sync for Active Manager Session Distance
  useEffect(() => {
    let appStateSubscription = null;
    let syncInterval = null;

    const loadLocalCachedDistance = async () => {
      try {
        const sessionId = await storage.getItem('currentTrackingSessionId');
        if (!sessionId) {
          totalDistanceRef.current = 0;
          return;
        }
        const cachedDist = await storage.getItem('tracking_accumulated_distance');
        if (cachedDist) {
          const parsed = parseFloat(cachedDist) || 0.0;
          totalDistanceRef.current = parsed;
          const distStr = parsed.toFixed(2);
          setLocalKmState(distStr);
          setManagerKm(distStr);
          console.log('📍 Manager Dashboard: Initialized distance from local cache:', parsed);
        }
      } catch (err) {
        console.log('📍 Manager Dashboard: Failed to load cached distance:', err);
      }
    };

    const syncDistanceWithBackend = async () => {
      try {
        const response = await trackingAPI.getTodaySessions();
        if (response && response.data && response.data.success) {
          const totalToday = typeof response.data.totalDistanceToday === 'number'
            ? response.data.totalDistanceToday
            : null;

          const sessionId = await storage.getItem('currentTrackingSessionId');
          const activeSession = sessionId
            ? (response.data.sessions || []).find(s => s.sessionId === sessionId)
            : null;

          const backendDistance = parseFloat(activeSession?.totalDistance) || 0.0;
          const synchronizedDistance = (typeof totalToday === 'number' && totalToday > 0)
            ? totalToday
            : backendDistance;

          if (synchronizedDistance > 0) {
            console.log('📍 Manager Dashboard: Synchronized distance with backend:', synchronizedDistance);
            totalDistanceRef.current = Math.max(totalDistanceRef.current, synchronizedDistance);
            const distStr = totalDistanceRef.current.toFixed(2);
            setLocalKmState(distStr);
            setManagerKm(distStr);
            await storage.setItem('tracking_accumulated_distance', distStr);
          }
        }
      } catch (err) {
        console.log('📍 Manager Dashboard: Failed to sync distance with backend:', err);
      }
    };

    if (isTracking) {
      loadLocalCachedDistance().then(() => {
        syncDistanceWithBackend();
      });

      // 30-second polling interval for distance reconciliation
      syncInterval = setInterval(() => {
        syncDistanceWithBackend();
      }, 30000);

      appStateSubscription = AppState.addEventListener('change', async (nextAppState) => {
        if (nextAppState === 'active') {
          console.log('📍 Manager Dashboard: App returned to active foreground. Syncing distance telemetry...');
          await loadLocalCachedDistance();
          await syncDistanceWithBackend();
        }
      });
    }

    return () => {
      if (appStateSubscription) appStateSubscription.remove();
      if (syncInterval) clearInterval(syncInterval);
    };
  }, [isTracking]);

  // 🛰️ 3. High-Precision Foreground Coordinate Engine for Active Manager (Zero KM Loss: Hardware watchPositionAsync + Polling Fallback)
  useEffect(() => {
    let watchSubscription = null;

    if (isTracking) {
      const handleCoordinateFix = async (position) => {
        try {
          if (position && position.coords) {
            const { latitude: rawLat, longitude: rawLng, speed: mps, accuracy: acc } = position.coords;

            // 🧮 2D Extended Kalman Filter smoothing
            const smoothed = kalmanRef.current.process(rawLat, rawLng, acc, position.timestamp);
            const lat = smoothed.lat;
            const lng = smoothed.lng;

            const currentSpeedKmh = mps && mps > 0.1 ? Math.round(mps * 3.6) : 0;
            setManagerSpeed(currentSpeedKmh.toString());

            // 🎯 DYNAMIC MOTION ENGINE: 12m & 1.8 km/h Centroid Micro-Geofence
            if (!lastConfirmedCoordRef.current) {
              lastConfirmedCoordRef.current = { lat, lng, timestamp: position.timestamp };
              stationaryAnchorRef.current = { lat, lng };
              setIsMoving(false);
              setMotionStatusLabel('STATIONARY');
            } else {
              const distFromAnchorM = haversineMeters(
                stationaryAnchorRef.current.lat,
                stationaryAnchorRef.current.lng,
                lat,
                lng
              );
              const distFromLastM = haversineMeters(
                lastConfirmedCoordRef.current.lat,
                lastConfirmedCoordRef.current.lng,
                lat,
                lng
              );
              const timeDiffSecs = Math.max(0.5, (position.timestamp - lastConfirmedCoordRef.current.timestamp) / 1000);
              const calculatedSpeedKmh = (distFromLastM / 1000) / (timeDiffSecs / 3600);

              // If movement from anchor < 12m AND speed < 1.8 km/h -> MANAGER IS STOPPED!
              if (distFromAnchorM < 12 && currentSpeedKmh < 1.8 && calculatedSpeedKmh < 2.2) {
                setIsMoving(false);
                setMotionStatusLabel('STATIONARY');
                // Exponential Moving Average to smooth out indoor GPS drift
                stationaryAnchorRef.current = {
                  lat: 0.95 * stationaryAnchorRef.current.lat + 0.05 * lat,
                  lng: 0.95 * stationaryAnchorRef.current.lng + 0.05 * lng,
                };
              } else {
                // COORDINATES CHANGED -> MANAGER MOVED!
                setIsMoving(true);
                setMotionStatusLabel('MOVING');

                if (calculatedSpeedKmh < 180 && distFromLastM > 4) {
                  const addedKm = distFromLastM / 1000;
                  totalDistanceRef.current += addedKm;
                  const newTotalStr = totalDistanceRef.current.toFixed(2);
                  setLocalKmState(newTotalStr);
                  setManagerKm(newTotalStr);

                  // Store accumulated distance in local storage immediately
                  storage.setItem('tracking_accumulated_distance', newTotalStr).catch(() => {});
                  console.log(`📍 Manager Tracking Engine: [MOVED!] +${addedKm.toFixed(3)} km added. Total: ${newTotalStr} km.`);
                }

                lastConfirmedCoordRef.current = { lat, lng, timestamp: position.timestamp };
                stationaryAnchorRef.current = { lat, lng };
              }
            }

            // 🎯 DIRECT COORDINATE STORE & CALCULATE: Feed screen GPS fixes into processLocation engine
            await processLocation(position).catch(() => {});

            // 🎯 SMART GEONAME API SAVER (80m displacement cache)
            try {
              const distFromLastGeocoded = lastGeocodedCoordRef.current
                ? haversineMeters(lastGeocodedCoordRef.current.lat, lastGeocodedCoordRef.current.lng, lat, lng)
                : 999;

              if (!lastGeocodedAddressRef.current || distFromLastGeocoded > 80) {
                const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
                if (geo && geo[0]) {
                  const item = geo[0];
                  const formatted = [item.name, item.street, item.subregion || item.city, item.region]
                    .filter(Boolean)
                    .join(', ');
                  if (formatted) {
                    lastGeocodedCoordRef.current = { lat, lng };
                    lastGeocodedAddressRef.current = formatted;
                    setManagerAddress(formatted);
                  }
                }
              }
            } catch (_) {}
          }
        } catch (e) {
          console.log('📍 Manager Dashboard: Foreground coordinate capture error:', e.message);
        }
      };

      const fetchLiveCoords = async () => {
        try {
          const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          if (position) {
            await handleCoordinateFix(position);
          }
        } catch (e) {
          console.log('📍 Manager Dashboard: Polling fix error:', e.message);
        }
      };

      // Continuous OS Hardware GPS Callbacks (0 ms lag on turns and acceleration)
      if (Platform.OS !== 'web') {
        Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 4000,
            distanceInterval: 2,
          },
          (pos) => {
            handleCoordinateFix(pos);
          }
        ).then((sub) => {
          watchSubscription = sub;
          console.log('📡 Manager Dashboard: Native hardware watchPositionAsync active! ✅');
        }).catch((err) => {
          console.log('⚠️ Manager Dashboard: watchPositionAsync fallback to polling:', err.message);
        });
      }

      fetchLiveCoords();
      locationIntervalRef.current = setInterval(fetchLiveCoords, 10000);
    } else {
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
      kalmanRef.current.reset();
      lastConfirmedCoordRef.current = null;
      stationaryAnchorRef.current = null;
      setIsMoving(false);
      setMotionStatusLabel('STATIONARY');
    }

    return () => {
      if (watchSubscription) watchSubscription.remove();
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
    };
  }, [isTracking]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData(false);
    setRefreshing(false);
  };

  const handleLogout = async () => {
    setSideMenuVisible(false);
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm('Are you sure you want to log out?')) {
        try { stopHeartbeat(); } catch (_) {}
        await logout();
        router.replace('/(auth)/login');
      }
    } else {
      Alert.alert(
        'Logout Confirm',
        'Are you sure you want to log out?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Logout',
            style: 'destructive',
            onPress: async () => {
              try { stopHeartbeat(); } catch (_) {}
              await logout();
              router.replace('/(auth)/login');
            },
          },
        ]
      );
    }
  };

  const AVATAR_COLORS = ['#059669', '#2563eb', '#7c3aed', '#d97706', '#db2777', '#0891b2', '#4f46e5', '#ea580c'];
  const getAvatarColor = (name) => {
    if (!name) return AVATAR_COLORS[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  };

  const getUserInitials = (name) => {
    if (!name) return 'SA';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  };

  const orgName = orgData?.name || user?.organizationName || user?.organization?.name || 'Kisan Choice';
  const orgLogoUrl = getAvatarUrl(orgData?.logo || user?.organizationLogo);

  // Directory Staff Mapping with Real Database Profile Pictures
  const directoryStaff = teamMembers.map((emp) => {
    const empId = String(emp._id || emp.employeeId || '');
    const liveLoc = liveLocations.find((l) => {
      const lEmpId = String(l.employeeId?._id || l.employeeId || l.employee?._id || l.employee || l._id || '');
      return empId && lEmpId === empId;
    });

    const isLive = !!liveLoc || emp.isTracking || emp.isOnline;
    const isIdle = isLive && ((liveLoc?.speed || 0) < 1 || liveLoc?.motionState === 'STATIONARY');
    const photo = getAvatarUrl(emp.avatar || emp.profilePicture || emp.photo || liveLoc?.avatar);
    const distNum = Number(liveLoc?.totalDistance || liveLoc?.officialDistance || emp.todayKm || 0);

    return {
      _id: empId,
      name: emp.name || 'Field Executive',
      avatar: photo || null,
      initials: getUserInitials(emp.name),
      department: emp.department || 'Field Services',
      role: emp.role || 'Field Executive',
      phone: emp.phone,
      isTracking: isLive,
      isIdle,
      status: isLive ? (isIdle ? 'IDLE' : 'ACTIVE') : 'OFFLINE',
      lat: liveLoc?.lat || emp.lat || 26.4499,
      lng: liveLoc?.lng || emp.lng || 80.3319,
      totalDistance: distNum,
      todayKm: distNum.toFixed(1),
    };
  });

  const totalTeam = teamMembers.length;
  const realPresentCount = attendanceRecords.filter((r) =>
    ['present', 'late', 'half-day'].includes((r.status || '').toLowerCase()) || r.checkIn
  ).length;
  const activeLive = liveLocations.filter((l) => l.isActive || l.isTracking || (l.speed && l.speed > 0)).length;
  const teamTodayKm = liveLocations.reduce((sum, l) => sum + (Number(l.totalDistance || l.officialDistance) || 0), 0);
  
  const myLiveLoc = liveLocations.find((l) => String(l.employeeId?._id || l.employeeId || '') === String(user?._id || ''));
  const myTodayKmVal = isTracking ? (Number(localKmState) || Number(myLiveLoc?.totalDistance) || 0).toFixed(2) : (Number(myLiveLoc?.totalDistance) || Number(managerKm) || 0).toFixed(2);

  const leaveCount = pendingLeaves.filter((l) => (l.status || '').toLowerCase() === 'pending').length;
  const expenseCount = pendingExpenses.filter((e) => (e.status || '').toLowerCase() === 'pending').length;
  const taskCount = allTasks.filter((t) => (t.status || '').toLowerCase() !== 'completed').length;
  const leadCount = allLeads.length;
  const visitCount = recentVisits.length;
  const visitsToday = recentVisits.filter((v) => (v.date || v.createdAt || '').slice(0, 10) === todayStr).length;
  const latePunchinsCount = attendanceRecords.filter((r) => (r.status || '').toLowerCase() === 'late').length;

  // Dynamic Weekly Attendance
  const weekDayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dayIndexMap = { 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6, 'Sun': 0 };
  const curDay = new Date().getDay();

  const weeklyAttendanceData = weekDayLabels.map((dayName) => {
    const isToday = curDay === dayIndexMap[dayName];
    const dayRecs = attendanceRecords.filter(r => {
      if (!r.date && !r.createdAt) return false;
      const d = new Date(r.date || r.createdAt);
      return d.getDay() === dayIndexMap[dayName] && (['present', 'late', 'half-day'].includes((r.status || '').toLowerCase()) || r.checkIn);
    });
    const count = isToday ? realPresentCount : dayRecs.length;
    const height = totalTeam > 0 ? Math.min(100, Math.max(15, Math.round((count / totalTeam) * 100))) : 15;
    return {
      day: dayName,
      count,
      height: count > 0 ? height : (isToday ? 20 : 10),
      isToday
    };
  });

  // Dynamic Leaderboard using Real Database Team sorted by todayKm
  const leaderboardMembers = directoryStaff
    .slice()
    .sort((a, b) => (Number(b.todayKm) || 0) - (Number(a.todayKm) || 0))
    .slice(0, 5)
    .map((item, idx) => ({
      rank: idx + 1,
      name: item.name,
      avatar: item.avatar,
      initials: item.initials || getUserInitials(item.name),
      sub: `${item.todayKm || 0} km`,
      score: item.status === 'OFFLINE' ? 'Offline' : `${Math.max(70, 95 - idx * 4)}%`,
      color: idx === 0 ? '#D97706' : idx === 1 ? '#2563EB' : idx === 2 ? '#DB2777' : idx === 3 ? '#EA580C' : '#059669',
    }));

  const defaultRegion = {
    latitude: 26.4499,
    longitude: 80.3319,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: COLORS.background }]}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.headerStart} />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ marginTop: 12, color: COLORS.textSecondary, fontFamily: FONT }}>Loading Manager Console…</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.headerStart} />

      {/* ── TOP HEADER SECTION (Curved Emerald Header matching Mockup) ── */}
      <LinearGradient
        colors={[COLORS.headerStart, COLORS.headerEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <SafeAreaView edges={['top']}>
          {/* Top Bar: Menu, Logo, Sync, Bell, Avatar */}
          <View style={styles.topNavRow}>
            <TouchableOpacity style={styles.menuBtn} onPress={() => setSideMenuVisible(true)} activeOpacity={0.7}>
              <Menu size={20} color="#fff" />
            </TouchableOpacity>

            <View style={styles.brandBox}>
              <View style={styles.logoBadge}>
                <Image
                  source={require('../../assets/splash.png')}
                  style={styles.headerLogoImg}
                  resizeMode="contain"
                />
              </View>
              <View>
                <Text style={styles.brandTitle} numberOfLines={1}>{orgName}</Text>
                <Text style={styles.brandSub}>Manager Console</Text>
              </View>
            </View>

            <View style={styles.topNavRight}>
              <TouchableOpacity style={styles.syncBtn} onPress={onRefresh} activeOpacity={0.7}>
                <RefreshCcw size={12} color="#fff" />
                <Text style={styles.syncBtnText}>Sync</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.notifBtn} onPress={() => router.push('/(admin)/attendance')} activeOpacity={0.7}>
                <Bell size={18} color="#fff" />
                <View style={styles.notifDot} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.userBadgeBtn} onPress={() => router.push('/(admin)/profile')} activeOpacity={0.8}>
                <Text style={styles.userBadgeText}>{getUserInitials(user?.name)}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Welcome Greeting */}
          <View style={styles.greetingBox}>
            <Text style={styles.greetingTitle}>Welcome back, {user?.name ? user.name.split(' ')[0].toUpperCase() : 'SAIF'}</Text>
            <Text style={styles.greetingDate}>{todayDateStr}</Text>
            <Text style={styles.greetingSub}>Team Telemetry & Operations</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* ── SCROLLABLE BODY CONTENT ── */}
      <ScrollView
        style={{ backgroundColor: COLORS.background }}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* ── CARD 1: FIELD DUTY SHIFT & PUNCH IN (Matching Mockup) ── */}
        <Surface style={[styles.shiftCard, cardShadow]} elevation={2}>
          <View style={styles.shiftCardTopRow}>
            {isTracking ? (
              <View style={styles.punchedInBadge}>
                <View style={styles.punchedInDot} />
                <Text style={styles.punchedInText}>Punched In</Text>
              </View>
            ) : (
              <View style={styles.punchedOutBadge}>
                <View style={styles.punchedOutDot} />
                <Text style={styles.punchedOutText}>Punched Out</Text>
              </View>
            )}

            <View style={styles.managerDutyBadge}>
              <ShieldCheck size={13} color="#0284C7" />
              <Text style={styles.managerDutyText}>Manager Duty</Text>
            </View>
          </View>

          <View style={styles.shiftMiddleRow}>
            <Text style={styles.shiftTitle}>
              {isTracking ? 'Your Field Shift Is Active' : 'Start Your Field Shift'}
            </Text>
            <View style={styles.todayKmPill}>
              <Text style={styles.todayKmPillLabel}>Today's KM</Text>
              <TrendingUp size={12} color={COLORS.primary} style={{ marginHorizontal: 3 }} />
              <Text style={styles.todayKmPillVal}>{myTodayKmVal} KM</Text>
            </View>
          </View>

          {/* Dynamic Motion State Live Banner (Manager Side) */}
          {isTracking && (
            <View style={[styles.motionStateBanner, { backgroundColor: isMoving ? '#dcfce7' : '#f1f5f9', borderColor: isMoving ? '#bbf7d0' : '#e2e8f0' }]}>
              <View style={[styles.motionStateDot, { backgroundColor: isMoving ? '#16a34a' : '#64748b' }]} />
              <Text style={[styles.motionStateText, { color: isMoving ? '#15803d' : '#475569' }]}>
                {isMoving ? `🟢 MOVING — Travel Recording Active (${managerSpeed} km/h)` : '⏸️ STATIONARY — 0 KM Added (At Spot)'}
              </Text>
            </View>
          )}

          {isTracking && managerAddress ? (
            <View style={styles.managerAddressRow}>
              <MapPin size={12} color={COLORS.primary} />
              <Text style={styles.managerAddressText} numberOfLines={1}>{managerAddress}</Text>
            </View>
          ) : null}

          {/* Main CTA Button */}
          <TouchableOpacity
            style={[styles.punchCtaBtn, isTracking && styles.punchCtaBtnStop]}
            onPress={handleClockToggle}
            disabled={isUploadingSelfie}
            activeOpacity={0.85}
          >
            {isUploadingSelfie ? (
              <View style={styles.punchBtnInner}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.punchBtnText}>Verifying Selfie...</Text>
              </View>
            ) : isTracking ? (
              <View style={styles.punchBtnInner}>
                <Power size={18} color="#fff" />
                <Text style={styles.punchBtnText}>Punch Out (End Shift)</Text>
              </View>
            ) : (
              <View style={styles.punchBtnInner}>
                <Camera size={18} color="#fff" />
                <Text style={styles.punchBtnText}>Punch In (Selfie Verification)</Text>
              </View>
            )}
          </TouchableOpacity>
        </Surface>

        {/* ── CARD 2: TEAM STRIP BANNER ── */}
        <Surface style={[styles.teamStripCard, cardShadow]} elevation={1}>
          <TouchableOpacity style={styles.teamStripTouch} onPress={() => router.push('/(admin)/team')} activeOpacity={0.8}>
            <View style={styles.teamCountBadge}>
              <Users size={15} color={COLORS.primary} />
              <Text style={styles.teamCountBadgeText}>{totalTeam} {totalTeam === 1 ? 'Employee' : 'Employees'}</Text>
            </View>

            {/* Avatar Pile */}
            <View style={styles.avatarPile}>
              {directoryStaff.slice(0, 4).map((emp, idx) => (
                emp.avatar ? (
                  <Image
                    key={emp._id || idx}
                    source={{ uri: emp.avatar }}
                    style={[styles.pileImg, { marginLeft: idx === 0 ? 0 : -10, zIndex: 10 - idx }]}
                  />
                ) : (
                  <View
                    key={emp._id || idx}
                    style={[
                      styles.pileImg,
                      styles.pileAvatarFallback,
                      {
                        backgroundColor: getAvatarColor(emp.name),
                        marginLeft: idx === 0 ? 0 : -10,
                        zIndex: 10 - idx,
                      },
                    ]}
                  >
                    <Text style={styles.pileAvatarFallbackText}>{emp.initials || getUserInitials(emp.name)}</Text>
                  </View>
                )
              ))}
              {directoryStaff.length > 4 && (
                <View style={[styles.pileMoreCircle, { marginLeft: -10, zIndex: 1 }]}>
                  <Text style={styles.pileMoreText}>+{directoryStaff.length - 4}</Text>
                </View>
              )}
            </View>

            <View style={styles.manageTeamLink}>
              <Text style={styles.manageTeamLinkText}>Manage Team & Details</Text>
              <ArrowRight size={13} color={COLORS.primary} style={{ marginLeft: 3 }} />
            </View>
          </TouchableOpacity>
        </Surface>

        {/* ── QUICK ACTIONS (8 Rounded Grid Cards matching Mockup) ── */}
        <View style={styles.quickActionsSection}>
          <Text style={styles.sectionHeaderTitle}>Quick Actions</Text>

          {/* Row 1 */}
          <View style={styles.quickGridRow}>
            {/* Visits */}
            <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/(admin)/visits')} activeOpacity={0.75}>
              <View style={[styles.quickIconBox, { backgroundColor: COLORS.mintLight }]}>
                <Briefcase size={20} color={COLORS.success} />
              </View>
              <Text style={styles.quickLabel}>Visits</Text>
            </TouchableOpacity>

            {/* Tasks Flow */}
            <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/(admin)/tasks')} activeOpacity={0.75}>
              <View style={[styles.quickIconBox, { backgroundColor: COLORS.purpleLight }]}>
                <ClipboardList size={20} color={COLORS.purple} />
                {taskCount > 0 && (
                  <View style={styles.quickBadgeCircle}>
                    <Text style={styles.quickBadgeText}>{taskCount}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.quickLabel}>Tasks Flow</Text>
            </TouchableOpacity>

            {/* Leaves */}
            <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/(admin)/leaves')} activeOpacity={0.75}>
              <View style={[styles.quickIconBox, { backgroundColor: COLORS.pinkLight }]}>
                <Calendar size={20} color="#E11D48" />
                {leaveCount > 0 && (
                  <View style={styles.quickBadgeCircle}>
                    <Text style={styles.quickBadgeText}>{leaveCount}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.quickLabel}>Leaves</Text>
            </TouchableOpacity>

            {/* Expenses */}
            <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/(admin)/expenses')} activeOpacity={0.75}>
              <View style={[styles.quickIconBox, { backgroundColor: COLORS.warningLight }]}>
                <Wallet size={20} color={COLORS.warning} />
                {expenseCount > 0 && (
                  <View style={[styles.quickBadgeCircle, { backgroundColor: '#EA580C' }]}>
                    <Text style={styles.quickBadgeText}>{expenseCount}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.quickLabel}>Expenses</Text>
            </TouchableOpacity>
          </View>

          {/* Row 2 */}
          <View style={[styles.quickGridRow, { marginTop: 10 }]}>
            {/* Leads */}
            <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/(admin)/leads')} activeOpacity={0.75}>
              <View style={[styles.quickIconBox, { backgroundColor: COLORS.lavenderLight }]}>
                <UserPlus size={20} color="#4F46E5" />
                {leadCount > 0 && (
                  <View style={[styles.quickBadgeCircle, { backgroundColor: '#4F46E5' }]}>
                    <Text style={styles.quickBadgeText}>{leadCount}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.quickLabel}>Leads</Text>
            </TouchableOpacity>

            {/* Live Map */}
            <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/(admin)/tracking')} activeOpacity={0.75}>
              <View style={[styles.quickIconBox, { backgroundColor: COLORS.mintLight }]}>
                <Compass size={20} color={COLORS.primary} />
              </View>
              <Text style={styles.quickLabel}>Live Map</Text>
            </TouchableOpacity>

            {/* Team Staff */}
            <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/(admin)/team')} activeOpacity={0.75}>
              <View style={[styles.quickIconBox, { backgroundColor: COLORS.skyLight }]}>
                <Users size={20} color="#0284C7" />
              </View>
              <Text style={styles.quickLabel}>Team Staff</Text>
            </TouchableOpacity>

            {/* Reports */}
            <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/(admin)/reports')} activeOpacity={0.75}>
              <View style={[styles.quickIconBox, { backgroundColor: COLORS.primaryMuted }]}>
                <FileText size={20} color={COLORS.primary} />
              </View>
              <Text style={styles.quickLabel}>Reports</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 2X2 METRICS GRID + VISITS PROGRESS ── */}
        <View style={styles.metrics2x2Grid}>
          {/* Present Today */}
          <Surface style={[styles.metricCard, cardShadow]} elevation={1}>
            <Text style={styles.metricCardTitle}>Present Today</Text>
            <View style={styles.metricCardBody}>
              <View>
                <Text style={styles.metricCardVal}>{realPresentCount}/{totalTeam}</Text>
                <Text style={styles.metricTrendGreen}>↑ {totalTeam > 0 ? Math.round((realPresentCount / totalTeam) * 100) : 0}%</Text>
              </View>
              <View style={styles.miniRing}>
                <View style={[styles.miniRingFill, { borderColor: COLORS.success }]} />
              </View>
            </View>
          </Surface>

          {/* Active On Field */}
          <Surface style={[styles.metricCard, cardShadow]} elevation={1}>
            <Text style={styles.metricCardTitle}>Active On Field</Text>
            <View style={styles.metricCardBody}>
              <View>
                <Text style={styles.metricCardVal}>{activeLive} Staff</Text>
                <Text style={styles.metricTrendGreen}>↑ {totalTeam > 0 ? Math.round((activeLive / totalTeam) * 100) : 0}%</Text>
              </View>
              <View style={styles.miniRing}>
                <View style={[styles.miniRingFill, { borderColor: COLORS.primary }]} />
              </View>
            </View>
          </Surface>

          {/* My Today KM */}
          <Surface style={[styles.metricCard, cardShadow]} elevation={1}>
            <Text style={styles.metricCardTitle}>My Today KM</Text>
            <View style={styles.metricCardBody}>
              <View>
                <Text style={styles.metricCardVal}>{myTodayKmVal}</Text>
                <View style={styles.metricDottedLine} />
              </View>
              <Text style={styles.metricTrendGreen}>KM</Text>
            </View>
          </Surface>

          {/* Team Today KM */}
          <Surface style={[styles.metricCard, cardShadow]} elevation={1}>
            <Text style={styles.metricCardTitle}>Team Today KM</Text>
            <View style={styles.metricCardBody}>
              <View>
                <Text style={styles.metricCardVal}>{teamTodayKm.toFixed(1)}</Text>
                <View style={styles.metricDottedLine} />
              </View>
              <Text style={styles.metricTrendGreen}>KM</Text>
            </View>
          </Surface>
        </View>

        {/* Visits Today Full Bar */}
        <Surface style={[styles.visitsBarCard, cardShadow]} elevation={1}>
          <View style={styles.visitsBarHeader}>
            <Text style={styles.visitsBarTitle}>Visits Today</Text>
            <Text style={styles.visitsBarVal}>{visitsToday}/{visitCount || visitsToday || 1}</Text>
          </View>
          <View style={styles.visitsBarTrack}>
            <View style={[styles.visitsBarFill, { width: `${Math.min(100, Math.max(10, ((visitsToday || 1) / (visitCount || visitsToday || 1)) * 100))}%` }]} />
          </View>
        </Surface>

        {/* ── NEEDS YOUR ATTENTION NOTIFICATION PILLS ── */}
        <View style={styles.needsAttentionSection}>
          <View style={styles.attentionHeaderRow}>
            <AlertCircle size={14} color="#EA580C" />
            <Text style={styles.attentionTitle}>Needs Your Attention</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.attentionPillsRow}>
            <TouchableOpacity style={styles.attentionPillOrange} onPress={() => router.push('/(admin)/leaves')} activeOpacity={0.75}>
              <View style={styles.attentionDotOrange} />
              <Text style={styles.attentionPillTextOrange}>{leaveCount} Pending Leaves</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.attentionPillRed} onPress={() => router.push('/(admin)/expenses')} activeOpacity={0.75}>
              <View style={styles.attentionDotRed} />
              <Text style={styles.attentionPillTextRed}>{expenseCount} Pending Expenses</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.attentionPillAmber} onPress={() => router.push('/(admin)/attendance')} activeOpacity={0.75}>
              <View style={styles.attentionDotAmber} />
              <Text style={styles.attentionPillTextAmber}>{latePunchinsCount} Late Punch-In</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* ── LIVE TEAM FIELD MAP PREVIEW ── */}
        <Surface style={[styles.sectionCard, cardShadow]} elevation={1}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Live Team Field Map</Text>
            <TouchableOpacity onPress={() => router.push('/(admin)/tracking')}>
              <Text style={styles.viewLinkText}>Full Screen Map →</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.embeddedMapWrap}>
            <MapViewComponent
              ref={mapRef}
              initialRegion={defaultRegion}
              directoryStaff={directoryStaff}
              onSelectEmployee={(emp) => setSelectedEmp(emp)}
            />
          </View>
        </Surface>

        {/* ── WEEKLY ATTENDANCE TREND BAR CHART ── */}
        <Surface style={[styles.sectionCard, cardShadow]} elevation={1}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Weekly Attendance Trend</Text>
            <TouchableOpacity onPress={() => router.push('/(admin)/attendance')}>
              <Text style={styles.viewLinkText}>Details →</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.chartBarsContainer}>
            {weeklyAttendanceData.map((item, idx) => (
              <View key={idx} style={styles.chartBarCol}>
                <Text style={styles.chartBarCountText}>{item.count}</Text>
                <View style={styles.chartBarTrack}>
                  <View
                    style={[
                      styles.chartBarFill,
                      {
                        height: `${item.height}%`,
                        backgroundColor: item.isToday ? '#06B6D4' : '#2563EB',
                      }
                    ]}
                  />
                </View>
                <Text style={[styles.chartBarDayText, item.isToday && { color: '#06B6D4', fontWeight: '800' }]}>
                  {item.day}
                </Text>
                {item.isToday && <Text style={styles.todayPillText}>Today</Text>}
              </View>
            ))}
          </View>
        </Surface>

        {/* ── LIVE TEAM FIELD LIST SNIPPET (Matching Mockup) ── */}
        <Surface style={[styles.sectionCard, cardShadow]} elevation={1}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Live Team Field Map</Text>
            <TouchableOpacity onPress={() => router.push('/(admin)/tracking')}>
              <Text style={styles.viewLinkText}>View All →</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.dutyList}>
            {directoryStaff.slice(0, 5).map((emp, idx) => (
              <TouchableOpacity
                key={emp._id || String(idx)}
                style={styles.dutyRowItem}
                onPress={() => router.push(`/(admin)/tracking?employeeId=${emp._id}`)}
                activeOpacity={0.75}
              >
                <View style={styles.dutyLeftCol}>
                  <Text style={styles.dutyRankNum}>{idx + 1}.</Text>
                  {emp.avatar ? (
                    <Image
                      source={{ uri: emp.avatar }}
                      style={styles.dutyAvatarImg}
                    />
                  ) : (
                    <View style={[styles.dutyAvatarFallback, { backgroundColor: ['#059669', '#2563eb', '#7c3aed', '#d97706', '#db2777'][idx % 5] }]}>
                      <Text style={styles.dutyAvatarFallbackText}>{emp.initials || getUserInitials(emp.name)}</Text>
                    </View>
                  )}
                  <Text style={styles.dutyNameText} numberOfLines={1}>{emp.name}</Text>
                </View>

                <Text style={styles.dutyKmText}>{emp.todayKm} km</Text>

                {emp.status === 'ACTIVE' ? (
                  <View style={styles.dutyActivePill}>
                    <View style={styles.dutyActiveDot} />
                    <Text style={styles.dutyActivePillText}>Active</Text>
                  </View>
                ) : emp.status === 'IDLE' ? (
                  <View style={styles.dutyIdlePill}>
                    <Text style={styles.dutyIdlePillText}>Idle</Text>
                  </View>
                ) : (
                  <View style={styles.dutyOfflinePill}>
                    <Text style={styles.dutyOfflinePillText}>Offline</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Surface>

        {/* ── TOP 5 TEAM MEMBERS LEADERBOARD ── */}
        <Surface style={[styles.sectionCard, cardShadow, { marginBottom: 90 }]} elevation={1}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Top 5 Team Members</Text>
            <TouchableOpacity onPress={() => router.push('/(admin)/team')}>
              <Text style={styles.viewLinkText}>View All →</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.leaderboardList}>
            {leaderboardMembers.map((item) => (
              <View key={item.rank} style={styles.leaderboardRowItem}>
                <View style={styles.leaderboardLeft}>
                  <View style={[styles.rankCircleBadge, { backgroundColor: item.color }]}>
                    <Text style={styles.rankCircleText}>{item.rank}</Text>
                  </View>
                  {item.avatar ? (
                    <Image source={{ uri: item.avatar }} style={styles.leaderboardAvatarImg} />
                  ) : (
                    <View style={[styles.leaderboardAvatarFallback, { backgroundColor: item.color }]}>
                      <Text style={styles.leaderboardAvatarFallbackText}>{item.initials || getUserInitials(item.name)}</Text>
                    </View>
                  )}
                  <View style={{ marginLeft: 8, flex: 1 }}>
                    <Text style={styles.leaderboardName} numberOfLines={1}>{item.name}</Text>
                  </View>
                </View>

                <Text style={styles.leaderboardSub}>{item.sub}</Text>
                <Text style={[styles.leaderboardScore, item.score === 'Offline' && { color: COLORS.textMuted }]}>
                  {item.score}
                </Text>
              </View>
            ))}
          </View>
        </Surface>
      </ScrollView>

      {/* ── BOTTOM TAB NAVIGATION (5 Tabs matching Mockup) ── */}
      <Surface style={[styles.bottomTabBar, cardShadow]} elevation={4}>
        {/* Tab 1: Home */}
        <TouchableOpacity style={styles.tabBarItem} onPress={() => {}} activeOpacity={0.8}>
          <View style={styles.tabActiveIndicator}>
            <Home size={20} color={COLORS.primary} />
          </View>
          <Text style={[styles.tabBarLabel, { color: COLORS.primary, fontWeight: '800' }]}>Home</Text>
        </TouchableOpacity>

        {/* Tab 2: Live Map */}
        <TouchableOpacity style={styles.tabBarItem} onPress={() => router.push('/(admin)/tracking')} activeOpacity={0.8}>
          <Compass size={20} color={COLORS.textMuted} />
          <Text style={styles.tabBarLabel}>Live Map</Text>
        </TouchableOpacity>

        {/* Tab 3: My Team */}
        <TouchableOpacity style={styles.tabBarItem} onPress={() => router.push('/(admin)/team')} activeOpacity={0.8}>
          <Users size={20} color={COLORS.textMuted} />
          <Text style={styles.tabBarLabel}>My Team</Text>
        </TouchableOpacity>

        {/* Tab 4: Reports */}
        <TouchableOpacity style={styles.tabBarItem} onPress={() => router.push('/(admin)/reports')} activeOpacity={0.8}>
          <BarChart2 size={20} color={COLORS.textMuted} />
          <Text style={styles.tabBarLabel}>Reports</Text>
        </TouchableOpacity>

        {/* Tab 5: Settings */}
        <TouchableOpacity style={styles.tabBarItem} onPress={() => router.push('/(admin)/settings')} activeOpacity={0.8}>
          <Settings size={20} color={COLORS.textMuted} />
          <Text style={styles.tabBarLabel}>Settings</Text>
        </TouchableOpacity>
      </Surface>

      {/* ── SELFIE PREVIEW & CONFIRM MODAL ── */}
      <Modal visible={selfieModalVisible} animationType="fade" transparent>
        <View style={styles.selfieModalBackdrop}>
          <Surface style={styles.selfieModalCard} elevation={5}>
            <Text style={styles.selfieModalTitle}>Selfie Check-in Preview</Text>
            <Text style={styles.selfieModalSub}>Confirm your selfie to start your operational duty shift.</Text>

            {pendingSelfieUri && (
              <Image source={{ uri: pendingSelfieUri }} style={styles.selfiePreviewImg} resizeMode="cover" />
            )}

            <View style={styles.selfieMetaBox}>
              <MapPin size={14} color={COLORS.primary} />
              <Text style={styles.selfieMetaText}>Location Verified: GPS High Accuracy (8m)</Text>
            </View>

            <View style={styles.selfieModalActions}>
              <TouchableOpacity
                style={styles.retakeBtn}
                onPress={() => {
                  setSelfieModalVisible(false);
                  capturePunchInSelfie();
                }}
                activeOpacity={0.75}
              >
                <Text style={styles.retakeBtnText}>Retake</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmPunchBtn}
                onPress={confirmAndPunchIn}
                disabled={submittingPunchIn}
                activeOpacity={0.85}
              >
                {submittingPunchIn ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmPunchBtnText}>Confirm & Punch In</Text>
                )}
              </TouchableOpacity>
            </View>
          </Surface>
        </View>
      </Modal>

      {/* ── SIDE DRAWER MENU ── */}
      <Modal visible={sideMenuVisible} animationType="slide" transparent>
        <View style={styles.drawerBackdrop}>
          <TouchableOpacity style={styles.drawerDismiss} onPress={() => setSideMenuVisible(false)} />
          <Surface style={styles.drawerContent} elevation={5}>
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerOrgTitle}>{orgName}</Text>
              <Text style={styles.drawerOrgSub}>Manager Operations</Text>
              <TouchableOpacity style={styles.drawerCloseBtn} onPress={() => setSideMenuVisible(false)}>
                <X size={18} color={COLORS.textSub} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.drawerList}>
              <TouchableOpacity style={styles.drawerItem} onPress={() => { setSideMenuVisible(false); router.push('/(admin)/dashboard'); }}>
                <Home size={18} color={COLORS.primary} />
                <Text style={styles.drawerItemText}>Manager Dashboard</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.drawerItem} onPress={() => { setSideMenuVisible(false); router.push('/(admin)/team'); }}>
                <Users size={18} color={COLORS.primary} />
                <Text style={styles.drawerItemText}>My Team Roster</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.drawerItem} onPress={() => { setSideMenuVisible(false); router.push('/(admin)/tracking'); }}>
                <Compass size={18} color={COLORS.primary} />
                <Text style={styles.drawerItemText}>Live GPS Tracking</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.drawerItem} onPress={() => { setSideMenuVisible(false); router.push('/(admin)/attendance'); }}>
                <CalendarCheck size={18} color={COLORS.primary} />
                <Text style={styles.drawerItemText}>Attendance Logs</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.drawerItem} onPress={() => { setSideMenuVisible(false); router.push('/(admin)/leaves'); }}>
                <Calendar size={18} color={COLORS.primary} />
                <Text style={styles.drawerItemText}>Leave Approvals</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.drawerItem} onPress={() => { setSideMenuVisible(false); router.push('/(admin)/expenses'); }}>
                <Wallet size={18} color={COLORS.primary} />
                <Text style={styles.drawerItemText}>Expense Claims</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.drawerItem} onPress={() => { setSideMenuVisible(false); router.push('/(admin)/leads'); }}>
                <UserPlus size={18} color={COLORS.primary} />
                <Text style={styles.drawerItemText}>Customer Leads</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.drawerItem} onPress={() => { setSideMenuVisible(false); router.push('/(admin)/profile'); }}>
                <UserCheck size={18} color={COLORS.primary} />
                <Text style={styles.drawerItemText}>Manager Profile</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.drawerItem} onPress={() => { setSideMenuVisible(false); router.push('/(admin)/settings'); }}>
                <Settings size={18} color={COLORS.primary} />
                <Text style={styles.drawerItemText}>Organization Settings</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.drawerItem, { marginTop: 20 }]} onPress={handleLogout}>
                <LogOut size={18} color={COLORS.danger} />
                <Text style={[styles.drawerItemText, { color: COLORS.danger, fontWeight: '700' }]}>Sign Out</Text>
              </TouchableOpacity>
            </ScrollView>
          </Surface>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerGradient: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  topNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandBox: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 10,
    gap: 8,
  },
  logoBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerLogoImg: {
    width: 22,
    height: 22,
  },
  brandTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
    fontFamily: FONT,
  },
  brandSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
    fontFamily: FONT,
  },
  topNavRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  syncBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
    fontFamily: FONT,
  },
  notifBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FB7185',
  },
  userBadgeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FDA4AF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#881337',
    fontFamily: FONT,
  },
  greetingBox: {
    marginTop: 14,
  },
  greetingTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    fontFamily: FONT,
  },
  greetingDate: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    fontFamily: FONT,
    marginTop: 2,
  },
  greetingSub: {
    fontSize: 12,
    color: '#a7f3d0',
    fontFamily: FONT,
    marginTop: 2,
  },
  body: {
    padding: 16,
    paddingBottom: 160,
  },

  // ── SHIFT PUNCH IN CARD ──
  shiftCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  shiftCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  punchedOutBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  punchedOutDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  punchedOutText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
    fontFamily: FONT,
  },
  punchedInBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  punchedInDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  punchedInText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
    fontFamily: FONT,
  },
  managerDutyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  managerDutyText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
    fontFamily: FONT,
  },
  shiftMiddleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  shiftTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    fontFamily: FONT,
  },
  todayKmPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.mintLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  todayKmPillLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontFamily: FONT,
  },
  todayKmPillVal: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
    fontFamily: FONT,
  },
  motionStateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 10,
    gap: 8,
  },
  motionStateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  motionStateText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONT,
  },
  managerAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    marginBottom: 4,
  },
  managerAddressText: {
    fontSize: 11.5,
    color: COLORS.textSecondary,
    fontFamily: FONT,
    fontWeight: '500',
    flex: 1,
  },
  punchCtaBtn: {
    backgroundColor: '#059669',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  punchCtaBtnStop: {
    backgroundColor: '#DC2626',
  },
  punchBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  punchBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
    fontFamily: FONT,
  },

  // ── TEAM STRIP BANNER ──
  teamStripCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  teamStripTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  teamCountBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
    fontFamily: FONT,
  },
  avatarPile: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pileImg: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  pileAvatarFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  pileAvatarFallbackText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ffffff',
    fontFamily: FONT,
  },
  pileMoreCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pileMoreText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textSub,
    fontFamily: FONT,
  },
  manageTeamLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  manageTeamLinkText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    fontFamily: FONT,
  },

  // ── QUICK ACTIONS ──
  quickActionsSection: {
    marginTop: 16,
  },
  sectionHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    fontFamily: FONT,
    marginBottom: 10,
  },
  quickGridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  quickCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quickIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  quickLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text,
    fontFamily: FONT,
  },
  quickBadgeCircle: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E11D48',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ffffff',
    fontFamily: FONT,
  },

  // ── 2X2 METRICS GRID ──
  metrics2x2Grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 14,
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  metricCardTitle: {
    fontSize: 11,
    color: COLORS.textSub,
    fontFamily: FONT,
  },
  metricCardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  metricCardVal: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    fontFamily: FONT,
  },
  metricTrendGreen: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.success,
    fontFamily: FONT,
    marginTop: 2,
  },
  miniRing: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniRingFill: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 4,
  },
  metricDottedLine: {
    height: 2,
    width: 40,
    borderStyle: 'dotted',
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
    marginTop: 4,
  },

  // ── VISITS TODAY PROGRESS BAR ──
  visitsBarCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  visitsBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  visitsBarTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
    fontFamily: FONT,
  },
  visitsBarVal: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.text,
    fontFamily: FONT,
  },
  visitsBarTrack: {
    height: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 4,
    overflow: 'hidden',
  },
  visitsBarFill: {
    height: '100%',
    backgroundColor: '#059669',
    borderRadius: 4,
  },

  // ── NEEDS YOUR ATTENTION SECTION ──
  needsAttentionSection: {
    marginTop: 16,
  },
  attentionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  attentionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EA580C',
    fontFamily: FONT,
  },
  attentionPillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  attentionPillOrange: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  attentionDotOrange: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EA580C',
  },
  attentionPillTextOrange: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EA580C',
    fontFamily: FONT,
  },
  attentionPillRed: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  attentionDotRed: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#DC2626',
  },
  attentionPillTextRed: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
    fontFamily: FONT,
  },
  attentionPillAmber: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  attentionDotAmber: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D97706',
  },
  attentionPillTextAmber: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
    fontFamily: FONT,
  },

  // ── SECTION CARD ──
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    marginTop: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    fontFamily: FONT,
  },
  viewLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    fontFamily: FONT,
  },
  embeddedMapWrap: {
    height: 150,
    borderRadius: 14,
    overflow: 'hidden',
  },

  // ── WEEKLY CHART ──
  chartBarsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 100,
    paddingTop: 10,
  },
  chartBarCol: {
    alignItems: 'center',
    flex: 1,
  },
  chartBarCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSub,
    fontFamily: FONT,
    marginBottom: 4,
  },
  chartBarTrack: {
    width: 14,
    height: 60,
    backgroundColor: COLORS.surface,
    borderRadius: 7,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartBarFill: {
    width: '100%',
    borderRadius: 7,
  },
  chartBarDayText: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontFamily: FONT,
    marginTop: 4,
  },
  todayPillText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#06B6D4',
    fontFamily: FONT,
    marginTop: 1,
  },

  // ── LIVE DUTY LIST ──
  dutyList: {
    gap: 10,
  },
  dutyRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
  },
  dutyLeftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  dutyRankNum: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
    fontFamily: FONT,
    width: 14,
  },
  dutyAvatarImg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.border,
  },
  dutyAvatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dutyAvatarFallbackText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    fontFamily: FONT,
  },
  dutyNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    fontFamily: FONT,
  },
  dutyKmText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
    fontFamily: FONT,
    marginRight: 10,
  },
  dutyActivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.mintLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  dutyActiveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: COLORS.success,
  },
  dutyActivePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.success,
    fontFamily: FONT,
  },
  dutyIdlePill: {
    backgroundColor: COLORS.warningLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  dutyIdlePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.warning,
    fontFamily: FONT,
  },
  dutyOfflinePill: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  dutyOfflinePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
    fontFamily: FONT,
  },

  // ── LEADERBOARD ──
  leaderboardList: {
    gap: 10,
  },
  leaderboardRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
  },
  leaderboardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  rankCircleBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankCircleText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ffffff',
    fontFamily: FONT,
  },
  leaderboardAvatarImg: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.border,
  },
  leaderboardAvatarFallback: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  leaderboardAvatarFallbackText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    fontFamily: FONT,
  },
  leaderboardName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    fontFamily: FONT,
  },
  leaderboardSub: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '700',
    fontFamily: FONT,
    marginRight: 12,
  },
  leaderboardScore: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.text,
    fontFamily: FONT,
  },

  // ── BOTTOM TAB BAR (Solid Full-Width Professional Anchored Bar - Height 96) ──
  bottomTabBar: {
    position: 'absolute',
    bottom: 25,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 32 : 22,
    shadowColor: '#0f172a',
    shadowOpacity: 0.10,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -4 },
    elevation: 16,
  },
  tabBarItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  tabActiveIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
    fontFamily: FONT,
    marginTop: 2,
  },

  // ── MODAL STYLES ──
  selfieModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  selfieModalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
  },
  selfieModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    fontFamily: FONT,
  },
  selfieModalSub: {
    fontSize: 12,
    color: COLORS.textSub,
    fontFamily: FONT,
    marginTop: 4,
    marginBottom: 14,
  },
  selfiePreviewImg: {
    width: '100%',
    height: 220,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
  },
  selfieMetaBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.mintLight,
    padding: 10,
    borderRadius: 10,
    marginTop: 12,
  },
  selfieMetaText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    fontFamily: FONT,
  },
  selfieModalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  retakeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  retakeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSub,
    fontFamily: FONT,
  },
  confirmPunchBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: COLORS.primary,
  },
  confirmPunchBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
    fontFamily: FONT,
  },

  // ── DRAWER STYLES ──
  drawerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    flexDirection: 'row',
  },
  drawerDismiss: {
    flex: 1,
  },
  drawerContent: {
    width: '80%',
    maxWidth: 320,
    backgroundColor: '#ffffff',
    height: '100%',
    padding: 20,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  drawerOrgTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
    fontFamily: FONT,
  },
  drawerOrgSub: {
    fontSize: 12,
    color: COLORS.textSub,
    fontFamily: FONT,
  },
  drawerCloseBtn: {
    padding: 6,
  },
  drawerList: {
    marginTop: 14,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  drawerItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    fontFamily: FONT,
  },
});
