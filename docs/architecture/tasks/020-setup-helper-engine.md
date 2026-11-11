# 020 – Setup helper: the engine (`js/provision.js`)

**Goal:** the ten steps of `TARGET.md` section 4 as pure, tested, resumable code. No screen yet.

**Needs:** 002's results. Build only what `SPIKE-RESULTS.md` says worked; for "worked with a guided click", the step's
`run` returns `{ needsPerson: { url, say } }` and its `check` detects when the person has done it.

**Files:** `js/provision.js` (new), `js/countries.js` (`dataRegion`), `tests/provision.test.js` (new),
`tests/countries.test.js`, `tests/fixtures/google/` (canned replies), `index.html` (script line), `CLAUDE.md`
(table row; add `provision` to the list of pure rules files).

**Shape**
```
Provision.projectId(name, random)            // 'ch-' + slug + '-' + 4 letters, valid per Church id rule
Provision.steps(input)                       // input: { name, country, email, hubOrigin, clientId, rulesText }
  → [{ id, label, check(ctx), run(ctx) }]    // ctx: { fetch, token, projectId, state, log }
Provision.runAll(steps, ctx, onProgress)     // stops at first failure or needsPerson; returns state
Provision.poll(ctx, operationUrl)            // long-running operations, with a ceiling
Provision.publishRules(ctx, rulesText)       // step 5 on its own (used by 022)
```
- Every `run` is preceded by `check`, so running twice never creates two of anything.
- Errors become `{ step, code, plain }` where `plain` is a sentence for the screen; never include the token.
- `dataRegion(country)` per `TARGET.md` section 5; test that every country in `js/countries.js` gets an answer.

**Tests (Node, stand-in `fetch`):** happy path; resume after step 4; project id taken (retry with new random);
first-time terms; operation that never finishes; each step's failure gives a plain sentence; the token never
appears in logs or errors.

**Acceptance:** `node tests/provision.test.js` passes; no network in tests; nothing in the app calls it yet.

**Do not:** store the token; add permissions beyond `cloud-platform`; enable billing; create anything outside the
new project.
