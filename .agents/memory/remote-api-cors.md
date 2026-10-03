---
name: Remote business API boundary
description: Defines the exclusive remote business-data origin and the separate browser CORS requirement.
---

**Rule:** Jatek Driver must communicate exclusively with `https://api.jatek.app` for business data, REST and Socket.IO. No alternate origin, local backend/database, mock order feed, or automatic failover. Backend monetary amounts are in MAD, not EUR; do not convert them or invent totals locally.

**Why:** On 2026-10-03 the user explicitly required “absolument api.jatek.app” and amounts in MAD from the remote backend. This replaces the previous canonical origin. Do not hide orders using amount-based filtering.

**How to apply:** Keep REST and Socket.IO on the same remote origin and report outages explicitly. Investigate recurring orders at their backend source, identify exact records and creator jobs before an approved cleanup, and do not put private backend credentials into the mobile app. Browser CORS must be configured on the remote backend.

**Rule:** Earnings, delivery counts and ratings are backend-authoritative. Refresh them during app use, on foreground recovery and after delivery; never increment gains locally or treat missing figures as confirmed zero values.

**Why:** The user explicitly required that “gains et autres chiffres” stay synchronized from the remote backend, not merely be loaded once at login.

**How to apply:** Keep the last confirmed figures visible on transient failure, mark them as not updated, and protect asynchronous responses against account changes.

**Rule:** Cleanup requested for this driver project is local only; do not delete orders or modify the remote backend database under that request.

**Why:** The user explicitly corrected the scope to “juste ici” after remote database investigation started.

**How to apply:** Clear invalid local snapshots and account-scoped caches safely, preserve valid active deliveries, and obtain a separate explicit request before changing remote business data.