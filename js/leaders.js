/*
 * Church Hub – leadership groups: the Church Council, the elders, ministry leaders and so on (each church names its own).
 * A leadership group: leaderBodies/{id} = { name, open, memberIds, names: { personId: 'First Last' },
 *   seats: { personId: { role, title, portfolios: [..], from, to } },         – who serves on it now
 *   past: [{ personId, name, role, title, portfolios, from, to }] }           – who served before (kept as the church's record)
 * role = what they do on the group (Chair, Secretary, Treasurer…); title = what they are called (Churchwarden, Elder…);
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
  function seat(info) {
    info = info || {};
    return { role: text(info.role), title: text(info.title), portfolios: portfolios(info.portfolios), from: text(info.from, 10), to: text(info.to, 10) };
  }
  function rank(role) { var i = ROLES.map(function (r) { return r.toLowerCase(); }).indexOf(String(role || '').toLowerCase()); return i < 0 ? ROLES.length : i; }
  /** Who serves on the group now: [{ personId, name, role, title, portfolios, from, to }], office-bearers first. */
  function members(body) {
    var b = body || {};
    return (b.memberIds || []).map(function (pid) { return Object.assign({ personId: pid, name: (b.names || {})[pid] || '' }, seat((b.seats || {})[pid])); })
      .sort(function (x, y) { return rank(x.role) - rank(y.role) || x.name.localeCompare(y.name); });
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

  return { ROLES: ROLES, portfolios: portfolios, seat: seat, members: members, place: place, end: end, forget: forget, past: past, of: of, sees: sees, ended: ended, nameOf: nameOf };
})();
if (typeof module !== 'undefined') module.exports = Leaders;
