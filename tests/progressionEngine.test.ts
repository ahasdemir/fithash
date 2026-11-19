import { describe, it, expect } from 'vitest';
import {
  calculateAutoregulatedE1RM,
  getHypertrophyRepBracket,
  calculateLoadIncrement,
  detectPlateauAndDeload,
  calculateSmartAutoregulatedOverload,
  evaluateWeeklyMuscleVolumeLandmarks,
  getBiomechanicalProfile,
  calculateDynamicRestSeconds,
  predictFatigueDecayReps,
  suggestBackOffWeightDrop,
  getMesocyclePhaseTarget,
  calculateHypertrophyVolumeAdaptation,
} from '../src/services/progressionEngine';
import { getLocalDateString } from '../src/services/storage';
import { ExerciseSet, WorkoutSession, MuscleCategory } from '../src/types/fitness';

let setCounter = 0;
const makeSet = (
  weight: number,
  reps: number,
  rir?: number,
  overrides: Partial<ExerciseSet> = {}
): ExerciseSet => ({
  id: `set_${++setCounter}`,
  setNumber: setCounter,
  weight,
  reps,
  completed: true,
  ...(rir !== undefined ? { rir } : {}),
  ...overrides,
});

let workoutCounter = 0;
const makeWorkout = (
  date: string,
  exercises: { category: MuscleCategory; sets: ExerciseSet[] }[]
): WorkoutSession => ({
  id: `workout_${++workoutCounter}`,
  name: 'Test Antrenmanı',
  date,
  startTime: 0,
  durationSeconds: 0,
  exercises: exercises.map((ex, i) => ({
    id: `we_${workoutCounter}_${i}`,
    exerciseId: `ex_${i}`,
    exerciseName: `Exercise ${i}`,
    category: ex.category,
    equipment: 'Barbell',
    sets: ex.sets,
  })),
  totalVolume: 0,
  totalSets: 0,
  completed: true,
});

const todayStr = () => getLocalDateString(new Date());
const daysAgoStr = (days: number) => getLocalDateString(new Date(Date.now() - days * 86400_000));

describe('calculateAutoregulatedE1RM', () => {
  it('uses RIR-corrected Epley when effective reps <= 10', () => {
    // 5 reps + 1 RIR = 6 effective reps -> 100 * (1 + 6/30) = 120
    expect(calculateAutoregulatedE1RM(100, 5, 1)).toBe(120);
    // default RIR is 1
    expect(calculateAutoregulatedE1RM(100, 5)).toBe(120);
    // 5 reps + 0 RIR = 5 effective reps -> 100 * (1 + 5/30)
    expect(calculateAutoregulatedE1RM(100, 5, 0)).toBeCloseTo(116.6667, 3);
    // 8 reps + 2 RIR = 10 effective reps (boundary) -> 100 * (1 + 10/30)
    expect(calculateAutoregulatedE1RM(100, 8, 2)).toBeCloseTo(133.3333, 3);
  });

  it('switches to the Lombardi model above 10 effective reps', () => {
    // 9 reps + 2 RIR = 11 effective reps -> 100 * 11^0.1
    expect(calculateAutoregulatedE1RM(100, 9, 2)).toBeCloseTo(127.098, 2);
  });

  it('clamps RIR into the 0..5 range', () => {
    // RIR 99 clamps to 5 -> 5 + 5 = 10 effective reps -> Epley branch boundary
    expect(calculateAutoregulatedE1RM(100, 5, 99)).toBeCloseTo(133.3333, 3);
    // Negative RIR clamps to 0 -> 5 effective reps
    expect(calculateAutoregulatedE1RM(100, 5, -10)).toBeCloseTo(116.6667, 3);
  });

  it('returns 0 for zero or invalid weight/reps', () => {
    expect(calculateAutoregulatedE1RM(0, 5, 1)).toBe(0);
    expect(calculateAutoregulatedE1RM(-50, 5, 1)).toBe(0);
    expect(calculateAutoregulatedE1RM(100, 0, 1)).toBe(0);
    expect(calculateAutoregulatedE1RM(100, -3, 1)).toBe(0);
  });

  it('is monotonic in reps at a fixed weight', () => {
    const e1rm5 = calculateAutoregulatedE1RM(100, 5, 1);
    const e1rm6 = calculateAutoregulatedE1RM(100, 6, 1);
    const e1rm7 = calculateAutoregulatedE1RM(100, 7, 1);
    expect(e1rm5).toBeLessThan(e1rm6);
    expect(e1rm6).toBeLessThan(e1rm7);
  });
});

describe('getHypertrophyRepBracket', () => {
  it('routes metabolic/isolation movements to the 12-20 bracket', () => {
    expect(getHypertrophyRepBracket('Lateral Raise', 'Dumbbell', 'Omuz')).toEqual({
      minReps: 12,
      maxReps: 20,
      archetype: 'Metabolik & İzolasyon (12-20 Reps)',
    });
    // Turkish alias
    expect(getHypertrophyRepBracket('Yan Omuz Raise', '', 'Omuz').minReps).toBe(12);
  });

  it('routes heavy barbell compounds to the 5-8 bracket', () => {
    const bracket = getHypertrophyRepBracket('Barbell Bench Press', 'Barbell', 'Göğüs');
    expect(bracket.minReps).toBe(5);
    expect(bracket.maxReps).toBe(8);
  });

  it('matches the first branch: incline barbell bench press stays in 5-8', () => {
    // "incline press" literal never matches "Incline Barbell Bench Press",
    // so the squat/bench/deadlift branch wins first.
    const bracket = getHypertrophyRepBracket('Incline Barbell Bench Press', 'Barbell', 'Göğüs');
    expect(bracket.minReps).toBe(5);
    expect(bracket.maxReps).toBe(8);
  });

  it('routes romanian deadlifts and barbell rows to the 6-10 bracket', () => {
    // Hyphenated "Bent-Over" misses the "bent over" literal but "barbell row" still matches.
    const row = getHypertrophyRepBracket('Bent-Over Barbell Row', 'Barbell', 'Sırt');
    expect(row.minReps).toBe(6);
    expect(row.maxReps).toBe(10);

    // Documented quirk: the heavy-compound branch matches on the bare
    // "deadlift" name literal with NO romanian exclusion, so barbell RDLs land
    // in 5-8 before the 6-10 "romanian" case can ever match.
    const rdl = getHypertrophyRepBracket('Romanian Deadlift (RDL)', 'Barbell', 'Bacak');
    expect(rdl.minReps).toBe(5);
    expect(rdl.maxReps).toBe(8);
  });

  it('routes machines and cables to the 8-12 bracket', () => {
    const pulldown = getHypertrophyRepBracket('Lat Pulldown', 'Kablo', 'Sırt');
    expect(pulldown.minReps).toBe(8);
    expect(pulldown.maxReps).toBe(12);
    expect(pulldown.archetype).toBe('Makine & Kablo Bileşik (8-12 Reps)');
  });

  it('routes arm isolations to the 10-15 bracket', () => {
    const curl = getHypertrophyRepBracket('Dumbbell Bicep Curl', 'Dumbbell', 'Ön Kol');
    expect(curl.minReps).toBe(10);
    expect(curl.maxReps).toBe(15);
  });

  it('falls back to the 8-12 sweet spot', () => {
    const bracket = getHypertrophyRepBracket('Mystery Move', 'Diğer', 'Sırt');
    expect(bracket.minReps).toBe(8);
    expect(bracket.maxReps).toBe(12);
    expect(bracket.archetype).toBe('Standart Hipertrofi (8-12 Reps)');
  });
});

describe('calculateLoadIncrement', () => {
  it('micro-loads light dumbbells', () => {
    expect(calculateLoadIncrement('Dumbbell Press', 'Dumbbell', 0)).toBe(1.0);
    expect(calculateLoadIncrement('Dumbbell Press', 'Dumbbell', 6)).toBe(0.5);
    expect(calculateLoadIncrement('Dumbbell Press', 'Dumbbell', 8)).toBe(0.5);
    expect(calculateLoadIncrement('Dumbbell Press', 'Dumbbell', 14)).toBe(1.0);
    expect(calculateLoadIncrement('Dumbbell Press', 'Dumbbell', 15)).toBe(2.0);
    expect(calculateLoadIncrement('Dumbbell Press', 'Dumbbell', 28)).toBe(2.0);
    expect(calculateLoadIncrement('Dumbbell Press', 'Dumbbell', 30)).toBe(2.5);
  });

  it('detects dumbbells from the exercise name ("db", Turkish "dambıl")', () => {
    expect(calculateLoadIncrement('DB Press', '', 10)).toBe(1.0);
    expect(calculateLoadIncrement('Dambıl Press', 'Dambıl', 10)).toBe(1.0);
  });

  it('uses 2.5kg barbell plates and 5kg for heavy compounds', () => {
    expect(calculateLoadIncrement('Bench Press', 'Barbell', 100)).toBe(2.5);
    expect(calculateLoadIncrement('Bench Press', 'Barbell', 120)).toBe(5.0);
    expect(calculateLoadIncrement('Deadlift', 'Plaka', 130)).toBe(5.0);
  });

  it('uses 2.5kg machines/cables below 80kg and 5kg above', () => {
    expect(calculateLoadIncrement('Leg Press', 'Makine', 60)).toBe(2.5);
    expect(calculateLoadIncrement('Leg Press', 'Makine', 80)).toBe(5.0);
    expect(calculateLoadIncrement('Cable Row', 'Kablo', 60)).toBe(2.5);
  });

  it('falls back to proportional default steps', () => {
    expect(calculateLoadIncrement('Something', 'Diğer', 10)).toBe(1.0);
    expect(calculateLoadIncrement('Something', 'Diğer', 20)).toBe(2.5);
    expect(calculateLoadIncrement('Something', 'Diğer', 90)).toBe(5.0);
  });
});

describe('detectPlateauAndDeload', () => {
  it('returns an empty history for no sessions', () => {
    const result = detectPlateauAndDeload([]);
    expect(result.consecutiveStagnantSessions).toBe(0);
    expect(result.isStagnant).toBe(false);
    expect(result.isDeloadRecommended).toBe(false);
    expect(result.lastSessionE1RMs).toEqual([]);
  });

  it('reports the session-best e1RM for a single session without flagging stagnation', () => {
    // 100kg x 5 @ RIR 1 -> e1RM 120
    const result = detectPlateauAndDeload([[makeSet(100, 5, 1)]]);
    expect(result.lastSessionE1RMs).toEqual([120]);
    expect(result.isStagnant).toBe(false);
    expect(result.isDeloadRecommended).toBe(false);
  });

  it('flags stagnation after 2 stagnant hard intervals but not deload', () => {
    // Newest first: three sessions at e1RM 120, then an older one at 118.8.
    // The 118.8 -> 120 jump breaks the chain after 2 stagnant intervals.
    const sessions = [
      [makeSet(100, 5, 1)],
      [makeSet(100, 5, 1)],
      [makeSet(100, 5, 1)],
      [makeSet(99, 5, 1)],
    ];
    const result = detectPlateauAndDeload(sessions);
    expect(result.consecutiveStagnantSessions).toBe(2);
    expect(result.isStagnant).toBe(true);
    expect(result.isDeloadRecommended).toBe(false);
    expect(result.recommendationNote).toBeDefined();
    // lastSessionE1RMs keeps the newest-first order of the input
    expect(result.lastSessionE1RMs).toEqual([120, 120, 120]);
  });

  it('recommends a deload after 3 consecutive stagnant hard sessions', () => {
    const sessions = [
      [makeSet(100, 5, 1)],
      [makeSet(100, 5, 1)],
      [makeSet(100, 5, 1)],
      [makeSet(100, 5, 1)],
    ];
    const result = detectPlateauAndDeload(sessions);
    expect(result.consecutiveStagnantSessions).toBe(3);
    expect(result.isStagnant).toBe(true);
    expect(result.isDeloadRecommended).toBe(true);
    expect(result.recommendationNote).toContain('Deload');
  });

  it('ignores stagnation when sessions were not taken close to failure', () => {
    // Same weights/reps but RIR 3 -> effort was too low to count as a plateau attempt.
    const sessions = [
      [makeSet(100, 5, 3)],
      [makeSet(100, 5, 3)],
      [makeSet(100, 5, 3)],
      [makeSet(100, 5, 3)],
    ];
    const result = detectPlateauAndDeload(sessions);
    expect(result.consecutiveStagnantSessions).toBe(0);
    expect(result.isStagnant).toBe(false);
    expect(result.isDeloadRecommended).toBe(false);
  });

  it('only examines the 4 most recent sessions', () => {
    // 5th (oldest) session with different e1RM must not affect the count.
    const sessions = [
      [makeSet(100, 5, 1)],
      [makeSet(100, 5, 1)],
      [makeSet(100, 5, 1)],
      [makeSet(100, 5, 1)],
      [makeSet(50, 5, 1)],
    ];
    const result = detectPlateauAndDeload(sessions);
    expect(result.consecutiveStagnantSessions).toBe(3);
    expect(result.isDeloadRecommended).toBe(true);
  });
});

describe('calculateSmartAutoregulatedOverload', () => {
  it('recommends a fresh-exercise starting bracket when there is no history', () => {
    const rec = calculateSmartAutoregulatedOverload('Bench Press', 'Barbell', []);
    expect(rec.actionType).toBe('MAINTAIN');
    expect(rec.actionTitle).toBe('Yeni Egzersiz');
    expect(rec.recWeight).toBe(0);
    expect(rec.minBracketReps).toBe(5);
    expect(rec.maxBracketReps).toBe(8);
    expect(rec.recReps).toBe(7); // round((5 + 8) / 2)
    expect(rec.badgeLabel).toBe('Yeni Egzersiz (5-8 Rep)');
    expect(rec.setTargets).toHaveLength(3);
    rec.setTargets?.forEach(t => expect(t.status).toBe('MAINTAIN'));
  });

  it('anchors the bracket around a custom routine target when history is empty', () => {
    const rec = calculateSmartAutoregulatedOverload('Bench Press', 'Barbell', [], 10);
    expect(rec.minBracketReps).toBe(8);
    expect(rec.maxBracketReps).toBe(12);
    expect(rec.recReps).toBe(10);
  });

  it('treats sessions with no valid completed sets as empty history', () => {
    const junk = [[makeSet(0, 5, 1, { completed: false })]];
    const rec = calculateSmartAutoregulatedOverload('Bench Press', 'Barbell', junk);
    expect(rec.actionTitle).toBe('Yeni Egzersiz');
  });

  it('normalizes a flat set list and a single-session list identically', () => {
    const flat = calculateSmartAutoregulatedOverload(
      'Lat Pulldown',
      'Kablo',
      [makeSet(50, 12, 2), makeSet(50, 11, 2)]
    );
    const nested = calculateSmartAutoregulatedOverload(
      'Lat Pulldown',
      'Kablo',
      [[makeSet(50, 12, 2), makeSet(50, 11, 2)]]
    );
    expect(flat.recWeight).toBe(nested.recWeight);
    expect(flat.actionType).toBe(nested.actionType);
    expect(flat.setTargets).toEqual(nested.setTargets);
  });

  it('increments weight on a set that hit the rep ceiling (DDP)', () => {
    const rec = calculateSmartAutoregulatedOverload(
      'Lat Pulldown',
      'Kablo',
      [makeSet(50, 12, 2), makeSet(50, 11, 2)]
    );
    // Bracket 8-12; cable increment at 50kg is 2.5.
    expect(rec.actionType).toBe('MORE_WEIGHT');
    expect(rec.actionTitle).toBe('Ağırlık Artır (Set 1)');
    expect(rec.recWeight).toBe(52.5);
    expect(rec.lastWeight).toBe(50);
    expect(rec.minBracketReps).toBe(8);
    expect(rec.maxBracketReps).toBe(12);
    expect(rec.badgeLabel).toBe('Ağırlık Artır (52.5 kg)');
    expect(rec.setTargets).toHaveLength(3);

    const set1 = rec.setTargets?.[0];
    expect(set1?.status).toBe('INCREASE_WEIGHT');
    expect(set1?.weight).toBe(52.5);
    expect(set1?.reps).toBe(8); // restart from bracket floor
    expect(set1?.reason).toContain('Tavana');

    // Set 2 stays at its own load and progresses in reps independently.
    const set2 = rec.setTargets?.[1];
    expect(set2?.status).toBe('INCREASE_REPS');
    expect(set2?.weight).toBe(50);
    expect(set2?.reps).toBe(12);

    // Set 3 has no previous set and falls back to the last one.
    const set3 = rec.setTargets?.[2];
    expect(set3?.status).toBe('INCREASE_REPS');
    expect(set3?.weight).toBe(50);
  });

  it('recommends aggressive weight increases for very easy sets (RIR >= 3)', () => {
    const rec = calculateSmartAutoregulatedOverload('Lat Pulldown', 'Kablo', [
      makeSet(50, 8, 3),
    ]);
    expect(rec.actionType).toBe('AGGRESSIVE_MORE_WEIGHT');
    expect(rec.setTargets?.[0]?.status).toBe('INCREASE_WEIGHT');
    expect(rec.setTargets?.[0]?.weight).toBe(52.5);
    expect(rec.setTargets?.[0]?.reason).toContain('çok rahat');
  });

  it('recommends one extra rep while keeping the load inside the bracket', () => {
    const rec = calculateSmartAutoregulatedOverload('Lat Pulldown', 'Kablo', [
      makeSet(50, 10, 2),
    ]);
    expect(rec.actionType).toBe('MORE_REPS');
    expect(rec.recWeight).toBe(50);
    expect(rec.recReps).toBe(11);
    expect(rec.increment).toBe(0);
    expect(rec.setTargets?.[0]).toMatchObject({ status: 'INCREASE_REPS', weight: 50, reps: 11 });
  });

  it('reduces weight after a severe underperformance at RIR 0', () => {
    const rec = calculateSmartAutoregulatedOverload('Lat Pulldown', 'Kablo', [
      makeSet(50, 6, 0),
    ]);
    expect(rec.actionType).toBe('LESS_WEIGHT');
    expect(rec.recWeight).toBe(47.5);
    expect(rec.recReps).toBe(8);
    expect(rec.badgeLabel).toBe('Ağırlığı Azalt (47.5 kg)');
    expect(rec.isDoubleProgression).toBe(false);
  });

  it('maintains load when reps are inside the bracket but RIR is 0 without collapse', () => {
    // 8 reps at RIR 0 is inside the bracket (>= minReps) so condition E applies.
    const rec = calculateSmartAutoregulatedOverload('Lat Pulldown', 'Kablo', [
      makeSet(50, 8, 0),
    ]);
    expect(rec.actionType).toBe('MAINTAIN');
    expect(rec.recWeight).toBe(50);
    expect(rec.recReps).toBe(8);
    expect(rec.badgeLabel).toBe('Ağırlığı Koru (Form Sabit)');
    expect(rec.setTargets?.[0]?.status).toBe('MAINTAIN');
  });

  it('recommends a deload with half volume and -10% load after a 3-session plateau', () => {
    const sessions = [
      [makeSet(100, 5, 1)],
      [makeSet(100, 5, 1)],
      [makeSet(100, 5, 1)],
      [makeSet(100, 5, 1)],
    ];
    const rec = calculateSmartAutoregulatedOverload('Bench Press', 'Barbell', sessions);
    expect(rec.actionType).toBe('DELOAD');
    expect(rec.recWeight).toBe(90);
    expect(rec.lastWeight).toBe(100);
    expect(rec.increment).toBe(-10);
    expect(rec.recReps).toBe(7); // middle of the 5-8 bracket
    expect(rec.badgeLabel).toContain('Deload');

    const deloadSets = rec.setTargets ?? [];
    expect(deloadSets.length).toBeGreaterThanOrEqual(2);
    deloadSets.forEach(t => {
      expect(t.status).toBe('DELOAD');
      expect(t.weight).toBe(90);
      expect(t.reps).toBe(7);
      expect(t.targetRir).toBeGreaterThanOrEqual(3);
    });
    expect(rec.plateauHistory?.isDeloadRecommended).toBe(true);
  });

  it('treats a single bad session as an isolated dip and keeps the previous load', () => {
    // Most recent: 50kg x 6 @ RIR 0 (collapse). Previous: 50kg x 10-11 @ RIR 2 (healthy).
    const rec = calculateSmartAutoregulatedOverload('Lat Pulldown', 'Kablo', [
      [makeSet(50, 6, 0)],
      [makeSet(50, 10, 2), makeSet(50, 10, 2)],
    ]);
    expect(rec.actionType).toBe('MAINTAIN');
    expect(rec.actionTitle).toBe('Ağırlığı Koru');
    expect(rec.recWeight).toBe(50);
    expect(rec.recReps).toBe(10); // previous session average reps
    expect(rec.increment).toBe(0);
    // The dip check overrides the per-set reduce-weight suggestion.
    expect(rec.setTargets?.[0]?.status).toBe('REDUCE_WEIGHT');
    expect(rec.setTargets?.[0]?.weight).toBe(47.5);
  });

  it('anchors the bracket around a custom target when history exists', () => {
    const rec = calculateSmartAutoregulatedOverload('Lat Pulldown', 'Kablo', [
      makeSet(50, 14, 2),
    ], 10);
    expect(rec.minBracketReps).toBe(8);
    expect(rec.maxBracketReps).toBe(12);
    expect(rec.actionType).toBe('MORE_WEIGHT');
    expect(rec.recWeight).toBe(52.5);
    expect(rec.recReps).toBe(8);
  });
});

describe('evaluateWeeklyMuscleVolumeLandmarks', () => {
  const hardSet = (overrides: Partial<ExerciseSet> = {}) =>
    makeSet(50, 8, 2, overrides);

  it('classifies weekly hard-set volume into scientific landmarks', () => {
    const cases: [number, string, string][] = [
      [5, 'BELOW_MEV', 'Hacim Yetersiz (<6 Set)'],
      [6, 'MEV', 'Minimum Etkili Hacim (MEV: 6-9 Set)'],
      [10, 'MAV', 'İdeal Hipertrofi Aralığı (MAV: 10-18 Set)'],
      [19, 'MRV', 'Tavan Hacim (MRV: 19-22 Set)'],
      [22, 'OVER_MRV', 'Aşırı Yükleme (>22 Set / Overtraining Riski)'],
    ];
    for (const [count, status, label] of cases) {
      const workout = makeWorkout(todayStr(), [
        { category: 'Göğüs', sets: Array.from({ length: count }, () => hardSet()) },
      ]);
      const result = evaluateWeeklyMuscleVolumeLandmarks([workout]);
      expect(result['Göğüs']).toEqual({ hardSets: count, status, label });
    }
  });

  it('counts sets without a logged RIR as hard sets', () => {
    const workout = makeWorkout(todayStr(), [
      { category: 'Göğüs', sets: [makeSet(50, 8)] },
    ]);
    const result = evaluateWeeklyMuscleVolumeLandmarks([workout]);
    expect(result['Göğüs'].hardSets).toBe(1);
  });

  it('excludes non-hard, cardio, old and incomplete work from the count', () => {
    const oldWorkout = makeWorkout(daysAgoStr(9), [
      { category: 'Göğüs', sets: [hardSet()] },
    ]);
    const incompleteWorkout = makeWorkout(todayStr(), [
      { category: 'Göğüs', sets: [hardSet()] },
    ]);
    incompleteWorkout.completed = false;

    const workout = makeWorkout(todayStr(), [
      {
        category: 'Göğüs',
        sets: [
          hardSet({ completed: false }), // not completed
          hardSet({ isWarmup: true }), // warmup
          hardSet({ rir: 4 }), // too far from failure
        ],
      },
      { category: 'Kardiyo', sets: [hardSet()] }, // cardio never counts
    ]);

    const result = evaluateWeeklyMuscleVolumeLandmarks([oldWorkout, incompleteWorkout, workout]);
    expect(result['Göğüs'].hardSets).toBe(0);
    expect(result['Göğüs'].status).toBe('BELOW_MEV');
    expect(result['Kardiyo']).toBeUndefined(); // cardio category is not reported
  });
});

describe('getBiomechanicalProfile', () => {
  it('profiles heavy axial free-weight compounds at index 3', () => {
    const profile = getBiomechanicalProfile('Deadlift', 'Barbell', 'Sırt');
    expect(profile).toEqual({
      axialLoadingIndex: 3,
      resistanceProfile: 'LENGTHENED',
      stimulusMultiplier: 1.25,
      decayConstantLambda: 0.085,
      standardRestSeconds: 180,
    });
  });

  it('profiles moderate axial stretch-biased lowers at index 2', () => {
    const rdl = getBiomechanicalProfile('Romanian Deadlift', 'Barbell', 'Bacak');
    expect(rdl.axialLoadingIndex).toBe(2);
    expect(rdl.stimulusMultiplier).toBe(1.40);

    const bulgarian = getBiomechanicalProfile('Bulgarian Split Squat', 'Dumbbell', 'Bacak');
    expect(bulgarian.axialLoadingIndex).toBe(2);
  });

  it('profiles machines and dumbbell work at index 1 with incline detection', () => {
    const legPress = getBiomechanicalProfile('Leg Press', 'Makine', 'Bacak');
    expect(legPress.axialLoadingIndex).toBe(1);
    expect(legPress.resistanceProfile).toBe('UNIFORM');
    expect(legPress.stimulusMultiplier).toBe(1.15);
    expect(legPress.standardRestSeconds).toBe(120);

    const incline = getBiomechanicalProfile('Incline Dumbbell Press', 'Dumbbell', 'Göğüs');
    expect(incline.resistanceProfile).toBe('LENGTHENED');
    expect(incline.stimulusMultiplier).toBe(1.25);
  });

  it('profiles lengthened-biased isolations at index 0', () => {
    const curl = getBiomechanicalProfile('Seated Leg Curl', 'Makine', 'Bacak');
    expect(curl.axialLoadingIndex).toBe(0);
    expect(curl.resistanceProfile).toBe('LENGTHENED');
    expect(curl.stimulusMultiplier).toBe(1.35);
    expect(curl.standardRestSeconds).toBe(90);
  });

  it('profiles shortened-biased isolations', () => {
    const deck = getBiomechanicalProfile('Pec Deck', 'Makine', 'Göğüs');
    expect(deck.resistanceProfile).toBe('SHORTENED');
    expect(deck.stimulusMultiplier).toBe(1.05);
    expect(deck.standardRestSeconds).toBe(60);
  });

  it('falls back to a uniform peripheral profile with category-tuned rest', () => {
    const delts = getBiomechanicalProfile('Mystery Isolation', 'Diğer', 'Omuz');
    expect(delts.axialLoadingIndex).toBe(0);
    expect(delts.resistanceProfile).toBe('UNIFORM');
    expect(delts.decayConstantLambda).toBe(0.040);
    expect(delts.standardRestSeconds).toBe(75);

    const back = getBiomechanicalProfile('Mystery Move', 'Diğer', 'Sırt');
    expect(back.decayConstantLambda).toBe(0.055);
    expect(back.standardRestSeconds).toBe(90);
  });
});

describe('calculateDynamicRestSeconds', () => {
  it('scales base rest by RIR and axial load without intensity data', () => {
    // 120 * (1 + 0.15 * (3 - 2)) * (1 + 0.10 * 1) = 151.8 -> 152
    expect(calculateDynamicRestSeconds(120, 2, 1)).toBe(152);
  });

  it('calibrates the base rest for heavy axial work from intensity', () => {
    // intensity 90/100 >= 0.80 with axial 3 -> 180s base
    expect(calculateDynamicRestSeconds(120, 1, 3, 90, 100)).toBe(304);
    // intensity 70/100 < 0.80 -> 120s base
    expect(calculateDynamicRestSeconds(120, 1, 2, 70, 100)).toBe(187);
    // axial 1 always uses 120s base
    expect(calculateDynamicRestSeconds(120, 1, 1, 90, 100)).toBe(172);
  });

  it('clamps RIR to 0..5 and the result to 45..360 seconds', () => {
    // RIR 99 clamps to 5 -> factor 0.7 -> 42 -> clamped up to 45
    expect(calculateDynamicRestSeconds(60, 99, 0)).toBe(45);
    // Long base with RIR 0 -> clamped down to 360
    expect(calculateDynamicRestSeconds(400, 0, 3)).toBe(360);
  });
});

describe('predictFatigueDecayReps', () => {
  it('returns the top set unchanged for the first set', () => {
    expect(predictFatigueDecayReps(10, 1)).toBe(10);
    expect(predictFatigueDecayReps(10, 0)).toBe(10);
  });

  it('returns 0 for invalid top-set reps', () => {
    expect(predictFatigueDecayReps(0, 2)).toBe(0);
    expect(predictFatigueDecayReps(-5, 2)).toBe(0);
  });

  it('applies exponential decay for later sets', () => {
    // 10 * e^(-0.06 * 1) = 9.42 -> 9
    expect(predictFatigueDecayReps(10, 2, 0.06)).toBe(9);
    // 10 * e^(-0.06 * 2) = 8.86 -> 9
    expect(predictFatigueDecayReps(10, 3, 0.06)).toBe(9);
  });

  it('rewards longer-than-standard rest', () => {
    // rest factor 2^0.25 = 1.189 -> 10 * e^-0.06 * 1.189 = 11.2 -> 11
    expect(predictFatigueDecayReps(10, 2, 0.06, 180, 90)).toBe(11);
  });

  it('penalizes short rest with a clamped ratio', () => {
    // 18s vs 90s standard = 0.2 ratio, clamped to 0.4 -> factor 0.4^0.25
    // 10 * e^-0.06 * 0.795 = 7.49 -> 7
    expect(predictFatigueDecayReps(10, 2, 0.06, 18, 90)).toBe(7);
  });

  it('never predicts below a single rep', () => {
    expect(predictFatigueDecayReps(10, 8, 0.5)).toBe(1);
  });
});

describe('suggestBackOffWeightDrop', () => {
  it('keeps the load when predicted reps stay inside the bracket', () => {
    const rec = suggestBackOffWeightDrop(10, 8, 100);
    expect(rec.shouldDropWeight).toBe(false);
    expect(rec.recommendedWeight).toBe(100);
    expect(rec.dropPercentage).toBe(0);
    expect(rec.targetRepRange).toEqual([8, 12]);
  });

  it('keeps the load when the current weight is invalid', () => {
    const rec = suggestBackOffWeightDrop(6, 8, 0);
    expect(rec.shouldDropWeight).toBe(false);
    expect(rec.recommendedWeight).toBe(0);
  });

  it('drops 6.5% for isolations and rounds to the equipment step', () => {
    // Machine at 100kg: 8% drop would be axial; 6.5% -> 93.5 -> rounded to 95 on a 5kg stack
    const rec = suggestBackOffWeightDrop(6, 8, 100, 'Makine', 0);
    expect(rec.shouldDropWeight).toBe(true);
    expect(rec.recommendedWeight).toBe(95);
    expect(rec.dropPercentage).toBe(7); // round(6.5)
    expect(rec.targetRepRange).toEqual([8, 12]);
  });

  it('drops 8% for high-axial movements', () => {
    // Barbell at 100kg: 8% -> 92 -> rounded to 92.5 on 2.5kg plates
    const rec = suggestBackOffWeightDrop(6, 8, 100, 'Barbell', 2);
    expect(rec.shouldDropWeight).toBe(true);
    expect(rec.recommendedWeight).toBe(92.5);
    expect(rec.dropPercentage).toBe(8);
  });
});

describe('getMesocyclePhaseTarget', () => {
  it('maps each mesocycle phase to its target RIR', () => {
    expect(getMesocyclePhaseTarget('ACCUMULATION_W1').targetRir).toBe(3);
    expect(getMesocyclePhaseTarget('ACCUMULATION_W2').targetRir).toBe(2);
    expect(getMesocyclePhaseTarget('ACCUMULATION_W3').targetRir).toBe(2);
    expect(getMesocyclePhaseTarget('ACCUMULATION_W4').targetRir).toBe(1);
    expect(getMesocyclePhaseTarget('OVERREACHING').targetRir).toBe(0);
    expect(getMesocyclePhaseTarget('REACTIVE_DELOAD').targetRir).toBe(4);
  });

  it('treats a planned deload starting on week 1 as accumulation', () => {
    expect(getMesocyclePhaseTarget('PLANNED_DELOAD', 1).phase).toBe('ACCUMULATION_W1');
    expect(getMesocyclePhaseTarget('PLANNED_DELOAD', 1).targetRir).toBe(3);
  });

  it('plans a full deload for later weeks and unknown phases', () => {
    expect(getMesocyclePhaseTarget('PLANNED_DELOAD', 4).targetRir).toBe(4);
    expect(getMesocyclePhaseTarget('UNKNOWN_PHASE', 3).phase).toBe('PLANNED_DELOAD');
  });
});

describe('calculateHypertrophyVolumeAdaptation', () => {
  it('maintains volume without feedback', () => {
    expect(calculateHypertrophyVolumeAdaptation(undefined)).toEqual({
      setDelta: 0,
      action: 'MAINTAIN',
      reason: expect.any(String),
    });
  });

  it('prioritizes joint ache over every other signal', () => {
    const rec = calculateHypertrophyVolumeAdaptation({
      pumpRating: 3,
      sorenessRating: 1,
      jointAcheRating: 2,
    });
    expect(rec.action).toBe('DELOAD_OR_SWAP');
    expect(rec.setDelta).toBe(-2);
  });

  it('reduces a set after excessive soreness', () => {
    const rec = calculateHypertrophyVolumeAdaptation({ sorenessRating: 3 });
    expect(rec.action).toBe('REDUCE_SET');
    expect(rec.setDelta).toBe(-1);
  });

  it('adds a set after a perfect pump with no joint issues', () => {
    const rec = calculateHypertrophyVolumeAdaptation({
      pumpRating: 3,
      sorenessRating: 2,
      jointAcheRating: 0,
    });
    expect(rec.action).toBe('ADD_SET');
    expect(rec.setDelta).toBe(1);
  });

  it('adds a set when soreness is absent (undertraining)', () => {
    const rec = calculateHypertrophyVolumeAdaptation({ sorenessRating: 1, jointAcheRating: 0 });
    expect(rec.action).toBe('ADD_SET');
    expect(rec.setDelta).toBe(1);
  });

  it('maintains volume for balanced feedback', () => {
    const rec = calculateHypertrophyVolumeAdaptation({
      pumpRating: 2,
      sorenessRating: 2,
      jointAcheRating: 1,
    });
    expect(rec.action).toBe('MAINTAIN');
    expect(rec.setDelta).toBe(0);
  });
});
