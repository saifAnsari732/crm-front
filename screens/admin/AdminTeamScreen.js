import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, View, FlatList, TouchableOpacity, ActivityIndicator,
  Platform, RefreshControl, TextInput, Modal, ScrollView, Image, StatusBar, Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Surface } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Users, Search, UserCheck, Ban, Pencil, X, Check, ShieldCheck,
  ArrowLeft, Filter, Phone, Mail, CheckCircle2, ChevronRight,
  LayoutDashboard, MapPin, FileText, Settings, UserPlus, UserX, Building2
} from 'lucide-react-native';
import { adminAPI, getAvatarUrl } from '../../services/api';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';

const { width, height } = Dimensions.get('window');

const NAVY_DARK = '#0f172a';
const CARD_BG = '#1e293b';
const BG_COLOR = '#0f172a';

const cardShadow = Platform.OS === 'web'
  ? { boxShadow: '0px 6px 20px rgba(15, 26, 46, 0.12)' }
  : { elevation: 3, shadowColor: '#0f172a', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } };

const getEmployeeId = (e) => e?._id || e?.employeeId || e?.id || '';

export default function AdminTeamScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterRole, setFilterRole] = useState('all');

  // Edit Modal state
  const [editEmp, setEditEmp] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await adminAPI.getEmployees({ limit: 200, role: filterRole === 'all' ? 'all' : filterRole });
      if (res.data?.success) setEmployees(res.data.employees || []);
    } catch (e) {
      console.log('Team fetch error:', e.message);
      setEmployees([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filterRole]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchEmployees();
    setRefreshing(false);
  };

  const filtered = employees.filter((e) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    const nameMatch = (e.name || '').toLowerCase().includes(q);
    const phoneMatch = (e.phone || '').toLowerCase().includes(q);
    const deptMatch = (e.department || '').toLowerCase().includes(q);
    const emailMatch = (e.email || '').toLowerCase().includes(q);
    return nameMatch || phoneMatch || deptMatch || emailMatch;
  });

  const openEdit = (emp) => {
    setEditEmp(emp);
    setEditName(emp.name || '');
    setEditPhone(emp.phone || '');
    setEditDepartment(emp.department || '');
    setEditRole(emp.role || 'EMPLOYEE');
  };

  const handleApprove = async (id) => {
    try {
      await adminAPI.approveEmployee(id);
      fetchEmployees();
    } catch (e) {
      console.log(e);
    }
  };

  const handleToggleBlock = async (id) => {
    try {
      await adminAPI.toggleBlock(id);
      fetchEmployees();
    } catch (e) {
      console.log(e);
    }
  };

  const handleSaveEdit = async () => {
    if (!editEmp) return;
    setEditSaving(true);
    try {
      await adminAPI.updateEmployee(getEmployeeId(editEmp), {
        name: editName,
        phone: editPhone,
        department: editDepartment,
        role: editRole,
      });
      setEditEmp(null);
      fetchEmployees();
    } catch (e) {
      console.log('Edit employee error:', e.message);
    } finally {
      setEditSaving(false);
    }
  };

  const getUserInitials = (name) => {
    if (!name) return 'KC';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  };

  const goTo = (path) => {
    router.push(path);
  };

  const roleCounts = {
    all: employees.length,
    admin: employees.filter(e => ['SUPER_ADMIN', 'SUPERADMIN', 'ORG_ADMIN', 'ORGADMIN', 'ADMIN'].includes((e.role || '').toUpperCase())).length,
    manager: employees.filter(e => (e.role || '').toUpperCase() === 'MANAGER').length,
    employee: employees.filter(e => (e.role || '').toUpperCase() === 'EMPLOYEE').length,
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: BG_COLOR }]}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Loading KisanConnect Team Roster…</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#074e26" />

      {/* TOP HEADER */}
      <LinearGradient
        colors={['#074e26', '#065a29']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.topNav}>
            <TouchableOpacity style={styles.navCircleBtn} onPress={() => router.back()} activeOpacity={0.7}>
              <ArrowLeft size={20} color="#f8fafc" />
            </TouchableOpacity>

            <View style={styles.brandContainer}>
              <View style={styles.logoBadge}>
                <Image
                  source={require('../../assets/splash.png')}
                  style={styles.navbarAppIcon}
                  resizeMode="contain"
                />
              </View>
              <View>
                <Text style={styles.appName}>KisanConnect</Text>
                <Text style={styles.appTag}>WORKFORCE & TEAM ROSTER</Text>
              </View>
            </View>

            <View style={styles.topNavRight}>
              <View style={styles.countBadgeHeader}>
                <Users size={14} color="#34d399" />
                <Text style={styles.countBadgeTextHeader}>{employees.length}</Text>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* SEARCH BAR & ROLE FILTER TABS */}
      <View style={styles.filterSection}>
        <View style={styles.searchBox}>
          <Search size={17} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, phone, dept..."
            placeholderTextColor="#64748b"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={16} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.roleScroller} contentContainerStyle={{ gap: 8 }}>
          {[
            { key: 'all', label: 'All Staff' },
            { key: 'admin', label: 'Admins' },
            { key: 'manager', label: 'Managers' },
            { key: 'employee', label: 'Field Staff' },
          ].map((item) => {
            const isActive = filterRole === item.key;
            const count = roleCounts[item.key] || 0;
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.roleChip, isActive && styles.roleChipActive]}
                onPress={() => setFilterRole(item.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.roleChipText, isActive && styles.roleChipTextActive]}>
                  {item.label}
                </Text>
                <View style={[styles.chipCountBadge, isActive && styles.chipCountBadgeActive]}>
                  <Text style={[styles.chipCountText, isActive && styles.chipCountTextActive]}>{count}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* WORKFORCE LIST */}
      <FlatList
        data={filtered}
        keyExtractor={(item, idx) => getEmployeeId(item) || String(idx)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#10b981']} tintColor="#10b981" />}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <UserX size={44} color="#475569" />
            <Text style={styles.emptyText}>No workforce members found</Text>
            <Text style={styles.emptySubText}>Try adjusting search query or role filters</Text>
          </View>
        }
        renderItem={({ item: emp }) => {
          const empId = getEmployeeId(emp);
          const isApproved = emp.isApproved !== false;
          const roleUpper = (emp.role || 'EMPLOYEE').toUpperCase();
          const isBlocked = !!emp.isBlocked;
          const isLive = emp.isTracking || emp.isOnline;

          let roleBadgeBg = 'rgba(2, 132, 199, 0.15)';
          let roleBadgeText = '#38bdf8';
          if (roleUpper === 'MANAGER') {
            roleBadgeBg = 'rgba(16, 185, 129, 0.15)';
            roleBadgeText = '#34d399';
          } else if (['SUPER_ADMIN', 'SUPERADMIN', 'ORG_ADMIN', 'ORGADMIN', 'ADMIN'].includes(roleUpper)) {
            roleBadgeBg = 'rgba(139, 92, 246, 0.15)';
            roleBadgeText = '#c084fc';
          }

          return (
            <Surface style={[styles.card, cardShadow]} elevation={2}>
              <View style={styles.cardHeaderRow}>
                {/* Left Avatar & Status */}
                <View style={styles.avatarWrap}>
                  {getAvatarUrl(emp.avatar) ? (
                    <Image source={{ uri: getAvatarUrl(emp.avatar) }} style={styles.avatarImg} />
                  ) : (
                    <View style={[styles.avatarFallback, { backgroundColor: isBlocked ? '#ef4444' : '#0ea5e9' }]}>
                      <Text style={styles.avatarInitials}>{getUserInitials(emp.name)}</Text>
                    </View>
                  )}
                  <View style={[styles.statusDot, { backgroundColor: isBlocked ? '#ef4444' : isLive ? '#10b981' : '#64748b' }]} />
                </View>

                {/* Info Column */}
                <View style={styles.infoCol}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={styles.empNameText} numberOfLines={1}>{emp.name || 'Unnamed Staff'}</Text>
                    <View style={[styles.roleBadgePill, { backgroundColor: roleBadgeBg }]}>
                      <Text style={[styles.roleBadgeText, { color: roleBadgeText }]}>{roleUpper}</Text>
                    </View>
                  </View>

                  <Text style={styles.empDeptText} numberOfLines={1}>
                    {emp.department || 'Field Operations'} • {emp.designation || 'Field Executive'}
                  </Text>

                  {emp.phone ? (
                    <View style={styles.metaRow}>
                      <Phone size={12} color="#64748b" />
                      <Text style={styles.empMetaText}>{emp.phone}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Right Status Badge */}
                <View style={styles.rightStatusCol}>
                  {isBlocked ? (
                    <View style={[styles.statusTagPill, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                      <Ban size={10} color="#f87171" />
                      <Text style={[styles.statusTagText, { color: '#f87171' }]}>BLOCKED</Text>
                    </View>
                  ) : !isApproved ? (
                    <View style={[styles.statusTagPill, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                      <Text style={[styles.statusTagText, { color: '#fbbf24' }]}>PENDING</Text>
                    </View>
                  ) : (
                    <View style={[styles.statusTagPill, { backgroundColor: isLive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.15)' }]}>
                      <View style={[styles.livePulseDot, { backgroundColor: isLive ? '#10b981' : '#64748b' }]} />
                      <Text style={[styles.statusTagText, { color: isLive ? '#34d399' : '#94a3b8' }]}>
                        {isLive ? 'ACTIVE' : 'OFFLINE'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Bottom Action Buttons Row */}
              <View style={styles.cardFooterDivider} />
              <View style={styles.cardFooterActions}>
                {!isApproved && (
                  <TouchableOpacity style={[styles.actionBtn, styles.approveBtn]} onPress={() => handleApprove(empId)}>
                    <CheckCircle2 size={13} color="#ffffff" />
                    <Text style={styles.approveBtnText}>Approve Staff</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={[styles.actionBtn, styles.editBtn]} onPress={() => openEdit(emp)} activeOpacity={0.75}>
                  <Pencil size={13} color="#60a5fa" />
                  <Text style={styles.editBtnText}>Edit Info</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, isBlocked ? styles.unblockBtn : styles.blockBtn]}
                  onPress={() => handleToggleBlock(empId)}
                  activeOpacity={0.75}
                >
                  {isBlocked ? (
                    <>
                      <UserCheck size={13} color="#34d399" />
                      <Text style={styles.unblockBtnText}>Unblock</Text>
                    </>
                  ) : (
                    <>
                      <Ban size={13} color="#f43f5e" />
                      <Text style={styles.blockBtnText}>Block</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </Surface>
          );
        }}
      />

      {/* FLOATING BOTTOM TAB BAR (UI/UX PRO MAX) */}
      <View style={styles.bottomTabBarContainer}>
        <Surface style={styles.bottomTabBarSurface} elevation={5}>
          <TouchableOpacity style={styles.tabBarItem} onPress={() => goTo('/(admin)/dashboard')} activeOpacity={0.7}>
            <View style={styles.tabBarIconBox}>
              <LayoutDashboard size={20} color="#94a3b8" />
            </View>
            <Text style={styles.tabBarLabel}>Home</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.tabBarItem} onPress={() => goTo('/(admin)/tracking')} activeOpacity={0.7}>
            <View style={styles.tabBarIconBox}>
              <MapPin size={20} color="#94a3b8" />
            </View>
            <Text style={styles.tabBarLabel}>Live Map</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.tabBarItem} onPress={() => goTo('/(admin)/team')} activeOpacity={0.7}>
            <View style={[styles.tabBarIconBox, styles.tabBarIconBoxActive]}>
              <Users size={20} color="#10b981" />
            </View>
            <Text style={[styles.tabBarLabel, styles.tabBarLabelActive]}>Workforce</Text>
            <View style={styles.activeTabDot} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.tabBarItem} onPress={() => goTo('/(admin)/reports')} activeOpacity={0.7}>
            <View style={styles.tabBarIconBox}>
              <FileText size={20} color="#94a3b8" />
            </View>
            <Text style={styles.tabBarLabel}>Reports</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.tabBarItem} onPress={() => goTo('/(admin)/settings')} activeOpacity={0.7}>
            <View style={styles.tabBarIconBox}>
              <Settings size={20} color="#94a3b8" />
            </View>
            <Text style={styles.tabBarLabel}>Settings</Text>
          </TouchableOpacity>
        </Surface>
      </View>

      {/* EDIT EMPLOYEE MODAL */}
      <Modal visible={!!editEmp} transparent animationType="slide" onRequestClose={() => setEditEmp(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setEditEmp(null)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.modalIconBox}>
                  <Pencil size={18} color="#38bdf8" />
                </View>
                <Text style={styles.modalTitle}>Edit Staff Details</Text>
              </View>
              <TouchableOpacity onPress={() => setEditEmp(null)}>
                <X size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: height * 0.6 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>FULL NAME *</Text>
              <TextInput style={styles.fieldInput} value={editName} onChangeText={setEditName} placeholder="Enter full name" placeholderTextColor="#64748b" />

              <Text style={styles.fieldLabel}>PHONE NUMBER *</Text>
              <TextInput style={styles.fieldInput} value={editPhone} onChangeText={setEditPhone} keyboardType="phone-pad" placeholder="Enter phone number" placeholderTextColor="#64748b" />

              <Text style={styles.fieldLabel}>DEPARTMENT</Text>
              <TextInput style={styles.fieldInput} value={editDepartment} onChangeText={setEditDepartment} placeholder="Field Sales / Operations" placeholderTextColor="#64748b" />

              <Text style={styles.fieldLabel}>ASSIGNED ROLE</Text>
              <View style={styles.rolePickerRow}>
                {['EMPLOYEE', 'MANAGER', 'ADMIN'].map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.rolePickBtn, editRole.toUpperCase() === r && styles.rolePickBtnActive]}
                    onPress={() => setEditRole(r)}
                  >
                    <Text style={[styles.rolePickText, editRole.toUpperCase() === r && styles.rolePickTextActive]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity style={[styles.saveBtn, editSaving && { opacity: 0.6 }]} onPress={handleSaveEdit} disabled={editSaving}>
              {editSaving ? <ActivityIndicator color="#0f172a" size="small" /> : <Check size={18} color="#0f172a" />}
              <Text style={styles.saveBtnText}>{editSaving ? 'Updating Staff…' : 'Save Changes'}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG_COLOR },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#94a3b8', fontSize: 13, marginTop: 10 },

  // Header
  headerGradient: { paddingTop: Platform.OS === 'ios' ? 0 : 0, paddingBottom: 16 },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 8 : 12,
  },
  navCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  navbarAppIcon: { width: '100%', height: '100%' },
  appName: { fontSize: 17, fontWeight: '800', color: '#ffffff', letterSpacing: 0.3 },
  appTag: { fontSize: 9, fontWeight: '700', color: '#6ee7b7', letterSpacing: 0.8 },
  topNavRight: { flexDirection: 'row', alignItems: 'center' },
  countBadgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  countBadgeTextHeader: { color: '#34d399', fontSize: 12, fontWeight: '800' },

  // Filter & Search Section
  filterSection: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    gap: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 44,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 13, color: '#f8fafc', paddingVertical: 0 },
  roleScroller: { flexGrow: 0 },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  roleChipActive: { backgroundColor: '#059669', borderColor: '#10b981' },
  roleChipText: { fontSize: 12, fontWeight: '600', color: '#94a3b8' },
  roleChipTextActive: { color: '#ffffff', fontWeight: '700' },
  chipCountBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  chipCountBadgeActive: { backgroundColor: 'rgba(255, 255, 255, 0.25)' },
  chipCountText: { fontSize: 10, fontWeight: '700', color: '#94a3b8' },
  chipCountTextActive: { color: '#ffffff' },

  // List Container
  listContainer: { padding: 14, paddingBottom: 110 },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 14,
    marginBottom: 12,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  avatarWrap: { position: 'relative', marginRight: 12 },
  avatarImg: { width: 48, height: 48, borderRadius: 14 },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  statusDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#1e293b',
  },
  infoCol: { flex: 1, justifyContent: 'center' },
  empNameText: { fontSize: 15, fontWeight: '800', color: '#f8fafc' },
  roleBadgePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  roleBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  empDeptText: { fontSize: 11, color: '#94a3b8', marginTop: 3, fontWeight: '500' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  empMetaText: { fontSize: 11, color: '#64748b' },

  rightStatusCol: { alignItems: 'flex-end', justifyContent: 'center' },
  statusTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  livePulseDot: { width: 6, height: 6, borderRadius: 3 },
  statusTagText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },

  cardFooterDivider: { height: 1, backgroundColor: 'rgba(255, 255, 255, 0.06)', marginVertical: 12 },
  cardFooterActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },

  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  approveBtn: { backgroundColor: '#10b981', flex: 1, justifyContent: 'center' },
  approveBtnText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
  editBtn: { backgroundColor: 'rgba(59, 130, 246, 0.15)' },
  editBtnText: { color: '#60a5fa', fontSize: 11, fontWeight: '700' },
  blockBtn: { backgroundColor: 'rgba(244, 63, 94, 0.15)' },
  blockBtnText: { color: '#f43f5e', fontSize: 11, fontWeight: '700' },
  unblockBtn: { backgroundColor: 'rgba(16, 185, 129, 0.15)' },
  unblockBtnText: { color: '#34d399', fontSize: 11, fontWeight: '700' },

  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { color: '#f8fafc', fontSize: 15, fontWeight: '700', marginTop: 12 },
  emptySubText: { color: '#64748b', fontSize: 12, marginTop: 4 },

  // Bottom Navigation Bar
  bottomTabBarContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 28 : 20,
    left: 16,
    right: 16,
    zIndex: 999,
  },
  bottomTabBarSurface: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  tabBarItem: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  tabBarIconBox: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  tabBarIconBoxActive: { backgroundColor: '#ecfdf5' },
  tabBarLabel: { fontSize: 10, fontWeight: '600', color: '#64748b', marginTop: 2 },
  tabBarLabelActive: { color: '#059669', fontWeight: '800' },
  activeTabDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#059669', marginTop: 2 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.75)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#475569', alignSelf: 'center', marginBottom: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(56, 189, 248, 0.15)', alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#f8fafc' },
  fieldLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, color: '#94a3b8', marginTop: 14, marginBottom: 6 },
  fieldInput: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: '#0f172a',
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#f8fafc',
  },
  rolePickerRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  rolePickBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: '#0f172a',
    alignItems: 'center',
  },
  rolePickBtnActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
  rolePickText: { fontSize: 11, fontWeight: '700', color: '#94a3b8' },
  rolePickTextActive: { color: '#ffffff' },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10b981',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 20,
  },
  saveBtnText: { color: '#0f172a', fontWeight: '800', fontSize: 14 },
});