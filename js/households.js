/*
 * Church Hub – households and the adults responsible for children (as in Planning Center and ChurchSuite, combined).
 * Pure functions, tested with node: tests/households.test.js.
 *
 *  - A household (the `families` collection) is where people live. A person's main household is `familyId`; a child of
 *    separated parents can also be in other households (`householdIds`). Households are named after their adults.
 *  - Responsible adults are links on the child (`guardians` collection), independent of households:
 *      { childId, adultId | name + phone (someone not in Church Hub), relationship, canConsent, primary, mayCollect, confirmed }
 *    canConsent: may give consent for the child (POPIA s35: a "competent person" – a parent or legal guardian).
 *    primary: gets messages about the child.  mayCollect: may sign the child out.  confirmed: checked by a person
 *    (links made automatically from households or Elvanto start unconfirmed).
 *  - Not allowed to collect (`noCollect` collection, restricted): { childId, personId | name, note } – e.g. a court order.
 */
var Households = (function () {
  'use strict';
  var RELATIONSHIPS = ['Mother', 'Father', 'Parent', 'Step-parent', 'Legal guardian', 'Foster carer', 'Grandparent', 'Other relative', 'Trusted collector'];
  /** Relationships that can normally give consent for a child (a parent or legal guardian). */
  var CONSENTING = ['Mother', 'Father', 'Parent', 'Legal guardian', 'Foster carer'];

  function householdsOf(p) {
    if (!p) return [];
    var out = p.familyId ? [p.familyId] : [];
    (p.householdIds || []).forEach(function (h) { if (h && out.indexOf(h) < 0) out.push(h); });
    return out;
  }
  function inHousehold(p, fid) { return householdsOf(p).indexOf(fid) >= 0; }
  function linksOf(childId, links) { return (links || []).filter(function (l) { return l.childId === childId; }); }
  function consentAdults(childId, links) { return linksOf(childId, links).filter(function (l) { return l.canConsent && l.adultId; }); }
  function childrenOf(adultId, links) { return (links || []).filter(function (l) { return l.adultId === adultId; }); }
  function defaultsFor(rel) {
    var c = CONSENTING.indexOf(rel) >= 0;
    return { canConsent: c, primary: c, mayCollect: true };
  }

  /**
   * Links to add for children who have none yet: the adults of each household the child is in, as "Parent",
   * may consent and collect – unconfirmed, so a person checks them. Used once when upgrading existing data.
   */
  function suggestedLinks(people, links) {
    var out = [], have = {};
    (links || []).forEach(function (l) { have[l.childId] = 1; });
    (people || []).forEach(function (c) {
      if (c.familyRole !== 'child' || have[c.id] || c.active === false) return;
      var hs = householdsOf(c);
      (people || []).filter(function (a) { return a.familyRole !== 'child' && a.active !== false && hs.some(function (h) { return a.familyId === h; }); })
        .forEach(function (a) { out.push({ childId: c.id, adultId: a.id, relationship: 'Parent', canConsent: true, primary: true, mayCollect: true, confirmed: false }); });
    });
    return out;
  }

  /** Children who need attention: nobody who can consent, or links still to be confirmed. */
  function needs(people, links) {
    var kids = (people || []).filter(function (p) { return p.familyRole === 'child' && p.active !== false; });
    return {
      noConsenter: kids.filter(function (c) { return !consentAdults(c.id, links).length; }),
      unconfirmed: kids.filter(function (c) { return linksOf(c.id, links).some(function (l) { return !l.confirmed; }); })
    };
  }

  /* ---------- couples: who in a household is probably married to whom ---------- */
  var WEDDING = /wedding|anniversary|married/i, UNKNOWN = { '': 1, 'Not known': 1 };
  function weddingOf(p) { var k = (p.keyDates || []).filter(function (x) { return WEDDING.test(x.label || ''); })[0]; return k ? k.date : ''; }
  function yearOf(d) { return /^\d{4}/.test(d || '') ? +d.slice(0, 4) : null; }
  function pairKey(a, b) { return [a, b].sort().join('|'); }
  /**
   * Suggested couples, household by household: spouses (marital status "Married") or partners ("Partner").
   * Only living, active adults are considered.
   *  - A couple shares one status (both "Married", or both "Partner"); one of the two may have no status recorded yet,
   *    but then only with the same surname or the same anniversary.
   *  - Scored: same anniversary date +4, same surname +2, both with the status +1, different anniversary dates -2,
   *    more than 25 years apart in age -4 (a parent and a married son or daughter). Best pairs first, each person once.
   *  - A pair the church said is "not a couple" (families.notCouples: ["id1|id2"]) is never suggested again;
   *    a pair a person confirmed (families.couples: ["id1|id2"]) is shown as certain.
   * Returns [{ familyId, a, b, kind: 'spouse'|'partner', sure, confirmed, copy: { from, to, date } | null, differ, mark: { id, status } | null }]:
   *   sure - the only two adults in the household who could be a couple;
   *   copy - spouses only: one has a wedding anniversary and the other doesn't (partners have no anniversary);
   *   differ - spouses who both have one, but different; mark - the other's marital status isn't recorded.
   */
  function couples(people, families) {
    var out = [], seen = {}, KIND = { Married: 'spouse', Partner: 'partner' };
    (families || []).forEach(function (f) {
      var no = {}, yes = {}; (f.notCouples || []).forEach(function (k) { no[k] = 1; }); (f.couples || []).forEach(function (k) { yes[k] = 1; });
      var adults = (people || []).filter(function (p) {
        return p.familyRole !== 'child' && p.active !== false && !p.deceasedAt && inHousehold(p, f.id) && !seen[p.id];
      });
      var able = adults.filter(function (p) { return KIND[p.maritalStatus] || UNKNOWN[p.maritalStatus || '']; });
      var pairs = [];
      for (var i = 0; i < able.length; i++) for (var j = i + 1; j < able.length; j++) {
        var a = able[i], b = able[j], sa = a.maritalStatus || '', sb = b.maritalStatus || '';
        var status = KIND[sa] ? sa : sb;
        if (!KIND[status] || no[pairKey(a.id, b.id)]) continue;
        if (!(sa === status || UNKNOWN[sa]) || !(sb === status || UNKNOWN[sb])) continue;   // Married + Partner: not a pair
        var spouse = status === 'Married', wa = spouse ? weddingOf(a) : '', wb = spouse ? weddingOf(b) : '';
        var both = sa === status && sb === status;
        var sameName = !!a.lastName && (a.lastName || '').trim().toLowerCase() === (b.lastName || '').trim().toLowerCase();
        if (!both && !sameName && !(wa && wa === wb)) continue;
        var score = (wa && wa === wb ? 4 : 0) + (sameName ? 2 : 0) + (both ? 1 : 0) - (wa && wb && wa !== wb ? 2 : 0) + (yes[pairKey(a.id, b.id)] ? 20 : 0);
        var ya = yearOf(a.birthDate), yb = yearOf(b.birthDate);
        if (ya && yb && Math.abs(ya - yb) > 25) score -= 4;
        if (score > 0) pairs.push({ a: a, b: b, score: score, status: status, wa: wa, wb: wb });
      }
      pairs.sort(function (x, y) { return y.score - x.score; });
      var used = {};
      pairs.forEach(function (x) {
        if (used[x.a.id] || used[x.b.id]) return;
        used[x.a.id] = used[x.b.id] = seen[x.a.id] = seen[x.b.id] = 1;
        var other = x.a.maritalStatus !== x.status ? x.a : x.b.maritalStatus !== x.status ? x.b : null;
        var ok = !!yes[pairKey(x.a.id, x.b.id)];
        out.push({ familyId: f.id, a: x.a.id, b: x.b.id, kind: KIND[x.status], confirmed: ok, sure: ok || (able.length === 2 && adults.length === 2),
          copy: x.wa && !x.wb ? { from: x.a.id, to: x.b.id, date: x.wa } : x.wb && !x.wa ? { from: x.b.id, to: x.a.id, date: x.wb } : null,
          differ: !!(x.wa && x.wb && x.wa !== x.wb),
          mark: other ? { id: other.id, status: x.status } : null });
      });
    });
    return out;
  }
  /** Couples to check: not yet confirmed by a person, or with an anniversary to copy, dates that differ, or a marital status to record. */
  /**
   * Who a widow or widower (or someone who has died) was probably married to, among the people who have died.
   * Clues, each worth points: same household (40), same wedding date (40), shared email (30), shared mobile (25),
   * same surname (25), born within 15 years of each other (10); born more than 25 years apart takes 30 off.
   * Only pairs with at least 50 points; each person in at most one suggestion (best first). People an Administrator
   * already settled (lateSpouseId / lateSpouseSet) and pairs marked "not a couple" (notLateSpouse) are left out.
   *   people: everyone (with details), dead(p) → true when p has died.
   *   → [{ a: survivor id, b: deceased id, score, reasons: [...], bothDied }]
   */
  function lateSpouseSuggestions(people, dead) {
    var norm = function (s) { return String(s || '').trim().toLowerCase(); };
    var digits = function (s) { return String(s || '').replace(/\D/g, '').slice(-9); };
    var adults = (people || []).filter(function (p) { return p.familyRole !== 'child' && !p.mergedInto && p.firstName !== 'Deleted'; });
    var linked = {};   // deceased people already named as someone's late spouse
    adults.forEach(function (p) { if (p.lateSpouseId) linked[p.lateSpouseId] = 1; });
    var survivors = adults.filter(function (p) {
      if (p.lateSpouseId || p.lateSpouseSet) return false;
      return p.maritalStatus === 'Widowed' || (dead(p) && (p.maritalStatus === 'Married' || p.maritalStatus === 'Widowed'));
    });
    var gone = adults.filter(function (p) { return dead(p) && !linked[p.id] && !p.lateSpouseId; });
    var cand = [];
    survivors.forEach(function (a) {
      gone.forEach(function (b) {
        if (a.id === b.id || (a.notLateSpouse || []).indexOf(b.id) >= 0 || (b.notLateSpouse || []).indexOf(a.id) >= 0) return;
        if (dead(a) && a.maritalStatus === 'Widowed' && b.maritalStatus === 'Widowed') return;   // both widowed: each lost someone else
        var score = 0, why = [];
        if (householdsOf(a).some(function (h) { return inHousehold(b, h); })) { score += 40; why.push('same household'); }
        var wa = weddingOf(a), wb = weddingOf(b);
        if (wa && wa === wb) { score += 40; why.push('same wedding date'); }
        if (norm(a.email) && norm(a.email) === norm(b.email)) { score += 30; why.push('same email'); }
        if (digits(a.mobile).length >= 9 && digits(a.mobile) === digits(b.mobile)) { score += 25; why.push('same phone number'); }
        if (norm(a.lastName) && norm(a.lastName) === norm(b.lastName)) { score += 25; why.push('same surname'); }
        var ya = yearOf(a.birthDate), yb = yearOf(b.birthDate);
        if (ya && yb) { var gap = Math.abs(ya - yb); if (gap <= 15) { score += 10; why.push('similar age'); } else if (gap > 25) { score -= 30; why.push(gap + ' years apart in age'); } }
        if (score >= 50) cand.push({ a: a.id, b: b.id, score: score, reasons: why.filter(function (r) { return !/apart/.test(r); }), bothDied: dead(a) });
      });
    });
    cand.sort(function (x, y) { return y.score - x.score || (x.a + x.b < y.a + y.b ? -1 : 1); });
    var used = {}, out = [];
    cand.forEach(function (c) {
      if (used[c.a] || used[c.b]) return;
      used[c.a] = used[c.b] = 1; out.push(c);
    });
    return out;
  }

  function couplesToCheck(people, families) {
    return couples(people, families).filter(function (c) { return !c.confirmed || c.copy || c.differ || c.mark; });
  }

  return { RELATIONSHIPS: RELATIONSHIPS, CONSENTING: CONSENTING, householdsOf: householdsOf, inHousehold: inHousehold, linksOf: linksOf,
    consentAdults: consentAdults, childrenOf: childrenOf, defaultsFor: defaultsFor, suggestedLinks: suggestedLinks, needs: needs,
    couples: couples, couplesToCheck: couplesToCheck, pairKey: pairKey, weddingOf: weddingOf, lateSpouseSuggestions: lateSpouseSuggestions };
})();
if (typeof module !== 'undefined') module.exports = Households;
