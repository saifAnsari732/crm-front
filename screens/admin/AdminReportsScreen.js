import React, { useState, useEffect, useCallback } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Platform, RefreshControl, TextInput, Alert, Share, StatusBar, Modal, Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Surface, Avatar } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import {
  BarChart3, FileText, CalendarDays, Users, MapPin,
  BriefcaseBusiness, ListChecks, ReceiptText, UserRound,
  RefreshCw, ArrowLeft, Download, Share2, Sparkles, Clock,
  ChevronRight, ChevronDown, X, CheckCircle2, Filter
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { adminAPI, getAvatarUrl } from '../../services/api';

const FONT = Platform.OS === 'ios' ? 'System' : 'sans-serif-medium';
const { width, height } = Dimensions.get('window');
const getEmpId = (e) => e?._id || e?.employeeId || e?.id || '';

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

export default function AdminReportsScreen() {
  const router = useRouter();

  const todayStr = new Date().toISOString().slice(0, 10);
  const [employees, setEmployees] = useState([]);
  const [reportEmpId, setReportEmpId] = useState('');
  const [empDropdownVisible, setEmpDropdownVisible] = useState(false);

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

  const selectedEmp = employees.find((e) => String(getEmpId(e)) === String(reportEmpId));
  const summary = reportData?.summary || {};

  const handleDownloadPDF = async () => {
    if (!reportData) return;
    const empName = selectedEmp ? formatFullName(selectedEmp.name) : 'Staff';
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Staff Activity Report - ${empName}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; padding: 28px; color: #0f172a; background: #fff; }
            .header-banner { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #059669; padding-bottom: 16px; margin-bottom: 24px; }
            .brand-title { font-size: 24px; font-weight: 800; color: #074e26; }
            .brand-sub { font-size: 12px; color: #059669; font-weight: bold; letter-spacing: 0.5px; }
            .meta-box { font-size: 13px; color: #475569; margin-top: 6px; }
            .confidential-tag { font-size: 11px; font-weight: 800; color: #059669; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 4px 10px; border-radius: 6px; display: inline-block; }
            
            .section-heading { font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 20px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
            .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
            .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; text-align: center; }
            .kpi-val { font-size: 22px; font-weight: 900; color: #059669; }
            .kpi-lbl { font-size: 10px; color: #64748b; font-weight: 800; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
            
            .summary-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin-bottom: 20px; }
            .summary-text { font-size: 13px; color: #166534; line-height: 1.6; }

            .footer { margin-top: 40px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 14px; }
          </style>
        </head>
        <body>
          <div class="header-banner">
            <div>
              <div class="brand-title">KisanConnect Field Report</div>
              <div class="brand-sub">OFFICIAL PERFORMANCE & MILEAGE AUDIT</div>
              <div class="meta-box">Field Executive: <strong>${empName}</strong> | Period: <strong>${reportStart} to ${reportEnd}</strong></div>
            </div>
            <div style="text-align: right;">
              <div class="confidential-tag">OFFICIAL AUDIT REPORT</div>
              <div class="meta-box" style="margin-top: 8px;">Issued on ${new Date().toLocaleDateString('en-GB')}</div>
            </div>
          </div>

          <div class="section-heading">Key Metrics Overview</div>
          <div class="kpi-grid">
            <div class="kpi-card"><div class="kpi-val">${Number(summary.totalKm || 0).toFixed(2)} km</div><div class="kpi-lbl">Total Travel Distance</div></div>
            <div class="kpi-card"><div class="kpi-val">₹${Number(summary.travelPay || 0).toLocaleString('en-IN')}</div><div class="kpi-lbl">Travel Pay (TA/DA)</div></div>
            <div class="kpi-card"><div class="kpi-val">${summary.totalMeetings || 0}</div><div class="kpi-lbl">Field Visits</div></div>
            <div class="kpi-card"><div class="kpi-val">${summary.totalTasks || 0}</div><div class="kpi-lbl">Tasks Completed</div></div>
            <div class="kpi-card"><div class="kpi-val">₹${Number(summary.totalExpenses || 0).toLocaleString('en-IN')}</div><div class="kpi-lbl">Expense Claims</div></div>
            <div class="kpi-card"><div class="kpi-val">${summary.totalLeads || 0}</div><div class="kpi-lbl">Leads Handled</div></div>
          </div>

          <div class="summary-box">
            <div class="summary-text">
              <strong>Audit Summary:</strong> Executive ${empName} completed a total travel distance of <strong>${Number(summary.totalKm || 0).toFixed(2)} KM</strong> between ${reportStart} and ${reportEnd}. Recorded ${summary.totalMeetings || 0} field visits and ${summary.totalTasks || 0} completed tasks with total TA/DA reimbursement of ₹${Number(summary.travelPay || 0).toLocaleString('en-IN')}.
            </div>
          </div>

          <div class="footer">
            System Generated Report • KisanConnect Field Workforce Console • ${new Date().toISOString()}
          </div>
        </body>
      </html>
    `;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); }, 300);
      }
    } else {
      try {
        await Share.share({
          title: `KisanConnect Staff Report - ${empName}`,
          message: `📊 KisanConnect Field Staff Report for ${empName} (${reportStart} to ${reportEnd})\n• Distance: ${Number(summary.totalKm || 0).toFixed(1)} km\n• Travel Pay: ₹${Number(summary.travelPay || 0)}\n• Field Visits: ${summary.totalMeetings || 0}\n• Tasks: ${summary.totalTasks || 0}`,
        });
      } catch (e) {}
    }
  };

  const activityRows = [
    { label: 'Field Visits', value: summary.totalMeetings ?? 0, icon: BriefcaseBusiness, color: '#2563eb' },
    { label: 'Tasks Completed', value: summary.totalTasks ?? 0, icon: ListChecks, color: '#d97706' },
    { label: 'Leads Handled', value: summary.totalLeads ?? 0, icon: Users, color: '#0f766e' },
    { label: 'Travel Distance', value: `${Number(summary.totalKm || 0).toFixed(1)} km`, icon: MapPin, color: '#059669' },
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
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#059669" />
        <Text style={{ marginTop: 10, fontSize: 13, color: '#64748b' }}>Loading staff data…</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#074e26" />

      {/* ── EXECUTIVE TOP HEADER ── */}
      <LinearGradient
        colors={['#074e26', '#065a29']}
        style={styles.header}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.headerTitleRow}>
            <TouchableOpacity
              style={styles.headerBackBtn}
              onPress={handleGoBack}
              activeOpacity={0.7}
            >
              <ArrowLeft size={20} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.headerTitle}>Staff Activity Reports</Text>
              <Text style={styles.headerSub}>Consolidated performance & mileage analytics</Text>
            </View>
            <TouchableOpacity style={styles.headerBackBtn} onPress={onRefresh} activeOpacity={0.7}>
              <RefreshCw size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* ── SCROLLABLE BODY ── */}
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#059669']} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero Banner ── */}
        <Surface style={[styles.reportHero, cardShadow]} elevation={1}>
          <UserRound size={20} color="#059669" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.heroTitle}>Build Staff Performance Report</Text>
            <Text style={styles.heroSub}>Choose an employee and a date range to generate official activity analytics.</Text>
          </View>
        </Surface>

        {/* ── FIELD STAFF DROPDOWN SELECTOR (REQ) ── */}
        <Surface style={[styles.cardSection, cardShadow]} elevation={1}>
          <Text style={styles.sectionTitle}>SELECT FIELD STAFF MEMBER</Text>
          
          <TouchableOpacity
            style={styles.dropdownBtn}
            onPress={() => setEmpDropdownVisible(true)}
            activeOpacity={0.8}
          >
            <View style={styles.dropdownLeft}>
              {selectedEmp && getAvatarUrl(selectedEmp.avatar) ? (
                <Avatar.Image size={34} source={{ uri: getAvatarUrl(selectedEmp.avatar) }} />
              ) : (
                <View style={styles.dropdownAvatarFallback}>
                  <Text style={styles.dropdownAvatarText}>
                    {selectedEmp ? (formatFullName(selectedEmp.name) || 'E').slice(0, 2).toUpperCase() : 'SE'}
                  </Text>
                </View>
              )}
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={styles.dropdownValLabel}>Selected Staff</Text>
                <Text style={styles.dropdownValText} numberOfLines={1}>
                  {selectedEmp ? formatFullName(selectedEmp.name) : 'Tap to select employee...'}
                </Text>
              </View>
            </View>
            <ChevronDown size={18} color="#64748b" />
          </TouchableOpacity>

          {/* Quick Date Presets */}
          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>QUICK DATE PRESETS</Text>
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
                  style={[styles.presetChip, isSelected && styles.presetChipActive]}
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

          {/* Date Range Inputs */}
          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>REPORTING PERIOD</Text>
          <View style={styles.dateRow}>
            <View style={styles.dateBox}>
              <Text style={styles.dateLbl}>START DATE</Text>
              <TextInput
                style={styles.dateInput}
                value={reportStart}
                onChangeText={setReportStart}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94a3b8"
              />
            </View>
            <View style={styles.dateBox}>
              <Text style={styles.dateLbl}>END DATE</Text>
              <TextInput
                style={styles.dateInput}
                value={reportEnd}
                onChangeText={setReportEnd}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94a3b8"
              />
            </View>
          </View>

          {reportError ? <Text style={styles.errorText}>{reportError}</Text> : null}

          {/* Generate Button */}
          <TouchableOpacity
            style={[styles.generateBtn, reportLoading && { opacity: 0.6 }]}
            onPress={handleGenerateReport}
            disabled={reportLoading}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#074e26', '#065a29']}
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
                {reportLoading ? 'Generating Staff Report...' : 'Generate Official Report'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </Surface>

        {selectedEmp ? (
          <Text style={styles.selectedEmpText}>
            Report for <Text style={{ fontWeight: 'bold', color: '#0f172a' }}>{formatFullName(selectedEmp.name)}</Text> ({reportStart} to {reportEnd})
          </Text>
        ) : null}

        {/* ── RESULTS SUMMARY CARDS & EXPORT PDF ACTIONS ── */}
        {reportData ? (
          <View style={styles.resultsBlock}>
            <View style={styles.resultsHeaderRow}>
              <Text style={styles.sectionTitle}>ACTIVITY & PERFORMANCE SUMMARY</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity style={styles.pdfExportBtn} onPress={handleDownloadPDF} activeOpacity={0.8}>
                  <Download size={14} color="#ffffff" />
                  <Text style={styles.pdfExportBtnText}>Generate PDF</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.shareBtn} onPress={handleDownloadPDF} activeOpacity={0.8}>
                  <Share2 size={14} color="#059669" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.summaryGrid}>
              {activityRows.map((row) => {
                const Icon = row.icon;
                return (
                  <Surface key={row.label} style={[styles.summaryCard, cardShadow]} elevation={1}>
                    <View style={[styles.summaryIcon, { backgroundColor: `${row.color}14` }]}>
                      <Icon size={16} color={row.color} />
                    </View>
                    <Text style={styles.summaryValue}>{row.value}</Text>
                    <Text style={styles.summaryLabel}>{row.label}</Text>
                  </Surface>
                );
              })}
            </View>

            {/* Detailed Summary Card */}
            <Surface style={[styles.detailCard, cardShadow]} elevation={1}>
              <View style={styles.detailHeader}>
                <Sparkles size={16} color="#059669" />
                <Text style={styles.detailTitle}>Report Highlights & Audit Summary</Text>
              </View>
              <Text style={styles.detailText}>
                {reportData.meetings?.length || 0} visits, {reportData.tasks?.length || 0} completed tasks, {reportData.leads?.length || 0} leads, {reportData.expenses?.length || 0} expense entries and {reportData.locations?.length || 0} travel sessions logged during this period.
              </Text>
            </Surface>
          </View>
        ) : (
          <Surface style={[styles.emptyReport, cardShadow]} elevation={1}>
            <FileText size={32} color="#94a3b8" />
            <Text style={styles.emptyTitle}>No Report Generated Yet</Text>
            <Text style={styles.emptySubText}>Select a staff member from the dropdown above and tap "Generate Official Report".</Text>
          </Surface>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* ── EMPLOYEE DROPDOWN SELECTION MODAL ── */}
      <Modal
        visible={empDropdownVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEmpDropdownVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setEmpDropdownVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.dropdownSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.dropdownHeaderRow}>
              <Text style={styles.dropdownHeaderTitle}>Select Field Employee</Text>
              <TouchableOpacity onPress={() => setEmpDropdownVisible(false)}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: height * 0.5 }} showsVerticalScrollIndicator={false}>
              {employees.map((emp) => {
                const id = getEmpId(emp);
                const isSelected = String(id) === String(reportEmpId);
                const fullName = formatFullName(emp.name);
                return (
                  <TouchableOpacity
                    key={String(id)}
                    style={[styles.dropdownItem, isSelected && styles.dropdownItemActive]}
                    onPress={() => {
                      setReportEmpId(String(id));
                      setEmpDropdownVisible(false);
                    }}
                  >
                    <View style={styles.dropdownItemLeft}>
                      {getAvatarUrl(emp.avatar) ? (
                        <Avatar.Image size={38} source={{ uri: getAvatarUrl(emp.avatar) }} />
                      ) : (
                        <View style={[styles.dropdownItemAvatarFallback, isSelected && { backgroundColor: '#059669' }]}>
                          <Text style={styles.dropdownItemAvatarText}>
                            {(fullName || 'E').slice(0, 2).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={{ marginLeft: 12 }}>
                        <Text style={[styles.dropdownItemName, isSelected && { color: '#059669', fontWeight: '800' }]}>
                          {fullName}
                        </Text>
                        <Text style={styles.dropdownItemSub}>{emp.department || 'Field Services'}</Text>
                      </View>
                    </View>

                    {isSelected && <CheckCircle2 size={18} color="#059669" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },

  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 12) : 0,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 4,
  },
  headerBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: '#ffffff', fontSize: 17, fontWeight: '800', fontFamily: FONT },
  headerSub: { color: '#a7f3d0', fontSize: 10, marginTop: 1, fontWeight: '600', fontFamily: FONT },

  body: { padding: 14, paddingBottom: 30 },

  reportHero: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    padding: 12,
    marginBottom: 14,
  },
  heroTitle: { color: '#074e26', fontFamily: FONT, fontSize: 13, fontWeight: '800' },
  heroSub: { color: '#047857', fontFamily: FONT, fontSize: 11, lineHeight: 15, marginTop: 2 },
  sectionTitle: { fontFamily: FONT, fontSize: 11, fontWeight: '800', color: '#0f172a', letterSpacing: 0.5, marginBottom: 8 },

  cardSection: { backgroundColor: '#ffffff', borderRadius: 20, padding: 14, marginBottom: 14 },
  
  // Dropdown Button
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
  },
  dropdownLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  dropdownAvatarFallback: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#074e26', justifyContent: 'center', alignItems: 'center' },
  dropdownAvatarText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  dropdownValLabel: { fontSize: 9, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
  dropdownValText: { fontSize: 14, fontWeight: '800', color: '#0f172a', marginTop: 1 },

  // Date Presets
  presetRow: { flexDirection: 'row', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
  presetChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f1f5f9' },
  presetChipActive: { backgroundColor: '#074e26', borderColor: '#074e26' },
  presetText: { fontFamily: FONT, fontSize: 10, fontWeight: '700', color: '#64748b' },
  presetTextActive: { color: '#ffffff' },

  // Date Inputs
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  dateBox: { flex: 1, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, backgroundColor: '#f8fafc', padding: 10 },
  dateLbl: { fontFamily: FONT, fontSize: 8, fontWeight: '800', color: '#64748b', marginBottom: 3 },
  dateInput: { fontFamily: FONT, fontSize: 12, fontWeight: '700', color: '#0f172a', padding: 0 },

  generateBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 4 },
  generateBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  generateBtnText: { fontFamily: FONT, color: '#fff', fontWeight: '800', fontSize: 13 },
  selectedEmpText: { fontFamily: FONT, fontSize: 11, color: '#64748b', marginTop: 8, marginBottom: 12, textAlign: 'center' },
  errorText: { color: '#b91c1c', backgroundColor: '#fef2f2', borderRadius: 10, padding: 10, fontFamily: FONT, fontSize: 11, marginBottom: 8, fontWeight: '600' },

  resultsBlock: { marginTop: 10 },
  resultsHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  pdfExportBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: '#059669' },
  pdfExportBtnText: { fontFamily: FONT, fontSize: 11, fontWeight: '800', color: '#ffffff' },
  shareBtn: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0', alignItems: 'center', justifyContent: 'center' },

  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summaryCard: { width: '31.7%', minHeight: 96, borderRadius: 16, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#f1f5f9', padding: 10, justifyContent: 'center' },
  summaryIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  summaryValue: { fontFamily: FONT, fontSize: 15, fontWeight: '900', color: '#0f172a' },
  summaryLabel: { fontFamily: FONT, fontSize: 9, marginTop: 2, fontWeight: '600', color: '#64748b' },
  
  detailCard: { borderRadius: 16, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#f1f5f9', padding: 14, marginTop: 10 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  detailTitle: { fontFamily: FONT, fontSize: 12, fontWeight: '800', color: '#0f172a' },
  detailText: { fontFamily: FONT, fontSize: 11, lineHeight: 16, color: '#64748b', marginTop: 2 },

  emptyReport: { alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 20, borderWidth: 1, borderColor: '#f1f5f9', padding: 32, marginTop: 10 },
  emptyTitle: { fontFamily: FONT, fontSize: 14, fontWeight: '800', color: '#0f172a', marginTop: 10 },
  emptySubText: { fontFamily: FONT, fontSize: 11, color: '#64748b', textAlign: 'center', marginTop: 4 },

  // Dropdown Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
  dropdownSheet: { backgroundColor: '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 16, paddingBottom: 30 },
  sheetHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: '#e2e8f0', alignSelf: 'center', marginBottom: 12 },
  dropdownHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  dropdownHeaderTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 10, borderRadius: 12, marginBottom: 4 },
  dropdownItemActive: { backgroundColor: '#ecfdf5' },
  dropdownItemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  dropdownItemAvatarFallback: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#64748b', justifyContent: 'center', alignItems: 'center' },
  dropdownItemAvatarText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  dropdownItemName: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  dropdownItemSub: { fontSize: 11, color: '#64748b', marginTop: 1 },
});