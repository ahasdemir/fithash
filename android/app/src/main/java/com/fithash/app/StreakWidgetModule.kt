package com.fithash.app

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class StreakWidgetModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "StreakWidgetModule"
    }

    @ReactMethod
    fun updateWidgetData(streakDays: Int, todayCompleted: Boolean, promise: Promise) {
        try {
            val prefs: SharedPreferences = reactContext.getSharedPreferences(
                StreakWidgetProvider.PREFS_NAME,
                Context.MODE_PRIVATE
            )
            prefs.edit()
                .putInt("streakDays", streakDays)
                .putBoolean("todayCompleted", todayCompleted)
                .apply()

            // Trigger Widget Update Broadcast
            val intent = Intent(reactContext, StreakWidgetProvider::class.java).apply {
                action = StreakWidgetProvider.ACTION_UPDATE_STREAK
            }
            reactContext.sendBroadcast(intent)

            // Also trigger AppWidgetManager update
            val appWidgetManager = AppWidgetManager.getInstance(reactContext)
            val componentName = ComponentName(reactContext, StreakWidgetProvider::class.java)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName)
            if (appWidgetIds != null && appWidgetIds.isNotEmpty()) {
                for (id in appWidgetIds) {
                    StreakWidgetProvider.updateAppWidget(reactContext, appWidgetManager, id)
                }
            }

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("WIDGET_ERROR", "Failed to update streak widget: ${e.message}", e)
        }
    }
}
