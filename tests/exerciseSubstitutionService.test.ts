import { describe, it, expect } from 'vitest';
import { getExerciseSubstitutes } from '../src/services/exerciseSubstitutionService';
import { Exercise } from '../src/types/fitness';

const göğüsPool: Exercise[] = [
  { id: 'src', name: 'Incline Dumbbell Press', category: 'Göğüs', equipment: 'Dumbbell' },
  { id: 'e1', name: 'Dumbbell Flye', category: 'Göğüs', equipment: 'Dumbbell', targetMuscle: 'Göğüs İzolasyon' },
  { id: 'e2', name: 'Cable Crossover / Fly', category: 'Göğüs', equipment: 'Kablo' },
  { id: 'e3', name: 'Barbell Bench Press', category: 'Göğüs', equipment: 'Barbell' },
  // Same name as the source but different id: must be excluded.
  { id: 'e5', name: 'Incline Dumbbell Press', category: 'Göğüs', equipment: 'Makine' },
  // Different muscle category: must be excluded from the pool.
  { id: 'e4', name: 'Barbell Back Squat', category: 'Bacak', equipment: 'Barbell' },
];

// Source: Incline Dumbbell Press -> low-axial compound (dumbbell + "incline") ->
// axial 1, LENGTHENED profile.
const inclineSource = {
  id: 'src',
  name: 'Incline Dumbbell Press',
  category: 'Göğüs' as const,
  equipment: 'Dumbbell',
  targetMuscle: 'Üst Göğüs',
  lastWeight: 30,
  lastReps: 10,
  lastRir: 1,
};

describe('getExerciseSubstitutes', () => {
  it('filters same-id, same-name and cross-category exercises out of the pool', () => {
    const result = getExerciseSubstitutes(inclineSource, göğüsPool);
    expect(result.map(c => c.exercise.id).sort()).toEqual(['e1', 'e2', 'e3']);
  });

  it('scores profile, axial and equipment overlap and orders best-first', () => {
    const result = getExerciseSubstitutes(inclineSource, göğüsPool);

    // Best match: Dumbbell Flye (lengthened profile match +20, lower axial 0 < 1 -> +10,
    // same equipment Dumbbell -> +10) = 90.
    const flye = result[0];
    expect(flye.exercise.id).toBe('e1');
    expect(flye.matchScore).toBe(90);
    expect(flye.axialRating).toBe(0);
    expect(flye.resistanceProfile).toBe('LENGTHENED');
    expect(flye.stretchBiasScore).toBe(1.35);
    expect(flye.matchReason).toContain('Direnç profili eşleşiyor: LENGTHENED');
    expect(flye.matchReason).toContain('Daha düşük omurga/aksiyel yük (A:0 vs A:1)');
    expect(flye.matchReason).toContain('Aynı ekipman: Dumbbell');

    // Second: Cable Crossover / Fly (lengthened profile match +20, lower axial +10) = 80.
    const crossover = result[1];
    expect(crossover.exercise.id).toBe('e2');
    expect(crossover.matchScore).toBe(80);
    expect(crossover.axialRating).toBe(0);
    expect(crossover.resistanceProfile).toBe('LENGTHENED');
    expect(crossover.stretchBiasScore).toBe(1.35);
    expect(crossover.recommendedStartingWeight).toBe(30); // same leverage class, 2.5-rounded

    // Third: Barbell Bench Press (profile partial credit +5, equal axial +5) = 60.
    const bench = result[2];
    expect(bench.exercise.id).toBe('e3');
    expect(bench.matchScore).toBe(60);

    // Ordering is strictly descending.
    const scores = result.map(c => c.matchScore);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it('applies the dumbbell -> barbell leverage ratio (2.2x) to the starting weight', () => {
    const result = getExerciseSubstitutes(inclineSource, göğüsPool);
    const bench = result.find(c => c.exercise.id === 'e3')!;
    // round(30 * 2.2 / 2.5) * 2.5 = 65
    expect(bench.recommendedStartingWeight).toBe(65);
  });

  it('discards higher-axial candidates when lowerAxialOnly is requested', () => {
    // Leg Press source: axial 1. Deadlift (axial 3) and Bulgarian split squat
    // (axial 2) must be dropped; hack squat (axial 1) survives.
    const legsPool: Exercise[] = [
      { id: 'd1', name: 'Barbell Deadlift', category: 'Bacak', equipment: 'Barbell' },
      { id: 'h1', name: 'Hack Squat', category: 'Bacak', equipment: 'Makine' },
      { id: 'b1', name: 'Bulgarian Split Squat', category: 'Bacak', equipment: 'Dumbbell' },
    ];
    const source = {
      name: 'Leg Press',
      category: 'Bacak' as const,
      equipment: 'Makine',
      lastWeight: 100,
      lastReps: 10,
    };

    const all = getExerciseSubstitutes(source, legsPool);
    expect(all.map(c => c.exercise.id)).toEqual(['h1', 'd1', 'b1']);
    // Same equipment + same profile + equal axial makes the hack squat the top pick.
    expect(all[0].matchScore).toBe(85);

    const lowerAxial = getExerciseSubstitutes(source, legsPool, { lowerAxialOnly: true });
    expect(lowerAxial.map(c => c.exercise.id)).toEqual(['h1']);
  });

  it('rewards regional target-muscle overlap with 20 points', () => {
    const source = {
      name: 'Barbell Bench Press',
      category: 'Göğüs' as const,
      equipment: 'Barbell',
      targetMuscle: 'Göğüs',
      lastWeight: 100,
      lastReps: 8,
    };
    const candidates: Exercise[] = [
      { id: 'e1', name: 'Dumbbell Flye', category: 'Göğüs', equipment: 'Dumbbell', targetMuscle: 'Göğüs İzolasyon' },
    ];
    const [flye] = getExerciseSubstitutes(source, candidates);
    // base 50 + target muscle 20 + profile 0 (UNIFORM vs LENGTHENED) + lower axial 10 (0 < 1) = 80
    expect(flye.matchScore).toBe(80);
    expect(flye.axialRating).toBe(0);
    expect(flye.resistanceProfile).toBe('LENGTHENED');
    // barbell -> dumbbell is 0.42; source axial is 1 so no extra axial deload:
    // round(100 * 0.42 / 2.5) * 2.5 = 42.5
    expect(flye.recommendedStartingWeight).toBe(42.5);
  });

  it('applies the barbell -> machine leverage ratio (1.05x)', () => {
    const source = {
      name: 'Barbell Bench Press',
      category: 'Göğüs' as const,
      equipment: 'Barbell',
      targetMuscle: 'Orta Göğüs',
      lastWeight: 100,
      lastReps: 8,
    };
    const candidates: Exercise[] = [
      { id: 'm1', name: 'Bench Press MCH', category: 'Göğüs', equipment: 'Makine', targetMuscle: 'Orta Göğüs' },
    ];
    const [machine] = getExerciseSubstitutes(source, candidates);
    // round(100 * 1.05 / 2.5) * 2.5 = 105
    expect(machine.recommendedStartingWeight).toBe(105);
    // base 50 + target muscle 20 + uniform profile match 20 + equal axial 5 = 95
    expect(machine.matchScore).toBe(95);
    expect(machine.resistanceProfile).toBe('UNIFORM');
  });

  it('caps the match score at 100', () => {
    const source = {
      name: 'Cable Crossover / Fly',
      category: 'Göğüs' as const,
      equipment: 'Kablo',
      targetMuscle: 'İç Göğüs',
      lastWeight: 40,
      lastReps: 12,
    };
    const candidates: Exercise[] = [
      { id: 'cf', name: 'Cable Fly', category: 'Göğüs', equipment: 'Kablo', targetMuscle: 'İç Göğüs' },
    ];
    // 50 + 20 muscle + 20 profile + 5 equal axial + 10 equipment = 105 -> capped
    expect(getExerciseSubstitutes(source, candidates)[0].matchScore).toBe(100);
  });

  it('halves the load when swapping a heavy-axial lift for a pure isolation', () => {
    // Deadlift (axial 3) -> Cable Pullover (axial 0): 0.6 axial deload factor.
    const source = {
      name: 'Barbell Deadlift',
      category: 'Sırt' as const,
      equipment: 'Barbell',
      lastWeight: 100,
      lastReps: 5,
    };
    const candidates: Exercise[] = [
      { id: 'cp', name: 'Cable Pullover', category: 'Sırt', equipment: 'Kablo' },
    ];
    const [pullover] = getExerciseSubstitutes(source, candidates);
    // round(100 * 0.6 / 2.5) * 2.5 = 60
    expect(pullover.recommendedStartingWeight).toBe(60);
    expect(pullover.axialRating).toBe(0);
    expect(pullover.matchScore).toBe(80); // 50 + profile 20 + lower axial 10
  });

  it('recommends zero weight when the source has no load history', () => {
    const result = getExerciseSubstitutes(
      { name: 'Incline Dumbbell Press', category: 'Göğüs' },
      göğüsPool
    );
    expect(result.length).toBeGreaterThan(0);
    result.forEach(c => expect(c.recommendedStartingWeight).toBe(0));
  });

  it('returns an empty list when no same-category exercise exists', () => {
    const result = getExerciseSubstitutes(inclineSource, []);
    expect(result).toEqual([]);
  });
});
