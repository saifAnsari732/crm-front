import React, { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';

const BRAND = {
  navy: '#283b96',
  muted: '#64748b',
  border: '#dbe7ef',
  surface: '#ffffff',
};

export default function AdminLayout() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'hr';

  useEffect(() => {
    if (!isLoading && user && !isAdmin) {
      router.replace('/(employee)/dashboard');
    }
  }, [isAdmin, isLoading, router, user]);

  if (isLoading || !isAdmin) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f4f8fb' }}>
        <ActivityIndicator size="large" color={BRAND.navy} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f4f8fb' }}>
      <Stack
        screenOptions={{
          headerShown: true,
          headerBackTitle: 'Back',
          headerTintColor: BRAND.navy,
          headerStyle: { backgroundColor: BRAND.surface },
          headerTitleStyle: { color: BRAND.navy, fontWeight: '800' },
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(admin)/dashboard'))}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 12 }}
              accessibilityLabel="Go back"
            >
              <ArrowLeft size={20} color={BRAND.navy} />
              <Text style={{ color: BRAND.navy, fontWeight: '700' }}>Back</Text>
            </TouchableOpacity>
          ),
          contentStyle: { backgroundColor: '#f4f8fb' },
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
      </Stack>
    </View>
  );
}
