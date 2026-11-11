# What in today's code affects this plan

Only things that matter for the plan or are a clear win. Cosmetic points are left out.

| # | Finding | Evidence | Impact | Effort | Task |
| --- | --- | --- | --- | --- | --- |
| 1 | The church is fixed when the page loads: one config in a file, and `LIVE` is worked out once. | `js/firebase-config.js`; `js/store.js` `var cfg`, `var LIVE` (near line 43) | Blocks many churches on one website. Cure is small: decide the church in a tiny script loaded first and reload to switch – no change inside `Store`. | Small | 010 |
| 2 | Device keys are shared by every church on the device. | `js/store.js` ~179 (`EMAIL_KEY`, `WHO_KEY`, `OWNER_KEY`), used ~284–416 | Someone in two churches (or a visiting minister) would have one church's sign-in wipe the other's copy. | Small | 013 |
| 3 | The email sign-in link returns to the bare address. | `js/store.js` ~348 (`url: location.origin + location.pathname`) | Opened on another device, the link would not know the church. | Tiny | 013 |
| 4 | Rules carry no version the app can read, and the website updates before the rules do. | `firestore.rules`; `publish-rules.yml` publishes to one project only | With many churches, a new feature would show "no permission" until each church updates. | Medium | 012, 022 |
| 5 | Every start loads whole lists through live listeners. | `plan()` `js/store.js` ~429–500; `extras()` ~583 | Fine for speed. On the free plan it sets reads per day; unknown for large churches. Measure before changing. | Measure: small | 030 |
| 6 | Google's "quota used up" is shown as a generic failure. | `err()` `js/store.js` ~191 handles only `permission-denied` and `unavailable` | With per-church free limits (5 sign-in emails a day; 50 000 reads) people need a plain reason. | Small | 031 |
| 7 | Website sign-in with Google uses a pop-up that needs a client made in each project's console; the Android path already signs in with a client id passed in. | `google()` `js/store.js` ~322–340; `js/app.js` ~545 | The Android path is the one that can be automated for every church. | Medium | 021 |
| 8 | Android app is tied to one church's address and name. | `android/app/build.gradle`: `applicationId 'org.christchurchhowick.churchhub'`, `APP_URL` | Other churches need an app that asks which church. A published app id cannot change. | Medium | 041 |
| 9 | The robot and the rules publisher read the project from `js/firebase-config.js`. | `robot/robot.js` `firebaseConfig()`; `.github/workflows/publish-rules.yml` | No problem while that file stays Howick's. Do not remove the file. | None | – |
| 10 | Archive files live inside the database (up to 15 MB each). | `docs/ARCHITECTURE.md` "Archive"; `Store.saveFile` | Good: nothing extra to set up. A church filing many large files will meet the 1 GB free limit; show how much is used. | Small, later | (roadmap) |
| 11 | "Who sees what" is written three times (rules, `plan()`, the test copy). | `firestore.rules`, `js/store.js` `plan()`, `tests/fake-firebase.js` POLICY | Existing cost, already guarded by tests. Not worth restructuring now; the plan adds only two small rules. | – | – |

Not found, and good news: no server code, no Cloud Functions, no Storage, no composite indexes, and all database
paths go through `js/store.js` (about 70 call sites in one file). That is why "one project per church" needs no
rewrite.
