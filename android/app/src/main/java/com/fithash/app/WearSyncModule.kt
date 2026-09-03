package com.fithash.app

import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
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
    fun syncRoutinesToWatch(routinesJson: String, promise: Promise) {
        scope.launch {
            try {
                val nodeClient = Wearable.getNodeClient(reactContext)
                val messageClient = Wearable.getMessageClient(reactContext)
                val nodes = nodeClient.connectedNodes.await()

                if (nodes.isEmpty()) {
                    promise.resolve(0)
                    return@launch
                }

                val data = routinesJson.toByteArray(Charsets.UTF_8)
                var count = 0
                for (node in nodes) {
                    messageClient.sendMessage(node.id, "/fithash/sync_routines", data).await()
                    count++
                }
                promise.resolve(count)
            } catch (e: Exception) {
                promise.reject("SYNC_ERROR", e.message, e)
            }
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
