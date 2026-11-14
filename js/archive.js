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
 * Tested with node: tests/archive.test.js. POPIA: see docs/POPIA.md, "Archive".
 */
var Archive = (function () {
  'use strict';
  var TX = function (x) { return x; };   // translated where it is shown
  var ACCESS = [['all', TX('Everyone who signs in')], ['body', TX('The members of a leadership group')], ['office', TX('Administrators and Pastors')], ['private', TX('Administrators and the Senior Pastor only')]];
  /** The categories a church starts with (person: a record is about one person, e.g. a staff member). */
  var CATS = [
    { id: 'minutes', name: TX('Council minutes'), access: 'body' },
    { id: 'plans', name: TX('Architectural plans'), access: 'office' },
    { id: 'contracts', name: TX('Staff contracts'), access: 'private', person: true },
    { id: 'appraisals', name: TX('Annual appraisals'), access: 'private', person: true },
    { id: 'other', name: TX('Other records'), access: 'office' }
  ];
  var MAX = 15 * 1024 * 1024;   // the largest file kept in Church Hub; anything bigger is kept elsewhere and linked
  var PART = 900000;            // letters of base64 per part: a database document holds at most 1 MB
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  function okAccess(a) { return ACCESS.some(function (x) { return x[0] === a; }); }
  /** The church's categories (Settings), or the starting ones. */
  function cats(settings) {
    var list = settings && Array.isArray(settings.archiveCats) && settings.archiveCats.length ? settings.archiveCats : CATS;
    return list.map(function (c) { return { id: String(c.id), name: String(c.name || ''), access: okAccess(c.access) ? c.access : 'office', person: !!c.person }; });
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
  return { ACCESS: ACCESS, CATS: CATS, MAX: MAX, PART: PART, cats: cats, cat: cat, clean: clean, sees: sees, link: link, embedUrl: embedUrl, split: split, join: join, sizeText: sizeText, year: year, years: years, list: list, missingMonths: missingMonths, copy: copy };
})();
if (typeof module !== 'undefined') module.exports = Archive;
