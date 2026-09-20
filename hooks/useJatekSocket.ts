import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { io, type ManagerOptions, type Socket, type SocketOptions } from 'socket.io-client';
import { api, getApiBaseUrl, loadAuth } from '@/lib/api';

export type SocketConnectionState =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

export type JatekSocketEvent = {
  name: string;
  data: unknown;
};

export interface UseJatekSocketOptions {
  /** Keep the connection disabled while the driver is logged out. */
  enabled?: boolean;
  /** Socket.IO server origin. Defaults to the Jatek API origin. */
  url?: string;
  /** Socket.IO path. The backend default is /socket.io. */
  path?: string;
  /** Optional event channels for servers that expose a subscribe event. */
  channels?: string[];
  /** Called for every server event received through socket.onAny. */
  onEvent?: (event: JatekSocketEvent) => void;
  /** Called when the server rejects the JWT with a 401/403-style error. */
  onAuthError?: (error: Error) => void;
}

export interface UseJatekSocketResult {
  socket: Socket | null;
  status: SocketConnectionState;
  error: string | null;
  reconnectAttempts: number;
  isConnected: boolean;
  reconnect: () => void;
}

type SocketError = Error & {
  data?: unknown;
  description?: string;
};

const RECONNECT_DELAY_MS = 1_000;
const RECONNECT_DELAY_MAX_MS = 30_000;
const CONNECTION_TIMEOUT_MS = 20_000;

function log(message: string, details?: unknown) {
  if (details === undefined) {
    console.log(`[JatekSocket] ${message}`);
  } else {
    console.log(`[JatekSocket] ${message}`, details);
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return 'Erreur de connexion temps réel.';
}

function isAuthFailure(error: SocketError): boolean {
  const description = [
    error.message,
    error.description,
    typeof error.data === 'string' ? error.data : '',
    JSON.stringify(error.data ?? ''),
  ]
    .join(' ')
    .toLowerCase();

  return (
    /\b(401|403)\b/.test(description) ||
    /unauthorized|forbidden|invalid token|token expired|jwt/i.test(description)
  );
}

/**
 * Authenticated Socket.IO connection for Jatek Driver.
 *
 * The JWT is read from the in-memory API client first and then restored from
 * the existing auth storage. It is never written to logs. `auth.token` works
 * in browsers and native clients; `extraHeaders.Authorization` is also sent
 * by React Native transports.
 *
 * This hook does not replace the existing SSE transport automatically. The
 * current Jatek API documentation exposes `/api/events` (SSE), so enabling
 * this hook requires a Socket.IO server at the configured origin/path.
 */
export function useJatekSocket({
  enabled = true,
  url = getApiBaseUrl(),
  path = '/socket.io',
  channels = [],
  onEvent,
  onAuthError,
}: UseJatekSocketOptions = {}): UseJatekSocketResult {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<SocketConnectionState>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const socketRef = useRef<Socket | null>(null);
  const onEventRef = useRef(onEvent);
  const onAuthErrorRef = useRef(onAuthError);
  const reconnectRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    onEventRef.current = onEvent;
    onAuthErrorRef.current = onAuthError;
  }, [onEvent, onAuthError]);

  useEffect(() => {
    if (!enabled) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
      setStatus('disconnected');
      setError(null);
      setReconnectAttempts(0);
      log('status=disconnected (disabled)');
      return;
    }

    let disposed = false;
    let currentSocket: Socket | null = null;
    let appStateSubscription: { remove: () => void } | null = null;

    const updateStatus = (next: SocketConnectionState, details?: unknown) => {
      if (disposed) return;
      setStatus(next);
      log(`status=${next}`, details);
    };

    const connectWithStoredToken = async () => {
      updateStatus('connecting');

      const storedAuth = await loadAuth().catch((loadError) => {
        log('JWT storage read failed', errorMessage(loadError));
        return null;
      });
      if (disposed) return;

      const token = api.getToken() ?? storedAuth?.token ?? null;
      if (!token) {
        const tokenError = new Error('Session absente pour la connexion temps réel.');
        setError(tokenError.message);
        updateStatus('error', 'JWT unavailable');
        return;
      }

      const options: Partial<ManagerOptions & SocketOptions> = {
        path,
        transports: ['websocket', 'polling'],
        autoConnect: false,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: RECONNECT_DELAY_MS,
        reconnectionDelayMax: RECONNECT_DELAY_MAX_MS,
        randomizationFactor: 0.25,
        timeout: CONNECTION_TIMEOUT_MS,
        auth: { token },
        // React Native sends this header. Browsers use auth.token because
        // browsers cannot set arbitrary WebSocket headers.
        extraHeaders: {
          Authorization: `Bearer ${token}`,
        },
      };

      const nextSocket = io(url, options);
      currentSocket = nextSocket;
      socketRef.current = nextSocket;
      setSocket(nextSocket);

      const refreshAuth = () => {
        const freshToken = api.getToken() ?? token;
        nextSocket.auth = { token: freshToken };
        nextSocket.io.opts.extraHeaders = {
          Authorization: `Bearer ${freshToken}`,
        };
      };

      nextSocket.on('connect', () => {
        if (disposed) return;
        setError(null);
        setReconnectAttempts(0);
        updateStatus('connected', `socketId=${nextSocket.id ?? 'unknown'}`);
        if (channels.length > 0) {
          log('connected; channels configured', channels);
        }
      });

      nextSocket.on('disconnect', (reason) => {
        if (disposed) return;
        updateStatus('disconnected', reason);
      });

      nextSocket.on('connect_error', (connectError: SocketError) => {
        if (disposed) return;
        const message = errorMessage(connectError);
        setError(message);
        setReconnectAttempts((attempt) => attempt + 1);
        updateStatus('error', message);

        if (isAuthFailure(connectError)) {
          log('authentication rejected; automatic reconnect stopped');
          nextSocket.io.opts.reconnection = false;
          nextSocket.disconnect();
          onAuthErrorRef.current?.(connectError);
        } else {
          log('connect_error; Socket.IO will retry automatically');
        }
      });

      nextSocket.onAny((name, data) => {
        if (disposed) return;
        log(`event=${name}`);
        onEventRef.current?.({ name, data });
      });

      const manager = nextSocket.io;
      manager.on('reconnect_attempt', (attempt) => {
        if (disposed) return;
        refreshAuth();
        setReconnectAttempts(attempt);
        updateStatus('connecting', `attempt=${attempt}`);
      });
      manager.on('reconnect', (attempt) => {
        if (disposed) return;
        setReconnectAttempts(attempt);
        log(`reconnected after attempt=${attempt}`);
      });
      manager.on('reconnect_error', (managerError) => {
        if (disposed) return;
        setError(errorMessage(managerError));
        updateStatus('error', errorMessage(managerError));
      });

      const handleAppState = (nextState: AppStateStatus) => {
        if (disposed || nextState !== 'active' || nextSocket.connected) return;
        refreshAuth();
        log('app became active; requesting reconnect');
        updateStatus('connecting', 'app active');
        nextSocket.connect();
      };
      appStateSubscription = AppState.addEventListener('change', handleAppState);

      reconnectRef.current = () => {
        if (disposed) return;
        refreshAuth();
        setError(null);
        updateStatus('connecting', 'manual reconnect');
        nextSocket.connect();
      };

      log('initializing Socket.IO connection', {
        url,
        path,
        transport: 'websocket → polling fallback',
      });
      nextSocket.connect();
    };

    void connectWithStoredToken();

    return () => {
      disposed = true;
      appStateSubscription?.remove();
      reconnectRef.current = null;
      currentSocket?.removeAllListeners();
      currentSocket?.io.removeAllListeners();
      currentSocket?.disconnect();
      if (socketRef.current === currentSocket) socketRef.current = null;
      setSocket(null);
      log('status=disconnected (cleanup)');
    };
  }, [enabled, url, path, channels.join(',')]);

  return {
    socket,
    status,
    error,
    reconnectAttempts,
    isConnected: status === 'connected',
    reconnect: () => reconnectRef.current?.(),
  };
}