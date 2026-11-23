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
import { COLORS, useTheme, subscribeTheme } from '../theme';
import { Exercise, MuscleCategory, WorkoutSession, PersonalRecord } from '../types/fitness';
import { getExercises, saveCustomExercise, deleteCustomExercise } from '../services/storage';
import { AddExerciseModal } from '../components/AddExerciseModal';
import { CustomAlertModal, CustomAlertOptions } from '../components/CustomAlertModal';
import { ExercisePRDetailModal } from '../components/ExercisePRDetailModal';
import { FILTER_CATEGORIES } from '../utils/exerciseHelpers';

interface LibraryTabProps {
  workouts?: WorkoutSession[];
  prs?: Record<string, PersonalRecord>;
}

export const LibraryTab: React.FC<LibraryTabProps> = ({ workouts = [], prs = {} }) => {
  const { mode } = useTheme();
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

  // Track max lifted weight per strength exercise (excludes cardio/0kg and warmup sets)
  const exercisePRMap = useMemo(() => {
    const map: Record<string, { maxWeight: number }> = {};

    Object.values(prs).forEach(pr => {
      if (pr.maxWeight > 0) {
        const key = pr.exerciseName.toLowerCase().trim();
        map[key] = { maxWeight: pr.maxWeight };
      }
    });

    workouts.forEach(w => {
      if (w.completed === false) return;
      w.exercises.forEach(ex => {
        if (ex.category === 'Kardiyo') return;
        const key = ex.exerciseName.toLowerCase().trim();
        const completedSets = ex.sets?.filter(s => s.completed && !s.isWarmup) || [];
        completedSets.forEach(s => {
          if (s.weight > 0 && s.reps > 0) {
            if (!map[key] || s.weight > map[key].maxWeight) {
              map[key] = { maxWeight: s.weight };
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

  const filteredExercises = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return exercises.filter(ex => {
      const matchesCat = selectedCategory === 'Hepsi' || ex.category === selectedCategory;
      const matchesSearch =
        !query ||
        ex.name.toLowerCase().includes(query) ||
        (!!ex.targetMuscle && ex.targetMuscle.toLowerCase().includes(query));
      return matchesCat && matchesSearch;
    });
  }, [exercises, selectedCategory, searchQuery]);

  return (
    <View style={styles.container}>
      {/* Top Title & Add Button */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Kütüphane</Text>
          <Text style={styles.subtitle}>
            {filteredExercises.length} / {exercises.length} egzersiz
          </Text>
        </View>

        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
          <Ionicons name="add" size={15} color={COLORS.primaryText} />
          <Text style={styles.addBtnText}>Egzersiz Ekle</Text>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color={COLORS.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Egzersiz adı veya hedef kas ara..."
          placeholderTextColor={COLORS.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Category Pills */}
      <View style={styles.categoriesWrapper}>
        <FlatList
          horizontal
          data={FILTER_CATEGORIES}
          extraData={`${mode}_${selectedCategory}`}
          keyExtractor={item => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryListContent}
          renderItem={({ item }) => {
            const isSelected = selectedCategory === item;
            return (
              <TouchableOpacity
                style={[styles.categoryChip, isSelected && styles.categoryChipSelected]}
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

      {/* Compact Scannable Exercise List */}
      <FlatList
        data={filteredExercises}
        extraData={mode}
        keyExtractor={item => item.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: 120 + Math.max(insets.bottom, 16) },
        ]}
        renderItem={({ item }) => {
          const catColor = COLORS.category[item.category] || COLORS.textSecondary;
          const prInfo =
            item.category !== 'Kardiyo'
              ? exercisePRMap[item.name.toLowerCase().trim()]
              : undefined;
          return (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.82}
              onPress={() => setSelectedExercise(item)}
            >
              <View style={styles.cardLeft}>
                <View style={styles.titleRow}>
                  <Text style={styles.exName} numberOfLines={1} ellipsizeMode="tail">
                    {item.name}
                  </Text>
                  {item.isCustom && (
                    <View style={[styles.customBadge, { backgroundColor: COLORS.pastel.lavenderBg }]}>
                      <Text style={[styles.customBadgeText, { color: COLORS.pastel.lavender }]}>
                        Özel
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.badgeRow}>
                  <View style={[styles.catBadge, { backgroundColor: catColor + '20' }]}>
                    <Text style={[styles.catBadgeText, { color: catColor }]}>{item.category}</Text>
                  </View>
                  <Text style={styles.metaText} numberOfLines={1}>
                    {item.equipment}
                    {item.targetMuscle ? ` · ${item.targetMuscle}` : ''}
                  </Text>
                </View>
              </View>

              <View style={styles.cardRight}>
                {prInfo && prInfo.maxWeight > 0 ? (
                  <View style={[styles.prBadge, { backgroundColor: COLORS.pastel.greenBg }]}>
                    <Text style={[styles.prBadgeText, { color: COLORS.pastel.green }]}>
                      {prInfo.maxWeight} kg
                    </Text>
                  </View>
                ) : null}
                {item.isCustom && (
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handlePromptDeleteCustom(item)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="trash-outline" size={15} color={COLORS.pastel.rose} />
                  </TouchableOpacity>
                )}
                <Ionicons name="chevron-forward" size={15} color={COLORS.textMuted} />
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Detail Modal */}
      {selectedExercise && (
        <Modal
          visible
          animationType="slide"
          transparent
          onRequestClose={() => setSelectedExercise(null)}
        >
          <TouchableOpacity
            style={styles.overlay}
            activeOpacity={1}
            onPress={() => setSelectedExercise(null)}
          >
            <TouchableOpacity
              style={styles.modalContainer}
              activeOpacity={1}
              onPress={e => e.stopPropagation()}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{selectedExercise.name}</Text>
                <TouchableOpacity onPress={() => setSelectedExercise(null)}>
                  <Ionicons name="close-circle" size={24} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.modalBody}
                contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) + 24 }}
              >
                <View style={styles.modalBadgeRow}>
                  <View
                    style={[
                      styles.catBadge,
                      {
                        backgroundColor:
                          (COLORS.category[selectedExercise.category] || COLORS.textSecondary) +
                          '20',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.catBadgeText,
                        {
                          color:
                            COLORS.category[selectedExercise.category] || COLORS.textPrimary,
                        },
                      ]}
                    >
                      {selectedExercise.category}
                    </Text>
                  </View>
                  <View style={styles.eqBadge}>
                    <Text style={styles.eqBadgeText}>{selectedExercise.equipment}</Text>
                  </View>
                  {selectedExercise.isCustom && (
                    <View
                      style={[styles.customBadge, { backgroundColor: COLORS.pastel.lavenderBg }]}
                    >
                      <Text style={[styles.customBadgeText, { color: COLORS.pastel.lavender }]}>
                        Özel Egzersiz
                      </Text>
                    </View>
                  )}
                </View>

                {selectedExercise.targetMuscle && (
                  <View style={styles.infoBox}>
                    <Text style={styles.infoBoxLabel}>Hedef Kas</Text>
                    <Text style={styles.infoBoxVal}>{selectedExercise.targetMuscle}</Text>
                  </View>
                )}

                {selectedExercise.instructions && (
                  <View style={styles.infoBox}>
                    <Text style={styles.infoBoxLabel}>Nasıl Yapılır / İpuçları</Text>
                    <Text style={styles.infoBoxText}>{selectedExercise.instructions}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.prInspectActionBtn}
                  activeOpacity={0.8}
                  onPress={() => {
                    const ex = selectedExercise;
                    setSelectedExercise(null);
                    setSelectedExerciseForPR(ex);
                  }}
                >
                  <Ionicons name="stats-chart-outline" size={15} color={COLORS.primaryText} />
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
                    <Ionicons name="trash-outline" size={15} color={COLORS.pastel.rose} />
                    <Text style={styles.deleteModalBtnText}>Bu Özel Egzersizi Sil</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
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

      {customAlert && <CustomAlertModal {...customAlert} />}
    </View>
  );
};

const createStyles = () =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
      padding: 16,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    title: {
      fontSize: 19,
      fontWeight: '800',
      color: COLORS.textPrimary,
      letterSpacing: -0.3,
    },
    subtitle: {
      fontSize: 12,
      color: COLORS.textMuted,
      fontVariant: ['tabular-nums'],
    },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: COLORS.primary,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 6,
    },
    addBtnText: {
      color: COLORS.primaryText,
      fontWeight: '700',
      fontSize: 12,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 7,
      paddingHorizontal: 12,
      height: 38,
      gap: 8,
      marginBottom: 6,
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
      paddingVertical: 4,
    },
    categoryChip: {
      backgroundColor: COLORS.surface,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: COLORS.border,
      marginRight: 6,
    },
    categoryChipSelected: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
    },
    categoryChipText: {
      color: COLORS.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    categoryChipTextSelected: {
      color: COLORS.primaryText,
      fontWeight: '700',
    },
    listContent: {
      paddingTop: 2,
      gap: 7,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: COLORS.surface,
      paddingHorizontal: 13,
      paddingVertical: 11,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: COLORS.border,
      gap: 10,
    },
    cardLeft: {
      flex: 1,
      minWidth: 0,
      gap: 5,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    exName: {
      fontSize: 14,
      fontWeight: '700',
      color: COLORS.textPrimary,
      flexShrink: 1,
    },
    customBadge: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 4,
    },
    customBadgeText: {
      fontSize: 10,
      fontWeight: '700',
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    catBadge: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 4,
    },
    catBadgeText: {
      fontSize: 10,
      fontWeight: '700',
    },
    metaText: {
      flex: 1,
      color: COLORS.textMuted,
      fontSize: 11,
    },
    eqBadge: {
      backgroundColor: COLORS.surfaceSubtle,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 5,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    eqBadgeText: {
      color: COLORS.textSecondary,
      fontSize: 11,
    },
    cardRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexShrink: 0,
    },
    prBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 5,
    },
    prBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    deleteBtn: {
      padding: 5,
      borderRadius: 6,
      backgroundColor: COLORS.pastel.roseBg,
    },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    modalContainer: {
      backgroundColor: COLORS.surface,
      borderTopLeftRadius: 10,
      borderTopRightRadius: 10,
      padding: 18,
      maxHeight: '75%',
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: COLORS.textPrimary,
      flex: 1,
      marginRight: 8,
    },
    modalBody: {
      marginVertical: 14,
    },
    modalBadgeRow: {
      flexDirection: 'row',
      gap: 6,
      marginBottom: 14,
      flexWrap: 'wrap',
    },
    infoBox: {
      marginBottom: 14,
      gap: 3,
    },
    infoBoxLabel: {
      color: COLORS.textMuted,
      fontSize: 11,
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
    prInspectActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: COLORS.primary,
      paddingVertical: 12,
      borderRadius: 6,
      marginTop: 10,
    },
    prInspectActionBtnText: {
      color: COLORS.primaryText,
      fontWeight: '800',
      fontSize: 13,
    },
    deleteModalBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: COLORS.pastel.roseBg,
      paddingVertical: 12,
      borderRadius: 6,
      marginTop: 10,
    },
    deleteModalBtnText: {
      color: COLORS.pastel.rose,
      fontWeight: '700',
      fontSize: 13,
    },
  });

let styles = createStyles();
subscribeTheme(() => {
  styles = createStyles();
});
