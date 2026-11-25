# Undo and Version history – the part for Opus

**Model: Senior (Opus).** Sonnet built the rules and the screens (below, 25 Nov 2026). Keeping versions means a new collection, `firestore.rules`
and `js/store.js`, so by `docs/architecture/MODELS.md` rule 1 a lighter model must not do the rest. **Nothing shows or changes in the app until
this is done** (`HistoryUI.ready()` is false until `Store.onVersion` and `Store.versions` exist).

The Rector asked for: (1) an Undo when a mistake is made, and (2) "go back in time" to restore an earlier version of Church & Trellis
data, as in Google Docs.

## Already built (Sonnet)
- `js/history.js` – pure rules, tested in `tests/history.test.js`: `entry()` (makes a version from a before and an after, never copies
  `medical`, `photo`, `idNumber`, `pin`), `merge()` (the same person changing the same record within 10 minutes is one version, so
  saving as you type doesn't flood the history), `forRecord()`, `prune()` (older than 90 days **and** more than 20 newer ones for that
  record), `restore()` (whole record or chosen fields; says when the record has changed since), and the device's Undo stack (last 20,
  within 30 minutes). `History.COVER` lists the collections that get a history: people, families, careGroups, services, positions,
  teams, groups, customGroups, leaderBodies, events, books, studies. Change that list in one place.
- `js/history-ui.js`, `css/history.css`, `js/i18n/history.js` (+ `js/lang/st.js`) – the Undo bar after a change (additions and
  deletions at once, edits after 2.5 seconds), and the **Version history** window (`HistoryUI.open(c, id, title)`; the button
  `HistoryUI.button(...)` is on a person's page for people who may edit). Undo and "put back" use the existing `Store.put` / `Store.remove`
  with an audit line, so they need nothing new from the data layer. People already has a **Bin** for deleted people (`js/people/bin.js`);
  Undo of a delete works for the other collections too and the Bin stays as it is.

## What the screens expect from `js/store.js`
1. `Store.onVersion(fn)` – `fn(entry)` after every local `put` / `remove` of a covered collection (build the entry with
   `History.entry(c, before, after, { id, name }, Store.now())`; `put` already has `prev`, `remove` already has `prev`). Do **not**
   fire it while loading or for changes that arrive from other devices (Undo is "this device"). Not when `blocked()` or viewing as
   another role.
2. `Store.versions(c, rid)` → `Promise<entry[]>` – that record's versions (the screen sorts them). Live: query the collection below
   by `c` and `rid`; demo: from memory.
3. Writing a version (Live): `history/{id}` – one write per change, folded with the latest version for that record by `History.merge`
   (read it back from a small in-memory map, not from Firestore, to keep the data bill low – Church & Trellis is meant to be gentle on
   data). `History.prune` run now and then (for example once a day by the first Administrator or Pastor who opens the app) deletes the old ones.
4. Demo mode: keep versions in `db.history` like the other collections.

## Rules and who may read (decide with the Rector if in doubt)
- Suggested: **Administrators and Pastors read versions of people and households**; the same people who may edit a record may read its
  versions for the other collections. Nobody else – a version holds the old contents of a record, so it is as private as the record
  (POPIA: add a section "Version history" – purpose: put right mistakes; kept 90 days; who sees it; audit-log a restore, which
  `put`/`remove` with the audit text already does).
- Create: only a signed-in person who may write the record itself, with `by` equal to their own id, `at` a string, `kind` in
  `edit|add|remove|restore`, `c` in the covered list, and `before` / `after` free of the private fields (`History.SKIP`). Update: no (versions are
  never changed after they are written, except when `merge` folds an edit in – allow that for the writer's own entry within 10 minutes).
  Delete: only the pruning (Administrators and Pastors), or purge of a person (POPIA deletion removes their versions too).
- Keep `firestore.rules` to plain keyboard characters. Change together: `firestore.rules`, `plan()` and COLLECTIONS in `js/store.js`,
  the POLICY copy in `tests/fake-firebase.js`, `tests/rules.test.mjs`, `js/access.js` if you add a permission, and then
  `docs/RULES-AUTOPUBLISH.md` says how the rules reach Firebase. Give the church **both links** for the rules (the standing instruction).

## When it works
- Release as a middle-number bump (new feature): `js/version.js`, `NEWS` + `NEWS_FOR` in `js/tips.js` (words in `js/i18n/tips.js` and
  `js/lang/st.js`) – suggested: "If you make a mistake, tap Undo; and on a person's page, Version history shows earlier versions and puts one back." –
  a Did you know? tip, brochure panel, the presentation (`docs/presentation/build.js`), the website (`site/index.html`), a help answer
  (`docs/help/`, add to `Help.PAGES`), and a `GROW` line in `site/setup-kit.js` (it needs no setup; or `NOT_SETUP`).
- Add `HistoryUI.button(...)` to the household page, Care Group, service and Leadership screens (only the person's page has it today).
- A browser test in `tests/app/` (add it to one of the four lists in `.github/workflows/tests.yml` **and** to the default list in
  `tests/app.test.js`): change a person's name, tap Undo, check it is back; delete a household, undo, check; open Version history, put one field back.
- Possible later: a church-wide "Recent changes" page for Administrators (the same versions, filtered by date and person).

## Paste this to Opus
> You are working on Church & Trellis (read `CLAUDE.md`, then `docs/architecture/MODELS.md` and `docs/POPIA.md`). Work on your own branch from
> the latest `main`. Read `docs/architecture/handover/history-opus.md`, then `js/history.js` and `js/history-ui.js`. Build the data-layer part:
> `Store.onVersion`, `Store.versions`, the `history` collection, its rules and tests, the POPIA section, and then the release steps in "When it works".
