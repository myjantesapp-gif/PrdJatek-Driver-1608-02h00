---
name: Remote business API boundary
description: Defines the authoritative Jatek business-data origin and the separate browser CORS requirement.
---

**Rule:** All Jatek Driver business data must come exclusively from the current documented backend origin, `https://ma.jatek.app`. Do not add a fallback API origin, mock business records, or locally synthesize missing earnings, ratings, levels, statistics, or delivery estimates.

**Why:** The user explicitly requested the remote backend at `ma.jatek.app`, matching the supplied driver API contract. This supersedes the earlier `api.jatek.app` origin. Alternate origins and locally derived defaults can conflict with the authoritative backend; browser CORS remains a server-side concern.

**How to apply:** Keep one business API base URL for HTTP, SSE, and Socket.IO. Treat AsyncStorage only as session/cache storage and validate cached order state remotely before display. Configure the current backend to accept the web origin; do not restore the old origin as a CORS workaround.