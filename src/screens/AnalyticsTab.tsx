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
import { COLORS, SHADOWS } from '../theme';
import { WorkoutSession, PersonalRecord, MuscleCategory } from '../types/fitness';
import { AnalyticsCharts } from '../components/AnalyticsCharts';
import { OneRepMaxWidget } from '../components/OneRepMaxWidget';
import { ExercisePRDetailModal } from '../components/ExercisePRDetailModal';
import { MuscleRecoveryHeatmap } from '../components/MuscleRecoveryHeatmap';
import { calculateAllMuscleRecovery } from '../services/muscleRecoveryService';
import { calculateUserStats, getMondayOfWeek, getLocalDateString } from '../services/storage';
import { calculateAutoregulatedE1RM } from '../services/progressionEngine';

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
  onSelect: (item: ExercisePRListItem) => void;
}

// Memoized PR card row: opening the PR detail modal changes
// selectedExerciseForPR state and re-renders AnalyticsTab; with a stable
// onSelect callback these rows skip that re-render.
const PRCardRow = React.memo(function PRCardRow({ item, onSelect }: PRCardRowProps) {
  const catColor = (COLORS.category as Record<string, string>)[item.category] || COLORS.textPrimary;
  return (
    <TouchableOpacity
      style={styles.prCard}
      activeOpacity={0.75}
      onPress={() => onSelect(item)}
    >
      <View style={styles.prLeft}>
        <Text style={styles.prExName} numberOfLines={1}>{item.name}</Text>
        <View style={styles.prCardMetaRow}>
          <View style={[styles.prCatBadge, { backgroundColor: catColor + '20' }]}>
            <Text style={[styles.prCatBadgeText, { color: catColor }]}>{item.category}</Text>
          </View>
          {item.isRecent && (
            <View style={styles.recentBadge}>
              <Text style={styles.recentBadgeText}>Bu Hafta</Text>
            </View>
          )}
          {item.lastWorkoutDate && !item.isRecent && (
            <Text style={styles.prDateText}>Son: {item.lastWorkoutDate}</Text>
          )}
        </View>
      </View>

      <View style={styles.prRightRow}>
        {item.allTimeWeight ? (
          <View style={styles.prRightPill}>
            <Text style={styles.prWeightText}>{item.allTimeWeight} kg</Text>
            <Text style={styles.prRepsText}>
              {item.allTimeReps || 1} rep • 1RM: {item.allTime1RM || Math.round(item.allTimeWeight * 1.05)}k
            </Text>
          </View>
        ) : item.pr?.maxSpeedKmh ? (
          <View style={styles.prRightPill}>
            <Text style={styles.prWeightText}>{item.pr.maxSpeedKmh} km/h</Text>
            <Text style={styles.prRepsText}>
              {item.pr.maxDistanceKm ? `${item.pr.maxDistanceKm} km` : 'Kardiyo'}
            </Text>
          </View>
        ) : (
          <View style={styles.prInspectBadge}>
            <Text style={styles.prInspectBadgeText}>İncele</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={14} color={COLORS.textMuted} />
      </View>
    </TouchableOpacity>
  );
});

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({
  workouts,
  prs,
  workoutDays,
  weeklyTargetHistory,
}) => {
  const insets = useSafeAreaInsets();
  type AnalyticsSubTab = 'overview' | 'fatigue' | 'prs';
  const [activeTab, setActiveTab] = useState<AnalyticsSubTab>('overview');
  const [filterMode, setFilterMode] = useState<'weekly' | 'monthly' | 'all'>('weekly');
  const [selectedExerciseForPR, setSelectedExerciseForPR] = useState<{ id?: string; name: string; category?: string; equipment?: string } | null>(null);
  const [prSearchQuery, setPrSearchQuery] = useState('');
  const [selectedPRCategory, setSelectedPRCategory] = useState<MuscleCategory | 'Hepsi'>('Hepsi');

  const filteredWorkouts = useMemo(() => {
    const now = new Date();
    const currentMonday = getMondayOfWeek(now);
    const currentMondayStr = getLocalDateString(currentMonday);
    const currentSunday = new Date(currentMonday);
    currentSunday.setDate(currentSunday.getDate() + 6);
    const currentSundayStr = getLocalDateString(currentSunday);

    const year = now.getFullYear();
    const month = now.getMonth();
    const currentMonthStartStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    const currentMonthEndStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

    return workouts.filter(w => {
      if (w.completed === false) return false;
      if (filterMode === 'weekly') {
        return w.date >= currentMondayStr && w.date <= currentSundayStr;
      }
      if (filterMode === 'monthly') {
        return w.date >= currentMonthStartStr && w.date <= currentMonthEndStr;
      }
      return true;
    });
  }, [workouts, filterMode]);

  // Aggregates every completed set of the filtered period: memoized so
  // sub-tab switches, PR search keystrokes and modal open/close don't rescan.
  const stats = useMemo(
    () => calculateUserStats(filteredWorkouts, workoutDays, weeklyTargetHistory),
    [filteredWorkouts, workoutDays, weeklyTargetHistory]
  );

  const handleSelectOneRMExercise = useCallback((exerciseName: string) => {
    setSelectedExerciseForPR({ name: exerciseName });
  }, []);

  const handleSelectPRItem = useCallback((item: ExercisePRListItem) => {
    setSelectedExerciseForPR(item);
  }, []);

  const handleClosePRDetail = useCallback(() => {
    setSelectedExerciseForPR(null);
  }, []);

  // Visual Muscle Recovery State across all muscle groups
  const muscleRecoveryMap = useMemo(() => {
    return calculateAllMuscleRecovery(workouts);
  }, [workouts]);

  // Egzersiz PR Listesi: Antrenman geçmişi ve kaydedilen PR'ları birleştirir
  const allExercisePRItems = useMemo(() => {
    const exerciseMap: Record<string, ExercisePRListItem> = {};

    // 1. PR Kayıtları
    Object.values(prs).forEach(pr => {
      const key = pr.exerciseName.toLowerCase().trim();
      exerciseMap[key] = {
        id: pr.exerciseId,
        name: pr.exerciseName,
        category: 'Göğüs',
        equipment: 'Barbell',
        pr,
        isRecent: false,
        allTimeWeight: pr.maxWeight,
        allTimeReps: pr.maxReps,
        allTime1RM: pr.maxEstimatedOneRepMax,
      };
    });

    // 2. Antrenman Geçmişi (Tamamlanan setler ve en güncel tarihler)
    const now = new Date().getTime();
    workouts.forEach(w => {
      if (w.completed === false) return;
      const wDate = new Date(w.date).getTime();
      const isThisWeek = (now - wDate) <= 7 * 24 * 3600 * 1000;

      w.exercises.forEach(ex => {
        const completedSets = ex.sets?.filter(s => s.completed) || [];
        if (completedSets.length === 0) return;

        const key = ex.exerciseName.toLowerCase().trim();
        if (!exerciseMap[key]) {
          let maxW = 0;
          let maxR = 0;
          let max1RM = 0;
          completedSets.forEach(s => {
            if (s.weight && s.reps && (s.weight > maxW || (s.weight === maxW && s.reps > maxR))) {
              maxW = s.weight;
              maxR = s.reps;
              max1RM = Math.round(calculateAutoregulatedE1RM(s.weight, s.reps, s.rir ?? 1));
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
          if (ex.category) exerciseMap[key].category = ex.category;
          if (ex.equipment) exerciseMap[key].equipment = ex.equipment;
          if (!exerciseMap[key].lastWorkoutDate || new Date(w.date) > new Date(exerciseMap[key].lastWorkoutDate!)) {
            exerciseMap[key].lastWorkoutDate = w.date;
          }
          if (isThisWeek) {
            exerciseMap[key].isRecent = true;
          }
          completedSets.forEach(s => {
            if (s.weight && s.reps) {
              const curW = exerciseMap[key].allTimeWeight || 0;
              const curR = exerciseMap[key].allTimeReps || 0;
              if (s.weight > curW || (s.weight === curW && s.reps > curR)) {
                exerciseMap[key].allTimeWeight = s.weight;
                exerciseMap[key].allTimeReps = s.reps;
                exerciseMap[key].allTime1RM = Math.round(calculateAutoregulatedE1RM(s.weight, s.reps, s.rir ?? 1));
              }
            }
          });
        }
      });
    });

    // Filtreleme ve sıralama
    return Object.values(exerciseMap).filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(prSearchQuery.toLowerCase());
      const matchesCat = selectedPRCategory === 'Hepsi' || item.category === selectedPRCategory;
      return matchesSearch && matchesCat;
    }).sort((a, b) => {
      const aScore = (a.allTimeWeight ? 100 : 0) + (a.isRecent ? 50 : 0);
      const bScore = (b.allTimeWeight ? 100 : 0) + (b.isRecent ? 50 : 0);
      if (bScore !== aScore) return bScore - aScore;
      return a.name.localeCompare(b.name, 'tr');
    });
  }, [prs, workouts, prSearchQuery, selectedPRCategory]);

  // Compute average speeds per cardio exercise (memoized on the filtered
  // period — previously a full rescan of every set on each render)
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

  return (
    <View style={styles.container}>
      {/* Analytics Sub-Tab Segmented Switcher */}
      <View style={[styles.subTabBar, { paddingTop: Math.max(insets.top, 6) }]}>
        <View style={styles.subTabContainer}>
          {(
            [
              { id: 'overview', label: 'Özet & Hacim', icon: 'bar-chart-outline' },
              { id: 'fatigue', label: 'Kas & Yorgunluk', icon: 'pulse-outline' },
              { id: 'prs', label: 'Rekorlar (PR)', icon: 'trophy-outline' },
            ] as const
          ).map((tab) => {
            const isSelected = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.subTabBtn, isSelected && styles.subTabBtnSelected]}
                onPress={() => setActiveTab(tab.id)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={tab.icon as any}
                  size={13}
                  color={isSelected ? COLORS.textInverted : COLORS.textSecondary}
                />
                <Text
                  style={[
                    styles.subTabBtnText,
                    isSelected && styles.subTabBtnTextSelected,
                  ]}
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
          { paddingBottom: 110 + Math.max(insets.bottom, 14) },
        ]}
      >
        {/* SUBTAB 1: Özet & Hacim (Overview) */}
        {activeTab === 'overview' && (
          <>
            {/* Filter Switcher Pills */}
            <View style={styles.filterBar}>
              {(['weekly', 'monthly', 'all'] as const).map(mode => {
                const isSelected = filterMode === mode;
                const labels = { weekly: 'Bu Hafta', monthly: 'Bu Ay', all: 'Tüm Zamanlar' };
                return (
                  <TouchableOpacity
                    key={mode}
                    style={[styles.filterBtn, isSelected && styles.filterBtnSelected]}
                    onPress={() => setFilterMode(mode)}
                  >
                    <Text style={[styles.filterBtnText, isSelected && styles.filterBtnTextSelected]}>
                      {labels[mode]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* PRIMARY BENTO GRID: Scientific Hypertrophy & Performance Metrics */}
            <View style={styles.bentoGrid}>
              {/* 1. Working Sets (Çalışma Seti Sayısı) */}
              <View style={[styles.bentoSquareCard, { borderColor: COLORS.primary }]}>
                <View style={styles.cardTopRow}>
                  <View style={styles.metricIconBg}>
                    <Ionicons name="barbell" size={14} color={COLORS.primary} />
                  </View>
                  <Text style={styles.metricLabel}>Çalışma Setleri</Text>
                </View>
                <Text style={[styles.metricValue, { color: COLORS.primary }]}>
                  {stats.totalHardSets} <Text style={styles.unitText}>Set</Text>
                </Text>
              </View>

              {/* 2. Workout Compliance Rate (%) */}
              <View style={styles.bentoSquareCard}>
                <View style={styles.cardTopRow}>
                  <View style={[styles.metricIconBg, { backgroundColor: 'rgba(52, 211, 153, 0.14)', borderColor: 'rgba(52, 211, 153, 0.35)' }]}>
                    <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                  </View>
                  <Text style={styles.metricLabel}>Program Uyum Oranı</Text>
                </View>
                <Text style={styles.metricValue}>
                  %{stats.avgWorkoutCompliance}
                </Text>
              </View>

              {/* 3. Average RIR & Intensity */}
              <View style={styles.bentoSquareCard}>
                <View style={styles.cardTopRow}>
                  <View style={[styles.metricIconBg, { backgroundColor: 'rgba(139, 92, 246, 0.16)', borderColor: 'rgba(139, 92, 246, 0.35)' }]}>
                    <Ionicons name="flash" size={14} color="#8B5CF6" />
                  </View>
                  <Text style={styles.metricLabel}>Ort. Yoğunluk (RIR)</Text>
                </View>
                <Text style={styles.metricValue}>
                  RIR {stats.avgRir}
                </Text>
              </View>

              {/* 4. Active Work Time (TUT) */}
              <View style={styles.bentoSquareCard}>
                <View style={styles.cardTopRow}>
                  <View style={[styles.metricIconBg, { backgroundColor: 'rgba(236, 72, 153, 0.16)', borderColor: 'rgba(236, 72, 153, 0.35)' }]}>
                    <Ionicons name="time" size={14} color="#EC4899" />
                  </View>
                  <Text style={styles.metricLabel}>Gerilim Altında Süre (TUT)</Text>
                </View>
                <Text style={styles.metricValue}>
                  {stats.activeWorkTimeMinutes} <Text style={styles.unitText}>dk Aktif</Text>
                </Text>
              </View>
            </View>

            {/* SECONDARY BENTO ROW: Calories, Cardio Distance, Volume */}
            <View style={styles.secondaryBentoRow}>
              <View style={styles.secondaryPillCard}>
                <Ionicons name="flame" size={13} color={COLORS.danger} />
                <Text style={styles.secondaryCardValue}>{stats.totalCaloriesBurned > 0 ? stats.totalCaloriesBurned : 0} kcal</Text>
              </View>

              <View style={styles.secondaryPillCard}>
                <Ionicons name="walk" size={13} color={COLORS.primary} />
                <Text style={styles.secondaryCardValue}>{stats.totalCardioDistanceKm > 0 ? stats.totalCardioDistanceKm : 0} km</Text>
              </View>

              <View style={styles.secondaryPillCard}>
                <Ionicons name="barbell-outline" size={13} color={COLORS.textSecondary} />
                <Text style={styles.secondaryCardValue}>
                  {stats.totalVolumeKg >= 1000 ? `${(stats.totalVolumeKg / 1000).toFixed(1)}k kg` : `${stats.totalVolumeKg} kg`}
                </Text>
              </View>
            </View>

            {/* CARDIO & CALORIE ANALYTICS BENTO CARD */}
            {cardioSummary.length > 0 && (
              <View style={styles.cardioBentoCard}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.prIconBadge, { backgroundColor: COLORS.surfaceElevated }]}>
                    <Ionicons name="bicycle" size={15} color={COLORS.primary} />
                  </View>
                  <View>
                    <Text style={styles.sectionTitle}>Kardiyo & Hız Performansı</Text>
                    <Text style={styles.sectionSub}>Ekipman bazlı ortalama hız ve mesafeler</Text>
                  </View>
                </View>

                <View style={styles.cardioList}>
                  {cardioSummary.map(c => (
                    <View key={c.name} style={styles.cardioRowCard}>
                      <View style={styles.cardioLeft}>
                        <Text style={styles.cardioExName}>{c.name}</Text>
                        <Text style={styles.cardioMetaText}>
                          {c.totalDist} km • {c.totalMins} dk
                        </Text>
                      </View>
                      <View style={styles.speedPillBadge}>
                        <Ionicons name="speedometer" size={11} color={COLORS.textInverted} />
                        <Text style={styles.speedPillBadgeText}>{c.avgSpeedKmh} km/h</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* SVG Charts (Hard Sets Distribution at top, Volume Chart below) */}
            <AnalyticsCharts workouts={filteredWorkouts} allWorkouts={workouts} filterMode={filterMode} />
          </>
        )}

        {/* SUBTAB 2: Kas & Yorgunluk (Fatigue & Readiness) */}
        {activeTab === 'fatigue' && (
          <MuscleRecoveryHeatmap recoveryMap={muscleRecoveryMap} />
        )}

        {/* SUBTAB 3: Rekorlar (PRs & 1RM Progression) */}
        {activeTab === 'prs' && (
          <>
            {/* 1RM Strength Progression Widget */}
            <OneRepMaxWidget
              workouts={filteredWorkouts}
              onSelectExercise={handleSelectOneRMExercise}
            />

            {/* Personal Record Spotlight Bento Card */}
            <View style={styles.prBentoCard}>
              <View style={styles.prHeaderRow}>
                <View style={styles.prTitleBox}>
                  <View style={styles.prIconBadge}>
                    <Ionicons name="trophy-outline" size={15} color={COLORS.primary} />
                  </View>
                  <View style={styles.prTitleTextBox}>
                    <Text style={styles.sectionTitle} numberOfLines={1}>Kişisel Rekorlar (PR)</Text>
                    <Text style={styles.sectionSub} numberOfLines={1}>Haftalık, aylık ve tüm zamanlar analizi</Text>
                  </View>
                </View>
              </View>

              {/* Search Input */}
              <View style={styles.prSearchRow}>
                <Ionicons name="search" size={14} color={COLORS.textMuted} />
                <TextInput
                  style={styles.prSearchInput}
                  placeholder="Egzersiz veya rekor ara (Örn: Bench Press)..."
                  placeholderTextColor={COLORS.textMuted}
                  value={prSearchQuery}
                  onChangeText={setPrSearchQuery}
                />
                {prSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setPrSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Horizontal Category Filter Chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.prCategoryChips}>
                {(['Hepsi', 'Göğüs', 'Sırt', 'Bacak', 'Omuz', 'Ön Kol', 'Arka Kol', 'Karın', 'Kardiyo'] as const).map(cat => {
                  const isSelected = selectedPRCategory === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.prCatChip, isSelected && styles.prCatChipSelected]}
                      onPress={() => setSelectedPRCategory(cat)}
                    >
                      <Text style={[styles.prCatChipText, isSelected && styles.prCatChipTextSelected]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Interactive Exercise PR Cards */}
              {allExercisePRItems.length > 0 ? (
                <View style={styles.prList}>
                  {allExercisePRItems.slice(0, 15).map(item => (
                    <PRCardRow
                      key={item.id || item.name}
                      item={item}
                      onSelect={handleSelectPRItem}
                    />
                  ))}
                </View>
              ) : (
                <View style={styles.emptyPrCard}>
                  <Ionicons name="search-outline" size={24} color={COLORS.textMuted} />
                  <Text style={styles.emptyPrText}>Aradığınız kriterde egzersiz bulunamadı.</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  subTabBar: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  subTabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 3,
  },
  subTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderRadius: 6,
    gap: 4,
    minHeight: 34,
  },
  subTabBtnSelected: {
    backgroundColor: COLORS.primary,
  },
  subTabBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  subTabBtnTextSelected: {
    color: COLORS.textInverted,
    fontWeight: '800',
  },
  scrollArea: {
    flex: 1,
  },
  content: {
    padding: 12,
    paddingBottom: 130,
    gap: 12,
  },
  filterBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.soft,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  filterBtnSelected: {
    backgroundColor: COLORS.primary,
  },
  filterBtnText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  filterBtnTextSelected: {
    color: COLORS.textInverted,
    fontWeight: '800',
  },
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bentoSquareCard: {
    flex: 1,
    minWidth: '47%',
    maxWidth: '50%',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
    ...SHADOWS.soft,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  secondaryBentoRow: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryPillCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: COLORS.surface,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryCardValue: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  metricIconBg: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: COLORS.primaryGlow,
    borderWidth: 1,
    borderColor: 'rgba(76, 194, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  unitText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  metricLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    flex: 1,
  },
  cardioBentoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
    ...SHADOWS.soft,
  },
  cardioList: {
    gap: 6,
  },
  cardioRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceSubtle,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardioLeft: {
    gap: 2,
  },
  cardioExName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  cardioMetaText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontVariant: ['tabular-nums'],
  },
  speedPillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  speedPillBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textInverted,
    fontVariant: ['tabular-nums'],
  },
  prBentoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
    ...SHADOWS.soft,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  prHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  prTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  prTitleTextBox: {
    flex: 1,
    minWidth: 0,
  },
  prIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sectionSub: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  openPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    flexShrink: 0,
  },
  openPickerBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textInverted,
  },
  prSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
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
    paddingHorizontal: 10,
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
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  prCatChipTextSelected: {
    color: COLORS.textInverted,
    fontWeight: '800',
  },
  prList: {
    gap: 6,
  },
  prCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceSubtle,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  prLeft: {
    flex: 1,
    gap: 4,
    minWidth: 0,
    justifyContent: 'center',
  },
  prExName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  prCardMetaRow: {
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
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  recentBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  prDateText: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontVariant: ['tabular-nums'],
  },
  prRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  prRightPill: {
    alignItems: 'flex-end',
    backgroundColor: COLORS.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
  },
  prWeightText: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.primary,
    fontVariant: ['tabular-nums'],
  },
  prRepsText: {
    fontSize: 9,
    color: COLORS.textSecondary,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  prInspectBadge: {
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  prInspectBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  emptyPrCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 6,
  },
  emptyPrText: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
});
