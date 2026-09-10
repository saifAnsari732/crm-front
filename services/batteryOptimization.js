/**
 * batteryOptimization.js
 *
 * Utility to detect and guide users to disable battery optimization.
 * Required for: Xiaomi (MIUI), Realme (Realme UI), Samsung (OneUI),
 *               Oppo (ColorOS), Vivo (FuntouchOS) — all use aggressive battery killers.
 *
 * Without this, Android OS kills the GPS Foreground Service when app is swiped away,
 * causing km data loss mid-shift.
 */

import { Alert, Linking, Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import { storage } from './storage';
import { showCustomAlert } from '../components/GlobalAlert';

const BATTERY_OPT_SHOWN_KEY = 'battery_opt_dialog_shown';

/**
 * Opens Android battery optimization settings directly.
 * Falls back to general battery settings if direct intent fails.
 */
export async function openBatteryOptimizationSettings(packageName = 'com.kisanteam.crm') {
  if (Platform.OS !== 'android') return;

  try {
    // Try to open the exact "Ignore battery optimizations" screen for this app
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
      { data: `package:${packageName}` }
    );
  } catch (e1) {
    try {
      // Fallback: Open battery optimization list (user picks app manually)
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS
      );
    } catch (e2) {
      try {
        // Last resort: Open general battery settings
        await IntentLauncher.startActivityAsync(
          'android.settings.BATTERY_SAVER_SETTINGS'
        );
      } catch (e3) {
        // If all intents fail, open phone settings
        Linking.openSettings();
      }
    }
  }
}

/**
 * Shows a clear step-by-step dialog explaining WHY battery optimization
 * must be disabled, then opens the settings screen directly.
 *
 * Only shows ONCE per app install (stored in SecureStore).
 * Pass force=true to show it again (e.g. from Settings screen).
 */
export async function showBatteryOptimizationDialog({ force = false, packageName = 'com.kisanteam.crm' } = {}) {
  if (Platform.OS !== 'android') return;

  // Check if already shown before
  if (!force) {
    const alreadyShown = await storage.getItem(BATTERY_OPT_SHOWN_KEY);
    if (alreadyShown === 'true') return;
  }

  return new Promise((resolve) => {
    showCustomAlert(
      'Battery Setting Required',
      'Kuch phones automatically GPS tracking band kar dete hain jab app minimize hoti hai.\n\n' +
      'Distance loss rokne ke liye:\n\n' +
      '✅ Step 1: "Allow" button dabao\n' +
      '✅ Step 2: "Unrestricted" set karo\n\n' +
      'Ye sirf ek baar karna hai. Iske baad aapka koi bhi km miss nahi hoga!',
      [
        {
          text: 'Baad Mein',
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: 'Allow Karo',
          onPress: async () => {
            await storage.setItem(BATTERY_OPT_SHOWN_KEY, 'true');
            await openBatteryOptimizationSettings(packageName);
            resolve(true);
          },
        },
      ],
      'battery'
    );
  });
}

/**
 * Show a REMINDER dialog — shown every time tracking starts if battery
 * optimization was never set (i.e., user pressed "Baad Mein" before).
 */
export async function remindBatteryOptimizationIfNeeded(packageName = 'com.kisanteam.crm') {
  if (Platform.OS !== 'android') return;

  const alreadyShown = await storage.getItem(BATTERY_OPT_SHOWN_KEY);
  if (alreadyShown === 'true') return; // Already handled, don't nag

  return new Promise((resolve) => {
    showCustomAlert(
      'GPS Band Ho Sakta Hai!',
      'Aapne abhi tak Battery Optimization disable nahi ki.\n\n' +
      'Agar aap app minimize ya close karte hain, toh GPS tracking band ho sakti hai aur km data loss ho sakta hai.\n\n' +
      'Abhi fix karein?',
      [
        {
          text: 'Nahi',
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: 'Haan, Fix Karo',
          onPress: async () => {
            await storage.setItem(BATTERY_OPT_SHOWN_KEY, 'true');
            await openBatteryOptimizationSettings(packageName);
            resolve(true);
          },
        },
      ],
      'warning'
    );
  });
}
