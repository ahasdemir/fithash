import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../theme';
import { WorkoutSession } from '../types/fitness';

interface OneRepMaxWidgetProps {
  workouts: WorkoutSession[];
  onSelectExercise?: (exerciseName: string) => void;
}

export const OneRepMaxWidget: React.FC<OneRepMaxWidgetProps> = ({ workouts, onSelectExercise }) => {
  const calculate1RMData = () => {
    const exerciseMaxMap: Record<string, { exerciseName: string; max1RM: number; weight: number; reps: number; date: string }> = {};

    workouts.forEach(session => {
      session.exercises.forEach(ex => {
        ex.sets.forEach(set => {
          if (set.completed && set.weight > 0 && set.reps > 0) {
            // Epley Formula: 1RM = Weight * (1 + Reps / 30)
            const epley1RM = Math.round(set.weight * (1 + set.reps / 30));
            const current = exerciseMaxMap[ex.exerciseName];

            if (!current || epley1RM > current.max1RM) {
              exerciseMaxMap[ex.exerciseName] = {
                exerciseName: ex.exerciseName,
                max1RM: epley1RM,
                weight: set.weight,
                reps: set.reps,
                date: session.date,
              };
            }
          }
        });
      });
    });

    return Object.values(exerciseMaxMap).sort((a, b) => b.max1RM - a.max1RM).slice(0, 5);
  };

  // Scans every completed set of the filtered period; memoized so PR-search
  // keystrokes and other AnalyticsTab state changes don't trigger a full rescan.
  const oneRMList = useMemo(() => calculate1RMData(), [workouts]);

  if (oneRMList.length === 0) return null;

  return (
    <View style={styles.bentoCard}>
      <View style={styles.cardHeader}>
        <View style={styles.titleRow}>
          <View style={styles.iconCircle}>
            <Ionicons name="calculator" size={15} color={COLORS.primary} />
          </View>
          <View>
            <Text style={styles.cardTitle}>Tahmini 1RM (Tek Tekrar Maksimum)</Text>
            <Text style={styles.cardSubtitle}>Epley Formülü: Ağırlık x (1 + Tekrar/30)</Text>
          </View>
        </View>
      </View>

      <View style={styles.rmList}>
        {oneRMList.map(item => (
          <TouchableOpacity
            key={item.exerciseName}
            style={styles.rmCard}
            activeOpacity={0.7}
            onPress={() => onSelectExercise?.(item.exerciseName)}
          >
            <View style={styles.rmLeft}>
              <Text style={styles.exName}>{item.exerciseName}</Text>
              <Text style={styles.rmFormulaText}>
                Son En İyi Set: {item.weight} kg x {item.reps} rep ({item.date})
              </Text>
            </View>

            <View style={styles.rmBadge}>
              <Text style={styles.rmVal}>{item.max1RM} kg</Text>
              <Text style={styles.rmTag}>Est. 1RM</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bentoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
    ...SHADOWS.soft,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  cardSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  rmList: {
    gap: 6,
  },
  rmCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceSubtle,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  rmLeft: {
    flex: 1,
    gap: 2,
  },
  exName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  rmFormulaText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontVariant: ['tabular-nums'],
  },
  rmBadge: {
    alignItems: 'flex-end',
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  rmVal: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
    fontVariant: ['tabular-nums'],
  },
  rmTag: {
    fontSize: 9,
    color: COLORS.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
