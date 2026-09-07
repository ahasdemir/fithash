package com.fithash.app

import android.content.Context
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

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
    fun getPendingWearWorkouts(promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences("fithash_wear_inbox", Context.MODE_PRIVATE)
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

    @ReactMethod
    fun acknowledgeWearWorkout(workoutId: String, promise: Promise) {
        try {
            reactContext.getSharedPreferences("fithash_wear_inbox", Context.MODE_PRIVATE)
                .edit()
                .remove("workout_$workoutId")
                .apply()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("WEAR_ACK_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun addListener(eventName: String?) {}

    @ReactMethod
    fun removeListeners(count: Int?) {}
}
