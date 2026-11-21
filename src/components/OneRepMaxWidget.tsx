import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS, useTheme, subscribeTheme } from '../theme';
import { WorkoutSession } from '../types/fitness';

interface OneRepMaxWidgetProps {
  workouts: WorkoutSession[];
  onSelectExercise?: (exerciseName: string) => void;
}

export const OneRepMaxWidget: React.FC<OneRepMaxWidgetProps> = ({ workouts, onSelectExercise }) => {
  useTheme();

  const oneRMList = useMemo(() => {
    const exerciseMaxMap: Record<
      string,
      { exerciseName: string; category?: string; max1RM: number; weight: number; reps: number; date: string }
    > = {};

    workouts.forEach(session => {
      if (session.completed === false) return;
      session.exercises.forEach(ex => {
        ex.sets.forEach(set => {
          if (set.completed && set.weight > 0 && set.reps > 0) {
            const epley1RM = Math.round(set.weight * (1 + set.reps / 30));
            const current = exerciseMaxMap[ex.exerciseName];

            if (!current || epley1RM > current.max1RM) {
              exerciseMaxMap[ex.exerciseName] = {
                exerciseName: ex.exerciseName,
                category: ex.category,
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

    return Object.values(exerciseMaxMap)
      .sort((a, b) => b.max1RM - a.max1RM)
      .slice(0, 5);
  }, [workouts]);

  if (oneRMList.length === 0) return null;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.kicker}>TAHMİNİ 1RM ZİRVESİ (TÜM ZAMANLAR)</Text>
          <Text style={styles.sub}>Epley formülü · en güçlü 5 hareket</Text>
        </View>
        <View style={[styles.tagPill, { backgroundColor: COLORS.pastel.blueBg }]}>
          <Text style={[styles.tagText, { color: COLORS.pastel.blue }]}>e1RM</Text>
        </View>
      </View>

      <View style={styles.list}>
        {oneRMList.map((item, idx) => (
          <TouchableOpacity
            key={item.exerciseName}
            style={[styles.row, idx === oneRMList.length - 1 && styles.rowLast]}
            activeOpacity={0.75}
            onPress={() => onSelectExercise?.(item.exerciseName)}
          >
            <View style={styles.rowLeft}>
              <Text style={styles.exName} numberOfLines={1}>
                {item.exerciseName}
              </Text>
              <Text style={styles.metaText} numberOfLines={1}>
                {item.category ? `${item.category} · ` : ''}
                {item.weight} kg × {item.reps} · {item.date}
              </Text>
            </View>

            <View style={styles.rowRight}>
              <View style={styles.valCol}>
                <Text style={styles.rmVal}>{item.max1RM} kg</Text>
                <Text style={styles.rmLabel}>e1RM</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={COLORS.textMuted} />
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const createStyles = () =>
  StyleSheet.create({
    card: {
      backgroundColor: COLORS.surface,
      borderRadius: 10,
      padding: 14,
      borderWidth: 1,
      borderColor: COLORS.border,
      gap: 10,
      ...SHADOWS.soft,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    kicker: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.7,
      color: COLORS.textMuted,
    },
    sub: {
      fontSize: 11,
      color: COLORS.textSecondary,
      marginTop: 2,
    },
    tagPill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 5,
    },
    tagText: {
      fontSize: 10,
      fontWeight: '700',
    },
    list: {
      gap: 0,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
      gap: 10,
    },
    rowLast: {
      borderBottomWidth: 0,
      paddingBottom: 2,
    },
    rowLeft: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    exName: {
      fontSize: 13.5,
      fontWeight: '700',
      color: COLORS.textPrimary,
    },
    metaText: {
      fontSize: 11,
      color: COLORS.textMuted,
      fontVariant: ['tabular-nums'],
    },
    rowRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexShrink: 0,
    },
    valCol: {
      alignItems: 'flex-end',
    },
    rmVal: {
      fontSize: 14,
      fontWeight: '800',
      color: COLORS.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    rmLabel: {
      fontSize: 9.5,
      fontWeight: '600',
      color: COLORS.textMuted,
    },
  });

let styles = createStyles();
subscribeTheme(() => {
  styles = createStyles();
});
