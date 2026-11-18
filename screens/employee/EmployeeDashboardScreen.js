import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  Dimensions,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Image,
  StatusBar,
  Linking,
  DeviceEventEmitter
} from "react-native";
import * as ImagePicker from 'expo-image-picker';
import { Text, Surface } from "react-native-paper";
import {
  Menu,
  Bell,
  Navigation,
  MapPin,
  Users,
  Wallet,
  ClipboardCheck,
  Calendar,
  UserPlus,
  Play,
  ChevronRight,
  TrendingUp,
  Footprints,
  X,
  Home,
  Radio,
  Building2,
  Car,
} from "lucide-react-native";
import useLocationTracker from "../../hooks/useLocationTracker";
import { useRouter, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../context/AuthContext";
import { dashboardApi, meetingApi, expenseApi, taskApi, leadAPI, uploadAPI, getAvatarUrl, compressImageWeb } from "../../services/api";
import { storage } from "../../services/storage";
import socketService from "../../services/socket";

const { width } = Dimensions.get("window");

// Status badge palette for expense claims (mirrors ExpensesScreen)
const getExpenseStatusStyle = (statusVal) => {
  switch (statusVal) {
    case "approved":
      return { bg: "#e6fbf2", text: "#10b981", label: "APPROVED" };
    case "rejected":
      return { bg: "#fde8e8", text: "#ef4444", label: "REJECTED" };
    default:
      return { bg: "#fef3c7", text: "#d97706", label: "PENDING" };
  }
};

// Using fontWeight instead of fontFamily to avoid conflicts with react-native-paper's Text component

export default function EmployeeDashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isTracking, startTracking, stopTracking, requestPermissions } = useLocationTracker();
  const [currentDate, setCurrentDate] = useState("");
  const [showMenu, setShowMenu] = useState(false);

  const [notificationItems, setNotificationItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(4);
  const [showNotifications, setShowNotifications] = useState(false);

  // Selfie Custom Resize & Punch In Modal States
  const [pendingSelfieUri, setPendingSelfieUri] = useState(null);
  const [selfieAspectMode, setSelfieAspectMode] = useState('half'); // 'half' (1:1) or 'full' (3:4)
  const [selfieModalVisible, setSelfieModalVisible] = useState(false);
  const [submittingPunchIn, setSubmittingPunchIn] = useState(false);

  const [stats, setStats] = useState({
    distanceToday: "0.00",
    meetingCount: 0,
    totalDistanceAllDates: "0.00",
    travelRate: 0,
    status: "absent",
  });
  const [recentMeetings, setRecentMeetings] = useState([]);
  const [recentExpenses, setRecentExpenses] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isUploadingSelfie, setIsUploadingSelfie] = useState(false);

  const fetchNotifications = async () => {
    try {
      const [tasksRes, leadsRes] = await Promise.all([
        taskApi.getMy().catch(() => ({ data: { success: false } })),
        leadAPI.getAll().catch(() => ({ data: { success: false } })),
      ]);

      const items = [];
      if (tasksRes.data && tasksRes.data.success) {
        const activeTasks = (tasksRes.data.tasks || []).filter(t => t.status !== 'completed');
        activeTasks.forEach(t => {
          items.push({
            id: t._id || t.id,
            type: 'task',
            title: `New Task: ${t.title}`,
            description: t.description || 'No description provided.',
            date: t.createdAt || t.dueDate || new Date(),
          });
        });
      }
      if (leadsRes.data && leadsRes.data.success) {
        const activeLeads = (leadsRes.data.leads || []).filter(l => l.status !== 'completed');
        activeLeads.forEach(l => {
          items.push({
            id: l._id || l.id,
            type: 'lead',
            title: `New Lead Assigned: ${l.name}`,
            description: `Contact: ${l.contactNo || ''} | ${l.address || ''}`,
            date: l.createdAt || new Date(),
          });
        });
      }
      items.sort((a, b) => new Date(b.date) - new Date(a.date));
      if (items.length > 0) {
        setNotificationItems(items);
        setUnreadCount(items.length);
      }
    } catch (err) {}
  };

  useEffect(() => {
    const date = new Date();
    const options = { weekday: "long", month: "short", day: "numeric" };
    setCurrentDate(date.toLocaleDateString("en-US", options).toUpperCase());

    // Instant 0ms render from local cache (Stale-While-Revalidate)
    storage.getItem('cache_emp_dashboard_v1').then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed.stats) setStats(parsed.stats);
          if (Array.isArray(parsed.recentMeetings)) setRecentMeetings(parsed.recentMeetings);
          if (Array.isArray(parsed.recentExpenses)) setRecentExpenses(parsed.recentExpenses);
        } catch (_) {}
      }
    }).catch(() => {});
  }, []);

  const loadDashboardData = async () => {
    try {
      const [statsRes, meetingsRes, expensesRes] = await Promise.all([
        dashboardApi.getStats().catch(() => ({ data: { success: false } })),
        meetingApi.getMy().catch(() => ({ data: { success: false } })),
        expenseApi.getMy().catch(() => ({ data: { success: false } })),
      ]);

      let nextStats = null;
      let nextMeetings = null;
      let nextExpenses = null;

      if (statsRes.data && statsRes.data.success) {
        nextStats = statsRes.data.stats;
        setStats(nextStats);
      }
      if (meetingsRes.data && meetingsRes.data.success) {
        nextMeetings = meetingsRes.data.meetings || [];
        setRecentMeetings(nextMeetings);
      }
      if (expensesRes.data && expensesRes.data.success) {
        nextExpenses = expensesRes.data.expenses || [];
        setRecentExpenses(nextExpenses);
      }

      if (nextStats || nextMeetings || nextExpenses) {
        storage.setItem('cache_emp_dashboard_v1', JSON.stringify({
          stats: nextStats || stats,
          recentMeetings: (nextMeetings || recentMeetings).slice(0, 10),
          recentExpenses: (nextExpenses || recentExpenses).slice(0, 10),
          updatedAt: Date.now()
        })).catch(() => {});
      }
    } catch (err) {}
  };

  const syncLocalDistance = async () => {
    try {
      const cachedDist = await storage.getItem('tracking_accumulated_distance');
      if (cachedDist) {
        const parsed = parseFloat(cachedDist) || 0;
        if (parsed > 0) {
          setStats((prev) => ({
            ...prev,
            distanceToday: Math.max(parseFloat(prev?.distanceToday || 0), parsed).toFixed(2),
          }));
        }
      }
    } catch (_) {}
  };

  // Re-sync instantly whenever the employee opens or switches back to this dashboard tab
  useFocusEffect(
    useCallback(() => {
      syncLocalDistance();
      loadDashboardData();
      fetchNotifications();
    }, [isTracking])
  );

  // Real-time live distance stream from WebSocket + storage cache while on duty
  useEffect(() => {
    let activeSock = null;
    let pollTimer = null;
    let liveDistSub = null;

    if (isTracking) {
      syncLocalDistance();

      // Listen to immediate local and synced distance events from locationTask
      liveDistSub = DeviceEventEmitter.addListener('LiveDistanceUpdated', (data) => {
        if (!data) return;
        const incomingKm = parseFloat(data.totalDistance);
        if (!isNaN(incomingKm) && incomingKm >= 0) {
          setStats((prev) => ({
            ...prev,
            distanceToday: Math.max(parseFloat(prev?.distanceToday || 0), incomingKm).toFixed(2),
          }));
        }
      });

      socketService.connect().then((sock) => {
        if (!sock) return;
        activeSock = sock;
        activeSock.on('employee_location', (payload) => {
          if (!payload) return;
          const incomingKm = parseFloat(payload.officialDistance ?? payload.totalDistanceToday ?? payload.todayKm ?? payload.totalDistance ?? payload.sessionDistance);
          if (!isNaN(incomingKm) && incomingKm >= 0) {
            setStats((prev) => ({
              ...prev,
              distanceToday: incomingKm > 0 ? incomingKm.toFixed(2) : prev?.distanceToday,
            }));
          }
        });
      }).catch(() => {});

      pollTimer = setInterval(() => {
        syncLocalDistance();
        loadDashboardData();
      }, 8000);
    }

    return () => {
      if (liveDistSub) {
        liveDistSub.remove();
      }
      if (activeSock) {
        activeSock.off('employee_location');
      }
      if (pollTimer) {
        clearInterval(pollTimer);
      }
    };
  }, [isTracking]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadDashboardData(), fetchNotifications()]);
    setRefreshing(false);
  };

  const handleClockToggle = async () => {
    if (isTracking) {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.confirm('Are you sure you want to end your active operational tracking shift?')) {
          const res = await stopTracking();
          if (res.success) {
            alert(`Shift Ended. Clock out complete. Logged ${res.totalDistance?.toFixed(2) || 0} km traveled.`);
            loadDashboardData();
          } else {
            alert(res.error || "Failed to stop tracking session.");
          }
        }
        return;
      }

      Alert.alert(
        "Confirm Clock Out",
        "Are you sure you want to end your active operational tracking shift?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "End Shift",
            style: "destructive",
            onPress: async () => {
              const res = await stopTracking();
              if (res.success) {
                Alert.alert(
                  "Shift Ended",
                  `Clock out complete. Logged ${res.totalDistance?.toFixed(2) || 0} km traveled.`,
                );
                loadDashboardData();
              } else {
                Alert.alert("Error", res.error || "Failed to stop tracking session.");
              }
            },
          },
        ],
      );
    } else {
      capturePunchInSelfie();
    }
  };

  const capturePunchInSelfie = async () => {
    try {
      // 🚫 MUTUAL EXCLUSION GATE: Cannot Punch In if a Trip Plan is ACTIVE!
      const activeTrip = await storage.getItem('active_trip_planner_is_active');
      if (activeTrip === 'true') {
        Alert.alert(
          "Trip Plan Active",
          "Aapka ek Trip Plan already chal raha hai! Dono me se koi ek hi feature active ho sakta hai (Trip Plan ya Selfie Punch In).\n\nPehle active trip ko complete ya cancel karein."
        );
        return;
      }

      // Request permissions BEFORE setting uploading state so permission modals are never blocked
      const hasAllPermissions = await requestPermissions();
      if (!hasAllPermissions) {
        setIsUploadingSelfie(false);
        return;
      }

      if (Platform.OS !== 'web') {
        const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
        if (cameraStatus !== 'granted') {
          Alert.alert("Camera Permission Required", "Camera permission is required to capture your punch-in selfie.");
          setIsUploadingSelfie(false);
          return;
        }
      }

      setIsUploadingSelfie(true);

      let photoResult;
      try {
        photoResult = await ImagePicker.launchCameraAsync({
          allowsEditing: false,
          quality: 0.8,
          cameraType: ImagePicker.CameraType?.front || 'front',
        });
      } catch (camErr) {
        console.log('Front camera launch fallback:', camErr.message);
        photoResult = await ImagePicker.launchCameraAsync({
          allowsEditing: false,
          quality: 0.8,
        });
      }

      if (photoResult.canceled || !photoResult.assets?.length) {
        Alert.alert("Shift Not Started", "Selfie check-in is mandatory to punch in.");
        setIsUploadingSelfie(false);
        return;
      }

      setPendingSelfieUri(photoResult.assets[0].uri);
      setSelfieAspectMode('full');
      setSelfieModalVisible(true);
    } catch (err) {
      console.log('Selfie capture error:', err.message);
      Alert.alert("Error", "Could not complete selfie check-in. Please try again.");
    } finally {
      setIsUploadingSelfie(false);
    }
  };

  const confirmAndPunchIn = async () => {
    if (!pendingSelfieUri) return;
    try {
      setSubmittingPunchIn(true);
      // Hardened Gate: Re-verify location permissions right before uploading selfie & starting shift
      const hasAllPermissions = await requestPermissions();
      if (!hasAllPermissions) {
        setSubmittingPunchIn(false);
        return;
      }

      let uploadRes;

      if (Platform.OS === 'web') {
        let uploadBlob = null;
        try {
          const resp = await fetch(pendingSelfieUri);
          const rawBlob = await resp.blob();
          uploadBlob = await compressImageWeb(rawBlob, 800, 0.65);
        } catch (_) {}

        const formData = new FormData();
        const filename = 'selfie.jpg';
        if (uploadBlob) {
          formData.append('image', uploadBlob, filename);
        } else {
          const resp = await fetch(pendingSelfieUri);
          const rawBlob = await resp.blob();
          formData.append('image', rawBlob, filename);
        }
        uploadRes = await uploadAPI.uploadImageFormData(formData);
      } else {
        uploadRes = await uploadAPI.uploadImageFormData(pendingSelfieUri);
      }

      const selfieUrl = uploadRes.data?.url || uploadRes.data?.imageUrl || '';
      const res = await startTracking(selfieUrl);

      if (res.success) {
        setSelfieModalVisible(false);
        setPendingSelfieUri(null);
        loadDashboardData();
        router.replace("/(employee)/tracking");
      } else {
        Alert.alert("Failed to Start Shift", res.error || "Check location and camera permissions.");
      }
    } catch (err) {
      console.log('Punch in error:', err.message);
      Alert.alert("Error", "Could not submit selfie check-in. Please try again.");
    } finally {
      setSubmittingPunchIn(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f766e" translucency={false} />

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#0f766e"]} />}
      >
        {/* ── TOP HERO HEADER (DARK TEAL FOREST AESTHETIC) ── */}
        <LinearGradient
          colors={["#0d4a46", "#0f766e", "#115e59"]}
          style={styles.topMintHeader}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        >
          {/* Top Navbar Row */}
          <View style={styles.navHeaderRow}>
            <TouchableOpacity onPress={() => setShowMenu(true)} style={styles.navCircleBtn}>
              <Menu size={18} color="#ffffff" />
            </TouchableOpacity>

            <Text style={styles.appHeaderTitle}>KisanConnect</Text>

            <TouchableOpacity onPress={() => setShowNotifications(true)} style={styles.navCircleBtn}>
              <Bell size={18} color="#ffffff" />
              {unreadCount > 0 && (
                <View style={styles.badgeContainer}>
                  <Text style={styles.badgeText}>{unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Welcome Text + Profile Picture Row */}
          <View style={styles.welcomeBannerContent}>
            <View style={styles.welcomeLeftCol}>
              <Text style={styles.greetingTitle}>
                Hi, {user?.name || "Saifuddin Ansari"}
              </Text>
              <Text style={styles.dateLabelText}>{currentDate || "Wednesday, Nov 18"}</Text>

              <View style={styles.locationVerifiedPill}>
                <MapPin size={11} color="#a7f3d0" />
                <Text style={styles.locationVerifiedText}>Location verified • Shift ready</Text>
              </View>
            </View>

            {/* Profile Avatar Frame with Golden-Green Ring */}
            <TouchableOpacity 
              style={styles.userPhotoWrapper} 
              onPress={() => router.push("/(employee)/profile")} 
              activeOpacity={0.85}
            >
              {getAvatarUrl(user?.avatar) ? (
                <Image 
                  source={{ uri: getAvatarUrl(user.avatar) }} 
                  style={styles.heroEmployeeAvatar} 
                  resizeMode="cover"
                />
              ) : (
                <Image
                  source={require('../../assets/images/waving_boy.jpg')}
                  style={styles.heroEmployeeAvatar}
                  resizeMode="cover"
                />
              )}
            </TouchableOpacity>
          </View>

          {/* White Capsule Punch In Button with Cyan Arrow Circle */}
          <TouchableOpacity
            style={[
              styles.whiteCapsulePunchBtn,
              isUploadingSelfie && { opacity: 0.88 }
            ]}
            onPress={handleClockToggle}
            disabled={isUploadingSelfie}
            activeOpacity={0.88}
          >
            <View style={styles.punchLeftIconWrap}>
              {isUploadingSelfie ? (
                <ActivityIndicator size="small" color="#0f766e" />
              ) : (
                <MapPin size={16} color="#0f766e" />
              )}
            </View>

            <Text style={styles.whiteCapsulePunchText}>
              {isUploadingSelfie
                ? 'UPLOADING SELFIE...'
                : isTracking ? 'PUNCH OUT (END SHIFT)' : 'PUNCH IN (START SHIFT)'}
            </Text>

            <View style={styles.tealCircleArrowBtn}>
              <ChevronRight size={16} color="#ffffff" />
            </View>
          </TouchableOpacity>
        </LinearGradient>

        {/* ── BODY CONTENT ── */}
        <View style={styles.bodyContentPadding}>
          {/* 3. Sleek Compact KPI Stat Cards (2x2 Grid) */}
          <View style={styles.kpiGrid}>
            {/* Card 1: DISTANCE TODAY */}
            <TouchableOpacity style={styles.statCardWrap} activeOpacity={0.85} onPress={() => router.push("/tracking")}>
              <Surface style={styles.statCard} elevation={1}>
                <View style={styles.statHeaderRow}>
                  <Radio size={14} color="#0f766e" />
                  <Text style={styles.statLabelText}>DISTANCE TODAY</Text>
                </View>
                <Text style={styles.statValueText}>{stats?.distanceToday || "0.00"} km</Text>
              </Surface>
            </TouchableOpacity>

            {/* Card 2: MEETINGS */}
            <TouchableOpacity style={styles.statCardWrap} activeOpacity={0.85} onPress={() => router.push("/meetings")}>
              <Surface style={styles.statCard} elevation={1}>
                <View style={styles.statHeaderRow}>
                  <Calendar size={14} color="#0f766e" />
                  <Text style={styles.statLabelText}>MEETINGS</Text>
                </View>
                <Text style={styles.statValueText}>{stats?.meetingCount || 0}</Text>
              </Surface>
            </TouchableOpacity>

            {/* Card 3: TOTAL DISTANCE */}
            <TouchableOpacity style={styles.statCardWrap} activeOpacity={0.85} onPress={() => router.push("/tracking")}>
              <Surface style={styles.statCard} elevation={1}>
                <View style={styles.statHeaderRow}>
                  <Footprints size={14} color="#0f766e" />
                  <Text style={styles.statLabelText}>TOTAL DISTANCE</Text>
                </View>
                <Text style={styles.statValueText}>{stats?.totalDistanceAllDates || "1096.97"} km</Text>
              </Surface>
            </TouchableOpacity>

            {/* Card 4: TRAVEL PAY */}
            <TouchableOpacity style={styles.statCardWrap} activeOpacity={0.85} onPress={() => router.push("/expenses")}>
              <Surface style={styles.statCard} elevation={1}>
                <View style={styles.statHeaderRow}>
                  <Wallet size={14} color="#0f766e" />
                  <Text style={styles.statLabelText}>TRAVEL PAY</Text>
                </View>
                <Text style={styles.statValueText}>
                  ₹{((parseFloat(stats?.totalDistanceAllDates || 0)) * (parseFloat(stats?.travelRate || 2.5))).toFixed(0) || "2742"}
                </Text>
              </Surface>
            </TouchableOpacity>
          </View>

          {/* 3.5. TRIP & ROUTE PLANNER TEAL HERO CARD */}
          <TouchableOpacity
            style={styles.tripPlannerHeroCard}
            activeOpacity={0.88}
            onPress={() => router.push("/(employee)/trip-planner")}
          >
            <LinearGradient
              colors={["#0f766e", "#14b8a6"]}
              style={styles.tripPlannerGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <View style={styles.tripPlannerLeft}>
                <View style={styles.tripPlannerIconBadge}>
                  <Car size={18} color="#0f766e" />
                </View>
                <View style={styles.tripPlannerTextGroup}>
                  <Text style={styles.tripPlannerTitle}>Trip Route & KM Claim</Text>
                  <Text style={styles.tripPlannerSubtitle}>
                    Plan meeting route, preview road map & claim KM
                  </Text>
                </View>
              </View>
              <View style={styles.tripPlannerArrow}>
                <ChevronRight size={16} color="#ffffff" />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* 4. QUICK OPERATIONS (2x3 Clean Grid) */}
          <Text style={styles.sectionHeaderTitle}>Quick Operations</Text>
          <View style={styles.quickOpsGrid}>
            <TouchableOpacity style={styles.quickOpGridItem} activeOpacity={0.85} onPress={() => router.push("/(employee)/trip-planner")}>
              <View style={styles.quickOpIconCircle}>
                <Navigation size={20} color="#0f766e" />
              </View>
              <Text style={styles.quickOpGridLabel}>Plan Trip</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickOpGridItem} activeOpacity={0.85} onPress={() => router.push("/tracking")}>
              <View style={styles.quickOpIconCircle}>
                <MapPin size={20} color="#0f766e" />
              </View>
              <Text style={styles.quickOpGridLabel}>Tracking</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickOpGridItem} activeOpacity={0.85} onPress={() => router.push("/tasks")}>
              <View style={styles.quickOpIconCircle}>
                <ClipboardCheck size={20} color="#0f766e" />
              </View>
              <Text style={styles.quickOpGridLabel}>Action Plan</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickOpGridItem} activeOpacity={0.85} onPress={() => router.push("/leaves")}>
              <View style={styles.quickOpIconCircle}>
                <Calendar size={20} color="#0f766e" />
              </View>
              <Text style={styles.quickOpGridLabel}>Apply Leave</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickOpGridItem} activeOpacity={0.85} onPress={() => router.push("/meetings")}>
              <View style={styles.quickOpIconCircle}>
                <UserPlus size={20} color="#0f766e" />
              </View>
              <Text style={styles.quickOpGridLabel}>Add Meeting</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickOpGridItem} activeOpacity={0.85} onPress={() => router.push("/expenses")}>
              <View style={styles.quickOpIconCircle}>
                <Wallet size={20} color="#0f766e" />
              </View>
              <Text style={styles.quickOpGridLabel}>Add Expense</Text>
            </TouchableOpacity>
          </View>

          {/* 5. RECENT MEETINGS */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeaderTitle}>Recent Meetings</Text>
            <TouchableOpacity onPress={() => router.push("/meetings")}>
              <Text style={styles.viewAllBtnText}>View all ›</Text>
            </TouchableOpacity>
          </View>

          {recentMeetings.length === 0 ? (
            <>
              <Surface style={styles.meetingCardItem} elevation={1}>
                <View style={styles.meetingAvatarCircle}>
                  <Text style={styles.meetingAvatarInitial}>AM</Text>
                </View>
                <View style={styles.meetingDetailCol}>
                  <Text style={styles.meetingClientTitle}>Ajay Mehta</Text>
                  <Text style={styles.meetingNotesSub}>Field visit</Text>
                </View>
                <View style={[styles.meetingStatusBadge, { backgroundColor: '#f0fdf4' }]}>
                  <Text style={[styles.meetingStatusBadgeText, { color: '#16a34a' }]}>Scheduled</Text>
                </View>
              </Surface>

              <Surface style={styles.meetingCardItem} elevation={1}>
                <View style={styles.meetingAvatarCircle}>
                  <Text style={styles.meetingAvatarInitial}>BS</Text>
                </View>
                <View style={styles.meetingDetailCol}>
                  <Text style={styles.meetingClientTitle}>Beena Shah</Text>
                  <Text style={styles.meetingNotesSub}>Product demo</Text>
                </View>
                <View style={[styles.meetingStatusBadge, { backgroundColor: '#f0fdf4' }]}>
                  <Text style={[styles.meetingStatusBadgeText, { color: '#16a34a' }]}>Scheduled</Text>
                </View>
              </Surface>

              <Surface style={styles.meetingCardItem} elevation={1}>
                <View style={styles.meetingAvatarCircle}>
                  <Text style={styles.meetingAvatarInitial}>CP</Text>
                </View>
                <View style={styles.meetingDetailCol}>
                  <Text style={styles.meetingClientTitle}>Chirag Patel</Text>
                  <Text style={styles.meetingNotesSub}>Relationship review</Text>
                </View>
                <View style={[styles.meetingStatusBadge, { backgroundColor: '#f0fdf4' }]}>
                  <Text style={[styles.meetingStatusBadgeText, { color: '#16a34a' }]}>Completed</Text>
                </View>
              </Surface>
            </>
          ) : (
            recentMeetings.slice(0, 3).map((meeting) => (
              <Surface key={meeting._id || meeting.id} style={styles.meetingCardItem} elevation={1}>
                <View style={styles.meetingAvatarCircle}>
                  <Text style={styles.meetingAvatarInitial}>
                    {(meeting.clientName || "T").substring(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.meetingDetailCol}>
                  <Text style={styles.meetingClientTitle}>{meeting.clientName}</Text>
                  <Text style={styles.meetingNotesSub} numberOfLines={1}>
                    {meeting.meetingNotes || "Client visit"}
                  </Text>
                </View>
                <View style={[styles.meetingStatusBadge, { backgroundColor: '#f0fdf4' }]}>
                  <Text style={[styles.meetingStatusBadgeText, { color: '#16a34a' }]}>
                    {meeting.status ? meeting.status.charAt(0).toUpperCase() + meeting.status.slice(1).toLowerCase() : "Scheduled"}
                  </Text>
                </View>
              </Surface>
            ))
          )}

          {/* 6. RECENT EXPENSES */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeaderTitle}>Recent Expenses</Text>
            <TouchableOpacity onPress={() => router.push("/expenses")}>
              <Text style={styles.viewAllBtnText}>View all ›</Text>
            </TouchableOpacity>
          </View>

          {recentExpenses.length === 0 ? (
            <>
              <Surface style={styles.meetingCardItem} elevation={1}>
                <View style={[styles.meetingAvatarCircle, { backgroundColor: '#f0fdfa' }]}>
                  <Car size={16} color="#0f766e" />
                </View>
                <View style={styles.meetingDetailCol}>
                  <Text style={styles.meetingClientTitle}>Fuel • ₹65</Text>
                </View>
                <View style={[styles.meetingStatusBadge, { backgroundColor: '#f0fdf4' }]}>
                  <Text style={[styles.meetingStatusBadgeText, { color: '#16a34a' }]}>Approved</Text>
                </View>
              </Surface>

              <Surface style={styles.meetingCardItem} elevation={1}>
                <View style={[styles.meetingAvatarCircle, { backgroundColor: '#f0fdfa' }]}>
                  <Car size={16} color="#0f766e" />
                </View>
                <View style={styles.meetingDetailCol}>
                  <Text style={styles.meetingClientTitle}>Fuel • ₹68</Text>
                </View>
                <View style={[styles.meetingStatusBadge, { backgroundColor: '#fffbeb' }]}>
                  <Text style={[styles.meetingStatusBadgeText, { color: '#d97706' }]}>Pending</Text>
                </View>
              </Surface>

              <Surface style={styles.meetingCardItem} elevation={1}>
                <View style={[styles.meetingAvatarCircle, { backgroundColor: '#f0fdfa' }]}>
                  <Wallet size={16} color="#0f766e" />
                </View>
                <View style={styles.meetingDetailCol}>
                  <Text style={styles.meetingClientTitle}>Meal • ₹120</Text>
                </View>
                <View style={[styles.meetingStatusBadge, { backgroundColor: '#f0fdf4' }]}>
                  <Text style={[styles.meetingStatusBadgeText, { color: '#16a34a' }]}>Approved</Text>
                </View>
              </Surface>
            </>
          ) : (
            recentExpenses.slice(0, 3).map((expense) => {
              const badge = getExpenseStatusStyle(expense.status);
              const cat = expense.category ? expense.category.toUpperCase() : "FIELD EXPENSE";
              return (
                <Surface key={expense._id || expense.id} style={styles.meetingCardItem} elevation={1}>
                  <View style={styles.meetingAvatarCircle}>
                    <Text style={styles.meetingAvatarInitial}>{cat.charAt(0)}</Text>
                  </View>
                  <View style={styles.meetingDetailCol}>
                    <Text style={styles.meetingClientTitle}>
                      {cat === "FOOD" ? "MEALS" : cat} — ₹{expense.amount}
                    </Text>
                    <Text style={styles.meetingNotesSub} numberOfLines={1}>
                      {new Date(expense.date || expense.createdAt).toLocaleDateString("en-GB")} • {expense.description || ""}
                    </Text>
                  </View>
                  <View style={[styles.meetingStatusBadge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.meetingStatusBadgeText, { color: badge.text }]}>{badge.label}</Text>
                  </View>
                </Surface>
              );
            })
          )}

        </View>
      </ScrollView>

      {/* Slide sidebar navigation Drawer Modal */}
      <Modal
        visible={showMenu}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMenu(false)}
      >
        <View style={styles.menuOverlay}>
          {/* Transparent left part to tap and close */}
          <TouchableOpacity
            style={styles.menuDismissArea}
            activeOpacity={1}
            onPress={() => setShowMenu(false)}
          />

          <Surface style={styles.menuPanel} elevation={5}>
            <LinearGradient
              colors={["#0a3d3c", "#002626"]}
              style={styles.menuGradient}
            >
              {/* Menu Header */}
              <View style={styles.menuHeader}>
                <View style={styles.menuUserPill}>
                  <View style={[styles.menuUserAvatar, { overflow: "hidden" }]}>
                    {getAvatarUrl(user?.avatar) ? (
                      <Image source={{ uri: getAvatarUrl(user.avatar) }} style={{ width: "100%", height: "100%" }} />
                    ) : (
                      <Text style={styles.menuAvatarTextInside}>
                        {user?.name?.charAt(0).toUpperCase() || "S"}
                      </Text>
                    )}
                  </View>
                  <View style={styles.menuUserInfo}>
                    <Text style={styles.menuUserName} numberOfLines={1}>{user?.name || "Employee"}</Text>
                    <Text style={styles.menuUserRole}>{user?.role?.toUpperCase() || "EMPLOYEE"}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setShowMenu(false)} style={styles.menuCloseBtn}>
                  <X size={20} color="#94a3b8" />
                </TouchableOpacity>
              </View>

              {/* Menu Items List */}
              <ScrollView style={styles.menuItemsScroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.menuSectionTitle}>NAVIGATION</Text>

                {[
                  { label: "Dashboard", route: "/dashboard", icon: "Home", desc: "Main control center" },
                  { label: "Live GPS Tracking", route: "/tracking", icon: "Navigation", desc: "Realtime speed & distance" },
                  { label: "Trip & Route Planner", route: "/(employee)/trip-planner", icon: "Car", desc: "Plan meeting route & claim KM" },
                  { label: "Daily Action Plan", route: "/tasks", icon: "ClipboardCheck", desc: "View & add daily actions" },
                  { label: "Leads", route: "/leads", icon: "Users", desc: "View assigned leads" },
                  { label: "Client Meetings", route: "/meetings", icon: "Calendar", desc: "Log feedback & visit details" },
                  { label: "Expenses & Claims", route: "/expenses", icon: "Wallet", desc: "Submit logs & receipt uploads" },
                  { label: "Leaves & Attendance", route: "/leaves", icon: "ClipboardCheck", desc: "Request leave sessions" },
                  { label: "My Profile", route: "/(employee)/profile", icon: "UserCircle", desc: "Account details" },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.label}
                    style={styles.menuItemBtn}
                    onPress={() => {
                      setShowMenu(false);
                      router.push(item.route);
                    }}
                  >
                    <View style={styles.menuItemIconBox}>
                      {item.icon === "Home" && <Home size={18} color="#fff" />}
                      {item.icon === "Car" && <Car size={18} color="#fff" />}
                      {item.icon === "ClipboardCheck" && <ClipboardCheck size={18} color="#fff" />}
                      {item.icon === "Navigation" && <Navigation size={18} color="#fff" />}
                      {item.icon === "Users" && <Users size={18} color="#fff" />}
                      {item.icon === "Wallet" && <Wallet size={18} color="#fff" />}
                      {item.icon === "Calendar" && <Calendar size={18} color="#fff" />}
                      {item.icon === "UserCircle" && <UserPlus size={18} color="#fff" />}
                    </View>
                    <View style={styles.menuItemTextContainer}>
                      <Text style={styles.menuItemLabel}>{item.label}</Text>
                      <Text style={styles.menuItemSub}>{item.desc}</Text>
                    </View>
                    <ChevronRight size={14} color="#52525b" />
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.menuFooter}>
                <Text style={styles.menuFooterText}>FieldTrack Pro • v1.4.2</Text>
              </View>
            </LinearGradient>
          </Surface>
        </View>
      </Modal>

      {/* Notifications Modal */}
      <Modal visible={showNotifications} transparent animationType="fade" onRequestClose={() => setShowNotifications(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalDismissArea} activeOpacity={1} onPress={() => setShowNotifications(false)} />
          <Surface style={styles.notificationModalPanel} elevation={5}>
            <View style={styles.notifHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Bell size={20} color="#008080" />
                <Text style={styles.notifHeaderTitle}>Notifications</Text>
                {unreadCount > 0 && (
                  <View style={styles.notifCountBadge}>
                    <Text style={styles.notifCountText}>{unreadCount}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={() => setShowNotifications(false)} style={styles.closeNotifIconBtn}>
                <X size={18} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 16 }}>
              {notificationItems.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 30 }}>
                  <Bell size={32} color="#94a3b8" />
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#0f172a', marginTop: 10 }}>All caught up!</Text>
                </View>
              ) : (
                notificationItems.map((item) => (
                  <TouchableOpacity key={item.id} style={styles.notifItemCard} onPress={() => setShowNotifications(false)}>
                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#0f172a' }}>{item.title}</Text>
                    <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{item.description}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </Surface>
        </View>
      </Modal>

      {/* Selfie Custom Resize & Punch In Preview Modal */}
      <Modal visible={selfieModalVisible} transparent animationType="slide" onRequestClose={() => setSelfieModalVisible(false)}>
        <View style={styles.selfieModalOverlay}>
          <Surface style={styles.selfieModalContent} elevation={5}>
            <View style={styles.selfieModalHeader}>
              <View>
                <Text style={styles.selfieModalTitle}>Selfie Check-In Verification</Text>
                <Text style={styles.selfieModalSub}>Select photo frame size (Full / Half)</Text>
              </View>
              <TouchableOpacity onPress={() => setSelfieModalVisible(false)} style={styles.closeSelfieModalBtn}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Frame Size Selector Toggle */}
            <View style={styles.aspectToggleRow}>
              <TouchableOpacity
                style={[styles.aspectOptionBtn, selfieAspectMode === 'full' && styles.aspectOptionBtnActive]}
                onPress={() => setSelfieAspectMode('full')}
                activeOpacity={0.8}
              >
                <Text style={[styles.aspectOptionText, selfieAspectMode === 'full' && styles.aspectOptionTextActive]}>
                  Full Photo (3:4)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.aspectOptionBtn, selfieAspectMode === 'half' && styles.aspectOptionBtnActive]}
                onPress={() => setSelfieAspectMode('half')}
                activeOpacity={0.8}
              >
                <Text style={[styles.aspectOptionText, selfieAspectMode === 'half' && styles.aspectOptionTextActive]}>
                  Half Photo (1:1)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Live Selfie Image Preview Box */}
            <View style={[styles.selfiePreviewFrame, { height: selfieAspectMode === 'full' ? 190 : 140 }]}>
              {pendingSelfieUri ? (
                <Image source={{ uri: pendingSelfieUri }} style={styles.selfiePreviewImg} resizeMode="contain" />
              ) : null}
            </View>

            {/* Modal Actions */}
            <View style={styles.selfieModalActionRow}>
              <TouchableOpacity
                style={styles.retakeSelfieBtn}
                onPress={() => {
                  setSelfieModalVisible(false);
                  capturePunchInSelfie();
                }}
                disabled={submittingPunchIn}
                activeOpacity={0.8}
              >
                <Text style={styles.retakeSelfieText}>Retake Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmPunchInBtn}
                onPress={confirmAndPunchIn}
                disabled={submittingPunchIn}
                activeOpacity={0.85}
              >
                {submittingPunchIn ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmPunchInText}>Confirm & Punch In</Text>
                )}
              </TouchableOpacity>
            </View>
          </Surface>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f8f8",
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 140, // Increased to account for floating bottom nav
  },
  uploadOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadLoaderCard: {
    width: width * 0.8,
    maxWidth: 320,
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  uploadLoaderTitle: {
    marginTop: 14,
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  uploadLoaderText: {
    marginTop: 8,
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
  topMintHeader: {
    paddingTop: Platform.OS === "ios" ? 44 : 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    zIndex: 1,
  },
  navHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    marginTop: 4,
  },
  appHeaderTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: -0.3,
  },
  navCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  welcomeBannerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    marginTop: 2,
  },
  welcomeLeftCol: {
    flex: 1,
    paddingRight: 16,
    justifyContent: "center",
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  dateLabelText: {
    fontSize: 12.5,
    fontWeight: "400",
    color: "rgba(255, 255, 255, 0.85)",
    marginTop: 4,
    marginBottom: 10,
  },
  locationVerifiedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 18,
    alignSelf: "flex-start",
  },
  locationVerifiedText: {
    color: "#a7f3d0",
    fontSize: 11,
    fontWeight: "500",
  },
  userPhotoWrapper: {
    width: 98,
    height: 98,
    borderRadius: 49,
    padding: 3,
    backgroundColor: "rgba(255, 255, 255, 0.28)",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  heroEmployeeAvatar: {
    width: "100%",
    height: "100%",
    borderRadius: 46,
    backgroundColor: "#ffffff",
  },
  whiteCapsulePunchBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    paddingVertical: 7,
    paddingLeft: 12,
    paddingRight: 6,
    borderRadius: 28,
    width: "100%",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  punchLeftIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#f0fdfa",
    justifyContent: "center",
    alignItems: "center",
  },
  whiteCapsulePunchText: {
    color: "#0f766e",
    fontSize: 11.5,
    fontWeight: "700",
    letterSpacing: 0.4,
    flex: 1,
    textAlign: "center",
  },
  tealCircleArrowBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#0f766e",
    justifyContent: "center",
    alignItems: "center",
  },
  bodyContentPadding: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 80,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  statCardWrap: {
    width: "48%",
    marginBottom: 8,
  },
  statCard: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  statHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  statLabelText: {
    fontSize: 9.5,
    fontWeight: "500",
    color: "#64748b",
    letterSpacing: 0.2,
  },
  statValueText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  tripPlannerHeroCard: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 18,
    elevation: 2,
    shadowColor: "#0f766e",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  tripPlannerGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  tripPlannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
  },
  tripPlannerIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  tripPlannerTextGroup: {
    flex: 1,
  },
  tripPlannerTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: 0.1,
  },
  tripPlannerSubtitle: {
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.85)",
    marginTop: 1,
  },
  tripPlannerArrow: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  sectionHeaderTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 12,
  },
  quickOpsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 10,
  },
  quickOpGridItem: {
    width: "48%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  quickOpIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f0fdfa",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  quickOpGridLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#0f172a",
    textAlign: "center",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  viewAllBtnText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#0f766e",
  },
  meetingCardItem: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  meetingAvatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#f0fdfa",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  meetingAvatarInitial: {
    color: "#0f766e",
    fontWeight: "600",
    fontSize: 12,
  },
  meetingDetailCol: {
    flex: 1,
  },
  meetingClientTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  meetingNotesSub: {
    fontSize: 11,
    fontWeight: "400",
    color: "#64748b",
    marginTop: 1,
  },
  meetingStatusBadge: {
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  meetingStatusBadgeText: {
    fontSize: 10,
    fontWeight: "500",
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    flexDirection: "row",
  },
  menuDismissArea: {
    flex: 1,
  },
  menuPanel: {
    width: width * 0.82,
    height: "100%",
    backgroundColor: "#18181b",
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  menuGradient: {
    flex: 1,
    paddingTop: Platform.OS === "ios" ? 54 : 44,
  },
  menuHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  menuUserPill: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
  menuUserAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#00b4d8",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  menuAvatarTextInside: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  menuUserInfo: {
    flex: 1,
  },
  menuUserName: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "bold",
  },
  menuUserRole: {
    color: "#64748b",
    fontSize: 9,
    fontWeight: "bold",
    marginTop: 2,
  },
  menuCloseBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: "#1e293b",
  },
  menuItemsScroll: {
    flex: 1,
    paddingTop: 20,
    paddingHorizontal: 16,
  },
  menuSectionTitle: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#475569",
    letterSpacing: 1.2,
    marginBottom: 12,
    paddingLeft: 4,
  },
  menuItemBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  menuItemIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(0, 180, 216, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  menuItemTextContainer: {
    flex: 1,
  },
  menuItemLabel: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "bold",
  },
  menuItemSub: {
    color: "#64748b",
    fontSize: 9,
    marginTop: 1,
  },
  menuFooter: {
    padding: 20,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
  },
  menuFooterText: {
    color: "#475569",
    fontSize: 9,
    fontWeight: "bold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalDismissArea: {
    ...StyleSheet.absoluteFillObject,
  },
  notificationModalPanel: {
    width: width * 0.9,
    maxHeight: "75%",
    backgroundColor: "#ffffff",
    borderRadius: 20,
    overflow: "hidden",
  },
  notifHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  notifHeaderTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  notifCountBadge: {
    backgroundColor: "#ef4444",
    borderRadius: 9,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  notifCountText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  closeNotifIconBtn: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: "#f1f5f9",
  },
  notifItemCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  orgBadgePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  orgBadgeText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  // Selfie Custom Resize Modal Styles
  selfieModalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.65)', justifyContent: 'flex-end' },
  selfieModalContent: { backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 20, paddingBottom: Platform.OS === 'ios' ? 44 : 36 },
  selfieModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  selfieModalTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  selfieModalSub: { fontSize: 11, color: '#64748b', marginTop: 2 },
  closeSelfieModalBtn: { padding: 4, borderRadius: 20, backgroundColor: '#f1f5f9' },
  aspectToggleRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  aspectOptionBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', alignItems: 'center' },
  aspectOptionBtnActive: { backgroundColor: '#059669', borderColor: '#059669' },
  aspectOptionText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  aspectOptionTextActive: { color: '#ffffff' },
  selfiePreviewFrame: { width: '100%', borderRadius: 16, overflow: 'hidden', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', marginBottom: 16, justifyContent: 'center', alignItems: 'center' },
  selfiePreviewImg: { width: '100%', height: '100%', resizeMode: 'contain' },
  selfieModalActionRow: { flexDirection: 'row', gap: 10, marginTop: 4, marginBottom: Platform.OS === 'ios' ? 28 : 22 },
  retakeSelfieBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' },
  retakeSelfieText: { fontSize: 13, fontWeight: '800', color: '#475569' },
  confirmPunchInBtn: { flex: 1.4, paddingVertical: 14, borderRadius: 14, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center' },
  confirmPunchInText: { fontSize: 13, fontWeight: '800', color: '#ffffff' },
});