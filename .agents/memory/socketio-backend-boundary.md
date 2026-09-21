---
name: Jatek Socket.IO backend boundary
description: The remote Jatek origin must provide the Socket.IO server; this driver workspace only controls the authenticated client.
---

# Jatek Socket.IO backend boundary

The driver workspace is an Expo client and has no server runtime. The
Socket.IO endpoint, JWT handshake validation, driver rooms, event emission,
and production CORS must be implemented and deployed with the backend serving
`api.jatek.app` (with `ma.jatek.app` as the client fallback); changing the
client cannot create that remote endpoint.

**Why:** A direct Engine.IO polling probe to `https://ma.jatek.app/socket.io/`
and `https://api.jatek.app/socket.io/` returned the Jatek HTML shell rather than
a Socket.IO handshake. A preflight from `https://driver.jatek.app` also
returned HTTP 500 without CORS headers on both API origins. The client can be
correct and still remain disconnected until the backend is deployed and its
production CORS is fixed.

**How to apply:** Keep the client on the origin and path documented in the
driver API contract, and verify the remote handshake plus a targeted
`order_ready`/`order_assigned` event before claiming end-to-end real-time
delivery.