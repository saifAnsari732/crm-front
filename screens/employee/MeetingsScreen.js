import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus, User, Phone, MapPin, ClipboardList, Check, Calendar, ArrowRight, X, Pencil, Camera } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { meetingApi, uploadAPI } from '../../services/api';

export default function MeetingsScreen() {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState(null);

  // New Meeting Form States
  const [clientName, setClientName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [meetingAddress, setMeetingAddress] = useState('');
  const [status, setStatus] = useState('scheduled'); // 'scheduled' (Pending), 'completed', 'follow-up'
  const [meetingNotes, setMeetingNotes] = useState('');
  const [selfieImage, setSelfieImage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [fetchingLocation, setFetchingLocation] = useState(false);

  const handleFetchCurrentLocation = async () => {
    try {
      setFetchingLocation(true);
      
      // Request permissions
      const { status: permStatus } = await Location.requestForegroundPermissionsAsync();
      if (permStatus !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to fetch current address.');
        return;
      }

      // Get location
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = position.coords;

      // Reverse geocode
      const geocoded = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (geocoded && geocoded.length > 0) {
        const res = geocoded[0];
        const street = res.street || res.name || '';
        const district = res.district || res.subregion || '';
        const city = res.city || '';
        const region = res.region || '';
        const code = res.postalCode || '';
        
        const fullAddress = [street, district, city, region, code]
          .filter(part => part && part.trim().length > 0)
          .join(', ');
          
        setMeetingAddress(fullAddress || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
      } else {
        setMeetingAddress(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
      }
    } catch (err) {
      console.log('⚠️ MeetingsScreen: Location fetch error:', err.message);
      Alert.alert('Error', 'Failed to fetch current location address. Please try again.');
    } finally {
      setFetchingLocation(false);
    }
  };

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      setFetchError('');
      const res = await meetingApi.getMy();
      if (res.data && res.data.success) {
        setMeetings(res.data.meetings || []);
      }
    } catch (err) {
      console.log('⚠️ MeetingsScreen: Failed to fetch:', err.message);
      setFetchError('Unable to load your meetings. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchMeetings();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMeetings();
    setRefreshing(false);
  };

  const handleOpenAddModal = () => {
    setEditingMeeting(null);
    setClientName('');
    setMobileNumber('');
    setMeetingAddress('');
    setStatus('scheduled');
    setMeetingNotes('');
    setSelfieImage(null);
    setModalVisible(true);
  };

  const handleCaptureSelfie = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Denied', 'Camera permission is required to log a meeting.');
        return;
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

  const handleEditMeeting = (item) => {
    setEditingMeeting(item);
    setClientName(item.clientName || '');
    setMobileNumber(item.mobileNumber || '');
    setMeetingAddress(item.meetingAddress || '');
    setStatus(item.status || 'scheduled');
    setMeetingNotes(item.meetingNotes || '');
    setSelfieImage(null); // Optional: Could fetch existing selfie if needed, but null for new edits
    setModalVisible(true);
  };

  const handleSaveMeeting = async () => {
    if (!clientName.trim() || !mobileNumber.trim() || !meetingAddress.trim()) {
      Alert.alert('Required Fields', 'Please complete Client Name, Mobile, and Address.');
      return;
    }

    if (!editingMeeting && !selfieImage) {
      Alert.alert('Selfie Required', 'Please capture a selfie to log this meeting.');
      return;
    }

    if (clientName.trim() === mobileNumber.trim()) {
      Alert.alert('Invalid Input', 'Client name and mobile number cannot be the same.');
      return;
    }

    if (!editingMeeting) {
      const duplicate = meetings.find(m => 
        m.mobileNumber === mobileNumber.trim() || 
        (m.clientName && m.clientName.trim().toLowerCase() === clientName.trim().toLowerCase())
      );
      if (duplicate) {
        Alert.alert('Duplicate Found', 'A client meeting with this Name or Mobile Number already exists.');
        return;
      }
    }

    try {
      setSubmitting(true);

      let uploadedSelfieUrl = null;
      if (selfieImage) {
        let uploadRes;
        if (Platform.OS === 'web') {
          const formData = new FormData();
          const response = await fetch(selfieImage.uri);
          const blob = await response.blob();
          formData.append('image', blob, `meeting_selfie_${Date.now()}.jpg`);
          formData.append('folder', '/crm-tracker/meetings');
          uploadRes = await uploadAPI.uploadImageFormData(formData);
        } else {
          // Pass the URI directly for native
          uploadRes = await uploadAPI.uploadImageFormData(selfieImage.uri);
        }
        
        if (uploadRes.data && uploadRes.data.success) {
          uploadedSelfieUrl = uploadRes.data.url;
        } else {
          Alert.alert('Upload Failed', 'Failed to upload selfie. Please try again.');
          setSubmitting(false);
          return;
        }
      }

      const data = {
        clientName,
        mobileNumber,
        meetingAddress,
        status,
        meetingNotes,
        ...(uploadedSelfieUrl && { selfieUrl: uploadedSelfieUrl })
      };

      let res;
      if (editingMeeting) {
        res = await meetingApi.update(editingMeeting._id || editingMeeting.id, data);
      } else {
        res = await meetingApi.create(data);
      }

      if (res.data && res.data.success) {
        Alert.alert('Success', editingMeeting ? 'Client visit report updated!' : 'Client visit meeting logged successfully!');
        setModalVisible(false);
        // Clear Form
        setClientName('');
        setMobileNumber('');
        setMeetingAddress('');
        setStatus('scheduled');
        setMeetingNotes('');
        setSelfieImage(null);
        setEditingMeeting(null);
        fetchMeetings();
      }
    } catch (err) {
      console.log('⚠️ MeetingsScreen: Failed to save:', err.message);
      Alert.alert('Error', 'Failed to save meeting report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadgeStyle = (statusVal) => {
    switch (statusVal) {
      case 'completed':
        return { bg: '#dcfce7', text: '#15803d', label: 'COMPLETED' };
      case 'follow-up':
        return { bg: '#dbeafe', text: '#1d4ed8', label: 'FOLLOW-UP' };
      default:
        return { bg: '#fef3c7', text: '#d97706', label: 'PENDING' };
    }
  };

  return (
    <View style={styles.container}>
      {/* Premium Unique Header (Dashboard Brand Style) */}
      <View style={[styles.headerContainer, { borderBottomLeftRadius: 40, borderBottomRightRadius: 40, shadowColor: '#fecdd3', shadowOpacity: 0.8, shadowRadius: 20, elevation: 10, backgroundColor: '#ffffff', paddingBottom: 24, zIndex: 10 }]}>
        
        {/* Soft Background Blob/Gradient simulation */}
        <View style={{ position: 'absolute', top: 0, right: 0, width: '70%', height: '100%', backgroundColor: '#fff0f3', borderBottomRightRadius: 40, borderTopLeftRadius: 150, opacity: 0.8 }} />

        <View style={[styles.headerGradient, { paddingBottom: 10, paddingTop: Platform.OS === 'ios' ? 70 : 50, backgroundColor: 'transparent' }]}>
          <View style={styles.headerTop}>
            <View>
              <Text style={{ fontSize: 10, fontWeight: "600", color: "#f43f5e", letterSpacing: 1.5, marginBottom: 4 }}>
                FIELD ACTIVITY
              </Text>
              <View style={{ width: 16, height: 2, backgroundColor: '#f43f5e', marginBottom: 8, borderRadius: 2 }} />
              
              <Text style={{ fontSize: 32, fontWeight: '600', color: '#1e293b', letterSpacing: -0.5 }}>Client Visits</Text>
              <Text style={{ fontSize: 13, color: '#64748b', marginTop: 1, fontWeight: '400' }}>Your Field Meeting Logs</Text>
            </View>
            <View style={{ backgroundColor: '#e6fffa', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, shadowColor: '#00c6a9', shadowOpacity: 0.1, elevation: 2 }}>
              <Text style={{ color: '#00c6a9', fontWeight: '900', fontSize: 16 }}>{meetings.length}</Text>
              <Text style={{ color: '#00b4d8', fontSize: 9, fontWeight: 'bold' }}>LOGGED</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.headerAddButton} onPress={handleOpenAddModal} activeOpacity={0.85}>
            <Plus size={17} color="#ffffff" strokeWidth={2.5} />
            <Text style={styles.headerAddButtonText}>ADD MEETING</Text>
            <ArrowRight size={16} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main List */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1d4ed8" />
          <Text style={styles.loadingText}>Fetching database reports...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.listContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1d4ed8']} />
          }
        >
          {fetchError ? (
            <Surface style={styles.emptyCard} elevation={1}>
              <View style={styles.emptyIconCircle}>
                <ClipboardList size={32} color="#0284c7" />
              </View>
              <Text style={styles.emptyTitle}>Could not load meetings</Text>
              <Text style={styles.emptySub}>{fetchError}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={fetchMeetings}>
                <Text style={styles.retryButtonText}>TRY AGAIN</Text>
              </TouchableOpacity>
            </Surface>
          ) : meetings.length === 0 ? (
            <Surface style={[styles.emptyCard, { backgroundColor: '#ffffff', borderRadius: 28, padding: 32, alignItems: 'center', borderColor: '#f1f5f9', borderWidth: 2, marginTop: 40 }]} elevation={0}>
              <View style={{ backgroundColor: '#e6fffa', width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
                <ClipboardList size={40} color="#00c6a9" />
              </View>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginBottom: 12 }}>No Visits Logged</Text>
              <Text style={{ fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 20 }}>
                You haven't registered any client visit meetings yet. Press the (+) button below to log your first field visit!
              </Text>
            </Surface>
          ) : (
            meetings.map((item) => {
              const badge = getStatusBadgeStyle(item.status);
              return (
                <Surface key={item._id || item.id} style={[styles.meetingCard, { borderRadius: 24, padding: 16, backgroundColor: '#ffffff', marginBottom: 16, borderColor: '#f1f5f9', borderWidth: 1 }]} elevation={3}>
                  <View style={[styles.cardHeader, { marginBottom: 16 }]}>
                    <View style={styles.clientInfoBlock}>
                      <View style={{ backgroundColor: '#f1f5f9', padding: 10, borderRadius: 12, marginRight: 12 }}>
                        <User size={18} color="#64748b" />
                      </View>
                      <View>
                        <Text style={[styles.clientNameText, { fontSize: 16, fontWeight: 'bold', color: '#1e293b' }]}>{item.clientName}</Text>
                        <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{item.mobileNumber}</Text>
                      </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: badge.bg, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }]}>
                      <Text style={[styles.statusBadgeText, { color: badge.text, fontSize: 10, fontWeight: 'bold' }]}>
                         {badge.label}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.metaRow, { marginBottom: 12 }]}>
                    <MapPin size={14} color="#94a3b8" style={{ marginRight: 8, marginTop: 2 }} />
                    <Text style={[styles.metaText, { color: '#64748b', flex: 1, fontSize: 13, lineHeight: 18 }]} numberOfLines={2}>{item.meetingAddress}</Text>
                  </View>

                  {item.meetingNotes ? (
                    <View style={[styles.notesBlock, { backgroundColor: '#e6fffa', padding: 12, borderRadius: 12, marginTop: 8 }]}>
                      <Text style={[styles.notesTitle, { color: '#00c6a9', fontSize: 10, fontWeight: 'bold', marginBottom: 4 }]}>FEEDBACK NOTES</Text>
                      <Text style={[styles.notesText, { color: '#475569', fontSize: 13 }]}>{item.meetingNotes}</Text>
                    </View>
                  ) : null}

                  <View style={[styles.cardFooter, { justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 16, marginTop: 16 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Calendar size={14} color="#00b4d8" style={{ marginRight: 6 }} />
                      <Text style={[styles.dateText, { color: '#64748b', fontSize: 12, fontWeight: '500' }]}>
                        {new Date(item.date || item.createdAt).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                    <TouchableOpacity 
                      style={[styles.editCardBtn, { backgroundColor: '#f8fafc', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }]} 
                      onPress={() => handleEditMeeting(item)}
                    >
                      <Pencil size={12} color="#00b4d8" style={{ marginRight: 6 }} />
                      <Text style={[styles.editCardBtnText, { color: '#00b4d8', fontSize: 12, fontWeight: 'bold' }]}>Edit</Text>
                    </TouchableOpacity>
                  </View>
                </Surface>
              );
            })
          )}
        </ScrollView>
      )}

      

      {/* Log Visit Modal Overlay */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Surface style={[styles.modalContent, { borderTopLeftRadius: 36, borderTopRightRadius: 36, paddingHorizontal: 24, paddingVertical: 32 }]} elevation={5}>
            {/* Header */}
            <View style={[styles.modalHeader, { marginBottom: 24, borderBottomWidth: 0 }]}>
              <Text style={[styles.modalTitle, { fontSize: 22, fontWeight: '900', color: '#1e293b' }]}>
                {editingMeeting ? 'Edit Client Visit' : 'Log Client Visit'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={{ backgroundColor: '#f1f5f9', padding: 8, borderRadius: 20 }}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Client Name */}
              <Text style={[styles.inputLabel, { fontWeight: '700', color: '#475569' }]}>Client Name *</Text>
              <View style={[styles.inputWrapper, { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, height: 56 }]}>
                <User size={18} color="#94a3b8" style={{ marginLeft: 16, marginRight: 8 }} />
                <TextInput
                  style={[styles.input, { fontSize: 15 }]}
                  placeholder="Enter client name"
                  value={clientName}
                  onChangeText={setClientName}
                  placeholderTextColor="#94a3b8"
                />
              </View>

              {/* Mobile Number */}
              <Text style={[styles.inputLabel, { fontWeight: '700', color: '#475569', marginTop: 16 }]}>Mobile / Phone *</Text>
              <View style={[styles.inputWrapper, { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, height: 56 }]}>
                <Phone size={18} color="#94a3b8" style={{ marginLeft: 16, marginRight: 8 }} />
                <TextInput
                  style={[styles.input, { fontSize: 15 }]}
                  placeholder="Enter phone number"
                  keyboardType="phone-pad"
                  value={mobileNumber}
                  onChangeText={setMobileNumber}
                  placeholderTextColor="#94a3b8"
                />
              </View>

              {/* Visit Location Address */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 8 }}>
                <Text style={[styles.inputLabel, { marginTop: 0, marginBottom: 0, fontWeight: '700', color: '#475569' }]}>Meeting Address *</Text>
                <TouchableOpacity onPress={handleFetchCurrentLocation} disabled={fetchingLocation}>
                  {fetchingLocation ? (
                    <ActivityIndicator size="small" color="#00c6a9" />
                  ) : (
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#00c6a9' }}>Fetch Current</Text>
                  )}
                </TouchableOpacity>
              </View>
              <View style={[styles.inputWrapper, { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, height: 56 }]}>
                <MapPin size={18} color="#94a3b8" style={{ marginLeft: 16, marginRight: 8 }} />
                <TextInput
                  style={[styles.input, { fontSize: 15 }]}
                  placeholder="Enter shop or office address"
                  value={meetingAddress}
                  onChangeText={setMeetingAddress}
                  placeholderTextColor="#94a3b8"
                />
              </View>

              {/* Status Pills */}
              <Text style={[styles.inputLabel, { fontWeight: '700', color: '#475569', marginTop: 16 }]}>Status</Text>
              <View style={[styles.pillRow, { marginBottom: 4 }]}>
                <TouchableOpacity
                  style={[
                    styles.statusPill,
                    { borderRadius: 16, flex: 1, paddingVertical: 12 },
                    status === 'scheduled' && { backgroundColor: '#fef3c7', borderColor: '#f59e0b' },
                  ]}
                  onPress={() => setStatus('scheduled')}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      { fontSize: 11, fontWeight: 'bold' },
                      status === 'scheduled' && { color: '#d97706' },
                    ]}
                  >
                    PENDING
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.statusPill,
                    { borderRadius: 16, flex: 1, paddingVertical: 12 },
                    status === 'completed' && { backgroundColor: '#dcfce7', borderColor: '#10b981' },
                  ]}
                  onPress={() => setStatus('completed')}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      { fontSize: 11, fontWeight: 'bold' },
                      status === 'completed' && { color: '#15803d' },
                    ]}
                  >
                    COMPLETED
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.statusPill,
                    { borderRadius: 16, flex: 1, paddingVertical: 12 },
                    status === 'follow-up' && { backgroundColor: '#e0f2fe', borderColor: '#0284c7' },
                  ]}
                  onPress={() => setStatus('follow-up')}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      { fontSize: 11, fontWeight: 'bold' },
                      status === 'follow-up' && { color: '#0369a1' },
                    ]}
                  >
                    FOLLOW-UP
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Notes */}
              <Text style={[styles.inputLabel, { fontWeight: '700', color: '#475569', marginTop: 16 }]}>Visit Notes / Feedback</Text>
              <View style={[styles.inputWrapper, { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, height: 100, alignItems: 'flex-start', paddingTop: 12, paddingHorizontal: 16 }]}>
                <TextInput
                  style={[styles.input, { height: 80, textAlignVertical: 'top', fontSize: 15 }]}
                  placeholder="Write client requirements or feedback..."
                  multiline={true}
                  numberOfLines={4}
                  value={meetingNotes}
                  onChangeText={setMeetingNotes}
                  placeholderTextColor="#94a3b8"
                />
              </View>

              {/* Selfie Capture Box */}
              {!editingMeeting && (
                <>
                  <Text style={[styles.inputLabel, { fontWeight: '700', color: '#475569', marginTop: 16 }]}>Meeting Selfie *</Text>
                  <View style={styles.selfieContainer}>
                    {selfieImage ? (
                      <View style={[styles.selfieImageWrapper, { backgroundColor: '#ecfdf5', borderColor: '#10b981', borderRadius: 16 }]}>
                        <Text style={{ fontSize: 14, color: '#10b981', marginBottom: 6, fontWeight: 'bold' }}>✓ Selfie Captured</Text>
                        <TouchableOpacity onPress={() => setSelfieImage(null)} style={[styles.retakeBtn, { backgroundColor: '#10b981' }]}>
                          <Text style={[styles.retakeBtnText, { color: '#fff' }]}>Retake Selfie</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity style={[styles.selfieUploadBox, { borderRadius: 16, borderStyle: 'dashed', borderColor: '#00c6a9', backgroundColor: '#e6fffa' }]} onPress={handleCaptureSelfie}>
                        <Camera size={28} color="#00c6a9" style={{ marginBottom: 8 }} />
                        <Text style={[styles.selfieBoxText, { color: '#00c6a9', fontWeight: 'bold' }]}>Take a Selfie</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              )}

              {/* Submit Button */}
              {submitting ? (
                <ActivityIndicator size="large" color="#00c6a9" style={{ marginTop: 24, marginBottom: 12 }} />
              ) : (
                <TouchableOpacity
                  style={[styles.submitBtn, { marginTop: 24, shadowColor: '#00c6a9', shadowOpacity: 0.4, shadowRadius: 10, elevation: 6 }]}
                  onPress={handleSaveMeeting}
                >
                  <LinearGradient
                    colors={['#00b4d8', '#00c6a9']}
                    style={[styles.submitBtnGradient, { borderRadius: 16, height: 60 }]}
                  >
                    <Text style={[styles.submitBtnText, { fontSize: 16, fontWeight: 'bold' }]}>
                      {editingMeeting ? 'Update Visit Report' : 'Save Visit Report'}
                    </Text>
                    <Check size={20} color="#fff" style={{ marginLeft: 8 }} />
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </ScrollView>
          </Surface>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerContainer: {
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  headerGradient: {
    paddingTop: Platform.OS === 'ios' ? 64 : 48,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerAddButton: {
    marginTop: 20,
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0284c7',
    shadowColor: '#0284c7',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  headerAddButtonText: {
    flex: 1,
    marginLeft: 10,
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  badgeCount: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748b',
  },
  listContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 180,
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#e0f2fe',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  retryButton: {
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#0284c7',
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  meetingCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  clientInfoBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  clientNameText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  metaText: {
    fontSize: 12,
    color: '#475569',
  },
  notesBlock: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#cbd5e1',
  },
  notesTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#475569',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 11,
    color: '#334155',
    lineHeight: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  dateText: {
    fontSize: 10,
    color: '#94a3b8',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    borderRadius: 28,
    elevation: 8,
    shadowColor: '#1d4ed8',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
    marginTop: 14,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    height: 48,
  },
  input: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    paddingHorizontal: 12,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  statusPill: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  statusPillActivePending: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
  },
  statusPillActiveCompleted: {
    backgroundColor: '#dcfce7',
    borderColor: '#10b981',
  },
  statusPillActiveFollowUp: {
    backgroundColor: '#dbeafe',
    borderColor: '#1d4ed8',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#64748b',
  },
  statusPillTextActive: {
    color: '#0f172a',
  },
  submitBtn: {
    marginTop: 28,
    borderRadius: 12,
    overflow: 'hidden',
  },
  submitBtnGradient: {
    height: 48,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  editCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  editCardBtnText: {
    color: '#1d4ed8',
    fontSize: 10,
    fontWeight: 'bold',
  },
  selfieContainer: {
    marginTop: 6,
    marginBottom: 10,
  },
  selfieUploadBox: {
    height: 80,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  selfieBoxText: {
    fontSize: 13,
    color: '#1d4ed8',
    fontWeight: '600',
    marginLeft: 8,
  },
  selfieImageWrapper: {
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  retakeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
  },
  retakeBtnText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: 'bold',
  },
});
