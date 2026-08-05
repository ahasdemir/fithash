import React, { useState, useEffect } from 'react';
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
import { COLORS } from '../theme';
import { Routine, RoutineExercise, Exercise } from '../types/fitness';
import { ExercisePickerModal } from './ExercisePickerModal';
import { CustomAlertModal, CustomAlertOptions } from './CustomAlertModal';

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
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Özel Program');
  const [selectedExercises, setSelectedExercises] = useState<RoutineExercise[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [customAlert, setCustomAlert] = useState<CustomAlertOptions | null>(null);

  useEffect(() => {
    if (initialRoutine) {
      setName(initialRoutine.name);
      setDescription(initialRoutine.description || '');
      setCategory(initialRoutine.category || 'Özel');
      setSelectedExercises(initialRoutine.exercises || []);
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
      const catChanged = (category.trim() || '') !== (initialRoutine.category || '');
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
      message: 'Programda yaptığınız değişiklikler kaydedilmedi. Kaydetmeden çıkmak istediğinize emin misiniz?',
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
    field: 'targetSets' | 'targetReps' | 'targetRir' | 'targetDurationMinutes' | 'targetDistanceKm',
    delta: number
  ) => {
    setSelectedExercises(prev => {
      const copy = [...prev];
      const currentVal = copy[index][field] ?? 0;

      if (field === 'targetDurationMinutes') {
        copy[index].targetDurationMinutes = Math.max(5, Math.min(180, (currentVal || 15) + delta * 5));
      } else if (field === 'targetDistanceKm') {
        const val = Math.max(0.5, Math.min(50, (currentVal || 2.5) + delta * 0.5));
        copy[index].targetDistanceKm = parseFloat(val.toFixed(1));
      } else {
        const minVal = field === 'targetRir' ? 0 : 1;
        const maxVal = field === 'targetRir' ? 3 : 100;
        copy[index][field] = Math.min(maxVal, Math.max(minVal, currentVal + delta));
      }

      return copy;
    });
  };

  const handleRemoveExercise = (index: number) => {
    setSelectedExercises(prev => prev.filter((_, i) => i !== index));
  };

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
    <Modal visible={visible} animationType="slide" transparent>
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

          <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
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

            {/* Exercise List */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Egzersiz Listesi ({selectedExercises.length})</Text>
              <TouchableOpacity style={styles.addExBtn} onPress={() => setShowPicker(true)}>
                <Ionicons name="add" size={16} color="#111111" />
                <Text style={styles.addExBtnText}>Hareket Ekle</Text>
              </TouchableOpacity>
            </View>

            {selectedExercises.map((ex, index) => {
              const isCardio = ex.category === 'Kardiyo';

              return (
                <View key={`${ex.exerciseId}_${index}`} style={styles.exCard}>
                  <View style={styles.exCardHeader}>
                    <Text style={styles.exName}>{index + 1}. {ex.exerciseName}</Text>
                    <TouchableOpacity onPress={() => handleRemoveExercise(index)}>
                      <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                    </TouchableOpacity>
                  </View>

                  {isCardio ? (
                    <View style={styles.targetsRow}>
                      {/* Cardio Duration */}
                      <View style={styles.counterBox}>
                        <Text style={styles.counterLabel}>Hedef Süre:</Text>
                        <TouchableOpacity style={styles.counterBtn} onPress={() => handleUpdateTarget(index, 'targetDurationMinutes', -1)}>
                          <Ionicons name="remove" size={12} color="#111111" />
                        </TouchableOpacity>
                        <Text style={styles.counterValue}>{ex.targetDurationMinutes || 15} dk</Text>
                        <TouchableOpacity style={styles.counterBtn} onPress={() => handleUpdateTarget(index, 'targetDurationMinutes', 1)}>
                          <Ionicons name="add" size={12} color="#111111" />
                        </TouchableOpacity>
                      </View>

                      {/* Cardio Distance */}
                      <View style={styles.counterBox}>
                        <Text style={styles.counterLabel}>Hedef Mesafe:</Text>
                        <TouchableOpacity style={styles.counterBtn} onPress={() => handleUpdateTarget(index, 'targetDistanceKm', -1)}>
                          <Ionicons name="remove" size={12} color="#111111" />
                        </TouchableOpacity>
                        <Text style={styles.counterValue}>{ex.targetDistanceKm || 2.5} km</Text>
                        <TouchableOpacity style={styles.counterBtn} onPress={() => handleUpdateTarget(index, 'targetDistanceKm', 1)}>
                          <Ionicons name="add" size={12} color="#111111" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.targetsRow}>
                      {/* Sets */}
                      <View style={styles.counterBox}>
                        <Text style={styles.counterLabel}>Set:</Text>
                        <TouchableOpacity style={styles.counterBtn} onPress={() => handleUpdateTarget(index, 'targetSets', -1)}>
                          <Ionicons name="remove" size={12} color="#111111" />
                        </TouchableOpacity>
                        <Text style={styles.counterValue}>{ex.targetSets}</Text>
                        <TouchableOpacity style={styles.counterBtn} onPress={() => handleUpdateTarget(index, 'targetSets', 1)}>
                          <Ionicons name="add" size={12} color="#111111" />
                        </TouchableOpacity>
                      </View>

                      {/* Reps */}
                      <View style={styles.counterBox}>
                        <Text style={styles.counterLabel}>Tekrar:</Text>
                        <TouchableOpacity style={styles.counterBtn} onPress={() => handleUpdateTarget(index, 'targetReps', -1)}>
                          <Ionicons name="remove" size={12} color="#111111" />
                        </TouchableOpacity>
                        <Text style={styles.counterValue}>{ex.targetReps}</Text>
                        <TouchableOpacity style={styles.counterBtn} onPress={() => handleUpdateTarget(index, 'targetReps', 1)}>
                          <Ionicons name="add" size={12} color="#111111" />
                        </TouchableOpacity>
                      </View>

                      {/* RIR */}
                      <View style={styles.counterBox}>
                        <Text style={styles.counterLabel}>Hedef RIR:</Text>
                        <TouchableOpacity style={styles.counterBtn} onPress={() => handleUpdateTarget(index, 'targetRir', -1)}>
                          <Ionicons name="remove" size={12} color="#111111" />
                        </TouchableOpacity>
                        <Text style={styles.counterValue}>{ex.targetRir ?? 1}</Text>
                        <TouchableOpacity style={styles.counterBtn} onPress={() => handleUpdateTarget(index, 'targetRir', 1)}>
                          <Ionicons name="add" size={12} color="#111111" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}

            {selectedExercises.length === 0 && (
              <TouchableOpacity style={styles.emptyAddBox} onPress={() => setShowPicker(true)}>
                <Ionicons name="add-circle-outline" size={30} color="#111111" />
                <Text style={styles.emptyAddText}>Programa Egzersiz Ekle</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>İptal</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveBtn, (!name.trim() || selectedExercises.length === 0) && styles.saveBtnDisabled]}
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

      {customAlert && (
        <CustomAlertModal
          {...customAlert}
        />
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '90%',
    padding: 18,
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
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 100,
    paddingHorizontal: 16,
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
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  addExBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
  },
  addExBtnText: {
    color: '#111111',
    fontWeight: '700',
    fontSize: 12,
  },
  exCard: {
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 18,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  exCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  exName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  targetsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  counterBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  counterLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
  },
  counterBtn: {
    backgroundColor: COLORS.primary,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterValue: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 12,
    minWidth: 16,
    textAlign: 'center',
  },
  emptyAddBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 25,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    borderRadius: 18,
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
    borderRadius: 100,
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
    borderRadius: 100,
    backgroundColor: COLORS.primary,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: '#111111',
    fontWeight: '800',
  },
});
