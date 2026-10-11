import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import TrackingScreen from '../../screens/employee/TrackingScreen';
import AdminMonitoringScreen from '../../screens/admin/AdminMonitoringScreen';

export default function DynamicTrackingScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('my-tracking');

  // Regular employees get their personal tracking screen
  if (user?.role === 'employee') {
    return <TrackingScreen />;
  }

  // Admins (not managers) get the team monitoring screen
  if (user?.role === 'admin' || user?.role === 'super_admin') {
    return <AdminMonitoringScreen />;
  }

  // MANAGERS get BOTH: personal tracking + team monitoring with tabs
  return (
    <View style={styles.container}>
      {/* Tab Header */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'my-tracking' && styles.activeTab]}
          onPress={() => setActiveTab('my-tracking')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === 'my-tracking' && styles.activeTabText]}>
            My Tracking
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'team-monitor' && styles.activeTab]}
          onPress={() => setActiveTab('team-monitor')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === 'team-monitor' && styles.activeTabText]}>
            Team Monitor
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      <View style={styles.content}>
        {activeTab === 'my-tracking' ? <TrackingScreen /> : <AdminMonitoringScreen />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    marginHorizontal: 4,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
    borderRadius: 4,
  },
  activeTab: {
    borderBottomColor: '#4f46e5',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    letterSpacing: 0.3,
  },
  activeTabText: {
    color: '#4f46e5',
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
});

