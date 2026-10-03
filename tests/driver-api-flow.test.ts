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
  it('uses strict JWT status payloads and reconciles an empty confirmation response', async () => {
    api.setToken('fixture-token');
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    for (const status of ['driver_at_restaurant', 'picked_up', 'en_route', 'out_for_delivery']) {
      fetchMock.mockResolvedValueOnce(jsonResponse({ id: 103, status, driverId: 7 }));
    }
    fetchMock.mockResolvedValueOnce(new Response('', { status: 200 }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 103, status: 'delivered', driverId: 7 }));
    for (const status of ['driver_at_restaurant', 'picked_up', 'en_route', 'out_for_delivery']) {
      await expect(api.updateOrderStatus(103, status)).resolves.toMatchObject({ status });
    }
    await expect(api.confirmDelivery(103, '7364')).resolves.toMatchObject({ status: 'delivered' });
    expect(fetchMock.mock.calls.slice(0, 4).map((call) => JSON.parse(String(call[1]?.body))))
      .toEqual(['driver_at_restaurant', 'picked_up', 'en_route', 'out_for_delivery'].map(status => ({ status })));
    expect(JSON.parse(String(fetchMock.mock.calls[4][1]?.body))).toEqual({ pickupCode: '7364' });
    for (const [url, options] of fetchMock.mock.calls) {
      expect(String(url)).toMatch(/^https:\/\/ma\.jatek\.app\/api\/orders\//);
      expect(options?.headers).toMatchObject({ Authorization: 'Bearer fixture-token' });
    }
  });

  it('uses the driver ownership filter when loading assigned deliveries', async () => {
    const orders = [{ id: 501, status: 'accepted', driverId: 7 }];
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse(orders));
    await expect(api.getOrders({ driverId: '7' })).resolves.toEqual(orders);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://ma.jatek.app/api/orders?driverId=7',
      expect.any(Object),
    );
  });

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

  it('normalizes wrapped available orders with string IDs', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({
        data: {
          availableOrders: [{
            id: '104',
            status: 'ready-for-pickup',
            createdAt: '2026-08-26T08:00:00.000Z',
          }],
        },
      }));

    await expect(api.getAvailableOrders()).resolves.toEqual([{
      id: 104,
      status: 'ready-for-pickup',
      createdAt: '2026-08-26T08:00:00.000Z',
    }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('accepts, advances, and confirms one delivery with the documented payloads', async () => {
    api.setToken('test-token');
    const acceptedOrder = {
      id: 103,
      status: 'accepted',
      driverId: 7,
      createdAt: '2026-08-26T08:00:00.000Z',
    };
    const milestones = ['driver_at_restaurant', 'picked_up', 'en_route', 'out_for_delivery'];
    const deliveredOrder = { ...acceptedOrder, status: 'delivered' };
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(acceptedOrder))
      .mockResolvedValueOnce(jsonResponse({ ...acceptedOrder, status: milestones[0] }))
      .mockResolvedValueOnce(jsonResponse({ ...acceptedOrder, status: milestones[1] }))
      .mockResolvedValueOnce(jsonResponse({ ...acceptedOrder, status: milestones[2] }))
      .mockResolvedValueOnce(jsonResponse({ ...acceptedOrder, status: milestones[3] }))
      .mockResolvedValueOnce(jsonResponse(deliveredOrder));

    await expect(api.acceptDelivery(103, 7)).resolves.toMatchObject(acceptedOrder);
    for (const status of milestones) {
      await expect(api.updateOrderStatus(103, status)).resolves.toMatchObject({ status });
    }
    await expect(api.confirmDelivery(103, '7364')).resolves.toMatchObject(deliveredOrder);

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://ma.jatek.app/api/orders/103/accept-delivery',
      'https://ma.jatek.app/api/orders/103/status',
      'https://ma.jatek.app/api/orders/103/status',
      'https://ma.jatek.app/api/orders/103/status',
      'https://ma.jatek.app/api/orders/103/status',
      'https://ma.jatek.app/api/orders/103/confirm-delivery',
    ]);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ driverId: 7 });
    for (let i = 0; i < milestones.length; i++) {
      expect(JSON.parse(String(fetchMock.mock.calls[i + 1][1]?.body))).toEqual({
        status: milestones[i],
      });
    }
    expect(JSON.parse(String(fetchMock.mock.calls[5][1]?.body))).toEqual({
      pickupCode: '7364',
    });
    for (const [, init] of fetchMock.mock.calls) {
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer test-token' });
    }
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

  it('sends finite GPS coordinates as latitude then longitude', async () => {
    api.setToken('test-token');
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    await api.updateLocation(7, Number('48.8566'), Number('2.3522'));

    expect(fetchMock).toHaveBeenCalledWith(
      'https://ma.jatek.app/api/drivers/7/location',
      expect.objectContaining({
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
        body: JSON.stringify({ latitude: 48.8566, longitude: 2.3522 }),
      }),
    );
  });

  it('rejects invalid GPS coordinates before sending them', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    await expect(api.updateLocation(7, Number.NaN, 2.3522))
      .rejects.toThrow('Coordonnées GPS invalides.');
    await expect(api.updateLocation(7, 48.8566, 181))
      .rejects.toThrow('Coordonnées GPS invalides.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the driver heartbeat to the documented endpoint', async () => {
    api.setToken('test-token');
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ alive: true }));

    await api.heartbeat(7);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://ma.jatek.app/api/drivers/7/heartbeat',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
        body: JSON.stringify({}),
      }),
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

  it('uses only ma.jatek.app and explains the browser CORS requirement when it is unreachable', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(api.login('driver@example.com', 'password123')).rejects.toMatchObject({
      status: 0,
      message: 'Connexion impossible à l’API Jatek depuis ce navigateur. Le backend doit autoriser https://driver.jatek.app dans sa configuration CORS.',
    });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://ma.jatek.app/api/auth/login',
      expect.any(Object),
    );
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

  it('uses the remote OTP flow for driver signup', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({
        success: true,
        channel: 'whatsapp',
        message: 'OTP envoyé',
        otpSent: true,
      }))
      .mockResolvedValueOnce(jsonResponse({
        token: 'signup-token',
        user: {
          id: 42,
          name: 'Ahmed Livreur',
          email: 'driver@example.com',
          role: 'driver',
        },
        isNewUser: true,
      }));

    await expect(api.sendAuthOtp({ phone: ' +212600000000 ' })).resolves.toMatchObject({
      otpSent: true,
    });
    await expect(api.verifyAuthOtp({
      phone: ' +212600000000 ',
      code: '123456',
      intent: 'signup',
      name: 'Ahmed Livreur',
      email: 'DRIVER@example.com',
      password: 'password123',
      role: 'driver',
    })).resolves.toMatchObject({
      token: 'signup-token',
      user: { role: 'driver' },
    });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://ma.jatek.app/api/auth/send-otp',
      'https://ma.jatek.app/api/auth/verify-otp',
    ]);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      phone: '+212600000000',
    });
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      phone: '+212600000000',
      code: '123456',
      intent: 'signup',
      name: 'Ahmed Livreur',
      email: 'driver@example.com',
      password: 'password123',
      role: 'driver',
    });
  });

  it('uses the remote email reset flow for forgotten passwords', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({
        success: true,
        message: 'Si un compte est associé à cet email, un code a été envoyé.',
      }))
      .mockResolvedValueOnce(jsonResponse({
        success: true,
        message: 'Mot de passe réinitialisé',
      }));

    await expect(api.requestPasswordReset(' DRIVER@example.com ')).resolves.toMatchObject({
      success: true,
    });
    await expect(api.resetPassword(' DRIVER@example.com ', '123456', 'password123'))
      .resolves.toMatchObject({ success: true });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://ma.jatek.app/api/auth/forgot-password',
      'https://ma.jatek.app/api/auth/reset-password',
    ]);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      email: 'driver@example.com',
    });
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      email: 'driver@example.com',
      code: '123456',
      newPassword: 'password123',
    });
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

  it.each([
    [400, 'INVALID_PICKUP_CODE', 'Incorrect pickup code'],
    [410, 'DELIVERY_CODE_EXPIRED', 'Le code de livraison a expiré. Demandez un nouveau code au client.'],
    [409, 'DELIVERY_CODE_ALREADY_USED', 'Cette livraison a déjà été confirmée. Le code a déjà été utilisé.'],
    [409, 'DELIVERY_NOT_READY', 'La course doit être arrivée chez le client avant confirmation.'],
  ])('preserves OTP error %s / %s without retrying the mutation', async (status, code, message) => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({ error: message, code }, status),
    );
    await expect(api.confirmDelivery(103, '7364')).rejects.toMatchObject({
      status, message, data: { code },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(['', 'abcd', '123', '12345'])('rejects malformed OTP %j without a request', async (code) => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    await expect(api.confirmDelivery(103, code)).rejects.toThrow('4 chiffres');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reads the authoritative order after an empty confirmation response', async () => {
    const delivered = { id: 103, status: 'delivered' };
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse({ data: { order: delivered } }));
    await expect(api.confirmDelivery(103, '7364')).resolves.toEqual(delivered);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://ma.jatek.app/api/orders/103/confirm-delivery',
      'https://ma.jatek.app/api/orders/103',
    ]);
  });
});