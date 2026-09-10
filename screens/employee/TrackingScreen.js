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
  
  const timerRef = useRef(null);
  const locationIntervalRef = useRef(null);
  const totalDistanceRef = useRef(0.0);
  const lastCoordRef = useRef(null);

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

    const loadLocalCachedDistance = async () => {
      try {
        const sessionId = await storage.getItem('currentTrackingSessionId');
        const cachedSessionId = await storage.getItem('tracking_accumulated_session_id');
        if (!sessionId || cachedSessionId !== sessionId) {
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
        const sessionId = await storage.getItem('currentTrackingSessionId');
        if (!sessionId) return;

        const response = await trackingApi.getTodaySessions();
        if (response && response.data && response.data.success) {
          const activeSession = response.data.sessions.find(s => s.sessionId === sessionId);
          if (activeSession) {
            const backendDistance = parseFloat(activeSession.totalDistance) || 0.0;
            const cachedDistance = parseFloat(await storage.getItem('tracking_accumulated_distance')) || 0.0;
            const cachedSessionId = await storage.getItem('tracking_accumulated_session_id');
            const synchronizedDistance = cachedSessionId === sessionId
              ? Math.max(backendDistance, cachedDistance)
              : backendDistance;
            console.log('📍 Tracking Screen: Synchronized distance with backend:', synchronizedDistance);
            totalDistanceRef.current = synchronizedDistance;
            const distStr = synchronizedDistance.toFixed(2);
            setDistance(distStr);
            await storage.setItem('tracking_accumulated_distance', distStr);
          }
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

      // Step 3: Register AppState listener to sync distance when returning from background / lock screen
      appStateSubscription = AppState.addEventListener('change', async (nextAppState) => {
        if (nextAppState === 'active') {
          console.log('📍 Tracking Screen: App returned to active foreground. Syncing distance telemetry...');
          // Load local cache first to show immediate updates
          await loadLocalCachedDistance();
          // Fetch backend distance to ensure consistency with background tracker database writes
          await syncDistanceWithBackend();
        }
      });
    } else {
      totalDistanceRef.current = 0.0;
      setDistance('0.00');
    }

    return () => {
      if (appStateSubscription) {
        appStateSubscription.remove();
      }
    };
  }, [isTracking]);

  // 2. Real-time Location telemetry updates
  useEffect(() => {
    if (isTracking) {
      const fetchLiveCoords = async () => {
        try {
          const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          
          if (position && position.coords) {
            const { latitude: lat, longitude: lng, speed: mps, accuracy: acc } = position.coords;
            setLatitude(lat.toFixed(6));
            setLongitude(lng.toFixed(6));
            
            // Convert speed m/s to km/h - ONLY show speed if they are actually moving!
            let displaySpeed = '0';
            if (mps && mps > 0.1) {
              displaySpeed = Math.round(mps * 3.6).toString();
            }

            // Distance is calculated by the background task/backend once only.
            // This screen only displays the authoritative cached/server total.
            lastCoordRef.current = { lat, lng };
            setSpeed(displaySpeed);
            setRouteCoords((previous) => cleanTrackingRoute([...previous, {
              latitude: lat,
              longitude: lng,
              timestamp: position.timestamp,
            }]).slice(-600));

            // Reverse geocode to get structural address (Skip on Web to avoid 429 Rate Limits / SDK 49 warnings)
            try {
              if (Platform.OS === 'web') {
                console.log('📡 Web Tracker: [Coordinates Acquired] ->', lat, lng);
                setAddress(`Location acquired: [${lat.toFixed(4)}, ${lng.toFixed(4)}]`);
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
                    
                  console.log('📡 Tracker: [Current Address] ->', fullAddress || `[${lat.toFixed(6)}, ${lng.toFixed(6)}]`);
                  setAddress(fullAddress || `Location acquired: [${lat.toFixed(4)}, ${lng.toFixed(4)}]`);
                } else {
                  console.log('📡 Tracker: [Coordinates Acquired] ->', lat, lng);
                  setAddress(`Location acquired: [${lat.toFixed(4)}, ${lng.toFixed(4)}]`);
                }
              }
            } catch (geoErr) {
              console.log('📍 Tracking Screen: Reverse geocoding failed:', geoErr.message);
              setAddress(`Location acquired: [${lat.toFixed(4)}, ${lng.toFixed(4)}] (Offline Mode)`);
            }
          }
        } catch (err) {
          console.log('📍 Tracking Screen: Could not query exact coordinates:', err.message);
          setSpeed('0'); 
          setAddress('GPS Signal Lost. Searching for satellites...');
        }
      };

      fetchLiveCoords();
      locationIntervalRef.current = setInterval(fetchLiveCoords, 8000);
    } else {
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
      setLatitude('26.797531');
      setLongitude('88.901868');
      setAddress('No Addresss Allow. Press START to begin shift.');
      totalDistanceRef.current = 0.0;
      lastCoordRef.current = null;
      setRouteCoords([]);
    }

    return () => {
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
