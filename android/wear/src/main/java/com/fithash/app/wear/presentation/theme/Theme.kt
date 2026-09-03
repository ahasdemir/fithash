package com.fithash.app.wear.presentation.theme

import androidx.compose.runtime.Composable
import androidx.wear.compose.material.Colors
import androidx.wear.compose.material.MaterialTheme

val WearColors = Colors(
    primary = FitHashPrimary,
    primaryVariant = FitHashPrimary,
    secondary = FitHashPrimary,
    secondaryVariant = FitHashPrimary,
    background = FitHashBackground,
    surface = FitHashSurface,
    error = FitHashDanger,
    onPrimary = FitHashBackground,
    onSecondary = FitHashBackground,
    onBackground = FitHashTextPrimary,
    onSurface = FitHashTextPrimary,
    onError = FitHashTextPrimary
)

@Composable
fun FitHashWearTheme(
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colors = WearColors,
        content = content
    )
}
