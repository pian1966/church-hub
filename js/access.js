/*
 * Church & Trellis – who can see what, and what each kind of person can do: the one place.
 *
 * Before this file the same lists were kept in several places (js/app.js, js/messages.js, js/mod-settings.js,
 * js/people/core.js, js/store.js). They are all here now, and those files read them from Access.
 * The database rules (firestore.rules) and their copy for the browser test (tests/fake-firebase.js) can't load a
 * JavaScript file, so tests/access.test.js checks that their lists still match the ones here.
 *
 * Kinds of person (KINDS): the five kinds of app access (ROLES) – with Basic access split into Church Partners and
 * attendees, decided by the person's category – plus jobs a person has in one part of the app (JOBS, e.g. keepers).
 *
 * A NEW PART OF THE APP plugs in here, with one entry in PARTS: its permission names (who has each by default) and the
 * jobs in it – instead of keeping its own access settings. Hub.can('<part>.<what>') then answers for it.
 * A part marked `soon` is a placeholder: named, with its permissions, rules section and words ready, but not built and not
 * shown to anyone yet. Remove `soon` when the part is built (the Community board and the Marketplace were built in 0.97.0).
 *
 * Pure: no DOM, no Store. Tested with node: tests/access.test.js.
 */
var Access = (function () {
  'use strict';
  var TX = function (s) { return s; };   // a text kept in a list, translated where it is shown (the language test checks it)

  /* ---------- the five kinds of app access (roles/{email}.role; firestore.rules isRole) ---------- */
  // label: as shown; can: one line for Settings → Who can see what; perms: what the screens allow ('*' = everything,
  // except RESTRICTED below).
  var ROLES = {
    admin: { label: 'Administrator', can: TX('Everything, including Privacy, Import and Settings – except pastoral and medical notes'), perms: ['*'] },
    pastor: { label: 'Pastor', can: TX('People, households, pastoral notes, children'), perms: ['people.view', 'people.edit', 'notes', 'children', 'rosters.view', 'care.view'] },
    rosters: { label: 'Roster coordinator', can: TX('Rosters and teams; names and contact details only'), perms: ['people.basic', 'rosters.manage', 'rosters.view'] },
    kids: { label: 'Children’s ministry', can: TX('Children, guardians and medical notes'), perms: ['people.basic', 'children', 'medical', 'rosters.view'] },
    member: { label: 'Basic access', can: TX('Their own details, serving and leave; the church directory'), perms: [] },
    none: { label: 'No access (can’t sign in)', can: TX('Can’t sign in (kept on the church records only)'), perms: [] }
  };
  /** The roles stored on an access-list entry, in order (firestore.rules okRoles). */
  var ROLE_IDS = ['admin', 'pastor', 'rosters', 'kids', 'member'];
  /** The roles that are on the staff (firestore.rules staff()). */
  var STAFF_ROLES = ['admin', 'pastor', 'rosters', 'kids'];
  /** POPIA: children's medical notes are for Children's ministry only and pastoral notes for Pastors only –
   *  not even Administrators see them (the database rules enforce the same). */
  var RESTRICTED = ['medical', 'notes'];

  /** Kinds of person, as Settings and the parts below speak of them. Basic access is two kinds: Church Partners (and staff,
   *  by their category) and attendees (everyone else on Basic access). */
  var KINDS = ['admin', 'pastor', 'rosters', 'kids', 'partner', 'attendee'];
  /** Everyone who signs in except attendees, and everyone. */
  var NOT_ATTENDEES = ['admin', 'pastor', 'rosters', 'kids', 'partner'], EVERYONE = KINDS.slice();
  /** The kind of person: a role, or for Basic access 'partner' / 'attendee'. */
  function kindOf(role, attendee) { return STAFF_ROLES.indexOf(role) >= 0 ? role : attendee ? 'attendee' : 'partner'; }

  /* ---------- What Pastors can do (Settings; settings.pastorCan, and the Senior Pastor's settings.seniorCan) ---------- */
  // Each tick: [id, what it allows, the screen permissions it adds]. Church & Trellis copies the ticks onto each Pastor's
  // access-list entry ("can"), and firestore.rules checks them there with may('<id>').
  var ABILITIES = [
    ['settings', TX('Change the church’s settings'), ['settings.manage']],
    ['access', TX('Give and take away app access (Basic access, Roster coordinator, Children’s ministry)'), ['access.manage']],
    ['people', TX('Check changes members ask for, move people to the Bin and delete their information'), ['people.delete', 'people.changes']],
    ['idnumbers', TX('See and change ID numbers'), ['idnumbers']],
    ['leave', TX('Approve leave, book leave for others and change the leave settings'), ['leave.manage']],
    ['rosters', TX('Manage rosters, teams and services'), ['rosters.manage']],
    ['privacy', TX('Privacy: requests, breaches, the audit log, exporting someone’s data'), ['privacy.manage']],
    ['import', TX('Import from Elvanto and Leave Manager, and the Elvanto robot'), ['import.manage']],
    ['words', TX('Approve better wording in every language'), ['words.manage']]
  ];
  function abilityIds() { return ABILITIES.map(function (a) { return a[0]; }); }
  /** The ticks of one Pastor: the Senior Pastor's own (seniorCan) once one is chosen, otherwise the other Pastors' (pastorCan). Sorted. */
  function pastorTicks(settings, pid) {
    var st = settings || {}, senior = !!pid && !!st.seniorPastorId && st.seniorPastorId === pid;
    return ((senior ? st.seniorCan : st.pastorCan) || []).slice().sort();
  }
  /** The screen permissions those ticks give. */
  function abilityPerms(ticks) {
    var out = [];
    ABILITIES.forEach(function (a) { if ((ticks || []).indexOf(a[0]) >= 0) out = out.concat(a[2]); });
    return out;
  }

  /* ---------- Attendees (Settings → Attendees; settings.attendeeCan) ---------- */
  // What people on Basic access who aren't Church Partners (or staff) may see and do. [id, what, more]
  var ATTENDEE_ROWS = [
    ['names', TX('See the names of Church Partners'), TX('Names only, on the People page – no photos, phone numbers or addresses.')],
    ['directory', TX('See the church directory'), TX('As Church Partners see it: photos and the contact details people agreed to share.')],
    ['write', TX('Write to the Office, the ministers and their Midweek Group leaders'), TX('A message to one of them. They can also reply to a minister.')],
    ['reply', TX('Reply to any message sent to them'), TX('Otherwise they only read the messages the church sends them.')]
  ];
  var ATTENDEE_OPTIONS = ATTENDEE_ROWS.map(function (r) { return r[0]; });
  /** When the church hasn't chosen: Church Partners' names, and writing to the Office, the ministers and Midweek Group leaders. */
  var ATTENDEE_CAN = ['names', 'write'];
  function attendeeCan(settings) { var c = (settings || {}).attendeeCan; return Array.isArray(c) ? c.filter(function (x) { return ATTENDEE_OPTIONS.indexOf(x) >= 0; }) : ATTENDEE_CAN.slice(); }

  /* ---------- Who can see what (Settings: contact details and Care Groups; settings.seeOthers, seeCare, seeCareOwn) ---------- */
  // The kinds of access whose view of other people Settings chooses (Administrators and Pastors always see everything).
  var TIERS = [['member', TX('Church Partners')], ['rosters', TX('Roster coordinator')], ['kids', TX('Children’s ministry')]];
  /** May this role see all the Care Groups (settings.seeCare), or – Church Partners – their own group (seeCareOwn, on unless switched off)? */
  function seesCare(settings, role) {
    var st = settings || {};
    return (st.seeCare || []).indexOf(role) >= 0 || (role === 'member' && st.seeCareOwn !== false);
  }

  /* ---------- jobs in one part of the app ---------- */
  // A job is given to chosen people (by person id), not to a kind of access. Settings keeps who has it, per part:
  // settings.<key>.<part> = [person ids]. Until the church chooses, `defaults` decides.
  var JOBS = {
    // Keepers check notices and listings before anyone else sees them (docs/COMMUNITY-PLAN.md, "Keepers"). Decided
    // 19 Nov 2026: at first the pastors, the Administrators and the church secretary (the extra person who hears about
    // roster replies, settings.rosterExtra); the Administrator can add or remove keepers. A keeper must be a Church
    // Partner or on the staff.
    keepers: { key: 'keepers', label: TX('Keepers'), one: TX('Keeper'), parts: ['board', 'market'],
      defaults: function (st, people) {
        return people.filter(function (p) { return p.appRole === 'admin' || p.appRole === 'pastor'; }).map(function (p) { return p.id; })
          .concat(st.rosterExtra || []);
      } },
    // Event organisers put events up, see who's coming and write to them (docs/COMMUNITY-PLAN.md part 1). Until the church
    // chooses: the Administrators, the Pastors and the church secretary (the Office), as for keepers.
    organisers: { key: 'organisers', label: TX('Event organisers'), one: TX('Event organiser'), parts: ['events'],
      defaults: function (st, people) {
        return people.filter(function (p) { return p.appRole === 'admin' || p.appRole === 'pastor'; }).map(function (p) { return p.id; })
          .concat(st.rosterExtra || []);
      } }
  };
  /** The people (ids) with a job in a part: chosen in Settings, or the defaults. people: active people only, as the caller sees them. */
  function jobHolders(job, part, settings, people) {
    var j = JOBS[job]; if (!j || j.parts.indexOf(part) < 0) return [];
    var st = settings || {}, chosen = (st[j.key] || {})[part], ps = people || [];
    var ids = Array.isArray(chosen) ? chosen.slice() : j.defaults(st, ps);
    var known = {}; ps.forEach(function (p) { known[p.id] = 1; });
    return ids.filter(function (id, i) { return known[id] && ids.indexOf(id) === i; });
  }

  /* ---------- the parts of the app, and the permissions each adds ---------- */
  // id: the Hub.register id; name, desc: as in Settings → Apps; optIn: off until an Administrator switches it on;
  // soon: a placeholder (not built – never shown); perms: { name: { kinds: who has it, ability: or Pastors with this tick,
  // job: or the people with this job in this part } }; settings: the keys in settings/church it keeps its choices in.
  var PARTS = [
    { id: 'board', name: TX('Community board'), desc: TX('Pin notices and offers of help – a keeper checks each one first'), optIn: true,
      perms: {
        'board.view': { kinds: NOT_ATTENDEES },    // attendees: a tick in Settings → Attendees may be added (decision waiting)
        'board.post': { kinds: NOT_ATTENDEES },
        'board.keep': { kinds: [], job: 'keepers' }
      },
      settings: ['keepers.board', 'boardNote'] },
    { id: 'market', name: TX('Marketplace'), desc: TX('Buy, sell and give away within the church – a keeper checks each listing first'), optIn: true,
      perms: {
        // Decided 19 Nov 2026: Church Partners only – attendees never see it, whatever Settings → Attendees says
        'market.view': { kinds: NOT_ATTENDEES },
        'market.post': { kinds: NOT_ATTENDEES },
        'market.keep': { kinds: [], job: 'keepers' }
      },
      settings: ['keepers.market', 'marketRules'] },
    { id: 'events', name: TX('Events'), desc: TX('Church events people sign up for, with reminders 3 days and 1 day before'), optIn: true,
      perms: {
        'events.view': { kinds: EVERYONE },          // attendees see only the events meant for everyone (js/events.js sees)
        'events.organise': { kinds: [], job: 'organisers' },
        // 20 Nov 2026: anyone on the staff (and the organisers) may see who's coming and add people – e.g. from a paper sign-up sheet
        'events.add': { kinds: STAFF_ROLES.slice(), job: 'organisers' }
      },
      settings: ['organisers.events'] },
    { id: 'prayer', name: TX('Pray for the nations'), desc: TX('A country to pray for each day, from Operation World'), optIn: true,
      perms: {
        // Everyone who signs in, attendees too: it only shows Operation World's own page, and nothing about anyone is kept
        'prayer.view': { kinds: EVERYONE }
      },
      settings: [] },
    { id: 'support', name: TX('Subscription'), desc: TX('A coffee a month keeps Church & Trellis going'),
      perms: {
        // As before: Administrators, and Pastors with the "settings" tick
        'support.manage': { kinds: ['admin'], ability: 'settings' }
      },
      settings: ['subscription', 'prayerCard', 'prayerCards'] }
  ];
  function part(id) { return PARTS.filter(function (x) { return x.id === id; })[0] || null; }
  function partOfPerm(perm) { var id = String(perm || '').split('.')[0]; var p = part(id); return p && p.perms[perm] ? p : null; }
  /** The permission names every part adds (for the tests, and for "is this a part's permission?"). */
  function isPartPerm(perm) { return !!partOfPerm(perm); }
  function partPerms() { var out = []; PARTS.forEach(function (p) { out = out.concat(Object.keys(p.perms)); }); return out; }
  /**
   * May this person do this in a part? who = { kind (kindOf), ticks (a Pastor's ticks), id (their person id),
   * settings, people (for jobs) }. Returns null for a permission no part adds (the caller decides as before).
   */
  function allows(perm, who) {
    var p = partOfPerm(perm); if (!p) return null;
    var rule = p.perms[perm], w = who || {};
    if ((rule.kinds || []).indexOf(w.kind) >= 0) return true;
    if (rule.ability && w.kind === 'pastor' && (w.ticks || []).indexOf(rule.ability) >= 0) return true;
    if (rule.job && w.id) {
      if (w.kind === 'attendee') return false;   // a keeper must be a Church Partner or on the staff
      return jobHolders(rule.job, p.id, w.settings, w.people).indexOf(w.id) >= 0;
    }
    return false;
  }

  /* ---------- Settings → Access and roles: what each kind of person sees and can do, in plain words ---------- */
  // One card per kind of person (KINDS, with the Senior Pastor apart when one is chosen), worked out from the settings, so the
  // words always match what the database rules allow. Each line is { t: text (translated where shown), list: [texts to join
  // into {list}] }. share: the contact details Settings can tick, as [[id, label]] (js/people/core.js SHARE).
  function line(t, list) { return list ? { t: t, list: list } : { t: t }; }
  function contacts(st, tier, share) {
    var on = ((st.seeOthers || {})[tier] || []), labels = (share || []).filter(function (f) { return on.indexOf(f[0]) >= 0; }).map(function (f) { return f[1]; });
    return labels.length ? line(TX('In the church directory: their name, photo and {list}'), labels) : line(TX('In the church directory: names and photos only'));
  }
  function abilityLines(ticks) { return ABILITIES.filter(function (a) { return (ticks || []).indexOf(a[0]) >= 0; }).map(function (a) { return line(a[1]); }); }
  /** The kinds shown on the page, in order: the Senior Pastor only when one is chosen. */
  function overviewKinds(settings) { var st = settings || {}; return ['admin'].concat(st.seniorPastorId ? ['senior'] : []).concat(['pastor', 'rosters', 'kids', 'partner', 'attendee']); }
  /** { see: [lines], can: [lines] } for one kind: 'admin', 'senior', 'pastor', 'rosters', 'kids', 'partner', 'attendee'. */
  function summary(kind, settings, share) {
    var st = settings || {}, see = [], can = [], mods = st.modules || {}, careAll = st.seeCare || [];
    var careSee = function (tier) { if (careAll.indexOf(tier) >= 0) see.push(line(TX('Every Care Group and who is in it'))); };
    if (kind === 'admin') {
      see.push(line(TX('Everyone’s details and every part of Church & Trellis')), line(TX('Not pastoral notes or children’s medical notes')));
      can.push(line(TX('Everything, including Settings, Privacy, Import and who has access')));
    } else if (kind === 'pastor' || kind === 'senior') {
      see.push(line(TX('Everyone’s details, households and children')), line(TX('Pastoral notes')));
      can.push(line(TX('Change people’s details and households')));
      var ticks = kind === 'senior' ? st.seniorCan : st.pastorCan;
      can = can.concat(abilityLines(ticks));
      if (kind === 'senior') can.push(line(TX('See Church & Trellis as the roles below theirs (View as)')), line(TX('Choose what attendees may do and write the membership application')));
      if (mods.events === true) can.push(line(TX('See who’s coming to events, and add people who put their name down on a sheet')));
      if (kind !== 'senior' && !(ticks || []).length) can.push(line(TX('Nothing more – tick what else below')));
    } else if (kind === 'rosters') {
      see.push(contacts(st, 'rosters', share)); careSee('rosters');
      can.push(line(TX('Rosters, teams and services')));
      if (mods.events === true) can.push(line(TX('See who’s coming to events, and add people who put their name down on a sheet')));
    } else if (kind === 'kids') {
      see.push(line(TX('Children, their guardians and medical notes')), contacts(st, 'kids', share)); careSee('kids');
      can.push(line(TX('Children’s medical notes (with a guardian’s consent)')));
      if (mods.events === true) can.push(line(TX('See who’s coming to events, and add people who put their name down on a sheet')));
    } else if (kind === 'partner') {
      see.push(line(TX('Their own details, serving and messages')), contacts(st, 'member', share));
      if (st.crewView !== false && mods.rosters !== false) see.push(line(TX('Who else is serving at their services (names and jobs)')));
      see.push(line(st.seeCareOwn !== false ? TX('Everyone in their own Care Group') : TX('The carers of their own Care Group')));
      careSee('member');
      can.push(line(TX('Reply to messages, and write to the Office, the ministers and their group leaders')));
      if (mods.board === true || mods.market === true) can.push(line(TX('Post on the Community board and the Marketplace (a keeper checks first)')));
      if (mods.events === true) can.push(line(TX('Sign up for events, with reminders 3 days and 1 day before')));
    } else if (kind === 'attendee') {
      var on = attendeeCan(st);
      see.push(line(TX('Their own details, serving and messages')));
      if (on.indexOf('directory') >= 0) see.push(contacts(st, 'member', share));
      else if (on.indexOf('names') >= 0) see.push(line(TX('The names of Church Partners')));
      if (on.indexOf('write') >= 0) can.push(line(TX('Write to the Office, the ministers and their Midweek Group leaders')));
      if (on.indexOf('reply') >= 0) can.push(line(TX('Reply to any message sent to them')));
      if (mods.events === true) can.push(line(TX('Sign up for events, with reminders 3 days and 1 day before')));
      if (!can.length) can.push(line(TX('Only read the messages the church sends them')));
    }
    return { see: see, can: can };
  }

  /* ---------- Settings → Apps: the parts an Administrator can switch on or off ---------- */
  // [id, name, what it is]. The parts in PARTS that are built join the end of this list by themselves.
  var APPS = [['people', TX('People'), TX('Directory, households and consent')], ['rosters', TX('Rosters'), TX('Serving rosters, teams and serving together')], ['leave', TX('Leave'), TX('Staff leave (Leave Manager built in)')],
    ['care', TX('Care Groups'), TX('Small groups that care for one another')], ['life', TX('Midweek Groups'), TX('Bible studies, life groups, Connect Groups – their leaders name them')], ['leaders', TX('Leadership'), TX('Council, elders and leaders – their roles and portfolios')], ['library', TX('Library'), TX('The church’s library and Archives – books and church records in one place')],
    ['messages', TX('Messages'), TX('Messages from the church to you and your groups')], ['privacy', TX('Privacy'), TX('Privacy law tools (consent, requests, breaches)')], ['import', TX('Import'), TX('Bring data across from Elvanto')],
    ['words', TX('Translations'), TX('Members suggest better wording in their language')]];
  /** The list Settings → Apps shows: the built-in ones, then the new parts once built (switchable ones only). */
  function apps() {
    var have = APPS.map(function (a) { return a[0]; });
    return APPS.concat(PARTS.filter(function (p) { return !p.soon && p.optIn && have.indexOf(p.id) < 0; }).map(function (p) { return [p.id, p.name, p.desc]; }));
  }

  return {
    ROLES: ROLES, ROLE_IDS: ROLE_IDS, STAFF_ROLES: STAFF_ROLES, RESTRICTED: RESTRICTED, KINDS: KINDS, NOT_ATTENDEES: NOT_ATTENDEES, EVERYONE: EVERYONE, kindOf: kindOf,
    ABILITIES: ABILITIES, abilityIds: abilityIds, pastorTicks: pastorTicks, abilityPerms: abilityPerms,
    ATTENDEE_ROWS: ATTENDEE_ROWS, ATTENDEE_OPTIONS: ATTENDEE_OPTIONS, ATTENDEE_CAN: ATTENDEE_CAN, attendeeCan: attendeeCan,
    TIERS: TIERS, seesCare: seesCare,
    JOBS: JOBS, jobHolders: jobHolders,
    PARTS: PARTS, part: part, partPerms: partPerms, isPartPerm: isPartPerm, allows: allows,
    summary: summary, overviewKinds: overviewKinds,
    APPS: APPS, apps: apps
  };
})();
if (typeof module !== 'undefined') module.exports = Access;
