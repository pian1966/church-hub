# 012 – Rules versions

**Goal:** the website can tell how new a church's rules are, hides what needs newer rules, and never shows a member
a permission error because their church has not updated yet.

**Read:** `TARGET.md` section 6. **Needs:** 013 merged (same file).

**Files:** `firestore.rules`, `js/store.js`, `js/version.js`, `js/app.js` (`Hub.register`, Home), `tests/rules.test.mjs`,
`tests/fake-firebase.js`, `tests/app/admin.js`, `CLAUDE.md` (Rules section), i18n for one banner line.

**Steps**
1. `firestore.rules`, just under the helper functions:
   ```
   function rulesVersion() { return 1; }
   match /rulesAtLeast/{n} { allow get: if n.matches('^[0-9]+$') && int(n) <= rulesVersion(); allow list, write: if false; }
   ```
   Plain keyboard characters only.
2. `js/version.js`: `RULES: 1`.
3. `Store.rulesAtLeast(n)` → Promise<boolean>; live: `doc('rulesAtLeast/' + n).get()` – resolved = true,
   `permission-denied` = false, anything else (offline) = last known answer from this device, default true for the
   built-in church and false otherwise. `Store.rulesKnown()` synchronous = highest n known true this session.
   Demo: always true. Check once after sign-in for `Version.RULES`.
4. `Hub.register(mod)` accepts `needsRules`. Home and the router leave out modules with
   `needsRules > Store.rulesKnown()`. `plan()` and `extras()` get a helper `rulesOk(n)` to guard subscriptions.
   Nothing uses it yet – this task only builds the gate.
5. Banner for Administrators when `Store.rulesKnown() < Version.RULES`: one line and (for now) a link to
   `docs/FIREBASE-SETUP.md` step 7. Task 022 replaces the link with the button.
6. `tests/fake-firebase.js`: answer `rulesAtLeast/<n>` from a settable number. `tests/rules.test.mjs`: 1 allowed,
   2 denied, `abc` denied, list denied, write denied, works signed out.
7. `CLAUDE.md`: "Every change to `firestore.rules` raises `rulesVersion()` and `RULES` in `js/version.js`; anything
   that needs the new rules is gated with `needsRules` / `rulesOk`; the previous website must still work."

**Acceptance:** rules tests and full browser test pass; with the fake at version 0 an Administrator sees the banner
and a member sees nothing unusual.

**Do not:** change any existing rule; gate any existing module.
