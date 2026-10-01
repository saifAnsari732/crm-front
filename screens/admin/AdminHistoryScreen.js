import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Platform, RefreshControl,
  ScrollView, StyleSheet, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Avatar, Surface, Text } from 'react-native-paper';
import { Calendar, RefreshCw, Route, Search, UserRound } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { adminAPI, getAvatarUrl } from '../../services/api';
import { useSettings } from '../../context/SettingsContext';

const FONT = Platform.OS === 'ios' ? 'System' : 'sans-serif-medium';
const getToday = () => new Date().toISOString().slice(0, 10);
const getEmployeeId = (employee) => employee?._id || employee?.employeeId || employee?.id || '';
const normalizeKm = (value) => { const p = parseFloat(value); return Number.isFinite(p) ? p : 0; };

export default function AdminHistoryScreen() {
  const router = useRouter();
  const { theme } = useSettings();
  const isDark = theme === 'dark';
  const C = {
    bg: isDark ? '#0f172a' : '#f8fafc',
    surface: isDark ? '#1e293b' : '#ffffff',
    soft: isDark ? '#172033' : '#eef4f8',
    text: isDark ? '#f8fafc' : '#0f172a',
    sub: isDark ? '#94a3b8' : '#64748b',
    border: isDark ? '#334155' : '#e2e8f0',
  };

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
      const name = employee.name || session.employeeName || session.employee?.name || 'Unknown';
      const department = employee.department || session.department || 'Staff';
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
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      {/* Filter panel */}
      <View style={[styles.filterPanel, { backgroundColor: C.surface, borderColor: C.border, flexDirection: 'column', gap: 10 }]}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={[styles.modeTab, { backgroundColor: filterMode === 'today' ? '#283b96' : C.bg, borderColor: C.border }]}
            onPress={() => { setFilterMode('today'); setSelectedDate(getToday()); }}
          >
            <Text style={{ fontSize: 11, fontWeight: 'bold', color: filterMode === 'today' ? '#fff' : C.sub }}>Today</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeTab, { backgroundColor: filterMode === 'single' ? '#283b96' : C.bg, borderColor: C.border }]}
            onPress={() => setFilterMode('single')}
          >
            <Text style={{ fontSize: 11, fontWeight: 'bold', color: filterMode === 'single' ? '#fff' : C.sub }}>Single Date</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeTab, { backgroundColor: filterMode === 'range' ? '#283b96' : C.bg, borderColor: C.border }]}
            onPress={() => setFilterMode('range')}
          >
            <Text style={{ fontSize: 11, fontWeight: 'bold', color: filterMode === 'range' ? '#fff' : C.sub }}>Date Range (From - To)</Text>
          </TouchableOpacity>
        </View>

        {filterMode === 'single' && (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <View style={[styles.inputBox, { borderColor: C.border, backgroundColor: C.bg, flex: 1 }]}>
              <Calendar size={14} color={C.sub} />
              <TextInput
                style={[styles.input, { color: C.text }]}
                value={selectedDate}
                onChangeText={setSelectedDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={C.sub}
                {...(Platform.OS === 'web' ? { type: 'date' } : {})}
              />
            </View>
            <TouchableOpacity style={styles.applyBtn} onPress={fetchHistory}>
              <RefreshCw size={14} color="#fff" />
              <Text style={styles.applyText}>Filter</Text>
            </TouchableOpacity>
          </View>
        )}

        {filterMode === 'range' && (
          <View style={{ flexDirection: 'column', gap: 8 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={[styles.inputBox, { borderColor: C.border, backgroundColor: C.bg, flex: 1 }]}>
                <Text style={{ fontSize: 10, color: C.sub, fontWeight: 'bold', marginRight: 4 }}>From:</Text>
                <TextInput
                  style={[styles.input, { color: C.text }]}
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="From Date"
                  placeholderTextColor={C.sub}
                  {...(Platform.OS === 'web' ? { type: 'date' } : {})}
                />
              </View>
              <View style={[styles.inputBox, { borderColor: C.border, backgroundColor: C.bg, flex: 1 }]}>
                <Text style={{ fontSize: 10, color: C.sub, fontWeight: 'bold', marginRight: 4 }}>To:</Text>
                <TextInput
                  style={[styles.input, { color: C.text }]}
                  value={endDate}
                  onChangeText={setEndDate}
                  placeholder="To Date"
                  placeholderTextColor={C.sub}
                  {...(Platform.OS === 'web' ? { type: 'date' } : {})}
                />
              </View>
            </View>
            <TouchableOpacity style={[styles.applyBtn, { width: '100%', justifyContent: 'center' }]} onPress={fetchHistory}>
              <RefreshCw size={14} color="#fff" />
              <Text style={styles.applyText}>Apply Range Filter</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={[styles.searchBox, { borderColor: C.border, backgroundColor: C.surface }]}>
        <Search size={14} color={C.sub} />
        <TextInput style={[styles.input, { color: C.text }]} value={search} onChangeText={setSearch} placeholder="Search employee..." placeholderTextColor={C.sub} />
      </View>

      {/* Employee chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.employeeScroller}>
        <View style={styles.employeeChipRow}>
          <TouchableOpacity style={[styles.employeeChip, { borderColor: selectedEmployeeId === 'ALL' ? '#283b96' : C.border, backgroundColor: selectedEmployeeId === 'ALL' ? '#283b96' : C.surface }]} onPress={() => setSelectedEmployeeId('ALL')}>
            <Text style={[styles.employeeChipText, { color: selectedEmployeeId === 'ALL' ? '#fff' : C.sub }]}>ALL</Text>
          </TouchableOpacity>
          {employees.slice(0, 15).map((emp) => {
            const id = getEmployeeId(emp);
            const active = String(id) === String(selectedEmployeeId);
            return (
              <TouchableOpacity key={String(id)} style={[styles.employeeChip, { borderColor: active ? '#283b96' : C.border, backgroundColor: active ? '#283b96' : C.surface }]} onPress={() => setSelectedEmployeeId(String(id))}>
                <Text style={[styles.employeeChipText, { color: active ? '#fff' : C.sub }]}>{(emp.name || 'Employee').split(' ')[0]}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Summary */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[styles.summaryValue, { color: '#008080' }]}>{totalKmSum.toFixed(2)} km</Text>
          <Text style={[styles.summaryLabel, { color: C.sub }]}>TOTAL KM</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[styles.summaryValue, { color: '#283b96' }]}>{activeEmpCount}</Text>
          <Text style={[styles.summaryLabel, { color: C.sub }]}>EMPLOYEES</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[styles.summaryValue, { color: '#16a34a' }]}>{rows.reduce((s, r) => s + r.sessions, 0)}</Text>
          <Text style={[styles.summaryLabel, { color: C.sub }]}>SESSIONS</Text>
        </View>
      </View>
{loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#283b96" />
          <Text style={[styles.emptyText, { color: C.sub }]}>Loading history…</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={rows.length === 0 ? styles.emptyBody : styles.listBody}
          ListEmptyComponent={
            <View style={styles.center}>
              <Route size={40} color={C.sub} />
              <Text style={[styles.emptyText, { color: C.sub }]}>No history found for {selectedDate}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity activeOpacity={0.85} onPress={() => router.push({ pathname: '/(admin)/tracking', params: { employeeId: item.id, sessionId: item.sessionIds[0] || '' } })}>
            <Surface style={[styles.rowCard, { backgroundColor: C.surface, borderColor: C.border }]} elevation={1}>
              <View style={styles.rowTop}>
                {item.avatar ? (
                  <Avatar.Image size={42} source={{ uri: getAvatarUrl(item.avatar) }} />
                ) : (
                  <Avatar.Text size={42} label={(item.name || 'E').slice(0, 2).toUpperCase()} style={{ backgroundColor: '#283b96' }} labelStyle={{ color: '#fff' }} />
                )}
                <View style={styles.rowInfo}>
                  <Text style={[styles.employeeName, { color: C.text }]}>{item.name}</Text>
                  <Text style={[styles.employeeMeta, { color: C.sub }]}>{item.department} | {item.sessions} session{item.sessions === 1 ? '' : 's'}</Text>
                </View>
                <View style={styles.kmBox}>
                  <Text style={styles.kmValue}>{item.totalKm.toFixed(2)}</Text>
                  <Text style={styles.kmLabel}>km</Text>
                </View>
              </View>
              <View style={[styles.timeRow, { borderTopColor: C.border }]}>
                <Text style={[styles.timeText, { color: C.sub }]}>Start: {formatTime(item.firstStart)}</Text>
                <Text style={[styles.timeText, { color: C.sub }]}>End: {formatTime(item.lastEnd)}</Text>
              </View>
            </Surface>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: Platform.OS === 'ios' ? 54 : 22, paddingBottom: 12, borderBottomWidth: 1 },
  headerText: { flex: 1, marginLeft: 12 },
  eyebrow: { fontFamily: FONT, fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },
  title: { fontFamily: FONT, fontSize: 18, fontWeight: 'bold', marginTop: 2 },
  filterPanel: { marginHorizontal: 12, marginTop: 12, borderWidth: 1, borderRadius: 12, padding: 10, gap: 8, flexDirection: 'row', alignItems: 'center' },
  inputBox: { flex: 1, height: 40, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, fontFamily: FONT, fontSize: 13, paddingVertical: 0 },
  applyBtn: { height: 40, borderRadius: 10, backgroundColor: '#008080', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 },
  applyText: { fontFamily: FONT, color: '#fff', fontSize: 12, fontWeight: 'bold' },
  searchBox: { marginHorizontal: 12, marginTop: 8, height: 40, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  employeeScroller: { minHeight: 42, marginTop: 8 },
  employeeChipRow: { paddingHorizontal: 12, gap: 8, flexDirection: 'row' },
  employeeChip: { height: 34, maxWidth: 150, borderRadius: 17, borderWidth: 1, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  employeeChipText: { fontFamily: FONT, fontSize: 11, fontWeight: 'bold' },
  summaryRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 10 },
  summaryCard: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 10, alignItems: 'center' },
  summaryValue: { fontFamily: FONT, fontSize: 14, fontWeight: 'bold', marginTop: 2 },
  summaryLabel: { fontFamily: FONT, fontSize: 9, fontWeight: '700', marginTop: 2, textAlign: 'center' },
  listBody: { padding: 12, paddingBottom: 28 },
  emptyBody: { padding: 12 },
  center: { justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { fontFamily: FONT, fontSize: 12, marginTop: 10, textAlign: 'center' },
  rowCard: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10 },
  rowTop: { flexDirection: 'row', alignItems: 'center' },
  rowInfo: { flex: 1, marginLeft: 10 },
  employeeName: { fontFamily: FONT, fontSize: 14, fontWeight: 'bold' },
  employeeMeta: { fontFamily: FONT, fontSize: 11, marginTop: 2 },
  kmBox: { minWidth: 72, alignItems: 'flex-end' },
  kmValue: { fontFamily: FONT, fontSize: 18, fontWeight: 'bold', color: '#008080' },
  kmLabel: { fontFamily: FONT, fontSize: 10, color: '#64748b', fontWeight: 'bold' },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1 },
  timeText: { fontFamily: FONT, fontSize: 11, fontWeight: '600' },
});