# Before Church Hub goes to other churches

While Church Hub is used by Christ Church Howick only, some work is saved up and done once, just before it is released.

## 1. Translate the 18 extra languages

English, Afrikaans, isiZulu, isiXhosa and Sesotho are translated with every change. The other 18 languages in
`js/lang/<code>.js` (German, French, Portuguese, Swahili, Yoruba and the rest) are not: a new text shows in English there
until this step. Home reminds Administrators every 3 days how many texts are waiting.

To do it, ask Claude (or another AI) in one session:

> Translate every missing line in the 18 extra languages (docs/RELEASE.md step 1), then run `RELEASE=1 node tests/i18n.test.js`.

- `ALL=1 RELEASE=1 node tests/i18n.test.js` lists every missing line for each language.
- Add each line next to a neighbouring English line (found with grep); don't read the whole files – they are large.
- Write real translations; never copy the English in. Keep the `{parts}` and any `<b>…</b>` exactly.
- Done when `RELEASE=1 node tests/i18n.test.js` passes.

## 2. Check the brochures and help pages

About → Brochures: check that every claim still matches what the app does.
