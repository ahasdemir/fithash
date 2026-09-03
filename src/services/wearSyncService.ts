import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import { Routine, WorkoutSession } from '../types/fitness';
import { saveWorkout } from './storage';

const { WearSyncModule } = NativeModules;
const wearEmitter = WearSyncModule && Platform.OS === 'android' ? new NativeEventEmitter(WearSyncModule) : null;

/**
 * Syncs the user's active workout routines to connected Wear OS watch devices.
 */
export const syncRoutinesToWearable = async (routines: Routine[]): Promise<number> => {
  if (Platform.OS !== 'android' || !WearSyncModule) {
    return 0;
  }

  try {
    const json = JSON.stringify(routines);
    const syncedNodesCount: number = await WearSyncModule.syncRoutinesToWatch(json);
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
export const initWearSyncListener = (onWorkoutReceived?: (session: WorkoutSession) => void): (() => void) => {
  if (!wearEmitter) {
    return () => {};
  }

  const subscription = wearEmitter.addListener('onWearWorkoutCompleted', async (event: { sessionJson?: string }) => {
    if (!event?.sessionJson) return;

    try {
      const wearSession = JSON.parse(event.sessionJson);
      if (!wearSession || !wearSession.id) return;

      const fullSession: WorkoutSession = {
        id: wearSession.id,
        name: wearSession.name || 'Saat Antrenmanı',
        routineId: wearSession.routineId,
        date: wearSession.date,
        startTime: wearSession.startTime,
        endTime: wearSession.endTime,
        durationSeconds: wearSession.durationSeconds || 0,
        exercises: (wearSession.exercises || []).map((ex: any) => ({
          id: ex.id,
          exerciseId: ex.exerciseId,
          exerciseName: ex.exerciseName,
          category: ex.category || 'Göğüs',
          equipment: ex.equipment || 'Barbell',
          sets: (ex.sets || []).map((s: any) => ({
            id: s.id,
            setNumber: s.setNumber,
            weight: Number(s.weight) || 0,
            reps: Number(s.reps) || 0,
            rir: s.rir ?? 1,
            completed: Boolean(s.completed),
          })),
        })),
        totalVolume: Number(wearSession.totalVolume) || 0,
        totalSets: Number(wearSession.totalSets) || 0,
        completed: true,
        notes: 'FitHash Wear OS Saati ile kaydedildi.',
      };

      await saveWorkout(fullSession);
      onWorkoutReceived?.(fullSession);
    } catch (e) {
      console.warn('Error processing Wear OS workout session:', e);
    }
  });

  return () => {
    subscription.remove();
  };
};
