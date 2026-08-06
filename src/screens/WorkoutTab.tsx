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
import { COLORS, SHADOWS } from '../theme';
import { Routine, WorkoutSession } from '../types/fitness';
import { RoutineBuilderModal } from '../components/RoutineBuilderModal';
import { getExercises } from '../services/storage';

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
  const [showRoutineBuilder, setShowRoutineBuilder] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [selectedRoutineForMenu, setSelectedRoutineForMenu] = useState<Routine | null>(null);
  const [deletingRoutine, setDeletingRoutine] = useState<Routine | null>(null);

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
      date: new Date().toISOString().split('T')[0],
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
      const sets = Array.from({ length: rEx.targetSets }, (_, i) => ({
        id: `set_${idx}_${i}_${Date.now()}`,
        setNumber: i + 1,
        weight: rEx.targetWeight || 0,
        reps: rEx.targetReps || 10,
        rir: rEx.targetRir ?? 1,
        completed: false,
      }));

      return {
        id: `wex_${idx}_${Date.now()}`,
        exerciseId: rEx.exerciseId,
        exerciseName: rEx.exerciseName,
        category: rEx.category,
        equipment: rEx.equipment,
        sets,
      };
    });

    const session: WorkoutSession = {
      id: `session_${Date.now()}`,
      name: routine.name,
      routineId: routine.id,
      date: new Date().toISOString().split('T')[0],
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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
            <Ionicons name="chevron-forward" size={16} color="#111111" />
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
          <Ionicons name="flash" size={20} color="#111111" />
          <Text style={styles.startFreestyleBtnText}>Serbest Antrenman Başlat</Text>
        </TouchableOpacity>
      </View>

      {/* Routine Section Header */}
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Antrenman Programlarım</Text>
          <Text style={styles.sectionSubtitle}>Bento grid günlük rutinleriniz</Text>
        </View>

        <TouchableOpacity
          style={styles.createRoutineBtn}
          onPress={() => {
            setEditingRoutine(null);
            setShowRoutineBuilder(true);
          }}
        >
          <Ionicons name="add" size={16} color="#111111" />
          <Text style={styles.createRoutineBtnText}>Yeni Program</Text>
        </TouchableOpacity>
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
                {routines.length > 1 && (
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
                  <Ionicons name="ellipsis-horizontal" size={20} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.routineDesc}>{routine.description}</Text>

            {/* Exercise preview pills */}
            <View style={styles.exercisesPreview}>
              {routine.exercises.slice(0, 4).map((ex, idx) => (
                <View key={idx} style={styles.exPill}>
                  <Text style={styles.exPillText}>
                    {ex.exerciseName} ({ex.targetSets}x{ex.targetReps})
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
              <Ionicons name="play" size={14} color="#111111" />
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
                  <Ionicons name="arrow-up-circle-outline" size={20} color={COLORS.textPrimary} />
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
                  <Ionicons name="arrow-down-circle-outline" size={20} color={COLORS.textPrimary} />
                  <Text style={styles.actionSheetText}>Aşağı Taşı</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.actionSheetItem}
                onPress={() => handleOpenEdit(selectedRoutineForMenu)}
              >
                <Ionicons name="create-outline" size={20} color={COLORS.textPrimary} />
                <Text style={styles.actionSheetText}>Programı Düzenle</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionSheetItem}
                onPress={() => handleDeletePrompt(selectedRoutineForMenu)}
              >
                <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
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
                <Ionicons name="trash" size={32} color={COLORS.danger} />
                <Text style={styles.actionSheetTitle}>Programı Sil</Text>
                <Text style={{ fontSize: 13, color: COLORS.textMuted, textAlign: 'center' }}>
                  "{deletingRoutine.name}" programını silmek istediğinize emin misiniz?
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.actionSheetItem, { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: COLORS.danger }]}
                onPress={confirmDeleteRoutine}
              >
                <Ionicons name="trash" size={18} color={COLORS.danger} />
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
    padding: 16,
    paddingBottom: 140, // Increased bottom padding so floating navbar never covers CTA buttons
    gap: 16,
  },
  activeBanner: {
    backgroundColor: '#111111',
    borderRadius: 24,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...SHADOWS.soft,
  },
  activeBannerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingRight: 10,
  },
  activePulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  activeTitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  activeSubtitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  activeBannerRight: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 100,
  },
  resumeText: {
    color: '#111111',
    fontWeight: '700',
    fontSize: 12,
  },
  heroCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 14,
    ...SHADOWS.soft,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primaryGlow,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(198, 240, 53, 0.4)',
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#111111',
  },
  heroTextContainer: {
    gap: 4,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.4,
  },
  heroSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  startFreestyleBtn: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 100,
    ...SHADOWS.soft,
  },
  startFreestyleBtnText: {
    color: '#111111',
    fontSize: 15,
    fontWeight: '800',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  createRoutineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
  },
  createRoutineBtnText: {
    color: '#111111',
    fontWeight: '700',
    fontSize: 12,
  },
  routinesList: {
    gap: 12,
  },
  routineCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
    ...SHADOWS.soft,
  },
  routineHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  routineHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reorderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 8,
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
    gap: 6,
  },
  routineName: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    lineHeight: 22,
  },
  routineTag: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.surfaceSubtle,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  routineTagText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  dotsMenuBtn: {
    flexShrink: 0,
    padding: 6,
    borderRadius: 100,
  },
  routineDesc: {
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 18,
  },
  exercisesPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  exPill: {
    backgroundColor: COLORS.surfaceSubtle,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  exPillText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  exPillMore: {
    backgroundColor: COLORS.primaryGlow,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
  },
  exPillMoreText: {
    fontSize: 11,
    color: '#111111',
    fontWeight: '700',
  },
  startRoutineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 100,
    marginTop: 4,
  },
  startRoutineBtnText: {
    color: '#111111',
    fontWeight: '800',
    fontSize: 13,
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
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
    ...SHADOWS.soft,
  },
  actionSheetTitle: {
    fontSize: 16,
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
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 100,
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
    paddingVertical: 14,
    marginTop: 4,
  },
  actionSheetCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
});
