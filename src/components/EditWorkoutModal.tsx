import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../theme';
import { WorkoutSession, WorkoutExercise, ExerciseSet } from '../types/fitness';
import { ExercisePickerModal } from './ExercisePickerModal';

interface EditWorkoutModalProps {
  visible: boolean;
  workout: WorkoutSession | null;
  onClose: () => void;
  onSave: (updatedWorkout: WorkoutSession) => void;
}

export const EditWorkoutModal: React.FC<EditWorkoutModalProps> = ({
  visible,
  workout,
  onClose,
  onSave,
}) => {
  if (!workout) return null;

  const [name, setName] = useState(workout.name);
  const [date, setDate] = useState(workout.date);
  const [durationMinutes, setDurationMinutes] = useState(
    Math.round((workout.durationSeconds || 0) / 60).toString()
  );
  const [notes, setNotes] = useState(workout.notes || '');
  const [exercises, setExercises] = useState<WorkoutExercise[]>(
    JSON.parse(JSON.stringify(workout.exercises || []))
  );
  const [rawInputMap, setRawInputMap] = useState<Record<string, string>>({});
  const [showExercisePicker, setShowExercisePicker] = useState(false);

  useEffect(() => {
    if (workout) {
      setName(workout.name);
      setDate(workout.date);
      setDurationMinutes(Math.round((workout.durationSeconds || 0) / 60).toString());
      setNotes(workout.notes || '');
      setExercises(JSON.parse(JSON.stringify(workout.exercises || [])));
      setRawInputMap({});
    }
  }, [workout]);

  const handleAddExercise = (selectedEx: any) => {
    const newEx: WorkoutExercise = {
      id: `wex_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      exerciseId: selectedEx.id,
      exerciseName: selectedEx.name,
      category: selectedEx.category,
      equipment: selectedEx.equipment,
      sets: [
        {
          id: `set_${Date.now()}_1`,
          setNumber: 1,
          weight: 0,
          reps: 10,
          completed: true,
        },
      ],
    };
    setExercises(prev => [...prev, newEx]);
    setShowExercisePicker(false);
  };

  const handleRemoveExercise = (exerciseIndex: number) => {
    Alert.alert(
      'Egzersizi Kaldır',
      `"${exercises[exerciseIndex].exerciseName}" antrenmandan çıkarılsın mı?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Kaldır',
          style: 'destructive',
          onPress: () => {
            setExercises(prev => prev.filter((_, idx) => idx !== exerciseIndex));
          },
        },
      ]
    );
  };

  const handleAddSet = (exerciseIndex: number) => {
    setExercises(prev => {
      const next = [...prev];
      const targetEx = { ...next[exerciseIndex] };
      const lastSet = targetEx.sets[targetEx.sets.length - 1];
      const newSetNumber = targetEx.sets.length + 1;

      const newSet: ExerciseSet = {
        id: `set_${Date.now()}_${newSetNumber}`,
        setNumber: newSetNumber,
        weight: lastSet ? lastSet.weight : 0,
        reps: lastSet ? lastSet.reps : 10,
        durationMinutes: lastSet?.durationMinutes,
        distanceKm: lastSet?.distanceKm,
        completed: true,
      };

      targetEx.sets = [...targetEx.sets, newSet];
      next[exerciseIndex] = targetEx;
      return next;
    });
  };

  const handleRemoveSet = (exerciseIndex: number, setIndex: number) => {
    setExercises(prev => {
      const next = [...prev];
      const targetEx = { ...next[exerciseIndex] };
      if (targetEx.sets.length <= 1) {
        Alert.alert('Uyarı', 'Egzersizin en az bir seti olmalıdır veya egzersizi kaldırabilirsiniz.');
        return prev;
      }
      targetEx.sets = targetEx.sets
        .filter((_, idx) => idx !== setIndex)
        .map((s, idx) => ({ ...s, setNumber: idx + 1 }));
      next[exerciseIndex] = targetEx;
      return next;
    });
  };

  const handleUpdateSet = (
    exerciseIndex: number,
    setIndex: number,
    field: keyof ExerciseSet,
    val: any
  ) => {
    setExercises(prev => {
      const next = [...prev];
      const targetEx = { ...next[exerciseIndex] };
      const updatedSets = [...targetEx.sets];
      updatedSets[setIndex] = {
        ...updatedSets[setIndex],
        [field]: val,
      };
      targetEx.sets = updatedSets;
      next[exerciseIndex] = targetEx;
      return next;
    });
  };

  const handleSetInputChange = (
    exerciseIndex: number,
    setIndex: number,
    field: keyof ExerciseSet,
    val: string
  ) => {
    const targetEx = exercises[exerciseIndex];
    const targetSet = targetEx?.sets[setIndex];
    const setKey = `${targetEx?.id || exerciseIndex}_${targetSet?.id || setIndex}_${field}`;
    const isDecimalField = field === 'weight' || field === 'distanceKm';

    let cleanString = val;
    let parsedVal: number = 0;

    if (isDecimalField) {
      // Replace ALL commas with dots for Turkish/European keyboards
      cleanString = val.replace(/,/g, '.').replace(/[^0-9.]/g, '');
      const parts = cleanString.split('.');
      if (parts.length > 2) {
        cleanString = parts[0] + '.' + parts.slice(1).join('');
      }
      setRawInputMap(prev => ({ ...prev, [setKey]: cleanString }));
      const f = parseFloat(cleanString);
      parsedVal = isNaN(f) ? 0 : f;
    } else if (field === 'reps' || field === 'durationMinutes' || field === 'caloriesBurned' || field === 'rir') {
      cleanString = val.replace(/[^0-9]/g, '');
      setRawInputMap(prev => ({ ...prev, [setKey]: cleanString }));
      if (field === 'rir' && cleanString === '') {
        handleUpdateSet(exerciseIndex, setIndex, 'rir', undefined);
        return;
      }
      parsedVal = cleanString === '' ? 0 : parseInt(cleanString, 10);
    }

    handleUpdateSet(exerciseIndex, setIndex, field, parsedVal);
  };

  const handleBlurDecimal = (exerciseIndex: number, setIndex: number, field: keyof ExerciseSet) => {
    const targetEx = exercises[exerciseIndex];
    const targetSet = targetEx?.sets[setIndex];
    const setKey = `${targetEx?.id || exerciseIndex}_${targetSet?.id || setIndex}_${field}`;
    if (rawInputMap[setKey]?.endsWith('.')) {
      const cleaned = rawInputMap[setKey].slice(0, -1);
      setRawInputMap(prev => ({ ...prev, [setKey]: cleaned }));
    }
  };

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Hata', 'Lütfen antrenman adı girin.');
      return;
    }

    const durSecs = (parseInt(durationMinutes, 10) || 0) * 60;

    let totVol = 0;
    let totSets = 0;
    let totCardioDist = 0;
    let totCardioMin = 0;

    exercises.forEach(ex => {
      ex.sets.forEach(s => {
        if (s.completed) {
          totSets++;
          if (s.weight && s.reps) {
            totVol += s.weight * s.reps;
          }
          if (s.distanceKm) {
            totCardioDist += s.distanceKm;
          }
          if (s.durationMinutes) {
            totCardioMin += s.durationMinutes;
          }
        }
      });
    });

    const updatedWorkout: WorkoutSession = {
      ...workout,
      name: name.trim(),
      date: date.trim() || workout.date,
      durationSeconds: durSecs > 0 ? durSecs : workout.durationSeconds,
      notes: notes.trim(),
      exercises,
      totalVolume: Math.round(totVol),
      totalSets: totSets,
      totalCardioDistanceKm: totCardioDist > 0 ? Math.round(totCardioDist * 10) / 10 : undefined,
      totalCardioMinutes: totCardioMin > 0 ? Math.round(totCardioMin) : undefined,
    };

    onSave(updatedWorkout);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <Text style={styles.cancelText}>Vazgeç</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Antrenmanı Düzenle</Text>
          <TouchableOpacity onPress={handleSave} style={[styles.headerBtn, styles.saveBtn]}>
            <Text style={styles.saveText}>Kaydet</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Metadata Card */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>GENEL BİLGİLER</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Antrenman Adı</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Örn: İtiş A, Full Body"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>

            <View style={styles.rowTwo}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Tarih (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.input}
                  value={date}
                  onChangeText={setDate}
                  placeholder="2026-10-11"
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Süre (Dakika)</Text>
                <TextInput
                  style={styles.input}
                  value={durationMinutes}
                  onChangeText={setDurationMinutes}
                  keyboardType="numeric"
                  placeholder="60"
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Notlar</Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Bu antrenmanla ilgili notlar..."
                placeholderTextColor={COLORS.textMuted}
                multiline
              />
            </View>
          </View>

          {/* Exercises */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>EGZERSİZLER ({exercises.length})</Text>
            <TouchableOpacity
              style={styles.addExerciseBtn}
              onPress={() => setShowExercisePicker(true)}
            >
              <Ionicons name="add" size={16} color="#111111" />
              <Text style={styles.addExerciseBtnText}>Egzersiz Ekle</Text>
            </TouchableOpacity>
          </View>

          {exercises.map((ex, exIdx) => {
            const isCardio = ex.category === 'Kardiyo';

            return (
              <View key={ex.id || `ex_${exIdx}`} style={styles.exerciseCard}>
                <View style={styles.exerciseHeader}>
                  <View style={styles.exerciseHeaderLeft}>
                    <Text style={styles.exerciseName}>{ex.exerciseName}</Text>
                    <Text style={styles.exerciseMeta}>
                      {ex.category} • {ex.equipment}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleRemoveExercise(exIdx)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                  </TouchableOpacity>
                </View>

                {/* Table Header */}
                <View style={styles.setTableHeader}>
                  <Text style={[styles.colHead, styles.colSet]}>SET</Text>
                  {isCardio ? (
                    <>
                      <Text style={[styles.colHead, styles.colInput]}>SÜRE (DK)</Text>
                      <Text style={[styles.colHead, styles.colInput]}>MESAFE (KM)</Text>
                      <Text style={[styles.colHead, styles.colInput]}>KALORİ</Text>
                    </>
                  ) : (
                    <>
                      <Text style={[styles.colHead, styles.colInput]}>AĞIRLIK (KG)</Text>
                      <Text style={[styles.colHead, styles.colInput]}>TEKRAR</Text>
                      <Text style={[styles.colHead, styles.colInput]}>RIR</Text>
                    </>
                  )}
                  <Text style={[styles.colHead, styles.colCheck]}>TAMAM</Text>
                  <View style={styles.colDelete} />
                </View>

                {/* Set Rows */}
                {ex.sets.map((set, setIdx) => {
                  const setKeyPrefix = `${ex.id || exIdx}_${set.id || setIdx}`;
                  const weightKey = `${setKeyPrefix}_weight`;
                  const weightDisplay = rawInputMap[weightKey] !== undefined
                    ? rawInputMap[weightKey]
                    : (set.weight !== undefined && set.weight !== 0 ? String(set.weight) : '');

                  const repsKey = `${setKeyPrefix}_reps`;
                  const repsDisplay = rawInputMap[repsKey] !== undefined
                    ? rawInputMap[repsKey]
                    : (set.reps !== undefined && set.reps !== 0 ? String(set.reps) : '');

                  const rirKey = `${setKeyPrefix}_rir`;
                  const rirDisplay = rawInputMap[rirKey] !== undefined
                    ? rawInputMap[rirKey]
                    : (set.rir !== undefined ? String(set.rir) : '');

                  const durKey = `${setKeyPrefix}_durationMinutes`;
                  const durDisplay = rawInputMap[durKey] !== undefined
                    ? rawInputMap[durKey]
                    : (set.durationMinutes !== undefined && set.durationMinutes !== 0 ? String(set.durationMinutes) : '');

                  const distKey = `${setKeyPrefix}_distanceKm`;
                  const distDisplay = rawInputMap[distKey] !== undefined
                    ? rawInputMap[distKey]
                    : (set.distanceKm !== undefined && set.distanceKm !== 0 ? String(set.distanceKm) : '');

                  const calKey = `${setKeyPrefix}_caloriesBurned`;
                  const calDisplay = rawInputMap[calKey] !== undefined
                    ? rawInputMap[calKey]
                    : (set.caloriesBurned !== undefined && set.caloriesBurned !== 0 ? String(set.caloriesBurned) : '');

                  return (
                  <View key={set.id || `s_${setIdx}`} style={styles.setRow}>
                    <View style={styles.colSet}>
                      <Text style={styles.setNumText}>{set.setNumber}</Text>
                    </View>

                    {isCardio ? (
                      <>
                        <TextInput
                          style={[styles.inputCell, styles.colInput]}
                          keyboardType="numeric"
                          value={durDisplay}
                          onChangeText={txt =>
                            handleSetInputChange(exIdx, setIdx, 'durationMinutes', txt)
                          }
                          placeholder="0"
                          placeholderTextColor={COLORS.textMuted}
                        />
                        <TextInput
                          style={[styles.inputCell, styles.colInput]}
                          keyboardType="decimal-pad"
                          value={distDisplay}
                          onChangeText={txt =>
                            handleSetInputChange(exIdx, setIdx, 'distanceKm', txt)
                          }
                          onBlur={() => handleBlurDecimal(exIdx, setIdx, 'distanceKm')}
                          placeholder="0"
                          placeholderTextColor={COLORS.textMuted}
                        />
                        <TextInput
                          style={[styles.inputCell, styles.colInput]}
                          keyboardType="numeric"
                          value={calDisplay}
                          onChangeText={txt =>
                            handleSetInputChange(exIdx, setIdx, 'caloriesBurned', txt)
                          }
                          placeholder="0"
                          placeholderTextColor={COLORS.textMuted}
                        />
                      </>
                    ) : (
                      <>
                        <TextInput
                          style={[styles.inputCell, styles.colInput]}
                          keyboardType="decimal-pad"
                          value={weightDisplay}
                          onChangeText={txt =>
                            handleSetInputChange(exIdx, setIdx, 'weight', txt)
                          }
                          onBlur={() => handleBlurDecimal(exIdx, setIdx, 'weight')}
                          placeholder="0"
                          placeholderTextColor={COLORS.textMuted}
                        />
                        <TextInput
                          style={[styles.inputCell, styles.colInput]}
                          keyboardType="numeric"
                          value={repsDisplay}
                          onChangeText={txt =>
                            handleSetInputChange(exIdx, setIdx, 'reps', txt)
                          }
                          placeholder="0"
                          placeholderTextColor={COLORS.textMuted}
                        />
                        <TextInput
                          style={[styles.inputCell, styles.colInput]}
                          keyboardType="numeric"
                          value={rirDisplay}
                          onChangeText={txt =>
                            handleSetInputChange(exIdx, setIdx, 'rir', txt)
                          }
                          placeholder="-"
                          placeholderTextColor={COLORS.textMuted}
                        />
                      </>
                    )}

                    {/* Completed Checkbox */}
                    <TouchableOpacity
                      style={[styles.checkBtn, set.completed && styles.checkBtnActive]}
                      onPress={() => handleUpdateSet(exIdx, setIdx, 'completed', !set.completed)}
                    >
                      <Ionicons
                        name={set.completed ? 'checkmark' : 'close'}
                        size={14}
                        color={set.completed ? '#111111' : COLORS.textMuted}
                      />
                    </TouchableOpacity>

                    {/* Delete Set Button */}
                    <TouchableOpacity
                      style={styles.colDelete}
                      onPress={() => handleRemoveSet(exIdx, setIdx)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close-circle-outline" size={16} color={COLORS.danger} />
                    </TouchableOpacity>
                  </View>
                );
              })}

                {/* Add Set Button */}
                <TouchableOpacity
                  style={styles.addSetBtn}
                  onPress={() => handleAddSet(exIdx)}
                >
                  <Ionicons name="add" size={14} color={COLORS.primary} />
                  <Text style={styles.addSetBtnText}>Set Ekle</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>

        {showExercisePicker && (
          <ExercisePickerModal
            visible={showExercisePicker}
            onClose={() => setShowExercisePicker(false)}
            onSelectExercise={handleAddExercise}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  headerBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  saveText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111111',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
    ...SHADOWS.soft,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },
  addExerciseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
  },
  addExerciseBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111111',
  },
  inputGroup: {
    gap: 6,
  },
  rowTwo: {
    flexDirection: 'row',
    gap: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  notesInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  exerciseCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
    ...SHADOWS.soft,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  exerciseHeaderLeft: {
    flex: 1,
    gap: 2,
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  exerciseMeta: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  setTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  colHead: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  colSet: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setNumText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  colInput: {
    flex: 1,
  },
  colCheck: {
    width: 34,
    textAlign: 'center',
  },
  colDelete: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 3,
  },
  inputCell: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 4,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  checkBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    borderRadius: 10,
    marginTop: 4,
  },
  addSetBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
});
