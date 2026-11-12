# Church Hub – architecture

Church Hub replaces Elvanto for Christ Church Howick, learning from Elvanto, Planning Center and ChurchSuite.
It is built in phases; each phase is usable on its own. **Read this file first in every new working session.**

## Principles
1. **Clean and self-explanatory.** Every screen says what it is for in one line; every action is a plain-English button. No jargon, no hidden menus.
2. **Apps as cards.** Each area (People, Rosters, Leave, Privacy…) is a *module* that registers itself and appears as a card on Home. Modules can be switched on or off in Settings. New features = new modules, without touching the others.
3. **POPIA by design.** Privacy rules are part of the data model, not an add-on (see `POPIA.md`).
4. **Explainable rostering.** No random rostering. Families and friends who want to serve together are kept together; people who must not serve at the same time are kept apart; every suggestion says why.
5. **Phone first, works on a computer.** One web app, installable on phones; the Android app is the same wrapper as Leave Manager (`android/`, `docs/ANDROID.md`).

## Layers
```
index.html                the single page app (no build step)
css/hub.css               design tokens + components
js/firebase-config.js     the church's Firebase project (empty = demo mode)
js/store.js               data layer: Store.get/put/remove/audit – demo (this browser) or live (Firestore)
js/roster.js              RosterCore: the rostering engine (pure functions, unit-tested)
js/leave-core.js          LeaveCore: Leave Manager's leave rules (copy of leave-manager/assets/core.js – keep in step until Leave Manager is retired)
js/leave-import.js        LeaveImport: reads a Leave Manager sheet (Excel or CSV tabs) and plans the import (pure, tested)
js/xlsx-lite.js           XlsxLite: small built-in .xlsx reader (zip + XML; no outside library)
js/elvanto-import.js      ElvantoImport: reads an Elvanto People export and plans the import (pure, tested)
js/elvanto-sync.js        ElvantoSync: when a leave change needs an Elvanto "Unavailable Volunteers" update (pure, tested)
js/households.js          Households: households, parents/guardians, couples and late-spouse suggestions (pure, tested)
js/people-search.js       PeopleSearch: Advanced search filters and logic (pure, tested)
js/duplicates.js          Duplicates: finding and merging people entered twice (pure, tested)
js/serving.js             Serving: the church's regular services (settings.serviceSlots; 8am, 10am, 5pm until changed), departments and positions as in Elvanto
js/i18n.js                I18n: the language engine and the list of more languages (tested)
js/i18n/<area>.js         the words in English, Afrikaans, isiZulu, isiXhosa – one file per part of the app (common.js for shared words)
js/lang/<code>.js         one file per further language (18, by continent), loaded only when someone chooses it (tested)
js/countries.js           Countries: 46 countries – regions (province/state/county…), postcode wording, dialling code, law (tested)
js/privacy-law.js         PrivacyLaw: the law the Privacy pages follow, from the church's country (POPIA, GDPR, UK GDPR…; tested)
js/wording.js             Wording: the church's own words (sets by denomination + renamed words), applied to the screens (tested)
js/care.js                Care: care groups – who is in which group, carers, and the card the group sees (tested)
js/messages.js            Msg: messages inside the app – who each audience is, who may send to whom, unread (tested)
js/leaders.js             Leaders: leadership groups (Council, elders, leaders) – roles, titles, portfolios, served before (tested)
js/archive.js             Archive: church records – categories, who sees a record, files cut into parts (tested)
js/library.js             Library: the church's books – copies in and out, lending, returning, overdue (tested)
js/sample.js              made-up church for demo mode and tests
robot/robot.js            the Elvanto robot (GitHub Actions, every 15 min): does the waiting Elvanto updates (docs/ELVANTO-ROBOT.md)
js/app.js                 shell: sign-in, roles, router, Home, module registry, UI helpers (search matching, photos and
                          "Choose the face", the turning cross for long jobs, downloads)
js/mod-*.js               one file per module: me, people, rosters, leave, care, messages, privacy, import, settings, words (Translations)
js/people/*.js            the People module in parts: core, directory, profile, edit, households, search (mod-people.js puts them together)
android/                  the Android app: shows the website full screen + native Google sign-in (docs/ANDROID.md)
manifest.webmanifest      home-screen icon and name (iPhone "Add to Home Screen", Android browsers)
sw.js                     service worker: keeps Church Hub's files on the device so it opens without the internet (see Offline)
firestore.rules           database security rules: who may read/write what (POPIA)
tests/*.test.js           one per pure rules file above (roster, leave-import, elvanto-import, elvanto-sync, households,
                          people-search, duplicates, i18n, countries, privacy-law, wording, serving, care, messages) and the robot
                          (robot.test.js); made-up data in tests/fixtures
tests/rules.test.mjs      security rules (Firestore emulator)
tests/app.test.js         the app in a browser as every role, demo and live (live uses tests/fake-firebase.js); its parts are in tests/app/*.js
.github/workflows/tests.yml  runs all of these on GitHub after every push
```

### Data layer contract
Reads are synchronous from an in-memory copy (`Store.list('people')`); writes (`Store.put`, `Store.remove`) update the copy immediately and persist in the background.
Modules never know which mode they are in (apart from `Store.isLive()` for sign-in wording).

**Demo mode** (no Firebase settings, or `?demo` in the address): made-up people from `sample.js`, saved in this browser.

**Live mode**: Firebase Authentication (Google or email link) and Firestore in Johannesburg. Setup: `docs/FIREBASE-SETUP.md`.
- *Access list* `roles/{email}` = `{ role, personId }`. Only Administrators write it, from People → Edit details → App access
  (`No access` deletes it). The first Administrator is added by hand in the console, then Church Hub asks them to set up the church.
- *A shared sign-in*: people who share one email address (often a couple, up to 4) share `roles/{email}`. It keeps the first
  person (strongest role) in `role`/`personId`, and adds `roles` (every role among them, which the rules check), `also` (the others'
  ids, at most 3; the rules' `isMe()`/`meIn()` accept any of them) and `people` ({ id: { role, name, can, langs } }). After signing
  in they choose who is using Church Hub (`stage: 'choosePerson'`, remembered on that device until sign-out) and can switch
  (Switch person); Church Hub then loads as that person with their own role. `syncRole` rebuilds the entry from every person record
  with that email and access, and only removes it when it was that person's. Only Administrators can share a Pastor's or
  Administrator's sign-in. Security: the inbox is the key, so whoever reads it can be any of them – the rules allow the union.
- *One person, several documents*, because security rules protect whole documents, not fields. `store.js` splits on save and
  joins on load, so modules still see one person object:

  | Document | Holds | Read by |
  | --- | --- | --- |
  | `people/{id}` | name, household, category, email, mobile, active, app role (display copy), `photo` (version of their photo, if any), date added | Admin, Pastor, Roster coordinator, Children's ministry; the person |
  | `details/{id}` | everything else about the person: birthday, gender, middle name, home address, marital status, late spouse, key dates (wedding, died, funeral), staff details, Church Partner dates, date of death, "unknown" email/mobile, Elvanto ID (+ copy of family role) | Admin, Pastor; Children's ministry for children; the person |
  | `medical/{id}` | children's allergies and medical notes | **Children's ministry only** |
  | `notes/{personId}` | pastoral notes (`entries` list) | **Pastors only** |
  | `officeNotes/{personId}` | church office notes (`entries` list; Elvanto's Notes come here) | Admin, Pastor |
  | `elvantoFound/unavailable` | what the robot read in Elvanto's Unavailable Volunteers: names and dates only | **Admin only** (the robot writes it) |
  | `idNumbers/{personId}` | ID number (`value`) – fetched one at a time on **Show**, or all at once for an advanced search on ID number (a filter only, never a column or download); every view and search audit-logged | **Admin only**; the person sees their own |
  | `photos/{id}` | the photo (`data`: a 320 × 320 JPEG), fetched only when shown | adults: staff, the person, members when the adult is in the directory; children: Admin, Pastor, Children's ministry |
  | `directory/{id}` | name, mobile and `photo` version of adults with *Church directory* consent | everyone signed in |
- *Leave*: `leave/config` (types, levels, rules, holidays, `autoApprove`), `leaveRequests/{id}`, `leaveAdjustments/{id}`.
  `away/{id}` holds approved leave as dates only, so rosters and "Who's away" work without showing anyone's leave type or reason.
- Everything else is one document per item (`families`, `consents`, `teams`, `positions`, `skills`, `services`,
  `assignments`, `groups`, `blockouts`, `dsr`, `breaches`, `audit`, `settings/church`).
- Each role only subscribes to what `firestore.rules` lets it read (`plan()` in `store.js`), so nothing is refused.
  **When changing who sees what, change `firestore.rules`, `plan()` in `store.js`, the POLICY copy in `tests/fake-firebase.js`
  and the tests together.**
- Saves are written in the background; if the database refuses one, the person sees a plain-English message.
  Without the internet Church Hub shows the copy kept on the device and is view-only (see Offline).
  Changes made by others appear automatically (unless the person is typing or has a dialog open).

### Collections
| Collection | Holds |
| --- | --- |
| `settings` | church name, modules on/off, Information Officer, retention period, privacy notice |
| `people` | name (and middle name), contact, household(s), category (Church Partner, Attender, Visiting Minister, Staff, Former member, Deceased), gender, home address, marital status (adults), late spouse, Church Partner dates, staff details (leave category, start date, working days – staff keep their category, so a Church Partner can be staff), key dates, date of death, child medical notes (special personal information), Elvanto ID; the photo, ID number and office notes are kept apart (see above) |
| `families` | households: `name` + `custom`. Shown via `Hub.familyName()`: named after its active adults ("Tim & Clare Jacobs", "Thandi Mokoena & Sipho Dlamini") unless `custom` is true; no "head of household". A person's main household is `familyId`; extra households (children of separated parents) are `householdIds` |
| `guardians` | the adults responsible for a child, independent of households: { childId, adultId \| name + phone, relationship, canConsent, primary, mayCollect, confirmed } (`js/households.js`) |
| `noCollect` | people **not allowed to collect** a child (e.g. a court order): { childId, personId \| name, note } – restricted, every view logged |
| `consents` | per person and purpose: given/withdrawn, date, how, recorded by, guardian for children. Also what they'd **like to receive** (weekly notices by email, prayer needs and missionary updates by WhatsApp or email, "Who is Jesus" on WhatsApp) – a choice never ticked isn't recorded |
| `notes` | pastoral notes (restricted) |
| `teams`, `positions`, `skills` | departments, positions and who serves where, how often (`frequency`) and at which services (`times`, service ids such as ["08:00","10:00"] or "09:30@hilton-hall"; empty = every service). The regular services are `settings.serviceSlots` – { id, label, day, time, venue } – set in Settings → Services and venues (8am, 10am and 5pm until changed); a roster `service` carries its `slot` and `venue`. A position's `times` are the services it runs at (Creche Duty only at 08:00; Memorial Teas: `memorial`). Rosters → Teams adds the church's 8 departments and 26 positions in one click (`js/serving.js`); a person's **Volunteering** (People) writes their `skills`. Each slot may also carry `theme` (Serving.THEMES: colour and picture), `moods` (words) and `special: true` (special services: Memorial, Christmas, Maundy Thursday, Tenebrae, Good Friday, Easter Sunday, Ascension and the church's own, with `feast` = its name in Serving.specials for the next date; only positions that name it run there, also in RosterCore via `specialSlots`; `removed: true` hides one), chosen under **Rosters → Services**, which also switches positions on and off per service (`Serving.toggleTimes`; `['none']` = no service). Me → Serving shows the services first, then their departments and positions (`Serving.structure`) |
| `services` | dates and times of services/events needing a roster |
| `assignments` | person × position × service, status pending/accepted/declined, why |
| `groups` | serve **together** (must/prefer) or keep **apart** |
| `blockouts` | away dates people enter themselves |
| `serveOffers` | a person's request to join a position, serve more/less often, or stop: { personId, positionId, kind join\|change\|stop, frequency, times (services chosen; empty = every service), note, status waiting\|declined, reply }. The person creates and withdraws their own; Administrators and Roster coordinators answer (Yes changes `skills` and deletes the offer; Not now sets `declined` + `reply`) |
| `leave` | Leave Manager data in LeaveCore format (types, categories, requests, holidays, terms, adjustments, rules) |
| `dsr` | POPIA data-subject requests (access, correction, deletion, objection) |
| `breaches` | security-compromise register (POPIA s22) |
| `audit` | who viewed or changed sensitive information, and when |
| `wordIdeas` | suggested better wording: { lang, en (the English text), text, note, personId, name, status waiting\|used\|declined, reply, reviewedBy, reviewedAt } |
| `messages` | a message to a group or chosen people: { kind care\|group\|staff\|partners\|people, groupId, audience (its name, or the one chosen person's), some (only some of a group), title, body, fromId, fromName, to: [personIds worked out when sent], readBy: [personIds] } – see Messages below |
| `msgGroups` | message groups (e.g. Worship team leaders): { name, memberIds, leaderIds, names } – Administrators and Pastors manage them |
| `leaderBodies` | a leadership group (Council, elders…): { name, open, memberIds, names, seats: { personId: { role, title, portfolios, from, to } }, past: [served before] } – see Leadership below |
| `archive` | a church record: { title, cat, date, note, access all\|body\|office\|private, bodyId, aboutId, aboutName, shownTo, link, file: { name, type, size, parts }, by }; its file is in `archive/{id}/parts/{n}` = { data: base64 } – see Archive below |
| `books`, `loans` | the Library: a book { title, author, cat, copies, acquired, how, from, shelf, isbn, note, out } and a loan { bookId, title, personId, name, out, due, back } – see Library below |
| `words` | approved wording, one document per language (`words/zu` = { words: { English: wording }, updatedAt, by }), used before the built-in translations |

### Roles (enforced in the screens and by the database security rules, `firestore.rules`)
| Role | Can |
| --- | --- |
| Administrator | everything, including Privacy, Import and Settings – **except reading pastoral and medical notes** (can delete them for a deletion request) |
| Pastor | people, families, birthdays, consent, pastoral notes |
| Roster coordinator | rosters, teams, away dates; people's names and contact details only |
| Children's ministry | children (incl. birthdays), guardians, medical notes, medical/photo consent |
| Member | own details (can correct name and contact), own consent, own serving and away dates, offers to serve, own leave (if staff); the church directory |
| No access | kept on the church records, can't sign in |

Leave approval follows Leave Manager: Administrators approve.

### View as another role (Administrators and the Senior Pastor)
The **Senior Pastor** (Rector; Settings → What Pastors can do) can also use it, for the roles below their own: Roster coordinator,
Children's ministry, a carer or a Member (`viewHome()`/`viewChoices()` in `js/app.js`; `Store.preview` checks their sign-in is the
Senior Pastor's). Offers to serve are only loaded for all if they may answer them themselves (the rules check their own sign-in).
An Administrator can switch to **View as** Pastor, Roster coordinator, Children's ministry or Member (the eye next to their name,
or More on a phone) to see what that role sees. `Store.preview(role)` makes `role()` in `js/store.js` the viewed role, so `plan()`
loads only what that role would load – less than an Administrator, never more: pastoral notes (Pastors) and medical notes
(Children's ministry) are left out, because the rules don't let an Administrator read them. The screens follow it through
`myRole()` in `js/app.js`. Nothing is saved while viewing (`put`, `remove`, `setSettings`, `saveLeave`, photos, ID numbers are
refused with a message); audit entries are still written, marked "(viewing as …)", and starting and stopping is logged.
**Carer**: the Administrator chooses a care group and sees it on the Me page as its carer does (`Store.preview('member', groupId)` loads that group and its cards). It is not remembered: refreshing or signing in again returns to Administrator. No rules change: the database still sees the
Administrator's own sign-in.

## Me (members' own page) and the Android app
`js/mod-me.js` – **Me**, for everyone: *My details* (contact details they may change, what the office keeps, consent,
language, sign out), *Days away* (their blockouts and approved leave; warns about roster turns on those days) and
*Serving* (turns to accept, where they serve, offers to serve). It reuses the People and Rosters actions (`people:edit`,
`people:consent`, `rosters:addaway`, `rosters:delaway`, `rosters:reply`), so the rules stay in one place. On phones the
tab bar shows Me first for members (staff get their working areas first).
**Offers to serve** go to `serveOffers` (see Collections); roster coordinators answer them at the top of Rosters → Teams,
with a Home to-do. A declined offer shows the reply under the position until the person taps OK.
**Changes to family details** (`js/people/changes.js`, collection `detailChanges`): from Me → My details a person asks for
a new marital status, wedding anniversary, spouse or partner (a name) and children (one per line). Only Administrators
see them (People → Changes, Home to-do). Yes saves the marital status and anniversary; if a spouse or children were named
the request stays as `checked` until the Administrator has added them to the household and taps Done (deleted). Don't
change sets `declined` + `reply`, shown on Me until the person taps OK. One request per person at a time.
**Leave** is hidden from Church Partners (Member access) unless they are staff who take leave; staff with Member access
keep My leave and Who's away. (Approved leave still reaches every signed-in person as dates only, for rosters – see
`away` in firestore.rules.)
**Android app** (`android/`, built by `.github/workflows/build-android.yml`, setup in `docs/ANDROID.md`): a WebView
showing the website, built like Leave Manager's app (its own signing key). It offers the camera next to the gallery when a
page asks for a picture (photo saved in the app's cache, shared with the camera app only through a FileProvider), and
`ChurchHubApp.saveFileBase64(name, type, base64)` does the same for Archive files (PDFs, pictures).
`ChurchHubApp.saveFile(name, type, text)` saves downloads in the phone's Downloads (`Hub.download()` uses it; older app
versions are asked to update). It adds `window.ChurchHubApp`; when present,
`Store.live.google()` asks Android's account picker for a Google ID token and signs in with
`signInWithCredential` (needs `googleWebClientId` in `firebase-config.js`), and after "Email me a link" the person pastes
the link from the email (Google's sign-in pop-up and email links can't open inside an app). Members open on `#/me`;
`window.churchHubBack()` lets the back button close a dialog first.

## Contact details by role (Settings → Who can see what)
The page has three panels (0.44): *What each kind of access can do* (with who has it), *Other people's contact details* (a grid:
rows = mobile, email, address, spouse; columns = Basic access, Roster coordinator, Children's ministry) and *Care groups* (a grid of
what each may see). The last two save together by themselves (`data-autoscope`). Each choice has an "i" tip (`Hub.tip`).
**Care group on a person's page** (`settings.careOnPeople`, Basic access): the "Care group member · …" tag on people's pages and in
the directory, decided separately from the Care groups page (`seeCare` has 'member'); not set yet = follows `seeCare` as before.
Either one makes `syncDirectory` put the groups (names only) on `directory/{id}.care` (`careForMembers` in `js/store.js`).

`settings.seeOthers` = { member: [...], rosters: [...], kids: [...] } with any of mobile, email, address, spouse (name only when
empty, the default). `Store` syncDirectory writes `directory/{id}` (name, photo + the member list) and `contacts/{id}`
(address, spouse – if Roster coordinators or Children's ministry may see them) for adults with the "Church directory"
consent; Settings → Save rewrites everyone (`Store.resyncDirectory()`). Screens use `PeopleParts.mayShare(p, field)` and
`contactHtml(p, field)`: links for staff and leaders, `textPicture()` (a canvas image) for Church Partners.
The same table has a **Care groups** tick for Roster coordinators and Children's ministry (`settings.seeCare`, see Care groups).

## About (`js/mod-about.js`, `js/version.js`)
For everyone, and can't be switched off. Shows the version and its date from `js/version.js`, the Android app's version
(`ChurchHubApp.version()`), the church, the developer, and links to the privacy notice, the changelog and the code.
Check for updates (also run once when the page opens) fetches `js/version.js?t=…` from the website without the browser's
copy and compares the numbers; a newer one offers Update now (reload). In the Android app it also reads the newest app
from GitHub's `android` release ("Church Hub for Android 1.0.16") and offers the download. Raise the version with every
change that goes live.

## Households and responsible adults
Modelled on Planning Center (a child can live in several households) and ChurchSuite (responsible adults are separate from
households). Pure rules in `js/households.js`, tested in `tests/households.test.js`.
- **Household** = where someone lives (`families`). A child can be in more than one (`householdIds`); People → profile →
  "Also lives in another household". Search on People finds people by household name too ("search by family").
- **Parents, guardians and collection** (on a child's profile; Administrators, Pastors and Children's ministry): each link has
  a relationship (Mother, Father, Parent, Step-parent, Legal guardian, Foster carer, Grandparent, Other relative, Trusted
  collector) and three ticks: *can give consent* (POPIA s35: a parent or legal guardian), *primary contact*, *may collect*.
  A collector who isn't in Church Hub is a name + phone. Consent for a child can only be recorded from an adult who can consent.
  Adults see a "Responsible for" list; members can read only their own links.
- **Not allowed to collect**: listed on the child's profile with a red bar; viewing it is audit-logged. Adding someone clears
  their "may collect".
- Links made automatically (on upgrade, from households, or from Elvanto's Primary/Spouse) start **unconfirmed**; Home shows a
  to-do until a person checks them, and for children with nobody who can give consent.
- **Upgrades**: modules may have `upgrade()`, run for Administrators after sign-in, once per `settings.dataVersion`:
  2 renamed the categories Member → Partner and Visitor → Visiting Minister and linked existing children to their household
  adults (unconfirmed); 3 renamed Partner → **Church Partner** (not to be confused with a partner in a couple) and moved
  dates of death typed in front of names ("2024-08-22-Mike") into the date died; 4 moved ID numbers typed into names into
  `idNumbers`. The *Member* access level (role) keeps its name.

## Languages
English, Afrikaans, isiZulu and isiXhosa for the screens members use (sign-in, Home, menus, the directory and my details,
consent, My serving, serving together, away dates, my leave). Code wraps English text in `T('…')` / `TN(one, many, n)`;
`js/i18n/<area>.js` holds one line per text with all four languages (one file per part of the app; `js/i18n.js` is the engine), plus month and day names for dates. `tests/i18n.test.js`
finds every `T('…')` in the code and fails if a language is missing or a {part} is lost. The choice is kept per device
(`Store.pref('lang')`), so it also works on the sign-in screen. Administrator-only screens stay English for now, as do the
church's own words (categories, teams, services, kinds of leave, privacy notice) and the shared leave rules' messages.
The isiZulu and isiXhosa were drafted by AI and need checking by fluent speakers.

## Couples (spouses and partners)
Who is married to whom isn't typed in: `Households.couples()` (`js/households.js`, tested) works it out from each household's
living adults – a shared marital status (Married = spouses, Partner = partners; one may still be unrecorded), the same anniversary,
surname, and age (a big age gap means parent and grown-up child). Households → "Couples to confirm" (Administrators and Pastors,
as marital status is private) confirms a couple with one tap, which also records a missing marital status and copies a spouse's
wedding anniversary (never for partners); each change is audited. Confirmed couples are kept on the household
(`families.couples`: ["id1|id2"]), and "Not a couple" likewise (`families.notCouples`).

## Duplicates
`js/duplicates.js` (pure, `tests/duplicates.test.js`) scores two records: first name (exact, "known as", short forms such as
Doug/Douglas, typing slips, initials), surname (exact, slips, part of a double-barrelled name), swapped names, email (Gmail dots
and +labels ignored), mobile (+27 = 0), birthday and Elvanto ID. Contact details only count with a matching first name, because
households share them; different birthdays, different Elvanto IDs, or an adult and a child mean different people.
70+ = probably the same person, 45+ = possibly. People → Find duplicates is for Administrators and Pastors (both may change
people). The Add / Edit window warns as each letter is typed (`Duplicates.live`): from two letters of each name it lists
similar names (an unfinished name matches the start of a longer one, or a long form of a short name: "Timoth" → Tim), names
that sound alike (Stephen/Steven, Pillay/Pillai) and "vd Merwe" = "van der Merwe"; an email or mobile already on someone
else's record is shown right under that box whatever the names (only when typed or changed there, and only for those who may
see everyone) – and so is one that *starts* like what has been typed so far: a mobile from 7 digits ("+27 82…" read as "082…"
in the church's own country), an email from 6 characters (or 2 and an "@"), and a street address from a house number and 3
letters (Rd/Road, St/Street… the same; people in the household chosen for this person left out). **Sensitivity** (`settings.dupSensitivity` 1–5, default 3; slider on Find duplicates, Administrators change it)
moves the "possibly" and "similar" lines and, at 4–5, starts after one letter of the surname; 70+ and the rule that a different
first name never counts stay the same at every level. A match of 70+ can't be saved unless they tick "I've checked: this is a
different person". That, and "Not the same person", is kept on both people (`notSame: [ids]`, in their private details).
**Same person: fix…** keeps one record (`Duplicates.mergeFields`: gaps filled, nothing overwritten, differences listed), moves
consents, parent/guardian links, not-allowed-to-collect entries and (for Pastors) pastoral notes, and for Administrators also
serving positions, roster turns, away dates, serving offers, together/apart groups and leave. The other record is retired
(`active: false`, `mergedInto`), kept for the records and left out of lists and searches. A Pastor is asked to get an
Administrator when the other record has rosters, leave or sign-in access, which only Administrators may change.

## Wording: household (not "family")
The screens say **household** for a `families` record (who lives together – Elvanto's "family"); "family" is used only in
its everyday sense (serve with family, care for the family of someone who died). The collection and code keep the name `families`.

## Advanced search (People → Advanced search)
Like Elvanto's: filters (field, how to compare, value; + and −), Match *all* / *any* / *your own logic* ("(1 AND 2) OR NOT 3",
AND before OR), columns to show (Name first, reorder, add), results sortable by column, Download (CSV). Pure rules in
`js/people-search.js` (`tests/people-search.test.js`): text, choice, list, number, date (in the last/next N days–years,
between…), birthday-style dates (next N days, in a month) and yes/no. The People module offers only fields the role may see:
names, contact, household, category and date added for everyone with people access; serving (positions, teams, last/next
serving) with rosters access; birthdays and age for Administrators, Pastors and Children's ministry; marital status, consent,
status, staff for Administrators and Pastors; parents/guardians for Children's ministry; app access for Administrators.
Medical and pastoral notes and collection restrictions are never searchable. People who left or died are only included when
searching on Status, Date of death or Year of death. Downloads are audit-logged. Searches aren't saved yet (Phase 2: smart lists).
Members have no advanced search. "Church at a glance" (Administrators) is closed until opened.
Each filter has *Type to find a field…*, which narrows the field list as you type and picks the first match; text fields start
on "contains". Church office notes are searchable (Administrators and Pastors).
**Searching** (People, Households, and "Contains"): every word typed must appear, in any order – "andr pi" finds Andrew Pike
(`Hub.matches`). Lists sort by first name, known as or surname (remembered per device).
**Change selected…** (Administrators): tick people in the results, then one change for all of them – marital status, category,
gender, Church Partner dates, or filling gaps (email or mobile → Unknown, household → a new one each). Children are left out of
marital status, people who died out of category; each person changed is audit-logged, and **Undo** puts everyone back
(and removes households it made). Long jobs show the turning cross (`Hub.busy`) until everything is saved.

**Ask in your own words** (top of Advanced search; `js/ask.js`, `tests/ask.test.js`, `tests/app/ask.js`): a question in plain
English, typed or spoken, is turned into the filters below (people – the same search, so the same role limits, ID-number look-up
and audit) or into a list of services from the roster (date range, which services or time of day, gaps, a position nobody fills,
a person serving – also at a morning and an evening service, or twice, on the same day). No outside service: a set of rules, so it
shows **Understood as …** and any words it didn't understand rather than guessing; fields the role may not use are named and left
out. The church's own words (Church Words, e.g. Parishioners) and its service names (10am, Memorial) are understood. "or" between
two of the same kind becomes your own logic ("(1 OR 2) AND 3"). Dates without a year are this year, or next year when long gone
or when the range runs past December. Each question is audit-logged. **Microphone**: the browser's speech-to-text (Chrome, Edge,
Safari) or, in the Android app, Android's own speech window (`ChurchHubApp.listen(lang)` → `window.churchHubHeard(text)`);
hidden where neither exists (e.g. Firefox). The words heard are only put in the box; nothing is recorded or kept.
- **Change selected…** takes several changes at once (Add another change), each with its own value; one save per person,
  one Undo for all. **App access** is one of them: people without an email address, children, people who have died and
  your own access are left out (Store writes the access list, as for one person).

## Partnership applications and name badges (`js/people/apply.js`; tests: `tests/app/partners.js`, `tests/rules.test.mjs`)
- **Apply** (Me → Become a Church Partner, `#/people/apply`): adults who aren't Church Partners (nor have died). The church's
  form: about you (details from their record; ID number → `idNumbers`, given once by themselves), spouse, anniversary, children,
  since when; faith (yes/no and how they came to faith); other church; membership class, Bible study, questions, serving; the
  declaration and Contact details (directory). Saved in `partnerApps` as `waiting`; they can withdraw it.
- **Review** (People → Partnership applications, `#/people/applications/<id>`, and a Home to-do): Administrators and Pastors.
  **Accept** (date approved, approved by, note) → category Church Partner, `partnerSince`, Contact details consent
  (`PeopleParts.partnerAgrees`). **Not now** sends a short reply. **Print** gives a clean copy (`#print-only`, the rest hidden).
- **The declaration** is the church's (Administrators, at the foot of the list): general wording or REACH South Africa's, or
  their own; `{church}` becomes the church's name. Settings: `partnerApp.declaration`.
- **Name badges** (People → Name badges, a Home to-do): "Make a name badge" when adding someone, or the button on their page
  (`badgeWanted`, `badgePrinted` on their details). Printing uses the church's **Badge layout** (`js/badges.js`, pure and tested
  by `tests/badges.test.js`; Administrators set it at People → Name badges → Badge layout, kept in `settings.badgeLayout`).
  The default is the church's Google Doc – A4, 2 × 5 badges of 73.3 × 41 mm, 32 mm from the top and 20 mm from the left, 3 pt
  lines; or Avery label sheets (L7160, L7163, L7165, L7173) or their own measurements: labels across and down, width,
  height, top and left margins, gaps between columns and rows (0 = no gap: neighbours share one line), A4 or US Letter,
  thick / thin / no lines. Each badge is placed in millimetres (`.lab`, `@page badges` / `badgesLetter`); names are sized to
  fit (35 pt / 25 pt on a 41 mm badge, smaller for long names or small labels) in Open Sans. With no thick lines (label
  paper) printing first asks which label to start at, for a partly used sheet. Print a test page numbers every label.
  Mark as printed takes them off the list. From **Advanced search**, Administrators and Pastors print badges for the people
  ticked (or everyone found), sorted by first name, on the same sheets (long names get a smaller size so they fit).
- **Inviting people to apply**: from a person's page (Invite to become a Church Partner) or Advanced search (Invite … to apply).
  The dialog leaves out Church Partners, children and people no longer at the church, names those without an email address,
  and can give Basic access to those who can't sign in yet (Administrators, and Pastors who may give access). The email goes
  through the church's email choice (Gmail or the computer's mail app, `Emails.makeSendUrl`); several people go in Bcc, with the
  office address as To. Each invited person gets `partnerInvited` (the date) on their details, shown on their page.
  The link is the site address + `#/people/apply`; `app.js` remembers it through signing in (pref `afterSignIn`, for a day).
  The Partnership applications page has the QR code (`js/qr.js`, our own encoder – byte mode, level M, versions 1–10, checked
  against segno in `tests/qr.test.js`), Copy the link, an A4 poster and a paper form with the same questions.
- **Ticking people on the People list** (Administrators and the Senior Pastor; `canPick()` in `js/people/directory.js`):
  every row has a tick box (the rest of the row still opens the person), with one to tick everyone shown. Ticks
  (`state.pick`) stay through searches and filters; once someone is ticked a bar offers Add to name badges, Invite to
  apply and (Administrators, as in Advanced search) Change selected…, which uses `bulkDialog(ids)` – the audit log says
  whether a change came from the People list or Advanced search.
- **Adding to name badges** from the People list or Advanced search (`addBadges`) puts people on the Name badges list
  (`badgeWanted`), like "Make a name badge" on their page; the badges are printed together from People → Name badges.
- **On the form, from the church** (Administrators, on Partnership applications): links to documents to read first
  (`partnerApp.links` – the church's and the denomination's constitutions, statements of faith; https only) and an
  optional declaration of loyalty (`partnerApp.loyalty`), which applicants must tick; both are on the paper form too.
- **Birthday and "coming since"**: if the person has no birthday on record the form asks for it; a South African ID
  number fills it in (`Countries.birthFromId`: YYMMDD and the check digit). Under 18 can't send. The application keeps
  `birthDate` and `since`; on Accept they are copied to the person's details (`birthDate` if empty, `attendingSince`),
  which can also be edited (Edit details → Coming to the church since) and searched.

## When someone dies
Administrators and Pastors use **Record a death** on the person's profile (date, optional funeral date, optional pastoral note,
and "change spouse to Widowed" for a married spouse in the same family). The person stays on the records as category *Deceased*
(`deceasedAt`, key dates "Died" / "Funeral"), leaves the directory, and is skipped by the roster engine (not active).
Administrators then finish it (automatically if they recorded it, otherwise from their to-do list): off future rosters, teams,
serving groups and away dates; future leave cancelled; sign-in removed; their parent/guardian links and collection restrictions removed. Past serving and leave stay. Pastors get
"Care for the family of …" on their to-do list for 8 weeks. "Recorded by mistake?" undoes it (teams and rosters must be re-added).
The date of death and funeral can be corrected later in Edit details. Home only asks to finish a death when something is
left to undo, so people who died before they came into Church Hub (e.g. from Elvanto) aren't a to-do; People → **Deceased**
lists everyone who has died. **Late spouse**: recording a death remembers it on the widowed spouse (`lateSpouseId`), whose
page then says "Was married to …" (and the reverse). Administrators can set it in Edit details (someone who died, a name, or
nobody) and get suggestions under People → **Late spouses** (`Households.lateSpouseSuggestions`: same household, wedding
date, email, phone, surname and age; "Not a couple" is remembered as `notLateSpouse`).
Later phases must leave deceased people out of messages, birthday reminders and anniversaries.

## Elvanto's unavailable dates → Church Hub (until switch-over)
`MODE=read` of the robot (nightly 03:07, `.github/workflows/elvanto-robot.yml`; only if `settings.elvanto.read`) reads the whole
Unavailable Volunteers list (all pages) – each row's name and dates, never the reason – with `readRows`/`datesIn` in
`robot/robot.js` (tested), and writes `elvantoFound/unavailable` = { readAt, entries: [{ name, from, to, fromLeave }], rows,
unread, pages } (robot writes only those fields; Administrators read/delete). Import → *Unavailable dates from Elvanto*
matches names with `ElvantoImport.matchFound` (tested: known-as names, "Surname, First", several/no match → choose) and adds
`blockouts` with `source: 'elvanto'`; entries made for leave (note "Church Hub …"/"Leave Manager …") count as already there.

## Offline (view only)
- **Files** (`sw.js`): every file Church Hub uses (its own, the Firebase library, the font) is fetched fresh when online and a
  copy kept; offline – or after 7 seconds on a weak signal – the copy is used. One copy per file (without `?v=`). `keepFiles()`
  in `js/app.js` tells it what the page loaded, so the first visit is already kept. Not intercepted: the database, sign-in, and
  anything fetched with `cache: 'no-store'` (About → Check for updates).
- **Data** (live mode, `js/store.js`): Firestore's offline copy (`enablePersistence`, shared between tabs). Offline, the
  sign-in comes from Firebase Auth's own storage and the access list from the copy, so Church Hub loads as usual. Wiped
  (`wipe()`: terminate, `clearPersistence`, open again) at sign-out, when the access list says they have no access, and when
  another email address's copy is still there (`church_hub_offline_owner`).
- **View-only**: `Store.offline()` (live mode and `navigator.onLine === false`); `blocked()` refuses every save as it does
  for "View as", with one message every few seconds. Audit entries and "read" marks are still queued and sent later.
  `js/app.js` shows the notice (`.offline-bar`) and redraws when the connection changes.
- The demo works offline as it always did (saved in the browser).
- Tests: `tests/app/offline.js` (the other parts block the service worker).

## Phone apps and prompts
`phoneApp()` in `js/app.js` = the Android app or a home-screen app (`navigator.standalone` / display-mode standalone): starts
on Me and signs in by pasting the email link. `prompts()` adds to Home and My details: *Add a photo of yourself* (phone apps,
adults without a photo; Not now → `Store.pref('selfieLater')`, 30 days) and, in an iPhone browser, how to add Church Hub to
the home screen (60 days).

## Approved leave in Elvanto (Unavailable Volunteers)
As in Leave Manager: `Store.saveLeave` tells `onLeaveChange` listeners which requests changed; the Leave module asks
`ElvantoSync.job()` whether Elvanto needs updating and writes `elvantoSync/{requestId}` = { personId, name, start, end,
want: Unavailable|Removed, have, haveNote, status: Waiting|Done|Failed|Check, note } – only when switched on
(`settings.elvanto.on`, Leave → Elvanto). Imports are `quiet` (Leave Manager already put its leave in Elvanto); such leave,
if changed later, is found in Elvanto by its note "Leave Manager ‹id›". The robot (`robot/robot.js`, `.github/workflows/elvanto-robot.yml`)
signs in to Church Hub as its own user – `roles/{email}` = { role: 'robot', uid } – which the rules let read only church settings
and the Elvanto list, and report results (status, note, have, doneAt) and `robotStatus/elvanto`. Its Elvanto steps are Leave
Manager's robot's. Results and problems show under Leave → Elvanto and on Home (failed, check by hand, waiting > 2 hours).

## Leave Manager inside the Hub
Staff are people with a `staff` object (`category`, `start`, `workDays` – empty means "same as the category"), set by Administrators
in Edit details. Leave → Settings (Administrators) edits `leave/config`: the same settings, school terms, categories (levels with
working days and allowances), leave types and holidays as Leave Manager's sheet tabs (`church: true` marks a church closure).
The Leave module uses `LeaveCore` (the same rules file as Leave Manager), so balances, pro-rata, carry-over, public holidays
and Sunday-holiday handling behave identically. Approved leave automatically makes a person unavailable for rosters.
**Import → From Leave Manager** (Administrators) moves the Leave Manager Google Sheet into Firebase: the Administrator downloads
the sheet as Excel (or its tabs as CSV) and chooses the file; it is read in the browser (never uploaded anywhere else).
Tabs are recognised by their headings; the Staff tab's PINs are dropped on reading; History isn't needed. Staff are matched to
people by email, then name (the Administrator can change each match, add someone as a new person without app access, or leave
them out). Requests keep their Leave Manager IDs and adjustments get stable IDs, so running it again updates instead of
doubling – run it once to trial and again at switch-over. The preview shows each person's balances, which match Leave Manager's
(tested for every staff member, year and leave type). After switch-over Leave Manager is retired and Firebase is the only home for leave.

## Elvanto import
Phase 1: Elvanto's People export (CSV) → column mapping → category mapping → preview → import people and families.
- Only these columns are read: Member ID (Elvanto's person reference – include it), Date Added (becomes `createdAt`), names
  and Middle Name, Email Address, Cellphone/Landline, Date of Birth (also "MM-DD" without a year), Gender, Family Relationship,
  Primary & Spouse Full Names (family key when there is no Family ID), Marital Status, Anniversary, People Category,
  Membership Date and Membership last renewed on (Church Partner dates; a year on its own is kept), Archived, Deceased, Date
  Deceased, Photo (downloaded from Elvanto's own https address and made small, for people without a photo), ID Number
  (→ `idNumbers`; a lost leading 0 put back), Notes (→ church office notes), Checklist of what to receive (→ consents),
  Department Positions ("10:00 Reading" → `skills` with times; departments added if missing) and the home address
  (provinces tidied). Groups, giving, security codes and Elvanto's email/SMS preferences (ticked by default, so not consent)
  are never read. Dates or ID numbers typed into names are moved out.
- Matching: Elvanto ID → same email AND same first name (families share emails) → same full name for someone not yet linked to
  Elvanto. No person is matched twice in one import, so two rows always stay two people. Re-importing updates, never doubles.
- Children: under 18 by birthday; without a birthday, a relationship of Child/Son/Daughter. Birthdays without a year are kept as
  `birthDay` ("MM-DD"). Elvanto categories are mapped by the Administrator (non-members default to the Attender category).
- "Remove everyone brought in from Elvanto" (Import page) clears a bad import, keeping people with app access, staff details or the current user.
Later: direct import through the Elvanto API (server side, with the church's API key), including groups and departments.

## Hosting (target)
- Code: GitHub (`church-hub` repository); website: GitHub Pages.
- Data: Google Firebase (Firestore + Authentication), project owned by the church, data stored in Johannesburg (Firestore region `africa-south1`).
- Never put real church data in GitHub or in a Claude Project.

## Going international (countries, church wording, privacy law, languages)
- **Countries** (`js/countries.js`): Settings → Church → Country (`settings.country`, a code such as `ZA`; South Africa until
  chosen). Each address has its own country (stored by its English name, as Elvanto exports it); the form swaps the province
  list, its label (Province, State, County, Canton…) and the postcode label (ZIP code, Eircode, CEP…) as the country changes.
  Countries without a fixed list get a box to type in. Phone numbers are compared by their last 9 digits, so any country's
  "+44 7700…" and "07700…" match (duplicates).
- **Terminology (Church Words)** (`js/wording.js`): Settings → Terminology (Church Words): a set (General, Anglican, Catholic, Methodist,
  Presbyterian/Reformed, Baptist, Pentecostal, Lutheran) and any word renamed (`settings.wording = { set, custom }`).
  `app.js` changes the words in what is shown (text nodes and titles/placeholders, after every render, in dialogs and
  messages) – in English only; stored values never change (`Church Partner` in the database shows as "Parishioner").
  Text inside `data-own-words` (people's notes, the wording panel itself) is left alone.
- **Privacy law** (`js/privacy-law.js`): from the church's country – POPIA (ZA), GDPR (EU/EEA, with each country's
  authority; Germany notes church data protection law), UK GDPR (ICO), FADP (CH), PIPEDA (CA), Privacy Act (AU, NZ),
  LGPD (BR), and Kenya, Nigeria, Zimbabwe, Botswana, Rwanda, Malawi, Ethiopia, Mexico, Chile; general wording elsewhere.
  The Privacy pages, the officer's title, the regulator, breach advice and days to answer a request follow it. Checked
  October 2026 – not legal advice.
- **Languages**: `js/i18n/*.js` keep the four built-in languages; `I18n.MORE` lists 18 more (Sesotho, Setswana, Sepedi,
  Xitsonga, siSwati, Tshivenḓa, isiNdebele, chiShona, Kiswahili, Amharic, Yorùbá, French, Portuguese, Spanish, German, Dutch,
  Italian, Polish), each in `js/lang/<code>.js` (`I18n.add(code, { mon, dow, words })`), fetched when chosen; the screen is
  redrawn when it arrives (`I18n.onLoad`). The picker groups them by continent. A line missing in a file shows in English;
  `tests/i18n.test.js` checks every file keeps the `{parts}`. All were drafted by Claude (AI): the Me page says so and asks
  people to tell the church office if something reads oddly. When adding a member-facing text, add it to the right `js/i18n/<area>.js`
  and to every `js/lang` file – `tests/i18n.test.js` fails if any of the 22 languages is missing a line.
  A text kept in a list and translated where it is shown (field names, kinds of request, reasons from the rules files) is
  written `TX('…')` (does nothing but mark it), so the test checks it too; values stored in the database stay English.
  The pure rules files (`roster.js`, `people-search.js`, `duplicates.js`, `households.js`) use `I18n.t` when it is there
  and plain English in their tests.
- **Better wording from the church** (`js/mod-words.js`, the Translations card): anyone signed in who uses another language
  sees "Help improve the … wording on this page" at the foot of every page. It opens the texts that page showed
  (`I18n.page()` / `I18n.seen()`, collected by the router) or all of them, with a search; a suggestion must keep the
  English text's {parts} and bold marks (`I18n.check`). Suggestions go to `wordIdeas`. Each language can have **checkers**:
  an Administrator chooses them (Translations → Who checks), which puts `reviewLangs` on the person and `langs` on their
  access-list entry (`roles/{email}`), so the rules let them read that language's suggestions and write `words/{lang}`.
  Administrators can check every language. "Use this" (or "Change it first") writes the wording into `words/{lang}`;
  `I18n.override()` uses it before the built-in line, so it shows for everyone at once. "Go back to the original" removes it.
  "Download the changed wording" gives a JSON file to fold into `js/i18n/*.js` / `js/lang` later. Approved wording only shows
  after signing in (the sign-in screen uses the built-in files).
- The word for a **service** (`service`: Service / Meeting / Gathering, Settings → Terminology) changes "Church Services"
  in Settings, "a service" on the rosters, and the rest of the screens.
- **Settings → Membership application** shows the same declaration, documents-to-read and loyalty panels as People →
  Partnership applications (`PeopleParts.formSettings`).

## Groups (one menu entry; `js/mod-groups.js`)
Care Groups, Midweek Groups and Leadership register with `inGroups: true`: `Hub.listed()` leaves them out of the menu, Home and
All apps, and the `groups` module (shown when `Hub.groupMods()` has any) stands for them. Their pages keep their addresses
(`#/care`, `#/life`, `#/leaders`); `draw()` in `js/app.js` puts the Groups tabs (`tabs()`) above them and lights Groups in the
menu. `#/groups` is "My groups": `CareUI.mePanel`, `LifeUI.mePanel` and `LeadersUI.mePanel`. Each kind keeps its own on/off
switch, roles and rules. The menu entry's name is the Terminology word `groups` (`Wording.TERMS`, marked `'menu'` so the
screen-wide word changer leaves "Groups" elsewhere alone).

## Care groups (Care groups page; `js/care.js`, `js/mod-care.js`)
- `careGroups/{id}` = { name, leaderIds (carers), memberIds, names: { personId: name } }. A person may be in several groups (a carer in one, a member in another), with a card in each. Locally a card is `careShare` id `group:person`.
  Administrators and Pastors create, rename and delete groups and put people in them (Care groups page, or Edit details →
  "Care group member" + which group + Carer). A group's carers may add people from the church directory and take members
  out (only `memberIds`/`names` change; they stay in it; they can't change the carers or the name).
- What the group sees: each member's card `careGroups/{id}/share/{personId}` – name always; with the "Care group" consent
  also a small photo (96 px), mobile, email, address and birthday (day and month). The card is written by the person
  themselves (after signing in, and when they change their details or consent) or by an Administrator/Pastor; carers may
  delete a card when they take someone out. Members load their group (`where memberIds array-contains me`), then its cards
  (`Store` follows `careGroups/{id}/share` once the group is known). Rules: `firestore.rules` (careGroups, share).
- Shown: members – "My care group" on their Me page; staff – a "Care group member / Carer · group" tag on profiles.
- **Find a care group or a person** (every Care groups page): typing part of a group's name, its areas or a person's name (any
  way they're known) shows only the matching groups; for a person, their fold opens and their line is marked (`applySearch`,
  no redraw while typing).
- **Settings → Who can see what → Care groups** (`settings.seeCare`, e.g. `['rosters']`): Roster coordinators and/or
  Children's ministry may see every group, its carers and members (names only, a read-only Care groups page; `can('care.view')`).
  Not the members' cards. `Store` adds a listener on all of `careGroups` once the settings have loaded (`careAll()`, merged
  with their own groups as `careGroupsAll`). Rules: `seesCare()` reads `settings/church` (only these two roles can be allowed).
- **Church Partners (Basic access)**, same table:
  - Care groups is in their menu when either box is ticked (`can('care.view')`): their own group(s), then all groups if allowed.
  - *Their own group: see all its members* (`settings.seeCareOwn`, on unless switched off). Off: a member who isn't a carer of
    the group sees only its carers and themselves on the Me page; `Store.shares()` then follows only those cards, one document
    each (rules: `careOwn()`, `careCarer()`). Carers always see everyone. The group record's names are hidden on screen only.
  - *All groups: see who is in each group* (`seeCare` includes `member`): `directory/{id}.care` =
    [{ id, name, carer }] (names only), written by `syncDirectory` (Administrators and Pastors when a group changes or Settings
    are saved; each person for themselves at sign-in; Administrators and Pastors re-check everyone's entry 1.5 s after opening Church Hub – only differences are written). A read-only Care groups page built from the directory, and the tag on
    the People list. People not in the directory aren't shown.
  Church wording renames them (Home group, Cell group, Class and Class leader, Small Christian Community…).
- Suggest groups by where people live (`Care.suggest`, tested): for every Church Partner (adult, active) in no group yet –
  first the group of the people they live with (same household); otherwise the whole address (or a household member's): the
  places a group is named after ("Amber Glen Tuesday morning" -> Amber Glen; days, times and "ladies" etc. are ignored) or its typed
  `areas` (Rename dialog), found in the street or second address line (an estate or suburb) beat one found only in the town, and a
  longer place beats a shorter one ("Howick West" over "Howick"); then members living in the same street or estate, then the same
  town. Only the town known ("Howick") while groups meet in several parts of it -> "which part?" (not clear). Clear = one group stands out; the rest are listed as
  "Not clear" (no address, no group nearby, several groups, household split) with the nearest groups starred. Nothing is
  saved until the Administrator or Pastor ticks and confirms.

## Midweek groups (shown as "Midweek groups" – code and data still say life; the Midweek groups page; `js/mod-life.js`) – plan and next steps in `docs/GROUPS-PLAN.md`
- Bible studies, life groups and midweek meetings. A life group is a `careGroups/{id}` record with `type: 'life'`; `Store`
  hands the two kinds out separately (`list('careGroups')` / `list('lifeGroups')`, cards `careShare` / `lifeShare`) and
  writes both to `careGroups`, so the care-group code never sees life groups. Same rules, cards and loading as care groups.
- Differences from care groups: each group's **leaders may rename it** (`Care.leaderMayChange`, rules: the life clause on
  `careGroups` – name 1 to 80 characters, still not the type or the leaders); a member's card follows the **"Church directory"
  consent** (Contact details, agreed on becoming a Church Partner), not "Care group"; no areas or Suggest by area yet.
- Administrators and Pastors: add, rename, delete, put people in and make leaders (star, per group). Leaders (Life groups
  page and Me): rename, add people from the church directory, take members out, message the group (`kind: 'life'`).
  Members: their life groups on the Life groups page and their Me page. Tag on a person's page for staff and themselves
  (a chip opening the Midweek groups page; plain inside the People list, whose rows are links: `catTags(p, true)`).
- Unlike care groups, **children** can be in a midweek group (a youth group): Administrators and Pastors can add them (members
  don't see children, so leaders can't). A child's card follows the same consent, so normally only their name shows.
- Groups fold like care groups (`CareUI.fold` with the words "leader"/"leaders").
- **Adding people** (`CareUI.finder`, used by every "type part of their name" box): what was typed and its matches stay after
  someone is picked (`typed`, cleared when the box is emptied or the page changes; `{ keep: false }` for one-off picks like
  lending a book), and the box gets the focus back (`CareUI.again`), so several people are added from the same list.
- **Switching on and off** (Settings → Apps): Life groups are `optIn` – off until switched on (`Hub.isOn('life')`). Care groups
  can now be switched off too: the page, Me panel, tags, Edit details box and message audiences all go; nothing is deleted.
- **When and where, and who does what** (Administrators, Pastors and the group's leaders: the pin button on a group):
  `when = { day 0-6, time, freq: weekly | fortnightly | monthly }`, `venue = { atHost: true }` or `{ place, address }`
  (with a map link), `roles = { personId: 'coleader' | 'host' }` – the leaders stay `leaderIds`. Shown on the group's
  panel and to its members; the host's home address comes from People for Administrators and Pastors, and from the
  host's own card (only if they are in the church directory) for the group. The rules let leaders change `when`,
  `venue` and `roles` too.
- **From a person's page** (Administrators and Pastors): **Groups** ticks the Care Groups (adults) and Midweek Groups
  they are in, with Carer / Group leader – the same as adding them from a group's page.

## Messages (Messages page; `js/messages.js`, `js/mod-messages.js`)
- Audiences (`Msg.audiences`, tested): Administrators and Pastors – **Chosen people** (ticked one by one on a checklist of
  adults still in the church; "Send a message" on a person's page opens it with them ticked, `#/messages/send/people/<id>`), **Staff** (people with staff details), **Church Partners**
  (active adults), every care group and every message group; carers – their own care group; message-group leaders – their
  own group; anyone on a leadership group – that group (`kind: 'leaders'`, `groupId` = the `leaderBodies` id, `to` its
  `memberIds`). Members only read. Writing to a group, "Only some of them" shows its people ticked; unticking narrows `to`
  (`some: true`) – the rules already only let carers and leaders reach people in their own group. The people a message goes to (`to`) are worked out when it is sent, so someone added to a
  group later doesn't see older messages, and the rules can check each reader.
- Loading (`plan()` in `js/store.js`): Administrators and Pastors load all `messages` and `msgGroups`; everyone else the
  messages where `to` contains them, the ones they sent (`fromId`), and the message groups they are in.
- Reading: opening the inbox (while the app is on screen) adds the person to `readBy` with `arrayUnion` (`Store.markRead`),
  the only change the rules let a receiver make. Unread messages give a count on the Messages menu entry and phone tab
  (a module's `badge()` in `js/app.js`) and a Home to-do. Not while an Administrator uses "View as".
- Writing (Messages → Write, or `#/messages/send/<kind>/<groupId>` – carers get a button on their Me page): a confirmation
  with how many it goes to; Administrators and Pastors also see how many of them can't sign in yet. Rules: `firestore.rules`
  (messages, msgGroups) check the sender, that a carer or leader writes only to people in their group, and the sizes.
- Sent → "Read by n of m" opens to the names of who has and hasn't opened it (`Msg.readers`).
- Not yet: phone notifications when the app is closed, email/SMS fallback, replies (see ROADMAP Phase 5).

## Leadership (Leadership page; `js/leaders.js`, `js/mod-leaders.js`)
Off until switched on (Settings → Apps; `optIn`). A leadership group is one `leaderBodies` document (like a care group):
`memberIds` + `names`, and for each member a seat – `role` (Chair, Secretary…), `title` (Churchwarden, Elder…),
`portfolios` (a list) and `from`/`to` dates, all the church's own words. Ending someone's time moves their seat to `past`
("Served before"); "added by mistake" removes it without a trace. `open: true` = everyone signed in reads the group;
otherwise only its members. Administrators and Pastors manage (rules: `manager()`). Everyone else loads two queries
(`open == true`, and `memberIds` contains me – `plan()`); only names and roles are kept, never contact details.
The Archive reads `memberIds` to decide who sees a group's records, so a group with records can't be deleted.
- Each seat may have several `roles` (`role` = the first, for older readers), `kind: 'coopted'`, and – for terms of office –
  `term` (1, 2…) and `termFrom` (when the current term started; the first starts at `from`). A group's `termYears`,
  `maxTerms` and `breakYears` set the rules (0 = none); `to` is worked out from `termYears` when not typed.
  `Leaders.term()` gives which term, how far through (the bar), whether it ends within four months (`NOTICE_MONTHS`), and
  whether they may stand again; `Leaders.ending()` feeds a To do for Administrators and the Senior Pastor (Rector) and a
  notice on the page; `Leaders.renew()` starts the next term; `Leaders.resting()` warns when someone is added again during
  their break. All tested (`tests/leaders.test.js`).
- Groups fold like care groups (`CareUI.fold`): office-bearers (anyone with a role) first, then the other members.
  `LeadersUI.tag(p)` puts a chip per group on a person's page and the Me page (opening Leadership).

## Archive (Archive page; `js/archive.js`, `js/mod-archive.js`)
Off until switched on. A record has a category (`settings.archiveCats`, or `Archive.CATS`: Council minutes, Architectural
plans, Staff contracts, Annual appraisals, Other), a date, and a file or a link.
- **Who sees a record** is on the record (`access`, copied from its category when added): `all` everyone signed in ·
  `body` the members of one leadership group (`bodyId`) · `office` Administrators and Pastors · `private` Administrators
  and the Senior Pastor. A record about a person (`aboutId`) may also be shown to them (`shownTo` = their id).
  **Keepers** – Administrators and the Senior Pastor (`settings.seniorPastorId`) – read and write everything; nobody else
  writes. `Archive.sees()` (screens, demo), `seesRecord()` in `firestore.rules` and the copy in `tests/fake-firebase.js` say
  the same. `Archive.clean()` keeps `bodyId` only with `access: 'body'` and `shownTo` only equal to `aboutId` (the rules
  insist on both), so the queries below can never return a record the reader may not see.
- **Loading** can't be planned at sign-in, because it depends on the settings (is the Archive on? who is the Senior
  Pastor?) and on my leadership groups. `extras()` in `js/store.js` runs when the settings or my groups arrive and keeps
  the right listeners: keepers the whole collection; everyone else `access == all`, `shownTo == me`, `bodyId == g` for each
  of my groups, and (Pastors) `access == office`. The same function gives a librarian who isn't an Administrator every loan.
- **Files** are kept in Firestore, not Firebase Storage (nothing extra for a church to set up): the file as base64, cut
  into parts of 900 000 letters (`archive/{id}/parts/{n}`; a document holds 1 MB), at most 15 MB (`Archive.MAX`); bigger
  files are linked. Parts are written before the record and fetched only on Download (`Store.saveFile` / `loadFile`), and
  follow the record's read rule. The demo keeps files in memory only. Downloads use the browser, or
  `ChurchHubApp.saveFileBase64(name, type, base64)` in the Android app (older apps: "please update").
- Opening a record that isn't for everyone (download or link) is written in the audit log. Council minutes: the Archive
  lists this year's months with nothing filed, counted from the first minutes ever filed (`Archive.missingMonths`).
Not built yet: letting a group's secretary file its own minutes; reading a file inside Church Hub; a retention review.

## Library (Library page; `js/library.js`, `js/mod-library.js`)
**0.53:** items are never deleted except "added by mistake": taking one out sets `removed` (date), `why` (`Library.REASONS`:
Lost, Damaged, Given away, Other) and `whyNote`; `Library.inLibrary` hides them from the list, `restore` puts one back. A loan
marked lost (`Library.lose`) is closed with `back` = that day and `lost: true`, keeps its mobile number, and takes one copy
off the item (the last copy: the item is taken out as Lost). `Library.report(books, loans, from, to)` gives lent / returned /
lost / acquired / removed for the librarians (Reports, CSV via `Library.csv`, which defuses spreadsheet formulas).
`Library.importPlan` reads a CSV (`parseCSV`, `,` or `;`), finds the columns by their headings (`COLUMNS`) and skips rows
without a title and items already there (`sameItem`: same ISBN, else same title + author). The policy's words are shown as a
page by `Library.policyHtml` (escapes everything, then headings, lists, **bold**, paragraphs). No rules change.
**0.57:** Everyone can filter the catalogue by media type, title, author and subject, and sort by each field. Returning a
loan can save an optional condition note (`returnNote`), shown to librarians in the returned-loan list and reports.
Off until switched on. Everyone signed in reads `books` – books, DVDs, CDs, audiobooks, magazines, games (`kind`,
`Library.KINDS`; 'Book' when not set), each with an optional cover picture in `covers/{id}` (a JPEG of at most 360 pixels,
taken with the phone's camera or chosen; the item's `cover` is its version; fetched only when it comes into view, like
people's photos). **Librarians** – Administrators and `settings.librarianIds` (one or two, `Library.MAX_LIBRARIANS`, chosen
on the Library page by an Administrator or the Senior Pastor; the Senior Pastor's save writes only that field –
`Store.setLibrarians`, and the rules let them change nothing else; rules: `librarian()`) – add items and write `loans`.
Every new loan has a mobile number (`Library.borrower`: from the person's record, or typed if it has none; rules insist on
it); someone not on the church's list can borrow with a name and a mobile number (`personId: ''`, `visitor: true`). The number
is cleared when the item comes back. **The library's policy** (`libraryPolicy/policy` = { text, name, type, data }: words pasted
in and/or one file of at most 600 KB, e.g. a PDF) is read by everyone signed in and written by the librarians and the Senior
Pastor; it is fetched once when the Library page opens. A loan is read by the
librarians and its borrower only, so a book carries its own count of copies out (`out`, kept in step by `Library.lend` /
`giveBack`) for everyone else to see "Available" or "On loan". Lending defaults to three weeks (`LOAN_DAYS`); overdue loans
show on Home (the librarians: how many; the borrower: their own). Returned loans are removed after a year (`KEEP_DAYS`,
when a librarian opens the page). **Friendly reminders**: three weeks after it was borrowed (`REMIND_DAYS`) and a week after
each reminder (`Library.remindDue`), the borrower gets a To do and a note under My books, and the librarians a "Reminder due"
tag with *Send a reminder* – the text names the item and the days held, sent by WhatsApp (`wa.me`, with the church country's
dialling code: `Library.intl`), SMS or in the app only; the loan keeps the date (`reminded`). The policy box has formatting
buttons (`RichText.tools`: bold, italic, heading, lists) for the marks `Library.policyHtml` shows; Archive notes use
`js/richtext.js` itself (`#` headings, `-` and `1.` lists, `**bold**`, `*italic*`, `__underline__`, links; all else made safe). `LibraryUI.chip()` shows "n library items
borrowed" on the Me page. Not built yet: asking to borrow or reserve a book in the app.

## Services that need a roster
- Settings lists every upcoming service with a bin to remove it (and its roster); "Stop holding a regular service…"
  removes a regular one's upcoming services from a date (confirmed in a dialog).
- **Special services** (`Serving.specials(year)`): suggestions grouped by season with the churches that usually keep them,
  and dates worked out from Easter (`Serving.easter`): Ash Wednesday, Palm Sunday, Maundy Thursday, Tenebrae, Good Friday,
  Easter Vigil, Ascension Day, Pentecost, Trinity Sunday, Corpus Christi; plus Advent Sunday, Christmas Eve and Day,
  Watchnight, Covenant service, Epiphany, Remembrance Sunday, Reformation Sunday, All Saints', Christ the King, and occasions
  (baptisms, confirmations, weddings, funerals…). A special service is a `services` record with `special: true`; "Teams
  like" picks which regular service's positions it uses (its `slot`).


## What Pastors can do (Settings)
`settings.pastorCan` lists the Administrator abilities Pastors have: settings, access, people, idnumbers, leave, rosters,
privacy, import, words (`Hub.PASTOR_CAN` names them and the permissions each adds, e.g. leave → `leave.manage`).
When an Administrator saves it, `Store.syncPastors()` copies the list onto every Pastor's access-list entry
(`roles/{email}.can`), and `syncRole` keeps it there when someone becomes a Pastor. The rules check that copy:
`may('leave')` is true for Administrators and for Pastors with the tick. A Pastor with "settings" can change every setting
except `pastorCan`; with "access" they give and take away only Basic access, Roster coordinator and Children's ministry,
never Administrator or Pastor, and never abilities. Medical notes stay with Children's ministry whatever is ticked.
`plan()` in `js/store.js`, the POLICY in `tests/fake-firebase.js` and `tests/rules.test.mjs` follow the same ticks.

**Senior Pastor (Rector) and Assistant Pastors.** An Administrator may choose one Pastor as Senior Pastor
(`settings.seniorPastorId`), who then gets their own ticks (`settings.seniorCan`); `pastorCan` becomes the other Pastors'
ticks, and those Pastors are shown as Assistant Pastors (`Hub.personRole`). `pastorCan(pid)` in `js/store.js` picks the
right list for each Pastor's `roles/{email}.can`, so `may('…')` in the rules needs no change; a Pastor with "settings"
can't change `seniorPastorId` or `seniorCan` either. All Pastors keep the Pastor role (pastoral notes, everyone's details).
The words come from Terminology (`senior`, `assistant` in `js/wording.js`: Anglican Rector / Assistant Minister,
Catholic Parish Priest / Assistant Priest; otherwise "Senior" / "Assistant" + the church's word for Pastor).

## Ask in your own words, with AI (`js/ask-ai.js`; setup `docs/AI-SEARCH-SETUP.md`)
- Off unless `settings.ai.on` and `appCheckKey` is in `js/firebase-config.js` (`Store.aiReady()`: live, online, not "View as").
- `AskAI.request(question, fields, ctx)` builds a Gemini `generateContent` body: rules, a JSON schema, and a description of
  the search – field keys, English labels, types, ops (`PeopleSearch.OPS`) and choices only for choice fields and safe lists
  (positions, teams, service times, consents, care/midweek group names, country). Never households, people or records.
- `Store.ai(body)` (live: `aiAsk` in `js/store.js`) loads the App Check compat library on first use, activates reCAPTCHA
  Enterprise (or v3) with `appCheckKey`, and POSTs to `firebasevertexai.googleapis.com/v1beta/projects/{id}/models/{model}:generateContent`
  with the web API key, the App Check token and the user's ID token – as the Firebase AI Logic SDK does (the compat SDK has no AI
  module). 15-second limit. Model: `settings.ai.model`, default `AskAI.MODEL`.
- `AskAI.check(answer, fields, ctx)` keeps only fields this person has, ops of that field's type, choices spelt as in its
  options, real dates and numbers, and logic that fits; everything else goes to `refused` / `unknown`. People named in
  service questions are matched on the device. The result has the same shape as `Ask.parse`, so `people/search.js` uses it the
  same way (`useAnswer`); if the call fails, `Ask.parse` is used and the screen says so.

## Explanations ("i" tips) and the consent names
`Hub.tip(text)` draws a small "i"; its text floats above the page on hover, keyboard focus or a tap (`tipShow` in `js/app.js`).
Consents use their own names everywhere – "Church directory" is no longer shown as "Contact details" (which was also the name of
a person's own phone and email on the Me page) – and each has an explanation (`PURPOSE_TIP` in `js/people/core.js`), on the consent
form, a person's page and Me.

## Edit details: boxes that don't apply
`offBox()` in `js/people/edit.js` greys out a box (disabled, with the reason) when it doesn't apply: the wedding anniversary for
Single, Engaged, Partner and Divorced; the late spouse for Single and Engaged. A greyed-out box isn't saved, so what was there stays.
The wedding anniversary sits right under marital status.

## Brochures and the brochure editor (About → Brochures; `brochure.html`, `js/brochure-kit.js`, `js/mod-about.js`)
- About links to `#/about/brochure/members|churches` (Administrators). The page shows `brochure.html?for=…&embed=1` in a frame
  (same site), with Church Hub's own buttons: **Edit the wording / Done editing**, **Print or save as PDF** (the frame prints),
  colour (Church Hub orange, the church's colour from Settings → Colours, or any colour) and font (a short list of Google Fonts).
- The church's changes are `settings.brochures` (`BrochureKit.tidy`): `design { accent, font }` and, per brochure,
  `texts { key: { o: Church Hub's original text, h: their wording } }` and `hidden { key: original text }`. Keys are places
  (`m0:11` = members, sheet 0, 12th text; `m0:b3` = a block). An edit is only used while the original there is unchanged, so
  when Church Hub's wording changes in a release the old edit is listed ("Forget them") instead of landing on the wrong line.
- Editing: each heading and paragraph is contenteditable (plain paste; Enter in a heading does nothing), blocks get Hide/Show;
  saves by itself (600 ms after typing, and on leaving a text). Typed wording goes through `BrochureKit.clean` (bold, italic,
  line breaks and the church's name/address spans only). Colours come from one colour (`BrochureKit.colours`: ink dark enough
  for white writing; dark writing on a light cover). A panel that no longer fits its A4 third is marked and warned about.
- The page isn't redrawn while open (`data-keep` stops remote-change redraws), so typing isn't lost.
