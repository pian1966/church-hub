# 010 – Choosing the church (`js/church.js`)

**Goal:** the website can serve any church's project, chosen by `?c=<projectId>` and remembered on the device,
while Christ Church Howick sees no change.

**Read:** `TARGET.md` section 2.

**Files:** `js/church.js` (new), `index.html` (one `<script>` line before `js/firebase-config.js`), `sw.js` only if
its file list is explicit, `tests/church.test.js` (new, pure), `tests/app/signin.js` (one case), `CLAUDE.md` table
(one row), `docs/ARCHITECTURE.md` "Layers" (one line).

**Steps**
1. `Church` object, pure functions testable in Node (pass in `search`, a storage object):
   `resolve(search, storage, builtIn)` → `{ mode: 'demo'|'live'|'pending'|'none', config, projectId }` following the
   order in `TARGET.md` section 2. `save(storage, projectId, config)`, `forget(storage, projectId)`,
   `current(storage)`, `link(origin, path, projectId)`. A project id must match `^[a-z][a-z0-9-]{4,28}[a-z0-9]$`;
   anything else is ignored.
2. In the browser, at load: run `resolve`; for `live` from storage set `window.CHURCH_HUB_FIREBASE` before
   `firebase-config.js` runs (it already uses `||`); for `pending` set `window.CHURCH_HUB_PENDING`.
   For `none` on the current GitHub Pages address the built-in config still wins (rule 4) – so today nothing changes.
3. Do **not** change `js/store.js`. Do not fetch anything yet (011 adds the fetch; until then `pending` falls
   through to the built-in config).
4. Version: middle number up is not needed (nothing visible) – last number.

**Acceptance**
- `node tests/church.test.js` covers every row of the precedence list and rejects bad ids.
- Browser test: with no `?c=`, sign-in page appears exactly as before (existing tests pass untouched).
- With a saved config for `demo-other` and `?c=demo-other`, `window.CHURCH_HUB_FIREBASE.projectId` is `demo-other`.

**Do not:** read or write `localStorage` anywhere else; rename `CHURCH_HUB_FIREBASE`; alter `firebase-config.js`
values.
