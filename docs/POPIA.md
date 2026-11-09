# Church Hub and POPIA

How Church Hub supports the **Protection of Personal Information Act 4 of 2013 (POPIA)**.
This is a design checklist, not legal advice – the church's Information Officer should review it.

## Why it matters for a church
- A church membership list reveals **religious beliefs**, which is *special personal information* (s26).
  POPIA allows a religious body to process this for its own members and people connected to it (s28), but it must still be protected.
- **Children's** information (check-in, allergies, guardians) may only be processed with a parent's or guardian's consent or another ground in s35.
- **Health** information (allergies, medical notes) is also special personal information.

## The eight conditions and how the Hub meets them
| Condition (POPIA) | In Church Hub |
| --- | --- |
| **Accountability** (s8) | Settings → Privacy names the **Information Officer** (and deputy). Every change and every view of sensitive data is written to the **audit log**. |
| **Processing limitation** (s9–12) | Only fields the church needs. A **consent register** per person and purpose (church records, email, SMS, directory listing, photos, children's medical notes), with date, method and who recorded it. Children's consent is recorded against a guardian. |
| **Purpose specification** (s13–14) | Each consent names its purpose. **Retention review** lists people inactive for longer than the church's retention period so they can be archived or deleted. |
| **Further processing limitation** (s15) | Contact lists only include people who consented to that channel. |
| **Information quality** (s16) | People can see and update their own details; changes are logged. |
| **Openness** (s17–18) | A **privacy notice** (editable in Settings) is shown when someone is added and in the member app. |
| **Security safeguards** (s19–22) | Sign-in with Google or an email link (no passwords to leak); only email addresses on the church's **access list** get in. Role-based access (Administrator, Pastor, Roster coordinator, Children's ministry, Member) is enforced by the **database security rules** (`firestore.rules`), not just the screens, and tested automatically. **Children's medical notes: Children's ministry only. Pastoral notes: Pastors only** – not even Administrators can read them; they can only delete them when someone asks to be deleted. Every view of these notes, every change and every sign-in is in the **audit log**, which nobody can edit. An Administrator's **View as** (seeing the Hub as another role would) shows only what that role may see, never pastoral or medical notes, saves nothing, and is logged. The church directory holds only name and phone of adults who agreed. A **breach register** records security compromises and whether the Information Regulator and the people affected were notified (s22). Church data is stored in South Africa (Firestore, Johannesburg). |
| **Data subject participation** (s23–25) | A **requests register** for access, correction, deletion and objection, with due dates. One click **exports everything held about a person**; **delete** removes their details and keeps only anonymous statistics. |

## Marital status and people who have died
- **Marital status** (adults) is ordinary personal information, kept for pastoral care. It is stored with birthdays in the
  private details (Administrators, Pastors and the person themselves), not in the directory.
- **After a death**: POPIA protects information about *living* people, but details of someone who died usually also say something
  about their living family, so Church Hub keeps the same protection. The person stays on the records (marked Deceased),
  leaves the directory, can't sign in and gets no messages. They appear under Privacy → Retention ("People who have left or
  died") so the church can decide when to delete their details.

## Gender, Church Partner dates, volunteering and what people would like to receive
- **Gender** (Female / Male / not recorded): ordinary personal information, kept with the private details (Administrators, Pastors, the person; Children's ministry for children). Read from Elvanto's Gender column.
- **Date accepted as Church Partner** and **Partnership last updated**: private details, Administrators and Pastors (and the person).
- **Volunteering** is kept as their serving (Rosters positions, with the services they serve at), so rostering uses it; Administrators and roster coordinators change it.
- **Would like to receive** (Weekly Church Notices by email; prayer needs and missionary updates by WhatsApp or email; "Who is Jesus" on WhatsApp) is in the **consent register**, so it records when and how each choice was made and can be withdrawn (POPIA s11, s69 for electronic messages). A choice never ticked isn't recorded as a "no". Members change their own under **Change my choices**.

## Home address and middle name
- **Home address** (street, line 2, town, postcode, province, country) and **middle name**: private details – Administrators and Pastors, and the person themself (Children's ministry for children). Purpose: pastoral visits and keeping records correct. Brought across from Elvanto's Home Address columns (provinces tidied, e.g. KZN → KwaZulu-Natal); a province or country on its own isn't kept as an address. Elvanto's mailing address isn't used.
- From Elvanto the import also takes **Date Added** (when someone was first added – it replaces the import day), **Anniversary**, **Membership Date** and **Membership last renewed on** (the Church Partner dates; a renewal year on its own is kept as the year), **Checklist of what to receive** (into the consent register, "Carried over from Elvanto") and **Department Positions** (volunteering). Groups, giving, security codes and Elvanto's email/SMS preferences are not read: Elvanto ticks those preferences by default, so they aren't consent.

## ID numbers
- **Purpose (as the church gave it):** telling apart people with the same name; they were also collected during covid. POPIA s10 (minimality) and s14 (keep no longer than needed): the covid reason has ended, so the church should decide whether it still needs ID numbers at all – a date of birth usually tells people apart. Delete them if not.
- **Where:** `idNumbers/{person}`, apart from everything else; never loaded with the person, only when an Administrator taps **Show**, or presses Search in an advanced search with an *ID number* filter (all are fetched for that search, kept only in memory and never shown, put in a column or downloaded; at least 4 digits must be typed). Every view, search (with who was found) and change is in the audit log.
- **Who:** Administrators only. A person may see their own (not change it). Pastors, staff and members never see them.
- **From Elvanto:** the import reads "ID Number (Numeric)" (a lost leading 0 is put back; spreadsheet-mangled numbers are left out). ID numbers typed into names ("5710210087085 Thomson") are taken out of the name once, when an Administrator signs in.

## Church office notes
- Notes about a person for the church office (e.g. Elvanto's Notes column). Administrators and Pastors read and write them (`officeNotes/{person}`); members, roster coordinators and Children's ministry don't see them. Pastoral matters belong in pastoral notes (Pastors only). Adding and deleting is in the audit log. Deleting a person deletes their office notes and ID number.

## What the robot reads in Elvanto
- Nightly, only when switched on (Leave → Elvanto): Elvanto's Unavailable Volunteers list – **names and dates from today on,
  never the reason** (POPIA s10, minimality) – kept in `elvantoFound/unavailable`, which only Administrators can read or delete.
  An Administrator decides what becomes an away date (Import → Unavailable dates from Elvanto); that is audit-logged. The
  robot's public log has counts only.

## Photos of people
- **Purpose:** recognising people (welcome team, children's check-in, the members' directory). Lawful basis: the church records consent (the church chose not to ask a separate photo consent). The existing "Photos" consent is about photos taken at church events, not these.
- **Kept small and apart:** each photo is cut to a 320 × 320 picture (about 20–40 KB) and stored in its own place (`photos/{person}`), fetched only when it is shown.
- **Who sees them:** adults – staff, the person, and members when the adult agreed to be in the directory. Children – Administrators, Pastors and Children's ministry only (members, roster coordinators and the child's parents don't see them in the app).
- **From Elvanto:** the import downloads each person's picture from Elvanto's own address (only for people without a photo), makes it small and stores it the same way; the count is in the audit log.
- **Asking for one:** in the Android app and the iPhone home-screen app, adults without a photo are asked (once a month at most) to add one of themselves.
- **Who adds them:** Administrators and Pastors; Children's ministry for children; adults their own. Adding, changing and removing a photo is in the audit log. Deleting a person deletes their photo.

## Children: who gives consent and who may collect
- POPIA s35 needs consent for a child from a "competent person" – a parent or legal guardian. Church Hub records, per child,
  which adults **can give consent**; consent for a child can only be recorded from one of them. Step-parents, grandparents and
  collectors can't, unless they are legal guardians.
- **Not allowed to collect** entries (e.g. a court order) can reveal a family's private circumstances. Only Administrators,
  Pastors and Children's ministry can see them (database rules), and every view is in the audit log. Keep the note short and
  factual ("court order – call the mother"); never store the court papers.
- Members can see which children they are linked to, nothing about other adults' links.
- Links made automatically are marked unconfirmed until someone checks them with the family.

## Advanced search and downloads
Advanced search only offers the details a role may already see, and never medical notes, pastoral notes or collection
restrictions. Downloading results (CSV) is recorded in the audit log with how many people and which columns. Downloads
should stay on church computers and be deleted once used.
**Ask in your own words** uses the same search and limits, and each question is written in the audit log. The microphone uses
the phone's or browser's own speech-to-text (Google's or Apple's speech service turns the sound into words); Church Hub keeps no
recording, and the hint on the button says so. People who'd rather not can type instead.

## Offers to serve
When someone offers to serve (Me → Serving), Church Hub keeps which position, how often, at which services, their optional note and the
roster coordinator's reply. Purpose: planning rosters; basis: the person asked themselves. Only the person, Roster
coordinators and Administrators can see it (database rules). Yes moves it onto the team list and deletes the offer;
the person can withdraw it at any time; it is included in "export everything held about a person" and removed when
someone is deleted or dies.

## Contact details: what others can see
The consent "Church directory" is shown as **Contact details**: name, phone, email and home address may be seen by church
staff and leaders, and by members as far as the church allows. Settings → What others can see decides, per role (Church
Partners, Roster coordinators, Children's ministry), what besides the name is shown – name only by default. Administrators
and Pastors see everything; people who didn't agree show nothing beyond what a role already had. The database holds only
what each role may see: `directory/{id}` (everyone) carries only what Church Partners may see; `contacts/{id}` (staff and
leaders only) carries address and spouse. Church Partners see shared details as pictures, so they can't tap or copy them
(they can still read them, or photograph the screen). Care group sharing is separate (Care groups).

## Changes people ask for (family details)
Church Partners can ask, from Me → My details, for their marital status, wedding anniversary, spouse or partner and children
to be changed. Church Hub keeps what they typed (names and birthdays of their children, their spouse's name, a note) and the
office's reply. Purpose: keeping church records accurate; basis: the person asked themselves. Nothing on their record changes
until an Administrator checks it. Only the person and Administrators can see it (database rules); the person can withdraw
it at any time; it is included in "export everything held about a person", deleted once dealt with, and removed when
someone is deleted. A child named in a request is only added to Church Hub by an Administrator, with the usual consent
from a parent or guardian.

## The Android app
The app shows the church's website; it stores no church information on the phone except the sign-in (as a browser
does) and the chosen language. Android's "Sign in with Google" is handled by Google on the phone. The app is downloaded
from GitHub (not the Play Store). Remind people to sign out (Me → My details) before giving a phone to someone else.

## Leave reasons
The kind of leave and its reason (which can be about health) are shown only to the staff member and Administrators – on Leave and on Rosters → Away dates. Everyone else, including roster coordinators, sees only "On leave" and the dates; the database never sends them more.

## Approved leave in Elvanto
When switched on, the name and dates of approved leave (never the kind of leave or the reason) go to Elvanto's Unavailable
Volunteers list, as Leave Manager did. The robot that does it runs on GitHub's computers (outside South Africa) for a few
minutes at a time and keeps nothing; its log never shows names or dates. Its Church Hub sign-in can only see that list.
The privacy notice should mention Elvanto and GitHub as operators.

## Moving data in from Elvanto and Leave Manager
The download from Elvanto or Leave Manager holds personal information (leave reasons can include health). It is read in the
Administrator's browser and saved straight into the church's database in Johannesburg – never sent to GitHub, Claude or anyone else.
Leave Manager PINs are dropped on reading. From an Elvanto export only the columns listed in ARCHITECTURE.md are read – ID numbers,
notes, giving and security codes are ignored – but it is safer to leave those columns out of the export altogether. Keep the download on the church computer and delete it once imported. Once Leave
Manager is retired, its Google Sheet should be archived (read-only) or deleted under the church's retention period.

## Care groups
- Purpose: care and fellowship in small groups. Basis: **consent** – the new "Care group" consent (People → Consent, or
  the person's own privacy choices). Without it, the group sees only their name.
- What the group sees: photo (small), mobile, email, home address and birthday (day and month, not the year) – a separate
  card per person in their group (`careGroups/{id}/share/{person}`), not their record. Only members of that group,
  Administrators and Pastors can read it (database rules, tested). Carers may add and remove members; every change is in
  the audit log. Leaving a group removes the person's card from it; after a death they are taken out.
- Roster coordinators and Children's ministry see **which group each person is in and who the carers are** (names only)
  only if an Administrator ticks it in Settings → Who can see what (`settings.seeCare`; off by default; the change is in the
  audit log). Purpose: arranging serving and children's work around the groups. They never see the cards (phone, address…),
  which stay with the group the person agreed to share with (database rules, tested).
- Church Partners: by default they see everyone in their own group (name always; the card only with consent). An Administrator
  can switch that off, so they see only their group's carers (enforced by the database rules for the cards). An Administrator can
  also let them see which group each person **in the church directory** is in (names only, on the directory entry): people
  in the directory agreed to share their details with members (consent "Church directory", shown as Contact details). The
  church's policy is that becoming a Church Partner includes this agreement: when someone is made a Church Partner (Edit details
  or Change selected…) Church Hub records it ("Agreed on becoming a Church Partner"), and Settings → Who can see what offers to
  record it for existing Church Partners who were never asked in Church Hub (anyone who said no is left alone). People can
  still say no later under Consent. Anyone not in the directory isn't shown.
- Suggesting groups by area (Care groups → Suggest groups by where people live): Administrators and Pastors only, who already
  see home addresses. It reads the suburb/town and postal code the church already holds, for the same purpose (care and
  fellowship); nothing is shown to the group or changed until they confirm, and opening the suggestions and every placement
  are in the audit log. A group's "areas" are place names, not personal information.

## Life groups (Bible studies, midweek groups)
- Purpose: fellowship and Bible study in small groups. Basis: **consent** – the "Church directory" consent (Contact details),
  which Church Partners give on becoming Partners (the church decided no extra consent is needed, Nov 2026). Without it,
  the group sees only the person's name.
- The same card as a care group (photo, mobile, email, address, birthday without the year), one per group, read only by
  that group's members, Administrators and Pastors (database rules, tested). Leaders add and remove members and rename
  the group; every change is in the audit log. Leaving a group removes the card; after a death they are taken out.
- Coming (`docs/GROUPS-PLAN.md`): a map of meeting places – the exact place, shown to everyone signed in (church's decision),
  with a tick that the host agreed.

## Messages inside the app
- Purpose: keeping in touch with the people the church cares for (notices, care-group and team news). Basis: the church's
  legitimate interest – a message goes only to a group the person belongs to (their care group, a message group an
  Administrator or Pastor put them in, the staff, or the Church Partners), or to people an Administrator or Pastor chose one by
  one (they already see everyone's contact details). No new personal information is collected:
  a message holds the sender's name, the text, the people it went to (record numbers only) and who has opened it.
- Who may read: the people it went to, its sender, Administrators and Pastors (database rules, tested). Members load only
  their own; the list of who opened it is shown only to the sender, Administrators and Pastors. People can't change a message
  they received, only mark it as opened.
- Who may send: Administrators and Pastors to any group or to people they tick; carers to their own care group; group leaders to their own group.
  Sending and deleting are in the audit log (to whom and how many – not what the message says). The Write page asks people
  not to put private or medical details in a message to a group.
- To do: how long messages are kept (ROADMAP) – until then Administrators, Pastors and senders can delete them.

## Suggestions for better translations
- When someone suggests better wording (Translations), Church Hub keeps the suggestion with their name and person ID, so the
  checker can thank them or ask what they meant. Purpose: improving the app's wording; basis: the person sends it themselves.
- Who sees it: the person, the checkers of that language, and Administrators (database rules, tested). It holds no other
  personal information. The person can take back a suggestion that is still waiting; it is included in "export everything
  held about a person" and deleted when someone's information is deleted. Approved wording itself holds no names.

## Other countries
Church Hub's privacy pages follow the church's country (Settings → Country): POPIA in South Africa, the GDPR in Europe
(with each country's data protection authority), UK GDPR, and other countries' laws where listed (`js/privacy-law.js`).
This document describes POPIA; churches elsewhere should check the same points against their own law.

## Other POPIA points covered
- **Direct marketing by email/SMS (s69):** only to people with consent for that channel; every message will include an opt-out (Phase 5).
- **Cross-border transfers (s72):** the church's data (Firestore) is stored in Johannesburg. **Sign-in accounts** (the email addresses of people given access, and their Google name) are kept by Firebase Authentication on Google's global servers – the privacy notice should say so. Any other overseas service (e.g. an SMS gateway) is also listed in the privacy notice.
- **Recording consent for many people at once** (Advanced search → Change selected…, Administrators only): only for answers
  the church really has (e.g. a stack of connect cards). Each person gets their own consent record – the answer, today's date,
  how it was given (required) and who recorded it – and the old answer is kept, marked as replaced; children are left out
  (their parent or guardian answers). Every record is in the audit log, and it can be undone straight away.
- **Data on devices (offline copy, from 0.30.0):** so that Church Hub opens without the internet, it keeps a copy on the phone or
  computer of what the signed-in person may see (Firebase's offline copy in the browser's storage, `js/store.js`) – nothing more
  than they could see by opening Church Hub there while signed in. Safeguards: the copy is **wiped when they sign out**, when an
  Administrator takes their access away (the next time the device is online), and before anyone else signs in on that device;
  offline Church Hub is **view-only**, so nothing is changed from an old copy. Phones' own screen lock and encryption protect it
  further. Remind people to sign out on shared computers (a copy left by another Church Hub tab still open is wiped at the next
  sign-in). Viewing sensitive information offline is still audit-logged: the entry is sent when the device is next online
  (it is lost if they sign out before that).
- **Information Officer registration:** the church registers its Information Officer with the Information Regulator (outside the app; recorded in Settings).

## What the church must do outside the app
1. Appoint and register the Information Officer.
2. Approve the privacy notice and consent wording.
3. Decide the retention period (e.g. 24 months of inactivity).
4. Train people with Pastor / Children's ministry access.
5. Sign an operator agreement with the hosting provider (s21): accept Google's data processing terms for the Firebase project (see `FIREBASE-SETUP.md`).
6. Decide who gets which access, and review the access list (People → App access) every few months.

## Shared sign-in (one email address for a couple)
- Several people with one email address share one sign-in and choose who they are after signing in. Whoever reads that inbox
  can act as any of them, so the rules allow what any of them may do – no more than they could do before by signing in with
  the shared address. Church Hub says so on Edit details; staff roles (Administrator, Pastor) on a shared address are best
  avoided, and only an Administrator can set them up. Switching is written in the history log.
