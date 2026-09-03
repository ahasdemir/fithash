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
                val nodeClient = Wearable.getNodeClient(reactContext)
                val dataClient = Wearable.getDataClient(reactContext)
                val request = PutDataMapRequest.create("/fithash/state/routines").apply {
                    dataMap.putString("routinesJson", routinesJson)
                    dataMap.putString("settingsJson", settingsJson)
                    dataMap.putLong("revision", System.currentTimeMillis())
                }.asPutDataRequest().setUrgent()

                // DataItems persist locally and are delivered when a paired watch reconnects.
                dataClient.putDataItem(request).await()
                promise.resolve(nodeClient.connectedNodes.await().size)
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
    fun addListener(eventName: String?) {
        // Required for React Native built-in EventEmitter calls
    }

    @ReactMethod
    fun removeListeners(count: Int?) {
        // Required for React Native built-in EventEmitter calls
    }
}
