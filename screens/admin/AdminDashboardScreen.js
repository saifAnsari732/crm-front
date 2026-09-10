import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, View, ScrollView, TouchableOpacity,
  ActivityIndicator, Platform, RefreshControl, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Surface } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Menu, Leaf, Bell, ChevronDown, ChevronRight, Users, MapPin,
  Coffee, WifiOff, UserCheck, Bike, Activity, History, BarChart3,
  BriefcaseBusiness, CalendarDays, CalendarCheck, ReceiptText, FileText,
  ListChecks, LayoutGrid, ClipboardList, Home, Navigation, MoreHorizontal,
  Clock3, UserRound, CircleCheck, Radio,
} from 'lucide-react-native';
import MapViewComponent from '../../components/MapViewComponent';
import { adminAPI, trackingAPI, getAvatarUrl, taskAPI, expenseAPI, leaveAPI, meetingAPI } from '../../services/api';
import { cachedFetch, clearCachePrefix } from '../../services/cache';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';

const FONT = Platform.OS === 'ios' ? 'System' : 'sans-serif-medium';
const GREEN = '#e4054f';
const GREEN_DARK = '#0b6975';
const TEAL = '#065ee2';
const BG = '#f3f6f4';

const cardShadow = Platform.OS === 'web'
  ? { boxShadow: '0px 4px 14px rgba(15, 23, 42, 0.07)' }
  : { elevation: 2, shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } };

const fmtTime = (t) => (t ? new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—');

export default function AdminDashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [stats, setStats] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [liveLocations, setLiveLocations] = useState([]);
  
  const [recentTasks, setRecentTasks] = useState([]);
  const [recentExpenses, setRecentExpenses] = useState([]);
  const [recentLeaves, setRecentLeaves] = useState([]);
  const [recentMeetings, setRecentMeetings] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState({ 'Field CRM': true });

  // ─── CRITICAL DATA (stats, employees, live GPS) — cached 20s, polled every 30s ───
  const fetchCritical = useCallback(async (force = false) => {
    try {
      const [statsRes, empRes, locRes] = await Promise.all([
        cachedFetch('admin_dashboard', () => adminAPI.getDashboard(), 20, force),
        cachedFetch('admin_employees', () => adminAPI.getEmployees({ limit: 200, role: 'all' }), 30, force),
        cachedFetch('admin_live_locations', () => trackingAPI.getLiveLocations(), 15, force),
      ]);
      if (statsRes.data?.success) setStats(statsRes.data.stats || null);
      if (empRes.data?.success) setEmployees(empRes.data.employees || []);
      if (locRes.data?.success) setLiveLocations(locRes.data.locations || []);
    } catch (e) {
      console.log('Dashboard critical fetch error:', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── SECONDARY DATA (tasks, expenses, leaves, meetings) — cached 60s ───
  const fetchSecondary = useCallback(async (force = false) => {
    try {
      const [taskRes, expRes, leaveRes, meetRes] = await Promise.all([
        cachedFetch('admin_tasks', () => taskAPI.getAll(), 60, force),
        cachedFetch('admin_expenses', () => expenseAPI.getAll({ limit: 10 }), 60, force),
        cachedFetch('admin_leaves', () => leaveAPI.getAll(), 60, force),
        cachedFetch('admin_meetings', () => meetingAPI.getAll({ limit: 10 }), 60, force),
      ]);
      if (taskRes.data?.success) setRecentTasks(taskRes.data.tasks || []);
      if (expRes.data?.success) setRecentExpenses(expRes.data.expenses || []);
      if (leaveRes.data?.success) setRecentLeaves(leaveRes.data.leaves || []);
      if (meetRes.data?.success) setRecentMeetings(meetRes.data.meetings || []);
    } catch (e) {
      console.log('Dashboard secondary fetch error:', e.message);
    }
  }, []);

  useEffect(() => {
    fetchCritical();
    fetchSecondary();
    const interval = setInterval(() => fetchCritical(true), 30000); // Force-refresh poll every 30s
    return () => clearInterval(interval);
  }, [fetchCritical, fetchSecondary]);

  const onRefresh = async () => {
    setRefreshing(true);
    clearCachePrefix('admin_'); // Bust all admin cache on manual refresh
    await Promise.all([fetchCritical(true), fetchSecondary(true)]);
    setRefreshing(false);
  };

  const totalEmp = stats?.totalEmployees ?? employees.length ?? 0;
  const presentCount = stats?.todayAttendance ?? stats?.presentToday ?? 0;
  const meetingsCount = stats?.todayMeetings ?? stats?.totalMeetings ?? 0;
  const tasksCount = stats?.totalTasks ?? 0;
  const liveCount = stats?.trackingNow ?? liveLocations.length ?? 0;
  const offlineCount = Math.max(0, totalEmp - liveCount);
  const attendanceRate = totalEmp ? Math.round((presentCount / totalEmp) * 100) : 0;

  const goTo = (path) => router.push(path);

  const mapPreviewStaff = liveLocations.map((l, i) => ({
    _id: l.employeeId || l.sessionId || String(i),
    name: l.name || 'Field Agent',
    avatar: l.avatar,
    lat: l.lat,
    lng: l.lng,
    isTracking: true,
  }));

  const moduleGroups = [
    {
      title: 'Field CRM', icon: MapPin, accent: '#15803d', tint: '#e7f6ec',
      sub: 'Track field operations & live status',
      items: [
        { label: 'All Activity', icon: Users, path: '/(admin)/monitoring', color: '#15803d' },
        { label: 'Live Tracking', icon: Navigation, path: '/(admin)/tracking', color: '#0f766e' },
        { label: 'History', icon: History, path: '/(admin)/history', color: '#166534' },
      ],
    },
    {
      title: 'Sales CRM', icon: BriefcaseBusiness, accent: '#b45309', tint: '#fdf3e3',
      sub: 'Visits, reports & customer engagement',
      items: [
        { label: 'Visits', icon: BriefcaseBusiness, path: '/(admin)/visits', color: '#b45309' },
        { label: 'Reports', icon: BarChart3, path: '/(admin)/reports', color: '#7c3aed' },
        { label: 'Team Data', icon: ClipboardList, path: '/(admin)/team', color: '#0f766e' },
      ],
    },
    {
      title: 'HR', icon: UserRound, accent: '#5146c7', tint: '#f1efff',
      sub: 'Attendance, leaves & expenses',
      items: [
        { label: 'Attendance', icon: CalendarDays, path: '/(admin)/attendance', color: '#5146c7' },
        { label: 'Leave Requests', icon: CalendarCheck, path: '/(admin)/monitoring?tab=leaves', color: '#db2777' },
        { label: 'Expenses', icon: ReceiptText, path: '/(admin)/monitoring?tab=expenses', color: '#0f766e' },
      ],
    },
    {
      title: 'Miscellaneous', icon: LayoutGrid, accent: '#0891b2', tint: '#eafaff',
      sub: 'Forms, tasks & admin tools',
      items: [
        { label: 'Forms', icon: FileText, path: '/(admin)/reports', color: '#0891b2' },
        { label: 'Task Summary', icon: ListChecks, path: '/(admin)/monitoring?tab=tasks', color: '#5146c7' },
        { label: 'Admin Profile', icon: UserRound, path: '/(admin)/profile', color: '#0f766e' },
      ],
    },
  ];

  const quickActions = [
    { label: 'Attendance', icon: CalendarDays, path: '/(admin)/attendance', bg: '#eef2ff', color: '#5146c7' },
    { label: 'Live Tracking', icon: MapPin, path: '/(admin)/tracking', bg: '#e7f6ec', color: '#15803d' },
    { label: 'Reports', icon: BarChart3, path: '/(admin)/reports', bg: '#f1ecfd', color: '#7c3aed' },
    { label: 'Team Data', icon: Users, path: '/(admin)/team', bg: '#fdf3e3', color: '#b45309' },
  ];

  const statusCards = [
    { label: 'On Field', value: liveCount, sub: 'Active now', icon: UserCheck, bg: '#e7f6ec', color: '#15803d', path: '/(admin)/tracking' },
    { label: 'On Break', value: 0, sub: 'In break', icon: Coffee, bg: '#fdf3e3', color: '#b45309', path: '/(admin)/monitoring' },
    { label: 'Offline', value: offlineCount, sub: 'Not reachable', icon: WifiOff, bg: '#e8f0fe', color: '#1d4ed8', path: '/(admin)/monitoring' },
    { label: 'Total Teams', value: totalEmp, sub: 'Field staff', icon: Users, bg: '#f1ecfd', color: '#7c3aed', path: '/(admin)/team' },
  ];

  const activityRows = employees.slice(0, 4).map((emp) => ({
    id: emp._id || emp.employeeId,
    name: emp.name || 'Field Agent',
    role: emp.designation || emp.department || 'Field Executive',
    location: emp.allocatedArea || emp.department || 'Field',
    avatar: emp.avatar,
    online: !!emp.isTracking || !!emp.isOnline,
    time: fmtTime(emp.updatedAt || emp.lastSeen),
  }));

  const bottomNav = [
    { label: 'Home', icon: Home, path: '/(admin)/dashboard', active: true },
    { label: 'Team', icon: Users, path: '/(admin)/team' },
    { label: 'Tracking', icon: MapPin, path: '/(admin)/tracking' },
    { label: 'Reports', icon: BarChart3, path: '/(admin)/reports' },
    { label: 'More', icon: MoreHorizontal, path: '/(admin)/monitoring' },
  ];

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: BG }]}>
        <ActivityIndicator size="large" color={GREEN} />
        <Text style={styles.loadingText}>Loading dashboard…</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={GREEN_DARK} />

      {/* ── 1. HEADER ─────────────────────────────────────────── */}
      <LinearGradient colors={[GREEN_DARK, GREEN]} start={{ x: 0, y: 1 }} end={{ x: 3, y: 0 }}>
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.iconBtn} accessibilityLabel="Menu">
              <Menu size={22} color="#fff" />
            </TouchableOpacity>
            <View style={styles.brandWrap}>
              <View>
                <Text style={styles.brandTitle}>FieldTrack</Text>
                <Text style={styles.brandSub}>Empowering Your Field Team</Text>
              </View>
            </View>
            
            <TouchableOpacity style={styles.profileBtn} onPress={() => goTo('/(admin)/profile')}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{(user?.name || 'A').slice(0, 1).toUpperCase()}</Text>
              </View>
              <Text style={styles.profileLabel}>Admin</Text>
              <ChevronDown size={14} color="#d1fae5" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        style={{ backgroundColor: BG }}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GREEN} colors={[GREEN]} />}
      >
       

        {/* ── TEAM PULSE ──────────────────────────────────────── */}
        <View style={[styles.pulseCard, cardShadow]}>
          <View style={styles.pulseTop}>
            <View style={styles.pulseTitleWrap}>
              <View style={styles.pulseIcon}><Activity size={16} color="#fff" /></View>
              <View>
                <Text style={styles.pulseTitle}>Team Pulse</Text>
                <Text style={styles.pulseSub}>Live operational overview</Text>
              </View>
            </View>
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.livePillText}>LIVE</Text>
            </View>
          </View>
          <View style={styles.pulseMetrics}>
            <PulseMetric icon={CircleCheck} label="Present" value={`${presentCount}/${totalEmp}`} color="#15803d" />
            <PulseMetric icon={MapPin} label="On field" value={liveCount} color="#0f766e" />
            <PulseMetric icon={ListChecks} label="Tasks" value={tasksCount} color="#b45309" />
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.min(attendanceRate, 100)}%` }]} />
          </View>
          <Text style={styles.progressLabel}>{attendanceRate}% attendance coverage · {presentCount} checked in · {meetingsCount} visits logged</Text>
        </View>

      
      {/* ── MY TEAM DIRECT BUTTON ──────────────────────────────── */}
      <TouchableOpacity 
        style={[styles.myTeamBtn, cardShadow]}
        onPress={() => goTo('/(admin)/tracking')}
        activeOpacity={0.9}
      >
        <LinearGradient colors={[GREEN_DARK, GREEN]} style={styles.myTeamGradient} start={{ x: 1, y: 0 }} end={{ x: 1, y: 0 }}>
          <View style={styles.myTeamLeft}>
            <View style={styles.myTeamIconBox}>
              <Users size={18} color={GREEN_DARK} />
            </View>
            <View>
              <Text style={styles.myTeamTitle}>MY TEAM</Text>
              <Text style={styles.myTeamSub}>View live map & track activity</Text>
            </View>
          </View>
          <View style={styles.myTeamRight}>
            <Text style={styles.myTeamActionText}>TRACK</Text>
            <ChevronRight size={14} color="#fff" />
          </View>
        </LinearGradient>
      </TouchableOpacity>


        {/* ── QUICK ACTIONS ───────────────────────────────────── */}
        <View style={[styles.sectionCard, cardShadow]}>
          <View style={styles.sectionHead}>
            <View style={styles.sectionHeadLeft}>
              <View style={[styles.sectionIcon, { backgroundColor: '#fdf3e3' }]}><Clock3 size={16} color="#b45309" /></View>
              <View>
                <Text style={styles.sectionTitle}>Quick Actions</Text>
                <Text style={styles.sectionSub}>Manage your field team efficiently</Text>
              </View>
            </View>
          </View>
          <View style={styles.quickRow}>
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <TouchableOpacity
                  key={action.label}
                  style={[styles.quickTile, { backgroundColor: action.bg }]}
                  onPress={() => goTo(action.path)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.quickIcon, { backgroundColor: '#fff' }]}>
                    <Icon size={18} color={action.color} />
                  </View>
                  <Text style={[styles.quickLabel, { color: action.color }]} numberOfLines={1}>{action.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── MONITOR & MANAGE ────────────────────────────────── */}
        <View style={styles.monitorHeader}>
          <View>
            <Text style={styles.monitorTitle}>Monitor & Manage</Text>
            <Text style={styles.monitorSub}>Expand a workspace to review employee activity</Text>
          </View>
        </View>

        {moduleGroups.map((group) => {
          const GroupIcon = group.icon;
          const isOpen = !!expanded[group.title];
          return (
            <View key={group.title} style={[styles.groupCard, { borderColor: `${group.accent}30` }, cardShadow]}>
              <TouchableOpacity
                style={[styles.groupHead, { backgroundColor: group.tint }]}
                onPress={() => setExpanded((prev) => ({ ...prev, [group.title]: !prev[group.title] }))}
                activeOpacity={0.85}
              >
                <View style={styles.groupHeadLeft}>
                  <View style={[styles.groupIcon, { backgroundColor: group.accent }]}>
                    <GroupIcon size={15} color="#fff" />
                  </View>
                  <View>
                    <Text style={styles.groupTitle}>{group.title}</Text>
                    <Text style={styles.groupSub}>{group.sub}</Text>
                  </View>
                </View>
                <View style={[styles.groupChevron, { backgroundColor: '#fff' }]}>
                  {isOpen
                    ? <ChevronDown size={16} color={group.accent} />
                    : <ChevronRight size={16} color={group.accent} />}
                </View>
              </TouchableOpacity>
              {isOpen && (
                <View style={styles.groupGrid}>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <TouchableOpacity
                        key={item.label}
                        style={styles.groupTile}
                        onPress={() => item.path && goTo(item.path)}
                        activeOpacity={0.85}
                      >
                        <View style={[styles.groupTileIcon, { backgroundColor: `${item.color}14` }]}>
                          <Icon size={19} color={item.color} />
                        </View>
                        <Text style={styles.groupTileLabel} numberOfLines={2}>{item.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}

        {/* ── ATTENDANCE SUMMARY ──────────────────────────────── */}
        <TouchableOpacity
          style={[styles.attendanceCard, cardShadow]}
          onPress={() => goTo('/(admin)/attendance')}
          activeOpacity={0.9}
        >
          <View style={styles.attendanceIconWrap}><CalendarCheck size={20} color={GREEN} /></View>
          <View style={{ flex: 1, marginLeft: 11 }}>
            <Text style={styles.attendanceTitle}>Today's Attendance</Text>
            <Text style={styles.attendanceSub}>{presentCount} of {totalEmp} employees checked in · punches, selfies & status</Text>
            <View style={styles.attendanceBarTrack}>
              <View style={[styles.attendanceBarFill, { width: `${Math.min(attendanceRate, 100)}%` }]} />
            </View>
          </View>
          <ChevronRight size={18} color={GREEN} />
        </TouchableOpacity>

        {/* ── ALL DATA SUMMARIES ───────────────────────────── */}
        <DataListSection title="Recent Visits" data={recentMeetings} type="visit" onNav={() => goTo('/(admin)/visits')} />
        <DataListSection title="Recent Tasks" data={recentTasks} type="task" onNav={() => goTo('/(admin)/monitoring?tab=tasks')} />
        <DataListSection title="Pending Expenses" data={recentExpenses} type="expense" onNav={() => goTo('/(admin)/monitoring?tab=expenses')} />
        <DataListSection title="Leave Requests" data={recentLeaves} type="leave" onNav={() => goTo('/(admin)/monitoring?tab=leaves')} />

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* ── 6. FLOATING BOTTOM NAVIGATION ─────────────────────── */}
      <SafeAreaView edges={['bottom']} style={styles.bottomSafe}>
        <View style={styles.floatingNavWrap}>
          {bottomNav.map((item, index) => {
            const Icon = item.icon;
            const isCenter = index === 2; // Tracking (MapPin)
            
            if (isCenter) {
              return (
                <View key={item.label} style={styles.centerNavWrap}>
                  <TouchableOpacity
                    style={styles.centerNavBtn}
                    onPress={() => goTo(item.path)}
                    activeOpacity={0.9}
                  >
                    <LinearGradient
                      colors={['#10b981', '#047857']}
                      style={styles.centerNavGradient}
                    >
                      <Icon size={26} color="#fff" />
                    </LinearGradient>
                  </TouchableOpacity>
                  <Text style={styles.centerNavLabel}>{item.label}</Text>
                </View>
              );
            }

            return (
              <TouchableOpacity
                key={item.label}
                style={styles.navItem}
                onPress={() => !item.active && goTo(item.path)}
                activeOpacity={0.8}
              >
                <View style={[styles.navIconBox, item.active && styles.navIconBoxActive]}>
                  <Icon size={item.active ? 22 : 20} color={item.active ? GREEN : '#94a3b8'} />
                </View>
                <Text style={[styles.navLabel, { color: item.active ? GREEN : '#94a3b8' }]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </SafeAreaView>
    </View>
  );
}

function PulseMetric({ icon: Icon, label, value, color }) {
  return (
    <View style={styles.pulseMetricCard}>
      <Text style={styles.pulseMetricLabel}>{label}</Text>
      <View style={[styles.pulseCircle, { borderColor: color }]}>
        <Icon size={15} color={color} />
        <Text style={[styles.pulseMetricValue, { color }]}>{value}</Text>
      </View>
    </View>
  );
}

function DataListSection({ title, data, type, onNav }) {
  if (!data || data.length === 0) return null;
  
  const getIcon = () => {
    if (type === 'visit') return <BriefcaseBusiness size={18} color="#b45309" />;
    if (type === 'task') return <ListChecks size={18} color="#0f766e" />;
    if (type === 'expense') return <ReceiptText size={18} color="#dc2626" />;
    return <CalendarCheck size={18} color="#5146c7" />;
  };

  const getBg = () => {
    if (type === 'visit') return '#fdf3e3';
    if (type === 'task') return '#ccfbf1';
    if (type === 'expense') return '#fee2e2';
    return '#e0e7ff';
  };

  return (
    <View style={styles.dataSection}>
      <View style={[styles.sectionHead, { paddingHorizontal: 2 }]}>
        <Text style={styles.monitorTitle}>{title}</Text>
        <TouchableOpacity onPress={onNav} style={styles.viewAll}>
          <Text style={styles.viewAllText}>View All ›</Text>
        </TouchableOpacity>
      </View>
      {data.slice(0, 3).map((item, idx) => {
        let titleText = '';
        let subText = '';
        let badgeText = '';

        if (type === 'visit') {
          titleText = item.clientName || 'Visit';
          subText = item.employee?.name ? `By ${item.employee.name}` : 'Field Visit';
          badgeText = item.status || 'Scheduled';
        } else if (type === 'task') {
          titleText = item.title || 'Task';
          subText = item.employee?.name ? `For ${item.employee.name}` : 'Task';
          badgeText = item.status || 'Pending';
        } else if (type === 'expense') {
          titleText = `₹${item.amount} - ${item.category}`;
          subText = item.employee?.name ? `By ${item.employee.name}` : 'Expense Claim';
          badgeText = item.status || 'Pending';
        } else {
          titleText = `${item.type || 'Leave'} Request`;
          subText = item.employee?.name ? `By ${item.employee.name}` : 'Leave';
          badgeText = item.status || 'Pending';
        }

        return (
          <Surface key={item._id || idx} style={[styles.dataCard, cardShadow]} elevation={1}>
            <View style={styles.dataCardRow}>
              <View style={[styles.dataAvatar, { backgroundColor: getBg() }]}>
                {getIcon()}
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.dataTitle} numberOfLines={1}>{titleText}</Text>
                <Text style={styles.dataSub} numberOfLines={1}>{subText}</Text>
              </View>
              <View style={styles.dataBadge}>
                <Text style={styles.dataBadgeText}>{badgeText.toUpperCase()}</Text>
              </View>
            </View>
          </Surface>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontFamily: FONT, fontSize: 12, color: '#64748b', marginTop: 8 },

  headerSafe: { backgroundColor: 'transparent' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  iconBtn: { width: 38, height: 38, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 6, right: 6, minWidth: 15, height: 15, borderRadius: 8, backgroundColor: '#ef3154', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { color: '#fff', fontSize: 8, fontWeight: 'bold' },
  brandWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 2 },
  brandLogo: { width: 30, height: 30, borderRadius: 9, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  brandTitle: { color: '#fff', fontFamily: FONT, fontSize: 15, fontWeight: 'bold' },
  brandSub: { color: '#a7f3d0', fontFamily: FONT, fontSize: 9, marginTop: 1 },
  profileBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  avatarCircle: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#ef3154', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#fff' },
  avatarText: { color: '#fff', fontFamily: FONT, fontSize: 12, fontWeight: 'bold' },
  profileLabel: { color: '#fff', fontFamily: FONT, fontSize: 11, fontWeight: '700' },

  body: { padding: 14, maxWidth: 720, width: '100%', alignSelf: 'center' },

  heroCard: { backgroundColor: '#e9f7ee', borderRadius: 22, padding: 16, flexDirection: 'row', minHeight: 138, marginBottom: 14, overflow: 'hidden' },
  heroLeafTop: { position: 'absolute', top: 12, left: 14 },
  heroLeft: { flex: 1, paddingTop: 14 },
  heroTitle: { fontFamily: FONT, fontSize: 17, fontWeight: 'bold', color: '#0f2e25' },
  heroSub: { fontFamily: FONT, fontSize: 11, color: '#4b6b5f', marginTop: 4, lineHeight: 15, maxWidth: 220 },
  heroPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: GREEN, borderRadius: 13, paddingHorizontal: 11, paddingVertical: 9, marginTop: 12, alignSelf: 'flex-start', minWidth: 178 },
  heroPillLabel: { color: '#a7f3d0', fontFamily: FONT, fontSize: 9, fontWeight: '600' },
  heroPillValue: { color: '#fff', fontFamily: FONT, fontSize: 17, fontWeight: 'bold', marginTop: 1 },
  heroArt: { width: 104, alignItems: 'center', justifyContent: 'center' },
  heroBikeCircle: { width: 74, height: 74, borderRadius: 37, backgroundColor: '#15803d', alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: '#bbf7d0' },
  heroPin: { position: 'absolute', top: 2, right: 14, width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },

  statusRow: { flexDirection: 'row', gap: 9, marginBottom: 14 },
  statusCard: { flex: 1, borderRadius: 15, padding: 10, minHeight: 108 },
  statusCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  statusLabel: { fontFamily: FONT, fontSize: 9, fontWeight: '700', marginTop: 8 },
  statusValue: { fontFamily: FONT, fontSize: 19, fontWeight: 'bold', color: '#0f172a', marginTop: 2 },
  statusSub: { fontFamily: FONT, fontSize: 8, color: '#64748b', marginTop: 1 },

  pulseCard: { backgroundColor: '#fff', borderRadius: 18, padding: 14, marginBottom: 14 },
  pulseTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  pulseTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  pulseIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  pulseTitle: { fontFamily: FONT, fontSize: 14, fontWeight: 'bold', color: '#0f172a' },
  pulseSub: { fontFamily: FONT, fontSize: 10, color: '#64748b', marginTop: 1 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#e7f6ec', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#16a34a' },
  livePillText: { color: '#15803d', fontFamily: FONT, fontSize: 9, fontWeight: 'bold' },
  pulseMetrics: { flexDirection: 'row', gap: 8 },
  pulseMetricCard: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 12, paddingVertical: 9, alignItems: 'center' },
  pulseMetricLabel: { fontFamily: FONT, fontSize: 9, fontWeight: '700', color: '#475569', marginBottom: 5 },
  pulseCircle: { width: 50, height: 50, borderWidth: 4, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  pulseMetricValue: { fontFamily: FONT, fontSize: 11, fontWeight: 'bold' },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: '#e2e8f0', overflow: 'hidden', marginTop: 12 },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: TEAL },
  progressLabel: { fontFamily: FONT, fontSize: 9, color: '#64748b', marginTop: 6 },

  myTeamBtn: { borderRadius: 16, marginBottom: 14, overflow: 'hidden' },
  myTeamGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  myTeamLeft: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  myTeamIconBox: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center' },
  myTeamTitle: { fontFamily: FONT, fontSize: 14, fontWeight: 'bold', color: '#ffffff', letterSpacing: 0.5 },
  myTeamSub: { fontFamily: FONT, fontSize: 9, color: '#dcfce7', marginTop: 2 },
  myTeamRight: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.15)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  myTeamActionText: { fontFamily: FONT, fontSize: 10, fontWeight: 'bold', color: '#ffffff' },

  sectionCard: { backgroundColor: '#fff', borderRadius: 18, padding: 13, marginBottom: 14 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1 },
  sectionIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontFamily: FONT, fontSize: 14, fontWeight: 'bold', color: '#0f172a' },
  sectionSub: { fontFamily: FONT, fontSize: 9, color: '#64748b', marginTop: 1 },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAllText: { fontFamily: FONT, fontSize: 11, fontWeight: '700', color: GREEN },
  emptyActivity: { fontFamily: FONT, fontSize: 11, color: '#94a3b8', textAlign: 'center', paddingVertical: 16 },

  activityRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9 },
  activityRowBorder: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  activityAvatarFallback: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  activityAvatarText: { color: '#fff', fontFamily: FONT, fontSize: 13, fontWeight: 'bold' },
  activityName: { fontFamily: FONT, fontSize: 13, fontWeight: 'bold', color: '#0f172a' },
  activityRole: { fontFamily: FONT, fontSize: 9, color: '#64748b', marginTop: 1 },
  activityLocRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  activityLoc: { fontFamily: FONT, fontSize: 9, color: '#94a3b8', flex: 1 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 11, paddingHorizontal: 8, paddingVertical: 4 },
  statusPillOn: { backgroundColor: '#e7f6ec' },
  statusPillOff: { backgroundColor: '#f1f5f9' },
  statusPillDot: { width: 5, height: 5, borderRadius: 3 },
  statusPillText: { fontFamily: FONT, fontSize: 8, fontWeight: 'bold' },
  activityTime: { fontFamily: FONT, fontSize: 9, color: '#94a3b8', marginTop: 4 },

  mapPreviewCard: { backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden', marginBottom: 14 },
  mapPreview: { height: 128, backgroundColor: '#e5e7eb' },
  mapPreviewOverlay: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  mapOverlayIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  mapOverlayTitle: { fontFamily: FONT, fontSize: 13, fontWeight: 'bold', color: '#0f172a' },
  mapOverlaySub: { fontFamily: FONT, fontSize: 9, color: '#64748b', marginTop: 1 },
  mapOverlayBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: GREEN, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8 },
  mapOverlayBtnText: { color: '#fff', fontFamily: FONT, fontSize: 10, fontWeight: 'bold' },

  quickRow: { flexDirection: 'row', gap: 8 },
  quickTile: { flex: 1, borderRadius: 13, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4 },
  quickIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontFamily: FONT, fontSize: 9, fontWeight: 'bold', marginTop: 7, textAlign: 'center' },

  monitorHeader: { marginBottom: 10, paddingHorizontal: 2 },
  monitorTitle: { fontFamily: FONT, fontSize: 15, fontWeight: 'bold', color: '#0f172a' },
  monitorSub: { fontFamily: FONT, fontSize: 10, color: '#64748b', marginTop: 2 },

  groupCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, marginBottom: 10, overflow: 'hidden' },
  groupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 11 },
  groupHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  groupIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  groupTitle: { fontFamily: FONT, fontSize: 13, fontWeight: 'bold', color: '#0f172a' },
  groupSub: { fontFamily: FONT, fontSize: 9, color: '#64748b', marginTop: 1 },
  groupChevron: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  groupGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 11, paddingTop: 10 },
  groupTile: { width: '31.5%', backgroundColor: '#f8fafc', borderRadius: 13, alignItems: 'center', paddingVertical: 13, paddingHorizontal: 4, borderWidth: 1, borderColor: '#eef2f7' },
  groupTileIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  groupTileLabel: { fontFamily: FONT, fontSize: 9.5, fontWeight: 'bold', color: '#334155', marginTop: 7, textAlign: 'center', lineHeight: 13 },

  attendanceCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 13 },
  attendanceIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#e7f6ec', alignItems: 'center', justifyContent: 'center' },
  attendanceTitle: { fontFamily: FONT, fontSize: 13, fontWeight: 'bold', color: '#0f172a' },
  attendanceSub: { fontFamily: FONT, fontSize: 9, color: '#64748b', marginTop: 2 },
  attendanceBarTrack: { height: 5, borderRadius: 3, backgroundColor: '#e2e8f0', marginTop: 8, overflow: 'hidden' },
  attendanceBarFill: { height: '100%', borderRadius: 3, backgroundColor: GREEN },

  dataSection: { marginTop: 14 },
  dataCard: { backgroundColor: '#fff', borderRadius: 16, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#f1f5f9' },
  dataCardRow: { flexDirection: 'row', alignItems: 'center' },
  dataAvatar: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dataTitle: { fontFamily: FONT, fontSize: 13, fontWeight: 'bold', color: '#0f172a' },
  dataSub: { fontFamily: FONT, fontSize: 10, color: '#64748b', marginTop: 2 },
  dataBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  dataBadgeText: { fontFamily: FONT, fontSize: 8, fontWeight: 'bold', color: '#475569' },

  bottomSafe: { position: 'absolute', bottom: -17, left: 0, right: 0, paddingHorizontal: 1, paddingBottom: Platform.OS === 'ios' ? 20 : 16 },
  floatingNavWrap: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    height: 60,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 5 },
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.02)',
  },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navIconBox: { width: 44, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  navIconBoxActive: { backgroundColor: '#e7f6ec' },
  navLabel: { fontFamily: FONT, fontSize: 10, fontWeight: '700', marginTop: 4 },
  
  centerNavWrap: { alignItems: 'center', justifyContent: 'flex-start', marginTop: -35, width: 70 },
  centerNavBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff', padding: 5, elevation: 8, shadowColor: '#10b981', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },
  centerNavGradient: { flex: 1, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  centerNavLabel: { fontFamily: FONT, fontSize: 10, fontWeight: '700', color: '#10b981', marginTop: 6 },
});
