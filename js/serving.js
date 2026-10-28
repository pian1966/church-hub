/*
 * Church Hub – Christ Church Howick's services, serving departments and positions (as in Elvanto).
 * Used by Rosters (one click adds them as teams and positions) and by People (the Volunteer section).
 * A position with `times` only runs at those services, e.g. Creche Duty only at 8:00.
 */
var Serving = (function () {
  'use strict';
  var TIMES = [['08:00', '8am'], ['10:00', '10am'], ['17:00', '5pm']];
  var ALL = ['08:00', '10:00', '17:00'], EIGHT = ['08:00'], TEN = ['10:00'];
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
    ['dept-creche', 'Creche', [['pos-creche', 'Creche Duty', 1, EIGHT]]]
  ];
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
        if (!have) out.positions.push({ id: p[0], teamId: t.id, name: p[1], needed: p[2], times: (p[3] || ALL).slice() });
      });
    });
    return out;
  }
  function timeLabel(t) { var x = TIMES.filter(function (y) { return y[0] === t; })[0]; return x ? x[1] : t; }
  return { TIMES: TIMES, DEPARTMENTS: DEPARTMENTS, missing: missing, timeLabel: timeLabel };
})();
if (typeof module !== 'undefined') module.exports = Serving;
