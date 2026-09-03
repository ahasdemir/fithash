package com.fithash.app.wear.data.models

data class WearRoutine(
    val id: String,
    val name: String,
    val description: String = "",
    val category: String = "",
    val exercises: List<WearRoutineExercise> = emptyList()
)

data class WearRoutineExercise(
    val exerciseId: String,
    val exerciseName: String,
    val category: String = "Göğüs",
    val equipment: String = "Barbell",
    val targetSets: Int = 3,
    val targetReps: Int = 10,
    val targetWeight: Double = 0.0,
    val targetRir: Int = 1
)

data class WearExerciseSet(
    val id: String,
    val setNumber: Int,
    var weight: Double,
    var reps: Int,
    var rir: Int = 1,
    var completed: Boolean = false
)

data class WearWorkoutExercise(
    val id: String,
    val exerciseId: String,
    val exerciseName: String,
    val category: String,
    val equipment: String,
    val sets: MutableList<WearExerciseSet> = mutableListOf()
)

data class WearWorkoutSession(
    val id: String,
    val name: String,
    val routineId: String? = null,
    val date: String,
    val startTime: Long,
    var endTime: Long? = null,
    var durationSeconds: Long = 0,
    val exercises: MutableList<WearWorkoutExercise> = mutableListOf(),
    var totalVolume: Double = 0.0,
    var totalSets: Int = 0,
    var completed: Boolean = false
)
