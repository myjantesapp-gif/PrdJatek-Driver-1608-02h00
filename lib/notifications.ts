import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

let configured = false;

export async function configureNotifications(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

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
      await Notifications.setNotificationChannelAsync('orders', {
        name: 'Commandes',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }
    configured = true;
  }

  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  return status === 'granted';
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
      ...(Platform.OS === 'android' ? { channelId: 'orders' } : {}),
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
