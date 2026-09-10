import React, { useRef } from "react";
import { Tabs, useRouter, usePathname } from "expo-router";
import { StyleSheet, View, Platform, Pressable, Animated, Text, Dimensions } from "react-native";
import {
  Home,
  MapPin,
  Map,
  Users,
  User,
  Navigation,
  Radio,
  ClipboardCheck,
  Calendar,
  Wallet
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../context/AuthContext";

const { width } = Dimensions.get("window");

function CustomFloatingTabBar({ state, descriptors, navigation }) {
  const router = useRouter();
  const pathname = usePathname();

  // Defined tab items matching the image design: Home, Tracking, [Center Map], Team, Profile
  const tabItems = [
    { key: "dashboard", name: "dashboard", label: "Home", icon: Home, route: "/(employee)/dashboard" },
    { key: "tracking", name: "tracking", label: "Tracking", icon: MapPin, route: "/(employee)/tracking" },
    { key: "center_map", name: "center_map", isCenter: true },
    { key: "leads", name: "leads", label: "Leads", icon: Users, route: "/(employee)/leads" },
    { key: "profile", name: "profile", label: "Profile", icon: User, route: "/(employee)/profile" },
  ];

  return (
    <View style={styles.floatingTabContainer} pointerEvents="box-none">
      {/* Outer Floating White Capsule */}
      <View style={styles.floatingTabCapsule}>
        {tabItems.map((item, index) => {
          if (item.isCenter) {
            return (
              <View key="center_map" style={styles.centerButtonWrapper}>
                <Pressable
                  onPress={() => router.push("/(employee)/tracking")}
                  style={({ pressed }) => [
                    styles.centerButtonInner,
                    pressed && { transform: [{ scale: 0.92 }] },
                  ]}
                >
                  <LinearGradient
                    colors={["#0072ff", "#00c6ff"]}
                    style={styles.centerGradient}
                  >
                    <Map size={24} color="#ffffff" strokeWidth={2.2} />
                  </LinearGradient>
                </Pressable>
              </View>
            );
          }

          // Check if this route is currently active
          const isFocused = state.routes[state.index]?.name === item.name || pathname.includes(item.name);
          const IconComponent = item.icon;
          const activeColor = "#0284c7";
          const inactiveColor = "#64748b";

          return (
            <Pressable
              key={item.key}
              onPress={() => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: state.routes.find(r => r.name === item.name)?.key || item.key,
                  canPreventDefault: true,
                });
                if (!event.defaultPrevented) {
                  router.push(item.route);
                }
              }}
              style={styles.tabItemPressable}
            >
              <IconComponent
                size={22}
                color={isFocused ? activeColor : inactiveColor}
                strokeWidth={isFocused ? 2.5 : 2}
              />
              <Text
                style={[
                  styles.tabLabelText,
                  { color: isFocused ? activeColor : inactiveColor, fontWeight: isFocused ? "700" : "500" },
                ]}
              >
                {item.label}
              </Text>

              {/* Active Indicator Line below label */}
              {isFocused && <View style={styles.activePillIndicator} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function EmployeeLayout() {
  const { user } = useAuth();
  const isAdminOrManager = user?.role === "admin" || user?.role === "manager";

  return (
    <View style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <Tabs
        tabBar={(props) => <CustomFloatingTabBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen name="dashboard" options={{ title: "Home" }} />
        <Tabs.Screen name="tracking" options={{ title: "Tracking" }} />
        <Tabs.Screen name="leads" options={{ title: "Team" }} />
        <Tabs.Screen name="profile" options={{ title: "Profile" }} />

        {/* Hidden screen routes */}
        <Tabs.Screen name="tasks" options={{ href: null }} />
        <Tabs.Screen name="meetings" options={{ href: null }} />
        <Tabs.Screen name="expenses" options={{ href: null }} />
        <Tabs.Screen name="leaves" options={{ href: null }} />
        <Tabs.Screen name="admin/history" options={{ href: null }} />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingTabContainer: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 24 : 40,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 99,
  },
  floatingTabCapsule: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "#ffffff",
    width: width * 1,
    height: 64,
    paddingHorizontal: 8,
    elevation: 12,
    shadowColor: "#2563eb",
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  tabItemPressable: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    position: "relative",
  },
  tabLabelText: {
    fontSize: 10.5,
    marginTop: 3,
  },
  activePillIndicator: {
    position: "absolute",
    bottom: 4,
    width: 14,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#0284c7",
  },
  centerButtonWrapper: {
    position: "relative",
    top: -16,
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  centerButtonInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#ffffff",
    padding: 3,
    elevation: 10,
    shadowColor: "#0072ff",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  centerGradient: {
    flex: 1,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
});
