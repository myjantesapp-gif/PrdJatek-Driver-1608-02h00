import AsyncStorage from '@react-native-async-storage/async-storage';

export const BASE_URL = 'https://ma.jatek.app';

// ─── Response types ───────────────────────────────────────────────────────────

export interface LoginResponse {
  token: string;
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
    phone: string;
    address: string | null;
    avatarUrl: string | null;
    isActive: boolean;
  };
}

export interface ApiDriverProfile {
  id: number;
  userId: number;
  name: string;
  phone: string;
  vehicleType: string;
  vehiclePlate: string;
  nationalId: string;
  licenseNumber: string;
  photoUrl: string | null;
  isAvailable: boolean;
  totalDeliveries: number;
  rating: number | null;
  latitude: number | null;
  longitude: number | null;
  locationUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiOrderItem {
  id?: number;
  name?: string;
  menuItemName?: string;
  quantity: number;
  price?: number;
  unitPrice?: number;
  productId?: number;
}

export interface ApiOrder {
  id: number;
  status: string;
  driverId: number | null;
  assignedDriverId?: number | null;
  shopId?: number | null;
  userId?: number | null;
  customerId?: number | null;
  reference?: string;
  restaurantName?: string;
  userName?: string;
  total?: number;
  deliveryFee?: number;
  tip?: number;
  otp?: string;
  deliveryCode?: string;
  kitchenCode?: string | null;
  pickupCode?: string | null;
  items?: ApiOrderItem[];
  orderItems?: ApiOrderItem[];
  shop?: {
    id: number;
    name: string;
    address: string;
    phone?: string;
    latitude?: number;
    longitude?: number;
    lat?: number;
    lng?: number;
  };
  restaurant?: {
    id?: number;
    name: string;
    address: string;
    phone?: string;
    latitude?: number;
    longitude?: number;
    lat?: number;
    lng?: number;
  };
  customer?: {
    id?: number;
    name: string;
    phone?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    lat?: number;
    lng?: number;
  };
  user?: {
    id?: number;
    name: string;
    phone?: string;
    address?: string;
  };
  deliveryAddress?: string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
  estimatedPickupTime?: number;
  estimatedDeliveryTime?: number;
  distance?: number;
  rating?: number;
}

export interface ApiEarnings {
  today: number;
  thisWeek: number;
  thisMonth: number;
  totalDeliveries: number;
  completedToday: number;
}

export interface ApiNotificationsResponse {
  notifications: Array<{
    id: number;
    title: string;
    body: string;
    read: boolean;
    createdAt: string;
  }>;
  unreadCount: number;
}

export interface ApiLocationResponse {
  latitude: number;
  longitude: number;
  locationUpdatedAt: string;
  eta: number | null;
  activeOrderIds: number[];
}

/**
 * Simplified order shape returned by GET /api/orders/available.
 * Fields differ from ApiOrder — notably items use menuItemName/unitPrice.
 */
export interface ApiAvailableOrder {
  id: number;
  reference?: string;
  restaurantId?: number;
  restaurantName?: string;
  userName?: string;
  userId?: number;
  deliveryAddress?: string;
  total?: number;
  subtotal?: number;
  deliveryFee?: number;
  estimatedDeliveryTime?: number;
  status: string;
  createdAt: string;
  updatedAt?: string;
  kitchenCode?: string | null;
  pickupCode?: string | null;
  driverId?: number | null;
  items?: Array<{
    id?: number;
    menuItemName?: string;
    name?: string;
    quantity: number;
    unitPrice?: number;
    price?: number;
    totalPrice?: number;
  }>;
}

// ─── API client ───────────────────────────────────────────────────────────────

class JatekApi {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  getToken() {
    return this.token;
  }

  private async request<T>(
    path: string,
    options?: RequestInit,
    expectJson = true,
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    // Abort after 20 s so requests never hang forever
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20_000);

    let res: Response;
    try {
      res = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: { ...headers, ...(options?.headers as Record<string, string> | undefined) },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!expectJson) {
      // Still check HTTP status for no-body requests so callers can catch failures.
      if (!res.ok) {
        throw new ApiError(`HTTP ${res.status}`, res.status, null);
      }
      return {} as T;
    }

    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Non-JSON response: ${text.slice(0, 200)}`);
    }

    if (!res.ok) {
      const message = data?.error || data?.message || `HTTP ${res.status}`;
      throw new ApiError(message, res.status, data);
    }

    return data as T;
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  async login(email: string, password: string): Promise<LoginResponse> {
    return this.request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    return this.request<void>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  // ── Drivers ───────────────────────────────────────────────────────────────

  async listDrivers(): Promise<ApiDriverProfile[]> {
    return this.request<ApiDriverProfile[]>('/api/drivers');
  }

  async getDriver(id: number): Promise<ApiDriverProfile> {
    return this.request<ApiDriverProfile>(`/api/drivers/${id}`);
  }

  async updateDriver(
    id: number,
    data: Partial<Pick<ApiDriverProfile, 'isAvailable'>>,
  ): Promise<ApiDriverProfile> {
    return this.request<ApiDriverProfile>(`/api/drivers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async completeDriverProfile(
    id: number,
    data: {
      vehicleType: string;
      vehiclePlate: string;
      nationalId: string;
      licenseNumber?: string;
      photoUrl?: string;
    },
  ): Promise<ApiDriverProfile> {
    return this.request<ApiDriverProfile>(`/api/drivers/${id}/complete-profile`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateLocation(
    id: number,
    latitude: number,
    longitude: number,
  ): Promise<ApiLocationResponse> {
    return this.request<ApiLocationResponse>(`/api/drivers/${id}/location`, {
      method: 'PATCH',
      body: JSON.stringify({ latitude, longitude }),
    });
  }

  async getEarnings(id: number): Promise<ApiEarnings> {
    return this.request<ApiEarnings>(`/api/drivers/${id}/earnings`);
  }

  // ── Orders ────────────────────────────────────────────────────────────────

  async getOrders(params?: Record<string, string>): Promise<ApiOrder[]> {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<ApiOrder[]>(`/api/orders${qs}`);
  }

  /** Orders visible to all available drivers — pending pickup, not yet assigned. */
  async getAvailableOrders(): Promise<ApiAvailableOrder[]> {
    return this.request<ApiAvailableOrder[]>('/api/orders/available');
  }

  /**
   * Atomically assigns an available order to this driver.
   * The backend returns 409 when another driver won the race and 412 when
   * the driver's mandatory profile is incomplete.
   */
  async acceptDelivery(orderId: number, driverId: number): Promise<ApiOrder> {
    return this.request<ApiOrder>(`/api/orders/${orderId}/accept-delivery`, {
      method: 'POST',
      body: JSON.stringify({ driverId }),
    });
  }

  async getOrder(id: number): Promise<ApiOrder> {
    return this.request<ApiOrder>(`/api/orders/${id}`);
  }

  async updateOrderStatus(orderId: number, status: string, extra?: Record<string, unknown>): Promise<ApiOrder> {
    return this.request<ApiOrder>(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, ...extra }),
    });
  }

  /** Finalizes delivery with the customer's 4-digit pickup code. */
  async confirmDelivery(orderId: number, pickupCode: string): Promise<ApiOrder> {
    return this.request<ApiOrder>(`/api/orders/${orderId}/confirm-delivery`, {
      method: 'POST',
      body: JSON.stringify({ pickupCode }),
    });
  }

  // ── Notifications ─────────────────────────────────────────────────────────

  async getNotifications(): Promise<ApiNotificationsResponse> {
    return this.request<ApiNotificationsResponse>('/api/notifications');
  }

  /**
   * Mark a single notification as read.
   * Tries the dedicated /read endpoint first; falls back to a PATCH with body.
   * Propagates an error if both attempts fail so callers can roll back UI state.
   */
  async markNotificationRead(id: number): Promise<void> {
    try {
      // Primary: PATCH /api/notifications/:id/read (no body)
      await this.request<void>(`/api/notifications/${id}/read`, { method: 'PATCH' }, false);
      return; // success — stop here
    } catch {
      // Primary failed — fall through to alternate
    }
    // Fallback: PATCH with JSON body; let this throw if it also fails
    await this.request<void>(`/api/notifications/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ read: true }),
    }, false);
  }
}

export const api = new JatekApi();

export class ApiError extends Error {
  readonly status: number;
  readonly data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

export const AUTH_TOKEN_KEY = '@jatek_auth_token';
export const AUTH_USER_KEY = '@jatek_auth_user';
export const AUTH_DRIVER_ID_KEY = '@jatek_driver_id';

export async function saveAuth(token: string, userId: number, driverId: number) {
  await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
  await AsyncStorage.setItem(AUTH_USER_KEY, String(userId));
  await AsyncStorage.setItem(AUTH_DRIVER_ID_KEY, String(driverId));
}

export async function loadAuth(): Promise<{ token: string; userId: number; driverId: number } | null> {
  const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  const userId = await AsyncStorage.getItem(AUTH_USER_KEY);
  const driverId = await AsyncStorage.getItem(AUTH_DRIVER_ID_KEY);
  if (!token || !userId || !driverId) return null;
  const uid = Number(userId);
  const did = Number(driverId);
  // Guard against corrupted storage that would produce NaN IDs
  if (!Number.isFinite(uid) || uid <= 0 || !Number.isFinite(did) || did <= 0) return null;
  return { token, userId: uid, driverId: did };
}

export async function clearAuth() {
  await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
  await AsyncStorage.removeItem(AUTH_USER_KEY);
  await AsyncStorage.removeItem(AUTH_DRIVER_ID_KEY);
}
