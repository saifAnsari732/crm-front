import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, View, FlatList, TouchableOpacity, ActivityIndicator,
  Platform, RefreshControl, TextInput, Modal, ScrollView,
} from 'react-native';
import { Text, Surface, Avatar } from 'react-native-paper';
import { Users, Search, UserCheck, Ban, Pencil, X, Check } from 'lucide-react-native';
import { adminAPI, getAvatarUrl } from '../../services/api';
import { useSettings } from '../../context/SettingsContext';

const FONT = Platform.OS === 'ios' ? 'System' : 'sans-serif-medium';

const getEmployeeId = (e) => e?._id || e?.employeeId || e?.id || '';

export default function AdminTeamScreen() {
  const { theme } = useSettings();
  const isDark = theme === 'dark';
  const C = {
    bg: isDark ? '#0f172a' : '#f8fafc',
    surface: isDark ? '#1e293b' : '#ffffff',
    text: isDark ? '#f8fafc' : '#0f172a',
    sub: isDark ? '#94a3b8' : '#64748b',
    border: isDark ? '#334155' : '#e2e8f0',
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
    } catch (e) { console.log('Team fetch error:', e.message); setEmployees([]); }
    finally { setLoading(false); setRefreshing(false); }
  }, [filterRole]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const onRefresh = async () => { setRefreshing(true); await fetchEmployees(); setRefreshing(false); };

  const filtered = employees.filter((e) => (e.name || '').toLowerCase().includes(search.toLowerCase()));

  const openEdit = (emp) => {
    setEditEmp(emp); setEditName(emp.name || ''); setEditPhone(emp.phone || '');
    setEditDepartment(emp.department || ''); setEditRole(emp.role || '');
  };

  const handleApprove = async (id) => {
    try { await adminAPI.approveEmployee(id); fetchEmployees(); } catch (e) { console.log(e); }
  };

  const handleToggleBlock = async (id) => {
    try { await adminAPI.toggleBlock(id); fetchEmployees(); } catch (e) { console.log(e); }
  };

  const handleSaveEdit = async () => {
    if (!editEmp) return;
    setEditSaving(true);
    try {
      await adminAPI.updateEmployee(getEmployeeId(editEmp), {
        name: editName, phone: editPhone, department: editDepartment, role: editRole,
      });
      setEditEmp(null); fetchEmployees();
    } catch (e) { console.log('Edit employee error:', e.message); }
    finally { setEditSaving(false); }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: C.bg }]}>
        <ActivityIndicator size="large" color="#283b96" />
        <Text style={[styles.emptyText, { color: C.sub }]}>Loading team…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
        <View>
          <Text style={[styles.eyebrow, { color: C.sub }]}>ADMIN</Text>
          <Text style={[styles.title, { color: C.text }]}>Team</Text>
          <Text style={[styles.subtitle, { color: C.sub }]}>{employees.length} employees</Text>
        </View>
        <Users size={22} color="#283b96" />
      </View>

      {/* Search + Role filter */}
      <View style={[styles.filterBar, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
        <View style={[styles.searchBox, { borderColor: C.border, backgroundColor: C.bg }]}>
          <Search size={15} color={C.sub} />
          <TextInput style={[styles.searchInput, { color: C.text }]} placeholder="Search by name..." placeholderTextColor={C.sub} value={search} onChangeText={setSearch} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.roleScroller}>
          {['all', 'admin', 'manager', 'employee'].map((role) => (
            <TouchableOpacity key={role} style={[styles.roleChip, filterRole === role && styles.roleChipActive]} onPress={() => setFilterRole(role)}>
              <Text style={[styles.roleChipText, filterRole === role && styles.roleChipTextActive]}>{role.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
<FlatList
        data={filtered}
        keyExtractor={(item, idx) => getEmployeeId(item) || String(idx)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.body}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Users size={40} color={C.sub} />
            <Text style={[styles.emptyText, { color: C.sub }]}>No employees found</Text>
          </View>
        }
        renderItem={({ item: emp }) => {
          const empId = getEmployeeId(emp);
          const isApproved = emp.isApproved !== false;
          return (
            <Surface style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }]} elevation={1}>
              <View style={styles.cardRow}>
                {getAvatarUrl(emp.avatar) ? (
                  <Avatar.Image size={40} source={{ uri: getAvatarUrl(emp.avatar) }} />
                ) : (
                  <Avatar.Text size={40} label={(emp.name || 'E').slice(0, 2).toUpperCase()} style={{ backgroundColor: emp.isBlocked ? '#dc2626' : '#334155' }} labelStyle={{ color: '#fff' }} />
                )}
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.empName, { color: C.text }]}>{emp.name || 'Unnamed'}</Text>
                  <Text style={[styles.empSub, { color: C.sub }]}>{(emp.department || 'Staff')} • {(emp.role || '').toUpperCase()}</Text>
                  {emp.phone ? <Text style={[styles.empSub, { color: C.sub }]}>{emp.phone}</Text> : null}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  {!isApproved && (
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#16a34a' }]} onPress={() => handleApprove(empId)}>
                      <UserCheck size={12} color="#fff" />
                      <Text style={styles.actionBtnTxt}>Approve</Text>
                    </TouchableOpacity>
                  )}
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#283b96' }]} onPress={() => openEdit(emp)}>
                      <Pencil size={12} color="#fff" />
                      <Text style={styles.actionBtnTxt}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: emp.isBlocked ? '#16a34a' : '#dc2626' }]} onPress={() => handleToggleBlock(empId)}>
                      <Ban size={12} color="#fff" />
                      <Text style={styles.actionBtnTxt}>{emp.isBlocked ? 'Unblock' : 'Block'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Surface>
          );
        }}
      />
<Modal visible={!!editEmp} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: C.surface, borderColor: C.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: C.text }]}>Edit Employee</Text>
              <TouchableOpacity onPress={() => setEditEmp(null)}>
                <X size={20} color={C.sub} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.fieldLabel, { color: C.sub }]}>NAME</Text>
            <TextInput style={[styles.fieldInput, { color: C.text, borderColor: C.border }]} value={editName} onChangeText={setEditName} placeholderTextColor={C.sub} />

            <Text style={[styles.fieldLabel, { color: C.sub }]}>PHONE</Text>
            <TextInput style={[styles.fieldInput, { color: C.text, borderColor: C.border }]} value={editPhone} onChangeText={setEditPhone} keyboardType="phone-pad" placeholderTextColor={C.sub} />

            <Text style={[styles.fieldLabel, { color: C.sub }]}>DEPARTMENT</Text>
            <TextInput style={[styles.fieldInput, { color: C.text, borderColor: C.border }]} value={editDepartment} onChangeText={setEditDepartment} placeholderTextColor={C.sub} />

            <Text style={[styles.fieldLabel, { color: C.sub }]}>ROLE</Text>
            <View style={[styles.roleRow, { borderColor: C.border }]}>
              {['employee', 'manager', 'admin'].map((r) => (
                <TouchableOpacity key={r} style={[styles.rolePick, editRole === r && styles.rolePickActive]} onPress={() => setEditRole(r)}>
                  <Text style={[styles.rolePickText, editRole === r && styles.rolePickTextActive]}>{r.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={[styles.saveBtn, editSaving && { opacity: 0.6 }]} onPress={handleSaveEdit} disabled={editSaving}>
              {editSaving ? <ActivityIndicator color="#fff" size="small" /> : <Check size={16} color="#fff" />}
              <Text style={styles.saveBtnText}>{editSaving ? 'Saving…' : 'Save Changes'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
root: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingTop: Platform.OS === 'ios' ? 54 : 22, paddingBottom: 12, borderBottomWidth: 1 },
  eyebrow: { fontFamily: FONT, fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },
  title: { fontFamily: FONT, fontSize: 18, fontWeight: 'bold', marginTop: 2 },
  subtitle: { fontFamily: FONT, fontSize: 11, marginTop: 2 },
  filterBar: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, gap: 8 },
  searchBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, height: 36, gap: 6 },
  searchInput: { fontFamily: FONT, flex: 1, fontSize: 12, paddingVertical: 0 },
  roleScroller: { flexGrow: 0 },
  roleChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: '#cbd5e1', marginRight: 6 },
  roleChipActive: { backgroundColor: '#283b96', borderColor: '#283b96' },
  roleChipText: { fontFamily: FONT, fontSize: 10, fontWeight: 'bold', color: '#64748b' },
  roleChipTextActive: { color: '#ffffff' },
  body: { padding: 12, paddingBottom: 28 },
  card: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 8 },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  empName: { fontFamily: FONT, fontSize: 13, fontWeight: 'bold' },
  empSub: { fontFamily: FONT, fontSize: 10, marginTop: 1 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6 },
  actionBtnTxt: { fontFamily: FONT, color: '#fff', fontSize: 9, fontWeight: 'bold' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyWrap: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontFamily: FONT, fontSize: 12, marginTop: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, padding: 18, paddingBottom: 30 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontFamily: FONT, fontSize: 16, fontWeight: 'bold' },
  fieldLabel: { fontFamily: FONT, fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5, marginTop: 10, marginBottom: 4 },
  fieldInput: { height: 40, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, fontFamily: FONT, fontSize: 13 },
  roleRow: { flexDirection: 'row', gap: 8, borderWidth: 1, borderRadius: 10, padding: 6 },
  rolePick: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: 'transparent', alignItems: 'center' },
  rolePickActive: { backgroundColor: '#283b96', borderColor: '#283b96' },
  rolePickText: { fontFamily: FONT, fontSize: 11, fontWeight: 'bold', color: '#64748b' },
  rolePickTextActive: { color: '#ffffff' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#008080', borderRadius: 12, paddingVertical: 12, marginTop: 18 },
  saveBtnText: { fontFamily: FONT, color: '#fff', fontWeight: 'bold', fontSize: 13 },
});