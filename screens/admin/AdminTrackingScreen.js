import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  StyleSheet, View, TouchableOpacity, ActivityIndicator,
  Platform, TextInput, FlatList, StatusBar, Modal, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Avatar } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft, Bell, ChevronDown, Search, Map as MapIcon, Users,
  LocateFixed, RefreshCw, Route, MapPin, CalendarDays, ChevronRight,
} from 'lucide-react-native';
import MapViewComponent from '../../components/MapViewComponent';
import { trackingAPI, adminAPI, getAvatarUrl } from '../../services/api';
import { cachedFetch, clearCachePrefix } from '../../services/cache';
import socketService from '../../services/socket';
import { useAuth } from '../../context/AuthContext';
import { cleanTrackingRoute } from '../../utils/trackingRoute';
import { useLocalSearchParams, useRouter } from 'expo-router';

const FONT = Platform.OS === 'ios' ? 'System' : 'sans-serif-medium';
const GREEN = '#0d5c46';
const GREEN_DARK = '#0a4a39';

const cardShadow = Platform.OS === 'web'
  ? { boxShadow: '0px 4px 14px rgba(15, 23, 42, 0.12)' }
  : { elevation: 4, shadowColor: '#0f172a', shadowOpacity: 0.14, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } };

const STATUS_META = {
  ON_FIELD: { label: 'On Field', color: '#15803d', bg: '#e7f6ec', pin: '#16a34a' },
  IN_TRANSIT: { label: 'In Transit', color: '#1d4ed8', bg: '#e8f0fe', pin: '#3b82f6' },
  AT_LOCATION: { label: 'At Location', color: '#b45309', bg: '#fdf3e3', pin: '#f59e0b' },
  OFFLINE: { label: 'Offline', color: '#64748b', bg: '#f1f5f9', pin: '#94a3b8' },
};

const fmtTime = (t) => (t ? new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—');
const normalizeAddress = (value) => {
  if (!value) return 'Location unavailable';
  if (typeof value === 'string') return value.trim() || 'Location unavailable';
  if (typeof value === 'object') {
    const parts = [value.street, value.city, value.state, value.pincode].filter(Boolean);
    return parts.length ? parts.join(', ') : 'Location unavailable';
  }
  return String(value);
};

export default function AdminTrackingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { employeeId: requestedEmployeeId, sessionId: requestedSessionId } = useLocalSearchParams();
  const autoSelectedRef = useRef('');
  const mapRef = useRef(null);

  const [search, setSearch] = useState('');
  const [liveLocations, setLiveLocations] = useState([]);
  const [allEmployeesList, setAllEmployeesList] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [fullSessionData, setFullSessionData] = useState([]);
  const [routeCoords, setRouteCoords] = useState([]);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLiveLocations = useCallback(async (force = false) => {
    try {
      const locRes = await cachedFetch('admin_live_locations', () => trackingAPI.getLiveLocations(), 15, force);
      if (locRes.data?.success) setLiveLocations(locRes.data.locations || []);
    } catch (e) {
      console.log('Tracking live fetch error:', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEmployees = useCallback(async (force = false) => {
    try {
      const empRes = await cachedFetch('admin_employees', () => adminAPI.getEmployees({ limit: 200, role: 'employee' }), 30, force);
      if (empRes.data?.success) setAllEmployeesList(empRes.data.employees || []);
    } catch (e) {
      console.log('Tracking employee fetch error:', e.message);
    }
  }, []);

  const fetchAllData = useCallback(async (force = false) => {
    try {
      await Promise.all([fetchLiveLocations(force), fetchEmployees(force)]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchEmployees, fetchLiveLocations]);

  useEffect(() => {
    fetchLiveLocations();
    fetchEmployees();
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
                upd[idx] = { ...upd[idx], lat: data.lat, lng: data.lng, totalDistance: data.totalDistance, address: data.address || upd[idx].address, updatedAt: new Date().toISOString() };
                return upd;
              }
              return prev;
            });
          });
          socket.on('employee_tracking_started', () => fetchAllData(true));
          socket.on('employee_tracking_stopped', () => fetchAllData(true));
        }
      } catch (e) {}
    };
    initSocket();
    const interval = setInterval(() => fetchLiveLocations(true), 30000); // Light poll GPS only every 30s
    return () => {
      clearInterval(interval);
      if (socket) {
        socket.off('employee_location');
        socket.off('employee_tracking_started');
        socket.off('employee_tracking_stopped');
      }
    };
  }, [fetchAllData, fetchEmployees, fetchLiveLocations]);

  const liveLocationIndex = useMemo(() => {
    const byEmployeeId = new Map();
    const byEmployeeCode = new Map();
    const byName = new Map();

    liveLocations.forEach((location) => {
      if (location.employeeId) byEmployeeId.set(String(location.employeeId), location);
      if (location.employeeIdCode) byEmployeeCode.set(String(location.employeeIdCode), location);
      if (location.name) byName.set(location.name.toLowerCase(), location);
    });

    return { byEmployeeId, byEmployeeCode, byName };
  }, [liveLocations]);

  const baseStaffList = allEmployeesList.length > 0 ? allEmployeesList : liveLocations;
  const directoryStaff = useMemo(() => {
    if (baseStaffList.length === 0) return [];

    const seen = new Set();
    const result = [];

    for (const emp of baseStaffList) {
      const idStr = String(emp._id || emp.employeeId || '');
      if (idStr && seen.has(idStr)) continue;
      if (idStr) seen.add(idStr);

      const liveLoc = liveLocationIndex.byEmployeeId.get(idStr)
        || liveLocationIndex.byEmployeeCode.get(String(emp.employeeId || ''))
        || liveLocationIndex.byName.get((emp.name || '').toLowerCase());
      const tracking = !!liveLoc || emp.isTracking;

      result.push({
        _id: idStr || `emp-${result.length}`,
        name: emp.name || 'Field Agent',
        avatar: emp.avatar || liveLoc?.avatar,
        department: emp.department || liveLoc?.department || 'Field Services',
        phone: emp.phone,
        status: tracking ? 'ON_FIELD' : (emp.isOnline ? 'AT_LOCATION' : 'OFFLINE'),
        isTracking: tracking,
        isOnline: emp.isOnline,
        lat: liveLoc?.lat || emp.lat || null,
        lng: liveLoc?.lng || emp.lng || null,
        totalDistance: liveLoc?.totalDistance || emp.totalDistance || 0,
        address: normalizeAddress(liveLoc?.address || emp.address || (liveLoc ? 'Tracking Active' : 'Not Punched In')),
        sessionId: liveLoc?.sessionId || emp.sessionId || null,
        updatedAt: liveLoc?.updatedAt || emp.updatedAt || null,
      });
    }

    return result;
  }, [baseStaffList, liveLocationIndex]);

  const activeCount = directoryStaff.filter((s) => s.isTracking).length;
  const totalKm = directoryStaff.reduce((sum, s) => sum + (parseFloat(s.totalDistance) || 0), 0);

  const filteredDirectory = useMemo(() => {
    const query = search.toLowerCase();
    return directoryStaff.filter((emp) => (
      !query
        || (emp.name || '').toLowerCase().includes(query)
        || (emp.address || '').toLowerCase().includes(query)
        || (emp.department || '').toLowerCase().includes(query)
    ));
  }, [directoryStaff, search]);

  const defaultRegion = useMemo(() => ({
    latitude: liveLocations[0]?.lat ? parseFloat(liveLocations[0].lat) : 26.8620,
    longitude: liveLocations[0]?.lng ? parseFloat(liveLocations[0].lng) : 80.9340,
    latitudeDelta: 0.09,
    longitudeDelta: 0.09,
  }), [liveLocations]);

  const mapStaff = useMemo(() => directoryStaff.map((s) => ({
    ...s,
    statusColor: STATUS_META[s.status]?.pin || '#94a3b8',
  })), [directoryStaff]);

  const handleSelectEmployee = useCallback(async (emp, routeSessionId = null) => {
    setSelectedEmployee(emp);
    setShowEmployeeModal(true);
    if (emp?.lat && emp?.lng && mapRef.current && typeof mapRef.current.animateToRegion === 'function') {
      mapRef.current.animateToRegion({
        latitude: parseFloat(emp.lat),
        longitude: parseFloat(emp.lng),
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      }, 800);
    }
    const sessId = routeSessionId || emp?.sessionId || emp?._id;
    if (sessId) {
      setLoadingRoute(true);
      try {
        const res = await trackingAPI.getSession(sessId);
        if (res.data?.success && res.data.session?.coordinates) {
          const rawCoords = res.data.session.coordinates;
          const sessionDist = res.data.session.totalDistance || 0;
          
          setSelectedEmployee(prev => ({ ...prev, totalDistance: sessionDist }));

          // Sort by timestamp descending (newest first) for the timeline view
          const sortedCoords = [...rawCoords].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          setFullSessionData(sortedCoords);
          
          setRouteCoords(cleanTrackingRoute(rawCoords.map((c) => ({
            latitude: parseFloat(c.lat),
            longitude: parseFloat(c.lng),
            timestamp: c.timestamp,
          }))));
        }
      } catch (e) {
        setRouteCoords([]);
        setFullSessionData([]);
        console.log('Employee route unavailable:', e.response?.data?.message || e.message);
      } finally {
        setLoadingRoute(false);
      }
    } else {
      setRouteCoords([]);
    }
  }, []);

  const recenterMap = () => {
    const target = directoryStaff.find((s) => s.lat && s.lng);
    if (target && mapRef.current && typeof mapRef.current.animateToRegion === 'function') {
      mapRef.current.animateToRegion({
        latitude: parseFloat(target.lat),
        longitude: parseFloat(target.lng),
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }, 600);
    }
  };

  const fitRoute = () => {
    if (routeCoords.length > 1 && mapRef.current?.fitToCoordinates) {
      mapRef.current.fitToCoordinates(routeCoords, {
        edgePadding: { top: 90, right: 60, bottom: 300, left: 60 },
        animated: true,
      });
    } else {
      recenterMap();
    }
  };

  const onRefresh = async () => { setRefreshing(true); clearCachePrefix('admin_'); await fetchAllData(true); };

  useEffect(() => {
    const employeeId = Array.isArray(requestedEmployeeId) ? requestedEmployeeId[0] : requestedEmployeeId;
    const sessionId = Array.isArray(requestedSessionId) ? requestedSessionId[0] : requestedSessionId;
    const requestKey = `${employeeId || ''}:${sessionId || ''}`;
    if (!requestKey.trim(':') || autoSelectedRef.current === requestKey) return;
    const employee = directoryStaff.find((item) =>
      (sessionId && String(item.sessionId) === String(sessionId)) ||
      (employeeId && String(item._id) === String(employeeId))
    );
    autoSelectedRef.current = requestKey;
    handleSelectEmployee(employee || { _id: employeeId, sessionId, name: 'Selected employee' }, sessionId);
  }, [directoryStaff, requestedEmployeeId, requestedSessionId]);

  const todayLabel = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={GREEN} />
        <Text style={styles.loadingText}>Loading live tracking…</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={GREEN_DARK} />

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <LinearGradient colors={[GREEN_DARK, GREEN]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(admin)/dashboard'))} accessibilityLabel="Back">
              <ArrowLeft size={19} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Live Tracking</Text>
              <Text style={styles.headerSub}>Track your field team in real-time</Text>
            </View>
            <TouchableOpacity style={styles.iconBtn} accessibilityLabel="Notifications">
              <Bell size={17} color="#fff" />
              <View style={styles.badge}><Text style={styles.badgeText}>3</Text></View>
            </TouchableOpacity>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{(user?.name || 'A').slice(0, 1).toUpperCase()}</Text>
            </View>
          </View>
          <View style={styles.headerControls}>
            <View style={styles.tabsWrap}>
              <View style={[styles.tab, styles.tabActive]}>
                <MapIcon size={13} color={GREEN} />
                <Text style={styles.tabActiveText}>Map</Text>
              </View>
              <TouchableOpacity style={styles.tab} onPress={() => setPanelOpen((v) => !v)}>
                <Users size={13} color="#64748b" />
                <Text style={styles.tabText}>Team</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.datePill}>
              <CalendarDays size={13} color={GREEN} />
              <Text style={styles.datePillText}>{todayLabel}</Text>
              <ChevronDown size={13} color="#64748b" />
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* ── MAP ────────────────────────────────────────────────── */}
      <View style={styles.mapWrap}>
        <MapViewComponent
          ref={mapRef}
          initialRegion={defaultRegion}
          directoryStaff={mapStaff}
          routeCoords={routeCoords}
          loadingRoute={loadingRoute}
          onSelectEmployee={handleSelectEmployee}
        />

        {/* Total distance card */}
        <TouchableOpacity style={[styles.distanceCard, cardShadow]} onPress={fitRoute} activeOpacity={0.9}>
          <View style={styles.distanceIcon}><Route size={16} color={GREEN} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.distanceLabel}>Total Distance</Text>
            <Text style={styles.distanceValue}>{totalKm.toFixed(1)} km</Text>
          </View>
          <ChevronRight size={16} color={GREEN} />
        </TouchableOpacity>

        {/* Floating controls */}
        <View style={styles.mapControls}>
          <TouchableOpacity style={[styles.mapCtrlBtn, cardShadow]} onPress={recenterMap} accessibilityLabel="My location">
            <LocateFixed size={17} color={GREEN} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.mapCtrlBtn, cardShadow]} onPress={fitRoute} accessibilityLabel="Fit route">
            <Route size={17} color={GREEN} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.mapCtrlBtn, cardShadow]}
            onPress={onRefresh}
            disabled={refreshing}
            accessibilityLabel="Refresh"
          >
            {refreshing ? <ActivityIndicator size="small" color={GREEN} /> : <RefreshCw size={16} color={GREEN} />}
          </TouchableOpacity>
        </View>

        {loadingRoute && (
          <View style={styles.routeLoader}>
            <ActivityIndicator color={GREEN} size="small" />
            <Text style={styles.routeLoaderText}>Drawing GPS route…</Text>
          </View>
        )}
      </View>

      {/* ── BOTTOM TEAM SHEET ──────────────────────────────────── */}
      <View style={[styles.sheet, cardShadow, !panelOpen && styles.sheetCollapsed]}>
        <TouchableOpacity style={styles.sheetHandleWrap} onPress={() => setPanelOpen((v) => !v)} activeOpacity={0.9}>
          <View style={styles.sheetHandle} />
        </TouchableOpacity>

        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Team Members ({directoryStaff.length})</Text>
          <TouchableOpacity style={styles.viewAll} onPress={() => router.push('/(admin)/team')}>
            <Text style={styles.viewAllText}>View All</Text>
            <ChevronRight size={13} color={GREEN} />
          </TouchableOpacity>
        </View>

        {panelOpen && (
          <>
            
            <FlatList
              data={filteredDirectory}
              keyExtractor={(item, idx) => (item && item._id) ? `${String(item._id)}-${idx}` : `staff-${idx}`}
              style={styles.sheetList}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <Users size={30} color="#fafbfd" />
                  <Text style={styles.emptyText}>{directoryStaff.length === 0 ? 'No employees found.' : 'No team members match your search.'}</Text>
                </View>
              }
              renderItem={({ item }) => {
                const meta = STATUS_META[item.status] || STATUS_META.OFFLINE;
                const selected = selectedEmployee?._id === item._id;
                const displayAddress = normalizeAddress(item.address);
                return (
                  <TouchableOpacity
                    style={[styles.memberRow, selected && styles.memberRowSelected]}
                    onPress={() => handleSelectEmployee(item)}
                    activeOpacity={0.85}
                  >
                    <View style={{ position: 'relative' }}>
                      {getAvatarUrl(item.avatar) ? (
                        <Avatar.Image size={38} source={{ uri: getAvatarUrl(item.avatar) }} />
                      ) : (
                        <Avatar.Text
                          size={38}
                          label={(item.name || 'E').slice(0, 2).toUpperCase()}
                          style={{ backgroundColor: meta.pin }}
                          labelStyle={{ color: '#fff', fontSize: 13 }}
                        />
                      )}
                      <View style={[styles.memberDot, { backgroundColor: meta.pin }]} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.memberName}>{item.name}</Text>
                      <Text style={styles.memberRole}>{item.department}</Text>
                      <View style={styles.memberLocRow}>
                        <MapPin size={9} color="#94a3b8" />
                        <Text style={styles.memberLoc} numberOfLines={1}>{displayAddress}</Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                        <View style={[styles.statusPillDot, { backgroundColor: meta.pin }]} />
                        <Text style={[styles.statusPillText, { color: meta.color }]}>{meta.label}</Text>
                      </View>
                      <Text style={styles.memberTime}>
                        {item.isTracking ? `${(parseFloat(item.totalDistance) || 0).toFixed(1)} km` : fmtTime(item.updatedAt)}
                      </Text>
                    </View>
                    <ChevronRight size={15} color="#cbd5e1" style={{ marginLeft: 6 }} />
                  </TouchableOpacity>
                );
              }}
            />
          </>
        )}
      </View>
      {/* ── EMPLOYEE DETAIL MODAL ──────────────────────────────── */}
      <Modal visible={showEmployeeModal} transparent animationType="slide" onRequestClose={() => setShowEmployeeModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              {selectedEmployee && (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    {getAvatarUrl(selectedEmployee.avatar) ? (
                      <Avatar.Image size={40} source={{ uri: getAvatarUrl(selectedEmployee.avatar) }} />
                    ) : (
                      <Avatar.Text size={40} label={(selectedEmployee.name || 'E').slice(0, 2).toUpperCase()} />
                    )}
                    <View style={{ marginLeft: 12 }}>
                      <Text style={{ fontFamily: FONT, fontSize: 16, fontWeight: 'bold', color: '#1e293b' }}>{selectedEmployee.name}</Text>
                      <Text style={{ fontFamily: FONT, fontSize: 12, color: '#64748b' }}>{selectedEmployee.department || 'Employee'}</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => setShowEmployeeModal(false)} style={styles.closeBtn}>
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>Close</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            <View style={styles.modalStatsRow}>
              <View style={styles.modalStatBox}>
                <Text style={styles.modalStatLabel}>Total Distance Today</Text>
                <Text style={styles.modalStatValue}>{selectedEmployee?.totalDistance ? parseFloat(selectedEmployee.totalDistance).toFixed(2) : '0.00'} km</Text>
              </View>
              <View style={styles.modalStatBox}>
                <Text style={styles.modalStatLabel}>Current Status</Text>
                <Text style={[styles.modalStatValue, { color: STATUS_META[selectedEmployee?.status]?.color || '#64748b' }]}>
                  {STATUS_META[selectedEmployee?.status]?.label || 'Offline'}
                </Text>
              </View>
            </View>

            <Text style={{ fontFamily: FONT, fontSize: 14, fontWeight: 'bold', color: '#334155', marginHorizontal: 16, marginTop: 10, marginBottom: 5 }}>
              Activity & Path Timeline
            </Text>

            {loadingRoute ? (
              <View style={{ padding: 30, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={GREEN} />
                <Text style={{ marginTop: 10, color: '#64748b' }}>Loading path data...</Text>
              </View>
            ) : fullSessionData.length === 0 ? (
              <View style={{ padding: 30, alignItems: 'center' }}>
                <Text style={{ color: '#94a3b8' }}>No location data available for today.</Text>
              </View>
            ) : (
              <FlatList
                data={fullSessionData}
                keyExtractor={(item, index) => (item && (item._id || item.eventId)) ? String(item._id || item.eventId) : `coord-${index}`}
                contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
                renderItem={({ item, index }) => (
                  <View style={styles.timelineRow}>
                    <View style={styles.timelineDotWrap}>
                      <View style={styles.timelineDot} />
                      {index !== fullSessionData.length - 1 && <View style={styles.timelineLine} />}
                    </View>
                    <View style={styles.timelineContent}>
                      <Text style={styles.timelineTime}>{fmtTime(item.timestamp)}</Text>
                      <Text style={styles.timelineAddress}>{item.address || `${parseFloat(item.lat).toFixed(5)}, ${parseFloat(item.lng).toFixed(5)}`}</Text>
                      {item.speed > 0 && <Text style={styles.timelineSpeed}>Speed: {parseFloat(item.speed).toFixed(1)} km/h</Text>}
                    </View>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f3f6f4' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f3f6f4' },
  loadingText: { fontFamily: FONT, fontSize: 12, color: '#64748b', marginTop: 8 },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 10, gap: 9 },
  iconBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 5, right: 5, minWidth: 13, height: 13, borderRadius: 7, backgroundColor: '#ef3154', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  badgeText: { color: '#fff', fontSize: 7, fontWeight: 'bold' },
  headerTitle: { color: '#fff', fontFamily: FONT, fontSize: 16, fontWeight: 'bold' },
  headerSub: { color: '#a7f3d0', fontFamily: FONT, fontSize: 9, marginTop: 1 },
  avatarCircle: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#ef3154', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#fff' },
  avatarText: { color: '#fff', fontFamily: FONT, fontSize: 11, fontWeight: 'bold' },

  headerControls: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12, gap: 10 },
  tabsWrap: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 3 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 13, paddingVertical: 6, borderRadius: 9 },
  tabActive: { backgroundColor: '#e7f6ec' },
  tabActiveText: { fontFamily: FONT, fontSize: 10, fontWeight: 'bold', color: GREEN },
  tabText: { fontFamily: FONT, fontSize: 10, fontWeight: '700', color: '#64748b' },
  datePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 11, paddingVertical: 7, marginLeft: 'auto' },
  datePillText: { fontFamily: FONT, fontSize: 9, fontWeight: '700', color: '#334155' },

  mapWrap: { flex: 1, position: 'relative', minHeight: 300 },

  livePillCard: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 13, paddingHorizontal: 11, paddingVertical: 8 },
  livePillDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#16a34a' },
  livePillTitle: { fontFamily: FONT, fontSize: 11, fontWeight: 'bold', color: '#0f172a' },
  livePillSub: { fontFamily: FONT, fontSize: 8, color: '#64748b', marginTop: 1 },

  legendCard: { position: 'absolute', top: 12, right: 12, backgroundColor: '#fff', borderRadius: 13, padding: 9, gap: 6 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { fontFamily: FONT, fontSize: 9, fontWeight: '700', color: '#334155' },

  distanceCard: { position: 'absolute', left: 12, bottom: 14, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 13, paddingHorizontal: 11, paddingVertical: 9, minWidth: 150 },
  distanceIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: '#e7f6ec', alignItems: 'center', justifyContent: 'center' },
  distanceLabel: { fontFamily: FONT, fontSize: 8, color: '#64748b', fontWeight: '700' },
  distanceValue: { fontFamily: FONT, fontSize: 14, fontWeight: 'bold', color: '#0f172a', marginTop: 1 },

  mapControls: { position: 'absolute', right: 12, bottom: 14, gap: 8 },
  mapCtrlBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },

  routeLoader: { position: 'absolute', top: 58, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.94)', paddingHorizontal: 13, paddingVertical: 7, borderRadius: 18, gap: 7 },
  routeLoaderText: { fontFamily: FONT, fontSize: 10, fontWeight: 'bold', color: GREEN },

  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 14, paddingBottom: Platform.OS === 'ios' ? 18 : 10, maxHeight: 330, flexShrink: 0 },
  sheetCollapsed: { maxHeight: 74 },
  sheetHandleWrap: { alignItems: 'center', paddingVertical: 8 },
  sheetHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: '#e2e8f0' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 },
  sheetTitle: { fontFamily: FONT, fontSize: 14, fontWeight: 'bold', color: '#0f172a' },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAllText: { fontFamily: FONT, fontSize: 10, fontWeight: '700', color: GREEN },

  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 11, paddingHorizontal: 10, height: 36, gap: 7, marginBottom: 8 },
  searchInput: { flex: 1, fontFamily: FONT, fontSize: 11, color: '#0f172a', paddingVertical: 0 },
  sheetList: { maxHeight: 214 },

  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 6, borderRadius: 12 },
  memberRowSelected: { backgroundColor: '#e7f6ec' },
  memberDot: { width: 9, height: 9, borderRadius: 5, position: 'absolute', bottom: 0, right: 0, borderWidth: 1.5, borderColor: '#fff' },
  memberName: { fontFamily: FONT, fontSize: 12, fontWeight: 'bold', color: '#0f172a' },
  memberRole: { fontFamily: FONT, fontSize: 8.5, color: '#64748b', marginTop: 1 },
  memberLocRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  memberLoc: { fontFamily: FONT, fontSize: 8.5, color: '#94a3b8', flex: 1 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3 },
  statusPillDot: { width: 5, height: 5, borderRadius: 3 },
  statusPillText: { fontFamily: FONT, fontSize: 7.5, fontWeight: 'bold' },
  memberTime: { fontFamily: FONT, fontSize: 9, fontWeight: '700', color: '#94a3b8', marginTop: 4 },

  emptyWrap: { alignItems: 'center', paddingVertical: 22 },
  emptyText: { fontFamily: FONT, fontSize: 10, color: '#94a3b8', marginTop: 6 },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '85%', minHeight: '50%', paddingBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -5 }, shadowOpacity: 0.1, shadowRadius: 15, elevation: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  closeBtn: { backgroundColor: '#ef4444', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  modalStatsRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, gap: 12 },
  modalStatBox: { flex: 1, backgroundColor: '#f8fafc', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  modalStatLabel: { fontFamily: FONT, color: '#64748b', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' },
  modalStatValue: { fontFamily: FONT, color: '#0f172a', fontSize: 18, fontWeight: 'bold', marginTop: 4 },
  timelineRow: { flexDirection: 'row' },
  timelineDotWrap: { width: 30, alignItems: 'center' },
  timelineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: GREEN, marginTop: 4, borderWidth: 2, borderColor: '#e7f6ec' },
  timelineLine: { width: 2, flex: 1, backgroundColor: '#e2e8f0', marginVertical: 4 },
  timelineContent: { flex: 1, paddingBottom: 24, paddingLeft: 10 },
  timelineTime: { fontFamily: FONT, fontSize: 12, fontWeight: 'bold', color: '#64748b' },
  timelineAddress: { fontFamily: FONT, fontSize: 13, color: '#334155', marginTop: 4, lineHeight: 18 },
  timelineSpeed: { fontFamily: FONT, fontSize: 11, color: '#0ea5e9', fontWeight: 'bold', marginTop: 6 },
});
