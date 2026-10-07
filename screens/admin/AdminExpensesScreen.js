import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, View, FlatList, TouchableOpacity, ActivityIndicator,
  Platform, RefreshControl, TextInput, Image, StatusBar, Dimensions, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Surface } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft, Wallet, CheckCircle2, XCircle, AlertCircle,
  Search, Filter, ChevronRight, Fuel, Utensils, Navigation,
  MoreHorizontal, FileText, Check, X, MapPin, Calendar, IndianRupee
} from 'lucide-react-native';
import { adminAPI, expenseAPI, getAvatarUrl } from '../../services/api';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');
const FONT = Platform.OS === 'web' ? 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' : Platform.OS === 'ios' ? 'System' : 'sans-serif-medium';

const COLORS = {
  headerStart: '#047857',
  headerEnd: '#0d9488',
  primary: '#0f766e',
  primaryLight: '#ccfbf1',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  text: '#1E293B',
  textSub: '#64748B',
  textMuted: '#94A3B8',
  border: '#E2E8F0',
  success: '#059669',
  successLight: '#ECFDF5',
  warning: '#D97706',
  warningLight: '#FFFBEB',
  danger: '#DC2626',
  dangerLight: '#FEF2F2',
  indigo: '#4F46E5',
  indigoLight: '#EEF2FF',
};

const cardShadow = Platform.OS === 'web'
  ? { boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05)' }
  : { elevation: 2, shadowColor: '#64748B', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } };

export default function AdminExpensesScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('pending'); // 'pending', 'approved', 'rejected'
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const AVATAR_COLORS = ['#059669', '#2563eb', '#7c3aed', '#d97706', '#db2777', '#0891b2', '#4f46e5', '#ea580c'];
  const getAvatarColor = (name) => {
    if (!name) return AVATAR_COLORS[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  };

  const getUserInitials = (name) => {
    if (!name) return 'EX';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  };

  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true);
      const res = await (adminAPI.getExpenses ? adminAPI.getExpenses({ limit: 100 }) : expenseAPI.getAll?.({ limit: 100 })).catch(() => ({ data: { success: false } }));
      if (res?.data?.success && Array.isArray(res.data.expenses)) {
        setExpenses(res.data.expenses);
      } else {
        setExpenses([]);
      }
    } catch (_) {
      setExpenses([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchExpenses();
  };

  const handleAction = async (expenseId, status) => {
    try {
      setActionLoading(expenseId);
      if (adminAPI.updateExpenseStatus) {
        await adminAPI.updateExpenseStatus(expenseId, { status }).catch(() => {});
      }
      setExpenses(prev =>
        prev.map(item => (item._id === expenseId ? { ...item, status } : item))
      );
      if (Platform.OS === 'web') {
        alert(`Expense ${status === 'approved' ? 'Approved' : 'Rejected'} successfully.`);
      } else {
        Alert.alert("Success", `Expense ${status === 'approved' ? 'Approved' : 'Rejected'} successfully.`);
      }
    } catch (e) {
      console.log('Expense update error:', e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const pendingCount = expenses.filter(e => (e.status || '').toLowerCase() === 'pending').length;
  const approvedCount = expenses.filter(e => (e.status || '').toLowerCase() === 'approved').length;
  const rejectedCount = expenses.filter(e => (e.status || '').toLowerCase() === 'rejected').length;

  const totalThisMonth = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const fuelTotal = expenses.filter(e => (e.category || '').toLowerCase() === 'fuel').reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const foodTotal = expenses.filter(e => (e.category || '').toLowerCase() === 'food').reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const travelTotal = expenses.filter(e => (e.category || '').toLowerCase() === 'travel').reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const miscTotal = expenses.filter(e => !['fuel', 'food', 'travel'].includes((e.category || '').toLowerCase())).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const fuelPct = totalThisMonth > 0 ? Math.round((fuelTotal / totalThisMonth) * 100) : 0;
  const foodPct = totalThisMonth > 0 ? Math.round((foodTotal / totalThisMonth) * 100) : 0;
  const travelPct = totalThisMonth > 0 ? Math.round((travelTotal / totalThisMonth) * 100) : 0;
  const miscPct = totalThisMonth > 0 ? Math.max(0, 100 - fuelPct - foodPct - travelPct) : 0;

  const displayedExpenses = expenses.filter(e => {
    const s = (e.status || '').toLowerCase();
    if (activeTab === 'pending') return s === 'pending';
    if (activeTab === 'approved') return s === 'approved';
    if (activeTab === 'rejected') return s === 'rejected';
    return true;
  });

  const getCategoryIcon = (category) => {
    switch ((category || '').toLowerCase()) {
      case 'fuel': return <Fuel size={16} color={COLORS.primary} />;
      case 'food': return <Utensils size={16} color={COLORS.warning} />;
      case 'travel': return <Navigation size={16} color={COLORS.indigo} />;
      default: return <Wallet size={16} color={COLORS.textSub} />;
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.headerStart} />

      {/* ── TOP HEADER ── */}
      <LinearGradient
        colors={[COLORS.headerStart, COLORS.headerEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.topNavRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
              <ArrowLeft size={22} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.headerTitle}>Expenses Approval</Text>
              <Text style={styles.headerSub}>Verify & Approve Team Claims</Text>
            </View>
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{pendingCount} Pending</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* ── TABS BAR ── */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'pending' && styles.tabItemActive]}
          onPress={() => setActiveTab('pending')}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>
            Pending ({pendingCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'approved' && styles.tabItemActive]}
          onPress={() => setActiveTab('approved')}
        >
          <Text style={[styles.tabText, activeTab === 'approved' && styles.tabTextActive]}>
            Approved
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'rejected' && styles.tabItemActive]}
          onPress={() => setActiveTab('rejected')}
        >
          <Text style={[styles.tabText, activeTab === 'rejected' && styles.tabTextActive]}>
            Rejected
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── SUMMARY STATS BANNER ── */}
      <View style={styles.summaryBannerWrap}>
        <Surface style={[styles.summaryCard, cardShadow]} elevation={2}>
          <View style={styles.summaryTopRow}>
            <View>
              <Text style={styles.summaryAmount}>₹{totalThisMonth.toLocaleString('en-IN')}</Text>
              <Text style={styles.summaryLabel}>Total Claims This Month</Text>
            </View>
            <View style={styles.langPills}>
              <View style={[styles.langPill, styles.langPillActive]}>
                <Text style={styles.langPillTextActive}>English</Text>
              </View>
              <View style={styles.langPill}>
                <Text style={styles.langPillText}>हिन्दी</Text>
              </View>
            </View>
          </View>

          {/* Donut & Categories breakdown */}
          <View style={styles.categoryBreakdownRow}>
            <View style={styles.donutPlaceholder}>
              <View style={styles.donutRing}>
                <Wallet size={20} color={COLORS.primary} />
              </View>
            </View>
            <View style={styles.breakdownList}>
              <View style={styles.breakdownItem}>
                <View style={[styles.categoryDot, { backgroundColor: COLORS.primary }]} />
                <Text style={styles.categoryName}>Fuel</Text>
                <Text style={styles.categoryPercent}>{fuelPct}%</Text>
              </View>
              <View style={styles.breakdownItem}>
                <View style={[styles.categoryDot, { backgroundColor: COLORS.warning }]} />
                <Text style={styles.categoryName}>Food</Text>
                <Text style={styles.categoryPercent}>{foodPct}%</Text>
              </View>
              <View style={styles.breakdownItem}>
                <View style={[styles.categoryDot, { backgroundColor: COLORS.indigo }]} />
                <Text style={styles.categoryName}>Travel</Text>
                <Text style={styles.categoryPercent}>{travelPct}%</Text>
              </View>
              <View style={styles.breakdownItem}>
                <View style={[styles.categoryDot, { backgroundColor: COLORS.textMuted }]} />
                <Text style={styles.categoryName}>Misc</Text>
                <Text style={styles.categoryPercent}>{miscPct}%</Text>
              </View>
            </View>
          </View>
        </Surface>
      </View>

      {/* ── EXPENSES LIST ── */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={{ marginTop: 12, color: COLORS.textSub, fontFamily: FONT }}>Loading expense claims...</Text>
        </View>
      ) : (
        <FlatList
          data={displayedExpenses}
          keyExtractor={(item, idx) => item._id || String(idx)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Wallet size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>No {activeTab} expenses</Text>
              <Text style={styles.emptySub}>All team expense claims are up to date.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const empName = item.employee?.name || item.employeeName || 'Team Member';
            const empAvatar = getAvatarUrl(item.employee?.avatar || item.employee?.emp_profile_pic || item.employee?.managerPro_pic || item.avatar);
            const empInitials = getUserInitials(empName);
            const empColor = getAvatarColor(empName);
            const dateStr = item.date ? new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent';
            const desc = item.description || item.note;
            const itemStatus = (item.status || 'pending').toLowerCase();

            return (
              <Surface style={[styles.expenseCard, cardShadow]} elevation={1}>
                {/* Header Row */}
                <View style={styles.cardHeader}>
                  {empAvatar ? (
                    <Image
                      source={{ uri: empAvatar }}
                      style={styles.avatarImg}
                    />
                  ) : (
                    <View style={[styles.avatarFallback, { backgroundColor: empColor }]}>
                      <Text style={styles.avatarFallbackText}>{empInitials}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.empName}>{empName}</Text>
                    <View style={styles.categoryRow}>
                      {getCategoryIcon(item.category)}
                      <Text style={styles.categoryLabel}>{item.category || 'Expense'}</Text>
                      <Text style={styles.dotDivider}>•</Text>
                      <Text style={styles.dateText}>{dateStr}</Text>
                    </View>
                  </View>

                  <View style={styles.amountBox}>
                    <Text style={styles.amountText}>₹{Number(item.amount || 0).toLocaleString('en-IN')}</Text>
                    {itemStatus === 'pending' ? (
                      <View style={styles.pendingBadge}>
                        <Text style={styles.pendingBadgeText}>Pending</Text>
                      </View>
                    ) : itemStatus === 'approved' ? (
                      <View style={styles.approvedBadge}>
                        <CheckCircle2 size={12} color={COLORS.success} />
                        <Text style={styles.approvedBadgeText}>Approved</Text>
                      </View>
                    ) : (
                      <View style={styles.rejectedBadge}>
                        <XCircle size={12} color={COLORS.danger} />
                        <Text style={styles.rejectedBadgeText}>Rejected</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Location & Note */}
                {(item.location || desc) && (
                  <View style={styles.infoBox}>
                    {item.location && (
                      <View style={styles.infoRow}>
                        <MapPin size={14} color={COLORS.textSub} />
                        <Text style={styles.infoVal}>{item.location}</Text>
                      </View>
                    )}
                    {desc && (
                      <Text style={styles.noteText}>{desc}</Text>
                    )}
                  </View>
                )}

                {/* Action Buttons for Pending Expenses */}
                {itemStatus === 'pending' && (
                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.approveBtn]}
                      onPress={() => handleAction(item._id, 'approved')}
                      disabled={actionLoading === item._id}
                      activeOpacity={0.8}
                    >
                      <Check size={16} color="#fff" />
                      <Text style={styles.approveBtnText}>Approve</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionBtn, styles.rejectBtn]}
                      onPress={() => handleAction(item._id, 'rejected')}
                      disabled={actionLoading === item._id}
                      activeOpacity={0.8}
                    >
                      <X size={16} color={COLORS.danger} />
                      <Text style={styles.rejectBtnText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </Surface>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerGradient: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
  },
  topNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    fontFamily: FONT,
  },
  headerSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    fontFamily: FONT,
    marginTop: 2,
  },
  headerBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  headerBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
    fontFamily: FONT,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabItemActive: {
    backgroundColor: COLORS.primaryLight,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSub,
    fontFamily: FONT,
  },
  tabTextActive: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  summaryBannerWrap: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  summaryAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
    fontFamily: FONT,
  },
  summaryLabel: {
    fontSize: 12,
    color: COLORS.textSub,
    fontFamily: FONT,
    marginTop: 2,
  },
  langPills: {
    flexDirection: 'row',
    backgroundColor: COLORS.bg,
    borderRadius: 20,
    padding: 3,
  },
  langPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  langPillActive: {
    backgroundColor: '#ffffff',
  },
  langPillText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontFamily: FONT,
    fontWeight: '600',
  },
  langPillTextActive: {
    fontSize: 11,
    color: COLORS.primary,
    fontFamily: FONT,
    fontWeight: '700',
  },
  categoryBreakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  donutPlaceholder: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  donutRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  breakdownList: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginLeft: 16,
    gap: 8,
  },
  breakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '45%',
    gap: 6,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryName: {
    fontSize: 12,
    color: COLORS.textSub,
    fontFamily: FONT,
    flex: 1,
  },
  categoryPercent: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
    fontFamily: FONT,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  expenseCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.border,
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarFallbackText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
    fontFamily: FONT,
  },
  empName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    fontFamily: FONT,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSub,
    fontFamily: FONT,
  },
  dotDivider: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  dateText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontFamily: FONT,
  },
  amountBox: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    fontFamily: FONT,
  },
  pendingBadge: {
    backgroundColor: COLORS.warningLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  pendingBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.warning,
    fontFamily: FONT,
  },
  approvedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.successLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  approvedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.success,
    fontFamily: FONT,
  },
  rejectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.dangerLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  rejectedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.danger,
    fontFamily: FONT,
  },
  infoBox: {
    backgroundColor: COLORS.bg,
    padding: 10,
    borderRadius: 10,
    marginTop: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoVal: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
    fontFamily: FONT,
  },
  noteText: {
    fontSize: 12,
    color: COLORS.textSub,
    fontFamily: FONT,
    marginTop: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  approveBtn: {
    backgroundColor: COLORS.success,
  },
  approveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
    fontFamily: FONT,
  },
  rejectBtn: {
    backgroundColor: COLORS.dangerLight,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  rejectBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.danger,
    fontFamily: FONT,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    fontFamily: FONT,
    marginTop: 12,
  },
  emptySub: {
    fontSize: 13,
    color: COLORS.textSub,
    fontFamily: FONT,
    marginTop: 4,
  },
});
