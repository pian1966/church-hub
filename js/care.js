/*
 * Church Hub – care groups (the church may call them home groups, cell groups, classes…: Settings → Terminology (Church Words)).
 * A care group: careGroups/{id} = { name, leaderIds, memberIds, names: { personId: 'First Last' }, type } – type 'life' for a
 * life group (Bible study, midweek group: js/mod-life.js), which works the same way. Leaders (carers)
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
  /** A carer may change only who is in their own group (not its name or carers), and stays in it. A life group's leaders
   *  (type 'life': Bible studies, midweek groups) may also name their group. */
  function leaderMayChange(before, after, pid) {
    if (!before || !after || !isLeader(before, pid)) return false;
    var same = function (k) { return JSON.stringify(before[k] || null) === JSON.stringify(after[k] || null); };
    return (same('name') || (before.type === 'life' && String(after.name || '').trim() !== '')) && same('type') && same('leaderIds') && same('areas') && (after.memberIds || []).indexOf(pid) >= 0 &&
      (after.leaderIds || []).every(function (l) { return (after.memberIds || []).indexOf(l) >= 0; });
  }
  /** People in more than one group. */
  function inSeveral(groups) {
    var seen = {}, out = {};
    (groups || []).forEach(function (g) { (g.memberIds || []).forEach(function (m) { if (seen[m]) out[m] = 1; seen[m] = 1; }); });
    return Object.keys(out);
  }


  /* ---------- suggesting groups by where people live (an Administrator or Pastor confirms) ---------- */
  // Capitals, apostrophes and "Saint"/"St." don't matter: "St John's Village" = "Saint Johns village" = "st johns village".
  function norm(s) { return String(s || '').toLowerCase().replace(/['’`]/g, '').replace(/[^a-z0-9À-ɏ]+/g, ' ').trim().replace(/(^| )saint(?= |$)/g, '$1st'); }
  function codeOf(s) { return String(s || '').replace(/\s+/g, '').toUpperCase(); }
  function hasAddress(p) { var a = p && p.address; return !!(a && (norm(a.street) || norm(a.street2) || norm(a.city) || codeOf(a.postcode))); }
  /** A group's areas, typed by an Administrator: "Hilton, 3245, Howick North" → { towns, codes } (anything with a digit is a postal code). */
  function areasOf(g) {
    var towns = [], codes = [];
    (Array.isArray(g.areas) ? g.areas : String(g.areas || '').split(',')).forEach(function (x) {
      x = String(x).trim(); if (!x) return; if (/\d/.test(x)) codes.push(codeOf(x)); else towns.push(norm(x));
    });
    return { towns: towns, codes: codes };
  }
  // Words in a group's name that say when or who, not where: "Amber Glen Tuesday ladies" → the place is "amber glen".
  var NOT_PLACE = ('monday tuesday wednesday thursday friday saturday sunday mon tue tues wed thu thur thurs fri sat sun mondays tuesdays wednesdays thursdays fridays saturdays sundays ' +
    'maandag dinsdag woensdag donderdag vrydag saterdag sondag oggend middag aand ' +
    'morning mornings afternoon afternoons evening evenings night nights day daytime am pm weekly fortnightly monthly early late ' +
    'ladies ladys women womens woman men mens man youth young adults adult couples couple seniors senior singles students student mothers moms mums dads fathers families family dames mans jeug ' +
    'care cell home house group groups grp bible study fellowship prayer community life connect class small kinship circle selgroep groep ' +
    'the of in at on for with a an').split(' ');
  var NOT = {}; NOT_PLACE.forEach(function (w) { NOT[w] = 1; });
  /** The places a group's name names: "Amber Glen & Howick North (Tuesday)" → ["amber glen", "howick north"]. */
  function namePlaces(name) {
    return String(name || '').replace(/\([^)]*\)/g, ' ').split(/\s*(?:&|\/|,|\+|;| and | en | - | – )\s*/i).map(function (part) {
      return norm(part).split(' ').filter(function (w) { return w && !NOT[w] && !/^\d{1,2}(h\d*|am|pm)?$/.test(w); }).join(' ');
    }).filter(function (x) { return x.length > 2; });
  }
  function live(p) { return p && p.active !== false && !p.mergedInto && p.firstName !== 'Deleted' && p.category !== 'Deceased' && !p.deathDate; }
  /** Does this place ("amber glen") appear, as whole words, in this text ("12 amber glen howick")? */
  // Spaces don't matter: "Amberglen" is "Amber Glen", and "Amber Glen" is a group called "Amberglen".
  function within(text, place) {
    if (!place) return false;
    if ((' ' + text + ' ').indexOf(' ' + place + ' ') >= 0) return true;
    var want = place.replace(/ /g, ''), w = text.split(' ');
    for (var i = 0; i < w.length; i++) for (var j = i, joined = ''; j < w.length && j < i + 4; j++) { joined += w[j]; if (joined === want) return true; if (joined.length >= want.length) break; }
    return false;
  }
  /** The street without the house number ("12a Main Rd", "1 A Link Road" → "main rd", "link road"): people on the same street, estate or complex are near neighbours. */
  function streetOf(s) { return norm(String(s || '').split(',')[0]).replace(/^(unit |flat |no |nr )?\d+( ?[a-z])?\s+/, ''); }
  /** An address typed on one line ("1 A Link Road, Greendale, Howick") with no town: the last part after a comma is the town. */
  function townOf(a) {
    if (norm(a.city)) return norm(a.city);
    var parts = [a.street, a.street2].join(',').split(',').map(norm).filter(Boolean);
    return parts.length > 1 ? parts[parts.length - 1] : '';
  }
  /**
   * Suggest a care group for every Church Partner (adult, active) who isn't in one yet. Looks, in order, at:
   *  1. the people they live with (same household) – if they are in a group, the same group;
   *  2. their home address (or, without one, a household member's), as deep as it goes: a place a group is named after
   *     (or its typed areas) found in the street, estate or suburb lines ("Amber Glen", "Howick North") wins over one found
   *     only in the town ("Howick"), and a longer place over a shorter one; then neighbours – members living in the same
   *     street, estate or complex, then the same town or postal code.
   * Someone who only matches a town ("Howick") while several groups meet in that town is not clear: which part of town?
   * Returns { clear: [{ id, groupId, why, place, with? }], unclear: [{ id, why, place?, groupIds }] }, both sorted by name.
   * why: 'household' | 'area' | 'neighbours' (clear); 'noAddress' | 'noGroup' | 'several' | 'whichPart' | 'households' (unclear).
   */
  function suggest(groups, people, opt) {
    opt = opt || {}; groups = groups || []; people = people || [];
    var cats = opt.categories || ['Church Partner'], byId = {}, inGroup = {};
    people.forEach(function (p) { byId[p.id] = p; });
    groups.forEach(function (g) { (g.memberIds || []).forEach(function (m) { (inGroup[m] = inGroup[m] || []).push(g.id); }); });
    var adults = people.filter(function (p) { return live(p) && p.familyRole !== 'child'; });
    function mates(p) { return p.familyId ? adults.filter(function (x) { return x.id !== p.id && x.familyId === p.familyId; }) : []; }
    function addressFor(p) { if (hasAddress(p)) return p.address; var m = mates(p).filter(hasAddress)[0]; return m ? m.address : null; }
    var info = groups.map(function (g) {
      var a = areasOf(g), places = namePlaces(g.name).concat(a.towns).filter(function (x, i, all) { return all.indexOf(x) === i; });
      var near = [];   // where its members live
      (g.memberIds || []).forEach(function (m) { var p = byId[m]; if (p && hasAddress(p)) near.push(p.address); });
      return { g: g, places: places, codes: a.codes, near: near };
    });
    function nameOfPlace(a) { return [String(a.city || '').trim() || title(townOf(a)), String(a.postcode || '').trim()].filter(Boolean).join(' '); }
    function title(s) { return s.replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }
    var clear = [], unclear = [];
    adults.forEach(function (p) {
      if (cats.indexOf(p.category) < 0 || inGroup[p.id]) return;
      // 1. the people they live with
      var gs = []; mates(p).forEach(function (m) { (inGroup[m.id] || []).forEach(function (gid) { if (gs.indexOf(gid) < 0) gs.push(gid); }); });
      if (gs.length === 1) { var w = mates(p).filter(function (m) { return (inGroup[m.id] || []).indexOf(gs[0]) >= 0; })[0]; clear.push({ id: p.id, groupId: gs[0], why: 'household', with: w.id, place: '' }); return; }
      if (gs.length > 1) { unclear.push({ id: p.id, why: 'households', groupIds: gs, place: '' }); return; }
      // 2. where they live
      var a = addressFor(p); if (!a) { unclear.push({ id: p.id, why: 'noAddress', groupIds: [], place: '' }); return; }
      var deep = norm([a.street, a.street2].join(' ')), town = townOf(a), code = codeOf(a.postcode), street = streetOf(a.street), estate = norm(a.street2);
      var scored = info.map(function (x) {
        // how specifically the group's name (or areas) matches: 2 = street/estate/suburb line, 1 = town or postal code
        var level = 0, len = 0, hit = '';
        x.places.forEach(function (pl) {
          var lv = within(deep, pl) ? 2 : within(town, pl) ? 1 : 0, ln = pl.split(' ').length;
          if (lv > level || (lv === level && lv && ln > len)) { level = lv; len = ln; hit = pl; }
        });
        if (!level && code && x.codes.indexOf(code) >= 0) { level = 1; len = 1; hit = code; }
        var close = 0, sameTown = 0;
        x.near.forEach(function (n) {
          if ((estate && (norm(n.street2) === estate || within(norm(n.street2), estate))) || (street && streetOf(n.street) === street && townOf(n) === town)) close++;
          else if (town ? townOf(n) === town : code && codeOf(n.postcode) === code) sameTown++;   // a postal code often covers several parts of town
        });
        return { id: x.g.id, level: level, len: len, hit: hit, close: close, town: sameTown };
      }).filter(function (x) { return x.level || x.close || x.town; });
      // only their town is known ("Howick") and groups are named after parts of it ("Howick West", "Howick Central"): which part?
      var parts = town ? info.filter(function (x) { return x.places.some(function (pl) { return pl !== town && within(pl, town); }); }) : [];
      if (!scored.some(function (x) { return x.level; }) && parts.length) { unclear.push({ id: p.id, why: 'whichPart', groupIds: parts.map(function (x) { return x.g.id; }).slice(0, 4), place: String(a.city || '').trim() || title(townOf(a)) }); return; }
      if (!scored.length) { unclear.push({ id: p.id, why: 'noGroup', groupIds: [], place: nameOfPlace(a) }); return; }
      function by(k) { return function (x, y) { return y[k] - x[k]; }; }
      // the best named match: deepest line first, then the longest place name
      var named = scored.filter(function (x) { return x.level; }).sort(function (x, y) { return y.level - x.level || y.len - x.len || y.close - x.close || y.town - x.town; });
      if (named.length) {
        var top = named.filter(function (x) { return x.level === named[0].level && x.len === named[0].len; });
        if (top.length === 1) {
          // only the town matched, but other groups have members in other parts of that town: ask which part
          var others = named[0].level === 1 ? scored.filter(function (x) { return x.id !== named[0].id && (x.close || x.town); }) : [];
          if (!others.length) { clear.push({ id: p.id, groupId: named[0].id, why: 'area', place: title(named[0].hit) }); return; }
          unclear.push({ id: p.id, why: 'whichPart', groupIds: [named[0].id].concat(others.sort(by('town')).map(function (x) { return x.id; })).slice(0, 4), place: String(a.city || '').trim() || nameOfPlace(a) }); return;
        }
        // several groups name the same place: their members decide (twice as many near neighbours)
        top.sort(function (x, y) { return y.close - x.close || y.town - x.town; });
        if (top[0].close && top[0].close >= 2 * top[1].close) { clear.push({ id: p.id, groupId: top[0].id, why: 'neighbours', place: title(top[0].hit) }); return; }
        unclear.push({ id: p.id, why: 'several', groupIds: top.map(function (x) { return x.id; }).slice(0, 4), place: nameOfPlace(a) }); return;
      }
      // no group is named after where they live: neighbours in the same street or estate, then in the same town
      var k = scored.some(function (x) { return x.close; }) ? 'close' : 'town', nb = scored.filter(function (x) { return x[k]; }).sort(by(k));
      if (!nb[1] || nb[0][k] >= 2 * nb[1][k]) { clear.push({ id: p.id, groupId: nb[0].id, why: 'neighbours', place: k === 'close' ? title(estate || street) : nameOfPlace(a) }); return; }
      unclear.push({ id: p.id, why: 'several', groupIds: nb.map(function (x) { return x.id; }).slice(0, 4), place: nameOfPlace(a) });
    });
    var byName = function (x, y) { return nameOf(byId[x.id]).localeCompare(nameOf(byId[y.id])); };
    return { clear: clear.sort(byName), unclear: unclear.sort(byName) };
  }

  return { suggest: suggest, areasOf: areasOf, CONSENT: CONSENT, FIELDS: FIELDS, groupOf: groupOf, groupsOf: groupsOf, setGroups: setGroups, takeOut: takeOut, isLeader: isLeader, place: place, card: card, leaderMayChange: leaderMayChange, inSeveral: inSeveral, nameOf: nameOf };
})();
if (typeof module !== 'undefined') module.exports = Care;
