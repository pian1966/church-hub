/*
 * Church Hub – leadership groups: the Church Council, the elders, ministry leaders and so on (each church names its own).
 * A leadership group: leaderBodies/{id} = { name, open, memberIds, names: { personId: 'First Last' },
 *   seats: { personId: { role, roles, title, portfolios: [..], kind, kindOther, from, to, term, termFrom } },  – who serves on it now
 *   past: [{ personId, name, role, roles, title, portfolios, kind, kindOther, from, to, term }],   – who served before (the church's record)
 *   termYears, maxTerms, breakYears }   – how long a term of office is, how many terms in a row are allowed, and the break after
 * roles = what they do on the group (Chair, Secretary, Treasurer… – more than one is allowed; role = the first, for older
 * readers); kind = elected, coopted or other (older blank values mean elected); kindOther describes 'other'; term = which term of office they are in (1, 2…), started on
 * termFrom (or from, for their first); to = when the current term ends (worked out from termYears when not typed);
 * title = what they are called (Churchwarden, Elder…);
 * portfolios = what they look after (Finance, Buildings, Youth…). All are the church's own words.
 * open = everyone who signs in may see the group; otherwise only its members, Administrators and Pastors.
 * Administrators and Pastors set the groups up. The Archive uses memberIds: records "for a leadership group" are read by its members.
 * Tested with node: tests/leaders.test.js. POPIA: purpose = church governance; basis = legitimate interest (office-bearers
 * are known to the congregation); access = as above; only names and roles are kept here, never contact details.
 */
var Leaders = (function () {
  'use strict';
  var TX = function (x) { return x; };   // translated where it is shown
  /** Suggested roles, in the order they are listed on a group (anything else comes after, by name). */
  var ROLES = [TX('Chair'), TX('Vice-chair'), TX('Secretary'), TX('Treasurer')];
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  function nameOf(p) { return ((p.preferredName || p.firstName || '') + ' ' + (p.lastName || '')).trim(); }
  function text(x, max) { return String(x || '').replace(/\s+/g, ' ').trim().slice(0, max || 80); }
  /** "Finance, Buildings ,  Youth" → ['Finance', 'Buildings', 'Youth'] (at most 8, no repeats). */
  function portfolios(s) {
    var out = [];
    (Array.isArray(s) ? s : String(s || '').split(/[,;\n]/)).forEach(function (x) { x = text(x, 60); if (x && out.map(function (y) { return y.toLowerCase(); }).indexOf(x.toLowerCase()) < 0) out.push(x); });
    return out.slice(0, 8);
  }
  var KINDS = ['elected', 'coopted', 'other'];
  /** "Chair, Treasurer" or ['Chair', 'Treasurer'] → ['Chair', 'Treasurer'] (at most 4, no repeats). */
  function roles(s) { return portfolios(s).slice(0, 4); }
  function seat(info) {
    info = info || {};
    var rs = roles(info.roles && (info.roles.length || typeof info.roles === 'string') ? info.roles : info.role);
    var kind = info.kind || 'elected';
    if (KINDS.indexOf(kind) < 0) kind = 'elected';
    var out = { role: rs[0] || '', roles: rs, title: text(info.title), portfolios: portfolios(info.portfolios), kind: kind, kindOther: kind === 'other' ? text(info.kindOther) : '', from: text(info.from, 10), to: text(info.to, 10) };
    var t = Math.round(+info.term) || 0; if (t > 1) out.term = Math.min(t, 20);
    if (info.termFrom && t > 1) out.termFrom = text(info.termFrom, 10);
    return out;
  }
  function rank1(role) { var i = ROLES.map(function (r) { return r.toLowerCase(); }).indexOf(String(role || '').toLowerCase()); return i < 0 ? ROLES.length : i; }
  /** The highest-ranked of someone's roles (a Chair who is also Treasurer is listed as the Chair). */
  function rank(rs) { return Math.min.apply(null, [ROLES.length].concat([].concat(rs || []).map(rank1))); }
  /** Who serves on the group now: [{ personId, name, role, title, portfolios, from, to }], office-bearers first. */
  function members(body) {
    var b = body || {};
    return (b.memberIds || []).map(function (pid) { return Object.assign({ personId: pid, name: (b.names || {})[pid] || '' }, seat((b.seats || {})[pid])); })
      .sort(function (x, y) { return rank(x.roles) - rank(y.roles) || x.name.localeCompare(y.name); });
  }
  /** Add someone to the group, or change their role, title, portfolios and dates. Returns a changed copy. */
  function place(body, person, info) {
    var x = copy(body); x.memberIds = x.memberIds || []; x.names = x.names || {}; x.seats = x.seats || {};
    if (x.memberIds.indexOf(person.id) < 0) x.memberIds.push(person.id);
    x.names[person.id] = nameOf(person) || x.names[person.id] || '';
    x.seats[person.id] = seat(info);
    return x;
  }
  /** Their time on the group has ended: they move to "served before" (keep = false: taken off without a trace, for a mistake). */
  function end(body, pid, date, keep) {
    var x = copy(body), s = seat((x.seats || {})[pid]), name = (x.names || {})[pid] || '';
    if ((x.memberIds || []).indexOf(pid) < 0) return x;
    x.memberIds = x.memberIds.filter(function (m) { return m !== pid; });
    if (x.names) delete x.names[pid];
    if (x.seats) delete x.seats[pid];
    if (keep !== false) { s.to = text(date, 10) || s.to; x.past = (x.past || []).concat([Object.assign({ personId: pid, name: name }, s)]); }
    return x;
  }
  /** Take a line off "served before" (by its place in the list). */
  function forget(body, i) { var x = copy(body); x.past = (x.past || []).filter(function (p, n) { return n !== i; }); return x; }
  /** Served before, the most recent first. Each keeps its place in the saved list (i) for forget(). */
  function past(body) {
    return ((body || {}).past || []).map(function (p, i) { return Object.assign({ i: i }, p); }).sort(function (a, b) { return String(b.to || '').localeCompare(String(a.to || '')) || String(a.name).localeCompare(String(b.name)); });
  }
  /** The groups someone serves on now: [{ body, role, title, portfolios }]. */
  function of(bodies, pid) {
    return (bodies || []).filter(function (b) { return (b.memberIds || []).indexOf(pid) >= 0; })
      .sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || '')); })
      .map(function (b) { return Object.assign({ body: b }, seat((b.seats || {})[pid])); });
  }
  /** May this person see the group? (The database rules say the same.) */
  function sees(body, pid, manager) { return !!manager || (body || {}).open === true || ((body || {}).memberIds || []).indexOf(pid) >= 0; }
  /** Whose time on a group has run out (a "to" date before today) and who is still listed as serving. */
  function ended(body, today) { return members(body).filter(function (m) { return m.to && m.to < today; }); }


  /* ---------- terms of office ---------- */
  var NOTICE_MONTHS = 4;   // Administrators and the Rector are told this long before a term ends
  function parse(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? Date.UTC(+p[0], +p[1] - 1, +p[2]) : NaN; }
  function addMonths(iso, n) {
    var p = String(iso).split('-'), y = +p[0], m = +p[1] - 1 + n, d = +p[2];
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    var last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return new Date(Date.UTC(y, m, Math.min(d, last))).toISOString().slice(0, 10);
  }
  function days(a, b) { return Math.round((parse(b) - parse(a)) / 86400000); }
  /** A group's rules for terms of office, tidied: { termYears, maxTerms, breakYears } (0 = no rule). */
  function terms(body) {
    var n = function (x, max) { x = Math.round(+x) || 0; return Math.max(0, Math.min(max, x)); };
    var b = body || {};
    return { termYears: n(b.termYears, 20), maxTerms: n(b.maxTerms, 20), breakYears: n(b.breakYears, 20) };
  }
  /**
   * Where someone is in their term of office: null when there is no start date, or no end (neither a "to" date nor a term
   * length on the group). → { n (which term), max (terms allowed in a row; 0 = no limit), start, end, pct (how far through),
   * left (days to the end), soon (within NOTICE_MONTHS of the end), over (the end has passed), again (may stand for another
   * term), rest (the date their break ends, when they may not stand again) }.
   */
  function term(body, info, today) {
    var r = terms(body), s = seat(info), start = s.termFrom || s.from, end = s.to || (start && r.termYears ? addMonths(start, 12 * r.termYears) : '');
    if (!start || !end || isNaN(parse(start)) || isNaN(parse(end))) return null;
    var n = s.term || 1, total = Math.max(1, days(start, end)), done = Math.max(0, Math.min(total, days(start, today))), left = days(today, end);
    var again = !r.maxTerms || n < r.maxTerms;
    return { n: n, max: r.maxTerms, start: start, end: end, pct: Math.round(done / total * 100), left: left, soon: left >= 0 && today >= addMonths(end, -NOTICE_MONTHS), over: left < 0,
      again: again, rest: !again && r.breakYears ? addMonths(end, 12 * r.breakYears) : '' };
  }
  /** Start someone's next term: the new term begins when the last one ends (or today, when no end is known). null when they
   *  have served every term allowed in a row. */
  function renew(body, pid, today) {
    var t = term(body, (body.seats || {})[pid], today), s = seat((body.seats || {})[pid]);
    if (t && !t.again) return null;
    var x = copy(body), next = Object.assign({}, s, { term: (s.term || 1) + 1, termFrom: t ? t.end : today, to: '' });
    var r = terms(body); if (r.termYears) next.to = addMonths(next.termFrom, 12 * r.termYears);
    x.seats = x.seats || {}; x.seats[pid] = seat(next);
    return x;
  }
  /** Terms ending within NOTICE_MONTHS (or already ended) on these groups: [{ body, m (from members()), t (from term()) }],
   *  the soonest first. */
  function ending(bodies, today) {
    var out = [];
    (bodies || []).forEach(function (b) { members(b).forEach(function (m) { var t = term(b, m, today); if (t && (t.soon || t.over)) out.push({ body: b, m: m, t: t }); }); });
    return out.sort(function (a, b) { return a.t.end.localeCompare(b.t.end) || a.m.name.localeCompare(b.m.name); });
  }
  /** Someone being added again: are they still on their break? → the date it ends, or ''. (Served the most terms in a
   *  row allowed, and their last term ended less than breakYears ago.) */
  function resting(body, pid, today) {
    var r = terms(body); if (!r.maxTerms || !r.breakYears) return '';
    var last = past(body).filter(function (p) { return p.personId === pid && p.to; })[0];
    if (!last || (last.term || 1) < r.maxTerms) return '';
    var until = addMonths(last.to, 12 * r.breakYears);
    return until > today ? until : '';
  }

  return { NOTICE_MONTHS: NOTICE_MONTHS, KINDS: KINDS, roles: roles, terms: terms, term: term, renew: renew, ending: ending, resting: resting, addMonths: addMonths, ROLES: ROLES, portfolios: portfolios, seat: seat, members: members, place: place, end: end, forget: forget, past: past, of: of, sees: sees, ended: ended, nameOf: nameOf };
})();
if (typeof module !== 'undefined') module.exports = Leaders;
