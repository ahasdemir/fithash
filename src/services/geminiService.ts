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

export const generateGeminiAnalysis = async (
  workouts: WorkoutSession[],
  prs: Record<string, PersonalRecord>,
  apiKey: string,
  modelName: string = 'gemini-2.5-flash'
): Promise<AIAnalysisResult> => {
  const stats = calculateUserStats(workouts);
  const nowTime = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const normalizedModel = modelName === 'gemini-1.5-flash' ? 'gemini-2.5-flash' : modelName;

  // If user provided a custom Gemini API Key, attempt live API call
  if (apiKey && apiKey.trim().length > 10) {
    try {
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

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${normalizedModel}:generateContent`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey.trim(),
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            // Gemini v1beta'nin desteklediği JSON yanıt seçeneği. Şema alanı,
            // bazı 2.5 API hesaplarında uyumsuz olduğundan yanıtı uygulamada doğruluyoruz.
            responseMimeType: 'application/json',
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error?.message || `Gemini isteği HTTP ${response.status} ile başarısız oldu.`);
      }

      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new Error('Gemini boş veya engellenmiş bir yanıt döndürdü.');
      }

      const parsed = JSON.parse(rawText);
      if (!Array.isArray(parsed.recommendations)) {
        throw new Error('Gemini yanıtı beklenen analiz formatında değil.');
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
    } catch (error) {
      console.warn('Gemini API call failed, falling back to local engine:', error);
      const fallback = generateLocalFallbackAnalysis(workouts, prs, stats, nowTime);
      const message = error instanceof Error ? error.message : 'Bilinmeyen bağlantı hatası.';
      return {
        ...fallback,
        liveError: `Gemini yanıt vermedi: ${message}`,
      };
    }
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

/**
 * SPORTS SCIENCE AUTOREGULATED PROGRESSIVE OVERLOAD ALGORITHM
 * Combines:
 * 1. RIR (Reps in Reserve) Autoregulation (Dr. Mike Israetel / RP model)
 * 2. Double Progression Model (Rep Progression -> Weight Progression)
 * 3. Equipment-Aware Load Step Increments (Dumbbell: 2.5kg pair, Barbell/Plate: 2.5/5kg)
 */
export const calculateSmartAutoregulatedOverload = (
  exerciseName: string,
  equipment: string,
  pastCompletedSets: ExerciseSet[],
  targetReps: number = 10,
  targetRir: number = 1
): SmartOverloadRecommendation => {
  const validSets = pastCompletedSets.filter(s => s.completed && s.weight > 0);

  if (validSets.length === 0) {
    return {
      recWeight: 0,
      lastWeight: 0,
      recReps: targetReps,
      lastReps: targetReps,
      lastRir: targetRir,
      increment: 2.5,
      actionType: 'MAINTAIN',
      badgeLabel: 'Yeni Egzersiz',
      reason: 'Geçmiş çalışma verisi bulunamadı.',
      isDoubleProgression: false,
    };
  }

  const lastMaxWeight = Math.max(...validSets.map(s => s.weight));
  const avgReps = Math.round(validSets.reduce((sum, s) => sum + s.reps, 0) / validSets.length);
  const avgRir = Math.round(validSets.reduce((sum, s) => sum + (s.rir ?? 1), 0) / validSets.length);

  // Equipment Step Increment Rule
  let increment = 2.5;
  const lowerName = exerciseName.toLowerCase();
  const lowerEq = (equipment || '').toLowerCase();

  if (lowerEq.includes('dumbbell') || lowerEq.includes('dambıl') || lowerName.includes('dumbbell') || lowerName.includes('db')) {
    increment = 2.5; // Dumbbell tier jump (12.5 -> 15kg or 15 -> 17.5kg)
  } else if (lowerEq.includes('barbell') || lowerEq.includes('plate') || lowerEq.includes('plaka') || lowerName.includes('mch') || lowerName.includes('press')) {
    increment = lastMaxWeight >= 120 ? 5.0 : 2.5; // 1.25kg per side (2.5kg total) or 2.5kg per side (5kg total)
  } else if (lowerEq.includes('cable') || lowerEq.includes('machine') || lowerEq.includes('makine')) {
    increment = 2.5;
  } else if (lastMaxWeight >= 80) {
    increment = 5.0;
  }

  // --- AUTOREGULATION & DOUBLE PROGRESSION ENGINE ---

  // SCENARIO 1: Too Easy (RIR >= 3) -> Aggressive Weight Increase
  if (avgRir >= 3) {
    const aggIncrement = increment >= 5.0 ? 5.0 : 2.5;
    const recWeight = parseFloat((lastMaxWeight + aggIncrement).toFixed(1));
    return {
      recWeight,
      lastWeight: lastMaxWeight,
      recReps: targetReps,
      lastReps: avgReps,
      lastRir: avgRir,
      increment: aggIncrement,
      actionType: 'AGGRESSIVE_UP',
      badgeLabel: `⚡ ${recWeight} kg (+${aggIncrement}kg Agresif)`,
      reason: `Son seans çok rahat geçti (RIR ${avgRir}). İdeal hipertrofi uyarısı için ağırlık +${aggIncrement} kg artırıldı.`,
      isDoubleProgression: false,
    };
  }

  // SCENARIO 2: Target RIR (1-2) (Optimal Hypertrophy Stimulus)
  if (avgRir >= 1 && avgRir <= 2) {
    // Double Progression Step 1: Did we hit/exceed target reps?
    if (avgReps >= targetReps) {
      const recWeight = parseFloat((lastMaxWeight + increment).toFixed(1));
      return {
        recWeight,
        lastWeight: lastMaxWeight,
        recReps: Math.max(8, targetReps - 2), // Drop reps back slightly to rebuild with heavier load
        lastReps: avgReps,
        lastRir: avgRir,
        increment,
        actionType: 'WEIGHT_UP',
        badgeLabel: `📈 ${recWeight} kg (+${increment}kg)`,
        reason: `Hedef ${targetReps} tekrar tamamlandı (RIR ${avgRir}). Çift aşamalı modelle ağırlık +${increment} kg artırıldı.`,
        isDoubleProgression: true,
      };
    } else {
      // Double Progression Step 2: Rep progression first (Keep weight, increase reps by +1)
      return {
        recWeight: lastMaxWeight,
        lastWeight: lastMaxWeight,
        recReps: avgReps + 1,
        lastReps: avgReps,
        lastRir: avgRir,
        increment: 0,
        actionType: 'REP_UP',
        badgeLabel: `🎯 ${lastMaxWeight} kg (${avgReps + 1} Rep Hedefi)`,
        reason: `Ağırlığı koruyun (${lastMaxWeight} kg). Önce tekrar sayısını ${avgReps + 1}'e çıkarmayı hedefleyin.`,
        isDoubleProgression: true,
      };
    }
  }

  // SCENARIO 3: Failure / High Fatigue (RIR = 0)
  if (avgReps >= targetReps) {
    const recWeight = parseFloat((lastMaxWeight + increment).toFixed(1));
    return {
      recWeight,
      lastWeight: lastMaxWeight,
      recReps: targetReps,
      lastReps: avgReps,
      lastRir: avgRir,
      increment,
      actionType: 'WEIGHT_UP',
      badgeLabel: `📈 ${recWeight} kg (+${increment}kg)`,
      reason: `Tükenişte (RIR 0) hedef tekrar tamamlandı. Ağırlık +${increment} kg artırıldı.`,
      isDoubleProgression: false,
    };
  } else {
    // Hold weight steady to allow fatigue recovery
    return {
      recWeight: lastMaxWeight,
      lastWeight: lastMaxWeight,
      recReps: targetReps,
      lastReps: avgReps,
      lastRir: avgRir,
      increment: 0,
      actionType: 'MAINTAIN',
      badgeLabel: `${lastMaxWeight} kg (Form Sabit)`,
      reason: `Son seans tükenişte geçti (RIR 0). Formu ve kilosunu koruyarak toparlanmayı hedefleyin.`,
      isDoubleProgression: false,
    };
  }
};
