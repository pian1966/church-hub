/*
 * Church Hub – the Archive: the church's own records – Council minutes, architectural plans, staff contracts, annual
 * appraisals and whatever else the church keeps. A record: archive/{id} = { title, cat, date, note, access, bodyId,
 *   aboutId, aboutName, shownTo, link, file: { name, type, size, parts }, by }. The file itself is kept apart, cut into
 * parts (archive/{id}/parts/{n} = { data: base64 }), and fetched only when someone opens it.
 * Who may see a record (access), copied from its category when it is added and changeable on each record:
 *   all      everyone who signs in
 *   body     the members of one leadership group (bodyId; js/leaders.js) – e.g. the Council for its minutes
 *   office   Administrators and Pastors
 *   private  Administrators and the Senior Pastor only – staff contracts and appraisals
 * Opening the Archives is limited to Administrators and Council members; within that, access is limited by the
 * record's choice above and (for a person) whether it is shown to them. Administrators and Council members manage
 * records. Categories are the church's own (settings.archiveCats).
 * Folders: each category is a folder, and a folder may sit inside another (parent: its id; '' at the top). A folder that
 * sorts by date (byDate) shows its documents in Year -> Month folders made from each record's date, so nobody has to make
 * "2026" or "November" by hand. A record's cat is the folder it is in (any level). checkDate() looks for a date that seems
 * wrong (in the future, or not the month the title or file name speaks of) so the person saving can be asked about it.
 * Tested with node: tests/archive.test.js. POPIA: see docs/POPIA.md, "Archive".
 */
var Archive = (function () {
  'use strict';
  var TX = function (x) { return x; };   // translated where it is shown
  var ACCESS = [['all', TX('Everyone who signs in')], ['body', TX('The members of a leadership group')], ['office', TX('Administrators and Pastors')], ['private', TX('Administrators and the Senior Pastor only')]];
  /** The categories a church starts with (person: a record is about one person, e.g. a staff member). */
  var CATS = [
    { id: 'minutes', name: TX('Council meetings'), access: 'body', byDate: true },
    { id: 'plans', name: TX('Architectural plans'), access: 'office' },
    { id: 'contracts', name: TX('Staff contracts'), access: 'private', person: true },
    { id: 'appraisals', name: TX('Annual appraisals'), access: 'private', person: true },
    { id: 'other', name: TX('Other records'), access: 'office' }
  ];
  var MAX = 15 * 1024 * 1024;   // the largest file kept in Church Hub; anything bigger is kept elsewhere and linked
  var PART = 900000;            // letters of base64 per part: a database document holds at most 1 MB
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  function okAccess(a) { return ACCESS.some(function (x) { return x[0] === a; }); }
  /** The church's folders (Settings), or the starting ones. A parent that is missing, or that would put a folder inside
   *  itself, puts it at the top instead. The starting Council folder sorts by date unless the church said otherwise. */
  function cats(settings) {
    var list = settings && Array.isArray(settings.archiveCats) && settings.archiveCats.length ? settings.archiveCats : CATS;
    var out = list.map(function (c) { return { id: String(c.id), name: String(c.name || ''), access: okAccess(c.access) ? c.access : 'office', person: !!c.person,
      parent: String(c.parent || ''), byDate: typeof c.byDate === 'boolean' ? c.byDate : String(c.id) === 'minutes' }; });
    var by = {}; out.forEach(function (c) { by[c.id] = c; });
    out.forEach(function (c) {
      var seen = {}, p = c.parent;
      while (p) { if (!by[p] || seen[p] || p === c.id) { c.parent = ''; break; } seen[p] = 1; p = by[p].parent; }
    });
    return out;
  }
  function cat(settings, id) { return cats(settings).filter(function (c) { return c.id === id; })[0] || null; }
  /** A record ready to save: only the fields the Archive keeps, and never a leadership group or "shown to" that doesn't apply. */
  function clean(rec) {
    var r = rec || {}, out = { title: String(r.title || '').trim().slice(0, 150), cat: String(r.cat || ''), date: String(r.date || '').slice(0, 10), note: String(r.note || '').trim().slice(0, 1000),
      access: okAccess(r.access) ? r.access : 'private', bodyId: '', aboutId: String(r.aboutId || ''), aboutName: String(r.aboutName || ''), shownTo: '', link: String(r.link || '').trim().slice(0, 500), displayOnApplication: r.displayOnApplication === true, by: String(r.by || '') };
    if (out.access === 'body') { if (r.bodyId) out.bodyId = String(r.bodyId); else out.access = 'office'; }   // no group chosen: the office, never wider
    if (!out.aboutId) out.aboutName = '';
    else if (r.shownTo) out.shownTo = out.aboutId;
    if (r.file && r.file.name) out.file = { name: String(r.file.name).slice(0, 150), type: String(r.file.type || ''), size: +r.file.size || 0, parts: +r.file.parts || 0 };
    ['id', 'createdAt', 'updatedAt'].forEach(function (k) { if (r[k]) out[k] = r[k]; });
    return out;
  }
  /** May this person see the record? who = { admin, pastor, senior, ids: [their person id(s)], bodies: [leadership groups they are in] }.
   *  The database rules (firestore.rules, seesRecord) say the same. */
  function sees(rec, who) {
    var r = rec || {}, w = who || {}, ids = w.ids || [];
    if (!w.admin && !w.council) return false;
    if (w.admin) return true;
    if (r.access === 'private' && w.senior) return true;      // staff contracts and appraisals: the Senior Pastor too (on the Council)
    if (r.access === 'all') return true;
    if (r.access === 'office' && w.pastor) return true;
    if (r.bodyId && (w.bodies || []).indexOf(r.bodyId) >= 0) return true;
    return !!r.shownTo && ids.indexOf(r.shownTo) >= 0;
  }
  /** A safe web link (https or http), or ''. */
  function link(s) { s = String(s || '').trim(); if (s && !/^[a-z][a-z0-9+.-]*:/i.test(s)) s = 'https://' + s; return /^https?:\/\/[^\s"'<>]+$/i.test(s) ? s : ''; }
  /** A Google Docs or Drive document link as an embeddable preview URL, or '' when it is not supported. */
  function embedUrl(s) {
    var safe = link(s), u;
    if (!safe) return '';
    try { u = new URL(safe); } catch (e) { return ''; }
    var host = u.hostname.toLowerCase(), match, type;
    if (host === 'docs.google.com') {
      match = u.pathname.match(/^\/(document|spreadsheets|presentation)\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]+)(?:\/|$)/);
      if (!match) return '';
      type = match[1]; return 'https://docs.google.com/' + type + '/d/' + match[2] + '/preview?embedded=true';
    }
    if (host === 'drive.google.com') {
      match = u.pathname.match(/^\/file\/d\/([A-Za-z0-9_-]+)(?:\/|$)/);
      if (!match) return '';
      return 'https://drive.google.com/file/d/' + match[1] + '/preview?embedded=true';
    }
    return '';
  }
  /** Cut a file (as base64) into parts small enough for one database document each, and put them together again. */
  function split(b64, size) { var out = [], n = size || PART; for (var i = 0; i < b64.length; i += n) out.push(b64.slice(i, i + n)); return out; }
  function join(parts) { return (parts || []).join(''); }
  /** "2.4 MB", "310 KB" */
  function sizeText(bytes) { bytes = +bytes || 0; return bytes >= 1048576 ? (Math.round(bytes / 104857.6) / 10) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB'; }
  function year(rec) { return String((rec || {}).date || '').slice(0, 4); }
  /** The years that have records, newest first. */
  function years(recs) { var y = {}; (recs || []).forEach(function (r) { if (year(r)) y[year(r)] = 1; }); return Object.keys(y).sort().reverse(); }
  /** Records of a category and year (either may be ''), newest first. */
  function list(recs, catId, yr) {
    return (recs || []).filter(function (r) { return (!catId || r.cat === catId) && (!yr || year(r) === yr); })
      .sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')) || String(a.title || '').localeCompare(String(b.title || '')); });
  }
  /** The months of a year with no record in a category (e.g. Council minutes not yet filed), as numbers 1–12, up to `upTo`
   *  (YYYY-MM) – and only after the category's very first record, so a church that has just started filing isn't told
   *  about every month before it began. */
  function missingMonths(recs, catId, yr, upTo) {
    var have = {}, out = [], first = list(recs, catId, '').map(function (r) { return String(r.date || '').slice(0, 7); }).filter(Boolean).sort()[0];
    if (!first) return out;
    list(recs, catId, yr).forEach(function (r) { have[+String(r.date).slice(5, 7)] = 1; });
    for (var m = 1; m <= 12; m++) { var ym = yr + '-' + (m < 10 ? '0' : '') + m; if (!have[m] && ym > first && (!upTo || ym <= upTo)) out.push(m); }
    return out;
  }
  /* ---------- folders ---------- */
  /** The folders directly inside a folder ('' = the top), in the church's order. */
  function kids(settings, parentId) { return cats(settings).filter(function (c) { return c.parent === (parentId || ''); }); }
  /** The folders from the top down to this one ([] when it doesn't exist). */
  function path(settings, id) {
    var all = cats(settings), by = {}, out = []; all.forEach(function (c) { by[c.id] = c; });
    for (var c = by[id]; c; c = c.parent ? by[c.parent] : null) out.unshift(c);
    return out;
  }
  /** A folder and every folder inside it, at any depth (ids). */
  function under(settings, id) {
    var out = [id], all = cats(settings);
    for (var i = 0; i < out.length; i++) all.forEach(function (c) { if (c.parent === out[i]) out.push(c.id); });
    return out;
  }
  /** How many records are in a folder, counting the folders inside it. */
  function count(settings, recs, id) { var ids = under(settings, id); return (recs || []).filter(function (r) { return ids.indexOf(r.cat) >= 0; }).length; }
  function month(rec) { return +String((rec || {}).date || '').slice(5, 7) || 0; }
  /** The months of a year that have records, newest first: [{ m: 11, n: 3 }]. */
  function months(recs, yr) {
    var n = {}; (recs || []).forEach(function (r) { if (year(r) === yr && month(r)) n[month(r)] = (n[month(r)] || 0) + 1; });
    return Object.keys(n).map(Number).sort(function (a, b) { return b - a; }).map(function (m) { return { m: m, n: n[m] }; });
  }
  /** Records of a folder in one year and month (month may be 0 for the whole year), newest first. */
  function inMonth(recs, catId, yr, m) { return list(recs, catId, yr).filter(function (r) { return !m || month(r) === m; }); }

  /* ---------- checking a date ---------- */
  /** Month names people write in titles and file names (English, Afrikaans, isiZulu, isiXhosa, Sesotho). */
  var MONTHS = {
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    af: ['Januarie', 'Februarie', 'Maart', 'April', 'Mei', 'Junie', 'Julie', 'Augustus', 'September', 'Oktober', 'November', 'Desember'],
    zu: ['Januwari', 'Februwari', 'Mashi', 'Ephreli', 'Meyi', 'Juni', 'Julayi', 'Agasti', 'Septemba', 'Okthoba', 'Novemba', 'Disemba'],
    xh: ['Janyuwari', 'Februwari', 'Matshi', 'Epreli', 'Meyi', 'Juni', 'Julayi', 'Agasti', 'Septemba', 'Okthobha', 'Novemba', 'Disemba'],
    st: ['Pherekgong', 'Hlakola', 'Hlakubele', 'Mmesa', 'Motsheanong', 'Phupjane', 'Phupu', 'Phato', 'Lwetse', 'Mphalane', 'Pudungwana', 'Tshitwe']
  };
  var SHORT = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sept?', 'oct', 'nov', 'dec'];
  var L = 'A-Za-zÀ-ɏ';
  /** Which month (1-12) a word names, or 0. "may" counts only as "May", so "who may sign" isn't a month. */
  function monthOf(word, shortToo) {
    var w = String(word || ''), lw = w.toLowerCase(), m = 0;
    Object.keys(MONTHS).some(function (k) { var i = MONTHS[k].map(function (x) { return x.toLowerCase(); }).indexOf(lw); if (i >= 0) m = i + 1; return m; });
    if (!m && shortToo) SHORT.some(function (x, i) { if (new RegExp('^' + x + '\\.?$').test(lw)) m = i + 1; return m; });
    if (m === 5 && lw === 'may' && w !== 'May' && w !== 'MAY') return 0;
    return m;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function days(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
  /** The date a title or file name speaks of: { y, m, d } (any may be 0), or null. "2026-11-12", "12 November 2026",
   *  "Nov 2026", "November minutes", "Budget 2026". */
  function named(text) {
    var t = String(text || '').replace(/\.[A-Za-z0-9]{1,5}$/, ''), x, m;
    var word = '([' + L + ']+\\.?)', gap = '[\\s_.,-]+';
    if ((x = t.match(/(?:^|\D)((?:18|19|20)\d\d)[-_. ](0?[1-9]|1[0-2])(?:[-_. ](0?[1-9]|[12]\d|3[01]))?(?:\D|$)/))) return { y: +x[1], m: +x[2], d: x[3] ? +x[3] : 0 };
    if ((x = t.match(/(?:^|\D)(0?[1-9]|[12]\d|3[01])[-_. ](0?[1-9]|1[0-2])[-_. ]((?:18|19|20)\d\d)(?:\D|$)/))) return { y: +x[3], m: +x[2], d: +x[1] };
    var re = new RegExp('(?:^|[^' + L + '0-9])(?:(\\d{1,2})(?:st|nd|rd|th)?' + gap + ')?' + word + '(?:' + gap + '((?:18|19|20)\\d\\d))?(?![' + L + '])', 'g');
    while ((x = re.exec(t))) {
      m = monthOf(x[2].replace(/\.$/, ''), !!(x[1] || x[3]));
      if (m) { var d = x[1] && +x[1] <= 31 ? +x[1] : 0; return { y: x[3] ? +x[3] : 0, m: m, d: d }; }
      re.lastIndex = x.index + 1;
    }
    if ((x = t.match(/(?:^|\D)((?:18|19|20)\d\d)(?:\D|$)/))) return { y: +x[1], m: 0, d: 0 };
    return null;
  }
  /** Reasons to ask about a record's date before saving, each { code, date (a suggestion, or '') }:
   *    future   – the date hasn't come yet
   *    old      – before 1800, most likely a typing slip
   *    named    – the title or file name speaks of another month or year (date: what it speaks of)
   *    meeting  – the other documents filed in that month of a date-sorted folder share another date (date: theirs)
   *    same     – a document with the same title is already there (date: '')
   *  o = { date, title, fileName, today, byDate, recs: the other records of the same folder, id: the record's own id } */
  function checkDate(o) {
    var out = [], date = String(o.date || ''), y = +date.slice(0, 4), m = +date.slice(5, 7), d = +date.slice(8, 10);
    if (!y || !m || !d) return out;
    if (o.today && date > o.today) out.push({ code: 'future', date: '' });
    if (y < 1800) out.push({ code: 'old', date: '' });
    var said = named(o.title) || named(o.fileName);
    if (said && ((said.y && said.y !== y) || (said.m && said.m !== m) || (said.d && said.m === m && said.d !== d))) {
      var ny = said.y || (said.m > m ? y - 1 : y), nm = said.m || m, nd = said.d || Math.min(d, days(ny, nm));
      if (nd > days(ny, nm)) nd = days(ny, nm);
      out.push({ code: 'named', date: ny + '-' + pad(nm) + '-' + pad(nd), y: said.y, m: said.m });
    }
    var others = (o.recs || []).filter(function (r) { return !o.id || r.id !== o.id; });
    if (o.byDate && !out.some(function (w) { return w.code === 'named'; })) {
      var same = others.filter(function (r) { return String(r.date || '').slice(0, 7) === date.slice(0, 7); }), dates = {};
      same.forEach(function (r) { dates[r.date] = 1; });
      var ds = Object.keys(dates);
      if (ds.length === 1 && ds[0] !== date) out.push({ code: 'meeting', date: ds[0] });
    }
    var t = String(o.title || '').trim().toLowerCase();
    if (t && others.some(function (r) { return String(r.title || '').trim().toLowerCase() === t && (!o.byDate || String(r.date || '').slice(0, 7) === date.slice(0, 7)); })) out.push({ code: 'same', date: '' });
    return out;
  }
  return { ACCESS: ACCESS, CATS: CATS, MAX: MAX, PART: PART, cats: cats, cat: cat, clean: clean, sees: sees, link: link, embedUrl: embedUrl, split: split, join: join, sizeText: sizeText, year: year, years: years, list: list, missingMonths: missingMonths, copy: copy,
    kids: kids, path: path, under: under, count: count, month: month, months: months, inMonth: inMonth, MONTHS: MONTHS, named: named, checkDate: checkDate };
})();
if (typeof module !== 'undefined') module.exports = Archive;
