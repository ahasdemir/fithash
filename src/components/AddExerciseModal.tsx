import React, { useState } from 'react';
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
import { Exercise, MuscleCategory, EquipmentType } from '../types/fitness';

interface AddExerciseModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (exercise: Exercise) => void;
}

const CATEGORIES: MuscleCategory[] = [
  'Göğüs',
  'Sırt',
  'Bacak',
  'Omuz',
  'Ön Kol',
  'Arka Kol',
  'Karın',
  'Kardiyo',
];

const EQUIPMENTS: EquipmentType[] = [
  'Barbell',
  'Dumbbell',
  'Makine',
  'Kablo',
  'Vücut Ağırlığı',
  'Kardiyo Cihazı',
  'Diğer',
];

export const AddExerciseModal: React.FC<AddExerciseModalProps> = ({
  visible,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<MuscleCategory>('Göğüs');
  const [equipment, setEquipment] = useState<EquipmentType>('Barbell');
  const [targetMuscle, setTargetMuscle] = useState('');
  const [instructions, setInstructions] = useState('');

  const handleSave = () => {
    if (!name.trim()) return;

    const newExercise: Exercise = {
      id: `custom_ex_${Date.now()}`,
      name: name.trim(),
      category,
      equipment,
      targetMuscle: targetMuscle.trim() || undefined,
      instructions: instructions.trim() || undefined,
      isCustom: true,
    };

    onSave(newExercise);
    setName('');
    setTargetMuscle('');
    setInstructions('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Yeni Egzersiz Ekle</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close-circle" size={26} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Egzersiz Adı *</Text>
            <TextInput
              style={styles.input}
              placeholder="Örn. Incline Cable Fly"
              placeholderTextColor={COLORS.textMuted}
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.label}>Kas Grubu (Kategori)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.chip,
                    category === cat && styles.chipSelected,
                  ]}
                  onPress={() => setCategory(cat)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      category === cat && styles.chipTextSelected,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>Ekipman Türü</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {EQUIPMENTS.map(eq => (
                <TouchableOpacity
                  key={eq}
                  style={[
                    styles.chip,
                    equipment === eq && styles.chipSelected,
                  ]}
                  onPress={() => setEquipment(eq)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      equipment === eq && styles.chipTextSelected,
                    ]}
                  >
                    {eq}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>Hedef Alt Kas (İsteğe Bağlı)</Text>
            <TextInput
              style={styles.input}
              placeholder="Örn. Üst Göğüs İç Kısım"
              placeholderTextColor={COLORS.textMuted}
              value={targetMuscle}
              onChangeText={setTargetMuscle}
            />

            <Text style={styles.label}>Uygulama Açıklaması / İpuçları</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Egzersiz ipuçları..."
              placeholderTextColor={COLORS.textMuted}
              multiline
              numberOfLines={3}
              value={instructions}
              onChangeText={setInstructions}
            />
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>İptal</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveBtn, !name.trim() && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={!name.trim()}
            >
              <Text style={styles.saveBtnText}>Kaydet</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
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
    maxHeight: '85%',
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  form: {
    marginVertical: 14,
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
  textArea: {
    borderRadius: 16,
    height: 70,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  chip: {
    backgroundColor: COLORS.surfaceSubtle,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 8,
  },
  chipSelected: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  chipText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
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
