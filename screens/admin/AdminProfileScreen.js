import React, { useState } from 'react';
import { 
  StyleSheet, View, ScrollView, TouchableOpacity, Alert, Switch, Platform 
} from 'react-native';
import { Text, Avatar, Surface, ActivityIndicator } from 'react-native-paper';
import { 
  Bell, Sun, Globe, LogOut, ChevronRight, Pencil, ShieldCheck, ArrowLeft
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { uploadAPI, authAPI, getAvatarUrl } from '../../services/api';
import * as ImagePicker from 'expo-image-picker';
import { useSettings } from '../../context/SettingsContext';

export default function AdminProfileScreen() {
  const router = useRouter();
  const { user, logout, updateUser } = useAuth();
  const [pushEnabled, setPushEnabled] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  // Settings Context values
  const { theme, toggleTheme, language, changeLanguage, t } = useSettings();
  
  // Theme Dynamic Colors
  const isDark = theme === 'dark';
  const colors = {
    background: isDark ? '#0f172a' : '#f8fafc',
    surface: isDark ? '#1e293b' : '#ffffff',
    text: isDark ? '#f8fafc' : '#0f172a',
    subText: isDark ? '#94a3b8' : '#64748b',
    border: isDark ? '#334155' : '#e2e8f0',
    iconColor: isDark ? '#94a3b8' : '#334155',
  };

  const currentThemeLabel = theme === 'dark' 
    ? (language === 'en' ? 'Current: Dark Mode' : 'वर्तमान: डार्क मोड') 
    : (language === 'en' ? 'Current: Light Mode' : 'वर्तमान: लाइट मोड');

  const handleSelectImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Denied', 'Permission to access media library is required!');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];
        
        // 1. Prepare
        const localUri = selectedAsset.uri;
        const filename = localUri.split('/').pop() || 'avatar.jpg';

        setUploading(true);

        let uploadRes;
        if (Platform.OS === 'web') {
          const formData = new FormData();
          const response = await fetch(selectedAsset.uri);
          const blob = await response.blob();
          formData.append('image', blob, filename);
          uploadRes = await uploadAPI.uploadImageFormData(formData);
        } else {
          // Pass the URI directly for native
          uploadRes = await uploadAPI.uploadImageFormData(selectedAsset.uri);
        }

        if (uploadRes.data && uploadRes.data.success) {
          const imageUrl = uploadRes.data.url;
          
          // 2. Update user profile
          const updateRes = await authAPI.updateProfile({ avatar: imageUrl });
          if (updateRes.data && updateRes.data.success) {
            await updateUser(updateRes.data.user);
            Alert.alert('Success', 'Profile picture updated successfully!');
          }
        }
      }
    } catch (e) {
      console.log('Image upload error:', e.message);
      Alert.alert('Error', 'Failed to upload profile picture.');
    } finally {
      setUploading(false);
    }
  };

  const handleLanguageChange = () => {
    if (Platform.OS === 'web') {
      const lang = window.confirm('Select Language:\nOK for English, Cancel for Hindi');
      changeLanguage(lang ? 'en' : 'hi');
    } else {
      Alert.alert(
        t('regionLanguage'),
        'Select App Language / भाषा चुनें',
        [
          { text: 'English', onPress: () => changeLanguage('en') },
          { text: 'हिंदी (Hindi)', onPress: () => changeLanguage('hi') },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    }
  };

  const handleLogout = () => {
    const confirmationText = language === 'en' ? 'Are you sure you want to exit StaffSync?' : 'क्या आप सच में StaffSync से बाहर निकलना चाहते हैं?';
    const titleText = language === 'en' ? 'Confirm Logout' : 'लॉगआउट की पुष्टि करें';
    const logoutBtnText = language === 'en' ? 'Logout' : 'लॉगआउट';
    const cancelBtnText = language === 'en' ? 'Cancel' : 'रद्द करें';

    if (Platform.OS === 'web') {
      const confirmLogout = window.confirm(confirmationText);
      if (confirmLogout) {
        logout();
      }
    } else {
      Alert.alert(
        titleText,
        confirmationText,
        [
          { text: cancelBtnText, style: 'cancel' },
          { text: logoutBtnText, style: 'destructive', onPress: logout }
        ]
      );
    }
  };

  const getInitials = (fullName) => {
    if (!fullName) return 'AD';
    const parts = fullName.split(' ');
    if (parts.length > 1) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return fullName.substring(0, 2).toUpperCase();
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.scrollContent}>
      
      {/* 0. Top Navigation Bar */}
      <View style={styles.topNavBar}>
        <TouchableOpacity style={styles.backBtnCircle} onPress={() => router.back()}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.topNavTitle, { color: colors.text }]}>Admin Profile</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* 1. Header Profile Box */}
      <View style={styles.profileHeaderBox}>
        <View style={styles.avatarWrapper}>
          {uploading ? (
            <View style={[styles.avatar, { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 3, borderColor: '#fff' }]}>
              <ActivityIndicator size="small" color="#0a3d3c" />
            </View>
          ) : getAvatarUrl(user?.avatar) ? (
            <Avatar.Image 
              size={96} 
              source={{ uri: getAvatarUrl(user.avatar) }} 
              style={styles.avatar} 
            />
          ) : (
            <Avatar.Text 
              size={96} 
              label={getInitials(user?.name)} 
              style={styles.avatar} 
              labelStyle={styles.avatarLabel} 
            />
          )}
          <TouchableOpacity style={styles.editIconBtn} onPress={handleSelectImage}>
            <Pencil size={12} color="#fff" />
          </TouchableOpacity>
        </View>

        <Text style={[styles.profileName, { color: colors.text }]}>{user?.name || 'Administrator'}</Text>
        <Text style={[styles.profileTitle, { color: colors.subText }]}>{user?.email || 'admin@crm.com'} • {user?.phone || 'No phone logged'}</Text>
        
        <View style={[styles.deptBadge, isDark && { backgroundColor: '#334155' }]}>
          <ShieldCheck size={14} color="#008080" style={{marginRight: 4}} />
          <Text style={[styles.deptBadgeText, isDark && { color: '#f8fafc' }]}>ROLE: {user?.role?.toUpperCase() || 'ADMIN'}</Text>
        </View>
      </View>

      {/* 2. Application Settings Box */}
      <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}>{t('applicationSettings')}</Text>
      <Surface style={[styles.settingsSurface, { backgroundColor: colors.surface, borderColor: colors.border }]} elevation={1}>
        
        {/* Settings Item 1: Push Notifications */}
        <View style={[styles.settingsRow, { borderBottomColor: isDark ? '#334155' : '#f1f5f9' }]}>
          <Bell size={20} color={colors.iconColor} style={{ marginRight: 14 }} />
          <View style={styles.settingsTextCol}>
            <Text style={[styles.settingsLabel, { color: colors.text }]}>{t('pushNotifications')}</Text>
            <Text style={[styles.settingsSub, { color: colors.subText }]}>{t('taskUpdates')}</Text>
          </View>
          <Switch 
            value={pushEnabled} 
            onValueChange={setPushEnabled}
            trackColor={{ false: '#cbd5e1', true: '#1d4ed8' }}
            thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
          />
        </View>

        {/* Settings Item 2: Appearance */}
        <TouchableOpacity style={[styles.settingsRow, { borderBottomColor: isDark ? '#334155' : '#f1f5f9' }]} onPress={toggleTheme}>
          <Sun size={20} color={colors.iconColor} style={{ marginRight: 14 }} />
          <View style={styles.settingsTextCol}>
            <Text style={[styles.settingsLabel, { color: colors.text }]}>{t('appearance')}</Text>
            <Text style={[styles.settingsSub, { color: colors.subText }]}>{currentThemeLabel}</Text>
          </View>
          <ChevronRight size={20} color="#cbd5e1" />
        </TouchableOpacity>

        {/* Settings Item 3: Language */}
        <TouchableOpacity style={[styles.settingsRow, { borderBottomColor: isDark ? '#334155' : '#f1f5f9' }]} onPress={handleLanguageChange}>
          <Globe size={20} color={colors.iconColor} style={{ marginRight: 14 }} />
          <View style={styles.settingsTextCol}>
            <Text style={[styles.settingsLabel, { color: colors.text }]}>{t('regionLanguage')}</Text>
            <Text style={[styles.settingsSub, { color: colors.subText }]}>English / हिंदी</Text>
          </View>
          <ChevronRight size={20} color="#cbd5e1" />
        </TouchableOpacity>

        {/* Settings Item 4: Logout */}
        <TouchableOpacity style={[styles.settingsRow, { borderBottomWidth: 0 }]} onPress={handleLogout}>
          <LogOut size={20} color="#ef4444" style={{ marginRight: 14 }} />
          <View style={styles.settingsTextCol}>
            <Text style={[styles.settingsLabel, { color: '#ef4444' }]}>{t('logout')}</Text>
            <Text style={[styles.settingsSub, { color: colors.subText }]}>{t('endSession')}</Text>
          </View>
          <ChevronRight size={20} color="#cbd5e1" />
        </TouchableOpacity>
      </Surface>

      <Text style={styles.versionText}>StaffSync Admin Monitor v1.0.0</Text>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 60 },
  topNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    marginTop: Platform.OS === 'ios' ? 10 : 20,
  },
  backBtnCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
  },
  topNavTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  profileHeaderBox: {
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 10,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    backgroundColor: '#0a3d3c',
  },
  avatarLabel: {
    color: '#fff',
    fontWeight: '700',
  },
  editIconBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#0ea5e9',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#f8fafc',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  profileTitle: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 12,
  },
  deptBadge: {
    backgroundColor: '#ccfbf1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  deptBadgeText: {
    color: '#0f766e',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },
  settingsSurface: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 30,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  settingsTextCol: {
    flex: 1,
  },
  settingsLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  settingsSub: {
    fontSize: 12,
  },
  versionText: {
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 20,
  },
});
