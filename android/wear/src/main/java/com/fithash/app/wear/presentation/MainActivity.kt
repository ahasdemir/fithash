package com.fithash.app.wear.presentation

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.Composable
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.navigation.NavHostController
import androidx.wear.ambient.AmbientLifecycleObserver
import androidx.wear.compose.navigation.SwipeDismissableNavHost
import androidx.wear.compose.navigation.composable
import androidx.wear.compose.navigation.rememberSwipeDismissableNavController
import com.fithash.app.wear.data.WearWorkoutManager
import com.fithash.app.wear.presentation.screens.*
import com.fithash.app.wear.presentation.theme.FitHashWearTheme
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    private lateinit var workoutManager: WearWorkoutManager

    private val ambientCallback = object : AmbientLifecycleObserver.AmbientLifecycleCallback {
        override fun onEnterAmbient(ambientDetails: AmbientLifecycleObserver.AmbientDetails) {
            if (::workoutManager.isInitialized) {
                workoutManager.refreshRestTimer()
            }
        }

        override fun onExitAmbient() {
            if (::workoutManager.isInitialized) {
                workoutManager.refreshRestTimer()
                workoutManager.syncFromDataClient()
            }
        }

        override fun onUpdateAmbient() {
            if (::workoutManager.isInitialized) {
                workoutManager.refreshRestTimer()
            }
        }
    }

    private val ambientObserver = AmbientLifecycleObserver(this, ambientCallback)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        lifecycle.addObserver(ambientObserver)

        requestNotificationPermissionIfNeeded()

        workoutManager = WearWorkoutManager.getInstance(applicationContext)

        // Observe active session or active rest timer to toggle FLAG_KEEP_SCREEN_ON
        lifecycleScope.launch {
            combine(
                workoutManager.activeSession,
                workoutManager.restTimerSeconds
            ) { session, restSecs ->
                session != null || (restSecs != null && restSecs > 0)
            }.collect { keepScreenOn ->
                if (keepScreenOn) {
                    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                } else {
                    window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                }
            }
        }

        setContent {
            FitHashWearTheme {
                val navController = rememberSwipeDismissableNavController()
                WearAppNavHost(
                    navController = navController,
                    workoutManager = workoutManager
                )
            }
        }
    }

    override fun onResume() {
        super.onResume()
        if (::workoutManager.isInitialized) {
            workoutManager.refreshRestTimer()
            workoutManager.syncFromDataClient()
        }
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
            ) {
                ActivityCompat.requestPermissions(
                    this,
                    arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                    100
                )
            }
        }
    }
}

@Composable
fun WearAppNavHost(
    navController: NavHostController,
    workoutManager: WearWorkoutManager
) {
    SwipeDismissableNavHost(
        navController = navController,
        startDestination = "home"
    ) {
        composable("home") {
            HomeScreen(
                workoutManager = workoutManager,
                onNavigateToRoutines = { navController.navigate("routines") },
                onNavigateToSavedWorkouts = { navController.navigate("saved_workouts") },
                onNavigateToActiveWorkout = { navController.navigate("active_workout") }
            )
        }

        composable("routines") {
            RoutinesListScreen(
                workoutManager = workoutManager,
                onRoutineSelected = {
                    navController.navigate("active_workout") {
                        popUpTo("home")
                    }
                }
            )
        }

        composable("saved_workouts") {
            SavedWorkoutsListScreen(
                workoutManager = workoutManager,
                onWorkoutStarted = {
                    navController.navigate("active_workout") {
                        popUpTo("home")
                    }
                }
            )
        }

        composable("active_workout") {
            ActiveWorkoutScreen(
                workoutManager = workoutManager,
                onFinishWorkout = { navController.navigate("workout_summary") }
            )
        }

        composable("workout_summary") {
            WorkoutSummaryScreen(
                workoutManager = workoutManager,
                onFinished = {
                    navController.navigate("home") {
                        popUpTo("home") { inclusive = true }
                    }
                }
            )
        }
    }
}
