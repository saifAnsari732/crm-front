import React, { useState } from 'react';
import { 
  StyleSheet, View, TouchableOpacity, ScrollView, 
  KeyboardAvoidingView, Platform, Dimensions, ActivityIndicator, Alert 
} from 'react-native';
import { Text, TextInput, Surface } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  User, Briefcase, Mail, ChevronDown, Check, ArrowRight, 
  ShieldCheck, Lock, EyeOff, Eye, Phone
} from 'lucide-react-native';
import { authApi } from '../../services/api';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

export default function RegisterScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('Field Operations');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secureText, setSecureText] = useState(true);
  const [consentChecked, setConsentChecked] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleRegister = async () => {
    if (!fullName || !email || !password || !phone) {
      setErrorMsg('Please complete all credential fields before continuing.');
      return;
    }
    if (!consentChecked) {
      setErrorMsg('You must agree to the Data Privacy Policy to register.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');

      const payload = {
        name: fullName,
        email: email.toLowerCase().trim(),
        phone: phone.trim(),
        department,
        password: password 
      };

      const res = await authApi.register(payload);
      if (res.data?.success) {
        Alert.alert(
          'Registration Pending',
          'Your profile registration request has been successfully queued for approval.',
          [{ text: 'Proceed', onPress: () => router.push('/login') }]
        );
      }
    } catch (err) {
      const serverMessage = err.response?.data?.message || 'Network error. Please try again.';
      setErrorMsg(serverMessage);
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
        <LinearGradient
          colors={['#f8fafc', '#f1f5f9']}
          style={styles.container}
        >
          {/* Header divider bar */}
          <View style={styles.stepsHeader}>
            <View style={styles.activeBar} />
            <Text style={styles.stepsLabel}>STEP 1 OF 2: PROFILE SETUP</Text>
          </View>

          {/* Titles */}
          <Text style={styles.title}>New Employee Registration</Text>
          <Text style={styles.subtitle}>
            Enter your professional credentials to begin your onboarding process.
          </Text>

          {errorMsg ? (
            <Surface style={styles.errorCard} elevation={1}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </Surface>
          ) : null}

          {/* Form Stack Card Container */}
          <View style={styles.formContainer}>
            
            {/* Field 1: Full Name */}
            <Surface style={styles.inputCard} elevation={1}>
              <Text style={styles.inputLabel}>FULL NAME</Text>
              <TextInput
                placeholder="Johnathan Doe"
                placeholderTextColor="#94a3b8"
                value={fullName}
                onChangeText={setFullName}
                mode="flat"
                style={styles.inputField}
                activeUnderlineColor="transparent"
                underlineColor="transparent"
                textColor="#334155"
                theme={{ colors: { background: 'transparent' } }}
              />
            </Surface>

            {/* Field 2: Phone Number */}
            <Surface style={styles.inputCard} elevation={1}>
              <Text style={styles.inputLabel}>PHONE NUMBER</Text>
              <View style={styles.inputInnerRow}>
                <Phone size={16} color="#64748b" style={{ marginRight: 8 }} />
                <TextInput
                  placeholder="+91 9876543210"
                  placeholderTextColor="#94a3b8"
                  value={phone}
                  onChangeText={setPhone}
                  mode="flat"
                  style={styles.inputFieldCompact}
                  activeUnderlineColor="transparent"
                  underlineColor="transparent"
                  textColor="#334155"
                  keyboardType="phone-pad"
                  theme={{ colors: { background: 'transparent' } }}
                />
              </View>
            </Surface>

            {/* Field 3: Department Selector */}
            <Surface style={styles.inputCard} elevation={1}>
              <Text style={styles.inputLabel}>DEPARTMENT</Text>
              <TouchableOpacity 
                style={styles.dropdownInnerRow} 
                onPress={() => {
                  Alert.alert(
                    "Select Department",
                    "Choose your designated department:",
                    [
                      { text: "Field Operations", onPress: () => setDepartment("Field Operations") },
                      { text: "Office", onPress: () => setDepartment("Office") },
                      { text: "Cancel", style: "cancel" }
                    ]
                  );
                }}
              >
                <Text style={styles.dropdownValue}>{department}</Text>
                <ChevronDown size={18} color="#64748b" />
              </TouchableOpacity>
            </Surface>

            {/* Field 4: Contact Email */}
            <Surface style={styles.inputCard} elevation={1}>
              <Text style={styles.inputLabel}>CONTACT EMAIL</Text>
              <View style={styles.inputInnerRow}>
                <Mail size={16} color="#64748b" style={{ marginRight: 8 }} />
                <TextInput
                  placeholder="j.doe@company.com"
                  placeholderTextColor="#94a3b8"
                  value={email}
                  onChangeText={setEmail}
                  mode="flat"
                  style={styles.inputFieldCompact}
                  activeUnderlineColor="transparent"
                  underlineColor="transparent"
                  textColor="#334155"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  theme={{ colors: { background: 'transparent' } }}
                />
              </View>
            </Surface>

            {/* Field 5: Password */}
            <Surface style={styles.inputCard} elevation={1}>
              <Text style={styles.inputLabel}>PASSWORD</Text>
              <View style={styles.inputInnerRow}>
                <Lock size={16} color="#64748b" style={{ marginRight: 8 }} />
                <TextInput
                  placeholder="Create a strong password"
                  placeholderTextColor="#94a3b8"
                  value={password}
                  onChangeText={setPassword}
                  mode="flat"
                  secureTextEntry={secureText}
                  style={styles.inputFieldCompact}
                  activeUnderlineColor="transparent"
                  underlineColor="transparent"
                  textColor="#334155"
                  autoCapitalize="none"
                  theme={{ colors: { background: 'transparent' } }}
                />
                <TouchableOpacity onPress={() => setSecureText(!secureText)}>
                  {secureText ? <Eye size={18} color="#64748b" /> : <EyeOff size={18} color="#64748b" />}
                </TouchableOpacity>
              </View>
            </Surface>
          </View>

          {/* Privacy Consent Checkbox Box */}
          <TouchableOpacity 
            style={[styles.consentBox, consentChecked && styles.consentBoxActive]} 
            onPress={() => setConsentChecked(!consentChecked)}
          >
            <View style={[styles.checkbox, consentChecked && styles.checkboxChecked]}>
              {consentChecked && <Check size={12} color="#fff" />}
            </View>
            <Text style={styles.consentText}>
              I confirm that the data provided is accurate for official field tracking and employee records. I agree to the <Text style={styles.consentLink}>Data Privacy Policy</Text>.
            </Text>
          </TouchableOpacity>

          {/* Create Account Primary Trigger Button */}
          <TouchableOpacity 
            style={[styles.createBtn, loading && styles.createBtnDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Text style={styles.createBtnText}>Create Account</Text>
                <ArrowRight size={18} color="#fff" style={{ marginLeft: 8 }} />
              </>
            )}
          </TouchableOpacity>

          {/* Lower Proxy Nav */}
          <View style={styles.loginProxyRow}>
            <Text style={styles.loginProxyText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/login')}>
              <Text style={styles.loginProxyLink}>Login to Portal</Text>
            </TouchableOpacity>
          </View>

          {/* Footer lock and version rows */}
          <View style={styles.footerRow}>
            <View style={styles.footerItem}>
              <ShieldCheck size={14} color="#94a3b8" style={{ marginRight: 4 }} />
              <Text style={styles.footerText}>End-to-End Encryption</Text>
            </View>
            <Text style={styles.footerText}>v2.4.1 Enterprise Build</Text>
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
    paddingTop: Platform.OS === 'ios' ? 70 : 40,
    paddingBottom: 32,
  },
  stepsHeader: {
    marginBottom: 20,
  },
  activeBar: {
    height: 4,
    width: 64,
    backgroundColor: '#0f172a',
    borderRadius: 2,
    marginBottom: 10,
  },
  stepsLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0f172a',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#002626',
  },
  subtitle: {
    fontSize: 13,
    color: '#475569',
    marginTop: 8,
    lineHeight: 18,
    marginBottom: 24,
  },
  formContainer: {
    marginBottom: 16,
  },
  inputCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  inputField: {
    fontSize: 14,
    backgroundColor: 'transparent',
    height: 38,
    paddingHorizontal: 0,
  },
  inputInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
  },
  inputFieldCompact: {
    flex: 1,
    fontSize: 14,
    backgroundColor: 'transparent',
    height: 38,
    paddingHorizontal: 0,
  },
  dropdownInnerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 38,
  },
  dropdownValue: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '500',
  },
  consentBox: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    marginBottom: 24,
    alignItems: 'flex-start',
  },
  consentBoxActive: {
    backgroundColor: '#f8fafc',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#64748b',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  checkboxChecked: {
    borderColor: '#0a3d3c',
    backgroundColor: '#0a3d3c',
  },
  consentText: {
    flex: 1,
    fontSize: 11,
    color: '#475569',
    lineHeight: 16,
  },
  consentLink: {
    fontWeight: 'bold',
    color: '#0f172a',
    textDecorationLine: 'underline',
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a3d3c',
    borderRadius: 12,
    paddingVertical: 15,
    height: 54,
  },
  createBtnDisabled: {
    opacity: 0.7,
  },
  createBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  loginProxyRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 40,
  },
  loginProxyText: {
    color: '#64748b',
    fontSize: 13,
  },
  loginProxyLink: {
    color: '#0f172a',
    fontWeight: 'bold',
    fontSize: 13,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: '#cbd5e1',
    paddingTop: 16,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '500',
  },
  errorCard: {
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
  },
});
