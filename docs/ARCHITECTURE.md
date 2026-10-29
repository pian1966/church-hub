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
js/i18n.js                I18n: English, Afrikaans, isiZulu, isiXhosa (tested), and the list of more languages
js/lang/<code>.js         one file per further language (18, by continent), loaded only when someone chooses it (tested)
js/countries.js           Countries: 46 countries – regions (province/state/county…), postcode wording, dialling code, law (tested)
js/privacy-law.js         PrivacyLaw: the law the Privacy pages follow, from the church's country (POPIA, GDPR, UK GDPR…; tested)
js/wording.js             Wording: the church's own words (sets by denomination + renamed words), applied to the screens (tested)
js/care.js                Care: care groups – who is in which group, carers, and the card the group sees (tested)
js/sample.js              made-up church for demo mode and tests
robot/robot.js            the Elvanto robot (GitHub Actions, every 15 min): does the waiting Elvanto updates (docs/ELVANTO-ROBOT.md)
js/app.js                 shell: sign-in, roles, router, Home, module registry, UI helpers (search matching, photos and
                          "Choose the face", the turning cross for long jobs, downloads)
js/mod-*.js               one file per module: me, people, rosters, leave, care, privacy, import, settings, words (Translations)
android/                  the Android app: shows the website full screen + native Google sign-in (docs/ANDROID.md)
manifest.webmanifest      home-screen icon and name (iPhone "Add to Home Screen", Android browsers)
firestore.rules           database security rules: who may read/write what (POPIA)
tests/*.test.js           one per pure rules file above (roster, leave-import, elvanto-import, elvanto-sync, households,
                          people-search, duplicates, i18n, countries, privacy-law, wording, serving, care) and the robot
                          (robot.test.js); made-up data in tests/fixtures
tests/rules.test.mjs      security rules (Firestore emulator)
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
  | `people/{id}` | name, household, category, email, mobile, active, app role (display copy), `photo` (version of their photo, if any), date added | Admin, Pastor, Roster coordinator, Children's ministry; the person |
  | `details/{id}` | everything else about the person: birthday, gender, middle name, home address, marital status, late spouse, key dates (wedding, died, funeral), staff details, Church Partner dates, date of death, "unknown" email/mobile, Elvanto ID (+ copy of family role) | Admin, Pastor; Children's ministry for children; the person |
  | `medical/{id}` | children's allergies and medical notes | **Children's ministry only** |
  | `notes/{personId}` | pastoral notes (`entries` list) | **Pastors only** |
  | `officeNotes/{personId}` | church office notes (`entries` list; Elvanto's Notes come here) | Admin, Pastor |
  | `elvantoFound/unavailable` | what the robot read in Elvanto's Unavailable Volunteers: names and dates only | **Admin only** (the robot writes it) |
  | `idNumbers/{personId}` | ID number (`value`) – fetched one at a time on **Show**, every view audit-logged | **Admin only**; the person sees their own |
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
| `teams`, `positions`, `skills` | departments, positions and who serves where, how often (`frequency`) and at which services (`times`, service ids such as ["08:00","10:00"] or "09:30@hilton-hall"; empty = every service). The regular services are `settings.serviceSlots` – { id, label, day, time, venue } – set in Settings → Services and venues (8am, 10am and 5pm until changed); a roster `service` carries its `slot` and `venue`. A position's `times` are the services it runs at (Creche Duty only at 08:00; Memorial Teas: `memorial`). Rosters → Teams adds the church's 8 departments and 26 positions in one click (`js/serving.js`); a person's **Volunteering** (People) writes their `skills` |
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

### View as another role (Administrators)
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
**Android app** (`android/`, built by `.github/workflows/build-android.yml`, setup in `docs/ANDROID.md`): a WebView
showing the website, built like Leave Manager's app (its own signing key). It offers the camera next to the gallery when a
page asks for a picture (photo saved in the app's cache, shared with the camera app only through a FileProvider), and
`ChurchHubApp.saveFile(name, type, text)` saves downloads in the phone's Downloads (`Hub.download()` uses it; older app
versions are asked to update). It adds `window.ChurchHubApp`; when present,
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
- **Upgrades**: modules may have `upgrade()`, run for Administrators after sign-in, once per `settings.dataVersion`:
  2 renamed the categories Member → Partner and Visitor → Visiting Minister and linked existing children to their household
  adults (unconfirmed); 3 renamed Partner → **Church Partner** (not to be confused with a partner in a couple) and moved
  dates of death typed in front of names ("2024-08-22-Mike") into the date died; 4 moved ID numbers typed into names into
  `idNumbers`. The *Member* access level (role) keeps its name.

## Languages
English, Afrikaans, isiZulu and isiXhosa for the screens members use (sign-in, Home, menus, the directory and my details,
consent, My serving, serving together, away dates, my leave). Code wraps English text in `T('…')` / `TN(one, many, n)`;
`js/i18n.js` holds one line per text with all four languages, plus month and day names for dates. `tests/i18n.test.js`
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
people). The Add / Edit window warns as names are typed; a match of 70+ can't be saved unless they tick "I've checked: this is a
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
- **Church wording** (`js/wording.js`): Settings → Church wording: a set (General, Anglican, Catholic, Methodist,
  Presbyterian/Reformed, Baptist, Pentecostal, Lutheran) and any word renamed (`settings.wording = { set, custom }`).
  `app.js` changes the words in what is shown (text nodes and titles/placeholders, after every render, in dialogs and
  messages) – in English only; stored values never change (`Church Partner` in the database shows as "Parishioner").
  Text inside `data-own-words` (people's notes, the wording panel itself) is left alone.
- **Privacy law** (`js/privacy-law.js`): from the church's country – POPIA (ZA), GDPR (EU/EEA, with each country's
  authority; Germany notes church data protection law), UK GDPR (ICO), FADP (CH), PIPEDA (CA), Privacy Act (AU, NZ),
  LGPD (BR), and Kenya, Nigeria, Zimbabwe, Botswana, Rwanda, Malawi, Ethiopia, Mexico, Chile; general wording elsewhere.
  The Privacy pages, the officer's title, the regulator, breach advice and days to answer a request follow it. Checked
  October 2026 – not legal advice.
- **Languages**: `js/i18n.js` keeps the four built-in languages; `I18n.MORE` lists 18 more (Sesotho, Setswana, Sepedi,
  Xitsonga, siSwati, Tshivenḓa, isiNdebele, chiShona, Kiswahili, Amharic, Yorùbá, French, Portuguese, Spanish, German, Dutch,
  Italian, Polish), each in `js/lang/<code>.js` (`I18n.add(code, { mon, dow, words })`), fetched when chosen; the screen is
  redrawn when it arrives (`I18n.onLoad`). The picker groups them by continent. A line missing in a file shows in English;
  `tests/i18n.test.js` checks every file keeps the `{parts}`. All were drafted by Claude (AI): the Me page says so and asks
  people to tell the church office if something reads oddly. When adding a member-facing text, add it to `js/i18n.js`
  and to every `js/lang` file – `tests/i18n.test.js` fails if any of the 22 languages is missing a line.
- **Better wording from the church** (`js/mod-words.js`, the Translations card): anyone signed in who uses another language
  sees "Help improve the … wording on this page" at the foot of every page. It opens the texts that page showed
  (`I18n.page()` / `I18n.seen()`, collected by the router) or all of them, with a search; a suggestion must keep the
  English text's {parts} and bold marks (`I18n.check`). Suggestions go to `wordIdeas`. Each language can have **checkers**:
  an Administrator chooses them (Translations → Who checks), which puts `reviewLangs` on the person and `langs` on their
  access-list entry (`roles/{email}`), so the rules let them read that language's suggestions and write `words/{lang}`.
  Administrators can check every language. "Use this" (or "Change it first") writes the wording into `words/{lang}`;
  `I18n.override()` uses it before the built-in line, so it shows for everyone at once. "Go back to the original" removes it.
  "Download the changed wording" gives a JSON file to fold into `js/i18n.js` / `js/lang` later. Approved wording only shows
  after signing in (the sign-in screen uses the built-in files).

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
  Church wording renames them (Home group, Cell group, Class and Class leader, Small Christian Community…).

## Services that need a roster
- Settings lists every upcoming service with a bin to remove it (and its roster); "Stop holding a regular service…"
  removes a regular one's upcoming services from a date (confirmed in a dialog).
- **Special services** (`Serving.specials(year)`): suggestions grouped by season with the churches that usually keep them,
  and dates worked out from Easter (`Serving.easter`): Ash Wednesday, Palm Sunday, Maundy Thursday, Tenebrae, Good Friday,
  Easter Vigil, Ascension Day, Pentecost, Trinity Sunday, Corpus Christi; plus Advent Sunday, Christmas Eve and Day,
  Watchnight, Covenant service, Epiphany, Remembrance Sunday, Reformation Sunday, All Saints', Christ the King, and occasions
  (baptisms, confirmations, weddings, funerals…). A special service is a `services` record with `special: true`; "Teams
  like" picks which regular service's positions it uses (its `slot`).

