import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  LayoutChangeEvent,
  Share,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Path,
  Circle,
  Line as SvgLine,
  Defs,
  LinearGradient,
  Stop,
  Text as SvgText,
  G,
} from 'react-native-svg';
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
      isWarmup?: boolean;
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
            isWarmup: s.isWarmup,
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

const MONTH_SHORT_TR = [
  'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz',
  'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara',
];

const MONTH_FULL_TR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

const formatSessionDateShort = (dateStr: string): string => {
  if (!dateStr) return '';
  const clean = dateStr.split('T')[0];
  const parts = clean.split('-');
  if (parts.length >= 3) {
    const day = parseInt(parts[2], 10);
    const mIdx = parseInt(parts[1], 10) - 1;
    const month = MONTH_SHORT_TR[mIdx] || parts[1];
    return `${day} ${month}`;
  }
  return dateStr;
};

const formatSessionDateFull = (dateStr: string): string => {
  if (!dateStr) return '';
  const clean = dateStr.split('T')[0];
  const parts = clean.split('-');
  if (parts.length >= 3) {
    const day = parseInt(parts[2], 10);
    const mIdx = parseInt(parts[1], 10) - 1;
    const month = MONTH_FULL_TR[mIdx] || parts[1];
    const year = parts[0];
    return `${day} ${month} ${year}`;
  }
  return dateStr;
};

interface ChartSessionItem {
  workoutId: string;
  workoutName: string;
  date: string;
  chartValue: number;
  sessionMaxWeight: number;
  sessionMax1RM: number;
  sessionVolume: number;
  repsAtMax: number;
  unit: string;
  metricLabel: string;
  isPeak: boolean;
}

export interface ForecastPoint {
  sessionIndex: number;
  step: number; // 1, 2, 3, 4
  date: string;
  dateShort: string;
  dateFull: string;
  expectedValue: number;
  lowerBound: number; // CL %97.5 alt sınır (min)
  upperBound: number; // CL %97.5 üst sınır (max)
  unit: string;
  daysFromNow: number;
}

export type ConfidenceLevel = 0.99 | 0.975;

// Aktif Güven Seviyesi: %99 (İleride 0.975'e dönülmek istenirse tek satırdan değiştirilebilir)
export const ACTIVE_CONFIDENCE_LEVEL: ConfidenceLevel = 0.99;

export interface RegressionStats {
  hasEnoughData: boolean;
  sessionCount: number;
  slope: number;
  intercept: number;
  rSquared: number;
  standardError: number;
  tCritical: number;
  confidenceLevel: ConfidenceLevel;
  alphaPct: string;
  clLabel: string;
  avgIntervalDays: number;
  futurePoints: ForecastPoint[];
  historicalFitted: number[];
}

/**
 * CL %99 (α = 0.01) veya CL %97.5 (α = 0.025) için
 * serbestlik derecesine (df = n - 2) göre Student-t kritik değeri tablosu.
 */
const getTCritical = (df: number, cl: ConfidenceLevel = ACTIVE_CONFIDENCE_LEVEL): number => {
  if (cl === 0.99) {
    // α = 0.01 (İki kuyruklu: %0.5 alt, %0.5 üst sınır, %99 Güven Düzeyi)
    if (df <= 1) return 63.657;
    if (df === 2) return 9.925;
    if (df === 3) return 5.841;
    if (df === 4) return 4.604;
    if (df === 5) return 4.032;
    if (df === 6) return 3.707;
    if (df === 7) return 3.499;
    if (df === 8) return 3.355;
    if (df === 9) return 3.250;
    if (df <= 14) return 2.977;
    if (df <= 20) return 2.845;
    if (df <= 30) return 2.750;
    return 2.576; // Z_0.005 standart normal asimptotu
  }

  // α = 0.025 (İki kuyruklu: %1.25 alt, %1.25 üst sınır, %97.5 Güven Düzeyi)
  if (df <= 1) return 25.452;
  if (df === 2) return 6.205;
  if (df === 3) return 4.177;
  if (df === 4) return 3.495;
  if (df === 5) return 3.163;
  if (df === 6) return 2.969;
  if (df === 7) return 2.841;
  if (df === 8) return 2.752;
  if (df === 9) return 2.685;
  if (df <= 14) return 2.510;
  if (df <= 20) return 2.423;
  if (df <= 30) return 2.360;
  return 2.241; // Z_0.0125 standart normal asimptotu
};

/**
 * Seans serisinde yapısal rejim kırılmasını (makine / makara oranı değişimi) tespit eder.
 * En güncel seanstan geriye doğru tarayarak kullanıcının şu anda aktif kullandığı
 * makine/istasyondaki başlangıç indeksini döndürür.
 * İzole deload (tek seanslık hafif çalışma) durumlarını korur, kalıcı makine değişimlerini yakalar.
 */
export const findMachineRegimeStartIndex = (sessions: ChartSessionItem[]): number => {
  const n = sessions.length;
  if (n < 3) return 0;

  for (let i = n - 1; i > 0; i--) {
    const prevW = sessions[i - 1].chartValue;
    const currW = sessions[i].chartValue;
    if (prevW <= 0) continue;

    const pct = (currW - prevW) / prevW;

    // Ani kırılma adayı: %35'ten fazla düşüş veya %60'tan fazla yükseliş
    if (pct < -0.35 || pct > 0.6) {
      // 1. Durum: İzole deload kontrolü (örn. 110kg -> 60kg deload -> 112.5kg dönüş)
      if (i >= 2) {
        const prevPrevW = sessions[i - 2].chartValue;
        if (prevPrevW > 0 && Math.abs(currW - prevPrevW) / prevPrevW < 0.20) {
          // Bir önceki seans sadece tek seferlik hafif bir deload imiş, makine değişimi değil
          continue;
        }
      }

      // 2. Durum: Kırılma sonrası seansların kalıcılığı kontrolü
      const subsequent = sessions.slice(i);
      const subAvg = subsequent.reduce((sum, s) => sum + s.chartValue, 0) / subsequent.length;

      // Sonraki seansların ortalaması eski seviyeden belirgin şekilde farklı olmalı
      if (Math.abs(subAvg - prevW) / prevW >= 0.25) {
        // Ve sonraki seansların hiçbiri eski seviyeye geri sıçramamış olmalı
        const bouncedBack = subsequent.some(s => Math.abs(s.chartValue - prevW) / prevW < 0.15);
        if (!bouncedBack) {
          return i; // Aktif makine rejiminin başlangıcı
        }
      }
    }
  }

  return 0; // Kırılma yok, tüm geçmiş tek bir tutarlı makinede
};

/**
 * Doğrusal Regresyon (OLS) ve Gelecek Tahminleri için İstatistiksel Güven Aralığı (CL %99 veya %97.5)
 * Makine / istasyon değişimlerini otomatik olarak tespit ederek aktif rejim üzerinde model oluşturur.
 */
export const calculateLinearRegressionForecast = (
  sessions: ChartSessionItem[],
  cl: ConfidenceLevel = ACTIVE_CONFIDENCE_LEVEL
): RegressionStats => {
  const n = sessions.length;
  const alphaPct = cl === 0.99 ? '0.01' : '0.025';
  const clLabel = cl === 0.99 ? 'CL %99 (α = 0.01)' : 'CL %97.5 (α = 0.025)';
  const defaultTCrit = cl === 0.99 ? 2.576 : 2.241;

  if (n < 3) {
    return {
      hasEnoughData: false,
      sessionCount: n,
      slope: 0,
      intercept: 0,
      rSquared: 0,
      standardError: 0,
      tCritical: defaultTCrit,
      confidenceLevel: cl,
      alphaPct,
      clLabel,
      avgIntervalDays: 5,
      futurePoints: [],
      historicalFitted: [],
    };
  }

  // Makine / istasyon değişimi gibi yapısal kırılmaları tespit et
  const regimeStart = findMachineRegimeStartIndex(sessions);
  const activeSessions = sessions.slice(regimeStart);
  const m = activeSessions.length;

  // Yeni makinede henüz en az 3 seans yoksa regresyon uydurulamaz (çarpık tahmin üretilmez)
  if (m < 3) {
    return {
      hasEnoughData: false,
      sessionCount: m,
      slope: 0,
      intercept: 0,
      rSquared: 0,
      standardError: 0,
      tCritical: defaultTCrit,
      confidenceLevel: cl,
      alphaPct,
      clLabel,
      avgIntervalDays: 5,
      futurePoints: [],
      historicalFitted: [],
    };
  }

  // x_i = seans sırası (0, 1, ..., m-1), y_i = o seansta ölçülen değer
  const xs = activeSessions.map((_, i) => i);
  const ys = activeSessions.map(s => s.chartValue);

  const meanX = (m - 1) / 2;
  const meanY = ys.reduce((sum, y) => sum + y, 0) / m;

  let ssXX = 0;
  let ssXY = 0;
  let ssTotal = 0;

  for (let i = 0; i < m; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    ssXX += dx * dx;
    ssXY += dx * dy;
    ssTotal += dy * dy;
  }

  if (ssXX === 0) ssXX = 1;

  const slope = ssXY / ssXX;
  const intercept = meanY - slope * meanX;

  const historicalFitted: number[] = [];
  let sse = 0;
  for (let i = 0; i < m; i++) {
    const fit = intercept + slope * i;
    historicalFitted.push(fit);
    sse += (ys[i] - fit) * (ys[i] - fit);
  }

  const df = m - 2;
  const s2 = sse / Math.max(df, 1);
  let se = Math.sqrt(s2);

  // Veriler tamamen düz çizgi olsa dahi sıfır aralık oluşmaması için makul minimum taban
  const minSe = Math.max(0.5, meanY * 0.015);
  if (se < minSe) se = minSe;

  const tCrit = getTCritical(df, cl);
  const rSquared = ssTotal > 0 ? Math.max(0, Math.min(1, 1 - sse / ssTotal)) : 1;

  // Seanslar arası ortalama gün aralığını geçmiş tarihlerden hesapla
  let totalTimeDiff = 0;
  let validIntervals = 0;
  for (let i = 1; i < m; i++) {
    const t1 = new Date(activeSessions[i - 1].date.split('T')[0]).getTime();
    const t2 = new Date(activeSessions[i].date.split('T')[0]).getTime();
    if (!isNaN(t1) && !isNaN(t2) && t2 >= t1) {
      totalTimeDiff += t2 - t1;
      validIntervals++;
    }
  }

  let avgIntervalDays = validIntervals > 0 ? totalTimeDiff / (validIntervals * 86400000) : 5;
  if (!avgIntervalDays || avgIntervalDays < 2 || avgIntervalDays > 21) {
    avgIntervalDays = 5; // Tipik egzersiz sıklığı ~5 gün
  }

  const lastDate = new Date(activeSessions[m - 1].date.split('T')[0]);
  const nowMs = !isNaN(lastDate.getTime()) ? lastDate.getTime() : Date.now();
  const unit = activeSessions[0]?.unit || 'kg';

  const futurePoints: ForecastPoint[] = [];
  const numForecast = 4; // Gelecek 4 seans projeksiyonu

  for (let step = 1; step <= numForecast; step++) {
    const futureX = m - 1 + step;
    const expected = intercept + slope * futureX;

    // Regresyon Projeksiyon Standart Hatası Formülü:
    // SE_pred = s_e * sqrt(1 + 1/m + (x_0 - meanX)^2 / ssXX)
    const leverage = ((futureX - meanX) * (futureX - meanX)) / ssXX;
    const sePred = se * Math.sqrt(1 + 1 / m + leverage);
    const marginOfError = tCrit * sePred;

    const lowerBound = Math.max(0, Math.round((expected - marginOfError) * 10) / 10);
    const upperBound = Math.round((expected + marginOfError) * 10) / 10;
    const expectedRounded = Math.max(0, Math.round(expected * 10) / 10);

    const daysFromNow = Math.round(step * avgIntervalDays);
    const futureDateMs = nowMs + daysFromNow * 86400000;
    const futureDateObj = new Date(futureDateMs);
    const dateStr = futureDateObj.toISOString().split('T')[0];

    futurePoints.push({
      sessionIndex: n - 1 + step,
      step,
      date: dateStr,
      dateShort: formatSessionDateShort(dateStr),
      dateFull: formatSessionDateFull(dateStr),
      expectedValue: expectedRounded,
      lowerBound,
      upperBound,
      unit,
      daysFromNow,
    });
  }

  return {
    hasEnoughData: true,
    sessionCount: n,
    slope: Math.round(slope * 10) / 10,
    intercept,
    rSquared: Math.round(rSquared * 100) / 100,
    standardError: Math.round(se * 10) / 10,
    tCritical: tCrit,
    confidenceLevel: cl,
    alphaPct,
    clLabel,
    avgIntervalDays: Math.round(avgIntervalDays),
    futurePoints,
    historicalFitted,
  };
};

/**
 * Seans Bazlı Maksimum Ağırlık / Performans Gelişim ve Regresyon Tahmin Çizgi Grafiği
 * Doğrusal regresyon ve ŷ ± %2.5 hedef güven bandı ile gelecek seans projeksiyonunu ve tüm geçmişi gösterir.
 */
const ExerciseProgressionChart: React.FC<{ stats: ExercisePRStats }> = ({ stats }) => {
  const [containerWidth, setContainerWidth] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'history' | 'prediction'>('history');
  const [selectedPredStep, setSelectedPredStep] = useState<number>(1); // 1 = 1. Gelecek seans
  const scrollViewRef = useRef<ScrollView>(null);
  const predScrollViewRef = useRef<ScrollView>(null);

  // 1. Kronolojik Seans Verilerini Hazırla (En eskiden en yeniye)
  const chartSessions = useMemo<ChartSessionItem[]>(() => {
    if (!stats || stats.sessionHistory.length === 0) return [];

    // Ters çevir: en eskiden en yeniye
    const chronological = [...stats.sessionHistory].reverse();

    // Aynı antrenmanda birden fazla kez geçtiyse en yüksek olanı al
    const sessionMap = new Map<string, (typeof chronological)[0]>();
    chronological.forEach(s => {
      const existing = sessionMap.get(s.workoutId);
      if (!existing) {
        sessionMap.set(s.workoutId, { ...s });
      } else {
        if (s.sessionMaxWeight > existing.sessionMaxWeight) {
          existing.sessionMaxWeight = s.sessionMaxWeight;
        }
        if (s.sessionMax1RM > existing.sessionMax1RM) {
          existing.sessionMax1RM = s.sessionMax1RM;
        }
        existing.sessionVolume += s.sessionVolume;
      }
    });

    const uniqueSessions = Array.from(sessionMap.values());

    if (stats.isCardio) {
      const items = uniqueSessions
        .map(s => {
          let maxSpeed = 0;
          let maxDist = 0;
          s.sets.forEach(st => {
            if (st.avgSpeedKmh && st.avgSpeedKmh > maxSpeed) maxSpeed = st.avgSpeedKmh;
            if (st.distanceKm && st.distanceKm > maxDist) maxDist = st.distanceKm;
          });
          const val = maxSpeed > 0 ? maxSpeed : maxDist;
          return {
            workoutId: s.workoutId,
            workoutName: s.workoutName,
            date: s.date,
            chartValue: val,
            sessionMaxWeight: 0,
            sessionMax1RM: 0,
            sessionVolume: 0,
            repsAtMax: 0,
            unit: maxSpeed > 0 ? 'km/h' : 'km',
            metricLabel: maxSpeed > 0 ? 'Maks Hız' : 'Mesafe',
            isPeak: false,
          };
        })
        .filter(s => s.chartValue > 0);

      const peakVal = items.reduce((max, it) => Math.max(max, it.chartValue), 0);
      return items.map(it => ({
        ...it,
        isPeak: peakVal > 0 && it.chartValue === peakVal,
      }));
    }

    // Ağırlık Antrenmanı
    const hasWeights = uniqueSessions.some(s => s.sessionMaxWeight > 0);

    if (hasWeights) {
      const items = uniqueSessions
        .map(s => {
          const maxSet = s.sets.find(st => st.weight === s.sessionMaxWeight);
          return {
            workoutId: s.workoutId,
            workoutName: s.workoutName,
            date: s.date,
            chartValue: s.sessionMaxWeight,
            sessionMaxWeight: s.sessionMaxWeight,
            sessionMax1RM: s.sessionMax1RM,
            sessionVolume: s.sessionVolume,
            repsAtMax: maxSet?.reps || 0,
            unit: 'kg',
            metricLabel: 'Maksimum Ağırlık',
            isPeak: false,
          };
        })
        .filter(s => s.chartValue > 0);

      const peakVal = items.reduce((max, it) => Math.max(max, it.chartValue), 0);
      return items.map(it => ({
        ...it,
        isPeak: peakVal > 0 && it.chartValue === peakVal,
      }));
    } else {
      // Vücut Ağırlığı (Maksimum Tekrar)
      const items = uniqueSessions
        .map(s => {
          let maxReps = 0;
          s.sets.forEach(st => {
            if (st.reps > maxReps) maxReps = st.reps;
          });
          return {
            workoutId: s.workoutId,
            workoutName: s.workoutName,
            date: s.date,
            chartValue: maxReps,
            sessionMaxWeight: 0,
            sessionMax1RM: 0,
            sessionVolume: 0,
            repsAtMax: maxReps,
            unit: 'tekrar',
            metricLabel: 'Maksimum Tekrar',
            isPeak: false,
          };
        })
        .filter(s => s.chartValue > 0);

      const peakVal = items.reduce((max, it) => Math.max(max, it.chartValue), 0);
      return items.map(it => ({
        ...it,
        isPeak: peakVal > 0 && it.chartValue === peakVal,
      }));
    }
  }, [stats]);

  // Regresyon ve %95 Güven Aralığı Hesaplama Motoru (α = 0.05)
  const regression = useMemo<RegressionStats>(() => {
    return calculateLinearRegressionForecast(chartSessions);
  }, [chartSessions]);

  // Seanslar yüklendiğinde varsayılan olarak en son seansı seç
  useEffect(() => {
    if (chartSessions.length > 0) {
      setSelectedIndex(chartSessions.length - 1);
    } else {
      setSelectedIndex(null);
    }
  }, [chartSessions]);

  // Seans sayısı fazlaysa sağa (en güncel seansa) kaydır
  useEffect(() => {
    if (activeTab === 'history' && chartSessions.length > 6 && scrollViewRef.current) {
      const timer = setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: false });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [chartSessions.length, containerWidth, activeTab]);

  // Tahmin sekmesi açıldığında veya veri değiştiğinde en sağa (güncel seans ve tahminlere) kaydır
  useEffect(() => {
    if (activeTab === 'prediction' && predScrollViewRef.current) {
      const timer = setTimeout(() => {
        predScrollViewRef.current?.scrollToEnd({ animated: false });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [chartSessions.length, containerWidth, activeTab]);

  if (chartSessions.length === 0) {
    return (
      <View style={styles.chartCard} onLayout={(e: LayoutChangeEvent) => setContainerWidth(e.nativeEvent.layout.width)}>
        <View style={styles.chartHeader}>
          <View style={styles.chartHeaderLeft}>
            <View style={styles.chartIconBox}>
              <Ionicons name="trending-up" size={18} color={COLORS.primary} />
            </View>
            <View>
              <Text style={styles.chartTitle}>Maksimum Ağırlık Gelişimi</Text>
              <Text style={styles.chartSubtitle}>Seanslar arası ağırlık grafiği</Text>
            </View>
          </View>
        </View>
        <View style={styles.chartEmptyBox}>
          <Ionicons name="analytics-outline" size={28} color={COLORS.textMuted} />
          <Text style={styles.chartEmptyTitle}>Henüz Ağırlık Kaydı Yok</Text>
          <Text style={styles.chartEmptyText}>
            Bu egzersizi tamamladığınız antrenmanlarda ağırlık girdikçe seanslar arası gelişim grafiğiniz burada çizilecektir.
          </Text>
        </View>
      </View>
    );
  }

  const firstSession = chartSessions[0];
  const latestSession = chartSessions[chartSessions.length - 1];
  const deltaValue = firstSession && latestSession ? latestSession.chartValue - firstSession.chartValue : 0;
  const deltaPct =
    firstSession && firstSession.chartValue > 0
      ? Math.round((deltaValue / firstSession.chartValue) * 100)
      : null;

  const activeIndex =
    selectedIndex !== null && selectedIndex >= 0 && selectedIndex < chartSessions.length
      ? selectedIndex
      : chartSessions.length - 1;
  const selectedSession = chartSessions[activeIndex];

  const chartTitle = stats.isCardio
    ? 'Performans Gelişimi'
    : stats.sessionHistory.some(s => s.sessionMaxWeight > 0)
    ? 'Maksimum Ağırlık Gelişimi'
    : 'Maksimum Tekrar Gelişimi';

  const chartSubtitle = stats.isCardio
    ? 'Seanslara göre en yüksek hız / mesafe'
    : stats.sessionHistory.some(s => s.sessionMaxWeight > 0)
    ? 'Farklı seanslarda kaldırılan en yüksek ağırlık (kg)'
    : 'Farklı seanslarda yapılan en yüksek tekrar';

  // Ortak Grafik Geometrisi
  const chartHeight = 180;
  const paddingTop = 26;
  const paddingBottom = 34;
  const paddingLeft = 38;
  const paddingRight = 24;
  const plotHeight = chartHeight - paddingTop - paddingBottom;
  const innerCardWidth = containerWidth > 0 ? containerWidth - 32 : 320;

  // 1. GEÇMİŞ GELİŞİM GRAFİĞİ KOORDİNATLARI
  const minPointSpacing = 54;
  const scrollableWidth = Math.max(
    innerCardWidth,
    chartSessions.length * minPointSpacing + paddingLeft + paddingRight
  );
  const plotWidth = scrollableWidth - paddingLeft - paddingRight;

  const values = chartSessions.map(s => s.chartValue);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);

  let minVal: number;
  let maxVal: number;

  if (rawMin === rawMax) {
    if (rawMin === 0) {
      minVal = 0;
      maxVal = 10;
    } else {
      minVal = Math.max(0, Math.floor(rawMin * 0.8));
      maxVal = Math.ceil(rawMax * 1.2);
    }
  } else {
    const range = rawMax - rawMin;
    minVal = Math.max(0, Math.floor(rawMin - range * 0.15));
    maxVal = Math.ceil(rawMax + range * 0.18);
  }

  const valRange = maxVal - minVal || 1;

  const guidelines = [
    { value: maxVal, label: `${maxVal}` },
    { value: Math.round((minVal + maxVal) / 2), label: `${Math.round((minVal + maxVal) / 2)}` },
    { value: minVal, label: `${minVal}` },
  ];

  const historyPoints = chartSessions.map((session, idx) => {
    let x: number;
    if (chartSessions.length === 1) {
      x = paddingLeft + plotWidth / 2;
    } else {
      x = paddingLeft + (idx / (chartSessions.length - 1)) * plotWidth;
    }
    const y = chartHeight - paddingBottom - ((session.chartValue - minVal) / valRange) * plotHeight;
    return { x, y, session, idx };
  });

  let historyPathD = '';
  let historyAreaD = '';

  if (historyPoints.length >= 2) {
    historyPathD = `M ${historyPoints[0].x} ${historyPoints[0].y}`;
    for (let i = 0; i < historyPoints.length - 1; i++) {
      const p0 = historyPoints[i];
      const p1 = historyPoints[i + 1];
      const cpx = p0.x + (p1.x - p0.x) / 2;
      historyPathD += ` C ${cpx} ${p0.y}, ${cpx} ${p1.y}, ${p1.x} ${p1.y}`;
    }
    historyAreaD = `${historyPathD} L ${historyPoints[historyPoints.length - 1].x} ${
      chartHeight - paddingBottom
    } L ${historyPoints[0].x} ${chartHeight - paddingBottom} Z`;
  }

  // 2. GELECEK REGRESYON & GÜVEN BANDI GRAFİĞİ KOORDİNATLARI
  // Geçmiş TÜM seansları bağlam olarak göster ve gelecek projeksiyonları ekle
  const allHistorySessions = chartSessions;
  const futurePointsList = regression.futurePoints;

  const allPredVals = [
    ...allHistorySessions.map(s => s.chartValue),
    ...futurePointsList.map(f => f.lowerBound),
    ...futurePointsList.map(f => f.upperBound),
    ...futurePointsList.map(f => f.expectedValue),
  ];

  const rawPredMin = allPredVals.length > 0 ? Math.min(...allPredVals) : 0;
  const rawPredMax = allPredVals.length > 0 ? Math.max(...allPredVals) : 100;
  const predRange = rawPredMax - rawPredMin || 1;
  const predMinVal = Math.max(0, Math.floor(rawPredMin - predRange * 0.12));
  const predMaxVal = Math.ceil(rawPredMax + predRange * 0.18);
  const predValRange = predMaxVal - predMinVal || 1;

  const predGuidelines = [
    { value: predMaxVal, label: `${predMaxVal}` },
    { value: Math.round((predMinVal + predMaxVal) / 2), label: `${Math.round((predMinVal + predMaxVal) / 2)}` },
    { value: predMinVal, label: `${predMinVal}` },
  ];

  const totalPredPointsCount = allHistorySessions.length + futurePointsList.length;
  const predScrollableWidth = Math.max(
    innerCardWidth,
    totalPredPointsCount * minPointSpacing + paddingLeft + paddingRight
  );
  const predPlotWidth = predScrollableWidth - paddingLeft - paddingRight;
  const predStepX = totalPredPointsCount > 1 ? predPlotWidth / (totalPredPointsCount - 1) : predPlotWidth;

  // Geçmiş seans noktaları (tüm geçmiş seanslar)
  const predContextPoints = allHistorySessions.map((session, idx) => {
    const x = paddingLeft + idx * predStepX;
    const y = chartHeight - paddingBottom - ((session.chartValue - predMinVal) / predValRange) * plotHeight;
    return { x, y, session, idx };
  });

  const todayPoint = predContextPoints[predContextPoints.length - 1];

  // Gelecek tahmin noktaları
  const predFuturePoints = futurePointsList.map((fp, fIdx) => {
    const x = paddingLeft + (allHistorySessions.length - 1 + fp.step) * predStepX;
    const yExpected = chartHeight - paddingBottom - ((fp.expectedValue - predMinVal) / predValRange) * plotHeight;
    const yLower = chartHeight - paddingBottom - ((fp.lowerBound - predMinVal) / predValRange) * plotHeight;
    const yUpper = chartHeight - paddingBottom - ((fp.upperBound - predMinVal) / predValRange) * plotHeight;
    return { x, yExpected, yLower, yUpper, fp, step: fp.step };
  });

  // Güven bandı hunisi (Confidence Band Polygon)
  let confidenceFunnelD = '';
  let upperDashedD = '';
  let lowerDashedD = '';
  let trendDashedD = '';

  if (todayPoint && predFuturePoints.length > 0) {
    // Üst sınır yolu
    upperDashedD = `M ${todayPoint.x} ${todayPoint.y}`;
    predFuturePoints.forEach(p => {
      upperDashedD += ` L ${p.x} ${p.yUpper}`;
    });

    // Alt sınır yolu
    lowerDashedD = `M ${todayPoint.x} ${todayPoint.y}`;
    predFuturePoints.forEach(p => {
      lowerDashedD += ` L ${p.x} ${p.yLower}`;
    });

    // Kapalı poligon (Huni Dolgusu)
    let funnelPath = `M ${todayPoint.x} ${todayPoint.y}`;
    for (let i = 0; i < predFuturePoints.length; i++) {
      funnelPath += ` L ${predFuturePoints[i].x} ${predFuturePoints[i].yUpper}`;
    }
    for (let i = predFuturePoints.length - 1; i >= 0; i--) {
      funnelPath += ` L ${predFuturePoints[i].x} ${predFuturePoints[i].yLower}`;
    }
    funnelPath += ` L ${todayPoint.x} ${todayPoint.y} Z`;
    confidenceFunnelD = funnelPath;

    // Merkez regresyon trend çizgisi
    trendDashedD = `M ${todayPoint.x} ${todayPoint.y}`;
    predFuturePoints.forEach(p => {
      trendDashedD += ` L ${p.x} ${p.yExpected}`;
    });
  }

  // Geçmiş seanslar çizgisi & alan dolgusu (Bezier)
  let predHistoryLineD = '';
  let predHistoryAreaD = '';
  if (predContextPoints.length >= 2) {
    predHistoryLineD = `M ${predContextPoints[0].x} ${predContextPoints[0].y}`;
    for (let i = 0; i < predContextPoints.length - 1; i++) {
      const p0 = predContextPoints[i];
      const p1 = predContextPoints[i + 1];
      const cpx = p0.x + (p1.x - p0.x) / 2;
      predHistoryLineD += ` C ${cpx} ${p0.y}, ${cpx} ${p1.y}, ${p1.x} ${p1.y}`;
    }
    predHistoryAreaD = `${predHistoryLineD} L ${predContextPoints[predContextPoints.length - 1].x} ${
      chartHeight - paddingBottom
    } L ${predContextPoints[0].x} ${chartHeight - paddingBottom} Z`;
  }

  const selectedForecastPoint = futurePointsList.find(f => f.step === selectedPredStep) || futurePointsList[0];

  return (
    <View
      style={styles.chartCard}
      onLayout={(e: LayoutChangeEvent) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {/* Kart Başlığı & Çift Modlu Sekme Seçici */}
      <View style={styles.chartHeader}>
        <View style={styles.chartHeaderLeft}>
          <View
            style={[
              styles.chartIconBox,
              activeTab === 'prediction' && { backgroundColor: 'rgba(139, 92, 246, 0.15)' },
            ]}
          >
            <Ionicons
              name={activeTab === 'prediction' ? 'analytics' : 'trending-up'}
              size={18}
              color={activeTab === 'prediction' ? '#8B5CF6' : COLORS.primary}
            />
          </View>
          <View style={styles.chartTitleWrapper}>
            <Text style={styles.chartTitle}>
              {activeTab === 'prediction' ? 'Gelecek Performans Tahmini' : chartTitle}
            </Text>
            <Text style={styles.chartSubtitle}>
              {activeTab === 'prediction'
                ? `Lineer Regresyon • ${regression.clLabel}`
                : chartSubtitle}
            </Text>
          </View>
        </View>

        {/* Sekme Değiştirici Butonlar (Geçmiş / Tahmin) */}
        <View style={styles.tabToggleBox}>
          <TouchableOpacity
            style={[styles.tabToggleBtn, activeTab === 'history' && styles.tabToggleBtnActive]}
            onPress={() => setActiveTab('history')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="trending-up"
              size={12}
              color={activeTab === 'history' ? COLORS.primaryDarker : COLORS.textMuted}
            />
            <Text
              style={[
                styles.tabToggleText,
                activeTab === 'history' && styles.tabToggleTextActive,
              ]}
            >
              Geçmiş
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabToggleBtn,
              activeTab === 'prediction' && styles.tabToggleBtnActivePurple,
            ]}
            onPress={() => setActiveTab('prediction')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="analytics"
              size={12}
              color={activeTab === 'prediction' ? '#FFFFFF' : '#8B5CF6'}
            />
            <Text
              style={[
                styles.tabToggleText,
                activeTab === 'prediction' && styles.tabToggleTextActivePurple,
              ]}
            >
              Tahmin
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ======================= MOD 1: GEÇMİŞ GELİŞİM ======================= */}
      {activeTab === 'history' && (
        <>
          {/* İnteraktif Seçili Seans Detay Kartı */}
          {selectedSession && (
            <View style={styles.chartDetailCard}>
              <View style={styles.chartDetailLeft}>
                <View style={styles.chartDetailDateRow}>
                  <Ionicons name="calendar-outline" size={13} color={COLORS.textMuted} />
                  <Text style={styles.chartDetailDateText}>
                    {formatSessionDateFull(selectedSession.date)}
                  </Text>
                  {selectedSession.isPeak && (
                    <View style={styles.chartPeakBadge}>
                      <Ionicons name="trophy" size={10} color="#F59E0B" />
                      <Text style={styles.chartPeakBadgeText}>ZİRVE</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.chartDetailWorkoutText} numberOfLines={1}>
                  {selectedSession.workoutName || 'Antrenman Seansı'}
                </Text>
              </View>

              <View style={styles.chartDetailRight}>
                <View style={styles.chartDetailValueRow}>
                  <Text style={styles.chartDetailValue}>{selectedSession.chartValue}</Text>
                  <Text style={styles.chartDetailUnit}>{selectedSession.unit}</Text>
                </View>
                <Text style={styles.chartDetailSub}>
                  {!stats.isCardio && selectedSession.repsAtMax > 0
                    ? `${selectedSession.repsAtMax} tekrar • 1RM ~${selectedSession.sessionMax1RM}k`
                    : selectedSession.metricLabel}
                </Text>
              </View>
            </View>
          )}

          {/* 1 Seans Varsa Bilgilendirme Notu */}
          {chartSessions.length === 1 && (
            <View style={styles.singleSessionNotice}>
              <Ionicons name="information-circle-outline" size={15} color={COLORS.primary} />
              <Text style={styles.singleSessionNoticeText}>
                İlk seansınız kaydedildi ({chartSessions[0].chartValue} {chartSessions[0].unit}). Gelişim trendinizi görmek için bir seans daha tamamlayın!
              </Text>
            </View>
          )}

          {/* Çoklu Seans Kaydırma İpucu */}
          {chartSessions.length > 6 && (
            <View style={styles.scrollHintRow}>
              <Ionicons name="swap-horizontal" size={13} color={COLORS.textMuted} />
              <Text style={styles.scrollHintText}>
                Tüm seansları görmek için grafiği kaydırın ({chartSessions.length} seans)
              </Text>
            </View>
          )}

          {/* SVG Çizgi Grafiği */}
          <ScrollView
            ref={scrollViewRef}
            horizontal
            showsHorizontalScrollIndicator={chartSessions.length > 6}
            contentContainerStyle={{ minWidth: innerCardWidth }}
            style={styles.chartScrollArea}
          >
            <View style={{ width: scrollableWidth, height: chartHeight }}>
              <Svg width={scrollableWidth} height={chartHeight}>
                <Defs>
                  <LinearGradient id="weightChartGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor={COLORS.primary} stopOpacity="0.32" />
                    <Stop offset="80%" stopColor={COLORS.primary} stopOpacity="0.04" />
                    <Stop offset="100%" stopColor={COLORS.primary} stopOpacity="0.0" />
                  </LinearGradient>
                </Defs>

                {/* Yatay Kılavuz Çizgileri ve Y-Ekseni Değerleri */}
                {guidelines.map((g, gIdx) => {
                  const gy = chartHeight - paddingBottom - ((g.value - minVal) / valRange) * plotHeight;
                  return (
                    <G key={gIdx}>
                      <SvgLine
                        x1={paddingLeft}
                        y1={gy}
                        x2={scrollableWidth - paddingRight}
                        y2={gy}
                        stroke={COLORS.border}
                        strokeDasharray="4 4"
                        strokeWidth={1}
                        opacity={0.6}
                      />
                      <SvgText
                        x={paddingLeft - 6}
                        y={gy + 3.5}
                        textAnchor="end"
                        fontSize="9"
                        fill={COLORS.textMuted}
                        fontWeight="600"
                      >
                        {g.label}
                      </SvgText>
                    </G>
                  );
                })}

                {/* Tek Seans Varsa Referans Çizgisi */}
                {historyPoints.length === 1 && (
                  <SvgLine
                    x1={paddingLeft}
                    y1={historyPoints[0].y}
                    x2={scrollableWidth - paddingRight}
                    y2={historyPoints[0].y}
                    stroke={COLORS.primary}
                    strokeDasharray="6 4"
                    strokeWidth={1.5}
                    opacity={0.4}
                  />
                )}

                {/* Çizgi Grafiği & Alan Dolgusu (>= 2 nokta) */}
                {historyPoints.length >= 2 && (
                  <>
                    <Path d={historyAreaD} fill="url(#weightChartGrad)" />
                    <Path
                      d={historyPathD}
                      stroke={COLORS.primary}
                      strokeWidth={3}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </>
                )}

                {/* Veri Noktaları */}
                {historyPoints.map(pt => {
                  const isSelected = activeIndex === pt.idx;
                  const isPeak = pt.session.isPeak;

                  return (
                    <G key={pt.idx}>
                      {isSelected && (
                        <SvgLine
                          x1={pt.x}
                          y1={paddingTop - 4}
                          x2={pt.x}
                          y2={chartHeight - paddingBottom}
                          stroke={COLORS.primary}
                          strokeWidth={1.5}
                          strokeDasharray="3 3"
                          opacity={0.75}
                        />
                      )}

                      {isSelected && (
                        <Circle
                          cx={pt.x}
                          cy={pt.y}
                          r={11}
                          fill={COLORS.primary}
                          opacity={0.22}
                        />
                      )}

                      <Circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isSelected ? 6.5 : isPeak ? 6 : 4.5}
                        fill={isPeak ? '#F59E0B' : COLORS.primary}
                        stroke={COLORS.surface}
                        strokeWidth={2}
                      />

                      {isSelected && (
                        <Circle
                          cx={pt.x}
                          cy={pt.y}
                          r={2.5}
                          fill={COLORS.surface}
                        />
                      )}

                      {(historyPoints.length <= 6 || isSelected || isPeak) && (
                        <SvgText
                          x={pt.x}
                          y={pt.y - (isSelected ? 13 : 9)}
                          textAnchor="middle"
                          fontSize={isSelected ? 11 : 9.5}
                          fontWeight={isSelected ? '900' : '700'}
                          fill={isPeak ? '#F59E0B' : isSelected ? COLORS.primary : COLORS.textPrimary}
                        >
                          {pt.session.chartValue}
                        </SvgText>
                      )}

                      <SvgText
                        x={pt.x}
                        y={chartHeight - paddingBottom + 16}
                        textAnchor="middle"
                        fontSize={10}
                        fontWeight={isSelected ? '800' : '600'}
                        fill={isSelected ? COLORS.primary : COLORS.textMuted}
                      >
                        {formatSessionDateShort(pt.session.date)}
                      </SvgText>
                    </G>
                  );
                })}
              </Svg>

              {/* Dokunma ve Seçim Katmanı */}
              <View style={[StyleSheet.absoluteFill, { width: scrollableWidth, height: chartHeight }]}>
                {historyPoints.map(pt => {
                  const colW =
                    historyPoints.length > 1
                      ? Math.max(plotWidth / (historyPoints.length - 1), 40)
                      : scrollableWidth;
                  return (
                    <TouchableOpacity
                      key={pt.idx}
                      activeOpacity={0.7}
                      onPress={() => setSelectedIndex(pt.idx)}
                      style={{
                        position: 'absolute',
                        left: pt.x - colW / 2,
                        top: 0,
                        width: colW,
                        height: chartHeight,
                      }}
                    />
                  );
                })}
              </View>
            </View>
          </ScrollView>
        </>
      )}

      {/* ======================= MOD 2: GELECEK REGRESYON & GÜVEN ARALIĞI ======================= */}
      {activeTab === 'prediction' && (
        <>
          {!regression.hasEnoughData ? (
            <View style={styles.predEmptyCard}>
              <View style={styles.predEmptyIconBox}>
                <Ionicons name="analytics-outline" size={30} color="#8B5CF6" />
              </View>
              <Text style={styles.predEmptyTitle}>Gelecek Tahmini İçin Veri Bekleniyor</Text>
              <Text style={styles.predEmptyText}>
                {`Doğrusal regresyon ve ${regression.clLabel} istatistiksel projeksiyonu için bu egzersizde en az 3 tamamlanmış seans gereklidir.`}
              </Text>
              <View style={styles.predEmptyPill}>
                <Text style={styles.predEmptyPillText}>
                  Mevcut Veri: {chartSessions.length} / 3 Seans
                </Text>
              </View>
            </View>
          ) : (
            <>
              {/* Seçili Gelecek Tahmini Detay Kartı */}
              {selectedForecastPoint && (
                <View style={styles.predDetailCard}>
                  {/* Üst Satır: Seans Rozeti, Tarih ve Gün Farkı */}
                  <View style={styles.predDetailTop}>
                    <View style={styles.predDetailLeft}>
                      <View style={styles.predTargetPill}>
                        <Ionicons name="analytics-outline" size={11} color="#8B5CF6" />
                        <Text style={styles.predTargetPillText}>
                          +{selectedForecastPoint.step}. Seans Projeksiyonu
                        </Text>
                      </View>
                      <Text style={styles.predDateText} numberOfLines={1}>
                        {selectedForecastPoint.dateFull}
                      </Text>
                    </View>

                    <View style={styles.predDaysPill}>
                      <Ionicons name="time-outline" size={12} color={COLORS.textMuted} />
                      <Text style={styles.predDaysText}>
                        ~{selectedForecastPoint.daysFromNow} gün sonra
                      </Text>
                    </View>
                  </View>

                  {/* 3 Kutulu Bento Metrik Izgarası (Min / Beklenen / Max) */}
                  <View style={styles.predMetricsGrid}>
                    <View style={styles.predMetricBox}>
                      <Text style={styles.predMetricTag}>MİN</Text>
                      <Text style={styles.predMetricVal} numberOfLines={1}>
                        {selectedForecastPoint.lowerBound} <Text style={styles.predMetricUnit}>{selectedForecastPoint.unit}</Text>
                      </Text>
                    </View>

                    <View style={[styles.predMetricBox, styles.predMetricBoxActive]}>
                      <Text style={[styles.predMetricTag, { color: '#8B5CF6' }]}>BEKLENEN</Text>
                      <Text style={[styles.predMetricVal, { color: '#8B5CF6', fontSize: 16 }]} numberOfLines={1}>
                        {selectedForecastPoint.expectedValue} <Text style={styles.predMetricUnit}>{selectedForecastPoint.unit}</Text>
                      </Text>
                    </View>

                    <View style={styles.predMetricBox}>
                      <Text style={styles.predMetricTag}>MAX</Text>
                      <Text style={styles.predMetricVal} numberOfLines={1}>
                        {selectedForecastPoint.upperBound} <Text style={styles.predMetricUnit}>{selectedForecastPoint.unit}</Text>
                      </Text>
                    </View>
                  </View>

                  {/* İstatistiksel Model & Güven Seviyesi Özeti */}
                  <View style={styles.predFooterRow}>
                    <View style={styles.predFooterTag}>
                      <Ionicons name="shield-checkmark-outline" size={11} color="#8B5CF6" />
                      <Text style={styles.predFooterTagText}>{regression.clLabel}</Text>
                    </View>
                    <Text style={styles.predFooterTrendText} numberOfLines={1}>
                      {regression.slope >= 0 ? `+${regression.slope}` : regression.slope} {selectedForecastPoint.unit}/seans • R²: {regression.rSquared}
                    </Text>
                  </View>
                </View>
              )}

              {/* Çoklu Seans Kaydırma İpucu */}
              {totalPredPointsCount > 6 && (
                <View style={styles.scrollHintRow}>
                  <Ionicons name="swap-horizontal" size={13} color={COLORS.textMuted} />
                  <Text style={styles.scrollHintText}>
                    Tüm seansları ve tahminleri görmek için kaydırın ({allHistorySessions.length} seans + 4 tahmin)
                  </Text>
                </View>
              )}

              {/* Regresyon & Güven Bandı SVG Grafiği */}
              <ScrollView
                ref={predScrollViewRef}
                horizontal
                showsHorizontalScrollIndicator={totalPredPointsCount > 6}
                contentContainerStyle={{ minWidth: innerCardWidth }}
                style={styles.chartScrollArea}
              >
                <View style={{ width: predScrollableWidth, height: chartHeight }}>
                  <Svg width={predScrollableWidth} height={chartHeight}>
                    <Defs>
                      <LinearGradient id="confidenceFunnelGrad" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.30" />
                        <Stop offset="50%" stopColor="#8B5CF6" stopOpacity="0.14" />
                        <Stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.04" />
                      </LinearGradient>
                      <LinearGradient id="predPastGrad" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0%" stopColor={COLORS.primary} stopOpacity="0.22" />
                        <Stop offset="80%" stopColor={COLORS.primary} stopOpacity="0.04" />
                        <Stop offset="100%" stopColor={COLORS.primary} stopOpacity="0.0" />
                      </LinearGradient>
                    </Defs>

                    {/* Kılavuz Çizgileri */}
                    {predGuidelines.map((g, gIdx) => {
                      const gy = chartHeight - paddingBottom - ((g.value - predMinVal) / predValRange) * plotHeight;
                      return (
                        <G key={gIdx}>
                          <SvgLine
                            x1={paddingLeft}
                            y1={gy}
                            x2={predScrollableWidth - paddingRight}
                            y2={gy}
                            stroke={COLORS.border}
                            strokeDasharray="4 4"
                            strokeWidth={1}
                            opacity={0.6}
                          />
                          <SvgText
                            x={paddingLeft - 6}
                            y={gy + 3.5}
                            textAnchor="end"
                            fontSize="9"
                            fill={COLORS.textMuted}
                            fontWeight="600"
                          >
                            {g.label}
                          </SvgText>
                        </G>
                      );
                    })}

                    {/* BUGÜN Dikey Ayırıcı Çizgisi */}
                    {todayPoint && (
                      <G>
                        <SvgLine
                          x1={todayPoint.x}
                          y1={paddingTop - 12}
                          x2={todayPoint.x}
                          y2={chartHeight - paddingBottom}
                          stroke={COLORS.borderDark}
                          strokeWidth={1.5}
                          strokeDasharray="3 3"
                        />
                        <SvgText
                          x={todayPoint.x}
                          y={paddingTop - 14}
                          textAnchor="middle"
                          fontSize="8.5"
                          fontWeight="800"
                          fill={COLORS.textMuted}
                        >
                          BUGÜN
                        </SvgText>
                      </G>
                    )}

                    {/* ±%2.5 Güven Bandı Huni Alanı (Confidence Band) */}
                    {confidenceFunnelD ? (
                      <>
                        <Path d={confidenceFunnelD} fill="url(#confidenceFunnelGrad)" />
                        {/* Üst ve alt %2.5 sınır kesikli çizgileri */}
                        <Path
                          d={upperDashedD}
                          stroke="#8B5CF6"
                          strokeWidth={1.5}
                          strokeDasharray="3 3"
                          fill="none"
                          opacity={0.8}
                        />
                        <Path
                          d={lowerDashedD}
                          stroke="#8B5CF6"
                          strokeWidth={1.5}
                          strokeDasharray="3 3"
                          fill="none"
                          opacity={0.8}
                        />
                      </>
                    ) : null}

                    {/* Merkez Regresyon Trend Çizgisi */}
                    {trendDashedD ? (
                      <Path
                        d={trendDashedD}
                        stroke="#A855F7"
                        strokeWidth={2.5}
                        strokeDasharray="5 3"
                        fill="none"
                      />
                    ) : null}

                    {/* Geçmiş Seanslar Alan Dolgusu ve Çizgisi */}
                    {predHistoryAreaD ? <Path d={predHistoryAreaD} fill="url(#predPastGrad)" /> : null}
                    {predHistoryLineD ? (
                      <Path
                        d={predHistoryLineD}
                        stroke={COLORS.primary}
                        strokeWidth={2.5}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ) : null}

                    {/* Geçmiş Noktalar */}
                    {predContextPoints.map(pt => (
                      <G key={`ctx_${pt.idx}`}>
                        <Circle
                          cx={pt.x}
                          cy={pt.y}
                          r={4}
                          fill={COLORS.primary}
                          stroke={COLORS.surface}
                          strokeWidth={1.5}
                        />
                        <SvgText
                          x={pt.x}
                          y={pt.y - 9}
                          textAnchor="middle"
                          fontSize={9}
                          fontWeight="700"
                          fill={COLORS.textPrimary}
                        >
                          {pt.session.chartValue}
                        </SvgText>
                        <SvgText
                          x={pt.x}
                          y={chartHeight - paddingBottom + 14}
                          textAnchor="middle"
                          fontSize={9}
                          fontWeight="600"
                          fill={COLORS.textMuted}
                        >
                          {formatSessionDateShort(pt.session.date)}
                        </SvgText>
                      </G>
                    ))}

                    {/* Gelecek Tahmin Noktaları */}
                    {predFuturePoints.map(fp => {
                      const isSelected = selectedPredStep === fp.step;

                      return (
                        <G key={`fut_${fp.step}`}>
                          {isSelected && (
                            <SvgLine
                              x1={fp.x}
                              y1={paddingTop - 6}
                              x2={fp.x}
                              y2={chartHeight - paddingBottom}
                              stroke="#8B5CF6"
                              strokeWidth={1.5}
                              strokeDasharray="3 3"
                              opacity={0.7}
                            />
                          )}

                          {isSelected && (
                            <Circle
                              cx={fp.x}
                              cy={fp.yExpected}
                              r={11}
                              fill="#8B5CF6"
                              opacity={0.22}
                            />
                          )}

                          <Circle
                            cx={fp.x}
                            cy={fp.yExpected}
                            r={isSelected ? 6 : 4.5}
                            fill="#8B5CF6"
                            stroke={COLORS.surface}
                            strokeWidth={2}
                          />

                          {isSelected && (
                            <Circle
                              cx={fp.x}
                              cy={fp.yExpected}
                              r={2.5}
                              fill={COLORS.surface}
                            />
                          )}

                          {/* Beklenen Değer Etiketi */}
                          <SvgText
                            x={fp.x}
                            y={fp.yExpected - (isSelected ? 13 : 9)}
                            textAnchor="middle"
                            fontSize={isSelected ? 10.5 : 9}
                            fontWeight={isSelected ? '900' : '700'}
                            fill={isSelected ? '#8B5CF6' : COLORS.textPrimary}
                          >
                            {fp.fp.expectedValue}
                          </SvgText>

                          {/* X-Ekseni Gelecek Seans Etiketi */}
                          <SvgText
                            x={fp.x}
                            y={chartHeight - paddingBottom + 14}
                            textAnchor="middle"
                            fontSize={9.5}
                            fontWeight={isSelected ? '800' : '600'}
                            fill={isSelected ? '#8B5CF6' : COLORS.textMuted}
                          >
                            +{fp.step}S
                          </SvgText>
                        </G>
                      );
                    })}
                  </Svg>

                  {/* Gelecek Noktalar Dokunma Katmanı */}
                  <View style={[StyleSheet.absoluteFill, { width: predScrollableWidth, height: chartHeight }]}>
                    {predFuturePoints.map(fp => {
                      const colW = Math.max(predStepX, 40);
                      return (
                        <TouchableOpacity
                          key={fp.step}
                          activeOpacity={0.7}
                          onPress={() => setSelectedPredStep(fp.step)}
                          style={{
                            position: 'absolute',
                            left: fp.x - colW / 2,
                            top: 0,
                            width: colW,
                            height: chartHeight,
                          }}
                        />
                      );
                    })}
                  </View>
                </View>
              </ScrollView>
            </>
          )}
        </>
      )}
    </View>
  );
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

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <TouchableOpacity
              style={styles.sharePRBtn}
              onPress={() => {
                const prWeight = stats.allTime.maxWeight;
                const prReps = stats.allTime.maxReps;
                const e1rm = stats.allTime.estimated1RM;
                const date = stats.allTime.bestDate;
                const msg = `🏆 FitHash PR Rekoru!
🏋️ Egzersiz: ${stats.exerciseName} (${stats.category} • ${stats.equipment})
⚡ Max Kaldırış: ${prWeight} kg × ${prReps} Tekrar
🔥 Tahmini 1RM: ${e1rm} kg
📅 Tarih: ${date || 'Kayıtlı'}

#FitHash #PersonalRecord #GymProgress`;
                Share.share({
                  title: `${stats.exerciseName} PR`,
                  message: msg,
                });
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="share-social-outline" size={20} color={COLORS.primary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close-circle" size={28} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
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

          {/* 4. MAKSİMUM AĞIRLIK GELİŞİM GRAFİĞİ (Line Chart) */}
          <ExerciseProgressionChart stats={stats} />

          {/* 5. TAHMİNİ TEKRAR MAKSİMUM TABLOSU (Rep Max Projeksiyonu) */}
          {!stats.isCardio && peak1RM > 0 && (
            <View style={styles.repTableCard}>
              <View style={styles.repTableHeader}>
                <View style={styles.repTitleRow}>
                  <Ionicons name="calculator-outline" size={17} color={COLORS.textPrimary} />
                  <Text style={styles.repTableTitle}>Tekrar Maksimumları (Rep Max)</Text>
                </View>
                <Text style={styles.repTableSub}>Zirve 1RM ({peak1RM} kg) bazlı projeksiyon</Text>
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

                      {!stats.isCardio && s.sessionMaxWeight > 0 ? (
                        <View style={styles.sessionPill}>
                          <Text style={styles.sessionPillLabel}>MAX</Text>
                          <Text style={styles.sessionPillVal}>
                            {s.sessionMaxWeight} kg{s.sessionMax1RM > 0 ? ` • 1RM ${s.sessionMax1RM}k` : ''}
                          </Text>
                        </View>
                      ) : stats.isCardio ? (
                        <View style={styles.sessionPill}>
                          <Text style={styles.sessionPillLabel}>MAX</Text>
                          <Text style={styles.sessionPillVal}>
                            {s.sets.find(st => st.avgSpeedKmh)?.avgSpeedKmh
                              ? `${s.sets.find(st => st.avgSpeedKmh)?.avgSpeedKmh} km/h`
                              : s.sets.find(st => st.distanceKm)?.distanceKm
                              ? `${s.sets.find(st => st.distanceKm)?.distanceKm} km`
                              : 'Kardiyo'}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Sets Grid */}
                    <View style={styles.setsWrap}>
                      {s.sets.map((set, sIdx) => {
                        const workingSetIndex = s.sets.slice(0, sIdx + 1).filter(st => !st.isWarmup).length;
                        const setLabel = set.isWarmup ? 'Isınma (W)' : `Set ${workingSetIndex || set.setNumber}`;

                        return (
                          <View key={sIdx} style={styles.setChip}>
                            <Text style={styles.setChipNum}>{setLabel}</Text>
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
                            {set.isWarmup ? (
                              <Text style={[styles.setChipRir, { backgroundColor: 'rgba(249, 115, 22, 0.15)', color: '#F97316' }]}>W</Text>
                            ) : set.rir !== undefined ? (
                              <Text style={styles.setChipRir}>RIR {set.rir}</Text>
                            ) : null}
                          </View>
                        );
                      })}
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
    flexWrap: 'wrap',
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
  sharePRBtn: {
    padding: 6,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: COLORS.border,
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
    gap: 6,
    flexWrap: 'wrap',
  },
  footerInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
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
    gap: 3,
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
    flex: 1,
    flexShrink: 1,
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
    flexBasis: '21%',
    flexGrow: 1,
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
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
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.primary,
    marginTop: 2,
    textAlign: 'center',
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
  chartCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
    ...SHADOWS.soft,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  chartHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  chartIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  chartTitleWrapper: {
    flex: 1,
    minWidth: 0,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  chartSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  progressionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    flexShrink: 0,
  },
  progressionText: {
    fontSize: 11,
    fontWeight: '800',
  },
  chartDetailCard: {
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  chartDetailLeft: {
    flex: 1,
    minWidth: 0,
  },
  chartDetailDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  chartDetailDateText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  chartPeakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  chartPeakBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#F59E0B',
  },
  chartDetailWorkoutText: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  chartDetailRight: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  chartDetailValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  chartDetailValue: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.primary,
  },
  chartDetailUnit: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  chartDetailSub: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 1,
    fontWeight: '600',
  },
  singleSessionNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: COLORS.surfaceSubtle,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  singleSessionNoticeText: {
    fontSize: 11,
    color: COLORS.textMuted,
    flex: 1,
    lineHeight: 15,
  },
  scrollHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: -2,
    marginBottom: -4,
  },
  scrollHintText: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  chartScrollArea: {
    marginTop: 4,
  },
  chartEmptyBox: {
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chartEmptyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  chartEmptyText: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 15,
  },
  tabToggleBox: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 10,
    padding: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tabToggleBtnActive: {
    backgroundColor: COLORS.primary,
  },
  tabToggleBtnActivePurple: {
    backgroundColor: '#8B5CF6',
  },
  tabToggleText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  tabToggleTextActive: {
    color: COLORS.primaryText,
    fontWeight: '800',
  },
  tabToggleTextActivePurple: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  predDetailCard: {
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 9,
  },
  predDetailTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  predDetailLeft: {
    flex: 1,
    minWidth: 0,
  },
  predTargetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  predTargetPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#8B5CF6',
  },
  predDateText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 3,
  },
  predDaysPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexShrink: 0,
  },
  predDaysText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  predMetricsGrid: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 6,
  },
  predMetricBox: {
    flex: 1,
    minWidth: 0,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  predMetricBoxActive: {
    borderColor: '#8B5CF6',
    backgroundColor: 'rgba(139, 92, 246, 0.05)',
  },
  predMetricTag: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.textMuted,
    marginBottom: 2,
    letterSpacing: 0.2,
  },
  predMetricVal: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },
  predMetricUnit: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  predFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    gap: 8,
  },
  predFooterTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  predFooterTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  predFooterTrendText: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  predEmptyCard: {
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 14,
    padding: 22,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  predEmptyIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  predEmptyTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  predEmptyText: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 16,
    maxWidth: 280,
  },
  predEmptyPill: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 4,
  },
  predEmptyPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8B5CF6',
  },
});
