# Church Hub – architecture

Church Hub replaces Elvanto for Christ Church Howick, learning from Elvanto, Planning Center and ChurchSuite.
It is built in phases; each phase is usable on its own. **Read this file first in every new working session.**

## Principles
1. **Clean and self-explanatory.** Every screen says what it is for in one line; every action is a plain-English button. No jargon, no hidden menus.
2. **Apps as cards.** Each area (People, Rosters, Leave, Privacy…) is a *module* that registers itself and appears as a card on Home. Modules can be switched on or off in Settings. New features = new modules, without touching the others.
3. **POPIA by design.** Privacy rules are part of the data model, not an add-on (see `POPIA.md`).
4. **Explainable rostering.** No random rostering. Families and friends who want to serve together are kept together; people who must not serve at the same time are kept apart; every suggestion says why.
5. **Phone first, works on a computer.** One web app, installable on phones; the Android app is the same wrapper as Leave Manager.

## Layers
```
index.html                the single page app (no build step)
css/hub.css               design tokens + components
js/firebase-config.js     the church's Firebase project (empty = demo mode)
js/store.js               data layer: Store.get/put/remove/audit – demo (this browser) or live (Firestore)
js/roster.js              RosterCore: the rostering engine (pure functions, unit-tested)
js/leave-core.js          LeaveCore: Leave Manager's leave rules (copy of leave-manager/assets/core.js – keep in step)
js/app.js                 shell: sign-in, roles, router, Home, module registry, UI helpers
js/mod-*.js               one file per module: people, rosters, leave, privacy, import, settings
firestore.rules           database security rules: who may read/write what (POPIA)
tests/roster.test.js      rostering engine          tests/rules.test.mjs  security rules (Firestore emulator)
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
| `people` | name, contact, family, category, marital status (adults), staff details (leave category, start date, working days), key dates, date of death, child medical notes (special personal information), Elvanto ID |
| `families` | `name` + `custom`. Shown via `Hub.familyName()`: named after its active adults ("Tim & Clare Jacobs", "Thandi Mokoena & Sipho Dlamini") unless `custom` is true; no "head of household" |
| `consents` | per person and purpose: given/withdrawn, date, how, recorded by, guardian for children |
| `notes` | pastoral notes (restricted) |
| `teams`, `positions`, `skills` | who can serve where, and how often they'd like to |
| `services` | dates and times of services/events needing a roster |
| `assignments` | person × position × service, status pending/accepted/declined, why |
| `groups` | serve **together** (must/prefer) or keep **apart** |
| `blockouts` | away dates people enter themselves |
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
| Member | own details (can correct name and contact), own consent, own serving and away dates, own leave (if staff); the church directory |
| No access | kept on the church records, can't sign in |

Leave approval follows Leave Manager: Administrators approve.

## When someone dies
Administrators and Pastors use **Record a death** on the person's profile (date, optional funeral date, optional pastoral note,
and "change spouse to Widowed" for a married spouse in the same family). The person stays on the records as category *Deceased*
(`deceasedAt`, key dates "Died" / "Funeral"), leaves the directory, and is skipped by the roster engine (not active).
Administrators then finish it (automatically if they recorded it, otherwise from their to-do list): off future rosters, teams,
serving groups and away dates; future leave cancelled; sign-in removed. Past serving and leave stay. Pastors get
"Care for the family of …" on their to-do list for 8 weeks. "Recorded by mistake?" undoes it (teams and rosters must be re-added).
Later phases must leave deceased people out of messages, birthday reminders and anniversaries.

## Leave Manager inside the Hub
Staff are people with a `staff` object (`category`, `start`, `workDays` – empty means "same as the category"), set by Administrators
in Edit details. Leave → Settings (Administrators) edits `leave/config`: the same settings, school terms, categories (levels with
working days and allowances), leave types and holidays as Leave Manager's sheet tabs (`church: true` marks a church closure).
The Leave module uses `LeaveCore` (the same rules file as Leave Manager), so balances, pro-rata, carry-over, public holidays
and Sunday-holiday handling behave identically. Approved leave automatically makes a person unavailable for rosters.
Until the Hub is live, the existing Leave Manager keeps running; at switch-over its sheet data is imported.

## Elvanto import
Phase 1: Elvanto's People export (CSV) → column mapping → preview → import people and families, de-duplicated by email/name.
Later: direct import through the Elvanto API (server side, with the church's API key), including groups and departments.

## Hosting (target)
- Code: GitHub (`church-hub` repository); website: GitHub Pages.
- Data: Google Firebase (Firestore + Authentication), project owned by the church, data stored in Johannesburg (Firestore region `africa-south1`).
- Never put real church data in GitHub or in a Claude Project.
