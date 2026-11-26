/* Church & Trellis – Undo and Version history: the screens (rules: js/history.js, tested in tests/history.test.js).
 *   - The Undo bar: after a change is saved, a small bar at the bottom offers "Undo" for a few seconds; Undo takes back the latest changes
 *     made on this device (up to 20, within 30 minutes), one at a time.
 *   - Version history: HistoryUI.open('people', id) opens a window listing every earlier version of that record (90 days), who changed
 *     it, what changed, and a button to put it back – the whole record, or just one field.
 * The data layer (js/store.js) passes each saved change to Store.onVersion and keeps the versions (history/{id}, firestore.rules okHist);
 * Store.versions reads them (Administrators and Pastors), Store.asRestore marks a put-back as "Put back". */
(function () {
  'use strict';
  var H = Hub, S = Store, esc = H.esc, T = I18n.t, D = History;
  var bar = null, timer = null, undoing = false, warned = false, pending = null;

  function ready() { return typeof S.onVersion === 'function' && typeof S.versions === 'function'; }
  function what(c) { return T(D.COVER[c] || 'record'); }

  /* ---------- the Undo bar ---------- */
  function barEl() {
    if (bar) return bar;
    bar = document.createElement('div'); bar.id = 'undo-bar'; bar.className = 'undo-bar'; bar.setAttribute('role', 'status'); bar.hidden = true;
    document.body.appendChild(bar); return bar;
  }
  function hideBar() { clearTimeout(timer); if (bar) bar.hidden = true; warned = false; }
  function say(text, ms, withUndo) {
    var b = barEl(); clearTimeout(timer);
    b.innerHTML = '<span>' + esc(text) + '</span>' + (withUndo ? '<button type="button" class="btn small" data-undo="1">' + T('Undo') + '</button>' : '') + '<button type="button" class="icon-btn ghost" data-undo-x="1" aria-label="' + T('Close') + '">×</button>';
    b.hidden = false; timer = setTimeout(hideBar, ms || 8000);
  }
  function line(e) {
    var w = what(e.c);
    return e.kind === 'remove' ? T('Deleted: {what}.', { what: w }) : e.kind === 'add' ? T('Added: {what}.', { what: w }) : T('Changes saved.');
  }
  /** Each saved change arrives here from the data layer. Edits wait a moment (people may still be typing), additions and deletions show at once. */
  function seen(e) {
    if (!e || undoing || !D.covered(e.c)) return;
    D.undoPush(e);
    if (e.kind === 'edit') { clearTimeout(pending); pending = setTimeout(function () { say(line(e), 8000, true); }, 2500); }
    else say(line(e), 10000, true);
  }
  function undo() {
    var e = D.undoPeek(); if (!e) { hideBar(); return; }
    var cur = S.get(e.c, e.rid), r = D.restore(cur, e);
    if (r.newer && !warned) { warned = true; say(T('Someone has changed this since. Undo anyway?'), 10000, true); return; }
    undoing = true;
    try {
      S.asRestore(function () {
        if (r.action === 'put') S.put(e.c, r.record, 'Undid a change (' + e.c + '/' + e.rid + ')');
        else if (r.action === 'remove') S.remove(e.c, e.rid, 'Undid an addition (' + e.c + '/' + e.rid + ')');
      });
      D.undoPop();
    } finally { undoing = false; }
    warned = false; clearTimeout(pending);
    var more = D.undoPeek();
    say(T('Undone.'), 8000, !!more);
    H.render();
  }

  /* ---------- Version history ---------- */
  /** Versions are written in UTC ('YYYY-MM-DD HH:MM'); shown in this phone's own time. */
  function when(at) {
    var d = new Date(String(at).replace(' ', 'T') + ':00Z'); if (isNaN(d)) return String(at);
    var p = function (n) { return (n < 10 ? '0' : '') + n; }, day = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    return H.fmt(day, true) + ' · ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function show(v) {
    if (v === undefined || v === null || v === '') return '—';
    var s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return s.length > 80 ? s.slice(0, 80) + '…' : s;
  }
  function get(o, f) { var p = f.split('.'); var x = o; for (var i = 0; i < p.length && x; i++) x = x[p[i]]; return x; }
  function summary(e) {
    if (e.kind === 'add') return T('Added');
    if (e.kind === 'remove') return T('Deleted');
    if (e.kind === 'restore') return T('Put back');
    var names = (e.fields || []).map(function (f) { return T(D.fieldLabel(f)); }).filter(function (x, i, a) { return a.indexOf(x) === i; });
    return T('Changed {what}', { what: names.slice(0, 3).join(', ') + (names.length > 3 ? ' ' + T('and {n} more', { n: names.length - 3 }) : '') });
  }
  var shown = { c: '', id: '', list: [] };
  function row(e, i) {
    var fields = e.kind === 'edit' ? (e.fields || []).map(function (f) {
      return '<li><span class="hist-f">' + esc(T(D.fieldLabel(f))) + '</span> <span class="hist-from">' + esc(show(get(e.before, f))) + '</span> → <b>' + esc(show(get(e.after, f))) + '</b>' +
        (shown.canEdit ? ' <button type="button" class="linkish" data-hist-field="' + i + '" data-f="' + esc(f) + '">' + T('Put this back') + '</button>' : '') + '</li>';
    }).join('') : '';
    return '<li class="hist-row"><div class="hist-top"><div><b>' + esc(summary(e)) + '</b><div class="muted">' + esc(when(e.at)) + (e.byName ? ' · ' + esc(e.byName) : '') + '</div></div>' +
      (shown.canEdit && e.kind !== 'add' ? '<button type="button" class="btn small" data-hist-restore="' + i + '">' + T('Go back to before this') + '</button>' : '') + '</div>' +
      (fields ? '<details><summary>' + T('What changed') + '</summary><ul class="hist-fields">' + fields + '</ul></details>' : '') + '</li>';
  }
  /** Opens the window of earlier versions of one record. `canEdit` (default: the person may change the record) lets them put a version back. */
  function open(c, rid, title) {
    if (!ready() || !D.covered(c)) return;
    var canEdit = !(S.preview && S.preview());
    H.modal(H.dialogHead(T('Version history'), title || '') + '<div class="dlg-body"><p class="muted">' + T('Loading…') + '</p></div><div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Close') + '</button></div>', T('Version history'), true);
    S.versions(c, rid).then(function (list) {
      list = D.forRecord(list || [], c, rid); shown = { c: c, id: rid, list: list, canEdit: canEdit };
      var body = document.querySelector('#modal .dlg-body'); if (!body) return;
      body.innerHTML = list.length
        ? '<p class="hint">' + T('Church & Trellis keeps each earlier version for 90 days.') + '</p><ul class="hist-list">' + list.map(row).join('') + '</ul>'
        : '<p class="muted">' + T('No earlier versions yet. They appear here after the next change.') + '</p>';
    }, function () {
      var body = document.querySelector('#modal .dlg-body'); if (body) body.innerHTML = '<p class="muted">' + T('The history can’t be shown right now.') + '</p>';
    });
  }
  function putBack(i, fields) {
    var e = shown.list[i]; if (!e) return;
    var cur = S.get(e.c, e.rid), r = D.restore(cur, e, fields);
    if (r.action === 'none') { H.toast(T('Nothing to put back.')); return; }
    undoing = true;
    try {
      S.asRestore(function () {
        if (r.action === 'put') S.put(e.c, r.record, 'Put ' + e.c + '/' + e.rid + ' back to an earlier version' + (fields ? ' (' + fields.join(', ') + ')' : ''));
        else S.remove(e.c, e.rid, 'Took out ' + e.c + '/' + e.rid + ' (put back to before it was added)');
      });
    } finally { undoing = false; }
    H.closeModal(); H.toast(T('Put back.')); H.render();
  }

  document.addEventListener('click', function (ev) {
    var t = ev.target.closest && ev.target.closest('[data-undo],[data-undo-x],[data-hist-restore],[data-hist-field],[data-history]');
    if (!t) return;
    if (t.hasAttribute('data-undo')) { ev.preventDefault(); undo(); }
    else if (t.hasAttribute('data-undo-x')) { hideBar(); }
    else if (t.hasAttribute('data-hist-restore')) { ev.preventDefault(); putBack(+t.getAttribute('data-hist-restore')); }
    else if (t.hasAttribute('data-hist-field')) { ev.preventDefault(); putBack(+t.getAttribute('data-hist-field'), [t.getAttribute('data-f')]); }
    else if (t.hasAttribute('data-history')) { ev.preventDefault(); open(t.getAttribute('data-history'), t.getAttribute('data-id'), t.getAttribute('data-title') || ''); }
  });
  if (ready()) {
    S.onVersion(seen);
    // Versions older than 90 days are cleared out once a day by an Administrator's app (Store.historyTidy decides; quiet)
    setInterval(function () { S.historyTidy(); }, 3600000); setTimeout(function () { S.historyTidy(); }, 60000);
  }

  /** A button for a record's page: HistoryUI.button('people', id, name) – '' when history isn't available. */
  function button(c, rid, title) {
    return ready() && D.covered(c) && S.historyCan() ? '<button class="btn" data-history="' + esc(c) + '" data-id="' + esc(rid) + '" data-title="' + esc(title || '') + '">' + H.icon('M12 8v5l3 2M3 12a9 9 0 1 0 3-6.7M3 4v5h5', 18) + T('Version history') + '</button>' : '';
  }
  window.HistoryUI = { ready: ready, open: open, button: button, seen: seen, undo: undo };
})();
