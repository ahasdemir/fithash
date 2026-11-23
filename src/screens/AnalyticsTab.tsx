import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, useTheme, subscribeTheme } from '../theme';
import { WorkoutSession, PersonalRecord, MuscleCategory } from '../types/fitness';
import { AnalyticsCharts } from '../components/AnalyticsCharts';
import { OneRepMaxWidget } from '../components/OneRepMaxWidget';
import { ExercisePRDetailModal } from '../components/ExercisePRDetailModal';
import {
  MuscleRecoveryHeatmap,
  RP_WEEKLY_SET_TARGET,
  WeeklyMuscleVolume,
} from '../components/MuscleRecoveryHeatmap';
import { calculateAllMuscleRecovery } from '../services/muscleRecoveryService';
import { calculateUserStats, getMondayOfWeek, getLocalDateString } from '../services/storage';
import { calculateAutoregulatedE1RM } from '../utils/e1rm';
import { FILTER_CATEGORIES, parseLocalDateString } from '../utils/exerciseHelpers';

interface AnalyticsTabProps {
  workouts: WorkoutSession[];
  prs: Record<string, PersonalRecord>;
  workoutDays?: number[];
  weeklyTargetHistory?: Record<string, number>;
}

interface ExercisePRListItem {
  id: string;
  name: string;
  category: MuscleCategory;
  equipment: string;
  pr?: PersonalRecord;
  lastWorkoutDate?: string;
  isRecent: boolean;
  allTimeWeight?: number;
  allTimeReps?: number;
  allTime1RM?: number;
}

interface PRCardRowProps {
  item: ExercisePRListItem;
  isLast: boolean;
  onSelect: (item: ExercisePRListItem) => void;
}

const PRCardRow = React.memo(function PRCardRow({ item, isLast, onSelect }: PRCardRowProps) {
  useTheme();
  const catColor = (COLORS.category as Record<string, string>)[item.category] || COLORS.textSecondary;
  return (
    <TouchableOpacity
      style={[styles.prRow, isLast && styles.prRowLast]}
      activeOpacity={0.75}
      onPress={() => onSelect(item)}
    >
      <View style={styles.prLeft}>
        <Text style={styles.prExName} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.prMetaRow}>
          <View style={[styles.prCatBadge, { backgroundColor: catColor + '20' }]}>
            <Text style={[styles.prCatBadgeText, { color: catColor }]}>{item.category}</Text>
          </View>
          {item.isRecent ? (
            <View style={[styles.recentBadge, { backgroundColor: COLORS.pastel.greenBg }]}>
              <Text style={[styles.recentBadgeText, { color: COLORS.pastel.green }]}>
                Bu Hafta
              </Text>
            </View>
          ) : item.lastWorkoutDate ? (
            <Text style={styles.prDateText}>{item.lastWorkoutDate}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.prRightRow}>
        {item.allTimeWeight ? (
          <View style={styles.prRightValCol}>
            <Text style={styles.prWeightText}>{item.allTimeWeight} kg</Text>
            <Text style={styles.prRepsText}>
              {item.allTimeReps || 1} rep · e1RM {item.allTime1RM || Math.round(item.allTimeWeight * 1.05)}
            </Text>
          </View>
        ) : item.pr?.maxSpeedKmh ? (
          <View style={styles.prRightValCol}>
            <Text style={styles.prWeightText}>{item.pr.maxSpeedKmh} km/h</Text>
            <Text style={styles.prRepsText}>
              {item.pr.maxDistanceKm ? `${item.pr.maxDistanceKm} km` : 'Kardiyo'}
            </Text>
          </View>
        ) : (
          <Text style={styles.prInspectText}>İncele</Text>
        )}
        <Ionicons name="chevron-forward" size={14} color={COLORS.textMuted} />
      </View>
    </TouchableOpacity>
  );
});

const formatVolumeHeadline = (kg: number) => {
  if (kg >= 1000) {
    return { val: (kg / 1000).toFixed(1), unit: 't' };
  }
  return { val: `${kg}`, unit: 'kg' };
};

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({
  workouts,
  prs,
  workoutDays,
  weeklyTargetHistory,
}) => {
  useTheme();
  const insets = useSafeAreaInsets();
  type AnalyticsSubTab = 'overview' | 'fatigue' | 'prs';
  const [activeTab, setActiveTab] = useState<AnalyticsSubTab>('overview');
  const [filterMode, setFilterMode] = useState<'weekly' | 'monthly' | 'all'>('weekly');
  const [selectedExerciseForPR, setSelectedExerciseForPR] = useState<{
    id?: string;
    name: string;
    category?: string;
    equipment?: string;
  } | null>(null);
  const [prSearchQuery, setPrSearchQuery] = useState('');
  const [selectedPRCategory, setSelectedPRCategory] = useState<MuscleCategory | 'Hepsi'>('Hepsi');
  const [showAllPRs, setShowAllPRs] = useState(false);

  // Current week bounds (also used for unified weekly muscle volume on Kaslar tab)
  const dateBounds = useMemo(() => {
    const now = new Date();
    const currentMonday = getMondayOfWeek(now);
    const currentMondayStr = getLocalDateString(currentMonday);
    const currentSunday = new Date(currentMonday);
    currentSunday.setDate(currentSunday.getDate() + 6);
    const currentSundayStr = getLocalDateString(currentSunday);

    const prevMonday = new Date(currentMonday);
    prevMonday.setDate(prevMonday.getDate() - 7);
    const prevMondayStr = getLocalDateString(prevMonday);
    const prevSunday = new Date(currentMonday);
    prevSunday.setDate(prevSunday.getDate() - 1);
    const prevSundayStr = getLocalDateString(prevSunday);

    const year = now.getFullYear();
    const month = now.getMonth();
    const currentMonthStartStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    const currentMonthEndStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

    return {
      currentMondayStr,
      currentSundayStr,
      prevMondayStr,
      prevSundayStr,
      currentMonthStartStr,
      currentMonthEndStr,
    };
  }, []);

  const filteredWorkouts = useMemo(() => {
    return workouts.filter(w => {
      if (w.completed === false) return false;
      if (filterMode === 'weekly') {
        return w.date >= dateBounds.currentMondayStr && w.date <= dateBounds.currentSundayStr;
      }
      if (filterMode === 'monthly') {
        return w.date >= dateBounds.currentMonthStartStr && w.date <= dateBounds.currentMonthEndStr;
      }
      return true;
    });
  }, [workouts, filterMode, dateBounds]);

  // Previous week stats for clean weekly delta comparison
  const prevWeekStats = useMemo(() => {
    const prevWorkouts = workouts.filter(
      w =>
        w.completed !== false &&
        w.date >= dateBounds.prevMondayStr &&
        w.date <= dateBounds.prevSundayStr
    );
    return calculateUserStats(prevWorkouts, workoutDays, weeklyTargetHistory);
  }, [workouts, dateBounds, workoutDays, weeklyTargetHistory]);

  const stats = useMemo(
    () => calculateUserStats(filteredWorkouts, workoutDays, weeklyTargetHistory),
    [filteredWorkouts, workoutDays, weeklyTargetHistory]
  );

  // Detect whether any completed non-warmup strength set in the period recorded an RIR value
  const hasRirData = useMemo(() => {
    return filteredWorkouts.some(w =>
      w.exercises?.some(
        ex =>
          ex.category !== 'Kardiyo' &&
          ex.sets?.some(s => s.completed && !s.isWarmup && s.rir !== undefined)
      )
    );
  }, [filteredWorkouts]);

  // Weekly direct working sets & volume per muscle group (always current calendar week)
  const weeklyMuscleSets = useMemo(() => {
    const map: Record<string, WeeklyMuscleVolume> = {};
    workouts.forEach(w => {
      if (w.completed === false) return;
      if (w.date < dateBounds.currentMondayStr || w.date > dateBounds.currentSundayStr) return;

      w.exercises?.forEach(ex => {
        const isCardio = ex.category === 'Kardiyo';
        const completedCount = isCardio
          ? ex.sets?.some(s => s.completed)
            ? 1
            : 0
          : ex.sets?.filter(s => s.completed && !s.isWarmup).length || 0;

        const vol =
          ex.sets?.reduce((acc, s) => (s.completed ? acc + s.weight * s.reps : acc), 0) || 0;

        if (completedCount > 0 || vol > 0) {
          if (!map[ex.category]) {
            map[ex.category] = { sets: 0, volume: 0 };
          }
          map[ex.category].sets += completedCount;
          map[ex.category].volume += vol;
        }
      });
    });
    return map;
  }, [workouts, dateBounds]);

  const muscleRecoveryMap = useMemo(() => {
    return calculateAllMuscleRecovery(workouts);
  }, [workouts]);

  // Top 2 recommended muscles for the Overview teaser card
  const focusTeaserMuscles = useMemo(() => {
    const cats = Object.keys(muscleRecoveryMap) as MuscleCategory[];
    return cats
      .filter(cat => cat !== 'Kardiyo' && muscleRecoveryMap[cat]?.status === 'RECOVERED')
      .map(cat => {
        const done = weeklyMuscleSets[cat]?.sets || 0;
        const target = RP_WEEKLY_SET_TARGET[cat] ?? 12;
        return {
          cat,
          recoveryPct: muscleRecoveryMap[cat].recoveryPercentage,
          gap: Math.max(0, target - done),
          done,
          target,
        };
      })
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 2);
  }, [muscleRecoveryMap, weeklyMuscleSets]);

  const handleSelectOneRMExercise = useCallback((exerciseName: string) => {
    setSelectedExerciseForPR({ name: exerciseName });
  }, []);

  const handleSelectPRItem = useCallback((item: ExercisePRListItem) => {
    setSelectedExerciseForPR(item);
  }, []);

  const handleClosePRDetail = useCallback(() => {
    setSelectedExerciseForPR(null);
  }, []);

  // Base All-Time Exercise PR aggregation (split from search/category filter)
  const baseExercisePRItems = useMemo(() => {
    const exerciseMap: Record<string, ExercisePRListItem> = {};

    Object.values(prs).forEach(pr => {
      const key = pr.exerciseName.toLowerCase().trim();
      exerciseMap[key] = {
        id: pr.exerciseId,
        name: pr.exerciseName,
        category: 'Göğüs',
        equipment: 'Barbell',
        pr,
        isRecent: false,
        allTimeWeight: pr.maxWeight > 0 ? pr.maxWeight : undefined,
        allTimeReps: pr.maxReps > 0 ? pr.maxReps : undefined,
        allTime1RM: (pr.maxEstimatedOneRepMax || 0) > 0 ? pr.maxEstimatedOneRepMax : undefined,
      };
    });

    const now = Date.now();
    workouts.forEach(w => {
      if (w.completed === false) return;
      const wDateMs = parseLocalDateString(w.date).getTime();
      const isThisWeek = now - wDateMs <= 7 * 24 * 3600 * 1000;

      w.exercises.forEach(ex => {
        const completedSets = ex.sets?.filter(s => s.completed) || [];
        if (completedSets.length === 0) return;

        const key = ex.exerciseName.toLowerCase().trim();
        if (!exerciseMap[key]) {
          let maxW = 0;
          let maxR = 0;
          let max1RM = 0;
          completedSets.forEach(s => {
            if (!s.isWarmup && s.weight > 0 && s.reps > 0) {
              const e1rm = Math.round(calculateAutoregulatedE1RM(s.weight, s.reps, s.rir));
              if (e1rm > max1RM) max1RM = e1rm;
              if (s.weight > maxW || (s.weight === maxW && s.reps > maxR)) {
                maxW = s.weight;
                maxR = s.reps;
              }
            }
          });

          exerciseMap[key] = {
            id: ex.exerciseId,
            name: ex.exerciseName,
            category: ex.category || 'Göğüs',
            equipment: ex.equipment || 'Barbell',
            lastWorkoutDate: w.date,
            isRecent: isThisWeek,
            allTimeWeight: maxW > 0 ? maxW : undefined,
            allTimeReps: maxR > 0 ? maxR : undefined,
            allTime1RM: max1RM > 0 ? max1RM : undefined,
          };
        } else {
          const entry = exerciseMap[key];
          if (ex.category) entry.category = ex.category;
          if (ex.equipment) entry.equipment = ex.equipment;
          if (!entry.lastWorkoutDate || w.date > entry.lastWorkoutDate) {
            entry.lastWorkoutDate = w.date;
          }
          if (isThisWeek) {
            entry.isRecent = true;
          }
          completedSets.forEach(s => {
            if (!s.isWarmup && s.weight > 0 && s.reps > 0) {
              const e1rm = Math.round(calculateAutoregulatedE1RM(s.weight, s.reps, s.rir));
              if (e1rm > (entry.allTime1RM || 0)) {
                entry.allTime1RM = e1rm;
              }
              const curW = entry.allTimeWeight || 0;
              const curR = entry.allTimeReps || 0;
              if (s.weight > curW || (s.weight === curW && s.reps > curR)) {
                entry.allTimeWeight = s.weight;
                entry.allTimeReps = s.reps;
              }
            }
          });
        }
      });
    });

    return Object.values(exerciseMap).sort((a, b) => {
      const aScore = (a.allTimeWeight ? 100 : 0) + (a.isRecent ? 50 : 0);
      const bScore = (b.allTimeWeight ? 100 : 0) + (b.isRecent ? 50 : 0);
      if (bScore !== aScore) return bScore - aScore;
      return a.name.localeCompare(b.name, 'tr');
    });
  }, [prs, workouts]);

  const allExercisePRItems = useMemo(() => {
    const query = prSearchQuery.trim().toLowerCase();
    return baseExercisePRItems.filter(item => {
      const matchesSearch = !query || item.name.toLowerCase().includes(query);
      const matchesCat = selectedPRCategory === 'Hepsi' || item.category === selectedPRCategory;
      return matchesSearch && matchesCat;
    });
  }, [baseExercisePRItems, prSearchQuery, selectedPRCategory]);

  const displayedPRItems = useMemo(() => {
    if (showAllPRs || prSearchQuery.trim().length > 0 || selectedPRCategory !== 'Hepsi') {
      return allExercisePRItems;
    }
    return allExercisePRItems.slice(0, 20);
  }, [allExercisePRItems, showAllPRs, prSearchQuery, selectedPRCategory]);

  const cardioSummary = useMemo(() => {
    const cardioStatsMap: Record<string, { totalDist: number; totalMins: number }> = {};
    filteredWorkouts.forEach(w => {
      w.exercises.forEach(ex => {
        if (ex.category === 'Kardiyo') {
          ex.sets.forEach(s => {
            if (s.completed && s.durationMinutes && s.distanceKm) {
              if (!cardioStatsMap[ex.exerciseName]) {
                cardioStatsMap[ex.exerciseName] = { totalDist: 0, totalMins: 0 };
              }
              cardioStatsMap[ex.exerciseName].totalDist += s.distanceKm;
              cardioStatsMap[ex.exerciseName].totalMins += s.durationMinutes;
            }
          });
        }
      });
    });

    return Object.keys(cardioStatsMap).map(name => {
      const item = cardioStatsMap[name];
      const avgSpeed = (item.totalDist / item.totalMins) * 60;
      return {
        name,
        totalDist: Math.round(item.totalDist * 10) / 10,
        totalMins: item.totalMins,
        avgSpeedKmh: parseFloat(avgSpeed.toFixed(1)),
      };
    });
  }, [filteredWorkouts]);

  const volFormatted = formatVolumeHeadline(stats.totalVolumeKg);
  const weeklySetDelta = stats.totalHardSets - prevWeekStats.totalHardSets;
  const headerSubtitle =
    activeTab === 'overview'
      ? `${
          filterMode === 'weekly'
            ? 'Bu hafta'
            : filterMode === 'monthly'
            ? 'Bu ay'
            : 'Tüm zamanlar'
        } · ${filteredWorkouts.length} antrenman`
      : activeTab === 'fatigue'
      ? 'Anlık toparlanma & haftalık RP set hedefi'
      : `Tüm zamanlar · ${allExercisePRItems.length} hareket`;

  const rirZoneText = !hasRirData
    ? 'Veri bekleniyor'
    : stats.avgRir === 0
    ? 'Tükeniş (0 RIR)'
    : stats.avgRir <= 2
    ? 'Hipertrofi bölgesi'
    : 'Kontrollü yüklenme';

  const hasSecondaryActivity =
    stats.totalCaloriesBurned > 0 || stats.totalCardioDistanceKm > 0;

  return (
    <View style={styles.container}>
      {/* Compact Header + Single Segmented Bar */}
      <View style={styles.topHeader}>
        <View style={styles.headerRow}>
          <View style={styles.headerTitleCol}>
            <Text style={styles.pageTitle}>Analiz</Text>
            <Text style={styles.pageSub} numberOfLines={1}>
              {headerSubtitle}
            </Text>
          </View>

          {activeTab === 'overview' && (
            <View style={styles.periodPills}>
              {(
                [
                  { id: 'weekly', label: '7G' },
                  { id: 'monthly', label: '30G' },
                  { id: 'all', label: 'Tümü' },
                ] as const
              ).map(p => {
                const isSelected = filterMode === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.periodPillBtn, isSelected && styles.periodPillBtnOn]}
                    onPress={() => setFilterMode(p.id)}
                  >
                    <Text style={[styles.periodPillText, isSelected && styles.periodPillTextOn]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.subTabContainer}>
          {(
            [
              { id: 'overview', label: 'Genel Bakış' },
              { id: 'fatigue', label: 'Kaslar' },
              { id: 'prs', label: 'Güç & PR' },
            ] as const
          ).map(tab => {
            const isSelected = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.subTabBtn, isSelected && styles.subTabBtnSelected]}
                onPress={() => setActiveTab(tab.id)}
                activeOpacity={0.8}
              >
                <Text
                  style={[styles.subTabBtnText, isSelected && styles.subTabBtnTextSelected]}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 120 + Math.max(insets.bottom, 16) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* TAB 1: GENEL BAKIŞ */}
        {activeTab === 'overview' && (
          <>
            {/* Crisp 2x2 KPI Grid */}
            <View style={styles.kpiGrid}>
              <View style={styles.kpiCard}>
                <Text style={styles.kicker}>ÇALIŞMA SETİ</Text>
                <Text style={styles.kpiValue}>
                  {stats.totalHardSets} <Text style={styles.kpiUnit}>set</Text>
                </Text>
                <Text
                  style={[
                    styles.kpiDelta,
                    filterMode === 'weekly' && prevWeekStats.totalHardSets > 0
                      ? {
                          color:
                            weeklySetDelta >= 0 ? COLORS.pastel.green : COLORS.pastel.amber,
                        }
                      : styles.kpiDeltaMuted,
                  ]}
                  numberOfLines={1}
                >
                  {filterMode === 'weekly' && prevWeekStats.totalHardSets > 0
                    ? `${weeklySetDelta >= 0 ? '+' : ''}${weeklySetDelta} geçen haftaya göre`
                    : `${filteredWorkouts.length} tamamlanan seans`}
                </Text>
              </View>

              <View style={styles.kpiCard}>
                <Text style={styles.kicker}>TOPLAM HACİM</Text>
                <Text style={styles.kpiValue}>
                  {volFormatted.val} <Text style={styles.kpiUnit}>{volFormatted.unit}</Text>
                </Text>
                <Text style={[styles.kpiDelta, styles.kpiDeltaMuted]} numberOfLines={1}>
                  {filteredWorkouts.length > 0
                    ? `Ort. ${Math.round(
                        stats.totalVolumeKg / filteredWorkouts.length
                      ).toLocaleString('tr-TR')} kg / seans`
                    : 'Tonaj kaydı yok'}
                </Text>
              </View>

              <View style={styles.kpiCard}>
                <Text style={styles.kicker}>ORT. YOĞUNLUK</Text>
                <Text style={styles.kpiValue}>
                  {hasRirData ? (
                    <>
                      {stats.avgRir} <Text style={styles.kpiUnit}>RIR</Text>
                    </>
                  ) : (
                    '—'
                  )}
                </Text>
                <Text
                  style={[
                    styles.kpiDelta,
                    hasRirData && stats.avgRir <= 2
                      ? { color: COLORS.pastel.lavender }
                      : styles.kpiDeltaMuted,
                  ]}
                  numberOfLines={1}
                >
                  {rirZoneText}
                </Text>
              </View>

              <View style={styles.kpiCard}>
                <Text style={styles.kicker}>UYUM &amp; AKTİF SÜRE</Text>
                <Text style={styles.kpiValue}>
                  {filteredWorkouts.length > 0 ? (
                    <>
                      %{stats.avgWorkoutCompliance}{' '}
                      <Text style={styles.kpiUnit}>· {stats.activeWorkTimeMinutes} dk</Text>
                    </>
                  ) : (
                    '—'
                  )}
                </Text>
                <Text style={[styles.kpiDelta, styles.kpiDeltaMuted]} numberOfLines={1}>
                  {filteredWorkouts.length > 0
                    ? 'Gerilim altında süre (TUT)'
                    : 'Bu dönem seans yok'}
                </Text>
              </View>
            </View>

            {/* Conditional Pastel Activity Strip (only when cardio / kcal exists) */}
            {hasSecondaryActivity && (
              <View style={styles.activityStrip}>
                {stats.totalCaloriesBurned > 0 && (
                  <View style={[styles.activityPill, { backgroundColor: COLORS.pastel.roseBg }]}>
                    <Ionicons name="flame-outline" size={13} color={COLORS.pastel.rose} />
                    <Text style={[styles.activityPillText, { color: COLORS.pastel.rose }]}>
                      {stats.totalCaloriesBurned} kcal
                    </Text>
                  </View>
                )}
                {stats.totalCardioDistanceKm > 0 && (
                  <View style={[styles.activityPill, { backgroundColor: COLORS.pastel.cyanBg }]}>
                    <Ionicons name="walk-outline" size={13} color={COLORS.pastel.cyan} />
                    <Text style={[styles.activityPillText, { color: COLORS.pastel.cyan }]}>
                      {stats.totalCardioDistanceKm} km kardiyo
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Unified Trend Chart (Set | Hacim toggle) */}
            <AnalyticsCharts
              workouts={filteredWorkouts}
              allWorkouts={workouts}
              filterMode={filterMode}
            />

            {/* Today's Focus Teaser linking directly to Kaslar tab */}
            <TouchableOpacity
              style={styles.focusTeaserCard}
              activeOpacity={0.8}
              onPress={() => setActiveTab('fatigue')}
            >
              <View style={styles.focusTeaserLeft}>
                <Text style={styles.kicker}>BUGÜN ÖNERİLEN ODAK</Text>
                <Text style={styles.focusTeaserTitle} numberOfLines={1}>
                  {focusTeaserMuscles.length > 0
                    ? `${focusTeaserMuscles.map(m => m.cat).join(' & ')} (%100 Hazır)`
                    : 'Aktif Dinlenme & Mobilite'}
                </Text>
                <Text style={styles.focusTeaserSub} numberOfLines={1}>
                  {focusTeaserMuscles.length > 0
                    ? focusTeaserMuscles
                        .map(m => `${m.cat}: ${m.done}/${m.target} set`)
                        .join(' · ')
                    : 'Tüm bölgeler toparlanma evresinde'}
                </Text>
              </View>
              <View style={[styles.focusTeaserBtn, { backgroundColor: COLORS.pastel.greenBg }]}>
                <Text style={[styles.focusTeaserBtnText, { color: COLORS.pastel.green }]}>
                  Kaslar
                </Text>
                <Ionicons name="chevron-forward" size={13} color={COLORS.pastel.green} />
              </View>
            </TouchableOpacity>

            {/* Conditional Cardio Speed Card */}
            {cardioSummary.length > 0 && (
              <View style={styles.cardioCard}>
                <View style={styles.cardioHeader}>
                  <Text style={styles.kicker}>KARDİYO &amp; HIZ PERFORMANSI</Text>
                  <View style={[styles.tagPill, { backgroundColor: COLORS.pastel.cyanBg }]}>
                    <Text style={[styles.tagPillText, { color: COLORS.pastel.cyan }]}>
                      {cardioSummary.length} ekipman
                    </Text>
                  </View>
                </View>

                {cardioSummary.map((c, idx) => (
                  <View
                    key={c.name}
                    style={[
                      styles.cardioRow,
                      idx === cardioSummary.length - 1 && styles.cardioRowLast,
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardioExName}>{c.name}</Text>
                      <Text style={styles.cardioMeta}>
                        {c.totalDist} km · {c.totalMins} dk
                      </Text>
                    </View>
                    <View style={[styles.speedBadge, { backgroundColor: COLORS.pastel.cyanBg }]}>
                      <Text style={[styles.speedBadgeText, { color: COLORS.pastel.cyan }]}>
                        {c.avgSpeedKmh} km/h
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* TAB 2: KASLAR (Unified Recovery + RP Weekly Volume) */}
        {activeTab === 'fatigue' && (
          <MuscleRecoveryHeatmap
            recoveryMap={muscleRecoveryMap}
            weeklyMuscleSets={weeklyMuscleSets}
          />
        )}

        {/* TAB 3: GÜÇ & PR (Always all-time so weekly filter never wipes 1RM) */}
        {activeTab === 'prs' && (
          <>
            <OneRepMaxWidget
              workouts={workouts}
              onSelectExercise={handleSelectOneRMExercise}
            />

            <View style={styles.prCardContainer}>
              <View style={styles.prCardHeader}>
                <Text style={styles.kicker}>KİŞİSEL REKORLAR (TÜM ZAMANLAR)</Text>
                <Text style={styles.prCountText}>{allExercisePRItems.length} egzersiz</Text>
              </View>

              <View style={styles.prSearchRow}>
                <Ionicons name="search" size={15} color={COLORS.textMuted} />
                <TextInput
                  style={styles.prSearchInput}
                  placeholder="Egzersiz ara..."
                  placeholderTextColor={COLORS.textMuted}
                  value={prSearchQuery}
                  onChangeText={setPrSearchQuery}
                />
                {prSearchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setPrSearchQuery('')}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.prCategoryChips}
              >
                {FILTER_CATEGORIES.map(cat => {
                  const isSelected = selectedPRCategory === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.prCatChip, isSelected && styles.prCatChipSelected]}
                      onPress={() => setSelectedPRCategory(cat)}
                    >
                      <Text
                        style={[
                          styles.prCatChipText,
                          isSelected && styles.prCatChipTextSelected,
                        ]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {displayedPRItems.length > 0 ? (
                <View style={styles.prList}>
                  {displayedPRItems.map((item, idx, arr) => (
                    <PRCardRow
                      key={item.id || item.name}
                      item={item}
                      isLast={idx === arr.length - 1}
                      onSelect={handleSelectPRItem}
                    />
                  ))}
                  {allExercisePRItems.length > displayedPRItems.length && (
                    <TouchableOpacity
                      style={styles.showMorePrBtn}
                      onPress={() => setShowAllPRs(true)}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.showMorePrText}>
                        Tümünü Göster (+{allExercisePRItems.length - displayedPRItems.length})
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <View style={styles.emptyPrCard}>
                  <Ionicons name="search-outline" size={24} color={COLORS.textMuted} />
                  <Text style={styles.emptyPrText}>Eşleşen egzersiz bulunamadı.</Text>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <ExercisePRDetailModal
        visible={!!selectedExerciseForPR}
        onClose={handleClosePRDetail}
        exercise={selectedExerciseForPR}
        workouts={workouts}
      />
    </View>
  );
};

const createStyles = () =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    topHeader: {
      backgroundColor: COLORS.surface,
      paddingTop: 12,
      paddingHorizontal: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
      gap: 10,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    headerTitleCol: {
      flex: 1,
      minWidth: 0,
    },
    pageTitle: {
      fontSize: 19,
      fontWeight: '800',
      color: COLORS.textPrimary,
      letterSpacing: -0.3,
    },
    pageSub: {
      fontSize: 12,
      color: COLORS.textMuted,
      marginTop: 1,
    },
    periodPills: {
      flexDirection: 'row',
      backgroundColor: COLORS.surfaceSubtle,
      borderRadius: 6,
      padding: 2,
      borderWidth: 1,
      borderColor: COLORS.border,
      flexShrink: 0,
    },
    periodPillBtn: {
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 4,
    },
    periodPillBtnOn: {
      backgroundColor: COLORS.primary,
    },
    periodPillText: {
      fontSize: 11,
      fontWeight: '600',
      color: COLORS.textSecondary,
      fontVariant: ['tabular-nums'],
    },
    periodPillTextOn: {
      color: COLORS.primaryText,
      fontWeight: '700',
    },
    subTabContainer: {
      flexDirection: 'row',
      backgroundColor: COLORS.surfaceSubtle,
      borderRadius: 7,
      padding: 3,
      borderWidth: 1,
      borderColor: COLORS.border,
      gap: 3,
    },
    subTabBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      borderRadius: 5,
    },
    subTabBtnSelected: {
      backgroundColor: COLORS.primary,
    },
    subTabBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: COLORS.textSecondary,
    },
    subTabBtnTextSelected: {
      color: COLORS.primaryText,
      fontWeight: '700',
    },
    scrollArea: {
      flex: 1,
    },
    content: {
      padding: 16,
      gap: 12,
    },
    kpiGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    kpiCard: {
      flex: 1,
      minWidth: '47%',
      backgroundColor: COLORS.surface,
      borderRadius: 9,
      padding: 13,
      borderWidth: 1,
      borderColor: COLORS.border,
      gap: 4,
    },
    kicker: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.7,
      color: COLORS.textMuted,
    },
    kpiValue: {
      fontSize: 20,
      fontWeight: '800',
      color: COLORS.textPrimary,
      letterSpacing: -0.4,
      fontVariant: ['tabular-nums'],
    },
    kpiUnit: {
      fontSize: 12,
      fontWeight: '500',
      color: COLORS.textSecondary,
    },
    kpiDelta: {
      fontSize: 11,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
    },
    kpiDeltaMuted: {
      color: COLORS.textMuted,
    },
    activityStrip: {
      flexDirection: 'row',
      gap: 8,
    },
    activityPill: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 7,
    },
    activityPillText: {
      fontSize: 12,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    focusTeaserCard: {
      backgroundColor: COLORS.surfaceSubtle,
      borderRadius: 9,
      padding: 13,
      borderWidth: 1,
      borderColor: COLORS.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    focusTeaserLeft: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    focusTeaserTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: COLORS.textPrimary,
    },
    focusTeaserSub: {
      fontSize: 11,
      color: COLORS.textMuted,
      fontVariant: ['tabular-nums'],
    },
    focusTeaserBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
      flexShrink: 0,
    },
    focusTeaserBtnText: {
      fontSize: 12,
      fontWeight: '700',
    },
    cardioCard: {
      backgroundColor: COLORS.surface,
      borderRadius: 10,
      padding: 14,
      borderWidth: 1,
      borderColor: COLORS.border,
      gap: 8,
    },
    cardioHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    tagPill: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 5,
    },
    tagPillText: {
      fontSize: 10,
      fontWeight: '700',
    },
    cardioRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
      gap: 8,
    },
    cardioRowLast: {
      borderBottomWidth: 0,
      paddingBottom: 2,
    },
    cardioExName: {
      fontSize: 13,
      fontWeight: '700',
      color: COLORS.textPrimary,
    },
    cardioMeta: {
      fontSize: 11,
      color: COLORS.textMuted,
      fontVariant: ['tabular-nums'],
      marginTop: 1,
    },
    speedBadge: {
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 6,
    },
    speedBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    prCardContainer: {
      backgroundColor: COLORS.surface,
      borderRadius: 10,
      padding: 14,
      borderWidth: 1,
      borderColor: COLORS.border,
      gap: 10,
    },
    prCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    prCountText: {
      fontSize: 11,
      color: COLORS.textMuted,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
    },
    prSearchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: COLORS.surfaceSubtle,
      borderRadius: 7,
      paddingHorizontal: 12,
      paddingVertical: 8,
      gap: 8,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    prSearchInput: {
      flex: 1,
      color: COLORS.textPrimary,
      fontSize: 13,
      padding: 0,
    },
    prCategoryChips: {
      flexDirection: 'row',
      gap: 6,
      paddingVertical: 2,
    },
    prCatChip: {
      paddingHorizontal: 11,
      paddingVertical: 5,
      borderRadius: 6,
      backgroundColor: COLORS.surfaceSubtle,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    prCatChipSelected: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
    },
    prCatChipText: {
      fontSize: 11,
      fontWeight: '600',
      color: COLORS.textSecondary,
    },
    prCatChipTextSelected: {
      color: COLORS.primaryText,
      fontWeight: '700',
    },
    prList: {
      gap: 0,
    },
    prRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
      gap: 10,
    },
    prRowLast: {
      borderBottomWidth: 0,
      paddingBottom: 2,
    },
    prLeft: {
      flex: 1,
      minWidth: 0,
      gap: 4,
    },
    prExName: {
      fontSize: 14,
      fontWeight: '700',
      color: COLORS.textPrimary,
    },
    prMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexWrap: 'wrap',
    },
    prCatBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    prCatBadgeText: {
      fontSize: 10,
      fontWeight: '700',
    },
    recentBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    recentBadgeText: {
      fontSize: 10,
      fontWeight: '700',
    },
    prDateText: {
      fontSize: 11,
      color: COLORS.textMuted,
      fontVariant: ['tabular-nums'],
    },
    prRightRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexShrink: 0,
    },
    prRightValCol: {
      alignItems: 'flex-end',
    },
    prWeightText: {
      fontSize: 14,
      fontWeight: '800',
      color: COLORS.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    prRepsText: {
      fontSize: 10,
      color: COLORS.textMuted,
      fontVariant: ['tabular-nums'],
    },
    prInspectText: {
      fontSize: 11,
      fontWeight: '600',
      color: COLORS.textSecondary,
    },
    showMorePrBtn: {
      marginTop: 10,
      paddingVertical: 9,
      borderRadius: 6,
      backgroundColor: COLORS.surfaceSubtle,
      borderWidth: 1,
      borderColor: COLORS.border,
      alignItems: 'center',
    },
    showMorePrText: {
      fontSize: 12,
      fontWeight: '700',
      color: COLORS.textPrimary,
    },
    emptyPrCard: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 22,
      gap: 8,
    },
    emptyPrText: {
      color: COLORS.textMuted,
      fontSize: 12,
    },
  });

let styles = createStyles();
subscribeTheme(() => {
  styles = createStyles();
});
