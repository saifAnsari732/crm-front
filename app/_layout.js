import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { PaperProvider } from 'react-native-paper';
import { useRouter, useSegments } from 'expo-router';
import { View, ActivityIndicator, Platform } from 'react-native';
import { AuthProvider, useAuth } from '../context/AuthContext';
import AnimatedSplash from '../components/AnimatedSplash';

// CRITICAL: Import background location task at root level so it is registered upon app boot
import '../services/locationTask';
// CRITICAL: Import offline sync so the background-fetch task is registered upon app boot
import '../services/offlineSync';
// CRITICAL: Import trip planner background task so it is registered upon app boot
import '../services/tripPlannerBackground';
import { registerOfflineSyncTask, startNetworkListener, flushOfflineQueue } from '../services/offlineSync';

SplashScreen.preventAutoHideAsync();

export { ErrorBoundary } from 'expo-router';

// Splash must play only once per JS session — not on tab changes / remounts
let splashCompleted = false;

function InitialLayout() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [showSplash, setShowSplash] = useState(!splashCompleted);

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
    const inAdminGroup = segments.some(s => s === '(admin)');
    const roleUpper = user?.role ? String(user.role).toUpperCase() : '';
    const isAdminOrManager = ['ADMIN', 'ORG_ADMIN', 'HR', 'MANAGER', 'SUPER_ADMIN', 'SUPERADMIN'].includes(roleUpper);

    if (!user) {
      // Unauthenticated: force redirection to Login Screen
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
    } else if (isAdminOrManager) {
      // Admin/Manager/HR: route to admin workspace
      if (!inAdminGroup) {
        console.log(`🏃 Navigation: Routing admin/manager ${user.name} to admin workspace.`);
        router.replace('/(admin)/dashboard');
      }
    } else {
      // Regular employee: route directly to employee workspace
      if (!inEmployeeGroup) {
        console.log(`🏃 Navigation: Routing authenticated user ${user.name} to employee workspace.`);
        router.replace('/(employee)/dashboard');
      }
    }
  }, [user, segments, isLoading, showSplash]);

  useEffect(() => {
    if (!isLoading && !showSplash) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoading, showSplash]);

  const finishSplash = () => {
    splashCompleted = true;
    setShowSplash(false);
  };

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)/login" options={{ animation: 'fade' }} />
        <Stack.Screen name="(auth)/register" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="(employee)" options={{ animation: 'none' }} />
        <Stack.Screen name="(admin)" options={{ animation: 'none' }} />
      </Stack>

      {isLoading && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: '#002020', zIndex: 9998 }}>
          <ActivityIndicator size="large" color="#008080" />
        </View>
      )}

      {!isLoading && showSplash && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}>
          <AnimatedSplash onFinish={finishSplash} />
        </View>
      )}
    </View>
  );
}

import { SettingsProvider } from '../context/SettingsContext';
import { NotificationProvider } from '../context/NotificationContext';
import NotificationBanner from '../components/NotificationBanner';
import GlobalAlert, { globalAlertRef } from '../components/GlobalAlert';
import UpdatePromptModal from '../components/UpdatePromptModal';

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const styleId = 'kisan-clean-typography-style';
      if (!document.getElementById(styleId)) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap';
        document.head.appendChild(link);

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          * {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }
        `;
        document.head.appendChild(style);
      }
    }
  }, []);

  return (
    <PaperProvider>
      <AuthProvider>
        <SettingsProvider>
          <NotificationProvider>
            <InitialLayout />
            <NotificationBanner />
            <GlobalAlert ref={globalAlertRef} />
            <UpdatePromptModal />
          </NotificationProvider>
        </SettingsProvider>
      </AuthProvider>
    </PaperProvider>
  );
}
