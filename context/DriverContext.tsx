import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import {
  api,
  ApiDriverProfile,
  ApiOrder,
  ApiAvailableOrder,
  ApiEarnings,
  ApiError,
  isDriverBusyConflict,
} from '@/lib/api';
import { JatekSse, SseEvent } from '@/lib/sse';
import * as ExpoNotifications from 'expo-notifications';
import { configureNotifications, notifyNewOrder, addNotificationResponseListener, getLastNotificationResponse } from '@/lib/notifications';
import { useAuth } from '@/context/AuthContext';
import {
  ACTIVE_STATUS_ORDER,
  isAllowedStatusTransition,
  mapApiStatus,
  shouldRetainActiveDelivery,
  shouldRollbackOptimisticStatus,
  type DeliveryStatus,
} from '@/lib/delivery-state';

export type DriverStatus = 'online' | 'offline' | 'busy';

export interface DriverEarnings {
  today: number;
  week: number;
  month: number;
}

export interface DriverStats {
  deliveriesToday: number;
  deliveriesTotal: number;
  rating: number;
  level: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
  kmToday: number;
}

export interface DriverProfile {
  id: string;
  name: string;
  phone: string;
  vehicleType: string;
  vehiclePlate: string;
  photo?: string;
}

export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  apiId: number;
  reference: string;
  restaurant: {
    name: string;
    address: string;
    phone: string;
    lat: number;
    lng: number;
  };
  customer: {
    name: string;
    address: string;
    phone: string;
    lat: number;
    lng: number;
  };
  items: OrderItem[];
  earnings: number;
  distance: number;
  estimatedPickup: number;
  estimatedDelivery: number;
  otp: string;
  status: DeliveryStatus;
  createdAt: string;
  completedAt?: string;
  tip: number;
}

export interface DeliveryHistory extends Order {
  rating?: number;
  completedAt: string;
}

// Map app status → API status
function mapAppStatusToApi(appStatus: Order['status']): string {
  switch (appStatus) {
    case 'accepted':      return 'accepted';
    case 'at_restaurant': return 'at_restaurant';
    case 'picked_up':     return 'picked_up';
    // The app calls this visual state "delivering"; the driver API calls the
    // first transition after pickup "en_route".
    case 'delivering':    return 'en_route';
    case 'completed':     return 'delivered';
    case 'cancelled':     return 'cancelled';
    default:              return appStatus;
  }
}

function isValidApiOrderResponse(value: unknown, expectedId: number) {
  if (!value || typeof value !== 'object') return false;
  const order = value as Partial<ApiOrder>;
  return (
    Number(order.id) === expectedId &&
    typeof order.status === 'string' &&
    mapApiStatus(order.status) !== null
  );
}

/**
 * Status responses sometimes omit relational fields. Keep the existing order
 * details unless the server explicitly supplies a non-empty replacement.
 */
function mergeOrderWithServer(local: Order, server: Order): Order {
  return {
    ...local,
    ...server,
    restaurant: {
      ...local.restaurant,
      ...server.restaurant,
      name: server.restaurant.name || local.restaurant.name,
      address: server.restaurant.address || local.restaurant.address,
      phone: server.restaurant.phone || local.restaurant.phone,
      lat: server.restaurant.lat || local.restaurant.lat,
      lng: server.restaurant.lng || local.restaurant.lng,
    },
    customer: {
      ...local.customer,
      ...server.customer,
      name: server.customer.name || local.customer.name,
      address: server.customer.address || local.customer.address,
      phone: server.customer.phone || local.customer.phone,
      lat: server.customer.lat || local.customer.lat,
      lng: server.customer.lng || local.customer.lng,
    },
    items: server.items.length > 0 ? server.items : local.items,
    createdAt: server.createdAt || local.createdAt,
    otp: server.otp || local.otp,
  };
}

function getLevelFromDeliveries(total: number): DriverStats['level'] {
  if (total >= 500) return 'Platinum';
  if (total >= 200) return 'Gold';
  if (total >= 50)  return 'Silver';
  return 'Bronze';
}

// Convert available-order (GET /api/orders/available) to app Order format.
// This endpoint returns a flat structure with different field names.
function mapAvailableOrder(order: ApiAvailableOrder): Order {
  const rawItems = order.items ?? [];
  const items: OrderItem[] = rawItems.map((i) => ({
    name: i.menuItemName ?? i.name ?? '',
    quantity: i.quantity,
    price: Number(i.unitPrice ?? i.price) || 0,
  }));
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const total = Number(order.total ?? order.subtotal) || subtotal;
  const deliveryFee = Number(order.deliveryFee) || 0;
  const earnings = deliveryFee > 0 ? deliveryFee : parseFloat((total * 0.12).toFixed(2));

  return {
    id: String(order.id),
    apiId: order.id,
    reference: order.reference ?? `Commande #${order.id}`,
    restaurant: {
      name: order.restaurantName ?? 'Restaurant',
      address: '',
      phone: '',
      lat: 0,
      lng: 0,
    },
    customer: {
      name: order.userName ?? 'Client',
      address: order.deliveryAddress ?? '',
      phone: '',
      lat: 0,
      lng: 0,
    },
    items,
    earnings,
    distance: 0,
    estimatedPickup: 5,
    estimatedDelivery: order.estimatedDeliveryTime ?? 15,
    otp: order.kitchenCode ?? order.pickupCode ?? '',
    status: 'incoming',
    createdAt: order.createdAt,
    tip: 0,
  };
}

// Convert API order to app Order format
function mapApiOrder(apiOrder: ApiOrder, driverId: number): Order {
  const shop = apiOrder.shop || apiOrder.restaurant;
  const customer = apiOrder.customer || apiOrder.user;
  const rawItems = apiOrder.orderItems || apiOrder.items || [];

  const items: OrderItem[] = rawItems.map((i) => ({
    name: i.name ?? i.menuItemName ?? '',
    quantity: i.quantity,
    price: Number(i.price ?? i.unitPrice) || 0,
  }));

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const tip = Number(apiOrder.tip) || 0;
  const deliveryFee = Number(apiOrder.deliveryFee) || 0;
  const earnings = deliveryFee > 0 ? deliveryFee + tip : parseFloat((subtotal * 0.12 + tip).toFixed(2));

  const distance = Number(apiOrder.distance) || 0;

  // Fall back to 'incoming' for unmapped statuses so the order is not dropped
  const mappedStatus = mapApiStatus(apiOrder.status) ?? 'incoming';

  return {
    id: String(apiOrder.id),
    apiId: apiOrder.id,
    reference: apiOrder.reference ?? `Commande #${apiOrder.id}`,
    restaurant: {
      name: shop?.name ?? apiOrder.restaurantName ?? 'Restaurant',
      address: shop?.address ?? '',
      phone: (shop as any)?.phone ?? '',
      lat: (shop as any)?.latitude ?? (shop as any)?.lat ?? 0,
      lng: (shop as any)?.longitude ?? (shop as any)?.lng ?? 0,
    },
    customer: {
      name: customer?.name ?? apiOrder.userName ?? 'Client',
      address: apiOrder.deliveryAddress ?? (customer as any)?.address ?? '',
      phone: (customer as any)?.phone ?? '',
      lat: apiOrder.deliveryLatitude ?? (customer as any)?.latitude ?? (customer as any)?.lat ?? 0,
      lng: apiOrder.deliveryLongitude ?? (customer as any)?.longitude ?? (customer as any)?.lng ?? 0,
    },
    items,
    earnings,
    distance,
    estimatedPickup: apiOrder.estimatedPickupTime ?? 5,
    estimatedDelivery: apiOrder.estimatedDeliveryTime ?? (distance > 0 ? Math.floor(distance * 3 + 5) : 15),
    otp: apiOrder.otp ?? apiOrder.deliveryCode ?? apiOrder.pickupCode ?? apiOrder.kitchenCode ?? '',
    status: mappedStatus,
    createdAt: apiOrder.createdAt,
    completedAt: apiOrder.completedAt,
    tip,
  };
}

interface DriverContextType {
  status: DriverStatus;
  setStatus: (s: DriverStatus) => void;
  earnings: DriverEarnings;
  stats: DriverStats;
  profile: DriverProfile;
  incomingOrder: Order | null;
  activeOrder: Order | null;
  terminalOrder: Order | null;
  history: DeliveryHistory[];
  acceptOrder: () => Promise<void>;
  declineOrder: () => void;
  updateOrderStatus: (id: string, status: Order['status']) => Promise<boolean>;
  validateOTP: (id: string, code: string) => Promise<boolean>;
  dismissIncoming: () => void;
  isApiConnected: boolean;
  isSocketConnected: boolean;
  lastSyncAt: Date | null;
  refreshEarnings: () => void;
  refreshProfile: () => Promise<void>;
}

const DriverContext = createContext<DriverContextType | null>(null);

/**
 * Primary polling interval (ms).
 * Polling remains a safety net for SSE disconnects and app backgrounding.
 */
const FALLBACK_POLL_MS = 3_000;
const DRIVER_LOCATION_POLL_MS = 10_000;

type DriverCoordinates = {
  latitude: number;
  longitude: number;
};

export function DriverProvider({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const driverId = user?.driverId ?? null;

  const [status, setStatusState] = useState<DriverStatus>('offline');
  const [incomingOrder, setIncomingOrder] = useState<Order | null>(null);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [terminalOrder, setTerminalOrder] = useState<Order | null>(null);
  const [history, setHistory] = useState<DeliveryHistory[]>([]);
  const [earnings, setEarnings] = useState<DriverEarnings>({ today: 0, week: 0, month: 0 });
  const [stats, setStats] = useState<DriverStats>({
    deliveriesToday: 0,
    deliveriesTotal: 0,
    rating: 5.0,
    level: 'Bronze',
    kmToday: 0,
  });
  const [profile, setProfile] = useState<DriverProfile>({
    id: user ? String(user.driverId) : 'DRV',
    name: user?.name ?? 'Livreur',
    phone: user?.phone ?? '',
    vehicleType: 'Moto',
    vehiclePlate: '',
  });
  const [isApiConnected, setIsApiConnected] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const statusRef = useRef<DriverStatus>(status);

  const seenOrderIds = useRef<Set<number>>(new Set());
  const pendingQueueRef = useRef<number[]>([]); // IDs of pending orders not yet shown
  const fallbackPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollInFlightRef = useRef<Promise<void> | null>(null);
  const incomingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAvailableOrdersRef = useRef<ApiAvailableOrder[]>([]);
  /** Pre-fetched full order data for available-queue entries (coordinates enriched). */
  const enrichedOrderCache = useRef<Map<number, Order>>(new Map());
  /**
   * Offers removed because the server already assigned them elsewhere (409/SSE)
   * or because the driver's profile is not eligible (412).
   */
  const suppressedOfferIds = useRef<Set<number>>(new Set());
  const driverLocationRef = useRef<DriverCoordinates | null>(null);
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const locationRequestInFlightRef = useRef(false);
  const locationPermissionRef = useRef<'unknown' | 'granted' | 'denied'>('unknown');
  const acceptingOrderIdRef = useRef<number | null>(null);
  /** Prevent duplicate in-flight status transitions */
  const isUpdatingStatusRef = useRef(false);
  const statusUpdateVersionRef = useRef(0);
  const latestStatusUpdateRef = useRef<{ orderId: string; version: number } | null>(null);
  const confirmedActiveStatusRef = useRef<{ orderId: string; status: Order['status'] } | null>(null);
  /** Prevent repeated alerts when an older client or backend creates duplicate active deliveries. */
  const multipleActiveOrdersAlertedRef = useRef(false);
  /** Prevent duplicate confirm-delivery requests across screens or taps. */
  const isConfirmingDeliveryRef = useRef(false);
  /** Stable ref to latest activeOrder — read inside notification listener without stale closure */
  const activeOrderRef = useRef<Order | null>(null);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    activeOrderRef.current = activeOrder;
  }, [activeOrder]);

  // Reset seen-order tracking whenever the driver identity changes (login/logout)
  useEffect(() => {
    seenOrderIds.current.clear();
    pendingQueueRef.current = [];
    enrichedOrderCache.current.clear();
    suppressedOfferIds.current.clear();
    multipleActiveOrdersAlertedRef.current = false;
    driverLocationRef.current = null;
    locationPermissionRef.current = 'unknown';
  }, [driverId]);

  // ── Load driver profile & earnings ──────────────────────────────────────────

  const refreshProfile = useCallback(async () => {
    if (!driverId) return;
    try {
      const d: ApiDriverProfile = await api.getDriver(driverId);
      setProfile({
        id: String(d.id),
        name: d.name,
        phone: d.phone,
        vehicleType: d.vehicleType === 'moto' ? 'Scooter / Moto' : d.vehicleType,
        vehiclePlate: d.vehiclePlate,
        photo: d.photoUrl ?? undefined,
      });
      setStatusState(d.isAvailable ? 'online' : 'offline');
      setIsApiConnected(true);
    } catch (err) {
      console.warn('[DriverContext] loadProfile failed:', err);
      setIsApiConnected(false);
    }
  }, [driverId]);

  useEffect(() => {
    if (!driverId) return;

    // Ask for push permission; web is a no-op
    configureNotifications().catch(() => {});

    const loadEarnings = async () => {
      try {
        const e: ApiEarnings = await api.getEarnings(driverId);
        setEarnings({
          today: Number(e.today) || 0,
          week: Number(e.thisWeek) || 0,
          month: Number(e.thisMonth) || 0,
        });
        setStats((prev) => ({
          ...prev,
          deliveriesToday: e.completedToday,
          deliveriesTotal: e.totalDeliveries,
          level: getLevelFromDeliveries(e.totalDeliveries),
        }));
      } catch (err) {
        console.warn('[DriverContext] loadEarnings failed:', err);
      }
    };

    refreshProfile();
    loadEarnings();
  }, [driverId, refreshProfile]);

  // ── Wire notification tap → navigate to active order ────────────────────────

  useEffect(() => {
    if (!driverId) return;

    // Shared routing logic for both cold-start and foreground/background taps
    const handleNotificationResponse = (response: ExpoNotifications.NotificationResponse) => {
      const data = (response.notification.request.content.data ?? null) as Record<string, unknown> | null;
      const orderId = data?.orderId ? String(data.orderId) : null;

      if (orderId && activeOrderRef.current?.id === orderId) {
        // The notification is for an order the driver already accepted — open detail
        router.push(`/order/${orderId}` as any);
      } else {
        // For incoming offers (not yet accepted) the LiveOrderAlert is shown on
        // the tabs screen — navigate there so the driver can act on it.
        router.push('/(tabs)' as any);
      }
    };

    // Handle cold-start: app launched from a terminated state by tapping a notification.
    // getLastNotificationResponse returns the tap that launched the app (once only).
    getLastNotificationResponse().then((response) => {
      if (response) handleNotificationResponse(response);
    }).catch(() => {});

    // Handle foreground / background taps while the JS runtime is already alive.
    const subscription = addNotificationResponseListener(handleNotificationResponse);
    return () => subscription.remove();
  }, [driverId]);

  // ── Persist & sync status ────────────────────────────────────────────────────

  const statusVersionRef = useRef(0);

  const setStatus = useCallback(async (s: DriverStatus) => {
    const version = ++statusVersionRef.current;
    const prev = statusRef.current;
    setStatusState(s);
    statusRef.current = s;
    if (driverId && s !== 'busy') {
      try {
        await api.updateDriver(driverId, { isAvailable: s === 'online' });
      } catch (err) {
        if (statusVersionRef.current === version) {
          console.warn('[DriverContext] updateDriver status failed — rolling back:', err);
          setStatusState(prev);
          statusRef.current = prev;
        }
      }
    }
  }, [driverId]);

  // ── Driver location sync ─────────────────────────────────────────────────────

  useEffect(() => {
    const shouldTrackLocation =
      Boolean(driverId) && (status === 'online' || status === 'busy');

    if (!shouldTrackLocation || !driverId) return;

    let cancelled = false;

    const readCurrentLocation = async (): Promise<DriverCoordinates | null> => {
      if (Platform.OS === 'web') {
        if (typeof navigator === 'undefined' || !navigator.geolocation) return null;

        return new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (position) => resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            }),
            () => resolve(null),
            {
              enableHighAccuracy: true,
              maximumAge: 10_000,
              timeout: 10_000,
            },
          );
        });
      }

      try {
        if (locationPermissionRef.current === 'unknown') {
          let permission = await Location.getForegroundPermissionsAsync();
          if (
            !permission.granted &&
            permission.canAskAgain &&
            permission.status === 'undetermined'
          ) {
            permission = await Location.requestForegroundPermissionsAsync();
          }
          locationPermissionRef.current = permission.granted ? 'granted' : 'denied';
        }

        if (locationPermissionRef.current !== 'granted') return null;

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        return {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
      } catch {
        return null;
      }
    };

    const syncLocation = async () => {
      if (cancelled || locationRequestInFlightRef.current) return;
      locationRequestInFlightRef.current = true;

      try {
        const coordinates = await readCurrentLocation();
        if (!coordinates || cancelled) return;

        driverLocationRef.current = coordinates;
        await api.updateLocation(
          driverId,
          coordinates.latitude,
          coordinates.longitude,
        );
      } catch (err) {
        if (!cancelled) {
          console.warn('[DriverContext] location sync failed:', err);
        }
      } finally {
        locationRequestInFlightRef.current = false;
      }
    };

    syncLocation();
    locationIntervalRef.current = setInterval(syncLocation, DRIVER_LOCATION_POLL_MS);

    return () => {
      cancelled = true;
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
        locationIntervalRef.current = null;
      }
    };
  }, [driverId, status]);

  // ── Order sync ───────────────────────────────────────────────────────────────

  const INCOMING_STATUSES = ['pending', 'assigned'];
  const TERMINAL_STATUSES = ['delivered', 'completed', 'cancelled', 'canceled'];

  const lastOrdersRef = useRef<ApiOrder[]>([]);

  const popNextFromQueue = useCallback(
    (assignedOrders: ApiOrder[], availableOrders: ApiAvailableOrder[]): Order | null => {
      if (!driverId) return null;
      const assignedById = new Map(assignedOrders.map((o) => [o.id, o]));
      const availableById = new Map(availableOrders.map((o) => [o.id, o]));

      while (pendingQueueRef.current.length > 0) {
        const nextId = pendingQueueRef.current.shift()!;

        if (suppressedOfferIds.current.has(nextId)) continue;

        // Use pre-fetched enriched data if available (has real coordinates)
        const enriched = enrichedOrderCache.current.get(nextId);
        if (enriched) {
          return enriched;
        }

        // Check assigned orders first
        const assigned = assignedById.get(nextId);
        if (assigned) {
          const s = assigned.status?.trim().toLowerCase() ?? '';
          if (!INCOMING_STATUSES.includes(s)) continue; // accepted/cancelled server-side
          return mapApiOrder(assigned, driverId);
        }

        // Check available orders (coords will be 0,0 — enrichment fires below)
        const available = availableById.get(nextId);
        if (available) {
          return mapAvailableOrder(available);
        }
      }
      return null;
    },
    [driverId],
  );

  const advanceQueueRef = useRef<() => void>(() => {});

  const showOrderAlert = useCallback((order: Order) => {
    setIncomingOrder(order);
    notifyNewOrder({
      restaurantName: order.restaurant.name,
      earnings: order.earnings,
      orderId: order.id,
    }).catch(() => {});

    if (incomingTimerRef.current) clearTimeout(incomingTimerRef.current);
    incomingTimerRef.current = setTimeout(() => {
      seenOrderIds.current.delete(order.apiId);
      advanceQueueRef.current();
    }, 25000);

    // If this order has missing coordinates, update it once enrichment completes
    if (order.restaurant.lat === 0 && order.restaurant.lng === 0) {
      const cachedEnriched = enrichedOrderCache.current.get(order.apiId);
      if (cachedEnriched) {
        setIncomingOrder(cachedEnriched);
      } else if (driverId) {
        api.getOrder(order.apiId).then((full) => {
          const enriched = mapApiOrder(full, driverId);
          const withIncoming = { ...enriched, status: 'incoming' as const };
          enrichedOrderCache.current.set(order.apiId, withIncoming);
          // Update the displayed alert if it's still showing this order
          setIncomingOrder((current) =>
            current?.apiId === order.apiId ? withIncoming : current,
          );
        }).catch(() => {/* non-critical */});
      }
    }
  }, [driverId]);

  const advanceQueue = useCallback(() => {
    const next = popNextFromQueue(lastOrdersRef.current, lastAvailableOrdersRef.current);
    if (next) {
      showOrderAlert(next);
    } else {
      setIncomingOrder(null);
    }
  }, [popNextFromQueue, showOrderAlert]);

  useEffect(() => {
    advanceQueueRef.current = advanceQueue;
  }, [advanceQueue]);

  const pollOrdersRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const pollOrders = useCallback((): Promise<void> => {
    if (!driverId) return Promise.resolve();
    // SSE and the fallback interval can fire together. All callers share the
    // active synchronization so no stale response can overwrite newer UI, and
    // callers that need reconciliation can wait for it to finish.
    if (pollInFlightRef.current) return pollInFlightRef.current;

    const poll = (async () => {
      try {
      const currentStatus = statusRef.current;
      const isOnline = currentStatus === 'online';
      const [assignedResult, availableResult] = await Promise.allSettled([
        api.getOrders(),
        isOnline ? api.getAvailableOrders() : Promise.resolve([] as ApiAvailableOrder[]),
      ]);

      const assigned: ApiOrder[] = (
        assignedResult.status === 'fulfilled' && Array.isArray(assignedResult.value)
      )
        ? assignedResult.value
        : lastOrdersRef.current;
      const available: ApiAvailableOrder[] = (
        availableResult.status === 'fulfilled' && Array.isArray(availableResult.value)
      )
        ? availableResult.value
        : lastAvailableOrdersRef.current;

      setLastSyncAt(new Date());
      setIsApiConnected(true);

      lastOrdersRef.current = assigned;
      lastAvailableOrdersRef.current = available;

      const visibleAvailableIds = new Set(available.map((order) => order.id));
      suppressedOfferIds.current.forEach((id) => {
        if (!visibleAvailableIds.has(id)) suppressedOfferIds.current.delete(id);
      });

      const myOrders = assigned.filter(
        (o) => o.driverId === driverId || o.assignedDriverId === driverId,
      );

      // ── Active in-progress orders ──────────────────────────────────────────
      // Only include orders whose status maps to a known, in-progress app state.
      // Unknown statuses (mapApiStatus → null) are excluded rather than
      // treated as active, which would produce a 'busy' driver with no valid order.
      const activeApiOrders = myOrders.filter((o) => {
        const mapped = mapApiStatus(o.status);
        return (
          mapped !== null &&
          mapped !== 'incoming' &&   // not yet accepted — use incoming-offer flow
          mapped !== 'completed' &&
          mapped !== 'cancelled'
        );
      });

      if (activeApiOrders.length > 1 && !multipleActiveOrdersAlertedRef.current) {
        multipleActiveOrdersAlertedRef.current = true;
        Alert.alert(
          'Plusieurs livraisons détectées',
          'Le serveur a associé plusieurs commandes à ce compte. La livraison déjà ouverte reste prioritaire ; contactez le support avant d’en commencer une autre.',
        );
      } else if (activeApiOrders.length <= 1) {
        multipleActiveOrdersAlertedRef.current = false;
      }

      const completedOrders = myOrders.filter((o) => {
        const mapped = mapApiStatus(o.status);
        return mapped === 'completed';
      });
      if (completedOrders.length > 0) {
        setHistory((prev) => {
          const existingIds = new Set(prev.map((h) => h.id));
          const newEntries: DeliveryHistory[] = completedOrders
            .filter((o) => !existingIds.has(String(o.id)))
            .map((o) => ({
              ...mapApiOrder(o, driverId),
              status: 'completed' as const,
              completedAt: o.completedAt ?? o.updatedAt ?? new Date().toISOString(),
              rating: o.rating,
            }));
          return [...newEntries, ...prev];
        });
      }

      const localActiveOrder = activeOrderRef.current;
      const serverVersionOfLocal = localActiveOrder
        ? myOrders.find((order) => order.id === localActiveOrder.apiId)
        : undefined;
      const confirmedLocalStatus = serverVersionOfLocal
        ? mapApiStatus(serverVersionOfLocal.status)
        : null;
      const retainLocalDelivery = localActiveOrder
        ? shouldRetainActiveDelivery({
            localApiId: localActiveOrder.apiId,
            activeOrderIds: activeApiOrders.map((order) => order.id),
            serverStatus: serverVersionOfLocal?.status,
          })
        : false;

      if (activeApiOrders.length > 0) {
        const matchingLocalOrder = activeApiOrders.find(
          (order) => order.id === localActiveOrder?.apiId,
        );
        if (
          localActiveOrder &&
          serverVersionOfLocal &&
          (confirmedLocalStatus === 'completed' || confirmedLocalStatus === 'cancelled')
        ) {
          const terminalFromServer = mapApiOrder(serverVersionOfLocal, driverId);
          setTerminalOrder(mergeOrderWithServer(localActiveOrder, terminalFromServer));
        }
        // Another active order does not prove that this driver's local delivery
        // was replaced. Keep the local order until its own server record is
        // terminal; this also keeps an open order-detail route stable.
        if (localActiveOrder && retainLocalDelivery) {
          return;
        }
        const activeApiOrder = matchingLocalOrder ?? activeApiOrders[0];
        const mapped = mapApiOrder(activeApiOrder, driverId);
        let nextActiveOrder = mapped;
        if (localActiveOrder?.apiId === activeApiOrder.id) {
          confirmedActiveStatusRef.current = {
            orderId: localActiveOrder.id,
            status: mapped.status,
          };
          const apiStatusIdx = ACTIVE_STATUS_ORDER.indexOf(mapped.status);
          const localStatusIdx = ACTIVE_STATUS_ORDER.indexOf(localActiveOrder.status);
          nextActiveOrder = localStatusIdx >= apiStatusIdx
            ? localActiveOrder
            : mergeOrderWithServer(localActiveOrder, mapped);
        }
        activeOrderRef.current = nextActiveOrder;
        setActiveOrder(nextActiveOrder);
        setTerminalOrder((current) => (
          current?.apiId === nextActiveOrder.apiId ? null : current
        ));
        setStatusState('busy');
        setIncomingOrder(null);
      } else {
        // An empty, incomplete, or unfamiliar response is not confirmation that
        // an accepted delivery ended. Keep it visible until the API reports a
        // terminal status or a replacement active order.
        if (localActiveOrder && retainLocalDelivery) {
          return;
        }

        // Reset busy→online only after a terminal response, or when there is no
        // local delivery to preserve.
        if (statusRef.current === 'busy') {
          if (localActiveOrder && confirmedLocalStatus) {
            const terminalFromServer = mapApiOrder(serverVersionOfLocal!, driverId);
            setTerminalOrder(mergeOrderWithServer(localActiveOrder, terminalFromServer));
          }
          activeOrderRef.current = null;
          setStatusState('online');
          statusRef.current = 'online';
          setActiveOrder(null);
          // Persist online status to backend (fire-and-forget)
          api.updateDriver(driverId, { isAvailable: true }).catch((err) => {
            console.warn('[DriverContext] failed to persist online reset:', err);
          });
          return;
        }

        if (!isOnline) {
          setIncomingOrder((currentIncoming) => {
            if (currentIncoming) seenOrderIds.current.delete(currentIncoming.apiId);
            return null;
          });
          for (const queuedId of pendingQueueRef.current) {
            seenOrderIds.current.delete(queuedId);
          }
          pendingQueueRef.current = [];
          if (incomingTimerRef.current) {
            clearTimeout(incomingTimerRef.current);
            incomingTimerRef.current = null;
          }
          setIncomingOrder(null);
          return;
        }

        // ── Incoming orders ────────────────────────────────────────────────
        const pendingAssigned = myOrders.filter((o) =>
          INCOMING_STATUSES.includes(o.status?.trim().toLowerCase() ?? ''),
        );
        const allIncoming = [
          ...pendingAssigned.map((o) => o.id),
          ...available
            .filter((o) => {
              if (suppressedOfferIds.current.has(o.id)) return false;
              // Filter out available orders with unknown/terminal statuses
              const mapped = mapApiStatus(o.status);
              if (mapped === null || mapped === 'completed' || mapped === 'cancelled') return false;
              return true;
            })
            .map((o) => o.id),
        ];

        let enqueuedNew = false;
        for (const id of allIncoming) {
          if (!seenOrderIds.current.has(id)) {
            seenOrderIds.current.add(id);
            pendingQueueRef.current.push(id);
            enqueuedNew = true;

            // Pre-fetch full order details so coordinates are ready when alert shows
            if (!enrichedOrderCache.current.has(id) && driverId) {
              api.getOrder(id).then((full) => {
                const mapped = mapApiOrder(full, driverId);
                enrichedOrderCache.current.set(id, { ...mapped, status: 'incoming' });
                // If this order is currently being displayed, update it live
                setIncomingOrder((current) =>
                  current?.apiId === id ? { ...mapped, status: 'incoming' } : current,
                );
              }).catch(() => {/* non-critical */});
            }
          }
        }

        if (enqueuedNew || pendingQueueRef.current.length > 0) {
          setIncomingOrder((currentIncoming) => {
            if (currentIncoming) return currentIncoming;
            const next = popNextFromQueue(assigned, available);
            if (next) showOrderAlert(next);
            return next;
          });
        }

      }
      } catch (err) {
        console.warn('[DriverContext] pollOrders failed:', err);
        setIsApiConnected(false);
      } finally {
        pollInFlightRef.current = null;
      }
    })();
    pollInFlightRef.current = poll;
    return poll;
  }, [driverId, popNextFromQueue, showOrderAlert]);

  // ── SSE + fallback polling ───────────────────────────────────────────────────

  const getSsePayload = (event: SseEvent): Record<string, any> | null => {
    if (!event.data || typeof event.data !== 'object') return null;
    return event.data as Record<string, any>;
  };

  const getSseOrderId = (event: SseEvent): number | null => {
    const payload = getSsePayload(event);
    if (!payload) return null;
    const nested = (payload.order ?? payload.data ?? {}) as Record<string, any>;
    const value = payload.orderId ?? nested.orderId ?? nested.id;
    const id = Number(value);
    return Number.isFinite(id) && id > 0 ? id : null;
  };

  useEffect(() => {
    pollOrdersRef.current = pollOrders;
  }, [pollOrders]);

  useEffect(() => {
    if (!driverId) return;

    const sse = new JatekSse(
      () => api.getToken(),
      ['available_orders', `driver_orders:${driverId}`],
    );

    const unsubStatus = sse.onStatusChange(setIsSocketConnected);

    // On 401/403: token is invalid — stop reconnecting and log the driver out
    const unsubAuth = sse.onAuthError(() => {
      console.warn('[DriverContext] SSE auth error — token rejected by server, logging out');
      setIsSocketConnected(false);
      setIsApiConnected(false);
      // Logout clears the token and navigates to login via _layout.tsx
      logout().catch(() => {});
    });

    const unsubEvent = sse.onEvent((event) => {
      const orderId = getSseOrderId(event);

      if (event.type === 'order_ready') {
        pollOrdersRef.current();
        return;
      }

      if (!orderId) return;
      const payload = getSsePayload(event);
      const nested = (payload?.order ?? payload?.data ?? {}) as Record<string, any>;
      const assignedDriverId = Number(payload?.driverId ?? nested.driverId);
      const isMine = assignedDriverId === driverId;
      const isOfferRemoval = /assigned|accepted|taken|removed|unavailable|status/i.test(event.type);

      if (isOfferRemoval && !isMine) {
        lastAvailableOrdersRef.current = lastAvailableOrdersRef.current.filter(
          (order) => order.id !== orderId,
        );
        suppressedOfferIds.current.add(orderId);
        pendingQueueRef.current = pendingQueueRef.current.filter((id) => id !== orderId);
        enrichedOrderCache.current.delete(orderId);
        seenOrderIds.current.delete(orderId);
        setIncomingOrder((current) => {
          if (current?.apiId !== orderId) return current;
          if (incomingTimerRef.current) clearTimeout(incomingTimerRef.current);
          return null;
        });
      }

      pollOrdersRef.current();
    });

    const stopSse = sse.start();

    // Initial sync
    pollOrdersRef.current();

    fallbackPollRef.current = setInterval(() => pollOrdersRef.current(), FALLBACK_POLL_MS);

    return () => {
      clearInterval(fallbackPollRef.current!);
      unsubStatus();
      unsubAuth();
      unsubEvent();
      stopSse();
      setIsSocketConnected(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]); // intentionally only driverId — pollOrders accessed via pollOrdersRef

  // ── Order actions ────────────────────────────────────────────────────────────

  const acceptOrder = useCallback(async () => {
    if (!incomingOrder || !driverId) return;
    const orderToAccept = incomingOrder;
    const existingActiveOrder = activeOrderRef.current;

    if (existingActiveOrder || statusRef.current === 'busy') {
      if (incomingTimerRef.current) clearTimeout(incomingTimerRef.current);
      setIncomingOrder(null);
      Alert.alert(
        'Livreur déjà occupé',
        'Vous avez déjà une livraison en cours. Terminez-la avant d’en accepter une autre.',
      );
      return;
    }

    if (statusRef.current !== 'online') return;

    if (acceptingOrderIdRef.current === orderToAccept.apiId) return;
    acceptingOrderIdRef.current = orderToAccept.apiId;
    if (incomingTimerRef.current) clearTimeout(incomingTimerRef.current);

    setIncomingOrder(null);

    try {
      const accepted = await api.acceptDelivery(orderToAccept.apiId, Number(driverId));
      if (!accepted || typeof accepted !== 'object' || !Number.isFinite(Number(accepted.id))) {
        throw new Error('Réponse invalide du serveur lors de l\'acceptation.');
      }
      const mappedAccepted = mapApiOrder(accepted, driverId);
      enrichedOrderCache.current.delete(orderToAccept.apiId);
      lastAvailableOrdersRef.current = lastAvailableOrdersRef.current.filter(
        (order) => order.id !== orderToAccept.apiId,
      );
      pendingQueueRef.current = pendingQueueRef.current.filter((id) => id !== orderToAccept.apiId);
      activeOrderRef.current = mappedAccepted;
      setActiveOrder(mappedAccepted);
      setTerminalOrder(null);
      setStatusState('busy');
      statusRef.current = 'busy';
      api.updateDriver(driverId, { isAvailable: false }).catch((updateError) => {
        console.warn('[DriverContext] failed to persist busy status after accept:', updateError);
      });
    } catch (err) {
      console.warn('[DriverContext] acceptOrder API call failed:', err);
      const hasActiveDelivery = Boolean(existingActiveOrder || activeOrderRef.current);
      if (hasActiveDelivery) {
        if (existingActiveOrder) {
          activeOrderRef.current = existingActiveOrder;
          setActiveOrder(existingActiveOrder);
        }
        setStatusState('busy');
        statusRef.current = 'busy';
      } else {
        activeOrderRef.current = null;
        setActiveOrder(null);
        setStatusState('online');
        statusRef.current = 'online';
      }

      const status = err instanceof ApiError ? err.status : 0;
      const errorData = err instanceof ApiError && typeof err.data === 'object' && err.data
        ? err.data as Record<string, any>
        : null;

      lastAvailableOrdersRef.current = lastAvailableOrdersRef.current.filter(
        (order) => order.id !== orderToAccept.apiId,
      );
      pendingQueueRef.current = pendingQueueRef.current.filter((id) => id !== orderToAccept.apiId);
      enrichedOrderCache.current.delete(orderToAccept.apiId);
      seenOrderIds.current.delete(orderToAccept.apiId);

      if (status === 409 && (isDriverBusyConflict(err) || hasActiveDelivery)) {
        if (!hasActiveDelivery) {
          await pollOrdersRef.current();
        }
        suppressedOfferIds.current.add(orderToAccept.apiId);
        Alert.alert(
          'Livreur déjà occupé',
          'Vous avez déjà une livraison en cours. Terminez-la avant d’en accepter une autre.',
        );
      } else if (status === 409) {
        suppressedOfferIds.current.add(orderToAccept.apiId);
        Alert.alert(
          'Commande non disponible',
          'Désolé, cette commande a déjà été prise par un autre livreur.',
        );
        if (!hasActiveDelivery) {
          advanceQueueRef.current();
        }
      } else if (status === 412) {
        setStatusState('offline');
        statusRef.current = 'offline';
        suppressedOfferIds.current.add(orderToAccept.apiId);
        Alert.alert(
          'Profil incomplet',
          'Veuillez compléter vos informations de véhicule et pièces d\'identité pour accepter des livraisons.',
          [{ text: 'Compléter le profil', onPress: () => router.push('/complete-profile') }],
        );
      } else {
        Alert.alert(
          'Erreur',
          errorData?.error || (err instanceof Error
            ? err.message
            : 'Impossible d\'accepter la commande pour le moment.'),
        );
        advanceQueueRef.current();
      }
    } finally {
      acceptingOrderIdRef.current = null;
    }
  }, [incomingOrder, driverId]);

  const declineOrder = useCallback(() => {
    if (incomingTimerRef.current) clearTimeout(incomingTimerRef.current);
    if (incomingOrder) {
      seenOrderIds.current.delete(incomingOrder.apiId);
      enrichedOrderCache.current.delete(incomingOrder.apiId);
      api.updateOrderStatus(incomingOrder.apiId, 'rejected').catch(() => {});
    }
    advanceQueueRef.current();
  }, [incomingOrder]);

  const dismissIncoming = useCallback(() => {
    if (incomingTimerRef.current) clearTimeout(incomingTimerRef.current);
    if (incomingOrder) {
      seenOrderIds.current.delete(incomingOrder.apiId);
      enrichedOrderCache.current.delete(incomingOrder.apiId);
    }
    advanceQueueRef.current();
  }, [incomingOrder]);

  /**
   * Advance the active order's status. Returns a Promise so callers can await
   * and disable UI during the request (preventing duplicate transitions).
   */
  const updateOrderStatus = useCallback(async (id: string, newStatus: Order['status']): Promise<boolean> => {
    const currentOrder = activeOrderRef.current;
    const orderId = Number(id);
    if (
      !currentOrder ||
      currentOrder.id !== id ||
      !Number.isInteger(orderId) ||
      !driverId
    ) {
      Alert.alert('Mise à jour impossible', 'La commande active n’est plus disponible.');
      return false;
    }
    if (!isAllowedStatusTransition(currentOrder.status, newStatus)) {
      Alert.alert('Statut non valide', 'Cette étape de livraison ne peut pas être effectuée maintenant.');
      return false;
    }
    // Guard against concurrent in-flight transitions.
    if (isUpdatingStatusRef.current) return false;
    isUpdatingStatusRef.current = true;
    const requestVersion = ++statusUpdateVersionRef.current;
    latestStatusUpdateRef.current = { orderId: id, version: requestVersion };

    const previousOrder = currentOrder;
    const optimisticOrder = { ...previousOrder, status: newStatus };
    activeOrderRef.current = optimisticOrder;
    setActiveOrder(optimisticOrder);

    try {
      const updated = await api.updateOrderStatus(
        orderId,
        mapAppStatusToApi(newStatus),
        { driverId },
      );
      if (!isValidApiOrderResponse(updated, orderId)) {
        throw new Error('Réponse de statut invalide du serveur.');
      }
      const mappedUpdated = mapApiOrder(updated, driverId);
      const responseStatusIndex = ACTIVE_STATUS_ORDER.indexOf(mappedUpdated.status);
      const requestedStatusIndex = ACTIVE_STATUS_ORDER.indexOf(newStatus);
      const responseConfirmsTransition = (
        responseStatusIndex >= requestedStatusIndex &&
        requestedStatusIndex >= 0
      );
      const confirmedOrder = mergeOrderWithServer(previousOrder, mappedUpdated);
      const isTerminalResponse = (
        mappedUpdated.status === 'completed' ||
        mappedUpdated.status === 'cancelled'
      );
      if (isTerminalResponse) {
        if (mappedUpdated.status === 'completed') {
          setHistory((previousHistory) => (
            previousHistory.some((entry) => entry.id === confirmedOrder.id)
              ? previousHistory
              : [{
                ...confirmedOrder,
                status: 'completed' as const,
                completedAt: updated.completedAt ?? new Date().toISOString(),
                rating: updated.rating,
              }, ...previousHistory]
          ));
        }
        if (activeOrderRef.current?.id === id) {
          activeOrderRef.current = null;
          setActiveOrder(null);
          setTerminalOrder(confirmedOrder);
          setStatusState('online');
          statusRef.current = 'online';
          api.updateDriver(driverId, { isAvailable: true }).catch((updateError) => {
            console.warn('[DriverContext] failed to persist online after terminal status:', updateError);
          });
        }
        Alert.alert(
          mappedUpdated.status === 'completed' ? 'Livraison finalisée' : 'Commande annulée',
          mappedUpdated.status === 'completed'
            ? 'Le serveur a déjà confirmé la livraison.'
            : 'Le serveur a annulé cette commande.',
        );
        return mappedUpdated.status === 'completed';
      }
      if (activeOrderRef.current?.id === id) {
        confirmedActiveStatusRef.current = { orderId: id, status: mappedUpdated.status };
        activeOrderRef.current = confirmedOrder;
        setActiveOrder(confirmedOrder);
      }
      if (!responseConfirmsTransition) {
        Alert.alert(
          'Transition non confirmée',
          'Le serveur a conservé un statut différent. La commande a été synchronisée avec son état actuel.',
        );
      }
      return responseConfirmsTransition;
    } catch (err) {
      console.warn('[DriverContext] updateOrderStatus API call failed — rolling back:', err);
      // A timeout can happen after the server applied the transition. Reconcile
      // once before reverting, then only roll back this request's own optimistic
      // state if no server confirmation has superseded it.
      await pollOrdersRef.current();
      const confirmedStatus = confirmedActiveStatusRef.current;
      const shouldRollback = shouldRollbackOptimisticStatus({
        orderId: id,
        requestVersion,
        latestRequest: latestStatusUpdateRef.current ?? undefined,
        activeOrderId: activeOrderRef.current?.id,
        targetStatus: newStatus,
        confirmedStatus:
          confirmedStatus?.orderId === id ? confirmedStatus.status : undefined,
      });
      if (shouldRollback) {
        activeOrderRef.current = previousOrder;
        setActiveOrder(previousOrder);
      }
      if (!shouldRollback && confirmedStatus?.orderId === id) return true;
      const message = err instanceof ApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Vérifiez votre connexion puis réessayez.';
      Alert.alert('Mise à jour impossible', message);
      return false;
    } finally {
      isUpdatingStatusRef.current = false;
    }
  }, [driverId]);

  const validateOTP = useCallback(async (id: string, code: string): Promise<boolean> => {
    const currentOrder = activeOrderRef.current;
    if (!currentOrder || currentOrder.id !== id || isConfirmingDeliveryRef.current) return false;
    if (code.length !== 4 || !driverId) return false;

    isConfirmingDeliveryRef.current = true;
    const orderToComplete = currentOrder;
    try {
      const confirmed = await api.confirmDelivery(orderToComplete.apiId, code);
      if (
        !isValidApiOrderResponse(confirmed, orderToComplete.apiId) ||
        mapApiStatus(confirmed.status) !== 'completed'
      ) {
        throw new Error('La livraison n’a pas été confirmée par le serveur.');
      }

      const completed: DeliveryHistory = {
        ...orderToComplete,
        status: 'completed',
        completedAt: new Date().toISOString(),
        rating: 5,
      };

      setHistory((prev) => [completed, ...prev]);
      setTerminalOrder(completed);
      activeOrderRef.current = null;
      setActiveOrder((prev) => (
        prev?.apiId === orderToComplete.apiId ? null : prev
      ));
      setStatusState('online');
      statusRef.current = 'online';

      // Persist online status to backend so driver can receive new orders
      api.updateDriver(driverId, { isAvailable: true }).catch((err) => {
        console.warn('[DriverContext] failed to persist online after delivery:', err);
      });

      setEarnings((prev) => ({
        today: parseFloat((prev.today + orderToComplete.earnings).toFixed(2)),
        week: parseFloat((prev.week + orderToComplete.earnings).toFixed(2)),
        month: parseFloat((prev.month + orderToComplete.earnings).toFixed(2)),
      }));
      setStats((prev) => ({
        ...prev,
        deliveriesToday: prev.deliveriesToday + 1,
        deliveriesTotal: prev.deliveriesTotal + 1,
        kmToday: parseFloat((prev.kmToday + orderToComplete.distance).toFixed(1)),
      }));

      // Refresh server-calculated totals
      api.getEarnings(driverId).then((e) => {
        setEarnings({
          today: Number(e.today) || 0,
          week: Number(e.thisWeek) || 0,
          month: Number(e.thisMonth) || 0,
        });
        setStats((prev) => ({
          ...prev,
          deliveriesToday: e.completedToday,
          deliveriesTotal: e.totalDeliveries,
          level: getLevelFromDeliveries(e.totalDeliveries),
        }));
      }).catch(() => {});

      return true;
    } catch (err) {
      console.warn('[DriverContext] delivery completion failed:', err);
      Alert.alert(
        'Livraison non confirmée',
        'Impossible de confirmer la livraison. Vérifiez le code et votre connexion.',
      );
      return false;
    } finally {
      isConfirmingDeliveryRef.current = false;
    }
  }, [driverId]);

  const refreshEarnings = useCallback(() => {
    if (!driverId) return;
    api.getEarnings(driverId).then((e) => {
      setEarnings({
        today: Number(e.today) || 0,
        week: Number(e.thisWeek) || 0,
        month: Number(e.thisMonth) || 0,
      });
    }).catch(() => {});
  }, [driverId]);

  return (
    <DriverContext.Provider value={{
      status,
      setStatus,
      earnings,
      stats,
      profile,
      incomingOrder,
      activeOrder,
      terminalOrder,
      history,
      acceptOrder,
      declineOrder,
      updateOrderStatus,
      validateOTP,
      dismissIncoming,
      isApiConnected,
      isSocketConnected,
      lastSyncAt,
      refreshEarnings,
      refreshProfile,
    }}>
      {children}
    </DriverContext.Provider>
  );
}

export function useDriver() {
  const ctx = useContext(DriverContext);
  if (!ctx) throw new Error('useDriver must be used within DriverProvider');
  return ctx;
}
