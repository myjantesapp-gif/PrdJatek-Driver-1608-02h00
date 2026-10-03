import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: storage,
}));

import {
  ACTIVE_ORDER_KEY_PREFIX,
  clearActiveOrderSnapshot,
  loadActiveOrderSnapshot,
  saveActiveOrderSnapshot,
} from '../lib/api';

describe('active order restart snapshot', () => {
  beforeEach(() => {
    storage.getItem.mockReset();
    storage.setItem.mockReset();
    storage.removeItem.mockReset();
  });

  it('stores one driver-scoped snapshot as JSON', async () => {
    const order = { id: '42', apiId: 42, status: 'delivering' };

    await saveActiveOrderSnapshot(4, order);

    expect(storage.setItem).toHaveBeenCalledWith(
      `${ACTIVE_ORDER_KEY_PREFIX}4`,
      JSON.stringify(order),
    );
  });

  it('loads a valid snapshot after an app restart', async () => {
    const order = { id: '42', apiId: 42, status: 'picked_up' };
    storage.getItem.mockResolvedValue(JSON.stringify(order));

    await expect(loadActiveOrderSnapshot<typeof order>(4)).resolves.toEqual(order);
    expect(storage.getItem).toHaveBeenCalledWith(`${ACTIVE_ORDER_KEY_PREFIX}4`);
  });

  it('removes a corrupted snapshot instead of returning unusable state', async () => {
    storage.getItem.mockResolvedValue('{not-json');

    await expect(loadActiveOrderSnapshot(4)).resolves.toBeNull();
    expect(storage.removeItem).toHaveBeenCalledWith(`${ACTIVE_ORDER_KEY_PREFIX}4`);
  });

  it('clears the snapshot when the delivery is terminal', async () => {
    await clearActiveOrderSnapshot(4);

    expect(storage.removeItem).toHaveBeenCalledWith(`${ACTIVE_ORDER_KEY_PREFIX}4`);
  });

  it.each([
    ['legacy demo identity', { id: 'demo', status: 'accepted' }],
    ['mismatched identity', { id: '42', apiId: 43, status: 'accepted' }],
    ['completed delivery', { id: '42', apiId: 42, status: 'completed' }],
    ['cancelled delivery', { id: '42', apiId: 42, status: 'cancelled' }],
    ['old incoming offer', { id: '42', apiId: 42, status: 'incoming' }],
    ['unknown status', { id: '42', apiId: 42, status: 'demo_active' }],
    ['non-object JSON', []],
  ])('removes a %s snapshot without clearing authentication', async (_name, snapshot) => {
    storage.getItem.mockResolvedValue(JSON.stringify(snapshot));
    await expect(loadActiveOrderSnapshot(4)).resolves.toBeNull();
    expect(storage.removeItem).toHaveBeenCalledTimes(1);
    expect(storage.removeItem).toHaveBeenCalledWith(`${ACTIVE_ORDER_KEY_PREFIX}4`);
  });

  it('does not suppress a valid delivery because its amount is 25 euros', async () => {
    const order = { id: '42', apiId: 42, status: 'accepted', totalAmount: 25 };
    storage.getItem.mockResolvedValue(JSON.stringify(order));
    await expect(loadActiveOrderSnapshot(4)).resolves.toEqual(order);
    expect(storage.removeItem).not.toHaveBeenCalled();
  });
});