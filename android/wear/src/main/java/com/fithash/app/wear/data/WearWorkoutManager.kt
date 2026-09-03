package com.fithash.app.wear.data

import android.content.Context
import android.content.SharedPreferences
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.os.Build
import com.fithash.app.wear.data.models.*
import com.google.android.gms.wearable.Wearable
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.text.SimpleDateFormat
import java.util.*

class WearWorkoutManager private constructor(private val context: Context) {

    private val prefs: SharedPreferences = context.getSharedPreferences("fithash_wear_prefs", Context.MODE_PRIVATE)
    private val gson = Gson()
    private val scope = CoroutineScope(Dispatchers.IO)

    // Observable states
    private val _routines = MutableStateFlow<List<WearRoutine>>(emptyList())
    val routines: StateFlow<List<WearRoutine>> = _routines.asStateFlow()

    private val _settings = MutableStateFlow(WearSettings())
    val settings: StateFlow<WearSettings> = _settings.asStateFlow()

    private val _activeSession = MutableStateFlow<WearWorkoutSession?>(null)
    val activeSession: StateFlow<WearWorkoutSession?> = _activeSession.asStateFlow()

    private val _currentExerciseIndex = MutableStateFlow(0)
    val currentExerciseIndex: StateFlow<Int> = _currentExerciseIndex.asStateFlow()

    // Rest timer state
    private val _restTimerSeconds = MutableStateFlow<Int?>(null)
    val restTimerSeconds: StateFlow<Int?> = _restTimerSeconds.asStateFlow()

    private val _restTimerTotal = MutableStateFlow(90)
    val restTimerTotal: StateFlow<Int> = _restTimerTotal.asStateFlow()

    private var restTimerJob: kotlinx.coroutines.Job? = null

    init {
        loadRoutines()
        loadSettings()
        loadActiveSession()
        syncFromDataClient()
        requestSyncFromPhone()
    }

    companion object {
        @Volatile
        private var INSTANCE: WearWorkoutManager? = null

        fun getInstance(context: Context): WearWorkoutManager {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: WearWorkoutManager(context.applicationContext).also { INSTANCE = it }
            }
        }
    }

    private fun loadRoutines() {
        val json = prefs.getString("saved_routines", null)
        if (json != null) {
            try {
                val type = object : TypeToken<List<WearRoutine>>() {}.type
                val list: List<WearRoutine> = gson.fromJson(json, type)
                if (list.isNotEmpty()) {
                    _routines.value = list
                    return
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        _routines.value = getDefaultRoutines()
    }

    fun syncFromDataClient() {
        scope.launch {
            try {
                val dataClient = Wearable.getDataClient(context)
                val uri = android.net.Uri.parse("wear://*/fithash/state/routines")
                val buffer = dataClient.getDataItems(uri).await()
                buffer.forEach { item ->
                    if (item.uri.path == "/fithash/state/routines") {
                        val data = com.google.android.gms.wearable.DataMapItem.fromDataItem(item).dataMap
                        val rJson = data.getString("routinesJson")
                        if (!rJson.isNullOrBlank()) {
                            saveSyncedRoutines(rJson)
                        }
                        val sJson = data.getString("settingsJson")
                        if (!sJson.isNullOrBlank() && sJson != "null") {
                            saveSyncedSettings(sJson)
                        }
                    }
                }
                buffer.release()
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    fun requestSyncFromPhone() {
        scope.launch {
            try {
                val nodeClient = Wearable.getNodeClient(context)
                val messageClient = Wearable.getMessageClient(context)
                val nodes = nodeClient.connectedNodes.await()
                for (node in nodes) {
                    messageClient.sendMessage(node.id, "/fithash/request_sync", ByteArray(0)).await()
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    fun saveSyncedRoutines(routinesJson: String) {
        try {
            val type = object : TypeToken<List<WearRoutine>>() {}.type
            val list: List<WearRoutine> = gson.fromJson(routinesJson, type)
            if (list.isNotEmpty()) {
                _routines.value = list
                prefs.edit().putString("saved_routines", routinesJson).apply()
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun loadSettings() {
        val json = prefs.getString("synced_settings", null) ?: return
        try {
            _settings.value = gson.fromJson(json, WearSettings::class.java) ?: WearSettings()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun saveSyncedSettings(settingsJson: String) {
        try {
            val settings = gson.fromJson(settingsJson, WearSettings::class.java) ?: WearSettings()
            _settings.value = settings
            prefs.edit().putString("synced_settings", settingsJson).apply()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun startRoutine(routine: WearRoutine) {
        val now = System.currentTimeMillis()
        val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        val dateStr = dateFormat.format(Date(now))

        val exercises = routine.exercises.mapIndexed { exIdx, rEx ->
            val sets = (1..rEx.targetSets).map { setNum ->
                WearExerciseSet(
                    id = "set_${exIdx}_${setNum}_$now",
                    setNumber = setNum,
                    weight = rEx.targetWeight,
                    reps = rEx.targetReps,
                    rir = null,
                    targetRir = rEx.targetRir,
                    completed = false
                )
            }.toMutableList()

            WearWorkoutExercise(
                id = "wex_${exIdx}_$now",
                exerciseId = rEx.exerciseId,
                exerciseName = rEx.exerciseName,
                category = rEx.category,
                equipment = rEx.equipment,
                sets = sets
            )
        }.toMutableList()

        val session = WearWorkoutSession(
            id = "wear_session_$now",
            name = routine.name,
            routineId = routine.id,
            date = dateStr,
            startTime = now,
            exercises = exercises,
            completed = false
        )

        _activeSession.value = session
        _currentExerciseIndex.value = 0
        saveActiveSession()
    }

    fun startFreestyle() {
        val now = System.currentTimeMillis()
        val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        val dateStr = dateFormat.format(Date(now))

        val defaultEx = WearWorkoutExercise(
            id = "wex_0_$now",
            exerciseId = "ex_bench_press",
            exerciseName = "Bench Press (Barbell)",
            category = "Göğüs",
            equipment = "Barbell",
            sets = mutableListOf(
                WearExerciseSet("set_0_1_$now", 1, 60.0, 10, null, _settings.value.defaultRir, false),
                WearExerciseSet("set_0_2_$now", 2, 60.0, 10, null, _settings.value.defaultRir, false),
                WearExerciseSet("set_0_3_$now", 3, 60.0, 10, null, _settings.value.defaultRir, false)
            )
        )

        val session = WearWorkoutSession(
            id = "wear_session_$now",
            name = "Serbest Antrenman",
            date = dateStr,
            startTime = now,
            exercises = mutableListOf(defaultEx),
            completed = false
        )

        _activeSession.value = session
        _currentExerciseIndex.value = 0
        saveActiveSession()
    }

    fun completeCurrentSet(exerciseIdx: Int, setIdx: Int) {
        val session = _activeSession.value ?: return
        if (exerciseIdx in session.exercises.indices) {
            val ex = session.exercises[exerciseIdx]
            if (setIdx in ex.sets.indices) {
                val isNowCompleted = !ex.sets[setIdx].completed

                // Vibrate wrist on set completion
                vibrate(100)

                updateSet(exerciseIdx, setIdx) { it.copy(completed = isNowCompleted) }

                // Start rest timer if completed
                if (isNowCompleted && _settings.value.autoStartRestTimer) {
                    startRestTimer(_settings.value.defaultRestSeconds)
                }
            }
        }
    }

    fun updateSetWeight(exerciseIdx: Int, setIdx: Int, delta: Double) {
        val session = _activeSession.value ?: return
        if (exerciseIdx in session.exercises.indices) {
            val ex = session.exercises[exerciseIdx]
            if (setIdx in ex.sets.indices) {
                updateSet(exerciseIdx, setIdx) { set ->
                    set.copy(weight = (set.weight + delta).coerceAtLeast(0.0))
                }
            }
        }
    }

    fun updateSetReps(exerciseIdx: Int, setIdx: Int, delta: Int) {
        val session = _activeSession.value ?: return
        if (exerciseIdx in session.exercises.indices) {
            val ex = session.exercises[exerciseIdx]
            if (setIdx in ex.sets.indices) {
                updateSet(exerciseIdx, setIdx) { set ->
                    set.copy(reps = (set.reps + delta).coerceAtLeast(1))
                }
            }
        }
    }

    fun addSet(exerciseIdx: Int) {
        val session = _activeSession.value ?: return
        if (exerciseIdx in session.exercises.indices) {
            val ex = session.exercises[exerciseIdx]
            val lastSet = ex.sets.lastOrNull()
            val newNum = ex.sets.size + 1
            val newSet = WearExerciseSet(
                id = "set_${exerciseIdx}_${newNum}_${System.currentTimeMillis()}",
                setNumber = newNum,
                weight = lastSet?.weight ?: 20.0,
                reps = lastSet?.reps ?: 10,
                rir = null,
                targetRir = lastSet?.targetRir ?: _settings.value.defaultRir,
                completed = false
            )
            val nextExercises = session.exercises.mapIndexed { index, exercise ->
                if (index != exerciseIdx) exercise
                else exercise.copy(sets = (exercise.sets + newSet).toMutableList())
            }.toMutableList()
            updateSession(session.copy(exercises = nextExercises))
        }
    }

    fun updateSetRir(exerciseIdx: Int, setIdx: Int, rir: Int?) {
        updateSet(exerciseIdx, setIdx) { it.copy(rir = rir) }
    }

    private fun updateSet(
        exerciseIdx: Int,
        setIdx: Int,
        transform: (WearExerciseSet) -> WearExerciseSet
    ) {
        val session = _activeSession.value ?: return
        if (exerciseIdx !in session.exercises.indices || setIdx !in session.exercises[exerciseIdx].sets.indices) return

        val nextExercises = session.exercises.mapIndexed { currentExerciseIdx, exercise ->
            if (currentExerciseIdx != exerciseIdx) exercise
            else exercise.copy(
                sets = exercise.sets.mapIndexed { currentSetIdx, set ->
                    if (currentSetIdx == setIdx) transform(set) else set
                }.toMutableList()
            )
        }.toMutableList()
        updateSession(session.copy(exercises = nextExercises))
    }

    private fun updateSession(session: WearWorkoutSession) {
        _activeSession.value = session
        saveActiveSession()
    }

    fun setExerciseIndex(index: Int) {
        val session = _activeSession.value ?: return
        if (index in session.exercises.indices) {
            _currentExerciseIndex.value = index
        }
    }

    fun startRestTimer(seconds: Int) {
        restTimerJob?.cancel()
        _restTimerTotal.value = seconds
        _restTimerSeconds.value = seconds

        restTimerJob = scope.launch {
            var remaining = seconds
            while (remaining > 0) {
                kotlinx.coroutines.delay(1000)
                remaining -= 1
                _restTimerSeconds.value = remaining
            }
            // Timer finished
            _restTimerSeconds.value = null
            // Strong finish vibration
            vibratePattern(longArrayOf(0, 400, 150, 400))
        }
    }

    fun adjustRestTimer(deltaSeconds: Int) {
        val current = _restTimerSeconds.value ?: return
        val newSecs = (current + deltaSeconds).coerceAtLeast(5)
        startRestTimer(newSecs)
    }

    fun cancelRestTimer() {
        restTimerJob?.cancel()
        _restTimerSeconds.value = null
    }

    fun finishWorkout() {
        val session = _activeSession.value ?: return
        val now = System.currentTimeMillis()
        session.endTime = now
        session.durationSeconds = (now - session.startTime) / 1000
        session.completed = true

        var volume = 0.0
        var totalSets = 0
        session.exercises.forEach { ex ->
            ex.sets.filter { it.completed }.forEach { set ->
                volume += set.weight * set.reps
                totalSets += 1
            }
        }
        session.totalVolume = volume
        session.totalSets = totalSets

        // Persist the completed workout in the data layer so it is delivered after reconnection.
        sendCompletedWorkoutToPhone(session)

        // Clear active session
        _activeSession.value = null
        prefs.edit().remove("active_session").apply()
        cancelRestTimer()
    }

    fun cancelWorkout() {
        _activeSession.value = null
        prefs.edit().remove("active_session").apply()
        cancelRestTimer()
    }

    private fun sendCompletedWorkoutToPhone(session: WearWorkoutSession) {
        scope.launch {
            try {
                val json = gson.toJson(session)
                val request = PutDataMapRequest.create("/fithash/workouts/${session.id}").apply {
                    dataMap.putString("workoutId", session.id)
                    dataMap.putString("sessionJson", json)
                    dataMap.putLong("completedAt", System.currentTimeMillis())
                }.asPutDataRequest().setUrgent()
                Wearable.getDataClient(context).putDataItem(request).await()
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    private fun saveActiveSession() {
        val session = _activeSession.value
        if (session != null) {
            val json = gson.toJson(session)
            prefs.edit().putString("active_session", json).apply()
        } else {
            prefs.edit().remove("active_session").apply()
        }
    }

    private fun loadActiveSession() {
        val json = prefs.getString("active_session", null) ?: return
        try {
            val session = gson.fromJson(json, WearWorkoutSession::class.java)
            if (session != null && !session.completed) {
                _activeSession.value = session
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun vibrate(durationMs: Long) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vibratorManager?.defaultVibrator?.vibrate(VibrationEffect.createOneShot(durationMs, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                @Suppress("DEPRECATION")
                vibrator?.vibrate(durationMs)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun vibratePattern(pattern: LongArray) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                vibrator?.vibrate(VibrationEffect.createWaveform(pattern, -1))
            } else {
                @Suppress("DEPRECATION")
                val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                @Suppress("DEPRECATION")
                vibrator?.vibrate(pattern, -1)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun getDefaultRoutines(): List<WearRoutine> {
        return listOf(
            WearRoutine(
                id = "routine_push",
                name = "Push (İtiş)",
                description = "Göğüs, Omuz ve Arka Kol",
                category = "Split",
                exercises = listOf(
                    WearRoutineExercise("ex_bench_press", "Bench Press (Barbell)", "Göğüs", "Barbell", 4, 8, 70.0, 1),
                    WearRoutineExercise("ex_incline_dumbbell_press", "Incline Dumbbell Press", "Göğüs", "Dumbbell", 3, 10, 24.0, 1),
                    WearRoutineExercise("ex_overhead_press", "Overhead Press (OHP)", "Omuz", "Barbell", 3, 8, 40.0, 1),
                    WearRoutineExercise("ex_cable_pushdown", "Triceps Rope Pushdown", "Arka Kol", "Kablo", 3, 12, 25.0, 1)
                )
            ),
            WearRoutine(
                id = "routine_pull",
                name = "Pull (Çekiş)",
                description = "Sırt ve Ön Kol",
                category = "Split",
                exercises = listOf(
                    WearRoutineExercise("ex_deadlift", "Deadlift (Klasik)", "Sırt", "Barbell", 3, 5, 100.0, 1),
                    WearRoutineExercise("ex_lat_pulldown", "Lat Pulldown (Geniş)", "Sırt", "Kablo", 4, 10, 55.0, 1),
                    WearRoutineExercise("ex_seated_cable_row", "Seated Cable Row", "Sırt", "Kablo", 3, 10, 50.0, 1),
                    WearRoutineExercise("ex_barbell_curl", "Barbell Biceps Curl", "Ön Kol", "Barbell", 3, 10, 30.0, 1)
                )
            ),
            WearRoutine(
                id = "routine_legs",
                name = "Legs (Bacak)",
                description = "Kuadriseps, Hamstring ve Kalf",
                category = "Split",
                exercises = listOf(
                    WearRoutineExercise("ex_barbell_squat", "Barbell Back Squat", "Bacak", "Barbell", 4, 8, 80.0, 1),
                    WearRoutineExercise("ex_leg_press", "Leg Press Machine", "Bacak", "Makine", 3, 10, 140.0, 1),
                    WearRoutineExercise("ex_leg_curl", "Lying Leg Curl", "Bacak", "Makine", 3, 12, 45.0, 1),
                    WearRoutineExercise("ex_standing_calf_raise", "Standing Calf Raise", "Bacak", "Makine", 4, 15, 60.0, 0)
                )
            )
        )
    }
}
