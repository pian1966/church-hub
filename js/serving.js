/*
 * Church Hub – Christ Church Howick's services, serving departments and positions (as in Elvanto).
 * Used by Rosters (one click adds them as teams and positions) and by People (the Volunteer section).
 * A position with `times` only runs at those services, e.g. Creche Duty only at 8:00 (empty = every service).
 *
 * The church's regular services (Settings → Services and venues) are "slots": { id, label, day (0 = Sunday), time, venue }.
 * Positions, volunteers (skills) and offers to serve name the slots by id; a dated service in the roster names its slot
 * (`slot`, or just its `time` for services made before venues existed). The first three are 8am, 10am and 5pm; the church
 * can add more times and other campuses or venues. Ids of the first three are their times ("08:00"), so older data fits.
 */
var Serving = (function () {
  'use strict';
  var TIMES = [['08:00', '8am'], ['10:00', '10am'], ['17:00', '5pm']];   // the defaults, as [id, label]
  var DEFAULT_SLOTS = [{ id: '08:00', label: '8am', day: 0, time: '08:00', venue: '' }, { id: '10:00', label: '10am', day: 0, time: '10:00', venue: '' },
    { id: '17:00', label: '5pm', day: 0, time: '17:00', venue: '' }];
  /** The church's regular services, from the settings (or the defaults). */
  function slots(settings) { var s = settings && settings.serviceSlots; return (s && s.length ? s : DEFAULT_SLOTS).map(function (x) { return Object.assign({}, x); }); }
  /** "8am", or "9:30am · Hilton campus" when the church has more than one venue. */
  function slotLabel(id, settings) {
    if (id === 'memorial') return 'memorial and funeral teas';
    var x = slots(settings).filter(function (y) { return y.id === id; })[0];
    if (!x) { var t = TIMES.filter(function (y) { return y[0] === id; })[0]; return t ? t[1] : id; }
    return x.label + (x.venue ? ' · ' + x.venue : '');
  }
  /** A new slot's id: its time, plus the venue when there is one ("09:30@hilton"); never the same as another slot's. */
  function newSlotId(time, venue, existing) {
    var base = time + (venue ? '@' + String(venue).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : ''), id = base, n = 2;
    while ((existing || []).some(function (x) { return x.id === id; })) id = base + '-' + n++;
    return id;
  }
  /** The slot a dated service belongs to. */
  function slotOf(service) { return service ? service.slot || service.time || '' : ''; }
  var ALL = ['08:00', '10:00', '17:00'], EIGHT = ['08:00'], TEN = ['10:00'], MEMORIAL = ['memorial'];   // memorial and funeral teas: not a Sunday service
  // [department id, department, [position id, position, people needed, services (all when left out)]]
  var DEPARTMENTS = [
    ['dept-operational', 'Operational', [['pos-host', 'Host', 1], ['pos-preaching', 'Preaching', 1], ['pos-reading', 'Reading', 1], ['pos-prayer', 'Prayer', 1]]],
    ['dept-extra', 'Extra Slot', [['pos-comm-lead', 'Communion – Leading', 1], ['pos-comm-provide', 'Communion – Providing', 2], ['pos-interview', 'Interview', 1],
      ['pos-missions', 'Missions', 1], ['pos-doctrine', 'Doctrine Slot', 1]]],
    ['dept-hospitality', 'Hospitality', [['pos-welcoming', 'Welcoming & Service Assistant', 2], ['pos-tea', 'Tea Duty', 2], ['pos-eats', 'Providing Eats', 1, EIGHT],
      ['pos-servers', 'Servers (Collection & Communion)', 5, TEN]]],
    ['dept-music', 'Music', [['pos-singers', 'Singers', 2], ['pos-guitar', 'Guitar', 1], ['pos-bass', 'Bass', 1], ['pos-drums', 'Drums', 1], ['pos-piano', 'Piano', 1],
      ['pos-sound', 'Sound Desk', 1], ['pos-streaming', 'Online Streaming', 1, TEN]]],
    ['dept-teens', 'Teens', [['pos-teens-teacher', 'Teens’ Church Teacher', 1, EIGHT], ['pos-teens-assistant', 'Teens’ Church Assistant', 1, EIGHT]]],
    ['dept-children', 'Children', [['pos-children-teacher', 'Children’s Church Teacher', 1, EIGHT], ['pos-children-assistant', 'Children’s Church Assistant', 1, EIGHT]]],
    ['dept-creche', 'Creche', [['pos-creche', 'Creche Duty', 1, EIGHT]]],
    ['dept-memorial', 'Memorial Service', [['pos-memorial-teas', 'Memorial Teas', 2, MEMORIAL]]]
  ];
  // Elvanto's names that differ from Church Hub's
  var ALIASES = { guitarists: 'guitar', vocal: 'singers', vocals: 'singers', welcoming: 'welcoming & service assistant', servers: 'servers (collection & communion)', 'memorial duties': 'memorial teas' };
  function norm(s) { return String(s || '').trim().toLowerCase().replace(/[’']/g, '').replace(/[–-]/g, ' ').replace(/\s+/g, ' '); }
  /**
   * What to add so the church's departments and positions are all there: teams and positions missing by name are added;
   * a team that already has the department's name is used for it (nothing existing is changed or removed).
   * → { teams: [new teams], positions: [new positions] }
   */
  function missing(teams, positions) {
    var out = { teams: [], positions: [] };
    DEPARTMENTS.forEach(function (d) {
      var t = (teams || []).filter(function (x) { return norm(x.name) === norm(d[1]); })[0];
      if (!t) { t = { id: d[0], name: d[1] }; out.teams.push(t); }
      d[2].forEach(function (p) {
        var have = (positions || []).some(function (x) { return x.teamId === t.id && norm(x.name) === norm(p[1]); });
        if (!have) out.positions.push({ id: p[0], teamId: t.id, name: p[1], needed: p[2], times: (p[3] || []).slice() });   // [] = every service
      });
    });
    return out;
  }
  function timeLabel(t, settings) { return slotLabel(t, settings); }
  /** A position by name as Elvanto writes it ("Guitarists", "Communion - Leading") among Church Hub's positions. */
  function findPosition(name, positions) {
    var n = norm(name); n = norm(ALIASES[n] || n);
    return (positions || []).filter(function (x) { return norm(x.name) === n; })[0] || null;
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

  return { TIMES: TIMES, DEFAULT_SLOTS: DEFAULT_SLOTS, DEPARTMENTS: DEPARTMENTS, missing: missing, timeLabel: timeLabel, findPosition: findPosition,
    slots: slots, slotLabel: slotLabel, newSlotId: newSlotId, slotOf: slotOf, easter: function (y) { return ymd(easter(y)); }, specials: specials, specialDate: specialDate };
})();
if (typeof module !== 'undefined') module.exports = Serving;
