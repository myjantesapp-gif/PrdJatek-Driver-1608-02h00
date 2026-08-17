---
name: Auth token order bug
description: setToken must be called before any authenticated API call in the login flow
---

## Rule
In `context/AuthContext.tsx`, `api.setToken(res.token)` must be called **immediately after** the login response — before any subsequent API call like `listDrivers()`.

**Why:** `listDrivers()` requires a Bearer token. Calling it before `setToken` sends a tokenless request and the server returns 401 "Authentication required", which surfaces as a login error to the driver.

**How to apply:** Any time a post-login API call is added to the login flow, verify `setToken` has already been called. If the subsequent call fails, clear the token (`api.setToken(null)`) and re-throw so the UI can surface the error properly.
