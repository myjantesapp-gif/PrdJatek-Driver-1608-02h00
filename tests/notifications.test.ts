import { beforeEach, describe, expect, it, vi } from 'vitest';

const notifications = vi.hoisted(() => ({
  AndroidImportance: { MAX: 7 },
  AndroidNotificationVisibility: { PUBLIC: 1 },
  setNotificationHandler: vi.fn(),
  setNotificationChannelAsync: vi.fn().mockResolvedValue({ id: 'orders' }),
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  getExpoPushTokenAsync: vi.fn(),
  scheduleNotificationAsync: vi.fn(),
}));

vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));

vi.mock('expo-notifications', () => notifications);

vi.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {
        eas: {
          projectId: 'test-project-id',
        },
      },
    },
  },
}));

import {
  configureNotifications,
  getExpoPushToken,
  notifyNewOrder,
  ORDERS_NOTIFICATION_CHANNEL_ID,
} from '../lib/notifications';

describe('native push notification setup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notifications.setNotificationChannelAsync.mockResolvedValue({ id: 'orders' });
    notifications.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    notifications.requestPermissionsAsync.mockResolvedValue({ status: 'granted' });
    notifications.getExpoPushTokenAsync.mockResolvedValue({
      data: ' ExponentPushToken[real-device-token] ',
    });
    notifications.scheduleNotificationAsync.mockResolvedValue({ identifier: 'notification-1' });
  });

  it('creates the visible high-importance Commandes channel and asks only once', async () => {
    notifications.getPermissionsAsync
      .mockResolvedValueOnce({ status: 'undetermined' })
      .mockResolvedValue({ status: 'granted' });

    await expect(configureNotifications()).resolves.toBe(true);
    await expect(configureNotifications()).resolves.toBe(true);

    expect(notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      ORDERS_NOTIFICATION_CHANNEL_ID,
      expect.objectContaining({
        name: 'Commandes',
        importance: notifications.AndroidImportance.MAX,
        lockscreenVisibility: notifications.AndroidNotificationVisibility.PUBLIC,
        enableVibrate: true,
        enableLights: true,
        showBadge: true,
      }),
    );
    expect(notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(notifications.getPermissionsAsync).toHaveBeenCalledTimes(2);
  });

  it('does not prompt again after notification access is denied', async () => {
    notifications.getPermissionsAsync.mockResolvedValue({ status: 'denied' });

    await expect(configureNotifications()).resolves.toBe(false);
    await expect(configureNotifications()).resolves.toBe(false);

    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('requests a project-scoped Expo token and trims the returned value', async () => {
    await expect(getExpoPushToken()).resolves.toBe(
      'ExponentPushToken[real-device-token]',
    );
    expect(notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({
      projectId: 'test-project-id',
    });
  });

  it('publishes a new-order alert with the Android channel and tap payload', async () => {
    notifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });

    await expect(notifyNewOrder({
      restaurantName: 'Pizza Oujda',
      earnings: 4.5,
      orderId: 103,
    })).resolves.toBeUndefined();

    expect(notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: expect.objectContaining({
        title: 'Nouvelle commande disponible',
        body: 'Pizza Oujda · 4.50 €',
        channelId: ORDERS_NOTIFICATION_CHANNEL_ID,
        data: { type: 'new_order', orderId: 103 },
      }),
      trigger: null,
    });
  });
});