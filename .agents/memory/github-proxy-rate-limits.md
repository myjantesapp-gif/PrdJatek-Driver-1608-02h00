---
name: GitHub connector rate limits
description: Avoid burst upload failures when pushing driver changes through the GitHub connector.
---

**Rule:** Throttle GitHub connector writes and handle HTTP 429 with bounded retries honoring Retry-After. For changed UTF-8 text files, prefer inline Git tree contents instead of parallel blob uploads.

**Why:** A burst of parallel blob writes returned HTTP 429. Sequential, spaced requests with inline text tree contents succeeded while preserving the complete commit history and matching every local tree hash.

**How to apply:** Verify text round-trips byte-for-byte and compare the created Git tree hash to the tested local tree before updating the branch. Keep separate verified binary uploads for non-text assets. Use a non-forced reference update and stop if the remote branch changed.