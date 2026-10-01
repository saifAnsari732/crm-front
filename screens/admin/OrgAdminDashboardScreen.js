import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, View, ScrollView, TouchableOpacity,
  ActivityIndicator, Platform, RefreshControl, StatusBar, Image, Dimensions, Modal, Linking, TextInput, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Surface } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Menu, Bell, MapPin, UserPlus, Navigation, Activity,
  Users, CheckCircle2, ChevronRight, UserCheck, Clock, ShieldCheck, DollarSign,
  Phone, Mail, X, MessageSquare, ChevronDown, FileText, PieChart, AlertCircle, Building2,
  LogOut, User, Settings, Search, Home, LayoutDashboard, Briefcase, Plus, Layers
} from 'lucide-react-native';
import { adminAPI, trackingAPI, getAvatarUrl } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import { stopHeartbeat } from '../../services/locationTask';

const { width, height } = Dimensions.get('window');

const NAVY_DARK = '#0f1a2e';
const NAVY_MID = '#1e293b';
const BG_COLOR = '#f8fafc';

const cardShadow = Platform.OS === 'web'
  ? { boxShadow: '0px 6px 20px rgba(15, 26, 46, 0.06)' }
  : { elevation: 3, shadowColor: '#0f1a2e', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } };

export default function OrgAdminDashboardScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const userRole = (user?.role || '').toUpperCase();
  const isSuperAdmin = ['SUPER_ADMIN', 'SUPERADMIN'].includes(userRole);

  const [stats, setStats] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [liveLocations, setLiveLocations] = useState([]);
  const [organization, setOrganization] = useState(null);
  const [managersList, setManagersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals & Panels State
  const [profileMenuVisible, setProfileMenuVisible] = useState(false);
  const [sideMenuVisible, setSideMenuVisible] = useState(false);
  const [addEmpModalVisible, setAddEmpModalVisible] = useState(false);
  const [addMgrModalVisible, setAddMgrModalVisible] = useState(false);

  // Form States
  const [newEmp, setNewEmp] = useState({
    name: '', email: '', password: '111111', phone: '',
    department: 'Field Sales', designation: 'Field Executive', salary: '18000', managerId: ''
  });
  const [newMgr, setNewMgr] = useState({
    name: '', email: '', password: '111111', phone: '',
    department: 'Field Operations', designation: 'Area Manager', salary: '28000'
  });

  const [creatingEmp, setCreatingEmp] = useState(false);
  const [creatingMgr, setCreatingMgr] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('ALL');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [statsRes, empRes, locRes, orgRes, mgrRes] = await Promise.all([
        adminAPI.getDashboard().catch(() => ({ data: { success: false } })),
        adminAPI.getEmployees({ limit: 200, role: 'all' }).catch(() => ({ data: { success: false } })),
        trackingAPI.getLiveLocations().catch(() => ({ data: { success: false } })),
        adminAPI.getOrganization().catch(() => ({ data: { success: false } })),
        adminAPI.getManagers().catch(() => ({ data: { success: false } })),
      ]);

      if (statsRes.data?.success) setStats(statsRes.data.stats || statsRes.data);
      if (empRes.data?.success) setEmployees(empRes.data.employees || empRes.data.data || []);
      if (locRes.data?.success) setLiveLocations(locRes.data.locations || locRes.data.data || []);
      if (orgRes.data?.success) setOrganization(orgRes.data.organization || orgRes.data.data || null);
      if (mgrRes.data?.success) setManagersList(mgrRes.data.managers || []);
    } catch (e) {
      console.log('Org Admin dashboard fetch error:', e.message);
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

  // Create Employee Handler
  const handleCreateEmployee = async () => {
    if (!newEmp.name.trim() || !newEmp.email.trim() || !newEmp.phone.trim()) {
      Alert.alert('Required Fields Missing', 'Please fill in Employee Name, Email, and Phone Number.');
      return;
    }
    try {
      setCreatingEmp(true);
      const payload = {
        name: newEmp.name.trim(),
        email: newEmp.email.toLowerCase().trim(),
        password: newEmp.password || '111111',
        phone: newEmp.phone.trim(),
        department: newEmp.department || 'Field Sales',
        designation: newEmp.designation || 'Field Executive',
        salary: newEmp.salary ? Number(newEmp.salary) : 18000,
        managerId: newEmp.managerId || null,
        role: 'EMPLOYEE',
      };
      const res = await adminAPI.createEmployee(payload);
      if (res.data?.success) {
        Alert.alert('Employee Created 🎉', `Employee ${newEmp.name} created successfully!\nCredentials sent to ${newEmp.email}`);
        setAddEmpModalVisible(false);
        setNewEmp({ name: '', email: '', password: '111111', phone: '', department: 'Field Sales', designation: 'Field Executive', salary: '18000', managerId: '' });
        fetchData();
      } else {
        Alert.alert('Creation Failed', res.data?.message || 'Failed to create employee account.');
      }
    } catch (err) {
      Alert.alert('Quota / Limit Error', err.response?.data?.message || err.message || 'Error creating employee.');
    } finally {
      setCreatingEmp(false);
    }
  };

  // Create Manager Handler
  const handleCreateManager = async () => {
    if (!newMgr.name.trim() || !newMgr.email.trim() || !newMgr.phone.trim()) {
      Alert.alert('Required Fields Missing', 'Please fill in Manager Name, Email, and Phone Number.');
      return;
    }
    try {
      setCreatingMgr(true);
      const payload = {
        name: newMgr.name.trim(),
        email: newMgr.email.toLowerCase().trim(),
        password: newMgr.password || '111111',
        phone: newMgr.phone.trim(),
        department: newMgr.department || 'Field Operations',
        designation: newMgr.designation || 'Area Manager',
        salary: newMgr.salary ? Number(newMgr.salary) : 28000,
        role: 'MANAGER',
      };
      const res = await adminAPI.createManager(payload);
      if (res.data?.success) {
        Alert.alert('Manager Created 🎉', `Manager ${newMgr.name} created successfully!\nCredentials sent to ${newMgr.email}`);
        setAddMgrModalVisible(false);
        setNewMgr({ name: '', email: '', password: '111111', phone: '', department: 'Field Operations', designation: 'Area Manager', salary: '28000' });
        fetchData();
      } else {
        Alert.alert('Creation Failed', res.data?.message || 'Failed to create manager account.');
      }
    } catch (err) {
      Alert.alert('Quota / Limit Error', err.response?.data?.message || err.message || 'Error creating manager.');
    } finally {
      setCreatingMgr(false);
    }
  };

  const totalEmp = stats?.totalEmployees ?? (employees.length || 0);
  const presentCount = employees.length > 0
    ? employees.filter(e => e.isOnline || e.isTracking || liveLocations.some(l => (l.employeeId || l.employee || l._id) === e._id)).length
    : (stats?.todayAttendance ?? 0);
  const liveCount = liveLocations.length || (stats?.trackingNow ?? 0);
  const attendanceRate = totalEmp > 0 ? Math.round((presentCount / totalEmp) * 100) : 0;
  const absentCount = stats?.absentEmployees ?? Math.max(0, totalEmp - presentCount);
  const lateCount = stats?.lateEmployees ?? Math.max(0, Math.floor(presentCount * 0.05));
  const pendingApprovals = stats?.pendingExpenses ?? stats?.pendingLeaves ?? stats?.pendingApprovals ?? 0;

  const goTo = (path) => {
    setSideMenuVisible(false);
    setProfileMenuVisible(false);
    router.push(path);
  };

  const handleLogout = () => {
    setProfileMenuVisible(false);
    setSideMenuVisible(false);
    Alert.alert(
      'Logout Confirm Karein',
      'Kya aap sach mein KisanConnect se logout karna chahte hain?',
      [
        { text: 'Ruk Jao', style: 'cancel' },
        {
          text: 'Haan, Logout',
          style: 'destructive',
          onPress: async () => {
            try { stopHeartbeat(); } catch (_) {}
            logout();
          },
        },
      ]
    );
  };

  const handleCall = (phone) => {
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  const handleWhatsApp = (phone) => {
    if (phone) Linking.openURL(`https://wa.me/${phone.replace(/[^0-9]/g, '')}`);
  };

  const getUserInitials = (name) => {
    if (!name) return 'KC';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: BG_COLOR }]}>
        <ActivityIndicator size="large" color="#0284c7" />
        <Text style={styles.loadingText}>Loading KisanConnect Operations…</Text>
      </View>
    );
  }

  // Filter employees scoped strictly by userOrgId
  const userOrgId = String(user?.organizationId?._id || user?.organizationId || user?.organization || '');
  const staffOnly = employees.filter(e => {
    const r = (e.role || '').toUpperCase();
    const isNotAdmin = r !== 'SUPER_ADMIN' && r !== 'SUPERADMIN' && r !== 'ORG_ADMIN' && r !== 'ORGADMIN';
    const empOrgId = String(e.organizationId?._id || e.organizationId || e.organization || '');
    if (userOrgId && empOrgId && userOrgId !== empOrgId) return false;
    return isNotAdmin;
  });

  const sortedEmployees = [...staffOnly].sort((a, b) => {
    const aLive = a.isTracking || a.isOnline || liveLocations.some(l => (l.employeeId || l.employee || l._id) === a._id);
    const bLive = b.isTracking || b.isOnline || liveLocations.some(l => (l.employeeId || l.employee || l._id) === b._id);
    if (aLive && !bLive) return -1;
    if (!aLive && bLive) return 1;
    return 0;
  });

  const realActivities = sortedEmployees.map((e) => {
    const isLive = e.isTracking || e.isOnline || liveLocations.some(l => (l.employeeId || l.employee || l._id) === e._id);
    return {
      ...e,
      status: isLive ? 'Tracking Active' : 'Offline',
      sub: e.department ? `${e.department} • Field Executive` : 'Field Executive',
      time: e.lastCheckIn ? new Date(e.lastCheckIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '09:00 AM'
    };
  });

  const filteredActivities = realActivities.filter((act) => {
    const isLive = act.status === 'Tracking Active' || act.isTracking || act.isOnline;
    if (filterTab === 'LIVE' && !isLive) return false;
    if (filterTab === 'OFFLINE' && isLive) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const nameMatch = (act.name || '').toLowerCase().includes(q);
      const phoneMatch = (act.phone || '').toLowerCase().includes(q);
      const deptMatch = (act.sub || act.department || '').toLowerCase().includes(q);
      return nameMatch || phoneMatch || deptMatch;
    }
    return true;
  });

  const orgLogoUrl = getAvatarUrl(organization?.logo || user?.organizationLogo || user?.organizationId?.logo || user?.organization?.logo);
  const orgName = organization?.name || user?.organizationName || user?.organizationId?.name || 'Kisan Choice Pvt Ltd';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#074e26" />

      {/* EXECUTIVE ULTRA-PROFESSIONAL HEADER */}
      <LinearGradient
        colors={['#074e26', '#065a29']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <SafeAreaView edges={['top']}>
          {/* Top Navigation Row */}
          <View style={styles.topNav}>
            <TouchableOpacity style={styles.navCircleBtn} onPress={() => setSideMenuVisible(true)} activeOpacity={0.7}>
              <Menu size={20} color="#f8fafc" />
            </TouchableOpacity>

            <View style={styles.brandContainer}>
              <View style={styles.logoBadge}>
                <Image
                  source={require('../../assets/splash.png')}
                  style={styles.navbarAppIcon}
                  resizeMode="contain"
                />
              </View>
              <View>
                <Text style={styles.appName}>KisanConnect</Text>
                <Text style={styles.appTag}>{isSuperAdmin ? 'SUPER ADMIN CONSOLE' : 'ORGANIZATION CONSOLE'}</Text>
              </View>
            </View>

            <View style={styles.topNavRight}>
              <TouchableOpacity style={styles.navCircleBtn} activeOpacity={0.7}>
                <View style={styles.bellWrap}>
                  <Bell size={19} color="#f8fafc" />
                  <View style={styles.badgeDot}>
                    <Text style={styles.badgeNum}>2</Text>
                  </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setProfileMenuVisible(true)} activeOpacity={0.8}>
                {getAvatarUrl(user?.avatar) ? (
                  <Image source={{ uri: getAvatarUrl(user?.avatar) }} style={styles.profileAvatarImg} resizeMode="cover" />
                ) : (
                  <View style={styles.profileAvatar}>
                    <Text style={styles.profileAvatarText}>{getUserInitials(user?.name || 'KC')}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Interactive Company Card Pill — Opens Profile Dropdown */}
          <TouchableOpacity onPress={() => setProfileMenuVisible(true)} activeOpacity={0.88}>
            <Surface style={[styles.companyCardPill, cardShadow]} elevation={3}>
              <View style={styles.companyLogoBox}>
                {orgLogoUrl ? (
                  <Image source={{ uri: orgLogoUrl }} style={styles.orgLogoImg} resizeMode="contain" />
                ) : (
                  <Building2 size={22} color="#059669" />
                )}
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={styles.companyNameText} numberOfLines={1}>{orgName}</Text>
                  <View style={styles.chevronPill}>
                    <ChevronDown size={16} color="#475569" />
                  </View>
                </View>
                <Text style={styles.companySubText}>
                  {isSuperAdmin ? 'Super Admin Executive • Tap to manage' : 'Organization Administrator • Tap to edit'}
                </Text>
              </View>
            </Surface>
          </TouchableOpacity>

        </SafeAreaView>
      </LinearGradient>

      {/* DASHBOARD CONTENT BODY */}
      <ScrollView
        style={styles.bodyScroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#10b981']} />}
      >
        {/* COMPANY PULSE KPI GRID */}
        <Surface style={[styles.sectionCard, cardShadow]} elevation={1}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Activity size={18} color="#059669" />
              <Text style={styles.cardSectionTitle}>Company Pulse</Text>
            </View>
          </View>

          <View style={styles.kpiGridRow}>
            {/* Performance Ring Chart Box */}
            <View style={styles.ringCardBox}>
              <View style={styles.ringGraphicOuter}>
                <View style={styles.ringGraphicInner}>
                  <Text style={styles.ringPercentText}>{attendanceRate}%</Text>
                </View>
              </View>
              <Text style={styles.ringLabelTitle}>Overall Performance</Text>
              <Text style={styles.ringSubTrend}>↑ 12% vs last month</Text>
            </View>

            {/* 2x2 Metric Quadrant */}
            <View style={styles.metricsQuadrant}>
              {/* Row 1 */}
              <View style={styles.metricPairRow}>
                <View style={styles.miniMetricBox}>
                  <View style={styles.miniHeader}>
                    <Users size={14} color="#64748b" />
                    <Text style={styles.miniTitle}>Total..</Text>
                  </View>
                  <Text style={styles.miniValueNum}>{totalEmp}</Text>
                  <Text style={styles.miniTrendUp}>↑ 12%</Text>
                </View>

                <View style={styles.miniMetricBox}>
                  <View style={styles.miniHeader}>
                    <CheckCircle2 size={14} color="#16a34a" />
                    <Text style={styles.miniTitle}>Present..</Text>
                  </View>
                  <Text style={styles.miniValueNum}>{presentCount}</Text>
                  <View style={styles.greenTagPill}>
                    <Text style={styles.greenTagText}>{attendanceRate}%</Text>
                  </View>
                </View>
              </View>

              {/* Row 2 */}
              <View style={styles.metricPairRow}>
                <View style={styles.miniMetricBox}>
                  <View style={styles.miniHeader}>
                    <Navigation size={14} color="#0284c7" />
                    <Text style={styles.miniTitle}>Live..</Text>
                  </View>
                  <Text style={styles.miniValueNum}>{liveCount}</Text>
                  <View style={styles.blueTagPill}>
                    <Text style={styles.blueTagText}>On Field</Text>
                  </View>
                </View>

                <View style={styles.miniMetricBox}>
                  <View style={styles.miniHeader}>
                    <AlertCircle size={14} color="#d97706" />
                    <Text style={styles.miniTitle}>Pending..</Text>
                  </View>
                  <Text style={styles.miniValueNum}>{pendingApprovals}</Text>
                  <View style={styles.roseTagPill}>
                    <Text style={styles.roseTagText}>Needs Approval</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </Surface>

        {/* TODAY'S ATTENDANCE BREAKDOWN */}
        <Surface style={[styles.sectionCard, cardShadow]} elevation={1}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardSectionTitle}>Today's Attendance</Text>
            <TouchableOpacity onPress={() => goTo('/(admin)/history')}>
              <Text style={styles.linkText}>View All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.attendanceProgressGroup}>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressFillPresent, { width: `${attendanceRate}%` }]} />
              <View style={[styles.progressFillAbsent, { width: `${100 - attendanceRate}%` }]} />
            </View>
            <View style={styles.progressLegendRow}>
              <View style={styles.legendDotItem}>
                <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
                <Text style={styles.legendLabel}>Present ({presentCount})</Text>
              </View>

              <View style={styles.legendDotItem}>
                <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
                <Text style={styles.legendLabel}>Absent ({absentCount})</Text>
              </View>

              <View style={styles.legendDotItem}>
                <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
                <Text style={styles.legendLabel}>Late ({lateCount})</Text>
              </View>
            </View>
          </View>
        </Surface>

        {/* QUICK ACTIONS GRID */}
        <Surface style={[styles.sectionCard, cardShadow]} elevation={1}>
          <Text style={styles.cardSectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity style={styles.quickCardBtn} onPress={() => setAddEmpModalVisible(true)} activeOpacity={0.8}>
              <View style={[styles.quickIconBox, { backgroundColor: '#e0f2fe' }]}>
                <UserPlus size={18} color="#0284c7" />
              </View>
              <Text style={styles.quickBtnTitle}>Add Employee</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickCardBtn} onPress={() => setAddMgrModalVisible(true)} activeOpacity={0.8}>
              <View style={[styles.quickIconBox, { backgroundColor: '#ecfdf5' }]}>
                <UserCheck size={18} color="#10b981" />
              </View>
              <Text style={styles.quickBtnTitle}>Add Manager</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickCardBtn} onPress={() => goTo('/(admin)/tracking')} activeOpacity={0.8}>
              <View style={[styles.quickIconBox, { backgroundColor: '#f3e8ff' }]}>
                <MapPin size={18} color="#9333ea" />
              </View>
              <Text style={styles.quickBtnTitle}>Live Tracking</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickCardBtn} onPress={() => goTo('/(admin)/reports')} activeOpacity={0.8}>
              <View style={[styles.quickIconBox, { backgroundColor: '#fef3c7' }]}>
                <FileText size={18} color="#d97706" />
              </View>
              <Text style={styles.quickBtnTitle}>Generate Report</Text>
            </TouchableOpacity>
          </View>
        </Surface>

        {/* FIELD WORKFORCE ROSTER & ACTIVITY */}
        <Surface style={[styles.sectionCard, cardShadow, { marginBottom: 90 }]} elevation={1}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.cardSectionTitle}>Field Workforce Roster</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{staffOnly.length}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => goTo('/(admin)/monitoring')}>
              <Text style={styles.linkText}>View All</Text>
            </TouchableOpacity>
          </View>

          {/* Search Bar & Filters */}
          <View style={styles.searchFilterWrap}>
            <View style={styles.searchBar}>
              <Search size={16} color="#64748b" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search staff by name, phone, dept..."
                placeholderTextColor="#94a3b8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={16} color="#64748b" />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.filterPillsRow}>
              <TouchableOpacity
                style={[styles.filterPill, filterTab === 'ALL' && styles.filterPillActive]}
                onPress={() => setFilterTab('ALL')}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterPillText, filterTab === 'ALL' && styles.filterPillTextActive]}>
                  All ({staffOnly.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterPill, filterTab === 'LIVE' && styles.filterPillActiveLive]}
                onPress={() => setFilterTab('LIVE')}
                activeOpacity={0.8}
              >
                <View style={[styles.livePulseDot, { width: 6, height: 6, marginRight: 4 }]} />
                <Text style={[styles.filterPillText, filterTab === 'LIVE' && styles.filterPillTextLiveActive]}>
                  Live Tracking ({staffOnly.filter(e => e.isTracking || e.isOnline || liveLocations.some(l => (l.employeeId || l.employee || l._id) === e._id)).length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterPill, filterTab === 'OFFLINE' && styles.filterPillActive]}
                onPress={() => setFilterTab('OFFLINE')}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterPillText, filterTab === 'OFFLINE' && styles.filterPillTextActive]}>
                  Offline ({staffOnly.filter(e => !e.isTracking && !e.isOnline && !liveLocations.some(l => (l.employeeId || l.employee || l._id) === e._id)).length})
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Roster Cards List */}
          {filteredActivities.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No field staff matches current filter.</Text>
            </View>
          ) : (
            filteredActivities.map((emp) => {
              const isLive = emp.status === 'Tracking Active' || emp.isTracking || emp.isOnline;
              return (
                <View key={emp._id} style={styles.rosterCardItem}>
                  <View style={styles.rosterLeft}>
                    <View style={styles.avatarWrap}>
                      {getAvatarUrl(emp.avatar) ? (
                        <Image source={{ uri: getAvatarUrl(emp.avatar) }} style={styles.empAvatarImg} />
                      ) : (
                        <View style={styles.avatarFallback}>
                          <Text style={styles.avatarFallbackText}>{getUserInitials(emp.name)}</Text>
                        </View>
                      )}
                      <View style={[styles.statusDot, { backgroundColor: isLive ? '#10b981' : '#94a3b8' }]} />
                    </View>

                    <View style={styles.empInfoCol}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.empNameText} numberOfLines={1}>{emp.name}</Text>
                        {isLive && (
                          <View style={styles.livePulsePill}>
                            <View style={styles.livePulseDot} />
                            <Text style={styles.livePulseText}>LIVE</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.empSubText}>{emp.sub}</Text>
                      <Text style={styles.empTimeText}>Last Ping: {emp.time}</Text>
                    </View>
                  </View>

                  <View style={styles.rosterActions}>
                    <TouchableOpacity style={styles.actionIconBtn} onPress={() => goTo(`/(admin)/tracking?employeeId=${emp._id}`)}>
                      <Navigation size={15} color="#0284c7" />
                    </TouchableOpacity>
                    {emp.phone && (
                      <TouchableOpacity style={styles.actionIconBtn} onPress={() => handleCall(emp.phone)}>
                        <Phone size={15} color="#16a34a" />
                      </TouchableOpacity>
                    )}
                    {emp.phone && (
                      <TouchableOpacity style={styles.actionIconBtn} onPress={() => handleWhatsApp(emp.phone)}>
                        <MessageSquare size={15} color="#25d366" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </Surface>
      </ScrollView>

      {/* ── FLOATING BOTTOM TAB BAR (UI/UX PRO MAX) ────────────────────── */}
      <View style={styles.bottomTabBarContainer}>
        <Surface style={styles.bottomTabBarSurface} elevation={5}>
          {/* Tab 1: Home */}
          <TouchableOpacity style={styles.tabBarItem} onPress={() => goTo('/(admin)/dashboard')} activeOpacity={0.7}>
            <View style={[styles.tabBarIconBox, styles.tabBarIconBoxActive]}>
              <LayoutDashboard size={20} color="#10b981" />
            </View>
            <Text style={[styles.tabBarLabel, styles.tabBarLabelActive]}>Home</Text>
            <View style={styles.activeTabDot} />
          </TouchableOpacity>

          {/* Tab 2: Live Map */}
          <TouchableOpacity style={styles.tabBarItem} onPress={() => goTo('/(admin)/tracking')} activeOpacity={0.7}>
            <View style={styles.tabBarIconBox}>
              <MapPin size={20} color="#94a3b8" />
            </View>
            <Text style={styles.tabBarLabel}>Live Map</Text>
          </TouchableOpacity>

          {/* Tab 3: Workforce */}
          <TouchableOpacity style={styles.tabBarItem} onPress={() => goTo('/(admin)/monitoring')} activeOpacity={0.7}>
            <View style={styles.tabBarIconBox}>
              <Users size={20} color="#94a3b8" />
            </View>
            <Text style={styles.tabBarLabel}>Workforce</Text>
          </TouchableOpacity>

          {/* Tab 4: Reports */}
          <TouchableOpacity style={styles.tabBarItem} onPress={() => goTo('/(admin)/reports')} activeOpacity={0.7}>
            <View style={styles.tabBarIconBox}>
              <FileText size={20} color="#94a3b8" />
            </View>
            <Text style={styles.tabBarLabel}>Reports</Text>
          </TouchableOpacity>

          {/* Tab 5: Settings */}
          <TouchableOpacity style={styles.tabBarItem} onPress={() => goTo('/(admin)/settings')} activeOpacity={0.7}>
            <View style={styles.tabBarIconBox}>
              <Settings size={20} color="#94a3b8" />
            </View>
            <Text style={styles.tabBarLabel}>Settings</Text>
          </TouchableOpacity>
        </Surface>
      </View>

      {/* ── SIDE NAVIGATION DRAWER MODAL ───────────────────────────────────── */}
      <Modal
        visible={sideMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSideMenuVisible(false)}
      >
        <View style={styles.drawerOverlay}>
          <TouchableOpacity style={styles.drawerDismissArea} onPress={() => setSideMenuVisible(false)} />
          <View style={styles.drawerContainer}>
            <SafeAreaView style={{ flex: 1 }}>
              {/* Drawer User Header */}
              <View style={styles.drawerHeader}>
                <View style={styles.drawerBrandRow}>
                  <Image source={require('../../assets/splash.png')} style={styles.drawerLogoImg} resizeMode="contain" />
                  <View>
                    <Text style={styles.drawerBrandTitle}>KisanConnect</Text>
                    <Text style={styles.drawerBrandSub}>{isSuperAdmin ? 'SUPER ADMIN CONSOLE' : 'ORGANIZATION CONSOLE'}</Text>
                  </View>
                </View>

                <View style={styles.drawerUserBox}>
                  {getAvatarUrl(user?.avatar) ? (
                    <Image source={{ uri: getAvatarUrl(user?.avatar) }} style={styles.drawerUserAvatar} />
                  ) : (
                    <View style={styles.drawerUserAvatarFallback}>
                      <Text style={styles.drawerUserAvatarText}>{getUserInitials(user?.name)}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.drawerUserName} numberOfLines={1}>{user?.name || 'Admin'}</Text>
                    <Text style={styles.drawerUserEmail} numberOfLines={1}>{user?.email || ''}</Text>
                    <View style={styles.drawerBadgeRow}>
                      <Building2 size={11} color="#34d399" />
                      <Text style={styles.drawerOrgText} numberOfLines={1}>{orgName}</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Drawer Menu List */}
              <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }} showsVerticalScrollIndicator={false}>
                <Text style={styles.drawerMenuSectionHeader}>NAVIGATION MENU</Text>

                <TouchableOpacity style={[styles.drawerMenuItem, styles.drawerMenuItemActive]} onPress={() => goTo('/(admin)/dashboard')}>
                  <LayoutDashboard size={18} color="#34d399" />
                  <Text style={[styles.drawerMenuText, styles.drawerMenuTextActive]}>Executive Dashboard</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.drawerMenuItem} onPress={() => goTo('/(admin)/tracking')}>
                  <MapPin size={18} color="#94a3b8" />
                  <Text style={styles.drawerMenuText}>Live Map Tracking</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.drawerMenuItem} onPress={() => goTo('/(admin)/monitoring')}>
                  <Users size={18} color="#94a3b8" />
                  <Text style={styles.drawerMenuText}>Field Workforce</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.drawerMenuItem} onPress={() => goTo('/(admin)/team')}>
                  <UserCheck size={18} color="#94a3b8" />
                  <Text style={styles.drawerMenuText}>Managers Roster</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.drawerMenuItem} onPress={() => goTo('/(admin)/history')}>
                  <Clock size={18} color="#94a3b8" />
                  <Text style={styles.drawerMenuText}>Attendance & History</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.drawerMenuItem} onPress={() => goTo('/(admin)/reports')}>
                  <FileText size={18} color="#94a3b8" />
                  <Text style={styles.drawerMenuText}>Reports & Analytics</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.drawerMenuItem} onPress={() => goTo('/(admin)/settings')}>
                  <Settings size={18} color="#94a3b8" />
                  <Text style={styles.drawerMenuText}>Settings & Subscription</Text>
                </TouchableOpacity>
              </ScrollView>

              {/* Drawer Footer Logout */}
              <View style={styles.drawerFooter}>
                <TouchableOpacity style={styles.drawerLogoutBtn} onPress={handleLogout}>
                  <LogOut size={18} color="#ef4444" />
                  <Text style={styles.drawerLogoutText}>Logout Session</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </View>
        </View>
      </Modal>

      {/* ── PROFILE DROPDOWN BOTTOM SHEET MODAL ──────────────────────────── */}
      <Modal
        visible={profileMenuVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setProfileMenuVisible(false)}
      >
        <TouchableOpacity style={styles.profileModalOverlay} activeOpacity={1} onPress={() => setProfileMenuVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.profileSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.profileSheetHeader}>
              <View style={styles.profileSheetAvatarWrap}>
                {getAvatarUrl(user?.avatar) ? (
                  <Image source={{ uri: getAvatarUrl(user?.avatar) }} style={styles.profileSheetAvatar} resizeMode="cover" />
                ) : (
                  <View style={[styles.profileSheetAvatar, styles.profileSheetAvatarFallback]}>
                    <Text style={styles.profileSheetAvatarText}>{getUserInitials(user?.name)}</Text>
                  </View>
                )}
                <View style={styles.onlineDot} />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.profileSheetName} numberOfLines={1}>{user?.name || 'Organization Admin'}</Text>
                <Text style={styles.profileSheetEmail} numberOfLines={1}>{user?.email || ''}</Text>
                <View style={styles.roleBadge}>
                  <ShieldCheck size={10} color="#059669" />
                  <Text style={styles.roleBadgeText}>{userRole}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setProfileMenuVisible(false)} style={styles.sheetCloseBtn}>
                <X size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>
            <View style={styles.sheetDivider} />
            <View style={styles.profileMenuList}>
              <TouchableOpacity style={styles.profileMenuItem} onPress={() => { setProfileMenuVisible(false); goTo('/(admin)/profile'); }}>
                <View style={[styles.menuItemIconBox, { backgroundColor: '#eff6ff' }]}>
                  <User size={18} color="#3b82f6" />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={styles.menuItemLabel}>Profile</Text>
                  <Text style={styles.menuItemSub}>Account details & avatar</Text>
                </View>
                <ChevronRight size={16} color="#cbd5e1" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.profileMenuItem} onPress={() => { setProfileMenuVisible(false); goTo('/(admin)/settings'); }}>
                <View style={[styles.menuItemIconBox, { backgroundColor: '#f0fdf4' }]}>
                  <Settings size={18} color="#16a34a" />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={styles.menuItemLabel}>Settings</Text>
                  <Text style={styles.menuItemSub}>App preferences & notifications</Text>
                </View>
                <ChevronRight size={16} color="#cbd5e1" />
              </TouchableOpacity>
              <View style={[styles.sheetDivider, { marginVertical: 8 }]} />
              <TouchableOpacity style={[styles.profileMenuItem, styles.logoutMenuItem]} onPress={handleLogout}>
                <View style={[styles.menuItemIconBox, { backgroundColor: '#fef2f2' }]}>
                  <LogOut size={18} color="#ef4444" />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={[styles.menuItemLabel, { color: '#ef4444' }]}>Logout</Text>
                  <Text style={styles.menuItemSub}>End current session</Text>
                </View>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── ADD EMPLOYEE MODAL FORM ────────────────────────────────────────── */}
      <Modal
        visible={addEmpModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddEmpModalVisible(false)}
      >
        <TouchableOpacity style={styles.profileModalOverlay} activeOpacity={1} onPress={() => setAddEmpModalVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.formSheetModal}>
            <View style={styles.sheetHandle} />
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.modalHeaderIconBox}>
                  <UserPlus size={20} color="#34d399" />
                </View>
                <Text style={styles.modalHeaderTitle}>Create New Employee</Text>
              </View>
              <TouchableOpacity onPress={() => setAddEmpModalVisible(false)}>
                <X size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: height * 0.65 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.formInputLabel}>Full Name *</Text>
              <TextInput
                style={styles.formInputText}
                placeholder="e.g. Rahul Sharma"
                placeholderTextColor="#64748b"
                value={newEmp.name}
                onChangeText={(val) => setNewEmp((p) => ({ ...p, name: val }))}
              />

              <Text style={styles.formInputLabel}>Email Address *</Text>
              <TextInput
                style={styles.formInputText}
                placeholder="e.g. rahul@company.com"
                placeholderTextColor="#64748b"
                keyboardType="email-address"
                autoCapitalize="none"
                value={newEmp.email}
                onChangeText={(val) => setNewEmp((p) => ({ ...p, email: val }))}
              />

              <Text style={styles.formInputLabel}>Phone Number *</Text>
              <TextInput
                style={styles.formInputText}
                placeholder="e.g. 9876543210"
                placeholderTextColor="#64748b"
                keyboardType="phone-pad"
                value={newEmp.phone}
                onChangeText={(val) => setNewEmp((p) => ({ ...p, phone: val }))}
              />

              <Text style={styles.formInputLabel}>Department</Text>
              <TextInput
                style={styles.formInputText}
                placeholder="Field Sales / Operations / Services"
                placeholderTextColor="#64748b"
                value={newEmp.department}
                onChangeText={(val) => setNewEmp((p) => ({ ...p, department: val }))}
              />

              <Text style={styles.formInputLabel}>Designation</Text>
              <TextInput
                style={styles.formInputText}
                placeholder="Field Executive / Sales Officer"
                placeholderTextColor="#64748b"
                value={newEmp.designation}
                onChangeText={(val) => setNewEmp((p) => ({ ...p, designation: val }))}
              />

              <Text style={styles.formInputLabel}>Monthly Salary (₹)</Text>
              <TextInput
                style={styles.formInputText}
                placeholder="18000"
                placeholderTextColor="#64748b"
                keyboardType="numeric"
                value={newEmp.salary}
                onChangeText={(val) => setNewEmp((p) => ({ ...p, salary: val }))}
              />
            </ScrollView>

            <TouchableOpacity style={styles.submitFormBtn} onPress={handleCreateEmployee} disabled={creatingEmp}>
              {creatingEmp ? (
                <ActivityIndicator size="small" color="#0f172a" />
              ) : (
                <Text style={styles.submitFormBtnText}>Create Employee Account</Text>
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── ADD MANAGER MODAL FORM ────────────────────────────────────────── */}
      <Modal
        visible={addMgrModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddMgrModalVisible(false)}
      >
        <TouchableOpacity style={styles.profileModalOverlay} activeOpacity={1} onPress={() => setAddMgrModalVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.formSheetModal}>
            <View style={styles.sheetHandle} />
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[styles.modalHeaderIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
                  <UserCheck size={20} color="#10b981" />
                </View>
                <Text style={styles.modalHeaderTitle}>Create New Manager</Text>
              </View>
              <TouchableOpacity onPress={() => setAddMgrModalVisible(false)}>
                <X size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: height * 0.65 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.formInputLabel}>Full Name *</Text>
              <TextInput
                style={styles.formInputText}
                placeholder="e.g. Vikram Singh"
                placeholderTextColor="#64748b"
                value={newMgr.name}
                onChangeText={(val) => setNewMgr((p) => ({ ...p, name: val }))}
              />

              <Text style={styles.formInputLabel}>Email Address *</Text>
              <TextInput
                style={styles.formInputText}
                placeholder="e.g. vikram@company.com"
                placeholderTextColor="#64748b"
                keyboardType="email-address"
                autoCapitalize="none"
                value={newMgr.email}
                onChangeText={(val) => setNewMgr((p) => ({ ...p, email: val }))}
              />

              <Text style={styles.formInputLabel}>Phone Number *</Text>
              <TextInput
                style={styles.formInputText}
                placeholder="e.g. 9876543210"
                placeholderTextColor="#64748b"
                keyboardType="phone-pad"
                value={newMgr.phone}
                onChangeText={(val) => setNewMgr((p) => ({ ...p, phone: val }))}
              />

              <Text style={styles.formInputLabel}>Department</Text>
              <TextInput
                style={styles.formInputText}
                placeholder="Field Operations / Zonal Management"
                placeholderTextColor="#64748b"
                value={newMgr.department}
                onChangeText={(val) => setNewMgr((p) => ({ ...p, department: val }))}
              />

              <Text style={styles.formInputLabel}>Designation</Text>
              <TextInput
                style={styles.formInputText}
                placeholder="Area Manager / Operations Lead"
                placeholderTextColor="#64748b"
                value={newMgr.designation}
                onChangeText={(val) => setNewMgr((p) => ({ ...p, designation: val }))}
              />

              <Text style={styles.formInputLabel}>Monthly Salary (₹)</Text>
              <TextInput
                style={styles.formInputText}
                placeholder="28000"
                placeholderTextColor="#64748b"
                keyboardType="numeric"
                value={newMgr.salary}
                onChangeText={(val) => setNewMgr((p) => ({ ...p, salary: val }))}
              />
            </ScrollView>

            <TouchableOpacity style={styles.submitFormBtn} onPress={handleCreateManager} disabled={creatingMgr}>
              {creatingMgr ? (
                <ActivityIndicator size="small" color="#0f172a" />
              ) : (
                <Text style={styles.submitFormBtnText}>Create Manager Account</Text>
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG_COLOR },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 13, color: '#475569', fontWeight: '600' },
  headerGradient: { paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 20 : 0, paddingBottom: 20 },
  topNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  navCircleBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center' },
  brandContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBadge: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#ffffff', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', padding: 2 },
  navbarAppIcon: { width: '100%', height: '100%', borderRadius: 8 },
  appName: { color: '#ffffff', fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },
  appTag: { color: '#a7f3d0', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  topNavRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bellWrap: { position: 'relative' },
  badgeDot: { position: 'absolute', top: -4, right: -4, backgroundColor: '#ef4444', borderRadius: 8, paddingHorizontal: 4, paddingVertical: 1 },
  badgeNum: { color: '#fff', fontSize: 9, fontWeight: '800' },
  profileAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#34d399' },
  profileAvatarImg: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: '#34d399' },
  profileAvatarText: { color: '#34d399', fontSize: 13, fontWeight: '800' },
  companyCardPill: { marginHorizontal: 16, marginTop: 10, backgroundColor: '#ffffff', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center' },
  companyLogoBox: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#f0fdf4', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  orgLogoImg: { width: 32, height: 32 },
  companyNameText: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  chevronPill: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  companySubText: { fontSize: 11, color: '#64748b', fontWeight: '500', marginTop: 2 },
  bodyScroll: { flex: 1, backgroundColor: BG_COLOR },
  scrollContent: { padding: 16 },
  sectionCard: { backgroundColor: '#ffffff', borderRadius: 20, padding: 16, marginBottom: 16 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardSectionTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  linkText: { fontSize: 12, fontWeight: '700', color: '#0284c7' },
  kpiGridRow: { flexDirection: 'row', gap: 12 },
  ringCardBox: { width: '38%', backgroundColor: '#f8fafc', borderRadius: 16, padding: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#f1f5f9' },
  ringGraphicOuter: { width: 80, height: 80, borderRadius: 40, borderWidth: 7, borderColor: '#10b981', justifyContent: 'center', alignItems: 'center' },
  ringGraphicInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#ffffff', justifyContent: 'center', alignItems: 'center' },
  ringPercentText: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
  ringLabelTitle: { fontSize: 11, fontWeight: '700', color: '#475569', marginTop: 8, textAlign: 'center' },
  ringSubTrend: { fontSize: 9, fontWeight: '700', color: '#059669', marginTop: 2 },
  metricsQuadrant: { flex: 1, gap: 8 },
  metricPairRow: { flexDirection: 'row', gap: 8 },
  miniMetricBox: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#f1f5f9' },
  miniHeader: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  miniTitle: { fontSize: 10, fontWeight: '700', color: '#64748b' },
  miniValueNum: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginVertical: 2 },
  miniTrendUp: { fontSize: 9, fontWeight: '700', color: '#059669' },
  greenTagPill: { backgroundColor: '#dcfce7', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, selfAlign: 'flex-start' },
  greenTagText: { color: '#16a34a', fontSize: 9, fontWeight: '700' },
  blueTagPill: { backgroundColor: '#e0f2fe', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 },
  blueTagText: { color: '#0284c7', fontSize: 9, fontWeight: '700' },
  roseTagPill: { backgroundColor: '#ffe4e6', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 },
  roseTagText: { color: '#e11d48', fontSize: 8, fontWeight: '700' },
  attendanceProgressGroup: { marginTop: 4 },
  progressBarBg: { height: 10, backgroundColor: '#f1f5f9', borderRadius: 5, flexDirection: 'row', overflow: 'hidden' },
  progressFillPresent: { backgroundColor: '#10b981', height: '100%' },
  progressFillAbsent: { backgroundColor: '#ef4444', height: '100%' },
  progressLegendRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  legendDotItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 11, fontWeight: '600', color: '#475569' },
  quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  quickCardBtn: { width: '48%', backgroundColor: '#f8fafc', borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#f1f5f9' },
  quickIconBox: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  quickBtnTitle: { fontSize: 12, fontWeight: '700', color: '#0f172a' },
  countBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  countBadgeText: { fontSize: 11, fontWeight: '800', color: '#0f172a' },
  searchFilterWrap: { gap: 10, marginBottom: 12 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 12, paddingHorizontal: 12, height: 40, borderWidth: 1, borderColor: '#e2e8f0' },
  searchInput: { flex: 1, fontSize: 12, color: '#0f172a' },
  filterPillsRow: { flexDirection: 'row', gap: 6 },
  filterPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f1f5f9' },
  filterPillActive: { backgroundColor: '#0f172a' },
  filterPillActiveLive: { backgroundColor: '#064e3b' },
  filterPillText: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  filterPillTextActive: { color: '#ffffff' },
  filterPillTextLiveActive: { color: '#a7f3d0' },
  livePulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
  rosterCardItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#f1f5f9' },
  rosterLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatarWrap: { position: 'relative' },
  empAvatarImg: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center' },
  avatarFallbackText: { color: '#34d399', fontSize: 13, fontWeight: '800' },
  statusDot: { position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#ffffff' },
  empInfoCol: { flex: 1 },
  empNameText: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
  livePulsePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#dcfce7', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 },
  livePulseText: { fontSize: 8, fontWeight: '800', color: '#16a34a' },
  empSubText: { fontSize: 10, color: '#64748b', marginTop: 1 },
  empTimeText: { fontSize: 9, color: '#94a3b8', marginTop: 2 },
  rosterActions: { flexDirection: 'row', gap: 6 },
  actionIconBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#ffffff', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  emptyWrap: { padding: 20, alignItems: 'center' },
  emptyText: { color: '#94a3b8', fontSize: 12 },

  /* FLOATING BOTTOM TAB BAR STYLES */
  bottomTabBarContainer: { position: 'absolute', bottom: 12, left: 16, right: 16 },
  bottomTabBarSurface: { backgroundColor: '#0f172a', borderRadius: 24, paddingVertical: 8, paddingHorizontal: 12, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  tabBarItem: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  tabBarIconBox: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  tabBarIconBoxActive: { backgroundColor: 'rgba(16, 185, 129, 0.15)' },
  tabBarLabel: { fontSize: 10, fontWeight: '600', color: '#94a3b8', marginTop: 2 },
  tabBarLabelActive: { color: '#34d399', fontWeight: '800' },
  activeTabDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#34d399', marginTop: 2 },

  /* SIDE DRAWER MODAL STYLES */
  drawerOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', flexDirection: 'row' },
  drawerDismissArea: { flex: 1 },
  drawerContainer: { width: width * 0.82, backgroundColor: '#0f172a', height: '100%' },
  drawerHeader: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  drawerBrandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  drawerLogoImg: { width: 36, height: 36, borderRadius: 8 },
  drawerBrandTitle: { color: '#ffffff', fontSize: 18, fontWeight: '800' },
  drawerBrandSub: { color: '#34d399', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  drawerUserBox: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1e293b', borderRadius: 16, padding: 12 },
  drawerUserAvatar: { width: 44, height: 44, borderRadius: 22 },
  drawerUserAvatarFallback: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center' },
  drawerUserAvatarText: { color: '#34d399', fontSize: 15, fontWeight: '800' },
  drawerUserName: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  drawerUserEmail: { color: '#94a3b8', fontSize: 11, marginTop: 1 },
  drawerBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  drawerOrgText: { color: '#34d399', fontSize: 10, fontWeight: '700' },
  drawerMenuSectionHeader: { color: '#64748b', fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginBottom: 12 },
  drawerMenuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, marginBottom: 4 },
  drawerMenuItemActive: { backgroundColor: 'rgba(52, 211, 153, 0.12)' },
  drawerMenuText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  drawerMenuTextActive: { color: '#34d399', fontWeight: '800' },
  drawerFooter: { padding: 16, borderTopWidth: 1, borderTopColor: '#1e293b' },
  drawerLogoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: 'rgba(239, 68, 68, 0.12)', paddingVertical: 12, borderRadius: 12 },
  drawerLogoutText: { color: '#ef4444', fontSize: 13, fontWeight: '800' },

  /* PROFILE SHEET & FORM MODAL STYLES */
  profileModalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
  profileSheet: { backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#cbd5e1', alignSelf: 'center', marginBottom: 16 },
  profileSheetHeader: { flexDirection: 'row', alignItems: 'center' },
  profileSheetAvatarWrap: { position: 'relative' },
  profileSheetAvatar: { width: 50, height: 50, borderRadius: 25 },
  profileSheetAvatarFallback: { backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center' },
  profileSheetAvatarText: { color: '#34d399', fontSize: 18, fontWeight: '800' },
  onlineDot: { position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, borderRadius: 6, backgroundColor: '#10b981', borderWidth: 2, borderColor: '#ffffff' },
  profileSheetName: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  profileSheetEmail: { fontSize: 12, color: '#64748b', marginTop: 1 },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f0fdf4', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start', marginTop: 4 },
  roleBadgeText: { color: '#059669', fontSize: 9, fontWeight: '800' },
  sheetCloseBtn: { padding: 4 },
  sheetDivider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 16 },
  profileMenuList: { gap: 4 },
  profileMenuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 12 },
  logoutMenuItem: { backgroundColor: '#fff5f5' },
  menuItemIconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  menuItemLabel: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  menuItemSub: { fontSize: 10, color: '#64748b', marginTop: 1 },

  /* FORM MODALS */
  formSheetModal: { backgroundColor: '#0f172a', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalHeaderIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(52, 211, 153, 0.2)', justifyContent: 'center', alignItems: 'center' },
  modalHeaderTitle: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  formInputLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '700', marginTop: 10, marginBottom: 4 },
  formInputText: { backgroundColor: '#1e293b', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: '#ffffff', fontSize: 13, borderWidth: 1, borderColor: '#334155' },
  submitFormBtn: { backgroundColor: '#34d399', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  submitFormBtnText: { color: '#0f172a', fontSize: 14, fontWeight: '800' },
});
