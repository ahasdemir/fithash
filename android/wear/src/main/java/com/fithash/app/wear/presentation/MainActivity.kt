package com.fithash.app.wear.presentation

import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.lifecycle.lifecycleScope
import androidx.navigation.NavHostController
import androidx.wear.ambient.AmbientLifecycleObserver
import androidx.wear.compose.navigation.SwipeDismissableNavHost
import androidx.wear.compose.navigation.composable
import androidx.wear.compose.navigation.rememberSwipeDismissableNavController
import com.fithash.app.wear.data.WearWorkoutManager
import com.fithash.app.wear.presentation.screens.*
import com.fithash.app.wear.presentation.theme.FitHashWearTheme
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    private lateinit var workoutManager: WearWorkoutManager

    private val ambientCallback = object : AmbientLifecycleObserver.AmbientLifecycleCallback {
        override fun onEnterAmbient(ambientDetails: AmbientLifecycleObserver.AmbientDetails) {
            // Keep UI low power / high contrast if needed
        }

        override fun onExitAmbient() {
            // Restore normal active UI
        }

        override fun onUpdateAmbient() {
            // Refresh ambient display
        }
    }

    private val ambientObserver = AmbientLifecycleObserver(this, ambientCallback)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        lifecycle.addObserver(ambientObserver)

        workoutManager = WearWorkoutManager.getInstance(applicationContext)

        // Observe active session to toggle FLAG_KEEP_SCREEN_ON
        lifecycleScope.launch {
            workoutManager.activeSession.collect { session ->
                if (session != null) {
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
