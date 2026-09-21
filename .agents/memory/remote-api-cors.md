---
name: Remote business API boundary
description: Defines the exclusive Jatek business-data origin and the separate browser CORS requirement.
---

**Rule:** All Jatek Driver business data must come exclusively from `https://api.jatek.app`. Do not add a fallback API origin, mock business records, or locally synthesize missing earnings, ratings, levels, statistics, or delivery estimates.

**Why:** Alternate origins and locally derived defaults can conflict with the authoritative backend and show drivers values the server never confirmed. Browser CORS remains a server-side concern and must not be bypassed with another domain.

**How to apply:** Keep one business API base URL for HTTP, SSE, and Socket.IO. Treat AsyncStorage only as session/cache storage and validate cached order state remotely before display. Configure `api.jatek.app` to accept the web origin when browser support is required.