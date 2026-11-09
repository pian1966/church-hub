# Plan: Life groups / Bible studies / small groups (and switching each kind of group on or off)

Status: plan (Nov 2026); step 1 being built. The church's decisions are in **Decided** below.

## Decided (9 Nov 2026)
- Christ Church Howick keeps **care groups and adds life groups** – each kind switched on or off on its own.
- The new kind covers life groups, Bible studies and midweek meetings, so **each group's leaders name their own group**
  ("Tuesday Bible study", "Hilton life group"). The heading for the kind is set in Settings (Christ Church Howick: "Life groups").
- People may be in **several** life groups (as with care groups).
- **No new consent**: Church Partners already agreed, on becoming Partners, that their details are shared (the "Church directory"
  consent). A life group's member cards follow that consent; someone who hasn't given it shows by name only.
- The map shows the **exact meeting place** to everyone signed in. Whoever enters a host's home as the meeting place ticks
  that the host agreed to it being shown.

## What the church asked for
- A second kind of group beside care groups: Bible studies, small groups, life groups, midweek groups – the church
  chooses the name in Settings → Terminology (Church Words).
- Each group has a leader (or leaders), a host, and members – much like a care group. Ideally every Church Partner is in one.
- A map showing where each group meets (the host's address), so people can find a group near them.
- Leaders can message their group with the messages already inside the app.
- A church can switch care groups on or off, and switch the new groups on or off, separately.

## The main idea: one kind of record, two kinds of group
Care groups already do most of this: leaders and members, member cards shared only with consent, leaders adding and
removing people, messages to the group, "Suggest groups by where people live", the directory tag, the rules and the tests.
So the new groups are **care-group records with a type**, not a new system:

- `careGroups/{id}.type` = `'care'` (or missing – every existing group) or `'life'` (the new kind). `Store` hands them out as two
  lists (`careGroups` and `lifeGroups`), so the care-group code keeps seeing only care groups.
- Everything that works for care groups works for the new kind straight away: cards (`share/{person}`), messages
  (`kind: 'care'` with the group's id already works for any group in `careGroups`), the leaders' permissions, Suggest by area.
- Screens filter by type, so care groups and life groups each get their own page and their own wording.

Why not a separate collection: we would copy the rules, the cards, the message rules, the directory sync and the tests,
and every fix would have to be made twice. One code path stays safer.

## 1. Settings: names and switches
- **Settings → Groups** (new box, Administrators):
  - *Care groups* – On / Off.
  - *Life groups* – On / Off (off until switched on). Its name and its leaders' name are in Terminology (Church Words).
- Wording (`js/wording.js`): new terms `life` ['Life group', 'Life groups'] and `lifeLeader` ['Group leader', 'Group leaders'].
  The existing `care`/`carer` terms stay as they are.
- Switching a kind **off** hides: its page and menu entry, its card on Me, its tag on profiles and the People list, its
  message audiences, its Home to-dos, its consent line. Nothing is deleted – switching it back on brings everything back.
- The page switch already exists (`settings.modules[id] = false`, `js/app.js enabled()`); the new page is its own module
  (`id: 'life'`) so it can be switched off on its own. The Settings box also tidies the other places listed above.

## 2. Meeting details on each group
New fields on a group (the leaders may change them, as well as Administrators and Pastors):
```
meets: { day: 'Tuesday', time: '19:00', often: 'weekly' | 'fortnightly' | 'monthly',
         hostId: personId (optional), place: { street, street2, city, postcode },
         lat, lng, notes: 'Bring a Bible; childcare available' }
open: true        // taking new people (shown on Find a group); false = full or closed
```
- Choosing a **host** from the people list fills the place with the host's home address (can be changed – e.g. a group that
  meets at church or a coffee shop).
- Leaders may change `meets` and `open` (and, for life groups, the name), but still not the type or who leads (rules: add these fields to the
  leader's `onlyChanges` list; `Care.leaderMayChange` the same – tested).

## 3. The map
- **Leaflet** (free, small) with **OpenStreetMap** tiles. Kept in `assets/` rather than loaded from another website,
  so it works on the church's site without extra setup and the page itself works offline (the map tiles need internet).
- **Placing a pin**: when an address is saved, Church Hub asks OpenStreetMap's address search (Nominatim) once for that one
  address and stores `lat`/`lng` on the group. If it can't find it (common for estates and new streets), the leader
  drops the pin by tapping the map. Only the group's meeting place is ever looked up – never members' addresses.
- **What people see on the map**:
  - Everyone signed in: the exact pin and address (decided). Tapping a pin shows the group's name, day, time,
    how often, leaders' names, "Taking new people", and **Ask to join**.
- A list view under the map (sorted by suburb, or by distance if the person allows their phone's location for that
  moment – not stored).

## 4. Find a group and Ask to join
- Non-members can't read a group record today (the rules only let its members read it). So a small public summary is
  kept for each group that is taking people: `groupsOpen/{id}` = { type, name, day, time, often, address, lat/lng, leader names, open }. Written by Administrators, Pastors and the group's leaders whenever the group changes
  (like `directory/` is kept today). Readable by anyone signed in. Nothing personal except leaders' names.
- **Ask to join** writes `groupRequests/{id}` = { groupId, personId, name, note, createdAt }. The group's leaders (and
  Administrators and Pastors) see it as a Home to-do: **Add to the group** or **Not now** (with a kind message back).
  Rules: a person may create only their own request; leaders may read and delete the requests for their group.
- Me page: someone in no group of this kind sees a card **"Find a [Life group] near you"** which opens the map.

## 5. "Every Church Partner in a group"
- Home to-do for Administrators and Pastors: "12 Church Partners aren't in a [Life group]" → the list, with
  **Suggest groups by where people live** (the existing `Care.suggest`, run only over groups of this type). Later it can
  also use distance to each group's pin (the suburb's position, never the person's exact address).
- Church at a glance: how many Church Partners are in a group of each kind.

## 6. Messages
- Leaders can already write to their group: the Write page lists every group they lead, so new groups appear
  automatically, labelled with the church's word ("Life group: Hilton Tuesday"). Administrators and Pastors see all of them,
  grouped by kind.
- Later (with the Replies item in ROADMAP Phase 5): the group talking together.

## 7. Privacy (POPIA) – to add to docs/POPIA.md when built
- Purpose: fellowship and Bible study in small groups; finding a group to join.
- Member cards: follow the "Church directory" consent (agreed on becoming a Church Partner); without it, the name only.
- The meeting place: shown exactly to everyone signed in; the person entering a host's home ticks that the host agreed
  (recorded, in the audit log).
- Address search: only the meeting place is sent to OpenStreetMap, once, when it is saved – name it in the privacy notice.
- Join requests: kept until answered, then deleted.

## Build order (each step is its own release and pull request)
1. **Group types and switches** – `type` on groups, Settings → Groups, wording, the new page (a copy of the Care groups
   page filtered by type), switching each kind off everywhere. Tests: `care.test.js` (type filter), `wording.test.js`,
   `tests/app/care.js`.
2. **Meeting details and host** – `meets`, `open`, leaders may edit them; shown on the group page and on Me.
   Rules + `plan()` + fake-firebase POLICY + `rules.test.mjs` together.
3. **Find a group and Ask to join** – `groupsOpen`, `groupRequests`, the list, the Home to-dos, the Me card.
4. **The map** – Leaflet in `assets/`, placing pins (search, or tap the map), the "host agreed" tick.
5. **Every Church Partner in a group** – the to-do, Suggest by area per type, the figures on Church at a glance.
6. Later (Phase 4): attendance at each meeting, and a leader's short report after a meeting.
