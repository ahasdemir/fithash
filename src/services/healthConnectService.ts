import { Platform } from 'react-native';
import {
  initialize,
  requestPermission,
  getGrantedPermissions,
  getSdkStatus,
  SdkAvailabilityStatus,
  openHealthConnectSettings,
  insertRecords,
  readRecords,
  ExerciseType,
  Permission,
} from 'react-native-health-connect';
import { WorkoutSession, HealthDataSummary } from '../types/fitness';

const REQUIRED_PERMISSIONS: Permission[] = [
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'write', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'read', recordType: 'TotalCaloriesBurned' },
  { accessType: 'write', recordType: 'TotalCaloriesBurned' },
  { accessType: 'read', recordType: 'ExerciseSession' },
  { accessType: 'write', recordType: 'ExerciseSession' },
  { accessType: 'read', recordType: 'Distance' },
  { accessType: 'write', recordType: 'Distance' },
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'write', recordType: 'Steps' },
];

/**
 * Health Connect SDK'sını başlatır.
 */
export const initHealthConnect = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return false;
  try {
    const status = await getSdkStatus();
    if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
      console.warn('Health Connect SDK mevcut değil, durum:', status);
      if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
        try { await openHealthConnectSettings(); } catch (_) {}
      }
      return false;
    }
    const isInitialized = await initialize();
    return isInitialized;
  } catch (error) {
    console.warn('Health Connect başlatılamadı:', error);
    return false;
  }
};

/**
 * Health Connect izinlerinin verilip verilmediğini kontrol eder.
 */
export const checkHealthConnectPermissions = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return false;
  try {
    const initialized = await initHealthConnect();
    if (!initialized) return false;
    const granted = await getGrantedPermissions();
    return granted.length > 0;
  } catch (error) {
    console.warn('Health Connect izin kontrolü hatası:', error);
    return false;
  }
};

/**
 * Kullanıcıdan Health Connect için yakılan kalori, adım, mesafe ve antrenman geçmişi izinlerini ister.
 */
export const requestHealthConnectPermissions = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return false;
  try {
    const initialized = await initHealthConnect();
    if (!initialized) {
      try { await openHealthConnectSettings(); } catch (_) {}
      return false;
    }
    const granted = await requestPermission(REQUIRED_PERMISSIONS);
    return granted.length > 0;
  } catch (error) {
    console.warn('Health Connect izin isteme hatası:', error);
    try { await openHealthConnectSettings(); } catch (_) {}
    return false;
  }
};

/**
 * WorkoutSession içindeki egzersiz adı ve kategorisine göre Health Connect ExerciseType sayısal kodunu belirler.
 */
export const getHealthConnectExerciseType = (session: WorkoutSession): number => {
  const sessionName = (session.name || '').toLowerCase();
  const exerciseNames = (session.exercises || []).map((e) => e.exerciseName.toLowerCase()).join(' ');
  const combinedText = `${sessionName} ${exerciseNames}`;

  // 1. Eliptik
  if (combinedText.includes('eliptik') || combinedText.includes('elliptical')) {
    return ExerciseType.ELLIPTICAL;
  }

  // 2. Yürüyüş
  if (combinedText.includes('yürüyüş') || combinedText.includes('yuruyus') || combinedText.includes('walk')) {
    return ExerciseType.WALKING;
  }

  // 3. Bisiklet
  if (
    combinedText.includes('bisiklet') ||
    combinedText.includes('biking') ||
    combinedText.includes('cycling') ||
    combinedText.includes('bike') ||
    combinedText.includes('spin')
  ) {
    return ExerciseType.BIKING;
  }

  // 4. Koşu / Koşu Bandı
  if (
    combinedText.includes('koşu') ||
    combinedText.includes('kosu') ||
    combinedText.includes('run') ||
    combinedText.includes('treadmill')
  ) {
    if (combinedText.includes('band') || combinedText.includes('treadmill')) {
      return ExerciseType.RUNNING_TREADMILL;
    }
    return ExerciseType.RUNNING;
  }

  // 5. Kürek
  if (combinedText.includes('kürek') || combinedText.includes('kurek') || combinedText.includes('rowing') || combinedText.includes('rower')) {
    return ExerciseType.ROWING;
  }

  // 6. HIIT / Kardiyo Genel
  if (combinedText.includes('hiit') || combinedText.includes('tabata') || combinedText.includes('interval')) {
    return ExerciseType.HIGH_INTENSITY_INTERVAL_TRAINING;
  }

  // 7. Merdiven
  if (combinedText.includes('merdiven') || combinedText.includes('stair')) {
    return ExerciseType.STAIR_CLIMBING;
  }

  // 8. Kalistenik / Vücut Ağırlığı
  if (
    combinedText.includes('kalistenik') ||
    combinedText.includes('calisthenics') ||
    combinedText.includes('şınav') ||
    combinedText.includes('barfiks') ||
    combinedText.includes('pull up') ||
    combinedText.includes('push up')
  ) {
    return ExerciseType.CALISTHENICS;
  }

  // 9. Yüzme
  if (combinedText.includes('yüzme') || combinedText.includes('yuzme') || combinedText.includes('swim')) {
    return ExerciseType.SWIMMING_OPEN_WATER;
  }

  // 10. Pilates / Yoga
  if (combinedText.includes('pilates')) {
    return ExerciseType.PILATES;
  }
  if (combinedText.includes('yoga')) {
    return ExerciseType.YOGA;
  }

  // FitHash ağırlık & fitness takip uygulaması olduğu için kardiyo dışındaki tüm antrenmanları STRENGTH_TRAINING olarak tanımlıyoruz.
  return ExerciseType.STRENGTH_TRAINING;
};

/**
 * Tamamlanan bir antrenman oturumunu, yakılan kaloriyi ve kardiyo mesafesini Health Connect'e kaydeder.
 */
export const syncWorkoutToHealthConnect = async (
  session: WorkoutSession
): Promise<boolean> => {
  if (Platform.OS !== 'android') return false;
  try {
    const initialized = await initHealthConnect();
    if (!initialized) return false;

    const startTimeMs = session.startTime || Date.now();
    const durationMs = Math.max(session.durationSeconds || 60, 60) * 1000;
    let endTimeMs = session.endTime || (startTimeMs + durationMs);

    // Health Connect kuralı: endTime strictly > startTime
    if (endTimeMs <= startTimeMs) {
      endTimeMs = startTimeMs + durationMs;
    }

    const startIso = new Date(startTimeMs).toISOString();
    const endIso = new Date(endTimeMs).toISOString();

    const exerciseType = getHealthConnectExerciseType(session);

    let syncedAny = false;

    // 1. Antrenman Geçmişi (ExerciseSession)
    try {
      const exerciseListStr = session.exercises
        ? session.exercises.map((e) => e.exerciseName).join(', ')
        : '';
      const notesStr = [
        session.notes ? `Not: ${session.notes}` : '',
        exerciseListStr ? `Egzersizler: ${exerciseListStr}` : '',
        session.totalVolume ? `Toplam Hacim: ${session.totalVolume} kg` : '',
        session.totalCardioDistanceKm ? `Mesafe: ${session.totalCardioDistanceKm} km` : '',
        `Set Sayısı: ${session.totalSets || 0}`,
      ]
        .filter(Boolean)
        .join('\n');

      await insertRecords([
        {
          recordType: 'ExerciseSession',
          startTime: startIso,
          endTime: endIso,
          exerciseType,
          title: session.name || 'Antrenman',
          notes: notesStr,
        },
      ]);
      syncedAny = true;
    } catch (err) {
      console.warn('ExerciseSession senkronizasyon hatası:', err);
    }

    // 2. Yakılan Kalori (ActiveCaloriesBurned & TotalCaloriesBurned)
    let caloriesToSync = session.totalCaloriesBurned || 0;
    if (caloriesToSync <= 0 && session.durationSeconds > 0) {
      const minutes = Math.max(1, Math.round(session.durationSeconds / 60));
      caloriesToSync = Math.round(minutes * 6); // Ortalama 6 kcal/dakika
    }

    if (caloriesToSync > 0) {
      // 2a. ActiveCaloriesBurned
      try {
        await insertRecords([
          {
            recordType: 'ActiveCaloriesBurned',
            startTime: startIso,
            endTime: endIso,
            energy: {
              value: caloriesToSync,
              unit: 'kilocalories',
            },
          },
        ]);
        syncedAny = true;
      } catch (err) {
        console.warn('ActiveCaloriesBurned yazma hatası:', err);
      }

      // 2b. TotalCaloriesBurned (Samsung Health senkronizasyonu için şarttır)
      try {
        await insertRecords([
          {
            recordType: 'TotalCaloriesBurned',
            startTime: startIso,
            endTime: endIso,
            energy: {
              value: caloriesToSync,
              unit: 'kilocalories',
            },
          },
        ]);
      } catch (err) {
        console.warn('TotalCaloriesBurned yazma hatası:', err);
      }
    }

    // 3. Kat Edilen Mesafe (Distance)
    if (session.totalCardioDistanceKm && session.totalCardioDistanceKm > 0) {
      try {
        await insertRecords([
          {
            recordType: 'Distance',
            startTime: startIso,
            endTime: endIso,
            distance: {
              value: session.totalCardioDistanceKm * 1000, // metre cinsinden
              unit: 'meters',
            },
          },
        ]);
        syncedAny = true;
      } catch (err) {
        console.warn('Distance kaydı yazma hatası:', err);
      }
    }

    console.log(`Antrenman (${session.name}) Health Connect'e senkronize edildi. (Tip: ${exerciseType}, Kalori: ${caloriesToSync})`);
    return syncedAny;
  } catch (error) {
    console.error('Health Connect senkronizasyon hatası:', error);
    return false;
  }
};

/**
 * Tüm geçmiş antrenmanları toplu olarak Health Connect'e aktarır.
 */
export const syncAllWorkoutsToHealthConnect = async (
  workouts: WorkoutSession[]
): Promise<{ success: number; failed: number }> => {
  let success = 0;
  let failed = 0;

  for (const session of workouts) {
    const res = await syncWorkoutToHealthConnect(session);
    if (res) {
      success++;
    } else {
      failed++;
    }
  }

  return { success, failed };
};

/**
 * Belirtilen tarih aralığında Health Connect'ten adım, kalori ve mesafe özetini okur.
 */
export const readHealthConnectData = async (
  startDate: Date,
  endDate: Date
): Promise<HealthDataSummary | null> => {
  if (Platform.OS !== 'android') return null;

  try {
    const initialized = await initHealthConnect();
    if (!initialized) return null;

    const timeRangeFilter = {
      operator: 'between' as const,
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
    };

    let totalSteps = 0;
    let activeCalories = 0;
    let totalCalories = 0;
    let distanceKm = 0;

    // 1. Adım Sayısı
    try {
      const stepRes = await readRecords('Steps', { timeRangeFilter });
      if (stepRes && stepRes.records) {
        totalSteps = stepRes.records.reduce((sum, r) => sum + (r.count || 0), 0);
      }
    } catch (e) {
      // Step permission not granted or not supported
    }

    // 2. Aktif Kalori
    try {
      const calRes = await readRecords('ActiveCaloriesBurned', { timeRangeFilter });
      if (calRes && calRes.records) {
        activeCalories = calRes.records.reduce((sum, r: any) => sum + (r.energy?.inKilocalories || r.energy?.value || 0), 0);
      }
    } catch (e) {
      // Calories permission not granted
    }

    // 3. Toplam Kalori
    try {
      const totCalRes = await readRecords('TotalCaloriesBurned', { timeRangeFilter });
      if (totCalRes && totCalRes.records) {
        totalCalories = totCalRes.records.reduce((sum, r: any) => sum + (r.energy?.inKilocalories || r.energy?.value || 0), 0);
      }
    } catch (e) {
      // Total calories permission not granted
    }

    // 4. Mesafe
    try {
      const distRes = await readRecords('Distance', { timeRangeFilter });
      if (distRes && distRes.records) {
        const meters = distRes.records.reduce((sum, r: any) => sum + (r.distance?.inMeters || r.distance?.value || 0), 0);
        distanceKm = Math.round((meters / 1000) * 100) / 100;
      }
    } catch (e) {
      // Distance permission not granted
    }

    return {
      steps: totalSteps,
      activeCalories: Math.round(activeCalories),
      totalCalories: Math.round(totalCalories || activeCalories),
      distanceKm,
      lastSyncedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.warn('Health Connect veri okuma hatası:', error);
    return null;
  }
};

/**
 * Bugünün Health Connect özet verisini getirir.
 */
export const readTodayHealthData = async (): Promise<HealthDataSummary | null> => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  return readHealthConnectData(startOfDay, now);
};

