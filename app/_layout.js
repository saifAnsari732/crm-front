import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { PaperProvider } from 'react-native-paper';
import { useRouter, useSegments } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { AuthProvider, useAuth } from '../context/AuthContext';
import AnimatedSplash from '../components/AnimatedSplash';

// CRITICAL: Import background location task at root level so it is registered upon app boot
import '../services/locationTask';
// CRITICAL: Import offline sync so the background-fetch task is registered upon app boot
import '../services/offlineSync';
import { registerOfflineSyncTask, startNetworkListener, flushOfflineQueue } from '../services/offlineSync';

SplashScreen.preventAutoHideAsync();

export { ErrorBoundary } from 'expo-router';

function InitialLayout() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [showSplash, setShowSplash] = useState(true);

  // ── Bootstrap offline resilience on app start ────────────────────────────
  useEffect(() => {
    registerOfflineSyncTask();   // Register OS-level background-fetch
    startNetworkListener();      // Auto-flush when internet returns
    flushOfflineQueue();         // Immediately flush any leftovers from last session
  }, []);

  useEffect(() => {
    if (isLoading || showSplash) return;

    const inAuthGroup = segments.some(s => s === '(auth)');
    const inEmployeeGroup = segments.some(s => s === '(employee)');

    if (!user) {
      // Unauthenticated: force redirection to Login Screen
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
    } else {
      // Authenticated: route directly to employee workspace
      if (!inEmployeeGroup) {
        console.log(`🏃 Navigation: Routing authenticated user ${user.name} to employee workspace.`);
        router.replace('/(employee)/dashboard');
      }
    }
  }, [user, segments, isLoading, showSplash]);

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#002020' }}>
        <ActivityIndicator size="large" color="#008080" />
      </View>
    );
  }

  if (showSplash) {
    return <AnimatedSplash onFinish={() => setShowSplash(false)} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)/login" options={{ animation: 'fade' }} />
      <Stack.Screen name="(auth)/register" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="(employee)" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}

import { SettingsProvider } from '../context/SettingsContext';
import { NotificationProvider } from '../context/NotificationContext';
import NotificationBanner from '../components/NotificationBanner';

export default function RootLayout() {
  return (
    <PaperProvider>
      <AuthProvider>
        <SettingsProvider>
          <NotificationProvider>
            <InitialLayout />
            <NotificationBanner />
          </NotificationProvider>
        </SettingsProvider>
      </AuthProvider>
    </PaperProvider>
  );
}
