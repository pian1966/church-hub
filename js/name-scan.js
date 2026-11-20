/* Church & Trellis – names from a photo (or typed): the screens, shared by Events (Add people → a sign-up sheet) and People
 * (From a photo → visitor cards, a welcome sheet). The rules – the request to Gemini, matching names to people – are in
 * js/name-list.js. The photo is made small on the phone, sent to Google's Gemini through the church's own Firebase project
 * (Store.ai, the same switch as Ask in your own words) to read the handwriting. Church & Trellis never saves it (on Gemini's
 * free tier Google may keep requests to improve its products – docs/POPIA.md).
 * Every name is checked by the person before anything is added. POPIA: docs/POPIA.md "Events" and "Visitors from a photo".
 *
 *   NameScan.open({ title, sub, mode: 'event' | 'people', people, already(id) → bool, canNew, guests (most each may bring), done({ chosen, fresh }) })
 *     chosen: [{ ids, guests }] – people already in Church & Trellis; fresh: [{ first, last, mobile, email, guests }] – new.
 *     done returns a message for the toast (or an error message, with ok: false, to keep the window open).
 *   NameScan.addPerson(f, what)  → the new person (an Attender, in a household of their own); what goes in the audit log.
 */
var NameScan = (function () {
  'use strict';
  var H = Hub, S = Store, T = I18n.t, TN = I18n.tn, esc = H.esc;
  var CAM = 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', PIC = 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9.5a1.5 1.5 0 1 0 0-.01';
  var st = null;

  /** iPhones and iPads: their photo chooser shows the phone's own Photos, not Google Photos (Android's includes Google Photos). */
  function iPhone() { return typeof navigator !== 'undefined' && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)); }
  function aiOk() { return !!(S.aiReady && S.aiReady() && window.NameList); }
  function person(id) { return S.get('people', id); }
  function label(ids) {
    var ps = ids.map(person).filter(Boolean); if (!ps.length) return '';
    if (ps.length === 1) return H.name(ps[0]);
    var f = ps[0].familyId && S.get('families', ps[0].familyId);
    return (f ? H.familyName(f) : ps[0].lastName) + ' (' + ps.map(function (p) { return p.preferredName || p.firstName; }).join(', ') + ')';
  }
  function bind() {
    var d = document.querySelector('#modal .dialog'); if (!d) return;
    d.addEventListener('click', click);
    d.addEventListener('change', change);
    d.addEventListener('input', typed);
  }
  function show(html, wide) { H.modal(html, T('Add from a photo'), wide); bind(); }

  /* ---------- 1. the photo (or typing) ---------- */
  function open(opts) { st = { o: opts, rows: [], note: '' }; start(); }
  function start(note) {
    var o = st.o, ok = aiOk();
    var tile = function (cap, icon, big, small) {
      return ok ? '<label class="ns-tile"><input type="file" accept="image/*"' + (cap ? ' capture="environment"' : '') + ' class="ns-file" hidden>' + H.icon(icon, 30) + '<b>' + big + '</b><small>' + small + '</small></label>'
        : '<span class="ns-tile off" aria-disabled="true">' + H.icon(icon, 30) + '<b>' + big + '</b><small>' + small + '</small></span>';
    };
    show(H.dialogHead(o.title, o.sub) + '<div class="dlg-body ns">' +
      (note ? '<p class="note warn" role="alert">' + esc(note) + '</p>' : '') +
      '<p class="hint" style="margin-top:0">' + esc(o.mode === 'people' ? T('Take a photo of visitor cards or a welcome sheet. Church & Trellis reads the names (and any phone numbers and email addresses) and you check each one before they are added.') :
        T('Take a photo of the sign-up sheet. Church & Trellis reads the names, finds them in People, and you check each one before they are added.')) + '</p>' +
      '<div class="ns-tiles">' + tile(true, CAM, T('Take a photo'), o.mode === 'people' ? T('of the cards or sheet') : T('of the sheet')) + tile(false, PIC, T('Choose a photo'), T('from Google Photos or your gallery')) + '</div>' +
      (ok && iPhone() ? '<p class="hint">' + T('Photo in Google Photos? Open it there, tap Share → Save to device, then choose it here.') + '</p>' : '') +
      (ok ? '<p class="ns-privacy">' + H.icon('M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', 14) + ' ' + T('The photo goes to Google’s Gemini AI to read the handwriting. Church & Trellis doesn’t keep it.') + '</p>'
        : '<p class="ns-privacy">' + T('Reading photos needs AI. An Administrator can switch it on in Settings → Apps. Meanwhile, type the names below.') + '</p>') +
      '<details class="ns-type"' + (ok ? '' : ' open') + '><summary>' + T('Or type the names') + '</summary>' +
      '<label class="field">' + T('One name per line') + '<span class="mic-wrap"><textarea id="ns-text" rows="6" placeholder="' + esc(T('e.g. Thabo & Ayanda Nkosi')) + '"></textarea>' +
        (window.Voice ? Voice.button('#ns-text', { mode: 'append' }) : '') + '</span></label>' + (window.Voice && Voice.can() ? '<p class="hint">' + T('Tap the microphone and say a name; tap it again for the next one.') + '</p>' : '') +
      '<button class="btn" data-ns="typed">' + T('Find them') + '</button></details></div>' +
      '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button></div>');
  }

  /** The photo, made small to save data (and so Gemini answers quickly): at most 1600 pixels, as a JPEG. */
  function shrink(file) {
    return new Promise(function (ok, no) {
      if (!file || !/^image\//.test(file.type)) return no(new Error('not a picture'));
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight)), cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(img.naturalWidth * k)); cv.height = Math.max(1, Math.round(img.naturalHeight * k));
        var g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url); ok(cv.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = function () { URL.revokeObjectURL(url); no(new Error('could not read')); };
      img.src = url;
    });
  }
  /* ---------- 2. reading ---------- */
  function readPhoto(file) {
    shrink(file).then(function (url) {
      show(H.dialogHead(st.o.title, st.o.sub) + '<div class="dlg-body ns"><div class="ns-reading"><div class="ns-photo"><img src="' + url + '" alt=""><i class="ns-beam" aria-hidden="true"></i></div>' +
        '<p aria-live="polite"><b>' + T('Reading the names…') + '</b><br><span class="muted small">' + T('This takes a few seconds.') + '</span></p></div></div>' +
        '<div class="dlg-foot"><button class="btn" data-ns="back">' + T('Back') + '</button></div>');
      var mine = st.reading = {};
      var country = window.Countries && Countries.church ? (Countries.church(S.settings() || {}) || {}).name : '';
      S.ai(NameList.request({ data: url.split(',')[1], mimeType: 'image/jpeg' }, { country: country, contacts: st.o.mode === 'people' }), 60000).then(function (resp) {
        if (st.reading !== mine) return;                               // they went back, or closed the window
        var ans = NameList.read(resp), rows = NameList.rows(ans);
        if (!rows.length) return start(ans && ans.notAList ? T('That doesn’t look like a list of names. Try again, or type them.') : T('No names could be read in that photo. Try again closer up, in good light – or type them.'));
        review(rows);
      }, function (e) {
        if (st.reading !== mine) return;
        console.warn('Reading the photo', e && e.message);
        start(T('The photo couldn’t be read just now (no internet, or the AI is busy). Try again in a moment, or type the names.'));
      });
    }, function () { start(T('That file isn’t a photo. Choose a photo of the sheet.')); });
  }

  /* ---------- 3. checking every name ---------- */
  function review(rows) {
    var o = st.o, people = o.people;
    st.rows = NameList.match(rows, people).map(function (m) {
      var r = { m: m, kind: '', ids: [], other: false, guests: Math.min(m.row.guests || 0, +o.guests || 0), fresh: { first: m.row.first, last: m.row.last, mobile: m.row.mobile || '', email: m.row.email || '' } };
      if (o.mode === 'people') { if (m.status === 'sure') { r.kind = 'skip'; r.ids = m.ids; } else if (m.status === 'none') r.kind = 'new'; }
      else if (m.status === 'sure') { r.kind = 'p'; r.ids = m.ids; }
      return r;
    });
    show(H.dialogHead(o.title, o.sub) + '<div class="dlg-body ns"><p class="ns-sum" id="ns-sum"></p><ol class="ns-list">' + st.rows.map(row).join('') + '</ol>' +
      '<p class="cm-err" id="ns-err" role="alert"></p></div>' +
      '<div class="dlg-foot"><button class="btn" data-ns="back">' + T('Start again') + '</button><button class="btn primary" data-ns="save" id="ns-go"></button></div>', true);
    sum();
  }
  function done(r) { return r.kind === 'new' || r.kind === 'skip' || (r.kind === 'p' && r.ids.length); }
  function isAlready(r) { return r.kind === 'p' && r.ids.length && r.ids.every(function (id) { return st.o.already && st.o.already(id); }); }
  function pill(i, act, on, inner, extra) {
    return '<button type="button" class="ns-pill' + (on ? ' on' : '') + (extra || '') + '" aria-pressed="' + !!on + '" data-ns="' + act + '" data-i="' + i + '">' + inner + '</button>';
  }
  function row(r, i) {
    var o = st.o, m = r.m, w = m.row, ppl = o.mode === 'people', bits = [];
    m.options.forEach(function (ids, k) {
      var p = person(ids[0]), on = (r.kind === 'p' || r.kind === 'skip') && r.ids.join() === ids.join();
      var tag = ppl ? ' <small>' + T('In People') + '</small>' : o.already && ids.every(o.already) ? ' <small>' + T('Already coming') + '</small>' : '';
      bits.push('<button type="button" class="ns-pill' + (on ? ' on' : '') + '" aria-pressed="' + on + '" data-ns="opt" data-i="' + i + '" data-k="' + k + '">' + (p ? H.avatar(p, 24) : '') + '<span>' + esc(label(ids)) + tag + '</span></button>');
    });
    if (r.kind === 'p' && r.other && r.ids.length && !m.options.some(function (ids) { return ids.join() === r.ids.join(); })) bits.push(pill(i, 'other', true, H.avatar(person(r.ids[0]), 24) + '<span>' + esc(label(r.ids)) + '</span>'));
    if (!ppl) bits.push(pill(i, 'other', r.other && !r.ids.length, '<span>' + T('Someone else…') + '</span>', ' ghost'));
    if (o.canNew) bits.push(pill(i, 'new', r.kind === 'new', H.icon('M12 5v14M5 12h14', 14) + '<span>' + (ppl ? T('Add as new') : T('New visitor')) + '</span>', ' new'));
    bits.push(pill(i, 'skip', r.kind === 'skip' && !r.ids.length, '<span>' + T('Leave out') + '</span>', ' ghost'));
    var state = isAlready(r) ? 'already' : r.kind === 'new' ? 'new' : r.kind === 'skip' ? 'skip' : done(r) ? 'ok' : 'ask';
    var note = state === 'ask' ? (m.status === 'none' ? T('Not found in People') : T('Who is this?')) : state === 'already' ? T('Already coming') : '';
    return '<li class="ns-row ' + state + '" data-row="' + i + '"><div class="ns-w"><span class="ns-ink">' + esc(w.written) + '</span>' +
      (w.guests ? '<span class="tag grey">+' + w.guests + '</span>' : '') + (w.unsure ? '<span class="tag warn">' + T('Hard to read') + '</span>' : '') +
      (note ? '<small class="ns-note">' + esc(note) + '</small>' : '') + '<i class="ns-mark" aria-hidden="true"></i></div>' +
      '<div class="ns-pills">' + bits.join('') + '</div>' +
      (r.other && !ppl ? '<label class="field ns-find"><span class="sr">' + T('Choose who it is') + '</span><select class="findable" data-ns-pick="' + i + '"><option value="">' + T('Choose who it is') + '</option>' +
        o.people.slice().sort(H.byName).map(function (p) { return '<option value="' + esc(p.id) + '"' + (r.ids[0] === p.id ? ' selected' : '') + '>' + esc(H.name(p)) + '</option>'; }).join('') + '</select></label>' : '') +
      (r.kind === 'new' ? '<div class="ns-new"><div class="two"><label class="field req">' + T('First name') + '<input data-ns-f="first" data-i="' + i + '" value="' + esc(r.fresh.first) + '" maxlength="40"></label>' +
        '<label class="field req">' + T('Surname') + '<input data-ns-f="last" data-i="' + i + '" value="' + esc(r.fresh.last) + '" maxlength="60"></label></div>' +
        (ppl ? '<div class="two"><label class="field">' + T('Mobile') + '<input data-ns-f="mobile" data-i="' + i + '" type="tel" value="' + esc(r.fresh.mobile) + '" maxlength="30"></label>' +
          '<label class="field">' + T('Email') + '<input data-ns-f="email" data-i="' + i + '" type="email" value="' + esc(r.fresh.email) + '" maxlength="120"></label></div>' : '') +
        '<small class="muted">' + T('Added to People as an Attender, in a household of their own. You can add more details later.') + '</small></div>' : '') + guestsBox(r, i) + '</li>';
  }
  /** Guests this person brings (events that allow guests): a small − 2 + beside them, filled in from "+2" on the sheet. */
  function guestsBox(r, i) {
    var max = +st.o.guests || 0;
    if (!max || st.o.mode !== 'event' || !(r.kind === 'new' || (r.kind === 'p' && r.ids.length && !isAlready(r)))) return '';
    return '<div class="ns-guests"><span>' + T('Bringing guests?') + '</span><button type="button" class="icon-btn" data-ns="g" data-d="-1" data-i="' + i + '" aria-label="' + esc(T('One less')) + '"' + (r.guests ? '' : ' disabled') + '>−</button>' +
      '<output aria-live="polite">' + r.guests + '</output><button type="button" class="icon-btn" data-ns="g" data-d="1" data-i="' + i + '" aria-label="' + esc(T('One more')) + '"' + (r.guests < max ? '' : ' disabled') + '>+</button>' +
      '<small class="muted">' + esc(TN('Up to {n} guest', 'Up to {n} guests', max)) + '</small></div>';
  }
  function redraw(i) {
    var li = document.querySelector('#modal [data-row="' + i + '"]'); if (!li) return;
    li.outerHTML = row(st.rows[i], i); sum();
  }
  function counts() {
    var c = { add: 0, fresh: 0, ask: 0, guests: 0, seen: {} };
    st.rows.forEach(function (r) {
      if (r.kind === 'new' || (r.kind === 'p' && r.ids.length && !isAlready(r))) c.guests += r.guests || 0;
      if (r.kind === 'new') { c.fresh++; return; }
      if (!done(r)) { c.ask++; return; }
      if (r.kind === 'p') r.ids.forEach(function (id) { if (!c.seen[id] && !(st.o.already && st.o.already(id))) { c.seen[id] = 1; c.add++; } });
    });
    return c;
  }
  function sum() {
    var c = counts(), n = c.add + c.fresh, s = document.getElementById('ns-sum'), b = document.getElementById('ns-go');
    if (s) s.innerHTML = '<b>' + esc(TN('{n} name read', '{n} names read', st.rows.length)) + '</b>' + (c.ask ? ' · <span class="ns-ask">' + esc(TN('{n} to check', '{n} to check', c.ask)) + '</span>' : ' · ' + esc(T('all checked'))) +
      (c.fresh ? ' · ' + esc(TN('{n} new', '{n} new', c.fresh)) : '') + (c.guests && st.o.mode === 'event' ? ' · ' + esc(TN('{n} guest', '{n} guests', c.guests)) : '');
    if (b) { b.textContent = st.o.mode === 'people' ? TN('Add {n} person', 'Add {n} people', c.fresh) : TN('Add {n} person', 'Add {n} people', n); b.disabled = !n; }
  }

  /* ---------- clicks and typing ---------- */
  function click(ev) {
    var b = ev.target.closest('[data-ns]'); if (!b) return;
    var act = b.dataset.ns, i = +b.dataset.i, r = st.rows[i];
    if (act === 'typed') {
      var rows = NameList.fromText((document.getElementById('ns-text') || {}).value);
      if (!rows.length) { H.toast(T('Type at least one name.'), true); return; }
      return review(rows);
    }
    if (act === 'back') { st.reading = null; return start(); }
    if (act === 'save') return save();
    if (!r) return;
    if (act === 'g') { r.guests = Math.max(0, Math.min(+st.o.guests || 0, (r.guests || 0) + (+b.dataset.d))); redraw(i); return; }
    if (act === 'opt') { var ids = r.m.options[+b.dataset.k]; r.kind = st.o.mode === 'people' ? 'skip' : 'p'; r.ids = ids.slice(); r.other = false; }
    else if (act === 'other') { if (r.other && !r.ids.length) { r.other = false; r.kind = ''; } else { r.other = true; r.kind = 'p'; r.ids = []; } }
    else if (act === 'new') { r.kind = 'new'; r.ids = []; r.other = false; }
    else if (act === 'skip') { r.kind = 'skip'; r.ids = []; r.other = false; }
    redraw(i);
    if (act === 'new') { var f = document.querySelector('#modal [data-row="' + i + '"] [data-ns-f="first"]'); if (f && !f.value) f.focus(); }
    if (act === 'other') { var q = document.querySelector('#modal [data-row="' + i + '"] .find-in'); if (q) q.focus(); }
  }
  function change(ev) {
    var t = ev.target;
    if (t.matches && t.matches('.ns-file')) { if (t.files && t.files[0]) readPhoto(t.files[0]); return; }
    if (t.dataset && t.dataset.nsPick !== undefined) { var r = st.rows[+t.dataset.nsPick]; r.kind = 'p'; r.ids = t.value ? [t.value] : []; r.other = !!t.value || r.other; redraw(+t.dataset.nsPick); }
  }
  function typed(ev) { var t = ev.target; if (t.dataset && t.dataset.nsF) st.rows[+t.dataset.i].fresh[t.dataset.nsF] = t.value; }

  function save() {
    var err = document.getElementById('ns-err'), chosen = [], fresh = [], bad = -1;
    st.rows.forEach(function (r, i) {
      if (r.kind === 'p' && r.ids.length) chosen.push({ ids: r.ids.filter(function (id) { return !(st.o.already && st.o.already(id)); }), guests: r.guests });
      if (r.kind === 'new') {
        var f = r.fresh, first = String(f.first || '').trim(), last = String(f.last || '').trim();
        if ((!first || !last) && bad < 0) bad = i;
        fresh.push({ first: first, last: last, mobile: String(f.mobile || '').trim(), email: NameList.okEmail(f.email), guests: r.guests });
      }
    });
    if (bad >= 0) { err.textContent = T('Each new person needs a first name and a surname.'); var li = document.querySelector('#modal [data-row="' + bad + '"]'); if (li) li.scrollIntoView({ block: 'center' }); return; }
    chosen = chosen.filter(function (c) { return c.ids.length; });
    var out = st.o.done({ chosen: chosen, fresh: fresh }) || {};
    if (out.ok === false) { err.textContent = out.message || ''; return; }
    st = null; H.closeModal(); H.render();
    if (out.message) H.toast(out.message);
  }

  /** A new person from a name on a sheet or card: an Attender, in a household of their own (as Add person does), with no
   *  sign-in. Contact details only if written down (marked "not known" otherwise, as Add person allows). */
  function addPerson(f, what) {
    var who = f.first + ' ' + f.last;
    var fam = S.put('families', { name: f.last + ' family', custom: false }, 'Created a household for ' + who);
    var p = { firstName: f.first, lastName: f.last, preferredName: '', email: f.email || '', mobile: f.mobile || '', category: 'Attender', familyId: fam.id, familyRole: 'adult',
      active: true, appRole: S.defaultRole(), keyDates: [], source: 'photo' };
    if (!p.email) p.emailUnknown = true;
    if (!p.mobile) p.mobileUnknown = true;
    if (f.firstVisit) p.keyDates.push({ label: 'First visit', date: H.today() });
    return S.put('people', p, 'Added ' + who + ' (from ' + what + ')');
  }

  return { open: open, addPerson: addPerson };
})();
