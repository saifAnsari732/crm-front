import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  StyleSheet, View, TouchableOpacity, ActivityIndicator,
  Platform, FlatList, StatusBar, Modal, ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Avatar } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft, Users, LocateFixed, RefreshCw, Route, MapPin, ChevronRight, X, Clock, Activity
} from 'lucide-react-native';
import MapViewComponent from '../../components/MapViewComponent';
import { trackingAPI, adminAPI, getAvatarUrl } from '../../services/api';
import { cachedFetch, clearCachePrefix } from '../../services/cache';
import socketService from '../../services/socket';
import { useAuth } from '../../context/AuthContext';
import { cleanTrackingRoute } from '../../utils/trackingRoute';
import { useLocalSearchParams, useRouter } from 'expo-router';

const FONT = Platform.OS === 'ios' ? 'System' : 'sans-serif-medium';
const GREEN = '#0f766e';
const GREEN_DARK = '#064e3b';

const cardShadow = Platform.OS === 'web'
  ? { boxShadow: '0px 4px 16px rgba(15, 23, 42, 0.08)' }
  : { elevation: 3, shadowColor: '#0f172a', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } };

const STATUS_META = {
  ON_FIELD: { label: 'On Field', color: '#047857', bg: '#ecfdf5', pin: '#10b981' },
  IN_TRANSIT: { label: 'In Transit', color: '#1d4ed8', bg: '#eff6ff', pin: '#3b82f6' },
  AT_LOCATION: { label: 'At Location', color: '#b45309', bg: '#fffbeb', pin: '#f59e0b' },
  OFFLINE: { label: 'Offline', color: '#64748b', bg: '#f8fafc', pin: '#94a3b8' },
};

const fmtTime = (t) => (t ? new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—');
const normalizeAddress = (value) => {
  if (!value) return '';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === 'Tracking Active' || trimmed === 'Location unavailable' || trimmed === 'Not Punched In') return '';
    return trimmed;
  }
  if (typeof value === 'object') {
    const parts = [value.street, value.city, value.state, value.pincode].filter(Boolean);
    return parts.length ? parts.join(', ') : '';
  }
  return String(value);
};

const buildPathTimeline = (coordinates = []) => {
  const sorted = [...coordinates]
    .filter((point) => point && Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng)))
    .sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));

  if (!sorted.length) return [];

  const timeline = [sorted[0]];
  let distSinceLastCheckpoint = 0;
  let checkpointRef = sorted[0];

  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index];
    const prev = checkpointRef;
    const latitudeDelta = Number(current.lat) - Number(prev.lat);
    const longitudeDelta = Number(current.lng) - Number(prev.lng);
    const distanceKm = Math.sqrt((latitudeDelta ** 2) + (longitudeDelta ** 2)) * 111;
    const timeGapMinutes = prev.timestamp && current.timestamp
      ? (new Date(current.timestamp).getTime() - new Date(prev.timestamp).getTime()) / 60000
      : 0;

    distSinceLastCheckpoint += Number.isFinite(distanceKm) ? distanceKm : 0;

    if (timeGapMinutes >= 5 || distSinceLastCheckpoint >= 5 || index === sorted.length - 1) {
      timeline.push(current);
      checkpointRef = current;
      distSinceLastCheckpoint = 0;
    }
  }

  return timeline.map((point, index) => ({
    ...point,
    _id: point._id || point.eventId || `${point.timestamp || index}-${index}`,
    address: point.address || normalizeAddress(point.address) || `${Number(point.lat).toFixed(5)}, ${Number(point.lng).toFixed(5)}`,
    speed: Number(point.speed || 0),
  }));
};

const getRouteSummary = (coordinates = []) => {
  const validCoords = (coordinates || []).filter((point) => point && Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng)));
  if (!validCoords.length) return { start: null, end: null, points: 0, durationLabel: 'No route' };

  const first = validCoords[0];
  const last = validCoords[validCoords.length - 1];
  const startTimestamp = first.timestamp ? new Date(first.timestamp).getTime() : null;
  const endTimestamp = last.timestamp ? new Date(last.timestamp).getTime() : null;
  const spanMs = startTimestamp && endTimestamp ? Math.max(0, endTimestamp - startTimestamp) : 0;

  let durationLabel = 'Live route';
  if (spanMs > 0) {
    const totalMinutes = Math.round(spanMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    durationLabel = hours > 0 ? `${hours}h ${minutes}m` : `${minutes} min`;
  }

  return {
    start: first,
    end: last,
    points: validCoords.length,
    durationLabel,
  };
};

export default function AdminTrackingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { employeeId: requestedEmployeeId, sessionId: requestedSessionId } = useLocalSearchParams();
  const autoSelectedRef = useRef('');
  const mapRef = useRef(null);

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
      const empRes = await cachedFetch('admin_employees', () => adminAPI.getEmployees({ limit: 200, role: 'all' }), 10, force);
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
    const interval = setInterval(() => fetchLiveLocations(true), 30000);
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

  const directoryStaff = useMemo(() => {
    const seen = new Set();
    const result = [];

    // 1. Live location sessions first (active GPS sessions)
    for (const loc of liveLocations) {
      const idStr = String(loc.employeeId || loc.employee?._id || loc.employee || loc._id || '');
      if (!idStr || seen.has(idStr)) continue;
      seen.add(idStr);

      const empMatch = allEmployeesList.find(e => String(e._id) === idStr);
      result.push({
        _id: idStr,
        name: empMatch?.name || loc.name || loc.employeeName || loc.employee?.name || 'Field Executive',
        avatar: empMatch?.avatar || loc.avatar,
        department: empMatch?.department || loc.department || '',
        phone: empMatch?.phone || loc.phone,
        status: 'ON_FIELD',
        isTracking: true,
        isOnline: true,
        lat: loc.lat || loc.latitude,
        lng: loc.lng || loc.longitude,
        totalDistance: loc.totalDistance || 0,
        address: normalizeAddress(loc.address),
        sessionId: loc.sessionId || loc._id,
        updatedAt: loc.updatedAt || new Date().toISOString(),
      });
    }

    // 2. Remaining staff
    for (const emp of allEmployeesList) {
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
        department: emp.department || liveLoc?.department || '',
        phone: emp.phone,
        status: tracking ? 'ON_FIELD' : (emp.isOnline ? 'AT_LOCATION' : 'OFFLINE'),
        isTracking: tracking,
        isOnline: emp.isOnline,
        lat: liveLoc?.lat || emp.lat || null,
        lng: liveLoc?.lng || emp.lng || null,
        totalDistance: liveLoc?.totalDistance || emp.totalDistance || 0,
        address: normalizeAddress(liveLoc?.address || emp.address),
        sessionId: liveLoc?.sessionId || emp.sessionId || null,
        updatedAt: liveLoc?.updatedAt || emp.updatedAt || null,
      });
    }

    return result;
  }, [allEmployeesList, liveLocations, liveLocationIndex]);

  const activeCount = directoryStaff.filter((s) => s.isTracking || s.status === 'ON_FIELD').length;

  // Compute map region dynamically to fit ALL active employees on the map automatically
  const defaultRegion = useMemo(() => {
    const activeStaffWithCoords = directoryStaff.filter(s => (s.isTracking || s.status === 'ON_FIELD') && s.lat && s.lng);
    if (activeStaffWithCoords.length > 0) {
      const lats = activeStaffWithCoords.map(s => parseFloat(s.lat)).filter(n => !isNaN(n));
      const lngs = activeStaffWithCoords.map(s => parseFloat(s.lng)).filter(n => !isNaN(n));
      if (lats.length > 0 && lngs.length > 0) {
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        const latDelta = Math.max((maxLat - minLat) * 1.5, 0.08);
        const lngDelta = Math.max((maxLng - minLng) * 1.5, 0.08);
        return {
          latitude: (minLat + maxLat) / 2,
          longitude: (minLng + maxLng) / 2,
          latitudeDelta: latDelta,
          longitudeDelta: lngDelta,
        };
      }
    }
    return {
      latitude: liveLocations[0]?.lat ? parseFloat(liveLocations[0].lat) : 26.8620,
      longitude: liveLocations[0]?.lng ? parseFloat(liveLocations[0].lng) : 80.9340,
      latitudeDelta: 0.12,
      longitudeDelta: 0.12,
    };
  }, [directoryStaff, liveLocations]);

  const mapStaff = useMemo(() => directoryStaff.map((s) => ({
    ...s,
    statusColor: STATUS_META[s.status]?.pin || '#94a3b8',
  })), [directoryStaff]);

  const handleSelectEmployee = useCallback(async (emp, routeSessionId = null) => {
    if (!emp || (!emp._id && !emp.employeeId)) return;

    const baseEmployee = {
      ...emp,
      name: emp.name && emp.name !== 'Selected employee' ? emp.name : 'Field Executive',
    };
    setSelectedEmployee({ ...baseEmployee, routeSummary: getRouteSummary(baseEmployee.routeSummary?.start ? [baseEmployee.routeSummary.start, baseEmployee.routeSummary.end] : []) });
    setShowEmployeeModal(true);
    if (baseEmployee?.lat && baseEmployee?.lng && mapRef.current && typeof mapRef.current.animateToRegion === 'function') {
      mapRef.current.animateToRegion({
        latitude: parseFloat(baseEmployee.lat),
        longitude: parseFloat(baseEmployee.lng),
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      }, 800);
    }

    const employeeId = baseEmployee?._id || baseEmployee?.employeeId || null;
    const preferredIds = [];
    if (employeeId) preferredIds.push(employeeId);
    if (routeSessionId) preferredIds.push(routeSessionId);
    if (baseEmployee?.sessionId) preferredIds.push(baseEmployee.sessionId);

    if (preferredIds.length > 0) {
      setLoadingRoute(true);
      try {
        let chosenResponse = null;
        for (const candidateId of preferredIds) {
          try {
            const res = await trackingAPI.getSession(candidateId);
            if (res.data?.success) {
              chosenResponse = res;
              break;
            }
          } catch (e) {}
        }

        if (chosenResponse?.data?.success) {
          const sessionData = chosenResponse.data.session || {};
          const rawCoords = sessionData.coordinates || [];
          const sessionDist = Number(sessionData.totalDistance || baseEmployee.totalDistance || 0);
          const employeeDayTotal = Number((employeeId && sessionData.isCombined) ? sessionData.totalDistance : 0) || sessionDist;
          const finalDistance = employeeDayTotal || sessionDist;
          const sortedCoords = [...rawCoords].sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
          const routeSummary = getRouteSummary(sortedCoords.map((c) => ({
            lat: Number(c.lat),
            lng: Number(c.lng),
            timestamp: c.timestamp,
          })));
          const checkpointedTimeline = buildPathTimeline(sortedCoords);

          setSelectedEmployee((prev) => ({
            ...(prev || baseEmployee),
            ...baseEmployee,
            totalDistance: finalDistance,
            routeSummary,
          }));

          setFullSessionData(checkpointedTimeline);
          setRouteCoords(cleanTrackingRoute(sortedCoords.map((c) => ({
            latitude: parseFloat(c.lat),
            longitude: parseFloat(c.lng),
            timestamp: c.timestamp,
          }))));
        } else {
          setSelectedEmployee((prev) => ({
            ...(prev || baseEmployee),
            ...baseEmployee,
            totalDistance: Number(baseEmployee.totalDistance || 0),
            routeSummary: getRouteSummary([]),
          }));
          setRouteCoords([]);
          setFullSessionData([]);
        }
      } catch (e) {
        setRouteCoords([]);
        setFullSessionData([]);
        setSelectedEmployee((prev) => ({
          ...(prev || baseEmployee),
          ...baseEmployee,
          totalDistance: Number(baseEmployee.totalDistance || 0),
          routeSummary: getRouteSummary([]),
        }));
      } finally {
        setLoadingRoute(false);
      }
    } else {
      setRouteCoords([]);
      setFullSessionData([]);
      setSelectedEmployee((prev) => ({
        ...(prev || baseEmployee),
        ...baseEmployee,
        totalDistance: Number(baseEmployee.totalDistance || 0),
        routeSummary: getRouteSummary([]),
      }));
    }
  }, []);

  const recenterMap = useCallback(() => {
    const activeCoords = directoryStaff.filter((s) => s.lat && s.lng && (s.isTracking || s.status === 'ON_FIELD' || s.status === 'IN_TRANSIT' || s.status === 'AT_LOCATION'));
    const targetCoords = activeCoords.length > 0 ? activeCoords : directoryStaff.filter((s) => s.lat && s.lng);

    if (targetCoords.length > 0 && mapRef.current?.fitToCoordinates) {
      mapRef.current.fitToCoordinates(
        targetCoords.map(s => ({ latitude: parseFloat(s.lat), longitude: parseFloat(s.lng) })),
        { edgePadding: { top: 80, right: 50, bottom: 250, left: 50 }, animated: true }
      );
    } else {
      const target = directoryStaff.find((s) => s.lat && s.lng);
      if (target && mapRef.current?.animateToRegion) {
        mapRef.current.animateToRegion({
          latitude: parseFloat(target.lat),
          longitude: parseFloat(target.lng),
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }, 600);
      }
    }
  }, [directoryStaff]);

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

  // Auto-center map to show ALL employees on initial page load
  const hasAutoCenteredRef = useRef(false);
  useEffect(() => {
    const hasRequestedEmp = requestedEmployeeId || requestedSessionId;
    if (directoryStaff.length > 0 && !hasRequestedEmp && !hasAutoCenteredRef.current) {
      hasAutoCenteredRef.current = true;
      const timer = setTimeout(() => {
        recenterMap();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [directoryStaff, requestedEmployeeId, requestedSessionId, recenterMap]);

  useEffect(() => {
    const employeeId = Array.isArray(requestedEmployeeId) ? requestedEmployeeId[0] : requestedEmployeeId;
    const sessionId = Array.isArray(requestedSessionId) ? requestedSessionId[0] : requestedSessionId;
    if (!employeeId && !sessionId) return;
    const requestKey = `${employeeId || ''}:${sessionId || ''}`;
    if (autoSelectedRef.current === requestKey) return;

    const employee = directoryStaff.find((item) =>
      (sessionId && String(item.sessionId) === String(sessionId)) ||
      (employeeId && String(item._id) === String(employeeId))
    );

    if (employee) {
      autoSelectedRef.current = requestKey;
      handleSelectEmployee(employee, sessionId);
    } else if (employeeId && allEmployeesList.length > 0) {
      const matchInAll = allEmployeesList.find(e => String(e._id) === String(employeeId));
      if (matchInAll) {
        autoSelectedRef.current = requestKey;
        handleSelectEmployee(matchInAll, sessionId);
      } else {
        autoSelectedRef.current = requestKey;
        handleSelectEmployee({ _id: employeeId, name: 'Field Executive' }, sessionId);
      }
    }
  }, [directoryStaff, allEmployeesList, requestedEmployeeId, requestedSessionId, handleSelectEmployee]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={GREEN} />
        <Text style={styles.loadingText}>Connecting live telematics…</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#022c17" />

      {/* ── PROFESSIONAL EXECUTIVE HEADER ───────────────────────── */}
      <LinearGradient
        colors={['#022c17', '#064e3b', '#0d9488']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.fullWidthHeader}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.headerBackBtn}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(admin)/dashboard'))}
              activeOpacity={0.8}
            >
              <ArrowLeft size={18} color="#ffffff" />
            </TouchableOpacity>

            <View style={styles.headerTitleWrap}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.headerTitleText}>Live Map Tracking</Text>
                <View style={styles.activePillBadge}>
                  <View style={styles.liveGreenDot} />
                  <Text style={styles.activePillText}>{activeCount} Active</Text>
                </View>
              </View>
              <Text style={styles.headerSubText}>Real-Time Field Telemetry & Trajectory</Text>
            </View>

            <TouchableOpacity
              style={styles.headerRefreshBtn}
              onPress={onRefresh}
              disabled={refreshing}
              activeOpacity={0.8}
            >
              {refreshing ? <ActivityIndicator size="small" color="#ffffff" /> : <RefreshCw size={16} color="#ffffff" />}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* ── MAP CONTAINER ───────────────────────────────────────── */}
      <View style={styles.mapWrap}>
        <MapViewComponent
          ref={mapRef}
          initialRegion={defaultRegion}
          directoryStaff={mapStaff}
          routeCoords={routeCoords}
          loadingRoute={loadingRoute}
          onSelectEmployee={handleSelectEmployee}
        />

        {/* Floating controls */}
        <View style={styles.mapControls}>
          <TouchableOpacity style={[styles.mapCtrlBtn, cardShadow]} onPress={recenterMap} activeOpacity={0.85}>
            <LocateFixed size={18} color={GREEN} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.mapCtrlBtn, cardShadow]} onPress={fitRoute} activeOpacity={0.85}>
            <Route size={18} color={GREEN} />
          </TouchableOpacity>
        </View>

        {loadingRoute && (
          <View style={styles.routeLoader}>
            <ActivityIndicator color={GREEN} size="small" />
            <Text style={styles.routeLoaderText}>Tracing GPS trajectory…</Text>
          </View>
        )}
      </View>

      {/* ── CLEAN BOTTOM TEAM SHEET (NO SEARCH / NO TABS) ────────── */}
      <View style={[styles.sheet, cardShadow, !panelOpen && styles.sheetCollapsed]}>
        <TouchableOpacity style={styles.sheetHandleWrap} onPress={() => setPanelOpen((v) => !v)} activeOpacity={0.9}>
          <View style={styles.sheetHandle} />
        </TouchableOpacity>

        {/* Sheet Header */}
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Active Team ({directoryStaff.length})</Text>
          <TouchableOpacity style={styles.viewAll} onPress={() => router.push('/(admin)/team')}>
            <Text style={styles.viewAllText}>All Employees</Text>
            <ChevronRight size={13} color={GREEN} />
          </TouchableOpacity>
        </View>

        {panelOpen && (
          <FlatList
            data={directoryStaff}
            keyExtractor={(item, idx) => (item && item._id) ? `${String(item._id)}-${idx}` : `staff-${idx}`}
            style={styles.sheetList}
            contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16), paddingTop: 4 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Users size={24} color="#94a3b8" />
                <Text style={styles.emptyText}>No active employees currently on map.</Text>
              </View>
            }
            renderItem={({ item }) => {
              const meta = STATUS_META[item.status] || STATUS_META.OFFLINE;
              const selected = selectedEmployee?._id === item._id;
              const displayAddress = normalizeAddress(item.address);
              const hasAddress = Boolean(displayAddress);

              return (
                <TouchableOpacity
                  style={[styles.memberCard, selected && styles.memberCardSelected]}
                  onPress={() => handleSelectEmployee(item)}
                  activeOpacity={0.85}
                >
                  {/* Avatar with Status Ring */}
                  <View style={{ position: 'relative' }}>
                    {getAvatarUrl(item.avatar) ? (
                      <Avatar.Image size={40} source={{ uri: getAvatarUrl(item.avatar) }} />
                    ) : (
                      <Avatar.Text
                        size={40}
                        label={(item.name || 'E').slice(0, 2).toUpperCase()}
                        style={{ backgroundColor: meta.pin }}
                        labelStyle={{ color: '#fff', fontSize: 14, fontWeight: '700' }}
                      />
                    )}
                    <View style={[styles.memberDot, { backgroundColor: meta.pin }]} />
                  </View>

                  {/* Content Section: Name & Real Address only (Clean design) */}
                  <View style={styles.memberMainContent}>
                    <Text style={styles.memberName} numberOfLines={1}>{item.name}</Text>
                    {hasAddress ? (
                      <View style={styles.memberLocRow}>
                        <MapPin size={10} color="#64748b" />
                        <Text style={styles.memberLoc} numberOfLines={1}>{displayAddress}</Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Right Telemetry Badge */}
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                      <View style={[styles.statusPillDot, { backgroundColor: meta.pin }]} />
                      <Text style={[styles.statusPillText, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                    {item.isTracking && (
                      <View style={styles.distBadge}>
                        <Text style={styles.distBadgeText}>{(parseFloat(item.totalDistance) || 0).toFixed(1)} km</Text>
                      </View>
                    )}
                  </View>
                  <ChevronRight size={14} color="#cbd5e1" style={{ marginLeft: 6 }} />
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>

      {/* ── EMPLOYEE DETAIL MODAL (UI/UX PRO MAX) ──────────────────────────────── */}
      <Modal visible={showEmployeeModal} transparent animationType="slide" onRequestClose={() => setShowEmployeeModal(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowEmployeeModal(false)} activeOpacity={1} />
          <View style={styles.modalContent}>
            <View style={styles.sheetHandleWrap}>
              <View style={styles.sheetHandle} />
            </View>

            <View style={styles.modalHeader}>
              {selectedEmployee && (
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}>
                  {getAvatarUrl(selectedEmployee.avatar) ? (
                    <Avatar.Image size={44} source={{ uri: getAvatarUrl(selectedEmployee.avatar) }} style={{ borderWidth: 2, borderColor: '#10b981' }} />
                  ) : (
                    <Avatar.Text
                      size={44}
                      label={(selectedEmployee.name || 'E').slice(0, 2).toUpperCase()}
                      style={{ backgroundColor: '#064e3b' }}
                      labelStyle={{ color: '#fff', fontSize: 15, fontWeight: '800' }}
                    />
                  )}
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontFamily: FONT, fontSize: 16, fontWeight: '800', color: '#0f172a' }}>{selectedEmployee.name}</Text>
                      {selectedEmployee.isTracking && (
                        <View style={styles.modalLiveBadge}>
                          <View style={styles.modalLiveDot} />
                          <Text style={styles.modalLiveText}>LIVE</Text>
                        </View>
                      )}
                    </View>
                    {normalizeAddress(selectedEmployee.address) ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <MapPin size={11} color="#64748b" />
                        <Text style={{ fontFamily: FONT, fontSize: 11, color: '#64748b', fontWeight: '500' }} numberOfLines={1}>
                          {normalizeAddress(selectedEmployee.address)}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              )}
              <TouchableOpacity style={styles.closeBtnPill} onPress={() => setShowEmployeeModal(false)}>
                <X size={16} color="#475569" />
              </TouchableOpacity>
            </View>

            {selectedEmployee && (
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 30, paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
                {/* Metrics Cards Row */}
                <View style={styles.modalStatsRow}>
                  <View style={styles.modalStatBoxPrimary}>
                    <View style={styles.statBoxHeader}>
                      <Route size={14} color="#047857" />
                      <Text style={styles.modalStatLabelPrimary}>Total Distance</Text>
                    </View>
                    <Text style={styles.modalStatValuePrimary}>
                      {(parseFloat(selectedEmployee.totalDistance) || 0).toFixed(2)} <Text style={{ fontSize: 12, fontWeight: '800', color: '#059669' }}>KM</Text>
                    </Text>
                  </View>

                  <View style={styles.modalStatBoxSecondary}>
                    <View style={styles.statBoxHeader}>
                      <MapPin size={14} color="#0284c7" />
                      <Text style={styles.modalStatLabelSecondary}>Route Points</Text>
                    </View>
                    <Text style={styles.modalStatValueSecondary}>
                      {fullSessionData.length} <Text style={{ fontSize: 12, fontWeight: '800', color: '#0284c7' }}>Points</Text>
                    </Text>
                  </View>
                </View>

                {/* GPS Trajectory Timeline Card */}
                {fullSessionData.length > 0 && (
                  <View style={styles.routeSummaryCard}>
                    <View style={styles.timelineHeaderRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Activity size={16} color="#059669" />
                        <Text style={styles.routeSummaryTitle}>GPS Trajectory Timeline</Text>
                      </View>
                      <View style={styles.timelineCountBadge}>
                        <Text style={styles.timelineCountText}>{fullSessionData.length} checkpoints</Text>
                      </View>
                    </View>

                    <View style={{ marginTop: 14 }}>
                      {fullSessionData.map((pt, idx) => {
                        const isLatest = idx === fullSessionData.length - 1;
                        const isFirst = idx === 0;
                        const isCoordOnly = !pt.address || pt.address.includes(',');

                        return (
                          <View key={pt._id || idx} style={styles.timelineRow}>
                            <View style={styles.timelineDotWrap}>
                              {isLatest ? (
                                <View style={styles.timelineLatestOuterDot}>
                                  <View style={styles.timelineLatestInnerDot} />
                                </View>
                              ) : isFirst ? (
                                <View style={styles.timelineStartDot} />
                              ) : (
                                <View style={styles.timelineDot} />
                              )}
                              {idx < fullSessionData.length - 1 && <View style={styles.timelineLine} />}
                            </View>
                            <View style={styles.timelineContent}>
                              <View style={styles.timelineTimeRow}>
                                <Clock size={11} color="#64748b" />
                                <Text style={styles.timelineTime}>{fmtTime(pt.timestamp)}</Text>
                                {isLatest && (
                                  <View style={styles.latestTag}>
                                    <Text style={styles.latestTagText}>Latest Ping</Text>
                                  </View>
                                )}
                                {isFirst && (
                                  <View style={styles.startTag}>
                                    <Text style={styles.startTagText}>Start</Text>
                                  </View>
                                )}
                              </View>
                              <Text style={[styles.timelineAddress, isCoordOnly && styles.timelineCoordText]}>
                                {pt.address}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
  loadingText: { fontFamily: FONT, fontSize: 13, color: '#64748b', marginTop: 10 },

  fullWidthHeader: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: { flex: 1 },
  headerTitleText: { fontFamily: FONT, fontSize: 18, fontWeight: 'bold', color: '#ffffff' },
  headerSubText: { fontFamily: FONT, fontSize: 10.5, color: 'rgba(255, 255, 255, 0.8)', marginTop: 2 },

  activePillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    paddingHorizontal: 9,
    paddingVertical: 2.5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.4)',
  },
  activePillText: {
    color: '#34d399',
    fontSize: 10.5,
    fontWeight: '800',
  },
  liveGreenDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10b981',
  },
  headerRefreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  mapWrap: { flex: 1, position: 'relative' },
  mapControls: { position: 'absolute', right: 12, bottom: 14, gap: 8 },
  mapCtrlBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  routeLoader: { position: 'absolute', top: 16, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.96)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, gap: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  routeLoaderText: { fontFamily: FONT, fontSize: 11, fontWeight: 'bold', color: GREEN },

  // Bottom Sheet - Compact Height (42% max screen height)
  sheet: { backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 8, maxHeight: '42%', flexShrink: 0 },
  sheetCollapsed: { maxHeight: 56 },
  sheetHandleWrap: { alignItems: 'center', paddingVertical: 6 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#cbd5e1' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sheetTitle: { fontFamily: FONT, fontSize: 14, fontWeight: 'bold', color: '#0f172a' },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAllText: { fontFamily: FONT, fontSize: 11, fontWeight: '700', color: GREEN },

  sheetList: { flexGrow: 1 },

  // Member Card Item Design
  memberCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 10, borderRadius: 12, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#f1f5f9', marginBottom: 6 },
  memberCardSelected: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  memberDot: { width: 10, height: 10, borderRadius: 5, position: 'absolute', bottom: -1, right: -1, borderWidth: 2, borderColor: '#fff' },
  memberMainContent: { flex: 1, marginLeft: 10, justifyContent: 'center' },
  memberName: { fontFamily: FONT, fontSize: 13, fontWeight: '700', color: '#0f172a' },
  memberLocRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  memberLoc: { fontFamily: FONT, fontSize: 9.5, color: '#64748b', flex: 1 },
  
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2.5 },
  statusPillDot: { width: 5, height: 5, borderRadius: 2.5 },
  statusPillText: { fontFamily: FONT, fontSize: 8, fontWeight: 'bold' },
  distBadge: { backgroundColor: '#ccfbf1', paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 6 },
  distBadgeText: { fontFamily: FONT, fontSize: 9.5, fontWeight: 'bold', color: GREEN_DARK },

  emptyWrap: { alignItems: 'center', paddingVertical: 20 },
  emptyText: { fontFamily: FONT, fontSize: 11, color: '#94a3b8', marginTop: 6 },

  // Modal Styles - UI/UX Pro Max Redesign
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.55)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '84%', minHeight: '50%', paddingBottom: 10 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  closeBtnPill: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },

  modalLiveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ecfdf5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  modalLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
  modalLiveText: { fontFamily: FONT, fontSize: 8.5, fontWeight: '800', color: '#047857' },

  modalStatsRow: { flexDirection: 'row', paddingTop: 14, gap: 12 },
  modalStatBoxPrimary: { flex: 1, backgroundColor: '#ecfdf5', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#a7f3d0' },
  modalStatBoxSecondary: { flex: 1, backgroundColor: '#f0f9ff', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#bae6fd' },
  statBoxHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  modalStatLabelPrimary: { fontFamily: FONT, color: '#047857', fontSize: 10.5, fontWeight: '800' },
  modalStatLabelSecondary: { fontFamily: FONT, color: '#0369a1', fontSize: 10.5, fontWeight: '800' },
  modalStatValuePrimary: { fontFamily: FONT, color: '#064e3b', fontSize: 18, fontWeight: '900', marginTop: 4 },
  modalStatValueSecondary: { fontFamily: FONT, color: '#0c4a6e', fontSize: 18, fontWeight: '900', marginTop: 4 },

  routeSummaryCard: { marginTop: 14, borderRadius: 18, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', padding: 16 },
  timelineHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  routeSummaryTitle: { fontFamily: FONT, fontSize: 13, fontWeight: '800', color: '#0f172a' },
  timelineCountBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  timelineCountText: { fontFamily: FONT, fontSize: 10, fontWeight: '700', color: '#475569' },

  timelineRow: { flexDirection: 'row' },
  timelineDotWrap: { width: 26, alignItems: 'center' },
  timelineLatestOuterDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#d1fae5', justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  timelineLatestInnerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' },
  timelineStartDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#0284c7', marginTop: 4 },
  timelineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#64748b', marginTop: 4 },
  timelineLine: { width: 2, flex: 1, backgroundColor: '#e2e8f0', marginVertical: 3 },

  timelineContent: { flex: 1, paddingBottom: 16, paddingLeft: 10 },
  timelineTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timelineTime: { fontFamily: FONT, fontSize: 11, fontWeight: '800', color: '#0f172a' },
  latestTag: { backgroundColor: '#dcfce7', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, marginLeft: 4 },
  latestTagText: { fontSize: 8.5, fontWeight: '800', color: '#15803d' },
  startTag: { backgroundColor: '#e0f2fe', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, marginLeft: 4 },
  startTagText: { fontSize: 8.5, fontWeight: '800', color: '#0369a1' },
  timelineAddress: { fontFamily: FONT, fontSize: 12, color: '#334155', fontWeight: '500', marginTop: 3, lineHeight: 17 },
  timelineCoordText: { color: '#64748b', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'sans-serif', fontSize: 11 },
});
