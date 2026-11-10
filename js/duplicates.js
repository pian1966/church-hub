/*
 * Church Hub – finding people entered twice (Administrators only). Pure functions, tested with node: tests/duplicates.test.js.
 *
 * Two records are compared on what usually gives a duplicate away, and every suggestion says why:
 *  - Names: the same first name, a known short form ("Doug" / "Douglas", "Bill" / "William"), the "known as" name, a small
 *    typing slip ("Jonh" / "John"), names that sound alike ("Stephen" / "Steven", "Pillay" / "Pillai"), spaces and dashes
 *    ignored ("Anne-Marie" / "Annemarie"), accents and capitals ignored, first and last name swapped, a double-barrelled
 *    surname ("van der Merwe" / "Merwe", "vd Merwe"), or a maiden name (the same first name, birthday and contact details).
 *  - Contact details: the same email (Gmail dots and +labels ignored) or mobile (+27 82… is 082…, +44 7700… is 07700…).
 *    Households often share an email or a landline, so contact details alone never make a duplicate: the first name must match too.
 *  - Birthday: the same date counts for; two different dates count strongly against (they are different people).
 *  - Elvanto ID: the same ID is certain; two different IDs are still compared (Elvanto has duplicates too), but at most "worth a look".
 *  - A first name cut short ("And Pike" for Andy Pike) counts only with the same mobile, email or birthday.
 * A parent and a child with the same name (e.g. "Johan van der Merwe" senior and junior) are kept apart by the birthday,
 * or by one being an adult and the other a child.
 * Scores: 100 = certain, 70 or more = very likely ("Probably the same person"), 45 or more = worth a look ("Possibly").
 * Sensitivity (the church's choice, 1 = fewer warnings … 5 = more): moves the "worth a look" and "similar" lines (SENS);
 * "very likely" (70, which stops saving) never moves, and a different first name never counts, at any setting.
 *
 * While someone is typed in (live()), the check starts early: two letters of each name are enough (an unfinished name
 * matches the start of a longer one, and a similar surname is shown as "similar"), and an email or mobile number that is
 * already on someone's record is reported on its own, whatever the names – families often share them, so that is a hint, not a block.
 * Partly typed contact details are hinted at too: a mobile number from 7 digits ("082 555 1" – and "+27 82 555 1" in the church's
 * own country), an email from 6 characters (or 2 and an "@"), and a street address from a house number and 3 letters ("12 Mai"
 * finds "12 Main Road"; Rd/Road, St/Street… are the same). People in the household chosen for this person are left out of the address hint.
 */
var Duplicates = (function () {
  'use strict';
  /** Texts people see, in their language when the app has one (I18n); plain English in tests. */
  function T(s, v) {
    if (typeof I18n !== 'undefined' && I18n.t) return I18n.t(s, v);
    return v ? s.replace(/\{(\w+)\}/g, function (m, k) { return k in v ? String(v[k]) : m; }) : s;
  }

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
    'thandiwe thandi', 'thabiso thabo', 'lindiwe lindi', 'nokuthula thula', 'nompumelelo mpume', 'bongani bongi',
    'jacobus japie', 'johanna hanna hannie', 'maria marie ria', 'susanna sanna sannie', 'hendrina rina', 'wilhelmina mina wilma',
    'nicolaas klaas nico', 'stefanus fanie stefan', 'gertruida truida', 'magdalena lena magda', 'nkosinathi nathi', 'siphiwe spha',
    'thembinkosi thembi', 'mandisa mandi', 'nonhlanhla hlanhla', 'phumzile phumi', 'zanele zane', 'nomsa nomsie',
    'sean shaun shawn', 'anthony anton', 'jeffrey jeff', 'geoffrey geoff jeff', 'gerald gerry', 'jacqueline jackie', 'josephine jo josie', 'joanne jo',
    'leonard len lenny', 'raymond ray', 'ronald ron', 'sebastian seb', 'valerie val', 'veronica ronnie', 'wendy wen'
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
  /** A phone number being typed, as dialled at home: "+27 82 555" → "082555" when the church's dialling code is 27. '' if from abroad. */
  function phoneStart(s, dial) {
    var raw = String(s || '').trim(), d = raw.replace(/\D/g, ''), intl = raw.charAt(0) === '+' || /^00/.test(d);
    if (/^00/.test(d)) d = d.slice(2);
    if (intl) return dial && d.indexOf(dial) === 0 ? '0' + d.slice(dial.length) : '';
    return d && d.charAt(0) !== '0' ? '0' + d : d;
  }
  /** Whether a partly typed mobile (7 digits or more) is the start of a saved one. */
  function phoneLike(typed, saved, dial) { var t = phoneStart(typed, dial), s = phone(saved); return t.length >= 7 && !!s && s !== t && s.indexOf(t) === 0; }
  /** Whether a partly typed email (6 characters, or 2 and an "@") is the start of a saved one (not the same one). */
  function emailLike(typed, saved) {
    var t = String(typed || '').trim().toLowerCase(), s = String(saved || '').trim().toLowerCase();
    return (t.indexOf('@') >= 2 || t.length >= 6) && !!s && s !== t && s.indexOf(t) === 0;
  }
  var ROAD = { st: 'street', str: 'street', rd: 'road', ave: 'avenue', av: 'avenue', dr: 'drive', cres: 'crescent', cr: 'crescent', ln: 'lane',
    cl: 'close', pl: 'place', ct: 'court', crt: 'court', blvd: 'boulevard', hwy: 'highway', sq: 'square', tce: 'terrace', ter: 'terrace', ext: 'extension' };
  /** A street address to compare: small letters, no punctuation, and Rd/St/Ave… written out. */
  function street(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[.,#/'-]/g, ' ').replace(/\s+/g, ' ').trim()
      .split(' ').map(function (w) { return ROAD[w] || w; }).join(' ');
  }
  /** How a typed street address compares with a saved one: 'same', 'starts' (typed so far is its beginning) or ''.
   *  Needs a house number and 3 letters before it says anything. */
  function streetLike(typed, saved) {
    var t = street(typed), s = street(saved);
    if (!t || !s || !/\d/.test(t) || t.replace(/[^a-z]/g, '').length < 3) return '';
    return s === t ? 'same' : s.indexOf(t) === 0 ? 'starts' : '';
  }
  function phone(s) {
    var d = String(s || '').replace(/\D/g, '');   // any country: the last 9 digits, after the country code or the leading 0
    return d.length >= 9 ? '0' + d.slice(-9) : '';
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
  /** A rough "sounds like" key, so differently spelt names that sound alike match: Stephen/Steven, Sean/Shaun,
   *  Catherine/Kathryn, Philip/Phillip, Jon/John, Pillay/Pillai, Mohammed/Muhammad, Nkosi/Nkozi. */
  function sound(w, vowels) {
    w = plain(w).replace(/ /g, ''); if (!w) return '';
    w = w.replace(/^g(?=[eiy])/, 'j').replace(/sch|sh/g, 's').replace(/ph/g, 'f').replace(/gh/g, 'g').replace(/th/g, 't')
      .replace(/ch/g, 'k').replace(/ck|q/g, 'k').replace(/c(?=[eiy])/g, 's').replace(/c/g, 'k').replace(/x/g, 'ks').replace(/z/g, 's')
      .replace(/f/g, 'v').replace(/w/g, 'v').replace(/y/g, 'i').replace(/h/g, '').replace(/(.)\1+/g, '$1');
    return vowels ? w : w[0] + w.slice(1).replace(/[aeiou]/g, '');
  }
  /** Sound alike: the same with the vowels (Jon/John, Sarah/Sara), or – for longer names – the same consonants
   *  (Stephen/Steven, Catherine/Kathryn). Short names need the vowels too, so Ruth and Rita stay different. */
  function soundsAlike(a, b) {
    a = a.replace(/ /g, ''); b = b.replace(/ /g, '');
    if (a.length < 3 || b.length < 3 || a === b) return false;
    if (sound(a, true) === sound(b, true)) return true;
    var x = sound(a), y = sound(b);
    return a.length >= 4 && b.length >= 4 && x.length >= 3 && x === y;
  }
  /** One name is the start of the other – only while typing ("Dou" for "Douglas"). */
  function starts(typed, full) { return typed.length >= 1 && full.length > typed.length && full.indexOf(typed) === 0; }
  /** While typing: "Timoth" is on its way to "Timothy", which is a long form of "Tim". */
  var NAMES = Object.keys(GROUP);
  function startsShort(typed, other) {
    if (typed.length < 3) return false;
    return NAMES.some(function (n) { return n.length > typed.length && n.indexOf(typed) === 0 && sameGroup(n, other); });
  }
  /** A first name cut short ("And" for "Andy", "Chri" for "Christine"): 3 letters or more, the start of the other name. */
  function cutOff(a, b) { a = a.split(' ')[0]; b = b.split(' ')[0]; return a.length >= 3 && b.length > a.length && b.indexOf(a) === 0; }
  function slip(a, b) { var n = Math.min(a.length, b.length); return n >= 4 && distance(a, b) <= (n >= 7 ? 2 : 1); }
  function sameGroup(a, b) { return (GROUP[a] || []).some(function (g) { return (GROUP[b] || []).indexOf(g) >= 0; }); }

  /** How the first names compare: 'same', 'short' (Doug/Douglas), 'known' (the "known as" name), 'slip', 'sound', 'start'
   *  (only while typing: p's name is the start of q's), 'initial' or ''. */
  function firstMatch(p, q, typing) {
    var a = [plain(p.firstName), plain(p.preferredName)].filter(Boolean), b = [plain(q.firstName), plain(q.preferredName)].filter(Boolean);
    var fa = a[0] || '', fb = b[0] || '';
    if (fa && (fa === fb || fa.replace(/ /g, '') === fb.replace(/ /g, ''))) return 'same';
    if (a.some(function (x) { return b.indexOf(x) >= 0; })) return 'known';
    var wa = fa.split(' ')[0], wb = fb.split(' ')[0];      // "Anna Marie" / "Anna"
    if (wa && wa === wb) return 'same';
    if (a.some(function (x) { return b.some(function (y) { return sameGroup(x, y) || sameGroup(x.split(' ')[0], y.split(' ')[0]); }); })) return 'short';
    if (slip(fa, fb)) return 'slip';
    if (a.some(function (x) { return b.some(function (y) { return soundsAlike(x, y) || soundsAlike(x.split(' ')[0], y.split(' ')[0]); }); })) return 'sound';
    if (typing && a.some(function (x) { return b.some(function (y) { return starts(x, y) || startsShort(x, y); }); })) return 'start';
    if ((fa.length === 1 && fb[0] === fa) || (fb.length === 1 && fa[0] === fb)) return 'initial';
    if (a.some(function (x) { return b.some(function (y) { return cutOff(x, y) || cutOff(y, x); }); })) return 'cut';
    return '';
  }
  /** "vd Merwe", "v.d. Merwe" → "van der merwe"; "v Wyk" → "van wyk". */
  function surname(s) { return plain(String(s || '').replace(/\bv\.?\s?d\.?\s+/i, 'van der ').replace(/\bv\.?\s+(?=\w)/i, 'van ')); }
  /** How the surnames compare: 'same', 'slip', 'sound', 'part' (van der Merwe / Merwe, Smith-Jones / Smith),
   *  'start' (only while typing: p's surname is the start of q's) or ''. */
  function lastMatch(p, q, typing) {
    var a = surname(p.lastName), b = surname(q.lastName);
    if (!a || !b) return '';
    if (a === b || a.replace(/ /g, '') === b.replace(/ /g, '')) return 'same';
    if (slip(a.replace(/ /g, ''), b.replace(/ /g, ''))) return 'slip';
    if (soundsAlike(a, b)) return 'sound';
    if (typing && (starts(a.replace(/ /g, ''), b.replace(/ /g, '')) || starts(a, b.split(' ').pop()))) return 'start';
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
  function compare(p, q, typing) {
    if (!p || !q || p.id && p.id === q.id) return { score: 0, reasons: [] };
    if (p.elvantoId && q.elvantoId) {
      if (p.elvantoId === q.elvantoId) return { score: 100, reasons: ['The same Elvanto ID'], sure: true };
    }
    var twoInElvanto = !!(p.elvantoId && q.elvantoId);       // Elvanto has duplicates of its own: compared as usual, but never "certain" or "very likely" 
    var bp = birth(p), bq = birth(q);
    if (bp && bq && bp !== bq) return { score: 0, reasons: [] };    // different birthdays: different people
    if (p.familyRole && q.familyRole && (p.familyRole === 'child') !== (q.familyRole === 'child') && !(bp && bp === bq)) return { score: 0, reasons: [] };
    var fm = firstMatch(p, q, typing), lm = lastMatch(p, q, typing), sw = swapped(p, q), why = [], s = 0;
    var me = emails(p), sameMail = me.length && emails(q).some(function (e) { return me.indexOf(e) >= 0; });
    var mp = phone(p.mobile), sameMobile = !!mp && mp === phone(q.mobile), sameBirth = !!bp && bp === bq;
    if (fm === 'cut' && !(sameBirth || sameMail || sameMobile)) fm = '';   // a cut-off name alone is too weak (Chris / Christine)
    if (sw) { s += 55; why.push(T('First and last name swapped')); }
    else {
      if (fm === 'same') { s += 35; why.push(T('Same first name')); }
      else if (fm === 'known') { s += 32; why.push(T('Same name (one is what they are known as)')); }
      else if (fm === 'short') { s += 30; why.push(T('Short form of the same first name ({a} / {b})', { a: plain(p.preferredName || p.firstName), b: plain(q.preferredName || q.firstName) })); }
      else if (fm === 'slip') { s += 22; why.push(T('First names differ by a letter or two')); }
      else if (fm === 'sound') { s += 24; why.push(T('First names sound alike')); }
      else if (fm === 'start') { s += 18; why.push(T('Similar name')); }
      else if (fm === 'initial') { s += 12; why.push(T('First name given as an initial')); }
      else if (fm === 'cut' && (sameBirth || sameMail || sameMobile)) { s += 22; why.push(T('One first name is the start of the other ({a} / {b})', { a: plain(p.firstName), b: plain(q.preferredName || q.firstName) })); }
      if (lm === 'same') { s += 30; why.push(T('Same surname')); }
      else if (lm === 'slip') { s += 20; why.push(T('Surnames differ by a letter or two')); }
      else if (lm === 'sound') { s += 20; why.push(T('Surnames sound alike')); }
      else if (lm === 'part') { s += 15; why.push(T('Part of the surname matches')); }
      else if (lm === 'start') { s += 15; if (fm !== 'start') why.push(T('Similar name')); }
    }
    var firstOk = sw || !!fm && fm !== 'initial';   // 'cut' only gets here with the same mobile, email or birthday
    // Contact details only count with a matching first name: families share emails and phones.
    if (sameMail) { if (firstOk) { s += 30; why.push(T('Same email address')); } }
    if (sameMobile) { if (firstOk) { s += 30; why.push(T('Same mobile number')); } }
    if (sameBirth) { s += firstOk ? 30 : 0; if (firstOk) why.push(T('Same birthday')); }
    // A maiden name: same first name and birthday or contact details, different surname
    if (!lm && !sw && firstOk && (sameBirth || sameMail || sameMobile)) why.push(T('Different surname – perhaps a maiden or married name'));
    if (!firstOk && !sw) s = Math.min(s, 30);                // a different first name is a different person, even in the same household
    if (!lm && !sw && !(sameBirth || sameMail || sameMobile)) s = Math.min(s, 30);
    if (twoInElvanto && s >= 45) { s = Math.min(s, 69); why.push(T('Two separate people in Elvanto – check there too')); }
    return { score: Math.min(s, 99), reasons: why, sure: false, first: fm, last: lm, sameEmail: !!sameMail, sameMobile: sameMobile };
  }
  var SENS = { 1: { possible: 62, similar: 0, letters: 2 }, 2: { possible: 52, similar: 36, letters: 2 }, 3: { possible: 45, similar: 30, letters: 2 },
    4: { possible: 38, similar: 24, letters: 1 }, 5: { possible: 31, similar: 18, letters: 1 } };
  function cut(sens) { return SENS[sens] || SENS[3]; }
  function level(score, sens) { return score >= 100 ? 'certain' : score >= 70 ? 'likely' : score >= cut(sens).possible ? 'possible' : ''; }

  /**
   * Possible duplicates among everyone. people: [{ id, firstName, lastName, preferredName, email, mobile, birthDate, familyRole,
   * elvantoId, active }]. ignore: ["id1|id2"] pairs the church said are different people.
   * Returns [{ a, b, score, level, reasons }], most likely first. People who were deleted are left out.
   */
  function find(people, ignore, sens) {
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
        var c = compare(b[i], b[j]), lv = level(c.score, sens);
        if (lv) out.push({ a: b[i].id, b: b[j].id, score: c.score, level: lv, reasons: c.reasons });
      }
    });
    var names = {}; list.forEach(function (p) { if (!(p.id in names)) names[p.id] = nm(p); });   // by id once, not a search for each comparison
    return out.sort(function (x, y) { return y.score - x.score || (names[x.a] || '').localeCompare(names[y.a] || ''); });
  }
  function pair(a, b) { return [a, b].sort().join('|'); }

  /**
   * While someone is being added or changed: the existing people they may be. person: what has been typed so far
   * (with its own id when editing, so it isn't matched to itself). Returns [{ id, score, level, reasons }], best first.
   */
  function matches(person, people, ignore, sens) {
    var skip = {}; (ignore || []).forEach(function (k) { skip[k] = 1; });
    return (people || []).filter(function (q) { return q.id !== person.id && q.firstName !== 'Deleted' && !q.deletedAt && !q.mergedInto && !(person.id && skip[pair(person.id, q.id)]); })
      .map(function (q) { var c = compare(person, q); return { id: q.id, score: c.score, level: level(c.score, sens), reasons: c.reasons }; })
      .filter(function (m) { return m.level; })
      .sort(function (x, y) { return y.score - x.score; });
  }

  /**
   * The live check in the Add / Edit window, as each letter is typed. person: what has been typed so far (with its own id when
   * editing); sens: the church's sensitivity (1–5, default 3). Returns:
   *   people: [{ id, score, level: certain|likely|possible|similar, reasons }], best first – names need two letters each;
   *           "similar" = a name like it (the surname matches, sounds alike or starts the same), shown as a gentle hint
   *   email:  [id] – others whose email is the one typed     mobile: [id] – others whose mobile is the one typed
   *   emailLike / mobileLike: [id] – others whose email or mobile starts with what has been typed so far (not the same)
   *   address: [id] – others at the same street address     addressLike: [id] – others whose street address starts like it
   * opts: { dial: the church's dialling code ('27'), so "+27 82…" is matched as "082…" while it is typed }.
   * person.familyId: the household chosen for this person – its members are left out of the address hints.
   */
  function live(person, people, ignore, sens, opts) {
    var dial = String((opts || {}).dial || ''), st = (person.address || {}).street || '';
    var cs = cut(sens);
    var skip = {}; (ignore || []).forEach(function (k) { skip[k] = 1; });
    var others = (people || []).filter(function (q) { return q && q.id !== person.id && q.firstName !== 'Deleted' && !q.deletedAt && !q.mergedInto; });
    var me = emails(person), mob = phone(person.mobile);
    var out = { people: [], email: [], mobile: [], emailLike: [], mobileLike: [], address: [], addressLike: [] };
    others.forEach(function (q) {
      var sameMail = me.length && emails(q).some(function (e) { return me.indexOf(e) >= 0; }), sameMob = mob && phone(q.mobile) === mob;
      if (sameMail) out.email.push(q.id);
      else if (person.email && [q.email].concat(q.otherEmails || []).some(function (e) { return emailLike(person.email, e); })) out.emailLike.push(q.id);
      if (sameMob) out.mobile.push(q.id);
      else if (person.mobile && phoneLike(person.mobile, q.mobile, dial)) out.mobileLike.push(q.id);
      var home = person.familyId && (q.familyId === person.familyId || (q.householdIds || []).indexOf(person.familyId) >= 0);
      var a = st && !home ? streetLike(st, (q.address || {}).street) : '';
      if (a === 'same') out.address.push(q.id); else if (a === 'starts') out.addressLike.push(q.id);
    });
    if (plain(person.firstName).length >= 2 && surname(person.lastName).length >= cs.letters) {
      out.people = others.filter(function (q) { return !(person.id && skip[pair(person.id, q.id)]); }).map(function (q) {
        var c = compare(person, q, true), lv = level(c.score, sens);
        if (!lv && cs.similar && c.score >= cs.similar && c.last && c.first) lv = 'similar';
        return { id: q.id, score: c.score, level: lv, reasons: c.reasons };
      }).filter(function (m) { return m.level; }).sort(function (x, y) { return y.score - x.score; });
    }
    return out;
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

  return { compare: compare, find: find, matches: matches, live: live, sound: sound, level: level, SENS: SENS, pair: pair, phone: phone, email: email, phoneStart: phoneStart, street: street, streetLike: streetLike, plain: plain,
    mergeFields: mergeFields, ignored: ignored, SHORT: SHORT };
})();
if (typeof module !== 'undefined') module.exports = Duplicates;
