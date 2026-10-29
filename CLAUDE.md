# Working on Church Hub

- Plain HTML/CSS/JavaScript, no build step. Open `index.html` or the GitHub Pages site.
- Read `docs/ARCHITECTURE.md`, `docs/POPIA.md` and `docs/ROADMAP.md` before changing anything; update ROADMAP.md at the end of each session.
- New features are modules (`js/mod-*.js`) registered with `Hub.register`. Data goes through `Store` only, never localStorage directly.
- Rostering rules live in `js/roster.js` and must stay pure and tested: run `node tests/roster.test.js` before committing.
  The Leave Manager import (`js/leave-import.js`) and Elvanto import (`js/elvanto-import.js`) likewise: `node tests/leave-import.test.js`,
  `node tests/elvanto-import.test.js`. Test data is made up (`tests/fixtures`); never add a real export to the repository.
- Households and guardians rules: `js/households.js` (`node tests/households.test.js`); advanced people search: `js/people-search.js`
  (`node tests/people-search.test.js`) – only offer fields a role may see, never medical/pastoral notes or collection restrictions.
  The church's departments and positions (with the services each runs at): `js/serving.js`. Duplicates: `js/duplicates.js` (`node tests/duplicates.test.js`).
- Member-facing text goes through `T('…')` with a line in `js/i18n.js` for all four languages (`node tests/i18n.test.js`).
  18 more languages live in `js/lang/<code>.js` (loaded when chosen; a missing line shows in English) – add new lines there too when you can.
  Countries and their regions: `js/countries.js`; the privacy law by country: `js/privacy-law.js`; the church's own words: `js/wording.js`;
  care groups: `js/care.js` (`node tests/countries.test.js`, `tests/privacy-law.test.js`, `tests/wording.test.js`, `tests/care.test.js`, `tests/serving.test.js`).
  Say "household" on screens for a `families` record. Boxes that must be filled in get `class="field req"` (shaded, with a key); never write "(optional)".
- Elvanto updates for approved leave: `js/elvanto-sync.js` (`node tests/elvanto-sync.test.js`) and the robot `robot/robot.js`
  (`node tests/robot.test.js`). The robot's log is public: never print names, dates or emails.
- Who sees what is enforced by `firestore.rules`. Changing access means changing, together: `firestore.rules`, `plan()` in `js/store.js`,
  the POLICY copy in `tests/fake-firebase.js`, and `tests/rules.test.mjs` / `tests/app.test.js`. Run `node tests/app.test.js` (needs Playwright);
  GitHub runs everything, including the rules against the Firestore emulator, on every push. Tell the church to re-publish the rules (FIREBASE-SETUP.md step 7).
  Keep `firestore.rules` to plain keyboard characters (no curly quotes or dashes): the Firebase console rejects them.
- `js/leave-core.js` is a copy of `assets/core.js` from the `leave-manager` repository (also used by its Apps Script). Change both together.
- Privacy (POPIA): every new piece of personal information needs a purpose, a consent or lawful basis, an access rule by role, and audit logging for sensitive views. Never commit real church data, names, keys or passwords – the repository is public.
- Talk to the church in plain English; the users are not technical.
