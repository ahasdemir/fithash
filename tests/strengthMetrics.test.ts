import { describe, it, expect } from 'vitest';
import {
  buildStrengthOverview,
  classifyCompoundPattern,
  classifySBDGroup,
  isCompoundStrengthExercise,
} from '../src/utils/strengthMetrics';
import { INITIAL_EXERCISES } from '../src/data/exerciseLibrary';
import { EquipmentType, MuscleCategory, WorkoutSession } from '../src/types/fitness';

const makeSession = (
  id: string,
  date: string,
  exercises: {
    name: string;
    category: MuscleCategory;
    equipment?: EquipmentType;
    sets: { weight: number; reps: number; rir?: number; completed?: boolean; isWarmup?: boolean }[];
  }[],
  completed = true
): WorkoutSession => ({
  id,
  name: `Session ${id}`,
  date,
  startTime: new Date(date).getTime(),
  durationSeconds: 3600,
  totalVolume: 5000,
  totalSets: exercises.reduce((acc, ex) => acc + ex.sets.length, 0),
  completed,
  exercises: exercises.map((ex, idx) => ({
    id: `${id}_ex_${idx}`,
    exerciseId: `ex_${idx}`,
    exerciseName: ex.name,
    category: ex.category,
    equipment: ex.equipment ?? 'Barbell',
    sets: ex.sets.map((s, sIdx) => ({
      id: `${id}_ex_${idx}_s_${sIdx}`,
      setNumber: sIdx + 1,
      weight: s.weight,
      reps: s.reps,
      rir: s.rir ?? 1,
      completed: s.completed ?? true,
      isWarmup: s.isWarmup ?? false,
    })),
  })),
});

describe('classifySBDGroup', () => {
  it('classifies Squat, Bench, and Deadlift variations accurately', () => {
    expect(classifySBDGroup('Barbell Back Squat', 'Bacak')).toBe('squat');
    expect(classifySBDGroup('Barbell Front Squat', 'Bacak')).toBe('squat');
    expect(classifySBDGroup('Hack Squat Machine', 'Bacak')).toBe('squat');
    expect(classifySBDGroup('Bulgarian Split Squat', 'Bacak')).toBe('squat');
    expect(classifySBDGroup('Pendulum Squat Machine', 'Bacak')).toBe('squat');

    expect(classifySBDGroup('Barbell Bench Press', 'Göğüs')).toBe('bench');
    expect(classifySBDGroup('Bench Press MCH', 'Göğüs')).toBe('bench');
    expect(classifySBDGroup('Incline Dumbbell Press', 'Göğüs')).toBe('bench');
    expect(classifySBDGroup('Incline Press MCH', 'Göğüs')).toBe('bench');
    expect(classifySBDGroup('Close-Grip Bench Press', 'Arka Kol')).toBe('bench');
    expect(classifySBDGroup('Chest Press MCH', 'Göğüs')).toBe('bench');

    expect(classifySBDGroup('Barbell Deadlift', 'Sırt')).toBe('deadlift');
    expect(classifySBDGroup('Sumo Deadlift', 'Sırt')).toBe('deadlift');
    expect(classifySBDGroup('Romanian Deadlift (RDL)', 'Sırt')).toBe('deadlift');
    expect(classifySBDGroup('Dumbbell Romanian Deadlift', 'Bacak')).toBe('deadlift');
    expect(classifySBDGroup('Trap Bar Deadlift', 'Bacak')).toBe('deadlift');
  });

  it('rejects false positives and non-SBD movements', () => {
    expect(classifySBDGroup('Calf Raise (Hacksquat)', 'Bacak')).toBeNull();
    expect(classifySBDGroup('Sissy Squat', 'Bacak')).toBeNull();
    expect(classifySBDGroup('Decline Bench Crunch', 'Karın')).toBeNull();
    expect(classifySBDGroup('Bench Dips', 'Arka Kol')).toBeNull();
    expect(classifySBDGroup('Chest Dips', 'Göğüs')).toBeNull();
    expect(classifySBDGroup('Leg Press', 'Bacak')).toBeNull();
    expect(classifySBDGroup('Barbell Hip Thrust', 'Bacak')).toBeNull();
  });
});

describe('classifyCompoundPattern & INITIAL_EXERCISES audit', () => {
  it('excludes all isolation, core, and cardio exercises in INITIAL_EXERCISES', () => {
    const mustBeExcluded = [
      'Fly Machine',
      'Incline Fly MCH',
      'Cable Crossover / Fly',
      'Dumbbell Flye',
      'Dumbbell Pullover',
      'Machine Pullover',
      'Face Pull',
      'Straight-Arm Cable Pulldown',
      'Back Extension (Hyperextension)',
      'Leg Extension',
      'Leg Curl',
      'Lying Leg Curl',
      'Seated Leg Curl',
      'Kneeling Leg Curl MCH',
      'Calf Raise (Hacksquat)',
      'Seated Calf Raise',
      'Standing Calf Raise',
      'Leg Press Calf Raise',
      'Hip Abductor Machine',
      'Hip Adductor Machine',
      'Cable Glute Kickback',
      'Sissy Squat',
      'Glute Ham Developer (GHD)',
      'Anterior Tibialis Raise',
      'Lateral Raise (Dropset)',
      'Cable Lateral Raise',
      'Machine Lateral Raise',
      'Reverse Fly',
      'Dumbbell Front Raise',
      'Barbell Shrug',
      'Dumbbell Shrug',
      'Barbell Upright Row',
      'Biceps Curl',
      'Barbell Curl',
      'Hammer Curl',
      'Preacher Curl',
      'Machine Curl',
      'Rope Pushdown',
      'Bar Pushdown',
      'EZ-Bar Skullcrusher',
      'Overhead Dumbbell Triceps Extension',
      'Cable Overhead Triceps Extension',
      'Triceps Press',
      'Triceps Press MCH',
      'Triceps Extension Machine',
      'Plank',
      'Hanging Leg Raise',
      'Decline Bench Crunch',
      'Koşu Bandı',
      'Eliptik Bisiklet',
      'Overhead Cable Extension',
    ];

    for (const name of mustBeExcluded) {
      const libEx = INITIAL_EXERCISES.find(e => e.name === name);
      expect(isCompoundStrengthExercise(name, libEx?.category), `${name} should be excluded`).toBe(
        false
      );
    }
  });

  it('includes core compound movements across all 6 movement patterns', () => {
    expect(classifyCompoundPattern('Barbell Back Squat', 'Bacak')).toBe('squat');
    expect(classifyCompoundPattern('Leg Press', 'Bacak')).toBe('squat');
    expect(classifyCompoundPattern('Dumbbell Walking Lunge', 'Bacak')).toBe('squat');

    expect(classifyCompoundPattern('Barbell Deadlift', 'Sırt')).toBe('hinge');
    expect(classifyCompoundPattern('Romanian Deadlift (RDL)', 'Sırt')).toBe('hinge');
    expect(classifyCompoundPattern('Barbell Hip Thrust', 'Bacak')).toBe('hinge');

    expect(classifyCompoundPattern('Barbell Bench Press', 'Göğüs')).toBe('horizontal_push');
    expect(classifyCompoundPattern('Bench Press MCH', 'Göğüs')).toBe('horizontal_push');
    expect(classifyCompoundPattern('Incline Press MCH', 'Göğüs')).toBe('horizontal_push');
    expect(classifyCompoundPattern('Chest Dips', 'Göğüs')).toBe('horizontal_push');

    expect(classifyCompoundPattern('Overhead Barbell Press (OHP)', 'Omuz')).toBe('vertical_push');
    expect(classifyCompoundPattern('Overhead Press MCH', 'Omuz')).toBe('vertical_push');
    expect(classifyCompoundPattern('Dumbbell Shoulder Press', 'Omuz')).toBe('vertical_push');

    expect(classifyCompoundPattern('Pull-Up', 'Sırt')).toBe('vertical_pull');
    expect(classifyCompoundPattern('Lat Pulldown', 'Sırt')).toBe('vertical_pull');

    expect(classifyCompoundPattern('Bent-Over Barbell Row', 'Sırt')).toBe('horizontal_pull');
    expect(classifyCompoundPattern('T-Bar Row (Chest Supported)', 'Sırt')).toBe('horizontal_pull');
    expect(classifyCompoundPattern('Dumbbell Row', 'Sırt')).toBe('horizontal_pull');
  });
});

describe('buildStrengthOverview', () => {
  const nowMs = new Date(2026, 10, 23).getTime(); // 2026-11-23

  it('aggregates SBD variations, computes total when all 3 exist, and lists extra variations', () => {
    const workouts: WorkoutSession[] = [
      makeSession('w1', '2026-11-18', [
        {
          name: 'Barbell Back Squat',
          category: 'Bacak',
          equipment: 'Barbell',
          sets: [
            { weight: 60, reps: 10, isWarmup: true },
            { weight: 120, reps: 5, rir: 1 },
          ],
        },
        {
          name: 'Hack Squat Machine',
          category: 'Bacak',
          equipment: 'Makine',
          sets: [{ weight: 100, reps: 8, rir: 1 }],
        },
        {
          name: 'Barbell Bench Press',
          category: 'Göğüs',
          equipment: 'Barbell',
          sets: [{ weight: 90, reps: 5, rir: 1 }],
        },
        {
          name: 'Incline Dumbbell Press',
          category: 'Göğüs',
          equipment: 'Dumbbell',
          sets: [{ weight: 35, reps: 8, rir: 1 }],
        },
        {
          name: 'Romanian Deadlift (RDL)',
          category: 'Sırt',
          equipment: 'Barbell',
          sets: [{ weight: 130, reps: 6, rir: 1 }],
        },
      ]),
    ];

    const overview = buildStrengthOverview(workouts, { nowMs });

    expect(overview.sbd.loggedCount).toBe(3);
    expect(overview.sbd.squat.primary?.exerciseName).toBe('Barbell Back Squat');
    expect(overview.sbd.bench.primary?.exerciseName).toBe('Barbell Bench Press');
    expect(overview.sbd.deadlift.primary?.exerciseName).toBe('Romanian Deadlift (RDL)');

    const expectedTotal =
      overview.sbd.squat.primary!.max1RM +
      overview.sbd.bench.primary!.max1RM +
      overview.sbd.deadlift.primary!.max1RM;
    expect(overview.sbd.totalE1RM).toBe(expectedTotal);

    const extraNames = overview.sbd.extraVariations.map(v => v.exerciseName);
    expect(extraNames).toContain('Hack Squat Machine');
    expect(extraNames).toContain('Incline Dumbbell Press');
  });

  it('dynamically picks 5 recent compound movements with pattern diversity and zero isolations', () => {
    const workouts: WorkoutSession[] = [
      // Stale workout from 120 days ago (should NOT outrank recent compounds)
      makeSession('w_old', '2026-07-20', [
        {
          name: 'Barbell Deadlift',
          category: 'Sırt',
          equipment: 'Barbell',
          sets: [{ weight: 180, reps: 3, rir: 1 }],
        },
        {
          name: 'Barbell Bench Press',
          category: 'Göğüs',
          equipment: 'Barbell',
          sets: [{ weight: 80, reps: 6, rir: 1 }],
        },
      ]),
      // Recent workouts (last 14 days) with 6+ compounds + isolations
      makeSession('w_r1', '2026-11-10', [
        {
          name: 'Barbell Bench Press',
          category: 'Göğüs',
          equipment: 'Barbell',
          sets: [{ weight: 90, reps: 6, rir: 1 }],
        },
        {
          name: 'Lat Pulldown',
          category: 'Sırt',
          equipment: 'Kablo',
          sets: [{ weight: 70, reps: 8, rir: 1 }],
        },
        {
          name: 'Biceps Curl',
          category: 'Ön Kol',
          equipment: 'Dumbbell',
          sets: [{ weight: 20, reps: 10, rir: 1 }],
        },
        {
          name: 'Lateral Raise (Dropset)',
          category: 'Omuz',
          equipment: 'Dumbbell',
          sets: [{ weight: 14, reps: 12, rir: 0 }],
        },
      ]),
      makeSession('w_r2', '2026-11-15', [
        {
          name: 'Barbell Back Squat',
          category: 'Bacak',
          equipment: 'Barbell',
          sets: [{ weight: 130, reps: 5, rir: 1 }],
        },
        {
          name: 'Overhead Press MCH',
          category: 'Omuz',
          equipment: 'Makine',
          sets: [{ weight: 65, reps: 8, rir: 1 }],
        },
        {
          name: 'T-Bar Row (Chest Supported)',
          category: 'Sırt',
          equipment: 'Makine',
          sets: [{ weight: 55, reps: 8, rir: 1 }],
        },
        {
          name: 'Leg Extension',
          category: 'Bacak',
          equipment: 'Makine',
          sets: [{ weight: 85, reps: 10, rir: 0 }],
        },
      ]),
      makeSession('w_r3', '2026-11-20', [
        {
          name: 'Barbell Bench Press',
          category: 'Göğüs',
          equipment: 'Barbell',
          sets: [{ weight: 95, reps: 6, rir: 1 }],
        },
        {
          name: 'Romanian Deadlift (RDL)',
          category: 'Sırt',
          equipment: 'Barbell',
          sets: [{ weight: 125, reps: 6, rir: 1 }],
        },
        {
          name: 'Incline Press MCH',
          category: 'Göğüs',
          equipment: 'Makine',
          sets: [{ weight: 75, reps: 8, rir: 1 }],
        },
      ]),
    ];

    const overview = buildStrengthOverview(workouts, { nowMs });

    expect(overview.recentCompounds).toHaveLength(5);
    expect(overview.hasRecentWindowData).toBe(true);

    const names = overview.recentCompounds.map(c => c.exerciseName);
    // Zero isolations
    expect(names).not.toContain('Biceps Curl');
    expect(names).not.toContain('Lateral Raise (Dropset)');
    expect(names).not.toContain('Leg Extension');
    // Stale Barbell Deadlift (120 days ago) should NOT replace active recent compounds
    expect(names).not.toContain('Barbell Deadlift');
    // Bench Press improved from 80x6 (prior) to 95x6 (recent) -> positive delta & all-time PR
    const bench = overview.recentCompounds.find(c => c.exerciseName === 'Barbell Bench Press');
    expect(bench).toBeDefined();
    expect(bench!.deltaPercent).toBeGreaterThan(0);
    expect(bench!.isAtAllTimePR).toBe(true);
    // Pattern diversity: all 5 selected should cover distinct movement patterns
    const distinctPatterns = new Set(overview.recentCompounds.map(c => c.pattern));
    expect(distinctPatterns.size).toBe(5);
    // Sorted by recentE1RM descending
    for (let i = 1; i < overview.recentCompounds.length; i++) {
      expect(overview.recentCompounds[i - 1].recentE1RM).toBeGreaterThanOrEqual(
        overview.recentCompounds[i].recentE1RM
      );
    }
  });

  it('ignores incomplete sessions and warmup-only sets, and backfills when <5 recent compounds exist', () => {
    const workouts: WorkoutSession[] = [
      makeSession(
        'w_incomplete',
        '2026-11-22',
        [
          {
            name: 'Barbell Back Squat',
            category: 'Bacak',
            equipment: 'Barbell',
            sets: [{ weight: 200, reps: 5 }],
          },
        ],
        false
      ),
      makeSession('w_warmup_only', '2026-11-21', [
        {
          name: 'Barbell Bench Press',
          category: 'Göğüs',
          equipment: 'Barbell',
          sets: [{ weight: 60, reps: 10, isWarmup: true }],
        },
      ]),
      makeSession('w_old_compound', '2026-08-01', [
        {
          name: 'Pull-Up',
          category: 'Sırt',
          equipment: 'Vücut Ağırlığı',
          sets: [{ weight: 20, reps: 8, rir: 1 }],
        },
      ]),
      makeSession('w_recent_one', '2026-11-19', [
        {
          name: 'Leg Press',
          category: 'Bacak',
          equipment: 'Makine',
          sets: [{ weight: 210, reps: 10, rir: 1 }],
        },
      ]),
    ];

    const overview = buildStrengthOverview(workouts, { nowMs });

    expect(overview.sbd.loggedCount).toBe(0);
    expect(overview.sbd.totalE1RM).toBeNull();
    expect(overview.recentCompounds.map(c => c.exerciseName)).toEqual(['Leg Press', 'Pull-Up']);
    expect(overview.recentCompounds[0].isInRecentWindow).toBe(true);
    expect(overview.recentCompounds[1].isInRecentWindow).toBe(false);
  });
});
