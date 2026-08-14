import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../theme';
import { WorkoutSession } from '../types/fitness';
import { calculateStreakDays, getLocalDateString } from '../services/storage';

export interface StreakWidgetProps {
  workouts?: WorkoutSession[];
  workoutDays?: number[]; // 0=Pazar, 1=Pazartesi, ..., 6=Cumartesi
  onOpenStreak?: () => void;
}

const DAY_LABELS = [
  { dayOfWeek: 1, short: 'Pzt' },
  { dayOfWeek: 2, short: 'Sal' },
  { dayOfWeek: 3, short: 'Çar' },
  { dayOfWeek: 4, short: 'Per' },
  { dayOfWeek: 5, short: 'Cum' },
  { dayOfWeek: 6, short: 'Cmt' },
  { dayOfWeek: 0, short: 'Paz' },
];

const getStreakLevel = (streak: number): { label: string; color: string; bg: string } => {
  if (streak >= 60) return { label: 'Elmas Seri', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.15)' };
  if (streak >= 30) return { label: 'Platin Seri', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.15)' };
  if (streak >= 14) return { label: 'Altın Seri', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)' };
  if (streak >= 7) return { label: 'Gümüş Seri', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' };
  if (streak >= 3) return { label: 'Bronz Seri', color: '#D97706', bg: 'rgba(217, 119, 6, 0.15)' };
  return { label: 'Başlangıç', color: COLORS.textMuted, bg: 'rgba(142, 142, 147, 0.12)' };
};

export const StreakWidget: React.FC<StreakWidgetProps> = ({
  workouts = [],
  workoutDays = [1, 2, 3, 4, 5, 6],
  onOpenStreak,
}) => {
  const today = new Date();
  const todayStr = getLocalDateString(today);
  const todayDayOfWeek = today.getDay();

  const streakDays = calculateStreakDays(workouts, workoutDays);
  const levelInfo = getStreakLevel(streakDays);

  // 1. Current Week (Monday to Sunday) Calculation
  const currentDay = today.getDay();
  const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
  const mondayDate = new Date(today);
  mondayDate.setDate(today.getDate() + distanceToMonday);

  const weekDays = DAY_LABELS.map((item, index) => {
    const d = new Date(mondayDate);
    d.setDate(mondayDate.getDate() + index);
    const dateStr = getLocalDateString(d);
    return {
      ...item,
      dateStr,
      dateObj: d,
    };
  });

  const activeWorkoutDaysSet = new Set(workoutDays.length > 0 ? workoutDays : [1, 2, 3, 4, 5, 6]);

  const completedDatesThisWeek = new Set(
    workouts
      .filter(w => w.completed !== false && weekDays.some(wd => wd.dateStr === w.date))
      .map(w => w.date)
  );

  const completedCountThisWeek = completedDatesThisWeek.size;
  const targetDaysCount = workoutDays.length > 0 ? workoutDays.length : 5;
  const progressRatio = Math.min(1, Math.max(0, completedCountThisWeek / targetDaysCount));
  const progressPercent = Math.round(progressRatio * 100);

  // 2. Today's Status & Motivational Message Logic
  const todayHasWorkout = workouts.some(w => w.date === todayStr && w.completed !== false);
  const todayIsScheduled = activeWorkoutDaysSet.has(todayDayOfWeek);

  let statusTitle = '';
  let statusSubtitle = '';
  let statusBadgeIcon: keyof typeof Ionicons.glyphMap = 'flame';
  let statusBadgeBg = COLORS.primaryGlow;
  let statusBadgeIconColor = '#111111';

  if (todayHasWorkout) {
    statusTitle = 'Bugün Antrenman Yapıldı! 🎉';
    statusSubtitle = 'Tebrikler, serinizi 1 gün daha büyüttünüz.';
    statusBadgeIcon = 'checkmark-circle';
    statusBadgeBg = 'rgba(16, 185, 129, 0.15)';
    statusBadgeIconColor = '#10B981';
  } else if (todayIsScheduled) {
    statusTitle = 'Bugün spor günü! Antrenmanı başlat ⚡️';
    statusSubtitle = 'Seriyi bozmamak için 1 seans tamamla.';
    statusBadgeIcon = 'flame';
    statusBadgeBg = COLORS.primaryGlow;
    statusBadgeIconColor = COLORS.primaryDarker;
  } else {
    statusTitle = 'Dinlenme günü - Seriniz korunuyor ☕️';
    statusSubtitle = 'Kaslarınızı dinlendirin ve yenilenin.';
    statusBadgeIcon = 'cafe';
    statusBadgeBg = 'rgba(107, 114, 128, 0.12)';
    statusBadgeIconColor = '#6B7280';
  }

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={onOpenStreak ? 0.85 : 1}
      onPress={onOpenStreak}
    >
      {/* Top Header: Live Streak Indicator & Level Badge */}
      <View style={styles.topRow}>
        <View style={styles.streakLeft}>
          <View style={styles.fireCircle}>
            <Ionicons name="flame" size={22} color="#FF6B00" />
          </View>

          <View style={styles.streakTextGroup}>
            <View style={styles.streakValRow}>
              <Text style={styles.streakValue}>{streakDays}</Text>
              <Text style={styles.streakLabel}>Gün Seri</Text>
            </View>

            <View style={[styles.levelBadge, { backgroundColor: levelInfo.bg }]}>
              <Text style={[styles.levelBadgeText, { color: levelInfo.color }]}>
                {levelInfo.label}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.headerRightAction}>
          <Text style={styles.detailLinkText}>Takvim & Günler</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
        </View>
      </View>

      {/* Motivational Status Banner */}
      <View style={styles.statusBox}>
        <View style={[styles.statusIconWrapper, { backgroundColor: statusBadgeBg }]}>
          <Ionicons name={statusBadgeIcon} size={16} color={statusBadgeIconColor} />
        </View>
        <View style={styles.statusTextContainer}>
          <Text style={styles.statusTitle} numberOfLines={1}>{statusTitle}</Text>
          <Text style={styles.statusSubtitle} numberOfLines={1}>{statusSubtitle}</Text>
        </View>
      </View>

      {/* Weekly Goal Progress Bar */}
      <View style={styles.goalSection}>
        <View style={styles.goalTextRow}>
          <Text style={styles.goalTitle}>Haftalık Antrenman Hedefi</Text>
          <Text style={styles.goalValueText}>
            {completedCountThisWeek} / {targetDaysCount} Gün ({progressPercent}%)
          </Text>
        </View>

        <View style={styles.progressBarTrack}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${progressPercent}%` },
              progressPercent === 100 && styles.progressBarFillComplete,
            ]}
          />
        </View>
      </View>

      {/* 7-Day Visual Weekly Strip */}
      <View style={styles.weeklyStripContainer}>
        {weekDays.map(item => {
          const hasWorkout = completedDatesThisWeek.has(item.dateStr);
          const isScheduled = activeWorkoutDaysSet.has(item.dayOfWeek);
          const isToday = item.dateStr === todayStr;
          const isPast = item.dateStr < todayStr;

          let pillBg = COLORS.surfaceSubtle;
          let pillBorderColor = COLORS.border;
          let textColor = COLORS.textMuted;
          let iconName: keyof typeof Ionicons.glyphMap | null = null;
          let iconColor = COLORS.textMuted;

          if (hasWorkout) {
            // Tamamlanan Gün -> Yeşil tık/alev
            pillBg = 'rgba(16, 185, 129, 0.15)';
            pillBorderColor = '#10B981';
            textColor = '#065F46';
            iconName = 'checkmark';
            iconColor = '#10B981';
          } else if (!isScheduled) {
            // Dinlenme Günü -> Kahve/mola ikonu
            pillBg = 'rgba(107, 114, 128, 0.08)';
            pillBorderColor = 'transparent';
            textColor = COLORS.textMuted;
            iconName = 'cafe-outline';
            iconColor = '#6B7280';
          } else if (isPast) {
            // Kaçırılan Gün -> Kırmızı nokta
            pillBg = 'rgba(239, 68, 68, 0.1)';
            pillBorderColor = 'rgba(239, 68, 68, 0.3)';
            textColor = '#EF4444';
            iconName = 'ellipse';
            iconColor = '#EF4444';
          } else if (isToday) {
            // Bugün henüz yapılmadı (Spor Günü)
            pillBg = COLORS.surface;
            pillBorderColor = COLORS.primary;
            textColor = COLORS.textPrimary;
            iconName = 'barbell-outline';
            iconColor = COLORS.primaryDarker;
          } else {
            // Gelecek Spor Günü
            pillBg = COLORS.surface;
            pillBorderColor = COLORS.border;
            textColor = COLORS.textSecondary;
            iconName = 'barbell-outline';
            iconColor = COLORS.textMuted;
          }

          return (
            <View
              key={item.dateStr}
              style={[
                styles.dayPill,
                { backgroundColor: pillBg, borderColor: pillBorderColor },
                isToday && styles.todayDayPill,
              ]}
            >
              <Text style={[styles.dayShortText, { color: textColor }, isToday && styles.todayShortText]}>
                {item.short}
              </Text>

              <View style={styles.dayIconHolder}>
                {iconName === 'ellipse' ? (
                  <View style={styles.redDot} />
                ) : iconName ? (
                  <Ionicons name={iconName} size={11} color={iconColor} />
                ) : null}
              </View>

              {isToday && <View style={styles.todayIndicatorDot} />}
            </View>
          );
        })}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 14,
    ...SHADOWS.soft,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  streakLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fireCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 107, 0, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 0, 0.25)',
  },
  streakTextGroup: {
    gap: 2,
  },
  streakValRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  streakValue: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  streakLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  levelBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 100,
  },
  levelBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  headerRightAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  detailLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  statusIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTextContainer: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  statusSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.textMuted,
    marginTop: 1,
  },
  goalSection: {
    gap: 6,
  },
  goalTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  goalTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  goalValueText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },
  progressBarFillComplete: {
    backgroundColor: '#10B981',
  },
  weeklyStripContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  dayPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 52,
    gap: 4,
  },
  todayDayPill: {
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  dayShortText: {
    fontSize: 11,
    fontWeight: '700',
  },
  todayShortText: {
    fontWeight: '900',
  },
  dayIconHolder: {
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  redDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  todayIndicatorDot: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: COLORS.primary,
  },
});
