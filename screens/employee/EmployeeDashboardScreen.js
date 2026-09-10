import React, { useState, useEffect } from "react";
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
  Linking
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
} from "lucide-react-native";
import useLocationTracker from "../../hooks/useLocationTracker";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../context/AuthContext";
import { dashboardApi, meetingApi, expenseApi, taskApi, leadAPI, uploadAPI, getAvatarUrl } from "../../services/api";

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
  const { isTracking, startTracking, stopTracking } = useLocationTracker();
  const [currentDate, setCurrentDate] = useState("");
  const [showMenu, setShowMenu] = useState(false);

  const [notificationItems, setNotificationItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(4);
  const [showNotifications, setShowNotifications] = useState(false);

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
      const items = [];
      const tasksRes = await taskApi.getMy();
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
      const leadsRes = await leadAPI.getAll();
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
  }, []);

  const loadDashboardData = async () => {
    try {
      const statsRes = await dashboardApi.getStats();
      if (statsRes.data && statsRes.data.success) {
        setStats(statsRes.data.stats);
      }
      const meetingsRes = await meetingApi.getMy();
      if (meetingsRes.data && meetingsRes.data.success) {
        setRecentMeetings(meetingsRes.data.meetings || []);
      }
      const expensesRes = await expenseApi.getMy();
      if (expensesRes.data && expensesRes.data.success) {
        setRecentExpenses(expensesRes.data.expenses || []);
      }
    } catch (err) {}
  };

  useEffect(() => {
    loadDashboardData();
    fetchNotifications();
  }, [isTracking]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    await fetchNotifications();
    setRefreshing(false);
  };

  const handleClockToggle = async () => {
    if (isTracking) {
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
      try {
        setIsUploadingSelfie(true);

        // 1. Prompt mandatory selfie check-in
        const cameraPerm = await ImagePicker.requestCameraPermissionsAsync();
        if (!cameraPerm.granted) {
          Alert.alert(
            "Camera Permission Required",
            "Camera access is mandatory to take a selfie check-in before starting your shift.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Open Settings", onPress: () => Linking.openSettings() }
            ]
          );
          setIsUploadingSelfie(false);
          return;
        }

        const photoResult = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.6,
          cameraType: ImagePicker.CameraType?.front || 'front',
        });

        if (photoResult.canceled || !photoResult.assets?.length) {
          Alert.alert("Shift Not Started", "Selfie check-in is mandatory to punch in.");
          setIsUploadingSelfie(false);
          return;
        }

        const selfieAsset = photoResult.assets[0];
        let uploadRes;

        if (Platform.OS === 'web') {
          const formData = new FormData();
          const filename = selfieAsset.uri.split('/').pop() || 'selfie.jpg';
          const resp = await fetch(selfieAsset.uri);
          const blob = await resp.blob();
          formData.append('image', blob, filename);
          uploadRes = await uploadAPI.uploadImageFormData(formData);
        } else {
          // Native Platforms (iOS/Android): pass URI directly to let api.js handle FileSystem.uploadAsync
          uploadRes = await uploadAPI.uploadImageFormData(selfieAsset.uri);
        }

        const selfieUrl = uploadRes.data?.url || '';

        // 2. Start tracking session with uploaded selfie
        const res = await startTracking(selfieUrl);
        if (res.success) {
          loadDashboardData();
          router.replace("/(employee)/tracking");
        } else {
          Alert.alert("Failed to Start Shift", res.error || "Check location and camera permissions.");
        }
      } catch (err) {
        console.log('Selfie capture error:', err.message);
        Alert.alert("Error", "Could not complete selfie check-in. Please try again.");
      } finally {
        setIsUploadingSelfie(false);
      }
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#d5f5ee" translucency={false} />

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#00c6a9"]} />}
      >
        {/* ── UNIFIED DARK EMERALD TEAL TOP HEADER ── */}
        <LinearGradient
          colors={isTracking ? ["#66bac0", "#4adfd2"] : ["#168178", "#65b9b9"]}
          style={styles.topMintHeader}
        >
          {/* Top Navbar Row */}
          <View style={styles.navHeaderRow}>
            <TouchableOpacity onPress={() => setShowMenu(true)} style={styles.navCircleBtn}>
              <Menu size={18} color="#ffffff" />
            </TouchableOpacity>

            <View style={styles.navRightGroup}>
              <TouchableOpacity onPress={() => setShowNotifications(true)} style={styles.navCircleBtn}>
                <Bell size={18} color="#ffffff" />
                {unreadCount > 0 && (
                  <View style={styles.badgeContainer}>
                    <Text style={styles.badgeText}>{unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => router.push("/(employee)/profile")} style={styles.userAvatarContainer}>
                {getAvatarUrl(user?.avatar) ? (
                  <Image source={{ uri: getAvatarUrl(user.avatar) }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarInitial}>
                    {user?.name?.charAt(0).toUpperCase() || "S"}
                  </Text>
                )}
                <View style={styles.onlineDot} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Welcome Text + Dynamic Waving / Rider Boy Row */}
          <View style={styles.welcomeBannerContent}>
            <View style={styles.welcomeLeftCol}>
              <Text style={styles.dateLabelText}>{currentDate || "SUNDAY, SEP 6"}</Text>
              <Text style={styles.greetingTitle}>
                Hi, {(user?.name || "Kisan Team").trim().split(/\s+/)[0].toUpperCase()}
              </Text>
              {(user?.name || "Kisan Team").trim().split(/\s+/).slice(1).length > 0 && (
                <Text style={styles.greetingSurname}>
                  {(user?.name || "Kisan Team").trim().split(/\s+/).slice(1).join(" ").toUpperCase()}
                </Text>
              )}

              <View style={[styles.roleBadgeBox, isTracking && { backgroundColor: "#065f46" }]}>
                <Text style={[styles.roleBadgeText, isTracking && { color: "#a7f3d0" }]}>
                  {isTracking ? "ON SHIFT • RIDER MODE 🏍️" : user?.role?.toUpperCase() || "EMPLOYEE"}
                </Text>
              </View>
            </View>

            {/* Dynamic Image: Waving Boy when OFF, 3D Biker Scooter Boy when ON */}
            <Image
              source={
                isTracking
                  ? require('../../assets/images/biker_boy.png')
                  : require('../../assets/images/waving_boy.jpg')
              }
              style={isTracking ? styles.bikerBoyImgTop : styles.wavingBoyImgTop}
              resizeMode="contain"
            />
          </View>

          {/* Full Width Punch-In Pill Button with Glassmorphic pill look */}
          <TouchableOpacity
            style={[
              styles.punchPillBtnFull,
              isTracking
                ? { backgroundColor: "rgba(241, 11, 11, 0.95)", borderColor: "#fca5a5" }
                : { backgroundColor: "rgba(34, 123, 238, 0.95)", borderColor: "#5eea8d" },
              isUploadingSelfie && { opacity: 0.88 }
            ]}
            onPress={handleClockToggle}
            disabled={isUploadingSelfie}
          >
            <View style={[styles.punchLeftIconWrap, isTracking && { backgroundColor: "rgba(255,255,255,0.3)" }]}>
              {isUploadingSelfie ? <ActivityIndicator size="small" color="#fff" /> : <Radio size={16} color="#fff" />}
            </View>

            <Text style={styles.punchPillBtnTextFull}>
              {isUploadingSelfie
                ? 'UPLOADING SELFIE...'
                : isTracking ? 'PUNCH-OUT (END SHIFT)' : 'PUNCH-IN (START SHIFT)'}
            </Text>

            <View style={styles.circleArrowBtn}>
              {isUploadingSelfie ? (
                <ActivityIndicator size="small" color={isTracking ? '#dc2626' : '#0d4d49'} />
              ) : (
                <ChevronRight size={16} color={isTracking ? '#dc2626' : '#0d4d49'} />
              )}
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
                  <View style={[styles.statIconCircle, { backgroundColor: '#e0f7fa' }]}>
                    <MapPin size={15} color="#00b4d8" />
                  </View>
                  <TrendingUp size={14} color="#00c6a9" />
                </View>
                <Text style={styles.statLabelText}>DISTANCE</Text>
                <Text style={styles.statValueText}>{stats?.distanceToday || "0.00"} km</Text>
              </Surface>
            </TouchableOpacity>

            {/* Card 2: MEETINGS */}
            <TouchableOpacity style={styles.statCardWrap} activeOpacity={0.85} onPress={() => router.push("/meetings")}>
              <Surface style={styles.statCard} elevation={1}>
                <View style={styles.statHeaderRow}>
                  <View style={[styles.statIconCircle, { backgroundColor: '#f3e8ff' }]}>
                    <Users size={15} color="#a855f7" />
                  </View>
                  <TrendingUp size={14} color="#a855f7" />
                </View>
                <Text style={styles.statLabelText}>MEETINGS</Text>
                <Text style={styles.statValueText}>{stats?.meetingCount || 0}</Text>
              </Surface>
            </TouchableOpacity>

            {/* Card 3: TOTAL DISTANCE */}
            <TouchableOpacity style={styles.statCardWrap} activeOpacity={0.85} onPress={() => router.push("/tracking")}>
              <Surface style={styles.statCard} elevation={1}>
                <View style={styles.statHeaderRow}>
                  <View style={[styles.statIconCircle, { backgroundColor: '#e0f2fe' }]}>
                    <Footprints size={15} color="#2563eb" />
                  </View>
                  <TrendingUp size={14} color="#2563eb" />
                </View>
                <Text style={styles.statLabelText}>TOTAL DISTANCE</Text>
                <Text style={styles.statValueText}>{stats?.totalDistanceAllDates || "0.00"} km</Text>
              </Surface>
            </TouchableOpacity>

            {/* Card 4: TRAVEL RATE */}
            <TouchableOpacity style={styles.statCardWrap} activeOpacity={0.85} onPress={() => router.push("/expenses")}>
              <Surface style={styles.statCard} elevation={1}>
                <View style={styles.statHeaderRow}>
                  <View style={[styles.statIconCircle, { backgroundColor: '#fef3c7' }]}>
                    <Wallet size={15} color="#f59e0b" />
                  </View>
                  <TrendingUp size={14} color="#f59e0b" />
                </View>
                <Text style={styles.statLabelText}>TRAVEL RATE</Text>
                <Text style={styles.statValueText}>₹{stats?.travelRate || 0}/km</Text>
              </Surface>
            </TouchableOpacity>
          </View>

          {/* 4. QUICK OPERATIONS */}
          <Text style={styles.sectionHeaderTitle}>QUICK OPERATIONS</Text>
          <View style={styles.quickOpsRow}>
            <TouchableOpacity style={styles.quickOpBtnItem} activeOpacity={0.88} onPress={() => router.push("/tracking")}>
              <LinearGradient colors={["#00c6a9", "#00b4d8"]} style={styles.quickOpGradientIcon}>
                <Play size={22} color="#fff" />
              </LinearGradient>
              <Text style={styles.quickOpLabelText}>TRACKING</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickOpBtnItem} activeOpacity={0.88} onPress={() => router.push("/tasks")}>
              <LinearGradient colors={["#3b82f6", "#1d4ed8"]} style={styles.quickOpGradientIcon}>
                <ClipboardCheck size={22} color="#fff" />
              </LinearGradient>
              <Text style={styles.quickOpLabelText}>ACTION PLAN</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickOpBtnItem} activeOpacity={0.88} onPress={() => router.push("/leaves")}>
              <LinearGradient colors={["#10b981", "#059669"]} style={styles.quickOpGradientIcon}>
                <Calendar size={22} color="#fff" />
              </LinearGradient>
              <Text style={styles.quickOpLabelText}>APPLY LEAVE</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickOpBtnItem} activeOpacity={0.88} onPress={() => router.push("/meetings")}>
              <LinearGradient colors={["#a855f7", "#7c3aed"]} style={styles.quickOpGradientIcon}>
                <UserPlus size={22} color="#fff" />
              </LinearGradient>
              <Text style={styles.quickOpLabelText}>ADD MEETING</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickOpBtnItem} activeOpacity={0.88} onPress={() => router.push("/expenses")}>
              <LinearGradient colors={["#f97316", "#ea580c"]} style={styles.quickOpGradientIcon}>
                <Wallet size={22} color="#fff" />
              </LinearGradient>
              <Text style={styles.quickOpLabelText}>ADD EXPENSE</Text>
            </TouchableOpacity>
          </View>

          {/* 5. RECENT MEETINGS */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeaderTitle}>RECENT MEETINGS</Text>
            <TouchableOpacity onPress={() => router.push("/meetings")}>
              <Text style={styles.viewAllBtnText}>View All ›</Text>
            </TouchableOpacity>
          </View>

          {recentMeetings.length === 0 ? (
            <Surface style={styles.emptyMeetingCard} elevation={1}>
              <View style={styles.meetingAvatarCircle}>
                <Text style={styles.meetingAvatarInitial}>T</Text>
              </View>
              <View style={styles.meetingDetailCol}>
                <Text style={styles.meetingClientTitle}>Test</Text>
                <Text style={styles.meetingNotesSub}>Sjsbhsjs...</Text>
              </View>
              <View style={styles.meetingStatusBadge}>
                <Text style={styles.meetingStatusBadgeText}>SCHEDULED</Text>
              </View>
            </Surface>
          ) : (
            recentMeetings.slice(0, 3).map((meeting) => (
              <Surface key={meeting._id || meeting.id} style={styles.meetingCardItem} elevation={1}>
                <View style={styles.meetingAvatarCircle}>
                  <Text style={styles.meetingAvatarInitial}>
                    {meeting.clientName?.charAt(0).toUpperCase() || "T"}
                  </Text>
                </View>
                <View style={styles.meetingDetailCol}>
                  <Text style={styles.meetingClientTitle}>{meeting.clientName}</Text>
                  <Text style={styles.meetingNotesSub} numberOfLines={1}>
                    {meeting.meetingNotes || "Sjsbhsjs..."}
                  </Text>
                </View>
                <View style={styles.meetingStatusBadge}>
                  <Text style={styles.meetingStatusBadgeText}>
                    {(meeting.status || "SCHEDULED").toUpperCase()}
                  </Text>
                </View>
              </Surface>
            ))
          )}

          {/* 6. RECENT EXPENSES */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeaderTitle}>RECENT EXPENSES</Text>
            <TouchableOpacity onPress={() => router.push("/expenses")}>
              <Text style={styles.viewAllBtnText}>View All ›</Text>
            </TouchableOpacity>
          </View>

          {recentExpenses.length === 0 ? (
            <Surface style={styles.emptyMeetingCard} elevation={1}>
              <View style={styles.meetingAvatarCircle}>
                <Wallet size={16} color="#0284c7" />
              </View>
              <View style={styles.meetingDetailCol}>
                <Text style={styles.meetingClientTitle}>No expenses yet</Text>
                <Text style={styles.meetingNotesSub}>Tap ADD EXPENSE to log a claim.</Text>
              </View>
            </Surface>
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

      <Modal visible={isUploadingSelfie} transparent animationType="fade" onRequestClose={() => null}>
        <View style={styles.uploadOverlay}>
          <View style={styles.uploadLoaderCard}>
            <ActivityIndicator size="large" color="#0a3d3c" />
            <Text style={styles.uploadLoaderTitle}>Uploading selfie</Text>
            <Text style={styles.uploadLoaderText}>Please wait while your punch-in image is being uploaded.</Text>
          </View>
        </View>
      </Modal>

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
    paddingTop: Platform.OS === "ios" ? 44 : 24,
    paddingHorizontal: 20,
    paddingBottom: 55,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    zIndex: 1,
  },
  navHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 28,

  },
  navCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    marginTop: 12,
  },
  navRightGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  badgeContainer: {
    position: "absolute",
    top: -5,
    right: -2,
    backgroundColor: "#ef4444",
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  badgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
  },
  userAvatarContainer: {
    width: 38,
    height: 40,
    borderRadius: 19,
    backgroundColor: "#ffffff",
    elevation: 2,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    marginTop: 10,
  },
  avatarImg: {
    width: 38,
    height: 40,
    borderRadius: 19,
  },
  avatarInitial: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "700",
  },
  onlineDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: "#10b981",
    position: "absolute",
    top: 0,
    right: 0,
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  welcomeBannerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    position: "relative",
    marginBottom: 24,
    paddingTop: 20,
  },
  welcomeLeftCol: {
    flex: 1,
  },
  dateLabelText: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: 0.8,
  },
  greetingTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#ffffff",
    marginTop: 6,
    letterSpacing: 0.3,
  },
  greetingSurname: {
    fontSize: 19,
    fontWeight: "600",
    color: "#ffffff",
    marginTop: 1,
    marginLeft: 35,
    letterSpacing: 0.2,
  },
  roleBadgeBox: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: "flex-start",
    marginTop: 6,
  },
  roleBadgeText: {
    color: "#5eead4",
    fontSize: 9.5,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  wavingBoyImgTop: {
    width: 195,
    height: 200,
    position: "absolute",
    right: -20,
    top: -1,
    paddingTop: 15,
  },
  bikerBoyImgTop: {
    width: 195,
    height: 200,
    position: "absolute",
    right: -20,
    top: -10,
  },
  punchPillBtnFull: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 6,
    borderRadius: 28,
    width: "100%",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.35)",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 2.15,
    shadowRadius: 8,
    zIndex: 2,
    marginTop: 45,
  },
  punchLeftIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  punchPillBtnTextFull: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
    flex: 1,
    textAlign: "center",
  },
  circleArrowBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
  },
  bodyContentPadding: {
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  statCardWrap: {
    width: "48%",
    marginBottom: 12,
  },
  statCard: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  statHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  statIconCircle: {
    width: 25,
    height: 25,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  statLabelText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748b",
    letterSpacing: 0.3,
  },
  statValueText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
    marginTop: 4,
  },
  sectionHeaderTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a",
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  quickOpsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 10,
  },
  quickOpBtnItem: {
    width: "45%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 0,
  },
  quickOpGradientIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
    elevation: 3,
    shadowColor: "#0f172a",
    shadowOpacity: 0.14,
    shadowRadius: 14,
  },
  quickOpLabelText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#334155",
    textAlign: "center",
    letterSpacing: 0.4,
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  viewAllBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#00b4d8",
  },
  emptyMeetingCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  emptyTextMsg: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a",
  },
  emptyTextSub: {
    fontSize: 10,
    fontWeight: "400",
    color: "#64748b",
    marginTop: 1,
  },
  meetingCardItem: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 12,
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
    backgroundColor: "#e0f2fe",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  meetingAvatarInitial: {
    color: "#0284c7",
    fontWeight: "700",
    fontSize: 13,
  },
  meetingDetailCol: {
    flex: 1,
  },
  meetingClientTitle: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#0f172a",
  },
  meetingNotesSub: {
    fontSize: 9.5,
    fontWeight: "400",
    color: "#64748b",
    marginTop: 1,
  },
  meetingStatusBadge: {
    backgroundColor: "#fef3c7",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  meetingStatusBadgeText: {
    color: "#d97706",
    fontSize: 8.5,
    fontWeight: "700",
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
});