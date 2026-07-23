import * as Notifications from 'expo-notifications';

const REMINDER_IDENTIFIER = 'vitalpulse-daily-reminder';

export async function setDailyReminder(enabled: boolean, hour: number, minute: number): Promise<boolean> {
  await Notifications.cancelScheduledNotificationAsync(REMINDER_IDENTIFIER).catch(() => {});
  if (!enabled) return true;

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return false;

  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_IDENTIFIER,
    content: {
      title: 'Time for your check-in',
      body: 'Take a moment for your pulse check or log a blood pressure reading.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
  return true;
}
