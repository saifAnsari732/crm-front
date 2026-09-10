import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, View, ScrollView, TouchableOpacity, TextInput, 
  Alert, Dimensions, Platform, ActivityIndicator, RefreshControl, Image,
  Modal, KeyboardAvoidingView
} from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { 
  DollarSign, Calendar, Truck, Utensils, Fuel, FileText, 
  ChevronRight, CheckCircle2, AlertCircle, Clock, UploadCloud, 
  Plus, Wallet, XCircle, X, MapPin, Navigation, Bike, Train, Bus, Car, Building2, Package
} from 'lucide-react-native';
import Svg, { Rect, Path, Line, Circle } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import { expenseApi, authApi, uploadAPI } from '../../services/api';

const { width } = Dimensions.get('window');

export default function ExpensesScreen() {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  
  // Form modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [category, setCategory] = useState('Fuel'); // Fuel, Food, Hotel, Travel, Misc
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  
  // Travel Specific States
  const [transportMode, setTransportMode] = useState('bike'); // bike, train, bus, taxi
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  
  const [history, setHistory] = useState([]);
  
  // Image Upload State
  const [receiptImage, setReceiptImage] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Set default date to today
  useEffect(() => {
    const today = new Date();
    const formatted = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;
    setDate(formatted);
  }, []);

  const fetchExpenses = async () => {
    try {
      setFetching(true);
      const res = await expenseApi.getMy();
      if (res.data && res.data.success) {
        setHistory(res.data.expenses || []);
      }
    } catch (err) {
      console.log('⚠️ ExpensesScreen: Failed to fetch history:', err.message);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const handlePickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionResult.granted === false) {
        Alert.alert('Permission required', 'Please allow camera roll permissions to upload receipts.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setReceiptImage(result.assets[0]);
      }
    } catch (error) {
      console.log('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image.');
    }
  };



  const handleSubmit = async () => {
    if (!amount) {
      Alert.alert('Incomplete Fields', 'Please specify the expense amount.');
      return;
    }

    if (category.toLowerCase() === 'travel') {
      if (!source.trim() || !destination.trim()) {
        Alert.alert('Incomplete Travel Details', 'Please specify both Source (From) and Destination (To) for Travel claims.');
        return;
      }
    }

    try {
      setLoading(true);
      
      let receiptUrls = [];
      
      // 1. Upload receipt to ImageKit via Backend if one is selected
      if (receiptImage && receiptImage.uri) {
        setUploadingImage(true);
        try {
          const fileName = `receipt_${Date.now()}.jpg`;
          
          let uploadRes;
          if (Platform.OS === 'web') {
            const formData = new FormData();
            const response = await fetch(receiptImage.uri);
            const blob = await response.blob();
            formData.append('file', blob, fileName);
            formData.append('fileName', fileName);
            formData.append('folder', '/crm-tracker/receipts');
            uploadRes = await uploadAPI.uploadImageDirect(formData);
          } else {
            uploadRes = await uploadAPI.uploadImageDirect({
              uri: receiptImage.uri,
              fileName: fileName,
              folder: '/crm-tracker/receipts'
            });
          }
          
          if (uploadRes.data && uploadRes.data.success) {
            receiptUrls.push(uploadRes.data.url);
          }
        } catch (uploadErr) {
          console.log('⚠️ ExpensesScreen: Image upload failed:', uploadErr.message);
          Alert.alert('Upload Failed', 'Failed to upload the receipt image. Submitting without receipt.');
        } finally {
          setUploadingImage(false);
        }
      }

      // Parse DD-MM-YYYY to Date object safely
      let parsedDate = new Date();
      if (date) {
        const parts = date.split('-');
        if (parts.length === 3) {
          // DD-MM-YYYY -> parts[2] is YYYY, parts[1] is MM (0-indexed so subtract 1), parts[0] is DD
          parsedDate = new Date(parts[2], parts[1] - 1, parts[0]);
        }
      }

      // Map frontend category selection to backend mongoose enum
      const backendCategory = category.toLowerCase();
      
      // Compile travel specifics into description for compatibility and ease of reading
      let compiledDescription = description.trim();
      if (backendCategory === 'travel') {
        const travelText = `Travel via ${transportMode.toUpperCase()} from "${source.trim()}" to "${destination.trim()}"`;
        compiledDescription = compiledDescription 
          ? `${compiledDescription} (${travelText})`
          : travelText;
      } else {
        compiledDescription = compiledDescription || `Field ${category} claim`;
      }

      const payload = {
        amount: parseFloat(amount),
        date: parsedDate,
        category: backendCategory,
        description: compiledDescription,
        receipts: receiptUrls,
        ...(backendCategory === 'travel' && {
          transportMode: transportMode.toLowerCase(),
          source: source.trim(),
          destination: destination.trim(),
        })
      };

      const res = await expenseApi.create(payload);
      if (res.data && res.data.success) {
        Alert.alert('Success', 'Your expense claim has been successfully logged!');
        
        // Reset states
        setAmount('');
        setDescription('');
        setSource('');
        setDestination('');
        setTransportMode('bike');
        setReceiptImage(null);
        setShowAddModal(false);
        
        fetchExpenses();
      }
    } catch (e) {
      console.log('⚠️ ExpensesScreen: Submission failed:', e.message);
      Alert.alert('Submission Error', 'Failed to log expense claim. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusStyle = (statusVal) => {
    switch (statusVal) {
      case 'approved':
        return { bg: '#e6fbf2', text: '#10b981', label: 'APPROVED' };
      case 'rejected':
        return { bg: '#fde8e8', text: '#ef4444', label: 'REJECTED' };
      default:
        return { bg: '#fef3c7', text: '#d97706', label: 'PENDING' };
    }
  };

  const totalClaimed = history.reduce((sum, item) => sum + (item.amount || 0), 0).toFixed(2);
  const approvedClaimed = history.filter(item => item.status === 'approved').reduce((sum, item) => sum + (item.amount || 0), 0).toFixed(2);
  const pendingClaimed = history.filter(item => item.status === 'pending').reduce((sum, item) => sum + (item.amount || 0), 0).toFixed(2);

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={fetching} onRefresh={fetchExpenses} colors={['#1d4ed8']} />
      }
    >
      {/* 1. Header titles */}
      <View style={styles.headerRowContainer}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Expense Claims</Text>
          <Text style={styles.subtitle}>Track your field expenses and reimbursements.</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity 
            style={styles.logNewBtnHeader} 
            onPress={() => setShowAddModal(true)}
          >
            <Plus size={16} color="#fff" />
            <Text style={styles.logNewBtnText}>Add Expense</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Premium Stats Summary Card Row */}
      <View style={styles.statsSummaryContainer}>
        <Surface style={[styles.statSummaryCard, { borderLeftColor: '#3b82f6' }]} elevation={1}>
          <Text style={styles.statSummaryLabel}>TOTAL CLAIMED</Text>
          <Text style={styles.statSummaryValue}>₹{totalClaimed}</Text>
        </Surface>

        <Surface style={[styles.statSummaryCard, { borderLeftColor: '#f59e0b' }]} elevation={1}>
          <Text style={styles.statSummaryLabel}>PENDING</Text>
          <Text style={styles.statSummaryValue}>₹{pendingClaimed}</Text>
        </Surface>
      </View>

      {/* 3. Add Expense Modal (Premium Dark Theme matching user's image) */}
      <Modal
        visible={showAddModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Surface style={styles.modalContent} elevation={5}>
            
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Expense</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)} style={styles.closeBtn}>
                <X size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              
              {/* Category selector */}
              <Text style={styles.modalSectionLabel}>CATEGORY</Text>
              <View style={styles.modalCategoryRow}>
                {[
                  { id: 'Fuel', label: 'Fuel', Icon: Fuel },
                  { id: 'Food', label: 'Food', Icon: Utensils },
                  { id: 'Hotel', label: 'Hotel', Icon: Building2 },
                  { id: 'Travel', label: 'Travel', Icon: Car },
                  { id: 'Misc', label: 'Misc', Icon: Package },
                ].map((item) => {
                  const isSelected = category === item.id;
                  const IconComponent = item.Icon;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.modalCategoryBtn, isSelected && styles.modalCategoryBtnActive]}
                      onPress={() => setCategory(item.id)}
                    >
                      <View style={styles.modalCategoryEmoji}>
                        <IconComponent size={20} color={isSelected ? '#3b82f6' : '#64748b'} />
                      </View>
                      <Text style={[styles.modalCategoryLabel, isSelected && styles.modalCategoryLabelActive]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Travel Section: Transport Mode, Source, Destination */}
              {category.toLowerCase() === 'travel' && (
                <View style={styles.travelDetailsBox}>
                  <Text style={styles.travelBoxLabel}>TRANSPORT MODE</Text>
                  
                  {/* Transport Mode buttons */}
                  <View style={styles.transportModeRow}>
                    {[
                      { id: 'bike', label: 'BIKE', Icon: Bike },
                      { id: 'train', label: 'TRAIN', Icon: Train },
                      { id: 'bus', label: 'BUS', Icon: Bus },
                      { id: 'taxi', label: 'TAXI', Icon: Car },
                    ].map((mode) => {
                      const isModeSelected = transportMode === mode.id;
                      const ModeIcon = mode.Icon;
                      return (
                        <TouchableOpacity
                          key={mode.id}
                          style={[styles.transportModeBtn, isModeSelected && styles.transportModeBtnActive]}
                          onPress={() => setTransportMode(mode.id)}
                        >
                          <ModeIcon size={16} color={isModeSelected ? '#3b82f6' : '#64748b'} style={styles.transportModeEmoji} />
                          <Text style={[styles.transportModeLabel, isModeSelected && styles.transportModeLabelActive]}>
                            {mode.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Source and Destination input fields side by side */}
                  <View style={styles.travelRouteRow}>
                    <View style={styles.travelInputContainer}>
                      <Text style={styles.travelInputLabel}>SOURCE</Text>
                      <View style={styles.travelInputSlot}>
                        <MapPin size={12} color="#a1a1aa" style={{ marginRight: 6 }} />
                        <TextInput
                          placeholder="From..."
                          placeholderTextColor="#52525b"
                          value={source}
                          onChangeText={setSource}
                          style={styles.travelInput}
                        />
                      </View>
                    </View>

                    <View style={styles.travelInputContainer}>
                      <Text style={styles.travelInputLabel}>DESTINATION</Text>
                      <View style={styles.travelInputSlot}>
                        <Navigation size={12} color="#a1a1aa" style={{ marginRight: 6 }} />
                        <TextInput
                          placeholder="To..."
                          placeholderTextColor="#52525b"
                          value={destination}
                          onChangeText={setDestination}
                          style={styles.travelInput}
                        />
                      </View>
                    </View>
                  </View>

                </View>
              )}

              {/* Amount */}
              <Text style={styles.modalSectionLabel}>AMOUNT (₹) *</Text>
              <TextInput
                placeholder="0.00"
                placeholderTextColor="#52525b"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                style={styles.modalTextInput}
              />

              {/* Description */}
              <Text style={styles.modalSectionLabel}>DESCRIPTION</Text>
              <TextInput
                placeholder="Brief description..."
                placeholderTextColor="#52525b"
                value={description}
                onChangeText={setDescription}
                style={styles.modalTextInput}
              />

              {/* Date */}
              <Text style={styles.modalSectionLabel}>DATE</Text>
              <View style={styles.modalDateSlot}>
                <TextInput
                  placeholder="DD-MM-YYYY"
                  placeholderTextColor="#52525b"
                  value={date}
                  onChangeText={setDate}
                  style={styles.modalDateInput}
                />
                <Calendar size={16} color="#94a3b8" />
              </View>

              {/* Receipt photo - small upload box as requested! */}
              <Text style={styles.modalSectionLabel}>RECEIPT PHOTO</Text>
              <View style={styles.smallReceiptContainer}>
                {receiptImage ? (
                  <View style={styles.smallImageWrapper}>
                    <Image source={{ uri: receiptImage.uri }} style={[styles.smallImagePreview, uploadingImage && { opacity: 0.5 }]} />
                    {uploadingImage && (
                      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}>
                        <ActivityIndicator size="small" color="#2563eb" />
                      </View>
                    )}
                    {!uploadingImage && (
                      <TouchableOpacity style={styles.smallRemoveBtn} onPress={() => setReceiptImage(null)}>
                        <XCircle size={16} color="#ef4444" fill="#fff" />
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  <TouchableOpacity style={styles.smallDashedUploadBox} onPress={handlePickImage}>
                    <Plus size={18} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Footer action buttons */}
              <View style={styles.modalFooter}>
                <TouchableOpacity onPress={() => setShowAddModal(false)} style={styles.cancelBtn}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.submitBtnDark, loading && { opacity: 0.8 }]} 
                  onPress={handleSubmit}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.submitBtnTextDark}>
                      {uploadingImage ? 'Uploading...' : 'Submit'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

            </ScrollView>
          </Surface>
        </KeyboardAvoidingView>
      </Modal>



      {/* 4. Submission History */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Submission History</Text>
        <TouchableOpacity onPress={fetchExpenses}>
          <Text style={styles.viewAllText}>Refresh List ↻</Text>
        </TouchableOpacity>
      </View>

      {/* History Ledger List */}
      <View style={styles.historyList}>
        {history.length === 0 ? (
          <Surface style={[styles.historyCard, { justifyContent: 'center', paddingVertical: 24 }]} elevation={1}>
            <Text style={{ fontSize: 12, color: '#64748b', textAlign: 'center', width: '100%' }}>No expenses logged yet.</Text>
          </Surface>
        ) : (
          history.map((item) => {
            const badge = getStatusStyle(item.status);
            return (
              <Surface key={item._id || item.id} style={styles.historyCard} elevation={1}>
                <View style={styles.cardLeft}>
                  <View style={styles.historyIconCircle}>
                    {item.category?.toLowerCase() === 'fuel' && <Fuel size={16} color="#475569" />}
                    {(item.category?.toLowerCase() === 'meals' || item.category?.toLowerCase() === 'food') && <Utensils size={16} color="#475569" />}
                    {item.category?.toLowerCase() === 'travel' && <Truck size={16} color="#475569" />}
                    {item.category?.toLowerCase() !== 'fuel' && item.category?.toLowerCase() !== 'meals' && item.category?.toLowerCase() !== 'food' && item.category?.toLowerCase() !== 'travel' && <Wallet size={16} color="#475569" />}
                  </View>
                  <View style={styles.historyInfo}>
                    <Text style={styles.historyCardTitle}>
                      {item.category ? (item.category.toLowerCase() === 'food' ? 'MEALS' : item.category.toUpperCase()) : 'FIELD EXPENSE'}
                    </Text>
                    <Text style={styles.historyCardMeta} numberOfLines={1}>
                      {new Date(item.date || item.createdAt).toLocaleDateString('en-GB')} • {item.description}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardRight}>
                  <Text style={styles.historyAmount}>₹{item.amount}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: badge.text }]}>{badge.label}</Text>
                  </View>
                </View>

                {item.receipts && item.receipts.length > 0 ? (
                  <Image 
                    source={{ uri: item.receipts[0] }} 
                    style={{ width: 32, height: 32, borderRadius: 6, marginLeft: 8 }} 
                  />
                ) : (
                  <ChevronRight size={16} color="#cbd5e1" style={{ marginLeft: 8 }} />
                )}
              </Surface>
            );
          })
        )}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingTop: Platform.OS === 'ios' ? 48 : 40,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
  },
  headerRowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  logNewBtnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a3d3c', // Premium emerald/dark teal matching current design language
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#0a3d3c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  logNewBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  statsSummaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statSummaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    marginHorizontal: 4,
    borderLeftWidth: 3.5,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statSummaryLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  statSummaryValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    width: '100%',
    maxHeight: '90%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  closeBtn: {
    padding: 4,
  },
  modalScroll: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  modalSectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 16,
  },
  modalCategoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalCategoryBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginHorizontal: 4,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalCategoryBtnActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  modalCategoryEmoji: {
    marginBottom: 4,
  },
  modalCategoryLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#64748b',
  },
  modalCategoryLabelActive: {
    color: '#3b82f6',
  },
  travelDetailsBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    marginVertical: 12,
  },
  travelBoxLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#3b82f6',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  transportModeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  transportModeBtn: {
    width: '23%',
    aspectRatio: 1.25,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transportModeBtnActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 1,
  },
  transportModeEmoji: {
    marginBottom: 2,
  },
  transportModeLabel: {
    fontSize: 8,
    color: '#64748b',
    fontWeight: 'bold',
  },
  transportModeLabelActive: {
    color: '#3b82f6',
  },
  travelRouteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  travelInputContainer: {
    width: '48%',
  },
  travelInputLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#64748b',
    marginBottom: 6,
  },
  travelInputSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 8,
    height: 38,
  },
  travelInput: {
    flex: 1,
    fontSize: 11,
    color: '#0f172a',
    padding: 0,
  },
  modalTextInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    height: 48,
    fontSize: 13,
    color: '#0f172a',
    marginBottom: 10,
  },
  modalDateSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 10,
  },
  modalDateInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
  },
  smallReceiptContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 4,
  },
  smallDashedUploadBox: {
    width: 60,
    height: 60,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#94a3b8',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallImageWrapper: {
    width: 60,
    height: 60,
    borderRadius: 12,
    position: 'relative',
  },
  smallImagePreview: {
    width: 60,
    height: 60,
    borderRadius: 12,
    resizeMode: 'cover',
  },
  smallRemoveBtn: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  cancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginRight: 12,
  },
  cancelBtnText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: 'bold',
  },
  submitBtnDark: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  submitBtnTextDark: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#64748b',
  },
  historyList: {},
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1.3,
  },
  historyIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  historyInfo: {
    flex: 1,
  },
  historyCardTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  historyCardMeta: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  cardRight: {
    alignItems: 'flex-end',
    flex: 0.7,
  },
  historyAmount: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  statusBadgeText: {
    fontSize: 8,
    fontWeight: 'bold',
  },
});
