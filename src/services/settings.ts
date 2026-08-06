import AsyncStorage from '@react-native-async-storage/async-storage';
import { getWorkouts, getRoutines, getExercises, getPersonalRecords } from './storage';
import { WorkoutSession, Routine, Exercise, PersonalRecord } from '../types/fitness';

const SETTINGS_KEY = '@fithash_settings_v1';
const DELETED_ROUTINES_KEY = '@fitness_deleted_routines_v1';
const STORAGE_KEYS = {
  EXERCISES: '@fitness_exercises_v1',
  WORKOUTS: '@fitness_workouts_v1',
  ROUTINES: '@fitness_routines_v1',
  PRS: '@fitness_prs_v1',
};

export interface AppSettings {
  geminiApiKey: string;
  selectedModel: string;
  defaultRestSeconds: number; // e.g. 30, 60, 90, 120, 180
  autoStartRestTimer: boolean;
  defaultRir: number; // 0, 1, 2, 3
  weightUnit: 'kg' | 'lbs';
  healthConnectEnabled: boolean;
  workoutDays: number[]; // 0=Pazar, 1=Pazartesi, 2=Salı, 3=Çarşamba, 4=Perşembe, 5=Cuma, 6=Cumartesi
}

export const DEFAULT_SETTINGS: AppSettings = {
  geminiApiKey: '',
  selectedModel: 'gemini-2.0-flash',
  defaultRestSeconds: 90,
  autoStartRestTimer: true,
  defaultRir: 1,
  weightUnit: 'kg',
  healthConnectEnabled: false,
  workoutDays: [1, 2, 3, 4, 5, 6], // Pazartesi - Cumartesi
};

export const getAppSettings = async (): Promise<AppSettings> => {
  try {
    const json = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!json) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(json);
    let selectedModel = parsed.selectedModel || 'gemini-2.0-flash';
    if (selectedModel.includes('2.5')) {
      selectedModel = 'gemini-2.0-flash';
    }
    return { ...DEFAULT_SETTINGS, ...parsed, selectedModel };
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
  /** Antrenman geçmişi */
  workouts: WorkoutSession[];
  /** Ana sayfada gösterilen programlar (varsayılanlar ve kullanıcı ekledikleri) */
  routines: Routine[];
  /** Hareket kütüphanesi (varsayılanlar ve kullanıcı ekledikleri) */
  exercises: Exercise[];
  prs: Record<string, PersonalRecord>;
  /** Kullanıcının ana sayfadan kaldırdığı varsayılan programlar */
  deletedRoutineIds?: string[];
}

export const exportFullDataJSON = async (): Promise<string> => {
  const [workouts, routines, exercises, prs, deletedRoutinesJson] = await Promise.all([
    getWorkouts(),
    getRoutines(),
    getExercises(),
    getPersonalRecords(),
    AsyncStorage.getItem(DELETED_ROUTINES_KEY),
  ]);

  const backup: FullAppDataBackup = {
    version: '2.0.0',
    exportedAt: new Date().toISOString(),
    workouts,
    routines,
    exercises,
    prs,
    deletedRoutineIds: deletedRoutinesJson ? JSON.parse(deletedRoutinesJson) : [],
  };

  return JSON.stringify(backup, null, 2);
};

export const exportWorkoutsCSV = async (): Promise<string> => {
  const workouts = await getWorkouts();
  // UTF-8 BOM for Excel compatibility with Turkish characters
  let csv = '\uFEFF';
  csv += 'Antrenman,Tarih,Süre (dk),Hareket,Kategori,Ekipman,Set No,Durum,Set Tipi,Ağırlık (kg),Tekrar,RIR,Mesafe (km),Kardiyo Süresi (dk),Yakılan Kalori (kcal),Notlar\n';

  workouts.forEach(w => {
    const durationMins = Math.round((w.durationSeconds || 0) / 60);
    const workoutNotes = (w.notes || '').replace(/"/g, '""');

    w.exercises.forEach(ex => {
      const exNotes = (ex.notes || '').replace(/"/g, '""');
      const combinedNotes = [workoutNotes, exNotes].filter(Boolean).join(' | ');

      ex.sets.forEach(set => {
        const status = set.completed ? 'Tamamlandı' : 'Atlandı';
        let setType = 'Normal';
        if (set.isWarmup) setType = 'Isınma';
        if (set.isPR) setType = 'PR';

        const weight = set.weight ?? 0;
        const reps = set.reps ?? 0;
        const rir = set.rir !== undefined && set.rir !== null ? set.rir : '';
        const distance = set.distanceKm ?? '';
        const cardioDuration = set.durationMinutes ?? '';
        const calories = set.caloriesBurned ?? '';

        csv += `"${w.name}","${w.date}",${durationMins},"${ex.exerciseName}","${ex.category || ''}","${ex.equipment || ''}",${set.setNumber},"${status}","${setType}",${weight},${reps},${rir},${distance},${cardioDuration},${calories},"${combinedNotes}"\n`;
      });
    });
  });

  return csv;
};

export const importFullDataJSON = async (jsonString: string): Promise<boolean> => {
  try {
    const backup: FullAppDataBackup = JSON.parse(jsonString);
    if (!backup.workouts || !Array.isArray(backup.workouts)) {
      throw new Error('Geçersiz yedek dosyası formatı!');
    }

    if (backup.workouts) {
      await AsyncStorage.setItem(STORAGE_KEYS.WORKOUTS, JSON.stringify(backup.workouts));
    }
    if (backup.routines) {
      await AsyncStorage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(backup.routines));
    }
    if (backup.exercises) {
      await AsyncStorage.setItem(STORAGE_KEYS.EXERCISES, JSON.stringify(backup.exercises));
    }
    if (backup.prs) {
      await AsyncStorage.setItem(STORAGE_KEYS.PRS, JSON.stringify(backup.prs));
    }
    // v2 yedekleri, ana sayfadan silinen varsayılan programları da saklar.
    // v1 yedeklerde bu alan olmadığından mevcut silme tercihine dokunmuyoruz.
    if (backup.deletedRoutineIds && Array.isArray(backup.deletedRoutineIds)) {
      await AsyncStorage.setItem(
        DELETED_ROUTINES_KEY,
        JSON.stringify(backup.deletedRoutineIds)
      );
    }

    return true;
  } catch (error) {
    console.error('Error importing backup:', error);
    throw error;
  }
};
