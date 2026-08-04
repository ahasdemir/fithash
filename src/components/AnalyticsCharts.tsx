import React, { useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Rect, Line, Text as SvgText, G } from 'react-native-svg';
import { COLORS, SHADOWS } from '../theme';
import { WorkoutSession } from '../types/fitness';

interface AnalyticsChartsProps {
  workouts: WorkoutSession[];
  filterMode: 'weekly' | 'monthly' | 'all';
}

export const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({
  workouts,
  filterMode,
}) => {
  const [containerWidth, setContainerWidth] = useState(300);
  const CHART_HEIGHT = 160;

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    if (width > 0) {
      setContainerWidth(width);
    }
  };

  const getVolumeData = () => {
    if (!workouts.length) return [];

    const now = new Date();
    const days = filterMode === 'weekly' ? 7 : filterMode === 'monthly' ? 30 : 90;
    const dateMap: Record<string, number> = {};

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().split('T')[0];
      dateMap[key] = 0;
    }

    workouts.forEach(w => {
      if (dateMap[w.date] !== undefined) {
        dateMap[w.date] += w.totalVolume || 0;
      }
    });

    const entries = Object.entries(dateMap);

    if (filterMode === 'monthly') {
      const weeklyBuckets: { label: string; volume: number }[] = [];
      for (let i = 0; i < entries.length; i += 5) {
        const slice = entries.slice(i, i + 5);
        const totalVol = slice.reduce((sum, [_, v]) => sum + v, 0);
        const startDate = slice[0][0].substring(5);
        weeklyBuckets.push({
          label: startDate,
          volume: totalVol,
        });
      }
      return weeklyBuckets;
    }

    return entries.map(([date, volume]) => {
      const d = new Date(date);
      const daysTr = ['Pa', 'Pz', 'Sa', 'Çr', 'Pe', 'Cu', 'Ct'];
      const label = filterMode === 'weekly' ? daysTr[d.getDay()] : date.substring(5);
      return { label, volume };
    });
  };

  const getMuscleSetBreakdown = () => {
    const categorySets: Record<string, number> = {};
    const categoryVolume: Record<string, number> = {};
    let grandTotalVol = 0;

    workouts.forEach(w => {
      w.exercises.forEach(ex => {
        const completedSetsCount = ex.sets.filter(s => s.completed).length;
        const vol = ex.sets.reduce((acc, s) => (s.completed ? acc + s.weight * s.reps : acc), 0);

        if (completedSetsCount > 0) {
          categorySets[ex.category] = (categorySets[ex.category] || 0) + completedSetsCount;
          categoryVolume[ex.category] = (categoryVolume[ex.category] || 0) + vol;
          grandTotalVol += vol;
        }
      });
    });

    if (Object.keys(categorySets).length === 0) return [];

    return Object.entries(categorySets)
      .map(([category, sets]) => ({
        category,
        sets,
        volume: categoryVolume[category] || 0,
        color: COLORS.category[category as any] || '#111111',
      }))
      .sort((a, b) => b.sets - a.sets);
  };

  const volumeData = getVolumeData();
  const muscleBreakdown = getMuscleSetBreakdown();
  const maxVolume = Math.max(...volumeData.map(d => d.volume), 1000);

  return (
    <View style={styles.container}>
      {/* 1. PRIMARY: Muscle Group Hard Sets Benchmark Bento Card (Dr. Israetel Standard) */}
      <View style={styles.bentoCard}>
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <Text style={styles.cardTitle}>Kas Grubu Efektif Set Dağılımı</Text>
            <Text style={styles.cardSubtitle}>RP Hipertrofi Hacim Hedefi (10-20 Set / Hafta)</Text>
          </View>
        </View>

        {muscleBreakdown.length > 0 ? (
          <View style={styles.muscleList}>
            {muscleBreakdown.map(item => {
              const targetBenchmark = 15;
              const setPercentage = Math.min(100, Math.round((item.sets / targetBenchmark) * 100));

              return (
                <View key={item.category} style={styles.muscleRow}>
                  <View style={styles.muscleHeader}>
                    <View style={styles.muscleTitleLeft}>
                      <View style={[styles.dot, { backgroundColor: item.color }]} />
                      <Text style={styles.muscleName}>{item.category}</Text>
                    </View>

                    <View style={styles.muscleMetaRight}>
                      <Text style={styles.muscleSetsText}>{item.sets} Sert Set</Text>
                      {item.volume > 0 && (
                        <Text style={styles.muscleVolText}>
                          ({item.volume.toLocaleString('tr-TR')} kg)
                        </Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${setPercentage}%`, backgroundColor: item.color },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={styles.noDataText}>Analiz edilecek antrenman verisi henüz yok.</Text>
        )}
      </View>

      {/* 2. SECONDARY: Volume Chart Card (Moved down as requested) */}
      <View style={styles.bentoCard} onLayout={handleLayout}>
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <Text style={styles.cardTitle}>Toplam Yük Değişimi (İkincil Metrik)</Text>
            <Text style={styles.cardSubtitle}>Kaldırılan toplam tonaj trendi (kg)</Text>
          </View>
          <View style={styles.badgePill}>
            <Text style={styles.badgePillText}>
              {filterMode === 'weekly' ? 'Son 7 Gün' : filterMode === 'monthly' ? 'Son 30 Gün' : 'Tüm Zamanlar'}
            </Text>
          </View>
        </View>

        {volumeData.length > 0 ? (
          <View style={styles.chartContainer}>
            <Svg width={containerWidth} height={CHART_HEIGHT}>
              <Line x1="0" y1="20" x2={containerWidth} y2="20" stroke={COLORS.border} strokeDasharray="4 4" />
              <Line x1="0" y1={CHART_HEIGHT / 2} x2={containerWidth} y2={CHART_HEIGHT / 2} stroke={COLORS.border} strokeDasharray="4 4" />
              <Line x1="0" y1={CHART_HEIGHT - 30} x2={containerWidth} y2={CHART_HEIGHT - 30} stroke={COLORS.border} />

              {volumeData.map((item, index) => {
                const stepWidth = containerWidth / Math.max(1, volumeData.length);
                const barWidth = Math.min(24, Math.max(10, stepWidth - 10));
                const x = index * stepWidth + (stepWidth - barWidth) / 2;
                const barHeight = Math.max(6, (item.volume / maxVolume) * (CHART_HEIGHT - 60));
                const y = CHART_HEIGHT - 30 - barHeight;
                const isPeak = item.volume === maxVolume && item.volume > 0;

                return (
                  <G key={index}>
                    <Rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={barHeight}
                      rx={6}
                      fill={isPeak ? COLORS.primary : item.volume > 0 ? '#111111' : COLORS.border}
                    />

                    <SvgText
                      x={x + barWidth / 2}
                      y={CHART_HEIGHT - 10}
                      fill={COLORS.textMuted}
                      fontSize="10"
                      fontWeight="600"
                      textAnchor="middle"
                    >
                      {item.label}
                    </SvgText>

                    {volumeData.length <= 10 && item.volume > 0 && (
                      <SvgText
                        x={x + barWidth / 2}
                        y={Math.max(12, y - 6)}
                        fill={COLORS.textPrimary}
                        fontSize="9"
                        fontWeight="700"
                        textAnchor="middle"
                      >
                        {item.volume >= 1000 ? `${(item.volume / 1000).toFixed(1)}k` : item.volume}
                      </SvgText>
                    )}
                  </G>
                );
              })}
            </Svg>
          </View>
        ) : (
          <Text style={styles.noDataText}>Henüz antrenman verisi mevcut değil.</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  bentoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.soft,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  headerLeft: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  cardSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  badgePill: {
    backgroundColor: COLORS.surfaceSubtle,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignSelf: 'flex-start',
  },
  badgePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  chartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginVertical: 4,
  },
  noDataText: {
    color: COLORS.textMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 20,
  },
  muscleList: {
    gap: 14,
  },
  muscleRow: {
    gap: 6,
  },
  muscleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  muscleTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  muscleName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  muscleMetaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  muscleSetsText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111111',
  },
  muscleVolText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  progressTrack: {
    height: 8,
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 100,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 100,
  },
});
