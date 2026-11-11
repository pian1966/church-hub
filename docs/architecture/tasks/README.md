# Tasks

One file = one pull request. Read `../DECISION.md` and `../TARGET.md` first, then the task, then `CLAUDE.md`.
Each task names the cheapest kind of AI that should do it – see `../MODELS.md`. Before starting, check the session's
model against the task's **Model** line; if the session is lighter than the task needs, stop and say so.
Every task: own branch from the latest `main`; raise the version (`js/version.js` + `?v=` in `index.html`) if the
website changes; member-facing words through `T('…')` in every language file; run the checks `CLAUDE.md` asks for.
On a conflict in `js/version.js` / `index.html`, take the higher version.

| Task | What | Needs first | Touches (shared files in bold) | Can run beside |
| --- | --- | --- | --- | --- |
| 001 | Church Hub's Google identity (a person, guided) | – | docs only | everything |
| 002 | Trial page proving the automatic steps | 001 | `tools/` (new), docs | everything |
| 030 | Measure reads per start | – | docs only (maybe `js/mod-about.js`) | everything |
| 010 | Choosing the church | – | `js/church.js` (new), **`index.html`**, `sw.js`, tests | 030, 001, 002 |
| 013 | Per-church device keys; email link carries the church | 010 | **`js/store.js`** | not 012, 011, 031 |
| 012 | Rules versions | 013 | **`firestore.rules`**, **`js/store.js`**, `js/app.js`, `js/version.js`, tests | not 011, 031 |
| 011 | The public card | 012 | **`firestore.rules`**, **`js/store.js`**, tests | not 031 |
| 031 | Plain-English quota messages | 011 | **`js/store.js`**, i18n | 014 |
| 015 | Sign-in codes: rules and data layer | 031, 012 | **`firestore.rules`**, **`js/store.js`**, `js/app.js`, i18n, tests | 014, 020 |
| 016 | Sign-in codes: giving them out | 015 | `js/people/*.js`, `js/codes.js` (new), `js/store.js` (`syncRole`), i18n | 020–023 |
| 017 | One phone, several people (later; escalate first) | 016 | rules, `js/store.js` | – |
| 014 | Landing screen | 010, 011 | `js/app.js`, i18n, tests | 031, 020 |
| 020 | Setup helper: engine | 002 | `js/provision.js` (new), `js/countries.js`, tests | 010–014, 031 |
| 021 | Setup helper: screen + Google sign-in with the shared client | 020, 014, 011 | `js/mod-newchurch.js` (new), `js/store.js` (`google()`), i18n | 022 after |
| 022 | "Update the database rules" | 020, 012 | `js/mod-about.js` or settings, i18n | 023 |
| 023 | AI setup | 020, 002 | `js/provision.js`, `js/mod-settings.js` | 022 |
| 059 | Billing decisions (people) | – | docs | everything |
| 060 | Office project and rules | 001 | `office/` (new), tests | everything |
| 065 | Price table | – | `js/bigmac.js` (new) | everything |
| 061 | Licence check (enforcement off) | 016 | `js/licence.js` (new), **`js/store.js`**, `js/app.js` | 060, 063–065 |
| 062 | Register a church | 060, 021, 011 | `js/provision.js`, `js/office.js` (new), `js/mod-about.js` | 063, 064 |
| 063 | Office robot: trials and grants | 060, 061 | `robot/office.js` (new), workflow | 062, 064 |
| 064 | Owner's office page | 060, 063 | `office.html` (new) | 066 |
| 066 | Subscription screen and reminders | 061, 065 (059 for Pay) | `js/mod-settings.js`, `js/app.js`, i18n | 064, 067 |
| 067 | Payments in the robot | 063, 065, 059 | `robot/office.js` | 066 |
| 040 | New address | 021 tried end to end | `CNAME`, docs, `robot`, Android `APP_URL` | 041 |
| 041 | Android app for any church | 010, 040 | `android/` | 050 |
| 050 | Guides, brochure, terms, roadmap | 021 | docs, `brochure.html` | 041 |

The tasks that change `js/store.js` (013 → 012 → 011 → 031 → 015 → 016 → 061) go **one after another**, each from the merged
result of the one before. Give them to one agent, or wait for each merge.
