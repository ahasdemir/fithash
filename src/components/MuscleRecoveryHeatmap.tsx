import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS, useTheme, subscribeTheme } from '../theme';
import { MuscleCategory } from '../types/fitness';
import {
  MuscleRecoveryStatus,
  MUSCLE_RECOVERY_CONFIG,
} from '../services/muscleRecoveryService';

export interface WeeklyMuscleVolume {
  sets: number;
  volume: number;
}

interface MuscleRecoveryHeatmapProps {
  recoveryMap: Record<MuscleCategory, MuscleRecoveryStatus>;
  weeklyMuscleSets?: Record<string, WeeklyMuscleVolume>;
}

/**
 * RP Hypertrophy recommended weekly direct working set targets per muscle group.
 */
export const RP_WEEKLY_SET_TARGET: Record<MuscleCategory, number> = {
  'Göğüs': 14,
  'Sırt': 14,
  'Bacak': 14,
  'Omuz': 12,
  'Ön Kol': 10,
  'Arka Kol': 10,
  'Karın': 10,
  'Kardiyo': 3,
};

const getStatusText = (status: MuscleRecoveryStatus['status']) => {
  switch (status) {
    case 'RECOVERED':
      return 'Hazır';
    case 'RECOVERING':
      return 'Toparlanıyor';
    case 'FATIGUED':
      return 'Dinlenmeli';
  }
};

const getPastelStatusColors = (status: MuscleRecoveryStatus['status']) => {
  switch (status) {
    case 'RECOVERED':
      return { fg: COLORS.pastel.green, bg: COLORS.pastel.greenBg };
    case 'RECOVERING':
      return { fg: COLORS.pastel.amber, bg: COLORS.pastel.amberBg };
    case 'FATIGUED':
      return { fg: COLORS.pastel.rose, bg: COLORS.pastel.roseBg };
  }
};

const formatTrainedContext = (hours: number) => {
  if (hours >= 168) return '7+ gün önce';
  if (hours >= 48) return `${Math.round(hours / 24)} gün önce`;
  return `${Math.round(hours)} sa. önce`;
};

const formatTargetHint = (cat: MuscleCategory, sets: number, target: number) => {
  if (cat === 'Kardiyo') {
    return sets > 0 ? `Bu hafta ${sets} seans` : 'Opsiyonel kondisyon';
  }
  const remaining = target - sets;
  if (remaining > 0) return `RP Hedef: +${remaining} set`;
  if (sets <= target + 6) return 'RP Hedef aralıkta';
  return 'Yüksek haftalık hacim';
};

interface MuscleRowCardProps {
  cat: MuscleCategory;
  item: MuscleRecoveryStatus;
  weeklySets: number;
  weeklyVolume: number;
  isSelected: boolean;
  onToggle: (cat: MuscleCategory) => void;
}

const MuscleRowCard = React.memo(function MuscleRowCard({
  cat,
  item,
  weeklySets,
  weeklyVolume,
  isSelected,
  onToggle,
}: MuscleRowCardProps) {
  const tone = getPastelStatusColors(item.status);
  const target = RP_WEEKLY_SET_TARGET[cat] ?? 12;

  return (
    <TouchableOpacity
      style={[styles.muscleRow, isSelected && styles.muscleRowSelected]}
      activeOpacity={0.78}
      onPress={() => onToggle(cat)}
    >
      <View style={styles.rowTop}>
        <View style={styles.rowTitleGroup}>
          <View style={[styles.statusDot, { backgroundColor: tone.fg }]} />
          <Text style={styles.muscleName} numberOfLines={1}>
            {cat}
          </Text>
          <Text style={styles.lastTrainedText} numberOfLines={1}>
            · {formatTrainedContext(item.hoursSinceTrained)}
          </Text>
        </View>

        <View style={styles.rowBadges}>
          <View style={[styles.setPill, { backgroundColor: tone.bg }]}>
            <Text style={[styles.setPillText, { color: tone.fg }]}>
              {cat === 'Kardiyo' ? `${weeklySets} seans` : `${weeklySets} / ${target} set`}
            </Text>
          </View>
        </View>
      </View>

      {/* Recovery Progress Track */}
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            {
              width: `${Math.max(4, item.recoveryPercentage)}%`,
              backgroundColor: tone.fg,
            },
          ]}
        />
      </View>

      <View style={styles.rowBottom}>
        <Text style={styles.rowMetaText}>
          Toparlanma: <Text style={[styles.rowMetaStrong, { color: tone.fg }]}>%{item.recoveryPercentage}</Text> ({getStatusText(item.status)})
        </Text>
        <Text style={styles.rowMetaMono} numberOfLines={1}>
          {weeklyVolume > 0
            ? `${formatTargetHint(cat, weeklySets, target)} · ${(weeklyVolume / 1000).toFixed(1)}t`
            : formatTargetHint(cat, weeklySets, target)}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

export const MuscleRecoveryHeatmap: React.FC<MuscleRecoveryHeatmapProps> = ({
  recoveryMap,
  weeklyMuscleSets = {},
}) => {
  useTheme();
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleCategory | null>(null);

  const categories = useMemo(
    () => Object.keys(recoveryMap) as MuscleCategory[],
    [recoveryMap]
  );

  const handleToggleMuscle = useCallback((cat: MuscleCategory) => {
    setSelectedMuscle(prev => (prev === cat ? null : cat));
  }, []);

  const readyMuscles = useMemo(
    () => categories.filter(cat => recoveryMap[cat]?.status === 'RECOVERED'),
    [recoveryMap, categories]
  );

  const recoveringMuscles = useMemo(
    () => categories.filter(cat => recoveryMap[cat]?.status === 'RECOVERING'),
    [recoveryMap, categories]
  );

  const fatiguedMuscles = useMemo(
    () => categories.filter(cat => recoveryMap[cat]?.status === 'FATIGUED'),
    [recoveryMap, categories]
  );

  // Recommend muscles that are RECOVERED and have the highest weekly RP set gap
  const recommendedTargets = useMemo(() => {
    return readyMuscles
      .filter(cat => cat !== 'Kardiyo')
      .map(cat => {
        const rec = recoveryMap[cat];
        const done = weeklyMuscleSets[cat]?.sets || 0;
        const target = RP_WEEKLY_SET_TARGET[cat] ?? 12;
        const gap = Math.max(0, target - done);
        return { rec, done, target, gap };
      })
      .sort((a, b) => {
        if (b.gap !== a.gap) return b.gap - a.gap;
        return b.rec.hoursSinceTrained - a.rec.hoursSinceTrained;
      })
      .slice(0, 3);
  }, [readyMuscles, recoveryMap, weeklyMuscleSets]);

  // Unified list ordered by readiness: Ready (highest weekly gap first) -> Recovering -> Fatigued
  const orderedMuscles = useMemo(() => {
    const sortByGap = (list: MuscleCategory[]) =>
      [...list].sort((a, b) => {
        if (a === 'Kardiyo') return 1;
        if (b === 'Kardiyo') return -1;
        const gapA = (RP_WEEKLY_SET_TARGET[a] ?? 12) - (weeklyMuscleSets[a]?.sets || 0);
        const gapB = (RP_WEEKLY_SET_TARGET[b] ?? 12) - (weeklyMuscleSets[b]?.sets || 0);
        return gapB - gapA;
      });

    return [
      ...sortByGap(readyMuscles),
      ...sortByGap(recoveringMuscles),
      ...sortByGap(fatiguedMuscles),
    ];
  }, [readyMuscles, recoveringMuscles, fatiguedMuscles, weeklyMuscleSets]);

  const activeDetail = selectedMuscle ? recoveryMap[selectedMuscle] : null;
  const activeDetailTone = activeDetail ? getPastelStatusColors(activeDetail.status) : null;
  const activeWeekly = selectedMuscle ? weeklyMuscleSets[selectedMuscle] : undefined;

  return (
    <View style={styles.container}>
      {/* Compact Pastel Readiness Summary Strip */}
      <View style={styles.summaryBar}>
        <View style={[styles.summaryPill, { backgroundColor: COLORS.pastel.greenBg }]}>
          <View style={[styles.statusDot, { backgroundColor: COLORS.pastel.green }]} />
          <Text style={[styles.summaryPillText, { color: COLORS.pastel.green }]}>
            {readyMuscles.length} Hazır
          </Text>
        </View>
        <View style={[styles.summaryPill, { backgroundColor: COLORS.pastel.amberBg }]}>
          <View style={[styles.statusDot, { backgroundColor: COLORS.pastel.amber }]} />
          <Text style={[styles.summaryPillText, { color: COLORS.pastel.amber }]}>
            {recoveringMuscles.length} Toparlanıyor
          </Text>
        </View>
        <View style={[styles.summaryPill, { backgroundColor: COLORS.pastel.roseBg }]}>
          <View style={[styles.statusDot, { backgroundColor: COLORS.pastel.rose }]} />
          <Text style={[styles.summaryPillText, { color: COLORS.pastel.rose }]}>
            {fatiguedMuscles.length} Dinlenmeli
          </Text>
        </View>
      </View>

      {/* Recommended Focus Card */}
      <View style={styles.focusCard}>
        <View style={styles.focusHeader}>
          <Text style={styles.kicker}>BUGÜN ÖNERİLEN ODAK</Text>
          <View style={[styles.focusTag, { backgroundColor: COLORS.pastel.greenBg }]}>
            <Text style={[styles.focusTagText, { color: COLORS.pastel.green }]}>
              Hazır &amp; Hedef Eksik
            </Text>
          </View>
        </View>

        {recommendedTargets.length > 0 ? (
          <View style={styles.focusChipsRow}>
            {recommendedTargets.map(({ rec, done, target }) => (
              <TouchableOpacity
                key={rec.muscleId}
                style={styles.focusChip}
                activeOpacity={0.78}
                onPress={() => setSelectedMuscle(rec.muscleId)}
              >
                <Text style={styles.focusChipName}>{rec.muscleId}</Text>
                <Text style={[styles.focusChipMeta, { color: COLORS.pastel.green }]}>
                  %{rec.recoveryPercentage} · {done}/{target} set
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <Text style={styles.focusEmptyText}>
            Tüm kas grupları toparlanma sürecinde. Hafif kardiyo veya mobilite önerilir.
          </Text>
        )}
      </View>

      {/* Unified Muscle Recovery + Weekly RP Set List */}
      <View style={styles.listHeader}>
        <Text style={styles.kicker}>TOPARLANMA &amp; HAFTALIK RP SET HEDEFİ</Text>
        <Text style={styles.listHint}>Detay için dokun</Text>
      </View>

      <View style={styles.list}>
        {orderedMuscles.map(cat => (
          <MuscleRowCard
            key={cat}
            cat={cat}
            item={recoveryMap[cat]}
            weeklySets={weeklyMuscleSets[cat]?.sets || 0}
            weeklyVolume={weeklyMuscleSets[cat]?.volume || 0}
            isSelected={selectedMuscle === cat}
            onToggle={handleToggleMuscle}
          />
        ))}
      </View>

      {/* Detail Inspection Modal */}
      <Modal
        visible={!!activeDetail}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedMuscle(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedMuscle(null)}
        >
          <TouchableOpacity
            style={styles.modalContent}
            activeOpacity={1}
            onPress={e => e.stopPropagation()}
          >
            {activeDetail && activeDetailTone && (
              <>
                <View style={styles.detailHeader}>
                  <View style={styles.detailTitleRow}>
                    <View
                      style={[styles.iconCircle, { backgroundColor: activeDetailTone.bg }]}
                    >
                      <Ionicons
                        name={
                          (MUSCLE_RECOVERY_CONFIG[activeDetail.muscleId]?.iconName as any) ||
                          'fitness-outline'
                        }
                        size={16}
                        color={activeDetailTone.fg}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailTitle}>{activeDetail.muscleName}</Text>
                      <Text style={styles.detailCategoryLabel}>
                        Toparlanma &amp; Haftalık Hacim Analizi
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => setSelectedMuscle(null)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    style={styles.closeBtn}
                  >
                    <Ionicons name="close" size={18} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>

                <View
                  style={[
                    styles.statusCallout,
                    { backgroundColor: activeDetailTone.bg },
                  ]}
                >
                  <View style={styles.calloutTitleRow}>
                    <Text style={[styles.calloutTitle, { color: activeDetailTone.fg }]}>
                      {activeDetail.status === 'RECOVERED'
                        ? 'Antrenmana Tam Hazır'
                        : activeDetail.status === 'RECOVERING'
                        ? 'Toparlanma Sürüyor'
                        : 'Yüksek Yorgunluk — Dinlenmeli'}
                    </Text>
                    <Text style={[styles.calloutPct, { color: activeDetailTone.fg }]}>
                      %{activeDetail.recoveryPercentage}
                    </Text>
                  </View>
                  <Text style={styles.calloutSub}>
                    {activeDetail.status === 'RECOVERED'
                      ? 'Bu bölge progresif yüklenme ve verimli çalışma setleri için hazır.'
                      : activeDetail.status === 'RECOVERING'
                      ? 'Kas lifleri onarım aşamasında. İkincil veya kontrollü hacim uygundur.'
                      : 'Sistemik ve lokal yorgunluk yüksek. Ek dinlenme önerilir.'}
                  </Text>
                </View>

                <View style={styles.detailStatsGrid}>
                  <View style={styles.detailStatBox}>
                    <Text style={styles.detailStatLabel}>Son Çalışma</Text>
                    <Text style={styles.detailStatValue}>
                      {formatTrainedContext(activeDetail.hoursSinceTrained)}
                    </Text>
                  </View>

                  <View style={styles.detailStatBox}>
                    <Text style={styles.detailStatLabel}>Haftalık Set</Text>
                    <Text style={styles.detailStatValue}>
                      {activeWeekly?.sets || 0} / {RP_WEEKLY_SET_TARGET[activeDetail.muscleId] ?? 12}
                    </Text>
                  </View>

                  <View style={styles.detailStatBox}>
                    <Text style={styles.detailStatLabel}>Yorgunluk</Text>
                    <Text style={styles.detailStatValue}>
                      {activeDetail.accumulatedFatigueMultiplier}x
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => setSelectedMuscle(null)}
                  activeOpacity={0.82}
                >
                  <Text style={styles.actionBtnText}>Kapat</Text>
                </TouchableOpacity>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const createStyles = () =>
  StyleSheet.create({
    container: {
      gap: 12,
    },
    summaryBar: {
      flexDirection: 'row',
      gap: 8,
    },
    summaryPill: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderRadius: 8,
    },
    summaryPillText: {
      fontSize: 11,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    statusDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    focusCard: {
      backgroundColor: COLORS.surface,
      borderRadius: 10,
      padding: 14,
      borderWidth: 1,
      borderColor: COLORS.border,
      gap: 10,
      ...SHADOWS.soft,
    },
    focusHeader: {
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
    focusTag: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 5,
    },
    focusTagText: {
      fontSize: 10,
      fontWeight: '700',
    },
    focusChipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    focusChip: {
      backgroundColor: COLORS.surfaceSubtle,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 7,
      paddingHorizontal: 11,
      paddingVertical: 8,
      gap: 2,
    },
    focusChipName: {
      fontSize: 13,
      fontWeight: '700',
      color: COLORS.textPrimary,
    },
    focusChipMeta: {
      fontSize: 11,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
    },
    focusEmptyText: {
      fontSize: 12,
      color: COLORS.textSecondary,
      lineHeight: 17,
    },
    listHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 2,
      marginTop: 2,
    },
    listHint: {
      fontSize: 10,
      color: COLORS.textMuted,
    },
    list: {
      gap: 8,
    },
    muscleRow: {
      backgroundColor: COLORS.surface,
      borderRadius: 9,
      padding: 12,
      borderWidth: 1,
      borderColor: COLORS.border,
      gap: 8,
    },
    muscleRowSelected: {
      borderColor: COLORS.borderDark,
    },
    rowTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    rowTitleGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      flex: 1,
      minWidth: 0,
    },
    muscleName: {
      fontSize: 13.5,
      fontWeight: '700',
      color: COLORS.textPrimary,
    },
    lastTrainedText: {
      fontSize: 11,
      color: COLORS.textMuted,
      flexShrink: 1,
    },
    rowBadges: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexShrink: 0,
    },
    setPill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 5,
    },
    setPillText: {
      fontSize: 11,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    barTrack: {
      height: 5,
      backgroundColor: COLORS.surfaceSubtle,
      borderRadius: 99,
      overflow: 'hidden',
    },
    barFill: {
      height: '100%',
      borderRadius: 99,
    },
    rowBottom: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    rowMetaText: {
      fontSize: 11,
      color: COLORS.textMuted,
    },
    rowMetaStrong: {
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    rowMetaMono: {
      fontSize: 11,
      color: COLORS.textSecondary,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
      flexShrink: 1,
      textAlign: 'right',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: COLORS.surface,
      borderRadius: 10,
      padding: 18,
      borderWidth: 1,
      borderColor: COLORS.border,
      gap: 14,
      ...SHADOWS.medium,
    },
    detailHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 8,
    },
    detailTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    iconCircle: {
      width: 32,
      height: 32,
      borderRadius: 7,
      alignItems: 'center',
      justifyContent: 'center',
    },
    detailTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: COLORS.textPrimary,
    },
    detailCategoryLabel: {
      fontSize: 11,
      color: COLORS.textMuted,
      marginTop: 1,
    },
    closeBtn: {
      padding: 6,
      borderRadius: 6,
      backgroundColor: COLORS.surfaceSubtle,
    },
    statusCallout: {
      padding: 12,
      borderRadius: 8,
      gap: 4,
    },
    calloutTitleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    calloutTitle: {
      fontSize: 13,
      fontWeight: '800',
    },
    calloutPct: {
      fontSize: 14,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
    },
    calloutSub: {
      fontSize: 11.5,
      color: COLORS.textSecondary,
      lineHeight: 16,
    },
    detailStatsGrid: {
      flexDirection: 'row',
      gap: 8,
    },
    detailStatBox: {
      flex: 1,
      backgroundColor: COLORS.surfaceSubtle,
      borderRadius: 7,
      padding: 10,
      borderWidth: 1,
      borderColor: COLORS.border,
      gap: 3,
    },
    detailStatLabel: {
      fontSize: 10,
      color: COLORS.textMuted,
      fontWeight: '600',
    },
    detailStatValue: {
      fontSize: 13,
      fontWeight: '800',
      color: COLORS.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    actionBtn: {
      backgroundColor: COLORS.primary,
      borderRadius: 7,
      paddingVertical: 11,
      alignItems: 'center',
    },
    actionBtnText: {
      color: COLORS.primaryText,
      fontSize: 13,
      fontWeight: '700',
    },
  });

let styles = createStyles();
subscribeTheme(() => {
  styles = createStyles();
});
