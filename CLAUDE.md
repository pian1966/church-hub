# Working on Church Hub – the map

Plain HTML/CSS/JavaScript, no build step (`index.html`, or the GitHub Pages site). Talk to the church in plain English; the users are not technical.

**Don't read every doc at the start.** Use this page to find the file for the task, then read only the part that applies:
`docs/ARCHITECTURE.md` (find the section by its `##` heading) and, for anything touching personal information, the matching
section of `docs/POPIA.md`. `docs/ROADMAP.md` lists only work still to do; finished work goes to `docs/CHANGELOG.md`, which nobody needs to read.

## Which file does what
| Area | Code | Words (`T('…')`) | Tests |
|---|---|---|---|
| Shell: sign-in, roles, router, Home, UI helpers | `js/app.js` | `js/i18n/common.js` | `tests/app/admin.js`, `signin.js` |
| Data layer (demo or Firestore), who may ask for what (`plan()`) | `js/store.js`, `js/firebase-config.js` | – | `tests/rules.test.mjs`, `tests/fake-firebase.js` |
| Offline (view only): files kept on the device, the data copy, the notice | `sw.js`, `js/store.js` (`wipe`, `blocked`), `js/app.js` (`workOffline`) | `js/i18n/common.js` | `tests/app/offline.js` |
| People: registers the page, to-do list, upgrades, events | `js/mod-people.js` (loads last) | `js/i18n/people.js` | `tests/app/people.js` |
| People: shared helpers (who sees what, consent, ages, couples) | `js/people/core.js` | `js/i18n/people.js` | |
| People: the list and Church at a glance | `js/people/directory.js` | `js/i18n/people.js` | |
| People: a person's page (photo, notes, ID, guardians, homes, serving) | `js/people/profile.js` | `js/i18n/profile.js` | `tests/app/people-details.js` |
| People: Add / Edit details, consent, a death, marking as left | `js/people/edit.js` | `js/i18n/edit.js` | `tests/app/people-details.js` |
| Households, couples, late spouses, duplicates | `js/people/households.js`, `js/households.js`, `js/duplicates.js` | `js/i18n/households.js` | `tests/households.test.js`, `duplicates.test.js` |
| Advanced search, Change selected… | `js/people/search.js`, `js/people-search.js` | `js/i18n/search.js` | `tests/people-search.test.js`, `tests/app/people.js` |
| Rosters, services | `js/mod-rosters.js`, `js/roster.js`, `js/serving.js` | `js/i18n/rosters.js` | `tests/roster.test.js`, `serving.test.js`, `tests/app/roles.js` |
| Leave (Leave Manager built in) | `js/mod-leave.js`, `js/leave-core.js`, `js/leave-import.js` | `js/i18n/leave.js` | `tests/leave-import.test.js`, `tests/app/admin.js` |
| Me (members' own page) | `js/mod-me.js` | `js/i18n/me.js` | `tests/app/roles.js` |
| Care groups | `js/mod-care.js`, `js/care.js` | `js/i18n/care.js` | `tests/care.test.js`, `tests/app/care.js` |
| Life groups (Bible studies, midweek groups; care-group records with `type: 'life'`) | `js/mod-life.js`, `js/care.js` | `js/i18n/life.js` | `tests/care.test.js`, `tests/app/life.js` |
| Leadership (the Council, elders, leaders: roles, titles, portfolios; `leaderBodies`) | `js/mod-leaders.js`, `js/leaders.js` | `js/i18n/leaders.js` | `tests/leaders.test.js`, `tests/app/records.js` |
| Archive (minutes, plans, contracts, appraisals; who sees each record; files in parts) | `js/mod-archive.js`, `js/archive.js`, `js/store.js` (`extras`, `saveFile`) | `js/i18n/archive.js` | `tests/archive.test.js`, `tests/app/records.js` |
| Library (books, loans, librarians) | `js/mod-library.js`, `js/library.js` | `js/i18n/library.js` | `tests/library.test.js`, `tests/app/records.js` |
| Messages (inside the app; message groups) | `js/mod-messages.js`, `js/messages.js` | `js/i18n/messages.js` | `tests/messages.test.js`, `tests/app/messages.js` |
| Privacy pages, law by country | `js/mod-privacy.js`, `js/privacy-law.js` | `js/i18n/privacy.js` | `tests/privacy-law.test.js` |
| Import (Elvanto, Leave Manager), Elvanto updates, robot | `js/mod-import.js`, `js/elvanto-import.js`, `js/elvanto-sync.js`, `robot/robot.js` | `js/i18n/import.js` | `tests/elvanto-*.test.js`, `robot.test.js`, `tests/app/imports.js`, `elvanto-leave.js` |
| About (version, check for updates, developer) | `js/mod-about.js`, `js/version.js` | `js/i18n/common.js` | `tests/app/roles.js` |
| Brochures (printable, for members and for other churches; admins open them from About) | `brochure.html` | – (English) | `tests/versions.test.js`, `tests/app/roles.js` |
| Settings, countries, terminology, Translations | `js/mod-settings.js`, `js/countries.js`, `js/wording.js`, `js/mod-words.js` | `js/i18n/settings.js` | `tests/countries.test.js`, `wording.test.js`, `tests/app/languages.js` |
| Language engine, 19 more languages | `js/i18n.js`, `js/lang/<code>.js` | – | `tests/i18n.test.js` |
| Security rules | `firestore.rules` | – | `tests/rules.test.mjs` |
| Demo data | `js/sample.js` | – | |

The browser test is `node tests/app.test.js` (needs Playwright); it starts the browser and runs each part in `tests/app/` in turn.
GitHub runs every test, including the rules against the Firestore emulator, on every push (`.github/workflows/tests.yml`).

**Small changes – quick checks only.** For wording, translations, labels, help pages and docs, colours or spacing in
`css/hub.css`, and version numbers – no change to how anything works – don't run the browser test yourself: run the quick
ones (`for t in tests/*.test.js; do [ $t = tests/app.test.js ] || node $t > /dev/null || echo FAIL $t; done`, a few
seconds) and push. GitHub runs the full browser test on the pull request, and main can't be merged until it passes (the
"Protect main" ruleset requires it). If GitHub's test fails, fix it on the same branch. Anything else – new features,
changes to logic, `js/store.js`, `firestore.rules`, who sees what, the Android app – gets the full browser test before pushing.

## Rules
- New features are modules (`js/mod-*.js`) registered with `Hub.register`; a big module can be split like People
  (`js/people/*.js` share helpers through `PeopleParts`; add a new file to `index.html` before `js/mod-people.js`).
  Data goes through `Store` only, never localStorage directly.
- Rules files (`roster`, `leave-import`, `elvanto-import`, `elvanto-sync`, `households`, `people-search`, `duplicates`, `countries`,
  `privacy-law`, `wording`, `serving`, `care`, `messages`, `badges`, `leaders`, `archive`, `library`) stay pure and tested: run their `node tests/<name>.test.js` before committing.
  Test data is made up (`tests/fixtures`); never add a real export to the repository.
- Advanced search only offers fields a role may see – never medical/pastoral notes or collection restrictions.
- Member-facing text goes through `T('…')` with a line `[English, Afrikaans, isiZulu, isiXhosa]` in the `js/i18n/<area>.js` of the part
  that uses it (`common.js` if several parts use it). Every new line also goes in all 19 `js/lang/<code>.js` files: these are large,
  so don't read them – find a neighbouring English line with grep and add yours next to it. `node tests/i18n.test.js` fails if any language misses a line.
- Say "household" on screens for a `families` record. Boxes that must be filled in get `class="field req"`; never write "(optional)".
- Changing who sees what means changing, together: `firestore.rules`, `plan()` in `js/store.js`, the POLICY copy in `tests/fake-firebase.js`,
  and `tests/rules.test.mjs` / `tests/app/*.js`. Once merged, `.github/workflows/publish-rules.yml` tests and publishes the rules (when the church has set up
  `docs/RULES-AUTOPUBLISH.md`); until then, tell the church to re-publish them (FIREBASE-SETUP.md step 7).
  Keep `firestore.rules` to plain keyboard characters (no curly quotes or dashes): the Firebase console rejects them.
- `js/leave-core.js` is a copy of `assets/core.js` in the `leave-manager` repository (also used by its Apps Script). Change both together.
- The robot's log is public: never print names, dates or emails.
- Privacy (POPIA): every new piece of personal information needs a purpose, a consent or lawful basis, an access rule by role,
  and audit logging for sensitive views (read the matching section of `docs/POPIA.md`). Never commit real church data, names, keys
  or passwords – the repository is public.
- Every change that reaches the website raises the version in `js/version.js` (and its date): the middle number for new
  features, the last for fixes. Put the same number after every `?v=` in `index.html` (one find-and-replace), or browsers
  and phones keep their old copies; `node tests/versions.test.js` checks it. Language files follow automatically.
- Brochures: when a release adds a feature (middle number up), read `brochure.html` and add or change what members or other churches
  would notice – keep each panel within its A4 third – then set its `reviewed-for` to the new version (`node tests/versions.test.js` checks it).
  Never claim anything the app doesn't do, and no prices.
  The church can reword the brochures (About → Brochures → Edit): their edits are tied to the original wording, so a line you
  change stops carrying their edit of it (Church Hub lists it for them) – change wording only where the feature changed.
- Other AI agents (Jules and Antigravity / Gemini) work here too, guided by `AGENTS.md`, which points to this file: keep the rules here.
  Work on your own branch from the latest `main`; on a conflict in `js/version.js` / `index.html`, take the higher version.
- At the end of a session: tick finished work off `docs/ROADMAP.md` by moving it to `docs/CHANGELOG.md`, and add new to-dos.
