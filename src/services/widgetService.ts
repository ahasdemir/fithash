import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { StreakWidgetModule } = NativeModules;
const WIDGET_STORAGE_KEY = '@fithash_streak_widget_v1';

export interface WidgetData {
  streakDays: number;
  todayCompleted: boolean;
  lastUpdated: string;
}

/**
 * Updates the Android 2x2 Minimal Streaks Home Screen Widget and persists data locally
 * @param streakDays Current streak count in days
 * @param todayCompleted Whether a workout was logged today
 */
export const updateStreakWidget = async (
  streakDays: number,
  todayCompleted: boolean = false
): Promise<void> => {
  const widgetData: WidgetData = {
    streakDays,
    todayCompleted,
    lastUpdated: new Date().toISOString(),
  };

  try {
    await AsyncStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(widgetData));
  } catch (err) {
    console.warn('[StreakWidget] Error caching widget data:', err);
  }

  if (Platform.OS !== 'android') return;

  try {
    if (StreakWidgetModule && typeof StreakWidgetModule.updateWidgetData === 'function') {
      await StreakWidgetModule.updateWidgetData(streakDays, todayCompleted);
    }
  } catch (error) {
    console.error('[StreakWidget] Error updating Android home widget:', error);
  }
};

/**
 * Retrieves cached widget status
 */
export const getStreakWidgetData = async (): Promise<WidgetData | null> => {
  try {
    const json = await AsyncStorage.getItem(WIDGET_STORAGE_KEY);
    return json ? JSON.parse(json) : null;
  } catch (err) {
    return null;
  }
};

