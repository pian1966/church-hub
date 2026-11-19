/* Church & Trellis – Marketplace: buy, sell and give away within the church, like Facebook Marketplace but for Church Partners
 * only (decided 19 Nov 2026; js/access.js PARTS 'market' – attendees never see it). Nothing shows until a keeper approves it.
 * The rules: js/community.js (shared with the Community board); the keepers' screens: js/community-ui.js; the look: css/community.css.
 * Photos: up to 3, made small on the phone (about 100 KB each), kept in marketPhotos/{id} and fetched only when a listing is
 * opened; the grid shows a tiny picture kept on the listing itself (thumb) – so browsing costs little data.
 * Routes: #/market, #/market/mine, #/market/waiting (keepers), #/market/n/<id>. No payments go through Church & Trellis.
 * POPIA: docs/POPIA.md "Community board and Marketplace" (the area – a suburb – never an address). */
(function () {
  'use strict';
  var H = Hub, S = Store, C = Community, U = CommunityUI, T = I18n.t, TN = I18n.tn, esc = H.esc;
  var TX = function (s) { return s; };
  var PART = 'market', state = { kind: '', q: '', cat: '', fly: '', tidied: false }, draft = null;
  var ICON = 'M4 9l1.5-5h13L20 9M4 9h16v11H4zM4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0M10 20v-5h4v5';
  var DEFAULT_RULES = TX('Only things that are yours to sell or give. No weapons, alcohol, medicines, animals for breeding or anything illegal, and no business advertising beyond your own skills. Be honest about the condition, be kind, and keep your word. The church is not part of any sale.');
  var SAFE = TX('Stay safe: meet at church after a service, and don’t pay before you’ve seen it.');
  // A small drawing for each category, for listings without a photo
  var CAT_ICON = { furniture: 'M5 11V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4M3 11h18v5H3zM5 16v3M19 16v3', children: 'M12 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM7 20l2-6h6l2 6', clothing: 'M8 4l4 2 4-2 4 4-3 3v9H7v-9L4 8z',
    vehicles: 'M3 14l2-5h14l2 5v4H3zM7 18v2M17 18v2M6 14h.01M18 14h.01', electronics: 'M4 5h16v11H4zM9 20h6M12 16v4', books: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM8 7h7',
    household: 'M4 11l8-7 8 7v9H4zM10 20v-5h4v5', garden: 'M12 21V11M12 11c0-4 3-7 7-7 0 4-3 7-7 7zM12 14c0-3-2-5-6-5 0 3 2 5 6 5z', other: 'M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8' };

  function items() { return S.list(PART); }
  function now() { return Date.now(); }
  function myId() { var u = H.user(); return u ? u.id : ''; }
  function cur() { var st = S.settings() || {}; return window.Coffee && window.Countries ? Coffee.currencyFor((Countries.church(st) || {}).code) : 'ZAR'; }
  function money(n) { return window.Coffee ? Coffee.money(n, cur()) : 'R' + n; }
  function priceText(x) {
    if (x.kind === 'free') return T('Free');
    if (x.kind === 'sale' && !(+x.price > 0)) return T('Open to offers');
    if (!(+x.price > 0)) return x.kind === 'wanted' ? T('Wanted') : '';
    if (x.kind === 'wanted') return T('Budget') + ' ' + money(x.price);
    return money(x.price) + (x.offer ? ' · ' + T('or offer') : '');
  }
  function name(list, id) { return (list.filter(function (k) { return k[0] === id; })[0] || ['', ''])[1]; }
  function photo(x, size) {
    return x.thumb ? '<img src="' + esc(x.thumb) + '" alt="" loading="lazy" decoding="async">' :
      '<span class="mk-nophoto" aria-hidden="true">' + H.icon(CAT_ICON[x.category] || CAT_ICON.other, size || 34) + '</span>';
  }

  /* ---------- one card in the grid ---------- */
  function card(x) {
    var done = x.status === 'done', mine = x.personId === myId();
    return '<li class="mk-card k-' + x.kind + (done ? ' done' : '') + (x.status !== 'live' && !done ? ' pending' : '') + (state.fly === x.id ? ' fly' : '') + '">' +
      '<button type="button" data-act="market:open" data-id="' + esc(x.id) + '" aria-label="' + esc(x.title + ', ' + priceText(x)) + '"><span class="mk-photo">' + photo(x) +
      (x.kind !== 'sale' ? '<span class="mk-pill">' + esc(T(name(C.MARKET_KINDS, x.kind))) + '</span>' : '') + (x.photos > 1 ? '<span class="mk-count" aria-hidden="true">' + H.icon('M4 7h3l2-2h6l2 2h3v12H4zM12 10a3 3 0 1 1 0 6 3 3 0 0 1 0-6z', 12) + ' ' + x.photos + '</span>' : '') +
      (done ? '<span class="stamp">' + esc(T(U.stampLabel(PART, x))) + '</span>' : '') + '</span>' +
      '<span class="mk-price">' + esc(priceText(x)) + '</span><span class="mk-title">' + esc(x.title) + '</span>' +
      '<span class="mk-area">' + esc([x.area, x.kind !== 'wanted' ? T(name(C.CONDITIONS, x.condition)) : ''].filter(Boolean).join(' · ')) + '</span>' +
      (mine ? U.ribbon(PART, x) : '') + '</button></li>';
  }
  function grid(list, empty) { return list.length ? '<ul class="mk-grid">' + list.map(card).join('') + '</ul>' : empty; }
  function emptyState() {
    return '<div class="mk-empty">' + H.icon(ICON, 40) + '<h2>' + T('Nothing here yet.') + '</h2><p>' + T('Sell what you no longer need, ask for what you’re looking for, or give something away.') + '</p>' +
      '<button class="btn primary" data-act="market:list">' + T('List something') + '</button></div>';
  }

  /* ---------- the page ---------- */
  function render(parts) {
    var tab = (parts && parts[0]) || '', keeper = U.keeper(PART), t = now(), me = U.who();
    if (!state.tidied) { state.tidied = true; setTimeout(function () { U.tidy(PART); }, 800); }
    if (tab === 'n' && parts[1]) { var nid = parts[1]; try { history.replaceState(null, '', '#/market'); } catch (e) {} tab = ''; setTimeout(function () { openListing(nid); }, 30); }
    var mine = items().filter(function (x) { return C.mine(x, me); }), waitingN = keeper ? C.waiting(items()).length + C.reported(items(), t).length : 0;
    if (tab === 'waiting' && !keeper) tab = '';
    if (tab === 'mine' && !mine.length) tab = '';
    var more = U.manager() ? H.menu(T('More'), ['<button class="btn ghost" data-act="market:keepers">' + T('Keepers…') + '</button>', '<button class="btn ghost" data-act="market:rulestext">' + T('Marketplace rules…') + '</button>']) :
      H.menu(T('More'), ['<button class="btn ghost" data-act="market:rules">' + T('Marketplace rules') + '</button>']);
    var html = '<div class="page-head"><div><h1>' + T('Marketplace') + '</h1><p class="lead">' + T('Buy, sell and give away within the church. A keeper checks every listing first.') + '</p></div>' +
      '<div class="btns">' + more + '<button class="btn primary" data-act="market:list">' + H.icon('M12 5v14M5 12h14', 16) + ' ' + T('List something') + '</button></div></div>';
    var shown = C.shown(items(), me, t).filter(function (x) { return C.isLive(x, t) || C.stamped(x, t); });
    var kinds = C.MARKET_KINDS.filter(function (k) { return shown.some(function (x) { return x.kind === k[0]; }); });
    if (state.kind && !kinds.some(function (k) { return k[0] === state.kind; })) state.kind = '';
    var tabs = (kinds.length > 1 ? [['', T('Everything')]].concat(kinds.map(function (k) { return [k[0], T(k[1])]; })) : shown.length ? [['', T('Everything')]] : []);
    if (tabs.length > 1 || mine.length || keeper) html += '<nav class="seg cm-seg">' + (tabs.length ? tabs : [['', T('Everything')]]).map(function (k) {
      return '<a href="#/market" data-act="market:kind" data-k="' + k[0] + '"' + (tab === '' && state.kind === k[0] ? ' class="on"' : '') + '>' + esc(k[1]) + '</a>';
    }).join('') + (mine.length ? '<a href="#/market/mine"' + (tab === 'mine' ? ' class="on"' : '') + '>' + T('My listings') + '</a>' : '') +
      (keeper ? '<a href="#/market/waiting"' + (tab === 'waiting' ? ' class="on"' : '') + '>' + T('Waiting for approval') + (waitingN ? ' <span class="badge">' + waitingN + '</span>' : '') + '</a>' : '') + '</nav>';
    if (tab === 'waiting') return html + U.queue(PART, function (x) { return '<span class="mk-qphoto">' + photo(x, 26) + '</span>'; });
    if (tab === 'mine') return html + grid(mine.sort(function (a, b) { return (b.createdAt || '') < (a.createdAt || '') ? -1 : 1; }), '') + safeLine();
    var list = shown.filter(function (x) {
      return (!state.kind || x.kind === state.kind) && (!state.cat || x.category === state.cat) && (!state.q || H.matches(x.title + ' ' + (x.body || '') + ' ' + (x.area || ''), state.q));
    });
    if (shown.length > 4) html += '<details class="cm-filter"' + (state.q || state.cat ? ' open' : '') + '><summary>' + T('Search and categories') + '</summary>' +
      '<label class="search mk-search">' + H.icon('M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM21 21l-5-5', 16) + '<input id="mk-q" type="search" value="' + esc(state.q) + '" placeholder="' + esc(T('Search the Marketplace')) + '" aria-label="' + esc(T('Search the Marketplace')) + '"></label>' +
      '<div class="cm-chips">' + [['', TX('Everything')]].concat(C.CATEGORIES).filter(function (c) { return !c[0] || shown.some(function (x) { return x.category === c[0]; }); }).map(function (c) {
        return '<button class="cm-chip' + (state.cat === c[0] ? ' on' : '') + '" data-act="market:cat" data-c="' + c[0] + '" aria-pressed="' + (state.cat === c[0]) + '">' + (c[0] ? H.icon(CAT_ICON[c[0]], 14) + ' ' : '') + esc(T(c[1])) + '</button>';
      }).join('') + '</div></details>';
    html += grid(list, shown.length ? '<p class="empty">' + T('Nothing matches. Try another word or category.') + '</p>' : emptyState());
    setTimeout(wireSearch, 0);
    return html + safeLine();
  }
  function safeLine() { return '<p class="cm-foot">' + H.icon('M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', 16) + '<span>' + T(SAFE) + ' ' + T('The church is not part of any sale.') + '</span></p>'; }
  function wireSearch() {
    var q = document.getElementById('mk-q'); if (!q || q.dataset.wired) return; q.dataset.wired = '1';
    var timer = null;
    q.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { state.q = q.value; H.render(); var n = document.getElementById('mk-q'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 250); });
  }

  /* ---------- one listing ---------- */
  function openListing(id) {
    var x = S.get(PART, id); if (!x) return;
    var mine = x.personId === myId();
    var keeperNote = mine && x.note && (x.status === 'change' || x.status === 'declined') ? '<p class="cm-keeper-note"><b>' + esc(x.by || T('Keeper')) + ':</b> ' + esc(x.note) + '</p>' : '';
    var facts = [T(name(C.MARKET_KINDS, x.kind)), x.kind !== 'wanted' ? T(name(C.CONDITIONS, x.condition)) : '', T(name(C.CATEGORIES, x.category)), x.area].filter(Boolean);
    H.modal('<div class="mk-open">' + H.dialogHead(x.title, '') + '<div class="dlg-body">' +
      '<div class="mk-gallery' + (x.photos ? '' : ' none') + '" id="mk-gallery">' + (x.thumb ? '<img src="' + esc(x.thumb) + '" alt="" class="blur">' : photo(x, 60)) + '</div>' +
      '<p class="mk-bigprice">' + esc(priceText(x)) + (x.status === 'done' ? ' <span class="stamp inline">' + esc(T(U.stampLabel(PART, x))) + '</span>' : '') + '</p>' +
      '<p class="mk-facts">' + facts.map(function (f) { return '<span>' + esc(f) + '</span>'; }).join('') + '</p>' +
      (x.body ? '<p class="mk-body">' + esc(x.body) + '</p>' : '') +
      '<p class="muted small">' + esc(T('Listed by {name}', { name: x.name || T('Someone') })) + ' · ' + esc(U.when(x)) + '</p>' + (mine ? U.ribbon(PART, x) : '') + keeperNote +
      (!mine ? '<p class="mk-safe">' + H.icon('M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', 16) + ' ' + T(SAFE) + '</p>' : '') + '</div>' +
      '<div class="dlg-foot">' + (mine ? U.ownButtons(PART, x) : U.otherButtons(PART, x)) + '</div></div>', x.title, true);
    if (x.photos) S.listingPhotos(x.id).then(function (pics) {
      var g = document.getElementById('mk-gallery'); if (!g || !pics.length) return;
      g.innerHTML = pics.map(function (p, i) { return '<img src="' + esc(p) + '" alt="' + esc(T('Photo {n}', { n: i + 1 })) + '">'; }).join('');
      g.classList.toggle('many', pics.length > 1);
    });
  }

  /* ---------- listing something (or changing it) ---------- */
  function listDialog(id) {
    var x = id ? S.get(PART, id) : null;
    draft = { id: id || '', kind: x ? x.kind : 'sale', condition: x ? x.condition : 'good', photos: [], changed: false };
    var st = S.settings() || {}, sym = window.Coffee ? Coffee.currency(cur()).sym : 'R';
    H.modal(H.dialogHead(x ? T('Change your listing') : T('List something'), T('A keeper checks it before anyone sees it.')) + '<div class="dlg-body mk-form">' +
      '<div class="seg mk-kinds" role="radiogroup" aria-label="' + esc(T('What are you listing?')) + '">' + C.MARKET_KINDS.map(function (k) {
        return '<button type="button" role="radio" aria-checked="' + (draft.kind === k[0]) + '" class="' + (draft.kind === k[0] ? 'on' : '') + '" data-act="market:pickkind" data-k="' + k[0] + '">' + esc(T(k[1])) + '</button>';
      }).join('') + '</div>' +
      '<div class="mk-photos" id="mk-photos"></div>' +
      '<label class="field req">' + T('Title') + '<input id="mk-title" maxlength="80" value="' + esc(x ? x.title : '') + '" placeholder="' + esc(T('e.g. Pine bookshelf, or a pram')) + '"></label>' +
      '<div class="two mk-pricerow"><label class="field req mk-price-f">' + T('Price') + '<span class="mk-money"><span aria-hidden="true">' + esc(sym) + '</span><input id="mk-price" inputmode="decimal" maxlength="12" value="' + esc(x && +x.price > 0 ? String(x.price) : '') + '"></span></label>' +
      '<label class="check mk-offer"><input type="checkbox" id="mk-offer"' + (x && x.offer ? ' checked' : '') + '> ' + T('Open to offers') + '</label></div>' +
      '<div class="mk-cond"><p class="bd-q">' + T('Condition') + '</p><div class="cm-chips" role="radiogroup" aria-label="' + esc(T('Condition')) + '">' + C.CONDITIONS.map(function (c) {
        return '<button type="button" class="cm-chip' + (draft.condition === c[0] ? ' on' : '') + '" role="radio" aria-checked="' + (draft.condition === c[0]) + '" data-act="market:pickcond" data-c="' + c[0] + '">' + esc(T(c[1])) + '</button>';
      }).join('') + '</div></div>' +
      '<div class="two"><label class="field">' + T('Category') + '<select id="mk-cat" data-plain>' + C.CATEGORIES.map(function (c) { return '<option value="' + c[0] + '"' + ((x ? x.category : 'other') === c[0] ? ' selected' : '') + '>' + esc(T(c[1])) + '</option>'; }).join('') + '</select></label>' +
      '<label class="field">' + T('Area') + '<input id="mk-area" maxlength="60" value="' + esc(x ? x.area || '' : '') + '" placeholder="' + esc(T('e.g. Hilton')) + '"><small>' + T('Your suburb only – never your address.') + '</small></label></div>' +
      '<label class="field">' + T('Description') + '<textarea id="mk-body" maxlength="1000" rows="3">' + esc(x ? x.body : '') + '</textarea></label>' +
      '<details class="mk-rules"><summary>' + T('Read the Marketplace rules') + '</summary><p>' + esc(st.marketRules || T(DEFAULT_RULES)) + '</p></details>' +
      '<label class="check"><input type="checkbox" id="mk-ok"' + (x ? ' checked' : '') + '> ' + T('I accept the Marketplace rules') + '</label>' +
      '<p class="cm-err" id="mk-err" role="alert"></p></div>' +
      '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn primary" data-act="market:save">' + T('Send to a keeper') + '</button></div>', T('List something'), true);
    kindFields();
    drawPhotos();
    if (x && x.photos) S.listingPhotos(x.id).then(function (p) { if (draft && draft.id === x.id && !draft.changed) { draft.photos = p; drawPhotos(); } });
  }
  function kindFields() {
    var k = draft.kind, pr = document.querySelector('.mk-pricerow'), cond = document.querySelector('.mk-cond'), off = document.querySelector('.mk-offer'), pf = document.querySelector('.mk-price-f');
    if (pr) pr.hidden = k === 'free';
    if (off) off.hidden = k !== 'sale';
    if (pf) { pf.classList.toggle('req', k === 'sale'); pf.firstChild.textContent = k === 'wanted' ? T('Budget') : T('Price'); }
    if (cond) cond.hidden = k === 'wanted';
  }
  function drawPhotos() {
    var box = document.getElementById('mk-photos'); if (!box || !draft) return;
    box.innerHTML = draft.photos.map(function (p, i) {
      return '<span class="mk-ph"><img src="' + esc(p) + '" alt="' + esc(T('Photo {n}', { n: i + 1 })) + '"><button type="button" class="mk-ph-x" data-act="market:photox" data-i="' + i + '" aria-label="' + esc(T('Take this photo out')) + '">' + H.icon(H.ICON.x, 14) + '</button></span>';
    }).join('') + (draft.photos.length < C.MAX.photos ? '<label class="mk-ph add">' + H.icon('M4 7h3l2-2h6l2 2h3v12H4zM12 10a3 3 0 1 1 0 6 3 3 0 0 1 0-6z', 22) + '<span>' + (draft.photos.length ? T('Add another') : T('Add photos')) + '</span>' +
      '<input type="file" accept="image/*" id="mk-file" multiple hidden></label>' : '') + '<small class="mk-ph-hint">' + T('Up to 3. They are made small to save data.') + '</small>';
    var f = document.getElementById('mk-file');
    if (f) f.addEventListener('change', function () {
      var files = Array.prototype.slice.call(f.files || [], 0, C.MAX.photos - draft.photos.length); f.value = '';
      Promise.all(files.map(function (file) { return U.shrink(file, 900, 0.72).catch(function () { return ''; }); })).then(function (list) {
        var good = list.filter(Boolean); if (good.length < list.length) H.toast(T('That file isn’t a picture Church & Trellis can read. Try a JPG or PNG photo.'), true);
        draft.photos = draft.photos.concat(good).slice(0, C.MAX.photos); draft.changed = true; drawPhotos();
      });
    });
  }
  /** The small picture for the grid, from the first photo. */
  function thumbOf(src) {
    return new Promise(function (ok) {
      if (!src) return ok('');
      var img = new Image();
      img.onload = function () {
        var k = Math.min(1, 360 / Math.max(img.naturalWidth, img.naturalHeight)), cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(img.naturalWidth * k)); cv.height = Math.max(1, Math.round(img.naturalHeight * k));
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); ok(cv.toDataURL('image/jpeg', 0.6));
      };
      img.onerror = function () { ok(''); }; img.src = src;
    });
  }
  function save() {
    var u = U.me(); if (!u || !draft) return;
    var d = draft, old = d.id ? S.get(PART, d.id) : null, err = document.getElementById('mk-err');
    var f = { kind: d.kind, title: document.getElementById('mk-title').value, price: document.getElementById('mk-price').value, offer: document.getElementById('mk-offer').checked,
      condition: d.condition, category: document.getElementById('mk-cat').value, area: document.getElementById('mk-area').value, body: document.getElementById('mk-body').value,
      rulesOk: document.getElementById('mk-ok').checked, photos: d.photos.length };
    var thumbP = d.changed || !old ? thumbOf(d.photos[0]) : Promise.resolve(old.thumb || '');
    thumbP.then(function (thumb) {
      f.thumb = thumb;
      var x = old ? C.edit(PART, old, f, u, now()) : C.make(PART, f, u, now());
      if (x.error) {
        err.textContent = x.error === 'title' ? T('Give it a title.') : x.error === 'price' ? T('Type a price, or tick Open to offers.') : T('Please accept the Marketplace rules first.');
        return;
      }
      if (old && x.status === 'live' && d.changed) { x = C.edit(PART, Object.assign({}, old, { status: 'waiting' }), f, u, now()); }   // new photos: back to a keeper
      x = S.put(PART, x, U.audit(PART, old ? (x.status === 'live' ? 'lowered a price' : 'changed a listing (back to the keepers)') : 'listed something'));
      if (x.status === 'waiting' && (d.changed || !old)) S.setListingPhotos(x.id, d.photos);
      draft = null; state.fly = x.id; setTimeout(function () { state.fly = ''; }, 1600);
      H.closeModal(); if (/^#\/market\/mine$/.test(location.hash)) H.render(); else H.go('market/mine');
      H.toast(x.status === 'live' ? T('Price lowered – it stays up.') : T(U.WORDS.market.sent));
    });
  }
  function rulesDialog(edit) {
    var st = S.settings() || {}, text = st.marketRules || T(DEFAULT_RULES);
    H.modal(H.dialogHead(T('Marketplace rules'), edit ? T('Everyone who lists something accepts these first.') : '') + '<div class="dlg-body">' +
      (edit ? '<label class="field">' + T('The rules') + '<textarea id="mk-rules" rows="7" maxlength="3000">' + esc(text) + '</textarea></label>' : '<p class="mk-rules-text">' + esc(text) + '</p><p class="mk-safe">' + T(SAFE) + '</p>') + '</div>' +
      '<div class="dlg-foot">' + (edit ? '<button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn primary" data-act="market:rulessave">' + T('Save') + '</button>' : '<button class="btn primary" data-act="hub:close">' + T('Done') + '</button>') + '</div>', T('Marketplace rules'));
  }

  var acts = Object.assign(U.actions(PART), {
    list: function () { listDialog(''); },
    edit: function (el) { listDialog(el.dataset.id); },
    open: function (el) { openListing(el.dataset.id); },
    kind: function (el, ev) { if (ev) ev.preventDefault(); state.kind = el.dataset.k || ''; if (location.hash !== '#/market') H.go('market'); else H.render(); },
    cat: function (el) { state.cat = el.dataset.c || ''; H.render(); },
    pickkind: function (el) { draft.kind = el.dataset.k; document.querySelectorAll('.mk-kinds button').forEach(function (b) { var on = b.dataset.k === draft.kind; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); }); kindFields(); },
    pickcond: function (el) { draft.condition = el.dataset.c; document.querySelectorAll('.mk-cond .cm-chip').forEach(function (b) { var on = b.dataset.c === draft.condition; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); }); },
    photox: function (el) { draft.photos.splice(+el.dataset.i, 1); draft.changed = true; drawPhotos(); },
    save: save,
    done: function (el) { var x = U.finish(PART, el.dataset.id); if (x) H.toast(x.kind === 'wanted' ? T('Glad you found it!') : T('Wonderful! It shows a stamp for a day, then it goes.')); },
    rules: function () { rulesDialog(false); },
    rulestext: function () { if (U.manager()) rulesDialog(true); },
    rulessave: function () {
      var v = ((document.getElementById('mk-rules') || {}).value || '').trim();
      S.setSettings({ marketRules: v === T(DEFAULT_RULES) ? '' : v.slice(0, 3000) }, U.audit(PART, 'changed the Marketplace rules')); H.closeModal(); H.toast(T('Saved'));
    }
  });

  H.register({
    id: 'market', name: 'Marketplace', desc: 'Buy, sell and give away within the church – a keeper checks each listing first', tint: '#2E7D6B', optIn: true, roles: [], perm: 'market.view',   // roles: [] – only who js/access.js allows (never attendees)
    icon: ICON,
    stat: function () { var n = C.latest(items(), now(), 999).length; return n ? TN('{n} listing', '{n} listings', n) : T('Buy, sell and give away within the church – a keeper checks each listing first'); },
    badge: function () { return U.badge(PART); },
    todos: function () { return U.todos(PART); },
    render: render,
    actions: acts
  });
})();
