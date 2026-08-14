import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../theme';
import { WorkoutSession, PersonalRecord } from '../types/fitness';
import { AnalyticsCharts } from '../components/AnalyticsCharts';
import { AICoachWidget } from '../components/AICoachWidget';
import { OneRepMaxWidget } from '../components/OneRepMaxWidget';
import { calculateUserStats } from '../services/storage';

interface AnalyticsTabProps {
  workouts: WorkoutSession[];
  prs: Record<string, PersonalRecord>;
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ workouts, prs }) => {
  const [filterMode, setFilterMode] = useState<'weekly' | 'monthly' | 'all'>('weekly');

  const filteredWorkouts = workouts.filter(w => {
    if (filterMode === 'all') return true;
    const dateObj = new Date(w.date);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - dateObj.getTime()) / (1000 * 3600 * 24));
    return filterMode === 'weekly' ? diffDays <= 7 : diffDays <= 30;
  });

  const stats = calculateUserStats(filteredWorkouts);
  const prList = Object.values(prs);

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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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

      {/* AI Coach Assistant Widget */}
      <AICoachWidget workouts={filteredWorkouts} prs={prs} />

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
      <OneRepMaxWidget workouts={filteredWorkouts} />

      {/* Personal Record Spotlight Bento Card */}
      <View style={styles.prBentoCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.prIconBadge}>
            <Ionicons name="trophy" size={18} color="#111111" />
          </View>
          <View>
            <Text style={styles.sectionTitle}>Kişisel Rekorlar (PR)</Text>
            <Text style={styles.sectionSub}>Ağırlık ve tekrar rekorları</Text>
          </View>
        </View>

        {prList.length > 0 ? (
          <View style={styles.prList}>
            {prList.slice(0, 6).map(pr => (
              <View key={pr.exerciseId} style={styles.prCard}>
                <View style={styles.prLeft}>
                  <Text style={styles.prExName}>{pr.exerciseName}</Text>
                  <Text style={styles.prDateText}>Tarih: {pr.date}</Text>
                </View>

                <View style={styles.prRightPill}>
                  <Text style={styles.prWeightText}>{pr.maxWeight} kg</Text>
                  <Text style={styles.prRepsText}>{pr.maxReps} tekrar</Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyPrCard}>
            <Ionicons name="ribbon-outline" size={32} color={COLORS.textMuted} />
            <Text style={styles.emptyPrText}>Henüz kaydedilmiş rekor bulunmuyor.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  sectionSub: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  prList: {
    gap: 10,
  },
  prCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceSubtle,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  prLeft: {
    gap: 2,
  },
  prExName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  prDateText: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  prRightPill: {
    alignItems: 'flex-end',
    backgroundColor: COLORS.primaryGlow,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
  },
  prWeightText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111111',
  },
  prRepsText: {
    fontSize: 10,
    color: '#333333',
    fontWeight: '600',
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
