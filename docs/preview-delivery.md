# Android preview APK and automatic OTA

## Canonical Expo project

- Expo app: `@jateksys/jatekdriver`
- Project ID: `38b2a449-33b2-4549-8f5f-c7f535d41a34`
- SDK: 57
- App version and new native runtime: `1.0.1`
- Android package: `com.jatek.driver`
- Environment and update channel: `preview`
- Build profile: `preview`, internal APK, Linux Medium, remote signing credentials
- Android version code baseline: 26. The next preview build auto-increments it.

Build IDs and fingerprints are outputs of a build, not reusable configuration
values. Never set the abbreviated fingerprint from a dashboard as the runtime.

## Automatic OTA

Commit and push `.eas/workflows/preview-ota.yml` with the rest of these changes
to the GitHub repository linked to this Expo project:
`myjantesapp-gif/PrdJatek-Driver-1608-02h00`.

EAS processes every branch push and targets the shared `preview` channel.
Feature-branch pushes therefore also update preview testers. The workflow does
not publish to production. Expo supports skipping a run with `[eas skip]`,
`[skip eas]`, or `[no eas]` in the commit message.

The workflow:

1. Compares native configuration, dependencies, lockfile, config plugins, and
   native image assets against the source baseline of the verified Android APK.
2. Ignores app build counters and the exact read-only `tsc --noEmit` script
   added after the APK. Other package scripts, including install hooks, are
   checked. JavaScript source and OTA-only asset edits are allowed.
3. Refuses to publish if any checked native source changed.
4. Runs fixed typecheck/test commands, then rechecks native inputs immediately
   before publishing the Android OTA.

The initial baseline is for the verified Android APK version code 26, runtime
`1.0.0`. It is stored in `.eas/ota-native-baseline.json` and enforced by
`scripts/check-ota-native.cjs`. This deliberately compares source semantics,
not a cross-environment EAS fingerprint: the initial live run showed different
fingerprints despite unchanged native source and dependencies.

The new driver icon is configured for the `1.0.1` native release. Until that
APK finishes successfully and its source baseline is reviewed, OTA publication
is intentionally blocked. The older `1.0.0` runtime stays isolated.

All business REST requests and Socket.IO connections use only
`https://ma.jatek.app`. There is no local business database, generated order
feed, alternate origin, or environment-controlled backend override.

Do not refresh the baseline just to bypass a failure. After bumping the runtime,
building and validating a new APK, review its source and explicitly regenerate
the snapshot for that verified release:

```sh
node -e "console.log(JSON.stringify(require('./scripts/check-ota-native.cjs').nativeSnapshot(process.cwd()), null, 2))"
```

Replace the baseline snapshot and its runtime/build metadata only after
confirming they match the new APK. This command prints hashes, not secrets.
Changing native EAS environment variables still requires a native-release
review; this source-only check cannot detect remote environment changes.

The push trigger requires the GitHub connection to be enabled in this Expo
project's settings. Adding files locally is not itself a push and cannot activate
the trigger. Workflow runs are visible in the project's EAS Workflows page.

EAS Workflows uses the project's managed GitHub/Expo connection. It does not
require copying `GITHUB_KEY` or `EXPO_KEY` into the APK or into this YAML.
Replit Secrets are not automatically transferred to EAS or GitHub Actions.
Native build variables such as `GOOGLE_MAPS_API_KEY` must also exist in the EAS
`preview` environment; keep that key secret and do not print the resolved app
configuration containing it.

## Manual preview APK

Use the `build-preview.yml` workflow from a pushed Git reference, or:

```sh
eas build --platform android --profile preview
```

For JS-only compatible changes, the existing APK can receive an OTA. Native
dependencies, permissions, config plugins, or SDK changes require a new APK.
With the `appVersion` runtime policy, bump `expo.version` before delivering an
incompatible native change, then build and install the new APK. Never force a
new native fingerprint into the old `1.0.0` runtime.

OTA publication does not force an immediate app restart. The installed release
checks for updates on launch; a downloaded update normally runs on a later
restart. Real Android reception still requires device validation.