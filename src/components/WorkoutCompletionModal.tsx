import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SHADOWS } from '../theme';
import { MuscleCategory, SessionFeedback } from '../types/fitness';

interface WorkoutCompletionModalProps {
  visible: boolean;
  workoutTitle?: string;
  muscleGroups: MuscleCategory[];
  totalSets: number;
  totalVolume: number;
  durationSeconds: number;
  onConfirm: (feedback?: SessionFeedback) => void;
  onClose: () => void;
}

export const WorkoutCompletionModal: React.FC<WorkoutCompletionModalProps> = ({
  visible,
  workoutTitle = 'Antrenman',
  muscleGroups,
  totalSets,
  totalVolume,
  durationSeconds,
  onConfirm,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const [effortRating, setEffortRating] = useState<1 | 2 | 3>(2);
  const [jointComfort, setJointComfort] = useState<0 | 1 | 2>(0);

  if (!visible) return null;

  const durationMins = Math.max(1, Math.round(durationSeconds / 60));

  const handleSaveWithFeedback = () => {
    onConfirm({
      effortRating,
      jointComfort,
    });
  };

  const handleSkipAndSave = () => {
    onConfirm(undefined);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.sheetContainer,
            { paddingBottom: Math.max(insets.bottom, 20) + 12 },
          ]}
        >
          {/* Header Bar */}
          <View style={styles.header}>
            <View style={styles.titleWrapper}>
              <View style={styles.headerBadge}>
                <Ionicons name="checkmark-done" size={16} color="#111111" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={1}>
                  Antrenmanı Tamamla
                </Text>
                <Text style={styles.subtitle} numberOfLines={1}>
                  {workoutTitle}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Quick Summary Pill Row */}
            <View style={styles.statsSummaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{durationMins} dk</Text>
                <Text style={styles.summaryLabel}>Süre</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{totalSets}</Text>
                <Text style={styles.summaryLabel}>Set</Text>
              </View>
              {totalVolume > 0 && (
                <>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryValue}>
                      {totalVolume.toLocaleString('tr-TR')} kg
                    </Text>
                    <Text style={styles.summaryLabel}>Hacim</Text>
                  </View>
                </>
              )}
            </View>

            {/* Targeted Muscles Summary */}
            {muscleGroups.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Çalıştırılan Kas Grupları</Text>
                <View style={styles.chipsContainer}>
                  {muscleGroups.map((cat) => {
                    const tagColor = COLORS.category[cat] || COLORS.primary;
                    return (
                      <View
                        key={cat}
                        style={[styles.muscleChip, { borderColor: tagColor + '40' }]}
                      >
                        <View
                          style={[styles.muscleDot, { backgroundColor: tagColor }]}
                        />
                        <Text style={styles.muscleChipText}>{cat}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* 1. Effort / Fatigue Rating */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Genel Zorluk ve Efor</Text>
                <Text style={styles.sectionHint}>Toparlanma hesaplaması için</Text>
              </View>
              <View style={styles.pillsRow}>
                {(
                  [
                    { level: 1, label: 'Hafif', desc: 'Kolay geçti' },
                    { level: 2, label: 'İdeal / Hedefte', desc: 'Tam kıvamında' },
                    { level: 3, label: 'Çok Zor', desc: 'Tükeniş / Sınırda' },
                  ] as const
                ).map((item) => {
                  const isSelected = effortRating === item.level;
                  return (
                    <TouchableOpacity
                      key={item.level}
                      style={[
                        styles.pillOption,
                        isSelected && styles.pillOptionActive,
                      ]}
                      onPress={() => setEffortRating(item.level)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.pillOptionLabel,
                          isSelected && styles.pillOptionLabelActive,
                        ]}
                        numberOfLines={1}
                      >
                        {item.label}
                      </Text>
                      <Text
                        style={[
                          styles.pillOptionDesc,
                          isSelected && styles.pillOptionDescActive,
                        ]}
                        numberOfLines={1}
                      >
                        {item.desc}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 2. Joint / Discomfort Warning */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Eklem / Ağrı Durumu</Text>
                <Text style={styles.sectionHint}>İsteğe bağlı</Text>
              </View>
              <View style={styles.pillsRow}>
                {(
                  [
                    { level: 0, label: 'Sorun Yok', icon: 'checkmark-circle-outline' as const },
                    { level: 1, label: 'Hafif Hassasiyet', icon: 'alert-circle-outline' as const },
                    { level: 2, label: 'Ağrı Var', icon: 'warning-outline' as const },
                  ] as const
                ).map((item) => {
                  const isSelected = jointComfort === item.level;
                  const isWarning = item.level === 2;
                  return (
                    <TouchableOpacity
                      key={item.level}
                      style={[
                        styles.pillOption,
                        isSelected && (isWarning ? styles.pillOptionDanger : styles.pillOptionActive),
                      ]}
                      onPress={() => setJointComfort(item.level)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={item.icon}
                        size={15}
                        color={
                          isSelected
                            ? isWarning
                              ? COLORS.danger
                              : '#111111'
                            : COLORS.textMuted
                        }
                      />
                      <Text
                        style={[
                          styles.pillOptionLabel,
                          isSelected && (isWarning ? styles.pillOptionDangerLabel : styles.pillOptionLabelActive),
                        ]}
                        numberOfLines={1}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actionsFooter}>
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSaveWithFeedback}
              activeOpacity={0.8}
            >
              <Ionicons name="cloud-done-outline" size={18} color="#111111" />
              <Text style={styles.saveBtnText}>Antrenmanı Kaydet</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.skipBtn}
              onPress={handleSkipAndSave}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
            >
              <Text style={styles.skipBtnText}>Atla ve Direkt Kaydet</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingTop: 16,
    ...SHADOWS.soft,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  titleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  headerBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    width: '100%',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 18,
  },
  statsSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  summaryLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 24,
    backgroundColor: COLORS.border,
  },
  section: {
    gap: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionHint: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  muscleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
  },
  muscleDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  muscleChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pillOption: {
    flex: 1,
    minHeight: 52,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  pillOptionActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  pillOptionDanger: {
    backgroundColor: COLORS.danger + '20',
    borderColor: COLORS.danger,
  },
  pillOptionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  pillOptionLabelActive: {
    color: '#111111',
  },
  pillOptionDangerLabel: {
    color: COLORS.danger,
  },
  pillOptionDesc: {
    fontSize: 10,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  pillOptionDescActive: {
    color: '#333333',
    fontWeight: '500',
  },
  actionsFooter: {
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 16,
    minHeight: 48,
    ...SHADOWS.soft,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
  },
  skipBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  skipBtnText: {
    fontSize: 13,
    color: COLORS.textMuted,
    textDecorationLine: 'underline',
  },
});
