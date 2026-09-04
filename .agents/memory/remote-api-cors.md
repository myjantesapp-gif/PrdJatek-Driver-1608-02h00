---
name: Remote API CORS
description: Distinguishes native API connectivity from the browser-only CORS failure on the remote Jatek backend.
---

**Rule:** Treat Android native connectivity and `driver.jatek.app` browser connectivity as separate paths. The native app calls `https://ma.jatek.app` directly, while the web app requires that backend to permit the web origin.

**Why:** The remote login endpoint responds normally without an `Origin` header, but preflight and login requests carrying `Origin: https://driver.jatek.app` currently return a server error without CORS allow headers. This cannot be corrected in the static driver client.

**How to apply:** Keep the native API base on `https://ma.jatek.app`. For web support, change the remote backend CORS configuration to accept `https://driver.jatek.app`, including OPTIONS and the Authorization/Content-Type headers.