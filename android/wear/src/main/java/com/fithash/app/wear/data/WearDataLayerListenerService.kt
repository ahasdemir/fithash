package com.fithash.app.wear.data

import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService
import org.json.JSONObject

class WearDataLayerListenerService : WearableListenerService() {

    override fun onDataChanged(dataEvents: DataEventBuffer) {
        val manager = WearWorkoutManager.getInstance(applicationContext)
        dataEvents.forEach { event ->
            val item = event.dataItem
            val path = item.uri.path ?: return@forEach

            if (event.type == DataEvent.TYPE_DELETED) {
                if (path == "/fithash/state/active_session") {
                    manager.applyRemoteActiveSession("", System.currentTimeMillis(), "phone", true)
                } else if (path == "/fithash/state/rest_timer") {
                    manager.applyRemoteRestTimer(0L, 0, System.currentTimeMillis(), "phone", true)
                }
                return@forEach
            }

            if (event.type != DataEvent.TYPE_CHANGED) return@forEach

            val data = DataMapItem.fromDataItem(item).dataMap
            when (path) {
                "/fithash/state/routines" -> {
                    val rev = data.getLong("revision", 0L)
                    manager.saveSyncedRoutines(data.getString("routinesJson") ?: "[]", rev)
                    data.getString("settingsJson")?.takeUnless { it == "null" }?.let(manager::saveSyncedSettings)
                }
                "/fithash/state/workouts_history" -> {
                    val rev = data.getLong("revision", 0L)
                    manager.saveSyncedWorkoutsHistory(data.getString("workoutsJson") ?: "[]", rev)
                }
                "/fithash/state/active_session" -> {
                    val origin = data.getString("origin") ?: "phone"
                    if (origin == "phone") {
                        val sessionJson = data.getString("sessionJson") ?: ""
                        val rev = data.getLong("revision", System.currentTimeMillis())
                        val cleared = data.getBoolean("cleared", sessionJson.isBlank())
                        manager.applyRemoteActiveSession(sessionJson, rev, origin, cleared)
                    }
                }
                "/fithash/state/rest_timer" -> {
                    val origin = data.getString("origin") ?: "phone"
                    if (origin == "phone") {
                        val endTimeMs = data.getLong("endTimeMs", 0L)
                        val totalSeconds = data.getInt("totalSeconds", 0)
                        val rev = data.getLong("revision", System.currentTimeMillis())
                        val cleared = data.getBoolean("cleared", endTimeMs <= 0L)
                        manager.applyRemoteRestTimer(endTimeMs, totalSeconds, rev, origin, cleared)
                    }
                }
            }
        }
    }

    override fun onMessageReceived(messageEvent: MessageEvent) {
        val manager = WearWorkoutManager.getInstance(applicationContext)
        when (messageEvent.path) {
            "/fithash/sync_routines" -> {
                val json = String(messageEvent.data, Charsets.UTF_8)
                manager.saveSyncedRoutines(json)
            }
            "/fithash/sync_workouts_history" -> {
                val json = String(messageEvent.data, Charsets.UTF_8)
                manager.saveSyncedWorkoutsHistory(json)
            }
            "/fithash/active_session_update" -> {
                try {
                    val obj = JSONObject(String(messageEvent.data, Charsets.UTF_8))
                    val origin = obj.optString("origin", "phone")
                    if (origin == "phone") {
                        val sessionJson = obj.optString("sessionJson", "")
                        val revision = obj.optLong("revision", System.currentTimeMillis())
                        val cleared = obj.optBoolean("cleared", sessionJson.isBlank())
                        manager.applyRemoteActiveSession(sessionJson, revision, origin, cleared)
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
            "/fithash/rest_timer_update" -> {
                try {
                    val obj = JSONObject(String(messageEvent.data, Charsets.UTF_8))
                    val origin = obj.optString("origin", "phone")
                    if (origin == "phone") {
                        val endTimeMs = obj.optLong("endTimeMs", 0L)
                        val totalSeconds = obj.optInt("totalSeconds", 0)
                        val revision = obj.optLong("revision", System.currentTimeMillis())
                        val cleared = obj.optBoolean("cleared", endTimeMs <= 0L)
                        manager.applyRemoteRestTimer(endTimeMs, totalSeconds, revision, origin, cleared)
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
            "/fithash/workout_ack" -> {
                val workoutId = String(messageEvent.data, Charsets.UTF_8)
                if (workoutId.isNotBlank()) {
                    manager.onWorkoutAcknowledgedByPhone(workoutId)
                }
            }
        }
    }
}
