package com.fithash.app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.graphics.Color
import android.widget.RemoteViews

class StreakWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (ACTION_UPDATE_STREAK == intent.action || AppWidgetManager.ACTION_APPWIDGET_UPDATE == intent.action) {
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val componentName = ComponentName(context, StreakWidgetProvider::class.java)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName)
            if (appWidgetIds != null && appWidgetIds.isNotEmpty()) {
                for (appWidgetId in appWidgetIds) {
                    updateAppWidget(context, appWidgetManager, appWidgetId)
                }
            }
        }
    }

    companion object {
        const val ACTION_UPDATE_STREAK = "com.fithash.app.UPDATE_STREAK"
        const val PREFS_NAME = "StreakWidgetPrefs"

        fun updateAppWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int
        ) {
            val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val streakCount = prefs.getInt("streakDays", 0)
            val todayCompleted = prefs.getBoolean("todayCompleted", false)

            val views = RemoteViews(context.packageName, R.layout.streak_widget_2x2)

            // Format streak number
            views.setTextViewText(R.id.widget_streak_count, streakCount.toString())

            // Modern Ultra-Sleek Android Home Screen Theme
            if (todayCompleted) {
                // Flame glowing neon orange
                views.setInt(R.id.widget_flame_icon, "setColorFilter", Color.parseColor("#FF9500"))
                views.setFloat(R.id.widget_flame_icon, "setAlpha", 1.0f)

                // Status Pill: Completed
                views.setTextViewText(R.id.widget_status_pill, "TAMAMLANDI 🔥")
                views.setTextColor(R.id.widget_status_pill, Color.parseColor("#FF9500"))
                views.setInt(R.id.widget_status_pill, "setBackgroundResource", R.drawable.widget_pill_bg_active)

                // Subtitles & Background
                views.setTextViewText(R.id.widget_footer_text, "Harika! Bugünün hedefi tamamlandı 🎉")
                views.setTextColor(R.id.widget_footer_text, Color.parseColor("#FF9500"))
                views.setInt(R.id.widget_root, "setBackgroundResource", R.drawable.widget_background_active)
            } else {
                // Flame muted slate gray
                views.setInt(R.id.widget_flame_icon, "setColorFilter", Color.parseColor("#6B7280"))
                views.setFloat(R.id.widget_flame_icon, "setAlpha", 0.6f)

                // Status Pill: Pending
                views.setTextViewText(R.id.widget_status_pill, "BUGÜN ⚡️")
                views.setTextColor(R.id.widget_status_pill, Color.parseColor("#9CA3AF"))
                views.setInt(R.id.widget_status_pill, "setBackgroundResource", R.drawable.widget_pill_bg)

                // Subtitles & Background
                views.setTextViewText(R.id.widget_footer_text, "Seriyi korumak için 1 antrenman yap!")
                views.setTextColor(R.id.widget_footer_text, Color.parseColor("#6C7282"))
                views.setInt(R.id.widget_root, "setBackgroundResource", R.drawable.widget_background)
            }

            // Click Intent to launch app
            val intent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val pendingIntent = PendingIntent.getActivity(
                context,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
