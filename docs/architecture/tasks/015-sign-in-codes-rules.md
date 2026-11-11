# 015 – Sign-in codes: rules and data layer

**Model:** Senior. The rules diff is read by the architect before merging.

**Goal:** a phone with no email can be linked to one Member by a single-use code. No screens for giving codes yet
(016); this task ends with a working "I have a code" box and tests.

**Read:** `TARGET.md` section 9 (all of it), `RISKS.md` R3a–R3c, `docs/POPIA.md` (access section).
**Needs:** 031 merged (same files; this is the fifth `js/store.js` task in the chain) and 012 (rules gate).

**Files:** `firestore.rules` (raise `rulesVersion()` and `RULES`), `js/store.js` (`Live`: `boot`, `startSession`,
sign-out, a new `claimCode`), `js/app.js` (sign-in screen: **I have a code**; `?j=<code>` in the address),
`js/church.js` (keep `j` beside `c`), `tests/rules.test.mjs`, `tests/fake-firebase.js` (POLICY copy + anonymous
users), `tests/app/signin.js`, `js/i18n/common.js` + all `js/lang/*.js`, `docs/POPIA.md`, `docs/ARCHITECTURE.md`.

**Steps**
1. Rules as sketched in `TARGET.md` section 9. Write them out properly; keep plain keyboard characters. Go through
   **every** use of `request.auth.token.email` (lines 24, 64, 70, 461 today) and make each safe for a user with no
   email. `audit` create: allow `byEmail == 'code:' + request.auth.uid` for a code user.
2. `Store.claimCode(code)`: normalise (upper-case, strip spaces and dashes) → `auth.signInAnonymously()` if not
   signed in → `get invites/<code>` → not found / used / expired → plain messages → resolve with `{ name }` for the
   "is that you?" question. `Store.confirmCode()` → one batch: `devices/<uid>` + mark the invite used → then
   `startSession`. If they answer **No**, sign the anonymous user out and change nothing.
3. `startSession`: an anonymous user reads `devices/<uid>` instead of `roles/<email>`; no document → sign out and
   show "This phone isn't linked any more – ask your church for a new code". Session identity where an email was
   used as a key or label: `'code:' + uid`.
4. Sign out as a code user: confirm ("You'll need a new code to come back") → delete `devices/<uid>` → sign out →
   `wipe()`.
5. Everything new is behind `rulesOk(<this version>)`: on older rules the box is not shown.
6. Rate limit from Google (`auth/too-many-requests` or the code recorded in `SPIKE-RESULTS.md`): "Lots of people
   are joining right now – please try again in a little while."

7. `docs/FIREBASE-SETUP.md` step 3: add "**Add new provider → Anonymous → Enable → Save** (lets members without an
   email sign in with a code from the church; on its own it lets nobody see anything)". Tell Christ Church Howick to
   do this once; until then the code box says "Sign-in codes aren't switched on for this church yet".

**Rules tests (each must be there)**
- anonymous user, valid code → can create own `devices` doc + mark invite used in one batch; afterwards reads what
  a Member reads and nothing a Member can't.
- same code a second time → denied. Expired code → denied. Device doc without marking the invite → denied.
  Marking the invite without the device doc → denied.
- device doc with `role: 'admin'`, or `roles` other than `['member']`, or another `personId` than the invite's →
  denied. Updating a device doc → denied. Creating a device doc for another uid → denied.
- anonymous user with no device doc → reads nothing except `public/hub`, `rulesAtLeast/*`, an invite by id.
- `list` on `invites` and on `devices` denied to non-admins.
- an email user's access is exactly as before (run the whole existing suite unchanged).
- Administrator deletes a device doc → that phone's next read is denied.

**Acceptance:** rules tests and the full browser test pass; with the fake, a code user gets in, sees Me, signs out,
and the code cannot be reused.

**Do not:** let a code grant anything but `member`; store codes anywhere but `invites`; print or log a code;
change what Members can see; touch the household (shared email) sign-in.
