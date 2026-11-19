package com.fithash.app.wear.data

import android.content.Context
import android.content.SharedPreferences
import android.net.Uri
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import com.fithash.app.wear.data.models.*
import com.fithash.app.wear.service.ActiveWorkoutService
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.*

class WearWorkoutManager private constructor(private val context: Context) {

    private val prefs: SharedPreferences = context.getSharedPreferences("fithash_wear_prefs", Context.MODE_PRIVATE)
    private val gson = Gson()
    private val scope = CoroutineScope(Dispatchers.IO)

    // Observable states
    private val _routines = MutableStateFlow<List<WearRoutine>>(emptyList())
    val routines: StateFlow<List<WearRoutine>> = _routines.asStateFlow()

    private val _savedWorkouts = MutableStateFlow<List<WearWorkoutSession>>(emptyList())
    val savedWorkouts: StateFlow<List<WearWorkoutSession>> = _savedWorkouts.asStateFlow()

    private val _settings = MutableStateFlow(WearSettings())
    val settings: StateFlow<WearSettings> = _settings.asStateFlow()

    private val _activeSession = MutableStateFlow<WearWorkoutSession?>(null)
    val activeSession: StateFlow<WearWorkoutSession?> = _activeSession.asStateFlow()

    private val _currentExerciseIndex = MutableStateFlow(0)
    val currentExerciseIndex: StateFlow<Int> = _currentExerciseIndex.asStateFlow()

    // Rest timer state (wall-clock deadline driven)
    private val _restTimerSeconds = MutableStateFlow<Int?>(null)
    val restTimerSeconds: StateFlow<Int?> = _restTimerSeconds.asStateFlow()

    private val _restTimerTotal = MutableStateFlow(90)
    val restTimerTotal: StateFlow<Int> = _restTimerTotal.asStateFlow()

    private val _restTimerEndTimeMs = MutableStateFlow<Long?>(null)
    val restTimerEndTimeMs: StateFlow<Long?> = _restTimerEndTimeMs.asStateFlow()

    private var restTimerJob: Job? = null

    @Volatile
    private var activeSessionRevision: Long = 0L

    @Volatile
    private var restTimerRevision: Long = 0L

    @Volatile
    private var routinesRevision: Long = 0L

    @Volatile
    private var workoutsHistoryRevision: Long = 0L

    init {
        activeSessionRevision = prefs.getLong("active_session_revision", 0L)
        restTimerRevision = prefs.getLong("rest_timer_revision", 0L)
        routinesRevision = prefs.getLong("routines_revision", 0L)
        workoutsHistoryRevision = prefs.getLong("workouts_history_revision", 0L)

        loadRoutines()
        loadSavedWorkouts()
        loadSettings()
        loadActiveSession()
        loadRestTimer()
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
                val list: List<WearRoutine>? = gson.fromJson(json, type)
                if (list != null) {
                    _routines.value = list
                    return
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        _routines.value = getDefaultRoutines()
    }

    private fun loadSavedWorkouts() {
        val json = prefs.getString("saved_workouts_history", null) ?: return
        try {
            val type = object : TypeToken<List<WearWorkoutSession>>() {}.type
            val list: List<WearWorkoutSession>? = gson.fromJson(json, type)
            if (list != null) {
                _savedWorkouts.value = sortAndDeduplicateWorkouts(list)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun sortAndDeduplicateWorkouts(workouts: List<WearWorkoutSession>): List<WearWorkoutSession> {
        val map = LinkedHashMap<String, WearWorkoutSession>()
        // Integrate any local pending workouts first so watch-completed sessions never disappear before phone syncs back
        getPendingLocalWorkouts().forEach { w ->
            if (w.id.isNotBlank()) {
                map[w.id] = w
            }
        }
        workouts.forEach { w ->
            if (w.id.isNotBlank()) {
                map[w.id] = w
            }
        }
        return map.values.sortedWith(
            compareByDescending<WearWorkoutSession> { it.date }
                .thenByDescending { it.startTime }
        )
    }

    fun syncFromDataClient() {
        scope.launch {
            try {
                val dataClient = Wearable.getDataClient(context)

                // 1. Routines & Settings
                val routinesBuffer = dataClient.getDataItems(Uri.parse("wear://*/fithash/state/routines")).await()
                routinesBuffer.forEach { item ->
                    if (item.uri.path == "/fithash/state/routines") {
                        val data = DataMapItem.fromDataItem(item).dataMap
                        val rev = data.getLong("revision", 0L)
                        val rJson = data.getString("routinesJson")
                        if (!rJson.isNullOrBlank()) {
                            saveSyncedRoutines(rJson, rev)
                        }
                        val sJson = data.getString("settingsJson")
                        if (!sJson.isNullOrBlank() && sJson != "null") {
                            saveSyncedSettings(sJson)
                        }
                    }
                }
                routinesBuffer.release()

                // 2. Saved Workouts History
                val historyBuffer = dataClient.getDataItems(Uri.parse("wear://*/fithash/state/workouts_history")).await()
                historyBuffer.forEach { item ->
                    if (item.uri.path == "/fithash/state/workouts_history") {
                        val data = DataMapItem.fromDataItem(item).dataMap
                        val rev = data.getLong("revision", 0L)
                        val wJson = data.getString("workoutsJson")
                        if (!wJson.isNullOrBlank()) {
                            saveSyncedWorkoutsHistory(wJson, rev)
                        }
                    }
                }
                historyBuffer.release()

                // 3. Active Session State
                val sessionBuffer = dataClient.getDataItems(Uri.parse("wear://*/fithash/state/active_session")).await()
                sessionBuffer.forEach { item ->
                    if (item.uri.path == "/fithash/state/active_session") {
                        val data = DataMapItem.fromDataItem(item).dataMap
                        val origin = data.getString("origin") ?: "phone"
                        val rev = data.getLong("revision", 0L)
                        val sJson = data.getString("sessionJson") ?: ""
                        val cleared = data.getBoolean("cleared", sJson.isBlank())
                        if (origin == "phone") {
                            applyRemoteActiveSession(sJson, rev, origin, cleared)
                        }
                    }
                }
                sessionBuffer.release()

                // 4. Active Rest Timer State
                val timerBuffer = dataClient.getDataItems(Uri.parse("wear://*/fithash/state/rest_timer")).await()
                timerBuffer.forEach { item ->
                    if (item.uri.path == "/fithash/state/rest_timer") {
                        val data = DataMapItem.fromDataItem(item).dataMap
                        val origin = data.getString("origin") ?: "phone"
                        val rev = data.getLong("revision", 0L)
                        val endTimeMs = data.getLong("endTimeMs", 0L)
                        val totalSecs = data.getInt("totalSeconds", 0)
                        val cleared = data.getBoolean("cleared", endTimeMs <= 0L)
                        if (origin == "phone") {
                            applyRemoteRestTimer(endTimeMs, totalSecs, rev, origin, cleared)
                        }
                    }
                }
                timerBuffer.release()

                // 5. Retry any pending unacknowledged completed workouts
                retryPendingCompletedWorkouts()
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    fun requestSyncFromPhone() {
        scope.launch {
            try {
                retryPendingCompletedWorkouts()
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

    fun saveSyncedRoutines(routinesJson: String, revision: Long = 0L) {
        try {
            if (revision in 1 until routinesRevision) return
            val type = object : TypeToken<List<WearRoutine>>() {}.type
            val list: List<WearRoutine> = gson.fromJson(routinesJson, type) ?: emptyList()
            _routines.value = list
            val newRev = if (revision > 0L) revision else System.currentTimeMillis()
            routinesRevision = newRev
            prefs.edit()
                .putString("saved_routines", routinesJson)
                .putLong("routines_revision", newRev)
                .apply()
        } catch (e: Exception) {
            android.util.Log.e("FitHashWear", "Error parsing synced routines", e)
            e.printStackTrace()
        }
    }

    fun saveSyncedWorkoutsHistory(workoutsJson: String, revision: Long = 0L) {
        try {
            if (revision in 1 until workoutsHistoryRevision) return
            val type = object : TypeToken<List<WearWorkoutSession>>() {}.type
            val incoming: List<WearWorkoutSession> = gson.fromJson(workoutsJson, type) ?: emptyList()
            val merged = sortAndDeduplicateWorkouts(incoming)
            _savedWorkouts.value = merged
            val newRev = if (revision > 0L) revision else System.currentTimeMillis()
            workoutsHistoryRevision = newRev
            prefs.edit()
                .putString("saved_workouts_history", gson.toJson(merged))
                .putLong("workouts_history_revision", newRev)
                .apply()
        } catch (e: Exception) {
            android.util.Log.e("FitHashWear", "Error parsing synced workouts history", e)
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
            val warmupCount = (rEx.targetWarmupSets ?: 0).coerceAtLeast(0)
            val workingCount = rEx.targetSets.coerceAtLeast(1)
            val sets = mutableListOf<WearExerciseSet>()

            for (wNum in 1..warmupCount) {
                val warmupWeight = ((rEx.targetWeight ?: 0.0) * 0.5).let { (Math.round(it / 2.5) * 2.5) }
                sets.add(
                    WearExerciseSet(
                        id = "set_w_${exIdx}_${wNum}_$now",
                        setNumber = wNum,
                        weight = warmupWeight,
                        reps = rEx.targetReps,
                        rir = null,
                        targetRir = null,
                        completed = false,
                        isWarmup = true
                    )
                )
            }

            for (setNum in 1..workingCount) {
                sets.add(
                    WearExerciseSet(
                        id = "set_${exIdx}_${setNum}_$now",
                        setNumber = setNum,
                        weight = rEx.targetWeight ?: 0.0,
                        reps = rEx.targetReps,
                        rir = null,
                        targetRir = rEx.targetRir ?: _settings.value.defaultRir,
                        completed = false,
                        isWarmup = false,
                        durationSeconds = rEx.targetDurationSeconds,
                        durationMinutes = rEx.targetDurationMinutes,
                        distanceKm = rEx.targetDistanceKm
                    )
                )
            }

            WearWorkoutExercise(
                id = "wex_${exIdx}_$now",
                exerciseId = rEx.exerciseId,
                exerciseName = rEx.exerciseName,
                category = rEx.category ?: "Göğüs",
                equipment = rEx.equipment ?: "Barbell",
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
        val rev = now
        saveActiveSession(rev)
        ActiveWorkoutService.startService(context)
        syncActiveSessionToPhone(session, rev)
    }

    fun startFromSavedWorkout(pastSession: WearWorkoutSession) {
        val now = System.currentTimeMillis()
        val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        val dateStr = dateFormat.format(Date(now))

        val exercises = pastSession.exercises.mapIndexed { exIdx, pastEx ->
            val clonedSets = pastEx.sets.mapIndexed { sIdx, s ->
                s.copy(
                    id = "set_${exIdx}_${sIdx + 1}_$now",
                    rir = null,
                    targetRir = s.rir ?: s.targetRir ?: _settings.value.defaultRir,
                    completed = false
                )
            }.toMutableList()

            pastEx.copy(
                id = "wex_${exIdx}_$now",
                sets = clonedSets
            )
        }.toMutableList()

        val baseName = pastSession.name.removeSuffix(" (Tekrar)").ifBlank { "Antrenman" }
        val session = WearWorkoutSession(
            id = "wear_session_$now",
            name = baseName,
            routineId = pastSession.routineId,
            date = dateStr,
            startTime = now,
            exercises = exercises,
            completed = false
        )

        _activeSession.value = session
        _currentExerciseIndex.value = 0
        val rev = now
        saveActiveSession(rev)
        ActiveWorkoutService.startService(context)
        syncActiveSessionToPhone(session, rev)
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
        val rev = now
        saveActiveSession(rev)
        ActiveWorkoutService.startService(context)
        syncActiveSessionToPhone(session, rev)
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
                    val nextWeight = Math.round((set.weight + delta).coerceAtLeast(0.0) * 100.0) / 100.0
                    set.copy(weight = nextWeight)
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
            val workingCount = ex.sets.count { it.isWarmup != true }
            val newNum = workingCount + 1
            val newSet = WearExerciseSet(
                id = "set_${exerciseIdx}_${newNum}_${System.currentTimeMillis()}",
                setNumber = newNum,
                weight = lastSet?.weight ?: 20.0,
                reps = lastSet?.reps ?: 10,
                rir = null,
                targetRir = lastSet?.targetRir ?: _settings.value.defaultRir,
                completed = false,
                isWarmup = false,
                durationSeconds = lastSet?.durationSeconds,
                durationMinutes = lastSet?.durationMinutes,
                distanceKm = lastSet?.distanceKm
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
        val rev = maxOf(System.currentTimeMillis(), activeSessionRevision + 1)
        _activeSession.value = session
        saveActiveSession(rev)
        syncActiveSessionToPhone(session, rev)
    }

    fun applyRemoteActiveSession(
        sessionJson: String,
        revision: Long,
        origin: String,
        cleared: Boolean
    ) {
        if (revision in 1 until activeSessionRevision) return

        val effectiveRev = if (revision > 0L) revision else System.currentTimeMillis()
        if (cleared || sessionJson.isBlank() || sessionJson == "null") {
            activeSessionRevision = effectiveRev
            _activeSession.value = null
            _currentExerciseIndex.value = 0
            prefs.edit()
                .remove("active_session")
                .putLong("active_session_revision", effectiveRev)
                .apply()
            if (_restTimerSeconds.value == null) {
                ActiveWorkoutService.stopService(context)
            }
            return
        }

        try {
            val remoteSession = gson.fromJson(sessionJson, WearWorkoutSession::class.java) ?: return
            if (remoteSession.completed) {
                activeSessionRevision = effectiveRev
                _activeSession.value = null
                _currentExerciseIndex.value = 0
                prefs.edit()
                    .remove("active_session")
                    .putLong("active_session_revision", effectiveRev)
                    .apply()
                if (_restTimerSeconds.value == null) {
                    ActiveWorkoutService.stopService(context)
                }
                return
            }

            // Preserve targetRir from existing local sets if phone payload omits targetRir
            val currentLocal = _activeSession.value
            if (currentLocal != null && currentLocal.id == remoteSession.id) {
                val localSetMap = currentLocal.exercises
                    .flatMap { it.sets }
                    .associateBy { it.id }

                remoteSession.exercises.forEach { ex ->
                    for (i in ex.sets.indices) {
                        val s = ex.sets[i]
                        val existing = localSetMap[s.id]
                        if (s.targetRir == null && existing?.targetRir != null) {
                            ex.sets[i] = s.copy(targetRir = existing.targetRir)
                        }
                    }
                }
            }

            _activeSession.value = remoteSession
            val maxIdx = (remoteSession.exercises.size - 1).coerceAtLeast(0)
            if (_currentExerciseIndex.value > maxIdx) {
                _currentExerciseIndex.value = maxIdx
            }
            saveActiveSession(effectiveRev)
            ActiveWorkoutService.startService(context)
        } catch (e: Exception) {
            android.util.Log.e("FitHashWear", "Error applying remote active session", e)
            e.printStackTrace()
        }
    }

    private fun syncActiveSessionToPhone(session: WearWorkoutSession?, revision: Long) {
        scope.launch {
            try {
                val isCleared = session == null
                val json = if (session != null) gson.toJson(session) else ""

                val dataClient = Wearable.getDataClient(context)
                val nodeClient = Wearable.getNodeClient(context)
                val messageClient = Wearable.getMessageClient(context)

                val request = PutDataMapRequest.create("/fithash/state/active_session").apply {
                    dataMap.putString("sessionJson", json)
                    dataMap.putLong("revision", revision)
                    dataMap.putString("origin", "watch")
                    dataMap.putBoolean("cleared", isCleared)
                }.asPutDataRequest().setUrgent()

                dataClient.putDataItem(request).await()

                val payloadJson = JSONObject().apply {
                    put("sessionJson", json)
                    put("revision", revision)
                    put("origin", "watch")
                    put("cleared", isCleared)
                }.toString()
                val bytes = payloadJson.toByteArray(Charsets.UTF_8)

                val nodes = nodeClient.connectedNodes.await()
                for (node in nodes) {
                    try {
                        messageClient.sendMessage(node.id, "/fithash/active_session_update", bytes).await()
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    fun setExerciseIndex(index: Int) {
        val session = _activeSession.value ?: return
        if (index in session.exercises.indices) {
            _currentExerciseIndex.value = index
        }
    }

    fun startRestTimer(seconds: Int, fromRemote: Boolean = false) {
        val total = seconds.coerceAtLeast(1)
        val endTimeMs = System.currentTimeMillis() + total * 1000L
        val rev = maxOf(System.currentTimeMillis(), restTimerRevision + 1)
        startRestTimerWithDeadline(
            endTimeMs = endTimeMs,
            totalSeconds = total,
            revision = rev,
            broadcastToPhone = !fromRemote
        )
    }

    private fun startRestTimerWithDeadline(
        endTimeMs: Long,
        totalSeconds: Int,
        revision: Long,
        broadcastToPhone: Boolean
    ) {
        restTimerJob?.cancel()
        ActiveWorkoutService.cancelRestFinishedNotification(context)

        val now = System.currentTimeMillis()
        val remaining = Math.ceil((endTimeMs - now) / 1000.0).toInt()
        if (remaining <= 0) {
            clearRestTimerInternal(revision, broadcastToPhone = broadcastToPhone)
            return
        }

        val effectiveTotal = maxOf(totalSeconds, remaining)
        restTimerRevision = revision
        _restTimerTotal.value = effectiveTotal
        _restTimerEndTimeMs.value = endTimeMs
        _restTimerSeconds.value = remaining
        saveRestTimerState(endTimeMs, effectiveTotal, revision)

        // Ensure foreground service runs so ongoing chronometer notification stays alive in ambient
        ActiveWorkoutService.startService(context)

        if (broadcastToPhone) {
            syncRestTimerToPhone(endTimeMs, effectiveTotal, revision)
        }

        restTimerJob = scope.launch {
            while (true) {
                delay(250)
                val rem = Math.ceil((endTimeMs - System.currentTimeMillis()) / 1000.0).toInt()
                if (rem <= 0) {
                    break
                }
                if (_restTimerSeconds.value != rem) {
                    _restTimerSeconds.value = rem
                }
            }
            onRestTimerExpired()
        }
    }

    private fun onRestTimerExpired() {
        val rev = maxOf(System.currentTimeMillis(), restTimerRevision + 1)
        restTimerRevision = rev
        _restTimerSeconds.value = null
        _restTimerEndTimeMs.value = null
        saveRestTimerState(0L, 0, rev)

        // Strong multi-pulse haptic feedback on the watch
        vibrateRestFinished()

        // High-priority notification with sound & vibration
        val session = _activeSession.value
        val currentEx = session?.exercises?.getOrNull(_currentExerciseIndex.value)
        ActiveWorkoutService.postRestFinishedNotification(context, currentEx?.exerciseName)
    }

    fun refreshRestTimer() {
        val endMs = _restTimerEndTimeMs.value ?: return
        val rem = Math.ceil((endMs - System.currentTimeMillis()) / 1000.0).toInt()
        if (rem <= 0) {
            restTimerJob?.cancel()
            onRestTimerExpired()
        } else {
            _restTimerSeconds.value = rem
        }
    }

    fun adjustRestTimer(deltaSeconds: Int) {
        val currentEnd = _restTimerEndTimeMs.value ?: return
        val now = System.currentTimeMillis()
        val newEnd = maxOf(now + 5_000L, currentEnd + deltaSeconds * 1000L)
        val newRemaining = Math.ceil((newEnd - now) / 1000.0).toInt()
        val newTotal = maxOf(_restTimerTotal.value + deltaSeconds, newRemaining)
        val rev = maxOf(now, restTimerRevision + 1)

        startRestTimerWithDeadline(
            endTimeMs = newEnd,
            totalSeconds = newTotal,
            revision = rev,
            broadcastToPhone = true
        )
    }

    fun cancelRestTimer(fromRemote: Boolean = false) {
        val rev = maxOf(System.currentTimeMillis(), restTimerRevision + 1)
        clearRestTimerInternal(rev, broadcastToPhone = !fromRemote)
    }

    private fun clearRestTimerInternal(revision: Long, broadcastToPhone: Boolean) {
        restTimerJob?.cancel()
        restTimerRevision = revision
        _restTimerSeconds.value = null
        _restTimerEndTimeMs.value = null
        saveRestTimerState(0L, 0, revision)
        ActiveWorkoutService.cancelRestFinishedNotification(context)

        if (broadcastToPhone) {
            syncRestTimerToPhone(0L, 0, revision)
        }
    }

    fun applyRemoteRestTimer(
        endTimeMs: Long,
        totalSeconds: Int,
        revision: Long,
        origin: String,
        cleared: Boolean
    ) {
        if (revision in 1 until restTimerRevision) return
        val effectiveRev = if (revision > 0L) revision else System.currentTimeMillis()

        if (cleared || endTimeMs <= System.currentTimeMillis() || totalSeconds <= 0) {
            clearRestTimerInternal(effectiveRev, broadcastToPhone = false)
            return
        }

        startRestTimerWithDeadline(
            endTimeMs = endTimeMs,
            totalSeconds = totalSeconds,
            revision = effectiveRev,
            broadcastToPhone = false
        )
    }

    private fun syncRestTimerToPhone(endTimeMs: Long, totalSeconds: Int, revision: Long) {
        scope.launch {
            try {
                val isCleared = endTimeMs <= 0L || totalSeconds <= 0
                val dataClient = Wearable.getDataClient(context)
                val nodeClient = Wearable.getNodeClient(context)
                val messageClient = Wearable.getMessageClient(context)

                val request = PutDataMapRequest.create("/fithash/state/rest_timer").apply {
                    dataMap.putLong("endTimeMs", if (isCleared) 0L else endTimeMs)
                    dataMap.putInt("totalSeconds", if (isCleared) 0 else totalSeconds)
                    dataMap.putLong("revision", revision)
                    dataMap.putString("origin", "watch")
                    dataMap.putBoolean("cleared", isCleared)
                }.asPutDataRequest().setUrgent()

                dataClient.putDataItem(request).await()

                val payloadJson = JSONObject().apply {
                    put("endTimeMs", if (isCleared) 0L else endTimeMs)
                    put("totalSeconds", if (isCleared) 0 else totalSeconds)
                    put("revision", revision)
                    put("origin", "watch")
                    put("cleared", isCleared)
                }.toString()
                val bytes = payloadJson.toByteArray(Charsets.UTF_8)

                val nodes = nodeClient.connectedNodes.await()
                for (node in nodes) {
                    try {
                        messageClient.sendMessage(node.id, "/fithash/rest_timer_update", bytes).await()
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    fun finishWorkout() {
        val session = _activeSession.value ?: return
        val now = System.currentTimeMillis()
        session.endTime = now
        session.durationSeconds = ((now - session.startTime) / 1000).coerceAtLeast(1)
        session.completed = true

        var volume = 0.0
        var totalSets = 0
        var rirSum = 0.0
        var rirCount = 0
        session.exercises.forEach { ex ->
            ex.sets.filter { it.completed }.forEach { set ->
                volume += set.weight * set.reps
                totalSets += 1
                if (set.rir != null && set.isWarmup != true) {
                    rirSum += set.rir
                    rirCount += 1
                }
            }
        }
        session.totalVolume = volume
        session.totalSets = totalSets
        if (rirCount > 0) {
            session.avgRir = Math.round((rirSum / rirCount) * 10.0) / 10.0
        }

        // Save locally to watch's saved workouts history immediately
        addCompletedWorkoutToLocalHistory(session)

        // Persist in pending outbox and send to phone via DataClient + MessageClient
        enqueuePendingCompletedWorkout(session)
        sendCompletedWorkoutToPhone(session)

        // Clear active session locally and notify phone
        val rev = maxOf(now, activeSessionRevision + 1)
        activeSessionRevision = rev
        _activeSession.value = null
        _currentExerciseIndex.value = 0
        prefs.edit()
            .remove("active_session")
            .putLong("active_session_revision", rev)
            .apply()
        syncActiveSessionToPhone(null, rev)

        cancelRestTimer()
        ActiveWorkoutService.stopService(context)
    }

    fun cancelWorkout() {
        val rev = maxOf(System.currentTimeMillis(), activeSessionRevision + 1)
        activeSessionRevision = rev
        _activeSession.value = null
        _currentExerciseIndex.value = 0
        prefs.edit()
            .remove("active_session")
            .putLong("active_session_revision", rev)
            .apply()
        syncActiveSessionToPhone(null, rev)

        cancelRestTimer()
        ActiveWorkoutService.stopService(context)
    }

    private fun addCompletedWorkoutToLocalHistory(session: WearWorkoutSession) {
        val updated = sortAndDeduplicateWorkouts(listOf(session) + _savedWorkouts.value)
        _savedWorkouts.value = updated
        prefs.edit().putString("saved_workouts_history", gson.toJson(updated)).apply()
    }

    private fun enqueuePendingCompletedWorkout(session: WearWorkoutSession) {
        try {
            val pendingPrefs = context.getSharedPreferences("fithash_wear_outbox", Context.MODE_PRIVATE)
            pendingPrefs.edit().putString("workout_${session.id}", gson.toJson(session)).apply()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun onWorkoutAcknowledgedByPhone(workoutId: String) {
        try {
            val pendingPrefs = context.getSharedPreferences("fithash_wear_outbox", Context.MODE_PRIVATE)
            pendingPrefs.edit().remove("workout_$workoutId").apply()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun getPendingLocalWorkouts(): List<WearWorkoutSession> {
        return try {
            val pendingPrefs = context.getSharedPreferences("fithash_wear_outbox", Context.MODE_PRIVATE)
            pendingPrefs.all
                .filterKeys { it.startsWith("workout_") }
                .values
                .filterIsInstance<String>()
                .mapNotNull { json ->
                    try {
                        gson.fromJson(json, WearWorkoutSession::class.java)
                    } catch (_: Exception) {
                        null
                    }
                }
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun retryPendingCompletedWorkouts() {
        val pending = getPendingLocalWorkouts()
        pending.forEach { session ->
            sendCompletedWorkoutToPhone(session)
        }
    }

    private fun sendCompletedWorkoutToPhone(session: WearWorkoutSession) {
        scope.launch {
            try {
                val json = gson.toJson(session)
                val dataClient = Wearable.getDataClient(context)
                val nodeClient = Wearable.getNodeClient(context)
                val messageClient = Wearable.getMessageClient(context)

                val request = PutDataMapRequest.create("/fithash/workouts/${session.id}").apply {
                    dataMap.putString("workoutId", session.id)
                    dataMap.putString("sessionJson", json)
                    dataMap.putLong("completedAt", System.currentTimeMillis())
                }.asPutDataRequest().setUrgent()
                dataClient.putDataItem(request).await()

                val bytes = json.toByteArray(Charsets.UTF_8)
                val nodes = nodeClient.connectedNodes.await()
                for (node in nodes) {
                    try {
                        messageClient.sendMessage(node.id, "/fithash/workout_completed", bytes).await()
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    private fun saveActiveSession(revision: Long) {
        activeSessionRevision = revision
        val session = _activeSession.value
        if (session != null) {
            val json = gson.toJson(session)
            prefs.edit()
                .putString("active_session", json)
                .putLong("active_session_revision", revision)
                .apply()
        } else {
            prefs.edit()
                .remove("active_session")
                .putLong("active_session_revision", revision)
                .apply()
        }
    }

    private fun loadActiveSession() {
        val json = prefs.getString("active_session", null) ?: return
        try {
            val session = gson.fromJson(json, WearWorkoutSession::class.java)
            if (session != null && !session.completed) {
                _activeSession.value = session
                ActiveWorkoutService.startService(context)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun saveRestTimerState(endTimeMs: Long, totalSeconds: Int, revision: Long) {
        prefs.edit()
            .putLong("rest_timer_end_ms", endTimeMs)
            .putInt("rest_timer_total_secs", totalSeconds)
            .putLong("rest_timer_revision", revision)
            .apply()
    }

    private fun loadRestTimer() {
        val endMs = prefs.getLong("rest_timer_end_ms", 0L)
        val totalSecs = prefs.getInt("rest_timer_total_secs", 90)
        val rev = prefs.getLong("rest_timer_revision", 0L)
        if (endMs > System.currentTimeMillis()) {
            startRestTimerWithDeadline(
                endTimeMs = endMs,
                totalSeconds = totalSecs,
                revision = rev,
                broadcastToPhone = false
            )
        } else if (endMs > 0L) {
            prefs.edit()
                .putLong("rest_timer_end_ms", 0L)
                .putInt("rest_timer_total_secs", 0)
                .apply()
        }
    }

    private fun vibrate(durationMs: Long) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vibratorManager?.defaultVibrator?.vibrate(
                    VibrationEffect.createOneShot(durationMs, VibrationEffect.DEFAULT_AMPLITUDE)
                )
            } else {
                @Suppress("DEPRECATION")
                val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                @Suppress("DEPRECATION")
                vibrator?.vibrate(
                    VibrationEffect.createOneShot(durationMs, VibrationEffect.DEFAULT_AMPLITUDE)
                )
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun vibrateRestFinished() {
        val pattern = longArrayOf(0, 500, 150, 500, 150, 600)
        val amplitudes = intArrayOf(0, 255, 0, 255, 0, 255)
        try {
            val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vibratorManager?.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            }

            if (vibrator != null) {
                if (vibrator.hasAmplitudeControl()) {
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, amplitudes, -1))
                } else {
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1))
                }
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
