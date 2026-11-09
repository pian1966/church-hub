/*
 * Church Hub – works without the internet (view only).
 *
 * This "service worker" keeps a copy of Church Hub's own files (pages, scripts, styles, icons, the Firebase library and
 * the font) on the phone or computer, so Church Hub still opens when there is no connection. The church's information
 * itself is kept by Firebase's offline copy (js/store.js), which is wiped when someone signs out.
 *
 * Online, every file is fetched fresh first (so a new version shows at once) and the copy is updated; only when that
 * fails, or takes too long on a weak signal, is the copy used. Nothing else is touched: the database, sign-in and
 * GitHub go straight to the internet as before.
 *
 * The page sends the list of files it has loaded (js/app.js, keepFiles) so they are kept even after the very first visit.
 */
'use strict';
var CACHE = 'church-hub-files';
var SLOW_MS = 7000;   // a weak signal: after this long, use the copy (if there is one) and let the download finish in the background
var OUTSIDE = [/^https:\/\/www\.gstatic\.com\/firebasejs\//, /^https:\/\/fonts\.googleapis\.com\//, /^https:\/\/fonts\.gstatic\.com\//];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(['./', 'manifest.webmanifest'].map(function (u) { return keep(c, new URL(u, self.registration.scope).href); }));
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

/** One copy per file: Church Hub's own files without their ?v=…, the start page as index.html. */
function key(url) {
  var u = new URL(url);
  if (u.origin !== self.location.origin) return u.href;
  var p = u.pathname; if (/\/$/.test(p)) p += 'index.html';
  return u.origin + p;
}
function ours(url) { return new URL(url).origin === self.location.origin; }
function wanted(url) { return ours(url) || OUTSIDE.some(function (r) { return r.test(url); }); }
/** Keep a downloaded file. Our own files are read to the end first and only then swapped in: putting a file that is still
 *  downloading takes the old copy away at once, and if the connection drops halfway the file would be lost for offline use. */
function store(c, k, r) {
  if (r.type === 'opaque') return c.put(k, r).catch(function () {});
  if (!r.ok || r.redirected) return Promise.resolve();
  return r.blob().then(function (b) {
    return c.put(k, new Response(b, { status: r.status, statusText: r.statusText, headers: r.headers }));
  }).catch(function () {});
}
/** Fetch a file and keep it (outside files as the browser fetched them). Each file once at a time: the page may ask twice
 *  in quick succession, and two copies of the same file being swapped in at once can leave a gap. */
var keeping = {};
function keep(c, url) {
  var k = key(url); if (keeping[k]) return keeping[k];
  var req = ours(url) ? new Request(url, { cache: 'no-cache' }) : new Request(url, { mode: 'no-cors' });
  return (keeping[k] = fetch(req).then(function (r) { return store(c, k, r); }).catch(function () {})
    .then(function () { delete keeping[k]; }));
}

self.addEventListener('message', function (e) {
  var urls = (e.data && e.data.keep) || [];
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(urls.filter(wanted).map(function (u) {
      // Only what isn't kept yet (the first visit): after that, every visit refreshes what it uses
      return c.match(key(u)).then(function (have) { return have ? null : keep(c, u); });
    }));
  }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || req.cache === 'no-store' || !wanted(req.url)) return;   // e.g. "Check for updates": always the internet
  var k = key(req.url);
  e.respondWith(caches.open(CACHE).then(function (c) {
    return c.match(k).then(function (have) {
      // Outside files (the Firebase library, the font) don't change at the same address: the kept copy is used straight away
      if (have && !ours(req.url)) return have;
      var net = fetch(req).then(function (r) { if (!keeping[k]) e.waitUntil(store(c, k, r.clone())); return r; });
      // No copy found and no connection: look again for a few seconds (a copy being swapped in is briefly missing)
      if (!have) return net.catch(function (err) {
        var tries = 0;
        return (function again() {
          return new Promise(function (res) { setTimeout(res, 400); }).then(function () { return c.match(k); }).then(function (r) {
            if (r) return r; if (++tries < 8) return again(); throw err;
          });
        })();
      });
      var slow = new Promise(function (res) { setTimeout(function () { res(have); }, SLOW_MS); });
      e.waitUntil(net.catch(function () {}));
      return Promise.race([net.catch(function () { return have; }), slow]);
    });
  }));
});
