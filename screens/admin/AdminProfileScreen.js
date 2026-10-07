import React, { useState, useEffect, useCallback } from 'react';
import { 
  StyleSheet, View, ScrollView, TouchableOpacity, Alert, Switch, Dimensions, Platform, Linking, AppState, StatusBar, RefreshControl 
} from 'react-native';
import { Text, Avatar, Surface, ActivityIndicator } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  CheckCircle2, Gauge, Award, Bell, Sun, Globe, LogOut, 
  ChevronRight, Pencil, ClipboardCheck, Calendar, Wallet, FileSpreadsheet,
  Shield, MapPin, Navigation, BatteryCharging, Camera, ArrowLeft, RefreshCw,
  Users, BriefcaseBusiness, BarChart3, Settings, ShieldCheck, Building2,
  Radio, Phone, Mail, Sparkles, Layers
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { adminAPI, meetingAPI, uploadAPI, authAPI, getAvatarUrl } from '../../services/api';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
let Notifications = null;
try {
  Notifications = require('expo-notifications');
} catch (e) {
  // Gracefully ignored in Expo Go
}
import { useSettings } from '../../context/SettingsContext';
import { openBatteryOptimizationSettings } from '../../services/batteryOptimization';

const { width } = Dimensions.get('window');
const FONT = Platform.OS === 'web' ? 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' : Platform.OS === 'ios' ? 'System' : 'sans-serif-medium';

export default function AdminProfileScreen() {
  const router = useRouter();
  const { user, logout, updateUser } = useAuth();
  const [pushEnabled, setPushEnabled] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Settings Context values
  const { theme, toggleTheme, language, changeLanguage, t } = useSettings();
  
  // Dynamic stats states for Manager
  const [teamStats, setTeamStats] = useState({ total: 0, active: 0 });
  const [visitStats, setVisitStats] = useState({ total: 0, completed: 0 });
  const [loadingStats, setLoadingStats] = useState(true);

  // Theme Dynamic Colors
  const isDark = theme === 'dark';
  const colors = {
    background: isDark ? '#0f172a' : '#f8fafc',
    surface: isDark ? '#1e293b' : '#ffffff',
    text: isDark ? '#f8fafc' : '#0f172a',
    subText: isDark ? '#94a3b8' : '#64748b',
    border: isDark ? '#334155' : '#e2e8f0',
    iconColor: isDark ? '#94a3b8' : '#334155',
    emerald: '#047857',
    emeraldLight: '#ecfdf5',
    emeraldBorder: '#a7f3d0',
  };

  const currentThemeLabel = theme === 'dark' 
    ? (language === 'en' ? 'Current: Dark Mode' : 'वर्तमान: डार्क मोड') 
    : (language === 'en' ? 'Current: Light Mode' : 'वर्तमान: लाइट मोड');

  // ─── Permission States ────────────────────────────────────────────────────
  const [permissions, setPermissions] = useState({
    gpsServices: false,
    locationForeground: false,
    locationBackground: false,
    notifications: false,
    camera: false,
  });

  const checkPermissions = useCallback(async () => {
    if (Platform.OS === 'web') return;
    try {
      const [gpsServices, fgLoc, bgLoc, notif, cam] = await Promise.all([
        Location.hasServicesEnabledAsync().catch(() => false),
        Location.getForegroundPermissionsAsync(),
        Location.getBackgroundPermissionsAsync(),
        Notifications ? Notifications.getPermissionsAsync() : Promise.resolve({ status: 'denied' }),
        ImagePicker.getCameraPermissionsAsync(),
      ]);
      setPermissions({
        gpsServices: !!gpsServices,
        locationForeground: fgLoc.status === 'granted',
        locationBackground: bgLoc.status === 'granted',
        notifications: notif.status === 'granted',
        camera: cam.status === 'granted',
      });
    } catch (e) {
      console.log('⚠️ ManagerProfileScreen: Permission check failed:', e.message);
    }
  }, []);

  // Re-check permissions when user comes back from phone settings
  useEffect(() => {
    checkPermissions();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkPermissions();
    });
    return () => sub.remove();
  }, [checkPermissions]);

  const handlePermissionPress = async (type) => {
    if (Platform.OS === 'web') return;
    switch (type) {
      case 'locationForeground': {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') Linking.openSettings();
        break;
      }
      case 'locationBackground': {
        const { status } = await Location.requestBackgroundPermissionsAsync();
        if (status !== 'granted') Linking.openSettings();
        break;
      }
      case 'notifications': {
        if (!Notifications) break;
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') Linking.openSettings();
        break;
      }
      case 'camera': {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') Linking.openSettings();
        break;
      }
      case 'battery': {
        await openBatteryOptimizationSettings();
        break;
      }
    }
    // Re-check after granting
    setTimeout(checkPermissions, 1000);
  };

  const fetchManagerStats = useCallback(async () => {
    try {
      setLoadingStats(true);
      const [empRes, visitRes] = await Promise.all([
        adminAPI.getEmployees({ limit: 100 }).catch(() => ({ data: { success: false } })),
        meetingAPI.getAll({ limit: 100 }).catch(() => ({ data: { success: false } })),
      ]);

      if (empRes.data && empRes.data.success) {
        const list = empRes.data.employees || [];
        const active = list.filter(e => e.isTrackingActive || e.status === 'active').length;
        setTeamStats({ total: list.length, active });
      }

      if (visitRes.data && visitRes.data.success) {
        const list = visitRes.data.meetings || [];
        const completed = list.filter(v => v.status === 'completed').length;
        setVisitStats({ total: list.length, completed });
      }
    } catch (err) {
      console.log('⚠️ ManagerProfileScreen: Failed to fetch stats:', err.message);
    } finally {
      setLoadingStats(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchManagerStats();
  }, [fetchManagerStats]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchManagerStats(), checkPermissions()]);
    setRefreshing(false);
  };

  const handleSelectImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Denied', 'Permission to access media library is required!');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];
        
        const localUri = selectedAsset.uri;
        const filename = localUri.split('/').pop() || 'avatar.jpg';

        setUploading(true);

        let uploadRes;
        if (Platform.OS === 'web') {
          const formData = new FormData();
          const response = await fetch(selectedAsset.uri);
          const blob = await response.blob();
          formData.append('image', blob, filename);
          uploadRes = await uploadAPI.uploadImageFormData(formData);
        } else {
          uploadRes = await uploadAPI.uploadImageFormData(selectedAsset.uri);
        }

        if (uploadRes.data && uploadRes.data.success) {
          const imageUrl = uploadRes.data.url;
          
          const isManagerUser = (user?.role || '').toUpperCase() === 'MANAGER';
          const updateRes = await authAPI.updateProfile({ 
            ...(isManagerUser ? { managerPro_pic: imageUrl } : { emp_profile_pic: imageUrl }),
            avatar: imageUrl 
          });
          if (updateRes.data && updateRes.data.success) {
            await updateUser(updateRes.data.user);
            Alert.alert('Success', 'Manager profile photo updated successfully!');
          }
        }
      }
    } catch (e) {
      console.log('Image upload error:', e.message);
      Alert.alert('Error', 'Failed to upload profile picture.');
    } finally {
      setUploading(false);
    }
  };

  const handleLanguageChange = () => {
    if (Platform.OS === 'web') {
      const lang = window.confirm('Select Language:\nOK for English, Cancel for Hindi');
      changeLanguage(lang ? 'en' : 'hi');
    } else {
      Alert.alert(
        t('regionLanguage') || 'Language / भाषा',
        'Select App Language / भाषा चुनें',
        [
          { text: 'English', onPress: () => changeLanguage('en') },
          { text: 'हिंदी (Hindi)', onPress: () => changeLanguage('hi') },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    }
  };

  const handleLogout = async () => {
    const confirmationText = language === 'en' ? 'Are you sure you want to sign out from KisanConnect?' : 'क्या आप सच में KisanConnect से लॉगआउट करना चाहते हैं?';
    const titleText = language === 'en' ? 'Confirm Sign Out' : 'लॉगआउट की पुष्टि करें';
    const logoutBtnText = language === 'en' ? 'Sign Out' : 'लॉगआउट';
    const cancelBtnText = language === 'en' ? 'Cancel' : 'रद्द करें';

    if (Platform.OS === 'web') {
      const confirmLogout = window.confirm(confirmationText);
      if (confirmLogout) {
        await logout();
        router.replace('/(auth)/login');
      }
    } else {
      Alert.alert(
        titleText,
        confirmationText,
        [
          { text: cancelBtnText, style: 'cancel' },
          {
            text: logoutBtnText,
            style: 'destructive',
            onPress: async () => {
              await logout();
              router.replace('/(auth)/login');
            },
          },
        ]
      );
    }
  };

  const getInitials = (fullName) => {
    if (!fullName) return 'MG';
    const parts = fullName.trim().split(' ');
    if (parts.length > 1) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return fullName.substring(0, 2).toUpperCase();
  };

  const userAvatarUrl = getAvatarUrl(user?.managerPro_pic || user?.avatar || user?.emp_profile_pic);
  const orgTitle = user?.organizationId?.name || user?.orgName || 'KisanConnect Enterprise';
  const roleName = (user?.role || 'MANAGER').toUpperCase();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="#047857" />

      {/* ── 1. EXECUTIVE TOP CURVED HEADER ── */}
      <LinearGradient
        colors={['#047857', '#0d9488', '#0f766e']}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.topNavRow}>
            <TouchableOpacity
              style={styles.headerBackBtn}
              onPress={() => {
                if (router.canGoBack()) router.back();
                else router.replace('/(admin)/dashboard');
              }}
              activeOpacity={0.7}
            >
              <ArrowLeft size={20} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.headerTitle}>Manager Profile</Text>
              <Text style={styles.headerSub}>Executive Account & Command Center</Text>
            </View>
            <TouchableOpacity style={styles.headerBackBtn} onPress={onRefresh} activeOpacity={0.7}>
              <RefreshCw size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* ── SCROLLABLE BODY ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#047857']} />}
      >
        {/* ── 2. EXECUTIVE PROFILE HERO CARD ── */}
        <Surface style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]} elevation={2}>
          <View style={styles.avatarWrapper}>
            {uploading ? (
              <View style={[styles.avatarBox, { backgroundColor: '#ecfdf5', borderColor: '#047857' }]}>
                <ActivityIndicator size="small" color="#047857" />
              </View>
            ) : userAvatarUrl ? (
              <Avatar.Image 
                size={92} 
                source={{ uri: userAvatarUrl }} 
                style={styles.avatarBox} 
              />
            ) : (
              <Avatar.Text 
                size={92} 
                label={getInitials(user?.name)} 
                style={[styles.avatarBox, { backgroundColor: '#047857' }]} 
                labelStyle={styles.avatarLabel} 
              />
            )}
            <TouchableOpacity style={styles.editIconBtn} onPress={handleSelectImage} activeOpacity={0.85}>
              <Camera size={14} color="#fff" />
            </TouchableOpacity>
          </View>

          <Text style={[styles.profileName, { color: colors.text }]}>{user?.name || 'Field Manager'}</Text>
          <Text style={[styles.profileTitle, { color: colors.subText }]}>
            {user?.email || 'manager@kisanconnect.in'} • {user?.phone || 'Phone verified'}
          </Text>
          
          <View style={styles.badgeRow}>
            <View style={styles.deptBadge}>
              <ShieldCheck size={13} color="#047857" style={{ marginRight: 4 }} />
              <Text style={styles.deptBadgeText}>ROLE: {roleName}</Text>
            </View>
            <View style={styles.orgBadge}>
              <Building2 size={12} color="#475569" style={{ marginRight: 4 }} />
              <Text style={styles.orgBadgeText}>{orgTitle}</Text>
            </View>
          </View>
        </Surface>

        {/* ── 3. SIDE-BY-SIDE METRICS CARDS ── */}
        <View style={styles.metricsRow}>
          {/* Metric 1: Field Team Managed */}
          <Surface style={[styles.metricCard, { borderLeftColor: '#047857', backgroundColor: colors.surface, borderColor: colors.border }]} elevation={1}>
            <View style={styles.metricHeader}>
              <Text style={[styles.metricLabel, { color: colors.subText }]}>Team Strength</Text>
              <Users size={18} color="#047857" />
            </View>
            <Text style={[styles.metricValue, { color: colors.text }]}>{teamStats.total}</Text>
            <Text style={styles.metricTrendGreen}>{teamStats.active} Active on Duty</Text>
          </Surface>

          {/* Metric 2: Field Visits & Reviews */}
          <Surface style={[styles.metricCard, { borderLeftColor: '#0d9488', backgroundColor: colors.surface, borderColor: colors.border }]} elevation={1}>
            <View style={styles.metricHeader}>
              <Text style={[styles.metricLabel, { color: colors.subText }]}>Client Visits</Text>
              <BriefcaseBusiness size={18} color="#0d9488" />
            </View>
            <Text style={[styles.metricValue, { color: colors.text }]}>{visitStats.total}</Text>
            <Text style={[styles.metricTrendGrey, { color: colors.subText }]}>{visitStats.completed} Completed</Text>
          </Surface>
        </View>

        {/* ── 4. LEADERSHIP RANK BANNER RIBBON ── */}
        <Surface style={styles.rankBanner} elevation={2}>
          <View style={styles.rankInfo}>
            <Text style={styles.rankLabel}>ORGANIZATION STATUS</Text>
            <Text style={styles.rankTitle}>FIELD COMMAND HQ • ACTIVE</Text>
          </View>
          <Award size={36} color="rgba(255,255,255,0.22)" style={styles.rankIcon} />
        </Surface>

        {/* ── 5. MANAGER COMMAND HUB ── */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Manager Command Hub</Text>
        <View style={styles.hubGrid}>
          {/* Hub 1: Live Tracking Radar */}
          <TouchableOpacity style={[styles.hubItem, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.push('/(admin)/tracking')} activeOpacity={0.8}>
            <View style={[styles.hubIconContainer, { backgroundColor: '#ecfdf5' }]}>
              <Radio size={22} color="#047857" />
            </View>
            <Text style={[styles.hubLabel, { color: colors.text }]}>Live Tracking</Text>
            <Text style={[styles.hubSub, { color: colors.subText }]}>Real-time Map</Text>
          </TouchableOpacity>

          {/* Hub 2: Team Members */}
          <TouchableOpacity style={[styles.hubItem, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.push('/(admin)/team')} activeOpacity={0.8}>
            <View style={[styles.hubIconContainer, { backgroundColor: '#eff6ff' }]}>
              <Users size={22} color="#2563eb" />
            </View>
            <Text style={[styles.hubLabel, { color: colors.text }]}>Team Members</Text>
            <Text style={[styles.hubSub, { color: colors.subText }]}>Staff Directory</Text>
          </TouchableOpacity>

          {/* Hub 3: Client Visits */}
          <TouchableOpacity style={[styles.hubItem, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.push('/(admin)/visits')} activeOpacity={0.8}>
            <View style={[styles.hubIconContainer, { backgroundColor: '#fef3c7' }]}>
              <BriefcaseBusiness size={22} color="#d97706" />
            </View>
            <Text style={[styles.hubLabel, { color: colors.text }]}>Client Visits</Text>
            <Text style={[styles.hubSub, { color: colors.subText }]}>Meeting Logs</Text>
          </TouchableOpacity>

          {/* Hub 4: Attendance Logs */}
          <TouchableOpacity style={[styles.hubItem, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.push('/(admin)/attendance')} activeOpacity={0.8}>
            <View style={[styles.hubIconContainer, { backgroundColor: '#f3e8ff' }]}>
              <Calendar size={22} color="#7e22ce" />
            </View>
            <Text style={[styles.hubLabel, { color: colors.text }]}>Attendance</Text>
            <Text style={[styles.hubSub, { color: colors.subText }]}>Daily Shifts</Text>
          </TouchableOpacity>

          {/* Hub 5: Staff Reports & Audits */}
          <TouchableOpacity style={[styles.hubItem, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.push('/(admin)/reports')} activeOpacity={0.8}>
            <View style={[styles.hubIconContainer, { backgroundColor: '#e0f2fe' }]}>
              <BarChart3 size={22} color="#0284c7" />
            </View>
            <Text style={[styles.hubLabel, { color: colors.text }]}>Staff Reports</Text>
            <Text style={[styles.hubSub, { color: colors.subText }]}>Mileage & Audits</Text>
          </TouchableOpacity>

          {/* Hub 6: Manager Settings */}
          <TouchableOpacity style={[styles.hubItem, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.push('/(admin)/settings')} activeOpacity={0.8}>
            <View style={[styles.hubIconContainer, { backgroundColor: '#fce7f3' }]}>
              <Settings size={22} color="#db2777" />
            </View>
            <Text style={[styles.hubLabel, { color: colors.text }]}>Settings</Text>
            <Text style={[styles.hubSub, { color: colors.subText }]}>Security & Geofence</Text>
          </TouchableOpacity>
        </View>

        {/* ── 6. APPLICATION SETTINGS BOX ── */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('applicationSettings') || 'Application Settings'}</Text>
        <Surface style={[styles.settingsSurface, { backgroundColor: colors.surface, borderColor: colors.border }]} elevation={1}>
          {/* Push Notifications */}
          <View style={[styles.settingsRow, { borderBottomColor: isDark ? '#334155' : '#f1f5f9' }]}>
            <Bell size={20} color={colors.iconColor} style={{ marginRight: 14 }} />
            <View style={styles.settingsTextCol}>
              <Text style={[styles.settingsLabel, { color: colors.text }]}>{t('pushNotifications') || 'Push Notifications'}</Text>
              <Text style={[styles.settingsSub, { color: colors.subText }]}>Field alerts & staff check-ins</Text>
            </View>
            <Switch 
              value={pushEnabled} 
              onValueChange={setPushEnabled}
              trackColor={{ false: '#cbd5e1', true: '#047857' }}
              thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
            />
          </View>

          {/* Appearance / Theme */}
          <TouchableOpacity style={[styles.settingsRow, { borderBottomColor: isDark ? '#334155' : '#f1f5f9' }]} onPress={toggleTheme} activeOpacity={0.7}>
            <Sun size={20} color={colors.iconColor} style={{ marginRight: 14 }} />
            <View style={styles.settingsTextCol}>
              <Text style={[styles.settingsLabel, { color: colors.text }]}>{t('appearance') || 'Appearance'}</Text>
              <Text style={[styles.settingsSub, { color: colors.subText }]}>{currentThemeLabel}</Text>
            </View>
            <ChevronRight size={18} color="#94a3b8" />
          </TouchableOpacity>

          {/* Region & Language */}
          <TouchableOpacity style={[styles.settingsRow, { borderBottomWidth: 0 }]} onPress={handleLanguageChange} activeOpacity={0.7}>
            <Globe size={20} color={colors.iconColor} style={{ marginRight: 14 }} />
            <View style={styles.settingsTextCol}>
              <Text style={[styles.settingsLabel, { color: colors.text }]}>{t('regionLanguage') || 'Region & Language'}</Text>
              <Text style={[styles.settingsSub, { color: colors.subText }]}>{language === 'en' ? 'English (US)' : 'हिंदी (IN)'}</Text>
            </View>
            <ChevronRight size={18} color="#94a3b8" />
          </TouchableOpacity>
        </Surface>

        {/* ── 7. APP HARDWARE & OS PERMISSIONS AUDIT ── */}
        {Platform.OS !== 'web' && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {language === 'en' ? '🔐 Manager Device Permissions' : '🔐 प्रबंधक डिवाइस अनुमतियाँ'}
            </Text>
            <Surface style={[styles.settingsSurface, { backgroundColor: colors.surface, borderColor: colors.border }]} elevation={1}>
              {/* Permission: Device GPS Hardware Services */}
              <TouchableOpacity 
                style={[styles.settingsRow, { borderBottomColor: isDark ? '#334155' : '#f1f5f9' }]}
                onPress={() => handlePermissionPress('locationForeground')}
                activeOpacity={0.7}
              >
                <Shield size={20} color={permissions.gpsServices ? '#10b981' : '#ef4444'} style={{ marginRight: 14 }} />
                <View style={styles.settingsTextCol}>
                  <Text style={[styles.settingsLabel, { color: colors.text }]}>
                    {language === 'en' ? 'Device GPS Hardware' : 'डिवाइस GPS हार्डवेयर'}
                  </Text>
                  <Text style={[styles.settingsSub, { color: permissions.gpsServices ? colors.subText : '#ef4444' }]}>
                    {permissions.gpsServices
                      ? (language === 'en' ? 'Phone GPS Services ON' : 'फोन GPS सेवाएं चालू हैं')
                      : (language === 'en' ? '⚠️ Phone GPS is OFF! Tap to enable' : '⚠️ फोन GPS बंद है! चालू करने के लिए टैप करें')
                    }
                  </Text>
                </View>
                <View style={[styles.permBadge, { backgroundColor: permissions.gpsServices ? '#dcfce7' : '#fee2e2' }]}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: permissions.gpsServices ? '#15803d' : '#dc2626' }}>
                    {permissions.gpsServices ? 'ACTIVE' : 'OFF'}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Permission: Location Foreground */}
              <TouchableOpacity 
                style={[styles.settingsRow, { borderBottomColor: isDark ? '#334155' : '#f1f5f9' }]}
                onPress={() => handlePermissionPress('locationForeground')}
                activeOpacity={0.7}
              >
                <MapPin size={20} color={permissions.locationForeground ? '#10b981' : '#ef4444'} style={{ marginRight: 14 }} />
                <View style={styles.settingsTextCol}>
                  <Text style={[styles.settingsLabel, { color: colors.text }]}>
                    {language === 'en' ? 'Foreground Location' : 'फोरग्राउंड लोकेशन'}
                  </Text>
                  <Text style={[styles.settingsSub, { color: colors.subText }]}>
                    {language === 'en' ? 'Manager shift tracking & maps' : 'प्रबंधक शिफ्ट ट्रैकिंग और मैप'}
                  </Text>
                </View>
                <View style={[styles.permBadge, { backgroundColor: permissions.locationForeground ? '#dcfce7' : '#fee2e2' }]}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: permissions.locationForeground ? '#15803d' : '#dc2626' }}>
                    {permissions.locationForeground ? 'ALLOWED' : 'DENIED'}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Permission: Background Location */}
              <TouchableOpacity 
                style={[styles.settingsRow, { borderBottomColor: isDark ? '#334155' : '#f1f5f9' }]}
                onPress={() => handlePermissionPress('locationBackground')}
                activeOpacity={0.7}
              >
                <Navigation size={20} color={permissions.locationBackground ? '#10b981' : '#ef4444'} style={{ marginRight: 14 }} />
                <View style={styles.settingsTextCol}>
                  <Text style={[styles.settingsLabel, { color: colors.text }]}>
                    {language === 'en' ? 'Background Location' : 'बैकग्राउंड लोकेशन'}
                  </Text>
                  <Text style={[styles.settingsSub, { color: permissions.locationBackground ? colors.subText : '#ef4444' }]}>
                    {permissions.locationBackground
                      ? (language === 'en' ? '✅ "Allow all the time" is ACTIVE' : '✅ "हमेशा अनुमति दें" चालू है')
                      : (language === 'en' ? '⚠️ MUST be "Allow all the time"' : '⚠️ "हमेशा अनुमति दें" सेट करें')
                    }
                  </Text>
                </View>
                <View style={[styles.permBadge, { backgroundColor: permissions.locationBackground ? '#dcfce7' : '#fee2e2' }]}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: permissions.locationBackground ? '#15803d' : '#dc2626' }}>
                    {permissions.locationBackground ? 'ALWAYS' : 'DENIED'}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Permission: Battery Optimization Bypass */}
              <TouchableOpacity 
                style={[styles.settingsRow, { borderBottomColor: isDark ? '#334155' : '#f1f5f9' }]}
                onPress={() => handlePermissionPress('battery')}
                activeOpacity={0.7}
              >
                <BatteryCharging size={20} color="#10b981" style={{ marginRight: 14 }} />
                <View style={styles.settingsTextCol}>
                  <Text style={[styles.settingsLabel, { color: colors.text }]}>
                    {language === 'en' ? 'Battery Optimization' : 'बैटरी ऑप्टिमाइज़ेशन'}
                  </Text>
                  <Text style={[styles.settingsSub, { color: colors.subText }]}>
                    {language === 'en' ? 'Set "No restrictions" so OS never kills GPS' : 'OS GPS को बंद न करे इसके लिए अनरेस्ट्रिक्टेड रखें'}
                  </Text>
                </View>
                <View style={[styles.permBadge, { backgroundColor: '#dcfce7' }]}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#15803d' }}>
                    UNRESTRICTED
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Permission: Camera Access */}
              <TouchableOpacity 
                style={[styles.settingsRow, { borderBottomWidth: 0 }]}
                onPress={() => handlePermissionPress('camera')}
                activeOpacity={0.7}
              >
                <Camera size={20} color={permissions.camera ? '#10b981' : '#ef4444'} style={{ marginRight: 14 }} />
                <View style={styles.settingsTextCol}>
                  <Text style={[styles.settingsLabel, { color: colors.text }]}>
                    {language === 'en' ? 'Camera & Media Access' : 'कैमरा और मीडिया एक्सेस'}
                  </Text>
                  <Text style={[styles.settingsSub, { color: colors.subText }]}>
                    {language === 'en' ? 'Required for manager visit photos' : 'विज़िट फ़ोटो और प्रोफ़ाइल के लिए ज़रूरी'}
                  </Text>
                </View>
                <View style={[styles.permBadge, { backgroundColor: permissions.camera ? '#dcfce7' : '#fee2e2' }]}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: permissions.camera ? '#15803d' : '#dc2626' }}>
                    {permissions.camera ? 'ALLOWED' : 'DENIED'}
                  </Text>
                </View>
              </TouchableOpacity>
            </Surface>
          </>
        )}

        {/* ── 8. SIGN OUT ACTION CARD ── */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <LogOut size={18} color="#dc2626" style={{ marginRight: 8 }} />
          <Text style={styles.logoutBtnText}>Sign Out from Manager Console</Text>
        </TouchableOpacity>

        {/* ── FOOTER BRANDING ── */}
        <Text style={styles.versionText}>
          KisanConnect Enterprise Manager Console • v2.4.0
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerGradient: {
    borderCurve: 'round',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: Platform.OS === 'android' ? 10 : 0,
  },
  topNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  headerBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
    fontFamily: FONT,
  },
  headerSub: {
    color: '#a7f3d0',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 1,
    fontFamily: FONT,
  },

  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },

  // Profile Card
  profileCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    marginBottom: 14,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  avatarBox: {
    borderWidth: 3,
    borderColor: '#047857',
  },
  avatarLabel: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 28,
  },
  editIconBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#047857',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: '#ffffff',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    fontFamily: FONT,
    marginBottom: 2,
  },
  profileTitle: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: FONT,
    marginBottom: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  deptBadge: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  deptBadgeText: {
    color: '#047857',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    fontFamily: FONT,
  },
  orgBadge: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  orgBadgeText: {
    color: '#475569',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: FONT,
  },

  // Metrics
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  metricCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: 14,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: FONT,
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '900',
    fontFamily: FONT,
  },
  metricTrendGreen: {
    fontSize: 10,
    color: '#059669',
    fontWeight: '700',
    marginTop: 2,
    fontFamily: FONT,
  },
  metricTrendGrey: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
    fontFamily: FONT,
  },

  // Rank Banner
  rankBanner: {
    backgroundColor: '#047857',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  rankInfo: { flex: 1 },
  rankLabel: {
    color: '#a7f3d0',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    fontFamily: FONT,
  },
  rankTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 2,
    fontFamily: FONT,
  },
  rankIcon: { marginLeft: 10 },

  // Command Hub
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginLeft: 4,
    textTransform: 'uppercase',
    fontFamily: FONT,
  },
  hubGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
  },
  hubItem: {
    width: (width > 720 ? 720 - 32 : width - 32 - 10) / 2 - 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  hubIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  hubLabel: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: FONT,
  },
  hubSub: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
    fontFamily: FONT,
  },

  // Settings surface
  settingsSurface: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 18,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
  },
  settingsTextCol: { flex: 1 },
  settingsLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
    fontFamily: FONT,
  },
  settingsSub: {
    fontSize: 10,
    fontFamily: FONT,
  },
  permBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },

  // Logout Button
  logoutBtn: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 14,
  },
  logoutBtnText: {
    color: '#dc2626',
    fontWeight: '800',
    fontSize: 13,
    fontFamily: FONT,
  },

  versionText: {
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '500',
    fontFamily: FONT,
  },
});
