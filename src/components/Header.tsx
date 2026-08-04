import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../theme';

interface HeaderProps {
  title: string;
  streakDays?: number;
  onOpenSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  streakDays = 0,
  onOpenSettings,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <View style={styles.leftSection}>
        <View style={styles.logoBadge}>
          <Ionicons name="flash" size={18} color="#111111" />
        </View>
        <Text style={styles.title}>{title}</Text>
      </View>

      <View style={styles.rightSection}>
        {streakDays > 0 && (
          <View style={styles.streakBadge}>
            <Ionicons name="flame" size={14} color="#111111" />
            <Text style={styles.streakText}>{streakDays} Gün</Text>
          </View>
        )}

        {onOpenSettings && (
          <TouchableOpacity style={styles.iconButton} onPress={onOpenSettings}>
            <Ionicons name="cog-outline" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.soft,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
  },
  streakText: {
    color: '#111111',
    fontWeight: '700',
    fontSize: 12,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
});
