import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SHADOWS } from '../theme';
import { Exercise, MuscleCategory, EquipmentType } from '../types/fitness';
import {
  getExerciseSubstitutes,
  ExerciseSubstitutionCandidate,
} from '../services/exerciseSubstitutionService';

interface ExerciseSwapModalProps {
  visible: boolean;
  sourceExercise: {
    id?: string;
    name: string;
    category: MuscleCategory;
    equipment?: EquipmentType | string;
    targetMuscle?: string;
    lastWeight?: number;
    lastReps?: number;
    lastRir?: number;
  } | null;
  allExercises: Exercise[];
  onSelectSwap: (newExercise: Exercise, recommendedWeight: number) => void;
  onClose: () => void;
}

export const ExerciseSwapModal: React.FC<ExerciseSwapModalProps> = ({
  visible,
  sourceExercise,
  allExercises,
  onSelectSwap,
  onClose,
}) => {
  const insets = useSafeAreaInsets();

  if (!sourceExercise) return null;

  const candidates: ExerciseSubstitutionCandidate[] = useMemo(() => {
    if (!sourceExercise) return [];
    return getExerciseSubstitutes(sourceExercise, allExercises);
  }, [sourceExercise, allExercises]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <View style={styles.headerTitleRow}>
                <Ionicons name="swap-horizontal" size={18} color={COLORS.primary} />
                <Text style={styles.headerTitle}>Biyomekanik Egzersiz Değişimi</Text>
              </View>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {sourceExercise.name} ({sourceExercise.category}) için Jeff Nippard modeli alternatifler
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={18} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Source Exercise Info Box */}
          <View style={styles.sourceBox}>
            <View style={styles.sourceRow}>
              <Text style={styles.sourceLabel}>Mevcut Egzersiz:</Text>
              <Text style={styles.sourceValue}>{sourceExercise.name}</Text>
            </View>
            {sourceExercise.lastWeight && sourceExercise.lastWeight > 0 ? (
              <Text style={styles.sourceSubText}>
                Son Performans: {sourceExercise.lastWeight} kg × {sourceExercise.lastReps || 10} tekrar
              </Text>
            ) : null}
          </View>

          {/* Substitutes List */}
          <ScrollView
            style={styles.list}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: Math.max(insets.bottom, 20) + 48 },
            ]}
          >
            {candidates.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="alert-circle-outline" size={28} color={COLORS.textMuted} />
                <Text style={styles.emptyText}>Bu kategori için uygun alternatif bulunamadı.</Text>
              </View>
            ) : (
              candidates.map((cand) => {
                const isHighMatch = cand.matchScore >= 80;
                return (
                  <TouchableOpacity
                    key={cand.exercise.id}
                    style={styles.candidateCard}
                    activeOpacity={0.8}
                    onPress={() => {
                      onSelectSwap(cand.exercise, cand.recommendedStartingWeight);
                      onClose();
                    }}
                  >
                    <View style={styles.cardTopRow}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.candName}>{cand.exercise.name}</Text>
                        <View style={styles.candBadgeRow}>
                          <View style={styles.candEquipmentBadge}>
                            <Text style={styles.candEquipmentText}>{cand.exercise.equipment}</Text>
                          </View>
                          <View
                            style={[
                              styles.profileBadge,
                              cand.resistanceProfile === 'LENGTHENED'
                                ? styles.profileLengthened
                                : cand.resistanceProfile === 'SHORTENED'
                                ? styles.profileShortened
                                : styles.profileUniform,
                            ]}
                          >
                            <Text style={styles.profileBadgeText}>
                              {cand.resistanceProfile === 'LENGTHENED'
                                ? 'Uzamış / Stretch'
                                : cand.resistanceProfile === 'SHORTENED'
                                ? 'Kısalmış / Peak'
                                : 'Üniform'}
                            </Text>
                          </View>
                          {cand.axialRating === 0 && (
                            <View style={styles.zeroAxialBadge}>
                              <Text style={styles.zeroAxialText}>Sıfır Omurga Yükü</Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Match Score Badge */}
                      <View style={[styles.scoreBadge, isHighMatch ? styles.scoreBadgeHigh : styles.scoreBadgeMid]}>
                        <Text style={[styles.scoreText, isHighMatch ? styles.scoreTextHigh : styles.scoreTextMid]}>
                          %{cand.matchScore}
                        </Text>
                        <Text style={styles.scoreSubLabel}>Uyum</Text>
                      </View>
                    </View>

                    {/* Match Reason */}
                    <Text style={styles.reasonText}>{cand.matchReason}</Text>

                    {/* Weight Carry-Over Recommendation */}
                    {cand.recommendedStartingWeight > 0 && (
                      <View style={styles.weightRecBox}>
                        <Ionicons name="barbell-outline" size={13} color={COLORS.primary} />
                        <Text style={styles.weightRecText}>
                          Tavsiye Başlangıç Yükü: <Text style={styles.weightRecBold}>{cand.recommendedStartingWeight} kg</Text> (e1RM aktarımı)
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(6, 12, 18, 0.78)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    height: '92%',
    paddingTop: 14,
    paddingHorizontal: 0,
    paddingBottom: 0,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 2,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  headerSubtitle: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sourceBox: {
    marginHorizontal: 14,
    marginTop: 10,
    padding: 10,
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sourceLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  sourceValue: {
    fontSize: 12,
    color: COLORS.textPrimary,
    fontWeight: '800',
  },
  sourceSubText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 3,
    fontVariant: ['tabular-nums'],
  },
  list: {
    flex: 1,
    width: '100%',
  },
  listContent: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 48,
    gap: 8,
  },
  candidateCard: {
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.soft,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  candName: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 5,
  },
  candBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    alignItems: 'center',
  },
  candEquipmentBadge: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  candEquipmentText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  profileBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  profileLengthened: {
    backgroundColor: 'rgba(76, 194, 255, 0.16)',
  },
  profileShortened: {
    backgroundColor: 'rgba(251, 191, 36, 0.16)',
  },
  profileUniform: {
    backgroundColor: 'rgba(52, 211, 153, 0.16)',
  },
  profileBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  zeroAxialBadge: {
    backgroundColor: 'rgba(52, 211, 153, 0.14)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  zeroAxialText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.success,
  },
  scoreBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    minWidth: 46,
  },
  scoreBadgeHigh: {
    backgroundColor: 'rgba(52, 211, 153, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
  },
  scoreBadgeMid: {
    backgroundColor: 'rgba(76, 194, 255, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(76, 194, 255, 0.35)',
  },
  scoreText: {
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  scoreTextHigh: {
    color: COLORS.success,
  },
  scoreTextMid: {
    color: COLORS.primary,
  },
  scoreSubLabel: {
    fontSize: 8,
    color: COLORS.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  reasonText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 6,
    lineHeight: 15,
  },
  weightRecBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  weightRecText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  weightRecBold: {
    fontWeight: '800',
    color: COLORS.primary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 6,
  },
  emptyText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
});
