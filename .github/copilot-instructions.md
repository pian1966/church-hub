# Church Hub – instructions for GitHub Copilot

**Before changing anything, read `CLAUDE.md` (the project map and house rules) and `AGENTS.md` (how AI agents work here),
and follow them exactly.** They apply to Copilot too. When this file and `CLAUDE.md` disagree, `CLAUDE.md` wins.

The rules that matter most – and that were missed in November 2026:

## 1. Security rules: check every role, never just the one you're adding
- Who may see or change what is enforced by `firestore.rules`. When you give a role new access, also check that it can
  **only** reach what it should: a person who may manage *some* records must not be able to change, delete or replace the
  files of records they may **not** see, nor change a record so that they can see it (e.g. open up a private staff contract).
- Writes need the same limits as reads. A copy of a file (e.g. a preview) must be checkable against the original.
- Don't let a role grant itself access by writing to a list the rules trust; tie such lists to something visible
  (e.g. real membership of a leadership group).
- **Never write a test that approves a weakness** to make it pass. Tests in `tests/rules.test.mjs` should try the
  attacks: the wrong role, someone else's record, a private record, changing the access field.
- Firestore allows 1000 steps per request: check costly things (membership lookups) once per rule, not in every helper.
- Change `firestore.rules`, `plan()` in `js/store.js`, the POLICY copy in `tests/fake-firebase.js` and the tests together.
  Plain keyboard characters only in `firestore.rules` (no curly quotes or long dashes).

## 2. Screen layout: design the page, don't add another button
Follow "Screen layout" in `CLAUDE.md`. In short:
- Page title, a one-line explanation, **one main button**; everything else in one `Hub.menu(T('More'), [...])`.
- Tabs as `<nav class="seg">` **under** the title, the same on every page.
- A row's rare or destructive actions (purge, take out, mark lost) in its `Hub.menu('⋯', [...], 'row-menu', label)`,
  never a big red button on every row.
- Don't show empty sections, empty filter tabs or two "nothing here" messages. Fold search, sort and filters in a
  `<details>` until they are used. Sentence case ("On loan", not "On Loan"). Check every new screen at 390px wide.
- Before adding a setting, make sure something uses it, and put it where people would look for it.

## 3. Translations: translate, never copy the English
Every new screen text goes through `T('…')`, with a line in `js/i18n/<area>.js` (English, Afrikaans, isiZulu, isiXhosa)
**and** in all `js/lang/<code>.js` files. Write a real translation in each language – copying the English to make
`node tests/i18n.test.js` pass leaves those members reading English. Don't read the big language files: find a
neighbouring English line with grep and add yours next to it.

## 4. Every change
- Work on your own branch from the latest `main`; finish with a pull request. Never push to `main`.
- Raise the version in `js/version.js` and every `?v=` in `index.html`; update `docs/CHANGELOG.md` and `docs/ROADMAP.md`.
- Run the tests (`AGENTS.md`, "Running the tests") and make sure GitHub's checks are green.
- Keep code readable: short lines, one helper for one job (don't write the same logic twice), comments in plain English.
- The repository is public: never add real church data, names, emails, keys or passwords.
- Explain changes to the church in plain English, without code words.
