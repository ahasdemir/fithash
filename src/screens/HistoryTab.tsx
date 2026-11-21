import React, { useState, useCallback, useMemo } from 'react';
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
import { COLORS, SHADOWS, useTheme, subscribeTheme } from '../theme';
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

const WorkoutHistoryCard = React.memo(function WorkoutHistoryCard({
  session,
  onOpenDetail,
  onRequestDelete,
}: WorkoutHistoryCardProps) {
  const hasVolume = (session.totalVolume || 0) > 0;
  const hasCalories = (session.totalCaloriesBurned || 0) > 0;
  const hasCardioDist = (session.totalCardioDistanceKm || 0) > 0;

  const totSets = session.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
  const compSets = session.exercises.reduce(
    (sum, ex) => sum + ex.sets.filter(s => s.completed).length,
    0
  );
  const skippedSets = totSets - compSets;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.dateText}>{session.date}</Text>
          {skippedSets > 0 ? (
            <View style={[styles.statusChip, { backgroundColor: COLORS.pastel.roseBg }]}>
              <Text style={[styles.statusChipText, { color: COLORS.pastel.rose }]}>
                {skippedSets} atlandı
              </Text>
            </View>
          ) : totSets > 0 ? (
            <View style={[styles.statusChip, { backgroundColor: COLORS.pastel.greenBg }]}>
              <Text style={[styles.statusChipText, { color: COLORS.pastel.green }]}>
                %100 tamam
              </Text>
            </View>
          ) : null}
        </View>

        <TouchableOpacity
          style={styles.trashBtn}
          onPress={() => onRequestDelete(session)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="trash-outline" size={16} color={COLORS.pastel.rose} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity activeOpacity={0.82} onPress={() => onOpenDetail(session)}>
        <Text style={styles.sessionName} numberOfLines={2} ellipsizeMode="tail">
          {session.name}
        </Text>

        {/* Clean Tabular Metadata Row */}
        <View style={styles.metaStrip}>
          <View style={styles.metaItem}>
            <Text style={styles.metaVal}>{formatDuration(session.durationSeconds)}</Text>
            <Text style={styles.metaLbl}>Süre</Text>
          </View>

          {hasVolume && (
            <>
              <View style={styles.metaDivider} />
              <View style={styles.metaItem}>
                <Text style={styles.metaVal}>
                  {session.totalVolume >= 1000
                    ? `${(session.totalVolume / 1000).toFixed(1)} t`
                    : `${session.totalVolume} kg`}
                </Text>
                <Text style={styles.metaLbl}>Hacim</Text>
              </View>
            </>
          )}

          {totSets > 0 && (
            <>
              <View style={styles.metaDivider} />
              <View style={styles.metaItem}>
                <Text style={styles.metaVal}>
                  {compSets}/{totSets}
                </Text>
                <Text style={styles.metaLbl}>Set</Text>
              </View>
            </>
          )}

          {hasCardioDist && (
            <>
              <View style={styles.metaDivider} />
              <View style={styles.metaItem}>
                <Text style={[styles.metaVal, { color: COLORS.pastel.cyan }]}>
                  {session.totalCardioDistanceKm} km
                </Text>
                <Text style={styles.metaLbl}>Mesafe</Text>
              </View>
            </>
          )}

          {hasCalories && !hasCardioDist && (
            <>
              <View style={styles.metaDivider} />
              <View style={styles.metaItem}>
                <Text style={[styles.metaVal, { color: COLORS.pastel.rose }]}>
                  {session.totalCaloriesBurned}
                </Text>
                <Text style={styles.metaLbl}>kcal</Text>
              </View>
            </>
          )}
        </View>

        {/* Compact Exercise Preview (max 4 inline lines) */}
        <View style={styles.exSummaryList}>
          {session.exercises.slice(0, 4).map(ex => {
            const isCardio = ex.category === 'Kardiyo';
            const completedSets = ex.sets.filter(s => s.completed);
            const totalDist = completedSets.reduce((sum, s) => sum + (s.distanceKm || 0), 0);
            const totalMins = completedSets.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
            const isSkipped = completedSets.length === 0 && ex.sets.length > 0;

            return (
              <View key={ex.id} style={styles.exSummaryRow}>
                <Text
                  style={[styles.exSummaryName, isSkipped && styles.exSummaryItemSkipped]}
                  numberOfLines={1}
                >
                  {ex.exerciseName}
                </Text>
                <Text style={[styles.exSummaryCount, isSkipped && styles.exSummaryItemSkipped]}>
                  {isCardio
                    ? `${totalMins > 0 ? `${totalMins} dk` : ''}${totalDist > 0 ? ` · ${totalDist} km` : ''}`
                    : `${completedSets.length}/${ex.sets.length} set`}
                </Text>
              </View>
            );
          })}
          {session.exercises.length > 4 && (
            <Text style={styles.moreExText}>+{session.exercises.length - 4} hareket daha</Text>
          )}
        </View>

        <View style={styles.cardFooterHint}>
          <Text style={styles.cardFooterHintText}>Detay &amp; düzenleme</Text>
          <Ionicons name="chevron-forward" size={14} color={COLORS.textMuted} />
        </View>
      </TouchableOpacity>
    </View>
  );
});

const HistoryCardSeparator = () => <View style={styles.cardSeparator} />;

export const HistoryTab: React.FC<HistoryTabProps> = ({
  workouts,
  routines = [],
  onDeleteWorkout,
  onReuseWorkout,
  onUpdateWorkout,
}) => {
  useTheme();
  const insets = useSafeAreaInsets();
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutSession | null>(null);
  const [workoutToDelete, setWorkoutToDelete] = useState<WorkoutSession | null>(null);
  const [workoutToEdit, setWorkoutToEdit] = useState<WorkoutSession | null>(null);

  const historySummary = useMemo(() => {
    const now = new Date();
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    let thisMonthCount = 0;
    let totalVolKg = 0;

    workouts.forEach(w => {
      if (w.completed === false) return;
      if (w.date?.startsWith(monthPrefix)) thisMonthCount++;
      totalVolKg += w.totalVolume || 0;
    });

    return {
      totalCount: workouts.length,
      thisMonthCount,
      totalVolLabel:
        totalVolKg >= 1000 ? `${(totalVolKg / 1000).toFixed(1)} t` : `${totalVolKg} kg`,
    };
  }, [workouts]);

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
    [handleOpenDetail, handleRequestDelete]
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
        removeClippedSubviews={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 120 + Math.max(insets.bottom, 16) },
        ]}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                <Text style={styles.title}>Geçmiş</Text>
                <Text style={styles.subtitle}>Tamamlanan antrenman ve kardiyo kayıtları</Text>
              </View>
            </View>

            {workouts.length > 0 && (
              <View style={styles.summaryStrip}>
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryKicker}>TOPLAM</Text>
                  <Text style={styles.summaryVal}>{historySummary.totalCount}</Text>
                </View>
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryKicker}>BU AY</Text>
                  <Text style={[styles.summaryVal, { color: COLORS.pastel.green }]}>
                    {historySummary.thisMonthCount}
                  </Text>
                </View>
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryKicker}>TONAJ</Text>
                  <Text style={styles.summaryVal}>{historySummary.totalVolLabel}</Text>
                </View>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="journal-outline" size={44} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>Henüz kayıtlı antrenman yok</Text>
            <Text style={styles.emptySub}>
              Tamamladığınız antrenmanlar otomatik olarak burada listelenir.
            </Text>
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
              <Ionicons
                name="trash-bin-outline"
                size={28}
                color={COLORS.pastel.rose}
                style={{ alignSelf: 'center' }}
              />
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

                <TouchableOpacity style={styles.confirmDeleteBtn} onPress={handleConfirmDelete}>
                  <Text style={styles.confirmDeleteText}>Evet, Sil</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Edit Workout Modal */}
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

      {/* WORKOUT DETAIL MODAL */}
      {selectedWorkout &&
        (() => {
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

          const activeRoutine =
            selectedWorkout.routineId && routines
              ? routines.find(r => r.id === selectedWorkout.routineId)
              : null;

          const skippedRoutineExercises = activeRoutine
            ? activeRoutine.exercises.filter(
                re =>
                  !selectedWorkout.exercises.some(
                    e =>
                      e.exerciseId === re.exerciseId ||
                      e.exerciseName.toLowerCase() === re.exerciseName.toLowerCase()
                  )
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
                <View style={styles.modalHeader}>
                  <View style={styles.modalHeaderLeft}>
                    <Text style={styles.modalTitle} numberOfLines={2}>
                      {selectedWorkout.name}
                    </Text>
                    <Text style={styles.modalSub}>{selectedWorkout.date}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.modalCloseBtn}
                    onPress={() => setSelectedWorkout(null)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close" size={20} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={styles.modalScroll}
                  contentContainerStyle={[
                    styles.modalScrollContent,
                    { paddingBottom: Math.max(insets.bottom, 20) + 60 },
                  ]}
                  showsVerticalScrollIndicator={false}
                >
                  {/* 2x2 Summary Grid */}
                  <View style={styles.detailBentoGrid}>
                    <View style={styles.detailBentoCard}>
                      <Text style={styles.detailBentoLabel}>SÜRE</Text>
                      <Text style={styles.detailBentoVal} numberOfLines={1}>
                        {formatDuration(selectedWorkout.durationSeconds)}
                      </Text>
                    </View>

                    <View style={styles.detailBentoCard}>
                      <Text style={styles.detailBentoLabel}>
                        {selectedWorkout.totalCardioDistanceKm ? 'MESAFE' : 'HACİM'}
                      </Text>
                      <Text style={styles.detailBentoVal} numberOfLines={1}>
                        {selectedWorkout.totalCardioDistanceKm
                          ? `${selectedWorkout.totalCardioDistanceKm} km`
                          : (selectedWorkout.totalVolume || 0) > 0
                          ? `${(selectedWorkout.totalVolume || 0).toLocaleString('tr-TR')} kg`
                          : '0 kg'}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.detailBentoCard,
                        { backgroundColor: COLORS.pastel.roseBg, borderColor: 'transparent' },
                      ]}
                    >
                      <Text style={[styles.detailBentoLabel, { color: COLORS.pastel.rose }]}>
                        KALORİ
                      </Text>
                      <Text
                        style={[styles.detailBentoVal, { color: COLORS.pastel.rose }]}
                        numberOfLines={1}
                      >
                        ~{selectedWorkout.totalCaloriesBurned || 0} kcal
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.detailBentoCard,
                        skippedSetsInSession > 0
                          ? { backgroundColor: COLORS.pastel.roseBg, borderColor: 'transparent' }
                          : { backgroundColor: COLORS.pastel.greenBg, borderColor: 'transparent' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.detailBentoLabel,
                          {
                            color:
                              skippedSetsInSession > 0
                                ? COLORS.pastel.rose
                                : COLORS.pastel.green,
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {skippedSetsInSession > 0
                          ? `${skippedSetsInSession} ATLANDI`
                          : 'TAMAMLANDI'}
                      </Text>
                      <Text
                        style={[
                          styles.detailBentoVal,
                          {
                            color:
                              skippedSetsInSession > 0
                                ? COLORS.pastel.rose
                                : COLORS.pastel.green,
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {completedSetsInSession}/{totalSetsInSession} set
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.sectionHeaderTitle}>EGZERSİZ VE SET DETAYLARI</Text>

                  {selectedWorkout.exercises.map((ex, idx) => {
                    const isCardio = ex.category === 'Kardiyo';
                    const completedSets = ex.sets.filter(s => s.completed);
                    const skippedSetsCount = ex.sets.length - completedSets.length;
                    const isEntirelySkipped = completedSets.length === 0 && ex.sets.length > 0;

                    return (
                      <View
                        key={ex.id}
                        style={[
                          styles.modalExCard,
                          isEntirelySkipped && styles.modalExCardSkipped,
                        ]}
                      >
                        <View style={styles.modalExHeader}>
                          <Text style={styles.modalExName} numberOfLines={2} ellipsizeMode="tail">
                            {idx + 1}. {ex.exerciseName}
                          </Text>

                          {isEntirelySkipped ? (
                            <View
                              style={[
                                styles.statusChip,
                                { backgroundColor: COLORS.pastel.roseBg },
                              ]}
                            >
                              <Text
                                style={[styles.statusChipText, { color: COLORS.pastel.rose }]}
                              >
                                Yapılmadı
                              </Text>
                            </View>
                          ) : skippedSetsCount > 0 ? (
                            <View
                              style={[
                                styles.statusChip,
                                { backgroundColor: COLORS.pastel.amberBg },
                              ]}
                            >
                              <Text
                                style={[styles.statusChipText, { color: COLORS.pastel.amber }]}
                              >
                                {completedSets.length}/{ex.sets.length} set
                              </Text>
                            </View>
                          ) : (
                            <View
                              style={[
                                styles.statusChip,
                                { backgroundColor: COLORS.pastel.greenBg },
                              ]}
                            >
                              <Text
                                style={[styles.statusChipText, { color: COLORS.pastel.green }]}
                              >
                                %100
                              </Text>
                            </View>
                          )}
                        </View>

                        {(() => {
                          const isIso =
                            /plank|hollow body|dead bug|bird dog|statik/i.test(ex.exerciseName) ||
                            ex.sets.some(
                              s => s.durationSeconds !== undefined && s.durationSeconds > 0
                            );
                          const isBw =
                            ex.equipment === 'Vücut Ağırlığı' && !isCardio && !isIso;

                          return (
                            <>
                              <View style={styles.setTableHeader}>
                                <Text style={[styles.setTh, { width: 32 }]}>DURUM</Text>
                                <Text style={[styles.setTh, { width: 34 }]}>SET</Text>
                                {isCardio ? (
                                  <>
                                    <Text style={[styles.setTh, { flex: 1, textAlign: 'center' }]}>
                                      SÜRE
                                    </Text>
                                    <Text style={[styles.setTh, { flex: 1, textAlign: 'center' }]}>
                                      MESAFE
                                    </Text>
                                    <Text style={[styles.setTh, { flex: 1, textAlign: 'right' }]}>
                                      ORT. HIZ
                                    </Text>
                                  </>
                                ) : isIso ? (
                                  <>
                                    <Text style={[styles.setTh, { flex: 1, textAlign: 'center' }]}>
                                      SÜRE
                                    </Text>
                                    <Text style={[styles.setTh, { width: 64, textAlign: 'right' }]}>
                                      RIR
                                    </Text>
                                  </>
                                ) : (
                                  <>
                                    <Text style={[styles.setTh, { flex: 1, textAlign: 'center' }]}>
                                      {isBw ? '+AĞIRLIK' : 'AĞIRLIK'}
                                    </Text>
                                    <Text style={[styles.setTh, { flex: 1, textAlign: 'center' }]}>
                                      TEKRAR
                                    </Text>
                                    <Text style={[styles.setTh, { width: 64, textAlign: 'right' }]}>
                                      RIR
                                    </Text>
                                  </>
                                )}
                              </View>

                              {ex.sets.map((set, setIdx) => {
                                const isSetCompleted = set.completed;
                                const workingSetIndex = ex.sets
                                  .slice(0, setIdx + 1)
                                  .filter(s => !s.isWarmup).length;
                                const setNumberDisplay = set.isWarmup
                                  ? 'W'
                                  : `#${workingSetIndex || set.setNumber}`;

                                if (isCardio) {
                                  const mins = set.durationMinutes || 0;
                                  const dist = set.distanceKm || 0;
                                  const speed =
                                    set.avgSpeedKmh ||
                                    (mins > 0 && dist > 0
                                      ? ((dist / mins) * 60).toFixed(1)
                                      : '-');

                                  return (
                                    <View
                                      key={set.id}
                                      style={[styles.setRow, !isSetCompleted && styles.setRowSkipped]}
                                    >
                                      <View style={{ width: 32, alignItems: 'center' }}>
                                        <Ionicons
                                          name={
                                            isSetCompleted ? 'checkmark-circle' : 'close-circle'
                                          }
                                          size={15}
                                          color={
                                            isSetCompleted
                                              ? COLORS.pastel.green
                                              : COLORS.pastel.rose
                                          }
                                        />
                                      </View>
                                      <Text
                                        style={[
                                          styles.setText,
                                          !isSetCompleted && { color: COLORS.pastel.rose },
                                        ]}
                                      >
                                        #{workingSetIndex || set.setNumber}
                                      </Text>
                                      <Text
                                        style={[
                                          styles.setValue,
                                          { flex: 1, textAlign: 'center' },
                                          !isSetCompleted && styles.setValueSkipped,
                                        ]}
                                      >
                                        {mins} dk
                                      </Text>
                                      <Text
                                        style={[
                                          styles.setValue,
                                          { flex: 1, textAlign: 'center' },
                                          !isSetCompleted && styles.setValueSkipped,
                                        ]}
                                      >
                                        {dist} km
                                      </Text>
                                      <Text
                                        style={[
                                          styles.setValue,
                                          { flex: 1, textAlign: 'right', fontWeight: '700' },
                                          !isSetCompleted && styles.setValueSkipped,
                                        ]}
                                      >
                                        {speed} km/h
                                      </Text>
                                    </View>
                                  );
                                }

                                if (isIso) {
                                  const secs =
                                    set.durationSeconds !== undefined
                                      ? set.durationSeconds
                                      : set.reps || 60;

                                  return (
                                    <View
                                      key={set.id}
                                      style={[styles.setRow, !isSetCompleted && styles.setRowSkipped]}
                                    >
                                      <View style={{ width: 32, alignItems: 'center' }}>
                                        <Ionicons
                                          name={
                                            isSetCompleted ? 'checkmark-circle' : 'close-circle'
                                          }
                                          size={15}
                                          color={
                                            isSetCompleted
                                              ? set.isWarmup
                                                ? COLORS.pastel.amber
                                                : COLORS.pastel.green
                                              : COLORS.pastel.rose
                                          }
                                        />
                                      </View>
                                      <Text
                                        style={[
                                          styles.setText,
                                          !isSetCompleted && { color: COLORS.pastel.rose },
                                          set.isWarmup && {
                                            color: COLORS.pastel.amber,
                                            fontWeight: '800',
                                          },
                                        ]}
                                      >
                                        {setNumberDisplay}
                                      </Text>
                                      <Text
                                        style={[
                                          styles.setValue,
                                          { flex: 1, textAlign: 'center' },
                                          !isSetCompleted && styles.setValueSkipped,
                                        ]}
                                      >
                                        {secs} sn
                                      </Text>
                                      <Text
                                        style={[
                                          styles.setValue,
                                          {
                                            width: 64,
                                            textAlign: 'right',
                                            color: set.isWarmup
                                              ? COLORS.pastel.amber
                                              : COLORS.textMuted,
                                          },
                                          !isSetCompleted && styles.setValueSkipped,
                                        ]}
                                      >
                                        {isSetCompleted
                                          ? set.isWarmup
                                            ? 'Isınma'
                                            : set.rir !== undefined
                                            ? `RIR ${set.rir}`
                                            : '-'
                                          : 'Atlandı'}
                                      </Text>
                                    </View>
                                  );
                                }

                                return (
                                  <View
                                    key={set.id}
                                    style={[
                                      styles.setRow,
                                      !isSetCompleted && styles.setRowSkipped,
                                      set.isWarmup && { backgroundColor: COLORS.pastel.amberBg },
                                    ]}
                                  >
                                    <View style={{ width: 32, alignItems: 'center' }}>
                                      <Ionicons
                                        name={isSetCompleted ? 'checkmark-circle' : 'close-circle'}
                                        size={15}
                                        color={
                                          isSetCompleted
                                            ? set.isWarmup
                                              ? COLORS.pastel.amber
                                              : COLORS.pastel.green
                                            : COLORS.pastel.rose
                                        }
                                      />
                                    </View>
                                    <Text
                                      style={[
                                        styles.setText,
                                        !isSetCompleted && { color: COLORS.pastel.rose },
                                        set.isWarmup && {
                                          color: COLORS.pastel.amber,
                                          fontWeight: '800',
                                        },
                                      ]}
                                    >
                                      {setNumberDisplay}
                                    </Text>
                                    <Text
                                      style={[
                                        styles.setValue,
                                        { flex: 1, textAlign: 'center' },
                                        !isSetCompleted && styles.setValueSkipped,
                                      ]}
                                    >
                                      {isBw && set.weight === 0
                                        ? 'Vücut Ağ.'
                                        : `${isBw && set.weight > 0 ? '+' : ''}${set.weight} kg`}
                                    </Text>
                                    <Text
                                      style={[
                                        styles.setValue,
                                        { flex: 1, textAlign: 'center' },
                                        !isSetCompleted && styles.setValueSkipped,
                                      ]}
                                    >
                                      {set.reps} rep
                                    </Text>
                                    <Text
                                      style={[
                                        styles.setValue,
                                        {
                                          width: 64,
                                          textAlign: 'right',
                                          color: set.isWarmup
                                            ? COLORS.pastel.amber
                                            : COLORS.textMuted,
                                        },
                                        !isSetCompleted && styles.setValueSkipped,
                                      ]}
                                    >
                                      {isSetCompleted
                                        ? set.isWarmup
                                          ? 'Isınma'
                                          : set.rir !== undefined
                                          ? `RIR ${set.rir}`
                                          : '-'
                                        : 'Atlandı'}
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

                  {skippedRoutineExercises.length > 0 && (
                    <View style={styles.skippedRoutineSection}>
                      <Text style={styles.skippedSectionHeaderTitle}>
                        ATLANAN RUTİN EGZERSİZLERİ ({skippedRoutineExercises.length})
                      </Text>
                      {skippedRoutineExercises.map(re => (
                        <View key={re.exerciseId} style={styles.skippedExCard}>
                          <View style={styles.skippedExHeader}>
                            <Text style={styles.skippedExName}>{re.exerciseName}</Text>
                            <View
                              style={[
                                styles.statusChip,
                                { backgroundColor: COLORS.pastel.roseBg },
                              ]}
                            >
                              <Text
                                style={[styles.statusChipText, { color: COLORS.pastel.rose }]}
                              >
                                Yapılmadı
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.skippedExSub}>
                            Hedef: {re.targetWarmupSets ? `${re.targetWarmupSets}W + ` : ''}
                            {re.targetSets}×{re.targetReps}
                            {re.targetWeight ? ` · ${re.targetWeight} kg` : ''}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </ScrollView>

                <View style={styles.modalFooterRow}>
                  <TouchableOpacity
                    style={styles.deleteWorkoutModalBtn}
                    onPress={() => {
                      const w = selectedWorkout;
                      setSelectedWorkout(null);
                      setWorkoutToDelete(w);
                    }}
                  >
                    <Ionicons name="trash-outline" size={16} color={COLORS.pastel.rose} />
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
                    <Ionicons name="refresh" size={15} color={COLORS.primaryText} />
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

const createStyles = () =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    content: {
      padding: 16,
    },
    headerBlock: {
      gap: 12,
      marginBottom: 14,
    },
    cardSeparator: {
      height: 10,
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
      fontSize: 19,
      fontWeight: '800',
      color: COLORS.textPrimary,
      letterSpacing: -0.3,
    },
    subtitle: {
      fontSize: 11.5,
      color: COLORS.textMuted,
      marginTop: 1,
    },
    summaryStrip: {
      flexDirection: 'row',
      gap: 8,
    },
    summaryBox: {
      flex: 1,
      backgroundColor: COLORS.surface,
      borderRadius: 8,
      paddingVertical: 10,
      paddingHorizontal: 11,
      borderWidth: 1,
      borderColor: COLORS.border,
      gap: 2,
    },
    summaryKicker: {
      fontSize: 9.5,
      fontWeight: '700',
      letterSpacing: 0.7,
      color: COLORS.textMuted,
    },
    summaryVal: {
      fontSize: 16,
      fontWeight: '800',
      color: COLORS.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    card: {
      backgroundColor: COLORS.surface,
      borderRadius: 10,
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
    },
    cardHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    dateText: {
      color: COLORS.textMuted,
      fontSize: 11.5,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
    },
    statusChip: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 4,
    },
    statusChipText: {
      fontSize: 10,
      fontWeight: '700',
    },
    trashBtn: {
      padding: 5,
      borderRadius: 6,
      backgroundColor: COLORS.pastel.roseBg,
    },
    sessionName: {
      fontSize: 15.5,
      fontWeight: '800',
      color: COLORS.textPrimary,
      marginBottom: 8,
      letterSpacing: -0.2,
    },
    metaStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: COLORS.surfaceSubtle,
      borderRadius: 7,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: COLORS.border,
      marginBottom: 8,
    },
    metaItem: {
      flex: 1,
      alignItems: 'center',
      gap: 1,
    },
    metaVal: {
      fontSize: 12.5,
      fontWeight: '800',
      color: COLORS.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    metaLbl: {
      fontSize: 10,
      color: COLORS.textMuted,
      fontWeight: '500',
    },
    metaDivider: {
      width: 1,
      height: 22,
      backgroundColor: COLORS.border,
    },
    exSummaryList: {
      gap: 4,
    },
    exSummaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    exSummaryName: {
      flex: 1,
      fontSize: 12,
      color: COLORS.textSecondary,
    },
    exSummaryCount: {
      fontSize: 11,
      color: COLORS.textMuted,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
    },
    moreExText: {
      fontSize: 11,
      color: COLORS.textMuted,
      marginTop: 2,
    },
    exSummaryItemSkipped: {
      color: COLORS.pastel.rose,
    },
    cardFooterHint: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 10,
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
      fontSize: 15,
      fontWeight: '700',
    },
    emptySub: {
      color: COLORS.textMuted,
      fontSize: 12.5,
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
      borderRadius: 10,
      padding: 22,
      margin: 20,
      alignSelf: 'center',
      width: '90%',
      borderWidth: 1,
      borderColor: COLORS.border,
      gap: 12,
    },
    deleteConfirmTitle: {
      fontSize: 17,
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
      gap: 10,
      marginTop: 6,
    },
    cancelDeleteBtn: {
      flex: 1,
      paddingVertical: 11,
      alignItems: 'center',
      borderRadius: 6,
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
      paddingVertical: 11,
      alignItems: 'center',
      borderRadius: 6,
      backgroundColor: COLORS.pastel.roseBg,
      borderWidth: 1,
      borderColor: COLORS.pastel.rose,
    },
    confirmDeleteText: {
      color: COLORS.pastel.rose,
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
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: COLORS.surface,
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
    },
    modalSub: {
      fontSize: 12,
      color: COLORS.textMuted,
      fontWeight: '500',
      fontVariant: ['tabular-nums'],
    },
    modalCloseBtn: {
      width: 32,
      height: 32,
      borderRadius: 6,
      backgroundColor: COLORS.surfaceSubtle,
      borderWidth: 1,
      borderColor: COLORS.border,
      alignItems: 'center',
      justifyContent: 'center',
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
      paddingVertical: 11,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: COLORS.border,
      justifyContent: 'center',
      gap: 3,
    },
    detailBentoVal: {
      fontSize: 16,
      fontWeight: '800',
      color: COLORS.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    detailBentoLabel: {
      fontSize: 10,
      color: COLORS.textMuted,
      fontWeight: '700',
      letterSpacing: 0.6,
    },
    modalScroll: {
      flex: 1,
    },
    modalScrollContent: {
      padding: 16,
      paddingBottom: 40,
    },
    sectionHeaderTitle: {
      fontSize: 10,
      fontWeight: '700',
      color: COLORS.textMuted,
      letterSpacing: 0.7,
      marginBottom: 10,
      marginTop: 4,
    },
    modalExCard: {
      backgroundColor: COLORS.surface,
      borderRadius: 9,
      padding: 13,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    modalExCardSkipped: {
      backgroundColor: COLORS.pastel.roseBg,
      borderColor: COLORS.pastel.rose,
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
      fontSize: 14,
      fontWeight: '700',
      color: COLORS.textPrimary,
    },
    setTableHeader: {
      flexDirection: 'row',
      paddingVertical: 4,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
      marginBottom: 4,
    },
    setTh: {
      fontSize: 9.5,
      fontWeight: '700',
      color: COLORS.textMuted,
    },
    setRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 5,
      borderRadius: 5,
    },
    setRowSkipped: {
      backgroundColor: COLORS.pastel.roseBg,
      paddingHorizontal: 4,
      marginVertical: 2,
    },
    setText: {
      width: 34,
      color: COLORS.textMuted,
      fontSize: 12,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
    },
    setValue: {
      color: COLORS.textPrimary,
      fontWeight: '600',
      fontSize: 12,
      fontVariant: ['tabular-nums'],
    },
    setValueSkipped: {
      color: COLORS.textMuted,
      textDecorationLine: 'line-through',
    },
    skippedRoutineSection: {
      marginTop: 12,
      gap: 8,
    },
    skippedSectionHeaderTitle: {
      fontSize: 10,
      fontWeight: '700',
      color: COLORS.pastel.rose,
      letterSpacing: 0.7,
    },
    skippedExCard: {
      backgroundColor: COLORS.pastel.roseBg,
      borderRadius: 8,
      padding: 12,
      borderWidth: 1,
      borderColor: COLORS.pastel.rose,
      borderStyle: 'dashed',
      gap: 4,
    },
    skippedExHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    skippedExName: {
      fontSize: 13.5,
      fontWeight: '700',
      color: COLORS.textPrimary,
    },
    skippedExSub: {
      fontSize: 11.5,
      color: COLORS.textSecondary,
    },
    modalFooterRow: {
      flexDirection: 'row',
      gap: 10,
      padding: 14,
      backgroundColor: COLORS.surface,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
    },
    deleteWorkoutModalBtn: {
      backgroundColor: COLORS.pastel.roseBg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderRadius: 6,
    },
    deleteWorkoutModalText: {
      color: COLORS.pastel.rose,
      fontWeight: '700',
      fontSize: 13,
    },
    editWorkoutModalBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      backgroundColor: COLORS.surfaceSubtle,
      borderRadius: 6,
      paddingVertical: 11,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    editWorkoutModalText: {
      color: COLORS.textPrimary,
      fontWeight: '700',
      fontSize: 13,
    },
    reuseBtn: {
      flex: 1,
      backgroundColor: COLORS.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 11,
      borderRadius: 6,
    },
    reuseBtnText: {
      color: COLORS.primaryText,
      fontWeight: '800',
      fontSize: 13,
    },
  });

let styles = createStyles();
subscribeTheme(() => {
  styles = createStyles();
});
