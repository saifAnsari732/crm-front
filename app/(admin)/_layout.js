import React, { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { ActivityIndicator, Text, TouchableOpacity, View, Platform } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';

export default function AdminLayout() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const roleUpper = user?.role ? String(user.role).toUpperCase() : '';
  const isAdminOrManager = ['ADMIN', 'ORG_ADMIN', 'HR', 'MANAGER', 'SUPER_ADMIN', 'SUPERADMIN'].includes(roleUpper);

  useEffect(() => {
    if (!isLoading && user && !isAdminOrManager) {
      router.replace('/(employee)/dashboard');
    }
  }, [isAdminOrManager, isLoading, router, user]);

  if (isLoading || !isAdminOrManager) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f4f8fb' }}>
        <ActivityIndicator size="large" color="#0a3d3c" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f4f8fb' }}>
      <Stack
        screenOptions={{
          headerShown: false,
          headerBackTitleVisible: false,
          headerTintColor: '#ffffff',
          headerTitleAlign: 'center',
          headerTitleStyle: { color: '#ffffff', fontWeight: '800', fontSize: 18, letterSpacing: 0.5 },
          headerBackground: () => (
            <LinearGradient
              colors={['#0a3d3c', '#0f766e']}
              style={{ flex: 1 }}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          ),
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(admin)/dashboard'))}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)',
                marginLeft: Platform.OS === 'ios' ? 0 : 10
              }}
              activeOpacity={0.8}
            >
              <ArrowLeft size={18} color="#ffffff" />
            </TouchableOpacity>
          ),
          contentStyle: { backgroundColor: '#f8fafc' },
        }}
      >
        <Stack.Screen
          name="dashboard"
          options={{
            title: 'Dashboard',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="tracking"
          options={{
            title: 'Live Track',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="monitoring"
          options={{
            title: 'All Activity',
          }}
        />
        <Stack.Screen
          name="history"
          options={{
            title: 'History',
          }}
        />
        <Stack.Screen
          name="team"
          options={{
            title: 'Team',
          }}
        />
        <Stack.Screen
          name="reports"
          options={{
            title: 'Reports',
          }}
        />
        <Stack.Screen
          name="visits"
          options={{
            title: 'Visits',
          }}
        />
        <Stack.Screen
          name="attendance"
          options={{
            title: 'Attendance',
          }}
        />
        <Stack.Screen
          name="profile"
          options={{
            title: 'Admin Profile',
          }}
        />
        <Stack.Screen
          name="organizations"
          options={{
            title: 'Organizations',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="payments"
          options={{
            title: 'Payments & Revenue',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="plans"
          options={{
            title: 'Plans & Quotas',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            title: 'System Settings',
            headerShown: false,
          }}
        />
      </Stack>
    </View>
  );
}
