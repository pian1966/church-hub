/*
 * Church Hub – reading an Elvanto People export (CSV) and working out what to import. Pure functions (no screen, no Store),
 * tested with node: tests/elvanto-import.test.js (made-up data in tests/fixtures/elvanto-people.csv).
 *
 * Only the columns below are ever read. Everything else in an export (ID numbers, notes, giving, security codes,
 * addresses, …) is ignored and never stored.
 */
var ElvantoImport = (function () {
  'use strict';

  /* Columns: [key, label, exact Elvanto headings (tried first, in order), fallback pattern, pattern to never match] */
  var FIELDS = [
    ['id', 'Elvanto ID', ['Member ID', 'Person ID', 'ID'], /^(person|member)\s*id$|elvanto\s*id/i],
    ['firstName', 'First name *', ['First Name'], /^first\s*name|given/i],
    ['lastName', 'Last name *', ['Last Name'], /^last\s*name|^surname/i],
    ['preferredName', 'Known as', ['Preferred Name'], /prefer|nick/i],
    ['email', 'Email', ['Email Address', 'Email'], /^e-?mail(\s*address)?$/i],
    ['mobile', 'Mobile', ['Cellphone Number', 'Mobile', 'Mobile Phone'], /mobile|cell/i],
    ['phone', 'Other phone', ['Landline Home Phone Number', 'Home Phone', 'Phone'], /home\s*phone|landline|^phone$|telephone/i],
    ['birthDate', 'Birthday', ['Date of Birth', 'Birthday'], /^(date\s*of\s*)?birth(day|date)?$/i],
    ['family', 'Family (ID, or the primary & spouse names)', ['Family ID', 'Primary & Spouse Full Names'], /^family\s*id$/i],
    ['relationship', 'Family relationship', ['Family Relationship'], /^family\s*(relationship|role)$/i],
    ['maritalStatus', 'Marital status', ['Marital Status'], /^marital/i],
    ['category', 'Category', ['People Category', 'Category'], /categor|member\s*type/i],
    ['archived', 'Archived', ['Archived'], /^archived$/i],
    ['deceased', 'Deceased', ['Deceased'], /^deceased$/i],
    ['deceasedDate', 'Date deceased', ['Date Deceased'], /deceased\s*date|date\s*deceased/i]
  ];
  var NEVER = /id\s*number|passport|security|giving|notes?$|password|username/i;   // never read these, whatever they look like
  var CATEGORIES = ['Church Partner', 'Attender', 'Visiting Minister', 'Staff', 'Former member'];
  var MARITAL = ['Single', 'Engaged', 'Married', 'Partner', 'Separated', 'Divorced', 'Widowed'];
  var MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

  /** CSV text → rows (quotes, commas and line breaks inside quotes). */
  function parseCSV(text) {
    var rows = [], row = [], cell = '', q = false, t = String(text || '').replace(/^﻿/, '');
    for (var i = 0; i < t.length; i++) {
      var c = t[i];
      if (q) { if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some(function (x) { return x.trim(); })) rows.push(row); row = []; }
      else cell += c;
    }
    row.push(cell); if (row.some(function (x) { return x.trim(); })) rows.push(row);
    return rows;
  }

  /** Which column holds what: exact Elvanto headings first, then a careful pattern; each column used once. */
  function guess(head) {
    var m = {}, used = {}, h = head.map(function (x) { return String(x || '').trim(); });
    FIELDS.forEach(function (f) {
      var i = -1;
      f[2].some(function (name) { i = h.findIndex(function (x, j) { return !used[j] && x.toLowerCase() === name.toLowerCase(); }); return i >= 0; });
      if (i < 0) i = h.findIndex(function (x, j) { return !used[j] && !NEVER.test(x) && f[3].test(x); });
      if (i >= 0) { m[f[0]] = i; used[i] = 1; }
    });
    return m;
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  /** Dates as Elvanto writes them: "12 September, 1985", "September 12, 1985", 1985-09-12, 12/09/1985 (day first). */
  function toISO(v) {
    var s = String(v || '').trim(), m;
    if (!s) return '';
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) return m[1] + '-' + pad(+m[2]) + '-' + pad(+m[3]);
    if ((m = /^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})$/.exec(s))) return m[3] + '-' + pad(+m[2]) + '-' + pad(+m[1]);
    if ((m = /^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\.?,?\s+(\d{4})$/.exec(s)) && MONTHS[m[2].slice(0, 3).toLowerCase()]) return m[3] + '-' + pad(MONTHS[m[2].slice(0, 3).toLowerCase()]) + '-' + pad(+m[1]);
    if ((m = /^([A-Za-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/.exec(s)) && MONTHS[m[1].slice(0, 3).toLowerCase()]) return m[3] + '-' + pad(MONTHS[m[1].slice(0, 3).toLowerCase()]) + '-' + pad(+m[2]);
    return '';
  }
  /** A birthday without a year ("12 September") → "09-12", so the day can still be remembered. */
  function monthDay(v) {
    var s = String(v || '').trim(), m;
    if ((m = /^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\.?$/.exec(s)) && MONTHS[m[2].slice(0, 3).toLowerCase()]) return pad(MONTHS[m[2].slice(0, 3).toLowerCase()]) + '-' + pad(+m[1]);
    if ((m = /^([A-Za-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?$/.exec(s)) && MONTHS[m[1].slice(0, 3).toLowerCase()]) return pad(MONTHS[m[1].slice(0, 3).toLowerCase()]) + '-' + pad(+m[2]);
    return '';
  }
  function ageOn(iso, today) {
    if (!iso) return null;
    var a = +today.slice(0, 4) - +iso.slice(0, 4);
    if (today.slice(5) < iso.slice(5)) a--;
    return a;
  }
  function yes(v) { return /^(yes|y|true|1)$/i.test(String(v || '').trim()); }

  /** A sensible Church Hub category for an Elvanto category (the Administrator can change each one before importing). */
  function guessCategory(v) {
    var s = String(v || '');
    if (!s.trim()) return 'Church Partner';
    if (/non[\s_-]*member|attend|regular|adherent|newcomer|first\s*time/i.test(s)) return 'Attender';
    if (/visit|guest|preacher|minister|speaker/i.test(s)) return 'Visiting Minister';
    if (/staff|employee/i.test(s)) return 'Staff';
    if (/legacy|former|left|inactive|archive/i.test(s)) return 'Former member';
    if (/member|partner/i.test(s)) return 'Church Partner';
    return 'Church Partner';
  }

  /** Rows → people records (only the mapped columns). */
  function records(rows, map, today) {
    var get = function (r, k) { return map[k] != null && map[k] !== '' ? String(r[map[k]] == null ? '' : r[map[k]]).trim() : ''; };
    var out = rows.map(function (r, n) {
      var o = { row: n + 2 };
      FIELDS.forEach(function (f) { o[f[0]] = get(r, f[0]); });
      o.email = o.email.toLowerCase();
      o.birthDay = toISO(o.birthDate) ? '' : monthDay(o.birthDate);
      o.birthDate = toISO(o.birthDate);
      o.deceasedDate = toISO(o.deceasedDate);
      o.archived = yes(o.archived); o.deceased = yes(o.deceased);
      var age = ageOn(o.birthDate, today);
      // A child: under 18 when the birthday is known; otherwise "Child"/"Son"/"Daughter" as their own relationship.
      o.child = age !== null ? age < 18 : /^(child|son|daughter|grandchild|grandson|granddaughter)$/i.test(o.relationship);
      o.marital = MARITAL.filter(function (x) { return x.toLowerCase() === o.maritalStatus.toLowerCase(); })[0] || (o.maritalStatus ? 'Not known' : '');
      return o;
    }).filter(function (o) { return o.firstName || o.lastName; });
    // A family: Elvanto gives a family relationship, or the same family key appears on two or more people.
    // (Elvanto fills "Primary & Spouse Full Names" for single people too – that alone isn't a family.)
    var n = {}; out.forEach(function (o) { if (o.family) n[o.family] = (n[o.family] || 0) + 1; });
    out.forEach(function (o) { if (o.family && !o.relationship && n[o.family] < 2) o.family = ''; });
    return out;
  }

  function norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function sameFirst(p, o) {
    var a = [norm(p.firstName), norm(p.preferredName)], b = [norm(o.firstName), norm(o.preferredName)];
    return a.some(function (x) { return x && b.indexOf(x) >= 0; });
  }

  /**
   * Who each record is in Church Hub. Rules (in order):
   *  1. same Elvanto ID;  2. same email AND same first name (families often share one email);
   *  3. same first and last name, for someone not yet linked to Elvanto (e.g. added by hand, with their own email).
   * A person is never matched twice in one import, so two rows always stay two people.
   */
  function plan(recs, people) {
    var claimed = {}, out = [];
    recs.forEach(function (o) {
      var free = (people || []).filter(function (p) { return !claimed[p.id] && p.firstName !== 'Deleted'; }), hit = null, how = '';
      if (o.id) { hit = free.filter(function (p) { return p.elvantoId === o.id; })[0]; how = 'Elvanto ID'; }
      if (!hit && o.email) { hit = free.filter(function (p) { return norm(p.email) === o.email && sameFirst(p, o) && (!p.elvantoId || !o.id); })[0]; how = 'email and first name'; }
      if (!hit) { hit = free.filter(function (p) { return !p.elvantoId && norm(p.firstName + ' ' + p.lastName) === norm(o.firstName + ' ' + o.lastName); })[0]; how = 'name'; }
      if (hit) claimed[hit.id] = 1;
      out.push({ rec: o, personId: hit ? hit.id : null, how: hit ? how : '' });
    });
    var fams = {}; recs.forEach(function (o) { if (o.family) fams[o.family] = (fams[o.family] || 0) + 1; });
    var shared = {}; recs.forEach(function (o) { if (o.email) shared[o.email] = (shared[o.email] || 0) + 1; });
    var cats = {}; recs.forEach(function (o) { cats[o.category] = (cats[o.category] || 0) + 1; });
    return {
      items: out,
      added: out.filter(function (x) { return !x.personId; }).length,
      updated: out.filter(function (x) { return x.personId; }).length,
      children: recs.filter(function (o) { return o.child; }).length,
      families: Object.keys(fams).length,
      sharedEmails: Object.keys(shared).filter(function (e) { return shared[e] > 1; }).length,
      categories: cats
    };
  }

  /** A record → the fields to store on a person (existing person `p` updated, or a new one). */
  function toPerson(o, p, catMap, familyId, today) {
    p = p ? JSON.parse(JSON.stringify(p)) : { active: true, keyDates: [], source: 'elvanto' };
    ['firstName', 'lastName', 'preferredName', 'email', 'mobile', 'birthDate', 'birthDay'].forEach(function (k) { if (o[k]) p[k] = o[k]; });
    if (p.birthDate) delete p.birthDay;
    if (!p.mobile && o.phone) p.mobile = o.phone;
    if (o.id) p.elvantoId = o.id;
    if (familyId) p.familyId = familyId;
    p.familyRole = o.child ? 'child' : 'adult';
    if (o.child) delete p.maritalStatus; else if (o.marital) p.maritalStatus = o.marital;
    if (!p.staff) p.category = (catMap && catMap[o.category]) || guessCategory(o.category);
    if (o.deceased) { p.active = false; p.category = 'Deceased'; p.deceasedAt = o.deceasedDate || p.deceasedAt || today || ''; p.appRole = 'none'; }
    else if (o.archived) { p.active = false; p.category = 'Former member'; }
    return p;
  }

  /**
   * Who is responsible for each child, from Elvanto's family relationships: within a family, the "Primary" and "Spouse"
   * (or "Partner") are the children's parents – may consent, primary contact, may collect – to be confirmed by a person.
   * Other relationships (Grandmother, Sibling, Other…) are household members only. ids: record row → Church Hub person id.
   */
  function guardianLinks(recs, ids) {
    var fam = {}, out = [];
    recs.forEach(function (o) { if (o.family) (fam[o.family] = fam[o.family] || []).push(o); });
    Object.keys(fam).forEach(function (k) {
      var adults = fam[k].filter(function (o) { return !o.child && /^(primary|spouse|partner)/i.test(o.relationship); });
      fam[k].filter(function (o) { return o.child; }).forEach(function (c) {
        adults.forEach(function (a) {
          if (ids[a.row] && ids[c.row]) out.push({ childId: ids[c.row], adultId: ids[a.row], relationship: 'Parent', canConsent: true, primary: true, mayCollect: true, confirmed: false });
        });
      });
    });
    return out;
  }

  return { FIELDS: FIELDS, CATEGORIES: CATEGORIES, guardianLinks: guardianLinks, parseCSV: parseCSV, guess: guess, toISO: toISO, monthDay: monthDay, records: records, plan: plan, toPerson: toPerson, guessCategory: guessCategory };
})();
if (typeof module !== 'undefined') module.exports = ElvantoImport;
