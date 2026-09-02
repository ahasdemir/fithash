import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../theme';
import { WorkoutSession, PersonalRecord, Exercise, MuscleCategory } from '../types/fitness';
import { AnalyticsCharts } from '../components/AnalyticsCharts';
import { OneRepMaxWidget } from '../components/OneRepMaxWidget';
import { ExercisePRDetailModal } from '../components/ExercisePRDetailModal';
import { ExercisePickerModal } from '../components/ExercisePickerModal';
import { calculateUserStats, getExercises } from '../services/storage';

interface AnalyticsTabProps {
  workouts: WorkoutSession[];
  prs: Record<string, PersonalRecord>;
  workoutDays?: number[];
  weeklyTargetHistory?: Record<string, number>;
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({
  workouts,
  prs,
  workoutDays,
  weeklyTargetHistory,
}) => {
  const [filterMode, setFilterMode] = useState<'weekly' | 'monthly' | 'all'>('weekly');
  const [selectedExerciseForPR, setSelectedExerciseForPR] = useState<{ id?: string; name: string; category?: string; equipment?: string } | null>(null);
  const [showPickerModal, setShowPickerModal] = useState(false);
  const [prSearchQuery, setPrSearchQuery] = useState('');
  const [selectedPRCategory, setSelectedPRCategory] = useState<MuscleCategory | 'Hepsi'>('Hepsi');
  const [libraryExercises, setLibraryExercises] = useState<Exercise[]>([]);

  useEffect(() => {
    getExercises().then(setLibraryExercises);
  }, []);

  const filteredWorkouts = workouts.filter(w => {
    if (filterMode === 'all') return true;
    const dateObj = new Date(w.date);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - dateObj.getTime()) / (1000 * 3600 * 24));
    return filterMode === 'weekly' ? diffDays <= 7 : diffDays <= 30;
  });

  const stats = calculateUserStats(filteredWorkouts, workoutDays, weeklyTargetHistory);

  // Egzersiz PR Listesi: Antrenman geçmişi, kaydedilen PR'lar ve kütüphaneyi birleştirir
  const allExercisePRItems = useMemo(() => {
    const exerciseMap: Record<string, { id: string; name: string; category: MuscleCategory; equipment: string; pr?: PersonalRecord; lastWorkoutDate?: string; isRecent: boolean; allTimeWeight?: number; allTimeReps?: number; allTime1RM?: number }> = {};

    // 1. Kütüphane egzersizleri tabanı
    libraryExercises.forEach(ex => {
      exerciseMap[ex.name.toLowerCase().trim()] = {
        id: ex.id,
        name: ex.name,
        category: ex.category,
        equipment: ex.equipment,
        isRecent: false,
      };
    });

    // 2. PR Kayıtları
    Object.values(prs).forEach(pr => {
      const key = pr.exerciseName.toLowerCase().trim();
      if (!exerciseMap[key]) {
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
      } else {
        exerciseMap[key].pr = pr;
        exerciseMap[key].allTimeWeight = pr.maxWeight;
        exerciseMap[key].allTimeReps = pr.maxReps;
        exerciseMap[key].allTime1RM = pr.maxEstimatedOneRepMax;
      }
    });

    // 3. Antrenman Geçmişi (Tarih ve tamamlanan set bilgileri)
    const now = new Date().getTime();
    workouts.forEach(w => {
      const wDate = new Date(w.date).getTime();
      const isThisWeek = (now - wDate) <= 7 * 24 * 3600 * 1000;

      w.exercises.forEach(ex => {
        const key = ex.exerciseName.toLowerCase().trim();
        if (!exerciseMap[key]) {
          exerciseMap[key] = {
            id: ex.exerciseId,
            name: ex.exerciseName,
            category: ex.category,
            equipment: ex.equipment,
            lastWorkoutDate: w.date,
            isRecent: isThisWeek,
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
        }
      });
    });

    // Filtreleme ve sıralama
    return Object.values(exerciseMap).filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(prSearchQuery.toLowerCase());
      const matchesCat = selectedPRCategory === 'Hepsi' || item.category === selectedPRCategory;
      return matchesSearch && matchesCat;
    }).sort((a, b) => {
      const aScore = (a.allTimeWeight ? 100 : 0) + (a.isRecent ? 50 : 0) + (a.lastWorkoutDate ? 20 : 0);
      const bScore = (b.allTimeWeight ? 100 : 0) + (b.isRecent ? 50 : 0) + (b.lastWorkoutDate ? 20 : 0);
      if (bScore !== aScore) return bScore - aScore;
      return a.name.localeCompare(b.name, 'tr');
    });
  }, [libraryExercises, prs, workouts, prSearchQuery, selectedPRCategory]);

  // Compute average speeds per cardio exercise
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

  const cardioSummary = Object.keys(cardioStatsMap).map(name => {
    const item = cardioStatsMap[name];
    const avgSpeed = (item.totalDist / item.totalMins) * 60;
    return {
      name,
      totalDist: Math.round(item.totalDist * 10) / 10,
      totalMins: item.totalMins,
      avgSpeedKmh: parseFloat(avgSpeed.toFixed(1)),
    };
  });

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.content}>
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
        {/* 1. Hard Sets (Efektif Set Sayısı - RIR 0-3) */}
        <View style={[styles.bentoSquareCard, { backgroundColor: COLORS.surface, borderColor: COLORS.primary }]}>
          <View style={styles.metricIconBg}>
            <Ionicons name="barbell" size={18} color="#111111" />
          </View>
          <Text style={styles.metricValue}>
            {stats.totalHardSets} <Text style={styles.unitText}>Set</Text>
          </Text>
          <Text style={styles.metricLabel}>Sert Setler (RIR 0-3)</Text>
        </View>

        {/* 2. Workout Compliance Rate (%) */}
        <View style={styles.bentoSquareCard}>
          <View style={[styles.metricIconBg, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
            <Ionicons name="checkmark-circle" size={18} color="#10B981" />
          </View>
          <Text style={styles.metricValue}>
            %{stats.avgWorkoutCompliance}
          </Text>
          <Text style={styles.metricLabel}>Program Uyum Oranı</Text>
        </View>

        {/* 3. Average RIR & Intensity */}
        <View style={styles.bentoSquareCard}>
          <View style={[styles.metricIconBg, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
            <Ionicons name="flash" size={18} color="#8B5CF6" />
          </View>
          <Text style={styles.metricValue}>
            RIR {stats.avgRir}
          </Text>
          <Text style={styles.metricLabel}>Ort. Yoğunluk (RIR)</Text>
        </View>

        {/* 4. Active Work Time (TUT) */}
        <View style={styles.bentoSquareCard}>
          <View style={[styles.metricIconBg, { backgroundColor: 'rgba(236, 72, 153, 0.15)' }]}>
            <Ionicons name="time" size={18} color="#EC4899" />
          </View>
          <Text style={styles.metricValue}>
            {stats.activeWorkTimeMinutes} <Text style={styles.unitText}>dk Aktif</Text>
          </Text>
          <Text style={styles.metricLabel}>Gerilim Altında Süre (TUT)</Text>
        </View>
      </View>

      {/* SECONDARY BENTO ROW: Calories, Cardio Distance, Volume */}
      <View style={styles.secondaryBentoRow}>
        <View style={styles.secondaryPillCard}>
          <Ionicons name="flame" size={14} color="#EF4444" />
          <Text style={styles.secondaryCardValue}>{stats.totalCaloriesBurned > 0 ? stats.totalCaloriesBurned : 0} kcal</Text>
        </View>

        <View style={styles.secondaryPillCard}>
          <Ionicons name="walk" size={14} color="#06B6D4" />
          <Text style={styles.secondaryCardValue}>{stats.totalCardioDistanceKm > 0 ? stats.totalCardioDistanceKm : 0} km</Text>
        </View>

        <View style={styles.secondaryPillCard}>
          <Ionicons name="barbell-outline" size={14} color={COLORS.textSecondary} />
          <Text style={styles.secondaryCardValue}>
            {stats.totalVolumeKg >= 1000 ? `${(stats.totalVolumeKg / 1000).toFixed(1)}k kg` : `${stats.totalVolumeKg} kg`}
          </Text>
        </View>
      </View>

      {/* CARDIO & CALORIE ANALYTICS BENTO CARD */}
      {cardioSummary.length > 0 && (
        <View style={styles.cardioBentoCard}>
          <View style={styles.sectionHeader}>
            <View style={[styles.prIconBadge, { backgroundColor: '#06B6D4' }]}>
              <Ionicons name="bicycle" size={18} color="#111111" />
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
                  <Ionicons name="speedometer" size={12} color="#111111" />
                  <Text style={styles.speedPillBadgeText}>{c.avgSpeedKmh} km/h</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* SVG Charts (Hard Sets Distribution at top, Volume Chart below) */}
      <AnalyticsCharts workouts={filteredWorkouts} allWorkouts={workouts} filterMode={filterMode} />

      {/* 1RM Strength Progression Widget (Reddit Community Top Feature) */}
      <OneRepMaxWidget
        workouts={filteredWorkouts}
        onSelectExercise={(name) => setSelectedExerciseForPR({ name })}
      />

      {/* Personal Record Spotlight Bento Card */}
      <View style={styles.prBentoCard}>
        <View style={styles.prHeaderRow}>
          <View style={styles.sectionHeader}>
            <View style={styles.prIconBadge}>
              <Ionicons name="trophy" size={18} color="#111111" />
            </View>
            <View>
              <Text style={styles.sectionTitle}>Kişisel Rekorlar (PR) & Analiz</Text>
              <Text style={styles.sectionSub}>Her hareket için haftalık, aylık ve tüm zamanlar analizi</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.openPickerBtn}
            activeOpacity={0.8}
            onPress={() => setShowPickerModal(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="add-circle" size={15} color="#111111" />
            <Text style={styles.openPickerBtnText}>Tüm Hareketler</Text>
          </TouchableOpacity>
        </View>

        {/* Search Input */}
        <View style={styles.prSearchRow}>
          <Ionicons name="search" size={16} color={COLORS.textMuted} />
          <TextInput
            style={styles.prSearchInput}
            placeholder="Egzersiz veya rekor ara (Örn: Bench Press, Squat)..."
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
            {allExercisePRItems.slice(0, 15).map(item => {
              const catColor = (COLORS.category as Record<string, string>)[item.category] || COLORS.textPrimary;
              return (
                <TouchableOpacity
                  key={item.id || item.name}
                  style={styles.prCard}
                  activeOpacity={0.75}
                  onPress={() => setSelectedExerciseForPR(item)}
                >
                  <View style={styles.prLeft}>
                    <Text style={styles.prExName}>{item.name}</Text>
                    <View style={styles.prCardMetaRow}>
                      <View style={[styles.prCatBadge, { backgroundColor: catColor + '18' }]}>
                        <Text style={[styles.prCatBadgeText, { color: catColor }]}>{item.category}</Text>
                      </View>
                      {item.isRecent && (
                        <View style={styles.recentBadge}>
                          <Text style={styles.recentBadgeText}>🔥 Bu Hafta</Text>
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
                        <Text style={styles.prInspectBadgeText}>İncele ➔</Text>
                      </View>
                    )}
                    <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyPrCard}>
            <Ionicons name="search-outline" size={32} color={COLORS.textMuted} />
            <Text style={styles.emptyPrText}>Aradığınız kriterde egzersiz bulunamadı.</Text>
          </View>
        )}
      </View>
    </ScrollView>

      <ExercisePRDetailModal
        visible={!!selectedExerciseForPR}
        onClose={() => setSelectedExerciseForPR(null)}
        exercise={selectedExerciseForPR}
        workouts={workouts}
      />

      <ExercisePickerModal
        visible={showPickerModal}
        onClose={() => setShowPickerModal(false)}
        onSelectExercise={(ex) => {
          setShowPickerModal(false);
          setSelectedExerciseForPR(ex);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollArea: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 140,
    gap: 16,
  },
  filterBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 100,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.soft,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 100,
  },
  filterBtnSelected: {
    backgroundColor: '#111111',
  },
  filterBtnText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  filterBtnTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  bentoSquareCard: {
    flex: 1,
    minWidth: '46%',
    maxWidth: '50%',
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
    ...SHADOWS.soft,
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
    gap: 4,
    backgroundColor: COLORS.surfaceSubtle,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryCardValue: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  metricIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  unitText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textMuted,
  },
  metricLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  cardioBentoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 14,
    ...SHADOWS.soft,
  },
  cardioList: {
    gap: 10,
  },
  cardioRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceSubtle,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardioLeft: {
    gap: 2,
  },
  cardioExName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  cardioMetaText: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  speedPillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
  },
  speedPillBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#111111',
  },
  prBentoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 14,
    ...SHADOWS.soft,
  },
  prHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  prIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
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
    paddingVertical: 6,
    borderRadius: 100,
  },
  openPickerBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#111111',
  },
  prSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 100,
    paddingHorizontal: 14,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  prCatChipSelected: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  prCatChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  prCatChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  prList: {
    gap: 8,
  },
  prCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceSubtle,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  prLeft: {
    flex: 1,
    gap: 4,
    paddingRight: 8,
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
  },
  prCatBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  prCatBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  recentBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  recentBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#EF4444',
  },
  prDateText: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  prRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  prRightPill: {
    alignItems: 'flex-end',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  prWeightText: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },
  prRepsText: {
    fontSize: 9,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  prInspectBadge: {
    backgroundColor: COLORS.primaryGlow,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  prInspectBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#111111',
  },
  emptyPrCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  emptyPrText: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
});
