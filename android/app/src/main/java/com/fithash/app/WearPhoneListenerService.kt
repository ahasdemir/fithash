package com.fithash.app

import android.content.Context
import com.facebook.react.bridge.Arguments
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService
import org.json.JSONObject

class WearPhoneListenerService : WearableListenerService() {

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
            WearSyncModule.sendEventToJS("onWearRequestSync", null)
        }
    }

    private fun queueWorkout(json: String) {
        val workoutId = try {
            JSONObject(json).optString("id")
        } catch (_: Exception) {
            ""
        }
        if (workoutId.isBlank()) return

        // The React bridge may be stopped. Persist first; JavaScript drains this inbox at launch.
        getSharedPreferences("fithash_wear_inbox", Context.MODE_PRIVATE)
            .edit()
            .putString("workout_$workoutId", json)
            .apply()

        val params = Arguments.createMap().apply { putString("sessionJson", json) }
        WearSyncModule.sendEventToJS("onWearWorkoutCompleted", params)
    }
}
