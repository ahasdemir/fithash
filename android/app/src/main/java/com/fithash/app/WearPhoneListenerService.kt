package com.fithash.app

import android.content.Context
import com.facebook.react.bridge.Arguments
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import com.google.android.gms.wearable.WearableListenerService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import org.json.JSONObject

class WearPhoneListenerService : WearableListenerService() {

    private val scope = CoroutineScope(Dispatchers.IO)

    override fun onDataChanged(dataEvents: DataEventBuffer) {
        dataEvents.forEach { event ->
            val path = event.dataItem.uri.path ?: return@forEach
            if (event.type == DataEvent.TYPE_DELETED) {
                if (path == "/fithash/state/active_session") {
                    handleIncomingActiveSession("", System.currentTimeMillis(), "watch", true)
                } else if (path == "/fithash/state/rest_timer") {
                    handleIncomingRestTimer(0L, 0, System.currentTimeMillis(), "watch", true)
                }
                return@forEach
            }
            if (event.type != DataEvent.TYPE_CHANGED) return@forEach

            if (path.startsWith("/fithash/workouts/")) {
                val json = DataMapItem.fromDataItem(event.dataItem).dataMap.getString("sessionJson")
                if (!json.isNullOrBlank()) queueWorkout(json)
            } else if (path == "/fithash/state/active_session") {
                val dataMap = DataMapItem.fromDataItem(event.dataItem).dataMap
                val origin = dataMap.getString("origin") ?: "watch"
                if (origin == "watch") {
                    val sessionJson = dataMap.getString("sessionJson") ?: ""
                    val revision = dataMap.getLong("revision", System.currentTimeMillis())
                    val cleared = dataMap.getBoolean("cleared", sessionJson.isBlank())
                    handleIncomingActiveSession(sessionJson, revision, origin, cleared)
                }
            } else if (path == "/fithash/state/rest_timer") {
                val dataMap = DataMapItem.fromDataItem(event.dataItem).dataMap
                val origin = dataMap.getString("origin") ?: "watch"
                if (origin == "watch") {
                    val endTimeMs = dataMap.getLong("endTimeMs", 0L)
                    val totalSeconds = dataMap.getInt("totalSeconds", 0)
                    val revision = dataMap.getLong("revision", System.currentTimeMillis())
                    val cleared = dataMap.getBoolean("cleared", endTimeMs <= 0L)
                    handleIncomingRestTimer(endTimeMs, totalSeconds, revision, origin, cleared)
                }
            }
        }
    }

    override fun onMessageReceived(messageEvent: MessageEvent) {
        when (messageEvent.path) {
            "/fithash/workout_completed" -> {
                queueWorkout(String(messageEvent.data, Charsets.UTF_8))
            }
            "/fithash/active_session_update" -> {
                try {
                    val obj = JSONObject(String(messageEvent.data, Charsets.UTF_8))
                    val origin = obj.optString("origin", "watch")
                    if (origin == "watch") {
                        val sessionJson = obj.optString("sessionJson", "")
                        val revision = obj.optLong("revision", System.currentTimeMillis())
                        val cleared = obj.optBoolean("cleared", sessionJson.isBlank())
                        handleIncomingActiveSession(sessionJson, revision, origin, cleared)
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
            "/fithash/rest_timer_update" -> {
                try {
                    val obj = JSONObject(String(messageEvent.data, Charsets.UTF_8))
                    val origin = obj.optString("origin", "watch")
                    if (origin == "watch") {
                        val endTimeMs = obj.optLong("endTimeMs", 0L)
                        val totalSeconds = obj.optInt("totalSeconds", 0)
                        val revision = obj.optLong("revision", System.currentTimeMillis())
                        val cleared = obj.optBoolean("cleared", endTimeMs <= 0L)
                        handleIncomingRestTimer(endTimeMs, totalSeconds, revision, origin, cleared)
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
            "/fithash/request_sync" -> {
                // Wake up JS if alive
                WearSyncModule.sendEventToJS("onWearRequestSync", null)

                // Instantly reply from Native cache so Watch doesn't hang if Phone app is killed
                val prefs = getSharedPreferences("fithash_wear_state", Context.MODE_PRIVATE)
                val routinesJson = prefs.getString("routinesJson", "") ?: ""
                val settingsJson = prefs.getString("settingsJson", "") ?: ""
                val workoutsJson = prefs.getString("workoutsJson", "") ?: ""
                val activeSessionJson = prefs.getString("activeSessionJson", "") ?: ""
                val activeSessionRev = prefs.getLong("activeSessionRevision", 0L)
                val activeSessionCleared = prefs.getBoolean("activeSessionCleared", true)
                val restTimerEndMs = prefs.getLong("restTimerEndTimeMs", 0L)
                val restTimerTotalSecs = prefs.getInt("restTimerTotalSeconds", 0)
                val restTimerRev = prefs.getLong("restTimerRevision", 0L)
                val restTimerCleared = prefs.getBoolean("restTimerCleared", true)

                scope.launch {
                    try {
                        val dataClient = Wearable.getDataClient(applicationContext)
                        val messageClient = Wearable.getMessageClient(applicationContext)

                        if (routinesJson.isNotBlank()) {
                            val request = PutDataMapRequest.create("/fithash/state/routines").apply {
                                dataMap.putString("routinesJson", routinesJson)
                                dataMap.putString("settingsJson", settingsJson)
                                dataMap.putLong("revision", System.currentTimeMillis())
                            }.asPutDataRequest().setUrgent()

                            dataClient.putDataItem(request).await()

                            val data = routinesJson.toByteArray(Charsets.UTF_8)
                            messageClient.sendMessage(messageEvent.sourceNodeId, "/fithash/sync_routines", data).await()
                        }

                        if (workoutsJson.isNotBlank()) {
                            val request = PutDataMapRequest.create("/fithash/state/workouts_history").apply {
                                dataMap.putString("workoutsJson", workoutsJson)
                                dataMap.putLong("revision", System.currentTimeMillis())
                            }.asPutDataRequest().setUrgent()

                            dataClient.putDataItem(request).await()

                            val data = workoutsJson.toByteArray(Charsets.UTF_8)
                            messageClient.sendMessage(messageEvent.sourceNodeId, "/fithash/sync_workouts_history", data).await()
                        }

                        if (activeSessionRev > 0L && (!activeSessionCleared && activeSessionJson.isNotBlank())) {
                            val payload = JSONObject().apply {
                                put("sessionJson", activeSessionJson)
                                put("revision", activeSessionRev)
                                put("origin", "phone")
                                put("cleared", false)
                            }.toString()
                            messageClient.sendMessage(
                                messageEvent.sourceNodeId,
                                "/fithash/active_session_update",
                                payload.toByteArray(Charsets.UTF_8)
                            ).await()
                        }

                        if (restTimerRev > 0L && !restTimerCleared && restTimerEndMs > System.currentTimeMillis()) {
                            val payload = JSONObject().apply {
                                put("endTimeMs", restTimerEndMs)
                                put("totalSeconds", restTimerTotalSecs)
                                put("revision", restTimerRev)
                                put("origin", "phone")
                                put("cleared", false)
                            }.toString()
                            messageClient.sendMessage(
                                messageEvent.sourceNodeId,
                                "/fithash/rest_timer_update",
                                payload.toByteArray(Charsets.UTF_8)
                            ).await()
                        }
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
            }
        }
    }

    private fun handleIncomingActiveSession(
        sessionJson: String,
        revision: Long,
        origin: String,
        cleared: Boolean
    ) {
        val prefs = getSharedPreferences("fithash_wear_state", Context.MODE_PRIVATE)
        val currentRev = prefs.getLong("activeSessionRevision", 0L)
        if (revision < currentRev) return

        prefs.edit()
            .putString("activeSessionJson", if (cleared) "" else sessionJson)
            .putLong("activeSessionRevision", revision)
            .putBoolean("activeSessionCleared", cleared)
            .apply()

        val params = Arguments.createMap().apply {
            putString("sessionJson", if (cleared) "" else sessionJson)
            putDouble("revision", revision.toDouble())
            putString("origin", origin)
            putBoolean("cleared", cleared)
        }
        WearSyncModule.sendEventToJS("onWearActiveSessionUpdated", params)
    }

    private fun handleIncomingRestTimer(
        endTimeMs: Long,
        totalSeconds: Int,
        revision: Long,
        origin: String,
        cleared: Boolean
    ) {
        val prefs = getSharedPreferences("fithash_wear_state", Context.MODE_PRIVATE)
        val currentRev = prefs.getLong("restTimerRevision", 0L)
        if (revision < currentRev) return

        prefs.edit()
            .putLong("restTimerEndTimeMs", if (cleared) 0L else endTimeMs)
            .putInt("restTimerTotalSeconds", if (cleared) 0 else totalSeconds)
            .putLong("restTimerRevision", revision)
            .putBoolean("restTimerCleared", cleared)
            .apply()

        val params = Arguments.createMap().apply {
            putDouble("endTimeMs", (if (cleared) 0L else endTimeMs).toDouble())
            putInt("totalSeconds", if (cleared) 0 else totalSeconds)
            putDouble("revision", revision.toDouble())
            putString("origin", origin)
            putBoolean("cleared", cleared)
        }
        WearSyncModule.sendEventToJS("onWearRestTimerUpdated", params)
    }

    private fun queueWorkout(json: String) {
        val workoutId = try {
            val jsonObject = JSONObject(json)
            val id = jsonObject.optString("id")
            if (id.isBlank()) jsonObject.optString("workoutId") else id
        } catch (_: Exception) {
            ""
        }
        if (workoutId.isBlank()) return

        try {
            getSharedPreferences("fithash_wear_inbox", Context.MODE_PRIVATE)
                .edit()
                .putString("workout_$workoutId", json)
                .apply()

            val params = Arguments.createMap().apply { putString("sessionJson", json) }
            WearSyncModule.sendEventToJS("onWearWorkoutCompleted", params)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
