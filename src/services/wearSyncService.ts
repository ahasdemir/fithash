import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import { Routine, WorkoutSession, MuscleCategory, EquipmentType } from '../types/fitness';
import { saveWorkout } from './storage';
import { AppSettings } from './settings';

const { WearSyncModule } = NativeModules;
const wearEmitter = WearSyncModule && Platform.OS === 'android' ? new NativeEventEmitter(WearSyncModule) : null;

/**
 * Saat uygulamasından gelen ham JSON set verisi. Sayısal alanlar eski saat
 * sürümlerinde string olarak gönderilebildiği için toleranslı tanımlanır.
 */
interface WearSetPayload {
  id: string;
  setNumber: number;
  weight?: number | string;
  reps?: number | string;
  rir?: number;
  completed?: boolean;
}

interface WearExercisePayload {
  id: string;
  exerciseId: string;
  exerciseName: string;
  category?: string;
  equipment?: string;
  sets?: WearSetPayload[];
}

interface WearSessionPayload {
  id: string;
  name?: string;
  routineId?: string;
  date: string;
  startTime: number;
  endTime?: number;
  durationSeconds?: number;
  exercises?: WearExercisePayload[];
  totalVolume?: number | string;
  totalSets?: number | string;
}

const MUSCLE_CATEGORIES: readonly MuscleCategory[] = [
  'Göğüs',
  'Sırt',
  'Bacak',
  'Omuz',
  'Ön Kol',
  'Arka Kol',
  'Karın',
  'Kardiyo',
];

const EQUIPMENT_TYPES: readonly EquipmentType[] = [
  'Barbell',
  'Dumbbell',
  'Makine',
  'Kablo',
  'Vücut Ağırlığı',
  'Kardiyo Cihazı',
  'Diğer',
];

const isMuscleCategory = (value: unknown): value is MuscleCategory =>
  typeof value === 'string' && (MUSCLE_CATEGORIES as readonly string[]).includes(value);

const isEquipmentType = (value: unknown): value is EquipmentType =>
  typeof value === 'string' && (EQUIPMENT_TYPES as readonly string[]).includes(value);

/**
 * Syncs the user's active workout routines to connected Wear OS watch devices.
 */
export const syncRoutinesToWearable = async (
  routines: Routine[],
  settings?: Pick<AppSettings, 'defaultRestSeconds' | 'autoStartRestTimer' | 'defaultRir'>
): Promise<number> => {
  if (Platform.OS !== 'android' || !WearSyncModule) {
    return 0;
  }

  try {
    const json = JSON.stringify(routines);
    const syncedNodesCount: number = await WearSyncModule.syncRoutinesToWatch(
      json,
      JSON.stringify(settings || null)
    );
    return syncedNodesCount;
  } catch (error) {
    console.warn('Failed to sync routines to Wear OS device:', error);
    return 0;
  }
};

/**
 * Initializes the Wear OS event listener on the phone to automatically save completed
 * workouts performed on the watch.
 */
export const initWearSyncListener = (
  onWorkoutReceived?: (session: WorkoutSession) => void,
  onSyncRequested?: () => void
): (() => void) => {
  if (!wearEmitter) {
    return () => {};
  }

  const importWorkout = async (sessionJson?: string) => {
    if (!sessionJson) return;
    try {
      const wearSession = JSON.parse(sessionJson) as WearSessionPayload | null;
      if (!wearSession || !wearSession.id) return;

      const fullSession: WorkoutSession = {
        id: wearSession.id,
        name: wearSession.name || 'Saat Antrenmanı',
        routineId: wearSession.routineId,
        date: wearSession.date,
        startTime: wearSession.startTime,
        endTime: wearSession.endTime,
        durationSeconds: wearSession.durationSeconds || 0,
        exercises: (wearSession.exercises || []).map((ex: WearExercisePayload) => ({
          id: ex.id,
          exerciseId: ex.exerciseId,
          exerciseName: ex.exerciseName,
          category: isMuscleCategory(ex.category) ? ex.category : 'Göğüs',
          equipment: isEquipmentType(ex.equipment) ? ex.equipment : 'Barbell',
          sets: (ex.sets || []).map((s: WearSetPayload) => ({
            id: s.id,
            setNumber: s.setNumber,
            weight: Number(s.weight) || 0,
            reps: Number(s.reps) || 0,
            // RIR is optional on the watch. Never turn an unlogged RIR into a false "1".
            rir: typeof s.rir === 'number' ? s.rir : undefined,
            completed: Boolean(s.completed),
          })),
        })),
        totalVolume: Number(wearSession.totalVolume) || 0,
        totalSets: Number(wearSession.totalSets) || 0,
        completed: true,
        notes: 'FitHash Wear OS Saati ile kaydedildi.',
      };

      await saveWorkout(fullSession);
      await WearSyncModule.acknowledgeWearWorkout?.(fullSession.id);
      onWorkoutReceived?.(fullSession);
    } catch (e) {
      console.warn('Error processing Wear OS workout session:', e);
    }
  };

  // A native listener persists incoming workouts, including when the React app is closed.
  // Drain that durable inbox at startup as well as processing live events.
  WearSyncModule.getPendingWearWorkouts?.()
    .then((sessions: string[] = []) => Promise.all(sessions.map(session => importWorkout(session))))
    .catch((error: unknown) => console.warn('Failed to read the Wear OS workout inbox:', error));

  const subWorkout = wearEmitter.addListener('onWearWorkoutCompleted', (event: { sessionJson?: string }) => {
    void importWorkout(event?.sessionJson);
  });

  const subSync = wearEmitter.addListener('onWearRequestSync', () => {
    onSyncRequested?.();
  });

  return () => {
    subWorkout.remove();
    subSync.remove();
  };
};
