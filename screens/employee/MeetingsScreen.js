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
  Image,
} from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus, User, Phone, MapPin, ClipboardList, Check, Calendar, ArrowRight, X, Pencil, Camera, Eye, ArrowLeft, ChevronDown, ChevronUp, Briefcase, Navigation, CheckCircle2, Clock, AlertCircle } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { meetingApi, uploadAPI, getAvatarUrl } from '../../services/api';

export default function MeetingsScreen() {
  const router = useRouter();
  const [meetings, setMeetings] = useState([]);
  const [expandedIds, setExpandedIds] = useState({}); // Default all collapsed

  const toggleExpand = (id) => {
    setExpandedIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState(null);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState(null);

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
        return { bg: '#e0e7ff', text: '#4338ca', label: 'FOLLOW-UP' };
      default:
        return { bg: '#fef3c7', text: '#d97706', label: 'PENDING' };
    }
  };

  return (
    <View style={styles.container}>
      {/* ── TOP HEADER (Clean Crisp Forest Teal Theme) ── */}
      <View style={styles.headerContainer}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backBtnHeader}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(employee)/dashboard'))}
            activeOpacity={0.7}
          >
            <ArrowLeft size={20} color="#0f766e" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerKicker}>FIELD ACTIVITY</Text>
            <Text style={styles.headerMainTitle}>Client Visits</Text>
            <Text style={styles.headerSubTitle}>Your Field Meeting Logs</Text>
          </View>
          <View style={styles.loggedCountPill}>
            <Text style={styles.loggedCountNum}>{meetings.length}</Text>
            <Text style={styles.loggedCountLabel}>LOGGED</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.headerAddButton} onPress={handleOpenAddModal} activeOpacity={0.88}>
          <Plus size={18} color="#ffffff" strokeWidth={2.5} />
          <Text style={styles.headerAddButtonText}>ADD MEETING</Text>
          <ArrowRight size={16} color="#ffffff" />
        </TouchableOpacity>
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
              const itemId = item._id || item.id;
              const isExpanded = !!expandedIds[itemId];
              const badge = getStatusBadgeStyle(item.status);
              const selfieUri = getAvatarUrl(item.selfieUrl || (item.images && item.images[0]));

              return (
                <Surface
                  key={itemId}
                  style={[styles.meetingCard, isExpanded && styles.meetingCardExpanded]}
                  elevation={isExpanded ? 2 : 1}
                >
                  {/* Header Row — Tap anywhere to Expand/Collapse */}
                  <TouchableOpacity
                    onPress={() => toggleExpand(itemId)}
                    activeOpacity={0.7}
                    style={[styles.cardHeader, isExpanded ? { marginBottom: 12 } : { marginBottom: 0 }]}
                  >
                    <View style={styles.clientInfoBlock}>
                      {selfieUri ? (
                        <TouchableOpacity
                          onPress={() => setPreviewPhotoUrl(selfieUri)}
                          activeOpacity={0.85}
                          style={styles.meetingSelfieThumbWrap}
                        >
                          <Image source={{ uri: selfieUri }} style={styles.meetingSelfieThumb} />
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.avatarCircleBox}>
                          <User size={16} color="#0f766e" />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.clientNameText}>{item.clientName}</Text>
                        <Text style={styles.clientPhoneText}>{item.mobileNumber}</Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                        <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                          {badge.label}
                        </Text>
                      </View>
                      <View style={styles.chevronCircle}>
                        {isExpanded ? (
                          <ChevronUp size={16} color="#0f766e" strokeWidth={2.2} />
                        ) : (
                          <ChevronDown size={16} color="#0f766e" strokeWidth={2.2} />
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* ── COLLAPSED VIEW (Default): Clean, compact 1-line preview ── */}
                  {!isExpanded && (
                    <TouchableOpacity
                      onPress={() => toggleExpand(itemId)}
                      activeOpacity={0.7}
                      style={styles.collapsedMetaRow}
                    >
                      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 10 }}>
                        <MapPin size={12} color="#94a3b8" style={{ marginRight: 4 }} />
                        <Text style={styles.collapsedMetaAddress} numberOfLines={1}>
                          {item.meetingAddress || 'Location not recorded'}
                        </Text>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Calendar size={11} color="#64748b" style={{ marginRight: 4 }} />
                        <Text style={styles.collapsedMetaDate}>
                          {new Date(item.date || item.createdAt).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  {/* ── EXPANDED VIEW: Full Details (Address, Selfie, Notes, Date, Edit) ── */}
                  {isExpanded && (
                    <View style={styles.expandedContentBlock}>
                      <View style={styles.metaRow}>
                        <MapPin size={13} color="#0f766e" style={{ marginRight: 6, marginTop: 2 }} />
                        <Text style={styles.metaText}>{item.meetingAddress || 'Location not recorded'}</Text>
                      </View>

                      {selfieUri && (
                        <TouchableOpacity
                          style={styles.meetingSelfieBannerRow}
                          onPress={() => setPreviewPhotoUrl(selfieUri)}
                          activeOpacity={0.85}
                        >
                          <Image source={{ uri: selfieUri }} style={styles.meetingSelfieInline} />
                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={styles.meetingSelfieLabel}>Visit Selfie Verified</Text>
                            <Text style={styles.meetingSelfieSub}>Tap to view full photo</Text>
                          </View>
                          <Eye size={15} color="#0f766e" />
                        </TouchableOpacity>
                      )}

                      {item.meetingNotes ? (
                        <View style={styles.notesBlock}>
                          <Text style={styles.notesTitle}>FEEDBACK NOTES</Text>
                          <Text style={styles.notesText}>{item.meetingNotes}</Text>
                        </View>
                      ) : null}

                      <View style={styles.cardFooter}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Calendar size={13} color="#0f766e" style={{ marginRight: 6 }} />
                          <Text style={styles.dateText}>
                            {new Date(item.date || item.createdAt).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Text>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <TouchableOpacity
                            style={styles.collapseToggleBtn}
                            onPress={() => toggleExpand(itemId)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.collapseToggleBtnText}>Close ▲</Text>
                          </TouchableOpacity>

                          <TouchableOpacity 
                            style={styles.editCardBtn} 
                            onPress={() => handleEditMeeting(item)}
                            activeOpacity={0.7}
                          >
                            <Pencil size={12} color="#0f766e" style={{ marginRight: 5 }} />
                            <Text style={styles.editCardBtnText}>Edit</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  )}
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
          <Surface style={styles.modalContent} elevation={5}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={styles.modalHeaderIconWrap}>
                  <Briefcase size={20} color="#059669" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>
                    {editingMeeting ? 'Edit Client Visit' : 'Log Client Visit'}
                  </Text>
                  <Text style={styles.modalSubTitle}>
                    {editingMeeting ? 'Update visit record details' : 'Record field meeting & geo-verification'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.modalCloseBtn}
                activeOpacity={0.7}
              >
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* Field 1: Client Name */}
              <View style={styles.formGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.fieldLabel}>Client Name</Text>
                  <Text style={styles.requiredStar}>*</Text>
                </View>
                <View style={styles.inputCard}>
                  <View style={styles.inputIconBox}>
                    <User size={17} color="#059669" />
                  </View>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter client or shop name"
                    value={clientName}
                    onChangeText={setClientName}
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              {/* Field 2: Mobile Number */}
              <View style={styles.formGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.fieldLabel}>Mobile / Phone Number</Text>
                  <Text style={styles.requiredStar}>*</Text>
                </View>
                <View style={styles.inputCard}>
                  <View style={styles.inputIconBox}>
                    <Phone size={17} color="#059669" />
                  </View>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter phone number"
                    keyboardType="phone-pad"
                    value={mobileNumber}
                    onChangeText={setMobileNumber}
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              {/* Field 3: Meeting Location */}
              <View style={styles.formGroup}>
                <View style={styles.labelWithActionRow}>
                  <View style={styles.labelRow}>
                    <Text style={styles.fieldLabel}>Meeting Address</Text>
                    <Text style={styles.requiredStar}>*</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.detectGpsBtn}
                    onPress={handleFetchCurrentLocation}
                    disabled={fetchingLocation}
                    activeOpacity={0.75}
                  >
                    {fetchingLocation ? (
                      <ActivityIndicator size="small" color="#059669" />
                    ) : (
                      <>
                        <Navigation size={12} color="#059669" />
                        <Text style={styles.detectGpsBtnText}>Auto-Detect GPS</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
                <View style={styles.inputCard}>
                  <View style={styles.inputIconBox}>
                    <MapPin size={17} color="#059669" />
                  </View>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter shop, village or office address"
                    value={meetingAddress}
                    onChangeText={setMeetingAddress}
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              {/* Field 4: Status Selector */}
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>Visit Outcome / Status</Text>
                <View style={styles.statusSegmentRow}>
                  {/* Completed */}
                  <TouchableOpacity
                    style={[
                      styles.statusSegmentBtn,
                      status === 'completed' && styles.statusSegmentCompleted
                    ]}
                    onPress={() => setStatus('completed')}
                    activeOpacity={0.75}
                  >
                    <CheckCircle2
                      size={15}
                      color={status === 'completed' ? '#059669' : '#64748B'}
                    />
                    <Text
                      style={[
                        styles.statusSegmentText,
                        status === 'completed' && styles.statusSegmentTextCompleted
                      ]}
                    >
                      COMPLETED
                    </Text>
                  </TouchableOpacity>

                  {/* Follow-up */}
                  <TouchableOpacity
                    style={[
                      styles.statusSegmentBtn,
                      status === 'follow-up' && styles.statusSegmentFollowUp
                    ]}
                    onPress={() => setStatus('follow-up')}
                    activeOpacity={0.75}
                  >
                    <Clock
                      size={15}
                      color={status === 'follow-up' ? '#4F46E5' : '#64748B'}
                    />
                    <Text
                      style={[
                        styles.statusSegmentText,
                        status === 'follow-up' && styles.statusSegmentTextFollowUp
                      ]}
                    >
                      FOLLOW-UP
                    </Text>
                  </TouchableOpacity>

                  {/* Pending */}
                  <TouchableOpacity
                    style={[
                      styles.statusSegmentBtn,
                      status === 'scheduled' && styles.statusSegmentPending
                    ]}
                    onPress={() => setStatus('scheduled')}
                    activeOpacity={0.75}
                  >
                    <AlertCircle
                      size={15}
                      color={status === 'scheduled' ? '#D97706' : '#64748B'}
                    />
                    <Text
                      style={[
                        styles.statusSegmentText,
                        status === 'scheduled' && styles.statusSegmentTextPending
                      ]}
                    >
                      PENDING
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Field 5: Notes & Requirements */}
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>Visit Notes / Feedback</Text>
                <View style={[styles.inputCard, styles.textareaCard]}>
                  <TextInput
                    style={styles.textareaInput}
                    placeholder="Write discussion notes, farmer feedback or next actions..."
                    multiline={true}
                    numberOfLines={3}
                    value={meetingNotes}
                    onChangeText={setMeetingNotes}
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              {/* Field 6: Selfie Verification */}
              {!editingMeeting && (
                <View style={styles.formGroup}>
                  <View style={styles.labelRow}>
                    <Text style={styles.fieldLabel}>Visit Selfie Verification</Text>
                    <Text style={styles.requiredStar}>*</Text>
                  </View>
                  {selfieImage ? (
                    <View style={styles.selfieCapturedCard}>
                      <Image source={{ uri: selfieImage }} style={styles.selfieThumbnail} />
                      <View style={styles.selfieMetaCol}>
                        <View style={styles.selfieVerifiedTag}>
                          <CheckCircle2 size={13} color="#059669" />
                          <Text style={styles.selfieVerifiedTagText}>Selfie Attached</Text>
                        </View>
                        <Text style={styles.selfieSubHint}>Geo-tagged for instant visit approval</Text>
                        <TouchableOpacity
                          onPress={handleCaptureSelfie}
                          style={styles.retakePillBtn}
                          activeOpacity={0.75}
                        >
                          <Camera size={12} color="#047857" />
                          <Text style={styles.retakePillText}>Retake Photo</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.selfiePlaceholderCard}
                      onPress={handleCaptureSelfie}
                      activeOpacity={0.8}
                    >
                      <View style={styles.cameraCircleBox}>
                        <Camera size={22} color="#059669" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.selfiePlaceholderTitle}>Take Meeting Selfie</Text>
                        <Text style={styles.selfiePlaceholderSub}>Required for GPS location & audit verification</Text>
                      </View>
                      <View style={styles.selfieSnapAction}>
                        <Text style={styles.selfieSnapActionText}>Snap</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Submit CTA Button */}
              {submitting ? (
                <View style={styles.submittingBox}>
                  <ActivityIndicator size="small" color="#059669" />
                  <Text style={styles.submittingText}>Saving visit details & uploading proof...</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.saveVisitBtn}
                  onPress={handleSaveMeeting}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#059669', '#047857']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.saveVisitBtnGradient}
                  >
                    <Check size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.saveVisitBtnText}>
                      {editingMeeting ? 'Update Client Visit' : 'Save & Verify Client Visit'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </ScrollView>
          </Surface>
        </KeyboardAvoidingView>
      </Modal>

      {/* Full Photo Preview Modal */}
      <Modal
        visible={!!previewPhotoUrl}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPreviewPhotoUrl(null)}
      >
        <View style={styles.previewOverlay}>
          <TouchableOpacity
            style={styles.previewCloseBtn}
            onPress={() => setPreviewPhotoUrl(null)}
            activeOpacity={0.8}
          >
            <X size={22} color="#ffffff" />
          </TouchableOpacity>
          {previewPhotoUrl && (
            <Image
              source={{ uri: previewPhotoUrl }}
              style={styles.previewFullImage}
              resizeMode="contain"
            />
          )}
        </View>
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
    backgroundColor: '#ffffff',
    paddingTop: Platform.OS === 'ios' ? 56 : 44,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  backBtnHeader: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  headerKicker: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#0f766e',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  headerMainTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  headerSubTitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '400',
  },
  loggedCountPill: {
    backgroundColor: '#f0fdfa',
    borderWidth: 1,
    borderColor: '#ccfbf1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loggedCountNum: {
    color: '#0f766e',
    fontWeight: '800',
    fontSize: 17,
  },
  loggedCountLabel: {
    color: '#0f766e',
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  headerAddButton: {
    marginTop: 16,
    height: 46,
    borderRadius: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f766e',
    shadowColor: '#0f766e',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  headerAddButtonText: {
    flex: 1,
    marginLeft: 10,
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.5,
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
    paddingBottom: 120,
  },
  meetingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  clientInfoBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  avatarCircleBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f0fdfa',
    borderWidth: 1,
    borderColor: '#ccfbf1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  clientNameText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0f172a',
  },
  clientPhoneText: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  chevronCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#f0fdfa',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccfbf1',
  },
  collapsedMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  collapsedMetaAddress: {
    fontSize: 11.5,
    color: '#64748b',
    flex: 1,
  },
  collapsedMetaDate: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0f766e',
  },
  meetingCardExpanded: {
    borderColor: '#0f766e',
    shadowColor: '#0f766e',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  expandedContentBlock: {
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  collapseToggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  collapseToggleBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  metaText: {
    color: '#475569',
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  notesBlock: {
    backgroundColor: '#f0fdfa',
    borderWidth: 1,
    borderColor: '#ccfbf1',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  notesTitle: {
    color: '#0f766e',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  notesText: {
    color: '#334155',
    fontSize: 12,
    lineHeight: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
  },
  dateText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '500',
  },
  editCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 8,
  },
  editCardBtnText: {
    color: '#0f766e',
    fontSize: 11,
    fontWeight: '600',
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
    backgroundColor: '#0f766e',
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '92%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 16,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  modalHeaderIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubTitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formGroup: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  labelWithActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
    letterSpacing: 0.2,
  },
  requiredStar: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E11D48',
  },
  detectGpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 8,
    gap: 5,
  },
  detectGpsBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    height: 52,
    paddingHorizontal: 12,
  },
  inputIconBox: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '500',
    paddingVertical: 0,
  },
  textareaCard: {
    height: 84,
    alignItems: 'flex-start',
    paddingVertical: 10,
  },
  textareaInput: {
    flex: 1,
    width: '100%',
    fontSize: 13.5,
    color: '#0F172A',
    fontWeight: '500',
    textAlignVertical: 'top',
  },
  statusSegmentRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  statusSegmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  statusSegmentText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.3,
  },
  statusSegmentCompleted: {
    backgroundColor: '#ECFDF5',
    borderColor: '#059669',
  },
  statusSegmentTextCompleted: {
    color: '#065F46',
  },
  statusSegmentFollowUp: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5',
  },
  statusSegmentTextFollowUp: {
    color: '#3730A3',
  },
  statusSegmentPending: {
    backgroundColor: '#FFFBEB',
    borderColor: '#D97706',
  },
  statusSegmentTextPending: {
    color: '#92400E',
  },
  selfiePlaceholderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#059669',
    borderRadius: 14,
    padding: 12,
    gap: 12,
  },
  cameraCircleBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selfiePlaceholderTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#065F46',
  },
  selfiePlaceholderSub: {
    fontSize: 11,
    color: '#059669',
    marginTop: 2,
  },
  selfieSnapAction: {
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  selfieSnapActionText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  selfieCapturedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    borderRadius: 14,
    padding: 12,
    gap: 12,
  },
  selfieThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#059669',
  },
  selfieMetaCol: {
    flex: 1,
  },
  selfieVerifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  selfieVerifiedTagText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065F46',
  },
  selfieSubHint: {
    fontSize: 10.5,
    color: '#059669',
    marginTop: 2,
    marginBottom: 6,
  },
  retakePillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  retakePillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#047857',
  },
  saveVisitBtn: {
    marginTop: 10,
    marginBottom: 16,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#059669',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  saveVisitBtnGradient: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  saveVisitBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  submittingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  submittingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
  },
  meetingSelfieThumbWrap: {
    marginRight: 10,
  },
  meetingSelfieThumb: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#e2e8f0',
    borderWidth: 1.5,
    borderColor: '#0f766e',
  },
  meetingSelfieBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdfa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ccfbf1',
    padding: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  meetingSelfieInline: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
  },
  meetingSelfieLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f766e',
  },
  meetingSelfieSub: {
    fontSize: 10.5,
    color: '#64748b',
    marginTop: 1,
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewCloseBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 48 : 24,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewFullImage: {
    width: '90%',
    height: '75%',
  },
});
