---
name: Jatek Socket.IO backend boundary
description: The remote Jatek origin must provide the Socket.IO server; this driver workspace only controls the authenticated client.
---

# Jatek Socket.IO backend boundary

The driver workspace is an Expo client and has no server runtime. The
Socket.IO endpoint, JWT handshake validation, driver rooms, event emission,
and production CORS must be implemented and deployed with the backend serving
`ma.jatek.app`; changing the client cannot create that remote endpoint.

**Why:** A direct Engine.IO polling probe to `https://ma.jatek.app/socket.io/`
returned the Jatek HTML shell rather than a Socket.IO handshake, while
`/api/socket.io/` returned 404. The client can be correct and still remain
disconnected until the backend is deployed.

**How to apply:** Keep the client on the origin and path documented in the
driver API contract, and verify the remote handshake plus a targeted
`order_ready`/`order_assigned` event before claiming end-to-end real-time
delivery.