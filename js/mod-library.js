/* Church Hub – Library: the church's books, DVDs, CDs and more – what it has, how each was acquired, and who has borrowed what.
 * Everyone who signs in can look through the library, see whether something is in, read the library's policy, and sees what
 * they have out themselves. The librarians (Administrators, and the people chosen by an Administrator or the Senior
 * Pastor) add items with a picture of the cover, lend them – to people on the church's list or to visitors, always with a
 * mobile number so an item can be traced – and mark them as returned. Off until an Administrator switches it on
 * (Settings → Apps). Who borrowed what is seen only by the librarians and the borrower; returned loans are removed after a
 * year. Three weeks after something is borrowed (and each week after that) a friendly reminder is due: the borrower sees it
 * on their To do list and here, and a librarian can send it by WhatsApp or SMS (visitors, and people who don't use the app).
 * The policy is typed with simple formatting (js/richtext.js). Rules: js/library.js (tested), firestore.rules (books,
 * loans, covers, libraryPolicy). */
(function () {
  'use strict';
  var H = Hub, esc = H.esc, S = Store, T = I18n.t, TN = I18n.tn, L = Library;
  var BOOKS = 'M4 4h4v16H4zM10 4h4v16h-4zM16.5 5.5l3.5-1 3 14-3.5 1z';
  var PEN = 'M4 20h4L20 8l-4-4L4 16zM14 6l4 4';
  var POLICY_FILE_MAX = 600 * 1024;   // an attached policy file: at most 600 KB (it is kept in one database document)
  var filters = { kind: '', title: '', author: '', cat: '', borrower: '' }, sortKey = 'title', sortDir = 1, catalogueTab = 'all', tidied = false;
  var selectedBooks = {}, librarianReviewShown = false;
  var newCover;            // the cover chosen in the form: undefined = unchanged, '' = taken away, else a picture (data: address)
  var policy;              // the library's policy: undefined until fetched, then null (none) or { text, name, type, data }
  var policyAsked = false, coverCache = {}, coverAsked = {}, coverSeen = null;

  function me() { return H.user(); }
  function librarian() { var u = me(); return !!u && L.isLibrarian(S.settings(), u.id, H.can('*')) && (H.can('*') || !S.preview()); }
  function administrator() { return H.can('*') && !S.preview(); }
  /** The Senior Pastor (Rector), who may choose the librarians and write the policy. */
  function senior() { var u = me(); return !!u && !S.preview() && H.isSenior(S.get('people', u.id) || u); }
  function chooses() { return H.can('settings.manage') || senior(); }
  function writesPolicy() { return librarian() || senior(); }
  function val(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }
  function loans() { return S.list('loans'); }
  function borrowerNames(activeLoans) {
    var names = Object.create(null);
    activeLoans.forEach(function (l) {
      var name = String(l.name || '').trim(), key = name.toLowerCase();
      if (name && !names[key]) names[key] = name;
    });
    return Object.keys(names).map(function (key) { return names[key]; })
      .sort(function (a, b) { return a.localeCompare(b, undefined, { sensitivity: 'base' }); });
  }
  function borrowerQuery() {
    var query = String(filters.borrower || '').trim();
    return !query || query.toLowerCase() === T('All Borrowers').toLowerCase() ? '' : query.toLowerCase();
  }
  function sortFieldsValid(k) { return ['kind', 'title', 'author', 'cat'].indexOf(k) >= 0; }
  function free(b) { return librarian() ? L.free(b, loans()) : L.free(b); }
  function everyone() { return S.find('people', function (p) { return p.active !== false && p.firstName !== 'Deleted' && !p.mergedInto && !p.binnedAt && p.category !== 'Deceased'; }).sort(function (a, b) { return H.name(a).localeCompare(H.name(b)); }); }
  function due(l) { return '<span class="' + (L.overdue(l, H.today()) ? 'tag bad' : 'muted') + '">' + esc(T('Due {date}', { date: H.fmt(l.due, true) })) + (L.overdue(l, H.today()) ? ' · ' + T('Overdue') : '') + '</span>'; }
  /** The formatting buttons' names (js/richtext.js). */
  function fmtWords() { return { bar: T('Formatting'), b: T('Bold'), i: T('Italic'), u: T('Underline'), h: T('Heading'), ul: T('Bulleted list'), ol: T('Numbered list') }; }
  function held(l) { var n = L.daysOut(l, H.today()); return TN('had for {n} day', 'had for {n} days', n); }
  function purgeButton(kind, id) {
    return '<button class="btn small danger" data-act="library:purge" data-kind="' + kind + '" data-id="' + esc(id) + '">' + T('Purge') + '</button>';
  }
  function purgeDialog(kind, record) {
    var book = kind === 'book', warning = book ?
      T('Permanently delete this book and its loan records? This cannot be undone.') :
      T('Permanently delete this library record? This cannot be undone.');
    H.modal(H.dialogHead(T('Purge library record'), record.title) + '<div class="dlg-body"><p class="hint">' + esc(warning) + '</p></div>' +
      '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button>' +
      '<button class="btn danger" data-act="library:purgeconfirm" data-kind="' + kind + '" data-id="' + esc(record.id) + '">' + T('Purge') + '</button></div>', T('Purge library record'));
  }
  /** The friendly reminder, in words: which item, and how long they have had it. */
  function reminderText(l) {
    return T('Hello {name}, a friendly reminder from the church library: you have had “{title}” for {n} days. Please bring it back when you have finished with it, or let us know if you need it for longer. Thank you!',
      { name: String(l.name || '').split(' ')[0], title: l.title, n: L.daysOut(l, H.today()) });
  }
  function returnDialog(l) {
    H.modal(H.dialogHead(T('Returned'), l.title) + '<div class="dlg-body">' +
      '<label class="field">' + T('Damaged') + ' / ' + T('Note') + '<textarea id="lib-backnote" rows="3" maxlength="300"></textarea></label>' +
      '</div><div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button>' +
      '<button class="btn save" data-act="library:backsave" data-id="' + esc(l.id) + '">' + T('Returned') + '</button></div>', T('Returned'));
  }
  function cover(b, big) {
    return '<span class="lib-cover' + (big ? ' big' : '') + '"' + (b.cover ? ' data-cover="' + esc(b.id) + '" data-v="' + esc(b.cover) + '"' : '') + ' aria-hidden="true">' + (b.cover ? '' : H.icon(BOOKS, big ? 28 : 18)) + '</span>';
  }
  function bookRow(b, edit) {
    var n = free(b), outCount = L.outCount(b, librarian() ? loans() : null), copies = Math.max(1, +b.copies || 1), bits = [b.author ? T('Author') + ': ' + b.author : '', b.cat ? T('Subject') + ': ' + b.cat : '', b.shelf ? T('Shelf {shelf}', { shelf: b.shelf }) : ''].filter(Boolean);
    return '<div class="item rec-item lib-book" data-kind="' + esc(b.kind || 'Book') + '" data-title="' + esc(b.title) + '" data-author="' + esc(b.author) + '" data-subject="' + esc(b.cat) + '" data-out="' + (!b.repairing && outCount > 0 && n === 0) + '" data-free="' + (n > 0) + '" data-repairing="' + !!b.repairing + '">' +
      (edit && (b.kind || 'Book') === 'Book' ? '<label class="check lib-select"><input type="checkbox" data-lib-select="' + esc(b.id) + '"' + (selectedBooks[b.id] ? ' checked' : '') + ' aria-label="' + esc(T('Select {name}', { name: b.title })) + '"></label>' : '') + cover(b) +
      '<span class="grow"><b data-own-words>' + esc(b.title) + '</b> <span class="tag">' + esc(T(b.kind || 'Book')) + '</span> ' +
      '<span class="tag ' + (b.repairing ? 'warn' : n ? 'ok' : 'grey') + '">' + (b.repairing ? T('Being Repaired') : n ? T('Available') : T('On loan')) + (copies > 1 && !b.repairing ? ' · ' + esc(T('{n} of {total}', { n: n, total: copies })) : '') + '</span>' +
      (bits.length ? '<small data-own-words>' + bits.map(esc).join(' · ') + '</small>' : '') +
      (edit && (b.how || b.from || b.acquired) ? '<small class="muted">' + esc([b.how ? T(b.how) : '', b.from, b.acquired ? H.fmt(b.acquired, true) : ''].filter(Boolean).join(' · ')) + '</small>' : '') +
      (b.note ? '<small data-own-words>' + esc(b.note) + '</small>' : '') + '</span><span class="rec-acts">' +
      '<button class="btn small" data-act="library:bookinfo" data-id="' + esc(b.id) + '">' + T('View / Info') + '</button>' +
      (!edit ? '<button class="btn small" data-act="library:request" data-id="' + esc(b.id) + '"' + (n || S.isLive() ? '' : ' disabled') + '>' + T('Request to borrow') + '</button>' : '') +
      (edit ? (b.repairing ?
        '<button class="btn small" data-act="library:repair" data-id="' + esc(b.id) + '">' + T('Back from repair') + '</button>' :
        '<button class="btn small" data-act="library:repair" data-id="' + esc(b.id) + '"' + (L.outCount(b, loans()) ? ' disabled' : '') + '>' + T('Being Repaired') + '</button>') +
        '<button class="btn small" data-act="library:lend" data-id="' + esc(b.id) + '"' + (n ? '' : ' disabled') + '>' + T('Lend') + '</button>' +
        '<button class="icon-btn ghost" data-act="library:edit" data-id="' + esc(b.id) + '" aria-label="' + esc(T('Edit {name}', { name: b.title })) + '" title="' + esc(T('Edit')) + '">' + H.icon(PEN, 16) + '</button>' +
        '<button class="icon-btn ghost" data-act="library:remove" data-id="' + esc(b.id) + '" aria-label="' + esc(T('Take {name} out of the library', { name: b.title })) + '" title="' + esc(T('Take out of the library')) + '">' + H.icon(H.ICON.trash, 16) + '</button>' : '') + '</span></div>';
  }
  function who(l) {   // the borrower, with the mobile number for the librarians to trace the item
    return esc(l.name) + (l.visitor ? ' <span class="tag grey">' + T('Visitor') + '</span>' : '') + (l.mobile ? ' · <a href="tel:' + esc(l.mobile.replace(/[^\d+]/g, '')) + '">' + esc(l.mobile) + '</a>' : '');
  }
  /** Keep the policy available from the header without placing its contents above the catalogue. */
  function policyPanel() {
    var p = policy, edit = writesPolicy();
    if (!p) return edit ? '<button class="btn small" data-act="library:policy">' + T('Add the policy') + '</button>' : '';
    return (p.text ? '<button class="btn small" data-act="library:policyread">' + T('Library policy') + '</button>' : '') +
      (p.name && p.data && viewable(p.type) ? '<button class="btn small" data-act="library:policyopen">' + esc(T('Open {name}', { name: p.name })) + '</button>' : '') +
      (p.name && p.data ? '<button class="btn small" data-act="library:policyfile">' + H.icon(H.ICON.download || H.ICON.check, 16) + esc(T('Download {name}', { name: p.name })) + '</button>' : '') +
      (edit ? '<button class="btn small" data-act="library:policy">' + H.icon(PEN, 16) + T('Edit') + '</button>' : '');
  }
  function libraryOn() { return H.isOn('library'); }
  function sectionTabs(active) {
    if (!H.isOn('archive')) return '';
    var buttons = [];
    if (libraryOn()) buttons.push(['library', 'Library', '']);
    buttons.push(['archives', 'Archives', ArchiveUI.canAccess() ? '' : H.icon(H.ICON.lock, 14)]);
    return '<section class="panel"><div class="lib-tabs" role="tablist" aria-label="' + esc(T('Library')) + '">' + buttons.map(function (b) {
      return '<button type="button" class="btn small' + (active === b[0] ? ' primary' : '') + '" data-act="library:section" data-section="' + b[0] +
        '" role="tab" aria-selected="' + (active === b[0]) + '">' + esc(T(b[1])) + (b[2] ? ' <span aria-hidden="true">' + b[2] + '</span>' : '') + '</button>';
    }).join('') + '</div></section>';
  }
  /** How to format the policy: what to type, and how it shows (drawn by the same code that shows the policy). */
  function legend() {
    var rows = [['# ' + T('Heading'), '# ' + T('Heading')], ['## ' + T('Smaller heading'), '## ' + T('Smaller heading')], [T('Library policy').toUpperCase(), null],
      ['- ' + T('Bulleted list') + '\n- ' + T('Bulleted list'), null], ['1. ' + T('Numbered list') + '\n2. ' + T('Numbered list'), null],
      ['**' + T('Bold') + '**', null], ['*' + T('Italic') + '*', null]];
    return '<details class="sub lib-legend"><summary>' + T('How to format it') + '</summary><table class="lib-legend-t"><thead><tr><th>' + T('You type') + '</th><th>' + T('Shows as') + '</th></tr></thead><tbody>' +
      rows.map(function (r) { return '<tr><td><code>' + esc(r[0]).replace(/\n/g, '<br>') + '</code></td><td class="lib-doc">' + L.policyHtml(r[1] || r[0]) + '</td></tr>'; }).join('') +
      '</tbody></table></details>';
  }
  function page(parts) {
    var archiveOn = H.isOn('archive'), archivePage = archiveOn && ((parts || [])[0] === 'archives' || !libraryOn());
    if (archivePage) return sectionTabs('archives') + ArchiveUI.page();
    var u = me(), edit = librarian(), all = L.find(S.list('books'), ''), books = all.filter(L.inLibrary), gone = edit ? all.filter(function (b) { return !L.inLibrary(b); }) : [], mine = u ? L.mine(loans(), u.id) : [], pending = edit ? loans().filter(L.isPending) : mine.filter(L.isPending), out = edit ? L.onLoan(loans()).filter(function (l) { return !L.isPending(l); }) : [];
    var borrowers = edit ? borrowerNames(out) : [];
    if (!edit) filters.borrower = '';
    books.sort(function (a, b) {
      var av = sortKey === 'kind' ? a.kind || 'Book' : a[sortKey] || '', bv = sortKey === 'kind' ? b.kind || 'Book' : b[sortKey] || '';
      return String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' }) * sortDir;
    });
    var back = edit ? loans().filter(function (l) { return !!l.back; }).sort(function (a, b) { return String(b.back).localeCompare(String(a.back)); }).slice(0, 15) : [];
    var policyActions = policyPanel();
    var html = '<div class="page-head"><div><h1>' + T('Library') + '</h1><p class="lead">' + (edit ? T('The church’s library: add books, DVDs and more, lend them and mark them as returned. Only librarians and the borrower see who has what.') : T('The church’s library. To borrow something, ask a librarian.')) + '</p></div>' +
      (edit || chooses() || policyActions ? '<div class="btns">' + policyActions + (edit ? '<button class="btn primary" data-act="library:add">' + H.icon(H.ICON.plus, 16) + T('Add to the library') + '</button>' +
        '<button class="btn" data-act="library:duplicates">' + T('Suggested Duplicates') + '</button>' +
        '<button class="btn" data-act="library:import">' + T('Import a list') + '</button><button class="btn" data-act="library:report">' + T('Reports') + '</button>' : '') +
        (chooses() ? '<button class="btn" data-act="library:libs">' + T('Librarians') + '</button>' : '') + '</div>' : '') + '</div>';
    html += sectionTabs('library');
    if (mine.length) html += '<section class="panel" id="lib-mine"><h2>' + T("Library Items I've Borrowed") + '</h2><div class="list">' + mine.map(function (l) {
      var n = L.daysOut(l, H.today());
      return '<div class="item"><span class="grow"><b data-own-words>' + esc(l.title) + '</b>' + (L.isPending(l) ? ' <span class="tag warn">' + T('Pending Verification') + '</span>' : '') + '<small>' + due(l) + ' · <span class="muted">' + esc(held(l)) + '</span></small>' +
        (n >= L.REMIND_DAYS ? '<small class="note" style="margin-top:6px">' + esc(T('Friendly reminder: you have had this for {n} days. Please bring it back when you have finished with it.', { n: n })) + '</small>' : '') + '</span></div>'; }).join('') + '</div></section>';
    var tabCounts = {
      all: books.length + gone.length,
      onLoan: books.filter(function (b) { return !b.repairing && L.outCount(b, edit ? loans() : null) > 0 && free(b) === 0; }).length,
      available: books.filter(function (b) { return !b.repairing && free(b) > 0; }).length,
      lost: gone.filter(function (b) { return b.why === 'Lost'; }).length,
      repairing: books.filter(function (b) { return !!b.repairing; }).length,
      removed: gone.filter(function (b) { return b.why !== 'Lost'; }).length
    };
    var tabs = [['all', 'All'], ['onLoan', 'On Loan'], ['available', 'Available'], ['lost', 'Lost'], ['repairing', 'Being Repaired'], ['removed', 'Permanently Removed']]
      .filter(function (t) { return edit || (t[0] !== 'lost' && t[0] !== 'removed'); });
    html += '<section class="panel" id="lib-status"><div class="lib-tabs" role="tablist" aria-label="' + esc(T('Library')) + '">' + tabs.map(function (t) {
      var active = catalogueTab === t[0];
      return '<button type="button" class="btn small' + (active ? ' primary' : '') + '" data-act="library:tab" data-tab="' + t[0] + '" role="tab" aria-selected="' + active + '">' +
        esc(T(t[1])) + ' <span class="muted small">' + tabCounts[t[0]] + '</span></button>';
    }).join('') + '</div></section>';
    if (edit) html += '<section class="panel" id="lib-pending"><div class="row"><h2 class="grow" style="margin:0">' + T('Pending Verifications') + '</h2><span class="muted small">' + TN('{n} item', '{n} items', pending.length) + '</span></div>' +
      (pending.length ? '<div class="list" style="margin-top:8px">' + pending.map(function (l) {
        return '<div class="item rec-item"><span class="grow"><b data-own-words>' + esc(l.title) + '</b> <span class="tag warn">' + T('Pending Verification') + '</span><small>' + who(l) + ' · ' + esc(T('Requested {date}', { date: H.fmt(l.out, true) })) + '</small></span>' +
          '<span class="rec-acts"><button class="btn small save" data-act="library:verify" data-id="' + esc(l.id) + '">' + T('Approve') + '</button><button class="btn small" data-act="library:reject" data-id="' + esc(l.id) + '">' + T('Reject') + '</button></span></div>';
      }).join('') + '</div>' : '<p class="muted small" style="margin:8px 0 0">' + T('No checkouts are waiting for verification.') + '</p>') + '</section>';
    if (edit) html += '<section class="panel" id="lib-out"><div class="row"><h2 class="grow" style="margin:0">' + T('On loan') + '</h2><span class="muted small" id="lib-out-count">' + TN('{n} item', '{n} items', out.length) + '</span></div>' +
      '<div class="row lib-filters" style="margin-top:8px"><label class="field">' + T('Borrower') + '<input id="lib-filter-borrower" type="search" list="lib-borrowers" value="' + esc(filters.borrower || T('All Borrowers')) + '" placeholder="' + esc(T('All Borrowers')) + '" autocomplete="off"></label>' +
      '<datalist id="lib-borrowers"><option value="' + esc(T('All Borrowers')) + '"></option>' + borrowers.map(function (name) { return '<option value="' + esc(name) + '"></option>'; }).join('') + '</datalist>' +
      '<button class="btn small" type="button" data-act="library:borrowerclear"' + (borrowerQuery() ? '' : ' hidden') + '>' + T('Clear') + '</button></div>' +
      (out.length ? '<div class="list" style="margin-top:8px">' + out.map(function (l) {
        var remind = L.remindDue(l, H.today());
        return '<div class="item rec-item lib-out-loan" data-borrower="' + esc(String(l.name || '').toLowerCase()) + '"><span class="grow"><b data-own-words>' + esc(l.title) + '</b>' + (remind ? ' <span class="tag warn">' + T('Reminder due') + '</span>' : '') +
          '<small>' + who(l) + ' · ' + esc(T('Lent {date}', { date: H.fmt(l.out, true) })) + ' · ' + esc(held(l)) + ' · ' + due(l) + (l.reminded ? ' · ' + esc(T('Reminded {date}', { date: H.fmt(l.reminded, true) })) : '') + '</small></span>' +
          '<span class="rec-acts">' + (L.daysOut(l, H.today()) >= L.REMIND_DAYS ? '<button class="btn small" data-act="library:remind" data-id="' + esc(l.id) + '">' + T('Send a reminder') + '</button>' : '') +
          '<button class="btn small" data-act="library:back" data-id="' + esc(l.id) + '">' + H.icon(H.ICON.check, 16) + T('Returned') + '</button>' +
          '<button class="btn small ghost" data-act="library:lost" data-id="' + esc(l.id) + '" title="' + esc(T('It won’t come back')) + '">' + T('Lost') + '</button>' + purgeButton('loan', l.id) + '</span></div>';
      }).join('') + '</div><p class="empty" id="lib-out-none" hidden>' + T('Nothing matches.') + '</p>' : '<p class="muted small" style="margin:8px 0 0">' + T('Nothing on loan.') + '</p>') +
      (back.length ? '<details class="sub" style="margin-top:10px"><summary>' + T('Recently returned') + '</summary><div class="list">' + back.map(function (l) {
        return '<div class="item"><span class="grow"><b data-own-words>' + esc(l.title) + '</b>' + (l.lost ? ' <span class="tag bad">' + T('Lost') + '</span>' : '') + '<small>' + who(l) + ' · ' + esc(H.fmt(l.out, true) + ' – ' + H.fmt(l.back, true)) + (l.returnNote ? ' · ' + esc(l.returnNote) : '') + '</small></span>' + purgeButton('loan', l.id) + '</div>'; }).join('') +
        '</div><p class="hint">' + T('Returned loans are removed after a year.') + '</p></details>' : '') + '</section>';
    if (gone.length) html += '<section class="panel" id="lib-gone"><h2 id="lib-gone-title">' + T('Removed from Library by Librarian') + ' <span class="muted small">' + TN('{n} item', '{n} items', gone.length) + '</span></h2><div class="list">' + gone.map(function (b) {
      return '<div class="item rec-item lib-gone-item" data-removed="' + (b.why === 'Lost' ? 'lost' : 'removed') + '"><span class="grow"><b data-own-words>' + esc(b.title) + '</b> <span class="tag grey">' + esc(T(b.why || 'Other')) + '</span><small>' + esc(H.fmt(b.removed, true)) + (b.whyNote ? ' · <span data-own-words>' + esc(b.whyNote) + '</span>' : '') + '</small></span>' +
        '<span class="rec-acts"><button class="btn small" data-act="library:putback" data-id="' + esc(b.id) + '">' + T('Put it back') + '</button>' + purgeButton('book', b.id) + '</span></div>'; }).join('') + '</div><p class="muted small" id="lib-gone-none" hidden>' + T('None') + '</p></section>';
    var sortFields = [['kind', 'Media type'], ['title', 'Title'], ['author', 'Author'], ['cat', 'Subject']];
    return html + '<section class="panel" id="lib-books">' +
      (edit ? '<div class="btns lib-cover-actions"><button class="btn small" data-act="library:coversselected" id="lib-covers-selected">' + T('Find covers for selected') + ' (<span id="lib-selected-count">0</span>)</button>' +
        '<button class="btn small" data-act="library:coversselectmissing">' + T('Select books missing covers') + '</button>' +
        '<button class="btn small" data-act="library:coversall">' + T('Find covers for all books') + '</button>' +
        '<button class="btn small" data-act="library:coversmissing">' + T('Find missing covers') + '</button></div>' : '') +
      '<div class="lib-sort"><span class="muted small">' + T('Sort by') + '</span><div class="btns">' + sortFields.map(function (f) {
        var active = sortKey === f[0];
        return '<button class="btn small' + (active ? ' primary' : '') + '" data-act="library:sort" data-k="' + f[0] + '" aria-pressed="' + active + '" title="' + esc(T('Sort by') + ' ' + T(f[1])) + '">' + T(f[1]) + (active ? (sortDir > 0 ? ' ▲' : ' ▼') : '') + '</button>';
      }).join('') + '</div></div>' +
      '<div class="two lib-filters">' +
      '<label class="field">' + T('Media type') + '<select id="lib-filter-kind"><option value="">' + T('Media type') + '</option>' + L.KINDS.map(function (k) { return '<option value="' + esc(k) + '"' + (filters.kind === k ? ' selected' : '') + '>' + esc(T(k)) + '</option>'; }).join('') + '</select></label>' +
      '<label class="field">' + T('Title') + '<input id="lib-filter-title" type="search" value="' + esc(filters.title) + '" autocomplete="off"></label>' +
      '<label class="field">' + T('Author') + '<input id="lib-filter-author" type="search" value="' + esc(filters.author) + '" autocomplete="off"></label>' +
      '<label class="field">' + T('Subject') + '<input id="lib-filter-cat" type="search" value="' + esc(filters.cat) + '" autocomplete="off"></label></div>' +
      '<span class="muted small" id="lib-count">' + TN('{n} item', '{n} items', books.length) + '</span>' +
      '<div class="list" style="margin-top:8px">' + books.map(function (b) { return bookRow(b, edit); }).join('') + '</div><p class="empty" id="lib-none" hidden>' + T('Nothing matches.') + '</p>' +
      (!all.length ? '<p class="empty">' + T('Nothing in the library yet.') + '</p>' : '') + '</section>';
  }
  function applySearch() {
    var shown = 0, allLoans = loans(), borrower = borrowerQuery();
    [].forEach.call(document.querySelectorAll('.lib-book'), function (it) {
      var status = catalogueTab === 'onLoan' ? it.dataset.out === 'true' :
        catalogueTab === 'available' ? it.dataset.free === 'true' && it.dataset.repairing !== 'true' :
        catalogueTab === 'repairing' ? it.dataset.repairing === 'true' :
        catalogueTab === 'lost' || catalogueTab === 'removed' ? false : true;
      var hit = status && (!filters.kind || it.dataset.kind === filters.kind) &&
        (!filters.title || it.dataset.title.toLowerCase().indexOf(filters.title.trim().toLowerCase()) >= 0) &&
        (!filters.author || it.dataset.author.toLowerCase().indexOf(filters.author.trim().toLowerCase()) >= 0) &&
        (!filters.cat || it.dataset.subject.toLowerCase().indexOf(filters.cat.trim().toLowerCase()) >= 0) &&
        (!borrower || allLoans.some(function (l) {
          return l.bookId === it.querySelector('[data-act="library:bookinfo"]').dataset.id && L.isOut(l) && String(l.name || '').toLowerCase().indexOf(borrower) >= 0;
        }));
      it.hidden = !hit; if (hit) shown++;
    });
    var outShown = 0;
    [].forEach.call(document.querySelectorAll('.lib-out-loan'), function (row) {
      row.hidden = !!borrower && row.dataset.borrower.indexOf(borrower) < 0;
      if (!row.hidden) outShown++;
    });
    var outCount = document.getElementById('lib-out-count'); if (outCount) outCount.textContent = TN('{n} item', '{n} items', outShown);
    var outNone = document.getElementById('lib-out-none'); if (outNone) outNone.hidden = outShown > 0;
    var borrowerClear = document.querySelector('[data-act="library:borrowerclear"]'); if (borrowerClear) borrowerClear.hidden = !borrower;
    var booksPanel = document.getElementById('lib-books'); if (booksPanel) booksPanel.hidden = catalogueTab === 'lost' || catalogueTab === 'removed';
    var outPanel = document.getElementById('lib-out'); if (outPanel) outPanel.hidden = catalogueTab !== 'all' && catalogueTab !== 'onLoan';
    var gonePanel = document.getElementById('lib-gone'); if (gonePanel) {
      gonePanel.hidden = catalogueTab !== 'all' && catalogueTab !== 'lost' && catalogueTab !== 'removed';
      var goneShown = 0;
      [].forEach.call(gonePanel.querySelectorAll('.lib-gone-item'), function (it) {
        it.hidden = catalogueTab === 'lost' ? it.dataset.removed !== 'lost' : catalogueTab === 'removed' ? it.dataset.removed !== 'removed' : false;
        if (!it.hidden) goneShown++;
      });
      var goneNone = document.getElementById('lib-gone-none');
      if (goneNone) goneNone.hidden = (catalogueTab !== 'lost' && catalogueTab !== 'removed') || goneShown > 0;
    }
    var none = document.getElementById('lib-none'); if (none) none.hidden = shown > 0;
    var count = document.getElementById('lib-count'); if (count) count.textContent = TN('{n} item', '{n} items', shown);
  }
  function updateCoverControls() {
    var count = Object.keys(selectedBooks).filter(function (id) { return selectedBooks[id]; }).length;
    var label = document.getElementById('lib-selected-count'), button = document.getElementById('lib-covers-selected');
    if (label) label.textContent = count;
    if (button) button.disabled = !count;
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
      if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 12000000) return fail(new Error('unsupported picture'));
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        try {
          var k = Math.min(1, 360 / Math.max(img.naturalWidth, img.naturalHeight)), cv = document.createElement('canvas');
          cv.width = Math.max(1, Math.round(img.naturalWidth * k)); cv.height = Math.max(1, Math.round(img.naturalHeight * k));
          var c = cv.getContext('2d'); if (!c) throw new Error('canvas unavailable');
          c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height); c.drawImage(img, 0, 0, cv.width, cv.height);
          URL.revokeObjectURL(url);
          var d = cv.toDataURL('image/jpeg', 0.8); if (d.length > 190000) d = cv.toDataURL('image/jpeg', 0.5);
          if (d.length > 190000) throw new Error('picture too large');
          ok(d);
        } catch (e) { URL.revokeObjectURL(url); fail(e); }
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

  function coverImageData(src) {
    return new Promise(function (resolve, reject) {
      var url;
      try { url = new URL(src); } catch (e) { return reject(new Error('invalid image URL')); }
      if (url.protocol !== 'https:' || !/^(books\.google\.com|books\.googleusercontent\.com)$/.test(url.hostname)) return reject(new Error('untrusted image URL'));
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () {
        try {
          var k = Math.min(1, 360 / Math.max(img.naturalWidth, img.naturalHeight)), cv = document.createElement('canvas');
          cv.width = Math.max(1, Math.round(img.naturalWidth * k)); cv.height = Math.max(1, Math.round(img.naturalHeight * k));
          var c = cv.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height); c.drawImage(img, 0, 0, cv.width, cv.height);
          var data = cv.toDataURL('image/jpeg', 0.8);
          if (data.length > 190000) data = cv.toDataURL('image/jpeg', 0.5);
          if (data.length > 190000) return reject(new Error('image too large'));
          resolve(data);
        } catch (e) { reject(e); }
      };
      img.onerror = function () { reject(new Error('image could not be read')); };
      img.src = url.href;
    });
  }
  function normalized(s) { return L.normalizedTitle(s).replace(/\s/g, ''); }
  function isbnDigits(s) { return String(s || '').replace(/[^0-9x]/gi, '').toLowerCase(); }
  function bookMatch(book, item) {
    var info = item.volumeInfo || {}, ids = info.industryIdentifiers || [], isbn = isbnDigits(book.isbn);
    if (isbn && ids.some(function (x) { return isbnDigits(x.identifier) === isbn; })) return true;
    var wanted = normalized(book.title), got = normalized(info.title);
    if (!wanted || !got || !(wanted === got || got.indexOf(wanted) === 0 || wanted.indexOf(got) === 0)) return false;
    var authors = (info.authors || []).map(normalized).filter(Boolean), author = normalized(book.author);
    return !author || !authors.length || authors.some(function (x) { return x.indexOf(author) >= 0 || author.indexOf(x) >= 0; });
  }
  function coverQuery(query) {
    return fetch('https://www.googleapis.com/books/v1/volumes?q=' + encodeURIComponent(query) + '&maxResults=8&printType=books')
      .then(function (response) {
        function limitError() { var limit = new Error('rate limit'); limit.rateLimited = true; return limit; }
        if (response.status === 429) throw limitError();
        return response.json().then(function (data) {
          var error = data.error || {}, reasons = (error.errors || []).map(function (item) { return item.reason || ''; }).join(' ');
          if (/quota|rate.?limit|daily.?limit/i.test(error.message || '') || /quota|rate.?limit|daily.?limit/i.test(reasons)) throw limitError();
          if (!response.ok || data.error) throw new Error('cover service unavailable');
          return data;
        });
      });
  }
  function lookupCover(book) {
    var queries = [];
    if (book.isbn) queries.push('isbn:' + book.isbn.replace(/[^0-9x]/gi, ''));
    var title = String(book.title || '').replace(/["\\]/g, ' ').trim(), author = String(book.author || '').replace(/["\\]/g, ' ').trim();
    if (title) queries.push('intitle:"' + title + '"' + (author ? '+inauthor:"' + author + '"' : ''));
    function search(index) {
      if (index >= queries.length) return Promise.resolve(null);
      return coverQuery(queries[index]).then(function (data) {
        var candidates = (data.items || []).filter(function (item) { return bookMatch(book, item) && item.volumeInfo && item.volumeInfo.imageLinks; });
        var links = candidates.map(function (item) { return item.volumeInfo.imageLinks.thumbnail || item.volumeInfo.imageLinks.smallThumbnail; }).filter(Boolean);
        function tryImage(i) {
          if (i >= links.length) return search(index + 1);
          var imgUrl = links[i].replace(/^http:/, 'https:').replace(/&amp;/g, '&');
          return coverImageData(imgUrl).then(function (image) { return { data: image }; }, function () { return tryImage(i + 1); });
        }
        return tryImage(0);
      });
    }
    return search(0);
  }
  var coverBatch = null, coverBatchRunning = false;
  function coverBatchDialog(open) {
    if (!coverBatch) return;
    if (!open && !document.getElementById('lib-cover-batch')) { coverBatch = null; coverBatchRunning = false; return; }
    var found = coverBatch.filter(function (x) { return x.data && !x.saved; });
    var rows = coverBatch.map(function (x) {
      var preview = x.data ? '<img class="lib-cover-preview" src="' + esc(x.data) + '" alt="' + esc(T('Cover of {name}', { name: x.book.title })) + '">' : '';
      var save = x.data && !x.saved ? '<button class="btn small save" data-act="library:coversave" data-id="' + esc(x.book.id) + '">' + T('Save this cover') + '</button>' : '';
      return '<div class="item lib-cover-result">' + preview + '<span class="grow"><b data-own-words>' + esc(x.book.title) + '</b><small>' + esc(x.status) + '</small></span>' + save + '</div>';
    }).join('');
    H.modal('<div id="lib-cover-batch">' + H.dialogHead(T('Find book covers'), T('Preview each cover before saving it to the library.')) +
      '<div class="dlg-body"><p id="lib-cover-progress" class="hint">' + esc(coverBatch.progress || '') + '</p><div id="lib-cover-results" class="list">' + rows + '</div></div>' +
      '<div class="dlg-foot"><button class="btn" data-act="' + (coverBatchRunning ? 'library:coversclose' : 'hub:close') + '">' + (coverBatchRunning ? T('Cancel search') : T('Close')) + '</button><button class="btn save" data-act="library:coverssaveall"' + (found.length && !coverBatchRunning ? '' : ' disabled') + '>' + T('Save all found covers') + ' (' + found.length + ')</button></div></div>', T('Find book covers'), true);
  }
  function runCoverBatch(mode) {
    if (!librarian()) return;
    var books = S.list('books').filter(function (b) { return L.inLibrary(b) && (b.kind || 'Book') === 'Book'; });
    var targets = mode === 'selected' ? books.filter(function (b) { return selectedBooks[b.id]; }) :
      mode === 'missing' ? books.filter(function (b) { return !b.cover; }) : books;
    if (!targets.length) { H.toast(T(mode === 'selected' ? 'Select at least one book.' : 'No books to look up.'), true); return; }
    coverBatch = targets.map(function (book) { return { book: book, data: '', saved: false, status: T('Loading…') }; });
    coverBatchRunning = true;
    coverBatch.progress = T('Searching for covers ({n} of {total})', { n: 0, total: targets.length });
    coverBatchDialog(true);
    var index = 0;
    function next() {
      if (!librarian() || !coverBatch || !coverBatchRunning) return;
      if (index >= coverBatch.length) {
        coverBatchRunning = false;
        coverBatch.progress = T('Search complete. Preview and choose which covers to save.');
        return coverBatchDialog();
      }
      var entry = coverBatch[index], current = ++index, rateLimited = false;
      coverBatch.progress = T('Searching for covers ({n} of {total})', { n: current, total: targets.length });
      coverBatchDialog();
      lookupCover(entry.book).then(function (result) {
        if (result) { entry.data = result.data; entry.status = T('Cover found'); }
        else entry.status = T('No matching cover found');
      }, function (error) {
        entry.status = error.rateLimited ? T('The cover service has reached its limit. Try the remaining books later.') : T('Couldn’t search for this cover. Check your connection and try again.');
        if (error.rateLimited) { rateLimited = true; coverBatch.slice(index).forEach(function (x) { x.status = T('The cover service has reached its limit. Try the remaining books later.'); }); }
      }).then(function () {
        if (!coverBatch || !coverBatchRunning) return;
        coverBatch.progress = T('Searching for covers ({n} of {total})', { n: current, total: targets.length });
        coverBatchDialog();
        if (rateLimited) {
          index = coverBatch.length;
          coverBatchRunning = false;
          coverBatch.progress = T('Search complete. Preview and choose which covers to save.');
          return coverBatchDialog();
        }
        window.setTimeout(next, 350);
      });
    }
    next();
  }
  function saveBatchCover(id) {
    if (!librarian() || !coverBatch) return;
    var entry = coverBatch.filter(function (x) { return x.book.id === id && x.data && !x.saved; })[0];
    if (!entry || !S.get('books', id)) return;
    coverBatch.progress = T('Saving…');
    coverBatchDialog();
    return S.setCover(id, entry.data, 'Saved a book cover for “' + entry.book.title + '”').then(function () {
      entry.saved = true; entry.status = T('Saved');
      coverCache[id + '|' + (S.get('books', id) || {}).cover] = entry.data;
      coverBatch.progress = T('Saved');
      coverBatchDialog();
    }, function (error) {
      console.error(error); entry.status = T('Couldn’t save it. Please try again.');
      coverBatch.progress = T('Couldn’t save it. Please try again.');
      coverBatchDialog();
    });
  }

  function duplicateDialog() {
    if (!librarian()) return;
    var ignored = S.list('libraryDuplicateIgnores').map(function (x) { return x.pair; });
    var pairs = L.duplicatePairs(S.list('books'), ignored);
    var rows = pairs.map(function (pair) {
      function details(book) {
        var copies = Math.max(1, +book.copies || 1), available = free(book);
        return '<article class="lib-duplicate-item"><h3 data-own-words>' + esc(book.title) + '</h3><dl><dt>' + T('Author') + '</dt><dd>' + esc(book.author || '—') + '</dd>' +
          '<dt>' + T('Media type') + '</dt><dd>' + esc(T(book.kind || 'Book')) + '</dd><dt>' + T('ISBN / Code') + '</dt><dd>' + esc(book.isbn || '—') + '</dd>' +
          '<dt>' + T('Copies / Status') + '</dt><dd>' + esc(T('{n} of {total}', { n: available, total: copies })) + ' · ' + (book.repairing ? T('Being Repaired') : available ? T('Available') : T('On loan')) + '</dd></dl></article>';
      }
      return '<div class="lib-duplicate-pair">' + details(pair.first) + details(pair.second) +
        '<div class="btns"><button class="btn small" data-act="library:duplicateedit" data-key="' + esc(pair.key) + '">' + T('Standardize matched items') + '</button>' +
        '<button class="btn small ghost" data-act="library:duplicateignore" data-key="' + esc(pair.key) + '">' + T('Ignore this suggestion') + '</button></div></div>';
    }).join('');
    H.modal(H.dialogHead(T('Suggested Duplicates'), T('Review possible matches. Standardizing changes catalogue details only; copies and loan records stay separate.')) +
      '<div class="dlg-body"><div class="lib-duplicate-list">' + (rows || '<p class="empty">' + T('No possible duplicates were found.') + '</p>') + '</div></div>' +
      '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Close') + '</button></div>', T('Suggested Duplicates'), true);
  }
  function duplicateEditDialog(key) {
    if (!librarian()) return;
    var pair = L.duplicatePairs(S.list('books')).filter(function (x) { return x.key === key; })[0];
    if (!pair) return;
    var b = pair.first;
    H.modal(H.dialogHead(T('Standardize matched items'), pair.first.title + ' · ' + pair.second.title) + '<div class="dlg-body">' +
      '<label class="field req">' + T('Title') + '<input id="lib-dup-title" maxlength="150" value="' + esc(b.title) + '"></label>' +
      '<label class="field">' + T('Author') + '<input id="lib-dup-author" maxlength="150" value="' + esc(b.author) + '"></label>' +
      '<div class="two"><label class="field">' + T('Media type') + '<select id="lib-dup-kind">' + L.KINDS.map(function (k) { return '<option value="' + esc(k) + '"' + ((b.kind || 'Book') === k ? ' selected' : '') + '>' + esc(T(k)) + '</option>'; }).join('') + '</select></label>' +
      '<label class="field">' + T('Subject') + '<input id="lib-dup-cat" maxlength="60" value="' + esc(b.cat || '') + '"></label></div>' +
      '<label class="field">' + T('ISBN / Code') + '<input id="lib-dup-isbn" maxlength="20" value="' + esc(b.isbn || '') + '"></label></div>' +
      '<div class="dlg-foot"><button class="btn" data-act="library:duplicates">' + T('Back') + '</button><button class="btn save" data-act="library:duplicatesave" data-key="' + esc(key) + '">' + T('Apply to both items') + '</button></div>', T('Standardize matched items'));
  }
  function bookInfoDialog(book) {
    var terms = [book.title, book.author].filter(Boolean).join(' '), encoded = encodeURIComponent(terms);
    var booksUrl = 'https://books.google.com/books?q=' + encoded, searchUrl = 'https://www.google.com/search?q=' + encoded;
    var query = book.isbn ? 'isbn:' + book.isbn.replace(/[^0-9x]/gi, '') : 'intitle:' + book.title + (book.author ? '+inauthor:' + book.author : '');
    H.modal(H.dialogHead(T('Book / Media Information'), book.title) + '<div class="dlg-body"><div id="lib-info-results" class="lib-info-results"><p class="muted">' + T('Searching Google Books…') + '</p></div>' +
      '<p class="lib-info-links">' + T('Read more') + ': <a href="' + esc(booksUrl) + '" target="_blank" rel="noopener">' + T('Google Books') + '</a> · ' +
      '<a href="' + esc(searchUrl) + '" target="_blank" rel="noopener">' + T('Google Search') + '</a></p></div>' +
      '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Close') + '</button></div>', T('Book / Media Information'), true);
    fetch('https://www.googleapis.com/books/v1/volumes?q=' + encodeURIComponent(query) + '&maxResults=8&printType=books')
      .then(function (response) {
        if (!response.ok) throw new Error('Google Books returned ' + response.status);
        return response.json();
      }).then(function (data) {
        var target = document.getElementById('lib-info-results'); if (!target) return;
        var item = (data.items || []).filter(function (x) { return bookMatch(book, x); })[0];
        if (!item) { target.innerHTML = '<p class="muted">' + T('No matching book information was found. Use the search links below.') + '</p>'; return; }
        var v = item.volumeInfo || {}, image = v.imageLinks && (v.imageLinks.thumbnail || v.imageLinks.smallThumbnail), imageUrl = '';
        try {
          var parsed = new URL(String(image || '').replace(/^http:/, 'https:'));
          if (parsed.protocol === 'https:' && /^(books\.google\.com|books\.googleusercontent\.com)$/.test(parsed.hostname)) imageUrl = parsed.href;
        } catch (e) { imageUrl = ''; }
        var infoUrl = booksUrl;
        try {
          var parsedInfo = new URL(item.volumeInfo.infoLink || '');
          if (parsedInfo.protocol === 'https:' && /(^|\.)google\.com$/.test(parsedInfo.hostname)) infoUrl = parsedInfo.href;
        } catch (e) { infoUrl = booksUrl; }
        target.innerHTML = (imageUrl ? '<img class="lib-info-cover" src="' + esc(imageUrl) + '" alt="' + esc(T('Cover of {name}', { name: v.title || book.title })) + '">' : '') +
          '<div><h3>' + esc(v.title || book.title) + '</h3>' + (v.subtitle ? '<p>' + esc(v.subtitle) + '</p>' : '') +
          (v.authors && v.authors.length ? '<p><b>' + T('Author') + ':</b> ' + esc(v.authors.join(', ')) + '</p>' : '') +
          (v.publisher ? '<p><b>' + T('Publisher') + ':</b> ' + esc(v.publisher) + '</p>' : '') +
          (v.publishedDate ? '<p><b>' + T('Published') + ':</b> ' + esc(v.publishedDate) + '</p>' : '') +
          (v.description ? '<p class="lib-info-description">' + esc(String(v.description).slice(0, 1800)) + '</p>' : '') +
          '<a href="' + esc(infoUrl) + '" target="_blank" rel="noopener">' + T('Open in Google Books') + '</a></div>';
      }).catch(function (error) {
        console.error('Could not load Google Books information', error);
        var target = document.getElementById('lib-info-results');
        if (target) target.innerHTML = '<p class="muted">' + T('Couldn’t load book information. Use the search links below.') + '</p>';
      });
  }
  function requestDialog(book) {
    if (!me() || librarian() || (!S.isLive() && free(book) < 1)) return;
    var person = S.get('people', me().id) || me(), mobile = L.phone(person.mobile);
    H.modal(H.dialogHead(T('Request to borrow'), book.title) + '<div class="dlg-body"><p>' + T('A librarian will verify your checkout. The copy is reserved while you wait.') + '</p>' +
      (!mobile ? '<label class="field req">' + T('Mobile number') + '<input id="lib-request-mobile" type="tel" maxlength="30" autocomplete="tel"></label>' : '') +
      '<p id="lib-request-error" class="note bad" role="alert" hidden></p></div>' +
      '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn save" data-act="library:requestsubmit" data-id="' + esc(book.id) + '">' + T('Send checkout request') + '</button></div>', T('Request to borrow'));
  }

  function form(b) {
    var isNew = !b.id, cats = L.cats(S.list('books'));
    newCover = undefined;
    H.modal(H.dialogHead(isNew ? T('Add to the library') : T('Edit {name}', { name: b.title })) + '<div class="dlg-body">' +
      '<div class="two"><label class="field req">' + T('What it is') + '<select id="lib-kind">' + L.KINDS.map(function (k) { return '<option value="' + esc(k) + '"' + ((b.kind || 'Book') === k ? ' selected' : '') + '>' + esc(T(k)) + '</option>'; }).join('') + '</select></label>' +
      '<label class="field req">' + T('Copies') + '<input id="lib-copies" type="number" min="1" max="99" value="' + esc(b.copies || 1) + '"></label></div>' +
      '<label class="field req">' + T('Title') + '<input id="lib-title" maxlength="150" value="' + esc(b.title || '') + '"></label>' +
      '<label class="field">' + T('Author') + '<input id="lib-author" maxlength="150" value="' + esc(b.author || '') + '"></label>' +
      '<div class="field"><span>' + T('Cover') + '</span><div id="lib-cover-drop" class="lib-cover-drop"><div id="lib-cover-now" class="lib-cover-now"></div><div><p>' + T('Drop a cover image here, or choose a picture.') + '</p><div class="btns">' +
        '<label class="btn small">' + T('Choose a picture') + '<input id="lib-pic" type="file" accept="image/jpeg,image/png,image/webp" hidden></label>' +
        '<label class="btn small">' + T('Take a photo') + '<input id="lib-cam" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden></label>' +
        '<button type="button" class="btn small ghost" id="lib-cover-rm" data-act="library:coverrm" hidden>' + T('Remove the picture') + '</button></div><small class="muted">' + T('JPEG, PNG or WebP; pictures are resized before saving.') + '</small></div></div></div>' +
      '<label class="field">' + T('Subject') + '<input id="lib-cat" maxlength="60" list="lib-cats" value="' + esc(b.cat || '') + '"><datalist id="lib-cats">' + cats.map(function (c) { return '<option value="' + esc(c) + '">'; }).join('') + '</datalist></label>' +
      '<div class="two"><label class="field">' + T('How it was acquired') + '<select id="lib-how"><option value="">' + T('Choose…') + '</option>' + L.HOW.map(function (h) { return '<option value="' + esc(h) + '"' + (b.how === h ? ' selected' : '') + '>' + esc(T(h)) + '</option>'; }).join('') + '</select></label>' +
      '<label class="field">' + T('Date acquired') + '<input id="lib-acq" type="date" value="' + esc(isNew ? H.today() : b.acquired || '') + '"></label></div>' +
      '<label class="field">' + T('From (the donor or the shop)') + '<input id="lib-from" maxlength="150" value="' + esc(b.from || '') + '"></label>' +
      '<div class="two"><label class="field">' + T('Shelf') + '<input id="lib-shelf" maxlength="60" value="' + esc(b.shelf || '') + '"></label>' +
      '<label class="field">' + T('ISBN') + '<input id="lib-isbn" maxlength="20" value="' + esc(b.isbn || '') + '"></label></div>' +
      '<label class="field">' + T('Note') + '<textarea id="lib-note" rows="2" maxlength="500">' + esc(b.note || '') + '</textarea></label></div>' +
      '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn save" data-act="library:save" data-id="' + esc(b.id || '') + '">' + T('Save') + '</button></div>', T('Add to the library'));
    coverPreview(b);
    if (b.cover && !coverCache[b.id + '|' + b.cover]) S.cover(b.id).then(function (d) { coverCache[b.id + '|' + b.cover] = d || ''; coverPreview(b); });
    function chooseCover(file) {
      if (!file) return;
      shrinkCover(file).then(function (d) { newCover = d; coverPreview(b); }, function () { H.toast(T('That isn’t a picture Church Hub can read.'), true); });
    }
    ['lib-cam', 'lib-pic'].forEach(function (id) {
      var inp = document.getElementById(id); if (!inp) return;
      inp.addEventListener('change', function () {
        var f = inp.files && inp.files[0]; inp.value = ''; chooseCover(f);
      });
    });
    var drop = document.getElementById('lib-cover-drop');
    if (drop) {
      ['dragenter', 'dragover'].forEach(function (type) { drop.addEventListener(type, function (ev) { ev.preventDefault(); drop.classList.add('drag'); }); });
      ['dragleave', 'drop'].forEach(function (type) { drop.addEventListener(type, function (ev) { ev.preventDefault(); drop.classList.remove('drag'); }); });
      drop.addEventListener('drop', function (ev) { chooseCover(ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0]); });
    }
  }

  /* ---------- lending: to someone on the church's list, or to a visitor – always with a mobile number ---------- */
  function lendDialog(b, step) {
    var finder = window.CareUI && CareUI.finder; if (!finder) return;
    var body = '<label class="field req">' + T('Date borrowed') + '<input type="date" id="lib-due" value="' + esc(val('lib-due') || L.addDays(H.today(), L.LOAN_DAYS)) + '"></label>';
    if (step && step.person) {
      var p = step.person;
      body += '<p>' + esc(T('{name} has no mobile number on record. Type one so the item can be traced.', { name: H.name(p) })) + '</p>' +
        '<label class="field req">' + T('Mobile number') + '<input id="lib-mob" type="tel" maxlength="30" autocomplete="off"></label>' +
        (H.can('people.edit') ? '<label class="check"><input type="checkbox" id="lib-mob-save" checked><span>' + T('Also save it in their details') + '</span></label>' : '') +
        '<p id="lib-err" class="note bad" hidden></p></div><div class="dlg-foot"><button class="btn" data-act="library:lend" data-id="' + esc(b.id) + '">' + T('Back') + '</button>' +
        '<button class="btn save" data-act="library:lendto" data-b="' + esc(b.id) + '" data-id="' + esc(p.id) + '">' + T('Lend') + '</button></div>';
    } else {
      body += '<label class="field req" style="margin-bottom:6px">' + T('Who is borrowing it') + '</label>' + finder('lib-lend', everyone(), 'library:lendto', { b: b.id }, null, T('Type part of their name'), { keep: false }) +
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
      '<div class="field"><label for="lib-pol">' + T('Paste the policy here') + '</label>' + (window.RichText ? RichText.tools('lib-pol', fmtWords(), ['b', 'i', 'h', 'ul', 'ol']) : '') + '<textarea id="lib-pol" rows="10" maxlength="' + L.POLICY_MAX + '">' + esc(p.text || '') + '</textarea>' + legend() +
        '<details class="sub" id="lib-pol-prev-box"><summary>' + T('Preview') + '</summary><div id="lib-pol-prev" class="lib-doc" data-own-words>' + L.policyHtml(p.text || '') + '</div></details></div>' +
      '<div class="field"><span>' + T('Or attach a file (PDF, Word or a picture)') + '</span><div class="btns"><label class="btn small">' + T('Choose a file') +
        '<input id="lib-pol-file" type="file" accept=".pdf,.doc,.docx,.txt,.odt,image/*" hidden></label><span id="lib-pol-name" class="muted small"></span>' +
        '<button type="button" class="btn small ghost" id="lib-pol-rm" data-act="library:policynofile" hidden>' + T('Remove the file') + '</button></div></div>' +
      '<p id="lib-pol-err" class="note bad" hidden></p></div>' +
      '<div class="dlg-foot">' + (policy ? '<button class="btn ghost" data-act="library:policydel">' + T('Remove the policy') + '</button>' : '') +
      '<button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn save" data-act="library:policysave">' + T('Save') + '</button></div>', T('Library policy'));
    showPolicyFile();
    var box = document.getElementById('lib-pol'), prev = document.getElementById('lib-pol-prev');   // the preview follows what is typed
    if (box && prev) box.addEventListener('input', H.pause(function () { prev.innerHTML = L.policyHtml(box.value); }, 200));
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

  if (typeof document !== 'undefined') {
    document.addEventListener('input', function (ev) {
      var field = { 'lib-filter-title': 'title', 'lib-filter-author': 'author', 'lib-filter-cat': 'cat', 'lib-filter-borrower': 'borrower' }[ev.target.id];
      if (field) {
        var value = ev.target.value;
        filters[field] = field === 'borrower' && value.trim().toLowerCase() === T('All Borrowers').toLowerCase() ? '' : value;
        applySearch();
      }
      if (ev.target.id === 'lib-report-filter') { reportFilter = ev.target.value; applyReportSearch(); }
    });
    document.addEventListener('change', function (ev) {
      if (ev.target.id === 'lib-filter-kind') { filters.kind = ev.target.value; applySearch(); }
      if (ev.target.matches && ev.target.matches('[data-lib-select]')) {
        var id = ev.target.getAttribute('data-lib-select');
        if (ev.target.checked) selectedBooks[id] = true; else delete selectedBooks[id];
        updateCoverControls();
      }
    });
  }

  function viewable(type) { return /^(application\/pdf|image\/)/.test(type || ''); }
  function blobUrl(type, b64) { var bin = atob(b64), bytes = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); return URL.createObjectURL(new Blob([bytes], { type: type })); }
  /* ---------- taking an item out, and putting it back ---------- */
  function removeDialog(b) {
    var lent = S.find('loans', function (l) { return l.bookId === b.id; }).length;
    H.modal(H.dialogHead(T('Take out of the library'), b.title) + '<div class="dlg-body"><p class="muted small" style="margin-top:0">' + T('It stays in the reports, and can be put back if it turns up.') + '</p>' +
      '<label class="field req">' + T('Why') + '<select id="lib-why">' + L.REASONS.map(function (r) { return '<option value="' + esc(r) + '">' + esc(T(r)) + '</option>'; }).join('') + '</select></label>' +
      '<label class="field">' + T('Note') + '<input id="lib-whynote" maxlength="200"></label>' +
      (lent ? '' : '<details class="sub"><summary>' + T('Added by mistake?') + '</summary><p class="small">' + T('Delete it completely, as if it had never been added.') + '</p><button class="btn small ghost" data-act="library:del" data-id="' + esc(b.id) + '">' + H.icon(H.ICON.trash, 16) + T('Delete') + '</button></details>') + '</div>' +
      '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn save" data-act="library:removesave" data-id="' + esc(b.id) + '">' + T('Take out') + '</button></div>', T('Take out of the library'));
  }
  /* ---------- importing a list (CSV) ---------- */
  var importDraft = null;
  function importDialog() {
    importDraft = null;
    H.modal(H.dialogHead(T('Import a list'), T('A spreadsheet saved as CSV, with a heading on each column: Title (needed), and any of Author, Type, Category, Copies, Shelf, ISBN, Date acquired, How acquired, Donated by, Note.')) + '<div class="dlg-body">' +
      '<div class="btns"><label class="btn">' + T('Choose a file') + '<input id="lib-csv" type="file" accept=".csv,text/csv,text/plain" hidden></label><span id="lib-csv-name" class="muted small"></span></div>' +
      '<div id="lib-csv-plan" class="note" hidden></div><p id="lib-csv-err" class="note bad" hidden></p></div>' +
      '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn save" id="lib-csv-go" data-act="library:importgo" disabled>' + T('Import') + '</button></div>', T('Import a list'));
    var inp = document.getElementById('lib-csv');
    inp.addEventListener('change', function () {
      var f = inp.files && inp.files[0]; inp.value = ''; if (!f) return;
      document.getElementById('lib-csv-name').textContent = f.name;
      f.text().then(function (txt) {
        var plan = L.importPlan(L.parseCSV(txt), S.list('books'), H.today()), err = document.getElementById('lib-csv-err'), box = document.getElementById('lib-csv-plan'), go = document.getElementById('lib-csv-go');
        err.hidden = true; box.hidden = true; go.disabled = true; importDraft = null;
        if (plan.error) { err.textContent = T('Church Hub couldn’t find a Title column. The first row must hold the headings, one of them Title.'); err.hidden = false; return; }
        importDraft = plan;
        box.innerHTML = '<b>' + esc(TN('{n} new item will be added', '{n} new items will be added', plan.add.length)) + '</b>' +
          (plan.dup ? '<br>' + esc(TN('{n} is already in the library and will be left out', '{n} are already in the library and will be left out', plan.dup)) : '') +
          (plan.noTitle ? '<br>' + esc(TN('{n} row has no title and will be left out', '{n} rows have no title and will be left out', plan.noTitle)) : '') +
          (plan.add.length ? '<ul class="small">' + plan.add.slice(0, 5).map(function (b) { return '<li data-own-words>' + esc(b.title + (b.author ? ' – ' + b.author : '') + (b.kind !== 'Book' ? ' (' + T(b.kind) + ')' : '')) + '</li>'; }).join('') + (plan.add.length > 5 ? '<li>…</li>' : '') + '</ul>' : '');
        box.hidden = false; go.disabled = !plan.add.length;
      });
    });
  }
  /* ---------- reports ---------- */
  var repFrom = '', repTo = '', reportTab = 'onLoan', reportFilter = '';
  function reportDialog() {
    var today = H.today(); repFrom = repFrom || today.slice(0, 4) + '-01-01'; repTo = repTo || today;
    var rep = L.report(S.list('books'), loans(), repFrom, repTo);
    var t = function (x) { return '<b data-own-words>' + esc(x.title) + '</b>'; };
    var sections = [
      ['onLoan', 'On Loan', rep.lent, function (l) { return t(l) + '<small>' + esc(H.fmt(l.out, true)) + ' · ' + who(l) + '</small>'; }],
      ['returned', 'Returned', rep.returned, function (l) { return t(l) + '<small>' + esc(H.fmt(l.back, true)) + ' · ' + esc(l.name) + (l.returnNote ? ' · ' + esc(l.returnNote) : '') + '</small>'; }],
      ['lost', 'Lost', rep.lost, function (l) { return t(l) + '<small>' + esc(H.fmt(l.back, true)) + ' · ' + who(l) + '</small>'; }],
      ['acquired', 'Acquired', rep.acquired, function (b) { return t(b) + '<small>' + esc([H.fmt(b.acquired, true), b.how ? T(b.how) : '', b.from].filter(Boolean).join(' · ')) + '</small>'; }],
      ['removed', 'Removed from Library by Librarian', rep.removed, function (b) { return t(b) + '<small>' + esc(H.fmt(b.removed, true) + ' · ' + T(b.why || 'Other') + (b.whyNote ? ' – ' + b.whyNote : '')) + '</small>'; }]
    ];
    var selected = sections.filter(function (s) { return s[0] === reportTab; })[0] || sections[0];
    reportTab = selected[0];
    var items = selected[2].map(function (x) {
      var searchable = [x.title, x.author, x.name, x.mobile, x.from, x.how, x.why, x.whyNote, x.returnNote, x.out, x.back, x.acquired, x.removed].filter(Boolean).join(' ').toLowerCase();
      var type = selected[0] === 'removed' ? 'book' : selected[0] === 'acquired' ? '' : 'loan';
      return '<div class="item lib-report-row" data-search="' + esc(searchable) + '"><span class="grow">' + selected[3](x) + '</span>' + (type ? purgeButton(type, x.id) : '') + '</div>';
    }).join('');
    H.modal(H.dialogHead(T('Reports'), T('Show library activity between two dates')) + '<div class="dlg-body">' +
      '<div class="two"><label class="field">' + T('From') + '<input type="date" id="lib-rfrom" value="' + esc(repFrom) + '"></label><label class="field">' + T('To') + '<input type="date" id="lib-rto" value="' + esc(repTo) + '"></label></div>' +
      '<div class="btns lib-report-actions"><button class="btn small" data-act="library:reportgo">' + T('Show') + '</button><button class="btn small" data-act="library:reportprint">' + T('Print') + '</button><button class="btn small" data-act="library:reportcsv">' + H.icon(H.ICON.download || H.ICON.check, 16) + T('Download as a spreadsheet') + '</button></div>' +
      '<div id="lib-rep"><div class="lib-tabs" role="tablist" aria-label="' + esc(T('Reports')) + '">' + sections.map(function (s) {
        var active = reportTab === s[0];
        return '<button type="button" class="btn small' + (active ? ' primary' : '') + '" data-act="library:reporttab" data-tab="' + s[0] + '" role="tab" aria-selected="' + active + '">' +
          esc(T(s[1])) + ' <span class="muted small">' + s[2].length + '</span></button>';
      }).join('') + '</div><label class="field lib-report-search">' + T('Search') + '<input id="lib-report-filter" type="search" value="' + esc(reportFilter) + '" autocomplete="off"></label>' +
      '<h3 id="lib-report-heading">' + esc(T(selected[1])) + '</h3><div id="lib-report-items" class="list">' + items + '</div><p class="muted small" id="lib-report-none"' + (items ? ' hidden' : '') + '>' + T('None') + '</p>' +
      '</div></div><div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Close') + '</button></div>', T('Reports'), true);
    applyReportSearch();
  }
  function readDates() { var f = val('lib-rfrom'), t = val('lib-rto'); if (f) repFrom = f; if (t) repTo = t; if (repFrom > repTo) { var x = repFrom; repFrom = repTo; repTo = x; } }
  function applyReportSearch() {
    var shown = 0, q = reportFilter.trim().toLowerCase();
    [].forEach.call(document.querySelectorAll('#lib-report-items .lib-report-row'), function (row) {
      row.hidden = !!q && row.dataset.search.indexOf(q) < 0; if (!row.hidden) shown++;
    });
    var none = document.getElementById('lib-report-none'); if (none) none.hidden = shown > 0;
  }
  function printReport() {
    var rows = [].slice.call(document.querySelectorAll('#lib-report-items .lib-report-row:not([hidden])'));
    var title = document.getElementById('lib-report-heading');
    var box = document.getElementById('print-only') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'print-only' }));
    box.className = 'app'; box.innerHTML = '<h1>' + esc(T('Reports')) + ' · ' + esc(title ? title.textContent : '') + '</h1><p>' + esc(H.fmt(repFrom, true) + ' – ' + H.fmt(repTo, true)) + '</p><section class="panel"><div class="list">' +
      rows.map(function (r) { return '<div class="item">' + r.innerHTML + '</div>'; }).join('') + '</div></section>';
    document.documentElement.classList.add('printing');
    var done = function () { document.documentElement.classList.remove('printing'); box.innerHTML = ''; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done, { once: true });
    try { S.audit('Prepared the library report for printing ' + repFrom + ' to ' + repTo, 'loans'); window.print(); }
    catch (e) { done(); console.error(e); H.toast(T('Printing works best from a computer.'), true); }
  }
  function policyReader() {
    if (!policy || !policy.text) return;
    H.modal(H.dialogHead(T('Library policy')) + '<div class="dlg-body"><article class="lib-doc" data-own-words>' + L.policyHtml(policy.text) + '</article></div>' +
      '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Close') + '</button></div>', T('Library policy'));
  }

  function needsLibrarianReview() {
    var st = S.settings() || {};
    return !!(st.librarianIds || []).length && L.librarianReviewDue(st.librarianReviewedAt);
  }
  function librarianReviewDialog() {
    if (!administrator()) return;
    var ids = ((S.settings() || {}).librarianIds || []).slice(), names = ids.map(function (id) {
      var p = S.get('people', id); return p ? H.name(p) : T('Someone');
    });
    H.modal(H.dialogHead(T('Review the librarians'), T('Please check that everyone listed is still serving as a librarian.')) +
      '<div class="dlg-body"><ul class="small">' + names.map(function (name) { return '<li>' + esc(name) + '</li>'; }).join('') + '</ul></div>' +
      '<div class="dlg-foot"><button class="btn" data-act="library:reviewedit">' + T('Edit / Remove Librarians') + '</button>' +
      '<button class="btn save" data-act="library:reviewconfirm">' + T('Confirm All Still Active') + '</button></div>', T('Review the librarians'));
  }
  function libsDialog() {
    var ids = ((S.settings() || {}).librarianIds || []).slice(), finder = window.CareUI && CareUI.finder;
    H.modal(H.dialogHead(T('Librarians'), T('Librarians can manage the library. Administrators always can.')) + '<div class="dlg-body">' +
      (ids.length ? '<div class="list">' + ids.map(function (id) {
        var p = S.get('people', id), name = p ? H.name(p) : T('Someone');
        return '<div class="item">' + (p ? H.avatar(p, 32) : '') + '<span class="grow"><b>' + esc(name) + '</b></span><button class="icon-btn ghost" data-act="library:libout" data-id="' + esc(id) + '" aria-label="' + esc(T('Take {name} out', { name: name })) + '" title="' + esc(T('Delete')) + '">' + H.icon(H.ICON.x, 16) + '</button></div>';
      }).join('') + '</div>' : '<p class="muted small">' + T('No one yet.') + '</p>') +
      (finder ? '<div style="margin-top:10px">' + finder('lib-libs', everyone().filter(function (p) { return ids.indexOf(p.id) < 0 && p.familyRole !== 'child'; }), 'library:libadd', {}, libNote, T('Add someone: type part of their name')) + '</div>' : '') + '</div>' +
      '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Close') + '</button></div>', T('Librarians'));
  }
  /** Librarians sign in to lend and return: someone who can't sign in yet is given Basic access when chosen (if the chooser may give access). */
  function signsIn(p) { return !!p && !!p.email && !!p.appRole && p.appRole !== 'none'; }
  function givesAccess() { return H.can('*') || H.can('access.manage'); }
  function libNote(p) {
    if (signsIn(p)) return '';
    return !p.email ? T('No email address yet – add one on their page first, so they can sign in') : givesAccess() ? T('Can’t sign in yet – choosing them gives Basic access') : T('Can’t sign in yet – ask an Administrator to give them Basic access');
  }
  function setLibs(ids, why) { S.setLibrarians(ids, why); librarianReviewShown = true; libsDialog(); }

  H.register({
    id: 'library', name: 'Library', desc: 'The church’s library – see what is in, and what you have borrowed', icon: BOOKS, tint: '#2F7A78', optIn: true,
    show: function () { return H.isOn('library') || H.isOn('archive'); },
    render: function (parts) { return page(parts); },
    after: function (parts) {
      if ((parts || [])[0] === 'archives' || !libraryOn()) { ArchiveUI.after(); return; }
      if (!librarian()) filters.borrower = '';
      applySearch(); updateCoverControls(); loadCovers(); loadPolicy();
      if (administrator() && needsLibrarianReview() && !librarianReviewShown) {
        librarianReviewShown = true; librarianReviewDialog();
      }
      if (!tidied && librarian() && !S.preview() && !S.offline()) { tidied = true; L.stale(loans(), H.today()).forEach(function (l) { S.remove('loans', l.id); }); }   // returned more than a year ago
    },
    badge: function () { return librarian() ? loans().filter(L.isPending).length : 0; },
    stat: function () { var u = me(); return librarian() ? TN('{n} on loan', '{n} on loan', L.onLoan(loans()).length) : u && L.mine(loans(), u.id).length ? TN('{n} item', '{n} items', L.mine(loans(), u.id).length) : ''; },
    todos: function (u) {
      var activeLoans = L.onLoan(loans()).filter(function (l) { return !L.isPending(l); });
      var late = librarian() ? activeLoans.filter(function (l) { return L.overdue(l, H.today()); }).length : 0, mine = u ? L.mine(loans(), u.id).filter(function (l) { return !L.isPending(l) && L.overdue(l, H.today()); }) : [];
      var out = [], pending = librarian() ? loans().filter(L.isPending).length : 0, dueNow = librarian() ? activeLoans.filter(function (l) { return L.remindDue(l, H.today()); }).length : 0;
      var long = u ? L.mine(loans(), u.id).filter(function (l) { return !L.isPending(l) && L.daysOut(l, H.today()) >= L.REMIND_DAYS && !L.overdue(l, H.today()); }) : [];
      if (administrator() && needsLibrarianReview()) out.push({ text: T('Please review who is still a librarian'), href: '#/library', tag: T('Librarians'), priority: true });
      if (pending) out.push({ text: TN('{n} checkout request needs verification', '{n} checkout requests need verification', pending), href: '#/library', tag: T('Pending Verifications'), priority: true });
      if (late) out.push({ text: TN('{n} library item is overdue', '{n} library items are overdue', late), href: '#/library', tag: T('Library') });
      else if (mine.length) out.push({ text: T('Please return “{title}” to the church library', { title: mine[0].title }), href: '#/library', tag: T('Library') });
      if (dueNow) out.push({ text: TN('{n} borrower is due a friendly reminder', '{n} borrowers are due a friendly reminder', dueNow), href: '#/library', tag: T('Library') });
      long.slice(0, 2).forEach(function (l) { out.push({ text: T('Friendly reminder: you have had “{title}” from the church library for {n} days', { title: l.title, n: L.daysOut(l, H.today()) }), href: '#/library', tag: T('Library') }); });
      return out;
    },
    actions: {
      section: function (el) {
        var section = el.dataset.section;
        if (section === 'archives' && H.isOn('archive')) H.go('library/archives');
        else if (section === 'library' && libraryOn()) H.go('library');
      },
      add: function () { if (librarian()) form({}); },
      edit: function (el) { var b = S.get('books', el.dataset.id); if (b && librarian()) form(b); },
      coverrm: function () { newCover = ''; var el = document.getElementById('lib-cover-now'); if (el) el.innerHTML = '<span class="muted small">' + T('No picture yet.') + '</span>'; var rm = document.getElementById('lib-cover-rm'); if (rm) rm.hidden = true; },
      save: function (el) {
        if (!librarian()) return;
        var old = el.dataset.id ? S.get('books', el.dataset.id) : null;
        if (!val('lib-title')) { H.toast(T('Give it a title'), true); return; }
        var b = L.book({ id: old && old.id, createdAt: old && old.createdAt, cover: old && old.cover, repairing: old && old.repairing, kind: val('lib-kind'), title: val('lib-title'), author: val('lib-author'), cat: val('lib-cat'), copies: val('lib-copies'), how: val('lib-how'), acquired: val('lib-acq'), from: val('lib-from'), shelf: val('lib-shelf'), isbn: val('lib-isbn'), note: val('lib-note') });
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
        purgeDialog('book', b);
      },
      purge: function (el) {
        if (!librarian()) return;
        var type = el.dataset.kind, record = type === 'book' ? S.get('books', el.dataset.id) : type === 'loan' ? S.get('loans', el.dataset.id) : null;
        if (record) purgeDialog(type, record);
      },
      purgeconfirm: function (el) {
        if (!librarian()) return;
        var type = el.dataset.kind, id = el.dataset.id;
        if (type === 'loan') {
          var l = S.get('loans', id); if (!l) return;
          var b = S.get('books', l.bookId);
          if (L.isOut(l) && b) {
            var remaining = loans().filter(function (x) { return x.id !== l.id; }), updated = JSON.parse(JSON.stringify(b));
            updated.out = L.outCount(b, remaining);
            S.put('books', updated);
          }
          S.remove('loans', l.id, 'Purged library loan record for “' + l.title + '”');
        } else if (type === 'book') {
          var item = S.get('books', id); if (!item) return;
          if (loans().some(function (x) { return x.bookId === item.id && L.isOut(x); })) {
            H.toast(T('This is on loan. Mark it as returned or lost first.'), true); return;
          }
          S.find('loans', function (x) { return x.bookId === item.id; }).forEach(function (x) { S.remove('loans', x.id); });
          S.remove('books', item.id, 'Purged “' + item.title + '” and its library history');
        } else return;
        H.closeModal(); H.render(); H.toast(T('Deleted'));
      },
      remove: function (el) {
        var b = S.get('books', el.dataset.id); if (!b || !librarian()) return;
        if (L.outCount(b, loans())) { H.toast(T('This is on loan. Mark it as returned or lost first.'), true); return; }
        removeDialog(b);
      },
      removesave: function (el) {
        var b = S.get('books', el.dataset.id); if (!b || !librarian()) return;
        var x = L.removeItem(b, val('lib-why'), val('lib-whynote'), H.today());
        S.put('books', x, 'Took “' + b.title + '” out of the library (' + x.why + ')'); H.closeModal(); H.render(); H.toast(T('Removed from Library by Librarian'));
      },
      putback: function (el) {
        var b = S.get('books', el.dataset.id); if (!b || !librarian()) return;
        S.put('books', L.restore(b), 'Put “' + b.title + '” back in the library'); H.render(); H.toast(T('Back in the library'));
      },
      repair: function (el) {
        var b = S.get('books', el.dataset.id); if (!b || !librarian()) return;
        if (!b.repairing && L.outCount(b, loans())) { H.toast(T('Return every copy before marking this item for repair.'), true); return; }
        var repairing = !b.repairing;
        S.put('books', L.repair(b, repairing), (repairing ? 'Marked “' + b.title + '” as being repaired' : 'Returned “' + b.title + '” from repair'));
        H.render(); H.toast(T(repairing ? 'Marked as being repaired' : 'Back from repair'));
      },
      tab: function (el) {
        if (['all', 'onLoan', 'available', 'lost', 'repairing', 'removed'].indexOf(el.dataset.tab) < 0) return;
        if (!librarian() && (el.dataset.tab === 'lost' || el.dataset.tab === 'removed')) return;
        catalogueTab = el.dataset.tab; H.render(); applySearch();
      },
      borrowerclear: function () {
        if (!librarian()) return;
        filters.borrower = '';
        var input = document.getElementById('lib-filter-borrower');
        if (input) input.value = T('All Borrowers');
        applySearch();
      },
      lost: function (el) {
        var l = S.get('loans', el.dataset.id); if (!l || !librarian()) return;
        if (!H.confirmBtn(el, T('Lost?'))) return;
        var r = L.lose(l, S.get('books', l.bookId), H.today(), loans());
        S.put('loans', r.loan); if (r.book) S.put('books', r.book, 'Marked “' + l.title + '” as lost (lent to ' + l.name + ')');
        H.render(); H.toast(T('Marked as lost'));
      },
      import: function () { if (librarian()) importDialog(); },
      importgo: function () {
        if (!librarian() || !importDraft || !importDraft.add.length) return;
        var n = importDraft.add.length;
        importDraft.add.forEach(function (b) { S.put('books', b); });
        S.audit('Imported ' + n + ' items into the library from a spreadsheet', 'books');
        importDraft = null; H.closeModal(); H.render(); H.toast(TN('{n} item added', '{n} items added', n));
      },
      coversselected: function () { runCoverBatch('selected'); },
      coversall: function () { runCoverBatch('all'); },
      coversmissing: function () { runCoverBatch('missing'); },
      coversselectmissing: function () {
        if (!librarian()) return;
        selectedBooks = {};
        S.list('books').forEach(function (b) { if (L.inLibrary(b) && (b.kind || 'Book') === 'Book' && !b.cover) selectedBooks[b.id] = true; });
        document.querySelectorAll('[data-lib-select]').forEach(function (input) { input.checked = !!selectedBooks[input.dataset.libSelect]; });
        updateCoverControls();
      },
      coversclose: function () { coverBatchRunning = false; coverBatch = null; H.closeModal(); },
      coversave: function (el) { saveBatchCover(el.dataset.id); },
      coverssaveall: function () {
        if (!librarian() || !coverBatch) return;
        var found = coverBatch.filter(function (x) { return x.data && !x.saved; }), index = 0;
        function next() {
          if (index >= found.length) return;
          var entry = found[index++];
          return Promise.resolve(saveBatchCover(entry.book.id)).then(next);
        }
        next();
      },
      report: function () { if (librarian()) reportDialog(); },
      reportgo: function () { if (!librarian()) return; readDates(); reportDialog(); },
      reporttab: function (el) {
        if (!librarian() || ['onLoan', 'returned', 'lost', 'acquired', 'removed'].indexOf(el.dataset.tab) < 0) return;
        reportTab = el.dataset.tab; reportDialog();
      },
      reportprint: function () { if (librarian()) printReport(); },
      reportcsv: function () {
        if (!librarian()) return; readDates();
        var names = {}; ['Lent', 'Returned', 'Lost', 'Acquired', 'Removed', 'On Loan', 'Visitor', 'Due', 'Book', 'Other', 'Note'].concat(L.KINDS, L.HOW, L.REASONS).forEach(function (k) { names[k] = T(k); });
        var rep = L.report(S.list('books'), loans(), repFrom, repTo), rows = L.reportRows(rep, names);
        var section = { onLoan: 'On Loan', returned: 'Returned', lost: 'Lost', acquired: 'Acquired', removed: 'Removed' }[reportTab], q = reportFilter.trim().toLowerCase();
        rows = [rows[0]].concat(rows.slice(1).filter(function (row) { return row[0] === T(section) && (!q || row.join(' ').toLowerCase().indexOf(q) >= 0); }));
        rows[0] = [T('What'), T('Date'), T('Title'), T('What it is'), T('Who'), T('Detail')];
        H.download('library-' + reportTab + '-' + repFrom + '-to-' + repTo + '.csv', '\uFEFF' + L.csv(rows), 'text/csv');
        S.audit('Downloaded the library ' + reportTab + ' report ' + repFrom + ' to ' + repTo, 'loans');
      },
      policyread: function () { policyReader(); },
      policyopen: function () {
        if (!policy || !policy.data) return;
        if (window.ChurchHubApp) { saveAs(policy.name, policy.type, policy.data); return; }
        var w = window.open(blobUrl(policy.type, policy.data), '_blank', 'noopener'); if (!w) saveAs(policy.name, policy.type, policy.data);
      },
      lend: function (el) { var b = S.get('books', el.dataset.id); if (b && librarian()) lendDialog(b); },
      sort: function (el) {
        if (!sortFieldsValid(el.dataset.k)) return;
        if (sortKey === el.dataset.k) sortDir *= -1; else { sortKey = el.dataset.k; sortDir = 1; }
        H.render();
      },
      remind: function (el) {
        var l = S.get('loans', el.dataset.id); if (!l || !librarian()) return;
        var app = !!l.personId, num = l.mobile ? L.intl(l.mobile, (Countries.church(S.settings()) || {}).dial) : '';
        H.modal(H.dialogHead(T('Send a reminder'), l.title + ' · ' + l.name) + '<div class="dlg-body">' +
          '<p class="muted small" style="margin-top:0">' + esc(held(l)) + (l.reminded ? ' · ' + esc(T('Reminded {date}', { date: H.fmt(l.reminded, true) })) : '') + '</p>' +
          '<label class="field">' + T('Message') + '<textarea id="lib-rem" rows="5" maxlength="600">' + esc(reminderText(l)) + '</textarea></label>' +
          (app ? '<p class="hint">' + T('They also see it in Church Hub, on their To do list and the Library page.') + '</p>' : '') + '</div>' +
          '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button>' +
          (num ? '<button class="btn" data-act="library:remindsend" data-how="sms" data-id="' + esc(l.id) + '">' + T('By SMS') + '</button><button class="btn save" data-act="library:remindsend" data-how="wa" data-id="' + esc(l.id) + '">' + T('By WhatsApp') + '</button>' : '') +
          (app ? '<button class="btn' + (num ? '' : ' save') + '" data-act="library:remindsend" data-how="app" data-id="' + esc(l.id) + '">' + T('In Church Hub only') + '</button>' : '') + '</div>', T('Send a reminder'));
      },
      remindsend: function (el) {
        var l = S.get('loans', el.dataset.id); if (!l || !librarian()) return;
        var text = val('lib-rem') || reminderText(l), num = L.intl(l.mobile, (Countries.church(S.settings()) || {}).dial), how = el.dataset.how;
        var x = JSON.parse(JSON.stringify(l)); x.reminded = H.today();
        S.put('loans', x, 'Sent a library reminder (' + (how === 'wa' ? 'WhatsApp' : how === 'sms' ? 'SMS' : 'in the app') + ') about “' + l.title + '”');
        if (how === 'wa') window.open('https://wa.me/' + num + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
        else if (how === 'sms') location.href = 'sms:' + (l.mobile || '').replace(/[^\d+]/g, '') + '?body=' + encodeURIComponent(text);
        H.closeModal(); H.render(); H.toast(T('Reminder sent'));
      },
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
        returnDialog(l);
      },
      backsave: function (el) {
        var l = S.get('loans', el.dataset.id); if (!l || !librarian()) return;
        var r = L.giveBack(l, S.get('books', l.bookId), H.today(), loans(), val('lib-backnote'));
        S.put('loans', r.loan); if (r.book) S.put('books', r.book);
        H.closeModal(); H.render(); H.toast(T('Marked as returned'));
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
      duplicates: function () { if (librarian()) duplicateDialog(); },
      duplicateedit: function (el) { if (librarian()) duplicateEditDialog(el.dataset.key); },
      duplicateignore: function (el) {
        if (!librarian()) return;
        S.put('libraryDuplicateIgnores', { id: el.dataset.key, pair: el.dataset.key }, 'Dismissed a suggested library duplicate');
        duplicateDialog();
      },
      duplicatesave: function (el) {
        if (!librarian()) return;
        var pair = L.duplicatePairs(S.list('books')).filter(function (x) { return x.key === el.dataset.key; })[0];
        if (!pair) return;
        var title = val('lib-dup-title');
        if (!title) { H.toast(T('Give it a title'), true); return; }
        [pair.first, pair.second].forEach(function (old) {
          var updated = L.book(Object.assign({}, old, { title: title, author: val('lib-dup-author'), kind: val('lib-dup-kind'), cat: val('lib-dup-cat'), isbn: val('lib-dup-isbn') }));
          S.put('books', updated);
        });
        S.put('libraryDuplicateIgnores', { id: pair.key, pair: pair.key }, 'Standardized a suggested library duplicate');
        H.closeModal(); H.render(); H.toast(T('Catalogue details standardized'));
      },
      bookinfo: function (el) { var b = S.get('books', el.dataset.id); if (b) bookInfoDialog(b); },
      request: function (el) { var b = S.get('books', el.dataset.id); if (b && !librarian()) requestDialog(b); },
      requestsubmit: function (el) {
        var b = S.get('books', el.dataset.id), u = me(), p = u && (S.get('people', u.id) || u);
        if (!b || !p || librarian()) return;
        var who = L.borrower(p, { mobile: val('lib-request-mobile') });
        var err = document.getElementById('lib-request-error');
        if (who.error) {
          if (err) { err.textContent = T('Type a mobile number (7 to 15 digits)'); err.hidden = false; }
          return;
        }
        var available = L.free(b);
        if (!available && !Store.isLive()) { H.toast(T('Every copy is on loan.'), true); return; }
        var item = { bookId: b.id, title: b.title, personId: who.personId, name: who.name, mobile: who.mobile, visitor: false,
          out: H.today(), due: L.addDays(H.today(), L.LOAN_DAYS), back: '', note: '' };
        Store.requestLibraryLoan(b.id, item).then(function () {
          H.closeModal(); H.render(); H.toast(T('Checkout request sent. A librarian will verify it.'));
        }, function (error) {
          console.error(error);
          H.toast(T('Couldn’t send the checkout request. The item may no longer be available; please try again.'), true);
        });
      },
      verify: function (el) {
        if (!librarian()) return;
        Store.verifyLibraryLoan(el.dataset.id, true, H.today(), me() && me().id).then(function () {
          H.render(); H.toast(T('Checkout approved'));
        }, function (error) { console.error(error); H.toast(T('Couldn’t verify this checkout. Please try again.'), true); });
      },
      reject: function (el) {
        if (!librarian() || !H.confirmBtn(el, T('Reject this checkout?'))) return;
        Store.verifyLibraryLoan(el.dataset.id, false, H.today(), me() && me().id).then(function () {
          H.render(); H.toast(T('Checkout rejected. The copy is available again.'));
        }, function (error) { console.error(error); H.toast(T('Couldn’t verify this checkout. Please try again.'), true); });
      },
      reviewconfirm: function () {
        if (!administrator()) return;
        S.setLibrarians(((S.settings() || {}).librarianIds || []).slice(), 'Confirmed the current librarians are still active');
        librarianReviewShown = true; H.closeModal(); H.render(); H.toast(T('Librarians confirmed'));
      },
      reviewedit: function () {
        if (!administrator()) return;
        librarianReviewShown = true; H.closeModal(); libsDialog();
      },
      libs: function () { if (chooses()) libsDialog(); },
      libadd: function (el) {
        var p = S.get('people', el.dataset.id), ids = ((S.settings() || {}).librarianIds || []).slice(); if (!p || !chooses()) return;
        if (!signsIn(p)) {
          if (!p.email || !givesAccess()) { H.toast(libNote(p), true); return; }
          var q = JSON.parse(JSON.stringify(p)); q.appRole = 'member';
          S.put('people', q, 'Gave ' + H.name(p) + ' Basic access, to be a librarian');
        }
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
  /** On the Me page: how many library items they have out now, opening the Library. */
  window.LibraryUI = {
    chip: function () {
      var u = me(); if (!u || !H.isOn('library')) return '';
      var n = L.mine(loans(), u.id).filter(function (l) { return !L.isPending(l); }).length; if (!n) return '';
      return ' <a class="tag tag-link" style="--c:#2F7A78" href="#/library">' + esc(TN('{n} library item borrowed', '{n} library items borrowed', n)) + '</a>';
    },
    roleChip: function () {
      var u = me();
      return u && !S.preview() && L.isLibrarian(S.settings(), u.id, H.can('*')) ?
        ' <span class="tag" style="--c:#2F7A78">' + T('Librarian') + '</span>' : '';
    }
  };
})();
