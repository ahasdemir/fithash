import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../theme';

export interface CustomAlertOptions {
  visible: boolean;
  type?: 'info' | 'success' | 'warning' | 'danger';
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

export const CustomAlertModal: React.FC<CustomAlertOptions> = ({
  visible,
  type = 'info',
  title,
  message,
  confirmText = 'Tamam',
  cancelText,
  onConfirm,
  onCancel,
}) => {
  if (!visible) return null;

  const getIconProps = () => {
    switch (type) {
      case 'danger':
        return { name: 'alert-circle', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.12)' };
      case 'warning':
        return { name: 'warning', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)' };
      case 'success':
        return { name: 'checkmark-circle', color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)' };
      case 'info':
      default:
        return { name: 'information-circle', color: '#111111', bg: COLORS.primaryGlow };
    }
  };

  const iconProps = getIconProps();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel || onConfirm}>
      <View style={styles.overlay}>
        <View style={styles.alertBox}>
          {/* Top Icon Badge */}
          <View style={[styles.iconCircle, { backgroundColor: iconProps.bg }]}>
            <Ionicons name={iconProps.name as any} size={28} color={iconProps.color} />
          </View>

          {/* Title & Message */}
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}

          {/* Buttons Row */}
          <View style={styles.btnRow}>
            {cancelText ? (
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={onCancel}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelText}>{cancelText}</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[
                styles.confirmBtn,
                type === 'danger' && styles.dangerConfirmBtn,
                type === 'success' && styles.successConfirmBtn,
              ]}
              onPress={onConfirm}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.confirmText,
                  (type === 'danger' || type === 'success') && styles.whiteConfirmText,
                ]}
              >
                {confirmText}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  alertBox: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
    ...SHADOWS.medium,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  message: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 100,
    backgroundColor: COLORS.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 100,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerConfirmBtn: {
    backgroundColor: '#EF4444',
  },
  successConfirmBtn: {
    backgroundColor: '#10B981',
  },
  confirmText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111111',
  },
  whiteConfirmText: {
    color: '#FFFFFF',
  },
});
