# Church & Trellis

Church & Trellis helps churches care for people and organise their work. It includes a people directory, households, consent and
privacy tools; service rosters and leave; Care Groups, Midweek Groups and leadership; messages; and a Library with
protected Archives for Administrators and Council members, alongside lending, reports and book records. Members can
update their details, serving and days away. Access is controlled by role, and each church uses its own Firebase project
and records – set up with the setup tool below. It is built in parts (modules): a church switches on only what it needs
in Settings → Apps, and each part is its own `js/mod-*.js` registered with `Hub.register`.

- **Try the demo:** https://pian1966.github.io/church-hub/?demo (made-up people; changes stay in your browser)
- **Read first:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/POPIA.md](docs/POPIA.md) · [docs/ROADMAP.md](docs/ROADMAP.md) (to do) · [docs/CHANGELOG.md](docs/CHANGELOG.md) (done)
- **Set up Church & Trellis at a church:** the setup tool, https://pian1966.github.io/church-hub/site/setup.html – one friendly step at a time,
  from the church's Google account to the first sign-in, then a list of everything else the church can switch on
  (`site/setup.html`, `site/setup-kit.js`). The same steps written out in full: [docs/FIREBASE-SETUP.md](docs/FIREBASE-SETUP.md)
- **Public website:** https://pian1966.github.io/church-hub/site/ – what Church & Trellis does, the price, questions churches ask (`site/index.html`)
- **Android app:** [docs/ANDROID.md](docs/ANDROID.md) – members' own details, days away and serving on their phone · download: https://github.com/pian1966/church-hub/releases/download/android/ChurchHub.apk
- **Leave → Elvanto:** [docs/ELVANTO-ROBOT.md](docs/ELVANTO-ROBOT.md) – approved leave as Elvanto unavailability (robot)
- **Conference presentation:** [docs/presentation/](docs/presentation/README.md) – the slides that introduce Church & Trellis, their screenshots and clips, and how to make them again
- **Help for the church:** [docs/help/](docs/help/README.md) – questions and answers in plain English
- **Tests:** `node tests/<name>.test.js` for each rules file in `tests/` (rosters, imports, households, groups, messages, the setup tool, languages and more) · `node tests/app.test.js` (the whole app in a browser, Playwright) · `tests/rules.test.mjs` (security rules, Firestore emulator). All run on GitHub for every pull request, and on main after each merge.

No real church data belongs in this repository – it is public.
