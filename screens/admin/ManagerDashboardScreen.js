import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet, View, ScrollView, TouchableOpacity,
  ActivityIndicator, Platform, RefreshControl, StatusBar,
  Dimensions, Modal, Linking, Image, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Surface, Avatar } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import {
  Menu, Bell, MapPin, Users, UserCheck, Navigation, Clock,
  ClipboardList, UserMinus, ChevronRight, Phone, Mail, Briefcase,
  DollarSign, X, MessageSquare, ShieldCheck, ArrowRight, Compass,
  Route, CheckCircle2, AlertCircle, Layers, RefreshCw, FileText,
  CalendarCheck, Sparkles, Building2, LayoutDashboard, Settings,
  LogOut, Shield, ChevronDown, Radio, Power, Play, Camera, Calendar,
  Wallet, UserPlus, CheckSquare
} from 'lucide-react-native';
import MapViewComponent from '../../components/MapViewComponent';
import { adminAPI, trackingAPI, uploadAPI, getAvatarUrl, stopHeartbeat } from '../../services/api';
import useLocationTracker from '../../hooks/useLocationTracker';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');
const FONT = Platform.OS === 'ios' ? 'System' : 'sans-serif-medium';

const formatAddress = (addr, fallback = '') => {
  if (!addr) return fallback;

  let parsed = addr;
  if (typeof addr === 'string') {
    const trimmed = addr.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        parsed = JSON.parse(trimmed);
      } catch (e) {
        parsed = trimmed;
      }
    } else {
      return trimmed || fallback;
    }
  }

  if (typeof parsed === 'object' && parsed !== null) {
    if (parsed.street || parsed.city || parsed.state || parsed.pincode) {
      const parts = [parsed.street, parsed.city, parsed.state, parsed.pincode]
        .filter(Boolean)
        .map(s => String(s).trim())
        .filter(Boolean);
      if (parts.length > 0) return parts.join(', ');
    }
    if (parsed.name || parsed.label || parsed.title || parsed.formattedAddress || parsed.address) {
      const val = parsed.name || parsed.label || parsed.title || parsed.formattedAddress || parsed.address;
      if (typeof val === 'string' && val.trim()) return val.trim();
    }
    return fallback;
  }

  return String(parsed || '').trim() || fallback;
};

// ── UI/UX Pro Max Colors (No Black Colors!) ──
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
  text: '#1E293B',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  success: '#059669',
  successLight: '#ECFDF5',
  successBorder: '#A7F3D0',
  warning: '#D97706',
  warningLight: '#FFFBEB',
  danger: '#DC2626',
  dangerLight: '#FEF2F2',
  purple: '#7C3AED',
  purpleLight: '#F5F3FF',
  indigo: '#4F46E5',
  indigoLight: '#EEF2FF',
  headerStart: '#2563EB',
  headerEnd: '#4F46E5',
};

const cardShadow = Platform.OS === 'web'
  ? { boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05)' }
  : { elevation: 2, shadowColor: '#64748B', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } };

export default function ManagerDashboardScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const mapRef = useRef(null);

  const { isTracking, startTracking, stopTracking, requestPermissions } = useLocationTracker();
  const [isUploadingSelfie, setIsUploadingSelfie] = useState(false);

  const [teamMembers, setTeamMembers] = useState([]);
  const [liveLocations, setLiveLocations] = useState([]);
  const [orgData, setOrgData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [sideMenuVisible, setSideMenuVisible] = useState(false);

  const handleClockToggle = async () => {
    if (isTracking) {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.confirm('Are you sure you want to end your active operational tracking shift?')) {
          const res = await stopTracking();
          if (res.success) {
            alert(`Shift Ended. Clock out complete. Logged ${res.totalDistance?.toFixed(2) || 0} km traveled.`);
            fetchData(false);
          } else {
            alert(res.error || "Failed to stop tracking session.");
          }
        }
      } else {
        Alert.alert(
          "Confirm Clock Out",
          "Are you sure you want to end your active operational tracking shift?",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "End Shift",
              style: "destructive",
              onPress: async () => {
                const res = await stopTracking();
                if (res.success) {
                  Alert.alert(
                    "Shift Ended",
                    `Clock out complete. Logged ${res.totalDistance?.toFixed(2) || 0} km traveled.`,
                  );
                  fetchData(false);
                } else {
                  Alert.alert("Error", res.error || "Failed to stop tracking session.");
                }
              },
            },
          ],
        );
      }
    } else {
      try {
        setIsUploadingSelfie(true);

        const hasAllPermissions = await requestPermissions();
        if (!hasAllPermissions) {
          setIsUploadingSelfie(false);
          return;
        }

        if (Platform.OS !== 'web') {
          const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
          if (cameraStatus !== 'granted') {
            Alert.alert("Camera Permission Required", "Camera permission is required to log selfie check-in.");
            setIsUploadingSelfie(false);
            return;
          }
        }

        const photoResult = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.6,
          cameraType: ImagePicker.CameraType?.front || 'front',
        });

        if (photoResult.canceled || !photoResult.assets?.length) {
          if (Platform.OS === 'web') alert("Shift Not Started: Selfie check-in is mandatory to punch in.");
          else Alert.alert("Shift Not Started", "Selfie check-in is mandatory to punch in.");
          setIsUploadingSelfie(false);
          return;
        }

        const selfieAsset = photoResult.assets[0];
        let selfieUrl = '';

        try {
          if (Platform.OS === 'web') {
            const formData = new FormData();
            const filename = selfieAsset.uri.split('/').pop() || 'selfie.jpg';
            const resp = await fetch(selfieAsset.uri);
            const blob = await resp.blob();
            formData.append('image', blob, filename);
            const uploadRes = await uploadAPI.uploadImageFormData(formData);
            selfieUrl = uploadRes.data?.url || '';
          } else {
            const uploadRes = await uploadAPI.uploadImageFormData(selfieAsset.uri);
            selfieUrl = uploadRes.data?.url || '';
          }
        } catch (uploadErr) {
          console.log('Selfie upload note:', uploadErr.message);
        }

        const res = await startTracking(selfieUrl);
        if (res.success) {
          fetchData(false);
        } else {
          if (Platform.OS === 'web') alert(res.error || "Failed to start shift.");
          else Alert.alert("Failed to Start Shift", res.error || "Check location and camera permissions.");
        }
      } catch (err) {
        console.log('Manager selfie capture error:', err.message);
        if (Platform.OS === 'web') alert("Could not complete selfie check-in. Please try again.");
        else Alert.alert("Error", "Could not complete selfie check-in. Please try again.");
      } finally {
        setIsUploadingSelfie(false);
      }
    }
  };

  const fetchData = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const [empRes, locRes, orgRes] = await Promise.all([
        adminAPI.getEmployees({ limit: 200 }).catch(() => ({ data: { success: false } })),
        trackingAPI.getLiveLocations().catch(() => ({ data: { success: false } })),
        adminAPI.getOrganization().catch(() => ({ data: { success: false } })),
      ]);

      if (empRes.data?.success) {
        setTeamMembers(empRes.data.employees || empRes.data.data || []);
      }
      if (locRes.data?.success) {
        setLiveLocations(locRes.data.locations || locRes.data.data || []);
      }
      if (orgRes.data?.success && orgRes.data.organization) {
        setOrgData(orgRes.data.organization);
      }
    } catch (e) {
      console.log('Manager dashboard fetch error:', e.message);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData(false);
    setRefreshing(false);
  };

  const handleLogout = async () => {
    setSideMenuVisible(false);
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm('Are you sure you want to log out of KisanConnect?')) {
        try { stopHeartbeat(); } catch (_) {}
        await logout();
        router.replace('/(auth)/login');
      }
    } else {
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
              await logout();
              router.replace('/(auth)/login');
            },
          },
        ]
      );
    }
  };

  // Organization Branding
  const orgName = orgData?.name || user?.organizationName || user?.organization?.name || 'My Organization';
  const orgLogoUrl = getAvatarUrl(orgData?.logo || user?.organizationLogo);

  // Directory Staff Mapping with Live Tracking & Distance Metrics
  const directoryStaff = teamMembers.map((emp) => {
    const liveLoc = liveLocations.find((l) =>
      (l.employeeId && String(l.employeeId) === String(emp._id || emp.employeeId)) ||
      (l.employeeIdCode && emp.employeeId && String(l.employeeIdCode) === String(emp.employeeId)) ||
      (l.name && emp.name && l.name.toLowerCase() === emp.name.toLowerCase())
    );

    return {
      _id: emp._id || emp.employeeId,
      name: emp.name || 'Field Agent',
      avatar: emp.avatar || liveLoc?.avatar,
      department: formatAddress(emp.department || liveLoc?.department, 'Field Services'),
      role: formatAddress(emp.role, 'Field Executive'),
      phone: emp.phone,
      email: emp.email,
      isTracking: !!liveLoc || emp.isTracking || emp.isOnline,
      isOnline: emp.isOnline || !!liveLoc,
      lat: liveLoc?.lat || emp.lat || null,
      lng: liveLoc?.lng || emp.lng || null,
      totalDistance: liveLoc?.totalDistance || emp.totalDistance || 0,
      totalMeetings: emp.totalMeetings || liveLoc?.totalMeetings || 0,
      address: formatAddress(liveLoc?.address || emp.address, liveLoc ? 'Active On Field' : 'Not Punched In'),
      sessionId: liveLoc?.sessionId || emp.sessionId || null,
      updatedAt: liveLoc?.updatedAt || emp.updatedAt || null,
    };
  });

  // Metrics
  const totalTeam = directoryStaff.length;
  const activeLive = directoryStaff.filter(m => m.isTracking).length;
  const presentCount = directoryStaff.filter(m => m.isOnline).length;
  const totalKmToday = directoryStaff.reduce((sum, item) => sum + (parseFloat(item.totalDistance) || 0), 0);
  const totalVisitsToday = directoryStaff.reduce((sum, item) => sum + (parseInt(item.totalMeetings) || 0), 0);

  const presentPercent = totalTeam > 0 ? Math.round((presentCount / totalTeam) * 100) : 0;
  const livePercent = totalTeam > 0 ? Math.round((activeLive / totalTeam) * 100) : 0;

  const weeklyAttendance = [
    { day: 'Mon', val: 75 },
    { day: 'Tue', val: 85 },
    { day: 'Wed', val: 70 },
    { day: 'Thu', val: 92 },
    { day: 'Fri', val: 80 },
    { day: 'Sat', val: 65 },
    { day: 'Sun', val: 88 },
  ];

  const defaultRegion = {
    latitude: liveLocations[0]?.lat ? parseFloat(liveLocations[0].lat) : 26.4499,
    longitude: liveLocations[0]?.lng ? parseFloat(liveLocations[0].lng) : 80.3319,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  };

  const goTo = (path) => {
    setSideMenuVisible(false);
    router.push(path);
  };

  const handleCall = (phone) => {
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  const handleWhatsApp = (phone) => {
    if (phone) Linking.openURL(`https://wa.me/${phone.replace(/[^0-9]/g, '')}`);
  };

  const getUserInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: COLORS.background }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading Organization Dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {/* ── TOP HEADER SECTION WITH ORG LOGO & NAME (No Black Colors) ── */}
      <LinearGradient
        colors={[COLORS.headerStart, COLORS.headerEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <SafeAreaView edges={['top']}>
          {/* Top Navigation Row */}
          <View style={styles.topNavRow}>
            <TouchableOpacity style={styles.headerBtn} onPress={() => setSideMenuVisible(true)} activeOpacity={0.7}>
              <Menu size={20} color="#fff" />
            </TouchableOpacity>

            {/* Organization Logo & Name Header */}
            <View style={styles.brandBox}>
              {orgLogoUrl ? (
                <Image source={{ uri: orgLogoUrl }} style={styles.headerOrgLogoImg} resizeMode="contain" />
              ) : (
                <View style={styles.headerOrgLogoFallback}>
                  <Building2 size={16} color={COLORS.primary} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.brandTitle} numberOfLines={1}>{orgName}</Text>
                <Text style={styles.brandSub}>Manager Console</Text>
              </View>
            </View>

            <View style={styles.topNavRight}>
              <TouchableOpacity style={styles.headerBtn} onPress={onRefresh} activeOpacity={0.7}>
                <RefreshCw size={18} color="#fff" />
              </TouchableOpacity>
              <View style={styles.profileAvatar}>
                <Text style={styles.profileAvatarText}>{getUserInitials(user?.name)}</Text>
              </View>
            </View>
          </View>

          {/* Sub Header Greeting */}
          <View style={styles.greetingBox}>
            <Text style={styles.greetingSub}>Welcome back,</Text>
            <Text style={styles.greetingTitle}>{user?.name || 'Manager'}</Text>
            <Text style={styles.greetingDesc}>{orgName} • Team Telemetry & Operations</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* ── SCROLLABLE BODY CONTENT ── */}
      <ScrollView
        style={{ backgroundColor: COLORS.background }}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* ── MANAGER PUNCH-IN & FIELD DUTY TRACKING CARD (Halka Pink Theme + Black Text) ── */}
        <Surface style={[styles.trackingCard, cardShadow, { borderColor: isTracking ? '#A7F3D0' : '#FECDD3', borderWidth: 1 }]} elevation={3}>
          <LinearGradient
            colors={isTracking ? ['#ECFDF5', '#D1FAE5'] : ['#FFF1F2', '#FFE4E6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.trackingGradient}
          >
            <View style={styles.trackingHeaderRow}>
              <View style={[styles.trackingBadgeRow, { backgroundColor: isTracking ? 'rgba(5, 150, 105, 0.15)' : 'rgba(225, 29, 72, 0.12)' }]}>
                <View style={[styles.statusPulseDot, { backgroundColor: isTracking ? '#059669' : '#E11D48' }]} />
                <Text style={[styles.trackingBadgeText, { color: '#000000' }]}>
                  {isTracking ? 'FIELD DUTY LIVE TRACKING ACTIVE' : 'DUTY PUNCHED OUT'}
                </Text>
              </View>
              <View style={[styles.roleTag, { backgroundColor: isTracking ? 'rgba(5, 150, 105, 0.18)' : 'rgba(225, 29, 72, 0.15)' }]}>
                <ShieldCheck size={14} color="#000000" />
                <Text style={[styles.roleTagText, { color: '#000000' }]}>Manager Duty</Text>
              </View>
            </View>

            <View style={styles.trackingContentRow}>
              <Text style={[styles.trackingMainTitle, { color: '#000000' }]}>
                {isTracking ? 'Your Field Duty Shift Is Active' : 'Start Your Field Shift (Punch In)'}
              </Text>
              <Text style={[styles.trackingSubTitle, { color: '#1E293B' }]}>
                {isTracking
                  ? 'GPS location & distance telemetry are active. End shift when duty completes.'
                  : 'Take mandatory selfie verification to start tracking field visits, distance & route.'}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.punchBtn,
                isTracking ? styles.punchBtnStop : styles.punchBtnStartPink
              ]}
              onPress={handleClockToggle}
              disabled={isUploadingSelfie}
              activeOpacity={0.85}
            >
              {isUploadingSelfie ? (
                <View style={styles.punchBtnInner}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={[styles.punchBtnText, { color: '#fff' }]}>
                    Verifying Selfie & GPS...
                  </Text>
                </View>
              ) : isTracking ? (
                <View style={styles.punchBtnInner}>
                  <Power size={18} color="#fff" />
                  <Text style={[styles.punchBtnText, { color: '#fff' }]}>
                    End Field Shift (Punch Out)
                  </Text>
                </View>
              ) : (
                <View style={styles.punchBtnInner}>
                  <Camera size={18} color="#fff" />
                  <Text style={[styles.punchBtnText, { color: '#fff' }]}>
                    Punch In (Selfie Verification)
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </LinearGradient>
        </Surface>

        {/* ── MY TEAM SUMMARY BANNER (Clean Floating Surface) ── */}
        <Surface style={[styles.myTeamCard, cardShadow]} elevation={2}>
          <TouchableOpacity style={styles.myTeamInner} onPress={() => goTo('/(admin)/team')} activeOpacity={0.85}>
            <View style={styles.teamIconBox}>
              <Users size={22} color="#fff" />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.myTeamLabel}>{orgName} Team</Text>
              <Text style={styles.myTeamCount}>{totalTeam} Employees</Text>
              <View style={styles.viewTeamRow}>
                <Text style={styles.viewTeamText}>Manage Team & Details</Text>
                <ArrowRight size={13} color={COLORS.primary} style={{ marginLeft: 4 }} />
              </View>
            </View>
            <ChevronRight size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        </Surface>

        {/* ── MANAGER FIELD OPERATIONS & QUICK ACTIONS GRID ── */}
        <View style={{ marginBottom: 14 }}>
          <Text style={styles.quickGridHeaderTitle}>FIELD OPERATIONS & TEAM TOOLS</Text>
          
          {/* Row 1: Field Duties & Employee Features */}
          <View style={[styles.quickActionsGrid, { marginBottom: 8 }]}>
            <TouchableOpacity style={styles.actionPill} onPress={() => goTo('/(admin)/visits')} activeOpacity={0.7}>
              <View style={[styles.actionIconCircle, { backgroundColor: COLORS.indigoLight }]}>
                <Briefcase size={18} color={COLORS.indigo} />
              </View>
              <Text style={styles.actionPillLabel}>Visits</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionPill} onPress={() => goTo('/(employee)/tasks')} activeOpacity={0.7}>
              <View style={[styles.actionIconCircle, { backgroundColor: COLORS.purpleLight }]}>
                <CheckSquare size={18} color={COLORS.purple} />
              </View>
              <Text style={styles.actionPillLabel}>Tasks Plan</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionPill} onPress={() => goTo('/(employee)/leaves')} activeOpacity={0.7}>
              <View style={[styles.actionIconCircle, { backgroundColor: COLORS.warningLight }]}>
                <Calendar size={18} color={COLORS.warning} />
              </View>
              <Text style={styles.actionPillLabel}>Leaves</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionPill} onPress={() => goTo('/(employee)/expenses')} activeOpacity={0.7}>
              <View style={[styles.actionIconCircle, { backgroundColor: COLORS.successLight }]}>
                <Wallet size={18} color={COLORS.success} />
              </View>
              <Text style={styles.actionPillLabel}>Expenses</Text>
            </TouchableOpacity>
          </View>

          {/* Row 2: Sales & Team Telemetry */}
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity style={styles.actionPill} onPress={() => goTo('/(employee)/leads')} activeOpacity={0.7}>
              <View style={[styles.actionIconCircle, { backgroundColor: COLORS.primaryMuted }]}>
                <UserPlus size={18} color={COLORS.primary} />
              </View>
              <Text style={styles.actionPillLabel}>Leads</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionPill} onPress={() => goTo('/(admin)/tracking')} activeOpacity={0.7}>
              <View style={[styles.actionIconCircle, { backgroundColor: COLORS.primaryMuted }]}>
                <Compass size={18} color={COLORS.primary} />
              </View>
              <Text style={styles.actionPillLabel}>Live Map</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionPill} onPress={() => goTo('/(admin)/team')} activeOpacity={0.7}>
              <View style={[styles.actionIconCircle, { backgroundColor: COLORS.indigoLight }]}>
                <Users size={18} color={COLORS.indigo} />
              </View>
              <Text style={styles.actionPillLabel}>Team Staff</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionPill} onPress={() => goTo('/(admin)/reports')} activeOpacity={0.7}>
              <View style={[styles.actionIconCircle, { backgroundColor: COLORS.purpleLight }]}>
                <FileText size={18} color={COLORS.purple} />
              </View>
              <Text style={styles.actionPillLabel}>Reports</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 2X2 METRICS CARDS GRID ── */}
        <View style={styles.metricsGrid}>
          {/* Present Today */}
          <Surface style={[styles.metricCard, cardShadow]} elevation={1}>
            <View style={styles.metricCardTop}>
              <View style={[styles.metricIconBox, { backgroundColor: COLORS.successLight }]}>
                <UserCheck size={18} color={COLORS.success} />
              </View>
              <View style={[styles.percentTag, { backgroundColor: COLORS.successLight }]}>
                <Text style={[styles.percentText, { color: COLORS.success }]}>{presentPercent}%</Text>
              </View>
            </View>
            <Text style={styles.metricLabel}>Present Today</Text>
            <Text style={styles.metricVal}>{presentCount} / {totalTeam}</Text>
          </Surface>

          {/* Active On Field */}
          <Surface style={[styles.metricCard, cardShadow]} elevation={1}>
            <View style={styles.metricCardTop}>
              <View style={[styles.metricIconBox, { backgroundColor: COLORS.primaryMuted }]}>
                <Navigation size={18} color={COLORS.primary} />
              </View>
              <View style={[styles.percentTag, { backgroundColor: COLORS.primaryMuted }]}>
                <Text style={[styles.percentText, { color: COLORS.primary }]}>{livePercent}%</Text>
              </View>
            </View>
            <Text style={styles.metricLabel}>Active On Field</Text>
            <Text style={styles.metricVal}>{activeLive} Staff</Text>
          </Surface>

          {/* Today Distance KM */}
          <Surface style={[styles.metricCard, cardShadow]} elevation={1}>
            <View style={styles.metricCardTop}>
              <View style={[styles.metricIconBox, { backgroundColor: COLORS.purpleLight }]}>
                <Route size={18} color={COLORS.purple} />
              </View>
            </View>
            <Text style={styles.metricLabel}>Team Today KM</Text>
            <Text style={styles.metricVal}>{totalKmToday.toFixed(1)} <Text style={{ fontSize: 13, fontWeight: '700' }}>KM</Text></Text>
          </Surface>

          {/* Field Visits Today */}
          <Surface style={[styles.metricCard, cardShadow]} elevation={1}>
            <View style={styles.metricCardTop}>
              <View style={[styles.metricIconBox, { backgroundColor: COLORS.indigoLight }]}>
                <Briefcase size={18} color={COLORS.indigo} />
              </View>
            </View>
            <Text style={styles.metricLabel}>Visits Today</Text>
            <Text style={styles.metricVal}>{totalVisitsToday} Visits</Text>
          </Surface>
        </View>

        {/* ── LIVE FIELD MAP SECTION ── */}
        <Surface style={[styles.sectionCard, cardShadow]} elevation={1}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Compass size={18} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>Live Team Field Map</Text>
            </View>
            <TouchableOpacity onPress={() => goTo('/(admin)/tracking')}>
              <Text style={styles.viewAllText}>Full Screen Map →</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.embeddedMapWrap}>
            <MapViewComponent
              ref={mapRef}
              initialRegion={defaultRegion}
              directoryStaff={directoryStaff}
              onSelectEmployee={(emp) => setSelectedEmp(emp)}
            />
          </View>
        </Surface>

        {/* ── TEAM ATTENDANCE WEEKLY BAR CHART CARD ── */}
        <Surface style={[styles.sectionCard, cardShadow]} elevation={1}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Weekly Attendance Trend</Text>
            <TouchableOpacity onPress={() => goTo('/(admin)/attendance')}>
              <Text style={styles.viewAllText}>Details →</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.chartContainer}>
            {/* Y-Axis Labels */}
            <View style={styles.yAxisCol}>
              <Text style={styles.yAxisText}>100%</Text>
              <Text style={styles.yAxisText}>75%</Text>
              <Text style={styles.yAxisText}>50%</Text>
              <Text style={styles.yAxisText}>25%</Text>
              <Text style={styles.yAxisText}>0%</Text>
            </View>

            {/* Bars Area */}
            <View style={styles.barsArea}>
              <View style={[styles.gridLine, { top: '0%' }]} />
              <View style={[styles.gridLine, { top: '25%' }]} />
              <View style={[styles.gridLine, { top: '50%' }]} />
              <View style={[styles.gridLine, { top: '75%' }]} />
              <View style={[styles.gridLine, { top: '100%' }]} />

              <View style={styles.barsFlexRow}>
                {weeklyAttendance.map((item, idx) => (
                  <View key={idx} style={styles.barColItem}>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { height: `${item.val}%` }]} />
                    </View>
                    <Text style={styles.dayLabel}>{item.day}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </Surface>

        {/* ── TEAM MEMBERS ROSTER WITH KM & VISITS METRICS ── */}
        <Surface style={[styles.sectionCard, cardShadow, { marginBottom: 80 }]} elevation={1}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Users size={18} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>Team Members Details ({directoryStaff.length})</Text>
            </View>
            <TouchableOpacity onPress={() => goTo('/(admin)/team')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.memberList}>
            {directoryStaff.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Users size={32} color={COLORS.textMuted} />
                <Text style={styles.emptyTitle}>No Team Members Found</Text>
                <Text style={styles.emptySub}>Employees assigned under your management will appear here.</Text>
              </View>
            ) : (
              [...directoryStaff].sort((a, b) => (b.isTracking ? 1 : 0) - (a.isTracking ? 1 : 0)).map((emp, idx) => {
                const kmVal = (parseFloat(emp.totalDistance) || 0).toFixed(1);
                return (
                  <TouchableOpacity
                    key={emp._id || idx}
                    style={[styles.memberItemRow, idx < directoryStaff.length - 1 && styles.memberBorder]}
                    onPress={() => setSelectedEmp(emp)}
                    activeOpacity={0.7}
                  >
                    <View style={{ position: 'relative' }}>
                      {getAvatarUrl(emp.avatar) ? (
                        <Avatar.Image size={42} source={{ uri: getAvatarUrl(emp.avatar) }} />
                      ) : (
                        <Avatar.Text
                          size={42}
                          label={getUserInitials(emp.name)}
                          style={{ backgroundColor: COLORS.primary }}
                          labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                        />
                      )}
                      <View style={[styles.statusDotOverlay, { backgroundColor: emp.isTracking ? COLORS.success : COLORS.textMuted }]} />
                    </View>

                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.memberName}>{emp.name}</Text>
                      <Text style={styles.memberDept} numberOfLines={1}>
                        {emp.isTracking ? formatAddress(emp.address, 'Active On Field') : formatAddress(emp.department, 'Field Executive')}
                      </Text>

                      {/* Today's Distance & Visits Pill Row */}
                      <View style={styles.memberMetricsRow}>
                        <View style={styles.metricBadgeSmall}>
                          <Route size={10} color={COLORS.primary} />
                          <Text style={styles.metricBadgeText}>{kmVal} KM</Text>
                        </View>
                        <View style={styles.metricBadgeSmall}>
                          <Briefcase size={10} color={COLORS.indigo} />
                          <Text style={styles.metricBadgeText}>{emp.totalMeetings || 0} Visits</Text>
                        </View>
                      </View>
                    </View>

                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <View style={[styles.statusPill, emp.isTracking ? styles.pillPresent : styles.pillOffline]}>
                        <Text style={[styles.statusPillText, emp.isTracking ? styles.textPresent : styles.textOffline]}>
                          {emp.isTracking ? 'Active' : 'Offline'}
                        </Text>
                      </View>
                      <ChevronRight size={16} color={COLORS.textMuted} />
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </Surface>
      </ScrollView>

      {/* ── FIXED ELEVATED BOTTOM TAB BAR FOR MANAGER ── */}
      <View style={styles.bottomTabBarContainer} pointerEvents="box-none">
        <Surface style={styles.bottomTabBarSurface} elevation={16}>
          <TouchableOpacity style={styles.tabBarItem} onPress={() => goTo('/(admin)/dashboard')} activeOpacity={0.7}>
            <View style={[styles.tabBarIconBox, styles.tabBarIconBoxActive]}>
              <LayoutDashboard size={20} color={COLORS.primary} />
            </View>
            <Text style={[styles.tabBarLabel, styles.tabBarLabelActive]}>Home</Text>
            <View style={styles.activeTabDot} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.tabBarItem} onPress={() => goTo('/(admin)/tracking')} activeOpacity={0.7}>
            <View style={styles.tabBarIconBox}>
              <MapPin size={20} color={COLORS.textMuted} />
            </View>
            <Text style={styles.tabBarLabel}>Live Map</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.tabBarItem} onPress={() => goTo('/(admin)/monitoring')} activeOpacity={0.7}>
            <View style={styles.tabBarIconBox}>
              <Users size={20} color={COLORS.textMuted} />
            </View>
            <Text style={styles.tabBarLabel}>Workforce</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.tabBarItem} onPress={() => goTo('/(admin)/reports')} activeOpacity={0.7}>
            <View style={styles.tabBarIconBox}>
              <FileText size={20} color={COLORS.textMuted} />
            </View>
            <Text style={styles.tabBarLabel}>Reports</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.tabBarItem} onPress={() => goTo('/(admin)/settings')} activeOpacity={0.7}>
            <View style={styles.tabBarIconBox}>
              <Settings size={20} color={COLORS.textMuted} />
            </View>
            <Text style={styles.tabBarLabel}>Settings</Text>
          </TouchableOpacity>
        </Surface>
      </View>

      {/* ── SIDE NAVIGATION DRAWER MODAL (Active Across Screens) ── */}
      <Modal visible={sideMenuVisible} transparent animationType="fade" onRequestClose={() => setSideMenuVisible(false)}>
        <View style={styles.drawerOverlay}>
          <TouchableOpacity style={styles.drawerDismissArea} onPress={() => setSideMenuVisible(false)} />
          <View style={styles.drawerContainer}>
            <SafeAreaView style={{ flex: 1 }}>
              {/* Drawer Header with Org Logo & Name */}
              <View style={styles.drawerHeader}>
                <View style={styles.drawerBrandRow}>
                  {orgLogoUrl ? (
                    <Image source={{ uri: orgLogoUrl }} style={styles.drawerLogoImg} resizeMode="contain" />
                  ) : (
                    <View style={styles.drawerLogoFallback}>
                      <Building2 size={18} color="#fff" />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.drawerBrandTitle} numberOfLines={1}>{orgName}</Text>
                    <Text style={styles.drawerBrandSub}>MANAGER CONSOLE</Text>
                  </View>
                </View>

                {/* Manager Profile Info */}
                <View style={styles.drawerUserBox}>
                  {getAvatarUrl(user?.avatar) ? (
                    <Image source={{ uri: getAvatarUrl(user?.avatar) }} style={styles.drawerUserAvatar} />
                  ) : (
                    <View style={styles.drawerUserAvatarFallback}>
                      <Text style={styles.drawerUserAvatarText}>{getUserInitials(user?.name)}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.drawerUserName} numberOfLines={1}>{user?.name || 'Manager'}</Text>
                    <Text style={styles.drawerUserEmail} numberOfLines={1}>{user?.email || ''}</Text>
                  </View>
                </View>
              </View>

              {/* Drawer Menu Items */}
              <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }} showsVerticalScrollIndicator={false}>
                {/* SECTION 1: MY FIELD DUTIES */}
                <Text style={styles.drawerMenuSectionHeader}>MY FIELD DUTIES & OPERATIONS</Text>

                <TouchableOpacity style={[styles.drawerMenuItem, styles.drawerMenuItemActive]} onPress={() => goTo('/(admin)/dashboard')}>
                  <LayoutDashboard size={18} color={COLORS.primary} />
                  <Text style={[styles.drawerMenuText, styles.drawerMenuTextActive]}>Manager Dashboard</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.drawerMenuItem} onPress={() => goTo('/(admin)/visits')}>
                  <Briefcase size={18} color={COLORS.indigo} />
                  <Text style={styles.drawerMenuText}>Meetings & Client Visits</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.drawerMenuItem} onPress={() => goTo('/(employee)/tasks')}>
                  <CheckSquare size={18} color={COLORS.purple} />
                  <Text style={styles.drawerMenuText}>Action Plan & Tasks</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.drawerMenuItem} onPress={() => goTo('/(employee)/leaves')}>
                  <Calendar size={18} color={COLORS.warning} />
                  <Text style={styles.drawerMenuText}>Leave Requests & Apply</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.drawerMenuItem} onPress={() => goTo('/(employee)/expenses')}>
                  <Wallet size={18} color={COLORS.success} />
                  <Text style={styles.drawerMenuText}>My Expense Claims</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.drawerMenuItem} onPress={() => goTo('/(employee)/leads')}>
                  <UserPlus size={18} color={COLORS.primary} />
                  <Text style={styles.drawerMenuText}>Field Leads & Customers</Text>
                </TouchableOpacity>

                {/* SECTION 2: TEAM MANAGEMENT */}
                <Text style={[styles.drawerMenuSectionHeader, { marginTop: 18 }]}>TEAM & STAFF MANAGEMENT</Text>

                <TouchableOpacity style={styles.drawerMenuItem} onPress={() => goTo('/(admin)/team')}>
                  <Shield size={18} color={COLORS.indigo} />
                  <Text style={styles.drawerMenuText}>Team Roster & Staff Data</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.drawerMenuItem} onPress={() => goTo('/(admin)/tracking')}>
                  <Compass size={18} color={COLORS.primary} />
                  <Text style={styles.drawerMenuText}>Live Field Telemetry & Map</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.drawerMenuItem} onPress={() => goTo('/(admin)/monitoring')}>
                  <Users size={18} color={COLORS.textSecondary} />
                  <Text style={styles.drawerMenuText}>Workforce Activity Log</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.drawerMenuItem} onPress={() => goTo('/(admin)/reports')}>
                  <FileText size={18} color={COLORS.purple} />
                  <Text style={styles.drawerMenuText}>Consolidated Reports</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.drawerMenuItem} onPress={() => goTo('/(admin)/attendance')}>
                  <CalendarCheck size={18} color={COLORS.success} />
                  <Text style={styles.drawerMenuText}>Team Attendance</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.drawerMenuItem} onPress={() => goTo('/(admin)/history')}>
                  <Route size={18} color={COLORS.warning} />
                  <Text style={styles.drawerMenuText}>KM Tracking History</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.drawerMenuItem} onPress={() => goTo('/(admin)/settings')}>
                  <Settings size={18} color={COLORS.textSecondary} />
                  <Text style={styles.drawerMenuText}>Organization Settings</Text>
                </TouchableOpacity>

                {/* Logout */}
                <TouchableOpacity style={[styles.drawerMenuItem, { marginTop: 20, backgroundColor: COLORS.dangerLight }]} onPress={handleLogout}>
                  <LogOut size={18} color={COLORS.danger} />
                  <Text style={[styles.drawerMenuText, { color: COLORS.danger }]}>Logout from Account</Text>
                </TouchableOpacity>

                <View style={{ height: 30 }} />
              </ScrollView>
            </SafeAreaView>
          </View>
        </View>
      </Modal>

      {/* ── EMPLOYEE QUICK DETAILS & DISTANCE MODAL ── */}
      <Modal visible={!!selectedEmp} animationType="slide" transparent onRequestClose={() => setSelectedEmp(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedEmp && (
              <>
                <View style={styles.modalHeader}>
                  <View style={styles.modalUserRow}>
                    {getAvatarUrl(selectedEmp.avatar) ? (
                      <Avatar.Image size={48} source={{ uri: getAvatarUrl(selectedEmp.avatar) }} />
                    ) : (
                      <Avatar.Text
                        size={48}
                        label={getUserInitials(selectedEmp.name)}
                        style={{ backgroundColor: COLORS.primary }}
                        labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                      />
                    )}
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={styles.modalUserName}>{selectedEmp.name}</Text>
                      <Text style={styles.modalUserRole}>{selectedEmp.role || 'Field Executive'} • {selectedEmp.department || 'Field'}</Text>
                    </View>
                    <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedEmp(null)}>
                      <X size={20} color={COLORS.textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>

                <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                  {/* Today Total Distance Highlight Box */}
                  <View style={styles.modalKmBox}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalKmLabel}>TODAY'S TOTAL DISTANCE</Text>
                      <Text style={styles.modalKmValue}>
                        {(parseFloat(selectedEmp.totalDistance) || 0).toFixed(1)} <Text style={{ fontSize: 14, fontWeight: '700' }}>KM</Text>
                      </Text>
                    </View>
                    <View style={[styles.modalStatusPill, { backgroundColor: selectedEmp.isTracking ? COLORS.successLight : COLORS.surface }]}>
                      <Text style={[styles.modalStatusText, { color: selectedEmp.isTracking ? COLORS.success : COLORS.textMuted }]}>
                        {selectedEmp.isTracking ? '🟢 TRACKING ACTIVE' : '⚪ NOT PUNCHED IN'}
                      </Text>
                    </View>
                  </View>

                  {/* Info Section */}
                  <View style={styles.infoSection}>
                    <View style={styles.infoRow}>
                      <Phone size={16} color={COLORS.textMuted} />
                      <View style={styles.infoCol}>
                        <Text style={styles.infoLabel}>Phone Number</Text>
                        <Text style={styles.infoVal}>{selectedEmp.phone || 'Not specified'}</Text>
                      </View>
                    </View>

                    <View style={styles.infoRow}>
                      <Mail size={16} color={COLORS.textMuted} />
                      <View style={styles.infoCol}>
                        <Text style={styles.infoLabel}>Email Address</Text>
                        <Text style={styles.infoVal}>{selectedEmp.email || 'Not specified'}</Text>
                      </View>
                    </View>

                    <View style={styles.infoRow}>
                      <MapPin size={16} color={COLORS.primary} />
                      <View style={styles.infoCol}>
                        <Text style={styles.infoLabel}>Last Field Location</Text>
                        <Text style={styles.infoVal}>{selectedEmp.address || 'Active Field Location'}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Quick Action Buttons */}
                  <View style={styles.modalActionRow}>
                    <TouchableOpacity
                      style={[styles.modalActionBtn, { backgroundColor: COLORS.primary }]}
                      onPress={() => {
                        setSelectedEmp(null);
                        goTo('/(admin)/tracking');
                      }}
                    >
                      <Navigation size={16} color="#fff" />
                      <Text style={styles.modalActionBtnText}>Live Track</Text>
                    </TouchableOpacity>

                    {selectedEmp.phone && (
                      <TouchableOpacity
                        style={[styles.modalActionBtn, { backgroundColor: COLORS.success }]}
                        onPress={() => handleCall(selectedEmp.phone)}
                      >
                        <Phone size={16} color="#fff" />
                        <Text style={styles.modalActionBtnText}>Call</Text>
                      </TouchableOpacity>
                    )}

                    {selectedEmp.phone && (
                      <TouchableOpacity
                        style={[styles.modalActionBtn, { backgroundColor: '#25d366' }]}
                        onPress={() => handleWhatsApp(selectedEmp.phone)}
                      >
                        <MessageSquare size={16} color="#fff" />
                        <Text style={styles.modalActionBtnText}>WhatsApp</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontFamily: FONT, fontSize: 13, color: COLORS.primary, marginTop: 10, fontWeight: '700' },

  // Header Gradient (Clean Blue - No Black!)
  headerGradient: {
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingHorizontal: 16,
    paddingBottom: 34,
    paddingTop: Platform.OS === 'android' ? 14 : 10,
  },
  topNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, marginTop: 10 },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  brandBox: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginLeft: 14, marginRight: 8 },
  headerOrgLogoImg: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#fff' },
  headerOrgLogoFallback: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  brandTitle: { color: '#fff', fontSize: 16, fontWeight: '800', fontFamily: FONT },
  brandSub: { color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '600' },
  topNavRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  profileAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  profileAvatarText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  greetingBox: { marginTop: 4 },
  greetingSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontFamily: FONT },
  greetingTitle: { color: '#fff', fontSize: 23, fontWeight: '800', fontFamily: FONT, marginTop: 2 },
  greetingDesc: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 2, fontFamily: FONT },

  body: { paddingHorizontal: 14, maxWidth: 720, width: '100%', alignSelf: 'center' },

  // Manager Punch-In & Field Duty Tracking Card
  trackingCard: {
    borderRadius: 22,
    marginTop: 16,
    marginBottom: 14,
    overflow: 'hidden',
  },
  trackingGradient: {
    padding: 18,
    borderRadius: 22,
  },
  trackingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  trackingBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  trackingBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  roleTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ffffff',
  },
  trackingContentRow: {
    marginBottom: 14,
  },
  trackingMainTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff',
    fontFamily: FONT,
  },
  trackingSubTitle: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 3,
    lineHeight: 16,
    fontFamily: FONT,
  },
  punchBtn: {
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    ...cardShadow,
  },
  punchBtnStartPink: {
    backgroundColor: '#E11D48',
  },
  punchBtnStop: {
    backgroundColor: '#DC2626',
  },
  punchBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  punchBtnText: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: FONT,
  },

  // Floating Team Banner Card
  myTeamCard: { backgroundColor: COLORS.card, borderRadius: 20, marginTop: 4, marginBottom: 14 },
  myTeamInner: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  teamIconBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  myTeamLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: '700' },
  myTeamCount: { fontSize: 18, fontWeight: '800', color: COLORS.text, fontFamily: FONT, marginTop: 1 },
  viewTeamRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  viewTeamText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },

  // Quick Action Buttons Row
  quickGridHeaderTitle: { fontSize: 10, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 0.8, marginBottom: 8, textTransform: 'uppercase' },
  quickActionsGrid: { flexDirection: 'row', gap: 8 },
  actionPill: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...cardShadow,
  },
  actionIconCircle: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  actionPillLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary, fontFamily: FONT },

  // 2x2 Metrics Cards
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  metricCard: { width: (width - 38) / 2, backgroundColor: COLORS.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: COLORS.border },
  metricCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  metricIconBox: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  metricLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: '700', fontFamily: FONT },
  metricVal: { fontSize: 20, fontWeight: '800', color: COLORS.text, fontFamily: FONT, marginTop: 4 },
  percentTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  percentText: { fontSize: 10, fontWeight: '800' },

  // Embedded Map Card
  sectionCard: { backgroundColor: COLORS.card, borderRadius: 20, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: COLORS.border },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: COLORS.text, fontFamily: FONT },
  viewAllText: { fontSize: 12, fontWeight: '700', color: COLORS.primary, fontFamily: FONT },
  embeddedMapWrap: { height: 200, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },

  // Attendance Chart
  chartContainer: { flexDirection: 'row', height: 150, paddingTop: 10 },
  yAxisCol: { width: 36, justifyContent: 'space-between', paddingBottom: 22 },
  yAxisText: { fontSize: 9, color: COLORS.textMuted, textAlign: 'right', fontWeight: '600' },
  barsArea: { flex: 1, marginLeft: 10, position: 'relative' },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: COLORS.border },
  barsFlexRow: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 4 },
  barColItem: { alignItems: 'center', width: 28 },
  barTrack: { width: 14, height: 110, backgroundColor: COLORS.surface, borderRadius: 7, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', backgroundColor: COLORS.primary, borderRadius: 7 },
  dayLabel: { fontSize: 10, color: COLORS.textMuted, marginTop: 8, fontWeight: '600' },

  // Member Roster List
  memberList: { gap: 0 },
  memberItemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  memberBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  statusDotOverlay: { width: 10, height: 10, borderRadius: 5, position: 'absolute', bottom: 0, right: 0, borderWidth: 1.5, borderColor: '#fff' },
  memberName: { fontSize: 14, fontWeight: '800', color: COLORS.text, fontFamily: FONT },
  memberDept: { fontSize: 11, color: COLORS.textMuted, marginTop: 1, fontFamily: FONT },
  memberMetricsRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  metricBadgeSmall: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: COLORS.surface, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  metricBadgeText: { fontSize: 9, fontWeight: '700', color: COLORS.textSecondary, fontFamily: FONT },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  pillPresent: { backgroundColor: COLORS.successLight },
  pillOffline: { backgroundColor: COLORS.surface },
  statusPillText: { fontSize: 10, fontWeight: '800' },
  textPresent: { color: COLORS.success },
  textOffline: { color: COLORS.textMuted },

  emptyWrap: { padding: 24, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: COLORS.textSecondary, marginTop: 8 },
  emptySub: { fontSize: 11, color: COLORS.textMuted, marginTop: 4, textAlign: 'center' },

  // Bottom Tab Bar
  bottomTabBarContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 999 },
  bottomTabBarSurface: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 54 : 50,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(15, 23, 42, 0.08)',
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 16,
  },
  tabBarItem: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  tabBarIconBox: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  tabBarIconBoxActive: { backgroundColor: COLORS.primaryMuted },
  tabBarLabel: { fontSize: 10, fontWeight: '600', color: COLORS.textMuted, marginTop: 2 },
  tabBarLabelActive: { color: COLORS.primary, fontWeight: '800' },
  activeTabDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.primary, marginTop: 2 },

  // Side Drawer Modal
  drawerOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', flexDirection: 'row' },
  drawerDismissArea: { flex: 1 },
  drawerContainer: { width: width * 0.82, backgroundColor: '#ffffff', height: '100%', borderTopRightRadius: 28, borderBottomRightRadius: 28 },
  drawerHeader: { padding: 20, backgroundColor: COLORS.primaryMuted, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  drawerBrandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  drawerLogoImg: { width: 36, height: 36, borderRadius: 10 },
  drawerLogoFallback: { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  drawerBrandTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text, fontFamily: FONT },
  drawerBrandSub: { fontSize: 10, fontWeight: '700', color: COLORS.primary, letterSpacing: 0.5 },
  drawerUserBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#ffffff', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border },
  drawerUserAvatar: { width: 40, height: 40, borderRadius: 20 },
  drawerUserAvatarFallback: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  drawerUserAvatarText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  drawerUserName: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  drawerUserEmail: { fontSize: 11, color: COLORS.textMuted },
  drawerMenuSectionHeader: { fontSize: 10, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 0.8, marginBottom: 12, textTransform: 'uppercase' },
  drawerMenuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 14, borderRadius: 12, marginBottom: 6 },
  drawerMenuItemActive: { backgroundColor: COLORS.primaryMuted },
  drawerMenuText: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, fontFamily: FONT },
  drawerMenuTextActive: { color: COLORS.primary, fontWeight: '800' },

  // Employee Detail Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '82%' },
  modalHeader: { marginBottom: 14 },
  modalUserRow: { flexDirection: 'row', alignItems: 'center' },
  modalUserName: { fontSize: 16, fontWeight: '800', color: COLORS.text, fontFamily: FONT },
  modalUserRole: { fontSize: 11, color: COLORS.textMuted, marginTop: 2, fontFamily: FONT },
  closeBtn: { padding: 6, borderRadius: 8, backgroundColor: COLORS.surface },
  modalBody: { paddingVertical: 4 },

  modalKmBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.successLight,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.successBorder,
    marginBottom: 16,
  },
  modalKmLabel: { fontSize: 9, fontWeight: '800', color: COLORS.success, letterSpacing: 0.5 },
  modalKmValue: { fontSize: 22, fontWeight: '900', color: COLORS.success, marginTop: 2 },
  modalStatusPill: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border },
  modalStatusText: { fontSize: 9, fontWeight: '800' },

  infoSection: { gap: 14, marginBottom: 20 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoCol: { flex: 1 },
  infoLabel: { fontSize: 10, color: COLORS.textMuted, fontWeight: '800', textTransform: 'uppercase' },
  infoVal: { fontSize: 13, color: COLORS.text, fontWeight: '700', marginTop: 1 },
  modalActionRow: { flexDirection: 'row', gap: 10, marginTop: 10, marginBottom: 10 },
  modalActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, gap: 6 },
  modalActionBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
});
