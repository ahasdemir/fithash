import { WorkoutSession, MuscleCategory } from '../types/fitness';
import { getBiomechanicalProfile } from './progressionEngine';

export interface MuscleRecoveryStatus {
  muscleId: MuscleCategory;
  muscleName: string;
  recoveryPercentage: number; // 0 to 100
  hoursSinceTrained: number;
  status: 'FATIGUED' | 'RECOVERING' | 'RECOVERED';
  colorHex: string;
  lastTrainedDateStr?: string;
  accumulatedFatigueMultiplier: number;
  hardSetsInWindow: number;
}

export const MUSCLE_RECOVERY_CONFIG: Record<
  MuscleCategory,
  {
    displayName: string;
    baseHalfLifeHours: number; // quads/chest/back ~48h, small isolations/biceps ~36h
    iconName: string;
  }
> = {
  Göğüs: { displayName: 'Göğüs', baseHalfLifeHours: 48, iconName: 'body' },
  Sırt: { displayName: 'Sırt', baseHalfLifeHours: 48, iconName: 'shield' },
  Bacak: { displayName: 'Bacak / Kalça', baseHalfLifeHours: 54, iconName: 'walk' },
  Omuz: { displayName: 'Omuz', baseHalfLifeHours: 40, iconName: 'fitness' },
  'Ön Kol': { displayName: 'Ön Kol (Biceps)', baseHalfLifeHours: 36, iconName: 'barbell' },
  'Arka Kol': { displayName: 'Arka Kol (Triceps)', baseHalfLifeHours: 36, iconName: 'flash' },
  Karın: { displayName: 'Karın / Core', baseHalfLifeHours: 32, iconName: 'disc' },
  Kardiyo: { displayName: 'Kardiyo & Kondisyon', baseHalfLifeHours: 24, iconName: 'heart' },
};

/**
 * Hill-equation recovery calculation:
 * Recovery(t) = 100 / (1 + (t_half / Delta_t)^Hill)
 *
 * Modified Hill Recovery decay:
 * - Delta_t: Elapsed hours since the last completed working set on muscle j
 * - Hill exponent: beta = 2.4 (Sigmoidal biological repair curve)
 * - t_half = baseHalfLife * damageModifier
 *   - damageModifier modulated by:
 *     - Lengthened-bias multiplier (S_i >= 1.25 increases t_half to 60-72h)
 *     - High axial load (A_i >= 2 adds +12h system recovery)
 *     - Soreness rating from RP feedback (soreness=3 adds +18h, soreness=1 reduces by 6h)
 *     - Hard set count in recent window (>5 sets adds compounding fatigue)
 */
export function calculateHillRecoveryPercentage(
  elapsedHours: number,
  effectiveHalfLifeHours: number,
  hillBeta: number = 2.4
): number {
  const safeElapsedHours = Math.max(0, elapsedHours);
  if (safeElapsedHours <= 0) return 0;
  if (safeElapsedHours >= 168) return 100; // 7+ days = full recovery

  // Recovery(t) = 100 / (1 + (t_half / t)^beta)
  // Which is mathematically identical to (t^beta / (t^beta + t_half^beta)) * 100
  const tBeta = Math.pow(safeElapsedHours, hillBeta);
  const halfBeta = Math.pow(Math.max(12, effectiveHalfLifeHours), hillBeta);
  const recovery = (tBeta / (tBeta + halfBeta)) * 100;

  return Math.min(100, Math.max(0, Math.round(recovery)));
}

export function getRecoveryCategoryAndColor(percentage: number): {
  status: 'FATIGUED' | 'RECOVERING' | 'RECOVERED';
  colorHex: string;
} {
  if (percentage <= 40) {
    return {
      status: 'FATIGUED',
      colorHex: '#EF4444', // Coral / Red (Fatigued)
    };
  }
  if (percentage <= 79) {
    return {
      status: 'RECOVERING',
      colorHex: '#F59E0B', // Amber (Recovering)
    };
  }
  return {
    status: 'RECOVERED',
    colorHex: '#10B981', // Emerald Green (Recovered / Ready)
  };
}

/**
 * Evaluates muscle recovery state across all categories from historical workouts
 */
export function calculateAllMuscleRecovery(
  workouts: WorkoutSession[],
  nowMs: number = Date.now()
): Record<MuscleCategory, MuscleRecoveryStatus> {
  const result: Partial<Record<MuscleCategory, MuscleRecoveryStatus>> = {};
  const categories: MuscleCategory[] = [
    'Göğüs',
    'Sırt',
    'Bacak',
    'Omuz',
    'Ön Kol',
    'Arka Kol',
    'Karın',
    'Kardiyo',
  ];

  // Map latest completed workout exercise sets per category
  categories.forEach(cat => {
    const config = MUSCLE_RECOVERY_CONFIG[cat];
    let latestTimestamp = 0;
    let latestDateStr: string | undefined = undefined;
    let hasLengthened = false;
    let maxAxial = 0;
    let worstSorenessRating: number = 2;
    let recentHardSets = 0;

    // Scan backwards from newest workouts
    workouts
      .filter(w => w.completed !== false)
      .slice(0, 10)
      .forEach(w => {
        const wTime = w.endTime || (w.startTime ? w.startTime + (w.durationSeconds || 3600) * 1000 : new Date(w.date).getTime());
        const hoursAgo = (nowMs - wTime) / (1000 * 3600);

        // Only consider valid past workouts within past 7 days (0 <= hoursAgo < 168)
        if (hoursAgo >= 0 && hoursAgo < 168) {
          w.exercises?.forEach(ex => {
            if (ex.category === cat) {
              const completedSets = ex.sets?.filter(s => s.completed && !s.isWarmup) || [];
              if (completedSets.length > 0) {
                if (wTime > latestTimestamp) {
                  latestTimestamp = wTime;
                  latestDateStr = w.date;
                }
                recentHardSets += completedSets.length;

                // Inspect biomechanical modifiers
                const biomech = getBiomechanicalProfile(ex.exerciseName, ex.equipment, ex.category);
                if (biomech.stimulusMultiplier >= 1.25 || biomech.resistanceProfile === 'LENGTHENED') {
                  hasLengthened = true;
                }
                if (biomech.axialLoadingIndex > maxAxial) {
                  maxAxial = biomech.axialLoadingIndex;
                }

                // Check RP / session feedback
                if (ex.feedback?.sorenessRating) {
                  worstSorenessRating = Math.max(worstSorenessRating, ex.feedback.sorenessRating);
                } else if (w.sessionFeedback?.effortRating) {
                  worstSorenessRating = Math.max(worstSorenessRating, w.sessionFeedback.effortRating);
                }
              }
            }
          });
        }
      });

    // If never trained or trained > 7 days ago, fully recovered
    if (latestTimestamp === 0) {
      result[cat] = {
        muscleId: cat,
        muscleName: config.displayName,
        recoveryPercentage: 100,
        hoursSinceTrained: 168,
        status: 'RECOVERED',
        colorHex: '#10B981',
        accumulatedFatigueMultiplier: 1.0,
        hardSetsInWindow: 0,
      };
      return;
    }

    const elapsedHours = Math.max(0, Math.round(((nowMs - latestTimestamp) / (1000 * 3600)) * 10) / 10);

    // Compute effective half-life
    let effectiveHalfLife = config.baseHalfLifeHours;

    // 1. Lengthened bias increases half life (e.g. 48h -> 60-72h)
    if (hasLengthened) {
      effectiveHalfLife *= 1.30;
    }

    // 2. High axial loading adds up to +12h system recovery
    if (maxAxial >= 2) {
      effectiveHalfLife += maxAxial === 3 ? 12 : 6;
    }

    // 3. Soreness/fatigue rating modifier
    if (worstSorenessRating === 3) {
      effectiveHalfLife += 16; // Excessive fatigue/DOMS requires prolonged recovery
    } else if (worstSorenessRating === 1) {
      effectiveHalfLife -= 6; // Recovered earlier than baseline
    }

    // 4. Volume penalty: > 5 hard sets in window adds +5% per extra hard set
    if (recentHardSets > 5) {
      effectiveHalfLife *= 1 + (recentHardSets - 5) * 0.04;
    }

    const recoveryPct = calculateHillRecoveryPercentage(elapsedHours, effectiveHalfLife);
    const { status, colorHex } = getRecoveryCategoryAndColor(recoveryPct);

    result[cat] = {
      muscleId: cat,
      muscleName: config.displayName,
      recoveryPercentage: recoveryPct,
      hoursSinceTrained: elapsedHours,
      status,
      colorHex,
      lastTrainedDateStr: latestDateStr,
      accumulatedFatigueMultiplier: Math.round((effectiveHalfLife / config.baseHalfLifeHours) * 100) / 100,
      hardSetsInWindow: recentHardSets,
    };
  });

  return result as Record<MuscleCategory, MuscleRecoveryStatus>;
}
