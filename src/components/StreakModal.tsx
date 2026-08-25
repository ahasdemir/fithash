import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../theme';
import { WorkoutSession } from '../types/fitness';
import { calculateStreakDays, getMondayOfWeek, getLocalDateString } from '../services/storage';

import { CustomAlertModal, CustomAlertOptions } from './CustomAlertModal';

interface StreakModalProps {
  visible: boolean;
  onClose: () => void;
  workouts: WorkoutSession[];
  workoutDays: number[]; // e.g. [1, 2, 3, 4] where length = targetDaysPerWeek
  onUpdateWorkoutDays: (days: number[]) => void;
}

const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

const TARGET_OPTIONS = [1, 2, 3, 4, 5, 6, 7];

export const StreakModal: React.FC<StreakModalProps> = ({
  visible,
  onClose,
  workouts,
  workoutDays,
  onUpdateWorkoutDays,
}) => {
  const today = new Date();
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(new Date());
  const [customAlert, setCustomAlert] = useState<CustomAlertOptions | null>(null);

  const targetDays = Array.isArray(workoutDays) ? workoutDays.length : (workoutDays || 4);
  const streakCount = calculateStreakDays(workouts, targetDays);

  const handleSelectTarget = (num: number) => {
    // Generate an array of target length: e.g. 3 -> [1, 2, 3]
    const updated = Array.from({ length: num }, (_, i) => i + 1);
    onUpdateWorkoutDays(updated);
  };

  const handlePrevMonth = () => {
    const prev = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1);
    setCurrentMonthDate(prev);
  };

  const handleNextMonth = () => {
    const next = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1);
    setCurrentMonthDate(next);
  };

  // Calendar rendering logic
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Adjust Monday start index (Mon=0, Tue=1, ..., Sun=6)
  let startOffset = firstDayOfMonth.getDay() - 1;
  if (startOffset === -1) startOffset = 6;

  const todayStr = getLocalDateString(today);

  const workoutMap = new Map<string, WorkoutSession[]>();
  workouts.forEach(w => {
    if (w.completed !== false) {
      const list = workoutMap.get(w.date) || [];
      list.push(w);
      workoutMap.set(w.date, list);
    }
  });

  // Calculate current week progress (Monday to Sunday)
  const currentWeekMonday = getMondayOfWeek(today);
  let completedThisWeekCount = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(currentWeekMonday);
    d.setDate(d.getDate() + i);
    if (workoutMap.has(getLocalDateString(d))) {
      completedThisWeekCount++;
    }
  }

  const isTargetMetThisWeek = completedThisWeekCount >= targetDays;
  const remainingNeeded = Math.max(0, targetDays - completedThisWeekCount);
  const progressPercent = Math.min(100, Math.round((completedThisWeekCount / targetDays) * 100));

  const renderCalendarGrid = () => {
    const cells = [];

    // Empty offset cells
    for (let i = 0; i < startOffset; i++) {
      cells.push(<View key={`empty-${i}`} style={styles.calendarCellEmpty} />);
    }

    // Day cells
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const cellDateObj = new Date(year, month, dayNum);
      const cellDateStr = getLocalDateString(cellDateObj);

      const dayWorkouts = workoutMap.get(cellDateStr);
      const hasCompletedWorkout = dayWorkouts && dayWorkouts.length > 0;
      const isToday = cellDateStr === todayStr;

      let cellStyle = styles.cellRestDay;
      let textStyle = styles.cellTextRestDay;
      let iconName: string | null = null;
      let iconColor = COLORS.textMuted;

      if (hasCompletedWorkout) {
        cellStyle = styles.cellCompleted;
        textStyle = styles.cellTextCompleted;
        iconName = 'checkmark-circle';
        iconColor = '#10B981';
      } else {
        cellStyle = styles.cellRestDay;
        textStyle = styles.cellTextRestDay;
      }

      cells.push(
        <TouchableOpacity
          key={cellDateStr}
          style={[styles.calendarCell, cellStyle, isToday && styles.cellToday]}
          activeOpacity={hasCompletedWorkout ? 0.7 : 1}
          onPress={() => {
            if (dayWorkouts && dayWorkouts.length > 0) {
              const summary = dayWorkouts.map(w => `• ${w.name} (${(w.totalVolume || 0).toLocaleString('tr-TR')} kg hacim)`).join('\n');
              setCustomAlert({
                visible: true,
                type: 'info',
                title: `${cellDateStr} Antrenmanı`,
                message: summary,
                onConfirm: () => setCustomAlert(null),
              });
            }
          }}
        >
          <Text style={[styles.cellDayText, textStyle]}>{dayNum}</Text>
          {iconName && (
            <Ionicons name={iconName as any} size={11} color={iconColor} style={{ marginTop: 1 }} />
          )}
        </TouchableOpacity>
      );
    }

    return (
      <View style={styles.calendarGrid}>
        {cells}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        {/* Modal Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.modalTitle}>Streak & Haftalık Hedef</Text>
            <Text style={styles.modalSubTitle}>Haftalık spor hedefini tamamladıkça serin kesintisiz devam eder.</Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close-circle" size={28} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Hero Banner */}
          <View style={styles.heroCard}>
            <View style={styles.heroTop}>
              <Ionicons name="flame" size={32} color="#111111" />
              <Text style={styles.heroVal}>{streakCount} Gün</Text>
            </View>
            <Text style={styles.heroTitle}>Aktif Antrenman Serisi</Text>
            <Text style={styles.heroSub}>
              Haftalık Hedef: {targetDays} Gün • Bu Hafta: {completedThisWeekCount}/{targetDays} Gün
            </Text>
          </View>

          {/* Current Week Goal Status Card */}
          <View style={styles.weekProgressCard}>
            <View style={styles.weekProgressHeader}>
              <View style={styles.weekProgressTitleRow}>
                <Ionicons
                  name={isTargetMetThisWeek ? "checkmark-circle" : "flag"}
                  size={18}
                  color={isTargetMetThisWeek ? "#10B981" : COLORS.primary}
                />
                <Text style={styles.weekProgressTitle}>Bu Haftanın Durumu</Text>
              </View>
              <Text style={[styles.weekProgressBadge, isTargetMetThisWeek && styles.weekProgressBadgeSuccess]}>
                {completedThisWeekCount} / {targetDays} Gün ({progressPercent}%)
              </Text>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${progressPercent}%` },
                  isTargetMetThisWeek && { backgroundColor: '#10B981' }
                ]}
              />
            </View>

            <Text style={styles.weekProgressMsg}>
              {isTargetMetThisWeek
                ? 'Harika! 🎉 Bu haftaki hedefini tamamladın. Serin güvende!'
                : `Haftalık hedefe ulaşmak için bu hafta ${remainingNeeded} gün daha spor yapmalısın.`}
            </Text>
          </View>

          {/* Weekly Target Days Selector */}
          <View style={styles.targetSection}>
            <Text style={styles.sectionHeaderTitle}>HAFTALIK HEDEF GÜN SAYISI</Text>
            <Text style={styles.sectionSubTitle}>
              Haftada kaç gün antrenman yapmak istediğinizi belirleyin.
            </Text>

            <View style={styles.targetGrid}>
              {TARGET_OPTIONS.map(num => {
                const isSelected = targetDays === num;
                return (
                  <TouchableOpacity
                    key={num}
                    style={[styles.targetChip, isSelected && styles.targetChipSelected]}
                    onPress={() => handleSelectTarget(num)}
                  >
                    <Ionicons
                      name="barbell"
                      size={14}
                      color={isSelected ? "#111111" : COLORS.textMuted}
                    />
                    <Text style={[styles.targetChipText, isSelected && styles.targetChipTextSelected]}>
                      {num} Gün
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Calendar Visualizer */}
          <View style={styles.calendarSection}>
            <View style={styles.monthHeader}>
              <TouchableOpacity style={styles.monthNavBtn} onPress={handlePrevMonth}>
                <Ionicons name="chevron-back" size={18} color={COLORS.textPrimary} />
              </TouchableOpacity>

              <Text style={styles.monthTitle}>
                {MONTH_NAMES[month]} {year}
              </Text>

              <TouchableOpacity style={styles.monthNavBtn} onPress={handleNextMonth}>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Days of Week Header */}
            <View style={styles.dowRow}>
              {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map(dow => (
                <Text key={dow} style={styles.dowText}>{dow}</Text>
              ))}
            </View>

            {renderCalendarGrid()}
          </View>

          {/* Legend Section */}
          <View style={styles.legendContainer}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: 'rgba(16, 185, 129, 0.2)', borderColor: '#10B981' }]}>
                <Ionicons name="checkmark" size={10} color="#10B981" />
              </View>
              <Text style={styles.legendText}>Tamamlanan Antrenman Günü</Text>
            </View>

            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: 'rgba(107, 114, 128, 0.1)', borderColor: 'rgba(107, 114, 128, 0.3)' }]}>
                <Ionicons name="ellipse" size={6} color="#6B7280" />
              </View>
              <Text style={styles.legendText}>Dinlenme / Boş Gün</Text>
            </View>
          </View>
        </ScrollView>

        {customAlert && (
          <CustomAlertModal
            {...customAlert}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  modalSubTitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    padding: 2,
  },
  scrollContent: {
    padding: 20,
    gap: 16,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    gap: 4,
    ...SHADOWS.soft,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroVal: {
    fontSize: 32,
    fontWeight: '900',
    color: '#111111',
  },
  heroTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111111',
  },
  heroSub: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(17, 17, 17, 0.75)',
  },
  weekProgressCard: {
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  weekProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weekProgressTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weekProgressTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  weekProgressBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  weekProgressBadgeSuccess: {
    color: '#10B981',
    borderColor: 'rgba(16, 185, 129, 0.3)',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 100,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 100,
  },
  weekProgressMsg: {
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 16,
  },
  targetSection: {
    gap: 6,
  },
  sectionHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
  },
  sectionSubTitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 6,
  },
  targetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  targetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 100,
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  targetChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  targetChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  targetChipTextSelected: {
    color: '#111111',
    fontWeight: '800',
  },
  calendarSection: {
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
    marginTop: 4,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  monthNavBtn: {
    padding: 6,
    borderRadius: 100,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dowRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dowText: {
    width: 38,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 8,
  },
  calendarCellEmpty: {
    width: '14.28%',
    height: 44,
  },
  calendarCell: {
    width: '14.28%',
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  cellToday: {
    borderColor: COLORS.primary,
    borderWidth: 2,
  },
  cellDayText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cellCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  cellTextCompleted: {
    color: '#10B981',
  },
  cellRestDay: {
    backgroundColor: 'rgba(107, 114, 128, 0.05)',
    borderColor: 'transparent',
  },
  cellTextRestDay: {
    color: COLORS.textMuted,
  },
  legendContainer: {
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  legendText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
});
