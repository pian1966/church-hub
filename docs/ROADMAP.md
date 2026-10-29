# Church Hub – roadmap

Status key: ✅ done · 🟡 in progress · ⬜ planned

## Phase 1 – Foundation 🟡 – built and live (pre-release v0.1.0, 25 Oct 2026); church trial and Leave Manager import next
- ✅ Architecture, data model, POPIA design (`ARCHITECTURE.md`, `POPIA.md`)
- ✅ Rostering engine: together (must/prefer), keep apart, away dates and leave, fair turns, reasons (`js/roster.js`, tested)
- ✅ App shell: sign-in as a role, Home with app cards and to-do list, modules on/off
- ✅ People: directory, families, profile, consent, key dates, restricted pastoral and medical notes
- ✅ Rosters: monthly matrix, assign/change, auto-fill with reasons, teams & positions, serving together/apart, away dates, "My serving"
- ✅ Leave (Leave Manager built in, same rules): balances, request with balance box, approvals; approved leave blocks rostering
- ✅ Privacy: Information Officer, consent overview, requests register, export/delete a person, retention review, breach register, audit log
- ✅ Import from Elvanto (People CSV)
- ✅ Firebase connection built (session of 24 Oct 2026):
  - `store.js` saves to Firestore when `js/firebase-config.js` is filled in; the demo still works (and stays at `?demo`)
  - sign-in with Google or an email link; access list by email, managed from People → App access; first-Administrator setup screen
  - 28 Oct 2026: "Leave Church Hub?" check before closing – Android back button (app's own question, in the member's language; needs the new app version) and the browser's "Leave site?" when signed in on a computer
  - 28 Oct 2026: People list "Sort by" switch – First name, Known as or Surname (default); names are shown in the chosen order, with the other first name in brackets; remembered on each device
  - 28 Oct 2026 (branch deceased-filter): "Deceased" button on the People list (Administrators, Pastors and staff who see everyone); category "Partner" renamed "Church Partner" so it isn't confused with a partner in a couple (existing records upgraded once, data version 3; marital status "Partner" unchanged); "Sort by" switch also on Advanced search results; dates of death typed in front of names in Elvanto ("2024-08-22-Mike") moved to the date died (once on upgrade, and on every Elvanto import)
  - 28 Oct 2026: Settings → Who can see what: point at (or tap) a number to see who has that access; Advanced search: "Year of death"
  - 28 Oct 2026: Photos – a small photo per person (Add / Change / Remove photo on the person page), shown in the name circles; new Firestore rules for photos/{id} (church must re-publish the rules). Elvanto import brings photos in (full-size picture, made small in the browser; only for people without a photo)
  - 28 Oct 2026: staff keep their category (a Church Partner can be staff); for someone who has died only first and last name are compulsory; "Late spouse – was married to …" on the surviving spouse (and the reverse); ID numbers (Administrators only, Show logged, Elvanto import, taken out of names once – data version 4); church office notes (Administrators and Pastors, Elvanto Notes column). New Firestore rules: idNumbers, officeNotes – church must re-publish
  - 28 Oct 2026: Administrators can set who a widow or widower was married to (someone in Church Hub who has died, a name, or nobody)
  - 28 Oct 2026: People → Late spouses (Administrators): suggestions of who widows/widowers (and people who died) were married to, from household, wedding date, email, phone, surname and age; Yes / Not a couple; list of widowed people with no match
  - 28 Oct 2026: Gender; Church Partner dates (accepted, last updated); Volunteering on each person (services 8am/10am/5pm, departments and positions = Rosters skills with times); Rosters → Teams one-click setup of the 7 departments and 25 positions as in Elvanto (positions marked with the services they run at; rostering and the grid respect it); "Would like to receive" choices (Email / WhatsApp) in the consent register
  - 28 Oct 2026: from Elvanto also Date Added (as when they were added), birthdays and anniversaries written month first ("09-12"), Middle Name, Anniversary, Membership Date / last renewed (year), Checklist of what to receive, Department Positions (volunteering; Memorial Service department added) and home address (new fields). "+ New household…" first in the list. Home only asks to finish a death record when something is left to undo
  - 28 Oct 2026: Advanced search – Administrators tick people in the results and change one thing for all of them (marital status, category, gender, Church Partner dates), with Undo; children left out of marital status, people who died out of category; each change in the history log
  - 28 Oct 2026: a turning cross (with "Please keep this page open") during long jobs – Elvanto and Leave Manager imports, removing imported people, changing many people and undo, adding departments, photo downloads – until everything is saved
  - 28 Oct 2026: Change selected… can also fill in what’s missing – Email or Mobile “not known” (only where empty, adults only) and Household “+ New household for each person” (only for people with none; Undo removes the new households)
  - 28 Oct 2026: adding a photo asks to choose the face (drag, zoom slider / + − / mouse wheel / arrow keys, circle preview); searches find every word typed, in any order (“andr pi” → Andrew Pike) – People, Households and Advanced search “contains”
  - 28 Oct 2026: date of death and funeral can be corrected in Edit details (Administrators and Pastors)
  - 29 Oct 2026: Android app – downloads saved in the phone’s Downloads, camera offered for Add photo (new app version); ARCHITECTURE.md, README, ANDROID.md brought up to date
  - 29 Oct 2026: Elvanto robot reads Elvanto’s Unavailable Volunteers every night (names and dates only, when switched on) → Import → Unavailable dates from Elvanto (Administrators check, choose, add as away dates). Departments and positions keep coming from the Elvanto import
  - 29 Oct 2026: Advanced search – church office notes, volunteer, volunteers at service, away in the next 8 weeks, late spouse, postcode, province, Elvanto ID; “Type to find a field…”; text fields start on “contains”
  - 29 Oct 2026: iPhone home-screen app (home-screen tags, Safari hint, sign-in by pasting the email link, starts on Me); app users without a photo are asked to add one (Not now = a month)
  - 28 Oct 2026: duplicates – People → Find duplicates (Administrators and Pastors) with "Same person: fix…" to merge two records, a warning while adding or editing someone, and very likely duplicates can't be saved unless confirmed as a different person
  - 28 Oct 2026: couples (spouses and partners) worked out from each household; Households → "Couples to confirm" (Administrators and Pastors) confirms them, copies a spouse's wedding anniversary (partners get none) and records a missing marital status; "Not a couple" to dismiss
  - 28 Oct 2026: Administrators get a Leave button on a staff member's page (or "Set up leave" if they're marked Staff but not yet in Leave)
  - Fixed (28 Oct 2026): name searches (People, Households, advanced search) also check the first name and "known as", so Douglas finds Doug Pike
  - Fixed (28 Oct 2026): an email link opened in a different browser (e.g. tapped in Gmail) showed the plain sign-in screen; it now asks "Confirm your email"
  - security rules (`firestore.rules`) per role: medical notes Children's ministry only, pastoral notes Pastors only (Administrators can't read either), members only their own information and the opt-in directory, staff leave private (others see dates only)
  - Children's ministry can now edit medical notes (needs guardian consent first); "No access" option for people who shouldn't sign in
  - tests: rules against Google's emulator, the app in a browser as every role (demo and live), all run on GitHub after every push
- ✅ Church set up Firebase (25 Oct 2026): project `church-hub-7ec02`, Firestore in Johannesburg, rules published, first Administrator signed in and set up the church
  - Lessons: Firebase console rejects curly quotes in rules (fixed); GitHub Pages needs the repository public; `pian1966.github.io` must be an authorised domain
- 🟡 Church to do: tidy Privacy (Information Officer name had a placeholder – fixed in code for future setups), record own consent, approve privacy notice, register the Information Officer
- ⬜ Confirm step 8 (key restricted to the website) is done
- ✅ Added 25 Oct 2026: several away dates at once (tick service days and/or add holiday stretches); marital status for adults
  (required when editing; imported from Elvanto's "Marital Status" column; to-do for adults without one); **Record a death**
  (see ARCHITECTURE.md "When someone dies"). No change to the security rules – nothing to re-publish.
- ✅ Added 25 Oct 2026 – Leave usable live: Administrators mark people as staff (Edit details → Church staff member: category,
  start date, own working days); **Leave → Settings** (leave year, open days, pro-rata, going over; school terms; categories and
  allowances; kinds of leave: name, needs approval, in use, add new; public holidays per year and church closures)
- ✅ Added 25 Oct 2026: families named after their adults automatically (tells apart families with the same surname; follows marriages, moves and deaths); People → Families → Rename for an own name
- ⬜ Church: fill in Leave → Settings (terms, allowances) and mark staff; try Leave alongside the old Leave Manager
- ✅ Added 25 Oct 2026: **Import → From Leave Manager** – the Leave Manager Google Sheet (Excel download or CSV tabs) into Firebase:
  requests, carry-over adjustments, settings, staff details; staff matching with a preview of balances; safe to run again; PINs dropped.
  Built-in Excel reader (no outside library). Roster engine fix: friends who prefer to serve together no longer depend on name order.
- ✅ Added 26 Oct 2026: **Church at a glance** on People (Administrators only): totals, age groups, members/visitors/staff, marital status, family size, consent coverage, serving – numbers only, no names
- ✅ Fixed 26 Oct 2026 – Elvanto import with the church's real export layout: people sharing an email were merged (92 lost),
  adults with children were marked as children, no families (no Family ID column), categories flattened, Elvanto ID not read.
  Now: Member ID, Primary & Spouse names as family key, Family Relationship, category mapping (new **Attender** category),
  marital status "Partner", birthdays without a year, Archived/Deceased; "Remove everyone brought in from Elvanto" to start again. Tested.
- ✅ 26 Oct 2026: Leave tables show the full names of the kinds of leave (not PSL, SSL…); Team balances hides kinds nobody has
- ✅ 26 Oct 2026: **one staff member's leave in detail** (Administrators: click a name in Team balances or Approvals, or Leave on their profile): balances made up (allowance, from last year, taken, waiting, left) per leave year, every request with reasons and decisions, approve/decline/cancel, adjustments, download their report; download team balances. Viewing is audit-logged.
- ✅ 26 Oct 2026: **approved leave → Elvanto's Unavailable Volunteers**, as Leave Manager did: Leave → Elvanto (switch on at
  switch-over, Elvanto address, robot sign-in, entries and their status, try again / done by hand, to-dos); robot on GitHub
  every 15 minutes with its own limited Church Hub sign-in; Leave Manager's existing entries found by their note. Tested
  (rules, app, robot with stand-in servers). Also: "click again to confirm" no longer undone by background refreshes.
- ✅ 27 Oct 2026: **households, parents, guardians and collection** (Planning Center + ChurchSuite approach): a child can live in
  several households; parents/guardians/collectors per child with can give consent / primary contact / may collect; **Not allowed
  to collect** (restricted, logged); consent for children only from adults who can give it; "Responsible for" on adults; Home
  to-dos for unconfirmed links and children with nobody who can consent; Elvanto import links children to their parents
  (unconfirmed). **Search by family** on People and Families. Categories renamed: **Member → Partner, Visitor → Visiting Minister**
  (existing data updated automatically on the first Administrator sign-in). New rules – **re-publish them**.
- ✅ 27 Oct 2026: **Advanced search** on People, as in Elvanto (filters, match all/any/own logic, columns, sort, CSV download –
  audit-logged; each role searches only what it may see). "Church at a glance" now closed until opened. No rule changes.
- ✅ 27 Oct 2026: **Languages** – English, Afrikaans, isiZulu, isiXhosa for the screens members use (picker in the menu and on
  sign-in, remembered per device; dates too). Screens now say **Household** consistently (Households page, Edit details,
  search). Email-link errors now show Firebase's reason. Advanced search moved to a link under the search box.
- ✅ 27 Oct 2026: profile shows **age** under the birthday; **wedding anniversary** (Edit details) with years married underneath (while married)
- ✅ 27 Oct 2026: forms shade the boxes that must be filled in (key at the top; no more “(optional)”); Edit details shows age and years married as dates are typed
- ✅ 27 Oct 2026: email and mobile must be filled in for adults – type “unknown” if not known (saved as “Not known”, never as the word); “Married N years” wording
- ✅ 27 Oct 2026: Away dates shows the kind of leave and its reason – only to the person and Administrators (roster coordinators still see “On leave”)
- ✅ 27 Oct 2026: Category, Household and “In the household as” must be filled in (new people start on “Choose…”; someone living alone gets “+ New household”)
- ✅ 27 Oct 2026: **Android app and "Me"** – members manage their own details, days away and where they'd like to serve:
  - **Me** (new module, first in the phone tab bar for members): *My details* (change name/known as/email/mobile; see what the
    office keeps; consent; language; sign out), *Days away* (add/remove; warns about roster turns on those days), *Serving*
    (accept/decline turns; where I serve; **offer to help**, serve more/less often, or stop)
  - **Offers to serve** (new `serveOffers`): roster coordinators answer under Rosters → Teams (Yes / Not now with a reply), Home to-do
  - **Android app** (`android/`, same wrapper as Leave Manager, its own signing key): native Google sign-in, paste-the-email-link
    sign-in, back button, file choosing, offline screen; GitHub builds `ChurchHub.apk` (fixed "android" release)
  - Home-screen icons and `manifest.webmanifest` (iPhone: Safari → Add to Home Screen)
  - New rules – **re-publish them**. Tests: rules, app (member, coordinator, pastor, app sign-in), languages.
- ⬜ Church: Android app setup (docs/ANDROID.md): keep ChurchHub-ANDROID_KEYSTORE.txt safe and add it as the secret, build, optional Google sign-in (Web client ID), re-publish rules, try it, send the link
- ✅ 27 Oct 2026: Android test build and all tests (incl. the rules against Google's emulator) green on GitHub for pull request #1
- ⬜ Church: fluent speakers check the isiZulu and isiXhosa (js/i18n.js – one line per text); then decide whether to translate
  staff screens too
- ⬜ Church: switch on Email link sign-in in Firebase (Authentication → Sign-in method → Email/Password → both switches)
- ✅ 29 Oct 2026: **Which service?** – offering to serve (Me → Serving) now asks at which services; the roster coordinator's Yes
  keeps that choice. Settings → **Services and venues** lists the regular services (8am, 10am, 5pm) and can add other times,
  days, campuses or venues; rosters, volunteering, search and the Elvanto import all use that list. People who served at all
  three old services now serve at every service, so new ones include them. **Re-publish the rules.**
- ✅ 29 Oct 2026: **Advanced search field list as in Elvanto** – clicking the field opens the whole list (with its group
  headings) and a box to type in; typing "name" or "marit" narrows the list as you type; Enter or a click picks, Esc closes.
- ✅ 29 Oct 2026: **View as another role** – Administrators can see Church Hub as a Pastor, Roster coordinator, Children's
  ministry or Member would (the eye next to their name, or More on a phone). A banner shows it; nothing is saved meanwhile;
  pastoral and medical notes stay hidden; starting and stopping is in the audit log.
- ✅ 29 Oct 2026: **Province** on a person's details is a dropdown of South Africa's nine provinces (the typing list didn't open in some browsers).
- ✅ 29 Oct 2026: **International and denominational** – the church's country (Settings) and a country per address, with
  its provinces/states/counties and postcode wording (46 countries); **Church wording** sets (Anglican, Catholic, Methodist,
  Presbyterian/Reformed, Baptist, Pentecostal, Lutheran) and renaming any word; the Privacy pages follow the country's law
  (POPIA, GDPR, UK GDPR and others); **18 more languages** by continent (Africa, Europe, Americas), drafted by Claude –
  to be checked by fluent speakers.
- ✅ 29 Oct 2026: **Care groups** – set up by Administrators and Pastors; carers add and remove members; members see each
  other's photo, phone, email, address and birthday with the new "Care group" consent. **Re-publish the rules.**
- ✅ 29 Oct 2026: **Services** – remove any upcoming one, stop a regular service from a date, and add **special services**
  (Maundy Thursday, Tenebrae, Good Friday, Christmas Day, Ascension, Pentecost and more, dates worked out from Easter).
  **View as…** moved to the top right. Unfolded sections stay open when the screen refreshes.
- ⬜ Later: other countries' public holidays for Leave (Leave still uses South Africa's); translations checked by fluent
  speakers; church wording in the other languages too.
- ✅ 29 Oct 2026: **View as a carer** (choose the care group; see it as its carer does); Afrikaans, isiZulu and isiXhosa listed with Africa's languages; a finer turning cross.
- ✅ 29 Oct 2026: View as calls the Member level **Church Partner**. **Late spouses**: a widow and a man of her surname who died married are suggested even in different households; someone still recorded as Married whose spouse died is suggested too (Yes changes them to Widowed).
- ✅ 29 Oct 2026: **Leaving Church Hub asks first**: Back past the first screen (browser and iPhone home-screen app) asks “Leave Church Hub?”; Sign out asks “Sign out of Church Hub?” (closing the tab still gets the browser’s own warning; the Android back button already asked).
- ✅ 29 Oct 2026: **Type part of a name** to add people to care groups (Care groups page and carers’ Add someone); every long list of people or households (household, parent/guardian, not allowed to collect, late spouse, rosters, days away, privacy requests, leave, Leave Manager import) narrows as you type.
- ✅ 29 Oct 2026: **More than one care group** per person (tick each in Edit details; a carer in one, a member in another); each group gets its own card; members see all their groups on the Me page. **Duplicate a care group** with all its members (button next to Rename and Delete). No rules change.
- ⬜ Later (Phase 2): save searches as smart lists; use them for emails and SMS
- ⬜ Church: re-publish the rules (FIREBASE-SETUP step 7), then check the parents/guardians of each child (Home to-do)
- ⬜ Later (Phase 4 check-in): show "Not allowed to collect" and allowed collectors at sign-out
- ⬜ Church: set up the robot (docs/ELVANTO-ROBOT.md steps 1–5; **re-publish the rules**), switch over with step 6
- ⬜ Later: Elvanto calendar events for staff leave (Leave Manager's optional extra, needs an Elvanto API key)
- ⬜ Leave Manager features not yet in Church Hub (checked 29 Oct 2026 against leave-manager's README and guides):
  wallchart, month calendar and year planner; printable leave reports with signature lines, all-staff summary and the
  payroll (unpaid leave) report; Dashboard insights (who's away today, leave still to take, cover problems in the next 8
  weeks, busiest months, sick-leave patterns); editing cover rules / blocked days (imported rules are already enforced);
  stand-in approver; a leave History page (the audit log has the events); emails (new request with a Review button,
  decision, cancelled, Monday "Who's away this week", "use it or lose it" reminders); holidays and school terms updating
  themselves; Google Calendar mirror; the Google Form; help videos; dark mode.
- ⬜ Church: remove the first Elvanto import (Import page), re-export (fewer columns), import again and check
- ⬜ Church: trial the Leave Manager import, compare balances, then re-import at switch-over and retire Leave Manager (archive the sheet)
- ⬜ Check the first GitHub test run is green (Actions tab) – the rules tests couldn't run in the Claude session (emulator download blocked there)
- ⬜ Trial with 2–3 staff and made-up people; Information Officer approves privacy notice (mention sign-in accounts are held by Google outside SA) and accepts Google's data processing terms
- ⬜ Then: import real people from Elvanto (Import) and give access

## Phase 2 – People and pastoral care
Members see their own family (and give consent for their children), smart lists (leave out people who have died), follow-up workflows (newcomer "connect" form starts them), birthdays and key-date reminders, background-check tracking, forms, members updating their own details (with approval).

## Phase 3 – Rostering and services (complete)
Accept/decline by email and app, swap requests, reminders, sign-up sheets, run sheets / order of service, matrix across several services, Leave Manager switch-over (import sheet data).

## Phase 4 – Groups, attendance and check-in
Groups and attendance, kids check-in on a tablet with medical alerts and leader ratios, headcounts, volunteer check-in.

## Phase 5 – Communication and calendar
Email (consent-aware, with opt-out, never to people who have died or left), SMS via a South African provider, app notifications, church calendar and website embeds.

## Phase 6 – Member app and extras
Church Center-style member app (first part done: Me + Android app, Oct 2026), Elvanto API import (groups, departments), NFC tags, AI help, leadership insights.

## Working method
One phase per fresh chat in the Claude Project "Church Hub", with the repository attached. Update this file at the end of each session.
