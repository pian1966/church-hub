/*
 * Church Hub – Christ Church Howick's services, serving departments and positions (as in Elvanto).
 * Used by Rosters (one click adds them as teams and positions) and by People (the Volunteer section).
 * A position with `times` only runs at those services, e.g. Creche Duty only at 8:00 (empty = every service).
 *
 * The church's regular services (Settings → Services and venues) are "slots": { id, label, day (0 = Sunday), time, venue }.
 * Positions, volunteers (skills) and offers to serve name the slots by id; a dated service in the roster names its slot
 * (`slot`, or just its `time` for services made before venues existed). The first three are 8am, 10am and 5pm; the church
 * can add more times and other campuses or venues. Ids of the first three are their times ("08:00"), so older data fits.
 * Special services (`special: true`): Memorial (held now and then) and days in the church year – Christmas, Maundy Thursday,
 * Tenebrae, Good Friday, Easter Sunday, Ascension – plus any the church adds. Only positions that name them run there, so the
 * Administrator chooses each one's departments and positions. `feast` is its name in specials() (for the next date).
 * Each slot can also carry `theme` (THEMES: its colour and picture) and `moods` (words describing it), chosen under
 * Rosters → Services, where the departments and positions for each service are switched on and off too.
 * Holy Communion: a regular slot's `communion` says which weeks of the month it is celebrated there – 'every' (or missing,
 * apart from the church's usual three in DEFAULT_COMMUNION) = every week, [] = never, or e.g. [1] (the 1st Sunday), [2, 4], ['last']. A dated service can set `communion: true/false`
 * for a one-off change (Christmas, a fifth Sunday, a visiting bishop). Positions for communion (`communion: true`, or a name
 * with "communion" in it, such as Communion Servers) are only rostered at services that have communion.
 */
var Serving = (function () {
  'use strict';
  var TX = function (s) { return s; };   // a text shown to people, translated where it is shown (the language test checks it)
  var TIMES = [['08:00', '8am'], ['10:00', '10am'], ['17:00', '5pm']];   // the defaults, as [id, label]
  // The regular services, plus Memorial: held now and then (memorials and funerals), so only positions that name it run there.
  var DEFAULT_SLOTS = [{ id: '08:00', label: '8am', day: 0, time: '08:00', venue: '' }, { id: '10:00', label: '10am', day: 0, time: '10:00', venue: '' },
    { id: '17:00', label: '5pm', day: 0, time: '17:00', venue: '' }];
  function SP(id, label, feast) { return { id: id, label: label, day: 0, time: '', venue: '', special: true, feast: feast || '' }; }
  var DEFAULT_SPECIALS = [SP('memorial', 'Memorial'), SP('christmas', 'Christmas', 'Christmas Day'), SP('maundy-thursday', 'Maundy Thursday', 'Maundy Thursday'),
    SP('tenebrae', 'Tenebrae', 'Tenebrae'), SP('good-friday', 'Good Friday', 'Good Friday'), SP('easter-sunday', 'Easter Sunday', 'Easter Day'), SP('ascension', 'Ascension', 'Ascension Day')];

  /* ---------- how each service looks and feels (Rosters → Services) ----------
   * A theme gives a service its colour and picture, from the time of day it is held; volunteers see it when they choose
   * where to serve, so each service is easy to tell apart. ink = text and lines, line = the accent, soft = the background. */
  var THEMES = [
    { id: 'sunrise', name: TX('Sunrise'), ink: '#9A3F06', line: '#F59E0B', soft: '#FFF3DC', icon: 'M12 2v6M8 6l4-4 4 4M4.2 10.2l1.4 1.4M2 18h2M20 18h2M18.4 11.6l1.4-1.4M22 22H2M16 18a4 4 0 0 0-8 0' },
    { id: 'morning', name: TX('Morning'), ink: '#1D4F91', line: '#4A8AD4', soft: '#E7F0FB', icon: 'M12 3v2M12 19v2M5 12H3M21 12h-2M6.3 6.3 4.9 4.9M19.1 19.1l-1.4-1.4M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z' },
    { id: 'midday', name: TX('Midday'), ink: '#0D6455', line: '#2BA88E', soft: '#E0F4EF', icon: 'M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10zM2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12' },
    { id: 'sunset', name: TX('Sunset'), ink: '#9E1F4B', line: '#E4577F', soft: '#FDE8EF', icon: 'M12 10V2M16 6l-4 4-4-4M4.2 10.2l1.4 1.4M2 18h2M20 18h2M18.4 11.6l1.4-1.4M22 22H2M16 18a4 4 0 0 0-8 0' },
    { id: 'evening', name: TX('Evening'), ink: '#3A2E8C', line: '#6D5BD0', soft: '#EEEBFB', icon: 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z' },
    { id: 'christmas', name: TX('Christmas star'), ink: '#1D5B38', line: '#2E9A5E', soft: '#E4F4EA', icon: 'M12 2l2.9 6.9L22 9.3l-5.5 4.6L18.2 21 12 17.3 5.8 21l1.7-7.1L2 9.3l7.1-.4z' },
    { id: 'holyweek', name: TX('Bread and wine'), ink: '#8A1D2C', line: '#C2414F', soft: '#FBE6E8', icon: 'M7 3h10l-1 7a4 4 0 0 1-8 0zM12 14v7M8 21h8' },
    { id: 'cross', name: TX('The cross'), ink: '#2F3A45', line: '#6B7A89', soft: '#ECEFF2', icon: 'M12 2v20M6 8h12' },
    { id: 'easter', name: TX('Easter morning'), ink: '#7A5200', line: '#E3B23C', soft: '#FFF6DB', icon: 'M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z' },
    { id: 'sky', name: TX('Sky'), ink: '#155F7A', line: '#4FAED0', soft: '#E3F4FA', icon: 'M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z' },
    { id: 'candlelight', name: TX('Candlelight'), ink: '#653A80', line: '#A57CC4', soft: '#F4EDF8', icon: 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3 0 1.25 1 2.5 2.5 2.5z' }
  ];
  /** Words a church can tick to describe a service (it can add its own too). */
  var MOODS = [TX('Children and families'), TX('Sunday school'), TX('Young adults'), TX('Seniors'), TX('Informal'), TX('Formal'), TX('Lively'), TX('Quiet'),
    TX('Interactive'), TX('Traditional'), TX('Contemporary'), TX('Kids’ songs'), TX('Hymns'), TX('Modern songs'), TX('Band'), TX('Reflective')];
  // Christ Church Howick's services: 8am is the children's service, 10am the traditional one, 5pm the young adults'
  var DEFAULT_THEME = { '08:00': 'sunrise', '10:00': 'morning', '17:00': 'sunset', memorial: 'candlelight', christmas: 'christmas', 'maundy-thursday': 'holyweek',
    tenebrae: 'candlelight', 'good-friday': 'cross', 'easter-sunday': 'easter', ascension: 'sky' };
  var DEFAULT_MOODS = { '08:00': ['Children and families', 'Sunday school', 'Kids’ songs', 'Informal', 'Lively'], '10:00': ['Seniors', 'Traditional', 'Formal', 'Hymns'],
    '17:00': ['Young adults', 'Informal', 'Interactive', 'Modern songs', 'Band'], memorial: ['Quiet', 'Reflective', 'Hymns'],
    christmas: ['Children and families', 'Lively', 'Traditional'], 'maundy-thursday': ['Reflective', 'Traditional'], tenebrae: ['Quiet', 'Reflective'],
    'good-friday': ['Quiet', 'Reflective', 'Hymns'], 'easter-sunday': ['Lively', 'Children and families', 'Hymns'], ascension: ['Traditional', 'Hymns'] };

  /** Every service as saved, removed ones included (what Settings stores in serviceSlots). The usual special services are
   *  always there, marked removed when the church doesn't hold one, so it isn't added back. */
  function savedSlots(settings) {
    var s = settings && settings.serviceSlots, list = (s && s.length ? s : DEFAULT_SLOTS).map(function (x) { return Object.assign({}, x); });
    DEFAULT_SPECIALS.forEach(function (d) { if (!list.some(function (x) { return x.id === d.id; })) list.push(Object.assign({}, d)); });
    return list;
  }
  /** The services volunteers can choose: the Sunday (regular) ones and the special ones. */
  function allSlots(settings) { return savedSlots(settings).filter(function (x) { return !x.removed; }); }
  /** The church's regular (weekly) services, from the settings (or the defaults). */
  function slots(settings) { return allSlots(settings).filter(function (x) { return !x.special; }); }
  /** The special services: Memorial, Christmas, Holy Week, Easter, Ascension and the church's own. */
  function specialSlots(settings) { return allSlots(settings).filter(function (x) { return x.special; }); }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'service'; }
  /** Add a special service (e.g. Palm Sunday) → the list to save; a removed one with that name comes back instead. */
  function addSpecialSlot(settings, name) {
    var list = savedSlots(settings), n = String(name || '').trim(), was = findSpecial(n, { serviceSlots: list }, true);
    if (!n) return list;
    if (was) return list.map(function (x) { return x.id === was.id ? Object.assign({}, x, { removed: false }) : x; });
    var feast = specials(2027).filter(function (x) { return x.name.toLowerCase() === n.toLowerCase(); })[0];
    var id = slug(n), k = 2; while (list.some(function (x) { return x.id === id; })) id = slug(n) + '-' + k++;
    return list.concat([SP(id, n, feast ? feast.name : '')]);
  }
  /** Take a service off the list → the list to save. The usual special services are marked removed (so they can come back). */
  function removeSlot(settings, id) {
    var usual = DEFAULT_SPECIALS.some(function (d) { return d.id === id; });
    return savedSlots(settings).filter(function (x) { return usual || x.id !== id; }).map(function (x) { return x.id === id ? Object.assign({}, x, { removed: true }) : x; });
  }
  /** The special service with this name (its own name or its day in the church year, e.g. "Easter Day" → Easter Sunday). */
  function findSpecial(name, settings, withRemoved) {
    var n = String(name || '').trim().toLowerCase(); if (!n) return null;
    return (withRemoved ? savedSlots(settings) : specialSlots(settings)).filter(function (x) { return x.special && (x.label.toLowerCase() === n || (x.feast || '').toLowerCase() === n); })[0] || null;
  }
  /** "8am", or "9:30am · Hilton campus" when the church has more than one venue. */
  function slotLabel(id, settings) {
    var x = savedSlots(settings).filter(function (y) { return y.id === id; })[0];
    if (!x) { var t = TIMES.filter(function (y) { return y[0] === id; })[0]; return t ? t[1] : id; }
    return x.label + (x.venue ? ' · ' + x.venue : '');
  }
  /** A service's theme (colour and picture): the one chosen, or one that suits its time of day. */
  function themeOf(slot) {
    var id = slot && (slot.theme || DEFAULT_THEME[slot.id]);
    if (!id && slot) {
      var h = parseInt(String(slot.time || '').slice(0, 2), 10);
      id = slot.special ? 'candlelight' : isNaN(h) ? 'morning' : h < 9 ? 'sunrise' : h < 12 ? 'morning' : h < 15 ? 'midday' : h < 18 ? 'sunset' : 'evening';
    }
    return THEMES.filter(function (t) { return t.id === id; })[0] || THEMES[1];
  }
  /** The words describing a service (its mood): the ones chosen, or the church's usual ones. */
  function moodsOf(slot) { return slot ? (slot.moods || DEFAULT_MOODS[slot.id] || []).slice() : []; }
  /** Does a position run at this service? An empty list of services means every Sunday (regular) service, never a special one. */
  function runsAtSlot(pos, slot) {
    var t = (pos && pos.times) || [];
    return slot.special ? t.indexOf(slot.id) >= 0 : !t.length || t.indexOf(slot.id) >= 0;
  }
  /** A position's services after switching one on or off: [] again when it runs at every regular service and nothing else;
   *  ['none'] when it is switched off everywhere (kept, with its volunteers, but not rostered). */
  function toggleTimes(pos, slotId, settings) {
    var all = allSlots(settings), on = all.filter(function (x) { return runsAtSlot(pos, x); }).map(function (x) { return x.id; });
    on = on.indexOf(slotId) >= 0 ? on.filter(function (x) { return x !== slotId; }) : on.concat([slotId]);
    var weekly = slots(settings).map(function (x) { return x.id; });
    var every = weekly.every(function (x) { return on.indexOf(x) >= 0; }) && on.every(function (x) { return weekly.indexOf(x) >= 0; });
    if (!on.length) return ['none'];
    return every ? [] : all.map(function (x) { return x.id; }).filter(function (x) { return on.indexOf(x) >= 0; });
  }
  /** What a volunteer can choose at a service: its departments in order, each with the positions that run there.
   *  → [{ team, positions: [...] }] (departments with nothing at this service are left out) */
  function structure(slot, teams, positions) {
    return (teams || []).map(function (t) {
      return { team: t, positions: (positions || []).filter(function (p) { return p.teamId === t.id && runsAtSlot(p, slot); }) };
    }).filter(function (x) { return x.positions.length; });
  }
  /** Change one service (look, mood…) and give back the list to save as settings.serviceSlots. */
  function updateSlot(settings, id, patch) {
    return savedSlots(settings).map(function (x) { return x.id === id ? Object.assign({}, x, patch) : x; });
  }
  /** A new slot's id: its time, plus the venue when there is one ("09:30@hilton"); never the same as another slot's. */
  function newSlotId(time, venue, existing) {
    var base = time + (venue ? '@' + String(venue).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : ''), id = base, n = 2;
    while ((existing || []).some(function (x) { return x.id === id; })) id = base + '-' + n++;
    return id;
  }
  /** The slot a dated service belongs to. */
  function slotOf(service) { return service ? service.slot || service.time || '' : ''; }
  /** Services in the order they happen: by date, then by time (8am, 10am, 5pm). For .sort(). */
  function byWhen(a, b) { var x = (a && a.date || '') + ' ' + (a && a.time || ''), y = (b && b.date || '') + ' ' + (b && b.time || ''); return x < y ? -1 : x > y ? 1 : 0; }
  /** A service's colours: the look chosen for its regular or special service (Rosters → Services), wherever it is shown. */
  function themeOfService(service, settings) {
    var id = slotOf(service), x = savedSlots(settings).filter(function (y) { return y.id === id; })[0];
    return themeOf(x || { id: id, time: service && service.time, special: service && service.special });
  }
  /* ---------- Holy Communion ---------- */
  var COMMUNION_NAME = /communion|eucharist|lord.?s supper|holy table|chalice/i;
  /** Is this position only needed when there is communion? Its own tick, or (until it is ticked or unticked) its name. */
  function isCommunion(pos) { return !!pos && (typeof pos.communion === 'boolean' ? pos.communion : COMMUNION_NAME.test(pos.name || '')); }
  /** Which weeks of the month a regular service has communion: 'every', or a list of 1–5 and 'last' ([] = never). */
  // Christ Church Howick: communion on the 1st Sunday at 10am, the 2nd Sunday at 8am and 5pm (like DEFAULT_MOODS, until changed)
  var DEFAULT_COMMUNION = { '10:00': [1], '08:00': [2], '17:00': [2] };
  function communionWeeks(slot) {
    var c = slot && (slot.communion != null ? slot.communion : DEFAULT_COMMUNION[slot.id]);
    return c == null || c === 'every' ? 'every' : (Array.isArray(c) ? c.slice() : 'every');
  }
  /** The weeks after tapping one choice ('every', 'never', 1–5 or 'last') → what to save as the slot's `communion`. */
  function toggleCommunionWeek(slot, w) {
    if (w === 'every') return 'every';
    if (w === 'never') return [];
    var now = communionWeeks(slot), list = now === 'every' ? [] : now, k = w === 'last' ? 'last' : +w;
    list = list.indexOf(k) >= 0 ? list.filter(function (x) { return x !== k; }) : list.concat([k]);
    var order = [1, 2, 3, 4, 5, 'last'];
    list.sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); });
    return [1, 2, 3, 4, 5].every(function (x) { return list.indexOf(x) >= 0; }) ? 'every' : list;
  }
  /** Does the usual pattern give communion on this date? (1st Sunday = days 1–7, … ; last = the last one in the month) */
  function communionOnDate(weeks, date) {
    if (weeks === 'every') return true;
    var p = String(date).split('-'), d = +p[2], len = new Date(+p[0], +p[1], 0).getDate();
    return weeks.indexOf(Math.ceil(d / 7)) >= 0 || (weeks.indexOf('last') >= 0 && d + 7 > len);
  }
  /** Is there communion at this dated service? Its own one-off choice first; then its regular service's pattern. Special
   *  services (Good Friday…) have it when their communion positions are switched on, so the pattern doesn't apply to them. */
  function hasCommunion(service, settings) {
    if (!service) return true;
    if (typeof service.communion === 'boolean') return service.communion;
    var id = slotOf(service), x = savedSlots(settings).filter(function (y) { return y.id === id; })[0];
    if (service.special || !x || x.special) return true;
    return communionOnDate(communionWeeks(x), service.date);
  }
  /** What the usual pattern would give, ignoring a one-off change (to show "As usual: …"). */
  function usualCommunion(service, settings) { return hasCommunion(Object.assign({}, service, { communion: null }), settings); }
  /** The next dates (from `from`, yyyy-mm-dd) a regular service has communion, as yyyy-mm-dd (n of them, within a year). */
  function nextCommunions(slot, from, n) {
    var weeks = communionWeeks(slot), out = [], p = String(from).split('-'), d = new Date(+p[0], +p[1] - 1, +p[2]);
    if (weeks !== 'every' && !weeks.length) return out;
    while (d.getDay() !== (slot.day || 0)) d = plus(d, 1);
    for (var i = 0; i < 54 && out.length < (n || 3); i++, d = plus(d, 7)) if (communionOnDate(weeks, ymd(d))) out.push(ymd(d));
    return out;
  }

  var ALL = ['08:00', '10:00', '17:00'], EIGHT = ['08:00'], TEN = ['10:00'], MEMORIAL = ['memorial'];   // memorial and funeral teas: not a Sunday service
  // [department id, department, [position id, position, people needed, services (all when left out), only when there is communion]]
  var DEPARTMENTS = [
    ['dept-operational', 'Service Leading', [['pos-host', 'Host', 1], ['pos-verger', 'Verger', 1], ['pos-preaching', 'Preaching', 1], ['pos-reading', 'Reading', 1], ['pos-prayer', 'Prayer', 1]]],
    ['dept-extra', 'Extra Slot', [['pos-comm-lead', 'Communion – Leading', 1, null, true], ['pos-comm-provide', 'Communion – Providing', 2, null, true], ['pos-interview', 'Interview', 1],
      ['pos-missions', 'Missions', 1], ['pos-doctrine', 'Doctrine Slot', 1]]],
    ['dept-hospitality', 'Hospitality', [['pos-welcoming', 'Welcoming & Service Assistant', 2], ['pos-ushers', 'Ushers', 2], ['pos-tea', 'Tea Duty', 2], ['pos-eats', 'Providing Eats', 1, EIGHT],
      ['pos-collection', 'Collection Servers', 2, TEN], ['pos-servers', 'Communion Servers', 3, TEN, true]]],
    ['dept-music', 'Music', [['pos-singers', 'Singers', 2], ['pos-guitar', 'Guitar', 1], ['pos-bass', 'Bass', 1], ['pos-drums', 'Drums', 1], ['pos-piano', 'Piano', 1], ['pos-recorded', 'Recorded Music', 1],
      ['pos-sound', 'Sound Desk', 1], ['pos-streaming', 'Online Streaming', 1, TEN]]],
    ['dept-teens', 'Teens', [['pos-teens-teacher', 'Teens’ Church Teacher', 1, EIGHT], ['pos-teens-assistant', 'Teens’ Church Assistant', 1, EIGHT]]],
    ['dept-children', 'Children', [['pos-children-teacher', 'Children’s Church Teacher', 1, EIGHT], ['pos-children-assistant', 'Children’s Church Assistant', 1, EIGHT]]],
    ['dept-creche', 'Creche', [['pos-creche', 'Creche Duty', 1, EIGHT]]],
    ['dept-memorial', 'Memorial Service', [['pos-memorial-teas', 'Memorial Teas', 2, MEMORIAL]]]
  ];
  // Elvanto's names that differ from Church Hub's
  // Departments with another name earlier (Church Hub) or in Elvanto: their positions go in the same team
  var DEPT_ALIASES = { operational: 'service leading', service: 'service leading' };
  var ALIASES = { guitarists: 'guitar', vocal: 'singers', vocals: 'singers', welcoming: 'welcoming & service assistant', servers: 'communion servers', 'servers (collection & communion)': 'communion servers', 'memorial duties': 'memorial teas' };
  function norm(s) { return String(s || '').trim().toLowerCase().replace(/[’']/g, '').replace(/[–-]/g, ' ').replace(/\s+/g, ' '); }
  // Positions that became something else: the old one is renamed, keeping its people and turns (and what is new is added)
  var RENAMED = { 'servers (collection & communion)': 'Communion Servers' };
  /**
   * What to add so the church's departments and positions are all there: teams and positions missing by name are added;
   * a team that already has the department's name is used for it. Nothing is removed; a position in RENAMED is renamed.
   * → { teams: [new teams], positions: [new positions], renames: [{ id, from, to }] }
   */
  function missing(teams, positions) {
    var out = { teams: [], positions: [], renames: [] };
    DEPARTMENTS.forEach(function (d) {
      var t = (teams || []).filter(function (x) { var n = norm(x.name); return (DEPT_ALIASES[n] || n) === norm(d[1]); })[0];
      if (!t) { t = { id: d[0], name: d[1] }; out.teams.push(t); }
      d[2].forEach(function (p) {
        var mine = (positions || []).filter(function (x) { return x.teamId === t.id; });
        var have = mine.some(function (x) { return norm(x.name) === norm(p[1]); });
        var old = !have && mine.filter(function (x) { return norm(RENAMED[norm(x.name)] || '') === norm(p[1]); })[0];
        if (old) { out.renames.push({ id: old.id, from: old.name, to: p[1] }); return; }
        if (!have) out.positions.push(Object.assign({ id: p[0], teamId: t.id, name: p[1], needed: p[2], times: (p[3] || []).slice() }, p[4] ? { communion: true } : {}));   // [] = every service
      });
    });
    return out;
  }
  function timeLabel(t, settings) { return slotLabel(t, settings); }
  /** A position by name as Elvanto writes it ("Guitarists", "Communion - Leading") among Church Hub's positions. */
  function findPosition(name, positions) {
    var n = norm(name), a = norm(ALIASES[n] || n);
    return (positions || []).filter(function (x) { return norm(x.name) === a; })[0] || (positions || []).filter(function (x) { return norm(x.name) === n; })[0] || null;
  }

  /* ---------- special services (Settings → Services that need a roster → Add a special service) ---------- */
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function plus(d, n) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); return x; }
  /** Easter Sunday in a year (Western churches, Gregorian calendar). */
  function easter(y) {
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    var h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    var mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(y, mo - 1, da);
  }
  function nthSunday(y, month, n) { var d = new Date(y, month, 1); while (d.getDay() !== 0) d = plus(d, 1); return plus(d, (n - 1) * 7); }
  /** Services churches hold on special days, with the date in a year where there is one: [{ name, date, when, used }].
   *  used: which churches usually keep it ('' = most churches). Add or change any here; dates are suggestions. */
  function specials(year) {
    var E = easter(year), xmas = new Date(year, 11, 25), advent = plus(xmas, -((xmas.getDay() || 7) + 21));
    var L = [
      ['Advent Sunday', advent, 'Christmas', ''], ['Lessons and Carols', null, 'Christmas', ''], ['Carol service', null, 'Christmas', ''],
      ['Christmas Eve', new Date(year, 11, 24), 'Christmas', ''], ['Midnight Mass / Midnight service', new Date(year, 11, 24), 'Christmas', 'Anglican, Catholic, Lutheran'],
      ['Christmas Day', xmas, 'Christmas', ''], ['Watchnight service', new Date(year, 11, 31), 'Christmas', 'Methodist, Pentecostal and others'],
      ['Covenant service', nthSunday(year, 0, 1), 'Christmas', 'Methodist'], ['Epiphany', new Date(year, 0, 6), 'Christmas', 'Anglican, Catholic, Lutheran'],
      ['Candlemas (the Presentation)', new Date(year, 1, 2), 'Christmas', 'Anglican, Catholic'],
      ['Ash Wednesday', plus(E, -46), 'Lent and Easter', ''], ['Mothering Sunday', plus(E, -21), 'Lent and Easter', 'Anglican (UK and Ireland)'],
      ['Palm Sunday', plus(E, -7), 'Lent and Easter', ''], ['Maundy Thursday', plus(E, -3), 'Lent and Easter', ''], ['Tenebrae', plus(E, -3), 'Lent and Easter', 'Anglican, Catholic, Lutheran'],
      ['Good Friday', plus(E, -2), 'Lent and Easter', ''], ['Stations of the Cross', plus(E, -2), 'Lent and Easter', 'Catholic, Anglican'],
      ['Easter Vigil', plus(E, -1), 'Lent and Easter', 'Anglican, Catholic, Lutheran'], ['Easter Sunrise service', E, 'Lent and Easter', ''], ['Easter Day', E, 'Lent and Easter', ''],
      ['Ascension Day', plus(E, 39), 'Lent and Easter', ''], ['Pentecost (Whitsunday)', plus(E, 49), 'Lent and Easter', ''], ['Trinity Sunday', plus(E, 56), 'Lent and Easter', 'Anglican, Catholic, Lutheran'],
      ['Corpus Christi', plus(E, 60), 'Lent and Easter', 'Catholic'], ['Aldersgate Sunday', new Date(year, 4, 24), 'Through the year', 'Methodist'],
      ['Mother’s Day', nthSunday(year, 4, 2), 'Through the year', ''], ['Father’s Day', nthSunday(year, 5, 3), 'Through the year', ''],
      ['Assumption of Mary', new Date(year, 7, 15), 'Through the year', 'Catholic'], ['Harvest festival / Thanksgiving', null, 'Through the year', ''],
      ['Reformation Sunday', new Date(year, 9, 31), 'Through the year', 'Lutheran, Reformed, Presbyterian'], ['All Saints’ Day', new Date(year, 10, 1), 'Through the year', 'Anglican, Catholic, Lutheran'],
      ['All Souls’ (service of remembrance for the departed)', new Date(year, 10, 2), 'Through the year', 'Anglican, Catholic'], ['Remembrance Sunday', nthSunday(year, 10, 2), 'Through the year', 'UK, Commonwealth'],
      ['Christ the King', plus(advent, -7), 'Through the year', 'Catholic, Anglican, Lutheran'], ['Church anniversary', null, 'Through the year', ''],
      ['Week of Prayer', null, 'Through the year', ''], ['Prayer and fasting', null, 'Through the year', 'Pentecostal and others'], ['Revival meetings', null, 'Through the year', 'Pentecostal, Baptist'],
      ['Baptism service', null, 'Occasions', ''], ['Confirmation', null, 'Occasions', 'Anglican, Catholic, Lutheran, Methodist'], ['Holy Communion / Lord’s Supper', null, 'Occasions', ''],
      ['Induction or ordination', null, 'Occasions', ''], ['Youth Sunday', null, 'Occasions', ''], ['Wedding', null, 'Occasions', ''], ['Funeral', null, 'Occasions', ''], ['Memorial service', null, 'Occasions', '']
    ];
    return L.map(function (x) { return { name: x[0], date: x[1] ? ymd(x[1]) : '', when: x[2], used: x[3] }; });
  }
  /** The next date for a special service (this year's, or next year's once it has passed); '' when it has no fixed day. */
  function specialDate(name, today) {
    var y = +String(today).slice(0, 4), f = function (yr) { return specials(yr).filter(function (x) { return x.name.toLowerCase() === String(name).toLowerCase(); })[0]; };
    var a = f(y); if (!a || !a.date) return '';
    return a.date >= today ? a.date : f(y + 1).date;
  }

  /* ---------- the order of departments (Rosters → Teams → ↑ ↓) ---------- */
  // Until a church puts its own in order, departments follow the usual running order of a service; others come after them.
  var TEAM_ORDER = ['welcome', 'service leading', 'extra slot', 'hospitality', 'music', 'worship', 'creche', 'children', 'teens', 'technical', 'tech', 'memorial service'];
  function teamRank(t) {
    if (t && typeof t.order === 'number') return t.order;
    var n = norm(t && t.name); n = DEPT_ALIASES[n] || n;
    var i = TEAM_ORDER.indexOf(n);
    return 1000 + (i < 0 ? TEAM_ORDER.length : i);
  }
  /** The teams in the church's order (stable: teams that tie keep the order they were made in). */
  function orderTeams(teams) {
    return (teams || []).map(function (t, i) { return [t, i]; })
      .sort(function (a, b) { return teamRank(a[0]) - teamRank(b[0]) || a[1] - b[1]; }).map(function (x) { return x[0]; });
  }
  /** Move a team one place up (-1) or down (+1) → every team with its new order number, [{ id, order }]. */
  function moveTeam(teams, id, d) {
    var list = orderTeams(teams), i = list.findIndex(function (t) { return t.id === id; }), j = i + d;
    if (i < 0 || j < 0 || j >= list.length) return [];
    var x = list[i]; list[i] = list[j]; list[j] = x;
    return list.map(function (t, k) { return { id: t.id, order: k }; });
  }
  /**
   * Fold one team into another (a second Music department into the first): its positions move across, and one with the same
   * name as a position already there is joined to it – its people and their turns on the roster go with them, nobody twice.
   * → { positions: [positions to save], removePositions: [ids], skills: [skills to save], removeSkills: [ids], assignments: [to save] }
   */
  function mergeTeam(from, to, positions, skills, assignments) {
    var out = { positions: [], removePositions: [], skills: [], removeSkills: [], assignments: [] };
    var theirs = (positions || []).filter(function (p) { return p.teamId === to; });
    (positions || []).filter(function (p) { return p.teamId === from; }).forEach(function (p) {
      var same = theirs.filter(function (q) { return norm(q.name) === norm(p.name); })[0];
      if (!same) { out.positions.push(Object.assign({}, p, { teamId: to })); return; }
      out.removePositions.push(p.id);
      if ((p.needed || 0) > (same.needed || 0)) out.positions.push(Object.assign({}, same, { needed: p.needed }));
      (skills || []).filter(function (k) { return k.positionId === p.id; }).forEach(function (k) {
        var has = (skills || []).some(function (x) { return x.positionId === same.id && x.personId === k.personId; });
        if (has) out.removeSkills.push(k.id); else out.skills.push(Object.assign({}, k, { positionId: same.id }));
      });
      (assignments || []).filter(function (a) { return a.positionId === p.id; }).forEach(function (a) { out.assignments.push(Object.assign({}, a, { positionId: same.id })); });
    });
    return out;
  }

  return { orderTeams: orderTeams, moveTeam: moveTeam, mergeTeam: mergeTeam, TIMES: TIMES, DEFAULT_SLOTS: DEFAULT_SLOTS, DEFAULT_SPECIALS: DEFAULT_SPECIALS, THEMES: THEMES, MOODS: MOODS, savedSlots: savedSlots, allSlots: allSlots,
    specialSlots: specialSlots, addSpecialSlot: addSpecialSlot, removeSlot: removeSlot, findSpecial: findSpecial, themeOf: themeOf, moodsOf: moodsOf,
    runsAtSlot: runsAtSlot, toggleTimes: toggleTimes, structure: structure, updateSlot: updateSlot, DEPARTMENTS: DEPARTMENTS, missing: missing, timeLabel: timeLabel, findPosition: findPosition,
    isCommunion: isCommunion, communionWeeks: communionWeeks, toggleCommunionWeek: toggleCommunionWeek, communionOnDate: communionOnDate, hasCommunion: hasCommunion,
    usualCommunion: usualCommunion, nextCommunions: nextCommunions,
    slots: slots, slotLabel: slotLabel, newSlotId: newSlotId, slotOf: slotOf, byWhen: byWhen, themeOfService: themeOfService, easter: function (y) { return ymd(easter(y)); }, specials: specials, specialDate: specialDate };
})();
if (typeof module !== 'undefined') module.exports = Serving;
