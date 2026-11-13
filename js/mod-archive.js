/* Church Hub – Archive: the church's records in one safe place – Council minutes, architectural plans, staff contracts,
 * annual appraisals and anything else. Each record has a date, a category, a file (kept in Church Hub, up to 15 MB) or a
 * link to where it is kept, and says who can see it. Off until an Administrator switches it on (Settings → Apps).
 * The Archive is part of the Library and is available only to Administrators and Council members; within that group,
 * each record keeps its existing visibility rule (everyone / a leadership group / Administrators and Pastors / private).
 * Administrators add records and see them all.
 * Opening a record that isn't for everyone is written in the audit log. Rules: js/archive.js (tested), firestore.rules (archive). */
(function () {
  'use strict';
  var H = Hub, esc = H.esc, S = Store, T = I18n.t, TN = I18n.tn, A = Archive;
  var BOX = 'M3 5h18v4H3zM5 9v10h14V9M10 13h4';
  var PEN = 'M4 20h4L20 8l-4-4L4 16zM14 6l4 4';
  var state = { q: '', cat: '', year: '' }, draft = null;
  var previewUrl = '', previewObserver = null;

  function me() { return H.user(); }
  function administrator() { return H.can('*') && !S.preview(); }
  function who() {
    var u = me(), admin = administrator(), bodies = u && window.LeadersUI ? LeadersUI.mine(u.id) : [];
    return { admin: admin, council: !S.preview() && !!u && bodies.some(function (id) { var b = S.get('leaderBodies', id); return b && /council/i.test(b.name || ''); }),
      pastor: !admin && H.can('people.edit'), ids: u ? [u.id] : [], bodies: bodies };
  }
  function keeper() { return canAccess(); }
  function councilMember() {
    var u = me();
    return !!(u && !S.preview() && window.LeadersUI && LeadersUI.mine(u.id).some(function (id) {
      var b = S.get('leaderBodies', id); return b && /council/i.test(b.name || '');
    }));
  }
  function canAccess() { return administrator() || councilMember(); }
  function mayPreview(r) {
    if (!r || !r.file || S.preview()) return false;
    return administrator() || councilMember();
  }
  function visible() { var w = who(); return canAccess() ? S.list('archive').filter(function (r) { return A.sees(r, w); }) : []; }
  function cats() { return A.cats(S.settings()); }
  function catName(id) { var c = A.cat(S.settings(), id); return c ? T(c.name) : T('Other records'); }
  function bodies() { return S.list('leaderBodies').slice().sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || '')); }); }
  function val(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }
  function accessText(r) {
    var b = r.bodyId ? S.get('leaderBodies', r.bodyId) : null, a = A.ACCESS.filter(function (x) { return x[0] === r.access; })[0];
    return r.access === 'body' ? (b ? b.name : T('The members of a leadership group')) : T(a ? a[1] : 'Administrators and the Senior Pastor only');
  }
  function item(r, edit) {
    var bits = [H.fmt(r.date, true)];
    if (r.aboutName) bits.push(T('About {name}', { name: r.aboutName }));
    if (r.file) bits.push(r.file.name + ' (' + A.sizeText(r.file.size) + ')');
    return '<div class="item rec-item ar-item" data-find="' + esc([r.title, r.note, r.aboutName, r.file ? r.file.name : ''].join(' ')) + '">' +
      '<span class="grow"><b data-own-words>' + esc(r.title) + '</b><small>' + bits.map(esc).join(' · ') + '</small>' + (r.note ? (window.RichText && RichText.formatted(r.note) ? '<div class="rich small" data-own-words>' + RichText.html(r.note) + '</div>' : '<small data-own-words>' + esc(r.note) + '</small>') : '') +
      (edit ? '<small><span class="tag grey">' + H.icon(H.ICON.lock, 12) + ' ' + esc(accessText(r)) + '</span>' + (r.shownTo ? ' <span class="tag grey">' + esc(T('Shown to {name}', { name: r.aboutName })) + '</span>' : '') + '</small>' : '') + '</span><span class="rec-acts">' +
      (r.file ? '<button class="btn small" data-act="archive:open" data-id="' + esc(r.id) + '">' + H.icon(H.ICON.download, 16) + T('Download') + '</button>' : '') +
      (mayPreview(r) ? '<button class="btn small" data-act="archive:preview" data-id="' + esc(r.id) + '">👁 ' + T('Preview') + '</button>' : '') +
      (A.link(r.link) ? '<a class="btn small" href="' + esc(A.link(r.link)) + '" target="_blank" rel="noopener noreferrer" data-act="archive:link" data-id="' + esc(r.id) + '">' + H.icon(H.ICON.link, 16) + T('Open the link') + '</a>' : '') +
      (edit ? '<button class="icon-btn ghost" data-act="archive:edit" data-id="' + esc(r.id) + '" aria-label="' + esc(T('Edit {name}', { name: r.title })) + '" title="' + esc(T('Edit')) + '">' + H.icon(PEN, 16) + '</button>' +
        '<button class="icon-btn ghost" data-act="archive:del" data-id="' + esc(r.id) + '" aria-label="' + esc(T('Delete {name}', { name: r.title })) + '" title="' + esc(T('Delete')) + '">' + H.icon(H.ICON.trash, 16) + '</button>' : '') + '</span></div>';
  }
  /** Council minutes are monthly: the months of this year with nothing filed yet (up to last month), for the people who file them. */
  function gaps(recs) {
    var now = H.today(), yr = now.slice(0, 4), m = +now.slice(5, 7) - 1; if (m < 1 || !A.cat(S.settings(), 'minutes')) return '';
    if (state.year && state.year !== yr) return '';
    var miss = A.missingMonths(recs, 'minutes', yr, yr + '-' + (m < 10 ? '0' : '') + m);
    return miss.length ? '<p class="note warn" style="margin:8px 0 0">' + esc(T('Nothing filed yet for: {months}', { months: miss.map(function (x) { return I18n.mon()[x - 1]; }).join(', ') + ' ' + yr })) + '</p>' : '';
  }
  function page() {
    if (!canAccess()) return '<div class="page-head"><div><h1>' + T('Archives') + '</h1></div></div><p class="note warn" role="status">' +
      T('Restricted View — Access restricted to Council members and Administrators only.') + '</p>';
    var edit = keeper(), all = visible(), cs = cats(), years = A.years(all);
    if (state.cat && !A.cat(S.settings(), state.cat)) state.cat = '';
    if (state.year && years.indexOf(state.year) < 0) state.year = '';
    var known = {}; cs.forEach(function (c) { known[c.id] = 1; });
    var groups = cs.filter(function (c) { return !state.cat || c.id === state.cat; }).map(function (c) { return { id: c.id, name: T(c.name), recs: A.list(all, c.id, state.year) }; });
    var stray = state.cat ? [] : A.list(all, '', state.year).filter(function (r) { return !known[r.cat]; });   // records of a category since deleted
    if (stray.length) groups.push({ id: '', name: T('Other records'), recs: stray });
    var html = '<div class="page-head"><div><h1>' + T('Archives') + '</h1><p class="lead">' + T('The church’s records, kept safely in one place. Each record says who can see it.') + '</p></div>' +
      '<div class="btns"><button class="btn" data-act="archive:storageinfo"><span aria-hidden="true">ⓘ</span> ' + T('Where are documents stored?') + '</button>' +
      (edit ? '<button class="btn primary" data-act="archive:add">' + H.icon(H.ICON.plus, 16) + T('Add a record') + '</button>' +
        (H.can('settings.manage') ? '<button class="btn" data-act="archive:cats">' + T('Categories') + '</button>' : '') : '') + '</div></div>';
    if (!all.length) return html + '<p class="empty">' + T('No records yet.') + '</p>';
    html += '<div class="row" style="gap:10px;flex-wrap:wrap;margin-bottom:14px"><label class="search grow">' + H.icon(H.ICON.search, 18) + '<span class="sr">' + T('Search the archive') + '</span><input id="ar-q" type="search" placeholder="' + esc(T('Search the archive')) + '" value="' + esc(state.q) + '" autocomplete="off"></label>' +
      '<select class="inline" style="width:auto" id="ar-fcat" aria-label="' + esc(T('Category')) + '"><option value="">' + T('All categories') + '</option>' + cs.map(function (c) { return '<option value="' + esc(c.id) + '"' + (state.cat === c.id ? ' selected' : '') + '>' + esc(T(c.name)) + '</option>'; }).join('') + '</select>' +
      '<select class="inline" style="width:auto" id="ar-fyear" aria-label="' + esc(T('Year')) + '"><option value="">' + T('All years') + '</option>' + years.map(function (y) { return '<option' + (state.year === y ? ' selected' : '') + '>' + esc(y) + '</option>'; }).join('') + '</select></div>';
    html += groups.filter(function (g) { return g.recs.length || (edit && g.id === 'minutes'); }).map(function (g) {
      return '<section class="panel ar-panel" data-cat="' + esc(g.id) + '"><div class="row"><h2 class="grow" style="margin:0" data-own-words>' + esc(g.name) + '</h2><span class="muted small">' + TN('{n} record', '{n} records', g.recs.length) + '</span></div>' +
        (edit && g.id === 'minutes' ? gaps(all) : '') +
        '<div class="list" style="margin-top:8px">' + g.recs.map(function (r) { return item(r, edit); }).join('') + '</div></section>';
    }).join('');
    return html + '<p class="empty" id="ar-none" hidden>' + T('Nothing matches.') + '</p>';
  }
  function applySearch() {
    var q = state.q.trim(), shown = 0;
    [].forEach.call(document.querySelectorAll('.ar-panel'), function (sec) {
      var any = false;
      [].forEach.call(sec.querySelectorAll('.ar-item'), function (it) { var hit = !q || H.matches(it.dataset.find, q); it.hidden = !hit; if (hit) any = true; });
      sec.hidden = !!q && !any; if (any) shown++;
    });
    var none = document.getElementById('ar-none'); if (none) none.hidden = !q || shown > 0;
  }

  /* ---------- adding and changing a record ---------- */
  function staff(keep) { return S.find('people', function (p) { return p.id === keep || (p.category === 'Staff' && p.active !== false && !p.binnedAt && !p.mergedInto); }).sort(function (a, b) { return H.name(a).localeCompare(H.name(b)); }); }
  function showParts() {
    var c = A.cat(S.settings(), val('ar-cat')), body = document.getElementById('ar-body-wrap'), about = document.getElementById('ar-about-wrap'); if (!body) return;
    body.hidden = val('ar-access') !== 'body';
    about.hidden = !((c && c.person) || val('ar-about'));
  }
  function form(r) {
    var isNew = !r.id, cs = cats(), bs = bodies(), council = bs.filter(function (b) { return /council/i.test(b.name); })[0] || bs[0];
    var opt = function (v, text, cur) { return '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(text) + '</option>'; };
    H.modal(H.dialogHead(isNew ? T('Add a record') : T('Edit {name}', { name: r.title })) + '<div class="dlg-body">' +
      '<label class="field req">' + T('Title') + '<input id="ar-title" maxlength="150" value="' + esc(r.title || '') + '"></label>' +
      '<div class="two"><label class="field req">' + T('Category') + '<select id="ar-cat"' + (isNew ? ' data-new="1"' : '') + '>' + cs.map(function (c) { return opt(c.id, T(c.name), r.cat); }).join('') + (r.cat && !A.cat(S.settings(), r.cat) ? opt(r.cat, T('Other records'), r.cat) : '') + '</select></label>' +
      '<label class="field req">' + T('Date') + '<input type="date" id="ar-date" value="' + esc(r.date || H.today()) + '"></label></div>' +
      '<label class="field req">' + T('Who can see it') + '<select id="ar-access">' + A.ACCESS.map(function (a) { return opt(a[0], T(a[1]), r.access); }).join('') + '</select><small>' + T('Administrators see every record. Council members see records allowed by their access.') + '</small></label>' +
      '<div id="ar-body-wrap"><label class="field req">' + T('Leadership group') + '<select id="ar-body"><option value="">' + T('Choose…') + '</option>' + bs.map(function (b) { return opt(b.id, b.name, r.bodyId || (isNew && council ? council.id : '')); }).join('') + '</select>' +
      '<small>' + T('Leadership groups are set up on the Leadership page.') + '</small></label></div>' +
      '<div id="ar-about-wrap"><label class="field">' + T('The staff member it is about') + '<select id="ar-about"><option value="">' + T('No one') + '</option>' + staff(r.aboutId).map(function (p) { return opt(p.id, H.name(p), r.aboutId); }).join('') + '</select></label>' +
      '<label class="check"><input type="checkbox" id="ar-shown"' + (r.shownTo || (isNew && !r.aboutId) ? ' checked' : '') + '><span>' + T('They can see this record themselves') + '</span></label></div>' +
      '<label class="field">' + (r.file ? T('Replace the file') + ' <span class="muted small">(' + esc(r.file.name) + ')</span>' : T('File (up to 15 MB)')) + '<input type="file" id="ar-file"></label>' +
      '<label class="field">' + T('Or a link to where it is kept') + '<input id="ar-link" type="url" maxlength="500" value="' + esc(r.link || '') + '" placeholder="https://"></label>' +
      '<div class="field"><label for="ar-note">' + T('Note') + '</label>' + (window.RichText ? RichText.tools('ar-note', { bar: T('Formatting'), b: T('Bold'), i: T('Italic'), u: T('Underline'), h: T('Heading'), ul: T('Bulleted list'), ol: T('Numbered list') }) : '') + '<textarea id="ar-note" rows="3" maxlength="1000">' + esc(r.note || '') + '</textarea></div>' +
      '<p id="ar-err" class="note bad" hidden></p></div>' +
      '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn save" data-act="archive:save" data-id="' + esc(r.id || '') + '">' + T('Save') + '</button></div>', T('Add a record'));
    showParts();
  }
  function readFile(file) {
    return new Promise(function (ok, no) {
      var fr = new FileReader();
      fr.onload = function () { var s = String(fr.result || ''); ok(s.slice(s.indexOf(',') + 1)); };
      fr.onerror = function () { no(fr.error || new Error('read')); };
      fr.readAsDataURL(file);
    });
  }
  /** Hand a file (base64) to the browser or the Android app to save. */
  function saveAs(name, type, b64) {
    if (window.ChurchHubApp && typeof window.ChurchHubApp.saveFileBase64 === 'function') { window.ChurchHubApp.saveFileBase64(name, type || 'application/octet-stream', b64); return; }
    if (window.ChurchHubApp) { H.toast(T('Please update the Church Hub app to download files, or use a browser.'), true); return; }
    var bin = atob(b64), bytes = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([bytes], { type: type || 'application/octet-stream' }));
    a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function logOpen(r) { if (r.access !== 'all') S.audit('Opened the archive record “' + r.title + '” (' + catName(r.cat) + ')', 'archive/' + r.id); }
  function logPreview(r) { if (r.access !== 'all') S.audit('Previewed the archive record “' + r.title + '” (' + catName(r.cat) + ')', 'archive/' + r.id); }
  function downloadRecord(r) {
    H.busy(T('Fetching the file…'), function () {
      return S.loadFile(r.id, r.file.parts).then(function (parts) { saveAs(r.file.name, r.file.type, A.join(parts)); logOpen(r); });
    }).catch(function (e) { console.error(e); H.toast(S.isLive() ? T('Couldn’t fetch the file. Please try again.') : T('The demo keeps files only until you close the page.'), true); });
  }
  function clearPreviewUrl() {
    if (previewObserver) { previewObserver.disconnect(); previewObserver = null; }
    if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = ''; }
  }
  function contentType(file) {
    var name = String(file.name || '').toLowerCase(), ext = (name.match(/\.([a-z0-9]+)$/) || [])[1] || '';
    var known = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
      txt: 'text/plain', md: 'text/markdown', markdown: 'text/markdown', csv: 'text/csv' };
    var type = String(file.type || '').toLowerCase().split(';')[0];
    if (known[ext]) return known[ext];
    if (/^(application\/pdf|image\/(jpeg|png|webp|gif)|text\/(plain|markdown|csv))$/.test(type)) return type;
    return '';
  }
  function textFrom(b64) {
    var bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }
  function previewDialog(r, b64) {
    clearPreviewUrl();
    var type = contentType(r.file), bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    var body, unsupported = !type;
    if (type === 'application/pdf' || type.indexOf('image/') === 0) {
      previewUrl = URL.createObjectURL(new Blob([bytes], { type: type }));
      body = type === 'application/pdf'
        ? '<iframe class="ar-preview-frame" src="' + previewUrl + '" title="' + esc(r.title) + '"></iframe>'
        : '<div class="ar-preview-image-wrap"><img class="ar-preview-image" src="' + previewUrl + '" alt="' + esc(r.title) + '"></div>';
    } else if (type.indexOf('text/') === 0) {
      var text = textFrom(b64), markdown = type === 'text/markdown' || /\.markdown?$/i.test(r.file.name || '');
      body = markdown && window.RichText
        ? '<div class="ar-preview-text rich">' + RichText.html(text) + '</div>'
        : '<pre class="ar-preview-text">' + esc(text) + '</pre>';
    } else {
      body = '<div class="ar-preview-unsupported"><p>' + T('Inline preview is not available for this file type') + '</p>' +
        '<button class="btn primary" data-act="archive:previewdownload" data-id="' + esc(r.id) + '">' + H.icon(H.ICON.download, 16) + T('Download file') + '</button></div>';
    }
    var meta = [catName(r.cat), H.fmt(r.date, true), r.file.name + ' (' + A.sizeText(r.file.size) + ')'].filter(Boolean).map(esc).join(' · ');
    H.modal(H.dialogHead(T('Preview'), r.title) + '<div class="dlg-body ar-preview-body"><p class="ar-preview-meta">' + meta + '</p>' + body + '</div>' +
      '<div class="dlg-foot">' + (!unsupported ? '<button class="btn" data-act="archive:previewdownload" data-id="' + esc(r.id) + '">' + H.icon(H.ICON.download, 16) + T('Download') + '</button>' : '') +
      '<button class="btn primary" data-act="hub:close">' + T('Close') + '</button></div>', T('Preview'), true);
    var dialog = document.querySelector('#modal .dialog');
    if (dialog) dialog.classList.add('ar-preview-dialog');
    if (previewUrl) {
      var modal = document.getElementById('modal');
      previewObserver = new MutationObserver(function () {
        if (!modal.querySelector('.ar-preview-dialog')) clearPreviewUrl();
      });
      previewObserver.observe(modal, { childList: true, subtree: true });
    }
  }
  function catRows() {
    return draft.map(function (c, i) {
      var used = S.find('archive', function (r) { return r.cat === c.id; }).length;
      return '<div class="item ar-cat" style="gap:8px;flex-wrap:wrap" data-i="' + i + '"><input class="ar-cn grow" maxlength="60" value="' + esc(T(c.name)) + '" aria-label="' + esc(T('Name')) + '">' +
        '<select class="ar-ca" aria-label="' + esc(T('Who can see it')) + '">' + A.ACCESS.map(function (a) { return '<option value="' + a[0] + '"' + (a[0] === c.access ? ' selected' : '') + '>' + esc(T(a[1])) + '</option>'; }).join('') + '</select>' +
        '<button class="icon-btn ghost" data-act="archive:catdel" data-i="' + i + '"' + (used ? ' disabled title="' + esc(TN('{n} record', '{n} records', used)) + '"' : ' title="' + esc(T('Delete')) + '"') + ' aria-label="' + esc(T('Delete {name}', { name: T(c.name) })) + '">' + H.icon(H.ICON.trash, 16) + '</button></div>';
    }).join('');
  }
  /** What is typed in the Categories dialog, into the draft (a starting category keeps its English name unless it was reworded). */
  function readCats() {
    [].forEach.call(document.querySelectorAll('.ar-cat'), function (row) {
      var c = draft[+row.dataset.i], n = row.querySelector('.ar-cn').value.trim().slice(0, 60); if (!c) return;
      if (n && n !== T(c.name)) c.name = n;
      c.access = row.querySelector('.ar-ca').value;
    });
  }
  function catsDialog() {
    H.modal(H.dialogHead(T('Categories'), T('“Who can see it” is what a new record in the category starts with.')) + '<div class="dlg-body"><div class="list">' + catRows() + '</div>' +
      '<div class="btns" style="margin-top:10px"><button class="btn" data-act="archive:catadd">' + H.icon(H.ICON.plus, 16) + T('Add a category') + '</button></div></div>' +
      '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn save" data-act="archive:catsave">' + T('Save') + '</button></div>', T('Categories'), true);
  }
  function storageDialog() {
    if (!canAccess()) return;
    H.modal(H.dialogHead(T('Where are documents stored?')) + '<div class="dlg-body"><p class="hint">' +
      esc(T('Physical documents: [add shelf/cabinet and filing details]. Uploaded files are stored in the church’s Firestore database in South Africa. Linked files stay in their cloud folder: [add provider and folder details]. Replace these placeholders with the church’s actual locations.')) +
      '</p></div><div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Close') + '</button></div>', T('Where are documents stored?'));
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('input', function (ev) { if (ev.target.id === 'ar-q') { state.q = ev.target.value; applySearch(); } });
    document.addEventListener('change', function (ev) {
      var id = ev.target.id;
      if (id === 'ar-fcat') { state.cat = ev.target.value; H.render(); }
      else if (id === 'ar-fyear') { state.year = ev.target.value; H.render(); }
      else if (id === 'ar-cat') {
        var c = A.cat(S.settings(), ev.target.value), acc = document.getElementById('ar-access');
        if (c && acc && ev.target.dataset.new) acc.value = c.access;   // a new record starts with its category's "who can see it"
        showParts();
      } else if (id === 'ar-access' || id === 'ar-about') showParts();
    });
  }

  window.ArchiveUI = { page: page, after: applySearch, canAccess: canAccess };
  H.register({
    id: 'archive', name: 'Archives', desc: 'Minutes, plans, contracts and other church records', icon: BOX, tint: '#7A5C3E', optIn: true, inLibrary: true,
    show: function () { return false; },
    render: function () { return ''; },
    after: function () { applySearch(); },
    stat: function () { return TN('{n} record', '{n} records', visible().length); },
    actions: {
      add: function () {
        if (!keeper()) return;
        var c = A.cat(S.settings(), state.cat) || cats()[0] || { id: 'other', access: 'office' };
        form({ cat: c.id, access: c.access });
      },
      edit: function (el) { var r = S.get('archive', el.dataset.id); if (r && keeper()) form(r); },
      save: function (el) {
        if (!keeper()) return;
        var old = el.dataset.id ? S.get('archive', el.dataset.id) : null, err = document.getElementById('ar-err');
        var bad = function (msg) { err.textContent = msg; err.hidden = false; };
        var f = document.getElementById('ar-file'), file = f && f.files && f.files[0], access = val('ar-access'), about = val('ar-about') ? S.get('people', val('ar-about')) : null, typed = val('ar-link');
        if (!val('ar-title') || !val('ar-date')) return bad(T('Shaded boxes must be filled in.'));
        if (access === 'body' && !val('ar-body')) return bad(T('Choose the leadership group that can see it.'));
        if (file && file.size > A.MAX) return bad(T('That file is too big (15 MB at most). Keep it somewhere like Google Drive and paste its link here.'));
        if (typed && !A.link(typed)) return bad(T('That link doesn’t look like a web address.'));
        if (!file && !(old && old.file) && !typed) return bad(T('Add a file or a link.'));
        var u = me(), rec = A.clean({ id: old ? old.id : S.uid('ar'), createdAt: old && old.createdAt, title: val('ar-title'), cat: val('ar-cat'), date: val('ar-date'), note: val('ar-note'), access: access, bodyId: val('ar-body'),
          aboutId: about ? about.id : '', aboutName: about ? H.name(about) : '', shownTo: !!about && document.getElementById('ar-shown').checked, link: A.link(typed), file: old && old.file, by: old ? old.by : (u ? H.name(u) : '') });
        var why = (old ? 'Changed the archive record “' : 'Added to the archive: “') + rec.title + '” (' + catName(rec.cat) + '; seen by: ' + rec.access + (rec.shownTo ? ' and the person it is about' : '') + ')';
        var done = function () { H.closeModal(); H.render(); H.toast(T('Saved')); if (file && !S.isLive()) H.toast(T('The demo keeps files only until you close the page.')); };
        if (!file) { S.put('archive', rec, why); return done(); }
        H.busy(T('Saving the file…'), function () {
          return readFile(file).then(function (b64) {
            var parts = A.split(b64);
            return S.saveFile(rec.id, parts, (old && old.file && old.file.parts) || 0).then(function () {
              rec.file = { name: file.name.slice(0, 150), type: file.type || '', size: file.size, parts: parts.length };
              S.put('archive', rec, why);
            });
          });
        }).then(done, function (e) { console.error(e); bad(T('Couldn’t save the file. Please try again.')); });
      },
      del: function (el) {
        var r = S.get('archive', el.dataset.id); if (!r || !keeper() || !H.confirmBtn(el, '✕?')) return;
        S.remove('archive', r.id, 'Deleted the archive record “' + r.title + '” (' + catName(r.cat) + ')'); H.render(); H.toast(T('Deleted'));
      },
      open: function (el) {
        var r = S.get('archive', el.dataset.id); if (!canAccess() || !r || !r.file || !A.sees(r, who())) return;
        downloadRecord(r);
      },
      preview: function (el) {
        var r = S.get('archive', el.dataset.id); if (!mayPreview(r)) return;
        H.busy(T('Fetching the file…'), function () {
          return S.loadArchivePreview(r.id, r.file.parts).then(function (parts) {
            previewDialog(r, A.join(parts)); logPreview(r);
          });
        }).catch(function (e) { console.error(e); H.toast(T('Couldn’t fetch the file. Please try again.'), true); });
      },
      previewdownload: function (el) {
        var r = S.get('archive', el.dataset.id);
        if (canAccess() && r && mayPreview(r)) downloadRecord(r);
      },
      link: function (el) { var r = S.get('archive', el.dataset.id); if (canAccess() && r && A.sees(r, who())) logOpen(r); },   // the link itself opens in a new tab
      storageinfo: function () { storageDialog(); },
      cats: function () { if (!H.can('settings.manage')) return; draft = A.copy(cats()); catsDialog(); },
      catadd: function () { if (!draft) return; readCats(); draft.push({ id: S.uid('ac'), name: '', access: 'office', person: false }); catsDialog(); var all = document.querySelectorAll('.ar-cn'); if (all.length) all[all.length - 1].focus(); },
      catdel: function (el) { if (!draft) return; readCats(); draft.splice(+el.dataset.i, 1); catsDialog(); },
      catsave: function () {
        if (!draft || !H.can('settings.manage')) return; readCats();
        var list = draft.filter(function (c) { return c.name; }); if (!list.length) { H.toast(T('Keep at least one category'), true); return; }
        S.setSettings({ archiveCats: list }, 'Changed the Archive’s categories (' + list.map(function (c) { return c.name + ': ' + c.access; }).join(', ') + ')');
        draft = null; H.closeModal(); H.render(); H.toast(T('Saved'));
      }
    }
  });
})();
