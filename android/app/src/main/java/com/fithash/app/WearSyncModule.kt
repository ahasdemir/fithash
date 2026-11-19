package com.fithash.app

import android.content.Context
import android.net.Uri
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import org.json.JSONObject

class WearSyncModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private val scope = CoroutineScope(Dispatchers.IO)

    override fun getName(): String = "WearSyncModule"

    companion object {
        private var reactContextRef: ReactApplicationContext? = null

        fun sendEventToJS(eventName: String, params: WritableMap?) {
            reactContextRef?.let { context ->
                if (context.hasActiveReactInstance()) {
                    context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                        .emit(eventName, params)
                }
            }
        }
    }

    init {
        reactContextRef = reactContext
    }

    @ReactMethod
    fun syncRoutinesToWatch(routinesJson: String, settingsJson: String, promise: Promise) {
        scope.launch {
            try {
                // Save natively so the background service can reply if RN is dead
                reactContext.getSharedPreferences("fithash_wear_state", Context.MODE_PRIVATE)
                    .edit()
                    .putString("routinesJson", routinesJson)
                    .putString("settingsJson", settingsJson)
                    .apply()

                val nodeClient = Wearable.getNodeClient(reactContext)
                val dataClient = Wearable.getDataClient(reactContext)
                val messageClient = Wearable.getMessageClient(reactContext)

                val request = PutDataMapRequest.create("/fithash/state/routines").apply {
                    dataMap.putString("routinesJson", routinesJson)
                    dataMap.putString("settingsJson", settingsJson)
                    dataMap.putLong("revision", System.currentTimeMillis())
                }.asPutDataRequest().setUrgent()

                dataClient.putDataItem(request).await()

                val nodes = nodeClient.connectedNodes.await()
                val data = routinesJson.toByteArray(Charsets.UTF_8)
                for (node in nodes) {
                    try {
                        messageClient.sendMessage(node.id, "/fithash/sync_routines", data).await()
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }

                promise.resolve(nodes.size)
            } catch (e: Exception) {
                promise.reject("SYNC_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun syncWorkoutsHistoryToWatch(workoutsJson: String, promise: Promise) {
        scope.launch {
            try {
                val now = System.currentTimeMillis()
                reactContext.getSharedPreferences("fithash_wear_state", Context.MODE_PRIVATE)
                    .edit()
                    .putString("workoutsJson", workoutsJson)
                    .putLong("workoutsRevision", now)
                    .apply()

                val nodeClient = Wearable.getNodeClient(reactContext)
                val dataClient = Wearable.getDataClient(reactContext)
                val messageClient = Wearable.getMessageClient(reactContext)

                val request = PutDataMapRequest.create("/fithash/state/workouts_history").apply {
                    dataMap.putString("workoutsJson", workoutsJson)
                    dataMap.putLong("revision", now)
                }.asPutDataRequest().setUrgent()

                dataClient.putDataItem(request).await()

                val nodes = nodeClient.connectedNodes.await()
                val data = workoutsJson.toByteArray(Charsets.UTF_8)
                for (node in nodes) {
                    try {
                        messageClient.sendMessage(node.id, "/fithash/sync_workouts_history", data).await()
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }

                promise.resolve(nodes.size)
            } catch (e: Exception) {
                promise.reject("SYNC_HISTORY_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun syncActiveSessionToWatch(sessionJson: String?, revision: Double, promise: Promise) {
        scope.launch {
            try {
                val revLong = if (revision > 0) revision.toLong() else System.currentTimeMillis()
                val isCleared = sessionJson.isNullOrBlank() || sessionJson == "null"

                reactContext.getSharedPreferences("fithash_wear_state", Context.MODE_PRIVATE)
                    .edit()
                    .putString("activeSessionJson", if (isCleared) "" else sessionJson)
                    .putLong("activeSessionRevision", revLong)
                    .putBoolean("activeSessionCleared", isCleared)
                    .apply()

                val nodeClient = Wearable.getNodeClient(reactContext)
                val dataClient = Wearable.getDataClient(reactContext)
                val messageClient = Wearable.getMessageClient(reactContext)

                val request = PutDataMapRequest.create("/fithash/state/active_session").apply {
                    dataMap.putString("sessionJson", if (isCleared) "" else sessionJson!!)
                    dataMap.putLong("revision", revLong)
                    dataMap.putString("origin", "phone")
                    dataMap.putBoolean("cleared", isCleared)
                }.asPutDataRequest().setUrgent()

                dataClient.putDataItem(request).await()

                val payloadJson = JSONObject().apply {
                    put("sessionJson", if (isCleared) "" else sessionJson)
                    put("revision", revLong)
                    put("origin", "phone")
                    put("cleared", isCleared)
                }.toString()

                val nodes = nodeClient.connectedNodes.await()
                val data = payloadJson.toByteArray(Charsets.UTF_8)
                for (node in nodes) {
                    try {
                        messageClient.sendMessage(node.id, "/fithash/active_session_update", data).await()
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }

                promise.resolve(nodes.size)
            } catch (e: Exception) {
                promise.reject("SYNC_ACTIVE_SESSION_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun syncRestTimerToWatch(endTimeMs: Double, totalSeconds: Int, revision: Double, promise: Promise) {
        scope.launch {
            try {
                val endMs = endTimeMs.toLong()
                val revLong = if (revision > 0) revision.toLong() else System.currentTimeMillis()
                val isCleared = endMs <= 0L || totalSeconds <= 0

                reactContext.getSharedPreferences("fithash_wear_state", Context.MODE_PRIVATE)
                    .edit()
                    .putLong("restTimerEndTimeMs", if (isCleared) 0L else endMs)
                    .putInt("restTimerTotalSeconds", if (isCleared) 0 else totalSeconds)
                    .putLong("restTimerRevision", revLong)
                    .putBoolean("restTimerCleared", isCleared)
                    .apply()

                val nodeClient = Wearable.getNodeClient(reactContext)
                val dataClient = Wearable.getDataClient(reactContext)
                val messageClient = Wearable.getMessageClient(reactContext)

                val request = PutDataMapRequest.create("/fithash/state/rest_timer").apply {
                    dataMap.putLong("endTimeMs", if (isCleared) 0L else endMs)
                    dataMap.putInt("totalSeconds", if (isCleared) 0 else totalSeconds)
                    dataMap.putLong("revision", revLong)
                    dataMap.putString("origin", "phone")
                    dataMap.putBoolean("cleared", isCleared)
                }.asPutDataRequest().setUrgent()

                dataClient.putDataItem(request).await()

                val payloadJson = JSONObject().apply {
                    put("endTimeMs", if (isCleared) 0L else endMs)
                    put("totalSeconds", if (isCleared) 0 else totalSeconds)
                    put("revision", revLong)
                    put("origin", "phone")
                    put("cleared", isCleared)
                }.toString()

                val nodes = nodeClient.connectedNodes.await()
                val data = payloadJson.toByteArray(Charsets.UTF_8)
                for (node in nodes) {
                    try {
                        messageClient.sendMessage(node.id, "/fithash/rest_timer_update", data).await()
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }

                promise.resolve(nodes.size)
            } catch (e: Exception) {
                promise.reject("SYNC_REST_TIMER_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun getPendingWearWorkouts(promise: Promise) {
        scope.launch {
            try {
                val prefs = reactContext.getSharedPreferences("fithash_wear_inbox", Context.MODE_PRIVATE)

                // Poll DataClient for any unacknowledged completed workouts from watch
                try {
                    val dataClient = Wearable.getDataClient(reactContext)
                    val uri = Uri.parse("wear://*/fithash/workouts")
                    val buffer = dataClient.getDataItems(uri, com.google.android.gms.wearable.DataClient.FILTER_PREFIX).await()
                    val editor = prefs.edit()
                    var added = false
                    buffer.forEach { item ->
                        val path = item.uri.path ?: ""
                        if (path.startsWith("/fithash/workouts/")) {
                            val json = DataMapItem.fromDataItem(item).dataMap.getString("sessionJson")
                            if (!json.isNullOrBlank()) {
                                val workoutId = try {
                                    val obj = JSONObject(json)
                                    val id = obj.optString("id")
                                    if (id.isBlank()) obj.optString("workoutId") else id
                                } catch (_: Exception) {
                                    ""
                                }
                                if (workoutId.isNotBlank() && !prefs.contains("workout_$workoutId")) {
                                    editor.putString("workout_$workoutId", json)
                                    added = true
                                }
                            }
                        }
                    }
                    buffer.release()
                    if (added) {
                        editor.apply()
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }

                val workouts = Arguments.createArray()
                prefs.all
                    .filterKeys { it.startsWith("workout_") }
                    .toSortedMap()
                    .values
                    .filterIsInstance<String>()
                    .forEach(workouts::pushString)
                promise.resolve(workouts)
            } catch (e: Exception) {
                promise.reject("WEAR_INBOX_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun acknowledgeWearWorkout(workoutId: String, promise: Promise) {
        try {
            reactContext.getSharedPreferences("fithash_wear_inbox", Context.MODE_PRIVATE)
                .edit()
                .remove("workout_$workoutId")
                .apply()

            val uri = Uri.parse("wear://*/fithash/workouts/$workoutId")
            val dataClient = Wearable.getDataClient(reactContext)
            val nodeClient = Wearable.getNodeClient(reactContext)
            val messageClient = Wearable.getMessageClient(reactContext)
            scope.launch {
                try {
                    dataClient.deleteDataItems(uri).await()
                } catch (e: Exception) {
                    e.printStackTrace()
                }
                try {
                    val nodes = nodeClient.connectedNodes.await()
                    val data = workoutId.toByteArray(Charsets.UTF_8)
                    for (node in nodes) {
                        try {
                            messageClient.sendMessage(node.id, "/fithash/workout_ack", data).await()
                        } catch (e: Exception) {
                            e.printStackTrace()
                        }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }

            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("WEAR_ACK_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getPendingActiveSessionState(promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences("fithash_wear_state", Context.MODE_PRIVATE)
            val map = Arguments.createMap().apply {
                putString("sessionJson", prefs.getString("activeSessionJson", "") ?: "")
                putDouble("revision", prefs.getLong("activeSessionRevision", 0L).toDouble())
                putBoolean("cleared", prefs.getBoolean("activeSessionCleared", true))
            }
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("WEAR_ACTIVE_SESSION_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getPendingRestTimerState(promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences("fithash_wear_state", Context.MODE_PRIVATE)
            val map = Arguments.createMap().apply {
                putDouble("endTimeMs", prefs.getLong("restTimerEndTimeMs", 0L).toDouble())
                putInt("totalSeconds", prefs.getInt("restTimerTotalSeconds", 0))
                putDouble("revision", prefs.getLong("restTimerRevision", 0L).toDouble())
                putBoolean("cleared", prefs.getBoolean("restTimerCleared", true))
            }
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("WEAR_REST_TIMER_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun addListener(eventName: String?) {}

    @ReactMethod
    fun removeListeners(count: Int?) {}
}
