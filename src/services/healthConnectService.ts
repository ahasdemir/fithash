import { Platform } from 'react-native';
import {
  initialize,
  requestPermission,
  getGrantedPermissions,
  getSdkStatus,
  SdkAvailabilityStatus,
  openHealthConnectSettings,
  insertRecords,
  ExerciseType,
  Permission,
} from 'react-native-health-connect';
import { WorkoutSession } from '../types/fitness';

const REQUIRED_PERMISSIONS: Permission[] = [
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'write', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'read', recordType: 'TotalCaloriesBurned' },
  { accessType: 'write', recordType: 'TotalCaloriesBurned' },
  { accessType: 'read', recordType: 'ExerciseSession' },
  { accessType: 'write', recordType: 'ExerciseSession' },
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
 * Kullanıcıdan Health Connect için yakılan kalori ve antrenman geçmişi izinlerini ister.
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
    combinedText.includes('barfiks')
  ) {
    return ExerciseType.CALISTHENICS;
  }

  // FitHash ağırlık & fitness takip uygulaması olduğu için kardiyo dışındaki tüm antrenmanları STRENGTH_TRAINING (70) olarak tanımlıyoruz.
  return ExerciseType.STRENGTH_TRAINING;
};

/**
 * Tamamlanan bir antrenman oturumunu ve yakılan kaloriyi Health Connect'e kaydeder.
 */
export const syncWorkoutToHealthConnect = async (
  session: WorkoutSession
): Promise<boolean> => {
  if (Platform.OS !== 'android') return false;
  try {
    const initialized = await initHealthConnect();
    if (!initialized) return false;

    const startIso = new Date(session.startTime).toISOString();
    const durationMs = (session.durationSeconds || 60) * 1000;
    const endIso = new Date(
      session.endTime || session.startTime + durationMs
    ).toISOString();

    const exerciseType = getHealthConnectExerciseType(session);

    // 1. Antrenman Geçmişi (ExerciseSession)
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

    // 2. Yakılan Kalori (ActiveCaloriesBurned & TotalCaloriesBurned)
    // Samsung Health ve Google Fit antrenman kalorisini okumak için TotalCaloriesBurned ve ActiveCaloriesBurned bekler.
    let caloriesToSync = session.totalCaloriesBurned || 0;
    if (caloriesToSync <= 0 && session.durationSeconds > 0) {
      const minutes = Math.max(1, Math.round(session.durationSeconds / 60));
      caloriesToSync = Math.round(minutes * 6); // Ortalama 6 kcal/dakika
    }

    if (caloriesToSync > 0) {
      // 2a. ActiveCaloriesBurned
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
      } catch (e) {
        console.warn('TotalCaloriesBurned yazma hatası:', e);
      }
    }

    console.log(`Antrenman (${session.name}) Health Connect'e senkronize edildi. (Tip: ${exerciseType}, Kalori: ${caloriesToSync})`);
    return true;
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
