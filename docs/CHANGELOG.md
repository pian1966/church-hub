# Church Hub – changelog

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
