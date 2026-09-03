export type DeliveryStatus =
  | 'incoming'
  | 'accepted'
  | 'at_restaurant'
  | 'picked_up'
  | 'delivering'
  | 'completed'
  | 'cancelled';

export const ACTIVE_STATUS_ORDER: DeliveryStatus[] = [
  'accepted',
  'at_restaurant',
  'picked_up',
  'delivering',
];

export function mapApiStatus(apiStatus: string): DeliveryStatus | null {
  // The API has returned underscores, hyphens, and spaces for the same status.
  const status = apiStatus?.trim().toLowerCase().replace(/[\s-]+/g, '_') ?? '';
  switch (status) {
    case 'pending':
    case 'assigned':
      return 'incoming';
    case 'accepted':
      return 'accepted';
    case 'at_restaurant':
    case 'ready_for_pickup':
    case 'preparing':
    case 'ready':
      return 'at_restaurant';
    case 'picked_up':
    case 'pickedup':
      return 'picked_up';
    case 'en_route':
    case 'delivering':
    case 'in_progress':
    case 'out_for_delivery':
    case 'on_the_way':
      return 'delivering';
    case 'delivered':
    case 'completed':
      return 'completed';
    case 'cancelled':
    case 'canceled':
      return 'cancelled';
    default:
      return null;
  }
}

export function isReadyForPickupStatus(apiStatus?: string): boolean {
  const normalized = apiStatus?.trim().toLowerCase().replace(/[\s-]+/g, '_') ?? '';
  return normalized === 'ready';
}

export function isAllowedStatusTransition(from: DeliveryStatus, to: DeliveryStatus) {
  switch (from) {
    case 'accepted':
      // The documented driver flow may skip the informational
      // "at_restaurant" state and confirm pickup directly.
      return to === 'picked_up' || to === 'at_restaurant';
    case 'at_restaurant':
      return to === 'picked_up';
    case 'picked_up':
      return to === 'delivering';
    default:
      return false;
  }
}

/**
 * A poll can omit an accepted order while the server is delayed or return a
 * different order while the local delivery is still active. Only an explicit
 * terminal status for this order permits the local delivery to be removed.
 */
export function shouldRetainActiveDelivery({
  localApiId,
  activeOrderIds,
  serverStatus,
}: {
  localApiId: number;
  activeOrderIds: readonly number[];
  serverStatus?: string;
}) {
  const hasMatchingActiveOrder = activeOrderIds.some((id) => id === localApiId);
  const confirmedStatus = serverStatus ? mapApiStatus(serverStatus) : null;
  const serverConfirmedTerminal =
    confirmedStatus === 'completed' || confirmedStatus === 'cancelled';

  return !hasMatchingActiveOrder && !serverConfirmedTerminal;
}

/**
 * A failed request may have committed on the server before the client timed
 * out. Do not roll back an optimistic state once a reconciliation poll has
 * confirmed the requested state (or a later active state).
 */
export function shouldRollbackOptimisticStatus({
  orderId,
  requestVersion,
  latestRequest,
  activeOrderId,
  targetStatus,
  confirmedStatus,
}: {
  orderId: string;
  requestVersion: number;
  latestRequest?: { orderId: string; version: number };
  activeOrderId?: string;
  targetStatus: DeliveryStatus;
  confirmedStatus?: DeliveryStatus;
}) {
  const confirmedAtOrBeyondTarget =
    confirmedStatus !== undefined &&
    ACTIVE_STATUS_ORDER.indexOf(confirmedStatus) >= ACTIVE_STATUS_ORDER.indexOf(targetStatus);
  const isLatestRequest =
    latestRequest?.orderId === orderId && latestRequest.version === requestVersion;

  return Boolean(isLatestRequest && activeOrderId === orderId && !confirmedAtOrBeyondTarget);
}

export function getNextDeliveryStatus(status: DeliveryStatus): DeliveryStatus | null {
  switch (status) {
    case 'accepted':
      return 'picked_up';
    case 'at_restaurant':
      return 'picked_up';
    case 'picked_up':
      return 'delivering';
    default:
      return null;
  }
}

export function getNextOrderStatusLabel(status: DeliveryStatus): string | null {
  switch (status) {
    case 'accepted':
      return 'Confirmer la récupération';
    case 'at_restaurant':
      return 'Commande récupérée';
    case 'picked_up':
      return 'En route vers le client';
    default:
      return null;
  }
}

export const DEFAULT_MAP_REGION = {
  latitude: 48.8566,
  longitude: 2.3522,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
} as const;

export type WebLocationFailure = 'unavailable' | 'permission-denied' | 'timeout';

/**
 * Keep the map renderable when browser geolocation cannot provide a position.
 * The failure reason is explicit so callers cannot accidentally treat a
 * fallback as the driver's actual location.
 */
export function getWebLocationFallback(_reason: WebLocationFailure) {
  return { ...DEFAULT_MAP_REGION };
}