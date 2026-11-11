# 041 – Android app for any church

**Goal:** one Android app that asks "which church?" once (paste the link or scan the QR), then behaves as today.

**Needs:** 010, 040.

**Files:** `android/` (a second product flavour: new `applicationId`, name "Church Hub", `APP_URL` = the new
address with no church), `.github/workflows/build-android.yml`, `docs/ANDROID.md`.

**Steps:** flavours `howick` (unchanged id – existing installs keep updating) and `hub`. In `hub`, links of the
form `<address>/?c=…` open in the app (intent filter + Digital Asset Links file on the website). Native Google
sign-in uses the shared web client id from 001 for `hub`. Camera permission only if QR scanning is added; otherwise
paste the link.

**Acceptance:** both flavours build in GitHub Actions; `hub` opens a church from a tapped link; `howick` behaves
exactly as before.

**Do not:** change `org.christchurchhowick.churchhub` or its signing key.
