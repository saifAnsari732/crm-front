import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Platform, RefreshControl,
  ScrollView, StyleSheet, TextInput, TouchableOpacity, View, StatusBar, Image, Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Surface, Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Calendar, RefreshCw, Route, Search, Users, Clock, Navigation, ChevronRight, Filter } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { adminAPI, getAvatarUrl } from '../../services/api';

const FONT = Platform.OS === 'ios' ? 'System' : 'sans-serif-medium';
const { width, height } = Dimensions.get('window');
const getToday = () => new Date().toISOString().slice(0, 10);
const getEmployeeId = (employee) => employee?._id || employee?.employeeId || employee?.id || '';
const normalizeKm = (value) => { const p = parseFloat(value); return Number.isFinite(p) ? p : 0; };

const formatFullName = (str) => {
  if (!str) return 'Field Executive';
  return String(str)
    .trim()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
};

const cardShadow = Platform.OS === 'web'
  ? { boxShadow: '0px 4px 14px rgba(15, 23, 42, 0.06)' }
  : { elevation: 3, shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } };

export default function AdminHistoryScreen() {
  const router = useRouter();

  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('ALL');
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [filterMode, setFilterMode] = useState('today'); // 'today', 'single', 'range'
  const [startDate, setStartDate] = useState(getToday());
  const [endDate, setEndDate] = useState(getToday());
  const [search, setSearch] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await adminAPI.getEmployees({ limit: 200, role: 'all' });
      if (res.data?.success) setEmployees(res.data.employees || []);
    } catch (e) { setEmployees([]); }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const params = {
        employeeId: selectedEmployeeId !== 'ALL' ? selectedEmployeeId : undefined,
      };
      if (filterMode === 'range' && startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
      } else if (filterMode === 'today') {
        params.date = getToday();
      } else {
        params.date = selectedDate || undefined;
      }

      const res = await adminAPI.getHistory(params);
      if (res.data?.success) setHistory(res.data.history || []);
      else setHistory([]);
    } catch (e) { setHistory([]); }
  }, [selectedDate, startDate, endDate, filterMode, selectedEmployeeId]);

  const loadData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchEmployees(), fetchHistory()]);
    setLoading(false);
  }, [fetchEmployees, fetchHistory]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchEmployees(), fetchHistory()]);
    setRefreshing(false);
  };

  const employeeMap = useMemo(() => employees.reduce((acc, emp) => {
    const id = getEmployeeId(emp);
    if (id) acc[String(id)] = emp;
    return acc;
  }, {}), [employees]);

  const rows = useMemo(() => {
    const grouped = new Map();
    history.forEach((session) => {
      const employee = session.employee || employeeMap[String(session.employeeId)] || {};
      const id = String(getEmployeeId(employee) || session.employeeId || session._id || 'unknown');
      const rawName = employee.name || session.employeeName || session.employee?.name || 'Unknown Staff';
      const name = formatFullName(rawName);
      const department = employee.department || session.department || 'Field Services';
      const avatar = employee.avatar || session.avatar;

      if (!grouped.has(id)) {
        grouped.set(id, {
          id, name, department, avatar,
          totalKm: 0, sessions: 0, sessionIds: [], firstStart: null, lastEnd: null,
        });
      }
      const row = grouped.get(id);
      row.totalKm += normalizeKm(session.totalDistance) + normalizeKm(session.totalKm);
      row.sessions += 1;
      if (session.sessionId || session._id) row.sessionIds.push(session.sessionId || session._id);
      if (!row.firstStart || session.startTime < row.firstStart) row.firstStart = session.startTime;
      if (!row.lastEnd || session.endTime > row.lastEnd) row.lastEnd = session.endTime;
    });
    return Array.from(grouped.values())
      .filter((r) => r.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => b.totalKm - a.totalKm);
  }, [history, employeeMap, search]);

  const totalKmSum = rows.reduce((sum, r) => sum + r.totalKm, 0);
  const activeEmpCount = rows.filter((r) => r.sessions > 0).length;
  const formatTime = (t) => t ? new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#074e26" />

      {/* EXECUTIVE TOP HEADER */}
      <LinearGradient colors={['#074e26', '#065a29']} style={styles.headerGradient}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerNavRow}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(admin)/dashboard'))}
              activeOpacity={0.8}
            >
              <ArrowLeft size={20} color="#ffffff" />
            </TouchableOpacity>

            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.headerTitle}>Attendance & Mileage History</Text>
              <Text style={styles.headerSub}>Authoritative Workday Tracking Records</Text>
            </View>

            <TouchableOpacity style={styles.refreshCircleBtn} onPress={onRefresh} disabled={refreshing}>
              <RefreshCw size={17} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* BODY SCROLL CONTENT */}
      <ScrollView
        style={styles.bodyScroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#10b981']} />}
      >
        {/* SUMMARY KPI CARDS */}
        <View style={styles.kpiRow}>
          <Surface style={[styles.kpiCard, cardShadow, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]} elevation={1}>
            <Text style={[styles.kpiVal, { color: '#059669' }]}>{totalKmSum.toFixed(2)}</Text>
            <Text style={[styles.kpiUnit, { color: '#059669' }]}>TOTAL KM</Text>
          </Surface>

          <Surface style={[styles.kpiCard, cardShadow, { backgroundColor: '#e0f2fe', borderColor: '#bae6fd' }]} elevation={1}>
            <Text style={[styles.kpiVal, { color: '#0284c7' }]}>{activeEmpCount}</Text>
            <Text style={[styles.kpiUnit, { color: '#0284c7' }]}>STAFF</Text>
          </Surface>

          <Surface style={[styles.kpiCard, cardShadow, { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]} elevation={1}>
            <Text style={[styles.kpiVal, { color: '#d97706' }]}>{rows.reduce((s, r) => s + r.sessions, 0)}</Text>
            <Text style={[styles.kpiUnit, { color: '#d97706' }]}>SESSIONS</Text>
          </Surface>
        </View>

        {/* FILTER & SEARCH CARD */}
        <Surface style={[styles.filterCard, cardShadow]} elevation={1}>
          <View style={styles.modeTabsRow}>
            <TouchableOpacity
              style={[styles.modePill, filterMode === 'today' && styles.modePillActive]}
              onPress={() => { setFilterMode('today'); setSelectedDate(getToday()); }}
            >
              <Text style={[styles.modePillText, filterMode === 'today' && styles.modePillTextActive]}>Today</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modePill, filterMode === 'single' && styles.modePillActive]}
              onPress={() => setFilterMode('single')}
            >
              <Text style={[styles.modePillText, filterMode === 'single' && styles.modePillTextActive]}>Single Date</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modePill, filterMode === 'range' && styles.modePillActive]}
              onPress={() => setFilterMode('range')}
            >
              <Text style={[styles.modePillText, filterMode === 'range' && styles.modePillTextActive]}>Date Range</Text>
            </TouchableOpacity>
          </View>

          {filterMode === 'single' && (
            <View style={styles.dateInputRow}>
              <View style={styles.inputBox}>
                <Calendar size={16} color="#64748b" />
                <TextInput
                  style={styles.textInput}
                  value={selectedDate}
                  onChangeText={setSelectedDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#94a3b8"
                  {...(Platform.OS === 'web' ? { type: 'date' } : {})}
                />
              </View>
              <TouchableOpacity style={styles.applyBtn} onPress={fetchHistory}>
                <Filter size={15} color="#fff" />
                <Text style={styles.applyBtnText}>Apply</Text>
              </TouchableOpacity>
            </View>
          )}

          {filterMode === 'range' && (
            <View style={styles.rangeInputGroup}>
              <View style={styles.dateInputRow}>
                <View style={styles.inputBox}>
                  <Text style={styles.rangeLabel}>From:</Text>
                  <TextInput
                    style={styles.textInput}
                    value={startDate}
                    onChangeText={setStartDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94a3b8"
                    {...(Platform.OS === 'web' ? { type: 'date' } : {})}
                  />
                </View>
                <View style={styles.inputBox}>
                  <Text style={styles.rangeLabel}>To:</Text>
                  <TextInput
                    style={styles.textInput}
                    value={endDate}
                    onChangeText={setEndDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94a3b8"
                    {...(Platform.OS === 'web' ? { type: 'date' } : {})}
                  />
                </View>
              </View>
              <TouchableOpacity style={styles.applyBtnFull} onPress={fetchHistory}>
                <Filter size={15} color="#fff" />
                <Text style={styles.applyBtnText}>Apply Date Range</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.searchBar}>
            <Search size={16} color="#64748b" />
            <TextInput
              style={styles.searchInputText}
              value={search}
              onChangeText={setSearch}
              placeholder="Search staff by full name..."
              placeholderTextColor="#94a3b8"
            />
          </View>

          {/* Employee Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroller}>
            <View style={styles.chipRow}>
              <TouchableOpacity
                style={[styles.empChip, selectedEmployeeId === 'ALL' && styles.empChipActive]}
                onPress={() => setSelectedEmployeeId('ALL')}
              >
                <Text style={[styles.empChipText, selectedEmployeeId === 'ALL' && styles.empChipTextActive]}>All Staff</Text>
              </TouchableOpacity>
              {employees.map((emp) => {
                const id = getEmployeeId(emp);
                const active = String(id) === String(selectedEmployeeId);
                const fullName = formatFullName(emp.name);
                return (
                  <TouchableOpacity
                    key={String(id)}
                    style={[styles.empChip, active && styles.empChipActive]}
                    onPress={() => setSelectedEmployeeId(String(id))}
                  >
                    <Text style={[styles.empChipText, active && styles.empChipTextActive]} numberOfLines={1}>
                      {fullName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </Surface>

        {/* ROSTER LIST OF HISTORY RECORDS */}
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#059669" />
            <Text style={styles.loadingMsg}>Fetching Mileage History Records…</Text>
          </View>
        ) : rows.length === 0 ? (
          <Surface style={[styles.emptyCard, cardShadow]} elevation={1}>
            <Route size={36} color="#94a3b8" />
            <Text style={styles.emptyTitle}>No Tracking History Found</Text>
            <Text style={styles.emptySub}>No attendance or distance records match your selected filter.</Text>
          </Surface>
        ) : (
          rows.map((item) => (
            <TouchableOpacity
              key={String(item.id)}
              activeOpacity={0.85}
              onPress={() => router.push({ pathname: '/(admin)/tracking', params: { employeeId: item.id, sessionId: item.sessionIds[0] || '' } })}
            >
              <Surface style={[styles.historyRowCard, cardShadow]} elevation={1}>
                <View style={styles.cardMainRow}>
                  <View style={styles.avatarWrap}>
                    {getAvatarUrl(item.avatar) ? (
                      <Avatar.Image size={44} source={{ uri: getAvatarUrl(item.avatar) }} />
                    ) : (
                      <Avatar.Text
                        size={44}
                        label={(item.name || 'E').slice(0, 2).toUpperCase()}
                        style={{ backgroundColor: '#059669' }}
                        labelStyle={{ color: '#fff', fontSize: 15, fontWeight: '800' }}
                      />
                    )}
                  </View>

                  <View style={styles.infoCol}>
                    <Text style={styles.fullNameText}>{item.name}</Text>
                    <Text style={styles.deptText}>{item.department} • {item.sessions} session{item.sessions === 1 ? '' : 's'}</Text>
                  </View>

                  <View style={styles.kmBadgeBox}>
                    <Text style={styles.kmValText}>{item.totalKm.toFixed(2)}</Text>
                    <Text style={styles.kmUnitText}>KM</Text>
                  </View>
                </View>

                <View style={styles.cardFooterRow}>
                  <View style={styles.timePill}>
                    <Clock size={12} color="#64748b" />
                    <Text style={styles.timePillText}>Start: {formatTime(item.firstStart)}</Text>
                  </View>
                  <View style={styles.timePill}>
                    <Clock size={12} color="#64748b" />
                    <Text style={styles.timePillText}>End: {formatTime(item.lastEnd)}</Text>
                  </View>
                  <View style={styles.viewRouteBtn}>
                    <Text style={styles.viewRouteText}>View Map</Text>
                    <ChevronRight size={13} color="#0284c7" />
                  </View>
                </View>
              </Surface>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  headerGradient: { paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 12) : 0, paddingBottom: 12 },
  headerNavRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 4 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center' },
  refreshCircleBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#ffffff', fontSize: 17, fontWeight: '800', letterSpacing: 0.2 },
  headerSub: { color: '#a7f3d0', fontSize: 10, fontWeight: '600', marginTop: 1 },

  bodyScroll: { flex: 1 },
  scrollContent: { padding: 14, paddingBottom: 40 },

  kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  kpiCard: { flex: 1, borderRadius: 16, padding: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  kpiVal: { fontSize: 18, fontWeight: '900', fontFamily: FONT },
  kpiUnit: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5, marginTop: 2 },

  filterCard: { backgroundColor: '#ffffff', borderRadius: 20, padding: 14, marginBottom: 14 },
  modeTabsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  modePill: { flex: 1, height: 34, borderRadius: 10, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  modePillActive: { backgroundColor: '#074e26', borderColor: '#074e26' },
  modePillText: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  modePillTextActive: { color: '#ffffff' },

  dateInputRow: { flexDirection: 'row', gap: 8, marginBottom: 10, alignItems: 'center' },
  rangeInputGroup: { gap: 8, marginBottom: 10 },
  inputBox: { flex: 1, height: 38, borderRadius: 10, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  rangeLabel: { fontSize: 10, fontWeight: '800', color: '#64748b' },
  textInput: { flex: 1, fontSize: 12, color: '#0f172a', fontFamily: FONT, paddingVertical: 0 },
  applyBtn: { height: 38, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#059669', flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  applyBtnFull: { height: 38, width: '100%', borderRadius: 10, backgroundColor: '#059669', flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  applyBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '800' },

  searchBar: { height: 38, borderRadius: 12, backgroundColor: '#f1f5f9', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  searchInputText: { flex: 1, fontSize: 12, color: '#0f172a', fontFamily: FONT, paddingVertical: 0 },

  chipScroller: { flexGrow: 0 },
  chipRow: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  empChip: { height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center' },
  empChipActive: { backgroundColor: '#059669', borderColor: '#059669' },
  empChipText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  empChipTextActive: { color: '#ffffff' },

  loadingBox: { padding: 40, alignItems: 'center', justifyContent: 'center' },
  loadingMsg: { fontSize: 13, color: '#64748b', fontWeight: '600', marginTop: 12 },

  emptyCard: { backgroundColor: '#ffffff', borderRadius: 20, padding: 32, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a', marginTop: 12 },
  emptySub: { fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 4 },

  historyRowCard: { backgroundColor: '#ffffff', borderRadius: 18, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#f1f5f9' },
  cardMainRow: { flexDirection: 'row', alignItems: 'center' },
  avatarWrap: { position: 'relative' },
  infoCol: { flex: 1, marginLeft: 12 },
  fullNameText: { fontSize: 15, fontWeight: '800', color: '#0f172a', letterSpacing: 0.2 },
  deptText: { fontSize: 11, color: '#64748b', fontWeight: '500', marginTop: 2 },
  kmBadgeBox: { backgroundColor: '#ecfdf5', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#a7f3d0', alignItems: 'center', minWidth: 68 },
  kmValText: { fontSize: 16, fontWeight: '900', color: '#059669' },
  kmUnitText: { fontSize: 9, fontWeight: '800', color: '#059669' },

  cardFooterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  timePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f8fafc', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  timePillText: { fontSize: 11, color: '#475569', fontWeight: '600' },
  viewRouteBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewRouteText: { fontSize: 11, fontWeight: '800', color: '#0284c7' },
});