import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, useTheme, subscribeTheme } from '../theme';
import { Routine, WorkoutSession } from '../types/fitness';
import { RoutineBuilderModal } from '../components/RoutineBuilderModal';
import { DraggableList, DragGripHandle } from '../components/DraggableList';
import { getLocalDateString } from '../services/storage';
import { getAppSettings } from '../services/settings';
import { isIsometricExerciseName } from '../utils/exerciseHelpers';

interface WorkoutTabProps {
  routines: Routine[];
  activeSession: WorkoutSession | null;
  onStartSession: (session: WorkoutSession) => void;
  onOpenActiveSession: () => void;
  onSaveRoutine: (routine: Routine) => void;
  onReorderRoutines: (routines: Routine[]) => void;
  onDeleteRoutine: (id: string) => void;
}

export const WorkoutTab: React.FC<WorkoutTabProps> = ({
  routines,
  activeSession,
  onStartSession,
  onOpenActiveSession,
  onSaveRoutine,
  onReorderRoutines,
  onDeleteRoutine,
}) => {
  useTheme();
  const insets = useSafeAreaInsets();
  const [showRoutineBuilder, setShowRoutineBuilder] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [selectedRoutineForMenu, setSelectedRoutineForMenu] = useState<Routine | null>(null);
  const [deletingRoutine, setDeletingRoutine] = useState<Routine | null>(null);
  const [isDraggingRoutine, setIsDraggingRoutine] = useState(false);

  const handleReorder = useCallback(
    (nextRoutines: Routine[]) => {
      onReorderRoutines(nextRoutines);
    },
    [onReorderRoutines]
  );

  const handleStartFreestyle = () => {
    const session: WorkoutSession = {
      id: `session_${Date.now()}`,
      name: 'Serbest Antrenman',
      date: getLocalDateString(),
      startTime: Date.now(),
      durationSeconds: 0,
      exercises: [],
      totalVolume: 0,
      totalSets: 0,
      completed: false,
    };
    onStartSession(session);
  };

  const handleStartRoutine = async (routine: Routine) => {
    const settings = await getAppSettings();
    const defaultRir = settings.defaultRir ?? 1;
    const now = Date.now();
    const exercises = routine.exercises.map((rEx, idx) => {
      const isCardio = rEx.category === 'Kardiyo';
      const isIso =
        !isCardio &&
        (isIsometricExerciseName(rEx.exerciseName) || !!rEx.targetDurationSeconds);
      const warmupCount = rEx.targetWarmupSets || 0;

      const warmupSets = Array.from({ length: warmupCount }, (_, i) => ({
        id: `set_${idx}_w_${i}_${now}`,
        setNumber: i + 1,
        weight: 0,
        reps: isCardio || isIso ? 0 : rEx.targetReps || 10,
        rir: undefined,
        isWarmup: true,
        durationSeconds: isIso ? rEx.targetDurationSeconds || 60 : undefined,
        durationMinutes: isCardio ? rEx.targetDurationMinutes || 15 : undefined,
        distanceKm: isCardio ? rEx.targetDistanceKm || 2.5 : undefined,
        completed: false,
      }));

      const workingSets = Array.from({ length: rEx.targetSets }, (_, i) => ({
        id: `set_${idx}_${i}_${now}`,
        setNumber: i + 1,
        weight: rEx.targetWeight || 0,
        reps: isCardio || isIso ? 0 : rEx.targetReps || 10,
        rir: isCardio ? undefined : rEx.targetRir ?? defaultRir,
        isWarmup: false,
        durationSeconds: isIso ? rEx.targetDurationSeconds || 60 : undefined,
        durationMinutes: isCardio ? rEx.targetDurationMinutes || 15 : undefined,
        distanceKm: isCardio ? rEx.targetDistanceKm || 2.5 : undefined,
        completed: false,
      }));

      return {
        id: `wex_${idx}_${now}`,
        exerciseId: rEx.exerciseId,
        exerciseName: rEx.exerciseName,
        category: rEx.category,
        equipment: rEx.equipment,
        sets: [...warmupSets, ...workingSets],
      };
    });

    const session: WorkoutSession = {
      id: `session_${now}`,
      name: routine.name,
      routineId: routine.id,
      date: getLocalDateString(),
      startTime: now,
      durationSeconds: 0,
      exercises,
      totalVolume: 0,
      totalSets: 0,
      completed: false,
    };

    onStartSession(session);
  };

  const handleOpenEdit = (routine: Routine) => {
    setSelectedRoutineForMenu(null);
    setEditingRoutine(routine);
    setShowRoutineBuilder(true);
  };

  const handleDeletePrompt = (routine: Routine) => {
    setSelectedRoutineForMenu(null);
    setDeletingRoutine(routine);
  };

  const confirmDeleteRoutine = () => {
    if (deletingRoutine) {
      onDeleteRoutine(deletingRoutine.id);
      setDeletingRoutine(null);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      scrollEnabled={!isDraggingRoutine}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: 120 + Math.max(insets.bottom, 16) },
      ]}
    >
      {/* Active Session Sticky Banner */}
      {activeSession && (
        <TouchableOpacity
          style={styles.activeBanner}
          activeOpacity={0.85}
          onPress={onOpenActiveSession}
        >
          <View style={styles.activeBannerLeft}>
            <View style={[styles.activePulseDot, { backgroundColor: COLORS.pastel.green }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.activeTitle}>DEVAM EDEN ANTRENMAN</Text>
              <Text style={styles.activeSubtitle} numberOfLines={1}>
                {activeSession.name}
              </Text>
            </View>
          </View>

          <View style={styles.activeBannerRight}>
            <Text style={styles.resumeText}>Devam Et</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.primaryText} />
          </View>
        </TouchableOpacity>
      )}

      {/* Compact Quick-Start Bar */}
      <View style={styles.quickStartCard}>
        <View style={styles.quickStartLeft}>
          <Text style={styles.kicker}>HIZLI BAŞLAT</Text>
          <Text style={styles.quickStartTitle}>Serbest Antrenman</Text>
          <Text style={styles.quickStartSub} numberOfLines={1}>
            Program seçmeden anında kaydet
          </Text>
        </View>

        <TouchableOpacity
          style={styles.quickStartBtn}
          activeOpacity={0.85}
          onPress={handleStartFreestyle}
        >
          <Ionicons name="flash-outline" size={15} color={COLORS.primaryText} />
          <Text style={styles.quickStartBtnText}>Başlat</Text>
        </TouchableOpacity>
      </View>

      {/* Routine Section Header */}
      <View style={styles.sectionHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>Programlarım</Text>
          {routines.length > 1 && (
            <Text style={styles.sectionSubtitle}>Sıralamak için tutamaçtan sürükle</Text>
          )}
        </View>

        <TouchableOpacity
          style={styles.createRoutineBtn}
          onPress={() => {
            setEditingRoutine(null);
            setShowRoutineBuilder(true);
          }}
        >
          <Ionicons name="add" size={15} color={COLORS.primaryText} />
          <Text style={styles.createRoutineBtnText}>Yeni Program</Text>
        </TouchableOpacity>
      </View>

      {/* Draggable Routines List */}
      <DraggableList
        items={routines}
        keyExtractor={r => r.id}
        onReorder={handleReorder}
        onDragStateChange={setIsDraggingRoutine}
        gap={9}
        renderItem={({ item: routine, isDragging, dragHandleProps }) => {
          const totalSets = (routine.exercises ?? []).reduce((sum, e) => sum + (e.targetSets || 0), 0);
          return (
            <View style={[styles.routineCard, isDragging && styles.routineCardDragging]}>
              <View style={styles.routineHeader}>
                {routines.length > 1 && (
                  <DragGripHandle dragHandleProps={dragHandleProps} isDragging={isDragging} />
                )}

                <View style={styles.routineTitleLeft}>
                  <Text style={styles.routineName} numberOfLines={1} ellipsizeMode="tail">
                    {routine.name}
                  </Text>
                  <View style={styles.routineMetaRow}>
                    <View
                      style={[
                        styles.routineTag,
                        { backgroundColor: COLORS.pastel.blueBg },
                      ]}
                    >
                      <Text style={[styles.routineTagText, { color: COLORS.pastel.blue }]}>
                        {routine.category}
                      </Text>
                    </View>
                    <Text style={styles.routineMetaCount}>
                      {routine.exercises.length} hareket · {totalSets} set
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.dotsMenuBtn}
                  onPress={() => setSelectedRoutineForMenu(routine)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="ellipsis-horizontal" size={18} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Show description only when no exercise pills are present (avoids repeating exercise names) */}
              {!!routine.description && routine.exercises.length === 0 && (
                <Text style={styles.routineDesc} numberOfLines={1}>
                  {routine.description}
                </Text>
              )}

              {/* Compact Exercise preview pills */}
              {routine.exercises.length > 0 && (
                <View style={styles.exercisesPreview}>
                  {routine.exercises.slice(0, 4).map((ex, idx) => {
                    const isCardio = ex.category === 'Kardiyo';
                    const isIso =
                      !isCardio &&
                      (isIsometricExerciseName(ex.exerciseName) || !!ex.targetDurationSeconds);
                    const detail = isCardio
                      ? `${ex.targetDurationMinutes || 15} dk${ex.targetDistanceKm ? ` · ${ex.targetDistanceKm} km` : ''}`
                      : isIso
                      ? `${ex.targetSets}×${ex.targetDurationSeconds || 60} sn`
                      : `${ex.targetWarmupSets ? `${ex.targetWarmupSets}W+` : ''}${ex.targetSets}×${ex.targetReps}`;

                    return (
                      <View key={idx} style={styles.exPill}>
                        <Text style={styles.exPillText} numberOfLines={1}>
                          {ex.exerciseName} ({detail})
                        </Text>
                      </View>
                    );
                  })}
                  {routine.exercises.length > 4 && (
                    <View style={styles.exPillMore}>
                      <Text style={styles.exPillMoreText}>+{routine.exercises.length - 4}</Text>
                    </View>
                  )}
                </View>
              )}

              <TouchableOpacity
                style={styles.startRoutineBtn}
                activeOpacity={0.85}
                onPress={() => handleStartRoutine(routine)}
              >
                <Ionicons name="play" size={13} color={COLORS.primaryText} />
                <Text style={styles.startRoutineBtnText}>Programı Başlat</Text>
              </TouchableOpacity>
            </View>
          );
        }}
      />

      {/* 3-Dots Action Sheet Modal */}
      {selectedRoutineForMenu && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedRoutineForMenu(null)}
        >
          <TouchableOpacity
            style={styles.actionModalOverlay}
            activeOpacity={1}
            onPress={() => setSelectedRoutineForMenu(null)}
          >
            <TouchableOpacity
              style={styles.actionSheetContainer}
              activeOpacity={1}
              onPress={e => e.stopPropagation()}
            >
              <Text style={styles.actionSheetTitle}>{selectedRoutineForMenu.name}</Text>

              <TouchableOpacity
                style={styles.actionSheetItem}
                onPress={() => handleOpenEdit(selectedRoutineForMenu)}
              >
                <Ionicons name="create-outline" size={19} color={COLORS.textPrimary} />
                <Text style={styles.actionSheetText}>Programı Düzenle</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionSheetItem, { backgroundColor: COLORS.pastel.roseBg, borderColor: 'transparent' }]}
                onPress={() => handleDeletePrompt(selectedRoutineForMenu)}
              >
                <Ionicons name="trash-outline" size={19} color={COLORS.pastel.rose} />
                <Text style={[styles.actionSheetText, { color: COLORS.pastel.rose }]}>
                  Programı Sil
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionSheetCancel}
                onPress={() => setSelectedRoutineForMenu(null)}
              >
                <Text style={styles.actionSheetCancelText}>İptal</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Routine Deletion Confirmation Modal */}
      {deletingRoutine && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setDeletingRoutine(null)}
        >
          <TouchableOpacity
            style={styles.actionModalOverlay}
            activeOpacity={1}
            onPress={() => setDeletingRoutine(null)}
          >
            <TouchableOpacity
              style={styles.actionSheetContainer}
              activeOpacity={1}
              onPress={e => e.stopPropagation()}
            >
              <View style={{ alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Ionicons name="trash-outline" size={28} color={COLORS.pastel.rose} />
                <Text style={styles.actionSheetTitle}>Programı Sil</Text>
                <Text style={{ fontSize: 13, color: COLORS.textMuted, textAlign: 'center' }}>
                  "{deletingRoutine.name}" programını silmek istediğinize emin misiniz?
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.actionSheetItem,
                  { backgroundColor: COLORS.pastel.roseBg, borderColor: COLORS.pastel.rose },
                ]}
                onPress={confirmDeleteRoutine}
              >
                <Ionicons name="trash" size={17} color={COLORS.pastel.rose} />
                <Text style={[styles.actionSheetText, { color: COLORS.pastel.rose }]}>
                  Evet, Programı Sil
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionSheetCancel}
                onPress={() => setDeletingRoutine(null)}
              >
                <Text style={styles.actionSheetCancelText}>Vazgeç</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}

      <RoutineBuilderModal
        visible={showRoutineBuilder}
        initialRoutine={editingRoutine}
        onClose={() => {
          setShowRoutineBuilder(false);
          setEditingRoutine(null);
        }}
        onSave={routine => {
          onSaveRoutine(routine);
          setEditingRoutine(null);
        }}
      />
    </ScrollView>
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
      gap: 11,
    },
    activeBanner: {
      backgroundColor: COLORS.surfaceElevated,
      borderRadius: 9,
      padding: 12,
      borderWidth: 1,
      borderColor: COLORS.borderDark,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    activeBannerLeft: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingRight: 10,
    },
    activePulseDot: {
      width: 9,
      height: 9,
      borderRadius: 5,
    },
    activeTitle: {
      color: COLORS.textMuted,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.6,
    },
    activeSubtitle: {
      color: COLORS.textPrimary,
      fontSize: 14,
      fontWeight: '700',
    },
    activeBannerRight: {
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: COLORS.primary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
    },
    resumeText: {
      color: COLORS.primaryText,
      fontWeight: '700',
      fontSize: 12,
    },
    quickStartCard: {
      backgroundColor: COLORS.surfaceSubtle,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: COLORS.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    quickStartLeft: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    kicker: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.7,
      color: COLORS.textMuted,
    },
    quickStartTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: COLORS.textPrimary,
      letterSpacing: -0.2,
    },
    quickStartSub: {
      fontSize: 12,
      color: COLORS.textSecondary,
    },
    quickStartBtn: {
      backgroundColor: COLORS.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 7,
      flexShrink: 0,
    },
    quickStartBtnText: {
      color: COLORS.primaryText,
      fontSize: 13,
      fontWeight: '800',
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 2,
      gap: 8,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: COLORS.textPrimary,
      letterSpacing: -0.2,
    },
    sectionSubtitle: {
      fontSize: 11,
      color: COLORS.textMuted,
      marginTop: 1,
    },
    createRoutineBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: COLORS.primary,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 6,
    },
    createRoutineBtnText: {
      color: COLORS.primaryText,
      fontWeight: '700',
      fontSize: 12,
    },
    routineCard: {
      backgroundColor: COLORS.surface,
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: COLORS.border,
      gap: 8,
    },
    routineCardDragging: {
      borderColor: COLORS.primary,
      backgroundColor: COLORS.surfaceElevated,
    },
    routineHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
    },
    routineTitleLeft: {
      flex: 1,
      minWidth: 0,
      gap: 4,
    },
    routineName: {
      flexShrink: 1,
      fontSize: 15,
      fontWeight: '800',
      color: COLORS.textPrimary,
      lineHeight: 20,
    },
    routineMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    routineTag: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 5,
    },
    routineTagText: {
      fontSize: 11,
      fontWeight: '700',
    },
    routineMetaCount: {
      fontSize: 11,
      color: COLORS.textMuted,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
    },
    dotsMenuBtn: {
      flexShrink: 0,
      padding: 6,
      borderRadius: 6,
    },
    routineDesc: {
      fontSize: 12,
      color: COLORS.textSecondary,
      lineHeight: 16,
    },
    exercisesPreview: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 5,
    },
    exPill: {
      backgroundColor: COLORS.surfaceSubtle,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 5,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    exPillText: {
      fontSize: 11,
      color: COLORS.textSecondary,
      fontWeight: '500',
    },
    exPillMore: {
      backgroundColor: COLORS.surfaceSubtle,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 5,
      borderWidth: 1,
      borderColor: COLORS.borderDark,
    },
    exPillMoreText: {
      fontSize: 11,
      color: COLORS.textPrimary,
      fontWeight: '700',
    },
    startRoutineBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: COLORS.primary,
      paddingVertical: 9,
      borderRadius: 7,
      marginTop: 1,
    },
    startRoutineBtnText: {
      color: COLORS.primaryText,
      fontWeight: '800',
      fontSize: 12,
    },
    actionModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
      padding: 16,
      paddingBottom: 40,
    },
    actionSheetContainer: {
      backgroundColor: COLORS.surface,
      borderRadius: 10,
      padding: 18,
      borderWidth: 1,
      borderColor: COLORS.border,
      gap: 10,
    },
    actionSheetTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: COLORS.textPrimary,
      textAlign: 'center',
      marginBottom: 4,
    },
    actionSheetItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: COLORS.surfaceSubtle,
      paddingVertical: 13,
      paddingHorizontal: 14,
      borderRadius: 7,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    actionSheetText: {
      fontSize: 14,
      fontWeight: '700',
      color: COLORS.textPrimary,
    },
    actionSheetCancel: {
      alignItems: 'center',
      paddingVertical: 12,
      marginTop: 2,
    },
    actionSheetCancelText: {
      fontSize: 14,
      fontWeight: '600',
      color: COLORS.textMuted,
    },
  });

let styles = createStyles();
subscribeTheme(() => {
  styles = createStyles();
});
