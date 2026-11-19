import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { Exercise, MuscleCategory } from '../types/fitness';
import { getExercises, saveCustomExercise, deleteCustomExercise } from '../services/storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AddExerciseModal } from './AddExerciseModal';
import { CustomAlertModal, CustomAlertOptions } from './CustomAlertModal';

interface ExercisePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectExercise: (exercise: Exercise) => void;
}

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

export const ExercisePickerModal: React.FC<ExercisePickerModalProps> = ({
  visible,
  onClose,
  onSelectExercise,
}) => {
  const insets = useSafeAreaInsets();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MuscleCategory | 'Hepsi'>('Hepsi');
  const [showAddModal, setShowAddModal] = useState(false);
  const [customAlert, setCustomAlert] = useState<CustomAlertOptions | null>(null);

  useEffect(() => {
    if (visible) {
      loadExercises();
    }
  }, [visible]);

  const loadExercises = async () => {
    const data = await getExercises();
    setExercises(data);
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
      },
      onCancel: () => setCustomAlert(null),
    });
  };

  const filteredExercises = exercises.filter(ex => {
    const matchesCategory = selectedCategory === 'Hepsi' || ex.category === selectedCategory;
    const matchesSearch = ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (ex.targetMuscle && ex.targetMuscle.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const handleCustomExerciseSaved = (newEx: Exercise) => {
    setExercises(prev => [newEx, ...prev]);
    onSelectExercise(newEx);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Hareket Seç</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close-circle" size={26} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Search bar & Add Custom button */}
          <View style={styles.topActions}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={16} color={COLORS.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Egzersiz ara..."
                placeholderTextColor={COLORS.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-outline" size={18} color={COLORS.textMuted} />
                </TouchableOpacity>
              ) : null}
            </View>

            <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
              <Ionicons name="add" size={20} color={COLORS.textInverted} />
            </TouchableOpacity>
          </View>

          {/* Category Chips */}
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
            style={styles.exerciseFlatList}
            data={filteredExercises}
            keyExtractor={item => item.id}
            contentContainerStyle={[
              styles.listContainer,
              { paddingBottom: Math.max(insets.bottom, 16) + 70 }
            ]}
            showsVerticalScrollIndicator={true}
            renderItem={({ item }) => {
              const catColor = COLORS.category[item.category] || COLORS.textPrimary;
              return (
                <TouchableOpacity
                  style={styles.exerciseCard}
                  activeOpacity={0.8}
                  onPress={() => {
                    onSelectExercise(item);
                    onClose();
                  }}
                >
                  <View style={styles.exerciseInfo}>
                    <View style={styles.titleRow}>
                      <Text style={styles.exerciseName}>{item.name}</Text>
                      {item.isCustom && (
                        <View style={styles.customTag}>
                          <Text style={styles.customTagText}>Özel</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.tagsRow}>
                      <View style={[styles.badge, { backgroundColor: catColor + '20' }]}>
                        <Text style={[styles.badgeText, { color: catColor }]}>{item.category}</Text>
                      </View>
                      <View style={styles.badgeEquipment}>
                        <Text style={styles.badgeEquipmentText}>{item.equipment}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.cardActions}>
                    {item.isCustom && (
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={(e) => {
                          e.stopPropagation();
                          handlePromptDeleteCustom(item);
                        }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
                      </TouchableOpacity>
                    )}
                    <Ionicons name="add-circle" size={24} color={COLORS.primary} />
                  </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="barbell-outline" size={36} color={COLORS.textMuted} />
                <Text style={styles.emptyText}>Aradığınız egzersiz bulunamadı</Text>
                <TouchableOpacity
                  style={styles.createBtnInline}
                  onPress={() => setShowAddModal(true)}
                >
                  <Text style={styles.createBtnInlineText}>+ Yeni Hareket Ekle</Text>
                </TouchableOpacity>
              </View>
            }
          />
        </View>
      </View>

      <AddExerciseModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleCustomExerciseSaved}
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
    backgroundColor: 'rgba(6, 12, 18, 0.78)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    height: '92%',
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 0,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
  },
  exerciseFlatList: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 38,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 13,
  },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoriesWrapper: {
    marginVertical: 6,
    marginHorizontal: -4,
  },
  categoryListContent: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  categoryChip: {
    backgroundColor: COLORS.surfaceSubtle,
    paddingHorizontal: 10,
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
    fontSize: 11,
    fontWeight: '700',
  },
  categoryChipTextSelected: {
    color: COLORS.textInverted,
    fontWeight: '800',
  },
  listContainer: {
    paddingBottom: 20,
    paddingHorizontal: 2,
    paddingTop: 2,
  },
  exerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceSubtle,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  exerciseInfo: {
    flex: 1,
    paddingRight: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  exerciseName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  customTag: {
    backgroundColor: COLORS.primaryGlow,
    borderWidth: 1,
    borderColor: 'rgba(76, 194, 255, 0.35)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  customTagText: {
    color: COLORS.primary,
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  badgeEquipment: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  badgeEquipmentText: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  createBtnInline: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 6,
  },
  createBtnInlineText: {
    color: COLORS.textInverted,
    fontWeight: '800',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  deleteBtn: {
    padding: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.25)',
  },
});
