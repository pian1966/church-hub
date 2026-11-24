/*
 * Church & Trellis – rostering engine (shared by the app, the future server, and the tests).
 *
 * What makes it different from "random" rostering:
 *  - Together groups: a family or friends who want to serve at the SAME service.
 *      strength "must"   → the whole group is rostered together, or none of them.
 *      strength "prefer" → try to place them together; if that's impossible, place people on their own.
 *  - Apart groups: people who must NOT serve at the same service (e.g. parents of a baby).
 *  - Nobody is rostered while away: approved leave (from the Leave app) and blockout dates.
 *  - Fair turns: people who haven't served for longest go first; each person's preferred frequency is respected.
 *  - Deterministic and explainable: no randomness; every assignment carries a plain-English reason.
 *
 * Data (all plain objects, ISO dates 'yyyy-mm-dd'):
 *   people:       [{ id, firstName, lastName, active }]
 *   positions:    [{ id, teamId, name, needed, times }]           needed = people per service; times = the services it runs at
 *                                                                  (e.g. ['08:00']; empty or missing = every service)
 *   skills:       [{ personId, positionId, frequency, times }]     new frequency: 'weekly' | 'monthly' | 'quarterly' (12 weeks apart at least)
 *                                                                  | 'emergency' (backup only) | 'break' (taking a break: stays on the team, never asked);
 *                                                                  legacy 'fortnightly' and 'occasional' remain readable;
 *                                                                  times = the services they serve at (empty or missing = any)
 *   services:     [{ id, date, time, name, slot }]                 slot = the regular service (time + venue); missing = time
 *   specialSlots: ['good-friday', …]                               slots that are special services: only positions naming them run there
 *   noCommunion:  [serviceId, …]                                    services without Holy Communion: positions with communion: true don't run
 *   assignments:  [{ id, serviceId, positionId, personId, status, source }]  status: pending | accepted | declined
 *   groups:       [{ id, name, kind: 'together'|'apart', strength: 'must'|'prefer', memberIds: [] }]
 *   away:         [{ personId, from, to, reason }]                 blockouts + approved leave
 */
var RosterCore = (function () {
  'use strict';

  var FREQ_DAYS = { weekly: 7, fortnightly: 14, monthly: 28, occasional: 56, quarterly: 84, emergency: 56 };
  /** Texts people see, in their language when the app has one (I18n); plain English in tests. */
  function T(s, v) {
    if (typeof I18n !== 'undefined' && I18n.t) return I18n.t(s, v);
    return v ? s.replace(/\{(\w+)\}/g, function (m, k) { return k in v ? String(v[k]) : m; }) : s;
  }

  function parse(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2], 12); }
  function daysBetween(a, b) { return Math.round((parse(b) - parse(a)) / 86400000); }
  function byId(list) { var m = {}; (list || []).forEach(function (x) { m[x.id] = x; }); return m; }
  function fullName(p) { return p ? (p.firstName + ' ' + p.lastName).trim() : ''; }

  /** Does this position run at this service? Positions without times run at every service. */
  function slotOf(svc) { return svc.slot || svc.time; }   // which regular service (time and venue) this is
  function runsAt(pos, svc, special, noCommunion) {
    var k = slotOf(svc), t = pos.times || [];
    if (pos.communion === true && noCommunion && noCommunion.indexOf(svc.id) >= 0) return false;   // a communion role, no communion that day
    if (k && special && special.indexOf(k) >= 0) return t.indexOf(k) >= 0;   // a special service: only positions chosen for it
    return !(t.length && k && t.indexOf(k) < 0);
  }

  /** Is this person away (leave or blockout) on this date? Returns the reason or ''. */
  function awayReason(data, personId, date) {
    var hit = (data.away || []).filter(function (a) { return a.personId === personId && a.from <= date && (a.to || a.from) >= date; })[0];
    return hit ? (hit.reason || 'Away') : '';
  }

  /** Groups a person belongs to, by kind. */
  function groupsOf(data, personId, kind) {
    return (data.groups || []).filter(function (g) { return g.kind === kind && g.memberIds.indexOf(personId) >= 0; });
  }

  /**
   * Suggest people for every open slot in the given services.
   * Returns { assignments: [new assignment objects], gaps: [{serviceId, positionId, missing, why}], notes: [] }.
   * Existing assignments (any status) are respected; declined people are not asked again for that service.
   */
  function autoFill(data, serviceIds, opts) {
    opts = opts || {};
    var people = byId(data.people), positions = data.positions || [];
    var services = (data.services || []).filter(function (s) { return serviceIds.indexOf(s.id) >= 0; })
      .sort(function (a, b) { return (a.date + a.time) < (b.date + b.time) ? -1 : 1; });
    var all = (data.assignments || []).slice();          // existing + what we add as we go
    var added = [], gaps = [], seq = 0;

    function serviceOf(id) { return (data.services || []).filter(function (s) { return s.id === id; })[0]; }
    function live(a) { return a.status !== 'declined'; }
    function filled(serviceId, positionId) { return all.filter(function (a) { return a.serviceId === serviceId && a.positionId === positionId && live(a); }).length; }
    function servingAt(serviceId, personId) { return all.some(function (a) { return a.serviceId === serviceId && a.personId === personId && live(a); }); }
    function declined(serviceId, personId) { return all.some(function (a) { return a.serviceId === serviceId && a.personId === personId && a.status === 'declined'; }); }
    function lastServed(personId, beforeDate) {
      var last = '';
      all.forEach(function (a) {
        if (a.personId !== personId || !live(a)) return;
        var s = serviceOf(a.serviceId); if (s && s.date < beforeDate && s.date > last) last = s.date;
      });
      return last;
    }
    function turnsIn(personId, date, days) {
      return all.filter(function (a) {
        if (a.personId !== personId || !live(a)) return false;
        var s = serviceOf(a.serviceId); if (!s) return false;
        var d = daysBetween(s.date, date); return d > -days && d < days;
      }).length;
    }
    function skillFor(personId, positionId) { return (data.skills || []).filter(function (k) { return k.personId === personId && k.positionId === positionId; })[0]; }

    /** Can this person take this position at this service? '' = yes, otherwise why not. */
    function blocker(svc, personId, positionId) {
      var p = people[personId];
      if (!p || p.active === false) return T('not active');
      if (!skillFor(personId, positionId)) return T('not on this team');
      if (skillFor(personId, positionId).frequency === 'break') return T('taking a break');
      if (skillFor(personId, positionId).frequency === 'emergency' && !opts.emergency) return T('only available in emergencies');
      var kt = skillFor(personId, positionId).times;
      if (kt && kt.length && slotOf(svc) && kt.indexOf(slotOf(svc)) < 0) return T('serves at other services');
      var away = awayReason(data, personId, svc.date); if (away) return away;
      if (servingAt(svc.id, personId)) return T('already serving at this service');
      if (declined(svc.id, personId)) return T('said no to this service');
      var apart = groupsOf(data, personId, 'apart').some(function (g) {
        return g.memberIds.some(function (o) { return o !== personId && servingAt(svc.id, o); });
      });
      if (apart) return T('kept apart from someone already serving');
      var k = skillFor(personId, positionId), gap = FREQ_DAYS[k.frequency] || 14;
      var last = lastServed(personId, svc.date);
      if (last && daysBetween(last, svc.date) < (k.frequency === 'quarterly' ? gap : Math.min(gap, 7))) return T('served too recently');   // once a quarter: at least 12 weeks apart
      return '';
    }

    /** Lower is better: people who've waited longest and served least come first. */
    function score(svc, personId, positionId) {
      var k = skillFor(personId, positionId), want = FREQ_DAYS[k.frequency] || 14;
      var last = lastServed(personId, svc.date), since = last ? daysBetween(last, svc.date) : 999;
      var s = 0;
      if (since < want) s += 50 + (want - since);          // sooner than they asked to serve
      s -= Math.min(since, 120) / 7;                        // waited longer → earlier
      s += turnsIn(personId, svc.date, 56) * 3;             // spread turns over 8 weeks
      return s;
    }

    /** For a together-group, find one open slot at this service for every member (other than `first`). */
    function placeGroup(svc, group, first, firstPos) {
      var plan = [{ personId: first, positionId: firstPos }];
      var taken = {}; taken[firstPos] = 1;
      var others = group.memberIds.filter(function (m) { return m !== first; });
      for (var i = 0; i < others.length; i++) {
        var m = others[i], best = null;
        if (servingAt(svc.id, m)) continue;                 // already there: counts as together
        positions.forEach(function (pos) {
          if (!runsAt(pos, svc, data.specialSlots, data.noCommunion)) return;
          var open = (pos.needed || 1) - filled(svc.id, pos.id) - (taken[pos.id] || 0);
          if (open <= 0 || blocker(svc, m, pos.id)) return;
          var sc = score(svc, m, pos.id);
          if (!best || sc < best.sc) best = { positionId: pos.id, sc: sc };
        });
        if (!best) return { ok: false, who: m };
        plan.push({ personId: m, positionId: best.positionId });
        taken[best.positionId] = (taken[best.positionId] || 0) + 1;
      }
      return { ok: true, plan: plan };
    }

    function add(svc, personId, positionId, reason) {
      var emergency = opts.emergency && skillFor(personId, positionId).frequency === 'emergency';
      var a = { id: 'auto-' + svc.id + '-' + (++seq), serviceId: svc.id, positionId: positionId, personId: personId, status: 'pending',
        source: emergency ? 'emergency' : 'auto', reason: emergency ? T('Emergency volunteer') : reason };
      all.push(a); added.push(a);
    }

    services.forEach(function (svc) {
      positions.forEach(function (pos) {
        if (!runsAt(pos, svc, data.specialSlots, data.noCommunion)) return;   // e.g. Creche Duty only at the 8:00 service
        var guard = 0;
        while (filled(svc.id, pos.id) < (pos.needed || 1) && guard++ < 50) {
          var cands = (data.skills || []).filter(function (k) { return k.positionId === pos.id; })
            .map(function (k) { return k.personId; })
            .filter(function (pid) { return !blocker(svc, pid, pos.id); })
            .sort(function (a, b) { return (score(svc, a, pos.id) - score(svc, b, pos.id)) || (fullName(people[a]) < fullName(people[b]) ? -1 : 1); });
          var done = false, alone = [];
          for (var i = 0; i < cands.length && !done; i++) {
            var pid = cands[i], tg = groupsOf(data, pid, 'together');
            if (!tg.length) { add(svc, pid, pos.id, reasonFor(svc, pid)); done = true; break; }
            var g = tg[0], placed = placeGroup(svc, g, pid, pos.id);
            if (placed.ok) {
              placed.plan.forEach(function (x) { add(svc, x.personId, x.positionId, T('Serving together: {name}', { name: g.name })); });
              done = true;
            } else if (g.strength !== 'must') alone.push({ pid: pid, g: g });
            // "Prefer together" that can't be placed together now: only serve alone if no one else can (tried below).
            // "Must together" that can't all serve: skip this person.
          }
          if (!done && alone.length) {
            add(svc, alone[0].pid, pos.id, reasonFor(svc, alone[0].pid) + ' ' + T('(couldn’t place “{name}” together this time)', { name: alone[0].g.name }));
            done = true;
          }
          if (!done) {
            var why = (data.skills || []).filter(function (k) { return k.positionId === pos.id; }).map(function (k) {
              var b = blocker(svc, k.personId, pos.id);
              return fullName(people[k.personId]) + ': ' + (b || T('their “must serve together” group can’t all serve'));
            });
            gaps.push({ serviceId: svc.id, positionId: pos.id, missing: (pos.needed || 1) - filled(svc.id, pos.id), why: why });
            break;
          }
        }
      });
    });
    return { assignments: added, gaps: gaps };

    function reasonFor(svc, pid) {
      var last = lastServed(pid, svc.date);
      return last ? T('Fair turn: last served {n} week(s) before', { n: Math.round(daysBetween(last, svc.date) / 7) }) : T('Fair turn: hasn’t served yet');
    }
  }

  /** Checks an existing roster for problems people should know about. */
  function check(data, serviceIds) {
    var out = [], people = byId(data.people), pos = byId(data.positions);
    (data.services || []).filter(function (s) { return serviceIds.indexOf(s.id) >= 0; }).forEach(function (svc) {
      var here = (data.assignments || []).filter(function (a) { return a.serviceId === svc.id && a.status !== 'declined'; });
      here.forEach(function (a) {
        var away = awayReason(data, a.personId, svc.date);
        if (away) out.push({ serviceId: svc.id, personId: a.personId, level: 'bad', text: T('{name} is away ({why}) but rostered for {position}.', { name: fullName(people[a.personId]), why: away, position: (pos[a.positionId] || {}).name }) });
      });
      (data.groups || []).forEach(function (g) {
        var inHere = g.memberIds.filter(function (m) { return here.some(function (a) { return a.personId === m; }); });
        if (g.kind === 'apart' && inHere.length > 1) out.push({ serviceId: svc.id, level: 'bad', text: T('{group}: {names} are both serving, but should be kept apart.', { group: g.name, names: inHere.map(function (m) { return fullName(people[m]); }).join(' & ') }) });
        if (g.kind === 'together' && inHere.length && inHere.length < g.memberIds.length)
          out.push({ serviceId: svc.id, level: g.strength === 'must' ? 'bad' : 'warn', text: T('{group}: only {names} rostered – they asked to serve together.', { group: g.name, names: inHere.map(function (m) { return fullName(people[m]); }).join(', ') }) });
      });
    });
    return out;
  }

  /**
   * Turns grouped by person, for the messages that tell people they're on the roster (js/messages.js, kind 'roster'):
   * [{ personId, ids: [assignment ids] }], people in the order they first appear, turns in date order.
   * opts.waiting: only turns still waiting for a reply (pending) at services from opts.today on (for "Remind them");
   * opts.serviceIds: only these services.
   */
  function byPerson(assignments, services, opts) {
    opts = opts || {};
    var svc = byId(services), out = [], at = {};
    (assignments || []).filter(function (a) {
      var s = svc[a.serviceId]; if (!s || !a.personId) return false;
      if (opts.serviceIds && opts.serviceIds.indexOf(a.serviceId) < 0) return false;
      if (opts.waiting && (a.status !== 'pending' || (opts.today && s.date < opts.today))) return false;
      return true;
    }).sort(function (a, b) { var x = svc[a.serviceId], y = svc[b.serviceId]; return (x.date + x.time) < (y.date + y.time) ? -1 : (x.date + x.time) > (y.date + y.time) ? 1 : 0; })
      .forEach(function (a) {
        if (!at[a.personId]) { at[a.personId] = { personId: a.personId, ids: [] }; out.push(at[a.personId]); }
        at[a.personId].ids.push(a.id);
      });
    return out;
  }

  /* ---------- printing or downloading the roster: positions down the side, every Sunday across the top ---------- */
  function iso(y, m, d) { var x = new Date(y, m, d, 12); return x.getFullYear() + '-' + ('0' + (x.getMonth() + 1)).slice(-2) + '-' + ('0' + x.getDate()).slice(-2); }
  function addDays(date, n) { var d = parse(date); return iso(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function weekday(date) { return parse(date).getDay(); }
  /**
   * The terms offered when printing: [{ n, year, from, to }] – this term and the next, as the four quarters of the year
   * (Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec, close to the school terms); the dates can be changed before printing.
   */
  function terms(today) {
    var y = +today.slice(0, 4), q = Math.floor((+today.slice(5, 7) - 1) / 3), out = [];
    for (var k = 0; k < 2; k++) {
      var qq = q + k, yy = y + Math.floor(qq / 4); qq = qq % 4;
      out.push({ n: qq + 1, year: yy, from: iso(yy, qq * 3, 1), to: iso(yy, qq * 3 + 3, 0) });
    }
    return out;
  }
  /** How long a stretch to print, in weeks: 1 month, 6 weeks, 2 months, a quarter, 6 months, a year. */
  var RANGES = [4, 6, 8, 13, 26, 52];
  /** The last day of a stretch of `weeks` weeks that starts on `from`. */
  function rangeEnd(from, weeks) { return addDays(from, weeks * 7 - 1); }
  /** Which sheet a service is printed on: its regular service (8:00, 10:00…), or 'special' for all special services together. */
  function sheetOf(svc, special) { var k = slotOf(svc); return special && special.indexOf(k) >= 0 ? 'special' : k; }
  function byWhen(a, b) { var x = a.date + a.time, y = b.date + b.time; return x < y ? -1 : x > y ? 1 : 0; }
  /** The sheets that can be printed between two dates: [{ key, services: n }], in the order of their first service. */
  function printChoices(data, from, to) {
    var out = [], at = {};
    (data.services || []).filter(function (s) { return s.date >= from && s.date <= to; })
      .sort(byWhen)
      .forEach(function (s) { var k = sheetOf(s, data.specialSlots); if (!at[k]) { at[k] = { key: k, services: 0, first: s }; out.push(at[k]); } at[k].services++; });
    return out.sort(function (a, b) { return a.key === 'special' ? 1 : b.key === 'special' ? -1 : (a.first.time < b.first.time ? -1 : a.first.time > b.first.time ? 1 : 0); })
      .map(function (x) { return { key: x.key, services: x.services, name: x.key === 'special' ? '' : x.first.name }; });
  }
  /**
   * The roster as sheets to print or download: one per regular service (all the 8 o'clock services on one sheet…).
   * Every Sunday of that service between its first and last planned one is a column – a Sunday on which the service is not
   * held stays as a column (held: false, service: null) so the page says so, rather than the date quietly disappearing.
   * (Sundays after the last planned service are not columns: they are not planned yet, not cancelled.)
   * A position is printed only where someone is on it: positions that service doesn't have (Creche at 5pm, communion roles
   * without communion) and positions nobody is on are left out completely – unless opts.gaps, which keeps the positions
   * that service needs even when they are still empty, to fill in by hand. People who said no are not printed.
   * opts: { from, to, sheets: [keys from printChoices], gaps, name: function (person) }.
   * Returns [{ key, columns: [{ date, service, held }], teams: [{ teamId, name, rows: [{ position, cells: [{ names: [], na, off }] }] }] }];
   * na = the position isn't needed at that service; off = the service isn't held that day. Sheets with nothing on them are left out.
   */
  function printSheets(data, opts) {
    opts = opts || {};
    var people = byId(data.people), teamsById = byId(data.teams), nm = opts.name || fullName, want = opts.sheets;
    var every = (data.services || []).slice().sort(byWhen);
    var keys = printChoices(data, opts.from, opts.to).map(function (c) { return c.key; }).filter(function (k) { return !want || want.indexOf(k) >= 0; });
    return keys.map(function (key) {
      var ofKey = every.filter(function (s) { return sheetOf(s, data.specialSlots) === key; });
      var cols = ofKey.filter(function (s) { return s.date >= opts.from && s.date <= opts.to; }).map(function (s) { return { date: s.date, service: s, held: true }; });
      if (key !== 'special') {
        var days = {}, day = 0, most = 0, first = ofKey[0].date, last = ofKey[ofKey.length - 1].date;
        ofKey.forEach(function (s) { var w = weekday(s.date); days[w] = (days[w] || 0) + 1; if (days[w] > most) { most = days[w]; day = w; } });   // the day it is usually held (Sunday)
        var d = opts.from; while (weekday(d) !== day) d = addDays(d, 1);
        for (; d <= opts.to; d = addDays(d, 7)) {
          if (d < first || d > last || cols.some(function (c) { return c.date === d; })) continue;
          cols.push({ date: d, service: null, held: false });
        }
        cols.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
      }
      var teams = [], byTeam = {};
      (data.positions || []).forEach(function (pos) {
        var any = false, needed = false;
        var cells = cols.map(function (c) {
          if (!c.held) return { names: [], na: false, off: true };
          var s = c.service;
          var names = (data.assignments || []).filter(function (a) { return a.serviceId === s.id && a.positionId === pos.id && a.status !== 'declined'; })
            .map(function (a) { return people[a.personId] ? nm(people[a.personId]) : ''; }).filter(Boolean);
          var runs = runsAt(pos, s, data.specialSlots, data.noCommunion);
          if (names.length) any = true; if (runs) needed = true;
          return { names: names, na: !runs && !names.length, off: false };
        });
        if (!any && !(opts.gaps && needed)) return;
        if (!byTeam[pos.teamId]) { byTeam[pos.teamId] = { teamId: pos.teamId, name: (teamsById[pos.teamId] || {}).name || '', rows: [] }; teams.push(byTeam[pos.teamId]); }
        byTeam[pos.teamId].rows.push({ position: pos, cells: cells });
      });
      return { key: key, columns: cols, teams: teams };
    }).filter(function (sh) { return sh.teams.length; });
  }
  /** Splits a sheet's columns into pages that fit across the paper: [[first, last+1], …] of about equal size. */
  function pages(n, most) {
    most = most || 13; if (n <= most) return [[0, n]];
    var k = Math.ceil(n / most), size = Math.ceil(n / k), out = [];
    for (var i = 0; i < n; i += size) out.push([i, Math.min(n, i + size)]);
    return out;
  }
  /** How many Sundays fit across one page: landscape 13, portrait 7. */
  function perPage(orientation) { return orientation === 'portrait' ? 7 : 13; }


  /**
   * Who could take someone's place on a turn they can't make (Me → Serving, "Ask someone else"): people on the same team
   * who serve at that service, are free that day (not away, not already serving or said no there, not kept apart from someone
   * serving) and aren't taking a break – regular volunteers first, then backups. Returns person ids (not the turn's own person).
   */
  function coverFor(data, a) {
    var svc = (data.services || []).filter(function (s) { return s.id === a.serviceId; })[0]; if (!svc) return [];
    var people = byId(data.people), all = data.assignments || [];
    var at = function (pid) { return all.some(function (x) { return x.serviceId === svc.id && x.personId === pid && x.id !== a.id; }); };
    var serving = function (pid) { return all.some(function (x) { return x.serviceId === svc.id && x.personId === pid && x.status !== 'declined'; }); };
    var out = (data.skills || []).filter(function (k) {
      var p = people[k.personId];
      if (k.positionId !== a.positionId || k.personId === a.personId || !p || p.active === false || k.frequency === 'break') return false;
      if (k.times && k.times.length && slotOf(svc) && k.times.indexOf(slotOf(svc)) < 0) return false;
      if (awayReason(data, k.personId, svc.date) || at(k.personId)) return false;
      return !groupsOf(data, k.personId, 'apart').some(function (g) { return g.memberIds.some(function (o) { return o !== k.personId && o !== a.personId && serving(o); }); });
    });
    out.sort(function (x, y) { return (x.frequency === 'emergency') - (y.frequency === 'emergency'); });
    return out.map(function (k) { return k.personId; }).filter(function (id, i, l) { return l.indexOf(id) === i; });
  }


  /**
   * Who is serving at each service, for the volunteers there (Me → Serving, "Who's serving with you"): names and positions only.
   * Returns { serviceId: { people: [personIds], list: [{ id, n (short name), p (positionId) }] } }, leaving out anyone who said no.
   * shortName(person) → e.g. "Thandi M." (the app decides how names are shown).
   */
  function crews(data, serviceIds, shortName) {
    var people = byId(data.people), out = {};
    (data.assignments || []).forEach(function (a) {
      if (a.status === 'declined' || serviceIds.indexOf(a.serviceId) < 0) return;
      var p = people[a.personId]; if (!p) return;
      var c = out[a.serviceId] = out[a.serviceId] || { people: [], list: [] };
      if (c.people.indexOf(a.personId) < 0) c.people.push(a.personId);
      c.list.push({ id: a.personId, n: shortName ? shortName(p) : fullName(p), p: a.positionId });
    });
    Object.keys(out).forEach(function (k) { out[k].people.sort(); out[k].list.sort(function (x, y) { return x.p < y.p ? -1 : x.p > y.p ? 1 : x.n < y.n ? -1 : x.n > y.n ? 1 : 0; }); });
    return out;
  }

  return { crews: crews, coverFor: coverFor, runsAt: runsAt, autoFill: autoFill, check: check, awayReason: awayReason, groupsOf: groupsOf, fullName: fullName, byPerson: byPerson, FREQ_DAYS: FREQ_DAYS,
    terms: terms, RANGES: RANGES, rangeEnd: rangeEnd, addDays: addDays, printChoices: printChoices, printSheets: printSheets, pages: pages, perPage: perPage };
})();
if (typeof module !== 'undefined') module.exports = RosterCore;
