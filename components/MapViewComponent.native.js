import React, { forwardRef } from 'react';
import { StyleSheet, View, Text, Image, Platform } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { getAvatarUrl } from '../services/api';

const cardShadow = Platform.OS === 'web'
  ? { boxShadow: '0px 4px 12px rgba(15, 23, 42, 0.18)' }
  : { elevation: 5, shadowColor: '#0f172a', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } };

const MapViewComponent = forwardRef(({
  initialRegion,
  directoryStaff,
  routeCoords,
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
    >
      {directoryStaff.map((emp, idx) => {
        if (!emp.lat || !emp.lng) return null;
        const lat = parseFloat(emp.lat);
        const lng = parseFloat(emp.lng);
        if (isNaN(lat) || isNaN(lng)) return null;
        const isLive = emp.isTracking || emp.status === 'ON_FIELD';
        const statusColor = emp.statusColor || (isLive ? '#10b981' : '#64748b');
        const kmVal = parseFloat(emp.totalDistance || 0).toFixed(1);
        const firstName = (emp.name || 'Agent').trim().split(' ')[0];

        return (
          <Marker
            key={emp._id || idx}
            coordinate={{ latitude: lat, longitude: lng }}
            title={emp.name}
            description={`${kmVal} km ${emp.address ? '• ' + emp.address : ''}`}
            onPress={() => onSelectEmployee && onSelectEmployee(emp)}
          >
            <View style={styles.unifiedPin}>
              <View style={[styles.pinBody, cardShadow]}>
                {/* Avatar Photo */}
                {getAvatarUrl(emp.avatar) ? (
                  <Image source={{ uri: getAvatarUrl(emp.avatar) }} style={styles.avatarImg} />
                ) : (
                  <View style={[styles.avatarInitial, { backgroundColor: isLive ? '#059669' : '#64748b' }]}>
                    <Text style={styles.avatarInitialText}>{(emp.name || 'E').charAt(0).toUpperCase()}</Text>
                  </View>
                )}

                {/* First Name */}
                <Text style={styles.nameText} numberOfLines={1}>{firstName}</Text>

                {/* KM Telemetry Badge */}
                <View style={[styles.kmBadge, { backgroundColor: isLive ? '#ecfdf5' : '#f1f5f9' }]}>
                  <Text style={[styles.kmText, { color: isLive ? '#047857' : '#475569' }]}>{kmVal} km</Text>
                </View>
              </View>

              {/* Teardrop Pointer Tip */}
              <View style={styles.pinTip} />
            </View>
          </Marker>
        );
      })}

      {routeCoords && routeCoords.length > 1 && (
        <>
          <Polyline coordinates={routeCoords} strokeColor="#ffffff" strokeOpacity={0.9} strokeWidth={6} lineCap="round" lineJoin="round" geodesic />
          <Polyline coordinates={routeCoords} strokeColor="#059669" strokeOpacity={1} strokeWidth={3.5} lineCap="round" lineJoin="round" geodesic />
        </>
      )}
    </MapView>
  );
});

const styles = StyleSheet.create({
  unifiedPin: { alignItems: 'center', justifyContent: 'center' },
  pinBody: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 5,
    paddingVertical: 3.5,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    gap: 5,
  },
  avatarImg: { width: 26, height: 26, borderRadius: 13 },
  avatarInitial: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  avatarInitialText: { color: '#ffffff', fontWeight: 'bold', fontSize: 11 },
  nameText: { color: '#0f172a', fontWeight: '700', fontSize: 11, maxWidth: 75 },
  kmBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  kmText: { fontWeight: '800', fontSize: 10 },
  pinTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#cbd5e1',
    marginTop: -1,
  },
});

export default MapViewComponent;
