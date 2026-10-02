---
name: Remote business API boundary
description: Defines the exclusive remote business-data origin and the separate browser CORS requirement.
---

**Rule:** Jatek Driver must use exclusively `https://ma.jatek.app` for business data and real-time events. No alternate origin, local backend/database, mock order feed, or failover is permitted unless the user changes this standing scope.

**Why:** On 2026-10-02 the user explicitly replaced the earlier failover request with an exclusive remote-backend requirement while reporting recurring €25 orders. Do not hide those orders with amount-based client filtering; legitimate orders may have that amount.

**How to apply:** Keep REST and Socket.IO on the same remote origin and report outages explicitly. Investigate recurring orders at their backend source, identify exact records and creator jobs before an approved cleanup, and do not put private backend credentials into the mobile app. Browser CORS must be configured on the remote backend.