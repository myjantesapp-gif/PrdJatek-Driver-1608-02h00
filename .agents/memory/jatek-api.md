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
- `GET /api/orders` — driver's OWN assigned orders only (filtered by JWT). Returns `[]` if none assigned.
- `GET /api/orders/available` — ALL orders ready for pickup (unassigned, visible to all online drivers). **This is the main source of incoming orders.** Returns flat structure (different from ApiOrder).
- `GET /api/orders/:id` — full order details (includes items, customer, all coords). Use after accepting to enrich data.
- `PATCH /api/orders/:id/status` — `{status, driverId?, otp?}` → updated order. Returns "Not authorized to accept orders for this restaurant" if driver not linked to that restaurant on backend.

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

## Socket.IO — NOT FUNCTIONAL
- `/socket.io/` returns HTML (reverse proxy intercepts). Polling-only also fails (`server error`).
- App falls back to 7s polling interval exclusively.

## Driver record (userId=310, driverId=4) / (userId=314, driverId=5)
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
