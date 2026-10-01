import React, { useState, useEffect, useCallback } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Platform, RefreshControl, TextInput, Alert, Share, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Surface, Avatar } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import {
  BarChart3, FileText, CalendarDays, Users, MapPin,
  BriefcaseBusiness, ListChecks, ReceiptText, UserRound,
  RefreshCw, ArrowLeft, Download, Share2, Sparkles, Clock,
  ChevronRight, Calendar, CheckCircle2, TrendingUp
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { adminAPI, getAvatarUrl } from '../../services/api';
import { useSettings } from '../../context/SettingsContext';

const FONT = Platform.OS === 'ios' ? 'System' : 'sans-serif-medium';
const getEmpId = (e) => e?._id || e?.employeeId || e?.id || '';

export default function AdminReportsScreen() {
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
    indigo: '#4f46e5',
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const [employees, setEmployees] = useState([]);
  const [reportEmpId, setReportEmpId] = useState('');
  const [reportStart, setReportStart] = useState(new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
  const [reportEnd, setReportEnd] = useState(todayStr);
  const [activePreset, setActivePreset] = useState('7d');
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
    } catch (e) {
      setEmployees([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [reportEmpId]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchEmployees();
    setRefreshing(false);
  };

  // Quick Date Preset Handler
  const handleDatePreset = (presetKey) => {
    setActivePreset(presetKey);
    const end = new Date();
    let start = new Date();

    if (presetKey === 'today') {
      start = end;
    } else if (presetKey === '7d') {
      start = new Date(Date.now() - 7 * 86400000);
    } else if (presetKey === '30d') {
      start = new Date(Date.now() - 30 * 86400000);
    } else if (presetKey === 'thisMonth') {
      start = new Date(end.getFullYear(), end.getMonth(), 1);
    }

    setReportStart(start.toISOString().slice(0, 10));
    setReportEnd(end.toISOString().slice(0, 10));
  };

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
        employeeId: reportEmpId,
        startDate: reportStart,
        endDate: reportEnd,
      });
      if (res.data?.success) setReportData(res.data.data);
      else setReportError(res.data?.message || 'Report could not be generated.');
    } catch (e) {
      setReportError(e.response?.data?.message || 'Report could not be generated.');
    } finally {
      setReportLoading(false);
    }
  };

  const handleShareReport = async () => {
    if (!reportData) return;
    try {
      const empName = selectedEmp?.name || 'Staff';
      const summaryText = `📊 Staff Field Report for ${empName} (${reportStart} to ${reportEnd})\n` +
        `• Distance: ${Number(summary.totalKm || 0).toFixed(1)} km\n` +
        `• Travel Pay: ₹${Number(summary.travelPay || 0).toLocaleString('en-IN')}\n` +
        `• Field Visits: ${summary.totalMeetings || 0}\n` +
        `• Tasks: ${summary.totalTasks || 0}\n` +
        `• Expenses: ₹${Number(summary.totalExpenses || 0).toLocaleString('en-IN')}\n` +
        `Generated via KisanConnect App`;
      await Share.share({ message: summaryText });
    } catch (e) {}
  };

  const selectedEmp = employees.find((e) => String(getEmpId(e)) === String(reportEmpId));
  const summary = reportData?.summary || {};
  const activityRows = [
    { label: 'Field Visits', value: summary.totalMeetings ?? 0, icon: BriefcaseBusiness, color: '#2563eb' },
    { label: 'Tasks Completed', value: summary.totalTasks ?? 0, icon: ListChecks, color: '#d97706' },
    { label: 'Leads Handled', value: summary.totalLeads ?? 0, icon: Users, color: '#0f766e' },
    { label: 'Travel Distance', value: `${Number(summary.totalKm || 0).toFixed(1)} km`, icon: MapPin, color: '#7c3aed' },
    { label: 'Expense Claims', value: `₹${Number(summary.totalExpenses || 0).toLocaleString('en-IN')}`, icon: ReceiptText, color: '#db2777' },
    { label: 'Travel Pay (TA/DA)', value: `₹${Number(summary.travelPay || 0).toLocaleString('en-IN')}`, icon: BarChart3, color: '#15803d' },
  ];

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(admin)/dashboard');
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: C.bg }]}>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={[styles.emptyText, { color: C.sub }]}>Loading staff data…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      <StatusBar barStyle="light-content" backgroundColor="#2563eb" />

      {/* ── Top Header with Back Link ── */}
      <LinearGradient
        colors={['#2563eb', '#4f46e5']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.headerTitleRow}>
            <TouchableOpacity
              style={styles.headerBackBtn}
              onPress={handleGoBack}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ArrowLeft size={20} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.headerTitle}>Staff Activity Reports</Text>
              <Text style={styles.headerSub}>Consolidated performance & distance analytics</Text>
            </View>
            <TouchableOpacity style={styles.headerBackBtn} onPress={onRefresh} activeOpacity={0.7}>
              <RefreshCw size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* ── Scrollable Body with 30px Top Margin ── */}
      <ScrollView
        contentContainerStyle={[styles.body, { marginTop: 3 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero Info Banner ── */}
        <View style={[styles.reportHero, { backgroundColor: '#eef2ff', borderColor: '#dbe4ff' }]}>
          <UserRound size={20} color="#2563eb" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.heroTitle}>Build a staff report</Text>
            <Text style={styles.heroSub}>Choose one employee and a date range to see the full activity picture.</Text>
          </View>
        </View>

        {/* ── Section 1: Field Staff Selector ── */}
        <Text style={[styles.sectionTitle, { color: C.text }]}>FIELD STAFF</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', gap: 8, paddingRight: 12 }}>
            {employees.map((emp) => {
              const id = getEmpId(emp);
              const active = String(id) === String(reportEmpId);
              return (
                <TouchableOpacity
                  key={String(id)}
                  style={[
                    styles.empChip,
                    {
                      borderColor: active ? C.primary : C.border,
                      backgroundColor: active ? C.primary : C.surface,
                    },
                  ]}
                  onPress={() => setReportEmpId(String(id))}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.empChipText, { color: active ? '#fff' : C.sub }]}>
                    {(emp.name || 'Employee').split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* ── Section 2: Date Presets Quick Chips ── */}
        <Text style={[styles.sectionTitle, { color: C.text }]}>QUICK DATE PRESETS</Text>
        <View style={styles.presetRow}>
          {[
            { key: 'today', label: 'Today' },
            { key: '7d', label: 'Last 7 Days' },
            { key: 'thisMonth', label: 'This Month' },
            { key: '30d', label: 'Last 30 Days' },
          ].map((preset) => {
            const isSelected = activePreset === preset.key;
            return (
              <TouchableOpacity
                key={preset.key}
                style={[
                  styles.presetChip,
                  isSelected && styles.presetChipActive,
                  { borderColor: isSelected ? C.primary : C.border },
                ]}
                onPress={() => handleDatePreset(preset.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.presetText, isSelected && styles.presetTextActive]}>
                  {preset.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Section 3: Date Inputs ── */}
        <Text style={[styles.sectionTitle, { color: C.text, marginTop: 14 }]}>REPORTING PERIOD</Text>
        <View style={styles.dateRow}>
          <View style={[styles.dateBox, { borderColor: C.border, backgroundColor: C.surface }]}>
            <Text style={[styles.dateLbl, { color: C.sub }]}>START DATE</Text>
            <TextInput
              style={[styles.dateInput, { color: C.text }]}
              value={reportStart}
              onChangeText={setReportStart}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={C.sub}
            />
          </View>
          <View style={[styles.dateBox, { borderColor: C.border, backgroundColor: C.surface }]}>
            <Text style={[styles.dateLbl, { color: C.sub }]}>END DATE</Text>
            <TextInput
              style={[styles.dateInput, { color: C.text }]}
              value={reportEnd}
              onChangeText={setReportEnd}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={C.sub}
            />
          </View>
        </View>

        {reportError ? <Text style={styles.errorText}>{reportError}</Text> : null}

        {/* ── Generate Button ── */}
        <TouchableOpacity
          style={[styles.generateBtn, reportLoading && { opacity: 0.6 }]}
          onPress={handleGenerateReport}
          disabled={reportLoading}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#2563eb', '#4f46e5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.generateBtnGradient}
          >
            {reportLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <FileText size={16} color="#fff" />
            )}
            <Text style={styles.generateBtnText}>
              {reportLoading ? 'Generating Staff Report...' : 'Generate Report'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {selectedEmp ? (
          <Text style={[styles.selectedEmpText, { color: C.sub }]}>
            Showing {selectedEmp.name || 'Employee'} from {reportStart} to {reportEnd}
          </Text>
        ) : null}

        {/* ── Results Summary Cards & Export Actions ── */}
        {reportData ? (
          <View style={styles.resultsBlock}>
            <View style={styles.resultsHeaderRow}>
              <Text style={[styles.sectionTitle, { color: C.text, marginBottom: 0 }]}>
                ACTIVITY SUMMARY
              </Text>
              <TouchableOpacity
                style={styles.shareBtn}
                onPress={handleShareReport}
                activeOpacity={0.7}
              >
                <Share2 size={14} color={C.primary} />
                <Text style={styles.shareBtnText}>Share Report</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.summaryGrid}>
              {activityRows.map((row) => {
                const Icon = row.icon;
                return (
                  <Surface
                    key={row.label}
                    style={[styles.summaryCard, { backgroundColor: C.surface, borderColor: C.border }]}
                    elevation={1}
                  >
                    <View style={[styles.summaryIcon, { backgroundColor: `${row.color}14` }]}>
                      <Icon size={16} color={row.color} />
                    </View>
                    <Text style={[styles.summaryValue, { color: C.text }]}>{row.value}</Text>
                    <Text style={[styles.summaryLabel, { color: C.sub }]}>{row.label}</Text>
                  </Surface>
                );
              })}
            </View>

            {/* Detailed Breakdown Card */}
            <View style={[styles.detailCard, { backgroundColor: C.surface, borderColor: C.border }]}>
              <View style={styles.detailHeader}>
                <Sparkles size={16} color={C.primary} />
                <Text style={[styles.detailTitle, { color: C.text }]}>What this report includes</Text>
              </View>
              <Text style={[styles.detailText, { color: C.sub }]}>
                {reportData.meetings?.length || 0} visits, {reportData.tasks?.length || 0} tasks, {reportData.leads?.length || 0} leads, {reportData.expenses?.length || 0} expense entries and {reportData.locations?.length || 0} travel sessions.
              </Text>
            </View>
          </View>
        ) : (
          <View style={[styles.emptyReport, { borderColor: C.border }]}>
            <FileText size={28} color={C.sub} />
            <Text style={[styles.emptyTitle, { color: C.text }]}>No report generated yet</Text>
            <Text style={[styles.emptyText, { color: C.sub }]}>Select staff and dates, then generate the report.</Text>
          </View>
        )}

        {/* Extra Bottom Margin Space */}
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: Platform.OS === 'android' ? 10 : 0,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    fontFamily: FONT,
  },
  headerSub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    marginTop: 1,
    fontFamily: FONT,
  },

  // Body with 30px top margin requested
  body: {
    padding: 18,
    paddingBottom: 20,
  },

  reportHero: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 10,
    marginBottom: 10,
  },
  heroTitle: { color: '#2563eb', fontFamily: FONT, fontSize: 13, fontWeight: '800' },
  heroSub: { color: '#64748b', fontFamily: FONT, fontSize: 11, lineHeight: 15, marginTop: 2 },
  sectionTitle: { fontFamily: FONT, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, marginBottom: 8 },

  // Employee Chips
  empChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, borderWidth: 1 },
  empChipText: { fontFamily: FONT, fontSize: 11, fontWeight: '700' },

  // Date Preset Chips
  presetRow: { flexDirection: 'row', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
  presetChip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 10, borderWidth: 1, backgroundColor: '#f1f5f9' },
  presetChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  presetText: { fontFamily: FONT, fontSize: 10, fontWeight: '700', color: '#64748b' },
  presetTextActive: { color: '#ffffff' },

  // Date Inputs
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  dateBox: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 10 },
  dateLbl: { fontFamily: FONT, fontSize: 8, fontWeight: '800', marginBottom: 3 },
  dateInput: { fontFamily: FONT, fontSize: 12, fontWeight: '700', padding: 0 },

  // Generate Button
  generateBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 4 },
  generateBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  generateBtnText: { fontFamily: FONT, color: '#fff', fontWeight: '800', fontSize: 13 },
  selectedEmpText: { fontFamily: FONT, fontSize: 10, marginTop: 9, textAlign: 'center' },
  errorText: { color: '#b91c1c', backgroundColor: '#fef2f2', borderRadius: 10, padding: 10, fontFamily: FONT, fontSize: 11, marginBottom: 8, fontWeight: '600' },

  // Results
  resultsBlock: { marginTop: 20 },
  resultsHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#dbeafe' },
  shareBtnText: { fontFamily: FONT, fontSize: 10, fontWeight: '800', color: '#2563eb' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summaryCard: { width: '31.7%', minHeight: 96, borderRadius: 14, borderWidth: 1, padding: 10, justifyContent: 'center' },
  summaryIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  summaryValue: { fontFamily: FONT, fontSize: 15, fontWeight: '800' },
  summaryLabel: { fontFamily: FONT, fontSize: 9, marginTop: 2, fontWeight: '600' },
  detailCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginTop: 10 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  detailTitle: { fontFamily: FONT, fontSize: 12, fontWeight: '800' },
  detailText: { fontFamily: FONT, fontSize: 10, lineHeight: 15, marginTop: 2 },
  emptyReport: { alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, padding: 28, marginTop: 18 },
  emptyTitle: { fontFamily: FONT, fontSize: 13, fontWeight: '800', marginTop: 9 },
  emptyText: { fontFamily: FONT, fontSize: 10, textAlign: 'center', marginTop: 4 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});