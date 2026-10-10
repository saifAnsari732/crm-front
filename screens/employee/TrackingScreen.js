import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, View, ScrollView, TouchableOpacity, 
  ActivityIndicator, Alert, Platform, Dimensions, Linking, AppState 
} from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Navigation, Clock, Play, Square, MapPin, 
  Bus, Activity, RefreshCw, Compass, ChevronRight 
} from 'lucide-react-native';
import useLocationTracker from '../../hooks/useLocationTracker';
import { storage } from '../../services/storage';
import { trackingApi } from '../../services/api';
import { processLocation } from '../../services/locationTask';
import * as Location from 'expo-location';
import MapViewComponent from '../../components/MapViewComponent';
import { cleanTrackingRoute } from '../../utils/trackingRoute';

const { width } = Dimensions.get('window');
const DEFAULT_MAP_REGION = {
  latitude: 26.797531,
  longitude: 88.901868,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
};

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

export default function ActiveShiftMapScreen() {
  const { 
    isTracking, loading, startTracking, stopTracking 
  } = useLocationTracker();

  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const [latitude, setLatitude] = useState('26.797531');
  const [longitude, setLongitude] = useState('88.901868');
  const [address, setAddress] = useState(
    'Operational tracking inactive. Press START to begin shift.'
  );
  const [speed, setSpeed] = useState('0');
  const [distance, setDistance] = useState('0.00');
  const [transportMode, setTransportMode] = useState('PUBLIC TRANSPORT'); // PUBLIC TRANSPORT, WALKING, DRIVING
  const [routeCoords, setRouteCoords] = useState([]);
  
  // 🎯 Dynamic Motion State & Coordinate Engine state
  const [isMoving, setIsMoving] = useState(false);
  const [motionStatusLabel, setMotionStatusLabel] = useState('STATIONARY');
  
  const timerRef = useRef(null);
  const locationIntervalRef = useRef(null);
  const totalDistanceRef = useRef(0.0);
  const lastCoordRef = useRef(null);

  // Reference anchors for stationary micro-geofencing & movement accumulation
  const lastConfirmedCoordRef = useRef(null);
  const stationaryAnchorRef = useRef(null);

  // Smart Address Caching Ref (Eliminates 99%+ of redundant reverse-geocoding API calls)
  const lastGeocodedCoordRef = useRef(null);
  const lastGeocodedAddressRef = useRef('');

  // Extended Kalman Filter instance ref for continuous smoothing
  const kalmanRef = useRef(new LatLngKalmanFilter());

  // 1. Timer logic to track duration
  useEffect(() => {
    if (isTracking) {
      // Clear any legacy timers
      if (timerRef.current) clearInterval(timerRef.current);

      const updateTimer = async () => {
        try {
          const startTimeStr = await storage.getItem('trackingStartTime');
          if (startTimeStr) {
            const startMs = new Date(startTimeStr).getTime();
            const nowMs = Date.now();
            const diffSecs = Math.max(0, Math.floor((nowMs - startMs) / 1000));
            
            const hrs = String(Math.floor(diffSecs / 3600)).padStart(2, '0');
            const mins = String(Math.floor((diffSecs % 3600) / 60)).padStart(2, '0');
            const secs = String(diffSecs % 60).padStart(2, '0');
            
            setElapsedTime(`${hrs}:${mins}:${secs}`);
            
            // Distance and speed are driven solely by actual physical movement (Haversine GPS telemetry)
            // No default simulated timer increments
          }
        } catch (e) {
          console.log('📍 Tracking Screen: Timer calculations failed', e);
        }
      };

      updateTimer();
      timerRef.current = setInterval(updateTimer, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsedTime('00:00:00');
      setDistance('0.00');
      setSpeed('0');
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTracking, transportMode]);

  // 1.5. Local Cache & AppState Sync for Active Tracking Session Distance
  useEffect(() => {
    let appStateSubscription = null;
    let syncInterval = null;

    const loadLocalCachedDistance = async () => {
      try {
        const sessionId = await storage.getItem('currentTrackingSessionId');
        if (!sessionId) {
          totalDistanceRef.current = 0;
          setDistance('0.00');
          return;
        }
        const cachedDist = await storage.getItem('tracking_accumulated_distance');
        if (cachedDist) {
          const parsed = parseFloat(cachedDist) || 0.0;
          totalDistanceRef.current = parsed;
          setDistance(parsed.toFixed(2));
          console.log('📍 Tracking Screen: Initialized distance from local cache:', parsed);
        }
      } catch (err) {
        console.log('📍 Tracking Screen: Failed to load cached distance:', err);
      }
    };

    const syncDistanceWithBackend = async () => {
      try {
        const response = await trackingApi.getTodaySessions();
        if (response && response.data && response.data.success) {
          const totalToday = typeof response.data.totalDistanceToday === 'number'
            ? response.data.totalDistanceToday
            : null;

          const sessionId = await storage.getItem('currentTrackingSessionId');
          const activeSession = sessionId
            ? response.data.sessions.find(s => s.sessionId === sessionId)
            : null;

          const backendDistance = parseFloat(activeSession?.totalDistance) || 0.0;
          const synchronizedDistance = (typeof totalToday === 'number' && totalToday > 0)
            ? totalToday
            : backendDistance;

          console.log('📍 Tracking Screen: Synchronized distance with backend:', synchronizedDistance);
          totalDistanceRef.current = synchronizedDistance;
          const distStr = synchronizedDistance.toFixed(2);
          setDistance(distStr);
          await storage.setItem('tracking_accumulated_distance', distStr);
        }
      } catch (err) {
        console.log('📍 Tracking Screen: Failed to sync distance with backend:', err);
      }
    };

    if (isTracking) {
      // Step 1: Load cache immediately on mount / when tracking becomes active
      loadLocalCachedDistance().then(() => {
        // Step 2: Proactively sync with backend once (online check)
        syncDistanceWithBackend();
      });

      // Step 3: Set 30-second polling interval for backend reconciliation (local engine updates distance in real-time)
      syncInterval = setInterval(() => {
        syncDistanceWithBackend();
      }, 30000);

      // Step 4: Register AppState listener to sync distance when returning from background / lock screen
      appStateSubscription = AppState.addEventListener('change', async (nextAppState) => {
        if (nextAppState === 'active') {
          console.log('📍 Tracking Screen: App returned to active foreground. Syncing distance telemetry...');
          await loadLocalCachedDistance();
          await syncDistanceWithBackend();
        }
      });
    } else {
      // When not tracking, display today's total distance if available instead of resetting to 0.00
      trackingApi.getTodaySessions().then(response => {
        if (response?.data?.success && typeof response.data.totalDistanceToday === 'number') {
          const todayDist = response.data.totalDistanceToday;
          totalDistanceRef.current = todayDist;
          setDistance(todayDist.toFixed(2));
        } else {
          totalDistanceRef.current = 0.0;
          setDistance('0.00');
        }
      }).catch(() => {
        totalDistanceRef.current = 0.0;
        setDistance('0.00');
      });
    }

    return () => {
      if (appStateSubscription) {
        appStateSubscription.remove();
      }
      if (syncInterval) {
        clearInterval(syncInterval);
      }
    };
  }, [isTracking]);

  // 2. Real-time Location telemetry updates (Dual-Stream: Hardware watchPositionAsync + Polling Fallback)
  useEffect(() => {
    let watchSubscription = null;

    if (isTracking) {
      const handleCoordinateFix = async (position) => {
        try {
          if (position && position.coords) {
            const { latitude: rawLat, longitude: rawLng, speed: mps, accuracy: acc } = position.coords;
            
            // 🧮 Process raw fix through 2D Extended Kalman Filter to eliminate multipath noise
            const smoothed = kalmanRef.current.process(rawLat, rawLng, acc, position.timestamp);
            const lat = smoothed.lat;
            const lng = smoothed.lng;

            setLatitude(lat.toFixed(6));
            setLongitude(lng.toFixed(6));
            
            const currentSpeedKmh = mps && mps > 0.1 ? Math.round(mps * 3.6) : 0;
            setSpeed(currentSpeedKmh.toString());

            // 🎯 ADVANCED DYNAMIC MOTION ENGINE:
            // Checks if employee moved vs stationary, calculates KM, and saves coordinates
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

              // If movement from anchor < 12m AND speed < 1.8 km/h -> EMPLOYEE IS STOPPED!
              if (distFromAnchorM < 12 && currentSpeedKmh < 1.8 && calculatedSpeedKmh < 2.2) {
                setIsMoving(false);
                setMotionStatusLabel('STATIONARY');
                // Exponential Moving Average to smooth out indoor GPS drift
                stationaryAnchorRef.current = {
                  lat: 0.95 * stationaryAnchorRef.current.lat + 0.05 * lat,
                  lng: 0.95 * stationaryAnchorRef.current.lng + 0.05 * lng,
                };
              } else {
                // COORDINATES CHANGED -> EMPLOYEE MOVED!
                setIsMoving(true);
                setMotionStatusLabel('MOVING');

                if (calculatedSpeedKmh < 180 && distFromLastM > 4) {
                  const addedKm = distFromLastM / 1000;
                  totalDistanceRef.current += addedKm;
                  const newTotalStr = totalDistanceRef.current.toFixed(2);
                  setDistance(newTotalStr);

                  // Store accumulated distance in local storage immediately
                  storage.setItem('tracking_accumulated_distance', newTotalStr).catch(() => {});

                  console.log(`📍 TrackingScreen Engine: [MOVED!] +${addedKm.toFixed(3)} km added. Total: ${newTotalStr} km.`);
                }

                lastConfirmedCoordRef.current = { lat, lng, timestamp: position.timestamp };
                stationaryAnchorRef.current = { lat, lng };
              }
            }

            // 🎯 DIRECT COORDINATE STORE & CALCULATE: Feed screen GPS fixes into processLocation engine
            await processLocation(position).catch(() => {});

            lastCoordRef.current = { lat, lng };
            setRouteCoords((previous) => cleanTrackingRoute([...previous, {
              latitude: lat,
              longitude: lng,
              timestamp: position.timestamp,
            }]).slice(-600));

            // 🎯 SMART GEONAME API SAVER:
            // Reverse geocode ONLY if address is empty OR moved > 80 meters from last geocoded point
            try {
              const distFromLastGeocoded = lastGeocodedCoordRef.current
                ? haversineMeters(lastGeocodedCoordRef.current.lat, lastGeocodedCoordRef.current.lng, lat, lng)
                : 999;

              if (!lastGeocodedAddressRef.current || distFromLastGeocoded > 80) {
                if (Platform.OS === 'web') {
                  const webAddr = `Location acquired: [${lat.toFixed(4)}, ${lng.toFixed(4)}]`;
                  setAddress(webAddr);
                  lastGeocodedAddressRef.current = webAddr;
                  lastGeocodedCoordRef.current = { lat, lng };
                } else {
                  const geocoded = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
                  if (geocoded && geocoded.length > 0) {
                    const res = geocoded[0];
                    const street = res.street || res.name || '';
                    const district = res.district || res.subregion || '';
                    const city = res.city || '';
                    const region = res.region || '';
                    const code = res.postalCode || '';
                    
                    const fullAddress = [street, district, city, region, code]
                      .filter(part => part && part.length > 0)
                      .join(', ');
                      
                    const finalAddr = fullAddress || `Location acquired: [${lat.toFixed(4)}, ${lng.toFixed(4)}]`;
                    setAddress(finalAddr);
                    lastGeocodedAddressRef.current = finalAddr;
                    lastGeocodedCoordRef.current = { lat, lng };
                  } else {
                    const fallbackAddr = `Location acquired: [${lat.toFixed(4)}, ${lng.toFixed(4)}]`;
                    setAddress(fallbackAddr);
                    lastGeocodedAddressRef.current = fallbackAddr;
                    lastGeocodedCoordRef.current = { lat, lng };
                  }
                }
              } else if (lastGeocodedAddressRef.current) {
                // Reuse cached address without hitting external Geocode API
                setAddress(lastGeocodedAddressRef.current);
              }
            } catch (geoErr) {
              console.log('📍 Tracking Screen: Reverse geocoding failed:', geoErr.message);
              setAddress(`Location acquired: [${lat.toFixed(4)}, ${lng.toFixed(4)}] (Offline Mode)`);
            }
          }
        } catch (err) {
          console.log('📍 Tracking Screen: Could not query exact coordinates:', err.message);
          setSpeed('0');
          if (err.message && err.message.toLowerCase().includes('denied')) {
            setAddress('⚠️ Location Access Denied. Please allow location in browser/phone settings.');
          } else {
            setAddress('GPS Signal Lost. Searching for satellites...');
          }
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
          console.log('📍 Tracking Screen: Polling fix error:', e.message);
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
          console.log('📡 Tracking Screen: Native hardware watchPositionAsync active! ✅');
        }).catch((err) => {
          console.log('⚠️ Tracking Screen: watchPositionAsync fallback to polling:', err.message);
        });
      }

      fetchLiveCoords();
      locationIntervalRef.current = setInterval(fetchLiveCoords, 8000);
    } else {
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
      setLatitude('26.797531');
      setLongitude('88.901868');
      setAddress('Tracking inactive. Press START to begin shift.');
      totalDistanceRef.current = 0.0;
      lastCoordRef.current = null;
      lastConfirmedCoordRef.current = null;
      stationaryAnchorRef.current = null;
      kalmanRef.current.reset();
      setIsMoving(false);
      setMotionStatusLabel('STATIONARY');
      setRouteCoords([]);
    }

    return () => {
      if (watchSubscription) watchSubscription.remove();
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
    };
  }, [isTracking, transportMode]);

  const handleStartStop = async () => {
    if (isTracking) {
      const executeStop = async () => {
        const res = await stopTracking();
        if (res.success) {
          const msg = `Clock out complete. Logged ${res.totalDistance?.toFixed(2) || 0} km traveled.`;
          if (Platform.OS === 'web') {
            alert(`Shift Ended: ${msg}`);
          } else {
            Alert.alert('Shift Ended', msg);
          }
        } else {
          const errMsg = res.error || 'Failed to stop tracking session.';
          if (Platform.OS === 'web') {
            alert(`Error: ${errMsg}`);
          } else {
            Alert.alert('Error', errMsg);
          }
        }
      };

      if (Platform.OS === 'web') {
        const confirmStop = window.confirm('Are you sure you want to end your active operational tracking shift?');
        if (confirmStop) {
          await executeStop();
        }
      } else {
        Alert.alert(
          'Confirm Clock Out',
          'Are you sure you want to end your active operational tracking shift?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'End Shift',
              style: 'destructive',
              onPress: executeStop
            }
          ]
        );
      }
    } else {
      const res = await startTracking();
      if (res.success) {
        const msg = 'You are now ON DUTY. Background GPS tracking initialized.';
        if (Platform.OS === 'web') {
          alert(`Shift Started: ${msg}`);
        } else {
          Alert.alert('Shift Started', msg);
        }
      } else {
        const errMsg = res.error || 'Check permissions and try again.';
        if (Platform.OS === 'web') {
          alert(`Failed to Start Shift: ${errMsg}`);
        } else {
          Alert.alert('Failed to Start Shift', errMsg);
        }
      }
    }
  };

  const cycleTransportMode = () => {
    if (transportMode === 'PUBLIC TRANSPORT') {
      setTransportMode('WALKING');
    } else if (transportMode === 'WALKING') {
      setTransportMode('DRIVING');
    } else {
      setTransportMode('PUBLIC TRANSPORT');
    }
  };

  const openGoogleMaps = () => {
    const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open Google Maps link.');
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* 1. Title Section & Transport Selector */}
      <View style={styles.topHeader}>
        <View style={styles.titleGroup}>
          <View style={styles.liveIndicatorRow}>
            <Text style={styles.mainTitle}>Live Tracking</Text>
            <View style={[styles.liveBadge, { backgroundColor: isTracking ? '#e6fbf2' : '#fef2f2' }]}>
              <View style={[styles.liveDot, { backgroundColor: isTracking ? '#10b981' : '#ef4444' }]} />
              <Text style={[styles.liveBadgeText, { color: isTracking ? '#10b981' : '#ef4444' }]}>
                {isTracking ? 'LIVE' : 'INACTIVE'}
              </Text>
            </View>
          </View>
          <Text style={styles.subtitle}>Monitor your field activity in real-time</Text>
        </View>

       
      </View>

      {/* 2. Main Central Start/Stop Trigger */}
      <View style={styles.centerClockModule}>
        <View style={styles.pulseOuterCircle}>
          <View style={[styles.pulseInnerRing, { borderColor: isTracking ? 'rgba(16, 185, 129, 0.15)' : 'rgba(37, 99, 235, 0.15)' }]}>
            <TouchableOpacity 
              style={[styles.mainTriggerCircle, { backgroundColor: isTracking ? '#10b981' : '#2563eb' }]} 
              onPress={handleStartStop}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="large" />
              ) : isTracking ? (
                <>
                  <Square size={28} color="#fff" style={styles.controlIcon} />
                  <Text style={styles.controlText}>STOP</Text>
                </>
              ) : (
                <>
                  <Play size={28} color="#fff" style={styles.controlIcon} />
                  <Text style={styles.controlText}>START</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* 3. Metric Stack Grid (3 Columns) */}
      <View style={styles.metricGrid}>
        {/* Distance Card */}
        <Surface style={styles.metricCard} elevation={1}>
          <Navigation size={18} color="#3b82f6" style={styles.metricIcon} />
          <Text style={styles.metricValue}>{distance} km</Text>
          <Text style={styles.metricLabel}>DISTANCE</Text>
        </Surface>

        {/* Speed Card */}
        <Surface style={styles.metricCard} elevation={1}>
          <Activity size={18} color="#8b5cf6" style={styles.metricIcon} />
          <Text style={styles.metricValue}>{speed} km/h</Text>
          <Text style={styles.metricLabel}>SPEED</Text>
        </Surface>

        {/* Time Card */}
        <Surface style={styles.metricCard} elevation={1}>
          <Clock size={18} color="#f97316" style={styles.metricIcon} />
          <Text style={styles.metricValue}>{elapsedTime}</Text>
          <Text style={styles.metricLabel}>TIME</Text>
        </Surface>
      </View>

      {/* 4. Coordinate & Address Status Module */}
      <Surface style={styles.statusBox} elevation={1}>
        <View style={styles.statusBoxHeader}>
          <View style={styles.headerLeftIconLabel}>
            <MapPin size={18} color="#3b82f6" style={styles.gpsLabelIcon} />
            <Text style={styles.boxTitle}>CURRENT GPS STATUS</Text>
          </View>
          <TouchableOpacity onPress={openGoogleMaps}>
            <Text style={styles.googleMapsLink}>Google Maps ›</Text>
          </TouchableOpacity>
        </View>

        {/* Dynamic Motion State Live Banner */}
        {isTracking && (
          <View style={[styles.motionStateBanner, { backgroundColor: isMoving ? '#dcfce7' : '#f1f5f9', borderColor: isMoving ? '#bbf7d0' : '#e2e8f0' }]}>
            <View style={[styles.motionStateDot, { backgroundColor: isMoving ? '#16a34a' : '#64748b' }]} />
            <Text style={[styles.motionStateText, { color: isMoving ? '#15803d' : '#475569' }]}>
              {isMoving ? `🟢 MOVING — Travel Recording Active (${speed} km/h)` : '⏸️ STATIONARY — 0 KM Added (At Spot)'}
            </Text>
          </View>
        )}

        <View style={styles.coordsRow}>
          <View style={styles.coordsCol}>
            <Text style={styles.coordsLabel}>LATITUDE</Text>
            <Text style={styles.coordsVal}>{latitude}</Text>
          </View>
          <View style={styles.coordsCol}>
            <Text style={styles.coordsLabel}>LONGITUDE</Text>
            <Text style={styles.coordsVal}>{longitude}</Text>
          </View>
        </View>

        {/* Actual Geocoded Address Card */}
        <LinearGradient 
          colors={['#eef2ff', '#e0e7ff']} 
          style={styles.addressContainer}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.addressHeader}>
            <Compass size={14} color="#4f46e5" style={styles.addressIcon} />
            <Text style={styles.addressHeading}>ACTUAL ADDRESS</Text>
          </View>
          <Text style={styles.addressBody}>{address}</Text>
        </LinearGradient>
      </Surface>

      <Surface style={styles.mapCard} elevation={1}>
        <View style={styles.mapHeader}><View><Text style={styles.mapTitle}>Live route</Text><Text style={styles.mapSubtitle}>Your accepted GPS trail</Text></View><MapPin size={18} color="#0f766e" /></View>
        <View style={styles.employeeMap}><MapViewComponent initialRegion={DEFAULT_MAP_REGION} directoryStaff={latitude && longitude ? [{ _id: 'self', name: 'You', lat: latitude, lng: longitude, isTracking }] : []} routeCoords={routeCoords} onSelectEmployee={() => {}} /></View>
      </Surface>

      {/* 5. Telemetry Flashing Connection Module */}
      <Surface style={styles.mapCanvasPlaceholder} elevation={1}>
        <View style={styles.syncRow}>
          <View style={styles.flashingTargetDot}>
            <View style={[styles.targetCoreDot, { backgroundColor: isTracking ? '#10b981' : '#f59e0b' }]} />
            <View style={[styles.targetOuterDotRing, { borderColor: isTracking ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.4)' }]} />
          </View>
          <View style={styles.syncStatusBadge}>
            <RefreshCw size={10} color="#64748b" style={styles.syncIconAnim} />
            <Text style={styles.syncBadgeText}>SYNCING</Text>
          </View>
        </View>
      </Surface>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingTop: Platform.OS === 'ios' ? 48 : 40,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Platform.OS === 'ios' ? 30 : 10,
    marginBottom: 25,
  },
  titleGroup: {
    flex: 1,
  },
  liveIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  liveBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  transportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
  },
  transportIcon: {
    marginRight: 6,
  },
  transportBtnText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#475569',
    letterSpacing: 0.5,
  },
  centerClockModule: {
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 15,
  },
  pulseOuterCircle: {
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(241, 245, 249, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseInnerRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainTriggerCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  controlIcon: {
    marginBottom: 4,
  },
  controlText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  metricGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 25,
  },
  metricCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  metricIcon: {
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  metricLabel: {
    fontSize: 8.5,
    color: '#94a3b8',
    fontWeight: 'bold',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  statusBox: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 1,
  },
  statusBoxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 12,
    marginBottom: 14,
  },
  headerLeftIconLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gpsLabelIcon: {
    marginRight: 6,
  },
  boxTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#475569',
    letterSpacing: 0.5,
  },
  googleMapsLink: {
    fontSize: 10.5,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  motionStateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  motionStateDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 8,
  },
  motionStateText: {
    fontSize: 9.5,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  coordsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  coordsCol: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  coordsLabel: {
    fontSize: 7.5,
    color: '#94a3b8',
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  coordsVal: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0f172a',
    marginTop: 4,
  },
  addressContainer: {
    borderRadius: 16,
    padding: 14,
    borderColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 1.5,
    shadowColor: '#3b82f6',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 1,
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  addressIcon: {
    marginRight: 6,
  },
  addressHeading: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#4f46e5',
    letterSpacing: 0.5,
  },
  addressBody: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1e293b',
    lineHeight: 18,
  },
  mapCanvasPlaceholder: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 5,
    elevation: 1,
  },
  mapCard: { backgroundColor: '#ffffff', borderRadius: 18, borderWidth: 1, borderColor: '#dbe7ef', padding: 12, marginBottom: 20 },
  mapHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  mapTitle: { color: '#0f172a', fontSize: 13, fontWeight: 'bold' },
  mapSubtitle: { color: '#64748b', fontSize: 10, marginTop: 3 },
  employeeMap: { height: 230, overflow: 'hidden', borderRadius: 14 },
  syncRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  flashingTargetDot: {
    width: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  targetCoreDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    position: 'absolute',
  },
  targetOuterDotRing: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  syncStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  syncIconAnim: {
    transform: [{ rotate: '0deg' }],
  },
  syncBadgeText: {
    fontSize: 8.5,
    fontWeight: 'bold',
    color: '#64748b',
    letterSpacing: 0.5,
  },
});
