import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeColors, useTheme } from '../theme';
import { WorkoutSession } from '../types/fitness';
import {
  buildStrengthOverview,
  SBDGroup,
  SBDGroupSummary,
} from '../utils/strengthMetrics';

interface OneRepMaxWidgetProps {
  workouts: WorkoutSession[];
  onSelectExercise?: (exerciseName: string) => void;
}

const getSBDAccent = (group: SBDGroup, colors: ThemeColors) => {
  if (group === 'squat') return { fg: colors.pastel.lavender, bg: colors.pastel.lavenderBg, code: 'S' };
  if (group === 'bench') return { fg: colors.pastel.blue, bg: colors.pastel.blueBg, code: 'B' };
  return { fg: colors.pastel.amber, bg: colors.pastel.amberBg, code: 'D' };
};

export const OneRepMaxWidget: React.FC<OneRepMaxWidgetProps> = ({ workouts, onSelectExercise }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const overview = useMemo(() => buildStrengthOverview(workouts), [workouts]);
  const { sbd, recentCompounds, recentWindowDays, hasRecentWindowData } = overview;

  if (sbd.loggedCount === 0 && recentCompounds.length === 0) return null;

  const sbdGroups: SBDGroupSummary[] = [sbd.squat, sbd.bench, sbd.deadlift];

  return (
    <View style={styles.wrapper}>
      {/* CARD 1: SQUAT · BENCH · DEADLIFT VARIATIONS */}
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.headerTextCol}>
            <Text style={styles.kicker}>SQUAT · BENCH · DEADLIFT</Text>
            <Text style={styles.sub}>Ana güç varyasyonları · RIR destekli e1RM</Text>
          </View>
          <View
            style={[
              styles.tagPill,
              {
                backgroundColor:
                  sbd.totalE1RM !== null ? colors.pastel.greenBg : colors.pastel.lavenderBg,
              },
            ]}
          >
            <Text
              style={[
                styles.tagText,
                {
                  color: sbd.totalE1RM !== null ? colors.pastel.green : colors.pastel.lavender,
                },
              ]}
            >
              {sbd.totalE1RM !== null ? `Toplam ${sbd.totalE1RM} kg` : `${sbd.loggedCount}/3 kayıt`}
            </Text>
          </View>
        </View>

        <View style={styles.sbdGrid}>
          {sbdGroups.map(groupSummary => {
            const accent = getSBDAccent(groupSummary.group, colors);
            const primary = groupSummary.primary;
            const extraCount = Math.max(0, groupSummary.variations.length - 1);

            return (
              <TouchableOpacity
                key={groupSummary.group}
                style={[styles.sbdTile, !primary && styles.sbdTileEmpty]}
                activeOpacity={primary ? 0.75 : 1}
                disabled={!primary}
                onPress={() => primary && onSelectExercise?.(primary.exerciseName)}
              >
                <View style={styles.sbdTileTop}>
                  <View style={[styles.sbdBadge, { backgroundColor: accent.bg }]}>
                    <Text style={[styles.sbdBadgeText, { color: accent.fg }]}>
                      {groupSummary.label}
                    </Text>
                  </View>
                  {extraCount > 0 && (
                    <Text style={styles.sbdExtraCount}>+{extraCount}</Text>
                  )}
                </View>

                <Text style={[styles.sbdValue, !primary && styles.sbdValueEmpty]} numberOfLines={1}>
                  {primary ? `${primary.max1RM} kg` : '—'}
                </Text>

                <Text style={styles.sbdVarName} numberOfLines={1}>
                  {primary ? primary.exerciseName : 'Kayıt yok'}
                </Text>

                <Text style={styles.sbdSetMeta} numberOfLines={1}>
                  {primary ? `${primary.weight}×${primary.reps}` : 'Varyasyon ekle'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {sbd.extraVariations.length > 0 && (
          <View style={styles.variationsSection}>
            <Text style={styles.variationsLabel}>DİĞER VARYASYONLAR</Text>
            <View style={styles.variationsWrap}>
              {sbd.extraVariations.map(item => {
                const accent = getSBDAccent(item.group, colors);
                return (
                  <TouchableOpacity
                    key={item.exerciseName}
                    style={styles.variationChip}
                    activeOpacity={0.75}
                    onPress={() => onSelectExercise?.(item.exerciseName)}
                  >
                    <View style={[styles.varCodeDot, { backgroundColor: accent.bg }]}>
                      <Text style={[styles.varCodeText, { color: accent.fg }]}>{accent.code}</Text>
                    </View>
                    <Text style={styles.varChipName} numberOfLines={1}>
                      {item.exerciseName}
                    </Text>
                    <Text style={styles.varChipVal}>{item.max1RM} kg</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </View>

      {/* CARD 2: DYNAMIC RECENT 5 COMPOUND STRENGTH MOVEMENTS */}
      {recentCompounds.length > 0 && (
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.headerTextCol}>
              <Text style={styles.kicker}>SON DÖNEM GÜÇ (5 BİLEŞİK)</Text>
              <Text style={styles.sub}>
                {hasRecentWindowData
                  ? `Son ${recentWindowDays} gün · dinamik bileşik hareketler`
                  : 'Son seanslar · bileşik hareketler'}
              </Text>
            </View>
            <View style={[styles.tagPill, { backgroundColor: colors.pastel.blueBg }]}>
              <Text style={[styles.tagText, { color: colors.pastel.blue }]}>
                {recentCompounds.length} bileşik
              </Text>
            </View>
          </View>

          <View style={styles.list}>
            {recentCompounds.map((item, idx) => {
              const showDelta = item.deltaPercent !== null && item.deltaPercent !== 0;
              const deltaPositive = (item.deltaPercent ?? 0) > 0;

              return (
                <TouchableOpacity
                  key={item.exerciseName}
                  style={[styles.row, idx === recentCompounds.length - 1 && styles.rowLast]}
                  activeOpacity={0.75}
                  onPress={() => onSelectExercise?.(item.exerciseName)}
                >
                  <View style={styles.rowLeft}>
                    <View style={styles.nameRow}>
                      <Text style={styles.exName} numberOfLines={1}>
                        {item.exerciseName}
                      </Text>
                      {item.isAtAllTimePR && (
                        <View style={[styles.inlineBadge, { backgroundColor: colors.pastel.amberBg }]}>
                          <Text style={[styles.inlineBadgeText, { color: colors.pastel.amber }]}>
                            PR
                          </Text>
                        </View>
                      )}
                      {showDelta && (
                        <View
                          style={[
                            styles.inlineBadge,
                            {
                              backgroundColor: deltaPositive
                                ? colors.pastel.greenBg
                                : colors.pastel.roseBg,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.inlineBadgeText,
                              {
                                color: deltaPositive ? colors.pastel.green : colors.pastel.rose,
                              },
                            ]}
                          >
                            {deltaPositive ? `+${item.deltaPercent}%` : `${item.deltaPercent}%`}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.metaText} numberOfLines={1}>
                      {item.patternLabel} · {item.weight} kg × {item.reps} ·{' '}
                      {item.sessionsCount > 1 ? `${item.sessionsCount} seans` : item.date}
                    </Text>
                  </View>

                  <View style={styles.rowRight}>
                    <View style={styles.valCol}>
                      <Text style={styles.rmVal}>{item.recentE1RM} kg</Text>
                      <Text style={styles.rmLabel}>
                        {item.allTimeE1RM > item.recentE1RM ? `PR ${item.allTimeE1RM}` : 'e1RM'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrapper: {
      gap: 12,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    headerTextCol: {
      flex: 1,
      minWidth: 0,
    },
    kicker: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.7,
      color: colors.textMuted,
    },
    sub: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
    },
    tagPill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 5,
      flexShrink: 0,
    },
    tagText: {
      fontSize: 10,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    sbdGrid: {
      flexDirection: 'row',
      gap: 8,
    },
    sbdTile: {
      flex: 1,
      minWidth: 0,
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 8,
      padding: 10,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 4,
    },
    sbdTileEmpty: {
      opacity: 0.65,
    },
    sbdTileTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 4,
    },
    sbdBadge: {
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 4,
    },
    sbdBadgeText: {
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 0.4,
    },
    sbdExtraCount: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textMuted,
      fontVariant: ['tabular-nums'],
    },
    sbdValue: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.textPrimary,
      fontVariant: ['tabular-nums'],
      marginTop: 2,
    },
    sbdValueEmpty: {
      color: colors.textMuted,
    },
    sbdVarName: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    sbdSetMeta: {
      fontSize: 10,
      color: colors.textMuted,
      fontVariant: ['tabular-nums'],
    },
    variationsSection: {
      gap: 6,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    variationsLabel: {
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 0.6,
      color: colors.textMuted,
    },
    variationsWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    variationChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.surfaceSubtle,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 6,
      paddingHorizontal: 7,
      paddingVertical: 4,
      maxWidth: '100%',
    },
    varCodeDot: {
      width: 16,
      height: 16,
      borderRadius: 4,
      alignItems: 'center',
      justifyContent: 'center',
    },
    varCodeText: {
      fontSize: 9,
      fontWeight: '800',
    },
    varChipName: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
      maxWidth: 145,
    },
    varChipVal: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.textPrimary,
      fontVariant: ['tabular-nums'],
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
      borderBottomColor: colors.border,
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
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    exName: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
      flexShrink: 1,
    },
    inlineBadge: {
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 4,
      flexShrink: 0,
    },
    inlineBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    metaText: {
      fontSize: 11,
      color: colors.textMuted,
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
      color: colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    rmLabel: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.textMuted,
      fontVariant: ['tabular-nums'],
    },
  });
