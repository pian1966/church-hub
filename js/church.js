/* Church & Trellis – which church? (docs/architecture/TARGET.md section 2; task 010)
 *
 * One website can serve any church. Each church keeps its own Firebase project; this file decides, before js/store.js
 * loads, which church's project this page talks to. A church's own link carries its project id: …/?c=<projectId>.
 * The device remembers the choice, so the link is only needed once.
 *
 * Order (the first that gives a church wins):
 *   1. ?demo                          → the demo, as today (js/store.js already handles it).
 *   2. ?c=<projectId>                 → that church's saved connection, which also becomes this device's church.
 *                                       Not saved yet → "pending": a later step (task 011) fetches the church's public card.
 *                                       Until then the page falls through to the built-in connection.
 *   3. this device's church           → its saved connection.
 *   4. the built-in connection        → js/firebase-config.js (Christ Church Howick), so today's address and the
 *                                       installed Android app keep working unchanged.
 *   5. none                           → not live (later: the landing screen, task 014).
 *
 * The connection values are not passwords (see js/firebase-config.js). This is the only file that reads or writes the
 * church_hub_church: and church_hub_current keys. Pure functions take the address's search part and a storage object,
 * so tests/church.test.js runs them in Node.
 */
(function (root) {
  'use strict';
  var PREFIX = 'church_hub_church:', CURRENT = 'church_hub_current';
  var ID = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;   // a Firebase project id; anything else is ignored

  function validId(id) { return typeof id === 'string' && ID.test(id); }
  function usable(cfg) { return !!(cfg && typeof cfg === 'object' && cfg.apiKey && cfg.projectId); }

  function get(storage, key) { try { return storage ? storage.getItem(key) : null; } catch (e) { return null; } }
  function set(storage, key, value) { try { if (storage) storage.setItem(key, value); } catch (e) { /* private window */ } }
  function del(storage, key) { try { if (storage) storage.removeItem(key); } catch (e) { /* private window */ } }

  /** The value of one name in an address's search part ("?c=abc&x=1"), or null. */
  function param(search, name) {
    var parts = String(search || '').replace(/^\?/, '').split('&');
    for (var i = 0; i < parts.length; i++) {
      var kv = parts[i].split('='), k = kv[0];
      try { k = decodeURIComponent(k); } catch (e) { /* keep as it is */ }
      if (k !== name) continue;
      var v = kv.slice(1).join('=');
      try { v = decodeURIComponent(v.replace(/\+/g, ' ')); } catch (e) { /* keep as it is */ }
      return v;
    }
    return null;
  }
  function isDemo(search) { return /[?&]demo(=|&|$)/.test(String(search || '')); }

  /** A church's saved connection, or null. */
  function saved(storage, projectId) {
    if (!validId(projectId)) return null;
    var cfg = null;
    try { cfg = JSON.parse(get(storage, PREFIX + projectId) || 'null'); } catch (e) { cfg = null; }
    return usable(cfg) && cfg.projectId === projectId ? cfg : null;
  }

  /** Remember a church's connection on this device and make it this device's church. */
  function save(storage, projectId, config) {
    if (!validId(projectId) || !usable(config) || config.projectId !== projectId) return false;
    set(storage, PREFIX + projectId, JSON.stringify(config));
    set(storage, CURRENT, projectId);
    return true;
  }

  /** Forget a church on this device (and stop opening it by itself). */
  function forget(storage, projectId) {
    if (!validId(projectId)) return;
    del(storage, PREFIX + projectId);
    if (get(storage, CURRENT) === projectId) del(storage, CURRENT);
  }

  /** This device's church: its project id, or '' if none (or its connection is gone). */
  function current(storage) {
    var id = get(storage, CURRENT) || '';
    return saved(storage, id) ? id : '';
  }

  /** The churches remembered on this device (project ids, this device's church first). */
  function remembered(storage) {
    var out = [], cur = current(storage);
    if (cur) out.push(cur);
    try {
      for (var i = 0; storage && i < storage.length; i++) {
        var k = storage.key(i);
        if (k && k.indexOf(PREFIX) === 0) { var id = k.slice(PREFIX.length); if (id !== cur && saved(storage, id)) out.push(id); }
      }
    } catch (e) { /* storage closed */ }
    return out;
  }

  /** A church's own link: the website's address with ?c=<projectId>. */
  function link(origin, path, projectId) {
    if (!validId(projectId)) return '';
    return String(origin || '') + String(path || '/') + '?c=' + projectId;
  }

  /**
   * Which church this page should talk to.
   * → { mode: 'demo'|'live'|'pending'|'none', config, projectId, from }
   *   from: 'link' (?c= and saved), 'device' (this device's church), 'built-in' (js/firebase-config.js).
   */
  function resolve(search, storage, builtIn) {
    if (isDemo(search)) return { mode: 'demo', config: null, projectId: '', from: '' };
    var asked = param(search, 'c');
    if (asked !== null && validId(asked)) {
      var cfg = saved(storage, asked);
      if (cfg) { set(storage, CURRENT, asked); return { mode: 'live', config: cfg, projectId: asked, from: 'link' }; }
      if (usable(builtIn) && builtIn.projectId === asked) return { mode: 'live', config: builtIn, projectId: asked, from: 'built-in' };
      return { mode: 'pending', config: null, projectId: asked, from: '' };
    }
    var cur = current(storage);
    if (cur) return { mode: 'live', config: saved(storage, cur), projectId: cur, from: 'device' };
    if (usable(builtIn)) return { mode: 'live', config: builtIn, projectId: builtIn.projectId, from: 'built-in' };
    return { mode: 'none', config: null, projectId: '', from: '' };
  }

  var Church = { resolve: resolve, save: save, forget: forget, current: current, remembered: remembered, link: link, validId: validId, param: param };

  if (typeof module !== 'undefined' && module.exports) { module.exports = Church; return; }
  root.Church = Church;

  /* In the browser, before js/firebase-config.js: a saved church wins over the built-in connection (which keeps its ||).
   * The built-in connection isn't loaded yet, so it isn't passed in here: when nothing is saved, it simply takes over. */
  var store = null; try { store = root.localStorage; } catch (e) { store = null; }
  var r = resolve(root.location ? root.location.search : '', store, null);
  root.CHURCH_HUB_CHURCH = r;
  if (r.mode === 'live' && r.config) root.CHURCH_HUB_FIREBASE = r.config;
  else if (r.mode === 'pending') root.CHURCH_HUB_PENDING = r.projectId;
})(typeof window !== 'undefined' ? window : this);
