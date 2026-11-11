# 060 – The office project and its rules

**Model:** Senior. The rules are read by the architect before the first real church registers.

**Goal:** the small central record exists, and its rules let a church write only its own entry.

**Read:** `TARGET.md` 10.1–10.2, `RISKS.md` R13.

**Files:** `office/firestore.rules` (new), `office/firebase.json`, `tests/office-rules.test.mjs` (new; add to
`tests.yml`), `js/office-config.js` (new; the office project's public config – not secret), `docs/OFFICE-SETUP.md`
(a click-by-click guide for the owner: create the project under Church Hub's Google account, Firestore, Google
sign-in only, two-step sign-in on the account, publish `office/firestore.rules`, a service account for the robot
with the Firestore user role → GitHub secret `OFFICE_KEY`).

**Rules tests:** a verified Google user creates `churches/x` with their own email → allowed; with another email →
denied; a second create of the same id → denied; update of `ownerEmail`, `verified`, `createdAt` → denied; reads
another church → denied; `list` → denied; `licences/x` get signed-out → allowed, list → denied, write → denied;
`payments`, `grants` → denied to everyone but owner emails (grants) / nobody (payments); an owner email reads all.

**Acceptance:** tests pass in GitHub; the owner has followed the guide; no key or secret in the repository.

**Do not:** add fields about people; let anyone list churches; reuse a church's project for this.
