# Church Hub – roadmap

Status key: 🟡 in progress · ⬜ planned. Only work still to do is listed here; finished work moves to `docs/CHANGELOG.md` (no need to read it).

## Phase 1 – Foundation 🟡 – built and live (pre-release v0.1.0, 25 Oct 2026); church trial and Leave Manager import next
- 🟡 Church to do: tidy Privacy (Information Officer name had a placeholder – fixed in code for future setups), record own consent, approve privacy notice, register the Information Officer
- ⬜ Confirm step 8 (key restricted to the website) is done
- ⬜ Church: re-publish the rules (FIREBASE-SETUP step 7) so Church Partners can ask for changes to their family details
- ⬜ Decide: should Church Partners who aren't staff stop receiving colleagues' away dates at all (now hidden on screen only)?
- ⬜ Church: fill in Leave → Settings (terms, allowances) and mark staff; try Leave alongside the old Leave Manager
- ⬜ Church: Android app setup (docs/ANDROID.md): keep ChurchHub-ANDROID_KEYSTORE.txt safe and add it as the secret, build, optional Google sign-in (Web client ID), re-publish rules, try it, send the link
- ⬜ Church: fluent speakers check the isiZulu and isiXhosa (js/i18n/*.js – one line per text); then decide whether to translate
  staff screens too
- ⬜ Church: switch on Email link sign-in in Firebase (Authentication → Sign-in method → Email/Password → both switches)
- ⬜ Later: other countries' public holidays for Leave (Leave still uses South Africa's); translations checked by fluent
  speakers; church wording in the other languages too.
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
