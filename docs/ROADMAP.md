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
  - 28 Oct 2026: duplicates – People → Find duplicates (Administrators), a warning while adding or editing someone, and very likely duplicates can't be saved (only an Administrator can confirm "a different person")
  - 28 Oct 2026: couples (spouses and partners) worked out from each household; Households → "Couples to check" copies a spouse's wedding anniversary (partners get none) and records a missing marital status, with "Not a couple"
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
- ⬜ Later (Phase 2): save searches as smart lists; use them for emails and SMS
- ⬜ Church: re-publish the rules (FIREBASE-SETUP step 7), then check the parents/guardians of each child (Home to-do)
- ⬜ Later (Phase 4 check-in): show "Not allowed to collect" and allowed collectors at sign-out
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
Church Center-style member app (first part done: Me + Android app, Oct 2026), Elvanto API import (groups, departments), NFC tags, AI help, leadership insights.

## Working method
One phase per fresh chat in the Claude Project "Church Hub", with the repository attached. Update this file at the end of each session.
