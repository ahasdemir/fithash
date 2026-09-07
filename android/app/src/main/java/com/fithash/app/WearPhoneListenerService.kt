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
            if (event.type != DataEvent.TYPE_CHANGED) return@forEach
            val path = event.dataItem.uri.path ?: return@forEach
            if (path.startsWith("/fithash/workouts/")) {
                val json = DataMapItem.fromDataItem(event.dataItem).dataMap.getString("sessionJson")
                if (!json.isNullOrBlank()) queueWorkout(json)
            }
        }
    }

    override fun onMessageReceived(messageEvent: MessageEvent) {
        if (messageEvent.path == "/fithash/workout_completed") {
            queueWorkout(String(messageEvent.data, Charsets.UTF_8))
        } else if (messageEvent.path == "/fithash/request_sync") {
            // Wake up JS if alive
            WearSyncModule.sendEventToJS("onWearRequestSync", null)
            
            // Instantly reply from Native cache so Watch doesn't hang if Phone app is killed
            val prefs = getSharedPreferences("fithash_wear_state", Context.MODE_PRIVATE)
            val routinesJson = prefs.getString("routinesJson", "") ?: ""
            val settingsJson = prefs.getString("settingsJson", "") ?: ""
            
            if (routinesJson.isNotBlank()) {
                scope.launch {
                    try {
                        val dataClient = Wearable.getDataClient(applicationContext)
                        val messageClient = Wearable.getMessageClient(applicationContext)

                        val request = PutDataMapRequest.create("/fithash/state/routines").apply {
                            dataMap.putString("routinesJson", routinesJson)
                            dataMap.putString("settingsJson", settingsJson)
                            dataMap.putLong("revision", System.currentTimeMillis())
                        }.asPutDataRequest().setUrgent()

                        dataClient.putDataItem(request).await()

                        // Also send via message to the specific node that requested it
                        val data = routinesJson.toByteArray(Charsets.UTF_8)
                        messageClient.sendMessage(messageEvent.sourceNodeId, "/fithash/sync_routines", data).await()
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
            }
        }
    }

    private fun queueWorkout(json: String) {
        val workoutId = try {
            JSONObject(json).optString("id")
        } catch (_: Exception) {
            ""
        }
        if (workoutId.isBlank()) return

        getSharedPreferences("fithash_wear_inbox", Context.MODE_PRIVATE)
            .edit()
            .putString("workout_$workoutId", json)
            .apply()

        val params = Arguments.createMap().apply { putString("sessionJson", json) }
        WearSyncModule.sendEventToJS("onWearWorkoutCompleted", params)
    }
}
