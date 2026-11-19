import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SHADOWS } from '../theme';
import { Routine, WorkoutSession } from '../types/fitness';
import { RoutineBuilderModal } from '../components/RoutineBuilderModal';
import { getExercises, getLocalDateString } from '../services/storage';

interface WorkoutTabProps {
  routines: Routine[];
  activeSession: WorkoutSession | null;
  onStartSession: (session: WorkoutSession) => void;
  onOpenActiveSession: () => void;
  onSaveRoutine: (routine: Routine) => void;
  onReorderRoutines: (routines: Routine[]) => void;
  onDeleteRoutine: (id: string) => void;
  workouts?: WorkoutSession[];
  workoutDays?: number[];
  onOpenStreak?: () => void;
}

export const WorkoutTab: React.FC<WorkoutTabProps> = ({
  routines,
  activeSession,
  onStartSession,
  onOpenActiveSession,
  onSaveRoutine,
  onReorderRoutines,
  onDeleteRoutine,
  workouts = [],
  workoutDays = [1, 2, 3, 4, 5, 6],
  onOpenStreak,
}) => {
  const insets = useSafeAreaInsets();
  const [showRoutineBuilder, setShowRoutineBuilder] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [selectedRoutineForMenu, setSelectedRoutineForMenu] = useState<Routine | null>(null);
  const [deletingRoutine, setDeletingRoutine] = useState<Routine | null>(null);
  const [isReorderMode, setIsReorderMode] = useState(false);

  const handleMoveRoutine = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= routines.length) return;
    const copy = [...routines];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;
    onReorderRoutines(copy);
  };

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
    const allExercises = await getExercises();

    const exercises = routine.exercises.map((rEx, idx) => {
      const exObj = allExercises.find(e => e.id === rEx.exerciseId);
      const isCardio = rEx.category === 'Kardiyo' || exObj?.category === 'Kardiyo';
      const isIso = /plank|hollow body|dead bug|bird dog|statik/i.test(rEx.exerciseName) || !!rEx.targetDurationSeconds;
      const warmupCount = rEx.targetWarmupSets || 0;

      const warmupSets = Array.from({ length: warmupCount }, (_, i) => ({
        id: `set_${idx}_w_${i}_${Date.now()}`,
        setNumber: i + 1,
        weight: 0,
        reps: rEx.targetReps || (isCardio || isIso ? 0 : 10),
        rir: undefined,
        isWarmup: true,
        durationSeconds: isIso ? (rEx.targetDurationSeconds || 60) : undefined,
        durationMinutes: isCardio ? (rEx.targetDurationMinutes || 15) : undefined,
        distanceKm: isCardio ? (rEx.targetDistanceKm || 2.5) : undefined,
        completed: false,
      }));

      const workingSets = Array.from({ length: rEx.targetSets }, (_, i) => ({
        id: `set_${idx}_${i}_${Date.now()}`,
        setNumber: i + 1,
        weight: rEx.targetWeight || 0,
        reps: rEx.targetReps || (isCardio || isIso ? 0 : 10),
        rir: isCardio ? undefined : (rEx.targetRir ?? 1),
        isWarmup: false,
        durationSeconds: isIso ? (rEx.targetDurationSeconds || 60) : undefined,
        durationMinutes: isCardio ? (rEx.targetDurationMinutes || 15) : undefined,
        distanceKm: isCardio ? (rEx.targetDistanceKm || 2.5) : undefined,
        completed: false,
      }));

      return {
        id: `wex_${idx}_${Date.now()}`,
        exerciseId: rEx.exerciseId,
        exerciseName: rEx.exerciseName,
        category: rEx.category,
        equipment: rEx.equipment,
        sets: [...warmupSets, ...workingSets],
      };
    });

    const session: WorkoutSession = {
      id: `session_${Date.now()}`,
      name: routine.name,
      routineId: routine.id,
      date: getLocalDateString(),
      startTime: Date.now(),
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
      contentContainerStyle={[
        styles.content,
        { paddingBottom: 110 + Math.max(insets.bottom, 14) },
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
            <View style={styles.activePulseDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.activeTitle}>Devam Eden Antrenman</Text>
              <Text style={styles.activeSubtitle} numberOfLines={1}>{activeSession.name}</Text>
            </View>
          </View>

          <View style={styles.activeBannerRight}>
            <Text style={styles.resumeText}>Devam Et</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.textInverted} />
          </View>
        </TouchableOpacity>
      )}

      {/* Hero Bento Card */}
      <View style={styles.heroCard}>
        <View style={styles.heroBadge}>
          <Text style={styles.heroBadgeText}>Hızlı Kayıt</Text>
        </View>

        <View style={styles.heroTextContainer}>
          <Text style={styles.heroTitle}>Bugünkü Antrenmanını Kaydet</Text>
          <Text style={styles.heroSubtitle}>
            Serbest antrenman başlat veya aşağıdan hazır günlük rutinlerinden birini seç.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.startFreestyleBtn}
          activeOpacity={0.85}
          onPress={handleStartFreestyle}
        >
          <Ionicons name="flash" size={16} color={COLORS.textInverted} />
          <Text style={styles.startFreestyleBtnText}>Serbest Antrenman Başlat</Text>
        </TouchableOpacity>
      </View>

      {/* Routine Section Header */}
      <View style={styles.sectionHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>Antrenman Programlarım</Text>
          {isReorderMode && (
            <Text style={styles.sectionSubtitle}>Sıralamak için okları kullanın</Text>
          )}
        </View>

        <View style={styles.headerBtnGroup}>
          {routines.length > 1 && (
            <TouchableOpacity
              style={[styles.reorderToggleBtn, isReorderMode && styles.reorderToggleBtnActive]}
              onPress={() => setIsReorderMode(!isReorderMode)}
            >
              <Ionicons
                name={isReorderMode ? 'checkmark' : 'swap-vertical'}
                size={13}
                color={isReorderMode ? COLORS.textInverted : COLORS.textPrimary}
              />
              <Text style={[styles.reorderToggleBtnText, isReorderMode && styles.reorderToggleBtnTextActive]}>
                {isReorderMode ? 'Tamam' : 'Sırala'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.createRoutineBtn}
            onPress={() => {
              setEditingRoutine(null);
              setShowRoutineBuilder(true);
            }}
          >
            <Ionicons name="add" size={14} color={COLORS.textInverted} />
            <Text style={styles.createRoutineBtnText}>Yeni Program</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Routines Bento Grid */}
      <View style={styles.routinesList}>
        {routines.map((routine, index) => (
          <View key={routine.id} style={styles.routineCard}>
            <View style={styles.routineHeader}>
              <View style={styles.routineTitleLeft}>
                <Text style={styles.routineName} numberOfLines={2} ellipsizeMode="tail">{routine.name}</Text>
                <View style={styles.routineTag}>
                  <Text style={styles.routineTagText}>{routine.category}</Text>
                </View>
              </View>

              <View style={styles.routineHeaderRight}>
                {isReorderMode && routines.length > 1 && (
                  <View style={styles.reorderPill}>
                    <TouchableOpacity
                      style={[styles.reorderPillBtn, index === 0 && styles.reorderPillBtnDisabled]}
                      disabled={index === 0}
                      onPress={() => handleMoveRoutine(index, -1)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="chevron-up" size={14} color={index === 0 ? COLORS.textMuted : COLORS.textPrimary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.reorderPillBtn, index === routines.length - 1 && styles.reorderPillBtnDisabled]}
                      disabled={index === routines.length - 1}
                      onPress={() => handleMoveRoutine(index, 1)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="chevron-down" size={14} color={index === routines.length - 1 ? COLORS.textMuted : COLORS.textPrimary} />
                    </TouchableOpacity>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.dotsMenuBtn}
                  onPress={() => setSelectedRoutineForMenu(routine)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="ellipsis-horizontal" size={18} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.routineDesc}>{routine.description}</Text>

            {/* Exercise preview pills */}
            <View style={styles.exercisesPreview}>
              {routine.exercises.slice(0, 4).map((ex, idx) => (
                <View key={idx} style={styles.exPill}>
                  <Text style={styles.exPillText}>
                    {ex.exerciseName} ({ex.targetWarmupSets ? `${ex.targetWarmupSets}W + ` : ''}{ex.targetSets}x{ex.targetReps})
                  </Text>
                </View>
              ))}
              {routine.exercises.length > 4 && (
                <View style={styles.exPillMore}>
                  <Text style={styles.exPillMoreText}>+{routine.exercises.length - 4} daha</Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={styles.startRoutineBtn}
              activeOpacity={0.85}
              onPress={() => handleStartRoutine(routine)}
            >
              <Ionicons name="play" size={13} color={COLORS.textInverted} />
              <Text style={styles.startRoutineBtnText}>Bu Programı Başlat</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* 3-Dots Action Sheet / Options Modal */}
      {selectedRoutineForMenu && (
        <Modal visible transparent animationType="fade">
          <TouchableOpacity
            style={styles.actionModalOverlay}
            activeOpacity={1}
            onPress={() => setSelectedRoutineForMenu(null)}
          >
            <View style={styles.actionSheetContainer}>
              <Text style={styles.actionSheetTitle}>{selectedRoutineForMenu.name}</Text>

              {routines.findIndex(r => r.id === selectedRoutineForMenu.id) > 0 && (
                <TouchableOpacity
                  style={styles.actionSheetItem}
                  onPress={() => {
                    const idx = routines.findIndex(r => r.id === selectedRoutineForMenu.id);
                    handleMoveRoutine(idx, -1);
                    setSelectedRoutineForMenu(null);
                  }}
                >
                  <Ionicons name="arrow-up-circle-outline" size={18} color={COLORS.textPrimary} />
                  <Text style={styles.actionSheetText}>Yukarı Taşı</Text>
                </TouchableOpacity>
              )}

              {routines.findIndex(r => r.id === selectedRoutineForMenu.id) < routines.length - 1 && (
                <TouchableOpacity
                  style={styles.actionSheetItem}
                  onPress={() => {
                    const idx = routines.findIndex(r => r.id === selectedRoutineForMenu.id);
                    handleMoveRoutine(idx, 1);
                    setSelectedRoutineForMenu(null);
                  }}
                >
                  <Ionicons name="arrow-down-circle-outline" size={18} color={COLORS.textPrimary} />
                  <Text style={styles.actionSheetText}>Aşağı Taşı</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.actionSheetItem}
                onPress={() => handleOpenEdit(selectedRoutineForMenu)}
              >
                <Ionicons name="create-outline" size={18} color={COLORS.textPrimary} />
                <Text style={styles.actionSheetText}>Programı Düzenle</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionSheetItem}
                onPress={() => handleDeletePrompt(selectedRoutineForMenu)}
              >
                <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                <Text style={[styles.actionSheetText, { color: COLORS.danger }]}>Programı Sil</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionSheetCancel}
                onPress={() => setSelectedRoutineForMenu(null)}
              >
                <Text style={styles.actionSheetCancelText}>İptal</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Routine Deletion Confirmation Modal */}
      {deletingRoutine && (
        <Modal visible transparent animationType="fade">
          <View style={styles.actionModalOverlay}>
            <View style={styles.actionSheetContainer}>
              <View style={{ alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Ionicons name="trash" size={28} color={COLORS.danger} />
                <Text style={styles.actionSheetTitle}>Programı Sil</Text>
                <Text style={{ fontSize: 12, color: COLORS.textSecondary, textAlign: 'center' }}>
                  "{deletingRoutine.name}" programını silmek istediğinize emin misiniz?
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.actionSheetItem, { backgroundColor: 'rgba(248, 113, 113, 0.14)', borderColor: COLORS.danger }]}
                onPress={confirmDeleteRoutine}
              >
                <Ionicons name="trash" size={16} color={COLORS.danger} />
                <Text style={[styles.actionSheetText, { color: COLORS.danger }]}>Evet, Programı Sil</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionSheetCancel}
                onPress={() => setDeletingRoutine(null)}
              >
                <Text style={styles.actionSheetCancelText}>Vazgeç</Text>
              </TouchableOpacity>
            </View>
          </View>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 12,
    paddingBottom: 130,
    gap: 12,
  },
  activeBanner: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...SHADOWS.soft,
  },
  activeBannerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingRight: 8,
  },
  activePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  activeTitle: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  activeSubtitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  activeBannerRight: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  resumeText: {
    color: COLORS.textInverted,
    fontWeight: '800',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  heroCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
    ...SHADOWS.soft,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primaryGlow,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(76, 194, 255, 0.45)',
  },
  heroBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  heroTextContainer: {
    gap: 3,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 17,
  },
  startFreestyleBtn: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 8,
    ...SHADOWS.soft,
  },
  startFreestyleBtnText: {
    color: COLORS.textInverted,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  headerBtnGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reorderToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  reorderToggleBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  reorderToggleBtnText: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 11,
  },
  reorderToggleBtnTextActive: {
    color: COLORS.textInverted,
  },
  createRoutineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  createRoutineBtnText: {
    color: COLORS.textInverted,
    fontWeight: '800',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  routinesList: {
    gap: 10,
  },
  routineCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
    ...SHADOWS.soft,
  },
  routineHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  routineHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reorderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  reorderPillBtn: {
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  reorderPillBtnDisabled: {
    opacity: 0.3,
  },
  routineTitleLeft: {
    flex: 1,
    gap: 4,
  },
  routineName: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  routineTag: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.surfaceElevated,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
  },
  routineTagText: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  dotsMenuBtn: {
    flexShrink: 0,
    padding: 4,
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
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  exPillText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  exPillMore: {
    backgroundColor: COLORS.primaryGlow,
    borderWidth: 1,
    borderColor: 'rgba(76, 194, 255, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  exPillMoreText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  startRoutineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 2,
  },
  startRoutineBtnText: {
    color: COLORS.textInverted,
    fontWeight: '800',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  actionModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(6, 12, 18, 0.78)',
    justifyContent: 'flex-end',
    padding: 14,
    paddingBottom: 32,
  },
  actionSheetContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    gap: 8,
    ...SHADOWS.medium,
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
    gap: 10,
    backgroundColor: COLORS.surfaceSubtle,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionSheetText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  actionSheetCancel: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 2,
  },
  actionSheetCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
});
