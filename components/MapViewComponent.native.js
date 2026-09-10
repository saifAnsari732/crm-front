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
        const statusColor = emp.statusColor || (emp.isTracking ? '#16a34a' : '#94a3b8');

        return (
          <Marker
            key={emp._id || idx}
            coordinate={{ latitude: lat, longitude: lng }}
            title={emp.name}
            description={`${(emp.totalDistance || 0).toFixed(2)} km - ${emp.address}`}
            onPress={() => onSelectEmployee && onSelectEmployee(emp)}
          >
            <View style={styles.markerContainer}>
              {getAvatarUrl(emp.avatar) ? (
                <Image source={{ uri: getAvatarUrl(emp.avatar) }} style={[styles.markerAvatar, { borderColor: statusColor }]} />
              ) : (
                <View style={[styles.markerAvatarPlaceholder, { borderColor: statusColor }]}>
                  <Text style={styles.markerText}>{(emp.name || 'E').charAt(0)}</Text>
                </View>
              )}
              <View style={[styles.markerStatusDot, { backgroundColor: statusColor }]} />
            </View>
          </Marker>
        );
      })}

      {routeCoords && routeCoords.length > 1 && (
        <>
          <Polyline coordinates={routeCoords} strokeColor="#0f172a" strokeOpacity={0.78} strokeWidth={11} lineCap="round" lineJoin="round" geodesic />
          <Polyline coordinates={routeCoords} strokeColor="#14b8a6" strokeOpacity={1} strokeWidth={6} lineCap="round" lineJoin="round" geodesic />
        </>
      )}
    </MapView>
  );
});

const styles = StyleSheet.create({
  markerContainer: { alignItems: 'center', justifyContent: 'center' },
  markerAvatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: '#16a34a' },
  markerAvatarPlaceholder: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#0a3d3c', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  markerText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  markerStatusDot: { width: 8, height: 8, borderRadius: 4, position: 'absolute', bottom: -2, right: -2, borderWidth: 1, borderColor: '#fff' },
});

export default MapViewComponent;
