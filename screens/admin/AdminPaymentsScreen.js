import React, { useState } from 'react';
import {
  StyleSheet, View, ScrollView, TouchableOpacity,
  Platform, RefreshControl, StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Surface } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import {
  CreditCard, ArrowUpRight, CheckCircle2, Clock, Filter,
  FileText, Download, ShieldCheck
} from 'lucide-react-native';

const FONT = Platform.OS === 'ios' ? 'System' : 'sans-serif-medium';
const NAVY_DARK = '#0f172a';
const NAVY_MID = '#1e293b';
const BG_COLOR = '#f8fafc';

const cardShadow = Platform.OS === 'web'
  ? { boxShadow: '0px 4px 14px rgba(15, 23, 42, 0.08)' }
  : { elevation: 3, shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } };

export default function AdminPaymentsScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  const transactions = [
    { id: 'TXN-9081', org: 'AgriCorp Solutions', plan: 'Growth Pro Monthly', amount: '₹4,999', date: 'Today, 10:45 AM', method: 'Razorpay UPI', status: 'Success' },
    { id: 'TXN-9080', org: 'Global Tech Systems', plan: 'Enterprise Annual', amount: '₹1,29,999', date: 'Yesterday, 04:20 PM', method: 'Razorpay HDFC Bank', status: 'Success' },
    { id: 'TXN-9079', org: 'Zenith Logistics', plan: 'Starter Monthly', amount: '₹1,999', date: '26 Apr 2025', method: 'Razorpay Card', status: 'Success' },
    { id: 'TXN-9078', org: 'Kisan Choice Pvt Ltd', plan: 'Trial Upgrade', amount: '₹4,999', date: '24 Apr 2025', method: 'Razorpay UPI', status: 'Pending' },
  ];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY_DARK} />

      {/* HEADER */}
      <LinearGradient colors={[NAVY_DARK, NAVY_MID]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerTitleRow}>
            <View style={styles.headerIconBox}>
              <CreditCard size={20} color="#fff" />
            </View>
            <View>
              <Text style={styles.headerTitle}>Revenue & Payment Gateways</Text>
              <Text style={styles.headerSub}>Razorpay Live Multi-Tenant Settlements</Text>
            </View>
          </View>

          <Surface style={[styles.totalCard, cardShadow]} elevation={2}>
            <View style={styles.totalCardInner}>
              <View>
                <Text style={styles.totalLabel}>TOTAL PLATFORM REVENUE</Text>
                <Text style={styles.totalVal}>₹ 4,82,000</Text>
                <Text style={styles.totalSub}>100% Settled via Razorpay</Text>
              </View>
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE GATEWAY</Text>
              </View>
            </View>
          </Surface>
        </SafeAreaView>
      </LinearGradient>

      {/* BODY */}
      <ScrollView
        style={{ backgroundColor: BG_COLOR }}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />}
      >
        <Text style={styles.sectionTitle}>Recent Transactions</Text>

        <View style={styles.txnList}>
          {transactions.map((t) => (
            <Surface key={t.id} style={[styles.txnCard, cardShadow]} elevation={1}>
              <View style={styles.txnRow}>
                <View style={[styles.iconBox, t.status === 'Success' ? styles.iconSuccess : styles.iconPending]}>
                  <ArrowUpRight size={18} color={t.status === 'Success' ? '#16a34a' : '#d97706'} />
                </View>

                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.orgName}>{t.org}</Text>
                  <Text style={styles.planName}>{t.plan} • {t.method}</Text>
                  <Text style={styles.dateText}>{t.date}</Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.amountText}>{t.amount}</Text>
                  <View style={[styles.statusTag, t.status === 'Success' ? styles.tagSuccess : styles.tagPending]}>
                    <Text style={[styles.statusText, t.status === 'Success' ? styles.textSuccess : styles.textPending]}>
                      {t.status}
                    </Text>
                  </View>
                </View>
              </View>
            </Surface>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG_COLOR },
  header: { paddingHorizontal: 16, paddingBottom: 20, paddingTop: Platform.OS === 'android' ? 10 : 0 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  headerIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: 'bold', fontFamily: FONT },
  headerSub: { color: '#94a3b8', fontSize: 10, marginTop: 1 },

  totalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  totalCardInner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 10, color: '#64748b', fontWeight: 'bold', letterSpacing: 0.5 },
  totalVal: { fontSize: 24, fontWeight: 'bold', color: '#0f172a', fontFamily: FONT, marginTop: 2 },
  totalSub: { fontSize: 11, color: '#16a34a', fontWeight: '600', marginTop: 2 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0fdf4', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, gap: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' },
  liveText: { color: '#16a34a', fontSize: 9, fontWeight: 'bold' },

  body: { padding: 14, maxWidth: 720, width: '100%', alignSelf: 'center' },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#0f172a', marginBottom: 12, fontFamily: FONT },
  txnList: { gap: 10 },
  txnCard: { backgroundColor: '#fff', borderRadius: 14, padding: 12 },
  txnRow: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  iconSuccess: { backgroundColor: '#dcfce7' },
  iconPending: { backgroundColor: '#fef3c7' },
  orgName: { fontSize: 13, fontWeight: 'bold', color: '#0f172a', fontFamily: FONT },
  planName: { fontSize: 11, color: '#64748b', marginTop: 1 },
  dateText: { fontSize: 10, color: '#94a3b8', marginTop: 2 },
  amountText: { fontSize: 14, fontWeight: 'bold', color: '#0f172a', fontFamily: FONT },
  statusTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 4 },
  tagSuccess: { backgroundColor: '#f0fdf4' },
  tagPending: { backgroundColor: '#fffbeb' },
  statusText: { fontSize: 9, fontWeight: 'bold' },
  textSuccess: { color: '#16a34a' },
  textPending: { color: '#d97706' },
});
