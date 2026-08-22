import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

import { api, ApiError, isDriverBusyConflict } from '../lib/api';

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('accept delivery conflict contract', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    api.setToken(null);
  });

  it('allows the first accept and rejects a second accept for the same driver', async () => {
    const firstOrder = {
      id: 101,
      status: 'accepted',
      driverId: 4,
      createdAt: '2026-08-20T00:00:00.000Z',
    };
    const busyConflict = {
      code: 'DRIVER_ALREADY_BUSY',
      error: 'Driver already has an active delivery',
      activeOrderId: 101,
    };
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(firstOrder, 200))
      .mockResolvedValueOnce(jsonResponse(busyConflict, 409));

    await expect(api.acceptDelivery(101, 4)).resolves.toMatchObject(firstOrder);

    const secondAccept = api.acceptDelivery(102, 4);
    await expect(secondAccept).rejects.toBeInstanceOf(ApiError);
    await expect(secondAccept).rejects.toMatchObject({
      status: 409,
      data: busyConflict,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain('/api/orders/101/accept-delivery');
    expect(fetchMock.mock.calls[1][0]).toContain('/api/orders/102/accept-delivery');
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ driverId: 4 });
    expect(isDriverBusyConflict(
      new ApiError(busyConflict.error, 409, busyConflict),
    )).toBe(true);
  });

  it('does not classify another driver winning the order race as driver busy', () => {
    const error = new ApiError(
      'Order already taken or no longer available',
      409,
      { error: 'Order already taken or no longer available' },
    );

    expect(isDriverBusyConflict(error)).toBe(false);
  });
});