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
robot/robot.js            the Elvanto robot (GitHub Actions, every 15 min): does the waiting Elvanto updates (docs/ELVANTO-ROBOT.md)
js/app.js                 shell: sign-in, roles, router, Home, module registry, UI helpers
js/mod-*.js               one file per module: me, people, rosters, leave, privacy, import, settings
android/                  the Android app: shows the website full screen + native Google sign-in (docs/ANDROID.md)
manifest.webmanifest      home-screen icon and name (iPhone "Add to Home Screen", Android browsers)
firestore.rules           database security rules: who may read/write what (POPIA)
tests/roster.test.js      rostering engine          tests/leave-import.test.js  Leave Manager import (made-up sheet in tests/fixtures)
          tests/rules.test.mjs  security rules (Firestore emulator)
tests/app.test.js         the app in a browser as every role, demo and live (live uses tests/fake-firebase.js)
.github/workflows/tests.yml  runs all of these on GitHub after every push
```

### Data layer contract
Reads are synchronous from an in-memory copy (`Store.list('people')`); writes (`Store.put`, `Store.remove`) update the copy immediately and persist in the background.
Modules never know which mode they are in (apart from `Store.isLive()` for sign-in wording).

**Demo mode** (no Firebase settings, or `?demo` in the address): made-up people from `sample.js`, saved in this browser.

**Live mode**: Firebase Authentication (Google or email link) and Firestore in Johannesburg. Setup: `docs/FIREBASE-SETUP.md`.
- *Access list* `roles/{email}` = `{ role, personId }`. Only Administrators write it, from People → Edit details → App access
  (`No access` deletes it). The first Administrator is added by hand in the console, then Church Hub asks them to set up the church.
- *One person, several documents*, because security rules protect whole documents, not fields. `store.js` splits on save and
  joins on load, so modules still see one person object:

  | Document | Holds | Read by |
  | --- | --- | --- |
  | `people/{id}` | name, family, category, email, mobile, active, app role (display copy) | Admin, Pastor, Roster coordinator, Children's ministry; the person |
  | `details/{id}` | birthday, marital status, key dates, staff details, date of death, Elvanto ID (+ copy of family role) | Admin, Pastor; Children's ministry for children; the person |
  | `medical/{id}` | children's allergies and medical notes | **Children's ministry only** |
  | `notes/{personId}` | pastoral notes (`entries` list) | **Pastors only** |
  | `directory/{id}` | name and mobile of adults with *Church directory* consent | everyone signed in |
- *Leave*: `leave/config` (types, levels, rules, holidays, `autoApprove`), `leaveRequests/{id}`, `leaveAdjustments/{id}`.
  `away/{id}` holds approved leave as dates only, so rosters and "Who's away" work without showing anyone's leave type or reason.
- Everything else is one document per item (`families`, `consents`, `teams`, `positions`, `skills`, `services`,
  `assignments`, `groups`, `blockouts`, `dsr`, `breaches`, `audit`, `settings/church`).
- Each role only subscribes to what `firestore.rules` lets it read (`plan()` in `store.js`), so nothing is refused.
  **When changing who sees what, change `firestore.rules`, `plan()` in `store.js`, the POLICY copy in `tests/fake-firebase.js`
  and the tests together.**
- Saves are written in the background; if the database refuses one, the person sees a plain-English message.
  Changes made by others appear automatically (unless the person is typing or has a dialog open).

### Collections
| Collection | Holds |
| --- | --- |
| `settings` | church name, modules on/off, Information Officer, retention period, privacy notice |
| `people` | name, contact, household(s), category (Partner, Attender, Visiting Minister, Staff, Former member, Deceased), marital status (adults), staff details (leave category, start date, working days), key dates, date of death, child medical notes (special personal information), Elvanto ID |
| `families` | households: `name` + `custom`. Shown via `Hub.familyName()`: named after its active adults ("Tim & Clare Jacobs", "Thandi Mokoena & Sipho Dlamini") unless `custom` is true; no "head of household". A person's main household is `familyId`; extra households (children of separated parents) are `householdIds` |
| `guardians` | the adults responsible for a child, independent of households: { childId, adultId \| name + phone, relationship, canConsent, primary, mayCollect, confirmed } (`js/households.js`) |
| `noCollect` | people **not allowed to collect** a child (e.g. a court order): { childId, personId \| name, note } – restricted, every view logged |
| `consents` | per person and purpose: given/withdrawn, date, how, recorded by, guardian for children |
| `notes` | pastoral notes (restricted) |
| `teams`, `positions`, `skills` | who can serve where, and how often they'd like to |
| `services` | dates and times of services/events needing a roster |
| `assignments` | person × position × service, status pending/accepted/declined, why |
| `groups` | serve **together** (must/prefer) or keep **apart** |
| `blockouts` | away dates people enter themselves |
| `serveOffers` | a person's request to join a position, serve more/less often, or stop: { personId, positionId, kind join\|change\|stop, frequency, note, status waiting\|declined, reply }. The person creates and withdraws their own; Administrators and Roster coordinators answer (Yes changes `skills` and deletes the offer; Not now sets `declined` + `reply`) |
| `leave` | Leave Manager data in LeaveCore format (types, categories, requests, holidays, terms, adjustments, rules) |
| `dsr` | POPIA data-subject requests (access, correction, deletion, objection) |
| `breaches` | security-compromise register (POPIA s22) |
| `audit` | who viewed or changed sensitive information, and when |

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

## Me (members' own page) and the Android app
`js/mod-me.js` – **Me**, for everyone: *My details* (contact details they may change, what the office keeps, consent,
language, sign out), *Days away* (their blockouts and approved leave; warns about roster turns on those days) and
*Serving* (turns to accept, where they serve, offers to serve). It reuses the People and Rosters actions (`people:edit`,
`people:consent`, `rosters:addaway`, `rosters:delaway`, `rosters:reply`), so the rules stay in one place. On phones the
tab bar shows Me first for members (staff get their working areas first).
**Offers to serve** go to `serveOffers` (see Collections); roster coordinators answer them at the top of Rosters → Teams,
with a Home to-do. A declined offer shows the reply under the position until the person taps OK.
**Android app** (`android/`, built by `.github/workflows/build-android.yml`, setup in `docs/ANDROID.md`): a WebView
showing the website, same as Leave Manager's app and signed with the same key. It adds `window.ChurchHubApp`; when present,
`Store.live.google()` asks Android's account picker for a Google ID token and signs in with
`signInWithCredential` (needs `googleWebClientId` in `firebase-config.js`), and after "Email me a link" the person pastes
the link from the email (Google's sign-in pop-up and email links can't open inside an app). Members open on `#/me`;
`window.churchHubBack()` lets the back button close a dialog first.

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
- **Upgrades**: modules may have `upgrade()`, run for Administrators after sign-in. `settings.dataVersion` 2 renamed the
  categories Member → Partner and Visitor → Visiting Minister and linked existing children to their household adults (unconfirmed).
  The *Member* access level (role) keeps its name.

## Languages
English, Afrikaans, isiZulu and isiXhosa for the screens members use (sign-in, Home, menus, the directory and my details,
consent, My serving, serving together, away dates, my leave). Code wraps English text in `T('…')` / `TN(one, many, n)`;
`js/i18n.js` holds one line per text with all four languages, plus month and day names for dates. `tests/i18n.test.js`
finds every `T('…')` in the code and fails if a language is missing or a {part} is lost. The choice is kept per device
(`Store.pref('lang')`), so it also works on the sign-in screen. Administrator-only screens stay English for now, as do the
church's own words (categories, teams, services, kinds of leave, privacy notice) and the shared leave rules' messages.
The isiZulu and isiXhosa were drafted by AI and need checking by fluent speakers.

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
searching on Status or Date of death. Downloads are audit-logged. Searches aren't saved yet (Phase 2: smart lists).
Members have no advanced search. "Church at a glance" (Administrators) is closed until opened.

## When someone dies
Administrators and Pastors use **Record a death** on the person's profile (date, optional funeral date, optional pastoral note,
and "change spouse to Widowed" for a married spouse in the same family). The person stays on the records as category *Deceased*
(`deceasedAt`, key dates "Died" / "Funeral"), leaves the directory, and is skipped by the roster engine (not active).
Administrators then finish it (automatically if they recorded it, otherwise from their to-do list): off future rosters, teams,
serving groups and away dates; future leave cancelled; sign-in removed; their parent/guardian links and collection restrictions removed. Past serving and leave stay. Pastors get
"Care for the family of …" on their to-do list for 8 weeks. "Recorded by mistake?" undoes it (teams and rosters must be re-added).
Later phases must leave deceased people out of messages, birthday reminders and anniversaries.

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
- Only these columns are read: Member ID (Elvanto's person reference), names, Email Address, Cellphone/Landline, Date of Birth,
  Family Relationship, Primary & Spouse Full Names (family key when there is no Family ID), Marital Status, People Category,
  Archived, Deceased, Date Deceased. ID numbers, notes, giving, security codes etc. are never read.
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
