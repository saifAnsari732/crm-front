import React, { useState } from 'react';
import {
  StyleSheet, View, ScrollView, TouchableOpacity,
  Platform, RefreshControl, StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Surface } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Layers, CheckCircle2, Sparkles, Shield, Zap } from 'lucide-react-native';

const FONT = Platform.OS === 'ios' ? 'System' : 'sans-serif-medium';
const BG_COLOR = '#f8fafc';

const cardShadow = Platform.OS === 'web'
  ? { boxShadow: '0px 4px 14px rgba(15, 23, 42, 0.08)' }
  : { elevation: 3, shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } };

export default function AdminPlansScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  const plans = [
    {
      id: '1', name: 'Starter Plan', price: '₹ 1,999 / mo', desc: 'Ideal for small field teams up to 15 staff', color: '#2563eb',
      features: ['Up to 15 Employees', 'Live Location Tracking', '30-Day History Backup', 'Standard Reports']
    },
    {
      id: '2', name: 'Growth Pro Plan', price: '₹ 4,999 / mo', desc: 'Best for growing companies & multi-managers', color: '#e11d48', popular: true,
      features: ['Up to 50 Employees', 'Realtime Continuous Tracking', 'Unlimited History & Export', 'Custom Geofences & Visits', 'Manager Role Access']
    },
    {
      id: '3', name: 'Enterprise SaaS', price: '₹ 12,999 / mo', desc: 'Full power for large enterprise operations', color: '#7c3aed',
      features: ['Unlimited Employees', 'Custom Domain & Branding', 'Dedicated Account Manager', '24/7 Priority Phone Support', 'API & Webhook Integrations']
    }
  ];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#e11d48" />

      {/* HEADER */}
      <LinearGradient colors={['#e11d48', '#be123c']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerTitleRow}>
            <View style={styles.headerIconBox}>
              <Layers size={20} color="#fff" />
            </View>
            <View>
              <Text style={styles.headerTitle}>Subscription Plans & Quotas</Text>
              <Text style={styles.headerSub}>Manage pricing tiers, features & limits</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* BODY */}
      <ScrollView
        style={{ backgroundColor: BG_COLOR }}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e11d48" />}
      >
        <View style={styles.plansList}>
          {plans.map((p) => (
            <Surface key={p.id} style={[styles.planCard, cardShadow, p.popular && styles.planPopularBorder]} elevation={2}>
              {p.popular && (
                <View style={styles.popularBadge}>
                  <Sparkles size={10} color="#fff" />
                  <Text style={styles.popularText}>MOST POPULAR</Text>
                </View>
              )}

              <Text style={styles.planName}>{p.name}</Text>
              <Text style={styles.planDesc}>{p.desc}</Text>
              <Text style={[styles.planPrice, { color: p.color }]}>{p.price}</Text>

              <View style={styles.divider} />

              <View style={styles.featureList}>
                {p.features.map((feat, idx) => (
                  <View key={idx} style={styles.featureRow}>
                    <CheckCircle2 size={14} color={p.color} />
                    <Text style={styles.featureText}>{feat}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity style={[styles.editBtn, { backgroundColor: p.color }]}>
                <Text style={styles.editBtnText}>Manage Plan Quotas</Text>
              </TouchableOpacity>
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
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: 'bold', fontFamily: FONT },
  headerSub: { color: '#ffe4e6', fontSize: 10, marginTop: 1 },

  body: { padding: 14, maxWidth: 720, width: '100%', alignSelf: 'center' },
  plansList: { gap: 16 },
  planCard: { backgroundColor: '#fff', borderRadius: 20, padding: 18, position: 'relative' },
  planPopularBorder: { borderWidth: 2, borderColor: '#e11d48' },
  popularBadge: { position: 'absolute', top: -12, right: 16, backgroundColor: '#e11d48', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4 },
  popularText: { color: '#fff', fontSize: 8, fontWeight: 'bold' },

  planName: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', fontFamily: FONT },
  planDesc: { fontSize: 11, color: '#64748b', marginTop: 2 },
  planPrice: { fontSize: 20, fontWeight: 'bold', marginTop: 10, fontFamily: FONT },

  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 14 },
  featureList: { gap: 8, marginBottom: 16 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { fontSize: 12, color: '#334155', fontWeight: '500' },

  editBtn: { paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  editBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
});
