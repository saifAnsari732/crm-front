import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  RefreshControl,
  TextInput,
  Modal,
  Image
} from 'react-native';
import { Text, Surface, Avatar } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';

import MapViewComponent from '../../components/MapViewComponent';
import {
  Users,
  Navigation,
  MapPin,
  Clock,
  RefreshCw,
  Search,
  X,
  UserCheck,
  CheckCircle2,
  XCircle,
  CalendarCheck,
  FileText,
  ChevronDown,
  ChevronUp,
  Calendar as CalendarIcon,
  Play,
  RotateCcw
} from 'lucide-react-native';
import {
  trackingAPI,
  adminAPI,
  meetingAPI,
  expenseAPI,
  taskAPI,
  leaveAPI,
  getAvatarUrl
} from '../../services/api';
import socketService from '../../services/socket';
import { cachedFetch, clearCachePrefix } from '../../services/cache';
import { useSettings } from '../../context/SettingsContext';
import { cleanTrackingRoute } from '../../utils/trackingRoute';

const { width, height } = Dimensions.get('window');
const FONT = Platform.OS === 'ios' ? 'System' : 'sans-serif-medium';

export default function AdminMonitoringScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { theme } = useSettings();
  const isDark = theme === 'dark';
  const mapRef = useRef(null);

  const C = {
    bg: isDark ? '#0f172a' : '#f8fafc',
    surface: isDark ? '#1e293b' : '#ffffff',
    text: isDark ? '#f8fafc' : '#0f172a',
    sub: isDark ? '#94a3b8' : '#64748b',
    border: isDark ? '#334155' : '#e2e8f0',
    row: isDark ? '#0f172a' : '#f1f5f9',
  };

  const todayStr = new Date().toISOString().slice(0, 10);

  const [activeTab, setActiveTab] = useState(params?.tab || 'telemetry');

  // Update activeTab if params change (e.g. user navigates here again with different tab)
  useEffect(() => {
    if (params?.tab) {
      setActiveTab(params.tab);
    }
  }, [params?.tab]);

  const [mapFilter, setMapFilter] = useState('ALL');
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Core Data
  const [stats, setStats] = useState(null);
  const [liveLocations, setLiveLocations] = useState([]);
  const [allEmployeesList, setAllEmployeesList] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [leaves, setLeaves] = useState([]);

  // History Tab Data
  const [historyEmpId, setHistoryEmpId] = useState('');
  const [historyDate, setHistoryDate] = useState(todayStr);
  const [historySessions, setHistorySessions] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Selected Employee & Route Tracking
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [showDirectory, setShowDirectory] = useState(false); // Default collapsed for max map height!

  // Loading States
  const [loading, setLoading] = useState(true);

  // Report Tab
  const [reportEmpId, setReportEmpId] = useState('');
  const [reportStart, setReportStart] = useState(new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
  const [reportEnd, setReportEnd] = useState(todayStr);
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Modal
  const [selfieModalUrl, setSelfieModalUrl] = useState(null);

  // ─── 1. Data Fetching ──────────────────────────────────────────
  // Full data load — runs on mount & manual refresh only
  const fetchAllData = useCallback(async (force = false) => {
    try {
      const [locationsRes, statsRes, empRes, attRes] = await Promise.all([
        cachedFetch('admin_live_locations', () => trackingAPI.getLiveLocations(), 15, force),
        cachedFetch('admin_dashboard', () => adminAPI.getDashboard(), 20, force),
        cachedFetch('admin_employees', () => adminAPI.getEmployees({ limit: 200, role: 'all' }), 30, force),
        cachedFetch(`admin_attendance_${selectedDate}`, () => adminAPI.getAttendance({ date: selectedDate }), 60, force),
      ]);

      if (locationsRes.data?.success) setLiveLocations(locationsRes.data.locations || []);
      if (statsRes.data?.success) setStats(statsRes.data.stats || null);
      if (empRes.data?.success) {
        setAllEmployeesList(empRes.data.employees || []);
        if (!reportEmpId && empRes.data.employees?.length > 0) {
          setReportEmpId(empRes.data.employees[0]._id);
        }
        if (!historyEmpId && empRes.data.employees?.length > 0) {
          setHistoryEmpId(empRes.data.employees[0]._id);
        }
      }
      if (attRes.data?.success) setAttendanceRecords(attRes.data.records || []);
    } catch (e) {
      console.log('Error fetching admin monitoring data:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate]);

  // Lightweight poll — only GPS locations (runs every 30s)
  const fetchLiveOnly = useCallback(async () => {
    try {
      const res = await cachedFetch('admin_live_locations', () => trackingAPI.getLiveLocations(), 15, true);
      if (res.data?.success) setLiveLocations(res.data.locations || []);
    } catch (e) {}
  }, []);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const key = `admin_history_${historyEmpId}_${historyDate}`;
      const res = await cachedFetch(key, () => adminAPI.getHistory({
        employeeId: historyEmpId || undefined,
        date: historyDate || undefined,
      }), 30);
      if (res.data?.success) {
        setHistorySessions(res.data.history || []);
      }
    } catch (e) {
      setHistorySessions([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyEmpId, historyDate]);

  const fetchTasks = async (force = false) => {
    try {
      const res = await cachedFetch('admin_tasks', () => taskAPI.getAll(), 60, force);
      if (res.data?.success) setTasks(res.data.tasks || []);
    } catch (e) {}
  };

  const fetchExpenses = async (force = false) => {
    try {
      const res = await cachedFetch('admin_expenses', () => expenseAPI.getAll({ limit: 50 }), 60, force);
      if (res.data?.success) setExpenses(res.data.expenses || []);
    } catch (e) {}
  };

  const fetchLeaves = async (force = false) => {
    try {
      const res = await cachedFetch('admin_leaves', () => leaveAPI.getAll(), 60, force);
      if (res.data?.success) setLeaves(res.data.leaves || []);
    } catch (e) {}
  };

  useEffect(() => {
    fetchAllData();

    let socket;
    const initSocket = async () => {
      try {
        socket = await socketService.connect();
        if (socket) {
          socket.on('employee_location', (data) => {
            setLiveLocations((prev) => {
              const idx = prev.findIndex((l) => l.employeeId === data.employeeId || l.sessionId === data.sessionId);
              if (idx > -1) {
                const upd = [...prev];
                upd[idx] = {
                  ...upd[idx],
                  lat: data.lat,
                  lng: data.lng,
                  totalDistance: data.totalDistance,
                  address: data.address || upd[idx].address,
                  updatedAt: new Date().toISOString(),
                };
                return upd;
              }
              return prev;
            });
          });

          socket.on('employee_tracking_started', fetchAllData);
          socket.on('employee_tracking_stopped', fetchAllData);
        }
      } catch (e) {}
    };

    initSocket();
    const interval = setInterval(fetchLiveOnly, 30000); // Light poll only GPS every 30s

    return () => {
      clearInterval(interval);
      if (socket) {
        socket.off('employee_location');
        socket.off('employee_tracking_started');
        socket.off('employee_tracking_stopped');
      }
    };
  }, [fetchAllData, fetchLiveOnly]);

  useEffect(() => {
    if (activeTab === 'history') fetchHistory();
    if (activeTab === 'tasks' && tasks.length === 0) fetchTasks();
    if (activeTab === 'expenses' && expenses.length === 0) fetchExpenses();
    if (activeTab === 'leaves' && leaves.length === 0) fetchLeaves();
  }, [activeTab, fetchHistory]);

  const onRefresh = async () => {
    setRefreshing(true);
    clearCachePrefix('admin_'); // Bust all admin cache on manual pull-to-refresh
    await fetchAllData(true);
    if (activeTab === 'history') await fetchHistory();
    if (activeTab === 'tasks') await fetchTasks(true);
    if (activeTab === 'expenses') await fetchExpenses(true);
    if (activeTab === 'leaves') await fetchLeaves(true);
    setRefreshing(false);
  };

  // Select employee & load Polyline route
  const handleSelectEmployee = async (emp) => {
    setSelectedEmployee(emp);
    if (emp.lat && emp.lng && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: parseFloat(emp.lat),
        longitude: parseFloat(emp.lng),
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      }, 1000);
    }

    const sessId = emp.sessionId || emp._id;
    if (sessId) {
      setLoadingRoute(true);
      try {
        const res = await trackingAPI.getSession(sessId);
        if (res.data?.success && res.data.session?.coordinates) {
          const coords = cleanTrackingRoute(res.data.session.coordinates.map((c) => ({
            latitude: parseFloat(c.lat),
            longitude: parseFloat(c.lng),
            timestamp: c.timestamp,
          })));
          setRouteCoords(coords);
        }
      } catch (e) {
        setRouteCoords([]);
      } finally {
        setLoadingRoute(false);
      }
    } else {
      setRouteCoords([]);
    }
  };

  // Load a historical session onto the map
  const handleViewHistorySession = async (session) => {
    setActiveTab('telemetry');
    const sessId = session.sessionId || session._id;
    setLoadingRoute(true);
    try {
      const res = await trackingAPI.getSession(sessId);
      if (res.data?.success && res.data.session?.coordinates) {
        const coords = cleanTrackingRoute(res.data.session.coordinates.map((c) => ({
          latitude: parseFloat(c.lat),
          longitude: parseFloat(c.lng),
          timestamp: c.timestamp,
        })));
        setRouteCoords(coords);
        if (coords.length > 0 && mapRef.current) {
          mapRef.current.animateToRegion({
            latitude: coords[0].latitude,
            longitude: coords[0].longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }, 1000);
        }
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to load route points.');
    } finally {
      setLoadingRoute(false);
    }
  };

  // Generate consolidated report
  const handleGenerateReport = async () => {
    if (!reportEmpId) {
      Alert.alert('Select Staff', 'Please select an employee first.');
      return;
    }
    setReportLoading(true);
    try {
      const res = await adminAPI.getConsolidatedReport({
        employeeId: reportEmpId,
        startDate: reportStart,
        endDate: reportEnd,
      });
      if (res.data?.success) {
        setReportData(res.data.data);
      } else {
        Alert.alert('Error', res.data?.message || 'Failed to fetch report.');
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to generate report.');
    } finally {
      setReportLoading(false);
    }
  };

  // Actions
  const handleApproveEmp = async (id) => {
    try {
      await adminAPI.approveEmployee(id);
      fetchAllData();
    } catch (e) {}
  };

  const handleToggleBlock = async (id) => {
    try {
      await adminAPI.toggleBlock(id);
      fetchAllData();
    } catch (e) {}
  };

  const handleExpenseStatus = async (id, status) => {
    try {
      await expenseAPI.approve(id, { status });
      fetchExpenses();
    } catch (e) {}
  };

  const handleLeaveStatus = async (id, status) => {
    try {
      await leaveAPI.updateStatus(id, { status });
      fetchLeaves();
    } catch (e) {}
  };

  // Directory Staff Mapping
  const baseStaffList = allEmployeesList.length > 0 ? allEmployeesList : liveLocations;

  const directoryStaff = baseStaffList.map((emp) => {
    const liveLoc = liveLocations.find((l) =>
      (l.employeeId && String(l.employeeId) === String(emp._id || emp.employeeId)) ||
      (l.employeeIdCode && emp.employeeId && String(l.employeeIdCode) === String(emp.employeeId)) ||
      (l.name && emp.name && l.name.toLowerCase() === emp.name.toLowerCase())
    );

    return {
      _id: emp._id || emp.employeeId,
      name: emp.name || 'Field Agent',
      avatar: emp.avatar || liveLoc?.avatar,
      department: emp.department || liveLoc?.department || 'Field Services',
      phone: emp.phone,
      isTracking: !!liveLoc || emp.isTracking,
      isOnline: emp.isOnline,
      lat: liveLoc?.lat || emp.lat || null,
      lng: liveLoc?.lng || emp.lng || null,
      totalDistance: liveLoc?.totalDistance || emp.totalDistance || 0,
      address: liveLoc?.address || emp.address || (liveLoc ? 'Tracking Active' : 'Not Punched In'),
      sessionId: liveLoc?.sessionId || emp.sessionId || null,
      startTime: liveLoc?.startTime || emp.startTime || null,
      updatedAt: liveLoc?.updatedAt || emp.updatedAt || null,
    };
  });

  const activeCount = directoryStaff.filter(s => s.isTracking).length;
  const totalEmpCount = directoryStaff.length;
  const punchedOutCount = Math.max(0, totalEmpCount - activeCount);

  const filteredDirectory = directoryStaff.filter((emp) => {
    const matchesSearch = (emp.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (emp.address || '').toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;

    if (mapFilter === 'ACTIVE') return emp.isTracking;
    if (mapFilter === 'PUNCHED_OUT') return !emp.isTracking;
    return true;
  });

  const defaultRegion = {
    latitude: liveLocations[0]?.lat ? parseFloat(liveLocations[0].lat) : 26.4499,
    longitude: liveLocations[0]?.lng ? parseFloat(liveLocations[0].lng) : 80.3319,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
  const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—');

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      {/* ── Scrollable Tab Bar ──────────────────────────────────── */}
      {/* ── TAB 1: LIVE MAP SYSTEM (Maximum Screen Height!) ─────── */}
      {activeTab === 'telemetry' && (
        <View style={{ flex: 1 }}>
          {/* Status Filter Chips */}
          <View style={styles.filterChipsRow}>
            <TouchableOpacity
              style={[styles.chip, mapFilter === 'ALL' && styles.chipActive]}
              onPress={() => setMapFilter('ALL')}
            >
              <Text style={[styles.chipText, mapFilter === 'ALL' && styles.chipTextActive]}>ALL ({totalEmpCount})</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.chip, mapFilter === 'ACTIVE' && styles.chipActive]}
              onPress={() => setMapFilter('ACTIVE')}
            >
              <Text style={[styles.chipText, mapFilter === 'ACTIVE' && styles.chipTextActive]}>ACTIVE ({activeCount})</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.chip, mapFilter === 'PUNCHED_OUT' && styles.chipActive]}
              onPress={() => setMapFilter('PUNCHED_OUT')}
            >
              <Text style={[styles.chipText, mapFilter === 'PUNCHED_OUT' && styles.chipTextActive]}>PUNCHED OUT ({punchedOutCount})</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.historyBtn}
              onPress={() => router.push('/(employee)/admin/history')}
            >
              <FileText size={13} color="#fff" />
              <Text style={styles.historyBtnText}>KM HISTORY</Text>
            </TouchableOpacity>
          </View>

          {/* Interactive Map View (EXPANDED HEIGHT) */}
          <View style={styles.mapContainerLarge}>
            <MapViewComponent
              ref={mapRef}
              initialRegion={defaultRegion}
              directoryStaff={directoryStaff}
              routeCoords={routeCoords}
              loadingRoute={loadingRoute}
              onSelectEmployee={handleSelectEmployee}
            />

            {loadingRoute && (
              <View style={styles.mapLoader}>
                <ActivityIndicator color="#008080" size="small" />
                <Text style={{ fontFamily: FONT, fontSize: 11, marginLeft: 8, color: '#008080', fontWeight: 'bold' }}>Drawing GPS Route Path...</Text>
              </View>
            )}
          </View>

          {/* Collapsable Bottom Directory */}
          <View style={[styles.directoryContainerCompact, { backgroundColor: C.surface }]}>
            <TouchableOpacity style={styles.directoryHeader} onPress={() => setShowDirectory(!showDirectory)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Users size={16} color="#008080" />
                <Text style={[styles.directoryTitle, { color: C.text }]}>TEAM DIRECTORY ({filteredDirectory.length})</Text>
              </View>
              {showDirectory ? <ChevronDown size={20} color={C.sub} /> : <ChevronUp size={20} color={C.sub} />}
            </TouchableOpacity>

            {showDirectory && (
              <>
                <View style={[styles.searchBox, { backgroundColor: C.bg, borderColor: C.border, marginHorizontal: 0, marginBottom: 8 }]}>
                  <Search size={16} color={C.sub} style={{ marginRight: 8 }} />
                  <TextInput
                    style={[styles.searchInput, { color: C.text }]}
                    placeholder="Search staff..."
                    placeholderTextColor={C.sub}
                    value={search}
                    onChangeText={setSearch}
                  />
                </View>

                <FlatList
                  data={filteredDirectory}
                  keyExtractor={(item, idx) => item._id || String(idx)}
                  style={{ maxHeight: 180 }}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.staffRow,
                        { borderColor: C.border },
                        selectedEmployee?._id === item._id && { backgroundColor: isDark ? '#334155' : '#e0f2fe' }
                      ]}
                      onPress={() => handleSelectEmployee(item)}
                    >
                      <View style={{ position: 'relative' }}>
                        {getAvatarUrl(item.avatar) ? (
                          <Avatar.Image size={36} source={{ uri: getAvatarUrl(item.avatar) }} />
                        ) : (
                          <Avatar.Text size={36} label={(item.name || 'E').slice(0, 2).toUpperCase()} style={{ backgroundColor: '#283b96' }} labelStyle={{ color: '#fff' }} />
                        )}
                        <View style={[styles.listStatusDot, { backgroundColor: item.isTracking ? '#16a34a' : '#94a3b8' }]} />
                      </View>

                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={[styles.empName, { color: C.text }]}>{item.name}</Text>
                        <Text style={[styles.empSub, { color: C.sub }]} numberOfLines={1}>
                          {item.isTracking ? item.address : 'Not Punched In'}
                        </Text>
                      </View>

                      <View style={{ alignItems: 'flex-end' }}>
                        {item.isTracking ? (
                          <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#008080' }}>
                            {(parseFloat(item.totalDistance) || 0).toFixed(1)} km
                          </Text>
                        ) : (
                          <Text style={{ fontSize: 11, color: C.sub }}>Offline</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  )}
                />
              </>
            )}
          </View>
        </View>
      )}

      {/* ── TAB 2: GPS TRACKING HISTORY (Date Filter & Session Replay) ─ */}
      {activeTab === 'history' && (
        <View style={{ flex: 1 }}>
          <View style={[styles.dateFilterHeader, { backgroundColor: C.surface, borderColor: C.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.dateLbl, { color: C.sub }]}>FILTER DATE</Text>
              <TextInput
                style={[styles.dateInput, { color: C.text }]}
                value={historyDate}
                onChangeText={setHistoryDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={C.sub}
              />
            </View>

            <TouchableOpacity style={styles.filterApplyBtn} onPress={fetchHistory}>
              <RefreshCw size={14} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12, marginLeft: 6 }}>Apply Date</Text>
            </TouchableOpacity>
          </View>

          {historyLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color="#283b96" size="large" />
              <Text style={{ color: C.sub, marginTop: 10, fontSize: 12 }}>Loading GPS Tracking History...</Text>
            </View>
          ) : (
            <FlatList
              data={historySessions}
              keyExtractor={(item, idx) => item._id || String(idx)}
              contentContainerStyle={styles.body}
              ListEmptyComponent={
                <View style={styles.center}>
                  <Clock size={40} color={C.sub} />
                  <Text style={[styles.emptyText, { color: C.sub }]}>No tracking history found for {historyDate}</Text>
                </View>
              }
              renderItem={({ item }) => (
                <Surface style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }]} elevation={1}>
                  <View style={styles.cardRow}>
                    <Avatar.Text size={40} label={(item.employee?.name || 'E').slice(0, 2).toUpperCase()} style={{ backgroundColor: '#283b96' }} labelStyle={{ color: '#fff' }} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={[styles.empName, { color: C.text }]}>{item.employee?.name || 'Field Agent'}</Text>
                      <Text style={[styles.empSub, { color: C.sub }]}>
                        Date: {fmtDate(item.date)} • Start: {fmtTime(item.startTime)}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#008080' }}>
                        {(item.totalDistance || 0).toFixed(2)} km
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity style={[styles.generateBtn, { marginTop: 10, paddingVertical: 8 }]} onPress={() => handleViewHistorySession(item)}>
                    <Play size={14} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.generateBtnText}>Replay Route Path on Map</Text>
                  </TouchableOpacity>
                </Surface>
              )}
            />
          )}
        </View>
      )}

      {/* ── TAB 3: OVERVIEW ─────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <ScrollView contentContainerStyle={styles.body} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>Today's Operational KPIs</Text>
          <View style={styles.kpiGrid}>
            {[
              { label: 'Total Employees', val: stats?.totalEmployees || totalEmpCount, color: '#283b96' },
              { label: 'Online Now', val: stats?.activeEmployees || 0, color: '#2563eb' },
              { label: 'Tracking Now', val: activeCount, color: '#16a34a' },
              { label: 'Today KM', val: `${(stats?.totalKm || 0).toFixed(1)}km`, color: '#0891b2' },
              { label: 'Total Meetings', val: stats?.totalMeetings || 0, color: '#7c3aed' },
              { label: 'Pending Expenses', val: stats?.pendingExpenses || 0, color: '#dc2626' },
              { label: 'Total Tasks', val: stats?.totalTasks || 0, color: '#ea580c' },
              { label: 'Total Leads', val: stats?.totalLeads || 0, color: '#0d9488' },
            ].map((k, i) => (
              <Surface key={i} style={[styles.kpiCard, { backgroundColor: C.surface, borderColor: C.border }]} elevation={1}>
                <Text style={[styles.kpiVal, { color: k.color }]}>{k.val}</Text>
                <Text style={[styles.kpiLabel, { color: C.sub }]}>{k.label}</Text>
              </Surface>
            ))}
          </View>
        </ScrollView>
      )}

      {/* ── TAB 4: ATTENDANCE (Date Filter Enabled) ────────────── */}
      {activeTab === 'attendance' && (
        <View style={{ flex: 1 }}>
          <View style={[styles.dateFilterHeader, { backgroundColor: C.surface, borderColor: C.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.dateLbl, { color: C.sub }]}>FILTER DATE</Text>
              <TextInput
                style={[styles.dateInput, { color: C.text }]}
                value={selectedDate}
                onChangeText={setSelectedDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={C.sub}
              />
            </View>

            <TouchableOpacity style={styles.filterApplyBtn} onPress={fetchAllData}>
              <RefreshCw size={14} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12, marginLeft: 6 }}>Filter</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={attendanceRecords}
            keyExtractor={(item, idx) => item._id || String(idx)}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            contentContainerStyle={styles.body}
            ListEmptyComponent={
              <View style={styles.center}>
                <CalendarCheck size={40} color={C.sub} />
                <Text style={[styles.emptyText, { color: C.sub }]}>No attendance records for {selectedDate}</Text>
              </View>
            }
            renderItem={({ item }) => (
              <Surface style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }]} elevation={1}>
                <View style={styles.cardRow}>
                  <Avatar.Text size={40} label={(item.employee?.name || 'E').slice(0, 2).toUpperCase()} style={{ backgroundColor: '#283b96' }} labelStyle={{ color: '#fff' }} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.empName, { color: C.text }]}>{item.employee?.name || 'Employee'}</Text>
                    <Text style={[styles.empSub, { color: C.sub }]}>
                      Date: {fmtDate(item.date)} • Check In: {fmtTime(item.checkIn)}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: item.status === 'present' ? '#dcfce7' : '#fee2e2' }]}>
                    <Text style={[styles.statusText, { color: item.status === 'present' ? '#15803d' : '#dc2626' }]}>
                      {(item.status || 'PRESENT').toUpperCase()}
                    </Text>
                  </View>
                </View>

                {item.selfieUrl && (
                  <TouchableOpacity onPress={() => setSelfieModalUrl(item.selfieUrl)}>
                    <Text style={{ fontSize: 11, color: '#283b96', fontWeight: 'bold', marginTop: 4 }}>📸 View Punch-In Selfie</Text>
                  </TouchableOpacity>
                )}
              </Surface>
            )}
          />
        </View>
      )}

      {/* ── TAB 5: EMPLOYEES ────────────────────────────────────── */}
      {activeTab === 'employees' && (
        <FlatList
          data={allEmployeesList.filter(e => (e.name || '').toLowerCase().includes(search.toLowerCase()))}
          keyExtractor={(item) => item._id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.body}
          renderItem={({ item: emp }) => (
            <Surface style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }]} elevation={1}>
              <View style={styles.cardRow}>
                <Avatar.Text size={40} label={(emp.name || 'E').slice(0, 2).toUpperCase()} style={{ backgroundColor: '#334155' }} labelStyle={{ color: '#fff' }} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.empName, { color: C.text }]}>{emp.name}</Text>
                  <Text style={[styles.empSub, { color: C.sub }]}>{emp.department || 'Staff'} • {emp.role?.toUpperCase()}</Text>
                </View>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: emp.isBlocked ? '#16a34a' : '#dc2626' }]} onPress={() => handleToggleBlock(emp._id)}>
                  <Text style={styles.actionBtnTxt}>{emp.isBlocked ? 'Unblock' : 'Block'}</Text>
                </TouchableOpacity>
              </View>
            </Surface>
          )}
        />
      )}

      {/* ── TAB 6: TASKS ────────────────────────────────────────── */}
      {activeTab === 'tasks' && (
        <FlatList
          data={tasks}
          keyExtractor={(item, idx) => item._id || String(idx)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.body}
          renderItem={({ item }) => (
            <Surface style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }]} elevation={1}>
              <Text style={[styles.empName, { color: C.text }]}>{item.title}</Text>
              <Text style={[styles.empSub, { color: C.sub }]}>Assigned: {item.employee?.name || 'Staff'}</Text>
            </Surface>
          )}
        />
      )}

      {/* ── TAB 7: EXPENSES & LEAVES ────────────────────────────── */}
      {activeTab === 'expenses' && (
        <FlatList
          data={expenses}
          keyExtractor={(item, idx) => item._id || String(idx)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.body}
          renderItem={({ item }) => (
            <Surface style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }]} elevation={1}>
              <View style={styles.cardRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.empName, { color: C.text }]}>₹{item.amount} — {item.category}</Text>
                  <Text style={[styles.empSub, { color: C.sub }]}>{item.employee?.name}</Text>
                </View>
                {item.status === 'pending' && (
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#16a34a' }]} onPress={() => handleExpenseStatus(item._id, 'approved')}>
                      <Text style={styles.actionBtnTxt}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#dc2626' }]} onPress={() => handleExpenseStatus(item._id, 'rejected')}>
                      <Text style={styles.actionBtnTxt}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </Surface>
          )}
        />
      )}

      {/* ── TAB 8: LEAVES ───────────────────────────────────────── */}
      {activeTab === 'leaves' && (
        <FlatList
          data={leaves}
          keyExtractor={(item, idx) => item._id || String(idx)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.body}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={[styles.emptyText, { color: C.sub }]}>No leave requests found.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Surface style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }]} elevation={1}>
              <View style={styles.cardRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.empName, { color: C.text }]}>{item.type || 'Leave'} ({item.startDate ? fmtDate(item.startDate) : ''})</Text>
                  <Text style={[styles.empSub, { color: C.sub }]}>By: {item.employee?.name} • Reason: {item.reason}</Text>
                </View>
                {item.status === 'pending' ? (
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#16a34a' }]} onPress={() => handleLeaveStatus(item._id, 'approved')}>
                      <Text style={styles.actionBtnTxt}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#dc2626' }]} onPress={() => handleLeaveStatus(item._id, 'rejected')}>
                      <Text style={styles.actionBtnTxt}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={[styles.statusBadge, { backgroundColor: item.status === 'approved' ? '#dcfce7' : '#fee2e2' }]}>
                    <Text style={[styles.statusText, { color: item.status === 'approved' ? '#15803d' : '#dc2626' }]}>
                      {(item.status || 'PROCESSED').toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
            </Surface>
          )}
        />
      )}

      {/* ── TAB 9: CONSOLIDATED REPORT ──────────────────────────── */}
      {activeTab === 'reports' && (
        <ScrollView contentContainerStyle={styles.body} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>Select Field Staff</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {allEmployeesList.map((emp) => (
              <TouchableOpacity
                key={emp._id}
                style={[
                  styles.empChip,
                  { borderColor: reportEmpId === emp._id ? '#283b96' : C.border, backgroundColor: reportEmpId === emp._id ? '#283b96' : C.surface }
                ]}
                onPress={() => setReportEmpId(emp._id)}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: reportEmpId === emp._id ? '#fff' : C.text }}>{emp.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[styles.sectionTitle, { color: C.text }]}>Date Range</Text>
          <View style={styles.dateRow}>
            <View style={[styles.dateBox, { backgroundColor: C.surface, borderColor: C.border }]}>
              <Text style={[styles.dateLbl, { color: C.sub }]}>FROM</Text>
              <TextInput style={[styles.dateInput, { color: C.text }]} value={reportStart} onChangeText={setReportStart} placeholder="YYYY-MM-DD" placeholderTextColor={C.sub} />
            </View>
            <Text style={{ color: C.sub, fontSize: 18, fontWeight: 'bold', marginHorizontal: 8 }}>→</Text>
            <View style={[styles.dateBox, { backgroundColor: C.surface, borderColor: C.border }]}>
              <Text style={[styles.dateLbl, { color: C.sub }]}>TO</Text>
              <TextInput style={[styles.dateInput, { color: C.text }]} value={reportEnd} onChangeText={setReportEnd} placeholder="YYYY-MM-DD" placeholderTextColor={C.sub} />
            </View>
          </View>

          <TouchableOpacity style={styles.generateBtn} onPress={handleGenerateReport} disabled={reportLoading}>
            {reportLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <FileText size={16} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.generateBtnText}>Generate Staff Report</Text>
              </>
            )}
          </TouchableOpacity>

          {reportData && (
            <Surface style={[styles.reportSummary, { backgroundColor: C.surface, borderColor: C.border, marginTop: 16 }]} elevation={1}>
              <Text style={[styles.empName, { color: C.text, padding: 12, borderBottomWidth: 1, borderColor: C.border }]}>
                Report for: {reportData.employee?.name} ({reportData.employee?.department || 'Staff'})
              </Text>
              {[
                { label: 'Total Distance', val: `${(reportData.summary?.totalKm || 0).toFixed(2)} km` },
                { label: 'Travel Pay (₹2.5/km)', val: `₹${(reportData.summary?.travelPay || 0).toFixed(2)}` },
                { label: 'Client Meetings', val: reportData.summary?.totalMeetings || 0 },
                { label: 'Total Expenses', val: `₹${(reportData.summary?.totalExpenses || 0).toLocaleString('en-IN')}` },
                { label: 'Tasks Completed', val: reportData.summary?.totalTasks || 0 },
              ].map((r, i) => (
                <View key={i} style={[styles.reportRow, { borderBottomColor: C.border }]}>
                  <Text style={[styles.reportLabel, { color: C.sub }]}>{r.label}</Text>
                  <Text style={[styles.reportVal, { color: C.text }]}>{r.val}</Text>
                </View>
              ))}
            </Surface>
          )}
        </ScrollView>
      )}

      {/* Selfie Preview Modal */}
      <Modal visible={!!selfieModalUrl} transparent animationType="fade" onRequestClose={() => setSelfieModalUrl(null)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={{ position: 'absolute', top: 40, right: 20, zIndex: 10 }} onPress={() => setSelfieModalUrl(null)}>
            <X size={28} color="#fff" />
          </TouchableOpacity>
          {selfieModalUrl && (
            <Image source={{ uri: selfieModalUrl }} style={{ width: width * 0.9, height: height * 0.6, borderRadius: 16, resizeMode: 'contain' }} />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  filterChipsRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingVertical: 8, gap: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e2e8f0' },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1' },
  chipActive: { backgroundColor: '#008080' },
  chipText: { fontFamily: FONT, fontSize: 10, fontWeight: 'bold', color: '#64748b' },
  chipTextActive: { color: '#ffffff' },
  historyBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, backgroundColor: '#283b96' },
  historyBtnText: { fontFamily: FONT, fontSize: 10, fontWeight: 'bold', color: '#ffffff' },
  mapContainerLarge: { flex: 1, position: 'relative', minHeight: 380 },
  mapLoader: { position: 'absolute', top: 12, alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, flexDirection: 'row', alignItems: 'center' },
  directoryContainerCompact: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 12, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  directoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  directoryTitle: { fontFamily: FONT, fontSize: 12, fontWeight: 'bold', letterSpacing: 0.5 },
  searchBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, height: 36 },
  searchInput: { fontFamily: FONT, flex: 1, fontSize: 12, paddingVertical: 0 },
  staffRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 6, borderBottomWidth: 1, borderRadius: 8, marginBottom: 4 },
  listStatusDot: { width: 8, height: 8, borderRadius: 4, position: 'absolute', bottom: 0, right: 0, borderWidth: 1, borderColor: '#fff' },
  dateFilterHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, gap: 12 },
  filterApplyBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#008080', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  body: { padding: 14, paddingBottom: 30 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 50 },
  emptyText: { fontFamily: FONT, fontSize: 12, marginTop: 8 },
  sectionTitle: { fontFamily: FONT, fontSize: 12, fontWeight: 'bold', letterSpacing: 0.4, marginBottom: 8, textTransform: 'uppercase' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpiCard: { width: (width - 44) / 4, borderRadius: 12, borderWidth: 1, padding: 8, alignItems: 'center' },
  kpiVal: { fontFamily: FONT, fontSize: 16, fontWeight: 'bold' },
  kpiLabel: { fontFamily: FONT, fontSize: 8, fontWeight: '700', textAlign: 'center', marginTop: 2 },
  card: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 8 },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  empName: { fontFamily: FONT, fontSize: 13, fontWeight: 'bold' },
  empSub: { fontFamily: FONT, fontSize: 10, marginTop: 1 },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  statusText: { fontFamily: FONT, fontSize: 9, fontWeight: 'bold' },
  actionBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  actionBtnTxt: { fontFamily: FONT, color: '#fff', fontSize: 10, fontWeight: 'bold' },
  empChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1, marginRight: 6 },
  dateRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  dateBox: { flex: 1, borderWidth: 1, borderRadius: 10, padding: 8 },
  dateLbl: { fontFamily: FONT, fontSize: 8, fontWeight: 'bold' },
  dateInput: { fontFamily: FONT, fontSize: 12, fontWeight: '600', padding: 0 },
  generateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#008080', borderRadius: 12, paddingVertical: 12 },
  generateBtnText: { fontFamily: FONT, color: '#fff', fontWeight: 'bold', fontSize: 13 },
  reportSummary: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  reportRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1 },
  reportLabel: { fontFamily: FONT, fontSize: 11 },
  reportVal: { fontFamily: FONT, fontSize: 12, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
});
