import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Platform, RefreshControl,
  StyleSheet, TextInput, TouchableOpacity, View, Image,
} from 'react-native';
import { BriefcaseBusiness, CalendarDays, CheckCircle2, Clock3, MapPin, Search, XCircle } from 'lucide-react-native';
import { Text, Surface } from 'react-native-paper';
import { meetingAPI } from '../../services/api';
import { useSettings } from '../../context/SettingsContext';

const FONT = Platform.OS === 'ios' ? 'System' : 'sans-serif-medium';
const statusOptions = ['all', 'scheduled', 'completed', 'follow-up', 'cancelled'];

const formatDate = (value) => value
  ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  : 'Date not available';

const statusConfig = {
  scheduled: { label: 'Scheduled', color: '#2563eb', background: '#dbeafe', icon: Clock3 },
  completed: { label: 'Completed', color: '#15803d', background: '#dcfce7', icon: CheckCircle2 },
  'follow-up': { label: 'Follow-up', color: '#a16207', background: '#fef3c7', icon: CalendarDays },
  cancelled: { label: 'Cancelled', color: '#b91c1c', background: '#fee2e2', icon: XCircle },
};

export default function AdminVisitsScreen() {
  const { theme } = useSettings();
  const isDark = theme === 'dark';
  const C = {
    bg: isDark ? '#0f172a' : '#f8fafc',
    surface: isDark ? '#1e293b' : '#fff',
    text: isDark ? '#f8fafc' : '#0f172a',
    sub: isDark ? '#94a3b8' : '#64748b',
    border: isDark ? '#334155' : '#e2e8f0',
  };
  const [visits, setVisits] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchVisits = useCallback(async () => {
    try {
      const response = await meetingAPI.getAll({ limit: 200 });
      if (response.data?.success) setVisits(response.data.meetings || []);
      else setVisits([]);
    } catch (error) {
      console.log('Admin visits fetch error:', error.message);
      setVisits([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchVisits(); }, [fetchVisits]);

  const filteredVisits = useMemo(() => visits.filter((visit) => {
    const query = search.toLowerCase();
    const haystack = [
      visit.clientName, visit.companyName, visit.meetingAddress,
      visit.employee?.name, visit.employee?.department,
    ].filter(Boolean).join(' ').toLowerCase();
    const matchesSearch = !query || haystack.includes(query);
    const matchesStatus = status === 'all' || visit.status === status;
    const matchesDate = !date || new Date(visit.date).toISOString().slice(0, 10) === date;
    return matchesSearch && matchesStatus && matchesDate;
  }), [date, search, status, visits]);

  const counts = useMemo(() => ({
    all: visits.length,
    scheduled: visits.filter((visit) => visit.status === 'scheduled').length,
    completed: visits.filter((visit) => visit.status === 'completed').length,
    followUp: visits.filter((visit) => visit.status === 'follow-up').length,
  }), [visits]);

  const onRefresh = async () => { setRefreshing(true); await fetchVisits(); };

  if (loading) {
    return <View style={[styles.center, { backgroundColor: C.bg }]}><ActivityIndicator size="large" color="#283b96" /><Text style={[styles.loadingText, { color: C.sub }]}>Loading visits...</Text></View>;
  }

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      <FlatList
        data={filteredVisits}
        keyExtractor={(item, index) => String(item._id || index)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.content}
        ListHeaderComponent={(
          <View>
            <View style={styles.summaryRow}>
              <Summary label="ALL" value={counts.all} color="#283b96" />
              <Summary label="SCHEDULED" value={counts.scheduled} color="#2563eb" />
              <Summary label="DONE" value={counts.completed} color="#15803d" />
              <Summary label="FOLLOW-UP" value={counts.followUp} color="#a16207" />
            </View>
            <View style={[styles.searchBox, { backgroundColor: C.surface, borderColor: C.border }]}><Search size={15} color={C.sub} /><TextInput style={[styles.searchInput, { color: C.text }]} value={search} onChangeText={setSearch} placeholder="Search employee or client..." placeholderTextColor={C.sub} /></View>
            <View style={styles.filterRow}>
              <View style={[styles.dateBox, { backgroundColor: C.surface, borderColor: C.border }]}><CalendarDays size={15} color={C.sub} /><TextInput style={[styles.dateInput, { color: C.text }]} value={date} onChangeText={setDate} placeholder="Choose date" placeholderTextColor={C.sub} {...(Platform.OS === 'web' ? { type: 'date' } : {})} /></View>
              <View style={styles.statusScroll}>{statusOptions.map((option) => <TouchableOpacity key={option} style={[styles.statusChip, { backgroundColor: status === option ? '#283b96' : C.surface, borderColor: status === option ? '#283b96' : C.border }]} onPress={() => setStatus(option)}><Text style={[styles.statusChipText, { color: status === option ? '#fff' : C.sub }]}>{option.toUpperCase()}</Text></TouchableOpacity>)}</View>
            </View>
            <Text style={[styles.resultsLabel, { color: C.sub }]}>{filteredVisits.length} visit{filteredVisits.length === 1 ? '' : 's'} shown</Text>
          </View>
        )}
        ListEmptyComponent={<View style={styles.empty}><BriefcaseBusiness size={38} color={C.sub} /><Text style={[styles.emptyTitle, { color: C.text }]}>No visits found</Text><Text style={[styles.emptyText, { color: C.sub }]}>Try changing the date, status, or search filter.</Text></View>}
        renderItem={({ item }) => <VisitCard visit={item} colors={C} />}
      />
    </View>
  );
}

function Summary({ label, value, color }) {
  return <View style={styles.summaryCard}><Text style={[styles.summaryValue, { color }]}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></View>;
}

function VisitCard({ visit, colors }) {
  const config = statusConfig[visit.status] || statusConfig.scheduled;
  const StatusIcon = config.icon;
  const [expanded, setExpanded] = useState(false);

  return (
    <Surface style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} elevation={1}>
      <TouchableOpacity onPress={() => setExpanded(!expanded)} activeOpacity={0.8} style={styles.cardTop}>
        <View style={styles.clientIcon}>
          <BriefcaseBusiness size={18} color="#283b96" />
        </View>
        <View style={styles.cardMain}>
          <Text style={[styles.clientName, { color: colors.text }]}>{visit.clientName || 'Unnamed client'}</Text>
          <Text style={[styles.company, { color: colors.sub }]}>{visit.companyName || 'Independent visit'}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: config.background }]}>
          <StatusIcon size={13} color={config.color} />
          <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
        </View>
      </TouchableOpacity>
      
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      
      <View style={styles.detailRow}>
        <Text style={[styles.detailLabel, { color: colors.sub }]}>Employee</Text>
        <Text style={[styles.detailValue, { color: colors.text }]}>{visit.employee?.name || 'Unknown employee'}</Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={[styles.detailLabel, { color: colors.sub }]}>Date</Text>
        <Text style={[styles.detailValue, { color: colors.text }]}>{formatDate(visit.date)}</Text>
      </View>

      {visit.meetingAddress ? (
        <View style={styles.locationRow}>
          <MapPin size={14} color="#008080" />
          <Text style={[styles.locationText, { color: colors.sub }]} numberOfLines={expanded ? undefined : 2}>
            {visit.meetingAddress}
          </Text>
        </View>
      ) : null}

      {expanded && (
        <View style={styles.expandedContent}>
          {visit.mobileNumber && (
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.sub }]}>Mobile</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>{visit.mobileNumber}</Text>
            </View>
          )}
          {visit.dealAmount > 0 && (
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.sub }]}>Deal Amount</Text>
              <Text style={[styles.detailValue, { color: '#008080' }]}>₹{Number(visit.dealAmount).toLocaleString('en-IN')}</Text>
            </View>
          )}
          {visit.followUpDate && (
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.sub }]}>Follow-up</Text>
              <Text style={[styles.detailValue, { color: '#a16207' }]}>{formatDate(visit.followUpDate)}</Text>
            </View>
          )}
          {visit.meetingNotes && (
            <View style={styles.notesBox}>
              <Text style={[styles.notesLabel, { color: colors.sub }]}>Meeting Notes / Outcome</Text>
              <Text style={[styles.notesText, { color: colors.text }]}>{visit.meetingNotes}</Text>
            </View>
          )}
          {visit.selfieUrl && (
            <View style={styles.selfieBox}>
              <Text style={[styles.notesLabel, { color: colors.sub, marginBottom: 6 }]}>Visit Selfie</Text>
              <Image source={{ uri: visit.selfieUrl }} style={styles.visitSelfie} />
            </View>
          )}
        </View>
      )}

      {!expanded && visit.dealAmount > 0 && (
        <Text style={styles.amount}>Deal: ₹{Number(visit.dealAmount).toLocaleString('en-IN')}</Text>
      )}
    </Surface>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1 },
  heroIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#283b96', alignItems: 'center', justifyContent: 'center' },
  heroCopy: { marginLeft: 12 },
  eyebrow: { fontFamily: FONT, fontSize: 9, fontWeight: 'bold' },
  title: { fontFamily: FONT, fontSize: 19, fontWeight: 'bold', marginTop: 2 },
  subtitle: { fontFamily: FONT, fontSize: 11, marginTop: 2 },
  content: { padding: 12, paddingBottom: 28 },
  summaryRow: { flexDirection: 'row', gap: 7, marginBottom: 10 },
  summaryCard: { flex: 1, minHeight: 62, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  summaryValue: { fontFamily: FONT, fontSize: 18, fontWeight: 'bold' },
  summaryLabel: { fontFamily: FONT, color: '#64748b', fontSize: 8, fontWeight: 'bold', marginTop: 3 },
  searchBox: { height: 40, borderWidth: 1, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, marginBottom: 8 },
  searchInput: { flex: 1, fontFamily: FONT, fontSize: 12 },
  filterRow: { gap: 8 },
  dateBox: { height: 40, borderWidth: 1, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10 },
  dateInput: { flex: 1, fontFamily: FONT, fontSize: 12 },
  statusScroll: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  statusChip: { borderWidth: 1, borderRadius: 15, paddingHorizontal: 10, paddingVertical: 7 },
  statusChipText: { fontFamily: FONT, fontSize: 9, fontWeight: 'bold' },
  resultsLabel: { fontFamily: FONT, fontSize: 10, marginVertical: 10 },
  card: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  clientIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#e8edff', alignItems: 'center', justifyContent: 'center' },
  cardMain: { flex: 1, marginLeft: 10 },
  clientName: { fontFamily: FONT, fontSize: 14, fontWeight: 'bold' },
  company: { fontFamily: FONT, fontSize: 11, marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 14, paddingHorizontal: 8, paddingVertical: 5 },
  statusText: { fontFamily: FONT, fontSize: 9, fontWeight: 'bold' },
  divider: { height: 1, marginVertical: 10 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  detailLabel: { fontFamily: FONT, fontSize: 10 },
  detailValue: { fontFamily: FONT, fontSize: 11, fontWeight: 'bold', maxWidth: '65%', textAlign: 'right' },
  locationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 3 },
  locationText: { flex: 1, fontFamily: FONT, fontSize: 10 },
  amount: { color: '#008080', fontFamily: FONT, fontSize: 11, fontWeight: 'bold', marginTop: 8 },
  empty: { alignItems: 'center', paddingVertical: 42 },
  emptyTitle: { fontFamily: FONT, fontSize: 14, fontWeight: 'bold', marginTop: 10 },
  emptyText: { fontFamily: FONT, fontSize: 11, marginTop: 4, textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontFamily: FONT, fontSize: 12, marginTop: 8 },
  expandedContent: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 12 },
  notesBox: { backgroundColor: '#f8fafc', padding: 10, borderRadius: 8, marginTop: 8 },
  notesLabel: { fontFamily: FONT, fontSize: 10, fontWeight: 'bold', marginBottom: 4 },
  notesText: { fontFamily: FONT, fontSize: 11, lineHeight: 16 },
  selfieBox: { marginTop: 12 },
  visitSelfie: { width: '100%', height: 180, borderRadius: 10, resizeMode: 'cover', backgroundColor: '#e2e8f0' },
});