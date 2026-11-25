/* Church & Trellis – Church health: the checks an Administrator can look over every week, fortnight or month (pure rules, no screens;
 * tested in tests/health.test.js). The card on Home is js/health-ui.js.
 *
 * Each check gives only a COUNT and where to go to put it right – never a name – so the card, and anything that later
 * reports it (a robot's log is public), cannot give away who it is about. `first` is the person to open when the count is
 * for people (an Administrator is looking at it, and may open anyone anyway).
 *
 * run(data) → [{ id, cadence: 'weekly' | 'fortnightly' | 'monthly', count, first, href }], in the order they are shown.
 *   data = { today: 'YYYY-MM-DD', people, services, assignments, careGroups, retentionMonths, addressMismatches (a number) }
 *
 *   rosterGone   (weekly)      turns in the next 3 weeks held by someone who has left, has died or is no longer on the records
 *   addresses    (weekly)      married couples and partners whose home addresses differ (counted by js/households.js)
 *   marriage     (fortnightly) records that don't add up: Widowed but a living spouse is linked; a wedding anniversary but not married;
 *                              a spouse link that goes one way only
 *   unreachable  (fortnightly) active adults with no email address and no mobile number
 *   noLeader     (fortnightly) Care Groups and Midweek Groups with no leader
 *   retention    (monthly)     people who left longer ago than the retention period and are waiting under Privacy → Retention
 */
var Health = (function () {
  'use strict';
  var DAY = 864e5, AHEAD = 21;
  var WEDDING = /wedding|anniversary|married/i;
  var UNKNOWN = /^(unknown|n\/a|none|-)?$/i;

  function iso(ms) { return new Date(ms).toISOString().slice(0, 10); }
  function addDays(d, n) { return iso(Date.parse(d + 'T12:00:00Z') + n * DAY); }
  function isGone(p) { return !p || p.active === false || !!p.deceasedAt || p.category === 'Deceased' || p.category === 'Former member' || !!p.mergedInto; }
  function filled(v) { return !UNKNOWN.test(String(v == null ? '' : v).trim()); }
  function adult(p) { return p.familyRole !== 'child'; }
  function person(c) { return c && c.length ? c[0].id : ''; }

  /** Turns from today to 3 weeks ahead (not at a cancelled service, not already declined) held by someone who is gone. */
  function rosterGone(d) {
    var byId = {}; (d.people || []).forEach(function (p) { byId[p.id] = p; });
    var until = addDays(d.today, AHEAD), sv = {};
    (d.services || []).forEach(function (s) { if (s.date >= d.today && s.date <= until && !s.cancelled) sv[s.id] = 1; });
    return (d.assignments || []).filter(function (a) { return sv[a.serviceId] && a.status !== 'declined' && isGone(byId[a.personId]); });
  }

  function weddingDate(p) { return (p.keyDates || []).some(function (k) { return WEDDING.test(k.label || '') && k.date; }); }
  /** People whose marriage records disagree with each other. */
  function marriage(d) {
    var byId = {}; (d.people || []).forEach(function (p) { byId[p.id] = p; });
    return (d.people || []).filter(function (p) {
      if (isGone(p) || !adult(p)) return false;
      var sp = p.spouseId ? byId[p.spouseId] : null, live = sp && !isGone(sp);
      if (p.maritalStatus === 'Widowed' && live) return true;                                              // widowed, yet a living spouse is linked
      if (weddingDate(p) && /^(Single|Engaged|Divorced)$/.test(p.maritalStatus || '')) return true;        // an anniversary, but not married
      if (live && sp.spouseId !== p.id) return true;                                                       // the link goes one way only
      return false;
    });
  }

  /** Active adults the church has no way to reach. */
  function unreachable(d) {
    return (d.people || []).filter(function (p) {
      return !isGone(p) && adult(p) && /^(Church Partner|Attender|Staff|Visiting Minister)$/.test(p.category || '') && !filled(p.email) && !filled(p.mobile);
    });
  }

  function noLeader(d) { return (d.careGroups || []).filter(function (g) { return !(g.leaderIds || []).length; }); }

  /** People who left more than the church's retention period ago (Settings: 12, 24, … months; 24 if not chosen) and are not yet deleted –
   *  the ones to look at under Privacy → Retention. Someone who has died stays on the records, so they are not counted. */
  function retention(d) {
    var cutoff = addDays(d.today, -Math.round((+d.retentionMonths || 24) * 30.4));
    return (d.people || []).filter(function (p) {
      return p.active === false && p.firstName !== 'Deleted' && !p.binnedAt && !p.deceasedAt && p.category !== 'Deceased' && !p.mergedInto
        && String(p.archivedAt || p.updatedAt || p.createdAt || '9999').slice(0, 10) < cutoff;
    });
  }

  function run(d) {
    d = Object.assign({}, d || {}); if (!d.today) d.today = iso(Date.now());
    var out = [], put = function (id, cadence, list, href) {
      var n = typeof list === 'number' ? list : list.length;
      out.push({ id: id, cadence: cadence, count: n, first: typeof list === 'number' ? '' : person(list), href: href });
    };
    put('rosterGone', 'weekly', rosterGone(d), '#/rosters');
    put('addresses', 'weekly', +d.addressMismatches || 0, '#/people/families');
    put('marriage', 'fortnightly', marriage(d), '#/people');
    put('unreachable', 'fortnightly', unreachable(d), '#/people');
    put('noLeader', 'fortnightly', noLeader(d), '#/groups');
    put('retention', 'monthly', retention(d), '#/privacy/retention');
    return out;
  }

  var Health = { run: run, rosterGone: rosterGone, marriage: marriage, unreachable: unreachable, noLeader: noLeader, retention: retention, isGone: isGone };
  if (typeof module !== 'undefined' && module.exports) { module.exports = Health; }
  return Health;
})();
