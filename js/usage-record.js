/* Church & Trellis – noting how the app is used, on each person's own device, for the Usage page (js/mod-usage.js).
 * What is kept and why: docs/POPIA.md, "Usage". The record's shape and every rule about it are in js/usage.js (merge, partOf;
 * tested in tests/usage.test.js); the database rules (firestore.rules, appUse) let a person write only their own record, and
 * only Administrators and Pastors read everyone's.
 *
 * Gentle on data: one small write at most every 4 minutes while the app is open and on screen (that is how the Usage page knows
 * who is on right now), one when the app is put away, and nothing at all while it is hidden, offline, in the demo or while an
 * Administrator is viewing as someone else. Only which parts were opened and how often – never what was typed, searched, read
 * or who was messaged. */
var UsageRecord = (function () {
  'use strict';
  var WRITE_MS = 4 * 60 * 1000, NEW_SESSION_MS = 30 * 60 * 1000;
  var pid = '', pending = {}, lastWrite = 0, writing = false, hiddenAt = 0, started = false;

  function live() { return typeof Store !== 'undefined' && Store.isLive() && !Store.preview() && !!Hub.user(); }
  function visible() { return typeof document === 'undefined' || !document.hidden; }
  function online() { return typeof navigator === 'undefined' || navigator.onLine !== false; }
  function today() { return Hub.today(); }
  function day() { var d = today(); return pending[d] || (pending[d] = { n: 0, v: {} }); }
  function platform() {
    var standalone = false;
    try { standalone = window.navigator.standalone === true || !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches); } catch (e) { standalone = false; }
    return Usage.platformOf({ android: !!(window.ChurchHubApp && window.ChurchHubApp.googleSignIn), standalone: standalone });
  }
  function session() { if (pid && live()) day().n++; }
  function note(hash) { if (!pid || !live()) return; var id = Usage.partOf(hash); if (id) { var v = day().v; v[id] = (v[id] || 0) + 1; } }
  /** Puts back what could not be written, to go with the next write. */
  function keep(add) {
    Object.keys(add).forEach(function (d) {
      var o = pending[d] || (pending[d] = { n: 0, v: {} });
      o.n += add[d].n || 0; Object.keys(add[d].v || {}).forEach(function (id) { o.v[id] = (o.v[id] || 0) + add[d].v[id]; });
    });
  }
  /** Writes what has been gathered (and that the person is on now), if it is time, or now when `now` is set. */
  function flush(now) {
    if (!pid || writing || !live() || !online()) return Promise.resolve(false);
    if (!now && Date.now() - lastWrite < WRITE_MS) return Promise.resolve(false);
    var add = pending, who = pid, c = { id: who, today: today(), now: new Date().toISOString(), version: (window.ChurchHubVersion || {}).version, platform: platform() };
    pending = {}; writing = true; lastWrite = Date.now();
    return Store.usageSave(who, function (prev) { return Usage.merge(prev, add, c); }).then(function (ok) {
      writing = false; if (!ok) keep(add); return ok;
    });
  }

  /** Called once someone has signed in (and again when someone else on a shared sign-in is chosen). */
  function start(u) {
    if (!u || !u.id || typeof Store === 'undefined' || !Store.isLive() || Store.preview()) return;
    if (pid && pid !== u.id) flush(true);
    if (pid !== u.id) { pid = u.id; pending = {}; lastWrite = 0; session(); }
    note(location.hash); flush(true);
    if (started) return; started = true;
    window.addEventListener('hashchange', function () { note(location.hash); flush(false); });
    document.addEventListener('visibilitychange', function () {
      var soon = Date.now() - lastWrite >= 60 * 1000;   // flicking between apps doesn't write each time
      if (document.hidden) { hiddenAt = Date.now(); flush(soon || Object.keys(pending).length > 0); return; }
      if (hiddenAt && Date.now() - hiddenAt >= NEW_SESSION_MS) session();
      hiddenAt = 0; flush(soon);
    });
    setInterval(function () { if (visible()) flush(false); }, 60 * 1000);
  }
  return { start: start, flush: flush, WRITE_MS: WRITE_MS };
})();
