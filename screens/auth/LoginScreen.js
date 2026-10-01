import React, { useState } from 'react';
import { 
  StyleSheet, View, TouchableOpacity, ScrollView, 
  KeyboardAvoidingView, Platform, Dimensions, ActivityIndicator, Image, Modal 
} from 'react-native';
import { Text, TextInput, Surface } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, Cloud, Network, X, CheckCircle2, KeyRound, UserCheck 
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../services/api';
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

  // ── Forgot Password Modal State ────────────────────────────────
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetStep, setResetStep] = useState(1); // 1: Verify Email, 2: Reset Password
  const [resetEmail, setResetEmail] = useState('');
  const [verifiedUser, setVerifiedUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetSecureText, setResetSecureText] = useState(true);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      setErrorMsg('Please enter both your email and password.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');
      
      const response = await authApi.login({ email: email.trim(), password });
      
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

  const handleOpenForgotModal = () => {
    setShowForgotModal(true);
    setResetStep(1);
    setResetEmail(email.trim());
    setVerifiedUser(null);
    setNewPassword('');
    setConfirmPassword('');
    setResetError('');
    setResetSuccess('');
  };

  const handleVerifyEmail = async () => {
    if (!resetEmail) {
      setResetError('Please enter your registered email address or phone number.');
      return;
    }
    try {
      setResetLoading(true);
      setResetError('');
      const res = await authApi.verifyResetEmail(resetEmail.trim());
      if (res.data?.success) {
        setVerifiedUser(res.data.user);
        setResetStep(2);
      } else {
        setResetError(res.data?.message || 'No account found with this email.');
      }
    } catch (err) {
      if (err.response?.data?.message) {
        setResetError(err.response.data.message);
      } else if (err.message && err.message.toLowerCase().includes('network')) {
        setResetError('Network Error: Unable to reach server. Please check your internet connection.');
      } else {
        setResetError(err.message || 'No user account found with this email address or phone number.');
      }
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      setResetError('Please enter and confirm your new password.');
      return;
    }
    if (newPassword.length < 6) {
      setResetError('Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError('New passwords do not match. Please check again.');
      return;
    }

    try {
      setResetLoading(true);
      setResetError('');
      const res = await authApi.resetPasswordDirect(resetEmail.trim(), newPassword);
      if (res.data?.success) {
        setResetSuccess(res.data.message || 'Password updated successfully!');
        setEmail(resetEmail.trim());
        setPassword(newPassword);
        setTimeout(() => {
          setShowForgotModal(false);
          setResetSuccess('');
        }, 1800);
      } else {
        setResetError(res.data?.message || 'Failed to update password.');
      }
    } catch (err) {
      if (err.response?.data?.message) {
        setResetError(err.response.data.message);
      } else if (err.message && err.message.toLowerCase().includes('network')) {
        setResetError('Network Error: Unable to reach server. Please check your internet connection.');
      } else {
        setResetError(err.message || 'Error updating password. Please try again.');
      }
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        {/* Canvas Background */}
        <LinearGradient
          colors={['#f8fafc', '#f1f5f9']}
          style={styles.container}
        >
          {/* Top Brand Logo */}
          <View style={styles.brandContainer}>
            <Surface style={styles.logoSurface} elevation={2}>
              <Image 
                source={require('../../assets/kisanLogo.png')}
                style={styles.logoGradient} 
                resizeMode="cover"
              />
            </Surface>
            <Text style={styles.brandTitle}>kisanConnect</Text>
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
            <Text style={styles.inputLabel}>Email Address / Mobile</Text>
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
              <TouchableOpacity onPress={handleOpenForgotModal}>
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
          </Surface>        
        </LinearGradient>
      </ScrollView>

      {/* ── FORGOT PASSWORD INTERACTIVE MODAL ──────────────────────── */}
      <Modal
        visible={showForgotModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowForgotModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Surface style={styles.modalCard} elevation={5}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleWrap}>
                <View style={styles.modalIconBg}>
                  <KeyRound size={20} color="#0f766e" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Reset Password</Text>
                  <Text style={styles.modalSub}>
                    {resetStep === 1 ? 'Step 1: Verify your registered account' : 'Step 2: Set your new account password'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowForgotModal(false)} style={styles.closeBtn}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Error & Success Messages */}
            {resetError ? (
              <View style={styles.modalErrorBox}>
                <Text style={styles.modalErrorText}>{resetError}</Text>
              </View>
            ) : null}

            {resetSuccess ? (
              <View style={styles.modalSuccessBox}>
                <CheckCircle2 size={18} color="#059669" style={{ marginRight: 6 }} />
                <Text style={styles.modalSuccessText}>{resetSuccess}</Text>
              </View>
            ) : null}

            {/* STEP 1: VERIFY EMAIL / PHONE */}
            {resetStep === 1 ? (
              <View style={styles.stepContainer}>
                <Text style={styles.modalInputLabel}>Registered Email / Phone</Text>
                <View style={styles.modalInputWrapper}>
                  <Mail size={18} color="#64748b" style={{ marginRight: 10 }} />
                  <TextInput
                    placeholder="Enter email or phone..."
                    placeholderTextColor="#94a3b8"
                    value={resetEmail}
                    onChangeText={setResetEmail}
                    mode="flat"
                    style={styles.modalInputField}
                    activeUnderlineColor="transparent"
                    underlineColor="transparent"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    textColor="#334155"
                    theme={{ colors: { background: 'transparent' } }}
                  />
                </View>

                <TouchableOpacity 
                  style={[styles.modalActionBtn, resetLoading && styles.signInBtnDisabled]} 
                  onPress={handleVerifyEmail}
                  disabled={resetLoading}
                >
                  {resetLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Text style={styles.modalActionBtnText}>Verify Account</Text>
                      <ArrowRight size={16} color="#fff" style={{ marginLeft: 6 }} />
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              /* STEP 2: SET NEW PASSWORD (NO OTP REQUIRED) */
              <View style={styles.stepContainer}>
                {verifiedUser && (
                  <View style={styles.verifiedBadge}>
                    <UserCheck size={16} color="#059669" />
                    <Text style={styles.verifiedBadgeText}>
                      Account Verified: {verifiedUser.name} ({verifiedUser.email})
                    </Text>
                  </View>
                )}

                <Text style={styles.modalInputLabel}>New Password</Text>
                <View style={styles.modalInputWrapper}>
                  <Lock size={18} color="#64748b" style={{ marginRight: 10 }} />
                  <TextInput
                    placeholder="Enter new password (min 6 chars)"
                    placeholderTextColor="#94a3b8"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    mode="flat"
                    style={styles.modalInputField}
                    activeUnderlineColor="transparent"
                    underlineColor="transparent"
                    secureTextEntry={resetSecureText}
                    textColor="#334155"
                    theme={{ colors: { background: 'transparent' } }}
                  />
                  <TouchableOpacity onPress={() => setResetSecureText(!resetSecureText)}>
                    {resetSecureText ? <Eye size={18} color="#64748b" /> : <EyeOff size={18} color="#64748b" />}
                  </TouchableOpacity>
                </View>

                <Text style={[styles.modalInputLabel, { marginTop: 12 }]}>Confirm New Password</Text>
                <View style={styles.modalInputWrapper}>
                  <Lock size={18} color="#64748b" style={{ marginRight: 10 }} />
                  <TextInput
                    placeholder="Confirm new password"
                    placeholderTextColor="#94a3b8"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    mode="flat"
                    style={styles.modalInputField}
                    activeUnderlineColor="transparent"
                    underlineColor="transparent"
                    secureTextEntry={resetSecureText}
                    textColor="#334155"
                    theme={{ colors: { background: 'transparent' } }}
                  />
                </View>

                <View style={styles.modalBtnRow}>
                  <TouchableOpacity 
                    style={styles.backStepBtn} 
                    onPress={() => setResetStep(1)}
                  >
                    <Text style={styles.backStepBtnText}>Back</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.modalActionBtn, { flex: 1 }, resetLoading && styles.signInBtnDisabled]} 
                    onPress={handleResetPassword}
                    disabled={resetLoading}
                  >
                    {resetLoading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.modalActionBtnText}>Reset Password</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </Surface>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 80 : 80,
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
    color: '#0f766e',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    height: 50,
  },
  fieldIcon: {
    marginRight: 10,
  },
  inputField: {
    flex: 1,
    fontSize: 14,
    height: 48,
    backgroundColor: 'transparent',
  },
  eyeBtn: {
    padding: 6,
  },
  signInBtn: {
    backgroundColor: '#0a3d3c',
    borderRadius: 14,
    height: 52,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    shadowColor: '#0a3d3c',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  signInBtnDisabled: {
    opacity: 0.6,
  },
  signInBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#991b1b',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  indicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    gap: 20,
  },
  indicatorItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  indicatorText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },

  // ── Modal Styles ──────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    width: '100%',
    maxWidth: 440,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalIconBg: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#ccfbf1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  modalSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  stepContainer: {
    marginTop: 4,
  },
  modalInputLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 6,
  },
  modalInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    height: 46,
    marginBottom: 14,
  },
  modalInputField: {
    flex: 1,
    fontSize: 13,
    height: 44,
    backgroundColor: 'transparent',
  },
  modalActionBtn: {
    backgroundColor: '#0f766e',
    borderRadius: 12,
    height: 46,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  modalActionBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalErrorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  modalErrorText: {
    color: '#991b1b',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalSuccessBox: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#6ee7b7',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSuccessText: {
    color: '#065f46',
    fontSize: 12,
    fontWeight: 'bold',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  verifiedBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#047857',
    flex: 1,
  },
  modalBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  backStepBtn: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    height: 46,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backStepBtnText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: 'bold',
  },
});
