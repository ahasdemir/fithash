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
import { getMondayOfWeek } from '../services/storage';

export interface VolumeBucket {
  id: string;
  label: string;
  fullLabel: string;
  volume: number;
  sets: number;
  workoutCount: number;
  startDate: string;
  endDate: string;
  isPeak?: boolean;
  isPeakSet?: boolean;
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
 * Generates 7 Daily Buckets for the CURRENT CALENDAR WEEK (Pazartesi to Pazar)
 */
const getCalendarWeekBuckets = (workouts: WorkoutSession[]): VolumeBucket[] => {
  const buckets: VolumeBucket[] = [];
  const now = new Date();
  const monday = getMondayOfWeek(now);

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const dateStr = formatISODate(d);

    const dayWorkouts = workouts.filter(w => w.date === dateStr && w.completed !== false);
    const vol = dayWorkouts.reduce((sum, w) => sum + (w.totalVolume || 0), 0);
    let sets = 0;
    dayWorkouts.forEach(w => {
      w.exercises?.forEach(ex => {
        if (ex.category === 'Kardiyo') return; // Exclude cardio from weightlifting sets
        sets += ex.sets?.filter(s => s.completed && !s.isWarmup).length || 0;
      });
    });

    const dayName = DAY_SHORT_TR[d.getDay()];
    const monthFull = MONTH_FULL_TR[d.getMonth()];

    buckets.push({
      id: dateStr,
      label: dayName,
      fullLabel: `${d.getDate()} ${monthFull} ${d.getFullYear()}, ${dayName}`,
      volume: vol,
      sets,
      workoutCount: dayWorkouts.length,
      startDate: dateStr,
      endDate: dateStr,
    });
  }

  return buckets;
};

/**
 * Generates Weekly Buckets for the CURRENT CALENDAR MONTH (1st to last day of month)
 */
const getCurrentMonthWeeklyBuckets = (workouts: WorkoutSession[]): VolumeBucket[] => {
  const buckets: VolumeBucket[] = [];
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();

  const ranges = [
    { start: 1, end: 7, label: `1-7 ${MONTH_SHORT_TR[month]}` },
    { start: 8, end: 14, label: `8-14 ${MONTH_SHORT_TR[month]}` },
    { start: 15, end: 21, label: `15-21 ${MONTH_SHORT_TR[month]}` },
    { start: 22, end: lastDayOfMonth, label: `22-${lastDayOfMonth} ${MONTH_SHORT_TR[month]}` },
  ];

  ranges.forEach(r => {
    const startStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(r.start).padStart(2, '0')}`;
    const endStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(r.end).padStart(2, '0')}`;

    const rangeWorkouts = workouts.filter(w => w.date >= startStr && w.date <= endStr && w.completed !== false);
    const vol = rangeWorkouts.reduce((sum, w) => sum + (w.totalVolume || 0), 0);
    let sets = 0;
    rangeWorkouts.forEach(w => {
      w.exercises?.forEach(ex => {
        if (ex.category === 'Kardiyo') return;
        sets += ex.sets?.filter(s => s.completed && !s.isWarmup).length || 0;
      });
    });

    buckets.push({
      id: `${startStr}_${endStr}`,
      label: r.label,
      fullLabel: `${r.start} - ${r.end} ${MONTH_FULL_TR[month]} ${year}`,
      volume: vol,
      sets,
      workoutCount: rangeWorkouts.length,
      startDate: startStr,
      endDate: endStr,
    });
  });

  return buckets;
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

    const dayWorkouts = workouts.filter(w => w.date === dateStr && w.completed !== false);
    const vol = dayWorkouts.reduce((sum, w) => sum + (w.totalVolume || 0), 0);
    let sets = 0;
    dayWorkouts.forEach(w => {
      w.exercises?.forEach(ex => {
        if (ex.category === 'Kardiyo') return;
        sets += ex.sets?.filter(s => s.completed && !s.isWarmup).length || 0;
      });
    });

    const dayName = DAY_SHORT_TR[d.getDay()];
    const monthShort = MONTH_SHORT_TR[d.getMonth()];
    const monthFull = MONTH_FULL_TR[d.getMonth()];

    buckets.push({
      id: dateStr,
      label: daysCount <= 7 ? dayName : `${d.getDate()} ${monthShort}`,
      fullLabel: `${d.getDate()} ${monthFull} ${d.getFullYear()}, ${dayName}`,
      volume: vol,
      sets,
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

    const rangeWorkouts = workouts.filter(w => w.date >= startStr && w.date <= endStr && w.completed !== false);
    const vol = rangeWorkouts.reduce((sum, w) => sum + (w.totalVolume || 0), 0);
    let sets = 0;
    rangeWorkouts.forEach(w => {
      w.exercises?.forEach(ex => {
        if (ex.category === 'Kardiyo') return;
        sets += ex.sets?.filter(s => s.completed && !s.isWarmup).length || 0;
      });
    });

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
      sets,
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

    const monthWorkouts = workouts.filter(w => w.date >= startStr && w.date <= endStr && w.completed !== false);
    const vol = monthWorkouts.reduce((sum, w) => sum + (w.totalVolume || 0), 0);
    let sets = 0;
    monthWorkouts.forEach(w => {
      w.exercises?.forEach(ex => {
        if (ex.category === 'Kardiyo') return;
        sets += ex.sets?.filter(s => s.completed && !s.isWarmup).length || 0;
      });
    });

    const monthName = MONTH_FULL_TR[month];
    const monthShort = MONTH_SHORT_TR[month];

    buckets.push({
      id: `${year}_${month}`,
      label: monthsCount > 6 ? `${monthShort} '${String(year).slice(-2)}` : monthName,
      fullLabel: `${monthName} ${year}`,
      volume: vol,
      sets,
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
    // Current Calendar Week: Pazartesi -> Pazar (7 days)
    buckets = getCalendarWeekBuckets(workouts);
  } else if (filterMode === 'monthly') {
    // Current Calendar Month: 1 -> last day in ~weekly chunks
    buckets = getCurrentMonthWeeklyBuckets(workouts);
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

  // Mark Peak volume and Peak sets
  const maxVol = Math.max(...buckets.map(b => b.volume), 0);
  const maxSets = Math.max(...buckets.map(b => b.sets), 0);
  buckets.forEach(b => {
    b.isPeak = maxVol > 0 && b.volume === maxVol;
    b.isPeakSet = maxSets > 0 && b.sets === maxSets;
  });

  return buckets;
};

interface RenderSvgBarChartProps {
  data: VolumeBucket[];
  containerWidth: number;
  height?: number;
  valueKey?: 'volume' | 'sets';
  selectedIndex: number | null;
  onSelectIndex: (index: number) => void;
  minBarWidth?: number;
  barGap?: number;
}

const RenderSvgBarChartBase: React.FC<RenderSvgBarChartProps> = ({
  data,
  containerWidth,
  height = 165,
  valueKey = 'volume',
  selectedIndex,
  onSelectIndex,
  minBarWidth = 26,
  barGap = 8,
}) => {
  const scrollViewRef = React.useRef<ScrollView>(null);

  if (!data.length) return null;

  const isSets = valueKey === 'sets';
  const PADDING_HORIZ = 14;
  const maxLabelLength = Math.max(...data.map(d => d.label.length), 4);
  const minStepForLabel = maxLabelLength * 6.4 + 4;
  const dynamicMinStepWidth = Math.max(minBarWidth + barGap, minStepForLabel);

  const contentWidth = data.length * dynamicMinStepWidth + PADDING_HORIZ * 2;
  const chartWidth = Math.max(containerWidth - 28, contentWidth);
  const stepWidth = chartWidth / data.length;
  const barWidth = Math.max(minBarWidth, Math.min(48, stepWidth * 0.68));

  const maxValue = isSets
    ? Math.max(...data.map(d => d.sets), 10)
    : Math.max(...data.map(d => d.volume), 1000);

  const baselineY = height - 28;
  const maxBarHeight = height - 52;

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
        {/* Dash lines - Subtle gridlines #1B2531 */}
        <Line x1="0" y1="20" x2={chartWidth} y2="20" stroke="#1B2531" strokeDasharray="3 3" />
        <Line
          x1="0"
          y1={20 + maxBarHeight / 2}
          x2={chartWidth}
          y2={20 + maxBarHeight / 2}
          stroke="#1B2531"
          strokeDasharray="3 3"
        />
        <Line x1="0" y1={baselineY} x2={chartWidth} y2={baselineY} stroke={COLORS.border} />

        {data.map((item, index) => {
          const val = isSets ? item.sets : item.volume;
          const x = index * stepWidth + (stepWidth - barWidth) / 2;
          const barHeight = val > 0 ? Math.max(6, (val / maxValue) * maxBarHeight) : 3;
          const y = baselineY - barHeight;
          const isSelected = selectedIndex === index;
          const isPeak = isSets ? (item.isPeakSet && val > 0) : (item.isPeak && val > 0);

          let fillColor = '#1B2531';
          let fillOpacity = 1;
          if (isSelected) {
            fillColor = COLORS.primary;
            fillOpacity = 1;
          } else if (isPeak) {
            fillColor = COLORS.success;
            fillOpacity = 0.85;
          } else if (val > 0) {
            fillColor = COLORS.primary;
            fillOpacity = 0.45;
          }

          const valText = isSets
            ? (val > 0 ? `${val}` : '')
            : (val > 0 ? formatVolumeShort(val) : '');

          return (
            <G key={item.id}>
              {/* Active selection glow halo */}
              {isSelected && val > 0 && (
                <Rect
                  x={x - 2}
                  y={y - 2}
                  width={barWidth + 4}
                  height={barHeight + 2}
                  rx={5}
                  fill="rgba(76, 194, 255, 0.25)"
                />
              )}

              {/* Bar Rect */}
              <Rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={4}
                fill={fillColor}
                fillOpacity={fillOpacity}
                stroke={isSelected ? COLORS.primary : 'none'}
                strokeWidth={isSelected ? 1.5 : 0}
              />

              {/* Peak Indicator Dot above bar */}
              {isPeak && !isSelected && (
                <Rect
                  x={x + barWidth / 2 - 2.5}
                  y={y - 8}
                  width={5}
                  height={5}
                  rx={2.5}
                  fill={COLORS.success}
                />
              )}

              {/* Value text above bar */}
              {valText !== '' && (
                <SvgText
                  x={x + barWidth / 2}
                  y={Math.max(11, y - (isPeak ? 11 : 5))}
                  fill={isSelected ? COLORS.primary : COLORS.textSecondary}
                  fontSize="9"
                  fontWeight={isSelected ? '800' : '700'}
                  textAnchor="middle"
                >
                  {valText}
                </SvgText>
              )}

              {/* X-Axis Label */}
              <SvgText
                x={x + barWidth / 2}
                y={height - 8}
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

// Memoized so that unrelated AnalyticsCharts state changes (the other chart's
// selection, modal open/metric/resolution switches) don't re-render this
// chart's full SVG bar tree — its props are stable between those changes.
const RenderSvgBarChart = React.memo(RenderSvgBarChartBase);

interface MuscleBreakdownRowProps {
  item: { category: string; sets: number; volume: number; color: string };
  targetBenchmark: number;
  totalPeriodSets: number;
}

// Memoized legend/progress row for the muscle group breakdown: tapping a bar
// in either chart re-renders AnalyticsCharts; these rows bail out because
// their inputs (memoized breakdown, filterMode-derived benchmark) are unchanged.
const MuscleBreakdownRow = React.memo(function MuscleBreakdownRow({
  item,
  targetBenchmark,
  totalPeriodSets,
}: MuscleBreakdownRowProps) {
  const setPercentage = Math.min(100, Math.round((item.sets / targetBenchmark) * 100));

  return (
    <View style={styles.muscleRow}>
      <View style={styles.muscleHeader}>
        <View style={styles.muscleTitleLeft}>
          <View style={[styles.dot, { backgroundColor: item.color }]} />
          <Text style={styles.muscleName}>{item.category}</Text>
        </View>

        <View style={styles.muscleMetaRight}>
          <Text style={styles.muscleSetsText}>{item.sets} Set</Text>
          <Text style={styles.musclePercentText}>
            (%{Math.round((item.sets / (totalPeriodSets || 1)) * 100)})
          </Text>
          {item.volume > 0 && (
            <Text style={styles.muscleVolText}>
              • {item.volume.toLocaleString('tr-TR')} kg
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
});

export const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({
  workouts,
  allWorkouts,
  filterMode,
}) => {
  const [containerWidth, setContainerWidth] = useState(320);
  const [selectedSetIndex, setSelectedSetIndex] = useState<number | null>(null);
  const [selectedVolumeIndex, setSelectedVolumeIndex] = useState<number | null>(null);

  // Expand Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMetric, setModalMetric] = useState<'volume' | 'sets'>('sets');
  const [modalResolution, setModalResolution] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [modalSelectedIndex, setModalSelectedIndex] = useState<number | null>(null);

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    if (width > 0) {
      setContainerWidth(width);
    }
  };

  // 1. Calculate Main Aggregated Data (volume + sets)
  const volumeData = useMemo(() => {
    return getSmartAggregatedVolumeData(workouts, filterMode);
  }, [workouts, filterMode]);

  // Active Set Bucket (defaults to peak sets or last bucket)
  const activeSetIndex = useMemo(() => {
    if (selectedSetIndex !== null && selectedSetIndex < volumeData.length) {
      return selectedSetIndex;
    }
    const peakIdx = volumeData.findIndex(b => b.isPeakSet && b.sets > 0);
    if (peakIdx >= 0) return peakIdx;
    return Math.max(0, volumeData.length - 1);
  }, [selectedSetIndex, volumeData]);

  const selectedSetBucket = volumeData[activeSetIndex] || null;

  // Active Volume Bucket (defaults to peak volume or last bucket)
  const activeVolumeIndex = useMemo(() => {
    if (selectedVolumeIndex !== null && selectedVolumeIndex < volumeData.length) {
      return selectedVolumeIndex;
    }
    const peakIdx = volumeData.findIndex(b => b.isPeak && b.volume > 0);
    if (peakIdx >= 0) return peakIdx;
    return Math.max(0, volumeData.length - 1);
  }, [selectedVolumeIndex, volumeData]);

  const selectedVolumeBucket = volumeData[activeVolumeIndex] || null;

  // Total sets in the current filtered period
  const totalPeriodSets = useMemo(() => {
    return volumeData.reduce((acc, b) => acc + b.sets, 0);
  }, [volumeData]);

  // 2. Muscle Category Breakdown
  const muscleBreakdown = useMemo(() => {
    const categorySets: Record<string, number> = {};
    const categoryVolume: Record<string, number> = {};
    let grandTotalVol = 0;

    workouts.forEach(w => {
      w.exercises?.forEach(ex => {
        const completedSetsCount = ex.sets?.filter(s => s.completed && !s.isWarmup).length || 0;
        const vol = ex.sets?.reduce((acc, s) => (s.completed ? acc + s.weight * s.reps : acc), 0) || 0;

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
        color: COLORS.category[category as any] || COLORS.primary,
      }))
      .sort((a, b) => b.sets - a.sets);
  }, [workouts]);

  // Progress-bar benchmark (15 sets/week, 60 sets/month, or the period max in
  // 'all' mode). Previously recomputed inside every row on every render.
  const targetBenchmark =
    filterMode === 'weekly'
      ? 15
      : filterMode === 'monthly'
      ? 60
      : Math.max(...muscleBreakdown.map(m => m.sets), 1);

  // 3. Modal Aggregated Data Calculation
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
    const maxSets = Math.max(...buckets.map(b => b.sets), 0);
    buckets.forEach(b => {
      b.isPeak = maxVol > 0 && b.volume === maxVol;
      b.isPeakSet = maxSets > 0 && b.sets === maxSets;
    });

    return buckets;
  }, [modalTargetWorkouts, modalResolution]);

  const modalActiveIndex = useMemo(() => {
    if (modalSelectedIndex !== null && modalSelectedIndex < modalVolumeData.length) {
      return modalSelectedIndex;
    }
    const peakIdx = modalMetric === 'sets'
      ? modalVolumeData.findIndex(b => b.isPeakSet && b.sets > 0)
      : modalVolumeData.findIndex(b => b.isPeak && b.volume > 0);
    if (peakIdx >= 0) return peakIdx;
    return Math.max(0, modalVolumeData.length - 1);
  }, [modalSelectedIndex, modalVolumeData, modalMetric]);

  const modalSelectedBucket = modalVolumeData[modalActiveIndex] || null;

  // Modal overall summary metrics
  const totalModalVol = useMemo(() => {
    return modalVolumeData.reduce((acc, b) => acc + b.volume, 0);
  }, [modalVolumeData]);

  const totalModalSets = useMemo(() => {
    return modalVolumeData.reduce((acc, b) => acc + b.sets, 0);
  }, [modalVolumeData]);

  const totalPeriodWorkouts = useMemo(() => {
    return modalVolumeData.reduce((acc, b) => acc + b.workoutCount, 0);
  }, [modalVolumeData]);

  const modalMaxVol = useMemo(() => {
    return Math.max(...modalVolumeData.map(b => b.volume), 0);
  }, [modalVolumeData]);

  const modalMaxSets = useMemo(() => {
    return Math.max(...modalVolumeData.map(b => b.sets), 0);
  }, [modalVolumeData]);

  const avgPeriodVol = useMemo(() => {
    return modalVolumeData.length ? totalModalVol / modalVolumeData.length : 0;
  }, [modalVolumeData, totalModalVol]);

  const avgSetsPerWorkout = useMemo(() => {
    return totalPeriodWorkouts > 0 ? totalModalSets / totalPeriodWorkouts : 0;
  }, [totalModalSets, totalPeriodWorkouts]);

  return (
    <View style={styles.container}>
      {/* 1. PRIMARY: Set Count Trend & Muscle Group Distribution Bento Card */}
      <View style={styles.bentoCard} onLayout={handleLayout}>
        {/* Card Header with Expand Button */}
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.cardTitle}>
                {filterMode === 'weekly'
                  ? 'Haftalık Set Dağılımı'
                  : filterMode === 'monthly'
                  ? 'Aylık Set Dağılımı'
                  : 'Tüm Zamanlar Set Dağılımı'}
              </Text>
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
            <Text style={styles.cardSubtitle}>
              {totalPeriodSets > 0
                ? `Bu dönemde toplam ${totalPeriodSets} çalışma seti tamamlandı`
                : 'Döneme ait çalışma seti trendi'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.expandBtn}
            onPress={() => {
              setModalMetric('sets');
              setIsModalOpen(true);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="expand-outline" size={13} color={COLORS.primary} />
            <Text style={styles.expandBtnText}>Büyüt</Text>
          </TouchableOpacity>
        </View>

        {volumeData.length > 0 ? (
          <View style={styles.chartSection}>
            {/* Interactive Tooltip Card for Sets */}
            {selectedSetBucket && (
              <View style={styles.tooltipCard}>
                <View style={styles.tooltipHeader}>
                  <View style={styles.tooltipLeft}>
                    <Ionicons name="calendar" size={13} color={COLORS.primary} />
                    <Text style={styles.tooltipDateText} numberOfLines={1} ellipsizeMode="tail">
                      {selectedSetBucket.fullLabel}
                    </Text>
                  </View>
                  {selectedSetBucket.isPeakSet && (
                    <View style={styles.peakBadge}>
                      <Ionicons name="flame" size={10} color={COLORS.success} />
                      <Text style={styles.peakBadgeText}>En Yoğun Gün</Text>
                    </View>
                  )}
                </View>

                <View style={styles.tooltipBody}>
                  <View style={styles.tooltipStat}>
                    <Text style={styles.tooltipLabel}>Çalışma Seti</Text>
                    <Text style={styles.tooltipValText}>
                      {selectedSetBucket.sets > 0 ? `${selectedSetBucket.sets} Set` : '0 Set'}
                    </Text>
                  </View>

                  <View style={styles.tooltipDivider} />

                  <View style={styles.tooltipStat}>
                    <Text style={styles.tooltipLabel}>Tamamlanan Seans</Text>
                    <Text style={styles.tooltipSubText}>
                      {selectedSetBucket.workoutCount > 0
                        ? `${selectedSetBucket.workoutCount} Antrenman`
                        : 'Antrenman yok'}
                    </Text>
                  </View>

                  <View style={styles.tooltipDivider} />

                  <View style={styles.tooltipStat}>
                    <Text style={styles.tooltipLabel}>Kaldırılan Hacim</Text>
                    <Text style={styles.tooltipSubText}>
                      {selectedSetBucket.volume > 0
                        ? `${selectedSetBucket.volume.toLocaleString('tr-TR')} kg`
                        : '0 kg'}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Scrollable SVG Chart for Sets */}
            <RenderSvgBarChart
              data={volumeData}
              containerWidth={containerWidth}
              height={160}
              valueKey="sets"
              selectedIndex={activeSetIndex}
              onSelectIndex={setSelectedSetIndex}
              minBarWidth={26}
              barGap={8}
            />
          </View>
        ) : (
          <Text style={styles.noDataText}>Henüz antrenman verisi mevcut değil.</Text>
        )}

        {/* Inner Divider */}
        <View style={styles.cardInnerDivider} />

        {/* Kas Grubu Kırılımı (Muscle Group Breakdown) */}
        <View style={styles.muscleSubHeader}>
          <Text style={styles.muscleSubTitle}>Kas Grubu Dağılımı</Text>
          <Text style={styles.muscleSubSubtitle}>
            {filterMode === 'weekly'
              ? 'RP Hipertrofi Hedefi (10-20 Set / Hafta)'
              : filterMode === 'monthly'
              ? 'Aylık Hipertrofi Dağılımı (40-80 Set / Ay)'
              : 'Tüm Zamanlar Kas Grubu Oranları'}
          </Text>
        </View>

        {muscleBreakdown.length > 0 ? (
          <View style={styles.muscleList}>
            {muscleBreakdown.map(item => (
              <MuscleBreakdownRow
                key={item.category}
                item={item}
                targetBenchmark={targetBenchmark}
                totalPeriodSets={totalPeriodSets}
              />
            ))}
          </View>
        ) : (
          <Text style={styles.noDataText}>Analiz edilecek antrenman verisi henüz yok.</Text>
        )}
      </View>

      {/* 2. SECONDARY: Volume Chart Card (Interactive & Expandable) */}
      <View style={styles.bentoCard}>
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
            onPress={() => {
              setModalMetric('volume');
              setIsModalOpen(true);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="expand-outline" size={13} color={COLORS.primary} />
            <Text style={styles.expandBtnText}>Büyüt</Text>
          </TouchableOpacity>
        </View>

        {volumeData.length > 0 ? (
          <View style={styles.chartSection}>
            {/* Interactive Tooltip Card for Volume */}
            {selectedVolumeBucket && (
              <View style={styles.tooltipCard}>
                <View style={styles.tooltipHeader}>
                  <View style={styles.tooltipLeft}>
                    <Ionicons name="calendar" size={13} color={COLORS.primary} />
                    <Text style={styles.tooltipDateText} numberOfLines={1} ellipsizeMode="tail">
                      {selectedVolumeBucket.fullLabel}
                    </Text>
                  </View>
                  {selectedVolumeBucket.isPeak && (
                    <View style={styles.peakBadge}>
                      <Ionicons name="trophy" size={10} color={COLORS.success} />
                      <Text style={styles.peakBadgeText}>Zirve Hacim</Text>
                    </View>
                  )}
                </View>

                <View style={styles.tooltipBody}>
                  <View style={styles.tooltipStat}>
                    <Text style={styles.tooltipLabel}>Kaldırılan Hacim</Text>
                    <Text style={styles.tooltipValText}>
                      {selectedVolumeBucket.volume > 0
                        ? `${selectedVolumeBucket.volume.toLocaleString('tr-TR')} kg`
                        : '0 kg'}
                    </Text>
                  </View>

                  <View style={styles.tooltipDivider} />

                  <View style={styles.tooltipStat}>
                    <Text style={styles.tooltipLabel}>Tamamlanan Seans</Text>
                    <Text style={styles.tooltipSubText}>
                      {selectedVolumeBucket.workoutCount > 0
                        ? `${selectedVolumeBucket.workoutCount} Antrenman`
                        : 'Antrenman yok'}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Scrollable SVG Chart for Volume */}
            <RenderSvgBarChart
              data={volumeData}
              containerWidth={containerWidth}
              height={165}
              valueKey="volume"
              selectedIndex={activeVolumeIndex}
              onSelectIndex={setSelectedVolumeIndex}
              minBarWidth={26}
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
                <Ionicons
                  name={modalMetric === 'sets' ? 'layers-outline' : 'analytics'}
                  size={18}
                  color={COLORS.primary}
                />
              </View>
              <View>
                <Text style={styles.modalTitle}>
                  {modalMetric === 'sets' ? 'Çalışma Seti Analizi' : 'Toplam Yük Analizi'}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {modalMetric === 'sets'
                    ? 'Tamamlanan çalışma setleri & periyot trendi'
                    : 'Kaldırılan tonaj & detaylı trend incelemesi'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setIsModalOpen(false)}
            >
              <Ionicons name="close-circle" size={26} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
            {/* Metric Switcher Segmented Pills */}
            <View style={styles.metricSwitcherContainer}>
              <Text style={styles.metricSwitcherLabel}>ANALİZ METRİĞİ</Text>
              <View style={styles.metricSwitcherBar}>
                <TouchableOpacity
                  style={[styles.metricBtn, modalMetric === 'sets' && styles.metricBtnSelected]}
                  onPress={() => {
                    setModalMetric('sets');
                    setModalSelectedIndex(null);
                  }}
                >
                  <Text style={[styles.metricBtnText, modalMetric === 'sets' && styles.metricBtnTextSelected]}>
                    Çalışma Seti
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.metricBtn, modalMetric === 'volume' && styles.metricBtnSelected]}
                  onPress={() => {
                    setModalMetric('volume');
                    setModalSelectedIndex(null);
                  }}
                >
                  <Text style={[styles.metricBtnText, modalMetric === 'volume' && styles.metricBtnTextSelected]}>
                    Toplam Tonaj (kg)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

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

            {/* Expanded Large Chart (Height 210px) */}
            <View style={styles.modalChartCard}>
              <View style={styles.modalChartHeader}>
                <Text style={styles.modalChartTitle}>
                  {modalMetric === 'sets'
                    ? modalResolution === 'daily'
                      ? 'Son 30 Günlük Set Dağılımı'
                      : modalResolution === 'weekly'
                      ? 'Son 12 Haftalık Set Trendi'
                      : 'Son 12 Aylık Set Trendi'
                    : modalResolution === 'daily'
                    ? 'Son 30 Günlük Yük Dağılımı'
                    : modalResolution === 'weekly'
                    ? 'Son 12 Haftalık Yük Trendi'
                    : 'Son 12 Aylık Yük Trendi'}
                </Text>
              </View>

              <RenderSvgBarChart
                data={modalVolumeData}
                containerWidth={containerWidth + 40}
                height={210}
                valueKey={modalMetric}
                selectedIndex={modalActiveIndex}
                onSelectIndex={setModalSelectedIndex}
                minBarWidth={30}
                barGap={8}
              />
            </View>

            {/* Selected Period Detailed Breakdown Card */}
            {modalSelectedBucket && (
              <View style={styles.modalDetailCard}>
                <View style={styles.modalDetailHeader}>
                  <View style={styles.modalDetailTitleRow}>
                    <Ionicons name="calendar" size={15} color={COLORS.primary} />
                    <Text style={styles.modalDetailDate} numberOfLines={1} ellipsizeMode="tail">
                      {modalSelectedBucket.fullLabel}
                    </Text>
                  </View>
                  {(modalMetric === 'sets' ? modalSelectedBucket.isPeakSet : modalSelectedBucket.isPeak) && (
                    <View style={styles.peakPill}>
                      <Ionicons name="trophy" size={11} color={COLORS.textInverted} />
                      <Text style={styles.peakPillText}>Zirve Periyot</Text>
                    </View>
                  )}
                </View>

                <View style={styles.modalMetricGrid}>
                  {modalMetric === 'sets' ? (
                    <>
                      <View style={styles.modalMetricBox}>
                        <Text style={styles.modalMetricLabel}>Çalışma Seti</Text>
                        <Text style={styles.modalMetricVal}>
                          {modalSelectedBucket.sets} Set
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
                            ? `${(modalSelectedBucket.sets / modalSelectedBucket.workoutCount).toFixed(1)} Set`
                            : '0 Set'}
                        </Text>
                      </View>

                      <View style={styles.modalMetricBox}>
                        <Text style={styles.modalMetricLabel}>Zirveye Oranı</Text>
                        <Text style={styles.modalMetricVal}>
                          %{modalMaxSets > 0 ? Math.round((modalSelectedBucket.sets / modalMaxSets) * 100) : 0}
                        </Text>
                      </View>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                </View>
              </View>
            )}

            {/* Period Aggregated Overall Summary Bento Grid */}
            <View style={styles.modalSummarySection}>
              <Text style={styles.modalSectionTitle}>PERFORMANS ÖZET METRİKLERİ</Text>
              <View style={styles.modalSummaryGrid}>
                {modalMetric === 'sets' ? (
                  <>
                    <View style={styles.modalSummarySquare}>
                      <Ionicons name="layers-outline" size={16} color={COLORS.primary} />
                      <Text style={styles.modalSummaryVal}>
                        {totalModalSets} <Text style={styles.modalSummaryUnit}>Set</Text>
                      </Text>
                      <Text style={styles.modalSummarySub}>Toplam Çalışma Seti</Text>
                    </View>

                    <View style={styles.modalSummarySquare}>
                      <Ionicons name="flame-outline" size={16} color={COLORS.success} />
                      <Text style={styles.modalSummaryVal}>
                        {modalMaxSets} <Text style={styles.modalSummaryUnit}>Set</Text>
                      </Text>
                      <Text style={styles.modalSummarySub}>En Yüksek Periyot</Text>
                    </View>

                    <View style={styles.modalSummarySquare}>
                      <Ionicons name="calculator-outline" size={16} color="#8B5CF6" />
                      <Text style={styles.modalSummaryVal}>
                        {avgSetsPerWorkout.toFixed(1)} <Text style={styles.modalSummaryUnit}>Set</Text>
                      </Text>
                      <Text style={styles.modalSummarySub}>Seans Başı Ortalama</Text>
                    </View>

                    <View style={styles.modalSummarySquare}>
                      <Ionicons name="barbell-outline" size={16} color={COLORS.danger} />
                      <Text style={styles.modalSummaryVal}>
                        {totalPeriodWorkouts} <Text style={styles.modalSummaryUnit}>Seans</Text>
                      </Text>
                      <Text style={styles.modalSummarySub}>Toplam Antrenman</Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.modalSummarySquare}>
                      <Ionicons name="barbell-outline" size={16} color={COLORS.primary} />
                      <Text style={styles.modalSummaryVal}>
                        {(totalModalVol / 1000).toFixed(1)} <Text style={styles.modalSummaryUnit}>Ton</Text>
                      </Text>
                      <Text style={styles.modalSummarySub}>Toplam Kaldırılan Yük</Text>
                    </View>

                    <View style={styles.modalSummarySquare}>
                      <Ionicons name="trophy-outline" size={16} color={COLORS.success} />
                      <Text style={styles.modalSummaryVal}>
                        {formatVolumeShort(modalMaxVol)} <Text style={styles.modalSummaryUnit}>kg</Text>
                      </Text>
                      <Text style={styles.modalSummarySub}>En Yüksek Hacim</Text>
                    </View>

                    <View style={styles.modalSummarySquare}>
                      <Ionicons name="calculator-outline" size={16} color="#8B5CF6" />
                      <Text style={styles.modalSummaryVal}>
                        {formatVolumeShort(Math.round(avgPeriodVol))} <Text style={styles.modalSummaryUnit}>kg</Text>
                      </Text>
                      <Text style={styles.modalSummarySub}>Ortalama Periyot Yükü</Text>
                    </View>

                    <View style={styles.modalSummarySquare}>
                      <Ionicons name="flame-outline" size={16} color={COLORS.danger} />
                      <Text style={styles.modalSummaryVal}>
                        {totalPeriodWorkouts} <Text style={styles.modalSummaryUnit}>Seans</Text>
                      </Text>
                      <Text style={styles.modalSummarySub}>Toplam Antrenman</Text>
                    </View>
                  </>
                )}
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
    gap: 12,
  },
  bentoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.soft,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  headerLeft: {
    flex: 1,
    gap: 2,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  cardSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  badgePill: {
    backgroundColor: COLORS.surfaceElevated,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
  },
  badgePillText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  expandBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  chartSection: {
    gap: 10,
  },
  scrollChartContent: {
    paddingVertical: 2,
  },
  tooltipCard: {
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  tooltipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  tooltipLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  tooltipDateText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textPrimary,
    flexShrink: 1,
  },
  peakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(52, 211, 153, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    flexShrink: 0,
  },
  peakBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.success,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tooltipBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tooltipStat: {
    alignItems: 'center',
    gap: 2,
  },
  tooltipLabel: {
    fontSize: 9,
    color: COLORS.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  tooltipValText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
    fontVariant: ['tabular-nums'],
  },
  tooltipSubText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  tooltipDivider: {
    width: 1,
    height: 22,
    backgroundColor: COLORS.border,
  },
  noDataText: {
    color: COLORS.textMuted,
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 16,
  },
  cardInnerDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 12,
  },
  muscleSubHeader: {
    marginBottom: 10,
    gap: 2,
  },
  muscleSubTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  muscleSubSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  muscleList: {
    gap: 10,
  },
  muscleRow: {
    gap: 4,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
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
    gap: 6,
    flex: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  muscleName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  muscleMetaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  muscleSetsText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  musclePercentText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  muscleVolText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    height: 5,
    backgroundColor: '#1B2531',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
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
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  modalSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  modalCloseBtn: {
    padding: 2,
  },
  modalScrollContent: {
    padding: 14,
    gap: 12,
    paddingBottom: 32,
  },
  metricSwitcherContainer: {
    gap: 4,
  },
  metricSwitcherLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
  },
  metricSwitcherBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  metricBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 6,
  },
  metricBtnSelected: {
    backgroundColor: COLORS.primary,
  },
  metricBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  metricBtnTextSelected: {
    color: COLORS.textInverted,
    fontWeight: '800',
  },
  resSwitcherContainer: {
    gap: 4,
  },
  resSwitcherLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
  },
  resSwitcherBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  resBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 6,
  },
  resBtnSelected: {
    backgroundColor: COLORS.primary,
  },
  resBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  resBtnTextSelected: {
    color: COLORS.textInverted,
    fontWeight: '800',
  },
  modalChartCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
    ...SHADOWS.soft,
  },
  modalChartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalChartTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  modalPeakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  modalPeakBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textInverted,
  },
  modalDetailCard: {
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  modalDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  modalDetailTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  modalDetailDate: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
    flexShrink: 1,
  },
  peakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    flexShrink: 0,
  },
  peakPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textInverted,
  },
  modalMetricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modalMetricBox: {
    flex: 1,
    minWidth: '46%',
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 2,
  },
  modalMetricLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  modalMetricVal: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  modalSummarySection: {
    gap: 8,
    marginTop: 2,
  },
  modalSectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
  },
  modalSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modalSummarySquare: {
    flex: 1,
    minWidth: '46%',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
    ...SHADOWS.soft,
  },
  modalSummaryVal: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  modalSummaryUnit: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  modalSummarySub: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});
