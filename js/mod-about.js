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
    return '<div class="page-head"><div><h1>' + T('About Church Hub') + '</h1><p class="lead">' + T('Church Hub keeps the church’s people, rosters, Care Groups and staff management in one place.') + '</p></div></div>' +
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
    if (!Store.isAdmin()) return '';
    var st = Store.settings() || {}, link = location.origin + location.pathname.replace(/index\.html$/, '');
    function a(who, title, sub) {
      return '<a class="item" href="#/about/brochure/' + who + '"><span class="grow"><b>' + title + '</b><small>' + sub + '</small></span></a>';
    }
    return '<section class="panel" id="about-brochures"><h2>' + T('Brochures') + '</h2><p class="hint">' + T('Fold-out A4 brochures about Church Hub to print or save as PDF. They are kept up to date as new features are added.') + '</p><div class="list">' +
      a('members', T('For our members'), T('How to start, and what members can do')) +
      a('churches', T('For other churches'), T('What Church Hub offers, and the demo')) +
      '</div><p class="hint" style="margin-bottom:0">Open one to print it, or to change its wording, colour and font (Edit).' +
      (window.BrochureKit && BrochureKit.changed(Store.brochures()) ? ' <b>Your church has changed them.</b>' : '') + '</p></section>';
  }

  function broSetDesign(patch) {
    if (!Store.isAdmin()) return;
    var b = broSaved(); Object.assign(b.design, patch); b = BrochureKit.tidy(b);
    Store.setBrochures(b);
    var fr = document.getElementById('bro-frame'); if (fr && fr.contentDocument) broDesign(fr.contentDocument, b.design);
    document.querySelectorAll('.bro-sw').forEach(function (x) { x.classList.toggle('on', x.dataset.c === b.design.accent); });
    var pick = document.getElementById('bro-colour'); if (pick) pick.value = b.design.accent;
    setTimeout(function () { var d = fr && fr.contentDocument; if (d) broCheck(d, null); }, 400);
  }
  if (typeof document !== 'undefined') document.addEventListener('change', function (e) {
    if (e.target.id === 'bro-colour') broSetDesign({ accent: e.target.value });
    if (e.target.id === 'bro-font') broSetDesign({ font: e.target.value });
  });

  /* ---------- Brochures: shown and edited inside Church Hub (Administrators) ----------
   * brochure.html is shown in a frame (?embed=1); the church's wording, hidden blocks, colour and font (brochures/church,
   * rules in js/brochure-kit.js) are laid over it. Editing: click a text and type; the eye hides or shows a block. Changes save
   * by themselves. The page isn't redrawn while it is open (data-keep), so typing isn't lost. */
  var bro = { edit: false };
  function broSaved() { return BrochureKit.tidy(Store.brochures()); }
  function broSrc(who) {
    var st = Store.settings() || {}, link = location.origin + location.pathname.replace(/index\.html$/, '');
    return 'brochure.html?for=' + who + '&embed=1&v=' + encodeURIComponent(V.version) + (st.churchName ? '&church=' + encodeURIComponent(st.churchName) : '') + '&link=' + encodeURIComponent(link);
  }
  function renderBrochure(who) {
    who = who === 'churches' ? 'churches' : 'members';
    var b = broSaved(), d = b.design, st = Store.settings() || {}, lang = I18n.get(), own = st.theme && st.theme.id === 'custom' && st.theme.color ? String(st.theme.color).toUpperCase() : '';
    var sw = function (c, label) { return '<button type="button" class="bro-sw' + (d.accent === c ? ' on' : '') + '" data-act="about:brocolour" data-c="' + c + '" style="--c:' + c + '" title="' + esc(label) + '" aria-label="' + esc(label) + '"></button>'; };
    return '<div class="page-head"><div><h1>' + T('Brochures') + '</h1><p class="lead">Fold-out A4 brochures to print or save as PDF. Change the wording, colour and font to suit your church.</p></div>' +
      '<div class="btns"><a class="btn" href="#/about">' + H.icon(H.ICON.back, 18) + T('About') + '</a></div></div>' +
      '<nav class="seg" style="margin-bottom:14px"><a href="#/about/brochure/members" class="' + (who === 'members' ? 'on' : '') + '">' + T('For our members') + '</a><a href="#/about/brochure/churches" class="' + (who === 'churches' ? 'on' : '') + '">' + T('For other churches') + '</a></nav>' +
      '<section class="panel bro-tools" data-noauto>' +
        '<div class="btns" style="margin:0"><button class="btn' + (bro.edit ? '' : ' primary') + '" data-act="about:broedit">' + (bro.edit ? H.icon(H.ICON.check, 18) + 'Done editing' : 'Edit the wording') + '</button>' +
        '<button class="btn' + (bro.edit ? '' : ' primary') + '" data-act="about:broprint">Print or save as PDF</button></div>' +
        (bro.edit ? '<p class="note info" style="margin:12px 0 0">Click any heading or text on the brochure and type. Use <b>Hide</b> on a block you don’t want, and <b>Show</b> to bring it back. Changes save by themselves. Keep an eye on the red warning: everything must fit on its third of the page.</p>' : '') +
        '<div class="bro-design">' + I18n.picker('bro-lang') + '<span class="bro-l">Colour</span>' + sw(BrochureKit.DEFAULT.accent, 'Church Hub orange') + (own && own !== BrochureKit.DEFAULT.accent ? sw(own, 'The church’s colour (Settings → Colours)') : '') +
          '<label class="bro-pick" title="Any colour"><input type="color" id="bro-colour" value="' + esc(d.accent) + '" aria-label="Any colour"></label>' +
          '<span class="bro-l">Font</span><select id="bro-font" aria-label="Font">' + BrochureKit.FONTS.map(function (f) { return '<option value="' + esc(f[0]) + '"' + (d.font === f[0] ? ' selected' : '') + '>' + esc(f[1]) + '</option>'; }).join('') + '</select></div>' +
        '<p class="hint" id="bro-note" style="margin:10px 0 0" aria-live="polite"></p>' +
        '<div class="btns" style="margin:10px 0 0">' +
          ((lang === 'en' ? BrochureKit.changed(b, who) : BrochureKit.changed(b[who].translations[lang], who)) ? '<button class="btn small" data-act="about:broreset" data-w="' + who + '">Back to the original wording</button>' : '') +
          (d.accent !== BrochureKit.DEFAULT.accent || d.font !== BrochureKit.DEFAULT.font ? '<button class="btn small" data-act="about:brodesign">Back to Church Hub’s colour and font</button>' : '') + '</div>' +
      '</section>' +
      '<div class="bro-wrap" data-keep><iframe id="bro-frame" title="' + esc(who === 'members' ? T('For our members') : T('For other churches')) + '" src="' + esc(broSrc(who)) + '"></iframe></div>';
  }

  /** The brochure in the frame: remember Church Hub's own wording, lay the church's over it, and (editing) make it editable. */
  function broLoad(who) {
    var fr = document.getElementById('bro-frame'), doc = fr && fr.contentDocument; if (!doc || !doc.body) return;
    var K = BrochureKit, b = broSaved(), lang = I18n.get(), base = b[who], translations = base.translations[lang] || { texts: {}, hidden: {} }, stale = [];
    broFill(doc);   // the church's name and address first, so they aren't counted as edits
    var sheets = [].slice.call(doc.querySelectorAll('.sheet')).filter(function (x) { return x.getAttribute('data-show') === who; });
    sheets.forEach(function (sh, si) {
      [].slice.call(sh.querySelectorAll('.pn h1, .pn h2, .pn h3, .pn p')).forEach(function (el, i) {
        var key = who[0] + si + ':' + i, originalHtml = K.clean(el.innerHTML), original = K.norm(el.textContent), saved = base.texts[key], localized = translations.texts[key];
        el.setAttribute('data-bk', key); el.setAttribute('data-bo', original);
        if (saved) { if (saved.o === original) el.innerHTML = saved.h; else stale.push(saved.o); }
        var fallback = saved && saved.o === original ? saved.h : originalHtml;
        if (localized) { if (localized.o === original) el.innerHTML = localized.h; else stale.push(localized.o); }
        el.setAttribute('data-bf', fallback);
      });
      [].slice.call(sh.querySelectorAll('.pn > div:not(.logo)')).forEach(function (el, i) {
        var key = who[0] + si + ':b' + i, o = K.norm(el.textContent), saved = base.hidden[key], localized = translations.hidden[key];
        el.setAttribute('data-bb', key); el.setAttribute('data-bo', o);
        if (saved !== undefined) { if (saved === o) el.classList.add('bro-off'); else stale.push(saved); }
        var fallbackHidden = saved === o;
        if (localized !== undefined) { if (localized === o) el.classList.add('bro-off'); else stale.push(localized); }
        el.setAttribute('data-bfhidden', fallbackHidden ? '1' : '');
      });
    });
    broFill(doc); broDesign(doc, b.design);
    var css = doc.getElementById('bro-css') || doc.head.appendChild(doc.createElement('style')); css.id = 'bro-css';
    css.textContent = '.bro-off{display:none!important}' + (bro.edit ?
      '.bro-off{display:block!important;opacity:.28}.pn>div[data-bb]{position:relative}[contenteditable]{outline:none}' +
      '[data-bk]{cursor:text;border-radius:4px}[data-bk]:hover{outline:2px dashed var(--ink);outline-offset:3px}[data-bk]:focus{outline:2px solid var(--ink);outline-offset:3px}' +
      '.bro-eye{position:absolute;top:-10px;right:-10px;z-index:3;font:800 12px/1 system-ui,sans-serif;padding:5px 9px;border-radius:999px;border:1px solid var(--ink);background:#fff;color:var(--ink);cursor:pointer;opacity:.85}' +
      '.bro-eye:hover{opacity:1}.pn.bro-over{outline:4px solid #D92D20;outline-offset:-4px}' +
      '@media print{.bro-eye{display:none}.bro-off{display:none!important}[data-bk]{outline:none!important}.pn.bro-over{outline:none}}' : '');
    if (bro.edit && Store.isAdmin()) broEditable(doc, who, lang);
    var fit = function () { fr.style.height = Math.max(400, doc.documentElement.scrollHeight) + 'px'; broCheck(doc, stale); };
    fit(); setTimeout(fit, 300); if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(fit);
  }
  function broFill(doc) {
    var st = Store.settings() || {}, link = (location.origin + location.pathname.replace(/index\.html$/, '')).replace(/^https?:\/\//, '').replace(/\/+$/, '');
    doc.querySelectorAll('[data-fill="church"]').forEach(function (e) { if (st.churchName) e.textContent = st.churchName; });
    doc.querySelectorAll('[data-fill="link"]').forEach(function (e) { e.textContent = link; });
    doc.querySelectorAll('[data-fill="origin"]').forEach(function (e) { e.textContent = I18n.t('Made in South Africa'); });
  }
  function broDesign(doc, d) {
    var c = BrochureKit.colours(d.accent), r = doc.documentElement.style;
    r.setProperty('--accent', c.accent); r.setProperty('--ink', c.ink); r.setProperty('--soft', c.soft); r.setProperty('--paper', c.paper); r.setProperty('--on-accent', c.onAccent);
    var f = BrochureKit.font(d.font), link = doc.getElementById('bro-font-css');
    if (f !== BrochureKit.DEFAULT.font) { if (!link) { link = doc.createElement('link'); link.id = 'bro-font-css'; link.rel = 'stylesheet'; doc.head.appendChild(link); } link.href = BrochureKit.fontHref(f); }
    r.setProperty('--font', "'" + f + "'");
  }
  /** Warnings under the buttons: text that no longer fits its panel, and edits to wording Church Hub has since changed. */
  function broCheck(doc, stale) {
    var over = [].slice.call(doc.querySelectorAll('.sheet:not([hidden]) .pn')).filter(function (p) { var o = p.scrollHeight > p.clientHeight + 1; p.classList.toggle('bro-over', o); return o; });
    var n = document.getElementById('bro-note'); if (!n) return;
    n.innerHTML = (over.length ? '<span class="note bad" style="display:block;margin:0 0 6px">' + (over.length === 1 ? 'One panel has' : over.length + ' panels have') + ' more than fits on its third of the page (marked in red when editing): shorten its text or hide a block.</span>' : '') +
      (stale && stale.length ? '<span class="note warn" style="display:block;margin:0">' + stale.length + ' of your changes ' + (stale.length === 1 ? 'is' : 'are') + ' to wording Church Hub has since changed, so ' + (stale.length === 1 ? 'it isn’t' : 'they aren’t') + ' shown: ' +
        stale.slice(0, 3).map(function (x) { return '“' + esc(x.slice(0, 60)) + '”'; }).join(', ') + '. Edit the new wording if you still want to change it. <button class="btn small" data-act="about:brostale">Forget them</button></span>' : '');
  }
  function broEditable(doc, who, lang) {
    var timer = null, save = function () { clearTimeout(timer); timer = setTimeout(function () { broSave(doc, who, lang); }, 600); };
    doc.querySelectorAll('[data-bk]').forEach(function (el) {
      el.setAttribute('contenteditable', 'true'); el.setAttribute('spellcheck', 'true');
      el.addEventListener('input', save); el.addEventListener('blur', function () { clearTimeout(timer); broSave(doc, who, lang); });
      el.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return; e.preventDefault();
        if (!/^H/.test(el.tagName)) doc.execCommand('insertLineBreak');   // headings stay on one line
      });
      el.addEventListener('paste', function (e) { e.preventDefault(); var t = (e.clipboardData || window.clipboardData).getData('text/plain'); doc.execCommand('insertText', false, t); });
    });
    doc.querySelectorAll('[data-bb]').forEach(function (el) {
      var eye = doc.createElement('button'); eye.type = 'button'; eye.className = 'bro-eye'; eye.setAttribute('contenteditable', 'false');
      var label = function () { eye.textContent = I18n.t(el.classList.contains('bro-off') ? 'Show' : 'Hide'); };
      label(); el.appendChild(eye);
      eye.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); el.classList.toggle('bro-off'); label(); broSave(doc, who, lang); });
    });
  }
  /** Save what is on the brochure now: each text that differs from Church Hub's own, and the hidden blocks. */
  function broSave(doc, who, lang) {
    if (!Store.isAdmin()) return;
    var K = BrochureKit, b = broSaved(), before = JSON.stringify(b), target = lang === 'en' ? b[who] : (b[who].translations[lang] || { texts: {}, hidden: {} }), texts = {}, hidden = {};
    Object.keys(target.texts).forEach(function (k) { var el = doc.querySelector('[data-bk="' + k + '"]'); if (!el || el.getAttribute('data-bo') !== target.texts[k].o) texts[k] = target.texts[k]; });
    Object.keys(target.hidden).forEach(function (k) { var el = doc.querySelector('[data-bb="' + k + '"]'); if (!el || el.getAttribute('data-bo') !== target.hidden[k]) hidden[k] = target.hidden[k]; });
    doc.querySelectorAll('[data-bk]').forEach(function (el) {
      var copy = el.cloneNode(true); copy.querySelectorAll('.bro-eye').forEach(function (x) { x.remove(); });
      var h = K.clean(copy.innerHTML);
      var key = el.getAttribute('data-bk'), baseline = el.getAttribute('data-bf');
      if (K.norm(h) !== K.norm(baseline) && !(lang === 'en' && K.norm(h) === K.norm(el.getAttribute('data-bo')))) texts[key] = { o: el.getAttribute('data-bo'), h: h };
      else delete texts[key];
    });
    doc.querySelectorAll('[data-bb]').forEach(function (el) {
      var key = el.getAttribute('data-bb'), isHidden = el.classList.contains('bro-off'), fallbackHidden = el.getAttribute('data-bfhidden') === '1';
      if (isHidden && !fallbackHidden) hidden[key] = el.getAttribute('data-bo'); else delete hidden[key];
    });
    if (lang === 'en') b[who] = { texts: texts, hidden: hidden, translations: b[who].translations };
    else b[who].translations[lang] = { texts: texts, hidden: hidden };
    b = K.tidy(b);
    if (JSON.stringify(b) === before) return;
    Store.setBrochures(b);
    broCheck(doc, null);
    H.toast('Saved');
  }

  H.register({
    id: 'about', name: 'About', desc: 'Version, updates and who made Church Hub', tint: '#475569',
    icon: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-5M12 8h.01',
    stat: function () { return T('Version {v}', { v: V.version }); },
    render: function (parts) { return parts && parts[0] === 'brochure' && Store.isAdmin() && window.BrochureKit ? renderBrochure(parts[1]) : render(); },
    after: function (parts) {
      if (parts && parts[0] === 'brochure') {
        var fr = document.getElementById('bro-frame'), who = parts[1] === 'churches' ? 'churches' : 'members';
        if (fr) fr.addEventListener('load', function () { broLoad(who); });
        return;
      }
      bro.edit = false;
      if (!check.state) runCheck();   // check as soon as the page opens
    },
    actions: {
      check: function () { runCheck(); },
      broedit: function () { if (!Store.isAdmin()) return; bro.edit = !bro.edit; if (!bro.edit) Store.audit('Changed the brochures (wording, colour or font)', 'brochures/church'); H.render(); },
      broprint: function () { var fr = document.getElementById('bro-frame'); if (fr && fr.contentWindow) { fr.contentWindow.focus(); fr.contentWindow.print(); } },
      brocolour: function (el) { broSetDesign({ accent: el.dataset.c }); },
      brodesign: function () { broSetDesign({ accent: BrochureKit.DEFAULT.accent, font: BrochureKit.DEFAULT.font }); H.render(); },
      broreset: function (el) {
        if (!Store.isAdmin()) return;
        if (!H.confirmBtn(el, 'Click again: back to the original wording')) return;
        var b = broSaved(), who = el.dataset.w, lang = I18n.get();
        if (lang === 'en') b[who] = { texts: {}, hidden: {}, translations: b[who].translations };
        else delete b[who].translations[lang];
        Store.setBrochures(b, 'Brochure for ' + who + ' (' + lang + '): back to the original wording'); H.render(); H.toast('Back to the original wording');
      },
      brostale: function () {
        if (!Store.isAdmin()) return;
        var fr = document.getElementById('bro-frame'), doc = fr && fr.contentDocument, who = /churches/.test(location.hash) ? 'churches' : 'members', b = broSaved(), mine = b[who];
        if (!doc) return;
        var lang = I18n.get(), target = lang === 'en' ? mine : (mine.translations[lang] || { texts: {}, hidden: {} });
        Object.keys(target.texts).forEach(function (k) { var e = doc.querySelector('[data-bk="' + k + '"]'); if (!e || e.getAttribute('data-bo') !== target.texts[k].o) delete target.texts[k]; });
        Object.keys(target.hidden).forEach(function (k) { var e = doc.querySelector('[data-bb="' + k + '"]'); if (!e || e.getAttribute('data-bo') !== target.hidden[k]) delete target.hidden[k]; });
        if (lang === 'en') b[who] = Object.assign({}, target, { translations: mine.translations });
        else mine.translations[lang] = target;
        Store.setBrochures(b); H.render();
      },
      // Load the page again under a new address, so neither the browser nor the phone uses its saved copy
      reload: function () { var q = cleanSearch().replace(/^\?/, ''); location.replace(location.pathname + '?' + (q ? q + '&' : '') + 'u=' + Date.now() + location.hash); }
    }
  });
  window.ChurchHubAbout = { cmp: cmp };
})();
