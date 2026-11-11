# 063 – The office robot: verifying, trials and grants

**Model:** Senior.

**Goal:** registrations are checked and licences issued, with no server.

**Read:** `TARGET.md` 10.6. **Needs:** 060, 061 (token format).

**Files:** `robot/office.js` (new; Node, no dependencies beyond what `robot/` has; reuse the REST helpers'
style from `robot/robot.js`), `.github/workflows/office-robot.yml` (every 15 minutes + on demand; secrets
`OFFICE_KEY`, `LICENCE_KEY`), `tests/office-robot.test.js` (stand-in servers, like `tests/robot.test.js`),
`docs/OFFICE-SETUP.md`.

**Steps:** steps 1, 2 and 4 of 10.6 (payments are 067). Signing with Node's `crypto` must produce tokens that
`Licence.verify` accepts – test the two together. Never extend a licence backwards. Idempotent: a second run
changes nothing.

**Acceptance:** tests pass; a made-up church registered by hand gets a trial licence within one run; the log shows
ids and counts only.

**Do not:** print names, emails, tokens or keys; write to any church's own project.
