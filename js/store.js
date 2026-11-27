/*
 * Church & Trellis – data layer. All data goes through Store; modules never touch the browser storage or Firebase directly.
 * Reads come from an in-memory copy (fast, synchronous); writes update the copy at once and are saved in the background.
 *
 * Two modes, same interface:
 *  - Demo: made-up people, saved in this browser. Used when js/firebase-config.js is empty, or with ?demo in the address.
 *  - Live: the church's Firebase project (Firestore in Johannesburg). Sign-in with Google or an email link.
 *
 * In live mode one "person" is stored as several documents, so the database's security rules (firestore.rules)
 * can protect each part separately (POPIA):
 *   people/{id}     name, family and contact details          details/{id}  birthday, key dates, staff details
 *   medical/{id}    children's medical notes (kids only)      directory/{id} name + phone, only with directory consent
 *   notes/{personId} pastoral notes for one person (pastors only)
 *   officeNotes/{personId} church office notes (Administrators and Pastors)   idNumbers/{personId} ID number (Administrators only)
 * Leave is stored as leave/config + leaveRequests + leaveAdjustments, plus away/{id} (approved dates only, for rosters).
 * Store puts these back together, so the modules see exactly the same shapes as in the demo.
 */
var Store = (function () {
  'use strict';
  var KEY = 'church_hub_demo_v1';
  var COLLECTIONS = ['people', 'families', 'consents', 'notes', 'teams', 'positions', 'skills', 'services', 'assignments',
    'groups', 'customGroups', 'applicationDocuments', 'blockouts', 'dsr', 'breaches', 'audit', 'elvantoSync', 'robotStatus', 'guardians', 'noCollect', 'serveOffers', 'serveSwaps', 'awayAsks', 'crews', 'officeNotes', 'elvantoFound', 'careGroups', 'careShare', 'words', 'wordIdeas', 'detailChanges', 'emailPrompts', 'messages', 'msgGroups', 'partnerApps', 'leaderBodies', 'archive', 'books', 'loans', 'libraryDuplicateIgnores', 'board', 'market', 'marketPhotos', 'studies', 'events', 'eventSignups', 'appUse', 'history'];
  var listeners = [], remoteListeners = [], errorListeners = [], leaveHooks = [], user = null, demoFiles = {};
  var leaveSnap = {};   // each leave request as last saved, to tell what changed
  /** "View as": an Administrator looking at Church & Trellis as another role would see it. Nothing is saved while it is on. */
  var previewRole = '', previewCare = '', PREVIEW_MSG = 'You’re only viewing Church & Trellis as another role – nothing is saved. Switch back to Administrator to make changes.';
  function previewing() { if (!previewRole) return false; tell(PREVIEW_MSG); return true; }
  function tell(msg) { errorListeners.forEach(function (fn) { try { fn(msg); } catch (x) { console.error(x); } }); }
  /** No internet (live mode): Church & Trellis shows the copy kept on this device and is view-only – nothing can be changed,
   *  so nobody's change waits on a phone and later overwrites someone else's. The demo keeps working as normal. */
  var OFFLINE_MSG = 'You’re offline – Church & Trellis is view-only until you’re back online.', toldOffline = 0;
  function offline() { return LIVE && typeof navigator !== 'undefined' && navigator.onLine === false; }
  /** Saving isn't possible now (viewing as another role, or offline): says why, at most every few seconds for offline. */
  function blocked() {
    if (previewing()) return true;
    if (!offline()) return false;
    if (Date.now() - toldOffline > 4000) { toldOffline = Date.now(); tell(OFFLINE_MSG); }
    return true;
  }

  var cfg = (typeof window !== 'undefined' && window.CHURCH_HUB_FIREBASE) || {};
  var LIVE = !!(cfg.apiKey && cfg.projectId) && !/[?&]demo(=|&|$)/.test(location.search);

  function uid(prefix) { return (prefix || 'x') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function now() { return new Date().toISOString().slice(0, 16).replace('T', ' '); }
  function copy(x) { return x === undefined ? undefined : JSON.parse(JSON.stringify(x)); }
  function canon(x) {                    // JSON with sorted keys, so { a, b } equals { b, a }
    if (Array.isArray(x)) return '[' + x.map(canon).join(',') + ']';
    if (x && typeof x === 'object') return '{' + Object.keys(x).sort().filter(function (k) { return x[k] !== undefined; }).map(function (k) { return JSON.stringify(k) + ':' + canon(x[k]); }).join(',') + '}';
    return JSON.stringify(x === undefined ? null : x);
  }
  function same(a, b) { return canon(a) === canon(b); }
  function blank() { var d = { version: 1, settings: null, brochures: {}, leave: null }; COLLECTIONS.forEach(function (c) { d[c] = []; }); return d; }
  var db = LIVE ? blank() : null;

  /* ================= shared interface ================= */
  function save() { if (!LIVE) { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* private window: keep in memory */ } } }

  function load(sampleFactory) {
    try { db = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { db = null; }
    if (!db || !db.version) { db = sampleFactory(); save(); }
    COLLECTIONS.forEach(function (c) { if (!db[c]) db[c] = []; });
    db.brochures = db.brochures || (db.settings && db.settings.brochures) || {};
    if (db.settings) delete db.settings.brochures;
    snapLeave(); rev++;
    save(); rememberAll();
    return db;
  }
  function reset(sampleFactory) { if (LIVE) return; db = sampleFactory(); COLLECTIONS.forEach(function (c) { if (!db[c]) db[c] = []; }); snapLeave(); rememberAll(); save(); changed(); }
  function snapLeave() { leaveSnap = {}; ((db && db.leave && db.leave.requests) || []).forEach(function (r) { if (!r.synthetic) leaveSnap[r.id] = JSON.stringify(r); }); }

  function all(c) { return (db && db[c]) || []; }
  /** Care groups and life groups (Bible studies, midweek groups) are kept together in careGroups – a life group has
   *  type 'life' – but handed out as two lists, so each page sees only its own kind; their cards likewise (careShare / lifeShare). */
  var KIND = { careGroups: ['careGroups', false], lifeGroups: ['careGroups', true], careShare: ['careShare', false], lifeShare: ['careShare', true] };
  function isLife(g) { return !!g && g.type === 'life'; }
  function lifeIds() { var m = {}; all('careGroups').forEach(function (g) { if (isLife(g)) m[g.id] = 1; }); return m; }
  function real(c) { return KIND[c] ? KIND[c][0] : c; }
  function archiveWho() {
    var ids = user ? [user.id] : [];
    if (LIVE && Live && Live.household) Live.household().forEach(function (h) { if (h.personId && ids.indexOf(h.personId) < 0) ids.push(h.personId); });
    var bodies = all('leaderBodies').filter(function (b) { return (b.memberIds || []).some(function (pid) { return ids.indexOf(pid) >= 0; }); });
    return { admin: isAdmin(), council: !previewRole && bodies.some(function (b) { return /council/i.test(b.name || ''); }),
      pastor: !previewRole && !!user && user.appRole === 'pastor', senior: !previewRole && !!user && user.appRole === 'pastor' && !!db.settings && db.settings.seniorPastorId === user.id,
      ids: ids, bodies: bodies.map(function (b) { return b.id; }) };
  }
  function archiveSees(record) {
    return !previewRole && !!record && typeof Archive !== 'undefined' && Archive.sees(record, archiveWho());
  }
  function archiveCanManage() {
    var who = archiveWho();
    return !!(who.admin || who.council);
  }
  function list(c) {
    if (c === 'archive') return all(c).filter(archiveSees);
    var k = KIND[c]; if (!k) return all(c);
    if (k[0] === 'careGroups') return all('careGroups').filter(function (g) { return isLife(g) === k[1]; });
    var life = lifeIds(); return all('careShare').filter(function (x) { return !!life[x.groupId] === k[1]; });
  }
  /** One record by id. Pages ask for thousands of these (a household, a position, a person), so each collection keeps a
   *  look-up table, made again when the collection's list is replaced or grows; a hit is checked against the list itself. */
  var byIdCache = {};
  function get(c, id) {
    if (c === 'archive') return all(c).filter(function (r) { return r.id === id && archiveSees(r); })[0] || null;
    if (KIND[c]) return list(c).filter(function (x) { return x.id === id; })[0] || null;   // care / life groups: small lists, split by kind
    var arr = all(c), ix = byIdCache[c];
    if (!ix || ix.arr !== arr || ix.len !== arr.length) {
      ix = byIdCache[c] = { arr: arr, len: arr.length, at: Object.create(null) };
      for (var i = 0; i < arr.length; i++) if (arr[i] && !(arr[i].id in ix.at)) ix.at[arr[i].id] = i;
    }
    var k = ix.at[id], x = k === undefined ? null : arr[k];
    if (x && x.id === id) return x;
    if (k === undefined && ix.len === arr.length) return null;
    delete byIdCache[c]; return list(c).filter(function (y) { return y.id === id; })[0] || null;   // the list changed in place: look the slow way, table made afresh next time
  }
  function find(c, fn) { return list(c).filter(fn); }
  function put(c, obj, auditText) {
    if (blocked()) return obj;
    if (c === 'archive' && !archiveCanManage()) { tell('Only Administrators and Council members can manage Archive records.'); return obj; }
    if (!obj.id) obj.id = uid(c.slice(0, 2));
    if (c === 'lifeGroups') obj.type = 'life';
    c = real(c);
    var arr = all(c), i = arr.findIndex(function (x) { return x.id === obj.id; }), prev = i >= 0 ? copy(arr[i]) : null;
    var was = keepsHistory(c) ? lastSaved(c, obj.id, prev) : null;   // before Live.put, which changes what "the database holds"
    obj.updatedAt = now();
    if (i >= 0) arr[i] = obj; else { obj.createdAt = obj.createdAt || now(); arr.push(obj); }
    if (LIVE) Live.put(c, obj, prev);
    if (auditText) audit(auditText, c + '/' + obj.id);
    if (keepsHistory(c)) { versioned(c, was, obj); remember(c, obj); }
    save(); changed();
    return obj;
  }
  function remove(c, id, auditText) {
    if (blocked()) return;
    if (c === 'archive' && !archiveCanManage()) { tell('Only Administrators and Council members can manage Archive records.'); return; }
    var prev = get(c, id); c = real(c);
    var was = prev && keepsHistory(c) ? lastSaved(c, id, prev) : null;
    db[c] = all(c).filter(function (x) { return x.id !== id; });
    if (was) { versioned(c, was, null); delete shadow[c + '/' + id]; }
    if (LIVE && prev) Live.remove(c, prev);
    if (c === 'archive') delete demoFiles[id];
    if (auditText) audit(auditText, c + '/' + id);
    save(); changed();
  }
  /** Delete a person's restricted information (medical and pastoral notes) – used for POPIA deletion requests.
   *  Works even for an Administrator, who cannot read these notes. */
  function purge(personId) {
    if (blocked()) return;
    db.notes = list('notes').filter(function (n) { return n.personId !== personId; });
    db.officeNotes = list('officeNotes').filter(function (n) { return n.personId !== personId; });
    if (db.idNumbers) db.idNumbers = db.idNumbers.filter(function (x) { return x.id !== personId; });
    var p = get('people', personId); if (p) delete p.medical;
    if (db.history) db.history = db.history.filter(function (e) { return !(e.c === 'people' && e.rid === personId); });   // their earlier versions too
    if (LIVE) Live.purge(personId);
    save();
  }
  /* ---------- Version history and Undo (rules: js/history.js; screens: js/history-ui.js; POPIA "Version history") ----------
   * Every put / remove of a record in History.COVER, made on this device, becomes a version: kept in `history` (live: history/{id},
   * written only by people the rules let write it, quietly; demo: db.history) and passed to Store.onVersion listeners (the Undo bar).
   * Changes that arrive from other devices are not versions here – their own device wrote them. Nothing while viewing as another
   * role or offline (put/remove stop first). "Before" is what was last saved, not the screen's copy: screens often change a record in place. */
  var versionListeners = [], lastVersion = {}, shadow = {}, restoring = false;
  function keepsHistory(c) { return typeof History !== 'undefined' && History.covered(c); }
  /** The demo: each covered record as last saved (a string, so changing the record in place doesn't change this). */
  function remember(c, rec) { if (!LIVE && rec && rec.id) shadow[c + '/' + rec.id] = JSON.stringify(rec); }
  function rememberAll() {
    shadow = {}; lastVersion = {};
    if (LIVE || typeof History === 'undefined' || !db) return;
    Object.keys(History.COVER).forEach(function (c) { all(c).forEach(function (r) { remember(c, r); }); });
  }
  function lastSaved(c, id, prev) {
    if (LIVE) return Live.saved(c, id) || prev;
    var s = shadow[c + '/' + id]; return s ? JSON.parse(s) : prev;
  }
  function versioned(c, before, after) {
    if (previewRole || !user) return;
    var e = History.entry(c, before, after, { id: user.id, name: ((user.preferredName || user.firstName || '') + ' ' + (user.lastName || '')).trim() }, now(), uid('hv'));
    if (!e) return;
    if (restoring && e.kind === 'edit') e.kind = 'restore';
    var k = c + '/' + e.rid, kept = (e.kind === 'edit' && History.merge(lastVersion[k], e)) || e;   // saving as you type: one version
    lastVersion[k] = kept;
    if (LIVE) Live.historySave(kept);
    else {
      var h = db.history = db.history || [], i = h.findIndex(function (x) { return x.id === kept.id; });
      if (i >= 0) h[i] = kept; else h.push(kept);
      var gone = History.prune(h, now()); if (gone.length) db.history = h.filter(function (x) { return gone.indexOf(x.id) < 0; });
    }
    versionListeners.forEach(function (fn) { try { fn(kept); } catch (x) { console.error(x); } });
  }
  /** Who may see earlier versions: Administrators and Pastors (as firestore.rules). */
  function historyCan() { return !!user && (isAdmin() || isPastor()); }
  function versions(c, id) {
    if (!historyCan()) return Promise.resolve([]);
    if (!LIVE) return Promise.resolve(History.forRecord(db.history || [], c, id));
    if (offline()) return Promise.reject(new Error('offline'));
    return Live.historyFor(c, id);
  }
  /** Changes made inside fn are marked "Put back" in the history (Undo, Version history). */
  function asRestore(fn) { restoring = true; try { return fn(); } finally { restoring = false; } }
  /** Clearing out versions older than 90 days: once a day, by an Administrator's app (live), quietly. */
  function historyTidy() {
    if (!LIVE || !isAdmin() || previewRole || offline() || typeof History === 'undefined') return Promise.resolve(0);
    var day = now().slice(0, 10), k = 'church_hub_pref_historyTidy';
    try { if (localStorage.getItem(k) === day) return Promise.resolve(0); localStorage.setItem(k, day); } catch (e) { /* private window */ }
    return Live.historyTidy(History.cutoff(now()));
  }

  /** POPIA accountability: who did what to whose information, and when. */
  function audit(action, target) {
    if (previewRole) action = '(viewing as ' + previewRole + ') ' + action;
    var entry = { id: uid('au'), at: now(), who: user ? ((user.preferredName || user.firstName) + ' ' + user.lastName) : 'System', action: action, target: target || '' };
    db.audit.unshift(entry);
    if (db.audit.length > 5000) db.audit.length = 5000;
    if (LIVE) Live.audit(entry);
    save();
  }
  function settings() { return db.settings; }
  function setSettings(patch, auditText) {
    if (blocked()) return;
    if (Object.prototype.hasOwnProperty.call(patch || {}, 'brochures')) {
      tell('Brochure content must be saved through the Administrator-only brochure editor.');
      return false;
    }
    Object.assign(db.settings, patch);
    if (LIVE) Live.write('settings/church', db.settings);
    if (auditText) audit(auditText, 'settings');
    save(); changed();
  }
  function isAdmin() {
    if (previewRole) return false;
    if (LIVE) return !!(Live.session() && Live.session().role === 'admin');
    return !!(user && user.appRole === 'admin');
  }
  function isPastor() {
    if (previewRole) return false;
    if (LIVE) return !!(Live.session() && Live.session().role === 'pastor');
    return !!(user && user.appRole === 'pastor');
  }
  /** The Senior Pastor (Rector), signed in as themselves (not "View as"). */
  function isRector() {
    if (previewRole || !isPastor()) return false;
    var id = LIVE ? (Live.session() || {}).personId : (user && user.id), st = db.settings || {};
    return !!id && !!st.seniorPastorId && st.seniorPastorId === id;
  }
  /** The church's brochure wording: Administrators change it; the Rector may read it (to print the brochures). */
  function brochures() { return isAdmin() || isRector() ? db.brochures || {} : null; }
  function setBrochures(value, auditText) {
    if (blocked()) return false;
    if (!isAdmin()) { tell('Only Administrators can change brochure content.'); return false; }
    db.brochures = copy(value) || {};
    if (LIVE) Live.write('brochures/church', db.brochures);
    if (auditText) audit(auditText, 'brochures/church');
    save(); changed();
    return true;
  }
  /** Save the library's librarians and review date, so the Senior Pastor can manage only these settings. */
  function setLibrarians(ids, auditText) {
    if (blocked()) return;
    db.settings.librarianIds = ids.slice();
    db.settings.librarianReviewedAt = new Date().toISOString();
    if (LIVE) Live.patch('settings/church', { librarianIds: ids.slice(), librarianReviewedAt: db.settings.librarianReviewedAt });
    if (auditText) audit(auditText, 'settings');
    save(); changed();
  }
  /** Settings → Attendees: what people on Basic access who aren't Church Partners may do (Administrators and the Rector). */
  function setAttendeeCan(list, auditText) {
    if (blocked()) return;
    db.settings.attendeeCan = list.slice();
    if (LIVE) Live.patch('settings/church', { attendeeCan: list.slice() });
    if (auditText) audit(auditText, 'settings');
    save(); changed();
  }
  /** The ministers (Pastors) everyone may write to: [{ id, name }]. Live, kept in Settings by Administrators (settings.ministers),
   *  as other people can't read who is a Pastor; in the demo, from the people. */
  function ministers() {
    if (LIVE) return ((db.settings || {}).ministers || []).slice();
    return pastorsNow();
  }
  function pastorsNow() {
    return all('people').filter(function (p) { return p.appRole === 'pastor' && p.active !== false && !p.binnedAt && !p.mergedInto; })
      .map(function (p) { return { id: p.id, name: ((p.preferredName || p.firstName || '') + ' ' + (p.lastName || '')).trim() }; })
      .sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
  }
  /** Who hears when someone can't make a roster turn (js/messages.js, kind 'roster'): Administrators, Roster coordinators and
   *  the people chosen under Settings -> Church Services (settings.rosterExtra, e.g. the church secretary). Live, kept in
   *  Settings by Administrators (settings.rosterTeam), as other people can't read who has which access; in the demo, from the people. */
  function rosterTeamNow(st) {
    var out = all('people').filter(function (p) { return (p.appRole === 'admin' || p.appRole === 'rosters') && p.active !== false && !p.binnedAt && !p.mergedInto; }).map(function (p) { return p.id; });
    ((st || {}).rosterExtra || []).forEach(function (id) { var p = all('people').filter(function (x) { return x.id === id; })[0]; if (p && p.active !== false && !p.binnedAt && !p.mergedInto && out.indexOf(id) < 0) out.push(id); });
    return out.sort();
  }
  function rosterTeam() {
    if (LIVE) return ((db.settings || {}).rosterTeam || []).slice();
    return rosterTeamNow(db.settings);
  }
  /** Settings -> Church Services: the extra people who hear about roster replies (Administrators and Pastors with "settings"). */
  function setRosterExtra(ids, auditText) {
    if (blocked()) return;
    db.settings.rosterExtra = ids.slice();
    db.settings.rosterTeam = rosterTeamNow(db.settings);
    if (LIVE) Live.patch('settings/church', { rosterExtra: ids.slice(), rosterTeam: db.settings.rosterTeam.slice() });
    if (auditText) audit(auditText, 'settings');
    save(); changed();
  }
  function localUpsert(collection, record) {
    var records = all(collection), index = records.findIndex(function (x) { return x.id === record.id; });
    if (index >= 0) records[index] = record; else records.push(record);
    save(); changed();
  }
  /** Reserve one available copy for the signed-in borrower; live mode commits the loan and count together. */
  function requestLibraryLoan(bookId, loan) {
    if (blocked()) return Promise.reject(new Error('view only'));
    var book = get('books', bookId);
    if (!LIVE && (!book || book.removed || book.repairing || (+book.out || 0) >= Math.max(1, +book.copies || 1)))
      return Promise.reject(new Error('Every copy is on loan.'));
    var nextLoan = copy(loan), nextBook = copy(book), id = uid('ln');
    nextLoan.id = id; nextLoan.status = 'pending'; nextLoan.requestedAt = new Date().toISOString();
    if (LIVE) return Live.requestLibraryLoan(bookId, id, nextLoan).then(function (result) {
      localUpsert('loans', result.loan); localUpsert('books', result.book); return result.loan;
    });
    nextBook.out = (+book.out || 0) + 1;
    put('loans', nextLoan); put('books', nextBook);
    return Promise.resolve(nextLoan);
  }
  /** Librarians approve a pending request or reject it and return its reserved copy. */
  function verifyLibraryLoan(id, approved, today, verifiedBy) {
    if (blocked()) return Promise.reject(new Error('view only'));
    var loan = get('loans', id);
    if (!loan || (!LIVE && (loan.status !== 'pending' || loan.back))) return Promise.reject(new Error('This checkout is no longer waiting for verification.'));
    var nextLoan = copy(loan), book = get('books', loan.bookId), nextBook = book && copy(book);
    nextLoan.status = approved ? 'approved' : 'rejected';
    nextLoan.verifiedAt = new Date().toISOString(); nextLoan.verifiedBy = verifiedBy || '';
    if (!approved) { nextLoan.back = today; nextLoan.mobile = ''; if (nextBook) nextBook.out = Math.max(0, (+nextBook.out || 0) - 1); }
    if (LIVE) return Live.verifyLibraryLoan(id, approved, today, verifiedBy).then(function (result) {
      localUpsert('loans', result.loan); if (result.book) localUpsert('books', result.book); return result.loan;
    });
    put('loans', nextLoan); if (nextBook) put('books', nextBook);
    return Promise.resolve(nextLoan);
  }
  function leave() { return db.leave; }
  /** Save leave. Tells onLeaveChange listeners which requests changed (e.g. to update Elvanto), unless opts.quiet (imports). */
  function saveLeave(auditText, opts) {
    if (blocked()) return;
    var changes = [];
    ((db.leave && db.leave.requests) || []).forEach(function (r) {
      if (r.synthetic) return;
      var j = JSON.stringify(r), before = leaveSnap[r.id];
      if (j === before) return;
      changes.push({ prev: before ? JSON.parse(before) : null, now: copy(r) });
      leaveSnap[r.id] = j;
    });
    if (LIVE) Live.saveLeave();
    if (auditText) audit(auditText, 'leave');
    if (changes.length && !(opts && opts.quiet)) leaveHooks.forEach(function (fn) { try { fn(changes); } catch (e) { console.error(e); } });
    save(); changed();
  }
  function setUser(u) { user = u; }
  function onChange(fn) { listeners.push(fn); }
  function changed() { rev++; listeners.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } }); }
  /** A number that goes up whenever anything changes (here or, live, from someone else), so screens can keep work they
   *  worked out (couples, consents by person, duplicates) until it does – see memo() in js/people/core.js. */
  var rev = 0;
  function version() { return rev + ':' + list('people').length + ':' + list('consents').length + ':' + list('families').length; }
  function exportAll() {
    var out = copy(db);
    out.archive = (out.archive || []).filter(archiveSees);
    return out;
  }
  /** Role given to people added from now on: in the demo everyone can sign in; live, an Administrator gives access. */
  function defaultRole() { return LIVE ? 'none' : 'member'; }

  /* ================= live mode: Firebase ================= */
  var Live = (function () {
    var VERSION = '13.1.0';
    var SDK = ['app', 'auth', 'firestore'].map(function (m) { return 'https://www.gstatic.com/firebasejs/' + VERSION + '/firebase-' + m + '-compat.js'; });
    var EMAIL_KEY = 'church_hub_signin_email', WHO_KEY = 'church_hub_who:', OWNER_KEY = 'church_hub_offline_owner';
    // Fields that live in people/{id}; everything else (except medical) goes to details/{id}.
    var CARD = ['firstName', 'lastName', 'preferredName', 'familyId', 'householdIds', 'familyRole', 'category', 'email', 'mobile', 'active', 'appRole',
      'source', 'createdAt', 'updatedAt', 'archivedAt', 'deletedAt', 'photo', 'reviewLangs', 'appFirstSeen', 'noCelebrate'];
    var DIRECTORY = 'Church directory';
    var fb = null, auth = null, fs = null, session = null, onState = null, unsubs = [], raw = {}, pending = 0, ready = false, lastWrite = 0;
    /** For About → Speed check (Administrators): how long loading took and how much the database sent and was sent. */
    var stats = { marks: {}, start: 0, loaded: 0, snaps: 0, rebuilds: 0, rebuildMs: 0, slowestRebuild: 0, writes: 0, sizes: {} };
    var savedLeave = { requests: {}, adjustments: {}, config: '' }, remoteTimer = null;
    var MAX_SHARED = 4;   // people who may share one sign-in (one email address); the rules allow the first and 3 others
    var extraSubs = {};   // the Archive and a librarian's loans: asked for once the settings are known (extras())
    var local = {};   // path → what we last wrote (null = deleted), until the server confirms it

    function err(e, what) {
      console.error(what, e);
      var msg = e && e.code === 'permission-denied' ? 'You don’t have permission to ' + what + '.' :
        e && e.code === 'unavailable' ? 'No connection – ' + what + ' will be tried again when you’re back online.' : 'Couldn’t ' + what + '. Please try again.';
      errorListeners.forEach(function (fn) { try { fn(msg); } catch (x) { console.error(x); } });
    }
    function clean(o) { var c = copy(o); if (c) delete c.id; return c; }
    function doc(path) { return fs.doc(path); }
    function write(path, data) { lastWrite = Date.now(); local[path] = clean(data); return doc(path).set(clean(data)).catch(function (e) { delete local[path]; err(e, 'save this'); }); }
    /** Change only some fields of a document (for someone allowed to change only those, e.g. the Senior Pastor choosing librarians). */

    function patch(path, data) { lastWrite = Date.now(); return doc(path).update(clean(data)).catch(function (e) { err(e, 'save this'); }); }
    function syncCouncilPreviewMembers(ids) {
      if (!session || previewRole || !is('admin', 'pastor')) return Promise.resolve();
      var councilIds = {};
      (db.leaderBodies || []).forEach(function (b) {
        if (/council/i.test(b.name || '')) (b.memberIds || []).forEach(function (pid) { councilIds[pid] = councilIds[pid] || b.id; });
      });
      function sync(pid) {
        if (!pid) return Promise.resolve();
        // The rules check the person really is in that Council (bodyId)
        return councilIds[pid] ? write('archivePreviewMembers/' + pid, { personId: pid, bodyId: councilIds[pid] }) :
          (local['archivePreviewMembers/' + pid] === null ? Promise.resolve() : del('archivePreviewMembers/' + pid));
      }
      if (ids) {
        var unique = ids.filter(function (pid, i) { return pid && ids.indexOf(pid) === i; });
        return Promise.all(unique.map(sync));
      }
      if (!is('admin')) return Promise.resolve();
      return fs.collection('archivePreviewMembers').get().then(function (snap) {
        var existing = {};
        snap.docs.forEach(function (d) { existing[d.id] = (d.data() || {}).bodyId || true; });
        // Missing entries, and older ones without the Council's id, are (re)written
        var wanted = Object.keys(councilIds), jobs = wanted.filter(function (pid) { return existing[pid] !== councilIds[pid]; }).map(sync);
        Object.keys(existing).forEach(function (pid) { if (!councilIds[pid]) jobs.push(del('archivePreviewMembers/' + pid)); });
        return Promise.all(jobs);
      }).catch(function (e) { err(e, 'update Council preview access'); });
    }
    function clearLegacyBrochure() {
      var patch = {}; patch.brochures = fb.firestore.FieldValue.delete();
      return doc('settings/church').update(patch).catch(function (e) { err(e, 'move the brochure wording to its private settings'); });
    }
    function migrateBrochure(value) {
      return doc('brochures/church').set(clean(value)).then(clearLegacyBrochure, function (e) { err(e, 'move the brochure wording to its private settings'); });
    }
    function del(path) { lastWrite = Date.now(); local[path] = null; return doc(path).delete().catch(function (e) { delete local[path]; err(e, 'delete this'); }); }
    /** What the database holds for one document, as far as we know (our own unconfirmed writes count). */
    function known(path) {
      if (path in local) return local[path];
      var s = path.split('/'), from = { people: ['people'], details: ['details', 'detailsMe'], medical: ['medical'], directory: ['directory'], names: ['names'] }[s[0]] || [s[0]];
      var v;   // later collections win, as in merged(), but without copying every record just to read one
      from.forEach(function (k) { var m = raw[k]; if (m && m[s[1]] !== undefined) v = m[s[1]]; });
      return v === undefined ? null : v;
    }
    function role() { return session ? previewRole || session.role : ''; }
    function is() { return Array.prototype.indexOf.call(arguments, role()) >= 0; }
    /** What Pastors can do (from their access-list entry, as the rules see it); Administrators may do everything. */
    function may(x) { var r = role(); return r === 'admin' || (r === 'pastor' && !previewRole && (session.can || []).indexOf(x) >= 0); }
    /** The stand-in leave approver, between their dates (on their access-list entry, as the rules see it). */
    function standingIn() { var t = Date.now(); return !previewRole && session.standInFrom <= t && t <= session.standInTo; }
    /** Midnight at the start of a date, and the last moment of a date, in this computer's time (milliseconds). */
    function dayMs(ds, end) { var p = String(ds).split('-'); return new Date(+p[0], +p[1] - 1, +p[2], end ? 23 : 0, end ? 59 : 0, end ? 59 : 0).getTime(); }
    /** A stand-in approver's dates go on their access-list entry, for the rules; empty dates take them off. */
    function setStandIn(pid, from, to) {
      var p = get('people', pid), email = p && (p.email || '').trim().toLowerCase(); if (!email) return;
      var upd = from && to ? { standInFrom: dayMs(from), standInTo: dayMs(to, true) } : { standInFrom: 0, standInTo: 0 };
      var path = 'roles/' + email; if (local[path]) local[path] = Object.assign({}, local[path], upd);
      return doc(path).update(upd).catch(function (e) { err(e, 'set the stand-in'); });
    }

    /* ---------- loading the Firebase library ---------- */
    function loadSdk(done) {
      if (window.firebase && window.firebase.firestore) return done();
      var i = 0;
      (function next() {
        if (i >= SDK.length) return done();
        var s = document.createElement('script'); s.src = SDK[i++]; s.onload = next;
        s.onerror = function () { done(new Error('Could not load Firebase')); };
        document.head.appendChild(s);
      })();
    }

    /* ---------- Ask in your own words, with AI: Gemini through the church's Firebase project (docs/AI-SEARCH-SETUP.md) ----------
     * Firebase AI Logic only answers apps that prove they are Church & Trellis (App Check, with a reCAPTCHA key in firebase-config.js).
     * The App Check library is loaded the first time someone asks, not before. js/ask-ai.js decides what is sent. */
    var appCheckOn = null;
    function appCheck() {
      if (appCheckOn) return appCheckOn;
      appCheckOn = new Promise(function (ok, no) {
        var key = cfg.appCheckKey; if (!key || !fb) return no(new Error('AI search isn’t set up'));
        var go = function () {
          try {
            var P = fb.appCheck, provider = cfg.appCheckEnterprise ? new P.ReCaptchaEnterpriseProvider(key) : new P.ReCaptchaV3Provider(key);
            var ac = fb.appCheck(); ac.activate(provider, true); ok(ac);
          } catch (e) { no(e); }
        };
        if (fb.appCheck) return go();
        var s = document.createElement('script'); s.src = 'https://www.gstatic.com/firebasejs/' + VERSION + '/firebase-app-check-compat.js';
        s.onload = go; s.onerror = function () { no(new Error('Could not load App Check')); };
        document.head.appendChild(s);
      });
      appCheckOn.catch(function () { appCheckOn = null; });
      return appCheckOn;
    }
    /** Send a request to Gemini's generateContent; resolves with its JSON reply (15 seconds at most, or ms – a photo takes longer). */
    function aiAsk(body, model, ms) {
      if (!session || offlineNow()) return Promise.reject(new Error('offline'));
      var me = auth && auth.currentUser;
      return Promise.all([appCheck().then(function (ac) { return ac.getToken(false); }), me ? me.getIdToken() : Promise.resolve('')]).then(function (t) {
        if (!t[0] || !t[0].token) throw new Error('No App Check token');
        var h = { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.apiKey, 'X-Firebase-AppCheck': t[0].token, 'x-goog-api-client': 'gl-js/' + VERSION + ' fire/' + VERSION };
        if (t[1]) h.Authorization = 'Firebase ' + t[1];
        var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null, timer = ctl ? setTimeout(function () { ctl.abort(); }, ms || 15000) : null;
        var url = 'https://firebasevertexai.googleapis.com/v1beta/projects/' + encodeURIComponent(cfg.projectId) + '/models/' + encodeURIComponent(model) + ':generateContent';
        return fetch(url, { method: 'POST', headers: h, body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined }).then(function (r) {
          clearTimeout(timer);
          if (!r.ok) return r.text().then(function (x) { throw new Error('Gemini ' + r.status + ': ' + String(x).slice(0, 300)); });
          return r.json();
        }, function (e) { clearTimeout(timer); throw e; });
      });
    }

    /* ---------- the copy kept on this device, for when there is no internet ---------- */
    /** Firestore keeps what this person may see on the device (IndexedDB), so Church & Trellis opens and shows it offline.
     *  It is wiped when they sign out, and before someone else signs in on the same device (docs/POPIA.md, Data on devices). */
    function openDb() {
      fs = fb.firestore();
      if (fs.enablePersistence) fs.enablePersistence({ synchronizeTabs: true }).then(function () { stats.marks.copyOpen = Math.round(performance.now()); }, function (e) { console.warn('No offline copy on this device', e && e.code); });
    }
    function wipe() {
      try { localStorage.removeItem(OWNER_KEY); } catch (x) {}
      if (!fs || !fs.clearPersistence) return Promise.resolve();
      var old = fs;
      // Another Church & Trellis tab still open keeps the copy in use: it is wiped at the next sign-in instead (OWNER_KEY)
      return old.terminate().then(function () { return old.clearPersistence(); }).catch(function (e) { console.warn('Couldn’t wipe the offline copy yet', e && e.code); })
        .then(function () { openDb(); });
    }
    /** The offline copy belongs to one sign-in: wipe it first if someone else's is still there. */
    function ownCopy(email) {
      var was = ''; try { was = localStorage.getItem(OWNER_KEY) || ''; } catch (x) {}
      return (was && was !== email ? wipe() : Promise.resolve()).then(function () { try { localStorage.setItem(OWNER_KEY, email); } catch (x) {} });
    }
    function offlineNow() { return typeof navigator !== 'undefined' && navigator.onLine === false; }

    /* ---------- sign-in ---------- */
    function boot(stateFn) {
      onState = stateFn;
      onState({ stage: 'loading', step: 'connecting' });
      loadSdk(function (e) {
        if (e) return onState({ stage: 'error', message: 'Church & Trellis couldn’t connect. Check your internet connection and refresh the page.' });
        stats.marks.sdk = Math.round(performance.now());
        fb = window.firebase;
        if (!fb.apps.length) fb.initializeApp(cfg);
        auth = fb.auth(); openDb();
        if (auth.isSignInWithEmailLink(location.href)) {
          var email = ''; try { email = localStorage.getItem(EMAIL_KEY) || ''; } catch (x) {}
          // Opened somewhere that doesn't remember the address (e.g. Gmail's own browser): ask for it.
          if (!email) { linkStage = 'needEmail'; onState({ stage: 'needEmail' }); } else finishEmailLink(email);
        }
        // "Not signed in yet" must not replace the "Confirm your email" question, or the screen of a link still being checked.
        auth.onAuthStateChanged(function (u) {
          authGen++;
          stop();
          if (u) startSession(u);
          else if (linkStage === 'needEmail') onState({ stage: 'needEmail' });
          else if (codeQuiet) codeQuiet = false;   // a sign-in code that didn't go ahead: its message stays on the screen
          else if (!linkStage) onState({ stage: 'signedOut' });
        });
      });
    }
    function google() {
      // In the Android app, Google's sign-in window can't open inside the app: Android's own account picker gives a
      // Google ID token instead (window.ChurchHubApp, see android/), which Firebase accepts for this project.
      if (inApp()) return appGoogle();
      var provider = new fb.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      return auth.signInWithPopup(provider).catch(function (e) {
        if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) return auth.signInWithRedirect(provider);
        if (e && e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') throw e;
      });
    }
    function inApp() { return typeof window !== 'undefined' && !!(window.ChurchHubApp && window.ChurchHubApp.googleSignIn); }
    function appGoogle() {
      var clientId = cfg.googleWebClientId || '';
      if (!clientId) return Promise.reject({ code: 'app/not-set-up', message: 'Sign in with Google isn’t set up in the app yet' });
      return new Promise(function (resolve, reject) {
        window.churchHubGoogle = function (idToken) {
          auth.signInWithCredential(fb.auth.GoogleAuthProvider.credential(idToken)).then(resolve, reject);
        };
        window.churchHubGoogleError = function (msg) { reject({ code: 'app/google', message: msg }); };
        window.churchHubGoogleCancel = function () { resolve(); };
        window.ChurchHubApp.googleSignIn(clientId);
      });
    }
    /** Is this a sign-in link from the email? (Used when someone pastes the link into the app.) */
    function isEmailLink(link) { try { return !!(auth && auth.isSignInWithEmailLink(link)); } catch (e) { return false; } }
    function emailLink(email) {
      return auth.sendSignInLinkToEmail(email, { url: location.origin + location.pathname, handleCodeInApp: true })
        .then(function () { try { localStorage.setItem(EMAIL_KEY, email); } catch (x) {} });
    }
    function pendingEmail() { try { return localStorage.getItem(EMAIL_KEY) || ''; } catch (x) { return ''; } }
    /** Counts every change of who is signed in. A look-up that was started for an earlier sign-in (a slow network, then the person signed out or
     *  switched account) must not open Church & Trellis when it finally answers: it checks its number first. */
    var authGen = 0;
    var linkStage = '';   // '' | 'needEmail' (waiting for them to type it) | 'checking' (sign-in link being checked)
    function finishEmailLink(email, link) {
      linkStage = 'checking';
      return auth.signInWithEmailLink(email, link || location.href).then(function () {
        linkStage = '';
        try { localStorage.removeItem(EMAIL_KEY); } catch (x) {}
        history.replaceState(null, '', location.pathname + location.hash);
      }).catch(function (e) {
        linkStage = '';
        history.replaceState(null, '', location.pathname + location.hash);
        onState({ stage: 'signedOut', message: e && e.code === 'auth/invalid-action-code' ? 'That sign-in link has expired or was already used. Ask for a new one.' : 'That sign-in link didn’t work. Please ask for a new one.' });
      });
    }
    function signOut() {
      authGen++;
      stop();
      // Let the last saves (e.g. the "Signed out" audit entry) reach the database first – but don't wait forever offline.
      var flushed = fs ? Promise.race([fs.waitForPendingWrites().catch(function () {}), new Promise(function (r) { setTimeout(r, 3000); })]) : Promise.resolve();
      // A shared sign-in: the next person signing in on this device chooses again
      try { if (session && session.household.length) localStorage.removeItem(WHO_KEY + session.email); } catch (x) {}
      return flushed.then(function () { session = null; db = blank(); return auth ? auth.signOut() : null; }).then(wipe);
    }

    /* ---------- session: who is this, and what may they see ---------- */
    function startSession(u) {
      if (u.isAnonymous || isPin(u)) return startCodeSession(u);   // a number-and-PIN sign-in (or a code being used)
      var email = (u.email || '').toLowerCase(), g = authGen;
      stats.marks.signedIn = Math.round(performance.now());
      onState({ stage: 'loading', email: email, step: 'checking' });
      if (!u.emailVerified) return onState({ stage: 'noAccess', email: email, reason: 'unverified' });
      // Offline: straight from the copy on this device (otherwise Firestore first waits to be sure there's no connection)
      var role = function () { return offlineNow() ? doc('roles/' + email).get({ source: 'cache' }).catch(function () { return doc('roles/' + email).get(); }) : doc('roles/' + email).get(); };
      ownCopy(email).then(function () { stats.marks.copyChecked = Math.round(performance.now()); return role(); }).then(function (snap) {
        stats.marks.accessKnown = Math.round(performance.now());
        if (g !== authGen) return;   // signed out or switched account while this was being looked up
        if (!snap.exists) {   // their access was taken away: the copy on this device goes too
          if (!(snap.metadata && snap.metadata.fromCache)) wipe();
          return onState({ stage: 'noAccess', email: email });
        }
        var r = snap.data();
        session = { email: email, role: r.role, personId: r.personId || '', langs: r.langs || [], can: r.can || [], standInFrom: r.standInFrom || 0, standInTo: r.standInTo || 0, household: [] };
        // One sign-in shared by several people (one email address): they choose who is using Church & Trellis (remembered on this device)
        if (session.personId && (r.also || []).length) {
          var ppl = r.people || {};
          session.household = [r.personId].concat(r.also).map(function (pid) {
            var x = ppl[pid] || {};
            return { personId: pid, name: x.name || (pid === r.personId ? r.name : '') || '', role: x.role || r.role, langs: x.langs || [], can: x.can || [] };
          });
          var chosen = ''; try { chosen = localStorage.getItem(WHO_KEY + email) || ''; } catch (x) {}
          var pick = session.household.filter(function (h) { return h.personId === chosen; })[0];
          if (!pick) return onState({ stage: 'choosePerson', email: email, people: session.household.slice() });
          return usePerson(pick);
        }
        if (!session.personId) {
          if (r.role !== 'admin') return onState({ stage: 'noAccess', email: email, reason: 'noPerson' });
          // An Administrator added by hand: set up the church only if nobody has yet, otherwise just their own record.
          return doc('settings/church').get().then(function (st) { if (g === authGen) onState({ stage: 'setup', email: email, needChurch: !st.exists }); });
        }
        subscribe();
      }).catch(function (e) {
        if (g !== authGen) return;
        onState(e && e.code === 'permission-denied' ? { stage: 'noAccess', email: email } : { stage: 'error', message: offlineNow() ?
          'You’re offline, and this device has no copy of Church & Trellis yet. Connect to the internet once, then it will open offline too.' :
          'Church & Trellis couldn’t load. Check your internet connection and refresh the page.' });
      });
    }

    /* ---------- members with no email: a sign-in code once, then their number and a PIN (firestore.rules: invites, roles,
     * pinLogins). The phone signs in anonymously to read the code, then the person chooses a PIN: the anonymous account gets
     * a made-up address (<number>-<v>@pin.church-hub.invalid) with the PIN as its password, and in one write records
     * roles/{that address} (Member access for the person on the code), pinLogins/{number} and the spent code. From then on they sign
     * in on any phone with their number and PIN. docs/ARCHITECTURE.md "Sign-in codes and PINs". */
    var PIN_DOMAIN = '@pin.church-hub.invalid', PIN_RE = /^c?[0-9]+-[0-9]+@pin\.church-hub\.invalid$/;
    var claim = null;   // the code being used: { code, invite } while the person says who they are and chooses a PIN
    function fail(c) { var e = new Error(c); e.code = c; return e; }
    function cleanCode(s) { return String(s || '').toUpperCase().replace(/[^0-9A-Z]/g, ''); }
    function pinAddress(login, v) { return login + '-' + v + PIN_DOMAIN; }
    /** Is this account a number-and-PIN sign-in? */
    function isPin(u) { return !!(u && u.email && PIN_RE.test(String(u.email).toLowerCase())); }
    /** The number someone signs in with: a cellphone number in international form (digits only), or "c" and a 6-digit
     *  church number. dial = the church's country calling code, for numbers typed the local way (082…). '' = not a number. */
    function pinLogin(raw, dial) {
      var t = String(raw || '').trim(), d = t.replace(/\D/g, ''), code = String(dial || '').replace(/\D/g, '');
      if (/^c/i.test(t) || (/^[1-9][0-9]{5}$/.test(d) && !/^\+/.test(t))) return /^[1-9][0-9]{5}$/.test(d) ? 'c' + d : '';
      if (!/^\+/.test(t)) { if (/^00/.test(d)) d = d.slice(2); else if (/^0/.test(d)) { if (!code) return ''; d = code + d.slice(1); } }
      return d.length >= 8 && d.length <= 15 ? d : '';
    }
    /** Type or open a code: sign in anonymously, fetch the invite → resolves { name, mobile } to ask "is that you?", or rejects
     *  { code: 'codes/unknown' | 'codes/used' | 'codes/expired' | 'codes/off' | 'codes/busy' | … }. */
    function claimCode(raw) {
      var code = cleanCode(raw);
      if (code.length !== 8) return Promise.reject(fail('codes/unknown'));
      claiming = true;
      var signed = auth.currentUser && auth.currentUser.isAnonymous ? Promise.resolve() : (auth.currentUser ? auth.signOut() : Promise.resolve()).then(function () { return auth.signInAnonymously(); });
      return signed.then(function () { return doc('invites/' + code).get(); }, function (e) {
        claiming = false;
        throw fail(e && (e.code === 'auth/admin-restricted-operation' || e.code === 'auth/operation-not-allowed') ? 'codes/off' : e && e.code === 'auth/too-many-requests' ? 'codes/busy' : (e && e.code) || 'codes/error');
      }).then(function (snap) {
        if (!snap.exists) throw fail('codes/unknown');
        var inv = snap.data();
        if (inv.usedBy) throw fail('codes/used');
        if (!(inv.expires > Date.now())) throw fail('codes/expired');
        claim = { code: code, invite: inv };
        return { name: inv.name || '', mobile: inv.mobile || '' };
      }).catch(function (e) {
        var c = e && e.code && /^codes\//.test(e.code) ? e.code : e && e.code === 'permission-denied' ? 'codes/off' : 'codes/error';
        return cancelCode().then(function () { throw fail(c); });
      });
    }
    /** A church number for someone with no number of their own: 6 digits, not used by anyone yet. */
    function newChurchNumber(tries) {
      var a = new Uint32Array(1); (window.crypto || window.msCrypto).getRandomValues(a);
      var login = 'c' + (100000 + a[0] % 900000);
      return doc('pinLogins/' + login).get().then(function (s) { return s.exists && (tries || 0) < 8 ? newChurchNumber((tries || 0) + 1) : login; });
    }
    /** "Yes, that's me", then their number (raw; '' = give them a church number) and a PIN: the account gets its sign-in
     *  address and, in one write, its access entry (roles/{address}), pinLogins/{number} and the spent code. Resolves { login } – the session
     *  starts with begin(). Rejects 'pin/number' | 'pin/taken' | 'pin/off' | 'codes/used' | 'codes/error'. */
    function confirmCode(rawNumber, pin) {
      if (!claim || !auth.currentUser) return Promise.reject(fail('codes/error'));
      var inv = claim.invite, user = auth.currentUser, uid = user.uid, login, v = 1, had = null;
      var pick = rawNumber ? Promise.resolve(pinLogin(rawNumber, inv.dial)) : newChurchNumber();
      return pick.then(function (l) {
        login = l; if (!login) throw fail('pin/number');
        return doc('pinLogins/' + login).get();
      }).then(function (s) {
        had = s.exists ? s.data() : null; if (had) v = (+had.v || 0) + 1;
        var tries = 0;
        // Link the PIN to this account (the same account id). If someone took that address first, the next version is used.
        var link = function () {
          return user.linkWithCredential(fb.auth.EmailAuthProvider.credential(pinAddress(login, v), pin)).catch(function (e) {
            if (e && e.code === 'auth/email-already-in-use' && ++tries < 5) { v++; return link(); }
            throw fail(e && (e.code === 'auth/operation-not-allowed' || e.code === 'auth/admin-restricted-operation') ? 'pin/off' : e && e.code === 'auth/email-already-in-use' ? 'pin/taken' : (e && e.code) || 'codes/error');
          });
        };
        return link();
      }).then(function () { return user.getIdToken(true); }).then(function () {
        var b = fs.batch();
        b.set(doc('roles/' + pinAddress(login, v)), { role: 'member', roles: ['member'], personId: inv.personId, also: [], people: {}, invite: claim.code, name: inv.name || '', linkedAt: now(), login: login, pinV: v, uid: uid });
        b.set(doc('pinLogins/' + login), { v: v, uid: uid });
        b.set(doc('invites/' + claim.code), Object.assign({}, inv, { usedBy: uid, usedAt: now() }));
        return b.commit().catch(function (e) { throw fail(e && e.code === 'permission-denied' ? (had ? 'pin/taken' : 'codes/used') : (e && e.code) || 'codes/error'); });
      }).then(function () {
        claim = null;
        return { login: login };
      }, function (e) {
        // Nothing was linked: an account that got the address but not the rest is removed (the address is free again), and
        // the phone signs in anonymously again so the person can try once more with the same code
        var u = auth.currentUser, drop = Promise.resolve();
        if (isPin(u)) { codeQuiet = true; drop = u.delete().then(function () { return auth.signInAnonymously(); }).catch(function () {}); }
        return drop.then(function () { throw e && /^(pin|codes)\//.test(e.code || '') ? e : fail('codes/error'); });
      });
    }
    /** After the PIN is chosen (and a church number shown): open Church & Trellis as that member. */
    function begin() { claiming = false; if (auth.currentUser) startSession(auth.currentUser); }
    /** "No, that isn't me" (or the code didn't work): nothing is linked, and the anonymous sign-in is dropped. */
    function cancelCode() {
      claim = null; claiming = false;
      if (!(auth && auth.currentUser && (auth.currentUser.isAnonymous || isPin(auth.currentUser)))) return Promise.resolve();
      codeQuiet = true;
      return auth.signOut().catch(function () {});
    }
    /** Sign in with a number (or church number) and PIN. Rejects 'pin/number' | 'pin/unknown' | 'pin/wrong' | 'pin/busy' | 'pin/off' | … */
    function signInPin(rawNumber, pin) {
      return doc('pinLogins/dial').get().then(function (s) { return s.exists ? s.data().dial : ''; }, function () { return ''; }).then(function (dial) {
        var login = pinLogin(rawNumber, dial); if (!login) throw fail('pin/number');
        return doc('pinLogins/' + login).get().then(function (s) {
          if (!s.exists) throw fail('pin/unknown');
          return auth.signInWithEmailAndPassword(pinAddress(login, s.data().v), String(pin || '')).catch(function (e) {
            var c = e && e.code;
            throw fail(c === 'auth/too-many-requests' ? 'pin/busy' : c === 'auth/operation-not-allowed' ? 'pin/off' :
              /wrong-password|invalid-credential|invalid-login-credentials|user-not-found|invalid-password/.test(c || '') ? 'pin/wrong' : c || 'pin/error');
          });
        });
      }).catch(function (e) { throw e && /^pin\//.test(e.code || '') ? e : fail(e && e.code === 'unavailable' ? 'pin/offline' : 'pin/error'); });
    }
    var claiming = false, codeQuiet = false;   // while a code is being used, its sign-in doesn't open a session yet
    function startCodeSession(u) {
      if (claiming) return;
      if (u.isAnonymous) { codeQuiet = true; return auth.signOut().then(function () { onState({ stage: 'signedOut' }); }); }   // a code left half-used
      var email = String(u.email).toLowerCase(), g = authGen;
      onState({ stage: 'loading', email: '', step: 'checking' });
      var get = function () { return offlineNow() ? doc('roles/' + email).get({ source: 'cache' }).catch(function () { return doc('roles/' + email).get(); }) : doc('roles/' + email).get(); };
      ownCopy(email).then(get).then(function (snap) {
        if (g !== authGen) return;
        if (!snap.exists) {   // switched off by the church (or never finished): they need a new code
          if (!(snap.metadata && snap.metadata.fromCache)) wipe();
          codeQuiet = true;
          return auth.signOut().then(function () { onState({ stage: 'signedOut', message: 'unlinked' }); });
        }
        var r = snap.data();
        session = { email: email, code: true, login: r.login || '', role: 'member', personId: r.personId || '', langs: [], can: [], standInFrom: 0, standInTo: 0, household: [] };
        subscribe();
      }).catch(function (e) {
        if (g !== authGen) return;
        if (e && e.code === 'permission-denied') { codeQuiet = true; return auth.signOut().then(function () { onState({ stage: 'signedOut', message: 'unlinked' }); }); }
        onState({ stage: 'error', message: offlineNow() ? 'You’re offline, and this device has no copy of Church & Trellis yet. Connect to the internet once, then it will open offline too.' :
          'Church & Trellis couldn’t load. Check your internet connection and refresh the page.' });
      });
    }
    /** Signed in with a number and PIN? Resolves to that number ('c…' for a church number), or '' for an email sign-in. */
    function isCodeSession() { return session && session.code ? session.login || 'pin' : ''; }

    /* Administrators: give codes, see and switch off PIN sign-ins */
    var CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ', CODE_DAYS = 14;
    function newCode() {
      var out = '', a = new Uint32Array(8); (window.crypto || window.msCrypto).getRandomValues(a);
      for (var i = 0; i < 8; i++) out += CODE_CHARS[a[i] % CODE_CHARS.length];
      return out;
    }
    /** A new code for a person: resolves { code, expires }. Their unused older codes go, and so does a PIN sign-in they
     *  already have (a new code is for a forgotten PIN or a new number). mobile = their cellphone number, to fill in. */
    function codeGive(pid, name, mobile, dial) {
      var code = newCode(), expires = Date.now() + CODE_DAYS * 864e5;
      return Promise.all([codesUnused(pid), devicesOf(pid)]).then(function (r) {
        var b = fs.batch();
        r[0].forEach(function (c) { b.delete(doc('invites/' + c)); });
        r[1].forEach(function (d) { b.delete(doc('roles/' + d.id)); });
        var inv = { personId: pid, name: name, role: 'member', expires: expires, by: session.personId || '', createdAt: now() };
        if (mobile) inv.mobile = String(mobile);
        if (dial) { inv.dial = String(dial); b.set(doc('pinLogins/dial'), { dial: String(dial) }); }
        b.set(doc('invites/' + code), inv);
        return b.commit();
      }).then(function () { return { code: code, expires: expires }; });
    }
    function codesUnused(pid) {
      return fs.collection('invites').where('personId', '==', pid).get().then(function (s) { return s.docs.filter(function (d) { return !(d.data() || {}).usedBy; }).map(function (d) { return d.id; }); });
    }
    /** A person's PIN sign-ins: their access entries with a number ([{ id: the address, login, linkedAt }], Administrators). */
    function devicesOf(pid) {
      return fs.collection('roles').where('personId', '==', pid).get().then(function (s) {
        return s.docs.filter(function (d) { return PIN_RE.test(d.id); }).map(function (d) { var x = d.data() || {}; return { id: d.id, login: x.login || '', linkedAt: x.linkedAt || null }; });
      });
    }
    function deviceRemove(id) { if (!PIN_RE.test(id)) return Promise.reject(new Error('not a PIN sign-in')); local['roles/' + id] = null; return doc('roles/' + id).delete(); }
    /** No access, left, or died: every PIN sign-in and unused code of this person goes (Administrators). */
    function codesDrop(pid) {
      return Promise.all([devicesOf(pid), codesUnused(pid)]).then(function (r) {
        if (!r[0].length && !r[1].length) return;
        var b = fs.batch();
        r[0].forEach(function (d) { b.delete(doc('roles/' + d.id)); });
        r[1].forEach(function (c) { b.delete(doc('invites/' + c)); });
        return b.commit();
      }).catch(function (e) { console.error('sign-in codes', e && e.code); });
    }

    /** Someone sharing the sign-in chose who they are (or switched): load Church & Trellis as that person. */
    function usePerson(h) {
      session.role = h.role; session.personId = h.personId; session.langs = h.langs; session.can = h.can;
      try { localStorage.setItem(WHO_KEY + session.email, h.personId); } catch (x) {}
      subscribe();
    }
    function choose(pid) {
      var h = session && session.household.filter(function (x) { return x.personId === pid; })[0]; if (!h) return;
      stop(); previewRole = ''; previewCare = '';
      onState({ stage: 'loading', email: session.email });
      usePerson(h);
    }
    /** The people sharing this sign-in (empty when it is just one person). */
    function household() { return session ? session.household.slice() : []; }

    /** What to load for each role – mirrors firestore.rules, so no request is refused. */
    function plan() {
      var me = session.personId, r = role(), staff = is('admin', 'pastor', 'rosters', 'kids'), p = [];
      var COLL = { leaveConfig: 'leave', detailsMe: 'details', consentsMe: 'consents', consentsMed: 'consents', consentsPhotos: 'consents', messagesTo: 'messages', messagesFrom: 'messages', serveSwapsFrom: 'serveSwaps', serveSwapsTo: 'serveSwaps', awayAsksMe: 'awayAsks', crewsMe: 'crews', leaderBodiesOpen: 'leaderBodies', leaderBodiesMine: 'leaderBodies', loansMe: 'loans' };
      var add = function (key, ref) { p.push({ key: key, ref: ref, coll: COLL[key] || key }); };
      var coll = function (c) { return fs.collection(c); }, own = function (c, field) { return fs.collection(c).where(field || 'personId', '==', me); };
      add('settings', doc('settings/church'));
      if (is('admin') && !previewRole) add('brochure', doc('brochures/church'));
      add('leaveConfig', doc('leave/config'));
      // The church directory; attendees (Basic access, not Church Partners) only when Settings → Attendees lets them, and
      // otherwise at most Church Partners' names (names). The rules decide for a real attendee (what they may not read
      // stays empty); "View as" an attendee follows the settings already loaded.
      // Basic access: asked for once their own record and the settings are known (Church Partner or attendee) – see extras()
      var seenSt = lastSettings || {}, att = r === 'attendee', attCan = window.Msg ? Msg.attendeeCan(seenSt) : ['names'];
      if (r !== 'member' && (!att || attCan.indexOf('directory') >= 0)) add('directory', coll('directory'));
      if (r === 'admin' || r === 'pastor' || (att && (attCan.indexOf('names') >= 0 || attCan.indexOf('directory') >= 0))) add('names', coll('names'));
      // Every adult's name, for Midweek Group leaders adding people (pickNames); who those leaders are (lifeLeaders/all).
      // Administrators and Pastors keep both in step; a leader is given the names in extras(), once their groups are known.
      if (is('admin', 'pastor')) { add('pickNames', coll('pickNames')); add('lifeLeaders', doc('lifeLeaders/all')); }
      if (is('admin')) add('customGroups', coll('customGroups'));
      else {
        add('customGroupsChurch', coll('customGroups').where('visibility', '==', 'church'));
        add('customGroupsMine', coll('customGroups').where('memberIds', 'array-contains', me));
      }
      add('applicationDocuments', coll('applicationDocuments'));
      if (staff) add('contacts', coll('contacts'));   // staff and leaders: home address and spouse of people who agreed to share them
      ['teams', 'positions', 'services', 'away'].forEach(function (c) { add(c, coll(c)); });
      if (staff) {
        add('people', coll('people'));
        add('families', coll('families'));
        ['skills', 'assignments', 'groups', 'blockouts'].forEach(function (c) { add(c, coll(c)); });
      } else {
        add('people', doc('people/' + me));
        ['skills', 'assignments', 'blockouts'].forEach(function (c) { add(c, own(c)); });
        add('groups', coll('groups').where('memberIds', 'array-contains', me));
      }
      // Care groups: Administrators and Pastors see all; everyone else their own group (and its members' cards, loaded
      // once the group is known – see shares())
      add('careGroups', previewCare ? doc('careGroups/' + previewCare) : is('admin', 'pastor') ? coll('careGroups') : coll('careGroups').where('memberIds', 'array-contains', me));   // "View as" a carer: that group
      // Messages (js/messages.js): Administrators and Pastors see them all; everyone else those sent to them and their own.
      // Message groups: Administrators and Pastors all; everyone else the groups they are in.
      if (is('admin', 'pastor')) { add('messages', coll('messages')); add('msgGroups', coll('msgGroups')); }
      else { add('messagesTo', coll('messages').where('to', 'array-contains', me)); add('messagesFrom', own('messages', 'fromId')); add('msgGroups', coll('msgGroups').where('memberIds', 'array-contains', me)); }
      // Leadership groups (js/leaders.js): Administrators and Pastors see them all; everyone else the open ones and their own.
      // The Archive follows from them and from the settings, so it is asked for once those are known – see extras().
      if (is('admin', 'pastor')) add('leaderBodies', coll('leaderBodies'));
      else { add('leaderBodiesOpen', coll('leaderBodies').where('open', '==', true)); add('leaderBodiesMine', coll('leaderBodies').where('memberIds', 'array-contains', me)); }
      // Library (js/library.js): everyone sees the books; Administrators every loan, everyone else their own
      // (a librarian who isn't an Administrator: every loan, once the settings say who the librarians are – see extras())
      add('books', coll('books'));
      if (is('admin')) add('loans', coll('loans')); else add('loansMe', own('loans'));
      if (is('admin')) add('libraryDuplicateIgnores', coll('libraryDuplicateIgnores'));
      // Offers to serve: roster coordinators and Administrators answer them all; everyone else sees their own
      // ("View as" by the Rector: everyone's offers only if they may answer them themselves – the rules check their own sign-in)
      var realRoster = !previewRole || session.role === 'admin' || (session.can || []).indexOf('rosters') >= 0;
      add('serveOffers', (is('admin', 'rosters') || may('rosters')) && realRoster ? coll('serveOffers') : own('serveOffers'));
      // Taking someone's place on a turn (serveSwaps, id = the turn's id) and "Are you away?" before planning (awayAsks):
      // the roster team sees them all; everyone else the ones they asked or were asked, and the asks sent to them
      // Who's serving at each service (crews, id = the service's id: names and positions only), for the people serving there
      if ((is('admin', 'rosters') || may('rosters')) && realRoster) { add('serveSwaps', coll('serveSwaps')); add('awayAsks', coll('awayAsks')); add('crews', coll('crews')); }
      else {
        add('serveSwapsFrom', own('serveSwaps', 'fromId')); add('serveSwapsTo', coll('serveSwaps').where('toId', '==', me)); add('awayAsksMe', coll('awayAsks').where('people', 'array-contains', me));
        if ((lastSettings || {}).crewView !== false) add('crewsMe', coll('crews').where('people', 'array-contains', me));
      }
      // Changes to family details people asked for: Administrators check them all; everyone else sees their own
      add('detailChanges', may('people') ? coll('detailChanges') : own('detailChanges'));
      // Applications to become a Church Partner: Administrators and Pastors read them all; everyone else their own
      add('partnerApps', is('admin', 'pastor') ? coll('partnerApps') : own('partnerApps'));
      // Translations: the approved wording for everyone; suggestions – Administrators all, checkers their languages, everyone their own
      add('words', coll('words'));
      if (may('words')) add('wordIdeas', coll('wordIdeas'));
      else {
        add('wordIdeasMe', own('wordIdeas'));
        (previewRole ? [] : session.langs || []).forEach(function (l) { COLL['wordIdeas_' + l] = 'wordIdeas'; add('wordIdeas_' + l, coll('wordIdeas').where('lang', '==', l)); });
      }
      if (is('admin', 'pastor')) { add('details', coll('details')); add('consents', coll('consents')); }
      else {
        add('detailsMe', doc('details/' + me));
        add('consentsMe', own('consents'));
        if (r === 'kids') {
          add('details', coll('details').where('familyRole', '==', 'child'));
          add('consentsMed', coll('consents').where('purpose', '==', 'Children’s medical notes'));
          add('consentsPhotos', coll('consents').where('purpose', '==', 'Photos'));
        }
      }
      if (r === 'kids' && !previewRole) add('medical', coll('medical'));   // "View as": an Administrator may not read these
      // Responsible adults and collection restrictions: Administrators, Pastors, Children's ministry; others only links to themselves
      if (is('admin', 'pastor', 'kids')) { add('guardians', coll('guardians')); add('noCollect', coll('noCollect')); }
      else add('guardians', fs.collection('guardians').where('adultId', '==', me));
      if (r === 'pastor' && !previewRole) add('notes', coll('notes'));
      if (is('admin', 'pastor')) add('officeNotes', coll('officeNotes'));
      if (may('import')) { add('elvantoSync', coll('elvantoSync')); add('robotStatus', coll('robotStatus')); add('elvantoFound', coll('elvantoFound')); }
      else add('elvantoSync', own('elvantoSync'));
      if (may('privacy')) ['dsr', 'breaches'].forEach(function (c) { add(c, coll(c)); });   // the audit log (1000 entries) is only for Privacy: asked for a few seconds later, see lateAudit()
      if (may('settings')) add('emailPrompts', coll('emailPrompts'));
      if (may('leave')) { add('leaveRequests', coll('leaveRequests')); add('leaveAdjustments', coll('leaveAdjustments')); }
      else if (standingIn()) { add('leaveRequests', coll('leaveRequests')); add('leaveAdjustments', own('leaveAdjustments', 'staffId')); }
      else { add('leaveRequests', own('leaveRequests', 'staffId')); add('leaveAdjustments', own('leaveAdjustments', 'staffId')); }
      return p;
    }

    var lastSettings = null;   // the church's settings as last loaded (for "View as" an attendee)
    function subscribe() {
      lastSettings = raw.settings && raw.settings.church ? copy(raw.settings.church) : lastSettings;
      db = blank(); raw = {}; ready = false; local = {};
      var sources = plan(); pending = sources.length;
      var total = sources.length;
      stats.start = Date.now(); stats.loaded = 0;
      onState({ stage: 'loading', email: session ? session.email : '', step: 'syncing', done: 0, total: total });
      sources.forEach(function (s) {
        var first = true;
        unsubs.push(s.ref.onSnapshot(function (snap) {
          var m = {};
          if (snap.docs) snap.docs.forEach(function (d) { m[d.id] = d.data(); });
          else if (snap.exists) m[snap.id] = snap.data();
          raw[s.key] = m; stats.snaps++; stats.sizes[s.key] = Object.keys(m).length;
          if (s.key === 'careGroups' && !is('admin', 'pastor')) shares(Object.keys(m));
          if (s.key === 'settings' || s.key === 'people' || s.key === 'careGroups' || s.key.indexOf('leaderBodies') === 0) extras();
          if (s.key === 'settings') { careAll(m.church); if (!is('admin', 'pastor') && raw.careGroups) shares(Object.keys(raw.careGroups)); }
          if (!snap.metadata.hasPendingWrites) forget(s.coll);
          if (first) {
            first = false;
            var loaded = total - pending;
            if (--pending === 0) whenLoaded();
            else onState({ stage: 'loading', email: session ? session.email : '', step: 'syncing', done: loaded + 1, total: total });
          }
          else if (ready) rebuildSoon(!snap.metadata.hasPendingWrites);
        }, function (e) {
          // An attendee isn't allowed the church directory (or names) unless Settings → Attendees says so: expected, not an error
          if (s.key === 'directory' || s.key === 'names') console.warn('Not loaded (not allowed): ' + s.key); else console.error('Could not load ' + s.key, e);
          raw[s.key] = raw[s.key] || {};
          if (first) {
            first = false;
            var loaded = total - pending;
            if (--pending === 0) whenLoaded();
            else onState({ stage: 'loading', email: session ? session.email : '', step: 'syncing', done: loaded + 1, total: total });
          }
        }));
      });
    }
    /** The cards of the people in my care group(s): careGroups/{id}/share, followed as my groups change. */
    var shareSubs = {};
    /** Settings → Who can see what → "See who else is in their own care group" switched off (settings.seeCareOwn false):
     *  someone who isn't a carer of the group loads only the carers' cards and their own (one document each). */
    var shareKeys = {};
    function shareIds(g) {
      var st = (raw.settings && raw.settings.church) || {}, grp = (raw.careGroups || {})[g] || {}, leaders = grp.leaderIds || [];
      if (st.seeCareOwn !== false || leaders.indexOf(session.personId) >= 0) return null;   // the whole group
      return leaders.concat([session.personId]).filter(function (x, i, a) { return x && a.indexOf(x) === i; }).sort();
    }
    function shares(gids) {
      var stopOne = function (g) { try { shareSubs[g](); } catch (e) {} delete shareSubs[g]; delete shareKeys[g]; delete raw['share:' + g]; };
      Object.keys(shareSubs).forEach(function (g) { if (gids.indexOf(g) < 0) stopOne(g); });
      gids.forEach(function (g) {
        var ids = shareIds(g), k = ids ? ids.join() : '*';
        if (shareSubs[g] && shareKeys[g] === k) return;
        if (shareSubs[g]) stopOne(g);
        shareKeys[g] = k;
        var changed = function () { if (ready) rebuildSoon(true); };
        if (!ids) {
          shareSubs[g] = fs.collection('careGroups/' + g + '/share').onSnapshot(function (snap) {
            var m = {}; snap.docs.forEach(function (d) { m[d.id] = d.data(); }); raw['share:' + g] = m; changed();
          }, function (e) { console.error('Could not load care group ' + g, e); });
          return;
        }
        raw['share:' + g] = {};
        var offs = ids.map(function (pid) {
          return doc('careGroups/' + g + '/share/' + pid).onSnapshot(function (snap) {
            var m = Object.assign({}, raw['share:' + g] || {}); if (snap.exists) m[pid] = snap.data(); else delete m[pid];
            raw['share:' + g] = m; changed();
          }, function (e) { console.error('Could not load a card in care group ' + g, e); });
        });
        shareSubs[g] = function () { offs.forEach(function (o) { try { o(); } catch (e) {} }); };
      });
    }
    /** Settings → Who can see what: Roster coordinators and Children's ministry may see every care group (settings.seeCare).
     *  Known only once the settings have loaded, so followed here (not in plan()); the members' cards stay with the group. */
    var careAllSub = null;
    function careAll(st) {
      var want = (is('rosters') || is('kids')) && !previewCare && ((st && st.seeCare) || []).indexOf(role()) >= 0;
      if (!want && careAllSub) { try { careAllSub(); } catch (e) {} careAllSub = null; delete raw.careGroupsAll; if (ready) { rebuild(); remoteChanged(); } }
      if (!want || careAllSub) return;
      careAllSub = fs.collection('careGroups').onSnapshot(function (snap) {
        var m = {}; snap.docs.forEach(function (d) { m[d.id] = d.data(); }); raw.careGroupsAll = m;
        if (ready) rebuildSoon(true);
      }, function (e) { console.warn('Could not load every care group (re-publish the database rules?)', e && e.code); careAllSub = null; });
    }
    /** Lists that depend on the church's settings or on my leadership groups, so they can only be asked for once those
     *  are known. Archive records are fetched only for Administrators (all records) and Council members (only records
     *  allowed by the record's existing access setting).
     *  The Library: a librarian who isn't an Administrator sees every loan. Each matches a rule in firestore.rules. */
    function myBodies() {
      var m = merged('leaderBodies', 'leaderBodiesMine'), me = session.personId;
      return Object.keys(m).filter(function (id) { return (m[id].memberIds || []).indexOf(me) >= 0; }).sort();
    }
    function extras() {
      if (!session || !fs) return;
      var st = (raw.settings && raw.settings.church) || {}, me = session.personId, want = {}, c = function (x) { return fs.collection(x); };
      if (((st.modules || {}).archive === true || (st.modules || {}).library === true) && me) {
        var council = !previewRole && myBodies().some(function (id) { var b = get('leaderBodies', id); return b && /council/i.test(b.name || ''); });
        if (is('admin')) want['archive:'] = c('archive');
        else if (council) {
          want['archive:all'] = c('archive').where('access', '==', 'all');
          want['archive:me'] = c('archive').where('shownTo', '==', me);
          if (is('pastor')) want['archive:office'] = c('archive').where('access', '==', 'office');
          if (is('pastor') && st.seniorPastorId === me) want['archive:private'] = c('archive').where('access', '==', 'private');   // staff contracts and appraisals
          myBodies().forEach(function (g) { want['archive:g:' + g] = c('archive').where('bodyId', '==', g); });
        }
      }
      // Basic access: Church Partners (and staff) see the church directory; attendees what Settings → Attendees allows
      var mine = (raw.people || {})[me];
      if (role() === 'member' && me && mine && raw.settings) {
        var partner = window.Msg ? Msg.partnerLevel(mine) : true, ac = window.Msg ? Msg.attendeeCan(st) : [];
        if (partner || ac.indexOf('directory') >= 0) want.directory = c('directory');
        if (partner || ac.indexOf('names') >= 0 || ac.indexOf('directory') >= 0) {
          want.names = c('names');
          if (st.crewView !== false) want['assignments:all'] = c('assignments');   // who is serving where, so any volunteer can print the whole roster (names come from names); the same switch as Who's serving with you
        }
      }
      // A Midweek Group's leader (not an Administrator or Pastor): every adult's name, to add people to their group
      var cgRaw = raw.careGroups || {};
      if (!is('admin', 'pastor') && me && Object.keys(cgRaw).some(function (id) { var g = cgRaw[id] || {}; return g.type === 'life' && (g.leaderIds || []).indexOf(me) >= 0; }))
        want['pickNames:lead'] = c('pickNames');
      if (is('pastor') && !previewRole && me && st.seniorPastorId === me) want['brochure:rector'] = fs.doc('brochures/church');   // the Rector reads the brochure wording
      if (!is('admin') && !previewRole && me && (st.librarianIds || []).indexOf(me) >= 0) {
        want['loans:all'] = c('loans');
        want['libraryDuplicateIgnores:all'] = c('libraryDuplicateIgnores');
      }
      // Community board and Marketplace (js/community.js): Church Partners and staff, never attendees, once switched on –
      // what is live or sorted/sold, their own, and everything for keepers (firestore.rules seesItem, keepsPart)
      var partnerHere = role() !== 'attendee' && (role() !== 'member' || (!!mine && (!window.Msg || Msg.partnerLevel(mine))));
      ['board', 'market'].forEach(function (pt) {
        if (!me || !partnerHere || (st.modules || {})[pt] !== true) return;
        var chosen = (st.keepers || {})[pt], keeps = !previewRole && (Array.isArray(chosen) ? chosen.indexOf(me) >= 0 : is('admin', 'pastor') || (st.rosterExtra || []).indexOf(me) >= 0);
        if (keeps) { want[pt + ':all'] = c(pt); return; }
        want[pt + ':live'] = c(pt).where('status', '==', 'live'); want[pt + ':done'] = c(pt).where('status', '==', 'done'); want[pt + ':mine'] = c(pt).where('personId', '==', me);
      });
      // Midweek Groups online (js/studies.js): once Midweek Groups are switched on – Administrators and Pastors every
      // group's links; everyone else their own groups' and those open to the whole church (firestore.rules studies)
      if (me && (st.modules || {}).life === true) {
        if (is('admin', 'pastor')) want['studies:all'] = c('studies');
        else { want['studies:open'] = c('studies').where('open', '==', true); want['studies:mine'] = c('studies').where('to', 'array-contains', me); }
      }
      // Events (js/events.js): once switched on – the organisers every event and sign-up; Church Partners and staff every
      // event, attendees those for everyone; and everyone their own sign-ups and those that include them (firestore.rules events)
      if (me && (st.modules || {}).events === true) {
        var chosenOrg = (st.organisers || {}).events;
        var organises = !previewRole && (Array.isArray(chosenOrg) ? chosenOrg.indexOf(me) >= 0 && partnerHere : is('admin', 'pastor') || ((st.rosterExtra || []).indexOf(me) >= 0 && partnerHere));
        // Staff (and organisers) see every sign-up, so they can add people from a paper sheet without adding anyone twice
        var staffHere = !previewRole && is('admin', 'pastor', 'rosters', 'kids');
        if (organises || staffHere) { want['events:all'] = c('events'); want['eventSignups:all'] = c('eventSignups'); }
        else {
          if (partnerHere) want['events:all'] = c('events'); else want['events:open'] = c('events').where('who', '==', 'all');
          want['eventSignups:by'] = c('eventSignups').where('by', '==', me);
          want['eventSignups:in'] = c('eventSignups').where('people', 'array-contains', me);
        }
      }
      var gone = false;
      Object.keys(extraSubs).forEach(function (k) { if (!want[k]) { try { extraSubs[k](); } catch (e) {} delete extraSubs[k]; delete raw[k]; gone = true; } });
      if (gone && ready) { rebuild(); remoteChanged(); }
      Object.keys(want).forEach(function (k) {
        if (extraSubs[k]) return;
        extraSubs[k] = want[k].onSnapshot(function (snap) {
          var m = {}; if (snap.docs) snap.docs.forEach(function (d) { m[d.id] = d.data(); }); else if (snap.exists) m[snap.id] = snap.data(); raw[k] = m;   // a collection, or one document
          if (ready) rebuildSoon(!snap.metadata.hasPendingWrites);
        }, function (e) { console.warn('Could not load ' + k + ' (re-publish the database rules?)', e && e.code); delete extraSubs[k]; });
      });
    }
    function stopExtras() { Object.keys(extraSubs).forEach(function (k) { try { extraSubs[k](); } catch (e) {} }); extraSubs = {}; }
    /** Archive source files remain available to each record's readers; preview copies have stricter read rules. */
    // The file first, then its preview copy: the rules only accept a preview that is an exact copy of a saved part.
    function fileSave(id, parts, had) {
      var extra = []; for (var i = parts.length; i < (had || 0); i++) extra.push(i);
      return Promise.all(parts.map(function (data, i) { return doc('archive/' + id + '/parts/' + i).set({ data: data }); }))
        .then(function () { return Promise.all(parts.map(function (data, i) { return doc('archivePreviews/' + id + '/parts/' + i).set({ data: data }); })); })
        .then(function () {
          return Promise.all(extra.map(function (i) { return doc('archivePreviews/' + id + '/parts/' + i).delete().then(function () { return doc('archive/' + id + '/parts/' + i).delete(); }); }));
        });
    }
    function fileLoad(id, n) {
      var jobs = []; for (var i = 0; i < n; i++) jobs.push(doc('archive/' + id + '/parts/' + i).get());
      return Promise.all(jobs).then(function (snaps) { return snaps.map(function (s) { if (!s.exists) throw new Error('A part of the file is missing'); return s.data().data || ''; }); });
    }
    /** Preview copies are a separate endpoint, limited by Firestore rules to Administrators and Council members. */
    function filePreviewLoad(id, n) {
      if (offlineNow()) return Promise.reject(new Error('Preview requires an online connection'));
      var previews = [];
      for (var i = 0; i < n; i++) previews.push(doc('archivePreviews/' + id + '/parts/' + i).get({ source: 'server' }));
      return Promise.all(previews).then(function (snaps) {
        var missing = [];
        snaps.forEach(function (snap, part) { if (!snap.exists) missing.push(part); });
        if (!missing.length) return snaps.map(function (snap) { return snap.data().data || ''; });
        return Promise.all(missing.map(function (part) {
          return doc('archive/' + id + '/parts/' + part).get({ source: 'server' }).then(function (source) {
            if (!source.exists) throw new Error('A part of the file is missing');
            var data = source.data().data || '';
            return doc('archivePreviews/' + id + '/parts/' + part).set({ data: data }).then(function () { return data; });
          });
        })).then(function (copied) {
          var next = 0;
          return snaps.map(function (snap) { return snap.exists ? snap.data().data || '' : copied[next++]; });
        });
      });
    }
    /** Publish the deliberately limited, Administrator-approved copy used by the membership form. */
    function applicationDocumentSave(id, data, parts, old) {
      var jobs = [];
      var version = data.fileVersion;
      (parts || []).forEach(function (part, i) { jobs.push(doc('applicationDocuments/' + id + '/files/' + version + '/parts/' + i).set({ data: part })); });
      return Promise.all(jobs).then(function () {
        return doc('applicationDocuments/' + id).set(clean(data));
      }).then(function () {
        var stale = [];
        for (var i = 0; old && old.fileVersion && i < (old.parts || 0); i++) {
          stale.push(doc('applicationDocuments/' + id + '/files/' + old.fileVersion + '/parts/' + i).delete());
        }
        return Promise.all(stale);
      }).catch(function (e) { err(e, 'publish the membership application document'); throw e; });
    }
    function applicationDocumentRemove(id, previous) {
      return doc('applicationDocuments/' + id).delete().then(function () {
        var jobs = [];
        var old = previous || {};
        for (var i = 0; i < (old.parts || 0); i++) if (old.fileVersion) jobs.push(doc('applicationDocuments/' + id + '/files/' + old.fileVersion + '/parts/' + i).delete());
        return Promise.all(jobs);
      }).catch(function (e) { err(e, 'remove the membership application document'); throw e; });
    }
    function applicationDocumentFile(id, version, n) {
      var jobs = [];
      for (var i = 0; i < n; i++) jobs.push(doc('applicationDocuments/' + id + '/files/' + version + '/parts/' + i).get());
      return Promise.all(jobs).then(function (snaps) {
        return snaps.map(function (s) { if (!s.exists) throw new Error('A part of the document is missing'); return s.data().data || ''; });
      });
    }
    function forget(coll) { Object.keys(local).forEach(function (k) { if (k.split('/')[0] === coll) delete local[k]; }); }
    function stop() { unsubs.forEach(function (u) { try { u(); } catch (e) {} }); unsubs = []; shares([]); careAll(null); stopExtras(); ready = false; clearTimeout(rebuildTimer); rebuildTimer = null; rebuildWantsRemote = false; }
    function remoteChanged() {
      clearTimeout(remoteTimer);
      remoteTimer = setTimeout(function () { remoteListeners.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } }); }, 300);
    }
    /** The audit log is only shown under Privacy, so it is fetched after the first screen is up and the phone has had a moment to settle. */
    function lateAudit() {
      if (previewRole || !may('privacy')) return;
      setTimeout(function () {
        if (!ready || !session || previewRole || raw.audit) return;
        unsubs.push(fs.collection('audit').orderBy('ts', 'desc').limit(1000).onSnapshot(function (snap) {
          var m = {}; snap.docs.forEach(function (d) { m[d.id] = d.data(); }); raw.audit = m; stats.sizes.audit = snap.docs.length;
          if (ready) rebuildSoon(false);
        }, function (e) { console.warn('Audit log not loaded', e && e.code); }));
      }, 6000);
    }
    function whenLoaded() {
      rebuild();
      var legacySettings = (raw.settings || {}).church;
      if (role() === 'admin' && legacySettings && Object.prototype.hasOwnProperty.call(legacySettings, 'brochures')) {
        var savedBrochure = (raw.brochure || {}).church;
        if (savedBrochure === undefined) Live.migrateBrochure(legacySettings.brochures);
        else Live.clearLegacyBrochure();
      }
      var meP = get('people', session.personId);
      if (!db.settings && role() === 'admin') return onState({ stage: 'setup', email: session.email, needChurch: true });
      if (!db.settings) return onState({ stage: 'noAccess', email: session.email, reason: 'notReady' });
      if (!meP) return onState(role() === 'admin' ? { stage: 'setup', email: session.email } : { stage: 'noAccess', email: session.email, reason: 'noPerson' });
      ready = true; stats.loaded = Date.now(); stats.marks.ready = Math.round(performance.now());
      if (!previewRole && is('admin', 'pastor')) syncCouncilPreviewMembers();
      // My own directory entry shows my care groups when Settings asks for it (carers may have added me)
      var dirMe = (raw.directory || {})[session.personId];
      var careDir = careForMembers(db.settings) || Object.keys(raw.directory || {}).some(function (id) { return raw.directory[id].care; });
      if (!previewRole && !offlineNow() && (careDir || (dirMe && dirMe.care))) {
        // Administrators and Pastors: everyone's entry, in case a change was missed (e.g. saved before the rules allowed it)
        if (is('admin', 'pastor')) setTimeout(function () { if (ready && session && !offlineNow()) resyncDirectory(); }, 1500);
        else syncDirectory(session.personId);
      }
      // Birthdays in the directory (0.115): filled in once for the entries written before them (Administrators and Pastors)
      if (!previewRole && !offlineNow() && is('admin', 'pastor') && !careDir && typeof Celebrate !== 'undefined') {
        var dets = merged('details', 'detailsMe'), cardsNow = raw.people || {};
        var behind = Object.keys(raw.directory || {}).some(function (id) {
          var want = Celebrate.forDirectory(Object.assign({}, dets[id] || {}, cardsNow[id] || {}), (dets[id] || {}).lateSpouseId ? { id: 1 } : null), got = raw.directory[id] || {};
          return (want.birthDay || '') !== (got.birthDay || '') || (want.weddingDay || '') !== (got.weddingDay || '');
        });
        if (behind) setTimeout(function () { if (ready && session && !offlineNow()) resyncDirectory(); }, 1500);
      }
      // Church Partners' names for attendees (names/…): written with each directory entry; filled in once for a church
      // that had a directory before (Administrators and Pastors)
      if (!previewRole && !offlineNow() && is('admin', 'pastor') && !careDir && Object.keys(raw.directory || {}).length && !Object.keys(raw.names || {}).length)
        setTimeout(function () { if (ready && session && !offlineNow()) resyncDirectory(); }, 1500);
      // Midweek Group leaders: who they are, and every adult's name filled in once (Administrators and Pastors)
      if (!previewRole && !offlineNow() && is('admin', 'pastor')) setTimeout(function () {
        if (!ready || !session || previewRole || offlineNow() || !is('admin', 'pastor')) return;
        syncLifeLeaders();
      }, 1700);
      if (!previewRole && !offlineNow() && is('admin')) setTimeout(function () { if (ready && session && !previewRole && !offlineNow() && is('admin')) { syncMinisters(); syncRosterTeam(); } }, 2000);
      lateAudit();
      onState({ stage: 'ready', person: meP, email: session.email, role: role() });
    }
    /** Administrators: the ministers' names in Settings (settings.ministers), so everyone may write to them. */
    function syncMinisters() {
      if (!db.settings || ((raw.settings || {}).church || {}).brochures) return;   // older brochure wording is moved first
      var now = pastorsNow(), was = (db.settings || {}).ministers || [];
      if (JSON.stringify(now) === JSON.stringify(was)) return;
      db.settings.ministers = now; patch('settings/church', { ministers: now });
    }

    /** Administrators: who hears about roster replies (settings.rosterTeam), so volunteers may tell them. */
    function syncRosterTeam() {
      if (!db.settings || ((raw.settings || {}).church || {}).brochures) return;
      var now = rosterTeamNow(db.settings), was = (db.settings || {}).rosterTeam || [];
      if (JSON.stringify(now) === JSON.stringify(was)) return;
      db.settings.rosterTeam = now; patch('settings/church', { rosterTeam: now });
    }

    /* ---------- putting the pieces back together ---------- */
    function arr(key) { var m = raw[key] || {}; return Object.keys(m).map(function (id) { var o = copy(m[id]); o.id = id; return o; }); }
    function merged() { var out = {}; Array.prototype.slice.call(arguments).forEach(function (k) { var m = raw[k] || {}; Object.keys(m).forEach(function (id) { out[id] = m[id]; }); }); return out; }
    /** Updates that arrive from the server (each part of the church's records answers a second time once it has been checked
     *  online) are gathered and put together once, a moment later – not once each, which froze the phone just after it looked ready. */
    var rebuildTimer = null, rebuildWantsRemote = false;
    function rebuildSoon(remote) {
      if (remote) rebuildWantsRemote = true;
      // Only the burst of updates just after opening is gathered; after that, and right after anything this person saves, it is immediate
      var now = Date.now();
      if (!rebuildTimer && (now - lastWrite < 3000 || now - stats.loaded > 10000)) { rebuild(); if (rebuildWantsRemote) { rebuildWantsRemote = false; remoteChanged(); } return; }
      if (rebuildTimer) return;
      rebuildTimer = setTimeout(function () {
        rebuildTimer = null;
        if (!ready) { rebuildWantsRemote = false; return; }
        rebuild();
        if (rebuildWantsRemote) { rebuildWantsRemote = false; remoteChanged(); }
      }, 100);
    }
    function rebuild() {
      var t0 = Date.now();
      rebuildAll();
      var ms = Date.now() - t0; stats.rebuilds++; stats.rebuildMs += ms; if (ms > stats.slowestRebuild) stats.slowestRebuild = ms;
    }
    function rebuildAll() {
      rev++;
      var details = merged('details', 'detailsMe'), med = raw.medical || {}, dir = raw.directory || {}, cards = raw.people || {}, shared = raw.contacts || {};
      var people = Object.keys(cards).map(function (id) {
        var p = Object.assign({ keyDates: [] }, copy(details[id] || {}), copy(cards[id]));
        if (med[id]) p.medical = copy(med[id]);
        if (dir[id]) p.inDirectory = true;
        // What they agreed to share (Contact details), for roles that can't read their private details
        ['shareAddress', 'shareSpouse'].forEach(function (k) { var v = (shared[id] || {})[k] || (dir[id] || {})[k]; if (v) p[k] = v; });
        // The day of a birthday or wedding from the directory, for roles that can't read details (only when nothing better is known)
        if (dir[id] && dir[id].birthDay && !p.birthDate && !p.birthDay) p.birthDay = dir[id].birthDay;
        if (dir[id] && dir[id].weddingDay && !(p.keyDates || []).length) p.weddingDay = dir[id].weddingDay;
        p.id = id;
        if (id === session.personId) p.appRole = role() === 'attendee' ? 'member' : role();     // the access list is the source of truth (or the role being viewed as)
        return p;
      });
      Object.keys(dir).forEach(function (id) {                     // members: other people come from the directory
        if (cards[id]) return;
        people.push(Object.assign({ id: id, familyId: '', familyRole: 'adult', category: '', email: '', active: true, inDirectory: true, appRole: 'member', keyDates: [] }, copy(dir[id])));
      });
      var names = raw.names || {};
      Object.keys(names).forEach(function (id) {                   // attendees: only Church Partners' names
        if (cards[id] || dir[id]) return;
        var n = names[id] || {};
        people.push({ id: id, firstName: n.firstName || '', lastName: n.lastName || '', preferredName: n.preferredName || '', familyId: '', familyRole: 'adult', category: 'Church Partner', email: '', active: true, nameOnly: true, appRole: 'member', keyDates: [] });
      });
      db.people = people;
      db.settings = raw.settings && raw.settings.church ? copy(raw.settings.church) : null;
      var bro = role() === 'admin' ? raw.brochure : raw['brochure:rector'];   // the Rector's copy is asked for in extras()
      db.brochures = bro && bro.church ? copy(bro.church) : {};
      if (db.settings) delete db.settings.brochures;
      ['families', 'teams', 'positions', 'services', 'skills', 'groups', 'blockouts', 'dsr', 'breaches', 'elvantoSync', 'robotStatus', 'elvantoFound', 'guardians', 'noCollect', 'serveOffers', 'detailChanges', 'emailPrompts', 'msgGroups', 'partnerApps', 'books', 'applicationDocuments'].forEach(function (c) { db[c] = arr(c); });
      var ignoredDuplicates = merged.apply(null, Object.keys(raw).filter(function (k) { return k.indexOf('libraryDuplicateIgnores') === 0; }));
      db.libraryDuplicateIgnores = Object.keys(ignoredDuplicates).map(function (id) { var o = copy(ignoredDuplicates[id]); o.id = id; return o; });
      var asg = merged('assignments', 'assignments:all');   // staff: all of them; members: their own, and everyone's when they may see names
      db.assignments = Object.keys(asg).map(function (id) { var o = copy(asg[id]); o.id = id; return o; });
      var picks = merged('pickNames', 'pickNames:lead');   // every adult's name (Administrators, Pastors, Midweek Group leaders)
      db.pickNames = Object.keys(picks).map(function (id) { var o = copy(picks[id]); o.id = id; return o; });
      var custom = merged.apply(null, Object.keys(raw).filter(function (k) { return k.indexOf('customGroups') === 0; }));
      db.customGroups = Object.keys(custom).map(function (id) { var o = copy(custom[id]); o.id = id; return o; });
      [['leaderBodies', /^leaderBodies/], ['archive', /^archive:/], ['loans', /^loans/]].forEach(function (x) {   // each asked for in parts (plan(), extras())
        var all = merged.apply(null, Object.keys(raw).filter(function (k) { return x[1].test(k); }));
        db[x[0]] = Object.keys(all).map(function (id) { var o = copy(all[id]); o.id = id; return o; });
      });
      [['board', /^board:/], ['market', /^market:/], ['studies', /^studies:/], ['events', /^events:/], ['eventSignups', /^eventSignups:/]].forEach(function (x) {   // Community board, Marketplace, Midweek Group links, Events (extras())
        var all = merged.apply(null, Object.keys(raw).filter(function (k) { return x[1].test(k); }));
        db[x[0]] = Object.keys(all).map(function (id) { var o = copy(all[id]); o.id = id; return o; });
      });
      // An Archive record saved on this device shows straight away, even before (or without) a list that brings it back
      // from the database – e.g. a document only the Senior Pastor may see. A record deleted here stays gone.
      Object.keys(local).forEach(function (k) {
        var bits = k.split('/'); if (bits.length !== 2 || bits[0] !== 'archive') return;
        var there = db.archive.some(function (r) { return r.id === bits[1]; });
        if (local[k] === null) { if (there) db.archive = db.archive.filter(function (r) { return r.id !== bits[1]; }); }
        else if (local[k] && !there) { var o = copy(local[k]); o.id = bits[1]; db.archive.push(o); }
      });
      var cgs = merged('careGroupsAll', 'careGroups');   // my own groups, and every group when Settings allows (careAll)
      db.careGroups = Object.keys(cgs).map(function (id) { var o = copy(cgs[id]); o.id = id; return o; });
      [['serveSwaps', 'serveSwapsFrom', 'serveSwapsTo'], ['awayAsks', 'awayAsksMe'], ['crews', 'crews', 'crewsMe']].forEach(function (x) {
        var all = merged.apply(null, x);
        db[x[0]] = Object.keys(all).map(function (id) { var o = copy(all[id]); o.id = id; return o; });
      });
      var msgs = merged('messages', 'messagesTo', 'messagesFrom');
      db.messages = Object.keys(msgs).map(function (id) { var o = copy(msgs[id]); o.id = id; return o; });
      db.words = arr('words');
      var ideas = merged.apply(null, Object.keys(raw).filter(function (k) { return k.indexOf('wordIdeas') === 0; }));
      db.wordIdeas = Object.keys(ideas).map(function (id) { var o = copy(ideas[id]); o.id = id; return o; });
      db.careShare = [];
      Object.keys(raw).forEach(function (k) { if (k.indexOf('share:') === 0) { var g = k.slice(6); Object.keys(raw[k]).forEach(function (pid) { var o = copy(raw[k][pid]); o.id = g + ':' + pid; o.personId = pid; o.groupId = g; db.careShare.push(o); }); } });
      var cons = merged('consents', 'consentsMe', 'consentsMed', 'consentsPhotos');
      db.consents = Object.keys(cons).map(function (id) { var o = copy(cons[id]); o.id = id; return o; });
      db.notes = [];
      Object.keys(raw.notes || {}).forEach(function (pid) { (raw.notes[pid].entries || []).forEach(function (n) { db.notes.push(Object.assign({}, n, { personId: pid })); }); });
      db.officeNotes = [];
      Object.keys(raw.officeNotes || {}).forEach(function (pid) { (raw.officeNotes[pid].entries || []).forEach(function (n) { db.officeNotes.push(Object.assign({}, n, { personId: pid })); }); });
      if (raw.audit) db.audit = arr('audit').sort(function (a, b) { return a.at < b.at ? 1 : -1; });
      rebuildLeave();
    }
    function rebuildLeave() {
      var cfgDoc = raw.leaveConfig && raw.leaveConfig.config ? copy(raw.leaveConfig.config) : { settings: {}, rules: [], terms: [], types: [], levels: [], holidays: [] };
      delete cfgDoc.autoApprove;
      var requests = arr('leaveRequests'), adjustments = arr('leaveAdjustments');
      savedLeave = { requests: {}, adjustments: {}, config: JSON.stringify(cfgDoc) };
      requests.forEach(function (r) { savedLeave.requests[r.id] = JSON.stringify(r); });
      adjustments.forEach(function (a) { savedLeave.adjustments[a.id] = JSON.stringify(a); });
      if (role() !== 'admin') {                // others' approved leave, as dates only (no type or reason)
        var own = {}; requests.forEach(function (r) { own[r.id] = 1; });
        arr('away').forEach(function (a) {
          if (!own[a.id] && a.personId !== session.personId) requests.push({ id: a.id, staffId: a.personId, type: '', start: a.from, end: a.to, half: 'None', status: 'Approved', reason: '', synthetic: true });
        });
      }
      db.leave = Object.assign(cfgDoc, { requests: requests, adjustments: adjustments });
      snapLeave();
    }

    /* ---------- writing: only the pieces that changed, only where this role may write ---------- */
    function split(p) {
      var card = {}, det = {}, med = null;
      Object.keys(p || {}).forEach(function (k) {
        if (k === 'id' || k === 'inDirectory' || p[k] === undefined) return;
        if (k === 'medical') med = p.medical;
        else if (CARD.indexOf(k) >= 0) card[k] = p[k];
        else det[k] = p[k];
      });
      det.familyRole = (p && p.familyRole) || 'adult';
      return { card: copy(card), det: copy(det), med: copy(med) };
    }
    function putPerson(p) {
      // Compare with what the database holds (screens often change the record in place before saving it).
      var a = split(p), was = { card: known('people/' + p.id), det: known('details/' + p.id), med: known('medical/' + p.id) }, mine = p.id === session.personId;
      if (session.role === 'admin' && mine && p.appRole !== 'admin') { p.appRole = 'admin'; a.card.appRole = 'admin'; err({}, 'remove your own Administrator access – ask another Administrator'); }
      if (!same(a.card, was.card) && (is('admin', 'pastor') || mine || (is('kids') && p.familyRole === 'child'))) write('people/' + p.id, a.card);   // Children's ministry: a child's photo
      if (!same(a.det, was.det) && is('admin', 'pastor')) write('details/' + p.id, a.det);
      if (!same(a.med, was.med) && is('kids')) { if (a.med) write('medical/' + p.id, a.med); else del('medical/' + p.id); }
      syncDirectory(p.id);
      if (is('admin') || may('access')) syncRole(p, was.card);
      if (is('admin') && !previewRole && ((was.card || {}).appRole === 'pastor') !== (p.appRole === 'pastor' && p.active !== false)) syncMinisters();
      if (is('admin') && !previewRole) syncRosterTeam();
    }
    /** Keep the members' directory in step with consent: name and phone only, adults who agreed. */
    /** Contact details (consent "Church directory", shown as Contact details): what other people may see of someone who agreed.
     *  directory/{id} – everyone signed in: name and photo, plus what Settings lets Church Partners see (mobile, email,
     *  address, spouse). contacts/{id} – staff and leaders only: address and spouse, when Settings lets Roster coordinators
     *  or Children's ministry see them (they already read names, email and mobile from people/{id}). */
    var dirCtx = null;   // set while resyncDirectory() runs: the latest directory consents and the couples, worked out once
    function syncDirectory(pid) {
      if (!(is('admin', 'pastor') || pid === session.personId)) return;
      var p = get('people', pid), latest = dirCtx ? dirCtx.consent[pid] : find('consents', function (c) { return c.personId === pid && c.purpose === DIRECTORY && !c.withdrawnAt; })
        .sort(function (a, b) { return a.date < b.date ? 1 : -1; })[0];
      var ok = p && p.familyRole !== 'child' && p.active !== false && latest && latest.given, see = (db.settings && db.settings.seeOthers) || {};
      var allows = function (tier, f) { return (see[tier] || []).indexOf(f) >= 0; };
      var addr = ok ? addressOf(p) : '', spouse = ok ? spouseOf(p, known('directory/' + pid), known('contacts/' + pid)) : '';
      var want = ok ? { firstName: p.firstName || '', lastName: p.lastName || '', preferredName: p.preferredName || '' } : null;
      if (want) {
        if (p.photo) want.photo = p.photo;
        if (allows('member', 'mobile') && p.mobile) want.mobile = p.mobile;
        if (allows('member', 'email') && p.email) want.email = p.email;
        if (allows('member', 'address') && addr) want.shareAddress = addr;
        if (allows('member', 'spouse') && spouse) want.shareSpouse = spouse;
        // Settings → Who can see what → Care groups: Church Partners see which group everyone in the directory is in
        // … or which group each person is in, on their page in People (settings.careOnPeople)
        if (careForMembers(db.settings)) { var cg = careOf(pid); if (cg.length) want.care = cg; }
        // Birthday and wedding day (day and month only, never the year), so others can see 🎂 / 💍 on the day –
        // part of the Church directory consent; not for people who turned celebrations off (js/celebrate.js)
        if (typeof Celebrate !== 'undefined') Object.assign(want, Celebrate.forDirectory(p, p.lateSpouseId ? { id: p.lateSpouseId } : null));
      }
      if (!same(want, known('directory/' + pid))) { if (want) write('directory/' + pid, want); else del('directory/' + pid); }
      // Names only, for attendees: Church Partners (and staff) in the directory
      var nm = ok && (p.category === 'Church Partner' || p.category === 'Staff') ? { firstName: p.firstName || '', lastName: p.lastName || '', preferredName: p.preferredName || '' } : null;
      if (!same(nm, known('names/' + pid))) { if (nm) write('names/' + pid, nm); else del('names/' + pid); }
      // Every adult's name, for Midweek Group leaders adding people (Administrators and Pastors keep it)
      if (is('admin', 'pastor') && !previewRole) {
        var pk = pickable(p) ? { firstName: p.firstName || '', lastName: p.lastName || '', preferredName: p.preferredName || '' } : null;
        if (!same(pk, known('pickNames/' + pid))) { if (pk) write('pickNames/' + pid, pk); else del('pickNames/' + pid); }
      }
      var lead = {};
      if (ok && addr && (allows('rosters', 'address') || allows('kids', 'address'))) lead.shareAddress = addr;
      if (ok && spouse && (allows('rosters', 'spouse') || allows('kids', 'spouse'))) lead.shareSpouse = spouse;
      if (!Object.keys(lead).length) lead = null;
      if (!same(lead, known('contacts/' + pid))) { if (lead) write('contacts/' + pid, lead); else del('contacts/' + pid); }
    }
    /** Someone a Midweek Group's leader may add: an adult who is still at the church. */
    function pickable(p) {
      return !!p && p.active !== false && p.familyRole !== 'child' && p.category !== 'Deceased' && !p.binnedAt && !p.mergedInto && p.firstName !== 'Deleted';
    }
    /** Administrators and Pastors: who leads a Midweek Group (lifeLeaders/all), so the rules let them read every adult's name. */
    function syncLifeLeaders() {
      if (!is('admin', 'pastor') || previewRole) return;
      var ids = [];
      list('lifeGroups').forEach(function (g) { (g.leaderIds || []).forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); }); });
      ids.sort();
      var was = known('lifeLeaders/all');
      if (!same(ids, (was && was.ids) || [])) write('lifeLeaders/all', { ids: ids });
      // The first leader: everyone's name is filled in once (afterwards each change to a person keeps it in step)
      if (ids.length && !Object.keys(raw.pickNames || {}).length && !Object.keys(local).some(function (k) { return k.indexOf('pickNames/') === 0; })) resyncDirectory();
    }
    /** Do Church Partners (Basic access) see anyone's care groups: all groups on the Care groups page, or a person's groups on
     *  their page in People? Then each directory entry carries the person's groups (names only). */
    function careForMembers(st) { st = st || {}; return (st.seeCare || []).indexOf('member') >= 0 || careOnPeople(st); }
    /** Someone's care groups for the directory: [{ id, name, carer }] (names only – the cards stay with the group). */
    function careOf(pid) {
      return list('careGroups').filter(function (g) { return (g.memberIds || []).indexOf(pid) >= 0; }).map(function (g) {
        var c = { id: g.id, name: g.name || '' }; if ((g.leaderIds || []).indexOf(pid) >= 0) c.carer = true; return c;
      }).sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
    }
    /** "12 Oak Street, Howick, 3290" from the home address fields (empty when there is none or it can't be read). */
    function addressOf(p) { return window.PeopleParts && PeopleParts.addressLines ? PeopleParts.addressLines(p).join(', ') : ''; }
    /** Their spouse or partner's name, from their household (Administrators and Pastors can work it out; anyone else keeps what is there). */
    function spouseOf(p, dirWas, leadWas) {
      if (is('admin', 'pastor') && window.Households) {
        var c = dirCtx ? dirCtx.couple[p.id] : Households.couples(list('people'), list('families')).filter(function (x) { return x.a === p.id || x.b === p.id; })[0];
        var o = c && get('people', c.a === p.id ? c.b : c.a);
        return o ? ((o.preferredName || o.firstName || '') + ' ' + (o.lastName || '')).trim() : '';
      }
      return (dirWas && dirWas.shareSpouse) || (leadWas && leadWas.shareSpouse) || '';
    }
    /** Administrators: bring everyone's shared contact details in line with Settings (after changing what each role sees). */
    /** Administrators and Pastors (Ministers): bring everyone's directory entry in line with Settings. Only entries that
     *  differ are written; one unusual record is skipped (and logged) rather than stopping the rest. */
    function resyncDirectory() {
      if (!is('admin', 'pastor') || previewRole) return 0;
      var n = 0, bad = 0;
      // Worked out once for everyone, not again for each person (with a thousand people that froze the phone for seconds)
      var ctx = { consent: {}, couple: {} };
      list('consents').forEach(function (c) {
        if (c.purpose !== DIRECTORY || c.withdrawnAt) return;
        var was = ctx.consent[c.personId]; if (!was || was.date < c.date) ctx.consent[c.personId] = c;
      });
      if (window.Households) Households.couples(list('people'), list('families')).forEach(function (x) { if (!ctx.couple[x.a]) ctx.couple[x.a] = x; if (!ctx.couple[x.b]) ctx.couple[x.b] = x; });
      dirCtx = ctx;
      try {
        list('people').forEach(function (p) { try { syncDirectory(p.id); n++; } catch (e) { bad++; console.warn('Couldn’t update the directory entry of ' + p.id, e); } });
      } finally { dirCtx = null; }
      if (bad) console.warn(bad + ' directory entries couldn’t be updated');
      return n;
    }
    /** Administrators give sign-in access from the person's record: roles/{email} = { role, personId }. */
    function syncRole(p, prev) {
      // No access, left the church or died: the phones linked by sign-in codes go too (Administrators)
      if (is('admin') && prev && roleOf(prev) && !roleOf(p)) codesDrop(p.id);
      var SMALL = ['rosters', 'kids', 'member'], small = function (x) { return !x || SMALL.indexOf(x) >= 0; };
      if (!is('admin') && (!small(p.appRole === 'none' ? '' : p.appRole) || !small(prev && prev.appRole === 'none' ? '' : prev && prev.appRole))) return;   // a Pastor with "access": the smaller roles only
      var email = mailOf(p), was = prev ? mailOf(prev) : '';
      var r = roleOf(p), wasR = prev ? roleOf(prev) : '';
      var langs = (p.reviewLangs || []).slice().sort().join(), wasLangs = ((prev && prev.reviewLangs) || []).slice().sort().join();
      var named = function (x) { return x ? ((x.firstName || '') + ' ' + (x.lastName || '')).trim() : ''; };
      if (r && prev && email === was && r === wasR && langs === wasLangs && named(p) === named(prev)) {
        // Nothing about their sign-in changed – unless what Pastors can do changed since it was written this session
        var had = r === 'pastor' ? local['roles/' + email] : null;
        if (!had || JSON.stringify(had) === JSON.stringify(clean(accessEntry(email, signers(email))))) return;
      }
      // Each address they have or had: write its sign-in again if they sign in with it (or did); otherwise only make sure
      // it isn't theirs – someone else may have ended their access first (e.g. a Pastor recording a death).
      [was, email].forEach(function (e, i) {
        if (!e || (i && e === was)) return;
        if ((r && e === email) || (wasR && e === was)) shareRole(e, p.id);
        else if (local['roles/' + e] !== null) dropRole(e, p.id);
      });
    }
    function mailOf(p) { return ((p && p.email) || '').trim().toLowerCase(); }
    function roleOf(p) { return p && p.appRole && p.appRole !== 'none' && p.active !== false ? p.appRole : ''; }
    /** Everyone who signs in with this email address (a couple often share one): strongest role first, at most 4. */
    var STRENGTH = ['admin', 'pastor', 'kids', 'rosters', 'member'];
    function signers(email) {
      return find('people', function (x) { return !!email && mailOf(x) === email && !!roleOf(x); }).sort(function (a, b) {
        return (STRENGTH.indexOf(roleOf(a)) - STRENGTH.indexOf(roleOf(b))) || (a.id < b.id ? -1 : 1);
      }).slice(0, MAX_SHARED);
    }
    /** The access-list entry for an email address: the first person's role as before; when several people share it,
     *  every role they have (roles, which the rules check), the others (also) and each person's own role (people). */
    function accessEntry(email, ps) {
      var first = ps[0], name = function (x) { return ((x.firstName || '') + ' ' + (x.lastName || '')).trim(); };
      var acc = { role: roleOf(first), personId: first.id, name: name(first) }, langs = [], can = [];
      var ls = (db.leave && db.leave.settings) || {}, people = {};
      ps.forEach(function (x) {
        var mine = { role: roleOf(x), name: name(x) }, l = (x.reviewLangs || []).slice().sort(), c = roleOf(x) === 'pastor' ? pastorCan(x.id) : [];
        if (l.length) mine.langs = l;   // languages they check (translations)
        if (c.length) mine.can = c;     // what Pastors can do (Settings), checked by the rules
        people[x.id] = mine;
        l.forEach(function (y) { if (langs.indexOf(y) < 0) langs.push(y); }); c.forEach(function (y) { if (can.indexOf(y) < 0) can.push(y); });
        if (ls.StandInID === x.id && ls.StandInFrom && ls.StandInTo) { acc.standInFrom = dayMs(ls.StandInFrom); acc.standInTo = dayMs(ls.StandInTo, true); }
      });
      if (langs.length) acc.langs = langs.sort();
      if (can.length) acc.can = can.sort();
      if (ps.length > 1) {
        acc.roles = []; ps.forEach(function (x) { if (acc.roles.indexOf(roleOf(x)) < 0) acc.roles.push(roleOf(x)); });
        acc.also = ps.slice(1).map(function (x) { return x.id; });
        acc.people = people;
      }
      return acc;
    }
    /** Write (or take away) the sign-in of an email address from everyone who uses it. Only removed if it was this
     *  person's, so saving someone without sign-in never removes their spouse's (or fails with "no permission"). */
    function shareRole(email, pid) {
      var ps = signers(email), path = 'roles/' + email;
      if (!ps.length) return dropRole(email, pid);
      writeRole(email, ps);
    }
    function writeRole(email, ps) {
      var path = 'roles/' + email, acc = accessEntry(email, ps);
      if (!is('admin') && (acc.roles || [acc.role]).some(function (x) { return ['admin', 'pastor'].indexOf(x) >= 0; })) {
        return err({ code: 'permission-denied' }, 'change a sign-in shared with a Pastor or Administrator – ask an Administrator');
      }
      if (local[path] && JSON.stringify(local[path]) === JSON.stringify(clean(acc))) return;
      write(path, acc);
    }
    function dropRole(email, pid) {
      var path = 'roles/' + email, ours = function (d) { return !d.personId || d.personId === pid || (d.also || []).indexOf(pid) >= 0; };
      // Theirs: removed – or, if others share it, written again without them
      var drop = function () { var ps = signers(email); if (ps.length) writeRole(email, ps); else del(path); };
      if (local[path]) { if (ours(local[path])) drop(); return; }   // written this session
      doc(path).get().then(function (s) {
        var d = s.exists ? s.data() || {} : null;
        if (d && ours(d)) drop();
      }, function (e) { console.error('check sign-in before removing it', e); });
    }
    /** What a Pastor can do (Settings): the Senior Pastor's own ticks (seniorCan), or the other Pastors' (pastorCan). */
    function pastorCan(pid) { return Access.pastorTicks(db.settings, pid); }   // js/access.js
    /** After an Administrator changes what Pastors can do, or who the Senior Pastor is: every Pastor's access-list entry gets the new ticks. */
    function syncPastors() {
      if (!is('admin')) return;
      var done = {};
      find('people', function (p) { return roleOf(p) === 'pastor' && p.email; }).forEach(function (p) {
        var email = mailOf(p); if (done[email]) return; done[email] = 1;
        write('roles/' + email, accessEntry(email, signers(email)));
      });
    }
    function putNotes(pid, c) {   // pastoral notes or church office notes: one document per person holding all their notes
      c = c || 'notes';
      var entries = find(c, function (n) { return n.personId === pid; }).map(function (n) { var e = copy(n); delete e.personId; return e; });
      if (entries.length) write(c + '/' + pid, { entries: entries }); else del(c + '/' + pid);
    }
    function put(c, obj, prev) {
      lastWrite = Date.now();
      stats.writes++;
      if (c === 'people') return putPerson(obj);
      if (c === 'careShare') { var d = copy(obj); delete d.groupId; delete d.personId; return write('careGroups/' + obj.groupId + '/share/' + obj.personId, d); }   // one card per group: id = group:person
      if (c === 'notes' || c === 'officeNotes') return putNotes(obj.personId, c);
      write(c + '/' + obj.id, obj);
      if (c === 'careGroups') careDirectory(prev, obj);
      if (c === 'leaderBodies') syncCouncilPreviewMembers(((prev && prev.memberIds) || []).concat(obj.memberIds || []));
      if (c === 'consents' && obj.purpose === DIRECTORY) syncDirectory(obj.personId);
    }
    function remove(c, prev) {
      if (c === 'careShare') return del('careGroups/' + prev.groupId + '/share/' + prev.personId);
      if (c === 'notes' || c === 'officeNotes') return putNotes(prev.personId, c);
      if (c === 'careGroups') { del(c + '/' + prev.id); careDirectory(prev, null); return; }
      if (c === 'people') { ['people', 'details', 'directory', 'pickNames', 'photos', 'officeNotes', 'idNumbers'].forEach(function (x) { del(x + '/' + prev.id); }); return; }
      if (c === 'archive') fileSave(prev.id, [], (prev.file && prev.file.parts) || 0).catch(function (e) { console.error('delete the file', e); });   // its file goes too
      if (c === 'leaderBodies') syncCouncilPreviewMembers(prev.memberIds || []);
      if (c === 'books' && prev.cover) del('covers/' + prev.id);   // and a library item's cover picture
      del(c + '/' + prev.id);
    }
    /** A care group changed: its people's directory entries show their groups (only where this person may write them). */
    function careDirectory(prev, now) {
      var ids = ((prev && prev.memberIds) || []).concat((now && now.memberIds) || []);
      ids.filter(function (x, i) { return ids.indexOf(x) === i; }).forEach(function (pid) { if (get('people', pid)) syncDirectory(pid); });
      if ((prev && prev.type === 'life') || (now && now.type === 'life')) syncLifeLeaders();
    }
    /** I opened a message: add me to its readBy (arrayUnion, so two people opening it at once don't undo each other). */
    function markRead(id) {
      var path = 'messages/' + id; if (local[path]) local[path] = Object.assign({}, local[path], { readBy: (local[path].readBy || []).concat([session.personId]) });
      return doc(path).update({ readBy: fb.firestore.FieldValue.arrayUnion(session.personId) }).catch(function (e) { console.error('markRead', e); });
    }
    /** A recipient's inbox received the message on this device. */
    function markDelivered(id) {
      var path = 'messages/' + id; if (local[path]) local[path] = Object.assign({}, local[path], { deliveredBy: (local[path].deliveredBy || []).concat([session.personId]) });
      return doc(path).update({ deliveredBy: fb.firestore.FieldValue.arrayUnion(session.personId) }).catch(function (e) { console.error('markDelivered', e); });
    }
    function unshare(gid, pid) { return del('careGroups/' + gid + '/share/' + pid); }
    /** Version history (history/{id}; firestore.rules okHist). saved(): a record as the database holds it (a person: their card and
     *  details together, never medical notes) – the "before" of a change, whatever the screen did to its copy. */
    function saved(c, id) {
      var o;
      if (c === 'people') { var card = known('people/' + id), det = known('details/' + id); if (!card && !det) return null; o = Object.assign({}, copy(det || {}), copy(card || {})); }
      else { var k = known(c + '/' + id); if (!k) return null; o = copy(k); }
      o.id = id; return o;
    }
    /** Only records the rules let this person keep versions of (Administrators and Pastors; roster coordinators services, positions and
     *  teams; anyone their own person record). Quiet: a version that can't be kept never stops the change itself or shows an error. */
    function historyMay(c, rid) {
      if (!session || previewRole) return false;
      if (is('admin', 'pastor')) return true;
      if (['services', 'positions', 'teams'].indexOf(c) >= 0) return is('rosters') || may('rosters');
      return c === 'people' && !!rid && rid === session.personId;
    }
    function historySave(e) {
      if (!historyMay(e.c, e.rid)) return Promise.resolve();
      lastWrite = Date.now(); stats.writes++;
      return doc('history/' + e.id).set(copy(e)).catch(function (x) { console.warn('history', x && (x.code || x.message)); });
    }
    function historyFor(c, rid) {
      return fs.collection('history').where('c', '==', c).where('rid', '==', rid).get()
        .then(function (snap) { return snap.docs.map(function (d) { var o = d.data() || {}; o.id = d.id; return o; }); });
    }
    function historyTidy(cut) {
      return fs.collection('history').where('at', '<', cut).limit(300).get().then(function (snap) {
        snap.docs.forEach(function (d) { doc('history/' + d.id).delete().catch(function () {}); }); return snap.docs.length;
      }, function (x) { console.warn('history tidy', x && (x.code || x.message)); return 0; });
    }
    function purge(pid) {
      ['medical', 'notes', 'directory', 'photos', 'officeNotes', 'idNumbers', 'appUse'].forEach(function (x) { if (is('admin') || ['medical', 'notes'].indexOf(x) >= 0) del(x + '/' + pid); });
      if (is('admin')) historyFor('people', pid).then(function (l) { l.forEach(function (e) { doc('history/' + e.id).delete().catch(function () {}); }); }, function () {});   // their earlier versions
    }
    /** How Church & Trellis is used (appUse/{personId}; js/usage.js, js/usage-record.js; POPIA "Usage").
     *  useAll: everyone's records, for the Usage page – Administrators and Pastors only, fetched when the page asks (never kept
     *  listening, so a busy Sunday doesn't redraw their screens, and nobody else downloads them).
     *  useSave: the person's own record, read and written in one step (two devices of the same person don't lose each other's
     *  counts). build(stored or null) gives the record to write. Quiet: a refusal or no signal is not shown to anyone. */
    function useAll() {
      return fs.collection('appUse').get().then(function (snap) { return snap.docs.map(function (d) { var o = d.data() || {}; o.id = d.id; return o; }); });
    }
    function useSave(pid, build) {
      if (!session || !pid || previewRole) return Promise.resolve(false);
      var ref = doc('appUse/' + pid);
      return fs.runTransaction(function (tx) {
        return tx.get(ref).then(function (snap) { tx.set(ref, build(snap.exists ? snap.data() : null)); });
      }).then(function () { return true; }, function (e) { console.warn('usage', e && (e.code || e.message)); return false; });
    }
    /** ID numbers: Administrators (and the person themself) only, fetched one at a time when someone asks to see one. */
    function idGet(pid) { return doc('idNumbers/' + pid).get().then(function (s) { return s.exists ? (s.data().value || '') : ''; }); }
    /** Every ID number at once, { personId: value } – only for an Administrator's advanced search on ID number (logged there). */
    function idAll() { return fs.collection('idNumbers').get().then(function (s) { var o = {}; s.docs.forEach(function (d) { o[d.id] = (d.data() || {}).value || ''; }); return o; }); }
    function idSet(pid, v) { return v ? write('idNumbers/' + pid, { value: v, updatedAt: now() }) : del('idNumbers/' + pid); }
    /** A person's photo (a small JPEG as a data: address), fetched only when it is shown. '' when there is none or it may not be seen. */
    function photoGet(pid) { return doc('photos/' + pid).get().then(function (s) { return s.exists ? (s.data().data || '') : ''; }, function () { return ''; }); }
    function photoSet(pid, data) { return data ? write('photos/' + pid, { data: data, updatedAt: now() }) : del('photos/' + pid); }
    /** A library item's cover picture (covers/{id}), and the library's policy (libraryPolicy/policy): fetched only when shown. */
    function coverGet(id) { return doc('covers/' + id).get().then(function (s) { return s.exists ? (s.data().data || '') : ''; }, function () { return ''; }); }
    function picsGet(id) { return doc('marketPhotos/' + id).get().then(function (s) { return s.exists ? (s.data().data || []) : []; }, function () { return []; }); }
    function picsSet(id, list) { return list && list.length ? write('marketPhotos/' + id, { data: list, updatedAt: now() }) : del('marketPhotos/' + id); }
    function coverSet(id, data) { return data ? write('covers/' + id, { data: data, updatedAt: now() }) : del('covers/' + id); }
    function policyGet() { return doc('libraryPolicy/policy').get().then(function (s) { return s.exists ? s.data() : null; }); }
    function policySet(p) { return p ? write('libraryPolicy/policy', p) : del('libraryPolicy/policy'); }
    /** What it takes to become a Church Partner (partnerInfo/requirements): fetched only when shown. */
    function reqGet() { return doc('partnerInfo/requirements').get().then(function (s) { return s.exists ? s.data() : null; }); }
    function reqSet(p) { return p ? write('partnerInfo/requirements', p) : del('partnerInfo/requirements'); }
    function auditEntry(entry) {
      var e = clean(entry); e.byEmail = session ? session.email : ''; e.ts = fb.firestore.FieldValue.serverTimestamp();
      fs.collection('audit').doc(entry.id).set(e).catch(function (x) { console.error('audit', x); });
    }
    function saveLeave() {
      var lv = db.leave; if (!lv) return;
      (lv.requests || []).forEach(function (r) {
        if (r.synthetic) return;
        var j = JSON.stringify(r), before = savedLeave.requests[r.id];
        if (j === before) return;
        savedLeave.requests[r.id] = j;
        write('leaveRequests/' + r.id, r);
        var wasApproved = before && JSON.parse(before).status === 'Approved';
        if (r.status === 'Approved') write('away/' + r.id, { personId: r.staffId, from: r.start, to: r.end });
        else if (wasApproved) del('away/' + r.id);
      });
      if (may('leave')) {   // Administrators, and Pastors with the leave tick
        (lv.adjustments || []).forEach(function (a) { var j = JSON.stringify(a); if (j !== savedLeave.adjustments[a.id]) { savedLeave.adjustments[a.id] = j; write('leaveAdjustments/' + a.id, a); } });
        var conf = leaveConfig(lv);
        if (JSON.stringify(conf) !== savedLeave.config) { savedLeave.config = JSON.stringify(conf); write('leave/config', withAutoApprove(conf)); }
      }
    }
    function leaveConfig(lv) { return { settings: lv.settings, rules: lv.rules, terms: lv.terms, types: lv.types, levels: lv.levels, holidays: lv.holidays }; }
    /** The security rules need to know which leave types are approved automatically. */
    function withAutoApprove(conf) {
      var c = copy(conf); c.autoApprove = (c.types || []).filter(function (t) { return t.needsApproval === false; }).map(function (t) { return t.code; }); return c;
    }

    /** First Administrator: create the church settings, leave rules, starter teams and their own person record. */
    function setup(info, sampleFactory) {
      var t = sampleFactory(), batch = fs.batch(), pid = session.personId || uid('pe');
      var set = function (path, data) { batch.set(doc(path), clean(data)); };
      if (info.churchName) {
        var st = copy(t.settings); st.demo = false; st.churchName = info.churchName;
        st.informationOfficer = { name: '', email: '', phone: '', deputy: '', registered: false };   // no demo placeholders
        st.privacyNotice = st.privacyNotice.replace(/Christ Church Howick/g, info.churchName) +
          ' Sign-in accounts (your email address) are managed by Google, which may store them outside South Africa.';
        set('settings/church', st);
        var lv = leaveConfig(t.leave); lv.settings.CompanyName = info.churchName; lv.terms = [];
        set('leave/config', withAutoApprove(lv));
        t.teams.forEach(function (x) { set('teams/' + x.id, x); });
        t.positions.forEach(function (x) { set('positions/' + x.id, x); });
      }
      var person = { firstName: info.firstName, lastName: info.lastName, preferredName: '', familyId: '', familyRole: 'adult', category: 'Staff',
        email: session.email, mobile: '', active: true, appRole: 'admin', source: 'manual', createdAt: now(), updatedAt: now() };
      set('people/' + pid, person);
      set('details/' + pid, { keyDates: [], familyRole: 'adult' });
      set('roles/' + session.email, { role: 'admin', personId: pid, name: info.firstName + ' ' + info.lastName });
      var e = { at: now(), who: info.firstName + ' ' + info.lastName, action: info.churchName ? 'Set up Church & Trellis' : 'Created own person record', target: 'settings', byEmail: session.email, ts: fb.firestore.FieldValue.serverTimestamp() };
      batch.set(fs.collection('audit').doc(uid('au')), e);
      return batch.commit().then(function () { session.personId = pid; stop(); subscribe(); });
    }

    /** The Elvanto robot's sign-in (Administrators): roles/{email} = { role: 'robot', uid } – it can only use the Elvanto list. */
    function setRobot(email, uid, oldEmail) {
      email = String(email || '').trim().toLowerCase(); oldEmail = String(oldEmail || '').trim().toLowerCase();
      if (oldEmail && oldEmail !== email) del('roles/' + oldEmail);
      if (email && uid) return write('roles/' + email, { role: 'robot', uid: String(uid).trim(), name: 'Elvanto robot' });
      return Promise.resolve();
    }
    function requestLibraryLoan(bookId, id, loan) {
      var bookRef = doc('books/' + bookId), loanRef = doc('loans/' + id);
      return fs.runTransaction(function (tx) {
        return tx.get(bookRef).then(function (snap) {
          if (!snap.exists) throw new Error('This item is no longer in the library.');
          var book = snap.data(), copies = Math.max(1, +book.copies || 1), out = Math.max(0, +book.out || 0);
          if (book.removed || book.repairing || out >= copies) throw new Error('Every copy is on loan.');
          tx.set(loanRef, clean(loan));
          tx.update(bookRef, { out: out + 1, lastClaimId: id });
          return { loan: Object.assign({}, clean(loan), { id: id }), book: Object.assign({}, book, { id: bookId, out: out + 1, lastClaimId: id }) };
        });
      }).catch(function (e) { err(e, 'request a library item'); throw e; });
    }
    function verifyLibraryLoan(id, approved, today, verifiedBy) {
      var loanRef = doc('loans/' + id);
      return fs.runTransaction(function (tx) {
        return tx.get(loanRef).then(function (snap) {
          if (!snap.exists || snap.data().status !== 'pending' || snap.data().back) throw new Error('This checkout is no longer waiting for verification.');
          var loan = snap.data(), bookRef = doc('books/' + loan.bookId);
          if (approved) {
            var accepted = { status: 'approved', verifiedAt: new Date().toISOString(), verifiedBy: verifiedBy || '' };
            tx.update(loanRef, accepted);
            return { loan: Object.assign({ id: id }, loan, accepted), book: null };
          }
          return tx.get(bookRef).then(function (bookSnap) {
            var rejected = { status: 'rejected', verifiedAt: new Date().toISOString(), verifiedBy: verifiedBy || '', back: today, mobile: '' };
            tx.update(loanRef, rejected);
            var book = bookSnap.exists ? bookSnap.data() : null, updated = null;
            if (book) {
              updated = Object.assign({}, book, { out: Math.max(0, (+book.out || 0) - 1) });
              tx.update(bookRef, { out: updated.out });
            }
            return { loan: Object.assign({ id: id }, loan, rejected), book: updated && Object.assign({ id: loan.bookId }, updated) };
          });
        });
      }).catch(function (e) { err(e, 'verify this checkout'); throw e; });
    }
    return { claimCode: claimCode, confirmCode: confirmCode, begin: begin, signInPin: signInPin, cancelCode: cancelCode, isCodeSession: isCodeSession, codeGive: codeGive, devicesOf: devicesOf, deviceRemove: deviceRemove, codesDrop: codesDrop,
      choose: choose, household: household, boot: boot, google: google, emailLink: emailLink, finishEmailLink: finishEmailLink, isEmailLink: isEmailLink, pendingEmail: pendingEmail, signOut: signOut, setup: setup, setRobot: setRobot,
      stats: function () { return JSON.parse(JSON.stringify(stats)); },
      aiAsk: aiAsk,
      put: put, remove: remove, purge: purge, saved: saved, historySave: historySave, historyFor: historyFor, historyTidy: historyTidy, useAll: useAll, useSave: useSave, unshare: unshare, markRead: markRead, markDelivered: markDelivered, resyncDirectory: resyncDirectory, syncPastors: syncPastors, setStandIn: setStandIn, audit: auditEntry, saveLeave: saveLeave, write: write, patch: patch, migrateBrochure: migrateBrochure, clearLegacyBrochure: clearLegacyBrochure, photoGet: photoGet, coverGet: coverGet, coverSet: coverSet, picsGet: picsGet, picsSet: picsSet, policyGet: policyGet, reqGet: reqGet, reqSet: reqSet, policySet: policySet, fileSave: fileSave, fileLoad: fileLoad, filePreviewLoad: filePreviewLoad, applicationDocumentSave: applicationDocumentSave, applicationDocumentRemove: applicationDocumentRemove, applicationDocumentFile: applicationDocumentFile, idAll: idAll, photoSet: photoSet, idGet: idGet, idSet: idSet,
      requestLibraryLoan: requestLibraryLoan, verifyLibraryLoan: verifyLibraryLoan,
      /** Resolves once everything written so far has reached the database (at most `ms` milliseconds, e.g. when offline). */
      /** "View as": load what that role would see (an Administrator only; '' = back to normal). */
      preview: function () { stop(); subscribe(); },
      whenSaved: function (ms) { return fs && !offlineNow() ? Promise.race([fs.waitForPendingWrites().catch(function () {}), new Promise(function (r) { setTimeout(r, ms || 60000); })]) : Promise.resolve(); },
      session: function () { return session; } };
  })();

  /** Administrators, after changing what each role sees of other people: rewrite the shared contact details (live only). */
  function resyncDirectory() { return LIVE ? Live.resyncDirectory() : 0; }
  /** What Pastors can do changed: copy it onto every Pastor's access-list entry (live only; the demo has no rules). */
  function syncPastors() { if (LIVE) Live.syncPastors(); }
  /** The stand-in leave approver's dates, for the database rules (live only). */
  function setStandIn(pid, from, to) { if (LIVE && !blocked()) Live.setStandIn(pid, from, to); }
  /** About → Speed check: loading and update counts (live mode), and how many records each list holds. */
  function stats() {
    var out = LIVE && Live.stats ? Live.stats() : {};
    out.counts = {}; COLLECTIONS.forEach(function (c) { var n = all(c).length; if (n) out.counts[c] = n; });
    return out;
  }
  /** Settings → Who can see what: Church Partners (Basic access) see which care group someone is in, on their page in People.
   *  Not chosen yet (before 0.44): the same as "All groups: see who is in each group", as it was then. */
  function careOnPeople(st) { st = st || {}; return st.careOnPeople === undefined ? (st.seeCare || []).indexOf('member') >= 0 : !!st.careOnPeople; }
  /** Ask in your own words, with AI: switched on in Settings → Apps, set up (a reCAPTCHA key in firebase-config.js), live and online. */
  function aiReady() { if (!LIVE || !cfg.appCheckKey || !db || offline() || previewRole) return false; var st = settings() || {}; return !!(st.ai && st.ai.on); }
  function ai(body, ms) { var st = settings() || {}; return Live.aiAsk(body, (st.ai && st.ai.model) || (typeof AskAI !== 'undefined' ? AskAI.MODEL : 'gemini-3.5-flash-lite'), ms); }
  return { careOnPeople: function () { return careOnPeople(settings()); }, aiReady: aiReady, ai: ai, stats: stats, resyncDirectory: resyncDirectory, syncPastors: syncPastors, setStandIn: setStandIn, load: load, reset: reset, list: list, get: get, find: find, put: put, remove: remove, purge: purge, audit: audit, uid: uid, now: now,
    settings: settings, setSettings: setSettings, setAttendeeCan: setAttendeeCan, ministers: ministers, rosterTeam: rosterTeam, setRosterExtra: setRosterExtra, brochures: brochures, setBrochures: setBrochures, isAdmin: isAdmin, isPastor: isPastor, isRector: isRector, setLibrarians: setLibrarians, requestLibraryLoan: requestLibraryLoan, verifyLibraryLoan: verifyLibraryLoan, leave: leave, saveLeave: saveLeave, setUser: setUser, onChange: onChange, exportAll: exportAll,
    isLive: function () { return LIVE; }, defaultRole: defaultRole, version: version,
    /** Usage (js/usage-record.js, js/mod-usage.js): everyone's records (live: Administrators and Pastors only; demo: none) and
     *  the signed-in person's own record. Both resolve quietly – null / false when they can't. */
    onVersion: function (fn) { versionListeners.push(fn); }, versions: versions, historyCan: historyCan, asRestore: asRestore, historyTidy: historyTidy,
    usageAll: function () { return LIVE && !offline() ? Live.useAll().catch(function () { return null; }) : Promise.resolve(null); },
    usageSave: function (pid, build) { return LIVE && !offline() ? Live.useSave(pid, build) : Promise.resolve(false); },
    /** No internet (live mode only): Church & Trellis is view-only, showing the copy kept on this device. */
    offline: offline, OFFLINE_MSG: OFFLINE_MSG,
    /** The languages the signed-in person checks translations for (their access-list entry; none while viewing as someone else). */
    reviewLangs: function () {
      if (previewRole) return [];
      if (LIVE) return ((Live.session() || {}).langs || []).slice();
      var me = user && get('people', user.id); return ((me && me.reviewLangs) || []).slice();
    },
    /** The signed-in person opened these messages (ids): they count as read on every device, and the sender sees it.
     *  Not while viewing as someone else (an Administrator's looking doesn't count as the person reading). */
    markRead: function (ids, pid) {
      if (previewRole || !pid || (LIVE && offline())) return;
      var any = false;
      (ids || []).forEach(function (id) {
        var m = get('messages', id), office = m && m.kind === 'office' && m.fromId !== pid && (isAdmin() || isPastor());
        if (!m || (m.readBy || []).indexOf(pid) >= 0 || ((m.to || []).indexOf(pid) < 0 && !office)) return;
        m.readBy = (m.readBy || []).concat([pid]); any = true;
        if (LIVE) Live.markRead(id);
      });
      if (any) { save(); changed(); }
    },
    /** The signed-in person's device received these messages; only recipients and Office managers may mark them delivered. */
    markDelivered: function (ids, pid) {
      if (previewRole || !pid || (LIVE && offline())) return;
      var any = false;
      (ids || []).forEach(function (id) {
        var m = get('messages', id), office = m && m.kind === 'office' && m.fromId !== pid && (isAdmin() || isPastor());
        if (!m || (m.deliveredBy || []).indexOf(pid) >= 0 || ((m.to || []).indexOf(pid) < 0 && !office)) return;
        m.deliveredBy = (m.deliveredBy || []).concat([pid]); any = true;
        if (LIVE) Live.markDelivered(id);
      });
      if (any) { save(); changed(); }
    },
    /** Someone left a care group: their card there goes (careGroups/{gid}/share/{pid}). */
    careUnshare: function (gid, pid) {
      if (blocked()) return;
      db.careShare = all('careShare').filter(function (x) { return !(x.personId === pid && x.groupId === gid); });
      if (LIVE) Live.unshare(gid, pid); save(); changed();
    },
    /** "View as": an Administrator sees Church & Trellis as another role would (Pastor, Roster coordinator, Children's ministry, Member).
     *  Live, only what that role may load is loaded (less, never more: not pastoral or medical notes, which Administrators may not
     *  read). Nothing can be saved meanwhile. Not remembered: signing in again or refreshing returns to Administrator. */
    preview: function (r, careGroup) {
      if (arguments.length) {
        var was = previewRole, wasCare = previewCare; r = r === 'admin' ? '' : r || ''; careGroup = r ? careGroup || '' : '';
        // Administrators, and the Senior Pastor (Rector, Settings → What Pastors can do) – only for roles below their own
        var real = LIVE ? Live.session() || {} : {}, rector = real.role === 'pastor' && !!real.personId && real.personId === ((db.settings || {}).seniorPastorId || '');
        if (r && LIVE && real.role !== 'admin' && !(rector && r !== 'pastor')) return previewRole;
        if (r !== was || careGroup !== wasCare) {
          var who = function (x, g) { return g ? 'carer of the care group ' + ((get('careGroups', g) || {}).name || g) : x; };
          if (was) audit('Stopped viewing as ' + who(was, wasCare), 'settings');
          previewRole = ''; previewCare = '';
          if (r) audit('Started viewing Church & Trellis as ' + who(r, careGroup) + ' (nothing saved meanwhile)', 'settings');
          previewRole = r; previewCare = careGroup;
          if (LIVE) Live.preview(); else changed();
        }
      }
      return previewRole;
    },
    /** "View as" a carer: the care group being looked at ('' otherwise). */
    previewCare: function () { return previewCare; },
    whenSaved: function (ms) { return LIVE ? Live.whenSaved(ms) : Promise.resolve(); },
    /** Photos are kept apart from the person (photos/{id}) and fetched only when shown; the person's card says which version there is. */
    photo: function (pid) {
      if (LIVE) return Live.photoGet(pid);
      var x = ((db && db.photos) || []).filter(function (o) { return o.id === pid; })[0]; return Promise.resolve(x ? x.data : '');
    },
    /** A person's ID number (Administrators only; the person may see their own). Kept apart, never loaded with the rest. */
    /** Sign-in codes (Administrators): a new code for a person → { code, expires }; their PIN sign-ins; switch one off.
     *  The demo makes a code that can't be used (there is no sign-in in the demo). */
    codeGive: function (pid, name, mobile, dial) {
      if (blocked()) return Promise.reject(new Error('view only'));
      if (!isAdmin()) return Promise.reject(new Error('Only an Administrator can give sign-in codes.'));
      if (LIVE) return Live.codeGive(pid, name, mobile, dial);
      var A = '23456789ABCDEFGHJKMNPQRSTUVWXYZ', c = ''; for (var i = 0; i < 8; i++) c += A[Math.floor(Math.random() * A.length)];
      return Promise.resolve({ code: c, expires: Date.now() + 14 * 864e5 });
    },
    devicesOf: function (pid) { return LIVE && isAdmin() ? Live.devicesOf(pid) : Promise.resolve([]); },
    deviceRemove: function (uid) { if (blocked()) return Promise.reject(new Error('view only')); return LIVE ? Live.deviceRemove(uid) : Promise.resolve(); },
    idNumber: function (pid) {
      if (LIVE) return Live.idGet(pid);
      var x = ((db && db.idNumbers) || []).filter(function (o) { return o.id === pid; })[0]; return Promise.resolve(x ? x.value : '');
    },
    /** Every ID number, { personId: value }: Administrators only, for an advanced search on ID number – never kept or shown. */
    idNumbers: function () {
      if (LIVE) return Live.idAll();
      var o = {}; ((db && db.idNumbers) || []).forEach(function (x) { o[x.id] = x.value; }); return Promise.resolve(o);
    },
    setIdNumber: function (pid, v, auditText) {
      if (blocked()) return Promise.resolve();
      v = String(v || '').replace(/\s+/g, '');
      if (!LIVE) { db.idNumbers = (db.idNumbers || []).filter(function (o) { return o.id !== pid; }); if (v) db.idNumbers.push({ id: pid, value: v }); save(); }
      if (auditText) audit(auditText, 'people/' + pid);
      return LIVE ? Live.idSet(pid, v) : Promise.resolve();
    },
    setPhoto: function (pid, data, auditText) {
      if (blocked()) return Promise.resolve();
      var p = get('people', pid); if (!p) return Promise.resolve();
      p = copy(p); if (data) p.photo = now() + ' ' + Math.random().toString(36).slice(2, 6); else delete p.photo;
      var done = LIVE ? Live.photoSet(pid, data) : Promise.resolve((function () {
        db.photos = (db.photos || []).filter(function (o) { return o.id !== pid; }); if (data) db.photos.push({ id: pid, data: data });
      })());
      put('people', p, auditText);
      return done;
    },
    /** A library item's cover picture (a small JPEG as a data: address), fetched only when it is shown. '' when there is none. */
    cover: function (id) {
      if (LIVE) return Live.coverGet(id);
      var x = ((db && db.covers) || []).filter(function (o) { return o.id === id; })[0]; return Promise.resolve(x ? x.data : '');
    },
    /** Change a library item's cover ('' = take it away); the item records which version it has, so phones fetch the new one. */
    setCover: function (id, data, auditText) {
      if (blocked()) return Promise.resolve();
      var b = get('books', id); if (!b) return Promise.resolve();
      b = copy(b); if (data) b.cover = now() + ' ' + Math.random().toString(36).slice(2, 6); else delete b.cover;
      var done = LIVE ? Live.coverSet(id, data) : Promise.resolve((function () {
        db.covers = (db.covers || []).filter(function (o) { return o.id !== id; }); if (data) db.covers.push({ id: id, data: data });
      })());
      put('books', b, auditText);
      return done;
    },
    /** A Marketplace listing's photos (small JPEGs as data: addresses), fetched only when it is opened. [] when there are none. */
    listingPhotos: function (id) {
      if (LIVE) return Live.picsGet(id);
      var x = ((db && db.marketPhotos) || []).filter(function (o) { return o.id === id; })[0]; return Promise.resolve(x ? (x.data || []).slice() : []);
    },
    /** Change a listing's photos ([] = none). Saved after the listing itself (the rules check who posted it). */
    setListingPhotos: function (id, list) {
      if (blocked()) return Promise.resolve();
      if (LIVE) return Live.picsSet(id, list || []);
      db.marketPhotos = (db.marketPhotos || []).filter(function (o) { return o.id !== id; }); if (list && list.length) db.marketPhotos.push({ id: id, data: list.slice() });
      save(); return Promise.resolve();
    },
    /** What it takes to become a Church Partner, for everyone to read: { text, link, name, type, data } or null.
     *  Written by Administrators, Pastors with the "settings" tick and the Senior Pastor (Rector). */
    partnerRequirements: function () {
      if (LIVE) return Live.reqGet().catch(function () { return null; });
      var x = db && db.partnerReq ? copy(db.partnerReq) : null;
      if (x && x.demoFile) { x.data = demoFiles.partnerReq || ''; delete x.demoFile; if (!x.data) { delete x.name; delete x.type; } }
      return Promise.resolve(x);
    },
    setPartnerRequirements: function (p, auditText) {
      if (blocked()) return Promise.reject(new Error('view only'));
      if (p) { p = copy(p); p.updatedAt = now(); p.by = user ? ((user.preferredName || user.firstName) + ' ' + user.lastName) : ''; }
      if (auditText) audit(auditText, 'partnerInfo/requirements');
      if (LIVE) return Live.reqSet(p);
      if (p && p.data && p.data.length > 400000) { demoFiles.partnerReq = p.data; p = copy(p); p.data = ''; p.demoFile = true; } else delete demoFiles.partnerReq;
      db.partnerReq = p; save(); changed(); return Promise.resolve();
    },
    /** The library's policy for everyone to read: { text, name, type, data } (an attached file as base64), or null. */
    libraryPolicy: function () {
      if (LIVE) return Live.policyGet().catch(function () { return null; });
      var x = db && db.libraryPolicy ? copy(db.libraryPolicy) : null;
      if (x && x.demoFile) { x.data = demoFiles.libraryPolicy || ''; delete x.demoFile; if (!x.data) { delete x.name; delete x.type; } }
      return Promise.resolve(x);
    },
    setLibraryPolicy: function (p, auditText) {
      if (blocked()) return Promise.reject(new Error('view only'));
      if (p) { p = copy(p); p.updatedAt = now(); p.by = user ? ((user.preferredName || user.firstName) + ' ' + user.lastName) : ''; }
      if (auditText) audit(auditText, 'libraryPolicy/policy');
      if (LIVE) return Live.policySet(p);
      if (p && p.data && p.data.length > 400000) { demoFiles.libraryPolicy = p.data; p = copy(p); p.data = ''; p.demoFile = true; } else delete demoFiles.libraryPolicy;   // the browser's storage is small
      db.libraryPolicy = p; save(); changed(); return Promise.resolve();
    },
    /** The Archive: a record's file as parts of base64 (js/archive.js). Kept apart from the record and fetched only when opened.
     *  The demo keeps files only until the page is closed (this browser's storage is too small for them). */
    saveFile: function (id, parts, had) {
      if (blocked()) return Promise.reject(new Error('view only'));
      if (!archiveCanManage()) { var denied = new Error('Missing or insufficient permissions.'); denied.code = 'permission-denied'; return Promise.reject(denied); }
      if (LIVE) return Live.fileSave(id, parts, had);
      demoFiles[id] = parts.slice(); if (!parts.length) delete demoFiles[id]; return Promise.resolve();
    },
    loadFile: function (id, n) {
      if (!archiveSees(get('archive', id))) { var denied = new Error('Missing or insufficient permissions.'); denied.code = 'permission-denied'; return Promise.reject(denied); }
      if (LIVE) return Live.fileLoad(id, n);
      return demoFiles[id] ? Promise.resolve(demoFiles[id].slice()) : Promise.reject(new Error('not kept'));
    },
    loadArchivePreview: function (id, n) {
      var record = get('archive', id);
      if (!archiveSees(record)) {
        var denied = new Error('Missing or insufficient permissions.'); denied.code = 'permission-denied'; return Promise.reject(denied);
      }
      if (LIVE) return Live.filePreviewLoad(id, n);
      return demoFiles[id] ? Promise.resolve(demoFiles[id].slice()) : Promise.reject(new Error('not kept'));
    },
    publishApplicationDocument: function (record) {
      if (blocked()) return Promise.reject(new Error('view only'));
      if (!isAdmin()) return Promise.reject(new Error('Only an Administrator can publish a document to the membership form.'));
      var r = copy(record), old = get('applicationDocuments', r.id), data = { title: r.title, date: r.date || '', link: r.link || '',
        fileName: r.file ? r.file.name : '', fileType: r.file ? r.file.type || '' : '', parts: r.file ? +r.file.parts || 0 : 0,
        fileVersion: r.file && r.file.parts ? uid('apv') : '' };
      var loaded = r.file && r.file.parts ? Store.loadFile(r.id, r.file.parts) : Promise.resolve([]);
      return loaded.then(function (parts) {
        if (LIVE) return Live.applicationDocumentSave(r.id, data, parts, old || {});
        db.applicationDocuments = all('applicationDocuments').filter(function (x) { return x.id !== r.id; }).concat([Object.assign({ id: r.id }, data)]);
        save(); changed(); return undefined;
      });
    },
    removeApplicationDocument: function (id, parts) {
      if (blocked()) return Promise.reject(new Error('view only'));
      if (!isAdmin()) return Promise.reject(new Error('Only an Administrator can remove a document from the membership form.'));
      var old = get('applicationDocuments', id) || { parts: parts || 0, fileVersion: '' };
      if (LIVE) return Live.applicationDocumentRemove(id, old);
      db.applicationDocuments = all('applicationDocuments').filter(function (x) { return x.id !== id; });
      save(); changed(); return Promise.resolve();
    },
    loadApplicationDocumentFile: function (id) {
      var doc = get('applicationDocuments', id);
      if (!doc || !doc.parts) return Promise.reject(new Error('This document has no published file.'));
      if (LIVE) {
        if (!doc.fileVersion) return Promise.reject(new Error('The published file is not available.'));
        return Live.applicationDocumentFile(id, doc.fileVersion, doc.parts);
      }
      return demoFiles[id] ? Promise.resolve(demoFiles[id].slice()) : Promise.reject(new Error('The demo keeps files only until you close the page.'));
    },
    /** A small setting kept on this device only (e.g. the language), also before signing in. Not church data. */
    pref: function (k, v) {
      try { if (arguments.length > 1) localStorage.setItem('church_hub_pref_' + k, v); return localStorage.getItem('church_hub_pref_' + k) || ''; } catch (e) { return ''; }
    },
    onRemoteChange: function (fn) { remoteListeners.push(fn); }, onError: function (fn) { errorListeners.push(fn); },
    onLeaveChange: function (fn) { leaveHooks.push(fn); },
    setRobot: function (email, uid, oldEmail) { if (blocked()) return Promise.resolve(); return LIVE ? Live.setRobot(email, uid, oldEmail) : Promise.resolve(); },
    live: { claimCode: Live.claimCode, confirmCode: Live.confirmCode, begin: Live.begin, signInPin: Live.signInPin, cancelCode: Live.cancelCode, isCodeSession: Live.isCodeSession,
      choose: Live.choose, household: Live.household, boot: Live.boot, google: Live.google, emailLink: Live.emailLink, finishEmailLink: Live.finishEmailLink, isEmailLink: Live.isEmailLink, pendingEmail: Live.pendingEmail, signOut: Live.signOut,
      setup: Live.setup, session: Live.session } };
})();
