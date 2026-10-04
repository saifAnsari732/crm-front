import React, { forwardRef } from 'react';
import { StyleSheet, View, Text, Image } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { getAvatarUrl } from '../services/api';

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
            description={`${kmVal} km • ${emp.address}`}
            onPress={() => onSelectEmployee && onSelectEmployee(emp)}
          >
            <View style={styles.markerCard}>
              {/* Top Name & KM Badge Pill */}
              <View style={[styles.namePill, { backgroundColor: isLive ? '#074e26' : '#1e293b' }]}>
                <View style={[styles.livePulseDot, { backgroundColor: statusColor }]} />
                <Text style={styles.namePillText} numberOfLines={1}>{firstName}</Text>
                <Text style={styles.kmBadgeText}>{kmVal}km</Text>
              </View>

              {/* Circular Avatar Pin */}
              <View style={[styles.avatarCircleWrap, { borderColor: statusColor }]}>
                {getAvatarUrl(emp.avatar) ? (
                  <Image source={{ uri: getAvatarUrl(emp.avatar) }} style={styles.markerAvatar} />
                ) : (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: isLive ? '#059669' : '#475569' }]}>
                    <Text style={styles.avatarText}>{(emp.name || 'E').charAt(0).toUpperCase()}</Text>
                  </View>
                )}
              </View>

              {/* Pin Pointer Arrow */}
              <View style={[styles.pinArrow, { borderTopColor: statusColor }]} />
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
  markerCard: { alignItems: 'center', justifyContent: 'center' },
  namePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginBottom: 2,
    elevation: 5,
    shadowColor: '#0f172a',
    shadowOpacity: 0.25,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  livePulseDot: { width: 6, height: 6, borderRadius: 3 },
  namePillText: { color: '#ffffff', fontSize: 10, fontWeight: '800', maxWidth: 80 },
  kmBadgeText: { color: '#a7f3d0', fontSize: 9, fontWeight: '800' },
  avatarCircleWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2.5,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#0f172a',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  markerAvatar: { width: 33, height: 33, borderRadius: 16.5 },
  avatarPlaceholder: { width: 33, height: 33, borderRadius: 16.5, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#ffffff', fontWeight: '800', fontSize: 13 },
  pinArrow: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
});

export default MapViewComponent;
