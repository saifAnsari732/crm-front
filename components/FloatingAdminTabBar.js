import React from 'react';
import { StyleSheet, View, TouchableOpacity, Text, Platform } from 'react-native';
import { Surface } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Calendar, Users, BarChart2, Settings } from 'lucide-react-native';
import { useRouter } from 'expo-router';

const FONT = Platform.OS === 'web'
  ? 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  : Platform.OS === 'ios' ? 'System' : 'sans-serif';

export default function FloatingAdminTabBar({ activeTab = 'dashboard' }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const normalizedActive = activeTab === 'monitoring' ? 'team' : activeTab;

  const tabs = [
    { key: 'dashboard', label: 'Home', path: '/(admin)/dashboard', Icon: Home },
    { key: 'attendance', label: 'Attendance', path: '/(admin)/attendance', Icon: Calendar },
    { key: 'team', label: 'My Team', path: '/(admin)/team', Icon: Users },
    { key: 'reports', label: 'Reports', path: '/(admin)/reports', Icon: BarChart2 },
    { key: 'settings', label: 'Settings', path: '/(admin)/settings', Icon: Settings },
  ];

  const bottomPadding = Platform.OS === 'web'
    ? 12
    : Math.max(insets.bottom || 0, Platform.OS === 'ios' ? 22 : 14);

  return (
    <View style={styles.bottomTabBarContainer} pointerEvents="box-none">
      <Surface
        style={[
          styles.bottomTabBarSurface,
          { paddingBottom: bottomPadding }
        ]}
        elevation={24}
      >
        {tabs.map((tab) => {
          const isActive = normalizedActive === tab.key;
          const IconComponent = tab.Icon;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tabBarItem}
              onPress={() => {
                if (!isActive) {
                  router.push(tab.path);
                }
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.tabBarIconWrap, isActive && styles.tabBarIconWrapActive]}>
                <IconComponent
                  size={isActive ? 22 : 21}
                  color={isActive ? '#4F46E5' : '#475569'}
                  strokeWidth={isActive ? 2.3 : 1.9}
                />
              </View>

              <Text
                style={[styles.tabBarLabel, isActive && styles.tabBarLabelActive]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>

              {isActive && <View style={styles.activeDotIndicator} />}
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
    elevation: 32,
  },
  bottomTabBarSurface: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    paddingTop: 10,
    paddingHorizontal: 12,
    borderTopWidth: 1.5,
    borderTopColor: '#CBD5E1',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 -8px 28px rgba(15, 23, 42, 0.12)' }
      : {
          shadowColor: '#0F172A',
          shadowOpacity: 0.16,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: -5 },
          elevation: 24,
        }),
  },
  tabBarItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 2,
    position: 'relative',
  },
  tabBarIconWrap: {
    width: 48,
    height: 34,
    borderRadius: 14,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    transition: 'all 0.18s ease-in-out',
  },
  tabBarIconWrapActive: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    transform: [{ scale: 1.05 }],
  },
  activeDotIndicator: {
    position: 'absolute',
    bottom: -6,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#4F46E5',
  },
  tabBarLabel: {
    fontSize: 11.5,
    fontWeight: '500',
    color: '#475569',
    marginTop: 3,
    letterSpacing: -0.2,
    fontFamily: FONT,
  },
  tabBarLabelActive: {
    color: '#4F46E5',
    fontWeight: '600',
  },
});
