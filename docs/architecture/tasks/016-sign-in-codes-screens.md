# 016 – Sign-in codes: giving them out

**Goal:** an Administrator can give one person a code, print slips for many, and see and remove linked phones.

**Needs:** 015.

**Files:** `js/people/edit.js` (~361: Member access without an email is allowed), `js/people/profile.js` (App
access part), a small pure rules file `js/codes.js` + `tests/codes.test.js` (make a code, the link, the slip data,
expiry), `js/people/search.js` ("Change selected…" → Print sign-in slips), `js/qr.js` (reuse), `js/mod-settings.js`
(Settings → Apps: switch sign-in codes off; default on), `js/store.js` (`syncRole` ~793: No access / Mark as left /
a death removes the person's `devices` and unused `invites`), i18n, `css/hub.css` (print layout),
`tests/app/people-details.js`, `docs/help/` (two pages: for Administrators, for members), `brochure.html`.

**Steps**
1. `Codes.make(random)` → 8 characters from `23456789ABCDEFGHJKMNPQRSTUVWXYZ`, shown as `ABCD-EFGH`.
   `Codes.link(origin, path, projectId, code)` → `…/?c=<projectId>&j=<code>`. Expiry: 14 days.
2. Person page, Administrators only: **Give a sign-in code** → creates `invites/<code>` → shows QR, the code,
   **Send by WhatsApp** (`https://wa.me/<their mobile in international form>?text=…` with the link; if no mobile,
   plain `https://wa.me/?text=…`), **Print**. Audit-logged ("gave a sign-in code to …"; never the code itself).
   Giving a new code removes that person's unused older ones.
3. **Linked phones** under App access: date linked; **Remove** (deletes the device doc; audit-logged).
4. **Print sign-in slips**: for the selected people (Members with no linked phone), 8 slips to an A4 page: church
   name, the person's name, QR, code, "Works once, until <date>". One invite each. A warning first: "Hand each slip
   to the right person – whoever has it can sign in as them."
5. Wording for members avoids "code user", "anonymous", "device": say "this phone".

**Acceptance:** `node tests/codes.test.js`; browser test: give a code → use it in a second (fake) session → phone
appears under Linked phones → Remove → that session is refused. Slips print on one page per 8 people.
`node tests/i18n.test.js` passes.

**Do not:** offer codes for any role but Member; show a code again after the dialog is closed (give a new one
instead); put codes in the audit log, in exports or in searches.
