# 061 – The licence check (enforcement off)

**Model:** Senior.

**Goal:** the website can tell, offline and without trusting anyone, whether a church's subscription is current,
and can go view-only – but does not yet.

**Read:** `TARGET.md` 10.3–10.4, `RISKS.md` R11, R14, H7. **Needs:** 016 merged (the next `js/store.js` task).

**Files:** `js/licence.js` (new, pure) + `tests/licence.test.js`; `js/store.js` (`blocked()` gains a third reason;
Administrators copy the office licence into `public/hub.licence` at most once a day); `js/app.js` (banner, the
view-only line); `js/version.js` (`LICENCE_ENFORCED: false`); `js/mod-settings.js` (Settings → Subscription: status
and date only); i18n; `tests/app/admin.js`; `docs/LICENCE-KEYS.md` (how the owner makes the key pair with one
command and stores the private half as GitHub secret `LICENCE_KEY`; the public half goes in `js/licence.js`).

**Steps**
1. `Licence.parse(token)`, `Licence.verify(token, publicKeys, subtle)` (ECDSA P-256 / SHA-256, raw signature,
   base64url; async), `Licence.status(parsed, todayISO, { projectId, createdAt, enforced })` →
   `{ state: 'ok'|'soon'|'late'|'ended'|'trial'|'none', daysLeft, viewOnly }` exactly per the table in 10.4.
   A token for another `projectId` is invalid. A bad signature is "none", never an error screen.
2. Tests use a key pair generated inside the test (Node's `crypto.webcrypto`): valid, tampered date, wrong
   project, wrong key, each row of the table on both sides of each boundary, `enforced: false` never view-only,
   leap day, a token with unknown extra fields still verifies.
3. `Store.viewOnlyReason()`; `blocked()` refuses saves with one plain line when `status.viewOnly` – reuse the
   offline path. Downloads, exports and Privacy requests must still work.
4. The built-in church (Christ Church Howick) with no licence: state "none" and, while not enforced, no banner.

**Acceptance:** `node tests/licence.test.js`; full browser test; with the fake set to enforced + ended, a member
can read everything and change nothing, and an Administrator can still download.

**Do not:** set `LICENCE_ENFORCED` true; fetch the office project for anyone but an Administrator; treat a failed
fetch as unpaid.
