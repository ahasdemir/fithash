import { WorkoutSession, PersonalRecord, UserStats, ExerciseSet } from '../types/fitness';
import { calculateUserStats } from './storage';

export interface SetTargetRecommendation {
  setNumber: number;
  weight: number;
  reps: number;
  targetRir: number;
}

export interface SmartOverloadRecommendation {
  recWeight: number;
  lastWeight: number;
  recReps: number;
  lastReps: number;
  lastRir: number;
  increment: number;
  minBracketReps: number;
  maxBracketReps: number;
  actionType: 'WEIGHT_UP' | 'REP_UP' | 'MAINTAIN' | 'AGGRESSIVE_UP';
  badgeLabel: string;
  reason: string;
  isDoubleProgression: boolean;
  setTargets?: SetTargetRecommendation[];
}

export interface CoachAnalysisResult {
  summary: string;
  recommendations: string[];
  muscleBalanceComment: string;
  overloadTip: string;
  score: number; // 0 - 100 score
  timestamp: string;
}

/**
 * Determines the scientifically validated hypertrophy rep bracket based on
 * movement biomechanics, fatigue coefficient, and muscle fiber recruitment.
 * (RP / Dr. Mike Israetel Hypertrophy Model)
 */
export const getHypertrophyRepBracket = (
  exerciseName: string,
  equipment: string = '',
  category: string = ''
): { minReps: number; maxReps: number; archetype: string } => {
  const name = exerciseName.toLowerCase();
  const eq = equipment.toLowerCase();
  const cat = category.toLowerCase();

  // 1. High-Metabolic / Micro-Load / Delts / Calves / Abs (12 - 20 Reps)
  if (
    name.includes('lateral raise') ||
    name.includes('yan omuz') ||
    name.includes('rear delt') ||
    name.includes('face pull') ||
    name.includes('calf') ||
    name.includes('kalf') ||
    name.includes('shrug') ||
    name.includes('crunch') ||
    name.includes('leg raise') ||
    name.includes('karın') ||
    name.includes('wrist') ||
    name.includes('forearm')
  ) {
    return { minReps: 12, maxReps: 20, archetype: 'Metabolik & İzolasyon (12-20 Reps)' };
  }

  // 2. Heavy Multi-Joint Free Weight Compounds (5 - 8 Reps for Squat/Deadlift/Bench, 6 - 10 for other free weights)
  if (
    (eq.includes('barbell') || eq.includes('serbest') || eq.includes('plate')) &&
    (name.includes('deadlift') ||
     name.includes('squat') ||
     name.includes('bench press') ||
     name.includes('overhead press') ||
     name.includes('military'))
  ) {
    return { minReps: 5, maxReps: 8, archetype: 'Ağır Serbest Bileşik (5-8 Reps)' };
  }

  if (
    (eq.includes('barbell') || eq.includes('serbest') || eq.includes('plate')) &&
    (name.includes('barbell row') ||
     name.includes('bent over') ||
     name.includes('incline press') ||
     name.includes('romanian'))
  ) {
    return { minReps: 6, maxReps: 10, archetype: 'Ağır Serbest Bileşik (6-10 Reps)' };
  }

  // 3. Machine & Cable Multi-Joint Compounds (8 - 12 Reps)
  if (
    name.includes('press') ||
    name.includes('pulldown') ||
    name.includes('row') ||
    name.includes('hack') ||
    name.includes('leg press') ||
    name.includes('dip') ||
    eq.includes('machine') ||
    eq.includes('makine') ||
    eq.includes('cable') ||
    eq.includes('kablo')
  ) {
    return { minReps: 8, maxReps: 12, archetype: 'Makine & Kablo Bileşik (8-12 Reps)' };
  }

  // 4. Standard Hypertrophy Isolations (Arms, Quads, Hamstrings, Chest Flies) (10 - 15 Reps)
  if (
    name.includes('curl') ||
    name.includes('extension') ||
    name.includes('pushdown') ||
    name.includes('fly') ||
    name.includes('pec deck') ||
    name.includes('abductor') ||
    name.includes('adductor') ||
    cat.includes('ön kol') ||
    cat.includes('arka kol')
  ) {
    return { minReps: 10, maxReps: 15, archetype: 'Hipertrofi İzolasyonu (10-15 Reps)' };
  }

  // Default Hypertrophy Sweet-Spot (8 - 12 Reps)
  return { minReps: 8, maxReps: 12, archetype: 'Standart Hipertrofi (8-12 Reps)' };
};

/**
 * Calculates smart micro-increment step size based on equipment, current weight,
 * and biomechanical load jump safety.
 */
export const calculateLoadIncrement = (
  exerciseName: string,
  equipment: string = '',
  currentWeight: number = 0
): number => {
  const name = exerciseName.toLowerCase();
  const eq = equipment.toLowerCase();

  // Dumbbells: Small dumbbells (< 14kg) need 1.0 - 2.0kg steps to avoid >15% jumps
  if (eq.includes('dumbbell') || eq.includes('dambıl') || name.includes('dumbbell') || name.includes('db')) {
    if (currentWeight > 0 && currentWeight <= 14) {
      return 2.0; // 2kg pair jump (e.g. 10kg -> 12kg)
    }
    return 2.5; // Standard 2.5kg pair step (e.g. 17.5kg -> 20kg)
  }

  // Barbells: Micro-loading vs heavy compound loading
  if (eq.includes('barbell') || eq.includes('plate') || eq.includes('plaka')) {
    if (currentWeight >= 120) {
      return 5.0; // 2.5kg per side (+5kg total)
    }
    return 2.5; // 1.25kg per side (+2.5kg total)
  }

  // Machines & Cables
  if (eq.includes('cable') || eq.includes('kablo') || eq.includes('machine') || eq.includes('makine')) {
    if (currentWeight >= 80) return 5.0;
    return 2.5;
  }

  return currentWeight >= 80 ? 5.0 : 2.5;
};

/**
 * GOLD-STANDARD AUTOREGULATED DOUBLE PROGRESSION HYPERTROPHY ENGINE
 * (Evidence-Based Sports Science / Dr. Mike Israetel / Eric Helms Model)
 */
export const calculateSmartAutoregulatedOverload = (
  exerciseName: string,
  equipment: string = '',
  pastCompletedSetsOrSessions: ExerciseSet[] | ExerciseSet[][],
  customTargetReps?: number,
  category: string = ''
): SmartOverloadRecommendation => {
  const bracket = getHypertrophyRepBracket(exerciseName, equipment, category);
  
  // Anchor bracket around custom routine target reps if specified
  const minReps = customTargetReps ? Math.max(3, customTargetReps - 2) : bracket.minReps;
  const maxReps = customTargetReps ? customTargetReps + 2 : bracket.maxReps;

  // Normalize multi-session history: pastSessions[0] = most recent, pastSessions[1] = previous, etc.
  let pastSessions: ExerciseSet[][] = [];
  if (Array.isArray(pastCompletedSetsOrSessions) && pastCompletedSetsOrSessions.length > 0) {
    if (Array.isArray(pastCompletedSetsOrSessions[0])) {
      pastSessions = (pastCompletedSetsOrSessions as ExerciseSet[][])
        .map(sList => sList.filter(s => s.completed && s.weight > 0))
        .filter(sList => sList.length > 0);
    } else {
      const valid = (pastCompletedSetsOrSessions as ExerciseSet[]).filter(s => s.completed && s.weight > 0);
      if (valid.length > 0) pastSessions = [valid];
    }
  }

  if (pastSessions.length === 0) {
    const baseReps = customTargetReps || Math.round((minReps + maxReps) / 2);
    return {
      recWeight: 0,
      lastWeight: 0,
      recReps: baseReps,
      lastReps: baseReps,
      lastRir: 1,
      increment: 2.5,
      minBracketReps: minReps,
      maxBracketReps: maxReps,
      actionType: 'MAINTAIN',
      badgeLabel: 'Yeni Egzersiz',
      reason: `Geçmiş seans verisi bulunamadı. ${bracket.archetype} için ${minReps}-${maxReps} tekrar aralığında ısınarak başlayın.`,
      isDoubleProgression: false,
      setTargets: [1, 2, 3].map(n => ({ setNumber: n, weight: 0, reps: baseReps, targetRir: 1 })),
    };
  }

  // Primary metrics from most recent session (Session 0)
  const recentSets = pastSessions[0];
  const weights = recentSets.map(s => s.weight);
  const reps = recentSets.map(s => s.reps);
  const rirs = recentSets.map(s => s.rir ?? 1);

  const lastMaxWeight = Math.max(...weights);
  const avgReps = Math.round(reps.reduce((a, b) => a + b, 0) / reps.length);
  const topSetReps = Math.max(...reps);
  const avgRir = Math.round(rirs.reduce((a, b) => a + b, 0) / rirs.length);
  const firstSetReps = reps[0] || avgReps;

  const increment = calculateLoadIncrement(exerciseName, equipment, lastMaxWeight);

  // Helper to generate per-set fatigue decay targets
  const generateSetTargets = (targetWeight: number, baseTopReps: number, targetRir: number = 1): SetTargetRecommendation[] => {
    return [1, 2, 3, 4].map(setNum => {
      // Natural neuromuscular fatigue: ~0-1 rep loss per consecutive set
      const fatigueLoss = Math.min(2, Math.floor((setNum - 1) * 0.75));
      const setReps = Math.max(minReps, baseTopReps - fatigueLoss);
      return {
        setNumber: setNum,
        weight: targetWeight,
        reps: setReps,
        targetRir,
      };
    });
  };

  // MULTI-SESSION TREND ANALYSIS: Single Bad Day Outlier Detection
  if (pastSessions.length >= 2) {
    const prevSets = pastSessions[1];
    const prevMaxWeight = Math.max(...prevSets.map(s => s.weight));
    const prevAvgReps = Math.round(prevSets.reduce((a, b) => a + b.reps, 0) / prevSets.length);

    // If previous session was strong and in-bracket, but latest session experienced an isolated dip (e.g. bad sleep/fatigue)
    const isIsolatedDip = (lastMaxWeight >= prevMaxWeight) && (prevAvgReps >= minReps) && (avgReps < minReps || avgRir === 0);
    if (isIsolatedDip) {
      return {
        recWeight: prevMaxWeight,
        lastWeight: lastMaxWeight,
        recReps: prevAvgReps,
        lastReps: avgReps,
        lastRir: avgRir,
        increment: 0,
        minBracketReps: minReps,
        maxBracketReps: maxReps,
        actionType: 'MAINTAIN',
        badgeLabel: `🛡️ ${prevMaxWeight} kg (Toparlanma / Sabit)`,
        reason: `Geçmiş seans trendinize göre son seansta geçici bir yorgunluk/düşüş yaşandı. Serinizi korumak için ${prevMaxWeight} kg ile ${prevAvgReps} tekrar toparlanma hedefleyin.`,
        isDoubleProgression: false,
        setTargets: generateSetTargets(prevMaxWeight, prevAvgReps, 1),
      };
    }
  }

  // --- PROGRESSION DECISION MATRIX ---

  // SCENARIO 1: Under-loaded / Too Easy (Avg RIR >= 3) -> Aggressive Overload
  if (avgRir >= 3) {
    const aggIncrement = increment >= 5.0 ? 5.0 : Math.max(2.5, increment);
    const recWeight = parseFloat((lastMaxWeight + aggIncrement).toFixed(1));
    const targetRep = Math.max(minReps, Math.min(maxReps, avgReps));
    
    return {
      recWeight,
      lastWeight: lastMaxWeight,
      recReps: targetRep,
      lastReps: avgReps,
      lastRir: avgRir,
      increment: aggIncrement,
      minBracketReps: minReps,
      maxBracketReps: maxReps,
      actionType: 'AGGRESSIVE_UP',
      badgeLabel: `⚡ ${recWeight} kg (+${aggIncrement}kg Agresif)`,
      reason: `Son seans çok rahat geçti (RIR ${avgRir}). İdeal hipertrofi uyarısı (RIR 1-2) için ağırlık +${aggIncrement} kg artırıldı.`,
      isDoubleProgression: false,
      setTargets: generateSetTargets(recWeight, targetRep, 1),
    };
  }

  // SCENARIO 2: Reached Top of the Rep Range (avgReps >= maxReps OR topSet >= maxReps with RIR >= 1)
  // -> Double Progression Stage 2: Weight Jump & Rep Range Reset
  const hasHitRepCeiling = (avgReps >= maxReps) || (topSetReps >= maxReps && avgRir >= 1);
  if (hasHitRepCeiling && avgRir >= 1) {
    const recWeight = parseFloat((lastMaxWeight + increment).toFixed(1));
    // Reset target reps back to base of the bracket to rebuild with new load
    const resetReps = Math.min(maxReps - 1, minReps + 1);

    return {
      recWeight,
      lastWeight: lastMaxWeight,
      recReps: resetReps,
      lastReps: avgReps,
      lastRir: avgRir,
      increment,
      minBracketReps: minReps,
      maxBracketReps: maxReps,
      actionType: 'WEIGHT_UP',
      badgeLabel: `📈 ${recWeight} kg (+${increment}kg)`,
      reason: `Tebrikler! 🎯 Önceki seansta ${maxReps} tekrar tavanına ulaştınız (RIR ${avgRir}). Çift aşamalı modelle ağırlık +${increment} kg artırıldı, hedef ${minReps}-${maxReps} tekrar aralığına çekildi.`,
      isDoubleProgression: true,
      setTargets: generateSetTargets(recWeight, resetReps, 1),
    };
  }

  // SCENARIO 3: Inside Bracket (minReps <= avgReps < maxReps) with Good Stimulus (RIR 1-2)
  // -> Double Progression Stage 1: Rep Progression at Current Weight
  if (avgRir >= 1 && avgReps >= minReps) {
    const nextTargetReps = Math.min(maxReps, Math.max(firstSetReps + 1, avgReps + 1));
    const repsNeeded = maxReps - avgReps;

    return {
      recWeight: lastMaxWeight,
      lastWeight: lastMaxWeight,
      recReps: nextTargetReps,
      lastReps: avgReps,
      lastRir: avgRir,
      increment: 0,
      minBracketReps: minReps,
      maxBracketReps: maxReps,
      actionType: 'REP_UP',
      badgeLabel: `🎯 ${lastMaxWeight} kg (+1 Rep Hedefi)`,
      reason: `Ağırlığı koruyun (${lastMaxWeight} kg). ${maxReps} tekrar tavanına (${repsNeeded} tekrar kaldı) ulaşana kadar önce tekrar sayısını artırmayı hedefleyin.`,
      isDoubleProgression: true,
      setTargets: generateSetTargets(lastMaxWeight, nextTargetReps, 1),
    };
  }

  // SCENARIO 4: True Failure / High Fatigue (RIR = 0) OR Below Minimum Bracket (avgReps < minReps)
  // -> Fatigue Management & Form Solidification
  if (avgRir === 0 && topSetReps >= maxReps) {
    const recWeight = parseFloat((lastMaxWeight + increment).toFixed(1));
    const resetReps = minReps;
    return {
      recWeight,
      lastWeight: lastMaxWeight,
      recReps: resetReps,
      lastReps: avgReps,
      lastRir: 0,
      increment,
      actionType: 'WEIGHT_UP',
      minBracketReps: minReps,
      maxBracketReps: maxReps,
      badgeLabel: `📈 ${recWeight} kg (+${increment}kg)`,
      reason: `Tükenişte (RIR 0) tekrar tavanı tamamlandı. Ağırlık +${increment} kg artırıldı, temiz form ile ${minReps} tekrar hedefleyin.`,
      isDoubleProgression: true,
      setTargets: generateSetTargets(recWeight, resetReps, 1),
    };
  }

  // Hold weight steady to recover and consolidate technique
  const maintainReps = Math.max(minReps, Math.min(maxReps, avgReps));
  return {
    recWeight: lastMaxWeight,
    lastWeight: lastMaxWeight,
    recReps: maintainReps,
    lastReps: avgReps,
    lastRir: avgRir,
    increment: 0,
    minBracketReps: minReps,
    maxBracketReps: maxReps,
    actionType: 'MAINTAIN',
    badgeLabel: `🛡️ ${lastMaxWeight} kg (Form Sabit)`,
    reason: `Son seans tükenişte/zorlanarak geçti (RIR ${avgRir}). Aşırı yorgunluğu önlemek için aynı kiloda (${lastMaxWeight} kg) temiz form ve toparlanma hedefleyin.`,
    isDoubleProgression: false,
    setTargets: generateSetTargets(lastMaxWeight, maintainReps, 1),
  };
};

/**
 * 100% LOCAL & OFFLINE SPORTS SCIENCE COACH ANALYTICS
 * (No external APIs or network requests needed)
 */
export const generateLocalCoachAnalysis = (
  workouts: WorkoutSession[],
  prs: Record<string, PersonalRecord>
): CoachAnalysisResult => {
  const stats = calculateUserStats(workouts);
  const nowTime = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  if (workouts.length === 0) {
    return {
      summary: 'Henüz antrenman kaydı bulunmuyor. İlk antrenmanınızı tamamladıktan sonra performans analiziniz burada görüntülenecektir.',
      recommendations: [
        'Haftalık 3-4 gün antrenman hedefi belirleyin.',
        'Her sert sette RIR 1-2 seviyesini hedefleyerek tükenişe yakın çalışın.',
        'Kardiyo seanslarınızı antrenman sonrasına planlayın.'
      ],
      muscleBalanceComment: 'Henüz kas grubu verisi birikmedi.',
      overloadTip: 'Temel bileşik (Barbell/Dumbbell) hareketlerle başlayın.',
      score: 75,
      timestamp: nowTime,
    };
  }

  const prCount = Object.keys(prs).length;
  let summary = `Son seanslarınızda toplam ${stats.totalHardSets} sert set (RIR 0-3) ve ${stats.activeWorkTimeMinutes} dk aktif gerilim altında çalışma süresi tamamlandı. Program uyum oranınız %${stats.avgWorkoutCompliance}.`;
  let overloadTip = 'Gelecek antrenmanda RIR 1-2 aralığında kalarak en az 1 ana harekette +2.5kg veya +1 tekrar artış hedefleyin.';
  let muscleBalance = 'İtiş, çekiş, bacak ve kardiyo seansları arasında efektif sert set dağılımı aktif şekilde ilerliyor.';
  let score = 85;

  if (stats.streakDays >= 3) {
    score += 6;
  }
  if (stats.avgWorkoutCompliance >= 90) {
    score += 5;
  }
  if (prCount >= 3) {
    score += 3;
  }

  const recs = [
    `Toplam ${stats.totalHardSets} sert set ile ideal hipertrofi uyarısı yakalıyorsunuz.`,
    `Aktif çalışma süreniz ${stats.activeWorkTimeMinutes} dk (TUT). Dinlenmeleri 90-120sn arasında tutmaya özen gösterin.`,
    'Otomatik RIR & Çift Aşamalı (Double Progression) yükleme modelini takip edin.'
  ];

  return {
    summary,
    recommendations: recs,
    muscleBalanceComment: muscleBalance,
    overloadTip,
    score: Math.min(98, score),
    timestamp: nowTime,
  };
};
