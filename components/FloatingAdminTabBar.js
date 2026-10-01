import React from 'react';
import { StyleSheet, View, TouchableOpacity, Text, Platform } from 'react-native';
import { Surface } from 'react-native-paper';
import { LayoutDashboard, MapPin, Users, FileText, Settings } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function FloatingAdminTabBar({ activeTab = 'dashboard' }) {
  const router = useRouter();

  const tabs = [
    { key: 'dashboard', label: 'Home', path: '/(admin)/dashboard', Icon: LayoutDashboard },
    { key: 'tracking', label: 'Live Map', path: '/(admin)/tracking', Icon: MapPin },
    { key: 'monitoring', label: 'Workforce', path: '/(admin)/monitoring', Icon: Users },
    { key: 'reports', label: 'Reports', path: '/(admin)/reports', Icon: FileText },
    { key: 'settings', label: 'Settings', path: '/(admin)/settings', Icon: Settings },
  ];

  return (
    <View style={styles.bottomTabBarContainer} pointerEvents="box-none">
      <Surface style={styles.bottomTabBarSurface} elevation={10}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const IconComponent = tab.Icon;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tabBarItem}
              onPress={() => router.push(tab.path)}
              activeOpacity={0.75}
            >
              <View style={[styles.tabBarIconBox, isActive && styles.tabBarIconBoxActive]}>
                <IconComponent size={20} color={isActive ? '#059669' : '#64748b'} />
              </View>
              <Text style={[styles.tabBarLabel, isActive && styles.tabBarLabelActive]}>
                {tab.label}
              </Text>
              {isActive && <View style={styles.activeTabDot} />}
            </TouchableOpacity>
          );
        })}
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomTabBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 16,
  },
  bottomTabBarSurface: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 54 : 50,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(15, 23, 42, 0.08)',
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 16,
  },
  tabBarItem: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  tabBarIconBox: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  tabBarIconBoxActive: { backgroundColor: '#ecfdf5' },
  tabBarLabel: { fontSize: 10, fontWeight: '600', color: '#64748b', marginTop: 2 },
  tabBarLabelActive: { color: '#059669', fontWeight: '800' },
  activeTabDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#059669', marginTop: 2 },
});
