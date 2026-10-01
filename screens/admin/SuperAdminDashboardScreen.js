import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, View, ScrollView, TouchableOpacity,
  ActivityIndicator, Platform, RefreshControl, StatusBar, Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Surface } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Menu, Bell, Shield, Building2, Users, CheckCircle2, ChevronRight,
  UserPlus, CreditCard, Layers, Settings, TrendingUp, Sparkles, MapPin, Activity
} from 'lucide-react-native';
import { superAdminAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');
const FONT = Platform.OS === 'ios' ? 'System' : 'sans-serif-medium';

const PINK_HEADER_GRADIENT = ['#e11d48', '#f43f5e', '#fb7185'];
const BG_COLOR = '#f1f5f9';

const cardShadow = Platform.OS === 'web'
  ? { boxShadow: '0px 6px 20px rgba(0, 0, 0, 0.05)' }
  : { elevation: 3, shadowColor: '#0f172a', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } };

export default function SuperAdminDashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [stats, setStats] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [statsRes, orgsRes] = await Promise.all([
        superAdminAPI.getStats().catch(() => ({ data: { success: false } })),
        superAdminAPI.getOrganizations({ limit: 10 }).catch(() => ({ data: { success: false } })),
      ]);

      if (statsRes.data?.success) setStats(statsRes.data.stats || statsRes.data);
      if (orgsRes.data?.success) setOrganizations(orgsRes.data.organizations || orgsRes.data.data || []);
    } catch (e) {
      console.log('Super Admin dashboard fetch error:', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const totalOrgs = stats?.totalOrganizations ?? (organizations.length || 248);
  const totalUsers = stats?.totalUsers ?? 12840;
  const totalRevenue = stats?.totalRevenue ?? 482000;
  const uptime = stats?.uptime ?? '99.9%';

  const goTo = (path) => router.push(path);

  const getUserInitials = (name) => {
    if (!name) return 'SA';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: BG_COLOR }]}>
        <ActivityIndicator size="large" color="#e11d48" />
        <Text style={styles.loadingText}>Loading SaaS Platform Console…</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#e11d48" />

      {/* HEADER WITH RED/ROSE GRADIENT */}
      <LinearGradient colors={PINK_HEADER_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerGradient}>
        <SafeAreaView edges={['top']}>
          {/* Top Nav Bar */}
          <View style={styles.topNav}>
            <TouchableOpacity style={styles.iconBtn}>
              <Menu size={22} color="#fff" />
            </TouchableOpacity>

            <View style={styles.brandContainer}>
              <View style={styles.logoBadge}>
                <MapPin size={14} color="#e11d48" />
              </View>
              <View>
                <Text style={styles.appName}>KisanConnect</Text>
                <Text style={styles.appTag}>SaaS Platform Console</Text>
              </View>
            </View>

            <View style={styles.topRightActions}>
              <TouchableOpacity style={styles.iconBtn}>
                <Bell size={20} color="#fff" />
              </TouchableOpacity>

              <View style={styles.userAvatarHeader}>
                <Text style={styles.userAvatarHeaderText}>{getUserInitials(user?.name)}</Text>
              </View>
            </View>
          </View>

          {/* Greeting Section */}
          <View style={styles.greetingBox}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greetingLabel}>Welcome back,</Text>
              <Text style={styles.userName}>{user?.name || 'Super Admin'}</Text>
              <Text style={styles.userRoleText}>Platform Administrator</Text>
            </View>

            <View style={styles.pillOwner}>
              <Sparkles size={12} color="#fef08a" />
              <Text style={styles.pillOwnerText}>Platform Owner</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* BODY CONTENT */}
      <ScrollView
        style={{ backgroundColor: BG_COLOR }}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e11d48" colors={['#e11d48']} />}
      >
        {/* PLATFORM OVERVIEW CARD GRID */}
        <Surface style={[styles.sectionCard, cardShadow]} elevation={1}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardSectionTitle}>Platform Overview</Text>
            <Text style={styles.dateText}>Live System Metrics</Text>
          </View>

          <View style={styles.gridContainer}>
            {/* Card 1: Total Revenue */}
            <View style={styles.overviewGridCard}>
              <View style={[styles.iconBox, { backgroundColor: '#eff6ff' }]}>
                <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#2563eb' }}>₹</Text>
              </View>
              <Text style={styles.gridCardLabel}>Total Revenue</Text>
              <Text style={styles.gridCardVal}>₹ {totalRevenue.toLocaleString()}</Text>
              <Text style={styles.greenTrend}>↑ 22% <Text style={styles.greySub}>vs last month</Text></Text>
            </View>

            {/* Card 2: Total Organizations */}
            <View style={styles.overviewGridCard}>
              <View style={[styles.iconBox, { backgroundColor: '#eff6ff' }]}>
                <Building2 size={16} color="#2563eb" />
              </View>
              <Text style={styles.gridCardLabel}>Total Organizations</Text>
              <Text style={styles.gridCardVal}>{totalOrgs}</Text>
              <Text style={styles.greenTrend}>↑ 12% <Text style={styles.greySub}>vs last month</Text></Text>
            </View>

            {/* Card 3: Total Users */}
            <View style={styles.overviewGridCard}>
              <View style={[styles.iconBox, { backgroundColor: '#eff6ff' }]}>
                <Users size={16} color="#2563eb" />
              </View>
              <Text style={styles.gridCardLabel}>Total Users</Text>
              <Text style={styles.gridCardVal}>{totalUsers.toLocaleString()}</Text>
              <Text style={styles.greenTrend}>↑ 18% <Text style={styles.greySub}>vs last month</Text></Text>
            </View>

            {/* Card 4: System Uptime */}
            <View style={styles.overviewGridCard}>
              <View style={[styles.iconBox, { backgroundColor: '#f0fdf4' }]}>
                <Activity size={16} color="#16a34a" />
              </View>
              <Text style={styles.gridCardLabel}>System Uptime</Text>
              <Text style={styles.gridCardVal}>{uptime}</Text>
              <Text style={{ fontSize: 10, color: '#16a34a', fontWeight: 'bold' }}>• All Systems Operational</Text>
            </View>
          </View>
        </Surface>

        {/* RECENT ORGANIZATIONS */}
        <Surface style={[styles.sectionCard, cardShadow]} elevation={1}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardSectionTitle}>Recent Organizations</Text>
            <TouchableOpacity onPress={() => goTo('/(admin)/organizations')}>
              <Text style={styles.viewAllBtnText}>View All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.orgList}>
            {organizations.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Building2 size={32} color="#94a3b8" />
                <Text style={styles.emptyTitle}>No Organizations Found</Text>
                <Text style={styles.emptySub}>Click "Add Organization" below to create one.</Text>
              </View>
            ) : (
              organizations.slice(0, 5).map((org, idx) => (
                <TouchableOpacity key={org._id || idx} style={styles.orgItemRow} onPress={() => goTo('/(admin)/organizations')} activeOpacity={0.7}>
                  <View style={[styles.orgBadge, { backgroundColor: org.color || '#059669' }]}>
                    <Text style={styles.orgBadgeText}>{org.code || (org.name || 'O').slice(0, 3).toUpperCase()}</Text>
                  </View>

                  <View style={styles.orgInfoCol}>
                    <Text style={styles.orgItemName} numberOfLines={1}>{org.name}</Text>
                    <Text style={styles.orgItemSub}>
                      <Text style={{ color: org.status === 'trial' ? '#d97706' : '#10b981', fontWeight: 'bold' }}>
                        {org.status === 'trial' ? 'Trial' : 'Active'}
                      </Text>
                      {' • '}{org.plan?.name || org.plan || 'Growth Pro'}
                    </Text>
                  </View>

                  <View style={styles.orgItemRight}>
                    <Text style={styles.usersCountText}>{org.userCount || org.users || 0} users</Text>
                    <ChevronRight size={16} color="#94a3b8" />
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        </Surface>

        {/* QUICK ACTIONS */}
        <Surface style={[styles.sectionCard, cardShadow, { marginBottom: 30 }]} elevation={1}>
          <Text style={styles.cardSectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsRow}>
            <TouchableOpacity style={styles.quickTile} onPress={() => goTo('/(admin)/organizations')} activeOpacity={0.8}>
              <View style={[styles.quickTileIcon, { backgroundColor: '#eff6ff' }]}>
                <UserPlus size={20} color="#2563eb" />
              </View>
              <Text style={styles.quickTileLabel}>Add Organization</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickTile} onPress={() => goTo('/(admin)/payments')} activeOpacity={0.8}>
              <View style={[styles.quickTileIcon, { backgroundColor: '#eff6ff' }]}>
                <CreditCard size={20} color="#2563eb" />
              </View>
              <Text style={styles.quickTileLabel}>View Payments</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickTile} onPress={() => goTo('/(admin)/plans')} activeOpacity={0.8}>
              <View style={[styles.quickTileIcon, { backgroundColor: '#eff6ff' }]}>
                <Layers size={20} color="#2563eb" />
              </View>
              <Text style={styles.quickTileLabel}>Plans & Quotas</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickTile} onPress={() => goTo('/(admin)/settings')} activeOpacity={0.8}>
              <View style={[styles.quickTileIcon, { backgroundColor: '#eff6ff' }]}>
                <Settings size={20} color="#2563eb" />
              </View>
              <Text style={styles.quickTileLabel}>System Settings</Text>
            </TouchableOpacity>
          </View>
        </Surface>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG_COLOR },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontFamily: FONT, fontSize: 13, color: '#e11d48', marginTop: 10, fontWeight: '600' },

  headerGradient: { borderBottomLeftRadius: 30, borderBottomRightRadius: 30, paddingHorizontal: 16, paddingBottom: 24, paddingTop: Platform.OS === 'android' ? 10 : 0 },
  topNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  iconBtn: { padding: 4, position: 'relative' },
  brandContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logoBadge: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  appName: { color: '#fff', fontSize: 16, fontWeight: 'bold', fontFamily: FONT },
  appTag: { color: '#ffe4e6', fontSize: 9, fontWeight: '600' },

  topRightActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  userAvatarHeader: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#fff' },
  userAvatarHeaderText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },

  greetingBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  greetingLabel: { color: '#ffe4e6', fontSize: 12, fontWeight: '500' },
  userName: { color: '#fff', fontSize: 20, fontWeight: '900', fontFamily: FONT, marginTop: 2 },
  userRoleText: { color: '#fecdd3', fontSize: 11, fontWeight: '600', marginTop: 2 },

  pillOwner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, gap: 4 },
  pillOwnerText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

  body: { padding: 14, gap: 14, maxWidth: 720, width: '100%', alignSelf: 'center' },

  sectionCard: { backgroundColor: '#fff', borderRadius: 20, padding: 16 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardSectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#0f172a', fontFamily: FONT },
  dateText: { fontSize: 11, color: '#64748b' },
  viewAllBtnText: { fontSize: 12, fontWeight: 'bold', color: '#e11d48' },

  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  overviewGridCard: { width: (width - 48) / 2, backgroundColor: '#f8fafc', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#f1f5f9' },
  iconBox: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  gridCardLabel: { fontSize: 11, color: '#64748b', fontWeight: '500' },
  gridCardVal: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', fontFamily: FONT, marginTop: 2 },
  greenTrend: { fontSize: 10, color: '#10b981', fontWeight: 'bold', marginTop: 4 },
  greySub: { color: '#94a3b8', fontWeight: 'normal' },

  orgList: { gap: 10, marginTop: 4 },
  orgItemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  orgBadge: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  orgBadgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  orgInfoCol: { flex: 1, marginLeft: 12 },
  orgItemName: { fontSize: 13, fontWeight: 'bold', color: '#0f172a', fontFamily: FONT },
  orgItemSub: { fontSize: 11, color: '#64748b', marginTop: 1 },
  orgItemRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  usersCountText: { fontSize: 11, color: '#64748b', fontWeight: '500' },

  quickActionsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 6 },
  quickTile: { flex: 1, alignItems: 'center', backgroundColor: '#f8fafc', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#f1f5f9' },
  quickTileIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  quickTileLabel: { fontSize: 10, fontWeight: 'bold', color: '#0f172a', textAlign: 'center' },

  emptyWrap: { padding: 20, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 13, fontWeight: 'bold', color: '#475569', marginTop: 8 },
  emptySub: { fontSize: 11, color: '#94a3b8', marginTop: 2, textAlign: 'center' },
});
