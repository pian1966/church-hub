/* Church Hub – Library: the church's books – what it has, how each was acquired, and who has borrowed which.
 * Everyone who signs in can look through the books and see whether one is in, and sees the books they have out themselves.
 * The librarians (Administrators, and the people an Administrator names) add books, lend them and mark them as returned.
 * Off until an Administrator switches it on (Settings → Apps). Who borrowed what is seen only by the librarians and the
 * borrower; returned loans are removed after a year. Rules: js/library.js (tested), firestore.rules (books, loans). */
(function () {
  'use strict';
  var H = Hub, esc = H.esc, S = Store, T = I18n.t, TN = I18n.tn, L = Library;
  var BOOKS = 'M4 4h4v16H4zM10 4h4v16h-4zM16.5 5.5l3.5-1 3 14-3.5 1z';
  var PEN = 'M4 20h4L20 8l-4-4L4 16zM14 6l4 4';
  var q = '', tidied = false;

  function me() { return H.user(); }
  function librarian() { var u = me(); return !!u && L.isLibrarian(S.settings(), u.id, H.can('*')) && (H.can('*') || !S.preview()); }
  function val(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }
  function loans() { return S.list('loans'); }
  function free(b) { return librarian() ? L.free(b, loans()) : L.free(b); }
  function everyone() { return S.find('people', function (p) { return p.active !== false && p.firstName !== 'Deleted' && !p.mergedInto && !p.binnedAt && p.category !== 'Deceased'; }).sort(function (a, b) { return H.name(a).localeCompare(H.name(b)); }); }
  function due(l) { return '<span class="' + (L.overdue(l, H.today()) ? 'tag bad' : 'muted') + '">' + esc(T('Due {date}', { date: H.fmt(l.due, true) })) + (L.overdue(l, H.today()) ? ' · ' + T('Overdue') : '') + '</span>'; }
  function bookRow(b, edit) {
    var n = free(b), copies = Math.max(1, +b.copies || 1), bits = [b.author, b.cat, b.shelf ? T('Shelf {shelf}', { shelf: b.shelf }) : ''].filter(Boolean);
    return '<div class="item rec-item lib-book" data-find="' + esc([b.title, b.author, b.cat, b.shelf, b.isbn].join(' ')) + '">' +
      '<span class="grow"><b data-own-words>' + esc(b.title) + '</b> <span class="tag ' + (n ? 'ok' : 'grey') + '">' + (n ? T('Available') : T('On loan')) + (copies > 1 ? ' · ' + esc(T('{n} of {total}', { n: n, total: copies })) : '') + '</span>' +
      (bits.length ? '<small data-own-words>' + bits.map(esc).join(' · ') + '</small>' : '') +
      (edit && (b.how || b.from || b.acquired) ? '<small class="muted">' + esc([b.how ? T(b.how) : '', b.from, b.acquired ? H.fmt(b.acquired, true) : ''].filter(Boolean).join(' · ')) + '</small>' : '') +
      (b.note ? '<small data-own-words>' + esc(b.note) + '</small>' : '') + '</span>' +
      (edit ? '<span class="rec-acts"><button class="btn small" data-act="library:lend" data-id="' + esc(b.id) + '"' + (n ? '' : ' disabled') + '>' + T('Lend') + '</button>' +
        '<button class="icon-btn ghost" data-act="library:edit" data-id="' + esc(b.id) + '" aria-label="' + esc(T('Edit {name}', { name: b.title })) + '" title="' + esc(T('Edit')) + '">' + H.icon(PEN, 16) + '</button>' +
        '<button class="icon-btn ghost" data-act="library:del" data-id="' + esc(b.id) + '" aria-label="' + esc(T('Delete {name}', { name: b.title })) + '" title="' + esc(T('Delete')) + '">' + H.icon(H.ICON.trash, 16) + '</button></span>' : '') + '</div>';
  }
  function page() {
    var u = me(), edit = librarian(), books = L.find(S.list('books'), ''), mine = u ? L.mine(loans(), u.id) : [], out = edit ? L.onLoan(loans()) : [];
    var back = edit ? loans().filter(function (l) { return !!l.back; }).sort(function (a, b) { return String(b.back).localeCompare(String(a.back)); }).slice(0, 15) : [];
    var html = '<div class="page-head"><div><h1>' + T('Library') + '</h1><p class="lead">' + (edit ? T('The church’s books: add them, lend them and mark them as returned. Only librarians and the borrower see who has a book.') : T('The church’s books. To borrow one, ask a librarian.')) + '</p></div>' +
      (edit ? '<div class="btns"><button class="btn primary" data-act="library:add">' + H.icon(H.ICON.plus, 16) + T('Add a book') + '</button>' +
        (H.can('settings.manage') ? '<button class="btn" data-act="library:libs">' + T('Librarians') + '</button>' : '') + '</div>' : '') + '</div>';
    if (mine.length) html += '<section class="panel" id="lib-mine"><h2>' + T('My books') + '</h2><div class="list">' + mine.map(function (l) {
      return '<div class="item"><span class="grow"><b data-own-words>' + esc(l.title) + '</b><small>' + due(l) + '</small></span></div>'; }).join('') + '</div></section>';
    if (edit) html += '<section class="panel" id="lib-out"><div class="row"><h2 class="grow" style="margin:0">' + T('On loan') + '</h2><span class="muted small">' + TN('{n} book', '{n} books', out.length) + '</span></div>' +
      (out.length ? '<div class="list" style="margin-top:8px">' + out.map(function (l) {
        return '<div class="item rec-item"><span class="grow"><b data-own-words>' + esc(l.title) + '</b><small>' + esc(l.name) + ' · ' + esc(T('Lent {date}', { date: H.fmt(l.out, true) })) + ' · ' + due(l) + '</small></span>' +
          '<span class="rec-acts"><button class="btn small" data-act="library:back" data-id="' + esc(l.id) + '">' + H.icon(H.ICON.check, 16) + T('Returned') + '</button></span></div>';
      }).join('') + '</div>' : '<p class="muted small" style="margin:8px 0 0">' + T('Nothing on loan.') + '</p>') +
      (back.length ? '<details class="sub" style="margin-top:10px"><summary>' + T('Recently returned') + '</summary><div class="list">' + back.map(function (l) {
        return '<div class="item"><span class="grow"><b data-own-words>' + esc(l.title) + '</b><small>' + esc(l.name) + ' · ' + esc(H.fmt(l.out, true) + ' – ' + H.fmt(l.back, true)) + '</small></span></div>'; }).join('') +
        '</div><p class="hint">' + T('Returned loans are removed after a year.') + '</p></details>' : '') + '</section>';
    if (!books.length) return html + '<p class="empty">' + T('No books yet.') + '</p>';
    return html + '<section class="panel" id="lib-books"><div class="row" style="gap:10px;flex-wrap:wrap"><label class="search grow">' + H.icon(H.ICON.search, 18) + '<span class="sr">' + T('Search by title, author or category') + '</span>' +
      '<input id="lib-q" type="search" placeholder="' + esc(T('Search by title, author or category')) + '" value="' + esc(q) + '" autocomplete="off"></label><span class="muted small">' + TN('{n} book', '{n} books', books.length) + '</span></div>' +
      '<div class="list" style="margin-top:8px">' + books.map(function (b) { return bookRow(b, edit); }).join('') + '</div><p class="empty" id="lib-none" hidden>' + T('Nothing matches.') + '</p></section>';
  }
  function applySearch() {
    var s = q.trim(), shown = 0;
    [].forEach.call(document.querySelectorAll('.lib-book'), function (it) { var hit = !s || H.matches(it.dataset.find, s); it.hidden = !hit; if (hit) shown++; });
    var none = document.getElementById('lib-none'); if (none) none.hidden = !s || shown > 0;
  }
  function form(b) {
    var isNew = !b.id, cats = L.cats(S.list('books'));
    H.modal(H.dialogHead(isNew ? T('Add a book') : T('Edit {name}', { name: b.title })) + '<div class="dlg-body">' +
      '<label class="field req">' + T('Title') + '<input id="lib-title" maxlength="150" value="' + esc(b.title || '') + '"></label>' +
      '<label class="field">' + T('Author') + '<input id="lib-author" maxlength="150" value="' + esc(b.author || '') + '"></label>' +
      '<div class="two"><label class="field">' + T('Category') + '<input id="lib-cat" maxlength="60" list="lib-cats" value="' + esc(b.cat || '') + '"><datalist id="lib-cats">' + cats.map(function (c) { return '<option value="' + esc(c) + '">'; }).join('') + '</datalist></label>' +
      '<label class="field req">' + T('Copies') + '<input id="lib-copies" type="number" min="1" max="99" value="' + esc(b.copies || 1) + '"></label></div>' +
      '<div class="two"><label class="field">' + T('How it was acquired') + '<select id="lib-how"><option value="">' + T('Choose…') + '</option>' + L.HOW.map(function (h) { return '<option value="' + esc(h) + '"' + (b.how === h ? ' selected' : '') + '>' + esc(T(h)) + '</option>'; }).join('') + '</select></label>' +
      '<label class="field">' + T('Date acquired') + '<input id="lib-acq" type="date" value="' + esc(isNew ? H.today() : b.acquired || '') + '"></label></div>' +
      '<label class="field">' + T('From (the donor or the shop)') + '<input id="lib-from" maxlength="150" value="' + esc(b.from || '') + '"></label>' +
      '<div class="two"><label class="field">' + T('Shelf') + '<input id="lib-shelf" maxlength="60" value="' + esc(b.shelf || '') + '"></label>' +
      '<label class="field">' + T('ISBN') + '<input id="lib-isbn" maxlength="20" value="' + esc(b.isbn || '') + '"></label></div>' +
      '<label class="field">' + T('Note') + '<textarea id="lib-note" rows="2" maxlength="500">' + esc(b.note || '') + '</textarea></label></div>' +
      '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn save" data-act="library:save" data-id="' + esc(b.id || '') + '">' + T('Save') + '</button></div>', T('Add a book'));
  }
  function libsDialog() {
    var ids = ((S.settings() || {}).librarianIds || []).slice(), finder = window.CareUI && CareUI.finder;
    H.modal(H.dialogHead(T('Librarians'), T('Librarians add books and record who borrows and returns them. Administrators always can.')) + '<div class="dlg-body">' +
      (ids.length ? '<div class="list">' + ids.map(function (id) {
        var p = S.get('people', id), name = p ? H.name(p) : T('Someone');
        return '<div class="item">' + (p ? H.avatar(p, 32) : '') + '<span class="grow"><b>' + esc(name) + '</b></span><button class="icon-btn ghost" data-act="library:libout" data-id="' + esc(id) + '" aria-label="' + esc(T('Take {name} out', { name: name })) + '" title="' + esc(T('Delete')) + '">' + H.icon(H.ICON.x, 16) + '</button></div>';
      }).join('') + '</div>' : '<p class="muted small">' + T('No one yet.') + '</p>') +
      (finder ? '<div style="margin-top:10px">' + finder('lib-libs', everyone().filter(function (p) { return ids.indexOf(p.id) < 0 && p.familyRole !== 'child' && p.appRole && p.appRole !== 'none'; }), 'library:libadd', {}, null, T('Add someone: type part of their name')) + '</div>' : '') + '</div>' +
      '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Close') + '</button></div>', T('Librarians'));
  }
  function setLibs(ids, why) { S.setSettings({ librarianIds: ids }, why); libsDialog(); }

  if (typeof document !== 'undefined') document.addEventListener('input', function (ev) { if (ev.target.id === 'lib-q') { q = ev.target.value; applySearch(); } });

  H.register({
    id: 'library', name: 'Library', desc: 'The church’s books – see what is in, and what you have borrowed', icon: BOOKS, tint: '#2F7A78', optIn: true,
    render: function () { return page(); },
    after: function () {
      applySearch();
      if (!tidied && librarian() && !S.preview() && !S.offline()) { tidied = true; L.stale(loans(), H.today()).forEach(function (l) { S.remove('loans', l.id); }); }   // returned more than a year ago
    },
    stat: function () { var u = me(); return librarian() ? TN('{n} on loan', '{n} on loan', L.onLoan(loans()).length) : u && L.mine(loans(), u.id).length ? TN('{n} book', '{n} books', L.mine(loans(), u.id).length) : ''; },
    todos: function (u) {
      var late = librarian() ? L.onLoan(loans()).filter(function (l) { return L.overdue(l, H.today()); }).length : 0, mine = u ? L.mine(loans(), u.id).filter(function (l) { return L.overdue(l, H.today()); }) : [];
      var out = [];
      if (late) out.push({ text: TN('{n} library book is overdue', '{n} library books are overdue', late), href: '#/library', tag: T('Library') });
      else if (mine.length) out.push({ text: T('Please return “{title}” to the church library', { title: mine[0].title }), href: '#/library', tag: T('Library') });
      return out;
    },
    actions: {
      add: function () { if (librarian()) form({}); },
      edit: function (el) { var b = S.get('books', el.dataset.id); if (b && librarian()) form(b); },
      save: function (el) {
        if (!librarian()) return;
        var old = el.dataset.id ? S.get('books', el.dataset.id) : null;
        if (!val('lib-title')) { H.toast(T('Give the book a title'), true); return; }
        var b = L.book({ id: old && old.id, createdAt: old && old.createdAt, title: val('lib-title'), author: val('lib-author'), cat: val('lib-cat'), copies: val('lib-copies'), how: val('lib-how'), acquired: val('lib-acq'), from: val('lib-from'), shelf: val('lib-shelf'), isbn: val('lib-isbn'), note: val('lib-note') });
        b.out = old ? L.outCount(old, loans()) : 0; if (b.copies < b.out) b.copies = b.out;   // never fewer copies than are out
        if (!b.id) delete b.id;
        S.put('books', b, old ? '' : 'Added the library book “' + b.title + '”' + (b.how ? ' (' + b.how + (b.from ? ', ' + b.from : '') + ')' : ''));
        H.closeModal(); H.render(); H.toast(T('Saved'));
      },
      del: function (el) {
        var b = S.get('books', el.dataset.id); if (!b || !librarian()) return;
        if (L.outCount(b, loans())) { H.toast(T('This book is on loan – it can’t be deleted until it is returned.'), true); return; }
        if (!H.confirmBtn(el, '✕?')) return;
        S.find('loans', function (l) { return l.bookId === b.id; }).forEach(function (l) { S.remove('loans', l.id); });
        S.remove('books', b.id, 'Deleted the library book “' + b.title + '”'); H.render(); H.toast(T('Deleted'));
      },
      lend: function (el) {
        var b = S.get('books', el.dataset.id), finder = window.CareUI && CareUI.finder; if (!b || !librarian() || !finder) return;
        H.modal(H.dialogHead(T('Lend'), b.title) + '<div class="dlg-body"><label class="field req">' + T('Due back') + '<input type="date" id="lib-due" value="' + esc(L.addDays(H.today(), L.LOAN_DAYS)) + '"></label>' +
          '<label class="field req" style="margin-bottom:6px">' + T('Who is borrowing it') + '</label>' + finder('lib-lend', everyone(), 'library:lendto', { b: b.id }, null, T('Type part of their name')) + '</div>' +
          '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button></div>', T('Lend'));
      },
      lendto: function (el) {
        var b = S.get('books', el.dataset.b), p = S.get('people', el.dataset.id); if (!b || !librarian()) return;
        if (!p) { H.toast(T('Choose someone to add'), true); return; }
        var r = L.lend(b, p, H.today(), val('lib-due'), loans()); if (!r) { H.toast(T('Every copy is on loan.'), true); return; }
        S.put('loans', r.loan); S.put('books', r.book);
        H.closeModal(); H.render(); H.toast(T('Lent to {name}', { name: r.loan.name }));
      },
      back: function (el) {
        var l = S.get('loans', el.dataset.id); if (!l || !librarian()) return;
        var r = L.giveBack(l, S.get('books', l.bookId), H.today(), loans());
        S.put('loans', r.loan); if (r.book) S.put('books', r.book);
        H.render(); H.toast(T('Marked as returned'));
      },
      libs: function () { if (H.can('settings.manage')) libsDialog(); },
      libadd: function (el) {
        var p = S.get('people', el.dataset.id), ids = ((S.settings() || {}).librarianIds || []).slice(); if (!p || !H.can('settings.manage')) return;
        if (ids.indexOf(p.id) < 0) ids.push(p.id);
        setLibs(ids, 'Made ' + H.name(p) + ' a librarian');
      },
      libout: function (el) {
        if (!H.can('settings.manage')) return;
        var p = S.get('people', el.dataset.id), ids = ((S.settings() || {}).librarianIds || []).filter(function (x) { return x !== el.dataset.id; });
        setLibs(ids, (p ? H.name(p) : 'Someone') + ' is no longer a librarian');
      }
    }
  });
})();
