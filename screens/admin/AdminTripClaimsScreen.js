import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Dimensions,
  RefreshControl,
  Image,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Surface } from 'react-native-paper';
import {
  ArrowLeft,
  Car,
  MapPin,
  Calendar,
  Clock,
  Users,
  TrendingUp,
  Search,
  Filter,
  CheckCircle2,
  X,
  RefreshCw,
  Phone,
  Eye,
  Trash2,
  ChevronRight,
  Route,
} from 'lucide-react-native';
import { tripAPI, getAvatarUrl } from '../../services/api';
import { storage } from '../../services/storage';
import TripMapView from '../../components/TripMapView';

const { width } = Dimensions.get('window');

const DATE_FILTERS = [
  { label: 'All Dates', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
];

export default function AdminTripClaimsScreen() {
  const router = useRouter();

  const [trips, setTrips] = useState([]);
  const [summary, setSummary] = useState({ totalTrips: 0, totalKm: 0, totalPayout: 0, uniqueEmployees: 0 });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [selectedDateFilter, setSelectedDateFilter] = useState('all');
  const [selectedTripForMap, setSelectedTripForMap] = useState(null);

  const getTodayStr = () => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
  };

  const getYesterdayStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(d);
  };

  const fetchTrips = useCallback(async () => {
    try {
      setLoading(true);
      const params = { limit: 100 };
      if (selectedDateFilter === 'today') {
        params.date = getTodayStr();
      } else if (selectedDateFilter === 'yesterday') {
        params.date = getYesterdayStr();
      }

      const res = await tripAPI.getTeamTrips(params);
      if (res.data && res.data.success) {
        setTrips(res.data.trips || []);
        if (res.data.summary) {
          setSummary(res.data.summary);
        }
      }
    } catch (err) {
      console.warn('Backend team-trips notice:', err.response?.status || err.message);
      // Fallback: Read offline claims from local storage if server is syncing/deploying
      try {
        const offlineStr = await storage.getItem('offline_trip_claims');
        if (offlineStr) {
          const offlineClaims = JSON.parse(offlineStr);
          if (Array.isArray(offlineClaims) && offlineClaims.length > 0) {
            setTrips(offlineClaims);
            const totalKm = offlineClaims.reduce((acc, t) => acc + (Number(t.distanceKm) || 0), 0);
            const totalPayout = offlineClaims.reduce((acc, t) => acc + (Number(t.reimbursementAmount) || 0), 0);
            setSummary({
              totalTrips: offlineClaims.length,
              totalKm: Math.round(totalKm * 100) / 100,
              totalPayout: Math.round(totalPayout * 100) / 100,
              uniqueEmployees: 1,
            });
          }
        }
      } catch (storageErr) {
        // silent
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDateFilter]);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  const handleDeleteTrip = (tripId) => {
    Alert.alert(
      'Delete Trip Claim',
      'Are you sure you want to delete this trip claim record?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await tripAPI.deleteTripClaim(tripId);
              if (res.data && res.data.success) {
                fetchTrips();
              }
            } catch (err) {
              Alert.alert('Error', err.response?.data?.message || 'Failed to delete trip.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* ── TOP HEADER ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(admin)/dashboard'))}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color="#0f172a" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>Trip Route Claims</Text>
          <Text style={styles.headerSubtitle}>Org Admin & Manager Trip Ledger</Text>
        </View>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={fetchTrips}
          activeOpacity={0.7}
        >
          <RefreshCw size={18} color="#0f766e" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchTrips();
            }}
            tintColor="#0f766e"
          />
        }
      >
        {/* ── DATE FILTER PILLS ── */}
        <View style={styles.filterPillsRow}>
          {DATE_FILTERS.map((f) => (
            <TouchableOpacity
              key={f.value}
              style={[
                styles.filterPill,
                selectedDateFilter === f.value && styles.activeFilterPill,
              ]}
              onPress={() => setSelectedDateFilter(f.value)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterPillText,
                  selectedDateFilter === f.value && styles.activeFilterPillText,
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── 4 KPI SUMMARY CARDS ── */}
        <View style={styles.kpiGrid}>
          {/* Total Claims */}
          <Surface style={styles.kpiCard} elevation={1}>
            <View style={[styles.kpiIconBox, { backgroundColor: '#eff6ff' }]}>
              <Car size={16} color="#2563eb" />
            </View>
            <Text style={styles.kpiLabel}>TOTAL TRIPS</Text>
            <Text style={styles.kpiVal}>{summary.totalTrips}</Text>
          </Surface>

          {/* Total KM */}
          <Surface style={styles.kpiCard} elevation={1}>
            <View style={[styles.kpiIconBox, { backgroundColor: '#f0fdf4' }]}>
              <Route size={16} color="#16a34a" />
            </View>
            <Text style={styles.kpiLabel}>ROAD DISTANCE</Text>
            <Text style={[styles.kpiVal, { color: '#16a34a' }]}>{summary.totalKm} KM</Text>
          </Surface>

          {/* Total Payout */}
          <Surface style={styles.kpiCard} elevation={1}>
            <View style={[styles.kpiIconBox, { backgroundColor: '#fef3c7' }]}>
              <TrendingUp size={16} color="#d97706" />
            </View>
            <Text style={styles.kpiLabel}>TOTAL PAYOUT</Text>
            <Text style={[styles.kpiVal, { color: '#d97706' }]}>₹{summary.totalPayout}</Text>
          </Surface>

          {/* Claimants */}
          <Surface style={styles.kpiCard} elevation={1}>
            <View style={[styles.kpiIconBox, { backgroundColor: '#f5f3ff' }]}>
              <Users size={16} color="#7c3aed" />
            </View>
            <Text style={styles.kpiLabel}>CLAIMANTS</Text>
            <Text style={[styles.kpiVal, { color: '#7c3aed' }]}>{summary.uniqueEmployees}</Text>
          </Surface>
        </View>

        {/* ── SECTION HEADER ── */}
        <View style={styles.listSectionHeader}>
          <Text style={styles.listSectionTitle}>ALL SUBMITTED TRIP CLAIMS</Text>
          <Text style={styles.listSectionCount}>({trips.length} Records)</Text>
        </View>

        {/* ── CLAIMS LIST ── */}
        {loading && !refreshing ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#0f766e" />
            <Text style={styles.loadingText}>Fetching trip claims...</Text>
          </View>
        ) : trips.length === 0 ? (
          <Surface style={styles.emptyCard} elevation={1}>
            <Car size={40} color="#94a3b8" />
            <Text style={styles.emptyTitle}>No Trip Route Claims Found</Text>
            <Text style={styles.emptySubtitle}>
              When employees plan journeys and claim road distance, their detailed routes and allowances will appear here.
            </Text>
          </Surface>
        ) : (
          trips.map((item) => {
            const empName = item.employee?.name || 'Employee';
            const empRole = (item.employee?.role || 'Staff').toUpperCase();
            const avatarUri = getAvatarUrl(item.employee?.avatar);

            return (
              <Surface key={item._id} style={styles.claimCard} elevation={1}>
                {/* Employee Info Header Row */}
                <View style={styles.claimCardTop}>
                  <View style={styles.empRow}>
                    {avatarUri ? (
                      <Image source={{ uri: avatarUri }} style={styles.empAvatar} />
                    ) : (
                      <View style={styles.avatarFallback}>
                        <Text style={styles.avatarFallbackText}>
                          {empName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={styles.empDetails}>
                      <Text style={styles.empNameText}>{empName}</Text>
                      <View style={styles.empMetaRow}>
                        <View style={styles.roleBadge}>
                          <Text style={styles.roleBadgeText}>{empRole}</Text>
                        </View>
                        {item.employee?.phone ? (
                          <View style={styles.phoneRow}>
                            <Phone size={10} color="#64748b" />
                            <Text style={styles.phoneText}>{item.employee.phone}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </View>

                  {/* Status badge */}
                  <View style={styles.statusBadge}>
                    <CheckCircle2 size={12} color="#16a34a" />
                    <Text style={styles.statusBadgeText}>CREDITED</Text>
                  </View>
                </View>

                {/* Route: Origin ➔ Destination */}
                <View style={styles.routeDetailsBox}>
                  <View style={styles.routeConnectorCol}>
                    <View style={styles.dotOrigin} />
                    <View style={styles.lineConnector} />
                    <View style={styles.squareDest} />
                  </View>
                  <View style={styles.routeAddressesCol}>
                    <View style={styles.addressLine}>
                      <Text style={styles.addressLabel}>FROM:</Text>
                      <Text style={styles.addressVal} numberOfLines={1}>
                        {item.origin?.address || 'Pickup'}
                      </Text>
                    </View>
                    <View style={styles.addressLine}>
                      <Text style={styles.addressLabel}>TO:</Text>
                      <Text style={styles.addressVal} numberOfLines={1}>
                        {item.destination?.address || 'Destination'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Metrics Row: KM, Time, Payout, Purpose */}
                <View style={styles.metricsStrip}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricItemLabel}>ROAD KM</Text>
                    <Text style={styles.metricItemVal}>{item.distanceKm} KM</Text>
                  </View>
                  <View style={styles.metricDivider} />
                  <View style={styles.metricItem}>
                    <Text style={styles.metricItemLabel}>EST. TIME</Text>
                    <Text style={styles.metricItemVal}>{item.durationMins || 0} mins</Text>
                  </View>
                  <View style={styles.metricDivider} />
                  <View style={styles.metricItem}>
                    <Text style={styles.metricItemLabel}>ALLOWANCE</Text>
                    <Text style={[styles.metricItemVal, { color: '#16a34a' }]}>
                      ₹{item.reimbursementAmount}
                    </Text>
                  </View>
                </View>

                {/* Purpose & Client details */}
                <View style={styles.purposeMetaRow}>
                  <View style={styles.purposeTag}>
                    <Text style={styles.purposeTagText}>{item.purpose || 'Client Visit'}</Text>
                  </View>
                  {item.clientName ? (
                    <Text style={styles.clientNameText} numberOfLines={1}>
                      Client: {item.clientName}
                    </Text>
                  ) : null}
                  <View style={{ flex: 1 }} />
                  <Text style={styles.dateStampText}>
                    {item.date} • {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>

                {/* Actions: View Map Route & Delete */}
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={styles.viewRouteBtn}
                    onPress={() => setSelectedTripForMap(item)}
                    activeOpacity={0.7}
                  >
                    <Eye size={14} color="#0f766e" />
                    <Text style={styles.viewRouteBtnText}>View Map Route</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDeleteTrip(item._id)}
                    activeOpacity={0.7}
                  >
                    <Trash2 size={14} color="#dc2626" />
                  </TouchableOpacity>
                </View>
              </Surface>
            );
          })
        )}
      </ScrollView>

      {/* ── INTERACTIVE ROUTE MAP MODAL ── */}
      {selectedTripForMap && (
        <Modal
          visible={true}
          transparent
          animationType="slide"
          onRequestClose={() => setSelectedTripForMap(null)}
        >
          <View style={styles.mapModalOverlay}>
            <Surface style={styles.mapModalCard} elevation={6}>
              <View style={styles.mapModalHeader}>
                <View>
                  <Text style={styles.mapModalTitle}>
                    {selectedTripForMap.employee?.name || 'Employee'}'s Trip Route
                  </Text>
                  <Text style={styles.mapModalSubtitle}>
                    {selectedTripForMap.distanceKm} KM • ₹{selectedTripForMap.reimbursementAmount} Allowance
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.mapModalCloseBtn}
                  onPress={() => setSelectedTripForMap(null)}
                >
                  <X size={20} color="#64748b" />
                </TouchableOpacity>
              </View>

              {/* Map Preview */}
              <View style={styles.mapModalCanvas}>
                <TripMapView
                  origin={selectedTripForMap.origin}
                  destination={selectedTripForMap.destination}
                  polyline={selectedTripForMap.polyline || []}
                />
              </View>

              {/* Addresses Summary Footer */}
              <View style={styles.mapModalFooter}>
                <View style={styles.footerAddressRow}>
                  <View style={styles.footerOriginDot} />
                  <Text style={styles.footerAddressText} numberOfLines={1}>
                    From: {selectedTripForMap.origin?.address}
                  </Text>
                </View>
                <View style={styles.footerAddressRow}>
                  <View style={styles.footerDestSquare} />
                  <Text style={styles.footerAddressText} numberOfLines={1}>
                    To: {selectedTripForMap.destination?.address}
                  </Text>
                </View>
              </View>
            </Surface>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#ffffff',
    paddingTop: Platform.OS === 'ios' ? 52 : 44,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0fdfa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterPill: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  activeFilterPill: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  activeFilterPillText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  kpiCard: {
    width: (width - 42) / 2,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  kpiIconBox: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  kpiLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.3,
  },
  kpiVal: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  listSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  listSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.4,
  },
  listSectionCount: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  loadingBox: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748b',
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
    maxWidth: 280,
  },
  claimCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  claimCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  empRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  empAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  avatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#0f766e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  empDetails: {
    gap: 2,
  },
  empNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  empMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roleBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#475569',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  phoneText: {
    fontSize: 11,
    color: '#64748b',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#16a34a',
  },
  routeDetailsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  routeConnectorCol: {
    alignItems: 'center',
    marginRight: 10,
    paddingVertical: 2,
  },
  dotOrigin: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10b981',
  },
  lineConnector: {
    width: 1.5,
    height: 18,
    backgroundColor: '#cbd5e1',
    marginVertical: 2,
  },
  squareDest: {
    width: 7,
    height: 7,
    backgroundColor: '#ef4444',
    borderRadius: 1.5,
  },
  routeAddressesCol: {
    flex: 1,
    gap: 6,
  },
  addressLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addressLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#94a3b8',
    width: 36,
  },
  addressVal: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
  },
  metricsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricItemLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.3,
  },
  metricItemVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#e2e8f0',
  },
  purposeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  purposeTag: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  purposeTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2563eb',
  },
  clientNameText: {
    fontSize: 11.5,
    color: '#475569',
    fontWeight: '500',
    maxWidth: 130,
  },
  dateStampText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
  },
  viewRouteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdfa',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 6,
  },
  viewRouteBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f766e',
  },
  deleteBtn: {
    padding: 6,
  },
  mapModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'flex-end',
  },
  mapModalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '75%',
    overflow: 'hidden',
  },
  mapModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  mapModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  mapModalSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  mapModalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapModalCanvas: {
    flex: 1,
    width: '100%',
  },
  mapModalFooter: {
    padding: 14,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 6,
  },
  footerAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerOriginDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  footerDestSquare: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: '#ef4444',
  },
  footerAddressText: {
    fontSize: 12,
    color: '#334155',
    flex: 1,
  },
});
