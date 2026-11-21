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
  if (Platform.OS !== 'android') {
    Alert.alert(
      'Battery Optimization',
      'Battery optimization settings are available on Android devices. Make sure background app refresh and location are set to Always in phone settings.'
    );
    return;
  }

  // 1. Try Native KeepAliveModule if available
  try {
    if (KeepAliveModule && typeof KeepAliveModule.requestIgnoreBatteryOptimizations === 'function') {
      const ok = await KeepAliveModule.requestIgnoreBatteryOptimizations();
      if (ok) return;
    }
  } catch (_) {}

  // 2. Direct intent request for ignoring battery optimizations for this package
  try {
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
      { data: `package:${packageName}` }
    );
    return;
  } catch (e1) {
    console.log('Action REQUEST_IGNORE_BATTERY_OPTIMIZATIONS failed, trying general ignore settings...');
  }

  // 3. Fallback to Ignore Battery Optimization Settings list
  try {
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS
    );
    return;
  } catch (e2) {
    console.log('Action IGNORE_BATTERY_OPTIMIZATION_SETTINGS failed, trying device power/battery saver...');
  }

  // 4. Fallback to Battery Saver / Power usage settings
  try {
    await IntentLauncher.startActivityAsync('android.settings.BATTERY_SAVER_SETTINGS');
    return;
  } catch (e3) {
    console.log('Action BATTERY_SAVER_SETTINGS failed, opening app details...');
  }

  // 5. Fallback to App Application Details settings
  try {
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
      { data: `package:${packageName}` }
    );
    return;
  } catch (e4) {
    // 6. Final fallback: general OS settings
    Linking.openSettings();
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

// Module-level guard to prevent multiple dialogs from opening simultaneously
let _isBatteryAlertActive = false;

/**
 * Enforce battery optimization exemption check
 * @param {string} packageName 
 * @param {boolean} force - If false, honors previously dismissed state so it doesn't spam user
 */
export async function ensureBatteryOptimizationExempt(packageName = 'com.kisanteam.crm', force = false) {
  if (Platform.OS !== 'android') return true;

  const isExempt = await isBatteryOptimizationExempt();
  if (isExempt) {
    console.log('✅ [BATTERY_GUARD] App is already unrestricted from battery optimization.');
    await storage.setItem(BATTERY_OPT_SHOWN_KEY, 'true').catch(() => {});
    return true;
  }

  // If already shown/dismissed and not explicitly forced, do not interrupt the user!
  if (!force) {
    const alreadyShown = await storage.getItem(BATTERY_OPT_SHOWN_KEY);
    if (alreadyShown === 'true') {
      return false;
    }
  }

  // Guard against multiple simultaneous dialogs from multiple hook instances
  if (_isBatteryAlertActive) {
    return false;
  }
  _isBatteryAlertActive = true;

  return new Promise((resolve) => {
    showCustomAlert(
      'Screen-Off Tracking Settings',
      'Phone lock / pocket me hone par bhi KM accurate count hota rahe, iske liye battery setting ko "Unrestricted" / "No restrictions" par set karein.\n\n' +
      'Agle dialog me "Allow" select karein.',
      [
        {
          text: 'Allow Karein',
          onPress: async () => {
            _isBatteryAlertActive = false;
            await storage.setItem(BATTERY_OPT_SHOWN_KEY, 'true').catch(() => {});
            await openBatteryOptimizationSettings(packageName);
            resolve(true);
          },
        },
        {
          text: 'Baad Mein',
          style: 'cancel',
          onPress: async () => {
            _isBatteryAlertActive = false;
            await storage.setItem(BATTERY_OPT_SHOWN_KEY, 'true').catch(() => {});
            resolve(false);
          },
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
  const alreadyShown = await storage.getItem(BATTERY_OPT_SHOWN_KEY);
  if (alreadyShown === 'true') {
    return false;
  }
  return ensureBatteryOptimizationExempt(opts?.packageName, false);
}

export async function remindBatteryOptimizationIfNeeded(packageName = 'com.kisanteam.crm') {
  return ensureBatteryOptimizationExempt(packageName, false);
}
