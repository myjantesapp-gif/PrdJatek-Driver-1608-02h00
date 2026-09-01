import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

let configured = false;
let configurationInFlight: Promise<boolean> | null = null;
let permissionRequestAttempted = false;

export const ORDERS_NOTIFICATION_CHANNEL_ID = 'orders';

export async function configureNotifications(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  // Order polling and notification setup can overlap. Share one setup call so
  // Android does not receive concurrent permission prompts or channel writes.
  if (configurationInFlight) return configurationInFlight;

  configurationInFlight = (async () => {
    if (!configured) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(ORDERS_NOTIFICATION_CHANNEL_ID, {
          name: 'Commandes',
          importance: Notifications.AndroidImportance.MAX,
          sound: 'default',
          vibrationPattern: [0, 250, 250, 250],
          enableVibrate: true,
          enableLights: true,
          lightColor: '#E91E8C',
          showBadge: true,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });
      }
      configured = true;
    }

    const current = await Notifications.getPermissionsAsync();
    let status = current.status;
    // Android does not allow a useful second prompt after the driver denies
    // notifications. Only ask on the first, undetermined permission state;
    // drivers can re-enable a denial from system settings.
    if (status === 'undetermined' && !permissionRequestAttempted) {
      permissionRequestAttempted = true;
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    return status === 'granted';
  })();

  try {
    return await configurationInFlight;
  } finally {
    configurationInFlight = null;
  }
}

/**
 * Gets the Expo push token only after permission has been granted.
 * Native simulators and builds without a configured EAS project can reject
 * this call, so callers receive null and can keep the delivery flow usable.
 */
export async function getExpoPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  try {
    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : {},
    );
    const value = token.data.trim();
    return value || null;
  } catch (error) {
    console.warn('[Notifications] Expo push token unavailable:', error);
    return null;
  }
}

export async function notifyNewOrder(order: {
  restaurantName?: string;
  earnings?: number;
  orderId?: string | number;
}): Promise<void> {
  if (Platform.OS === 'web') return;
  const enabled = await configureNotifications();
  if (!enabled) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Nouvelle commande disponible',
      body: order.restaurantName
        ? `${order.restaurantName}${order.earnings ? ` · ${order.earnings.toFixed(2)} €` : ''}`
        : 'Une nouvelle commande vous attend.',
      sound: 'default',
      ...(Platform.OS === 'android' ? { channelId: ORDERS_NOTIFICATION_CHANNEL_ID } : {}),
      // Include orderId so notification tap can navigate to the order
      data: { type: 'new_order', orderId: order.orderId ?? null },
    },
    trigger: null,
  });
}

/**
 * Wire up a listener so tapping a notification navigates to the relevant screen.
 * The caller is responsible for cleaning up the returned subscription.
 */
export function addNotificationResponseListener(
  listener: (response: Notifications.NotificationResponse) => void,
) {
  if (Platform.OS === 'web') return { remove: () => {} };
  return Notifications.addNotificationResponseReceivedListener(listener);
}

/**
 * Returns the notification response that opened the app from a terminated state,
 * or null if the app was not launched via a notification tap.
 * Must be called once on startup (after the navigation tree is ready).
 */
export async function getLastNotificationResponse(): Promise<Notifications.NotificationResponse | null> {
  if (Platform.OS === 'web') return null;
  try {
    return await Notifications.getLastNotificationResponseAsync();
  } catch {
    return null;
  }
}
