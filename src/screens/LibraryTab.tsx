import React, { useState, useEffect } from 'react';
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
import { COLORS, SHADOWS } from '../theme';
import { Exercise, MuscleCategory } from '../types/fitness';
import { getExercises, saveCustomExercise } from '../services/storage';
import { AddExerciseModal } from '../components/AddExerciseModal';

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

export const LibraryTab: React.FC = () => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MuscleCategory | 'Hepsi'>('Hepsi');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const data = await getExercises();
    setExercises(data);
  };

  const handleSaveCustom = async (newEx: Exercise) => {
    const updated = await saveCustomExercise(newEx);
    setExercises(updated);
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
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const catColor = COLORS.category[item.category] || COLORS.textPrimary;
          return (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => setSelectedExercise(item)}
            >
              <View style={styles.cardLeft}>
                <View style={styles.titleRow}>
                  <Text style={styles.exName}>{item.name}</Text>
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
                  {item.targetMuscle && (
                    <Text style={styles.targetText}>• {item.targetMuscle}</Text>
                  )}
                </View>
              </View>

              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
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

              <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 24 }}>
                <View style={styles.modalBadgeRow}>
                  <View style={[styles.catBadge, { backgroundColor: (COLORS.category[selectedExercise.category] || '#111111') + '20' }]}>
                    <Text style={[styles.catBadgeText, { color: COLORS.category[selectedExercise.category] || '#111111' }]}>
                      {selectedExercise.category}
                    </Text>
                  </View>
                  <View style={styles.eqBadge}>
                    <Text style={styles.eqBadgeText}>{selectedExercise.equipment}</Text>
                  </View>
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
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      <AddExerciseModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleSaveCustom}
      />
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
});
