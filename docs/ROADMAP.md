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
- ⬜ Church: set up the robot (docs/ELVANTO-ROBOT.md steps 1–5; **re-publish the rules**), switch over with step 6
- ⬜ Later: Elvanto calendar events for staff leave (Leave Manager's optional extra, needs an Elvanto API key)
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
Church Center-style member app, Android build, Elvanto API import (groups, departments), NFC tags, AI help, leadership insights.

## Working method
One phase per fresh chat in the Claude Project "Church Hub", with the repository attached. Update this file at the end of each session.
