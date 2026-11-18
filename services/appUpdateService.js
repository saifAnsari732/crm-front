import { Platform, Linking } from 'react-native';
import Constants from 'expo-constants';
import axios from 'axios';
import { storage } from './storage';
import { BASE_URL } from './api';

const PACKAGE_NAME = 'com.kisanteam.crm';
const LAST_UPDATE_CHECK_KEY = 'last_app_update_check_time';
const DISMISSED_UPDATE_VERSION_KEY = 'dismissed_app_update_version';

/**
 * Compare two semver strings: e.g. "1.0.40" vs "1.0.39"
 * Returns:
 *   1 if v1 > v2
 *  -1 if v1 < v2
 *   0 if v1 === v2
 */
export function compareVersions(v1, v2) {
  if (!v1 || !v2) return 0;
  const p1 = String(v1).split('.').map(n => parseInt(n, 10) || 0);
  const p2 = String(v2).split('.').map(n => parseInt(n, 10) || 0);

  const len = Math.max(p1.length, p2.length);
  for (let i = 0; i < len; i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

/**
 * Get current installed app version from Expo Constants or package
 */
export function getInstalledVersion() {
  return (
    Constants.expoConfig?.version ||
    Constants.manifest2?.extra?.expoClient?.version ||
    '1.0.41'
  );
}

/**
 * Strategy 1: Check backend API for latest release metadata & force update flags
 */
async function fetchLatestVersionFromBackend() {
  try {
    const res = await axios.get(`${BASE_URL}/app-version`, { timeout: 4000 });
    if (res.data && res.data.success && res.data.version) {
      return {
        latestVersion: res.data.version,
        minRequiredVersion: res.data.minRequiredVersion || null,
        forceUpdate: !!res.data.forceUpdate,
        releaseNotes: res.data.releaseNotes || null,
        storeUrl: res.data.storeUrl || null
      };
    }
  } catch (_) {
    // Backend endpoint might be unreachable or optional, fall back to Play Store scraper
  }
  return null;
}

/**
 * Strategy 2: Direct Google Play Store live scrape
 * Reads public store page for com.kisanteam.crm without needing backend proxy
 */
async function fetchLatestVersionFromPlayStore() {
  try {
    const playUrl = `https://play.google.com/store/apps/details?id=${PACKAGE_NAME}&hl=en`;
    const res = await axios.get(playUrl, {
      timeout: 6000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
      }
    });

    if (res.data) {
      const html = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      // Google Play Store embeds version array inside ds callbacks e.g.: "141":[[["1.0.40"]]]
      const match = html.match(/"141":\[\[\["([0-9.]+)"\]\]/);
      if (match && match[1]) {
        return {
          latestVersion: match[1],
          forceUpdate: false,
          releaseNotes: null,
          storeUrl: `market://details?id=${PACKAGE_NAME}`
        };
      }
    }
  } catch (err) {
    console.log('[AppUpdateService] Play Store check fallback skipped:', err.message);
  }
  return null;
}

/**
 * Main Check Function:
 * Returns { updateAvailable: boolean, currentVersion, latestVersion, forceUpdate, storeUrl }
 * Only returns updateAvailable = true if latestVersion > installedVersion!
 */
export async function checkAppUpdate(forceCheck = false) {
  // Only mobile apps need Play Store update prompts (web auto-refreshes bundle)
  if (Platform.OS === 'web') {
    return { updateAvailable: false };
  }

  const currentVersion = getInstalledVersion();

  // Try Strategy 1: Backend
  let updateData = await fetchLatestVersionFromBackend();

  // Try Strategy 2: Google Play Store directly if backend not configured
  if (!updateData) {
    updateData = await fetchLatestVersionFromPlayStore();
  }

  if (!updateData || !updateData.latestVersion) {
    return { updateAvailable: false, currentVersion };
  }

  const { latestVersion, minRequiredVersion, releaseNotes, storeUrl } = updateData;

  // Comparison: is latestVersion higher than current installed version?
  const isNewer = compareVersions(latestVersion, currentVersion) > 0;

  if (!isNewer) {
    // User already has latest or newer version installed -> NO POPUP!
    return { updateAvailable: false, currentVersion, latestVersion };
  }

  // Check if force update is needed
  let forceUpdate = updateData.forceUpdate || false;
  if (minRequiredVersion && compareVersions(minRequiredVersion, currentVersion) > 0) {
    forceUpdate = true;
  }

  // If user dismissed this exact version previously and it's not a forced update, suppress unless forceCheck
  if (!forceUpdate && !forceCheck) {
    const dismissedVersion = await storage.getItem(DISMISSED_UPDATE_VERSION_KEY);
    if (dismissedVersion === latestVersion) {
      return { updateAvailable: false, currentVersion, latestVersion };
    }
  }

  return {
    updateAvailable: true,
    currentVersion,
    latestVersion,
    forceUpdate,
    releaseNotes,
    storeUrl: storeUrl || `market://details?id=${PACKAGE_NAME}`
  };
}

/**
 * Mark a version as dismissed for today / session
 */
export async function dismissUpdate(version) {
  try {
    await storage.setItem(DISMISSED_UPDATE_VERSION_KEY, String(version));
  } catch (_) {}
}
