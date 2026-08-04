import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const CHANNEL_ID = 'fithash';
const REST_TIMER_ID = 'fithash_rest_timer';
const SESSION_REMINDER_ID = 'fithash_session_reminder';

export const configureNotifications = async (): Promise<void> => {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Notification permission not granted.');
        return;
      }
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'FitHash Hatırlatmaları',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#C6F035',
      });
    }
  } catch (error) {
    console.warn('Failed to configure notifications:', error);
  }
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const scheduleNotification = async (
  identifier: string,
  content: Notifications.NotificationContentInput,
  trigger: Notifications.NotificationTriggerInput
): Promise<void> => {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch (error) {
    // No existing scheduled notification for this id; ignore.
  }

  try {
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        sound: 'default',
        ...content,
      },
      trigger,
    });
  } catch (error) {
    console.warn('Failed to schedule notification:', error);
  }
};

export const scheduleRestTimerNotification = async (endTime: number): Promise<void> => {
  if (endTime <= Date.now()) return;

  await scheduleNotification(
    REST_TIMER_ID,
    {
      title: '⏱️ Dinlenme Süresi Doldu',
      body: 'Dinlenmeniz bitti. Bir sonraki setinizi yapmaya hazır mısınız?',
      data: { type: 'rest_timer' },
      priority: Notifications.AndroidNotificationPriority.HIGH,
    },
    { type: Notifications.SchedulableTriggerInputTypes.DATE, date: endTime, channelId: CHANNEL_ID }
  );
};

export const cancelRestTimerNotification = async (): Promise<void> => {
  try {
    await Notifications.cancelScheduledNotificationAsync(REST_TIMER_ID);
  } catch (error) {
    // Ignore.
  }
};

export const scheduleSessionReminder = async (sessionName: string): Promise<void> => {
  await scheduleNotification(
    SESSION_REMINDER_ID,
    {
      title: '🏋️ Antrenman Devam Ediyor',
      body: `"${sessionName}" hala devam ediyor. Tamamlamak için uygulamayı aç.`,
      data: { type: 'session_reminder' },
    },
    { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1800, repeats: false, channelId: CHANNEL_ID }
  );
};

export const cancelSessionReminder = async (): Promise<void> => {
  try {
    await Notifications.cancelScheduledNotificationAsync(SESSION_REMINDER_ID);
  } catch (error) {
    // Ignore.
  }
};
