import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Linking,
  ActivityIndicator
} from 'react-native';
import { DownloadCloud, Sparkles, X, AlertCircle } from 'lucide-react-native';
import { checkAppUpdate, getInstalledVersion } from '../services/appUpdateService';

export default function UpdatePromptModal() {
  const [visible, setVisible] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    // Check update on app mount with a short delay so app renders first
    const timer = setTimeout(() => {
      runUpdateCheck();
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  const runUpdateCheck = async () => {
    try {
      const res = await checkAppUpdate();
      if (res && res.updateAvailable) {
        setUpdateInfo(res);
        setVisible(true);
      }
    } catch (err) {
      console.log('Update check ignored:', err.message);
    }
  };

  const handleUpdatePress = async () => {
    if (!updateInfo) return;
    setIsUpdating(true);
    try {
      const url = updateInfo.storeUrl || 'market://details?id=com.kisanteam.crm';
      const webFallback = 'https://play.google.com/store/apps/details?id=com.kisanteam.crm';

      if (Platform.OS === 'android') {
        const canOpen = await Linking.canOpenURL(url).catch(() => false);
        if (canOpen) {
          await Linking.openURL(url);
        } else {
          await Linking.openURL(webFallback);
        }
      } else {
        await Linking.openURL(webFallback);
      }
    } catch (err) {
      console.error('Error opening update link:', err);
    } finally {
      setIsUpdating(false);
      if (!updateInfo.forceUpdate) {
        setVisible(false);
      }
    }
  };

  const handleDismiss = () => {
    if (updateInfo?.forceUpdate) {
      return; // Force update cannot be dismissed
    }
    setVisible(false);
  };

  if (!visible || !updateInfo) return null;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header Badge */}
          <View style={styles.iconCircle}>
            <DownloadCloud size={32} color="#0f766e" />
          </View>

          {/* Close button if not forced */}
          {!updateInfo.forceUpdate && (
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={handleDismiss}
              activeOpacity={0.7}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            >
              <X size={18} color="#94a3b8" />
            </TouchableOpacity>
          )}

          {/* Title */}
          <Text style={styles.title}>
            {updateInfo.forceUpdate ? 'Important Update Required' : 'New Update Available!'}
          </Text>

          {/* Subtitle / Version badges */}
          <View style={styles.badgeRow}>
            <View style={styles.badgeOld}>
              <Text style={styles.badgeOldText}>Current: v{updateInfo.currentVersion}</Text>
            </View>
            <Text style={styles.arrowText}>→</Text>
            <View style={styles.badgeNew}>
              <Sparkles size={12} color="#0f766e" style={{ marginRight: 4 }} />
              <Text style={styles.badgeNewText}>Latest: v{updateInfo.latestVersion}</Text>
            </View>
          </View>

          {/* Description */}
          <Text style={styles.message}>
            {updateInfo.releaseNotes ||
              (updateInfo.forceUpdate
                ? 'A critical update is available on Google Play Store with required security and tracking enhancements. Please update to continue using KisanConnect.'
                : 'A newer and improved version of KisanConnect is now live on Google Play Store. Update now for the best experience!')}
          </Text>

          {/* Buttons */}
          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={styles.updateBtn}
              onPress={handleUpdatePress}
              disabled={isUpdating}
              activeOpacity={0.85}
            >
              {isUpdating ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <View style={styles.btnContent}>
                  <DownloadCloud size={18} color="#ffffff" style={{ marginRight: 8 }} />
                  <Text style={styles.updateBtnText}>Update Now</Text>
                </View>
              )}
            </TouchableOpacity>

            {!updateInfo.forceUpdate && (
              <TouchableOpacity
                style={styles.laterBtn}
                onPress={handleDismiss}
                activeOpacity={0.7}
              >
                <Text style={styles.laterBtnText}>Later</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 999999
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
    position: 'relative'
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center'
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#ccfbf1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 4,
    borderColor: '#f0fdfa'
  },
  title: {
    fontSize: 19,
    fontFamily: 'Inter',
    fontWeight: '600',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 10
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 14
  },
  badgeOld: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8
  },
  badgeOldText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500'
  },
  arrowText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600'
  },
  badgeNew: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center'
  },
  badgeNewText: {
    fontSize: 11,
    color: '#0f766e',
    fontWeight: '600'
  },
  message: {
    fontSize: 13.5,
    fontFamily: 'Inter',
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 22
  },
  actionContainer: {
    width: '100%',
    gap: 8
  },
  updateBtn: {
    width: '100%',
    backgroundColor: '#0f766e',
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f766e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  updateBtnText: {
    color: '#ffffff',
    fontSize: 14.5,
    fontWeight: '600',
    letterSpacing: 0.2
  },
  laterBtn: {
    width: '100%',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  laterBtnText: {
    color: '#64748b',
    fontSize: 13.5,
    fontWeight: '500'
  }
});
