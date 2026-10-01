---
name: Realtime transport boundary
description: Distinguishes the current Jatek Socket.IO driver contract from historical SSE documentation and fallback polling.
---

The current Jatek driver contract documents authenticated Socket.IO for `order_ready` and `order_assigned` events. SSE at `/api/events` is retained only for historical clients; the driver should use Socket.IO with authoritative order polling as its fallback.

**Why:** The backend contract now specifies the Socket.IO v4 handshake, authentication, event names, and endpoint, and states that the current driver must not open both SSE and Socket.IO.

**How to apply:** Keep one authenticated Socket.IO connection for real-time events and retain HTTP polling as the recovery/synchronization path. Do not activate SSE unless the backend contract changes again.