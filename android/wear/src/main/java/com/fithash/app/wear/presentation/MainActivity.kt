package com.fithash.app.wear.presentation

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.wear.compose.navigation.SwipeDismissableNavHost
import androidx.wear.compose.navigation.composable
import androidx.wear.compose.navigation.rememberSwipeDismissableNavController
import com.fithash.app.wear.data.WearWorkoutManager
import com.fithash.app.wear.presentation.screens.*
import com.fithash.app.wear.presentation.theme.FitHashWearTheme

class MainActivity : ComponentActivity() {

    private lateinit var workoutManager: WearWorkoutManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        workoutManager = WearWorkoutManager.getInstance(applicationContext)

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
