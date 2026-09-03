package com.fithash.app.wear.presentation.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.*
import com.fithash.app.wear.data.WearWorkoutManager
import com.fithash.app.wear.presentation.theme.*

@Composable
fun WorkoutSummaryScreen(
    workoutManager: WearWorkoutManager,
    onFinished: () -> Unit
) {
    val session by workoutManager.activeSession.collectAsState()
    val listState = rememberScalingLazyListState()

    if (session == null) {
        onFinished()
        return
    }

    val s = session!!
    val now = System.currentTimeMillis()
    val durationMins = ((now - s.startTime) / 1000 / 60).coerceAtLeast(1)

    var totalSets = 0
    var totalVolume = 0.0
    s.exercises.forEach { ex ->
        ex.sets.filter { it.completed }.forEach { set ->
            totalSets += 1
            totalVolume += set.weight * set.reps
        }
    }

    Scaffold(
        timeText = { TimeText() },
        positionIndicator = { PositionIndicator(scalingLazyListState = listState) }
    ) {
        ScalingLazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .background(FitHashBackground),
            state = listState,
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            item {
                Text(
                    text = "Tebrikler!",
                    color = FitHashPrimary,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            item {
                Text(
                    text = s.name,
                    color = FitHashTextPrimary,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    textAlign = TextAlign.Center
                )
            }

            // Stat Cards
            item {
                Card(
                    onClick = {},
                    modifier = Modifier.fillMaxWidth(),
                    backgroundPainter = CardDefaults.cardBackgroundPainter(
                        startBackgroundColor = FitHashSurface,
                        endBackgroundColor = FitHashSurface
                    )
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(4.dp),
                        horizontalArrangement = Arrangement.SpaceAround
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(text = "SÜRE", color = FitHashTextSecondary, fontSize = 9.sp)
                            Text(text = "$durationMins dk", color = FitHashTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                        }

                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(text = "HACİM", color = FitHashTextSecondary, fontSize = 9.sp)
                            Text(text = "${totalVolume.toInt()} kg", color = FitHashPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                        }

                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(text = "SET", color = FitHashTextSecondary, fontSize = 9.sp)
                            Text(text = "$totalSets", color = FitHashTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            // Save & Sync Button
            item {
                Chip(
                    modifier = Modifier.fillMaxWidth(),
                    onClick = {
                        workoutManager.finishWorkout()
                        onFinished()
                    },
                    label = { Text("Kaydet & Eşitle", fontWeight = FontWeight.Bold) },
                    icon = { Icon(Icons.Default.Check, contentDescription = "Kaydet", tint = FitHashBackground) },
                    colors = ChipDefaults.chipColors(
                        backgroundColor = FitHashPrimary,
                        contentColor = FitHashBackground
                    )
                )
            }

            // Cancel / Discard
            item {
                CompactChip(
                    onClick = {
                        workoutManager.cancelWorkout()
                        onFinished()
                    },
                    label = { Text("İptal Et", color = FitHashDanger, fontSize = 10.sp) },
                    colors = ChipDefaults.chipColors(
                        backgroundColor = FitHashSurfaceSubtle
                    )
                )
            }
        }
    }
}
