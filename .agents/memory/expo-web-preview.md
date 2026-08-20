---
name: Expo web preview startup
description: Reliable Expo web-preview startup in the current Replit Linux environment.
---

# Expo web preview startup

**Rule:** Start the Expo web preview in offline, production-preview mode when using this environment's managed workflow.

**Why:** React Native DevTools attempts to launch a bundled Linux shell that depends on `libglib-2.0.so.0`, which is unavailable here. The DevTools error is non-fatal, but the normal startup command did not reliably expose port 5000. Offline production-preview mode consistently reaches the configured web port.

**How to apply:** Preserve the existing webview port and use the established workflow command. Treat the DevTools message as diagnostic noise only after confirming the workflow responds on port 5000 and the preview renders.