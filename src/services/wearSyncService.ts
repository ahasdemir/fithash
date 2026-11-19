import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import {
  Routine,
  WorkoutSession,
  WorkoutExercise,
  ExerciseSet,
  MuscleCategory,
  EquipmentType,
} from '../types/fitness';
import { saveWorkout, getWorkouts, getLocalDateString } from './storage';
import { AppSettings } from './settings';

/**
 * `NativeModules.WearSyncModule` köprüsünün imzalı TypeScript sözleşmesi
 * (android/app/src/main/java/com/fithash/app/WearSyncModule.kt, protokol §5.1).
 * iOS/web üzerinde modül tanımsız olabilir; bu yüzden tüm çağrılar
 * `Platform.OS` ve metod-varlık kontrolleriyle korunur.
 */
export interface WearSyncNativeModule {
  syncRoutinesToWatch(routinesJson: string, settingsJson: string): Promise<number>;
  syncWorkoutsHistoryToWatch(workoutsJson: string): Promise<number>;
  syncActiveSessionToWatch(sessionJson: string | null, revision: number): Promise<number>;
  syncRestTimerToWatch(endTimeMs: number, totalSeconds: number, revision: number): Promise<number>;
  getPendingWearWorkouts(): Promise<string[]>;
  acknowledgeWearWorkout(workoutId: string): Promise<null>;
  getPendingActiveSessionState(): Promise<WearActiveSessionEvent>;
  getPendingRestTimerState(): Promise<WearRestTimerEvent>;
  /** NativeEventEmitter uyumluluk stub'ları (Kotlin tarafında boş bırakılır). */
  addListener(eventType: string): void;
  removeListeners(count: number): void;
}

const { WearSyncModule } = NativeModules as { WearSyncModule?: WearSyncNativeModule };
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
  isWarmup?: boolean;
  durationSeconds?: number | string;
  durationMinutes?: number | string;
  distanceKm?: number | string;
  avgSpeedKmh?: number | string;
  caloriesBurned?: number | string;
}

interface WearExercisePayload {
  id: string;
  exerciseId: string;
  exerciseName: string;
  category?: string;
  equipment?: string;
  sets?: WearSetPayload[];
  notes?: string;
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
  avgRir?: number | string;
  totalCaloriesBurned?: number | string;
  totalCardioDistanceKm?: number | string;
  totalCardioMinutes?: number | string;
  completed?: boolean;
  notes?: string;
}

/** `onWearActiveSessionUpdated` olayı ve `getPendingActiveSessionState()` yükü (protokol §5.2). */
export interface WearActiveSessionEvent {
  sessionJson?: string;
  revision?: number;
  origin?: string;
  cleared?: boolean;
}

/** `onWearRestTimerUpdated` olayı ve `getPendingRestTimerState()` yükü (protokol §5.2). */
export interface WearRestTimerEvent {
  endTimeMs?: number;
  totalSeconds?: number;
  revision?: number;
  origin?: string;
  cleared?: boolean;
}

/** App.tsx'in ActiveWorkoutModal'a prop olarak aktardığı saat kaynaklı dinlenme güncellemesi. */
export interface WearRestTimerUpdate {
  /** Mutlak son tarihi (epoch ms); `null` zamanlayıcının temizlendiği anlamına gelir. */
  endTimeMs: number | null;
  totalSeconds: number;
  revision: number;
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

const toFiniteNumber = (value: number | string | null | undefined, fallback: number): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toOptionalNumber = (value: number | string | null | undefined): number | undefined => {
  if (value === null || value === undefined) return undefined;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/**
 * Saatten gelen ham set verisini uygulamanın `ExerciseSet` tipine dönüştürür.
 * §4.3'e göre `isWarmup`, kardiyo/izometrik alanlar ve RIR senkronizasyonda korunur.
 */
const normalizeWearSet = (s: WearSetPayload): ExerciseSet => ({
  id: s.id,
  setNumber: toFiniteNumber(s.setNumber, 1),
  weight: toFiniteNumber(s.weight, 0),
  reps: toFiniteNumber(s.reps, 0),
  // RIR is optional on the watch. Never turn an unlogged RIR into a false "1".
  rir: typeof s.rir === 'number' ? s.rir : undefined,
  completed: Boolean(s.completed),
  isWarmup: s.isWarmup === true ? true : undefined,
  durationSeconds: toOptionalNumber(s.durationSeconds),
  durationMinutes: toOptionalNumber(s.durationMinutes),
  distanceKm: toOptionalNumber(s.distanceKm),
  avgSpeedKmh: toOptionalNumber(s.avgSpeedKmh),
  caloriesBurned: toOptionalNumber(s.caloriesBurned),
});

const normalizeWearExercise = (ex: WearExercisePayload): WorkoutExercise => ({
  id: ex.id,
  exerciseId: ex.exerciseId,
  exerciseName: ex.exerciseName,
  category: isMuscleCategory(ex.category) ? ex.category : 'Göğüs',
  equipment: isEquipmentType(ex.equipment) ? ex.equipment : 'Barbell',
  sets: (ex.sets || []).map(normalizeWearSet),
  notes: typeof ex.notes === 'string' ? ex.notes : undefined,
});

/**
 * Protokol §1.3: yansıtılan durumlar (`active_session`, `rest_timer`) her kanal
 * için ayrı, monoton artan epoch-ms revizyonları taşır. Aynı milisaniyede iki
 * güncelleme yapılsa bile revizyon asla tekrarlamaz; saatten gelen daha yeni bir
 * revizyon `observe` ile yerel zemini yükseltir ki telefonun bir sonraki
 * güncellemesi saat tarafında "bayat" sayılmasın.
 */
export interface MonotonicRevisionClock {
  next(): number;
  observe(revision: number): void;
}

export const createMonotonicRevisionClock = (): MonotonicRevisionClock => {
  let last = 0;
  return {
    next: () => {
      last = Math.max(Date.now(), last + 1);
      return last;
    },
    observe: (revision: number) => {
      if (Number.isFinite(revision) && revision > last) {
        last = revision;
      }
    },
  };
};

// Her yansıtılan durum kendi revizyon serisini kullanır (yerel native önbellek de
// activeSessionRevision / restTimerRevision anahtarlarını ayrı tutar).
const activeSessionRevision = createMonotonicRevisionClock();
const restTimerRevision = createMonotonicRevisionClock();

/** Saate gönderilecek antrenman geçmişinin azami uzunluğu (DataItem yükü <100KB tutulur). */
export const WEAR_WORKOUTS_HISTORY_LIMIT = 30;

/**
 * Saate gönderilecek geçmişi hazırlar: yalnızca tamamlanmış antrenmanlar,
 * en yeni `limit` kayıt.
 */
export const selectWorkoutsForWearHistory = (
  workouts: WorkoutSession[],
  limit: number = WEAR_WORKOUTS_HISTORY_LIMIT
): WorkoutSession[] =>
  (workouts || []).filter(w => w && w.completed !== false).slice(0, limit);

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
 * Kayıtlı antrenman geçmişini saatin "Kayıtlı Antrenmanlar" ekranına eşitler
 * (`/fithash/state/workouts_history` + `/fithash/sync_workouts_history`, §2/§3).
 */
export const syncWorkoutsHistoryToWearable = async (
  workouts: WorkoutSession[]
): Promise<number> => {
  if (Platform.OS !== 'android' || !WearSyncModule?.syncWorkoutsHistoryToWatch) {
    return 0;
  }

  try {
    // Sadece tamamlanmış son 30 antrenman gönderilir; DataItem yükü kompakt kalır.
    const recent = selectWorkoutsForWearHistory(workouts);
    return await WearSyncModule.syncWorkoutsHistoryToWatch(JSON.stringify(recent));
  } catch (error) {
    console.warn('Failed to sync workouts history to Wear OS:', error);
    return 0;
  }
};

/**
 * Aktif antrenman seansını saate aynalar (`/fithash/state/active_session`, §2).
 * `null` (veya `completed` bir seans) gönderildiğinde saat tarafında `cleared=true`
 * olarak yorumlanır; aksi halde seans JSON'u olduğu gibi iletilir.
 */
export const syncActiveSessionToWearable = async (
  session: WorkoutSession | null
): Promise<number> => {
  if (Platform.OS !== 'android' || !WearSyncModule?.syncActiveSessionToWatch) {
    return 0;
  }

  try {
    // Bitmiş/iptal edilmiş seanslar aynadan kaldırılır (cleared=true).
    const json = session && !session.completed ? JSON.stringify(session) : null;
    return await WearSyncModule.syncActiveSessionToWatch(json, activeSessionRevision.next());
  } catch (error) {
    console.warn('Failed to sync active session to Wear OS:', error);
    return 0;
  }
};

/**
 * Dinlenme zamanlayıcısının mutlak son tarihini saate aynalar
 * (`/fithash/state/rest_timer`, §2). `endTimeMs` geçmişte/null ise veya 0 ise
 * zamanlayıcı saatten temizlenir (cleared=true).
 */
export const syncRestTimerToWearable = async (
  endTimeMs: number | null,
  totalSeconds: number = 0
): Promise<number> => {
  if (Platform.OS !== 'android' || !WearSyncModule?.syncRestTimerToWatch) {
    return 0;
  }

  try {
    const endMs = endTimeMs && endTimeMs > Date.now() ? endTimeMs : 0;
    const total = endMs > 0 ? Math.max(1, Math.round(totalSeconds || (endMs - Date.now()) / 1000)) : 0;
    return await WearSyncModule.syncRestTimerToWatch(endMs, total, restTimerRevision.next());
  } catch (error) {
    console.warn('Failed to sync rest timer to Wear OS:', error);
    return 0;
  }
};

/**
 * Saatin gönderdiği aktif seans JSON'unu `WorkoutSession`'a çevirir.
 * Geçersiz/bozuk yüklerde `null` döner. `completed=true` bir seans aktif ayna
 * kanalına ait değildir (saat o seansı bitirmiştir) ve temizlenmiş gibi yorumlanır.
 */
export const parseWearActiveSession = (sessionJson: string): WorkoutSession | null => {
  if (!sessionJson) return null;

  try {
    const raw: unknown = JSON.parse(sessionJson);
    if (typeof raw !== 'object' || raw === null) return null;
    const wear = raw as WearSessionPayload;

    if (typeof wear.id !== 'string' || !wear.id) return null;
    if (typeof wear.startTime !== 'number' || !Number.isFinite(wear.startTime)) return null;
    if (wear.completed === true) return null;

    return {
      id: wear.id,
      name: typeof wear.name === 'string' && wear.name ? wear.name : 'Saat Antrenmanı',
      routineId: typeof wear.routineId === 'string' ? wear.routineId : undefined,
      date:
        typeof wear.date === 'string' && wear.date ? wear.date : getLocalDateString(wear.startTime),
      startTime: wear.startTime,
      endTime: toOptionalNumber(wear.endTime),
      durationSeconds: toFiniteNumber(wear.durationSeconds, 0),
      exercises: Array.isArray(wear.exercises) ? wear.exercises.map(normalizeWearExercise) : [],
      totalVolume: toFiniteNumber(wear.totalVolume, 0),
      totalSets: toFiniteNumber(wear.totalSets, 0),
      avgRir: toOptionalNumber(wear.avgRir),
      totalCaloriesBurned: toOptionalNumber(wear.totalCaloriesBurned),
      totalCardioDistanceKm: toOptionalNumber(wear.totalCardioDistanceKm),
      totalCardioMinutes: toOptionalNumber(wear.totalCardioMinutes),
      completed: false,
      notes: typeof wear.notes === 'string' ? wear.notes : undefined,
    };
  } catch {
    return null;
  }
};

/**
 * Saat kaynaklı dinlenme olayı temizlenmiş sayılır mı? (§7.3: `cleared === true`
 * veya `endTimeMs <= Date.now()`).
 */
export const isWearRestTimerCleared = (
  event: Pick<WearRestTimerEvent, 'endTimeMs' | 'cleared'>,
  now: number = Date.now()
): boolean =>
  event.cleared === true || !event.endTimeMs || event.endTimeMs <= 0 || event.endTimeMs <= now;

/** Telefon JS kapalıyken saatin yansıttığı son aktif seans durumu (native önbellek). */
export interface WearPendingActiveSessionState {
  /** `null` = saat seansı bitirdi/vazgeçti (cleared); aksi halde güncel aynalanmış seans. */
  session: WorkoutSession | null;
  revision: number;
}

/**
 * Native `SharedPreferences("fithash_wear_state")` önbelleğinden bekleyen aktif
 * seansı okur. Telefon uygulaması saatte başlatılan bir antrenmandan sonra
 * açıldığında JS olayını kaçırmış olabilir; bu durumda güncel durum buradadır.
 * Hiç eşitleme yapılmamışsa (`revision <= 0`) veya yük çözümlenemiyorsa `null` döner.
 */
export const getPendingWearActiveSession = async (): Promise<WearPendingActiveSessionState | null> => {
  if (Platform.OS !== 'android' || !WearSyncModule?.getPendingActiveSessionState) {
    return null;
  }

  try {
    const state = await WearSyncModule.getPendingActiveSessionState();
    const revision = Number(state?.revision) || 0;
    if (revision <= 0) return null;

    // Saat tarafındaki en yeni revizyonu yerel seriye taşı.
    activeSessionRevision.observe(revision);

    const cleared = state.cleared === true;
    if (cleared || !state.sessionJson) {
      return { session: null, revision };
    }
    const session = parseWearActiveSession(state.sessionJson);
    return session ? { session, revision } : null;
  } catch (error) {
    console.warn('Failed to read pending Wear OS active session:', error);
    return null;
  }
};

/** Telefon JS kapalıyken saatin yansıttığı son dinlenme zamanlayıcısı durumu. */
export interface WearPendingRestTimerState {
  /** `null` = temizlendi/süresi doldu; aksi halde mutlak son tarihi (epoch ms). */
  endTimeMs: number | null;
  revision: number;
}

/**
 * Native önbelleğinden bekleyen dinlenme zamanlayıcısını okur. Süresi geçmiş
 * bir zamanlayıcı temizlenmiş gibi raporlanır (`endTimeMs: null`).
 */
export const getPendingWearRestTimer = async (): Promise<WearPendingRestTimerState | null> => {
  if (Platform.OS !== 'android' || !WearSyncModule?.getPendingRestTimerState) {
    return null;
  }

  try {
    const state = await WearSyncModule.getPendingRestTimerState();
    const revision = Number(state?.revision) || 0;
    if (revision <= 0) return null;

    restTimerRevision.observe(revision);

    const endTimeMs = Number(state?.endTimeMs) || 0;
    const cleared = isWearRestTimerCleared({ endTimeMs, cleared: state?.cleared });
    return { endTimeMs: cleared ? null : endTimeMs, revision };
  } catch (error) {
    console.warn('Failed to read pending Wear OS rest timer:', error);
    return null;
  }
};

/** `initWearSyncListener` için saat kaynaklı ayna olayı geri çağırımları (§7.1.4). */
export interface WearSyncListenerOptions {
  /**
   * Saat aktif seansı başlattı/düzenledi veya temizledi.
   * `session === null` seansın bittiğini/vazgeçildiğini bildirir.
   */
  onActiveSessionUpdated?: (session: WorkoutSession | null, revision: number) => void;
  /**
   * Saat dinlenme zamanlayıcısını başlattı/ayarladı veya temizledi.
   * `endTimeMs === null` zamanlayıcının iptal edildiğini bildirir.
   */
  onRestTimerUpdated?: (endTimeMs: number | null, totalSeconds: number, revision: number) => void;
}

/**
 * Initializes the Wear OS event listener on the phone to automatically save completed
 * workouts performed on the watch, answer full-sync requests, and mirror the
 * watch-originated active session & rest timer updates.
 */
export const initWearSyncListener = (
  onWorkoutReceived?: (session: WorkoutSession) => void,
  onSyncRequested?: () => void,
  options?: WearSyncListenerOptions
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
        endTime: toOptionalNumber(wearSession.endTime),
        durationSeconds: toFiniteNumber(wearSession.durationSeconds, 0),
        exercises: (wearSession.exercises || []).map(normalizeWearExercise),
        totalVolume: toFiniteNumber(wearSession.totalVolume, 0),
        totalSets: toFiniteNumber(wearSession.totalSets, 0),
        avgRir: toOptionalNumber(wearSession.avgRir),
        totalCaloriesBurned: toOptionalNumber(wearSession.totalCaloriesBurned),
        totalCardioDistanceKm: toOptionalNumber(wearSession.totalCardioDistanceKm),
        totalCardioMinutes: toOptionalNumber(wearSession.totalCardioMinutes),
        completed: true,
        notes: 'FitHash Wear OS Saati ile kaydedildi.',
      };

      await saveWorkout(fullSession);
      await WearSyncModule?.acknowledgeWearWorkout?.(fullSession.id);
      // Saatin "Kayıtlı Antrenmanlar" listesi yeni kaydı hemen görsün (§7.1.4).
      void getWorkouts().then(workouts => syncWorkoutsHistoryToWearable(workouts));
      onWorkoutReceived?.(fullSession);
    } catch (e) {
      console.warn('Error processing Wear OS workout session:', e);
    }
  };

  // A native listener persists incoming workouts, including when the React app is closed.
  // Drain that durable inbox at startup as well as processing live events.
  WearSyncModule?.getPendingWearWorkouts?.()
    .then((sessions: string[] = []) => Promise.all(sessions.map(session => importWorkout(session))))
    .catch((error: unknown) => console.warn('Failed to read the Wear OS workout inbox:', error));

  const subWorkout = wearEmitter.addListener('onWearWorkoutCompleted', (event: { sessionJson?: string }) => {
    void importWorkout(event?.sessionJson);
  });

  const subSync = wearEmitter.addListener('onWearRequestSync', () => {
    onSyncRequested?.();
  });

  const subActiveSession = wearEmitter.addListener(
    'onWearActiveSessionUpdated',
    (event: WearActiveSessionEvent) => {
      const revision = Number(event?.revision) || 0;
      // Saatin revizyonu yerel zemini yükseltir; sonraki telefon güncellemesi
      // saat tarafında bayat sayılmaz.
      activeSessionRevision.observe(revision);

      if (event?.cleared) {
        options?.onActiveSessionUpdated?.(null, revision);
        return;
      }

      const session = parseWearActiveSession(event?.sessionJson || '');
      if (!session) {
        console.warn('Ignoring malformed Wear OS active session update.');
        return;
      }
      options?.onActiveSessionUpdated?.(session, revision);
    }
  );

  const subRestTimer = wearEmitter.addListener(
    'onWearRestTimerUpdated',
    (event: WearRestTimerEvent) => {
      const revision = Number(event?.revision) || 0;
      restTimerRevision.observe(revision);

      const endTimeMs = Number(event?.endTimeMs) || 0;
      if (isWearRestTimerCleared({ endTimeMs, cleared: event?.cleared })) {
        options?.onRestTimerUpdated?.(null, 0, revision);
      } else {
        options?.onRestTimerUpdated?.(endTimeMs, Number(event?.totalSeconds) || 0, revision);
      }
    }
  );

  return () => {
    subWorkout.remove();
    subSync.remove();
    subActiveSession.remove();
    subRestTimer.remove();
  };
};
