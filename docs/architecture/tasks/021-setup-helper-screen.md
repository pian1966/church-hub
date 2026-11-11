# 021 – Setup helper: the screen, and Google sign-in with the shared client

**Goal:** a church Administrator creates their church's Church Hub in about a minute.

**Needs:** 020, 014, 011.

**Files:** `js/mod-newchurch.js` (new; reached from the landing screen, not a Home card), `js/store.js` (`google()`
only), `js/app.js` (route), `js/i18n/newchurch.js` (new) + all `js/lang/*.js`, `tests/app/newchurch.js` (new),
`docs/help/` (one page).

**Screen, in order**
1. Church name; country (the existing country list); the email of the first Administrator (filled from the Google
   account after step 2, editable).
2. "Use your **church's** Google account, not a personal one – whoever signs in here owns the church's information."
   **Sign in with Google** (Google Identity Services token client, client id from the hub's config).
3. "Your church's information will be kept in **<place>**. This can't be changed later." **Yes, continue**.
4. The steps ticking off, with the turning cross. A step that needs the person shows one sentence, one button that
   opens the right Google page in a new tab, and **I've done it**.
5. Done: the church's link and QR code (`js/qr.js`), **Copy link**, **Open Church Hub**; and "Add a second owner"
   (link to the project's access page, `RISKS.md` R7).
- Closing the tab and coming back offers **Continue setting up <name>**.
- Refuse the countries on the not-served list with the kind explanation (list in settings of the website, start
  with the roadmap's examples).

**Google sign-in for members:** in `google()`, when the church's config has `googleClientId`, use Google Identity
Services to get an ID token and `signInWithCredential` (as the Android branch does); otherwise the pop-up as today.

**Acceptance:** browser test with stand-in Google servers: full run, a guided-click step, resume, a failure message.
By hand, once, with a throw-away Google account: a new church works end to end, including a second person
signing in as a member.

**Do not:** show Google's words (project, API, Firebase) on the screen; keep the token after the run.
