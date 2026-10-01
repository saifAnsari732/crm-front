import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, Platform, RefreshControl,
  StyleSheet, TextInput, TouchableOpacity, View, Image,
} from 'react-native';
import { CalendarDays, CheckCircle2, Clock3, Search, UserX, X } from 'lucide-react-native';
import { Avatar, Surface, Text } from 'react-native-paper';
import { adminAPI, getAvatarUrl } from '../../services/api';
import { useSettings } from '../../context/SettingsContext';

const FONT = Platform.OS === 'ios' ? 'System' : 'sans-serif-medium';
const getToday = () => new Date().toISOString().slice(0, 10);
const formatDate = (value) => value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const formatTime = (value) => value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

export default function AdminAttendanceScreen() {
  const { theme } = useSettings();
  const isDark = theme === 'dark';
  const C = {
    bg: isDark ? '#0f172a' : '#f8fafc', surface: isDark ? '#1e293b' : '#fff',
    text: isDark ? '#f8fafc' : '#0f172a', sub: isDark ? '#94a3b8' : '#64748b',
    border: isDark ? '#334155' : '#e2e8f0',
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

  if (loading) return <View style={[styles.center, { backgroundColor: C.bg }]}><ActivityIndicator size="large" color="#283b96" /><Text style={[styles.loading, { color: C.sub }]}>Loading attendance...</Text></View>;

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      <FlatList
        data={filteredRecords}
        keyExtractor={(item, index) => String(item._id || index)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await fetchAttendance(); }} />}
        contentContainerStyle={styles.content}
        ListHeaderComponent={(
          <View>
            <View style={[styles.filterCard, { backgroundColor: C.surface, borderColor: C.border }]}>
              <View style={[styles.dateBox, { backgroundColor: C.bg, borderColor: C.border }]}><CalendarDays size={15} color={C.sub} /><TextInput style={[styles.dateInput, { color: C.text }]} value={date} onChangeText={setDate} placeholder="Choose date" placeholderTextColor={C.sub} {...(Platform.OS === 'web' ? { type: 'date' } : {})} /></View>
              <TouchableOpacity style={styles.applyButton} onPress={fetchAttendance}><Text style={styles.applyText}>Apply</Text></TouchableOpacity>
            </View>
            <View style={[styles.searchBox, { backgroundColor: C.surface, borderColor: C.border }]}><Search size={15} color={C.sub} /><TextInput style={[styles.searchInput, { color: C.text }]} value={search} onChangeText={setSearch} placeholder="Search employee..." placeholderTextColor={C.sub} /></View>
            <View style={styles.summaryRow}><Summary icon={CheckCircle2} label="PRESENT" value={presentCount} color="#15803d" /><Summary icon={UserX} label="OTHER" value={absentCount} color="#dc2626" /><Summary icon={Clock3} label="TOTAL" value={records.length} color="#283b96" /></View>
            <Text style={[styles.results, { color: C.sub }]}>{formatDate(date)} · {filteredRecords.length} record{filteredRecords.length === 1 ? '' : 's'}</Text>
          </View>
        )}
        ListEmptyComponent={<View style={styles.empty}><CalendarDays size={38} color={C.sub} /><Text style={[styles.emptyTitle, { color: C.text }]}>No attendance records</Text><Text style={[styles.emptyText, { color: C.sub }]}>Try another date or search term.</Text></View>}
        renderItem={({ item }) => <AttendanceCard record={item} colors={C} onSelfie={setSelfieUrl} />}
      />
      {selfieUrl ? <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSelfieUrl(null)}><View style={styles.modalCard}><TouchableOpacity style={styles.closeButton} onPress={() => setSelfieUrl(null)}><X size={20} color="#fff" /></TouchableOpacity><Avatar.Image size={260} source={{ uri: selfieUrl }} /></View></TouchableOpacity> : null}
    </View>
  );
}

function Summary({ icon: Icon, label, value, color }) {
  return <View style={styles.summaryCard}><Icon size={16} color={color} /><Text style={[styles.summaryValue, { color }]}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></View>;
}

function AttendanceCard({ record, colors, onSelfie }) {
  const present = record.status === 'present';
  const selfie = record.checkInImage || record.selfieUrl;
  const [expanded, setExpanded] = useState(false);
  
  return <Surface style={[styles.recordCard, { backgroundColor: colors.surface, borderColor: colors.border }]} elevation={1}>
    <TouchableOpacity onPress={() => setExpanded(!expanded)} activeOpacity={0.8} style={styles.recordTop}>
      {getAvatarUrl(record.employee?.avatar) ? <Avatar.Image size={44} source={{ uri: getAvatarUrl(record.employee.avatar) }} /> : <Avatar.Text size={44} label={(record.employee?.name || 'E').slice(0, 2).toUpperCase()} style={{ backgroundColor: '#283b96' }} labelStyle={{ color: '#fff' }} />}
      <View style={styles.recordInfo}>
        <Text style={[styles.name, { color: colors.text }]}>{record.employee?.name || 'Employee'}</Text>
        <Text style={[styles.meta, { color: colors.sub }]}>{record.employee?.department || 'Staff'} · Check in {formatTime(record.checkIn)}</Text>
      </View>
      <View style={[styles.status, { backgroundColor: present ? '#dcfce7' : '#fee2e2' }]}>
        <Text style={[styles.statusText, { color: present ? '#15803d' : '#dc2626' }]}>{(record.status || 'unknown').toUpperCase()}</Text>
      </View>
    </TouchableOpacity>
    <View style={[styles.detailRow, { borderTopColor: colors.border }]}>
      <Text style={[styles.detail, { color: colors.sub }]}>Date: {formatDate(record.date)}</Text>
      {record.checkOut ? <Text style={[styles.detail, { color: colors.sub }]}>Out: {formatTime(record.checkOut)}</Text> : null}
      {!expanded && selfie ? (
        <TouchableOpacity onPress={() => setExpanded(true)}>
          <Text style={{ color: '#283b96', fontSize: 10, fontWeight: 'bold' }}>+ View Selfie</Text>
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
  </Surface>;
}

const styles = StyleSheet.create({
  root: { flex: 1 }, hero: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1 }, heroIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#283b96', alignItems: 'center', justifyContent: 'center', marginRight: 12 }, eyebrow: { fontFamily: FONT, fontSize: 9, fontWeight: 'bold' }, title: { fontFamily: FONT, fontSize: 19, fontWeight: 'bold' }, subtitle: { fontFamily: FONT, fontSize: 11, marginTop: 2 }, content: { padding: 12, paddingBottom: 28 }, filterCard: { flexDirection: 'row', gap: 8, padding: 10, borderWidth: 1, borderRadius: 12 }, dateBox: { flex: 1, height: 40, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, borderWidth: 1, borderRadius: 9 }, dateInput: { flex: 1, fontFamily: FONT, fontSize: 12 }, applyButton: { height: 40, paddingHorizontal: 15, borderRadius: 9, backgroundColor: '#008080', alignItems: 'center', justifyContent: 'center' }, applyText: { color: '#fff', fontFamily: FONT, fontWeight: 'bold', fontSize: 12 }, searchBox: { height: 40, marginTop: 8, borderWidth: 1, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10 }, searchInput: { flex: 1, fontFamily: FONT, fontSize: 12 }, summaryRow: { flexDirection: 'row', gap: 8, marginTop: 10 }, summaryCard: { flex: 1, minHeight: 62, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }, summaryValue: { fontFamily: FONT, fontSize: 18, fontWeight: 'bold', marginTop: 2 }, summaryLabel: { color: '#64748b', fontFamily: FONT, fontSize: 8, fontWeight: 'bold', marginTop: 2 }, results: { fontFamily: FONT, fontSize: 10, marginVertical: 10 }, recordCard: { padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 10 }, recordTop: { flexDirection: 'row', alignItems: 'center' }, recordInfo: { flex: 1, marginLeft: 10 }, name: { fontFamily: FONT, fontSize: 14, fontWeight: 'bold' }, meta: { fontFamily: FONT, fontSize: 10, marginTop: 3 }, status: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 5 }, statusText: { fontFamily: FONT, fontSize: 9, fontWeight: 'bold' }, detailRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, marginTop: 10, paddingTop: 8 }, detail: { fontFamily: FONT, fontSize: 10 }, selfie: { color: '#283b96', fontFamily: FONT, fontSize: 11, fontWeight: 'bold', marginTop: 8 }, empty: { alignItems: 'center', paddingVertical: 48 }, emptyTitle: { fontFamily: FONT, fontSize: 14, fontWeight: 'bold', marginTop: 10 }, emptyText: { fontFamily: FONT, fontSize: 11, marginTop: 4 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, loading: { fontFamily: FONT, fontSize: 12, marginTop: 8 }, modalOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,.85)', alignItems: 'center', justifyContent: 'center' }, modalCard: { position: 'relative' }, closeButton: { position: 'absolute', right: -8, top: -32, zIndex: 2, padding: 5 }, shortcutTitle: { fontFamily: FONT, fontSize: 12, fontWeight: 'bold' },
  selfieTitle: { fontFamily: FONT, fontSize: 10, fontWeight: 'bold', marginBottom: 6 },
  inlineSelfie: { width: '100%', height: 160, borderRadius: 10, backgroundColor: '#e2e8f0', resizeMode: 'cover' },
});
