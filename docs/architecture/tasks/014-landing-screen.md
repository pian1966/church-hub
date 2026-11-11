# 014 – Landing screen

**Model:** Middle; translations by a light model (`MODELS.md` rule 2).

**Goal:** someone who opens the website with no church chosen knows what to do.

**Needs:** 010, 011. Only shows when `Church.resolve` gives `none` **and** there is no built-in config – so it first
appears on the new address (040), never on Howick's current one.

**Files:** `js/app.js` (a new stage beside `signedOut`), `js/i18n/common.js` + all `js/lang/*.js`, `css/hub.css`
(reuse existing classes), `tests/app/signin.js`.

**Screen:** Church Hub; one line saying what it is; three plain buttons –
**Open my church** (paste the link or the short code your church gave you → `?c=`),
**Set up Church Hub for my church** (goes to the helper, 021; until then hidden),
**Try the demo** (`?demo`). If churches are remembered on this device, list them by name first.

**Acceptance:** browser test for each button; phone width looks right; every language has the lines
(`node tests/i18n.test.js`).

**Do not:** add a search of churches (there is no public list of churches, by design; the office record is private).
