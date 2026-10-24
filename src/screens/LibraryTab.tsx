import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SHADOWS } from '../theme';
import { Exercise, MuscleCategory, WorkoutSession, PersonalRecord } from '../types/fitness';
import { getExercises, saveCustomExercise, deleteCustomExercise } from '../services/storage';
import { AddExerciseModal } from '../components/AddExerciseModal';
import { CustomAlertModal, CustomAlertOptions } from '../components/CustomAlertModal';
import { ExercisePRDetailModal } from '../components/ExercisePRDetailModal';

const CATEGORIES: (MuscleCategory | 'Hepsi')[] = [
  'Hepsi',
  'Göğüs',
  'Sırt',
  'Bacak',
  'Omuz',
  'Ön Kol',
  'Arka Kol',
  'Karın',
  'Kardiyo',
];

interface LibraryTabProps {
  workouts?: WorkoutSession[];
  prs?: Record<string, PersonalRecord>;
}

export const LibraryTab: React.FC<LibraryTabProps> = ({ workouts = [], prs = {} }) => {
  const insets = useSafeAreaInsets();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MuscleCategory | 'Hepsi'>('Hepsi');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [selectedExerciseForPR, setSelectedExerciseForPR] = useState<Exercise | null>(null);
  const [customAlert, setCustomAlert] = useState<CustomAlertOptions | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const data = await getExercises();
    setExercises(data);
  };

  // Egzersizlerin rekor ve son çalışma durumu haritası
  const exercisePRMap = useMemo(() => {
    const map: Record<string, { maxWeight: number; maxReps: number; max1RM: number; isRecent: boolean }> = {};
    const now = new Date().getTime();

    // PR tablosu
    Object.values(prs).forEach(pr => {
      const key = pr.exerciseName.toLowerCase().trim();
      map[key] = {
        maxWeight: pr.maxWeight,
        maxReps: pr.maxReps,
        max1RM: pr.maxEstimatedOneRepMax || Math.round(pr.maxWeight * 1.05),
        isRecent: false,
      };
    });

    // Antrenman geçmişi
    workouts.forEach(w => {
      if (w.completed === false) return;
      const wTime = new Date(w.date).getTime();
      const isThisWeek = (now - wTime) <= 7 * 24 * 3600 * 1000;

      w.exercises.forEach(ex => {
        const key = ex.exerciseName.toLowerCase().trim();
        const completedSets = ex.sets?.filter(s => s.completed) || [];
        completedSets.forEach(s => {
          if (s.weight && s.reps) {
            const e1rm = Math.round(s.weight * (1 + s.reps / 30));
            if (!map[key]) {
              map[key] = { maxWeight: s.weight, maxReps: s.reps, max1RM: e1rm, isRecent: isThisWeek };
            } else {
              if (s.weight > map[key].maxWeight || (s.weight === map[key].maxWeight && s.reps > map[key].maxReps)) {
                map[key].maxWeight = s.weight;
                map[key].maxReps = s.reps;
              }
              if (e1rm > map[key].max1RM) map[key].max1RM = e1rm;
              if (isThisWeek) map[key].isRecent = true;
            }
          }
        });
      });
    });

    return map;
  }, [prs, workouts]);

  const handleSaveCustom = async (newEx: Exercise) => {
    const updated = await saveCustomExercise(newEx);
    setExercises(updated);
  };

  const handlePromptDeleteCustom = (exercise: Exercise) => {
    setCustomAlert({
      visible: true,
      type: 'danger',
      title: 'Özel Egzersiz Silinsin mi?',
      message: `"${exercise.name}" egzersizi kütüphaneden kalıcı olarak silinecektir. Emin misiniz?`,
      confirmText: 'Evet, Sil',
      cancelText: 'Vazgeç',
      onConfirm: async () => {
        setCustomAlert(null);
        const updated = await deleteCustomExercise(exercise.id);
        setExercises(updated);
        if (selectedExercise && selectedExercise.id === exercise.id) {
          setSelectedExercise(null);
        }
      },
      onCancel: () => setCustomAlert(null),
    });
  };

  const filteredExercises = exercises.filter(ex => {
    const matchesCat = selectedCategory === 'Hepsi' || ex.category === selectedCategory;
    const matchesSearch = ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (ex.targetMuscle && ex.targetMuscle.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  return (
    <View style={styles.container}>
      {/* Top Title & Add Button */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Hareket Kütüphanesi</Text>
          <Text style={styles.subtitle}>{exercises.length} Gym Egzersizi</Text>
        </View>

        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
          <Ionicons name="add" size={16} color="#111111" />
          <Text style={styles.addBtnText}>Egzersiz Ekle</Text>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={COLORS.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Egzersiz adı veya kas grubu ara..."
          placeholderTextColor={COLORS.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Category Pills */}
      <View style={styles.categoriesWrapper}>
        <FlatList
          horizontal
          data={CATEGORIES}
          keyExtractor={item => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryListContent}
          renderItem={({ item }) => {
            const isSelected = selectedCategory === item;
            return (
              <TouchableOpacity
                style={[
                  styles.categoryChip,
                  isSelected && styles.categoryChipSelected,
                ]}
                onPress={() => setSelectedCategory(item)}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    isSelected && styles.categoryChipTextSelected,
                  ]}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Exercise List */}
      <FlatList
        data={filteredExercises}
        keyExtractor={item => item.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: 120 + Math.max(insets.bottom, 16) },
        ]}
        renderItem={({ item }) => {
          const catColor = COLORS.category[item.category] || COLORS.textPrimary;
          const prInfo = exercisePRMap[item.name.toLowerCase().trim()];
          return (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => setSelectedExercise(item)}
            >
              <View style={styles.cardLeft}>
                <View style={styles.titleRow}>
                  <Text style={styles.exName} numberOfLines={1} ellipsizeMode="tail">{item.name}</Text>
                  {item.isCustom && (
                    <View style={styles.customBadge}>
                      <Text style={styles.customBadgeText}>Özel</Text>
                    </View>
                  )}
                </View>

                <View style={styles.badgeRow}>
                  <View style={[styles.catBadge, { backgroundColor: catColor + '15' }]}>
                    <Text style={[styles.catBadgeText, { color: catColor }]}>{item.category}</Text>
                  </View>
                  <View style={styles.eqBadge}>
                    <Text style={styles.eqBadgeText}>{item.equipment}</Text>
                  </View>
                  {prInfo ? (
                    <View style={styles.prBadge}>
                      <Text style={styles.prBadgeText}>PR: {prInfo.maxWeight} kg</Text>
                    </View>
                  ) : null}
                  {item.targetMuscle && (
                    <Text style={styles.targetText}>• {item.targetMuscle}</Text>
                  )}
                </View>
              </View>

              <View style={styles.cardRight}>
                {item.isCustom && (
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handlePromptDeleteCustom(item)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
                  </TouchableOpacity>
                )}
                <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Detail Modal */}
      {selectedExercise && (
        <Modal visible animationType="slide" transparent>
          <View style={styles.overlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{selectedExercise.name}</Text>
                <TouchableOpacity onPress={() => setSelectedExercise(null)}>
                  <Ionicons name="close-circle" size={26} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.modalBody}
                contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) + 24 }}
              >
                <View style={styles.modalBadgeRow}>
                  <View style={[styles.catBadge, { backgroundColor: (COLORS.category[selectedExercise.category] || '#111111') + '20' }]}>
                    <Text style={[styles.catBadgeText, { color: COLORS.category[selectedExercise.category] || '#111111' }]}>
                      {selectedExercise.category}
                    </Text>
                  </View>
                  <View style={styles.eqBadge}>
                    <Text style={styles.eqBadgeText}>{selectedExercise.equipment}</Text>
                  </View>
                  {selectedExercise.isCustom && (
                    <View style={styles.customBadge}>
                      <Text style={styles.customBadgeText}>Özel Egzersiz</Text>
                    </View>
                  )}
                </View>

                {selectedExercise.targetMuscle && (
                  <View style={styles.infoBox}>
                    <Text style={styles.infoBoxLabel}>Hedef Kas:</Text>
                    <Text style={styles.infoBoxVal}>{selectedExercise.targetMuscle}</Text>
                  </View>
                )}

                {selectedExercise.instructions && (
                  <View style={styles.infoBox}>
                    <Text style={styles.infoBoxLabel}>Nasıl Yapılır / İpuçları:</Text>
                    <Text style={styles.infoBoxText}>{selectedExercise.instructions}</Text>
                  </View>
                )}

                {/* PR & Gelişim Analiz Butonu */}
                <TouchableOpacity
                  style={styles.prInspectActionBtn}
                  activeOpacity={0.8}
                  onPress={() => {
                    const ex = selectedExercise;
                    setSelectedExercise(null);
                    setSelectedExerciseForPR(ex);
                  }}
                >
                  <Ionicons name="stats-chart-outline" size={15} color="#111111" />
                  <Text style={styles.prInspectActionBtnText}>
                    {exercisePRMap[selectedExercise.name.toLowerCase().trim()]
                      ? 'Kişisel Rekor & Gelişim Analizi'
                      : 'Performans & 1RM Projeksiyonu'}
                  </Text>
                </TouchableOpacity>

                {selectedExercise.isCustom && (
                  <TouchableOpacity
                    style={styles.deleteModalBtn}
                    onPress={() => handlePromptDeleteCustom(selectedExercise)}
                  >
                    <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
                    <Text style={styles.deleteModalBtnText}>Bu Özel Egzersizi Sil</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      <ExercisePRDetailModal
        visible={!!selectedExerciseForPR}
        onClose={() => setSelectedExerciseForPR(null)}
        exercise={selectedExerciseForPR}
        workouts={workouts}
      />

      <AddExerciseModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleSaveCustom}
      />

      {customAlert && (
        <CustomAlertModal
          {...customAlert}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
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
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
  },
  addBtnText: {
    color: '#111111',
    fontWeight: '700',
    fontSize: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 100,
    paddingHorizontal: 14,
    height: 40,
    gap: 8,
    marginBottom: 8,
    ...SHADOWS.soft,
  },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 13,
  },
  categoriesWrapper: {
    marginBottom: 8,
    marginHorizontal: -4,
  },
  categoryListContent: {
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  categoryChip: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 6,
    ...SHADOWS.soft,
  },
  categoryChipSelected: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  categoryChipText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  categoryChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: 140,
    paddingHorizontal: 4,
    paddingTop: 4,
    gap: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.soft,
  },
  cardLeft: {
    flex: 1,
    gap: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  exName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    flexShrink: 1,
    flex: 1,
  },
  customBadge: {
    backgroundColor: COLORS.primaryGlow,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 100,
  },
  customBadgeText: {
    color: '#111111',
    fontSize: 10,
    fontWeight: '700',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  catBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 100,
  },
  catBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  eqBadge: {
    backgroundColor: COLORS.surfaceSubtle,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  eqBadgeText: {
    color: COLORS.textSecondary,
    fontSize: 11,
  },
  targetText: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '75%',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  modalBody: {
    marginVertical: 14,
  },
  modalBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  infoBox: {
    marginBottom: 14,
    gap: 4,
  },
  infoBoxLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  infoBoxVal: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  infoBoxText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    lineHeight: 20,
  },
  cardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deleteBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  prBadge: {
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 100,
  },
  prBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  prInspectActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 100,
    marginTop: 14,
  },
  prInspectActionBtnText: {
    color: '#111111',
    fontWeight: '800',
    fontSize: 13,
  },
  deleteModalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingVertical: 12,
    borderRadius: 100,
    marginTop: 12,
  },
  deleteModalBtnText: {
    color: COLORS.danger,
    fontWeight: '700',
    fontSize: 13,
  },
});
