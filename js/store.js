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
    'groups', 'blockouts', 'dsr', 'breaches', 'audit', 'elvantoSync', 'robotStatus', 'guardians', 'noCollect', 'serveOffers', 'officeNotes', 'elvantoFound', 'careGroups', 'careShare'];
  var listeners = [], remoteListeners = [], errorListeners = [], leaveHooks = [], user = null;
  var leaveSnap = {};   // each leave request as last saved, to tell what changed
  /** "View as": an Administrator looking at Church Hub as another role would see it. Nothing is saved while it is on. */
  var previewRole = '', PREVIEW_MSG = 'You’re only viewing Church Hub as another role – nothing is saved. Switch back to Administrator to make changes.';
  function previewing() { if (!previewRole) return false; errorListeners.forEach(function (fn) { try { fn(PREVIEW_MSG); } catch (x) { console.error(x); } }); return true; }

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
  function blank() { var d = { version: 1, settings: null, leave: null }; COLLECTIONS.forEach(function (c) { d[c] = []; }); return d; }
  var db = LIVE ? blank() : null;

  /* ================= shared interface ================= */
  function save() { if (!LIVE) { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* private window: keep in memory */ } } }

  function load(sampleFactory) {
    try { db = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { db = null; }
    if (!db || !db.version) { db = sampleFactory(); save(); }
    COLLECTIONS.forEach(function (c) { if (!db[c]) db[c] = []; });
    snapLeave();
    return db;
  }
  function reset(sampleFactory) { if (LIVE) return; db = sampleFactory(); COLLECTIONS.forEach(function (c) { if (!db[c]) db[c] = []; }); snapLeave(); save(); changed(); }
  function snapLeave() { leaveSnap = {}; ((db && db.leave && db.leave.requests) || []).forEach(function (r) { if (!r.synthetic) leaveSnap[r.id] = JSON.stringify(r); }); }

  function list(c) { return (db && db[c]) || []; }
  function get(c, id) { return list(c).filter(function (x) { return x.id === id; })[0] || null; }
  function find(c, fn) { return list(c).filter(fn); }
  function put(c, obj, auditText) {
    if (previewing()) return obj;
    if (!obj.id) obj.id = uid(c.slice(0, 2));
    var arr = list(c), i = arr.findIndex(function (x) { return x.id === obj.id; }), prev = i >= 0 ? copy(arr[i]) : null;
    obj.updatedAt = now();
    if (i >= 0) arr[i] = obj; else { obj.createdAt = obj.createdAt || now(); arr.push(obj); }
    if (LIVE) Live.put(c, obj, prev);
    if (auditText) audit(auditText, c + '/' + obj.id);
    save(); changed();
    return obj;
  }
  function remove(c, id, auditText) {
    if (previewing()) return;
    var prev = get(c, id);
    db[c] = list(c).filter(function (x) { return x.id !== id; });
    if (LIVE && prev) Live.remove(c, prev);
    if (auditText) audit(auditText, c + '/' + id);
    save(); changed();
  }
  /** Delete a person's restricted information (medical and pastoral notes) – used for POPIA deletion requests.
   *  Works even for an Administrator, who cannot read these notes. */
  function purge(personId) {
    if (previewing()) return;
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
    if (previewing()) return;
    Object.assign(db.settings, patch);
    if (LIVE) Live.write('settings/church', db.settings);
    if (auditText) audit(auditText, 'settings');
    save(); changed();
  }
  function leave() { return db.leave; }
  /** Save leave. Tells onLeaveChange listeners which requests changed (e.g. to update Elvanto), unless opts.quiet (imports). */
  function saveLeave(auditText, opts) {
    if (previewing()) return;
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
  function changed() { listeners.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } }); }
  function exportAll() { return copy(db); }
  /** Role given to people added from now on: in the demo everyone can sign in; live, an Administrator gives access. */
  function defaultRole() { return LIVE ? 'none' : 'member'; }

  /* ================= live mode: Firebase ================= */
  var Live = (function () {
    var VERSION = '13.1.0';
    var SDK = ['app', 'auth', 'firestore'].map(function (m) { return 'https://www.gstatic.com/firebasejs/' + VERSION + '/firebase-' + m + '-compat.js'; });
    var EMAIL_KEY = 'church_hub_signin_email';
    // Fields that live in people/{id}; everything else (except medical) goes to details/{id}.
    var CARD = ['firstName', 'lastName', 'preferredName', 'familyId', 'householdIds', 'familyRole', 'category', 'email', 'mobile', 'active', 'appRole',
      'source', 'createdAt', 'updatedAt', 'archivedAt', 'deletedAt', 'photo'];
    var DIRECTORY = 'Church directory';
    var fb = null, auth = null, fs = null, session = null, onState = null, unsubs = [], raw = {}, pending = 0, ready = false;
    var savedLeave = { requests: {}, adjustments: {}, config: '' }, remoteTimer = null;
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
    function del(path) { local[path] = null; return doc(path).delete().catch(function (e) { delete local[path]; err(e, 'delete this'); }); }
    /** What the database holds for one document, as far as we know (our own unconfirmed writes count). */
    function known(path) {
      if (path in local) return local[path];
      var s = path.split('/'), from = { people: ['people'], details: ['details', 'detailsMe'], medical: ['medical'], directory: ['directory'] }[s[0]] || [s[0]];
      var m = merged.apply(null, from); return m[s[1]] === undefined ? null : m[s[1]];
    }
    function role() { return session ? previewRole || session.role : ''; }
    function is() { return Array.prototype.indexOf.call(arguments, role()) >= 0; }

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

    /* ---------- sign-in ---------- */
    function boot(stateFn) {
      onState = stateFn;
      onState({ stage: 'loading' });
      loadSdk(function (e) {
        if (e) return onState({ stage: 'error', message: 'Church Hub couldn’t connect. Check your internet connection and refresh the page.' });
        fb = window.firebase;
        if (!fb.apps.length) fb.initializeApp(cfg);
        auth = fb.auth(); fs = fb.firestore();
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
      return flushed.then(function () { session = null; db = blank(); return auth ? auth.signOut() : null; });
    }

    /* ---------- session: who is this, and what may they see ---------- */
    function startSession(u) {
      var email = (u.email || '').toLowerCase();
      onState({ stage: 'loading', email: email });
      if (!u.emailVerified) return onState({ stage: 'noAccess', email: email, reason: 'unverified' });
      doc('roles/' + email).get().then(function (snap) {
        if (!snap.exists) return onState({ stage: 'noAccess', email: email });
        var r = snap.data();
        session = { email: email, role: r.role, personId: r.personId || '' };
        if (!session.personId) {
          if (r.role !== 'admin') return onState({ stage: 'noAccess', email: email, reason: 'noPerson' });
          // An Administrator added by hand: set up the church only if nobody has yet, otherwise just their own record.
          return doc('settings/church').get().then(function (st) { onState({ stage: 'setup', email: email, needChurch: !st.exists }); });
        }
        subscribe();
      }).catch(function (e) {
        onState(e && e.code === 'permission-denied' ? { stage: 'noAccess', email: email } : { stage: 'error', message: 'Church Hub couldn’t load. Check your internet connection and refresh the page.' });
      });
    }

    /** What to load for each role – mirrors firestore.rules, so no request is refused. */
    function plan() {
      var me = session.personId, r = role(), staff = is('admin', 'pastor', 'rosters', 'kids'), p = [];
      var COLL = { leaveConfig: 'leave', detailsMe: 'details', consentsMe: 'consents', consentsMed: 'consents', consentsPhotos: 'consents' };
      var add = function (key, ref) { p.push({ key: key, ref: ref, coll: COLL[key] || key }); };
      var coll = function (c) { return fs.collection(c); }, own = function (c, field) { return fs.collection(c).where(field || 'personId', '==', me); };
      add('settings', doc('settings/church'));
      add('leaveConfig', doc('leave/config'));
      add('directory', coll('directory'));
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
      add('careGroups', is('admin', 'pastor') ? coll('careGroups') : coll('careGroups').where('memberIds', 'array-contains', me));
      // Offers to serve: roster coordinators and Administrators answer them all; everyone else sees their own
      add('serveOffers', is('admin', 'rosters') ? coll('serveOffers') : own('serveOffers'));
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
      if (r === 'admin') { add('elvantoSync', coll('elvantoSync')); add('robotStatus', coll('robotStatus')); add('elvantoFound', coll('elvantoFound')); }
      else add('elvantoSync', own('elvantoSync'));
      if (r === 'admin') {
        ['dsr', 'breaches'].forEach(function (c) { add(c, coll(c)); });
        add('leaveRequests', coll('leaveRequests')); add('leaveAdjustments', coll('leaveAdjustments'));
        add('audit', coll('audit').orderBy('ts', 'desc').limit(1000));
      } else {
        add('leaveRequests', own('leaveRequests', 'staffId')); add('leaveAdjustments', own('leaveAdjustments', 'staffId'));
      }
      return p;
    }

    function subscribe() {
      db = blank(); raw = {}; ready = false; local = {};
      var sources = plan(); pending = sources.length;
      sources.forEach(function (s) {
        var first = true;
        unsubs.push(s.ref.onSnapshot(function (snap) {
          var m = {};
          if (snap.docs) snap.docs.forEach(function (d) { m[d.id] = d.data(); });
          else if (snap.exists) m[snap.id] = snap.data();
          raw[s.key] = m;
          if (s.key === 'careGroups' && !is('admin', 'pastor')) shares(Object.keys(m));
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
    function shares(gids) {
      Object.keys(shareSubs).forEach(function (g) { if (gids.indexOf(g) < 0) { try { shareSubs[g](); } catch (e) {} delete shareSubs[g]; delete raw['share:' + g]; } });
      gids.forEach(function (g) {
        if (shareSubs[g]) return;
        shareSubs[g] = fs.collection('careGroups/' + g + '/share').onSnapshot(function (snap) {
          var m = {}; snap.docs.forEach(function (d) { m[d.id] = d.data(); }); raw['share:' + g] = m;
          if (ready) { rebuild(); remoteChanged(); }
        }, function (e) { console.error('Could not load care group ' + g, e); });
      });
    }
    function forget(coll) { Object.keys(local).forEach(function (k) { if (k.split('/')[0] === coll) delete local[k]; }); }
    function stop() { unsubs.forEach(function (u) { try { u(); } catch (e) {} }); unsubs = []; shares([]); ready = false; }
    function remoteChanged() {
      clearTimeout(remoteTimer);
      remoteTimer = setTimeout(function () { remoteListeners.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } }); }, 300);
    }
    function whenLoaded() {
      rebuild();
      var meP = get('people', session.personId);
      if (!db.settings && role() === 'admin') return onState({ stage: 'setup', email: session.email, needChurch: true });
      if (!db.settings) return onState({ stage: 'noAccess', email: session.email, reason: 'notReady' });
      if (!meP) return onState(role() === 'admin' ? { stage: 'setup', email: session.email } : { stage: 'noAccess', email: session.email, reason: 'noPerson' });
      ready = true;
      onState({ stage: 'ready', person: meP, email: session.email, role: role() });
    }

    /* ---------- putting the pieces back together ---------- */
    function arr(key) { var m = raw[key] || {}; return Object.keys(m).map(function (id) { var o = copy(m[id]); o.id = id; return o; }); }
    function merged() { var out = {}; Array.prototype.slice.call(arguments).forEach(function (k) { var m = raw[k] || {}; Object.keys(m).forEach(function (id) { out[id] = m[id]; }); }); return out; }
    function rebuild() {
      var details = merged('details', 'detailsMe'), med = raw.medical || {}, dir = raw.directory || {}, cards = raw.people || {};
      var people = Object.keys(cards).map(function (id) {
        var p = Object.assign({ keyDates: [] }, copy(details[id] || {}), copy(cards[id]));
        if (med[id]) p.medical = copy(med[id]);
        if (dir[id]) p.inDirectory = true;
        p.id = id;
        if (id === session.personId) p.appRole = role();     // the access list is the source of truth (or the role being viewed as)
        return p;
      });
      Object.keys(dir).forEach(function (id) {                     // members: other people come from the directory
        if (cards[id]) return;
        people.push(Object.assign({ id: id, familyId: '', familyRole: 'adult', category: 'Member', email: '', active: true, inDirectory: true, appRole: 'member', keyDates: [] }, copy(dir[id])));
      });
      db.people = people;
      db.settings = raw.settings && raw.settings.church ? copy(raw.settings.church) : null;
      ['families', 'teams', 'positions', 'services', 'skills', 'assignments', 'groups', 'blockouts', 'dsr', 'breaches', 'elvantoSync', 'robotStatus', 'elvantoFound', 'guardians', 'noCollect', 'serveOffers', 'careGroups'].forEach(function (c) { db[c] = arr(c); });
      db.careShare = [];
      Object.keys(raw).forEach(function (k) { if (k.indexOf('share:') === 0) { var g = k.slice(6); Object.keys(raw[k]).forEach(function (pid) { var o = copy(raw[k][pid]); o.id = pid; o.groupId = g; db.careShare.push(o); }); } });
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
      if (is('admin')) syncRole(p, was.card);
    }
    /** Keep the members' directory in step with consent: name and phone only, adults who agreed. */
    function syncDirectory(pid) {
      if (!(is('admin', 'pastor') || pid === session.personId)) return;
      var p = get('people', pid), latest = find('consents', function (c) { return c.personId === pid && c.purpose === DIRECTORY && !c.withdrawnAt; })
        .sort(function (a, b) { return a.date < b.date ? 1 : -1; })[0];
      var want = p && p.familyRole !== 'child' && p.active !== false && latest && latest.given ? { firstName: p.firstName || '', lastName: p.lastName || '', preferredName: p.preferredName || '', mobile: p.mobile || '' } : null;
      if (want && p.photo) want.photo = p.photo;
      if (same(want, known('directory/' + pid))) return;
      if (want) write('directory/' + pid, want); else del('directory/' + pid);
    }
    /** Administrators give sign-in access from the person's record: roles/{email} = { role, personId }. */
    function syncRole(p, prev) {
      var email = (p.email || '').trim().toLowerCase(), was = prev ? (prev.email || '').trim().toLowerCase() : '';
      var r = p.appRole && p.appRole !== 'none' && p.active !== false ? p.appRole : '';
      var wasR = prev && prev.appRole && prev.appRole !== 'none' && prev.active !== false ? prev.appRole : '';
      // Remove sign-in when the email changes or access ends – also if someone else (e.g. a Pastor recording a death) changed the record first.
      if (was && (was !== email || !r) && (wasR || local['roles/' + was] !== null)) del('roles/' + was);
      if (email && r && (email !== was || r !== wasR || !prev)) write('roles/' + email, { role: r, personId: p.id, name: (p.firstName + ' ' + p.lastName).trim() });
    }
    function putNotes(pid, c) {   // pastoral notes or church office notes: one document per person holding all their notes
      c = c || 'notes';
      var entries = find(c, function (n) { return n.personId === pid; }).map(function (n) { var e = copy(n); delete e.personId; return e; });
      if (entries.length) write(c + '/' + pid, { entries: entries }); else del(c + '/' + pid);
    }
    function put(c, obj, prev) {
      if (c === 'people') return putPerson(obj);
      if (c === 'careShare') { var d = copy(obj); delete d.groupId; if (prev && prev.groupId && prev.groupId !== obj.groupId) del('careGroups/' + prev.groupId + '/share/' + obj.id); return write('careGroups/' + obj.groupId + '/share/' + obj.id, d); }
      if (c === 'notes' || c === 'officeNotes') return putNotes(obj.personId, c);
      write(c + '/' + obj.id, obj);
      if (c === 'consents' && obj.purpose === DIRECTORY) syncDirectory(obj.personId);
    }
    function remove(c, prev) {
      if (c === 'careShare') return del('careGroups/' + prev.groupId + '/share/' + prev.id);
      if (c === 'notes' || c === 'officeNotes') return putNotes(prev.personId, c);
      if (c === 'people') { ['people', 'details', 'directory', 'photos', 'officeNotes', 'idNumbers'].forEach(function (x) { del(x + '/' + prev.id); }); return; }
      del(c + '/' + prev.id);
    }
    function unshare(gid, pid) { return del('careGroups/' + gid + '/share/' + pid); }
    function purge(pid) { ['medical', 'notes', 'directory', 'photos', 'officeNotes', 'idNumbers'].forEach(function (x) { if (is('admin') || ['medical', 'notes'].indexOf(x) >= 0) del(x + '/' + pid); }); }
    /** ID numbers: Administrators (and the person themself) only, fetched one at a time when someone asks to see one. */
    function idGet(pid) { return doc('idNumbers/' + pid).get().then(function (s) { return s.exists ? (s.data().value || '') : ''; }); }
    function idSet(pid, v) { return v ? write('idNumbers/' + pid, { value: v, updatedAt: now() }) : del('idNumbers/' + pid); }
    /** A person's photo (a small JPEG as a data: address), fetched only when it is shown. '' when there is none or it may not be seen. */
    function photoGet(pid) { return doc('photos/' + pid).get().then(function (s) { return s.exists ? (s.data().data || '') : ''; }, function () { return ''; }); }
    function photoSet(pid, data) { return data ? write('photos/' + pid, { data: data, updatedAt: now() }) : del('photos/' + pid); }
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
      if (is('admin')) {
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
    return { boot: boot, google: google, emailLink: emailLink, finishEmailLink: finishEmailLink, isEmailLink: isEmailLink, pendingEmail: pendingEmail, signOut: signOut, setup: setup, setRobot: setRobot,
      put: put, remove: remove, purge: purge, unshare: unshare, audit: auditEntry, saveLeave: saveLeave, write: write, photoGet: photoGet, photoSet: photoSet, idGet: idGet, idSet: idSet,
      /** Resolves once everything written so far has reached the database (at most `ms` milliseconds, e.g. when offline). */
      /** "View as": load what that role would see (an Administrator only; '' = back to normal). */
      preview: function () { stop(); subscribe(); },
      whenSaved: function (ms) { return fs ? Promise.race([fs.waitForPendingWrites().catch(function () {}), new Promise(function (r) { setTimeout(r, ms || 60000); })]) : Promise.resolve(); },
      session: function () { return session; } };
  })();

  return { load: load, reset: reset, list: list, get: get, find: find, put: put, remove: remove, purge: purge, audit: audit, uid: uid, now: now,
    settings: settings, setSettings: setSettings, leave: leave, saveLeave: saveLeave, setUser: setUser, onChange: onChange, exportAll: exportAll,
    isLive: function () { return LIVE; }, defaultRole: defaultRole,
    /** Someone left a care group: their card there goes (careGroups/{gid}/share/{pid}). */
    careUnshare: function (gid, pid) {
      if (previewing()) return;
      db.careShare = list('careShare').filter(function (x) { return !(x.id === pid && x.groupId === gid); });
      if (LIVE) Live.unshare(gid, pid); save(); changed();
    },
    /** "View as": an Administrator sees Church Hub as another role would (Pastor, Roster coordinator, Children's ministry, Member).
     *  Live, only what that role may load is loaded (less, never more: not pastoral or medical notes, which Administrators may not
     *  read). Nothing can be saved meanwhile. Not remembered: signing in again or refreshing returns to Administrator. */
    preview: function (r) {
      if (arguments.length) {
        var was = previewRole; r = r === 'admin' ? '' : r || '';
        if (r && LIVE && (Live.session() || {}).role !== 'admin') return previewRole;
        if (r !== was) { if (r) audit('Started viewing Church Hub as ' + r + ' (nothing saved meanwhile)', 'settings'); previewRole = r; if (!r) audit('Stopped viewing as ' + was, 'settings'); if (LIVE) Live.preview(); else changed(); }
      }
      return previewRole;
    },
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
    setIdNumber: function (pid, v, auditText) {
      if (previewing()) return Promise.resolve();
      v = String(v || '').replace(/\s+/g, '');
      if (!LIVE) { db.idNumbers = (db.idNumbers || []).filter(function (o) { return o.id !== pid; }); if (v) db.idNumbers.push({ id: pid, value: v }); save(); }
      if (auditText) audit(auditText, 'people/' + pid);
      return LIVE ? Live.idSet(pid, v) : Promise.resolve();
    },
    setPhoto: function (pid, data, auditText) {
      if (previewing()) return Promise.resolve();
      var p = get('people', pid); if (!p) return Promise.resolve();
      p = copy(p); if (data) p.photo = now() + ' ' + Math.random().toString(36).slice(2, 6); else delete p.photo;
      var done = LIVE ? Live.photoSet(pid, data) : Promise.resolve((function () {
        db.photos = (db.photos || []).filter(function (o) { return o.id !== pid; }); if (data) db.photos.push({ id: pid, data: data });
      })());
      put('people', p, auditText);
      return done;
    },
    /** A small setting kept on this device only (e.g. the language), also before signing in. Not church data. */
    pref: function (k, v) {
      try { if (arguments.length > 1) localStorage.setItem('church_hub_pref_' + k, v); return localStorage.getItem('church_hub_pref_' + k) || ''; } catch (e) { return ''; }
    },
    onRemoteChange: function (fn) { remoteListeners.push(fn); }, onError: function (fn) { errorListeners.push(fn); },
    onLeaveChange: function (fn) { leaveHooks.push(fn); },
    setRobot: function (email, uid, oldEmail) { if (previewing()) return Promise.resolve(); return LIVE ? Live.setRobot(email, uid, oldEmail) : Promise.resolve(); },
    live: { boot: Live.boot, google: Live.google, emailLink: Live.emailLink, finishEmailLink: Live.finishEmailLink, isEmailLink: Live.isEmailLink, pendingEmail: Live.pendingEmail, signOut: Live.signOut,
      setup: Live.setup, session: Live.session } };
})();
