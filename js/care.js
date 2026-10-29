/*
 * Church Hub – care groups (the church may call them home groups, cell groups, classes…: Settings → Church wording).
 * A care group: careGroups/{id} = { name, leaderIds, memberIds, names: { personId: 'First Last' } } – leaders (carers)
 * are members too. Each person is in at most one care group. Administrators and Pastors set up groups; a group's
 * carers may add and remove its members.
 * What the group sees of each member is that member's card, careGroups/{id}/share/{personId}: their name always, and –
 * only with their "Care group" consent – photo, mobile, email, home address and birthday (day and month). Tested with
 * node: tests/care.test.js. POPIA: purpose = care and fellowship; basis = consent; access = the group, Administrators, Pastors.
 */
var Care = (function () {
  'use strict';
  var CONSENT = 'Care group';
  var FIELDS = ['firstName', 'lastName', 'preferredName', 'ok', 'mobile', 'email', 'address', 'birthday', 'photo', 'leader', 'updatedAt', 'createdAt'];

  /** The group a person is in (or null). */
  function groupOf(groups, pid) { return (groups || []).filter(function (g) { return (g.memberIds || []).indexOf(pid) >= 0; })[0] || null; }
  function isLeader(group, pid) { return !!group && (group.leaderIds || []).indexOf(pid) >= 0; }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  function nameOf(p) { return ((p.preferredName || p.firstName || '') + ' ' + (p.lastName || '')).trim(); }

  /**
   * Put a person in a group (gid; '' = in none), as a carer or not. Returns the groups that change (copies) –
   * a person leaves any other group, as they can be in only one.
   */
  function place(groups, person, gid, leader) {
    var pid = person.id, out = [];
    (groups || []).forEach(function (g) {
      var inIt = (g.memberIds || []).indexOf(pid) >= 0, want = g.id === gid;
      if (!inIt && !want) return;
      var x = copy(g); x.memberIds = x.memberIds || []; x.leaderIds = x.leaderIds || []; x.names = x.names || {};
      if (want) {
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
      if (JSON.stringify(x) !== JSON.stringify(g)) out.push(x);
    });
    return out;
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
  /** People in more than one group (only possible when carers of different groups add the same person). */
  function inSeveral(groups) {
    var seen = {}, out = {};
    (groups || []).forEach(function (g) { (g.memberIds || []).forEach(function (m) { if (seen[m]) out[m] = 1; seen[m] = 1; }); });
    return Object.keys(out);
  }

  return { CONSENT: CONSENT, FIELDS: FIELDS, groupOf: groupOf, isLeader: isLeader, place: place, card: card, leaderMayChange: leaderMayChange, inSeveral: inSeveral, nameOf: nameOf };
})();
if (typeof module !== 'undefined') module.exports = Care;
