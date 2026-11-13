/*
 * Church Hub – data layer. All data goes through Store; modules never touch the browser storage or Firebase directly.
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
    'groups', 'blockouts', 'dsr', 'breaches', 'audit', 'elvantoSync', 'robotStatus', 'guardians', 'noCollect', 'serveOffers', 'officeNotes', 'elvantoFound', 'careGroups', 'careShare', 'words', 'wordIdeas', 'detailChanges', 'emailPrompts', 'messages', 'msgGroups', 'partnerApps', 'leaderBodies', 'archive', 'books', 'loans'];
  var listeners = [], remoteListeners = [], errorListeners = [], leaveHooks = [], user = null, demoFiles = {};
  var leaveSnap = {};   // each leave request as last saved, to tell what changed
  /** "View as": an Administrator looking at Church Hub as another role would see it. Nothing is saved while it is on. */
  var previewRole = '', previewCare = '', PREVIEW_MSG = 'You’re only viewing Church Hub as another role – nothing is saved. Switch back to Administrator to make changes.';
  function previewing() { if (!previewRole) return false; tell(PREVIEW_MSG); return true; }
  function tell(msg) { errorListeners.forEach(function (fn) { try { fn(msg); } catch (x) { console.error(x); } }); }
  /** No internet (live mode): Church Hub shows the copy kept on this device and is view-only – nothing can be changed,
   *  so nobody's change waits on a phone and later overwrites someone else's. The demo keeps working as normal. */
  var OFFLINE_MSG = 'You’re offline – Church Hub is view-only until you’re back online.', toldOffline = 0;
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
    save();
    return db;
  }
  function reset(sampleFactory) { if (LIVE) return; db = sampleFactory(); COLLECTIONS.forEach(function (c) { if (!db[c]) db[c] = []; }); snapLeave(); save(); changed(); }
  function snapLeave() { leaveSnap = {}; ((db && db.leave && db.leave.requests) || []).forEach(function (r) { if (!r.synthetic) leaveSnap[r.id] = JSON.stringify(r); }); }

  function all(c) { return (db && db[c]) || []; }
  /** Care groups and life groups (Bible studies, midweek groups) are kept together in careGroups – a life group has
   *  type 'life' – but handed out as two lists, so each page sees only its own kind; their cards likewise (careShare / lifeShare). */
  var KIND = { careGroups: ['careGroups', false], lifeGroups: ['careGroups', true], careShare: ['careShare', false], lifeShare: ['careShare', true] };
  function isLife(g) { return !!g && g.type === 'life'; }
  function lifeIds() { var m = {}; all('careGroups').forEach(function (g) { if (isLife(g)) m[g.id] = 1; }); return m; }
  function real(c) { return KIND[c] ? KIND[c][0] : c; }
  function list(c) {
    var k = KIND[c]; if (!k) return all(c);
    if (k[0] === 'careGroups') return all('careGroups').filter(function (g) { return isLife(g) === k[1]; });
    var life = lifeIds(); return all('careShare').filter(function (x) { return !!life[x.groupId] === k[1]; });
  }
  /** One record by id. Pages ask for thousands of these (a household, a position, a person), so each collection keeps a
   *  look-up table, made again when the collection's list is replaced or grows; a hit is checked against the list itself. */
  var byIdCache = {};
  function get(c, id) {
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
    if (!obj.id) obj.id = uid(c.slice(0, 2));
    if (c === 'lifeGroups') obj.type = 'life';
    c = real(c);
    var arr = all(c), i = arr.findIndex(function (x) { return x.id === obj.id; }), prev = i >= 0 ? copy(arr[i]) : null;
    obj.updatedAt = now();
    if (i >= 0) arr[i] = obj; else { obj.createdAt = obj.createdAt || now(); arr.push(obj); }
    if (LIVE) Live.put(c, obj, prev);
    if (auditText) audit(auditText, c + '/' + obj.id);
    save(); changed();
    return obj;
  }
  function remove(c, id, auditText) {
    if (blocked()) return;
    var prev = get(c, id); c = real(c);
    db[c] = all(c).filter(function (x) { return x.id !== id; });
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
    if (LIVE) Live.purge(personId);
    save();
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
  function brochures() { return isAdmin() ? db.brochures || {} : null; }
  function setBrochures(value, auditText) {
    if (blocked()) return false;
    if (!isAdmin()) { tell('Only Administrators can change brochure content.'); return false; }
    db.brochures = copy(value) || {};
    if (LIVE) Live.write('brochures/church', db.brochures);
    if (auditText) audit(auditText, 'brochures/church');
    save(); changed();
    return true;
  }
  /** Choose the library's librarians: only that one setting is written, so the Senior Pastor (who may change nothing else) can. */
  function setLibrarians(ids, auditText) {
    if (blocked()) return;
    db.settings.librarianIds = ids.slice();
    if (LIVE) Live.patch('settings/church', { librarianIds: ids.slice() });
    if (auditText) audit(auditText, 'settings');
    save(); changed();
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
  function exportAll() { return copy(db); }
  /** Role given to people added from now on: in the demo everyone can sign in; live, an Administrator gives access. */
  function defaultRole() { return LIVE ? 'none' : 'member'; }

  /* ================= live mode: Firebase ================= */
  var Live = (function () {
    var VERSION = '13.1.0';
    var SDK = ['app', 'auth', 'firestore'].map(function (m) { return 'https://www.gstatic.com/firebasejs/' + VERSION + '/firebase-' + m + '-compat.js'; });
    var EMAIL_KEY = 'church_hub_signin_email', WHO_KEY = 'church_hub_who:', OWNER_KEY = 'church_hub_offline_owner';
    // Fields that live in people/{id}; everything else (except medical) goes to details/{id}.
    var CARD = ['firstName', 'lastName', 'preferredName', 'familyId', 'householdIds', 'familyRole', 'category', 'email', 'mobile', 'active', 'appRole',
      'source', 'createdAt', 'updatedAt', 'archivedAt', 'deletedAt', 'photo', 'reviewLangs'];
    var DIRECTORY = 'Church directory';
    var fb = null, auth = null, fs = null, session = null, onState = null, unsubs = [], raw = {}, pending = 0, ready = false;
    /** For About → Speed check (Administrators): how long loading took and how much the database sent and was sent. */
    var stats = { start: 0, loaded: 0, snaps: 0, rebuilds: 0, rebuildMs: 0, slowestRebuild: 0, writes: 0, sizes: {} };
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
    function write(path, data) { local[path] = clean(data); return doc(path).set(clean(data)).catch(function (e) { delete local[path]; err(e, 'save this'); }); }
    /** Change only some fields of a document (for someone allowed to change only those, e.g. the Senior Pastor choosing librarians). */
    function patch(path, data) { return doc(path).update(clean(data)).catch(function (e) { err(e, 'save this'); }); }
    function clearLegacyBrochure() {
      var patch = {}; patch.brochures = fb.firestore.FieldValue.delete();
      return doc('settings/church').update(patch).catch(function (e) { err(e, 'move the brochure wording to its private settings'); });
    }
    function migrateBrochure(value) {
      return doc('brochures/church').set(clean(value)).then(clearLegacyBrochure, function (e) { err(e, 'move the brochure wording to its private settings'); });
    }
    function del(path) { local[path] = null; return doc(path).delete().catch(function (e) { delete local[path]; err(e, 'delete this'); }); }
    /** What the database holds for one document, as far as we know (our own unconfirmed writes count). */
    function known(path) {
      if (path in local) return local[path];
      var s = path.split('/'), from = { people: ['people'], details: ['details', 'detailsMe'], medical: ['medical'], directory: ['directory'] }[s[0]] || [s[0]];
      var m = merged.apply(null, from); return m[s[1]] === undefined ? null : m[s[1]];
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
     * Firebase AI Logic only answers apps that prove they are Church Hub (App Check, with a reCAPTCHA key in firebase-config.js).
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
    /** Send a request to Gemini's generateContent; resolves with its JSON reply (15 seconds at most). */
    function aiAsk(body, model) {
      if (!session || offlineNow()) return Promise.reject(new Error('offline'));
      var me = auth && auth.currentUser;
      return Promise.all([appCheck().then(function (ac) { return ac.getToken(false); }), me ? me.getIdToken() : Promise.resolve('')]).then(function (t) {
        if (!t[0] || !t[0].token) throw new Error('No App Check token');
        var h = { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.apiKey, 'X-Firebase-AppCheck': t[0].token, 'x-goog-api-client': 'gl-js/' + VERSION + ' fire/' + VERSION };
        if (t[1]) h.Authorization = 'Firebase ' + t[1];
        var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null, timer = ctl ? setTimeout(function () { ctl.abort(); }, 15000) : null;
        var url = 'https://firebasevertexai.googleapis.com/v1beta/projects/' + encodeURIComponent(cfg.projectId) + '/models/' + encodeURIComponent(model) + ':generateContent';
        return fetch(url, { method: 'POST', headers: h, body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined }).then(function (r) {
          clearTimeout(timer);
          if (!r.ok) return r.text().then(function (x) { throw new Error('Gemini ' + r.status + ': ' + String(x).slice(0, 300)); });
          return r.json();
        }, function (e) { clearTimeout(timer); throw e; });
      });
    }

    /* ---------- the copy kept on this device, for when there is no internet ---------- */
    /** Firestore keeps what this person may see on the device (IndexedDB), so Church Hub opens and shows it offline.
     *  It is wiped when they sign out, and before someone else signs in on the same device (docs/POPIA.md, Data on devices). */
    function openDb() {
      fs = fb.firestore();
      if (fs.enablePersistence) fs.enablePersistence({ synchronizeTabs: true }).catch(function (e) { console.warn('No offline copy on this device', e && e.code); });
    }
    function wipe() {
      try { localStorage.removeItem(OWNER_KEY); } catch (x) {}
      if (!fs || !fs.clearPersistence) return Promise.resolve();
      var old = fs;
      // Another Church Hub tab still open keeps the copy in use: it is wiped at the next sign-in instead (OWNER_KEY)
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
      onState({ stage: 'loading' });
      loadSdk(function (e) {
        if (e) return onState({ stage: 'error', message: 'Church Hub couldn’t connect. Check your internet connection and refresh the page.' });
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
          stop();
          if (u) startSession(u);
          else if (linkStage === 'needEmail') onState({ stage: 'needEmail' });
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
      stop();
      // Let the last saves (e.g. the "Signed out" audit entry) reach the database first – but don't wait forever offline.
      var flushed = fs ? Promise.race([fs.waitForPendingWrites().catch(function () {}), new Promise(function (r) { setTimeout(r, 3000); })]) : Promise.resolve();
      // A shared sign-in: the next person signing in on this device chooses again
      try { if (session && session.household.length) localStorage.removeItem(WHO_KEY + session.email); } catch (x) {}
      return flushed.then(function () { session = null; db = blank(); return auth ? auth.signOut() : null; }).then(wipe);
    }

    /* ---------- session: who is this, and what may they see ---------- */
    function startSession(u) {
      var email = (u.email || '').toLowerCase();
      onState({ stage: 'loading', email: email });
      if (!u.emailVerified) return onState({ stage: 'noAccess', email: email, reason: 'unverified' });
      // Offline: straight from the copy on this device (otherwise Firestore first waits to be sure there's no connection)
      var role = function () { return offlineNow() ? doc('roles/' + email).get({ source: 'cache' }).catch(function () { return doc('roles/' + email).get(); }) : doc('roles/' + email).get(); };
      ownCopy(email).then(role).then(function (snap) {
        if (!snap.exists) {   // their access was taken away: the copy on this device goes too
          if (!(snap.metadata && snap.metadata.fromCache)) wipe();
          return onState({ stage: 'noAccess', email: email });
        }
        var r = snap.data();
        session = { email: email, role: r.role, personId: r.personId || '', langs: r.langs || [], can: r.can || [], standInFrom: r.standInFrom || 0, standInTo: r.standInTo || 0, household: [] };
        // One sign-in shared by several people (one email address): they choose who is using Church Hub (remembered on this device)
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
          return doc('settings/church').get().then(function (st) { onState({ stage: 'setup', email: email, needChurch: !st.exists }); });
        }
        subscribe();
      }).catch(function (e) {
        onState(e && e.code === 'permission-denied' ? { stage: 'noAccess', email: email } : { stage: 'error', message: offlineNow() ?
          'You’re offline, and this device has no copy of Church Hub yet. Connect to the internet once, then it will open offline too.' :
          'Church Hub couldn’t load. Check your internet connection and refresh the page.' });
      });
    }

    /** Someone sharing the sign-in chose who they are (or switched): load Church Hub as that person. */
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
      var COLL = { leaveConfig: 'leave', detailsMe: 'details', consentsMe: 'consents', consentsMed: 'consents', consentsPhotos: 'consents', messagesTo: 'messages', messagesFrom: 'messages', leaderBodiesOpen: 'leaderBodies', leaderBodiesMine: 'leaderBodies', loansMe: 'loans' };
      var add = function (key, ref) { p.push({ key: key, ref: ref, coll: COLL[key] || key }); };
      var coll = function (c) { return fs.collection(c); }, own = function (c, field) { return fs.collection(c).where(field || 'personId', '==', me); };
      add('settings', doc('settings/church'));
      if (is('admin') && !previewRole) add('brochure', doc('brochures/church'));
      add('leaveConfig', doc('leave/config'));
      add('directory', coll('directory'));
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
      // Offers to serve: roster coordinators and Administrators answer them all; everyone else sees their own
      // ("View as" by the Rector: everyone's offers only if they may answer them themselves – the rules check their own sign-in)
      var realRoster = !previewRole || session.role === 'admin' || (session.can || []).indexOf('rosters') >= 0;
      add('serveOffers', (is('admin', 'rosters') || may('rosters')) && realRoster ? coll('serveOffers') : own('serveOffers'));
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
      if (may('privacy')) { ['dsr', 'breaches'].forEach(function (c) { add(c, coll(c)); }); add('audit', coll('audit').orderBy('ts', 'desc').limit(1000)); }
      if (may('settings')) add('emailPrompts', coll('emailPrompts'));
      if (may('leave')) { add('leaveRequests', coll('leaveRequests')); add('leaveAdjustments', coll('leaveAdjustments')); }
      else if (standingIn()) { add('leaveRequests', coll('leaveRequests')); add('leaveAdjustments', own('leaveAdjustments', 'staffId')); }
      else { add('leaveRequests', own('leaveRequests', 'staffId')); add('leaveAdjustments', own('leaveAdjustments', 'staffId')); }
      return p;
    }

    function subscribe() {
      db = blank(); raw = {}; ready = false; local = {};
      var sources = plan(); pending = sources.length;
      stats.start = Date.now(); stats.loaded = 0;
      sources.forEach(function (s) {
        var first = true;
        unsubs.push(s.ref.onSnapshot(function (snap) {
          var m = {};
          if (snap.docs) snap.docs.forEach(function (d) { m[d.id] = d.data(); });
          else if (snap.exists) m[snap.id] = snap.data();
          raw[s.key] = m; stats.snaps++; stats.sizes[s.key] = Object.keys(m).length;
          if (s.key === 'careGroups' && !is('admin', 'pastor')) shares(Object.keys(m));
          if (s.key === 'settings' || s.key.indexOf('leaderBodies') === 0) extras();
          if (s.key === 'settings') { careAll(m.church); if (!is('admin', 'pastor') && raw.careGroups) shares(Object.keys(raw.careGroups)); }
          if (!snap.metadata.hasPendingWrites) forget(s.coll);
          if (first) { first = false; if (--pending === 0) whenLoaded(); }
          else if (ready) { rebuild(); if (!snap.metadata.hasPendingWrites) remoteChanged(); }
        }, function (e) {
          console.error('Could not load ' + s.key, e);
          raw[s.key] = raw[s.key] || {};
          if (first) { first = false; if (--pending === 0) whenLoaded(); }
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
        var changed = function () { if (ready) { rebuild(); remoteChanged(); } };
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
        if (ready) { rebuild(); remoteChanged(); }
      }, function (e) { console.warn('Could not load every care group (re-publish the database rules?)', e && e.code); careAllSub = null; });
    }
    /** Lists that depend on the church's settings or on my leadership groups, so they can only be asked for once those
     *  are known. The Archive (only when it is switched on): Administrators and the Senior Pastor every record; everyone
     *  else what is for everyone, what is shown to them, their leadership groups' records, and (Pastors) the office's.
     *  The Library: a librarian who isn't an Administrator sees every loan. Each matches a rule in firestore.rules. */
    function myBodies() {
      var m = merged('leaderBodies', 'leaderBodiesMine'), me = session.personId;
      return Object.keys(m).filter(function (id) { return (m[id].memberIds || []).indexOf(me) >= 0; }).sort();
    }
    function extras() {
      if (!session || !fs) return;
      var st = (raw.settings && raw.settings.church) || {}, me = session.personId, want = {}, c = function (x) { return fs.collection(x); };
      if ((st.modules || {}).archive === true && me) {
        var senior = !previewRole && session.role === 'pastor' && st.seniorPastorId === me;
        if (is('admin') || senior) want['archive:'] = c('archive');
        else {
          want['archive:all'] = c('archive').where('access', '==', 'all');
          want['archive:me'] = c('archive').where('shownTo', '==', me);
          if (is('pastor')) want['archive:office'] = c('archive').where('access', '==', 'office');
          myBodies().forEach(function (g) { want['archive:g:' + g] = c('archive').where('bodyId', '==', g); });
        }
      }
      if (!is('admin') && !previewRole && me && (st.librarianIds || []).indexOf(me) >= 0) want['loans:all'] = c('loans');
      var gone = false;
      Object.keys(extraSubs).forEach(function (k) { if (!want[k]) { try { extraSubs[k](); } catch (e) {} delete extraSubs[k]; delete raw[k]; gone = true; } });
      if (gone && ready) { rebuild(); remoteChanged(); }
      Object.keys(want).forEach(function (k) {
        if (extraSubs[k]) return;
        extraSubs[k] = want[k].onSnapshot(function (snap) {
          var m = {}; snap.docs.forEach(function (d) { m[d.id] = d.data(); }); raw[k] = m;
          if (ready) { rebuild(); if (!snap.metadata.hasPendingWrites) remoteChanged(); }
        }, function (e) { console.warn('Could not load ' + k + ' (re-publish the database rules?)', e && e.code); delete extraSubs[k]; });
      });
    }
    function stopExtras() { Object.keys(extraSubs).forEach(function (k) { try { extraSubs[k](); } catch (e) {} }); extraSubs = {}; }
    /** A record's file, cut into parts (archive/{id}/parts/{n}); see js/archive.js. Unlike other saves these say when they fail. */
    function fileSave(id, parts, had) {
      var jobs = parts.map(function (data, i) { return doc('archive/' + id + '/parts/' + i).set({ data: data }); });
      for (var i = parts.length; i < (had || 0); i++) jobs.push(doc('archive/' + id + '/parts/' + i).delete());
      return Promise.all(jobs);
    }
    function fileLoad(id, n) {
      var jobs = []; for (var i = 0; i < n; i++) jobs.push(doc('archive/' + id + '/parts/' + i).get());
      return Promise.all(jobs).then(function (snaps) { return snaps.map(function (s) { if (!s.exists) throw new Error('A part of the file is missing'); return s.data().data || ''; }); });
    }
    function forget(coll) { Object.keys(local).forEach(function (k) { if (k.split('/')[0] === coll) delete local[k]; }); }
    function stop() { unsubs.forEach(function (u) { try { u(); } catch (e) {} }); unsubs = []; shares([]); careAll(null); stopExtras(); ready = false; }
    function remoteChanged() {
      clearTimeout(remoteTimer);
      remoteTimer = setTimeout(function () { remoteListeners.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } }); }, 300);
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
      ready = true; stats.loaded = Date.now();
      // My own directory entry shows my care groups when Settings asks for it (carers may have added me)
      var dirMe = (raw.directory || {})[session.personId];
      var careDir = careForMembers(db.settings) || Object.keys(raw.directory || {}).some(function (id) { return raw.directory[id].care; });
      if (!previewRole && !offlineNow() && (careDir || (dirMe && dirMe.care))) {
        // Administrators and Pastors: everyone's entry, in case a change was missed (e.g. saved before the rules allowed it)
        if (is('admin', 'pastor')) setTimeout(function () { if (ready && session && !offlineNow()) resyncDirectory(); }, 1500);
        else syncDirectory(session.personId);
      }
      onState({ stage: 'ready', person: meP, email: session.email, role: role() });
    }

    /* ---------- putting the pieces back together ---------- */
    function arr(key) { var m = raw[key] || {}; return Object.keys(m).map(function (id) { var o = copy(m[id]); o.id = id; return o; }); }
    function merged() { var out = {}; Array.prototype.slice.call(arguments).forEach(function (k) { var m = raw[k] || {}; Object.keys(m).forEach(function (id) { out[id] = m[id]; }); }); return out; }
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
        p.id = id;
        if (id === session.personId) p.appRole = role();     // the access list is the source of truth (or the role being viewed as)
        return p;
      });
      Object.keys(dir).forEach(function (id) {                     // members: other people come from the directory
        if (cards[id]) return;
        people.push(Object.assign({ id: id, familyId: '', familyRole: 'adult', category: '', email: '', active: true, inDirectory: true, appRole: 'member', keyDates: [] }, copy(dir[id])));
      });
      db.people = people;
      db.settings = raw.settings && raw.settings.church ? copy(raw.settings.church) : null;
      db.brochures = role() === 'admin' && raw.brochure && raw.brochure.church ? copy(raw.brochure.church) : {};
      if (db.settings) delete db.settings.brochures;
      ['families', 'teams', 'positions', 'services', 'skills', 'assignments', 'groups', 'blockouts', 'dsr', 'breaches', 'elvantoSync', 'robotStatus', 'elvantoFound', 'guardians', 'noCollect', 'serveOffers', 'detailChanges', 'emailPrompts', 'msgGroups', 'partnerApps', 'books'].forEach(function (c) { db[c] = arr(c); });
      [['leaderBodies', /^leaderBodies/], ['archive', /^archive:/], ['loans', /^loans/]].forEach(function (x) {   // each asked for in parts (plan(), extras())
        var all = merged.apply(null, Object.keys(raw).filter(function (k) { return x[1].test(k); }));
        db[x[0]] = Object.keys(all).map(function (id) { var o = copy(all[id]); o.id = id; return o; });
      });
      var cgs = merged('careGroupsAll', 'careGroups');   // my own groups, and every group when Settings allows (careAll)
      db.careGroups = Object.keys(cgs).map(function (id) { var o = copy(cgs[id]); o.id = id; return o; });
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
    }
    /** Keep the members' directory in step with consent: name and phone only, adults who agreed. */
    /** Contact details (consent "Church directory", shown as Contact details): what other people may see of someone who agreed.
     *  directory/{id} – everyone signed in: name and photo, plus what Settings lets Church Partners see (mobile, email,
     *  address, spouse). contacts/{id} – staff and leaders only: address and spouse, when Settings lets Roster coordinators
     *  or Children's ministry see them (they already read names, email and mobile from people/{id}). */
    function syncDirectory(pid) {
      if (!(is('admin', 'pastor') || pid === session.personId)) return;
      var p = get('people', pid), latest = find('consents', function (c) { return c.personId === pid && c.purpose === DIRECTORY && !c.withdrawnAt; })
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
      }
      if (!same(want, known('directory/' + pid))) { if (want) write('directory/' + pid, want); else del('directory/' + pid); }
      var lead = {};
      if (ok && addr && (allows('rosters', 'address') || allows('kids', 'address'))) lead.shareAddress = addr;
      if (ok && spouse && (allows('rosters', 'spouse') || allows('kids', 'spouse'))) lead.shareSpouse = spouse;
      if (!Object.keys(lead).length) lead = null;
      if (!same(lead, known('contacts/' + pid))) { if (lead) write('contacts/' + pid, lead); else del('contacts/' + pid); }
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
        var c = Households.couples(list('people'), list('families')).filter(function (x) { return x.a === p.id || x.b === p.id; })[0];
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
      list('people').forEach(function (p) { try { syncDirectory(p.id); n++; } catch (e) { bad++; console.warn('Couldn’t update the directory entry of ' + p.id, e); } });
      if (bad) console.warn(bad + ' directory entries couldn’t be updated');
      return n;
    }
    /** Administrators give sign-in access from the person's record: roles/{email} = { role, personId }. */
    function syncRole(p, prev) {
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
    function pastorCan(pid) {
      var st = db.settings || {}, senior = !!st.seniorPastorId && st.seniorPastorId === pid;
      return ((senior ? st.seniorCan : st.pastorCan) || []).slice().sort();
    }
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
      stats.writes++;
      if (c === 'people') return putPerson(obj);
      if (c === 'careShare') { var d = copy(obj); delete d.groupId; delete d.personId; return write('careGroups/' + obj.groupId + '/share/' + obj.personId, d); }   // one card per group: id = group:person
      if (c === 'notes' || c === 'officeNotes') return putNotes(obj.personId, c);
      write(c + '/' + obj.id, obj);
      if (c === 'careGroups') careDirectory(prev, obj);
      if (c === 'consents' && obj.purpose === DIRECTORY) syncDirectory(obj.personId);
    }
    function remove(c, prev) {
      if (c === 'careShare') return del('careGroups/' + prev.groupId + '/share/' + prev.personId);
      if (c === 'notes' || c === 'officeNotes') return putNotes(prev.personId, c);
      if (c === 'careGroups') { del(c + '/' + prev.id); careDirectory(prev, null); return; }
      if (c === 'people') { ['people', 'details', 'directory', 'photos', 'officeNotes', 'idNumbers'].forEach(function (x) { del(x + '/' + prev.id); }); return; }
      if (c === 'archive') fileSave(prev.id, [], (prev.file && prev.file.parts) || 0).catch(function (e) { console.error('delete the file', e); });   // its file goes too
      if (c === 'books' && prev.cover) del('covers/' + prev.id);   // and a library item's cover picture
      del(c + '/' + prev.id);
    }
    /** A care group changed: its people's directory entries show their groups (only where this person may write them). */
    function careDirectory(prev, now) {
      var ids = ((prev && prev.memberIds) || []).concat((now && now.memberIds) || []);
      ids.filter(function (x, i) { return ids.indexOf(x) === i; }).forEach(function (pid) { if (get('people', pid)) syncDirectory(pid); });
    }
    /** I opened a message: add me to its readBy (arrayUnion, so two people opening it at once don't undo each other). */
    function markRead(id) {
      var path = 'messages/' + id; if (local[path]) local[path] = Object.assign({}, local[path], { readBy: (local[path].readBy || []).concat([session.personId]) });
      return doc(path).update({ readBy: fb.firestore.FieldValue.arrayUnion(session.personId) }).catch(function (e) { console.error('markRead', e); });
    }
    function unshare(gid, pid) { return del('careGroups/' + gid + '/share/' + pid); }
    function purge(pid) { ['medical', 'notes', 'directory', 'photos', 'officeNotes', 'idNumbers'].forEach(function (x) { if (is('admin') || ['medical', 'notes'].indexOf(x) >= 0) del(x + '/' + pid); }); }
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
    function coverSet(id, data) { return data ? write('covers/' + id, { data: data, updatedAt: now() }) : del('covers/' + id); }
    function policyGet() { return doc('libraryPolicy/policy').get().then(function (s) { return s.exists ? s.data() : null; }); }
    function policySet(p) { return p ? write('libraryPolicy/policy', p) : del('libraryPolicy/policy'); }
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
      var e = { at: now(), who: info.firstName + ' ' + info.lastName, action: info.churchName ? 'Set up Church Hub' : 'Created own person record', target: 'settings', byEmail: session.email, ts: fb.firestore.FieldValue.serverTimestamp() };
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
    return { choose: choose, household: household, boot: boot, google: google, emailLink: emailLink, finishEmailLink: finishEmailLink, isEmailLink: isEmailLink, pendingEmail: pendingEmail, signOut: signOut, setup: setup, setRobot: setRobot,
      stats: function () { return JSON.parse(JSON.stringify(stats)); },
      aiAsk: aiAsk,
      put: put, remove: remove, purge: purge, unshare: unshare, markRead: markRead, resyncDirectory: resyncDirectory, syncPastors: syncPastors, setStandIn: setStandIn, audit: auditEntry, saveLeave: saveLeave, write: write, patch: patch, migrateBrochure: migrateBrochure, clearLegacyBrochure: clearLegacyBrochure, photoGet: photoGet, coverGet: coverGet, coverSet: coverSet, policyGet: policyGet, policySet: policySet, fileSave: fileSave, fileLoad: fileLoad, idAll: idAll, photoSet: photoSet, idGet: idGet, idSet: idSet,
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
  function ai(body) { var st = settings() || {}; return Live.aiAsk(body, (st.ai && st.ai.model) || (typeof AskAI !== 'undefined' ? AskAI.MODEL : 'gemini-3.5-flash-lite')); }
  return { careOnPeople: function () { return careOnPeople(settings()); }, aiReady: aiReady, ai: ai, stats: stats, resyncDirectory: resyncDirectory, syncPastors: syncPastors, setStandIn: setStandIn, load: load, reset: reset, list: list, get: get, find: find, put: put, remove: remove, purge: purge, audit: audit, uid: uid, now: now,
    settings: settings, setSettings: setSettings, brochures: brochures, setBrochures: setBrochures, isAdmin: isAdmin, setLibrarians: setLibrarians, leave: leave, saveLeave: saveLeave, setUser: setUser, onChange: onChange, exportAll: exportAll,
    isLive: function () { return LIVE; }, defaultRole: defaultRole, version: version,
    /** No internet (live mode only): Church Hub is view-only, showing the copy kept on this device. */
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
      if (previewRole || !pid) return;
      var any = false;
      (ids || []).forEach(function (id) {
        var m = get('messages', id); if (!m || (m.readBy || []).indexOf(pid) >= 0 || (m.to || []).indexOf(pid) < 0) return;
        m.readBy = (m.readBy || []).concat([pid]); any = true;
        if (LIVE) Live.markRead(id);
      });
      if (any) { save(); changed(); }
    },
    /** Someone left a care group: their card there goes (careGroups/{gid}/share/{pid}). */
    careUnshare: function (gid, pid) {
      if (blocked()) return;
      db.careShare = all('careShare').filter(function (x) { return !(x.personId === pid && x.groupId === gid); });
      if (LIVE) Live.unshare(gid, pid); save(); changed();
    },
    /** "View as": an Administrator sees Church Hub as another role would (Pastor, Roster coordinator, Children's ministry, Member).
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
          if (r) audit('Started viewing Church Hub as ' + who(r, careGroup) + ' (nothing saved meanwhile)', 'settings');
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
      if (LIVE) return Live.fileSave(id, parts, had);
      demoFiles[id] = parts.slice(); if (!parts.length) delete demoFiles[id]; return Promise.resolve();
    },
    loadFile: function (id, n) {
      if (LIVE) return Live.fileLoad(id, n);
      return demoFiles[id] ? Promise.resolve(demoFiles[id].slice()) : Promise.reject(new Error('not kept'));
    },
    /** A small setting kept on this device only (e.g. the language), also before signing in. Not church data. */
    pref: function (k, v) {
      try { if (arguments.length > 1) localStorage.setItem('church_hub_pref_' + k, v); return localStorage.getItem('church_hub_pref_' + k) || ''; } catch (e) { return ''; }
    },
    onRemoteChange: function (fn) { remoteListeners.push(fn); }, onError: function (fn) { errorListeners.push(fn); },
    onLeaveChange: function (fn) { leaveHooks.push(fn); },
    setRobot: function (email, uid, oldEmail) { if (blocked()) return Promise.resolve(); return LIVE ? Live.setRobot(email, uid, oldEmail) : Promise.resolve(); },
    live: { choose: Live.choose, household: Live.household, boot: Live.boot, google: Live.google, emailLink: Live.emailLink, finishEmailLink: Live.finishEmailLink, isEmailLink: Live.isEmailLink, pendingEmail: Live.pendingEmail, signOut: Live.signOut,
      setup: Live.setup, session: Live.session } };
})();
