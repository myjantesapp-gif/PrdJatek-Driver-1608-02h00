---
name: Native PNG color profiles
description: Preserve the supplied icon's color appearance when producing adaptive Android assets.
---

Preserve embedded PNG color profiles when deriving native icons.

**Why:** The installed Jimp image tooling stripped the supplied image's iCCP
profile while adding adaptive-icon padding. The derived asset then appeared
muted despite unchanged source RGB values.

**How to apply:** Compare the original and generated images visually and inspect
their color-profile metadata. Preserve the profile when pixel colors have not
been converted, or perform a proper conversion to sRGB before removing it.
Do not treat a successfully encoded PNG as proof of matching colors.