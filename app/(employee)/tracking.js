import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { Compass, Users } from 'lucide-react-native';
import TrackingScreen from '../../screens/employee/TrackingScreen';
import AdminTrackingScreen from '../../screens/admin/AdminTrackingScreen';

const FONT = Platform.OS === 'web' ? 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' : Platform.OS === 'ios' ? 'System' : 'sans-serif-medium';

export default function DynamicTrackingScreen() {
  const { user } = useAuth();
  const searchParams = useLocalSearchParams();
  const hasTargetEmployee = Boolean(searchParams?.employeeId || searchParams?.sessionId);

  const [activeTab, setActiveTab] = useState(hasTargetEmployee ? 'team-monitor' : 'my-tracking');

  useEffect(() => {
    if (searchParams?.employeeId || searchParams?.sessionId) {
      setActiveTab('team-monitor');
    }
  }, [searchParams?.employeeId, searchParams?.sessionId]);

  if (!user) {
    return null;
  }

  const roleUpper = user?.role ? String(user.role).toUpperCase() : '';

  // Regular employees get their personal tracking screen
  if (roleUpper === 'EMPLOYEE') {
    return <TrackingScreen />;
  }

  // Admins (not managers) get the team monitoring screen
  if (roleUpper === 'ADMIN' || roleUpper === 'SUPER_ADMIN' || roleUpper === 'ORG_ADMIN') {
    return (
      <AdminTrackingScreen
        employeeId={searchParams?.employeeId}
        sessionId={searchParams?.sessionId}
      />
    );
  }

  // MANAGERS get BOTH: personal tracking + team monitoring with tabs
  return (
    <View style={styles.container}>
      {/* ── SLEEK SEGMENTED SWITCHER ── */}
      <SafeAreaView edges={['top']} style={styles.topBarSafe}>
        <View style={styles.tabContainer}>
          <View style={styles.segmentedTrack}>
            <TouchableOpacity
              style={[styles.segmentBtn, activeTab === 'my-tracking' && styles.segmentBtnActive]}
              onPress={() => setActiveTab('my-tracking')}
              activeOpacity={0.8}
            >
              <Compass
                size={16}
                color={activeTab === 'my-tracking' ? '#ffffff' : '#64748b'}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.segmentText, activeTab === 'my-tracking' && styles.segmentTextActive]}>
                My Tracking
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.segmentBtn, activeTab === 'team-monitor' && styles.segmentBtnActive]}
              onPress={() => setActiveTab('team-monitor')}
              activeOpacity={0.8}
            >
              <Users
                size={16}
                color={activeTab === 'team-monitor' ? '#ffffff' : '#64748b'}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.segmentText, activeTab === 'team-monitor' && styles.segmentTextActive]}>
                Team Live Map
              </Text>
              {hasTargetEmployee && (
                <View style={[styles.targetIndicatorDot, activeTab === 'team-monitor' && styles.targetIndicatorDotActive]} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {/* Tab Content */}
      <View style={styles.content}>
        {activeTab === 'my-tracking' ? (
          <TrackingScreen />
        ) : (
          <AdminTrackingScreen
            employeeId={searchParams?.employeeId}
            sessionId={searchParams?.sessionId}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  topBarSafe: {
    backgroundColor: '#ffffff',
  },
  tabContainer: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  segmentedTrack: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  segmentBtnActive: {
    backgroundColor: '#0f766e',
    elevation: 2,
    shadowColor: '#0f766e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    fontFamily: FONT,
  },
  segmentTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  targetIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginLeft: 6,
  },
  targetIndicatorDotActive: {
    backgroundColor: '#34d399',
  },
  content: {
    flex: 1,
  },
});
