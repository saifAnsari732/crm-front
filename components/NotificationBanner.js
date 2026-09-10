import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Animated, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Bell, ClipboardCheck, Wallet, Calendar, AlertCircle, X, Users } from 'lucide-react-native';
import { useNotification } from '../context/NotificationContext';

const { width } = Dimensions.get('window');
const useNativeDriver = Platform.OS !== 'web';

const getNotificationDetails = (type) => {
  switch (type) {
    case 'task':
      return {
        icon: <ClipboardCheck size={20} color="#0d9488" />,
        route: '/(employee)/tasks',
        bgColor: '#f0fdfa',
        borderColor: '#99f6e4',
      };
    case 'expense':
      return {
        icon: <Wallet size={20} color="#ea580c" />,
        route: '/(employee)/expenses',
        bgColor: '#fff7ed',
        borderColor: '#fed7aa',
      };
    case 'leave':
      return {
        icon: <Calendar size={20} color="#2563eb" />,
        route: '/(employee)/leaves',
        bgColor: '#eff6ff',
        borderColor: '#bfdbfe',
      };
    case 'lead':
      return {
        icon: <Users size={20} color="#0891b2" />,
        route: '/(employee)/leads',
        bgColor: '#ecfeff',
        borderColor: '#c5f2f7',
      };
    default:
      return {
        icon: <Bell size={20} color="#0f766e" />,
        route: '/(employee)/dashboard',
        bgColor: '#f0fdfd',
        borderColor: '#ccfbf1',
      };
  }
};

export default function NotificationBanner() {
  const { activeNotification, dismissNotification } = useNotification();
  const router = useRouter();
  const slideAnim = useRef(new Animated.Value(-150)).current;

  useEffect(() => {
    if (activeNotification) {
      // Slide Down animation
      Animated.spring(slideAnim, {
        toValue: Platform.OS === 'ios' ? 60 : 40, // Height placement adjusted for platform status bars
        useNativeDriver,
        tension: 50,
        friction: 8,
      }).start();

      // Auto dismiss after 6 seconds
      const timer = setTimeout(() => {
        hideBanner();
      }, 6000);

      return () => clearTimeout(timer);
    }
  }, [activeNotification]);

  const hideBanner = () => {
    // Slide Up animation
    Animated.timing(slideAnim, {
      toValue: -150,
      duration: 350,
      useNativeDriver,
    }).start(() => {
      dismissNotification();
    });
  };

  if (!activeNotification) return null;

  const { title, message, type } = activeNotification;
  const config = getNotificationDetails(type);

  const handlePress = () => {
    hideBanner();
    setTimeout(() => {
      try {
        console.log(`🧭 Notification Click: Navigating to ${config.route}`);
        router.push(config.route);
      } catch (err) {
        console.error('Failed to redirect:', err);
      }
    }, 200);
  };

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
      <TouchableOpacity 
        style={[styles.banner, { backgroundColor: config.bgColor, borderColor: config.borderColor }]} 
        onPress={handlePress}
        activeOpacity={0.9}
      >
        <View style={styles.iconContainer}>
          {config.icon}
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Text style={styles.message} numberOfLines={2}>{message}</Text>
        </View>
        <TouchableOpacity style={styles.closeButton} onPress={hideBanner}>
          <X size={16} color="#64748b" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: 'center',
    shadowColor: '#0a3d3c',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  banner: {
    width: '100%',
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  textContainer: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 2,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  message: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 16,
  },
  closeButton: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
});
