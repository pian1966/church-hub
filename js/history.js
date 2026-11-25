/* Church & Trellis – Undo and Version history: the rules (pure, no screens; tested in tests/history.test.js).
 * Screens: js/history-ui.js. The data layer (where versions are kept, who may read them) is Opus's part:
 * docs/architecture/handover/history-opus.md.
 *
 * Two things, both built on one "version" record:
 *   - Undo: the last few changes made on THIS device, undone with one tap ("Undo" beside the toast).
 *   - Version history: every earlier version of a record (a person, a household, a service…), kept for 90 days, like Google Docs –
 *     see what changed and who changed it, and put the record back as it was.
 *
 * A version ("entry"):
 *   { id, c: 'people', rid: <record id>, at: 'YYYY-MM-DD HH:MM', by: <person id>, byName: 'Name', kind: 'edit' | 'add' | 'remove' | 'restore',
 *     before: <the record as it was, or null for 'add'>, after: <the record as it became, or null for 'remove'>,
 *     fields: ['firstName', 'details.email'] }       // what changed, so the list can say it without opening both records
 *
 * Privacy: the snapshot never carries what the record keeps private (SKIP below: medical notes, ID, photo). Who may read versions is the
 * same short list that may see the record (the data layer decides; Administrators and Pastors for people).
 */
var History = (function () {
  'use strict';
  var KEEP_DAYS = 90, KEEP_LAST = 20, MERGE_MIN = 10, UNDO_MAX = 20, UNDO_MIN = 30;

  /** The collections whose records have a history, and the plain word for one of them. */
  var COVER = {
    people: 'person', families: 'household', careGroups: 'group', services: 'service', positions: 'position', teams: 'team',
    groups: 'group', customGroups: 'group', leaderBodies: 'leadership group', events: 'event', books: 'book', studies: 'study'
  };
  /** Never copied into a version. */
  var SKIP = ['updatedAt', 'createdAt', 'medical', 'photo', 'idNumber', 'pin', 'pinHash'];

  function covered(c) { return Object.prototype.hasOwnProperty.call(COVER, c); }
  function copy(x) { return x === undefined ? undefined : JSON.parse(JSON.stringify(x)); }
  function canon(x) {
    if (x === null || typeof x !== 'object') return JSON.stringify(x === undefined ? null : x);
    if (Array.isArray(x)) return '[' + x.map(canon).join(',') + ']';
    return '{' + Object.keys(x).sort().map(function (k) { return JSON.stringify(k) + ':' + canon(x[k]); }).join(',') + '}';
  }
  function same(a, b) { return canon(a) === canon(b); }
  function minutes(at) { return Date.parse(String(at).replace(' ', 'T') + 'Z') / 60000; }

  /** The record as it goes into a version: a copy without the private parts. */
  function strip(rec) {
    if (!rec) return null;
    var out = copy(rec);
    SKIP.forEach(function (k) { delete out[k]; });
    return out;
  }

  /** What changed between two records, as field names ('firstName', 'details.email'). One level into `details`; arrays and other objects count as one field. */
  function changed(before, after) {
    var a = strip(before) || {}, b = strip(after) || {}, out = [];
    Object.keys(Object.assign({}, a, b)).sort().forEach(function (k) {
      if (k === 'details' && a[k] && b[k] && typeof a[k] === 'object' && typeof b[k] === 'object') {
        Object.keys(Object.assign({}, a[k], b[k])).sort().forEach(function (d) { if (!same(a[k][d], b[k][d])) out.push('details.' + d); });
      } else if (!same(a[k], b[k])) out.push(k);
    });
    return out;
  }

  /** The version to keep for a change – or null when nothing that matters changed (or the collection has no history). */
  function entry(c, before, after, who, at, id) {
    if (!covered(c) || (!before && !after)) return null;
    var kind = !before ? 'add' : !after ? 'remove' : 'edit';
    var fields = kind === 'edit' ? changed(before, after) : [];
    if (kind === 'edit' && !fields.length) return null;
    var rid = (after || before).id;
    return { id: id || ('h' + minutes(at) + '-' + rid), c: c, rid: rid, at: at, by: (who && who.id) || '', byName: (who && who.name) || '',
      kind: kind, before: strip(before), after: strip(after), fields: fields };
  }

  /** Saving as you type makes many small changes: the same person changing the same record within 10 minutes becomes one version.
   *  Returns the entry to keep – `prev` (the latest kept for this record) widened to cover `next` – or `next` itself when they should stay apart. */
  function merge(prev, next) {
    if (!prev || !next || prev.c !== next.c || prev.rid !== next.rid || prev.by !== next.by) return next;
    if (prev.kind !== 'edit' || next.kind !== 'edit') return next;
    if (minutes(next.at) - minutes(prev.at) > MERGE_MIN) return next;
    var fields = changed(prev.before, next.after);
    if (!fields.length) return null;   // changed and changed back: nothing to keep (and prev should go)
    return { id: prev.id, c: prev.c, rid: prev.rid, at: next.at, by: prev.by, byName: prev.byName, kind: 'edit', before: prev.before, after: next.after, fields: fields };
  }

  /** The versions of one record, newest first. */
  function forRecord(entries, c, rid) {
    return (entries || []).filter(function (e) { return e && e.c === c && e.rid === rid; })
      .sort(function (a, b) { return a.at < b.at ? 1 : a.at > b.at ? -1 : a.id < b.id ? 1 : -1; });
  }

  /** What to throw away: a version goes when it is older than 90 days AND the record has 20 newer ones (so a record that is rarely
   *  changed keeps its latest 20 however old, and a busy one doesn't fill the church's database). Returns the ids to delete. */
  function prune(entries, nowAt) {
    var cutoff = minutes(nowAt) - KEEP_DAYS * 1440, rank = {}, out = [];
    (entries || []).slice().sort(function (a, b) { return a.at < b.at ? 1 : -1; }).forEach(function (e) {
      var k = e.c + '/' + e.rid; rank[k] = (rank[k] || 0) + 1;
      if (rank[k] > KEEP_LAST && minutes(e.at) < cutoff) out.push(e.id);
    });
    return out;
  }

  /** Has someone changed the record since this version was made? Then putting it back would undo their work too. */
  function moved(current, e) { return same(strip(current), strip(e.after)); }

  /** Putting a version back. Returns { action: 'put' | 'remove' | 'none', record, newer }.
   *  - an edit or a removal: the record goes back to its `before`
   *  - an addition: the record is taken out again
   *  `fields` (optional) puts back only those fields, leaving the rest as they are now – "just the phone number".
   *  `newer` is true when the record has been changed since that version (the screen says so, and asks). */
  function restore(current, e, fields) {
    var newer = e.kind !== 'remove' && !!current && !moved(current, e);
    if (e.kind === 'add') return current ? { action: 'remove', record: current, newer: newer } : { action: 'none', record: null, newer: false };
    if (!e.before) return { action: 'none', record: null, newer: newer };
    var rec;
    if (fields && fields.length && current) {
      rec = copy(current);
      fields.forEach(function (f) {
        var p = f.split('.');
        if (p.length === 2) {
          rec[p[0]] = rec[p[0]] || {};
          if (e.before[p[0]] && p[1] in e.before[p[0]]) rec[p[0]][p[1]] = copy(e.before[p[0]][p[1]]); else delete rec[p[0]][p[1]];
        } else if (p[0] in e.before) rec[p[0]] = copy(e.before[p[0]]); else delete rec[p[0]];
      });
    } else {
      rec = copy(e.before);
      if (current) SKIP.forEach(function (k) { if (k in current) rec[k] = copy(current[k]); });   // private parts are never rolled back (they aren't in the version)
    }
    rec.id = e.rid;
    return { action: 'put', record: rec, newer: newer };
  }

  /* ---------- Undo: this device, this session ---------- */
  var stack = [];
  function undoPush(e, nowMs) {
    if (!e) return;
    stack.push({ e: e, ms: nowMs === undefined ? Date.now() : nowMs });
    if (stack.length > UNDO_MAX) stack.shift();
  }
  /** The change an Undo button would take back (the latest, within 30 minutes), or null. */
  function undoPeek(nowMs) {
    var t = stack[stack.length - 1]; nowMs = nowMs === undefined ? Date.now() : nowMs;
    return t && nowMs - t.ms <= UNDO_MIN * 60000 ? t.e : null;
  }
  function undoPop() { var t = stack.pop(); return t ? t.e : null; }
  function undoClear() { stack = []; }
  function undoSize() { return stack.length; }

  /* ---------- words ---------- */
  /** A plain one-line label for a field: 'details.homePhone' → 'Home phone'. */
  function fieldLabel(f) {
    var last = String(f).split('.').pop().replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase();
    return last.charAt(0).toUpperCase() + last.slice(1);
  }
  /** 'Changed First name and Email' – the English the screens translate piece by piece; kept for tests and the log. */
  function listFields(fields, max) {
    max = max || 3; var l = (fields || []).map(fieldLabel).filter(function (x, i, a) { return a.indexOf(x) === i; });
    if (l.length <= max) return l.length > 1 ? l.slice(0, -1).join(', ') + ' and ' + l[l.length - 1] : l.join('');
    return l.slice(0, max).join(', ') + ' and ' + (l.length - max) + ' more';
  }

  return { COVER: COVER, SKIP: SKIP, KEEP_DAYS: KEEP_DAYS, KEEP_LAST: KEEP_LAST, MERGE_MIN: MERGE_MIN, UNDO_MIN: UNDO_MIN, covered: covered, strip: strip, changed: changed,
    entry: entry, merge: merge, forRecord: forRecord, prune: prune, moved: moved, restore: restore,
    undoPush: undoPush, undoPeek: undoPeek, undoPop: undoPop, undoClear: undoClear, undoSize: undoSize, fieldLabel: fieldLabel, listFields: listFields };
})();
if (typeof module !== 'undefined') module.exports = History;
