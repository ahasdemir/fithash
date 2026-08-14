import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const CHANNEL_DEFAULT = 'fithash';
const CHANNEL_TIMERS = 'fithash_timers';
const CHANNEL_ACHIEVEMENTS = 'fithash_achievements';

const REST_TIMER_ID = 'fithash_rest_timer';
const SESSION_REMINDER_ID = 'fithash_session_reminder';
const DAILY_REMINDER_ID = 'fithash_daily_reminder';

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
      await Notifications.setNotificationChannelAsync(CHANNEL_DEFAULT, {
        name: 'FitHash Genel Hatırlatmalar',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        enableVibrate: true,
        enableLights: true,
        lightColor: '#C6F035',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });

      await Notifications.setNotificationChannelAsync(CHANNEL_TIMERS, {
        name: 'FitHash Dinlenme Zamanlayıcısı',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 200, 500],
        enableVibrate: true,
        enableLights: true,
        lightColor: '#C6F035',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });

      await Notifications.setNotificationChannelAsync(CHANNEL_ACHIEVEMENTS, {
        name: 'FitHash Başarı ve PR Bildirimleri',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 300, 100, 300, 100, 300],
        enableVibrate: true,
        enableLights: true,
        lightColor: '#C6F035',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }
  } catch (error) {
    console.warn('Failed to configure notifications:', error);
  }
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
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
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
        vibrate: [0, 250, 250, 250],
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
  const diffSeconds = Math.max(1, Math.round((endTime - Date.now()) / 1000));

  try {
    await Notifications.cancelScheduledNotificationAsync(REST_TIMER_ID);
    await Notifications.scheduleNotificationAsync({
      identifier: REST_TIMER_ID,
      content: {
        title: '⏰ Dinlenme Süresi Doldu!',
        body: 'Dinlenmeniz bitti. Bir sonraki setinizi yapmaya hazır mısınız?',
        data: { type: 'rest_timer_finish' },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
        vibrate: [0, 500, 200, 500],
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: diffSeconds,
        repeats: false,
        channelId: CHANNEL_TIMERS,
      },
    });
  } catch (error) {
    console.warn('Failed to schedule finish notification:', error);
  }
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
      title: 'Antrenman Devam Ediyor',
      body: `"${sessionName}" hala devam ediyor. Tamamlamak için uygulamayı aç.`,
      data: { type: 'session_reminder' },
    },
    { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1800, repeats: false, channelId: CHANNEL_DEFAULT }
  );
};

export const cancelSessionReminder = async (): Promise<void> => {
  try {
    await Notifications.cancelScheduledNotificationAsync(SESSION_REMINDER_ID);
  } catch (error) {
    // Ignore.
  }
};

/**
 * Kullanıcı yeni bir Kişisel Rekor (PR) kırdığında kutlama bildirimi tetikler.
 */
export const triggerPRNotification = async (
  exerciseName: string,
  weight: number,
  reps: number
): Promise<void> => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🏆 YENİ KİŞİSEL REKOR (PR)!',
        body: `Tebrikler! ${exerciseName} hareketinde ${weight} kg x ${reps} tekrar ile yeni bir rekor kırdınız!`,
        data: { type: 'pr_achievement', exerciseName, weight, reps },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        vibrate: [0, 300, 100, 300, 100, 300],
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1,
        repeats: false,
        channelId: CHANNEL_ACHIEVEMENTS,
      },
    });
  } catch (error) {
    console.warn('PR bildirimi gönderilemedi:', error);
  }
};

/**
 * Seri (Streak) kilometre taşı kazanıldığında kutlama bildirimi tetikler.
 */
export const triggerStreakMilestoneNotification = async (streakDays: number): Promise<void> => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `🔥 ${streakDays} GÜNLÜK ANTRENMAN SERİSİ!`,
        body: `${streakDays} gündür antrenman serinizi bozmuyorsunuz! Disiplininiz ve başarınız harika!`,
        data: { type: 'streak_milestone', streakDays },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        vibrate: [0, 400, 150, 400],
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1,
        repeats: false,
        channelId: CHANNEL_ACHIEVEMENTS,
      },
    });
  } catch (error) {
    console.warn('Seri bildirimi gönderilemedi:', error);
  }
};

/**
 * Günlük sabit saatli antrenman hatırlatıcısı planlar.
 */
export const scheduleDailyWorkoutReminder = async (hour: number = 18, minute: number = 0): Promise<void> => {
  try {
    await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID);
    await Notifications.scheduleNotificationAsync({
      identifier: DAILY_REMINDER_ID,
      content: {
        title: '💪 Bugünü Boş Geçme!',
        body: 'Günün antrenman seansı seni bekliyor. Hedeflerine ulaşmak için harekete geç!',
        data: { type: 'daily_workout_reminder' },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        channelId: CHANNEL_DEFAULT,
      },
    });
  } catch (error) {
    console.warn('Günlük hatırlatıcı planlanamadı:', error);
  }
};

export const cancelDailyWorkoutReminder = async (): Promise<void> => {
  try {
    await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID);
  } catch (error) {
    // Ignore.
  }
};

