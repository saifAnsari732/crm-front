import React, { useState } from 'react';
import { 
  StyleSheet, View, TouchableOpacity, ScrollView, 
  KeyboardAvoidingView, Platform, Dimensions, ActivityIndicator, Image 
} from 'react-native';
import { Text, TextInput, Surface } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, Cloud, Network 
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { authApi, BASE_URL } from '../../services/api';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secureText, setSecureText] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const validateEmail = (text) => {
    return text.includes('@') && text.includes('.');
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setErrorMsg('Please enter both your email and password.');
      return;
    }
    if (!validateEmail(email)) {
      setErrorMsg('Please enter a valid operational email address.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');
      
      const response = await authApi.login(email.trim(), password);
      
      if (response.data?.success) {
        const { user, token } = response.data;
        await login(user, token);
      } else {
        setErrorMsg(response.data?.message || 'Invalid email or password.');
      }
    } catch (err) {
      console.error('Login Error Object:', err.message, err);
      setErrorMsg(err.response?.data?.message || 'Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        {/* Light Minimalist Gradient Canvas Background */}
        <LinearGradient
          colors={['#f8fafc', '#f1f5f9']}
          style={styles.container}
        >
          {/* Top Brand Logo Container */}
          <View style={styles.brandContainer}>
            <Surface style={styles.logoSurface} elevation={2}>
              <Image 
                source={require('../../assets/kisanLogo.png')}
                style={styles.logoGradient} 
                resizeMode="cover"
              />
            </Surface>
            <Text style={styles.brandTitle}>kisanTeam</Text>
            <Text style={styles.brandSubtitle}>
              Secure employee portal for enterprise field operations and fleet management.
            </Text>
          </View>

          {/* Core White Content Card */}
          <Surface style={styles.formSurface} elevation={3}>
            {errorMsg ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            {/* Email field */}
            <Text style={styles.inputLabel}>Email Address</Text>
            <View style={styles.inputWrapper}>
              <Mail size={20} color="#64748b" style={styles.fieldIcon} />
              <TextInput
                placeholder="name@company.com"
                placeholderTextColor="#94a3b8"
                value={email}
                onChangeText={setEmail}
                mode="flat"
                style={styles.inputField}
                activeUnderlineColor="transparent"
                underlineColor="transparent"
                keyboardType="email-address"
                autoCapitalize="none"
                textColor="#334155"
                theme={{ colors: { background: 'transparent' } }}
              />
            </View>

            {/* Password field */}
            <View style={styles.passwordHeaderRow}>
              <Text style={styles.inputLabel}>Password</Text>
              <TouchableOpacity onPress={() => alert('Redirecting to password recovery...')}>
                <Text style={styles.forgotLabel}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputWrapper}>
              <Lock size={20} color="#64748b" style={styles.fieldIcon} />
              <TextInput
                placeholder="●●●●●●●●"
                placeholderTextColor="#94a3b8"
                value={password}
                onChangeText={setPassword}
                mode="flat"
                style={styles.inputField}
                activeUnderlineColor="transparent"
                underlineColor="transparent"
                secureTextEntry={secureText}
                textColor="#334155"
                theme={{ colors: { background: 'transparent' } }}
              />
              <TouchableOpacity onPress={() => setSecureText(!secureText)} style={styles.eyeBtn}>
                {secureText ? <Eye size={20} color="#64748b" /> : <EyeOff size={20} color="#64748b" />}
              </TouchableOpacity>
            </View>

            {/* Submit Action Button */}
            <TouchableOpacity 
              style={[styles.signInBtn, loading && styles.signInBtnDisabled]} 
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Text style={styles.signInBtnText}>Sign In</Text>
                  <ArrowRight size={18} color="#fff" style={{ marginLeft: 8 }} />
                </>
              )}
            </TouchableOpacity>

            {/* Register Proxy Link */}
           
          </Surface>

          {/* Secure Encryption & System Indicators */}
          <View style={styles.indicatorRow}>
            <View style={styles.indicatorItem}>
              <ShieldCheck size={16} color="#64748b" style={{ marginRight: 6 }} />
              <Text style={styles.indicatorText}>256-bit AES</Text>
            </View>
            <View style={styles.indicatorItem}>
              <Cloud size={16} color="#64748b" style={{ marginRight: 6 }} />
              <Text style={styles.indicatorText}>System Online</Text>
            </View>
          </View>
          
          {/* Subtle Watermark Branding Coin at the Bottom */}
          <View style={styles.watermark}>
            <LinearGradient
              colors={['#e2e8f0', '#cbd5e1']}
              style={styles.watermarkCoin}
            />
          </View>
        </LinearGradient>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 80 : 50,
    paddingBottom: 40,
    alignItems: 'center',
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 28,
    width: '100%',
  },
  logoSurface: {
    borderRadius: 20,
    shadowColor: '#0f172a',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 20,
  },
  logoGradient: {
    width: 72,
    height: 72,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#002626',
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  formSurface: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 8,
  },
  passwordHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 8,
  },
  forgotLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#00332c',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
  },
  fieldIcon: {
    marginRight: 10,
  },
  inputField: {
    flex: 1,
    fontSize: 14,
    backgroundColor: 'transparent',
    height: 50,
    paddingHorizontal: 0,
  },
  eyeBtn: {
    padding: 8,
  },
  signInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a3d3c',
    borderRadius: 12,
    paddingVertical: 15,
    marginTop: 24,
    height: 54,
  },
  signInBtnDisabled: {
    opacity: 0.7,
  },
  signInBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  registerText: {
    color: '#64748b',
    fontSize: 13,
  },
  registerLink: {
    color: '#0f172a',
    fontWeight: 'bold',
    fontSize: 13,
  },
  indicatorRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
    width: '100%',
  },
  indicatorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 14,
  },
  indicatorText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  watermark: {
    marginTop: 32,
    alignItems: 'center',
  },
  watermarkCoin: {
    width: 44,
    height: 44,
    borderRadius: 22,
    opacity: 0.15,
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
});
