/*
 * Church Hub – administrator-created groups, separate from care, life and leadership groups.
 * A group keeps only its name, description, member IDs and visibility; it has no contact details.
 */
var CustomGroups = (function () {
  'use strict';
  var VISIBILITY = ['church', 'members'];
  function clean(group) {
    var g = group || {}, ids = [];
    (Array.isArray(g.memberIds) ? g.memberIds : []).forEach(function (id) {
      id = String(id || '').trim();
      if (id && ids.indexOf(id) < 0 && ids.length < 5000) ids.push(id);
    });
    return {
      name: String(g.name || '').replace(/\s+/g, ' ').trim().slice(0, 80),
      description: String(g.description || '').trim().slice(0, 500),
      memberIds: ids,
      visibility: VISIBILITY.indexOf(g.visibility) >= 0 ? g.visibility : 'members'
    };
  }
  function sees(group, personId, admin) {
    return !!admin || !!group && (group.visibility === 'church' || (group.memberIds || []).indexOf(personId) >= 0);
  }
  function forPerson(groups, personId, admin) {
    return (groups || []).filter(function (g) { return sees(g, personId, admin); })
      .sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || '')); });
  }
  function staff(people) {
    return (people || []).filter(function (p) {
      return p && p.active !== false && !p.mergedInto && !p.binnedAt && p.category !== 'Deceased' && (p.staff || p.category === 'Staff');
    }).sort(function (a, b) { return String(a.lastName || '').localeCompare(String(b.lastName || '')) || name(a).localeCompare(name(b)); });
  }
  function name(person) { return ((person.preferredName || person.firstName || '') + ' ' + (person.lastName || '')).trim(); }
  return { VISIBILITY: VISIBILITY, clean: clean, sees: sees, forPerson: forPerson, staff: staff, name: name };
})();
if (typeof module !== 'undefined') module.exports = CustomGroups;
