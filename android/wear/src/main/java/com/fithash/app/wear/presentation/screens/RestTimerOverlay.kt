package com.fithash.app.wear.presentation.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.*
import com.fithash.app.wear.presentation.theme.*

@Composable
fun RestTimerOverlay(
    secondsLeft: Int,
    totalSeconds: Int,
    onAddSeconds: (Int) -> Unit,
    onCancel: () -> Unit
) {
    val progress = if (totalSeconds > 0) (secondsLeft.toFloat() / totalSeconds.toFloat()) else 0f
    val mins = secondsLeft / 60
    val secs = secondsLeft % 60
    val timeFormatted = String.format("%02d:%02d", mins, secs)

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(FitHashBackground.copy(alpha = 0.95f)),
        contentAlignment = Alignment.Center
    ) {
        CircularProgressIndicator(
            progress = progress,
            modifier = Modifier.fillMaxSize().padding(6.dp),
            indicatorColor = FitHashPrimary,
            trackColor = FitHashSurfaceSubtle,
            strokeWidth = 4.dp
        )

        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.padding(16.dp)
        ) {
            Text(
                text = "DİNLENME",
                color = FitHashTextSecondary,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold
            )

            Text(
                text = timeFormatted,
                color = FitHashPrimary,
                fontSize = 28.sp,
                fontWeight = FontWeight.ExtraBold,
                modifier = Modifier.padding(vertical = 4.dp)
            )

            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                CompactButton(
                    onClick = { onAddSeconds(-15) },
                    colors = ButtonDefaults.secondaryButtonColors()
                ) {
                    Text("-15s", fontSize = 10.sp, fontWeight = FontWeight.Bold)
                }

                CompactButton(
                    onClick = onCancel,
                    colors = ButtonDefaults.buttonColors(backgroundColor = FitHashDanger)
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Atla",
                        modifier = Modifier.size(16.dp),
                        tint = FitHashTextPrimary
                    )
                }

                CompactButton(
                    onClick = { onAddSeconds(15) },
                    colors = ButtonDefaults.secondaryButtonColors()
                ) {
                    Text("+15s", fontSize = 10.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
