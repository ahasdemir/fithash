package com.fithash.app.wear.presentation.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.List
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
fun HomeScreen(
    workoutManager: WearWorkoutManager,
    onNavigateToRoutines: () -> Unit,
    onNavigateToActiveWorkout: () -> Unit
) {
    val activeSession by workoutManager.activeSession.collectAsState()
    val listState = rememberScalingLazyListState()

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
                    text = "FitHash",
                    color = FitHashPrimary,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(bottom = 4.dp)
                )
            }

            // Active workout resume button
            if (activeSession != null) {
                item {
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
                            Text(text = "Antrenmana Devam Et")
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
            item {
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
                        Text(text = "Kayıtlı Antrenmanlar")
                    },
                    icon = {
                        Icon(
                            imageVector = Icons.Default.List,
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

            // Quick Freestyle workout button
            item {
                Chip(
                    modifier = Modifier.fillMaxWidth(),
                    onClick = {
                        workoutManager.startFreestyle()
                        onNavigateToActiveWorkout()
                    },
                    label = {
                        Text(
                            text = "Serbest Başlat",
                            fontWeight = FontWeight.SemiBold
                        )
                    },
                    secondaryLabel = {
                        Text(text = "Hızlı Seans")
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
    }
}
