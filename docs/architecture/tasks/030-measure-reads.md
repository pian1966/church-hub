# 030 – Measure how much a church reads

**Goal:** a number, not a guess, for document reads per start by role, so we know which church sizes fit in the
free 50 000 a day.

**Files:** `docs/architecture/READS.md` (new). Only if the Speed check lacks a total: `js/mod-about.js` to show
documents received per collection (it already has `stats.sizes`).

**Steps**
1. Read `stats` in `js/store.js` (~186) and About → Speed check.
2. With the fake Firebase and generated churches of 100, 300, 1 000 and 3 000 people (made-up, generated in the
   test, never committed), record documents received at start for Administrator, Pastor, Roster coordinator and
   Member; and on a second start within 30 minutes and after.
3. Estimate a day: 5 staff × 4 starts + 20% of members × 1 start. Table by church size.
4. Say which size first exceeds 25 000 (half the limit).

**Acceptance:** `READS.md` with the table and method. No behaviour change.

**Escalate** with the table if a 500-person church exceeds 25 000 – do not redesign loading yourself.
