/* Church & Trellis – Archive: the church's records in one safe place – Council minutes, architectural plans, staff contracts,
 * annual appraisals and anything else. Each record has a date, a category, a file (kept in Church & Trellis, up to 15 MB) or a
 * link to where it is kept, and says who can see it. Off until an Administrator switches it on (Settings → Apps).
 * The Archive is part of the Library and is available only to Administrators and Council members; within that group,
 * each record keeps its existing visibility rule (everyone / a leadership group / Administrators and Pastors / private).
 * Administrators add records and see them all.
 * Records sit in folders (the church's categories; a folder may be inside another). A folder that sorts by date shows
 * Year → Month folders made from each record's date. Before saving, Church & Trellis says where the record will go and asks
 * about a date that looks wrong; the summary can be switched off on a device (Store.pref 'archiveAsk'), the date
 * questions can't. Administrators make and change folders.
 * Opening a record that isn't for everyone is written in the audit log. Rules: js/archive.js (tested), firestore.rules (archive). */
(function () {
  'use strict';
  var H = Hub, esc = H.esc, S = Store, T = I18n.t, TN = I18n.tn, A = Archive;
  var BOX = 'M3 5h18v4H3zM5 9v10h14V9M10 13h4';
  var PEN = 'M4 20h4L20 8l-4-4L4 16zM14 6l4 4';
  var FOLDER = 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z';
  var state = { q: '', folder: '', yr: '', mo: 0 };
  var previewUrl = '', previewObserver = null, previewTimer = 0;

  function me() { return H.user(); }
  function administrator() { return H.can('*') && !S.preview(); }
  function who() {
    var u = me(), admin = administrator(), bodies = u && window.LeadersUI ? LeadersUI.mine(u.id) : [];
    return { admin: admin, council: !S.preview() && !!u && bodies.some(function (id) { var b = S.get('leaderBodies', id); return b && /council/i.test(b.name || ''); }),
      pastor: !admin && H.can('people.edit'), senior: !admin && !!u && u.appRole === 'pastor' && (S.settings() || {}).seniorPastorId === u.id,
      ids: u ? [u.id] : [], bodies: bodies };
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
  /** Folders in the order of the tree, each with its path ("Plans › Hall extension"), for a dropdown. */
  function tree(skip) {
    var out = [], st = S.settings(), no = skip ? A.under(st, skip) : [];
    (function walk(parent, depth) { A.kids(st, parent).forEach(function (c) { if (no.indexOf(c.id) >= 0) return; out.push({ c: c, depth: depth, path: A.path(st, c.id).map(function (x) { return T(x.name); }).join(' › ') }); walk(c.id, depth + 1); }); })('', 0);
    return out;
  }
  /** A month's name in the language in use (the five kept up to date, otherwise the browser's, otherwise English). */
  function monthName(m) {
    var lang = (typeof document !== 'undefined' && document.documentElement.lang) || 'en', list = A.MONTHS[lang];
    if (list) return list[m - 1];
    try { var x = new Date(2026, m - 1, 15).toLocaleString(lang, { month: 'long' }); if (x && !/^\d+$/.test(x)) return x; } catch (e) { /* fall back */ }
    return A.MONTHS.en[m - 1];
  }
  /** Where a record is (or will be) filed: "Council meetings › 2026 › November". */
  function place(catId, date) {
    var st = S.settings(), p = A.path(st, catId), c = p[p.length - 1], bits = p.map(function (x) { return T(x.name); });
    if (!p.length) bits = [T('Other records')];
    if (c && c.byDate && date) bits.push(String(date).slice(0, 4), monthName(+String(date).slice(5, 7)));
    return bits.join(' › ');
  }
  function asks() { return S.pref('archiveAsk') !== 'off'; }
  function folderAdmin() { return H.can('settings.manage') && !S.preview(); }
  function bodies() { return S.list('leaderBodies').slice().sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || '')); }); }
  function val(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }
  function accessText(r) {
    var b = r.bodyId ? S.get('leaderBodies', r.bodyId) : null, a = A.ACCESS.filter(function (x) { return x[0] === r.access; })[0];
    return r.access === 'body' ? (b ? b.name : T('The members of a leadership group')) : T(a ? a[1] : 'Administrators and the Senior Pastor only');
  }
  /** The little coloured "page" at the start of a document: what kind of file it is, at a glance. */
  var KINDS = { pdf: ['PDF', '#C0392B'], doc: ['DOC', '#2B6CB0'], docx: ['DOC', '#2B6CB0'], odt: ['DOC', '#2B6CB0'], rtf: ['DOC', '#2B6CB0'],
    xls: ['XLS', '#1F8A4C'], xlsx: ['XLS', '#1F8A4C'], csv: ['CSV', '#1F8A4C'], ppt: ['PPT', '#D9730D'], pptx: ['PPT', '#D9730D'],
    jpg: ['IMG', '#7C5CBF'], jpeg: ['IMG', '#7C5CBF'], png: ['IMG', '#7C5CBF'], gif: ['IMG', '#7C5CBF'], webp: ['IMG', '#7C5CBF'],
    txt: ['TXT', '#6B625A'], md: ['TXT', '#6B625A'] };
  function badge(r) {
    if (!r.file) return '<span class="ar-badge" style="--c:#0E7C86" aria-hidden="true">' + H.icon(H.ICON.link, 20) + '</span>';
    var ext = (String(r.file.name || '').toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || '', k = KINDS[ext] || [ext ? ext.slice(0, 4).toUpperCase() : 'FILE', '#6B625A'];
    return '<span class="ar-badge" style="--c:' + k[1] + '" aria-hidden="true">' + esc(k[0]) + '</span>';
  }
  function item(r, edit, where) {
    var bits = [H.fmt(r.date, true)];
    if (r.aboutName) bits.push(T('About {name}', { name: r.aboutName }));
    if (r.file) bits.push(r.file.name + ' (' + A.sizeText(r.file.size) + ')');
    return '<div class="item rec-item ar-item" data-find="' + esc([r.title, r.note, r.aboutName, r.file ? r.file.name : '', where ? place(r.cat, r.date) : ''].join(' ')) + '">' + badge(r) +
      '<span class="grow ar-body"><b data-own-words>' + esc(r.title) + '</b>' + (where ? '<small class="ar-where-tag">' + H.icon(FOLDER, 13) + ' ' + esc(place(r.cat, r.date)) + '</small>' : '') +
      '<small class="ar-meta">' + bits.map(esc).join(' · ') + '</small>' + (r.note ? (window.RichText && RichText.formatted(r.note) ? '<div class="rich small ar-note" data-own-words>' + RichText.html(r.note) + '</div>' : '<small class="ar-note" data-own-words>' + esc(r.note) + '</small>') : '') +
      (edit ? '<small class="ar-tags"><span class="tag grey">' + H.icon(H.ICON.lock, 12) + ' ' + esc(accessText(r)) + '</span>' + (r.shownTo ? ' <span class="tag grey">' + esc(T('Shown to {name}', { name: r.aboutName })) + '</span>' : '') + '</small>' : '') + '</span><span class="rec-acts">' +
      (mayPreview(r) ? '<button class="btn small primary" data-act="archive:preview" data-id="' + esc(r.id) + '">' + H.icon(H.ICON.eye, 16) + T('Preview') + '</button>' : '') +
      (A.embedUrl(r.link) ? '<button class="btn small primary" data-act="archive:linkpreview" data-id="' + esc(r.id) + '">' + H.icon(H.ICON.eye, 16) + T('Preview') + '</button>' : '') +
      (r.file ? '<button class="btn small" data-act="archive:open" data-id="' + esc(r.id) + '">' + H.icon(H.ICON.download, 16) + T('Download') + '</button>' : '') +
      (A.link(r.link) ? '<a class="btn small" href="' + esc(A.link(r.link)) + '" target="_blank" rel="noopener noreferrer" data-act="archive:link" data-id="' + esc(r.id) + '">' + H.icon(H.ICON.link, 16) + T('Open the link') + '</a>' : '') +
      (edit ? '<button class="icon-btn ghost" data-act="archive:edit" data-id="' + esc(r.id) + '" aria-label="' + esc(T('Edit {name}', { name: r.title })) + '" title="' + esc(T('Edit')) + '">' + H.icon(PEN, 16) + '</button>' +
        '<button class="icon-btn ghost" data-act="archive:del" data-id="' + esc(r.id) + '" aria-label="' + esc(T('Delete {name}', { name: r.title })) + '" title="' + esc(T('Delete')) + '">' + H.icon(H.ICON.trash, 16) + '</button>' : '') + '</span></div>';
  }
  /** A date-sorted folder is usually filed monthly: the months of this year with nothing filed yet (up to last month), for the people who file them. */
  function gaps(recs, catId, yr) {
    var now = H.today(), m = +now.slice(5, 7) - 1; if (m < 1 || yr !== now.slice(0, 4)) return '';
    var miss = A.missingMonths(recs, catId, yr, yr + '-' + (m < 10 ? '0' : '') + m);
    return miss.length ? '<p class="note warn" style="margin:0 0 12px">' + esc(T('Nothing filed yet for: {months}', { months: miss.map(monthName).join(', ') + ' ' + yr })) + '</p>' : '';
  }
  /** Each folder keeps its own colour (made from its id, so it is the same every visit). */
  var HUES = ['#7A5C3E', '#B8430A', '#2B6CB0', '#1F8A4C', '#7C5CBF', '#0E7C86', '#B7791F', '#A23B72'];
  function hue(id) { var n = 0; String(id || '').split('').forEach(function (ch) { n += ch.charCodeAt(0); }); return HUES[n % HUES.length]; }
  var CAL = 'M3 6h18v14H3zM3 10h18M8 3v4M16 3v4';
  /** A folder (or a year or month inside one) as a tile to open: a coloured icon, its name, how much is in it. */
  function tile(attrs, name, sub, extra, o) {
    o = o || {};
    var lead = o.big ? '<span class="ar-big" aria-hidden="true">' + esc(o.big) + '</span>' : '<span class="ic">' + H.icon(o.icon || FOLDER, 22) + '</span>';
    return '<button class="appcard ar-folder' + (o.big ? ' ar-cal' : '') + '" data-act="archive:go"' + attrs + ' style="--c:' + (o.hue || HUES[0]) + '">' + lead +
      '<span class="ar-ft"><b data-own-words>' + esc(name) + '</b><span class="ar-sub">' + esc(sub) + '</span>' + (extra || '') + '</span><span class="ar-go" aria-hidden="true">›</span></button>';
  }
  function crumbs() {
    var st = S.settings(), bits = ['<button class="linkish" data-act="archive:go" data-folder="">' + T('Archives') + '</button>'], p = A.path(st, state.folder), last = p[p.length - 1];
    p.forEach(function (c) { bits.push('<button class="linkish" data-act="archive:go" data-folder="' + esc(c.id) + '" data-own-words>' + esc(T(c.name)) + '</button>'); });
    if (last && last.byDate && state.yr) bits.push('<button class="linkish" data-act="archive:go" data-folder="' + esc(last.id) + '" data-yr="' + esc(state.yr) + '">' + esc(state.yr) + '</button>');
    if (last && last.byDate && state.yr && state.mo) bits.push('<button class="linkish" data-act="archive:go" data-folder="' + esc(last.id) + '" data-yr="' + esc(state.yr) + '" data-mo="' + state.mo + '">' + esc(monthName(state.mo)) + '</button>');
    if (bits.length < 2) return '';
    bits[bits.length - 1] = bits[bits.length - 1].replace('<button class="linkish"', '<button class="linkish" aria-current="page"');
    return '<nav class="ar-crumbs" aria-label="' + esc(T('Folders')) + '">' + bits.join('<span aria-hidden="true">›</span>') + '</nav>';
  }
  /** What is inside the folder being looked at: folders first, then Year → Month folders or the documents themselves. */
  function browse(all, edit) {
    var st = S.settings(), f = state.folder ? A.cat(st, state.folder) : null, html = '', tiles = [], cal = false;
    var lock = function (c) { return edit ? '<small class="tag grey">' + H.icon(H.ICON.lock, 12) + ' ' + esc(accessText({ access: c.access, bodyId: '' })) + '</small>' : ''; };
    var sub = function (n) { return n ? TN('{n} record', '{n} records', n) : T('Empty'); };
    A.kids(st, f ? f.id : '').forEach(function (c) {
      var n = A.count(st, all, c.id);
      if (n || edit) tiles.push(tile(' data-folder="' + esc(c.id) + '"', T(c.name), sub(n), lock(c), { hue: hue(c.id) }));
    });
    if (!f) {
      var known = {}; cats().forEach(function (c) { known[c.id] = 1; });
      var stray = A.list(all, '', '').filter(function (r) { return !known[r.cat]; });
      html += tiles.length ? '<div class="cards ar-tiles">' + tiles.join('') + '</div>' : '';
      var latest = all.slice().sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); }).slice(0, 4);
      if (all.length >= 3) html += '<h2 class="ar-label">' + T('Latest documents') + '</h2><div class="list ar-docs">' + latest.map(function (r) { return item(r, edit, true); }).join('') + '</div>';
      if (stray.length) html += '<section class="panel ar-panel"><h2 style="margin:0 0 8px">' + T('Other records') + '</h2><div class="list">' + stray.map(function (r) { return item(r, edit); }).join('') + '</div></section>';
      return html;
    }
    var mine = A.list(all, f.id, ''), recs = [], h = hue(f.id);
    if (f.byDate && !state.yr) { cal = true; A.years(mine).forEach(function (y) { tiles.push(tile(' data-folder="' + esc(f.id) + '" data-yr="' + esc(y) + '"', y, sub(A.list(mine, f.id, y).length), '', { hue: h, icon: CAL })); }); }
    else if (f.byDate && !state.mo) { cal = true; A.months(mine, state.yr).forEach(function (x) { tiles.push(tile(' data-folder="' + esc(f.id) + '" data-yr="' + esc(state.yr) + '" data-mo="' + x.m + '"', monthName(x.m), sub(x.n), '', { hue: h, big: monthName(x.m).slice(0, 3) })); }); }
    else recs = f.byDate ? A.inMonth(mine, f.id, state.yr, state.mo) : mine;
    var title = state.mo ? monthName(state.mo) + ' ' + state.yr : state.yr || T(f.name);
    html += '<div class="ar-head"><h2 data-own-words>' + esc(title) + '</h2>' + (edit ? '<span class="tag grey">' + H.icon(H.ICON.lock, 12) + ' ' + esc(accessText({ access: f.access, bodyId: '' })) + '</span>' : '') + '</div>';
    if (edit && f.byDate && state.yr && !state.mo) html += gaps(all, f.id, state.yr);
    if (tiles.length) html += '<div class="cards ar-tiles' + (cal ? ' ar-cals' : '') + '">' + tiles.join('') + '</div>';
    if (recs.length) html += '<div class="list ar-docs">' + recs.map(function (r) { return item(r, edit); }).join('') + '</div>';
    if (!tiles.length && !recs.length) html += '<div class="empty ar-empty">' + H.icon(BOX, 34) + '<p>' + T('Nothing in this folder yet.') + '</p>' + (edit ? '<button class="btn primary" data-act="archive:add">' + H.icon(H.ICON.plus, 16) + T('Add a record') + '</button>' : '') + '</div>';
    return html;
  }
  function page(tabs) {
    tabs = tabs || '';
    if (!canAccess()) return '<div class="page-head"><div><h1>' + T('Archives') + '</h1></div></div>' + tabs + '<p class="note warn" role="status">' +
      T('Restricted View — Access restricted to Council members and Administrators only.') + '</p>';
    var edit = keeper(), all = visible(), st = S.settings();
    if (state.folder && !A.cat(st, state.folder)) state.folder = '', state.yr = '', state.mo = 0;
    var f = state.folder ? A.cat(st, state.folder) : null;
    if (!f || !f.byDate) state.yr = '', state.mo = 0;
    var more = ['<button data-act="archive:storageinfo"><span aria-hidden="true">ⓘ</span> ' + T('Where are documents stored?') + '</button>'];
    if (edit) more.push('<button data-act="archive:asks" role="menuitemcheckbox" aria-checked="' + asks() + '">' + (asks() ? '✓ ' : '') + T('Show a summary before saving') + '</button>');
    if (folderAdmin()) {
      more.unshift('<button data-act="archive:newfolder">' + H.icon(FOLDER, 16) + T(f ? 'New folder inside this one' : 'New folder') + '</button>');
      if (f) more.splice(1, 0, '<button data-act="archive:folder" data-id="' + esc(f.id) + '">' + H.icon(PEN, 16) + T('Change this folder') + '</button>');
    }
    var html = '<div class="page-head"><div><h1>' + T('Archives') + '</h1><p class="lead">' + T('The church’s records, kept safely in one place. Each record says who can see it.') + '</p></div>' +
      '<div class="btns">' + (edit ? '<button class="btn primary" data-act="archive:add">' + H.icon(H.ICON.plus, 16) + T('Add a record') + '</button>' : '') + H.menu(T('More'), more) + '</div></div>' + tabs;
    if (!all.length && !folderAdmin()) return html + '<div class="empty ar-empty">' + H.icon(BOX, 34) + '<p>' + T('No records yet.') + '</p></div>';
    if (all.length) html += '<label class="search ar-search">' + H.icon(H.ICON.search, 18) + '<span class="sr">' + T('Search the archive') + '</span><input id="ar-q" type="search" placeholder="' + esc(T('Search the archive')) + '" value="' + esc(state.q) + '" autocomplete="off"></label>';
    html += '<div id="ar-browse">' + crumbs() + (!all.length && !f ? '<div class="empty ar-empty">' + H.icon(BOX, 34) + '<p>' + T('No records yet.') + '</p>' + (edit ? '<button class="btn primary" data-act="archive:add">' + H.icon(H.ICON.plus, 16) + T('Add a record') + '</button>' : '') + '</div>' : '') + browse(all, edit) + '</div>';
    html += '<div id="ar-results" class="list" hidden>' + A.list(all, '', '').map(function (r) { return item(r, edit, true); }).join('') + '</div>';
    return html + '<p class="empty" id="ar-none" hidden>' + T('Nothing matches.') + '</p>';
  }
  /** Searching looks through every folder at once, and shows where each document is. */
  function applySearch() {
    var q = state.q.trim(), shown = 0, res = document.getElementById('ar-results'), br = document.getElementById('ar-browse');
    if (!res) return;
    res.hidden = !q; if (br) br.hidden = !!q;
    [].forEach.call(res.querySelectorAll('.ar-item'), function (it) { var hit = !!q && H.matches(it.dataset.find, q); it.hidden = !hit; if (hit) shown++; });
    var none = document.getElementById('ar-none'); if (none) none.hidden = !q || shown > 0;
  }

  /* ---------- adding and changing a record ---------- */
  function staff(keep) { return S.find('people', function (p) { return p.id === keep || (p.category === 'Staff' && p.active !== false && !p.binnedAt && !p.mergedInto); }).sort(function (a, b) { return H.name(a).localeCompare(H.name(b)); }); }
  function showParts() {
    var c = A.cat(S.settings(), val('ar-cat')), body = document.getElementById('ar-body-wrap'), about = document.getElementById('ar-about-wrap'); if (!body) return;
    body.hidden = val('ar-access') !== 'body';
    about.hidden = !((c && c.person) || val('ar-about'));
  }
  function foot(id) { return '<button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn save" data-act="archive:save" data-id="' + esc(id || '') + '">' + T('Save') + '</button>'; }
  /** Under the date: the folder it will land in, so a wrong date is noticed while typing. */
  function showWhere() {
    var w = document.getElementById('ar-where'), c = A.cat(S.settings(), val('ar-cat')); if (!w) return;
    w.textContent = c && val('ar-date') ? T('It will be filed in: {place}', { place: place(c.id, val('ar-date')) }) : '';
  }
  function form(r) {
    var isNew = !r.id, bs = bodies(), council = bs.filter(function (b) { return /council/i.test(b.name); })[0] || bs[0];
    var opt = function (v, text, cur) { return '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(text) + '</option>'; };
    var folders = tree().map(function (x) { return opt(x.c.id, x.path, r.cat); }).join('');
    H.modal(H.dialogHead(isNew ? T('Add a record') : T('Edit {name}', { name: r.title })) + '<div class="dlg-body"><div id="ar-form">' +
      '<label class="field req">' + T('Title') + '<input id="ar-title" maxlength="150" value="' + esc(r.title || '') + '"></label>' +
      '<div class="two"><label class="field req">' + T('Folder') + '<select id="ar-cat"' + (isNew ? ' data-new="1"' : '') + '>' + folders + (r.cat && !A.cat(S.settings(), r.cat) ? opt(r.cat, T('Other records'), r.cat) : '') + '</select></label>' +
      '<label class="field req">' + T('Date') + '<input type="date" id="ar-date" value="' + esc(r.date || H.today()) + '"></label></div>' +
      '<p class="hint ar-where" id="ar-where" aria-live="polite"></p>' +
      '<label class="field req">' + T('Who can see it') + '<select id="ar-access">' + A.ACCESS.map(function (a) { return opt(a[0], T(a[1]), r.access); }).join('') + '</select><small>' + T('Administrators see every record. Council members see records allowed by their access.') + '</small></label>' +
      '<div id="ar-body-wrap"><label class="field req">' + T('Leadership group') + '<select id="ar-body"><option value="">' + T('Choose…') + '</option>' + bs.map(function (b) { return opt(b.id, b.name, r.bodyId || (isNew && council ? council.id : '')); }).join('') + '</select>' +
      '<small>' + T('Leadership groups are set up on the Leadership page.') + '</small></label></div>' +
      '<div id="ar-about-wrap"><label class="field">' + T('The staff member it is about') + '<select id="ar-about"><option value="">' + T('No one') + '</option>' + staff(r.aboutId).map(function (p) { return opt(p.id, H.name(p), r.aboutId); }).join('') + '</select></label>' +
      '<label class="check"><input type="checkbox" id="ar-shown"' + (r.shownTo || (isNew && !r.aboutId) ? ' checked' : '') + '><span>' + T('They can see this record themselves') + '</span></label></div>' +
      '<label class="field">' + (r.file ? T('Replace the file') + ' <span class="muted small">(' + esc(r.file.name) + ')</span>' : T('File (up to 15 MB)')) + '<input type="file" id="ar-file"></label>' +
      '<label class="field">' + T('Or a link to where it is kept') + '<input id="ar-link" type="url" maxlength="500" value="' + esc(r.link || '') + '" placeholder="https://"></label>' +
      (administrator() ? '<label class="check"><input type="checkbox" id="ar-app-doc"' + (r.displayOnApplication ? ' checked' : '') + '><span>' + T('Display on Membership Application Form') + '<br><small class="muted">' + T('Everyone who can sign in can read this document.') + '</small></span></label>' : '') +
      '<div class="field"><label for="ar-note">' + T('Note') + '</label>' + (window.RichText ? RichText.tools('ar-note', { bar: T('Formatting'), b: T('Bold'), i: T('Italic'), u: T('Underline'), h: T('Heading'), ul: T('Bulleted list'), ol: T('Numbered list') }) : '') + '<textarea id="ar-note" rows="3" maxlength="1000">' + esc(r.note || '') + '</textarea></div>' +
      '<p id="ar-err" class="note bad" hidden></p></div><div id="ar-check" hidden></div></div>' +
      '<div class="dlg-foot" id="ar-foot">' + foot(r.id) + '</div>', T('Add a record'));
    showParts(); showWhere();
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
    if (window.ChurchHubApp) { H.toast(T('Please update the Church & Trellis app to download files, or use a browser.'), true); return; }
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
    if (previewTimer) { clearTimeout(previewTimer); previewTimer = 0; }
    if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = ''; }
  }
  function linkedPreviewDialog(r) {
    var embed = A.embedUrl(r.link); if (!embed) return;
    H.modal(H.dialogHead(T('Preview'), r.title) + '<div class="dlg-body ar-preview-body"><p class="ar-preview-meta">' + esc(catName(r.cat) + ' · ' + H.fmt(r.date, true)) + '</p>' +
      '<p id="ar-doc-loading" class="note" role="status" aria-live="polite">' + T('Loading preview…') + '</p>' +
      '<p id="ar-doc-fallback" class="note warn" role="status" hidden>' + T('The preview did not load. Check the document’s sharing settings, or open it in Google Docs.') + '</p>' +
      '<iframe id="ar-doc-preview" class="ar-preview-frame" src="' + esc(embed) + '" title="' + esc(r.title) + '" loading="eager" referrerpolicy="no-referrer"></iframe>' +
      '<p class="hint">' + T('If you cannot see the document, check its sharing settings or open it in Google Docs.') + '</p></div>' +
      '<div class="dlg-foot"><a class="btn" href="' + esc(A.link(r.link)) + '" target="_blank" rel="noopener noreferrer" data-act="archive:link" data-id="' + esc(r.id) + '">' + T('Open in Google Docs') + '</a>' +
      '<button class="btn primary" data-act="hub:close">' + T('Close') + '</button></div>', T('Preview'), true);
    var dialog = document.querySelector('#modal .dialog'), modal = document.getElementById('modal'), frame = document.getElementById('ar-doc-preview');
    if (dialog) dialog.classList.add('ar-preview-dialog');
    if (frame) frame.addEventListener('load', function () {
      var loading = document.getElementById('ar-doc-loading'); if (loading) loading.hidden = true;
      if (previewTimer) { clearTimeout(previewTimer); previewTimer = 0; }
    });
    previewTimer = setTimeout(function () {
      var loading = document.getElementById('ar-doc-loading'), fallback = document.getElementById('ar-doc-fallback');
      if (loading && !loading.hidden && fallback) fallback.hidden = false;
    }, 10000);
    if (modal) {
      previewObserver = new MutationObserver(function () {
        if (!modal.querySelector('.ar-preview-dialog')) clearPreviewUrl();
      });
      previewObserver.observe(modal, { childList: true, subtree: true });
    }
    logPreview(r);
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
  /* ---------- before saving: where it will go, and a date that looks wrong ---------- */
  function fmtDate(d) { return H.fmt(d, true); }
  /** The questions about a date, in plain words, each with a button that puts the suggested date in. */
  function warning(w, rec, recs) {
    var fix = w.date ? '<button class="btn small" data-act="archive:usedate" data-date="' + esc(w.date) + '">' + esc(T('Use {date}', { date: fmtDate(w.date) })) + '</button>' : '';
    var when = w.m ? monthName(w.m) + (w.y ? ' ' + w.y : '') : String(w.y || '');
    var text = {
      future: T('The date, {date}, hasn’t come yet. Is that right?', { date: fmtDate(rec.date) }),
      old: T('The year {year} looks like a typing slip.', { year: rec.date.slice(0, 4) }),
      named: T('The title or file name speaks of {when}, but the date is {date}.', { when: when, date: fmtDate(rec.date) }),
      meeting: T('The other documents for {month} are dated {date}. Is this for the same meeting?', { month: monthName(+rec.date.slice(5, 7)) + ' ' + rec.date.slice(0, 4), date: fmtDate(w.date) }),
      same: T('There is already a document called “{title}” in {place}.', { title: rec.title, place: place(rec.cat, rec.date) })
    }[w.code];
    return '<div class="note warn ar-warn" data-code="' + w.code + '"><span>' + esc(text) + '</span>' + (fix ? ' ' + fix : '') + '</div>';
  }
  /** Shows, in the same dialog, what Church & Trellis is about to do – and any question about the date – before saving. */
  function review(rec, old, file, warns) {
    var box = document.getElementById('ar-check'), formEl = document.getElementById('ar-form'), ft = document.getElementById('ar-foot'); if (!box) return;
    var c = A.cat(S.settings(), rec.cat), to = place(rec.cat, rec.date), from = old ? place(old.cat, old.date) : '', lines = [];
    var sameMonth = S.list('archive').filter(function (r) { return r.cat === rec.cat && r.id !== rec.id && String(r.date || '').slice(0, 7) === rec.date.slice(0, 7); });
    lines.push(old && from !== to ? T('Move “{title}” from {from} to {to}.', { title: rec.title, from: from, to: to }) : T((old ? 'Keep “{title}” in {place}.' : 'File “{title}” in {place}.'), { title: rec.title, place: to }));
    if (c && c.byDate && !sameMonth.length) lines.push(T('It is the first document for {month}, so that folder will appear by itself.', { month: monthName(+rec.date.slice(5, 7)) + ' ' + rec.date.slice(0, 4) }));
    lines.push(T('Who can see it: {who}.', { who: accessText(rec) }));
    if (rec.shownTo) lines.push(T('{name} can see it too.', { name: rec.aboutName }));
    if (file) lines.push(T('Keep {file} ({size}) in Church & Trellis.', { file: file.name, size: A.sizeText(file.size) }));
    else if (rec.link && (!old || old.link !== rec.link)) lines.push(T('Keep a link to where it is kept.'));
    if (rec.displayOnApplication && !(old && old.displayOnApplication)) lines.push(T('Show it on the Membership Application Form, where everyone who signs in can read it.'));
    box.innerHTML = (warns.length ? '<h3 class="ar-check-h">' + T('Please check the date') + '</h3>' + warns.map(function (w) { return warning(w, rec); }).join('') : '') +
      '<h3 class="ar-check-h">' + T('Here’s what Church & Trellis is about to do') + '</h3><ul class="ar-plan">' + lines.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>' +
      (asks() ? '<label class="set-row ar-noask"><span class="set-l"><b>' + T('Don’t show this summary again') + '</b><small>' + T('Save straight away from now on. Church & Trellis will still ask when a date looks wrong. You can switch it back on under More.') + '</small></span><span class="set-c sw"><input type="checkbox" role="switch" id="ar-noask" aria-label="' + esc(T('Don’t show this summary again')) + '"></span></label>' : '');
    formEl.hidden = true; box.hidden = false; keyNote(true);
    ft.innerHTML = '<button class="btn" data-act="archive:back">' + T('Go back and change it') + '</button><button class="btn primary save" data-act="archive:save" data-id="' + esc(old ? old.id : '') + '" data-sure="1">' + T(warns.length ? 'Save anyway' : 'Save') + '</button>';
    var first = ft.querySelector('.save'); if (first) first.focus();
  }
  /** The "shaded boxes" key means nothing on the summary. */
  function keyNote(hide) { var k = document.querySelector('#modal .req-key'); if (k) k.hidden = hide; }
  function back() {
    var box = document.getElementById('ar-check'), formEl = document.getElementById('ar-form'), ft = document.getElementById('ar-foot'), sv = ft && ft.querySelector('.save'); if (!box) return;
    box.hidden = true; formEl.hidden = false; ft.innerHTML = foot(sv ? sv.dataset.id : ''); keyNote(false);
  }

  /* ---------- folders (Administrators) ---------- */
  function folderDialog(f, parent) {
    var isNew = !f, c = f || { id: '', name: '', access: (A.cat(S.settings(), parent) || {}).access || 'office', parent: parent || '', byDate: false };
    var used = isNew ? 0 : A.count(S.settings(), S.list('archive'), c.id), inner = isNew ? 0 : A.kids(S.settings(), c.id).length;
    var opt = function (v, text, cur) { return '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(text) + '</option>'; };
    H.modal(H.dialogHead(isNew ? T('New folder') : T('Change this folder'), T('Folders keep the church’s records in order, like folders on a computer.')) + '<div class="dlg-body">' +
      '<label class="field req">' + T('Name') + '<input id="af-name" maxlength="60" value="' + esc(c.name ? T(c.name) : '') + '"></label>' +
      '<label class="field">' + T('Inside') + '<select id="af-parent"><option value="">' + T('At the top of the Archives') + '</option>' + tree(c.id || null).map(function (x) { return opt(x.c.id, x.path, c.parent); }).join('') + '</select></label>' +
      '<label class="field">' + T('Who can see new documents in it') + '<select id="af-access">' + A.ACCESS.map(function (a) { return opt(a[0], T(a[1]), c.access); }).join('') + '</select><small>' + T('Each document can still be changed. Documents already in the folder keep who can see them.') + '</small></label>' +
      '<label class="set-row"><span class="set-l"><b>' + T('Sort by year and month') + '</b><small>' + T('Church & Trellis puts each document into a year and a month by its date – for meetings held every month. Nobody has to make the year and month folders.') + '</small></span><span class="set-c sw"><input type="checkbox" role="switch" id="af-bydate"' + (c.byDate ? ' checked' : '') + ' aria-label="' + esc(T('Sort by year and month')) + '"></span></label>' +
      '<p id="af-err" class="note bad" hidden></p></div>' +
      '<div class="dlg-foot">' + (isNew ? '' : '<button class="btn ar-del" data-act="archive:folderdel" data-id="' + esc(c.id) + '"' + (used || inner ? ' disabled title="' + esc(T('Move or delete what is in it first.')) + '"' : '') + '>' + H.icon(H.ICON.trash, 16) + T('Delete') + '</button><span class="grow"></span>') +
      '<button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn save" data-act="archive:foldersave" data-id="' + esc(c.id) + '">' + T('Save') + '</button></div>', isNew ? T('New folder') : T('Change this folder'));
  }
  function storageDialog() {
    if (!canAccess()) return;
    H.modal(H.dialogHead(T('Where are documents stored?')) + '<div class="dlg-body"><p class="hint">' +
      esc(T('Physical documents: [add shelf/cabinet and filing details]. Uploaded files are stored in the church’s Firestore database in South Africa. Linked files stay in their cloud folder: [add provider and folder details]. Replace these placeholders with the church’s actual locations.')) +
      '</p></div><div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Close') + '</button></div>', T('Where are documents stored?'));
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('input', function (ev) { if (ev.target.id === 'ar-q') { state.q = ev.target.value; applySearch(); } else if (ev.target.id === 'ar-date') showWhere(); });
    document.addEventListener('change', function (ev) {
      var id = ev.target.id;
      if (id === 'ar-cat') {
        var c = A.cat(S.settings(), ev.target.value), acc = document.getElementById('ar-access');
        if (c && acc && ev.target.dataset.new) acc.value = c.access;   // a new record starts with its folder's "who can see it"
        showParts(); showWhere();
      } else if (id === 'ar-date') showWhere();
      else if (id === 'ar-access' || id === 'ar-about') showParts();
    });
  }

  /** Opens the folder (and year and month) a record is in. */
  function show(id) {
    var r = S.get('archive', id), c = r && A.cat(S.settings(), r.cat); if (!r) return;
    state.q = ''; state.folder = c ? c.id : ''; state.yr = c && c.byDate ? A.year(r) : ''; state.mo = c && c.byDate ? A.month(r) : 0; H.render();
  }
  window.ArchiveUI = { page: page, after: applySearch, canAccess: canAccess, show: show };
  H.register({
    id: 'archive', name: 'Archives', desc: 'Minutes, plans, contracts and other church records', icon: BOX, tint: '#7A5C3E', optIn: true, inLibrary: true,
    show: function () { return false; },
    render: function () { return ''; },
    after: function () { applySearch(); },
    stat: function () { return TN('{n} record', '{n} records', visible().length); },
    actions: {
      add: function () {
        if (!keeper()) return;
        var c = A.cat(S.settings(), state.folder) || cats()[0] || { id: 'other', access: 'office' }, date = H.today();
        if (c.byDate && state.yr && state.mo) {   // looking at a month: the date its other documents have (likely the same meeting), or its first day
          var ym = state.yr + '-' + (state.mo < 10 ? '0' : '') + state.mo, there = A.inMonth(S.list('archive'), c.id, state.yr, state.mo)[0];
          if (date.slice(0, 7) !== ym) date = there ? there.date : ym + '-01';
        }
        form({ cat: c.id, access: c.access, date: date });
      },
      edit: function (el) { var r = S.get('archive', el.dataset.id); if (r && keeper()) form(r); },
      save: function (el) {
        if (!keeper()) return;
        var old = el.dataset.id ? S.get('archive', el.dataset.id) : null, err = document.getElementById('ar-err');
        var bad = function (msg) { back(); err = document.getElementById('ar-err'); err.textContent = msg; err.hidden = false; };
        var f = document.getElementById('ar-file'), file = f && f.files && f.files[0], access = val('ar-access'), about = val('ar-about') ? S.get('people', val('ar-about')) : null, typed = val('ar-link');
        if (!val('ar-title') || !val('ar-date')) return bad(T('Shaded boxes must be filled in.'));
        if (access === 'body' && !val('ar-body')) return bad(T('Choose the leadership group that can see it.'));
        if (file && file.size > A.MAX) return bad(T('That file is too big (15 MB at most). Keep it somewhere like Google Drive and paste its link here.'));
        if (typed && !A.link(typed)) return bad(T('That link doesn’t look like a web address.'));
        if (!file && !(old && old.file) && !typed) return bad(T('Add a file or a link.'));
        var u = me(), rec = A.clean({ id: old ? old.id : S.uid('ar'), createdAt: old && old.createdAt, title: val('ar-title'), cat: val('ar-cat'), date: val('ar-date'), note: val('ar-note'), access: access, bodyId: val('ar-body'),
            aboutId: about ? about.id : '', aboutName: about ? H.name(about) : '', shownTo: !!about && document.getElementById('ar-shown').checked, link: A.link(typed),
            displayOnApplication: administrator() ? !!document.getElementById('ar-app-doc').checked : !!(old && old.displayOnApplication), file: old && old.file, by: old ? old.by : (u ? H.name(u) : '') });
        if (!administrator() && !A.sees(rec, who())) return bad(T('You wouldn’t be able to see this record yourself. Under “Who can see it”, choose a group you belong to.'));
        if (old && old.displayOnApplication && !administrator() &&
          (rec.title !== old.title || rec.date !== old.date || rec.link !== old.link || !!file)) {
          return bad(T('Only an Administrator can change a document displayed on the membership form.'));
        }
        if (!el.dataset.sure) {
          var fc = A.cat(S.settings(), rec.cat), warns = A.checkDate({ date: rec.date, title: rec.title, fileName: file ? file.name : (old && old.file ? old.file.name : ''), today: H.today(),
            byDate: !!(fc && fc.byDate), recs: S.list('archive').filter(function (x) { return x.cat === rec.cat; }), id: rec.id });
          if (warns.length || asks() || el.dataset.review) { err.hidden = true; review(rec, old, file, warns); return; }
        } else if (document.getElementById('ar-noask') && document.getElementById('ar-noask').checked) S.pref('archiveAsk', 'off');
        var why = (old ? 'Changed the archive record “' : 'Added to the archive: “') + rec.title + '” (' + place(rec.cat, rec.date) + '; seen by: ' + rec.access + (rec.shownTo ? ' and the person it is about' : '') + ')';
        var done = function () { H.closeModal(); H.render(); H.toast(T('Saved')); if (file && !S.isLive()) H.toast(T('The demo keeps files only until you close the page.')); };
        var syncRecord = function () {
          if (old && old.displayOnApplication && !administrator()) { S.put('archive', rec, why); return Promise.resolve(); }
          if (old && old.displayOnApplication && !rec.displayOnApplication) {
            return S.removeApplicationDocument(rec.id, old.file && old.file.parts).then(function () { S.put('archive', rec, why); });
          }
          S.put('archive', rec, why);
          return rec.displayOnApplication ? S.publishApplicationDocument(rec) : Promise.resolve();
        };
        var fail = function (e) { console.error(e); bad(T(e && e.message && e.message.indexOf('publish') >= 0 ? 'Couldn’t publish this document to the membership form. Please try again.' : 'Couldn’t save the record. Please try again.')); };
        if (!file) { Promise.resolve(syncRecord()).then(done, fail); return; }
        H.busy(T('Saving the file…'), function () {
          return readFile(file).then(function (b64) {
            var parts = A.split(b64);
            return S.saveFile(rec.id, parts, (old && old.file && old.file.parts) || 0).then(function () {
              rec.file = { name: file.name.slice(0, 150), type: file.type || '', size: file.size, parts: parts.length };
            });
          });
        }).then(syncRecord).then(done, fail);
      },
      del: function (el) {
        var r = S.get('archive', el.dataset.id); if (!r || !keeper() || !H.confirmBtn(el, '✕?')) return;
        if (r.displayOnApplication && !administrator()) { H.toast(T('Only an Administrator can remove a document displayed on the membership form.'), true); return; }
        var remove = r.displayOnApplication ? S.removeApplicationDocument(r.id, r.file && r.file.parts) : Promise.resolve();
        remove.then(function () { S.remove('archive', r.id, 'Deleted the archive record “' + r.title + '” (' + catName(r.cat) + ')'); H.render(); H.toast(T('Deleted')); })
          .catch(function (e) { console.error(e); H.toast(T('Couldn’t remove the document from the membership form. Please try again.'), true); });
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
      linkpreview: function (el) {
        var r = S.get('archive', el.dataset.id);
        if (canAccess() && r && A.sees(r, who()) && A.embedUrl(r.link)) linkedPreviewDialog(r);
      },
      previewdownload: function (el) {
        var r = S.get('archive', el.dataset.id);
        if (canAccess() && r && mayPreview(r)) downloadRecord(r);
      },
      link: function (el) { var r = S.get('archive', el.dataset.id); if (canAccess() && r && A.sees(r, who())) logOpen(r); },   // the link itself opens in a new tab
      storageinfo: function () { storageDialog(); },
      go: function (el) {
        state.folder = el.dataset.folder || ''; state.yr = el.dataset.yr || ''; state.mo = +el.dataset.mo || 0; state.q = '';
        H.render(); var h = document.querySelector('.ar-crumbs [aria-current]') || document.querySelector('h1'); if (h && h.focus) h.focus();
      },
      usedate: function (el) {
        var d = document.getElementById('ar-date'), sv = document.querySelector('#ar-foot .save'); if (!d || !sv) return;
        d.value = el.dataset.date; showWhere(); back();
        H.toast(T('Date changed to {date}', { date: fmtDate(el.dataset.date) }));
        var again = document.querySelector('#ar-foot .save'); if (again) { again.dataset.review = '1'; again.click(); }   // show the summary again with the new date
      },
      back: function () { back(); },
      asks: function () { S.pref('archiveAsk', asks() ? 'off' : 'on'); H.render(); H.toast(asks() ? T('Church & Trellis will show a summary before saving') : T('Church & Trellis will save straight away (it still asks about a date that looks wrong)')); },
      newfolder: function () { if (folderAdmin()) folderDialog(null, state.folder); },
      folder: function (el) { var f = A.cat(S.settings(), el.dataset.id); if (f && folderAdmin()) folderDialog(f); },
      foldersave: function (el) {
        if (!folderAdmin()) return;
        var name = val('af-name').slice(0, 60), err = document.getElementById('af-err'), list = A.copy(cats()), id = el.dataset.id, parent = val('af-parent');
        if (!name) { err.textContent = T('Shaded boxes must be filled in.'); err.hidden = false; return; }
        if (id && A.under(S.settings(), id).indexOf(parent) >= 0) parent = '';   // never inside itself
        var f = id ? list.filter(function (c) { return c.id === id; })[0] : null;
        if (!f) { f = { id: S.uid('ac'), name: '', person: false }; list.push(f); }
        if (name !== T(f.name)) f.name = name;   // a starting folder keeps its English name (so it is translated) unless it was reworded
        f.parent = parent; f.access = val('af-access'); f.byDate = document.getElementById('af-bydate').checked;
        S.setSettings({ archiveCats: list }, (id ? 'Changed the Archive folder “' : 'Added the Archive folder “') + f.name + '” (' + f.access + (f.byDate ? ', sorted by year and month' : '') + ')');
        H.closeModal(); if (!id) { state.folder = f.id; state.yr = ''; state.mo = 0; } H.render(); H.toast(T('Saved'));
      },
      folderdel: function (el) {
        var id = el.dataset.id, st = S.settings(), f = A.cat(st, id); if (!f || !folderAdmin() || !H.confirmBtn(el, '✕?')) return;
        if (A.count(st, S.list('archive'), id) || A.kids(st, id).length) { H.toast(T('Move or delete what is in it first.'), true); return; }
        var list = cats().filter(function (c) { return c.id !== id; }); if (!list.length) { H.toast(T('Keep at least one folder'), true); return; }
        S.setSettings({ archiveCats: list }, 'Deleted the Archive folder “' + f.name + '”');
        state.folder = f.parent; state.yr = ''; state.mo = 0; H.closeModal(); H.render(); H.toast(T('Deleted'));
      }
    }
  });
})();
