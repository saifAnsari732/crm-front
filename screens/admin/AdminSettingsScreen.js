import React, { useState, useEffect } from 'react';
import {
  StyleSheet, View, ScrollView, TouchableOpacity, Switch,
  Platform, RefreshControl, StatusBar, TextInput, Image, ActivityIndicator, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Surface } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Settings, Shield, Navigation, Building2, Upload, CheckCircle2, Save, Image as ImageIcon, ArrowLeft, LogOut } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { stopHeartbeat } from '../../services/locationTask';
import { adminAPI, uploadAPI, getAvatarUrl } from '../../services/api';

const FONT = Platform.OS === 'ios' ? 'System' : 'sans-serif-medium';
const NAVY_DARK = '#0f172a';
const NAVY_MID = '#1e293b';
const BG_COLOR = '#f8fafc';

const cardShadow = Platform.OS === 'web'
  ? { boxShadow: '0px 4px 14px rgba(15, 23, 42, 0.08)' }
  : { elevation: 3, shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } };

export default function AdminSettingsScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Organization fields
  const [orgName, setOrgName] = useState('Kisan Choice Pvt Ltd');
  const [orgLogo, setOrgLogo] = useState('');
  const [orgEmail, setOrgEmail] = useState('');
  const [orgPhone, setOrgPhone] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // System controls
  const [highAccuracy, setHighAccuracy] = useState(true);
  const [geofenceAlerts, setGeofenceAlerts] = useState(true);
  const [requireOTP, setRequireOTP] = useState(true);
  const [emailNotify, setEmailNotify] = useState(true);

  const fetchOrg = async () => {
    try {
      setLoading(true);
      const res = await adminAPI.getOrganization();
      if (res.data?.success && res.data.organization) {
        const org = res.data.organization;
        if (org.name) setOrgName(org.name);
        if (org.logo) setOrgLogo(org.logo);
        if (org.email) setOrgEmail(org.email);
        if (org.phone) setOrgPhone(org.phone);
      }
    } catch (err) {
      console.log('Fetch org settings error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrg();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrg();
    setRefreshing(false);
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout Confirm',
      'Are you sure you want to log out of KisanConnect?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try { stopHeartbeat(); } catch (_) {}
            logout();
          },
        },
      ]
    );
  };

  const handlePickLogo = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Permission to access gallery is required to upload logo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions?.Images || 'images',
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
          Alert.alert('Success', 'Organization Logo uploaded! Click Save below to apply changes.');
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
      setLoading(true);
      const res = await adminAPI.updateOrganization({
        name: orgName,
        logo: orgLogo,
        email: orgEmail,
        phone: orgPhone,
      });

      if (res.data?.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        Alert.alert('Success', 'Organization Logo & Settings updated successfully!');
      } else {
        Alert.alert('Notice', res.data?.message || 'Settings saved');
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to save organization settings');
    } finally {
      setLoading(false);
    }
  };

  const currentLogoUrl = getAvatarUrl(orgLogo);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY_DARK} />

      {/* HEADER */}
      <LinearGradient colors={[NAVY_DARK, NAVY_MID]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerTitleRow}>
            <TouchableOpacity style={styles.headerBackBtn} onPress={() => router.back()} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <ArrowLeft size={20} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 6 }}>
              <Text style={styles.headerTitle}>Organization & Security Settings</Text>
              <Text style={styles.headerSub}>Manage organization logo, profile & policies</Text>
            </View>
            <TouchableOpacity style={styles.headerLogoutBtn} onPress={handleLogout} activeOpacity={0.7}>
              <LogOut size={18} color="#fca5a5" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* BODY */}
      <ScrollView
        style={{ backgroundColor: BG_COLOR }}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />}
      >
        {/* SECTION 1: ORGANIZATION LOGO & PROFILE */}
        <Surface style={[styles.sectionCard, cardShadow]} elevation={1}>
          <View style={styles.sectionHeader}>
            <Building2 size={18} color="#059669" />
            <Text style={styles.sectionTitle}>Organization Branding & Logo</Text>
          </View>

          {/* Logo Upload Box */}
          <View style={styles.logoSectionRow}>
            <View style={styles.logoPreviewBox}>
              {currentLogoUrl ? (
                <Image source={{ uri: currentLogoUrl }} style={styles.logoImage} resizeMode="contain" />
              ) : (
                <Building2 size={32} color="#059669" />
              )}
            </View>

            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.inputLabel}>Organization Logo</Text>
              <TouchableOpacity
                style={styles.uploadBtn}
                onPress={handlePickLogo}
                disabled={uploadingLogo}
                activeOpacity={0.8}
              >
                {uploadingLogo ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Upload size={14} color="#fff" />
                    <Text style={styles.uploadBtnText}>Upload New Logo</Text>
                  </>
                )}
              </TouchableOpacity>
              <Text style={styles.helpText}>PNG or JPG format, square aspect ratio recommended</Text>
            </View>
          </View>

          {/* Logo URL Direct Input */}
          <View style={styles.fieldGroup}>
            <Text style={styles.inputLabel}>Logo Image URL (Direct Link)</Text>
            <View style={styles.inputWrap}>
              <ImageIcon size={16} color="#64748b" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.textInput}
                value={orgLogo}
                onChangeText={setOrgLogo}
                placeholder="https://example.com/logo.png"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Organization Name Input */}
          <View style={styles.fieldGroup}>
            <Text style={styles.inputLabel}>Organization Name</Text>
            <View style={styles.inputWrap}>
              <Building2 size={16} color="#64748b" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.textInput}
                value={orgName}
                onChangeText={setOrgName}
                placeholder="Enter Organization Name"
                placeholderTextColor="#94a3b8"
              />
            </View>
          </View>

          {/* Organization Contact Email */}
          <View style={styles.fieldGroup}>
            <Text style={styles.inputLabel}>Support Email</Text>
            <TextInput
              style={styles.textInputFull}
              value={orgEmail}
              onChangeText={setOrgEmail}
              placeholder="contact@organization.com"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        </Surface>

        {/* SECTION 2: TRACKING ENGINE */}
        <Surface style={[styles.sectionCard, cardShadow]} elevation={1}>
          <View style={styles.sectionHeader}>
            <Navigation size={18} color="#2563eb" />
            <Text style={styles.sectionTitle}>Tracking Engine & Geofencing</Text>
          </View>

          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>High-Precision GPS Interval</Text>
              <Text style={styles.settingSub}>Capture location every 15 seconds on field</Text>
            </View>
            <Switch value={highAccuracy} onValueChange={setHighAccuracy} trackColor={{ false: '#cbd5e1', true: '#93c5fd' }} thumbColor={highAccuracy ? '#2563eb' : '#f1f5f9'} />
          </View>

          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Automated Geofence Breach Alerts</Text>
              <Text style={styles.settingSub}>Notify manager when employee leaves site radius</Text>
            </View>
            <Switch value={geofenceAlerts} onValueChange={setGeofenceAlerts} trackColor={{ false: '#cbd5e1', true: '#93c5fd' }} thumbColor={geofenceAlerts ? '#2563eb' : '#f1f5f9'} />
          </View>
        </Surface>

        {/* SECTION 3: SECURITY & AUTH */}
        <Surface style={[styles.sectionCard, cardShadow]} elevation={1}>
          <View style={styles.sectionHeader}>
            <Shield size={18} color="#e11d48" />
            <Text style={styles.sectionTitle}>Security & Authentication</Text>
          </View>

          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Require OTP / Email Verification</Text>
              <Text style={styles.settingSub}>Enforce verification on password resets</Text>
            </View>
            <Switch value={requireOTP} onValueChange={setRequireOTP} trackColor={{ false: '#cbd5e1', true: '#fda4af' }} thumbColor={requireOTP ? '#e11d48' : '#f1f5f9'} />
          </View>

          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Email Activity Digest</Text>
              <Text style={styles.settingSub}>Daily summary of team check-ins & reports</Text>
            </View>
            <Switch value={emailNotify} onValueChange={setEmailNotify} trackColor={{ false: '#cbd5e1', true: '#fda4af' }} thumbColor={emailNotify ? '#e11d48' : '#f1f5f9'} />
          </View>
        </Surface>

        {/* SAVE BUTTON */}
        <TouchableOpacity
          style={[styles.saveBtn, saveSuccess && { backgroundColor: '#10b981' }]}
          onPress={handleSaveSettings}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : saveSuccess ? (
            <>
              <CheckCircle2 size={18} color="#fff" />
              <Text style={styles.saveBtnText}>Organization Logo & Settings Saved!</Text>
            </>
          ) : (
            <>
              <Save size={18} color="#fff" />
              <Text style={styles.saveBtnText}>Save Organization Logo & Settings</Text>
            </>
          )}
        </TouchableOpacity>

        {/* LOGOUT BUTTON */}
        <TouchableOpacity
          style={styles.logoutFullBtn}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <LogOut size={18} color="#ef4444" />
          <Text style={styles.logoutFullBtnText}>Logout from KisanConnect Account</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG_COLOR },
  header: { paddingHorizontal: 16, paddingBottom: 20, paddingTop: Platform.OS === 'android' ? 10 : 0 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerBackBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  headerLogoutBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', fontFamily: FONT },
  headerSub: { color: '#94a3b8', fontSize: 10, marginTop: 1 },

  body: { padding: 14, gap: 14, maxWidth: 720, width: '100%', alignSelf: 'center' },
  sectionCard: { backgroundColor: '#fff', borderRadius: 18, padding: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#0f172a', fontFamily: FONT },

  logoSectionRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14, backgroundColor: '#f8fafc', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#f1f5f9' },
  logoPreviewBox: { width: 64, height: 64, borderRadius: 14, backgroundColor: '#ecfdf5', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#d1fae5', overflow: 'hidden' },
  logoImage: { width: 56, height: 56, borderRadius: 10 },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#059669', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 6, alignSelf: 'flex-start' },
  uploadBtnText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  helpText: { fontSize: 9, color: '#94a3b8' },

  fieldGroup: { marginTop: 10 },
  inputLabel: { fontSize: 11, fontWeight: 'bold', color: '#334155', marginBottom: 4 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 10 },
  textInput: { flex: 1, height: 42, fontSize: 13, color: '#0f172a', fontFamily: FONT },
  textInputFull: { backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 12, height: 42, fontSize: 13, color: '#0f172a', fontFamily: FONT },

  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  settingLabel: { fontSize: 13, fontWeight: 'bold', color: '#0f172a' },
  settingSub: { fontSize: 10, color: '#64748b', marginTop: 2 },

  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', paddingVertical: 14, borderRadius: 14, gap: 8, marginTop: 10 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  logoutFullBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff5f5', borderMinHeight: 48, paddingVertical: 14, borderRadius: 14, gap: 8, borderWidth: 1, borderColor: '#fecaca', marginBottom: 30 },
  logoutFullBtnText: { color: '#ef4444', fontWeight: 'bold', fontSize: 14 },
});
