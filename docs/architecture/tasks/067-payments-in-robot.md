# 067 – Payments in the office robot

**Model:** Senior.

**Goal:** a successful payment becomes a year's licence without anyone doing anything.

**Needs:** 063, 065, and the payment company chosen in 059. Read that company's current API pages first; record
the addresses used in `docs/OFFICE-SETUP.md`.

**Files:** `robot/office.js`, `tests/office-robot.test.js`, workflow secret `PAY_KEY`.

**Steps:** step 3 of `TARGET.md` 10.6. Each payment is recorded once (its provider reference is the document id).
Enough = amount ≥ 90% of `BigMac.minimum(country)` in that currency on the payment date; a different currency is
converted with the rate the provider reports, otherwise flagged for the owner (`payments/{id}.check: true`) and
no licence issued. Refunded or reversed → licence end moves back; never below the trial end.

**Acceptance:** stand-in tests: enough, too little, wrong currency, paid twice, unknown church id, refund; a second
run changes nothing; log shows counts only.

**Do not:** print amounts or references; trust an amount sent by the website.
