---
name: GitHub binary asset uploads
description: Keep image and other binary assets intact when uploading them through the connected GitHub API.
---

Do not transfer large workspace binaries by printing base64 through the CodeExecution `shellExec` callback. Its output can be altered or truncated without setting the truncation flag. Read bytes directly with `node:fs` inside a small `use impure` function, upload as base64, and verify the returned Git blob SHA against the local Git blob hash before updating a branch.

**Why:** A PNG uploaded this way became unreadable and made EAS Android prebuild fail, even though the workspace copy decoded correctly.

**How to apply:** Before committing any binary through the GitHub API, verify its magic bytes, byte length, and Git blob SHA. Prefer authenticated Git transport when it is available.