import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, View, ScrollView, TouchableOpacity,
  ActivityIndicator, Platform, RefreshControl, StatusBar, Dimensions, Modal, Linking, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Surface } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Menu, Bell, MapPin, Users, UserCheck, Navigation, Clock,
  ClipboardList, UserMinus, ChevronRight, Phone, Mail, Briefcase,
  DollarSign, X, MessageSquare, ShieldCheck, ArrowRight
} from 'lucide-react-native';
import { adminAPI, trackingAPI, getAvatarUrl } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');
const FONT = Platform.OS === 'ios' ? 'System' : 'sans-serif-medium';

const NAVY_DARK = '#0f172a';
const NAVY_MID = '#1e293b';
const BLUE_ACCENT = '#2563eb';
const BG_COLOR = '#f8fafc';

const cardShadow = Platform.OS === 'web'
  ? { boxShadow: '0px 6px 20px rgba(15, 23, 42, 0.06)' }
  : { elevation: 3, shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } };

export default function ManagerDashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [teamMembers, setTeamMembers] = useState([]);
  const [liveLocations, setLiveLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [empRes, locRes] = await Promise.all([
        adminAPI.getEmployees({ limit: 200 }).catch(() => ({ data: { success: false } })),
        trackingAPI.getLiveLocations().catch(() => ({ data: { success: false } })),
      ]);

      if (empRes.data?.success) {
        setTeamMembers(empRes.data.employees || empRes.data.data || []);
      }
      if (locRes.data?.success) {
        setLiveLocations(locRes.data.locations || locRes.data.data || []);
      }
    } catch (e) {
      console.log('Manager dashboard fetch error:', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  // Real Dynamic Metrics
  const totalTeam = teamMembers.length;
  const activeLive = liveLocations.length;
  const presentCount = teamMembers.filter(m =>
    m.isOnline || m.isTracking || liveLocations.some(l => (l.employeeId || l.employee || l._id) === m._id)
  ).length;

  const pendingTasks = 0;
  const leaveCount = 0;

  const presentPercent = totalTeam > 0 ? Math.round((presentCount / totalTeam) * 100) : 0;
  const livePercent = totalTeam > 0 ? Math.round((activeLive / totalTeam) * 100) : 0;

  const weeklyAttendance = [
    { day: 'Mon', val: 70 },
    { day: 'Tue', val: 85 },
    { day: 'Wed', val: 65 },
    { day: 'Thu', val: 90 },
    { day: 'Fri', val: 75 },
    { day: 'Sat', val: 60 },
    { day: 'Sun', val: 80 },
  ];

  const goTo = (path) => router.push(path);

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
      <View style={[styles.center, { backgroundColor: BG_COLOR }]}>
        <ActivityIndicator size="large" color={BLUE_ACCENT} />
        <Text style={styles.loadingText}>Loading Console…</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY_DARK} />

      {/* TOP HEADER SECTION */}
      <LinearGradient colors={[NAVY_DARK, NAVY_MID]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerGradient}>
        <SafeAreaView edges={['top']}>
          {/* Top Navigation Row */}
          <View style={styles.topNavRow}>
            <TouchableOpacity style={styles.iconBtn}>
              <Menu size={22} color="#fff" />
            </TouchableOpacity>

            <View style={styles.brandBox}>
              <View style={styles.logoBadge}>
                <MapPin size={14} color="#10b981" />
              </View>
              <View>
                <Text style={styles.brandTitle}>KisanConnect</Text>
                <Text style={styles.brandSub}>Team Lead Dashboard</Text>
              </View>
            </View>

            <View style={styles.topNavRight}>
              <TouchableOpacity style={styles.iconBtn}>
                <View style={styles.bellWrap}>
                  <Bell size={20} color="#fff" />
                </View>
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
            <Text style={styles.greetingDesc}>Team performance overview</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        style={{ backgroundColor: BG_COLOR }}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BLUE_ACCENT} colors={[BLUE_ACCENT]} />}
      >
        {/* MY TEAM FLOATING CARD */}
        <Surface style={[styles.myTeamCard, cardShadow]} elevation={2}>
          <TouchableOpacity style={styles.myTeamInner} onPress={() => goTo('/(admin)/team')} activeOpacity={0.85}>
            <View style={styles.teamIconBox}>
              <Users size={22} color="#fff" />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.myTeamLabel}>My Team</Text>
              <Text style={styles.myTeamCount}>{totalTeam} Employees</Text>
              <View style={styles.viewTeamRow}>
                <Text style={styles.viewTeamText}>View Team</Text>
                <ArrowRight size={14} color={BLUE_ACCENT} style={{ marginLeft: 4 }} />
              </View>
            </View>
            <ChevronRight size={20} color="#94a3b8" />
          </TouchableOpacity>
        </Surface>

        {/* 2X2 METRICS CARDS GRID */}
        <View style={styles.metricsGrid}>
          {/* Present Today */}
          <Surface style={[styles.metricCard, cardShadow]} elevation={1}>
            <View style={styles.metricCardTop}>
              <View style={[styles.metricIconBox, { backgroundColor: '#dcfce7' }]}>
                <UserCheck size={18} color="#16a34a" />
              </View>
            </View>
            <Text style={styles.metricLabel}>Present Today</Text>
            <View style={styles.metricValRow}>
              <Text style={styles.metricVal}>{presentCount}</Text>
              <View style={[styles.percentTag, { backgroundColor: '#f0fdf4' }]}>
                <Text style={[styles.percentText, { color: '#16a34a' }]}>{presentPercent}%</Text>
              </View>
            </View>
          </Surface>

          {/* On Field */}
          <Surface style={[styles.metricCard, cardShadow]} elevation={1}>
            <View style={styles.metricCardTop}>
              <View style={[styles.metricIconBox, { backgroundColor: '#e0f2fe' }]}>
                <Navigation size={18} color="#0284c7" />
              </View>
            </View>
            <Text style={styles.metricLabel}>On Field</Text>
            <View style={styles.metricValRow}>
              <Text style={styles.metricVal}>{activeLive}</Text>
              <View style={[styles.percentTag, { backgroundColor: '#f0f9ff' }]}>
                <Text style={[styles.percentText, { color: '#0284c7' }]}>{livePercent}%</Text>
              </View>
            </View>
          </Surface>

          {/* Tasks Pending */}
          <Surface style={[styles.metricCard, cardShadow]} elevation={1}>
            <View style={styles.metricCardTop}>
              <View style={[styles.metricIconBox, { backgroundColor: '#fef3c7' }]}>
                <ClipboardList size={18} color="#d97706" />
              </View>
            </View>
            <Text style={styles.metricLabel}>Tasks Pending</Text>
            <Text style={styles.metricVal}>{pendingTasks}</Text>
          </Surface>

          {/* Leave Today */}
          <Surface style={[styles.metricCard, cardShadow]} elevation={1}>
            <View style={styles.metricCardTop}>
              <View style={[styles.metricIconBox, { backgroundColor: '#f3e8ff' }]}>
                <UserMinus size={18} color="#9333ea" />
              </View>
            </View>
            <Text style={styles.metricLabel}>Leave Today</Text>
            <Text style={styles.metricVal}>{leaveCount}</Text>
          </Surface>
        </View>

        {/* TEAM ATTENDANCE WEEKLY BAR CHART CARD */}
        <Surface style={[styles.sectionCard, cardShadow]} elevation={1}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Team Attendance</Text>
            <TouchableOpacity onPress={() => goTo('/(admin)/attendance')}>
              <Text style={styles.viewAllText}>View All</Text>
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

        {/* TEAM MEMBERS ROSTER LIST */}
        <Surface style={[styles.sectionCard, cardShadow, { marginBottom: 30 }]} elevation={1}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Team Members ({teamMembers.length})</Text>
            <TouchableOpacity onPress={() => goTo('/(admin)/team')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.memberList}>
            {teamMembers.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Users size={32} color="#94a3b8" />
                <Text style={styles.emptyTitle}>No Team Members Found</Text>
                <Text style={styles.emptySub}>Employees assigned under your management will appear here.</Text>
              </View>
            ) : (
              [...teamMembers].sort((a, b) => {
                const aLive = a.isTracking || a.isOnline || liveLocations.some(l => (l.employeeId || l.employee || l._id) === a._id);
                const bLive = b.isTracking || b.isOnline || liveLocations.some(l => (l.employeeId || l.employee || l._id) === b._id);
                if (aLive && !bLive) return -1;
                if (!aLive && bLive) return 1;
                return 0;
              }).map((emp, idx) => {
                const isOnline = emp.isOnline || emp.isTracking || liveLocations.some(l => (l.employeeId || l.employee || l._id) === emp._id);
                return (
                  <TouchableOpacity
                    key={emp._id || idx}
                    style={[styles.memberItemRow, idx < teamMembers.length - 1 && styles.memberBorder]}
                    onPress={() => setSelectedEmp(emp)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.memberAvatarCircle}>
                      <Text style={styles.memberAvatarText}>{getUserInitials(emp.name)}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.memberName}>{emp.name}</Text>
                      <Text style={styles.memberDept}>{emp.department || emp.role || 'Field Executive'}</Text>
                    </View>

                    <View style={[styles.statusPill, isOnline ? styles.pillPresent : styles.pillOffline]}>
                      <View style={[styles.statusDot, isOnline ? styles.dotPresent : styles.dotOffline]} />
                      <Text style={[styles.statusPillText, isOnline ? styles.textPresent : styles.textOffline]}>
                        {isOnline ? 'Online' : 'Offline'}
                      </Text>
                    </View>
                    <ChevronRight size={18} color="#94a3b8" style={{ marginLeft: 6 }} />
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </Surface>
      </ScrollView>

      {/* EMPLOYEE QUICK DETAILS & TRACKING MODAL */}
      <Modal visible={!!selectedEmp} animationType="slide" transparent onRequestClose={() => setSelectedEmp(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedEmp && (
              <>
                <View style={styles.modalHeader}>
                  <View style={styles.modalUserRow}>
                    <View style={styles.modalAvatarCircle}>
                      <Text style={styles.modalAvatarText}>{getUserInitials(selectedEmp.name)}</Text>
                    </View>
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={styles.modalUserName}>{selectedEmp.name}</Text>
                      <Text style={styles.modalUserRole}>{selectedEmp.role || 'Field Executive'} • {selectedEmp.department || 'Field'}</Text>
                    </View>
                    <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedEmp(null)}>
                      <X size={20} color="#64748b" />
                    </TouchableOpacity>
                  </View>
                </View>

                <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                  {/* Status Banner */}
                  <View style={styles.detailBanner}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={[styles.bannerLiveDot, { backgroundColor: (selectedEmp.isOnline || selectedEmp.isTracking) ? '#10b981' : '#94a3b8' }]} />
                      <Text style={styles.bannerStatusText}>STATUS: {(selectedEmp.isOnline || selectedEmp.isTracking) ? 'ONLINE' : 'OFFLINE'}</Text>
                    </View>
                    <Text style={styles.bannerShiftText}>Shift: {selectedEmp.shift || '09:00 AM - 06:00 PM'}</Text>
                  </View>

                  {/* Info Cards Grid */}
                  <View style={styles.infoSection}>
                    <View style={styles.infoRow}>
                      <Phone size={16} color="#64748b" />
                      <View style={styles.infoCol}>
                        <Text style={styles.infoLabel}>Phone Number</Text>
                        <Text style={styles.infoVal}>{selectedEmp.phone || 'Not specified'}</Text>
                      </View>
                    </View>

                    <View style={styles.infoRow}>
                      <Mail size={16} color="#64748b" />
                      <View style={styles.infoCol}>
                        <Text style={styles.infoLabel}>Email Address</Text>
                        <Text style={styles.infoVal}>{selectedEmp.email || 'Not specified'}</Text>
                      </View>
                    </View>

                    <View style={styles.infoRow}>
                      <MapPin size={16} color="#64748b" />
                      <View style={styles.infoCol}>
                        <Text style={styles.infoLabel}>Last Known Location</Text>
                        <Text style={styles.infoVal}>{selectedEmp.lastLocation || selectedEmp.address || 'Active Field Location'}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Quick Action Buttons */}
                  <View style={styles.modalActionRow}>
                    <TouchableOpacity
                      style={[styles.modalActionBtn, { backgroundColor: '#10b981' }]}
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
                        style={[styles.modalActionBtn, { backgroundColor: BLUE_ACCENT }]}
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
  root: { flex: 1, backgroundColor: BG_COLOR },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontFamily: FONT, fontSize: 13, color: BLUE_ACCENT, marginTop: 10, fontWeight: '600' },

  headerGradient: { borderBottomLeftRadius: 28, borderBottomRightRadius: 28, paddingHorizontal: 16, paddingBottom: 34, paddingTop: Platform.OS === 'android' ? 10 : 0 },
  topNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  iconBtn: { padding: 4 },
  brandBox: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  brandTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', fontFamily: FONT },
  brandSub: { color: '#94a3b8', fontSize: 9, fontWeight: '500' },
  topNavRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bellWrap: { position: 'relative' },
  profileAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#334155', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)' },
  profileAvatarText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },

  greetingBox: { marginTop: 4 },
  greetingSub: { color: '#94a3b8', fontSize: 12 },
  greetingTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', fontFamily: FONT, marginTop: 2 },
  greetingDesc: { color: '#cbd5e1', fontSize: 11, marginTop: 2 },

  body: { paddingHorizontal: 14, maxWidth: 720, width: '100%', alignSelf: 'center' },

  myTeamCard: { backgroundColor: '#fff', borderRadius: 20, marginTop: -22, marginBottom: 14 },
  myTeamInner: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  teamIconBox: { width: 44, height: 44, borderRadius: 22, backgroundColor: NAVY_DARK, alignItems: 'center', justifyContent: 'center' },
  myTeamLabel: { fontSize: 11, color: '#64748b', fontWeight: 'bold' },
  myTeamCount: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', fontFamily: FONT, marginTop: 1 },
  viewTeamRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  viewTeamText: { fontSize: 11, fontWeight: 'bold', color: BLUE_ACCENT },

  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 14 },
  metricCard: { width: (width - 40) / 2, backgroundColor: '#fff', borderRadius: 18, padding: 14 },
  metricCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  metricIconBox: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  metricLabel: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  metricValRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 4 },
  metricVal: { fontSize: 22, fontWeight: 'bold', color: '#0f172a', fontFamily: FONT, marginTop: 4 },
  percentTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  percentText: { fontSize: 10, fontWeight: 'bold' },

  sectionCard: { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 14 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#0f172a', fontFamily: FONT },
  viewAllText: { fontSize: 12, fontWeight: 'bold', color: BLUE_ACCENT },

  chartContainer: { flexDirection: 'row', height: 160, paddingTop: 10 },
  yAxisCol: { width: 36, justifyContent: 'space-between', paddingBottom: 22 },
  yAxisText: { fontSize: 9, color: '#94a3b8', textAlign: 'right' },
  barsArea: { flex: 1, marginLeft: 10, position: 'relative' },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#f1f5f9' },
  barsFlexRow: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 4 },
  barColItem: { alignItems: 'center', width: 28 },
  barTrack: { width: 14, height: 120, backgroundColor: '#f1f5f9', borderRadius: 7, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', backgroundColor: NAVY_DARK, borderRadius: 7 },
  dayLabel: { fontSize: 10, color: '#64748b', marginTop: 8, fontWeight: '500' },

  memberList: { gap: 0 },
  memberItemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  memberBorder: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  memberAvatarCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  memberAvatarText: { color: '#334155', fontWeight: 'bold', fontSize: 14 },
  memberName: { fontSize: 14, fontWeight: 'bold', color: '#0f172a', fontFamily: FONT },
  memberDept: { fontSize: 11, color: '#64748b', marginTop: 1 },
  statusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 4 },
  pillPresent: { backgroundColor: '#dcfce7' },
  pillOffline: { backgroundColor: '#f1f5f9' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  dotPresent: { backgroundColor: '#16a34a' },
  dotOffline: { backgroundColor: '#64748b' },
  statusPillText: { fontSize: 10, fontWeight: 'bold' },
  textPresent: { color: '#16a34a' },
  textOffline: { color: '#64748b' },

  emptyWrap: { padding: 24, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 14, fontWeight: 'bold', color: '#475569', marginTop: 8 },
  emptySub: { fontSize: 11, color: '#94a3b8', marginTop: 4, textAlign: 'center' },

  // MODAL STYLES
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' },
  modalHeader: { marginBottom: 14 },
  modalUserRow: { flexDirection: 'row', alignItems: 'center' },
  modalAvatarCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: NAVY_DARK, alignItems: 'center', justifyContent: 'center' },
  modalAvatarText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  modalUserName: { fontSize: 17, fontWeight: 'bold', color: '#0f172a', fontFamily: FONT },
  modalUserRole: { fontSize: 12, color: '#64748b', marginTop: 2 },
  closeBtn: { padding: 6 },
  modalBody: { paddingVertical: 4 },
  detailBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  bannerLiveDot: { width: 8, height: 8, borderRadius: 4 },
  bannerStatusText: { fontSize: 11, fontWeight: 'bold', color: '#0f172a' },
  bannerShiftText: { fontSize: 11, color: '#64748b' },
  infoSection: { gap: 14, marginBottom: 20 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoCol: { flex: 1 },
  infoLabel: { fontSize: 10, color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase' },
  infoVal: { fontSize: 13, color: '#0f172a', fontWeight: '600', marginTop: 1 },
  modalActionRow: { flexDirection: 'row', gap: 10, marginTop: 10, marginBottom: 10 },
  modalActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, gap: 6 },
  modalActionBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
});
