import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../theme';
import { WorkoutSession, Exercise } from '../types/fitness';

export interface ExercisePRStats {
  exerciseName: string;
  category: string;
  equipment: string;
  isCardio: boolean;

  // Weekly Stats (Son 7 Gün)
  weekly: {
    hasData: boolean;
    maxWeight: number;
    maxReps: number;
    estimated1RM: number;
    bestDate: string;
    totalSets: number;
    totalVolume: number;
    // Cardio
    maxSpeedKmh?: number;
    maxDistanceKm?: number;
    maxDurationMins?: number;
  };

  // Monthly Stats (Son 30 Gün)
  monthly: {
    hasData: boolean;
    maxWeight: number;
    maxReps: number;
    estimated1RM: number;
    bestDate: string;
    totalSets: number;
    totalVolume: number;
    sessionCount: number;
    // Cardio
    maxSpeedKmh?: number;
    maxDistanceKm?: number;
    maxDurationMins?: number;
  };

  // All-Time Stats
  allTime: {
    hasData: boolean;
    maxWeight: number;
    maxReps: number;
    estimated1RM: number;
    bestDate: string;
    totalSessions: number;
    totalLifetimeVolume: number;
    firstDate?: string;
    // Cardio
    maxSpeedKmh?: number;
    maxDistanceKm?: number;
    maxDurationMins?: number;
  };

  // Session History for this exercise
  sessionHistory: Array<{
    workoutId: string;
    workoutName: string;
    date: string;
    sets: Array<{
      setNumber: number;
      weight: number;
      reps: number;
      rir?: number;
      isPR?: boolean;
      durationMinutes?: number;
      distanceKm?: number;
      avgSpeedKmh?: number;
    }>;
    sessionMaxWeight: number;
    sessionMax1RM: number;
    sessionVolume: number;
  }>;
}

interface ExercisePRDetailModalProps {
  visible: boolean;
  onClose: () => void;
  exercise: Exercise | { id?: string; name: string; category?: string; equipment?: string } | null;
  workouts: WorkoutSession[];
}

/**
 * Hesaplama Motoru: Seçilen egzersizin tüm antrenman geçmişinden
 * Haftalık, Aylık ve Tüm Zamanlar PR & İlerleme verilerini üretir.
 */
export const calculateExercisePRStats = (
  exercise: { id?: string; name: string; category?: string; equipment?: string },
  workouts: WorkoutSession[]
): ExercisePRStats => {
  const targetName = exercise.name.trim().toLowerCase();
  const targetId = exercise.id;
  const now = new Date().getTime();

  let detectedCategory = exercise.category || 'Göğüs';
  let detectedEquipment = exercise.equipment || 'Barbell';

  // 1. İlgili egzersizin geçtiği tüm seansları topla (kronolojik: en yeniden en eskiye)
  const matchingSessions: ExercisePRStats['sessionHistory'] = [];

  // Tarihe göre yeniden eskiye sıralı kopyala
  const sortedWorkouts = [...workouts].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  sortedWorkouts.forEach(workout => {
    if (workout.completed === false) return;

    workout.exercises.forEach(ex => {
      const matchByName = ex.exerciseName && ex.exerciseName.trim().toLowerCase() === targetName;
      const matchById = targetId && ex.exerciseId === targetId;

      if (matchByName || matchById) {
        if (ex.category) detectedCategory = ex.category;
        if (ex.equipment) detectedEquipment = ex.equipment;

        const completedSets = ex.sets.filter(s => s.completed);
        if (completedSets.length === 0) return;

        let sessionMaxW = 0;
        let sessionMax1RM = 0;
        let sessionVol = 0;

        const formattedSets = completedSets.map(s => {
          const w = s.weight || 0;
          const r = s.reps || 0;
          if (w > 0 && r > 0) {
            const e1rm = Math.round(w * (1 + r / 30));
            if (w > sessionMaxW) sessionMaxW = w;
            if (e1rm > sessionMax1RM) sessionMax1RM = e1rm;
            sessionVol += w * r;
          }
          return {
            setNumber: s.setNumber,
            weight: w,
            reps: r,
            rir: s.rir,
            isPR: s.isPR,
            durationMinutes: s.durationMinutes,
            distanceKm: s.distanceKm,
            avgSpeedKmh: s.avgSpeedKmh,
          };
        });

        matchingSessions.push({
          workoutId: workout.id,
          workoutName: workout.name,
          date: workout.date,
          sets: formattedSets,
          sessionMaxWeight: sessionMaxW,
          sessionMax1RM: sessionMax1RM,
          sessionVolume: sessionVol,
        });
      }
    });
  });

  const isCardio = detectedCategory === 'Kardiyo';

  // 2. Haftalık, Aylık, Tüm Zamanlar Analizleri
  const weekly = {
    hasData: false,
    maxWeight: 0,
    maxReps: 0,
    estimated1RM: 0,
    bestDate: '',
    totalSets: 0,
    totalVolume: 0,
    maxSpeedKmh: 0,
    maxDistanceKm: 0,
    maxDurationMins: 0,
  };

  const monthly = {
    hasData: false,
    maxWeight: 0,
    maxReps: 0,
    estimated1RM: 0,
    bestDate: '',
    totalSets: 0,
    totalVolume: 0,
    sessionCount: 0,
    maxSpeedKmh: 0,
    maxDistanceKm: 0,
    maxDurationMins: 0,
  };

  const allTime = {
    hasData: matchingSessions.length > 0,
    maxWeight: 0,
    maxReps: 0,
    estimated1RM: 0,
    bestDate: '',
    totalSessions: matchingSessions.length,
    totalLifetimeVolume: 0,
    firstDate: matchingSessions.length > 0 ? matchingSessions[matchingSessions.length - 1].date : undefined,
    maxSpeedKmh: 0,
    maxDistanceKm: 0,
    maxDurationMins: 0,
  };

  matchingSessions.forEach(session => {
    const sessionTime = new Date(session.date).getTime();
    const diffDays = Math.floor((now - sessionTime) / (1000 * 3600 * 24));
    const isThisWeek = diffDays <= 7;
    const isThisMonth = diffDays <= 30;

    if (isThisMonth) {
      monthly.sessionCount += 1;
    }

    session.sets.forEach(set => {
      // Ağırlık / Tekrar PR
      if (set.weight > 0 && set.reps > 0) {
        const e1rm = Math.round(set.weight * (1 + set.reps / 30));

        // All-Time
        allTime.totalLifetimeVolume += set.weight * set.reps;
        if (
          set.weight > allTime.maxWeight ||
          (set.weight === allTime.maxWeight && set.reps > allTime.maxReps)
        ) {
          allTime.maxWeight = set.weight;
          allTime.maxReps = set.reps;
          allTime.bestDate = session.date;
        }
        if (e1rm > allTime.estimated1RM) {
          allTime.estimated1RM = e1rm;
        }

        // Monthly
        if (isThisMonth) {
          monthly.hasData = true;
          monthly.totalSets += 1;
          monthly.totalVolume += set.weight * set.reps;
          if (
            set.weight > monthly.maxWeight ||
            (set.weight === monthly.maxWeight && set.reps > monthly.maxReps)
          ) {
            monthly.maxWeight = set.weight;
            monthly.maxReps = set.reps;
            monthly.bestDate = session.date;
          }
          if (e1rm > monthly.estimated1RM) {
            monthly.estimated1RM = e1rm;
          }
        }

        // Weekly
        if (isThisWeek) {
          weekly.hasData = true;
          weekly.totalSets += 1;
          weekly.totalVolume += set.weight * set.reps;
          if (
            set.weight > weekly.maxWeight ||
            (set.weight === weekly.maxWeight && set.reps > weekly.maxReps)
          ) {
            weekly.maxWeight = set.weight;
            weekly.maxReps = set.reps;
            weekly.bestDate = session.date;
          }
          if (e1rm > weekly.estimated1RM) {
            weekly.estimated1RM = e1rm;
          }
        }
      }

      // Cardio Stats
      if (isCardio) {
        if (set.avgSpeedKmh && set.avgSpeedKmh > (allTime.maxSpeedKmh || 0)) {
          allTime.maxSpeedKmh = set.avgSpeedKmh;
        }
        if (set.distanceKm && set.distanceKm > (allTime.maxDistanceKm || 0)) {
          allTime.maxDistanceKm = set.distanceKm;
        }
        if (set.durationMinutes && set.durationMinutes > (allTime.maxDurationMins || 0)) {
          allTime.maxDurationMins = set.durationMinutes;
        }

        if (isThisMonth) {
          monthly.hasData = true;
          monthly.totalSets += 1;
          if (set.avgSpeedKmh && set.avgSpeedKmh > (monthly.maxSpeedKmh || 0)) monthly.maxSpeedKmh = set.avgSpeedKmh;
          if (set.distanceKm && set.distanceKm > (monthly.maxDistanceKm || 0)) monthly.maxDistanceKm = set.distanceKm;
          if (set.durationMinutes && set.durationMinutes > (monthly.maxDurationMins || 0)) monthly.maxDurationMins = set.durationMinutes;
        }

        if (isThisWeek) {
          weekly.hasData = true;
          weekly.totalSets += 1;
          if (set.avgSpeedKmh && set.avgSpeedKmh > (weekly.maxSpeedKmh || 0)) weekly.maxSpeedKmh = set.avgSpeedKmh;
          if (set.distanceKm && set.distanceKm > (weekly.maxDistanceKm || 0)) weekly.maxDistanceKm = set.distanceKm;
          if (set.durationMinutes && set.durationMinutes > (weekly.maxDurationMins || 0)) weekly.maxDurationMins = set.durationMinutes;
        }
      }
    });
  });

  return {
    exerciseName: exercise.name,
    category: detectedCategory,
    equipment: detectedEquipment,
    isCardio,
    weekly,
    monthly,
    allTime,
    sessionHistory: matchingSessions,
  };
};

export const ExercisePRDetailModal: React.FC<ExercisePRDetailModalProps> = ({
  visible,
  onClose,
  exercise,
  workouts,
}) => {
  const insets = useSafeAreaInsets();

  const stats = useMemo(() => {
    if (!exercise) return null;
    return calculateExercisePRStats(exercise, workouts);
  }, [exercise, workouts]);

  if (!exercise || !stats) return null;

  const catColor = (COLORS.category as Record<string, string>)[stats.category] || COLORS.primary;
  const peak1RM = stats.allTime.estimated1RM || (stats.allTime.maxWeight ? Math.round(stats.allTime.maxWeight * 1.05) : 0);

  // Tahmini Rep Tablosu (1RM - 12RM)
  const repMaxTable = [
    { reps: '1RM', pct: '100%', weight: peak1RM },
    { reps: '2RM', pct: '95%', weight: Math.round(peak1RM * 0.95) },
    { reps: '3RM', pct: '93%', weight: Math.round(peak1RM * 0.93) },
    { reps: '5RM', pct: '87%', weight: Math.round(peak1RM * 0.87) },
    { reps: '8RM', pct: '80%', weight: Math.round(peak1RM * 0.80) },
    { reps: '10RM', pct: '75%', weight: Math.round(peak1RM * 0.75) },
    { reps: '12RM', pct: '70%', weight: Math.round(peak1RM * 0.70) },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.titleRow}>
              <Text style={styles.headerTitle} numberOfLines={1}>{stats.exerciseName}</Text>
            </View>
            <View style={styles.badgesRow}>
              <View style={[styles.catBadge, { backgroundColor: catColor + '18' }]}>
                <Text style={[styles.catBadgeText, { color: catColor }]}>{stats.category}</Text>
              </View>
              <View style={styles.equipmentBadge}>
                <Text style={styles.equipmentBadgeText}>{stats.equipment}</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close-circle" size={28} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 16) + 60 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* ÜÇ ANA ANALİZ PENCERESİ (Bento Cards) */}
          <Text style={styles.sectionHeaderTitle}>Performans & Max Analiz Pencereleri</Text>

          {/* 1. TÜM ZAMANLAR ZİRVESİ (Highlight Card) */}
          <View style={[styles.windowCard, styles.windowCardAllTime]}>
            <View style={styles.windowCardHeader}>
              <View style={styles.windowHeaderLeft}>
                <View style={styles.windowIconBg}>
                  <Ionicons name="trophy-outline" size={16} color={COLORS.textPrimary} />
                </View>
                <View style={styles.windowTitleBox}>
                  <Text style={styles.windowTitle}>Tüm Zamanlar Rekoru</Text>
                  <Text style={styles.windowSubtitle}>Bu egzersizde kaydedilen en yüksek değer</Text>
                </View>
              </View>
              <View style={styles.goldBadge}>
                <Text style={styles.goldBadgeText}>ZİRVE</Text>
              </View>
            </View>

            {stats.allTime.hasData ? (
              <View style={styles.windowBody}>
                {!stats.isCardio ? (
                  <View style={styles.mainMetricsRow}>
                    <View style={styles.mainMetricCol}>
                      <Text style={styles.mainMetricVal}>
                        {stats.allTime.maxWeight} <Text style={styles.unitText}>kg</Text>
                      </Text>
                      <Text style={styles.mainMetricSub}>{stats.allTime.maxReps} tekrar (Kişisel En İyi)</Text>
                    </View>

                    <View style={styles.dividerVertical} />

                    <View style={styles.mainMetricCol}>
                      <Text style={styles.mainMetricVal}>
                        {stats.allTime.estimated1RM} <Text style={styles.unitText}>kg</Text>
                      </Text>
                      <Text style={styles.mainMetricSub}>Tahmini 1RM (Tek Tekrar)</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.mainMetricsRow}>
                    <View style={styles.mainMetricCol}>
                      <Text style={styles.mainMetricVal}>
                        {stats.allTime.maxSpeedKmh} <Text style={styles.unitText}>km/h</Text>
                      </Text>
                      <Text style={styles.mainMetricSub}>Zirve Hız</Text>
                    </View>
                    <View style={styles.dividerVertical} />
                    <View style={styles.mainMetricCol}>
                      <Text style={styles.mainMetricVal}>
                        {stats.allTime.maxDistanceKm} <Text style={styles.unitText}>km</Text>
                      </Text>
                      <Text style={styles.mainMetricSub}>En Uzun Mesafe</Text>
                    </View>
                  </View>
                )}

                <View style={styles.windowFooterRow}>
                  <View style={styles.footerInfoItem}>
                    <Ionicons name="calendar-outline" size={13} color={COLORS.textMuted} />
                    <Text style={styles.footerInfoText}>
                      Rekor Tarihi: {stats.allTime.bestDate || 'Kayıtlı'}
                    </Text>
                  </View>
                  <View style={styles.footerInfoItem}>
                    <Ionicons name="barbell-outline" size={13} color={COLORS.textMuted} />
                    <Text style={styles.footerInfoText}>
                      {stats.allTime.totalSessions} Seans Yapıldı
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.noDataBox}>
                <Ionicons name="barbell-outline" size={24} color={COLORS.textMuted} />
                <Text style={styles.noDataText}>Bu egzersiz henüz hiçbir antrenmanda tamamlanmadı.</Text>
              </View>
            )}
          </View>

          {/* 2. BU AYKİ MAX PENCERESİ */}
          <View style={styles.windowCard}>
            <View style={styles.windowCardHeader}>
              <View style={styles.windowHeaderLeft}>
                <View style={styles.windowIconBg}>
                  <Ionicons name="calendar-outline" size={16} color={COLORS.textPrimary} />
                </View>
                <View style={styles.windowTitleBox}>
                  <Text style={styles.windowTitle}>Bu Ayki Max (Son 30 Gün)</Text>
                  <Text style={styles.windowSubtitle}>Son 30 günlük güç ve yoğunluk tepe noktası</Text>
                </View>
              </View>
              {stats.monthly.hasData && stats.allTime.hasData && stats.monthly.maxWeight >= stats.allTime.maxWeight && (
                <View style={styles.freshBadge}>
                  <Text style={styles.freshBadgeText}>AYIN REKORU</Text>
                </View>
              )}
            </View>

            {stats.monthly.hasData ? (
              <View style={styles.windowBody}>
                {!stats.isCardio ? (
                  <View style={styles.mainMetricsRow}>
                    <View style={styles.mainMetricCol}>
                      <Text style={styles.mainMetricVal}>
                        {stats.monthly.maxWeight} <Text style={styles.unitText}>kg</Text>
                      </Text>
                      <Text style={styles.mainMetricSub}>{stats.monthly.maxReps} tekrar ({stats.monthly.bestDate})</Text>
                    </View>

                    <View style={styles.dividerVertical} />

                    <View style={styles.mainMetricCol}>
                      <Text style={styles.mainMetricVal}>
                        {stats.monthly.estimated1RM} <Text style={styles.unitText}>kg</Text>
                      </Text>
                      <Text style={styles.mainMetricSub}>Bu Ayki Est. 1RM</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.mainMetricsRow}>
                    <View style={styles.mainMetricCol}>
                      <Text style={styles.mainMetricVal}>
                        {stats.monthly.maxSpeedKmh} <Text style={styles.unitText}>km/h</Text>
                      </Text>
                      <Text style={styles.mainMetricSub}>Aylık En Yüksek Hız</Text>
                    </View>
                    <View style={styles.dividerVertical} />
                    <View style={styles.mainMetricCol}>
                      <Text style={styles.mainMetricVal}>
                        {stats.monthly.maxDistanceKm} <Text style={styles.unitText}>km</Text>
                      </Text>
                      <Text style={styles.mainMetricSub}>Aylık Max Mesafe</Text>
                    </View>
                  </View>
                )}

                <View style={styles.windowFooterRow}>
                  <View style={styles.footerInfoItem}>
                    <Ionicons name="repeat-outline" size={13} color={COLORS.textMuted} />
                    <Text style={styles.footerInfoText}>
                      Bu Ay: {stats.monthly.sessionCount} Seans • {stats.monthly.totalSets} Set
                    </Text>
                  </View>
                  <View style={styles.footerInfoItem}>
                    <Ionicons name="cube-outline" size={13} color={COLORS.textMuted} />
                    <Text style={styles.footerInfoText}>
                      {stats.monthly.totalVolume >= 1000
                        ? `${(stats.monthly.totalVolume / 1000).toFixed(1)}k kg Hacim`
                        : `${stats.monthly.totalVolume} kg Hacim`}
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.noDataBox}>
                <Ionicons name="time-outline" size={22} color={COLORS.textMuted} />
                <Text style={styles.noDataText}>Son 30 günde bu egzersiz uygulanmadı.</Text>
              </View>
            )}
          </View>

          {/* 3. BU HAFTAKİ MAX PENCERESİ */}
          <View style={styles.windowCard}>
            <View style={styles.windowCardHeader}>
              <View style={styles.windowHeaderLeft}>
                <View style={styles.windowIconBg}>
                  <Ionicons name="flash-outline" size={16} color={COLORS.textPrimary} />
                </View>
                <View style={styles.windowTitleBox}>
                  <Text style={styles.windowTitle}>Bu Haftaki Max (Son 7 Gün)</Text>
                  <Text style={styles.windowSubtitle}>Güncel haftalık antrenman performansı</Text>
                </View>
              </View>
              {stats.weekly.hasData && (
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>BU HAFTA</Text>
                </View>
              )}
            </View>

            {stats.weekly.hasData ? (
              <View style={styles.windowBody}>
                {!stats.isCardio ? (
                  <View style={styles.mainMetricsRow}>
                    <View style={styles.mainMetricCol}>
                      <Text style={styles.mainMetricVal}>
                        {stats.weekly.maxWeight} <Text style={styles.unitText}>kg</Text>
                      </Text>
                      <Text style={styles.mainMetricSub}>{stats.weekly.maxReps} tekrar ({stats.weekly.bestDate})</Text>
                    </View>

                    <View style={styles.dividerVertical} />

                    <View style={styles.mainMetricCol}>
                      <Text style={styles.mainMetricVal}>
                        {stats.weekly.estimated1RM} <Text style={styles.unitText}>kg</Text>
                      </Text>
                      <Text style={styles.mainMetricSub}>Haftalık Est. 1RM</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.mainMetricsRow}>
                    <View style={styles.mainMetricCol}>
                      <Text style={styles.mainMetricVal}>
                        {stats.weekly.maxSpeedKmh} <Text style={styles.unitText}>km/h</Text>
                      </Text>
                      <Text style={styles.mainMetricSub}>Haftalık Hız</Text>
                    </View>
                    <View style={styles.dividerVertical} />
                    <View style={styles.mainMetricCol}>
                      <Text style={styles.mainMetricVal}>
                        {stats.weekly.maxDistanceKm} <Text style={styles.unitText}>km</Text>
                      </Text>
                      <Text style={styles.mainMetricSub}>Haftalık Mesafe</Text>
                    </View>
                  </View>
                )}

                <View style={styles.windowFooterRow}>
                  <View style={styles.footerInfoItem}>
                    <Ionicons name="checkmark-circle-outline" size={13} color="#10B981" />
                    <Text style={[styles.footerInfoText, { color: '#10B981', fontWeight: '600' }]}>
                      Bu Hafta: {stats.weekly.totalSets} Set Tamamlandı
                    </Text>
                  </View>
                  <View style={styles.footerInfoItem}>
                    <Ionicons name="cube-outline" size={13} color={COLORS.textMuted} />
                    <Text style={styles.footerInfoText}>
                      {stats.weekly.totalVolume} kg Hacim
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.noDataBox}>
                <Ionicons name="time-outline" size={22} color={COLORS.textMuted} />
                <Text style={styles.noDataText}>Bu hafta henüz bu hareket çalışılmadı.</Text>
              </View>
            )}
          </View>

          {/* 4. TAHMİNİ TEKRAR MAKSİMUM TABLOSU (Rep Max Projeksiyonu) */}
          {!stats.isCardio && peak1RM > 0 && (
            <View style={styles.repTableCard}>
              <View style={styles.repTableHeader}>
                <View style={styles.repTitleRow}>
                  <Ionicons name="calculator-outline" size={18} color={COLORS.textPrimary} />
                  <Text style={styles.repTableTitle}>Hedef Tekrar Maksimumları (Rep Max Projeksiyonu)</Text>
                </View>
                <Text style={styles.repTableSub}>Zirve 1RM ({peak1RM} kg) baz alınarak hesaplanan ağırlıklar</Text>
              </View>

              <View style={styles.repGrid}>
                {repMaxTable.map(item => (
                  <View key={item.reps} style={styles.repGridCell}>
                    <Text style={styles.repCellLabel}>{item.reps}</Text>
                    <Text style={styles.repCellWeight}>{item.weight} kg</Text>
                    <Text style={styles.repCellPct}>{item.pct}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* 5. SEANS BAZLI GELİŞİM GEÇMİŞİ (Timeline) */}
          <View style={styles.historySection}>
            <View style={styles.historyHeader}>
              <Ionicons name="timer-outline" size={18} color={COLORS.textPrimary} />
              <Text style={styles.historyTitle}>Seans Bazlı Geçmiş ({stats.sessionHistory.length})</Text>
            </View>

            {stats.sessionHistory.length > 0 ? (
              <View style={styles.sessionList}>
                {stats.sessionHistory.map((s, idx) => (
                  <View key={`${s.workoutId}_${idx}`} style={styles.sessionCard}>
                    <View style={styles.sessionCardTop}>
                      <View style={styles.sessionCardTitleBox}>
                        <Text style={styles.sessionDateText}>{s.date}</Text>
                        <Text style={styles.sessionWorkoutNameText} numberOfLines={1}>
                          {s.workoutName || 'Antrenman Seansı'}
                        </Text>
                      </View>

                      {s.sessionMaxWeight > 0 && !stats.isCardio ? (
                        <View style={styles.sessionPill}>
                          <Text style={styles.sessionPillLabel}>MAX</Text>
                          <Text style={styles.sessionPillVal}>
                            {s.sessionMaxWeight} kg{s.sessionMax1RM > 0 ? ` • 1RM ${s.sessionMax1RM}k` : ''}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Sets Grid */}
                    <View style={styles.setsWrap}>
                      {s.sets.map((set, sIdx) => (
                        <View key={sIdx} style={styles.setChip}>
                          <Text style={styles.setChipNum}>Set {set.setNumber}</Text>
                          {!stats.isCardio ? (
                            <Text style={styles.setChipVal}>
                              {set.weight} kg × {set.reps}
                            </Text>
                          ) : (
                            <Text style={styles.setChipVal}>
                              {set.avgSpeedKmh ? `${set.avgSpeedKmh}km/h ` : ''}
                              {set.distanceKm ? `${set.distanceKm}km ` : ''}
                              {set.durationMinutes ? `${set.durationMinutes}dk` : ''}
                            </Text>
                          )}
                          {set.rir !== undefined && (
                            <Text style={styles.setChipRir}>RIR {set.rir}</Text>
                          )}
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyHistoryBox}>
                <Ionicons name="barbell-outline" size={32} color={COLORS.textMuted} />
                <Text style={styles.emptyHistoryText}>Henüz kayıtlı geçmiş seans bulunmuyor.</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  headerLeft: {
    flex: 1,
    paddingRight: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  catBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
  },
  catBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  equipmentBadge: {
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
  },
  equipmentBadgeText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  sectionHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.2,
    marginTop: 4,
  },
  windowCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.soft,
  },
  windowCardAllTime: {
    borderColor: COLORS.primary,
    borderWidth: 1,
    backgroundColor: COLORS.surface,
  },
  windowCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  windowHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  windowIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  windowTitleBox: {
    flex: 1,
    minWidth: 0,
  },
  windowTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  windowSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  goldBadge: {
    backgroundColor: COLORS.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  goldBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  freshBadge: {
    backgroundColor: COLORS.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  freshBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  activeBadge: {
    backgroundColor: COLORS.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  windowBody: {
    paddingTop: 14,
    gap: 12,
  },
  mainMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 4,
  },
  mainMetricCol: {
    alignItems: 'center',
    flex: 1,
  },
  mainMetricVal: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  unitText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  mainMetricSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
    marginTop: 3,
  },
  dividerVertical: {
    width: 1,
    height: 36,
    backgroundColor: COLORS.border,
  },
  windowFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  footerInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  footerInfoText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  noDataBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 6,
  },
  noDataText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  repTableCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
    ...SHADOWS.soft,
  },
  repTableHeader: {
    gap: 2,
  },
  repTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  repTableTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  repTableSub: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  repGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  repGridCell: {
    flexBasis: '22%',
    flexGrow: 1,
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  repCellLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  repCellWeight: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.primary,
    marginTop: 2,
  },
  repCellPct: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '600',
    marginTop: 2,
  },
  historySection: {
    gap: 10,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  sessionList: {
    gap: 10,
  },
  sessionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  sessionCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sessionCardTitleBox: {
    flex: 1,
    minWidth: 0,
  },
  sessionDateText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  sessionWorkoutNameText: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  sessionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.surfaceSubtle,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexShrink: 0,
  },
  sessionPillLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
  },
  sessionPillVal: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  setsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  setChip: {
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    minWidth: 70,
  },
  setChipNum: {
    fontSize: 9,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  setChipVal: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 1,
  },
  setChipRir: {
    fontSize: 9,
    color: '#8B5CF6',
    fontWeight: '700',
    marginTop: 1,
  },
  emptyHistoryBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyHistoryText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
});
