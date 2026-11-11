# 022 – "Update the database rules" for Administrators

**Model:** Middle; translations light.

**Goal:** when the website's rules are newer than the church's, an Administrator fixes it with one button.

**Needs:** 020 (`Provision.publishRules`), 012.

**Files:** `js/mod-about.js` (beside "Check for updates"), `js/app.js` (the banner from 012 now opens it), i18n,
`tests/app/admin.js`, `docs/help/`.

**Steps:** button → Google sign-in (must be an owner of the church's project; if Google says no permission:
"Sign in with the Google account that set Church Hub up for your church") → fetch `firestore.rules` fresh →
`publishRules` → re-check `Store.rulesAtLeast(Version.RULES)` → "Up to date". Log it in the audit log.
Hide the button where GitHub publishes the rules (the built-in church) unless the check says they are behind.

**Acceptance:** browser test: fake rules at version 1, website at 2 → banner → button → version 2 → banner gone,
gated module appears.

**Do not:** publish anything but the repository's own `firestore.rules`.
