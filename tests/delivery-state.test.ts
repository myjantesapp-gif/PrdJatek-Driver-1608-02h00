import { describe, expect, it } from 'vitest';
import {
  getNextDeliveryStatus,
  getNextOrderStatusLabel,
  getNavigationUrls,
  getWebLocationFallback,
  isReadyForPickupStatus,
  mapApiStatus,
  shouldRetainActiveDelivery,
  shouldRollbackOptimisticStatus,
  shouldRefreshWebMapLocation,
} from '../lib/delivery-state';

describe('delivery polling retention', () => {
  it.each([
    ['an empty payload', []],
    ['an unrelated active order', [99]],
  ])('retains the current delivery for %s', (_description, activeOrderIds) => {
    expect(
      shouldRetainActiveDelivery({
        localApiId: 42,
        activeOrderIds,
      }),
    ).toBe(true);
  });

  it('retains the current delivery when its payload has an unknown status', () => {
    expect(
      shouldRetainActiveDelivery({
        localApiId: 42,
        activeOrderIds: [],
        serverStatus: 'paused_by_unknown_backend_state',
      }),
    ).toBe(true);
  });

  it('accepts string order IDs from loosely typed API JSON', () => {
    expect(
      shouldRetainActiveDelivery({
        localApiId: 42,
        activeOrderIds: ['42'],
      }),
    ).toBe(false);
  });

  it('does not retain a delivery once its own server record is terminal', () => {
    expect(
      shouldRetainActiveDelivery({
        localApiId: 42,
        activeOrderIds: [],
        serverStatus: 'completed',
      }),
    ).toBe(false);
    expect(
      shouldRetainActiveDelivery({
        localApiId: 42,
        activeOrderIds: [],
        serverStatus: 'cancelled',
      }),
    ).toBe(false);
  });

  it('normalizes the API status variants used by polling responses', () => {
    expect(mapApiStatus('picked-up')).toBe('picked_up');
    expect(mapApiStatus(' out for delivery ')).toBe('delivering');
    expect(mapApiStatus(' ready ')).toBe('incoming');
    expect(mapApiStatus('not-a-real-status')).toBe(null);
  });
});

describe('failed status request reconciliation', () => {
  const request = { orderId: 'local-42', version: 3 };

  it('does not roll back when reconciliation confirms the committed target', () => {
    expect(
      shouldRollbackOptimisticStatus({
        orderId: 'local-42',
        requestVersion: 3,
        latestRequest: request,
        activeOrderId: 'local-42',
        targetStatus: 'delivering',
        confirmedStatus: 'delivering',
      }),
    ).toBe(false);
  });

  it('does not roll back when the server is already beyond the requested target', () => {
    expect(
      shouldRollbackOptimisticStatus({
        orderId: 'local-42',
        requestVersion: 3,
        latestRequest: request,
        activeOrderId: 'local-42',
        targetStatus: 'at_restaurant',
        confirmedStatus: 'delivering',
      }),
    ).toBe(false);
  });

  it('rolls back only the still-current optimistic request without confirmation', () => {
    expect(
      shouldRollbackOptimisticStatus({
        orderId: 'local-42',
        requestVersion: 3,
        latestRequest: request,
        activeOrderId: 'local-42',
        targetStatus: 'delivering',
      }),
    ).toBe(true);
    expect(
      shouldRollbackOptimisticStatus({
        orderId: 'local-42',
        requestVersion: 2,
        latestRequest: request,
        activeOrderId: 'local-42',
        targetStatus: 'delivering',
      }),
    ).toBe(false);
  });
});

describe('order detail terminal controls', () => {
  it.each(['completed', 'cancelled'] as const)(
    'has no next action for a %s order',
    (status) => {
      expect(getNextOrderStatusLabel(status)).toBe(null);
    },
  );

  it('keeps the expected action labels for active states', () => {
    expect(getNextOrderStatusLabel('accepted')).toBe('Confirmer la récupération');
    expect(getNextOrderStatusLabel('at_restaurant')).toBe('Commande récupérée');
    expect(getNextOrderStatusLabel('picked_up')).toBe('En route vers le client');
  });

  it('follows the documented driver status sequence', () => {
    expect(getNextDeliveryStatus('accepted')).toBe('picked_up');
    expect(getNextDeliveryStatus('at_restaurant')).toBe('picked_up');
    expect(getNextDeliveryStatus('picked_up')).toBe('delivering');
    expect(getNextDeliveryStatus('delivering')).toBe(null);
  });

  it('treats ready variants as incoming pickup offers', () => {
    expect(isReadyForPickupStatus('ready')).toBe(true);
    expect(isReadyForPickupStatus(' READY ')).toBe(true);
    expect(isReadyForPickupStatus('ready-for-pickup')).toBe(true);
    expect(mapApiStatus('ready-for-pickup')).toBe('incoming');
    expect(isReadyForPickupStatus('accepted')).toBe(false);
    expect(isReadyForPickupStatus('picked_up')).toBe(false);
    expect(isReadyForPickupStatus('delivered')).toBe(false);
  });
});

describe('web map location fallback', () => {
  it.each(['permission-denied', 'timeout'] as const)(
    'returns a renderable map region when geolocation %s',
    (reason) => {
      expect(getWebLocationFallback(reason)).toEqual({
        latitude: 48.8566,
        longitude: 2.3522,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
    },
  );
});

describe('cross-platform navigation', () => {
  it('builds turn-by-turn URLs for iOS, Android, and web', () => {
    expect(getNavigationUrls('ios', 48.8566, 2.3522).nativeUrl)
      .toBe('http://maps.apple.com/?daddr=48.8566%2C2.3522&dirflg=d');
    expect(getNavigationUrls('android', 48.8566, 2.3522).nativeUrl)
      .toBe('google.navigation:q=48.8566%2C2.3522&mode=d');
    expect(getNavigationUrls('web', 48.8566, 2.3522).universalUrl)
      .toContain('/maps/dir/?api=1&destination=48.8566%2C2.3522');
  });

  it('throttles tiny web GPS updates but refreshes material movement', () => {
    const previous = { latitude: 48.8566, longitude: 2.3522, updatedAt: 1_000 };
    expect(shouldRefreshWebMapLocation(
      previous,
      { latitude: 48.85661, longitude: 2.35221 },
      10_000,
    )).toBe(false);
    expect(shouldRefreshWebMapLocation(
      previous,
      { latitude: 48.8572, longitude: 2.3522 },
      10_000,
    )).toBe(true);
    expect(shouldRefreshWebMapLocation(
      previous,
      { latitude: 48.85661, longitude: 2.35221 },
      31_000,
    )).toBe(true);
  });
});