package com.fithash.app.wear.presentation.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.itemsIndexed
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.*
import com.fithash.app.wear.data.WearWorkoutManager
import com.fithash.app.wear.presentation.theme.*

@Composable
fun ActiveWorkoutScreen(
    workoutManager: WearWorkoutManager,
    onFinishWorkout: () -> Unit
) {
    val session by workoutManager.activeSession.collectAsState()
    val currentExIdx by workoutManager.currentExerciseIndex.collectAsState()
    val restTimerSecs by workoutManager.restTimerSeconds.collectAsState()
    val restTimerTotal by workoutManager.restTimerTotal.collectAsState()

    val listState = rememberScalingLazyListState()
    var rirPromptSetIdx by remember { mutableStateOf<Int?>(null) }

    if (session == null || session!!.exercises.isEmpty()) {
        Box(
            modifier = Modifier.fillMaxSize().background(FitHashBackground),
            contentAlignment = Alignment.Center
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text("Aktif antrenman yok", color = FitHashTextSecondary, fontSize = 12.sp)
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
        return
    }

    val currentSession = session!!
    val safeExIdx = currentExIdx.coerceIn(0, currentSession.exercises.size - 1)
    val currentExercise = currentSession.exercises[safeExIdx]

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
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Exercise Navigation Header
                item(key = "nav_header") {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        CompactButton(
                            onClick = {
                                if (safeExIdx > 0) {
                                    rirPromptSetIdx = null
                                    workoutManager.setExerciseIndex(safeExIdx - 1)
                                }
                            },
                            enabled = safeExIdx > 0,
                            colors = ButtonDefaults.secondaryButtonColors()
                        ) {
                            Icon(Icons.Default.ChevronLeft, contentDescription = "Önceki")
                        }

                        Text(
                            text = "${safeExIdx + 1} / ${currentSession.exercises.size}",
                            color = FitHashTextSecondary,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )

                        CompactButton(
                            onClick = {
                                if (safeExIdx < currentSession.exercises.size - 1) {
                                    rirPromptSetIdx = null
                                    workoutManager.setExerciseIndex(safeExIdx + 1)
                                }
                            },
                            enabled = safeExIdx < currentSession.exercises.size - 1,
                            colors = ButtonDefaults.secondaryButtonColors()
                        ) {
                            Icon(Icons.Default.ChevronRight, contentDescription = "Sonraki")
                        }
                    }
                }

                // Exercise Title
                item(key = "ex_title_${currentExercise.id}") {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = currentExercise.exerciseName,
                            color = FitHashTextPrimary,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(horizontal = 12.dp)
                        )
                        Text(
                            text = "${currentExercise.category} • ${currentExercise.equipment}",
                            color = FitHashPrimary,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }

                // Sets List for current exercise
                itemsIndexed(
                    items = currentExercise.sets,
                    key = { setIdx, set -> set.id.ifBlank { "${currentExercise.id}_set_$setIdx" } }
                ) { setIdx, set ->
                    val isWarmup = set.isWarmup == true
                    val setLabel = if (isWarmup) "ISINMA ${set.setNumber}" else "SET ${set.setNumber}"

                    Card(
                        // Completing a set is intentionally only available from the explicit button.
                        // This prevents a scrolling/tapping mistake from starting a rest timer.
                        onClick = {},
                        modifier = Modifier.fillMaxWidth(),
                        backgroundPainter = CardDefaults.cardBackgroundPainter(
                            startBackgroundColor = if (set.completed) FitHashSurfaceSubtle else FitHashSurface,
                            endBackgroundColor = if (set.completed) FitHashSurfaceSubtle else FitHashSurface
                        )
                    ) {
                        Column(
                            modifier = Modifier.padding(6.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = setLabel,
                                    color = when {
                                        set.completed -> FitHashPrimary
                                        isWarmup -> FitHashWarning
                                        else -> FitHashTextPrimary
                                    },
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold
                                )

                                if (set.completed) {
                                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                        Text(
                                            text = "✓ TAMAMLANDI",
                                            color = FitHashPrimary,
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                        set.rir?.let { actualRir ->
                                            Text(
                                                text = "RIR ${if (actualRir == 3) "3+" else actualRir}",
                                                color = FitHashTextSecondary,
                                                fontSize = 10.sp
                                            )
                                        }
                                    }
                                } else {
                                    Text(
                                        text = if (isWarmup) "Isınma Seti" else "Hedef RIR ${set.targetRir ?: set.rir ?: "—"}",
                                        color = FitHashTextSecondary,
                                        fontSize = 10.sp
                                    )
                                }
                            }

                            // Weight adjustment controls
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                CompactButton(
                                    onClick = { workoutManager.updateSetWeight(safeExIdx, setIdx, -2.5) },
                                    colors = ButtonDefaults.secondaryButtonColors(),
                                    modifier = Modifier.size(40.dp)
                                ) {
                                    Text("-", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                }

                                val weightText = if (set.weight % 1.0 == 0.0) {
                                    "${set.weight.toInt()} kg"
                                } else {
                                    "${set.weight} kg"
                                }
                                Text(
                                    text = weightText,
                                    color = FitHashTextPrimary,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold
                                )

                                CompactButton(
                                    onClick = { workoutManager.updateSetWeight(safeExIdx, setIdx, 2.5) },
                                    colors = ButtonDefaults.secondaryButtonColors(),
                                    modifier = Modifier.size(40.dp)
                                ) {
                                    Text("+", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                }
                            }

                            // Reps adjustment controls
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                CompactButton(
                                    onClick = { workoutManager.updateSetReps(safeExIdx, setIdx, -1) },
                                    colors = ButtonDefaults.secondaryButtonColors(),
                                    modifier = Modifier.size(40.dp)
                                ) {
                                    Text("-", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                }

                                Text(
                                    text = "${set.reps} Rep",
                                    color = FitHashTextPrimary,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold
                                )

                                CompactButton(
                                    onClick = { workoutManager.updateSetReps(safeExIdx, setIdx, 1) },
                                    colors = ButtonDefaults.secondaryButtonColors(),
                                    modifier = Modifier.size(40.dp)
                                ) {
                                    Text("+", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                }
                            }

                            // Big Complete Button
                            Button(
                                onClick = {
                                    val wasCompleted = set.completed
                                    workoutManager.completeCurrentSet(safeExIdx, setIdx)
                                    rirPromptSetIdx = if (wasCompleted || isWarmup) null else setIdx
                                },
                                modifier = Modifier.fillMaxWidth().height(30.dp),
                                colors = ButtonDefaults.buttonColors(
                                    backgroundColor = if (set.completed) FitHashSurfaceSubtle else FitHashPrimary,
                                    contentColor = if (set.completed) FitHashTextPrimary else FitHashBackground
                                )
                            ) {
                                Text(
                                    text = if (set.completed) "Geri Al" else "Seti Tamamla",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }

                // Add Set Button
                item(key = "add_set_btn") {
                    Chip(
                        modifier = Modifier.fillMaxWidth(),
                        onClick = { workoutManager.addSet(safeExIdx) },
                        label = { Text("+ Set Ekle", fontWeight = FontWeight.Bold) },
                        colors = ChipDefaults.chipColors(
                            backgroundColor = FitHashSurface,
                            contentColor = FitHashPrimary
                        )
                    )
                }

                // Finish Workout Button
                item(key = "finish_workout_btn") {
                    Chip(
                        modifier = Modifier.fillMaxWidth(),
                        onClick = onFinishWorkout,
                        label = { Text("Antrenmanı Bitir", fontWeight = FontWeight.Bold) },
                        icon = { Icon(Icons.Default.Check, contentDescription = "Bitir", tint = FitHashTextPrimary) },
                        colors = ChipDefaults.chipColors(
                            backgroundColor = FitHashDanger,
                            contentColor = FitHashTextPrimary
                        )
                    )
                }
            }

            // Rest Timer Overlay (Pops over screen if timer active)
            if (restTimerSecs != null && restTimerSecs!! > 0) {
                RestTimerOverlay(
                    secondsLeft = restTimerSecs!!,
                    totalSeconds = restTimerTotal,
                    onAddSeconds = { workoutManager.adjustRestTimer(it) },
                    onCancel = { workoutManager.cancelRestTimer() }
                )
            }

            // RIR is an optional report of the set just performed. It is never pre-filled
            // from the routine target, so progression data stays honest.
            val promptSetIdx = rirPromptSetIdx
            if (promptSetIdx != null && promptSetIdx in currentExercise.sets.indices) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(FitHashBackground.copy(alpha = 0.97f)),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        modifier = Modifier.padding(horizontal = 16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Text(
                            text = "Set ${currentExercise.sets[promptSetIdx].setNumber}: RIR?",
                            color = FitHashTextPrimary,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "İsteğe bağlı • kalan tekrar",
                            color = FitHashTextSecondary,
                            fontSize = 11.sp,
                            textAlign = TextAlign.Center
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            listOf(0, 1, 2, 3).forEach { rir ->
                                Button(
                                    onClick = {
                                        workoutManager.updateSetRir(safeExIdx, promptSetIdx, rir)
                                        rirPromptSetIdx = null
                                    },
                                    modifier = Modifier.size(40.dp),
                                    colors = ButtonDefaults.buttonColors(
                                        backgroundColor = if (rir == 0) FitHashDanger else FitHashSurface,
                                        contentColor = FitHashTextPrimary
                                    )
                                ) {
                                    Text(if (rir == 3) "3+" else rir.toString(), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                        CompactChip(
                            onClick = { rirPromptSetIdx = null },
                            label = { Text("Atla", fontSize = 11.sp) },
                            colors = ChipDefaults.chipColors(
                                backgroundColor = FitHashSurfaceSubtle,
                                contentColor = FitHashTextSecondary
                            )
                        )
                    }
                }
            }
        }
    }
}
