import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  LayoutChangeEvent,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Rect, Line, Text as SvgText, G } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../theme';
import { WorkoutSession } from '../types/fitness';

export interface VolumeBucket {
  id: string;
  label: string;
  fullLabel: string;
  volume: number;
  workoutCount: number;
  startDate: string;
  endDate: string;
  isPeak?: boolean;
}

interface AnalyticsChartsProps {
  workouts: WorkoutSession[];
  allWorkouts?: WorkoutSession[];
  filterMode: 'weekly' | 'monthly' | 'all';
}

const MONTH_SHORT_TR = [
  'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz',
  'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara',
];

const MONTH_FULL_TR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

const DAY_SHORT_TR = ['Paz', 'Pzt', 'Sal', 'Çrş', 'Per', 'Cum', 'Cmt'];

const parseISODate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const formatISODate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatVolumeShort = (vol: number): string => {
  if (vol >= 1000000) return `${(vol / 1000000).toFixed(1)}M`;
  if (vol >= 1000) return `${(vol / 1000).toFixed(1)}k`;
  return vol.toString();
};

/**
 * Generates Daily Buckets for a given number of days ending today
 */
const getDailyBuckets = (workouts: WorkoutSession[], daysCount: number = 7): VolumeBucket[] => {
  const buckets: VolumeBucket[] = [];
  const now = new Date();

  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const dateStr = formatISODate(d);

    const dayWorkouts = workouts.filter(w => w.date === dateStr);
    const vol = dayWorkouts.reduce((sum, w) => sum + (w.totalVolume || 0), 0);

    const dayName = DAY_SHORT_TR[d.getDay()];
    const monthShort = MONTH_SHORT_TR[d.getMonth()];
    const monthFull = MONTH_FULL_TR[d.getMonth()];

    buckets.push({
      id: dateStr,
      label: daysCount <= 7 ? dayName : `${d.getDate()} ${monthShort}`,
      fullLabel: `${d.getDate()} ${monthFull} ${d.getFullYear()}, ${dayName}`,
      volume: vol,
      workoutCount: dayWorkouts.length,
      startDate: dateStr,
      endDate: dateStr,
    });
  }

  return buckets;
};

/**
 * Generates Weekly (7-day period) Buckets
 */
const getWeeklyBuckets = (workouts: WorkoutSession[], weeksCount: number = 4): VolumeBucket[] => {
  const buckets: VolumeBucket[] = [];
  const now = new Date();

  for (let i = weeksCount - 1; i >= 0; i--) {
    const endDaysAgo = i * 7;
    const startDaysAgo = endDaysAgo + 6;

    const startD = new Date(now.getFullYear(), now.getMonth(), now.getDate() - startDaysAgo);
    const endD = new Date(now.getFullYear(), now.getMonth(), now.getDate() - endDaysAgo);

    const startStr = formatISODate(startD);
    const endStr = formatISODate(endD);

    const rangeWorkouts = workouts.filter(w => w.date >= startStr && w.date <= endStr);
    const vol = rangeWorkouts.reduce((sum, w) => sum + (w.totalVolume || 0), 0);

    // Concise label for X-axis (e.g. "12-18 Oca") to avoid crowding
    let label = '';
    if (startD.getMonth() === endD.getMonth()) {
      label = `${startD.getDate()}-${endD.getDate()} ${MONTH_SHORT_TR[startD.getMonth()]}`;
    } else {
      label = `${startD.getDate()} ${MONTH_SHORT_TR[startD.getMonth()]}-${endD.getDate()} ${MONTH_SHORT_TR[endD.getMonth()]}`;
    }

    const fullLabel = `${startD.getDate()} ${MONTH_FULL_TR[startD.getMonth()]} - ${endD.getDate()} ${MONTH_FULL_TR[endD.getMonth()]} ${endD.getFullYear()}`;

    buckets.push({
      id: `${startStr}_${endStr}`,
      label,
      fullLabel,
      volume: vol,
      workoutCount: rangeWorkouts.length,
      startDate: startStr,
      endDate: endStr,
    });
  }

  return buckets;
};

/**
 * Generates Monthly Buckets (by calendar month)
 */
const getMonthlyBuckets = (workouts: WorkoutSession[], monthsCount: number = 6): VolumeBucket[] => {
  const buckets: VolumeBucket[] = [];
  const now = new Date();

  for (let i = monthsCount - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();

    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    const startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const endStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

    const monthWorkouts = workouts.filter(w => w.date >= startStr && w.date <= endStr);
    const vol = monthWorkouts.reduce((sum, w) => sum + (w.totalVolume || 0), 0);

    const monthName = MONTH_FULL_TR[month];
    const monthShort = MONTH_SHORT_TR[month];

    buckets.push({
      id: `${year}_${month}`,
      label: monthsCount > 6 ? `${monthShort} '${String(year).slice(-2)}` : monthName,
      fullLabel: `${monthName} ${year}`,
      volume: vol,
      workoutCount: monthWorkouts.length,
      startDate: startStr,
      endDate: endStr,
    });
  }

  return buckets;
};

/**
 * Smart Aggregator for filterMode ('weekly', 'monthly', 'all')
 */
const getSmartAggregatedVolumeData = (
  workouts: WorkoutSession[],
  filterMode: 'weekly' | 'monthly' | 'all'
): VolumeBucket[] => {
  let buckets: VolumeBucket[] = [];

  if (filterMode === 'weekly') {
    // 7 Daily Buckets
    buckets = getDailyBuckets(workouts, 7);
  } else if (filterMode === 'monthly') {
    // 5 Weekly Buckets for last ~30 days
    buckets = getWeeklyBuckets(workouts, 5);
  } else {
    // 'all' Mode: Automatically group into Weekly or Monthly periods based on span
    if (!workouts.length) {
      buckets = getWeeklyBuckets(workouts, 8);
    } else {
      const dates = workouts.map(w => w.date).sort();
      const minD = parseISODate(dates[0]);
      const maxD = parseISODate(dates[dates.length - 1]);
      const diffDays = Math.max(1, Math.ceil((maxD.getTime() - minD.getTime()) / (1000 * 3600 * 24)));

      if (diffDays <= 45) {
        const weeks = Math.max(4, Math.ceil(diffDays / 7));
        buckets = getWeeklyBuckets(workouts, weeks);
      } else if (diffDays <= 120) {
        const weeks = Math.min(16, Math.max(8, Math.ceil(diffDays / 7)));
        buckets = getWeeklyBuckets(workouts, weeks);
      } else {
        const months = Math.min(12, Math.max(6, Math.ceil(diffDays / 30)));
        buckets = getMonthlyBuckets(workouts, months);
      }
    }
  }

  // Mark Peak volume
  const maxVol = Math.max(...buckets.map(b => b.volume), 0);
  buckets.forEach(b => {
    b.isPeak = maxVol > 0 && b.volume === maxVol;
  });

  return buckets;
};

interface RenderVolumeSvgChartProps {
  data: VolumeBucket[];
  containerWidth: number;
  height?: number;
  selectedIndex: number | null;
  onSelectIndex: (index: number) => void;
  minBarWidth?: number;
  barGap?: number;
}

const RenderVolumeSvgChart: React.FC<RenderVolumeSvgChartProps> = ({
  data,
  containerWidth,
  height = 170,
  selectedIndex,
  onSelectIndex,
  minBarWidth = 28,
  barGap = 8,
}) => {
  const scrollViewRef = React.useRef<ScrollView>(null);

  if (!data.length) return null;

  const PADDING_HORIZ = 16;
  const maxLabelLength = Math.max(...data.map(d => d.label.length), 4);
  // Optimal step width calculation for compact, balanced spacing without label collision
  const minStepForLabel = maxLabelLength * 6.4 + 4;
  const dynamicMinStepWidth = Math.max(minBarWidth + barGap, minStepForLabel);

  const contentWidth = data.length * dynamicMinStepWidth + PADDING_HORIZ * 2;
  const chartWidth = Math.max(containerWidth - 32, contentWidth);
  const stepWidth = chartWidth / data.length;
  // Increase bar width ratio to 70% for tighter gap between bars
  const barWidth = Math.max(minBarWidth, Math.min(52, stepWidth * 0.70));

  const maxVolume = Math.max(...data.map(d => d.volume), 1000);
  const baselineY = height - 32;
  const maxBarHeight = height - 55;

  return (
    <ScrollView
      ref={scrollViewRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollChartContent}
      onContentSizeChange={() => {
        scrollViewRef.current?.scrollToEnd({ animated: false });
      }}
    >
      <Svg width={chartWidth} height={height}>
        {/* Dash lines */}
        <Line x1="0" y1="20" x2={chartWidth} y2="20" stroke={COLORS.border} strokeDasharray="4 4" />
        <Line
          x1="0"
          y1={20 + maxBarHeight / 2}
          x2={chartWidth}
          y2={20 + maxBarHeight / 2}
          stroke={COLORS.border}
          strokeDasharray="4 4"
        />
        <Line x1="0" y1={baselineY} x2={chartWidth} y2={baselineY} stroke={COLORS.border} />

        {data.map((item, index) => {
          const x = index * stepWidth + (stepWidth - barWidth) / 2;
          const barHeight = Math.max(6, (item.volume / maxVolume) * maxBarHeight);
          const y = baselineY - barHeight;
          const isSelected = selectedIndex === index;
          const isPeak = item.isPeak && item.volume > 0;

          let fillColor = COLORS.border;
          if (isSelected) {
            fillColor = COLORS.primary;
          } else if (isPeak) {
            fillColor = '#10B981';
          } else if (item.volume > 0) {
            fillColor = '#111111';
          }

          return (
            <G key={item.id}>
              {/* Bar Rect */}
              <Rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={Math.min(6, barWidth / 2)}
                fill={fillColor}
                stroke={isSelected ? '#111111' : 'none'}
                strokeWidth={isSelected ? 2 : 0}
              />

              {/* Peak Indicator Dot above bar */}
              {isPeak && !isSelected && (
                <Rect
                  x={x + barWidth / 2 - 3}
                  y={y - 10}
                  width={6}
                  height={6}
                  rx={3}
                  fill="#10B981"
                />
              )}

              {/* Volume text above bar */}
              {item.volume > 0 && (
                <SvgText
                  x={x + barWidth / 2}
                  y={Math.max(12, y - (isPeak ? 12 : 6))}
                  fill={isSelected ? COLORS.textPrimary : COLORS.textMuted}
                  fontSize="9"
                  fontWeight={isSelected ? '800' : '700'}
                  textAnchor="middle"
                >
                  {formatVolumeShort(item.volume)}
                </SvgText>
              )}

              {/* X-Axis Label */}
              <SvgText
                x={x + barWidth / 2}
                y={height - 10}
                fill={isSelected ? COLORS.textPrimary : COLORS.textMuted}
                fontSize="10"
                fontWeight={isSelected ? '800' : '600'}
                textAnchor="middle"
              >
                {item.label}
              </SvgText>

              {/* Touch overlay */}
              <Rect
                x={index * stepWidth}
                y={0}
                width={stepWidth}
                height={height}
                fill="transparent"
                onPress={() => onSelectIndex(index)}
              />
            </G>
          );
        })}
      </Svg>
    </ScrollView>
  );
};

export const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({
  workouts,
  allWorkouts,
  filterMode,
}) => {
  const [containerWidth, setContainerWidth] = useState(320);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Expand Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalResolution, setModalResolution] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [modalSelectedIndex, setModalSelectedIndex] = useState<number | null>(null);

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    if (width > 0) {
      setContainerWidth(width);
    }
  };

  // 1. Calculate Main Volume Data using Smart Aggregator
  const volumeData = useMemo(() => {
    return getSmartAggregatedVolumeData(workouts, filterMode);
  }, [workouts, filterMode]);

  // Determine active main bucket (defaults to peak volume or last bucket)
  const activeIndex = useMemo(() => {
    if (selectedIndex !== null && selectedIndex < volumeData.length) {
      return selectedIndex;
    }
    const peakIdx = volumeData.findIndex(b => b.isPeak && b.volume > 0);
    if (peakIdx >= 0) return peakIdx;
    return Math.max(0, volumeData.length - 1);
  }, [selectedIndex, volumeData]);

  const selectedBucket = volumeData[activeIndex] || null;

  // 2. Muscle Category Breakdown (RP Israetel Hypertrophy Model)
  const muscleBreakdown = useMemo(() => {
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
  }, [workouts]);

  // 3. Modal Volume Data Calculation
  const modalTargetWorkouts = allWorkouts && allWorkouts.length ? allWorkouts : workouts;

  const modalVolumeData = useMemo(() => {
    let buckets: VolumeBucket[] = [];
    if (modalResolution === 'daily') {
      buckets = getDailyBuckets(modalTargetWorkouts, 30);
    } else if (modalResolution === 'weekly') {
      buckets = getWeeklyBuckets(modalTargetWorkouts, 12);
    } else {
      buckets = getMonthlyBuckets(modalTargetWorkouts, 12);
    }

    const maxVol = Math.max(...buckets.map(b => b.volume), 0);
    buckets.forEach(b => {
      b.isPeak = maxVol > 0 && b.volume === maxVol;
    });

    return buckets;
  }, [modalTargetWorkouts, modalResolution]);

  const modalActiveIndex = useMemo(() => {
    if (modalSelectedIndex !== null && modalSelectedIndex < modalVolumeData.length) {
      return modalSelectedIndex;
    }
    const peakIdx = modalVolumeData.findIndex(b => b.isPeak && b.volume > 0);
    if (peakIdx >= 0) return peakIdx;
    return Math.max(0, modalVolumeData.length - 1);
  }, [modalSelectedIndex, modalVolumeData]);

  const modalSelectedBucket = modalVolumeData[modalActiveIndex] || null;

  // Modal overall summary metrics
  const totalPeriodVol = useMemo(() => {
    return modalVolumeData.reduce((acc, b) => acc + b.volume, 0);
  }, [modalVolumeData]);

  const totalPeriodWorkouts = useMemo(() => {
    return modalVolumeData.reduce((acc, b) => acc + b.workoutCount, 0);
  }, [modalVolumeData]);

  const modalMaxVol = useMemo(() => {
    return Math.max(...modalVolumeData.map(b => b.volume), 0);
  }, [modalVolumeData]);

  const avgPeriodVol = useMemo(() => {
    return modalVolumeData.length ? totalPeriodVol / modalVolumeData.length : 0;
  }, [modalVolumeData, totalPeriodVol]);

  return (
    <View style={styles.container}>
      {/* 1. PRIMARY: Muscle Group Hard Sets Benchmark Bento Card */}
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

      {/* 2. SECONDARY: Volume Chart Card (Interactive & Expandable) */}
      <View style={styles.bentoCard} onLayout={handleLayout}>
        {/* Card Header with Expand Button */}
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.cardTitle}>Toplam Yük Değişimi</Text>
              <View style={styles.badgePill}>
                <Text style={styles.badgePillText}>
                  {filterMode === 'weekly'
                    ? 'Son 7 Gün'
                    : filterMode === 'monthly'
                    ? 'Son 30 Gün'
                    : 'Tüm Zamanlar'}
                </Text>
              </View>
            </View>
            <Text style={styles.cardSubtitle}>Kaldırılan toplam tonaj trendi (kg)</Text>
          </View>

          <TouchableOpacity
            style={styles.expandBtn}
            onPress={() => setIsModalOpen(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="expand-outline" size={14} color="#111111" />
            <Text style={styles.expandBtnText}>Büyüt</Text>
          </TouchableOpacity>
        </View>

        {volumeData.length > 0 ? (
          <View style={styles.chartSection}>
            {/* Interactive Tooltip Card */}
            {selectedBucket && (
              <View style={styles.tooltipCard}>
                <View style={styles.tooltipHeader}>
                  <View style={styles.tooltipLeft}>
                    <Ionicons name="calendar" size={14} color={COLORS.primary} />
                    <Text style={styles.tooltipDateText}>{selectedBucket.fullLabel}</Text>
                  </View>
                  {selectedBucket.isPeak && (
                    <View style={styles.peakBadge}>
                      <Ionicons name="trophy" size={10} color="#10B981" />
                      <Text style={styles.peakBadgeText}>Zirve Hacim</Text>
                    </View>
                  )}
                </View>

                <View style={styles.tooltipBody}>
                  <View style={styles.tooltipStat}>
                    <Text style={styles.tooltipLabel}>Kaldırılan Hacim</Text>
                    <Text style={styles.tooltipValText}>
                      {selectedBucket.volume > 0
                        ? `${selectedBucket.volume.toLocaleString('tr-TR')} kg`
                        : '0 kg'}
                    </Text>
                  </View>

                  <View style={styles.tooltipDivider} />

                  <View style={styles.tooltipStat}>
                    <Text style={styles.tooltipLabel}>Tamamlanan Seans</Text>
                    <Text style={styles.tooltipSubText}>
                      {selectedBucket.workoutCount > 0
                        ? `${selectedBucket.workoutCount} Antrenman`
                        : 'Antrenman yok'}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Scrollable SVG Chart */}
            <RenderVolumeSvgChart
              data={volumeData}
              containerWidth={containerWidth}
              height={170}
              selectedIndex={activeIndex}
              onSelectIndex={setSelectedIndex}
              minBarWidth={28}
              barGap={8}
            />
          </View>
        ) : (
          <Text style={styles.noDataText}>Henüz antrenman verisi mevcut değil.</Text>
        )}
      </View>

      {/* 3. EXPAND / DETAIL MODAL */}
      <Modal
        visible={isModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsModalOpen(false)}
      >
        <SafeAreaView style={styles.modalSafeArea} edges={['top', 'bottom', 'left', 'right']}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderTitleRow}>
              <View style={styles.modalTitleIconBg}>
                <Ionicons name="analytics" size={20} color="#111111" />
              </View>
              <View>
                <Text style={styles.modalTitle}>Toplam Yük Analizi</Text>
                <Text style={styles.modalSubtitle}>Kaldırılan tonaj & detaylı trend incelemesi</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setIsModalOpen(false)}
            >
              <Ionicons name="close-circle" size={28} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
            {/* Resolution Selector Segmented Pills */}
            <View style={styles.resSwitcherContainer}>
              <Text style={styles.resSwitcherLabel}>GÖRÜNÜM PERİYODU</Text>
              <View style={styles.resSwitcherBar}>
                {(['daily', 'weekly', 'monthly'] as const).map(res => {
                  const isSelected = modalResolution === res;
                  const resLabels = { daily: 'Günlük', weekly: 'Haftalık', monthly: 'Aylık' };
                  return (
                    <TouchableOpacity
                      key={res}
                      style={[styles.resBtn, isSelected && styles.resBtnSelected]}
                      onPress={() => {
                        setModalResolution(res);
                        setModalSelectedIndex(null);
                      }}
                    >
                      <Text style={[styles.resBtnText, isSelected && styles.resBtnTextSelected]}>
                        {resLabels[res]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Expanded Large Chart (Height 220px) */}
            <View style={styles.modalChartCard}>
              <View style={styles.modalChartHeader}>
                <Text style={styles.modalChartTitle}>
                  {modalResolution === 'daily'
                    ? 'Son 30 Günlük Dağılım'
                    : modalResolution === 'weekly'
                    ? 'Son 12 Haftalık Trend'
                    : 'Son 12 Aylık Trend'}
                </Text>
              </View>

              <RenderVolumeSvgChart
                data={modalVolumeData}
                containerWidth={containerWidth + 40}
                height={220}
                selectedIndex={modalActiveIndex}
                onSelectIndex={setModalSelectedIndex}
                minBarWidth={32}
                barGap={8}
              />
            </View>

            {/* Selected Period Detailed Breakdown Card */}
            {modalSelectedBucket && (
              <View style={styles.modalDetailCard}>
                <View style={styles.modalDetailHeader}>
                  <View style={styles.modalDetailTitleRow}>
                    <Ionicons name="calendar" size={16} color={COLORS.primary} />
                    <Text style={styles.modalDetailDate}>{modalSelectedBucket.fullLabel}</Text>
                  </View>
                  {modalSelectedBucket.isPeak && (
                    <View style={styles.peakPill}>
                      <Ionicons name="trophy" size={12} color="#111111" />
                      <Text style={styles.peakPillText}>Zirve Periyot</Text>
                    </View>
                  )}
                </View>

                <View style={styles.modalMetricGrid}>
                  <View style={styles.modalMetricBox}>
                    <Text style={styles.modalMetricLabel}>Toplam Kaldırılan</Text>
                    <Text style={styles.modalMetricVal}>
                      {modalSelectedBucket.volume.toLocaleString('tr-TR')} kg
                    </Text>
                  </View>

                  <View style={styles.modalMetricBox}>
                    <Text style={styles.modalMetricLabel}>Tamamlanan Seans</Text>
                    <Text style={styles.modalMetricVal}>
                      {modalSelectedBucket.workoutCount} Antrenman
                    </Text>
                  </View>

                  <View style={styles.modalMetricBox}>
                    <Text style={styles.modalMetricLabel}>Seans Başı Ort.</Text>
                    <Text style={styles.modalMetricVal}>
                      {modalSelectedBucket.workoutCount > 0
                        ? `${Math.round(modalSelectedBucket.volume / modalSelectedBucket.workoutCount).toLocaleString('tr-TR')} kg`
                        : '0 kg'}
                    </Text>
                  </View>

                  <View style={styles.modalMetricBox}>
                    <Text style={styles.modalMetricLabel}>Zirveye Oranı</Text>
                    <Text style={styles.modalMetricVal}>
                      %{modalMaxVol > 0 ? Math.round((modalSelectedBucket.volume / modalMaxVol) * 100) : 0}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Period Aggregated Overall Summary Bento Grid */}
            <View style={styles.modalSummarySection}>
              <Text style={styles.modalSectionTitle}>PERFORMANS ÖZET METRİKLERİ</Text>
              <View style={styles.modalSummaryGrid}>
                <View style={styles.modalSummarySquare}>
                  <Ionicons name="barbell-outline" size={18} color="#111111" />
                  <Text style={styles.modalSummaryVal}>
                    {(totalPeriodVol / 1000).toFixed(1)} <Text style={styles.modalSummaryUnit}>Ton</Text>
                  </Text>
                  <Text style={styles.modalSummarySub}>Toplam Kaldırılan Yük</Text>
                </View>

                <View style={styles.modalSummarySquare}>
                  <Ionicons name="trophy-outline" size={18} color="#10B981" />
                  <Text style={styles.modalSummaryVal}>
                    {formatVolumeShort(modalMaxVol)} <Text style={styles.modalSummaryUnit}>kg</Text>
                  </Text>
                  <Text style={styles.modalSummarySub}>En Yüksek Hacim</Text>
                </View>

                <View style={styles.modalSummarySquare}>
                  <Ionicons name="calculator-outline" size={18} color="#8B5CF6" />
                  <Text style={styles.modalSummaryVal}>
                    {formatVolumeShort(Math.round(avgPeriodVol))} <Text style={styles.modalSummaryUnit}>kg</Text>
                  </Text>
                  <Text style={styles.modalSummarySub}>Ortalama Periyot Yükü</Text>
                </View>

                <View style={styles.modalSummarySquare}>
                  <Ionicons name="flame-outline" size={18} color="#EF4444" />
                  <Text style={styles.modalSummaryVal}>
                    {totalPeriodWorkouts} <Text style={styles.modalSummaryUnit}>Seans</Text>
                  </Text>
                  <Text style={styles.modalSummarySub}>Toplam Antrenman</Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 8,
  },
  headerLeft: {
    flex: 1,
    gap: 2,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
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
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  badgePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    ...SHADOWS.soft,
  },
  expandBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#111111',
  },
  chartSection: {
    gap: 12,
  },
  scrollChartContent: {
    paddingVertical: 4,
  },
  tooltipCard: {
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  tooltipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tooltipLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tooltipDateText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  peakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 100,
  },
  peakBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
  },
  tooltipBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 4,
  },
  tooltipStat: {
    alignItems: 'center',
    gap: 2,
  },
  tooltipLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  tooltipValText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  tooltipSubText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  tooltipDivider: {
    width: 1,
    height: 24,
    backgroundColor: COLORS.border,
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
  // Modal Styles
  modalSafeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalTitleIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  modalSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  modalCloseBtn: {
    padding: 2,
  },
  modalScrollContent: {
    padding: 20,
    gap: 16,
    paddingBottom: 40,
  },
  resSwitcherContainer: {
    gap: 6,
  },
  resSwitcherLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
  },
  resSwitcherBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 100,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.soft,
  },
  resBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 100,
  },
  resBtnSelected: {
    backgroundColor: '#111111',
  },
  resBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  resBtnTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalChartCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
    ...SHADOWS.soft,
  },
  modalChartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalChartTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  modalPeakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  modalPeakBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#111111',
  },
  modalDetailCard: {
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  modalDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalDetailTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalDetailDate: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  peakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  peakPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#111111',
  },
  modalMetricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  modalMetricBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 2,
  },
  modalMetricLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  modalMetricVal: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  modalSummarySection: {
    gap: 10,
    marginTop: 4,
  },
  modalSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
  },
  modalSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  modalSummarySquare: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
    ...SHADOWS.soft,
  },
  modalSummaryVal: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  modalSummaryUnit: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  modalSummarySub: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
});
