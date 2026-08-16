import { BASE_URL } from './api';

export type SseEvent = {
  type: string;
  data: unknown;
};

type SseEventHandler = (event: SseEvent) => void;
type SseStatusHandler = (connected: boolean) => void;

/**
 * Small authenticated SSE client for Expo web and native.
 *
 * EventSource cannot be used here because it does not allow an Authorization
 * header. XMLHttpRequest supports that header on both Expo web and native,
 * and exposes the growing response body through onprogress.
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
  private readonly eventHandlers = new Set<SseEventHandler>();
  private readonly statusHandlers = new Set<SseStatusHandler>();

  constructor(
    private readonly token: string,
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

  start() {
    this.stopped = false;
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
    xhr.setRequestHeader('Authorization', `Bearer ${this.token}`);
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
      if (xhr.readyState >= 2 && xhr.status >= 200 && xhr.status < 300) {
        this.setConnected(true);
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
      this.setConnected(false);
      this.scheduleReconnect();
    };
    xhr.ontimeout = () => {
      this.setConnected(false);
      this.scheduleReconnect();
    };
    xhr.send();
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
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, 2_000);
  }

  private setConnected(connected: boolean) {
    if (this.connected === connected) return;
    this.connected = connected;
    this.statusHandlers.forEach((handler) => handler(connected));
  }
}