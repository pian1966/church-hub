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
    ['deceasedDate', 'Date deceased', ['Date Deceased'], /deceased\s*date|date\s*deceased/i],
    ['photo', 'Photo', ['Photo'], /^(photo|picture|image)$/i],
    ['idNumber', 'ID number', ['ID Number (Numeric)', 'ID Number'], /^id\s*(number|no\.?)\b/i],
    ['notes', 'Notes', ['Notes'], /^notes?$/i],
    ['gender', 'Gender', ['Gender'], /^(gender|sex)$/i],
    ['dateAdded', 'Date added to Elvanto', ['Date Added'], /^date\s*added$/i],
    ['middleName', 'Middle name', ['Middle Name'], /^middle\s*name$/i],
    ['anniversary', 'Wedding anniversary', ['Anniversary'], /^(wedding\s*)?anniversary$/i],
    ['partnerSince', 'Date accepted as Church Partner', ['Membership Date'], /^member(ship)?\s*date$/i],
    ['partnerUpdated', 'Partnership last updated', ['Membership last renewed on:'], /^member(ship)?\s*(last\s*)?renewed/i],
    ['receive', 'What they’d like to receive', ['Checklist of what to receive'], /what\s*to\s*receive/i],
    ['positions', 'Volunteering (department positions)', ['Department Positions'], /^department\s*positions$/i],
    ['street', 'Home address', ['Home Address'], /^home\s*address$/i],
    ['street2', 'Home address line 2', ['Home Address Line 2'], /^home\s*address\s*line\s*2$/i],
    ['city', 'Town or city', ['Home City'], /^home\s*city$/i],
    ['postcode', 'Postcode', ['Home Postcode'], /^home\s*post(al)?\s*code$/i],
    ['province', 'Province', ['Province'], /^(home\s*)?(province|state)$/i],
    ['country', 'Country', ['Home Country'], /^home\s*country$/i]
  ];
  /** What someone ticked in Elvanto's "Checklist of what to receive" → Church Hub's choices (as in the consent register). */
  var RECEIVE = [
    [/who\s*is\s*jesus/i, '“Who is Jesus” (via WhatsApp)'],
    [/weekly\s*church\s*notices/i, 'Weekly Church Notices (via Email)'],
    [/pray[^,]*whatsapp/i, 'Special things or people to pray for (via WhatsApp)'],
    [/pray[^,]*e-?mail/i, 'Special things or people to pray for (via Email)'],
    [/missionary[^,]*whatsapp/i, 'Missionary updates (via WhatsApp)'],
    [/missionary[^,]*e-?mail/i, 'Missionary updates (via Email)']
  ];
  function receiveChoices(v) {
    var s = String(v || '').replace(/\s+/g, ' ').replace(/"who is jesus"[^,]*(,[^,]*lord[^,]*)?/i, 'Who is Jesus');   // its description has a comma in it
    return RECEIVE.filter(function (r) { return s.split(/\s*,\s*/).some(function (x) { return r[0].test(x); }); }).map(function (r) { return r[1]; });
  }
  /** Elvanto's "Department Positions" ("8:00 Reading, 10:00 Communion -\nLeading, Memorial Teas") → [{ time: '08:00', name: 'Reading' }, …].
   *  Long cells wrap onto new lines, so line breaks are just spaces. A position without a time is for memorial and funeral teas. */
  function positionsOf(v) {
    return String(v || '').replace(/\s+/g, ' ').split(/\s*,\s*/).map(function (x) {
      var m = /^(\d{1,2}):(\d{2})\s+(.+)$/.exec(x.trim());
      return m ? { time: pad(+m[1]) + ':' + m[2], name: m[3].trim() } : x.trim() ? { time: '', name: x.trim() } : null;
    }).filter(Boolean);
  }
  /** Province as people type it ("KZN", "KZn") → the full name. */
  function province(v) {
    var s = String(v || '').trim(), k = s.toLowerCase().replace(/[^a-z]/g, '');
    var P = { kzn: 'KwaZulu-Natal', kwazulunatal: 'KwaZulu-Natal', gp: 'Gauteng', gauteng: 'Gauteng', wc: 'Western Cape', westerncape: 'Western Cape', ec: 'Eastern Cape', easterncape: 'Eastern Cape',
      fs: 'Free State', freestate: 'Free State', mp: 'Mpumalanga', mpumalanga: 'Mpumalanga', lp: 'Limpopo', limpopo: 'Limpopo', nw: 'North West', northwest: 'North West', nc: 'Northern Cape', northerncape: 'Northern Cape' };
    return P[k] || s;
  }

  /**
   * What the robot found in Elvanto's Unavailable Volunteers (names and dates) → what to do in Church Hub.
   *   found: [{ name, from, to, fromLeave }], people: Church Hub's people, blockouts: their away dates.
   *   → [{ name, from, to, status, personId, choices }] with status
   *      'new' (one person matches; not in Church Hub yet), 'have' (already an away date), 'leave' (made by Church Hub or
   *      Leave Manager for leave – already in Church Hub), 'several' (more than one person with that name; choices = their ids),
   *      'nomatch' (no one by that name; choices = people with the same surname).
   */
  function matchFound(found, people, blockouts) {
    var norm = function (s) { return String(s || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z\u00c0-\u024f]+/g, ' ').trim(); };
    var live = (people || []).filter(function (p) { return p.active !== false && !p.mergedInto && p.firstName !== 'Deleted'; });
    var byName = {}, bySurname = {};
    live.forEach(function (p) {
      var keys = [norm(p.firstName + ' ' + p.lastName)];
      if (p.preferredName) keys.push(norm(p.preferredName + ' ' + p.lastName));
      keys.forEach(function (k) { (byName[k] = byName[k] || []).indexOf(p.id) < 0 && byName[k].push(p.id); });
      (bySurname[norm(p.lastName)] = bySurname[norm(p.lastName)] || []).push(p.id);
    });
    return (found || []).map(function (e) {
      var out = { name: e.name, from: e.from, to: e.to, status: '', personId: '', choices: [] };
      if (e.fromLeave) { out.status = 'leave'; return out; }
      var n = norm(e.name), ids = byName[n] || [];
      if (!ids.length && n.indexOf(' ') > 0) {   // "Pike, Andrew" or a middle name: try surname + first word
        var parts = n.split(' '), first = parts[0], last = parts[parts.length - 1];
        ids = (byName[first + ' ' + last] || []).concat(/,/.test(e.name) ? (byName[parts.slice(1).join(' ') + ' ' + first] || []) : []);
      }
      if (ids.length === 1) {
        out.personId = ids[0];
        out.status = (blockouts || []).some(function (b) { return b.personId === ids[0] && b.from === e.from && (b.to || b.from) === e.to; }) ? 'have' : 'new';
      } else if (ids.length > 1) { out.status = 'several'; out.choices = ids; }
      else { out.status = 'nomatch'; out.choices = (bySurname[n.split(' ').pop()] || []).slice(0, 20); }
      if (out.choices.length) {   // someone already chose who it is: an away date from Elvanto on those dates
        var done = (blockouts || []).filter(function (b) { return b.source === 'elvanto' && out.choices.indexOf(b.personId) >= 0 && b.from === e.from && (b.to || b.from) === e.to; })[0];
        if (done) { out.status = 'have'; out.personId = done.personId; }
      }
      return out;
    });
  }

  /** An ID number as typed: spaces gone. Elvanto's "numeric" column drops a leading 0 (people born 2000–2009), so 12 digits get it back.
   *  Spreadsheet-mangled numbers ("5.71021E+12") can't be recovered and are left out. */
  function idNumber(v) {
    var s = String(v || '').replace(/[\s-]/g, '');
    if (/e\+/i.test(s) || !/^[A-Za-z0-9]{5,20}$/.test(s)) return '';
    return /^\d{12}$/.test(s) ? '0' + s : s;
  }
  /** A 13-digit ID number typed into a name ("5710210087085 Thomson") → { id, name: 'Thomson' }; null when there is none. */
  function idInName(v) {
    var m = /(^|\s)(\d{13})(?=\s|$)/.exec(String(v || ''));
    return m ? { id: m[2], name: String(v).replace(m[2], ' ').replace(/\s+/g, ' ').trim() } : null;
  }
  /** Elvanto's link to someone's photo, for the full-size picture (not the small "_thumb" copy). Only Elvanto's own addresses. */
  function photoLink(v) {
    var s = String(v || '').trim();
    if (!/^https:\/\/([a-z0-9-]+\.)*elvanto\.(com|eu|net|com\.au|co\.uk)\/\S+\.(jpe?g|png|gif|webp)(\?\S*)?$/i.test(s)) return '';
    return s.replace(/_thumb(_\d+\.[a-z]+)/i, '$1');
  }
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
  /** A birthday without a year ("12 September", or Elvanto's "09-12", month first) → "09-12", so the day can still be remembered. */
  function monthDay(v) {
    var s = String(v || '').trim(), m;
    if ((m = /^(\d{1,2})-(\d{1,2})$/.exec(s)) && +m[1] >= 1 && +m[1] <= 12 && +m[2] >= 1 && +m[2] <= 31) return pad(+m[1]) + '-' + pad(+m[2]);
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
      o.photoThumb = /_thumb_\d+\./i.test(o.photo) ? photoLink(o.photo) && o.photo.trim() : '';   // Elvanto's small copy, if the big one is missing
      o.photo = photoLink(o.photo);
      o.idNumber = idNumber(o.idNumber);
      ['firstName', 'preferredName', 'lastName'].forEach(function (k) { var m = idInName(o[k]); if (m) { o[k] = m.name; if (!o.idNumber) o.idNumber = m.id; } });
      o.notes = String(o.notes || '').trim();
      o.gender = /^(f|female|woman|vrou|vroulik)$/i.test(o.gender) ? 'Female' : /^(m|male|man|manlik)$/i.test(o.gender) ? 'Male' : '';
      var da = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(o.dateAdded || '');
      o.dateAdded = da ? da[1] + ' ' + da[2] : toISO(o.dateAdded) ? toISO(o.dateAdded) + ' 00:00' : '';
      o.anniversary = toISO(o.anniversary);
      o.partnerSince = toISO(o.partnerSince);
      o.partnerUpdated = /^\d{4}$/.test(String(o.partnerUpdated || '').trim()) ? String(o.partnerUpdated).trim() : toISO(o.partnerUpdated);
      o.receive = receiveChoices(o.receive);
      o.positions = positionsOf(o.positions);
      o.address = { street: o.street, street2: o.street2, city: o.city, postcode: o.postcode, province: province(o.province), country: o.country };
      if (!o.address.street && !o.address.street2 && !o.address.city && !o.address.postcode) o.address = null;   // a province or country on its own isn't an address
      o.archived = yes(o.archived); o.deceased = yes(o.deceased);
      if (o.deceased) ['firstName', 'preferredName', 'lastName'].forEach(function (k) {   // "2024-08-22-Mike": the date they died, then the name
        var dn = datedName(o[k]); if (dn && (dn.name || k !== 'firstName' || o.lastName)) { o[k] = dn.name; if (!o.deceasedDate) o.deceasedDate = dn.date; }
      });
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

  /**
   * A date typed in front of a name, as the church did in Elvanto for people who died: "2024-08-22-Mike" or "2025-02-14- Sandy"
   * → { date: '2024-08-22', name: 'Mike' }. Null when the name doesn't start with a real date.
   */
  function datedName(v) {
    var m = /^\s*(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})\s*[-\u2013\u2014:,]?\s*(.*)$/.exec(String(v || ''));
    if (!m) return null;
    var d = m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2), t = new Date(d + 'T00:00:00Z');
    if (isNaN(t) || t.toISOString().slice(0, 10) !== d) return null;
    return { date: d, name: m[4].trim() };
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
    if (o.gender) p.gender = o.gender;
    if (o.middleName) p.middleName = o.middleName;
    if (o.dateAdded && (!p.createdAt || o.dateAdded < p.createdAt)) p.createdAt = o.dateAdded;   // when they were first added (in Elvanto)
    if (o.anniversary && !o.child) { p.keyDates = (p.keyDates || []).filter(function (k) { return !/wedding|anniversary/i.test(k.label || ''); }).concat([{ label: 'Wedding anniversary', date: o.anniversary }]); }
    if (o.partnerSince) p.partnerSince = o.partnerSince;
    if (o.partnerUpdated && (!p.partnerUpdated || String(o.partnerUpdated) > String(p.partnerUpdated).slice(0, o.partnerUpdated.length))) p.partnerUpdated = o.partnerUpdated;
    if (o.address) p.address = o.address;
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

  return { FIELDS: FIELDS, CATEGORIES: CATEGORIES, matchFound: matchFound, datedName: datedName, photoLink: photoLink, idNumber: idNumber, idInName: idInName, receiveChoices: receiveChoices, positionsOf: positionsOf, province: province, guardianLinks: guardianLinks, parseCSV: parseCSV, guess: guess, toISO: toISO, monthDay: monthDay, records: records, plan: plan, toPerson: toPerson, guessCategory: guessCategory };
})();
if (typeof module !== 'undefined') module.exports = ElvantoImport;
