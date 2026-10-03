---
name: EAS OTA versus native APK
description: Distinction between preview OTA updates and native Android rebuilds for Jatek Driver
---

An EAS Update on the `preview` channel can deliver JavaScript and bundled assets to APKs with a matching compatible runtime, but it cannot add Android manifest permissions or native modules.

**Why:** Android notification/location permissions and packages such as react-native-worklets are compiled into the APK; a successful OTA does not prove the native binary contains them.

**How to apply:** Publish OTA for JS-only fixes, and schedule a fresh EAS preview APK whenever app.json permissions, native dependencies, or other config-plugin output changes. Validate native behavior on an external Android device.

If a required native build is blocked, do not leave an OTA that imports the new native module on the existing runtime. Republish a JS-only compatible update first; otherwise older preview binaries may fail at startup.

A matching native fingerprint on a newly built APK does not make older APKs with
the same runtime compatible. Under the `appVersion` policy, incompatible native
changes must bump the app version before building or publishing an OTA.

**Why:** EAS Update targets the runtime cohort, not one particular APK. Reusing a
runtime for different native capabilities can send a valid new-build update to
an older binary that lacks its native modules.

**How to apply:** Use fingerprint matching as a compatibility check, not as a
replacement for runtime separation. Keep incompatible native releases on
different app versions.

Cross-environment build/workflow fingerprint differences do not alone prove
native incompatibility.

**Why:** The build and workflow environments produced different fingerprints
even though the verified APK's native source, dependencies, and assets were
unchanged. Installation or environment inputs can affect the hash.

**How to apply:** Investigate source and environment differences before requiring
an unnecessary rebuild. For a legacy appVersion cohort, validate any source
baseline against the actual successfully built source, never merely against the
current workspace. Do not refresh a baseline to bypass a failed check; remote
native environment changes remain a separate release-review responsibility.

Replit Secrets are not automatically injected into remote EAS build environments. Add native configuration keys such as `GOOGLE_MAPS_API_KEY` separately as Secret variables in each EAS environment/profile that builds native binaries.

Keep `expo.owner`, `extra.eas.projectId`, `updates.url`, and the EAS profile's owner/project ID values aligned with the single Expo project selected for GitHub builds. Changing the project ID redirects OTA updates as well as future builds.

**Why:** GitHub-connected builds enforce that the config project ID matches their linked Expo project; a mismatch fails before native compilation. OTA update URLs are also project-specific.

**How to apply:** Before updating these identifiers, confirm which Expo project is canonical. Update all config references together; do not change the target project based on a build error alone.

**Rule:** Do not assume a new GitHub-connected preview build has a higher Android versionCode merely because `autoIncrement` is enabled with a local version source.

**Why:** Separate successful-source preview builds reported the same Android build number. A counter increment in the remote checkout does not guarantee persistence back to the repository.

**How to apply:** Identify APKs by their EAS build ID and source revision, and verify their reported build numbers. If a release requires monotonically increasing numbers, persist the source counter deliberately rather than relying on a temporary remote checkout.