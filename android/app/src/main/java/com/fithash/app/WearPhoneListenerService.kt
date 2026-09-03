package com.fithash.app

import com.facebook.react.bridge.Arguments
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService

class WearPhoneListenerService : WearableListenerService() {

    override fun onMessageReceived(messageEvent: MessageEvent) {
        if (messageEvent.path == "/fithash/workout_completed") {
            val json = String(messageEvent.data, Charsets.UTF_8)
            val params = Arguments.createMap().apply {
                putString("sessionJson", json)
            }
            WearSyncModule.sendEventToJS("onWearWorkoutCompleted", params)
        }
    }
}
