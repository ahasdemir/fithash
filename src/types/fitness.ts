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
  // Biomechanical & Hypertrophy Attributes (Phase 2 Spec)
  axialLoadingIndex?: 0 | 1 | 2 | 3;
  resistanceProfile?: 'LENGTHENED' | 'UNIFORM' | 'SHORTENED';
  stimulusMultiplier?: number; // 1.0 to 1.4
  decayConstantLambda?: number; // 0.04 to 0.085
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
  targetWarmupSets?: number; // Hedef Isınma Seti Sayısı
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
  weeklyHardSetsByMuscle?: Record<MuscleCategory, number>;
  todaySteps?: number;
  todayActiveCalories?: number;
}

// --- Progressive Overload & Dynamic Double Progression Types ---
export type OverloadActionType = 
  | 'MORE_WEIGHT' 
  | 'MORE_REPS' 
  | 'MAINTAIN' 
  | 'LESS_WEIGHT' 
  | 'AGGRESSIVE_MORE_WEIGHT' 
  | 'DELOAD';

export interface SetDynamicTarget {
  setNumber: number;
  targetWeight: number;
  targetReps: number;
  targetRir: number;
  previousWeight?: number;
  previousReps?: number;
  previousRir?: number;
  status: 'INCREASE_WEIGHT' | 'INCREASE_REPS' | 'MAINTAIN' | 'DELOAD' | 'REDUCE_WEIGHT';
  reason: string;
}

export interface PlateauHistory {
  exerciseId: string;
  consecutiveStagnantSessions: number;
  isStagnant: boolean;
  isDeloadRecommended: boolean;
  lastSessionE1RMs: number[];
  recommendationNote?: string;
}

// --- Mesocycle Periodization & Biomechanics (Phase 2 Spec) ---
export type MesocyclePhase =
  | 'ACCUMULATION_W1'
  | 'ACCUMULATION_W2'
  | 'ACCUMULATION_W3'
  | 'ACCUMULATION_W4'
  | 'OVERREACHING'
  | 'REACTIVE_DELOAD'
  | 'PLANNED_DELOAD';

export interface BiomechanicalProfile {
  axialLoadingIndex: 0 | 1 | 2 | 3; // 0: Pure peripheral, 1: Low axial, 2: Moderate, 3: Heavy Spinal Compression
  resistanceProfile: 'LENGTHENED' | 'UNIFORM' | 'SHORTENED';
  stimulusMultiplier: number; // 1.0 (Shortened) to 1.4 (Lengthened/Loaded stretch)
  decayConstantLambda: number; // 0.040 to 0.085
  standardRestSeconds: number; // Prescribed baseline rest (e.g. 60-180s)
}

export interface MesocycleState {
  id: string;
  name: string;
  currentPhase: MesocyclePhase;
  currentWeek: number; // 1 to 6
  targetRir: number; // 3, 2, 1, 0, or 4
  startDate: string;
  accumulatedFatigueScore?: number;
  notes?: string;
}

export interface IntraWorkoutBackOffRecommendation {
  shouldDropWeight: boolean;
  currentWeight: number;
  recommendedWeight: number;
  predictedReps: number;
  targetRepRange: [number, number];
  dropPercentage: number;
  reason: string;
}


