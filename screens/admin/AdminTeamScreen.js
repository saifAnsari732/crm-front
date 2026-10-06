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
  LayoutDashboard, MapPin, FileText, Settings, UserPlus, UserX, Building2,
  Briefcase, Sparkles, Route
} from 'lucide-react-native';
import { adminAPI, getAvatarUrl } from '../../services/api';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';

const { width, height } = Dimensions.get('window');
const FONT = Platform.OS === 'ios' ? 'System' : 'sans-serif-medium';

const cardShadow = Platform.OS === 'web'
  ? { boxShadow: '0px 4px 16px rgba(15, 23, 42, 0.08)' }
  : { elevation: 2, shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } };

const getEmployeeId = (e) => e?._id || e?.employeeId || e?.id || '';

export default function AdminTeamScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { theme } = useSettings();
  const isDark = theme === 'dark';

  const C = {
    bg: isDark ? '#0f172a' : '#f8fafc',
    surface: isDark ? '#1e293b' : '#ffffff',
    surfaceSecondary: isDark ? '#172033' : '#f1f5f9',
    text: isDark ? '#f8fafc' : '#0f172a',
    textSub: isDark ? '#94a3b8' : '#64748b',
    textMuted: isDark ? '#64748b' : '#94a3b8',
    border: isDark ? '#334155' : '#e2e8f0',
    borderLight: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
    primary: '#0f766e',
    primaryDark: '#0a3d3c',
    primaryLight: isDark ? '#134e4a' : '#ccfbf1',
    primaryText: isDark ? '#2dd4bf' : '#0f766e',
    accent: '#059669',
  };

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
      <View style={[styles.center, { backgroundColor: C.bg }]}>
        <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
        <View style={styles.loadingBrandCard}>
          <View style={styles.loadingLogoBadge}>
            <Image
              source={require('../../assets/splash.png')}
              style={styles.loadingLogoImg}
              resizeMode="contain"
            />
          </View>
          <ActivityIndicator size="small" color="#059669" style={{ marginTop: 14 }} />
          <Text style={[styles.loadingBrandTitle, { color: C.text }]}>KisanConnect</Text>
          <Text style={[styles.loadingBrandSub, { color: C.textSub }]}>Loading Workforce Directory…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      <StatusBar barStyle="light-content" backgroundColor="#064e3b" />

      {/* TOP HEADER - Premium Emerald Gradient */}
      <LinearGradient
        colors={['#064e3b', '#0f766e']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.topNav}>
            <TouchableOpacity style={styles.navCircleBtn} onPress={() => router.back()} activeOpacity={0.75}>
              <ArrowLeft size={20} color="#ffffff" />
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
                <Users size={14} color="#a7f3d0" />
                <Text style={styles.countBadgeTextHeader}>{employees.length} Staff</Text>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* SEARCH BAR & FILTER PILLS */}
      <View style={[styles.filterSection, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
        <View style={[styles.searchBox, { backgroundColor: C.surfaceSecondary, borderColor: C.border }]}>
          <Search size={18} color={C.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: C.text }]}
            placeholder="Search by name, phone, dept..."
            placeholderTextColor={C.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={16} color={C.textMuted} />
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
                style={[
                  styles.roleChip,
                  {
                    backgroundColor: isActive ? C.primary : C.surfaceSecondary,
                    borderColor: isActive ? C.primary : C.border,
                  }
                ]}
                onPress={() => setFilterRole(item.key)}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.roleChipText,
                  { color: isActive ? '#ffffff' : C.textSub, fontWeight: isActive ? '700' : '600' }
                ]}>
                  {item.label}
                </Text>
                <View style={[
                  styles.chipCountBadge,
                  { backgroundColor: isActive ? 'rgba(255, 255, 255, 0.25)' : isDark ? '#334155' : '#e2e8f0' }
                ]}>
                  <Text style={[
                    styles.chipCountText,
                    { color: isActive ? '#ffffff' : C.textSub }
                  ]}>
                    {count}
                  </Text>
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.primary]} tintColor={C.primary} />}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={[styles.emptyIconCircle, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
              <UserX size={36} color={C.textMuted} />
            </View>
            <Text style={[styles.emptyText, { color: C.text }]}>No workforce members found</Text>
            <Text style={[styles.emptySubText, { color: C.textSub }]}>Try adjusting your search query or role filter</Text>
          </View>
        }
        renderItem={({ item: emp }) => {
          const empId = getEmployeeId(emp);
          const isApproved = emp.isApproved !== false;
          const roleUpper = (emp.role || 'EMPLOYEE').toUpperCase();
          const isBlocked = !!emp.isBlocked;
          const isLive = emp.isTracking || emp.isOnline;

          // Semantic Role Styling
          let roleBg = isDark ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff';
          let roleColor = isDark ? '#60a5fa' : '#2563eb';
          let roleBorder = isDark ? 'rgba(59, 130, 246, 0.3)' : '#bfdbfe';

          if (roleUpper === 'MANAGER') {
            roleBg = isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5';
            roleColor = isDark ? '#34d399' : '#059669';
            roleBorder = isDark ? 'rgba(16, 185, 129, 0.3)' : '#a7f3d0';
          } else if (['SUPER_ADMIN', 'SUPERADMIN', 'ORG_ADMIN', 'ORGADMIN', 'ADMIN'].includes(roleUpper)) {
            roleBg = isDark ? 'rgba(139, 92, 246, 0.15)' : '#f5f3ff';
            roleColor = isDark ? '#c084fc' : '#7c3aed';
            roleBorder = isDark ? 'rgba(139, 92, 246, 0.3)' : '#ddd6fe';
          }

          return (
            <Surface style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }, cardShadow]} elevation={1}>
              <View style={styles.cardHeaderRow}>
                {/* Left Avatar & Status Dot */}
                <View style={styles.avatarWrap}>
                  {getAvatarUrl(emp.avatar) ? (
                    <Image source={{ uri: getAvatarUrl(emp.avatar) }} style={styles.avatarImg} />
                  ) : (
                    <View style={[styles.avatarFallback, { backgroundColor: isBlocked ? '#f43f5e' : isLive ? '#0f766e' : '#64748b' }]}>
                      <Text style={styles.avatarInitials}>{getUserInitials(emp.name)}</Text>
                    </View>
                  )}
                  <View style={[
                    styles.statusDot,
                    {
                      backgroundColor: isBlocked ? '#ef4444' : isLive ? '#10b981' : '#94a3b8',
                      borderColor: C.surface
                    }
                  ]} />
                </View>

                {/* Staff Info */}
                <View style={styles.infoCol}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.empNameText, { color: C.text }]} numberOfLines={1}>
                      {emp.name || 'Unnamed Staff'}
                    </Text>
                    <View style={[styles.roleBadgePill, { backgroundColor: roleBg, borderColor: roleBorder }]}>
                      <Text style={[styles.roleBadgeText, { color: roleColor }]}>{roleUpper}</Text>
                    </View>
                  </View>

                  <Text style={[styles.empDeptText, { color: C.textSub }]} numberOfLines={1}>
                    {emp.department || 'Field Services'} • {emp.designation || 'Field Executive'}
                  </Text>

                  {emp.phone ? (
                    <View style={styles.metaRow}>
                      <Phone size={12} color={C.textMuted} />
                      <Text style={[styles.empMetaText, { color: C.textSub }]}>{emp.phone}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Right Status Indicator */}
                <View style={styles.rightStatusCol}>
                  {isBlocked ? (
                    <View style={[styles.statusTagPill, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2', borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#fecaca' }]}>
                      <Ban size={11} color="#ef4444" />
                      <Text style={[styles.statusTagText, { color: '#ef4444' }]}>BLOCKED</Text>
                    </View>
                  ) : !isApproved ? (
                    <View style={[styles.statusTagPill, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fffbeb', borderColor: isDark ? 'rgba(245, 158, 11, 0.3)' : '#fde68a' }]}>
                      <Text style={[styles.statusTagText, { color: '#d97706' }]}>PENDING</Text>
                    </View>
                  ) : (
                    <View style={[
                      styles.statusTagPill,
                      {
                        backgroundColor: isLive ? (isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5') : (isDark ? 'rgba(148, 163, 184, 0.15)' : '#f1f5f9'),
                        borderColor: isLive ? (isDark ? 'rgba(16, 185, 129, 0.3)' : '#a7f3d0') : (isDark ? 'rgba(148, 163, 184, 0.3)' : '#e2e8f0')
                      }
                    ]}>
                      <View style={[styles.livePulseDot, { backgroundColor: isLive ? '#10b981' : '#94a3b8' }]} />
                      <Text style={[styles.statusTagText, { color: isLive ? (isDark ? '#34d399' : '#059669') : C.textSub }]}>
                        {isLive ? 'ACTIVE' : 'OFFLINE'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Action Buttons Row */}
              <View style={[styles.cardFooterDivider, { backgroundColor: C.border }]} />
              <View style={styles.cardFooterActions}>
                {!isApproved && (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.approveBtn]}
                    onPress={() => handleApprove(empId)}
                    activeOpacity={0.8}
                  >
                    <CheckCircle2 size={13} color="#ffffff" />
                    <Text style={styles.approveBtnText}>Approve</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5', borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : '#a7f3d0' }]}
                  onPress={() => router.push(`/(admin)/tracking?employeeId=${empId}`)}
                  activeOpacity={0.75}
                >
                  <Route size={13} color={isDark ? '#34d399' : '#047857'} />
                  <Text style={[styles.editBtnText, { color: isDark ? '#34d399' : '#047857', fontWeight: '700' }]}>Track Data</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: C.surfaceSecondary, borderColor: C.border }]}
                  onPress={() => openEdit(emp)}
                  activeOpacity={0.75}
                >
                  <Pencil size={13} color={C.primaryText} />
                  <Text style={[styles.editBtnText, { color: C.primaryText }]}>Edit Info</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    isBlocked
                      ? { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5', borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : '#a7f3d0' }
                      : { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2', borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#fecaca' }
                  ]}
                  onPress={() => handleToggleBlock(empId)}
                  activeOpacity={0.75}
                >
                  {isBlocked ? (
                    <>
                      <UserCheck size={13} color="#059669" />
                      <Text style={[styles.blockBtnText, { color: '#059669' }]}>Unblock</Text>
                    </>
                  ) : (
                    <>
                      <Ban size={13} color="#ef4444" />
                      <Text style={[styles.blockBtnText, { color: '#ef4444' }]}>Block</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </Surface>
          );
        }}
      />

      {/* BOTTOM TAB BAR */}
      <View style={styles.bottomTabBarContainer}>
        <Surface style={[styles.bottomTabBarSurface, { backgroundColor: C.surface, borderTopColor: C.border }]} elevation={5}>
          <TouchableOpacity style={styles.tabBarItem} onPress={() => goTo('/(admin)/dashboard')} activeOpacity={0.7}>
            <View style={styles.tabBarIconBox}>
              <LayoutDashboard size={20} color={C.textMuted} />
            </View>
            <Text style={[styles.tabBarLabel, { color: C.textSub }]}>Home</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.tabBarItem} onPress={() => goTo('/(admin)/tracking')} activeOpacity={0.7}>
            <View style={styles.tabBarIconBox}>
              <MapPin size={20} color={C.textMuted} />
            </View>
            <Text style={[styles.tabBarLabel, { color: C.textSub }]}>Live Map</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.tabBarItem} onPress={() => goTo('/(admin)/team')} activeOpacity={0.7}>
            <View style={[styles.tabBarIconBox, { backgroundColor: C.primaryLight }]}>
              <Users size={20} color={C.primary} />
            </View>
            <Text style={[styles.tabBarLabel, styles.tabBarLabelActive, { color: C.primary }]}>My Team</Text>
            <View style={[styles.activeTabDot, { backgroundColor: C.primary }]} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.tabBarItem} onPress={() => goTo('/(admin)/reports')} activeOpacity={0.7}>
            <View style={styles.tabBarIconBox}>
              <FileText size={20} color={C.textMuted} />
            </View>
            <Text style={[styles.tabBarLabel, { color: C.textSub }]}>Reports</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.tabBarItem} onPress={() => goTo('/(admin)/settings')} activeOpacity={0.7}>
            <View style={styles.tabBarIconBox}>
              <Settings size={20} color={C.textMuted} />
            </View>
            <Text style={[styles.tabBarLabel, { color: C.textSub }]}>Settings</Text>
          </TouchableOpacity>
        </Surface>
      </View>

      {/* EDIT EMPLOYEE MODAL */}
      <Modal visible={!!editEmp} transparent animationType="slide" onRequestClose={() => setEditEmp(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setEditEmp(null)}>
          <TouchableOpacity activeOpacity={1} style={[styles.modalSheet, { backgroundColor: C.surface, borderColor: C.border }]}>
            <View style={[styles.sheetHandle, { backgroundColor: C.border }]} />
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[styles.modalIconBox, { backgroundColor: C.primaryLight }]}>
                  <Pencil size={18} color={C.primary} />
                </View>
                <Text style={[styles.modalTitle, { color: C.text }]}>Edit Staff Details</Text>
              </View>
              <TouchableOpacity onPress={() => setEditEmp(null)}>
                <X size={20} color={C.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: height * 0.6 }} showsVerticalScrollIndicator={false}>
              <Text style={[styles.fieldLabel, { color: C.textSub }]}>FULL NAME *</Text>
              <TextInput
                style={[styles.fieldInput, { backgroundColor: C.surfaceSecondary, borderColor: C.border, color: C.text }]}
                value={editName}
                onChangeText={setEditName}
                placeholder="Enter full name"
                placeholderTextColor={C.textMuted}
              />

              <Text style={[styles.fieldLabel, { color: C.textSub }]}>PHONE NUMBER *</Text>
              <TextInput
                style={[styles.fieldInput, { backgroundColor: C.surfaceSecondary, borderColor: C.border, color: C.text }]}
                value={editPhone}
                onChangeText={setEditPhone}
                keyboardType="phone-pad"
                placeholder="Enter phone number"
                placeholderTextColor={C.textMuted}
              />

              <Text style={[styles.fieldLabel, { color: C.textSub }]}>DEPARTMENT</Text>
              <TextInput
                style={[styles.fieldInput, { backgroundColor: C.surfaceSecondary, borderColor: C.border, color: C.text }]}
                value={editDepartment}
                onChangeText={setEditDepartment}
                placeholder="Field Sales / Operations"
                placeholderTextColor={C.textMuted}
              />

              <Text style={[styles.fieldLabel, { color: C.textSub }]}>ASSIGNED ROLE</Text>
              <View style={styles.rolePickerRow}>
                {['EMPLOYEE', 'MANAGER', 'ADMIN'].map((r) => {
                  const isRoleActive = editRole.toUpperCase() === r;
                  return (
                    <TouchableOpacity
                      key={r}
                      style={[
                        styles.rolePickBtn,
                        {
                          backgroundColor: isRoleActive ? C.primary : C.surfaceSecondary,
                          borderColor: isRoleActive ? C.primary : C.border,
                        }
                      ]}
                      onPress={() => setEditRole(r)}
                    >
                      <Text style={[
                        styles.rolePickText,
                        { color: isRoleActive ? '#ffffff' : C.textSub, fontWeight: isRoleActive ? '800' : '600' }
                      ]}>
                        {r}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: C.primary }, editSaving && { opacity: 0.6 }]}
              onPress={handleSaveEdit}
              disabled={editSaving}
              activeOpacity={0.8}
            >
              {editSaving ? <ActivityIndicator color="#ffffff" size="small" /> : <Check size={18} color="#ffffff" />}
              <Text style={styles.saveBtnText}>{editSaving ? 'Updating Staff…' : 'Save Changes'}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingBrandCard: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingLogoBadge: { width: 76, height: 76, borderRadius: 22, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#059669', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', padding: 4 },
  loadingLogoImg: { width: 62, height: 62, borderRadius: 16 },
  loadingBrandTitle: { fontSize: 19, fontWeight: '800', marginTop: 12, letterSpacing: 0.2 },
  loadingBrandSub: { fontSize: 11.5, fontWeight: '600', marginTop: 2 },

  // Header
  headerGradient: { paddingBottom: 16 },
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
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
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
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  navbarAppIcon: { width: '100%', height: '100%' },
  appName: { fontSize: 17, fontWeight: '800', color: '#ffffff', letterSpacing: 0.3, fontFamily: FONT },
  appTag: { fontSize: 9, fontWeight: '700', color: '#a7f3d0', letterSpacing: 0.8, fontFamily: FONT },
  topNavRight: { flexDirection: 'row', alignItems: 'center' },
  countBadgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  countBadgeTextHeader: { color: '#ffffff', fontSize: 12, fontWeight: '800', fontFamily: FONT },

  // Filter & Search Section
  filterSection: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 44,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 13, paddingVertical: 0, fontFamily: FONT },
  roleScroller: { flexGrow: 0 },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  roleChipText: { fontSize: 12, fontFamily: FONT },
  chipCountBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  chipCountText: { fontSize: 10, fontWeight: '700', fontFamily: FONT },

  // List Container
  listContainer: { padding: 14, paddingBottom: 110 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
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
  avatarInitials: { color: '#ffffff', fontSize: 15, fontWeight: '800', fontFamily: FONT },
  statusDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  infoCol: { flex: 1, justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  empNameText: { fontSize: 15, fontWeight: '800', fontFamily: FONT },
  roleBadgePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 1 },
  roleBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3, fontFamily: FONT },
  empDeptText: { fontSize: 11, marginTop: 3, fontWeight: '500', fontFamily: FONT },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  empMetaText: { fontSize: 11, fontFamily: FONT },

  rightStatusCol: { alignItems: 'flex-end', justifyContent: 'center' },
  statusTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  livePulseDot: { width: 6, height: 6, borderRadius: 3 },
  statusTagText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4, fontFamily: FONT },

  cardFooterDivider: { height: 1, marginVertical: 12 },
  cardFooterActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },

  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  approveBtn: { backgroundColor: '#059669', borderColor: '#059669', flex: 1, justifyContent: 'center' },
  approveBtnText: { color: '#ffffff', fontSize: 11, fontWeight: '800', fontFamily: FONT },
  editBtnText: { fontSize: 11, fontWeight: '700', fontFamily: FONT },
  blockBtnText: { fontSize: 11, fontWeight: '700', fontFamily: FONT },

  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyIconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyText: { fontSize: 15, fontWeight: '700', fontFamily: FONT },
  emptySubText: { fontSize: 12, marginTop: 4, fontFamily: FONT },

  // Bottom Navigation Bar
  bottomTabBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 999,
  },
  bottomTabBarSurface: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 36 : 28,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 16,
  },
  tabBarItem: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  tabBarIconBox: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  tabBarLabel: { fontSize: 10, fontWeight: '600', marginTop: 2, fontFamily: FONT },
  tabBarLabelActive: { fontWeight: '800' },
  activeTabDot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.65)', justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '800', fontFamily: FONT },
  fieldLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginTop: 14, marginBottom: 6, fontFamily: FONT },
  fieldInput: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: FONT,
  },
  rolePickerRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  rolePickBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  rolePickText: { fontSize: 11, fontFamily: FONT },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 20,
  },
  saveBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 14, fontFamily: FONT },
});