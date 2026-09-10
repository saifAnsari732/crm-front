import React, { useState, useEffect, useCallback } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Platform, RefreshControl, TextInput, Alert,
} from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { BarChart3, FileText, CalendarDays, Users, MapPin, BriefcaseBusiness, ListChecks, ReceiptText, UserRound, RefreshCw } from 'lucide-react-native';
import { adminAPI } from '../../services/api';
import { useSettings } from '../../context/SettingsContext';

const FONT = Platform.OS === 'ios' ? 'System' : 'sans-serif-medium';
const getEmpId = (e) => e?._id || e?.employeeId || e?.id || '';

export default function AdminReportsScreen() {
  const { theme } = useSettings();
  const isDark = theme === 'dark';
  const C = {
    bg: isDark ? '#0f172a' : '#f8fafc',
    surface: isDark ? '#1e293b' : '#ffffff',
    text: isDark ? '#f8fafc' : '#0f172a',
    sub: isDark ? '#94a3b8' : '#64748b',
    border: isDark ? '#334155' : '#e2e8f0',
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const [employees, setEmployees] = useState([]);
  const [reportEmpId, setReportEmpId] = useState('');
  const [reportStart, setReportStart] = useState(new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
  const [reportEnd, setReportEnd] = useState(todayStr);
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await adminAPI.getEmployees({ limit: 200, role: 'all' });
      if (res.data?.success) {
        const list = res.data.employees || [];
        setEmployees(list);
        if (!reportEmpId && list.length > 0) setReportEmpId(getEmpId(list[0]));
      }
    } catch (e) { setEmployees([]); }
    finally { setLoading(false); setRefreshing(false); }
  }, [reportEmpId]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const onRefresh = async () => { setRefreshing(true); await fetchEmployees(); setRefreshing(false); };

  const handleGenerateReport = async () => {
    if (!reportEmpId) {
      Alert.alert('Select employee', 'Choose a field employee before generating the report.');
      return;
    }
    if (!reportStart || !reportEnd || reportStart > reportEnd) {
      setReportError('Please enter a valid start and end date.');
      return;
    }
    setReportLoading(true);
    setReportError('');
    try {
      const res = await adminAPI.getConsolidatedReport({
        employeeId: reportEmpId, startDate: reportStart, endDate: reportEnd,
      });
      if (res.data?.success) setReportData(res.data.data);
      else setReportError(res.data?.message || 'Report could not be generated.');
    } catch (e) { setReportError(e.response?.data?.message || 'Report could not be generated.'); }
    finally { setReportLoading(false); }
  };

  const selectedEmp = employees.find((e) => String(getEmpId(e)) === String(reportEmpId));
  const summary = reportData?.summary || {};
  const activityRows = [
    { label: 'Field visits', value: summary.totalMeetings ?? 0, icon: BriefcaseBusiness, color: '#2563eb' },
    { label: 'Tasks assigned', value: summary.totalTasks ?? 0, icon: ListChecks, color: '#d97706' },
    { label: 'Leads handled', value: summary.totalLeads ?? 0, icon: Users, color: '#0f766e' },
    { label: 'Travel distance', value: `${Number(summary.totalKm || 0).toFixed(1)} km`, icon: MapPin, color: '#7c3aed' },
    { label: 'Expenses', value: `₹${Number(summary.totalExpenses || 0).toLocaleString('en-IN')}`, icon: ReceiptText, color: '#db2777' },
    { label: 'Travel pay', value: `₹${Number(summary.travelPay || 0).toLocaleString('en-IN')}`, icon: BarChart3, color: '#15803d' },
  ];
  const fmtNum = (v) => (parseFloat(v) || 0).toFixed(2);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: C.bg }]}>
        <ActivityIndicator size="large" color="#283b96" />
        <Text style={[styles.emptyText, { color: C.sub }]}>Loading…</Text>
      </View>
    );
  }
return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      <View style={[styles.header, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
        <View style={styles.headerIcon}><BarChart3 size={20} color="#fff" /></View>
        <View style={{ flex: 1 }}><Text style={[styles.eyebrow, { color: C.sub }]}>ADMIN ANALYTICS</Text><Text style={[styles.title, { color: C.text }]}>Employee reports</Text><Text style={[styles.subtitle, { color: C.sub }]}>Review activity, travel and expenses</Text></View>
        <TouchableOpacity onPress={onRefresh} style={[styles.refreshBtn, { borderColor: C.border }]}><RefreshCw size={16} color="#283b96" /></TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={[styles.reportHero, { backgroundColor: '#eef2ff', borderColor: '#dbe4ff' }]}><UserRound size={20} color="#283b96" /><View style={{ flex: 1, marginLeft: 10 }}><Text style={styles.heroTitle}>Build a staff report</Text><Text style={styles.heroSub}>Choose one employee and a date range to see the full activity picture.</Text></View></View>

        <Text style={[styles.sectionTitle, { color: C.text }]}>Field staff</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', gap: 8, paddingRight: 12 }}>
            {employees.map((emp) => {
              const id = getEmpId(emp);
              const active = String(id) === String(reportEmpId);
              return (
                <TouchableOpacity
                  key={String(id)}
                  style={[styles.empChip, { borderColor: active ? '#283b96' : C.border, backgroundColor: active ? '#283b96' : C.surface }]}
                  onPress={() => setReportEmpId(String(id))}
                >
                  <Text style={[styles.empChipText, { color: active ? '#fff' : C.sub }]}>{(emp.name || 'Employee').split(' ')[0]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <Text style={[styles.sectionTitle, { color: C.text }]}>Reporting period</Text>
        <View style={styles.dateRow}>
          <View style={[styles.dateBox, { borderColor: C.border, backgroundColor: C.surface }]}>
            <Text style={[styles.dateLbl, { color: C.sub }]}>START DATE</Text>
            <TextInput style={[styles.dateInput, { color: C.text }]} value={reportStart} onChangeText={setReportStart} placeholder="YYYY-MM-DD" placeholderTextColor={C.sub} />
          </View>
          <View style={[styles.dateBox, { borderColor: C.border, backgroundColor: C.surface }]}>
            <Text style={[styles.dateLbl, { color: C.sub }]}>END DATE</Text>
            <TextInput style={[styles.dateInput, { color: C.text }]} value={reportEnd} onChangeText={setReportEnd} placeholder="YYYY-MM-DD" placeholderTextColor={C.sub} />
          </View>
        </View>

        {reportError ? <Text style={styles.errorText}>{reportError}</Text> : null}
        <TouchableOpacity style={[styles.generateBtn, reportLoading && { opacity: 0.6 }]} onPress={handleGenerateReport} disabled={reportLoading}>
          {reportLoading ? <ActivityIndicator color="#fff" size="small" /> : <FileText size={16} color="#fff" />}
          <Text style={styles.generateBtnText}>{reportLoading ? 'Generating…' : 'Generate Report'}</Text>
        </TouchableOpacity>
        {selectedEmp ? <Text style={[styles.selectedEmpText, { color: C.sub }]}>Showing {selectedEmp.name || 'Employee'} from {reportStart} to {reportEnd}</Text> : null}
        {reportData ? <View style={styles.resultsBlock}><Text style={[styles.sectionTitle, { color: C.text }]}>Activity summary</Text><View style={styles.summaryGrid}>{activityRows.map((row) => { const Icon = row.icon; return <Surface key={row.label} style={[styles.summaryCard, { backgroundColor: C.surface, borderColor: C.border }]} elevation={1}><View style={[styles.summaryIcon, { backgroundColor: `${row.color}16` }]}><Icon size={17} color={row.color} /></View><Text style={[styles.summaryValue, { color: C.text }]}>{row.value}</Text><Text style={[styles.summaryLabel, { color: C.sub }]}>{row.label}</Text></Surface>; })}</View><View style={[styles.detailCard, { backgroundColor: C.surface, borderColor: C.border }]}><Text style={[styles.detailTitle, { color: C.text }]}>What this report includes</Text><Text style={[styles.detailText, { color: C.sub }]}>{reportData.meetings?.length || 0} visits, {reportData.tasks?.length || 0} tasks, {reportData.leads?.length || 0} leads, {reportData.expenses?.length || 0} expense entries and {reportData.locations?.length || 0} travel sessions.</Text></View></View> : <View style={[styles.emptyReport, { borderColor: C.border }]}><FileText size={28} color={C.sub} /><Text style={[styles.emptyTitle, { color: C.text }]}>No report generated yet</Text><Text style={[styles.emptyText, { color: C.sub }]}>Select staff and dates, then generate the report.</Text></View>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: Platform.OS === 'ios' ? 54 : 22, paddingBottom: 14, borderBottomWidth: 1, gap: 10 },
  headerIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#283b96', alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontFamily: FONT, fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },
  title: { fontFamily: FONT, fontSize: 18, fontWeight: 'bold', marginTop: 2 },
  subtitle: { fontFamily: FONT, fontSize: 10, marginTop: 2 },
  refreshBtn: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 14, paddingBottom: 30 },
  reportHero: { flexDirection: 'row', alignItems: 'center', borderRadius: 15, borderWidth: 1, padding: 13, marginBottom: 18 },
  heroTitle: { color: '#283b96', fontFamily: FONT, fontSize: 13, fontWeight: 'bold' },
  heroSub: { color: '#64748b', fontFamily: FONT, fontSize: 10, lineHeight: 14, marginTop: 3 },
  sectionTitle: { fontFamily: FONT, fontSize: 12, fontWeight: 'bold', letterSpacing: 0.4, marginBottom: 8, textTransform: 'uppercase' },
  empChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, borderWidth: 1 },
  empChipText: { fontFamily: FONT, fontSize: 11, fontWeight: 'bold' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  dateBox: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 10 },
  dateLbl: { fontFamily: FONT, fontSize: 8, fontWeight: 'bold', marginBottom: 3 },
  dateInput: { fontFamily: FONT, fontSize: 12, fontWeight: '600', padding: 0 },
  generateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#283b96', borderRadius: 12, paddingVertical: 13 },
  generateBtnText: { fontFamily: FONT, color: '#fff', fontWeight: 'bold', fontSize: 13 },
  selectedEmpText: { fontFamily: FONT, fontSize: 10, marginTop: 9, textAlign: 'center' },
  errorText: { color: '#b91c1c', backgroundColor: '#fef2f2', borderRadius: 9, padding: 9, fontFamily: FONT, fontSize: 10, marginBottom: 8 },
  resultsBlock: { marginTop: 22 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summaryCard: { width: '31.7%', minHeight: 104, borderRadius: 13, borderWidth: 1, padding: 10 },
  summaryIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 7 },
  summaryValue: { fontFamily: FONT, fontSize: 16, fontWeight: 'bold' },
  summaryLabel: { fontFamily: FONT, fontSize: 9, lineHeight: 12, marginTop: 3 },
  detailCard: { borderRadius: 14, borderWidth: 1, padding: 13, marginTop: 10 },
  detailTitle: { fontFamily: FONT, fontSize: 12, fontWeight: 'bold' },
  detailText: { fontFamily: FONT, fontSize: 10, lineHeight: 15, marginTop: 5 },
  emptyReport: { alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, padding: 28, marginTop: 22 },
  emptyTitle: { fontFamily: FONT, fontSize: 13, fontWeight: 'bold', marginTop: 9 },
  emptyText: { fontFamily: FONT, fontSize: 10, textAlign: 'center', marginTop: 4 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontFamily: FONT, fontSize: 12, marginTop: 8 },
});