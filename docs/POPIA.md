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
**With AI** (only when an Administrator switches it on in Settings → Apps, after the setup in `docs/AI-SEARCH-SETUP.md`):
the question goes to Google's Gemini through the church's Firebase project (Firebase AI Logic, Gemini Developer API), with
today's date, the names of the search fields and their safe choices (categories, positions, teams, service times, care group
names). **No records are sent** – no names from the church, households, contact details or results; a person named in a
service question is matched on the device. The question may contain a name if someone types one, so the Information Officer
agrees first, the privacy notice says so, and staff are asked not to type private matters (on the free tier Google may use
requests to improve its products). Gemini's answer is checked on the device: only fields and values that person's role may
search on are used (`js/ask-ai.js`, tested). The audit log marks such searches “(AI)”. Requests need App Check (reCAPTCHA),
so only Church Hub can use the church's AI allowance. Switching it off stops all of it.

## Applying to become a Church Partner
Someone signed in (an adult who isn't a Church Partner yet) applies from their own page (Me → Become a Church Partner).
Kept in `partnerApps`: their answers (spouse's and children's names, since when they've come, other church membership, Bible
study, questions, how they'd like to serve), the declaration they agreed to, and **how they came to faith** – religious
information, special personal information under POPIA. Purpose: deciding on membership (the church's constitution asks for it).
Basis: the person's own application to a religious body, about its members (POPIA s 28), and their consent in sending it.
Only the person, Administrators and Pastors can read it (database rules); opening an application is audit-logged. The **ID
number** asked for (to confirm they are 18 or older) never goes into the application: it is saved in `idNumbers` (Administrators
only; the person may give their own once, never change one already kept). On **Accept** they become a Church Partner from the
date approved, and their Contact details consent (being in the church directory, which they ticked on the form) is recorded.
The application is included in "export everything held about a person" and deleted with the person.

## Name badges
For a newcomer who asks for one: the date asked for and the date printed, on the person's details (Administrators and Pastors).
Only their first name (or the name they're known by) and surname are printed. Purpose: welcoming people by name; basis: they asked.
Badges printed from Advanced search are for people the church office chose (newcomers at a welcome event, a group): still only
the names, printing is audit-logged, and the sheets should be destroyed once the badges are cut. The same goes for badges
for people ticked on the People list (Administrators and the Senior Pastor).

## Coming to the church since, and the birthday on the application
**Coming to the church since** (`attendingSince`, a month) is on the person's details: Administrators and Pastors (and the
person). Purpose: knowing how long someone has been part of the church (membership asks for six months' regular worship).
It comes from their application, or is typed in. The **birthday** on the application is asked only when none is on record,
to confirm they are 18 or older; in South Africa it is read from the ID number they type (nothing is sent anywhere). It is
copied to their details on Accept. The **declaration of loyalty**, when the church asks for one, is kept in the application
with the other declaration (the person's own statement, same access).

## Invitations to become a Church Partner
Administrators and Pastors can email an invitation to apply. Kept: the date invited (`partnerInvited`, on the person's details –
Administrators and Pastors; purpose: not inviting the same person twice; basis: the church's legitimate interest in its own
members). Several people are sent one email in Bcc, so nobody sees the others' addresses. Inviting can give someone Basic access
so they can sign in and apply; that is recorded in the audit log like any other change of access. Children, people who have left
and those who have died are never invited. The QR code, poster and paper form carry only the link – no personal information.

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
  also let them see which group each person **in the church directory** is in (names only, on the directory entry) – as a list of
  all groups on the Care groups page, and/or as a tag on each person's page in People (`settings.careOnPeople`, a separate tick);
  people in the directory agreed to share their details with members (consent "Church directory"). The
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
When and where a Midweek Group meets is on the group (seen by its members): the day, time, and a venue – either "at the
host's home" or a place and its address. A host's home address is never copied onto the group: Administrators and Pastors
see it from People, and the members only from the host's own card, which carries it only if the host is in the church
directory. Co-leader and host are roles within the group, set by its leaders, Administrators and Pastors.

## Messages inside the app
- Purpose: keeping in touch with the people the church cares for (notices, care-group and team news). Basis: the church's
  legitimate interest – a message goes only to a group the person belongs to (their care group, a message group an
  Administrator or Pastor put them in, the staff, or the Church Partners), or to people an Administrator or Pastor chose one by
  one (they already see everyone's contact details). No new personal information is collected:
  a message holds the sender's name, the text, the people it went to (record numbers only) and who has opened it.
- Who may read: the people it went to, its sender, Administrators and Pastors (database rules, tested). Members load only
  their own; the list of who opened it is shown only to the sender, Administrators and Pastors. People can't change a message
  they received, only mark it as opened.
- Who may send: Administrators and Pastors to any group or to people they tick; carers to their own care group; group leaders
  to their own group; anyone on a leadership group (e.g. the Council) to that group.
- Who has read it: the sender (and Administrators and Pastors) see the names of who has opened a message and who hasn't
  (Sent → Read by …). The names come from records the sender may already see, or the group's own list of names.
  Sending and deleting are in the audit log (to whom and how many – not what the message says). The Write page asks people
  not to put private or medical details in a message to a group.
- To do: how long messages are kept (ROADMAP) – until then Administrators, Pastors and senders can delete them.

## Leadership groups (the Council, elders, leaders)
- Purpose: church governance – the congregation knowing who its office-bearers are and what each looks after. Basis:
  legitimate interest (office-bearers serve publicly). Kept: name, role, title, portfolios and the dates served – no
  contact details (those stay under the directory's consent).
- Who sees: everyone signed in, or only the group's own members when an Administrator or Pastor makes it "members only";
  Administrators and Pastors manage (database rules, tested). "Served before" keeps past office-bearers as the church's
  record; an Administrator or Pastor can delete a line (e.g. on a deletion request). Changes are in the audit log.
- Terms of office (which term someone is in, when it started and ends) and the membership type (Elected Member,
  Co-opted Member or Other) are part of the office-bearer's public role and follow the same access. A description for
  "Other" is public too, so it must describe the role rather than private information. The notice four months before a term ends, with whether the person may stand
  again, is shown only to Administrators and the Senior Pastor (Rector).
  The maximum consecutive terms is a governance rule. Current term number and dates follow the same access as the public
  office; the reminder and re-election eligibility are limited to Administrators and the Rector.
## Administrator-managed groups
- Purpose: organising staff and other ministry/committee groups. Membership uses the existing people records and staff
  status; group records hold IDs, not copied names, contact details or private notes. The built-in Staff list is derived
  from active staff status so it cannot drift out of sync.
- Administrators manage custom groups. Church-visible groups can be read by signed-in users; members-only groups can
  be read by their members and Administrators. This is a legitimate-interest use for church organisation; it does not
  grant access to any additional personal details.
## Archive (minutes, plans, staff contracts, appraisals)
- Purpose: keeping the church's records – governance (minutes), property (plans) and employment (contracts, appraisals).
  Basis: legal obligation and legitimate interest for governance and property records; the employment contract and labour
  law for staff records. Staff records are personal information about an employee, and appraisals can be sensitive.
- Who sees: only Administrators and Council members can open the Archives; each record then adds its own restriction –
  everyone in that authorized group, one leadership group, Administrators and Pastors, or (the default for staff
  contracts and appraisals) Administrators and the Senior Pastor. The staff member a record is about sees it only if
  the church ticks that; POPIA gives them the right to ask for a copy either way (Privacy → Requests). Administrators
  and Council members can add, change or delete records; only Administrators change the shared categories. Firestore
  rules enforce the role gate for records and files, and people load only the records they may see.
- Security: files are kept in the church's own database (in South Africa), not in a public file store, and are fetched
  only when someone opens them. A separate, database-protected copy supports inline previews for Administrators and
  Council members who may already see that record; other download access is unchanged. Previewing, downloading or
  opening a link for a record that isn't for everyone is in the audit log, as is every record added, changed or deleted.
  A **link** to a file kept elsewhere (e.g. Google Drive) is only as private as that place – the church must set its
  sharing there.
- An Administrator may select an Archive document for the membership application. The form reads a separate,
  minimized copy containing only the title, date, link and optional file; it does not expose Archive notes or access
  settings. Signed-in applicants can read this copy, while Firestore denies direct reads of the source Archive record
  unless its normal role rules permit them. File parts are available only for the currently published version.
- Google Docs previews are embedded from the document's own sharing URL. The church must set its Google sharing
  permissions appropriately; users can also open the document in Google Docs.
- Retention: the church decides how long each kind of record is kept (minutes usually permanently; staff records for the
  period labour and tax law require after someone leaves) and deletes records when that time is up. To do: a retention
  review for the Archive (ROADMAP).
- Don't file pastoral or medical information here: pastoral notes have their own, stricter place.

## Library
- Purpose: looking after the church's books, DVDs, CDs and other items. Basis: legitimate interest (someone who borrows the
  church's property is recorded until it is back); for a visitor who is not on the church's list, they give their name and
  number themselves in order to borrow. Kept: which item, who borrowed it, the dates lent, due and returned, a mobile
  number so the item can be traced while it is out, and any return note about its condition.
- The mobile number is kept on the loan only while the item is out: it is cleared when the item comes back (`Library.giveBack`).
  For someone on the church's list it is copied from their record; if their record has none, the librarian types one, and
  someone who may edit people (Administrators, Pastors) may also save it in that person's details (logged).
- An item marked **lost** keeps the borrower's mobile number on that loan, so the church can follow it up; the loan (with the
  number) is removed a year later like any other. Library reports, printing and CSV downloads are for librarians only and logged.
- Visitors who borrow are not added to the church's list: their name lives only on the loan, which is removed a year after
  the item came back. Lending to a visitor is written in the audit log (no name or number in the entry).
- Administrators and librarians may also permanently purge a loan or a removed item and its linked loan records when needed.
  The purge is recorded in the immutable audit log; the audit trail itself is not deleted.
- What someone reads can say something about them, so who borrowed what is seen only by the librarians (Administrators
  and people chosen by an Administrator or the Senior Pastor) and the borrower; everyone else sees only
  "On loan" (database rules, tested). Other loans are not written in the audit log. Choosing a librarian is logged.
- Friendly reminders: three weeks after borrowing (`Library.REMIND_DAYS`) the borrower sees a reminder in the app; a
  librarian may also send it by WhatsApp or SMS to the loan's mobile number – the reason the number is kept. Only the date
  of the last reminder is stored on the loan (`reminded`), not the message, and sending it is in the audit log (the item's
  title, not the borrower's name or number).
- Cover pictures (`covers/{id}`) and the library's policy (`libraryPolicy/policy`) hold no personal information; everyone
  signed in may read them.
- Librarians and Administrators may look up book covers from Google Books by ISBN, title and author. Only those
  bibliographic search terms are sent to Google; borrower names, contact details and loan records are not. Each fetched
  picture is previewed before it is saved to the church's database. The Administrator is reminded every 180 days to confirm
  the librarian list is still current.

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
