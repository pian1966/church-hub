# 013 – Per-church device keys; the email link carries the church

**Model:** Senior (`js/store.js`, sign-in).

**Goal:** two churches on one device never share sign-in leftovers, and an email link opened anywhere finds its church.

**Needs:** 010.

**Files:** `js/store.js` only (`Live`: the three keys near line 179 and their uses; `sendLink` near 348),
`tests/app/signin.js`, `tests/app/offline.js`.

**Steps**
1. `EMAIL_KEY`, `WHO_KEY`, `OWNER_KEY` become functions of `cfg.projectId` (suffix `':' + projectId`).
   For the built-in project keep reading the old un-suffixed value once if the new one is missing, then write the
   new one – so nobody at Christ Church Howick is asked for their email again or loses "who is using Church Hub".
2. `sendSignInLinkToEmail` → `url: location.origin + location.pathname + '?c=' + encodeURIComponent(cfg.projectId)`
   **only when** the church was chosen by `Church` (not the built-in one) – Howick's authorised link stays as is.
3. After the email link completes, the address is cleaned as today; keep `?c=`.

**Acceptance:** existing sign-in and offline browser tests pass; a new case signs in to two fake projects in turn
and shows that the second does not wipe or reuse the first's "who" and email.

**Do not:** change what `wipe()` deletes; touch `plan()` or the rules. Full browser test before pushing
(`js/store.js` changed).
