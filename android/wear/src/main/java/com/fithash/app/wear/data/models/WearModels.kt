package com.fithash.app.wear.data.models

data class WearRoutine(
    val id: String = "",
    val name: String = "",
    val description: String? = "",
    val category: String? = "",
    val exercises: List<WearRoutineExercise> = emptyList()
)

data class WearRoutineExercise(
    val exerciseId: String = "",
    val exerciseName: String = "",
    val category: String? = "Göğüs",
    val equipment: String? = "Barbell",
    val targetSets: Int = 3,
    val targetReps: Int = 10,
    val targetWeight: Double? = 0.0,
    val targetRir: Int? = 1,
    val targetDurationSeconds: Int? = null,
    val targetDurationMinutes: Double? = null,
    val targetDistanceKm: Double? = null,
    val targetWarmupSets: Int? = null
)

data class WearExerciseSet(
    val id: String = "",
    val setNumber: Int = 1,
    val weight: Double = 0.0,
    val reps: Int = 0,
    /** Actual RIR is optional: a routine target must never be recorded as user input. */
    val rir: Int? = null,
    val targetRir: Int? = null,
    val completed: Boolean = false,
    val isWarmup: Boolean? = null,
    val isPR: Boolean? = null,
    val durationSeconds: Int? = null,
    val durationMinutes: Double? = null,
    val distanceKm: Double? = null,
    val avgSpeedKmh: Double? = null,
    val caloriesBurned: Double? = null
)

data class WearSettings(
    val defaultRestSeconds: Int = 90,
    val autoStartRestTimer: Boolean = true,
    val defaultRir: Int = 1
)

data class WearWorkoutExercise(
    val id: String = "",
    val exerciseId: String = "",
    val exerciseName: String = "",
    val category: String = "Göğüs",
    val equipment: String = "Barbell",
    val sets: MutableList<WearExerciseSet> = mutableListOf(),
    val notes: String? = null
)

data class WearWorkoutSession(
    val id: String = "",
    val name: String = "",
    val routineId: String? = null,
    val date: String = "",
    val startTime: Long = 0L,
    var endTime: Long? = null,
    var durationSeconds: Long = 0,
    val exercises: MutableList<WearWorkoutExercise> = mutableListOf(),
    var totalVolume: Double = 0.0,
    var totalSets: Int = 0,
    var avgRir: Double? = null,
    var totalCaloriesBurned: Double? = null,
    var totalCardioDistanceKm: Double? = null,
    var totalCardioMinutes: Double? = null,
    var completed: Boolean = false,
    var notes: String? = null
)
