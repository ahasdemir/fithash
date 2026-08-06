import AsyncStorage from '@react-native-async-storage/async-storage';
import { Exercise, WorkoutSession, Routine, PersonalRecord, UserStats } from '../types/fitness';
import { INITIAL_EXERCISES, DEFAULT_ROUTINES } from '../data/exerciseLibrary';

const STORAGE_KEYS = {
  EXERCISES: '@fitness_exercises_v1',
  WORKOUTS: '@fitness_workouts_v1',
  ROUTINES: '@fitness_routines_v1',
  PRS: '@fitness_prs_v1',
  ACTIVE_SESSION: '@fitness_active_session_v1',
  ACTIVE_REST_TIMER: '@fitness_active_rest_timer_v1',
  CACHED_AI_ANALYSIS: '@fitness_cached_ai_analysis_v1',
};

export const getCachedAIAnalysis = async (): Promise<any | null> => {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEYS.CACHED_AI_ANALYSIS);
    return json ? JSON.parse(json) : null;
  } catch (e) {
    return null;
  }
};

export const saveCachedAIAnalysis = async (analysis: any): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.CACHED_AI_ANALYSIS, JSON.stringify(analysis));
  } catch (e) {
    console.error('Error caching AI analysis:', e);
  }
};

export const clearCachedAIAnalysis = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.CACHED_AI_ANALYSIS);
  } catch (e) {
    console.error('Error clearing cached AI analysis:', e);
  }
};

// --- EXERCISES ---
export const getExercises = async (): Promise<Exercise[]> => {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEYS.EXERCISES);
    if (json) {
      const custom: Exercise[] = JSON.parse(json);
      // Merge initial exercises with custom exercises, avoiding duplicates
      const customIds = new Set(custom.map(e => e.id));
      const filteredInitial = INITIAL_EXERCISES.filter(e => !customIds.has(e.id));
      return [...filteredInitial, ...custom];
    }
    return INITIAL_EXERCISES;
  } catch (error) {
    console.error('Error fetching exercises:', error);
    return INITIAL_EXERCISES;
  }
};

export const saveCustomExercise = async (exercise: Exercise): Promise<Exercise[]> => {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEYS.EXERCISES);
    const existing: Exercise[] = json ? JSON.parse(json) : [];
    const updated = [exercise, ...existing];
    await AsyncStorage.setItem(STORAGE_KEYS.EXERCISES, JSON.stringify(updated));
    return getExercises();
  } catch (error) {
    console.error('Error saving custom exercise:', error);
    throw error;
  }
};

export const deleteCustomExercise = async (id: string): Promise<Exercise[]> => {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEYS.EXERCISES);
    const existing: Exercise[] = json ? JSON.parse(json) : [];
    const updated = existing.filter(e => e.id !== id);
    await AsyncStorage.setItem(STORAGE_KEYS.EXERCISES, JSON.stringify(updated));
    return getExercises();
  } catch (error) {
    console.error('Error deleting custom exercise:', error);
    throw error;
  }
};

// --- ROUTINES ---
const DELETED_ROUTINES_KEY = '@fitness_deleted_routines_v1';

export const getRoutines = async (): Promise<Routine[]> => {
  try {
    const [json, deletedJson] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.ROUTINES),
      AsyncStorage.getItem(DELETED_ROUTINES_KEY),
    ]);

    const deletedIds: string[] = deletedJson ? JSON.parse(deletedJson) : [];
    const deletedSet = new Set(deletedIds);

    let allRoutines = DEFAULT_ROUTINES;
    if (json) {
      const custom: Routine[] = JSON.parse(json);
      const customIds = new Set(custom.map(r => r.id));
      const filteredDefaults = DEFAULT_ROUTINES.filter(r => !customIds.has(r.id));
      allRoutines = [...filteredDefaults, ...custom];
    }

    return allRoutines.filter(r => !deletedSet.has(r.id));
  } catch (error) {
    console.error('Error fetching routines:', error);
    return DEFAULT_ROUTINES;
  }
};

export const saveRoutine = async (routine: Routine): Promise<Routine[]> => {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEYS.ROUTINES);
    const existing: Routine[] = json ? JSON.parse(json) : [];
    const index = existing.findIndex(r => r.id === routine.id);
    let updated: Routine[];
    if (index >= 0) {
      updated = [...existing];
      updated[index] = routine;
    } else {
      updated = [routine, ...existing];
    }
    await AsyncStorage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(updated));
    return getRoutines();
  } catch (error) {
    console.error('Error saving routine:', error);
    throw error;
  }
};

export const saveRoutinesOrder = async (routines: Routine[]): Promise<Routine[]> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(routines));
    return getRoutines();
  } catch (error) {
    console.error('Error saving routines order:', error);
    throw error;
  }
};

export const deleteRoutine = async (id: string): Promise<Routine[]> => {
  try {
    const deletedJson = await AsyncStorage.getItem(DELETED_ROUTINES_KEY);
    const deletedIds: string[] = deletedJson ? JSON.parse(deletedJson) : [];
    if (!deletedIds.includes(id)) {
      deletedIds.push(id);
      await AsyncStorage.setItem(DELETED_ROUTINES_KEY, JSON.stringify(deletedIds));
    }

    const json = await AsyncStorage.getItem(STORAGE_KEYS.ROUTINES);
    if (json) {
      const existing: Routine[] = JSON.parse(json);
      const updated = existing.filter(r => r.id !== id);
      await AsyncStorage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(updated));
    }
    return getRoutines();
  } catch (error) {
    console.error('Error deleting routine:', error);
    throw error;
  }
};

// --- WORKOUTS ---
export const getWorkouts = async (): Promise<WorkoutSession[]> => {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEYS.WORKOUTS);
    if (json) {
      const workouts: WorkoutSession[] = JSON.parse(json);
      // Sort newest first
      return workouts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    return [];
  } catch (error) {
    console.error('Error fetching workouts:', error);
    return [];
  }
};

export const saveWorkout = async (workout: WorkoutSession): Promise<WorkoutSession[]> => {
  try {
    const workouts = await getWorkouts();
    const existingIndex = workouts.findIndex(w => w.id === workout.id);
    let updatedWorkouts: WorkoutSession[];
    
    if (existingIndex >= 0) {
      updatedWorkouts = [...workouts];
      updatedWorkouts[existingIndex] = workout;
    } else {
      updatedWorkouts = [workout, ...workouts];
    }

    await AsyncStorage.setItem(STORAGE_KEYS.WORKOUTS, JSON.stringify(updatedWorkouts));
    await updatePRsFromWorkout(workout);
    return updatedWorkouts;
  } catch (error) {
    console.error('Error saving workout:', error);
    throw error;
  }
};

export const deleteWorkout = async (id: string): Promise<WorkoutSession[]> => {
  try {
    const workouts = await getWorkouts();
    const updated = workouts.filter(w => w.id !== id);
    await AsyncStorage.setItem(STORAGE_KEYS.WORKOUTS, JSON.stringify(updated));
    return updated;
  } catch (error) {
    console.error('Error deleting workout:', error);
    throw error;
  }
};

// --- ACTIVE SESSION (persisted across app restarts) ---
export const getActiveSession = async (): Promise<WorkoutSession | null> => {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION);
    return json ? JSON.parse(json) : null;
  } catch (error) {
    console.error('Error fetching active session:', error);
    return null;
  }
};

export const saveActiveSession = async (session: WorkoutSession): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(session));
  } catch (error) {
    console.error('Error saving active session:', error);
  }
};

export const clearActiveSession = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
  } catch (error) {
    console.error('Error clearing active session:', error);
  }
};

// --- ACTIVE REST TIMER (persisted deadline, survives app restart) ---
export const getActiveRestTimerEnd = async (): Promise<number | null> => {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_REST_TIMER);
    return json ? Number(JSON.parse(json)) : null;
  } catch (error) {
    console.error('Error fetching rest timer:', error);
    return null;
  }
};

export const saveActiveRestTimerEnd = async (endTime: number | null): Promise<void> => {
  try {
    if (endTime === null) {
      await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_REST_TIMER);
    } else {
      await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_REST_TIMER, JSON.stringify(endTime));
    }
  } catch (error) {
    console.error('Error saving rest timer:', error);
  }
};

// --- PERSONAL RECORDS (PRs) ---
export const getPersonalRecords = async (): Promise<Record<string, PersonalRecord>> => {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEYS.PRS);
    return json ? JSON.parse(json) : {};
  } catch (error) {
    console.error('Error fetching PRs:', error);
    return {};
  }
};

const updatePRsFromWorkout = async (workout: WorkoutSession): Promise<void> => {
  try {
    const prs = await getPersonalRecords();
    let updated = false;

    workout.exercises.forEach(ex => {
      let maxW = 0;
      let maxR = 0;
      let exVol = 0;

      ex.sets.forEach(set => {
        if (set.completed && set.weight > 0) {
          if (set.weight > maxW) {
            maxW = set.weight;
            maxR = set.reps;
          }
          exVol += set.weight * set.reps;
        }
      });

      if (maxW > 0) {
        const existingPR = prs[ex.exerciseId];
        if (!existingPR || maxW > existingPR.maxWeight) {
          prs[ex.exerciseId] = {
            exerciseId: ex.exerciseId,
            exerciseName: ex.exerciseName,
            maxWeight: maxW,
            maxReps: maxR,
            maxVolume: Math.max(exVol, existingPR?.maxVolume || 0),
            date: workout.date,
          };
          updated = true;
        }
      }
    });

    if (updated) {
      await AsyncStorage.setItem(STORAGE_KEYS.PRS, JSON.stringify(prs));
    }
  } catch (error) {
    console.error('Error updating PRs:', error);
  }
};

// --- USER STATS CALCULATION ---
export const calculateUserStats = (
  workouts: WorkoutSession[],
  workoutDays: number[] = [1, 2, 3, 4, 5, 6]
): UserStats => {
  let totalVolumeKg = 0;
  let totalSets = 0;
  let totalHardSets = 0;
  let totalTimeSeconds = 0;
  let totalCaloriesBurned = 0;
  let totalCardioDistanceKm = 0;

  let totalPlannedSetsCount = 0;
  let completedSetsCount = 0;
  let totalActiveSeconds = 0;
  let totalRirSum = 0;
  let totalRirCount = 0;

  workouts.forEach(workout => {
    totalTimeSeconds += workout.durationSeconds || 0;
    totalCaloriesBurned += workout.totalCaloriesBurned || 0;
    totalCardioDistanceKm += workout.totalCardioDistanceKm || 0;

    workout.exercises.forEach(ex => {
      totalPlannedSetsCount += ex.sets.length;
      ex.sets.forEach(s => {
        if (s.completed) {
          completedSetsCount++;
          totalSets++;
          totalVolumeKg += (s.weight || 0) * (s.reps || 0);

          if (ex.category === 'Kardiyo') {
            totalActiveSeconds += (s.durationMinutes || 0) * 60;
          } else {
            totalActiveSeconds += 45; // 45s TUT per completed weight set
          }
          if (s.rir !== undefined) {
            totalRirSum += s.rir;
            totalRirCount++;
          }
          if ((s.rir === undefined || s.rir <= 3) && !s.isWarmup) {
            totalHardSets++;
          }
        }
      });
    });
  });

  const avgRir = totalRirCount > 0 ? parseFloat((totalRirSum / totalRirCount).toFixed(1)) : 1.2;
  const avgWorkoutCompliance = totalPlannedSetsCount > 0
    ? Math.round((completedSetsCount / totalPlannedSetsCount) * 100)
    : 100;
  
  const activeWorkTimeMinutes = Math.round(totalActiveSeconds / 60);

  return {
    totalWorkouts: workouts.length,
    totalVolumeKg,
    totalSets,
    totalHardSets,
    avgWorkoutCompliance,
    activeWorkTimeMinutes,
    avgRir,
    totalTimeMinutes: Math.round(totalTimeSeconds / 60),
    streakDays: calculateStreakDays(workouts, workoutDays),
    totalCaloriesBurned: Math.round(totalCaloriesBurned),
    totalCardioDistanceKm: Math.round(totalCardioDistanceKm * 10) / 10,
  };
};

export const calculateStreakDays = (
  workouts: WorkoutSession[],
  workoutDays: number[] = [1, 2, 3, 4, 5, 6]
): number => {
  if (!workouts.length) return 0;

  const activeWorkoutDaysSet = new Set(workoutDays.length > 0 ? workoutDays : [1, 2, 3, 4, 5, 6]);

  const completedDates = new Set(
    workouts
      .filter(w => w.completed !== false)
      .map(w => w.date)
  );

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  let checkDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let streak = 0;

  for (let i = 0; i < 365; i++) {
    const year = checkDate.getFullYear();
    const month = String(checkDate.getMonth() + 1).padStart(2, '0');
    const day = String(checkDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const dayOfWeek = checkDate.getDay();

    const isScheduledWorkoutDay = activeWorkoutDaysSet.has(dayOfWeek);
    const hasWorkout = completedDates.has(dateStr);

    if (hasWorkout) {
      // Completed workout on this date -> Always counts toward streak!
      streak++;
    } else if (isScheduledWorkoutDay) {
      // Scheduled workout day, but no workout done
      if (dateStr === todayStr) {
        // Today is still ongoing
      } else {
        // Missed a past scheduled workout day -> Streak breaks here
        break;
      }
    } else {
      // Rest Day without workout -> Streak continues unbroken
    }

    checkDate.setDate(checkDate.getDate() - 1);
  }

  return streak;
};

// --- SAMPLE DATA GENERATOR FOR DEMO ---
export const generateSampleData = async (): Promise<WorkoutSession[]> => {
  const sampleWorkouts: WorkoutSession[] = [];
  const now = new Date();

  // Create logs over the last 28 days (4 weeks)
  const workoutTemplates = [
    {
      name: 'Push (İtiş Günü)',
      exercises: [
        { name: 'Barbell Bench Press', id: 'ex_chest_1', cat: 'Göğüs', eq: 'Barbell', baseW: 75, reps: [10, 8, 8, 6] },
        { name: 'Incline Dumbbell Press', id: 'ex_chest_2', cat: 'Göğüs', eq: 'Dumbbell', baseW: 26, reps: [10, 10, 8] },
        { name: 'Dumbbell Shoulder Press', id: 'ex_shoulders_2', cat: 'Omuz', eq: 'Dumbbell', baseW: 22, reps: [10, 10, 8] },
        { name: 'Tricep Rope Pushdown', id: 'ex_triceps_1', cat: 'Arka Kol', eq: 'Kablo', baseW: 30, reps: [12, 12, 10] }
      ]
    },
    {
      name: 'Pull (Çekiş Günü)',
      exercises: [
        { name: 'Barbell Deadlift', id: 'ex_back_1', cat: 'Sırt', eq: 'Barbell', baseW: 110, reps: [5, 5, 5] },
        { name: 'Lat Pulldown', id: 'ex_back_2', cat: 'Sırt', eq: 'Kablo', baseW: 60, reps: [10, 10, 8, 8] },
        { name: 'Bent-Over Barbell Row', id: 'ex_back_3', cat: 'Sırt', eq: 'Barbell', baseW: 65, reps: [10, 8, 8] },
        { name: 'Barbell Bicep Curl', id: 'ex_biceps_1', cat: 'Ön Kol', eq: 'Barbell', baseW: 30, reps: [10, 10, 10] }
      ]
    },
    {
      name: 'Legs (Bacak Günü)',
      exercises: [
        { name: 'Barbell Back Squat', id: 'ex_legs_1', cat: 'Bacak', eq: 'Barbell', baseW: 95, reps: [8, 8, 6, 6] },
        { name: 'Leg Press', id: 'ex_legs_2', cat: 'Bacak', eq: 'Makine', baseW: 160, reps: [12, 12, 10] },
        { name: 'Romanian Deadlift (RDL)', id: 'ex_legs_3', cat: 'Bacak', eq: 'Barbell', baseW: 80, reps: [10, 10, 8] },
        { name: 'Standing Calf Raise', id: 'ex_legs_7', cat: 'Bacak', eq: 'Makine', baseW: 70, reps: [15, 15, 15] }
      ]
    }
  ];

  // Past 24 days, workout every ~2 days
  for (let dayOffset = 24; dayOffset >= 1; dayOffset -= 2) {
    const dateObj = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000);
    const dateStr = dateObj.toISOString().split('T')[0];
    const templateIndex = Math.floor((24 - dayOffset) / 2) % workoutTemplates.length;
    const template = workoutTemplates[templateIndex];
    const progressFactor = 1 + (24 - dayOffset) * 0.015; // progressive overload

    let totalVolume = 0;
    let totalSetsCount = 0;

    const exercises = template.exercises.map((ex, exIdx) => {
      const sets = ex.reps.map((repCount, sIdx) => {
        const weight = Math.round(ex.baseW * progressFactor + sIdx * 2);
        totalVolume += weight * repCount;
        totalSetsCount++;
        return {
          id: `set_${dayOffset}_${exIdx}_${sIdx}`,
          setNumber: sIdx + 1,
          weight,
          reps: repCount,
          completed: true,
        };
      });

      return {
        id: `wex_${dayOffset}_${exIdx}`,
        exerciseId: ex.id,
        exerciseName: ex.name,
        category: ex.cat as any,
        equipment: ex.eq as any,
        sets,
      };
    });

    const session: WorkoutSession = {
      id: `session_sample_${dayOffset}`,
      name: template.name,
      date: dateStr,
      startTime: dateObj.getTime(),
      endTime: dateObj.getTime() + 45 * 60 * 1000,
      durationSeconds: 45 * 60 + Math.floor(Math.random() * 600),
      exercises,
      totalVolume,
      totalSets: totalSetsCount,
      completed: true,
      notes: 'Harika bir antrenmandı! İlerleme gayet iyi.',
    };

    sampleWorkouts.push(session);
  }

  await AsyncStorage.setItem(STORAGE_KEYS.WORKOUTS, JSON.stringify(sampleWorkouts));

  // Build PRs from sample data
  for (const session of sampleWorkouts) {
    await updatePRsFromWorkout(session);
  }

  return sampleWorkouts;
};

export const clearAllData = async (): Promise<void> => {
  await AsyncStorage.multiRemove([
    STORAGE_KEYS.WORKOUTS,
    STORAGE_KEYS.PRS,
    STORAGE_KEYS.ROUTINES,
    STORAGE_KEYS.EXERCISES,
    STORAGE_KEYS.ACTIVE_SESSION,
    STORAGE_KEYS.ACTIVE_REST_TIMER,
  ]);
};
