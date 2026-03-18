/**
 * BIQc Mobile — Push Notification Service
 * Thin client: Registers device token with backend, receives and displays notifications.
 * All notification triggers originate from backend events:
 *   - Instability threshold breached
 *   - Decision checkpoint due
 *   - Daily Brief available
 *   - Integration failure
 *   - Critical alert
 */
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import api from './api';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Register for push notifications and send token to backend.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn('[Push] Must use physical device for push notifications');
    return null;
  }

  // Check permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[Push] Permission not granted');
    return null;
  }

  // Get Expo push token
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: undefined, // Will use projectId from app.json
    });
    const token = tokenData.data;

    // Register token with backend
    try {
      await api.post('/notifications/register-device', {
        push_token: token,
        platform: Platform.OS,
        device_name: Device.deviceName || 'Unknown',
      });
      console.log('[Push] Device registered with backend');
    } catch (err) {
      console.warn('[Push] Failed to register with backend:', err);
    }

    return token;
  } catch (err) {
    console.error('[Push] Failed to get push token:', err);
    return null;
  }
}

/**
 * Set up Android notification channel.
 */
export async function setupNotificationChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('biqc-alerts', {
      name: 'BIQc Alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF6A00',
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('biqc-daily-brief', {
      name: 'Daily Brief',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('biqc-checkpoints', {
      name: 'Decision Checkpoints',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });
  }
}

/**
 * Notification categories for backend-triggered events.
 */
export const NOTIFICATION_TYPES = {
  INSTABILITY_BREACH: 'instability_breach',
  CHECKPOINT_DUE: 'checkpoint_due',
  DAILY_BRIEF: 'daily_brief',
  INTEGRATION_FAILURE: 'integration_failure',
  CRITICAL_ALERT: 'critical_alert',
};

/**
 * Add listener for notification received while app is in foreground.
 */
export function addNotificationReceivedListener(handler: (notification: Notifications.Notification) => void) {
  return Notifications.addNotificationReceivedListener(handler);
}

/**
 * Add listener for notification interaction (tap).
 */
export function addNotificationResponseListener(handler: (response: Notifications.NotificationResponse) => void) {
  return Notifications.addNotificationResponseReceivedListener(handler);
}

/**
 * Get badge count.
 */
export async function getBadgeCount(): Promise<number> {
  return await Notifications.getBadgeCountAsync();
}

/**
 * Clear badge count.
 */
export async function clearBadge() {
  await Notifications.setBadgeCountAsync(0);
}
