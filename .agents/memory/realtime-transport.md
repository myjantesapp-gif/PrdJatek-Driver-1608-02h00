---
name: Realtime transport boundary
description: Durable distinction between the current Jatek SSE API and the optional Socket.IO client
---

The current Jatek API contract exposes authenticated SSE at `/api/events`; it does not document a Socket.IO handshake, namespace, subscribe event, or Socket.IO CORS policy.

**Why:** A client-only switch to `socket.io-client` cannot connect to an SSE-only server and would replace a known transport with a guaranteed failure.

**How to apply:** Keep `lib/sse.ts` as the active transport until the backend exposes and documents Socket.IO. Use `hooks/useJatekSocket.ts` only after the server contract exists, then replace the transport in one place rather than opening both connections.