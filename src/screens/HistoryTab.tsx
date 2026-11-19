import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  FlatList,
  ListRenderItem,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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

const formatDuration = (secs: number) => {
  const mins = Math.floor(secs / 60);
  return `${mins} dk`;
};

interface WorkoutHistoryCardProps {
  session: WorkoutSession;
  onOpenDetail: (session: WorkoutSession) => void;
  onRequestDelete: (session: WorkoutSession) => void;
}

// Memoized list row: HistoryTab re-renders on every modal open/close
// (selectedWorkout / workoutToDelete / workoutToEdit state changes), and this
// lets the mounted rows skip re-rendering when only that lightweight state changed.
const WorkoutHistoryCard = React.memo(function WorkoutHistoryCard({
  session,
  onOpenDetail,
  onRequestDelete,
}: WorkoutHistoryCardProps) {
  const hasVolume = (session.totalVolume || 0) > 0;
  const hasCalories = (session.totalCaloriesBurned || 0) > 0;
  const hasCardioDist = (session.totalCardioDistanceKm || 0) > 0;

  const totSets = session.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
  const compSets = session.exercises.reduce((sum, ex) => sum + ex.sets.filter(s => s.completed).length, 0);
  const skippedSets = totSets - compSets;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Ionicons name="calendar" size={13} color={COLORS.primary} />
          <Text style={styles.dateText}>{session.date}</Text>
        </View>

        <TouchableOpacity
          style={styles.trashBtn}
          onPress={() => onRequestDelete(session)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => onOpenDetail(session)}
      >
        <Text style={styles.sessionName} numberOfLines={2} ellipsizeMode="tail">{session.name}</Text>

        {/* Dynamic Metric Badges */}
        <View style={styles.statsRow}>
          {hasVolume && (
            <View style={styles.badgePill}>
              <Ionicons name="barbell" size={11} color={COLORS.primary} />
              <Text style={styles.badgeText}>{session.totalVolume.toLocaleString('tr-TR')} kg</Text>
            </View>
          )}

          {hasCalories && (
            <View style={[styles.badgePill, { backgroundColor: 'rgba(248, 113, 113, 0.12)', borderColor: 'rgba(248, 113, 113, 0.35)' }]}>
              <Ionicons name="flame" size={11} color={COLORS.danger} />
              <Text style={[styles.badgeText, { color: COLORS.danger }]}>
                ~{session.totalCaloriesBurned} kcal
              </Text>
            </View>
          )}

          {hasCardioDist && (
            <View style={[styles.badgePill, { backgroundColor: 'rgba(76, 194, 255, 0.12)', borderColor: 'rgba(76, 194, 255, 0.35)' }]}>
              <Ionicons name="walk" size={11} color={COLORS.primary} />
              <Text style={[styles.badgeText, { color: COLORS.primary }]}>
                {session.totalCardioDistanceKm} km
              </Text>
            </View>
          )}

          <View style={styles.badgePill}>
            <Ionicons name="time" size={11} color={COLORS.textSecondary} />
            <Text style={styles.badgeText}>{formatDuration(session.durationSeconds)}</Text>
          </View>

          {skippedSets > 0 ? (
            <View style={[styles.badgePill, { backgroundColor: 'rgba(248, 113, 113, 0.12)', borderColor: 'rgba(248, 113, 113, 0.35)' }]}>
              <Ionicons name="alert-circle" size={11} color={COLORS.danger} />
              <Text style={[styles.badgeText, { color: COLORS.danger }]}>{skippedSets} Set Atlandı</Text>
            </View>
          ) : totSets > 0 ? (
            <View style={[styles.badgePill, { backgroundColor: 'rgba(52, 211, 153, 0.12)', borderColor: 'rgba(52, 211, 153, 0.35)' }]}>
              <Ionicons name="checkmark-circle" size={11} color={COLORS.success} />
              <Text style={[styles.badgeText, { color: COLORS.success }]}>%100 Tamamlandı</Text>
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
          <Ionicons name="chevron-forward" size={13} color={COLORS.textMuted} />
        </View>
      </TouchableOpacity>
    </View>
  );
});

// Rendered by FlatList between (and only between) two workout cards.
const HistoryCardSeparator = () => <View style={styles.cardSeparator} />;

export const HistoryTab: React.FC<HistoryTabProps> = ({
  workouts,
  routines = [],
  onDeleteWorkout,
  onReuseWorkout,
  onUpdateWorkout,
}) => {
  const insets = useSafeAreaInsets();
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutSession | null>(null);
  const [workoutToDelete, setWorkoutToDelete] = useState<WorkoutSession | null>(null);
  const [workoutToEdit, setWorkoutToEdit] = useState<WorkoutSession | null>(null);

  const handleOpenDetail = useCallback((session: WorkoutSession) => {
    setSelectedWorkout(session);
  }, []);

  const handleRequestDelete = useCallback((session: WorkoutSession) => {
    setWorkoutToDelete(session);
  }, []);

  const keyExtractor = useCallback((session: WorkoutSession) => session.id, []);

  const renderWorkoutCard = useCallback<ListRenderItem<WorkoutSession>>(
    ({ item }) => (
      <WorkoutHistoryCard
        session={item}
        onOpenDetail={handleOpenDetail}
        onRequestDelete={handleRequestDelete}
      />
    ),
    [handleOpenDetail, handleRequestDelete],
  );

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
      <FlatList
        style={styles.container}
        data={workouts}
        keyExtractor={keyExtractor}
        renderItem={renderWorkoutCard}
        ItemSeparatorComponent={HistoryCardSeparator}
        // Explicitly opt out of Android's removeClippedSubviews default:
        // the previous ScrollView never clipped, and variable-height shadowed
        // cards are a known blank-row risk when clipping is enabled.
        removeClippedSubviews={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 110 + Math.max(insets.bottom, 14) },
        ]}
        ListHeaderComponent={
          <View style={[styles.headerRow, styles.headerRowMargin]}>
            <View style={styles.headerLeft}>
              <Text style={styles.title}>Geçmiş Antrenmanlar</Text>
              <Text style={styles.subtitle}>Tarihsel saklanan antrenman ve kardiyo kayıtları</Text>
            </View>

            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{workouts.length} Kayıt</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="journal-outline" size={40} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>Henüz kayıtlı antrenman yok</Text>
            <Text style={styles.emptySub}>Tamamladığınız antrenmanlar otomatik olarak buraya listelenecektir.</Text>
          </View>
        }
      />

      {/* Delete Confirmation Modal */}
      {workoutToDelete && (
        <Modal visible transparent animationType="fade">
          <TouchableOpacity
            style={styles.overlay}
            activeOpacity={1}
            onPress={() => setWorkoutToDelete(null)}
          >
            <View style={styles.deleteConfirmBox}>
              <Ionicons name="trash-bin-outline" size={28} color={COLORS.danger} style={{ alignSelf: 'center' }} />
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
                  <Ionicons name="close-circle" size={26} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Scrollable Content Container (Bento Grid + Exercises) */}
              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={[
                  styles.modalScrollContent,
                  { paddingBottom: Math.max(insets.bottom, 16) + 56 },
                ]}
                showsVerticalScrollIndicator={false}
              >
                {/* Bento Grid Summary Cards (2x2 Clean Balanced Layout) */}
                <View style={styles.detailBentoGrid}>
                  {/* Card 1: Süre */}
                  <View style={styles.detailBentoCard}>
                    <View style={styles.bentoIconRow}>
                      <Ionicons name="time" size={14} color={COLORS.primary} />
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
                        size={14}
                        color={COLORS.primary}
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
                  <View style={[styles.detailBentoCard, { backgroundColor: 'rgba(248, 113, 113, 0.08)', borderColor: 'rgba(248, 113, 113, 0.35)' }]}>
                    <View style={styles.bentoIconRow}>
                      <Ionicons name="flame" size={14} color={COLORS.danger} />
                      <Text style={[styles.detailBentoLabel, { color: COLORS.danger }]}>Kalori</Text>
                    </View>
                    <Text style={[styles.detailBentoVal, { color: COLORS.danger }]} numberOfLines={1}>
                      ~{selectedWorkout.totalCaloriesBurned || 0} kcal
                    </Text>
                  </View>

                  {/* Card 4: Set Durumu */}
                  <View style={[
                    styles.detailBentoCard,
                    skippedSetsInSession > 0
                      ? { backgroundColor: 'rgba(248, 113, 113, 0.08)', borderColor: 'rgba(248, 113, 113, 0.35)' }
                      : { backgroundColor: 'rgba(52, 211, 153, 0.08)', borderColor: 'rgba(52, 211, 153, 0.35)' }
                  ]}>
                    <View style={styles.bentoIconRow}>
                      <Ionicons
                        name={skippedSetsInSession > 0 ? "alert-circle" : "checkmark-circle"}
                        size={14}
                        color={skippedSetsInSession > 0 ? COLORS.danger : COLORS.success}
                      />
                      <Text style={[
                        styles.detailBentoLabel,
                        { color: skippedSetsInSession > 0 ? COLORS.danger : COLORS.success }
                      ]} numberOfLines={1}>
                        {skippedSetsInSession > 0 ? `${skippedSetsInSession} Atlandı` : 'Tamamlandı'}
                      </Text>
                    </View>
                    <Text style={[
                      styles.detailBentoVal,
                      { color: skippedSetsInSession > 0 ? COLORS.danger : COLORS.success }
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
                            <Ionicons name="close-circle" size={11} color={COLORS.danger} />
                            <Text style={styles.badgeDangerText}>Yapılmadı</Text>
                          </View>
                        ) : skippedSetsCount > 0 ? (
                          <View style={styles.badgeWarning}>
                            <Ionicons name="alert-circle" size={11} color={COLORS.warning} />
                            <Text style={styles.badgeWarningText}>{completedSets.length}/{ex.sets.length} Set ({skippedSetsCount} Atlandı)</Text>
                          </View>
                        ) : (
                          <View style={styles.badgeSuccess}>
                            <Ionicons name="checkmark-circle" size={11} color={COLORS.success} />
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
                              <Text style={[styles.setTh, { width: 34 }]}>DURUM</Text>
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
                                    <View style={{ width: 34, alignItems: 'center' }}>
                                      <Ionicons
                                        name={isSetCompleted ? "checkmark-circle" : "close-circle"}
                                        size={15}
                                        color={isSetCompleted ? COLORS.success : COLORS.danger}
                                      />
                                    </View>
                                    <Text style={[styles.setText, !isSetCompleted && { color: COLORS.danger }]}>#{workingSetIndex || set.setNumber}</Text>
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
                                        size={15}
                                        color={isSetCompleted ? (set.isWarmup ? "#F97316" : COLORS.success) : COLORS.danger}
                                      />
                                    </View>
                                    <Text style={[styles.setText, !isSetCompleted && { color: COLORS.danger }, set.isWarmup && { color: '#F97316', fontWeight: '800' }]}>
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
                                <View key={set.id} style={[styles.setRow, !isSetCompleted && styles.setRowSkipped, set.isWarmup && { backgroundColor: 'rgba(249, 115, 22, 0.06)' }]}>
                                  <View style={{ width: 32, alignItems: 'center' }}>
                                    <Ionicons
                                      name={isSetCompleted ? "checkmark-circle" : "close-circle"}
                                      size={15}
                                      color={isSetCompleted ? (set.isWarmup ? "#F97316" : COLORS.success) : COLORS.danger}
                                    />
                                  </View>
                                  <Text style={[styles.setText, !isSetCompleted && { color: COLORS.danger }, set.isWarmup && { color: '#F97316', fontWeight: '800' }]}>
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
                      <Ionicons name="alert-circle" size={16} color={COLORS.danger} />
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
                  <Ionicons name="trash-outline" size={15} color={COLORS.danger} />
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
                  <Ionicons name="pencil-outline" size={15} color={COLORS.textPrimary} />
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
                  <Ionicons name="refresh" size={15} color={COLORS.textInverted} />
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
    padding: 12,
  },
  // The old ScrollView content used `gap: 16` between the header and the list;
  // FlatList content children are the rows themselves, so the same spacing is
  // reproduced with a header margin + a fixed-height ItemSeparatorComponent.
  headerRowMargin: {
    marginBottom: 12,
  },
  cardSeparator: {
    height: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerLeft: {
    flexShrink: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  countBadge: {
    flexShrink: 0,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  countBadgeText: {
    color: COLORS.primary,
    fontWeight: '800',
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
    ...SHADOWS.soft,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trashBtn: {
    padding: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.25)',
  },
  dateText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  sessionName: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginVertical: 2,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  badgeText: {
    color: COLORS.textPrimary,
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  exSummaryList: {
    marginTop: 6,
    gap: 3,
  },
  exSummaryItem: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
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
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  emptySub: {
    color: COLORS.textMuted,
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 250,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(6, 12, 18, 0.78)',
    justifyContent: 'flex-end',
  },
  deleteConfirmBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 18,
    margin: 16,
    alignSelf: 'center',
    width: '92%',
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    gap: 10,
    ...SHADOWS.medium,
  },
  deleteConfirmTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  deleteConfirmSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 17,
  },
  deleteConfirmBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  cancelDeleteBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelDeleteText: {
    color: COLORS.textSecondary,
    fontWeight: '700',
    fontSize: 13,
  },
  confirmDeleteBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: COLORS.danger,
  },
  confirmDeleteText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalHeaderLeft: {
    flex: 1,
    gap: 2,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  modalSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  modalCloseBtn: {
    padding: 2,
  },
  detailBentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 14,
  },
  detailBentoCard: {
    width: '48.5%',
    backgroundColor: COLORS.surface,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    gap: 4,
    minHeight: 62,
  },
  bentoIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  detailBentoVal: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  detailBentoLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 12,
    paddingBottom: 32,
  },
  sectionHeaderTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 2,
  },
  modalExCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalExHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  modalExName: {
    flex: 1,
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  modalCatBadge: {
    flexShrink: 0,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
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
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.4,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceSubtle,
  },
  setText: {
    width: 34,
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  setValue: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  modalFooterRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  deleteWorkoutModalBtn: {
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  deleteWorkoutModalText: {
    color: COLORS.danger,
    fontWeight: '800',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  reuseBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  reuseBtnText: {
    color: COLORS.textInverted,
    fontWeight: '800',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  exSummaryItemSkipped: {
    color: COLORS.danger,
  },
  modalExCardSkipped: {
    backgroundColor: 'rgba(248, 113, 113, 0.05)',
    borderColor: 'rgba(248, 113, 113, 0.35)',
  },
  badgeSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeSuccessText: {
    color: COLORS.success,
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  badgeWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeWarningText: {
    color: COLORS.warning,
    fontSize: 9,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  badgeDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.35)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeDangerText: {
    color: COLORS.danger,
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  setRowSkipped: {
    backgroundColor: 'rgba(248, 113, 113, 0.08)',
    borderRadius: 4,
    paddingHorizontal: 4,
    marginVertical: 1,
  },
  setValueSkipped: {
    color: COLORS.textMuted,
    textDecorationLine: 'line-through',
  },
  skippedTag: {
    backgroundColor: 'rgba(248, 113, 113, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  skippedTagText: {
    color: COLORS.danger,
    fontSize: 9,
    fontWeight: '800',
  },
  skippedRoutineSection: {
    marginTop: 12,
    gap: 6,
  },
  skippedSectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  skippedSectionHeaderTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.danger,
    letterSpacing: 0.8,
  },
  skippedExCard: {
    backgroundColor: 'rgba(248, 113, 113, 0.06)',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.3)',
    borderStyle: 'dashed',
    gap: 4,
  },
  skippedExHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skippedExName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  skippedExSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontVariant: ['tabular-nums'],
  },
  editWorkoutModalBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 8,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
  },
  editWorkoutModalText: {
    color: COLORS.textPrimary,
    fontWeight: '800',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});
