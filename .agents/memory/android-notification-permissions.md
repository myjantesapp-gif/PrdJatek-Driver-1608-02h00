---
name: Android notification permissions
description: Durable behavior for Android notification permission prompts in Expo apps
---

Android notification permission setup must only call the system prompt while the permission is `undetermined`. After a denial, report the disabled state and direct the user to system settings rather than prompting repeatedly.

**Why:** Android may refuse a useful second prompt after a driver denies notifications, and repeated prompts make later order-alert setup noisy or misleading.

**How to apply:** Coalesce concurrent notification setup calls, guard the in-process prompt attempt, and re-read permission state when setup is requested again so a settings change can be detected.