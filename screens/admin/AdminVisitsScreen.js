import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Platform, RefreshControl,
  StyleSheet, TextInput, TouchableOpacity, View, Image,
  Modal, ScrollView, Alert, KeyboardAvoidingView
} from 'react-native';
import {
  BriefcaseBusiness, CalendarDays, CheckCircle2, Clock3, MapPin, Search, XCircle,
  Plus, Camera, X, User, Phone, Briefcase
} from 'lucide-react-native';
import { Text, Surface } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { meetingAPI, uploadAPI, getAvatarUrl } from '../../services/api';
import { useSettings } from '../../context/SettingsContext';

const FONT = Platform.OS === 'ios' ? 'System' : 'sans-serif-medium';
const statusOptions = ['all', 'scheduled', 'completed', 'follow-up', 'cancelled'];

const formatFullName = (str) => {
  if (!str) return 'Field Executive';
  return String(str)
    .trim()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
};

const formatDate = (value) => value
  ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  : 'Date not available';

const statusConfig = {
  scheduled: { label: 'Scheduled', color: '#2563eb', background: '#dbeafe', icon: Clock3 },
  completed: { label: 'Completed', color: '#15803d', background: '#dcfce7', icon: CheckCircle2 },
  'follow-up': { label: 'Follow-up', color: '#a16207', background: '#fef3c7', icon: CalendarDays },
  cancelled: { label: 'Cancelled', color: '#b91c1c', background: '#fee2e2', icon: XCircle },
};

export default function AdminVisitsScreen() {
  const { theme } = useSettings();
  const isDark = theme === 'dark';
  const C = {
    bg: isDark ? '#0f172a' : '#f8fafc',
    surface: isDark ? '#1e293b' : '#fff',
    text: isDark ? '#f8fafc' : '#0f172a',
    sub: isDark ? '#94a3b8' : '#64748b',
    border: isDark ? '#334155' : '#e2e8f0',
  };
  const [visits, setVisits] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Log Manager Visit Modal States
  const [modalVisible, setModalVisible] = useState(false);
  const [clientName, setClientName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [meetingAddress, setMeetingAddress] = useState('');
  const [visitStatus, setVisitStatus] = useState('completed');
  const [meetingNotes, setMeetingNotes] = useState('');
  const [dealAmount, setDealAmount] = useState('');
  const [selfieImage, setSelfieImage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [fetchingLocation, setFetchingLocation] = useState(false);

  const [previewPhotoUrl, setPreviewPhotoUrl] = useState(null);

  const fetchVisits = useCallback(async () => {
    try {
      const response = await meetingAPI.getAll({ limit: 200 });
      if (response.data?.success) setVisits(response.data.meetings || []);
      else setVisits([]);
    } catch (error) {
      console.log('Admin visits fetch error:', error.message);
      setVisits([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchVisits(); }, [fetchVisits]);

  const handleFetchCurrentLocation = async () => {
    try {
      setFetchingLocation(true);
      const { status: permStatus } = await Location.requestForegroundPermissionsAsync();
      if (permStatus !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to fetch current address.');
        return;
      }

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = position.coords;
      const geocoded = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (geocoded && geocoded.length > 0) {
        const res = geocoded[0];
        const parts = [res.street, res.district, res.city, res.region, res.postalCode].filter(p => p && p.trim());
        setMeetingAddress(parts.join(', ') || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
      } else {
        setMeetingAddress(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
      }
    } catch (err) {
      console.log('Location fetch error:', err.message);
      Alert.alert('Error', 'Failed to fetch location address.');
    } finally {
      setFetchingLocation(false);
    }
  };

  const handleCaptureSelfie = async () => {
    try {
      if (Platform.OS !== 'web') {
        const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
        if (!permissionResult.granted) {
          Alert.alert('Permission Denied', 'Camera permission is required to capture selfie.');
          return;
        }
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelfieImage(result.assets[0]);
      }
    } catch (error) {
      console.log('Error capturing selfie:', error);
      Alert.alert('Error', 'Failed to capture selfie.');
    }
  };

  const handleOpenAddModal = () => {
    setClientName('');
    setMobileNumber('');
    setMeetingAddress('');
    setVisitStatus('completed');
    setMeetingNotes('');
    setDealAmount('');
    setSelfieImage(null);
    setModalVisible(true);
  };

  const handleSaveVisit = async () => {
    if (!clientName.trim() || !mobileNumber.trim() || !meetingAddress.trim()) {
      Alert.alert('Required Fields', 'Please fill Client Name, Mobile, and Visit Address.');
      return;
    }

    try {
      setSubmitting(true);
      let uploadedSelfieUrl = null;

      if (selfieImage) {
        let uploadRes;
        const uriToUpload = selfieImage.uri || selfieImage;

        if (Platform.OS === 'web') {
          const formData = new FormData();
          const response = await fetch(uriToUpload);
          const blob = await response.blob();
          formData.append('image', blob, `visit_selfie_${Date.now()}.jpg`);
          formData.append('folder', '/crm-tracker/meetings');
          uploadRes = await uploadAPI.uploadImageFormData(formData);
        } else {
          uploadRes = await uploadAPI.uploadImageFormData(uriToUpload);
        }

        if (uploadRes && uploadRes.data) {
          uploadedSelfieUrl = uploadRes.data.url || uploadRes.data.imageUrl || uploadRes.data.data?.url || uploadRes.data.fileUrl;
        }

        if (!uploadedSelfieUrl) {
          Alert.alert('Upload Failed', uploadRes?.data?.message || 'Failed to upload visit selfie. Please try again.');
          setSubmitting(false);
          return;
        }
      }

      const data = {
        clientName: clientName.trim(),
        mobileNumber: mobileNumber.trim(),
        meetingAddress: meetingAddress.trim(),
        status: visitStatus,
        meetingNotes: meetingNotes.trim(),
        ...(dealAmount ? { dealAmount: parseFloat(dealAmount) || 0 } : {}),
        ...(uploadedSelfieUrl && { selfieUrl: uploadedSelfieUrl }),
      };

      const res = await meetingAPI.create(data);
      if (res.data?.success) {
        Alert.alert('Success', 'Visit report submitted to organization successfully!');
        setModalVisible(false);
        fetchVisits();
      } else {
        Alert.alert('Error', res.data?.message || 'Failed to log visit.');
      }
    } catch (err) {
      console.log('Error saving visit:', err.message);
      Alert.alert('Error', err.response?.data?.message || 'Could not save visit report.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredVisits = useMemo(() => visits.filter((visit) => {
    const query = search.toLowerCase();
    const haystack = [
      visit.clientName, visit.companyName, visit.meetingAddress,
      visit.employee?.name, visit.employee?.department,
    ].filter(Boolean).join(' ').toLowerCase();
    const matchesSearch = !query || haystack.includes(query);
    const matchesStatus = status === 'all' || visit.status === status;
    const matchesDate = !date || new Date(visit.date).toISOString().slice(0, 10) === date;
    return matchesSearch && matchesStatus && matchesDate;
  }), [date, search, status, visits]);

  const counts = useMemo(() => ({
    all: visits.length,
    scheduled: visits.filter((visit) => visit.status === 'scheduled').length,
    completed: visits.filter((visit) => visit.status === 'completed').length,
    followUp: visits.filter((visit) => visit.status === 'follow-up').length,
  }), [visits]);

  const onRefresh = async () => { setRefreshing(true); await fetchVisits(); };

  if (loading) {
    return <View style={[styles.center, { backgroundColor: C.bg }]}><ActivityIndicator size="large" color="#283b96" /><Text style={[styles.loadingText, { color: C.sub }]}>Loading visits...</Text></View>;
  }

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      <FlatList
        data={filteredVisits}
        keyExtractor={(item, index) => String(item._id || index)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.content}
        ListHeaderComponent={(
          <View>
            {/* Screen Header Bar with "+ Log Visit" */}
            <View style={styles.topHeaderBar}>
              <View>
                <Text style={[styles.screenHeaderTitle, { color: C.text }]}>Client Visits & Meetings</Text>
                <Text style={[styles.screenHeaderSub, { color: C.sub }]}>Organization Visit Reports & Log</Text>
              </View>
              <TouchableOpacity style={styles.addVisitBtnHeader} onPress={handleOpenAddModal} activeOpacity={0.85}>
                <Plus size={16} color="#fff" />
                <Text style={styles.addVisitBtnText}>Log Visit</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.summaryRow}>
              <Summary label="ALL" value={counts.all} color="#283b96" />
              <Summary label="SCHEDULED" value={counts.scheduled} color="#2563eb" />
              <Summary label="DONE" value={counts.completed} color="#15803d" />
              <Summary label="FOLLOW-UP" value={counts.followUp} color="#a16207" />
            </View>

            <View style={[styles.searchBox, { backgroundColor: C.surface, borderColor: C.border }]}><Search size={15} color={C.sub} /><TextInput style={[styles.searchInput, { color: C.text }]} value={search} onChangeText={setSearch} placeholder="Search employee or client..." placeholderTextColor={C.sub} /></View>
            <View style={styles.filterRow}>
              <View style={[styles.dateBox, { backgroundColor: C.surface, borderColor: C.border }]}><CalendarDays size={15} color={C.sub} /><TextInput style={[styles.dateInput, { color: C.text }]} value={date} onChangeText={setDate} placeholder="Choose date" placeholderTextColor={C.sub} {...(Platform.OS === 'web' ? { type: 'date' } : {})} /></View>
              <View style={styles.statusScroll}>{statusOptions.map((option) => <TouchableOpacity key={option} style={[styles.statusChip, { backgroundColor: status === option ? '#283b96' : C.surface, borderColor: status === option ? '#283b96' : C.border }]} onPress={() => setStatus(option)}><Text style={[styles.statusChipText, { color: status === option ? '#fff' : C.sub }]}>{option.toUpperCase()}</Text></TouchableOpacity>)}</View>
            </View>
            <Text style={[styles.resultsLabel, { color: C.sub }]}>{filteredVisits.length} visit{filteredVisits.length === 1 ? '' : 's'} shown</Text>
          </View>
        )}
        ListEmptyComponent={<View style={styles.empty}><BriefcaseBusiness size={38} color={C.sub} /><Text style={[styles.emptyTitle, { color: C.text }]}>No visits found</Text><Text style={[styles.emptyText, { color: C.sub }]}>Try changing the date, status, or search filter.</Text></View>}
        renderItem={({ item }) => <VisitCard visit={item} colors={C} onPreviewPhoto={(url) => setPreviewPhotoUrl(url)} />}
      />

      {/* Photo Preview Modal Overlay */}
      <Modal visible={!!previewPhotoUrl} transparent animationType="fade" onRequestClose={() => setPreviewPhotoUrl(null)}>
        <View style={styles.previewOverlay}>
          <TouchableOpacity style={styles.previewCloseBtn} onPress={() => setPreviewPhotoUrl(null)} activeOpacity={0.8}>
            <X size={26} color="#fff" />
          </TouchableOpacity>
          {previewPhotoUrl ? (
            <Image source={{ uri: previewPhotoUrl }} style={styles.previewFullImage} resizeMode="contain" />
          ) : null}
        </View>
      </Modal>

      {/* Log Visit Modal Overlay */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Log Client Visit Report</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseBtn}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 18 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Client / Company Name *</Text>
              <TextInput
                style={styles.formInput}
                value={clientName}
                onChangeText={setClientName}
                placeholder="e.g. Ramesh Agro Store"
                placeholderTextColor="#94a3b8"
              />

              <Text style={styles.inputLabel}>Mobile / Contact No *</Text>
              <TextInput
                style={styles.formInput}
                value={mobileNumber}
                onChangeText={setMobileNumber}
                placeholder="e.g. 9876543210"
                keyboardType="phone-pad"
                placeholderTextColor="#94a3b8"
              />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
                <Text style={styles.inputLabel}>Visit Location Address *</Text>
                <TouchableOpacity onPress={handleFetchCurrentLocation} disabled={fetchingLocation} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  {fetchingLocation ? <ActivityIndicator size="small" color="#2563eb" /> : <MapPin size={12} color="#2563eb" />}
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#2563eb' }}>Use GPS</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.formInput}
                value={meetingAddress}
                onChangeText={setMeetingAddress}
                placeholder="Enter client location address..."
                placeholderTextColor="#94a3b8"
              />

              <Text style={styles.inputLabel}>Visit Status</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                {['completed', 'scheduled', 'follow-up'].map((st) => (
                  <TouchableOpacity
                    key={st}
                    style={[styles.statusChipSelect, visitStatus === st && styles.statusChipSelectActive]}
                    onPress={() => setVisitStatus(st)}
                  >
                    <Text style={[styles.statusChipSelectText, visitStatus === st && { color: '#fff' }]}>
                      {st.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Deal / Order Value (₹ Optional)</Text>
              <TextInput
                style={styles.formInput}
                value={dealAmount}
                onChangeText={setDealAmount}
                placeholder="e.g. 50000"
                keyboardType="numeric"
                placeholderTextColor="#94a3b8"
              />

              <Text style={styles.inputLabel}>Visit Notes & Discussion</Text>
              <TextInput
                style={[styles.formInput, { height: 75, textAlignVertical: 'top' }]}
                value={meetingNotes}
                onChangeText={setMeetingNotes}
                placeholder="Enter discussion notes, requirement, or feedback..."
                multiline
                placeholderTextColor="#94a3b8"
              />

              <Text style={styles.inputLabel}>Selfie Photo Verification</Text>
              <TouchableOpacity style={styles.selfiePickerBox} onPress={handleCaptureSelfie} activeOpacity={0.8}>
                {selfieImage ? (
                  <Image source={{ uri: selfieImage.uri }} style={{ width: '100%', height: 160, borderRadius: 12 }} />
                ) : (
                  <View style={{ alignItems: 'center' }}>
                    <Camera size={26} color="#2563eb" />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#2563eb', marginTop: 6 }}>Take Visit Selfie</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.saveSubmitBtn} onPress={handleSaveVisit} disabled={submitting} activeOpacity={0.85}>
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveSubmitBtnText}>Submit Visit Report</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function Summary({ label, value, color }) {
  return <View style={styles.summaryCard}><Text style={[styles.summaryValue, { color }]}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></View>;
}

function VisitCard({ visit, colors, onPreviewPhoto }) {
  const config = statusConfig[visit.status] || statusConfig.scheduled;
  const StatusIcon = config.icon;
  const [expanded, setExpanded] = useState(false);
  const selfieUri = getAvatarUrl(visit.selfieUrl);

  return (
    <Surface style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} elevation={1}>
      <TouchableOpacity onPress={() => setExpanded(!expanded)} activeOpacity={0.8}>
        <View style={styles.cardTop}>
          {selfieUri ? (
            <TouchableOpacity onPress={() => onPreviewPhoto && onPreviewPhoto(selfieUri)} activeOpacity={0.85}>
              <Image source={{ uri: selfieUri }} style={styles.cardSelfieThumb} />
            </TouchableOpacity>
          ) : (
            <View style={styles.clientIcon}><BriefcaseBusiness size={18} color="#2563eb" /></View>
          )}
          <View style={styles.cardMain}>
            <Text style={[styles.clientName, { color: colors.text }]}>{visit.clientName || 'Unnamed client'}</Text>
            <Text style={[styles.company, { color: colors.sub }]}>{visit.companyName || 'Independent visit'}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: config.background }]}>
            <StatusIcon size={12} color={config.color} />
            <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.sub }]}>Staff Member</Text>
          <Text style={[styles.detailValue, { color: colors.text }]}>{formatFullName(visit.employee?.name || visit.employeeName || 'Field Executive')}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.sub }]}>Date</Text>
          <Text style={[styles.detailValue, { color: colors.text }]}>{formatDate(visit.date)}</Text>
        </View>

        {visit.meetingAddress ? (
          <View style={styles.locationRow}>
            <MapPin size={12} color={colors.sub} style={{ marginTop: 2 }} />
            <Text style={[styles.locationText, { color: colors.sub }]} numberOfLines={expanded ? undefined : 1}>
              {visit.meetingAddress}
            </Text>
          </View>
        ) : null}

        {expanded && (
          <View style={styles.expandedContent}>
            {visit.mobileNumber && (
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.sub }]}>Phone</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>{visit.mobileNumber}</Text>
              </View>
            )}
            {visit.dealAmount > 0 && (
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.sub }]}>Deal Amount</Text>
                <Text style={[styles.detailValue, { color: '#008080' }]}>₹{Number(visit.dealAmount).toLocaleString('en-IN')}</Text>
              </View>
            )}
            {visit.followUpDate && (
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.sub }]}>Follow-up</Text>
                <Text style={[styles.detailValue, { color: '#a16207' }]}>{formatDate(visit.followUpDate)}</Text>
              </View>
            )}
            {visit.meetingNotes && (
              <View style={styles.notesBox}>
                <Text style={[styles.notesLabel, { color: colors.sub }]}>Notes / Feedback</Text>
                <Text style={[styles.notesText, { color: colors.text }]}>{visit.meetingNotes}</Text>
              </View>
            )}
            {selfieUri && (
              <TouchableOpacity style={styles.selfieBox} onPress={() => onPreviewPhoto && onPreviewPhoto(selfieUri)} activeOpacity={0.85}>
                <Text style={[styles.notesLabel, { color: colors.sub, marginBottom: 6 }]}>Visit Selfie (Tap to Preview)</Text>
                <Image source={{ uri: selfieUri }} style={styles.visitSelfie} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {!expanded && visit.dealAmount > 0 && (
          <Text style={styles.amount}>Deal: ₹{Number(visit.dealAmount).toLocaleString('en-IN')}</Text>
        )}
      </TouchableOpacity>
    </Surface>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, marginTop: 30 },
  topHeaderBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  screenHeaderTitle: { fontSize: 18, fontWeight: '800', fontFamily: FONT },
  screenHeaderSub: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  addVisitBtnHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0a3d3c', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  addVisitBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  content: { padding: 16, paddingBottom: 32 },
  summaryRow: { flexDirection: 'row', gap: 7, marginBottom: 12 },
  summaryCard: { flex: 1, minHeight: 62, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 1 },
  summaryValue: { fontFamily: FONT, fontSize: 18, fontWeight: 'bold' },
  summaryLabel: { fontFamily: FONT, color: '#64748b', fontSize: 8, fontWeight: 'bold', marginTop: 3 },
  searchBox: { height: 42, borderWidth: 1, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, marginBottom: 10 },
  searchInput: { flex: 1, fontFamily: FONT, fontSize: 12 },
  filterRow: { gap: 8, marginBottom: 4 },
  dateBox: { height: 42, borderWidth: 1, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12 },
  dateInput: { flex: 1, fontFamily: FONT, fontSize: 12 },
  statusScroll: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 6 },
  statusChip: { borderWidth: 1, borderRadius: 15, paddingHorizontal: 10, paddingVertical: 6 },
  statusChipText: { fontFamily: FONT, fontSize: 9, fontWeight: 'bold' },
  resultsLabel: { fontFamily: FONT, fontSize: 11, marginVertical: 10, fontWeight: '700' },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  clientIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#e8edff', alignItems: 'center', justifyContent: 'center' },
  cardMain: { flex: 1, marginLeft: 10 },
  clientName: { fontFamily: FONT, fontSize: 14, fontWeight: 'bold' },
  company: { fontFamily: FONT, fontSize: 11, marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 14, paddingHorizontal: 8, paddingVertical: 5 },
  statusText: { fontFamily: FONT, fontSize: 9, fontWeight: 'bold' },
  divider: { height: 1, marginVertical: 10 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  detailLabel: { fontFamily: FONT, fontSize: 10 },
  detailValue: { fontFamily: FONT, fontSize: 11, fontWeight: 'bold', maxWidth: '65%', textAlign: 'right' },
  locationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 3 },
  locationText: { flex: 1, fontFamily: FONT, fontSize: 10 },
  amount: { color: '#008080', fontFamily: FONT, fontSize: 11, fontWeight: 'bold', marginTop: 8 },
  empty: { alignItems: 'center', paddingVertical: 42 },
  emptyTitle: { fontFamily: FONT, fontSize: 14, fontWeight: 'bold', marginTop: 10 },
  emptyText: { fontFamily: FONT, fontSize: 11, marginTop: 4, textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontFamily: FONT, fontSize: 12, marginTop: 8 },
  expandedContent: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 12 },
  notesBox: { backgroundColor: '#f8fafc', padding: 10, borderRadius: 8, marginTop: 8 },
  notesLabel: { fontFamily: FONT, fontSize: 10, fontWeight: 'bold', marginBottom: 4 },
  notesText: { fontFamily: FONT, fontSize: 11, lineHeight: 16 },
  selfieBox: { marginTop: 12 },
  cardSelfieThumb: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#e2e8f0', borderWidth: 1, borderColor: '#cbd5e1' },

  // Preview Image Modal Styles
  previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  previewCloseBtn: { position: 'absolute', top: 44, right: 20, zIndex: 10, padding: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20 },
  previewFullImage: { width: '92%', height: '80%' },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '88%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', fontFamily: FONT },
  modalCloseBtn: { padding: 4 },
  inputLabel: { fontSize: 11, fontWeight: '800', color: '#475569', marginBottom: 6, marginTop: 12, textTransform: 'uppercase' },
  formInput: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, color: '#0f172a', backgroundColor: '#f8fafc' },
  statusChipSelect: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#f8fafc' },
  statusChipSelectActive: { backgroundColor: '#0a3d3c', borderColor: '#0a3d3c' },
  statusChipSelectText: { fontSize: 10, fontWeight: '800', color: '#64748b' },
  selfiePickerBox: { borderWidth: 1.5, borderColor: '#cbd5e1', borderStyle: 'dashed', borderRadius: 14, height: 120, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc', marginTop: 4, marginBottom: 16 },
  saveSubmitBtn: { backgroundColor: '#0a3d3c', paddingVertical: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8, marginBottom: 24 },
  saveSubmitBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});