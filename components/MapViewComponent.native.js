import React, { forwardRef } from 'react';
import { StyleSheet, View, Text, Image, Platform } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { getAvatarUrl } from '../services/api';

const cardShadow = Platform.OS === 'web'
  ? { boxShadow: '0px 4px 14px rgba(15, 23, 42, 0.22)' }
  : { elevation: 6, shadowColor: '#0f172a', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } };

// Executive Clean Telematics Map Style (Uber / Enterprise Fleet Aesthetic)
const executiveMapStyle = [
  {
    featureType: 'administrative',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#334155' }],
  },
  {
    featureType: 'landscape',
    elementType: 'all',
    stylers: [{ color: '#f8fafc' }],
  },
  {
    featureType: 'poi',
    elementType: 'all',
    stylers: [{ visibility: 'off' }], // Remove clutter (commercial icons, stores)
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry.fill',
    stylers: [{ visibility: 'on' }, { color: '#e2f5ea' }], // Soft pastel green for parks
  },
  {
    featureType: 'road',
    elementType: 'geometry.fill',
    stylers: [{ color: '#ffffff' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#e2e8f0' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.fill',
    stylers: [{ color: '#f1f5f9' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#cbd5e1' }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'transit',
    elementType: 'all',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry.fill',
    stylers: [{ color: '#c9e2f4' }], // Soft clean water
  },
];

const MapViewComponent = forwardRef(({
  initialRegion,
  directoryStaff = [],
  routeCoords = [],
  loadingRoute,
  onSelectEmployee
}, ref) => {
  return (
    <MapView
      ref={ref}
      style={{ flex: 1, width: '100%', height: '100%' }}
      provider={PROVIDER_GOOGLE}
      initialRegion={initialRegion}
      showsUserLocation={false}
      showsCompass={true}
      showsTraffic={false}
      customMapStyle={executiveMapStyle}
    >
      {/* ── FLEET EMPLOYEE TELEMATICS PINS ── */}
      {directoryStaff.map((emp, idx) => {
        if (!emp || !emp.lat || !emp.lng) return null;
        const lat = parseFloat(emp.lat);
        const lng = parseFloat(emp.lng);
        if (isNaN(lat) || isNaN(lng)) return null;

        const isMoving = emp.status === 'IN_TRANSIT' || (emp.isTracking && Number(emp.speed) >= 1.5);
        const isLive = emp.isTracking || emp.status === 'ON_FIELD' || emp.status === 'IN_TRANSIT';
        const borderColor = isMoving ? '#059669' : (isLive ? '#d97706' : '#94a3b8');
        const kmVal = (parseFloat(emp.totalDistance) || 0).toFixed(1);
        const speedVal = Math.round(Number(emp.speed) || 0);
        const firstName = (emp.name || 'Agent').trim().split(' ')[0];

        return (
          <Marker
            key={emp._id || `staff-${idx}`}
            coordinate={{ latitude: lat, longitude: lng }}
            title={emp.name}
            description={`${kmVal} km ${emp.address ? '• ' + emp.address : ''}`}
            onPress={() => onSelectEmployee && onSelectEmployee(emp)}
            tracksViewChanges={false}
            zIndex={isMoving ? 100 : isLive ? 50 : 10}
          >
            <View style={styles.unifiedPin}>
              {/* Outer Capsule with Halo */}
              <View style={[
                styles.pinBody,
                cardShadow,
                {
                  borderColor,
                  borderWidth: isMoving ? 2.5 : 1.5,
                  backgroundColor: isMoving ? '#ffffff' : '#ffffff',
                }
              ]}>
                {/* Live Pulsing Dot */}
                <View style={[
                  styles.statusDot,
                  { backgroundColor: isMoving ? '#10b981' : isLive ? '#f59e0b' : '#94a3b8' }
                ]}>
                  {isMoving && <View style={styles.pulseRing} />}
                </View>

                {/* Avatar Photo / Initial */}
                {getAvatarUrl(emp.avatar) ? (
                  <Image source={{ uri: getAvatarUrl(emp.avatar) }} style={styles.avatarImg} />
                ) : (
                  <View style={[
                    styles.avatarInitial,
                    { backgroundColor: isMoving ? '#059669' : isLive ? '#d97706' : '#64748b' }
                  ]}>
                    <Text style={styles.avatarInitialText}>{(emp.name || 'E').charAt(0).toUpperCase()}</Text>
                  </View>
                )}

                {/* First Name */}
                <Text style={styles.nameText} numberOfLines={1}>{firstName}</Text>

                {/* Telematics KM & Speed Badge */}
                <View style={[
                  styles.kmBadge,
                  {
                    backgroundColor: isMoving ? '#ecfdf5' : isLive ? '#fffbeb' : '#f1f5f9',
                    borderColor: isMoving ? '#a7f3d0' : isLive ? '#fde68a' : '#e2e8f0',
                  }
                ]}>
                  <Text style={[
                    styles.kmText,
                    { color: isMoving ? '#047857' : isLive ? '#b45309' : '#475569' }
                  ]}>
                    {isMoving && speedVal > 0 ? `${speedVal} km/h • ` : ''}{kmVal} km
                  </Text>
                </View>
              </View>

              {/* Teardrop Pointer Tip */}
              <View style={[styles.pinTip, { borderTopColor: borderColor }]} />
            </View>
          </Marker>
        );
      })}

      {/* ── GPS TRAJECTORY ROUTE POLYLINE ── */}
      {routeCoords && routeCoords.length > 1 && (
        <>
          {/* Casing / Shadow line for contrast */}
          <Polyline
            coordinates={routeCoords}
            strokeColor="#ffffff"
            strokeOpacity={0.95}
            strokeWidth={7}
            lineCap="round"
            lineJoin="round"
            geodesic
          />
          {/* Core Vibrant Emerald line */}
          <Polyline
            coordinates={routeCoords}
            strokeColor="#059669"
            strokeOpacity={1}
            strokeWidth={4}
            lineCap="round"
            lineJoin="round"
            geodesic
          />

          {/* Start Point Marker */}
          {routeCoords[0] && (
            <Marker
              coordinate={routeCoords[0]}
              title="Trip Start"
              tracksViewChanges={false}
              zIndex={80}
            >
              <View style={styles.waypointPinStart}>
                <Text style={styles.waypointText}>S</Text>
              </View>
            </Marker>
          )}

          {/* Current / End Point Marker */}
          {routeCoords.length > 1 && routeCoords[routeCoords.length - 1] && (
            <Marker
              coordinate={routeCoords[routeCoords.length - 1]}
              title="Current Position"
              tracksViewChanges={false}
              zIndex={90}
            >
              <View style={styles.waypointPinEnd}>
                <View style={styles.waypointPinEndInner} />
              </View>
            </Marker>
          )}
        </>
      )}
    </MapView>
  );
});

const styles = StyleSheet.create({
  unifiedPin: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinBody: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 24,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(16, 185, 129, 0.35)',
  },
  avatarImg: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  avatarInitial: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitialText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 12,
  },
  nameText: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 11.5,
    maxWidth: 85,
  },
  kmBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 12,
    borderWidth: 1,
  },
  kmText: {
    fontWeight: '800',
    fontSize: 10.5,
    letterSpacing: 0.2,
  },
  pinTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
  waypointPinStart: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#0284c7',
    borderWidth: 2,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  waypointText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
  },
  waypointPinEnd: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(5, 150, 105, 0.3)',
    borderWidth: 2,
    borderColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  waypointPinEndInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#059669',
  },
});

export default MapViewComponent;
