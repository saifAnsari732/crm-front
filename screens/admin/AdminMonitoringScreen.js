import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Platform,
  RefreshControl,
  TextInput,
  Modal,
  Image,
  StatusBar,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Surface, Avatar } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Users,
  UserCheck,
  MapPin,
  Route,
  Clock,
  RefreshCw,
  Search,
  X,
  ChevronRight,
  ArrowLeft,
  Phone,
  MessageCircle,
  Navigation,
  Activity,
  CheckCircle2,
  Calendar,
  Briefcase,
  ShieldCheck,
  LayoutDashboard,
  FileText,
  Settings,
  Battery,
  Building2,
  Sparkles,
} from 'lucide-react-native';
import {
  trackingAPI,
  adminAPI,
  getAvatarUrl
} from '../../services/api';
import socketService from '../../services/socket';
import { cachedFetch, clearCachePrefix } from '../../services/cache';
import { useAuth } from '../../context/AuthContext';

const { width } = Dimensions.get('window');
const FONT = Platform.OS === 'ios' ? 'System' : 'sans-serif-medium';

const COLORS = {
  primary: '#074e26',
  primaryDark: '#053e1e',
  primaryLight: '#059669',
  accent: '#10b981',
  bg: '#f8fafc',
  surface: '#ffffff',
  text: '#0f172a',
  textMuted: '#64748b',
  textSub: '#94a3b8',
  border: '#e2e8f0',
  cardBg: '#ffffff',
  success: '#10b981',
  warning: '#f59e0b',
  info: '#0284c7',
  danger: '#ef4444',
  purple: '#8b5cf6',
};

const formatAddress = (addr, fallback = 'Location unavailable') => {
  if (!addr) return fallback;
  if (typeof addr === 'string') {
    const trimmed = addr.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.street || parsed.city || parsed.state) {
          return [parsed.street, parsed.city, parsed.state].filter(Boolean).join(', ') || fallback;
        }
        return parsed.formattedAddress || parsed.address || fallback;
      } catch (e) {
        return trimmed || fallback;
      }
    }
    return trimmed || fallback;
  }
  if (typeof addr === 'object' && addr !== null) {
    const parts = [addr.street, addr.city, addr.state, addr.pincode].filter(Boolean);
    if (parts.length > 0) return parts.join(', ');
    return addr.formattedAddress || addr.address || fallback;
  }
  return String(addr || '').trim() || fallback;
};

const formatFullName = (name) => {
  if (!name) return 'Field Executive';
  return name.trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
};

const getUserInitials = (name) => {
  if (!name) return 'FE';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].substring(0, 2).toUpperCase();
};

const fmtTime = (t) => {
  if (!t) return '—';
  try {
    return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
};

export default function AdminMonitoringScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const params = useLocalSearchParams();

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // State
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'OFFLINE' | 'PRESENT'
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data
  const [employees, setEmployees] = useState([]);
  const [liveLocations, setLiveLocations] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [stats, setStats] = useState(null);

  // Selected Employee Modal
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [empModalVisible, setEmpModalVisible] = useState(false);

  // ─── Data Fetching ──────────────────────────────────────────────────────────
  const fetchData = useCallback(async (force = false) => {
    try {
      const [empRes, locRes, attRes, statsRes] = await Promise.all([
        cachedFetch('admin_workforce_employees', () => adminAPI.getEmployees({ limit: 200, role: 'all' }), 10, force),
        cachedFetch('admin_workforce_locations', () => trackingAPI.getLiveLocations(), 10, force),
        cachedFetch(`admin_workforce_att_${todayStr}`, () => adminAPI.getAttendance({ date: todayStr }), 30, force),
        cachedFetch('admin_workforce_stats', () => adminAPI.getDashboard(), 20, force),
      ]);

      if (empRes.data?.success) setEmployees(empRes.data.employees || []);
      if (locRes.data?.success) setLiveLocations(locRes.data.locations || []);
      if (attRes.data?.success) setAttendanceRecords(attRes.data.records || attRes.data.attendance || []);
      if (statsRes.data?.success) setStats(statsRes.data.stats || null);
    } catch (err) {
      console.log('Workforce fetch error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [todayStr]);

  useEffect(() => {
    fetchData();

    // Socket.IO for live distance & status updates
    let socket;
    const initSocket = async () => {
      try {
        socket = await socketService.connect();
        if (socket) {
          socket.on('employee_location', (data) => {
            setLiveLocations((prev) => {
              const idx = prev.findIndex(l => l.employeeId === data.employeeId || l.sessionId === data.sessionId);
              if (idx > -1) {
                const upd = [...prev];
                upd[idx] = { ...upd[idx], ...data, totalDistance: data.totalDistance, updatedAt: new Date().toISOString() };
                return upd;
              }
              return [...prev, { ...data, updatedAt: new Date().toISOString() }];
            });

            // Update in employees list as well
            setEmployees((prev) =>
              prev.map((e) => {
                if (String(e._id) === String(data.employeeId)) {
                  return {
                    ...e,
                    isTracking: true,
                    isLive: true,
                    totalDistance: data.totalDistance,
                    totalDistanceToday: data.totalDistance,
                    lastPing: new Date().toISOString(),
                  };
                }
                return e;
              })
            );
          });

          socket.on('employee_tracking_started', () => fetchData(true));
          socket.on('employee_tracking_stopped', () => fetchData(true));
        }
      } catch {}
    };
    initSocket();

    const interval = setInterval(() => fetchData(true), 25000);
    return () => {
      clearInterval(interval);
      if (socket) {
        socket.off('employee_location');
        socket.off('employee_tracking_started');
        socket.off('employee_tracking_stopped');
      }
    };
  }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    clearCachePrefix('admin_workforce_');
    await fetchData(true);
  };

  // ─── Enriched Roster Calculation ────────────────────────────────────────────
  const userOrgId = String(user?.organizationId?._id || user?.organizationId || user?.organization || '');

  const staffDirectory = useMemo(() => {
    const staffOnly = employees.filter(e => {
      const r = (e.role || '').toUpperCase();
      const isNotAdmin = r !== 'SUPER_ADMIN' && r !== 'SUPERADMIN' && r !== 'ORG_ADMIN' && r !== 'ORGADMIN';
      const empOrgId = String(e.organizationId?._id || e.organizationId || e.organization || '');
      if (userOrgId && empOrgId && userOrgId !== empOrgId) return false;
      return isNotAdmin;
    });

    return staffOnly.map(emp => {
      const empIdStr = String(emp._id || '');
      const liveLoc = liveLocations.find(l => String(l.employeeId || l.employee?._id || l.employee || l._id) === empIdStr);
      const attRec = attendanceRecords.find(a => String(a.employee?._id || a.employee) === empIdStr);

      const isLive = emp.isTracking === true || emp.isOnline === true || (liveLoc && liveLoc.isActive !== false);

      const todayKm = Math.round(Math.max(
        Number(emp.totalDistance) || 0,
        Number(emp.totalDistanceToday) || 0,
        Number(attRec?.totalDistanceTraveled) || 0,
        Number(liveLoc?.totalDistance) || 0,
        Number(liveLoc?.officialDistance) || 0
      ) * 100) / 100;

      const pingTime = liveLoc?.lastActivity || liveLoc?.updatedAt || emp.lastPing || attRec?.checkIn || emp.lastCheckIn || emp.lastSeen || emp.updatedAt;
      const currentAddr = formatAddress(liveLoc?.address || liveLoc?.currentAddress || emp.address || emp.currentAddress, isLive ? 'Active On Field' : 'Offline / Idle');

      const isPresent = ['present', 'late', 'half-day'].includes((attRec?.status || '').toLowerCase()) || !!attRec?.checkIn || isLive;

      return {
        ...emp,
        isLive,
        isTracking: isLive,
        isPresent,
        todayKm,
        pingTime,
        currentAddr,
        checkInTime: attRec?.checkIn,
        checkOutTime: attRec?.checkOut,
        attendanceStatus: attRec?.status || (isLive ? 'present' : (isPresent ? 'present' : 'absent')),
        liveSessionId: liveLoc?.sessionId || emp.sessionId,
      };
    });
  }, [employees, liveLocations, attendanceRecords, userOrgId]);

  // Sorting: Live on top, then highest KM, then alphabetical
  const sortedStaff = useMemo(() => {
    return [...staffDirectory].sort((a, b) => {
      if (a.isLive && !b.isLive) return -1;
      if (!a.isLive && b.isLive) return 1;
      return (b.todayKm || 0) - (a.todayKm || 0);
    });
  }, [staffDirectory]);

  // Filtered staff list by search query & filter pill
  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortedStaff.filter(item => {
      // Filter Type matching
      if (filterType === 'ACTIVE' && !item.isLive) return false;
      if (filterType === 'OFFLINE' && item.isLive) return false;
      if (filterType === 'PRESENT' && !item.isPresent) return false;

      // Query matching
      if (!q) return true;
      return (item.name || '').toLowerCase().includes(q) ||
        (item.department || '').toLowerCase().includes(q) ||
        (item.designation || '').toLowerCase().includes(q) ||
        (item.employeeId || '').toLowerCase().includes(q) ||
        (item.phone || '').includes(q) ||
        (item.currentAddr || '').toLowerCase().includes(q);
    });
  }, [sortedStaff, search, filterType]);

  // ─── KPI Aggregates ─────────────────────────────────────────────────────────
  const totalStaffCount = staffDirectory.length;
  const activeStaffCount = staffDirectory.filter(s => s.isLive).length;
  const totalKmSum = Math.round(staffDirectory.reduce((sum, s) => sum + (s.todayKm || 0), 0) * 10) / 10;
  const presentCount = staffDirectory.filter(s => s.isPresent).length;

  const handleOpenEmployeeDetail = (emp) => {
    setSelectedEmp(emp);
    setEmpModalVisible(true);
  };

  const handleCall = (phone) => {
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  const handleWhatsApp = (phone) => {
    if (phone) Linking.openURL(`https://wa.me/${phone.replace(/[^0-9]/g, '')}`);
  };

  const handleViewLiveMap = (emp) => {
    setEmpModalVisible(false);
    router.push(`/(admin)/tracking?employeeId=${emp._id}`);
  };

  const goTo = (path) => {
    router.push(path);
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#074e26" />

      {/* ─── 1. EXECUTIVE BRAND HEADER ────────────────────────────────────── */}
      <LinearGradient
        colors={['#074e26', '#065a29']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.headerNavRow}>
            <TouchableOpacity
              style={styles.navCircleBtn}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(admin)/dashboard'))}
              activeOpacity={0.8}
            >
              <ArrowLeft size={20} color="#ffffff" />
            </TouchableOpacity>

            <View style={styles.headerTitleWrap}>
              <View style={styles.badgeRow}>
                <Users size={18} color="#10b981" />
                <Text style={styles.headerMainTitle}>Workforce Directory</Text>
              </View>
              <Text style={styles.headerSubTitle}>Real-Time Field Team & Shift Operations</Text>
            </View>

            <TouchableOpacity
              style={styles.navCircleBtn}
              onPress={onRefresh}
              disabled={refreshing}
              activeOpacity={0.8}
            >
              <RefreshCw size={18} color="#ffffff" style={refreshing ? { opacity: 0.5 } : {}} />
            </TouchableOpacity>
          </View>

          {/* ─── 2. KPI METRICS CAROUSEL CARDS ────────────────────────────── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.kpiScrollContainer}
          >
            {/* Card 1: Total Staff */}
            <Surface style={styles.kpiCard} elevation={2}>
              <View style={styles.kpiTopRow}>
                <View style={[styles.kpiIconBox, { backgroundColor: '#e0f2fe' }]}>
                  <Users size={16} color="#0284c7" />
                </View>
                <Text style={styles.kpiLabel}>Total Staff</Text>
              </View>
              <Text style={styles.kpiValue}>{totalStaffCount}</Text>
              <Text style={styles.kpiSub}>Registered Field Crew</Text>
            </Surface>

            {/* Card 2: Live On Field */}
            <Surface style={[styles.kpiCard, styles.kpiCardHighlight]} elevation={3}>
              <View style={styles.kpiTopRow}>
                <View style={[styles.kpiIconBox, { backgroundColor: '#dcfce7' }]}>
                  <Activity size={16} color="#16a34a" />
                </View>
                <View style={styles.liveBadgeSmall}>
                  <View style={styles.pulseDot} />
                  <Text style={styles.liveBadgeSmallText}>LIVE</Text>
                </View>
              </View>
              <Text style={[styles.kpiValue, { color: '#15803d' }]}>{activeStaffCount}</Text>
              <Text style={styles.kpiSub}>Active On Shift</Text>
            </Surface>

            {/* Card 3: Today KM */}
            <Surface style={styles.kpiCard} elevation={2}>
              <View style={styles.kpiTopRow}>
                <View style={[styles.kpiIconBox, { backgroundColor: '#fef3c7' }]}>
                  <Route size={16} color="#d97706" />
                </View>
                <Text style={styles.kpiLabel}>Today Travel</Text>
              </View>
              <Text style={styles.kpiValue}>{totalKmSum} <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.textMuted }}>KM</Text></Text>
              <Text style={styles.kpiSub}>Fleet Total Today</Text>
            </Surface>

            {/* Card 4: Attendance */}
            <Surface style={styles.kpiCard} elevation={2}>
              <View style={styles.kpiTopRow}>
                <View style={[styles.kpiIconBox, { backgroundColor: '#ede9fe' }]}>
                  <UserCheck size={16} color="#7c3aed" />
                </View>
                <Text style={styles.kpiLabel}>Attendance</Text>
              </View>
              <Text style={styles.kpiValue}>{presentCount}/{totalStaffCount}</Text>
              <Text style={styles.kpiSub}>{totalStaffCount > 0 ? Math.round((presentCount / totalStaffCount) * 100) : 0}% Present Today</Text>
            </Surface>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>

      {/* ─── 3. SEARCH & FILTER CONTROLS ──────────────────────────────────── */}
      <View style={styles.searchSection}>
        <Surface style={styles.searchBarSurface} elevation={1}>
          <Search size={18} color={COLORS.textMuted} style={{ marginLeft: 12 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search employee, ID, phone, department..."
            placeholderTextColor={COLORS.textSub}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} style={styles.clearSearchBtn}>
              <X size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </Surface>

        {/* Filter Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillsRow}>
          <TouchableOpacity
            style={[styles.filterChip, filterType === 'ALL' && styles.filterChipActive]}
            onPress={() => setFilterType('ALL')}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterChipText, filterType === 'ALL' && styles.filterChipTextActive]}>
              All ({totalStaffCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filterType === 'ACTIVE' && styles.filterChipActive]}
            onPress={() => setFilterType('ACTIVE')}
            activeOpacity={0.8}
          >
            <View style={styles.greenDotSmall} />
            <Text style={[styles.filterChipText, filterType === 'ACTIVE' && styles.filterChipTextActive]}>
              Live Active ({activeStaffCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filterType === 'PRESENT' && styles.filterChipActive]}
            onPress={() => setFilterType('PRESENT')}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterChipText, filterType === 'PRESENT' && styles.filterChipTextActive]}>
              Present ({presentCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filterType === 'OFFLINE' && styles.filterChipActive]}
            onPress={() => setFilterType('OFFLINE')}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterChipText, filterType === 'OFFLINE' && styles.filterChipTextActive]}>
              Offline ({totalStaffCount - activeStaffCount})
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* ─── 4. EMPLOYEE ROSTER CARDS LIST ────────────────────────────────── */}
      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Syncing workforce telemetry…</Text>
        </View>
      ) : (
        <FlatList
          data={filteredStaff}
          keyExtractor={(item) => String(item._id || item.employeeId || Math.random())}
          contentContainerStyle={[styles.listContentContainer, { paddingBottom: 120 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Surface style={styles.emptyCard} elevation={1}>
              <Users size={42} color={COLORS.textSub} />
              <Text style={styles.emptyTitle}>No Employees Found</Text>
              <Text style={styles.emptySub}>
                {search ? `No results match "${search}"` : 'No staff members are registered under this filter.'}
              </Text>
            </Surface>
          }
          renderItem={({ item }) => {
            const isLive = item.isLive;
            const kmFormatted = (parseFloat(item.todayKm) || 0).toFixed(2);
            const initials = getUserInitials(item.name);
            const fullName = formatFullName(item.name);

            return (
              <Surface style={styles.empCard} elevation={2}>
                <TouchableOpacity
                  style={styles.empCardTouchable}
                  onPress={() => handleOpenEmployeeDetail(item)}
                  activeOpacity={0.75}
                >
                  {/* Left Column: Avatar with Status Ring */}
                  <View style={styles.avatarCol}>
                    <View style={styles.avatarWrap}>
                      {getAvatarUrl(item.avatar) ? (
                        <Image source={{ uri: getAvatarUrl(item.avatar) }} style={styles.avatarImg} />
                      ) : (
                        <View style={[styles.avatarFallback, { backgroundColor: isLive ? '#065a29' : '#475569' }]}>
                          <Text style={styles.avatarInitialText}>{initials}</Text>
                        </View>
                      )}
                      <View style={[styles.statusRingDot, { backgroundColor: isLive ? '#10b981' : '#94a3b8' }]} />
                    </View>
                  </View>

                  {/* Middle Column: Info & Location */}
                  <View style={styles.infoCol}>
                    <View style={styles.nameHeaderRow}>
                      <Text style={styles.empNameText} numberOfLines={1}>{fullName}</Text>
                      {isLive && (
                        <View style={styles.livePill}>
                          <View style={styles.pulseDotGreen} />
                          <Text style={styles.livePillText}>LIVE</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.roleRow}>
                      {item.employeeId && (
                        <View style={styles.empIdBadge}>
                          <Text style={styles.empIdBadgeText}>{item.employeeId}</Text>
                        </View>
                      )}
                      <Text style={styles.empDeptText} numberOfLines={1}>
                        {item.department ? `${item.department} • ` : ''}{item.designation || 'Field Executive'}
                      </Text>
                    </View>

                    <View style={styles.locationRow}>
                      <MapPin size={11} color={COLORS.textMuted} style={{ marginTop: 2, marginRight: 4 }} />
                      <Text style={styles.locationText} numberOfLines={1}>{item.currentAddr}</Text>
                    </View>
                  </View>

                  {/* Right Column: Dynamic Real-Time KM Pill & Chevron */}
                  <View style={styles.rightCol}>
                    <View style={[styles.kmBadgePill, isLive && styles.kmBadgePillActive]}>
                      <Route size={12} color={isLive ? '#047857' : '#475569'} style={{ marginRight: 4 }} />
                      <Text style={[styles.kmBadgeText, isLive && styles.kmBadgeTextActive]}>
                        {kmFormatted} KM
                      </Text>
                    </View>

                    <Text style={styles.pingTimeText}>
                      {isLive ? 'Ping: ' + fmtTime(item.pingTime) : (item.isPresent ? 'Present' : 'Offline')}
                    </Text>

                    <View style={styles.chevronBox}>
                      <ChevronRight size={16} color={COLORS.primary} />
                    </View>
                  </View>
                </TouchableOpacity>
              </Surface>
            );
          }}
        />
      )}

      {/* ─── 5. FLOATING BOTTOM TAB BAR (UI/UX PRO MAX) ──────────────────── */}
      <View style={styles.bottomTabBarContainer}>
        <Surface style={styles.bottomTabBarSurface} elevation={6}>
          {/* Tab 1: Home */}
          <TouchableOpacity style={styles.tabBarItem} onPress={() => goTo('/(admin)/dashboard')} activeOpacity={0.7}>
            <View style={styles.tabBarIconBox}>
              <LayoutDashboard size={20} color="#64748b" />
            </View>
            <Text style={styles.tabBarLabel}>Home</Text>
          </TouchableOpacity>

          {/* Tab 2: Live Map */}
          <TouchableOpacity style={styles.tabBarItem} onPress={() => goTo('/(admin)/tracking')} activeOpacity={0.7}>
            <View style={styles.tabBarIconBox}>
              <MapPin size={20} color="#64748b" />
            </View>
            <Text style={styles.tabBarLabel}>Live Map</Text>
          </TouchableOpacity>

          {/* Tab 3: Workforce (Active) */}
          <TouchableOpacity style={styles.tabBarItem} onPress={() => {}} activeOpacity={0.7}>
            <View style={[styles.tabBarIconBox, styles.tabBarIconBoxActive]}>
              <Users size={20} color="#059669" />
            </View>
            <Text style={[styles.tabBarLabel, styles.tabBarLabelActive]}>Workforce</Text>
            <View style={styles.activeTabDot} />
          </TouchableOpacity>

          {/* Tab 4: Reports */}
          <TouchableOpacity style={styles.tabBarItem} onPress={() => goTo('/(admin)/reports')} activeOpacity={0.7}>
            <View style={styles.tabBarIconBox}>
              <FileText size={20} color="#64748b" />
            </View>
            <Text style={styles.tabBarLabel}>Reports</Text>
          </TouchableOpacity>

          {/* Tab 5: Settings */}
          <TouchableOpacity style={styles.tabBarItem} onPress={() => goTo('/(admin)/settings')} activeOpacity={0.7}>
            <View style={styles.tabBarIconBox}>
              <Settings size={20} color="#64748b" />
            </View>
            <Text style={styles.tabBarLabel}>Settings</Text>
          </TouchableOpacity>
        </Surface>
      </View>

      {/* ─── 6. INTERACTIVE EMPLOYEE DETAIL MODAL ────────────────────────── */}
      <Modal
        visible={empModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEmpModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={styles.modalBackdropTap}
            activeOpacity={1}
            onPress={() => setEmpModalVisible(false)}
          />

          <Surface style={styles.modalDrawerSurface} elevation={6}>
            <View style={styles.drawerHandleBar} />

            {selectedEmp && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.drawerScroll}>
                {/* Header Profile Section */}
                <View style={styles.modalProfileHeader}>
                  <View style={styles.modalAvatarBox}>
                    {getAvatarUrl(selectedEmp.avatar) ? (
                      <Image source={{ uri: getAvatarUrl(selectedEmp.avatar) }} style={styles.modalAvatarImg} />
                    ) : (
                      <View style={styles.modalAvatarFallback}>
                        <Text style={styles.modalAvatarInitials}>{getUserInitials(selectedEmp.name)}</Text>
                      </View>
                    )}
                    <View style={[styles.modalStatusBadge, { backgroundColor: selectedEmp.isLive ? '#10b981' : '#94a3b8' }]} />
                  </View>

                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={styles.modalEmpName}>{formatFullName(selectedEmp.name)}</Text>
                    <Text style={styles.modalEmpRole}>
                      {selectedEmp.department ? `${selectedEmp.department} • ` : ''}{selectedEmp.designation || 'Field Executive'}
                    </Text>
                    {selectedEmp.employeeId && (
                      <View style={styles.modalEmpIdBadge}>
                        <Text style={styles.modalEmpIdText}>ID: {selectedEmp.employeeId}</Text>
                      </View>
                    )}
                  </View>

                  <TouchableOpacity onPress={() => setEmpModalVisible(false)} style={styles.modalCloseCircle}>
                    <X size={18} color="#64748b" />
                  </TouchableOpacity>
                </View>

                {/* Quick Action Buttons: Call, WhatsApp, View GPS Route */}
                <View style={styles.actionButtonsRow}>
                  {selectedEmp.phone && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#0284c7' }]}
                      onPress={() => handleCall(selectedEmp.phone)}
                      activeOpacity={0.8}
                    >
                      <Phone size={15} color="#ffffff" style={{ marginRight: 6 }} />
                      <Text style={styles.actionBtnText}>Call</Text>
                    </TouchableOpacity>
                  )}

                  {selectedEmp.phone && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#16a34a' }]}
                      onPress={() => handleWhatsApp(selectedEmp.phone)}
                      activeOpacity={0.8}
                    >
                      <MessageCircle size={15} color="#ffffff" style={{ marginRight: 6 }} />
                      <Text style={styles.actionBtnText}>WhatsApp</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#0f766e', flex: 1.4 }]}
                    onPress={() => handleViewLiveMap(selectedEmp)}
                    activeOpacity={0.8}
                  >
                    <Navigation size={15} color="#ffffff" style={{ marginRight: 6 }} />
                    <Text style={styles.actionBtnText}>View GPS Route</Text>
                  </TouchableOpacity>
                </View>

                {/* Performance Metrics Grid */}
                <Text style={styles.sectionHeaderTitle}>Today's Field Telemetry</Text>
                <View style={styles.metricsGrid}>
                  {/* Metric 1: Distance */}
                  <View style={styles.metricGridCard}>
                    <View style={[styles.metricGridIcon, { backgroundColor: '#ecfdf5' }]}>
                      <Route size={18} color="#059669" />
                    </View>
                    <Text style={styles.metricGridValue}>{(parseFloat(selectedEmp.todayKm) || 0).toFixed(2)} KM</Text>
                    <Text style={styles.metricGridLabel}>Shift Distance</Text>
                  </View>

                  {/* Metric 2: Live Status */}
                  <View style={styles.metricGridCard}>
                    <View style={[styles.metricGridIcon, { backgroundColor: selectedEmp.isLive ? '#dcfce7' : '#f1f5f9' }]}>
                      <Activity size={18} color={selectedEmp.isLive ? '#16a34a' : '#64748b'} />
                    </View>
                    <Text style={[styles.metricGridValue, { color: selectedEmp.isLive ? '#16a34a' : '#64748b' }]}>
                      {selectedEmp.isLive ? 'ON SHIFT' : 'OFFLINE'}
                    </Text>
                    <Text style={styles.metricGridLabel}>Current Mode</Text>
                  </View>

                  {/* Metric 3: Check-in Time */}
                  <View style={styles.metricGridCard}>
                    <View style={[styles.metricGridIcon, { backgroundColor: '#eff6ff' }]}>
                      <Clock size={18} color="#2563eb" />
                    </View>
                    <Text style={styles.metricGridValue}>{fmtTime(selectedEmp.checkInTime) || 'Not Punched'}</Text>
                    <Text style={styles.metricGridLabel}>Check-In Time</Text>
                  </View>

                  {/* Metric 4: Attendance Status */}
                  <View style={styles.metricGridCard}>
                    <View style={[styles.metricGridIcon, { backgroundColor: '#fef3c7' }]}>
                      <CheckCircle2 size={18} color="#d97706" />
                    </View>
                    <Text style={[styles.metricGridValue, { textTransform: 'capitalize' }]}>
                      {selectedEmp.attendanceStatus || (selectedEmp.isLive ? 'Present' : 'Absent')}
                    </Text>
                    <Text style={styles.metricGridLabel}>Attendance</Text>
                  </View>
                </View>

                {/* Current / Last Known Location Box */}
                <Text style={styles.sectionHeaderTitle}>Location & Contact</Text>
                <Surface style={styles.infoBoxCard} elevation={1}>
                  <View style={styles.infoBoxRow}>
                    <MapPin size={16} color={COLORS.primary} style={{ marginTop: 2, marginRight: 10 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.infoBoxLabel}>Last Recorded Location</Text>
                      <Text style={styles.infoBoxValue}>{selectedEmp.currentAddr}</Text>
                      <Text style={styles.infoBoxSub}>Pinged: {fmtTime(selectedEmp.pingTime)}</Text>
                    </View>
                  </View>

                  {selectedEmp.phone && (
                    <View style={[styles.infoBoxRow, { marginTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 10 }]}>
                      <Phone size={16} color="#0284c7" style={{ marginTop: 2, marginRight: 10 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.infoBoxLabel}>Mobile Number</Text>
                        <Text style={styles.infoBoxValue}>{selectedEmp.phone}</Text>
                      </View>
                    </View>
                  )}

                  {selectedEmp.email && (
                    <View style={[styles.infoBoxRow, { marginTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 10 }]}>
                      <Building2 size={16} color="#7c3aed" style={{ marginTop: 2, marginRight: 10 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.infoBoxLabel}>Email</Text>
                        <Text style={styles.infoBoxValue}>{selectedEmp.email}</Text>
                      </View>
                    </View>
                  )}
                </Surface>
              </ScrollView>
            )}
          </Surface>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  headerGradient: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  navCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerMainTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    fontFamily: FONT,
    letterSpacing: 0.3,
  },
  headerSubTitle: {
    fontSize: 11,
    color: '#a7f3d0',
    fontWeight: '500',
    marginTop: 2,
    fontFamily: FONT,
  },

  /* KPI Scroll Container */
  kpiScrollContainer: {
    paddingTop: 12,
    paddingBottom: 4,
    gap: 10,
  },
  kpiCard: {
    width: 125,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
  },
  kpiCardHighlight: {
    borderColor: '#86efac',
    borderWidth: 1.5,
  },
  kpiTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  kpiIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  kpiLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    fontFamily: FONT,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    fontFamily: FONT,
  },
  kpiSub: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
    fontWeight: '500',
  },
  liveBadgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  liveBadgeSmallText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#15803d',
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16a34a',
  },

  /* Search & Filter Section */
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  searchBarSurface: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    height: 44,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 10,
    fontSize: 13,
    color: '#0f172a',
    fontFamily: FONT,
  },
  clearSearchBtn: {
    padding: 8,
    marginRight: 6,
  },
  filterPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    paddingBottom: 4,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: '#074e26',
    borderColor: '#074e26',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    fontFamily: FONT,
  },
  filterChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  greenDotSmall: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10b981',
  },

  /* List & Cards */
  listContentContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 10,
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  emptyCard: {
    padding: 32,
    borderRadius: 18,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 10,
    fontFamily: FONT,
  },
  emptySub: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
  },

  empCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  empCardTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  avatarCol: {
    marginRight: 12,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarImg: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  avatarFallback: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitialText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 15,
  },
  statusRingDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    borderWidth: 2,
    borderColor: '#ffffff',
  },

  infoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  nameHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  empNameText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0f172a',
    fontFamily: FONT,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    gap: 4,
  },
  pulseDotGreen: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#10b981',
  },
  livePillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#047857',
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  empIdBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  empIdBadgeText: {
    fontSize: 9.5,
    color: '#475569',
    fontWeight: '700',
  },
  empDeptText: {
    fontSize: 11.5,
    color: '#64748b',
    fontWeight: '500',
    flex: 1,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  locationText: {
    fontSize: 11,
    color: '#64748b',
    flex: 1,
  },

  rightCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: 6,
  },
  kmBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  kmBadgePillActive: {
    backgroundColor: '#ecfdf5',
    borderColor: '#6ee7b7',
  },
  kmBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
    fontFamily: FONT,
  },
  kmBadgeTextActive: {
    color: '#065f46',
  },
  pingTimeText: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 4,
    fontWeight: '600',
  },
  chevronBox: {
    marginTop: 4,
  },

  /* Floating Bottom Tab Bar */
  bottomTabBarContainer: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    right: 14,
    alignItems: 'center',
  },
  bottomTabBarSurface: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  tabBarItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    position: 'relative',
  },
  tabBarIconBox: {
    width: 34,
    height: 34,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBarIconBoxActive: {
    backgroundColor: '#ecfdf5',
  },
  tabBarLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 2,
    fontFamily: FONT,
  },
  tabBarLabelActive: {
    color: '#059669',
    fontWeight: '800',
  },
  activeTabDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#059669',
    position: 'absolute',
    bottom: -2,
  },

  /* Modal Drawer Styles */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  modalBackdropTap: {
    flex: 1,
  },
  modalDrawerSurface: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 32,
    maxHeight: '85%',
  },
  drawerHandleBar: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#cbd5e1',
    alignSelf: 'center',
    marginBottom: 12,
  },
  drawerScroll: {
    paddingBottom: 20,
  },
  modalProfileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalAvatarBox: {
    position: 'relative',
  },
  modalAvatarImg: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  modalAvatarFallback: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#065a29',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalAvatarInitials: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  modalStatusBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  modalEmpName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    fontFamily: FONT,
  },
  modalEmpRole: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  modalEmpIdBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  modalEmpIdText: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '700',
  },
  modalCloseCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },

  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 14,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
  },
  actionBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#ffffff',
    fontFamily: FONT,
  },

  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 10,
    marginBottom: 8,
    fontFamily: FONT,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricGridCard: {
    width: (width - 56) / 2,
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  metricGridIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricGridValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    fontFamily: FONT,
  },
  metricGridLabel: {
    fontSize: 10.5,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 2,
  },

  infoBoxCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 4,
  },
  infoBoxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoBoxLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  infoBoxValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2,
    fontFamily: FONT,
  },
  infoBoxSub: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
});
