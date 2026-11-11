# 040 – The new address

**Model:** A person for the clicks; a light model for the guide and the three small file changes.

**Goal:** Church Hub lives at its own address; the old one forwards; nobody at Christ Church Howick is locked out.

**Needs:** the address bought by the owner; 021 tried end to end.

**Order matters – a guide for the owner (`docs/NEW-ADDRESS.md`), then the changes:**
1. In Christ Church Howick's own project, **add** (do not replace): authorised domain; the address in the key's
   website list; the address in the reCAPTCHA key's domains. (FIREBASE-SETUP steps 3.4 and 8; AI-SEARCH-SETUP 3a.)
2. In Church Hub's Google identity (001): add the address as an authorised JavaScript origin; start verification.
3. GitHub Pages custom domain (`CNAME` file; DNS records); wait for the padlock.
4. Check sign-in at the new address for Howick (Google and email link) **before** step 5.
5. GitHub Pages then forwards the old address by itself. `robot` `SITE_URL` default and the Android `APP_URL`
   point to the new address (a new Android build).
6. Tell Howick's people: installed home-screen apps keep working through the forward but should be added again
   from the new address; they will sign in once more (the offline copy belongs to the old address).

**Files:** `CNAME`, `robot/robot.js` (default `SITE_URL`), `android/app/build.gradle` (`APP_URL`), docs, brochure
addresses.

**Roll back:** remove the custom domain in GitHub Pages; the old address serves again. Leave the added settings.

**Do not:** remove the old address from Howick's settings for at least a year.
