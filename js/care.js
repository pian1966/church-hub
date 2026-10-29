/*
 * Church Hub – care groups (the church may call them home groups, cell groups, classes…: Settings → Church wording).
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
    return same('name') && same('leaderIds') && (after.memberIds || []).indexOf(pid) >= 0 &&
      (after.leaderIds || []).every(function (l) { return (after.memberIds || []).indexOf(l) >= 0; });
  }
  /** People in more than one group. */
  function inSeveral(groups) {
    var seen = {}, out = {};
    (groups || []).forEach(function (g) { (g.memberIds || []).forEach(function (m) { if (seen[m]) out[m] = 1; seen[m] = 1; }); });
    return Object.keys(out);
  }

  return { CONSENT: CONSENT, FIELDS: FIELDS, groupOf: groupOf, groupsOf: groupsOf, setGroups: setGroups, takeOut: takeOut, isLeader: isLeader, place: place, card: card, leaderMayChange: leaderMayChange, inSeveral: inSeveral, nameOf: nameOf };
})();
if (typeof module !== 'undefined') module.exports = Care;
