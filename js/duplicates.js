/*
 * Church Hub – finding people entered twice (Administrators only). Pure functions, tested with node: tests/duplicates.test.js.
 *
 * Two records are compared on what usually gives a duplicate away, and every suggestion says why:
 *  - Names: the same first name, a known short form ("Doug" / "Douglas", "Bill" / "William"), the "known as" name, a small
 *    typing slip ("Jonh" / "John"), accents and capitals ignored, first and last name swapped, a double-barrelled surname
 *    ("van der Merwe" / "Merwe"), or a maiden name (the same first name, birthday and contact details).
 *  - Contact details: the same email (Gmail dots and +labels ignored) or mobile (+27 82… is 082…).
 *    Households often share an email or a landline, so contact details alone never make a duplicate: the first name must match too.
 *  - Birthday: the same date counts for; two different dates count strongly against (they are different people).
 *  - Elvanto ID: the same ID is certain; two different IDs are different people in Elvanto.
 * A parent and a child with the same name (e.g. "Johan van der Merwe" senior and junior) are kept apart by the birthday,
 * or by one being an adult and the other a child.
 * Scores: 100 = certain, 70 or more = very likely ("Probably the same person"), 45 or more = worth a look ("Possibly").
 */
var Duplicates = (function () {
  'use strict';

  // Common short forms of first names (each line: the full name, then its short forms). South African and English names.
  var SHORT = [
    'abraham abe bram', 'alexander alex alec sandy xander', 'alexandra alex sandra lexi', 'andrew andy drew', 'anthony tony',
    'barbara barb babs', 'benjamin ben benji', 'bernard bernie', 'catherine cathy cath kate katie', 'katherine kathy kate katie kath',
    'charles charlie chuck', 'christina chris tina', 'christine chris chrissie', 'christopher chris kit', 'cornelius neels kobus corne',
    'daniel dan danny', 'david dave davy', 'deborah deb debbie', 'dorothy dot dottie', 'douglas doug', 'edward ed eddie ted',
    'elizabeth liz lizzie beth betty eliza elsa', 'frederick fred freddie', 'gabriel gabe', 'gerhardus gerhard gert', 'gregory greg',
    'hendrik henk hennie', 'jacobus koos kobus jaco', 'james jim jimmy jamie', 'jennifer jen jenny', 'jessica jess', 'johannes johan hannes jan',
    'john johnny jack', 'jonathan jon jonny', 'joseph joe joey', 'joshua josh', 'katrina kat trina', 'kenneth ken kenny',
    'lawrence larry laurie', 'margaret maggie meg peggy greta', 'matthew matt', 'michael mike mick mikey', 'nathaniel nathan nat',
    'nicholas nick nicky', 'patricia pat patty trish', 'patrick pat paddy', 'peter pete', 'petrus piet pieter', 'philip phil',
    'rebecca becky becca', 'richard rich rick dick', 'robert rob bob bobby robbie', 'ronald ron ronnie', 'samuel sam sammy',
    'samantha sam sammy', 'stephen steve stevie', 'steven steve', 'susan sue suzie', 'theodore theo ted', 'thomas tom tommy',
    'timothy tim timmy', 'victoria vicky tori', 'william will bill billy willie', 'zandile zandi', 'nomvula vuvu', 'sibusiso sibu',
    'thandiwe thandi', 'thabiso thabo', 'lindiwe lindi', 'nokuthula thula', 'nompumelelo mpume', 'bongani bongi'
  ];
  var GROUP = {};
  SHORT.forEach(function (line, i) { line.split(' ').forEach(function (n) { (GROUP[n] = GROUP[n] || []).push(i); }); });

  function plain(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z\s'-]/g, '').replace(/['-]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function email(s) {
    var e = String(s || '').trim().toLowerCase(), at = e.lastIndexOf('@');
    if (at < 1) return '';
    var user = e.slice(0, at).replace(/\+.*$/, ''), dom = e.slice(at + 1);
    if (dom === 'googlemail.com') dom = 'gmail.com';
    if (dom === 'gmail.com') user = user.replace(/\./g, '');
    return user + '@' + dom;
  }
  function phone(s) {
    var d = String(s || '').replace(/\D/g, '');
    if (/^27\d{9}$/.test(d)) d = '0' + d.slice(2);
    if (/^\d{9}$/.test(d) && d[0] !== '0') d = '0' + d;
    return d.length >= 9 ? d : '';
  }
  /** Edits needed to turn a into b (Damerau: a swapped pair of letters counts as one). */
  function distance(a, b) {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > 2) return 3;
    var d = [], i, j;
    for (i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (j = 0; j <= b.length; j++) d[0][j] = j;
    for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++) {
      var c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
    return d[a.length][b.length];
  }
  function slip(a, b) { var n = Math.min(a.length, b.length); return n >= 4 && distance(a, b) <= (n >= 7 ? 2 : 1); }
  function sameGroup(a, b) { return (GROUP[a] || []).some(function (g) { return (GROUP[b] || []).indexOf(g) >= 0; }); }

  /** How the first names compare: 'same', 'short' (Doug/Douglas), 'known' (the "known as" name), 'slip', 'initial' or ''. */
  function firstMatch(p, q) {
    var a = [plain(p.firstName), plain(p.preferredName)].filter(Boolean), b = [plain(q.firstName), plain(q.preferredName)].filter(Boolean);
    var fa = a[0] || '', fb = b[0] || '';
    if (fa && fa === fb) return 'same';
    if (a.some(function (x) { return b.indexOf(x) >= 0; })) return 'known';
    var wa = fa.split(' ')[0], wb = fb.split(' ')[0];      // "Anna Marie" / "Anna"
    if (wa && wa === wb) return 'same';
    if (a.some(function (x) { return b.some(function (y) { return sameGroup(x, y) || sameGroup(x.split(' ')[0], y.split(' ')[0]); }); })) return 'short';
    if (slip(fa, fb)) return 'slip';
    if ((fa.length === 1 && fb[0] === fa) || (fb.length === 1 && fa[0] === fb)) return 'initial';
    return '';
  }
  /** How the surnames compare: 'same', 'slip', 'part' (van der Merwe / Merwe, Smith-Jones / Smith) or ''. */
  function lastMatch(p, q) {
    var a = plain(p.lastName), b = plain(q.lastName);
    if (!a || !b) return '';
    if (a === b || a.replace(/ /g, '') === b.replace(/ /g, '')) return 'same';
    if (slip(a.replace(/ /g, ''), b.replace(/ /g, ''))) return 'slip';
    var pa = a.split(' '), pb = b.split(' '), la = pa[pa.length - 1], lb = pb[pb.length - 1];
    if (la.length >= 3 && la === lb) return 'part';
    if ((pa.indexOf(lb) >= 0 && lb.length >= 3) || (pb.indexOf(la) >= 0 && la.length >= 3)) return 'part';
    return '';
  }
  function swapped(p, q) {
    var f = plain(p.firstName), l = plain(p.lastName);
    return !!f && !!l && f !== l && f === plain(q.lastName) && l === plain(q.firstName);
  }
  function emails(p) { return [p.email].concat(p.otherEmails || []).map(email).filter(Boolean); }
  function birth(p) { return /^\d{4}-\d\d-\d\d/.test(p.birthDate || '') ? p.birthDate.slice(0, 10) : ''; }
  function nm(p) { return ((p.preferredName || p.firstName || '') + ' ' + (p.lastName || '')).trim(); }

  /**
   * Compare two people. Returns { score, reasons: [text], sure: bool } – score 0 when they are clearly different people.
   */
  function compare(p, q) {
    if (!p || !q || p.id && p.id === q.id) return { score: 0, reasons: [] };
    if (p.elvantoId && q.elvantoId) {
      if (p.elvantoId === q.elvantoId) return { score: 100, reasons: ['The same Elvanto ID'], sure: true };
      return { score: 0, reasons: [] };                      // two different people in Elvanto
    }
    var bp = birth(p), bq = birth(q);
    if (bp && bq && bp !== bq) return { score: 0, reasons: [] };    // different birthdays: different people
    if (p.familyRole && q.familyRole && (p.familyRole === 'child') !== (q.familyRole === 'child') && !(bp && bp === bq)) return { score: 0, reasons: [] };
    var fm = firstMatch(p, q), lm = lastMatch(p, q), sw = swapped(p, q), why = [], s = 0;
    var me = emails(p), sameMail = me.length && emails(q).some(function (e) { return me.indexOf(e) >= 0; });
    var mp = phone(p.mobile), sameMobile = !!mp && mp === phone(q.mobile), sameBirth = !!bp && bp === bq;
    if (sw) { s += 55; why.push('First and last name swapped'); }
    else {
      if (fm === 'same') { s += 35; why.push('Same first name'); }
      else if (fm === 'known') { s += 32; why.push('Same name (one is what they are known as)'); }
      else if (fm === 'short') { s += 30; why.push('Short form of the same first name (' + plain(p.preferredName || p.firstName) + ' / ' + plain(q.preferredName || q.firstName) + ')'); }
      else if (fm === 'slip') { s += 22; why.push('First names differ by a letter or two'); }
      else if (fm === 'initial') { s += 12; why.push('First name given as an initial'); }
      if (lm === 'same') { s += 30; why.push('Same surname'); }
      else if (lm === 'slip') { s += 20; why.push('Surnames differ by a letter or two'); }
      else if (lm === 'part') { s += 15; why.push('Part of the surname matches'); }
    }
    var firstOk = sw || !!fm && fm !== 'initial';
    // Contact details only count with a matching first name: families share emails and phones.
    if (sameMail) { if (firstOk) { s += 30; why.push('Same email address'); } }
    if (sameMobile) { if (firstOk) { s += 30; why.push('Same mobile number'); } }
    if (sameBirth) { s += firstOk ? 30 : 0; if (firstOk) why.push('Same birthday'); }
    // A maiden name: same first name and birthday or contact details, different surname
    if (!lm && !sw && firstOk && (sameBirth || sameMail || sameMobile)) why.push('Different surname – perhaps a maiden or married name');
    if (!firstOk && !sw) s = Math.min(s, 30);                // a different first name is a different person, even in the same household
    if (!lm && !sw && !(sameBirth || sameMail || sameMobile)) s = Math.min(s, 30);
    return { score: Math.min(s, 99), reasons: why, sure: false };
  }
  function level(score) { return score >= 100 ? 'certain' : score >= 70 ? 'likely' : score >= 45 ? 'possible' : ''; }

  /**
   * Possible duplicates among everyone. people: [{ id, firstName, lastName, preferredName, email, mobile, birthDate, familyRole,
   * elvantoId, active }]. ignore: ["id1|id2"] pairs the church said are different people.
   * Returns [{ a, b, score, level, reasons }], most likely first. People who were deleted are left out.
   */
  function find(people, ignore) {
    var skip = {}; (ignore || []).forEach(function (k) { skip[k] = 1; });
    var list = (people || []).filter(function (p) { return p && p.firstName !== 'Deleted' && !p.deletedAt && !p.mergedInto; });
    // Compare only people who share something cheap to check, so it stays fast with thousands of people.
    var buckets = {}, put = function (k, p) { if (k) (buckets[k] = buckets[k] || []).push(p); };
    list.forEach(function (p) {
      var f = plain(p.firstName), l = plain(p.lastName), pf = plain(p.preferredName);
      put('l:' + l.replace(/ /g, '').slice(0, 3), p); put('l:' + (l.split(' ').pop() || '').slice(0, 3), p);
      put('f:' + f.slice(0, 3), p); if (pf) put('f:' + pf.slice(0, 3), p);
      put('f:' + l.slice(0, 3), p); put('l:' + f.replace(/ /g, '').slice(0, 3), p);   // swapped names
      emails(p).forEach(function (e) { put('e:' + e, p); }); put('m:' + phone(p.mobile), p); put('b:' + birth(p), p);
      if (p.elvantoId) put('x:' + p.elvantoId, p);
      (GROUP[f] || []).concat(GROUP[pf] || []).forEach(function (g) { put('g:' + g, p); });
    });
    var seen = {}, out = [];
    Object.keys(buckets).forEach(function (k) {
      var b = buckets[k]; if (b.length < 2 || b.length > 400) return;
      for (var i = 0; i < b.length; i++) for (var j = i + 1; j < b.length; j++) {
        var key = pair(b[i].id, b[j].id);
        if (seen[key] || skip[key] || b[i].id === b[j].id) continue;
        seen[key] = 1;
        var c = compare(b[i], b[j]), lv = level(c.score);
        if (lv) out.push({ a: b[i].id, b: b[j].id, score: c.score, level: lv, reasons: c.reasons });
      }
    });
    return out.sort(function (x, y) { return y.score - x.score || nm(byId(list, x.a)).localeCompare(nm(byId(list, y.a))); });
  }
  function byId(list, id) { return list.filter(function (p) { return p.id === id; })[0] || {}; }
  function pair(a, b) { return [a, b].sort().join('|'); }

  /**
   * While someone is being added or changed: the existing people they may be. person: what has been typed so far
   * (with its own id when editing, so it isn't matched to itself). Returns [{ id, score, level, reasons }], best first.
   */
  function matches(person, people, ignore) {
    var skip = {}; (ignore || []).forEach(function (k) { skip[k] = 1; });
    return (people || []).filter(function (q) { return q.id !== person.id && q.firstName !== 'Deleted' && !q.deletedAt && !q.mergedInto && !(person.id && skip[pair(person.id, q.id)]); })
      .map(function (q) { var c = compare(person, q); return { id: q.id, score: c.score, level: level(c.score), reasons: c.reasons }; })
      .filter(function (m) { return m.level; })
      .sort(function (x, y) { return y.score - x.score; });
  }

  /* ---------- fixing a duplicate: one record is kept, the other is retired ---------- */
  // Never copied from the retired record: who it is, its history, access and status.
  var KEEP_OWN = { id: 1, createdAt: 1, updatedAt: 1, active: 1, archivedAt: 1, deletedAt: 1, mergedInto: 1, appRole: 1, notSame: 1,
    medical: 1, source: 1, householdIds: 1, familyId: 1, keyDates: 1, category: 1, firstName: 1, photo: 1 };   // a photo belongs to its own record
  function blank(v) { return v == null || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length); }
  function show(v, k) { return k === 'mobile' ? phone(v) || String(v) : k === 'email' ? email(v) || String(v) : typeof v === 'object' ? JSON.stringify(v) : String(v).trim(); }
  /**
   * The kept record after a merge: its own details, with gaps filled from the retired one. Nothing it already has is overwritten.
   * Returns { person, filled: [field], differs: [{ field, value }] } – differs lists what the retired record had that wasn't copied.
   */
  function mergeFields(keep, drop) {
    var p = JSON.parse(JSON.stringify(keep)), filled = [], differs = [];
    Object.keys(drop).forEach(function (k) {
      if (KEEP_OWN[k] || blank(drop[k])) return;
      if (blank(p[k])) { p[k] = JSON.parse(JSON.stringify(drop[k])); filled.push(k); }
      else if (show(p[k], k).toLowerCase() !== show(drop[k], k).toLowerCase()) differs.push({ field: k, value: drop[k] });
    });
    // First names: Doug and Douglas become "Douglas", known as "Doug". Any other difference is only listed.
    var fk = plain(keep.firstName), fd = plain(drop.firstName);
    if (fd && fk && fd !== fk) {
      var related = sameGroup(fk, fd) || fk.indexOf(fd) === 0 || fd.indexOf(fk) === 0;
      if (related && !keep.preferredName) {
        var long = fd.length > fk.length ? drop.firstName : keep.firstName, short = long === drop.firstName ? keep.firstName : drop.firstName;
        p.firstName = long; p.preferredName = short; if (long !== keep.firstName) filled.push('firstName'); filled.push('preferredName');
      } else differs.push({ field: 'firstName', value: drop.firstName });
    }
    if (!p.familyId && drop.familyId) { p.familyId = drop.familyId; filled.push('familyId'); }
    var hs = (keep.householdIds || []).concat([drop.familyId]).concat(drop.householdIds || []).filter(function (h, i, a) { return h && a.indexOf(h) === i && h !== p.familyId; });
    if (hs.length) p.householdIds = hs;
    var labels = {}; (keep.keyDates || []).forEach(function (k) { labels[(k.label || '').toLowerCase()] = 1; });
    var extra = (drop.keyDates || []).filter(function (k) { return !labels[(k.label || '').toLowerCase()]; });
    if (extra.length) { p.keyDates = (keep.keyDates || []).concat(JSON.parse(JSON.stringify(extra))); filled.push('keyDates'); }
    if (drop.createdAt && (!keep.createdAt || drop.createdAt < keep.createdAt)) p.createdAt = drop.createdAt;      // known since the earlier date
    p.notSame = (keep.notSame || []).concat(drop.notSame || []).filter(function (x, i, a) { return x !== keep.id && x !== drop.id && a.indexOf(x) === i; });
    if (!p.notSame.length) delete p.notSame;
    return { person: p, filled: filled, differs: differs };
  }
  /** "Not the same person" pairs, from what's recorded on each person (notSame: [other ids]). */
  function ignored(people) {
    var out = []; (people || []).forEach(function (p) { (p.notSame || []).forEach(function (o) { out.push(pair(p.id, o)); }); });
    return out;
  }

  return { compare: compare, find: find, matches: matches, level: level, pair: pair, phone: phone, email: email, plain: plain,
    mergeFields: mergeFields, ignored: ignored };
})();
if (typeof module !== 'undefined') module.exports = Duplicates;
