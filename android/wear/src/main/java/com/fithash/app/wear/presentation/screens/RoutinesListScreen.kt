package com.fithash.app.wear.presentation.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.*
import com.fithash.app.wear.data.WearWorkoutManager
import com.fithash.app.wear.presentation.theme.*

@Composable
fun RoutinesListScreen(
    workoutManager: WearWorkoutManager,
    onRoutineSelected: () -> Unit
) {
    val routines by workoutManager.routines.collectAsState()
    val listState = rememberScalingLazyListState()

    androidx.compose.runtime.LaunchedEffect(Unit) {
        workoutManager.syncFromDataClient()
        workoutManager.requestSyncFromPhone()
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
                    text = "Rutinler",
                    color = FitHashTextPrimary,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(bottom = 4.dp)
                )
            }

            if (routines.isEmpty()) {
                item {
                    Text(
                        text = "Telefonda rutin oluşturun veya eşitleyin.",
                        color = FitHashTextSecondary,
                        fontSize = 12.sp,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                        modifier = Modifier.padding(vertical = 12.dp)
                    )
                }
            } else {
                items(routines) { routine ->
                    Chip(
                        modifier = Modifier.fillMaxWidth(),
                        onClick = {
                            workoutManager.startRoutine(routine)
                            onRoutineSelected()
                        },
                        label = {
                            Text(
                                text = routine.name,
                                maxLines = 1,
                                fontWeight = FontWeight.Bold
                            )
                        },
                        secondaryLabel = {
                            Text(text = "${routine.exercises.size} Hareket • ${routine.category}")
                        },
                        icon = {
                            Icon(
                                imageVector = Icons.Default.FitnessCenter,
                                contentDescription = null,
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

            // Sync from Phone Button
            item {
                CompactChip(
                    onClick = {
                        workoutManager.syncFromDataClient()
                        workoutManager.requestSyncFromPhone()
                    },
                    label = {
                        Text(
                            text = "🔄 Telefondan Eşitle",
                            color = FitHashPrimary,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    },
                    colors = ChipDefaults.chipColors(
                        backgroundColor = FitHashSurfaceSubtle
                    )
                )
            }
        }
    }
}
