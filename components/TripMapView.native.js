import React, { useRef, useEffect, useMemo } from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import MapView, { Marker, Polyline, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import Constants from 'expo-constants';

// Detect if running inside standard Expo Go (where Google Maps native SDK is unsupported)
const isExpoGo =
  Constants.executionEnvironment === 'storeClient' || Constants.appOwnership === 'expo';
const mapProvider = isExpoGo ? undefined : (Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined);

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

// 🚗 Realistic Top-Down 3D Vehicle Marker
function UberVehicleMarker() {
  return (
    <View style={styles.uberCarContainer}>
      {/* Soft Drop Shadow Under Vehicle */}
      <View style={styles.uberCarShadow} />
      {/* Sleek Car Body */}
      <View style={styles.uberCarBody}>
        {/* Front Headlights */}
        <View style={styles.uberCarHeadlightRow}>
          <View style={styles.uberCarHeadlight} />
          <View style={styles.uberCarHeadlight} />
        </View>
        {/* Front Windshield */}
        <View style={styles.uberCarFrontGlass} />
        {/* Panoramic Dark Glass Roof */}
        <View style={styles.uberCarRoof} />
        {/* Rear Windshield */}
        <View style={styles.uberCarRearGlass} />
        {/* Rear Red Taillights */}
        <View style={styles.uberCarTaillightRow}>
          <View style={styles.uberCarTaillight} />
          <View style={styles.uberCarTaillight} />
        </View>
      </View>
    </View>
  );
}

export default function TripMapView({
  origin,
  destination,
  polyline = [],
  traveledTrail = [],
  currentLocation,
  durationText,
  distanceKm,
  style,
}) {
  const mapRef = useRef(null);
  const isMapReadyRef = useRef(false);

  // Safe initial region with fallback to center Lucknow / Default India center
  const defaultRegion = useMemo(() => {
    const lat = Number(origin?.lat || destination?.lat || currentLocation?.latitude || 26.8467);
    const lng = Number(origin?.lng || destination?.lng || currentLocation?.longitude || 80.9462);
    return {
      latitude: Number.isFinite(lat) && lat !== 0 ? lat : 26.8467,
      longitude: Number.isFinite(lng) && lng !== 0 ? lng : 80.9462,
      latitudeDelta: 0.06,
      longitudeDelta: 0.06,
    };
  }, [origin?.lat, destination?.lat, currentLocation?.latitude, currentLocation?.longitude]);

  // Fit camera bounds smoothly to route/points
  const fitMapToRoute = () => {
    if (!mapRef.current || !isMapReadyRef.current) return;
    const pointsToFit = [];

    if (Array.isArray(polyline) && polyline.length > 0) {
      for (const p of polyline) {
        const pLat = Number(p.latitude ?? p.lat);
        const pLng = Number(p.longitude ?? p.lng);
        if (Number.isFinite(pLat) && Number.isFinite(pLng)) {
          pointsToFit.push({ latitude: pLat, longitude: pLng });
        }
      }
    } else {
      if (origin?.lat && origin?.lng) {
        const oLat = Number(origin.lat);
        const oLng = Number(origin.lng);
        if (Number.isFinite(oLat) && Number.isFinite(oLng)) {
          pointsToFit.push({ latitude: oLat, longitude: oLng });
        }
      }
      if (destination?.lat && destination?.lng) {
        const dLat = Number(destination.lat);
        const dLng = Number(destination.lng);
        if (Number.isFinite(dLat) && Number.isFinite(dLng)) {
          pointsToFit.push({ latitude: dLat, longitude: dLng });
        }
      }
    }

    if (pointsToFit.length >= 2) {
      try {
        mapRef.current.fitToCoordinates(pointsToFit, {
          edgePadding: { top: 80, right: 40, bottom: 120, left: 40 },
          animated: true,
        });
      } catch (err) {
        console.warn('Map fitToCoordinates warning:', err);
      }
    } else if (pointsToFit.length === 1) {
      try {
        mapRef.current.animateToRegion(
          {
            latitude: pointsToFit[0].latitude,
            longitude: pointsToFit[0].longitude,
            latitudeDelta: 0.03,
            longitudeDelta: 0.03,
          },
          500
        );
      } catch (err) {
        console.warn('Map animateToRegion warning:', err);
      }
    }
  };

  // Re-fit when origin, destination or polyline change, safely after onMapReady
  useEffect(() => {
    if (isMapReadyRef.current) {
      const timer = setTimeout(fitMapToRoute, 250);
      return () => clearTimeout(timer);
    }
  }, [origin, destination, polyline]);

  // Smooth camera follow as employee moves in real time
  useEffect(() => {
    if (!mapRef.current || !isMapReadyRef.current || !currentLocation?.latitude || !currentLocation?.longitude) return;
    const cLat = Number(currentLocation.latitude);
    const cLng = Number(currentLocation.longitude);
    if (!Number.isFinite(cLat) || !Number.isFinite(cLng)) return;

    if (traveledTrail && traveledTrail.length > 1) {
      try {
        mapRef.current.animateToRegion(
          {
            latitude: cLat,
            longitude: cLng,
            latitudeDelta: 0.015,
            longitudeDelta: 0.015,
          },
          600
        );
      } catch (err) {
        console.warn('Map camera follow warning:', err);
      }
    }
  }, [currentLocation?.latitude, currentLocation?.longitude, traveledTrail?.length]);

  // Determine vehicle position and heading
  const vehicleState = useMemo(() => {
    if (currentLocation?.latitude && currentLocation?.longitude) {
      const cLat = Number(currentLocation.latitude);
      const cLng = Number(currentLocation.longitude);
      if (Number.isFinite(cLat) && Number.isFinite(cLng)) {
        const heading =
          currentLocation.heading ??
          (polyline && polyline.length >= 2
            ? calculateBearing(polyline[0], polyline[1])
            : 0);
        return {
          coordinate: { latitude: cLat, longitude: cLng },
          heading: Math.round(heading),
        };
      }
    }

    // Default: Show vehicle at origin or starting point of polyline facing destination
    if (polyline && polyline.length >= 2) {
      const pLat = Number(polyline[0].latitude ?? polyline[0].lat);
      const pLng = Number(polyline[0].longitude ?? polyline[0].lng);
      if (Number.isFinite(pLat) && Number.isFinite(pLng)) {
        return {
          coordinate: { latitude: pLat, longitude: pLng },
          heading: Math.round(calculateBearing(polyline[0], polyline[1])),
        };
      }
    } else if (origin?.lat && origin?.lng && destination?.lat && destination?.lng) {
      const oLat = Number(origin.lat);
      const oLng = Number(origin.lng);
      if (Number.isFinite(oLat) && Number.isFinite(oLng)) {
        return {
          coordinate: { latitude: oLat, longitude: oLng },
          heading: Math.round(calculateBearing(origin, destination)),
        };
      }
    }

    return null;
  }, [currentLocation, polyline, origin, destination]);

  const validOrigin =
    origin?.lat && origin?.lng && Number.isFinite(Number(origin.lat)) && Number.isFinite(Number(origin.lng))
      ? { latitude: Number(origin.lat), longitude: Number(origin.lng) }
      : null;

  const validDestination =
    destination?.lat && destination?.lng && Number.isFinite(Number(destination.lat)) && Number.isFinite(Number(destination.lng))
      ? { latitude: Number(destination.lat), longitude: Number(destination.lng) }
      : null;

  const validPolyline = useMemo(() => {
    if (!Array.isArray(polyline)) return [];
    return polyline
      .map((p) => ({
        latitude: Number(p.latitude ?? p.lat),
        longitude: Number(p.longitude ?? p.lng),
      }))
      .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
  }, [polyline]);

  const validTraveledTrail = useMemo(() => {
    if (!Array.isArray(traveledTrail)) return [];
    return traveledTrail
      .map((pt) => ({
        latitude: Number(pt.lat ?? pt.latitude),
        longitude: Number(pt.lng ?? pt.longitude),
      }))
      .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
  }, [traveledTrail]);

  return (
    <View style={[styles.container, style]}>
      <MapView
        ref={mapRef}
        style={[styles.map, style]}
        provider={mapProvider}
        initialRegion={defaultRegion}
        showsUserLocation={false}
        showsCompass={true}
        showsMyLocationButton={false}
        onMapReady={() => {
          isMapReadyRef.current = true;
          fitMapToRoute();
        }}
      >
        {/* ── 1. 500m ARRIVAL GEOFENCE BUBBLE ── */}
        {validDestination && (
          <Circle
            center={validDestination}
            radius={500}
            fillColor="rgba(37, 99, 235, 0.12)"
            strokeColor="rgba(37, 99, 235, 0.45)"
            strokeWidth={1.5}
          />
        )}

        {/* ── 2. UBER ORIGIN PIN (Sleek Pickup Dot) ── */}
        {validOrigin && (
          <Marker
            coordinate={validOrigin}
            title="Pickup Point"
            description={origin.address || 'Starting point'}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.uberOriginWrapper}>
              <View style={styles.uberOriginPulse} />
              <View style={styles.uberOriginOuter}>
                <View style={styles.uberOriginInner} />
              </View>
            </View>
          </Marker>
        )}

        {/* ── 3. UBER DESTINATION MARKER (Arrival Badge + Iconic Target Pin) ── */}
        {validDestination && (
          <Marker
            coordinate={validDestination}
            title="Destination"
            description={destination.address || 'Drop location'}
            anchor={{ x: 0.5, y: 0.92 }}
          >
            <View style={styles.uberDestWrapper}>
              {/* White Floating Arrival Callout Bubble */}
              <View style={styles.uberCalloutCard}>
                <Text style={styles.uberCalloutLabel}>Arrival</Text>
                <Text style={styles.uberCalloutTime}>{durationText || '16 min'}</Text>
              </View>
              {/* Callout Arrow Pointer */}
              <View style={styles.uberCalloutArrow} />

              {/* Iconic Target Pin */}
              <View style={styles.uberTargetPin}>
                <View style={styles.uberTargetPulse} />
                <View style={styles.uberTargetOuter}>
                  <View style={styles.uberTargetWhite}>
                    <View style={styles.uberTargetCore} />
                  </View>
                </View>
              </View>
            </View>
          </Marker>
        )}

        {/* ── 4. ROUTE POLYLINE (Crisp White Casing + Royal Blue Route) ── */}
        {validPolyline.length > 1 && (
          <>
            {/* Outer White Casing Border */}
            <Polyline
              coordinates={validPolyline}
              strokeColor="#ffffff"
              strokeWidth={7}
              lineCap="round"
              lineJoin="round"
              geodesic
            />
            {/* Inner Royal Blue Route Line */}
            <Polyline
              coordinates={validPolyline}
              strokeColor="#2563eb"
              strokeWidth={4.5}
              lineCap="round"
              lineJoin="round"
              geodesic
            />
          </>
        )}

        {/* ── 5. REAL-TIME TRAVELED TRAIL (Emerald Green Trajectory) ── */}
        {validTraveledTrail.length > 1 && (
          <Polyline
            coordinates={validTraveledTrail}
            strokeColor="#10b981"
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
            geodesic
          />
        )}

        {/* ── 6. 3D VEHICLE CAR ON ROUTE (Native Marker Rotation) ── */}
        {vehicleState && (
          <Marker
            coordinate={vehicleState.coordinate}
            title="Vehicle"
            anchor={{ x: 0.5, y: 0.5 }}
            rotation={vehicleState.heading}
            flat={true}
          >
            <UberVehicleMarker />
          </Marker>
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    flex: 1,
  },

  // ── UBER ORIGIN PIN ──
  uberOriginWrapper: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uberOriginPulse: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(16, 185, 129, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.45)',
  },
  uberOriginOuter: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#000000',
    borderWidth: 2.5,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },
  uberOriginInner: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ffffff',
  },

  // ── UBER DESTINATION CALLOUT & TARGET PIN ──
  uberDestWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  uberCalloutCard: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
  },
  uberCalloutLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  uberCalloutTime: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 1,
  },
  uberCalloutArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#ffffff',
    marginTop: -1,
    marginBottom: 2,
  },
  uberTargetPin: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uberTargetPulse: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
    borderWidth: 1.5,
    borderColor: 'rgba(59, 130, 246, 0.5)',
  },
  uberTargetOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },
  uberTargetWhite: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uberTargetCore: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#000000',
  },

  // ── 3D TOP-DOWN VEHICLE ──
  uberCarContainer: {
    width: 34,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uberCarShadow: {
    position: 'absolute',
    width: 22,
    height: 42,
    borderRadius: 11,
    backgroundColor: 'rgba(0, 0, 0, 0.32)',
    top: 5,
  },
  uberCarBody: {
    width: 22,
    height: 44,
    borderRadius: 9,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    overflow: 'hidden',
  },
  uberCarHeadlightRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginTop: 1,
  },
  uberCarHeadlight: {
    width: 3,
    height: 2,
    backgroundColor: '#fef08a',
    borderRadius: 1,
  },
  uberCarFrontGlass: {
    width: 14,
    height: 7,
    backgroundColor: '#1e293b',
    borderRadius: 3,
    marginTop: 2,
  },
  uberCarRoof: {
    width: 13,
    height: 14,
    backgroundColor: '#0f172a',
    borderRadius: 2,
    marginVertical: 2,
  },
  uberCarRearGlass: {
    width: 13,
    height: 4,
    backgroundColor: '#1e293b',
    borderRadius: 2,
  },
  uberCarTaillightRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginTop: 'auto',
    marginBottom: 1,
  },
  uberCarTaillight: {
    width: 3,
    height: 2,
    backgroundColor: '#ef4444',
    borderRadius: 1,
  },
});
