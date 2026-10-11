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
import { WorkoutSession, Routine } from '../types/fitness';
import { EditWorkoutModal } from '../components/EditWorkoutModal';

interface HistoryTabProps {
  workouts: WorkoutSession[];
  routines?: Routine[];
  onDeleteWorkout: (id: string) => void;
  onReuseWorkout: (workout: WorkoutSession) => void;
  onUpdateWorkout?: (workout: WorkoutSession) => void;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({
  workouts,
  routines = [],
  onDeleteWorkout,
  onReuseWorkout,
  onUpdateWorkout,
}) => {
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutSession | null>(null);
  const [workoutToDelete, setWorkoutToDelete] = useState<WorkoutSession | null>(null);
  const [workoutToEdit, setWorkoutToEdit] = useState<WorkoutSession | null>(null);

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
    <View style={styles.container}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
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

            const totSets = session.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
            const compSets = session.exercises.reduce((sum, ex) => sum + ex.sets.filter(s => s.completed).length, 0);
            const skippedSets = totSets - compSets;

            return (
              <View key={session.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <Ionicons name="calendar" size={14} color="#111111" />
                    <Text style={styles.dateText}>{session.date}</Text>
                  </View>

                  <View style={styles.cardHeaderRight}>
                    <TouchableOpacity
                      style={styles.editCardBtn}
                      onPress={() => setWorkoutToEdit(session)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="pencil-outline" size={17} color={COLORS.primary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.trashBtn}
                      onPress={() => setWorkoutToDelete(session)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setSelectedWorkout(session)}
                >
                  <Text style={styles.sessionName} numberOfLines={2} ellipsizeMode="tail">{session.name}</Text>

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

                    {skippedSets > 0 ? (
                      <View style={[styles.badgePill, { backgroundColor: 'rgba(239, 68, 68, 0.12)', borderColor: 'rgba(239, 68, 68, 0.3)' }]}>
                        <Ionicons name="alert-circle" size={12} color="#EF4444" />
                        <Text style={[styles.badgeText, { color: '#EF4444' }]}>{skippedSets} Set Atlandı</Text>
                      </View>
                    ) : totSets > 0 ? (
                      <View style={[styles.badgePill, { backgroundColor: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(16, 185, 129, 0.3)' }]}>
                        <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                        <Text style={[styles.badgeText, { color: '#10B981' }]}>%100 Tamamlandı</Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Exercise summary list */}
                  <View style={styles.exSummaryList}>
                    {session.exercises.map(ex => {
                      const isCardio = ex.category === 'Kardiyo';
                      const completedSets = ex.sets.filter(s => s.completed);
                      const totalDist = completedSets.reduce((sum, s) => sum + (s.distanceKm || 0), 0);
                      const totalMins = completedSets.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
                      const isSkipped = completedSets.length === 0 && ex.sets.length > 0;
                      const isPartiallySkipped = completedSets.length > 0 && completedSets.length < ex.sets.length;

                      return (
                        <Text key={ex.id} style={[styles.exSummaryItem, isSkipped && styles.exSummaryItemSkipped]}>
                          • {ex.exerciseName}{' '}
                          {isCardio
                            ? `(${totalMins > 0 ? `${totalMins} dk` : ''}${totalDist > 0 ? ` • ${totalDist} km` : ''})`
                            : `(${completedSets.length}/${ex.sets.length} Set${isSkipped ? ' - Atlandı' : ''})`}
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
      </ScrollView>

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

      {/* Edit Workout Modal outside Detail Modal */}
      <EditWorkoutModal
        visible={!!workoutToEdit}
        workout={workoutToEdit}
        onClose={() => setWorkoutToEdit(null)}
        onSave={updated => {
          setWorkoutToEdit(null);
          if (onUpdateWorkout) {
            onUpdateWorkout(updated);
          }
          if (selectedWorkout && selectedWorkout.id === updated.id) {
            setSelectedWorkout(updated);
          }
        }}
      />

      {/* RICH WORKOUT DETAIL MODAL */}
      {selectedWorkout && (() => {
        let totalSetsInSession = 0;
        let completedSetsInSession = 0;
        let skippedSetsInSession = 0;

        selectedWorkout.exercises.forEach(ex => {
          ex.sets.forEach(s => {
            totalSetsInSession++;
            if (s.completed) {
              completedSetsInSession++;
            } else {
              skippedSetsInSession++;
            }
          });
        });

        const activeRoutine = selectedWorkout.routineId && routines
          ? routines.find(r => r.id === selectedWorkout.routineId)
          : null;

        const skippedRoutineExercises = activeRoutine
          ? activeRoutine.exercises.filter(
              re => !selectedWorkout.exercises.some(e => e.exerciseId === re.exerciseId || e.exerciseName.toLowerCase() === re.exerciseName.toLowerCase())
            )
          : [];

        return (
          <Modal
            visible
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => setSelectedWorkout(null)}
          >
            <SafeAreaView style={styles.modalSafeArea} edges={['top', 'bottom', 'left', 'right']}>
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
                  <Ionicons name="close-circle" size={28} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Scrollable Content Container (Bento Grid + Exercises) */}
              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Bento Grid Summary Cards (2x2 Clean Balanced Layout) */}
                <View style={styles.detailBentoGrid}>
                  {/* Card 1: Süre */}
                  <View style={styles.detailBentoCard}>
                    <View style={styles.bentoIconRow}>
                      <Ionicons name="time" size={15} color="#111111" />
                      <Text style={styles.detailBentoLabel}>Süre</Text>
                    </View>
                    <Text style={styles.detailBentoVal} numberOfLines={1}>
                      {formatDuration(selectedWorkout.durationSeconds)}
                    </Text>
                  </View>

                  {/* Card 2: Hacim / Mesafe */}
                  <View style={styles.detailBentoCard}>
                    <View style={styles.bentoIconRow}>
                      <Ionicons
                        name={selectedWorkout.totalCardioDistanceKm ? "walk" : "barbell"}
                        size={15}
                        color="#111111"
                      />
                      <Text style={styles.detailBentoLabel}>
                        {selectedWorkout.totalCardioDistanceKm ? "Mesafe" : "Hacim"}
                      </Text>
                    </View>
                    <Text style={styles.detailBentoVal} numberOfLines={1}>
                      {selectedWorkout.totalCardioDistanceKm
                        ? `${selectedWorkout.totalCardioDistanceKm} km`
                        : (selectedWorkout.totalVolume || 0) > 0
                        ? `${(selectedWorkout.totalVolume || 0).toLocaleString('tr-TR')} kg`
                        : '0 kg'}
                    </Text>
                  </View>

                  {/* Card 3: Kalori */}
                  <View style={[styles.detailBentoCard, { backgroundColor: 'rgba(239, 68, 68, 0.08)' }]}>
                    <View style={styles.bentoIconRow}>
                      <Ionicons name="flame" size={15} color="#EF4444" />
                      <Text style={[styles.detailBentoLabel, { color: '#EF4444' }]}>Kalori</Text>
                    </View>
                    <Text style={[styles.detailBentoVal, { color: '#EF4444' }]} numberOfLines={1}>
                      ~{selectedWorkout.totalCaloriesBurned || 0} kcal
                    </Text>
                  </View>

                  {/* Card 4: Set Durumu */}
                  <View style={[
                    styles.detailBentoCard,
                    skippedSetsInSession > 0
                      ? { backgroundColor: 'rgba(239, 68, 68, 0.08)' }
                      : { backgroundColor: 'rgba(16, 185, 129, 0.08)' }
                  ]}>
                    <View style={styles.bentoIconRow}>
                      <Ionicons
                        name={skippedSetsInSession > 0 ? "alert-circle" : "checkmark-circle"}
                        size={15}
                        color={skippedSetsInSession > 0 ? "#EF4444" : "#10B981"}
                      />
                      <Text style={[
                        styles.detailBentoLabel,
                        { color: skippedSetsInSession > 0 ? '#EF4444' : '#10B981' }
                      ]} numberOfLines={1}>
                        {skippedSetsInSession > 0 ? `${skippedSetsInSession} Atlandı` : 'Tamamlandı'}
                      </Text>
                    </View>
                    <Text style={[
                      styles.detailBentoVal,
                      { color: skippedSetsInSession > 0 ? '#EF4444' : '#10B981' }
                    ]} numberOfLines={1}>
                      {completedSetsInSession}/{totalSetsInSession} Set
                    </Text>
                  </View>
                </View>

                <Text style={styles.sectionHeaderTitle}>EGZERSİZ VE SET DETAYLARI</Text>

                {/* Exercises & Sets Breakdown */}
                {selectedWorkout.exercises.map((ex, idx) => {
                  const isCardio = ex.category === 'Kardiyo';
                  const catColor = COLORS.category[ex.category] || COLORS.textPrimary;
                  const completedSets = ex.sets.filter(s => s.completed);
                  const skippedSetsCount = ex.sets.length - completedSets.length;
                  const isEntirelySkipped = completedSets.length === 0 && ex.sets.length > 0;

                  return (
                    <View
                      key={ex.id}
                      style={[
                        styles.modalExCard,
                        isEntirelySkipped && styles.modalExCardSkipped
                      ]}
                    >
                      <View style={styles.modalExHeader}>
                        <Text style={styles.modalExName} numberOfLines={2} ellipsizeMode="tail">
                          {idx + 1}. {ex.exerciseName}
                        </Text>

                        {isEntirelySkipped ? (
                          <View style={styles.badgeDanger}>
                            <Ionicons name="close-circle" size={12} color="#EF4444" />
                            <Text style={styles.badgeDangerText}>Yapılmadı</Text>
                          </View>
                        ) : skippedSetsCount > 0 ? (
                          <View style={styles.badgeWarning}>
                            <Ionicons name="alert-circle" size={12} color="#F59E0B" />
                            <Text style={styles.badgeWarningText}>{completedSets.length}/{ex.sets.length} Set ({skippedSetsCount} Atlandı)</Text>
                          </View>
                        ) : (
                          <View style={styles.badgeSuccess}>
                            <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                            <Text style={styles.badgeSuccessText}>%100 Tamamlandı</Text>
                          </View>
                        )}
                      </View>

                      {/* Sets Table Header */}
                      {(() => {
                        const isIso = /plank|hollow body|dead bug|bird dog|statik/i.test(ex.exerciseName) || ex.sets.some(s => s.durationSeconds !== undefined && s.durationSeconds > 0);
                        const isBw = ex.equipment === 'Vücut Ağırlığı' && !isCardio && !isIso;

                        return (
                          <>
                            <View style={styles.setTableHeader}>
                              <Text style={[styles.setTh, { width: 36 }]}>DURUM</Text>
                              <Text style={[styles.setTh, { width: 32 }]}>SET</Text>
                              {isCardio ? (
                                <>
                                  <Text style={[styles.setTh, { flex: 1, textAlign: 'center' }]}>SÜRE</Text>
                                  <Text style={[styles.setTh, { flex: 1, textAlign: 'center' }]}>MESAFE</Text>
                                  <Text style={[styles.setTh, { flex: 1, textAlign: 'right' }]}>ORT. HIZ</Text>
                                </>
                              ) : isIso ? (
                                <>
                                  <Text style={[styles.setTh, { flex: 1, textAlign: 'center' }]}>SÜRE</Text>
                                  <Text style={[styles.setTh, { width: 50, textAlign: 'right' }]}>RIR</Text>
                                </>
                              ) : (
                                <>
                                  <Text style={[styles.setTh, { flex: 1, textAlign: 'center' }]}>{isBw ? '+AĞIRLIK' : 'AĞIRLIK'}</Text>
                                  <Text style={[styles.setTh, { flex: 1, textAlign: 'center' }]}>TEKRAR</Text>
                                  <Text style={[styles.setTh, { width: 50, textAlign: 'right' }]}>RIR</Text>
                                </>
                              )}
                            </View>

                            {/* Sets Table Rows */}
                            {ex.sets.map((set, setIdx) => {
                              const isSetCompleted = set.completed;
                              const workingSetIndex = ex.sets.slice(0, setIdx + 1).filter(s => !s.isWarmup).length;
                              const setNumberDisplay = set.isWarmup ? 'W' : `#${workingSetIndex || set.setNumber}`;

                              if (isCardio) {
                                const mins = set.durationMinutes || 0;
                                const dist = set.distanceKm || 0;
                                const speed = set.avgSpeedKmh || (mins > 0 && dist > 0 ? ((dist / mins) * 60).toFixed(1) : '-');

                                return (
                                  <View key={set.id} style={[styles.setRow, !isSetCompleted && styles.setRowSkipped]}>
                                    <View style={{ width: 36, alignItems: 'center' }}>
                                      <Ionicons
                                        name={isSetCompleted ? "checkmark-circle" : "close-circle"}
                                        size={16}
                                        color={isSetCompleted ? "#10B981" : "#EF4444"}
                                      />
                                    </View>
                                    <Text style={[styles.setText, !isSetCompleted && { color: '#EF4444' }]}>#{workingSetIndex || set.setNumber}</Text>
                                    <Text style={[styles.setValue, { flex: 1, textAlign: 'center' }, !isSetCompleted && styles.setValueSkipped]}>
                                      {mins} dk
                                    </Text>
                                    <Text style={[styles.setValue, { flex: 1, textAlign: 'center' }, !isSetCompleted && styles.setValueSkipped]}>
                                      {dist} km
                                    </Text>
                                    <Text style={[styles.setValue, { flex: 1, textAlign: 'right', fontWeight: '800' }, !isSetCompleted && styles.setValueSkipped]}>
                                      {speed} km/h
                                    </Text>
                                  </View>
                                );
                              }

                              if (isIso) {
                                const secs = set.durationSeconds !== undefined ? set.durationSeconds : (set.reps || 60);

                                return (
                                  <View key={set.id} style={[styles.setRow, !isSetCompleted && styles.setRowSkipped]}>
                                    <View style={{ width: 32, alignItems: 'center' }}>
                                      <Ionicons
                                        name={isSetCompleted ? "checkmark-circle" : "close-circle"}
                                        size={16}
                                        color={isSetCompleted ? (set.isWarmup ? "#F97316" : "#10B981") : "#EF4444"}
                                      />
                                    </View>
                                    <Text style={[styles.setText, !isSetCompleted && { color: '#EF4444' }, set.isWarmup && { color: '#F97316', fontWeight: '800' }]}>
                                      {setNumberDisplay}
                                    </Text>
                                    <Text style={[styles.setValue, { flex: 1, textAlign: 'center' }, !isSetCompleted && styles.setValueSkipped]}>
                                      {secs} sn
                                    </Text>
                                    <Text style={[styles.setValue, { width: 64, textAlign: 'right', color: set.isWarmup ? '#F97316' : COLORS.textMuted }, !isSetCompleted && styles.setValueSkipped]}>
                                      {isSetCompleted ? (set.isWarmup ? 'Isınma (W)' : set.rir !== undefined ? `RIR ${set.rir}` : '-') : 'Atlandı'}
                                    </Text>
                                  </View>
                                );
                              }

                              return (
                                <View key={set.id} style={[styles.setRow, !isSetCompleted && styles.setRowSkipped, set.isWarmup && { backgroundColor: 'rgba(249, 115, 22, 0.05)' }]}>
                                  <View style={{ width: 32, alignItems: 'center' }}>
                                    <Ionicons
                                      name={isSetCompleted ? "checkmark-circle" : "close-circle"}
                                      size={16}
                                      color={isSetCompleted ? (set.isWarmup ? "#F97316" : "#10B981") : "#EF4444"}
                                    />
                                  </View>
                                  <Text style={[styles.setText, !isSetCompleted && { color: '#EF4444' }, set.isWarmup && { color: '#F97316', fontWeight: '800' }]}>
                                    {setNumberDisplay}
                                  </Text>
                                  <Text style={[styles.setValue, { flex: 1, textAlign: 'center' }, !isSetCompleted && styles.setValueSkipped]}>
                                    {isBw && set.weight === 0 ? 'Vücut Ağ.' : `${isBw && set.weight > 0 ? '+' : ''}${set.weight} kg`}
                                  </Text>
                                  <Text style={[styles.setValue, { flex: 1, textAlign: 'center' }, !isSetCompleted && styles.setValueSkipped]}>
                                    {set.reps} tekrar
                                  </Text>
                                  <Text style={[styles.setValue, { width: 64, textAlign: 'right', color: set.isWarmup ? '#F97316' : COLORS.textMuted }, !isSetCompleted && styles.setValueSkipped]}>
                                    {isSetCompleted ? (set.isWarmup ? 'Isınma (W)' : set.rir !== undefined ? `RIR ${set.rir}` : '-') : 'Atlandı'}
                                  </Text>
                                </View>
                              );
                            })}
                          </>
                        );
                      })()}
                    </View>
                  );
                })}

                {/* Skipped Routine Exercises Section */}
                {skippedRoutineExercises.length > 0 && (
                  <View style={styles.skippedRoutineSection}>
                    <View style={styles.skippedSectionHeaderRow}>
                      <Ionicons name="alert-circle" size={18} color="#EF4444" />
                      <Text style={styles.skippedSectionHeaderTitle}>ATLANAN RUTİN EGZERSİZLERİ ({skippedRoutineExercises.length})</Text>
                    </View>
                    {skippedRoutineExercises.map(re => (
                      <View key={re.exerciseId} style={styles.skippedExCard}>
                        <View style={styles.skippedExHeader}>
                          <Text style={styles.skippedExName}>{re.exerciseName}</Text>
                          <View style={styles.badgeDanger}>
                            <Text style={styles.badgeDangerText}>Programda Vardı / Yapılmadı</Text>
                          </View>
                        </View>
                        <Text style={styles.skippedExSub}>
                          Program Hedefi: {re.targetWarmupSets ? `${re.targetWarmupSets}W + ` : ''}{re.targetSets} Set x {re.targetReps} Tekrar {re.targetWeight ? `• ${re.targetWeight} kg` : ''}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
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
                  style={styles.editWorkoutModalBtn}
                  onPress={() => {
                    const w = selectedWorkout;
                    setSelectedWorkout(null);
                    setWorkoutToEdit(w);
                  }}
                >
                  <Ionicons name="pencil-outline" size={16} color="#111111" />
                  <Text style={styles.editWorkoutModalText}>Düzenle</Text>
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
                  <Text style={styles.reuseBtnText}>Tekrar Yap</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </Modal>
        );
      })()}
    </View>
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
    gap: 12,
  },
  headerLeft: {
    flexShrink: 1,
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
    flexShrink: 0,
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
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editCardBtn: {
    padding: 6,
    borderRadius: 100,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
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
    flexShrink: 1,
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
  modalSafeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalHeaderLeft: {
    flex: 1,
    gap: 2,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  modalSub: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  modalCloseBtn: {
    padding: 2,
  },
  detailBentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 16,
  },
  detailBentoCard: {
    width: '48.5%',
    backgroundColor: COLORS.surfaceSubtle,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    gap: 6,
    minHeight: 70,
  },
  bentoIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailBentoVal: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  detailBentoLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '700',
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 4,
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
    gap: 8,
  },
  modalExName: {
    flex: 1,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  modalCatBadge: {
    flexShrink: 0,
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
    gap: 12,
    padding: 16,
    backgroundColor: COLORS.surface,
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
  exSummaryItemSkipped: {
    color: '#EF4444',
  },
  modalExCardSkipped: {
    backgroundColor: 'rgba(239, 68, 68, 0.04)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  badgeSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
  },
  badgeSuccessText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '700',
  },
  badgeWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
  },
  badgeWarningText: {
    color: '#F59E0B',
    fontSize: 10,
    fontWeight: '700',
  },
  badgeDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
  },
  badgeDangerText: {
    color: '#EF4444',
    fontSize: 10,
    fontWeight: '700',
  },
  setRowSkipped: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: 8,
    paddingHorizontal: 4,
    marginVertical: 2,
  },
  setValueSkipped: {
    color: COLORS.textMuted,
    textDecorationLine: 'line-through',
  },
  skippedTag: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  skippedTagText: {
    color: '#EF4444',
    fontSize: 9,
    fontWeight: '800',
  },
  skippedRoutineSection: {
    marginTop: 16,
    gap: 8,
  },
  skippedSectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  skippedSectionHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#EF4444',
    letterSpacing: 0.8,
  },
  skippedExCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderStyle: 'dashed',
    gap: 4,
  },
  skippedExHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skippedExName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  skippedExSub: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  editWorkoutModalBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  editWorkoutModalText: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
});
