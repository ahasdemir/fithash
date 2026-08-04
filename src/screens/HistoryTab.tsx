import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../theme';
import { WorkoutSession } from '../types/fitness';

interface HistoryTabProps {
  workouts: WorkoutSession[];
  onDeleteWorkout: (id: string) => void;
  onReuseWorkout: (workout: WorkoutSession) => void;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({
  workouts,
  onDeleteWorkout,
  onReuseWorkout,
}) => {
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutSession | null>(null);
  const [workoutToDelete, setWorkoutToDelete] = useState<WorkoutSession | null>(null);

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    return `${mins} dk`;
  };

  const handleConfirmDelete = () => {
    if (workoutToDelete) {
      onDeleteWorkout(workoutToDelete.id);
      setWorkoutToDelete(null);
      if (selectedWorkout && selectedWorkout.id === workoutToDelete.id) {
        setSelectedWorkout(null);
      }
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header Row */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Geçmiş Antrenmanlar</Text>
          <Text style={styles.subtitle}>Tarihsel saklanan antrenman ve kardiyo kayıtları</Text>
        </View>

        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{workouts.length} Kayıt</Text>
        </View>
      </View>

      {workouts.length > 0 ? (
        <View style={styles.list}>
          {workouts.map(session => {
            const hasVolume = (session.totalVolume || 0) > 0;
            const hasCalories = (session.totalCaloriesBurned || 0) > 0;
            const hasCardioDist = (session.totalCardioDistanceKm || 0) > 0;

            return (
              <View key={session.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <Ionicons name="calendar" size={14} color="#111111" />
                    <Text style={styles.dateText}>{session.date}</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.trashBtn}
                    onPress={() => setWorkoutToDelete(session)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setSelectedWorkout(session)}
                >
                  <Text style={styles.sessionName}>{session.name}</Text>

                  {/* Dynamic Metric Badges */}
                  <View style={styles.statsRow}>
                    {hasVolume && (
                      <View style={styles.badgePill}>
                        <Ionicons name="barbell" size={12} color="#111111" />
                        <Text style={styles.badgeText}>{session.totalVolume.toLocaleString('tr-TR')} kg</Text>
                      </View>
                    )}

                    {hasCalories && (
                      <View style={[styles.badgePill, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                        <Ionicons name="flame" size={12} color="#EF4444" />
                        <Text style={[styles.badgeText, { color: '#EF4444' }]}>
                          ~{session.totalCaloriesBurned} kcal
                        </Text>
                      </View>
                    )}

                    {hasCardioDist && (
                      <View style={[styles.badgePill, { backgroundColor: 'rgba(6, 182, 212, 0.12)' }]}>
                        <Ionicons name="walk" size={12} color="#06B6D4" />
                        <Text style={[styles.badgeText, { color: '#06B6D4' }]}>
                          {session.totalCardioDistanceKm} km
                        </Text>
                      </View>
                    )}

                    <View style={styles.badgePill}>
                      <Ionicons name="time" size={12} color="#111111" />
                      <Text style={styles.badgeText}>{formatDuration(session.durationSeconds)}</Text>
                    </View>
                  </View>

                  {/* Exercise summary list */}
                  <View style={styles.exSummaryList}>
                    {session.exercises.map(ex => {
                      const isCardio = ex.category === 'Kardiyo';
                      const completedSets = ex.sets.filter(s => s.completed);
                      const totalDist = completedSets.reduce((sum, s) => sum + (s.distanceKm || 0), 0);
                      const totalMins = completedSets.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);

                      return (
                        <Text key={ex.id} style={styles.exSummaryItem}>
                          • {ex.exerciseName}{' '}
                          {isCardio
                            ? `(${totalMins > 0 ? `${totalMins} dk` : ''}${totalDist > 0 ? ` • ${totalDist} km` : ''})`
                            : `(${completedSets.length} Set)`}
                        </Text>
                      );
                    })}
                  </View>

                  <View style={styles.cardFooterHint}>
                    <Text style={styles.cardFooterHintText}>Detayları görmek için dokunun</Text>
                    <Ionicons name="chevron-forward" size={14} color={COLORS.textMuted} />
                  </View>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="journal-outline" size={48} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>Henüz kayıtlı antrenman yok</Text>
          <Text style={styles.emptySub}>Tamamladığınız antrenmanlar otomatik olarak burada listelenecektir.</Text>
        </View>
      )}

      {/* Delete Confirmation Modal */}
      {workoutToDelete && (
        <Modal visible transparent animationType="fade">
          <TouchableOpacity
            style={styles.overlay}
            activeOpacity={1}
            onPress={() => setWorkoutToDelete(null)}
          >
            <View style={styles.deleteConfirmBox}>
              <Ionicons name="trash-bin-outline" size={32} color={COLORS.danger} style={{ alignSelf: 'center' }} />
              <Text style={styles.deleteConfirmTitle}>Antrenmanı Sil</Text>
              <Text style={styles.deleteConfirmSub}>
                "{workoutToDelete.name}" antrenmanı geçmişten silinecektir. Emin misiniz?
              </Text>

              <View style={styles.deleteConfirmBtnRow}>
                <TouchableOpacity
                  style={styles.cancelDeleteBtn}
                  onPress={() => setWorkoutToDelete(null)}
                >
                  <Text style={styles.cancelDeleteText}>Vazgeç</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.confirmDeleteBtn}
                  onPress={handleConfirmDelete}
                >
                  <Text style={styles.confirmDeleteText}>Evet, Sil</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* RICH WORKOUT DETAIL MODAL */}
      {selectedWorkout && (
        <Modal visible animationType="slide" transparent>
          <View style={styles.overlay}>
            <View style={styles.modalContainer}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderLeft}>
                  <Text style={styles.modalTitle} numberOfLines={2}>{selectedWorkout.name}</Text>
                  <Text style={styles.modalSub}>{selectedWorkout.date}</Text>
                </View>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setSelectedWorkout(null)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close-circle" size={26} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Bento Grid Summary Cards */}
              <View style={styles.detailBentoGrid}>
                <View style={styles.detailBentoCard}>
                  <Ionicons name="time" size={16} color="#111111" />
                  <Text style={styles.detailBentoVal}>{formatDuration(selectedWorkout.durationSeconds)}</Text>
                  <Text style={styles.detailBentoLabel}>Süre</Text>
                </View>

                {selectedWorkout.totalCaloriesBurned ? (
                  <View style={[styles.detailBentoCard, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                    <Ionicons name="flame" size={16} color="#EF4444" />
                    <Text style={[styles.detailBentoVal, { color: '#EF4444' }]}>~{selectedWorkout.totalCaloriesBurned}</Text>
                    <Text style={styles.detailBentoLabel}>Kalori (kcal)</Text>
                  </View>
                ) : null}

                {selectedWorkout.totalVolume ? (
                  <View style={styles.detailBentoCard}>
                    <Ionicons name="barbell" size={16} color="#111111" />
                    <Text style={styles.detailBentoVal}>{selectedWorkout.totalVolume.toLocaleString('tr-TR')}</Text>
                    <Text style={styles.detailBentoLabel}>Hacim (kg)</Text>
                  </View>
                ) : null}

                {selectedWorkout.totalCardioDistanceKm ? (
                  <View style={[styles.detailBentoCard, { backgroundColor: 'rgba(6, 182, 212, 0.1)' }]}>
                    <Ionicons name="walk" size={16} color="#06B6D4" />
                    <Text style={[styles.detailBentoVal, { color: '#06B6D4' }]}>{selectedWorkout.totalCardioDistanceKm}</Text>
                    <Text style={styles.detailBentoLabel}>Mesafe (km)</Text>
                  </View>
                ) : null}
              </View>

              {/* Exercises & Sets Breakdown Scroll */}
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {selectedWorkout.exercises.map((ex, idx) => {
                  const isCardio = ex.category === 'Kardiyo';
                  const catColor = COLORS.category[ex.category] || COLORS.textPrimary;

                  return (
                    <View key={ex.id} style={styles.modalExCard}>
                      <View style={styles.modalExHeader}>
                        <Text style={styles.modalExName}>{idx + 1}. {ex.exerciseName}</Text>
                        <View style={[styles.modalCatBadge, { backgroundColor: catColor + '15' }]}>
                          <Text style={[styles.modalCatText, { color: catColor }]}>{ex.category}</Text>
                        </View>
                      </View>

                      {/* Sets Table Header */}
                      <View style={styles.setTableHeader}>
                        <Text style={[styles.setTh, { width: 36 }]}>SET</Text>
                        {isCardio ? (
                          <>
                            <Text style={[styles.setTh, { flex: 1, textAlign: 'center' }]}>SÜRE</Text>
                            <Text style={[styles.setTh, { flex: 1, textAlign: 'center' }]}>MESAFE</Text>
                            <Text style={[styles.setTh, { flex: 1, textAlign: 'right' }]}>ORT. HIZ</Text>
                          </>
                        ) : (
                          <>
                            <Text style={[styles.setTh, { flex: 1, textAlign: 'center' }]}>AĞIRLIK</Text>
                            <Text style={[styles.setTh, { flex: 1, textAlign: 'center' }]}>TEKRAR</Text>
                            <Text style={[styles.setTh, { width: 50, textAlign: 'right' }]}>RIR</Text>
                          </>
                        )}
                      </View>

                      {/* Sets Table Rows */}
                      {ex.sets.map(set => {
                        if (isCardio) {
                          const mins = set.durationMinutes || 0;
                          const dist = set.distanceKm || 0;
                          const speed = set.avgSpeedKmh || (mins > 0 && dist > 0 ? ((dist / mins) * 60).toFixed(1) : '-');

                          return (
                            <View key={set.id} style={styles.setRow}>
                              <Text style={styles.setText}>#{set.setNumber}</Text>
                              <Text style={[styles.setValue, { flex: 1, textAlign: 'center' }]}>{mins} dk</Text>
                              <Text style={[styles.setValue, { flex: 1, textAlign: 'center' }]}>{dist} km</Text>
                              <Text style={[styles.setValue, { flex: 1, textAlign: 'right', fontWeight: '800' }]}>
                                {speed} km/h
                              </Text>
                            </View>
                          );
                        }

                        return (
                          <View key={set.id} style={styles.setRow}>
                            <Text style={styles.setText}>#{set.setNumber}</Text>
                            <Text style={[styles.setValue, { flex: 1, textAlign: 'center' }]}>{set.weight} kg</Text>
                            <Text style={[styles.setValue, { flex: 1, textAlign: 'center' }]}>{set.reps} tekrar</Text>
                            <Text style={[styles.setValue, { width: 50, textAlign: 'right', color: COLORS.textMuted }]}>
                              RIR {set.rir ?? 1}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  );
                })}
              </ScrollView>

              {/* Modal Footer Action Buttons */}
              <View style={styles.modalFooterRow}>
                <TouchableOpacity
                  style={styles.deleteWorkoutModalBtn}
                  onPress={() => {
                    const w = selectedWorkout;
                    setSelectedWorkout(null);
                    setWorkoutToDelete(w);
                  }}
                >
                  <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
                  <Text style={styles.deleteWorkoutModalText}>Sil</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.reuseBtn}
                  onPress={() => {
                    const workout = selectedWorkout;
                    setSelectedWorkout(null);
                    onReuseWorkout(workout);
                  }}
                >
                  <Ionicons name="refresh" size={16} color="#111111" />
                  <Text style={styles.reuseBtnText}>Antrenmanı Tekrar Yap</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 16,
    paddingBottom: 140,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  countBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 100,
  },
  countBadgeText: {
    color: '#111111',
    fontWeight: '700',
    fontSize: 12,
  },
  list: {
    gap: 12,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
    ...SHADOWS.soft,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trashBtn: {
    padding: 6,
    borderRadius: 100,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  dateText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  sessionName: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginVertical: 2,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surfaceSubtle,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  badgeText: {
    color: COLORS.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  exSummaryList: {
    marginTop: 6,
    gap: 3,
  },
  exSummaryItem: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  cardFooterHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  cardFooterHintText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 10,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  emptySub: {
    color: COLORS.textMuted,
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 250,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  deleteConfirmBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 24,
    margin: 20,
    alignSelf: 'center',
    width: '90%',
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
    ...SHADOWS.soft,
  },
  deleteConfirmTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  deleteConfirmSub: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  deleteConfirmBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelDeleteBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 100,
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelDeleteText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  confirmDeleteBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 100,
    backgroundColor: COLORS.danger,
  },
  confirmDeleteText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  modalContainer: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '85%',
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 10,
  },
  modalHeaderLeft: {
    flex: 1,
    gap: 2,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    lineHeight: 24,
  },
  modalCloseBtn: {
    padding: 2,
  },
  modalSub: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  detailBentoGrid: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 12,
  },
  detailBentoCard: {
    flex: 1,
    backgroundColor: COLORS.surfaceSubtle,
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    gap: 2,
  },
  detailBentoVal: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  detailBentoLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  modalScroll: {
    flex: 1,
  },
  modalExCard: {
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalExHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalExName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  modalCatBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 100,
  },
  modalCatText: {
    fontSize: 10,
    fontWeight: '700',
  },
  setTableHeader: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 4,
  },
  setTh: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
  },
  setText: {
    width: 36,
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  setValue: {
    color: COLORS.textPrimary,
    fontWeight: '600',
    fontSize: 12,
  },
  modalFooterRow: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  deleteWorkoutModalBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 100,
  },
  deleteWorkoutModalText: {
    color: COLORS.danger,
    fontWeight: '700',
    fontSize: 13,
  },
  reuseBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 100,
  },
  reuseBtnText: {
    color: '#111111',
    fontWeight: '800',
    fontSize: 13,
  },
});
