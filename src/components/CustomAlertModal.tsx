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
        return { name: 'alert-circle', color: COLORS.danger, bg: 'rgba(248, 113, 113, 0.14)' };
      case 'warning':
        return { name: 'warning', color: COLORS.warning, bg: 'rgba(251, 191, 36, 0.14)' };
      case 'success':
        return { name: 'checkmark-circle', color: COLORS.success, bg: 'rgba(52, 211, 153, 0.14)' };
      case 'info':
      default:
        return { name: 'information-circle', color: COLORS.primary, bg: COLORS.primaryGlow };
    }
  };

  const iconProps = getIconProps();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel || onConfirm}>
      <View style={styles.overlay}>
        <View style={styles.alertBox}>
          {/* Top Icon Badge */}
          <View style={[styles.iconCircle, { backgroundColor: iconProps.bg }]}>
            <Ionicons name={iconProps.name as any} size={26} color={iconProps.color} />
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
    backgroundColor: 'rgba(6, 12, 18, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  alertBox: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    gap: 10,
    ...SHADOWS.medium,
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  message: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 17,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerConfirmBtn: {
    backgroundColor: COLORS.danger,
  },
  successConfirmBtn: {
    backgroundColor: COLORS.success,
  },
  confirmText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textInverted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  whiteConfirmText: {
    color: '#FFFFFF',
  },
});
