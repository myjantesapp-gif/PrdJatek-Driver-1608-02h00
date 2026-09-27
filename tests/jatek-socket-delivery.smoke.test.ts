import { afterEach, describe, expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';

const PRODUCTION_ORIGIN = 'https://ma.jatek.app';
const SOCKET_PATH = '/socket.io/';
const WEB_CLIENT_ORIGIN = 'https://driver.jatek.app';
const TIMEOUT_MS = 15_000;

type SmokeEventPayload = {
  smokeTest: true;
  smokeTestId: string;
  orderId: string;
  driverId?: number;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} est requis. Voir tests/jatek-socket-smoke.md pour configurer le smoke test.`,
    );
  }
  return value;
}

function parseDriverId(): number {
  const raw = requiredEnv('JATEK_SOCKET_SMOKE_DRIVER_ID');
  const driverId = Number(raw);
  if (!Number.isSafeInteger(driverId) || driverId <= 0) {
    throw new Error('JATEK_SOCKET_SMOKE_DRIVER_ID doit être un entier positif.');
  }
  return driverId;
}

async function assertProductionHandshake(): Promise<void> {
  const handshakeUrl =
    `${PRODUCTION_ORIGIN}${SOCKET_PATH}` +
    '?EIO=4&transport=polling&t=jatek-driver-smoke';

  const response = await fetch(handshakeUrl, {
    headers: {
      Accept: 'text/plain',
      Origin: WEB_CLIENT_ORIGIN,
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await response.text();
  const contentType = response.headers.get('content-type') ?? '';

  if (/text\/html/i.test(contentType) || /^\s*</.test(body)) {
    throw new Error(
      `Le endpoint ${SOCKET_PATH} renvoie du HTML au lieu du handshake Engine.IO.`,
    );
  }

  expect(response.ok, `Handshake Engine.IO refusé (HTTP ${response.status}).`).toBe(true);
  expect(
    response.headers.get('access-control-allow-origin'),
    `CORS n'autorise pas ${WEB_CLIENT_ORIGIN} sur le handshake Engine.IO.`,
  ).toBe(WEB_CLIENT_ORIGIN);
  expect(body, 'Trame handshake Engine.IO absente.').toMatch(
    /^0\{"sid":".+","upgrades":\[/,
  );
}

async function assertProductionCors(): Promise<void> {
  const response = await fetch(
    `${PRODUCTION_ORIGIN}${SOCKET_PATH}?EIO=4&transport=polling`,
    {
      method: 'OPTIONS',
      headers: {
        Origin: WEB_CLIENT_ORIGIN,
        'Access-Control-Request-Method': 'GET',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    },
  );

  expect(response.ok, `Preflight CORS refusé (HTTP ${response.status}).`).toBe(true);
  expect(
    response.headers.get('access-control-allow-origin'),
    `CORS bloque le client web ${WEB_CLIENT_ORIGIN}.`,
  ).toBe(WEB_CLIENT_ORIGIN);
}

function waitForConnection(socket: Socket): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Connexion Socket.IO authentifiée expirée.'));
    }, TIMEOUT_MS);

    socket.once('connect', () => {
      clearTimeout(timeout);
      resolve();
    });
    socket.once('connect_error', (error) => {
      clearTimeout(timeout);
      reject(
        new Error(
          `JWT refusé ou connexion Socket.IO impossible: ${error.message}`,
          { cause: error },
        ),
      );
    });
  });
}

function waitForSyntheticEvents(
  socket: Socket,
  smokeTestId: string,
  driverId: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let receivedReady = false;
    const timeout = setTimeout(() => {
      reject(
        new Error(
          `Événements synthétiques non reçus dans l'ordre pour ${smokeTestId}.`,
        ),
      );
    }, TIMEOUT_MS);

    socket.on('order_ready', (payload: SmokeEventPayload) => {
      if (payload?.smokeTestId !== smokeTestId) return;
      try {
        expect(payload.smokeTest).toBe(true);
        expect(payload.orderId).toBe(`smoke:${smokeTestId}`);
        receivedReady = true;
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });

    socket.on('order_assigned', (payload: SmokeEventPayload) => {
      if (payload?.smokeTestId !== smokeTestId) return;
      try {
        expect(receivedReady, 'order_assigned reçu avant order_ready.').toBe(true);
        expect(payload.smokeTest).toBe(true);
        expect(payload.orderId).toBe(`smoke:${smokeTestId}`);
        expect(payload.driverId, 'Événement livré au mauvais chauffeur.').toBe(driverId);
        clearTimeout(timeout);
        resolve();
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  });
}

async function triggerSyntheticEvents(
  triggerUrl: string,
  triggerToken: string,
  smokeTestId: string,
  driverId: number,
): Promise<void> {
  const url = new URL(triggerUrl);
  if (url.origin !== PRODUCTION_ORIGIN) {
    throw new Error(
      `JATEK_SOCKET_SMOKE_TRIGGER_URL doit utiliser l'origine ${PRODUCTION_ORIGIN}.`,
    );
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${triggerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      smokeTestId,
      driverId,
      orderId: `smoke:${smokeTestId}`,
      events: ['order_ready', 'order_assigned'],
      persist: false,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    const details = (await response.text()).slice(0, 300);
    throw new Error(
      `Déclenchement des événements synthétiques refusé (HTTP ${response.status}): ${details}`,
    );
  }
}

describe('livraison Socket.IO en production', () => {
  let socket: Socket | undefined;

  afterEach(() => {
    socket?.removeAllListeners();
    socket?.disconnect();
  });

  it(
    'réalise le handshake et livre order_ready puis order_assigned au bon chauffeur',
    async () => {
      const jwt = requiredEnv('JATEK_SOCKET_SMOKE_JWT');
      const triggerUrl = requiredEnv('JATEK_SOCKET_SMOKE_TRIGGER_URL');
      const triggerToken = requiredEnv('JATEK_SOCKET_SMOKE_TRIGGER_TOKEN');
      const driverId = parseDriverId();
      const smokeTestId = crypto.randomUUID();

      await assertProductionCors();
      await assertProductionHandshake();

      socket = io(PRODUCTION_ORIGIN, {
        path: SOCKET_PATH,
        transports: ['polling', 'websocket'],
        reconnection: false,
        timeout: TIMEOUT_MS,
        auth: { token: jwt, driverId },
        extraHeaders: {
          Authorization: `Bearer ${jwt}`,
          Origin: WEB_CLIENT_ORIGIN,
        },
      });

      await waitForConnection(socket);
      const events = waitForSyntheticEvents(socket, smokeTestId, driverId);
      await triggerSyntheticEvents(
        triggerUrl,
        triggerToken,
        smokeTestId,
        driverId,
      );
      await events;
    },
    45_000,
  );
});