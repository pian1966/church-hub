# Target design

Companion to `DECISION.md`. Written for the session that implements a task: precise, not plain-English.
"Proven by 002" means: do not build on it until `SPIKE-RESULTS.md` says it worked.

## 1. Shape

```
https://<hub address>/            static files (GitHub Pages) – one copy for every church
        ?c=<projectId>            which church: the church's own Firebase project
church's Google account ── owns ── Firebase project  ch-<slug>-<4 random>
                                     Firestore (default) in the region for the church's country
                                     Auth: Google + email link
                                     firestore.rules  (same file for every church)
                                     optional: AI Logic + App Check
```

No server, no Cloud Functions, no shared database of church information. The one central thing is the small
"office" record of which churches exist and whether they have paid (section 10).
Data model, collections, roles, `plan()`, offline copy: **unchanged** (`docs/ARCHITECTURE.md`, "Layers").

## 2. Which church? (`js/church.js`, new, loaded before `js/firebase-config.js`)

Today `cfg` and `LIVE` are fixed when `js/store.js` loads (`var cfg = window.CHURCH_HUB_FIREBASE`, `var LIVE = …`).
Keep that. Decide the church **before** `store.js` runs, synchronously, and switch church by reloading the page.

Order of precedence (first that gives a usable config wins):
1. `?demo` → demo, as today.
2. `?c=<projectId>` in the address → look up `localStorage['church_hub_church:' + projectId]` (a saved config).
   Found → use it, and remember it as the current church (`church_hub_current`).
   Not found → `window.CHURCH_HUB_PENDING = projectId`; the shell shows "Finding your church…", fetches the public
   card (section 3), saves it, and reloads.
3. `localStorage['church_hub_current']` → its saved config.
4. The built-in config in `js/firebase-config.js` (Christ Church Howick's, so the existing address and the installed
   Android app keep working with no change).
5. None → not live; the shell shows the landing screen (open my church's link / set up my church / try the demo).

`js/firebase-config.js` changes from `window.CHURCH_HUB_FIREBASE = window.CHURCH_HUB_FIREBASE || {…}` semantics only
in that `church.js` may already have set it. Keep the `||`.

Per-church device keys: `church_hub_signin_email`, `church_hub_who:`, `church_hub_offline_owner`
(`js/store.js` line ~179) get the project id appended, so two churches on one device never share them.
Firestore's offline copy is already per project.

Email link: `sendSignInLinkToEmail` (`js/store.js` ~348) must send `url: origin + pathname + '?c=' + projectId`
so a link opened on another device knows the church.

## 3. The public card (`public/hub`)

One document per project, readable by anyone, written only by Administrators (and by the setup helper):

```
public/hub = { name, country, apiKey, appId, googleClientId?, appCheckKey?, appCheckEnterprise?, rules: <number>,
               reg?, licence? }        // reg and licence: section 10
```

Rules: `match /public/{doc} { allow get: if true; allow list: if false; allow write: if admin(); }`
Nothing personal may ever go in it (add a rules check: `request.resource.data.keys().hasOnly([...])`).

Fetch without any key (proven by 002):
`GET https://firestore.googleapis.com/v1/projects/<projectId>/databases/(default)/documents/public/hub`
`authDomain` is always `<projectId>.firebaseapp.com`.
If 002 shows a key is required, the church link carries a longer code instead: base64url of
`{p, k, a}`; everything else stays the same.

## 4. The setup helper (`js/provision.js` engine + `js/mod-newchurch.js` screen)

Runs entirely in the Administrator's browser. Gets a short-lived Google access token with Google Identity Services
(`google.accounts.oauth2.initTokenClient`, scope `https://www.googleapis.com/auth/cloud-platform`), keeps it in
memory only, never stores or sends it anywhere but Google.

`provision.js` is pure and tested: `steps(input)` returns an ordered list; each step is
`{ id, label, check(ctx) → done?, run(ctx) }`, uses an injected `fetch`, and is safe to run twice.
Progress (step ids done, the project id) is saved in `localStorage` so "Continue setup" resumes after a closed tab.

| # | Step | Google address (all need `Authorization: Bearer <token>`) | Notes |
| - | --- | --- | --- |
| 1 | Create project | `POST cloudresourcemanager.googleapis.com/v3/projects` `{projectId, displayName}`; poll the operation | id = `ch-` + slug(name, ≤18) + `-` + 4 random letters. First-time Google Cloud users may have to accept Google's terms once: on that error show one button that opens `console.cloud.google.com` and "I've done it". |
| 2 | Switch services on | `POST serviceusage.googleapis.com/v1/projects/<p>/services:batchEnable` | `firebase`, `firestore`, `identitytoolkit`, `firebaserules`, `apikeys` (`.googleapis.com`) |
| 3 | Add Firebase | `POST firebase.googleapis.com/v1beta1/projects/<p>:addFirebase` (empty body); poll | |
| 4 | Create database | `POST firestore.googleapis.com/v1/projects/<p>/databases?databaseId=(default)` `{locationId, type:'FIRESTORE_NATIVE'}`; poll | `locationId` from the country (section 5). **Cannot be changed later.** |
| 5 | Publish rules | `POST firebaserules.googleapis.com/v1/projects/<p>/rulesets` with the text of `firestore.rules` (fetched from the site, `cache:'no-store'`), then create or patch release `cloud.firestore` | Reused by "Update the database rules" (section 6). |
| 6 | Register the website | `POST firebase.googleapis.com/v1beta1/projects/<p>/webApps` `{displayName}`; poll; `GET …/webApps/<id>/config` → `apiKey`, `appId` | |
| 7 | Switch on sign-in | `PATCH identitytoolkit.googleapis.com/admin/v2/projects/<p>/config` (`signIn.email.enabled`, `passwordRequired:false`, `signIn.anonymous.enabled` for sign-in codes (section 9), add the hub's domain to `authorizedDomains`); `POST …/defaultSupportedIdpConfigs?idpId=google.com` `{enabled, clientId: <Church Hub's shared web client id>, clientSecret}` | **Proven by 002** – two doubts: whether sign-in can be switched on by API on a free project, and whether Google sign-in accepts a shared client id. Fallbacks in `RISKS.md` R2. |
| 8 | Lock the key to the website | `apikeys.googleapis.com/v2`: find the browser key, set `browserKeyRestrictions.allowedReferrers` to the hub's address and `<p>.firebaseapp.com` | Replaces FIREBASE-SETUP step 8. |
| 9 | First Administrator and the public card | Firestore REST with the same token (owner access bypasses rules): `roles/<email lower-case> = {role:'admin'}`; `public/hub` (section 3) | Email = the Google account that ran the helper, unless they type another. |
| 10 | Finish | save the config locally, go to `?c=<p>` | The existing "Set up Church Hub" screen takes over. |

Members' Google sign-in on the website: use Google Identity Services with the shared client id to get an ID token,
then `auth.signInWithCredential(GoogleAuthProvider.credential(idToken))` – the path the Android app already uses
(`js/store.js` ~334–338). Keep `signInWithPopup` for projects whose card has no `googleClientId` (Howick today).

AI (optional second helper, task 023; all **proven by 002** first): enable `firebasevertexai`, `firebaseappcheck`,
`recaptchaenterprise`; create a reCAPTCHA Enterprise website key for the hub's domain; register it in App Check for
the web app; enforce App Check for AI Logic only; write `appCheckKey` to `public/hub`. If any part cannot be done by
API, AI stays a guided setup (`docs/AI-SEARCH-SETUP.md`) and is simply "off" until then.

## 5. Regions

`js/countries.js` gains `dataRegion(countryCode)` → a Firestore location id. Start small and explicit:
South Africa and the rest of Africa `africa-south1`; UK `europe-west2`; EU/EEA `eur3`; USA/Canada `nam5`;
Australia/NZ `australia-southeast1`; India `asia-south1`; everything else `eur3` until chosen.
The helper shows the place in words before step 4 ("Your church's information will be kept in Johannesburg").
The implementer must check each id against Google's current list of Firestore locations.

## 6. Rules versions (the one new moving part)

The website updates for every church at once; each church's rules update only when its Administrator clicks.
So the app must always work against **older** rules.

- `firestore.rules` gains, near the top: `function rulesVersion() { return 1; }` and
  `match /rulesAtLeast/{n} { allow get: if int(n) <= rulesVersion(); }`
- `Store.rulesAtLeast(n)`: a `get` of `rulesAtLeast/<n>` – allowed means the church's rules are at version n or newer;
  `permission-denied` means older. Cached per session. Cannot be faked by anyone, needs no writes.
- `js/version.js` gains `RULES` (the version shipped with this website) and each module may declare
  `needsRules: n` in `Hub.register`. A module whose rules are not there yet is hidden, and `plan()`/`extras()` must
  not subscribe to its collections (otherwise every member sees "permission" errors).
- Administrators see a banner when `RULES` is newer than the church's: **Update Church Hub's database rules** →
  Google sign-in (as the project's owner) → step 5 → done. Others see nothing.
- **Every change to `firestore.rules` raises `rulesVersion()`** and is written so the *previous* website still works
  against it and the *new* website still works against the previous rules. Add to `CLAUDE.md` when task 012 merges.
- Christ Church Howick keeps `publish-rules.yml` (GitHub publishes its rules); the banner then never shows there.

## 7. Limits a church lives within (free plan, per church)

50 000 document reads and 20 000 writes a day, 1 GB stored, 5 email-link sign-in emails a day.
`plan()` loads whole collections at each start, so reads per start ≈ the number of documents that role may see.
Task 030 measures this with the existing Speed check (`stats` in `js/store.js`) before anything is redesigned.
When Google refuses for quota (`resource-exhausted`), say so in plain words (task 031).

## 8. Not changing

Collections, document split (`people`/`details`/…), roles, household sign-in, "View as", offline (view-only),
Archive files in Firestore, the demo, the Elvanto robot (Howick only; it keeps reading `js/firebase-config.js`).

## 9. Signing in without an email address ("sign-in codes")

For members who have a phone but no email they use. Free, no daily limit, works in every church **beside**
Google sign-in and the email link – it replaces neither. Administrators, Pastors and other staff roles keep
using Google or the email link; a code can only ever make someone a **Member**.

### How it works for people
- Administrator: People → a person → App access → **Give a sign-in code**. Church Hub shows a QR code, a short
  code to type (8 letters and numbers, no look-alikes such as 0/O or 1/I), and **Send by WhatsApp**
  (opens WhatsApp with the link ready). **Print sign-in slips** makes a page of slips for many people at once
  (name, QR, code) – for the Sunday a church starts.
- Member: taps the link, scans the QR, or opens Church Hub and types the code → "You're signing in as
  **Thandi M.** – is that you?" → in. That phone stays signed in.
- A code works once and for 14 days. A new phone, or a phone whose browser was cleared, needs a new code.
- The Administrator sees each person's linked phones (date linked) and can remove one. **No access** and
  **Mark as left** remove them all.

### How it works underneath
Firebase **anonymous** sign-in gives the phone a permanent, secret account id (`uid`) with no email. Two new
collections tie that id to a person:

```
invites/{code}   = { personId, name: 'Thandi M.', role: 'member', expires: <timestamp>, by, createdAt,
                     usedBy?: <uid>, usedAt? }
devices/{uid}    = { role: 'member', roles: ['member'], personId, also: [], people: {}, invite: <code>,
                     linkedAt }          // same shape as roles/{email}, so every other rule works unchanged
```

Rules (sketch – the implementer writes and tests the real thing):
```
function codeUser() { return request.auth != null && request.auth.token.firebase.sign_in_provider == 'anonymous'; }
function signedIn() { return request.auth != null && (request.auth.token.email_verified == true || codeUser()); }
function roleRef()  { return codeUser()
    ? /databases/$(database)/documents/devices/$(request.auth.uid)
    : /databases/$(database)/documents/roles/$(request.auth.token.email.lower()); }

match /invites/{code} {
  allow get: if request.auth != null;            // knowing the code is the key; never list
  allow list: if false;
  allow create, delete: if admin();
  allow update: if codeUser()                    // the phone marks it used, in the same write as its link
    && resource.data.get('usedBy', '') == '' && request.time < resource.data.expires
    && onlyChanges(['usedBy', 'usedAt']) && request.resource.data.usedBy == request.auth.uid
    && existsAfter(/databases/$(database)/documents/devices/$(request.auth.uid));
}
match /devices/{uid} {
  allow get: if request.auth != null && request.auth.uid == uid;
  allow read, delete: if admin();
  allow delete: if request.auth != null && request.auth.uid == uid;      // signing out unlinks the phone
  allow create: if codeUser() && request.auth.uid == uid
    && request.resource.data.role == 'member' && request.resource.data.roles == ['member']
    && request.resource.data.also == [] && request.resource.data.people == {}
    && get(/databases/$(database)/documents/invites/$(request.resource.data.invite)).data.personId == request.resource.data.personId
    && getAfter(/databases/$(database)/documents/invites/$(request.resource.data.invite)).data.usedBy == uid;
  allow update: if false;
}
```
The phone writes both documents in one batch, so a code can never be used twice and a link can never exist
without a spent code.

Other places that assume an email and must be handled (evidence: `firestore.rules` lines 24, 64, 70, 461;
`js/store.js` has 11 uses of `session.email`):
- `audit` create insists on `byEmail == token.email` → for a code user allow `byEmail == 'code:' + uid`.
- `roles/{email}` read rule and `robot()` must not be reached with a missing email (guard with `codeUser()` first).
- `startSession` (`js/store.js` ~375) reads `roles/{email}` → for an anonymous user read `devices/{uid}`; where
  the session's email is used as a device key or shown, use `'code:' + uid`.
- People → Edit details refuses access without an email (`js/people/edit.js` ~361) → allow **Member** with no
  email, by code.
- Sign out for a code user = delete `devices/{uid}`, sign out, wipe – after a warning that a new code is needed.

Setup: the helper's step 7 also sets `signIn.anonymous.enabled: true`. Christ Church Howick: one switch in the
console (Authentication → Sign-in method → Anonymous), documented in the task.

Gated by rules version (section 6): the "Give a sign-in code" button and the "I have a code" box only appear
when the church's rules are new enough.

### What it does not protect against (say so in `docs/POPIA.md`)
- **Whoever holds the slip is that member**, exactly as whoever reads an inbox is that email's owner today.
  A member sees their own details, the church directory, their rosters, groups and messages – never staff-only
  information. Cures: single use, 14 days, the "is that you?" question, the linked-phones list, and the audit log.
- Anyone on the internet can create an anonymous account in a church's project; without a spent code it can read
  nothing but `public/hub`, `rulesAtLeast` and (by exact id only) an invite.

## 10. The Church Hub office: a record of churches, and the yearly subscription

Decided 11 Nov 2026 by the owner: Church Hub keeps a small central record of the churches that use it (for billing),
and continued use depends on a yearly subscription. This is the **only** central data; it never includes anything
about a church's people.

### 10.1 What is kept, and where
A second, tiny Firebase project owned by Church Hub's own Google account (task 001) – "the office". Free plan.

```
churches/{projectId}  = { name, country, ownerEmail,        // the Google account that set the church up
                          contactEmail, createdAt, reg,     // reg: a random proof string, see 10.2
                          verified?: true }                 // set by the robot
licences/{projectId}  = { token }                           // see 10.3; anyone may get one by id; only the robot writes
payments/{id}         = { projectId, amount, currency, minimum, paidAt, provider, ref, extra }   // robot only
grants/{projectId}    = { until, why, by }                  // owner only: a free year, a waiver, Christ Church Howick
```
Office rules: a signed-in, verified Google user may create `churches/{projectId}` once, with
`ownerEmail == their own email`, and later change only `name`, `contactEmail`, `country`; may read only their own.
Owner emails (a short list in the rules) read everything and write `grants`. `licences`: `get` for anyone, no
`list`. `payments`: nobody but the robot (which uses a service account and so bypasses rules).

The church is told, at setup, in one sentence: "Church Hub keeps your church's name, country and this email address
to send your yearly reminder and receipt. Nothing about your people ever leaves your church's own Google account."

### 10.2 Registering (and proving the church is yours)
The setup helper, as a last step, signs the Administrator in to the office project with the same Google account
(Google Identity Services ID token → `signInWithCredential` on a second Firebase app instance), writes
`churches/{projectId}` with a random `reg`, and writes the same `reg` into the church's own `public/hub`.
Only an Administrator of that church can write its `public/hub`, so the robot can check the two match
(reading the public card) before it trusts a registration. A registration that does not match after a day is
ignored and may be overwritten. Churches set up by hand (and Christ Church Howick) get a
**Register your church** button under About.

### 10.3 The licence (how "paid" is known without a server)
A licence is a short signed note: `base64url(JSON{ p: projectId, until: 'yyyy-mm-dd', kind: 'trial'|'paid'|'grant' })
+ '.' + base64url(signature)`, signed with an ECDSA P-256 private key that exists only as a GitHub secret.
The website carries the matching **public** key(s) (`js/licence.js`, an array so a key can be replaced) and checks
the signature with the browser's built-in WebCrypto. Nobody without the private key can make one.

- The robot writes the newest licence to the office `licences/{projectId}`.
- An Administrator's Church Hub fetches it at most once a day (one read on the office project) and copies it into
  the church's own `public/hub.licence`. Everyone else reads it from their own church, as part of what they
  already load – so members never touch the office project, and it works offline.
- `public/hub` allowed keys therefore include `reg` and `licence` (task 011 already lists them).

### 10.4 What the app does with it (`Licence.status(token, today, church)` – pure, tested)
| Situation | Members | Administrators |
| --- | --- | --- |
| Valid, more than 30 days left | nothing | Settings → Subscription shows the date |
| Valid, 30 days or fewer left | nothing | a kind banner: renew |
| Ended up to 60 days ago | nothing | banner every visit; a note on Home |
| Ended more than 60 days ago | **view-only** (as offline is today: `blocked()` in `js/store.js`), with one line saying why | view-only + **Pay** button; can still download everything |
| No licence yet, church younger than 30 days (trial) | nothing | "Register your church" if not registered |
| No licence, older than 30 days | view-only | view-only + Register / Pay |

Never deleted, never locked out of reading or downloading: the information is the church's own.
`Version.LICENCE_ENFORCED` (false until the owner switches it on) – while false, only the banners show and nothing
becomes view-only. The office being unreachable never makes anything worse: the last copied licence is used.

**Plain truth about enforcement:** Church Hub's code is public and each church owns its database, so this is a
lock on the official website, not on the data. A technical person could run their own copy without it. That is
accepted; it keeps honest churches honest and costs nothing to run.

### 10.5 The price
- **One Big Mac a year at the church's own country's price**, from The Economist's Big Mac index
  (`js/bigmac.js`: country → local price and currency, with the index date; updated when the index is, twice a year).
  Countries not in the index: the nearest listed neighbour named in the table, otherwise the US price.
- **Plus an optional extra gift** – any amount, with a sentence inviting the church to think what Church Hub is
  worth to it and what it can afford.
- The robot, not the website, decides whether enough was paid: amount ≥ the minimum for the registered country on
  the day of payment (10% tolerance for exchange rates).
- A church in hardship asks the owner; the owner records a `grant` and the robot issues a licence.

### 10.6 The office robot (`.github/workflows/office-robot.yml`, `robot/office.js`)
GitHub Actions on a timer (every 15 minutes, like the Elvanto robot; free). Secrets: the office service-account
key, the licence private key, the payment provider's secret key. Each run:
1. New registrations: read the church's public card; `reg` matches → `verified: true` and a **trial** licence
   (30 days from `createdAt`).
2. Grants → a **grant** licence.
3. Payments: ask the provider for successful payments since the last run; each carries the `projectId` it was for;
   record in `payments`; enough → a **paid** licence until one year after the later of today and the current end.
4. The log is public: counts and project ids only – never names, emails or amounts.

### 10.7 Reminders
In the app, to Administrators (10.4). Receipts come from the payment provider. Reminder **emails** from the robot
are a later step (needs an email account as one more secret).

### 10.8 Still to decide (people, not agents – task 059)
Who receives the money and how it is taxed (it is income, not a donation, unless a registered non-profit runs it –
ask an accountant); which payment provider; the terms a church accepts. Not legal or financial advice.
