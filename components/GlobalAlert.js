import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Battery, ShieldAlert, BellRing, Info, AlertTriangle } from 'lucide-react-native';

export const globalAlertRef = React.createRef();

export const showCustomAlert = (title, message, buttons, iconType = 'info') => {
  if (globalAlertRef.current) {
    globalAlertRef.current.show(title, message, buttons, iconType);
  } else {
    // Fallback if ref is not mounted
    import('react-native').then(({ Alert }) => {
      Alert.alert(title, message, buttons);
    });
  }
};

const GlobalAlert = forwardRef((props, ref) => {
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState({ buttons: [] });

  useImperativeHandle(ref, () => ({
    show: (title, message, buttons, iconType) => {
      setConfig({ title, message, buttons: buttons || [{ text: 'OK', onPress: () => {} }], iconType });
      setVisible(true);
    },
    hide: () => setVisible(false)
  }));

  if (!visible) return null;

  const { title, message, buttons, iconType } = config;

  const renderIcon = () => {
    switch (iconType) {
      case 'battery': return <Battery size={36} color="#008080" />;
      case 'notification': return <BellRing size={36} color="#008080" />;
      case 'warning': return <AlertTriangle size={36} color="#eab308" />;
      case 'error': return <ShieldAlert size={36} color="#ef4444" />;
      default: return <Info size={36} color="#008080" />;
    }
  };

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={() => setVisible(false)}>
      <View style={styles.overlay}>
        <View style={styles.alertBox}>
          <View style={styles.iconContainer}>
            {renderIcon()}
          </View>
          
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          
          <View style={styles.buttonsRow}>
            {buttons.map((btn, index) => {
              const isPrimary = index === buttons.length - 1; // last button is usually primary
              const isCancel = btn.style === 'cancel' || btn.text.toLowerCase().includes('baad mein') || btn.text.toLowerCase().includes('nahi');
              
              return (
                <TouchableOpacity 
                  key={index} 
                  style={[
                    styles.button, 
                    isPrimary ? styles.primaryButton : styles.secondaryButton,
                    isCancel && styles.cancelButton
                  ]}
                  onPress={() => {
                    setVisible(false);
                    if (btn.onPress) btn.onPress();
                  }}
                >
                  <Text style={[
                    styles.buttonText, 
                    isPrimary ? styles.primaryButtonText : styles.secondaryButtonText,
                    isCancel && styles.cancelButtonText
                  ]}>
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
});

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  alertBox: {
    width: width * 0.85,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#e6f2f2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#0a3d3c',
  },
  secondaryButton: {
    backgroundColor: '#f1f5f9',
  },
  cancelButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  secondaryButtonText: {
    color: '#0f172a',
    fontWeight: '600',
    fontSize: 14,
  },
  cancelButtonText: {
    color: '#64748b',
    fontWeight: '600',
    fontSize: 14,
  }
});

export default GlobalAlert;
