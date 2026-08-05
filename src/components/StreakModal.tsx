import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../theme';
import { WorkoutSession } from '../types/fitness';
import { calculateStreakDays } from '../services/storage';

import { CustomAlertModal, CustomAlertOptions } from './CustomAlertModal';

interface StreakModalProps {
  visible: boolean;
  onClose: () => void;
  workouts: WorkoutSession[];
  workoutDays: number[]; // 0=Pazar, 1=Pazartesi, ... 6=Cumartesi
  onUpdateWorkoutDays: (days: number[]) => void;
}

const DAYS_OF_WEEK = [
  { id: 1, name: 'Pazartesi', short: 'Pzt' },
  { id: 2, name: 'Salı', short: 'Sal' },
  { id: 3, name: 'Çarşamba', short: 'Çar' },
  { id: 4, name: 'Perşembe', short: 'Per' },
  { id: 5, name: 'Cuma', short: 'Cum' },
  { id: 6, name: 'Cumartesi', short: 'Cmt' },
  { id: 0, name: 'Pazar', short: 'Paz' },
];

const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

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

  const streakCount = calculateStreakDays(workouts, workoutDays);

  const toggleDay = (dayId: number) => {
    let updated: number[];
    if (workoutDays.includes(dayId)) {
      // Must keep at least 1 workout day
      if (workoutDays.length <= 1) {
        setCustomAlert({
          visible: true,
          type: 'warning',
          title: 'Uyarı',
          message: 'En az 1 spor günü seçili olmalıdır.',
          onConfirm: () => setCustomAlert(null),
        });
        return;
      }
      updated = workoutDays.filter(d => d !== dayId);
    } else {
      updated = [...workoutDays, dayId];
    }
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

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const workoutMap = new Map<string, WorkoutSession[]>();
  workouts.forEach(w => {
    if (w.completed !== false) {
      const list = workoutMap.get(w.date) || [];
      list.push(w);
      workoutMap.set(w.date, list);
    }
  });

  const renderCalendarGrid = () => {
    const totalCells = startOffset + daysInMonth;
    const rows = Math.ceil(totalCells / 7);
    const cells = [];

    // Empty offset cells
    for (let i = 0; i < startOffset; i++) {
      cells.push(<View key={`empty-${i}`} style={styles.calendarCellEmpty} />);
    }

    // Day cells
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const cellDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const cellDateObj = new Date(year, month, dayNum);
      const dayOfWeek = cellDateObj.getDay();

      const isScheduledWorkoutDay = workoutDays.includes(dayOfWeek);
      const dayWorkouts = workoutMap.get(cellDateStr);
      const hasCompletedWorkout = dayWorkouts && dayWorkouts.length > 0;
      const isToday = cellDateStr === todayStr;
      const isPast = cellDateObj < new Date(today.getFullYear(), today.getMonth(), today.getDate());

      let cellStyle = styles.cellRestDay;
      let textStyle = styles.cellTextRestDay;
      let iconName: string | null = null;
      let iconColor = COLORS.textMuted;

      if (hasCompletedWorkout) {
        cellStyle = styles.cellCompleted;
        textStyle = styles.cellTextCompleted;
        iconName = 'checkmark-circle';
        iconColor = '#10B981';
      } else if (isScheduledWorkoutDay) {
        if (isPast) {
          cellStyle = styles.cellMissed;
          textStyle = styles.cellTextMissed;
          iconName = 'alert-circle';
          iconColor = '#EF4444';
        } else {
          cellStyle = styles.cellScheduled;
          textStyle = styles.cellTextScheduled;
          iconName = 'barbell';
          iconColor = COLORS.primary;
        }
      } else {
        // Rest Day
        cellStyle = styles.cellRestDay;
        textStyle = styles.cellTextRestDay;
        iconName = 'pause';
        iconColor = '#6B7280';
      }

      cells.push(
        <TouchableOpacity
          key={cellDateStr}
          style={[styles.calendarCell, cellStyle, isToday && styles.cellToday]}
          activeOpacity={hasCompletedWorkout ? 0.7 : 1}
          onPress={() => {
            if (dayWorkouts && dayWorkouts.length > 0) {
              const summary = dayWorkouts.map(w => `• ${w.name} (${w.totalVolume || 0} kg hacim)`).join('\n');
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
            <Ionicons name={iconName as any} size={10} color={iconColor} style={{ marginTop: 2 }} />
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
            <Text style={styles.modalTitle}>Streak & Spor Günleri</Text>
            <Text style={styles.modalSubTitle}>Spor günlerinizi seçin, dinlenme günlerinde streak korunur.</Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
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
              Haftalık {workoutDays.length} Spor Günü • {7 - workoutDays.length} Dinlenme Günü
            </Text>
          </View>

          {/* Workout Days Selector */}
          <Text style={styles.sectionHeaderTitle}>HAFTALIK SPOR GÜNLERİ</Text>
          <Text style={styles.sectionSubTitle}>Sadece seçtiğiniz günlerde antrenman yapılmadığında streak bozulur.</Text>

          <View style={styles.daysGrid}>
            {DAYS_OF_WEEK.map(day => {
              const isSelected = workoutDays.includes(day.id);
              return (
                <TouchableOpacity
                  key={day.id}
                  style={[styles.dayChip, isSelected && styles.dayChipSelected]}
                  onPress={() => toggleDay(day.id)}
                >
                  <Ionicons
                    name={isSelected ? "barbell" : "pause-circle"}
                    size={14}
                    color={isSelected ? "#111111" : COLORS.textMuted}
                  />
                  <Text style={[styles.dayChipText, isSelected && styles.dayChipTextSelected]}>
                    {day.short}
                  </Text>
                </TouchableOpacity>
              );
            })}
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
              <Text style={styles.legendText}>Tamamlanan Antrenman</Text>
            </View>

            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: 'rgba(107, 114, 128, 0.1)', borderColor: 'rgba(107, 114, 128, 0.3)' }]}>
                <Ionicons name="pause" size={10} color="#6B7280" />
              </View>
              <Text style={styles.legendText}>Dinlenme Günü (Streak Korunur)</Text>
            </View>

            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: '#EF4444' }]}>
                <Ionicons name="alert" size={10} color="#EF4444" />
              </View>
              <Text style={styles.legendText}>Kaçırılan Spor Günü</Text>
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
    color: 'rgba(17, 17, 17, 0.7)',
  },
  sectionHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
    marginTop: 6,
  },
  sectionSubTitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: -10,
    marginBottom: 4,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dayChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  dayChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  dayChipTextSelected: {
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
    marginTop: 8,
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
  cellScheduled: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
  },
  cellTextScheduled: {
    color: COLORS.textPrimary,
  },
  cellMissed: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  cellTextMissed: {
    color: '#EF4444',
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
