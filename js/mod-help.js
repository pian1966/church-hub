/* Church & Trellis – Help: ask a question about using Church & Trellis (typed or spoken) and get an answer written for it, or
 * look through the help pages by topic. For everyone. The answers come only from the help pages in docs/help/ (plain English,
 * written for the church); the rules – finding the pages, what is sent to the AI, checking its reply – are in js/help.js.
 * With AI switched on (Settings → Apps; the same switch as Ask in your own words) Gemini writes the answer from the few pages that
 * match, in the person's language and the church's own words, and the pages it used are shown under it. Without AI (off, offline,
 * or too many questions) the matching pages are shown as they are. Nothing is stored: not the question, not the answer.
 * Routes: #/help (ask + topics), #/help/<page> (one topic's questions, e.g. #/help/me).
 * POPIA: docs/POPIA.md "Help". */
(function () {
  'use strict';
  var H = Hub, S = Store, T = I18n.t, esc = H.esc;
  var TX = function (s) { return s; };
  var ICON = 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01';
  // A few questions to tap (English: they are sent as they are; the words on the buttons are translated)
  var TRY = [TX('How do I change my phone number?'), TX('How do I tell the church I’m away?'), TX('Where do I see when I’m serving?')];
  // The help pages, read once (when Help is first opened) and kept for as long as Church & Trellis stays open
  var st = { entries: [], ready: false, loading: false, failed: false, q: '', pending: '', busy: false, res: null, times: [], n: 0 };
  // Nothing is kept: leaving Help forgets the question and its answer (and an answer still on its way is thrown away)
  window.addEventListener('hashchange', function () { if (!onHelp() && (st.q || st.res || st.busy || st.pending)) { st.q = ''; st.res = null; st.busy = false; st.pending = ''; st.n++; } });

  function pageName(file) { var p = Help.PAGES.filter(function (x) { return x[0] === file; })[0]; return p ? T(p[1]) : ''; }
  function tags() { return H.tags ? H.tags() : ['everyone']; }
  function onHelp() { return /^#\/help/.test(location.hash); }
  function again() { if (onHelp()) H.render(); }

  /** Read every help page (docs/help/*.md on the website: the browser, or the copy kept for offline). */
  function load() {
    if (st.ready || st.loading || st.failed) return;   // a failed load is tried again only when someone asks (Try again)
    st.loading = true;
    Promise.all(Help.PAGES.map(function (p) {
      return fetch('docs/help/' + p[0] + '.md', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
        .then(function (md) { return Help.parse(md, p[0]); });
    })).then(function (lists) {
      st.entries = [].concat.apply([], lists); st.ready = true; st.loading = false;
      var q = st.pending; st.pending = '';
      if (q) ask(q); else again();
    }, function () { st.loading = false; st.failed = true; st.pending = ''; again(); });
  }

  /* ---------- showing answers ---------- */
  /** **A button** → shown as a little button, in the person's language where the app knows it; [link](file.md) → just its words; *like this* → slanted. */
  function inline(s) {
    s = String(s).replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
    return s.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/).map(function (p) {
      if (/^\*\*.+\*\*$/.test(p)) {
        var raw = p.slice(2, -2), id = H.openIdByName ? H.openIdByName(raw.split(/\s*→\s*/)[0]) : '';   // "Library" or "Me → My details": tap it to go there
        return id ? '<a class="ui-name ui-go" href="#/' + esc(id) + '" title="' + esc(T('Open {name}', { name: T(raw.split(/\s*→\s*/)[0]) })) + '">' + esc(T(raw)) + '</a>' : '<span class="ui-name">' + esc(T(raw)) + '</span>';
      }
      if (/^\*[^*].*\*$/.test(p)) return '<em>' + esc(p.slice(1, -1)) + '</em>';
      return esc(p);
    }).join('');
  }
  /** The little bit of formatting the help pages use: paragraphs (a paragraph may run over several lines of the file), numbered steps,
   *  bullets, bold and slanted words. Everything else is shown as plain text. */
  function fmt(md) {
    var out = [], list = '', para = [];
    function flush() { if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } }
    function close() { flush(); if (list) { out.push('</' + list + '>'); list = ''; } }
    String(md || '').replace(/\r/g, '').split('\n').forEach(function (ln) {
      var ol = /^\s*\d+[.)]\s+(.*)$/.exec(ln), ul = /^\s*[-*•]\s+(.*)$/.exec(ln);
      if (ol || ul) { flush(); var tag = ol ? 'ol' : 'ul'; if (list !== tag) { if (list) out.push('</' + list + '>'); out.push('<' + tag + '>'); list = tag; } out.push('<li>' + inline((ol || ul)[1]) + '</li>'); }
      else if (!ln.trim()) close();
      else if (list && /^\s{2,}\S/.test(ln)) out[out.length - 1] = out[out.length - 1].replace(/<\/li>$/, ' ' + inline(ln.trim()) + '</li>');
      else { if (list) close(); para.push(ln.trim()); }
    });
    close();
    return out.join('');
  }
  /** One question and its answer from the help pages, opened by tapping the question. */
  function item(e, open) {
    var id = Help.goOf(e), name = id && H.openName ? H.openName(id) : '';
    // A button that does what the answer says (opens that screen); the topic link only when there is no screen this person can open.
    var foot = name ? '<a class="help-go" href="#/' + esc(id) + '" title="' + esc(T('Open {name}', { name: name })) + '">' + esc(T('Do this now')) + ' ›</a>'
      : '<a href="#/help/' + esc(e.page) + '">' + esc(pageName(e.page)) + '</a>';
    // "Show me": the same screen, with each button the answer names pointed out in turn (js/help-tour.js)
    var many = name ? Help.steps(e.body).filter(function (x) { return !(x.name === id || T(x.name) === name || (x.screen && T(x.screen) === name && x.target === x.name)); }).length : 0;
    var show = many && window.HelpTour ? '<button type="button" class="help-go help-show" data-act="help:show" data-eid="' + esc(e.id) + '" data-go="' + esc(id) + '">▶ ' + esc(T('Show me')) + '</button> ' : '';
    return '<details class="help-q"' + (open ? ' open' : '') + '><summary>' + esc(e.q) + '</summary><div class="help-a">' + fmt(e.body) +
      '<p class="help-from">' + show + foot + '</p></div></details>';
  }

  /* ---------- the page ---------- */
  function ask() {
    var box = document.getElementById('help-q'), q = String((box && box.value) || st.q || '').trim().slice(0, 300);
    if (!q || st.busy) return;
    st.q = q;
    if (!st.ready) { st.pending = q; load(); again(); return; }
    var tg = tags(), ranked = Help.search(st.entries, q, tg), shown = ranked.filter(function (r) { return Help.fits(r.entry, tg); }).slice(0, 4).map(function (r) { return r.entry; });
    if (!shown.length) shown = ranked.slice(0, 3).map(function (r) { return r.entry; });
    var plain = function (why) { st.res = { q: q, mode: 'plain', why: why || '', matches: shown }; st.busy = false; again(); };
    if (!S.aiReady || !S.aiReady()) return plain('');
    var times = Help.allow(st.times, Date.now());
    if (!times) return plain('limit');
    st.times = times; st.busy = true; st.res = null; var mine = ++st.n; again();
    var chosen = (Help.clear(ranked) ? Help.pick(ranked, Help.FEW_CHARS) : Help.pick(Help.everything(st.entries, ranked, tg), Help.MANY_CHARS)).map(function (r) { return r.entry; });
    var words = typeof Wording !== 'undefined' ? Wording.words(S.settings() || {}) : {};
    var body = Help.request(q, chosen, { language: I18n.name(I18n.get()), role: H.myLabel ? H.myLabel() : '', words: words });
    S.ai(body, 25000).then(function (resp) {
      if (mine !== st.n) return;   // the person has left Help meanwhile
      var c = Help.check(Help.read(resp), chosen);
      st.busy = false;
      st.res = c.found ? { q: q, mode: 'ai', text: c.text, sources: c.sources } : { q: q, mode: 'none', matches: shown };
      again();
    }, function () { if (mine === st.n) plain('failed'); });
  }

  function askBox() {
    var mic = window.Voice ? Voice.button('#help-q', { label: T('Say your question') }) : '';
    return '<section class="panel help-ask"><label class="sr" for="help-q">' + T('Type or say your question') + '</label>' +
      '<div class="help-row"><input id="help-q" type="text" maxlength="300" autocomplete="off" enterkeyhint="search" placeholder="' + esc(T('Ask a question')) + '" value="' + esc(st.q) + '">' + mic +
      '<button type="button" class="btn primary" data-act="help:ask"' + (st.busy ? ' disabled' : '') + '>' + T('Ask') + '</button></div>' +
      (!st.res && !st.busy ? '<div class="help-try">' + TRY.map(function (q) { return '<button type="button" class="help-chip" data-act="help:try" data-q="' + esc(q) + '">' + esc(T(q)) + '</button>'; }).join('') + '</div>' : '') +
      (S.aiReady && S.aiReady() ? '<p class="hint help-note">' + T('Your question and a few help pages are sent to Google’s Gemini AI to write the answer. No church records are sent – please don’t type private matters.') + '</p>' : '') +
      '</section>';
  }

  function answer() {
    var r = st.res, sec = function (inner, cls) { return '<section class="panel help-answer' + (cls ? ' ' + cls : '') + '" aria-live="polite">' + inner + '</section>'; };
    if (st.busy || st.pending) return sec('<p class="muted help-wait">' + T('Looking through the help pages…') + '</p>');
    if (!r) return '';
    if (r.mode === 'ai') {
      return sec('<div class="help-text">' + fmt(r.text) + '</div><p class="hint">' + T('Written by AI from the help pages below. If anything looks wrong, trust the help pages.') + '</p>' +
        '<h3>' + T('From the help pages') + '</h3>' + r.sources.map(function (e, i) { return item(e, i === 0 && r.sources.length === 1); }).join(''));
    }
    var lead = r.why === 'failed' ? T('The AI couldn’t be reached, so here are the help pages that match.') :
      r.why === 'limit' ? T('Too many questions just now, so here are the help pages that match. Try again in a few minutes.') : '';
    if (!r.matches.length) return sec('<p>' + T('I couldn’t find an answer to that in the help pages. Try different words, or') + ' <a href="#/messages">' + T('write to the Office') + '</a>.</p>');
    return sec((lead ? '<p class="hint">' + lead + '</p>' : '') + (r.mode === 'none' ? '<p>' + T('I couldn’t find an exact answer, but these help pages may help:') + '</p>' : '<h3>' + T('These help pages may help:') + '</h3>') +
      r.matches.map(function (e, i) { return item(e, i === 0 && r.mode === 'plain'); }).join(''));
  }

  /** The topics, as tiles: only those with something for this person. */
  function topics() {
    if (!st.ready) return st.failed ? '' : '<p class="muted">' + T('Loading…') + '</p>';
    var tg = tags(), tiles = Help.PAGES.map(function (p) {
      var n = st.entries.filter(function (e) { return e.page === p[0] && Help.fits(e, tg); }).length;
      return n ? '<a class="help-topic" href="#/help/' + p[0] + '"><b>' + esc(T(p[1])) + '</b><small>' + n + '</small></a>' : '';
    }).join('');
    return tiles ? '<section class="help-topics"><h2>' + T('Browse by topic') + '</h2><div class="help-tiles">' + tiles + '</div></section>' : '';
  }
  function topic(file) {
    var tg = tags(), list = st.entries.filter(function (e) { return e.page === file && Help.fits(e, tg); });
    return '<p class="help-back"><a href="#/help">‹ ' + T('Back to Help') + '</a></p>' +
      (list.length ? '<section class="panel help-list">' + list.map(function (e) { return item(e, false); }).join('') + '</section>' : '<p class="empty">' + T('Nothing on this topic is for your kind of access.') + '</p>');
  }

  function render(parts) {
    load();
    var file = parts && parts[0] && Help.PAGES.some(function (p) { return p[0] === parts[0]; }) ? parts[0] : '';
    var head = '<div class="page-head"><div><h1>' + (file ? esc(pageName(file)) : T('Help')) + '</h1><p class="lead">' +
      (file ? T('Questions and answers about this part of Church & Trellis.') : T('Ask a question about using Church & Trellis, or look through the help pages.')) + '</p></div></div>';
    if (file) return head + (st.ready ? topic(file) : st.failed ? failed() : '<p class="muted">' + T('Loading…') + '</p>');
    return head + askBox() + (st.failed ? failed() : '') + answer() + topics();
  }
  function failed() {
    return '<section class="panel"><p class="note bad">' + T('The help pages couldn’t be loaded. Check your internet connection and try again.') + '</p>' +
      '<button type="button" class="btn" data-act="help:retry">' + T('Try again') + '</button></section>';
  }

  H.register({
    id: 'help', name: TX('Help'), desc: TX('Ask a question about using Church & Trellis'), tint: '#2B7A9B', icon: ICON,
    stat: function () { return T('Ask a question'); },
    render: render,
    after: function () {
      var box = document.getElementById('help-q');
      if (!box) return;
      box.addEventListener('input', function () { st.q = box.value; });
      box.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); ask(); } });
    },
    actions: {
      ask: function () { ask(); },
      'try': function (el) { st.q = el.getAttribute('data-q') || ''; var box = document.getElementById('help-q'); if (box) box.value = st.q; st.res = null; ask(); },
      show: function (el) {
        var e = (st.entries || []).filter(function (x) { return x.id === el.getAttribute('data-eid'); })[0], id = el.getAttribute('data-go');
        if (!e || !id || !window.HelpTour) return;
        var name = H.openName(id), list = Help.steps(e.body).filter(function (x) { return T(x.name) !== name; });
        location.hash = '#/' + id;
        setTimeout(function () { HelpTour.start(list); }, 500);   // when the screen has been drawn
      },
      retry: function () { st.ready = false; st.failed = false; load(); again(); }
    }
  });
})();
