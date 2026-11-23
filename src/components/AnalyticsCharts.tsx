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
import { COLORS, useTheme, subscribeTheme } from '../theme';
import { WorkoutSession } from '../types/fitness';
import { getMondayOfWeek } from '../services/storage';
import { parseLocalDateString } from '../utils/exerciseHelpers';

interface VolumeBucket {
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

const formatISODate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatBarVolume = (vol: number): string => {
  if (vol >= 1000000) return `${(vol / 1000000).toFixed(1)}M`;
  if (vol >= 1000) return `${(vol / 1000).toFixed(1)}t`;
  return `${vol}`;
};

const countWorkingSets = (sessions: WorkoutSession[]): number => {
  let sets = 0;
  sessions.forEach(w => {
    w.exercises?.forEach(ex => {
      if (ex.category === 'Kardiyo') return;
      sets += ex.sets?.filter(s => s.completed && !s.isWarmup).length || 0;
    });
  });
  return sets;
};

const getCalendarWeekBuckets = (workouts: WorkoutSession[]): VolumeBucket[] => {
  const buckets: VolumeBucket[] = [];
  const now = new Date();
  const monday = getMondayOfWeek(now);

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const dateStr = formatISODate(d);

    const dayWorkouts = workouts.filter(w => w.date === dateStr && w.completed !== false);
    const vol = dayWorkouts.reduce((sum, w) => sum + (w.totalVolume || 0), 0);
    const sets = countWorkingSets(dayWorkouts);

    const dayName = DAY_SHORT_TR[d.getDay()];
    const monthFull = MONTH_FULL_TR[d.getMonth()];

    buckets.push({
      id: dateStr,
      label: dayName,
      fullLabel: `${d.getDate()} ${monthFull}, ${dayName}`,
      volume: vol,
      sets,
      workoutCount: dayWorkouts.length,
      startDate: dateStr,
      endDate: dateStr,
    });
  }

  return buckets;
};

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

    const rangeWorkouts = workouts.filter(
      w => w.date >= startStr && w.date <= endStr && w.completed !== false
    );
    const vol = rangeWorkouts.reduce((sum, w) => sum + (w.totalVolume || 0), 0);
    const sets = countWorkingSets(rangeWorkouts);

    buckets.push({
      id: `${startStr}_${endStr}`,
      label: r.label,
      fullLabel: `${r.start}-${r.end} ${MONTH_FULL_TR[month]}`,
      volume: vol,
      sets,
      workoutCount: rangeWorkouts.length,
      startDate: startStr,
      endDate: endStr,
    });
  });

  return buckets;
};

const getDailyBuckets = (workouts: WorkoutSession[], daysCount: number = 7): VolumeBucket[] => {
  const buckets: VolumeBucket[] = [];
  const now = new Date();

  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const dateStr = formatISODate(d);

    const dayWorkouts = workouts.filter(w => w.date === dateStr && w.completed !== false);
    const vol = dayWorkouts.reduce((sum, w) => sum + (w.totalVolume || 0), 0);
    const sets = countWorkingSets(dayWorkouts);

    const dayName = DAY_SHORT_TR[d.getDay()];
    const monthShort = MONTH_SHORT_TR[d.getMonth()];
    const monthFull = MONTH_FULL_TR[d.getMonth()];

    buckets.push({
      id: dateStr,
      label: daysCount <= 7 ? dayName : `${d.getDate()} ${monthShort}`,
      fullLabel: `${d.getDate()} ${monthFull}, ${dayName}`,
      volume: vol,
      sets,
      workoutCount: dayWorkouts.length,
      startDate: dateStr,
      endDate: dateStr,
    });
  }

  return buckets;
};

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

    const rangeWorkouts = workouts.filter(
      w => w.date >= startStr && w.date <= endStr && w.completed !== false
    );
    const vol = rangeWorkouts.reduce((sum, w) => sum + (w.totalVolume || 0), 0);
    const sets = countWorkingSets(rangeWorkouts);

    const label =
      startD.getMonth() === endD.getMonth()
        ? `${startD.getDate()}-${endD.getDate()} ${MONTH_SHORT_TR[startD.getMonth()]}`
        : `${startD.getDate()} ${MONTH_SHORT_TR[startD.getMonth()]}-${endD.getDate()} ${MONTH_SHORT_TR[endD.getMonth()]}`;

    const fullLabel = `${startD.getDate()} ${MONTH_FULL_TR[startD.getMonth()]} - ${endD.getDate()} ${MONTH_FULL_TR[endD.getMonth()]}`;

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

    const monthWorkouts = workouts.filter(
      w => w.date >= startStr && w.date <= endStr && w.completed !== false
    );
    const vol = monthWorkouts.reduce((sum, w) => sum + (w.totalVolume || 0), 0);
    const sets = countWorkingSets(monthWorkouts);

    const monthName = MONTH_FULL_TR[month];
    const monthShort = MONTH_SHORT_TR[month];

    buckets.push({
      id: `${year}_${month}`,
      label: monthsCount > 6 ? `${monthShort} '${String(year).slice(-2)}` : monthShort,
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

const getSmartAggregatedVolumeData = (
  workouts: WorkoutSession[],
  filterMode: 'weekly' | 'monthly' | 'all'
): VolumeBucket[] => {
  let buckets: VolumeBucket[] = [];

  if (filterMode === 'weekly') {
    buckets = getCalendarWeekBuckets(workouts);
  } else if (filterMode === 'monthly') {
    buckets = getCurrentMonthWeeklyBuckets(workouts);
  } else {
    if (!workouts.length) {
      buckets = getWeeklyBuckets(workouts, 8);
    } else {
      const dates = workouts.map(w => w.date).sort();
      const minD = parseLocalDateString(dates[0]);
      const now = new Date();
      // Measure span back from today so older historical workouts are always included in the window
      const spanFromNow = Math.max(
        1,
        Math.ceil((now.getTime() - minD.getTime()) / (1000 * 3600 * 24))
      );

      if (spanFromNow <= 45) {
        const weeks = Math.max(4, Math.ceil(spanFromNow / 7));
        buckets = getWeeklyBuckets(workouts, weeks);
      } else if (spanFromNow <= 120) {
        const weeks = Math.min(16, Math.max(8, Math.ceil(spanFromNow / 7)));
        buckets = getWeeklyBuckets(workouts, weeks);
      } else {
        const months = Math.min(12, Math.max(6, Math.ceil(spanFromNow / 30)));
        buckets = getMonthlyBuckets(workouts, months);
      }
    }
  }

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
  height = 148,
  valueKey = 'sets',
  selectedIndex,
  onSelectIndex,
  minBarWidth = 26,
  barGap = 8,
}) => {
  useTheme();
  const scrollViewRef = React.useRef<ScrollView>(null);

  if (!data.length) return null;

  const isSets = valueKey === 'sets';
  const PADDING_HORIZ = 12;
  const maxLabelLength = Math.max(...data.map(d => d.label.length), 3);
  const minStepForLabel = maxLabelLength * 6.2 + 6;
  const dynamicMinStepWidth = Math.max(minBarWidth + barGap, minStepForLabel);

  const contentWidth = data.length * dynamicMinStepWidth + PADDING_HORIZ * 2;
  const chartWidth = Math.max(containerWidth - 28, contentWidth);
  const stepWidth = chartWidth / data.length;
  const barWidth = Math.max(minBarWidth, Math.min(44, stepWidth * 0.64));

  const maxValue = isSets
    ? Math.max(...data.map(d => d.sets), 10)
    : Math.max(...data.map(d => d.volume), 1000);

  const baselineY = height - 26;
  const maxBarHeight = height - 48;

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
        <Line x1="0" y1="18" x2={chartWidth} y2="18" stroke={COLORS.border} strokeDasharray="3 4" />
        <Line
          x1="0"
          y1={18 + maxBarHeight / 2}
          x2={chartWidth}
          y2={18 + maxBarHeight / 2}
          stroke={COLORS.border}
          strokeDasharray="3 4"
        />
        <Line x1="0" y1={baselineY} x2={chartWidth} y2={baselineY} stroke={COLORS.border} />

        {data.map((item, index) => {
          const val = isSets ? item.sets : item.volume;
          const x = index * stepWidth + (stepWidth - barWidth) / 2;
          const barHeight = val > 0 ? Math.max(6, (val / maxValue) * maxBarHeight) : 4;
          const y = baselineY - barHeight;
          const isSelected = selectedIndex === index;
          const isPeak = isSets ? item.isPeakSet && val > 0 : item.isPeak && val > 0;

          let fillColor = COLORS.surfaceSubtle;
          if (isSelected) {
            fillColor = COLORS.primary;
          } else if (isPeak) {
            fillColor = COLORS.pastel.green;
          } else if (val > 0) {
            fillColor = COLORS.borderDark;
          }

          const valText =
            val > 0 ? (isSets ? `${val}` : formatBarVolume(val)) : '';

          return (
            <G key={item.id}>
              <Rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={4}
                fill={fillColor}
              />

              {valText !== '' && (
                <SvgText
                  x={x + barWidth / 2}
                  y={Math.max(12, y - 6)}
                  fill={isSelected ? COLORS.textPrimary : COLORS.textMuted}
                  fontSize="10"
                  fontWeight={isSelected ? '800' : '600'}
                  textAnchor="middle"
                >
                  {valText}
                </SvgText>
              )}

              <SvgText
                x={x + barWidth / 2}
                y={height - 8}
                fill={isSelected ? COLORS.textPrimary : COLORS.textMuted}
                fontSize="10"
                fontWeight={isSelected ? '700' : '500'}
                textAnchor="middle"
              >
                {item.label}
              </SvgText>

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

const RenderSvgBarChart = React.memo(RenderSvgBarChartBase);

export const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({
  workouts,
  allWorkouts,
  filterMode,
}) => {
  useTheme();
  const [containerWidth, setContainerWidth] = useState(320);
  const [activeMetric, setActiveMetric] = useState<'sets' | 'volume'>('sets');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

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

  const volumeData = useMemo(() => {
    return getSmartAggregatedVolumeData(workouts, filterMode);
  }, [workouts, filterMode]);

  const resolvedIndex = useMemo(() => {
    if (selectedIndex !== null && selectedIndex < volumeData.length) {
      return selectedIndex;
    }
    const peakIdx =
      activeMetric === 'sets'
        ? volumeData.findIndex(b => b.isPeakSet && b.sets > 0)
        : volumeData.findIndex(b => b.isPeak && b.volume > 0);
    if (peakIdx >= 0) return peakIdx;
    return Math.max(0, volumeData.length - 1);
  }, [selectedIndex, volumeData, activeMetric]);

  const selectedBucket = volumeData[resolvedIndex] || null;

  // Expanded Modal Data — skip computation while modal is closed
  const modalTargetWorkouts = allWorkouts && allWorkouts.length ? allWorkouts : workouts;

  const modalVolumeData = useMemo(() => {
    if (!isModalOpen) return [];
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
  }, [isModalOpen, modalTargetWorkouts, modalResolution]);

  const modalActiveIndex = useMemo(() => {
    if (modalSelectedIndex !== null && modalSelectedIndex < modalVolumeData.length) {
      return modalSelectedIndex;
    }
    const peakIdx =
      modalMetric === 'sets'
        ? modalVolumeData.findIndex(b => b.isPeakSet && b.sets > 0)
        : modalVolumeData.findIndex(b => b.isPeak && b.volume > 0);
    if (peakIdx >= 0) return peakIdx;
    return Math.max(0, modalVolumeData.length - 1);
  }, [modalSelectedIndex, modalVolumeData, modalMetric]);

  const modalSelectedBucket = modalVolumeData[modalActiveIndex] || null;

  const totalModalVol = useMemo(
    () => modalVolumeData.reduce((acc, b) => acc + b.volume, 0),
    [modalVolumeData]
  );
  const totalModalSets = useMemo(
    () => modalVolumeData.reduce((acc, b) => acc + b.sets, 0),
    [modalVolumeData]
  );
  const totalPeriodWorkouts = useMemo(
    () => modalVolumeData.reduce((acc, b) => acc + b.workoutCount, 0),
    [modalVolumeData]
  );
  const modalMaxVol = useMemo(
    () => Math.max(...modalVolumeData.map(b => b.volume), 0),
    [modalVolumeData]
  );
  const modalMaxSets = useMemo(
    () => Math.max(...modalVolumeData.map(b => b.sets), 0),
    [modalVolumeData]
  );

  const chartHeading =
    filterMode === 'weekly'
      ? 'Haftalık Trend'
      : filterMode === 'monthly'
      ? 'Aylık Trend'
      : 'Genel Trend';

  return (
    <View style={styles.container}>
      {/* Single Unified Trend Card */}
      <View style={styles.trendCard} onLayout={handleLayout}>
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <Text style={styles.cardTitle}>{chartHeading}</Text>
            <Text style={styles.cardSubtitle}>Detay için çubuklara dokun</Text>
          </View>

          <View style={styles.headerControls}>
            <View style={styles.inlinePills}>
              <TouchableOpacity
                style={[styles.inlinePillBtn, activeMetric === 'sets' && styles.inlinePillBtnOn]}
                onPress={() => {
                  setActiveMetric('sets');
                  setSelectedIndex(null);
                }}
              >
                <Text
                  style={[
                    styles.inlinePillText,
                    activeMetric === 'sets' && styles.inlinePillTextOn,
                  ]}
                >
                  Set
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.inlinePillBtn, activeMetric === 'volume' && styles.inlinePillBtnOn]}
                onPress={() => {
                  setActiveMetric('volume');
                  setSelectedIndex(null);
                }}
              >
                <Text
                  style={[
                    styles.inlinePillText,
                    activeMetric === 'volume' && styles.inlinePillTextOn,
                  ]}
                >
                  Hacim
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.expandIconBtn}
              onPress={() => {
                setModalMetric(activeMetric);
                setModalSelectedIndex(null);
                setIsModalOpen(true);
              }}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessibilityLabel="Grafiği büyüt"
            >
              <Ionicons name="expand-outline" size={14} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {volumeData.length > 0 ? (
          <>
            <RenderSvgBarChart
              data={volumeData}
              containerWidth={containerWidth}
              height={146}
              valueKey={activeMetric}
              selectedIndex={resolvedIndex}
              onSelectIndex={setSelectedIndex}
              minBarWidth={26}
              barGap={8}
            />

            {selectedBucket && (
              <View style={styles.summaryStrip}>
                <View style={styles.summaryLeft}>
                  <Text style={styles.summaryDate} numberOfLines={1}>
                    {selectedBucket.fullLabel}
                  </Text>
                  <Text style={styles.summarySessions}>
                    {selectedBucket.workoutCount > 0
                      ? `${selectedBucket.workoutCount} seans`
                      : 'Dinlenme'}
                  </Text>
                </View>

                <View style={styles.summaryRight}>
                  {(activeMetric === 'sets'
                    ? selectedBucket.isPeakSet
                    : selectedBucket.isPeak) && (
                    <View style={styles.peakChip}>
                      <Text style={styles.peakChipText}>Zirve</Text>
                    </View>
                  )}
                  <Text style={styles.summaryMetric}>
                    {selectedBucket.sets > 0 || selectedBucket.volume > 0
                      ? `${selectedBucket.sets} set · ${selectedBucket.volume.toLocaleString('tr-TR')} kg`
                      : '0 set'}
                  </Text>
                </View>
              </View>
            )}
          </>
        ) : (
          <Text style={styles.noDataText}>Henüz antrenman verisi bulunmuyor.</Text>
        )}
      </View>

      {/* Expand / Deep-Dive Modal */}
      <Modal
        visible={isModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsModalOpen(false)}
      >
        <SafeAreaView style={styles.modalSafeArea} edges={['top', 'bottom', 'left', 'right']}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>Detaylı Trend İncelemesi</Text>
              <Text style={styles.modalSubtitle}>
                {modalMetric === 'sets'
                  ? 'Tamamlanan çalışma seti trendi'
                  : 'Kaldırılan toplam tonaj trendi (kg)'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setIsModalOpen(false)}
            >
              <Ionicons name="close" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Metric & Resolution Controls */}
            <View style={styles.modalControlsRow}>
              <View style={styles.modalSeg}>
                {(['sets', 'volume'] as const).map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.modalSegBtn, modalMetric === m && styles.modalSegBtnOn]}
                    onPress={() => {
                      setModalMetric(m);
                      setModalSelectedIndex(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.modalSegText,
                        modalMetric === m && styles.modalSegTextOn,
                      ]}
                    >
                      {m === 'sets' ? 'Çalışma Seti' : 'Tonaj (kg)'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.modalSeg}>
                {(['daily', 'weekly', 'monthly'] as const).map(res => {
                  const labels = { daily: 'Günlük', weekly: 'Haftalık', monthly: 'Aylık' };
                  return (
                    <TouchableOpacity
                      key={res}
                      style={[
                        styles.modalSegBtn,
                        modalResolution === res && styles.modalSegBtnOn,
                      ]}
                      onPress={() => {
                        setModalResolution(res);
                        setModalSelectedIndex(null);
                      }}
                    >
                      <Text
                        style={[
                          styles.modalSegText,
                          modalResolution === res && styles.modalSegTextOn,
                        ]}
                      >
                        {labels[res]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Large Chart Card */}
            <View style={styles.trendCard}>
              <Text style={styles.cardTitle}>
                {modalResolution === 'daily'
                  ? 'Son 30 Gün'
                  : modalResolution === 'weekly'
                  ? 'Son 12 Hafta'
                  : 'Son 12 Ay'}
              </Text>
              <RenderSvgBarChart
                data={modalVolumeData}
                containerWidth={containerWidth + 24}
                height={210}
                valueKey={modalMetric}
                selectedIndex={modalActiveIndex}
                onSelectIndex={setModalSelectedIndex}
                minBarWidth={30}
                barGap={8}
              />
            </View>

            {/* Selected Period Detail */}
            {modalSelectedBucket && (
              <View style={styles.trendCard}>
                <View style={styles.summaryLeft}>
                  <Text style={styles.kicker}>SEÇİLİ PERİYOT</Text>
                  <Text style={styles.cardTitle}>{modalSelectedBucket.fullLabel}</Text>
                </View>

                <View style={styles.modalMetricGrid}>
                  <View style={styles.modalMetricBox}>
                    <Text style={styles.modalMetricLabel}>Çalışma Seti</Text>
                    <Text style={styles.modalMetricVal}>{modalSelectedBucket.sets} set</Text>
                  </View>
                  <View style={styles.modalMetricBox}>
                    <Text style={styles.modalMetricLabel}>Toplam Hacim</Text>
                    <Text style={styles.modalMetricVal}>
                      {modalSelectedBucket.volume.toLocaleString('tr-TR')} kg
                    </Text>
                  </View>
                  <View style={styles.modalMetricBox}>
                    <Text style={styles.modalMetricLabel}>Seans</Text>
                    <Text style={styles.modalMetricVal}>
                      {modalSelectedBucket.workoutCount} antrenman
                    </Text>
                  </View>
                  <View style={styles.modalMetricBox}>
                    <Text style={styles.modalMetricLabel}>Zirve Oranı</Text>
                    <Text style={styles.modalMetricVal}>
                      %
                      {modalMetric === 'sets'
                        ? modalMaxSets > 0
                          ? Math.round((modalSelectedBucket.sets / modalMaxSets) * 100)
                          : 0
                        : modalMaxVol > 0
                        ? Math.round((modalSelectedBucket.volume / modalMaxVol) * 100)
                        : 0}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Period Aggregate */}
            <View style={styles.trendCard}>
              <Text style={styles.kicker}>DÖNEM TOPLAMI</Text>
              <View style={styles.modalMetricGrid}>
                <View style={styles.modalMetricBox}>
                  <Text style={styles.modalMetricLabel}>Toplam Set</Text>
                  <Text style={styles.modalMetricVal}>{totalModalSets} set</Text>
                </View>
                <View style={styles.modalMetricBox}>
                  <Text style={styles.modalMetricLabel}>Toplam Tonaj</Text>
                  <Text style={styles.modalMetricVal}>
                    {totalModalVol >= 1000
                      ? `${(totalModalVol / 1000).toFixed(1)} t`
                      : `${totalModalVol} kg`}
                  </Text>
                </View>
                <View style={styles.modalMetricBox}>
                  <Text style={styles.modalMetricLabel}>Antrenman</Text>
                  <Text style={styles.modalMetricVal}>{totalPeriodWorkouts}</Text>
                </View>
                <View style={styles.modalMetricBox}>
                  <Text style={styles.modalMetricLabel}>Seans Ort.</Text>
                  <Text style={styles.modalMetricVal}>
                    {totalPeriodWorkouts > 0
                      ? `${(totalModalSets / totalPeriodWorkouts).toFixed(1)} set`
                      : '0 set'}
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const createStyles = () =>
  StyleSheet.create({
    container: {
      gap: 12,
    },
    trendCard: {
      backgroundColor: COLORS.surface,
      borderRadius: 10,
      padding: 14,
      borderWidth: 1,
      borderColor: COLORS.border,
      gap: 10,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    headerLeft: {
      flex: 1,
      minWidth: 0,
    },
    cardTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: COLORS.textPrimary,
      letterSpacing: -0.2,
    },
    cardSubtitle: {
      fontSize: 11,
      color: COLORS.textMuted,
      marginTop: 1,
    },
    headerControls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexShrink: 0,
    },
    inlinePills: {
      flexDirection: 'row',
      backgroundColor: COLORS.surfaceSubtle,
      borderRadius: 6,
      padding: 2,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    inlinePillBtn: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 4,
    },
    inlinePillBtnOn: {
      backgroundColor: COLORS.primary,
    },
    inlinePillText: {
      fontSize: 11,
      fontWeight: '600',
      color: COLORS.textSecondary,
    },
    inlinePillTextOn: {
      color: COLORS.primaryText,
      fontWeight: '700',
    },
    expandIconBtn: {
      width: 28,
      height: 28,
      borderRadius: 6,
      backgroundColor: COLORS.surfaceSubtle,
      borderWidth: 1,
      borderColor: COLORS.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrollChartContent: {
      paddingVertical: 2,
    },
    summaryStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
      gap: 8,
    },
    summaryLeft: {
      flex: 1,
      minWidth: 0,
      gap: 1,
    },
    summaryDate: {
      fontSize: 12,
      fontWeight: '600',
      color: COLORS.textPrimary,
    },
    summarySessions: {
      fontSize: 11,
      color: COLORS.textMuted,
    },
    summaryRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexShrink: 0,
    },
    peakChip: {
      backgroundColor: COLORS.pastel.greenBg,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 4,
    },
    peakChipText: {
      fontSize: 10,
      fontWeight: '700',
      color: COLORS.pastel.green,
    },
    summaryMetric: {
      fontSize: 12,
      fontWeight: '700',
      color: COLORS.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    noDataText: {
      fontSize: 12,
      color: COLORS.textMuted,
      textAlign: 'center',
      paddingVertical: 16,
    },
    kicker: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.7,
      color: COLORS.textMuted,
    },
    modalSafeArea: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: COLORS.surface,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
      gap: 12,
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: COLORS.textPrimary,
    },
    modalSubtitle: {
      fontSize: 11,
      color: COLORS.textMuted,
      marginTop: 2,
    },
    modalCloseBtn: {
      width: 32,
      height: 32,
      borderRadius: 6,
      backgroundColor: COLORS.surfaceSubtle,
      borderWidth: 1,
      borderColor: COLORS.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalScrollContent: {
      padding: 16,
      gap: 12,
      paddingBottom: 40,
    },
    modalControlsRow: {
      gap: 8,
    },
    modalSeg: {
      flexDirection: 'row',
      backgroundColor: COLORS.surfaceSubtle,
      borderRadius: 7,
      padding: 3,
      borderWidth: 1,
      borderColor: COLORS.border,
      gap: 3,
    },
    modalSegBtn: {
      flex: 1,
      paddingVertical: 7,
      borderRadius: 5,
      alignItems: 'center',
    },
    modalSegBtnOn: {
      backgroundColor: COLORS.primary,
    },
    modalSegText: {
      fontSize: 12,
      fontWeight: '600',
      color: COLORS.textSecondary,
    },
    modalSegTextOn: {
      color: COLORS.primaryText,
      fontWeight: '700',
    },
    modalMetricGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    modalMetricBox: {
      width: '48.5%',
      backgroundColor: COLORS.surfaceSubtle,
      borderRadius: 8,
      padding: 11,
      borderWidth: 1,
      borderColor: COLORS.border,
      gap: 3,
    },
    modalMetricLabel: {
      fontSize: 11,
      color: COLORS.textMuted,
      fontWeight: '600',
    },
    modalMetricVal: {
      fontSize: 15,
      fontWeight: '800',
      color: COLORS.textPrimary,
      fontVariant: ['tabular-nums'],
    },
  });

let styles = createStyles();
subscribeTheme(() => {
  styles = createStyles();
});
