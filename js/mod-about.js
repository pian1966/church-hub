/* Church Hub – About: for everyone. The version and its date, who made it, and a check for updates
 * (the website: js/version.js read again from the server; the Android app: the latest app on GitHub's Releases page). */
(function () {
  'use strict';
  var H = Hub, esc = H.esc, T = I18n.t, V = window.ChurchHubVersion || { version: '?', date: '', developer: '', repo: '' };
  var check = { state: '', web: '', app: '' };   // state: '' | checking | done | failed
  // Every time About is opened, check again (also when coming back to it)
  window.addEventListener('hashchange', function () { if (/^#\/about/.test(location.hash) && check.state !== 'checking') check.state = ''; });

  /** -1, 0 or 1: is version a older than, the same as, or newer than b? ("0.10.0" is newer than "0.9.3") */
  function cmp(a, b) {
    var x = String(a || '').split('.').map(Number), y = String(b || '').split('.').map(Number);
    for (var i = 0; i < Math.max(x.length, y.length); i++) { var d = (x[i] || 0) - (y[i] || 0); if (d) return d < 0 ? -1 : 1; }
    return 0;
  }
  /** The page's address without the ?u=… that Update now adds (other parts, like ?demo, stay). */
  function cleanSearch() { return location.search.replace(/([?&])u=\d+(&|$)/, function (m, a, b) { return b ? a : ''; }).replace(/^&/, '?'); }
  if (/[?&]u=\d+/.test(location.search)) { try { history.replaceState(history.state, '', location.pathname + cleanSearch() + location.hash); } catch (e) {} }
  function appVersion() { try { return window.ChurchHubApp && window.ChurchHubApp.version ? String(window.ChurchHubApp.version()) : ''; } catch (e) { return ''; } }
  function isoDate(d) { return /^\d{4}-\d{2}-\d{2}$/.test(d || '') ? H.fmt(d, true) : ''; }

  /** The website's version now (the file is fetched again, bypassing the browser's copy). */
  function latestWeb() {
    return fetch('js/version.js?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function (t) { var m = /version:\s*'(\d+(?:\.\d+)*)'/.exec(t); if (!m) throw new Error('no version'); return m[1]; });
  }
  /** The newest Android app on GitHub ("Church Hub for Android 1.0.16" → "1.0.16"). */
  function latestApp() {
    return fetch('https://api.github.com/repos/' + V.repo + '/releases/tags/android', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) { var m = /(\d+\.\d+\.\d+)/.exec(j.name || j.body || ''); return m ? m[1] : ''; });
  }
  function runCheck() {
    check = { state: 'checking', web: '', app: '' }; H.render();
    var app = appVersion();
    Promise.all([latestWeb(), app ? latestApp().catch(function () { return ''; }) : Promise.resolve('')]).then(function (r) {
      check = { state: 'done', web: r[0], app: r[1] }; H.render();
    }, function () { check = { state: 'failed', web: '', app: '' }; H.render(); });
  }

  function updatePanel() {
    var out = '', app = appVersion();
    if (check.state === 'checking') out = '<p class="muted">' + T('Checking…') + '</p>';
    else if (check.state === 'failed') out = '<p class="note bad">' + T('Couldn’t check for updates. Check your internet connection and try again.') + '</p>';
    else if (check.state === 'done') {
      var webNew = cmp(check.web, V.version) > 0, appNew = app && check.app && cmp(check.app, app) > 0;
      if (webNew) out += '<div class="note warn"><p style="margin:0 0 8px"><b>' + esc(T('Version {v} is ready.', { v: check.web })) + '</b></p><button class="btn small primary" data-act="about:reload">' + T('Update now') + '</button>' +
        '<p class="hint" style="margin:8px 0 0">' + T('If it still shows the old version, close Church Hub and open it again in a few minutes.') + '</p></div>';
      if (appNew) out += '<div class="note warn"><p style="margin:0 0 8px"><b>' + esc(T('Version {v} of the Android app is ready.', { v: check.app })) + '</b></p>' +
        '<a class="btn small primary" href="https://github.com/' + esc(V.repo) + '/releases/download/android/ChurchHub.apk" target="_blank" rel="noopener">' + T('Download the new app') + '</a></div>';
      if (!webNew && !appNew) out = '<p class="note ok">' + T('You have the latest version.') + '</p>';
    }
    return '<section class="panel"><h2>' + T('Updates') + '</h2>' + out +
      '<div class="btns" style="margin-top:12px"><button class="btn" data-act="about:check"' + (check.state === 'checking' ? ' disabled' : '') + '>' + T('Check for updates') + '</button></div></section>';
  }

  function render() {
    var st = Store.settings() || {}, app = appVersion(), when = isoDate(V.date);
    var dl = '<dt>' + T('Version') + '</dt><dd>' + esc(V.version) + '</dd>' +
      (when ? '<dt>' + T('Released') + '</dt><dd>' + esc(when) + '</dd>' : '') +
      (app ? '<dt>' + T('Android app') + '</dt><dd>' + esc(app) + '</dd>' : '') +
      (st.churchName ? '<dt>' + T('Made for') + '</dt><dd>' + esc(st.churchName) + '</dd>' : '') +
      '<dt>' + T('Developed by') + '</dt><dd>' + esc(V.developer) + '<span class="kv-sub">' + T('With help from Claude, an AI made by Anthropic') + '</span></dd>' +
      '<dt>' + T('Language') + '</dt><dd>' + esc(I18n.name ? I18n.name(I18n.get()) : I18n.get()) + '</dd>';
    return '<div class="page-head"><div><h1>' + T('About Church Hub') + '</h1><p class="lead">' + T('Church Hub keeps the church’s people, rosters, care groups and staff management in one place.') + '</p></div></div>' +
      '<div class="grid2"><section class="panel"><h2>Church Hub</h2><dl class="kv">' + dl + '</dl></section>' + updatePanel() +
      '<section class="panel"><h2>' + T('More') + '</h2><div class="list">' +
        '<a class="item" href="#" data-act="hub:notice"><span class="grow"><b>' + T('Privacy notice') + '</b></span></a>' +
        '<a class="item" href="https://github.com/' + esc(V.repo) + '/blob/main/docs/CHANGELOG.md" target="_blank" rel="noopener"><span class="grow"><b>' + T('What’s new') + '</b><small>' + T('Opens on GitHub') + '</small></span></a>' +
        '<a class="item" href="https://github.com/' + esc(V.repo) + '" target="_blank" rel="noopener"><span class="grow"><b>' + T('Source code') + '</b><small>' + T('Opens on GitHub') + '</small></span></a>' +
      '</div></section>' + brochures() + speedPanel() + '</div>';
  }

  /** Administrators: how fast Church Hub is on this computer or phone – to send to whoever looks after Church Hub when it
   *  feels slow. In English, like the other Administrator-only screens. Nothing here is personal information. */
  function speedPanel() {
    if (!H.can('*') || !H.speed) return '';
    var sp = H.speed(), st = Store.stats ? Store.stats() : {}, sec = function (ms) { return (Math.round(ms / 100) / 10) + ' s'; };
    var rows = [];
    var began = (window.performance && performance.timeOrigin) || sp.opened;
    if (st.start) rows.push(['Opening, until ready', st.loaded ? sec(st.loaded - began) + ' (getting everything from the database: ' + sec(st.loaded - st.start) + ')' : 'still loading…']);
    rows.push(['Browser too busy to respond', sec(sp.busyMs) + ' in all since opening' + (sp.busyLongest ? ' · longest ' + sec(sp.busyLongest) : '')]);
    if (st.start) rows.push(['Updates from the database', st.snaps + ' · redone ' + st.rebuilds + ' times, ' + sec(st.rebuildMs) + ' in all, slowest ' + sec(st.slowestRebuild)]);
    if (st.start) rows.push(['Saved from this device', String(st.writes)]);
    rows.push(['Open for', sec(Date.now() - sp.opened)]);
    var c = st.counts || {}, big = Object.keys(c).sort(function (a, b) { return c[b] - c[a]; }).slice(0, 8).map(function (k) { return k + ' ' + c[k]; }).join(' · ');
    var pages = sp.pages.filter(function (x) { return x.page !== '#/about'; }).map(function (x) { return '<tr><td>' + esc(x.page) + '</td><td style="text-align:right">' + x.ms + ' ms</td></tr>'; }).join('');
    return '<section class="panel"><h2>Speed check</h2><p class="hint" style="margin-top:0">If Church Hub feels slow, open this page straight afterwards and send a screenshot to whoever looks after Church Hub.</p>' +
      '<dl class="kv">' + rows.map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') + '<dt>Records</dt><dd>' + esc(big) + '</dd></dl>' +
      (pages ? '<h3 style="margin:14px 0 6px">Last pages drawn</h3><table class="table small"><tbody>' + pages + '</tbody></table>' : '') + '</section>';
  }

  /** Admins: the two printable brochures (brochure.html), filled in with the church's name and this Church Hub's address. */
  function brochures() {
    if (!H.can('*')) return '';
    var st = Store.settings() || {}, link = location.origin + location.pathname.replace(/index\.html$/, '');
    function a(who, title, sub) {
      var q = 'for=' + who + '&v=' + encodeURIComponent(V.version) + (st.churchName ? '&church=' + encodeURIComponent(st.churchName) : '') + '&link=' + encodeURIComponent(link);
      return '<a class="item" href="brochure.html?' + esc(q) + '" target="_blank" rel="noopener"><span class="grow"><b>' + title + '</b><small>' + sub + '</small></span></a>';
    }
    return '<section class="panel" id="about-brochures"><h2>' + T('Brochures') + '</h2><p class="hint">' + T('Fold-out A4 brochures about Church Hub to print or save as PDF. They are kept up to date as new features are added.') + '</p><div class="list">' +
      a('members', T('For our members'), T('How to start, and what members can do')) +
      a('churches', T('For other churches'), T('What Church Hub offers, and the demo')) +
      '</div></section>';
  }

  H.register({
    id: 'about', name: 'About', desc: 'Version, updates and who made Church Hub', tint: '#475569',
    icon: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-5M12 8h.01',
    stat: function () { return T('Version {v}', { v: V.version }); },
    render: render,
    after: function () { if (!check.state) runCheck(); },   // check as soon as the page opens
    actions: {
      check: function () { runCheck(); },
      // Load the page again under a new address, so neither the browser nor the phone uses its saved copy
      reload: function () { var q = cleanSearch().replace(/^\?/, ''); location.replace(location.pathname + '?' + (q ? q + '&' : '') + 'u=' + Date.now() + location.hash); }
    }
  });
  window.ChurchHubAbout = { cmp: cmp };
})();
