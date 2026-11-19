/* Church & Trellis – Community board: a corkboard of sticky notes ("I need a plumber", "Free to a good home: kittens", a
 * thank-you), each checked by a keeper first. Church Partners and staff only (js/access.js PARTS 'board').
 * The rules: js/community.js (shared with the Marketplace); the keepers' screens: js/community-ui.js; the look: css/community.css.
 * Routes: #/board (the board), #/board/mine, #/board/waiting (keepers), #/board/n/<id> (opens one notice).
 * The latest 3 notices show on Home and on Me (BoardUI.card). Prayer requests and pastoral needs don't belong here: the
 * board says so gently and points to the Office. POPIA: docs/POPIA.md "Community board and Marketplace". */
(function () {
  'use strict';
  var H = Hub, S = Store, C = Community, U = CommunityUI, T = I18n.t, TN = I18n.tn, esc = H.esc;
  var TX = function (s) { return s; };
  var PART = 'board', state = { kind: '', fly: '', tidied: false };
  var DEFAULT_NOTE = TX('The church doesn’t vouch for the people or offers on this board – please arrange things between yourselves, wisely and kindly.');
  var PIN = 'M3 4h18v14H3zM7 8h4v4H7zM13 8h4v3h-4zM9 18v3M15 18v3';

  function items() { return S.list(PART); }
  function now() { return Date.now(); }
  function myId() { var u = H.user(); return u ? u.id : ''; }
  function kindName(id) { return C.kind(PART, id)[1]; }
  function colour(id) { return C.kind(PART, id)[3]; }

  /* ---------- one sticky note ---------- */
  function note(x, opts) {
    opts = opts || {};
    var tilt = C.tilt(x.id), tape = Math.abs(tilt * 2) % 3 === 1, done = x.status === 'done', pinC = ['#D9480F', '#2F6FB0', '#2E7D4F', '#8E3FB5'][Math.abs(Math.round(tilt * 2)) % 4];
    var cls = 'note k-' + x.kind + (x.status !== 'live' && !done ? ' pending' : '') + (done ? ' done' : '') + (state.fly === x.id ? ' fly' : '') + (opts.mini ? ' mini' : '');
    var inner = (tape ? '<span class="tape" aria-hidden="true"></span>' : '<span class="pin" style="--pin:' + pinC + '" aria-hidden="true"></span>') +
      '<span class="note-k">' + esc(T(kindName(x.kind))) + '</span><b class="note-t">' + esc(x.title) + '</b>' +
      (!opts.mini && x.body ? '<span class="note-b">' + esc(x.body) + '</span>' : '') +
      (!opts.mini ? '<span class="note-f">' + esc(x.name || '') + ' · ' + esc(U.when(x)) + '</span>' : '') +
      (!opts.mini && x.personId === myId() ? U.ribbon(PART, x) : '') +
      (done ? '<span class="stamp" aria-hidden="true">' + esc(T(U.stampLabel(PART, x))) + ' ✓</span>' : '');
    var attrs = ' style="--tilt:' + tilt + 'deg;--c:' + colour(x.kind) + '"';
    return '<li class="' + cls + '"' + attrs + '>' + (opts.href ? '<a class="note-in" href="' + opts.href + '">' + inner + '</a>' :
      '<button type="button" class="note-in" data-act="board:open" data-id="' + esc(x.id) + '" aria-label="' + esc(T(kindName(x.kind)) + ': ' + x.title) + '">' + inner + '</button>') + '</li>';
  }
  function cork(list, empty) {
    if (!list.length) return empty;
    return '<ul class="cork" aria-label="' + esc(T('Community board')) + '">' + list.map(function (x) { return note(x); }).join('') + '</ul>';
  }
  function emptyBoard() {
    return '<div class="cork cork-empty"><div class="note k-notice lonely" style="--tilt:-2deg;--c:' + colour('notice') + '"><span class="pin" style="--pin:#D9480F" aria-hidden="true"></span>' +
      '<b class="note-t">' + T('The board is empty.') + '</b><span class="note-b">' + T('Be the first to pin a notice!') + '</span>' +
      '<button class="btn primary small" data-act="board:pin">' + T('Pin a notice') + '</button></div></div>';
  }

  /* ---------- the page ---------- */
  function render(parts) {
    var tab = (parts && parts[0]) || '', keeper = U.keeper(PART), t = now(), me = U.who();
    if (!state.tidied) { state.tidied = true; setTimeout(function () { U.tidy(PART); }, 800); }
    if (tab === 'n' && parts[1]) { var nid = parts[1]; try { history.replaceState(null, '', '#/board'); } catch (e) {} tab = ''; setTimeout(function () { openNote(nid); }, 30); }
    var mine = items().filter(function (x) { return C.mine(x, me); }), waitingN = keeper ? C.waiting(items()).length + C.reported(items(), t).length : 0;
    if (tab === 'waiting' && !keeper) tab = '';
    if (tab === 'mine' && !mine.length) tab = '';
    var more = U.manager() ? H.menu(T('More'), ['<button class="btn ghost" data-act="board:keepers">' + T('Keepers…') + '</button>', '<button class="btn ghost" data-act="board:notetext">' + T('The note on the board…') + '</button>']) : '';
    var html = '<div class="page-head"><div><h1>' + T('Community board') + '</h1><p class="lead">' + T('Ask for help, offer it, or say thank you. A keeper checks each notice first.') + '</p></div>' +
      '<div class="btns">' + more + '<button class="btn primary" data-act="board:pin">' + H.icon('M12 5v14M5 12h14', 16) + ' ' + T('Pin a notice') + '</button></div></div>';
    if (mine.length || keeper) html += '<nav class="seg cm-seg"><a href="#/board"' + (tab === '' ? ' class="on"' : '') + '>' + T('Board') + '</a>' +
      (mine.length ? '<a href="#/board/mine"' + (tab === 'mine' ? ' class="on"' : '') + '>' + T('My notices') + '</a>' : '') +
      (keeper ? '<a href="#/board/waiting"' + (tab === 'waiting' ? ' class="on"' : '') + '>' + T('Waiting for approval') + (waitingN ? ' <span class="badge">' + waitingN + '</span>' : '') + '</a>' : '') + '</nav>';
    if (tab === 'waiting') return html + U.queue(PART, function (x) { return '<ul class="cm-mini">' + note(x, { mini: true }) + '</ul>'; });
    if (tab === 'mine') return html + cork(mine.sort(function (a, b) { return (b.createdAt || '') < (a.createdAt || '') ? -1 : 1; }), '') + boardNote();
    var shown = C.shown(items(), me, t), filtered = state.kind ? shown.filter(function (x) { return x.kind === state.kind; }) : shown;
    if (shown.length > 3) html += '<details class="cm-filter"' + (state.kind ? ' open' : '') + '><summary>' + T('Show only…') + '</summary><div class="cm-chips">' +
      [['', TX('Everything')]].concat(C.BOARD_KINDS).map(function (k) {
        return '<button class="cm-chip' + (state.kind === k[0] ? ' on' : '') + '" data-act="board:kind" data-k="' + k[0] + '" aria-pressed="' + (state.kind === k[0]) + '"' + (k[3] ? ' style="--c:' + k[3] + '"' : '') + '>' + esc(T(k[1])) + '</button>';
      }).join('') + '</div></details>';
    html += cork(filtered, state.kind ? '<p class="empty">' + T('Nothing like that on the board right now.') + '</p>' : emptyBoard());
    return html + boardNote();
  }
  function boardNote() {
    var st = S.settings() || {};
    return '<p class="cm-foot">' + H.icon('M12 8v5M12 16h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 16) + '<span>' + esc(st.boardNote || T(DEFAULT_NOTE)) + ' ' +
      T('Prayer requests and pastoral needs belong with the ministers –') + ' <a href="#/messages">' + T('write to the Office') + '</a>.</span></p>';
  }

  /* ---------- one notice, lifted off the board ---------- */
  function openNote(id) {
    var x = S.get(PART, id); if (!x) return;
    var mine = x.personId === myId(), phone = x.phone ? '<a class="note-phone" href="tel:' + esc(x.phone.replace(/[^0-9+]/g, '')) + '">' + H.icon('M5 4h4l2 5-3 2a11 11 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2', 16) + ' ' + esc(x.phone) + '</a>' : '';
    var keeperNote = mine && x.note && (x.status === 'change' || x.status === 'declined') ? '<p class="cm-keeper-note"><b>' + esc(x.by || T('Keeper')) + ':</b> ' + esc(x.note) + '</p>' : '';
    H.modal('<div class="note-lift">' + H.dialogHead(T(kindName(x.kind)), '') +
      '<div class="dlg-body"><div class="note big k-' + x.kind + (x.status === 'done' ? ' done' : '') + '" style="--c:' + colour(x.kind) + '"><span class="pin" style="--pin:#D9480F" aria-hidden="true"></span>' +
      '<b class="note-t">' + esc(x.title) + '</b>' + (x.body ? '<span class="note-b">' + esc(x.body) + '</span>' : '') + phone +
      '<span class="note-f">' + esc(T('Pinned by {name}', { name: x.name || T('Someone') })) + ' · ' + esc(U.when(x)) + '</span>' + (mine ? U.ribbon(PART, x) : '') +
      (x.status === 'done' ? '<span class="stamp" aria-hidden="true">' + esc(T(U.stampLabel(PART, x))) + ' ✓</span>' : '') + '</div>' + keeperNote + '</div>' +
      '<div class="dlg-foot">' + (mine ? U.ownButtons(PART, x) : U.otherButtons(PART, x)) + '</div></div>', x.title);
  }

  /* ---------- pinning a notice (or changing one) ---------- */
  function pinDialog(id) {
    var x = id ? S.get(PART, id) : null, k = x ? x.kind : 'need';
    H.modal(H.dialogHead(x ? T('Change your notice') : T('Pin a notice'), T('A keeper checks it before it goes up.')) + '<div class="dlg-body bd-pin">' +
      '<p class="bd-q">' + T('What kind of notice?') + '</p><div class="bd-kinds" role="radiogroup" aria-label="' + esc(T('What kind of notice?')) + '">' + C.BOARD_KINDS.map(function (kk) {
        return '<button type="button" class="bd-kind' + (kk[0] === k ? ' on' : '') + '" role="radio" aria-checked="' + (kk[0] === k) + '" data-act="board:pick" data-k="' + kk[0] + '" style="--c:' + kk[3] + '">' + esc(T(kk[1])) + '</button>';
      }).join('') + '</div>' +
      '<div class="bd-form"><div class="bd-fields"><input type="hidden" id="bd-kind" value="' + k + '">' +
      '<label class="field req">' + T('Title') + '<input id="bd-title" maxlength="80" value="' + esc(x ? x.title : '') + '" placeholder="' + esc(T(C.kind(PART, k)[2])) + '"></label>' +
      '<label class="field">' + T('A few words more') + '<textarea id="bd-body" maxlength="600" rows="3">' + esc(x ? x.body : '') + '</textarea></label>' +
      '<label class="field">' + T('Phone number to show') + '<input id="bd-phone" type="tel" maxlength="30" value="' + esc(x ? x.phone || '' : '') + '"><small>' + T('Only if you want people to phone you. Otherwise they write to you in Messages.') + '</small></label></div>' +
      '<ul class="cork bd-preview" aria-hidden="true">' + note({ id: 'preview', kind: k, title: x ? x.title : T('Your notice'), body: x ? x.body : '', name: Community.firstName(U.me()), status: 'live', createdAt: S.now() }) + '</ul></div>' +
      '<p class="cm-err" id="bd-err" role="alert"></p></div>' +
      '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn primary" data-act="board:save"' + (x ? ' data-id="' + esc(x.id) + '"' : '') + '>' + (x ? T('Send to a keeper') : T('Pin it')) + '</button></div>', T('Pin a notice'), true);
    var upd = function () {
      var pv = document.querySelector('.bd-preview .note'); if (!pv) return;
      var t = document.getElementById('bd-title').value.trim(), b = document.getElementById('bd-body').value.trim();
      pv.querySelector('.note-t').textContent = t || T('Your notice');
      var nb = pv.querySelector('.note-b'); if (!nb) { nb = document.createElement('span'); nb.className = 'note-b'; pv.querySelector('.note-t').after(nb); } nb.textContent = b;
    };
    ['bd-title', 'bd-body'].forEach(function (i) { var el = document.getElementById(i); if (el) el.addEventListener('input', upd); });
  }
  function pick(el) {
    var k = el.dataset.k, kk = C.kind(PART, k);
    document.querySelectorAll('.bd-kind').forEach(function (b) { var on = b.dataset.k === k; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
    document.getElementById('bd-kind').value = k;
    var t = document.getElementById('bd-title'); if (t) t.placeholder = T(kk[2]);
    var pv = document.querySelector('.bd-preview .note');
    if (pv) { pv.className = 'note k-' + k; pv.style.setProperty('--c', kk[3]); var nk = pv.querySelector('.note-k'); if (nk) nk.textContent = T(kk[1]); pv.classList.add('wiggle'); }
  }
  function save(el) {
    var u = U.me(); if (!u) return;
    var f = { kind: document.getElementById('bd-kind').value, title: document.getElementById('bd-title').value, body: document.getElementById('bd-body').value, phone: document.getElementById('bd-phone').value };
    var old = el.dataset.id ? S.get(PART, el.dataset.id) : null;
    var x = old ? C.edit(PART, old, f, u, now()) : C.make(PART, f, u, now());
    if (x.error) { document.getElementById('bd-err').textContent = T('Give your notice a title.'); document.getElementById('bd-title').focus(); return; }
    x = S.put(PART, x, U.audit(PART, old ? 'changed a notice (back to the keepers)' : 'pinned a notice'));
    state.fly = x.id; state.kind = ''; setTimeout(function () { state.fly = ''; }, 1600);
    H.closeModal();
    if (/^#\/board\/?$/.test(location.hash)) H.render(); else H.go('board');
    H.toast(T(U.WORDS.board.sent));
  }

  /* ---------- Home and Me: the latest 3 notices ---------- */
  function card(where) {
    if (!H.isOn(PART) || !H.can('board.view') || S.pref('boardCard') === 'off') return '';
    var latest = C.latest(items(), now(), 3); if (!latest.length) return '';
    return '<section class="panel cm-home' + (where === 'me' ? ' cm-me' : '') + '"><div class="cm-home-h"><h2>' + H.icon(PIN, 18) + ' ' + T('Latest on the Community board') + '</h2>' +
      (where === 'home' ? '<button class="icon-btn ghost" data-act="board:hidecard" aria-label="' + esc(T('Hide this from my Home')) + '" title="' + esc(T('Hide this from my Home')) + '">' + H.icon(H.ICON.x, 16) + '</button>' : '') + '</div>' +
      '<ul class="cork cork-strip">' + latest.map(function (x) { return note(x, { mini: true, href: '#/board/n/' + encodeURIComponent(x.id) }); }).join('') + '</ul>' +
      '<p class="cm-home-more"><a href="#/board">' + T('See the board') + ' →</a></p></section>';
  }
  window.BoardUI = { card: function () { return card('me'); } };

  function noteTextDialog() {
    if (!U.manager()) return;
    var st = S.settings() || {};
    H.modal(H.dialogHead(T('The note on the board'), T('Shown at the foot of the board, in your own words.')) + '<div class="dlg-body">' +
      '<label class="field">' + T('The note') + '<textarea id="bd-note" rows="4" maxlength="400">' + esc(st.boardNote || T(DEFAULT_NOTE)) + '</textarea></label></div>' +
      '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn primary" data-act="board:notesave">' + T('Save') + '</button></div>', T('The note on the board'));
  }

  var acts = Object.assign(U.actions(PART), {
    pin: function () { pinDialog(''); },
    pick: pick,
    save: save,
    edit: function (el) { pinDialog(el.dataset.id); },
    open: function (el) { openNote(el.dataset.id); },
    kind: function (el) { state.kind = el.dataset.k || ''; H.render(); },
    done: function (el) { if (U.finish(PART, el.dataset.id)) H.toast(T('Wonderful! It stays on the board with a “Sorted” stamp for a day.')); },
    hidecard: function () { S.pref('boardCard', 'off'); H.render(); H.toast(T('Hidden. The board is still in the menu.')); },
    notetext: noteTextDialog,
    notesave: function () {
      var v = (document.getElementById('bd-note') || {}).value || '';
      S.setSettings({ boardNote: v.trim() === T(DEFAULT_NOTE) ? '' : v.trim().slice(0, 400) }, U.audit(PART, 'changed the note on the board')); H.closeModal(); H.render(); H.toast(T('Saved'));
    }
  });

  H.register({
    id: 'board', name: 'Community board', desc: 'Pin notices and offers of help – a keeper checks each one first', tint: '#B07A2A', optIn: true, roles: [], perm: 'board.view',   // roles: [] – only who js/access.js allows
    icon: PIN,
    stat: function () { var n = C.latest(items(), now(), 999).length; return n ? TN('{n} notice up', '{n} notices up', n) : T('Pin notices and offers of help – a keeper checks each one first'); },
    badge: function () { return U.badge(PART); },
    todos: function () { return U.todos(PART); },
    homeCard: function () { return card('home'); },
    render: render,
    actions: acts
  });
})();
