import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
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

const getStatusText = (status: MuscleRecoveryStatus['status']) => {
  switch (status) {
    case 'RECOVERED':
      return 'Hazır';
    case 'RECOVERING':
      return 'Toparlanıyor';
    case 'FATIGUED':
      return 'Dinlenmeli';
  }
};

const formatTrainedContext = (hours: number, sets: number) => {
  if (hours >= 168) return 'Dinlenmiş (>7 gün)';
  const timeStr = hours >= 48 ? `${Math.round(hours / 24)} gün önce` : `${Math.round(hours)} sa. önce`;
  if (sets > 0) {
    return `${timeStr} • ${sets} sert set`;
  }
  return timeStr;
};

interface MuscleCardProps {
  cat: MuscleCategory;
  item: MuscleRecoveryStatus;
  isSelected: boolean;
  onToggle: (cat: MuscleCategory) => void;
}

// Memoized per-muscle cell: tapping a card flips selectedMuscle state and
// re-renders the whole heatmap; with a stable onToggle the untouched cells
// bail out instead of re-rendering their icon/badge/progress-bar trees.
const MuscleCard = React.memo(function MuscleCard({
  cat,
  item,
  isSelected,
  onToggle,
}: MuscleCardProps) {
  const config = MUSCLE_RECOVERY_CONFIG[cat];

  return (
    <TouchableOpacity
      key={cat}
      style={[
        styles.muscleCard,
        isSelected && styles.muscleCardSelected,
        { borderLeftColor: item.colorHex },
      ]}
      activeOpacity={0.75}
      onPress={() => onToggle(cat)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <View style={[styles.iconCircle, { backgroundColor: item.colorHex + '22' }]}>
            <Ionicons
              name={(config?.iconName as any) || 'barbell-outline'}
              size={13}
              color={item.colorHex}
            />
          </View>
          <Text style={styles.muscleName} numberOfLines={1}>
            {cat}
          </Text>
        </View>
        {/* Percentage badge clearly visible */}
        <View style={[styles.percentBadge, { backgroundColor: item.colorHex + '22' }]}>
          <Text style={[styles.percentBadgeText, { color: item.colorHex }]}>
            %{item.recoveryPercentage}
          </Text>
        </View>
      </View>

      {/* Clean progress bar */}
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            {
              width: `${Math.max(5, item.recoveryPercentage)}%`,
              backgroundColor: item.colorHex,
            },
          ]}
        />
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.timeText} numberOfLines={1}>
          {formatTrainedContext(item.hoursSinceTrained, item.hardSetsInWindow)}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: item.colorHex + '1A' }]}>
          <View style={[styles.statusDot, { backgroundColor: item.colorHex }]} />
          <Text style={[styles.statusBadgeText, { color: item.colorHex }]}>
            {getStatusText(item.status)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

export const MuscleRecoveryHeatmap: React.FC<MuscleRecoveryHeatmapProps> = ({
  recoveryMap,
}) => {
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleCategory | null>(null);

  // Memoized so the tier useMemos below keep stable dependencies: a fresh
  // Object.keys() array per render previously invalidated every one of them.
  const categories = useMemo(
    () => Object.keys(recoveryMap) as MuscleCategory[],
    [recoveryMap]
  );

  const handleToggleMuscle = useCallback((cat: MuscleCategory) => {
    setSelectedMuscle(prev => (prev === cat ? null : cat));
  }, []);

  // 1. Group into physiological readiness tiers
  const readyMuscles = useMemo(
    () => categories.filter((cat) => recoveryMap[cat]?.status === 'RECOVERED'),
    [recoveryMap, categories]
  );

  const recoveringMuscles = useMemo(
    () => categories.filter((cat) => recoveryMap[cat]?.status === 'RECOVERING'),
    [recoveryMap, categories]
  );

  const fatiguedMuscles = useMemo(
    () => categories.filter((cat) => recoveryMap[cat]?.status === 'FATIGUED'),
    [recoveryMap, categories]
  );

  // 2. Select 2-4 recommended targets for today
  const recommendedTargets = useMemo(() => {
    const candidates = readyMuscles.map((cat) => recoveryMap[cat]);
    const primaryOrder: Record<string, number> = {
      'Bacak': 1,
      'Göğüs': 2,
      'Sırt': 3,
      'Omuz': 4,
      'Ön Kol': 5,
      'Arka Kol': 6,
      'Karın': 7,
      'Kardiyo': 8,
    };

    return candidates
      .sort((a, b) => {
        const orderA = primaryOrder[a.muscleId] || 99;
        const orderB = primaryOrder[b.muscleId] || 99;
        if (b.hoursSinceTrained !== a.hoursSinceTrained) {
          return b.hoursSinceTrained - a.hoursSinceTrained; // longest rested first
        }
        return orderA - orderB;
      })
      .slice(0, 4);
  }, [readyMuscles, recoveryMap]);

  const activeDetail = selectedMuscle ? recoveryMap[selectedMuscle] : null;

  const renderMuscleCard = useCallback((cat: MuscleCategory) => (
    <MuscleCard
      key={cat}
      cat={cat}
      item={recoveryMap[cat]}
      isSelected={selectedMuscle === cat}
      onToggle={handleToggleMuscle}
    />
  ), [recoveryMap, selectedMuscle, handleToggleMuscle]);

  return (
    <View style={styles.container}>
      {/* Engine Title Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.headerIconBg}>
            <Ionicons name="pulse-outline" size={16} color={COLORS.primary} />
          </View>
          <View style={styles.headerTextCol}>
            <Text style={styles.title}>Kas Yorgunluk & Hazırlık Modeli</Text>
            <Text style={styles.subtitle}>
              Hill biyomekanik toparlanma ve aksiyel yükleme analizleri
            </Text>
          </View>
        </View>
      </View>

      {/* Hero Card: Bugün Önerilen Hedefler (Günün Hazır Kas Grupları) */}
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <Ionicons name="sparkles" size={14} color={COLORS.primary} />
          <Text style={styles.heroTitle}>Bugün Önerilen Hedefler</Text>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>Aşırı Yüklemeye Hazır</Text>
          </View>
        </View>
        <Text style={styles.heroDescription}>
          En son antrenmandan bu yana toparlanan ve süperkompanzasyon evresine giren bölgeler:
        </Text>
        <View style={styles.heroChipsRow}>
          {recommendedTargets.length > 0 ? (
            recommendedTargets.map((rec) => {
              const conf = MUSCLE_RECOVERY_CONFIG[rec.muscleId];
              return (
                <TouchableOpacity
                  key={rec.muscleId}
                  style={styles.heroChip}
                  activeOpacity={0.8}
                  onPress={() => setSelectedMuscle(rec.muscleId)}
                >
                  <Ionicons
                    name={(conf?.iconName as any) || 'checkmark-circle'}
                    size={13}
                    color={COLORS.success}
                  />
                  <Text style={styles.heroChipText}>{rec.muscleId}</Text>
                  <Text style={styles.heroChipPct}>%{rec.recoveryPercentage}</Text>
                </TouchableOpacity>
              );
            })
          ) : (
            <Text style={styles.noTargetText}>
              Şu an tüm bölgelerde toparlanma süreci aktif. Hafif kardiyo veya mobilite önerilir.
            </Text>
          )}
        </View>
      </View>

      {/* Physiological Tiers */}
      {/* Tier 1: Antrenmana Hazır / Dinlenmiş */}
      <View style={styles.tierSection}>
        <View style={styles.tierHeader}>
          <View style={[styles.tierDot, { backgroundColor: COLORS.success }]} />
          <Text style={styles.tierTitle}>Antrenmana Hazır</Text>
          <Text style={styles.tierCount}>({readyMuscles.length})</Text>
        </View>
        <Text style={styles.tierSubtitle}>
          Maksimum kuvvet ve hipertrofi için tam hazır.
        </Text>
        {readyMuscles.length > 0 ? (
          <View style={styles.grid}>
            {readyMuscles.map(renderMuscleCard)}
          </View>
        ) : (
          <Text style={styles.tierEmptyText}>Tüm kas gruplarında toparlanma devam ediyor.</Text>
        )}
      </View>

      {/* Tier 2: Toparlanma Aşamasında */}
      <View style={styles.tierSection}>
        <View style={styles.tierHeader}>
          <View style={[styles.tierDot, { backgroundColor: COLORS.warning }]} />
          <Text style={styles.tierTitle}>Toparlanma Aşamasında</Text>
          <Text style={styles.tierCount}>({recoveringMuscles.length})</Text>
        </View>
        <Text style={styles.tierSubtitle}>
          Toparlanma devam ediyor. İkincil veya hafif egzersizler uygun.
        </Text>
        {recoveringMuscles.length > 0 ? (
          <View style={styles.grid}>
            {recoveringMuscles.map(renderMuscleCard)}
          </View>
        ) : (
          <Text style={styles.tierEmptyText}>Bu evrede kas grubu bulunmuyor.</Text>
        )}
      </View>

      {/* Tier 3: Yüksek Yorgunluk / Dinlenmeli */}
      <View style={styles.tierSection}>
        <View style={styles.tierHeader}>
          <View style={[styles.tierDot, { backgroundColor: COLORS.danger }]} />
          <Text style={styles.tierTitle}>Yüksek Yorgunluk / Dinlenmeli</Text>
          <Text style={styles.tierCount}>({fatiguedMuscles.length})</Text>
        </View>
        <Text style={styles.tierSubtitle}>
          Kas lifi tamiri ve sinir sistemi adaptasyonu sürüyor. Ağır yüklemeden kaçının.
        </Text>
        {fatiguedMuscles.length > 0 ? (
          <View style={styles.grid}>
            {fatiguedMuscles.map(renderMuscleCard)}
          </View>
        ) : (
          <Text style={styles.tierEmptyText}>Aşırı yorgun kas grubu bulunmuyor.</Text>
        )}
      </View>

      {/* Detail Inspection Modal */}
      <Modal
        visible={!!activeDetail}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedMuscle(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedMuscle(null)}
        >
          <TouchableOpacity
            style={styles.modalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            {activeDetail && (
              <>
                <View style={styles.detailHeader}>
                  <View style={styles.detailTitleRow}>
                    <View style={[styles.iconCircle, { backgroundColor: activeDetail.colorHex + '22' }]}>
                      <Ionicons
                        name={(MUSCLE_RECOVERY_CONFIG[activeDetail.muscleId]?.iconName as any) || 'information-circle'}
                        size={15}
                        color={activeDetail.colorHex}
                      />
                    </View>
                    <View>
                      <Text style={styles.detailTitle}>
                        {activeDetail.muscleName}
                      </Text>
                      <Text style={styles.detailCategoryLabel}>Fizyolojik Toparlanma Analizi</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => setSelectedMuscle(null)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    style={styles.closeBtn}
                  >
                    <Ionicons name="close" size={16} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* Status Callout Banner with % and Status */}
                <View style={[styles.statusCallout, { backgroundColor: activeDetail.colorHex + '14', borderColor: activeDetail.colorHex + '40' }]}>
                  <Ionicons
                    name={
                      activeDetail.status === 'RECOVERED'
                        ? 'checkmark-circle'
                        : activeDetail.status === 'RECOVERING'
                        ? 'sync'
                        : 'alert-circle'
                    }
                    size={20}
                    color={activeDetail.colorHex}
                  />
                  <View style={styles.calloutTextCol}>
                    <View style={styles.calloutTitleRow}>
                      <Text style={[styles.calloutTitle, { color: activeDetail.colorHex }]}>
                        {activeDetail.status === 'RECOVERED'
                          ? 'Antrenmana Tam Hazır'
                          : activeDetail.status === 'RECOVERING'
                          ? 'Toparlanma Sürüyor'
                          : 'Yüksek Yorgunluk — Dinlenmeli'}
                      </Text>
                      <Text style={[styles.calloutPct, { color: activeDetail.colorHex }]}>
                        %{activeDetail.recoveryPercentage}
                      </Text>
                    </View>
                    <Text style={styles.calloutSub}>
                      {activeDetail.status === 'RECOVERED'
                        ? 'Bu bölge hipertrofi uyarımı ve PR denemeleri için optimum metabolik durumda.'
                        : activeDetail.status === 'RECOVERING'
                        ? 'Kas lifleri onarım aşamasında. İkincil veya düşük RPE uyarımı uygundur.'
                        : 'Miyofibriler hasar ve sistemik aksiyel yorgunluk yüksek. Dinlenme önerilir.'}
                    </Text>
                  </View>
                </View>

                {/* Concrete Training Metrics */}
                <View style={styles.detailStatsGrid}>
                  <View style={styles.detailStatBox}>
                    <Text style={styles.detailStatLabel}>Son Çalışma</Text>
                    <Text style={styles.detailStatValue}>
                      {activeDetail.hoursSinceTrained >= 168
                        ? '7+ gün önce'
                        : `${Math.round(activeDetail.hoursSinceTrained)} sa. önce`}
                    </Text>
                  </View>

                  <View style={styles.detailStatBox}>
                    <Text style={styles.detailStatLabel}>Sert Set Yükü</Text>
                    <Text style={styles.detailStatValue}>
                      {activeDetail.hardSetsInWindow > 0 ? `${activeDetail.hardSetsInWindow} Set` : '0 Set'}
                    </Text>
                  </View>

                  <View style={styles.detailStatBox}>
                    <Text style={styles.detailStatLabel}>Yorgunluk Katsayısı</Text>
                    <Text style={styles.detailStatValue}>
                      {activeDetail.accumulatedFatigueMultiplier}x
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => setSelectedMuscle(null)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.actionBtnText}>Anladım</Text>
                </TouchableOpacity>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    gap: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.soft,
  },
  header: {
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconBg: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextCol: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  subtitle: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  heroCard: {
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  heroBadge: {
    backgroundColor: 'rgba(52, 211, 153, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  heroBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.success,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  heroDescription: {
    fontSize: 11,
    color: COLORS.textSecondary,
    lineHeight: 15,
  },
  heroChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
  },
  heroChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  heroChipPct: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.success,
    fontVariant: ['tabular-nums'],
  },
  noTargetText: {
    fontSize: 11,
    fontStyle: 'italic',
    color: COLORS.textMuted,
  },
  tierSection: {
    gap: 8,
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tierDot: {
    width: 6,
    height: 6,
    borderRadius: 2,
  },
  tierTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  tierCount: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    fontVariant: ['tabular-nums'],
  },
  tierSubtitle: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: -2,
  },
  tierEmptyText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    paddingVertical: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  muscleCard: {
    width: '48.5%',
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 6,
    padding: 10,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'space-between',
    minHeight: 78,
  },
  muscleCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surfaceElevated,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 4,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  iconCircle: {
    width: 22,
    height: 22,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muscleName: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
    flexShrink: 1,
  },
  percentBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    flexShrink: 0,
  },
  percentBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    flexShrink: 0,
  },
  statusDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  barTrack: {
    height: 4,
    backgroundColor: '#1B2531',
    borderRadius: 2,
    overflow: 'hidden',
    marginVertical: 5,
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(6, 12, 18, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    gap: 12,
    ...SHADOWS.medium,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  detailTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  detailTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  detailCategoryLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statusCallout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  calloutTextCol: {
    flex: 1,
    gap: 3,
  },
  calloutTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calloutTitle: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  calloutPct: {
    fontSize: 13,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  calloutSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
    lineHeight: 15,
  },
  detailStatsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  detailStatBox: {
    flex: 1,
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  detailStatLabel: {
    fontSize: 9,
    color: COLORS.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  detailStatValue: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  actionBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    color: COLORS.textInverted,
    fontSize: 13,
    fontWeight: '800',
  },
});
