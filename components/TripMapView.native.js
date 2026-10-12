import React, { useRef, useEffect, useMemo } from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import Constants from 'expo-constants';

// Detect if running inside standard Expo Go (where Google Maps native SDK is unsupported)
const isExpoGo = Constants.appOwnership === 'expo';
const mapProvider = isExpoGo ? undefined : PROVIDER_GOOGLE;

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

// 🚗 Realistic Top-Down Uber 3D Car Marker
function UberVehicleMarker({ heading = 0 }) {
  return (
    <View style={[styles.uberCarContainer, { transform: [{ rotate: `${heading}deg` }] }]}>
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

  // Auto-fit to coordinates when origin, destination or polyline changes
  useEffect(() => {
    if (!mapRef.current) return;
    const pointsToFit = [];

    if (polyline && polyline.length > 0) {
      pointsToFit.push(...polyline);
    } else {
      if (origin?.lat && origin?.lng) {
        pointsToFit.push({ latitude: Number(origin.lat), longitude: Number(origin.lng) });
      }
      if (destination?.lat && destination?.lng) {
        pointsToFit.push({ latitude: Number(destination.lat), longitude: Number(destination.lng) });
      }
    }

    if (pointsToFit.length >= 2) {
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(pointsToFit, {
          edgePadding: { top: 90, right: 60, bottom: 250, left: 60 },
          animated: true,
        });
      }, 350);
    } else if (pointsToFit.length === 1) {
      mapRef.current?.animateToRegion({
        latitude: pointsToFit[0].latitude,
        longitude: pointsToFit[0].longitude,
        latitudeDelta: 0.03,
        longitudeDelta: 0.03,
      }, 500);
    }
  }, [origin, destination, polyline]);

  // Smooth camera follow as employee moves in real time
  useEffect(() => {
    if (!mapRef.current || !currentLocation?.latitude || !currentLocation?.longitude) return;
    if (traveledTrail && traveledTrail.length > 1) {
      mapRef.current.animateToRegion({
        latitude: Number(currentLocation.latitude),
        longitude: Number(currentLocation.longitude),
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      }, 600);
    }
  }, [currentLocation?.latitude, currentLocation?.longitude, traveledTrail?.length]);

  const defaultRegion = {
    latitude: Number(origin?.lat || destination?.lat || currentLocation?.latitude || 26.8467),
    longitude: Number(origin?.lng || destination?.lng || currentLocation?.longitude || 80.9462),
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  };

  // Determine vehicle position and heading
  const vehicleState = useMemo(() => {
    if (currentLocation?.latitude && currentLocation?.longitude) {
      const heading = currentLocation.heading ?? (
        polyline.length >= 2
          ? calculateBearing(polyline[0], polyline[1])
          : 0
      );
      return {
        coordinate: {
          latitude: Number(currentLocation.latitude),
          longitude: Number(currentLocation.longitude),
        },
        heading: Math.round(heading),
      };
    }

    // Default: Show vehicle at origin or starting point of polyline facing destination
    if (polyline && polyline.length >= 2) {
      return {
        coordinate: polyline[0],
        heading: Math.round(calculateBearing(polyline[0], polyline[1])),
      };
    } else if (origin?.lat && origin?.lng && destination?.lat && destination?.lng) {
      return {
        coordinate: { latitude: Number(origin.lat), longitude: Number(origin.lng) },
        heading: Math.round(calculateBearing(origin, destination)),
      };
    }

    return null;
  }, [currentLocation, polyline, origin, destination]);

  return (
    <View style={[styles.container, style]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={mapProvider}
        customMapStyle={UBER_MAP_STYLE}
        initialRegion={defaultRegion}
        showsUserLocation={false}
        showsCompass={true}
        showsMyLocationButton={false}
        loadingEnabled={true}
        loadingIndicatorColor="#18181b"
      >
        {/* ── 1. UBER ORIGIN PIN (Sleek Pickup Dot) ── */}
        {origin?.lat && origin?.lng && (
          <Marker
            coordinate={{ latitude: Number(origin.lat), longitude: Number(origin.lng) }}
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

        {/* ── 2. UBER DESTINATION MARKER (Arrival Badge + Iconic Target Pin) ── */}
        {destination?.lat && destination?.lng && (
          <Marker
            coordinate={{ latitude: Number(destination.lat), longitude: Number(destination.lng) }}
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

              {/* Uber Iconic Black Target Pin */}
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

        {/* ── 3. UBER ROUTE POLYLINE (Crisp White Casing + Dark Charcoal Inner) ── */}
        {polyline && polyline.length > 1 && (
          <>
            {/* Outer White Casing Border */}
            <Polyline
              coordinates={polyline}
              strokeColor="#ffffff"
              strokeWidth={8}
              lineCap="round"
              lineJoin="round"
              geodesic
            />
            {/* Inner Jet Black / Dark Charcoal Uber Route */}
            <Polyline
              coordinates={polyline}
              strokeColor="#18181b"
              strokeWidth={5}
              lineCap="round"
              lineJoin="round"
              geodesic
            />
          </>
        )}

        {/* ── 4. REAL-TIME TRAVELED TRAIL (Emerald Green Trajectory) ── */}
        {traveledTrail && traveledTrail.length > 1 && (
          <Polyline
            coordinates={traveledTrail.map((pt) => ({
              latitude: Number(pt.lat || pt.latitude),
              longitude: Number(pt.lng || pt.longitude),
            }))}
            strokeColor="#10b981"
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
            geodesic
          />
        )}

        {/* ── 5. UBER 3D VEHICLE CAR ON ROUTE ── */}
        {vehicleState && (
          <Marker
            coordinate={vehicleState.coordinate}
            title="Vehicle"
            anchor={{ x: 0.5, y: 0.5 }}
            flat={true}
          >
            <UberVehicleMarker heading={vehicleState.heading} />
          </Marker>
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
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

  // ── UBER 3D TOP-DOWN VEHICLE ──
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
