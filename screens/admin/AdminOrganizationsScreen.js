import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, View, ScrollView, TouchableOpacity,
  ActivityIndicator, Platform, RefreshControl, StatusBar, TextInput, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Surface } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Building2, Search, Plus, Users, ShieldCheck, ChevronRight,
  Sparkles, CheckCircle2, AlertCircle, X, Edit3, Trash2
} from 'lucide-react-native';
import { adminAPI } from '../../services/api';
import { useRouter } from 'expo-router';

const FONT = Platform.OS === 'web' ? 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' : Platform.OS === 'ios' ? 'System' : 'sans-serif-medium';
const HEADER_GRADIENT = ['#047857', '#0d9488', '#0f766e'];
const BG_COLOR = '#f8fafc';

const cardShadow = Platform.OS === 'web'
  ? { boxShadow: '0px 4px 14px rgba(15, 23, 42, 0.08)' }
  : { elevation: 3, shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } };

export default function AdminOrganizationsScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // New org state
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgEmail, setNewOrgEmail] = useState('');
  const [newOrgPlan, setNewOrgPlan] = useState('Growth Pro');

  const [orgs, setOrgs] = useState([
    { _id: '1', name: 'AgriCorp Solutions', code: 'AGR', status: 'active', plan: 'Growth Pro', userCount: 42, adminName: 'Rajesh Kumar', email: 'admin@agricorp.com', joined: 'Jan 2025' },
    { _id: '2', name: 'Global Tech Systems', code: 'GTS', status: 'active', plan: 'Enterprise', userCount: 128, adminName: 'Priya Sharma', email: 'contact@globaltech.com', joined: 'Feb 2025' },
    { _id: '3', name: 'Kisan Choice Pvt Ltd', code: 'KC', status: 'trial', plan: 'Trial 14-Days', userCount: 18, adminName: 'Saifuddin Ansari', email: 'newsaif@me.com', joined: 'Mar 2025' },
    { _id: '4', name: 'Zenith Logistics', code: 'ZNL', status: 'active', plan: 'Starter', userCount: 15, adminName: 'Vikram Singh', email: 'support@zenith.com', joined: 'Apr 2025' },
  ]);

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  const filteredOrgs = orgs.filter(o => {
    const matchSearch = o.name.toLowerCase().includes(search.toLowerCase()) || o.email.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || o.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const handleAddOrg = () => {
    if (!newOrgName.trim()) return;
    const newEntry = {
      _id: String(Date.now()),
      name: newOrgName,
      code: newOrgName.slice(0, 3).toUpperCase(),
      status: 'active',
      plan: newOrgPlan,
      userCount: 1,
      adminName: 'Admin',
      email: newOrgEmail || 'admin@company.com',
      joined: 'Today'
    };
    setOrgs([newEntry, ...orgs]);
    setNewOrgName('');
    setNewOrgEmail('');
    setShowAddModal(false);
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#047857" />

      {/* HEADER */}
      <LinearGradient colors={HEADER_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerTitleRow}>
            <View style={styles.headerIconBox}>
              <Building2 size={20} color="#fff" />
            </View>
            <View>
              <Text style={styles.headerTitle}>Organizations Console</Text>
              <Text style={styles.headerSub}>Manage multi-tenant SaaS organizations</Text>
            </View>
          </View>

          {/* Quick Stats Grid */}
          <View style={styles.statsRow}>
            <View style={styles.statPill}>
              <Text style={styles.statVal}>{orgs.length}</Text>
              <Text style={styles.statLabel}>Total Orgs</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={[styles.statVal, { color: '#4ade80' }]}>{orgs.filter(o => o.status === 'active').length}</Text>
              <Text style={styles.statLabel}>Active</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={[styles.statVal, { color: '#fde047' }]}>{orgs.filter(o => o.status === 'trial').length}</Text>
              <Text style={styles.statLabel}>In Trial</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* BODY */}
      <View style={styles.body}>
        {/* Search & Filter Bar */}
        <View style={styles.filterBar}>
          <View style={styles.searchBox}>
            <Search size={16} color="#64748b" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search organization or email..."
              placeholderTextColor="#94a3b8"
              value={search}
              onChangeText={setSearch}
            />
          </View>

          <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
            <Plus size={18} color="#fff" />
            <Text style={styles.addBtnText}>Add Org</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Chips */}
        <View style={styles.chipRow}>
          {['all', 'active', 'trial'].map(status => (
            <TouchableOpacity
              key={status}
              style={[styles.chip, filterStatus === status && styles.chipActive]}
              onPress={() => setFilterStatus(status)}
            >
              <Text style={[styles.chipText, filterStatus === status && styles.chipTextActive]}>
                {status.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* List */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e11d48" />}
        >
          {filteredOrgs.map((org) => (
            <Surface key={org._id} style={[styles.orgCard, cardShadow]} elevation={1}>
              <View style={styles.orgCardRow}>
                <View style={styles.orgBadge}>
                  <Text style={styles.orgBadgeText}>{org.code}</Text>
                </View>

                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.orgName}>{org.name}</Text>
                  <Text style={styles.orgSub}>{org.email} • {org.userCount} users</Text>
                  <View style={styles.planRow}>
                    <Sparkles size={12} color="#e11d48" />
                    <Text style={styles.planText}>{org.plan}</Text>
                  </View>
                </View>

                <View style={[styles.statusTag, org.status === 'trial' ? styles.statusTrial : styles.statusActive]}>
                  <Text style={[styles.statusTagText, org.status === 'trial' ? styles.textTrial : styles.textActive]}>
                    {org.status.toUpperCase()}
                  </Text>
                </View>
              </View>
            </Surface>
          ))}
        </ScrollView>
      </View>

      {/* ADD ORG MODAL */}
      <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Organization</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Organization Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Kisan Choice Pvt Ltd"
                value={newOrgName}
                onChangeText={setNewOrgName}
              />

              <Text style={styles.label}>Admin Email</Text>
              <TextInput
                style={styles.input}
                placeholder="admin@company.com"
                value={newOrgEmail}
                onChangeText={setNewOrgEmail}
                keyboardType="email-address"
              />

              <Text style={styles.label}>Plan Tier</Text>
              <View style={styles.planSelectorRow}>
                {['Starter', 'Growth Pro', 'Enterprise'].map(plan => (
                  <TouchableOpacity
                    key={plan}
                    style={[styles.planChip, newOrgPlan === plan && styles.planChipActive]}
                    onPress={() => setNewOrgPlan(plan)}
                  >
                    <Text style={[styles.planChipText, newOrgPlan === plan && styles.planChipTextActive]}>{plan}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.submitBtn} onPress={handleAddOrg}>
                <Text style={styles.submitBtnText}>Create Organization</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG_COLOR },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: Platform.OS === 'android' ? 10 : 0,
    borderCurve: 'round',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  headerIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: 'bold', fontFamily: FONT },
  headerSub: { color: '#a7f3d0', fontSize: 10, marginTop: 1 },

  statsRow: { flexDirection: 'row', gap: 10 },
  statPill: { flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 8, alignItems: 'center' },
  statVal: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  statLabel: { color: '#a7f3d0', fontSize: 9, marginTop: 1 },

  body: { flex: 1, padding: 14, maxWidth: 720, width: '100%', alignSelf: 'center' },
  filterBar: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 10, borderWidth: 1, borderColor: '#e2e8f0', height: 42 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 12, color: '#0f172a' },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e11d48', paddingHorizontal: 12, borderRadius: 12, gap: 4, height: 42 },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },

  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#e2e8f0' },
  chipActive: { backgroundColor: '#e11d48' },
  chipText: { fontSize: 10, fontWeight: 'bold', color: '#64748b' },
  chipTextActive: { color: '#fff' },

  orgCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14 },
  orgCardRow: { flexDirection: 'row', alignItems: 'center' },
  orgBadge: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center' },
  orgBadgeText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  orgName: { fontSize: 14, fontWeight: 'bold', color: '#0f172a', fontFamily: FONT },
  orgSub: { fontSize: 11, color: '#64748b', marginTop: 1 },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  planText: { fontSize: 10, color: '#e11d48', fontWeight: 'bold' },

  statusTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusActive: { backgroundColor: '#dcfce7' },
  statusTrial: { backgroundColor: '#fef3c7' },
  statusTagText: { fontSize: 9, fontWeight: 'bold' },
  textActive: { color: '#16a34a' },
  textTrial: { color: '#d97706' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', padding: 16 },
  modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  formGroup: { gap: 10 },
  label: { fontSize: 11, fontWeight: 'bold', color: '#475569' },
  input: { backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#0f172a' },
  planSelectorRow: { flexDirection: 'row', gap: 8 },
  planChip: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center' },
  planChipActive: { backgroundColor: '#e11d48' },
  planChipText: { fontSize: 11, fontWeight: 'bold', color: '#64748b' },
  planChipTextActive: { color: '#fff' },
  submitBtn: { backgroundColor: '#e11d48', paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
});
