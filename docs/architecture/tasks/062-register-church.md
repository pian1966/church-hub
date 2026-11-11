# 062 – Registering a church with the office

**Model:** Middle; the last step in `js/provision.js` reviewed by the senior.

**Goal:** every church set up by the helper is on the office record; older ones can join with one button.

**Needs:** 060, 021, 011.

**Files:** `js/provision.js` (a last step), `js/mod-newchurch.js` (the one-sentence notice and a tick),
`js/mod-about.js` (**Register your church** for Administrators when `public/hub` has no `reg`), `js/office.js`
(new: a second Firebase app instance for the office project; `register`, `fetchLicence`), i18n, tests with the fake.

**Steps:** per `TARGET.md` 10.2. Random `reg` = 20 characters. Write the office entry first, then `public/hub.reg`;
if the second fails, retry on next Administrator visit. Show the church exactly what is sent.

**Acceptance:** fake-backed browser test: new church → office entry with the right email → `reg` matches.

**Do not:** send anything but name, country, the two emails and the project id.
