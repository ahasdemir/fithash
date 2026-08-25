import { WorkoutSession, PersonalRecord, UserStats, ExerciseSet } from '../types/fitness';
import { calculateUserStats } from './storage';

export interface AIAnalysisResult {
  summary: string;
  recommendations: string[];
  muscleBalanceComment: string;
  overloadTip: string;
  score: number; // 0 - 100 score
  isCustomKeyUsed: boolean;
  timestamp: string;
  /** Gemini kullanılamadığında yerel analizle birlikte gösterilecek açıklama. */
  liveError?: string;
}

export interface SmartOverloadRecommendation {
  recWeight: number;
  lastWeight: number;
  recReps: number;
  lastReps: number;
  lastRir: number;
  increment: number;
  actionType: 'WEIGHT_UP' | 'REP_UP' | 'MAINTAIN' | 'AGGRESSIVE_UP';
  badgeLabel: string;
  reason: string;
  isDoubleProgression: boolean;
}

const VALID_FREE_MODELS = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash', 'gemini-1.5-pro'];

export const generateGeminiAnalysis = async (
  workouts: WorkoutSession[],
  prs: Record<string, PersonalRecord>,
  apiKey: string,
  modelName: string = 'gemini-2.0-flash'
): Promise<AIAnalysisResult> => {
  const stats = calculateUserStats(workouts);
  const nowTime = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const normalizedModel = (!modelName || modelName.includes('2.5') || !VALID_FREE_MODELS.includes(modelName))
    ? 'gemini-2.0-flash'
    : modelName;

  // If user provided a custom Gemini API Key, attempt live API call with fallback model cascade
  if (apiKey && apiKey.trim().length > 10) {
    const candidateModels = Array.from(new Set([
      normalizedModel,
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-1.5-flash',
    ]));

    let primaryModelError = '';
    let lastErrorMsg = '';

    const prompt = `Sen FitHash uygulamasının uzman spor, hipertrofi ve kondisyon koçusun (RP / Dr. Mike Israetel bilimsel modelini esas alırsın).
Aşağıdaki kullanıcı antrenman, kardiyo ve hipertrofi istatistiklerini analiz et ve Türkçe olarak değerlendir:

[ANA HİPERTROFİ VE PERFORMANS METRİKLERİ]
- Sert Set Sayısı (Hard Sets, RIR 0-3): ${stats.totalHardSets} Set
- Program Uyum Oranı: %${stats.avgWorkoutCompliance}
- Ortalama Yoğunluk (RIR): RIR ${stats.avgRir}
- Aktif Gerilim Altında Çalışma Süresi (TUT): ${stats.activeWorkTimeMinutes} dakika (Toplam Süre: ${stats.totalTimeMinutes} dk)
- Devamlılık Serisi (Streak): ${stats.streakDays} gün

[KARDİYO VE SAĞLIK METRİKLERİ]
- Yakılan Toplam Kalori: ~${stats.totalCaloriesBurned} kcal
- Kat Edilen Kardiyo Mesafesi: ${stats.totalCardioDistanceKm} km
- Kaldırılan Toplam Yük (İkincil): ${stats.totalVolumeKg} kg

[SON 5 ANTRENMAN SEANSI DETAYLARI]
${workouts.slice(0, 5).map(w => {
  const isCardio = w.totalCardioDistanceKm && w.totalCardioDistanceKm > 0;
  return `- ${w.name} (${w.date}): ${w.totalSets} set, Ort. RIR: ${w.avgRir ?? '1.0'}${isCardio ? `, Kardiyo: ${w.totalCardioDistanceKm} km, Kalori: ~${w.totalCaloriesBurned || 0} kcal` : `, Hacim: ${w.totalVolume} kg`}`;
}).join('\n')}

[ÖNEMLİ KİŞİSEL REKORLAR (PR)]
${Object.values(prs).slice(0, 5).map(p => `- ${p.exerciseName}: ${p.maxWeight} kg x ${p.maxReps} tekrar`).join('\n')}

Lütfen yanıtını tam olarak aşağıdaki JSON formatında döndür (JSON harici hiçbir ek metin veya markdown tırnağı yazma):
{
  "summary": "Hipertrofi sert setleri ve genel performansa dair 2 cümlelik profesyonel koç özeti",
  "recommendations": ["Tavsiye 1 (RP Hipertrofi / Sert Setler üzerine)", "Tavsiye 2 (Kardiyo ve Kalori dengesi üzerine)", "Tavsiye 3 (Progressive Overload / RIR üzerine)"],
  "muscleBalanceComment": "Kas grupları ve efektif set dağılımı hakkında bilimsel yorum",
  "overloadTip": "Gelecek antrenman için spesifik Progressive Overload ve RIR tavsiyesi",
  "score": 88
}`;

    for (const mName of candidateModels) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${mName}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey.trim(),
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
            },
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          const errMsg = data?.error?.message || `HTTP ${response.status}`;
          if (mName === normalizedModel || !primaryModelError) {
            primaryModelError = errMsg;
          }
          lastErrorMsg = errMsg;
          console.warn(`Model ${mName} failed (${response.status}): ${errMsg}`);
          continue;
        }

        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) {
          throw new Error('Gemini yanıtı boş döndü.');
        }

        const parsed = JSON.parse(rawText);
        if (!Array.isArray(parsed.recommendations)) {
          throw new Error('Gemini yanıtı beklenen formatta değil.');
        }

        return {
          summary: parsed.summary || 'Antrenman ve sert set verileriniz başarıyla analiz edildi.',
          recommendations: parsed.recommendations,
          muscleBalanceComment: parsed.muscleBalanceComment || 'Kas grubu sert set dağılımınız dengeli seyrediyor.',
          overloadTip: parsed.overloadTip || 'RIR 1-2 aralığında +2.5kg artışı veya +1 tekrar hedefleyin.',
          score: Math.min(100, Math.max(50, Number(parsed.score) || 85)),
          isCustomKeyUsed: true,
          timestamp: nowTime,
        };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Bağlantı hatası.';
        if (mName === normalizedModel || !primaryModelError) {
          primaryModelError = errMsg;
        }
        lastErrorMsg = errMsg;
      }
    }

    // If all model candidates failed, return local fallback with clean user-friendly error message
    const fallback = generateLocalFallbackAnalysis(workouts, prs, stats, nowTime);
    const errToCheck = primaryModelError || lastErrorMsg;
    let friendlyError = errToCheck;

    const lowerErr = errToCheck.toLowerCase();
    if (lowerErr.includes('quota') || lowerErr.includes('limit') || lowerErr.includes('429') || lowerErr.includes('resource_exhausted')) {
      friendlyError = 'Gemini Ücretsiz Tier Kota Sınırı: API anahtarınızın dakikalık/günlük sınırı doldu. Lütfen ~1 dakika bekleyip tekrar "Analizi Yenile" yapın.';
    } else if (lowerErr.includes('key_invalid') || lowerErr.includes('api_key') || lowerErr.includes('unauthorized') || lowerErr.includes('401') || lowerErr.includes('403')) {
      friendlyError = 'Geçersiz Gemini API Anahtarı: Lütfen Ayarlar menüsünden API anahtarınızı kontrol edin.';
    } else if (lowerErr.includes('not found') || lowerErr.includes('not supported')) {
      friendlyError = `Seçilen AI Modeli (${normalizedModel}) Desteklenmiyor: Google bu modeli ücretsiz hesabınız için açmamış olabilir. Lütfen Ayarlar'dan Gemini 2.0 Flash seçin.`;
    }

    return {
      ...fallback,
      liveError: friendlyError,
    };
  }

  // --- RULE-BASED FALLBACK ENGINE (If no key or network offline) ---
  return {
    ...generateLocalFallbackAnalysis(workouts, prs, stats, nowTime),
    liveError: 'Gemini API anahtarı kaydedilmedi; yerel analiz gösteriliyor.',
  };
};

const generateLocalFallbackAnalysis = (
  workouts: WorkoutSession[],
  prs: Record<string, PersonalRecord>,
  stats: UserStats,
  timestamp: string
): AIAnalysisResult => {
  if (workouts.length === 0) {
    return {
      summary: 'Henüz antrenman kaydı bulunmuyor. İlk antrenmanınızı tamamladıktan sonra AI koçunuz detaylı analiz sunacaktır.',
      recommendations: [
        'Haftalık 3-4 gün antrenman hedefi belirleyin.',
        'Her sert sette RIR 1-2 seviyesini hedefleyerek tükenişe yakın çalışın.',
        'Kardiyo seanslarınızı antrenman sonrasına planlayın.'
      ],
      muscleBalanceComment: 'Henüz kas grubu verisi birikmedi.',
      overloadTip: 'Temel bileşik (Barbell/Dumbbell) hareketlerle başlayın.',
      score: 75,
      isCustomKeyUsed: false,
      timestamp,
    };
  }

  const prCount = Object.keys(prs).length;

  let summary = `Son seanslarınızda toplam ${stats.totalHardSets} sert set (RIR 0-3) ve ${stats.activeWorkTimeMinutes} dk aktif çalışma süresi tamamlandı. Program uyum oranınız %${stats.avgWorkoutCompliance}.`;
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
    isCustomKeyUsed: false,
    timestamp,
  };
};

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
 *
 * Principles:
 * 1. Category & Movement Rep Ranges: 5-8 reps on Squat/Deadlift/Bench, 8-12 on Machines, 10-15 on Isolations, 12-20 on Delts/Calves.
 * 2. Multi-Session Trend Lookback: Ingests last 2-3 sessions to eliminate "Single Bad Day Fragility" outliers.
 * 3. Double Progression: Advance reps within the hypertrophy bracket -> Upon hitting the rep ceiling, bump weight and reset reps to bracket base.
 * 4. Autoregulation via RIR: Adjust recommendations dynamically based on actual proximity to failure (RIR 1-2 sweet spot).
 * 5. Equipment-Aware Microloading: Prevents excessive percentage jumps on dumbbells and isolation movements.
 * 6. Intra-Workout Fatigue Modeling: Accounts for neuromuscular fatigue across sets (e.g. Set 1: 12 reps -> Set 2: 11 reps -> Set 3: 10 reps).
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
    // If reached max reps on pure failure, bump weight cautiously
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
