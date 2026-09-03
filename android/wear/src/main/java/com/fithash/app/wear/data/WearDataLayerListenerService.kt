package com.fithash.app.wear.data

import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService

class WearDataLayerListenerService : WearableListenerService() {

    override fun onMessageReceived(messageEvent: MessageEvent) {
        if (messageEvent.path == "/fithash/sync_routines") {
            val json = String(messageEvent.data, Charsets.UTF_8)
            WearWorkoutManager.getInstance(applicationContext).saveSyncedRoutines(json)
        }
    }
}
