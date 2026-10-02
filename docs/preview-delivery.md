# Android preview APK and automatic OTA

## Canonical Expo project

- Expo app: `@jateksys/jatekdriver`
- Project ID: `38b2a449-33b2-4549-8f5f-c7f535d41a34`
- SDK: 57
- App version and current runtime: `1.0.0`
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

1. Computes the native fingerprint in the `preview` EAS environment.
2. Finds an internal Android preview build with the same fingerprint and runtime.
3. Refuses to publish without a compatible build.
4. Runs the typecheck and unit tests before publishing the Android OTA.

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