# Church & Trellis – changelog

Finished work, moved here from `docs/ROADMAP.md` so the roadmap stays short. Nobody needs to read this to work on
Church Hub; it is the history. Newest entries at the bottom of each section; add a line here when you tick something off.

## Phase 1 – Foundation
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
- ✅ Added 25 Oct 2026: several away dates at once (tick service days and/or add holiday stretches); marital status for adults
  (required when editing; imported from Elvanto's "Marital Status" column; to-do for adults without one); **Record a death**
  (see ARCHITECTURE.md "When someone dies"). No change to the security rules – nothing to re-publish.
- ✅ Added 25 Oct 2026 – Leave usable live: Administrators mark people as staff (Edit details → Church staff member: category,
  start date, own working days); **Leave → Settings** (leave year, open days, pro-rata, going over; school terms; categories and
  allowances; kinds of leave: name, needs approval, in use, add new; public holidays per year and church closures)
- ✅ Added 25 Oct 2026: families named after their adults automatically (tells apart families with the same surname; follows marriages, moves and deaths); People → Families → Rename for an own name
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
- ✅ 27 Oct 2026: Android test build and all tests (incl. the rules against Google's emulator) green on GitHub for pull request #1
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
- ✅ 29 Oct 2026: **View as a carer** (choose the care group; see it as its carer does); Afrikaans, isiZulu and isiXhosa listed with Africa's languages; a finer turning cross.
- ✅ 29 Oct 2026: View as calls the Member level **Church Partner**. **Late spouses**: a widow and a man of her surname who died married are suggested even in different households; someone still recorded as Married whose spouse died is suggested too (Yes changes them to Widowed).
- ✅ 29 Oct 2026: **Leaving Church Hub asks first**: Back past the first screen (browser and iPhone home-screen app) asks “Leave Church Hub?”; Sign out asks “Sign out of Church Hub?” (closing the tab still gets the browser’s own warning; the Android back button already asked).
- ✅ 29 Oct 2026: **Type part of a name** to add people to care groups (Care groups page and carers’ Add someone); every long list of people or households (household, parent/guardian, not allowed to collect, late spouse, rosters, days away, privacy requests, leave, Leave Manager import) narrows as you type.
- ✅ 29 Oct 2026: **More than one care group** per person (tick each in Edit details; a carer in one, a member in another); each group gets its own card; members see all their groups on the Me page. **Duplicate a care group** with all its members (button next to Rename and Delete). No rules change.
- ✅ 29 Oct 2026: **Staff screens translated (drafts, all 22 languages)**: Rosters (coordinator side too), Care groups, People (lists, profiles, households, guardians, medical, duplicates, late spouses, advanced search, edit form), and the roster’s own messages. Fluent speakers should check the drafts.
- ✅ 29 Oct 2026: **The rest translated (drafts, all 22 languages)**: Leave admin (approvals, team balances, staff pages, Elvanto robot, leave settings), Settings, Privacy, Import (Elvanto and Leave Manager), the setup screen and “View as”. The whole app is now translated. The language test is now strict for all 22 languages: a new text with no translation fails the checks. Left in English on purpose: the audit log, robot notes and CSV column headings (records, not screens). Fluent speakers should check the drafts, especially siSwati, isiNdebele, Xitsonga and Tshivenda.
- ✅ 29 Oct 2026: **Better translations from the church**: anyone using another language can suggest better wording for any text
  ("Help improve the … wording on this page" at the foot of every page, or the Translations card). An Administrator chooses who
  checks each language (Translations → Who checks); checkers (and Administrators) use, change or decline suggestions, and approved
  wording shows for everyone at once. Rules changed: the church must re-publish `firestore.rules`.
- ✅ 29 Oct 2026: **Sweep for leftover English** (found by showing every page and dialog, as each role, in a test language that
  marks translated text): Advanced search (fields, comparisons, messages, screen-reader labels), Change many people, Find
  duplicates and Late spouses (with their reasons), the Elvanto import's mapping, the Privacy headings and intros, Leave
  (days left, weekday names, "6 days"), Settings weekdays, form messages, dialog names – 235 texts in all 22 languages.
  `TX('…')` now marks a text kept in a list and translated where it is shown, so the language test checks those too.
  Still English on purpose: church data (names, teams, kinds of leave, holidays, countries, special-service names), Elvanto's
  own column headings, the audit log, CSV downloads, and the privacy laws' names and legal guidance (`js/privacy-law.js`).
- ✅ 4 Nov 2026: **Church Partners and their family details**: Leave is hidden from Church Partners who aren't staff. On
  Me → My details they can ask the church office to change their marital status, wedding anniversary, spouse or partner and
  children; nothing changes until an Administrator checks it (People → Changes people asked for, Home to-do). Rules
  changed (`detailChanges`): the church must re-publish `firestore.rules`.
- ✅ 4 Nov 2026: **About page for everyone** (version 0.2.0): version and release date, Android app version, developer,
  privacy notice, what's new, and Check for updates (website and Android app).
- ✅ 4 Nov 2026: **Contact details by role** (version 0.3.0): the directory consent is now "Contact details" (name, phone,
  email, address); Settings → What others can see sets, per role, what besides the name others see (name only by default);
  Church Partners see shared details as pictures they can't tap or copy. Every script's `?v=` raised so phones fetch the new
  files (the language box was still showing on Me from an old copy). Rules changed (`directory`, `contacts`): re-publish.
- ✅ 4 Nov 2026: **Small fixes and Music wording** (version 0.4.0): Sign out only in the menu (not on Me); Settings → Church
  wording can call music in services Worship, Music or Praise (with its team and leader); About checks for updates every time
  it is opened. Language files now refresh on phones too (`PACK_VERSION`).
- ✅ 4 Nov 2026: **Updates load properly** (version 0.4.1): every file in `index.html` now carries the version number
  (`?v=0.4.1`), so a new version always makes browsers and phones fetch every file (version.js had been left on an old
  number, so About kept showing 0.3.0). Update now loads the page under a new address. `tests/versions.test.js` checks it.
- ✅ 4 Nov 2026: **AGENTS.md** so Jules (Google's Gemini coding agent) follows the same rules as Claude (`CLAUDE.md`), works on
  its own branches, and knows how to run the tests.
- ✅ 4 Nov 2026: **AGENTS.md covers Antigravity** (Google's Gemini editor on the computer): named alongside Jules, and told
  to start each task on a new branch from the latest `main` rather than working on `main`.
- ✅ 4 Nov 2026: **Show access level under Me** (version 0.4.2): the "Me" page now shows which tier/level of access (App access)
  the user is on under details kept by the church office.
- ✅ 4 Nov 2026: **No "Member" label on other people for Church Partners** (version 0.4.3): people from the directory carry no
  category, so none is shown (it showed a made-up "Member", ignoring Church wording).
- ✅ 4 Nov 2026: **Terminology (Church Words) page** (version 0.4.4): "Church wording" under Settings is now called
  "Terminology (Church Words)" and has its own full-width page (`#/settings/terminology`), with a summary card and a Change
  button on Settings, so the table of words is easier to edit.
- ✅ 4 Nov 2026: **Search people by phone, email or address** (version 0.5.0, from Jules's #46): the People search box also
  finds part of a mobile number (with or without spaces, and "+27 82…" and "082…" find each other), an email address or a
  home address – only what the person searching may already see (each person's directory consent and Settings → What others
  can see). `tests/directory-search.test.js`.
- ✅ 4 Nov 2026: **About says "staff management"** (version 0.5.1): About now says Church Hub keeps the church’s people, rosters,
  care groups and staff management in one place (was "leave"), in every language.
- ✅ 4 Nov 2026: **"Basic access" instead of "Member"** (version 0.5.2, from Jules's #49): the access level for everyone who can
  sign in without a special role is called "Basic access" everywhere (Settings, a person's App access, Me, View as, advanced
  search), so it can't be confused with the Church Partner, Attender or Visiting Minister categories.
- ✅ 4 Nov 2026: **One "Who can see what" table** (version 0.6.0): Settings → Who can see what and What others can see are one
  full-width table. Each access level shows what it can use, which of other people's contact details it sees (tick boxes for
  Basic access, Roster coordinator and Children's ministry; "All, always" for Administrator and Pastor), and who has it.
  Fixed a stray line above the People numbers.
- ✅ 4 Nov 2026: **Advanced search on ID number** (version 0.7.0, Administrators only): People → Advanced search → Privacy →
  ID number finds people by all or part of their ID number (at least 4 digits; spaces ignored). The numbers are fetched only
  when Search is pressed, never shown in the results, a column or the download, and each search is in the history log with
  who was found.
- ✅ 4 Nov 2026 (0.8.0): **live duplicate check** – warns as each letter is typed (two letters of each name; unfinished and
  sound-alike names; "vd" surnames), shows under the email and mobile boxes who already has that email or number, and a
  **sensitivity slider** (1–5) on Find duplicates. New words in all 22 languages.
- ✅ 4 Nov 2026 (0.9.0): **duplicate check on partly typed contact details** – while someone is added or edited, the boxes for
  mobile, email and street address show who already has one *starting* like what has been typed: a mobile from 7 digits
  ("+27 82…" = "082…"), an email from 6 characters, an address from a house number and 3 letters ("12 Mai" → 12 Main Road;
  Rd/Road and St/Street the same). Addresses are new to the check; people in the chosen household are left out. All 22 languages.
- ✅ 4 Nov 2026: **Chinese, Japanese and American English** (version 0.9.0): added Simplified Chinese, Traditional Chinese,
  Japanese (in a new Asia section in the language picker), and American English (in Americas).
- ✅ 4 Nov 2026 (0.10.0): the two 0.9.0 changes above released together; the new duplicate-check sentences added to Chinese, Japanese and American English.
- ✅ 5 Nov 2026 (0.10.1): Care groups – the large “Not a carer / Make carer” button beside each member is now a small star: faint until you point at it, filled green for a carer (the words show when you hover).
- ✅ 5 Nov 2026 (0.10.2): “Help improve the … wording on this page” now sits at the very bottom of each page, smaller and in a lighter grey.
- ✅ 5 Nov 2026 (0.10.3): “Help improve the … wording” is now a small footnote at the bottom right of each page.
- ✅ 5 Nov 2026 (0.10.4): details lists (Me, a person's page…) – the labels column is only as wide as its longest label in the language being used (at most 45%), so long email addresses get more room.
- ✅ 5 Nov 2026 (0.11.0): a map pin beside home addresses (a person's page, the People list details, care group cards on Me) opens the address in Google Maps. Not shown to Church Partners where addresses are drawn as pictures. All languages.
- ✅ 5 Nov 2026 (0.12.0): **Email templates and daily prompts** (Jules, then Claude): editable emails for birthdays, wedding anniversaries (one email to the couple), the anniversary of a spouse's death, and newcomer welcomes (first visit and 3 weeks). Administrators get them on Home each morning, check the wording, and open them in the church's email program or Gmail. Only people with consent “Email”; nobody divorced or separated gets an anniversary email; the church's addresses and the “Signed by” name are set under Settings → Email templates; prompts already done are kept where only Administrators can see them and cleared each day.
- ✅ 5 Nov 2026 (0.12.1): duplicates – a first name cut short (“And Pike” for Andy Pike) is found when the mobile, email or birthday is the same; two people with different Elvanto IDs are no longer ruled out (Elvanto has duplicates too) but shown at most as “Possibly”.
- ✅ 5 Nov 2026 (0.12.2): People list on phones – the tags (Church Partner, Staff, No consent…) go under the name, so names and households use the full width instead of wrapping one word per line.
- ✅ 5 Nov 2026 (0.13.0): **Bin for people** – Edit details → Move to Bin (Administrators): hidden everywhere and no app access, restored from People → Bin within 30 days, then deleted for good (completely if they never served or took leave; otherwise an anonymous record is kept). All languages.
- ✅ 5 Nov 2026 (0.14.0): Care groups → **Suggest groups by where people live** – every Church Partner not yet in a group gets a suggested group (from who they live with, then suburb/town and postal code), to tick and confirm; a separate **Not clear** list (no address, no group nearby, several groups) to choose by hand; **Areas it covers** on each group (Rename). No rules change. All languages (drafts).
- ✅ 5 Nov 2026 (0.14.1): Suggest care groups by area looks deeper – an estate, complex or suburb in the address (Amber Glen, Amber Valley, Howick West) is matched to the group named after it before the town; someone whose address says only "Howick" while groups meet in several parts of Howick goes to Not clear ("which part?") instead of the Howick group.
- ✅ 5 Nov 2026 (0.15.0): **What Pastors can do** (Settings): an Administrator ticks which Administrator abilities Pastors have – settings, app access (smaller roles only), member change requests and the Bin, ID numbers, leave, rosters, privacy, import, translations. Enforced by the database rules (may('…')), copied onto each Pastor's access entry; Pastors can't change their own ticks or give Administrator/Pastor access. Medical notes stay with Children's ministry.
- ✅ 5 Nov 2026 (0.15.1): Edit details – “Mark as left” (with a door icon) and “Move to Bin” moved to the top of the window, apart from the details and the Save button.
- ✅ 5 Nov 2026 (0.15.2): **Chinese and Japanese taken out for now** – their machine translations got the app's key words wrong
  (Leave as "go away", Pastoral notes as "countryside notes", Household as "household goods", Rosters as "name register").
  Anyone who had chosen them sees English. American English stays. The files are in the history (0.10.0) to fix and add back.
- ✅ 5 Nov 2026 (0.16.0): Leave – **cover rules and blocked days** (Leave → Settings: “at least … on duty” or “No leave”, for all staff or a category, days of the week, yearly / Easter-based / one-off dates, warn or block; quick buttons for a pastor every Sunday, Christmas and Easter) and the **stand-in approver** (Leave → Approvals: a Pastor approves or declines others’ leave between two dates; the rules check the dates). Pastors with the leave tick can now save leave settings.
- ✅ 5 Nov 2026 (0.17.0): Leave – Who’s away as a **wallchart** (everyone on one month: colours by kind of leave, waiting leave striped, half days, days not worked shaded, no-leave days marked, a count of who’s away with uncovered days in red), a **month calendar**, or the list; and a **year planner** on My leave and on each person’s leave page.
- ✅ 5 Nov 2026 (0.18.0): Leave – the **Dashboard** for leave managers (waiting requests to approve, away today, leave still to take, cover problems in the next 8 weeks, use it or lose it, busiest months, sick-leave patterns with the South African medical-certificate flags; opening it is logged), **printable reports** (one person with signature lines, all staff summary or in full), the **payroll file** of unpaid leave, and **Change** on a request (staff changing approved leave send it back for approval).
- ✅ 5 Nov 2026 (0.19.0): Leave – emails opened ready to send (like the birthday emails): after a decision, to the person; after a staff request, to the church office; the weekly “who’s away” email (reminded on the Dashboard and Home, Mondays) and the “use it or lose it” reminders (1 Nov, 1 Dec, 15 Jan – Leave Manager’s ReminderDates/WeeklyEmail settings are used if set). Staff see what leave they have left on their Me page. Care groups: member names are chips instead of links. (Rosters already grey out people on leave in “Add someone”.)
- ✅ 5 Nov 2026 (0.20.0): Smoother typing and saving as you go – searching waits until typing pauses (People, Find members, Advanced search, Care groups, Translations, pick lists), so phones keep up; Settings, Email templates, Leave settings and the Privacy notice save by themselves with a small “Saved” note; the Save buttons that remain (pop-up windows, notes, the robot's sign-in) are pale orange
- ✅ 5 Nov 2026 (0.21.0): **Messages inside the app** (first part of Phase 5's app notifications) – Administrators and Pastors write to the staff, every Church Partner, any care group or a **message group** they set up (Messages → Groups, e.g. Worship team leaders, with leaders); carers write to their own care group (also from the Me page) and group leaders to their own group. Everyone reads theirs under Messages (new on the phone menu, with a count of new messages and a Home to-do); opening the inbox marks them read, on every device, and the sender sees “Read by 5 of 8”. Administrators and Pastors see every message sent and may delete any; senders may delete their own. Database rules check who may send to whom (tested), and the office is told how many in a group can’t sign in yet, to reach them as before.
- ✅ 5 Nov 2026 (0.22.0): Messages – **to one person or people ticked on a checklist**: Administrators and Pastors choose “Chosen people” (type part of a name, Tick all / Untick all) or press “Send a message” on a person’s page; anyone writing to a group can tick “Only some of them” (carers and leaders still reach only people in their own group). Message groups keep their members’ names so leaders who aren’t staff see them.
- ✅ 6 Nov 2026 (0.22.1): Care groups – suggesting groups by where people live reads addresses as people really type them: an estate or suburb written as one word or two (“Amberglen” = “Amber Glen”), an address typed all on one line with no town (“1 A Link Road, Greendale” – the part after the comma counts as the suburb or town), a house number with a letter (“1 A”), and apostrophes or “Saint” in a place name (“St John’s Village” = “Saint Johns”). The Suggest button shows how many Church Partners are in no group; after confirming, the suggestions are made again for those still without one (and **Suggest again** at any time).
- ✅ 6 Nov 2026 (0.23.0): **Senior Pastor (Rector) and Assistant Pastors** – in Settings → What Pastors can do an Administrator chooses the Senior Pastor, then ticks what the Senior Pastor may do and, separately, what the other Pastors may do. The other Pastors are shown as Assistant Pastors. Terminology has two new words (Anglican: Rector and Assistant Minister; Catholic: Parish Priest and Assistant Priest; Presbyterian: Associate Minister; Baptist, Pentecostal and Lutheran: Associate Pastor), which can be renamed. Enforced by the database rules: only an Administrator chooses the Senior Pastor or changes their ticks (church must re-publish the rules).
- ✅ 6 Nov 2026 (0.24.0): Care groups – each group's card (Care groups page and the Me page) shows its carers; the other members are folded under “4 other members”, opened with a tap (and opened by themselves after adding someone).
- ✅ 6 Nov 2026 (0.25.0): Care groups – each card folds its carers (“2 carers · Clare Jacobs, Tim Jacobs”) and its other members (“3 other members”, with the Add someone box) separately, so many groups fit on one page; a new group keeps its Add someone box in view.
- ✅ 6 Nov 2026 (0.26.0): People – someone with no home address whose confirmed spouse or partner has one (or, for a child, their parents or the adults in their household) gets “Probably the same as {name}” on their page, with **Use this address** to copy it in one tap (Administrators and Pastors; written in the history log).
- ✅ 6 Nov 2026 (0.27.0): Advanced search – **Country** can be searched (e.g. Country is empty), and **Change selected…** can now set Country, Province, Town or city and Postcode for many people at once (country and province only for people with a home address; “kzn” → KwaZulu-Natal), with a new tick **Only where it’s empty** that leaves anything already filled in alone (for any field that has a value). **Add a column** works like choosing a filter's field: type part of its name (“marit”) to find it. Searches understand **quotes**: "amber glen" finds that exact phrase only (Advanced search Contains, the People list and every other search box), while amber glen without quotes still finds both words anywhere.
- ✅ 6 Nov 2026 (0.27.1): Fix – saving someone without sign-in who shares an email address with their spouse (e.g. “Use this address”) no longer tries to remove the spouse’s sign-in: an Administrator silently removed it, a Pastor got “You don’t have permission to delete this”. A sign-in is now only removed when it belongs to that person.
- ✅ 7 Nov 2026 (0.28.0): **Shared sign-in** – people who share one email address (often a couple, up to 4) each get their own access, role, rosters and messages. After signing in they choose who is using Church Hub, and can switch with **Switch person**. Edit details shows who shares the sign-in. Only an Administrator can share a Pastor's or Administrator's sign-in. Security rules changed (re-publish).
- ✅ 7 Nov 2026 (0.29.0): **Services with their own look and mood** – Rosters → Services (Administrators and Roster coordinators): a card for each service (8am, 10am, 5pm and Memorial); on each one tap a **look** (Sunrise, Morning, Midday, Sunset, Evening, Candlelight – colour and picture from the time of day; 8am sunrise, 10am morning, 5pm sunset, Memorial candlelight to start with), **mood** words (children and families, hymns, band… or the church's own) and the **departments and positions** it needs (tap to switch on or off; volunteers stay on the team). Look and mood are settings (Administrators); positions also Roster coordinators. Memorial is now a service held now and then (`occasional`; only positions that name it run there). **Me → Serving**: volunteers first choose a service (cards in its colours), then tap a position in its departments; the offer ticks that service. The department "Operational" is now **Service Leading** (Elvanto's "Service" and an existing "Operational" team are used, not doubled).
- ✅ 7 Nov 2026 (0.29.0, same release): **Sunday services and special services** – Rosters → Services lists the Sunday services (8am, 10am, 5pm) and, separately, the special services: Memorial, Christmas, Maundy Thursday, Tenebrae, Good Friday, Easter Sunday and Ascension (each with its next date, its own look – Christmas star, Bread and wine, The cross, Easter morning, Sky – and mood). Administrators add their own (e.g. Palm Sunday) or remove one. A special service only has the departments and positions the Administrator switches on for it; rostering (auto-fill and the grid) follows this, and Settings → A special service picks the matching one (Good Friday → Good Friday). Volunteers first choose **which Sunday service** (8, 10 or 5), with special services below.
- ✅ 8 Nov 2026 (0.30.0): **Works without the internet (view only)** – once someone has opened Church Hub on a phone or computer, it opens there again with no connection and shows what they last saw (their details, rosters, messages, the people they may see). Offline it is **view-only**: a blue notice says so, and trying to change something explains why instead of saving it; when the connection comes back the notice goes and changes can be made again. The copy is wiped when they sign out, when their access is taken away, and before someone else signs in on the same device. Church Hub's own files are kept by `sw.js` (a service worker); the church's information by Firebase's offline copy (`js/store.js`). The demo works offline too. Works in the Android app and home-screen apps.
- ✅ 8 Nov 2026 (0.31.0): **Who can see what → Care groups** – Settings → Who can see what has a new tick for Roster coordinators and Children's ministry: *See the care groups and who is in them*. When ticked, that role gets a read-only Care groups page (every group, its carers and members – names only) and the care group tags on people's profiles. They never see the members' cards (phone, email, address, birthday), which stay with the group. Off by default; Administrators and Pastors always see everything. **Church Partners (Basic access)** get two Care groups choices in the same table: *See everyone in their own care group* (on, as before; switched off they see only their group's carers and themselves – carers still see everyone) and *See which care group each person in the church directory is in* (off to start with; a read-only Care groups page and a tag on the People list, names only, people in the directory only). **Becoming a Church Partner includes Contact details**: when someone is made a Church Partner (Edit details or Change selected…), their agreement to be in the church directory is recorded (“Agreed on becoming a Church Partner”; they can still say no under Consent), and Settings → Who can see what offers **Record that they agreed** for existing Church Partners never asked in Church Hub. Security rules changed (re-publish).
- ✅ 8 Nov 2026: **Database rules published automatically** – `.github/workflows/publish-rules.yml`: when a change to `firestore.rules` is merged into `main` (or on demand), GitHub tests the rules on Google's emulator and, only if they pass, publishes them to Firebase with a service account that may only publish rules (secret `FIREBASE_RULES_KEY`; one-time setup in `docs/RULES-AUTOPUBLISH.md`). Without the secret it still tests and says it didn't publish.
- ✅ 9 Nov 2026: automatic rules publishing set up by the church and working (first run published the rules for 0.31.0); guide updated with the third role (Service Usage Consumer) and the problems met on the way; GitHub's checkout/setup-node/setup-java steps moved to v5.
- ✅ 9 Nov 2026 (0.31.1): **A clear “Saved”** – anything saved as you go (ticks, choices, typing in Settings and other panels) now shows a large green ✓ Saved at the bottom of the screen, and the tick or box just saved glows green for a moment (problems show in red). **Care groups for Church Partners repaired** – filling the church directory with everyone's care group now also works for Ministers (Pastors), skips an unusual record instead of stopping, and runs again by itself whenever an Administrator or Minister opens Church Hub, so a missed update (e.g. one saved before the new rules were published) is put right. **Offline fix** – Church Hub's offline copy of its files could lose a file if the connection dropped while it was being updated; files are now downloaded in full before they replace the old copy, and each file is fetched once at a time.
- ✅ 9 Nov 2026 (0.32.0): **Find a care group or a person** – a search box on the Care groups page (for Administrators, Pastors, and the read-only pages for Roster coordinators, Children's ministry and Church Partners): type part of a group's name or a person's name (“hil tue”, “megan”) to see only that group, or the group that person is in, with them marked. **View as for the Senior Pastor (Rector)** – they can now see Church Hub as a Roster coordinator, Children's ministry, a carer or a Member would, the same way Administrators can (nothing saved meanwhile; “Back to Senior Pastor”, in the church's own word).
- ✅ 9 Nov 2026 (0.32.1): **Home is quick again for Administrators** – with 1,000+ people Home took about 10 seconds: the to-do for today's emails (birthdays, anniversaries) worked out every couple in the church again for each person. Couples and each person's consents are now worked out once and kept until something changes (`memo()` in `js/people/core.js`, keyed on `Store.version()`), and the “… entered twice” check runs just after Home appears (`memoLater`). Measured with 1,200 made-up people: 10 s → 0.04 s. (Jules found the duplicate check; measuring showed the emails to-do was most of it.) Also: the offline copy no longer hangs on a blank page when a file is missing at the moment the connection drops.
- ✅ 9 Nov 2026 (0.33.0): **Care groups for Church Partners, clearer** – Settings → Who can see what: the boxes now say what they cover first – *Their own group: see all its members* (not just the carers) and *All groups: see who is in each group* (names only, on a Care groups page) – stacked under “Care groups”. Church Partners get **Care groups** in the menu when either box is ticked: it shows their own group (as on Me), then all groups if that box is ticked. **Chips on the Me page** – everyone sees the same chips staff see on their profile (Church Partner, staff, their care group); “From Elvanto” is now shown to Administrators only.
- ✅ 9 Nov 2026 (0.34.0): **Who Church Partners can't see in the care groups** – with “All groups” ticked for Church Partners, Settings → Who can see what says how many people in care groups aren't in the church directory (so they're left off the Care groups page), and **Show them** lists them by reason – Contact details not asked yet, said no, no longer active, children – each linked to their profile.
- ✅ 9 Nov 2026 (0.34.1): **Search forgives slips and knows short names** – every search box ignores characters that never appear in names or contact details (“dougl;as” finds Douglas), keeping apostrophes (also the curly one phones type: O’Neill), hyphens and @ . + for emails and phone numbers; and short forms match both ways as whole words (Doug ↔ Douglas, Bill ↔ William, but “robert” doesn't find Robinson). From Jules's PR #98, redone on the latest main with those two fixes.
- ✅ 9 Nov 2026 (0.35.0): **Consent for many people at once** – Advanced search → Change selected… (Administrators) can record a consent answer – Church records, Email, SMS, Contact details, Care group or Photos – for everyone ticked: Yes or No, and how it was given (required). Each person gets a new consent record dated today with who recorded it; their old answer is kept, marked as replaced; children are left out (a parent or guardian answers on the child's page); “Only where it's empty” records it only for people never asked; Undo brings back the answers they had. Each record and the whole change are in the audit log.
- ✅ 9 Nov 2026 (0.36.0): **The church's colours** – Settings → Colours: eight themes (Orange, Blue, Green, Purple, Burgundy, Teal, Gold, Slate grey) or **your own colour**, each shown as a small sample. It colours buttons (also the pale Save buttons), links, the turning cross, the logo, badges and the menu, for everyone. An own colour that's too pale is darkened just enough for white writing on buttons to stay readable. Each device remembers it, so the sign-in screen matches. (`settings.theme`; `THEMES`, `themeOf`, `applyTheme` in `js/app.js`.)
- ✅ 9 Nov 2026 (0.37.0): **Colour picker like Leave Manager's, and Light / Dark** – Settings → Colours is now a live sample (the menu with the logo, a button, a Save button, a link and the turning cross), round colour swatches and “Or pick any colour” with its code. Only the sample changes until **Save the church's colour**. Each person can also choose **Light, Dark or Automatic** (same as their device) in the side menu or All apps; it's remembered on that device. In Dark the church's colour gets a lighter shade for writing, and roster slots, notices and buttons have dark versions (`html[data-mode=dark]` in `css/hub.css`).
- ✅ 9 Nov 2026 (0.37.1): Light / Dark / Automatic is now a quiet drop-down under the language (a half-shaded circle), instead of three buttons.
- ✅ 9 Nov 2026 (0.37.2): **Loading screen** – shows the church's colours and this device's Light/Dark from the very first moment (no flash of orange or of a light page), the turning cross, and the real version number (it said “Version 0.7.0”).
- ✅ 9 Nov 2026 (0.37.3): Settings → Colours: “Or pick any colour” now changes the sample (the turning cross, buttons, logo) straight away, like the round swatches – also on phones, Safari and the Android app, where the colour window only says what was chosen when it closes.
- ✅ 9 Nov 2026 (0.38.0): **Dark mode checked on every page** – fixed: each service's card and mood words (Me → Serving, Rosters → Services), plain boxes such as Terminology's words, and the small add / remove filter buttons (Advanced search). Everything else checked looked right: Care groups, Messages, Privacy and the audit log, Import, Me, Leave (team balances, who's away, settings), Teams, Households, Translations, About, sign-in and pop-up windows.
- ✅ 9 Nov 2026 (0.38.0): **Back to the top** – on any long page (People, Care groups, Settings…), once you've scrolled well down, a small round arrow appears at the bottom right (above the tab bar on phones) that takes you back to the top.
- ✅ 9 Nov 2026: **Offline test reliable** – `tests/app/offline.js` failed now and then on a busy test computer. Two causes: the wait for “every file kept” never waited (Playwright's `waitForFunction` treats an async check as done at once), and the test's web server answered “not found” for `/` (GitHub Pages shows index.html there), so whether index.html was kept depended on timing. Now the check is asked repeatedly, the test server shows a folder's index.html, "no internet" means switching off the test's own web server instead of the browser's pretend-offline switch, and the fixed pauses, retry and separate browser are gone. Passed 10 of 10 runs with the computer fully busy (before: 0 of 10); still fails if sw.js stops working offline. No change to the app. Also tidied `docs/ROADMAP.md` (grouped by who acts on it; removed the first-test-run check and dark mode, both done).
- ✅ 9 Nov 2026 (0.39.0): **Brochures** – About now has (for admins) two fold-out A4 brochures to print or save as PDF: one for our members (how to start, Me, care groups, privacy) and one for other churches (features, moving from Elvanto, the demo). They show the church's name and this Church Hub's address; click the dashed line to type contact details. `brochure.html`; whenever a feature is added the brochures are read again (`reviewed-for`, checked by `tests/versions.test.js`).
- ✅ 9 Nov 2026 (0.40.0): **Life groups** (Bible studies, life groups, midweek meetings) beside care groups – step 1 of `docs/GROUPS-PLAN.md`. Off until switched on in Settings → Apps; care groups can now be switched off on their own too. Administrators and Pastors add groups and leaders; leaders name their own group, add and remove members and message it; people can be in several. Members see their groups (with details of those in the church directory) on the Life groups page and on Me. Stored with the care groups as `type: 'life'`; the database rules let a life group's leaders rename it (re-publish the rules if they don't publish themselves). In all 23 languages; the church can rename "Life group" and "Group leader" under Terminology.
- ✅ Colours: a colour picked with "Or pick any colour" stays exactly as chosen (bright yellow is no longer turned olive) – in the sample straight away and after Save; light colours get dark writing on buttons instead (0.40.1)
- ✅ 9 Nov 2026 (0.41.0): **Settings tidied** – one topic per page, listed down the left in four groups (Church: General, Colours, Terminology · Features: Apps, Services · People and access: Who can see what, What Pastors can do · Communication: Email templates), with a search box (type “birthday”, press Enter). On phones the topics are a strip across the top. General is neat label-and-box rows; Apps are on/off switches. Addresses: `#/settings/<topic>` (`SECTIONS` in `js/mod-settings.js`). Brochures checked – nothing new for members or other churches to know.
- ✅ 9 Nov 2026 (0.41.1): **Brighter preset colours** – the 18 round swatches under Settings → Colours are now the bright colours well-known churches use (Alpha, Life.Church, Elevation, The Creek and others), with Church Hub orange first; white writing on buttons unless that would be hard to read (contrast under 3, as on the built-in orange)
- ✅ 9 Nov 2026 (0.41.2): **Our own colour picker** – "Or pick any colour" no longer opens the phone's rough built-in colour window: a colour area to drag across, a rainbow bar and the colour's code to type, inside Settings → Colours, in light and dark
- ✅ 9 Nov 2026 (0.41.3): **Midweek groups** – what Church Hub calls life groups is now "Midweek group" (a Bible study, life group or Connect Group, as named by the group leader); churches can still rename it under Church Words. Code and data still say `life`
- ✅ 9 Nov 2026 (0.41.4): **Go to the bottom** – a round down-arrow under the “back to the top” one on long pages, shown while there is still a long way to go (`Hub` jumpButtons)
- ✅ 9 Nov 2026 (0.42.0): **Ask in your own words** – at the top of Advanced search, a question in plain English, typed or spoken (microphone: the browser's speech-to-text, or Android's in the app), becomes the filters (people) or a list of services from the roster (dates, which services, gaps, who is serving – also morning and evening on the same day). Shows what it understood and what it didn't (`js/ask.js`)
- ✅ 10 Nov 2026 (0.42.1): **Midweek group** under Church Words now reads *A Bible Study, Life Group or Connect Group (etc) that meets during the week for teaching and fellowship* (all languages)
- ✅ 10 Nov 2026 (0.42.2): **Ask in your own words** understands how names start (*first names beginning with M*, *surname starts with van der*, *whose last name is Pike*); **faster pages** with many people – each record is found from a look-up table instead of searching the whole list, names are sorted with one shared collator, and the duplicate check sorts without searching; **About → Speed check** (Administrators) shows how long opening and each page took, how long the browser was too busy, and how many records were loaded – to find what makes a page slow on a particular computer
- ✅ 10 Nov 2026 (0.42.3): the language list says **UK English** (beside American English)
- ✅ 10 Nov 2026 (0.42.4): Advanced search has **Spouse or partner**, **Care group** and **Midweek group**; **Ask in your own words** understands *partners whose wives' names begin with A*, *married to Megan*, *Church Partners who don't belong to a care group*, *in the Hilton care group*, *not in a Bible study*
- ✅ 10 Nov 2026 (0.42.5): the language list says **US English** (was American English)
- ✅ 10 Nov 2026 (0.42.6): Advanced search has **Spouse or partner's category, gender and age**; Ask understands *men who are Church Partners whose wives are not Church Partners*, *married to an Attender*, *whose husbands are over 70*
- ✅ 10 Nov 2026 (0.43.0): **Ask in your own words with AI** – when switched on (Settings → Apps, after docs/AI-SEARCH-SETUP.md), questions are understood by Google's Gemini through the church's Firebase project; only the question and the search's field names are sent, never records; every filter it returns is checked against what that person may search on; Church Hub's own rules are used if the AI can't be reached (`js/ask-ai.js`)
- ✅ 10 Nov 2026 (0.44.0): **Edit details** greys out boxes that don't apply (wedding anniversary for Single, Engaged, Partner, Divorced; late spouse for Single, Engaged), saying why, and the anniversary sits under marital status; **Who can see what** is three clear panels (what each access can do; a grid of contact details; a grid of care group choices) with “i” explanations; new choice: Basic access sees which **care group someone is in on their page in People**, separately from the Care groups page; consents keep their own names (“Church directory”, no longer shown as “Contact details”) and each has an “i” explaining it
- ✅ 10 Nov 2026 (0.45.0): **Becoming a Church Partner and name badges** – people apply from their own page (the church's questions and declaration, REACH South Africa's or general wording); Administrators and Pastors review, accept (Church Partner from the date approved, Contact details recorded) or reply; printable copy. Name badges: tick when adding a newcomer, then print A4 sheets laid out like the church's Google Doc and mark as printed
- ✅ 10 Nov 2026 (0.45.1): App Check key (reCAPTCHA Enterprise) in js/firebase-config.js, so Ask in your own words can use AI once switched on in Settings → Apps
- ✅ 10 Nov 2026 (0.46.0): **Brochure editor** (About → Brochures, Administrators): the brochures open inside Church Hub; change any heading or text by clicking it, hide or show blocks, choose the colour (Church Hub orange, the church's colour or any) and font, and print or save as PDF. Saved for the church (settings.brochures); an edit only applies while Church Hub's original line is unchanged; typed wording is made safe; panels that no longer fit are flagged (`js/brochure-kit.js`)
- ✅ 10 Nov 2026 (0.47.0): **Name badges from Advanced search** (for those ticked or everyone found, A4 sheets to cut and laminate) and **inviting people to become a Church Partner** – by email from their page or from Advanced search (Bcc for several, Basic access given if they can't sign in yet, the date invited kept), and for the welcome desk a QR code, a poster and a paper form (`js/qr.js`); the link to the form is remembered through signing in
- ✅ 10 Nov 2026 (0.48.0): **Select people on the People list** (Administrators and the Senior Pastor): tick people across several searches, then print their name badges, invite them to apply, or (Administrators) change something for all of them
- ✅ 10 Nov 2026 (0.49.0): **Badge layout** (People → Name badges, Administrators): the church's cut-and-laminate sheet, Avery label sheets, or your own measurements (labels across and down, size, margins, gaps or none, A4 or US Letter, lines or none), with a preview and a test page; on label paper, printing asks which label to start at (`js/badges.js`)
- ✅ 10 Nov 2026 (0.50.0): **Tick boxes on the People list** for Administrators and the Senior Pastor (no Select people button); **Add to name badges** (People list and Advanced search) puts people on the Name badges list to print together; **Coming to the church since** as a detail (from the form, editable, searchable); the form fills the **birthday from a South African ID number** or asks for it; Administrators add **links to constitutions and statements of faith** and an optional **declaration of loyalty**
- ✅ 10 Nov 2026 (0.51.0): **Leadership**: leadership groups (the Council, elders, leaders) with each person's role, title, portfolios and dates; "Served before" keeps the history; groups for everyone or members only (`js/leaders.js`, `js/mod-leaders.js`)
- ✅ 10 Nov 2026 (0.51.0): **Archive**: church records – Council minutes, architectural plans, staff contracts, annual appraisals and the church's own categories – each with a file (up to 15 MB, kept in the database) or a link, and its own "who can see it" (everyone / a leadership group / Administrators and Pastors / Administrators and the Senior Pastor; shown to the person it is about); opening is audit-logged; months with no minutes filed are listed (`js/archive.js`, `js/mod-archive.js`)
- ✅ 10 Nov 2026 (0.51.0): **Library**: the church's books with how and when each was acquired; librarians lend and take back; members see what is in and their own books; overdue books on Home; returned loans removed after a year (`js/library.js`, `js/mod-library.js`)
- ✅ 0.52.0 (11 Nov 2026) Library: DVDs, CDs, audiobooks, magazines and games as well as books; a cover picture for each
  (take a photo or choose one); lending to visitors not on the church's list (name and mobile number); a mobile number for
  every loan (asked for when a member's record has none; cleared on return); one or two librarians, chosen by an
  Administrator or the Senior Pastor; the library's policy, pasted in or attached, for everyone to read.
- ✅ Library 0.53: import a list of items from a CSV spreadsheet (duplicates and rows without a title left out); mark a
  borrowed item as lost; take an item out of the library with a reason (kept for the reports, can be put back); reports of what
  was lent, returned, lost, acquired and taken out between two dates, downloadable as CSV; the policy shown as a formatted page.
- ✅ 0.54.0 (11 Nov 2026) Groups, Leadership and Library:
  - Midweek groups fold like care groups (only the leaders' names show until opened); children can be in a midweek group
    (a youth group); typing part of a name keeps its list of matches after someone is added, so several people are added
    from the same list (care groups, midweek groups, leadership groups, message groups; carers' and leaders' own Add dialogs)
  - Me and a person's page: midweek group and leadership chips that open those pages; borrowed library items as a chip on Me
  - Leadership: terms of office per group (years in a term, terms in a row, the break after); a bar showing which term each
    leader is in and how far through; four months before a term ends, Administrators and the Senior Pastor (Rector) see it
    on their To do list, with whether the person may stand again; "Start their next term"; more than one role each;
    co-opted members; leadership groups fold to their office-bearers; members can message their whole leadership group
  - Messages: the sender sees who has read a message and who hasn't (Sent → Read by …)
  - Library: three weeks after borrowing, a friendly reminder naming the item and how many days they have had it – on the
    borrower's To do list and Library page, and sent by a librarian by WhatsApp or SMS (again a week later if still out)
  - "Care Group" and "Midweek Group" written with capitals everywhere, as names (also a church's own word for them from
    Terminology, e.g. "Home Group"); the consent is still stored as "Care group"
  - Library policy editor: a "How to format it" legend and a preview; everyone sees Read the policy
  - Formatting buttons above the Library policy box (bold, italic, heading, lists); Archive notes formatted the same way
    (headings, lists, bold, italic, underline: `js/richtext.js`, tested)
- ✅ 0.55.0 (11 Nov 2026) **Groups**: one menu entry for Care Groups, Midweek Groups and Leadership, as tabs, opening on
  "My groups" (the groups the person is in, with their leadership groups); each kind still switched on or off on its own and
  with its own privacy rules; the church can rename the menu entry (Terminology: "Groups"). Message groups stay under Messages.
- ✅ 0.55.1 (11 Nov 2026) **Choosing librarians**: people who can't sign in yet (most people brought in from Elvanto) were left out of the list, so they couldn't be chosen. Now any adult can be chosen; someone who can't sign in yet gets Basic access at the same time (or the dialog says to add their email address first).
- ✅ 0.56.0 (11 Nov 2026) **Change selected…** takes several changes at once, and can change **App access**; **Groups** button on a person's page (Care Groups and Midweek Groups); Settings → **Membership application** (declaration, documents to read, loyalty); the church's word for a **service** (Church Services / Meetings / Gatherings); **Midweek Groups**: when and where they meet (day, time, how often; at the host's home or a place with a map link), co-leaders and host
- ✅ 0.57.0 (12 Nov 2026) **Library**: librarians can add a note about damage or other condition when returning a loan; everyone can filter the catalogue by media type, title, author or subject and sort by each field. Library Reports now says “Show library activity between two dates”.
- ✅ 0.58.1 (12 Nov 2026) **Library**: catalogue tabs for All, On Loan, Available, Lost, Being Repaired and Permanently Removed; librarians can mark an item as being repaired and return it to the shelf. Reports have clickable activity tabs, search and print, alongside the spreadsheet download.
- ✅ 0.58.1 (12 Nov 2026) **Leadership**: membership is labelled “Type of Membership”, with Elected Member, Co-opted Member and Other choices; Other requires a description.
- ✅ 0.59.0 (12 Nov 2026) **Library**: Administrators and librarians can permanently purge individual borrowed or returned activity records and removed books after confirmation. A removed book's linked loan records are purged too, active loan counts stay correct, and every purge is recorded in the immutable audit log.
- ✅ 13 Nov 2026 (0.60.0): **Brochures for every church** – removed the originating church's name from the printable brochures and added generic South African attribution. Administrators can edit brochure wording separately for each language; changes are kept in an Administrator-only database document instead of general settings. Existing brochure edits are migrated automatically when an Administrator opens the app. Brochures also highlight Library record purging, alongside leadership, archiving, and other current features.
- ✅ 13 Nov 2026 (0.61.0): **Library covers and librarians** – Administrators and librarians can find covers for selected, all
  or uncovered books, preview results, and save individual or successful batch matches. Missing books and API limits are
  handled without losing earlier matches. Administrators and the Senior Pastor can appoint any number of librarians, all
  with full library permissions. Administrators are reminded every 180 days to review the list and can confirm it or edit
  appointments. Added translations, Library help and privacy/architecture notes.
- ✅ 13 Nov 2026 (0.62.0): **Archive previews** – Administrators can preview archive files, and Council members can preview
  records they may already see. PDFs, images and text/Markdown/CSV display inline; other formats offer a clear download
  option. A separate Firestore copy and role rules protect direct preview requests without changing normal downloads;
  restricted previews are audit-logged.
- ✅ 13 Nov 2026 (0.63.0): **Archives in Library** – Archives are a Library tab with a locked restricted notice for Librarians
  and members; only Administrators and Council members can view, search, download or manage Archive content, enforced by
  Firestore rules and Store APIs. Administrators and Council members can open the storage-location note; its placeholder
  text is localized for the church to update.
- ✅ 13 Nov 2026 (0.64.0): **Leadership, groups and membership documents** – Administrators can set consecutive-term limits;
  leaders see their term progress and eligibility, with a 120-day reminder for Administrators and the Rector. The Staff
  group follows staff status, and Administrators can manage additional groups and visibility. Archive documents can be
  selected for the membership application without exposing Archive notes or access settings; supported Google documents
  open in an in-app preview. Firestore rules and tests protect published documents and current-version file parts.
- ✅ 13 Nov 2026 (0.65.0): **Library requests and catalogue tools** – members request available items with a reserved copy
  while a librarian verifies; the existing Home reminder and Library badge alert librarians. Librarians can approve or
  reject requests, review likely duplicates, standardize catalogue details or dismiss false matches, and search for
  borrowers. Members can open a Google Books preview and search links; librarians can drop a small cover image or select
  missing covers for online lookup. The policy is now a compact header action. Me calls out borrowed items and displays a
  Librarian chip; Groups tabs now put Staff Group before Leadership. Database rules, language keys, help, architecture and
  privacy notes were updated.
- ✅ 13 Nov 2026 (0.66.0): Librarians and Administrators can filter checked-out items by borrower name.
- ✅ 13 Nov 2026 (0.67.0): Librarians and Administrators can filter and sort books in each library status by title, author, subject, borrower and date borrowed. Borrower and loan-date filters stay hidden from other members.
- ✅ 14 Nov 2026 (0.68.0): Settings now offers tradition-aware ministry-role suggestions and Administrator titles (Church Administrator, Operations Manager, Secretary, or custom wording). Serving choices are weekly, monthly or emergency-only, with away-day guidance and emergency-only volunteers excluded from regular fills. Every signed-in person can message the Office; Administrators and Pastors receive and can reply, and senders see sent, delivered and read ticks. The Firestore rules, translations, tests, brochure and privacy/architecture notes were updated.
- ✅ 14 Nov 2026 (0.69.0): **review of the week's work** –
  - Security (Archive): Council members can now only change, delete or attach files to records they may see, and can't
    open up a private record (e.g. a staff contract) to themselves; a preview must be an exact copy of the record's file;
    archive access is tied to real membership of the Council (a Pastor can't add themself to the hidden list); a Senior
    Pastor on the Council sees private records, as documented. **Re-publish the rules.**
  - Library: one main button and a **More** menu (import, reports, duplicates, covers, librarians, policy); Library /
    Archives as the usual tabs; one toolbar for status, search and sorting (search folded away until used); empty sections
    and empty status tabs hidden; a single "nothing yet" message; occasional row actions (repair, take out, lost, purge)
    in a small ⋯ menu; sentence-case wording.
  - Everywhere: no blue frame round the page after moving between screens; the initials picture stays round; "View as…"
    moved into the side menu; the appearance choice no longer cut off; Groups tabs under the title like every page;
    Church groups heading once; Staff Group page without a box in a box.
  - Settings: "Ministry roles the church uses" moved from What Pastors can do to Terminology (it is wording, not access).
  - The notebook sync workflow uses a fixed version of its tool.
- ✅ 14 Nov 2026 (0.69.1): Library **View / Info** works again – Google Books is often "busy" (apps without their own key
  share a small daily allowance), so book details and covers now come from **Open Library** (free, no key) when Google
  can't help; the search no longer runs title and author together into one phrase, and a wrong author in the catalogue no
  longer hides a book with the right title. Rows: "Added" before the date, no "Book" label on every book (only DVDs etc.),
  and tick boxes only while choosing books for covers (More → Select books missing covers, with Cancel).

- ✅ Messages look like a chat app (0.70.0): messages as bubbles (yours on the right in green), one grey tick when sent, two grey ticks when it has reached everyone, two blue ticks when everyone has read it; new messages marked with a green bar and a "{n} unread messages" note; "Read by" lists Read, Delivered and Not delivered yet; Delete moved into the ⋯ menu.
- ✅ Languages (0.71.0): Sesotho is now kept up to date with every change, like English, Afrikaans, isiZulu and isiXhosa (its missing texts translated). The other 18 languages are translated in one go before release (`docs/RELEASE.md`); the language test counts what is waiting instead of failing (`RELEASE=1` makes it strict), the English stand-ins copied into those files were taken out, and Home reminds Administrators every 3 days how many texts are waiting.
- ✅ Sesotho spelling (0.72.0): choosing Sesotho asks which spelling: South Africa (dintlha) or Lesotho (lintlha); the Lesotho spelling is worked out from the South African file (`js/sesotho.js`), so it is always as complete.
- ✅ Brochures for every nation (0.72.1): the cover for other churches now says "Every church, however small, deserves great church software." instead of "Made in South Africa"; new "Every nation, people and language" block (20+ languages, set up for each country and church tradition); privacy wording follows the church's own country's law (not only POPIA); librarian detail and long lists trimmed so the panels breathe.
- ✅ 15 Nov 2026 (0.73.0): Library – **one list, nothing twice**: a lent item shows who has it, the dates and Returned on its
  own row (the separate "On loan" list that repeated it is gone; "Recently returned" sits under the list). Librarians always
  see every status tab: All, Available, On loan, Overdue, Damaged, Being repaired, Withdrawn, Lost, Removed. New: Mark as
  damaged (off the shelf until sent for repair or put back; also "It came back damaged" when marking a return), Withdraw
  from circulation (taken out, can be put back). "All" now means what is still in the library; items taken out are under
  their own tabs. No change to the database rules (damaged items use the existing "being repaired" lock).
- ✅ Replies and Church Partner access (0.74.0): **Reply** on any message sends a private reply to its sender (Office staff
  reply to Office messages the same way). Basic access now comes in two kinds, automatically from the person's category:
  **Church Partner access** (Church Partners and staff: the directory, replies – as before) and **attendees** (everyone
  else), who by default see only Church Partners' names, and write only to the Office, the ministers and their Midweek
  Group leaders (and reply to a minister). **Settings → Attendees** (Administrators and the Senior Pastor) changes what
  attendees may do: names, the directory, writing, replying. Me invites people who aren't Church Partners yet to become
  one, with **what it takes** – written, linked (Google Doc) or attached (Word/PDF) under Settings → Membership
  application by Administrators and the Rector. "View as" → Attendee. New database rules: **re-publish the rules.**
- ✅ What’s new and Did you know? (0.75.0): Home shows a card with the latest changes (a sentence each, for two weeks) and one tip each time someone signs in – Another tip, All tips, Got it (hides it until the next sign-in). Tips and news are chosen for each person’s access: Basic access hears that there is a library and that Me shows what they borrowed; librarians how to lend, repair or take out an item; carers, roster coordinators, Children’s ministry, Pastors, the Senior Pastor and Administrators their own. Only parts that are switched on and open to them. Rules in `js/tips.js` (tested); words in `js/i18n/tips.js` and Sesotho.
- ✅ Consent warnings (0.76.0): unticking a consent that was given shows, in orange under it, what that means (for example that without Email or SMS a roster reminder might be missed); Save then explains it once more and only withdraws on a second press ("Withdraw and save"). Me has a fourth tab, Consent, next to My details, showing each choice and, for a "No", what it means.
- ✅ Chinese and Japanese (0.77.0): Chinese (Simplified and Traditional) and Japanese added to the languages, under a new Asia heading; the main screens (menus, Home, sign-in, Me, tips) translated, the rest in the release step with the other extra languages (now 21). Traditional Chinese is converted from Simplified with OpenCC. Jules’s November drafts were not reused: too many mistranslations. Home’s “not every language is up to date” count now follows Japanese, the language furthest behind.
- ✅ Sign-in on a phone (0.77.1): the language box no longer covers the church's name – on narrow screens it sits on its own line under it.
- ✅ What the ticks mean (0.78.0): Messages → Sent has a folded “What the signs mean” explaining sent, delivered, read by some (new: the first tick turns blue once a group message has reached everyone and some have read it) and read. Each person can show them as ticks (WhatsApp), envelopes (post), circles that fill up (DingTalk, China) or words (LINE and QQ); the default follows the church’s country.
- ✅ Care Group tick boxes on a phone (0.78.1): in Edit details each Care Group has its own line, and the “leads it” tick sits under it, shown only once that group is ticked (it used to sit greyed out on top of long group names).
- ✅ Phone layout check (0.78.2): a sweep of every page and form at phone width found and fixed squeezed or cut-off layouts – Translations, Rosters → Serving together, Leave approvals (dashboard, Approvals, a staff member's page), Church office notes heading, Settings → AI model, Settings → Terminology (now one card per word on a phone, `table.stack-phone`), School terms dates – and "More"/⋯ menus that opened past the screen edge are now moved back in (`js/app.js`). New `.item.wrap-phone`: a row's buttons drop below its text on a phone.
- ✅ Library covers found online (0.79.0): Google Books' pictures can't be copied by a web page (Google sends no
  cross-site permission), so most covers it found were never saved ("No matching cover found"). Covers now also come
  from Open Library – its cover for the ISBN first, then Google's matches, then Open Library's own search – and its blank
  1-pixel "no cover" picture is skipped. New: **Find a cover online** in each item's ⋯ menu (just that item) and in the
  Add / Edit form (searches from what is typed; up to four covers to tap), and **Show another cover** in the
  Find book covers window when the first one is wrong. Batches (missing, selected, all) work as before.
- ✅ Dates can be typed (0.78.4): every date box has a box to type in ("12 Aug 1990", "12/08/1990", "1990-08-12"; day first; English, Afrikaans and the language in use) next to a small calendar button, so a birthday in 1990 no longer means tapping back month by month (`js/datebox.js`, `tests/datebox.test.js`).
- ✅ Smaller updates (0.79.1): each file's `?v=` in `index.html` is now a fingerprint of its contents (`node tools/stamp-files.js`;
  language files' in `js/file-versions.js`), so a new version downloads only the files that changed instead of all of them
  (about 650 KB each release before). Find book covers: the window keeps its place while the search runs instead of jumping
  back to the top after every book.
- ✅ 0.80.0 (15 Nov 2026): roster requests in Messages – people put on the roster get a message and accept or say they can't
  make it from it; the roster team (Administrators, Roster coordinators and people chosen under Settings → Church Services,
  such as the church secretary) gets a message when someone can't; Rosters → More → Remind those who haven't replied
- ✅ 0.80.1 (15 Nov 2026): Messages – tapping the ticks (or envelope, circle or words) by your message's time shows a short
  note saying what they mean; it goes away by itself after 4 seconds
- ✅ 0.80.2 (15 Nov 2026): Messages → Sent: the delivery signs are chosen from four picture cards (ticks, envelopes, circles, words), each showing its
  steps and which apps and countries use it
- ✅ Gentle movement (0.80.3): pages fade in, pop-up windows rise in and fade away, folded sections slide open, new messages glide into the conversation, and a green tick draws itself when something is saved; none of it for people whose phone asks for less motion (`css/hub.css` "Gentle movement", `js/app.js`)
- ✅ 0.80.4 (16 Nov 2026): Messages → Write: the To dropdown is replaced by “Who is this for?” – big cards for the Office, chosen
  people, the staff and the Church Partners, coloured lists of groups, each with how many people it reaches, and a search;
  for Administrators and Pastors the Sent tab is now called All messages
- ✅ 0.81.0 (16 Nov 2026): Holy Communion – each service's communion Sundays (Rosters → Services: every week, 1st–5th, last
  or never; Howick: 10am 1st Sunday, 8am and 5pm 2nd), communion positions only rostered when there is communion, and a
  one-off change for any date from the chip under it in the roster
- ✅ 0.82.0 (16 Nov 2026): Subscription – "buy us a coffee": one coffee a month or ten a year (five coffees to choose
  from, priced in rand, US or Australian dollars), gift coffees in one tap, paying for another church, bank transfer to
  Church Hub's Capitec account with each church's own reference, reminders on the Administrator's Home when payment is
  due, payment holidays (three a year monthly, one a year yearly), and praying instead: the prayer circle, a church's
  prayer card (photo, two prayer points, "keep us hidden" for countries where Christians face danger) and the church to
  pray for each month on everyone's Home page
- ✅ 0.83.0 (16 Nov 2026): Subscription – one cup where you live, in the church's own money (every country has its
  currency; India and Cambodia added), three kinds of cup with an honest-amount nudge, "Who are you paying for?",
  "Churches to pray for" and "Prayer card for your church", "Take a photo" for the prayer card; the public website's
  price section does the same, and shows a second phone: a Western parish's Sunday roster
- ✅ Website (16 Nov 2026): a desktop computer showing Church Hub's Home with its side menu, to show it runs in any browser, not only on a phone
- ✅ 0.83.1 (16 Nov 2026): Messages tabs in a logical order – Inbox, Write, Sent, then (Administrators and Pastors) All messages
  and Message groups; Sent is back for everyone and shows only your own messages; "Groups" renamed Message groups
- ✅ 0.83.2 (16 Nov 2026): About → More has a link to Church Hub’s public website (site/, on GitHub Pages) for everyone
- ✅ 17 Nov 2026: **Setup tool** (`site/setup.html`, `site/setup-kit.js`) – sets up Church Hub at a new church one friendly step at a
  time: the church's own Google account (and keeping it safe), its own copy of the website on GitHub, its Firebase database in
  the place nearest its country, the first Administrator, the security rules (copied with one click), connecting the two (the
  settings file made for them), the first sign-in, then privacy, wording, services, access, staff and a second owner. Every
  instruction is filled in with the church's own names and addresses, with copy buttons and links to the exact pages. It
  remembers where you were (several churches, a progress file to carry on elsewhere), and afterwards keeps a list of
  everything else the church can switch on (with "New" for features added since they last looked, and monthly reminders to
  get the latest Church Hub), plus what is coming. `tests/setup-kit.test.js` fails if a part of the app is missing from it;
  `tests/versions.test.js` asks for it to be re-read with each feature release. Linked from the public website and FIREBASE-SETUP.md.
- ✅ 0.83.4 (17 Nov 2026): the setup tool in the documentation – README, ARCHITECTURE ("Setup tool"), help (Settings: setting up
  another church; what else a church can switch on), the website's "Do we need someone technical?", the brochure for other
  churches, the release checklist, and planned tasks 021 and 050
- ✅ 0.83.5 (17 Nov 2026): a person who has died has grey information blocks on their page (light and dark), so it is clear at a glance
- ✅ 0.84.0 (17 Nov 2026): **Maiden name** – Edit details has a Maiden name box for women who are or were married (it appears
  when Gender is Female or not recorded and Marital status is Married, Separated, Divorced or Widowed); shown under Contact
  and details, found by People's search box and Advanced search, brought across from Elvanto's Maiden Name column; kept in
  `details/` like the middle name (no rules change). **A person's page uses the space better**: its blocks sit in up to three columns that each stack
  their own blocks – details and household; Church office notes, volunteering and the other notes; then Consent – so short
  blocks no longer leave gaps beside the long Consent block, and the office notes (and adding one) are near the top. Two
  columns on smaller screens (Consent across the bottom), one on a phone. Help, POPIA and What's new updated.
- ✅ 0.84.1 (17 Nov 2026): About → Released shows the time as well as the day and date (`time` in `js/version.js`, South African
  time, shown in each person's own time zone); `tests/versions.test.js` checks every release has one
- ✅ 0.85.0 (17 Nov 2026): **Spouse or partner, chosen by hand** – Edit details (Administrators and Pastors) has a Spouse or partner
  box: choose the other person, even in another household, and both records are linked (`spouseId` in `details/`); the couple
  is certain wherever they live and comes before the household's guesses (`Households.couples`, `explicit`), Not a couple
  unlinks them, and the late-spouse suggestions use it. Greyed out for Single, Engaged, Divorced and Widowed. Help, What's new.
- ✅ 0.87.4 (17 Nov 2026): **Library** opens on Items I have borrowed for someone who has something out; the catalogue is
  the Library tab (`#/library/all`), where librarians' Home tasks and the library tips now go.
- ✅ 0.87.3 (17 Nov 2026): **Field icons** – a small, quiet icon in front of each field's label on a person's page and in Edit
  details (`F()` in `js/people/core.js`, `.f-lab`/`.f-ico` in `css/hub.css`; key dates get a calendar; hidden when printing).
- ✅ 0.87.2 (17 Nov 2026): **Library**: Items I have borrowed is a tab of its own (`#/library/borrowed`), first, before Library and
  Archives (only when the person has borrowed something); Home's reminders and the Me page chip open it. The help pages
  (getting started, People), the brochure and the planning notes describe signing in with a number and PIN.
- ✅ 0.87.0 (17 Nov 2026): **Sign-in codes and PINs** for members with no email (tasks 015–016 for the one-church setup): an
  Administrator gives a code from the person's page (QR, ABCD-EFGH, WhatsApp, Print; once, 14 days, Member access only); the
  member taps the link or **I have a sign-in code** → "Is this you?" → **Choose your PIN** with their cellphone number, or a
  church number if they have no number of their own → from then on **Sign in with my number** (number and PIN) on any phone.
  A new code switches off an old PIN (a forgotten PIN or a new number); **Cellphone sign-in** on the person's page with
  Switch off; No access, left or a death switch it off. Rules (`invites`, `pinLogins`, `pinUser()`, `pinClaim()` in `roles`), the fake,
  rules tests and browser tests; POPIA, ARCHITECTURE, FIREBASE-SETUP steps 3–4, the setup tool, the website and the brochures.
- ✅ 0.87.1 (17 Nov 2026): About → Released shows the release time in South African time with "SAST" for everyone, wherever they are; `node tools/stamp-files.js` now writes the release date and time into `js/version.js` itself (the time had been typed by hand and was wrong)
- ✅ Every dropdown is searchable (0.85.1, 17 Nov 2026): `findables()` in `js/app.js` turns each `<select>` into one box – tap
  it and the whole list opens; type and it narrows as you type (part of a name, short names too); arrow keys and Enter, or a
  tap, choose. Replaces the separate "type to narrow" box above long lists. The select stays underneath and keeps the value;
  values set by the page, changed options, disabled and hidden follow. `data-plain` opts out. What's new.
- ✅ 0.86.0 (17 Nov 2026): **Edit details saves as you go** – like the panels elsewhere in Church Hub: a choice or tick saves at
  once, typing saves when it pauses, with the small "Saved" note (or a red note saying what still needs fixing). The window has
  one "Done" button (it checks everything and closes); Save and Cancel are gone. Closing the window saves anything still
  waiting; if that can't be saved, it stays open once to show why, and closing again lets the change go. One "Updated details"
  line in the audit log per time the window is opened, and nothing is written when nothing changed. Adding a new person still
  waits for "Add person", so half-typed newcomers aren't created. The engine in `js/app.js` now works in a pop-up whose form has
  `data-autoscope`. What's new.
- ✅ 17 Nov 2026 (0.87.5): Advanced search filters redesigned – the green + and red − on every row (too much like Elvanto) replaced by a quiet × that turns soft red only when touched, and one dashed "Add a filter" button under the last filter; on phones each filter is a soft card (field and × on top, then how to compare, then the value); new filters slide in, removed ones fold away (none of that when the phone asks for less movement)
- ✅ 18 Nov 2026 (0.87.6): the app icon (phone home screen, computer desktop, browser tab, Android app) now has the same thin, round-ended cross as the mark inside the app, in the same proportions
- ✅ 18 Nov 2026 (0.88.0): Rosters – **Change person** in the box that opens when you tap a name: pick someone else and the turn is swapped in one go; the new person is asked, and the first person's "You're on the roster" message is taken back if they haven't opened it (or they get a short "No longer needed" note, roster message `off`). **Take off the roster** does the same for the person taken off. The roster also leaves out departments and positions that aren't at any of the services in view (Creche at 8:00, communion roles without communion), unless someone is already rostered there
- ✅ 18 Nov 2026 (0.88.1): Rosters → Teams – on phones a position's name no longer runs into how many are needed and which services it's at; the details sit underneath the name, with Add beside them. On phones the round up/down arrows now show only while scrolling and fade 2 seconds after you stop, so they no longer cover buttons near the bottom right
- ✅ 18 Nov 2026 (0.89.0): Advanced search – drag a column to put it where you want it (finger or mouse; the arrow keys for the keyboard), in place of the ‹ › arrows on every column
- ✅ 18 Nov 2026 (0.89.0): Departments – Verger (Service Leading, also known as Operational), Ushers (Hospitality), Recorded Music (Music); Servers (Collection & Communion) split into Collection Servers (every 10am, communion or not) and Communion Servers (communion only). Rosters → Teams offers them with Add them; the old combined position is renamed Communion Servers, keeping its people and turns. "Verger" is in Settings → Terminology (Catholic set: Sacristan)
- ✅ 18 Nov 2026: GitHub checks faster – the tests run once per pull request (not twice: on the branch push and on the pull request) and on main after each merge; the test browser and the Firestore emulator are cached between runs
- ✅ 18 Nov 2026 (0.90.0): A partnership application also sends a message to the Office (Administrators and Pastors, in Messages, with a button to the applications) – an office message with `about: 'partnerApp'`, allowed even for attendees who may not write to the Office (rules, fake-firebase and rules test updated). Services are listed in time order on the same day (8am, 10am, 5pm: `Serving.byWhen`) and carry their service's colours (`Serving.themeOfService`) on the roster's column heads, My serving, Me → Serving and Settings → Church Services. Rosters → Teams: − and + set how many people a position needs (1–20), e.g. 2 on the sound desk
- ✅ 18 Nov 2026 (0.91.0): Rosters – **Go to a date** beside Earlier / Later (the date box: type a date or tap its calendar) jumps to the services from that day; at the end of the list the roster shows the last few services, not one column on its own. Roster messages on a phone: the date has a full line, the buttons go underneath. Website: **Use only what you need** (Church Hub in parts, switched on in Settings → Apps), membership applications and changing a name on the roster; brochure (for other churches): "switch on only the parts you need"; README explains the modules. **Conference presentation** in `docs/presentation/` (17 slides with speaker notes, screenshots and three GIF clips from the demo; `capture.py` and `build.js` make it again)
- ✅ 18 Nov 2026 (0.92.0): Archives – folders inside folders (categories became the top folders); a folder can sort itself into Year → Month folders by each document's date (Council meetings does from the start); breadcrumbs; search looks through every folder and shows where each document is; before saving, a summary of what Church Hub is about to do (switch off per device under More) and questions about a date that looks wrong (future, a typing slip, a month the title or file name speaks of, another date for the same meeting, the same title again) with one tap to use the suggested date; website, brochure, presentation and setup tool updated
- ✅ 18 Nov 2026: Presentation – the last slide names the Church Hub version it describes; GitHub puts each new .pptx into the Google Slides copy after a merge (`.github/workflows/publish-slides.yml`, `tools/publish-slides.mjs`, setup in `docs/SLIDES-AUTOPUBLISH.md`); rule in CLAUDE.md to rebuild the slides whenever what they say changes
- ✅ 18 Nov 2026 (0.92.1): Presentation and brochure – no more mention of Elvanto ("another church management system"); slide 2 "Essential Church Records: Securely Stored and Legally Compliant"; slide 5 suburban and city churches; slide 6 Home with its icon and bullets; the Ask clip holds the whole sentence; new screenshots. Advanced search no longer says "as in Elvanto"
- ✅ 18 Nov 2026: Google Slides robot set up (Google Cloud project "Church Hub slides"; secrets SLIDES_ROBOT_KEY and SLIDES_FILE_ID) – the first run updated the shared Google Slides presentation
- ✅ 18 Nov 2026 (0.92.2): "For every church, in every nation, in (nearly) every language" on the website (languages heading) and the Subscription page (five languages), to match the title slide
- ✅ 18 Nov 2026 (0.93.0): The Rector (Senior Pastor) opens the brochures under About to print or save as PDF (reads `brochures/church`; editing stays with Administrators); brochure for other churches: "Every church, in every nation, in (nearly) every language"
- ✅ 18 Nov 2026 (0.93.1): Archives (and a What's new line) – a document you have just added shows in its folder straight away, even if the list from the database hasn't brought it back yet; the Senior Pastor's list now brings back staff contracts and appraisals (private records); a Council member who chooses a "Who can see it" they don't belong to is told before saving (the database would refuse it, and the record seemed to disappear)
- ✅ 0.94.0 Rosters: six services side by side with a slider above (and a clear scroll bar below); an eye on each service hides it for now ("Hidden for now" brings it back); departments in the order of a service (Welcome, Service Leading, Extra Slot, Hospitality, Music, Creche, Children, Teens, Technical) and moved with ↑ ↓ on Teams; ⋯ → Join with another team folds a second Music/Worship department into the first (positions, people and turns move across, nobody twice); an empty team can be deleted
- ✅ 0.94.1 Rosters: choose 2–8 services side by side (the slider only shows when the roster is wider than the screen); the top row (date, time, communion) stays in view while scrolling down
- ✅ 0.95.0 (19 Nov 2026): the prayer circle for every church. Home shows a new church's prayer card every week (the same for
  everyone at a church that week; each church goes through all the others in its own shuffled order with no repeats until it
  has seen them all – `Coffee.cardForWeek`). Every church keeps a prayer card and looks at it once a month: Home asks its
  Administrators ("Update the prayer card" / "Keep it as it is"). Only an Administrator of a paying church can turn the weekly
  card off; a church that prays instead of paying keeps it on. Wording moved from monthly to weekly in the app, the website
  (prayer circle reworded, new question "Do we have to take part?"), the brochure, the setup tool and the presentation.
- ✅ 19 Nov 2026 (0.95.1): **Midweek Groups** – every group leader can add anyone to their group, attendees and people not in the church directory too, seeing only each adult's name (`pickNames`, read by Administrators, Pastors and Midweek Group leaders listed in `lifeLeaders/all`; both kept by Administrators' and Pastors' Church Hub; database rules changed and tested)
- ✅ 19 Nov 2026 (0.95.2): Rosters open with as many services as fit the screen; − / + from 1 to 16 side by side; 1 month and 1 quarter (slide across) – replaces the 2–8 buttons
- ✅ 19 Nov 2026 (0.95.3): The website's footer and both brochures (foot of the outside sheet's left panel) show "Updated 19 Nov 2026, 09:41 SAST" in very pale grey – the newest GitHub commit that changed that file, read when the page opens (a church's own copy on GitHub reads its own repository); empty without a connection. Presentation: the version line on the last slide is smaller and dark grey, so it is discreet
- ✅ 19 Nov 2026: Help pages caught up – Rosters (Go to a date, services side by side, hide with the eye, Change person, reminders, Holy Communion, team order, joining and deleting teams), Midweek Groups (leaders add anyone, names only), Archive (Year → Month folders, date checks, search across folders), Me (Consent tab, becoming a Church Partner, borrowed items), Messages (replies, who may write, attendees, ticks, roster messages)
- ✅ 19 Nov 2026 (0.95.4): Task 010 – choosing the church (`js/church.js`): a church's own link `…/?c=<projectId>` opens that church's saved connection and the device remembers it; with nothing saved, the built-in connection (Christ Church Howick) works exactly as before. Groundwork for one address serving every church; nothing visible yet
- ✅ 19 Nov 2026 (0.96.0): Renamed to **Church & Trellis** (addresses: churchandtrellis.com) – every screen, all languages, the website, brochures, setup tool, presentation, guides and the Android app's name (shown after its next build). Kept on purpose: the repository name, the storage labels on each device (renaming them would sign everyone out), the robot's "Church Hub <id>" notes in Elvanto (so existing entries still match), and this changelog's history
- ✅ 19 Nov 2026 (0.96.1): The name is shown as Church **&** Trellis with its "&" in the brand orange – the app's header and sign-in screens, the website, the setup tool, the brochure covers (dark "&" on the orange cover) and the presentation
- ✅ 19 Nov 2026: The presentation file is now `church-and-trellis-presentation.pptx`; the Slides robot also names the Google Slides copy "Church & Trellis – conference presentation" when it next updates it
- ✅ 19 Nov 2026 (0.96.2): Groundwork for the Community board, Marketplace and Subscription work: who can see what is kept in one place (`js/access.js`) instead of being copied in app.js, messages.js, Settings, People and Store, with a test that keeps `firestore.rules` and the browser test's copy in step; new parts plug in with their own permissions and jobs (keepers: the Administrators, Pastors and church secretary until chosen). Placeholders for the Community board and Marketplace (modules, permissions, closed rules sections, words) and a closed rules section for Subscription records. Nothing changes for anyone yet
- ✅ 19 Nov 2026 (0.97.0): **Community board** and **Marketplace**, sharing one way of being looked after – the keepers
  (`js/community.js`, `js/community-ui.js`, `js/mod-board.js`, `js/mod-market.js`, `css/community.css`). The board is a real
  corkboard of tilted sticky notes (I need help, I can offer, Notice, Thank you) with pins and tape, a live preview while you
  write, a note that flies onto the board and a "Sorted ✓" stamp; the latest 3 notices on Home and Me. The Marketplace has photo
  cards (For sale, Wanted, Free), up to 3 photos made small on the phone, condition, category, area (suburb only), search, the
  church's own rules, safety tips, a lower price that stays up. Everything waits for a keeper (Approve / Ask for a change /
  Decline with a kind note sent in Messages); first keepers: Administrators, Pastors and the church secretary, chosen under
  More → Keepers…; *I can help* / *I'm interested* is a private message; Report; renew twice; deleted 30 days after it ends.
  Church Partners and staff only, never attendees. New rules: board, market, marketPhotos, and messages about them. Five languages.
- ✅ 19 Nov 2026 (0.98.0): **Subscription to the owner's spec, paid through PayFast.** No bank or account details anywhere in the
  app, website or repository any more (the Capitec details were taken out of `js/coffee.js`, the tests, `site/index.html` and
  `docs/PRICES.md`). Pay opens Church & Trellis's payment doorway (`tools/payfast-door.mjs`, a Cloudflare Worker that keeps
  PayFast's merchant details secret, changes other currencies into rand and signs the payment) and PayFast (card, Instant EFT,
  SnapScan); back from PayFast, "Thank you!" records the payment; a payment that never came back is asked about. Until the owner
  opens PayFast (`docs/PAYFAST-SETUP.md`), Pay says "opens very soon". Payment holidays: monthly churches skip a coffee whenever
  they need, as often as they need, no questions asked (the "why" box is gone); yearly churches switch to monthly to take one,
  keeping what they paid. Praying instead is a promise to pray each month. The website's Give box uses PayFast too, and its
  payment-holiday answer now says how long a holiday lasts. All five languages; What's new; setup tool; brochure.
- ✅ 19 Nov 2026 (0.99.0): **Midweek Groups online – this week's links** (`docs/COMMUNITY-PLAN.md` part 4, steps 4.1–4.3). A group's
  leaders and co-leaders post the meeting link and the notes link (the meeting link remembered from last week); the group gets a
  message with Join the meeting and Open the notes – now, or on the day (it waits in Messages until then); a Home card on the day
  that becomes Join now 15 minutes before; Past studies on the group's page; a live-streamed study can be open to the whole church.
  New `studies` collection and rules (church to re-publish the database rules, or let the workflow do it). The phone notification
  for "on the day" comes with push notifications (Phase 5).
- ✅ 19 Nov 2026 (0.100.0): **Who can see what, in one place** – Settings → *Access and roles* replaces the separate *Who can see what*,
  *Attendees* and *What Pastors can do* pages: a card per kind of person (Administrator, Senior Pastor, Pastors, Roster
  coordinators, Children's ministry, Church Partners, attendees) says what they see and can do in plain words (`Access.summary`,
  tested), how many have it, with View as and Change; then the jobs in one part (carers, Midweek Group leaders, keepers,
  librarians, the church secretary for roster replies, the Council) and each setting once. Same settings underneath – nobody's
  access changed and nothing needed moving; the old addresses still work.
- ✅ 19 Nov 2026 (0.100.1): **Brochures fit their panels.** The other-church brochure's “Try the demo” panel ran off the page
  (“Let's talk” was cut off): it is shorter, and signing in with a cellphone number moved to “Members help themselves”. Web addresses
  now break only after a “/” (no more “church-” / “hub” or a lonely full stop), and a panel that is still a little too long – a wider
  font chosen in About → Brochures, long contact details, a church's own wording – shrinks just that panel's text, never below 88%
  (`fitPanels()` in `brochure.html`; anything longer is still reported in red). Checked with all seven brochure fonts.


- ✅ 20 Nov 2026 (0.102.0): **Invite people to Church & Trellis** (`js/people/welcome.js`). Administrators and Pastors invite one
  person (their page), the people found or ticked in Advanced search (a Care Group, Midweek Group, serving team…) or those
  selected on the People list: one email in Bcc, or WhatsApp one by one with their name; Basic access for those who can't sign
  in yet; sign-in codes for those with no email. The link (`#/start`) welcomes them on the sign-in screen and offers the Android
  app or Add to Home Screen. `details.appInvited` and `people.appFirstSeen` (the first sign-in, written by the person – rules
  allow it on their own record); People → Invitations with Remind / Remind all; a Home to-do after 7 days; Advanced search
  fields Using Church & Trellis, Invited, First signed in. Home offers the Android app on Android phones. `docs/PLAY-STORE.md`:
  the Play Store's cost and steps.
- ✅ 0.98.1 (19 Nov 2026): Names listed A to Z, each a chip that opens the person's page, in Rosters → Teams and Serving
  together (plain text for someone who may not open people's pages), custom groups, Librarians, the board and Marketplace keepers,
  and Privacy → Retention (its Open button replaced by the name). `Hub.byName` sorts people A to Z. What's new in all five languages.
- ✅ 0.101.0 (20 Nov 2026): Print the roster (Rosters → More → Print the roster; Pastors and others who may see the whole roster
  from My serving). A4 landscape, a term at a time (this term or the next – the quarters, close to the school terms – or any
  dates), one service per page (all the 8 o'clock services of the term together; special services on one page of their own).
  Only positions with names are printed: positions a service doesn't have (Creche at 5pm, communion roles on a Sunday without
  communion) and empty ones are left out completely, unless "Also print positions that are still empty" is ticked. People who
  said no are left out; more than 13 Sundays split evenly over pages. Print, or "Save as PDF" in the print window. Rules in
  `RosterCore.terms / printChoices / printSheets / pages` (tested in `tests/roster.test.js`). What's new, brochure and setup tool.
- ✅ 0.103.0 (20 Nov 2026): **Events – organising, signing up and reminders** (`js/events.js`, `js/mod-events.js`,
  `css/events.css`; plan: `docs/COMMUNITY-PLAN.md` part 1, steps 1.1–1.2 without the waiting list and questions). An Events page
  of colourful cards with a date tile; organisers (Administrators, Pastors and the church secretary until the church chooses –
  `Access.JOBS.organisers`) put events up (who it's for, sign-up, closing date, guests, email reminders on or off), see Who's
  coming, download or print the list, message everyone coming, and cancel an event (everyone coming is told). Members tap
  **I'll be there** (themselves and the household members they can see; others come as guests), Add to my calendar (.ics) and
  I can't come after all. **Reminders 3 days and 1 day before**: in Messages always (each person's own app writes theirs on the
  day, kind `event`, about `remind`, a fixed id so never twice), and by email for those who tick *Email me reminders too* – the
  email robot (`robot/event-mail.js`, `.github/workflows/event-reminders.yml`, `docs/EVENT-EMAILS.md`) sends them every morning
  through the church's Gmail in each person's language. Home shows "Coming up". Tests: `tests/events.test.js`,
  `tests/event-mail.test.js`, `tests/app/events.js`, `tests/rules.test.mjs`. Words in all five languages.
- ✅ 0.104.0 (20 Nov 2026): **Staff add people to events** – anyone on the staff (Administrators, Pastors, Roster coordinators, Children's ministry) and the organisers see Who's coming and tap **Add people** to put someone (and those of their household who are coming, plus guests) on the list, e.g. from a paper sign-up sheet. In the person's own name, marked "Added by", no email address; allowed after sign-up closes. `Events.add`, `firestore.rules` (mayAdd), `events.add` in `js/access.js`.
- ✅ 0.105.0 (20 Nov 2026): **Sign-up report** – organisers and staff print everyone signed up (A4, one event per page: names, cellphone numbers, optional email, guests, who added them, a tick box for the door) or save it as a PDF, or download it as a spreadsheet. Events → More → Sign-up report, or Print on an event's Who's coming. `Events.report`, `Events.contacts`; audited.
- ✅ 20 Nov 2026 (0.106.0): **Names from a photo, typed or said** – Events → From a sheet reads a photo of a paper sign-up sheet with Gemini (or typed/said names), matches each name to People on the phone (slips of the pen, short forms, sounds-alike), and staff check every name before people are added, one sign-up per household; Administrators and Pastors can register someone not yet in People; People → From a photo adds visitors from cards; a microphone with "Sounds like" names in People's search and every find-someone box (`js/name-list.js`, `js/name-scan.js`, `js/voice.js`)
- ✅ 20 Nov 2026 (0.107.0): **Guests for each name from a sheet, and Google Photos** – each person added from a sheet has their own guests counter (filled in from "+2", up to the event's limit); Choose a photo says it opens Google Photos (Android), with a hint for iPhones
- ✅ 21 Nov 2026 (0.107.1): **Events: delete asks first in a dialog** – deleting an event asks in a confirmation dialog (with how many sign-ups will be removed) instead of a two-tap button inside the menu, which closed before the second tap (#281)
- ✅ 21 Nov 2026 (0.107.2): **Startup loading & feedback** – unified splash screen with a calm progress bar and status steps while church records load (no jarring flash to a white card); dignified pulsing cross; Android window background and WebView match the brand color so cold start has zero white flicker (#286)
- ✅ 23 Nov 2026 (0.107.5): **Startup speed, tooltips, new positions** – the audit log (1000 entries, only for Privacy) loads 6 seconds after opening instead of at startup, updates from the database that arrive together are put together once, and keeping the offline copy waits 4 seconds; About → Speed check now shows a timeline of the start and the longest busy spells. The Administrator, Rector and every Pastor may write a position’s tooltip (rule: a Pastor may change only `tooltip`); tooltips and the Me page use the tap-friendly “i”; a new position is added in one dialog; the loading bar respects “reduce motion”.
- ✅ 23 Nov 2026 (0.107.6): **Opening no longer freezes the phone** – the Speed check showed a 4.3 s freeze about 1.7 s after the records loaded: bringing every directory entry in line (for ~1200 people) recalculated every couple, every directory consent and a copy of the whole directory once per person. Now the consents and couples are worked out once, and reading one record no longer copies the whole collection (`known()`).
- ✅ 23 Nov 2026 (0.107.8): **Sign-in: a late answer can't open the wrong session** – each sign-in look-up (email, or number and PIN) now checks that the same person is still signed in when the server answers; if they signed out or switched account meanwhile, the old answer is ignored instead of loading church data. About → Speed check's timeline also shows when the offline copy opened, when it was checked and when access was known, to find the wait between signing in and the records.
- ✅ 24 Nov 2026 (0.107.11): **Archives made friendlier** – folders are coloured tiles (year and month folders are calendar tiles), a breadcrumb trail shows where you are, each folder has a heading, documents start with a coloured file-type badge with Preview and Download beside them (Edit and Delete as small icons), the newest documents show on the first page, search is bigger, empty folders show one friendly message with the Add button, and the Library tabs sit under the title like every other page
- ✅ 24 Nov 2026 (0.107.12): **Me page easier to read** – your details come first and your groups (Care Group, then Midweek Groups) last, under their own headings, with two Midweek Groups side by side on a computer; the main button (`btn primary`) is pale orange everywhere so headings stand out, "Ask to change these" and "Post another week" now match the other main buttons; card headings are 18px (group names inside a card no longer fall back to the browser's 24px) and a heading over a run of cards is 20px (`sect-h`).
