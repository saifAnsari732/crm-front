import React, { useRef, useEffect } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

export default function TripMapView({
  origin,
  destination,
  polyline = [],
  traveledTrail = [],
  currentLocation,
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
          edgePadding: { top: 90, right: 60, bottom: 240, left: 60 },
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

  const defaultRegion = {
    latitude: Number(origin?.lat || destination?.lat || currentLocation?.latitude || 28.6139),
    longitude: Number(origin?.lng || destination?.lng || currentLocation?.longitude || 77.2090),
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  };

  return (
    <View style={[styles.container, style]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_GOOGLE}
        initialRegion={defaultRegion}
        showsUserLocation={true}
        showsCompass={true}
        showsMyLocationButton={false}
      >
        {/* Origin Marker (Point A - Green Pin) */}
        {origin?.lat && origin?.lng && (
          <Marker
            coordinate={{ latitude: Number(origin.lat), longitude: Number(origin.lng) }}
            title="Point A (Origin)"
            description={origin.address || 'Starting point'}
          >
            <View style={styles.markerContainer}>
              <View style={[styles.markerBadge, styles.originBadge]}>
                <Text style={styles.originMarkerText}>A</Text>
              </View>
              <View style={[styles.markerArrow, styles.originArrow]} />
            </View>
          </Marker>
        )}

        {/* Destination Marker (Point B - Red Pin) */}
        {destination?.lat && destination?.lng && (
          <Marker
            coordinate={{ latitude: Number(destination.lat), longitude: Number(destination.lng) }}
            title="Point B (Destination)"
            description={destination.address || 'Drop/Meeting location'}
          >
            <View style={styles.markerContainer}>
              <View style={[styles.markerBadge, styles.destBadge]}>
                <Text style={styles.destMarkerText}>B</Text>
              </View>
              <View style={[styles.markerArrow, styles.destArrow]} />
            </View>
          </Marker>
        )}

        {/* Driving Route Polyline */}
        {polyline && polyline.length > 1 && (
          <>
            {/* Outer white casing border */}
            <Polyline
              coordinates={polyline}
              strokeColor="#ffffff"
              strokeWidth={7}
              lineCap="round"
              lineJoin="round"
              geodesic
            />
            {/* Inner primary route color */}
            <Polyline
              coordinates={polyline}
              strokeColor="#2563eb"
              strokeWidth={4.5}
              lineCap="round"
              lineJoin="round"
              geodesic
            />
          </>
        )}

        {/* Real-time Traveled Trail Polyline (Emerald Green) */}
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
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#ffffff',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  originBadge: {
    backgroundColor: '#10b981',
  },
  destBadge: {
    backgroundColor: '#ef4444',
  },
  originMarkerText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 14,
  },
  destMarkerText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 14,
  },
  markerArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
  originArrow: {
    borderTopColor: '#10b981',
  },
  destArrow: {
    borderTopColor: '#ef4444',
  },
});
