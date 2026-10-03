import React, { useEffect } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Alert } from 'react-native';
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
vi.mock('@/hooks/useJatekSocket', () => ({
  useJatekSocket: vi.fn(() => ({ isConnected: false })),
}));

import { useDriver, DriverProvider } from '../context/DriverContext';
import { ACTIVE_ORDER_KEY_PREFIX, api, ApiError, getDeliveryConfirmationErrorMessage, type ApiOrder } from '@/lib/api';
import { getNextOrderStatusLabel, getNextDeliveryStatus, type DeliveryStatus } from '../lib/delivery-state';

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
    vi.mocked(Alert.alert).mockClear();
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
    vi.spyOn(api, 'heartbeat').mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    api.setToken(null);
  });

  async function mountActive(status = 'accepted') {
    serverStatus = status;
    getOrders.mockImplementation(async () => [serverOrder(serverStatus, DRIVER_ID)]);
    let renderer!: ReturnType<typeof TestRenderer.create>;
    await act(async () => {
      renderer = TestRenderer.create(<DriverProvider><Probe /></DriverProvider>);
    });
    await settle();
    expect(latest?.activeOrder?.apiId).toBe(ORDER_ID);
    return renderer;
  }

  async function transition(status: DeliveryStatus) {
    await act(async () => {
      await expect(latest?.updateOrderStatus(String(ORDER_ID), status)).resolves.toBe(true);
    });
  }

  it('completes the strict flow through real API methods against a local contract double', async () => {
    const renderer = await mountActive();
    updateOrderStatus.mockRestore();
    api.setToken('test-token');
    const next: Record<string, string> = {
      accepted: 'driver_at_restaurant',
      driver_at_restaurant: 'picked_up',
      picked_up: 'en_route',
      en_route: 'out_for_delivery',
    };
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer test-token' });
      if (init?.method === 'PATCH') {
        expect(Object.keys(body)).toEqual(['status']);
        if (next[serverStatus] !== body.status) {
          return new Response(JSON.stringify({ error: 'Invalid transition' }), { status: 409 });
        }
        serverStatus = body.status;
      } else {
        expect(body).toEqual({ pickupCode: '7364' });
        expect(serverStatus).toBe('out_for_delivery');
        serverStatus = 'delivered';
      }
      return new Response(JSON.stringify(serverOrder(serverStatus, DRIVER_ID)));
    });
    for (const state of ['at_restaurant', 'picked_up', 'en_route', 'delivering'] as const) {
      await transition(state);
      expect(latest?.activeOrder?.status).toBe(state);
    }
    await act(async () => {
      await expect(latest?.validateOTP(String(ORDER_ID), '7364')).resolves.toBe(true);
    });
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(latest?.activeOrder).toBeNull();
    expect(latest?.terminalOrder?.status).toBe('completed');
    expect(latest?.history.filter(o => o.apiId === ORDER_ID)).toHaveLength(1);
    expect(latest?.status).toBe('online');
    expect(await storage.getItem(`${ACTIVE_ORDER_KEY_PREFIX}${DRIVER_ID}`)).toBeNull();
    act(() => renderer.unmount());
  });

  it('rejects skipped milestones and OTP before arrival without sending mutations', async () => {
    const renderer = await mountActive();
    const confirm = vi.spyOn(api, 'confirmDelivery');
    await act(async () => {
      for (const status of ['picked_up', 'en_route', 'delivering', 'completed'] as const) {
        await expect(latest?.updateOrderStatus(String(ORDER_ID), status)).resolves.toBe(false);
      }
      await expect(latest?.validateOTP(String(ORDER_ID), '7364')).resolves.toBe(false);
    });
    expect(updateOrderStatus).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
    expect(latest?.activeOrder?.status).toBe('accepted');
    act(() => renderer.unmount());
  });

  it.each([
    ['accepted', false, 'accepted'],
    ['driver_at_restaurant', true, 'at_restaurant'],
    ['picked_up', true, 'picked_up'],
  ])('reconciles a status conflict with remote %s', async (remoteStatus, success, localStatus) => {
    const renderer = await mountActive();
    updateOrderStatus.mockImplementation(async () => {
      serverStatus = remoteStatus;
      throw new ApiError('Cette étape a déjà été modifiée. Actualisez la course.', 409, null);
    });
    await act(async () => {
      await expect(latest?.updateOrderStatus(String(ORDER_ID), 'at_restaurant')).resolves.toBe(success);
    });
    expect(latest?.activeOrder?.status).toBe(localStatus);
    expect(getOrder).toHaveBeenCalledWith(ORDER_ID);
    expect(updateOrderStatus).toHaveBeenCalledTimes(1);
    act(() => renderer.unmount());
  });

  it('retains a confirmed step when status request and reconciliation are unavailable', async () => {
    const renderer = await mountActive('picked_up');
    updateOrderStatus.mockRejectedValue(new ApiError('Impossible de joindre l’API Jatek.', 0, null));
    getOrder.mockRejectedValue(new Error('Offline'));
    await act(async () => {
      await expect(latest?.updateOrderStatus(String(ORDER_ID), 'en_route')).resolves.toBe(false);
    });
    expect(latest?.activeOrder?.status).toBe('picked_up');
    expect(latest?.status).toBe('busy');
    act(() => renderer.unmount());
  });

  it('follows every strict backend milestone and only confirms OTP after arrival', async () => {
    const renderer = await mountActive('assigned');
    const confirm = vi.spyOn(api, 'confirmDelivery').mockImplementation(async () => {
      serverStatus = 'delivered';
      return serverOrder(serverStatus, DRIVER_ID);
    });
    await act(async () => {
      expect(await latest?.updateOrderStatus(String(ORDER_ID), 'picked_up')).toBe(false);
      expect(await latest?.validateOTP(String(ORDER_ID), '7364')).toBe(false);
    });
    expect(updateOrderStatus).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
    const stages = [
      ['at_restaurant', 'driver_at_restaurant'],
      ['picked_up', 'picked_up'],
      ['en_route', 'en_route'],
      ['delivering', 'out_for_delivery'],
    ] as const;
    for (const [appStatus, apiStatus] of stages) {
      await act(async () => {
        expect(await latest?.updateOrderStatus(String(ORDER_ID), appStatus)).toBe(true);
      });
      expect(updateOrderStatus).toHaveBeenLastCalledWith(ORDER_ID, apiStatus);
      expect(latest?.activeOrder?.status).toBe(appStatus);
      if (appStatus !== 'delivering') {
        await act(async () => {
          expect(await latest?.validateOTP(String(ORDER_ID), '7364')).toBe(false);
        });
      }
    }
    await act(async () => {
      expect(await latest?.validateOTP(String(ORDER_ID), '12ab')).toBe(false);
      expect(await latest?.validateOTP(String(ORDER_ID), '7364')).toBe(true);
    });
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(latest?.activeOrder).toBeNull();
    expect(latest?.history.filter(order => order.apiId === ORDER_ID)).toHaveLength(1);
    act(() => renderer.unmount());
  });

  it('declines an offer locally without a forbidden remote status mutation', async () => {
    let renderer!: ReturnType<typeof TestRenderer.create>;
    await act(async () => {
      renderer = TestRenderer.create(<DriverProvider><Probe /></DriverProvider>);
    });
    await settle();
    expect(latest?.incomingOrder?.apiId).toBe(ORDER_ID);
    act(() => latest?.declineOrder());
    expect(updateOrderStatus).not.toHaveBeenCalled();
    act(() => renderer.unmount());
  });

  it.each([false, true])('reconciles a status conflict (server committed: %s)', async (committed) => {
    const renderer = await mountActive('assigned');
    updateOrderStatus.mockImplementation(async () => {
      if (committed) serverStatus = 'driver_at_restaurant';
      throw new ApiError('Transition conflictuelle', 409, null);
    });
    await act(async () => {
      expect(await latest?.updateOrderStatus(String(ORDER_ID), 'at_restaurant')).toBe(committed);
    });
    expect(latest?.activeOrder?.status).toBe(committed ? 'at_restaurant' : 'accepted');
    expect(latest?.status).toBe('busy');
    act(() => renderer.unmount());
  });

  it.each([
    [400, 'INVALID_PICKUP_CODE', 'Code incorrect'],
    [410, 'DELIVERY_CODE_EXPIRED', 'expiré'],
    [409, 'DELIVERY_CODE_ALREADY_USED', 'déjà été utilisé'],
    [409, 'DELIVERY_NOT_READY', 'arrivée chez le client'],
  ])('keeps delivery active and explains OTP rejection %s/%s', async (status, code, message) => {
    const renderer = await mountActive('out_for_delivery');
    vi.spyOn(api, 'confirmDelivery').mockRejectedValue(new ApiError(
      'Confirmation refusée', Number(status), { code },
    ));
    await act(async () => {
      expect(await latest?.validateOTP(String(ORDER_ID), '7364')).toBe(false);
    });
    expect(Alert.alert).toHaveBeenCalledWith('Livraison non confirmée', expect.stringContaining(String(message)));
    expect(latest?.activeOrder?.status).toBe('delivering');
    expect(latest?.history).toHaveLength(0);
    expect(latest?.status).toBe('busy');
    act(() => renderer.unmount());
  });

  it.each(['timeout', 'already_used'])('recovers authoritative completion after %s without duplication', async (reason) => {
    const renderer = await mountActive('out_for_delivery');
    vi.spyOn(api, 'confirmDelivery').mockImplementation(async () => {
      serverStatus = 'delivered';
      throw reason === 'timeout'
        ? new Error('Network timeout')
        : new ApiError('Déjà utilisé', 409, { code: 'DELIVERY_CODE_ALREADY_USED' });
    });
    await act(async () => {
      expect(await latest?.validateOTP(String(ORDER_ID), '7364')).toBe(true);
      expect(await latest?.validateOTP(String(ORDER_ID), '7364')).toBe(false);
    });
    expect(latest?.activeOrder).toBeNull();
    expect(latest?.history.filter(order => order.apiId === ORDER_ID)).toHaveLength(1);
    act(() => renderer.unmount());
  });

  it('restores an interrupted en_route delivery without prematurely exposing OTP', async () => {
    let renderer = await mountActive('en_route');
    await act(async () => { appState.emit('active'); });
    await settle();
    act(() => renderer.unmount());
    renderer = await mountActive('en_route');
    expect(latest?.activeOrder?.status).toBe('en_route');
    expect(getNextOrderStatusLabel('en_route')).toBe('Je suis arrivé chez le client');
    const confirm = vi.spyOn(api, 'confirmDelivery');
    await act(async () => {
      expect(await latest?.validateOTP(String(ORDER_ID), '7364')).toBe(false);
    });
    expect(confirm).not.toHaveBeenCalled();
    act(() => renderer.unmount());
  });

  it.each(['delivered', 'cancelled'])(
    'applies terminal GET %s after PATCH failure even when further polling is unavailable',
    async (remoteStatus) => {
      const renderer = await mountActive('picked_up');
      await settle();
      const detailReadsBefore = getOrder.mock.calls.length;
      getOrders.mockRejectedValue(new Error('Polling unavailable'));
      getAvailableOrders.mockRejectedValue(new Error('Queue unavailable'));
      getOrder.mockResolvedValueOnce(serverOrder(remoteStatus, DRIVER_ID))
        .mockRejectedValue(new Error('Further detail reads unavailable'));
      vi.mocked(api.updateDriver).mockRejectedValue(new Error('Availability write unavailable'));
      updateOrderStatus.mockRejectedValue(new ApiError('Connection interrupted', 0, null));
      await act(async () => {
        await expect(latest?.updateOrderStatus(String(ORDER_ID), 'en_route'))
          .resolves.toBe(remoteStatus === 'delivered');
      });
      expect(latest?.activeOrder).toBeNull();
      expect(latest?.terminalOrder?.status)
        .toBe(remoteStatus === 'delivered' ? 'completed' : 'cancelled');
      expect(latest?.status).toBe('online');
      expect(latest?.history.filter(o => o.apiId === ORDER_ID))
        .toHaveLength(remoteStatus === 'delivered' ? 1 : 0);
      expect(await storage.getItem(`${ACTIVE_ORDER_KEY_PREFIX}${DRIVER_ID}`)).toBeNull();
      expect(api.updateDriver).toHaveBeenCalledWith(DRIVER_ID, { isAvailable: true });
      // Returning online may start a new offer poll. Its failure must not
      // undo the terminal state or require another read of this order.
      expect(getOrder).toHaveBeenCalledTimes(detailReadsBefore + 1);
      act(() => renderer.unmount());
    },
  );

  it('applies a cancelled confirmation recovery read without a second poll', async () => {
    const renderer = await mountActive('out_for_delivery');
    getOrders.mockRejectedValue(new Error('Polling unavailable'));
    getAvailableOrders.mockRejectedValue(new Error('Queue unavailable'));
    getOrder.mockResolvedValueOnce(serverOrder('cancelled', DRIVER_ID))
      .mockRejectedValue(new Error('Further detail reads unavailable'));
    vi.spyOn(api, 'confirmDelivery').mockRejectedValue(new ApiError('Confirmation conflict', 409, null));
    await act(async () => {
      await expect(latest?.validateOTP(String(ORDER_ID), '7364')).resolves.toBe(false);
    });
    expect(latest?.activeOrder).toBeNull();
    expect(latest?.terminalOrder?.status).toBe('cancelled');
    expect(latest?.status).toBe('online');
    expect(latest?.history).toHaveLength(0);
    expect(await storage.getItem(`${ACTIVE_ORDER_KEY_PREFIX}${DRIVER_ID}`)).toBeNull();
    act(() => renderer.unmount());
  });

  it.each(['driver_at_restaurant', 'accepted'])(
    'verifies an empty status response against the remote %s state',
    async (remoteStatus) => {
      const renderer = await mountActive();
      updateOrderStatus.mockRestore();
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        serverStatus = remoteStatus;
        return new Response(null, { status: 204 });
      });
      await act(async () => {
        await expect(latest?.updateOrderStatus(String(ORDER_ID), 'at_restaurant'))
          .resolves.toBe(remoteStatus === 'driver_at_restaurant');
      });
      expect(latest?.activeOrder?.status)
        .toBe(remoteStatus === 'driver_at_restaurant' ? 'at_restaurant' : 'accepted');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      act(() => renderer.unmount());
    },
  );

  it('recovers a status committed before a connection interruption', async () => {
    const renderer = await mountActive('picked_up');
    updateOrderStatus.mockImplementation(async () => {
      serverStatus = 'en_route';
      throw new ApiError('Impossible de joindre l’API Jatek.', 0, null);
    });
    await transition('en_route');
    expect(latest?.activeOrder?.status).toBe('en_route');
    expect(getNextDeliveryStatus(latest!.activeOrder!.status)).toBe('delivering');
    act(() => renderer.unmount());
  });

  it('does not expose OTP or send duplicate actions while arrival is in flight', async () => {
    const renderer = await mountActive('en_route');
    const confirm = vi.spyOn(api, 'confirmDelivery');
    let resolve!: (order: ApiOrder) => void;
    updateOrderStatus.mockImplementation(() => new Promise(r => { resolve = r; }));
    let pending!: Promise<boolean>;
    act(() => { pending = latest!.updateOrderStatus(String(ORDER_ID), 'delivering'); });
    expect(latest?.activeOrder?.status).toBe('en_route');
    await act(async () => {
      await expect(latest?.updateOrderStatus(String(ORDER_ID), 'delivering')).resolves.toBe(false);
      await expect(latest?.validateOTP(String(ORDER_ID), '7364')).resolves.toBe(false);
      resolve(serverOrder('out_for_delivery', DRIVER_ID));
      await expect(pending).resolves.toBe(true);
    });
    expect(updateOrderStatus).toHaveBeenCalledTimes(1);
    expect(confirm).not.toHaveBeenCalled();
    act(() => renderer.unmount());
  });

  it.each([
    [400, 'INVALID_PICKUP_CODE', 'Incorrect pickup code'],
    [410, 'DELIVERY_CODE_EXPIRED', 'Le code de livraison a expiré. Demandez un nouveau code au client.'],
    [409, 'DELIVERY_CODE_ALREADY_USED', 'Cette livraison a déjà été confirmée. Le code a déjà été utilisé.'],
    [409, 'DELIVERY_NOT_READY', 'La course doit être arrivée chez le client avant confirmation.'],
  ])('keeps the delivery and server explanation for OTP %s / %s', async (status, code, message) => {
    const renderer = await mountActive('out_for_delivery');
    const confirm = vi.spyOn(api, 'confirmDelivery').mockRejectedValue(
      new ApiError(message, status, { code }),
    );
    await act(async () => {
      await expect(latest?.validateOTP(String(ORDER_ID), '7364')).resolves.toBe(false);
    });
    expect(latest?.activeOrder?.status).toBe('delivering');
    expect(latest?.status).toBe('busy');
    expect(latest?.terminalOrder).toBeNull();
    expect(latest?.history).toHaveLength(0);
    expect(Alert.alert).toHaveBeenLastCalledWith(
      'Livraison non confirmée',
      getDeliveryConfirmationErrorMessage(new ApiError(message, status, { code })),
    );
    expect(confirm).toHaveBeenCalledTimes(1);
    act(() => renderer.unmount());
  });

  it.each(['network interruption', 'already used code'])(
    'recognizes an already completed delivery after %s, without resending the OTP',
    async (failure) => {
      const renderer = await mountActive('out_for_delivery');
      const confirm = vi.spyOn(api, 'confirmDelivery').mockImplementation(async () => {
        serverStatus = 'delivered';
        throw new ApiError(failure, failure === 'already used code' ? 409 : 0, null);
      });
      await act(async () => {
        await expect(latest?.validateOTP(String(ORDER_ID), '7364')).resolves.toBe(true);
      });
      expect(latest?.terminalOrder?.status).toBe('completed');
      expect(latest?.activeOrder).toBeNull();
      expect(latest?.history.filter(o => o.apiId === ORDER_ID)).toHaveLength(1);
      expect(confirm).toHaveBeenCalledTimes(1);
      act(() => renderer.unmount());
    },
  );

  it('keeps the snapshot when confirmation and its read-back both fail, then allows a retry', async () => {
    const renderer = await mountActive('out_for_delivery');
    const confirm = vi.spyOn(api, 'confirmDelivery').mockRejectedValueOnce(
      new ApiError('Impossible de joindre l’API Jatek.', 0, null),
    );
    getOrder.mockRejectedValueOnce(new Error('Offline'));
    await act(async () => {
      await expect(latest?.validateOTP(String(ORDER_ID), '7364')).resolves.toBe(false);
    });
    expect(latest?.activeOrder?.status).toBe('delivering');
    expect(await storage.getItem(`${ACTIVE_ORDER_KEY_PREFIX}${DRIVER_ID}`)).not.toBeNull();
    confirm.mockImplementationOnce(async () => {
      serverStatus = 'delivered';
      return serverOrder(serverStatus, DRIVER_ID);
    });
    await act(async () => {
      await expect(latest?.validateOTP(String(ORDER_ID), '7364')).resolves.toBe(true);
    });
    expect(latest?.activeOrder).toBeNull();
    expect(latest?.history).toHaveLength(1);
    act(() => renderer.unmount());
  });

  it('does not send two OTP confirmations while the first is pending', async () => {
    const renderer = await mountActive('out_for_delivery');
    let resolve!: (order: ApiOrder) => void;
    const confirm = vi.spyOn(api, 'confirmDelivery').mockImplementation(() => new Promise(r => { resolve = r; }));
    let pending!: Promise<boolean>;
    act(() => { pending = latest!.validateOTP(String(ORDER_ID), '7364'); });
    await act(async () => {
      await expect(latest?.validateOTP(String(ORDER_ID), '7364')).resolves.toBe(false);
      serverStatus = 'delivered';
      resolve(serverOrder('delivered', DRIVER_ID));
      await expect(pending).resolves.toBe(true);
    });
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(latest?.history).toHaveLength(1);
    act(() => renderer.unmount());
  });

  it.each(['delivered', 'out_for_delivery'])(
    'does not infer completion from an empty OTP response; GET returns %s',
    async (remoteStatus) => {
      const renderer = await mountActive('out_for_delivery');
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        serverStatus = remoteStatus;
        return new Response(null, { status: 204 });
      });
      await act(async () => {
        await expect(latest?.validateOTP(String(ORDER_ID), '7364'))
          .resolves.toBe(remoteStatus === 'delivered');
      });
      expect(latest?.activeOrder === null).toBe(remoteStatus === 'delivered');
      expect(latest?.history).toHaveLength(remoteStatus === 'delivered' ? 1 : 0);
      act(() => renderer.unmount());
    },
  );

  it.each(['driver_at_restaurant', 'picked_up', 'en_route', 'out_for_delivery'])(
    'restores remote milestone %s after termination, not the stale snapshot',
    async (remoteStatus) => {
      let renderer = await mountActive('out_for_delivery');
      await settle();
      act(() => renderer.unmount());
      serverStatus = remoteStatus;
      await act(async () => {
        renderer = TestRenderer.create(<DriverProvider><Probe /></DriverProvider>);
      });
      await settle();
      const expected: Record<string, DeliveryStatus> = {
        driver_at_restaurant: 'at_restaurant', picked_up: 'picked_up',
        en_route: 'en_route', out_for_delivery: 'delivering',
      };
      expect(latest?.activeOrder?.status).toBe(expected[remoteStatus]);
      expect(getNextDeliveryStatus(latest!.activeOrder!.status))
        .toBe(getNextDeliveryStatus(expected[remoteStatus]));
      act(() => renderer.unmount());
    },
  );

  it.each(['accepted', 'confirmed', 'preparing', 'ready'])(
    'shows a remote %s offer and preserves its distance in kilometers',
    async (status) => {
      getOrder.mockResolvedValue(serverOrder(status, null));
      getAvailableOrders.mockResolvedValue([{
        ...availableOrder(),
        status,
        distanceToPickupKm: 7.5,
      }]);
      let renderer!: ReturnType<typeof TestRenderer.create>;
      await act(async () => {
        renderer = TestRenderer.create(<DriverProvider><Probe /></DriverProvider>);
      });
      await settle();
      expect(latest?.incomingOrder?.apiId).toBe(ORDER_ID);
      expect(latest?.incomingOrder?.status).toBe('incoming');
      expect(latest?.incomingOrder?.distance).toBe(7.5);
      expect(latest?.activeOrder).toBeNull();
      act(() => renderer.unmount());
    },
  );

  it('loads driver assignments rather than orders purchased by the driver account', async () => {
    getOrders.mockImplementation(async (params?: Record<string, string>) => (
      params?.driverId === String(DRIVER_ID)
        ? [serverOrder('accepted', DRIVER_ID)]
        : []
    ));
    getAvailableOrders.mockResolvedValue([]);
    let renderer!: ReturnType<typeof TestRenderer.create>;
    await act(async () => {
      renderer = TestRenderer.create(<DriverProvider><Probe /></DriverProvider>);
    });
    await settle();
    expect(getOrders).toHaveBeenCalledWith({ driverId: String(DRIVER_ID) });
    expect(latest?.activeOrder?.apiId).toBe(ORDER_ID);
    expect(latest?.status).toBe('busy');
    expect(latest?.incomingOrder).toBeNull();
    act(() => renderer.unmount());
  });

  it('reports failed offers even when the assigned-order endpoint succeeds, then recovers', async () => {
    getAvailableOrders.mockRejectedValue(new Error('Offres temporairement indisponibles'));
    let renderer!: ReturnType<typeof TestRenderer.create>;
    await act(async () => {
      renderer = TestRenderer.create(<DriverProvider><Probe /></DriverProvider>);
    });
    await settle();
    expect(latest?.status).toBe('online');
    expect(latest?.isApiConnected).toBe(false);
    expect(latest?.incomingOrder).toBeNull();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Réception des commandes bloquée',
      expect.stringContaining('Offres temporairement indisponibles'),
    );
    const alerts = vi.mocked(Alert.alert).mock.calls.length;
    await act(async () => { appState.emit('active'); });
    await settle();
    await act(async () => { await latest?.refreshProfile(); });
    expect(latest?.isApiConnected).toBe(false);
    expect(Alert.alert).toHaveBeenCalledTimes(alerts);
    getAvailableOrders.mockResolvedValue([availableOrder()]);
    await act(async () => { appState.emit('active'); });
    await settle();
    expect(latest?.isApiConnected).toBe(true);
    expect(latest?.incomingOrder?.apiId).toBe(ORDER_ID);
    act(() => renderer.unmount());
  });

  it('explains an explicitly incomplete remote profile instead of appearing online with no offers', async () => {
    const profile = await api.getCurrentDriver();
    vi.mocked(api.getCurrentDriver).mockResolvedValue({
      ...profile,
      isAvailable: true,
      profileCompletedAt: null,
    });
    let renderer!: ReturnType<typeof TestRenderer.create>;
    await act(async () => {
      renderer = TestRenderer.create(<DriverProvider><Probe /></DriverProvider>);
    });
    await settle();
    expect(latest?.status).toBe('offline');
    expect(getAvailableOrders).not.toHaveBeenCalled();
    expect(latest?.incomingOrder).toBeNull();
    await act(async () => latest?.setStatus('online'));
    expect(latest?.status).toBe('offline');
    act(() => renderer.unmount());
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
      .toBe('Je suis au restaurant');

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
      await expect(latest?.updateOrderStatus(String(ORDER_ID), 'en_route')).resolves.toBe(true);
    });
    expect(updateOrderStatus).toHaveBeenCalledWith(
      ORDER_ID,
      'en_route',
    );
    expect(latest?.activeOrder?.status).toBe('en_route');
    expect(getNextOrderStatusLabel(latest?.activeOrder?.status ?? 'cancelled'))
      .toBe('Je suis arrivé chez le client');

    renderer.unmount();
  });
});