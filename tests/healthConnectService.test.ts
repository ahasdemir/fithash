import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WorkoutSession } from '../src/types/fitness';

const mocks = vi.hoisted(() => ({
  platformOS: 'android' as 'android' | 'ios' | 'web',
  getSdkStatus: vi.fn(),
  initialize: vi.fn(),
  insertRecords: vi.fn(),
  readRecords: vi.fn(),
  getGrantedPermissions: vi.fn(),
  requestPermission: vi.fn(),
  openHealthConnectSettings: vi.fn(),
}));

vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mocks.platformOS;
    },
  },
}));

vi.mock('react-native-health-connect', () => ({
  initialize: mocks.initialize,
  requestPermission: mocks.requestPermission,
  getGrantedPermissions: mocks.getGrantedPermissions,
  getSdkStatus: mocks.getSdkStatus,
  openHealthConnectSettings: mocks.openHealthConnectSettings,
  insertRecords: mocks.insertRecords,
  readRecords: mocks.readRecords,
  SdkAvailabilityStatus: {
    SDK_AVAILABLE: 3,
    SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED: 2,
  },
  ExerciseType: {
    STRENGTH_TRAINING: 70,
    RUNNING: 56,
    RUNNING_TREADMILL: 57,
    WALKING: 79,
    BIKING: 8,
    ELLIPTICAL: 25,
    ROWING: 53,
    HIGH_INTENSITY_INTERVAL_TRAINING: 36,
    STAIR_CLIMBING: 68,
    CALISTHENICS: 13,
    SWIMMING_OPEN_WATER: 73,
    PILATES: 48,
    YOGA: 83,
  },
  RecordingMethod: {
    RECORDING_METHOD_UNKNOWN: 0,
    RECORDING_METHOD_ACTIVELY_RECORDED: 1,
    RECORDING_METHOD_AUTOMATICALLY_RECORDED: 2,
    RECORDING_METHOD_MANUAL_ENTRY: 3,
  },
}));

import {
  buildHealthConnectMetadata,
  syncWorkoutToHealthConnect,
  syncAllWorkoutsToHealthConnect,
} from '../src/services/healthConnectService';

const makeWorkout = (overrides: Partial<WorkoutSession> = {}): WorkoutSession => ({
  id: 'session_abc123',
  name: 'Program A',
  date: '2026-11-20',
  startTime: new Date('2026-11-20T10:00:00Z').getTime(),
  endTime: new Date('2026-11-20T11:00:00Z').getTime(),
  durationSeconds: 3600,
  exercises: [
    {
      id: 'wex_1',
      exerciseId: 'ex_bench',
      exerciseName: 'Barbell Bench Press',
      category: 'Göğüs',
      equipment: 'Barbell',
      sets: [
        { id: 's1', setNumber: 1, weight: 90, reps: 6, rir: 1, completed: true },
      ],
    },
  ],
  totalVolume: 540,
  totalSets: 1,
  totalCaloriesBurned: 360,
  totalCardioDistanceKm: 2.5,
  completed: true,
  ...overrides,
});

describe('Health Connect sync deduplication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.platformOS = 'android';
    mocks.getSdkStatus.mockResolvedValue(3);
    mocks.initialize.mockResolvedValue(true);
    mocks.insertRecords.mockResolvedValue(['rec_1']);
  });

  it('builds deterministic clientRecordId values per session and record suffix', () => {
    const session = makeWorkout();
    const m1 = buildHealthConnectMetadata(session, 'exercise_session', 1000, 2000, 42);
    const m2 = buildHealthConnectMetadata(session, 'exercise_session', 1000, 2000, 99);
    const cal = buildHealthConnectMetadata(session, 'active_calories', 1000, 2000, 42);

    expect(m1.clientRecordId).toBe('fithash:session_abc123:exercise_session');
    expect(m2.clientRecordId).toBe(m1.clientRecordId);
    expect(cal.clientRecordId).toBe('fithash:session_abc123:active_calories');
    expect(m1.recordingMethod).toBe(1);
    expect(m1.clientRecordVersion).toBe(42);
  });

  it('attaches unique per-record-type clientRecordId metadata on syncWorkoutToHealthConnect', async () => {
    const ok = await syncWorkoutToHealthConnect(makeWorkout());
    expect(ok).toBe(true);

    // ExerciseSession + ActiveCaloriesBurned + TotalCaloriesBurned + Distance = 4 calls
    expect(mocks.insertRecords).toHaveBeenCalledTimes(4);
    const records = mocks.insertRecords.mock.calls.map(call => call[0][0]);

    expect(records.map(r => r.recordType)).toEqual([
      'ExerciseSession',
      'ActiveCaloriesBurned',
      'TotalCaloriesBurned',
      'Distance',
    ]);
    expect(records.map(r => r.metadata?.clientRecordId)).toEqual([
      'fithash:session_abc123:exercise_session',
      'fithash:session_abc123:active_calories',
      'fithash:session_abc123:total_calories',
      'fithash:session_abc123:distance',
    ]);
    records.forEach(r => {
      expect(r.metadata?.clientRecordVersion).toBeTypeOf('number');
      expect(r.metadata?.recordingMethod).toBe(1);
    });
  });

  it('emits identical clientRecordIds across repeated batch syncs and skips incomplete sessions', async () => {
    const completed = makeWorkout({ id: 'session_1', totalCardioDistanceKm: undefined });
    const incomplete = makeWorkout({ id: 'session_draft', completed: false });

    const first = await syncAllWorkoutsToHealthConnect([completed, incomplete]);
    expect(first).toEqual({ success: 1, failed: 0 });
    const firstIds = mocks.insertRecords.mock.calls.map(c => c[0][0].metadata.clientRecordId);

    mocks.insertRecords.mockClear();

    const second = await syncAllWorkoutsToHealthConnect([completed, incomplete]);
    expect(second).toEqual({ success: 1, failed: 0 });
    const secondIds = mocks.insertRecords.mock.calls.map(c => c[0][0].metadata.clientRecordId);

    expect(secondIds).toEqual(firstIds);
    expect(firstIds).toEqual([
      'fithash:session_1:exercise_session',
      'fithash:session_1:active_calories',
      'fithash:session_1:total_calories',
    ]);
  });
});
