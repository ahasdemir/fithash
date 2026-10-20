import AsyncStorage from '@react-native-async-storage/async-storage';
import { getWorkouts, getRoutines, getExercises, getPersonalRecords, recalculateAllPRs, clearCachedAIAnalysis } from './storage';
import { WorkoutSession, Routine, Exercise, PersonalRecord } from '../types/fitness';
import { INITIAL_EXERCISES } from '../data/exerciseLibrary';

const SETTINGS_KEY = '@fithash_settings_v1';
const DELETED_ROUTINES_KEY = '@fitness_deleted_routines_v1';
const STORAGE_KEYS = {
  EXERCISES: '@fitness_exercises_v1',
  WORKOUTS: '@fitness_workouts_v1',
  ROUTINES: '@fitness_routines_v1',
  PRS: '@fitness_prs_v1',
};

export interface AppSettings {
  defaultRestSeconds: number; // e.g. 30, 60, 90, 120, 180
  autoStartRestTimer: boolean;
  defaultRir: number; // 0, 1, 2, 3
  weightUnit: 'kg' | 'lbs';
  healthConnectEnabled: boolean;
  workoutDays: number[]; // e.g. [1, 2, 3, 4]
  weeklyTargetHistory?: Record<string, number>; // 'YYYY-MM-DD' (Monday of week) -> target days (1-7)
}

export const DEFAULT_SETTINGS: AppSettings = {
  defaultRestSeconds: 90,
  autoStartRestTimer: true,
  defaultRir: 1,
  weightUnit: 'kg',
  healthConnectEnabled: false,
  workoutDays: [1, 2, 3, 4, 5, 6], // Pazartesi - Cumartesi
  weeklyTargetHistory: {},
};

export const getAppSettings = async (): Promise<AppSettings> => {
  try {
    const json = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!json) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(json);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch (error) {
    console.error('Error reading settings:', error);
    return DEFAULT_SETTINGS;
  }
};

export const saveAppSettings = async (settings: Partial<AppSettings>): Promise<AppSettings> => {
  try {
    const current = await getAppSettings();
    const updated = { ...current, ...settings };
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    return updated;
  } catch (error) {
    console.error('Error saving settings:', error);
    throw error;
  }
};

// --- DATA EXPORT & IMPORT ---

export interface FullAppDataBackup {
  version: string;
  exportedAt: string;
  /** Workout history */
  workouts: WorkoutSession[];
  /** Routines on home screen */
  routines: Routine[];
  /** Exercise library (both built-in and custom) */
  exercises: Exercise[];
  /** User-created custom exercises */
  customExercises?: Exercise[];
  /** Personal records */
  prs: Record<string, PersonalRecord>;
  /** Deleted default routine IDs */
  deletedRoutineIds?: string[];
  /** User preferences & streak targets */
  settings?: AppSettings;
}

const CATEGORY_TRANSLATIONS: Record<string, string> = {
  'Göğüs': 'Chest',
  'Sırt': 'Back',
  'Bacak': 'Legs',
  'Omuz': 'Shoulders',
  'Ön Kol': 'Biceps',
  'Arka Kol': 'Triceps',
  'Karın': 'Core',
  'Kardiyo': 'Cardio',
};

const EQUIPMENT_TRANSLATIONS: Record<string, string> = {
  'Barbell': 'Barbell',
  'Dumbbell': 'Dumbbell',
  'Makine': 'Machine',
  'Kablo': 'Cable',
  'Vücut Ağırlığı': 'Bodyweight',
  'Kardiyo Cihazı': 'Cardio Machine',
  'Diğer': 'Other',
};

export const exportFullDataJSON = async (): Promise<string> => {
  const [
    workouts,
    routines,
    allExercises,
    prs,
    deletedRoutinesJson,
    customExercisesJson,
    settings,
  ] = await Promise.all([
    getWorkouts(),
    getRoutines(),
    getExercises(),
    getPersonalRecords(),
    AsyncStorage.getItem(DELETED_ROUTINES_KEY),
    AsyncStorage.getItem(STORAGE_KEYS.EXERCISES),
    getAppSettings(),
  ]);

  const deletedRoutineIds: string[] = deletedRoutinesJson ? JSON.parse(deletedRoutinesJson) : [];
  const customExercises: Exercise[] = customExercisesJson ? JSON.parse(customExercisesJson) : [];

  const backup: FullAppDataBackup = {
    version: '2.1.0',
    exportedAt: new Date().toISOString(),
    workouts,
    routines,
    exercises: allExercises,
    customExercises,
    prs,
    deletedRoutineIds,
    settings,
  };

  return JSON.stringify(backup, null, 2);
};

export const exportWorkoutsCSV = async (): Promise<string> => {
  const workouts = await getWorkouts();
  let csv = 'Workout,Date,Duration (min),Exercise,Category,Equipment,Set Number,Status,Set Type,Weight (kg),Reps,Isometric Hold (s),RIR,Distance (km),Speed (km/h),Cardio Duration (min),Calories Burned (kcal),Notes\n';

  workouts.forEach(w => {
    const durationMins = Math.round((w.durationSeconds || 0) / 60);
    const workoutNotes = (w.notes || '').replace(/"/g, '""');
    const workoutName = (w.name || '').replace(/"/g, '""');

    w.exercises.forEach(ex => {
      const isCardio = ex.category === 'Kardiyo' || (ex.category as string) === 'Cardio';
      const isIso = /plank|hollow body|dead bug|bird dog|statik|isometric|static/i.test(ex.exerciseName);
      const isBodyweight = ex.equipment === 'Vücut Ağırlığı' || (ex.equipment as string) === 'Bodyweight';
      const exNotes = (ex.notes || '').replace(/"/g, '""');
      const combinedNotes = [workoutNotes, exNotes].filter(Boolean).join(' | ').replace(/"/g, '""');

      const exName = (ex.exerciseName || '').replace(/"/g, '""');
      const category = (CATEGORY_TRANSLATIONS[ex.category] || ex.category || '').replace(/"/g, '""');
      const equipment = (EQUIPMENT_TRANSLATIONS[ex.equipment] || ex.equipment || '').replace(/"/g, '""');

      ex.sets.forEach((set, setIdx) => {
        const status = set.completed ? 'Completed' : 'Skipped';
        let setType = 'Normal';
        if (set.isWarmup) setType = 'Warmup';
        if (set.isPR) setType = 'PR';

        const workingSetNum = ex.sets.slice(0, setIdx + 1).filter(s => !s.isWarmup).length;
        const setNumberDisplay = set.isWarmup ? 'W' : (workingSetNum || set.setNumber);

        // Weight handling: for bodyweight, 0 means unweighted (or show +kg if added)
        let weight: string | number = set.weight ?? 0;
        if (isIso || isCardio) {
          weight = '';
        } else if (isBodyweight) {
          weight = set.weight > 0 ? `+${set.weight}` : 0;
        }

        // Reps & Duration handling
        const reps = isIso || isCardio ? '' : (set.reps ?? '');
        const isoSeconds = isIso ? (set.durationSeconds ?? set.reps ?? '') : (set.durationSeconds ?? '');
        const rir = set.rir !== undefined && set.rir !== null ? set.rir : '';
        const distance = set.distanceKm ?? '';
        const speed = set.avgSpeedKmh ?? '';
        const cardioDuration = set.durationMinutes ?? '';
        const calories = set.caloriesBurned ?? '';

        csv += `"${workoutName}","${w.date}",${durationMins},"${exName}","${category}","${equipment}","${setNumberDisplay}","${status}","${setType}","${weight}","${reps}","${isoSeconds}",${rir},${distance},${speed},${cardioDuration},${calories},"${combinedNotes}"\n`;
      });
    });
  });

  return csv;
};

export const importFullDataJSON = async (jsonString: string): Promise<boolean> => {
  try {
    const backup: FullAppDataBackup = JSON.parse(jsonString);
    if (!backup || typeof backup !== 'object') {
      throw new Error('Invalid backup file: Root element must be an object.');
    }
    if (!backup.workouts || !Array.isArray(backup.workouts)) {
      throw new Error('Invalid backup file: Missing or invalid "workouts" data array.');
    }

    // 1. Workouts
    await AsyncStorage.setItem(STORAGE_KEYS.WORKOUTS, JSON.stringify(backup.workouts));

    // 2. Routines (if present)
    if (backup.routines && Array.isArray(backup.routines)) {
      await AsyncStorage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(backup.routines));
    }

    // 3. Custom Exercises
    if (backup.customExercises && Array.isArray(backup.customExercises)) {
      await AsyncStorage.setItem(STORAGE_KEYS.EXERCISES, JSON.stringify(backup.customExercises));
    } else if (backup.exercises && Array.isArray(backup.exercises)) {
      // Backward compatibility: Extract user custom exercises from full exercise list
      const initialIds = new Set(INITIAL_EXERCISES.map(e => e.id));
      const customOnly = backup.exercises.filter(e => e.isCustom || !initialIds.has(e.id));
      await AsyncStorage.setItem(STORAGE_KEYS.EXERCISES, JSON.stringify(customOnly));
    }

    // 4. PR records
    if (backup.prs && typeof backup.prs === 'object') {
      await AsyncStorage.setItem(STORAGE_KEYS.PRS, JSON.stringify(backup.prs));
    }
    
    // Recalculate & verify all PR records against the imported workout history
    if (backup.workouts && backup.workouts.length > 0) {
      await recalculateAllPRs(backup.workouts);
    }

    // 5. Deleted default routine IDs
    if (backup.deletedRoutineIds && Array.isArray(backup.deletedRoutineIds)) {
      await AsyncStorage.setItem(
        DELETED_ROUTINES_KEY,
        JSON.stringify(backup.deletedRoutineIds)
      );
    }

    // 6. App settings (timer preferences, workout days, streak history)
    if (backup.settings && typeof backup.settings === 'object') {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(backup.settings));
    }

    // 7. Clear cached AI analysis so analytics recompute freshly
    await clearCachedAIAnalysis();

    return true;
  } catch (error) {
    console.error('Error importing backup:', error);
    throw error;
  }
};

