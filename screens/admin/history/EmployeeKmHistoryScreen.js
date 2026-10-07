import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  StatusBar,
} from 'react-native';
import { Avatar, Surface, Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Calendar, RefreshCw, Route, Search, UserRound } from 'lucide-react-native';

import { adminAPI, getAvatarUrl } from '../../../services/api';
import { useSettings } from '../../../context/SettingsContext';

const FONT = Platform.OS === 'web' ? 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' : Platform.OS === 'ios' ? 'System' : 'sans-serif-medium';

const getToday = () => new Date().toISOString().slice(0, 10);

const getEmployeeId = (employee) => employee?._id || employee?.employeeId || employee?.id || '';

const normalizeKm = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function EmployeeKmHistoryScreen() {
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
  const [search, setSearch] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await adminAPI.getEmployees({ limit: 200, role: 'all' });
      if (res.data?.success) {
        setEmployees(res.data.employees || []);
      }
    } catch (e) {
      setEmployees([]);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await adminAPI.getHistory({
        date: selectedDate || undefined,
        employeeId: selectedEmployeeId !== 'ALL' ? selectedEmployeeId : undefined,
      });

      if (res.data?.success) {
        setHistory(res.data.history || []);
      } else {
        setHistory([]);
      }
    } catch (e) {
      setHistory([]);
    }
  }, [selectedDate, selectedEmployeeId]);

  const loadData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchEmployees(), fetchHistory()]);
    setLoading(false);
  }, [fetchEmployees, fetchHistory]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchEmployees(), fetchHistory()]);
    setRefreshing(false);
  };

  const employeeMap = useMemo(() => {
    return employees.reduce((acc, emp) => {
      const id = getEmployeeId(emp);
      if (id) acc[String(id)] = emp;
      return acc;
    }, {});
  }, [employees]);

  const rows = useMemo(() => {
    const grouped = new Map();

    history.forEach((session) => {
      const employee = session.employee || employeeMap[String(session.employeeId)] || {};
      const id = String(getEmployeeId(employee) || session.employeeId || session._id);
      const name = employee.name || session.employeeName || 'Field Staff';
      const avatar = employee.avatar;
      const km = normalizeKm(session.totalDistance || session.totalKm || session.distance);

      if (!grouped.has(id)) {
        grouped.set(id, {
          id,
          name,
          avatar,
          department: employee.department || 'Field Services',
          totalKm: 0,
          sessions: 0,
          firstStart: session.startTime || session.createdAt,
          lastEnd: session.endTime || session.updatedAt,
        });
      }

      const row = grouped.get(id);
      row.totalKm += km;
      row.sessions += 1;
      row.lastEnd = session.endTime || session.updatedAt || row.lastEnd;
    });

    return Array.from(grouped.values())
      .filter((row) => row.name.toLowerCase().includes(search.trim().toLowerCase()))
      .sort((a, b) => b.totalKm - a.totalKm);
  }, [employeeMap, history, search]);

  const totalKm = rows.reduce((sum, row) => sum + row.totalKm, 0);
  const totalSessions = rows.reduce((sum, row) => sum + row.sessions, 0);

  const formatTime = (value) => {
    if (!value) return '--';
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderEmployeeChip = (emp) => {
    const id = String(getEmployeeId(emp));
    const active = selectedEmployeeId === id;

    return (
      <TouchableOpacity
        key={id}
        style={[styles.employeeChip, { backgroundColor: active ? '#008080' : C.surface, borderColor: active ? '#008080' : C.border }]}
        onPress={() => setSelectedEmployeeId(id)}
      >
        <Text style={[styles.employeeChipText, { color: active ? '#fff' : C.text }]} numberOfLines={1}>
          {emp.name || 'Staff'}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      <StatusBar barStyle="light-content" backgroundColor="#047857" />

      {/* ── HEADER ── */}
      <LinearGradient
        colors={['#047857', '#0d9488', '#0f766e']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.headerInner}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()} activeOpacity={0.7}>
              <ArrowLeft size={20} color="#fff" />
            </TouchableOpacity>

            <View style={styles.headerText}>
              <Text style={styles.eyebrow}>ADMIN AUDIT HISTORY</Text>
              <Text style={styles.title}>Employee KM History</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <View style={[styles.filterPanel, { backgroundColor: C.surface, borderColor: C.border }]}>
        <View style={[styles.inputBox, { backgroundColor: C.bg, borderColor: C.border }]}>
          <Calendar size={16} color={C.sub} />
          <TextInput
            value={selectedDate}
            onChangeText={setSelectedDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={C.sub}
            style={[styles.input, { color: C.text }]}
          />
        </View>

        <TouchableOpacity style={styles.applyBtn} onPress={fetchHistory}>
          <RefreshCw size={16} color="#fff" />
          <Text style={styles.applyText}>Apply</Text>
        </TouchableOpacity>

        <View style={[styles.searchBox, { backgroundColor: C.bg, borderColor: C.border }]}>
          <Search size={16} color={C.sub} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search employee..."
            placeholderTextColor={C.sub}
            style={[styles.input, { color: C.text }]}
          />
        </View>
      </View>

      <View style={styles.employeeScroller}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.employeeChipRow}>
          <TouchableOpacity
            style={[styles.employeeChip, { backgroundColor: selectedEmployeeId === 'ALL' ? '#008080' : C.surface, borderColor: selectedEmployeeId === 'ALL' ? '#008080' : C.border }]}
            onPress={() => setSelectedEmployeeId('ALL')}
          >
            <Text style={[styles.employeeChipText, { color: selectedEmployeeId === 'ALL' ? '#fff' : C.text }]}>All Staff</Text>
          </TouchableOpacity>
          {employees.map(renderEmployeeChip)}
        </ScrollView>
      </View>

      <View style={styles.summaryRow}>
        <Surface style={[styles.summaryCard, { backgroundColor: C.surface, borderColor: C.border }]} elevation={1}>
          <Route size={18} color="#008080" />
          <Text style={[styles.summaryValue, { color: C.text }]}>{totalKm.toFixed(2)} km</Text>
          <Text style={[styles.summaryLabel, { color: C.sub }]}>Total Distance</Text>
        </Surface>

        <Surface style={[styles.summaryCard, { backgroundColor: C.surface, borderColor: C.border }]} elevation={1}>
          <UserRound size={18} color="#283b96" />
          <Text style={[styles.summaryValue, { color: C.text }]}>{rows.length}</Text>
          <Text style={[styles.summaryLabel, { color: C.sub }]}>Employees</Text>
        </Surface>

        <Surface style={[styles.summaryCard, { backgroundColor: C.surface, borderColor: C.border }]} elevation={1}>
          <Calendar size={18} color="#ea580c" />
          <Text style={[styles.summaryValue, { color: C.text }]}>{totalSessions}</Text>
          <Text style={[styles.summaryLabel, { color: C.sub }]}>Sessions</Text>
        </Surface>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#008080" size="large" />
          <Text style={[styles.emptyText, { color: C.sub }]}>Loading employee KM history...</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={rows.length ? styles.listBody : styles.emptyBody}
          ListEmptyComponent={
            <View style={styles.center}>
              <Route size={42} color={C.sub} />
              <Text style={[styles.emptyText, { color: C.sub }]}>No KM history found for {selectedDate}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Surface style={[styles.rowCard, { backgroundColor: C.surface, borderColor: C.border }]} elevation={1}>
              <View style={styles.rowTop}>
                {getAvatarUrl(item.avatar) ? (
                  <Avatar.Image size={42} source={{ uri: getAvatarUrl(item.avatar) }} />
                ) : (
                  <Avatar.Text size={42} label={(item.name || 'E').slice(0, 2).toUpperCase()} style={{ backgroundColor: '#283b96' }} labelStyle={{ color: '#fff' }} />
                )}

                <View style={styles.rowInfo}>
                  <Text style={[styles.employeeName, { color: C.text }]} numberOfLines={1}>{item.name}</Text>
                  <Text style={[styles.employeeMeta, { color: C.sub }]} numberOfLines={1}>
                    {item.department} | {item.sessions} session{item.sessions === 1 ? '' : 's'}
                  </Text>
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
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: Platform.OS === 'android' ? 10 : 0,
    borderCurve: 'round',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 4,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, marginLeft: 12 },
  eyebrow: { fontFamily: FONT, fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5, color: '#a7f3d0' },
  title: { fontFamily: FONT, fontSize: 17, fontWeight: '800', marginTop: 1, color: '#ffffff' },
  filterPanel: { margin: 12, borderWidth: 1, borderRadius: 12, padding: 10, gap: 8 },
  inputBox: { height: 40, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchBox: { height: 40, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, fontFamily: FONT, fontSize: 13, paddingVertical: 0 },
  applyBtn: { height: 40, borderRadius: 10, backgroundColor: '#008080', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  applyText: { fontFamily: FONT, color: '#fff', fontSize: 13, fontWeight: 'bold' },
  employeeScroller: { minHeight: 42 },
  employeeChipRow: { paddingHorizontal: 12, gap: 8 },
  employeeChip: { height: 34, maxWidth: 150, borderRadius: 17, borderWidth: 1, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  employeeChipText: { fontFamily: FONT, fontSize: 11, fontWeight: 'bold' },
  summaryRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 10 },
  summaryCard: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 10, alignItems: 'center' },
  summaryValue: { fontFamily: FONT, fontSize: 14, fontWeight: 'bold', marginTop: 6 },
  summaryLabel: { fontFamily: FONT, fontSize: 9, fontWeight: '700', marginTop: 2, textAlign: 'center' },
  listBody: { padding: 12, paddingBottom: 28 },
  emptyBody: { flexGrow: 1, padding: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
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
