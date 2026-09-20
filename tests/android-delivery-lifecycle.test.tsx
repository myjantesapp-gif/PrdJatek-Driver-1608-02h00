import React, { useEffect } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => {
  const values = new Map<string, string>();
  return {
    getItem: vi.fn(async (key: string) => values.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      values.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      values.delete(key);
    }),
    clear: () => values.clear(),
  };
});

const appState = vi.hoisted(() => {
  const listeners = new Set<(state: string) => void>();
  return {
    listeners,
    addEventListener: vi.fn((_event: string, listener: (state: string) => void) => {
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    }),
    emit: (state: string) => {
      listeners.forEach((listener) => listener(state));
    },
  };
});

const auth = vi.hoisted(() => ({
  user: {
    userId: 17,
    driverId: 7,
    name: 'Livreur de test',
    email: 'driver@example.test',
    phone: '+212600000000',
  },
  logout: vi.fn().mockResolvedValue(undefined),
}));

const router = vi.hoisted(() => ({
  push: vi.fn(),
}));

const notificationBridge = vi.hoisted(() => ({
  configureNotifications: vi.fn().mockResolvedValue(false),
  getExpoPushToken: vi.fn().mockResolvedValue(null),
  notifyNewOrder: vi.fn().mockResolvedValue(undefined),
  addNotificationResponseListener: vi.fn(() => ({ remove: vi.fn() })),
  getLastNotificationResponse: vi.fn().mockResolvedValue(null),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: storage,
}));

vi.mock('react-native', () => ({
  Alert: { alert: vi.fn() },
  AppState: { addEventListener: appState.addEventListener },
  Platform: { OS: 'android' },
}));

vi.mock('expo-router', () => ({ router }));
vi.mock('expo-location', () => ({
  Accuracy: { Balanced: 'balanced' },
  getForegroundPermissionsAsync: vi.fn().mockResolvedValue({
    granted: false,
    canAskAgain: false,
    status: 'denied',
  }),
  requestForegroundPermissionsAsync: vi.fn(),
}));
vi.mock('expo-notifications', () => ({}));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/lib/notifications', () => notificationBridge);
vi.mock('@/lib/sse', () => ({
  JatekSse: class {
    onStatusChange() {
      return () => {};
    }
    onAuthError() {
      return () => {};
    }
    onEvent() {
      return () => {};
    }
    start() {
      return () => {};
    }
  },
}));

import { useDriver, DriverProvider } from '../context/DriverContext';
import { ACTIVE_ORDER_KEY_PREFIX, api, type ApiOrder } from '@/lib/api';
import { getNextOrderStatusLabel } from '../lib/delivery-state';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ORDER_ID = 501;
const DRIVER_ID = 7;

function serverOrder(status: string, driverId: number | null = null): ApiOrder {
  const order = {
    id: ORDER_ID,
    status,
    driverId,
    reference: 'CMD-501',
    restaurantName: 'Pizza Oujda',
    userName: 'Client test',
    deliveryAddress: '1 rue du Test',
    deliveryFee: 4.5,
    tip: 1,
    items: [{ name: 'Pizza', quantity: 1, price: 10 }],
    restaurant: {
      name: 'Pizza Oujda',
      address: 'Restaurant test',
      phone: '+212500000000',
      latitude: 33.59,
      longitude: -7.62,
    },
    customer: {
      name: 'Client test',
      address: '1 rue du Test',
      phone: '+212611111111',
      latitude: 33.60,
      longitude: -7.61,
    },
    createdAt: '2026-09-14T08:00:00.000Z',
  } as ApiOrder;
  if (driverId === null) {
    delete (order as { driverId?: number | null }).driverId;
  }
  return order;
}

function availableOrder() {
  return {
    id: ORDER_ID,
    status: 'ready-for-pickup',
    reference: 'CMD-501',
    restaurantName: 'Pizza Oujda',
    userName: 'Client test',
    deliveryAddress: '1 rue du Test',
    deliveryFee: 4.5,
    items: [{ name: 'Pizza', quantity: 1, price: 10 }],
    createdAt: '2026-09-14T08:00:00.000Z',
  };
}

let latest: ReturnType<typeof useDriver> | null = null;

function Probe() {
  const driver = useDriver();
  useEffect(() => {
    latest = driver;
  }, [driver]);
  return null;
}

async function settle() {
  await act(async () => {
    for (let index = 0; index < 8; index += 1) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  });
}

describe('Android delivery lifecycle smoke flow', () => {
  let serverStatus = 'ready-for-pickup';
  let getOrder: ReturnType<typeof vi.spyOn>;
  let getOrders: ReturnType<typeof vi.spyOn>;
  let getAvailableOrders: ReturnType<typeof vi.spyOn>;
  let acceptDelivery: ReturnType<typeof vi.spyOn>;
  let updateOrderStatus: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    storage.clear();
    storage.getItem.mockClear();
    storage.setItem.mockClear();
    storage.removeItem.mockClear();
    appState.listeners.clear();
    router.push.mockReset();
    notificationBridge.getLastNotificationResponse.mockResolvedValue(null);
    latest = null;
    serverStatus = 'ready-for-pickup';

    getOrder = vi.spyOn(api, 'getOrder').mockImplementation(async () => (
      serverOrder(serverStatus, serverStatus === 'ready-for-pickup' ? null : DRIVER_ID)
    ));
    getOrders = vi.spyOn(api, 'getOrders').mockResolvedValue([]);
    getAvailableOrders = vi.spyOn(api, 'getAvailableOrders').mockImplementation(async () => (
      serverStatus === 'ready-for-pickup' ? [availableOrder()] : []
    ));
    acceptDelivery = vi.spyOn(api, 'acceptDelivery').mockImplementation(async () => {
      serverStatus = 'accepted';
      return serverOrder(serverStatus, DRIVER_ID);
    });
    updateOrderStatus = vi.spyOn(api, 'updateOrderStatus').mockImplementation(
      async (_orderId, status) => {
        serverStatus = status;
        return serverOrder(serverStatus, DRIVER_ID);
      },
    );
    vi.spyOn(api, 'getCurrentDriver').mockResolvedValue({
      id: DRIVER_ID,
      userId: auth.user.userId,
      name: auth.user.name,
      phone: auth.user.phone,
      vehicleType: 'moto',
      vehiclePlate: 'TEST-7',
      nationalId: 'N/A',
      licenseNumber: 'N/A',
      photoUrl: null,
      isAvailable: true,
      totalDeliveries: 0,
      rating: 5,
      latitude: null,
      longitude: null,
      locationUpdatedAt: null,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    });
    vi.spyOn(api, 'getEarnings').mockResolvedValue({
      today: 0,
      thisWeek: 0,
      thisMonth: 0,
      totalDeliveries: 0,
      completedToday: 0,
    });
    vi.spyOn(api, 'updateDriver').mockResolvedValue({} as never);
    vi.spyOn(api, 'registerPushToken').mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('accepts a delivery, reconciles after Android backgrounding, and keeps the next action', async () => {
    let renderer!: ReturnType<typeof TestRenderer.create>;
    await act(async () => {
      renderer = TestRenderer.create(
        <DriverProvider>
          <Probe />
        </DriverProvider>,
      );
    });

    await settle();
    expect(latest?.incomingOrder?.apiId).toBe(ORDER_ID);

    await act(async () => {
      await latest?.acceptOrder();
    });
    await settle();

    expect(acceptDelivery).toHaveBeenCalledWith(ORDER_ID, DRIVER_ID);
    expect(latest?.activeOrder?.apiId).toBe(ORDER_ID);
    expect(latest?.activeOrder?.status).toBe('accepted');
    expect(storage.setItem).toHaveBeenCalled();

    appState.emit('background');
    appState.emit('active');
    await settle();

    expect(getOrder).toHaveBeenCalledWith(ORDER_ID);
    expect(latest?.activeOrder?.status).toBe('accepted');
    expect(getNextOrderStatusLabel(latest?.activeOrder?.status ?? 'cancelled'))
      .toBe('Confirmer la récupération');

    renderer.unmount();
  });

  it('restores the active snapshot after a terminated process and routes a cold notification tap to it', async () => {
    serverStatus = 'picked_up';
    const snapshot = {
      id: String(ORDER_ID),
      apiId: ORDER_ID,
      reference: 'CMD-501',
      restaurant: {
        name: 'Pizza Oujda',
        address: 'Restaurant test',
        phone: '+212500000000',
        lat: 33.59,
        lng: -7.62,
      },
      customer: {
        name: 'Client test',
        address: '1 rue du Test',
        phone: '+212611111111',
        lat: 33.60,
        lng: -7.61,
      },
      items: [{ name: 'Pizza', quantity: 1, price: 10 }],
      earnings: 5.5,
      distance: 0,
      estimatedPickup: 5,
      estimatedDelivery: 15,
      otp: '',
      status: 'accepted',
      createdAt: '2026-09-14T08:00:00.000Z',
      tip: 1,
    };
    await storage.setItem(`${ACTIVE_ORDER_KEY_PREFIX}${DRIVER_ID}`, JSON.stringify(snapshot));
    notificationBridge.getLastNotificationResponse.mockResolvedValue({
      notification: {
        request: {
          content: { data: { type: 'new_order', orderId: String(ORDER_ID) } },
        },
      },
    });

    let renderer!: ReturnType<typeof TestRenderer.create>;
    await act(async () => {
      renderer = TestRenderer.create(
        <DriverProvider>
          <Probe />
        </DriverProvider>,
      );
    });

    await settle();

    expect(getOrder).toHaveBeenCalledWith(ORDER_ID);
    expect(latest?.activeOrder?.apiId).toBe(ORDER_ID);
    expect(latest?.status).toBe('busy');
    expect(getNextOrderStatusLabel(latest?.activeOrder?.status ?? 'cancelled'))
      .toBe('En route vers le client');
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/order/[id]',
      params: { id: String(ORDER_ID) },
    });

    await act(async () => {
      await expect(latest?.updateOrderStatus(String(ORDER_ID), 'delivering')).resolves.toBe(true);
    });
    expect(updateOrderStatus).toHaveBeenCalledWith(
      ORDER_ID,
      'en_route',
      { driverId: DRIVER_ID },
    );
    expect(latest?.activeOrder?.status).toBe('delivering');
    expect(getNextOrderStatusLabel(latest?.activeOrder?.status ?? 'cancelled')).toBeNull();

    renderer.unmount();
  });
});