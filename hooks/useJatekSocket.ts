import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import {
  io,
  type ManagerOptions,
  type Socket,
  type SocketOptions,
} from 'socket.io-client';
import { api, getApiBaseUrl, loadAuth } from '@/lib/api';

export type JatekSocketEventName = 'order_ready' | 'order_assigned';

export type JatekSocketEvent = {
  name: JatekSocketEventName;
  type: JatekSocketEventName;
  data: unknown;
};

export type SocketConnectionState =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

export interface UseJatekSocketOptions {
  /** Keep the connection disabled while the driver is logged out. */
  enabled?: boolean;
  /** Authenticated driver identity used for server-side room selection. */
  driverId?: number | null;
  /** Current JWT. The hook falls back to the restored API session when absent. */
  token?: string | null;
  /** Socket.IO server origin. Defaults to the Jatek API origin. */
  url?: string;
  /** Socket.IO path used by the Jatek backend. */
  path?: string;
  /** Optional channel metadata for compatible backend implementations. */
  channels?: string[];
  /** Called for the order events emitted by the server. */
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
    /unauthorized|forbidden|invalid token|token expired|jwt/.test(description)
  );
}

/**
 * Authenticated Socket.IO connection for Jatek Driver.
 *
 * The JWT is sent in auth.token and in Authorization so browsers and native
 * clients can use the same backend handshake. Event callbacks live in refs,
 * so changing DriverContext state does not create a second connection.
 */
export function useJatekSocket({
  enabled = true,
  driverId = null,
  token = null,
  url = getApiBaseUrl(),
  path = '/socket.io/',
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
      return;
    }

    let disposed = false;
    let currentSocket: Socket | null = null;
    let appStateSubscription: { remove: () => void } | undefined;

    const connectWithToken = async () => {
      const storedAuth = await loadAuth().catch(() => null);
      if (disposed) return;

      const resolvedToken = token ?? api.getToken() ?? storedAuth?.token ?? null;
      if (!resolvedToken) {
        setError('Session absente pour la connexion temps réel.');
        setStatus('error');
        return;
      }

      const options: Partial<ManagerOptions & SocketOptions> = {
        path,
        transports: ['polling', 'websocket'],
        autoConnect: false,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: RECONNECT_DELAY_MS,
        reconnectionDelayMax: RECONNECT_DELAY_MAX_MS,
        randomizationFactor: 0.25,
        timeout: CONNECTION_TIMEOUT_MS,
        auth: {
          token: resolvedToken,
          ...(driverId ? { driverId } : {}),
          ...(channels.length > 0 ? { channels } : {}),
        },
        // React Native sends this header. Browsers use auth.token because
        // browsers cannot set arbitrary WebSocket headers.
        extraHeaders: {
          Authorization: `Bearer ${resolvedToken}`,
        },
      };

      const nextSocket = io(url, options);
      currentSocket = nextSocket;
      socketRef.current = nextSocket;
      setSocket(nextSocket);
      setStatus('connecting');

      const refreshAuth = () => {
        const freshToken = token ?? api.getToken() ?? resolvedToken;
        nextSocket.auth = {
          token: freshToken,
          ...(driverId ? { driverId } : {}),
          ...(channels.length > 0 ? { channels } : {}),
        };
        nextSocket.io.opts.extraHeaders = {
          Authorization: `Bearer ${freshToken}`,
        };
      };

      nextSocket.on('connect', () => {
        if (disposed) return;
        setError(null);
        setReconnectAttempts(0);
        setStatus('connected');
      });

      nextSocket.on('disconnect', (reason) => {
        if (disposed) return;
        setStatus('disconnected');
        setError(reason === 'io server disconnect' ? 'Serveur déconnecté.' : null);
      });

      nextSocket.on('connect_error', (connectError: SocketError) => {
        if (disposed) return;
        const message = errorMessage(connectError);
        setError(message);
        setReconnectAttempts((attempt) => attempt + 1);
        setStatus('error');

        if (isAuthFailure(connectError)) {
          nextSocket.io.opts.reconnection = false;
          nextSocket.disconnect();
          onAuthErrorRef.current?.(connectError);
        }
      });

      nextSocket.onAny((name, data) => {
        if (disposed) return;
        if (name !== 'order_ready' && name !== 'order_assigned') return;
        const eventName = name as JatekSocketEventName;
        onEventRef.current?.({
          name: eventName,
          type: eventName,
          data,
        });
      });

      const manager = nextSocket.io;
      manager.on('reconnect_attempt', (attempt) => {
        if (disposed) return;
        refreshAuth();
        setReconnectAttempts(attempt);
        setStatus('connecting');
      });
      manager.on('reconnect', () => {
        if (disposed) return;
        setStatus('connected');
      });
      manager.on('reconnect_error', (managerError) => {
        if (disposed) return;
        setError(errorMessage(managerError));
        setStatus('error');
      });

      const handleAppState = (nextState: AppStateStatus) => {
        if (disposed || nextState !== 'active' || nextSocket.connected) return;
        refreshAuth();
        setStatus('connecting');
        nextSocket.connect();
      };
      appStateSubscription = AppState.addEventListener('change', handleAppState);

      reconnectRef.current = () => {
        if (disposed) return;
        refreshAuth();
        setError(null);
        setStatus('connecting');
        nextSocket.connect();
      };

      nextSocket.connect();
    };

    void connectWithToken();

    return () => {
      disposed = true;
      appStateSubscription?.remove();
      reconnectRef.current = null;
      currentSocket?.removeAllListeners();
      currentSocket?.io.removeAllListeners();
      currentSocket?.disconnect();
      if (socketRef.current === currentSocket) socketRef.current = null;
      setSocket(null);
      setStatus('disconnected');
    };
  }, [enabled, driverId, token, url, path, channels.join(',')]);

  return {
    socket,
    status,
    error,
    reconnectAttempts,
    isConnected: status === 'connected',
    reconnect: () => reconnectRef.current?.(),
  };
}