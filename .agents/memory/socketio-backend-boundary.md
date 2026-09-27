---
name: Jatek Socket.IO backend boundary
description: The remote Jatek origin must provide the Socket.IO server; this driver workspace only controls the authenticated client.
---

# Jatek Socket.IO backend boundary

The driver workspace is an Expo client and has no server runtime. The
Socket.IO endpoint, JWT handshake validation, driver rooms, event emission,
and production CORS must be implemented and deployed with the backend serving
`ma.jatek.app`; changing the client cannot create that remote endpoint.

**Why:** An ordinary HTTP API response and a working preflight do not prove
that the Engine.IO polling route is deployed. The client can be correct and
still remain disconnected if the backend serves its HTML shell instead of a
Socket.IO handshake.

**How to apply:** Keep the client on the origin and path documented in the
driver API contract; verify that `/socket.io/?EIO=4&transport=polling` returns
an Engine.IO open frame and that a targeted `order_ready`/`order_assigned`
event arrives before claiming end-to-end real-time delivery.