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
| **Security safeguards** (s19–22) | Sign-in with Google or an email link (no passwords to leak); only email addresses on the church's **access list** get in. Role-based access (Administrator, Pastor, Roster coordinator, Children's ministry, Member) is enforced by the **database security rules** (`firestore.rules`), not just the screens, and tested automatically. **Children's medical notes: Children's ministry only. Pastoral notes: Pastors only** – not even Administrators can read them; they can only delete them when someone asks to be deleted. Every view of these notes, every change and every sign-in is in the **audit log**, which nobody can edit. The church directory holds only name and phone of adults who agreed. A **breach register** records security compromises and whether the Information Regulator and the people affected were notified (s22). Church data is stored in South Africa (Firestore, Johannesburg). |
| **Data subject participation** (s23–25) | A **requests register** for access, correction, deletion and objection, with due dates. One click **exports everything held about a person**; **delete** removes their details and keeps only anonymous statistics. |

## Marital status and people who have died
- **Marital status** (adults) is ordinary personal information, kept for pastoral care. It is stored with birthdays in the
  private details (Administrators, Pastors and the person themselves), not in the directory.
- **After a death**: POPIA protects information about *living* people, but details of someone who died usually also say something
  about their living family, so Church Hub keeps the same protection. The person stays on the records (marked Deceased),
  leaves the directory, can't sign in and gets no messages. They appear under Privacy → Retention ("People who have left or
  died") so the church can decide when to delete their details.

## Photos of people
- **Purpose:** recognising people (welcome team, children's check-in, the members' directory). Lawful basis: the church records consent (the church chose not to ask a separate photo consent). The existing "Photos" consent is about photos taken at church events, not these.
- **Kept small and apart:** each photo is cut to a 320 × 320 picture (about 20–40 KB) and stored in its own place (`photos/{person}`), fetched only when it is shown.
- **Who sees them:** adults – staff, the person, and members when the adult agreed to be in the directory. Children – Administrators, Pastors and Children's ministry only (members, roster coordinators and the child's parents don't see them in the app).
- **From Elvanto:** the import downloads each person's picture from Elvanto's own address (only for people without a photo), makes it small and stores it the same way; the count is in the audit log.
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

## Offers to serve
When someone offers to serve (Me → Serving), Church Hub keeps which position, how often, their optional note and the
roster coordinator's reply. Purpose: planning rosters; basis: the person asked themselves. Only the person, Roster
coordinators and Administrators can see it (database rules). Yes moves it onto the team list and deletes the offer;
the person can withdraw it at any time; it is included in "export everything held about a person" and removed when
someone is deleted or dies.

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

## Other POPIA points covered
- **Direct marketing by email/SMS (s69):** only to people with consent for that channel; every message will include an opt-out (Phase 5).
- **Cross-border transfers (s72):** the church's data (Firestore) is stored in Johannesburg. **Sign-in accounts** (the email addresses of people given access, and their Google name) are kept by Firebase Authentication on Google's global servers – the privacy notice should say so. Any other overseas service (e.g. an SMS gateway) is also listed in the privacy notice.
- **Data on devices:** Church Hub doesn't keep a copy of church data on the phone or computer after the browser tab is closed (no offline cache). Remind people to sign out on shared computers.
- **Information Officer registration:** the church registers its Information Officer with the Information Regulator (outside the app; recorded in Settings).

## What the church must do outside the app
1. Appoint and register the Information Officer.
2. Approve the privacy notice and consent wording.
3. Decide the retention period (e.g. 24 months of inactivity).
4. Train people with Pastor / Children's ministry access.
5. Sign an operator agreement with the hosting provider (s21): accept Google's data processing terms for the Firebase project (see `FIREBASE-SETUP.md`).
6. Decide who gets which access, and review the access list (People → App access) every few months.
