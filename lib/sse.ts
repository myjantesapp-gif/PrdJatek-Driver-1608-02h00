import { BASE_URL } from './api';

export type SseEvent = {
  type: string;
  data: unknown;
};

type SseEventHandler = (event: SseEvent) => void;
type SseStatusHandler = (connected: boolean) => void;
type SseAuthErrorHandler = () => void;

/**
 * Small authenticated SSE client for Expo web and native.
 *
 * EventSource cannot be used here because it does not allow an Authorization
 * header. XMLHttpRequest supports that header on both Expo web and native,
 * and exposes the growing response body through onprogress.
 *
 * Reconnect uses exponential backoff (2 → 4 → 8 → 16 → 30 s max).
 * On 401/403 the client stops reconnecting and fires authError handlers
 * instead — the caller is expected to re-authenticate and recreate the client.
 *
 * The token is read fresh on every connection attempt via a getter function
 * so that a refreshed JWT is used automatically.
 */
export class JatekSse {
  private xhr: XMLHttpRequest | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private responseOffset = 0;
  private eventBuffer = '';
  private lastActivityAt = 0;
  private stopped = true;
  private connected = false;
  private retryCount = 0;
  private readonly eventHandlers = new Set<SseEventHandler>();
  private readonly statusHandlers = new Set<SseStatusHandler>();
  private readonly authErrorHandlers = new Set<SseAuthErrorHandler>();

  constructor(
    private readonly getToken: () => string | null,
    private readonly channels: string[],
  ) {}

  onEvent(handler: SseEventHandler) {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  onStatusChange(handler: SseStatusHandler) {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  /** Called when the server returns 401 or 403 — token is invalid/expired. */
  onAuthError(handler: SseAuthErrorHandler) {
    this.authErrorHandlers.add(handler);
    return () => this.authErrorHandlers.delete(handler);
  }

  start() {
    // Guard against double-start creating duplicate XHR/timers
    if (!this.stopped) this.stop();
    this.stopped = false;
    this.retryCount = 0;
    this.lastActivityAt = Date.now();
    this.open();
    this.heartbeatTimer = setInterval(() => {
      if (!this.stopped && Date.now() - this.lastActivityAt > 60_000) {
        this.restart();
      }
    }, 15_000);
    return () => this.stop();
  }

  stop() {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.setConnected(false);
    this.xhr?.abort();
    this.xhr = null;
    this.responseOffset = 0;
    this.eventBuffer = '';
  }

  private open() {
    if (this.stopped) return;

    // Read token fresh so a refreshed JWT is used on every reconnect
    const token = this.getToken();
    if (!token) {
      // No token yet — wait and retry
      this.scheduleReconnect();
      return;
    }

    const xhr = new XMLHttpRequest();
    this.xhr = xhr;
    this.responseOffset = 0;
    this.eventBuffer = '';
    this.lastActivityAt = Date.now();

    xhr.open(
      'GET',
      `${BASE_URL}/api/events?channels=${encodeURIComponent(this.channels.join(','))}`,
      true,
    );
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Accept', 'text/event-stream');
    xhr.setRequestHeader('Cache-Control', 'no-cache');

    const consumeResponse = () => {
      if (this.stopped || this.xhr !== xhr) return;
      const responseText = xhr.responseText ?? '';
      if (responseText.length <= this.responseOffset) return;
      this.eventBuffer += responseText.slice(this.responseOffset);
      this.responseOffset = responseText.length;
      this.lastActivityAt = Date.now();
      this.consumeEvents();
    };

    xhr.onreadystatechange = () => {
      if (this.stopped || this.xhr !== xhr) return;

      if (xhr.readyState >= 2 && xhr.status >= 200 && xhr.status < 300) {
        this.retryCount = 0; // Reset backoff on successful connection
        this.setConnected(true);
      } else if (xhr.readyState >= 2 && (xhr.status === 401 || xhr.status === 403)) {
        // Auth error — stop reconnecting and notify the caller to re-authenticate
        this.setConnected(false);
        this.stopped = true; // Prevent scheduleReconnect from firing
        this.authErrorHandlers.forEach((h) => h());
        return;
      } else if (xhr.readyState >= 2 && xhr.status >= 400) {
        this.setConnected(false);
      }

      if (xhr.readyState === 3) consumeResponse();
      if (xhr.readyState === 4) {
        consumeResponse();
        this.setConnected(false);
        this.scheduleReconnect();
      }
    };
    xhr.onprogress = consumeResponse;
    xhr.onerror = () => {
      if (this.stopped || this.xhr !== xhr) return;
      this.setConnected(false);
      this.scheduleReconnect();
    };
    xhr.ontimeout = () => {
      if (this.stopped || this.xhr !== xhr) return;
      this.setConnected(false);
      this.scheduleReconnect();
    };
    try {
      xhr.send();
    } catch (err) {
      // xhr.send() can throw synchronously on some platforms
      this.setConnected(false);
      this.scheduleReconnect();
    }
  }

  private consumeEvents() {
    const records = this.eventBuffer.split(/\r?\n\r?\n/);
    this.eventBuffer = records.pop() ?? '';

    for (const record of records) {
      let type = 'message';
      const dataLines: string[] = [];
      for (const line of record.split(/\r?\n/)) {
        if (line.startsWith('event:')) {
          type = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trimStart());
        }
      }
      if (dataLines.length === 0) continue;

      const rawData = dataLines.join('\n');
      let data: unknown = rawData;
      try {
        data = JSON.parse(rawData);
      } catch {
        // Keep non-JSON SSE data as a string.
      }
      this.eventHandlers.forEach((handler) => handler({ type, data }));
    }
  }

  private restart() {
    if (this.stopped) return;
    this.xhr?.abort();
    this.xhr = null;
    this.setConnected(false);
    this.scheduleReconnect();
  }

  private scheduleReconnect() {
    if (this.stopped || this.reconnectTimer) return;
    // Exponential backoff: 2 s → 4 s → 8 s → 16 s → 30 s (max)
    const delay = Math.min(2_000 * Math.pow(2, this.retryCount), 30_000);
    this.retryCount = Math.min(this.retryCount + 1, 10); // Cap to avoid overflow
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, delay);
  }

  private setConnected(connected: boolean) {
    if (this.connected === connected) return;
    this.connected = connected;
    this.statusHandlers.forEach((handler) => handler(connected));
  }
}
