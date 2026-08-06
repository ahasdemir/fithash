import { NativeModules, Platform } from 'react-native';

const { StreakWidgetModule } = NativeModules;

/**
 * Updates the Android 2x2 Minimal Streaks Home Screen Widget
 * @param streakDays Current streak count in days
 * @param todayCompleted Whether a workout was logged today
 */
export const updateStreakWidget = async (
  streakDays: number,
  todayCompleted: boolean = false
): Promise<void> => {
  if (Platform.OS !== 'android') return;

  try {
    if (StreakWidgetModule && typeof StreakWidgetModule.updateWidgetData === 'function') {
      await StreakWidgetModule.updateWidgetData(streakDays, todayCompleted);
    }
  } catch (error) {
    console.error('[StreakWidget] Error updating Android home widget:', error);
  }
};
