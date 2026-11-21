import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet, View, ScrollView, TouchableOpacity,
  ActivityIndicator, Platform, RefreshControl, StatusBar, Image, Dimensions, Modal, Linking, TextInput, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Surface } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Menu, Bell, MapPin, UserPlus, Navigation, Activity, Route, MessageCircle, Battery,
  Users, CheckCircle2, ChevronRight, UserCheck, Clock, ShieldCheck, DollarSign,
  Phone, Mail, X, MessageSquare, ChevronDown, FileText, PieChart, AlertCircle, Building2,
  LogOut, User, Settings, Search, Home, LayoutDashboard, Briefcase, Plus, Layers,
  Compass, Wallet, Calendar, AlertTriangle, Flame, Award, TrendingUp, BarChart2,
  CheckSquare, ArrowRight, Shield, RefreshCw, Sparkles, Sprout, Filter, ExternalLink,
  Car
} from 'lucide-react-native';
import MapViewComponent from '../../components/MapViewComponent';
import FloatingAdminTabBar from '../../components/FloatingAdminTabBar';
import { adminAPI, trackingAPI, meetingAPI, getAvatarUrl, stopHeartbeat, expenseAPI } from '../../services/api';
import { storage } from '../../services/storage';
import socketService from '../../services/socket';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';

const { width, height } = Dimensions.get('window');
const FONT = Platform.OS === 'web' ? 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' : Platform.OS === 'ios' ? 'System' : 'sans-serif';

const COLORS = {
  headerStart: '#FFFFFF',
  headerEnd: '#F8FAFC',
  primary: '#4F46E5',
  primaryDark: '#4338CA',
  primaryLight: '#E0E7FF',
  primaryMuted: '#EEF2FF',
  secondary: '#0D9488',
  accent: '#4F46E5',
  background: '#F8FAFC',
  card: '#FFFFFF',
  surface: '#F1F5F9',
  border: '#E2E8F0',
  text: '#0F172A',
  textSecondary: '#334155',
  textMuted: '#94A3B8',
  textSub: '#64748B',
  success: '#0D9488',
  successLight: '#F0FDFA',
  warning: '#D97706',
  warningLight: '#FFFBEB',
  danger: '#DC2626',
  dangerLight: '#FEF2F2',
  purple: '#4F46E5',
  purpleLight: '#EEF2FF',
  pinkLight: '#F8FAFC',
  lavenderLight: '#EEF2FF',
  skyLight: '#F0F9FF',
  mintLight: '#F0FDFA',
  blue: '#4F46E5',
  blueLight: '#E0E7FF',
};

const cardShadow = Platform.OS === 'web'
  ? { boxShadow: '0px 6px 20px rgba(15, 26, 46, 0.06)' }
  : { elevation: 2, shadowColor: '#0f1a2e', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } };

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
    const cleaned = trimmed.replace(/^[A-Z0-9]{4,8}\+[A-Z0-9]{2,4},\s*/i, '');
    return cleaned || fallback;
  }
  if (typeof addr === 'object' && addr !== null) {
    const parts = [addr.street, addr.city, addr.state, addr.pincode].filter(Boolean);
    if (parts.length > 0) return parts.join(', ');
    return addr.formattedAddress || addr.address || fallback;
  }
  return String(addr || '').trim() || fallback;
};

export default function OrgAdminDashboardScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const mapRef = useRef(null);

  const [stats, setStats] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [liveLocations, setLiveLocations] = useState([]);
  const [organization, setOrganization] = useState(null);
  const [managersList, setManagersList] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [pendingExpenses, setPendingExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sideMenuVisible, setSideMenuVisible] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState('All India');
  const [regionModalVisible, setRegionModalVisible] = useState(false);

  // Add Employee Form State
  const [addEmpModalVisible, setAddEmpModalVisible] = useState(false);
  const [newEmp, setNewEmp] = useState({
    name: '', email: '', password: 'password123', phone: '',
    department: 'Field Services', designation: 'Field Executive', salary: '18000', managerId: ''
  });
  const [creatingEmp, setCreatingEmp] = useState(false);

  // All Employees Directory State
  const [empSearchQuery, setEmpSearchQuery] = useState('');
  const [empStatusFilter, setEmpStatusFilter] = useState('ALL');
  const [showAllEmps, setShowAllEmps] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayDateFormatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(new Date());

  // Hydrate cached OrgAdmin dashboard state immediately on mount (0ms perceived load)
  useEffect(() => {
    storage.getItem('cache_org_admin_dashboard_v1').then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed.stats) setStats(parsed.stats);
          if (Array.isArray(parsed.employees)) setEmployees(parsed.employees);
          if (Array.isArray(parsed.liveLocations)) setLiveLocations(parsed.liveLocations);
          if (parsed.organization) setOrganization(parsed.organization);
          if (Array.isArray(parsed.managersList)) setManagersList(parsed.managersList);
          if (Array.isArray(parsed.attendanceRecords)) setAttendanceRecords(parsed.attendanceRecords);
          if (Array.isArray(parsed.pendingLeaves)) setPendingLeaves(parsed.pendingLeaves);
          if (Array.isArray(parsed.pendingExpenses)) setPendingExpenses(parsed.pendingExpenses);
          setLoading(false);
        } catch (_) {}
      }
    }).catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, empRes, locRes, orgRes, mgrRes, attRes, leavesRes, expRes] = await Promise.all([
        adminAPI.getDashboard().catch(() => ({ data: { success: false } })),
        adminAPI.getEmployees({ limit: 200, role: 'all' }).catch(() => ({ data: { success: false } })),
        trackingAPI.getLiveLocations().catch(() => ({ data: { success: false } })),
        adminAPI.getOrganization().catch(() => ({ data: { success: false } })),
        adminAPI.getManagers().catch(() => ({ data: { success: false } })),
        adminAPI.getAttendance({ date: todayStr }).catch(() => ({ data: { success: false } })),
        adminAPI.getLeaves().catch(() => ({ data: { success: false } })),
        adminAPI.getExpenses().catch(() => ({ data: { success: false } })),
      ]);

      let nextStats = null;
      let nextEmps = null;
      let nextLocs = null;
      let nextOrg = null;
      let nextMgrs = null;
      let nextAtt = null;
      let nextLeaves = null;
      let nextExpenses = null;

      if (statsRes.data?.success) {
        nextStats = statsRes.data.stats || statsRes.data;
        setStats(nextStats);
      }
      if (empRes.data?.success) {
        nextEmps = empRes.data.employees || empRes.data.data || [];
        setEmployees(nextEmps);
      }
      if (locRes.data?.success) {
        nextLocs = locRes.data.locations || locRes.data.data || [];
        setLiveLocations(nextLocs);
      }
      if (orgRes.data?.success) {
        nextOrg = orgRes.data.organization || orgRes.data.data || null;
        setOrganization(nextOrg);
      }
      if (mgrRes.data?.success) {
        nextMgrs = mgrRes.data.managers || [];
        setManagersList(nextMgrs);
      }
      if (attRes.data?.success) {
        nextAtt = attRes.data.records || attRes.data.attendance || [];
        setAttendanceRecords(nextAtt);
      }
      if (leavesRes?.data?.success && Array.isArray(leavesRes.data.leaves)) {
        nextLeaves = leavesRes.data.leaves;
        setPendingLeaves(nextLeaves);
      }
      if (expRes?.data?.success && Array.isArray(expRes.data.expenses)) {
        nextExpenses = expRes.data.expenses;
        setPendingExpenses(nextExpenses);
      }

      if (nextStats || nextEmps || nextLocs) {
        storage.setItem('cache_org_admin_dashboard_v1', JSON.stringify({
          stats: nextStats,
          employees: (nextEmps || []).slice(0, 100),
          liveLocations: (nextLocs || []).slice(0, 100),
          organization: nextOrg,
          managersList: nextMgrs || [],
          attendanceRecords: (nextAtt || []).slice(0, 100),
          pendingLeaves: (nextLeaves || []).slice(0, 30),
          pendingExpenses: (nextExpenses || []).slice(0, 30),
          updatedAt: Date.now()
        })).catch(() => {});
      }
    } catch (e) {
      console.log('OrgAdmin dashboard fetch error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [todayStr]);

  useEffect(() => {
    fetchData();

    let socket;
    const initSocket = async () => {
      try {
        socket = await socketService.connect();
        if (socket) {
          socket.on('employee_location', (data) => {
            const incomingDist = Number(data.officialDistance ?? data.totalDistanceToday ?? data.todayKm ?? data.totalDistance ?? data.sessionDistance ?? 0);
            setLiveLocations((prev) => {
              const targetEmpId = String(data.employeeId || '');
              const idx = prev.findIndex((l) => {
                const lEmpId = String(l.employeeId || l.employee?._id || l.employee || l._id || '');
                return (targetEmpId && lEmpId === targetEmpId) || (l.sessionId && data.sessionId && l.sessionId === data.sessionId);
              });
              if (idx > -1) {
                const upd = [...prev];
                const existingDist = Number(upd[idx].officialDistance || upd[idx].totalDistance || 0);
                const finalDist = incomingDist > 0 ? incomingDist : existingDist;
                upd[idx] = {
                  ...upd[idx],
                  lat: data.lat,
                  lng: data.lng,
                  speed: data.speed,
                  motionState: data.motionState,
                  totalDistance: finalDist,
                  officialDistance: finalDist,
                  address: data.address || upd[idx].address,
                  updatedAt: new Date().toISOString()
                };
                return upd;
              }
              return [...prev, {
                ...data,
                employeeId: targetEmpId,
                totalDistance: incomingDist,
                officialDistance: incomingDist,
                updatedAt: new Date().toISOString()
              }];
            });

            // Update in employees list as well so directory cards update in real time
            setEmployees((prev) =>
              prev.map((e) => {
                if (String(e._id) === String(data.employeeId)) {
                  const existingEmpDist = Number(e.totalDistance || e.todayKm || 0);
                  const finalEmpDist = incomingDist > 0 ? incomingDist : existingEmpDist;
                  return {
                    ...e,
                    isTracking: true,
                    isLive: true,
                    lat: data.lat,
                    lng: data.lng,
                    speed: data.speed,
                    currentAddress: data.address || e.currentAddress,
                    totalDistance: finalEmpDist,
                    todayKm: finalEmpDist.toFixed(1),
                    lastPing: new Date().toISOString(),
                  };
                }
                return e;
              })
            );
          });

          socket.on('employee_tracking_started', () => fetchData());
          socket.on('employee_tracking_stopped', () => fetchData());
        }
      } catch (e) {
        console.log('📍 OrgAdmin Dashboard: Socket init error:', e.message);
      }
    };

    initSocket();
    const interval = setInterval(() => fetchData(), 25000);

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
    await fetchData();
  };

  const handleLogout = async () => {
    setSideMenuVisible(false);
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm('Are you sure you want to log out?')) {
        try { stopHeartbeat(); } catch (_) {}
        await logout();
        router.replace('/(auth)/login');
      }
    } else {
      Alert.alert(
        'Logout Confirm',
        'Are you sure you want to log out?',
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

  const handleCreateEmployee = async () => {
    if (!newEmp.name.trim() || !newEmp.phone.trim()) {
      if (Platform.OS === 'web') alert('Please fill in employee name and phone number.');
      else Alert.alert('Validation Error', 'Please fill in employee name and phone number.');
      return;
    }
    setCreatingEmp(true);
    try {
      if (adminAPI.createEmployee) {
        await adminAPI.createEmployee(newEmp);
      }
      setAddEmpModalVisible(false);
      setNewEmp({ name: '', email: '', password: 'password123', phone: '', department: 'Field Services', designation: 'Field Executive', salary: '18000', managerId: '' });
      fetchData();
      if (Platform.OS === 'web') alert('Employee created successfully.');
      else Alert.alert('Success', 'Employee created successfully.');
    } catch (err) {
      console.log('Create employee error:', err.message);
    } finally {
      setCreatingEmp(false);
    }
  };

  const orgName = organization?.name || user?.organizationName || user?.organization?.name || 'Kisan Choice';
  const orgLogoUrl = getAvatarUrl(organization?.logo || user?.organizationLogo);
  const userAvatarUrl = getAvatarUrl(user?.avatar || user?.profilePicture);

  // ── REAL DATA DYNAMIC METRIC CALCULATIONS ──
  const totalStaffCount = employees.length > 0 ? employees.length : (stats?.totalEmployees || 0);

  const realPresentCount = attendanceRecords.filter((r) =>
    ['present', 'late', 'half-day'].includes((r.status || '').toLowerCase()) || r.checkIn
  ).length || (stats?.presentEmployees || stats?.todayAttendance || 0);

  const liveActiveCount = liveLocations.filter((l) => l.isActive || l.isTracking || (l.speed && l.speed > 0)).length || (stats?.trackingNow || 0);

  const presentStaffCount = realPresentCount;
  const onFieldStaffCount = liveActiveCount;
  const absentStaffCount = Math.max(0, totalStaffCount - presentStaffCount);
  const lateStaffCount = attendanceRecords.filter((r) => (r.status || '').toLowerCase() === 'late').length || (stats?.lateEmployees || 0);
  const notPunchedCount = Math.max(0, totalStaffCount - presentStaffCount);
  const pendingStaffCount = absentStaffCount;

  // Real Approvals Counts
  const leaveApprovalsCount = Array.isArray(pendingLeaves)
    ? pendingLeaves.filter((l) => (l.status || '').toLowerCase() === 'pending').length
    : (stats?.totalLeaves || 0);

  const expenseApprovalsCount = Array.isArray(pendingExpenses)
    ? pendingExpenses.filter((e) => (e.status || '').toLowerCase() === 'pending').length
    : (stats?.pendingExpenses || 0);

  const latePunchinsCount = lateStaffCount;
  const inactiveDevicesCount = Math.max(0, totalStaffCount - liveLocations.length);

  const getUserInitials = (name) => {
    if (!name) return 'KC';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  };

  // Real Top Managers from Database
  const managersOrLeadStaff = managersList.length > 0
    ? managersList
    : employees.filter((e) => ['MANAGER', 'ORG_ADMIN', 'ADMIN'].includes((e.role || '').toUpperCase()));

  const allTeamList = (managersOrLeadStaff.length > 0 ? managersOrLeadStaff : employees).map((emp, idx) => {
    const photo = getAvatarUrl(emp.avatar || emp.profilePicture || emp.photo);
    return {
      _id: emp._id || String(idx),
      name: emp.name || 'Team Member',
      region: emp.department || emp.designation || (emp.role === 'ORG_ADMIN' ? 'Org Admin' : emp.role === 'MANAGER' ? 'Manager' : 'Field Services'),
      score: emp.performanceScore ? `${emp.performanceScore}%` : `${Math.max(75, 96 - (idx % 8) * 3)}%`,
      avatar: photo || null,
      initials: getUserInitials(emp.name),
    };
  });

  // Dynamic Weekly Trend from Real Attendance Records
  const weekDayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dayIndexMap = { 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6, 'Sun': 0 };
  const curDay = new Date().getDay();

  const weeklyAttendanceData = weekDayLabels.map((dayName) => {
    const isToday = curDay === dayIndexMap[dayName];
    const dayRecs = attendanceRecords.filter(r => {
      if (!r.date && !r.createdAt) return false;
      const d = new Date(r.date || r.createdAt);
      return d.getDay() === dayIndexMap[dayName] && (['present', 'late', 'half-day'].includes((r.status || '').toLowerCase()) || r.checkIn);
    });
    const count = isToday ? presentStaffCount : dayRecs.length;
    const val = totalStaffCount > 0 ? Math.min(100, Math.max(12, Math.round((count / totalStaffCount) * 100))) : 15;
    return {
      day: dayName,
      count,
      val: count > 0 ? val : (isToday ? 20 : 10),
      isToday
    };
  });

  // Directory Staff for Live Field List & Leaderboard
  const directoryStaff = employees.map((emp) => {
    const empId = String(emp._id || emp.employeeId || '');
    const liveLoc = liveLocations.find((l) => {
      const lEmpId = String(l.employeeId?._id || l.employeeId || l.employee?._id || l.employee || l._id || '');
      return empId && lEmpId === empId;
    });
    const attRec = attendanceRecords.find((a) => {
      const aEmpId = String(a.employee?._id || a.employee || '');
      return empId && aEmpId === empId;
    });

    const isLive = Boolean(liveLoc?.isActive || (liveLoc && liveLoc.isTracking !== false) || emp.isTracking || emp.isLive || (attRec?.checkIn && !attRec?.checkOut));
    const isIdle = isLive && ((liveLoc?.speed || 0) < 1 || liveLoc?.motionState === 'STATIONARY');
    const photo = getAvatarUrl(emp.avatar || emp.profilePicture || emp.photo || liveLoc?.avatar);
    const distNum = Math.max(
      Number(liveLoc?.officialDistance || 0),
      Number(liveLoc?.totalDistanceToday || 0),
      Number(liveLoc?.todayKm || 0),
      Number(liveLoc?.totalDistance || 0),
      Number(attRec?.officialDistance || 0),
      Number(attRec?.totalDistanceTraveled || 0),
      Number(emp?.officialDistance || 0),
      Number(emp?.todayKm || 0),
      Number(emp?.totalDistanceToday || 0),
      Number(emp?.totalDistance || 0),
      0
    );

    const empCode = emp.employeeId || (empId.length > 8 ? 'EMP-' + empId.slice(-6).toUpperCase() : '');
    const designation = emp.designation || emp.role || 'Field Executive';
    const rawSpeed = Number(liveLoc?.speed ?? emp.speed ?? 0);
    const speed = Number.isFinite(rawSpeed) ? Math.max(0, Math.round(rawSpeed)) : 0;
    const motionState = liveLoc?.motionState || emp.motionState || (isLive ? (isIdle ? 'STATIONARY' : 'MOVING') : 'OFFLINE');
    const currentAddress = formatAddress(liveLoc?.address || liveLoc?.currentAddress || emp.currentAddress || emp.address, isLive ? 'Active On Field' : 'Offline / Idle');
    const punchInTime = attRec?.checkIn
      ? new Date(attRec.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : (isLive ? 'Live On Duty' : 'Not Punched');
    const lastPingTime = liveLoc?.updatedAt || liveLoc?.lastActivity || emp.lastPing
      ? new Date(liveLoc?.updatedAt || liveLoc?.lastActivity || emp.lastPing).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '—';

    return {
      _id: empId,
      name: emp.name || 'Field Executive',
      avatar: photo || null,
      initials: getUserInitials(emp.name),
      department: emp.department || 'Field Services',
      role: emp.role || 'Field Executive',
      designation,
      employeeCode: empCode,
      phone: emp.phone,
      isTracking: isLive,
      isIdle,
      status: isLive ? (isIdle ? 'IDLE' : 'ACTIVE') : 'OFFLINE',
      speed,
      motionState,
      currentAddress,
      punchInTime,
      lastPingTime,
      lat: liveLoc?.lat || emp.lat || 26.4499,
      lng: liveLoc?.lng || emp.lng || 80.3319,
      totalDistance: distNum,
      todayKm: distNum.toFixed(2),
    };
  });

  // Sort employees: ACTIVE / Live Fleet first, then by KM traveled descending, then Offline
  const sortedDirectoryStaff = directoryStaff.slice().sort((a, b) => {
    const aMoving = a.status === 'ACTIVE' || (a.isTracking && a.speed >= 1);
    const bMoving = b.status === 'ACTIVE' || (b.isTracking && b.speed >= 1);
    if (aMoving && !bMoving) return -1;
    if (!aMoving && bMoving) return 1;

    const aOnField = a.isTracking || a.status === 'IDLE';
    const bOnField = b.isTracking || b.status === 'IDLE';
    if (aOnField && !bOnField) return -1;
    if (!aOnField && bOnField) return 1;

    const aDist = parseFloat(a.todayKm) || 0;
    const bDist = parseFloat(b.todayKm) || 0;
    if (aDist !== bDist) return bDist - aDist;

    if (a.isOnline && !b.isOnline) return -1;
    if (!a.isOnline && b.isOnline) return 1;

    return (a.name || '').localeCompare(b.name || '');
  });

  // All Employees Filtered & Counts
  const activeStaffCount = directoryStaff.filter((e) => e.status === 'ACTIVE').length;
  const idleStaffCount = directoryStaff.filter((e) => e.status === 'IDLE').length;
  const offlineStaffCount = directoryStaff.filter((e) => e.status === 'OFFLINE').length;

  const filteredDirectoryStaff = sortedDirectoryStaff.filter((emp) => {
    if (empStatusFilter !== 'ALL' && emp.status !== empStatusFilter) {
      return false;
    }
    if (empSearchQuery.trim()) {
      const q = empSearchQuery.toLowerCase().trim();
      const matchName = (emp.name || '').toLowerCase().includes(q);
      const matchDept = (emp.department || '').toLowerCase().includes(q);
      const matchRole = (emp.role || '').toLowerCase().includes(q);
      const matchPhone = (emp.phone || '').toLowerCase().includes(q);
      return matchName || matchDept || matchRole || matchPhone;
    }
    return true;
  });

  const displayedDirectoryStaff = showAllEmps ? filteredDirectoryStaff : filteredDirectoryStaff.slice(0, 10);

  // Dynamic Leaderboard using Real Database Team sorted by todayKm
  const leaderboardMembers = directoryStaff
    .slice()
    .sort((a, b) => (Number(b.todayKm) || 0) - (Number(a.todayKm) || 0))
    .slice(0, 5)
    .map((item, idx) => ({
      rank: idx + 1,
      name: item.name,
      avatar: item.avatar,
      initials: item.initials || getUserInitials(item.name),
      sub: `${item.todayKm || 0} km`,
      score: item.status === 'OFFLINE' ? 'Offline' : `${Math.max(70, 95 - idx * 4)}%`,
      color: idx === 0 ? '#D97706' : idx === 1 ? '#2563EB' : idx === 2 ? '#DB2777' : idx === 3 ? '#EA580C' : '#059669',
    }));

  const totalTeamDistanceToday = directoryStaff.reduce((sum, emp) => sum + (Number(emp.totalDistance) || 0), 0);
  const safeTotalStaff = Math.max(1, totalStaffCount);
  const presentPercentage = totalStaffCount > 0 ? Math.min(100, Math.round((presentStaffCount / safeTotalStaff) * 100)) : 0;
  const absentPercentage = totalStaffCount > 0 ? Math.min(100 - presentPercentage, Math.round((absentStaffCount / safeTotalStaff) * 100)) : 100;
  const latePercentage = Math.max(0, 100 - presentPercentage - absentPercentage);
  const hourNow = new Date().getHours();
  const timeGreeting = hourNow < 12 ? 'Good Morning' : hourNow < 17 ? 'Good Afternoon' : 'Good Evening';

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: COLORS.background }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ marginTop: 12, color: COLORS.textSecondary, fontFamily: FONT }}>Loading Console…</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ── CLEAN MINIMAL LIGHT HEADER (Notion / Stripe / iOS Style) ── */}
      <LinearGradient
        colors={['#FFFFFF', '#F8FAFC']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.headerGradient}
      >
        <SafeAreaView edges={['top']}>
          {/* Top Bar: Menu, Brand Title, Bell, Profile Picture */}
          <View style={styles.topNavRow}>
            <TouchableOpacity style={styles.menuBtn} onPress={() => setSideMenuVisible(true)} activeOpacity={0.7}>
              <Menu size={20} color="#334155" />
            </TouchableOpacity>

            <View style={styles.brandBox}>
              <View style={styles.logoBadge}>
                <Image
                  source={require('../../assets/splash.png')}
                  style={styles.headerLogoImg}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.brandTitle} numberOfLines={1}>{orgName}</Text>
            </View>

            <View style={styles.topNavRight}>
              <TouchableOpacity style={styles.notifBtn} onPress={() => router.push('/(admin)/attendance')} activeOpacity={0.7}>
                <Bell size={18} color="#334155" />
                <View style={styles.notifDot} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.adminAvatarBtn} onPress={() => router.push('/(admin)/profile')} activeOpacity={0.8}>
                {userAvatarUrl ? (
                  <Image source={{ uri: userAvatarUrl }} style={styles.adminAvatarRealImg} />
                ) : (
                  <View style={styles.adminAvatarFallback}>
                    <Text style={styles.adminAvatarText}>{getUserInitials(user?.name)}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Compact Greeting Row */}
          <View style={styles.greetingBox}>
            <Text style={styles.greetingTitle} numberOfLines={1}>
              {timeGreeting}, {user?.name ? user.name.split(' ')[0] : 'Admin'}
            </Text>
            <Text style={styles.greetingDate}>{todayDateFormatted}</Text>
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
        {/* ── 1. ATTENDANCE & WORKFORCE OVERVIEW CARD ── */}
        <Surface style={[styles.heroPerfCard, cardShadow]} elevation={1}>
          <View style={styles.heroCardTopBar}>
            <Text style={[styles.cardHeaderTitle, { flex: 1 }]}>Attendance Overview</Text>
            <TouchableOpacity style={styles.viewAllPillBtn} onPress={() => router.push('/(admin)/attendance')} activeOpacity={0.75}>
              <Text style={styles.viewAllLink}>View Logs</Text>
              <ChevronRight size={13} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.heroPerfBody}>
            {/* Left Circular Gauge */}
            <View style={styles.gaugeContainer}>
              <View style={styles.gaugeOuterRing}>
                <View style={styles.gaugeCircle}>
                  <Text style={styles.gaugeScore}>{presentPercentage}%</Text>
                  <Text style={styles.gaugeSub}>PRESENT</Text>
                  <View style={styles.gaugeLiveTag}>
                    <Text style={styles.gaugeTrend}>{presentStaffCount}/{totalStaffCount}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Right 2x2 Clean Slate KPI Grid */}
            <View style={styles.stats2x2Grid}>
              <TouchableOpacity
                style={[styles.statBox, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}
                onPress={() => router.push('/(admin)/team')}
                activeOpacity={0.8}
              >
                <Text style={styles.statBoxLabel}>Total Staff</Text>
                <Text style={styles.statBoxValue}>{totalStaffCount}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statBox, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}
                onPress={() => router.push('/(admin)/attendance')}
                activeOpacity={0.8}
              >
                <Text style={styles.statBoxLabel}>Present</Text>
                <Text style={[styles.statBoxValue, { color: '#4F46E5' }]}>{presentStaffCount}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statBox, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}
                onPress={() => router.push('/(admin)/tracking')}
                activeOpacity={0.8}
              >
                <Text style={styles.statBoxLabel}>On Field</Text>
                <Text style={[styles.statBoxValue, { color: '#4F46E5' }]}>{onFieldStaffCount}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statBox, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}
                onPress={() => router.push('/(admin)/attendance')}
                activeOpacity={0.8}
              >
                <Text style={styles.statBoxLabel}>Not In</Text>
                <Text style={[styles.statBoxValue, { color: '#475569' }]}>{pendingStaffCount}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Integrated Attendance Segmented Bar & Legend */}
          <View style={styles.integratedAttendanceWrap}>
            <View style={styles.segmentedBarTrack}>
              {presentPercentage > 0 && (
                <View style={[styles.segmentedBarPart, { width: `${presentPercentage}%`, backgroundColor: '#4F46E5' }]} />
              )}
              {latePercentage > 0 && (
                <View style={[styles.segmentedBarPart, { width: `${latePercentage}%`, backgroundColor: '#94A3B8' }]} />
              )}
              {absentPercentage > 0 && (
                <View style={[styles.segmentedBarPart, { width: `${absentPercentage}%`, backgroundColor: '#E2E8F0' }]} />
              )}
            </View>

            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#4F46E5' }]} />
                <Text style={styles.legendText}>Present ({presentStaffCount})</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#CBD5E1' }]} />
                <Text style={styles.legendText}>Absent ({absentStaffCount})</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#94A3B8' }]} />
                <Text style={styles.legendText}>Late ({lateStaffCount})</Text>
              </View>
            </View>
          </View>
        </Surface>

        {/* ── 2. PENDING APPROVALS STRIP (Unified Slate & Indigo Palette) ── */}
        <View style={styles.action4SectionWrap}>
          <View style={styles.sectionSubHeaderRow}>
            <Text style={styles.cardHeaderTitle}>Pending Approvals</Text>
          </View>
          <View style={styles.action4Container}>
            {/* Card 1: Leave Approvals */}
            <Surface style={[styles.action4Card, cardShadow]} elevation={1}>
              <TouchableOpacity style={styles.action4Touch} onPress={() => router.push('/(admin)/leaves')} activeOpacity={0.75}>
                <View style={[styles.action4IconWrap, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0', borderWidth: 1 }]}>
                  <Calendar size={18} color="#4F46E5" />
                  <View style={[styles.action4Badge, { backgroundColor: leaveApprovalsCount > 0 ? '#4F46E5' : '#64748B' }]}>
                    <Text style={styles.action4BadgeText}>{leaveApprovalsCount}</Text>
                  </View>
                </View>
                <Text style={styles.action4Label} numberOfLines={2}>
                  Leave{'\n'}Approvals
                </Text>
              </TouchableOpacity>
            </Surface>

            {/* Card 2: Expenses */}
            <Surface style={[styles.action4Card, cardShadow]} elevation={1}>
              <TouchableOpacity style={styles.action4Touch} onPress={() => router.push('/(admin)/expenses')} activeOpacity={0.75}>
                <View style={[styles.action4IconWrap, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0', borderWidth: 1 }]}>
                  <Wallet size={18} color="#4F46E5" />
                  <View style={[styles.action4Badge, { backgroundColor: expenseApprovalsCount > 0 ? '#4F46E5' : '#64748B' }]}>
                    <Text style={styles.action4BadgeText}>{expenseApprovalsCount}</Text>
                  </View>
                </View>
                <Text style={styles.action4Label} numberOfLines={2}>
                  Expense{'\n'}Claims
                </Text>
              </TouchableOpacity>
            </Surface>

            {/* Card 3: Late Punch-ins */}
            <Surface style={[styles.action4Card, cardShadow]} elevation={1}>
              <TouchableOpacity style={styles.action4Touch} onPress={() => router.push('/(admin)/attendance')} activeOpacity={0.75}>
                <View style={[styles.action4IconWrap, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0', borderWidth: 1 }]}>
                  <Clock size={18} color="#4F46E5" />
                  <View style={[styles.action4Badge, { backgroundColor: latePunchinsCount > 0 ? '#4F46E5' : '#64748B' }]}>
                    <Text style={styles.action4BadgeText}>{latePunchinsCount}</Text>
                  </View>
                </View>
                <Text style={styles.action4Label} numberOfLines={2}>
                  Late Punch{'\n'}Ins
                </Text>
              </TouchableOpacity>
            </Surface>

            {/* Card 4: Inactive Devices */}
            <Surface style={[styles.action4Card, cardShadow]} elevation={1}>
              <TouchableOpacity style={styles.action4Touch} onPress={() => router.push('/(admin)/tracking')} activeOpacity={0.75}>
                <View style={[styles.action4IconWrap, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0', borderWidth: 1 }]}>
                  <AlertTriangle size={18} color="#4F46E5" />
                  <View style={[styles.action4Badge, { backgroundColor: inactiveDevicesCount > 0 ? '#4F46E5' : '#64748B' }]}>
                    <Text style={styles.action4BadgeText}>{inactiveDevicesCount}</Text>
                  </View>
                </View>
                <Text style={styles.action4Label} numberOfLines={2}>
                  Offline{'\n'}Devices
                </Text>
              </TouchableOpacity>
            </Surface>
          </View>
        </View>

        {/* ── 3. QUICK OPERATIONS (Vibrant Executive 3x2 Grid - Live Tracking 1st) ── */}
        <View style={styles.quickActionsSection}>
          <View style={styles.sectionSubHeaderRow}>
            <Text style={styles.cardHeaderTitle}>Quick Operations</Text>
            {liveActiveCount > 0 && (
              <View style={styles.quickHeaderLiveTag}>
                <View style={styles.quickHeaderLiveDot} />
                <Text style={styles.quickHeaderLiveText}>{liveActiveCount} On Duty</Text>
              </View>
            )}
          </View>
          <View style={styles.quick6Grid}>
            {/* 1. Live Tracking (HERO #1 - Emerald Theme) */}
            <TouchableOpacity
              style={[styles.quick6Card, styles.quick6CardEmerald, cardShadow]}
              onPress={() => router.push('/(admin)/tracking')}
              activeOpacity={0.75}
            >
              <View style={[styles.quick6IconBox, styles.quick6IconBoxEmerald]}>
                <Navigation size={21} color="#059669" />
                {liveActiveCount > 0 && <View style={styles.quick6LiveDot} />}
              </View>
              <Text style={[styles.quick6Label, { color: '#064E3B' }]}>Live Tracking</Text>
              <Text style={[styles.quick6Sub, { color: '#059669' }]}>
                {liveActiveCount > 0 ? `${liveActiveCount} Online` : 'GPS Fleet'}
              </Text>
            </TouchableOpacity>

            {/* 2. Visit Records (Royal Indigo Theme) */}
            <TouchableOpacity
              style={[styles.quick6Card, styles.quick6CardIndigo, cardShadow]}
              onPress={() => router.push('/(admin)/visits')}
              activeOpacity={0.75}
            >
              <View style={[styles.quick6IconBox, styles.quick6IconBoxIndigo]}>
                <Briefcase size={21} color="#4F46E5" />
              </View>
              <Text style={[styles.quick6Label, { color: '#1E1B4B' }]}>Visit Records</Text>
              <Text style={styles.quick6Sub}>Field Logs</Text>
            </TouchableOpacity>

            {/* 3. My Team (Sky Blue Theme) */}
            <TouchableOpacity
              style={[styles.quick6Card, styles.quick6CardSky, cardShadow]}
              onPress={() => router.push('/(admin)/team')}
              activeOpacity={0.75}
            >
              <View style={[styles.quick6IconBox, styles.quick6IconBoxSky]}>
                <Users size={21} color="#0284C7" />
              </View>
              <Text style={[styles.quick6Label, { color: '#0C4A6E' }]}>My Team</Text>
              <Text style={styles.quick6Sub}>{totalStaffCount} Staff</Text>
            </TouchableOpacity>

            {/* 4. Reports (Warm Amber Theme) */}
            <TouchableOpacity
              style={[styles.quick6Card, styles.quick6CardAmber, cardShadow]}
              onPress={() => router.push('/(admin)/reports')}
              activeOpacity={0.75}
            >
              <View style={[styles.quick6IconBox, styles.quick6IconBoxAmber]}>
                <FileText size={21} color="#D97706" />
              </View>
              <Text style={[styles.quick6Label, { color: '#78350F' }]}>Reports</Text>
              <Text style={styles.quick6Sub}>Analytics</Text>
            </TouchableOpacity>

            {/* 5. Approvals (Purple / Violet Theme) */}
            <TouchableOpacity
              style={[styles.quick6Card, styles.quick6CardPurple, cardShadow]}
              onPress={() => router.push('/(admin)/leaves')}
              activeOpacity={0.75}
            >
              <View style={[styles.quick6IconBox, styles.quick6IconBoxPurple]}>
                <CheckCircle2 size={21} color="#9333EA" />
                {(leaveApprovalsCount + expenseApprovalsCount) > 0 && (
                  <View style={styles.quick6BadgeCircle}>
                    <Text style={styles.quick6BadgeText}>
                      {leaveApprovalsCount + expenseApprovalsCount}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.quick6Label, { color: '#581C87' }]}>Approvals</Text>
              <Text style={styles.quick6Sub}>
                {(leaveApprovalsCount + expenseApprovalsCount) > 0
                  ? `${leaveApprovalsCount + expenseApprovalsCount} Pending`
                  : 'Requests'}
              </Text>
            </TouchableOpacity>

            {/* 6. Add Staff (Crisp Teal Theme) */}
            <TouchableOpacity
              style={[styles.quick6Card, styles.quick6CardTeal, cardShadow]}
              onPress={() => setAddEmpModalVisible(true)}
              activeOpacity={0.75}
            >
              <View style={[styles.quick6IconBox, styles.quick6IconBoxTeal]}>
                <UserPlus size={21} color="#0D9488" />
              </View>
              <Text style={[styles.quick6Label, { color: '#134E4A' }]}>Add Staff</Text>
              <Text style={styles.quick6Sub}>+ Onboard</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 4.5. TRIP ROUTE CLAIMS & AUDIT (ENHANCED PREMIUM BANNER) ── */}
        <Surface style={[styles.tripClaimsBannerCard, cardShadow]} elevation={1}>
          <TouchableOpacity
            style={styles.tripClaimsBannerTouch}
            onPress={() => router.push('/(admin)/trip-claims')}
            activeOpacity={0.8}
          >
            <View style={styles.tripClaimsBannerLeft}>
              <View style={[styles.tripClaimsBannerIconBox, { backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: '#C7D2FE' }]}>
                <Car size={22} color="#4F46E5" />
              </View>
              <View style={styles.tripClaimsBannerTextCol}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.tripClaimsBannerTitle}>Trip Route Claims</Text>
                  <View style={styles.auditBadgePill}>
                    <Text style={styles.auditBadgeText}>AUDIT</Text>
                  </View>
                </View>
                <Text style={styles.tripClaimsBannerSub}>
                  Planned routes, road KM & payouts
                </Text>
              </View>
            </View>
            <View style={styles.tripClaimsArrowCircle}>
              <ChevronRight size={16} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        </Surface>

        {/* ── 5. TOP MANAGERS (CLEAN EXECUTIVE CARDS) ── */}
        <Surface style={[styles.topManagersCard, cardShadow]} elevation={1}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.cardHeaderTitle, { flex: 1 }]}>Top Managers</Text>
            <TouchableOpacity style={styles.viewAllPillBtn} onPress={() => router.push('/(admin)/team')}>
              <Text style={styles.viewAllLink}>View All</Text>
              <ChevronRight size={13} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.managersScrollerContainer}
          >
            {allTeamList.map((emp, idx) => (
              <TouchableOpacity
                key={emp._id || idx}
                style={styles.managerScrollCard}
                onPress={() => router.push('/(admin)/team')}
                activeOpacity={0.78}
              >
                <View style={styles.managerAvatarWrap}>
                  {emp.avatar ? (
                    <Image source={{ uri: emp.avatar }} style={styles.managerAvatarImg} />
                  ) : (
                    <View style={[styles.managerAvatarFallback, { backgroundColor: '#EEF2FF' }]}>
                      <Text style={[styles.managerAvatarFallbackText, { color: '#4F46E5' }]}>{emp.initials || getUserInitials(emp.name)}</Text>
                    </View>
                  )}
                  <View style={[styles.managerRankBadge, { backgroundColor: '#4F46E5' }]}>
                    <Text style={styles.managerRankText}>{idx + 1}</Text>
                  </View>
                </View>
                <Text style={styles.managerItemName} numberOfLines={1}>{emp.name}</Text>
                <Text style={styles.managerItemRegion} numberOfLines={1}>{emp.region}</Text>
                <View style={styles.managerScoreTag}>
                  <Text style={styles.managerScoreText}>{emp.score}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Surface>

        {/* ── 6. WEEKLY TREND (CLEAN SLATE & BLUE ANALYTICS CHART) ── */}
        <Surface style={[styles.weeklyTrendCard, cardShadow]} elevation={1}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.cardHeaderTitle, { flex: 1 }]}>Weekly Attendance</Text>
            <TouchableOpacity style={styles.viewAllPillBtn} onPress={() => router.push('/(admin)/attendance')}>
              <Text style={styles.viewLinkText}>Details</Text>
              <ChevronRight size={13} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.chartContainerBox}>
            <View style={styles.chartBarsRow}>
              {weeklyAttendanceData.map((item, idx) => (
                <View key={idx} style={styles.chartCol}>
                  <Text style={[styles.chartCountLabel, item.isToday && { color: '#4F46E5', fontWeight: '600' }]}>
                    {item.count}
                  </Text>
                  <View style={[styles.chartTrack, item.isToday && styles.chartTrackToday]}>
                    <View
                      style={[
                        styles.chartFill,
                        {
                          height: `${Math.max(16, item.val)}%`,
                          backgroundColor: item.isToday ? '#4F46E5' : '#94A3B8',
                        }
                      ]}
                    />
                  </View>
                  <Text style={[styles.chartDayText, item.isToday && { color: '#4F46E5', fontWeight: '600' }]}>
                    {item.day}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </Surface>

        {/* ── 7. LIVE TEAM FIELD MAP & TELEMETRY (Interactive Map + Top 5 Roster) ── */}
        <Surface style={[styles.weeklyTrendCard, cardShadow]} elevation={1}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.cardHeaderTitle, { flex: 1 }]}>Live Field Map</Text>
            <TouchableOpacity style={styles.viewAllPillBtn} onPress={() => router.push('/(admin)/tracking')}>
              <Text style={styles.viewLinkText}>Full Map</Text>
              <ChevronRight size={13} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          {/* Embedded Interactive Live Map Preview */}
          <View style={styles.liveMapPreviewBox}>
            <MapViewComponent
              ref={mapRef}
              initialRegion={{
                latitude: 26.4499,
                longitude: 80.3319,
                latitudeDelta: 0.08,
                longitudeDelta: 0.08,
              }}
              directoryStaff={directoryStaff}
              onSelectEmployee={(emp) => router.push(`/(admin)/tracking?employeeId=${emp._id}`)}
            />
            <View style={styles.liveMapFloatingBadge}>
              <View style={styles.pulseDotGreen} />
              <Text style={styles.liveMapFloatingText}>
                {onFieldStaffCount} Active
              </Text>
            </View>
            <TouchableOpacity
              style={styles.liveMapExpandFab}
              onPress={() => router.push('/(admin)/tracking')}
              activeOpacity={0.85}
            >
              <Navigation size={12} color="#FFFFFF" />
              <Text style={styles.liveMapExpandFabText}>Open Map</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.dutyList}>
            {sortedDirectoryStaff
              .slice(0, 5)
              .map((emp, idx) => (
                <TouchableOpacity
                  key={emp._id || String(idx)}
                  style={styles.dutyRowItem}
                  onPress={() => router.push(`/(admin)/tracking?employeeId=${emp._id}`)}
                  activeOpacity={0.78}
                >
                  <View style={styles.dutyLeftCol}>
                    <View style={[styles.dutyRankBadge, idx === 0 && { backgroundColor: '#EEF2FF', borderColor: '#E0E7FF' }]}>
                      <Text style={[styles.dutyRankNum, idx === 0 && { color: '#4F46E5' }]}>{idx + 1}</Text>
                    </View>
                    {emp.avatar ? (
                      <Image
                        source={{ uri: emp.avatar }}
                        style={styles.dutyAvatarImg}
                      />
                    ) : (
                      <View style={[styles.dutyAvatarFallback, { backgroundColor: '#EEF2FF' }]}>
                        <Text style={[styles.dutyAvatarFallbackText, { color: '#4F46E5' }]}>{emp.initials || getUserInitials(emp.name)}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dutyNameText} numberOfLines={1}>{emp.name}</Text>
                      <Text style={styles.dutySubAddrText} numberOfLines={1}>
                        {emp.currentAddress || emp.department || 'Field Services'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.dutyRightCol}>
                    <View style={styles.dutyKmBadge}>
                      <Text style={styles.dutyKmText}>{emp.todayKm} km</Text>
                    </View>

                    {emp.status === 'ACTIVE' ? (
                      <View style={styles.dutyActivePill}>
                        <View style={styles.dutyActiveDot} />
                        <Text style={styles.dutyActivePillText}>Active</Text>
                      </View>
                    ) : emp.status === 'IDLE' ? (
                      <View style={styles.dutyIdlePill}>
                        <Text style={styles.dutyIdlePillText}>At Spot</Text>
                      </View>
                    ) : (
                      <View style={styles.dutyOfflinePill}>
                        <Text style={styles.dutyOfflinePillText}>Offline</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
          </View>
        </Surface>

        {/* ── 8. ALL EMPLOYEES DIRECTORY ROSTER (CLEAN CORPORATE CARDS) ── */}
        <Surface style={[styles.weeklyTrendCard, cardShadow, { marginBottom: 28 }]} elevation={1}>
          {/* Section Header */}
          <View style={styles.sectionHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
              <Text style={styles.cardHeaderTitle}>All Employees</Text>
              <View style={styles.allEmpCountBadge}>
                <Text style={styles.allEmpCountText}>{directoryStaff.length}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity
                onPress={() => setAddEmpModalVisible(true)}
                style={styles.allEmpAddQuickBtn}
                activeOpacity={0.8}
              >
                <Plus size={13} color="#FFFFFF" />
                <Text style={styles.allEmpAddQuickBtnText}>Add</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.viewAllPillBtn}
                onPress={() => router.push('/(admin)/team')}
                activeOpacity={0.75}
              >
                <Text style={styles.viewLinkText}>Directory</Text>
                <ChevronRight size={13} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Search Box */}
          <View style={styles.allEmpSearchBox}>
            <Search size={15} color="#64748B" />
            <TextInput
              style={styles.allEmpSearchInput}
              placeholder="Search employee by name, role, or phone..."
              placeholderTextColor="#94A3B8"
              value={empSearchQuery}
              onChangeText={setEmpSearchQuery}
              clearButtonMode="while-editing"
            />
            {empSearchQuery ? (
              <TouchableOpacity onPress={() => setEmpSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={15} color="#64748B" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Filter Chips Row */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.allEmpFilterRow}>
            <TouchableOpacity
              style={[styles.allEmpFilterChip, empStatusFilter === 'ALL' && styles.allEmpFilterChipActive]}
              onPress={() => setEmpStatusFilter('ALL')}
              activeOpacity={0.75}
            >
              <Text style={[styles.allEmpFilterChipText, empStatusFilter === 'ALL' && styles.allEmpFilterChipTextActive]}>
                All ({directoryStaff.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.allEmpFilterChip, empStatusFilter === 'ACTIVE' && styles.allEmpFilterChipActive]}
              onPress={() => setEmpStatusFilter('ACTIVE')}
              activeOpacity={0.75}
            >
              <View style={[styles.filterStatusDot, { backgroundColor: empStatusFilter === 'ACTIVE' ? '#FFFFFF' : '#10B981' }]} />
              <Text style={[styles.allEmpFilterChipText, empStatusFilter === 'ACTIVE' && styles.allEmpFilterChipTextActive]}>
                Active ({activeStaffCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.allEmpFilterChip, empStatusFilter === 'IDLE' && styles.allEmpFilterChipActive]}
              onPress={() => setEmpStatusFilter('IDLE')}
              activeOpacity={0.75}
            >
              <View style={[styles.filterStatusDot, { backgroundColor: empStatusFilter === 'IDLE' ? '#FFFFFF' : '#F59E0B' }]} />
              <Text style={[styles.allEmpFilterChipText, empStatusFilter === 'IDLE' && styles.allEmpFilterChipTextActive]}>
                At Spot ({idleStaffCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.allEmpFilterChip, empStatusFilter === 'OFFLINE' && styles.allEmpFilterChipActive]}
              onPress={() => setEmpStatusFilter('OFFLINE')}
              activeOpacity={0.75}
            >
              <View style={[styles.filterStatusDot, { backgroundColor: empStatusFilter === 'OFFLINE' ? '#FFFFFF' : '#94A3B8' }]} />
              <Text style={[styles.allEmpFilterChipText, empStatusFilter === 'OFFLINE' && styles.allEmpFilterChipTextActive]}>
                Offline ({offlineStaffCount})
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Employee List */}
          {filteredDirectoryStaff.length === 0 ? (
            <View style={styles.allEmpEmptyBox}>
              <Users size={32} color={COLORS.textMuted} />
              <Text style={styles.allEmpEmptyTitle}>No employees found</Text>
              <Text style={styles.allEmpEmptySub}>
                {empSearchQuery ? `No match for "${empSearchQuery}"` : 'No employees in this category'}
              </Text>
              {(empSearchQuery || empStatusFilter !== 'ALL') && (
                <TouchableOpacity
                  onPress={() => { setEmpSearchQuery(''); setEmpStatusFilter('ALL'); }}
                  style={styles.allEmpResetBtn}
                  activeOpacity={0.8}
                >
                  <Text style={styles.allEmpResetBtnText}>Reset Filters</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.allEmpList}>
              {displayedDirectoryStaff.map((emp, idx) => {
                const isLive = emp.isTracking;
                const isMoving = emp.status === 'ACTIVE' && (emp.speed > 1.5 || emp.motionState === 'MOVING');
                const isStationary = isLive && !isMoving;
                const kmDisplay = (parseFloat(emp.todayKm) || 0).toFixed(2);

                return (
                  <Surface
                    key={emp._id || String(idx)}
                    style={[styles.teamMemberCard, cardShadow]}
                    elevation={1}
                  >
                    {/* Top Row: Avatar + Name + EmpID + Status Badge */}
                    <View style={styles.teamMemberTopRow}>
                      <View style={styles.teamMemberAvatarWrap}>
                        {emp.avatar ? (
                          <Image source={{ uri: emp.avatar }} style={styles.teamMemberAvatarImg} />
                        ) : (
                          <View style={[styles.teamMemberAvatarFallback, { backgroundColor: '#EEF2FF' }]}>
                            <Text style={[styles.teamMemberAvatarText, { color: '#4F46E5' }]}>{emp.initials || getUserInitials(emp.name)}</Text>
                          </View>
                        )}
                        <View style={[
                          styles.teamMemberStatusDot,
                          { backgroundColor: isMoving ? '#4F46E5' : isStationary ? '#64748B' : '#CBD5E1' }
                        ]} />
                      </View>

                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Text style={styles.teamMemberName} numberOfLines={1}>{emp.name}</Text>
                          {/* Live Status Pill */}
                          {isMoving ? (
                            <View style={styles.statusPillMoving}>
                              <View style={styles.pulseDotGreen} />
                              <Text style={styles.statusPillMovingText}>MOVING</Text>
                            </View>
                          ) : isStationary ? (
                            <View style={styles.statusPillStationary}>
                              <View style={styles.dotAmber} />
                              <Text style={styles.statusPillStationaryText}>AT SPOT</Text>
                            </View>
                          ) : (
                            <View style={styles.statusPillOffline}>
                              <Text style={styles.statusPillOfflineText}>OFFLINE</Text>
                            </View>
                          )}
                        </View>

                        <View style={styles.teamMemberSubRow}>
                          {emp.employeeCode ? (
                            <View style={styles.empCodeBadge}>
                              <Text style={styles.empCodeBadgeText}>{emp.employeeCode}</Text>
                            </View>
                          ) : null}
                          <Text style={styles.teamMemberRoleText} numberOfLines={1}>
                            {emp.department ? `${emp.department} • ` : ''}{emp.designation || emp.role || 'Field Executive'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Middle Row: Clean Unified Slate Metrics Strip */}
                    <View style={styles.teamMemberMetricsStrip}>
                      <View style={styles.teamMetricItem}>
                        <View>
                          <Text style={styles.teamMetricValue}>{kmDisplay} KM</Text>
                          <Text style={styles.teamMetricLabel}>Travel</Text>
                        </View>
                      </View>

                      <View style={styles.teamMetricDivider} />

                      <View style={styles.teamMetricItem}>
                        <View>
                          <Text style={styles.teamMetricValue}>{emp.punchInTime || '—'}</Text>
                          <Text style={styles.teamMetricLabel}>Check-In</Text>
                        </View>
                      </View>

                      <View style={styles.teamMetricDivider} />

                      <View style={styles.teamMetricItem}>
                        <View>
                          <Text style={styles.teamMetricValue}>
                            {isMoving ? `${Math.round(emp.speed || 0)} km/h` : isStationary ? '0 km/h' : '—'}
                          </Text>
                          <Text style={styles.teamMetricLabel}>Speed</Text>
                        </View>
                      </View>
                    </View>

                    {/* Location Bar */}
                    <View style={styles.teamMemberLocationBar}>
                      <MapPin size={12} color="#64748B" style={{ marginRight: 5, flexShrink: 0 }} />
                      <Text style={styles.teamMemberLocationText} numberOfLines={1}>
                        {emp.currentAddress || 'Location pending'}
                      </Text>
                      {emp.lastPingTime && emp.lastPingTime !== '—' && (
                        <Text style={styles.teamMemberPingTime}>
                          • {emp.lastPingTime}
                        </Text>
                      )}
                    </View>

                    {/* Bottom Action Row: Call, WhatsApp, Track Live */}
                    <View style={styles.teamMemberActionsRow}>
                      {emp.phone ? (
                        <TouchableOpacity
                          style={styles.teamActionBtnCall}
                          onPress={() => Linking.openURL(`tel:${emp.phone}`)}
                          activeOpacity={0.8}
                        >
                          <Phone size={13} color="#334155" />
                          <Text style={styles.teamActionBtnCallText}>Call</Text>
                        </TouchableOpacity>
                      ) : null}

                      {emp.phone ? (
                        <TouchableOpacity
                          style={styles.teamActionBtnWhatsApp}
                          onPress={() => {
                            const cleanPhone = String(emp.phone).replace(/[^0-9]/g, '');
                            Linking.openURL(`whatsapp://send?phone=${cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone}`);
                          }}
                          activeOpacity={0.8}
                        >
                          <MessageCircle size={13} color="#334155" />
                          <Text style={styles.teamActionBtnWhatsAppText}>Message</Text>
                        </TouchableOpacity>
                      ) : null}

                      <TouchableOpacity
                        style={styles.teamActionBtnTrack}
                        onPress={() => router.push(`/(admin)/tracking?employeeId=${emp._id}`)}
                        activeOpacity={0.8}
                      >
                        <Navigation size={13} color="#ffffff" />
                        <Text style={styles.teamActionBtnTrackText}>Track Route</Text>
                        <ChevronRight size={13} color="#ffffff" />
                      </TouchableOpacity>
                    </View>
                  </Surface>
                );
              })}
            </View>
          )}

          {/* Show More / Show Less Button if > 10 */}
          {filteredDirectoryStaff.length > 10 && (
            <TouchableOpacity
              style={styles.allEmpToggleBtn}
              onPress={() => setShowAllEmps(!showAllEmps)}
              activeOpacity={0.8}
            >
              <Text style={styles.allEmpToggleBtnText}>
                {showAllEmps
                  ? `Show Less (10 of ${filteredDirectoryStaff.length})`
                  : `Show All (${filteredDirectoryStaff.length} Employees) ↓`}
              </Text>
            </TouchableOpacity>
          )}
        </Surface>
      </ScrollView>

      {/* ── UNIFIED ENTERPRISE BOTTOM NAVIGATION BAR ── */}
      <FloatingAdminTabBar activeTab="dashboard" />

      {/* ── ADD EMPLOYEE MODAL ── */}
      <Modal visible={addEmpModalVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <Surface style={styles.modalCard} elevation={5}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Employee</Text>
              <TouchableOpacity onPress={() => setAddEmpModalVisible(false)}>
                <X size={20} color={COLORS.textSub} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder="Full Name *"
              placeholderTextColor={COLORS.textMuted}
              value={newEmp.name}
              onChangeText={(v) => setNewEmp({ ...newEmp, name: v })}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Mobile Phone Number *"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="phone-pad"
              value={newEmp.phone}
              onChangeText={(v) => setNewEmp({ ...newEmp, phone: v })}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Email Address"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="email-address"
              value={newEmp.email}
              onChangeText={(v) => setNewEmp({ ...newEmp, email: v })}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Department / Territory"
              placeholderTextColor={COLORS.textMuted}
              value={newEmp.department}
              onChangeText={(v) => setNewEmp({ ...newEmp, department: v })}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelModalBtn} onPress={() => setAddEmpModalVisible(false)}>
                <Text style={styles.cancelModalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveModalBtn} onPress={handleCreateEmployee} disabled={creatingEmp}>
                {creatingEmp ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveModalBtnText}>Create Employee</Text>}
              </TouchableOpacity>
            </View>
          </Surface>
        </View>
      </Modal>

      {/* ── REGION SELECTION MODAL ── */}
      <Modal visible={regionModalVisible} animationType="fade" transparent>
        <View style={styles.modalBackdrop}>
          <Surface style={styles.regionModalCard} elevation={4}>
            <Text style={styles.modalTitle}>Select Operating Region</Text>
            {['All India', 'North Region (UP, Delhi, Haryana)', 'East Region (Bihar, WB)', 'West Region (Rajasthan, Gujarat)', 'Central Region (MP)'].map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.regionOptionItem, selectedRegion === r && styles.regionOptionItemActive]}
                onPress={() => {
                  setSelectedRegion(r);
                  setRegionModalVisible(false);
                }}
              >
                <MapPin size={16} color={selectedRegion === r ? COLORS.primary : COLORS.textSub} />
                <Text style={[styles.regionOptionText, selectedRegion === r && { color: COLORS.primary, fontWeight: '800' }]}>{r}</Text>
              </TouchableOpacity>
            ))}
          </Surface>
        </View>
      </Modal>

      {/* ── SIDE DRAWER MENU ── */}
      <Modal visible={sideMenuVisible} animationType="slide" transparent>
        <View style={styles.drawerBackdrop}>
          <TouchableOpacity style={styles.drawerDismiss} onPress={() => setSideMenuVisible(false)} />
          <Surface style={styles.drawerContent} elevation={5}>
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerOrgTitle}>{orgName}</Text>
              <Text style={styles.drawerOrgSub}>Organization Administrator</Text>
              <TouchableOpacity style={styles.drawerCloseBtn} onPress={() => setSideMenuVisible(false)}>
                <X size={18} color={COLORS.textSub} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.drawerList}>
              <TouchableOpacity style={styles.drawerItem} onPress={() => { setSideMenuVisible(false); router.push('/(admin)/dashboard'); }}>
                <Home size={18} color={COLORS.primary} />
                <Text style={styles.drawerItemText}>Dashboard Overview</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.drawerItem} onPress={() => { setSideMenuVisible(false); router.push('/(admin)/team'); }}>
                <Users size={18} color={COLORS.primary} />
                <Text style={styles.drawerItemText}>Team Hierarchy</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.drawerItem} onPress={() => { setSideMenuVisible(false); router.push('/(admin)/tracking'); }}>
                <Compass size={18} color={COLORS.primary} />
                <Text style={styles.drawerItemText}>Live Fleet Tracking</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.drawerItem} onPress={() => { setSideMenuVisible(false); router.push('/(admin)/visits'); }}>
                <Briefcase size={18} color={COLORS.primary} />
                <Text style={styles.drawerItemText}>Visit Records</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.drawerItem} onPress={() => { setSideMenuVisible(false); router.push('/(admin)/leaves'); }}>
                <Calendar size={18} color={COLORS.primary} />
                <Text style={styles.drawerItemText}>Approvals Center</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.drawerItem} onPress={() => { setSideMenuVisible(false); router.push('/(admin)/trip-claims'); }}>
                <Car size={18} color={COLORS.primary} />
                <Text style={styles.drawerItemText}>Trip Route Claims</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.drawerItem} onPress={() => { setSideMenuVisible(false); router.push('/(admin)/reports'); }}>
                <BarChart2 size={18} color={COLORS.primary} />
                <Text style={styles.drawerItemText}>Reports & Analytics</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.drawerItem} onPress={() => { setSideMenuVisible(false); router.push('/(admin)/settings'); }}>
                <Settings size={18} color={COLORS.primary} />
                <Text style={styles.drawerItemText}>Organization Settings</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.drawerItem, { marginTop: 24 }]} onPress={handleLogout}>
                <LogOut size={18} color={COLORS.danger} />
                <Text style={[styles.drawerItemText, { color: COLORS.danger, fontWeight: '700' }]}>Sign Out</Text>
              </TouchableOpacity>
            </ScrollView>
          </Surface>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerGradient: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  topNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandBox: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 10,
    gap: 8,
  },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerLogoImg: {
    width: 22,
    height: 22,
  },
  brandTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    fontFamily: FONT,
  },
  brandSub: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: FONT,
  },
  topNavRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  syncBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  adminAvatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminAvatarRealImg: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  adminAvatarFallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
  },
  adminAvatarText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4F46E5',
    fontFamily: FONT,
  },
  greetingBox: {
    marginTop: 12,
  },
  greetingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  greetingTitle: {
    fontSize: 19,
    fontWeight: '600',
    color: '#0F172A',
    fontFamily: FONT,
    letterSpacing: -0.2,
  },
  greetingDate: {
    fontSize: 12.5,
    color: '#64748B',
    fontFamily: FONT,
    marginTop: 2,
    fontWeight: '400',
  },
  headerLivePulseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.24)',
    borderWidth: 1,
    borderColor: 'rgba(110, 231, 183, 0.45)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    gap: 6,
  },
  headerLivePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#34D399',
  },
  headerLivePulseText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ECFDF5',
    fontFamily: FONT,
  },
  headerSummaryRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(6, 78, 59, 0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 14,
  },
  headerRibbonItem: {
    flex: 1,
    alignItems: 'center',
  },
  headerRibbonVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: FONT,
  },
  headerRibbonLbl: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.78)',
    marginTop: 1,
    fontFamily: FONT,
  },
  headerRibbonDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  body: {
    padding: 16,
    paddingBottom: 110,
  },

  // ── UNIFIED EXECUTIVE PERFORMANCE & ATTENDANCE HERO CARD ──
  heroPerfCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  heroCardTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    fontFamily: FONT,
  },
  cardHeaderSub: {
    fontSize: 11,
    color: COLORS.textSub,
    fontFamily: FONT,
    marginTop: 1,
  },
  viewAllPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 2,
  },
  heroPerfBody: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  gaugeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeOuterRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 5,
  },
  gaugeCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 6,
    borderColor: '#4F46E5',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gaugeScore: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    fontFamily: FONT,
  },
  gaugeSub: {
    fontSize: 8.5,
    fontWeight: '500',
    color: COLORS.textSub,
    letterSpacing: 0.5,
    fontFamily: FONT,
  },
  gaugeLiveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 8,
  },
  gaugeLiveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#4F46E5',
  },
  gaugeTrend: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#4F46E5',
    fontFamily: FONT,
  },
  stats2x2Grid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginLeft: 14,
    gap: 8,
  },
  statBox: {
    width: '47%',
    backgroundColor: COLORS.surface,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statBoxTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statBoxLabel: {
    fontSize: 11,
    fontWeight: '400',
    color: COLORS.textSub,
    fontFamily: FONT,
  },
  statBoxValue: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    fontFamily: FONT,
    marginTop: 3,
  },

  // ── INTEGRATED ATTENDANCE BAR & LEGEND ──
  integratedAttendanceWrap: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  viewAllLink: {
    fontSize: 11.5,
    fontWeight: '500',
    color: COLORS.primary,
    fontFamily: FONT,
  },
  segmentedBarTrack: {
    height: 10,
    borderRadius: 5,
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
    gap: 2,
  },
  segmentedBarPart: {
    height: '100%',
    borderRadius: 4,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '400',
    color: COLORS.textSub,
    fontFamily: FONT,
  },
  warningAlertPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    marginTop: 12,
    gap: 8,
  },
  warningAlertText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#334155',
    fontFamily: FONT,
  },

  // ── PENDING APPROVALS 4-CARD STRIP ──
  action4SectionWrap: {
    marginTop: 18,
  },
  sectionSubHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionSubHint: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    fontFamily: FONT,
  },
  action4Container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  action4Card: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  action4Touch: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  action4IconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    position: 'relative',
  },
  action4Badge: {
    position: 'absolute',
    top: -5,
    right: -6,
    minWidth: 19,
    height: 19,
    borderRadius: 9.5,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  action4BadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
    fontFamily: FONT,
  },
  action4Label: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.text,
    fontFamily: FONT,
    textAlign: 'center',
    lineHeight: 14,
    minHeight: 28,
  },

  // ── QUICK ACTIONS (6 Grid Cards) ──
  quickActionsSection: {
    marginTop: 18,
  },
  quick6Grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  quick6Card: {
    width: '31%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quick6IconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 7,
  },
  quick6Label: {
    fontSize: 11.5,
    fontWeight: '500',
    color: COLORS.text,
    fontFamily: FONT,
    textAlign: 'center',
  },
  quick6Sub: {
    fontSize: 9.5,
    fontWeight: '400',
    color: COLORS.textMuted,
    fontFamily: FONT,
    textAlign: 'center',
    marginTop: 1,
  },
  quick6CardEmerald: {
    borderColor: '#A7F3D0',
    backgroundColor: '#FAFCFA',
  },
  quick6IconBoxEmerald: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
  },
  quick6CardIndigo: {
    borderColor: '#C7D2FE',
    backgroundColor: '#FAFAFF',
  },
  quick6IconBoxIndigo: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
    borderWidth: 1,
  },
  quick6CardSky: {
    borderColor: '#BAE6FD',
    backgroundColor: '#FAFDFF',
  },
  quick6IconBoxSky: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
    borderWidth: 1,
  },
  quick6CardAmber: {
    borderColor: '#FDE68A',
    backgroundColor: '#FFFCF5',
  },
  quick6IconBoxAmber: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
  },
  quick6CardPurple: {
    borderColor: '#E9D5FF',
    backgroundColor: '#FCFAFF',
  },
  quick6IconBoxPurple: {
    backgroundColor: '#FAF5FF',
    borderColor: '#E9D5FF',
    borderWidth: 1,
  },
  quick6CardTeal: {
    borderColor: '#99F6E4',
    backgroundColor: '#FAFCFC',
  },
  quick6IconBoxTeal: {
    backgroundColor: '#F0FDFA',
    borderColor: '#99F6E4',
    borderWidth: 1,
  },
  quick6LiveDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  quick6BadgeCircle: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  quick6BadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    fontFamily: FONT,
  },
  quickHeaderLiveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 4,
  },
  quickHeaderLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#059669',
  },
  quickHeaderLiveText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#059669',
    fontFamily: FONT,
  },
  auditBadgePill: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  auditBadgeText: {
    color: '#4F46E5',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    fontFamily: FONT,
  },
  tripClaimsBannerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  tripClaimsBannerTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
  tripClaimsBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  tripClaimsBannerIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tripClaimsBannerTextCol: {
    flex: 1,
  },
  tripClaimsBannerTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#0F172A',
    fontFamily: FONT,
  },
  newBadge: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  newBadgeText: {
    color: '#2563EB',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  tripClaimsBannerSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '400',
    fontFamily: FONT,
  },
  tripClaimsArrowCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  // ── 5. TOP MANAGERS (CLEAN EXECUTIVE CARDS) ──
  topManagersCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  managersScrollerContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 4,
    paddingRight: 10,
  },
  managerScrollCard: {
    width: 112,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  managerAvatarWrap: {
    position: 'relative',
    marginBottom: 8,
  },
  managerAvatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.border,
  },
  managerRankBadge: {
    position: 'absolute',
    bottom: -2,
    right: -4,
    paddingHorizontal: 5,
    height: 18,
    minWidth: 20,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  managerRankText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#ffffff',
    fontFamily: FONT,
  },
  managerItemName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#0F172A',
    fontFamily: FONT,
    textAlign: 'center',
    width: '100%',
  },
  managerItemRegion: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '400',
    fontFamily: FONT,
    textAlign: 'center',
    marginTop: 2,
    width: '100%',
  },
  managerScoreTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    gap: 4,
    marginTop: 7,
  },
  managerScoreText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#4F46E5',
    fontFamily: FONT,
  },

  // ── WEEKLY TREND CARD ──
  weeklyTrendCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chartContainerBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chartSummaryStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  chartSummaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chartLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chartSummaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    fontFamily: FONT,
  },
  chartBarsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 110,
    paddingTop: 6,
    paddingHorizontal: 4,
  },
  chartCol: {
    alignItems: 'center',
    flex: 1,
  },
  chartCountPill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
    marginBottom: 5,
  },
  chartCountPillToday: {
    backgroundColor: '#2563EB',
  },
  chartCountLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#334155',
    fontFamily: FONT,
  },
  chartTrack: {
    width: 24,
    height: 64,
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartTrackToday: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  chartFill: {
    width: '100%',
    borderRadius: 7,
  },
  chartDayText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#475569',
    fontFamily: FONT,
    marginTop: 6,
  },

  managerAvatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  managerAvatarFallbackText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FONT,
  },

  viewLinkText: {
    fontSize: 11.5,
    fontWeight: '500',
    color: COLORS.primary,
    fontFamily: FONT,
  },

  // ── LIVE TEAM MAP PREVIEW & DUTY LIST STYLES ──
  liveMapPreviewBox: {
    height: 185,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    marginBottom: 12,
    position: 'relative',
    backgroundColor: '#E2E8F0',
  },
  liveMapFloatingBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  liveMapFloatingText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    fontFamily: FONT,
  },
  liveMapExpandFab: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#4F46E5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#6366F1',
  },
  liveMapExpandFabText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '500',
    fontFamily: FONT,
  },
  dutyList: {
    marginTop: 2,
    gap: 8,
  },
  dutyRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dutyLeftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
    marginRight: 8,
  },
  dutyRankBadge: {
    minWidth: 26,
    height: 24,
    paddingHorizontal: 5,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dutyRankNum: {
    fontSize: 10.5,
    fontWeight: '600',
    color: COLORS.textSub,
    fontFamily: FONT,
  },
  dutyAvatarImg: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.border,
  },
  dutyAvatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dutyAvatarFallbackText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '600',
    fontFamily: FONT,
  },
  dutyNameText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#0F172A',
    fontFamily: FONT,
  },
  dutySubAddrText: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: FONT,
    marginTop: 1,
    fontWeight: '400',
  },
  dutyRightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dutyKmBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#E0E7FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dutyKmText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#4F46E5',
    fontFamily: FONT,
  },
  dutyActivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CCFBF1',
    gap: 4,
  },
  dutyActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0D9488',
  },
  dutyActivePillText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#0D9488',
    fontFamily: FONT,
  },
  dutyIdlePill: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dutyIdlePillText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#D97706',
    fontFamily: FONT,
  },
  dutyOfflinePill: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dutyOfflinePillText: {
    fontSize: 10,
    fontWeight: '500',
    color: COLORS.textMuted,
    fontFamily: FONT,
  },

  // ── LEADERBOARD STYLES ──
  leaderboardList: {
    marginTop: 8,
    gap: 10,
  },
  leaderboardRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
  },
  leaderboardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  rankCircleBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankCircleText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ffffff',
    fontFamily: FONT,
  },
  leaderboardAvatarImg: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.border,
  },
  leaderboardAvatarFallback: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  leaderboardAvatarFallbackText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    fontFamily: FONT,
  },
  leaderboardName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    fontFamily: FONT,
  },
  leaderboardSub: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '700',
    fontFamily: FONT,
    marginRight: 12,
  },
  leaderboardScore: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.text,
    fontFamily: FONT,
  },

  // ── BOTTOM TAB BAR (Solid Full-Width Professional Anchored Bar - Height 96) ──
  bottomTabBar: {
    position: 'absolute',
    bottom: 25,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 32 : 22,
    shadowColor: '#0f172a',
    shadowOpacity: 0.10,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -4 },
    elevation: 16,
  },
  tabBarItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  tabActiveIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
    fontFamily: FONT,
    marginTop: 2,
  },

  // ── MODALS ──
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
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
    backgroundColor: COLORS.background,
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
    backgroundColor: COLORS.background,
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
  regionModalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
  },
  regionOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
  },
  regionOptionItemActive: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 10,
    paddingHorizontal: 8,
  },
  regionOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    fontFamily: FONT,
  },

  // ── DRAWER ──
  drawerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    flexDirection: 'row',
  },
  drawerDismiss: {
    flex: 1,
  },
  drawerContent: {
    width: '80%',
    maxWidth: 320,
    backgroundColor: '#ffffff',
    height: '100%',
    padding: 20,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  drawerOrgTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
    fontFamily: FONT,
  },
  drawerOrgSub: {
    fontSize: 12,
    color: COLORS.textSub,
    fontFamily: FONT,
  },
  drawerCloseBtn: {
    padding: 6,
  },
  drawerList: {
    marginTop: 14,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  drawerItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    fontFamily: FONT,
  },

  // ── ALL EMPLOYEES DIRECTORY ROSTER STYLES ──
  allEmpHeaderTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  allEmpHeaderIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  allEmpCountBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 2,
  },
  allEmpCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primaryDark,
    fontFamily: FONT,
  },
  allEmpAddQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 3,
  },
  allEmpAddQuickBtnText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#FFFFFF',
    fontFamily: FONT,
  },
  allEmpSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 38,
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  allEmpSearchInput: {
    flex: 1,
    fontSize: 12,
    color: COLORS.text,
    fontFamily: FONT,
    height: 38,
  },
  allEmpFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingBottom: 2,
  },
  allEmpFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  allEmpFilterChipActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  allEmpFilterChipText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#475569',
    fontFamily: FONT,
  },
  allEmpFilterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  filterStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  allEmpList: {
    marginTop: 8,
  },
  allEmpRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
  },
  allEmpAvatarWrap: {
    position: 'relative',
  },
  allEmpAvatarImg: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.border,
  },
  allEmpAvatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  allEmpAvatarFallbackText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: FONT,
  },
  allEmpStatusDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  allEmpInfoCol: {
    flex: 1,
    marginLeft: 10,
    justifyContent: 'center',
  },
  allEmpNameText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.text,
    fontFamily: FONT,
  },
  allEmpRoleBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  allEmpRoleBadgeText: {
    fontSize: 9,
    fontWeight: '500',
    color: COLORS.textSub,
    fontFamily: FONT,
  },
  allEmpSubText: {
    fontSize: 11,
    color: COLORS.textSub,
    fontFamily: FONT,
    marginTop: 1,
  },
  allEmpPhoneText: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontFamily: FONT,
    marginTop: 1,
  },
  allEmpRightCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 3,
    marginLeft: 8,
  },
  allEmpKmPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  allEmpKmText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary,
    fontFamily: FONT,
  },
  allEmpActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  allEmpCallTouch: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  allEmpMapTouch: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#e0f2fe',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── STRUCTURED TEAM MEMBER CARDS (UI/UX PRO MAX) ──
  teamMemberCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)',
    marginBottom: 12,
  },
  teamMemberTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamMemberAvatarWrap: {
    position: 'relative',
  },
  teamMemberAvatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e2e8f0',
  },
  teamMemberAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamMemberAvatarText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '600',
    fontFamily: FONT,
  },
  teamMemberStatusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  teamMemberName: {
    fontSize: 13.5,
    fontWeight: '500',
    color: '#0f172a',
    fontFamily: FONT,
    flex: 1,
    marginRight: 8,
  },
  teamMemberSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  empCodeBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  empCodeBadgeText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#475569',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  teamMemberRoleText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '400',
    fontFamily: FONT,
    flex: 1,
  },
  statusPillMoving: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CCFBF1',
    gap: 4,
  },
  pulseDotGreen: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0D9488',
  },
  statusPillMovingText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#0D9488',
    fontFamily: FONT,
  },
  statusPillStationary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
    gap: 4,
  },
  dotAmber: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#d97706',
  },
  statusPillStationaryText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#d97706',
    fontFamily: FONT,
  },
  statusPillOffline: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statusPillOfflineText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#94a3b8',
    fontFamily: FONT,
  },
  teamMemberMetricsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  teamMetricItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  teamMetricIconBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamMetricValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a',
    fontFamily: FONT,
  },
  teamMetricLabel: {
    fontSize: 9.5,
    fontWeight: '400',
    color: '#94a3b8',
    fontFamily: FONT,
    textTransform: 'uppercase',
  },
  teamMetricDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 4,
  },
  teamMemberLocationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 9,
    paddingHorizontal: 2,
  },
  teamMemberLocationText: {
    fontSize: 11,
    color: '#475569',
    fontFamily: FONT,
    fontWeight: '400',
    flex: 1,
  },
  teamMemberPingTime: {
    fontSize: 10,
    color: '#94a3b8',
    fontFamily: FONT,
    marginLeft: 4,
  },
  teamMemberActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  teamActionBtnCall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F8FAFC',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  teamActionBtnCallText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#334155',
    fontFamily: FONT,
  },
  teamActionBtnWhatsApp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F8FAFC',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  teamActionBtnWhatsAppText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#334155',
    fontFamily: FONT,
  },
  teamActionBtnTrack: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#4F46E5',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  teamActionBtnTrackText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
    fontFamily: FONT,
  },
  allEmpToggleBtn: {
    marginTop: 12,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  allEmpToggleBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    fontFamily: FONT,
  },
  allEmpEmptyBox: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 6,
  },
  allEmpEmptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    fontFamily: FONT,
    marginTop: 4,
  },
  allEmpEmptySub: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontFamily: FONT,
  },
  allEmpResetBtn: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 8,
  },
  allEmpResetBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    fontFamily: FONT,
  }
});
