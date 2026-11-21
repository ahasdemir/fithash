import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS, ThemeColors, useTheme } from '../theme';

interface HeaderProps {
  title: string;
  streakDays?: number;
  onOpenSettings?: () => void;
  onOpenStreak?: () => void;
  onToggleTheme?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  streakDays = 0,
  onOpenSettings,
  onOpenStreak,
  onToggleTheme,
}) => {
  const insets = useSafeAreaInsets();
  const { mode, colors, toggleTheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleToggleTheme = () => {
    if (onToggleTheme) {
      onToggleTheme();
    } else {
      toggleTheme();
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.leftSection}>
        <View style={styles.logoBadge}>
          <Ionicons name="barbell-outline" size={16} color={colors.primaryText} />
        </View>
        <Text style={styles.title}>{title}</Text>
      </View>

      <View style={styles.rightSection}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={handleToggleTheme}
          activeOpacity={0.75}
          accessibilityLabel="Tema Değiştir"
        >
          <Ionicons
            name={mode === 'dark' ? 'sunny-outline' : 'moon-outline'}
            size={16}
            color={colors.textPrimary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.streakBadge}
          onPress={onOpenStreak}
          activeOpacity={0.8}
        >
          <Ionicons name="flame-outline" size={14} color={colors.textPrimary} />
          <Text style={styles.streakText}>{`${streakDays} GÜN`}</Text>
        </TouchableOpacity>

        {onOpenSettings && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onOpenSettings}
            activeOpacity={0.75}
            accessibilityLabel="Ayarlar"
          >
            <Ionicons name="settings-outline" size={16} color={colors.textPrimary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 12,
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    leftSection: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    logoBadge: {
      width: 30,
      height: 30,
      borderRadius: 6,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...SHADOWS.soft,
    },
    title: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.textPrimary,
      letterSpacing: -0.5,
    },
    rightSection: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    streakBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.surfaceSubtle,
      paddingHorizontal: 10,
      height: 32,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.borderDark,
    },
    streakText: {
      color: colors.textPrimary,
      fontWeight: '700',
      fontSize: 11,
      letterSpacing: 0.4,
      fontVariant: ['tabular-nums'],
    },
    iconButton: {
      width: 32,
      height: 32,
      borderRadius: 6,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
  });
