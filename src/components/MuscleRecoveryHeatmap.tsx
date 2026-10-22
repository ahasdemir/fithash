import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../theme';
import { MuscleCategory } from '../types/fitness';
import {
  MuscleRecoveryStatus,
  MUSCLE_RECOVERY_CONFIG,
} from '../services/muscleRecoveryService';

interface MuscleRecoveryHeatmapProps {
  recoveryMap: Record<MuscleCategory, MuscleRecoveryStatus>;
}

export const MuscleRecoveryHeatmap: React.FC<MuscleRecoveryHeatmapProps> = ({
  recoveryMap,
}) => {
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleCategory | null>(null);

  const categories = Object.keys(recoveryMap) as MuscleCategory[];

  const activeDetail = selectedMuscle ? recoveryMap[selectedMuscle] : null;

  return (
    <View style={styles.container}>
      {/* Title Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="body" size={18} color={COLORS.primary} />
          <Text style={styles.title}>Kas Toparlanma Haritası</Text>
        </View>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
            <Text style={styles.legendText}>Yorgun (0-40%)</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
            <Text style={styles.legendText}>İyileşiyor</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
            <Text style={styles.legendText}>Hazır (80%+)</Text>
          </View>
        </View>
      </View>

      <Text style={styles.subtitle}>
        Hill-denklemi biyomekanik toparlanma modeli (Aksiyel yük & RP DOMS ağırlıklı)
      </Text>

      {/* Muscle Grid */}
      <View style={styles.grid}>
        {categories.map((cat) => {
          const item = recoveryMap[cat];
          const isSelected = selectedMuscle === cat;
          const config = MUSCLE_RECOVERY_CONFIG[cat];

          return (
            <TouchableOpacity
              key={cat}
              style={[
                styles.muscleCard,
                isSelected && styles.muscleCardSelected,
                { borderLeftColor: item.colorHex },
              ]}
              activeOpacity={0.7}
              onPress={() => setSelectedMuscle(isSelected ? null : cat)}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <Ionicons
                    name={(config?.iconName as any) || 'barbell-outline'}
                    size={14}
                    color={COLORS.textSecondary}
                  />
                  <Text style={styles.muscleName} numberOfLines={1}>
                    {cat}
                  </Text>
                </View>
                <Text style={[styles.percentText, { color: item.colorHex }]}>
                  %{item.recoveryPercentage}
                </Text>
              </View>

              {/* Progress Bar */}
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${item.recoveryPercentage}%`,
                      backgroundColor: item.colorHex,
                    },
                  ]}
                />
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.timeText}>
                  {item.hoursSinceTrained >= 168
                    ? 'Dinlenmiş (>7 gün)'
                    : `${item.hoursSinceTrained} sa. önce`}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: item.colorHex + '20' }]}>
                  <Text style={[styles.statusBadgeText, { color: item.colorHex }]}>
                    {item.status === 'FATIGUED'
                      ? 'Yorgun'
                      : item.status === 'RECOVERING'
                      ? 'İyileşiyor'
                      : 'Hazır'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Selected Muscle Deep-Dive Modal/Card */}
      {activeDetail && (
        <View style={styles.detailCard}>
          <View style={styles.detailHeader}>
            <View style={styles.detailTitleRow}>
              <Ionicons name="information-circle" size={16} color={COLORS.primary} />
              <Text style={styles.detailTitle}>
                {activeDetail.muscleName} — Detaylı Toparlanma Analizi
              </Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedMuscle(null)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Ionicons name="close" size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.detailStatsRow}>
            <View style={styles.detailStat}>
              <Text style={styles.detailStatLabel}>Toparlanma Durumu</Text>
              <Text style={[styles.detailStatValue, { color: activeDetail.colorHex }]}>
                %{activeDetail.recoveryPercentage} ({activeDetail.status === 'FATIGUED' ? 'Yorgun' : activeDetail.status === 'RECOVERING' ? 'İyileşiyor' : 'Hazır'})
              </Text>
            </View>

            <View style={styles.detailStat}>
              <Text style={styles.detailStatLabel}>Son Çalışma</Text>
              <Text style={styles.detailStatValue}>
                {activeDetail.hoursSinceTrained >= 168
                  ? '7+ gün önce'
                  : `${activeDetail.hoursSinceTrained} saat önce`}
              </Text>
            </View>

            <View style={styles.detailStat}>
              <Text style={styles.detailStatLabel}>Yorgunluk Katsayısı</Text>
              <Text style={styles.detailStatValue}>
                {activeDetail.accumulatedFatigueMultiplier}x
              </Text>
            </View>
          </View>

          <Text style={styles.detailHint}>
            {activeDetail.recoveryPercentage < 50
              ? '⚠️ Bu kas grubu henüz yoğun toparlanma evresinde. Bugün aynı bölgeyi ağır çalıştırmaktan kaçınmanız tavsiye edilir.'
              : activeDetail.recoveryPercentage < 80
              ? '🔄 Kas lifleri toparlanmak üzere. Düşük/orta yoğunluklu uyarım yapılabilir.'
              : '✅ Kas tamamen toparlandı ve supercompensation evresinde. Yeni bir hipertrofi seansı için hazır!'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.soft,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 4,
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  muscleCard: {
    width: '48%',
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 12,
    padding: 10,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  muscleCardSelected: {
    borderColor: COLORS.primary,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  muscleName: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  percentText: {
    fontSize: 12,
    fontWeight: '800',
  },
  barTrack: {
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 3,
    overflow: 'hidden',
    marginVertical: 4,
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  timeText: {
    fontSize: 9,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  detailCard: {
    marginTop: 12,
    padding: 12,
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  detailStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 6,
  },
  detailStat: {
    flex: 1,
  },
  detailStatLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  detailStatValue: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  detailHint: {
    fontSize: 11,
    color: COLORS.textSecondary,
    lineHeight: 15,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
});
