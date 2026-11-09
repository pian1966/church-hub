# Church Hub – roadmap

Status key: 🟡 in progress · ⬜ planned. Only work still to do is listed here; finished work moves to `docs/CHANGELOG.md` (no need to read it).

## Phase 1 – Foundation 🟡 – built and live (pre-release v0.1.0, 25 Oct 2026); church trial and Leave Manager import next

**Church to do – setup**
- 🟡 Tidy Privacy (Information Officer name had a placeholder – fixed in code for future setups), record own consent, approve privacy notice, register the Information Officer
- ⬜ Confirm step 8 (key restricted to the website) is done
- ⬜ Switch on Email link sign-in in Firebase (Authentication → Sign-in method → Email/Password → both switches)
- ⬜ Settings → What others can see – choose what each role sees (name only until you do), and ask people to renew their Contact details consent under the new wording
- ⬜ Choose the Care groups ticks in Settings → Who can see what, and click **Record that they agreed** for existing Church Partners if it appears
- ⬜ Android app setup (docs/ANDROID.md): keep ChurchHub-ANDROID_KEYSTORE.txt safe and add it as the secret, build, optional Google sign-in (Web client ID), try it, send the link
- ⬜ Set up the robot (docs/ELVANTO-ROBOT.md steps 1–5), switch over with step 6
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

**Later (if wanted)**
- ⬜ Changes made offline, saved when back online (today offline is view-only); and a "shared computer – don't keep a copy" choice at sign-in
- ⬜ Leave: other countries' public holidays (Leave still uses South Africa's); Elvanto calendar events for staff leave (Leave Manager's optional extra, needs an Elvanto API key)
- ⬜ Leave Manager features still not in Church Hub (rechecked 5 Nov 2026; the wallchart, calendar, year planner, reports,
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
- ⬜ Save searches as smart lists; use them for emails and SMS
- ⬜ Ask in your own words: more kinds of questions (leave, care and midweek groups, messages), and save an asked question as a smart list

## Phase 3 – Rostering and services (built; follow-ups below)
Accept/decline by email and app, swap requests, reminders, sign-up sheets, run sheets / order of service, matrix across several services, Leave Manager switch-over (import sheet data).
- ⬜ Church: Rosters → Services – check each service's look, mood and positions (Teens/Children/Creche are 8am only, as in Elvanto); rename "Operational" to Service Leading if it was added before 0.29.0 (teams can't be renamed yet)
- ⬜ Decide: rename "Extra Slot" (e.g. Special Items, or Communion on its own and Features for Interview, Missions, Doctrine)
- ⬜ Later: rename a team, and rename a special service
- ⬜ Church: Rosters → Services – choose the departments and positions for each special service (they start empty, except Memorial Teas)
- ⬜ Later: a "See everything" map of services → departments → positions for the curious

## Phase 4 – Groups, attendance and check-in
Groups and attendance, kids check-in on a tablet with medical alerts and leader ratios, headcounts, volunteer check-in.
- ⬜ Life groups / Bible studies / small groups beside care groups, each kind switched on or off – full plan in `docs/GROUPS-PLAN.md`:
  1. ✅ done in 0.40.0 (see CHANGELOG); next: 2. meeting day, time and host; 3. Find a group and Ask to join; 4. a map of where
  groups meet; 5. a to-do so every Church Partner is in a group
- ⬜ Church: Settings → Apps – switch on **Life groups**, then add the groups and their leaders (leaders can rename them)
- ⬜ At sign-out, show "Not allowed to collect" and the allowed collectors

## Phase 5 – Communication and calendar
First step done (0.12.0): email prompts for birthdays, anniversaries and welcomes, opened in the church’s email program. Next: sending them automatically (formatted, with the church logo) through Afrihost or Gmail behind the scenes; then email (consent-aware, with opt-out, never to people who have died or left), SMS via a South African provider, app notifications, church calendar and website embeds.
Messages inside the app done (0.21.0, Messages page). Next for messages:
- ⬜ Phone notifications ("push") when a message arrives, even with Church Hub closed: Firebase Cloud Messaging in the
  Android app and the home-screen app (iPhone: iOS 16.4 or later, added to the home screen), sent by a small server step
  (a Firebase Cloud Function on the Blaze plan, or the GitHub robot with a service-account secret). Ask permission
  kindly after sign-in; a switch on Me to turn them off.
- ⬜ Email (and later SMS) for people who can't sign in yet or haven't opened a message after a day – consent-aware
- ⬜ Replies: a member replies to the sender, or a care group talks together (decide which first)
- ⬜ Decide how long messages are kept (e.g. 2 years) and add them to Privacy → Retention

## Phase 6 – Member app and extras
Church Center-style member app (first part done: Me + Android app, Oct 2026), Elvanto API import (groups, departments), NFC tags, AI help, leadership insights.

## Phase 7 – Church Hub for other churches (hosted, gift-based) ⬜
Goal: any church can start using Church Hub in minutes, with no Firebase, Google console or anything technical. We host it;
each church gives what it chooses once a year, with a small minimum. Today each church makes its own Firebase project
(`FIREBASE-SETUP.md`); Christ Church Howick keeps working that way until it moves across (step 7.9).

**What a church does (the target)**
1. Goes to the Church Hub website → "Start using Church Hub for my church" → church name, country, their email.
2. Opens the sign-in link in their email and becomes that church's first Administrator; the existing setup screen follows
   (services, leave rules, terminology, language).
3. Brings people in: Elvanto export, a spreadsheet, or by hand.
4. Invites staff by email and chooses each one's role; then shares the link (or the Android app) with members.
5. Gives the yearly gift (minimum or more). A year later: a gentle reminder to reconsider the amount.

**Steps to build (each a small pull request)**
- ⬜ 7.1 One database for many churches: every record belongs to a church (`churches/{churchId}/…`); `firestore.rules`,
  `plan()` in `js/store.js`, `tests/fake-firebase.js` and `tests/rules.test.mjs` changed together so nobody can ever read
  another church's data. Tests must prove it (a person in church A, signed in, gets nothing from church B).
- ⬜ 7.2 Regions: a project per region so data stays near the church (Johannesburg `africa-south1` first; Europe for GDPR
  next; the Americas later). The country chosen at sign-up picks the region.
- ⬜ 7.3 Sign-up page: create a church, first Administrator by email link, the setup screen; stop the same church signing up
  twice (name + country + email check); a short "Is this your church?" if a similar name exists.
- ⬜ 7.4 Terms of use and the operator agreement: we become the "operator" (POPIA) / "processor" (GDPR) for every church.
  Written terms each church accepts at sign-up, a data-processing agreement, breach steps (we tell the church, the church tells
  its regulator), what happens to a church's data if it leaves (download everything, then deleted within 30 days).
  Get a lawyer to look at these once before the first other church joins.
- ⬜ 7.5 Safety before hosting others: daily backups (Firestore export or point-in-time recovery – needs the paid Blaze plan),
  two-step sign-in for Administrators, a spending limit and alerts on the Google account, an independent security review of the rules.
- ⬜ 7.6 Elvanto robot for many churches: each church's Elvanto key kept in Google Secret Manager (never in GitHub or the
  database); one robot run works through every church that switched it on.
- ⬜ 7.7 Countries we don't serve: no sign-up from countries where a church member list could put people in danger
  (for example China – where Google services are blocked anyway – North Korea, Iran, Eritrea, Afghanistan). Explain kindly why,
  rather than a bare refusal. Church Hub is not end-to-end encrypted: we, Google and anyone able to compel either could read the data.
- ⬜ 7.8 Gifts and reminders (see "The yearly gift" below): pay page, receipts, the yearly reminder (email + a note on the
  Administrator's Home), a church's gift history under Settings, and a page for us listing churches and gifts.
- ⬜ 7.9 Move Christ Church Howick across (export from its own project, import into the shared one), then retire the single-church setup guide.
- ⬜ 7.10 A simple public website: what Church Hub does, the demo, languages, privacy and safety, how the gift works, sign up.

**The yearly gift**
- Minimum: the price of **one Big Mac in the church's country**, from The Economist's Big Mac index (published twice a year,
  free data). Countries not in the index use the nearest neighbour or the US price converted. A Big Mac (R54.90 in South Africa,
  US$6.12 in the USA, January 2026) is chosen over a McDonald's coffee because card fees take a much smaller share of it, and
  the index gives an official, regularly updated list instead of one we keep by hand.
- Suggested amount shown beside the minimum, by size (for example one Big Mac per 10 adults on the church's list); the church
  can type any amount at or above the minimum.
- Paid once a year in the church's own currency. Payment provider to decide: Paystack (South Africa: 2.9% + R1 + VAT per card
  payment) or Stripe/Paddle for other countries; never store card details ourselves.
- The reminder, a year after each gift: what Church Hub did for them that year (people, rosters, leave days handled), the
  scriptures ("The worker deserves his wages" – Luke 10:7, 1 Timothy 5:18; "Do not muzzle the ox while it is treading out the
  grain" – Deuteronomy 25:4, 1 Corinthians 9:9), last year's gift, and a button to give again or change the amount.
- If a church doesn't give: reminders for 60 days, then read-only (they can still see and download everything), never deleted
  without warning. A church in hardship can ask for the minimum to be waived.
- Tax: gifts for using software are income to whoever runs Church Hub, not a tax-deductible donation, unless it is run by a
  registered NPO/PBO. Decide the structure (and ask an accountant) before the first payment.

**Decisions waiting**
- ⬜ Who runs it: personally, a company, or an NPO/PBO.
- ⬜ The suggested amount by size, and whether the minimum is per church or per site.
- ⬜ Which countries are on the "don't serve" list.

## Working method
One phase per fresh chat in the Claude Project "Church Hub", with the repository attached (Jules and Antigravity work here too – see AGENTS.md).
Update this file at the end of each session: finished work moves to `docs/CHANGELOG.md`.
