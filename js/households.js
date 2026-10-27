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

  return { RELATIONSHIPS: RELATIONSHIPS, CONSENTING: CONSENTING, householdsOf: householdsOf, inHousehold: inHousehold, linksOf: linksOf,
    consentAdults: consentAdults, childrenOf: childrenOf, defaultsFor: defaultsFor, suggestedLinks: suggestedLinks, needs: needs };
})();
if (typeof module !== 'undefined') module.exports = Households;
