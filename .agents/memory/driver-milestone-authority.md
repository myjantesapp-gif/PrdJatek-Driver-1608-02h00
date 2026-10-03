---
name: Driver milestone authority
description: Why delivery actions wait for server acknowledgement and restart snapshots must be revalidated.
---

**Rule:** Delivery milestones must remain distinct, and the next driver action must wait for server acknowledgement. A validated remote state takes precedence over a locally later snapshot.

**Why:** Older driver clients grouped travel and arrival into one state and allowed restaurant arrival to be skipped. Comparing only local progress could therefore preserve a false arrival after restart and offer OTP before the backend allowed it.

**How to apply:** When changing delivery flows, compare the client's actions with the remote backend contract. On conflicts or interrupted requests, read the specific order without automatically resending mutations. A consumed OTP is not proof of success unless the remote order confirms delivery.