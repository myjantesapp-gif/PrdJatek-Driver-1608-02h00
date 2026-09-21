---
name: Orders not arriving — root causes & fixes
description: Three bugs that caused drivers to stop receiving order alerts on the Jatek Driver app.
---

# Orders not arriving — root causes & fixes

## Root cause 1 — Status stuck at `busy` after delivery (CRITICAL)

**Rule:** When `activeApiOrders.length === 0` and `statusRef.current === 'busy'`, reset to `'online'` immediately and return. The next poll cycle will fetch available orders with the corrected status.

**Why:** `pollOrders` only calls `api.getAvailableOrders()` when `statusRef.current === 'online'`. After a delivery completes server-side, the local status remained `'busy'` forever because nothing reset it. The driver would never see available orders again until they toggled offline/online manually.

**How to apply:** In the `else` branch of `if (activeApiOrders.length > 0)`, before the `!isOnline` check, add the busy→online reset guard.

---

## Root cause 2 — SSE useEffect torn down every render cycle (CRITICAL)

**Rule:** The SSE `useEffect` must only depend on `driverId`. Access `pollOrders` inside the effect via a `pollOrdersRef` that is kept in sync with a separate `useEffect(() => { pollOrdersRef.current = pollOrders; }, [pollOrders])`.

**Why:** The original effect had `[driverId, pollOrders]` as deps. `pollOrders` is a `useCallback` that changes whenever its own deps change. Every change tore down the SSE connection, cleared the fallback poll interval, and rebuilt everything — causing brief windows where no orders could arrive, especially on low-latency reconnects.

**How to apply:** All SSE event handlers and the `setInterval` call must use `pollOrdersRef.current()` instead of `pollOrders()` directly.

---

## Root cause 3 — SSE 401 infinite reconnect loop

**Rule:** In `JatekSse`, on HTTP 401 or 403, set `this.stopped = true` and fire `authErrorHandlers` — do NOT call `scheduleReconnect()`.

**Why:** A stale/expired token caused the SSE to reconnect every 2 seconds forever, hammering the server with authenticated requests that all failed. The client had no way to know the token was invalid.

**How to apply:** `JatekSse` now accepts `() => string | null` (a getter) instead of a static string so fresh tokens are used on every reconnect. It also has `onAuthError(handler)` for callers to react.

---

## Bonus — SSE exponential backoff

`scheduleReconnect()` now uses `Math.min(2000 * 2^retryCount, 30000)` instead of flat 2 s. `retryCount` resets to 0 on a successful 2xx connection.

---

## Root cause 4 — API returns hyphenated statuses not matched in mapApiStatus (CRITICAL)

**Rule:** `mapApiStatus` must include hyphenated variants for every status: `picked-up`, `en-route`, `at-restaurant`, `ready-for-pickup`, `in-progress`, `out-for-delivery`, `on-the-way`.

**Why:** `ma.jatek.app` API returns `"picked-up"` (with hyphen) instead of `"picked_up"` (underscore). Unmatched statuses return `null`, which: (1) excludes the order from `activeApiOrders` → clears `activeOrder` → dashboard shows nothing; (2) causes `order/[id]` to hit the `!activeOrder` guard and show "Commande introuvable" — the driver is stuck on that screen. The same hyphen/underscore mismatch could affect `en-route`, `at-restaurant`, etc.

**How to apply:** In the `mapApiStatus` switch, add a `case 'x-y':` line alongside every `case 'x_y':` line.

---

## Root cause 5 — Active delivery missing from the order-list endpoint

**Rule:** Never treat an active delivery missing from `GET /api/orders` as proof that it ended; retain local active state until its own order record explicitly reports `delivered`, `completed`, or cancellation.

**Why:** Live API testing showed an order still returned by `GET /api/orders/:id` with `en_route` and the correct driver ID, while `GET /api/orders` returned an empty array for that same driver. Clearing local state from the list response sends the driver to a missing-order screen during a real delivery.

**How to apply:** Reconcile an already-active order against its individual endpoint whenever a list poll omits it, and ensure the backend list endpoint includes every active order assigned to the authenticated driver.

---

## Root cause 6 — Backend accepts concurrent deliveries for one driver

**Rule:** `accept-delivery` must enforce “one non-terminal delivery per driver” atomically and return a conflict for any second request.

**Why:** Live testing accepted two additional orders for a driver who already had an `en_route` delivery. The server also left the driver profile available, making more offers possible. Client-side guards improve UX but cannot protect against direct calls or older app versions.

**How to apply:** In the backend transaction, lock/check the driver’s non-terminal deliveries before assignment, set availability false with the first accepted order, and return HTTP 409 with a clear busy-driver message on later attempts.

---

## Active delivery reconciliation

**Rule:** Treat a locally accepted delivery as active until its own server record explicitly confirms a terminal status. Polling callers must share an in-flight reconciliation, and a failed transition must wait for that reconciliation before rolling back an optimistic state.

**Why:** An empty, delayed, unknown, or unrelated order payload is not proof that the current delivery ended. Independent overlapping polls can also apply stale data after a newer request, while a network timeout may occur after the server has committed a transition.

**How to apply:** Do not infer completion from an absent order or a different active order. Preserve the local delivery for uncertain responses, reconcile status errors against the shared poll, and surface explicit terminal server states to open detail views so retained refresh snapshots cannot show stale actions.

---

## Duplicate native notifications

**Rule:** Keep an available order in the seen/suppressed sets while the backend still advertises it; do not delete its seen ID when an alert times out, is dismissed, or is declined.

**Why:** The fallback poll runs every three seconds. Removing the ID while the API still returns the same ready order re-queues it and schedules another native notification, producing a visible Android notification loop.

**How to apply:** Clear suppression only after the order disappears from the authoritative available-order snapshot. Keep notification scheduling outside React state updater callbacks because those callbacks may be invoked more than once in development.

## Available-order ownership fields

**Rule:** Treat `driverId: null` and `assignedDriverId: null` as unassigned; only a positive concrete driver ID proves ownership.

**Why:** The detail endpoint includes nullable ownership fields on available orders. Checking only whether a field exists incorrectly classified every available offer as belonging to another driver, so the in-app offer disappeared immediately.

**How to apply:** Use concrete-ID checks when validating offer ownership, and allow incoming status variants such as `pending`/`assigned` when enriching an available-order response.
