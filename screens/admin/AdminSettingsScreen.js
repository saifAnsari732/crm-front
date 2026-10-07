import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, View, ScrollView, TouchableOpacity, Switch,
  Platform, RefreshControl, StatusBar, TextInput, Image,
  ActivityIndicator, Alert, Dimensions, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Surface } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Settings, Shield, Navigation, Building2, Upload, CheckCircle2,
  Save, Image as ImageIcon, ArrowLeft, LogOut, MapPin, Clock,
  Briefcase, Receipt, Users, Smartphone, Zap, Bell, Lock,
  Compass, ChevronDown, ChevronUp, Globe, Mail, Phone,
  Fuel, Target, ClipboardList, Camera, Eye, Layers, UserRound, FileText
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { stopHeartbeat } from '../../services/locationTask';
import { adminAPI, uploadAPI, getAvatarUrl, authAPI } from '../../services/api';

// ── UI/UX Pro Max Design Tokens (No Black Colors) ──
const COLORS = {
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  primaryLight: '#DBEAFE',
  primaryMuted: '#EFF6FF',
  secondary: '#3B82F6',
  accent: '#EA580C',
  background: '#F8FAFC',
  card: '#FFFFFF',
  surface: '#F1F5F9',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  text: '#1E293B',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  success: '#059669',
  successLight: '#ECFDF5',
  successBorder: '#A7F3D0',
  danger: '#DC2626',
  dangerLight: '#FEF2F2',
  dangerBorder: '#FECACA',
  warning: '#D97706',
  warningLight: '#FFFBEB',
  purple: '#7C3AED',
  purpleLight: '#F5F3FF',
  indigo: '#4F46E5',
  indigoLight: '#EEF2FF',
  rose: '#E11D48',
  roseLight: '#FFF1F2',
  amber: '#D97706',
  amberLight: '#FFFBEB',
  white: '#FFFFFF',
  headerGradientStart: '#047857',
  headerGradientEnd: '#0d9488',
};

const FONT = Platform.OS === 'web' ? 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' : Platform.OS === 'ios' ? 'System' : 'sans-serif-medium';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const cardShadow = Platform.OS === 'web'
  ? { boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05)' }
  : { elevation: 2, shadowColor: '#64748B', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } };

// ── Collapsible Section Component ──
function CollapsibleSection({ icon: Icon, iconColor, title, subtitle, children, defaultOpen = true, badge }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Surface style={[styles.sectionCard, cardShadow]} elevation={1}>
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => setIsOpen(!isOpen)}
        activeOpacity={0.7}
      >
        <View style={[styles.sectionIconWrap, { backgroundColor: (iconColor || COLORS.primary) + '14' }]}>
          <Icon size={18} color={iconColor || COLORS.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {badge && (
              <View style={[styles.badge, { backgroundColor: COLORS.successLight, borderColor: COLORS.successBorder }]}>
                <Text style={[styles.badgeText, { color: COLORS.success }]}>{badge}</Text>
              </View>
            )}
          </View>
          {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
        </View>
        {isOpen ? (
          <ChevronUp size={18} color={COLORS.textMuted} />
        ) : (
          <ChevronDown size={18} color={COLORS.textMuted} />
        )}
      </TouchableOpacity>
      {isOpen && <View style={styles.sectionBody}>{children}</View>}
    </Surface>
  );
}

// ── Toggle Row Component ──
function ToggleRow({ icon: Icon, iconColor, label, subtitle, value, onValueChange, trackColors }) {
  return (
    <View style={styles.settingRow}>
      <View style={[styles.toggleIconWrap, { backgroundColor: (iconColor || COLORS.primary) + '12' }]}>
        <Icon size={15} color={iconColor || COLORS.primary} />
      </View>
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={styles.settingLabel}>{label}</Text>
        {subtitle && <Text style={styles.settingSub}>{subtitle}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{
          false: '#E2E8F0',
          true: trackColors?.true || COLORS.primaryLight,
        }}
        thumbColor={value ? (trackColors?.thumb || COLORS.primary) : '#F1F5F9'}
        style={{ transform: [{ scale: 0.85 }] }}
      />
    </View>
  );
}

// ── Feature Card Component ──
function FeatureCard({ icon: Icon, iconColor, bgColor, title, description }) {
  return (
    <View style={[styles.featureCard, { borderLeftColor: iconColor }]}>
      <View style={[styles.featureIconWrap, { backgroundColor: bgColor }]}>
        <Icon size={16} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDesc}>{description}</Text>
      </View>
      <View style={styles.featureActiveBadge}>
        <CheckCircle2 size={12} color={COLORS.success} />
        <Text style={styles.featureActiveText}>Active</Text>
      </View>
    </View>
  );
}

// ── DEDICATED MANAGER SETTINGS & PROFILE CONSOLE ──
function ManagerSettingsConsole({ user, authOrg, logout, router }) {
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [email] = useState(user?.email || '');
  const [managerAvatar, setManagerAvatar] = useState(user?.managerPro_pic || user?.avatar || '');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [passLoading, setPassLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [passSuccess, setPassSuccess] = useState('');
  const [passError, setPassError] = useState('');

  // Preferences
  const [geofenceAlerts, setGeofenceAlerts] = useState(true);
  const [punchAlerts, setPunchAlerts] = useState(true);

  const orgName = authOrg?.name || user?.organizationId?.name || user?.organization?.name || 'KISAN CHOICE';

  const handlePickManagerAvatar = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Permission to access gallery is required to upload profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        setUploadingAvatar(true);
        const imageUri = result.assets[0].uri;

        let uploadRes;
        if (Platform.OS === 'web') {
          const response = await fetch(imageUri);
          const blob = await response.blob();
          const formData = new FormData();
          formData.append('image', blob, 'manager_profile.jpg');
          uploadRes = await uploadAPI.uploadImageFormData(formData);
        } else {
          uploadRes = await uploadAPI.uploadImageFormData(imageUri);
        }

        if (uploadRes.data && uploadRes.data.success) {
          const imageUrl = uploadRes.data.url;
          setManagerAvatar(imageUrl);
          const updateRes = await authAPI.updateProfile({ managerPro_pic: imageUrl, avatar: imageUrl });
          if (updateRes.data && updateRes.data.success) {
            setSaveSuccess('Manager profile picture updated successfully!');
            setTimeout(() => setSaveSuccess(''), 3000);
          }
        }
      }
    } catch (err) {
      Alert.alert('Upload Error', err.message || 'Failed to update profile picture');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleGoBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(admin)/dashboard');
  };

  const handleSaveProfile = async () => {
    try {
      setSaveLoading(true);
      setSaveSuccess('');
      await authAPI.updateProfile({ name, phone });
      setSaveSuccess('Manager profile updated successfully!');
      setTimeout(() => setSaveSuccess(''), 3000);
    } catch (e) {
      const msg = e.response?.data?.message || e.message;
      if (Platform.OS === 'web') alert('Failed to update profile: ' + msg);
      else Alert.alert('Error', msg);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword) {
      setPassError('Please enter current and new password');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassError('New passwords do not match');
      return;
    }
    try {
      setPassLoading(true);
      setPassError('');
      setPassSuccess('');
      await authAPI.changePassword({ oldPassword, newPassword });
      setPassSuccess('Password changed successfully!');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPassSuccess(''), 3000);
    } catch (e) {
      setPassError(e.response?.data?.message || 'Failed to change password');
    } finally {
      setPassLoading(false);
    }
  };

  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm('Are you sure you want to log out of your Manager Console?')) {
        try { stopHeartbeat(); } catch (_) {}
        await logout();
        router.replace('/(auth)/login');
      }
    } else {
      Alert.alert(
        'Logout Confirm',
        'Are you sure you want to log out of your Manager Console?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Logout',
            style: 'destructive',
            onPress: async () => {
              try { stopHeartbeat(); } catch (_) {}
              await logout();
              router.replace('/(auth)/login');
            },
          },
        ]
      );
    }
  };

  const getUserInitials = (n) => {
    if (!n) return 'M';
    const p = n.trim().split(' ');
    if (p.length >= 2) return (p[0][0] + p[1][0]).toUpperCase();
    return p[0].substring(0, 2).toUpperCase();
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#047857" />
      
      {/* Vibrant Emerald Gradient Top Bar */}
      <LinearGradient
        colors={['#047857', '#0d9488', '#0f766e']}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView edges={['top', 'left', 'right']}>
          <View style={styles.topNavRow}>
            <TouchableOpacity style={styles.headerBtn} onPress={handleGoBack} activeOpacity={0.7}>
              <ArrowLeft size={20} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.brandTitle}>Manager Settings</Text>
              <Text style={styles.brandSub}>Profile & Account Preferences</Text>
            </View>
          </View>

          {/* Manager Profile Header Card */}
          <View style={styles.managerProfileCard}>
            <TouchableOpacity 
              style={styles.managerAvatarBox} 
              onPress={handlePickManagerAvatar}
              activeOpacity={0.8}
            >
              {uploadingAvatar ? (
                <View style={[styles.managerAvatarFallback, { backgroundColor: '#e0f2fe' }]}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                </View>
              ) : getAvatarUrl(managerAvatar || user?.managerPro_pic || user?.avatar) ? (
                <Image source={{ uri: getAvatarUrl(managerAvatar || user?.managerPro_pic || user?.avatar) }} style={styles.managerAvatarImg} />
              ) : (
                <View style={styles.managerAvatarFallback}>
                  <Text style={styles.managerAvatarText}>{getUserInitials(user?.name)}</Text>
                </View>
              )}
              <View style={[styles.cameraBadge, { position: 'absolute', bottom: -2, right: -2, backgroundColor: COLORS.primary, borderRadius: 12, padding: 4, borderWidth: 1.5, borderColor: '#fff' }]}>
                <Camera size={12} color="#fff" />
              </View>
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.managerProfileName}>{user?.name || 'Manager'}</Text>
              <Text style={styles.managerProfileEmail}>{user?.email || ''}</Text>
              <View style={styles.roleBadgeRow}>
                <View style={styles.managerRoleBadge}>
                  <Text style={styles.managerRoleBadgeText}>👔 FIELD MANAGER</Text>
                </View>
                <Text style={styles.managerOrgText}>• {orgName}</Text>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Main Content Body */}
      <ScrollView
        style={{ flex: 1, backgroundColor: COLORS.background }}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        {/* Success Alert Banner */}
        {saveSuccess ? (
          <View style={styles.successBanner}>
            <CheckCircle2 size={16} color={COLORS.success} />
            <Text style={styles.successBannerText}>{saveSuccess}</Text>
          </View>
        ) : null}

        {/* 1. PERSONAL PROFILE & CONTACT DETAILS */}
        <CollapsibleSection
          icon={UserRound}
          iconColor={COLORS.primary}
          title="My Profile Details"
          subtitle="Update your name, phone number, and contact info"
          defaultOpen={true}
        >
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>FULL NAME</Text>
            <View style={styles.inputWrap}>
              <Users size={16} color={COLORS.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                value={name}
                onChangeText={setName}
                placeholder="Enter your full name"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>PHONE NUMBER</Text>
            <View style={styles.inputWrap}>
              <Phone size={16} color={COLORS.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                value={phone}
                onChangeText={setPhone}
                placeholder="Enter phone number"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>EMAIL ADDRESS (Account ID)</Text>
            <View style={[styles.inputWrap, { backgroundColor: COLORS.surface }]}>
              <Mail size={16} color={COLORS.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.textInput, { color: COLORS.textMuted }]}
                value={email}
                editable={false}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, saveLoading && { opacity: 0.7 }]}
            onPress={handleSaveProfile}
            disabled={saveLoading}
            activeOpacity={0.8}
          >
            {saveLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Save size={16} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.saveBtnText}>Save Profile Changes</Text>
              </>
            )}
          </TouchableOpacity>
        </CollapsibleSection>

        {/* 2. SECURITY & PASSWORD CHANGE */}
        <CollapsibleSection
          icon={Lock}
          iconColor={COLORS.indigo}
          title="Security & Password"
          subtitle="Change account password and login security"
          defaultOpen={false}
        >
          {passError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{passError}</Text>
            </View>
          ) : null}
          {passSuccess ? (
            <View style={styles.successBanner}>
              <CheckCircle2 size={16} color={COLORS.success} />
              <Text style={styles.successBannerText}>{passSuccess}</Text>
            </View>
          ) : null}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>CURRENT PASSWORD</Text>
            <View style={styles.inputWrap}>
              <Lock size={16} color={COLORS.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                value={oldPassword}
                onChangeText={setOldPassword}
                placeholder="Enter current password"
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>NEW PASSWORD</Text>
            <View style={styles.inputWrap}>
              <Lock size={16} color={COLORS.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter new password"
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>CONFIRM NEW PASSWORD</Text>
            <View style={styles.inputWrap}>
              <Lock size={16} color={COLORS.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm new password"
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: COLORS.indigo }, passLoading && { opacity: 0.7 }]}
            onPress={handleChangePassword}
            disabled={passLoading}
            activeOpacity={0.8}
          >
            {passLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Lock size={16} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.saveBtnText}>Update Password</Text>
              </>
            )}
          </TouchableOpacity>
        </CollapsibleSection>

        {/* 3. MANAGER NOTIFICATIONS & PREFERENCES */}
        <CollapsibleSection
          icon={Bell}
          iconColor={COLORS.amber}
          title="Notification Preferences"
          subtitle="Alerts for field staff check-ins and geofence breaches"
          defaultOpen={true}
        >
          <ToggleRow
            icon={MapPin}
            iconColor={COLORS.primary}
            label="Geofence Breach Alerts"
            subtitle="Get notified when field staff leaves designated work area"
            value={geofenceAlerts}
            onValueChange={setGeofenceAlerts}
          />
          <ToggleRow
            icon={Bell}
            iconColor={COLORS.amber}
            label="Staff Punch-in Notifications"
            subtitle="Receive alert when an employee starts active field tracking"
            value={punchAlerts}
            onValueChange={setPunchAlerts}
          />
        </CollapsibleSection>

        {/* 4. QUICK SHORTCUTS & TEAM SCOPE */}
        <Surface style={[styles.sectionCard, cardShadow]} elevation={1}>
          <Text style={styles.sectionTitle}>Manager Quick Shortcuts</Text>
          <Text style={styles.sectionSubtitle}>Jump to core team management console</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <TouchableOpacity
              style={styles.shortcutTile}
              onPress={() => router.push('/(admin)/team')}
              activeOpacity={0.7}
            >
              <Users size={18} color={COLORS.primary} />
              <Text style={styles.shortcutTileText}>Team Directory</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.shortcutTile}
              onPress={() => router.push('/(admin)/reports')}
              activeOpacity={0.7}
            >
              <FileText size={18} color={COLORS.purple} />
              <Text style={styles.shortcutTileText}>Field Reports</Text>
            </TouchableOpacity>
          </View>
        </Surface>

        {/* 5. LOGOUT BUTTON */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <LogOut size={18} color={COLORS.danger} />
          <Text style={styles.logoutBtnText}>Logout from Manager Console</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

export default function AdminSettingsScreen() {
  const router = useRouter();
  const { user, organization: authOrg, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Check if current user is Manager -> Render Manager Console!
  const userRole = (user?.role || '').toUpperCase();
  const isManager = userRole === 'MANAGER' || userRole === 'FIELD_MANAGER';

  // Organization fields
  const [orgName, setOrgName] = useState('');
  const [orgLogo, setOrgLogo] = useState('');
  const [orgEmail, setOrgEmail] = useState('');
  const [orgPhone, setOrgPhone] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  // Org settings from backend
  const [orgSettings, setOrgSettings] = useState({});

  // System controls
  const [highAccuracy, setHighAccuracy] = useState(true);
  const [geofenceAlerts, setGeofenceAlerts] = useState(true);
  const [requireOTP, setRequireOTP] = useState(true);
  const [emailNotify, setEmailNotify] = useState(true);
  const [strictGeofence, setStrictGeofence] = useState(true);
  const [requireSelfie, setRequireSelfie] = useState(true);
  const [requireSignature, setRequireSignature] = useState(true);
  const [requireMeetingSelfie, setRequireMeetingSelfie] = useState(true);

  const fetchOrg = async () => {
    try {
      setLoading(true);
      const res = await adminAPI.getOrganization();
      if (res.data?.success && res.data.organization) {
        const org = res.data.organization;
        if (org.name) setOrgName(org.name);
        const resolvedLogo = org.Org_logo || org.companyLogo || org.logo || '';
        if (resolvedLogo) setOrgLogo(resolvedLogo);
        if (org.email) setOrgEmail(org.email);
        if (org.phone) setOrgPhone(org.phone);
        if (org.slug) setOrgSlug(org.slug);
        if (org.settings) {
          setOrgSettings(org.settings);
          setHighAccuracy(org.settings.trackingIntervalSeconds <= 30);
          setGeofenceAlerts(org.settings.strictGeofence !== false);
          setStrictGeofence(org.settings.strictGeofence !== false);
          setRequireSelfie(org.settings.requireSelfieAttendance !== false);
          setRequireSignature(org.settings.requireClientSignature !== false);
          setRequireMeetingSelfie(org.settings.requireMeetingSelfie !== false);
        }
      }
    } catch (err) {
      console.log('Fetch org settings error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isManager) {
      fetchOrg();
    } else {
      setLoading(false);
    }
  }, [isManager]);

  if (isManager) {
    return <ManagerSettingsConsole user={user} authOrg={authOrg} logout={logout} router={router} />;
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrg();
    setRefreshing(false);
  };

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(admin)/dashboard');
    }
  };

  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm('Are you sure you want to log out of your KisanConnect account?')) {
        try { stopHeartbeat(); } catch (_) {}
        await logout();
        router.replace('/(auth)/login');
      }
    } else {
      Alert.alert(
        'Logout Confirm',
        'Are you sure you want to log out of your KisanConnect account?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Logout',
            style: 'destructive',
            onPress: async () => {
              try { stopHeartbeat(); } catch (_) {}
              await logout();
              router.replace('/(auth)/login');
            },
          },
        ]
      );
    }
  };

  const handlePickLogo = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Permission to access gallery is required to upload logo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        setUploadingLogo(true);
        const imageUri = result.assets[0].uri;

        let formData = new FormData();
        if (Platform.OS === 'web') {
          const response = await fetch(imageUri);
          const blob = await response.blob();
          formData.append('image', blob, 'logo.jpg');
        } else {
          formData = imageUri;
        }

        const uploadRes = await uploadAPI.uploadImageFormData(formData, 'org_logo.jpg');
        setUploadingLogo(false);

        if (uploadRes.data?.url || uploadRes.data?.imageUrl) {
          const newUrl = uploadRes.data.url || uploadRes.data.imageUrl;
          setOrgLogo(newUrl);
          Alert.alert('Success', 'Logo uploaded! Click Save to apply changes.');
        } else {
          Alert.alert('Upload Status', 'Logo uploaded locally. Please save settings.');
        }
      }
    } catch (err) {
      setUploadingLogo(false);
      Alert.alert('Upload Error', err.message || 'Failed to pick logo image');
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      const res = await adminAPI.updateOrganization({
        name: orgName,
        logo: orgLogo,
        Org_logo: orgLogo,
        companyLogo: orgLogo,
        email: orgEmail,
        phone: orgPhone,
        slug: orgSlug,
        settings: {
          ...orgSettings,
          trackingIntervalSeconds: highAccuracy ? 15 : 60,
          strictGeofence: strictGeofence,
          requireSelfieAttendance: requireSelfie,
          requireClientSignature: requireSignature,
          requireMeetingSelfie: requireMeetingSelfie,
        }
      });

      setSaving(false);
      if (res.data?.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        Alert.alert('Settings Saved', 'Organization profile & policies updated successfully!');
      } else {
        Alert.alert('Error', res.data?.message || 'Failed to update organization');
      }
    } catch (err) {
      setSaving(false);
      Alert.alert('Error', err.response?.data?.message || err.message || 'Server error while saving settings');
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#047857" />
      
      {/* Vibrant Emerald Gradient Top Bar */}
      <LinearGradient
        colors={['#047857', '#0d9488', '#0f766e']}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView edges={['top', 'left', 'right']}>
          <View style={styles.topNavRow}>
            <TouchableOpacity style={styles.headerBtn} onPress={handleGoBack} activeOpacity={0.7}>
              <ArrowLeft size={20} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.brandTitle}>Organization Settings</Text>
              <Text style={styles.brandSub}>Manage branding, policies & features</Text>
            </View>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={handleSaveSettings}
              activeOpacity={0.7}
              disabled={saving}
            >
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Save size={18} color="#fff" />}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1, backgroundColor: COLORS.background }}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading Organization Settings...</Text>
          </View>
        ) : (
          <>
            {saveSuccess && (
              <View style={styles.saveSuccessBanner}>
                <CheckCircle2 size={18} color={COLORS.success} />
                <Text style={styles.saveSuccessText}>Organization Settings Saved Successfully!</Text>
              </View>
            )}

            {/* 1. ORGANIZATION BRANDING & LOGO */}
            <Surface style={[styles.sectionCard, cardShadow]} elevation={1}>
              <View style={styles.cleanSectionHeader}>
                <Building2 size={20} color={COLORS.primary} />
                <Text style={styles.cleanSectionTitle}>Organization Identity & Branding</Text>
              </View>

              <View style={styles.logoSection}>
                <View style={styles.logoPreviewRow}>
                  <View style={styles.logoBox}>
                    {orgLogo ? (
                      <Image source={{ uri: orgLogo }} style={styles.logoImage} resizeMode="contain" />
                    ) : (
                      <Building2 size={32} color={COLORS.primary} />
                    )}
                  </View>
                  <TouchableOpacity
                    style={[styles.uploadLogoBtn, uploadingLogo && { opacity: 0.6 }]}
                    onPress={handlePickLogo}
                    disabled={uploadingLogo}
                    activeOpacity={0.8}
                  >
                    {uploadingLogo ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Camera size={16} color="#fff" />
                        <Text style={styles.uploadLogoText}>Upload Logo</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>ORGANIZATION NAME</Text>
                <View style={styles.inputWrap}>
                  <Building2 size={16} color={COLORS.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    value={orgName}
                    onChangeText={setOrgName}
                    placeholder="Company Name"
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>SUPPORT EMAIL</Text>
                <View style={styles.inputWrap}>
                  <Mail size={16} color={COLORS.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    value={orgEmail}
                    onChangeText={setOrgEmail}
                    placeholder="support@company.com"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="email-address"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>CONTACT PHONE</Text>
                <View style={styles.inputWrap}>
                  <Phone size={16} color={COLORS.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    value={orgPhone}
                    onChangeText={setOrgPhone}
                    placeholder="+91 9876543210"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>
            </Surface>

            {/* 2. FIELD TRACKING & ATTENDANCE POLICIES */}
            <Surface style={[styles.sectionCard, cardShadow]} elevation={1}>
              <View style={styles.cleanSectionHeader}>
                <Navigation size={20} color={COLORS.secondary} />
                <Text style={styles.cleanSectionTitle}>Tracking & Attendance Rules</Text>
              </View>

              <ToggleRow
                icon={Compass}
                iconColor={COLORS.primary}
                label="High-Precision GPS Interval (15s)"
                value={highAccuracy}
                onValueChange={setHighAccuracy}
              />
              <ToggleRow
                icon={MapPin}
                iconColor={COLORS.success}
                label="Strict Geofence Attendance Check-in"
                value={strictGeofence}
                onValueChange={setStrictGeofence}
              />
              <ToggleRow
                icon={Camera}
                iconColor={COLORS.rose}
                label="Mandatory Live Selfie Check-in"
                value={requireSelfie}
                onValueChange={setRequireSelfie}
              />
            </Surface>

            {/* SAVE BUTTON */}
            <TouchableOpacity
              style={styles.saveOrgBtn}
              onPress={handleSaveSettings}
              disabled={saving}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#047857', '#0d9488']}
                style={styles.saveBtnGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Save size={18} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.saveBtnText}>Save Organization Settings</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* LOGOUT BUTTON */}
            <TouchableOpacity
              style={styles.logoutFullBtn}
              onPress={handleLogout}
              activeOpacity={0.8}
            >
              <LogOut size={16} color={COLORS.danger} />
              <Text style={styles.logoutFullBtnText}>Logout from Account</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerGradient: {
    borderCurve: 'round',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingBottom: 20,
    paddingTop: Platform.OS === 'android' ? 14 : 10,
  },
  topNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    fontFamily: FONT,
  },
  brandSub: {
    color: 'rgba(255, 255, 255, 0.78)',
    fontSize: 11,
    fontWeight: '500',
    fontFamily: FONT,
  },

  // Manager Profile Header Card
  managerProfileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...cardShadow,
  },
  managerAvatarBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  managerAvatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  managerAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  managerAvatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    fontFamily: FONT,
  },
  managerProfileName: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    fontFamily: FONT,
  },
  managerProfileEmail: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
    fontFamily: FONT,
  },
  roleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  managerRoleBadge: {
    backgroundColor: COLORS.primaryMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
  },
  managerRoleBadgeText: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '800',
    fontFamily: FONT,
  },
  managerOrgText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    fontFamily: FONT,
  },

  body: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 40,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
    gap: 12,
  },

  saveSuccessBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.successLight,
    borderColor: COLORS.successBorder,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  saveSuccessText: {
    color: COLORS.success,
    fontWeight: '700',
    fontSize: 12,
    fontFamily: FONT,
  },

  // Overview grid
  overviewGrid: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'space-around',
    ...cardShadow,
  },
  overviewMetric: {
    alignItems: 'center',
  },
  overviewVal: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    fontFamily: FONT,
  },
  overviewLbl: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    marginTop: 2,
    fontFamily: FONT,
  },

  cleanSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  cleanSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
    fontFamily: FONT,
  },

  // Section Card
  sectionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    fontFamily: FONT,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
    fontFamily: FONT,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  sectionBody: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingTop: 14,
    gap: 14,
  },

  // Inputs
  inputGroup: {
    marginBottom: 4,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textSecondary,
    marginBottom: 6,
    letterSpacing: 0.5,
    fontFamily: FONT,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    backgroundColor: COLORS.card,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
    fontFamily: FONT,
    paddingVertical: 0,
  },

  // Save Btn
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
    fontFamily: FONT,
  },

  // Success & Error Banners
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.successLight,
    borderColor: COLORS.successBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 8,
    marginBottom: 10,
  },
  successBannerText: {
    color: COLORS.success,
    fontWeight: '700',
    fontSize: 12,
    fontFamily: FONT,
  },
  errorBanner: {
    backgroundColor: COLORS.dangerLight,
    borderColor: COLORS.dangerBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  errorBannerText: {
    color: COLORS.danger,
    fontWeight: '700',
    fontSize: 12,
    fontFamily: FONT,
  },

  // Shortcuts
  shortcutTile: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...cardShadow,
  },
  shortcutTileText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
    fontFamily: FONT,
  },

  // Logout Btn
  logoutBtn: {
    backgroundColor: COLORS.dangerLight,
    borderColor: COLORS.dangerBorder,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    marginBottom: 30,
  },
  logoutBtnText: {
    color: COLORS.danger,
    fontWeight: '800',
    fontSize: 13,
    fontFamily: FONT,
  },

  // Logo upload section
  logoSection: {
    marginBottom: 12,
  },
  logoPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 4,
  },
  logoBox: {
    width: 60,
    height: 60,
    borderRadius: 14,
    backgroundColor: COLORS.primaryMuted,
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImage: {
    width: 54,
    height: 54,
  },
  uploadLogoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  uploadLogoText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
    fontFamily: FONT,
  },
  logoHelpText: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 6,
    fontFamily: FONT,
  },

  // Toggle Row
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  toggleIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    fontFamily: FONT,
  },
  settingSub: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 1,
    fontFamily: FONT,
  },

  // Geo Pills
  geoPillRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  geoPill: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
  },
  geoPillVal: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
    fontFamily: FONT,
  },
  geoPillLbl: {
    fontSize: 8,
    color: COLORS.textMuted,
    fontWeight: '700',
    marginTop: 2,
    fontFamily: FONT,
  },

  // Feature cards
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 10,
    borderLeftWidth: 3,
    gap: 10,
  },
  featureIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
    fontFamily: FONT,
  },
  featureDesc: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 1,
    fontFamily: FONT,
    lineHeight: 14,
  },
  featureActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.successLight,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.successBorder,
  },
  featureActiveText: {
    fontSize: 8,
    fontWeight: '800',
    color: COLORS.success,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Buttons
  saveOrgBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 14,
  },
  saveBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
    borderRadius: 16,
  },
  logoutFullBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.dangerLight,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
  },
  logoutFullBtnText: {
    color: COLORS.danger,
    fontWeight: '700',
    fontSize: 13,
    fontFamily: FONT,
  },

  // Loading
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '600',
    fontFamily: FONT,
  },
});
