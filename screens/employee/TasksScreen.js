import React, { useState, useEffect, useMemo } from 'react';
import { 
  StyleSheet, View, ScrollView, TouchableOpacity, TextInput, 
  RefreshControl, Alert, Dimensions, Platform, ActivityIndicator,
  Modal, StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Surface } from 'react-native-paper';
import { 
  Search, Calendar, ChevronUp, ChevronDown, 
  CheckCircle2, Plus, Briefcase, ArrowLeft,
  X, Clock, Filter, AlertCircle, Sparkles, CheckSquare
} from 'lucide-react-native';
import { taskApi } from '../../services/api';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

// ── UI/UX Pro Max Enterprise Tokens ──
const COLORS = {
  primary: '#0f766e',
  primaryDark: '#064e3b',
  primaryLight: '#ccfbf1',
  primaryMuted: '#f0fdfa',
  accent: '#f59e0b',
  background: '#f8fafc',
  card: '#ffffff',
  surface: '#f1f5f9',
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
  text: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  success: '#059669',
  successLight: '#ecfdf5',
  successBorder: '#a7f3d0',
  danger: '#dc2626',
  dangerLight: '#fef2f2',
  dangerBorder: '#fecaca',
  warning: '#d97706',
  warningLight: '#fffbeb',
  warningBorder: '#fde68a',
  indigo: '#4f46e5',
  indigoLight: '#eef2ff',
};

export default function TasksScreen() {
  const router = useRouter();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL'); // ALL, PENDING, COMPLETED
  const [expandedId, setExpandedId] = useState(null);

  // Modal and form states for adding a new action plan
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState('medium'); // low, medium, high
  const [submitting, setSubmitting] = useState(false);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await taskApi.getMy();
      if (res.data && res.data.success) {
        const list = res.data.tasks || [];
        setTasks(list);
        if (list.length > 0 && !expandedId) {
          setExpandedId(list[0]._id || list[0].id);
        }
      }
    } catch (err) {
      console.log('⚠️ TasksScreen: Failed to fetch tasks:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const onRefresh = async () => {
    setFetching(true);
    await fetchTasks();
    setFetching(false);
  };

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(admin)/dashboard');
    }
  };

  const handleAddAction = async () => {
    if (!newTitle.trim()) {
      if (Platform.OS === 'web') alert('Please enter a title for your task.');
      else Alert.alert('Validation Error', 'Please enter a title for your task.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await taskApi.create({
        title: newTitle.trim(),
        description: newDescription.trim(),
        priority: newPriority,
        dueDate: new Date().toISOString(),
      });

      if (res.data && res.data.success) {
        if (Platform.OS === 'web') alert('Task created successfully!');
        else Alert.alert('Success', 'Task created successfully!');
        setShowAddModal(false);
        setNewTitle('');
        setNewDescription('');
        setNewPriority('medium');
        fetchTasks();
      }
    } catch (err) {
      console.log('⚠️ TasksScreen: Failed to add task:', err.message);
      if (Platform.OS === 'web') alert('Failed to create task: ' + err.message);
      else Alert.alert('Error', 'Failed to create task. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async (id, title, action) => {
    const targetStatus = action === 'complete' ? 'completed' : 'in-progress';
    const confirmMessage = `Mark "${title}" as successfully ${action === 'complete' ? 'completed' : 'in progress'}?`;

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMessage)) {
        try {
          const res = await taskApi.updateStatus(id, targetStatus);
          if (res.data && res.data.success) {
            fetchTasks();
          }
        } catch (err) {
          alert('Failed to update task status: ' + err.message);
        }
      }
      return;
    }

    Alert.alert(
      `${action === 'complete' ? 'Complete' : 'Update'} Task`,
      confirmMessage,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm', 
          onPress: async () => {
            try {
              const res = await taskApi.updateStatus(id, targetStatus);
              if (res.data && res.data.success) {
                Alert.alert('Success', `Task marked as ${targetStatus}!`);
                fetchTasks();
              }
            } catch (err) {
              console.log('⚠️ TasksScreen: Failed to update status:', err.message);
              Alert.alert('Error', 'Failed to update task status.');
            }
          }
        }
      ]
    );
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const matchSearch = (t.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (t.description || '').toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchSearch) return false;

      if (activeFilter === 'PENDING') return t.status !== 'completed';
      if (activeFilter === 'COMPLETED') return t.status === 'completed';
      return true;
    });
  }, [tasks, searchQuery, activeFilter]);

  // Dynamic Performance Calculations
  const totalTasksCount = tasks.length;
  const completedTasksCount = tasks.filter(t => t.status === 'completed').length;
  const inProgressTasksCount = tasks.filter(t => t.status !== 'completed').length;
  const completionRate = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />

      {/* ── TOP NAV & BRANDED HEADER ── */}
      <LinearGradient
        colors={[COLORS.primaryDark, COLORS.primary]}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView edges={['top', 'left', 'right']}>
          <View style={styles.topNavRow}>
            <TouchableOpacity style={styles.headerBtn} onPress={handleGoBack} activeOpacity={0.7}>
              <ArrowLeft size={20} color="#fff" />
            </TouchableOpacity>

            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.brandTitle}>Task Execution Plan</Text>
              <Text style={styles.brandSub}>Field Action Items & Objectives</Text>
            </View>

            <TouchableOpacity 
              style={styles.createTaskHeaderBtn} 
              onPress={() => setShowAddModal(true)}
              activeOpacity={0.85}
            >
              <Plus size={16} color="#064e3b" />
              <Text style={styles.createTaskHeaderBtnText}>New Task</Text>
            </TouchableOpacity>
          </View>

          {/* ── METRICS SUMMARY STRIP ── */}
          <View style={styles.metricsStrip}>
            <View style={styles.metricItem}>
              <Text style={styles.metricNumber}>{totalTasksCount}</Text>
              <Text style={styles.metricLabel}>Total Tasks</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={[styles.metricNumber, { color: '#fef08a' }]}>{inProgressTasksCount}</Text>
              <Text style={styles.metricLabel}>Pending</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={[styles.metricNumber, { color: '#a7f3d0' }]}>{completedTasksCount}</Text>
              <Text style={styles.metricLabel}>Completed</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricNumber}>{completionRate}%</Text>
              <Text style={styles.metricLabel}>Done Rate</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* ── MAIN SCROLLABLE CONTENT ── */}
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={fetching} onRefresh={onRefresh} colors={[COLORS.primary]} tintColor={COLORS.primary} />
        }
      >
        {/* Modern Search & Filter Controls */}
        <View style={styles.searchFilterSection}>
          <View style={styles.searchBox}>
            <Search size={18} color={COLORS.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              placeholder="Search tasks or client names..."
              placeholderTextColor={COLORS.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Filter Chips Row */}
          <View style={styles.filterChipsRow}>
            <TouchableOpacity
              style={[styles.filterChip, activeFilter === 'ALL' && styles.filterChipActive]}
              onPress={() => setActiveFilter('ALL')}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterChipText, activeFilter === 'ALL' && styles.filterChipTextActive]}>
                All ({totalTasksCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterChip, activeFilter === 'PENDING' && styles.filterChipActive]}
              onPress={() => setActiveFilter('PENDING')}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterChipText, activeFilter === 'PENDING' && styles.filterChipTextActive]}>
                ⏳ Pending ({inProgressTasksCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterChip, activeFilter === 'COMPLETED' && styles.filterChipActive]}
              onPress={() => setActiveFilter('COMPLETED')}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterChipText, activeFilter === 'COMPLETED' && styles.filterChipTextActive]}>
                ✅ Completed ({completedTasksCount})
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Task Cards List */}
        {loading && !fetching ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading assigned action tasks...</Text>
          </View>
        ) : (
          <View style={styles.tasksList}>
            {filteredTasks.length === 0 ? (
              <Surface style={styles.emptyCard} elevation={1}>
                <View style={styles.emptyIconCircle}>
                  <CheckSquare size={36} color={COLORS.primary} />
                </View>
                <Text style={styles.emptyTitle}>No Tasks Found</Text>
                <Text style={styles.emptySub}>
                  {searchQuery ? 'No tasks match your search criteria.' : 'There are no action tasks in this section.'}
                </Text>
                <TouchableOpacity
                  style={styles.emptyAddBtn}
                  onPress={() => setShowAddModal(true)}
                  activeOpacity={0.8}
                >
                  <Plus size={16} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={styles.emptyAddBtnText}>Create Action Task</Text>
                </TouchableOpacity>
              </Surface>
            ) : (
              filteredTasks.map((item) => {
                const isCompleted = item.status === 'completed';
                const taskId = item._id || item.id;
                const isExpanded = expandedId === taskId;
                const priority = (item.priority || 'medium').toLowerCase();
                
                let priorityColor = COLORS.primary;
                let priorityBg = COLORS.primaryLight;
                if (priority === 'high') {
                  priorityColor = COLORS.danger;
                  priorityBg = COLORS.dangerLight;
                } else if (priority === 'medium') {
                  priorityColor = COLORS.warning;
                  priorityBg = COLORS.warningLight;
                } else {
                  priorityColor = COLORS.success;
                  priorityBg = COLORS.successLight;
                }

                return (
                  <Surface key={taskId} style={[styles.taskCard, isCompleted && styles.taskCardCompleted]} elevation={1}>
                    <TouchableOpacity 
                      style={styles.cardHeaderToggle} 
                      onPress={() => setExpandedId(isExpanded ? null : taskId)}
                      activeOpacity={0.85}
                    >
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <View style={styles.badgeRow}>
                          <View style={[styles.statusBadge, isCompleted ? styles.statusBadgeCompleted : styles.statusBadgeInProgress]}>
                            <Text style={[styles.statusBadgeText, isCompleted ? styles.statusBadgeTextCompleted : styles.statusBadgeTextInProgress]}>
                              {isCompleted ? 'COMPLETED' : 'IN PROGRESS'}
                            </Text>
                          </View>

                          <View style={[styles.priorityBadge, { backgroundColor: priorityBg }]}>
                            <Text style={[styles.priorityBadgeText, { color: priorityColor }]}>
                              {priority.toUpperCase()} PRIORITY
                            </Text>
                          </View>
                        </View>

                        <Text style={[styles.cardTitle, isCompleted && styles.cardTitleCompleted]} numberOfLines={2}>
                          {item.title}
                        </Text>
                      </View>

                      <View style={styles.toggleIconWrap}>
                        {isCompleted ? (
                          <CheckCircle2 size={22} color={COLORS.success} />
                        ) : isExpanded ? (
                          <ChevronUp size={20} color={COLORS.textSecondary} />
                        ) : (
                          <ChevronDown size={20} color={COLORS.textSecondary} />
                        )}
                      </View>
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={styles.cardExpandedContent}>
                        <View style={styles.cardDivider} />

                        {item.description ? (
                          <Text style={[styles.taskDescription, isCompleted && { color: COLORS.textMuted }]}>
                            {item.description}
                          </Text>
                        ) : (
                          <Text style={[styles.taskDescription, { fontStyle: 'italic', color: COLORS.textMuted }]}>
                            No additional notes or description provided.
                          </Text>
                        )}

                        <View style={styles.metaInfoRow}>
                          <View style={styles.metaInfoItem}>
                            <Calendar size={14} color={COLORS.textMuted} style={{ marginRight: 6 }} />
                            <Text style={styles.metaInfoText}>
                              Due: {item.dueDate ? new Date(item.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Today'}
                            </Text>
                          </View>

                          {item.createdAt ? (
                            <View style={styles.metaInfoItem}>
                              <Clock size={14} color={COLORS.textMuted} style={{ marginRight: 6 }} />
                              <Text style={styles.metaInfoText}>
                                Created: {new Date(item.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        {!isCompleted && (
                          <View style={styles.actionButtonsRow}>
                            <TouchableOpacity 
                              style={styles.markCompleteBtn}
                              onPress={() => handleAction(taskId, item.title, 'complete')}
                              activeOpacity={0.85}
                            >
                              <CheckCircle2 size={16} color="#fff" style={{ marginRight: 6 }} />
                              <Text style={styles.markCompleteText}>Mark as Completed</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    )}
                  </Surface>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      {/* ── MODAL: CREATE ACTION TASK ── */}
      <Modal
        visible={showAddModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Surface style={styles.modalContent} elevation={5}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Create Action Task</Text>
                <Text style={styles.modalSub}>Assign field objective or operational task</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAddModal(false)} style={styles.closeModalBtn}>
                <X size={20} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>TASK TITLE *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Dealer Visit & Sample Delivery"
                placeholderTextColor={COLORS.textMuted}
                value={newTitle}
                onChangeText={setNewTitle}
              />

              <Text style={styles.inputLabel}>TASK DETAILS & OBJECTIVES</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Enter client details, goals, or meeting agenda..."
                placeholderTextColor={COLORS.textMuted}
                multiline={true}
                numberOfLines={3}
                value={newDescription}
                onChangeText={setNewDescription}
              />

              <Text style={styles.inputLabel}>PRIORITY LEVEL</Text>
              <View style={styles.prioritySelectorRow}>
                {['low', 'medium', 'high'].map((p) => {
                  const isSelected = newPriority === p;
                  return (
                    <TouchableOpacity
                      key={p}
                      style={[
                        styles.prioritySelectBtn,
                        isSelected && (
                          p === 'high' ? styles.priorityBtnActive_high :
                          p === 'medium' ? styles.priorityBtnActive_medium :
                          styles.priorityBtnActive_low
                        )
                      ]}
                      onPress={() => setNewPriority(p)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.prioritySelectText, isSelected && styles.prioritySelectTextActive]}>
                        {p.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[styles.submitActionBtn, submitting && { opacity: 0.7 }]}
                onPress={handleAddAction}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <CheckSquare size={16} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.submitActionBtnText}>Save & Assign Task</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </Surface>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerGradient: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 14 : 0,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  topNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingTop: Platform.OS === 'android' ? 8 : 4,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  brandSub: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
    fontWeight: '500',
  },
  createTaskHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  createTaskHeaderBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#064e3b',
    marginLeft: 4,
  },
  metricsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricNumber: {
    fontSize: 17,
    fontWeight: '900',
    color: '#ffffff',
  },
  metricLabel: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.75)',
    fontWeight: '600',
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  searchFilterSection: {
    marginBottom: 16,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
    width: '100%',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '500',
  },
  filterChipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.primaryDark,
    borderColor: COLORS.primaryDark,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  loadingBox: {
    paddingVertical: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  tasksList: {
    gap: 12,
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  emptySub: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    maxWidth: 260,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 16,
  },
  emptyAddBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  taskCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  taskCardCompleted: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  cardHeaderToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  statusBadgeInProgress: {
    backgroundColor: COLORS.indigoLight,
  },
  statusBadgeCompleted: {
    backgroundColor: COLORS.successLight,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  statusBadgeTextInProgress: {
    color: COLORS.indigo,
  },
  statusBadgeTextCompleted: {
    color: COLORS.success,
  },
  priorityBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  priorityBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    lineHeight: 20,
  },
  cardTitleCompleted: {
    color: COLORS.textMuted,
    textDecorationLine: 'line-through',
  },
  toggleIconWrap: {
    paddingLeft: 8,
  },
  cardDivider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginBottom: 12,
  },
  cardExpandedContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  taskDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
    marginBottom: 12,
  },
  metaInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 14,
  },
  metaInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaInfoText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  actionButtonsRow: {
    flexDirection: 'row',
  },
  markCompleteBtn: {
    flex: 1,
    backgroundColor: COLORS.success,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: COLORS.success,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  markCompleteText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  modalSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  closeModalBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: COLORS.card,
  },
  modalForm: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 13,
    color: COLORS.text,
    marginBottom: 16,
  },
  textArea: {
    height: 90,
    textAlignVertical: 'top',
  },
  prioritySelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  prioritySelectBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  priorityBtnActive_low: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  priorityBtnActive_medium: {
    backgroundColor: COLORS.warning,
    borderColor: COLORS.warning,
  },
  priorityBtnActive_high: {
    backgroundColor: COLORS.danger,
    borderColor: COLORS.danger,
  },
  prioritySelectText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
  },
  prioritySelectTextActive: {
    color: '#ffffff',
  },
  submitActionBtn: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 10,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  submitActionBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
