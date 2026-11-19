import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getWorkouts, getLocalDateString } from '../src/services/storage';
import {
  createMonotonicRevisionClock,
  selectWorkoutsForWearHistory,
  parseWearActiveSession,
  isWearRestTimerCleared,
  syncWorkoutsHistoryToWearable,
  syncActiveSessionToWearable,
  syncRestTimerToWearable,
  getPendingWearActiveSession,
  getPendingWearRestTimer,
  initWearSyncListener,
} from '../src/services/wearSyncService';
import { WorkoutSession } from '../src/types/fitness';

/**
 * wearSyncService, react-native'ın NativeModules / NativeEventEmitter / Platform
 * API'lerini kullanır. Düz node ortamında çalışan bu testler için köprüyü taklit
 * ederiz: sahte WearSyncModule (vi.fn'ler) + dinleyicileri yakalayan sahte emitter.
 */
const wearNative = vi.hoisted(() => ({
  syncRoutinesToWatch: vi.fn(async (_routinesJson: string, _settingsJson: string) => 0),
  syncWorkoutsHistoryToWatch: vi.fn(async (_workoutsJson: string) => 1),
  syncActiveSessionToWatch: vi.fn(async (_sessionJson: string | null, _revision: number) => 1),
  syncRestTimerToWatch: vi.fn(
    async (_endTimeMs: number, _totalSeconds: number, _revision: number) => 1
  ),
  getPendingWearWorkouts: vi.fn(async () => [] as string[]),
  acknowledgeWearWorkout: vi.fn(async (_workoutId: string) => null),
  getPendingActiveSessionState: vi.fn(async () => ({ sessionJson: '', revision: 0, cleared: true })),
  getPendingRestTimerState: vi.fn(async () => ({ endTimeMs: 0, totalSeconds: 0, revision: 0, cleared: true })),
  addListener: vi.fn((_eventType: string) => {}),
  removeListeners: vi.fn((_count: number) => {}),
}));

type NativeEventHandler = (event: any) => void;
const nativeListeners = vi.hoisted(() => new Map<string, NativeEventHandler[]>());
const platformState = vi.hoisted(() => ({ OS: 'android' as string }));

vi.mock('react-native', () => {
  class FakeNativeEventEmitter {
    addListener(eventType: string, handler: NativeEventHandler) {
      const list = nativeListeners.get(eventType) || [];
      list.push(handler);
      nativeListeners.set(eventType, list);
      return {
        remove: () => {
          const current = nativeListeners.get(eventType) || [];
          const idx = current.indexOf(handler);
          if (idx >= 0) current.splice(idx, 1);
        },
      };
    }
    removeAllListeners(eventType: string) {
      nativeListeners.delete(eventType);
    }
  }
  return {
    NativeModules: { WearSyncModule: wearNative },
    NativeEventEmitter: FakeNativeEventEmitter,
    Platform: platformState,
  };
});

/** Taklit native emitter'a olay yayınlar. */
const emitWearEvent = (eventType: string, payload?: unknown) => {
  (nativeListeners.get(eventType) || []).forEach(handler => handler(payload));
};

const lastCall = (mock: { mock: { calls: any[] } }) =>
  mock.mock.calls[mock.mock.calls.length - 1];

const makeWorkout = (id: string, completed = true): WorkoutSession => ({
  id,
  name: `Antrenman ${id}`,
  date: '2026-11-01',
  startTime: 0,
  durationSeconds: 60,
  exercises: [],
  totalVolume: 100,
  totalSets: 3,
  completed,
});

// Bir watch antrenmanı: kardiyo/izometrik opsiyonel alanlar dahil (protokol §4).
const wearWorkoutJson = JSON.stringify({
  id: 'wear_session_done',
  name: 'Saat Antrenmanı',
  date: '2026-11-19',
  startTime: 1732000000000,
  endTime: 1732001800000,
  durationSeconds: 1800,
  exercises: [
    {
      id: 'wex_1',
      exerciseId: 'ex_chest_1',
      exerciseName: 'Barbell Bench Press',
      category: 'Göğüs',
      equipment: 'Barbell',
      sets: [
        { id: 'set_1', setNumber: 1, weight: '75', reps: '10', rir: 1, completed: true },
        { id: 'set_2', setNumber: 1, weight: 20, reps: 10, completed: true, isWarmup: true, durationSeconds: 40 },
      ],
    },
    {
      id: 'wex_2',
      exerciseId: 'ex_cardio_1',
      exerciseName: 'Koşu Bandı',
      category: 'unknown-cat',
      equipment: 'unknown-eq',
      sets: [
        {
          id: 'set_3',
          setNumber: 1,
          durationMinutes: '15',
          distanceKm: '2.5',
          avgSpeedKmh: 10,
          caloriesBurned: 150,
          completed: true,
        },
      ],
    },
  ],
  totalVolume: '750',
  totalSets: '3',
  totalCaloriesBurned: 120,
});

let unsubscribeWear: (() => void) | undefined;

beforeEach(async () => {
  await AsyncStorage.clear();
  vi.clearAllMocks();
  nativeListeners.clear();
  platformState.OS = 'android';
});

afterEach(() => {
  unsubscribeWear?.();
  unsubscribeWear = undefined;
});

describe('createMonotonicRevisionClock', () => {
  it('never repeats a revision, even within the same millisecond', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-11-19T10:00:00Z'));
      const clock = createMonotonicRevisionClock();
      const first = clock.next();
      const second = clock.next();
      expect(first).toBe(Date.now());
      expect(second).toBe(first + 1);
      expect(clock.next()).toBe(first + 2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('strictly increases across many rapid calls', () => {
    const clock = createMonotonicRevisionClock();
    const revisions = Array.from({ length: 50 }, () => clock.next());
    for (let i = 1; i < revisions.length; i++) {
      expect(revisions[i]).toBeGreaterThan(revisions[i - 1]);
    }
  });

  it('raises its floor when observing a newer revision and ignores older ones', () => {
    const clock = createMonotonicRevisionClock();
    const future = Date.now() + 5000;
    clock.observe(future);
    expect(clock.next()).toBeGreaterThan(future);

    clock.observe(1);
    expect(clock.next()).toBeGreaterThan(future + 1);
  });
});

describe('selectWorkoutsForWearHistory', () => {
  it('keeps completed workouts only and slices to the limit', () => {
    const workouts = [
      makeWorkout('active', false),
      ...Array.from({ length: 32 }, (_, i) => makeWorkout(`c_${i}`)),
    ];
    const selected = selectWorkoutsForWearHistory(workouts);
    expect(selected).toHaveLength(30);
    expect(selected.every(w => w.completed !== false)).toBe(true);
    expect(selected[0].id).toBe('c_0');
  });

  it('honours an explicit limit', () => {
    const workouts = Array.from({ length: 40 }, (_, i) => makeWorkout(`w_${i}`));
    expect(selectWorkoutsForWearHistory(workouts)).toHaveLength(30);
    expect(selectWorkoutsForWearHistory(workouts, 5)).toHaveLength(5);
    expect(selectWorkoutsForWearHistory([])).toHaveLength(0);
  });
});

describe('parseWearActiveSession', () => {
  it('normalizes a valid watch session payload', () => {
    const sessionJson = JSON.stringify({
      id: 'wear_session_1',
      name: 'Saat Antrenmanı',
      startTime: 1731990000000,
      exercises: [
        {
          id: 'wex_1',
          exerciseId: 'ex_legs_1',
          exerciseName: 'Barbell Back Squat',
          category: 'Bacak',
          equipment: 'Barbell',
          sets: [
            { id: 'set_1', setNumber: 1, weight: '95', reps: '8', rir: 2, completed: true },
            { id: 'set_2', setNumber: 1, weight: 40, reps: 8, isWarmup: true, completed: true, durationSeconds: 45 },
          ],
        },
        {
          id: 'wex_2',
          exerciseId: 'ex_cardio_1',
          exerciseName: 'Koşu Bandı',
          category: 'unknown-cat',
          equipment: 'unknown-eq',
          sets: [
            { id: 'set_3', setNumber: 1, durationMinutes: '15', distanceKm: '2.5', avgSpeedKmh: 10, caloriesBurned: 150, completed: true },
          ],
        },
      ],
      totalVolume: '760',
      totalSets: '3',
      totalCaloriesBurned: 210,
    });

    const session = parseWearActiveSession(sessionJson);
    expect(session).not.toBeNull();
    expect(session?.id).toBe('wear_session_1');
    expect(session?.completed).toBe(false);
    // date eksikse startTime'tan yerel tarih üretilir.
    expect(session?.date).toBe(getLocalDateString(1731990000000));
    expect(session?.totalVolume).toBe(760);
    expect(session?.totalSets).toBe(3);
    expect(session?.totalCaloriesBurned).toBe(210);

    const [squat, cardio] = session?.exercises ?? [];
    expect(squat.sets[0].weight).toBe(95);
    expect(squat.sets[0].reps).toBe(8);
    expect(squat.sets[0].rir).toBe(2);
    expect(squat.sets[1].isWarmup).toBe(true);
    expect(squat.sets[1].durationSeconds).toBe(45);
    expect(cardio.category).toBe('Göğüs');
    expect(cardio.equipment).toBe('Barbell');
    expect(cardio.sets[0].durationMinutes).toBe(15);
    expect(cardio.sets[0].distanceKm).toBe(2.5);
    expect(cardio.sets[0].avgSpeedKmh).toBe(10);
    expect(cardio.sets[0].caloriesBurned).toBe(150);
  });

  it('returns null for cleared, completed, malformed or id-less payloads', () => {
    expect(parseWearActiveSession('')).toBeNull();
    expect(parseWearActiveSession('not-json')).toBeNull();
    expect(parseWearActiveSession(JSON.stringify({ id: 'x', startTime: 'nope' }))).toBeNull();
    expect(parseWearActiveSession(JSON.stringify({ startTime: 123 }))).toBeNull();
    expect(parseWearActiveSession(JSON.stringify({ id: 'x', startTime: 123, completed: true }))).toBeNull();
  });
});

describe('isWearRestTimerCleared', () => {
  const now = 1_000_000;

  it('treats the cleared flag as cleared', () => {
    expect(isWearRestTimerCleared({ cleared: true }, now)).toBe(true);
  });

  it('treats missing, zero and past deadlines as cleared', () => {
    expect(isWearRestTimerCleared({}, now)).toBe(true);
    expect(isWearRestTimerCleared({ endTimeMs: 0 }, now)).toBe(true);
    expect(isWearRestTimerCleared({ endTimeMs: now - 1 }, now)).toBe(true);
    expect(isWearRestTimerCleared({ endTimeMs: now }, now)).toBe(true);
  });

  it('keeps future deadlines active', () => {
    expect(isWearRestTimerCleared({ endTimeMs: now + 1 }, now)).toBe(false);
    expect(isWearRestTimerCleared({ endTimeMs: now + 1, cleared: false }, now)).toBe(false);
  });
});

describe('syncWorkoutsHistoryToWearable', () => {
  it('sends only the most recent completed workouts as JSON', async () => {
    const workouts = [
      makeWorkout('active_1', false),
      ...Array.from({ length: 32 }, (_, i) => makeWorkout(`c_${i}`)),
      makeWorkout('active_2', false),
    ];

    const nodes = await syncWorkoutsHistoryToWearable(workouts);
    expect(nodes).toBe(1);
    expect(wearNative.syncWorkoutsHistoryToWatch).toHaveBeenCalledTimes(1);

    const sent = JSON.parse(lastCall(wearNative.syncWorkoutsHistoryToWatch)[0] as string);
    expect(sent).toHaveLength(30);
    expect(sent.every((w: WorkoutSession) => w.completed !== false)).toBe(true);
    expect(sent[0].id).toBe('c_0');
  });
});

describe('syncActiveSessionToWearable', () => {
  it('stringifies the active session with a monotonically increasing revision', async () => {
    const session = makeWorkout('s1', false);
    await syncActiveSessionToWearable(session);
    await syncActiveSessionToWearable(session);

    const calls = wearNative.syncActiveSessionToWatch.mock.calls;
    expect(calls).toHaveLength(2);
    expect(JSON.parse(calls[0][0] as string)).toMatchObject({ id: 's1', completed: false });
    expect(typeof calls[0][1]).toBe('number');
    expect(calls[1][1]).toBeGreaterThan(calls[0][1]);
  });

  it('sends null (cleared) for null or completed sessions', async () => {
    await syncActiveSessionToWearable(null);
    expect(wearNative.syncActiveSessionToWatch).toHaveBeenLastCalledWith(null, expect.any(Number));

    await syncActiveSessionToWearable(makeWorkout('done', true));
    expect(wearNative.syncActiveSessionToWatch).toHaveBeenLastCalledWith(null, expect.any(Number));
  });
});

describe('syncRestTimerToWearable', () => {
  it('passes a future deadline through with its total', async () => {
    const end = Date.now() + 120_000;
    await syncRestTimerToWearable(end, 120);
    expect(wearNative.syncRestTimerToWatch).toHaveBeenLastCalledWith(end, 120, expect.any(Number));
  });

  it('derives the total from the deadline when omitted', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-11-19T10:00:00Z'));
      const end = Date.now() + 90_000;
      await syncRestTimerToWearable(end, 0);
      expect(wearNative.syncRestTimerToWatch).toHaveBeenLastCalledWith(end, 90, expect.any(Number));
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears the timer for past or null deadlines', async () => {
    await syncRestTimerToWearable(Date.now() - 1000, 60);
    expect(wearNative.syncRestTimerToWatch).toHaveBeenLastCalledWith(0, 0, expect.any(Number));

    await syncRestTimerToWearable(null, 0);
    expect(wearNative.syncRestTimerToWatch).toHaveBeenLastCalledWith(0, 0, expect.any(Number));
  });
});

describe('native platform guards', () => {
  it('skips every native call on non-android platforms', async () => {
    platformState.OS = 'ios';
    try {
      expect(await syncWorkoutsHistoryToWearable([])).toBe(0);
      expect(await syncActiveSessionToWearable(null)).toBe(0);
      expect(await syncRestTimerToWearable(Date.now() + 1000, 60)).toBe(0);
      expect(await getPendingWearActiveSession()).toBeNull();
      expect(await getPendingWearRestTimer()).toBeNull();

      expect(wearNative.syncWorkoutsHistoryToWatch).not.toHaveBeenCalled();
      expect(wearNative.syncActiveSessionToWatch).not.toHaveBeenCalled();
      expect(wearNative.syncRestTimerToWatch).not.toHaveBeenCalled();
      expect(wearNative.getPendingActiveSessionState).not.toHaveBeenCalled();
      expect(wearNative.getPendingRestTimerState).not.toHaveBeenCalled();
    } finally {
      platformState.OS = 'android';
    }
  });
});

describe('initWearSyncListener event wiring', () => {
  it('forwards cleared active sessions as null', () => {
    const onActiveSessionUpdated = vi.fn();
    unsubscribeWear = initWearSyncListener(undefined, undefined, { onActiveSessionUpdated });

    emitWearEvent('onWearActiveSessionUpdated', {
      sessionJson: '',
      revision: 999,
      origin: 'watch',
      cleared: true,
    });

    expect(onActiveSessionUpdated).toHaveBeenCalledTimes(1);
    expect(onActiveSessionUpdated).toHaveBeenCalledWith(null, 999);
  });

  it('parses and forwards watch active-session updates', () => {
    const onActiveSessionUpdated = vi.fn();
    unsubscribeWear = initWearSyncListener(undefined, undefined, { onActiveSessionUpdated });

    const revision = Date.now() - 1000;
    emitWearEvent('onWearActiveSessionUpdated', {
      sessionJson: JSON.stringify({
        id: 'wear_session_9',
        name: 'Push Günü',
        startTime: revision,
        date: '2026-11-19',
        exercises: [],
      }),
      revision,
      origin: 'watch',
      cleared: false,
    });

    expect(onActiveSessionUpdated).toHaveBeenCalledTimes(1);
    const [session, forwardedRevision] = lastCall(onActiveSessionUpdated);
    expect(session.id).toBe('wear_session_9');
    expect(session.name).toBe('Push Günü');
    expect(session.completed).toBe(false);
    expect(forwardedRevision).toBe(revision);
  });

  it('ignores malformed non-cleared active session updates', () => {
    const onActiveSessionUpdated = vi.fn();
    unsubscribeWear = initWearSyncListener(undefined, undefined, { onActiveSessionUpdated });

    emitWearEvent('onWearActiveSessionUpdated', {
      sessionJson: '{not json',
      revision: 5,
      origin: 'watch',
      cleared: false,
    });

    expect(onActiveSessionUpdated).not.toHaveBeenCalled();
  });

  it('normalizes active rest-timer updates', () => {
    const onRestTimerUpdated = vi.fn();
    unsubscribeWear = initWearSyncListener(undefined, undefined, { onRestTimerUpdated });

    const end = Date.now() + 90_000;
    emitWearEvent('onWearRestTimerUpdated', {
      endTimeMs: end,
      totalSeconds: 90,
      revision: 42,
      origin: 'watch',
      cleared: false,
    });

    expect(onRestTimerUpdated).toHaveBeenCalledTimes(1);
    expect(onRestTimerUpdated).toHaveBeenCalledWith(end, 90, 42);
  });

  it('normalizes cleared and expired rest-timer updates', () => {
    const onRestTimerUpdated = vi.fn();
    unsubscribeWear = initWearSyncListener(undefined, undefined, { onRestTimerUpdated });

    emitWearEvent('onWearRestTimerUpdated', {
      endTimeMs: 0,
      totalSeconds: 0,
      revision: 43,
      origin: 'watch',
      cleared: true,
    });
    expect(onRestTimerUpdated).toHaveBeenLastCalledWith(null, 0, 43);

    emitWearEvent('onWearRestTimerUpdated', {
      endTimeMs: Date.now() - 1000,
      totalSeconds: 30,
      revision: 44,
      origin: 'watch',
      cleared: false,
    });
    expect(onRestTimerUpdated).toHaveBeenLastCalledWith(null, 0, 44);
  });

  it('raises the outgoing revision floor after receiving a watch revision', async () => {
    const futureRevision = Date.now() + 60_000;
    unsubscribeWear = initWearSyncListener(undefined, undefined, {
      onActiveSessionUpdated: vi.fn(),
    });

    emitWearEvent('onWearActiveSessionUpdated', {
      sessionJson: '',
      revision: futureRevision,
      origin: 'watch',
      cleared: true,
    });

    await syncActiveSessionToWearable(null);
    const revision = lastCall(wearNative.syncActiveSessionToWatch)[1] as number;
    expect(revision).toBeGreaterThan(futureRevision);
  });
});

describe('watch workout import', () => {
  it('imports a completed watch workout, acks it and re-syncs history', async () => {
    const onWorkoutReceived = vi.fn();
    unsubscribeWear = initWearSyncListener(onWorkoutReceived);

    emitWearEvent('onWearWorkoutCompleted', { sessionJson: wearWorkoutJson });

    await vi.waitFor(() => {
      expect(wearNative.acknowledgeWearWorkout).toHaveBeenCalledWith('wear_session_done');
    });

    const workouts = await getWorkouts();
    expect(workouts).toHaveLength(1);
    const imported = workouts[0];
    expect(imported.id).toBe('wear_session_done');
    expect(imported.completed).toBe(true);
    expect(imported.notes).toBe('FitHash Wear OS Saati ile kaydedildi.');
    expect(imported.totalCaloriesBurned).toBe(120);

    // §4.3: opsiyonel set alanları import sırasında korunur.
    const [bench, cardio] = imported.exercises;
    expect(bench.sets[0].weight).toBe(75);
    expect(bench.sets[0].reps).toBe(10);
    expect(bench.sets[1].isWarmup).toBe(true);
    expect(bench.sets[1].durationSeconds).toBe(40);
    expect(cardio.sets[0].durationMinutes).toBe(15);
    expect(cardio.sets[0].distanceKm).toBe(2.5);
    expect(cardio.sets[0].avgSpeedKmh).toBe(10);
    expect(cardio.sets[0].caloriesBurned).toBe(150);

    expect(onWorkoutReceived).toHaveBeenCalledTimes(1);
    expect(onWorkoutReceived.mock.calls[0][0]).toMatchObject({ id: 'wear_session_done' });

    // §7.1.4: kayıttan sonra saat geçmiş listesi tazelenir.
    await vi.waitFor(() => {
      expect(wearNative.syncWorkoutsHistoryToWatch).toHaveBeenCalled();
    });
    const historyJson = lastCall(wearNative.syncWorkoutsHistoryToWatch)[0] as string;
    expect(JSON.parse(historyJson)).toHaveLength(1);
  });

  it('drains the durable native inbox at startup', async () => {
    wearNative.getPendingWearWorkouts.mockResolvedValue([wearWorkoutJson]);
    try {
      unsubscribeWear = initWearSyncListener(vi.fn());

      await vi.waitFor(() => {
        expect(wearNative.acknowledgeWearWorkout).toHaveBeenCalledWith('wear_session_done');
      });

      const workouts = await getWorkouts();
      expect(workouts.some(w => w.id === 'wear_session_done')).toBe(true);
    } finally {
      wearNative.getPendingWearWorkouts.mockResolvedValue([]);
    }
  });
});

describe('pending native mirror state', () => {
  it('returns the cached mirrored active session', async () => {
    wearNative.getPendingActiveSessionState.mockResolvedValue({
      sessionJson: JSON.stringify({
        id: 'wear_session_pending',
        startTime: Date.now() - 5000,
        completed: false,
      }),
      revision: 777,
      cleared: false,
    });

    const pending = await getPendingWearActiveSession();
    expect(pending?.revision).toBe(777);
    expect(pending?.session?.id).toBe('wear_session_pending');
    expect(pending?.session?.completed).toBe(false);
  });

  it('reports cleared sessions as null', async () => {
    wearNative.getPendingActiveSessionState.mockResolvedValue({
      sessionJson: '',
      revision: 888,
      cleared: true,
    });

    const pending = await getPendingWearActiveSession();
    expect(pending?.session).toBeNull();
    expect(pending?.revision).toBe(888);
  });

  it('returns null when no mirror state was ever written', async () => {
    wearNative.getPendingActiveSessionState.mockResolvedValue({
      sessionJson: '',
      revision: 0,
      cleared: true,
    });

    expect(await getPendingWearActiveSession()).toBeNull();
  });

  it('returns the cached rest timer deadline', async () => {
    const end = Date.now() + 45_000;
    wearNative.getPendingRestTimerState.mockResolvedValue({
      endTimeMs: end,
      totalSeconds: 45,
      revision: 555,
      cleared: false,
    });

    const pending = await getPendingWearRestTimer();
    expect(pending?.endTimeMs).toBe(end);
    expect(pending?.revision).toBe(555);
  });

  it('reports expired or cleared rest timers as null', async () => {
    wearNative.getPendingRestTimerState.mockResolvedValue({
      endTimeMs: Date.now() - 1000,
      totalSeconds: 45,
      revision: 556,
      cleared: false,
    });
    expect((await getPendingWearRestTimer())?.endTimeMs).toBeNull();

    wearNative.getPendingRestTimerState.mockResolvedValue({
      endTimeMs: 0,
      totalSeconds: 0,
      revision: 0,
      cleared: true,
    });
    expect(await getPendingWearRestTimer()).toBeNull();
  });
});
