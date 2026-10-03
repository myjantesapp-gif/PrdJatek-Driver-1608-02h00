---
name: Jatek API endpoints
description: Confirmed REST endpoints for ma.jatek.app — driver auth, profile, orders, earnings, location
---

Base URL: `https://ma.jatek.app`

## Auth
- `POST /api/auth/login` — `{email, password}` → `{token, user}` (JWT, expires ~30 days)

## Drivers
- `GET /api/drivers` — list all drivers (used to find driverId from userId after login)
- `GET /api/drivers/:id` — single driver profile
- `PATCH /api/drivers/:id` — update `{isAvailable: boolean}` → driver record
- `PATCH /api/drivers/:id/location` — `{latitude, longitude}` → `{latitude, longitude, locationUpdatedAt, eta, activeOrderIds}`
- `GET /api/drivers/:id/earnings` → `{today, thisWeek, thisMonth, totalDeliveries, completedToday}`

## Orders — TWO separate endpoints (critical)
- `GET /api/orders?driverId=<authenticated driver ID>` — driver's assigned deliveries. Without the driver filter, the consulted backend applies customer ownership (`userId`), not driver ownership.
- `GET /api/orders/available` — unassigned shop-accepted/confirmed/preparing/ready offers. The consulted backend returns an empty list for unavailable/incomplete/busy drivers. Returns a flatter structure than assigned deliveries.

**Why:** An unfiltered assigned-order request can hide an active delivery while the server correctly blocks new offers, leaving the app apparently online with nothing to receive.

**How to apply:** Scope assigned-order requests to the authenticated driver. Treat successful empty offers separately from failed offer requests; a working profile or assigned endpoint does not prove offers are accessible.
- `GET /api/orders/:id` — full order details (includes items, customer, all coords). Use after accepting to enrich data.
- `PATCH /api/orders/:id/status` — `{status}` only for driver milestones. `driverId` is rejected; assignment uses the dedicated acceptance endpoint, and delivery confirmation uses the dedicated code endpoint.

## /api/orders/available response shape (DIFFERENT from ApiOrder)
- `restaurantName` (flat string, not nested shop object)
- `userName` (not customer.name)
- `items[].menuItemName` (not items[].name)
- `items[].unitPrice` (not items[].price)
- `kitchenCode` / `pickupCode` (not otp/deliveryCode)
- `status: "ready"` means available for driver pickup → treat as `incoming` in app

## Other
- `GET /api/notifications` → `{notifications[], unreadCount}`
- `GET /api/categories` → category tree

## Socket.IO
- The previously observed HTML handshake failure is historical; later checks returned an Engine.IO handshake. Consult the realtime transport memory and verify the current remote response rather than assuming Socket.IO is unavailable.

## Driver identity
- Login maps userId → driverId via `GET /api/drivers` (find by `d.userId === userId`)
- Order status values (API→app): pending/assigned/ready/ready_for_pickup→incoming, accepted→accepted, at_restaurant→at_restaurant, picked_up→picked_up, delivering/in_progress/out_for_delivery→delivering, delivered/completed→completed

**Why:** No auto-discovery endpoint; driver ID must be resolved via the list after login. Available orders use a completely different endpoint and schema from assigned orders.
**How to apply:** Always poll BOTH `/api/orders` (assigned) AND `/api/orders/available` (pickup queue). Map available orders with `mapAvailableOrder()`, not `mapApiOrder()`.

## List response tolerance
- Order lists may be returned as a raw array or wrapped under `orders`, `availableOrders`, or `data`; order IDs may be JSON strings.

**Why:** The mobile client has encountered loosely typed and wrapped JSON responses; treating a valid response as empty makes ready offers disappear.

**How to apply:** Normalize the list envelope, numeric ID, and status before comparing IDs or filtering `ready` offers.

## Status mutation response
- Status mutation consumers should reconcile with `GET /api/orders/:id` when `PATCH /api/orders/:id/status` returns an empty body or a wrapper such as `{order: ...}`. Do not treat the mutation as failed solely because its response is not a flat order.

## Strict remote driver milestones
- The consulted backend requires assignment → `driver_at_restaurant` → `picked_up` → `en_route` → `out_for_delivery`, then code confirmation. Assignment may be returned as `assigned` or legacy `accepted`.
- Code responses distinguish incorrect, expired, already-used and delivery-not-ready cases. An already-used error alone does not prove this client completed delivery; verify the remote order before reporting success.

**Why:** Skipping restaurant arrival or treating departure as arrival causes valid-looking client actions to be rejected by the backend. These requirements were confirmed against the remote backend source, not inferred from the driver UI.

**How to apply:** Preserve all milestones in the client, retain active deliveries on errors, and reconcile lost/empty mutation responses with authenticated order details. Contract alignment is client-only: do not change the remote database or create real orders for validation.
