---
name: EAS OTA versus native APK
description: Distinction between preview OTA updates and native Android rebuilds for Jatek Driver
---

An EAS Update on the `preview` channel can deliver JavaScript and bundled assets to compatible runtime version `1.0.0` APKs, but it cannot add Android manifest permissions or native modules.

**Why:** Android notification/location permissions and packages such as react-native-worklets are compiled into the APK; a successful OTA does not prove the native binary contains them.

**How to apply:** Publish OTA for JS-only fixes, and schedule a fresh EAS preview APK whenever app.json permissions, native dependencies, or other config-plugin output changes. Validate native behavior on an external Android device.

If a required native build is blocked, do not leave an OTA that imports the new native module on the existing runtime. Republish a JS-only compatible update first; otherwise older preview binaries may fail at startup.