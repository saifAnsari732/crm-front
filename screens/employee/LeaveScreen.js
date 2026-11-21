import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, View, ScrollView, TouchableOpacity, RefreshControl, 
  Alert, Dimensions, Platform, ActivityIndicator 
} from 'react-native';
import { Text, Surface, Portal, Modal, TextInput, Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { 
  Calendar, CalendarPlus, Plus, ChevronRight, CheckCircle, 
  Clock, ShieldAlert, BadgeAlert, ArrowLeft 
} from 'lucide-react-native';
import { leaveApi } from '../../services/api';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export default function LeaveScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [leaves, setLeaves] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [leaveType, setLeaveType] = useState('Annual Leave');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  // Set default placeholder dates
  useEffect(() => {
    const today = new Date();
    const formatted = today.toISOString().split('T')[0]; // YYYY-MM-DD
    setStartDate(formatted);
    setEndDate(formatted);
  }, []);

  useEffect(() => {
    fetchLeaves();
  }, []);

  const fetchLeaves = async () => {
    try {
      setFetching(true);
      const res = await leaveApi.getMy();
      if (res.data && res.data.success) {
        setLeaves(res.data.leaves || []);
      }
    } catch (e) {
      console.log('⚠️ LeaveScreen: Failed to fetch leaves:', e.message);
    } finally {
      setFetching(false);
    }
  };

  const handleRequestLeave = async () => {
    if (!startDate || !endDate || !reason) {
      Alert.alert('Incomplete Form', 'Please enter start date, end date, and leave reason.');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        leaveType,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason
      };

      const res = await leaveApi.apply(payload);
      if (res.data && res.data.success) {
        Alert.alert('Success', 'Your leave request has been submitted successfully to the database.');
        setIsModalOpen(false);
        setReason('');
        fetchLeaves();
      }
    } catch (e) {
      console.log('⚠️ LeaveScreen: Failed to request leave:', e.message);
      Alert.alert('Error', 'Failed to submit leave request. Please check format and try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusStyle = (statusVal) => {
    switch (statusVal) {
      case 'approved':
        return { bg: '#e6fbf2', text: '#10b981', label: 'APPROVED', color: '#10b981' };
      case 'rejected':
        return { bg: '#fde8e8', text: '#ef4444', label: 'REJECTED', color: '#ef4444' };
      default:
        return { bg: '#fef3c7', text: '#d97706', label: 'PENDING', color: '#d97706' };
    }
  };

  // Dynamic Roster Analytics Calculations
  const approvedLeavesCount = leaves.filter(l => l.status === 'approved').length;
  const pendingRequestsCount = leaves.filter(l => l.status === 'pending').length;
  const totalApprovedDays = leaves
    .filter(l => l.status === 'approved')
    .reduce((acc, l) => {
      const diffTime = Math.abs(new Date(l.endDate) - new Date(l.startDate));
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return acc + diffDays;
    }, 0);
  const availableBalance = Math.max(0, 18 - totalApprovedDays);

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={fetching} onRefresh={fetchLeaves} colors={['#1d4ed8']} />
      }
    >
      {/* Top Header */}
      <View style={styles.topHeaderRow}>
        <TouchableOpacity
          style={styles.backBtnHeader}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(employee)/dashboard'))}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color="#0f766e" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.topHeaderTitle}>Leave Management</Text>
          <Text style={styles.topHeaderSub}>Apply and track your field leaves</Text>
        </View>
      </View>

      {/* Available Leave Balance Card */}
      <Surface style={styles.balanceCard} elevation={2}>
        <View style={styles.balanceLeft}>
          <Text style={styles.balanceCardLabel}>Available Leave Balance</Text>
          <Text style={styles.balanceVal}>{availableBalance} Days</Text>
          <Text style={styles.balanceSub}>Limit: 18 Annual Days Total</Text>

          {/* Plus Action Button */}
          <TouchableOpacity style={styles.requestBtn} onPress={() => setIsModalOpen(true)}>
            <Plus size={16} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.requestBtnText}>Request Leave</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.balanceRight}>
          <Calendar size={84} color="rgba(0,0,0,0.03)" style={styles.calendarWatermark} />
        </View>
      </Surface>

      {/* Ratios Metrics Rows */}
      <View style={styles.metricsRow}>
        <Surface style={styles.metricItemCard} elevation={1}>
          <Text style={styles.metricLabel}>Approved Leaves</Text>
          <Text style={styles.metricValText}>{approvedLeavesCount} Requests</Text>
        </Surface>
        
        <Surface style={styles.metricItemCard} elevation={1}>
          <Text style={styles.metricLabel}>Pending Requests</Text>
          <Text style={styles.metricValText}>{pendingRequestsCount} Pending</Text>
        </Surface>
      </View>

      {/* History Header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Leave History</Text>
        <TouchableOpacity onPress={fetchLeaves}>
          <Text style={styles.viewAllText}>Refresh ↻</Text>
        </TouchableOpacity>
      </View>

      {/* History Cards List */}
      <View style={styles.historyList}>
        {leaves.length === 0 ? (
          <Surface style={[styles.historyCard, { justifyContent: 'center', paddingVertical: 24 }]} elevation={1}>
            <Text style={{ fontSize: 12, color: '#64748b', textAlign: 'center', width: '100%' }}>No leave requests registered.</Text>
          </Surface>
        ) : (
          leaves.map((item) => {
            const badge = getStatusStyle(item.status);
            const diffTime = Math.abs(new Date(item.endDate) - new Date(item.startDate));
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

            return (
              <Surface key={item._id || item.id} style={styles.historyCard} elevation={1}>
                <View style={styles.historyLeft}>
                  <Text style={styles.historyType}>{item.leaveType || 'General Leave'}</Text>
                  <Text style={styles.historyDates}>
                    {new Date(item.startDate).toLocaleDateString('en-GB')} - {new Date(item.endDate).toLocaleDateString('en-GB')}
                  </Text>
                  <Text style={styles.historyDuration}>{diffDays} {diffDays === 1 ? 'Day' : 'Days'} • {item.reason || 'No reason listed'}</Text>

                  <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                    <View style={[styles.statusDot, { backgroundColor: badge.color }]} />
                    <Text style={[styles.statusText, { color: badge.color }]}>{badge.label}</Text>
                  </View>
                </View>
                <ChevronRight size={18} color="#cbd5e1" />
              </Surface>
            );
          })
        )}
      </View>

      {/* Leave Request Sheet Modal Form */}
      <Portal>
        <Modal 
          visible={isModalOpen} 
          onDismiss={() => setIsModalOpen(false)}
          contentContainerStyle={styles.modalContent}
        >
          <Text style={styles.modalTitle}>Request Time Off</Text>
          
          <Text style={styles.modalFieldLabel}>Select Leave Type</Text>
          <View style={styles.modalSelectorRow}>
            {['Annual Leave', 'Sick Leave', 'Personal'].map((type) => (
              <TouchableOpacity 
                key={type} 
                style={[styles.selectorBtn, leaveType === type && styles.selectorBtnActive]}
                onPress={() => setLeaveType(type)}
              >
                <Text style={[styles.selectorBtnText, leaveType === type && styles.selectorBtnTextActive]}>
                  {type.split(' ')[0]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            label="Start Date (YYYY-MM-DD)"
            value={startDate}
            onChangeText={setStartDate}
            mode="outlined"
            style={styles.modalInput}
            activeOutlineColor="#1d4ed8"
          />

          <TextInput
            label="End Date (YYYY-MM-DD)"
            value={endDate}
            onChangeText={setEndDate}
            mode="outlined"
            style={styles.modalInput}
            activeOutlineColor="#1d4ed8"
          />

          <TextInput
            label="Reason for request"
            value={reason}
            onChangeText={setReason}
            mode="outlined"
            multiline
            numberOfLines={3}
            style={styles.modalInput}
            activeOutlineColor="#1d4ed8"
          />

          <View style={styles.modalActions}>
            <Button 
              mode="text" 
              textColor="#64748b" 
              onPress={() => setIsModalOpen(false)}
              style={{ marginRight: 10 }}
            >
              Cancel
            </Button>
            {loading ? (
              <ActivityIndicator size="small" color="#1d4ed8" />
            ) : (
              <Button 
                mode="contained" 
                buttonColor="#1d4ed8"
                onPress={handleRequestLeave}
              >
                Submit
              </Button>
            )}
          </View>
        </Modal>
      </Portal>
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
  topHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backBtnHeader: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  topHeaderTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  topHeaderSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  balanceCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#0a3d3c',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  balanceLeft: {
    flex: 1.2,
  },
  balanceCardLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#64748b',
  },
  balanceVal: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0f172a',
    marginTop: 6,
  },
  balanceSub: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 4,
    fontWeight: '500',
  },
  requestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a3d3c',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
    marginTop: 16,
  },
  requestBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  balanceRight: {
    flex: 0.8,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  calendarWatermark: {
    opacity: 0.8,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  metricItemCard: {
    backgroundColor: '#fff',
    width: '48%',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#64748b',
  },
  metricValText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
    marginTop: 8,
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
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  historyLeft: {
    flex: 1,
  },
  historyType: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  historyDates: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  historyDuration: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  modalContent: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 20,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 16,
  },
  modalFieldLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#475569',
    marginBottom: 8,
  },
  modalSelectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  selectorBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    marginHorizontal: 3,
  },
  selectorBtnActive: {
    borderColor: '#008080',
    backgroundColor: '#f0fdf4',
  },
  selectorBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#475569',
  },
  selectorBtnTextActive: {
    color: '#008080',
  },
  modalInput: {
    marginBottom: 14,
    backgroundColor: '#fff',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
});
