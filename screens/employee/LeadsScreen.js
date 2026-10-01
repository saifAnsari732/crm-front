import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, View, ScrollView, TouchableOpacity, Alert, Switch, Dimensions, Platform,
  Modal, TextInput, ActivityIndicator
} from 'react-native';
import { Text, Surface, Avatar } from 'react-native-paper';
import { 
  Phone, MessageSquare, MapPin, Calendar, Mail, UserCheck, 
  TrendingUp, Plus, ShieldCheck, Award 
} from 'lucide-react-native';
import { leadAPI } from '../../services/api';

const { width } = Dimensions.get('window');

export default function LeadsScreen() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  // Status Update Pop Box Modal States
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('pending'); // 'pending', 'completed', 'follow-up'
  const [feedback, setFeedback] = useState('');
  const [updating, setUpdating] = useState(false);

  // Add Lead Modal States
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadPhone, setNewLeadPhone] = useState('');
  const [newLeadAddress, setNewLeadAddress] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const res = await leadAPI.getAll();
      if (res.data && res.data.success) {
        let fetchedLeads = res.data.leads || [];
        
        // Auto-seed default test leads from screenshot if database is completely empty
        console.log("lead",fetchedLeads)
        setLeads(fetchedLeads);
      }
    } catch (err) {
      console.log('⚠️ LeadsScreen: Error querying backend leads:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const openFeedbackModal = (lead) => {
    setSelectedLead(lead);
    setSelectedStatus(lead.status || 'pending');
    setFeedback(lead.feedback || '');
    setModalVisible(true);
  };

  const saveLeadUpdate = async () => {
    if (!selectedLead) return;
    try {
      setUpdating(true);
      await leadAPI.update(selectedLead._id, {
        status: selectedStatus,
        feedback: feedback
      });
      setModalVisible(false);
      fetchLeads();
    } catch (err) {
      console.log('⚠️ LeadsScreen: Failed to update lead:', err.message);
      Alert.alert('Error', 'Failed to update lead. Please check connection and try again.');
    } finally {
      setUpdating(false);
    }
  };

  const createNewLead = async () => {
    if (!newLeadName.trim() || !newLeadPhone.trim()) {
      Alert.alert('Validation Error', 'Please fill in Client Name and Phone Number.');
      return;
    }
    try {
      setCreating(true);
      await leadAPI.create({
        name: newLeadName,
        contactNo: newLeadPhone,
        address: newLeadAddress || 'Client Location Address',
        status: 'pending',
        feedback: ''
      });
      setAddModalVisible(false);
      setNewLeadName('');
      setNewLeadPhone('');
      setNewLeadAddress('');
      fetchLeads();
      Alert.alert('Success', 'New Lead registered in database successfully!');
    } catch (err) {
      console.log('⚠️ LeadsScreen: Failed to create lead:', err.message);
      Alert.alert('Error', 'Failed to create new lead. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  // Compute number of active (non-completed) leads
  const activeCount = leads.filter(l => l.status !== 'completed').length;

  return (
    <View style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        style={{ flex: 1 }}
      >
        {/* Header Title and Active Badge */}
        <View style={styles.headerRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.title}>My Leads</Text>
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>{activeCount} ACTIVE</Text>
            </View>
          </View>
          
        </View>

        {/* Live Leads List */}
        <View style={styles.leadsList}>
          {loading ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color="#0a3d3c" />
              <Text style={styles.loaderText}>Loading live database leads...</Text>
            </View>
          ) : leads.length === 0 ? (
            <Surface style={styles.emptyCard} elevation={1}>
              <Text style={styles.emptyText}>No leads found in database.</Text>
              <Text style={styles.emptySubText}>Press the float (+) button to add your first live lead!</Text>
            </Surface>
          ) : (
            leads.map((lead) => (
              <Surface key={lead._id || lead.id} style={styles.leadCard} elevation={1}>
                {/* Header: Name and Status Badge */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <Text style={styles.leadName}>{lead.name}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      lead.status === 'completed' && styles.statusBadgeCompleted,
                      lead.status === 'follow-up' && styles.statusBadgeFollowUp,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        lead.status === 'completed' && styles.statusBadgeTextCompleted,
                        lead.status === 'follow-up' && styles.statusBadgeTextFollowUp,
                      ]}
                    >
                      {lead.status === 'completed'
                        ? 'COMPLETED'
                        : lead.status === 'follow-up'
                        ? 'FOLLOW-UP'
                        : 'PENDING'}
                    </Text>
                  </View>
                </View>

                {/* Details Phone Row */}
                <View style={styles.leadMetaRow}>
                  <Phone size={14} color="#64748b" style={{ marginRight: 8 }} />
                  <Text style={styles.leadMetaText}>{lead.contactNo || 'N/A'}</Text>
                </View>

                {/* Details Location Row */}
                <View style={styles.leadMetaRow}>
                  <MapPin size={14} color="#64748b" style={{ marginRight: 8 }} />
                  <Text style={styles.leadMetaText} numberOfLines={3}>
                    {lead.address || 'No visit location set'}
                  </Text>
                </View>

                {/* Notes/Feedback details (if populated) */}
                {lead.feedback ? (
                  <View style={styles.notesContainer}>
                    <Text style={styles.notesLabel}>Visit Notes & Feedback:</Text>
                    <Text style={styles.notesText}>{lead.feedback}</Text>
                  </View>
                ) : null}

                {/* Actions row: Feedback Button */}
                <View style={styles.cardActionsRow}>
                  <TouchableOpacity
                    style={styles.feedbackBtn}
                    onPress={() => openFeedbackModal(lead)}
                  >
                    <MessageSquare size={14} color="#0f172a" style={{ marginRight: 6 }} />
                    <Text style={styles.feedbackBtnText}>Feedback</Text>
                  </TouchableOpacity>
                </View>
              </Surface>
            ))
          )}
        </View>

        {/* Space block for absolute floating panel */}
        <View style={{ height: 110 }} />
      </ScrollView>

      {/* Floating Panel Container */}
    

      {/* UPDATE STATUS POP BOX MODAL */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Update Lead Status</Text>
            <Text style={styles.modalSubtitle}>Lead: {selectedLead?.name}</Text>

            <Text style={styles.fieldLabel}>SELECT STATUS</Text>
            <View style={styles.statusButtonsContainer}>
              <TouchableOpacity
                style={[
                  styles.statusBtn,
                  selectedStatus === 'pending' && styles.statusBtnActive
                ]}
                onPress={() => setSelectedStatus('pending')}
              >
                <Text
                  style={[
                    styles.statusBtnText,
                    selectedStatus === 'pending' && styles.statusBtnTextActive
                  ]}
                >
                  PENDING
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.statusBtn,
                  selectedStatus === 'completed' && styles.statusBtnActive
                ]}
                onPress={() => setSelectedStatus('completed')}
              >
                <Text
                  style={[
                    styles.statusBtnText,
                    selectedStatus === 'completed' && styles.statusBtnTextActive
                  ]}
                >
                  COMPLETED
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.statusBtn,
                  selectedStatus === 'follow-up' && styles.statusBtnActive
                ]}
                onPress={() => setSelectedStatus('follow-up')}
              >
                <Text
                  style={[
                    styles.statusBtnText,
                    selectedStatus === 'follow-up' && styles.statusBtnTextActive
                  ]}
                >
                  FOLLOW-UP
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>FEEDBACK / NOTES</Text>
            <TextInput
              style={styles.feedbackInput}
              multiline={true}
              numberOfLines={4}
              placeholder="Enter visit details or client feedback..."
              placeholderTextColor="#94a3b8"
              value={feedback}
              onChangeText={setFeedback}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelBtn} 
                onPress={() => setModalVisible(false)}
                disabled={updating}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.saveBtn} 
                onPress={saveLeadUpdate}
                disabled={updating}
              >
                {updating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Update</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ADD NEW LEAD MODAL */}
      <Modal
        visible={addModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Lead</Text>
            <Text style={styles.modalSubtitle}>Create a brand new database client entry</Text>

            <Text style={styles.fieldLabel}>LEAD NAME *</Text>
            <TextInput
              style={styles.singleLineInput}
              placeholder="Enter client / contact name..."
              placeholderTextColor="#94a3b8"
              value={newLeadName}
              onChangeText={setNewLeadName}
            />

            <Text style={styles.fieldLabel}>PHONE NUMBER *</Text>
            <TextInput
              style={styles.singleLineInput}
              placeholder="Enter phone number..."
              placeholderTextColor="#94a3b8"
              keyboardType="phone-pad"
              value={newLeadPhone}
              onChangeText={setNewLeadPhone}
            />

            <Text style={styles.fieldLabel}>MEETING / VISIT ADDRESS</Text>
            <TextInput
              style={styles.singleLineInput}
              placeholder="Enter street, location details..."
              placeholderTextColor="#94a3b8"
              value={newLeadAddress}
              onChangeText={setNewLeadAddress}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelBtn} 
                onPress={() => setAddModalVisible(false)}
                disabled={creating}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.saveBtn} 
                onPress={createNewLead}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>Create Lead</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingTop: Platform.OS === 'ios' ? 48 : 20,
    marginTop: 30,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  addLeadHeaderBtn: {
    backgroundColor: '#0a3d3c',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#0a3d3c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  addLeadHeaderBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    marginTop: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  activeBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1d4ed8',
    letterSpacing: 0.5,
  },
  leadsList: {},
  leadCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardHeaderLeft: {
    flex: 1,
    marginRight: 8,
  },
  leadName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  statusBadge: {
    backgroundColor: '#fef3c7', // Yellow background for pending
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#d97706', // Orange text
  },
  statusBadgeCompleted: {
    backgroundColor: '#dcfce7',
  },
  statusBadgeTextCompleted: {
    color: '#15803d',
  },
  statusBadgeFollowUp: {
    backgroundColor: '#dbeafe',
  },
  statusBadgeTextFollowUp: {
    color: '#1d4ed8',
  },
  leadMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  leadMetaText: {
    fontSize: 12,
    color: '#475569',
    flex: 1,
  },
  notesContainer: {
    marginTop: 12,
    padding: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderLeftWidth: 3.5,
    borderLeftColor: '#2563eb',
  },
  notesLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  notesText: {
    fontSize: 11,
    color: '#334155',
    marginTop: 2,
    lineHeight: 15,
  },
  cardActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 14,
  },
  feedbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  feedbackBtnText: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: 'bold',
  },
  floatingPanelContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(248, 250, 252, 0.85)',
  },
  pipelineBanner: {
    backgroundColor: '#002626',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '78%',
    borderWidth: 1.5,
    borderColor: '#059669',
  },
  pipelineLeft: {
    flex: 1.2,
  },
  pipelineLabel: {
    color: '#cbd5e1',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  pipelineVal: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 4,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  trendText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: 'bold',
  },
  teamRankBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  teamRankText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  plusFloatBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#002626',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  // Modal Overlay and Container Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    width: '100%',
    maxWidth: 340,
    padding: 22,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
  },
  statusButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  statusBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  statusBtnActive: {
    backgroundColor: '#2563eb', // Matches blue active selection
    borderColor: '#2563eb',
  },
  statusBtnText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#475569',
  },
  statusBtnTextActive: {
    color: '#fff',
  },
  feedbackInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    padding: 12,
    fontSize: 12,
    color: '#0f172a',
    height: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
    backgroundColor: '#fff',
  },
  singleLineInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    padding: 12,
    fontSize: 12,
    color: '#0f172a',
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 16,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  cancelBtnText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: 'bold',
  },
  saveBtn: {
    backgroundColor: '#2563eb', // Premium blue button
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 110,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  loaderContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 12,
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
  },
});
