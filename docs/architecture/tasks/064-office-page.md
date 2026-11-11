# 064 – The owner's office page

**Model:** Middle.

**Goal:** the owner sees every church and its standing, and can give a grant.

**Needs:** 060, 063.

**Files:** `office.html`, `js/office-page.js` (new; plain, English only, not part of the app shell, not cached by
`sw.js`), `css/hub.css` (reuse).

**Screen:** sign in with Google (must be an owner email) → table: church, country, set-up email, since, licence
kind and end date, last payment → filter (ending soon, ended, never paid) → **Give a free year** (reason required)
→ **Download as a spreadsheet**. Totals at the top.

**Acceptance:** works against the fake office; a non-owner sees "This page is for Church Hub's owner".

**Do not:** show or fetch anything from a church's own project.
