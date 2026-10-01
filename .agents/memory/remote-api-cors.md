---
name: Remote business API boundary
description: Defines the authoritative Jatek business-data origin and the separate browser CORS requirement.
---

**Rule:** Keep `https://ma.jatek.app` as the primary Jatek Driver origin. Any failover origin must be explicitly approved, HTTPS, and provide the same REST routes, authentication, and real-time contract. Never expose private backend secrets in the Expo client or synthesize business data.

**Why:** The user confirmed `ma.jatek.app` as primary and requested dynamic failover if it becomes unavailable. Failover sends the same driver bearer token and GPS data to another origin, so the origin must be operator-approved. Private backend secrets cannot safely be embedded in a mobile bundle.

**How to apply:** For dynamic configuration, use an admin/backend-controlled public allowlist served from a control plane that remains reachable when the primary API is down; cache the last valid list for offline startup. Fail over only on network/timeout or server availability errors, never on authentication or business 4xx responses. Keep browser CORS configured on each approved server.