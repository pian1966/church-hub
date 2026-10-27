# Church Hub

A replacement for Elvanto for Christ Church Howick – people, rosters (families and friends kept together), staff leave (Leave Manager built in) and POPIA privacy tools.

- **Try the demo:** https://pian1966.github.io/church-hub/?demo (made-up people; changes stay in your browser)
- **Read first:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/POPIA.md](docs/POPIA.md) · [docs/ROADMAP.md](docs/ROADMAP.md)
- **Going live:** [docs/FIREBASE-SETUP.md](docs/FIREBASE-SETUP.md) – the church's Firebase project, step by step
- **Android app:** [docs/ANDROID.md](docs/ANDROID.md) – members' own details, days away and serving on their phone · download: https://github.com/pian1966/church-hub/releases/download/android/ChurchHub.apk
- **Leave → Elvanto:** [docs/ELVANTO-ROBOT.md](docs/ELVANTO-ROBOT.md) – approved leave as Elvanto unavailability (robot)
- **Tests:** `node tests/roster.test.js` · `node tests/leave-import.test.js` · `node tests/elvanto-import.test.js` · `node tests/app.test.js` (Playwright) · rules: see `tests/rules.test.mjs`. All run on GitHub after every push.

No real church data belongs in this repository – it is public.
