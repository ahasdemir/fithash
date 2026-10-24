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
                <Ionicons name="swap-horizontal" size={20} color={COLORS.primary} />
                <Text style={styles.headerTitle}>Biyomekanik Egzersiz Değişimi</Text>
              </View>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {sourceExercise.name} ({sourceExercise.category}) için Jeff Nippard modeli alternatifler
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={COLORS.textPrimary} />
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
              { paddingBottom: Math.max(insets.bottom, 24) + 60 },
            ]}
          >
            {candidates.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="alert-circle-outline" size={32} color={COLORS.textMuted} />
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
                        <Ionicons name="barbell-outline" size={14} color={COLORS.primary} />
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '92%',
    paddingTop: 18,
    paddingHorizontal: 0,
    paddingBottom: 0,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceSubtle,
  },
  sourceBox: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sourceLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  sourceValue: {
    fontSize: 13,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  sourceSubText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  list: {
    flex: 1,
    width: '100%',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 60,
    gap: 12,
  },
  candidateCard: {
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 14,
    padding: 14,
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
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  candBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  candEquipmentBadge: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  candEquipmentText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  profileBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  profileLengthened: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  profileShortened: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  profileUniform: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  profileBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  zeroAxialBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  zeroAxialText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#10B981',
  },
  scoreBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    minWidth: 50,
  },
  scoreBadgeHigh: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  scoreBadgeMid: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  scoreText: {
    fontSize: 14,
    fontWeight: '800',
  },
  scoreTextHigh: {
    color: '#10B981',
  },
  scoreTextMid: {
    color: '#3B82F6',
  },
  scoreSubLabel: {
    fontSize: 9,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  reasonText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 8,
    lineHeight: 16,
  },
  weightRecBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  weightRecText: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  weightRecBold: {
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
});
