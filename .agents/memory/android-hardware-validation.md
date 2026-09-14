---
name: Android hardware validation
description: Environment constraint for validating the Jatek Driver APK on Android
---

This Replit workspace cannot perform a real Android installation or lifecycle test because it has no Android SDK, `adb`, emulator, or connected device. EAS can still expose a finished preview APK, but login and delivery transitions require an external Android device and an authorized recipe account.

**Why:** A successful EAS build and passing web/unit checks do not validate native permissions, foreground/background behavior, notification delivery, or app recovery after process termination.

**How to apply:** Before planning native end-to-end execution here, check for `adb devices` and a reachable test account. If either is absent, validate only the build/API prerequisites and report the external-device blocker instead of claiming delivery transitions were observed.