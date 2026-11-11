# 023 – AI for "Ask in your own words", set up by the helper

**Goal:** an Administrator switches AI on without the 15-minute guide, using the church's own Google project
(never anyone else's).

**Needs:** 020; `SPIKE-RESULTS.md` question e. Build only the parts that worked. If the Gemini switch-on cannot be
done by API, make that one a guided click and automate the rest.

**Files:** `js/provision.js` (`aiSteps`), `js/mod-settings.js` (Settings → Apps → AI), `js/store.js` (read
`appCheckKey` from the church's config – already does), tests, `docs/AI-SEARCH-SETUP.md` (becomes the by-hand route).

**Steps:** privacy tick first (the sentence from AI-SEARCH-SETUP step 1, and the Administrator confirms the
Information Officer agrees) → enable services → reCAPTCHA key for the hub's address → register in App Check →
enforce App Check for AI Logic **only** → save `appCheckKey` to `public/hub` → try one built-in question.

**Acceptance:** stand-in tests; by hand once on a throw-away project: a question is "Understood by AI".

**Do not:** enforce App Check for Firestore or Authentication; send any records.
