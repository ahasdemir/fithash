import { describe, it, expect, beforeEach } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getLocalDateString,
  getMondayOfWeek,
  calculateUserStats,
  getActiveRestTimerEnd,
  saveActiveRestTimerEnd,
  getCachedAIAnalysis,
  saveCachedAIAnalysis,
  clearCachedAIAnalysis,
  saveWorkout,
  getWorkouts,
  getPersonalRecords,
} from '../src/services/storage';
import { CoachAnalysisResult } from '../src/services/progressionEngine';
import { WorkoutSession, MuscleCategory } from '../src/types/fitness';

/** Days elapsed since Monday (1..7, Sunday counts as 7) — mirrors the streak spec. */
const elapsedDaysThisWeek = (): number => {
  const day = new Date().getDay();
  return day === 0 ? 7 : day;
};

const daysAgoStr = (days: number): string =>
  getLocalDateString(new Date(Date.now() - days * 86400_000));

let swCounter = 0;
const streakWorkout = (date: string, completed = true): WorkoutSession => ({
  id: `sw_${++swCounter}`,
  name: 'Antrenman',
  date,
  startTime: 0,
  durationSeconds: 0,
  exercises: [],
  totalVolume: 0,
  totalSets: 0,
  completed,
});

/** Dates covering every day from Monday of `weeksBack` weeks ago until today. */
const dailyDates = (weeksBack: number): string[] => {
  const start = getMondayOfWeek(new Date());
  start.setDate(start.getDate() - weeksBack * 7);
  const totalDays = weeksBack * 7 + elapsedDaysThisWeek();
  const dates: string[] = [];
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    dates.push(getLocalDateString(d));
  }
  return dates;
};

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('getLocalDateString', () => {
  it('zero-pads month and day', () => {
    expect(getLocalDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(getLocalDateString(new Date(2026, 10, 19))).toBe('2026-11-19');
    expect(getLocalDateString(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('accepts epoch milliseconds', () => {
    const ms = new Date(2026, 2, 1, 10, 30).getTime();
    expect(getLocalDateString(ms)).toBe('2026-03-01');
  });

  it('formats in the local timezone, not UTC', () => {
    // 23:30 local on May 15 must stay on May 15 even though its UTC instant
    // already falls on May 16 in positive-offset timezones.
    const lateEvening = new Date(2026, 4, 15, 23, 30);
    expect(getLocalDateString(lateEvening)).toBe('2026-05-15');
    expect(getLocalDateString(lateEvening.getTime())).toBe('2026-05-15');
  });

  it('defaults to the current date in YYYY-MM-DD form', () => {
    expect(getLocalDateString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('getMondayOfWeek', () => {
  it('returns the Monday of the same week for every weekday', () => {
    // Thu Nov 19 2026, Mon Nov 16 2026, Sat Nov 21, Sun Nov 22
    expect(getLocalDateString(getMondayOfWeek(new Date(2026, 10, 19)))).toBe('2026-11-16');
    expect(getLocalDateString(getMondayOfWeek(new Date(2026, 10, 16)))).toBe('2026-11-16');
    expect(getLocalDateString(getMondayOfWeek(new Date(2026, 10, 21)))).toBe('2026-11-16');
    // Sunday belongs to the week that *ended*, i.e. the previous Monday.
    expect(getLocalDateString(getMondayOfWeek(new Date(2026, 10, 22)))).toBe('2026-11-16');
  });

  it('returns a midnight-normalized date and does not mutate its input', () => {
    const input = new Date(2026, 10, 19, 23, 59, 59);
    const monday = getMondayOfWeek(input);
    expect(monday.getDay()).toBe(1);
    expect(monday.getHours()).toBe(0);
    expect(monday.getMinutes()).toBe(0);
    expect(input.getHours()).toBe(23);
  });
});

describe('calculateUserStats', () => {
  const todayStr = getLocalDateString(new Date());

  const w1: WorkoutSession = {
    id: 'w1',
    name: 'Bugünkü Antrenman',
    date: todayStr,
    startTime: 0,
    endTime: 0,
    durationSeconds: 3600,
    exercises: [
      {
        id: 'x1',
        exerciseId: 'ex_chest_1',
        exerciseName: 'Barbell Bench Press',
        category: 'Göğüs',
        equipment: 'Barbell',
        sets: [
          { id: 's1', setNumber: 1, weight: 100, reps: 5, rir: 1, completed: true },
          { id: 's2', setNumber: 2, weight: 100, reps: 5, rir: 1, completed: true },
        ],
      },
      {
        id: 'x2',
        exerciseId: 'ex_cardio_1',
        exerciseName: 'Koşu Bandı',
        category: 'Kardiyo',
        equipment: 'Kardiyo Cihazı',
        sets: [
          {
            id: 's3',
            setNumber: 1,
            weight: 0,
            reps: 0,
            durationMinutes: 30,
            distanceKm: 5,
            avgSpeedKmh: 10,
            completed: true,
          },
        ],
      },
    ],
    totalVolume: 1000,
    totalSets: 3,
    totalCaloriesBurned: 300,
    totalCardioDistanceKm: 5,
    completed: true,
  };

  const w2: WorkoutSession = {
    id: 'w2',
    name: 'Eski Antrenman',
    date: daysAgoStr(30),
    startTime: 0,
    endTime: 0,
    durationSeconds: 1800,
    exercises: [
      {
        id: 'x3',
        exerciseId: 'ex_back_1',
        exerciseName: 'Barbell Row',
        category: 'Sırt',
        equipment: 'Barbell',
        sets: [
          { id: 's4', setNumber: 1, weight: 50, reps: 10, rir: 2, completed: true },
          { id: 's5', setNumber: 2, weight: 50, reps: 10, rir: 2, completed: false },
        ],
      },
    ],
    totalVolume: 500,
    totalSets: 2,
    completed: true,
  };

  it('returns zeroed defaults for an empty history', () => {
    const stats = calculateUserStats([]);
    expect(stats.totalWorkouts).toBe(0);
    expect(stats.totalVolumeKg).toBe(0);
    expect(stats.totalSets).toBe(0);
    expect(stats.totalHardSets).toBe(0);
    expect(stats.streakDays).toBe(0);
    expect(stats.avgWorkoutCompliance).toBe(100);
    expect(stats.avgRir).toBe(1.2);
    expect(stats.muscleGroupDistribution).toEqual({
      'Göğüs': 0,
      'Sırt': 0,
      'Bacak': 0,
      'Omuz': 0,
      'Ön Kol': 0,
      'Arka Kol': 0,
      'Karın': 0,
      'Kardiyo': 0,
    });
  });

  it('aggregates volume, sets, RIR, calories and muscle distribution', () => {
    const stats = calculateUserStats([w1, w2], [1, 2, 3, 4, 5, 6]);

    expect(stats.totalWorkouts).toBe(2);
    // w1: 100kg x 5 x 2 = 1000; w2: 50kg x 10 = 500
    expect(stats.totalVolumeKg).toBe(1500);
    // 2 bench + 1 cardio + 1 row = 4 completed sets
    expect(stats.totalSets).toBe(4);
    // completed non-warmup weight sets only (cardio excluded)
    expect(stats.totalHardSets).toBe(3);
    // 4 planned sets (cardio excluded from planning), 4 completed -> 100%
    expect(stats.avgWorkoutCompliance).toBe(100);
    // (1 + 1 + 2) / 3
    expect(stats.avgRir).toBe(1.3);
    // (3600 + 1800) / 60
    expect(stats.totalTimeMinutes).toBe(90);
    // bench 2 x 45s TUT + cardio 30min + row 45s = 1935s
    expect(stats.activeWorkTimeMinutes).toBe(32);
    // w1 dated today counts for the weekly window, w2 is 30 days old
    expect(stats.weeklyWorkouts).toBe(1);
    expect(stats.weeklyVolumeKg).toBe(1000);
    // w1 logs 300 kcal; w2 falls back to 6 kcal/min for 30min = 180
    expect(stats.totalCaloriesBurned).toBe(480);
    expect(stats.totalCardioDistanceKm).toBe(5);
    expect(stats.muscleGroupDistribution).toEqual({
      'Göğüs': 2,
      'Sırt': 1,
      'Bacak': 0,
      'Omuz': 0,
      'Ön Kol': 0,
      'Arka Kol': 0,
      'Karın': 0,
      'Kardiyo': 0,
    });
  });
});

describe('streak calculation (via calculateUserStats)', () => {
  it('is zero when all workouts are far in the past', () => {
    const workouts = [streakWorkout(daysAgoStr(30)), streakWorkout(daysAgoStr(45))];
    const stats = calculateUserStats(workouts, [1, 2, 3, 4, 5, 6]);
    expect(stats.streakDays).toBe(0);
  });

  it('counts every fully-trained past week plus the days elapsed this week', () => {
    const workouts = dailyDates(3).map(d => streakWorkout(d));
    const stats = calculateUserStats(workouts, [1, 2, 3, 4, 5, 6]);
    expect(stats.streakDays).toBe(3 * 7 + elapsedDaysThisWeek());
  });

  it('honours per-week targets from weeklyTargetHistory', () => {
    const thisMonday = getMondayOfWeek(new Date());
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(lastMonday.getDate() - 7);
    const lastMondayStr = getLocalDateString(lastMonday);
    const lastTuesday = new Date(lastMonday);
    lastTuesday.setDate(lastTuesday.getDate() + 1);
    const lastWednesday = new Date(lastMonday);
    lastWednesday.setDate(lastWednesday.getDate() + 2);

    // Last week: only 3 training days. This week: trained every day so far.
    const workouts = [
      streakWorkout(getLocalDateString(lastMonday)),
      streakWorkout(getLocalDateString(lastTuesday)),
      streakWorkout(getLocalDateString(lastWednesday)),
      ...dailyDates(0).map(d => streakWorkout(d)),
    ];

    // With a historical 3-day target for last week, that week counts as a success.
    const withHistory = calculateUserStats(workouts, [1, 2, 3, 4, 5, 6], {
      [lastMondayStr]: 3,
    });
    expect(withHistory.streakDays).toBe(7 + elapsedDaysThisWeek());

    // Against today's 6-day target, last week breaks the streak.
    const withoutHistory = calculateUserStats(workouts, [1, 2, 3, 4, 5, 6]);
    expect(withoutHistory.streakDays).toBe(elapsedDaysThisWeek());
  });

  it('never counts uncompleted workouts toward the streak', () => {
    const thisMonday = getMondayOfWeek(new Date());
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(lastMonday.getDate() - 7);
    const lastMondayStr = getLocalDateString(lastMonday);
    const lastTuesday = new Date(lastMonday);
    lastTuesday.setDate(lastTuesday.getDate() + 1);
    const lastWednesday = new Date(lastMonday);
    lastWednesday.setDate(lastWednesday.getDate() + 2);

    // Only 2 *completed* days last week; the third log was abandoned.
    const workouts = [
      streakWorkout(getLocalDateString(lastMonday)),
      streakWorkout(getLocalDateString(lastTuesday)),
      streakWorkout(getLocalDateString(lastWednesday), false),
      ...dailyDates(0).map(d => streakWorkout(d)),
    ];

    const stats = calculateUserStats(workouts, [1, 2, 3, 4, 5, 6], {
      [lastMondayStr]: 3,
    });
    // 2 completed days < 3-day target -> last week fails -> no past-week credit.
    expect(stats.streakDays).toBe(elapsedDaysThisWeek());
  });

  it('clamps weekly targets from history into the 1..7 range', () => {
    const lastMonday = getMondayOfWeek(new Date());
    lastMonday.setDate(lastMonday.getDate() - 7);
    const lastMondayStr = getLocalDateString(lastMonday);

    // A nonsensical 99-day target clamps to 7, which the full history meets.
    const workouts = dailyDates(3).map(d => streakWorkout(d));
    const stats = calculateUserStats(workouts, [1, 2, 3, 4, 5, 6], {
      [lastMondayStr]: 99,
    });
    expect(stats.streakDays).toBe(3 * 7 + elapsedDaysThisWeek());
  });
});

describe('AI analysis cache (AsyncStorage-backed)', () => {
  const analysis: CoachAnalysisResult = {
    summary: 'Haftalık özet',
    recommendations: ['Öneri 1', 'Öneri 2'],
    muscleBalanceComment: 'Dengeli',
    overloadTip: 'DDP ipucu',
    score: 82,
    timestamp: '12:00',
    weeklyHardSetsByMuscle: {},
  };

  it('returns null when nothing is cached', async () => {
    expect(await getCachedAIAnalysis()).toBeNull();
  });

  it('round-trips a coach analysis', async () => {
    await saveCachedAIAnalysis(analysis);
    expect(await getCachedAIAnalysis()).toEqual(analysis);
  });

  it('clears the cache', async () => {
    await saveCachedAIAnalysis(analysis);
    await clearCachedAIAnalysis();
    expect(await getCachedAIAnalysis()).toBeNull();
  });
});

describe('workout persistence (AsyncStorage-backed)', () => {
  const benchSession = (id: string, date: string): WorkoutSession => ({
    id,
    name: 'Bench Günü',
    date,
    startTime: 0,
    endTime: 0,
    durationSeconds: 3000,
    exercises: [
      {
        id: `${id}_x`,
        exerciseId: 'pr_test_bench',
        exerciseName: 'Barbell Bench Press',
        category: 'Göğüs',
        equipment: 'Barbell',
        sets: [{ id: `${id}_s`, setNumber: 1, weight: 100, reps: 5, rir: 1, completed: true }],
      },
    ],
    totalVolume: 500,
    totalSets: 1,
    completed: true,
  });

  it('returns an empty list before anything is saved', async () => {
    expect(await getWorkouts()).toEqual([]);
  });

  it('derives a personal record from the first completed set', async () => {
    await saveWorkout(benchSession('w_pr', '2026-11-10'));

    const prs = await getPersonalRecords();
    expect(prs['pr_test_bench']).toMatchObject({
      exerciseId: 'pr_test_bench',
      exerciseName: 'Barbell Bench Press',
      maxWeight: 100,
      maxReps: 5,
      // 100kg x 5 @ RIR 1 -> e1RM 120
      maxEstimatedOneRepMax: 120,
      maxVolume: 500,
      date: '2026-11-10',
      lastUpdatedDate: '2026-11-10',
    });
  });

  it('lists workouts newest first', async () => {
    await saveWorkout(benchSession('w_old', '2026-11-18'));
    await saveWorkout(benchSession('w_new', '2026-11-19'));

    const workouts = await getWorkouts();
    expect(workouts.map(w => w.id)).toEqual(['w_new', 'w_old']);
  });

  it('persists concurrent saves without losing either (storage mutex)', async () => {
    await Promise.all([
      saveWorkout(benchSession('w_c1', '2026-11-01')),
      saveWorkout(benchSession('w_c2', '2026-11-02')),
    ]);
    const workouts = await getWorkouts();
    expect(workouts.map(w => w.id).sort()).toEqual(['w_c1', 'w_c2']);
  });

  it('preserves original PR date and higher maxReps at equal maxWeight across recalculation', async () => {
    await saveWorkout(benchSession('w_heavy', '2026-11-05')); // 100kg x 5 @ RIR 1
    const equalWeightFewerReps: WorkoutSession = {
      ...benchSession('w_equal', '2026-11-12'),
      exercises: [
        {
          id: 'w_equal_x',
          exerciseId: 'pr_test_bench',
          exerciseName: 'Barbell Bench Press',
          category: 'Göğüs',
          equipment: 'Barbell',
          sets: [{ id: 'w_equal_s', setNumber: 1, weight: 100, reps: 3, rir: 1, completed: true }],
        },
      ],
      totalVolume: 300,
    };
    await saveWorkout(equalWeightFewerReps);

    const prs = await getPersonalRecords();
    expect(prs['pr_test_bench']).toMatchObject({
      maxWeight: 100,
      maxReps: 5,
      date: '2026-11-05',
      lastUpdatedDate: '2026-11-05',
    });
  });
});

describe('rest timer persistence (AsyncStorage-backed)', () => {
  it('round-trips a deadline', async () => {
    expect(await getActiveRestTimerEnd()).toBeNull();
    await saveActiveRestTimerEnd(Date.now() + 90_000);
    expect(typeof (await getActiveRestTimerEnd())).toBe('number');
    await saveActiveRestTimerEnd(null);
    expect(await getActiveRestTimerEnd()).toBeNull();
  });
});
