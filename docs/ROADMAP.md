# Church & Trellis – roadmap

Status key: 🟡 in progress · ⬜ planned. Only work still to do is listed here; finished work moves to `docs/CHANGELOG.md` (no need to read it).

## Phase 1 – Foundation 🟡 – built and live (pre-release v0.1.0, 25 Oct 2026); church trial and Leave Manager import next

**Church to do – setup**
- 🟡 Tidy Privacy (Information Officer name had a placeholder – fixed in code for future setups), record own consent, approve privacy notice, register the Information Officer
- ⬜ Confirm step 8 (key restricted to the website) is done
- ⬜ Switch on Email link sign-in in Firebase (Authentication → Sign-in method → Email/Password → both switches)
- ⬜ Settings → Access and roles – choose what each role sees (name only until you do), and ask people to renew their Contact details consent under the new wording
- ⬜ Choose the Care groups ticks in Settings → Access and roles, and click **Record that they agreed** for existing Church Partners if it appears
- ⬜ Re-publish the database rules after 0.102 (people may note their first sign-in) – or let the "Publish database rules" workflow do it
- ⬜ Decide: Play Store account, organisation or personal (docs/PLAY-STORE.md); then Claude adds the app bundle (.aab) to the Android build
- ⬜ Android app setup (docs/ANDROID.md): keep ChurchHub-ANDROID_KEYSTORE.txt safe and add it as the secret, build, optional Google sign-in (Web client ID), try it, send the link
- ⬜ Set up the robot (docs/ELVANTO-ROBOT.md steps 1–5), switch over with step 6
- ⬜ Re-publish the database rules (FIREBASE-SETUP step 7) after 0.69 – Archive security fixes (or let the "Publish database rules" workflow do it)
- ⬜ Before releasing to other churches: translate the 21 extra languages in one go (`docs/RELEASE.md`; Home counts what is waiting)
- ⬜ Fluent speakers check the isiZulu and isiXhosa (js/i18n/*.js – one line per text); then decide whether to translate staff screens too

**Church to do – people and Leave**
- ⬜ Remove the first Elvanto import (Import page), re-export (fewer columns), import again and check
- ⬜ Check the parents/guardians of each child (Home to-do)
- ⬜ Fill in Leave → Settings (terms, allowances) and mark staff; try Leave alongside the old Leave Manager
- ⬜ Trial the Leave Manager import, compare balances, then re-import at switch-over and retire Leave Manager (archive the sheet)
- ⬜ Check the “lost on 1 February” rule (no carry-over) against the Basic Conditions of Employment Act with a labour adviser

**Going live**
- ⬜ Trial with 2–3 staff and made-up people; Information Officer approves privacy notice (mention sign-in accounts are held by Google outside SA) and accepts Google's data processing terms
- ⬜ Then: import real people from Elvanto (Import) and give access

**Decide**
- ⬜ Should Church Partners who aren't staff stop receiving colleagues' away dates at all (now hidden on screen only)?

**Who can see what, in one place** – built (0.96.2 `js/access.js`, 0.100.0 Settings → Access and roles). Still to do:
- ⬜ Decide what "Ministry roles the church uses" (Settings → Terminology) should do – it is saved but nothing uses it yet
  (e.g. offer those names as staff job titles, or remove it)
- ⬜ Later: choose keepers, librarians and the church secretary on the Access and roles page itself (today: each where the job is done)

**Later (if wanted)**
- ⬜ Changes made offline, saved when back online (today offline is view-only); and a "shared computer – don't keep a copy" choice at sign-in
- ⬜ Leave: other countries' public holidays (Leave still uses South Africa's); Elvanto calendar events for staff leave (Leave Manager's optional extra, needs an Elvanto API key)
- ⬜ Leave Manager features still not in Church & Trellis (rechecked 5 Nov 2026; the wallchart, calendar, year planner, reports,
  payroll, Dashboard, cover rules, stand-in, Change and the email prompts were added in 0.16–0.19, dark mode in 0.37.0): emails sent
  automatically (today they open ready to send) and approving from the email without signing in; a leave History page
  (the audit log has the events); holidays and school terms updating themselves; the Google Calendar mirror; the Google
  Form; help videos.
- ⬜ Languages: translations checked by fluent speakers; church wording in the other languages too
- ⬜ Chinese (Simplified, Traditional) and Japanese: add back once translated with the church meaning (Leave, Pastoral notes,
  Household, Rosters, Care groups…) and checked by a speaker; the earlier files are in the history at 0.10.0 (js/lang/zh-Hans.js,
  zh-Hant.js, ja.js). Put "Asia" back in the language list (js/i18n.js) and in tests/app/care.js.

## Phase 2 – People and pastoral care
Members see their own family (and give consent for their children), smart lists (leave out people who have died), follow-up workflows (newcomer "connect" form starts them), birthdays and key-date reminders, background-check tracking, forms, members updating their own details (with approval).
- ⬜ **Names from a photo – follow-ups** (0.106.0 built Events → From a sheet, People → From a photo and the microphone):
  record consent from a visitor card in the same step (Consent → Paper connect card); decide whether Roster coordinators and
  Children's ministry may add someone new to People when registering them for an event (the rules allow Administrators and
  Pastors only); try the same reading for attendance registers and Midweek Group sign-up sheets; share a photo straight from
  Google Photos to Church & Trellis (Share → Church & Trellis: a web share target, and an intent filter in the Android app).
- ⬜ Save searches as smart lists; use them for emails and SMS
- ⬜ Partnership applications: an email to Administrators and Pastors when one arrives, as well as the message in Messages (needs a Firebase function); apply without an account yet (email link first); print badges from the Android app
- ⬜ Ask in your own words: more kinds of questions (leave, care and midweek groups, messages), and save an asked question as a smart list
- ⬜ Care board – like the whiteboard in Myra's office: a board of people who need care (ill, in hospital, bereaved, newcomers,
  struggling…). Adding someone sends a message through to the Care Group leader(s) of that person's Care Group (and the
  Midweek Group leaders if relevant) so they can be visited and cared for. Each name shows who is caring, when they were last
  visited and a status (needs a visit → visited → follow up → resolved), with gentle reminders when no one has picked someone
  up, and people not in any Care Group flagged for the Office/ministers – so no one falls through the cracks. Only pastoral
  staff and the relevant leaders see the board; keep details minimal and POPIA-safe (read `docs/POPIA.md`)
  - ⬜ **Seriously ill list** (asked 20 Nov 2026) – a section of the Care board for people who are seriously ill and need help:
    **in hospital** (which hospital, ward if known) or **bedbound at home**. Putting someone on it sends a short note about their
    situation through Messages to the leader(s) of each Care Group they're in, **and** to the church secretary and the pastors
    (the Rector and the other ministers), so all of them can open the board and see everyone currently on the list. The
    secretary is chosen as an extra person in Settings (like the roster "Also told when someone can't serve"), without other
    rights. Updates (moved home, back in hospital, recovered, died) notify the same people; taking someone off keeps a dated
    record for the pastors. Health details are special personal information: keep the note to the minimum needed to visit and
    help, log who views it, and get the person's (or family's) consent where possible (`docs/POPIA.md`)
  - ⬜ **Visit notes** (asked 20 Nov 2026) – anyone who visits someone on the list can note the visit: **when**, **where**
    (hospital and ward, at home, elsewhere), **who visited** (one or more people), **how the person is** (their condition), and
    **any special requests or needs** (e.g. communion, prayer, meals, lifts, help for the family). The notes show on that
    person's card in date order, the latest visit's date updates "last visited", and the same people who were told about the
    person (their Care Group leaders, the church secretary, the pastors) can read them. A new need can be flagged so the
    pastors and secretary get a message about it. Same POPIA care as above: only what helps, nothing more

## Phase 3 – Rostering and services (built; follow-ups below)
Accept/decline by email, swap requests, automatic reminders before a turn, sign-up sheets, run sheets / order of service, matrix across several services, Leave Manager switch-over (import sheet data).
- ⬜ Church: Rosters → Services – check each service's look, mood and positions (Teens/Children/Creche are 8am only, as in Elvanto); rename "Operational" to Service Leading if it was added before 0.29.0 (teams can't be renamed yet)
- ⬜ Decide: rename "Extra Slot" (e.g. Special Items, or Communion on its own and Features for Interview, Missions, Doctrine)
- ⬜ Later: rename a team, and rename a special service
- ⬜ Church: Rosters → Services – choose the departments and positions for each special service (they start empty, except Memorial Teas)
- ⬜ Later: a "See everything" map of services → departments → positions for the curious
- ⬜ **Service outline (order of service)** for each Sunday service, and with it **the Bible passage being preached** – shown
  to the people serving and on Home. For the Scripture text itself, consider the YouVersion Platform API (check its terms and
  which translations it allows; otherwise show the reference with a link)

## Phase 4 – Groups, attendance and check-in
Groups and attendance, kids check-in on a tablet with medical alerts and leader ratios, headcounts, volunteer check-in.
- ⬜ Life groups / Bible studies / small groups beside care groups, each kind switched on or off – full plan in `docs/GROUPS-PLAN.md`:
  1. ✅ done in 0.40.0 (see CHANGELOG); next: 2. meeting day, time and host; 3. Find a group and Ask to join; 4. a map of where
  groups meet; 5. a to-do so every Church Partner is in a group
- ⬜ Midweek Groups online (built in 0.99.0): a phone notification when the links arrive or the day comes (with push notifications,
  Phase 5); the Wednesday Bible study to start using it instead of WhatsApp (Settings → Apps → Midweek Groups on, the group and
  its leader added, then Post this week's links)
- ⬜ Church: Settings → Apps – switch on **Life groups**, then add the groups and their leaders (leaders can rename them)
- ⬜ At sign-out, show "Not allowed to collect" and the allowed collectors

## Phase 5 – Communication and calendar
First step done (0.12.0): email prompts for birthdays, anniversaries and welcomes, opened in the church’s email program. Next: sending them automatically (formatted, with the church logo) through Afrihost or Gmail behind the scenes; then email (consent-aware, with opt-out, never to people who have died or left), SMS via a South African provider, app notifications, church calendar and website embeds.
Messages inside the app done (0.21.0, Messages page). Next for messages:
- ⬜ The number of unread messages on the Church & Trellis icon on the phone's home screen (comes with push notifications below:
  Android shows it from waiting notifications; iPhone home-screen apps once notifications are allowed)
- ⬜ Phone notifications ("push") when a message arrives, even with Church & Trellis closed: Firebase Cloud Messaging in the
  Android app and the home-screen app (iPhone: iOS 16.4 or later, added to the home screen), sent by a small server step
  (a Firebase Cloud Function on the Blaze plan, or the GitHub robot with a service-account secret). Ask permission
  kindly after sign-in; a switch on Me to turn them off.
- ⬜ Email (and later SMS) for people who can't sign in yet or haven't opened a message after a day – consent-aware
- ⬜ A care group (or other group) talking together, as on WhatsApp – private replies to the sender are done (0.72.0)
- ⬜ Let Administrators publish documents from the Archive to the membership application for the Rector too (they can already write, link or attach what it takes to become a Church Partner)
- ⬜ Decide how long messages are kept (e.g. 2 years) and add them to Privacy → Retention
- ⬜ Weekly notices: the Office writes the week's notices once, and they go out each week only to people who have chosen to
  receive them (a switch on Me, like an opt-in, and changeable at any time) – in the app's Messages, and later by email for
  those who prefer it (consent-aware, with an easy opt-out, never to people who have died or left). Attendees as well as Church
  Partners can sign up; a past-notices list so anyone can read last week's again
- ⬜ **Events – the rest** (plan: `docs/COMMUNITY-PLAN.md` part 1; Events, sign-up and reminders 3 days and 1 day before were
  built in 0.102.0): a picture or poster on each event; places with a waiting list that moves people up; the organiser's own
  questions (dietary/medical as a ready-made choice with a POPIA note); an event naming its own organisers; repeating and
  several-day events; an optional cost with *Paid*; door check-in and walk-ins; later a sign-up link for guests. Steps 1.2–1.5
- ⬜ Church: to send event reminders by email too, set up the email robot (`docs/EVENT-EMAILS.md`, about 15 minutes)
- ⬜ Event reminders as phone notifications (with push notifications), so they arrive even when the app isn't opened

## Phase 6 – Member app and extras
Church Center-style member app (first part done: Me + Android app, Oct 2026), Elvanto API import (groups, departments), NFC tags, AI help, leadership insights.
- 🟡 Church: set up AI for Ask in your own words (`docs/AI-SEARCH-SETUP.md`) – App Check key added (0.45.1); still to do: privacy notice, App Check enforced for AI Logic, switch it on in Settings → Apps and try a question
- 🟡 **Help: ask a question** – built in 0.111.0 (`docs/CHANGELOG.md`); church to do: switch on AI (`docs/AI-SEARCH-SETUP.md`) for written answers (without it, Help shows the matching help pages), add the AI sentence to the privacy notice, and try some real questions. Follow-ups:
  - ⬜ A monthly limit per church (today: 12 questions to the AI per ten minutes from one device; the free Gemini allowance does the rest)
  - ⬜ A thumbs up/down under each answer, and a list for Administrators of questions that found no answer, so they know which help pages to write (needs a decision on keeping questions: POPIA – today nothing is kept)
  - ⬜ Help pages in the member's own language (today the AI translates the answer; the pages themselves are English)
  - ⬜ A "Help" button on each page that opens Help already asking about that page
- 🟡 **Leadership, Archive and Library** (built in 0.51, off until switched on in Settings → Apps). Church to do: switch them on,
  set up the Council under Leadership, name the librarians, and – if GitHub doesn't publish the database rules by itself yet –
  re-publish them (FIREBASE-SETUP.md step 7), or the three pages stay empty. Archives are now a Library tab; only
  Administrators and Council members can open and manage Archive records. Android: a new build of the app is needed to
  download Archive files inside the app. Follow-ups:
  - ⬜ Leadership (0.54 follow-ups): also send the term-of-office notice as an email to the Administrators and the Rector;
    "ex officio" as a third kind of member (beside co-opted); a group's Chair or Secretary manages its members
  - ⬜ Archive: let a group's Secretary file its own minutes; a retention review (how long
    each category is kept, with a reminder)
  - ⬜ Archive folders (0.92 follow-ups): let Council members make sub-folders too (now Administrators only, as folders
    live in settings); a financial-year option for date-sorted folders (e.g. March–February); drag a document onto a folder
  - ⬜ Library: send the three-week reminder by BulkSMS from Church & Trellis itself
  - ⬜ Library (0.52 follow-ups): fluent speakers to check the new Library words in the 19 further languages (drafted by AI);
    a text message (BulkSMS) to a borrower whose item is overdue, using the loan's mobile number; read the ISBN with the camera.
  - ⬜ Library (0.53 follow-ups): fluent speakers to check the 0.53 Library words (import, reports, lost) in the 19 further
    languages (drafted by AI); importing from an Excel file directly (today: save it as CSV first).
  - ⬜ Library (0.61): fluent speakers to check the new cover-search, librarian-management and review-reminder wording in
    the 19 further languages (drafted by AI).
  - ⬜ Library (0.67): fluent speakers to check the new borrower-date label in the 19 further languages.
  - ⬜ Library: the church's own loan period
  - ⬜ Church Words (Terminology) for "Council", "Leadership" and "Library", and demo data for the three pages
  - ⬜ Fluent speakers to check the new wording in every language (drafted by Claude), including the 0.54 words (terms of
    office, library reminders, formatting buttons)
  - ⬜ Formatting (0.54): use it for other documents shown in the app – the privacy notice, help pages, the church's own notices
- ⬜ **Community board and Marketplace – what's next** (built in 0.97.0; plan: `docs/COMMUNITY-PLAN.md`): decide whether
  attendees may see and post on the board (a tick in Settings → Attendees), whether Thank-you notes need a keeper, and whether
  30 days is right; *Check after posting* for people whose notices are always approved; *To lend* in the Marketplace; keepers
  told of each new item in Messages too (today: Home's to-do list and a badge); fluent speakers to check the new words
- ⬜ **Finances – budget and "are we on track?"** (plan: `docs/FINANCE-PLAN.md`): the Treasurer imports the year's budget from
  the spreadsheet and the monthly management reports (about 10 a year, month and year to date; matching remembered; the PDF
  filed in the Archive); the Rector, pastors and Council see a traffic light (on track / watch / concern), income, expenses,
  shortfall, a year-end projection, a chart against budget, and **things to look at** – overspends, underspends, income
  falling, anomalies – with the Treasurer's notes; one-page print for the Council pack; later an optional AI summary. Staff
  pay can show as one total. Decided (19 Nov 2026): the Treasurer is the *Treasurer* role on the Council in Leadership; **only
  the Council** sees Finances to begin with (a setting to widen later); financial year a setting – May–April at Christ Church
  Howick. Steps 5.1–5.5
- ⬜ Keepers for the board and the marketplace (decided 19 Nov 2026): the pastors, the Administrators and the church secretary
- ⬜ Decide (Community and Finances): may attendees see and post on the community board? Do Thank-you notes need approval? Is
  30 days right? The overspend thresholds; should staff pay show as one total even to the Council?
- ⬜ Keep `docs/help/` up to date: when a screen or button changes, change its answer in the same pull request – Help now reads these pages
  and answers from them (add this rule to CLAUDE.md; the Help page exists as of 0.111.0). Church to read through the help pages and correct anything that doesn't match how they work.

## Phase 7 – Church & Trellis for every church ⬜
**Decided (11 Nov 2026):** every church keeps its own database in its **own Google account**, and Church & Trellis creates it
for them in about a minute – nobody hosts other churches' information, and nothing depends on the owner's personal accounts.
The plan is `docs/architecture/DECISION.md` and `TARGET.md`; the work is in `docs/architecture/tasks/` (order and what can run
side by side: `tasks/README.md`). Christ Church Howick keeps its own project (`church-hub-7ec02`) and needs no move.

**What a church does (the target)**
1. Goes to **churchandtrellis.com** → "Set up Church & Trellis for my church" → church name and country.
2. Signs in with the church's own Google account and clicks **Allow**; a short list ticks itself off (about a minute).
3. Lands on the existing setup screen as the first Administrator (services, leave rules, terminology, language).
4. Brings people in (Elvanto export, a spreadsheet, or by hand) and shares the church's own link or QR code with members;
   members without email get a sign-in code, then use their cellphone number and PIN.
5. Pays a coffee a month (or ten a year) – or takes a payment holiday, or prays for another church instead.

**Done so far:** sign-in codes and PINs for the one-church setup (0.86–0.87, tasks 015–016); **choosing the church** – the
"Which church?" step and each church's own link `?c=<projectId>` (0.96, task 010); the Subscription page (0.98, see below);
the setup tool for doing it by hand (`site/setup.html`); the domain **churchandtrellis.com** (registered through Cloudflare, 19 Nov 2026).

**Next, in this order**
- ⬜ **001 – Church & Trellis's own Google account** (a person: the owner). A new Google account just for Church & Trellis,
  not the personal Gmail; the presentation and other Church & Trellis items move to it too. Everything below waits for it.
- ⬜ **002** – a trial page proving the automatic steps work from a browser (needs 001).
- ⬜ **The data-layer chain, one after another** (each from the merged one before; Senior): 013 per-church device keys →
  012 rules versions → 011 the public card → 031 plain-English quota messages → 061 licence check → 032 download only what changed.
  030 (measure reads per start) can run any time.
- ⬜ **014** landing screen; **020/021** the setup helper (engine, then screen with Google sign-in); **022** "Update the database
  rules" button; **023** AI setup.
- ⬜ **040** move to churchandtrellis.com (the website, the robot and the Android app's address; the console clicks are the owner's);
  **041** the Android app for any church.
- ⬜ **The office** (060 office project, 062 register a church, 063 office robot, 064 the owner's office page, 067 payments in the robot):
  the short customer list – each church's name, country and the Google account that set it up, nothing about its people.
- ⬜ **050** – guides, brochure, a short terms page and this phase brought up to date once the helper works.
- ⬜ Countries we don't serve: no setup from countries where a church member list could put people in danger (for example
  China, North Korea, Iran, Eritrea, Afghanistan). Explain kindly why, rather than a bare refusal. Church & Trellis is not
  end-to-end encrypted: Google, and anyone able to compel it, could read the data.
- ⬜ **Promises in writing** (decided 18 Nov 2026): no church's data is shared with third parties (other companies or
  organisations); anyone can ask for their data to be deleted. Put both on the website, in the privacy notice and the
  terms page (050). Today an Administrator can already export or delete a person (Privacy → Requests); still to add: a
  "Delete my information" request on Me that reaches the Information Officer.

**Sign-in codes and setup tool – still to do**
- ⬜ Church: switch on **Anonymous** sign-in in Firebase (Authentication → Sign-in method → Add new provider → Anonymous), check
  **Email/Password** (the first switch) is on, so sign-in codes and PINs work, and re-publish the database rules (or let the
  workflow do it) after 0.87 – sign-in codes and PINs
- ⬜ Sign-in codes (task 016): print slips for many people at once (People → Change selected…), a Settings switch;
  have the Architect (Fable) read the rules diff of 0.87 (MODELS.md asks for this for sign-in rules); a Settings choice for
  churches in areas hostile to the gospel to give only church numbers (not cellphone numbers)
- ⬜ Setup tool follow-ups (`site/setup.html`, built 17 Nov 2026): choosing the church (010) is built – when 020/021 (automatic
  setup) are built, replace the tool's "The church's website" chapter and the GitHub steps with the church's own link and the
  automatic setup (the Coming item "Set up in about a minute" moves to the list); refuse the countries above with the kind
  explanation; try it end to end once with a throw-away Google account and fix any wording Google has moved. Idea: a
  "Finish setting up" card on Administrators' Home that sees for itself what is done (care groups made, services added…).

**Public website** (`site/index.html`, first version 16 Nov 2026)
- ⬜ Move it to **churchandtrellis.com** (task 040): the domain opens the general public page; each church reaches the app through
  its own link and the one-time "Which church?" step. Then add a contact address and "Set up for my church" (once 021 works).
- ⬜ Rework the "prayer circle" wording – not yet satisfactory.
- ⬜ Coffee prices copy `js/coffee.js` (16 Nov 2026): refresh both together (`docs/PRICES.md`).
- ⬜ Keep it in step with the app: when a feature changes, change the website too.

**The subscription** – a coffee a month (or ten a year) at a suggested local price, per church, with gifts, paying for another
church, payment holidays whenever needed (monthly churches, no questions asked; annual payers switch to monthly) and praying
instead; built as the Subscription page (0.95–0.98; `docs/architecture/TARGET.md` 10.5, `docs/PRICES.md`). Nothing is ever
locked or deleted for being late. Still to do:
- ⬜ Open PayFast: the owner follows `docs/PAYFAST-SETUP.md` (PayFast account, the Cloudflare payment doorway, a sandbox test), then
  Claude sets `PAY_URL` in `js/coffee.js` and `PAY` in `site/index.html` to https://churchandtrellis.com/pay (one line each).
- ⬜ Match PayFast payments to churches' references (custom_str1; the office robot, task 063/067) – today the return from PayFast is
  taken on trust. Later, PayFast's payment notifications (ITN) to the doorway could confirm each payment.
- ⬜ Share prayer cards between churches through the office, so the prayer circle works outside the demo.
  The weekly card, the monthly reminder and the on/off switch are built (0.95.0); the office still has to collect each church's
  card (only the public card, `Coffee.publicCard`), let Church & Trellis's owner check new cards before they go out, and give every
  church the list. It can also keep a true history of who saw which card, so a joining church never causes an early repeat.
- ⬜ Refresh coffee prices twice a year, and the "start hidden" countries each January (`docs/PRICES.md`).
- ⬜ Ask an accountant: is subscription money taxable income for the owner (it is, unless a registered NPO/PBO receives it)?

**Decisions waiting**
- ⬜ Who receives the subscription money: personally, a company, or an NPO/PBO (task 059).
- ⬜ Which countries are on the "don't serve" list.

## One app, one feel ⬜ – later, after roster testing
**Decided (24 Nov 2026):** don't rewrite from scratch or change language; review and unify instead. The reasons, the plan
and the brief to paste into a Fable session are in `docs/architecture/COHESION-PLAN.md`.
- ⬜ **Architect (Fable):** review every page for where it disagrees with the others, write `docs/DESIGN-SYSTEM.md` (the standard
  building blocks and how the page themes apply), say which code is tangled, and write the tasks. No code changes.
- ⬜ **Implementer (Opus):** move the app onto the design system one page at a time, tests green after each pull request.
- ⬜ Rebuild only the parts the review finds genuinely tangled (perhaps `js/store.js` or `js/app.js`).

## Working method
One phase per fresh chat in the Claude Project "Church & Trellis", with the repository attached (Jules and Antigravity work here too – see AGENTS.md).
Update this file at the end of each session: finished work moves to `docs/CHANGELOG.md`.
