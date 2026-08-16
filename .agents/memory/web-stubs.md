---
name: Web stubs for native-only packages
description: Which native-only packages need web stubs for expo export --platform web, and how the resolver is wired.
---

# Web stubs for native-only packages

## The rule
Any package that has no web implementation crashes `npx expo export --platform web`. Add a stub in `stubs/` and register it in `metro.config.js`'s `WEB_STUBS` map.

## Currently stubbed (in `metro.config.js`)
- `react-native-maps` → `stubs/react-native-maps.js` (MapView, Marker, Polyline, Circle, Callout)
- `react-native-worklets` → `stubs/react-native-worklets.js` (required by reanimated v4+)
- `react-native-keyboard-controller` → `stubs/react-native-keyboard-controller.js` (KeyboardProvider renders children as-is)

## How the resolver works
`metro.config.js` uses `config.resolver.resolveRequest` to intercept module resolution on `platform === 'web'` and redirect to the stub file. The `WEB_STUBS` map is the single place to add new entries.

**Why:** These packages use native APIs unavailable in the browser. `react-native-worklets` is a peer dependency of `react-native-reanimated` v4 and is not installed as a top-level package — it must be stubbed rather than installed.

## Socket.IO authentication and event handling
The live-order client sends the JWT through the Socket.IO `auth` handshake only; never duplicate it in query parameters because URLs may be written to proxy logs. When the backend event name is not documented, use a catch-all listener with payload shape filtering and retain a reconciliation poll rather than guessing a fixed event list.

**Why:** The remote backend requires authenticated Socket.IO handshakes and its order event contract was not available from the public web bundle. The fallback keeps order state correct if an event is missed.

## Deployment path quirk
`metro.config.js` and `babel.config.js` must use standard package names (`@expo/metro-config`, `babel-preset-expo`), NOT hardcoded `./node_modules/expo/node_modules/...` paths. The deployment does a fresh `npm install` which may not reproduce the same nested structure.
