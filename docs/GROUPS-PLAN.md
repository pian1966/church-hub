# Plan: Life groups / Bible studies / small groups (and switching each kind of group on or off)

Status: plan, nothing built yet (Nov 2026). Decisions still open are marked **Decide**.

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

- `careGroups/{id}.type` = `'care'` (or missing – every existing group) or `'small'` (the new kind).
- Everything that works for care groups works for the new kind straight away: cards (`share/{person}`), messages
  (`kind: 'care'` with the group's id already works for any group in `careGroups`), the leaders' permissions, Suggest by area.
- Screens filter by type, so care groups and life groups each get their own page and their own wording.

Why not a separate collection: we would copy the rules, the cards, the message rules, the directory sync and the tests,
and every fix would have to be made twice. One code path stays safer.

## 1. Settings: names and switches
- **Settings → Groups** (new box, Administrators):
  - *Care groups* – On / Off.
  - *Small groups* – On / Off, with a quick choice of name: Life group, Bible study, Small group, Midweek group,
    Home group, Connect group, or type your own (singular and plural), plus the leader's name (Group leader, Bible study
    leader…) and whether groups have a **Host**.
- Wording (`js/wording.js`): new terms `small` ['Small group', 'Small groups'], `smallLeader` ['Group leader', 'Group leaders'],
  `host` ['Host', 'Hosts']. The church-type sets get sensible defaults (Baptist: Small group, Pentecostal: Connect group…).
  The existing `care`/`carer` terms stay as they are.
- Switching a kind **off** hides: its page and menu entry, its card on Me, its tag on profiles and the People list, its
  message audiences, its Home to-dos, its consent line. Nothing is deleted – switching it back on brings everything back.
- The page switch already exists (`settings.modules[id] = false`, `js/app.js enabled()`); the new page is its own module
  (`id: 'groups'`) so it can be switched off on its own. The Settings box also tidies the other places listed above.

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
- Leaders may change `meets` and `open`, but still not the name, the type or who leads (rules: add these fields to the
  leader's `onlyChanges` list; `Care.leaderMayChange` the same – tested).

## 3. The map
- **Leaflet** (free, small) with **OpenStreetMap** tiles. Kept in `assets/` rather than loaded from another website,
  so it works on the church's site without extra setup and the page itself works offline (the map tiles need internet).
- **Placing a pin**: when an address is saved, Church Hub asks OpenStreetMap's address search (Nominatim) once for that one
  address and stores `lat`/`lng` on the group. If it can't find it (common for estates and new streets), the leader
  drops the pin by tapping the map. Only the group's meeting place is ever looked up – never members' addresses.
- **What people see on the map**:
  - Members of a group, its leaders, Administrators and Pastors: the exact pin and address.
  - Everyone else (Church Partners looking for a group): an **approximate** circle (about 500 m) and the suburb only,
    unless the host has agreed to show their address (**Decide**). Tapping a pin shows the group's name, day, time,
    how often, leaders' names, "Taking new people", and **Ask to join**.
- A list view under the map (sorted by suburb, or by distance if the person allows their phone's location for that
  moment – not stored).

## 4. Find a group and Ask to join
- Non-members can't read a group record today (the rules only let its members read it). So a small public summary is
  kept for each group that is taking people: `groupsOpen/{id}` = { type, name, day, time, often, suburb, approximate
  lat/lng, leader names, open }. Written by Administrators, Pastors and the group's leaders whenever the group changes
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
- Member cards: **Decide** – share the existing "Care group" consent for both kinds, or a separate "Small group" consent.
  Recommended: a separate consent, because people often join a Bible study with people they don't know yet, and the
  card shows phone, email and home address.
- The host's address: shown exactly only to the group, Administrators and Pastors, unless the host agrees to show it to
  everyone signed in; otherwise an approximate circle. The host's agreement is a consent, recorded and in the audit log.
- Address search: only the meeting place is sent to OpenStreetMap, once, when it is saved – name it in the privacy notice.
- Join requests: kept until answered, then deleted.

## Build order (each step is its own release and pull request)
1. **Group types and switches** – `type` on groups, Settings → Groups, wording, the new page (a copy of the Care groups
   page filtered by type), switching each kind off everywhere. Tests: `care.test.js` (type filter), `wording.test.js`,
   `tests/app/care.js`.
2. **Meeting details and host** – `meets`, `open`, leaders may edit them; shown on the group page and on Me.
   Rules + `plan()` + fake-firebase POLICY + `rules.test.mjs` together.
3. **Find a group and Ask to join** – `groupsOpen`, `groupRequests`, the list, the Home to-dos, the Me card.
4. **The map** – Leaflet in `assets/`, placing pins (search, or tap the map), approximate circles, the host's consent.
5. **Every Church Partner in a group** – the to-do, Suggest by area per type, the figures on Church at a glance.
6. Later (Phase 4): attendance at each meeting, and a leader's short report after a meeting.

## Decisions for the church
1. Does Christ Church Howick want the new kind as well as care groups, or will the life groups *be* the care groups?
   (Either works: switch care groups off and use only the new kind, or keep both.)
2. One consent for both kinds of group, or a separate one (recommended: separate)?
3. On the map, may people who aren't in the group see the host's exact address if the host agrees, or always only the
   approximate area?
4. Name for Christ Church Howick: Life group, Bible study, Small group, or something else?
