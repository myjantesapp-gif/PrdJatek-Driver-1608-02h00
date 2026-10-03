import React, { useEffect } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const socketHarness = vi.hoisted(() => {
  const listeners = new Map<string, (...args: any[]) => void>();
  const managerListeners = new Map<string, (...args: any[]) => void>();
  const manager = {
    opts: { extraHeaders: {} as Record<string, string>, reconnection: true },
    on: vi.fn((event: string, handler: (...args: any[]) => void) => {
      managerListeners.set(event, handler);
    }),
    removeAllListeners: vi.fn(() => managerListeners.clear()),
  };
  return {
    listeners,
    managerListeners,
    manager,
    socket: {
      on: vi.fn((event: string, handler: (...args: any[]) => void) => {
        listeners.set(event, handler);
      }),
      onAny: vi.fn((handler: (event: string, data: unknown) => void) => {
        listeners.set('any', handler as (...args: any[]) => void);
      }),
      removeAllListeners: vi.fn(() => listeners.clear()),
      io: manager,
      connected: false,
      connect: vi.fn(),
      disconnect: vi.fn(),
    },
    io: vi.fn(),
  };
});

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => {}),
    removeItem: vi.fn(async () => {}),
  },
}));

vi.mock('react-native', () => ({
  AppState: {
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
  },
}));

vi.mock('socket.io-client', () => ({
  io: socketHarness.io,
}));

import { useJatekSocket, type JatekSocketEvent } from '@/hooks/useJatekSocket';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Probe({
  onEvent,
  onAuthError,
  enabled = true,
}: {
  onEvent: (event: JatekSocketEvent) => void;
  onAuthError: () => void;
  enabled?: boolean;
}) {
  const { isConnected } = useJatekSocket({
    enabled,
    driverId: 7,
    token: 'jwt-token',
    onEvent,
    onAuthError,
  });
  useEffect(() => {}, [isConnected]);
  return <>{isConnected ? 'connected' : 'disconnected'}</>;
}

describe('useJatekSocket', () => {
  beforeEach(() => {
    socketHarness.listeners.clear();
    socketHarness.managerListeners.clear();
    socketHarness.manager.opts.reconnection = true;
    socketHarness.io.mockReturnValue(socketHarness.socket);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('opens one authenticated Socket.IO connection and forwards order events', async () => {
    const onEvent = vi.fn();
    const onAuthError = vi.fn();
    let renderer!: ReturnType<typeof TestRenderer.create>;

    await act(async () => {
      renderer = TestRenderer.create(
        <Probe onEvent={onEvent} onAuthError={onAuthError} />,
      );
      await Promise.resolve();
    });

    expect(socketHarness.io).toHaveBeenCalledWith(
      'https://api.jatek.app',
      expect.objectContaining({
        path: '/socket.io/',
        auth: { token: 'jwt-token', driverId: 7 },
        extraHeaders: { Authorization: 'Bearer jwt-token' },
        autoConnect: false,
        reconnection: true,
        reconnectionAttempts: Infinity,
      }),
    );
    expect(socketHarness.socket.connect).toHaveBeenCalledTimes(1);

    act(() => {
      socketHarness.listeners.get('connect')?.();
      socketHarness.listeners.get('any')?.('order_ready', { orderId: 103 });
      socketHarness.listeners.get('any')?.('order_assigned', {
        orderId: 104,
        driverId: 7,
      });
      socketHarness.listeners.get('any')?.('order_available', {
        orderId: 105,
        status: 'preparing',
      });
    });

    expect(renderer.toJSON()).toBe('connected');
    expect(onEvent).toHaveBeenNthCalledWith(1, {
      name: 'order_ready',
      type: 'order_ready',
      data: { orderId: 103 },
    });
    expect(onEvent).toHaveBeenNthCalledWith(2, {
      name: 'order_assigned',
      type: 'order_assigned',
      data: { orderId: 104, driverId: 7 },
    });
    expect(onEvent).toHaveBeenNthCalledWith(3, {
      name: 'order_available',
      type: 'order_available',
      data: { orderId: 105, status: 'preparing' },
    });

    act(() => renderer.unmount());
    expect(socketHarness.socket.disconnect).toHaveBeenCalledTimes(1);
  });

  it('retries a server-initiated disconnect with backoff', async () => {
    vi.useFakeTimers();
    let renderer!: ReturnType<typeof TestRenderer.create>;

    await act(async () => {
      renderer = TestRenderer.create(
        <Probe onEvent={vi.fn()} onAuthError={vi.fn()} />,
      );
      await Promise.resolve();
    });

    expect(socketHarness.socket.connect).toHaveBeenCalledTimes(1);

    act(() => {
      socketHarness.listeners.get('disconnect')?.('io server disconnect');
    });
    expect(socketHarness.socket.connect).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(socketHarness.socket.connect).toHaveBeenCalledTimes(2);

    act(() => renderer.unmount());
  });

  it('stops reconnecting and reports an authentication failure', async () => {
    const onAuthError = vi.fn();
    let renderer!: ReturnType<typeof TestRenderer.create>;

    await act(async () => {
      renderer = TestRenderer.create(<Probe onEvent={vi.fn()} onAuthError={onAuthError} />);
      await Promise.resolve();
    });

    act(() => {
      socketHarness.listeners.get('connect_error')?.({
        message: 'Unauthorized',
        data: { status: 401 },
      });
    });

    expect(socketHarness.socket.disconnect).toHaveBeenCalledTimes(1);
    expect(onAuthError).toHaveBeenCalledTimes(1);
    act(() => renderer.unmount());
  });

  it('does not open a connection while the driver is logged out', async () => {
    await act(async () => {
      TestRenderer.create(
        <Probe
          enabled={false}
          onEvent={vi.fn()}
          onAuthError={vi.fn()}
        />,
      );
      await Promise.resolve();
    });

    expect(socketHarness.io).not.toHaveBeenCalled();
  });
});