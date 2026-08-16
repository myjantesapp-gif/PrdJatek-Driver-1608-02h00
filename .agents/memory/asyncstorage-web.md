---
name: AsyncStorage web quirks
description: AsyncStorage multi-ops (multiSet/multiGet/multiRemove) crash on Expo web; use individual setItem/getItem/removeItem
---

`AsyncStorage.multiSet`, `multiGet`, and `multiRemove` throw "is not a function" on Expo web builds.

**Why:** The `@react-native-async-storage/async-storage` web implementation does not expose the multi-key batch methods.

**How to apply:** Any time you store or retrieve multiple keys in AsyncStorage, use sequential individual `setItem`/`getItem`/`removeItem` calls, never the batch variants. This applies everywhere in the codebase (lib/api.ts storage helpers, context files, etc.).
