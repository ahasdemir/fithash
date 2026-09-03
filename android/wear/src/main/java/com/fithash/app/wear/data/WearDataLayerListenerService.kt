package com.fithash.app.wear.data

import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService

class WearDataLayerListenerService : WearableListenerService() {

    override fun onDataChanged(dataEvents: DataEventBuffer) {
        dataEvents.forEach { event ->
            val item = event.dataItem
            if (item.uri.path == "/fithash/state/routines") {
                val data = DataMapItem.fromDataItem(item).dataMap
                val manager = WearWorkoutManager.getInstance(applicationContext)
                manager.saveSyncedRoutines(data.getString("routinesJson") ?: "[]")
                data.getString("settingsJson")?.takeUnless { it == "null" }?.let(manager::saveSyncedSettings)
            }
        }
    }

    override fun onMessageReceived(messageEvent: MessageEvent) {
        // Kept for users running an older phone build during an app update.
        if (messageEvent.path == "/fithash/sync_routines") {
            val json = String(messageEvent.data, Charsets.UTF_8)
            WearWorkoutManager.getInstance(applicationContext).saveSyncedRoutines(json)
        }
    }
}
