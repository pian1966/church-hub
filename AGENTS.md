# Church Hub – for AI coding agents (Jules, Antigravity / Gemini and others)

**Read `CLAUDE.md` first and follow it exactly.** It is the project map (which file does what) and the house rules,
written for Claude but meant for every agent working on Church Hub. When this file and `CLAUDE.md` disagree, `CLAUDE.md` wins.

The rules people most often miss:
- Every new piece of screen text goes through `T('…')`, with a line in `js/i18n/<area>.js` (English, Afrikaans, isiZulu,
  isiXhosa) **and** in all 18 `js/lang/<code>.js` files. `node tests/i18n.test.js` must pass.
- Every change that reaches the website raises the version in `js/version.js` (and its date) and puts the same number
  after every `?v=` in `index.html`. `node tests/versions.test.js` must pass.
- Changing who may see what means changing `firestore.rules`, `plan()` in `js/store.js`, `tests/fake-firebase.js` and
  the tests together – and telling the church to re-publish the rules.
- The repository is public: never add real church data, names, emails, keys or passwords.
- The church is not technical: explain changes in plain English, without code words.

## Working alongside Claude
Claude also works on this repository, often at the same time.
- Start every task from the latest `main`, on your own branch, and finish with a pull request. Never push to `main`.
- If you run on someone's computer (Antigravity), before changing any file run `git switch main`, `git pull`, then
  `git switch -c <short-name-for-the-task>`. When done, push that branch and open a pull request (or tell the person how).
- Keep a pull request to one job. If GitHub says it has conflicts (often in `js/version.js` and `index.html`), update the
  branch from `main` and take the higher version number.
- At the end, move finished work from `docs/ROADMAP.md` to `docs/CHANGELOG.md`, as `CLAUDE.md` says.

## Running the tests
Plain HTML/CSS/JavaScript, no build step; Node 22.
- Rules files and languages: `node tests/<name>.test.js` (the list is in `.github/workflows/tests.yml`).
- The browser test: `npm i --no-save playwright@1 && npx playwright install chromium`, then `node tests/app.test.js`.
- The security rules test needs the Firestore emulator (Java): `npm i --no-save firebase-tools@15 @firebase/rules-unit-testing@6 firebase@13`,
  then `npx firebase emulators:exec --only firestore --project demo-church-hub "node tests/rules.test.mjs"`.
GitHub runs all of them on every push; a pull request should be green before it is merged.
