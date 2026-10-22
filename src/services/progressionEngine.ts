import { WorkoutSession, PersonalRecord, UserStats, ExerciseSet, OverloadActionType, SetDynamicTarget, PlateauHistory, MuscleCategory } from '../types/fitness';
import { calculateUserStats } from './storage';

export interface SetTargetRecommendation {
  setNumber: number;
  weight: number;
  reps: number;
  targetRir: number;
  status?: 'INCREASE_WEIGHT' | 'INCREASE_REPS' | 'MAINTAIN' | 'DELOAD' | 'REDUCE_WEIGHT';
  reason?: string;
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
  actionType: OverloadActionType;
  actionTitle: string;
  badgeLabel: string;
  reason: string;
  isDoubleProgression: boolean;
  setTargets?: SetTargetRecommendation[];
  plateauHistory?: PlateauHistory;
}

export interface CoachAnalysisResult {
  summary: string;
  recommendations: string[];
  muscleBalanceComment: string;
  overloadTip: string;
  score: number; // 0 - 100 score
  timestamp: string;
  weeklyHardSetsByMuscle?: Record<string, { hardSets: number; status: 'BELOW_MEV' | 'MEV' | 'MAV' | 'MRV' | 'OVER_MRV'; label: string }>;
}

/**
 * RIR-Autoregulated Hybrid e1RM Calculation:
 * - Effective Reps = reps + (rir ?? 1)
 * - If Effective Reps <= 10: weight * (1 + Effective Reps / 30) (RIR-corrected Epley)
 * - If Effective Reps > 10: weight * (Effective Reps ** 0.10) (Lombardi model)
 */
export const calculateAutoregulatedE1RM = (
  weight: number,
  reps: number,
  rir: number = 1
): number => {
  if (weight <= 0 || reps <= 0) return 0;
  const safeRir = Math.max(0, Math.min(rir, 5));
  const effectiveReps = reps + safeRir;

  if (effectiveReps <= 10) {
    return weight * (1 + effectiveReps / 30);
  }
  return weight * Math.pow(effectiveReps, 0.10);
};

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
 * Scientific micro-loading:
 * - Dumbbells <= 14kg: never jump by +2kg (which would be 15-40% leap). Micro-step 0.5kg - 1kg max (or ~2-5%).
 * - Larger Dumbbells > 14kg: 1kg - 2kg (capped ~5%).
 * - Barbells / Plates: 2.5kg (or 5kg for heavy compounds >= 120kg).
 * - Cables / Pin machines: smallest pin increment or proportional 2.5-5kg.
 */
export const calculateLoadIncrement = (
  exerciseName: string,
  equipment: string = '',
  currentWeight: number = 0
): number => {
  const name = exerciseName.toLowerCase();
  const eq = equipment.toLowerCase();

  // Dumbbells: micro-loading and proportional bounding
  if (eq.includes('dumbbell') || eq.includes('dambıl') || name.includes('dumbbell') || name.includes('db')) {
    if (currentWeight <= 0) return 1.0;
    if (currentWeight <= 8) {
      return 0.5; // Strict micro-load for very light DBs (e.g., 6kg -> 6.5kg or 7kg max)
    }
    if (currentWeight <= 14) {
      return 1.0; // 1kg step instead of 2kg jump (avoiding >14% leap)
    }
    if (currentWeight <= 28) {
      return 2.0;
    }
    return 2.5;
  }

  // Barbells
  if (eq.includes('barbell') || eq.includes('plate') || eq.includes('plaka')) {
    if (currentWeight >= 120) return 5.0;
    return 2.5;
  }

  // Machines & Cables
  if (eq.includes('cable') || eq.includes('kablo') || eq.includes('machine') || eq.includes('makine')) {
    if (currentWeight >= 80) return 5.0;
    return 2.5;
  }

  // Default proportional step
  if (currentWeight <= 14) return 1.0;
  if (currentWeight >= 80) return 5.0;
  return 2.5;
};

/**
 * Detects stagnation across consecutive sessions using session-best e1RM.
 * Stagnation condition: delta e1RM <= 0 across 3 consecutive sessions while pushing hard (RIR <= 1).
 */
export const detectPlateauAndDeload = (
  pastSessions: ExerciseSet[][]
): PlateauHistory => {
  if (pastSessions.length < 2) {
    return {
      exerciseId: '',
      consecutiveStagnantSessions: 0,
      isStagnant: false,
      isDeloadRecommended: false,
      lastSessionE1RMs: pastSessions.map(sList => {
        const bestE1rm = Math.max(...sList.map(s => calculateAutoregulatedE1RM(s.weight, s.reps, s.rir ?? 1)));
        return Math.round(bestE1rm * 10) / 10;
      }),
    };
  }

  // Calculate top e1RM and min RIR for each session in chronological order: [oldest, ..., newest]
  // Note: pastSessions is passed as [mostRecent (0), previous (1), oldest (2), ...]
  // We examine up to 4 sessions, reversing to chronological order.
  const sessionsToCheck = pastSessions.slice(0, 4).reverse();
  const sessionMetrics = sessionsToCheck.map(sList => {
    let maxE1rm = 0;
    let minRir = 99;
    sList.forEach(s => {
      const e1rm = calculateAutoregulatedE1RM(s.weight, s.reps, s.rir ?? 1);
      if (e1rm > maxE1rm) maxE1rm = e1rm;
      const r = s.rir ?? 1;
      if (r < minRir) minRir = r;
    });
    return { maxE1rm: Math.round(maxE1rm * 10) / 10, minRir };
  });

  const lastSessionE1RMs = pastSessions.slice(0, 3).map(sList => {
    const best = Math.max(...sList.map(s => calculateAutoregulatedE1RM(s.weight, s.reps, s.rir ?? 1)));
    return Math.round(best * 10) / 10;
  });

  // Count consecutive stagnant intervals where delta e1RM <= 0 and effort was high (RIR <= 1)
  let consecutiveStagnantSessions = 0;
  for (let i = sessionMetrics.length - 1; i >= 1; i--) {
    const current = sessionMetrics[i];
    const prev = sessionMetrics[i - 1];
    const isHardEffort = current.minRir <= 1;
    const isStagnant = (current.maxE1rm - prev.maxE1rm) <= 0.05; // <= 0 with floating margin

    if (isHardEffort && isStagnant) {
      consecutiveStagnantSessions++;
    } else {
      break;
    }
  }

  const isDeloadRecommended = consecutiveStagnantSessions >= 3;
  const isStagnant = consecutiveStagnantSessions >= 2;

  let recommendationNote: string | undefined;
  if (isDeloadRecommended) {
    recommendationNote = `3 seanstır e1RM artışı sağlanamadı ve yüksek tükeniş (RIR ≤ 1) yaşandı. Santral sinir sistemi ve bağ dokusu toparlanması için Deload (yarı hacim, %10 daha hafif yük) önerilir.`;
  } else if (isStagnant) {
    recommendationNote = `2 seanstır gelişim durağanlaştı. Form temposunu ve dinlenme aralıklarını kontrol edin.`;
  }

  return {
    exerciseId: '',
    consecutiveStagnantSessions,
    isStagnant,
    isDeloadRecommended,
    lastSessionE1RMs,
    recommendationNote,
  };
};

/**
 * GOLD-STANDARD DYNAMIC DOUBLE PROGRESSION & AUTOREGULATED HYPERTROPHY ENGINE
 * (Evidence-Based Sports Science / Dr. Mike Israetel / Eric Helms Model)
 *
 * Scientific Rules:
 * 1. Dynamic Double Progression (DDP): Set-by-set independent progression.
 *    - Each set is evaluated independently against the rep bracket ceiling.
 *    - If Set 1 hits the ceiling (e.g. 12 reps with RIR >= 1), increment Set 1's weight next session.
 *    - Set 2 and Set 3 remain at their respective loads until each individually reaches the rep ceiling.
 * 2. Micro-loading & Proportional increments: Dumbbells <= 14kg never jump by 2kg.
 * 3. Multi-Session Stagnation & Deload: 3 consecutive stagnant sessions at RIR <= 1 trigger DELOAD (-10% load, 50% sets).
 * 4. RIR-Autoregulated e1RM evaluation for fatigue and plateau metrics.
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
      actionTitle: 'Yeni Egzersiz',
      badgeLabel: `Yeni Egzersiz (${minReps}-${maxReps} Rep)`,
      reason: `Geçmiş seans verisi bulunamadı. ${bracket.archetype} için ${minReps}-${maxReps} tekrar aralığında uygun bir ağırlıkla başlayın.`,
      isDoubleProgression: false,
      setTargets: [1, 2, 3].map(n => ({
        setNumber: n,
        weight: 0,
        reps: baseReps,
        targetRir: 1,
        status: 'MAINTAIN',
        reason: 'Başlangıç seti',
      })),
    };
  }

  // Primary metrics from most recent session (Session 0)
  const recentSets = pastSessions[0];
  const weights = recentSets.map(s => s.weight);
  const reps = recentSets.map(s => s.reps);
  const rirs = recentSets.map(s => s.rir ?? 1);

  const lastMaxWeight = Math.max(...weights);
  const avgReps = Math.round(reps.reduce((a, b) => a + b, 0) / reps.length);
  const avgRir = Math.round(rirs.reduce((a, b) => a + b, 0) / rirs.length);
  const firstSetReps = reps[0] || avgReps;

  const defaultIncrement = calculateLoadIncrement(exerciseName, equipment, lastMaxWeight);

  // Check for Multi-Session Stagnation & Deload (3 consecutive stagnant sessions at RIR <= 1)
  const plateauHistory = detectPlateauAndDeload(pastSessions);

  if (plateauHistory.isDeloadRecommended) {
    const deloadWeight = parseFloat(Math.max(0, (lastMaxWeight * 0.90)).toFixed(1));
    const deloadReps = Math.round((minReps + maxReps) / 2);

    // Recommend 50% volume (e.g. 2 sets instead of 4)
    const deloadSetsCount = Math.max(2, Math.ceil(recentSets.length * 0.5));
    const deloadSetTargets: SetTargetRecommendation[] = [];
    for (let i = 0; i < deloadSetsCount; i++) {
      deloadSetTargets.push({
        setNumber: i + 1,
        weight: deloadWeight,
        reps: deloadReps,
        targetRir: 3, // Deload target RIR: 3+ (non-grinding)
        status: 'DELOAD',
        reason: 'Aktif toparlanma ve yorgunluk boşaltımı (Deload)',
      });
    }

    return {
      recWeight: deloadWeight,
      lastWeight: lastMaxWeight,
      recReps: deloadReps,
      lastReps: avgReps,
      lastRir: avgRir,
      increment: -(lastMaxWeight - deloadWeight),
      minBracketReps: minReps,
      maxBracketReps: maxReps,
      actionType: 'DELOAD',
      actionTitle: 'Deload (Toparlanma)',
      badgeLabel: `Deload Önerisi (%50 Hacim, -%10 Yük)`,
      reason: plateauHistory.recommendationNote || `Son 3 seansta platoya girildi. Kas dokusu ve eklemleri toparlamak için ağırlığı %10 düşürüp hacmi yarıya indirin.`,
      isDoubleProgression: false,
      setTargets: deloadSetTargets,
      plateauHistory,
    };
  }

  // DYNAMIC DOUBLE PROGRESSION: Set-by-Set independent evaluation
  // Instead of averaging across sets, evaluate each set's previous load, reps, and RIR individually.
  const targetCount = Math.max(recentSets.length, 3);
  const ddpSetTargets: SetTargetRecommendation[] = [];

  for (let idx = 0; idx < targetCount; idx++) {
    const prevSet = recentSets[idx] || recentSets[recentSets.length - 1];
    const prevSetWeight = prevSet.weight;
    const prevSetReps = prevSet.reps;
    const prevSetRir = prevSet.rir ?? 1;
    const setIncrement = calculateLoadIncrement(exerciseName, equipment, prevSetWeight);

    let targetWeight = prevSetWeight;
    let targetReps = prevSetReps;
    let targetRir = 1;
    let setStatus: SetTargetRecommendation['status'] = 'MAINTAIN';
    let setReason = 'Ağırlığı koruyun';

    // Condition A: Set hit ceiling rep range with adequate RIR (>= 1) -> Increase weight for THIS set
    if (prevSetReps >= maxReps && prevSetRir >= 1) {
      targetWeight = parseFloat((prevSetWeight + setIncrement).toFixed(1));
      targetReps = minReps;
      setStatus = 'INCREASE_WEIGHT';
      setReason = `Tavana (${maxReps} tekrar) ulaşıldı: +${setIncrement}kg ekleyip ${minReps} tekrardan seriyi başlatın.`;
    }
    // Condition B: Underloaded / very easy set (RIR >= 3) -> Step up weight
    else if (prevSetRir >= 3) {
      const aggStep = Math.max(setIncrement, 1.0);
      targetWeight = parseFloat((prevSetWeight + aggStep).toFixed(1));
      targetReps = Math.max(minReps, Math.min(maxReps, prevSetReps));
      setStatus = 'INCREASE_WEIGHT';
      setReason = `Set çok rahat geçti (RIR ${prevSetRir}): +${aggStep}kg ağırlık artırın.`;
    }
    // Condition C: Inside bracket (minReps <= reps < maxReps) with good RIR (>= 1) -> Increase reps for this set
    else if (prevSetRir >= 1 && prevSetReps >= minReps) {
      targetWeight = prevSetWeight;
      targetReps = Math.min(maxReps, prevSetReps + 1);
      setStatus = 'INCREASE_REPS';
      setReason = `Ağırlığı koruyun (${prevSetWeight}kg), tavana doğru +1 tekrar hedefleyin (${targetReps} tekrar).`;
    }
    // Condition D: Severe underperformance (reps < minReps - 1 and RIR 0) -> Micro-deload / reduce weight for this set
    else if (prevSetReps < minReps - 1 && prevSetRir === 0) {
      targetWeight = Math.max(0, parseFloat((prevSetWeight - setIncrement).toFixed(1)));
      targetReps = minReps;
      setStatus = 'REDUCE_WEIGHT';
      setReason = `Yüksek yorgunluk/erken tükeniş: Ağırlığı bir kademe hafifletin (${targetWeight}kg).`;
    }
    // Condition E: Maintain weight & reps
    else {
      targetWeight = prevSetWeight;
      targetReps = Math.max(minReps, Math.min(maxReps, prevSetReps));
      setStatus = 'MAINTAIN';
      setReason = `Temiz form ile ${prevSetWeight}kg'da toparlanarak devam edin.`;
    }

    ddpSetTargets.push({
      setNumber: idx + 1,
      weight: targetWeight,
      reps: targetReps,
      targetRir,
      status: setStatus,
      reason: setReason,
    });
  }

  // Top-level action summary (driven primarily by Set 1 / Top Set in DDP)
  const set1Recommendation = ddpSetTargets[0];
  const recWeight = set1Recommendation.weight;
  const recReps = set1Recommendation.reps;

  // MULTI-SESSION ISOLATED DIP OUTLIER DETECTION
  if (pastSessions.length >= 2) {
    const prevSets = pastSessions[1];
    const prevMaxWeight = Math.max(...prevSets.map(s => s.weight));
    const prevAvgReps = Math.round(prevSets.reduce((a, b) => a + b.reps, 0) / prevSets.length);

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
        actionTitle: 'Ağırlığı Koru',
        badgeLabel: `Ağırlığı Koru (${prevMaxWeight} kg)`,
        reason: `Geçmiş seans trendinize göre son seansta geçici bir yorgunluk/düşüş yaşandı. Serinizi korumak için ${prevMaxWeight} kg ile ${prevAvgReps} tekrar toparlanma hedefleyin.`,
        isDoubleProgression: true,
        setTargets: ddpSetTargets,
        plateauHistory,
      };
    }
  }

  // Classify overall primary action type based on Set 1 DDP status
  if (set1Recommendation.status === 'INCREASE_WEIGHT') {
    const isAggressive = (recentSets[0]?.rir ?? 1) >= 3;
    const actionType: OverloadActionType = isAggressive ? 'AGGRESSIVE_MORE_WEIGHT' : 'MORE_WEIGHT';
    const actionTitle = 'Ağırlık Artır (Set 1)';
    const badgeLabel = `Ağırlık Artır (${recWeight} kg)`;
    const reason = `Set 1 tekrar tavanını aştı (DDP). 1. sette ${recWeight} kg'a çıkın; sonraki setleri bağımsız olarak kendi tavanlarına ulaştıkça artırın.`;

    return {
      recWeight,
      lastWeight: lastMaxWeight,
      recReps,
      lastReps: avgReps,
      lastRir: avgRir,
      increment: defaultIncrement,
      minBracketReps: minReps,
      maxBracketReps: maxReps,
      actionType,
      actionTitle,
      badgeLabel,
      reason,
      isDoubleProgression: true,
      setTargets: ddpSetTargets,
      plateauHistory,
    };
  }

  if (set1Recommendation.status === 'INCREASE_REPS') {
    return {
      recWeight: lastMaxWeight,
      lastWeight: lastMaxWeight,
      recReps: Math.min(maxReps, firstSetReps + 1),
      lastReps: avgReps,
      lastRir: avgRir,
      increment: 0,
      minBracketReps: minReps,
      maxBracketReps: maxReps,
      actionType: 'MORE_REPS',
      actionTitle: 'Tekrar Artır',
      badgeLabel: `Tekrar Artır (+1 Rep)`,
      reason: `Ağırlığı koruyun (${lastMaxWeight} kg). Dinamik Çift Aşamalı Yükleme (DDP): Her set bağımsız olarak ${maxReps} tekrar tavanına ulaşana kadar önce tekrar artırın.`,
      isDoubleProgression: true,
      setTargets: ddpSetTargets,
      plateauHistory,
    };
  }

  if (set1Recommendation.status === 'REDUCE_WEIGHT') {
    return {
      recWeight,
      lastWeight: lastMaxWeight,
      recReps: minReps,
      lastReps: avgReps,
      lastRir: avgRir,
      increment: -defaultIncrement,
      minBracketReps: minReps,
      maxBracketReps: maxReps,
      actionType: 'LESS_WEIGHT',
      actionTitle: 'Ağırlığı Azalt',
      badgeLabel: `Ağırlığı Azalt (${recWeight} kg)`,
      reason: `Son seans tükenişte ve hedefin altında kaldı. Kas toparlanması için ağırlığı hafifletin (${recWeight} kg).`,
      isDoubleProgression: false,
      setTargets: ddpSetTargets,
      plateauHistory,
    };
  }

  return {
    recWeight: lastMaxWeight,
    lastWeight: lastMaxWeight,
    recReps: Math.max(minReps, Math.min(maxReps, avgReps)),
    lastReps: avgReps,
    lastRir: avgRir,
    increment: 0,
    minBracketReps: minReps,
    maxBracketReps: maxReps,
    actionType: 'MAINTAIN',
    actionTitle: 'Ağırlığı Koru',
    badgeLabel: `Ağırlığı Koru (Form Sabit)`,
    reason: `Temiz hareket formu ve RIR 1-2 aralığında kalarak aynı ağırlıkta (${lastMaxWeight} kg) devam edin.`,
    isDoubleProgression: true,
    setTargets: ddpSetTargets,
    plateauHistory,
  };
};

/**
 * Evaluates weekly effective hard sets (RIR <= 3, non-warmup) per muscle group
 * against scientific volume landmarks:
 * - MEV (Minimum Effective Volume): 6-8 sets/week
 * - MAV (Maximum Adaptive Volume): 10-18 sets/week
 * - MRV (Maximum Recoverable Volume): 20+ sets/week
 */
export const evaluateWeeklyMuscleVolumeLandmarks = (
  workouts: WorkoutSession[]
): Record<string, { hardSets: number; status: 'BELOW_MEV' | 'MEV' | 'MAV' | 'MRV' | 'OVER_MRV'; label: string }> => {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const hardSetsMap: Record<MuscleCategory, number> = {
    'Göğüs': 0,
    'Sırt': 0,
    'Bacak': 0,
    'Omuz': 0,
    'Ön Kol': 0,
    'Arka Kol': 0,
    'Karın': 0,
    'Kardiyo': 0,
  };

  workouts.forEach(w => {
    if (w.completed === false) return;
    const [year, month, day] = w.date.split('-').map(Number);
    const workoutDate = new Date(year, month - 1, day);
    if (workoutDate < sevenDaysAgo) return;

    w.exercises.forEach(ex => {
      if (ex.category === 'Kardiyo') return;
      ex.sets.forEach(s => {
        // Count hard sets: completed, non-warmup, and taken close to failure (RIR <= 3)
        if (s.completed && !s.isWarmup && (s.rir === undefined || s.rir <= 3)) {
          if (ex.category && hardSetsMap[ex.category] !== undefined) {
            hardSetsMap[ex.category]++;
          }
        }
      });
    });
  });

  const result: Record<string, { hardSets: number; status: 'BELOW_MEV' | 'MEV' | 'MAV' | 'MRV' | 'OVER_MRV'; label: string }> = {};

  (Object.keys(hardSetsMap) as MuscleCategory[]).forEach(muscle => {
    if (muscle === 'Kardiyo') return;
    const sets = hardSetsMap[muscle];
    let status: 'BELOW_MEV' | 'MEV' | 'MAV' | 'MRV' | 'OVER_MRV' = 'BELOW_MEV';
    let label = 'Hacim Yetersiz (<6 Set)';

    if (sets >= 22) {
      status = 'OVER_MRV';
      label = 'Aşırı Yükleme (>22 Set / Overtraining Riski)';
    } else if (sets >= 19) {
      status = 'MRV';
      label = 'Tavan Hacim (MRV: 19-22 Set)';
    } else if (sets >= 10) {
      status = 'MAV';
      label = 'İdeal Hipertrofi Aralığı (MAV: 10-18 Set)';
    } else if (sets >= 6) {
      status = 'MEV';
      label = 'Minimum Etkili Hacim (MEV: 6-9 Set)';
    }

    result[muscle] = { hardSets: sets, status, label };
  });

  return result;
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
  const volumeLandmarks = evaluateWeeklyMuscleVolumeLandmarks(workouts);

  // Identify any muscle groups in MAV, MEV, or approaching MRV
  const activeLandmarks = Object.entries(volumeLandmarks).filter(([_, v]) => v.hardSets > 0);
  const mavGroups = activeLandmarks.filter(([_, v]) => v.status === 'MAV').map(([k]) => k);
  const overMrvGroups = activeLandmarks.filter(([_, v]) => v.status === 'OVER_MRV').map(([k]) => k);
  const belowMevGroups = activeLandmarks.filter(([_, v]) => v.status === 'BELOW_MEV').map(([k]) => k);

  let summary = `Son 7 günde toplam ${stats.totalHardSets} sert set (RIR ≤ 3) tamamlandı. Aktif gerilim süresi (TUT): ${stats.activeWorkTimeMinutes} dk. Program uyum oranınız %${stats.avgWorkoutCompliance}.`;
  
  let overloadTip = 'Dinamik Çift Aşamalı Yükleme (DDP): 1. set tavan tekrara ulaştığında sadece 1. setin yükünü artırın; diğer setler bağımsız ilerlesin.';
  if (overMrvGroups.length > 0) {
    overloadTip = `${overMrvGroups.join(', ')} bölgesi için haftalık hacim MRV (20+ set) sınırını aştı. Toparlanma için hacmi MAV seviyesine çekin.`;
  }

  let muscleBalance = 'Kas grupları genelinde çalışma seti dağılımı dengeli ilerliyor.';
  if (mavGroups.length > 0) {
    muscleBalance = `${mavGroups.join(', ')} grubu ideal hipertrofi hacminde (MAV: 10-18 set/hafta).`;
  }
  if (belowMevGroups.length > 0 && belowMevGroups.length <= 3) {
    muscleBalance += ` ${belowMevGroups.join(', ')} henüz MEV (<6 set) altında.`;
  }

  let score = 85;
  if (stats.streakDays >= 3) score += 5;
  if (stats.avgWorkoutCompliance >= 90) score += 5;
  if (prCount >= 3) score += 3;
  if (overMrvGroups.length > 0) score -= 6; // Penalize overtraining

  const recs = [
    `Haftalık sert setleriniz (RIR ≤ 3) kas gelişimini tetikleyen efektif aralıkta.`,
    `Dinamik Çift Aşamalı Yükleme (DDP) ile her seti bağımsız takip edin; hafif dambıllarda mikro yükleme uygulayın.`,
    `Aynı kiloda 3 seans üst üste takılma yaşanırsa sistem otomatik Deload (yarı hacim, -%10 yük) önerecektir.`
  ];

  return {
    summary,
    recommendations: recs,
    muscleBalanceComment: muscleBalance,
    overloadTip,
    score: Math.min(99, Math.max(50, score)),
    timestamp: nowTime,
    weeklyHardSetsByMuscle: volumeLandmarks,
  };
};
