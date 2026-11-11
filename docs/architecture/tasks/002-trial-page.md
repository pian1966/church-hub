# 002 – Trial page: prove every automatic step

**Goal:** know for certain which steps of `TARGET.md` section 4 work from a browser on a free project, before
building on them. Output is knowledge, written to `docs/architecture/SPIKE-RESULTS.md`.

**Needs:** 001 (client id). A throw-away Google account that has never used Google Cloud (to meet the first-time
terms), and one that has.

**Files:** `tools/trial/index.html` + `tools/trial/trial.js` (new; plain JS, no build; not linked from the app, not
cached by `sw.js`, not counted by `tests/versions.test.js`). `docs/architecture/SPIKE-RESULTS.md` (new).

**Steps**
1. The page: a box for the client id, a church name, a country, a **Start** button, and a log.
   Load Google Identity Services (`https://accounts.google.com/gsi/client`), request a token for
   `cloud-platform`, keep it in a variable.
2. One button per step of the table in `TARGET.md` section 4, plus **Run all**. Each logs the address called, the
   HTTP status and the first 300 characters of the reply. **Never log the token.**
3. Extra questions to answer, each with its own button:
   - a. Does `GET …/documents/public/hub` work with **no** key and no sign-in once rules allow it? With `?key=`?
   - b. Step 7 on a free project: does the `PATCH …/config` work straight away, or only after Authentication was
     opened once in the console? Try `POST identitytoolkit.googleapis.com/v2/projects/<p>/identityPlatform:initializeAuth`
     and record what it says without billing.
   - c. Google sign-in with the shared client: after `defaultSupportedIdpConfigs` is set with the client id from
     001 (try with an empty and with a made-up `clientSecret`), does
     `signInWithCredential(GoogleAuthProvider.credential(idToken))` succeed on the trial project? (Get the ID
     token with `google.accounts.id.initialize` + One Tap or the button.)
   - d. Email link: send six sign-in emails in a day; record the error code and message of the sixth.
     Then set the project's SMTP (`notification.sendEmail.smtp` in the same config) to a test mailbox and see
     whether the limit still applies.
   - e. AI: can `firebasevertexai`, `firebaseappcheck`, `recaptchaenterprise` be enabled; can a reCAPTCHA
     Enterprise key be made (`recaptchaenterprise.googleapis.com/v1/projects/<p>/keys`); can it be registered
     (`firebaseappcheck.googleapis.com/v1/projects/<p>/apps/<appId>/recaptchaEnterpriseConfig`); can AI Logic's
     Gemini Developer API be switched on without the console; does a test question then get an answer?
   - f. The first-time account: what exactly does step 1 return before Google Cloud's terms are accepted?
   - g. How long does Run all take?
   - h. Does a Google Workspace account with default settings manage step 1?
4. A **Delete the trial project** button (`DELETE cloudresourcemanager…/v3/projects/<p>`).
5. Write `SPIKE-RESULTS.md`: a table – step, worked / worked with a guided click / did not work, the exact error,
   what the helper should do. Paste no tokens, emails or project numbers of real churches.

**Acceptance:** results table complete for steps 1–10 and questions a–h; the owner has run it once on each kind of
account; trial projects deleted.

**Stop and escalate** (do not start 020) if step 1, 3, 4, 5 or 9 did not work.

**Do not:** touch `index.html`, `js/`, `firestore.rules`; point the page at Christ Church Howick's project.
