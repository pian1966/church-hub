/*
 * Church Hub – care groups (the church may call them home groups, cell groups, classes…: Settings → Terminology (Church Words)).
 * A care group: careGroups/{id} = { name, leaderIds, memberIds, names: { personId: 'First Last' } } – leaders (carers)
 * are members too. A person may be in several care groups (and a carer in one, a member in another). Administrators
 * and Pastors set up groups; a group's carers may add and remove its members.
 * What the group sees of each member is that member's card, careGroups/{id}/share/{personId}: their name always, and –
 * only with their "Care group" consent – photo, mobile, email, home address and birthday (day and month). Tested with
 * node: tests/care.test.js. POPIA: purpose = care and fellowship; basis = consent; access = the group, Administrators, Pastors.
 */
var Care = (function () {
  'use strict';
  var CONSENT = 'Care group';
  var FIELDS = ['firstName', 'lastName', 'preferredName', 'ok', 'mobile', 'email', 'address', 'birthday', 'photo', 'leader', 'updatedAt', 'createdAt'];

  /** The groups a person is in (by name). */
  function groupsOf(groups, pid) { return (groups || []).filter(function (g) { return (g.memberIds || []).indexOf(pid) >= 0; }).sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || '')); }); }
  /** The first group a person is in (or null). */
  function groupOf(groups, pid) { return groupsOf(groups, pid)[0] || null; }
  function isLeader(group, pid) { return !!group && (group.leaderIds || []).indexOf(pid) >= 0; }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  function nameOf(p) { return ((p.preferredName || p.firstName || '') + ' ' + (p.lastName || '')).trim(); }

  function edit(g, person, inIt, leader) {
    var pid = person.id, x = copy(g); x.memberIds = x.memberIds || []; x.leaderIds = x.leaderIds || []; x.names = x.names || {};
    if (inIt) {
      if (x.memberIds.indexOf(pid) < 0) x.memberIds.push(pid);
      x.names[pid] = nameOf(person);
      var isL = x.leaderIds.indexOf(pid) >= 0;
      if (leader && !isL) x.leaderIds.push(pid);
      if (!leader && isL) x.leaderIds = x.leaderIds.filter(function (y) { return y !== pid; });
    } else {
      x.memberIds = x.memberIds.filter(function (y) { return y !== pid; });
      x.leaderIds = x.leaderIds.filter(function (y) { return y !== pid; });
      delete x.names[pid];
    }
    return JSON.stringify(x) === JSON.stringify(g) ? null : x;
  }
  /**
   * Set which groups a person is in: want = { groupId: true (as a carer) / false (a member) }; any group not in want, they
   * leave. Returns the groups that change (copies).
   */
  function setGroups(groups, person, want) {
    want = want || {}; var out = [];
    (groups || []).forEach(function (g) {
      var inIt = Object.prototype.hasOwnProperty.call(want, g.id);
      if (!inIt && (g.memberIds || []).indexOf(person.id) < 0) return;
      var x = edit(g, person, inIt, !!want[g.id]); if (x) out.push(x);
    });
    return out;
  }
  /** Put a person in one group (or make them a carer there, or not) – their other groups stay as they are. '' = out of every group. */
  function place(groups, person, gid, leader) {
    if (!gid) return setGroups(groups, person, {});
    var g = (groups || []).filter(function (x) { return x.id === gid; })[0]; if (!g) return [];
    var x = edit(g, person, true, leader); return x ? [x] : [];
  }
  /** Take a person out of one group only. */
  function takeOut(groups, pid, gid) {
    var g = (groups || []).filter(function (x) { return x.id === gid; })[0]; if (!g) return [];
    var x = edit(g, { id: pid }, false, false); return x ? [x] : [];
  }

  /** The card a person's care group sees: everything only with their consent, otherwise just their name. */
  function card(person, consented, leader, thumb) {
    var c = { firstName: person.firstName || '', lastName: person.lastName || '', preferredName: person.preferredName || '', ok: !!consented, leader: !!leader };
    if (consented) {
      if (person.mobile) c.mobile = person.mobile;
      if (person.email) c.email = person.email;
      if (person.address && (person.address.street || person.address.city)) c.address = copy(person.address);
      if (person.birthDate) c.birthday = String(person.birthDate).slice(5, 10);   // day and month only, not the year
      if (thumb) c.photo = thumb;
    }
    return c;
  }
  /** A carer may change only who is in their own group (not its name or carers), and stays in it. */
  function leaderMayChange(before, after, pid) {
    if (!before || !after || !isLeader(before, pid)) return false;
    var same = function (k) { return JSON.stringify(before[k] || null) === JSON.stringify(after[k] || null); };
    return same('name') && same('leaderIds') && same('areas') && (after.memberIds || []).indexOf(pid) >= 0 &&
      (after.leaderIds || []).every(function (l) { return (after.memberIds || []).indexOf(l) >= 0; });
  }
  /** People in more than one group. */
  function inSeveral(groups) {
    var seen = {}, out = {};
    (groups || []).forEach(function (g) { (g.memberIds || []).forEach(function (m) { if (seen[m]) out[m] = 1; seen[m] = 1; }); });
    return Object.keys(out);
  }


  /* ---------- suggesting groups by where people live (an Administrator or Pastor confirms) ---------- */
  function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9À-ɏ]+/g, ' ').trim(); }
  function codeOf(s) { return String(s || '').replace(/\s+/g, '').toUpperCase(); }
  function hasAddress(p) { var a = p && p.address; return !!(a && (norm(a.city) || codeOf(a.postcode))); }
  /** A group's areas, typed by an Administrator: "Hilton, 3245, Howick North" → { towns, codes } (anything with a digit is a postal code). */
  function areasOf(g) {
    var towns = [], codes = [];
    (Array.isArray(g.areas) ? g.areas : String(g.areas || '').split(',')).forEach(function (x) {
      x = String(x).trim(); if (!x) return; if (/\d/.test(x)) codes.push(codeOf(x)); else towns.push(norm(x));
    });
    return { towns: towns, codes: codes };
  }
  function live(p) { return p && p.active !== false && !p.mergedInto && p.firstName !== 'Deleted' && p.category !== 'Deceased' && !p.deathDate; }
  /**
   * Suggest a care group for every Church Partner (adult, active) who isn't in one yet. Looks, in order, at:
   *  1. the people they live with (same household) – if they are in a group, the same group;
   *  2. their home address (or, without one, a household member's): its suburb/town and postal code against each group's
   *     areas (typed on the group, or a town in the group's name, e.g. "Hilton Tuesday evening") and where its members live.
   * Returns { clear: [{ id, groupId, why, place, with? }], unclear: [{ id, why, place?, groupIds }] }, both sorted by name.
   * why: 'household' | 'area' | 'neighbours' (clear); 'noAddress' | 'noGroup' | 'several' | 'households' (unclear).
   */
  function suggest(groups, people, opt) {
    opt = opt || {}; groups = groups || []; people = people || [];
    var cats = opt.categories || ['Church Partner'], byId = {}, inGroup = {};
    people.forEach(function (p) { byId[p.id] = p; });
    groups.forEach(function (g) { (g.memberIds || []).forEach(function (m) { (inGroup[m] = inGroup[m] || []).push(g.id); }); });
    var adults = people.filter(function (p) { return live(p) && p.familyRole !== 'child'; });
    function mates(p) { return p.familyId ? adults.filter(function (x) { return x.id !== p.id && x.familyId === p.familyId; }) : []; }
    function addressFor(p) { if (hasAddress(p)) return p.address; var m = mates(p).filter(hasAddress)[0]; return m ? m.address : null; }
    // every town anyone lives in – so a group called "Hilton Tuesday evening" counts as covering Hilton
    var allTowns = {}; adults.forEach(function (p) { if (hasAddress(p) && norm(p.address.city)) allTowns[norm(p.address.city)] = 1; });
    var info = groups.map(function (g) {
      var a = areasOf(g), nm = ' ' + norm(g.name) + ' ', towns = {}, codes = {}, said = {};
      a.towns.forEach(function (t) { said[t] = 1; }); a.codes.forEach(function (c) { said['#' + c] = 1; });
      Object.keys(allTowns).forEach(function (t) { if (nm.indexOf(' ' + t + ' ') >= 0) said[t] = 1; });
      (g.memberIds || []).forEach(function (m) {
        var p = byId[m]; if (!p || !hasAddress(p)) return;
        var t = norm(p.address.city), c = codeOf(p.address.postcode);
        if (t) towns[t] = (towns[t] || 0) + 1; if (c) codes[c] = (codes[c] || 0) + 1;
      });
      return { g: g, said: said, towns: towns, codes: codes };
    });
    function nameOfPlace(a) { return [String(a.city || '').trim(), String(a.postcode || '').trim()].filter(Boolean).join(' '); }
    var clear = [], unclear = [];
    adults.forEach(function (p) {
      if (cats.indexOf(p.category) < 0 || inGroup[p.id]) return;
      // 1. the people they live with
      var gs = []; mates(p).forEach(function (m) { (inGroup[m.id] || []).forEach(function (gid) { if (gs.indexOf(gid) < 0) gs.push(gid); }); });
      if (gs.length === 1) { var w = mates(p).filter(function (m) { return (inGroup[m.id] || []).indexOf(gs[0]) >= 0; })[0]; clear.push({ id: p.id, groupId: gs[0], why: 'household', with: w.id, place: '' }); return; }
      if (gs.length > 1) { unclear.push({ id: p.id, why: 'households', groupIds: gs, place: '' }); return; }
      // 2. where they live
      var a = addressFor(p); if (!a) { unclear.push({ id: p.id, why: 'noAddress', groupIds: [], place: '' }); return; }
      var t = norm(a.city), c = codeOf(a.postcode), where = nameOfPlace(a);
      var scored = info.map(function (x) {
        var named = (t && x.said[t]) || (c && x.said['#' + c]);
        var n = (t ? x.towns[t] || 0 : 0) || (c ? x.codes[c] || 0 : 0);   // neighbours: same town, or else same postal code
        return { id: x.g.id, named: !!named, score: (named ? 10 : 0) + n };
      }).filter(function (x) { return x.score > 0; }).sort(function (x, y) { return y.score - x.score; });
      if (!scored.length) { unclear.push({ id: p.id, why: 'noGroup', groupIds: [], place: where }); return; }
      var best = scored[0], next = scored[1];
      // clear when one group stands out: the only one, or the only one covering the area, or at least twice as many neighbours
      if (!next || (best.named && !next.named) || (best.named === next.named && best.score >= 2 * next.score))
        clear.push({ id: p.id, groupId: best.id, why: best.named ? 'area' : 'neighbours', place: where });
      else unclear.push({ id: p.id, why: 'several', groupIds: scored.filter(function (x) { return x.named === best.named; }).map(function (x) { return x.id; }).slice(0, 4), place: where });
    });
    var byName = function (x, y) { return nameOf(byId[x.id]).localeCompare(nameOf(byId[y.id])); };
    return { clear: clear.sort(byName), unclear: unclear.sort(byName) };
  }

  return { suggest: suggest, areasOf: areasOf, CONSENT: CONSENT, FIELDS: FIELDS, groupOf: groupOf, groupsOf: groupsOf, setGroups: setGroups, takeOut: takeOut, isLeader: isLeader, place: place, card: card, leaderMayChange: leaderMayChange, inSeveral: inSeveral, nameOf: nameOf };
})();
if (typeof module !== 'undefined') module.exports = Care;
