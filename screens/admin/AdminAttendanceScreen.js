import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, Platform, RefreshControl,
  StyleSheet, TextInput, TouchableOpacity, View, Image,
} from 'react-native';
import { CalendarDays, CheckCircle2, Clock3, Search, UserX, X, ArrowLeft, RefreshCw, Calendar, Clock } from 'lucide-react-native';
import { Avatar, Surface, Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { adminAPI, getAvatarUrl } from '../../services/api';
import { useSettings } from '../../context/SettingsContext';

const FONT = Platform.OS === 'ios' ? 'System' : 'sans-serif-medium';
const getToday = () => new Date().toISOString().slice(0, 10);
const getYesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
};
const formatDate = (value) => value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const formatTime = (value) => value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

export default function AdminAttendanceScreen() {
  const router = useRouter();
  const { theme } = useSettings();
  const isDark = theme === 'dark';
  const C = {
    bg: isDark ? '#0f172a' : '#f8fafc',
    surface: isDark ? '#1e293b' : '#ffffff',
    text: isDark ? '#f8fafc' : '#0f172a',
    sub: isDark ? '#94a3b8' : '#64748b',
    border: isDark ? '#334155' : '#e2e8f0',
    primary: '#2563eb',
  };
  const [date, setDate] = useState(getToday());
  const [search, setSearch] = useState('');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selfieUrl, setSelfieUrl] = useState(null);

  const fetchAttendance = useCallback(async () => {
    try {
      const response = await adminAPI.getAttendance({ date });
      setRecords(response.data?.success ? response.data.records || [] : []);
    } catch (error) {
      console.log('Admin attendance fetch error:', error.message);
      setRecords([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [date]);

  useEffect(() => { fetchAttendance(); }, [fetchAttendance]);

  const filteredRecords = records.filter((record) => (record.employee?.name || '').toLowerCase().includes(search.toLowerCase()));
  const presentCount = records.filter((record) => record.status === 'present').length;
  const absentCount = Math.max(0, records.length - presentCount);

  const todayStr = getToday();
  const yesterdayStr = getYesterday();

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: C.bg, marginTop: 30 }]}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={[styles.loading, { color: C.sub }]}>Loading attendance...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: C.bg, marginTop: 30 }]}>
      {/* Top Header Bar with Back Navigation & Title */}
      <View style={[styles.topHeader, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(admin)/dashboard');
          }}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={C.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[styles.topTitle, { color: C.text }]}>Attendance Console</Text>
          <Text style={[styles.topSub, { color: C.sub }]}>Daily Staff Logs & Punch-ins</Text>
        </View>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={async () => { setRefreshing(true); await fetchAttendance(); }}
          activeOpacity={0.7}
        >
          <RefreshCw size={18} color={C.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredRecords}
        keyExtractor={(item, index) => String(item._id || index)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await fetchAttendance(); }} tintColor="#2563eb" />}
        contentContainerStyle={styles.content}
        ListHeaderComponent={(
          <View>
            {/* Quick Date Presets Row (Today, Yesterday) */}
            <View style={styles.presetsRow}>
              <TouchableOpacity
                style={[
                  styles.presetChip,
                  { backgroundColor: C.surface, borderColor: C.border },
                  date === todayStr && styles.presetChipActive,
                ]}
                onPress={() => setDate(todayStr)}
                activeOpacity={0.75}
              >
                <Calendar size={14} color={date === todayStr ? '#fff' : C.primary} />
                <Text style={[styles.presetText, { color: C.text }, date === todayStr && styles.presetTextActive]}>
                  Today
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.presetChip,
                  { backgroundColor: C.surface, borderColor: C.border },
                  date === yesterdayStr && styles.presetChipActive,
                ]}
                onPress={() => setDate(yesterdayStr)}
                activeOpacity={0.75}
              >
                <Clock size={14} color={date === yesterdayStr ? '#fff' : C.sub} />
                <Text style={[styles.presetText, { color: C.text }, date === yesterdayStr && styles.presetTextActive]}>
                  Yesterday
                </Text>
              </TouchableOpacity>
            </View>

            {/* Date Input Box & Search */}
            <View style={[styles.filterCard, { backgroundColor: C.surface, borderColor: C.border }]}>
              <View style={[styles.dateBox, { backgroundColor: C.bg, borderColor: C.border }]}>
                <CalendarDays size={15} color={C.sub} />
                <TextInput
                  style={[styles.dateInput, { color: C.text }]}
                  value={date}
                  onChangeText={setDate}
                  placeholder="Choose date"
                  placeholderTextColor={C.sub}
                  {...(Platform.OS === 'web' ? { type: 'date' } : {})}
                />
              </View>
              <TouchableOpacity style={styles.applyButton} onPress={fetchAttendance}>
                <Text style={styles.applyText}>Apply</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.searchBox, { backgroundColor: C.surface, borderColor: C.border }]}>
              <Search size={15} color={C.sub} />
              <TextInput
                style={[styles.searchInput, { color: C.text }]}
                value={search}
                onChangeText={setSearch}
                placeholder="Search employee..."
                placeholderTextColor={C.sub}
              />
            </View>

            <View style={styles.summaryRow}>
              <Summary icon={CheckCircle2} label="PRESENT" value={presentCount} color="#16a34a" />
              <Summary icon={UserX} label="OTHER" value={absentCount} color="#dc2626" />
              <Summary icon={Clock3} label="TOTAL" value={records.length} color="#2563eb" />
            </View>
            <Text style={[styles.results, { color: C.sub }]}>{formatDate(date)} · {filteredRecords.length} record{filteredRecords.length === 1 ? '' : 's'}</Text>
          </View>
        )}
        ListEmptyComponent={(
          <View style={styles.empty}>
            <CalendarDays size={42} color={C.sub} />
            <Text style={[styles.emptyTitle, { color: C.text }]}>No attendance records</Text>
            <Text style={[styles.emptyText, { color: C.sub }]}>Try another date or search term.</Text>
          </View>
        )}
        renderItem={({ item }) => <AttendanceCard record={item} colors={C} onSelfie={setSelfieUrl} />}
      />
      {selfieUrl ? (
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSelfieUrl(null)}>
          <View style={styles.modalCard}>
            <TouchableOpacity style={styles.closeButton} onPress={() => setSelfieUrl(null)}>
              <X size={20} color="#fff" />
            </TouchableOpacity>
            <Avatar.Image size={260} source={{ uri: selfieUrl }} />
          </View>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function Summary({ icon: Icon, label, value, color }) {
  return (
    <View style={styles.summaryCard}>
      <Icon size={16} color={color} />
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function AttendanceCard({ record, colors, onSelfie }) {
  const present = record.status === 'present';
  const selfie = record.checkInImage || record.selfieUrl;
  const [expanded, setExpanded] = useState(false);
  
  return (
    <Surface style={[styles.recordCard, { backgroundColor: colors.surface, borderColor: colors.border }]} elevation={1}>
      <TouchableOpacity onPress={() => setExpanded(!expanded)} activeOpacity={0.8} style={styles.recordTop}>
        {getAvatarUrl(record.employee?.avatar) ? (
          <Avatar.Image size={44} source={{ uri: getAvatarUrl(record.employee.avatar) }} />
        ) : (
          <Avatar.Text size={44} label={(record.employee?.name || 'E').slice(0, 2).toUpperCase()} style={{ backgroundColor: '#2563eb' }} labelStyle={{ color: '#fff' }} />
        )}
        <View style={styles.recordInfo}>
          <Text style={[styles.name, { color: colors.text }]}>{record.employee?.name || 'Employee'}</Text>
          <Text style={[styles.meta, { color: colors.sub }]}>{record.employee?.department || 'Staff'} · Check in {formatTime(record.checkIn)}</Text>
        </View>
        <View style={[styles.status, { backgroundColor: present ? '#dcfce7' : '#fee2e2' }]}>
          <Text style={[styles.statusText, { color: present ? '#16a34a' : '#dc2626' }]}>{(record.status || 'unknown').toUpperCase()}</Text>
        </View>
      </TouchableOpacity>
      <View style={[styles.detailRow, { borderTopColor: colors.border }]}>
        <Text style={[styles.detail, { color: colors.sub }]}>Date: {formatDate(record.date)}</Text>
        {record.checkOut ? <Text style={[styles.detail, { color: colors.sub }]}>Out: {formatTime(record.checkOut)}</Text> : null}
        {!expanded && selfie ? (
          <TouchableOpacity onPress={() => setExpanded(true)}>
            <Text style={{ color: '#2563eb', fontSize: 10, fontWeight: 'bold' }}>+ View Selfie</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {expanded && selfie ? (
        <View style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Text style={[styles.selfieTitle, { color: colors.sub, marginBottom: 0 }]}>Punch-in Selfie</Text>
            <TouchableOpacity onPress={() => setExpanded(false)}>
              <Text style={{ color: '#dc2626', fontSize: 10, fontWeight: 'bold' }}>Close</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => onSelfie(selfie)} activeOpacity={0.9}>
            <Image source={{ uri: selfie }} style={styles.inlineSelfie} />
          </TouchableOpacity>
        </View>
      ) : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(37,99,235,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: { fontFamily: FONT, fontSize: 16, fontWeight: '800' },
  topSub: { fontFamily: FONT, fontSize: 11, fontWeight: '500' },
  content: { padding: 12, paddingBottom: 60 },
  
  // Quick Presets Row
  presetsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  presetChipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  presetText: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '700',
  },
  presetTextActive: {
    color: '#ffffff',
  },

  filterCard: { flexDirection: 'row', gap: 8, padding: 10, borderWidth: 1, borderRadius: 12 },
  dateBox: { flex: 1, height: 40, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, borderWidth: 1, borderRadius: 9 },
  dateInput: { flex: 1, fontFamily: FONT, fontSize: 12 },
  applyButton: { height: 40, paddingHorizontal: 15, borderRadius: 9, backgroundColor: '#0284c7', alignItems: 'center', justifyContent: 'center' },
  applyText: { color: '#fff', fontFamily: FONT, fontWeight: 'bold', fontSize: 12 },
  searchBox: { height: 40, marginTop: 8, borderWidth: 1, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10 },
  searchInput: { flex: 1, fontFamily: FONT, fontSize: 12 },
  summaryRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  summaryCard: { flex: 1, minHeight: 62, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  summaryValue: { fontFamily: FONT, fontSize: 18, fontWeight: 'bold', marginTop: 2 },
  summaryLabel: { color: '#64748b', fontFamily: FONT, fontSize: 8, fontWeight: 'bold', marginTop: 2 },
  results: { fontFamily: FONT, fontSize: 10, marginVertical: 10 },
  recordCard: { padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  recordTop: { flexDirection: 'row', alignItems: 'center' },
  recordInfo: { flex: 1, marginLeft: 10 },
  name: { fontFamily: FONT, fontSize: 14, fontWeight: 'bold' },
  meta: { fontFamily: FONT, fontSize: 10, marginTop: 3 },
  status: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 5 },
  statusText: { fontFamily: FONT, fontSize: 9, fontWeight: 'bold' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, marginTop: 10, paddingTop: 8 },
  detail: { fontFamily: FONT, fontSize: 10 },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontFamily: FONT, fontSize: 14, fontWeight: 'bold', marginTop: 10 },
  emptyText: { fontFamily: FONT, fontSize: 11, marginTop: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loading: { fontFamily: FONT, fontSize: 12, marginTop: 8 },
  modalOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,.85)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { position: 'relative' },
  closeButton: { position: 'absolute', right: -8, top: -32, zIndex: 2, padding: 5 },
  selfieTitle: { fontFamily: FONT, fontSize: 10, fontWeight: 'bold', marginBottom: 6 },
  inlineSelfie: { width: '100%', height: 160, borderRadius: 10, backgroundColor: '#e2e8f0', resizeMode: 'cover' },
});
