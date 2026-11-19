package com.fithash.app.wear.presentation.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.*
import com.fithash.app.wear.data.WearWorkoutManager
import com.fithash.app.wear.data.models.WearWorkoutSession
import com.fithash.app.wear.presentation.theme.*

@Composable
fun SavedWorkoutsListScreen(
    workoutManager: WearWorkoutManager,
    onWorkoutStarted: () -> Unit
) {
    val savedWorkouts by workoutManager.savedWorkouts.collectAsState()
    val listState = rememberScalingLazyListState()
    var selectedWorkout by remember { mutableStateOf<WearWorkoutSession?>(null) }

    LaunchedEffect(Unit) {
        workoutManager.syncFromDataClient()
        workoutManager.requestSyncFromPhone()
    }

    val detail = selectedWorkout
    if (detail != null) {
        val detailListState = rememberScalingLazyListState()
        val durationMins = (detail.durationSeconds / 60).coerceAtLeast(1)

        Scaffold(
            timeText = { TimeText() },
            positionIndicator = { PositionIndicator(scalingLazyListState = detailListState) }
        ) {
            ScalingLazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .background(FitHashBackground),
                state = detailListState,
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                item(key = "detail_title") {
                    Text(
                        text = detail.name.ifBlank { "Antrenman" },
                        color = FitHashPrimary,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center
                    )
                }

                item(key = "detail_meta") {
                    Text(
                        text = "${detail.date} • $durationMins dk • ${detail.totalVolume.toInt()} kg",
                        color = FitHashTextSecondary,
                        fontSize = 10.sp,
                        textAlign = TextAlign.Center
                    )
                }

                item(key = "detail_repeat_btn") {
                    Chip(
                        modifier = Modifier.fillMaxWidth(),
                        onClick = {
                            workoutManager.startFromSavedWorkout(detail)
                            selectedWorkout = null
                            onWorkoutStarted()
                        },
                        label = {
                            Text(
                                text = "Tekrar Başlat",
                                fontWeight = FontWeight.Bold
                            )
                        },
                        icon = {
                            Icon(
                                imageVector = Icons.Default.PlayArrow,
                                contentDescription = "Tekrar Başlat",
                                tint = FitHashBackground
                            )
                        },
                        colors = ChipDefaults.chipColors(
                            backgroundColor = FitHashPrimary,
                            contentColor = FitHashBackground
                        )
                    )
                }

                items(
                    items = detail.exercises,
                    key = { ex -> ex.id.ifBlank { "${ex.exerciseId}_${ex.exerciseName}" } }
                ) { ex ->
                    val completedSets = ex.sets.filter { it.completed }
                    val topWeight = completedSets.maxOfOrNull { it.weight } ?: ex.sets.maxOfOrNull { it.weight } ?: 0.0
                    val setsCount = if (completedSets.isNotEmpty()) completedSets.size else ex.sets.size

                    Card(
                        onClick = {},
                        modifier = Modifier.fillMaxWidth(),
                        backgroundPainter = CardDefaults.cardBackgroundPainter(
                            startBackgroundColor = FitHashSurface,
                            endBackgroundColor = FitHashSurface
                        )
                    ) {
                        Column(modifier = Modifier.padding(4.dp)) {
                            Text(
                                text = ex.exerciseName,
                                color = FitHashTextPrimary,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                maxLines = 1
                            )
                            Text(
                                text = "$setsCount Set • En yüksek: ${topWeight} kg",
                                color = FitHashTextSecondary,
                                fontSize = 10.sp
                            )
                        }
                    }
                }

                item(key = "detail_back_btn") {
                    CompactChip(
                        onClick = { selectedWorkout = null },
                        label = {
                            Text(
                                text = "← Listeye Dön",
                                color = FitHashTextPrimary,
                                fontSize = 11.sp
                            )
                        },
                        colors = ChipDefaults.chipColors(
                            backgroundColor = FitHashSurfaceSubtle
                        )
                    )
                }
            }
        }
        return
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
            item(key = "header") {
                Text(
                    text = "Kayıtlı Antrenmanlar",
                    color = FitHashTextPrimary,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(bottom = 4.dp)
                )
            }

            if (savedWorkouts.isEmpty()) {
                item(key = "empty") {
                    Text(
                        text = "Henüz kayıtlı antrenman yok. Telefonda veya saatte tamamlanan antrenmanlar burada görünür.",
                        color = FitHashTextSecondary,
                        fontSize = 11.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(vertical = 12.dp, horizontal = 8.dp)
                    )
                }
            } else {
                items(
                    items = savedWorkouts,
                    key = { w -> w.id.ifBlank { "${w.date}_${w.startTime}" } }
                ) { workout ->
                    val durationMins = (workout.durationSeconds / 60).coerceAtLeast(1)
                    Chip(
                        modifier = Modifier.fillMaxWidth(),
                        onClick = { selectedWorkout = workout },
                        label = {
                            Text(
                                text = workout.name.ifBlank { "Antrenman" },
                                maxLines = 1,
                                fontWeight = FontWeight.Bold
                            )
                        },
                        secondaryLabel = {
                            Text(
                                text = "${workout.date} • ${workout.totalSets} Set • ${workout.totalVolume.toInt()} kg ($durationMins dk)",
                                maxLines = 1
                            )
                        },
                        icon = {
                            Icon(
                                imageVector = Icons.Default.History,
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

            item(key = "sync_btn") {
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
