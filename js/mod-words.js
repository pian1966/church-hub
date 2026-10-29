/* Church Hub – Translations: anyone signed in may suggest better wording in their language; the people who check that
 * language (chosen by an Administrator) and Administrators decide. Approved wording is kept in words/{language} and used at
 * once (I18n.override), before the wording built into js/i18n.js and js/lang/<code>.js.
 * Suggestions: wordIdeas = { lang, en, text, note, personId, name, status waiting|used|declined, reply, reviewedBy, reviewedAt }.
 * Rules: firestore.rules (words, wordIdeas); a checker's languages are on their access-list entry (roles/{email}.langs). */
(function () {
  'use strict';
  var H = Hub, esc = H.esc, S = Store, T = I18n.t, TN = I18n.tn;
  var GLOBE = 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z';
  var st = { lang: '', q: '', limit: 40, fromPage: [] };

  function me() { return H.user(); }
  /** Every language apart from English: [code, name]. */
  function langs() { return I18n.LANGS.slice(1).map(function (l) { return [l[0], l[1]]; }).concat(I18n.MORE.map(function (m) { return [m[0], m[1] + (m[2] !== m[1] ? ' (' + m[2] + ')' : '')]; })); }
  function langName(code) { return I18n.name(code); }
  /** Languages this person decides on: Administrators all of them, checkers the ones the Administrator gave them. */
  function checkable() { return H.can('*') ? langs().map(function (l) { return l[0]; }) : S.reviewLangs(); }
  function canCheck(code) { return checkable().indexOf(code) >= 0; }
  function english() { return I18n.english(); }
  function plain(x) { return String(x || '').replace(/<[^>]+>/g, ''); }
  function waiting() { return S.find('wordIdeas', function (w) { return w.status === 'waiting' && canCheck(w.lang); }); }
  function wordsDoc(code) { return S.get('words', code); }
  function chosen() {
    if (!st.lang) st.lang = I18n.get() !== 'en' ? I18n.get() : (checkable()[0] || 'af');
    return st.lang;
  }
  /** Use what checkers approved, on every screen (called by the app before drawing). */
  function useApproved() { langs().forEach(function (l) { var d = wordsDoc(l[0]); I18n.override(l[0], d ? d.words : {}); }); }

  function head() {
    return '<div class="page-head"><div><h1>' + T('Translations') + '</h1><p class="lead">' + T('Help Church Hub read well in your language: suggest better wording for any text, and someone who speaks it checks it.') + '</p></div></div>';
  }
  function tabs(a) {
    var t = [['', T('Suggest')]], n = waiting().length;
    if (checkable().length) t.push(['check', T('To check') + (n ? ' (' + n + ')' : '')]);
    if (H.can('*')) t.push(['checkers', T('Who checks')]);
    if (t.length < 2) return '';
    return '<nav class="seg" aria-label="' + esc(T('Translations')) + '" style="margin-bottom:18px">' + t.map(function (x) {
      return '<a href="#/words' + (x[0] ? '/' + x[0] : '') + '" class="' + (x[0] === a ? 'on' : '') + '">' + esc(x[1]) + '</a>'; }).join('') + '</nav>';
  }
  function langSelect(id, cur, only) {
    return '<select id="' + id + '">' + langs().filter(function (l) { return !only || only.indexOf(l[0]) >= 0; }).map(function (l) {
      return '<option value="' + l[0] + '"' + (l[0] === cur ? ' selected' : '') + '>' + esc(l[1]) + '</option>'; }).join('') + '</select>';
  }

  /* ---------- suggest ---------- */
  function texts() {
    var all = english(), code = chosen(), q = st.q;
    var list = st.page && !q ? st.fromPage.filter(function (x) { return all.indexOf(x) >= 0; }) : all;   // searching looks through every text
    if (q) list = list.filter(function (x) { return H.matches(plain(x) + ' ' + plain(I18n.word(code, x)), q); });
    return list;
  }
  function listHtml() {
    var code = chosen(), list = texts(), all = english(), u = me();
    var mineWaiting = {}; S.find('wordIdeas', function (w) { return u && w.personId === u.id && w.lang === code && w.status === 'waiting'; }).forEach(function (w) { mineWaiting[w.en] = 1; });
    if (!list.length) return '<p class="muted">' + (st.page && !st.q ? T('No texts from that page – choose “All texts” to see everything.') : T('Nothing matches that.')) + '</p>';
    return '<div class="list">' + list.slice(0, st.limit).map(function (en) {
      var now = I18n.word(code, en);
      return '<div class="item"><span class="grow"><b' + (now ? '' : ' class="muted"') + '>' + esc(now ? plain(now) : T('Not translated yet – shows in English')) + '</b>' +
        '<small class="muted">' + T('English') + ': ' + esc(plain(en)) + '</small>' + (mineWaiting[en] ? '<span class="tag">' + T('You suggested new wording') + '</span>' : '') + '</span>' +
        '<button class="btn small" data-act="words:suggest" data-i="' + all.indexOf(en) + '">' + H.icon(H.ICON.edit || 'M4 20h4L19 9l-4-4L4 16v4z', 16) + T('Suggest better wording') + '</button></div>';
    }).join('') + '</div>' +
      (list.length > st.limit ? '<p><button class="btn" data-act="words:more">' + T('Show {n} more', { n: Math.min(40, list.length - st.limit) }) + '</button> <span class="muted small">' + T('{n} of {total}', { n: st.limit, total: list.length }) + '</span></p>' : '');
  }
  function renderSuggest() {
    var code = chosen(), u = me();
    I18n.load(code, function () { if (location.hash.indexOf('#/words') === 0 && chosen() === code && !document.querySelector('#modal .overlay')) refreshList(); });
    var mine = S.find('wordIdeas', function (w) { return u && w.personId === u.id; }).sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
    var STATUS = { waiting: ['', 'Waiting to be checked'], used: ['ok', 'In use – thank you'], declined: ['grey', 'Not used'] };
    return head() + tabs('') +
      '<section class="panel"><div class="row" style="flex-wrap:wrap;gap:12px;align-items:flex-end">' +
      '<label class="field" style="margin:0">' + T('Language') + langSelect('w-lang', code) + '</label>' +
      '<label class="field" style="margin:0;flex:1;min-width:200px">' + T('Find a text') + '<input id="w-q" type="search" value="' + esc(st.q) + '" placeholder="' + esc(T('Type a few words, in English or in your language')) + '"></label></div>' +
      '<nav class="seg" style="margin:14px 0 10px" aria-label="' + esc(T('Which texts')) + '">' +
      '<a href="#/words/page" class="' + (st.page ? 'on' : '') + '">' + T('On the page you were on') + ' (' + st.fromPage.filter(function (x) { return english().indexOf(x) >= 0; }).length + ')</a>' +
      '<a href="#/words/all" class="' + (st.page ? '' : 'on') + '">' + T('All texts') + '</a></nav>' +
      (I18n.isDraft(code) ? '<p class="hint" style="margin-top:0">' + T('{lang} was translated by computer, so some wording may read oddly. Your suggestions help everyone who uses it.', { lang: esc(langName(code)) }) + '</p>' : '') +
      '<div id="w-list">' + listHtml() + '</div></section>' +
      (mine.length ? '<section class="panel"><h2>' + T('Your suggestions') + '</h2><div class="list">' + mine.slice(0, 50).map(function (w) {
        var s = STATUS[w.status] || STATUS.waiting;
        return '<div class="item"><span class="grow"><b>' + esc(plain(w.text)) + '</b><small class="muted">' + esc(langName(w.lang)) + ' · ' + T('English') + ': ' + esc(plain(w.en)) + '</small>' +
          (w.reply ? '<small>' + T('Reply') + ': ' + esc(w.reply) + '</small>' : '') + '</span><span class="tag ' + s[0] + '">' + T(s[1]) + '</span>' +
          (w.status === 'waiting' ? '<button class="icon-btn ghost" data-act="words:withdraw" data-id="' + esc(w.id) + '" aria-label="' + esc(T('Take back this suggestion')) + '" title="' + esc(T('Take back this suggestion')) + '">' + H.icon(H.ICON.x, 16) + '</button>' : '') + '</div>';
      }).join('') + '</div></section>' : '');
  }
  function refreshList() { var el = document.getElementById('w-list'); if (el) el.innerHTML = listHtml(); }
  function problem(en, text) {
    var c = I18n.check(en, text);
    if (c === 'empty') return T('Write your wording first.');
    if (c === 'parts') return T('Keep the parts in curly brackets exactly as they are: {parts}', { parts: (en.match(/\{\w+\}/g) || []).join(' ') || '–' });
    if (c === 'tags') return T('Keep the bold marks exactly as in the English.');
    return '';
  }
  function suggestDialog(en) {
    var code = chosen(), now = I18n.word(code, en), parts = en.match(/\{\w+\}/g) || [], checker = canCheck(code);
    H.modal(H.dialogHead(T('Better wording'), langName(code)) + '<div class="dlg-body">' +
      '<p class="small muted" style="margin:0">' + T('English') + '</p><p style="margin-top:2px">' + esc(en) + '</p>' +
      '<p class="small muted" style="margin:0">' + T('Now') + '</p><p style="margin-top:2px">' + esc(now || T('Not translated yet – shows in English')) + '</p>' +
      '<label class="field req">' + T('Your wording') + '<textarea id="w-text" rows="3" maxlength="3000" data-own-words>' + esc(now) + '</textarea>' +
      (parts.length ? '<small>' + T('Keep the parts in curly brackets exactly as they are: {parts}', { parts: esc(parts.join(' ')) }) + ' ' + T('Church Hub puts a name, number or date there.') + '</small>' : '') +
      (/<b>/.test(en) ? '<small>' + T('Keep the bold marks exactly as in the English.') + '</small>' : '') + '</label>' +
      '<label class="field">' + T('Anything the checker should know') + '<input id="w-note" maxlength="500" placeholder="' + esc(T('e.g. this is the word we use at church')) + '"></label>' +
      H.reqKey() + '<p id="w-err" class="note bad" hidden></p></div>' +
      '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button>' +
      (checker ? '<button class="btn" data-act="words:usenow" data-i="' + english().indexOf(en) + '">' + T('Use it now') + '</button>' : '') +
      '<button class="btn primary" data-act="words:send" data-i="' + english().indexOf(en) + '">' + T('Send suggestion') + '</button></div>', T('Better wording'));
    H.markRequired();
    var ta = document.getElementById('w-text'); if (ta) { ta.focus(); ta.select(); }
  }
  /** The wording typed in the dialog, or '' after showing what is wrong. */
  function typed(en) {
    var code = chosen(), text = (document.getElementById('w-text').value || '').trim(), e = document.getElementById('w-err');
    var bad = problem(en, text) || (text === I18n.word(code, en) ? T('That is the same as the wording now.') : '');
    if (bad) { e.textContent = bad; e.hidden = false; return ''; }
    return text;
  }
  /** A checker's decision: this wording is used from now on, for everyone ('' = back to the original). */
  function apply(code, en, text, by) {
    var d = JSON.parse(JSON.stringify(wordsDoc(code) || { id: code, words: {} })); d.words = d.words || {};
    if (!text || text === I18n.word(code, en, true)) delete d.words[en]; else d.words[en] = text;
    d.updatedAt = S.now(); d.by = H.name(me());
    if (!Object.keys(d.words).length) S.remove('words', code); else S.put('words', d);
    S.audit((text ? 'Changed the ' + langName(code) + ' wording of “' + plain(en).slice(0, 80) + '”' : 'Put back the original ' + langName(code) + ' wording of “' + plain(en).slice(0, 80) + '”') + (by ? ' (suggested by ' + by + ')' : ''), 'words/' + code);
  }

  /* ---------- check ---------- */
  function renderCheck() {
    var list = waiting().sort(function (a, b) { return a.lang === b.lang ? (a.en === b.en ? (a.createdAt < b.createdAt ? -1 : 1) : (a.en < b.en ? -1 : 1)) : (a.lang < b.lang ? -1 : 1); });
    var mine = checkable(), used = mine.filter(function (c) { var d = wordsDoc(c); return d && Object.keys(d.words || {}).length; });
    var html = head() + tabs('check') + '<section class="panel"><h2>' + T('Suggestions to check') + '</h2>' +
      (H.can('*') ? '<p class="hint" style="margin-top:0">' + T('You can check every language. Where someone else checks a language, leave it to them – they speak it.') + '</p>' : '') +
      (list.length ? list.map(function (w) {
        var now = I18n.word(w.lang, w.en), bad = problem(w.en, w.text);
        return '<div class="panel inset" style="margin:10px 0"><p class="small muted" style="margin:0">' + esc(langName(w.lang)) + ' · ' + T('English') + '</p><p style="margin:2px 0 8px">' + esc(plain(w.en)) + '</p>' +
          '<p class="small muted" style="margin:0">' + T('Now') + '</p><p style="margin:2px 0 8px">' + esc(plain(now) || T('Not translated yet – shows in English')) + '</p>' +
          '<p class="small muted" style="margin:0">' + T('Suggested by {name}, {date}', { name: esc(w.name || ''), date: esc(H.fmt(String(w.createdAt || '').slice(0, 10), true)) }) + '</p><p style="margin:2px 0 8px"><b data-own-words>' + esc(plain(w.text)) + '</b></p>' +
          (w.note ? '<p class="small" data-own-words>“' + esc(w.note) + '”</p>' : '') +
          (bad ? '<p class="note bad">' + esc(bad) + '</p>' : '') +
          '<div class="btns">' + (bad ? '' : '<button class="btn primary small" data-act="words:use" data-id="' + esc(w.id) + '">' + T('Use this') + '</button>') +
          '<button class="btn small" data-act="words:edit" data-id="' + esc(w.id) + '">' + T('Change it first') + '</button>' +
          '<button class="btn small" data-act="words:decline" data-id="' + esc(w.id) + '">' + T('Not this time') + '</button></div></div>';
      }).join('') : '<p class="muted">' + T('Nothing waiting. Thank you!') + '</p>') + '</section>';
    html += '<section class="panel"><h2>' + T('Changed wording in use') + '</h2><p class="hint" style="margin-top:0">' + T('These show instead of the wording that came with Church Hub. Download them so they can also be built into the app.') + '</p>' +
      (used.length ? used.map(function (c) {
        var w = wordsDoc(c).words, all = english();
        return '<details><summary><b>' + esc(langName(c)) + '</b> · ' + TN('{n} text', '{n} texts', Object.keys(w).length) + '</summary><div class="list">' + Object.keys(w).sort().map(function (en) {
          return '<div class="item"><span class="grow"><b data-own-words>' + esc(plain(w[en])) + '</b><small class="muted">' + T('English') + ': ' + esc(plain(en)) + '</small></span>' +
            (all.indexOf(en) >= 0 ? '<button class="btn small" data-act="words:revert" data-l="' + c + '" data-i="' + all.indexOf(en) + '">' + T('Go back to the original') + '</button>' : '') + '</div>';
        }).join('') + '</div></details>';
      }).join('') + '<p style="margin-top:12px"><button class="btn" data-act="words:download">' + H.icon(H.ICON.download, 18) + T('Download the changed wording') + '</button></p>'
        : '<p class="muted">' + T('None yet.') + '</p>') + '</section>';
    return html;
  }
  function decideDialog(w) {
    H.modal(H.dialogHead(T('Not this time'), langName(w.lang)) + '<div class="dlg-body"><p>' + esc(plain(w.text)) + '</p>' +
      '<label class="field">' + T('Message for {name}', { name: esc(w.name || '') }) + '<textarea id="w-reply" rows="2" maxlength="300" placeholder="' + esc(T('e.g. thank you – we say it differently at church')) + '"></textarea></label></div>' +
      '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn primary" data-act="words:declined" data-id="' + esc(w.id) + '">' + T('Save') + '</button></div>', T('Not this time'));
  }
  function decide(w, status, reply, text) {
    var x = JSON.parse(JSON.stringify(w)); x.status = status; x.reviewedBy = H.name(me()); x.reviewedAt = S.now();
    if (reply) x.reply = reply;
    S.put('wordIdeas', x);
    if (status === 'used') apply(w.lang, w.en, text || w.text, w.name);
  }

  /* ---------- who checks (Administrators) ---------- */
  function canSignIn(p) { return p.active !== false && p.appRole && p.appRole !== 'none'; }
  function renderCheckers() {
    var people = S.find('people', canSignIn).sort(function (a, b) { return H.name(a).localeCompare(H.name(b)); });
    var checkers = S.find('people', function (p) { return (p.reviewLangs || []).length; });
    return head() + tabs('checkers') + '<section class="panel"><h2>' + T('Who checks each language') + '</h2>' +
      '<p class="hint" style="margin-top:0">' + T('Choose someone who speaks the language well. They see the suggestions for it and decide which wording to use. They can already sign in to Church Hub.') + '</p>' +
      '<div class="row" style="flex-wrap:wrap;gap:12px;align-items:flex-end"><label class="field req" style="margin:0">' + T('Person') + '<select id="w-who"><option value="">' + T('Choose…') + '</option>' +
      people.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(H.name(p)) + '</option>'; }).join('') + '</select></label>' +
      '<label class="field req" style="margin:0">' + T('Language') + langSelect('w-l2', chosen()) + '</label>' +
      '<button class="btn primary" data-act="words:addchecker">' + H.icon(H.ICON.plus, 18) + T('Add') + '</button></div>' +
      (S.isLive() ? '<p class="hint">' + T('They see the suggestions the next time they open Church Hub (or refresh the page).') + '</p>' : '') + '</section>' +
      '<section class="panel">' + (checkers.length ? '<div class="list">' + langs().map(function (l) {
        var who = checkers.filter(function (p) { return p.reviewLangs.indexOf(l[0]) >= 0; });
        if (!who.length) return '';
        return '<div class="item"><span class="grow"><b>' + esc(l[1]) + '</b><small>' + who.map(function (p) {
          return esc(H.name(p)) + ' <button class="link" data-act="words:dropchecker" data-id="' + esc(p.id) + '" data-l="' + l[0] + '" aria-label="' + esc(T('Stop {name} checking {lang}', { name: H.name(p), lang: langName(l[0]) })) + '">' + T('remove') + '</button>';
        }).join(' · ') + '</small></span></div>';
      }).join('') + '</div>' : '<p class="muted" style="margin:0">' + T('Nobody checks a language yet, so suggestions come to the Administrators.') + '</p>') + '</section>';
  }
  function setChecker(pid, code, on) {
    var p = JSON.parse(JSON.stringify(S.get('people', pid) || null)); if (!p) return;
    var l = (p.reviewLangs || []).filter(function (x) { return x !== code; }); if (on) l.push(code);
    if (l.length) p.reviewLangs = l.sort(); else delete p.reviewLangs;
    S.put('people', p, (on ? 'Can now check the ' : 'No longer checks the ') + langName(code) + ' translations: ' + H.name(p));
  }

  H.register({
    id: 'words', name: 'Translations', desc: 'Suggest better wording in your language', icon: GLOBE, tint: '#7C3AED',
    /** Shown to people using another language, the people who check one, and Administrators. */
    show: function () { return I18n.get() !== 'en' || checkable().length > 0; },
    beforeRender: useApproved,
    render: function (parts) {
      var a = parts[0] || '';
      if (a === 'page') { st.page = true; st.limit = 40; }
      else if (a === 'all') { st.page = false; st.limit = 40; }
      if (a === 'check' && checkable().length) return renderCheck();
      if (a === 'checkers' && H.can('*')) return renderCheckers();
      return renderSuggest();
    },
    after: function () {
      var q = document.getElementById('w-q'), l = document.getElementById('w-lang');
      if (q) q.addEventListener('input', function () { st.q = q.value; st.limit = 40; refreshList(); });
      if (l) l.addEventListener('change', function () { st.lang = l.value; st.limit = 40; H.render(); });
    },
    /** The texts on the page someone just left (the router keeps them while this page is open). */
    leaving: function (seen) { st.fromPage = seen; },
    stat: function () { var n = waiting().length; return n ? TN('{n} suggestion to check', '{n} suggestions to check', n) : T('Suggest better wording'); },
    todos: function () {
      var n = waiting().length;
      return n ? [{ text: TN('{n} wording suggestion to check', '{n} wording suggestions to check', n), href: '#/words/check', tag: T('Translations') }] : [];
    },
    actions: {
      suggest: function (el) { var en = english()[+el.dataset.i]; if (en) suggestDialog(en); },
      more: function () { st.limit += 40; refreshList(); },
      send: function (el) {
        var en = english()[+el.dataset.i], u = me(); if (!en || !u) return;
        var text = typed(en); if (!text) return;
        var note = (document.getElementById('w-note').value || '').trim().slice(0, 500);
        var w = { id: S.uid('wi'), lang: chosen(), en: en, text: text, personId: u.id, name: H.name(u), status: 'waiting', createdAt: S.now() };
        if (note) w.note = note;
        S.put('wordIdeas', w);
        H.closeModal(); H.render(); H.toast(T('Thank you – your suggestion has been sent to be checked.'));
      },
      usenow: function (el) {
        var en = english()[+el.dataset.i]; if (!en || !canCheck(chosen())) return;
        var text = typed(en); if (!text) return;
        apply(chosen(), en, text);
        H.closeModal(); H.render(); H.toast(T('Saved – everyone now sees the new wording.'));
      },
      withdraw: function (el) { var w = S.get('wordIdeas', el.dataset.id); if (w && w.status === 'waiting') S.remove('wordIdeas', w.id); H.render(); },
      use: function (el) { var w = S.get('wordIdeas', el.dataset.id); if (!w || !canCheck(w.lang) || problem(w.en, w.text)) return; decide(w, 'used'); H.render(); H.toast(T('Saved – everyone now sees the new wording.')); },
      edit: function (el) {
        var w = S.get('wordIdeas', el.dataset.id); if (!w || !canCheck(w.lang)) return;
        H.modal(H.dialogHead(T('Change it first'), langName(w.lang)) + '<div class="dlg-body"><p class="small muted" style="margin:0">' + T('English') + '</p><p style="margin-top:2px">' + esc(w.en) + '</p>' +
          '<label class="field req">' + T('Wording to use') + '<textarea id="w-text" rows="3" maxlength="3000" data-own-words>' + esc(w.text) + '</textarea></label>' + H.reqKey() + '<p id="w-err" class="note bad" hidden></p></div>' +
          '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn primary" data-act="words:useedited" data-id="' + esc(w.id) + '">' + T('Use this') + '</button></div>', T('Change it first'));
        H.markRequired();
      },
      useedited: function (el) {
        var w = S.get('wordIdeas', el.dataset.id); if (!w) return;
        var text = (document.getElementById('w-text').value || '').trim(), bad = problem(w.en, text), e = document.getElementById('w-err');
        if (bad) { e.textContent = bad; e.hidden = false; return; }
        decide(w, 'used', '', text); H.closeModal(); H.render(); H.toast(T('Saved – everyone now sees the new wording.'));
      },
      decline: function (el) { var w = S.get('wordIdeas', el.dataset.id); if (w && canCheck(w.lang)) decideDialog(w); },
      declined: function (el) {
        var w = S.get('wordIdeas', el.dataset.id); if (!w) return;
        decide(w, 'declined', (document.getElementById('w-reply').value || '').trim().slice(0, 300)); H.closeModal(); H.render();
      },
      revert: function (el) {
        var en = english()[+el.dataset.i], code = el.dataset.l; if (!en || !canCheck(code)) return;
        if (!H.confirmBtn(el)) return;
        apply(code, en, ''); H.render(); H.toast(T('The original wording is back.'));
      },
      download: function () {
        var out = {}; checkable().forEach(function (c) { var d = wordsDoc(c); if (d && Object.keys(d.words || {}).length) out[c] = d.words; });
        H.download('church-hub-wording-' + H.today() + '.json', JSON.stringify(out, null, 2));
      },
      addchecker: function () {
        var pid = document.getElementById('w-who').value, code = document.getElementById('w-l2').value;
        if (!pid) { H.toast(T('Choose a person first.'), true); return; }
        setChecker(pid, code, true); H.render(); H.toast(T('{name} now checks {lang}', { name: H.name(S.get('people', pid)), lang: langName(code) }));
      },
      dropchecker: function (el) { setChecker(el.dataset.id, el.dataset.l, false); H.render(); }
    }
  });
})();
