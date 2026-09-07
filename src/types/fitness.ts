export type MuscleCategory = 
  | 'Göğüs' 
  | 'Sırt' 
  | 'Bacak' 
  | 'Omuz' 
  | 'Ön Kol' 
  | 'Arka Kol' 
  | 'Karın' 
  | 'Kardiyo';

export type EquipmentType = 
  | 'Barbell' 
  | 'Dumbbell' 
  | 'Makine' 
  | 'Kablo' 
  | 'Vücut Ağırlığı' 
  | 'Kardiyo Cihazı' 
  | 'Diğer';

export interface Exercise {
  id: string;
  name: string;
  category: MuscleCategory;
  equipment: EquipmentType;
  instructions?: string;
  targetMuscle?: string;
  isCustom?: boolean;
}

export interface ExerciseSet {
  id: string;
  setNumber: number;
  weight: number; // in kg (or additional kg for bodyweight)
  reps: number;
  durationSeconds?: number; // for isometric exercises like Plank (in seconds)
  rir?: number;   // Reps In Reserve (Tükenişe kalan tekrar sayısı: 0, 1, 2, 3+)
  completed: boolean;
  isWarmup?: boolean;
  isPR?: boolean;
  // Cardio Fields
  durationMinutes?: number;
  distanceKm?: number;
  avgSpeedKmh?: number;
  caloriesBurned?: number;
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  category: MuscleCategory;
  equipment: EquipmentType;
  sets: ExerciseSet[];
  notes?: string;
}

export interface WorkoutSession {
  id: string;
  name: string;
  routineId?: string;
  date: string; // ISO date string (YYYY-MM-DD)
  startTime: number;
  endTime?: number;
  durationSeconds: number;
  exercises: WorkoutExercise[];
  totalVolume: number;
  totalSets: number;
  avgRir?: number;
  totalCaloriesBurned?: number;
  totalCardioDistanceKm?: number;
  totalCardioMinutes?: number;
  completed: boolean;
  notes?: string;
}

export interface RoutineExercise {
  exerciseId: string;
  exerciseName: string;
  category: MuscleCategory;
  equipment: EquipmentType;
  targetSets: number;
  targetReps: number;
  targetWeight?: number;
  targetRir?: number; // Hedef RIR
  targetDurationSeconds?: number; // Statik/Plank süresi (sn)
  targetDurationMinutes?: number;
  targetDistanceKm?: number;
}

export interface Routine {
  id: string;
  name: string;
  description: string;
  category: string;
  createdAt: string;
  exercises: RoutineExercise[];
}

export interface PersonalRecord {
  exerciseId: string;
  exerciseName: string;
  maxWeight: number;
  maxVolume: number;
  maxReps: number;
  maxEstimatedOneRepMax?: number;
  maxSpeedKmh?: number;
  maxDistanceKm?: number;
  maxDurationMinutes?: number;
  lastUpdatedDate?: string;
  date: string;
}

export interface HealthDataSummary {
  steps: number;
  activeCalories: number;
  totalCalories: number;
  distanceKm: number;
  lastSyncedAt: string;
}

export interface UserStats {
  totalWorkouts: number;
  totalVolumeKg: number;
  totalSets: number;
  totalHardSets: number;
  avgWorkoutCompliance: number;
  activeWorkTimeMinutes: number;
  avgRir: number;
  totalTimeMinutes: number;
  streakDays: number;
  totalCaloriesBurned: number;
  totalCardioDistanceKm: number;
  weeklyVolumeKg: number;
  weeklyWorkouts: number;
  muscleGroupDistribution: Record<MuscleCategory, number>;
  todaySteps?: number;
  todayActiveCalories?: number;
}
