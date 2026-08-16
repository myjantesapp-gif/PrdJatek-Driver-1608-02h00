import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { api, ApiDriverProfile, ApiOrder, ApiAvailableOrder, ApiEarnings, ApiError } from '@/lib/api';
import { JatekSse, SseEvent } from '@/lib/sse';
import { configureNotifications, notifyNewOrder } from '@/lib/notifications';
import { useAuth } from '@/context/AuthContext';

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
  status: 'incoming' | 'accepted' | 'at_restaurant' | 'picked_up' | 'delivering' | 'completed' | 'cancelled';
  createdAt: string;
  completedAt?: string;
  tip: number;
}

export interface DeliveryHistory extends Order {
  rating?: number;
  completedAt: string;
}

// Map API status → app status
function mapApiStatus(apiStatus: string): Order['status'] {
  // Normalize: trim whitespace and lowercase
  const s = apiStatus?.trim().toLowerCase() ?? '';
  switch (s) {
    case 'pending':
    case 'assigned':          return 'incoming';
    case 'accepted':          return 'accepted';
    case 'at_restaurant':
    case 'ready_for_pickup':
    case 'preparing':
    case 'ready':             return 'at_restaurant';
    case 'picked_up':
    case 'pickedup':          return 'picked_up';
    case 'en_route':
    case 'delivering':
    case 'in_progress':
    case 'out_for_delivery':
    case 'on_the_way':        return 'delivering';
    case 'delivered':
    case 'completed':         return 'completed';
    case 'cancelled':
    case 'canceled':          return 'cancelled';
    default:                  return 'incoming';
  }
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

  return {
    id: String(apiOrder.id),
    apiId: apiOrder.id,
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
    status: mapApiStatus(apiOrder.status),
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
  history: DeliveryHistory[];
  acceptOrder: () => Promise<void>;
  declineOrder: () => void;
  updateOrderStatus: (id: string, status: Order['status']) => void;
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
  const { user } = useAuth();
  const driverId = user?.driverId ?? null;

  const [status, setStatusState] = useState<DriverStatus>('offline');
  const [incomingOrder, setIncomingOrder] = useState<Order | null>(null);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
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
  const incomingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAvailableOrdersRef = useRef<ApiAvailableOrder[]>([]);
  /** Pre-fetched full order data for available-queue entries (coordinates enriched). */
  const enrichedOrderCache = useRef<Map<number, Order>>(new Map());
  /**
   * Offers removed because the server already assigned them elsewhere (409/SSE)
   * or because the driver's profile is not eligible (412).
   *
   * The available-orders endpoint can briefly return a stale snapshot after an
   * atomic assignment. Keeping these IDs suppressed until they disappear from
   * the endpoint prevents the same offer from being shown again immediately.
   */
  const suppressedOfferIds = useRef<Set<number>>(new Set());
  const driverLocationRef = useRef<DriverCoordinates | null>(null);
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const locationRequestInFlightRef = useRef(false);
  const locationPermissionRef = useRef<'unknown' | 'granted' | 'denied'>('unknown');
  const acceptingOrderIdRef = useRef<number | null>(null);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Reset seen-order tracking whenever the driver identity changes (login/logout)
  // so that reassigned orders surface again on a fresh session.
  useEffect(() => {
    seenOrderIds.current.clear();
    pendingQueueRef.current = [];
    enrichedOrderCache.current.clear();
    suppressedOfferIds.current.clear();
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

    // Ask for push permission by default for an authenticated driver.
    // Web is a no-op; native devices receive order alerts in foreground.
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

  // ── Persist & sync status ────────────────────────────────────────────────────

  // Version counter prevents a stale request from rolling back a newer status change
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
        // Only roll back if no newer call has already changed the status
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
        // Location services and permissions are optional; do not interrupt the
        // driver session when the device cannot provide a position.
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

    // Sync once immediately, then every 10 seconds while active.
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

  // Statuses that mean "newly assigned, needs driver acceptance" — must go
  // through the incoming-alert flow, not be treated as active in-progress orders.
  const INCOMING_STATUSES = ['pending', 'assigned'];
  // Statuses that represent a terminal / done state
  const TERMINAL_STATUSES = ['delivered', 'completed', 'cancelled', 'canceled'];

  /** Cache of the last successful API response — used by action handlers to
   *  immediately advance the queue without waiting for the next polling cycle. */
  const lastOrdersRef = useRef<ApiOrder[]>([]);

  /**
   * Pop the next valid pending order from `pendingQueueRef` and return it as a
   * mapped Order, or null if the queue is empty / all entries are stale.
   * Checks both the assigned-orders cache and the available-orders cache.
   * Uses the enrichedOrderCache for coordinates when available.
   * Mutates pendingQueueRef in place.
   */
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

        // Order no longer in either list — skip (already assigned to someone else)
      }
      return null;
    },
    [driverId],
  );

  /**
   * Display `order` as an incoming alert, start its 25-second auto-expire
   * timer, and fire the push notification.
   *
   * When the timer fires the order is treated as a missed/expired alert:
   *   • its ID is removed from seenOrderIds so reassignment makes it reappear
   *   • the next queued order (if any) is shown immediately
   *
   * `showOrderAlert` is defined without useCallback so we can reference itself
   * recursively through the advanceQueueRef without stale closure issues.
   */
  const advanceQueueRef = useRef<() => void>(() => {});

  const showOrderAlert = useCallback((order: Order) => {
    setIncomingOrder(order);
    notifyNewOrder({
      restaurantName: order.restaurant.name,
      earnings: order.earnings,
    }).catch(() => {});

    if (incomingTimerRef.current) clearTimeout(incomingTimerRef.current);
    incomingTimerRef.current = setTimeout(() => {
      // Auto-expired — remove from seen so reassignment can reappear
      seenOrderIds.current.delete(order.apiId);
      // Immediately advance to next queued order (if any)
      advanceQueueRef.current();
    }, 25000);
  }, []);

  // Keep the ref in sync with the latest orders cache so the timer callback
  // always uses fresh data without needing to recreate the timer.
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

  // Stable ref so the SSE useEffect closure always calls the latest version
  // of pollOrders without needing to be in the effect's dependency array.
  const pollOrdersRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const pollOrders = useCallback(async () => {
    if (!driverId) return;
    try {
      const currentStatus = statusRef.current;
      const isOnline = currentStatus === 'online';
      // Assigned orders are still reconciled while offline so an existing
      // delivery cannot become stale. Unassigned offers, however, must only
      // be fetched and queued for an online driver.
      const [assignedResult, availableResult] = await Promise.allSettled([
        api.getOrders(),
        isOnline ? api.getAvailableOrders() : Promise.resolve([] as ApiAvailableOrder[]),
      ]);

      const assigned: ApiOrder[] = assignedResult.status === 'fulfilled' ? assignedResult.value : lastOrdersRef.current;
      const available: ApiAvailableOrder[] = availableResult.status === 'fulfilled' ? availableResult.value : lastAvailableOrdersRef.current;

      setLastSyncAt(new Date());
      setIsApiConnected(true);

      // Cache for immediate use by action handlers
      lastOrdersRef.current = assigned;
      lastAvailableOrdersRef.current = available;

       // A successful reconciliation makes a previously suppressed offer safe
       // to show again only after it has actually disappeared server-side.
       const visibleAvailableIds = new Set(available.map((order) => order.id));
       suppressedOfferIds.current.forEach((id) => {
         if (!visibleAvailableIds.has(id)) suppressedOfferIds.current.delete(id);
       });

      // My explicitly assigned orders (backend already filters by JWT,
      // but also guard client-side in case backend returns more)
      const myOrders = assigned.filter(
        (o) => o.driverId === driverId || o.assignedDriverId === driverId,
      );

      // ── Active in-progress orders (assigned to me, not terminal) ──────────
      const activeApiOrders = myOrders.filter((o) => {
        const s = o.status?.trim().toLowerCase() ?? '';
        return s && !INCOMING_STATUSES.includes(s) && !TERMINAL_STATUSES.includes(s);
      });

      if (activeApiOrders.length > 0) {
        const activeApiOrder = activeApiOrders[0];
        const mapped = mapApiOrder(activeApiOrder, driverId);
        setActiveOrder((prev) => {
          if (prev && prev.apiId === activeApiOrder.id) {
            const statusOrder = ['accepted', 'at_restaurant', 'picked_up', 'delivering'];
            const apiStatusIdx = statusOrder.indexOf(mapped.status);
            const localStatusIdx = statusOrder.indexOf(prev.status);
            if (localStatusIdx >= apiStatusIdx) return prev;
          }
          return mapped;
        });
        setStatusState('busy');
        setIncomingOrder(null);
      } else {
        // ── BUG FIX: status stuck at 'busy' after delivery completes ──────────
        // When the server no longer has an active order for this driver but the
        // local status is still 'busy', the driver was in the middle of a
        // delivery that has now finished (or was cancelled server-side). Reset
        // to 'online' so the next poll cycle fetches available orders again.
        if (statusRef.current === 'busy') {
          setStatusState('online');
          statusRef.current = 'online';
          setActiveOrder(null);
          // Return now — the next 3-second poll will fetch available orders
          // with the corrected 'online' status.
          return;
        }

        if (!isOnline) {
          // Deliberately offline — do not retain offers. Remove their IDs so
          // they can be offered again after the driver comes back online.
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
        // 1. Pending/assigned orders explicitly assigned to this driver
        const pendingAssigned = myOrders.filter((o) =>
          INCOMING_STATUSES.includes(o.status?.trim().toLowerCase() ?? ''),
        );
        // 2. Available orders visible to all drivers (unassigned, ready for pickup)
        const allIncoming = [
          ...pendingAssigned.map((o) => o.id),
          ...available
            .filter((o) => !suppressedOfferIds.current.has(o.id))
            .map((o) => o.id),
        ];

        let enqueuedNew = false;
        for (const id of allIncoming) {
          if (!seenOrderIds.current.has(id)) {
            seenOrderIds.current.add(id);
            pendingQueueRef.current.push(id);
            enqueuedNew = true;

            // Pre-fetch full order details for available-queue entries so that
            // restaurant/customer coordinates are ready before the alert shows.
            if (!enrichedOrderCache.current.has(id) && driverId) {
              api.getOrder(id).then((full) => {
                const mapped = mapApiOrder(full, driverId);
                enrichedOrderCache.current.set(id, { ...mapped, status: 'incoming' });
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

        // ── Completed orders → history ─────────────────────────────────────
        const completedOrders = myOrders.filter((o) => {
          const s = o.status?.trim().toLowerCase() ?? '';
          return s === 'delivered' || s === 'completed';
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
      }
    } catch (err) {
      console.warn('[DriverContext] pollOrders failed:', err);
      setIsApiConnected(false);
    }
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

  // Keep the ref in sync so the SSE closure always calls the latest pollOrders
  // without causing the SSE effect to tear down and rebuild.
  useEffect(() => {
    pollOrdersRef.current = pollOrders;
  }, [pollOrders]);

  useEffect(() => {
    if (!driverId) return;

    // Pass a getter so every reconnect attempt uses the freshest token
    const sse = new JatekSse(
      () => api.getToken(),
      ['available_orders', `driver_orders:${driverId}`],
    );

    const unsubStatus = sse.onStatusChange(setIsSocketConnected);

    // On 401/403 the token is invalid — log out and stop reconnecting
    const unsubAuth = sse.onAuthError(() => {
      console.warn('[DriverContext] SSE auth error — token rejected by server');
      // The API layer will also start failing; the user will see "API non connectée"
      // and can re-login from the profile screen.
      setIsSocketConnected(false);
    });

    const unsubEvent = sse.onEvent((event) => {
      const orderId = getSseOrderId(event);

      if (event.type === 'order_ready') {
        // order_ready is intentionally small; reconcile through the available
        // endpoint so the alert receives the correct flat order shape.
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

      // Reconcile authoritative status and assigned-order details.
      pollOrdersRef.current();
    });

    const stopSse = sse.start();

    // Initial sync
    pollOrdersRef.current();

    // Polling remains a safety net for missed SSE frames and app backgrounding.
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
  }, [driverId]); // intentionally only driverId — pollOrders is accessed via pollOrdersRef

  // ── Order actions ────────────────────────────────────────────────────────────

  const acceptOrder = useCallback(async () => {
    if (!incomingOrder || !driverId || statusRef.current !== 'online') return;
    const orderToAccept = incomingOrder;
    if (acceptingOrderIdRef.current === orderToAccept.apiId) return;
    acceptingOrderIdRef.current = orderToAccept.apiId;
    if (incomingTimerRef.current) clearTimeout(incomingTimerRef.current);

    // Never create an active order before the server confirms the atomic
    // assignment. A 409 must not render or navigate with unauthorized data.
    setIncomingOrder(null);

    try {
      const accepted = await api.acceptDelivery(orderToAccept.apiId, Number(driverId));
       if (!accepted || typeof accepted !== 'object' || !Number.isFinite(Number(accepted.id))) {
         throw new Error('Réponse invalide du serveur lors de l’acceptation.');
       }
      const mappedAccepted = mapApiOrder(accepted, driverId);
      enrichedOrderCache.current.delete(orderToAccept.apiId);
      lastAvailableOrdersRef.current = lastAvailableOrdersRef.current.filter(
        (order) => order.id !== orderToAccept.apiId,
      );
      pendingQueueRef.current = pendingQueueRef.current.filter((id) => id !== orderToAccept.apiId);
      setActiveOrder(mappedAccepted);
      setStatusState('busy');
    } catch (err) {
      console.warn('[DriverContext] acceptOrder API call failed:', err);
      setActiveOrder(null);
      setStatusState('online');

      const status = err instanceof ApiError ? err.status : 0;
      const errorData = err instanceof ApiError && typeof err.data === 'object' && err.data
        ? err.data as Record<string, any>
        : null;

      // Remove the stale offer from every local queue before displaying the
      // error. This prevents the next poll from immediately showing it again.
      lastAvailableOrdersRef.current = lastAvailableOrdersRef.current.filter(
        (order) => order.id !== orderToAccept.apiId,
      );
      pendingQueueRef.current = pendingQueueRef.current.filter((id) => id !== orderToAccept.apiId);
      enrichedOrderCache.current.delete(orderToAccept.apiId);
      seenOrderIds.current.delete(orderToAccept.apiId);

      if (status === 409) {
         suppressedOfferIds.current.add(orderToAccept.apiId);
        Alert.alert(
          'Commande non disponible',
          'Désolé, cette commande a déjà été prise par un autre livreur.',
        );
        advanceQueueRef.current();
      } else if (status === 412) {
        setStatusState('offline');
         statusRef.current = 'offline';
         suppressedOfferIds.current.add(orderToAccept.apiId);
        Alert.alert(
          'Profil incomplet',
          'Veuillez compléter vos informations de véhicule et pièces d’identité pour accepter des livraisons.',
          [{ text: 'Compléter le profil', onPress: () => router.push('/complete-profile') }],
        );
      } else {
        Alert.alert(
          'Erreur',
          errorData?.error || (err instanceof Error
            ? err.message
            : 'Impossible d’accepter la commande pour le moment.'),
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
      // Remove from seen set so the order can reappear if reassigned later
      seenOrderIds.current.delete(incomingOrder.apiId);
      enrichedOrderCache.current.delete(incomingOrder.apiId);
      // Notify backend so it can reassign — fire-and-forget, non-blocking
      api.updateOrderStatus(incomingOrder.apiId, 'rejected').catch(() => {
        // Backend may not support 'rejected'; silently ignore
      });
    }
    // Immediately show the next queued order (or clear if none)
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

  const updateOrderStatus = useCallback(async (id: string, newStatus: Order['status']) => {
    let previousStatus: Order['status'] | null = null;
    setActiveOrder((prev) => {
      if (!prev || prev.id !== id) return prev;
      previousStatus = prev.status;
      return { ...prev, status: newStatus };
    });
    const orderId = parseInt(id, 10);
    if (!isNaN(orderId) && driverId) {
      try {
        const updated = await api.updateOrderStatus(
          orderId,
          mapAppStatusToApi(newStatus),
          { driverId },
        );
        const mappedUpdated = mapApiOrder(updated, driverId);
        setActiveOrder((prev) => (
          prev?.id === id
            ? { ...prev, status: mappedUpdated.status }
            : prev
        ));
      } catch (err) {
        console.warn('[DriverContext] updateOrderStatus API call failed — rolling back:', err);
        if (previousStatus !== null) {
          const rolledBack = previousStatus;
          setActiveOrder((prev) => {
            if (!prev || prev.id !== id) return prev;
            return { ...prev, status: rolledBack };
          });
        }
        Alert.alert('Mise à jour impossible, vérifiez votre connexion');
      }
    }
  }, [driverId]);

  const validateOTP = useCallback(async (id: string, code: string): Promise<boolean> => {
    if (!activeOrder || activeOrder.id !== id) return false;
    if (code.length !== 4 || !driverId) return false;

    const orderToComplete = activeOrder;
    try {
      // The backend is authoritative for OTP validation. Do not clear the
      // active order or update earnings until this request succeeds.
      await api.confirmDelivery(orderToComplete.apiId, code);

      const completed: DeliveryHistory = {
        ...orderToComplete,
        status: 'completed',
        completedAt: new Date().toISOString(),
        rating: 5,
      };

      setHistory((prev) => [completed, ...prev]);
      setActiveOrder((prev) => (
        prev?.apiId === orderToComplete.apiId ? null : prev
      ));
      setStatusState('online');

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

      // Refresh server-calculated totals after the optimistic local update.
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
    }
  }, [activeOrder, driverId]);

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
