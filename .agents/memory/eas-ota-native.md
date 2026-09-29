---
name: EAS OTA versus native APK
description: Distinction between preview OTA updates and native Android rebuilds for Jatek Driver
---

An EAS Update on the `preview` channel can deliver JavaScript and bundled assets to compatible runtime version `1.0.0` APKs, but it cannot add Android manifest permissions or native modules.

**Why:** Android notification/location permissions and packages such as react-native-worklets are compiled into the APK; a successful OTA does not prove the native binary contains them.

**How to apply:** Publish OTA for JS-only fixes, and schedule a fresh EAS preview APK whenever app.json permissions, native dependencies, or other config-plugin output changes. Validate native behavior on an external Android device.

If a required native build is blocked, do not leave an OTA that imports the new native module on the existing runtime. Republish a JS-only compatible update first; otherwise older preview binaries may fail at startup.

Replit Secrets are not automatically injected into remote EAS build environments. Add native configuration keys such as `GOOGLE_MAPS_API_KEY` separately as Secret variables in each EAS environment/profile that builds native binaries.

Keep `expo.owner`, `extra.eas.projectId`, `updates.url`, and the EAS profile's owner/project ID values aligned with the single Expo project selected for GitHub builds. Changing the project ID redirects OTA updates as well as future builds.

**Why:** GitHub-connected builds enforce that the config project ID matches their linked Expo project; a mismatch fails before native compilation. OTA update URLs are also project-specific.

**How to apply:** Before updating these identifiers, confirm which Expo project is canonical. Update all config references together; do not change the target project based on a build error alone.