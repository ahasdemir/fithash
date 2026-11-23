import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, useTheme, subscribeTheme } from '../theme';
import { Routine, RoutineExercise, Exercise } from '../types/fitness';
import { ExercisePickerModal } from './ExercisePickerModal';
import { ExerciseSwapModal } from './ExerciseSwapModal';
import { CustomAlertModal, CustomAlertOptions } from './CustomAlertModal';
import { DraggableList, DragGripHandle } from './DraggableList';
import { getExercises } from '../services/storage';

interface RoutineBuilderModalProps {
  visible: boolean;
  initialRoutine?: Routine | null;
  onClose: () => void;
  onSave: (routine: Routine) => void;
}

export const RoutineBuilderModal: React.FC<RoutineBuilderModalProps> = ({
  visible,
  initialRoutine,
  onClose,
  onSave,
}) => {
  useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Özel Program');
  const [selectedExercises, setSelectedExercises] = useState<RoutineExercise[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [swappingIndex, setSwappingIndex] = useState<number | null>(null);
  const [allAvailableExercises, setAllAvailableExercises] = useState<Exercise[]>([]);
  const [customAlert, setCustomAlert] = useState<CustomAlertOptions | null>(null);
  const [isDraggingExercise, setIsDraggingExercise] = useState(false);

  useEffect(() => {
    if (visible) {
      getExercises().then(data => setAllAvailableExercises(data));
    }
  }, [visible]);

  useEffect(() => {
    if (initialRoutine) {
      setName(initialRoutine.name);
      setDescription(initialRoutine.description || '');
      setCategory(initialRoutine.category || 'Özel');
      setSelectedExercises((initialRoutine.exercises || []).map(ex => ({ ...ex })));
    } else {
      setName('');
      setDescription('');
      setCategory('Özel Program');
      setSelectedExercises([]);
    }
  }, [initialRoutine, visible]);

  const isFormDirty = () => {
    if (!initialRoutine) {
      return name.trim() !== '' || description.trim() !== '' || selectedExercises.length > 0;
    } else {
      const initialExs = initialRoutine.exercises || [];
      const nameChanged = name.trim() !== initialRoutine.name;
      const descChanged = (description.trim() || '') !== (initialRoutine.description || '');
      const catChanged = (category.trim() || 'Özel') !== (initialRoutine.category || 'Özel');
      const exercisesChanged = JSON.stringify(selectedExercises) !== JSON.stringify(initialExs);
      return nameChanged || descChanged || catChanged || exercisesChanged;
    }
  };

  const handleCloseAttempt = () => {
    if (!isFormDirty()) {
      onClose();
      return;
    }

    setCustomAlert({
      visible: true,
      type: 'warning',
      title: 'Değişiklikler Kaydedilmedi!',
      message:
        'Programda yaptığınız değişiklikler kaydedilmedi. Kaydetmeden çıkmak istediğinize emin misiniz?',
      confirmText: 'Evet, Çık',
      cancelText: 'Düzenlemeye Devam Et',
      onConfirm: () => {
        setCustomAlert(null);
        onClose();
      },
      onCancel: () => setCustomAlert(null),
    });
  };

  const handleAddExercise = (ex: Exercise) => {
    const isCardio = ex.category === 'Kardiyo';
    const newRoutineEx: RoutineExercise = {
      exerciseId: ex.id,
      exerciseName: ex.name,
      category: ex.category,
      equipment: ex.equipment,
      targetWarmupSets: 0,
      targetSets: isCardio ? 1 : 3,
      targetReps: isCardio ? 1 : 10,
      targetDurationMinutes: isCardio ? 15 : undefined,
      targetDistanceKm: isCardio ? 2.5 : undefined,
      targetRir: isCardio ? undefined : 1,
    };
    setSelectedExercises(prev => [...prev, newRoutineEx]);
  };

  const handleUpdateTarget = (
    index: number,
    field:
      | 'targetSets'
      | 'targetReps'
      | 'targetRir'
      | 'targetDurationMinutes'
      | 'targetDistanceKm'
      | 'targetDurationSeconds'
      | 'targetWarmupSets',
    delta: number
  ) => {
    setSelectedExercises(prev =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const currentVal = item[field] ?? 0;
        if (field === 'targetDurationMinutes') {
          return { ...item, targetDurationMinutes: Math.max(5, Math.min(180, (currentVal || 15) + delta * 5)) };
        }
        if (field === 'targetDurationSeconds') {
          return { ...item, targetDurationSeconds: Math.max(10, Math.min(600, (currentVal || 60) + delta)) };
        }
        if (field === 'targetDistanceKm') {
          const val = Math.max(0.5, Math.min(50, (currentVal || 2.5) + delta * 0.5));
          return { ...item, targetDistanceKm: parseFloat(val.toFixed(1)) };
        }
        if (field === 'targetWarmupSets') {
          return { ...item, targetWarmupSets: Math.max(0, Math.min(5, (currentVal || 0) + delta)) };
        }
        const minVal = field === 'targetRir' ? 0 : 1;
        const maxVal = field === 'targetRir' ? 3 : 100;
        return { ...item, [field]: Math.min(maxVal, Math.max(minVal, currentVal + delta)) };
      })
    );
  };

  const handleRemoveExercise = (index: number) => {
    setSelectedExercises(prev => prev.filter((_, i) => i !== index));
  };

  const handleSwapExerciseSelect = (newEx: Exercise, recommendedWeight: number) => {
    if (swappingIndex === null) return;
    const isCardio = newEx.category === 'Kardiyo';

    setSelectedExercises(prev => {
      const copy = [...prev];
      const old = copy[swappingIndex];
      copy[swappingIndex] = {
        ...old,
        exerciseId: newEx.id,
        exerciseName: newEx.name,
        category: newEx.category,
        equipment: newEx.equipment,
        targetWeight: recommendedWeight > 0 ? recommendedWeight : old.targetWeight,
        targetSets: isCardio ? 1 : old.targetSets,
        targetReps: isCardio ? 1 : old.targetReps,
        targetRir: isCardio ? undefined : old.targetRir ?? 1,
      };
      return copy;
    });
    setSwappingIndex(null);
  };

  const handleReorderExercises = useCallback((nextExercises: RoutineExercise[]) => {
    setSelectedExercises(nextExercises);
  }, []);

  const handleSave = () => {
    if (!name.trim() || selectedExercises.length === 0) return;

    const routine: Routine = {
      id: initialRoutine ? initialRoutine.id : `routine_${Date.now()}`,
      name: name.trim(),
      description: description.trim() || 'Özel oluşturulmuş antrenman programı',
      category: category.trim() || 'Özel',
      exercises: selectedExercises,
      createdAt: initialRoutine ? initialRoutine.createdAt : new Date().toISOString(),
    };

    onSave(routine);
    setName('');
    setDescription('');
    setSelectedExercises([]);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleCloseAttempt}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {initialRoutine ? 'Programı Düzenle' : 'Yeni Program Oluştur'}
            </Text>
            <TouchableOpacity onPress={handleCloseAttempt}>
              <Ionicons name="close-circle" size={26} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.form}
            scrollEnabled={!isDraggingExercise}
            contentContainerStyle={[
              styles.formContent,
              { paddingBottom: Math.max(insets.bottom, 16) + 40 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.label}>Program Adı *</Text>
            <TextInput
              style={styles.input}
              placeholder="Örn: Göğüs & Omuz (Program C)..."
              placeholderTextColor={COLORS.textMuted}
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.label}>Açıklama</Text>
            <TextInput
              style={styles.input}
              placeholder="Örn: RIR 0-1 odaklı hipertrofi serisi"
              placeholderTextColor={COLORS.textMuted}
              value={description}
              onChangeText={setDescription}
            />

            <Text style={styles.label}>Kategori</Text>
            <TextInput
              style={styles.input}
              placeholder="Örn: PPL, Split, Güç & Hacim"
              placeholderTextColor={COLORS.textMuted}
              value={category}
              onChangeText={setCategory}
            />

            {/* Exercise List Header */}
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>
                  Egzersiz Listesi ({selectedExercises.length})
                </Text>
                {selectedExercises.length > 1 && (
                  <Text style={styles.sectionHint}>Sıralamak için tutamaçtan sürükle</Text>
                )}
              </View>
              <TouchableOpacity style={styles.addExBtn} onPress={() => setShowPicker(true)}>
                <Ionicons name="add" size={16} color={COLORS.primaryText} />
                <Text style={styles.addExBtnText}>Hareket Ekle</Text>
              </TouchableOpacity>
            </View>

            {selectedExercises.length > 0 ? (
              <DraggableList
                items={selectedExercises}
                keyExtractor={(ex, idx) => {
                  let occ = 0;
                  for (let i = 0; i < idx; i++) {
                    if (selectedExercises[i]?.exerciseId === ex.exerciseId) occ++;
                  }
                  return `${ex.exerciseId}_occ_${occ}`;
                }}
                onReorder={handleReorderExercises}
                onDragStateChange={setIsDraggingExercise}
                gap={8}
                renderItem={({ item: ex, index, isDragging, dragHandleProps }) => {
                  const isCardio = ex.category === 'Kardiyo';
                  const hasWarmup = (ex.targetWarmupSets || 0) > 0;

                  return (
                    <View style={[styles.exCard, isDragging && styles.exCardDragging]}>
                      <View style={styles.exCardHeader}>
                        {selectedExercises.length > 1 && (
                          <DragGripHandle
                            dragHandleProps={dragHandleProps}
                            isDragging={isDragging}
                            compact
                          />
                        )}

                        <Text style={styles.exName} numberOfLines={1}>
                          {index + 1}. {ex.exerciseName}
                        </Text>

                        <View style={styles.exCardActions}>
                          {!isCardio && (
                            <TouchableOpacity
                              style={styles.swapExIconBtn}
                              onPress={() => setSwappingIndex(index)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Ionicons
                                name="swap-horizontal"
                                size={15}
                                color={COLORS.textPrimary}
                              />
                            </TouchableOpacity>
                          )}

                          <TouchableOpacity
                            style={styles.deleteExBtn}
                            onPress={() => handleRemoveExercise(index)}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          >
                            <Ionicons name="trash-outline" size={15} color={COLORS.pastel.rose} />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {isCardio ? (
                        <View style={styles.targetsRow}>
                          <View style={styles.counterBox}>
                            <Text style={styles.counterLabel}>Hedef Süre:</Text>
                            <TouchableOpacity
                              style={styles.counterBtn}
                              onPress={() =>
                                handleUpdateTarget(index, 'targetDurationMinutes', -1)
                              }
                            >
                              <Ionicons name="remove" size={12} color={COLORS.primaryText} />
                            </TouchableOpacity>
                            <Text style={styles.counterValue}>
                              {ex.targetDurationMinutes || 15} dk
                            </Text>
                            <TouchableOpacity
                              style={styles.counterBtn}
                              onPress={() =>
                                handleUpdateTarget(index, 'targetDurationMinutes', 1)
                              }
                            >
                              <Ionicons name="add" size={12} color={COLORS.primaryText} />
                            </TouchableOpacity>
                          </View>

                          <View style={styles.counterBox}>
                            <Text style={styles.counterLabel}>Hedef Mesafe:</Text>
                            <TouchableOpacity
                              style={styles.counterBtn}
                              onPress={() => handleUpdateTarget(index, 'targetDistanceKm', -1)}
                            >
                              <Ionicons name="remove" size={12} color={COLORS.primaryText} />
                            </TouchableOpacity>
                            <Text style={styles.counterValue}>
                              {ex.targetDistanceKm || 2.5} km
                            </Text>
                            <TouchableOpacity
                              style={styles.counterBtn}
                              onPress={() => handleUpdateTarget(index, 'targetDistanceKm', 1)}
                            >
                              <Ionicons name="add" size={12} color={COLORS.primaryText} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : /plank|hollow body|dead bug|bird dog|statik/i.test(ex.exerciseName) ? (
                        <View style={styles.targetsRow}>
                          <View
                            style={[
                              styles.counterBox,
                              hasWarmup && styles.counterBoxWarmup,
                            ]}
                          >
                            <Text
                              style={[
                                styles.counterLabel,
                                hasWarmup && styles.counterLabelWarmup,
                              ]}
                            >
                              Isınma:
                            </Text>
                            <TouchableOpacity
                              style={[
                                styles.counterBtn,
                                hasWarmup && styles.counterBtnWarmup,
                              ]}
                              onPress={() => handleUpdateTarget(index, 'targetWarmupSets', -1)}
                            >
                              <Ionicons name="remove" size={12} color={COLORS.primaryText} />
                            </TouchableOpacity>
                            <Text
                              style={[
                                styles.counterValue,
                                hasWarmup && styles.counterValueWarmup,
                              ]}
                            >
                              {ex.targetWarmupSets || 0}
                            </Text>
                            <TouchableOpacity
                              style={[
                                styles.counterBtn,
                                hasWarmup && styles.counterBtnWarmup,
                              ]}
                              onPress={() => handleUpdateTarget(index, 'targetWarmupSets', 1)}
                            >
                              <Ionicons name="add" size={12} color={COLORS.primaryText} />
                            </TouchableOpacity>
                          </View>

                          <View style={styles.counterBox}>
                            <Text style={styles.counterLabel}>Çalışma Seti:</Text>
                            <TouchableOpacity
                              style={styles.counterBtn}
                              onPress={() => handleUpdateTarget(index, 'targetSets', -1)}
                            >
                              <Ionicons name="remove" size={12} color={COLORS.primaryText} />
                            </TouchableOpacity>
                            <Text style={styles.counterValue}>{ex.targetSets}</Text>
                            <TouchableOpacity
                              style={styles.counterBtn}
                              onPress={() => handleUpdateTarget(index, 'targetSets', 1)}
                            >
                              <Ionicons name="add" size={12} color={COLORS.primaryText} />
                            </TouchableOpacity>
                          </View>

                          <View style={styles.counterBox}>
                            <Text style={styles.counterLabel}>Süre (sn):</Text>
                            <TouchableOpacity
                              style={styles.counterBtn}
                              onPress={() =>
                                handleUpdateTarget(index, 'targetDurationSeconds', -5)
                              }
                            >
                              <Ionicons name="remove" size={12} color={COLORS.primaryText} />
                            </TouchableOpacity>
                            <Text style={styles.counterValue}>
                              {ex.targetDurationSeconds || 60} sn
                            </Text>
                            <TouchableOpacity
                              style={styles.counterBtn}
                              onPress={() =>
                                handleUpdateTarget(index, 'targetDurationSeconds', 5)
                              }
                            >
                              <Ionicons name="add" size={12} color={COLORS.primaryText} />
                            </TouchableOpacity>
                          </View>

                          <View style={styles.counterBox}>
                            <Text style={styles.counterLabel}>Hedef RIR:</Text>
                            <TouchableOpacity
                              style={styles.counterBtn}
                              onPress={() => handleUpdateTarget(index, 'targetRir', -1)}
                            >
                              <Ionicons name="remove" size={12} color={COLORS.primaryText} />
                            </TouchableOpacity>
                            <Text style={styles.counterValue}>{ex.targetRir ?? 1}</Text>
                            <TouchableOpacity
                              style={styles.counterBtn}
                              onPress={() => handleUpdateTarget(index, 'targetRir', 1)}
                            >
                              <Ionicons name="add" size={12} color={COLORS.primaryText} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <View style={styles.targetsRow}>
                          <View
                            style={[
                              styles.counterBox,
                              hasWarmup && styles.counterBoxWarmup,
                            ]}
                          >
                            <Text
                              style={[
                                styles.counterLabel,
                                hasWarmup && styles.counterLabelWarmup,
                              ]}
                            >
                              Isınma:
                            </Text>
                            <TouchableOpacity
                              style={[
                                styles.counterBtn,
                                hasWarmup && styles.counterBtnWarmup,
                              ]}
                              onPress={() => handleUpdateTarget(index, 'targetWarmupSets', -1)}
                            >
                              <Ionicons name="remove" size={12} color={COLORS.primaryText} />
                            </TouchableOpacity>
                            <Text
                              style={[
                                styles.counterValue,
                                hasWarmup && styles.counterValueWarmup,
                              ]}
                            >
                              {ex.targetWarmupSets || 0}
                            </Text>
                            <TouchableOpacity
                              style={[
                                styles.counterBtn,
                                hasWarmup && styles.counterBtnWarmup,
                              ]}
                              onPress={() => handleUpdateTarget(index, 'targetWarmupSets', 1)}
                            >
                              <Ionicons name="add" size={12} color={COLORS.primaryText} />
                            </TouchableOpacity>
                          </View>

                          <View style={styles.counterBox}>
                            <Text style={styles.counterLabel}>Çalışma Seti:</Text>
                            <TouchableOpacity
                              style={styles.counterBtn}
                              onPress={() => handleUpdateTarget(index, 'targetSets', -1)}
                            >
                              <Ionicons name="remove" size={12} color={COLORS.primaryText} />
                            </TouchableOpacity>
                            <Text style={styles.counterValue}>{ex.targetSets}</Text>
                            <TouchableOpacity
                              style={styles.counterBtn}
                              onPress={() => handleUpdateTarget(index, 'targetSets', 1)}
                            >
                              <Ionicons name="add" size={12} color={COLORS.primaryText} />
                            </TouchableOpacity>
                          </View>

                          <View style={styles.counterBox}>
                            <Text style={styles.counterLabel}>Tekrar:</Text>
                            <TouchableOpacity
                              style={styles.counterBtn}
                              onPress={() => handleUpdateTarget(index, 'targetReps', -1)}
                            >
                              <Ionicons name="remove" size={12} color={COLORS.primaryText} />
                            </TouchableOpacity>
                            <Text style={styles.counterValue}>{ex.targetReps}</Text>
                            <TouchableOpacity
                              style={styles.counterBtn}
                              onPress={() => handleUpdateTarget(index, 'targetReps', 1)}
                            >
                              <Ionicons name="add" size={12} color={COLORS.primaryText} />
                            </TouchableOpacity>
                          </View>

                          <View style={styles.counterBox}>
                            <Text style={styles.counterLabel}>Hedef RIR:</Text>
                            <TouchableOpacity
                              style={styles.counterBtn}
                              onPress={() => handleUpdateTarget(index, 'targetRir', -1)}
                            >
                              <Ionicons name="remove" size={12} color={COLORS.primaryText} />
                            </TouchableOpacity>
                            <Text style={styles.counterValue}>{ex.targetRir ?? 1}</Text>
                            <TouchableOpacity
                              style={styles.counterBtn}
                              onPress={() => handleUpdateTarget(index, 'targetRir', 1)}
                            >
                              <Ionicons name="add" size={12} color={COLORS.primaryText} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                }}
              />
            ) : (
              <TouchableOpacity style={styles.emptyAddBox} onPress={() => setShowPicker(true)}>
                <Ionicons name="add-circle-outline" size={30} color={COLORS.textPrimary} />
                <Text style={styles.emptyAddText}>Programa Egzersiz Ekle</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCloseAttempt}>
              <Text style={styles.cancelBtnText}>İptal</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.saveBtn,
                (!name.trim() || selectedExercises.length === 0) && styles.saveBtnDisabled,
              ]}
              onPress={handleSave}
              disabled={!name.trim() || selectedExercises.length === 0}
            >
              <Text style={styles.saveBtnText}>
                {initialRoutine ? 'Güncelle' : 'Programı Kaydet'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ExercisePickerModal
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        onSelectExercise={handleAddExercise}
      />

      <ExerciseSwapModal
        visible={swappingIndex !== null}
        sourceExercise={
          swappingIndex !== null && selectedExercises[swappingIndex]
            ? {
                id: selectedExercises[swappingIndex].exerciseId,
                name: selectedExercises[swappingIndex].exerciseName,
                category: selectedExercises[swappingIndex].category,
                equipment: selectedExercises[swappingIndex].equipment,
                lastWeight: selectedExercises[swappingIndex].targetWeight,
                lastReps: selectedExercises[swappingIndex].targetReps,
                lastRir: selectedExercises[swappingIndex].targetRir,
              }
            : null
        }
        allExercises={allAvailableExercises}
        onSelectSwap={handleSwapExerciseSelect}
        onClose={() => setSwappingIndex(null)}
      />

      {customAlert && <CustomAlertModal {...customAlert} />}
    </Modal>
  );
};

const createStyles = () =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'flex-end',
    },
    container: {
      backgroundColor: COLORS.surface,
      borderTopLeftRadius: 10,
      borderTopRightRadius: 10,
      height: '92%',
      paddingTop: 18,
      paddingHorizontal: 18,
      paddingBottom: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    title: {
      fontSize: 18,
      fontWeight: '800',
      color: COLORS.textPrimary,
    },
    form: {
      marginVertical: 12,
    },
    formContent: {
      paddingBottom: 40,
    },
    label: {
      fontSize: 12.5,
      fontWeight: '600',
      color: COLORS.textSecondary,
      marginBottom: 6,
      marginTop: 10,
    },
    input: {
      backgroundColor: COLORS.surfaceSubtle,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 6,
      paddingHorizontal: 14,
      paddingVertical: 10,
      color: COLORS.textPrimary,
      fontSize: 14,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 18,
      marginBottom: 10,
      gap: 8,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: COLORS.textPrimary,
    },
    sectionHint: {
      fontSize: 11,
      color: COLORS.textMuted,
      marginTop: 1,
    },
    addExBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: COLORS.primary,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 6,
    },
    addExBtnText: {
      color: COLORS.primaryText,
      fontWeight: '700',
      fontSize: 12,
    },
    exCard: {
      backgroundColor: COLORS.surfaceSubtle,
      borderRadius: 8,
      padding: 12,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    exCardDragging: {
      borderColor: COLORS.primary,
      backgroundColor: COLORS.surfaceElevated,
    },
    exCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
      gap: 8,
    },
    exName: {
      fontSize: 13.5,
      fontWeight: '700',
      color: COLORS.textPrimary,
      flex: 1,
    },
    exCardActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    swapExIconBtn: {
      padding: 6,
      borderRadius: 6,
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    deleteExBtn: {
      padding: 6,
      borderRadius: 6,
      backgroundColor: COLORS.pastel.roseBg,
    },
    targetsRow: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
    },
    counterBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: COLORS.surface,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    counterLabel: {
      color: COLORS.textSecondary,
      fontSize: 11,
      fontWeight: '600',
    },
    counterBtn: {
      backgroundColor: COLORS.primary,
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    counterValue: {
      color: COLORS.textPrimary,
      fontWeight: '800',
      fontSize: 13,
      minWidth: 18,
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
    },
    counterBoxWarmup: {
      borderColor: COLORS.pastel.amber,
      backgroundColor: COLORS.pastel.amberBg,
    },
    counterLabelWarmup: {
      color: COLORS.pastel.amber,
      fontWeight: '700',
    },
    counterBtnWarmup: {
      backgroundColor: COLORS.pastel.amber,
    },
    counterValueWarmup: {
      color: COLORS.pastel.amber,
      fontWeight: '900',
    },
    emptyAddBox: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 25,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderStyle: 'dashed',
      borderRadius: 8,
      marginTop: 10,
      gap: 8,
    },
    emptyAddText: {
      color: COLORS.textPrimary,
      fontWeight: '700',
      fontSize: 14,
    },
    footer: {
      flexDirection: 'row',
      gap: 12,
      paddingTop: 10,
    },
    cancelBtn: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      borderRadius: 6,
      backgroundColor: COLORS.surfaceSubtle,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    cancelBtnText: {
      color: COLORS.textSecondary,
      fontWeight: '600',
    },
    saveBtn: {
      flex: 2,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: 6,
      backgroundColor: COLORS.primary,
    },
    saveBtnDisabled: {
      opacity: 0.5,
    },
    saveBtnText: {
      color: COLORS.primaryText,
      fontWeight: '800',
    },
  });

let styles = createStyles();
subscribeTheme(() => {
  styles = createStyles();
});
