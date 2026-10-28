/*
 * A stand-in for the Firebase library, used only by tests/app.test.js to run Church Hub's live mode in a browser
 * without the internet. It keeps documents in memory and refuses every read and write that firestore.rules refuses,
 * using a copy of those rules written in JavaScript (POLICY below). Keep POLICY in step with firestore.rules;
 * the real rules are tested separately by tests/rules.test.mjs against Google's emulator.
 */
(function () {
  'use strict';
  var docs = {}, listeners = [], authCbs = [], currentUser = null;
  var F = window.__fake = { docs: docs, denied: [], sentLinks: [], credentials: [], linkSignIns: [], nextUser: null, pending: 0,
    seed: function (all) { Object.keys(all).forEach(function (k) { docs[k] = JSON.parse(JSON.stringify(all[k])); }); },
    setUser: function (u) { currentUser = u; } };

  /* ---------- the rules, in JavaScript ---------- */
  var ANY = ['admin', 'pastor', 'rosters', 'kids', 'member'], STAFF = ['admin', 'pastor', 'rosters', 'kids'];
  function ctx() {
    var email = currentUser ? String(currentUser.email).toLowerCase() : '', r = email ? docs['roles/' + email] : null;
    return { signedIn: !!(currentUser && currentUser.emailVerified), email: email, role: r ? r.role : '', me: r && r.personId ? r.personId : '',
      robot: !!(currentUser && r && r.role === 'robot' && r.uid && r.uid === currentUser.uid) };
  }
  function is(c, list) { return c.signedIn && !!c.role && list.indexOf(c.role) >= 0; }
  function mine(c, pid) { return is(c, ANY) && c.me !== '' && pid === c.me; }
  function onlyChanges(b, a, keys) {
    var all = {}; Object.keys(b || {}).concat(Object.keys(a || {})).forEach(function (k) { all[k] = 1; });
    return Object.keys(all).every(function (k) { return JSON.stringify((b || {})[k]) === JSON.stringify((a || {})[k]) || keys.indexOf(k) >= 0; });
  }
  function onlyKeys(a, keys) { return Object.keys(a || {}).every(function (k) { return keys.indexOf(k) >= 0; }); }
  var KIDS_CONSENTS = ['Children’s medical notes', 'Photos'];
  function child(id) { return docs['people/' + id].familyRole === 'child'; }   // a missing person fails, as get() does in the rules
  var POLICY = {
    roles: { read: function (c, id) { return c.signedIn && (id === c.email || is(c, ['admin'])); },
      write: function (c, op, id, b, a) { return is(c, ['admin']) && (op === 'delete' || ANY.concat(['robot']).indexOf(a.role) >= 0); } },
    settings: { read: function (c) { return is(c, ANY) || c.robot; }, write: function (c) { return is(c, ['admin']); } },
    elvantoSync: { read: function (c, id, d) { return is(c, ['admin']) || c.robot || (!!d && mine(c, d.personId)); },
      write: function (c, op, id, b, a) {
        if (is(c, ['admin'])) return true;
        if (op === 'delete') return false;
        if (op === 'create') return mine(c, a.personId) && a.status === 'Waiting' && onlyKeys(a, ['personId', 'name', 'start', 'end', 'want', 'have', 'haveNote', 'status', 'note', 'createdAt', 'updatedAt']);
        if (mine(c, b.personId) && a.personId === b.personId && a.status === 'Waiting' && onlyChanges(b, a, ['name', 'start', 'end', 'want', 'status', 'note', 'updatedAt'])) return true;
        return c.robot && onlyChanges(b, a, ['status', 'note', 'have', 'haveNote', 'doneAt']);
      } },
    robotStatus: { read: function (c) { return is(c, ['admin']); }, write: function (c) { return c.robot; } },
    guardians: { read: function (c, id, d) { return is(c, ['admin', 'pastor', 'kids']) || (!!d && mine(c, d.adultId)); }, write: function (c) { return is(c, ['admin', 'pastor', 'kids']); } },
    noCollect: { read: function (c) { return is(c, ['admin', 'pastor', 'kids']); }, write: function (c) { return is(c, ['admin', 'pastor', 'kids']); } },
    people: { read: function (c, id) { return is(c, STAFF) || mine(c, id); },
      write: function (c, op, id, b, a) {
        if (op === 'delete') return is(c, ['admin']);
        return is(c, ['admin', 'pastor']) || (op === 'update' && mine(c, id) && onlyChanges(b, a, ['firstName', 'lastName', 'preferredName', 'email', 'mobile', 'photo', 'updatedAt']))
          || (op === 'update' && is(c, ['kids']) && b.familyRole === 'child' && onlyChanges(b, a, ['photo', 'updatedAt']));
      } },
    details: { read: function (c, id, d) { return is(c, ['admin', 'pastor']) || mine(c, id) || (is(c, ['kids']) && !!d && d.familyRole === 'child'); },
      write: function (c) { return is(c, ['admin', 'pastor']); } },
    medical: { read: function (c) { return is(c, ['kids']); }, write: function (c, op) { return is(c, op === 'delete' ? ['kids', 'admin'] : ['kids']); } },
    notes: { read: function (c) { return is(c, ['pastor']); }, write: function (c, op) { return is(c, op === 'delete' ? ['pastor', 'admin'] : ['pastor']); } },
    directory: { read: function (c) { return is(c, ANY); },
      write: function (c, op, id, b, a) { return (is(c, ['admin', 'pastor']) || mine(c, id)) && (op === 'delete' || onlyKeys(a, ['firstName', 'lastName', 'preferredName', 'mobile', 'photo'])); } },
    photos: { read: function (c, id) { return child(id) ? is(c, ['admin', 'pastor', 'kids']) : is(c, STAFF) || mine(c, id) || (is(c, ANY) && docs['directory/' + id] !== undefined); },
      write: function (c, op, id, b, a) {
        var who = is(c, ['admin', 'pastor']) || (child(id) ? is(c, ['kids']) : mine(c, id));
        return who && (op === 'delete' || (onlyKeys(a, ['data', 'updatedAt']) && typeof a.data === 'string' && a.data.length < 200000));
      } },
    families: { read: function (c) { return is(c, STAFF); }, write: function (c) { return is(c, ['admin', 'pastor']); } },
    consents: { read: function (c, id, d) { return is(c, ['admin', 'pastor']) || (!!d && mine(c, d.personId)) || (is(c, ['kids']) && !!d && KIDS_CONSENTS.indexOf(d.purpose) >= 0); },
      write: function (c, op, id, b, a) {
        if (op === 'delete') return is(c, ['admin']);
        if (is(c, ['admin', 'pastor'])) return true;
        return op === 'create' ? mine(c, a.personId) && a.method === 'Changed in the app' : mine(c, b.personId) && onlyChanges(b, a, ['withdrawnAt', 'updatedAt']);
      } },
    teams: 'catalogue', positions: 'catalogue', services: 'catalogue',
    skills: { read: function (c, id, d) { return is(c, STAFF) || (!!d && mine(c, d.personId)); }, write: function (c) { return is(c, ['admin', 'rosters']); } },
    assignments: { read: function (c, id, d) { return is(c, STAFF) || (!!d && mine(c, d.personId)); },
      write: function (c, op, id, b, a) {
        if (is(c, ['admin', 'rosters'])) return true;
        return op === 'update' && mine(c, b.personId) && onlyChanges(b, a, ['status', 'updatedAt']) && ['accepted', 'declined'].indexOf(a.status) >= 0;
      } },
    groups: { read: function (c, id, d) { return is(c, STAFF) || (mine(c, c.me) && !!d && d.memberIds.indexOf(c.me) >= 0); },
      write: function (c, op, id, b, a) {
        if (is(c, ['admin', 'rosters'])) return true;
        if (!mine(c, c.me)) return false;
        return (op === 'create' || b.memberIds.indexOf(c.me) >= 0) && (op === 'delete' || a.memberIds.indexOf(c.me) >= 0);
      } },
    serveOffers: { read: function (c, id, d) { return is(c, ['admin', 'rosters']) || (!!d && mine(c, d.personId)); },
      write: function (c, op, id, b, a) {
        if (is(c, ['admin', 'rosters'])) return true;
        if (op === 'delete') return mine(c, b.personId);
        return op === 'create' && mine(c, a.personId) && a.status === 'waiting' && ['join', 'change', 'stop'].indexOf(a.kind) >= 0
          && onlyKeys(a, ['personId', 'positionId', 'kind', 'frequency', 'note', 'status', 'createdAt', 'updatedAt']);
      } },
    blockouts: { read: function (c, id, d) { return is(c, STAFF) || (!!d && mine(c, d.personId)); },
      write: function (c, op, id, b, a) { return is(c, ['admin', 'rosters']) || mine(c, op === 'delete' ? b.personId : a.personId); } },
    away: { read: function (c) { return is(c, ANY); },
      write: function (c, op, id, b, a) { return is(c, ['admin']) || (op === 'delete' ? mine(c, b.personId) : mine(c, a.personId) && onlyKeys(a, ['personId', 'from', 'to'])); } },
    leave: { read: function (c) { return is(c, ANY); }, write: function (c) { return is(c, ['admin']); } },
    leaveRequests: { read: function (c, id, d) { return is(c, ['admin']) || (!!d && mine(c, d.staffId)); },
      write: function (c, op, id, b, a) {
        if (is(c, ['admin'])) return true;
        if (op === 'create') return mine(c, a.staffId) && (a.status === 'Pending' || (a.status === 'Approved' && ((docs['leave/config'] || {}).autoApprove || []).indexOf(a.type) >= 0));
        return op === 'update' && mine(c, b.staffId) && a.status === 'Cancelled' && onlyChanges(b, a, ['status', 'cancelledBy']);
      } },
    leaveAdjustments: { read: function (c, id, d) { return is(c, ['admin']) || (!!d && mine(c, d.staffId)); }, write: function (c) { return is(c, ['admin']); } },
    dsr: 'admin', breaches: 'admin',
    audit: { read: function (c) { return is(c, ['admin']); },
      write: function (c, op, id, b, a) { return op === 'create' && is(c, ANY) && a.byEmail === c.email && a.ts && a.ts.__serverTs === true; } }
  };
  function policy(coll) {
    var p = POLICY[coll];
    if (p === 'catalogue') return { read: function (c) { return is(c, ANY); }, write: function (c) { return is(c, ['admin', 'rosters']); } };
    if (p === 'admin') return { read: function (c) { return is(c, ['admin']); }, write: function (c) { return is(c, ['admin']); } };
    return p || { read: function () { return false; }, write: function () { return false; } };
  }
  // A rule that looks at a missing document fails (as in Firestore), hence the try/catch.
  function canRead(path, data) { var s = path.split('/'); try { return !!policy(s[0]).read(ctx(), s[1], data); } catch (e) { return false; } }
  function canWrite(op, path, before, after) { var s = path.split('/'); try { return !!policy(s[0]).write(ctx(), op, s[1], before, after); } catch (e) { return false; } }
  function denied(what) { F.denied.push(what); var e = new Error('Missing or insufficient permissions.'); e.code = 'permission-denied'; return e; }

  /* ---------- documents and queries ---------- */
  function serverTs(o) { Object.keys(o).forEach(function (k) { if (o[k] && o[k].__serverTs) o[k] = { seconds: Date.now() / 1000 }; }); return o; }
  function DocSnap(path) { var d = docs[path]; this.id = path.split('/')[1]; this.exists = d !== undefined; this.metadata = { hasPendingWrites: false }; this.data = function () { return d === undefined ? undefined : JSON.parse(JSON.stringify(d)); }; }
  function DocRef(path) { this.path = path; this.id = path.split('/')[1]; }
  DocRef.prototype.get = function () {
    var p = this.path;
    return new Promise(function (res, rej) { setTimeout(function () { canRead(p, docs[p]) ? res(new DocSnap(p)) : rej(denied('get ' + p)); }, 0); });
  };
  DocRef.prototype.set = function (data) { return apply([{ path: this.path, data: data }]); };
  DocRef.prototype.delete = function () { return apply([{ path: this.path, data: null }]); };
  DocRef.prototype.onSnapshot = function (cb, errCb) { return listen({ doc: this.path, cb: cb, err: errCb }); };
  function Query(coll, filters, order, lim) { this.coll = coll; this.filters = filters || []; this.order = order; this.lim = lim; }
  Query.prototype.where = function (f, op, v) { return new Query(this.coll, this.filters.concat([[f, op, v]]), this.order, this.lim); };
  Query.prototype.orderBy = function (f, dir) { return new Query(this.coll, this.filters, [f, dir], this.lim); };
  Query.prototype.limit = function (n) { return new Query(this.coll, this.filters, this.order, n); };
  Query.prototype.doc = function (id) { return new DocRef(this.coll + '/' + id); };
  Query.prototype.onSnapshot = function (cb, errCb) { return listen({ query: this, cb: cb, err: errCb }); };
  function matches(q, d) {
    return q.filters.every(function (f) { var v = d[f[0]]; return f[1] === '==' ? v === f[2] : f[1] === 'array-contains' ? Array.isArray(v) && v.indexOf(f[2]) >= 0 : false; });
  }
  function run(q) {
    var out = Object.keys(docs).filter(function (k) { return k.split('/')[0] === q.coll && matches(q, docs[k]); });
    // Like Firestore, a query is refused if it could return anything the reader may not see.
    var bad = out.filter(function (k) { return !canRead(k, docs[k]); });
    if (bad.length) throw denied('list ' + q.coll + ' ' + JSON.stringify(q.filters) + ' (e.g. ' + bad[0] + ')');
    if (q.order) out.sort(function (a, b) { var x = (docs[a][q.order[0]] || {}).seconds || 0, y = (docs[b][q.order[0]] || {}).seconds || 0; return q.order[1] === 'desc' ? y - x : x - y; });
    if (q.lim) out = out.slice(0, q.lim);
    return { docs: out.map(function (k) { return { id: k.split('/')[1], data: (function (d) { return function () { return JSON.parse(JSON.stringify(d)); }; })(docs[k]) }; }), metadata: { hasPendingWrites: false } };
  }
  function deliver(l) {
    try {
      if (l.doc) { if (!canRead(l.doc, docs[l.doc])) throw denied('listen ' + l.doc); l.cb(new DocSnap(l.doc)); }
      else l.cb(run(l.query));
    } catch (e) { if (e.code === 'permission-denied') { l.dead = true; if (l.err) l.err(e); } else throw e; }
  }
  function listen(l) { listeners.push(l); setTimeout(function () { if (!l.off) deliver(l); }, 0); return function () { l.off = true; }; }
  function apply(ops) {
    F.pending++;
    return new Promise(function (res, rej) {
      setTimeout(function () {
        setTimeout(function () { F.pending--; }, 0);
        for (var i = 0; i < ops.length; i++) {
          var o = ops[i], before = docs[o.path], after = o.data ? JSON.parse(JSON.stringify(o.data, function (k, v) { return v && v.__serverTs ? { __serverTs: true } : v; })) : null;
          var op = !o.data ? 'delete' : before === undefined ? 'create' : 'update';
          if (op === 'delete' && before === undefined && canWrite('delete', o.path, {}, null)) continue;
          if (!canWrite(op, o.path, before, after)) return rej(denied(op + ' ' + o.path));
        }
        ops.forEach(function (o) { if (o.data) docs[o.path] = serverTs(JSON.parse(JSON.stringify(o.data, function (k, v) { return v && v.__serverTs ? { __serverTs: true } : v; }))); else delete docs[o.path]; });
        res();
        listeners.forEach(function (l) { if (!l.off && !l.dead) deliver(l); });
      }, 0);
    });
  }

  /* ---------- the firebase global (compat API, only what Church Hub uses) ---------- */
  var fs = { doc: function (p) { return new DocRef(p); }, collection: function (c) { return new Query(c); },
    waitForPendingWrites: function () { return new Promise(function (r) { setTimeout(r, 20); }); },
    batch: function () { var ops = []; return { set: function (ref, data) { ops.push({ path: ref.path, data: data }); }, commit: function () { return apply(ops); } }; } };
  function notifyAuth() { authCbs.forEach(function (cb) { setTimeout(function () { cb(currentUser); }, 0); }); }
  var auth = {
    isSignInWithEmailLink: function (link) { return /[?&]mode=signIn(&|$)/.test(link || '') && /[?&]oobCode=/.test(link || ''); },
    signInWithCredential: function (cred) { F.credentials.push(cred && cred.idToken); currentUser = F.nextUser; notifyAuth(); return Promise.resolve({ user: currentUser }); },
    onAuthStateChanged: function (cb) { authCbs.push(cb); setTimeout(function () { cb(currentUser); }, 0); return function () {}; },
    signInWithPopup: function () { currentUser = F.nextUser; notifyAuth(); return Promise.resolve({ user: currentUser }); },
    signInWithRedirect: function () { return auth.signInWithPopup(); },
    sendSignInLinkToEmail: function (email) { F.sentLinks.push(email); return Promise.resolve(); },
    signInWithEmailLink: function (email, link) { F.linkSignIns.push([email, link]); if (F.nextUser) { currentUser = F.nextUser; notifyAuth(); } return Promise.resolve(); },
    signOut: function () { currentUser = null; notifyAuth(); return Promise.resolve(); }
  };
  function GoogleAuthProvider() {} GoogleAuthProvider.prototype.setCustomParameters = function () {};
  GoogleAuthProvider.credential = function (idToken) { return { providerId: 'google.com', idToken: idToken }; };
  var firestoreFn = function () { return fs; }; firestoreFn.FieldValue = { serverTimestamp: function () { return { __serverTs: true }; } };
  var authFn = function () { return auth; }; authFn.GoogleAuthProvider = GoogleAuthProvider;
  window.firebase = { apps: [], initializeApp: function (c) { this.apps.push(c); return {}; }, auth: authFn, firestore: firestoreFn };
})();
