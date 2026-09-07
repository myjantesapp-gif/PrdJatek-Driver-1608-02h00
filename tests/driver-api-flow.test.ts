import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

import { api } from '../lib/api';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('documented driver API flow', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    api.setToken(null);
  });

  it('loads available orders from the pickup queue endpoint', async () => {
    const orders = [{
      id: 103,
      restaurantName: 'Pizza Oujda',
      status: 'ready',
      createdAt: '2026-08-26T08:00:00.000Z',
    }];
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(orders));

    await expect(api.getAvailableOrders()).resolves.toEqual(orders);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://ma.jatek.app/api/orders/available',
      expect.objectContaining({
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  it('accepts, advances, and confirms one delivery with the documented payloads', async () => {
    const acceptedOrder = {
      id: 103,
      status: 'picked_up',
      driverId: 7,
      createdAt: '2026-08-26T08:00:00.000Z',
    };
    const enRouteOrder = { ...acceptedOrder, status: 'en_route' };
    const deliveredOrder = { ...acceptedOrder, status: 'delivered' };
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(acceptedOrder))
      .mockResolvedValueOnce(jsonResponse(enRouteOrder))
      .mockResolvedValueOnce(jsonResponse(deliveredOrder));

    await expect(api.acceptDelivery(103, 7)).resolves.toMatchObject(acceptedOrder);
    await expect(api.updateOrderStatus(103, 'en_route', { driverId: 7 }))
      .resolves.toMatchObject(enRouteOrder);
    await expect(api.confirmDelivery(103, '7364')).resolves.toMatchObject(deliveredOrder);

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://ma.jatek.app/api/orders/103/accept-delivery',
      'https://ma.jatek.app/api/orders/103/status',
      'https://ma.jatek.app/api/orders/103/confirm-delivery',
    ]);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ driverId: 7 });
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      status: 'en_route',
      driverId: 7,
    });
    expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body))).toEqual({
      pickupCode: '7364',
    });
  });

  it('reconciles an empty accept response before showing the order as accepted', async () => {
    const acceptedOrder = {
      id: 103,
      status: 'picked_up',
      driverId: 7,
      createdAt: '2026-08-26T08:00:00.000Z',
    };
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse({ data: { order: acceptedOrder } }));

    await expect(api.acceptDelivery(103, 7)).resolves.toMatchObject(acceptedOrder);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://ma.jatek.app/api/orders/103/accept-delivery',
      'https://ma.jatek.app/api/orders/103',
    ]);
  });

  it('loads the authenticated driver from the documented /me endpoint', async () => {
    const driver = { id: 7, userId: 42, name: 'Ahmed', phone: '+212600000000' };
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ data: driver }));

    await expect(api.getCurrentDriver()).resolves.toMatchObject(driver);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://ma.jatek.app/api/drivers/me',
      expect.objectContaining({ headers: { 'Content-Type': 'application/json' } }),
    );
  });

  it('keeps the HTTP status when the server returns non-JSON error content', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('<html>Bad Gateway</html>', { status: 502 }),
    );

    await expect(api.getAvailableOrders()).rejects.toMatchObject({
      status: 502,
    });
  });

  it('registers the Expo token through the authenticated driver endpoint', async () => {
    api.setToken('test-token');
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    await expect(api.registerPushToken(' ExponentPushToken[test] ')).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://ma.jatek.app/api/drivers/me/push-token',
      expect.objectContaining({
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
        body: JSON.stringify({ pushToken: 'ExponentPushToken[test]' }),
      }),
    );
  });

  it('reconciles status after an empty or wrapped status response', async () => {
    const updatedOrder = {
      id: 103,
      status: 'picked_up',
      driverId: 7,
      createdAt: '2026-08-26T08:00:00.000Z',
    };
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse(updatedOrder))
      .mockResolvedValueOnce(jsonResponse({ order: { ...updatedOrder, status: 'en_route' } }));

    await expect(api.updateOrderStatus(103, 'picked_up')).resolves.toMatchObject(updatedOrder);
    await expect(api.updateOrderStatus(103, 'en_route')).resolves.toMatchObject({
      id: 103,
      status: 'en_route',
    });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://ma.jatek.app/api/orders/103/status',
      'https://ma.jatek.app/api/orders/103',
      'https://ma.jatek.app/api/orders/103/status',
    ]);
  });
});