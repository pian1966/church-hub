# 001 – Church Hub's own Google identity (done by a person, guided by the agent)

**Goal:** the "Sign in with Google / Allow" window has an owner that is not anyone's personal account.

**Why now:** 002 cannot run without a client id.

**Steps (write these as a click-by-click guide in `docs/HUB-IDENTITY.md`, in the style of `docs/FIREBASE-SETUP.md`,
then walk the owner through it):**
1. Create a Google account for Church Hub itself. Add a recovery phone and a second trusted person's recovery email.
2. In Google Cloud console create a project `church-hub-setup`. It will never hold church information.
3. OAuth consent screen ("Google Auth Platform → Branding"): app name Church Hub, support email, External.
   Leave it in **Testing** for now and add the owner's test Google accounts as test users.
4. Scopes ("Data access"): add `https://www.googleapis.com/auth/cloud-platform`.
5. Create an **OAuth client ID**, type Web application. Authorised JavaScript origins: the current website
   (`https://pian1966.github.io`) and, once it exists, the new address. No redirect URIs.
6. Give the client id (ends `.apps.googleusercontent.com`) to the agent. It is not a secret. There is no client
   secret to keep for this kind of use; if Google shows one, do not put it in the repository.

**Later (not part of this task; listed so nobody is surprised – see `RISKS.md` R1):** publish the consent screen and
ask Google to verify it: address proved in Search Console, privacy policy and home page on the address, a video of
the helper. Needed before the 100th account.

**Acceptance:** `docs/HUB-IDENTITY.md` exists; the client id is recorded in `docs/architecture/SPIKE-RESULTS.md`
(a new file) under "Client id"; no secret is in the repository.

**Do not:** use a personal account; add any other permissions; enable billing.
