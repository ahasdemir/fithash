import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { ExerciseFeedback } from '../types/fitness';
import { calculateHypertrophyVolumeAdaptation } from '../services/progressionEngine';

interface ExerciseRPFeedbackProps {
  feedback?: ExerciseFeedback;
  onChangeFeedback: (newFeedback: ExerciseFeedback) => void;
  exerciseName?: string;
}

export const ExerciseRPFeedback: React.FC<ExerciseRPFeedbackProps> = ({
  feedback,
  onChangeFeedback,
  exerciseName,
}) => {
  const currentFeedback = feedback || {
    pumpRating: 2,
    sorenessRating: 2,
    jointAcheRating: 0,
  };

  const pump = currentFeedback.pumpRating ?? 2;
  const soreness = currentFeedback.sorenessRating ?? 2;
  const jointAche = currentFeedback.jointAcheRating ?? 0;

  const adaptation = calculateHypertrophyVolumeAdaptation(currentFeedback);

  const updateField = (
    field: 'pumpRating' | 'sorenessRating' | 'jointAcheRating',
    val: number
  ) => {
    onChangeFeedback({
      ...currentFeedback,
      [field]: val,
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Ionicons name="flame" size={14} color={COLORS.primary} />
          <Text style={styles.headerTitle}>RP Hipertrofi Değerlendirmesi</Text>
        </View>
        <Text style={styles.headerSubtitle}>Set Hacmi Otomatik Uyarlama</Text>
      </View>

      {/* 1. Pump Rating */}
      <View style={styles.section}>
        <View style={styles.sectionLabelRow}>
          <Text style={styles.sectionLabel}>Kas Pompalama (Pump):</Text>
          <Text style={styles.sectionValue}>
            {pump === 1 ? '1 - Düşük' : pump === 2 ? '2 - İdeal' : '3 - Maksimum (Deri Patlatıcı)'}
          </Text>
        </View>
        <View style={styles.optionsRow}>
          {([1, 2, 3] as const).map((lvl) => {
            const isSelected = pump === lvl;
            return (
              <TouchableOpacity
                key={lvl}
                style={[styles.optionBtn, isSelected && styles.optionBtnSelected]}
                onPress={() => updateField('pumpRating', lvl)}
                activeOpacity={0.7}
              >
                <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                  {lvl === 1 ? 'Düşük (1)' : lvl === 2 ? 'İdeal (2)' : 'Maksimum (3)'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 2. Soreness Rating */}
      <View style={styles.section}>
        <View style={styles.sectionLabelRow}>
          <Text style={styles.sectionLabel}>Tahmini Kas Hasarı / Ağrı (DOMS):</Text>
          <Text style={styles.sectionValue}>
            {soreness === 1 ? '1 - Düşük / Hızlı' : soreness === 2 ? '2 - Optimal' : '3 - Aşırı / Yüksek'}
          </Text>
        </View>
        <View style={styles.optionsRow}>
          {([1, 2, 3] as const).map((lvl) => {
            const isSelected = soreness === lvl;
            return (
              <TouchableOpacity
                key={lvl}
                style={[
                  styles.optionBtn,
                  isSelected && (lvl === 3 ? styles.optionBtnWarning : styles.optionBtnSelected),
                ]}
                onPress={() => updateField('sorenessRating', lvl)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.optionText,
                    isSelected && (lvl === 3 ? styles.optionTextWarning : styles.optionTextSelected),
                  ]}
                >
                  {lvl === 1 ? 'Hızlı (1)' : lvl === 2 ? 'Optimal (2)' : 'Aşırı (3)'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 3. Joint Ache Rating */}
      <View style={styles.section}>
        <View style={styles.sectionLabelRow}>
          <Text style={styles.sectionLabel}>Eklem & Bağ Dokusu Baskısı:</Text>
          <Text style={styles.sectionValue}>
            {jointAche === 0 ? '0 - Ağrısız' : jointAche === 1 ? '1 - Hafif Batma' : '2 - Ağrılı / Engelleyici'}
          </Text>
        </View>
        <View style={styles.optionsRow}>
          {([0, 1, 2] as const).map((lvl) => {
            const isSelected = jointAche === lvl;
            return (
              <TouchableOpacity
                key={lvl}
                style={[
                  styles.optionBtn,
                  isSelected && (lvl === 2 ? styles.optionBtnDanger : styles.optionBtnSelected),
                ]}
                onPress={() => updateField('jointAcheRating', lvl)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.optionText,
                    isSelected && (lvl === 2 ? styles.optionTextDanger : styles.optionTextSelected),
                  ]}
                >
                  {lvl === 0 ? 'Ağrısız (0)' : lvl === 1 ? 'Hafif (1)' : 'Ağrılı (2)'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Volume Adaptation Preview Banner */}
      <View
        style={[
          styles.adaptationBanner,
          adaptation.action === 'ADD_SET'
            ? styles.adaptationAdd
            : adaptation.action === 'DELOAD_OR_SWAP' || adaptation.action === 'REDUCE_SET'
            ? styles.adaptationWarning
            : styles.adaptationNeutral,
        ]}
      >
        <Ionicons
          name={
            adaptation.action === 'ADD_SET'
              ? 'trending-up'
              : adaptation.action === 'DELOAD_OR_SWAP' || adaptation.action === 'REDUCE_SET'
              ? 'warning-outline'
              : 'checkmark-circle-outline'
          }
          size={16}
          color={
            adaptation.action === 'ADD_SET'
              ? '#10B981'
              : adaptation.action === 'DELOAD_OR_SWAP' || adaptation.action === 'REDUCE_SET'
              ? '#EF4444'
              : COLORS.textSecondary
          }
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.adaptationTitle}>
            Gelecek Hafta Tavsiyesi: {adaptation.setDelta > 0 ? `+${adaptation.setDelta} Set (MAV)` : adaptation.setDelta < 0 ? `${adaptation.setDelta} Set` : 'Aynı Set Hacmi'}
          </Text>
          <Text style={styles.adaptationReason}>{adaptation.reason}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  section: {
    marginBottom: 8,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sectionLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  sectionValue: {
    fontSize: 11,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  optionBtn: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  optionBtnSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  optionBtnWarning: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  optionBtnDanger: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  optionText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  optionTextSelected: {
    color: '#111111',
    fontWeight: '700',
  },
  optionTextWarning: {
    color: '#ffffff',
    fontWeight: '700',
  },
  optionTextDanger: {
    color: '#ffffff',
    fontWeight: '700',
  },
  adaptationBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 8,
    borderRadius: 8,
    marginTop: 4,
  },
  adaptationAdd: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  adaptationWarning: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  adaptationNeutral: {
    backgroundColor: COLORS.surfaceSubtle,
  },
  adaptationTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  adaptationReason: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 2,
    lineHeight: 14,
  },
});
