# Church Hub

Church Hub helps churches care for people and organise their work. It includes a people directory, households, consent and
privacy tools; service rosters and leave; Care Groups, Midweek Groups and leadership; messages; and a Library with
protected Archives for Administrators and Council members, alongside lending, reports and book records. Members can
update their details, serving and days away. Access is controlled by role, and each church uses its own Firebase project
and records.

- **Try the demo:** https://pian1966.github.io/church-hub/?demo (made-up people; changes stay in your browser)
- **Read first:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/POPIA.md](docs/POPIA.md) · [docs/ROADMAP.md](docs/ROADMAP.md) (to do) · [docs/CHANGELOG.md](docs/CHANGELOG.md) (done)
- **Going live:** [docs/FIREBASE-SETUP.md](docs/FIREBASE-SETUP.md) – the church's Firebase project, step by step
- **Android app:** [docs/ANDROID.md](docs/ANDROID.md) – members' own details, days away and serving on their phone · download: https://github.com/pian1966/church-hub/releases/download/android/ChurchHub.apk
- **Leave → Elvanto:** [docs/ELVANTO-ROBOT.md](docs/ELVANTO-ROBOT.md) – approved leave as Elvanto unavailability (robot)
- **Tests:** `node tests/<name>.test.js` for roster, leave-import, elvanto-import, elvanto-sync, households, people-search, duplicates, i18n and robot · `node tests/app.test.js` (the whole app in a browser, Playwright) · `tests/rules.test.mjs` (security rules, Firestore emulator). All run on GitHub after every push.

No real church data belongs in this repository – it is public.
