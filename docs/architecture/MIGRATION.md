# Getting there – in phases

The app keeps working after every phase. Christ Church Howick's live data never moves: its project
(`church-hub-7ec02`) simply becomes "a church like any other". Tasks are in `tasks/`.

## Phase A – Prove it (no change to the app)
- 001 Church Hub's own Google identity (a person does this, guided).
- 002 The trial page: every automatic step tried against a throw-away Google account; results written to
  `SPIKE-RESULTS.md`.
- 030 Measure how much a church reads per day.

**Stop here and go back to the architect (Fable) if 002 shows step 1, 3, 4, 5 or 9 cannot be done from a browser.**
Those are the ones with no good fallback. Steps 7 and 8 have fallbacks (`RISKS.md`).

## Phase B – Many churches on one website (safe to merge while Howick is live)
- 010 Choosing the church (`js/church.js`) – with no `?c=` and nothing remembered, the built-in config is used,
  so Howick sees no difference.
- 013 Per-church device keys and the email link carrying `?c=`.
- 012 Rules versions.
- 011 The public card.
- 014 The landing screen.
- 031 Plain-English quota messages.

Roll back: each is one pull request; revert it. 011 and 012 change `firestore.rules` by adding rules only –
reverting the website does not need the rules reverted.

## Phase C – The setup helper
- 020 The engine (`js/provision.js`), tested against stand-in servers.
- 021 The screen.
- 022 "Update the database rules" for Administrators.
- 023 AI setup (only the parts 002 proved).

Try it end to end with a made-up church on a throw-away Google account before telling anyone.

## Phase D – The new address
- 040 Move the website to its own address; the old address forwards. For Christ Church Howick this needs four
  small settings in its own project (authorised domain, key restriction, reCAPTCHA domain, robot `SITE_URL`) – done
  **before** the forward is switched on, so nobody is locked out. Roll back: switch the forward off.
- 041 Android app for any church (new app id; Howick's existing app keeps working).

## Phase E – Tell people
- 050 Guides, brochure, terms, roadmap. `docs/FIREBASE-SETUP.md` stays as "doing it by hand" for anyone the helper
  cannot serve (for example a Google Workspace that forbids creating projects).

## Christ Church Howick's data
Nothing is exported, imported or copied at any point. If anything in Phase B misbehaves for Howick, reverting the
pull request restores yesterday's behaviour, because its project and data were never touched.
The only Howick-side changes are console settings in Phase D, listed in task 040.
