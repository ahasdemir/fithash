package com.fithash.app.wear.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.fithash.app.wear.data.WearWorkoutManager
import com.fithash.app.wear.presentation.MainActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch

class ActiveWorkoutService : Service() {

    private val serviceScope = CoroutineScope(Dispatchers.Main + Job())
    private var observeJob: Job? = null

    companion object {
        const val CHANNEL_ID = "active_workout_channel"
        const val REST_ALERT_CHANNEL_ID = "rest_timer_alert_channel"
        const val NOTIFICATION_ID = 1001
        const val REST_COMPLETE_NOTIFICATION_ID = 1002

        const val ACTION_START = "com.fithash.app.wear.action.START_ACTIVE_WORKOUT"
        const val ACTION_STOP = "com.fithash.app.wear.action.STOP_ACTIVE_WORKOUT"
        const val ACTION_SKIP_REST = "com.fithash.app.wear.action.SKIP_REST"
        const val ACTION_ADD_REST_15 = "com.fithash.app.wear.action.ADD_REST_15"

        fun startService(context: Context) {
            val intent = Intent(context, ActiveWorkoutService::class.java).apply {
                action = ACTION_START
            }
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        fun stopService(context: Context) {
            val intent = Intent(context, ActiveWorkoutService::class.java).apply {
                action = ACTION_STOP
            }
            try {
                context.startService(intent)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        fun ensureChannels(context: Context) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

                val activeChannel = NotificationChannel(
                    CHANNEL_ID,
                    "Aktif Antrenman",
                    NotificationManager.IMPORTANCE_LOW
                ).apply {
                    description = "Aktif antrenman ve dinlenme sayacı bildirimi"
                    setShowBadge(false)
                }
                notificationManager.createNotificationChannel(activeChannel)

                val alertChannel = NotificationChannel(
                    REST_ALERT_CHANNEL_ID,
                    "Dinlenme Süresi Bildirimleri",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Dinlenme süresi dolduğunda ses ve titreşim uyarısı"
                    enableVibration(true)
                    vibrationPattern = longArrayOf(0, 500, 150, 500, 150, 500)
                    setShowBadge(true)
                    val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                    if (soundUri != null) {
                        val audioAttributes = AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build()
                        setSound(soundUri, audioAttributes)
                    }
                }
                notificationManager.createNotificationChannel(alertChannel)
            }
        }

        fun postRestFinishedNotification(context: Context, nextExerciseName: String?) {
            try {
                ensureChannels(context)
                val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

                val launchIntent = Intent(context, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                }
                val pendingIntent = PendingIntent.getActivity(
                    context,
                    1,
                    launchIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )

                val body = if (!nextExerciseName.isNullOrBlank()) {
                    "Sıradaki set: $nextExerciseName"
                } else {
                    "Dinlenme süresi tamamlandı. Sıradaki sete hazırsın!"
                }

                val builder = NotificationCompat.Builder(context, REST_ALERT_CHANNEL_ID)
                    .setContentTitle("⏰ Dinlenme Süresi Doldu!")
                    .setContentText(body)
                    .setSmallIcon(com.fithash.app.wear.R.drawable.ic_launcher)
                    .setContentIntent(pendingIntent)
                    .setAutoCancel(true)
                    .setPriority(NotificationCompat.PRIORITY_MAX)
                    .setCategory(NotificationCompat.CATEGORY_ALARM)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                    .setDefaults(NotificationCompat.DEFAULT_ALL)
                    .setVibrate(longArrayOf(0, 500, 150, 500, 150, 500))
                    .setTimeoutAfter(15_000L)

                notificationManager.notify(REST_COMPLETE_NOTIFICATION_ID, builder.build())
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        fun cancelRestFinishedNotification(context: Context) {
            try {
                val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                notificationManager.cancel(REST_COMPLETE_NOTIFICATION_ID)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        ensureChannels(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_SKIP_REST -> {
                WearWorkoutManager.getInstance(applicationContext).cancelRestTimer(fromRemote = false)
                return START_STICKY
            }
            ACTION_ADD_REST_15 -> {
                WearWorkoutManager.getInstance(applicationContext).adjustRestTimer(15)
                return START_STICKY
            }
        }

        val initialNotification = buildNotification(
            title = "FitHash Antrenman",
            content = "Antrenman aktif",
            restSecs = null,
            restTotal = 0,
            restEndMs = null,
            sessionStartTimeMs = null
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                initialNotification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH or ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
            )
        } else {
            startForeground(NOTIFICATION_ID, initialNotification)
        }

        observeWorkoutState()

        return START_STICKY
    }

    private fun observeWorkoutState() {
        observeJob?.cancel()
        val workoutManager = WearWorkoutManager.getInstance(applicationContext)

        observeJob = serviceScope.launch {
            combine(
                workoutManager.activeSession,
                workoutManager.restTimerSeconds,
                workoutManager.restTimerTotal,
                workoutManager.restTimerEndTimeMs,
                workoutManager.currentExerciseIndex
            ) { session, restSecs, restTotal, restEndMs, exIdx ->
                WorkoutNotifState(session, restSecs, restTotal, restEndMs, exIdx)
            }.collect { state ->
                val session = state.session
                val restSecs = state.restSecs
                val isRestActive = restSecs != null && restSecs > 0

                if (session == null && !isRestActive) {
                    stopForeground(STOP_FOREGROUND_REMOVE)
                    stopSelf()
                    return@collect
                }

                val title = session?.name?.ifBlank { "Serbest Antrenman" } ?: "Dinlenme Sayacı"
                val content = if (isRestActive) {
                    val m = (restSecs ?: 0) / 60
                    val s = (restSecs ?: 0) % 60
                    "Dinlenme: %02d:%02d".format(m, s)
                } else {
                    val currentEx = session?.exercises?.getOrNull(state.exIdx)
                    val completedCount = session?.exercises?.sumOf { ex -> ex.sets.count { it.completed } } ?: 0
                    val totalCount = session?.exercises?.sumOf { ex -> ex.sets.size } ?: 0
                    if (currentEx != null) {
                        "${currentEx.exerciseName} ($completedCount/$totalCount set)"
                    } else {
                        "Antrenman devam ediyor"
                    }
                }

                updateNotification(
                    title = title,
                    content = content,
                    restSecs = restSecs,
                    restTotal = state.restTotal,
                    restEndMs = state.restEndMs,
                    sessionStartTimeMs = session?.startTime
                )
            }
        }
    }

    private data class WorkoutNotifState(
        val session: com.fithash.app.wear.data.models.WearWorkoutSession?,
        val restSecs: Int?,
        val restTotal: Int,
        val restEndMs: Long?,
        val exIdx: Int
    )

    private fun updateNotification(
        title: String,
        content: String,
        restSecs: Int?,
        restTotal: Int,
        restEndMs: Long?,
        sessionStartTimeMs: Long?
    ) {
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(
            NOTIFICATION_ID,
            buildNotification(title, content, restSecs, restTotal, restEndMs, sessionStartTimeMs)
        )
    }

    private fun buildNotification(
        title: String,
        content: String,
        restSecs: Int?,
        restTotal: Int,
        restEndMs: Long?,
        sessionStartTimeMs: Long?
    ): Notification {
        val launchIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val isRestActive = restSecs != null && restSecs > 0

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(content)
            .setSmallIcon(com.fithash.app.wear.R.drawable.ic_launcher)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_WORKOUT)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)

        if (isRestActive && restEndMs != null && restEndMs > System.currentTimeMillis()) {
            builder
                .setUsesChronometer(true)
                .setChronometerCountDown(true)
                .setWhen(restEndMs)
                .setShowWhen(true)
                .setProgress(restTotal.coerceAtLeast(1), restSecs ?: 0, false)

            val skipIntent = Intent(this, ActiveWorkoutService::class.java).apply {
                action = ACTION_SKIP_REST
            }
            val skipPending = PendingIntent.getService(
                this,
                2,
                skipIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val add15Intent = Intent(this, ActiveWorkoutService::class.java).apply {
                action = ACTION_ADD_REST_15
            }
            val add15Pending = PendingIntent.getService(
                this,
                3,
                add15Intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            builder.addAction(
                NotificationCompat.Action.Builder(0, "+15 sn", add15Pending).build()
            )
            builder.addAction(
                NotificationCompat.Action.Builder(0, "Atla", skipPending).build()
            )
        } else if (sessionStartTimeMs != null && sessionStartTimeMs > 0L) {
            builder
                .setUsesChronometer(true)
                .setChronometerCountDown(false)
                .setWhen(sessionStartTimeMs)
                .setShowWhen(true)
                .setProgress(0, 0, false)
        }

        return builder.build()
    }

    override fun onDestroy() {
        super.onDestroy()
        observeJob?.cancel()
        serviceScope.cancel()
    }
}
