---
name: Remote business API boundary
description: Defines the exclusive remote business-data origin and the separate browser CORS requirement.
---

**Rule:** Jatek Driver must communicate exclusively with the remote Jatek backend. The user allows `ma.jatek.app` or `api.jatek.app`; keep `ma.jatek.app` as the canonical origin unless a deliberate switch is justified. No arbitrary origin, local backend/database, mock order feed, or automatic failover.

**Why:** On 2026-10-02 the user explicitly replaced the earlier failover request with an exclusive remote-backend requirement while reporting recurring €25 orders. Do not hide those orders with amount-based client filtering; legitimate orders may have that amount.

**How to apply:** Keep REST and Socket.IO on the same remote origin and report outages explicitly. Investigate recurring orders at their backend source, identify exact records and creator jobs before an approved cleanup, and do not put private backend credentials into the mobile app. Browser CORS must be configured on the remote backend.

**Rule:** Cleanup requested for this driver project is local only; do not delete orders or modify the remote backend database under that request.

**Why:** The user explicitly corrected the scope to “juste ici” after remote database investigation started.

**How to apply:** Clear invalid local snapshots and account-scoped caches safely, preserve valid active deliveries, and obtain a separate explicit request before changing remote business data.