---
name: Cold-start notification routing
description: Notification taps must wait for persisted delivery hydration before choosing the destination
---

A notification tap that launches the app must be held until the active-order snapshot has been validated by the server. Only then can the app route a tap for an accepted order to its detail screen; otherwise the tap can race hydration and incorrectly fall back to the tabs screen.

**Why:** Android cold-start callbacks and AsyncStorage/API restoration resolve independently, so checking only the in-memory active order is not sufficient at startup.

**How to apply:** Keep cold-start responses pending while driver hydration is incomplete, then replay the response after hydration. Preserve a fallback to the tabs screen for offers with no restored active order.