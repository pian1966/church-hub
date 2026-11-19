/*
 * Church & Trellis – what the Community board (js/mod-board.js) and the Marketplace (js/mod-market.js) share on screen:
 * the keepers' "Waiting for approval", their decisions (with a kind note back in Messages), choosing the keepers, writing
 * privately to the person who posted, reporting, renewing, taking down, tidying away and small photos.
 * The rules behind it are js/community.js (pure, tested); who may do what is js/access.js (Hub.can('board.keep') …).
 * Each part's words are in WORDS below (the part's own sentences, so every language can say them its own way).
 */
var CommunityUI = (function () {
  'use strict';
  var H = Hub, S = Store, C = Community, T = I18n.t, TN = I18n.tn, esc = H.esc;
  var TX = function (s) { return s; };   // a text kept in a list, translated where it is shown (the language test checks it)
  var WORDS = {
    board: { name: TX('Community board'), sent: TX('Pinned! A keeper will check it soon.'), waitingTitle: TX('Notices waiting for a keeper'),
      upTitle: TX('Your notice is up'), upBody: TX('{keeper} put “{title}” on the Community board. It stays up for 30 days.'),
      changeTitle: TX('Please change your notice'), changeBody: TX('{keeper} asked you to change “{title}”: {note}'),
      noTitle: TX('Your notice wasn’t put up'), noBody: TX('{keeper} didn’t put “{title}” up: {note}'),
      about: TX('About your notice: {title}'), contact: TX('I can help'), done: TX('Sorted, thank you!'), stamp: TX('Sorted'),
      ask: TX('A keeper asked you to change “{title}”'), ends: TX('“{title}” ends soon – renew it?'), queue: [TX('{n} notice waiting for a keeper'), TX('{n} notices waiting for a keeper')] },
    market: { name: TX('Marketplace'), sent: TX('Sent to the keepers. It shows once one of them approves it.'), waitingTitle: TX('Listings waiting for a keeper'),
      upTitle: TX('Your listing is up'), upBody: TX('{keeper} approved “{title}” for the Marketplace. It stays up for 30 days.'),
      changeTitle: TX('Please change your listing'), changeBody: TX('{keeper} asked you to change “{title}”: {note}'),
      noTitle: TX('Your listing wasn’t put up'), noBody: TX('{keeper} didn’t put “{title}” up: {note}'),
      about: TX('About your listing: {title}'), contact: TX('I’m interested'), done: TX('Mark as sold'), stamp: TX('Sold'),
      ask: TX('A keeper asked you to change “{title}”'), ends: TX('“{title}” ends soon – renew it?'), queue: [TX('{n} listing waiting for a keeper'), TX('{n} listings waiting for a keeper')] }
  };
  function W(part, k) { return WORDS[part][k]; }
  function now() { return Date.now(); }
  function me() { var u = H.user(); return u ? S.get('people', u.id) || u : null; }
  function who() { var u = H.user(); return { id: u ? u.id : '', ids: u ? [u.id] : [] }; }
  /** A keeper of this part (never while "View as" – the rules check the real sign-in). */
  function keeper(part) { return !S.preview() && H.can(part + '.keep'); }
  function manager() { return !S.preview() && H.can('settings.manage'); }
  function messagesOn() { return H.isOn('messages'); }
  function list(part) { return S.list(part); }
  function poster(x) { return S.get('people', x.personId); }
  function audit(part, what) { return (part === 'market' ? 'Marketplace: ' : 'Community board: ') + what; }

  /* ---------- telling the poster (Messages) ---------- */
  function tell(part, x, title, body) {
    var u = me(); if (!u || !messagesOn() || x.personId === u.id) return;
    var m = C.message(part, x, u, title, body); if (!m.error) S.put('messages', m, audit(part, 'told the person who posted it'));
  }

  /* ---------- the keepers' list ---------- */
  function when(x) { var t = +x.decidedAt || Date.parse(String(x.createdAt || '').replace(' ', 'T')); return t ? H.fmt(new Date(t).toISOString().slice(0, 10)) : ''; }
  /** "Waiting for approval" (and anything reported): each with Approve / Ask for a change / Decline. thumb(x): its picture. */
  function queue(part, thumb) {
    var w = C.waiting(list(part)), r = C.reported(list(part), now());
    if (!w.length && !r.length) return '<p class="empty cm-empty">' + H.icon('M5 12l5 5L20 7', 22) + '<br>' + T('Nothing is waiting – all done.') + '</p>';
    var row = function (x, reported) {
      return '<article class="cm-q"' + (reported ? ' data-reported="1"' : '') + '>' + (thumb ? thumb(x) : '') + '<div class="grow"><b>' + esc(x.title) + '</b>' +
        (x.body ? '<p class="cm-q-body">' + esc(x.body) + '</p>' : '') +
        '<small class="muted">' + esc(part === 'market' ? T('Listed by {name}', { name: x.name || T('Someone') }) : T('Pinned by {name}', { name: x.name || T('Someone') })) + ' · ' + esc(when(x)) +
        (reported ? ' · <span class="cm-flag">' + esc(TN('Reported by {n} person', 'Reported by {n} people', x.reports.length)) + '</span>' : '') + '</small>' +
        '<div class="btns cm-q-btns"><button class="btn primary small" data-act="' + part + ':decide" data-id="' + esc(x.id) + '" data-a="approve">' + H.icon('M5 12l5 5L20 7', 16) + ' ' + T('Approve') + '</button>' +
        '<button class="btn small" data-act="' + part + ':decide" data-id="' + esc(x.id) + '" data-a="change">' + T('Ask for a change') + '</button>' +
        '<button class="btn small" data-act="' + part + ':decide" data-id="' + esc(x.id) + '" data-a="decline">' + (reported ? T('Take it down') : T('Decline')) + '</button></div></div></article>';
    };
    return '<section class="cm-queue"><h2 class="cm-h2">' + esc(T(W(part, 'waitingTitle'))) + '</h2>' + w.map(function (x) { return row(x, false); }).join('') +
      (r.length ? '<h2 class="cm-h2">' + T('Reported') + '</h2>' + r.map(function (x) { return row(x, true); }).join('') : '') + '</section>';
  }
  /** Approve at once; Ask for a change / Decline first ask for a kind note, which goes back to them in Messages. */
  function decideStart(part, id, action) {
    var x = S.get(part, id); if (!x || !keeper(part)) return;
    if (action === 'approve') return decide(part, id, 'approve', '');
    var change = action === 'change';
    H.modal(H.dialogHead(change ? T('Ask for a change') : T('Decline'), x.title) + '<div class="dlg-body">' +
      '<label class="field req">' + (change ? T('What should they change?') : T('A kind word on why')) + '<textarea id="cm-note" maxlength="300" rows="3"></textarea><small>' + T('This goes to them in Messages.') + '</small></label>' +
      '<p class="cm-err" id="cm-note-err" role="alert"></p></div>' +
      '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn primary" data-act="' + part + ':decided" data-id="' + esc(id) + '" data-a="' + action + '">' + (change ? T('Send') : T('Decline')) + '</button></div>', change ? T('Ask for a change') : T('Decline'));
  }
  function decide(part, id, action, note) {
    var x = S.get(part, id), u = me(); if (!x || !u) return false;
    var y = C.decide(x, action, note, u, now());
    if (y.error) { var e = document.getElementById('cm-note-err'); if (e) e.textContent = T('Write a short note first.'); return false; }
    S.put(part, y, audit(part, action === 'approve' ? 'approved “' + x.title + '”' : action === 'change' ? 'asked for a change to “' + x.title + '”' : 'declined “' + x.title + '”'));
    var vars = { keeper: y.by, title: x.title, note: y.note };
    if (action === 'approve') tell(part, y, T(W(part, 'upTitle')), T(W(part, 'upBody'), vars));
    else if (action === 'change') tell(part, y, T(W(part, 'changeTitle')), T(W(part, 'changeBody'), vars));
    else tell(part, y, T(W(part, 'noTitle')), T(W(part, 'noBody'), vars));
    H.closeModal(); H.render(); H.toast(action === 'approve' ? T('Approved') : action === 'change' ? T('Sent back for a change') : T('Declined'));
    return true;
  }

  /* ---------- choosing the keepers (Administrators) ---------- */
  function alive(p) { return p && p.active !== false && !p.binnedAt && !p.mergedInto && p.familyRole !== 'child' && p.category !== 'Deceased'; }
  function keeperIds(part) { return Access.jobHolders('keepers', part, S.settings(), S.find('people', alive)); }
  function keepersDialog(part) {
    if (!manager()) return;
    var ids = keeperIds(part), chosen = Array.isArray(((S.settings() || {}).keepers || {})[part]);
    var rows = ids.map(function (id) {
      var p = S.get('people', id); if (!p) return '';
      return '<div class="item">' + H.avatar(p, 32) + '<span class="grow"><b>' + esc(H.name(p)) + '</b><small>' + esc(H.personRole(p)) + '</small></span>' +
        '<button class="icon-btn ghost" data-act="' + part + ':keeperout" data-id="' + esc(id) + '" aria-label="' + esc(T('Take {name} out', { name: H.name(p) })) + '">' + H.icon(H.ICON.x, 16) + '</button></div>';
    }).join('');
    var pick = S.find('people', function (p) { return alive(p) && ids.indexOf(p.id) < 0 && (p.category === 'Church Partner' || p.category === 'Staff' || (p.appRole && p.appRole !== 'member' && p.appRole !== 'none')); });
    var finder = window.CareUI && CareUI.finder ? CareUI.finder('cm-keepers', pick, part + ':keeperin', {}, null, T('Add a keeper: type part of their name')) : '';
    H.modal(H.dialogHead(T('Keepers'), T(W(part, 'name'))) + '<div class="dlg-body"><p class="hint" style="margin-top:0">' +
      T('Keepers check every new one before anyone else sees it. Until you choose, they are the Administrators, the Pastors and the church secretary.') + '</p>' +
      '<div class="list" id="cm-keeper-list">' + rows + '</div><div style="margin-top:10px">' + finder + '</div>' +
      (chosen ? '<p><button class="link" data-act="' + part + ':keepersreset">' + T('Use the first keepers again') + '</button></p>' : '') + '</div>' +
      '<div class="dlg-foot"><button class="btn primary" data-act="hub:close">' + T('Done') + '</button></div>', T('Keepers'));
  }
  function setKeepers(part, ids, what) {
    var k = Object.assign({}, (S.settings() || {}).keepers || {});
    if (ids) k[part] = ids; else delete k[part];
    S.setSettings({ keepers: k }, audit(part, what)); keepersDialog(part);
  }

  /* ---------- the poster's own, and everyone's ---------- */
  function contactDialog(part, id) {
    var x = S.get(part, id); if (!x) return;
    H.modal(H.dialogHead(T(W(part, 'contact')), x.title) + '<div class="dlg-body">' +
      '<label class="field req">' + T('Message {name}', { name: x.name || T('Someone') }) + '<textarea id="cm-msg" rows="4" maxlength="2000"></textarea>' +
      '<small>' + T('It goes privately to {name} in Messages.', { name: x.name || T('Someone') }) + '</small></label><p class="cm-err" id="cm-msg-err" role="alert"></p></div>' +
      '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn primary" data-act="' + part + ':send" data-id="' + esc(id) + '">' + T('Send') + '</button></div>', T(W(part, 'contact')));
  }
  function send(part, id) {
    var x = S.get(part, id), box = document.getElementById('cm-msg'), u = me(); if (!x || !box || !u) return;
    var m = C.message(part, x, u, T(W(part, 'about'), { title: x.title }), box.value);
    if (m.error) { document.getElementById('cm-msg-err').textContent = T('Write a short message first.'); return; }
    S.put('messages', m, audit(part, 'wrote to the person who posted “' + x.title + '”'));
    H.closeModal(); H.toast(T('Message sent'));
  }
  function report(part, el) {
    var x = S.get(part, el.dataset.id), u = H.user(); if (!x || !u) return;
    var y = C.report(x, u.id, now()); H.closeModal();
    if (y) S.put(part, y, audit(part, 'reported “' + x.title + '”'));
    H.toast(T('Thank you – the keepers will have a look.'));
  }
  function renew(part, id) {
    var x = S.get(part, id), y = x && C.renew(x, now()); if (!y) return;
    S.put(part, y, audit(part, 'renewed “' + x.title + '”')); H.closeModal(); H.render(); H.toast(T('Renewed – it stays up another 30 days.'));
  }
  function finish(part, id) {
    var x = S.get(part, id); if (!x) return;
    S.put(part, C.done(x, now()), audit(part, 'marked “' + x.title + '” done')); H.closeModal(); H.render();
    return x;
  }
  function remove(part, el) {
    var x = S.get(part, el.dataset.id); if (!x || !H.confirmBtn(el, T('Click again to take it down'))) return;
    if (part === 'market') S.setListingPhotos(x.id, []);
    S.remove(part, x.id, audit(part, 'took down “' + x.title + '”')); H.closeModal(); H.render(); H.toast(T('Taken down'));
  }
  /** Ended more than 30 days ago: deleted (by its poster or a keeper, whoever opens the page first). */
  function tidy(part) {
    if (S.preview() || S.offline()) return;
    var u = H.user(), k = keeper(part); if (!u) return;
    C.tidy(list(part), now()).forEach(function (id) {
      var x = S.get(part, id); if (!x || !(k || x.personId === u.id)) return;
      if (part === 'market') S.setListingPhotos(id, []);
      S.remove(part, id);
    });
  }
  /** Where it stands, for its poster: a ribbon on their own notice or listing. */
  function ribbon(part, x) {
    var t = now();
    if (x.status === 'waiting') return '<span class="cm-ribbon wait">' + T('Waiting for a keeper') + '</span>';
    if (x.status === 'change') return '<span class="cm-ribbon change">' + T('A keeper asked for a change') + '</span>';
    if (x.status === 'declined') return '<span class="cm-ribbon no">' + T('Not put up') + '</span>';
    if (C.ending(x, t) && C.mine(x, who())) return '<span class="cm-ribbon wait">' + TN('Ends in {n} day', 'Ends in {n} days', C.daysLeft(x, t)) + '</span>';
    return '';
  }
  /** The poster's own buttons in the open view. */
  function ownButtons(part, x) {
    var t = now(), b = [];
    if (C.isLive(x, t)) b.push('<button class="btn primary" data-act="' + part + ':done" data-id="' + esc(x.id) + '">' + H.icon('M5 12l5 5L20 7', 16) + ' ' + esc(T(doneLabel(part, x))) + '</button>');
    if (x.status !== 'done') b.push('<button class="btn" data-act="' + part + ':edit" data-id="' + esc(x.id) + '">' + T('Change') + '</button>');
    if (C.isLive(x, t) && (+x.renews || 0) < C.RENEWS && C.daysLeft(x, t) <= C.REMIND) b.push('<button class="btn" data-act="' + part + ':renew" data-id="' + esc(x.id) + '">' + T('Renew for 30 days') + '</button>');
    b.push('<button class="btn cm-down" data-act="' + part + ':remove" data-id="' + esc(x.id) + '">' + T('Take it down') + '</button>');
    return b.join('');
  }
  function doneLabel(part, x) { return part === 'market' ? (x.kind === 'free' ? TX('Mark as given away') : x.kind === 'wanted' ? TX('Mark as found') : W(part, 'done')) : W(part, 'done'); }
  function stampLabel(part, x) { return part === 'market' ? (x.kind === 'free' ? TX('Given away') : x.kind === 'wanted' ? TX('Found') : W(part, 'stamp')) : W(part, 'stamp'); }
  /** Someone else's: write to them, and report it (keepers also get their decision buttons when it is waiting). */
  function otherButtons(part, x) {
    var b = [];
    if (C.isLive(x, now()) && messagesOn()) b.push('<button class="btn primary" data-act="' + part + ':contact" data-id="' + esc(x.id) + '">' + H.icon('M4 5h16v11H8l-4 4z', 16) + ' ' + esc(T(W(part, 'contact'))) + '</button>');
    if (x.status === 'waiting' && keeper(part)) ['approve', 'change', 'decline'].forEach(function (a, i) {
      b.push('<button class="btn' + (i || b.length ? '' : ' primary') + '" data-act="' + part + ':decide" data-id="' + esc(x.id) + '" data-a="' + a + '">' + (a === 'approve' ? T('Approve') : a === 'change' ? T('Ask for a change') : T('Decline')) + '</button>');
    });
    if (C.isLive(x, now())) b.push(H.menu('⋯', ['<button class="btn ghost" data-act="' + part + ':report" data-id="' + esc(x.id) + '">' + T('Report to the keepers') + '</button>'].concat(keeper(part) ?
      ['<button class="btn ghost" data-act="' + part + ':decide" data-id="' + esc(x.id) + '" data-a="decline">' + T('Take it down') + '</button>'] : []), 'row-menu', T('More')));
    return b.join('');
  }
  /** The keepers' count (a badge on the menu) and the poster's own ones that need them. */
  function badge(part) { var n = keeper(part) ? C.waiting(list(part)).length : 0; return n + C.needsMe(list(part), who(), now()).filter(function (x) { return x.status === 'change'; }).length; }
  function todos(part) {
    var out = [], t = now();
    if (keeper(part)) { var n = C.waiting(list(part)).length; if (n) out.push({ text: TN(W(part, 'queue')[0], W(part, 'queue')[1], n), href: '#/' + part + '/waiting', priority: true }); }
    C.needsMe(list(part), who(), t).forEach(function (x) {
      out.push({ text: T(x.status === 'change' ? W(part, 'ask') : W(part, 'ends'), { title: x.title }), href: '#/' + part + '/mine' });
    });
    return out;
  }

  /* ---------- photos (Marketplace): made small on the phone before they are sent, to save data ---------- */
  function shrink(file, max, q) {
    return new Promise(function (ok, fail) {
      if (!file || !/^image\//.test(file.type)) return fail(new Error('not a picture'));
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)), cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(img.naturalWidth * k)); cv.height = Math.max(1, Math.round(img.naturalHeight * k));
        var g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url); ok(cv.toDataURL('image/jpeg', q));
      };
      img.onerror = function () { URL.revokeObjectURL(url); fail(new Error('could not read')); };
      img.src = url;
    });
  }

  /** The actions both parts share: each module adds them to its own (Hub looks them up as '<part>:<action>'). */
  function actions(part) {
    return {
      decide: function (el) { decideStart(part, el.dataset.id, el.dataset.a); },
      decided: function (el) { var n = document.getElementById('cm-note'); decide(part, el.dataset.id, el.dataset.a, n ? n.value : ''); },
      keepers: function () { keepersDialog(part); },
      keeperin: function (el) { if (manager()) setKeepers(part, keeperIds(part).concat([el.dataset.id]), 'added a keeper'); },
      keeperout: function (el) { if (manager()) setKeepers(part, keeperIds(part).filter(function (x) { return x !== el.dataset.id; }), 'took a keeper out'); },
      keepersreset: function () { if (manager()) setKeepers(part, null, 'went back to the first keepers'); },
      contact: function (el) { contactDialog(part, el.dataset.id); },
      send: function (el) { send(part, el.dataset.id); },
      report: function (el) { report(part, el); },
      renew: function (el) { renew(part, el.dataset.id); },
      remove: function (el) { remove(part, el); }
    };
  }

  return { WORDS: WORDS, keeper: keeper, manager: manager, who: who, me: me, now: now, list: list, poster: poster, audit: audit, queue: queue, ribbon: ribbon, ownButtons: ownButtons, otherButtons: otherButtons,
    doneLabel: doneLabel, stampLabel: stampLabel, finish: finish, tidy: tidy, badge: badge, todos: todos, shrink: shrink, actions: actions, when: when, messagesOn: messagesOn };
})();
