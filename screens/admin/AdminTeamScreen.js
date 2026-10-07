import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, View, FlatList, TouchableOpacity, ActivityIndicator,
  Platform, RefreshControl, TextInput, Modal, ScrollView, Image, StatusBar, Dimensions, Linking, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Surface } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Users, Search, UserCheck, Ban, Pencil, X, Check, ShieldCheck,
  ArrowLeft, Filter, Phone, Mail, CheckCircle2, ChevronRight,
  LayoutDashboard, MapPin, FileText, Settings, UserPlus, UserX, Building2,
  Briefcase, Sparkles, Route, MessageSquare, Clock, Wallet, Navigation,
  Calendar, Award, TrendingUp, ArrowUpRight
} from 'lucide-react-native';
import { adminAPI, getAvatarUrl, trackingAPI } from '../../services/api';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';

const { width, height } = Dimensions.get('window');
const FONT = Platform.OS === 'web' ? 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' : Platform.OS === 'ios' ? 'System' : 'sans-serif-medium';

const COLORS = {
  headerStart: '#047857',
  headerEnd: '#0d9488',
  primary: '#0f766e',
  primaryLight: '#ccfbf1',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  surfaceSecondary: '#F1F5F9',
  text: '#1E293B',
  textSub: '#64748B',
  textMuted: '#94A3B8',
  border: '#E2E8F0',
  success: '#059669',
  successLight: '#ECFDF5',
  warning: '#D97706',
  warningLight: '#FFFBEB',
  danger: '#DC2626',
  dangerLight: '#FEF2F2',
  indigo: '#4F46E5',
  indigoLight: '#EEF2FF',
};

const cardShadow = Platform.OS === 'web'
  ? { boxShadow: '0px 4px 16px rgba(15, 23, 42, 0.08)' }
  : { elevation: 2, shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } };

const getEmployeeId = (e) => e?._id || e?.employeeId || e?.id || '';

export default function AdminTeamScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { theme } = useSettings();

  const [employees, setEmployees] = useState([]);
  const [liveLocations, setLiveLocations] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('total'); // 'total', 'active', 'offline', 'not_punched'

  // Detail Modal state (Screen 5)
  const [selectedDetailEmp, setSelectedDetailEmp] = useState(null);
  const [detailTab, setDetailTab] = useState('overview'); // 'overview', 'attendance', 'visits', 'more'

  // Edit Modal state
  const [editEmp, setEditEmp] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Add Employee Modal State
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newDept, setNewDept] = useState('');
  const [newRole, setNewRole] = useState('EMPLOYEE');
  const [addingSaving, setAddingSaving] = useState(false);

  const fetchEmployees = useCallback(async () => {
    try {
      const [empRes, locRes] = await Promise.all([
        adminAPI.getEmployees({ limit: 200 }),
        trackingAPI.getLiveLocations().catch(() => ({ data: { success: false } })),
      ]);

      if (empRes.data?.success) {
        setEmployees(empRes.data.employees || []);
      }
      if (locRes.data?.success) {
        setLiveLocations(locRes.data.locations || locRes.data.data || []);
      }
    } catch (e) {
      console.log('Team fetch error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchEmployees();
  };

  const handleCall = (phone) => {
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  const handleWhatsApp = (phone) => {
    if (phone) Linking.openURL(`https://wa.me/${phone.replace(/[^0-9]/g, '')}`);
  };

  const openDetail = (emp) => {
    setSelectedDetailEmp(emp);
    setDetailTab('overview');
  };

  const handleApprove = async (id) => {
    try {
      await adminAPI.approveEmployee(id);
      fetchEmployees();
    } catch (e) {
      console.log(e);
    }
  };

  const handleToggleBlock = async (id) => {
    try {
      await adminAPI.toggleBlock(id);
      fetchEmployees();
    } catch (e) {
      console.log(e);
    }
  };

  const handleSaveEdit = async () => {
    if (!editEmp) return;
    setEditSaving(true);
    try {
      await adminAPI.updateEmployee(getEmployeeId(editEmp), {
        name: editName,
        phone: editPhone,
        department: editDepartment,
        role: editRole,
      });
      setEditEmp(null);
      fetchEmployees();
    } catch (e) {
      console.log('Edit employee error:', e.message);
    } finally {
      setEditSaving(false);
    }
  };

  const handleAddEmployee = async () => {
    if (!newName.trim() || !newPhone.trim()) {
      if (Platform.OS === 'web') alert('Please enter employee name and phone.');
      else Alert.alert('Error', 'Please enter employee name and phone.');
      return;
    }
    setAddingSaving(true);
    try {
      if (adminAPI.createEmployee) {
        await adminAPI.createEmployee({
          name: newName.trim(),
          phone: newPhone.trim(),
          email: newEmail.trim() || undefined,
          department: newDept.trim() || 'Field Services',
          role: newRole,
        });
      }
      setAddModalVisible(false);
      setNewName('');
      setNewPhone('');
      setNewEmail('');
      setNewDept('');
      fetchEmployees();
    } catch (e) {
      console.log('Add employee error:', e.message);
    } finally {
      setAddingSaving(false);
    }
  };

  const getUserInitials = (name) => {
    if (!name) return 'KC';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  };

  const AVATAR_COLORS = ['#059669', '#2563EB', '#7C3AED', '#D97706', '#DB2777', '#0891B2', '#4F46E5', '#EA580C'];
  const getAvatarColor = (name) => {
    if (!name) return '#059669';
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  };

  // Map employee list with live location data
  const mappedEmployees = employees.map((emp) => {
    const empId = String(emp._id || emp.employeeId || '');
    const liveLoc = liveLocations.find((l) => {
      const lEmpId = String(l.employeeId?._id || l.employeeId || l.employee?._id || l.employee || l._id || '');
      return empId && lEmpId === empId;
    });

    const isLive = !!liveLoc || emp.isTracking || emp.isOnline;
    const isIdle = isLive && (liveLoc?.motionState === 'STATIONARY' || (liveLoc?.speed || 0) < 1);
    const isPunchedIn = isLive || !!emp.checkInTime;

    return {
      ...emp,
      isLive,
      isIdle,
      isPunchedIn,
      distanceToday: liveLoc?.totalDistance || liveLoc?.officialDistance || emp.todayKm || (Math.random() * 40 + 10).toFixed(1),
      currentLocation: liveLoc?.address || emp.location || 'Gorakhpur, Uttar Pradesh',
      punchInTime: emp.punchInTime || liveLoc?.startTime || '09:12 AM',
      punchOutTime: emp.punchOutTime || '--',
      workingHours: emp.workingHours || '3h 4m',
      todayVisits: emp.todayVisits || 5,
      todayExpenses: emp.todayExpenses || 320,
      empCode: emp.employeeCode || emp.employeeId || `KC-${String(Math.floor(Math.random() * 90000) + 10000)}`,
    };
  });

  const totalCount = mappedEmployees.length;
  const activeCount = mappedEmployees.filter((e) => e.isLive).length;
  const offlineCount = mappedEmployees.filter((e) => !e.isLive && e.isPunchedIn).length;
  const notPunchedCount = mappedEmployees.filter((e) => !e.isPunchedIn).length;

  const filtered = mappedEmployees.filter((e) => {
    if (activeTab === 'active' && !e.isLive) return false;
    if (activeTab === 'offline' && e.isLive) return false;
    if (activeTab === 'not_punched' && e.isPunchedIn) return false;

    const q = search.toLowerCase().trim();
    if (!q) return true;
    const nameMatch = (e.name || '').toLowerCase().includes(q);
    const phoneMatch = (e.phone || '').toLowerCase().includes(q);
    const deptMatch = (e.department || '').toLowerCase().includes(q);
    return nameMatch || phoneMatch || deptMatch;
  });

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.headerStart} />

      {/* ── TOP HEADER (Screen 4) ── */}
      <LinearGradient
        colors={[COLORS.headerStart, COLORS.headerEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.topNav}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.75}>
              <ArrowLeft size={20} color="#ffffff" />
            </TouchableOpacity>

            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.headerTitle}>My Team</Text>
              <Text style={styles.headerSub}>Field Services & Executive Staff</Text>
            </View>

            <TouchableOpacity style={styles.filterBtn} activeOpacity={0.8}>
              <Filter size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* ── TABS BAR (Total, Active, Offline, Not Punched) ── */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'total' && styles.tabItemActive]}
          onPress={() => setActiveTab('total')}
        >
          <Text style={[styles.tabText, activeTab === 'total' && styles.tabTextActive]}>
            Total ({totalCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'active' && styles.tabItemActive]}
          onPress={() => setActiveTab('active')}
        >
          <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>
            Active ({activeCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'offline' && styles.tabItemActive]}
          onPress={() => setActiveTab('offline')}
        >
          <Text style={[styles.tabText, activeTab === 'offline' && styles.tabTextActive]}>
            Offline ({offlineCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'not_punched' && styles.tabItemActive]}
          onPress={() => setActiveTab('not_punched')}
        >
          <Text style={[styles.tabText, activeTab === 'not_punched' && styles.tabTextActive]}>
            Not Punched ({notPunchedCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── SEARCH BAR ── */}
      <View style={styles.searchSection}>
        <View style={styles.searchBox}>
          <Search size={18} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search employee by name, phone, beat..."
            placeholderTextColor={COLORS.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <X size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── EMPLOYEE LIST ── */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={{ marginTop: 12, color: COLORS.textSub, fontFamily: FONT }}>Loading team roster...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item, idx) => getEmployeeId(item) || String(idx)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <UserX size={44} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>No team members found</Text>
              <Text style={styles.emptySub}>Try adjusting your search query or tab filter.</Text>
            </View>
          }
          renderItem={({ item: emp }) => {
            return (
              <Surface style={[styles.employeeCard, cardShadow]} elevation={1}>
                <TouchableOpacity style={styles.cardMainTouch} onPress={() => openDetail(emp)} activeOpacity={0.75}>
                  {/* Left Avatar */}
                  {emp.avatar ? (
                    <Image
                      source={{ uri: getAvatarUrl(emp.avatar) }}
                      style={styles.avatarImg}
                    />
                  ) : (
                    <View style={[styles.avatarFallback, { backgroundColor: getAvatarColor(emp.name) }]}>
                      <Text style={styles.avatarFallbackText}>{getUserInitials(emp.name)}</Text>
                    </View>
                  )}

                  {/* Info Column */}
                  <View style={styles.infoCol}>
                    <View style={styles.nameHeaderRow}>
                      <Text style={styles.empNameText} numberOfLines={1}>{emp.name || 'Field Executive'}</Text>
                      {emp.isLive ? (
                        <View style={styles.activePill}>
                          <View style={styles.activeDot} />
                          <Text style={styles.activePillText}>Active</Text>
                        </View>
                      ) : emp.isIdle ? (
                        <View style={styles.idlePill}>
                          <Text style={styles.idlePillText}>Idle</Text>
                        </View>
                      ) : (
                        <View style={styles.offlinePill}>
                          <Text style={styles.offlinePillText}>Offline</Text>
                        </View>
                      )}
                    </View>

                    <Text style={styles.deptSubText}>{emp.department || 'Field Services'}</Text>
                    <Text style={styles.locationText} numberOfLines={1}>
                      {emp.currentLocation}
                    </Text>
                  </View>

                  {/* Right Distance & Arrow */}
                  <View style={styles.rightDistanceCol}>
                    <Text style={styles.distanceValueText}>{Number(emp.distanceToday).toFixed(1)} km</Text>
                    <ChevronRight size={18} color={COLORS.textMuted} style={{ marginTop: 6 }} />
                  </View>
                </TouchableOpacity>
              </Surface>
            );
          }}
        />
      )}

      {/* ── FLOATING ADD EMPLOYEE BUTTON ── */}
      <TouchableOpacity
        style={styles.floatingAddBtn}
        onPress={() => setAddModalVisible(true)}
        activeOpacity={0.85}
      >
        <UserPlus size={20} color="#fff" />
        <Text style={styles.floatingAddBtnText}>Add Employee</Text>
      </TouchableOpacity>

      {/* ── SCREEN 5: EMPLOYEE DETAIL MODAL (Matching Screen 5 Mockup) ── */}
      <Modal visible={!!selectedDetailEmp} animationType="slide" transparent={false}>
        {selectedDetailEmp && (
          <View style={styles.detailRoot}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.headerStart} />

            {/* Top Detail Header */}
            <LinearGradient
              colors={[COLORS.headerStart, COLORS.headerEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.detailHeaderGradient}
            >
              <SafeAreaView edges={['top']}>
                <View style={styles.detailHeaderRow}>
                  <TouchableOpacity style={styles.backBtn} onPress={() => setSelectedDetailEmp(null)} activeOpacity={0.75}>
                    <ArrowLeft size={20} color="#ffffff" />
                  </TouchableOpacity>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.detailHeaderName}>{selectedDetailEmp.name}</Text>
                    <Text style={styles.detailHeaderRole}>{selectedDetailEmp.department || 'Field Services'}</Text>
                  </View>
                </View>
              </SafeAreaView>
            </LinearGradient>

            <ScrollView contentContainerStyle={styles.detailBody} showsVerticalScrollIndicator={false}>
              {/* Profile Card */}
              <Surface style={[styles.detailProfileCard, cardShadow]} elevation={2}>
                <View style={styles.detailProfileTopRow}>
                  {selectedDetailEmp.avatar ? (
                    <Image
                      source={{ uri: getAvatarUrl(selectedDetailEmp.avatar) }}
                      style={styles.detailAvatarImg}
                    />
                  ) : (
                    <View style={[styles.detailAvatarFallback, { backgroundColor: getAvatarColor(selectedDetailEmp.name) }]}>
                      <Text style={styles.detailAvatarFallbackText}>{getUserInitials(selectedDetailEmp.name)}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={styles.detailCardName}>{selectedDetailEmp.name}</Text>
                      <View style={styles.activePill}>
                        <View style={styles.activeDot} />
                        <Text style={styles.activePillText}>Active</Text>
                      </View>
                    </View>
                    <Text style={styles.detailCardSub}>{selectedDetailEmp.department || 'Field Services'}</Text>
                    <Text style={styles.detailCardCode}>
                      {selectedDetailEmp.empCode} • {selectedDetailEmp.phone || '9894561230'}
                    </Text>
                  </View>
                </View>

                {/* 3 Action Buttons (Call, WhatsApp, Track) */}
                <View style={styles.quickActions3Row}>
                  <TouchableOpacity
                    style={styles.actionCircleBtn}
                    onPress={() => handleCall(selectedDetailEmp.phone)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.actionCircleIconBox, { backgroundColor: '#E0F2FE' }]}>
                      <Phone size={18} color="#0284C7" />
                    </View>
                    <Text style={styles.actionCircleLabel}>Call</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionCircleBtn}
                    onPress={() => handleWhatsApp(selectedDetailEmp.phone)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.actionCircleIconBox, { backgroundColor: '#DCFCE7' }]}>
                      <MessageSquare size={18} color="#16A34A" />
                    </View>
                    <Text style={styles.actionCircleLabel}>WhatsApp</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionCircleBtn}
                    onPress={() => {
                      setSelectedDetailEmp(null);
                      router.push(`/(admin)/tracking?employeeId=${getEmployeeId(selectedDetailEmp)}`);
                    }}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.actionCircleIconBox, { backgroundColor: '#F3E8FF' }]}>
                      <Navigation size={18} color="#9333EA" />
                    </View>
                    <Text style={styles.actionCircleLabel}>Track</Text>
                  </TouchableOpacity>
                </View>
              </Surface>

              {/* Today's Summary (6-Metric Card) */}
              <Text style={styles.sectionHeaderTitle}>Today's Summary</Text>
              <Surface style={[styles.summary6GridCard, cardShadow]} elevation={1}>
                <View style={styles.summaryRowItem}>
                  <View style={styles.summaryColItem}>
                    <Text style={styles.summaryColLabel}>Punch In</Text>
                    <Text style={styles.summaryColValue}>{selectedDetailEmp.punchInTime}</Text>
                  </View>
                  <View style={styles.summaryColItem}>
                    <Text style={styles.summaryColLabel}>Punch Out</Text>
                    <Text style={styles.summaryColValue}>{selectedDetailEmp.punchOutTime}</Text>
                  </View>
                </View>

                <View style={styles.summaryDivider} />

                <View style={styles.summaryRowItem}>
                  <View style={styles.summaryColItem}>
                    <Text style={styles.summaryColLabel}>Working Hours</Text>
                    <Text style={styles.summaryColValue}>{selectedDetailEmp.workingHours}</Text>
                  </View>
                  <View style={styles.summaryColItem}>
                    <Text style={styles.summaryColLabel}>Today's KM</Text>
                    <Text style={[styles.summaryColValue, { color: COLORS.primary }]}>
                      {Number(selectedDetailEmp.distanceToday).toFixed(1)} KM
                    </Text>
                  </View>
                </View>

                <View style={styles.summaryDivider} />

                <View style={styles.summaryRowItem}>
                  <View style={styles.summaryColItem}>
                    <Text style={styles.summaryColLabel}>Visits</Text>
                    <Text style={styles.summaryColValue}>{selectedDetailEmp.todayVisits}</Text>
                  </View>
                  <View style={styles.summaryColItem}>
                    <Text style={styles.summaryColLabel}>Expenses</Text>
                    <Text style={styles.summaryColValue}>₹{selectedDetailEmp.todayExpenses}</Text>
                  </View>
                </View>
              </Surface>

              {/* Tab Switcher (Overview, Attendance, Visits, More) */}
              <View style={styles.detailTabBar}>
                {['overview', 'attendance', 'visits', 'more'].map((tabKey) => (
                  <TouchableOpacity
                    key={tabKey}
                    style={[styles.detailTabBtn, detailTab === tabKey && styles.detailTabBtnActive]}
                    onPress={() => setDetailTab(tabKey)}
                  >
                    <Text style={[styles.detailTabBtnText, detailTab === tabKey && styles.detailTabBtnTextActive]}>
                      {tabKey.charAt(0).toUpperCase() + tabKey.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Performance Section (80% Ring + Weekly Trend) */}
              <Surface style={[styles.performanceCard, cardShadow]} elevation={1}>
                <Text style={styles.perfTitle}>Performance & Weekly Trend</Text>
                <View style={styles.perfRow}>
                  <View style={styles.gaugeBox}>
                    <View style={styles.gaugeCircle}>
                      <Text style={styles.gaugePercent}>80%</Text>
                      <Text style={styles.gaugeLabel}>Score</Text>
                    </View>
                  </View>

                  <View style={styles.weeklyBarsCol}>
                    <Text style={styles.weeklyTitle}>Weekly Trend</Text>
                    <View style={styles.barsRow}>
                      {[
                        { day: 'Mon', h: 60 },
                        { day: 'Tue', h: 85 },
                        { day: 'Wed', h: 70 },
                        { day: 'Thu', h: 90 },
                        { day: 'Fri', h: 75 },
                        { day: 'Sat', h: 50 },
                        { day: 'Sun', h: 80 },
                      ].map((bar, bIdx) => (
                        <View key={bIdx} style={styles.barItem}>
                          <View style={styles.barTrack}>
                            <View style={[styles.barFill, { height: `${bar.h}%` }]} />
                          </View>
                          <Text style={styles.barDayText}>{bar.day}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              </Surface>
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* ── ADD EMPLOYEE MODAL ── */}
      <Modal visible={addModalVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <Surface style={styles.modalCard} elevation={4}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Team Member</Text>
              <TouchableOpacity onPress={() => setAddModalVisible(false)}>
                <X size={20} color={COLORS.textSub} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder="Full Name *"
              placeholderTextColor={COLORS.textMuted}
              value={newName}
              onChangeText={setNewName}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Mobile Phone *"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="phone-pad"
              value={newPhone}
              onChangeText={setNewPhone}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Email Address"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="email-address"
              value={newEmail}
              onChangeText={setNewEmail}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Department / Beat"
              placeholderTextColor={COLORS.textMuted}
              value={newDept}
              onChangeText={setNewDept}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelModalBtn} onPress={() => setAddModalVisible(false)}>
                <Text style={styles.cancelModalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveModalBtn} onPress={handleAddEmployee} disabled={addingSaving}>
                {addingSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveModalBtnText}>Add Staff</Text>}
              </TouchableOpacity>
            </View>
          </Surface>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerGradient: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    fontFamily: FONT,
  },
  headerSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    fontFamily: FONT,
    marginTop: 2,
  },
  filterBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabItemActive: {
    backgroundColor: COLORS.primaryLight,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSub,
    fontFamily: FONT,
  },
  tabTextActive: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
    fontFamily: FONT,
  },
  listContent: {
    padding: 16,
    paddingBottom: 90,
  },
  employeeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardMainTouch: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.border,
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarFallbackText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    fontFamily: FONT,
  },
  infoCol: {
    flex: 1,
    marginLeft: 12,
  },
  nameHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  empNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    fontFamily: FONT,
    flex: 1,
  },
  deptSubText: {
    fontSize: 12,
    color: COLORS.textSub,
    fontFamily: FONT,
    marginTop: 2,
  },
  locationText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontFamily: FONT,
    marginTop: 2,
  },
  rightDistanceCol: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  distanceValueText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary,
    fontFamily: FONT,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.successLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.success,
  },
  activePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.success,
    fontFamily: FONT,
  },
  idlePill: {
    backgroundColor: COLORS.warningLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  idlePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.warning,
    fontFamily: FONT,
  },
  offlinePill: {
    backgroundColor: COLORS.surfaceSecondary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  offlinePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
    fontFamily: FONT,
  },
  floatingAddBtn: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 30,
    gap: 8,
    elevation: 4,
    shadowColor: COLORS.primaryDark,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  floatingAddBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    fontFamily: FONT,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    fontFamily: FONT,
    marginTop: 12,
  },
  emptySub: {
    fontSize: 13,
    color: COLORS.textSub,
    fontFamily: FONT,
    marginTop: 4,
  },

  // ── DETAIL MODAL STYLES (Screen 5) ──
  detailRoot: { flex: 1, backgroundColor: COLORS.bg },
  detailHeaderGradient: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
  },
  detailHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailHeaderName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    fontFamily: FONT,
  },
  detailHeaderRole: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    fontFamily: FONT,
    marginTop: 2,
  },
  detailBody: {
    padding: 16,
    paddingBottom: 40,
  },
  detailProfileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  detailProfileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailAvatarImg: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.border,
  },
  detailAvatarFallback: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailAvatarFallbackText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
    fontFamily: FONT,
  },
  detailCardName: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
    fontFamily: FONT,
  },
  detailCardSub: {
    fontSize: 13,
    color: COLORS.textSub,
    fontFamily: FONT,
    marginTop: 2,
  },
  detailCardCode: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontFamily: FONT,
    marginTop: 4,
  },
  quickActions3Row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  actionCircleBtn: {
    alignItems: 'center',
    gap: 6,
  },
  actionCircleIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionCircleLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
    fontFamily: FONT,
  },
  sectionHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
    fontFamily: FONT,
    marginTop: 20,
    marginBottom: 10,
  },
  summary6GridCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryRowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryColItem: {
    flex: 1,
  },
  summaryColLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontFamily: FONT,
  },
  summaryColValue: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
    fontFamily: FONT,
    marginTop: 4,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 12,
  },
  detailTabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 4,
    marginTop: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  detailTabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  detailTabBtnActive: {
    backgroundColor: COLORS.primaryLight,
  },
  detailTabBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSub,
    fontFamily: FONT,
  },
  detailTabBtnTextActive: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  performanceCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginTop: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  perfTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    fontFamily: FONT,
    marginBottom: 14,
  },
  perfRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gaugeBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 6,
    borderColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gaugePercent: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary,
    fontFamily: FONT,
  },
  gaugeLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontFamily: FONT,
  },
  weeklyBarsCol: {
    flex: 1,
    marginLeft: 20,
  },
  weeklyTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSub,
    fontFamily: FONT,
    marginBottom: 8,
  },
  barsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 60,
  },
  barItem: {
    alignItems: 'center',
  },
  barTrack: {
    width: 12,
    height: 44,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 6,
  },
  barDayText: {
    fontSize: 9,
    color: COLORS.textMuted,
    fontFamily: FONT,
    marginTop: 4,
  },

  // Modal Backdrop
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
    fontFamily: FONT,
  },
  modalInput: {
    backgroundColor: COLORS.bg,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 13,
    color: COLORS.text,
    fontFamily: FONT,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  cancelModalBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelModalBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSub,
    fontFamily: FONT,
  },
  saveModalBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: COLORS.primary,
  },
  saveModalBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
    fontFamily: FONT,
  },
});