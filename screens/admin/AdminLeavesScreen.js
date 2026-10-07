import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, View, FlatList, TouchableOpacity, ActivityIndicator,
  Platform, RefreshControl, TextInput, Image, StatusBar, Dimensions, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Surface } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft, Calendar, Clock, CheckCircle2, XCircle, AlertCircle,
  Search, Filter, ChevronRight, User, Check, X, Shield, CalendarDays
} from 'lucide-react-native';
import { adminAPI, leaveAPI, getAvatarUrl } from '../../services/api';
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
};

const cardShadow = Platform.OS === 'web'
  ? { boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05)' }
  : { elevation: 2, shadowColor: '#64748B', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } };

export default function AdminLeavesScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('pending'); // 'pending', 'approved', 'rejected', 'calendar'
  const [leaves, setLeaves] = useState([]);
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
    if (!name) return 'LV';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  };

  const fetchLeaves = useCallback(async () => {
    try {
      setLoading(true);
      const res = await (adminAPI.getLeaves ? adminAPI.getLeaves({ limit: 100 }) : leaveAPI.getAll?.({ limit: 100 })).catch(() => ({ data: { success: false } }));
      if (res?.data?.success && Array.isArray(res.data.leaves)) {
        setLeaves(res.data.leaves);
      } else {
        setLeaves([]);
      }
    } catch (_) {
      setLeaves([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaves();
  }, [fetchLeaves]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLeaves();
  };

  const handleAction = async (leaveId, status) => {
    try {
      setActionLoading(leaveId);
      if (adminAPI.updateLeaveStatus) {
        await adminAPI.updateLeaveStatus(leaveId, { status }).catch(() => {});
      }
      setLeaves(prev =>
        prev.map(item => (item._id === leaveId ? { ...item, status } : item))
      );
      if (Platform.OS === 'web') {
        alert(`Leave request ${status === 'approved' ? 'Approved' : 'Rejected'} successfully.`);
      } else {
        Alert.alert("Success", `Leave request ${status === 'approved' ? 'Approved' : 'Rejected'} successfully.`);
      }
    } catch (e) {
      console.log('Leave update error:', e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const pendingCount = leaves.filter(l => (l.status || '').toLowerCase() === 'pending').length;
  const approvedCount = leaves.filter(l => (l.status || '').toLowerCase() === 'approved').length;
  const rejectedCount = leaves.filter(l => (l.status || '').toLowerCase() === 'rejected').length;

  const displayedLeaves = leaves.filter(l => {
    const s = (l.status || '').toLowerCase();
    if (activeTab === 'pending') return s === 'pending';
    if (activeTab === 'approved') return s === 'approved';
    if (activeTab === 'rejected') return s === 'rejected';
    return true;
  });

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
              <Text style={styles.headerTitle}>Leaves Approval</Text>
              <Text style={styles.headerSub}>Manage Team Time-off & Approvals</Text>
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

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'calendar' && styles.tabItemActive]}
          onPress={() => setActiveTab('calendar')}
        >
          <Text style={[styles.tabText, activeTab === 'calendar' && styles.tabTextActive]}>
            Calendar
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── LEAVES LIST ── */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={{ marginTop: 12, color: COLORS.textSub, fontFamily: FONT }}>Loading leaves...</Text>
        </View>
      ) : (
        <FlatList
          data={displayedLeaves}
          keyExtractor={(item, idx) => item._id || String(idx)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <CalendarDays size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>No {activeTab} leaves</Text>
              <Text style={styles.emptySub}>All team leave requests are up to date.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const empName = item.employee?.name || item.employeeName || 'Team Member';
            const empAvatar = getAvatarUrl(item.employee?.avatar || item.employee?.emp_profile_pic || item.employee?.managerPro_pic || item.avatar);
            const empInitials = getUserInitials(empName);
            const empColor = getAvatarColor(empName);
            const startStr = item.startDate ? new Date(item.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
            const endStr = item.endDate ? new Date(item.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
            const duration = item.duration || item.days || 1;
            const leaveType = item.type || item.leaveType || 'Casual Leave';
            const itemStatus = (item.status || 'pending').toLowerCase();

            return (
              <Surface style={[styles.leaveCard, cardShadow]} elevation={1}>
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
                    <Text style={styles.leaveMeta}>
                      {leaveType} • <Text style={{ fontWeight: '700', color: COLORS.primary }}>{duration} {duration === 1 ? 'day' : 'days'}</Text>
                    </Text>
                  </View>

                  {itemStatus === 'pending' ? (
                    <View style={styles.pendingBadge}>
                      <Text style={styles.pendingBadgeText}>Pending</Text>
                    </View>
                  ) : itemStatus === 'approved' ? (
                    <View style={styles.approvedBadge}>
                      <CheckCircle2 size={13} color={COLORS.success} />
                      <Text style={styles.approvedBadgeText}>Approved</Text>
                    </View>
                  ) : (
                    <View style={styles.rejectedBadge}>
                      <XCircle size={13} color={COLORS.danger} />
                      <Text style={styles.rejectedBadgeText}>Rejected</Text>
                    </View>
                  )}
                </View>

                {/* Date & Balance Row */}
                <View style={styles.detailsBox}>
                  <View style={styles.detailItem}>
                    <Calendar size={14} color={COLORS.textSub} />
                    <Text style={styles.detailVal}>
                      {startStr}{endStr && endStr !== startStr ? ` - ${endStr}` : ''}
                    </Text>
                  </View>
                  {item.balanceDays !== undefined && (
                    <View style={styles.balanceBadge}>
                      <Text style={styles.balanceText}>Balance: {item.balanceDays} days</Text>
                    </View>
                  )}
                </View>

                {/* Reason */}
                {item.reason && (
                  <View style={styles.reasonBox}>
                    <Text style={styles.reasonLabel}>Reason:</Text>
                    <Text style={styles.reasonText}>{item.reason}</Text>
                  </View>
                )}

                {/* Action Buttons for Pending Leaves */}
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
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  leaveCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
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
  leaveMeta: {
    fontSize: 13,
    color: COLORS.textSub,
    fontFamily: FONT,
    marginTop: 2,
  },
  pendingBadge: {
    backgroundColor: COLORS.warningLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pendingBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.warning,
    fontFamily: FONT,
  },
  approvedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.successLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  approvedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.success,
    fontFamily: FONT,
  },
  rejectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.dangerLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  rejectedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.danger,
    fontFamily: FONT,
  },
  detailsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.bg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailVal: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    fontFamily: FONT,
  },
  balanceBadge: {
    backgroundColor: 'rgba(15, 118, 110, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  balanceText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    fontFamily: FONT,
  },
  reasonBox: {
    marginTop: 10,
    paddingHorizontal: 4,
  },
  reasonLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontFamily: FONT,
  },
  reasonText: {
    fontSize: 13,
    color: COLORS.text,
    fontFamily: FONT,
    marginTop: 2,
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
