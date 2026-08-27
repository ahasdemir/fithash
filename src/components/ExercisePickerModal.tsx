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
              <Ionicons name="search" size={18} color={COLORS.textMuted} />
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
              <Ionicons name="add" size={20} color="#111111" />
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
              { paddingBottom: Math.max(insets.bottom, 16) + 80 }
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
                      <View style={[styles.badge, { backgroundColor: catColor + '15' }]}>
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
                        <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                      </TouchableOpacity>
                    )}
                    <Ionicons name="add-circle" size={26} color="#111111" />
                  </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="barbell-outline" size={40} color={COLORS.textMuted} />
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '92%',
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 0,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  exerciseFlatList: {
    flex: 1,
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
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 100,
    paddingHorizontal: 16,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  addBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoriesWrapper: {
    marginVertical: 8,
    marginHorizontal: -4,
  },
  categoryListContent: {
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  categoryChip: {
    backgroundColor: COLORS.surfaceSubtle,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 6,
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
    paddingVertical: 10,
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  exerciseInfo: {
    flex: 1,
    paddingRight: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  customTag: {
    backgroundColor: COLORS.primaryGlow,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 100,
  },
  customTagText: {
    color: '#111111',
    fontSize: 10,
    fontWeight: '700',
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 100,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  badgeEquipment: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  badgeEquipmentText: {
    color: COLORS.textSecondary,
    fontSize: 11,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  createBtnInline: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 100,
    marginTop: 8,
  },
  createBtnInlineText: {
    color: '#111111',
    fontWeight: '800',
    fontSize: 13,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deleteBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
});
