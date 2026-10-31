/**
 * batteryOptimization.js
 *
 * Utility to detect and guide users to disable battery optimization.
 * Required for: Xiaomi (MIUI/HyperOS), Realme (Realme UI), Samsung (OneUI),
 *               Oppo (ColorOS), Vivo (FuntouchOS) — all use aggressive battery killers.
 *
 * Integrated with Native KeepAliveModule for CPU Partial WakeLock and
 * OS-level battery optimization whitelist enforcement.
 */

import { Alert, Linking, Platform, NativeModules } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import { storage } from './storage';
import { showCustomAlert } from '../components/GlobalAlert';

const { KeepAliveModule } = NativeModules;
const BATTERY_OPT_SHOWN_KEY = 'battery_opt_dialog_shown';

/**
 * Check if app is already exempt / unrestricted from battery optimization
 */
export async function isBatteryOptimizationExempt() {
  if (Platform.OS !== 'android') return true;
  try {
    if (KeepAliveModule && typeof KeepAliveModule.isIgnoringBatteryOptimizations === 'function') {
      return await KeepAliveModule.isIgnoringBatteryOptimizations();
    }
  } catch (_) {}
  return false;
}

/**
 * Opens Android battery optimization settings directly.
 */
export async function openBatteryOptimizationSettings(packageName = 'com.kisanteam.crm') {
  if (Platform.OS !== 'android') return;

  try {
    if (KeepAliveModule && typeof KeepAliveModule.requestIgnoreBatteryOptimizations === 'function') {
      const ok = await KeepAliveModule.requestIgnoreBatteryOptimizations();
      if (ok) return;
    }
  } catch (_) {}

  try {
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
      { data: `package:${packageName}` }
    );
  } catch (e1) {
    try {
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS
      );
    } catch (e2) {
      try {
        await IntentLauncher.startActivityAsync(
          'android.settings.BATTERY_SAVER_SETTINGS'
        );
      } catch (e3) {
        Linking.openSettings();
      }
    }
  }
}

/**
 * Acquire CPU Partial WakeLock for active tracking session (survives screen lock)
 */
export async function startCpuKeepAlive() {
  if (Platform.OS !== 'android') return;
  try {
    if (KeepAliveModule && typeof KeepAliveModule.startKeepAlive === 'function') {
      await KeepAliveModule.startKeepAlive();
      console.log('🛡️ [CPU_WAKELOCK] Background CPU keep-alive activated for shift.');
    }
  } catch (err) {
    console.warn('⚠️ [CPU_WAKELOCK] Failed to activate keep-alive:', err.message);
  }
}

/**
 * Release CPU Partial WakeLock when duty ends (preserves battery off-duty)
 */
export async function stopCpuKeepAlive() {
  if (Platform.OS !== 'android') return;
  try {
    if (KeepAliveModule && typeof KeepAliveModule.stopKeepAlive === 'function') {
      await KeepAliveModule.stopKeepAlive();
      console.log('🛑 [CPU_WAKELOCK] Background CPU keep-alive released.');
    }
  } catch (err) {
    console.warn('⚠️ [CPU_WAKELOCK] Failed to release keep-alive:', err.message);
  }
}

/**
 * Enforce battery optimization exemption check before punch in
 */
export async function ensureBatteryOptimizationExempt(packageName = 'com.kisanteam.crm') {
  if (Platform.OS !== 'android') return true;

  const isExempt = await isBatteryOptimizationExempt();
  if (isExempt) {
    console.log('✅ [BATTERY_GUARD] App is already unrestricted from battery optimization.');
    return true;
  }

  return new Promise((resolve) => {
    showCustomAlert(
      'Screen-Off Tracking Settings',
      'Phone lock / pocket me hone par bhi KM accurate count hota rahe, iske liye battery setting ko "Unrestricted" / "No restrictions" par set karein.\n\n' +
      'Agle dialog me "Allow" select karein.',
      [
        {
          text: 'Allow Karein',
          onPress: async () => {
            await openBatteryOptimizationSettings(packageName);
            await storage.setItem(BATTERY_OPT_SHOWN_KEY, 'true');
            resolve(true);
          },
        },
        {
          text: 'Baad Mein',
          style: 'cancel',
          onPress: () => resolve(false),
        }
      ],
      'battery'
    );
  });
}

/**
 * Legacy compatibility wrappers
 */
export async function showBatteryOptimizationDialog(opts) {
  return ensureBatteryOptimizationExempt(opts?.packageName);
}

export async function remindBatteryOptimizationIfNeeded(packageName = 'com.kisanteam.crm') {
  return ensureBatteryOptimizationExempt(packageName);
}
