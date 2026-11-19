# Working on Church & Trellis – the map

Plain HTML/CSS/JavaScript, no build step (`index.html`, or the GitHub Pages site). Talk to the church in plain English; the users are not technical.

**Don't read every doc at the start.** Use this page to find the file for the task, then read only the part that applies:
`docs/ARCHITECTURE.md` (find the section by its `##` heading) and, for anything touching personal information, the matching
section of `docs/POPIA.md`. `docs/ROADMAP.md` lists only work still to do; finished work goes to `docs/CHANGELOG.md`, which nobody needs to read.

## Which file does what
| Area | Code | Words (`T('…')`) | Tests |
|---|---|---|---|
| Shell: sign-in, roles, router, Home, UI helpers | `js/app.js` | `js/i18n/common.js` | `tests/app/admin.js`, `signin.js` |
| Data layer (demo or Firestore), who may ask for what (`plan()`) | `js/store.js`, `js/firebase-config.js` | – | `tests/rules.test.mjs`, `tests/fake-firebase.js` |
| Which church a page talks to (`?c=<projectId>`, remembered on the device; loads before `firebase-config.js`) | `js/church.js` | – | `tests/church.test.js`, `tests/app/signin.js` |
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
| Groups: one menu entry with tabs for Care Groups, Midweek Groups and Leadership (`inGroups: true`), "My groups" | `js/mod-groups.js`, `js/app.js` (`listed`, `groupMods`) | `js/i18n/common.js` | `tests/app/life.js` |
| Care groups | `js/mod-care.js`, `js/care.js` | `js/i18n/care.js` | `tests/care.test.js`, `tests/app/care.js` |
| Life groups (Bible studies, midweek groups; care-group records with `type: 'life'`) | `js/mod-life.js`, `js/care.js` | `js/i18n/life.js` | `tests/care.test.js`, `tests/app/life.js` |
| Leadership (the Council, elders, leaders: roles, titles, portfolios; `leaderBodies`) | `js/mod-leaders.js`, `js/leaders.js` | `js/i18n/leaders.js` | `tests/leaders.test.js`, `tests/app/records.js` |
| Archives (inside Library; minutes, plans, contracts, appraisals; role access; files in parts) | `js/mod-archive.js`, `js/mod-library.js`, `js/archive.js`, `js/store.js` (`extras`, `saveFile`) | `js/i18n/archive.js` | `tests/archive.test.js`, `tests/app/records.js` |
| Library (books, loans, librarians) | `js/mod-library.js`, `js/library.js` | `js/i18n/library.js` | `tests/library.test.js`, `tests/app/records.js` |
| Messages (inside the app; message groups; replies; what attendees may do – `Msg.attendeeCan`, `Hub.attendee()`) | `js/mod-messages.js`, `js/messages.js` | `js/i18n/messages.js` | `tests/messages.test.js`, `tests/app/messages.js` |
| Privacy pages, law by country | `js/mod-privacy.js`, `js/privacy-law.js` | `js/i18n/privacy.js` | `tests/privacy-law.test.js` |
| Import (Elvanto, Leave Manager), Elvanto updates, robot | `js/mod-import.js`, `js/elvanto-import.js`, `js/elvanto-sync.js`, `robot/robot.js` | `js/i18n/import.js` | `tests/elvanto-*.test.js`, `robot.test.js`, `tests/app/imports.js`, `elvanto-leave.js` |
| About (version, check for updates, developer) | `js/mod-about.js`, `js/version.js` | `js/i18n/common.js` | `tests/app/roles.js` |
| Brochures (printable, for members and for other churches; admins open them from About) | `brochure.html` | – (English) | `tests/versions.test.js`, `tests/app/roles.js` |
| Settings (incl. Attendees), countries, terminology, Translations | `js/mod-settings.js`, `js/countries.js`, `js/wording.js`, `js/mod-words.js` | `js/i18n/settings.js` | `tests/countries.test.js`, `wording.test.js`, `tests/app/languages.js` |
| Language engine, 22 more languages (Sesotho kept up to date; the other 21 before a release); Sesotho as written in Lesotho, made from `st.js` | `js/i18n.js`, `js/lang/<code>.js`, `js/sesotho.js` | – | `tests/i18n.test.js`, `sesotho.test.js` |
| Who can see what, in one place: roles, What Pastors can do, Attendees, Settings → Apps, each part's permissions and jobs (keepers) | `js/access.js` | (words of the parts that use it) | `tests/access.test.js` |
| Community board, Marketplace: keepers approve every notice and listing; the corkboard and photo cards (`css/community.css`); the latest 3 notices on Home and Me (`BoardUI.card`) | `js/mod-board.js`, `js/mod-market.js`, `js/community-ui.js` (shared screens), `js/community.js` (rules) | `js/i18n/board.js`, `market.js` | `tests/community.test.js`, `tests/rules.test.mjs` |
| Security rules | `firestore.rules` | – | `tests/rules.test.mjs` |
| Subscription: a coffee a month, payment holidays, gifts, paying for another church; the prayer circle and prayer cards (`homeCard` on Home) | `js/mod-support.js`, `js/coffee.js`; paying: PayFast through `tools/payfast-door.mjs` (`docs/PAYFAST-SETUP.md`) – never put bank or account details in the repository | `js/i18n/support.js` | `tests/coffee.test.js` (the doorway too), `tests/app/support.js` |
| Home: What’s new and Did you know? (tips by access level; add news to `NEWS` with its date) | `js/tips.js`, `js/app.js` (`tipsCard`, `homeTags`) | `js/i18n/tips.js` | `tests/tips.test.js`, `tests/app/records.js` |
| Demo data | `js/sample.js` | – | |
| Setup tool: sets up Church & Trellis at a new church from nothing (Google account, the church's copy on GitHub, Firebase, first sign-in, the settings before anyone joins) and keeps a come-back-later list of everything else a church can switch on, plus what's coming. English, one page outside the app | `site/setup.html` (the screens), `site/setup-kit.js` (the steps, the list, the rules) | – (English) | `tests/setup-kit.test.js`, `tests/versions.test.js` |
| Conference presentation (17 slides, speaker notes, three GIF clips; the last slide names the version it describes). The .pptx is the master copy; GitHub puts each new one into the Google Slides copy (`docs/SLIDES-AUTOPUBLISH.md`) | `docs/presentation/build.js`, `docs/presentation/capture.py`, `tools/publish-slides.mjs` | – (English) | |
| Public website for other churches (features, languages, the coffee price and prayer circle – prices copied from `js/coffee.js`; one file, English, not part of the app or its version) | `site/index.html` | – | |

The browser test is `node tests/app.test.js` (needs Playwright); it starts the browser and runs each part in `tests/app/` in turn.
GitHub runs every test, including the rules against the Firestore emulator, on every pull request and on main after each merge (`.github/workflows/tests.yml`; a branch is tested once its pull request is open) –
except when a change only touches the public website (`site/index.html`) or the documentation (`docs/`, `*.md`): then the check skips the tests and turns green at once.

**Small changes – quick checks only.** For wording, translations, labels, help pages and docs, colours or spacing in
`css/hub.css`, and version numbers – no change to how anything works – don't run the browser test yourself: run the quick
ones (`for t in tests/*.test.js; do [ $t = tests/app.test.js ] || node $t > /dev/null || echo FAIL $t; done`, a few
seconds) and push. GitHub runs the full browser test on the pull request, and main can't be merged until it passes (the
"Protect main" ruleset requires it). If GitHub's test fails, fix it on the same branch. Anything else – new features,
changes to logic, `js/store.js`, `firestore.rules`, who sees what, the Android app – gets the full browser test before pushing.

## Planned work (`docs/architecture/`)
Before doing any task in `docs/architecture/tasks/`, read `docs/architecture/DECISION.md` and `TARGET.md`, then the task file.
Choosing an AI for a task: `docs/architecture/MODELS.md` (which tier does what). Each task names its tier in its **Model** line.
A session should say which tier it is running at, and stop and ask if the task's tier is stronger than the session's.

## Rules
- New features are modules (`js/mod-*.js`) registered with `Hub.register`; a big module can be split like People
  (`js/people/*.js` share helpers through `PeopleParts`; add a new file to `index.html` before `js/mod-people.js`).
  Data goes through `Store` only, never localStorage directly.
- Rules files (`roster`, `leave-import`, `elvanto-import`, `elvanto-sync`, `households`, `people-search`, `duplicates`, `countries`,
  `privacy-law`, `wording`, `serving`, `care`, `messages`, `access`, `badges`, `leaders`, `archive`, `library`, `community`, `sesotho`, `tips`, `coffee`, `church`, and `site/setup-kit.js`) stay pure and tested: run their `node tests/<name>.test.js` before committing.
  Test data is made up (`tests/fixtures`); never add a real export to the repository.
- Advanced search only offers fields a role may see – never medical/pastoral notes or collection restrictions.
- Member-facing text goes through `T('…')` with a line `[English, Afrikaans, isiZulu, isiXhosa]` in the `js/i18n/<area>.js` of the part
  that uses it (`common.js` if several parts use it), **and** in `js/lang/st.js` (Sesotho, kept up to date like the other four):
  it is large, so don't read it – find a neighbouring English line with grep and add yours next to it. `node tests/i18n.test.js`
  fails if any of these five misses a line. **Don't** add new lines to the other 21 `js/lang/<code>.js` files: until Church & Trellis
  is released to other churches they are translated in one go (`docs/RELEASE.md`); meanwhile they show English, the test
  counts them, and Home reminds Administrators every 3 days. Never copy the English in as a "translation".
- **Screen layout** (every page the same, so the app feels like one app): `page-head` (h1, one-line lead, then buttons on the
  right) → tabs as `<nav class="seg">` *under* the title → the content. **One main button** (`btn primary`); other page actions in
  one `Hub.menu(T('More'), [buttons])`; a row's rare or destructive actions (purge, take out…) in `Hub.menu('⋯', [...], 'row-menu', label)`,
  never as big red buttons on every row. Don't show empty sections, empty filter tabs or two "nothing here" messages – show one
  friendly empty state with the main button. Fold search/sort/filters in a `<details>` until used. Sentence case for labels
  ("On loan", not "On Loan"). Required boxes get `class="field req"` (shading), not red asterisks. Check new screens at phone width (390px).
- Dropdowns: write a plain `<select>`; `findables()` in `js/app.js` turns every one into a box that opens the whole list and
  narrows it as you type (the select stays underneath and keeps the value, so `.value`, `change` and Playwright's `selectOption` work).
  `class="findable"` marks a list of names (its hint says so); `data-plain` leaves a select as it is. In tests, click `.find-in` to use the box.
- Say "household" on screens for a `families` record. Boxes that must be filled in get `class="field req"`; never write "(optional)".
- **Who can see what is kept in one place: `js/access.js`** (roles, What Pastors can do, Attendees, Settings → Apps, and each
  new part's permissions and jobs such as keepers). A new part adds an entry to its `PARTS` and asks `Hub.can('<part>.<what>')`
  – it never keeps its own access settings. A part not built yet can be marked `soon` there (a placeholder nobody sees).
- Changing who sees what means changing, together: `js/access.js`, `firestore.rules`, `plan()` in `js/store.js`, the POLICY copy in `tests/fake-firebase.js`,
  and `tests/rules.test.mjs` / `tests/app/*.js`. Once merged, `.github/workflows/publish-rules.yml` tests and publishes the rules (when the church has set up
  `docs/RULES-AUTOPUBLISH.md`); until then, tell the church to re-publish them (FIREBASE-SETUP.md step 7).
  Keep `firestore.rules` to plain keyboard characters (no curly quotes or dashes): the Firebase console rejects them.
- `js/leave-core.js` is a copy of `assets/core.js` in the `leave-manager` repository (also used by its Apps Script). Change both together.
- The robot's log is public: never print names, dates or emails.
- Privacy (POPIA): every new piece of personal information needs a purpose, a consent or lawful basis, an access rule by role,
  and audit logging for sensitive views (read the matching section of `docs/POPIA.md`). Never commit real church data, names, keys
  or passwords – the repository is public.
- Every change that reaches the website raises the version in `js/version.js` (`node tools/stamp-files.js` then writes its date and time – South African time – itself; don't type them): the middle number for new
  features, the last for fixes. Then run `node tools/stamp-files.js`: it gives each file in `index.html` (and each language
  file) a fingerprint of its contents after `?v=`, so phones download only the files that changed; `node tests/versions.test.js`
  checks it. Don't type `?v=` numbers by hand. On a merge conflict in `index.html` or `js/file-versions.js`, take either side and run it again.
- Brochures: when a release adds a feature (middle number up), read `brochure.html` and add or change what members or other churches
  would notice – keep each panel within its A4 third – then set its `reviewed-for` to the new version (`node tests/versions.test.js` checks it).
  Never claim anything the app doesn't do, and no prices.
- Presentation: keep it up to date. When a change alters anything the slides or their speaker notes say (or adds a feature
  worth showing), change `docs/presentation/build.js` and rebuild the .pptx in the same pull request (README there; new
  screenshots with `capture.py` when screens changed); when the middle number goes up, rebuild it anyway so its last slide
  names the new version. Never edit the Google Slides copy: it is replaced from the .pptx after each merge.
- **Setup tool** (`site/setup.html`, `site/setup-kit.js`): keep it in step with the app, in the same pull request.
  A new part of the app (a new `Hub.register` id) needs a `GROW` item (or a `STEPS` entry) with it in `mods`, or a `NOT_SETUP` line
  saying why – `node tests/setup-kit.test.js` fails until it has one. A feature an Administrator would switch on, fill in or set up
  gets a `GROW` item with `since` = its version (returning Administrators see it marked "New"); something on `COMING` that is now
  built moves to `GROW`; a change to `docs/FIREBASE-SETUP.md` (or to the shape of `js/firebase-config.js`) changes the matching
  step (or `configFile()`). When the middle number goes up, read `site/setup-kit.js` and set `reviewed-for` in `site/setup.html`
  (`node tests/versions.test.js` checks it). Plain, warm English for people who are not technical; never ask for passwords.
- What's new on Home: every release that changes what people see or can do – features and noticeable fixes – adds one plain
  sentence to the top of `NEWS` in `js/tips.js` (today's date; `who`/`not`/`app` so only the people it concerns see it), with its
  words in `js/i18n/tips.js` and `js/lang/st.js`. Add a Did you know? tip too when there's a new thing worth discovering. When the
  middle number goes up, set `NEWS_FOR` to it (`node tests/versions.test.js` checks it). When merging main into a branch, keep
  both sides' news lines.
  The church can reword the brochures (About → Brochures → Edit): their edits are tied to the original wording, so a line you
  change stops carrying their edit of it (Church & Trellis lists it for them) – change wording only where the feature changed.
- Other AI agents (Jules and Antigravity / Gemini) work here too, guided by `AGENTS.md`, which points to this file: keep the rules here.
  GitHub Copilot reads `.github/copilot-instructions.md` (also pointing here, with the rules it has missed): keep it in step.
  Work on your own branch from the latest `main`; on a conflict in `js/version.js` / `index.html`, take the higher version.
- At the end of a session: tick finished work off `docs/ROADMAP.md` by moving it to `docs/CHANGELOG.md`, and add new to-dos.
