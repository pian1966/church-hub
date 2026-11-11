# Which AI does which task

The aim: spend the expensive model only where a mistake would be costly or the reasoning is hard.
Names are tiers, not brands: use the cheapest tool you have in each tier (a small Claude model, Jules, or
Antigravity/Gemini on their free allowances all count as "light").

| Tier | Use for | Examples |
| --- | --- | --- |
| **Architect** (Fable) | Only what `RISKS.md` says to send back; designing new rules; a final read of security-rule changes | review the rules diff of 015 and 060 before merging; 017's design |
| **Senior** (Opus) | Anything that changes `firestore.rules`, `office/firestore.rules`, `js/store.js`, sign-in, the setup helper's engine, licence signing or checking, the robots | 011, 012, 013, 015, 020, 021 (the sign-in part), 060, 061, 063, 067 |
| **Middle** (Sonnet) | Screens and pure rules files with tests, following a design that is already written | 010, 014, 016, 021 (the screen), 022, 023, 030, 031, 041, 062, 064, 066 |
| **Light** (Haiku, Jules, Gemini free tier) | Mechanical work that a test checks | translations into the 19 `js/lang/*.js` files; version numbers; help pages; guides; brochure wording; changelog; the price table (065); fixtures |
| **A person** | Accounts, money, law | 001, 040 (the console clicks), 059 |

## Rules
1. **Never give a light or middle model** a task that edits security rules, `js/store.js`, sign-in or licence code.
   If such a task needs a small change there, stop and hand that part up.
2. **Split every feature task in two.** The senior or middle model writes the logic, the tests and the English
   (plus Afrikaans, isiZulu and isiXhosa in `js/i18n/`), and finishes by listing the new lines in
   `docs/architecture/handover/<task>-words.md`. A light model, on the **same branch**, then adds those lines to
   every `js/lang/<code>.js` (grep for a neighbouring line – never read the whole file), raises the version, updates
   the help page and the changelog, and runs the quick tests (`node tests/i18n.test.js`, `node tests/versions.test.js`).
   Most of the tokens in a Church Hub feature go on this second half.
3. **Light models finish with the quick tests only**; GitHub runs the full browser test on the pull request.
4. **One agent per shared file at a time** (`tasks/README.md`). Light-model work on language files conflicts with
   other light-model work on language files: one pull request at a time, or rebase before pushing.
5. If a cheaper model fails a task twice, move it up one tier rather than trying a third time.
6. Each task file starts with a **Model** line. It is a recommendation; rules 1 and 5 are not.
