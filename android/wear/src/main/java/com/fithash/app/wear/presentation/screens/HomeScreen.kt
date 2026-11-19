package com.fithash.app.wear.presentation.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.*
import com.fithash.app.wear.data.WearWorkoutManager
import com.fithash.app.wear.presentation.theme.*

@Composable
fun HomeScreen(
    workoutManager: WearWorkoutManager,
    onNavigateToRoutines: () -> Unit,
    onNavigateToSavedWorkouts: () -> Unit,
    onNavigateToActiveWorkout: () -> Unit
) {
    val activeSession by workoutManager.activeSession.collectAsState()
    val savedWorkouts by workoutManager.savedWorkouts.collectAsState()
    val routines by workoutManager.routines.collectAsState()
    val restTimerSecs by workoutManager.restTimerSeconds.collectAsState()
    val restTimerTotal by workoutManager.restTimerTotal.collectAsState()
    val listState = rememberScalingLazyListState()

    Scaffold(
        timeText = { TimeText() },
        positionIndicator = { PositionIndicator(scalingLazyListState = listState) }
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            ScalingLazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .background(FitHashBackground),
                state = listState,
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                item(key = "title") {
                    Text(
                        text = "FitHash",
                        color = FitHashPrimary,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(bottom = 4.dp)
                    )
                }

                // Active workout resume button
                if (activeSession != null) {
                    item(key = "active_session_chip") {
                        val completedSets = activeSession?.exercises?.sumOf { ex -> ex.sets.count { it.completed } } ?: 0
                        val totalSets = activeSession?.exercises?.sumOf { ex -> ex.sets.size } ?: 0
                        Chip(
                            modifier = Modifier.fillMaxWidth(),
                            onClick = onNavigateToActiveWorkout,
                            label = {
                                Text(
                                    text = "Aktif: ${activeSession?.name}",
                                    maxLines = 1,
                                    fontWeight = FontWeight.Bold
                                )
                            },
                            secondaryLabel = {
                                Text(text = "Devam Et ($completedSets/$totalSets set)")
                            },
                            icon = {
                                Icon(
                                    imageVector = Icons.Default.PlayArrow,
                                    contentDescription = "Resume",
                                    tint = FitHashBackground
                                )
                            },
                            colors = ChipDefaults.chipColors(
                                backgroundColor = FitHashPrimary,
                                contentColor = FitHashBackground
                            )
                        )
                    }
                }

                // Routines list button
                item(key = "routines_chip") {
                    Chip(
                        modifier = Modifier.fillMaxWidth(),
                        onClick = onNavigateToRoutines,
                        label = {
                            Text(
                                text = "Rutin Seç",
                                fontWeight = FontWeight.SemiBold
                            )
                        },
                        secondaryLabel = {
                            Text(text = "${routines.size} Kayıtlı Rutin")
                        },
                        icon = {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.List,
                                contentDescription = "Routines",
                                tint = FitHashPrimary
                            )
                        },
                        colors = ChipDefaults.chipColors(
                            backgroundColor = FitHashSurface,
                            contentColor = FitHashTextPrimary
                        )
                    )
                }

                // Saved Workouts / History list button
                item(key = "saved_workouts_chip") {
                    Chip(
                        modifier = Modifier.fillMaxWidth(),
                        onClick = onNavigateToSavedWorkouts,
                        label = {
                            Text(
                                text = "Kayıtlı Antrenmanlar",
                                fontWeight = FontWeight.SemiBold
                            )
                        },
                        secondaryLabel = {
                            Text(
                                text = if (savedWorkouts.isNotEmpty())
                                    "${savedWorkouts.size} Tamamlanan Antrenman"
                                else
                                    "Antrenman Geçmişi"
                            )
                        },
                        icon = {
                            Icon(
                                imageVector = Icons.Default.History,
                                contentDescription = "History",
                                tint = FitHashPrimary
                            )
                        },
                        colors = ChipDefaults.chipColors(
                            backgroundColor = FitHashSurface,
                            contentColor = FitHashTextPrimary
                        )
                    )
                }

                // Quick start freestyle button
                item(key = "freestyle_chip") {
                    Chip(
                        modifier = Modifier.fillMaxWidth(),
                        onClick = {
                            workoutManager.startFreestyle()
                            onNavigateToActiveWorkout()
                        },
                        label = {
                            Text(
                                text = "Serbest Antrenman",
                                fontWeight = FontWeight.SemiBold
                            )
                        },
                        secondaryLabel = {
                            Text(text = "Hızlı Başlat")
                        },
                        icon = {
                            Icon(
                                imageVector = Icons.Default.FitnessCenter,
                                contentDescription = "Freestyle",
                                tint = FitHashPrimary
                            )
                        },
                        colors = ChipDefaults.chipColors(
                            backgroundColor = FitHashSurface,
                            contentColor = FitHashTextPrimary
                        )
                    )
                }
            }

            if (restTimerSecs != null && restTimerSecs!! > 0) {
                RestTimerOverlay(
                    secondsLeft = restTimerSecs!!,
                    totalSeconds = restTimerTotal,
                    onAddSeconds = { workoutManager.adjustRestTimer(it) },
                    onCancel = { workoutManager.cancelRestTimer() }
                )
            }
        }
    }
}
