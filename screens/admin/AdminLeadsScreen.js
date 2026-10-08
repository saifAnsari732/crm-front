import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, View, FlatList, TouchableOpacity, ActivityIndicator,
  Platform, RefreshControl, TextInput, Image, StatusBar, Dimensions, Linking, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Surface } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft, Users, Phone, MessageSquare, MapPin, IndianRupee,
  Search, Filter, Plus, ChevronRight, CheckCircle2, Clock,
  Calendar, Briefcase, UserCheck, Sprout
} from 'lucide-react-native';
import { adminAPI, leadAPI, getAvatarUrl } from '../../services/api';
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

export default function AdminLeadsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('new'); // 'new', 'contacted', 'negotiation', 'won', 'lost'
  const [leads, setLeads] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const AVATAR_COLORS = ['#059669', '#2563eb', '#7c3aed', '#d97706', '#db2777', '#0891b2', '#4f46e5', '#ea580c'];
  const getAvatarColor = (name) => {
    if (!name) return AVATAR_COLORS[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  };

  const getUserInitials = (name) => {
    if (!name) return 'LD';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  };

  // Sample seed leads matching mockup image
  const sampleLeads = [
    {
      _id: 'lead_1',
      customerName: 'Ramesh Yadav',
      phone: '9876543210',
      village: 'Village: Fazilnagar',
      productRequirement: 'Maize Seeds',
      dealValue: 50000,
      assignedEmployee: 'Ajay Kumar',
      date: '12 Apr 2025',
      status: 'new',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    },
    {
      _id: 'lead_2',
      customerName: 'Suresh Patel',
      phone: '9876543211',
      village: 'Village: Pipraich',
      productRequirement: 'Wheat Bio-Fertilizer',
      dealValue: 75000,
      assignedEmployee: 'Ritesh Pandey',
      date: '14 Apr 2025',
      status: 'contacted',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    },
    {
      _id: 'lead_3',
      customerName: 'Vikash Singh',
      phone: '9876543212',
      village: 'Village: Kushinagar',
      productRequirement: 'Fertilizer & Pesticides',
      dealValue: 120000,
      assignedEmployee: 'Indresh Kumar',
      date: '16 Apr 2025',
      status: 'negotiation',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    },
    {
      _id: 'lead_4',
      customerName: 'Anil Chauhan',
      phone: '9876543213',
      village: 'Village: Maharajganj',
      productRequirement: 'Paddy Hybrid Seeds',
      dealValue: 85000,
      assignedEmployee: 'Ankit Shukla',
      date: '10 Apr 2025',
      status: 'won',
      avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
    },
  ];

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      const res = await (adminAPI.getLeads ? adminAPI.getLeads() : leadAPI.getAll?.()).catch(() => ({ data: { success: false } }));
      if (res?.data?.success && Array.isArray(res.data.leads) && res.data.leads.length > 0) {
        setLeads(res.data.leads);
      } else {
        setLeads(sampleLeads);
      }
    } catch (_) {
      setLeads(sampleLeads);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLeads();
  };

  const handleCall = (phone) => {
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  const handleWhatsApp = (phone) => {
    if (phone) Linking.openURL(`https://wa.me/${phone.replace(/[^0-9]/g, '')}`);
  };

  const filteredLeads = leads.filter((l) => {
    const statusMatch = l.status === activeTab;
    const query = search.toLowerCase().trim();
    if (!query) return statusMatch;
    const nameMatch = (l.customerName || '').toLowerCase().includes(query);
    const villageMatch = (l.village || '').toLowerCase().includes(query);
    const empMatch = (l.assignedEmployee || '').toLowerCase().includes(query);
    return statusMatch && (nameMatch || villageMatch || empMatch);
  });

  const getStatusPill = (status) => {
    switch (status) {
      case 'new':
        return <View style={[styles.statusTag, { backgroundColor: COLORS.primaryLight }]}><Text style={[styles.statusTagText, { color: COLORS.primary }]}>New Lead</Text></View>;
      case 'contacted':
        return <View style={[styles.statusTag, { backgroundColor: COLORS.indigoLight }]}><Text style={[styles.statusTagText, { color: COLORS.indigo }]}>Contacted</Text></View>;
      case 'negotiation':
        return <View style={[styles.statusTag, { backgroundColor: COLORS.warningLight }]}><Text style={[styles.statusTagText, { color: COLORS.warning }]}>Negotiation</Text></View>;
      case 'won':
        return <View style={[styles.statusTag, { backgroundColor: COLORS.successLight }]}><Text style={[styles.statusTagText, { color: COLORS.success }]}>Deal Won</Text></View>;
      case 'lost':
        return <View style={[styles.statusTag, { backgroundColor: COLORS.dangerLight }]}><Text style={[styles.statusTagText, { color: COLORS.danger }]}>Lost</Text></View>;
      default:
        return null;
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
              <Text style={styles.headerTitle}>Customer Leads</Text>
              <Text style={styles.headerSub}>Manage & Track Field Pipeline</Text>
            </View>
            <TouchableOpacity style={styles.headerAddBtn} activeOpacity={0.8}>
              <Plus size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* ── TABS BAR ── */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'new' && styles.tabItemActive]}
          onPress={() => setActiveTab('new')}
        >
          <Text style={[styles.tabText, activeTab === 'new' && styles.tabTextActive]}>New (5)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'contacted' && styles.tabItemActive]}
          onPress={() => setActiveTab('contacted')}
        >
          <Text style={[styles.tabText, activeTab === 'contacted' && styles.tabTextActive]}>Contacted</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'negotiation' && styles.tabItemActive]}
          onPress={() => setActiveTab('negotiation')}
        >
          <Text style={[styles.tabText, activeTab === 'negotiation' && styles.tabTextActive]}>Negotiation</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'won' && styles.tabItemActive]}
          onPress={() => setActiveTab('won')}
        >
          <Text style={[styles.tabText, activeTab === 'won' && styles.tabTextActive]}>Won</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'lost' && styles.tabItemActive]}
          onPress={() => setActiveTab('lost')}
        >
          <Text style={[styles.tabText, activeTab === 'lost' && styles.tabTextActive]}>Lost</Text>
        </TouchableOpacity>
      </View>

      {/* ── SEARCH BAR ── */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Search size={18} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search lead, farmer, village..."
            placeholderTextColor={COLORS.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {/* ── LEADS LIST ── */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={{ marginTop: 12, color: COLORS.textSub, fontFamily: FONT }}>Loading leads pipeline...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredLeads}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Sprout size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>No {activeTab} leads</Text>
              <Text style={styles.emptySub}>No customer leads currently in this stage.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const custAvatar = getAvatarUrl(item.avatar);
            const custInitials = getUserInitials(item.customerName);
            const custColor = getAvatarColor(item.customerName);

            return (
              <Surface style={[styles.leadCard, cardShadow]} elevation={1}>
                <View style={styles.cardTopRow}>
                  {custAvatar ? (
                    <Image
                      source={{ uri: custAvatar }}
                      style={styles.avatarImg}
                    />
                  ) : (
                    <View style={[styles.avatarFallback, { backgroundColor: custColor }]}>
                      <Text style={styles.avatarFallbackText}>{custInitials}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.custName}>{item.customerName}</Text>
                    <Text style={styles.villageText}>{item.village}</Text>
                    <Text style={styles.productReq}>
                      {item.productRequirement} • <Text style={{ fontWeight: '800', color: COLORS.primary }}>₹{Number(item.dealValue || 0).toLocaleString('en-IN')}</Text>
                    </Text>
                  </View>

                  {getStatusPill(item.status)}
                </View>

              <View style={styles.cardBottomRow}>
                <View style={styles.assignedBox}>
                  <Text style={styles.assignedLabel}>Assigned Staff:</Text>
                  <Text style={styles.assignedName}>{item.assignedEmployee}</Text>
                  <Text style={styles.dateText}>• {item.date}</Text>
                </View>

                <View style={styles.quickContactRow}>
                  <TouchableOpacity
                    style={[styles.contactBtn, { backgroundColor: '#DCFCE7' }]}
                    onPress={() => handleWhatsApp(item.phone)}
                    activeOpacity={0.7}
                  >
                    <MessageSquare size={16} color="#15803D" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.contactBtn, { backgroundColor: '#E0F2FE' }]}
                    onPress={() => handleCall(item.phone)}
                    activeOpacity={0.7}
                  >
                    <Phone size={16} color="#0369A1" />
                  </TouchableOpacity>
                </View>
              </View>
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
  headerAddBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 6,
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
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSub,
    fontFamily: FONT,
  },
  tabTextActive: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
    fontFamily: FONT,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  leadCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTopRow: {
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
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
    fontFamily: FONT,
  },
  custName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    fontFamily: FONT,
  },
  villageText: {
    fontSize: 12,
    color: COLORS.textSub,
    fontFamily: FONT,
    marginTop: 2,
  },
  productReq: {
    fontSize: 12,
    color: COLORS.text,
    fontFamily: FONT,
    marginTop: 4,
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusTagText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: FONT,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  assignedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  assignedLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontFamily: FONT,
  },
  assignedName: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    fontFamily: FONT,
  },
  dateText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontFamily: FONT,
  },
  quickContactRow: {
    flexDirection: 'row',
    gap: 8,
  },
  contactBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
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
