# 031 – Plain-English messages when Google's free limits are reached

**Model:** Middle for the screens and words; the `err()` change in `js/store.js` is small but goes to the senior.

**Goal:** people are told what happened and what to do, instead of "Couldn't save this".

**Needs:** 011 merged (same file). Use the exact error codes recorded in `SPIKE-RESULTS.md` (question d).

**Files:** `js/store.js` (`err()` ~191, `sendLink` ~348), `js/app.js` (sign-in screen), `js/i18n/common.js` + all
`js/lang/*.js`, `tests/app/signin.js`.

**Steps**
1. Firestore `resource-exhausted`: "Church Hub has reached today's free limit for this church. It works again
   tomorrow morning (Pacific time midnight). Your Administrator can read more under About."
2. Email link refused for quota: "Today's sign-in emails are used up. Use **Sign in with Google**, or try again
   tomorrow." Put the Google button first on the sign-in screen whenever it is available.
3. About (Administrators): two lines explaining the free limits, in the church's words.

**Acceptance:** browser test with the fake returning each code shows each message; nothing else changes.

**Do not:** retry automatically; hide the email-link choice.
