/**
 * Singleton Socket.IO client for ma.jatek.app.
 *
 * NOTE: The backend at ma.jatek.app does not expose a working Socket.IO
 * endpoint — the reverse proxy intercepts all socket upgrade requests and
 * returns the frontend HTML instead.  The class below handles this gracefully:
 *   • It attempts to connect with a small number of retries.
 *   • After MAX_ATTEMPTS failures it stops retrying and sets `socketDisabled`.
 *   • All callers fall back to the polling path automatically.
 *
 * If the backend is ever fixed, remove the reconnectionAttempts cap and set
 * socketDisabled = false to re-enable real-time delivery.
 *
 * Connection lifecycle:
 *   jatekSocket.connect(token)   — call when the driver logs in / goes online
 *   jatekSocket.disconnect()     — call on logout or app unmount
 */

import { io, Socket } from 'socket.io-client';
import { BASE_URL } from './api';

type AnyCallback = (data?: unknown) => void;
type StatusCallback = (disabled: boolean) => void;

const MAX_ATTEMPTS = 3;

function looksLikeOrderEvent(event: string, data: unknown): boolean {
  if (/order|commande|deliver/i.test(event)) return true;
  if (!data || typeof data !== 'object') return false;
  const payload = data as Record<string, unknown>;
  // Backends commonly wrap the order in { order }, { data }, or emit the
  // order object directly. The reconciliation request filters by driverId.
  const candidate = payload.order ?? payload.data ?? payload;
  return Boolean(
    candidate &&
    typeof candidate === 'object' &&
    ('id' in (candidate as object)) &&
    ('status' in (candidate as object)),
  );
}

class JatekSocket {
  private socket: Socket | null = null;
  private orderCallbacks: Set<AnyCallback> = new Set();
  private reconnectCallbacks: Set<() => void> = new Set();
  private statusCallbacks: Set<StatusCallback> = new Set();
  private _socketDisabled = false;
  private attemptCount = 0;

  /** Open a persistent connection authenticated with `token`. */
  connect(token: string) {
    // If we already gave up, don't reconnect
    if (this._socketDisabled) return;

    // Already connected — nothing to do
    if (this.socket?.connected) return;

    // Tear down stale socket before creating a new one
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this.socket = io(BASE_URL, {
      // JWT sent via Socket.IO auth handshake only (not query string — avoids log exposure)
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      // Stop after MAX_ATTEMPTS failures to avoid infinite silent retries
      reconnectionAttempts: MAX_ATTEMPTS,
      timeout: 8000,
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected:', this.socket?.id);
      this.attemptCount = 0;
      // Re-sync orders immediately after every (re)connect
      this.reconnectCallbacks.forEach((cb) => cb());
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    this.socket.on('connect_error', (err) => {
      this.attemptCount += 1;
      console.log(
        `[Socket] connect_error (attempt ${this.attemptCount}/${MAX_ATTEMPTS}):`,
        err.message,
      );
    });

    this.socket.on('reconnect_failed', () => {
      console.warn(
        '[Socket] Permanently disabled after',
        MAX_ATTEMPTS,
        'failed attempts. Polling will be the only sync mechanism.',
      );
      this._socketDisabled = true;
      if (this.socket) {
        this.socket.removeAllListeners();
        this.socket.disconnect();
        this.socket = null;
      }
      this.statusCallbacks.forEach((cb) => cb(true));
    });

    // Use Socket.IO's catch-all listener instead of guessing the server's
    // event name. Only order-shaped events trigger reconciliation.
    this.socket.onAny((event: string, data?: unknown) => {
      if (!looksLikeOrderEvent(event, data)) return;
      console.log('[Socket] order event →', event);
      this.orderCallbacks.forEach((cb) => cb(data));
    });
  }

  /** Close the connection and clear all listeners. */
  disconnect() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.orderCallbacks.clear();
    this.reconnectCallbacks.clear();
    this.statusCallbacks.clear();
    // Reset disabled flag so a fresh login can try again
    this._socketDisabled = false;
    this.attemptCount = 0;
  }

  /**
   * Register a callback that fires whenever any order event arrives.
   * Returns an unsubscribe function.
   */
  onOrderEvent(cb: AnyCallback): () => void {
    this.orderCallbacks.add(cb);
    return () => this.orderCallbacks.delete(cb);
  }

  /**
   * Register a callback that fires on every (re)connect.
   * Use this to trigger a full order re-sync.
   * Returns an unsubscribe function.
   */
  onReconnect(cb: () => void): () => void {
    this.reconnectCallbacks.add(cb);
    return () => this.reconnectCallbacks.delete(cb);
  }

  /**
   * Register a callback that fires when the socket is permanently disabled
   * (all reconnection attempts exhausted).
   * Returns an unsubscribe function.
   */
  onStatusChange(cb: StatusCallback): () => void {
    this.statusCallbacks.add(cb);
    return () => this.statusCallbacks.delete(cb);
  }

  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /** True after MAX_ATTEMPTS failures — socket will not reconnect. */
  get socketDisabled(): boolean {
    return this._socketDisabled;
  }
}

export const jatekSocket = new JatekSocket();
