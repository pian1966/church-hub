/* Church Hub – Library: the church's books, DVDs, CDs and more – what it has, how each was acquired, and who has borrowed what.
 * Everyone who signs in can look through the library, see whether something is in, read the library's policy, and sees what
 * they have out themselves. The librarians (Administrators, and one or two people chosen by an Administrator or the Senior
 * Pastor) add items with a picture of the cover, lend them – to people on the church's list or to visitors, always with a
 * mobile number so an item can be traced – and mark them as returned. Off until an Administrator switches it on
 * (Settings → Apps). Who borrowed what is seen only by the librarians and the borrower; returned loans are removed after a
 * year. Rules: js/library.js (tested), firestore.rules (books, loans, covers, libraryPolicy). */
(function () {
  'use strict';
  var H = Hub, esc = H.esc, S = Store, T = I18n.t, TN = I18n.tn, L = Library;
  var BOOKS = 'M4 4h4v16H4zM10 4h4v16h-4zM16.5 5.5l3.5-1 3 14-3.5 1z';
  var PEN = 'M4 20h4L20 8l-4-4L4 16zM14 6l4 4';
  var POLICY_FILE_MAX = 600 * 1024;   // an attached policy file: at most 600 KB (it is kept in one database document)
  var q = '', tidied = false;
  var newCover;            // the cover chosen in the form: undefined = unchanged, '' = taken away, else a picture (data: address)
  var policy;              // the library's policy: undefined until fetched, then null (none) or { text, name, type, data }
  var policyAsked = false, coverCache = {}, coverAsked = {}, coverSeen = null;

  function me() { return H.user(); }
  function librarian() { var u = me(); return !!u && L.isLibrarian(S.settings(), u.id, H.can('*')) && (H.can('*') || !S.preview()); }
  /** The Senior Pastor (Rector), who may choose the librarians and write the policy. */
  function senior() { var u = me(); return !!u && !S.preview() && H.isSenior(S.get('people', u.id) || u); }
  function chooses() { return H.can('settings.manage') || senior(); }
  function writesPolicy() { return librarian() || senior(); }
  function val(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }
  function loans() { return S.list('loans'); }
  function free(b) { return librarian() ? L.free(b, loans()) : L.free(b); }
  function everyone() { return S.find('people', function (p) { return p.active !== false && p.firstName !== 'Deleted' && !p.mergedInto && !p.binnedAt && p.category !== 'Deceased'; }).sort(function (a, b) { return H.name(a).localeCompare(H.name(b)); }); }
  function due(l) { return '<span class="' + (L.overdue(l, H.today()) ? 'tag bad' : 'muted') + '">' + esc(T('Due {date}', { date: H.fmt(l.due, true) })) + (L.overdue(l, H.today()) ? ' · ' + T('Overdue') : '') + '</span>'; }
  function cover(b, big) {
    return '<span class="lib-cover' + (big ? ' big' : '') + '"' + (b.cover ? ' data-cover="' + esc(b.id) + '" data-v="' + esc(b.cover) + '"' : '') + ' aria-hidden="true">' + (b.cover ? '' : H.icon(BOOKS, big ? 28 : 18)) + '</span>';
  }
  function bookRow(b, edit) {
    var n = free(b), copies = Math.max(1, +b.copies || 1), bits = [b.author, b.cat, b.shelf ? T('Shelf {shelf}', { shelf: b.shelf }) : ''].filter(Boolean);
    return '<div class="item rec-item lib-book" data-find="' + esc([b.title, b.author, b.cat, b.shelf, b.isbn, b.kind && b.kind !== 'Book' ? T(b.kind) + ' ' + b.kind : ''].join(' ')) + '">' + cover(b) +
      '<span class="grow"><b data-own-words>' + esc(b.title) + '</b> ' + (b.kind && b.kind !== 'Book' ? '<span class="tag">' + esc(T(b.kind)) + '</span> ' : '') +
      '<span class="tag ' + (n ? 'ok' : 'grey') + '">' + (n ? T('Available') : T('On loan')) + (copies > 1 ? ' · ' + esc(T('{n} of {total}', { n: n, total: copies })) : '') + '</span>' +
      (bits.length ? '<small data-own-words>' + bits.map(esc).join(' · ') + '</small>' : '') +
      (edit && (b.how || b.from || b.acquired) ? '<small class="muted">' + esc([b.how ? T(b.how) : '', b.from, b.acquired ? H.fmt(b.acquired, true) : ''].filter(Boolean).join(' · ')) + '</small>' : '') +
      (b.note ? '<small data-own-words>' + esc(b.note) + '</small>' : '') + '</span>' +
      (edit ? '<span class="rec-acts"><button class="btn small" data-act="library:lend" data-id="' + esc(b.id) + '"' + (n ? '' : ' disabled') + '>' + T('Lend') + '</button>' +
        '<button class="icon-btn ghost" data-act="library:edit" data-id="' + esc(b.id) + '" aria-label="' + esc(T('Edit {name}', { name: b.title })) + '" title="' + esc(T('Edit')) + '">' + H.icon(PEN, 16) + '</button>' +
        '<button class="icon-btn ghost" data-act="library:del" data-id="' + esc(b.id) + '" aria-label="' + esc(T('Delete {name}', { name: b.title })) + '" title="' + esc(T('Delete')) + '">' + H.icon(H.ICON.trash, 16) + '</button></span>' : '') + '</div>';
  }
  function who(l) {   // the borrower, with the mobile number for the librarians to trace the item
    return esc(l.name) + (l.visitor ? ' <span class="tag grey">' + T('Visitor') + '</span>' : '') + (l.mobile ? ' · <a href="tel:' + esc(l.mobile.replace(/[^\d+]/g, '')) + '">' + esc(l.mobile) + '</a>' : '');
  }
  function policyPanel() {
    var p = policy, edit = writesPolicy();
    if (!p && !edit) return '';
    if (!p) return '<section class="panel" id="lib-policy"><div class="row"><h2 class="grow" style="margin:0">' + T('Library policy') + '</h2><button class="btn small" data-act="library:policy">' + T('Add the policy') + '</button></div>' +
      '<p class="muted small" style="margin:6px 0 0">' + T('Paste in or upload the library’s policy, for everyone to read.') + '</p></section>';
    return '<section class="panel" id="lib-policy"><details' + (p.text && p.text.length < 400 ? ' open' : '') + '><summary><b>' + T('Library policy') + '</b></summary>' +
      (p.text ? '<div class="lib-policy-text" data-own-words>' + esc(p.text) + '</div>' : '') +
      '<div class="btns" style="margin-top:8px">' + (p.name && p.data ? '<button class="btn small" data-act="library:policyfile">' + H.icon(H.ICON.download || H.ICON.check, 16) + esc(T('Download {name}', { name: p.name })) + '</button>' : '') +
      (edit ? '<button class="btn small" data-act="library:policy">' + H.icon(PEN, 16) + T('Edit') + '</button>' : '') + '</div></details></section>';
  }
  function page() {
    var u = me(), edit = librarian(), books = L.find(S.list('books'), ''), mine = u ? L.mine(loans(), u.id) : [], out = edit ? L.onLoan(loans()) : [];
    var back = edit ? loans().filter(function (l) { return !!l.back; }).sort(function (a, b) { return String(b.back).localeCompare(String(a.back)); }).slice(0, 15) : [];
    var html = '<div class="page-head"><div><h1>' + T('Library') + '</h1><p class="lead">' + (edit ? T('The church’s library: add books, DVDs and more, lend them and mark them as returned. Only librarians and the borrower see who has what.') : T('The church’s library. To borrow something, ask a librarian.')) + '</p></div>' +
      (edit || chooses() ? '<div class="btns">' + (edit ? '<button class="btn primary" data-act="library:add">' + H.icon(H.ICON.plus, 16) + T('Add to the library') + '</button>' : '') +
        (chooses() ? '<button class="btn" data-act="library:libs">' + T('Librarians') + '</button>' : '') + '</div>' : '') + '</div>';
    html += policyPanel();
    if (mine.length) html += '<section class="panel" id="lib-mine"><h2>' + T('My books') + '</h2><div class="list">' + mine.map(function (l) {
      return '<div class="item"><span class="grow"><b data-own-words>' + esc(l.title) + '</b><small>' + due(l) + '</small></span></div>'; }).join('') + '</div></section>';
    if (edit) html += '<section class="panel" id="lib-out"><div class="row"><h2 class="grow" style="margin:0">' + T('On loan') + '</h2><span class="muted small">' + TN('{n} item', '{n} items', out.length) + '</span></div>' +
      (out.length ? '<div class="list" style="margin-top:8px">' + out.map(function (l) {
        return '<div class="item rec-item"><span class="grow"><b data-own-words>' + esc(l.title) + '</b><small>' + who(l) + ' · ' + esc(T('Lent {date}', { date: H.fmt(l.out, true) })) + ' · ' + due(l) + '</small></span>' +
          '<span class="rec-acts"><button class="btn small" data-act="library:back" data-id="' + esc(l.id) + '">' + H.icon(H.ICON.check, 16) + T('Returned') + '</button></span></div>';
      }).join('') + '</div>' : '<p class="muted small" style="margin:8px 0 0">' + T('Nothing on loan.') + '</p>') +
      (back.length ? '<details class="sub" style="margin-top:10px"><summary>' + T('Recently returned') + '</summary><div class="list">' + back.map(function (l) {
        return '<div class="item"><span class="grow"><b data-own-words>' + esc(l.title) + '</b><small>' + who(l) + ' · ' + esc(H.fmt(l.out, true) + ' – ' + H.fmt(l.back, true)) + '</small></span></div>'; }).join('') +
        '</div><p class="hint">' + T('Returned loans are removed after a year.') + '</p></details>' : '') + '</section>';
    if (!books.length) return html + '<p class="empty">' + T('Nothing in the library yet.') + '</p>';
    return html + '<section class="panel" id="lib-books"><div class="row" style="gap:10px;flex-wrap:wrap"><label class="search grow">' + H.icon(H.ICON.search, 18) + '<span class="sr">' + T('Search by title, author or category') + '</span>' +
      '<input id="lib-q" type="search" placeholder="' + esc(T('Search by title, author or category')) + '" value="' + esc(q) + '" autocomplete="off"></label><span class="muted small">' + TN('{n} item', '{n} items', books.length) + '</span></div>' +
      '<div class="list" style="margin-top:8px">' + books.map(function (b) { return bookRow(b, edit); }).join('') + '</div><p class="empty" id="lib-none" hidden>' + T('Nothing matches.') + '</p></section>';
  }
  function applySearch() {
    var s = q.trim(), shown = 0;
    [].forEach.call(document.querySelectorAll('.lib-book'), function (it) { var hit = !s || H.matches(it.dataset.find, s); it.hidden = !hit; if (hit) shown++; });
    var none = document.getElementById('lib-none'); if (none) none.hidden = !s || shown > 0;
  }

  /* ---------- cover pictures: fetched only when they come into view, then kept for this visit ---------- */
  function paintCover(el) {
    var key = el.getAttribute('data-cover') + '|' + el.getAttribute('data-v'), d = coverCache[key];
    if (d) { el.style.backgroundImage = 'url(' + d + ')'; el.classList.add('pic'); el.innerHTML = ''; }
  }
  function showCover(el) {
    var id = el.getAttribute('data-cover'), key = id + '|' + el.getAttribute('data-v');
    if (key in coverCache) return paintCover(el);
    (coverAsked[key] = coverAsked[key] || S.cover(id).then(function (d) { coverCache[key] = /^data:image\/(jpeg|png|webp);base64,/.test(d || '') ? d : ''; }))
      .then(function () { document.querySelectorAll('.lib-cover[data-cover="' + id + '"]').forEach(paintCover); });
  }
  function loadCovers() {
    var els = document.querySelectorAll('.lib-cover[data-cover]'); if (!els.length) return;
    if (typeof IntersectionObserver === 'undefined') { els.forEach(showCover); return; }
    if (!coverSeen) coverSeen = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { coverSeen.unobserve(e.target); showCover(e.target); } }); }, { rootMargin: '200px' });
    els.forEach(function (el) { coverSeen.observe(el); });
  }
  /** A photo of a cover → a small JPEG (at most 360 pixels on its longer side), keeping its shape. */
  function shrinkCover(file) {
    return new Promise(function (ok, fail) {
      if (!file || !/^image\//.test(file.type)) return fail(new Error('not a picture'));
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var k = Math.min(1, 360 / Math.max(img.naturalWidth, img.naturalHeight)), cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(img.naturalWidth * k)); cv.height = Math.max(1, Math.round(img.naturalHeight * k));
        var c = cv.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height); c.drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        var d = cv.toDataURL('image/jpeg', 0.8); if (d.length > 190000) d = cv.toDataURL('image/jpeg', 0.5);
        ok(d);
      };
      img.onerror = function () { URL.revokeObjectURL(url); fail(new Error('could not read')); };
      img.src = url;
    });
  }
  function coverPreview(b) {
    var el = document.getElementById('lib-cover-now'); if (!el) return;
    var d = newCover === undefined ? (b && b.cover ? coverCache[b.id + '|' + b.cover] : '') : newCover, has = newCover === undefined ? !!(b && b.cover) : !!newCover;
    el.innerHTML = d ? '<img src="' + esc(d) + '" alt="' + esc(T('Cover')) + '">' : has ? '<span class="muted small">' + T('Loading…') + '</span>' : '<span class="muted small">' + T('No picture yet.') + '</span>';
    var rm = document.getElementById('lib-cover-rm'); if (rm) rm.hidden = !has;
  }

  function form(b) {
    var isNew = !b.id, cats = L.cats(S.list('books'));
    newCover = undefined;
    H.modal(H.dialogHead(isNew ? T('Add to the library') : T('Edit {name}', { name: b.title })) + '<div class="dlg-body">' +
      '<div class="two"><label class="field req">' + T('What it is') + '<select id="lib-kind">' + L.KINDS.map(function (k) { return '<option value="' + esc(k) + '"' + ((b.kind || 'Book') === k ? ' selected' : '') + '>' + esc(T(k)) + '</option>'; }).join('') + '</select></label>' +
      '<label class="field req">' + T('Copies') + '<input id="lib-copies" type="number" min="1" max="99" value="' + esc(b.copies || 1) + '"></label></div>' +
      '<label class="field req">' + T('Title') + '<input id="lib-title" maxlength="150" value="' + esc(b.title || '') + '"></label>' +
      '<label class="field">' + T('Author') + '<input id="lib-author" maxlength="150" value="' + esc(b.author || '') + '"></label>' +
      '<div class="field"><span>' + T('Cover') + '</span><div class="lib-cover-pick"><div id="lib-cover-now" class="lib-cover-now"></div><div class="btns">' +
        '<label class="btn small">' + T('Take a photo') + '<input id="lib-cam" type="file" accept="image/*" capture="environment" hidden></label>' +
        '<label class="btn small">' + T('Choose a picture') + '<input id="lib-pic" type="file" accept="image/*" hidden></label>' +
        '<button type="button" class="btn small ghost" id="lib-cover-rm" data-act="library:coverrm" hidden>' + T('Remove the picture') + '</button></div></div></div>' +
      '<label class="field">' + T('Category') + '<input id="lib-cat" maxlength="60" list="lib-cats" value="' + esc(b.cat || '') + '"><datalist id="lib-cats">' + cats.map(function (c) { return '<option value="' + esc(c) + '">'; }).join('') + '</datalist></label>' +
      '<div class="two"><label class="field">' + T('How it was acquired') + '<select id="lib-how"><option value="">' + T('Choose…') + '</option>' + L.HOW.map(function (h) { return '<option value="' + esc(h) + '"' + (b.how === h ? ' selected' : '') + '>' + esc(T(h)) + '</option>'; }).join('') + '</select></label>' +
      '<label class="field">' + T('Date acquired') + '<input id="lib-acq" type="date" value="' + esc(isNew ? H.today() : b.acquired || '') + '"></label></div>' +
      '<label class="field">' + T('From (the donor or the shop)') + '<input id="lib-from" maxlength="150" value="' + esc(b.from || '') + '"></label>' +
      '<div class="two"><label class="field">' + T('Shelf') + '<input id="lib-shelf" maxlength="60" value="' + esc(b.shelf || '') + '"></label>' +
      '<label class="field">' + T('ISBN') + '<input id="lib-isbn" maxlength="20" value="' + esc(b.isbn || '') + '"></label></div>' +
      '<label class="field">' + T('Note') + '<textarea id="lib-note" rows="2" maxlength="500">' + esc(b.note || '') + '</textarea></label></div>' +
      '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn save" data-act="library:save" data-id="' + esc(b.id || '') + '">' + T('Save') + '</button></div>', T('Add to the library'));
    coverPreview(b);
    if (b.cover && !coverCache[b.id + '|' + b.cover]) S.cover(b.id).then(function (d) { coverCache[b.id + '|' + b.cover] = d || ''; coverPreview(b); });
    ['lib-cam', 'lib-pic'].forEach(function (id) {
      var inp = document.getElementById(id); if (!inp) return;
      inp.addEventListener('change', function () {
        var f = inp.files && inp.files[0]; inp.value = ''; if (!f) return;
        shrinkCover(f).then(function (d) { newCover = d; coverPreview(b); }, function () { H.toast(T('That isn’t a picture Church Hub can read.'), true); });
      });
    });
  }

  /* ---------- lending: to someone on the church's list, or to a visitor – always with a mobile number ---------- */
  function lendDialog(b, step) {
    var finder = window.CareUI && CareUI.finder; if (!finder) return;
    var body = '<label class="field req">' + T('Due back') + '<input type="date" id="lib-due" value="' + esc(val('lib-due') || L.addDays(H.today(), L.LOAN_DAYS)) + '"></label>';
    if (step && step.person) {
      var p = step.person;
      body += '<p>' + esc(T('{name} has no mobile number on record. Type one so the item can be traced.', { name: H.name(p) })) + '</p>' +
        '<label class="field req">' + T('Mobile number') + '<input id="lib-mob" type="tel" maxlength="30" autocomplete="off"></label>' +
        (H.can('people.edit') ? '<label class="check"><input type="checkbox" id="lib-mob-save" checked><span>' + T('Also save it in their details') + '</span></label>' : '') +
        '<p id="lib-err" class="note bad" hidden></p></div><div class="dlg-foot"><button class="btn" data-act="library:lend" data-id="' + esc(b.id) + '">' + T('Back') + '</button>' +
        '<button class="btn save" data-act="library:lendto" data-b="' + esc(b.id) + '" data-id="' + esc(p.id) + '">' + T('Lend') + '</button></div>';
    } else {
      body += '<label class="field req" style="margin-bottom:6px">' + T('Who is borrowing it') + '</label>' + finder('lib-lend', everyone(), 'library:lendto', { b: b.id }, null, T('Type part of their name')) +
        '<details class="sub" style="margin-top:12px"' + (step && step.visitor ? ' open' : '') + '><summary>' + T('Someone not on the church’s list') + '</summary>' +
        '<label class="field req">' + T('Name') + '<input id="lib-vname" maxlength="100" autocomplete="off"></label>' +
        '<label class="field req">' + T('Mobile number') + '<input id="lib-vmob" type="tel" maxlength="30" autocomplete="off"></label>' +
        '<button class="btn save" data-act="library:lendvisitor" data-b="' + esc(b.id) + '">' + T('Lend') + '</button></details>' +
        '<p id="lib-err" class="note bad" hidden></p></div><div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button></div>';
    }
    H.modal(H.dialogHead(T('Lend'), b.title) + '<div class="dlg-body">' + body, T('Lend'));
  }
  function lendErr(code) {
    var e = document.getElementById('lib-err'), msg = code === 'name' ? T('Type their name') : T('Type a mobile number (7 to 15 digits)');
    if (e) { e.textContent = msg; e.hidden = false; } else H.toast(msg, true);
  }
  function doLend(b, w) {
    var r = L.lend(b, w, H.today(), val('lib-due'), loans()); if (!r) { H.toast(T('Every copy is on loan.'), true); return false; }
    S.put('loans', r.loan, w.visitor ? 'Lent “' + b.title + '” to a visitor' : '');
    S.put('books', r.book);
    H.closeModal(); H.render(); H.toast(T('Lent to {name}', { name: r.loan.name }));
    return true;
  }

  /* ---------- the library's policy ---------- */
  function readFile(file) {
    return new Promise(function (ok, no) {
      var fr = new FileReader();
      fr.onload = function () { var s = String(fr.result || ''); ok(s.slice(s.indexOf(',') + 1)); };
      fr.onerror = function () { no(fr.error || new Error('read')); };
      fr.readAsDataURL(file);
    });
  }
  function saveAs(name, type, b64) {
    if (window.ChurchHubApp && typeof window.ChurchHubApp.saveFileBase64 === 'function') { window.ChurchHubApp.saveFileBase64(name, type || 'application/octet-stream', b64); return; }
    if (window.ChurchHubApp) { H.toast(T('Please update the Church Hub app to download files, or use a browser.'), true); return; }
    var bin = atob(b64), bytes = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([bytes], { type: type || 'application/octet-stream' }));
    a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  var policyDraft = null;   // the file chosen in the editor: { name, type, data } or null
  function policyDialog() {
    var p = policy || {}; policyDraft = p.name && p.data ? { name: p.name, type: p.type, data: p.data } : null;
    H.modal(H.dialogHead(T('Library policy'), T('Everyone who signs in can read it.')) + '<div class="dlg-body">' +
      '<label class="field">' + T('Paste the policy here') + '<textarea id="lib-pol" rows="10" maxlength="' + L.POLICY_MAX + '">' + esc(p.text || '') + '</textarea></label>' +
      '<div class="field"><span>' + T('Or attach a file (PDF, Word or a picture)') + '</span><div class="btns"><label class="btn small">' + T('Choose a file') +
        '<input id="lib-pol-file" type="file" accept=".pdf,.doc,.docx,.txt,.odt,image/*" hidden></label><span id="lib-pol-name" class="muted small"></span>' +
        '<button type="button" class="btn small ghost" id="lib-pol-rm" data-act="library:policynofile" hidden>' + T('Remove the file') + '</button></div></div>' +
      '<p id="lib-pol-err" class="note bad" hidden></p></div>' +
      '<div class="dlg-foot">' + (policy ? '<button class="btn ghost" data-act="library:policydel">' + T('Remove the policy') + '</button>' : '') +
      '<button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn save" data-act="library:policysave">' + T('Save') + '</button></div>', T('Library policy'));
    showPolicyFile();
    var inp = document.getElementById('lib-pol-file');
    inp.addEventListener('change', function () {
      var f = inp.files && inp.files[0]; inp.value = ''; if (!f) return;
      var err = document.getElementById('lib-pol-err'); err.hidden = true;
      if (/^text\/plain$/.test(f.type) || /\.txt$/i.test(f.name)) {   // plain words: put them in the box, where everyone reads them
        f.text().then(function (t) { var box = document.getElementById('lib-pol'); box.value = String(t).slice(0, L.POLICY_MAX); });
        return;
      }
      if (f.size > POLICY_FILE_MAX) { err.textContent = T('The file is too big (at most 600 KB). Paste the words instead, or make the file smaller.'); err.hidden = false; return; }
      readFile(f).then(function (data) { policyDraft = { name: f.name, type: f.type || 'application/octet-stream', data: data }; showPolicyFile(); });
    });
  }
  function showPolicyFile() {
    var n = document.getElementById('lib-pol-name'), rm = document.getElementById('lib-pol-rm');
    if (n) n.textContent = policyDraft ? policyDraft.name : ''; if (rm) rm.hidden = !policyDraft;
  }
  function loadPolicy() {
    if (policyAsked) return; policyAsked = true;
    S.libraryPolicy().then(function (p) { policy = p && (p.text || p.data) ? p : null; H.render(); }, function () { policy = null; });
  }

  if (typeof document !== 'undefined') document.addEventListener('input', function (ev) { if (ev.target.id === 'lib-q') { q = ev.target.value; applySearch(); } });

  function libsDialog() {
    var ids = ((S.settings() || {}).librarianIds || []).slice(), finder = window.CareUI && CareUI.finder;
    H.modal(H.dialogHead(T('Librarians'), T('One or two librarians add items, lend them and record when they come back. Administrators always can.')) + '<div class="dlg-body">' +
      (ids.length ? '<div class="list">' + ids.map(function (id) {
        var p = S.get('people', id), name = p ? H.name(p) : T('Someone');
        return '<div class="item">' + (p ? H.avatar(p, 32) : '') + '<span class="grow"><b>' + esc(name) + '</b></span><button class="icon-btn ghost" data-act="library:libout" data-id="' + esc(id) + '" aria-label="' + esc(T('Take {name} out', { name: name })) + '" title="' + esc(T('Delete')) + '">' + H.icon(H.ICON.x, 16) + '</button></div>';
      }).join('') + '</div>' : '<p class="muted small">' + T('No one yet.') + '</p>') +
      (!L.roomForLibrarian(S.settings()) ? '<p class="hint" style="margin-top:10px">' + T('There are two librarians already. Take one out to choose someone else.') + '</p>' :
        finder ? '<div style="margin-top:10px">' + finder('lib-libs', everyone().filter(function (p) { return ids.indexOf(p.id) < 0 && p.familyRole !== 'child' && p.appRole && p.appRole !== 'none'; }), 'library:libadd', {}, null, T('Add someone: type part of their name')) + '</div>' : '') + '</div>' +
      '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Close') + '</button></div>', T('Librarians'));
  }
  function setLibs(ids, why) { S.setLibrarians(ids, why); libsDialog(); }

  H.register({
    id: 'library', name: 'Library', desc: 'The church’s library – see what is in, and what you have borrowed', icon: BOOKS, tint: '#2F7A78', optIn: true,
    render: function () { return page(); },
    after: function () {
      applySearch(); loadCovers(); loadPolicy();
      if (!tidied && librarian() && !S.preview() && !S.offline()) { tidied = true; L.stale(loans(), H.today()).forEach(function (l) { S.remove('loans', l.id); }); }   // returned more than a year ago
    },
    stat: function () { var u = me(); return librarian() ? TN('{n} on loan', '{n} on loan', L.onLoan(loans()).length) : u && L.mine(loans(), u.id).length ? TN('{n} item', '{n} items', L.mine(loans(), u.id).length) : ''; },
    todos: function (u) {
      var late = librarian() ? L.onLoan(loans()).filter(function (l) { return L.overdue(l, H.today()); }).length : 0, mine = u ? L.mine(loans(), u.id).filter(function (l) { return L.overdue(l, H.today()); }) : [];
      var out = [];
      if (late) out.push({ text: TN('{n} library item is overdue', '{n} library items are overdue', late), href: '#/library', tag: T('Library') });
      else if (mine.length) out.push({ text: T('Please return “{title}” to the church library', { title: mine[0].title }), href: '#/library', tag: T('Library') });
      return out;
    },
    actions: {
      add: function () { if (librarian()) form({}); },
      edit: function (el) { var b = S.get('books', el.dataset.id); if (b && librarian()) form(b); },
      coverrm: function () { newCover = ''; var el = document.getElementById('lib-cover-now'); if (el) el.innerHTML = '<span class="muted small">' + T('No picture yet.') + '</span>'; var rm = document.getElementById('lib-cover-rm'); if (rm) rm.hidden = true; },
      save: function (el) {
        if (!librarian()) return;
        var old = el.dataset.id ? S.get('books', el.dataset.id) : null;
        if (!val('lib-title')) { H.toast(T('Give it a title'), true); return; }
        var b = L.book({ id: old && old.id, createdAt: old && old.createdAt, cover: old && old.cover, kind: val('lib-kind'), title: val('lib-title'), author: val('lib-author'), cat: val('lib-cat'), copies: val('lib-copies'), how: val('lib-how'), acquired: val('lib-acq'), from: val('lib-from'), shelf: val('lib-shelf'), isbn: val('lib-isbn'), note: val('lib-note') });
        b.out = old ? L.outCount(old, loans()) : 0; if (b.copies < b.out) b.copies = b.out;   // never fewer copies than are out
        if (!b.id) delete b.id;
        var saved = S.put('books', b, old ? '' : 'Added “' + b.title + '” to the library' + (b.how ? ' (' + b.how + (b.from ? ', ' + b.from : '') + ')' : ''));
        if (newCover !== undefined && (newCover || saved.cover)) S.setCover(saved.id, newCover);
        newCover = undefined;
        H.closeModal(); H.render(); H.toast(T('Saved'));
      },
      del: function (el) {
        var b = S.get('books', el.dataset.id); if (!b || !librarian()) return;
        if (L.outCount(b, loans())) { H.toast(T('This is on loan – it can’t be deleted until it is returned.'), true); return; }
        if (!H.confirmBtn(el, '✕?')) return;
        S.find('loans', function (l) { return l.bookId === b.id; }).forEach(function (l) { S.remove('loans', l.id); });
        S.remove('books', b.id, 'Deleted “' + b.title + '” from the library'); H.render(); H.toast(T('Deleted'));
      },
      lend: function (el) { var b = S.get('books', el.dataset.id); if (b && librarian()) lendDialog(b); },
      lendto: function (el) {
        var b = S.get('books', el.dataset.b), p = S.get('people', el.dataset.id); if (!b || !librarian()) return;
        if (!p) { H.toast(T('Choose someone to add'), true); return; }
        var typed = val('lib-mob'), w = L.borrower(p, { mobile: typed });
        if (w.error) { if (document.getElementById('lib-mob')) lendErr('mobile'); else lendDialog(b, { person: p }); return; }
        var keep = typed && !p.mobile && document.getElementById('lib-mob-save') && document.getElementById('lib-mob-save').checked && H.can('people.edit');
        if (doLend(b, w) && keep) { var x = JSON.parse(JSON.stringify(p)); x.mobile = w.mobile; S.put('people', x, 'Added a mobile number for ' + H.name(p) + ' (lending from the library)'); }
      },
      lendvisitor: function (el) {
        var b = S.get('books', el.dataset.b); if (!b || !librarian()) return;
        var w = L.borrower(null, { name: val('lib-vname'), mobile: val('lib-vmob') });
        if (w.error) { lendErr(w.error); return; }
        doLend(b, w);
      },
      back: function (el) {
        var l = S.get('loans', el.dataset.id); if (!l || !librarian()) return;
        var r = L.giveBack(l, S.get('books', l.bookId), H.today(), loans());
        S.put('loans', r.loan); if (r.book) S.put('books', r.book);
        H.render(); H.toast(T('Marked as returned'));
      },
      policy: function () { if (writesPolicy()) policyDialog(); },
      policynofile: function () { policyDraft = null; showPolicyFile(); },
      policysave: function () {
        if (!writesPolicy()) return;
        var p = L.policy(Object.assign({ text: document.getElementById('lib-pol').value }, policyDraft || {}));
        if (!p.text && !p.data) { var e = document.getElementById('lib-pol-err'); e.textContent = T('Paste the policy, or choose a file.'); e.hidden = false; return; }
        H.busy(T('Saving…'), function () { return S.setLibraryPolicy(p, policy ? 'Changed the library policy' : 'Added the library policy'); })
          .then(function () { policy = p; H.closeModal(); H.render(); H.toast(T('Saved')); }, function (e) { console.error(e); H.toast(T('Couldn’t save it. Please try again.'), true); });
      },
      policydel: function (el) {
        if (!writesPolicy() || !H.confirmBtn(el, T('Remove the policy') + '?')) return;
        S.setLibraryPolicy(null, 'Removed the library policy').then(function () { policy = null; H.closeModal(); H.render(); H.toast(T('Deleted')); });
      },
      policyfile: function () { if (policy && policy.data) saveAs(policy.name, policy.type, policy.data); },
      libs: function () { if (chooses()) libsDialog(); },
      libadd: function (el) {
        var p = S.get('people', el.dataset.id), ids = ((S.settings() || {}).librarianIds || []).slice(); if (!p || !chooses()) return;
        if (!L.roomForLibrarian(S.settings())) { libsDialog(); return; }
        if (ids.indexOf(p.id) < 0) ids.push(p.id);
        setLibs(ids, 'Made ' + H.name(p) + ' a librarian');
      },
      libout: function (el) {
        if (!chooses()) return;
        var p = S.get('people', el.dataset.id), ids = ((S.settings() || {}).librarianIds || []).filter(function (x) { return x !== el.dataset.id; });
        setLibs(ids, (p ? H.name(p) : 'Someone') + ' is no longer a librarian');
      }
    }
  });
})();
