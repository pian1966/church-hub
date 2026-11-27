# Plan: Pastoral visits – who was visited, when, where, and what the pastors see

Status: planned (27 Nov 2026), nothing built yet. Asked for by the Rector on 27 Nov 2026. A module `visits`
(`js/mod-visits.js`, rules file `js/visits.js` – pure and tested), off until an Administrator switches it on in
**Settings → Apps**. Handover: `docs/architecture/handover/visits-opus.md` (rules and data) and `visits-sonnet.md` (screens and map).
All questions are decided; made-up demo data only (the repository is public – no real people, notes, addresses or places).

It **builds on the Care board, Seriously ill list and Visit notes** in `docs/ROADMAP.md` (Phase 2): those visit notes become
records in this one system, not a second one. Whoever builds either must read both.

## The idea
Care Group leaders, staff, Council members and appointed pastoral care workers record **who they visited, when and where, with a
note**. The Rector, pastors and pastoral staff see the whole picture at a glance: on a **map**, in a few **graphs**, and on each
person's **Care tab**. Nobody falls through the cracks, and the pastoral load is shared and visible.
1. **Recording takes about 30 seconds**, works offline, saves automatically (no Save button).
2. One **Pastoral care** page: cards, a map, a few graphs, "who needs a visit".
3. Each person's page gets a **Care tab**: a timeline of every visit to them.
4. Notes are private by default; each note has a level.

## Who can record
- **Care Group leaders**: visits to people in their own Care Group.
- **Staff** (Administrators, Pastors, Roster coordinators, Children's ministry): anyone.
- **Council members**: may record their own visits and see those; otherwise totals only.
- **Pastoral care workers**: a new appointed role (job `carers` in `js/access.js`). Pastors and Administrators appoint them in
  Settings and choose, per person, whether they cover the whole church or only certain Care Groups or people.
- Members and attendees: nothing.

## Who sees what (decided)
- Each visit has **the fact** (who, when, where, by whom) and **the note**, which has a level chosen by the visitor:
  1. Shared with the pastoral team (default) · 2. Care Group leader and pastors · 3. Pastors only (all pastors).
- **Pastors and pastoral staff** (Rector, assistant ministers, anyone the Rector adds): every fact and every note.
- **Care Group leader**: the fact of every visit to their group's people; notes at levels 1 and 2 written by **non-pastors**.
  **Never** a note written by a pastor (store the writer's role on the visit so the rules can enforce this).
- **The visitor**: their own visits and notes.
- **Church secretary** (the extra person set in Settings): the seriously ill list and visit dates; notes only at a level that includes them.
- **Council**: totals and graphs only (counts, coverage) – no names, no notes. A Council member sees what they wrote as the visitor.
- Members and attendees: nothing.

## Recording a visit (one short form)
- **Who**: search-as-you-type (`js/people-search.js`) for a person or household; for a household, tick who was there.
- **When**: now by default; date and optional time.
- **Where**: Home, Hospital, Care home, Work, Church, Phone call, Video call, Other. The home address comes from the household.
  Hospitals and care homes come from a **saved places list** the pastors keep (one tidy pin per hospital). An optional **"I'm here"**
  button captures the phone's position (for places with no address – townships, farms, informal settlements); store plain latitude and
  longitude decimals, as addresses already do (`gpsOf` in `js/households.js`). "Not known" is a choosable answer.
- **Visited by**: you by default; add others who came along. For a visit to a child or vulnerable adult, prompt "Was a second adult
  present?" (a prompt, not a block; recorded on the visit).
- **Kind**: Visit, Hospital visit, Prayer, Communion at home, Bereavement, Newcomer, Welfare, Phone call.
- **Note** and its level. **Follow-up** (optional): a date and "needs" (meal, lift, groceries, prayer, counselling) which can feed the
  Care board and send a Message to the Care Group leader(s).
- For someone on the Seriously ill list: the same form plus condition and special requests, as already decided there.

## What the pastors see
**Pastoral care home** (its own unique soft-watercolour theme):
- Cards: *Visited this month* · *Follow-ups due* · *Seriously ill* · *Not visited in a while* (the church chooses how many months).
- **Map** (**OpenStreetMap**, decided): a pin per visit or household; colour **and** icon show how recent the last visit was (never colour
  alone); filters for dates, visitor, Care Group, kind, seriously ill only; tap a pin for who, last visit, by whom, and the note if its
  level allows; a **Gaps** layer of households with no visit in the chosen period; **Plan a round** (pick households, open the route in
  Google or Apple Maps); an Administrator setting to show **area-only pins** or **switch the map off** (churches under pressure).
- **Graphs**: visits per month (by kind); a **coverage ring** ("78% of households visited in the last 12 months", also by Care Group);
  **load by visitor** (who carries the most); a **care timeline** per person (dots on a line, hospital stays and follow-ups marked).
- **Person's Care tab**: the timeline of visits to them.
- **Care Group leaders** get **My group**: each person with "last visited 3 weeks ago" and a one-tap *I visited*.

## Reminders and Church health
- Messages: a follow-up due nudges the visitor; overdue tells the Care Group leader; "not visited in N months" nudges the Care Group
  leader (N a setting, off per group if wanted); a seriously ill person with no visit for a week tells the pastors and leader.
- **Church health**: households not visited in 12 months, overdue follow-ups, seriously ill without a recent visit, visits with no place or date.

## Privacy, safety and POPIA
- Health and religious information about people = special personal information. Never in the public repo, never in chat, never shared
  with third parties. Read `docs/POPIA.md`; add a section "Pastoral visits".
- **Consent**: told at sign-up and in the Church directory consent that pastoral visits are recorded and who may see them. A person may
  ask what is recorded about them and ask for deletion (the roadmap promise), except what safeguarding requires the church to keep.
- **Retention (decided)**: notes kept while the person is a member, then archived for a period an Administrator sets, unless the person
  asks for deletion.
- Nothing is silently deleted: a mistake is **voided** with a reason; Undo and Version history cover visits and notes (`History.COVER`).
- The rules (not only the screens) enforce who sees what.

## The map and data-saving
- **OpenStreetMap** tiles with a small open-source library (Leaflet, vendored in the repo, not loaded from a third-party CDN, so nothing
  is sent to a third party except the tile requests themselves). Show the required attribution; respect the OSM tile usage policy (no
  bulk downloading, a proper Referer, caching); note in the docs that a large church should move to a paid tile provider.
- Tiles load only when the map is opened; cached for offline. No API key, so nothing secret in the public repo.
- Visits and notes are saved on the phone and sent when there is signal.

## Ties with the rest of the app
Care board / Seriously ill list (same records) · Messages · People and households (addresses and lat/long, couple-address checks) ·
Birthdays and anniversaries (a "bereavement" or "new baby" kind can prompt a visit) · Usage dashboard · Undo and Version history · setup
tool (`GROW` step: switch on Pastoral visits, appoint pastoral care workers, choose the not-visited-in-a-while level, choose whether the
map is shown) · What's new · public website, slideshow and brochures (generic wording, no mention of other systems).

## Data shape (Opus refines)
- `visits/{id}`: `who` (person and/or household ids), `present` (ids), `at` (date/time), `kind`, `place` (saved place id or address),
  `lat`, `lng` (optional), `by` (ids), `note`, `noteLevel` 1|2|3, `writerRole` ('pastor'|'other'), `followUp` (date), `needs`,
  `secondAdult` (true|false|absent), `voided` ({by, reason} or absent), `createdBy`, `createdAt`.
- `visitPlaces/{id}`: `name`, `kind` ('hospital'|'care home'|'other'), `lat`, `lng`.
- Settings: `carers` (person ids and scope), `visitsMonths` (not-visited-in-N-months), `visitsMap` ('on'|'area'|'off'), `visitsKeep` (archive period).

## Out of scope for now
Counselling case notes (a separate, more protected system), prayer requests (already in the prayer features), and anything with real
names or addresses in the repository.
