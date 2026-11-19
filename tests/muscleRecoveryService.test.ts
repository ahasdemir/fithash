import { describe, it, expect } from 'vitest';
import {
  calculateHillRecoveryPercentage,
  getRecoveryCategoryAndColor,
  calculateAllMuscleRecovery,
  MUSCLE_RECOVERY_CONFIG,
} from '../src/services/muscleRecoveryService';
import { WorkoutSession, MuscleCategory, ExerciseSet } from '../src/types/fitness';

// Fixed "now" so elapsed-time math never depends on the wall clock.
const NOW = new Date(2026, 10, 19, 12, 0, 0).getTime();
const hoursAgo = (h: number) => NOW - h * 3600_000;

let sessionCounter = 0;
interface ExerciseSpec {
  category: MuscleCategory;
  name: string;
  equipment?: string;
  sets: Partial<ExerciseSet>[];
  sorenessRating?: 1 | 2 | 3;
}

const makeWorkout = (
  endTime: number,
  exercises: ExerciseSpec[],
  overrides: Partial<WorkoutSession> = {}
): WorkoutSession => {
  const date = new Date(endTime);
  const session: WorkoutSession = {
    id: `session_${++sessionCounter}`,
    name: 'Test Antrenmanı',
    date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate()
    ).padStart(2, '0')}`,
    startTime: endTime - 3600_000,
    endTime,
    durationSeconds: 3600,
    exercises: exercises.map((ex, i) => ({
      id: `we_${sessionCounter}_${i}`,
      exerciseId: `ex_${i}`,
      exerciseName: ex.name,
      category: ex.category,
      equipment: 'Barbell',
      sets: ex.sets.map((s, j) => ({
        id: `s_${sessionCounter}_${i}_${j}`,
        setNumber: j + 1,
        weight: 50,
        reps: 8,
        rir: 2,
        completed: true,
        ...s,
      })),
      ...(ex.sorenessRating !== undefined
        ? { feedback: { sorenessRating: ex.sorenessRating } }
        : {}),
    })),
    totalVolume: 0,
    totalSets: 0,
    completed: true,
    ...overrides,
  };
  return session;
};

describe('calculateHillRecoveryPercentage', () => {
  it('is fully fatigued at or before zero elapsed hours', () => {
    expect(calculateHillRecoveryPercentage(0, 48)).toBe(0);
    expect(calculateHillRecoveryPercentage(-5, 48)).toBe(0);
  });

  it('is fully recovered after 7 days regardless of half-life', () => {
    expect(calculateHillRecoveryPercentage(168, 48)).toBe(100);
    expect(calculateHillRecoveryPercentage(200, 70)).toBe(100);
  });

  it('recovers to 50% exactly at the effective half-life', () => {
    expect(calculateHillRecoveryPercentage(48, 48)).toBe(50);
  });

  it('rises monotonically over time (decay curve)', () => {
    const at12 = calculateHillRecoveryPercentage(12, 48);
    const at24 = calculateHillRecoveryPercentage(24, 48);
    const at48 = calculateHillRecoveryPercentage(48, 48);
    const at96 = calculateHillRecoveryPercentage(96, 48);
    expect(at12).toBe(3); // 100 / (1 + 4^2.4)
    expect(at24).toBe(16); // 100 / (1 + 2^2.4)
    expect(at48).toBe(50);
    expect(at96).toBe(84); // 100 / (1 + 0.5^2.4)
    expect(at12).toBeLessThan(at24);
    expect(at24).toBeLessThan(at48);
    expect(at48).toBeLessThan(at96);
  });

  it('clamps tiny half-lives to a 12h floor', () => {
    // 100 / (1 + (12/48)^2.4) = 96.5 -> 97
    expect(calculateHillRecoveryPercentage(48, 6)).toBe(97);
  });

  it('supports a custom Hill exponent', () => {
    // 100 / (1 + 2^4) = 5.88 -> 6
    expect(calculateHillRecoveryPercentage(24, 48, 4)).toBe(6);
  });
});

describe('getRecoveryCategoryAndColor', () => {
  it('classifies up to 40% as fatigued (red)', () => {
    expect(getRecoveryCategoryAndColor(0)).toEqual({ status: 'FATIGUED', colorHex: '#EF4444' });
    expect(getRecoveryCategoryAndColor(40)).toEqual({ status: 'FATIGUED', colorHex: '#EF4444' });
  });

  it('classifies 41-79% as recovering (amber)', () => {
    expect(getRecoveryCategoryAndColor(41)).toEqual({ status: 'RECOVERING', colorHex: '#F59E0B' });
    expect(getRecoveryCategoryAndColor(79)).toEqual({ status: 'RECOVERING', colorHex: '#F59E0B' });
  });

  it('classifies 80%+ as recovered (green)', () => {
    expect(getRecoveryCategoryAndColor(80)).toEqual({ status: 'RECOVERED', colorHex: '#10B981' });
    expect(getRecoveryCategoryAndColor(100)).toEqual({ status: 'RECOVERED', colorHex: '#10B981' });
  });
});

describe('calculateAllMuscleRecovery', () => {
  it('reports every muscle as fully recovered with no workout history', () => {
    const result = calculateAllMuscleRecovery([], NOW);
    const categories = Object.keys(MUSCLE_RECOVERY_CONFIG) as MuscleCategory[];
    expect(Object.keys(result).sort()).toEqual([...categories].sort());

    for (const cat of categories) {
      expect(result[cat]).toMatchObject({
        muscleId: cat,
        recoveryPercentage: 100,
        hoursSinceTrained: 168,
        status: 'RECOVERED',
        colorHex: '#10B981',
        accumulatedFatigueMultiplier: 1.0,
        hardSetsInWindow: 0,
      });
      expect(result[cat].lastTrainedDateStr).toBeUndefined();
    }
  });

  it('ignores workouts with future timestamps', () => {
    const workout = makeWorkout(NOW + 10 * 3600_000, [
      { category: 'Göğüs', name: 'Barbell Bench Press', sets: [{}, {}, {}] },
    ]);
    const result = calculateAllMuscleRecovery([workout], NOW);
    expect(result['Göğüs']).toMatchObject({
      recoveryPercentage: 100,
      status: 'RECOVERED',
      hardSetsInWindow: 0,
    });
  });

  it('ignores uncompleted workouts', () => {
    const workout = makeWorkout(
      hoursAgo(24),
      [{ category: 'Göğüs', name: 'Barbell Bench Press', sets: [{}, {}] }],
      { completed: false }
    );
    const result = calculateAllMuscleRecovery([workout], NOW);
    expect(result['Göğüs'].status).toBe('RECOVERED');
    expect(result['Göğüs'].hardSetsInWindow).toBe(0);
  });

  it('ignores workouts older than 7 days', () => {
    const workout = makeWorkout(hoursAgo(200), [
      { category: 'Bacak', name: 'Leg Press', sets: [{}, {}] },
    ]);
    const result = calculateAllMuscleRecovery([workout], NOW);
    expect(result['Bacak'].status).toBe('RECOVERED');
    expect(result['Bacak'].hardSetsInWindow).toBe(0);
  });

  it('computes baseline recovery from the latest session', () => {
    // Barbell Bench Press: uniform profile, axial 1 -> no half-life modifiers.
    const workout = makeWorkout(hoursAgo(24), [
      { category: 'Göğüs', name: 'Barbell Bench Press', sets: [{}, {}, {}] },
    ]);
    const result = calculateAllMuscleRecovery([workout], NOW);

    // 24h elapsed with a 48h half-life -> 16% recovered (Hill with beta 2.4)
    expect(result['Göğüs']).toMatchObject({
      muscleName: 'Göğüs',
      recoveryPercentage: 16,
      hoursSinceTrained: 24,
      status: 'FATIGUED',
      colorHex: '#EF4444',
      accumulatedFatigueMultiplier: 1.0,
      hardSetsInWindow: 3,
    });
    expect(result['Göğüs'].lastTrainedDateStr).toBe(workout.date);

    // Untouched categories stay fully recovered.
    expect(result['Sırt'].status).toBe('RECOVERED');
  });

  it('uses the newest session timestamp when several workouts hit the same muscle', () => {
    const older = makeWorkout(hoursAgo(70), [
      { category: 'Göğüs', name: 'Barbell Bench Press', sets: [{}, {}] },
    ]);
    const newer = makeWorkout(hoursAgo(30), [
      { category: 'Göğüs', name: 'Barbell Bench Press', sets: [{}, {}] },
    ]);
    const result = calculateAllMuscleRecovery([newer, older], NOW);
    // 48h half-life, 30h elapsed -> 100 / (1 + 1.6^2.4) = 24.45 -> 24
    expect(result['Göğüs'].hoursSinceTrained).toBe(30);
    expect(result['Göğüs'].recoveryPercentage).toBe(24);
    expect(result['Göğüs'].hardSetsInWindow).toBe(4); // both sessions accumulate
  });

  it('aggregates hard sets across exercises and applies the volume penalty', () => {
    const older = makeWorkout(hoursAgo(48), [
      { category: 'Sırt', name: 'Lat Pulldown', sets: [{}, {}] },
    ]);
    const newer = makeWorkout(hoursAgo(24), [
      { category: 'Sırt', name: 'Seated Cable Row', sets: [{}, {}, {}] },
      { category: 'Sırt', name: 'Barbell Row', sets: [{}, {}] },
    ]);
    const result = calculateAllMuscleRecovery([newer, older], NOW);

    // 7 hard sets > 5 -> 48h * (1 + 2 * 0.04) = 51.84h effective half-life
    expect(result['Sırt'].hardSetsInWindow).toBe(7);
    expect(result['Sırt'].accumulatedFatigueMultiplier).toBeCloseTo(1.08, 2);
    // 100 / (1 + (51.84/24)^2.4) = 13.6 -> 14
    expect(result['Sırt'].recoveryPercentage).toBe(14);
    expect(result['Sırt'].status).toBe('FATIGUED');
  });

  it('stretches the half-life for lengthened, high-axial work', () => {
    // Back Squat: lengthened (x1.3) + axial 3 (+12h) on a 54h base -> 82.2h.
    const workout = makeWorkout(hoursAgo(12), [
      { category: 'Bacak', name: 'Barbell Back Squat', equipment: 'Barbell', sets: [{}] },
    ]);
    const result = calculateAllMuscleRecovery([workout], NOW);
    expect(result['Bacak'].accumulatedFatigueMultiplier).toBeCloseTo(1.52, 2);
    // 100 / (1 + (82.2/12)^2.4) = 0.98 -> 1
    expect(result['Bacak'].recoveryPercentage).toBe(1);
    expect(result['Bacak'].status).toBe('FATIGUED');
  });

  it('stretches the half-life after excessive soreness feedback', () => {
    const workout = makeWorkout(hoursAgo(24), [
      {
        category: 'Ön Kol',
        name: 'Barbell Bicep Curl',
        sets: [{}],
        sorenessRating: 3,
      },
    ]);
    const result = calculateAllMuscleRecovery([workout], NOW);
    // 36h base + 16h soreness penalty = 52h half-life
    expect(result['Ön Kol'].accumulatedFatigueMultiplier).toBeCloseTo(1.44, 2);
    // 100 / (1 + (52/24)^2.4) = 13.5 -> 14
    expect(result['Ön Kol'].recoveryPercentage).toBe(14);
  });

  it('ignores warmup sets entirely', () => {
    const workout = makeWorkout(hoursAgo(24), [
      { category: 'Göğüs', name: 'Barbell Bench Press', sets: [{ isWarmup: true }] },
    ]);
    const result = calculateAllMuscleRecovery([workout], NOW);
    expect(result['Göğüs'].status).toBe('RECOVERED');
    expect(result['Göğüs'].hardSetsInWindow).toBe(0);
    expect(result['Göğüs'].lastTrainedDateStr).toBeUndefined();
  });
});
