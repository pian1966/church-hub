/* Church & Trellis – Rosters: matrix, auto-fill (together/apart, away, fair turns), teams, serving groups, away dates, my serving. */
(function () {
  'use strict';
  var H = Hub, esc = H.esc, S = Store, R = RosterCore, T = I18n.t, TN = I18n.tn;
  var state = { start: 0, preview: null, gapsOpen: false, hidden: [], cols: 6, view: 'fit' };   // hidden: services (8am, 5pm…) hidden from the roster for now, with the eye; cols: how many side by side; view: 'fit' (as many as fit the screen), 'n' (cols), 'month' or 'quarter'
  var TX = function (s) { return s; };   // a text kept in a list, translated where it is shown (the language test checks it)
  var FREQ = [['weekly', TX('Whenever necessary (could be every week)')], ['monthly', TX('Once a month')], ['emergency', TX('Only now and then in emergencies')]];

  function manager() { return H.can('rosters.manage') || H.can('*'); }
  var BELL = 'M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0';

  /* ---------- telling people (Messages, js/messages.js kind 'roster') ---------- */
  /** One turn, as it is written in a message: "Reading · Sun 6 Dec, 10:00 · Morning service". */
  function turnText(a) {
    var s = S.get('services', a.serviceId), po = pos(a.positionId);
    return s && po ? po.name + ' · ' + H.fmt(s.date, true) + ', ' + s.time + ' · ' + s.name : '';
  }
  /** Who can open Church & Trellis to read it (the others are reached by email, WhatsApp or SMS as before). */
  function signsIn(pid) { return Msg.inApp([pid], S.list('people')).length > 0; }
  /** Send each person one message about their turns: note 'ask' (just put on the roster) or 'remind' (still waiting
   *  for their reply). Returns { sent, missed } – missed: people who can't sign in to Church & Trellis yet. */
  function tell(list, note) {
    var me = H.user(), out = { sent: 0, missed: 0 };
    if (!me || !H.isOn('messages')) return out;
    R.byPerson(list, S.list('services')).forEach(function (x) {
      if (x.personId === me.id) return;
      if (!signsIn(x.personId)) { out.missed++; return; }
      var lines = x.ids.map(function (id) { return turnText(S.get('assignments', id) || {}); }).filter(Boolean);
      var title = note === 'remind' ? T('Reminder: please reply about serving') : T('You’re on the roster');
      var body = (note === 'remind' ? T('You haven’t replied yet. Please accept or say you can’t make it:') : T('You’ve been asked to serve. Please accept or say you can’t make it:')) + '\n\n' + lines.join('\n');
      var m = Msg.rosterNote(note, [x.personId], x.ids, me, title, body);
      if (m.error) return;
      S.put('messages', m, (note === 'remind' ? 'Reminded someone to reply about ' : 'Told someone about ') + x.ids.length + (x.ids.length === 1 ? ' serving turn' : ' serving turns'));
      out.sent++;
    });
    return out;
  }
  /** Someone is taken off a turn (a mistake, or changed for someone else). A "You're on the roster" message they haven't
   *  opened yet is taken back quietly (if it is about other turns too, this one just drops out of it); if they have read it,
   *  or it can't be taken back, they get a short note that they're no longer needed. Nothing is sent if they had said no.
   *  Call before the turn is removed. Returns 'back', 'told' or ''. */
  function untell(a) {
    var me = H.user(); if (!me || !H.isOn('messages') || !a || a.status === 'declined' || a.personId === me.id) return '';
    var asks = S.find('messages', function (m) { return m.kind === 'roster' && (m.roster === 'ask' || m.roster === 'remind') && (m.turns || []).indexOf(a.id) >= 0 && (m.to || []).indexOf(a.personId) >= 0; });
    if (!asks.length) return '';   // never told (they can't sign in to Church & Trellis, or the message was already deleted)
    var mgr = H.can('*') || H.can('people.edit') || me.appRole === 'pastor', seen = false;
    asks.forEach(function (m) {
      if ((m.readBy || []).indexOf(a.personId) >= 0) { seen = true; return; }
      if ((m.turns || []).some(function (id) { return id !== a.id && S.get('assignments', id); })) return;   // still about other turns
      if ((m.fromId === me.id || mgr) && (m.to || []).length === 1) S.remove('messages', m.id, 'Took back a roster message (taken off the roster)');
      else seen = true;
    });
    if (!seen) return 'back';
    var m = Msg.rosterNote('off', [a.personId], [a.id], me, T('No longer needed'), T('Sorry – you’re no longer needed for this:') + '\n\n' + turnText(a));
    if (m.error) return '';
    S.put('messages', m, 'Told someone they are no longer needed for a serving turn');
    return 'told';
  }
  /** The end of a toast after someone was taken off: what happened to the message they had been sent. */
  function untoldText(r, p) {
    return r === 'told' ? ' · ' + T('{name} has been told they’re no longer needed', { name: H.name(p) }) : r === 'back' ? ' · ' + T('the message to {name} was taken back', { name: H.name(p) }) : '';
  }
  /** "3 people told in Messages" (and how many can't sign in yet). */
  function toldText(r) {
    var t = r.sent ? TN('{n} person told in Messages', '{n} people told in Messages', r.sent) : '';
    if (r.missed) t += (t ? ' · ' : '') + TN('{n} can’t sign in to Church & Trellis yet – reach them by email, WhatsApp or SMS', '{n} can’t sign in to Church & Trellis yet – reach them by email, WhatsApp or SMS', r.missed);
    return t;
  }
  /** Someone can't make a turn: the roster team hears about it in Messages (Administrators, Roster coordinators and the
   *  people chosen under Settings → Church Services). */
  function tellDeclined(a) {
    var me = H.user(); if (!me || !H.isOn('messages')) return;
    var line = turnText(a); if (!line) return;
    var nm = Msg.nameOf(person(a.personId) || me);
    var m = Msg.rosterNote('declined', S.rosterTeam(), [a.id], me, T('{name} can’t make it', { name: nm }), T('{name} can’t serve:', { name: nm }) + '\n\n' + line);
    if (!m.error) S.put('messages', m, 'Told the roster team someone can’t make a serving turn');
  }
  function person(id) { return S.get('people', id); }
  var byName = H.byName;
  /** A person's name, which opens their page when the viewer may see people (their page shows only what that person may see). */
  function nameLink(p) {
    if (!p) return '<b>' + esc(T('Someone')) + '</b>';
    var open = H.can('*') || H.can('people.view') || H.can('people.basic') || p.id === (H.user() || {}).id;
    return open ? '<a class="name-chip" href="#/people/p/' + esc(p.id) + '">' + esc(H.name(p)) + '</a>' : '<b>' + esc(H.name(p)) + '</b>';
  }
  function pos(id) { return S.get('positions', id); }
  function team(id) { return S.get('teams', id); }

  /** Away = blockout dates + approved leave from the Leave app. */
  function awayList() {
    var out = S.list('blockouts').map(function (b) { return { personId: b.personId, from: b.from, to: b.to || b.from, reason: b.reason || 'Away', id: b.id, kind: 'blockout' }; });
    var lv = S.leave();
    // The kind of leave and its reason only for the person themselves and Administrators (reasons can be about health – POPIA);
    // everyone else sees "On leave". (Live, other roles don't even receive them: see Store.rebuildLeave.)
    var me = H.user(), full = function (r) { return H.can('*') || (me && r.staffId === me.id); };
    if (lv) lv.requests.forEach(function (r) {
      if (r.status !== 'Approved') return;
      var t = full(r) && r.type ? (lv.types.filter(function (x) { return x.code === r.type; })[0] || { name: r.type }).name : '';
      var why = full(r) ? String(r.reason || '').trim() : '';
      out.push({ personId: r.staffId, from: r.start, to: r.end, reason: 'On leave' + (t || why ? ': ' + [t, why].filter(Boolean).join(' – ') : ''), kind: 'leave' });
    });
    return out;
  }
  function engineData(extra) {
    var st = S.settings(), svcs = S.list('services');
    return { people: S.list('people'), positions: orderedPositions().map(function (p) { return Object.assign({}, p, { communion: Serving.isCommunion(p) }); }), skills: S.list('skills'), services: svcs,
      assignments: S.list('assignments').concat(extra || []), groups: S.list('groups'), away: awayList(), specialSlots: specialIds(),
      noCommunion: svcs.filter(function (s) { return !Serving.hasCommunion(s, st); }).map(function (s) { return s.id; }) };
  }
  function orderedPositions() {
    var t = teams().map(function (x) { return x.id; }), all = S.list('positions');
    return all.slice().sort(function (a, b) { return t.indexOf(a.teamId) - t.indexOf(b.teamId) || all.indexOf(a) - all.indexOf(b); });
  }
  /** The departments in the church's order (Teams → ↑ ↓). */
  function teams() { return Serving.orderTeams(S.list('teams')); }
  /** How many services the roster shows side by side (one on a phone; as many as fit the screen until someone chooses). */
  function cols() { return narrow() ? 1 : state.view === 'fit' ? fitCols() : state.cols; }
  /** As many services as fit comfortably beside the Position column (about 200px each). */
  function fitCols() {
    var m = document.querySelector('main'), w = (m ? m.clientWidth : Math.min(window.innerWidth - 248, 1180)) - 64;
    return Math.max(1, Math.min(16, Math.floor((w - 180) / 200)));
  }
  /** A month or a quarter: how many months the roster shows (0 when it shows a number of services). */
  function months() { return narrow() ? 0 : state.view === 'month' ? 1 : state.view === 'quarter' ? 3 : 0; }
  function addMonths(d, k) { var x = new Date(+d.slice(0, 4), +d.slice(5, 7) - 1 + k, +d.slice(8, 10)); return x.getFullYear() + '-' + ('0' + (x.getMonth() + 1)).slice(-2) + '-' + ('0' + x.getDate()).slice(-2); }
  /** A position only runs at some services (e.g. Creche Duty at 8:00): elsewhere its cell is shown as not needed. */
  /** A special service (Good Friday…) only has the positions chosen for it; a Sunday one every position unless narrowed down. */
  function specialIds() { return Serving.specialSlots(S.settings()).map(function (x) { return x.id; }); }
  function runsAt(p, s) { return R.runsAt(p, s, specialIds()) && !noCommunionFor(p, s); }
  /** A communion role (Communion – Providing, Servers…) at a service without Holy Communion: nobody is asked. */
  function noCommunionFor(p, s) { return Serving.isCommunion(p) && !Serving.hasCommunion(s, S.settings()); }
  var EYE_OFF = 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 4l16 16';   // the eye, crossed out
  /** A hidden service's name as the roster shows it ("5pm service"). */
  function hiddenName(v) { var s = S.find('services', function (x) { return Serving.slotOf(x) === v; })[0]; return s ? s.name : slotName(v); }
  function slotName(id) { return Serving.slotLabel(id, S.settings()); }
  function narrow() { return window.innerWidth < 700; }
  function upcoming() { var t = H.today(); return S.list('services').filter(function (s) { return s.date >= t; }).sort(Serving.byWhen); }
  function inView() {
    var all = S.list('services').slice().sort(Serving.byWhen).filter(function (s) { return state.hidden.indexOf(Serving.slotOf(s)) < 0; });
    var first = all.findIndex(function (s) { return s.date >= H.today(); }); if (first < 0) first = Math.max(0, all.length - 4);
    if (months()) {   // a month or a quarter from the first service in view (it may run off the screen: the slider moves across)
      var j = Math.max(0, Math.min(all.length - 1, first + state.start)); state.start = j - first;
      if (!all.length) return [];
      var end = addMonths(all[j].date, months());
      return all.slice(j).filter(function (s) { return s.date < end; });
    }
    var n = cols(), i = Math.max(0, Math.min(Math.max(0, all.length - n), first + state.start));
    state.start = i - first;   // at the end of the list: the last few services, not one column on its own
    return all.slice(i, i + n);
  }
  /** "Go to a date": the roster from the first service on or after that day (to fill in a Sunday further ahead). */
  function goTo(d) {
    var all = S.list('services').slice().sort(Serving.byWhen), t = H.today();
    var first = all.findIndex(function (s) { return s.date >= t; }); if (first < 0) first = Math.max(0, all.length - 4);
    var i = all.findIndex(function (s) { return s.date >= d; }); if (i < 0) i = all.length - 1;
    state.start = i - first; state.preview = null; H.render();
  }
  if (typeof document !== 'undefined') document.addEventListener('change', function (e) { if (e.target && e.target.id === 'ro-date' && e.target.value) goTo(e.target.value); });
  // The slider above the roster and the roster's own scroll bar move together.
  if (typeof document !== 'undefined') {
    document.addEventListener('input', function (e) {
      if (!e.target || e.target.id !== 'ro-slide') return;
      var w = document.getElementById('ro-wrap'); if (w) w.scrollLeft = (w.scrollWidth - w.clientWidth) * e.target.value / 100;
    });
    document.addEventListener('scroll', function (e) {
      if (!e.target || e.target.id !== 'ro-wrap') return;
      var w = e.target, r = document.getElementById('ro-slide'), room = w.scrollWidth - w.clientWidth;
      if (r && document.activeElement !== r) r.value = room > 0 ? Math.round(w.scrollLeft / room * 100) : 0;
    }, true);
    window.addEventListener('resize', fitSlider);
    // "Fits your screen": a wider or narrower window shows more or fewer services.
    var fitWas = 0;
    window.addEventListener('resize', function () {
      if (state.view !== 'fit' || !document.getElementById('ro-wrap')) return;
      var n = narrow() ? 1 : fitCols(); if (n !== fitWas) { fitWas = n; H.render(); }
    });
  }
  /** The slider only shows when there is more roster than fits on the screen. */
  function fitSlider() {
    var w = document.getElementById('ro-wrap'), r = document.querySelector('.ro-slide');
    if (w && r) r.hidden = w.scrollWidth - w.clientWidth < 4;
  }

  function tabs(active) {
    var t = manager() ? [['', T('Roster')], ['teams', T('Teams')], ['services', T('Services')], ['together', T('Serving together')], ['away', T('Away dates')], ['mine', T('My serving')]] : [['mine', T('My serving')], ['together', T('Serving together')], ['away', T('Away dates')]];
    return '<nav class="seg" aria-label="' + T('Rosters') + '" style="margin-bottom:18px">' + t.map(function (x) { return '<a href="#/rosters' + (x[0] ? '/' + x[0] : '') + '" class="' + (x[0] === active ? 'on' : '') + '"' + (x[0] === active ? ' aria-current="page"' : '') + '>' + x[1] + '</a>'; }).join('') + '</nav>';
  }
  function head(title, lead, btns) { return '<div class="page-head"><div><h1>' + esc(title) + '</h1><p class="lead">' + lead + '</p></div>' + (btns ? '<div class="btns">' + btns + '</div>' : '') + '</div>'; }

  /* ---------- Holy Communion on a date (the chip under each service in the roster) ---------- */
  var CHALICE = 'M7 3h10l-1 7a4 4 0 0 1-8 0zM12 14v7M8 21h8';
  /** Communion at this service? Shown under its date; Roster coordinators tap it to change it for that day only. */
  function communionChip(s, st) {
    var on = Serving.hasCommunion(s, st), oneOff = typeof s.communion === 'boolean';
    var label = T(on ? 'Communion' : 'No communion') + (oneOff ? ' *' : '');
    var attrs = manager() ? ' data-act="rosters:communion" data-s="' + esc(s.id) + '" aria-label="' + esc(T('Holy Communion at this service: change it for this day')) + '"' : ' disabled';
    return '<button class="comm-chip' + (on ? ' on' : '') + '"' + attrs + (oneOff ? ' title="' + esc(T('Changed for this day only')) + '"' : '') + '>' + (on ? H.icon(CHALICE, 14) : '') + esc(label) + '</button>';
  }
  function communionDialog(id) {
    var s = S.get('services', id); if (!s) return;
    var st = S.settings(), usual = Serving.usualCommunion(s, st), cur = typeof s.communion === 'boolean' ? (s.communion ? 'yes' : 'no') : 'usual';
    var asked = S.find('assignments', function (a) { var p = pos(a.positionId); return a.serviceId === s.id && a.status !== 'declined' && Serving.isCommunion(p); }).length;
    var b = function (v, title, sub) {
      return '<button class="btn choice' + (cur === v ? ' on' : '') + '" aria-pressed="' + (cur === v) + '" data-act="rosters:communionset" data-s="' + esc(s.id) + '" data-v="' + v + '"><b>' + (v === 'yes' ? H.icon(CHALICE, 16) : '') + esc(title) + '</b><span class="small muted">' + esc(sub) + '</span></button>';
    };
    H.modal(H.dialogHead(T('Holy Communion'), H.fmt(s.date, true) + ' · ' + s.time + ' · ' + s.name) + '<div class="dlg-body"><div class="choices">' +
      b('usual', T('As usual'), T(usual ? 'Communion, as usual for this service' : 'No communion, as usual for this service')) +
      b('yes', T('Communion this time'), T('Ask for communion servers and providers for this day')) +
      b('no', T('No communion this time'), T('Nobody is asked for communion on this day')) + '</div>' +
      (asked ? '<p class="hint">' + esc(TN('{n} person is already on the roster for communion that day. They stay on it unless you take them off.', '{n} people are already on the roster for communion that day. They stay on it unless you take them off.', asked)) + '</p>' : '') +
      '<p class="hint">' + T('The usual pattern for each service is under Rosters → Services.') + '</p></div>', T('Holy Communion'));
  }
  function setCommunion(id, v) {
    var s = S.get('services', id); if (!s) return;
    s = Object.assign({}, s); if (v === 'usual') delete s.communion; else s.communion = v === 'yes';
    S.put('services', s, 'Holy Communion on ' + s.date + ' (' + s.time + '): ' + (v === 'usual' ? 'as usual' : v === 'yes' ? 'yes, this time' : 'no, this time'));
    H.closeModal(); H.render(); H.toast(T('Saved'));
  }

  /* ---------- matrix ---------- */
  function renderMatrix() {
    var svcs = inView(), ids = svcs.map(function (s) { return s.id; });
    var extra = state.preview ? state.preview.assignments : [];
    var all = S.list('assignments').concat(extra), away = awayList();
    var ed = engineData(), problems = R.check(ed, ids), st = S.settings();
    var html = head(T('Rosters'), T('Who is serving at each service. Families and friends who asked to serve together are kept together.'),
      '<button class="btn" data-act="rosters:move" data-d="-' + Math.max(1, svcs.length) + '" aria-label="' + T('Earlier services') + '">‹ ' + T('Earlier') + '</button><button class="btn" data-act="rosters:move" data-d="' + Math.max(1, svcs.length) + '" aria-label="' + T('Later services') + '">' + T('Later') + ' ›</button>' +
      '<label class="ro-date" title="' + esc(T('Go to a date')) + '"><input type="date" id="ro-date" value="' + esc(svcs.length ? svcs[0].date : H.today()) + '" aria-label="' + esc(T('Go to a date')) + '"></label>' +
      (state.preview ? '' : '<button class="btn primary" data-act="rosters:autofill">' + H.icon(H.ICON.sparkle, 18) + T('Fill the gaps for me') + '</button>' +
        H.menu(T('More'), ['<button data-act="rosters:print">' + H.icon(PRINTER, 16) + T('Print the roster') + '</button>', '<button data-act="rosters:emergencyfill">' + T('Emergency fill') + '</button>','<button data-act="rosters:remind">' + H.icon(BELL, 16) + T('Remind those who haven’t replied') + '</button>']))) + tabs('');
    if (state.preview) {
      var n = state.preview.assignments.length;
      html += '<div class="note info"><b>' + TN('{n} suggestion', '{n} suggestions', n) + '</b> ' + T('shown with a dashed border. Families and friends are kept together, people who are away are skipped, and turns are shared fairly.') +
        (state.preview.emergency ? ' ' + T('Emergency-only volunteers are included in these suggestions.') : '') + ' ' +
        T('Hover or tap a suggestion to see why.') + (state.preview.gaps.length ? ' <b>' + TN('{n} slot still can’t be filled', '{n} slots still can’t be filled', state.preview.gaps.length) + '</b> – ' + T('see below.') : '') +
        '<div class="btns" style="margin-top:10px"><button class="btn primary small" data-act="rosters:keep">' + T('Keep these and ask people') + '</button><button class="btn small" data-act="rosters:discard">' + T('Discard') + '</button></div></div>';
    }
    if (problems.length) html += '<div class="note warn"><b>' + T('Please check') + '</b><ul>' + problems.map(function (p) { return '<li>' + esc(p.text) + '</li>'; }).join('') + '</ul></div>';
    if (state.hidden.length) html += '<div class="ro-hidden"><span class="muted small">' + T('Hidden for now:') + '</span>' + state.hidden.map(function (v) {
      return '<button type="button" class="btn small" data-act="rosters:showslot" data-v="' + esc(v) + '" title="' + esc(T('Show the {service} again', { service: hiddenName(v) })) + '">' + H.icon(EYE_OFF, 16) + esc(hiddenName(v)) + '</button>';
    }).join('') + (state.hidden.length > 1 ? '<button type="button" class="btn small ghost" data-act="rosters:showslot" data-v="">' + T('Show all') + '</button>' : '') + '</div>';
    if (!svcs.length && state.hidden.length) return html + '<p class="empty">' + T('Every service is hidden. Tap one above to show it again.') + '</p>';
    html += '<div class="legend"><span><i style="background:var(--ok-soft)"></i>' + T('Accepted') + '</span><span><i style="background:var(--warn-soft)"></i>' + T('Waiting for a reply') + '</span><span><i style="background:#E6EEF7;border:1px dashed #7FA3CF"></i>' + T('Suggestion') + '</span><span><i style="border:1px dashed #D9A39A;background:#fff"></i>' + T('Gap') + '</span><span><i style="background:#F2EEEA"></i>' + T('Said no') + '</span></div>';
    if (!narrow()) {
      var shown = svcs.length, fit = state.view === 'fit';
      var chip = function (v, label, on) { return '<button type="button" class="ro-chip' + (on ? ' on' : '') + '" aria-pressed="' + on + '" data-act="rosters:view" data-v="' + v + '">' + label + '</button>'; };
      html += '<div class="ro-view"><div class="ro-count" role="group" aria-label="' + esc(T('Services side by side')) + '"><span class="muted small">' + T('Side by side:') + '</span>' +
        '<span class="ro-step"><button type="button" data-act="rosters:step" data-d="-1" aria-label="' + esc(T('Fewer services')) + '"' + (shown <= 1 ? ' disabled' : '') + '>−</button>' +
        '<output id="ro-n" title="' + esc(TN('Show {n} service at a time', 'Show {n} services at a time', shown)) + '">' + TN('<b>{n}</b> service', '<b>{n}</b> services', shown) + '</output>' +
        '<button type="button" data-act="rosters:step" data-d="1" aria-label="' + esc(T('More services')) + '"' + (shown >= 16 && !months() ? ' disabled' : '') + '>+</button></span>' +
        chip('fit', fit ? '✓ ' + T('Fits your screen') : T('Fit my screen'), fit) + chip('month', T('1 month'), state.view === 'month') + chip('quarter', T('1 quarter'), state.view === 'quarter') + '</div>';
    }
    if (!narrow()) html += '<label class="ro-slide"><span class="sr">' + T('Slide across to see more services') + '</span><input type="range" id="ro-slide" min="0" max="100" value="0" data-plain aria-label="' + esc(T('Slide across to see more services')) + '"></label></div>';
    html += '<div class="matrix-wrap" id="ro-wrap"><table class="matrix"' + (narrow() ? '' : ' style="min-width:' + (180 + 180 * svcs.length) + 'px"') + '><thead><tr><th scope="col">' + T('Position') + '</th>' + svcs.map(function (s) { return '<th scope="col" class="svc-col" style="' + svcStyle(s) + '">' + '<button type="button" class="icon-btn ghost svc-eye" data-act="rosters:hideslot" data-v="' + esc(Serving.slotOf(s)) + '" aria-label="' + esc(T('Hide the {service} for now', { service: s.name })) + '" title="' + esc(T('Hide the {service} for now', { service: s.name })) + '">' + H.icon(H.ICON.eye, 16) + '</button>' + esc(H.fmt(s.date)) + '<br><span class="muted small">' + esc(s.time + ' · ' + s.name) + '</span>' + communionChip(s, st) + '</th>'; }).join('') + '</tr></thead><tbody>';
    var lastTeam = '';
    // A department or position that isn't at any of these services (e.g. Creche at 8:00, communion roles without communion)
    // is left out, so the roster shows only what is needed. Someone already rostered there keeps the row.
    orderedPositions().filter(function (p) {
      return svcs.some(function (s) { return runsAt(p, s); }) || all.some(function (a) { return a.positionId === p.id && ids.indexOf(a.serviceId) >= 0; });
    }).forEach(function (p) {
      if (p.teamId !== lastTeam) { lastTeam = p.teamId; html += '<tr class="team-row"><th colspan="' + (svcs.length + 1) + '" scope="rowgroup">' + esc((team(p.teamId) || {}).name) + '</th></tr>'; }
      html += '<tr><th scope="row">' + esc(p.name) + '<small>' + T('{n} needed', { n: p.needed }) + '</small></th>' + svcs.map(function (s) {
        var here = all.filter(function (a) { return a.serviceId === s.id && a.positionId === p.id; });
        var live = here.filter(function (a) { return a.status !== 'declined'; }).length;
        var cells = here.map(function (a) {
          var who = person(a.personId), isAway = R.awayReason({ away: away }, a.personId, s.date);
          var cls = (a.source === 'auto' || a.source === 'emergency') && extra.indexOf(a) >= 0 ? 'auto' : isAway && a.status !== 'declined' ? 'away' : a.status;
          var tg = R.groupsOf(ed, a.personId, 'together').length ? H.icon(H.ICON.link, 14) : '';
          return '<button class="chip ' + cls + '" data-act="rosters:slot" data-id="' + esc(a.id) + '" title="' + esc(a.reason || (isAway ? isAway : T({ accepted: 'Accepted', pending: 'Waiting for a reply', declined: 'Said no' }[a.status] || a.status))) + '">' + esc(H.name(who)) + '<span class="tg">' + tg + '</span></button>';
        }).join('');
        if (!runsAt(p, s) && !here.length) return '<td class="na"><span class="muted small">' + esc(noCommunionFor(p, s) && R.runsAt(p, s, ed.specialSlots) ? T('No communion') : T('Not at {time}', { time: slotName(Serving.slotOf(s)) })) + '</span></td>';
        for (var i = live; i < p.needed && runsAt(p, s); i++) cells += '<button class="chip gap" data-act="rosters:assign" data-s="' + s.id + '" data-p="' + p.id + '">+ ' + T('Add someone') + '</button>';
        return '<td><div class="slot">' + cells + '</div></td>';
      }).join('') + '</tr>';
    });
    html += '</tbody></table></div>';
    setTimeout(fitSlider, 0);
    if (state.preview && state.preview.gaps.length) {
      html += '<section class="panel" style="margin-top:16px"><h2>' + T('Why some slots are still empty') + '</h2>' + state.preview.gaps.map(function (g) {
        var s = S.get('services', g.serviceId);
        return '<details style="margin:8px 0"><summary><b>' + esc((pos(g.positionId) || {}).name) + '</b>, ' + esc(H.fmt(s.date)) + ': ' + T('{n} more needed', { n: g.missing }) + '</summary><ul class="small muted">' + g.why.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul></details>';
      }).join('') + '<p class="hint">' + T('Add more people to the team, or ask someone directly with “+ Add someone”.') + '</p></section>';
    }
    return html;
  }

  /* ---------- printing the roster: A4 landscape, a term at a time, one service per sheet (RosterCore.printSheets) ---------- */
  /** Pastors, Administrators, Roster coordinators – everyone who may see the whole roster. */
  function canPrint() { return manager() || H.can('rosters.view'); }
  var PRINTER = 'M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6z';
  function printData() { return Object.assign(engineData(), { teams: S.list('teams') }); }
  function sheetName(key) { return key === 'special' ? T('Special services') : slotName(key); }
  /** "Term 1 2027" when the dates are one of the terms offered, otherwise ''. */
  function termName(from, to) {
    var t = R.terms(H.today()).concat(R.terms(addMonths(H.today(), -3)))
      .filter(function (x) { return x.from === from && x.to === to; })[0];
    return t ? T('Term {n} {year}', { n: t.n, year: t.year }) : '';
  }
  function printDialog() {
    if (!state.print) { var t = R.terms(H.today())[0]; state.print = { from: t.from, to: t.to, sheets: null, gaps: false }; }   // this term, every service
    var pr = state.print;
    H.modal(H.dialogHead(T('Print the roster'), T('On A4 landscape, one service per page. Print it, or choose “Save as PDF” as the printer to make a PDF.')) +
      '<div class="dlg-body"><div id="ro-pr"></div>' +
      '<div class="two" style="margin-top:6px"><label class="field">' + T('From') + '<input type="date" id="ro-pfrom" value="' + esc(pr.from) + '"></label>' +
      '<label class="field">' + T('To') + '<input type="date" id="ro-pto" value="' + esc(pr.to) + '"></label></div>' +
      '<label class="check"><input type="checkbox" id="ro-pgaps"' + (pr.gaps ? ' checked' : '') + '><span>' + T('Also print positions that are still empty, to fill in by hand') +
      '<small class="muted" style="display:block;font-weight:400">' + T('Otherwise only positions with names on them are printed.') + '</small></span></label></div>' +
      '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn primary" id="ro-pgo" data-act="rosters:printgo">' + H.icon(PRINTER, 18) + T('Print') + '</button></div>', T('Print the roster'));
    printParts();
  }
  /** The parts of the print window that change with the dates: the terms, which services, and how many pages. */
  function printParts() {
    var box = document.getElementById('ro-pr'), pr = state.print; if (!box || !pr) return;
    var choices = R.printChoices(printData(), pr.from, pr.to);
    var on = function (k) { return !pr.sheets || pr.sheets.indexOf(k) >= 0; };
    var sheets = R.printSheets(printData(), { from: pr.from, to: pr.to, sheets: pr.sheets, gaps: pr.gaps });
    var n = sheets.reduce(function (a, sh) { return a + R.pages(sh.services.length).length; }, 0);
    box.innerHTML = '<p style="margin:0 0 6px"><b>' + T('Which term') + '</b></p><div class="pchips">' + R.terms(H.today()).map(function (t) {
      var sel = pr.from === t.from && pr.to === t.to;
      return '<button type="button" class="pchip' + (sel ? ' on' : '') + '" aria-pressed="' + sel + '" data-act="rosters:printterm" data-f="' + t.from + '" data-t="' + t.to + '">' + (sel ? H.icon(H.ICON.check, 15) : '') +
        esc(T('Term {n} {year}', { n: t.n, year: t.year })) + ' <span class="muted small">' + esc(H.fmt(t.from) + ' – ' + H.fmt(t.to)) + '</span></button>';
    }).join('') + '</div>' +
      '<p style="margin:14px 0 6px"><b>' + T('Which services') + '</b></p>' +
      (choices.length ? '<div class="pchips">' + choices.map(function (c) {
        var o = on(c.key);
        return '<button type="button" class="pchip' + (o ? ' on' : '') + '" aria-pressed="' + o + '" data-act="rosters:printsheet" data-k="' + esc(c.key) + '">' + (o ? H.icon(H.ICON.check, 15) : '') +
          esc(sheetName(c.key)) + (c.name && c.key !== 'special' ? ' <span class="muted small">' + esc(c.name) + '</span>' : '') + ' <span class="muted small">(' + c.services + ')</span></button>';
      }).join('') + '</div>' : '<p class="muted">' + T('There are no services between these dates.') + '</p>') +
      '<p class="hint" id="ro-pn" style="margin-top:10px">' + (n ? esc(TN('{n} page', '{n} pages', n)) : esc(choices.length ? T('Nobody is on the roster for these services yet.') : '')) + '</p>';
    var go = document.getElementById('ro-pgo'); if (go) go.disabled = !n;
  }
  if (typeof document !== 'undefined') document.addEventListener('change', function (e) {
    var id = e.target && e.target.id, pr = state.print; if (!pr) return;
    if (id === 'ro-pfrom' || id === 'ro-pto') {
      var f = document.getElementById('ro-pfrom').value, t = document.getElementById('ro-pto').value;
      if (f && t && t < f) { if (id === 'ro-pfrom') t = f; else f = t; document.getElementById('ro-pfrom').value = f; document.getElementById('ro-pto').value = t; }
      if (f) pr.from = f; if (t) pr.to = t; printParts();
    } else if (id === 'ro-pgaps') { pr.gaps = e.target.checked; printParts(); }
  });
  /** The pages themselves, put into #print-only and printed (the browser's print window also saves a PDF). */
  function printRoster() {
    var pr = state.print; if (!pr) return;
    var st = S.settings() || {}, sheets = R.printSheets(printData(), { from: pr.from, to: pr.to, sheets: pr.sheets, gaps: pr.gaps, name: H.name });
    if (!sheets.length) return;
    var period = (termName(pr.from, pr.to) ? termName(pr.from, pr.to) + ' · ' : '') + H.fmt(pr.from, true) + ' – ' + H.fmt(pr.to, true);
    var html = '';
    sheets.forEach(function (sh) {
      var parts = R.pages(sh.services.length), first = sh.services[0];
      parts.forEach(function (pg, pi) {
        var svcs = sh.services.slice(pg[0], pg[1]);
        html += '<section class="ro-sheet"' + (sh.key !== 'special' && first ? ' style="' + svcStyle(first) + '"' : '') + '><div class="ro-ph"><div><h1>' + esc(T('Roster')) + ' · ' + esc(sheetName(sh.key)) +
          (sh.key !== 'special' && first ? ' <span style="font-weight:400">' + esc(first.name) + '</span>' : '') + '</h1><p>' + esc(period) +
          (parts.length > 1 ? ' · ' + esc(T('page {n} of {total}', { n: pi + 1, total: parts.length })) : '') + '</p></div><div class="ro-church">' + esc(st.churchName || '') + '</div></div>' +
          '<table><colgroup><col class="ro-pc">' + svcs.map(function () { return '<col>'; }).join('') + '</colgroup><thead><tr><th scope="col"></th>' + svcs.map(function (s) {
            return '<th scope="col">' + esc(H.fmt(s.date)) + (Serving.hasCommunion(s, st) ? ' ' + H.icon(CHALICE, 10) : '') +
              (sh.key === 'special' || s.time !== first.time ? '<small>' + esc(sh.key === 'special' ? s.name : s.time) + '</small>' : '') + '</th>';
          }).join('') + '</tr></thead><tbody>' +
          sh.teams.map(function (tm) {
            var rows = tm.rows.filter(function (r) { return pr.gaps || r.cells.slice(pg[0], pg[1]).some(function (c) { return c.names.length; }); });
            if (!rows.length) return '';
            return '<tr class="ro-team"><th colspan="' + (svcs.length + 1) + '" scope="rowgroup">' + esc(tm.name) + '</th></tr>' + rows.map(function (r) {
              return '<tr><th scope="row">' + esc(r.position.name) + '</th>' + r.cells.slice(pg[0], pg[1]).map(function (c) {
                return c.na ? '<td class="na"></td>' : '<td>' + c.names.map(function (n) { return '<span>' + esc(n) + '</span>'; }).join('') + '</td>';
              }).join('') + '</tr>';
            }).join('');
          }).join('') + '</tbody></table>' +
          '<div class="ro-pf"><span>' + H.icon(CHALICE, 10) + ' ' + esc(T('Holy Communion')) + '</span><span>' + esc(T('Printed {date}', { date: H.fmt(H.today(), true) })) + ' · Church &amp; Trellis</span></div></section>';
      });
    });
    var box = document.getElementById('print-only') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'print-only' }));
    H.closeModal();
    box.className = 'roster'; box.innerHTML = html; document.documentElement.classList.add('printing');
    var done = function () { document.documentElement.classList.remove('printing'); box.innerHTML = ''; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    S.audit('Printed the roster ' + pr.from + ' to ' + pr.to, 'assignments');
    setTimeout(function () { try { window.print(); } catch (e) { done(); H.toast(T('Printing works best from a computer.'), true); } }, 50);
  }

  function slotDialog(a) {
    var p = person(a.personId), s = S.get('services', a.serviceId), po = pos(a.positionId);
    var isPreview = state.preview && state.preview.assignments.indexOf(a) >= 0;
    var groups = S.find('groups', function (g) { return g.memberIds.indexOf(a.personId) >= 0; });
    H.modal(H.dialogHead(H.name(p), po.name + ' · ' + H.fmt(s.date, true) + ' ' + s.time) + '<div class="dlg-body">' +
      (a.reason ? '<p class="note info">' + esc(a.reason) + '</p>' : '') +
      groups.map(function (g) { return '<p class="hint">' + esc(T(g.kind === 'together' ? 'Serves together with {names}.' : 'Kept apart from {names}.', { names: g.memberIds.filter(function (m) { return m !== p.id; }).map(function (m) { return H.name(person(m)); }).join(', ') })) + '</p>'; }).join('') +
      (isPreview ? '<p class="muted">' + T('This is a suggestion. Keep the suggestions to ask them.') + '</p>' : '<p>' + T('Status') + ': <b>' + esc(T({ accepted: 'Accepted', pending: 'Waiting for a reply', declined: 'Said no' }[a.status] || '')) + '</b></p>') + '</div>' +
      '<div class="dlg-foot">' + (isPreview ? '<button class="btn" data-act="rosters:dropsug" data-id="' + esc(a.id) + '">' + T('Remove suggestion') + '</button>' :
        '<button class="btn" style="margin-right:auto" data-act="rosters:remove" data-id="' + a.id + '">' + T('Take off the roster') + '</button>' +
        '<button class="btn" data-act="rosters:change" data-id="' + a.id + '">' + T('Change person') + '</button>' +
        (a.status !== 'declined' ? '<button class="btn" data-act="rosters:status" data-id="' + a.id + '" data-s="declined">' + T('Mark “can’t make it”') + '</button>' : '') +
        (a.status !== 'accepted' ? '<button class="btn ok" data-act="rosters:status" data-id="' + a.id + '" data-s="accepted">' + T('Mark accepted') + '</button>' : '')) + '</div>', T('Roster slot'));
  }

  /** Choose who serves. replacing: the turn being changed to someone else ("Change person"); its person isn't offered. */
  function assignDialog(serviceId, positionId, emergency, replacing) {
    var s = S.get('services', serviceId), po = pos(positionId), d = engineData(), old = replacing && S.get('assignments', replacing);
    var rAttr = old ? ' data-r="' + esc(old.id) + '"' : '';
    var cands = S.find('skills', function (k) { return k.positionId === positionId; }).map(function (k) {
      var p = person(k.personId), why = R.awayReason(d, k.personId, s.date);
      if (!why && k.frequency === 'emergency' && !emergency) why = T('Only available in emergencies');
      if (!why && d.assignments.some(function (a) { return a.serviceId === serviceId && a.personId === k.personId && a.status !== 'declined'; })) why = T('Already serving that day');
      if (!why && d.assignments.some(function (a) { return a.serviceId === serviceId && a.personId === k.personId && a.status === 'declined'; })) why = T('Said no for that day');
      var apart = R.groupsOf(d, k.personId, 'apart').filter(function (g) { return g.memberIds.some(function (m) { return m !== k.personId && d.assignments.some(function (a) { return a.serviceId === serviceId && a.personId === m && a.status !== 'declined'; }); }); })[0];
      if (!why && apart) why = T('Kept apart from someone already serving');
      var tg = R.groupsOf(d, k.personId, 'together')[0];
      return { p: p, why: why, tg: tg, emergency: k.frequency === 'emergency' };
    }).filter(function (c) { return c.p && c.p.active !== false && !(old && c.p.id === old.personId); }).sort(function (a, b) { return (!!a.why - !!b.why) || H.name(a.p).localeCompare(H.name(b.p)); });
    H.modal(H.dialogHead(old ? T('Change person') : T('Add someone'), po.name + ' · ' + H.fmt(s.date, true)) + '<div class="dlg-body">' +
      (old ? '<p class="hint">' + T('Instead of {name}. They’ll be told, and the new person is asked.', { name: esc(H.name(person(old.personId))) }) + '</p>' : '') +
      (emergency ? '<p class="hint">' + T('Emergency-only volunteers are included. Use this only to cover an emergency.') + '</p>' : '') +
      (cands.length ? '<div class="list">' + cands.map(function (c) {
        return '<button class="item" data-act="rosters:pick" data-s="' + serviceId + '" data-p="' + positionId + '" data-person="' + c.p.id + '"' + rAttr + (emergency && c.emergency ? ' data-emergency="1"' : '') + (c.why ? ' disabled style="opacity:.55;cursor:not-allowed"' : '') + '>' + H.avatar(c.p, 32) +
          '<span class="grow"><b>' + esc(H.name(c.p)) + '</b><small>' + esc(c.why || (c.emergency ? T('Emergency-only volunteer') : c.tg ? T(c.tg.strength === 'must' ? 'Serves together with {names} (always) – they’ll be asked too' : 'Serves together with {names} (when possible)', { names: c.tg.memberIds.filter(function (m) { return m !== c.p.id; }).map(function (m) { return H.name(person(m)); }).join(', ') }) : T('Available'))) + '</small></span>' +
          (c.why ? '<span class="tag grey">' + T('Not available') + '</span>' : '<span class="tag ok">' + T('Available') + '</span>') + '</button>';
      }).join('') + '</div>' : '<p class="empty">' + T('No one is on this team yet. Add people under Teams.') + '</p>') + '</div>' +
      '<div class="dlg-foot"><a class="btn" href="#/rosters/teams" data-act="hub:close">' + T('Manage teams') + '</a>' +
      (emergency ? '<button class="btn" data-act="rosters:regularassign" data-s="' + serviceId + '" data-p="' + positionId + '"' + rAttr + '>' + T('Show regular volunteers') + '</button>' :
        '<button class="btn" data-act="rosters:emergencyassign" data-s="' + serviceId + '" data-p="' + positionId + '"' + rAttr + '>' + T('Show emergency helpers') + '</button>') +
      '<button class="btn" data-act="hub:close">' + T('Close') + '</button></div>', old ? T('Change person') : T('Add someone'));
  }

  /* ---------- services: look, mood, departments and positions (Rosters → Services) ---------- */
  function canLook() { return H.can('settings.manage'); }   // the look and mood are church settings (Administrators, Pastors with that tick)
  function slotById(id) { return Serving.savedSlots(S.settings()).filter(function (x) { return x.id === id; })[0]; }
  /** The colours of a service's theme, for style="…" on a card or page. */
  function themeStyle(th) { return '--svc-ink:' + th.ink + ';--svc-line:' + th.line + ';--svc-soft:' + th.soft; }
  /** The colours of the service a date belongs to (8am sunrise, 10am morning…), for its column, card or row. */
  function svcStyle(s) { return themeStyle(Serving.themeOfService(s, S.settings())); }
  function slotWhen(x) {
    if (!x.special) return x.time + (x.venue ? ' · ' + x.venue : '');
    if (x.id === 'memorial') return T('Held now and then (memorials and funerals)');
    var d = x.feast ? Serving.specialDate(x.feast, H.today()) : '';
    return d ? T('Next: {date}', { date: H.fmt(d, true) }) : T('Special service');
  }
  function moodChips(x, n) {
    var m = Serving.moodsOf(x), more = n && m.length > n ? m.length - n : 0;
    return m.length ? '<span class="moods">' + m.slice(0, n || m.length).map(function (w) { return '<span class="mood">' + esc(T(w)) + '</span>'; }).join('') + (more ? '<span class="mood">+' + more + '</span>' : '') + '</span>' : '';
  }
  /** A service as a card (Rosters → Services and Me → Serving): its picture, name, time and mood. */
  function serviceCard(x, attrs, on, foot) {
    var th = Serving.themeOf(x);
    return '<' + (attrs.indexOf('href=') >= 0 ? 'a' : 'button') + ' class="svc-card' + (on ? ' on' : '') + '" style="' + themeStyle(th) + '" ' + attrs + (attrs.indexOf('href=') < 0 ? ' aria-pressed="' + !!on + '"' : '') + '>' +
      '<span class="svc-top"><span class="svc-ico">' + H.icon(th.icon, 22) + '</span><span class="grow"><b>' + esc(x.label) + '</b><small>' + esc(slotWhen(x)) + '</small></span></span>' +
      moodChips(x, 3) + (foot ? '<small class="svc-foot">' + foot + '</small>' : '') + '</' + (attrs.indexOf('href=') >= 0 ? 'a' : 'button') + '>';
  }
  function renderServices() {
    var all = Serving.allSlots(S.settings()), gone = Serving.savedSlots(S.settings()).filter(function (x) { return x.removed; });
    var html = head(T('Services'), T('How each service looks and feels, and which departments and positions it needs. Volunteers choose from this when they offer to help.')) + tabs('services');
    function cards(list) {
      return '<div class="svc-grid">' + list.map(function (x) {
        var n = Serving.structure(x, S.list('teams'), S.list('positions')).reduce(function (a, d) { return a + d.positions.length; }, 0);
        return serviceCard(x, 'href="#/rosters/services/' + encodeURIComponent(x.id) + '"', false, esc(n ? TN('{n} position', '{n} positions', n) : T('Choose its positions')) + ' ›');
      }).join('') + '</div>';
    }
    html += '<section class="block"><h2>' + T('Sunday services') + '</h2>' + cards(all.filter(function (x) { return !x.special; })) +
      '<p class="hint" style="margin-top:10px">' + T('Add another time, or another campus or venue, under Settings → Church Services.') + '</p></section>';
    html += '<section class="block"><h2>' + T('Special services') + '</h2><p class="hint" style="margin-top:0">' + T('Each special service only has the departments and positions you switch on for it.') + '</p>' +
      cards(all.filter(function (x) { return x.special; }));
    if (canLook()) {
      var have = all.map(function (x) { return (x.feast || x.label).toLowerCase(); });
      html += '<div class="row" style="margin-top:12px;gap:8px;align-items:flex-end;max-width:520px"><label class="field grow" style="margin:0">' + T('Add a special service') +
        '<input id="sv-special" list="sv-special-list" maxlength="40" autocomplete="off" placeholder="' + esc(T('e.g. Palm Sunday')) + '"><datalist id="sv-special-list">' +
        Serving.specials(+H.today().slice(0, 4)).filter(function (x) { return have.indexOf(x.name.toLowerCase()) < 0; }).map(function (x) { return '<option value="' + esc(x.name) + '">'; }).join('') + '</datalist></label>' +
        '<button class="btn" data-act="rosters:svcadd">' + H.icon(H.ICON.plus, 16) + T('Add') + '</button></div>';
      if (gone.length) html += '<p class="hint" style="margin-top:10px">' + gone.map(function (x) { return '<button class="link" data-act="rosters:svcback" data-s="' + esc(x.id) + '">' + esc(T('Bring back {name}', { name: x.label })) + '</button>'; }).join(' · ') + '</p>';
    }
    return html + '</section>';
  }
  function renderService(id) {
    var x = slotById(id); if (!x || x.removed) return renderServices();
    var th = Serving.themeOf(x), moods = Serving.moodsOf(x), look = canLook();
    var html = '<div class="svc-page" style="' + themeStyle(th) + '"><p style="margin:0 0 10px"><a href="#/rosters/services">‹ ' + T('Services') + '</a></p>' +
      '<div class="svc-hero"><span class="svc-ico big">' + H.icon(th.icon, 30) + '</span><div><h1>' + esc(x.label) + '</h1><p class="lead" style="margin:0">' + esc(slotWhen(x)) + ' · ' + esc(T(th.name)) + '</p></div></div>';
    // Look
    html += '<section class="panel"><h2>' + T('Look') + '</h2><p class="hint" style="margin-top:0">' + T('Volunteers see this colour and picture, so each service is easy to tell apart.') + '</p><div class="theme-grid">' +
      Serving.THEMES.map(function (t) {
        return '<button class="theme-pick' + (t.id === th.id ? ' on' : '') + '" style="' + themeStyle(t) + '" aria-pressed="' + (t.id === th.id) + '"' + (look ? ' data-act="rosters:svctheme" data-s="' + esc(x.id) + '" data-t="' + t.id + '"' : ' disabled') + '>' +
          '<span class="svc-ico">' + H.icon(t.icon, 20) + '</span>' + esc(T(t.name)) + '</button>';
      }).join('') + '</div></section>';
    // Mood
    var words = Serving.MOODS.concat(moods.filter(function (m) { return Serving.MOODS.indexOf(m) < 0; }));
    html += '<section class="panel"><h2>' + T('Mood') + '</h2><p class="hint" style="margin-top:0">' + T('Tap the words that describe this service. Volunteers see them too.') + '</p><div class="pchips">' +
      words.map(function (w) {
        var on = moods.indexOf(w) >= 0;
        return '<button class="pchip' + (on ? ' on' : '') + '" aria-pressed="' + on + '"' + (look ? ' data-act="rosters:svcmood" data-s="' + esc(x.id) + '" data-m="' + esc(w) + '"' : ' disabled') + '>' + (on ? H.icon(H.ICON.check, 15) : '') + esc(T(w)) + '</button>';
      }).join('') + '</div>' +
      (look ? '<div class="row" style="margin-top:12px;gap:8px;align-items:flex-end"><label class="field grow" style="margin:0"><span class="sr">' + T('Add your own') + '</span><input id="sv-mood" maxlength="30" placeholder="' + esc(T('e.g. Bilingual')) + '"></label><button class="btn" data-act="rosters:svcmoodadd" data-s="' + esc(x.id) + '">' + H.icon(H.ICON.plus, 16) + T('Add your own') + '</button></div>'
        : '<p class="hint">' + T('Only Administrators can change the look and mood.') + '</p>') + '</section>';
    // Holy Communion: which weeks of the month (regular services; a special service has it when its communion positions are on)
    if (!x.special) html += communionPanel(x, look);
    // Departments and positions
    var tl = teams();
    html += '<section class="panel"><h2>' + T('Departments and positions') + '</h2><p class="hint" style="margin-top:0">' + T('Tap a position to switch it on or off at this service. Its volunteers stay on the team.') + '</p>' +
      (tl.length ? '<div class="dept-grid">' + tl.map(function (t) {
        var ps = S.find('positions', function (p) { return p.teamId === t.id; }); if (!ps.length) return '';
        var onN = ps.filter(function (p) { return Serving.runsAtSlot(p, x); }).length;
        return '<div class="dept' + (onN ? '' : ' off') + '"><div class="row"><b class="grow">' + esc(t.name) + '</b>' +
          '<button class="link small" data-act="rosters:svcdept" data-s="' + esc(x.id) + '" data-t="' + esc(t.id) + '" data-on="' + (onN < ps.length ? 1 : 0) + '">' + (onN < ps.length ? T('Switch all on') : T('Switch all off')) + '</button></div><div class="pchips">' +
          ps.map(function (p) {
            var on = Serving.runsAtSlot(p, x);
            return '<button class="pchip' + (on ? ' on' : '') + '" aria-pressed="' + on + '" data-act="rosters:svcpos" data-s="' + esc(x.id) + '" data-p="' + esc(p.id) + '">' + (on ? H.icon(H.ICON.check, 15) : '') + esc(p.name) +
              (Serving.isCommunion(p) ? '<span class="comm-mark" title="' + esc(T('Only when there is communion')) + '">' + H.icon(CHALICE, 13) + '</span>' : '') + '</button>';
          }).join('') + '</div></div>';
      }).join('') + '</div>' : '<p class="empty">' + T('No departments yet. Add them under Teams.') + ' <a href="#/rosters/teams">' + T('Teams') + '</a></p>') + '</section>';
    if (x.special && look) html += '<p style="margin-top:16px"><button class="btn" data-act="rosters:svcremove" data-s="' + esc(x.id) + '">' + H.icon(H.ICON.trash, 16) + T('Remove this service') + '</button></p>';
    return html + '</div>';
  }
  var commOpen = false;   // keep "Communion positions" open while tapping them
  var WEEKS = [['every', TX('Every week')], [1, TX('1st')], [2, TX('2nd')], [3, TX('3rd')], [4, TX('4th')], [5, TX('5th')], ['last', TX('Last')], ['never', TX('Never')]];
  function communionPanel(x, look) {
    var w = Serving.communionWeeks(x), next = Serving.nextCommunions(x, H.today(), 4);
    var on = function (k) { return k === 'every' ? w === 'every' : k === 'never' ? w !== 'every' && !w.length : w !== 'every' && w.indexOf(k) >= 0; };
    var roles = S.list('positions').filter(Serving.isCommunion);
    return '<section class="panel comm-panel"><h2>' + H.icon(CHALICE, 20) + T('Holy Communion') + '</h2><p class="hint" style="margin-top:0">' +
      T('Which weeks of the month is communion celebrated at this service? Communion servers and providers are only asked for then.') + '</p><div class="pchips">' +
      WEEKS.map(function (k) {
        var o = on(k[0]);
        return '<button class="pchip' + (o ? ' on' : '') + '" aria-pressed="' + o + '"' + (look ? ' data-act="rosters:svccomm" data-s="' + esc(x.id) + '" data-w="' + k[0] + '"' : ' disabled') + '>' + (o ? H.icon(H.ICON.check, 15) : '') + esc(T(k[1])) + '</button>';
      }).join('') + '</div>' +
      '<p class="comm-next">' + (next.length ? T('Next: {dates}', { dates: next.map(function (d) { return H.fmt(d, true); }).join(' · ') }) : T('No communion at this service')) + '</p>' +
      '<p class="hint">' + T('For a one-off change, such as Christmas or a fifth Sunday, tap “Communion” under that date in the roster.') + '</p>' +
      '<details class="comm-roles"' + (commOpen ? ' open' : '') + '><summary>' + T('Communion positions') + ': ' + esc(roles.length ? roles.map(function (p) { return p.name; }).join(', ') : T('none yet')) + '</summary>' +
      '<p class="hint">' + T('Tap the positions that are only needed when there is communion.') + '</p><div class="pchips">' +
      S.list('positions').map(function (p) {
        var c = Serving.isCommunion(p);
        return '<button class="pchip' + (c ? ' on' : '') + '" aria-pressed="' + c + '"' + (manager() ? ' data-act="rosters:poscomm" data-p="' + esc(p.id) + '" data-s="' + esc(x.id) + '"' : ' disabled') + '>' + (c ? H.icon(CHALICE, 14) : '') + esc(p.name) + '</button>';
      }).join('') + '</div></details></section>';
  }
  function saveSlot(id, patch, what) { S.setSettings({ serviceSlots: Serving.updateSlot(S.settings(), id, patch) }, what); H.render(); }
  function setTimes(p, times, x) { p = JSON.parse(JSON.stringify(p)); p.times = times; S.put('positions', p, 'Positions at the ' + x.label + ' service: ' + p.name + (Serving.runsAtSlot(p, x) ? ' on' : ' off')); }
  var serviceActions = {
    svctheme: function (el) { var x = slotById(el.dataset.s); saveSlot(x.id, { theme: el.dataset.t }, 'Look of the ' + x.label + ' service: ' + el.dataset.t); },
    svcmood: function (el) {
      var x = slotById(el.dataset.s), m = Serving.moodsOf(x), w = el.dataset.m;
      saveSlot(x.id, { moods: m.indexOf(w) >= 0 ? m.filter(function (y) { return y !== w; }) : m.concat([w]) }, 'Mood of the ' + x.label + ' service');
    },
    svcmoodadd: function (el) {
      var x = slotById(el.dataset.s), m = Serving.moodsOf(x), w = document.getElementById('sv-mood').value.trim().slice(0, 30);
      if (!w) { H.toast(T('Type a word first'), true); return; }
      if (m.some(function (y) { return y.toLowerCase() === w.toLowerCase(); })) { H.toast(T('That one is already there'), true); return; }
      saveSlot(x.id, { moods: m.concat([w]) }, 'Mood of the ' + x.label + ' service');
    },
    svccomm: function (el) {
      var x = slotById(el.dataset.s), w = el.dataset.w, c = Serving.toggleCommunionWeek(x, /^\d$/.test(w) ? +w : w);
      saveSlot(x.id, { communion: c }, 'Holy Communion at the ' + x.label + ' service: ' + (c === 'every' ? 'every week' : c.length ? 'weeks ' + c.join(', ') : 'never'));
    },
    poscomm: function (el) {
      var p = JSON.parse(JSON.stringify(pos(el.dataset.p))); p.communion = !Serving.isCommunion(p); commOpen = true;
      S.put('positions', p, (p.communion ? 'Only rostered when there is communion: ' : 'Rostered whether or not there is communion: ') + p.name); H.render();
    },
    svcpos: function (el) { var x = slotById(el.dataset.s), p = pos(el.dataset.p); setTimes(p, Serving.toggleTimes(p, x.id, S.settings()), x); H.render(); },
    svcdept: function (el) {
      var x = slotById(el.dataset.s), want = el.dataset.on === '1';
      S.find('positions', function (p) { return p.teamId === el.dataset.t; }).forEach(function (p) {
        if (Serving.runsAtSlot(p, x) !== want) setTimes(p, Serving.toggleTimes(p, x.id, S.settings()), x);
      });
      H.render();
    },
    svcremove: function (el) { var x = slotById(el.dataset.s); if (!H.confirmBtn(el)) return; S.setSettings({ serviceSlots: Serving.removeSlot(S.settings(), x.id) }, 'Removed the special service ' + x.label); H.go('rosters/services'); },
    svcadd: function () {
      var n = document.getElementById('sv-special').value.trim().slice(0, 40);
      if (!n) { H.toast(T('Type the name of the service first'), true); return; }
      if (Serving.findSpecial(n, S.settings())) { H.toast(T('That one is already there'), true); return; }
      var list = Serving.addSpecialSlot(S.settings(), n), x = Serving.findSpecial(n, { serviceSlots: list });
      S.setSettings({ serviceSlots: list }, 'Added the special service ' + n);
      H.go('rosters/services/' + encodeURIComponent(x.id)); H.toast(T('Added – now choose its departments and positions'));
    },
    svcback: function (el) { var x = slotById(el.dataset.s); saveSlot(x.id, { removed: false }, 'Brought back the ' + x.label + ' service'); H.toast(T('Saved')); }
  };
  window.RosterServices = { serviceCard: serviceCard, themeStyle: themeStyle, svcStyle: svcStyle };

  /* ---------- teams ---------- */
  /** Join a team to another (e.g. a second Music department): its positions, people and turns move across. */
  function mergeDialog(t) {
    if (!t) return;
    var others = teams().filter(function (x) { return x.id !== t.id; });
    var same = others.filter(function (x) { return x.name.trim().toLowerCase() === t.name.trim().toLowerCase(); })[0];
    H.modal(H.dialogHead(T('Join with another team'), t.name) + '<div class="dlg-body">' +
      '<label class="field"><span>' + esc(T('Join {team} to', { team: t.name })) + '</span><select id="tm-to" data-plain>' + others.map(function (x) { return '<option value="' + esc(x.id) + '"' + (same && same.id === x.id ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select></label>' +
      '<p class="hint">' + esc(T('Its positions, the people on them and their turns on the roster move across. A position with the same name is joined to the one already there, so nobody is listed twice. Then {team} is removed.', { team: t.name })) + '</p></div>' +
      '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn primary" data-act="rosters:teammergego" data-id="' + esc(t.id) + '">' + T('Join them') + '</button></div>', T('Join with another team'));
  }
  function renderTeams() {
    var html = head(T('Teams'), T('Who can serve in each position, and how often they’d like to.'), '<button class="btn" data-act="rosters:newteam">' + H.icon(H.ICON.plus, 18) + T('New team') + '</button>') + tabs('teams');
    html += renderOffers();
    var add = window.Serving ? Serving.missing(S.list('teams'), S.list('positions')) : { teams: [], positions: [] };
    var ren = add.renames || [];
    if ((add.positions.length || ren.length) && (H.can('*') || H.can('rosters.manage'))) html += '<div class="note info" style="margin-bottom:16px"><b>' + T('Set up the church’s departments.') + '</b> ' +
      (add.teams.length ? T('Adds {d} and {p} as in Elvanto (Service Leading, Extra Slot, Hospitality, Music, Teens, Children, Creche, Memorial Service), each marked with the services it runs at.', { d: TN('{n} department', '{n} departments', add.teams.length), p: TN('{n} position', '{n} positions', add.positions.length) }) + ' '
        : add.positions.length ? T('Adds {p} as in Elvanto, each marked with the services it runs at.', { p: TN('{n} position', '{n} positions', add.positions.length) }) + ' ' : '') +
      ren.map(function (r) { return T('{old} becomes {new}; its people and turns stay.', { old: esc(r.from), new: esc(r.to) }) + ' '; }).join('') +
      (ren.length ? T('Nothing is removed.') : T('Nothing here is changed or removed.')) + ' ' +
      '<button class="btn small primary" data-act="rosters:setupdepts">' + T('Add them') + '</button></div>';
    var tl = teams();
    html += '<div class="grid2">' + tl.map(function (t, ti) {
      var ps = S.find('positions', function (p) { return p.teamId === t.id; });
      var tools = manager() ? '<span class="team-tools"><button type="button" class="icon-btn ghost" data-act="rosters:teammove" data-id="' + esc(t.id) + '" data-d="-1"' + (ti ? '' : ' disabled') + ' aria-label="' + esc(T('Move {team} up', { team: t.name })) + '" title="' + esc(T('Move up')) + '">↑</button>' +
        '<button type="button" class="icon-btn ghost" data-act="rosters:teammove" data-id="' + esc(t.id) + '" data-d="1"' + (ti < tl.length - 1 ? '' : ' disabled') + ' aria-label="' + esc(T('Move {team} down', { team: t.name })) + '" title="' + esc(T('Move down')) + '">↓</button>' +
        H.menu('⋯', [tl.length > 1 ? '<button data-act="rosters:teammerge" data-id="' + esc(t.id) + '">' + T('Join with another team…') + '</button>' : '',
          ps.length ? '' : '<button class="menu-danger" data-act="rosters:teamdel" data-id="' + esc(t.id) + '">' + T('Delete team') + '</button>'], 'row-menu', T('More for {team}', { team: t.name })) + '</span>' : '';
      return '<section class="panel"><h2 class="team-h"><span class="grow">' + esc(t.name) + '</span>' + tools + '</h2>' + ps.map(function (p) {
        var ks = S.find('skills', function (k) { return k.positionId === p.id; }).sort(function (a, b) { return byName(person(a.personId), person(b.personId)); });
        return '<div style="margin:12px 0"><div class="row pos-head"><span class="grow"><b>' + esc(p.name) + '</b><span class="muted small">' + (manager() ? '<span class="need-step"><button type="button" data-act="rosters:needed" data-p="' + p.id + '" data-d="-1"' + (p.needed > 1 ? '' : ' disabled') + ' aria-label="' + esc(T('One fewer for {position}', { position: p.name })) + '">−</button><button type="button" data-act="rosters:needed" data-p="' + p.id + '" data-d="1"' + (p.needed < 20 ? '' : ' disabled') + ' aria-label="' + esc(T('One more for {position}', { position: p.name })) + '">+</button></span>' : '') + T('{n} per service', { n: p.needed }) + (p.times && p.times.indexOf('none') >= 0 ? ' · ' + esc(T('Not at any service')) : p.times && p.times.length && p.times.length < Serving.allSlots(S.settings()).length ? ' · ' + esc(T('{times} only', { times: p.times.map(slotName).join(', ') })) : '') + '</span></span><button class="btn small" data-act="rosters:addmember" data-p="' + p.id + '">' + H.icon(H.ICON.plus, 16) + T('Add') + '</button></div>' +
          (ks.length ? '<div class="list" style="margin-top:8px">' + ks.map(function (k) {
            var pp = person(k.personId);
            return '<div class="item">' + H.avatar(pp, 30) + '<span class="grow">' + nameLink(pp) + '<small>' + esc(freqText(k.frequency)) + '</small></span><button class="icon-btn ghost" data-act="rosters:unskill" data-id="' + k.id + '" aria-label="' + esc(T('Remove {name} from {position}', { name: H.name(pp), position: p.name })) + '">' + H.icon(H.ICON.x, 18) + '</button></div>';
          }).join('') + '</div>' : '<p class="hint">' + T('No one yet.') + '</p>') + '</div>';
      }).join('') + '<button class="btn small" data-act="rosters:newpos" data-t="' + t.id + '">' + H.icon(H.ICON.plus, 16) + T('Add a position') + '</button></section>';
    }).join('') + '</div>';
    return html;
  }

  /* ---------- offers to serve (from Me → Serving) ---------- */
  function waitingOffers() { return S.find('serveOffers', function (o) { return o.status === 'waiting'; }).sort(function (a, b) { return (a.createdAt || '') < (b.createdAt || '') ? -1 : 1; }); }
  function freqText(f) {
    var match = FREQ.filter(function (x) { return x[0] === f; })[0];
    if (match) return T(match[1]);
    return T(f === 'occasional' ? 'Now and then' : 'Every 2 weeks');
  }
  function freqName(f) { return freqText(f).toLowerCase(); }
  function offerText(o) {
    var po = pos(o.positionId), where = po ? po.name + ' (' + ((team(po.teamId) || {}).name || '') + ')' : T('a position that has been removed');
    var k = S.find('skills', function (x) { return x.personId === o.personId && x.positionId === o.positionId; })[0];
    if (o.kind === 'stop') return T('would like to stop serving on {where}', { where: where });
    var at = function (t) { return t && t.length ? ' ' + T('at {times}', { times: t.map(slotName).join(', ') }) : ''; };
    if (o.kind === 'change') return T('would like to serve on {where}', { where: where }) + ' ' + freqName(o.frequency) + at(o.times) + (k ? ' (' + T('now {how}', { how: freqName(k.frequency) + at(k.times) }) + ')' : '');
    return T('offers to help on {where}', { where: where }) + ', ' + freqName(o.frequency) + at(o.times);
  }
  function renderOffers() {
    var list = waitingOffers();
    if (!list.length) return '';
    return '<section class="panel" style="margin-bottom:16px"><h2>' + T('Offers to serve') + ' <span class="tag warn">' + list.length + '</span></h2>' +
      '<p class="hint" style="margin-top:0">' + T('People asked from their own “Me” page. Yes updates the team straight away; Not now sends them a short reply.') + '</p><div class="list">' + list.map(function (o) {
        var p = person(o.personId);
        return '<div class="item offer-item">' + H.avatar(p, 32) + '<span class="grow"><b>' + esc(H.name(p) || T('Someone')) + '</b><small>' + esc(offerText(o)) + (o.note ? ' · “' + esc(o.note) + '”' : '') + ' · ' + esc(H.fmt((o.createdAt || '').slice(0, 10))) + '</small></span>' +
          '<span class="btns"><button class="btn small" data-act="rosters:offerno" data-id="' + esc(o.id) + '">' + T('Not now') + '</button><button class="btn small ok" data-act="rosters:offeryes" data-id="' + esc(o.id) + '">' + T('Yes') + '</button></span></div>';
      }).join('') + '</div></section>';
  }

  /* ---------- serving together / apart ---------- */
  function renderTogether() {
    var gs = S.list('groups'), me = H.user();
    var mine = manager() ? gs : gs.filter(function (g) { return g.memberIds.indexOf(me.id) >= 0; });
    var html = head(T('Serving together'), T('Families and friends who want to serve at the same service – and people who mustn’t serve at the same time.'),
      '<button class="btn primary" data-act="rosters:group" data-kind="together">' + H.icon(H.ICON.link, 18) + (manager() ? T('Serve together') : T('Ask to serve with someone')) + '</button>' +
      (manager() ? '<button class="btn" data-act="rosters:group" data-kind="apart">' + H.icon(H.ICON.split, 18) + T('Keep apart') + '</button>' : '')) + tabs('together');
    html += '<div class="grid2" style="margin-bottom:16px"><div class="note info" style="margin:0"><b>' + H.icon(H.ICON.link, 16) + ' ' + T('Serve together') + '</b><br>' + T('“Always” = rostered together or not at all (e.g. a family sharing a car). “When possible” = together when it works, otherwise separately.') + '</div>' +
      '<div class="note warn" style="margin:0"><b>' + H.icon(H.ICON.split, 16) + ' ' + T('Keep apart') + '</b><br>' + T('Never rostered at the same service – e.g. parents taking turns with a baby.') + '</div></div>';
    html += mine.length ? '<div class="list">' + mine.map(function (g) {
      return '<div class="item wrap-phone"><span class="ic" style="width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:' + (g.kind === 'together' ? '#E6EEF7;color:#1E4E8C' : '#FFF1CC;color:#7A5300') + '">' + H.icon(g.kind === 'together' ? H.ICON.link : H.ICON.split) + '</span>' +
        '<span class="grow"><b>' + esc(g.name) + '</b><span class="chip-row">' + g.memberIds.map(person).filter(Boolean).sort(byName).map(nameLink).join('') + '</span>' + (g.note ? '<small>' + esc(g.note) + '</small>' : '') + '</span>' +
        '<span class="tag ' + (g.kind === 'together' ? '' : 'warn') + '" style="--c:#2F6FB3">' + T(g.kind === 'apart' ? 'Keep apart' : g.strength === 'must' ? 'Always together' : 'Together when possible') + '</span>' +
        (manager() || g.memberIds.indexOf(me.id) >= 0 ? '<button class="btn small" data-act="rosters:group" data-id="' + g.id + '">' + T('Edit') + '</button>' : '') + '</div>';
    }).join('') + '</div>' : '<p class="empty">' + T('You’re not in a serving group yet. Ask to serve with family or a friend, and the roster will keep you together.') + '</p>';
    return html;
  }

  function groupDialog(g, kind) {
    var isNew = !g; g = g || { name: '', kind: kind || 'together', strength: 'prefer', memberIds: manager() ? [] : [H.user().id], note: '' };
    var people = S.find('people', function (p) { return p.active !== false && p.familyRole !== 'child' || (p.familyRole === 'child' && S.find('skills', function (k) { return k.personId === p.id; }).length); })
      .sort(function (a, b) { return H.name(a).localeCompare(H.name(b)); });
    var fams = S.list('families');
    H.modal(H.dialogHead(isNew ? (g.kind === 'apart' ? T('Keep people apart') : T('Serve together')) : T('Edit {name}', { name: g.name }), g.kind === 'apart' ? T('They will never be rostered at the same service.') : T('The roster will put them at the same service.')) +
      '<div class="dlg-body"><input type="hidden" id="gr-id" value="' + esc(g.id || '') + '"><input type="hidden" id="gr-kind" value="' + g.kind + '">' +
      '<label class="field">' + T('Name') + '<input id="gr-name" value="' + esc(g.name) + '" placeholder="' + (g.kind === 'apart' ? T('e.g. Megan & David (baby at home)') : T('e.g. Naidoo family, or Sam & Kavi')) + '"></label>' +
      (g.kind === 'together' ? '<fieldset class="field" style="border:0;padding:0;margin:0 0 14px"><legend style="margin-bottom:6px">' + T('How important is it?') + '</legend>' +
        '<label class="check"><input type="radio" name="gr-str" value="must"' + (g.strength === 'must' ? ' checked' : '') + '><span><b>' + T('Always together') + '</b><br><span class="muted small">' + T('If one can’t serve, none of them are rostered that week.') + '</span></span></label>' +
        '<label class="check"><input type="radio" name="gr-str" value="prefer"' + (g.strength !== 'must' ? ' checked' : '') + '><span><b>' + T('Together when possible') + '</b><br><span class="muted small">' + T('Otherwise they can be rostered separately.') + '</span></span></label></fieldset>' : '') +
      (manager() && fams.length ? '<label class="field">' + T('Quick add a household') + '<select class="findable" id="gr-fam"><option value="">' + T('Choose a household…') + '</option>' + fams.slice().sort(function (a, b) { return H.familyName(a).localeCompare(H.familyName(b)); }).map(function (f) { return '<option value="' + f.id + '">' + esc(H.familyName(f)) + '</option>'; }).join('') + '</select></label>' : '') +
      '<fieldset class="field" style="border:0;padding:0;margin:0"><legend style="margin-bottom:6px">' + T('Who') + '</legend><div style="max-height:240px;overflow:auto;border:1px solid var(--line);border-radius:12px;padding:4px 12px">' +
      people.map(function (p) { return '<label class="check"><input type="checkbox" class="gr-m" value="' + p.id + '"' + (g.memberIds.indexOf(p.id) >= 0 ? ' checked' : '') + '>' + esc(H.name(p)) + (p.familyRole === 'child' ? ' <span class="muted small">' + T('(teen)') + '</span>' : '') + '</label>'; }).join('') + '</div></fieldset>' +
      '<label class="field" style="margin-top:14px">' + T('Note') + '<input id="gr-note" value="' + esc(g.note || '') + '" placeholder="' + T('Why – helps whoever does the roster') + '"></label><p id="gr-err" class="note bad" hidden></p></div>' +
      '<div class="dlg-foot">' + (!isNew ? '<button class="btn" style="margin-right:auto" data-act="rosters:delgroup" data-id="' + g.id + '">' + T('Delete') + '</button>' : '') + '<button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn save" data-act="rosters:savegroup">' + T('Save') + '</button></div>', T('Serving together'));
    var famSel = document.getElementById('gr-fam');
    if (famSel) famSel.addEventListener('change', function () {
      var ids = S.find('people', function (p) { return p.familyId === famSel.value; }).map(function (p) { return p.id; });
      document.querySelectorAll('.gr-m').forEach(function (b) { if (ids.indexOf(b.value) >= 0) b.checked = true; });
      var nm = document.getElementById('gr-name'); if (!nm.value) nm.value = H.familyName(S.get('families', famSel.value));
    });
  }

  /* ---------- away dates ---------- */
  function renderAway() {
    var t = H.today(), me = H.user();
    var list = awayList().filter(function (a) { return a.to >= t && (manager() || a.personId === me.id); }).sort(function (a, b) { return a.from < b.from ? -1 : 1; });
    return head(T('Away dates'), T('Dates people can’t serve. Approved leave from the Leave app is included automatically.'), '<button class="btn primary" data-act="rosters:addaway">' + H.icon(H.ICON.plus, 18) + T('Add away dates') + '</button>') + tabs('away') +
      (list.length ? '<div class="list">' + list.map(function (a) {
        var p = person(a.personId);
        return '<div class="item">' + H.avatar(p, 32) + '<span class="grow"><b>' + esc(H.name(p)) + '</b><small>' + esc(H.fmt(a.from) + (a.to !== a.from ? ' – ' + H.fmt(a.to, true) : '') + ' · ' + reasonText(a.reason)) + '</small></span>' +
          (a.kind === 'leave' ? '<span class="tag" style="--c:#E8590C">' + T('From Leave') + '</span>' : (manager() || a.personId === me.id ? '<button class="icon-btn ghost" data-act="rosters:delaway" data-id="' + a.id + '" aria-label="' + T('Remove away dates') + '">' + H.icon(H.ICON.trash, 18) + '</button>' : '')) + '</div>';
      }).join('') + '</div>' : '<p class="empty">' + T('No one is away soon.') + '</p>');
  }
  /** "Away: holiday" → the word Away in the chosen language; what people typed stays as typed. */
  function reasonText(r) { var m = /^(Away|On leave)(.*)$/.exec(r || ''); return m ? T(m[1]) + m[2] : r; }

  /* ---------- my serving ---------- */
  function renderMine() {
    var me = H.user(), t = H.today();
    var mine = S.find('assignments', function (a) { var s = S.get('services', a.serviceId); return a.personId === me.id && s && s.date >= t; })
      .sort(function (a, b) { return Serving.byWhen(S.get('services', a.serviceId), S.get('services', b.serviceId)); });
    var sk = S.find('skills', function (k) { return k.personId === me.id; });
    // Pastors (and others who may see the whole roster but don't plan it) print it from here
    var html = head(T('My serving'), T('Your upcoming turns. Please reply so the roster can be planned.'),
      canPrint() && !manager() ? '<button class="btn" data-act="rosters:print">' + H.icon(PRINTER, 18) + T('Print the roster') + '</button>' : '') + tabs('mine');
    html += mine.length ? '<div class="list">' + mine.map(function (a) {
      var s = S.get('services', a.serviceId), po = pos(a.positionId);
      return '<div class="item svc-tint" style="' + svcStyle(s) + '"><span class="grow"><b>' + esc(po.name + ' · ' + (team(po.teamId) || {}).name) + '</b><small>' + esc(H.fmt(s.date, true) + ', ' + s.time + ' · ' + s.name) + '</small></span>' +
        (a.status === 'pending' ? '<button class="btn small" data-act="rosters:reply" data-id="' + a.id + '" data-s="declined">' + T('Can’t make it') + '</button><button class="btn small ok" data-act="rosters:reply" data-id="' + a.id + '" data-s="accepted">' + T('Accept') + '</button>' :
          '<span class="tag ' + (a.status === 'accepted' ? 'ok' : 'grey') + '">' + T(a.status === 'accepted' ? 'Accepted' : 'Said no') + '</span>') + '</div>';
    }).join('') + '</div>' : '<p class="empty">' + T('You’re not on the roster in the coming weeks.') + '</p>';
    html += '<div class="grid2" style="margin-top:16px"><section class="panel"><h2>' + T('My teams') + '</h2>' + (sk.length ? sk.map(function (k) { var po = pos(k.positionId); return '<p style="margin:6px 0">' + esc(po.name + ' · ' + (team(po.teamId) || {}).name) + ' <span class="muted small">(' + esc(T(k.frequency)) + ')</span></p>'; }).join('') : '<p class="muted">' + T('Not on a team yet – speak to the roster coordinator.') + '</p>') + '</section>' +
      '<section class="panel"><h2>' + T('Serve with family or friends') + '</h2><p class="muted" style="margin-top:0">' + T('Tell us who you’d like to serve with, and the roster will keep you together.') + '</p><a class="btn" href="#/rosters/together">' + T('Serving together') + '</a> <a class="btn" href="#/rosters/away">' + T('My away dates') + '</a></section></div>';
    return html;
  }

  /* ---------- module ---------- */
  function nextGaps() {
    var s = upcoming()[0]; if (!s) return null;
    var n = 0; orderedPositions().forEach(function (p) { if (runsAt(p, s)) n += Math.max(0, p.needed - S.find('assignments', function (a) { return a.serviceId === s.id && a.positionId === p.id && a.status !== 'declined'; }).length); });
    return { s: s, n: n };
  }
  var MOD; H.register(MOD = {
    id: 'rosters', name: 'Rosters', desc: 'Who serves when – families kept together', icon: H.ICON.rosters, tint: '#2F6FB3',
    stat: function (u) {
      if (manager()) { var g = nextGaps(); return g ? (g.n ? TN('{n} gap on {date}', '{n} gaps on {date}', g.n, { date: H.fmt(g.s.date) }) : T('All filled for {date}', { date: H.fmt(g.s.date) })) : T('No services planned'); }
      var p = S.find('assignments', function (a) { return a.personId === u.id && a.status === 'pending'; }).length;
      return p ? TN('{n} turn to reply to', '{n} turns to reply to', p) : T('Your serving');
    },
    todos: function (u) {
      var out = [], mine = S.find('assignments', function (a) { var s = S.get('services', a.serviceId); return a.personId === u.id && a.status === 'pending' && s && s.date >= H.today(); });
      if (mine.length) out.push({ text: TN('Reply to {n} serving request', 'Reply to {n} serving requests', mine.length), href: '#/rosters/mine' });
      if (manager()) { var w = waitingOffers().length; if (w) out.push({ text: TN('{n} person has offered to serve – answer them', '{n} people have offered to serve – answer them', w), href: '#/rosters/teams' }); }
      if (manager()) { var g = nextGaps(); if (g && g.n) out.push({ text: TN('Fill {n} gap on the roster for {date}', 'Fill {n} gaps on the roster for {date}', g.n, { date: H.fmt(g.s.date) }), href: '#/rosters' }); }
      return out;
    },
    render: function (p) {
      var v = p[0] || (manager() ? '' : 'mine');
      if (v === 'teams' && manager()) return renderTeams();
      if (v === 'services' && manager()) return p[1] ? renderService(decodeURIComponent(p[1])) : renderServices();
      if (v === 'together') return renderTogether();
      if (v === 'away') return renderAway();
      if (v === 'mine' || !manager()) return renderMine();
      return renderMatrix();
    },
    actions: Object.assign({
      setupdepts: function () {
        var add = Serving.missing(S.list('teams'), S.list('positions'));
        H.busy(T('Adding the departments…'), function () {
        add.teams.forEach(function (t) { S.put('teams', t); });
        add.positions.forEach(function (p) { S.put('positions', p); });
        (add.renames || []).forEach(function (r) { var p = S.get('positions', r.id); if (p) S.put('positions', Object.assign(JSON.parse(JSON.stringify(p)), { name: r.to }), 'Renamed the position ' + r.from + ' to ' + r.to); });
        S.audit('Set up the church’s departments: ' + add.teams.length + ' departments and ' + add.positions.length + ' positions added' + ((add.renames || []).length ? ', ' + add.renames.length + ' renamed' : ''), 'teams');
        H.render(); H.toast(T('Departments and positions added'));
        });
      },
      move: function (el) { state.start += +el.dataset.d; state.preview = null; H.render(); },
      step: function (el) { state.cols = Math.max(1, Math.min(16, inView().length + +el.dataset.d)); state.view = 'n'; state.preview = null; H.render(); },
      view: function (el) { state.view = el.dataset.v; state.preview = null; H.render(); },
      hideslot: function (el) { if (state.hidden.indexOf(el.dataset.v) < 0) state.hidden.push(el.dataset.v); H.render(); },
      showslot: function (el) { var v = el.dataset.v; state.hidden = v ? state.hidden.filter(function (x) { return x !== v; }) : []; H.render(); },
      teammove: function (el) {
        var ch = Serving.moveTeam(S.list('teams'), el.dataset.id, +el.dataset.d), t = team(el.dataset.id);
        ch.forEach(function (c) { var x = team(c.id); if (x && x.order !== c.order) S.put('teams', Object.assign({}, x, { order: c.order })); });
        if (ch.length) S.audit('Moved the department ' + (t || {}).name + (+el.dataset.d < 0 ? ' up' : ' down'), 'teams');
        H.render();
      },
      teammerge: function (el) { mergeDialog(team(el.dataset.id)); },
      teammergego: function (el) {
        var from = team(el.dataset.id), to = team(document.getElementById('tm-to').value); if (!from || !to || from.id === to.id) return;
        var m = Serving.mergeTeam(from.id, to.id, S.list('positions'), S.list('skills'), S.list('assignments'));
        H.busy(T('Joining the teams…'), function () {
          m.positions.forEach(function (p) { S.put('positions', p); });
          m.skills.forEach(function (k) { S.put('skills', k); });
          m.assignments.forEach(function (a) { S.put('assignments', a); });
          m.removeSkills.forEach(function (id) { S.remove('skills', id); });
          m.removePositions.forEach(function (id) { S.remove('positions', id); });
          S.remove('teams', from.id, 'Joined the department ' + from.name + ' to ' + to.name);
          H.closeModal(); H.render(); H.toast(T('{from} is now part of {to}', { from: from.name, to: to.name }));
        });
      },
      teamdel: function (el) {
        var t = team(el.dataset.id); if (!t || S.find('positions', function (p) { return p.teamId === t.id; }).length) return;
        if (!H.confirmBtn(el, T('Click again to delete'))) return;
        S.remove('teams', t.id, 'Deleted the department ' + t.name); H.render();
      },
      autofill: function () {
        var ids = inView().filter(function (s) { return s.date >= H.today(); }).map(function (s) { return s.id; });
        state.preview = R.autoFill(engineData(), ids); state.preview.emergency = false;
        H.render();
        H.toast(state.preview.assignments.length ? TN('{n} suggestion ready – check and keep it', '{n} suggestions ready – check and keep them', state.preview.assignments.length) : T('Nothing more can be filled automatically'));
      },
      emergencyfill: function () {
        var ids = inView().filter(function (s) { return s.date >= H.today(); }).map(function (s) { return s.id; });
        state.preview = R.autoFill(engineData(), ids, { emergency: true }); state.preview.emergency = true;
        H.render();
        H.toast(state.preview.assignments.length ? TN('{n} suggestion ready – check and keep it', '{n} suggestions ready – check and keep them', state.preview.assignments.length) : T('Nothing more can be filled automatically'));
      },
      keep: function () {
        var kept = [];
        state.preview.assignments.forEach(function (a) { kept.push(S.put('assignments', { serviceId: a.serviceId, positionId: a.positionId, personId: a.personId, status: 'pending', source: a.source || 'auto', reason: a.reason })); });
        S.audit('Kept ' + state.preview.assignments.length + (state.preview.emergency ? ' emergency' : '') + ' roster suggestions', 'assignments');
        var n = state.preview.assignments.length; state.preview = null; var told = toldText(tell(kept, 'ask')); H.render();
        H.toast(TN('{n} person asked to serve', '{n} people asked to serve', n) + (told ? ' · ' + told : ''));
      },
      discard: function () { state.preview = null; H.render(); },
      print: function () { if (canPrint()) printDialog(); },
      printterm: function (el) {
        var pr = state.print; if (!pr) return; pr.from = el.dataset.f; pr.to = el.dataset.t;
        var f = document.getElementById('ro-pfrom'), t = document.getElementById('ro-pto'); if (f) f.value = pr.from; if (t) t.value = pr.to;
        printParts();
      },
      printsheet: function (el) {
        var pr = state.print; if (!pr) return;
        var all = R.printChoices(printData(), pr.from, pr.to).map(function (c) { return c.key; }), k = el.dataset.k;
        var cur = pr.sheets ? pr.sheets.filter(function (x) { return all.indexOf(x) >= 0; }) : all.slice();
        cur = cur.indexOf(k) >= 0 ? cur.filter(function (x) { return x !== k; }) : cur.concat([k]);
        pr.sheets = cur.length === all.length ? null : cur;
        printParts();
      },
      printgo: function () { printRoster(); },
      slot: function (el) {
        var a = S.get('assignments', el.dataset.id) || (state.preview && state.preview.assignments.filter(function (x) { return x.id === el.dataset.id; })[0]);
        if (a) slotDialog(a);
      },
      dropsug: function (el) { state.preview.assignments = state.preview.assignments.filter(function (x) { return x.id !== el.dataset.id; }); H.closeModal(); H.render(); },
      status: function (el) { var a = S.get('assignments', el.dataset.id); a.status = el.dataset.s; S.put('assignments', a, 'Roster status changed'); H.closeModal(); H.render(); },
      remove: function (el) {
        if (!H.confirmBtn(el, T('Click again to remove'))) return;
        var a = S.get('assignments', el.dataset.id), r = untell(a);
        S.remove('assignments', el.dataset.id, 'Removed from roster'); H.closeModal(); H.render();
        if (a) H.toast(T('Taken off the roster') + untoldText(r, person(a.personId)));
      },
      change: function (el) { var a = S.get('assignments', el.dataset.id); if (a) assignDialog(a.serviceId, a.positionId, false, a.id); },
      assign: function (el) { assignDialog(el.dataset.s, el.dataset.p, false); },
      communion: function (el) { communionDialog(el.dataset.s); },
      communionset: function (el) { setCommunion(el.dataset.s, el.dataset.v); },
      emergencyassign: function (el) { assignDialog(el.dataset.s, el.dataset.p, true, el.dataset.r); },
      regularassign: function (el) { assignDialog(el.dataset.s, el.dataset.p, false, el.dataset.r); },
      pick: function (el) {
        var sid = el.dataset.s, pid = el.dataset.p, who = el.dataset.person, d = engineData();
        var emergency = el.dataset.emergency === '1', old = el.dataset.r && S.get('assignments', el.dataset.r), untold = '';
        var added = S.put('assignments', { serviceId: sid, positionId: pid, personId: who, status: 'pending', source: emergency ? 'emergency' : 'manual',
          reason: emergency ? T('Emergency volunteer') : '' }, emergency ? 'Added an emergency volunteer to roster' : 'Added to roster');
        tell([added], 'ask');
        if (old) { untold = untell(old); S.remove('assignments', old.id, 'Changed who serves on the roster'); }
        var tg = R.groupsOf(d, who, 'together').filter(function (g) { return g.strength === 'must'; })[0];
        H.closeModal(); H.render();
        if (old) H.toast(T('Changed to {name} – waiting for their reply', { name: H.name(person(who)) }) + untoldText(untold, person(old.personId)));
        else H.toast(tg ? T('Added. {name} always serves with {names} – use “Fill the gaps” to place them too.', { name: H.name(person(who)), names: tg.memberIds.filter(function (m) { return m !== who; }).map(function (m) { return H.name(person(m)); }).join(', ') }) : T('Added – waiting for their reply'));
      },
      reply: function (el) {
        var a = S.get('assignments', el.dataset.id); if (!a || a.status === el.dataset.s) return;
        a.status = el.dataset.s; S.put('assignments', a, el.dataset.s === 'accepted' ? 'Accepted a serving turn' : 'Declined a serving turn');
        if (a.status === 'declined') tellDeclined(a);
        H.render(); H.toast(T(el.dataset.s === 'accepted' ? 'Thank you!' : 'Thanks for letting us know'));
      },
      remind: function () {
        var ids = inView().map(function (s) { return s.id; });
        var people = R.byPerson(S.find('assignments', function (a) { return a.status === 'pending'; }), S.list('services'), { waiting: true, today: H.today(), serviceIds: ids });
        if (!people.length) { H.toast(T('Everyone on these services has replied')); return; }
        state.remind = people;
        var names = people.map(function (x) { var p = person(x.personId); return p ? H.name(p) : T('Someone'); }).sort(function (a, b) { return a.localeCompare(b); });
        H.modal(H.dialogHead(TN('Remind {n} person?', 'Remind {n} people?', people.length), T('They get a message in Messages about the turns they haven’t replied to yet.')) +
          '<div class="dlg-body"><p>' + names.map(function (n) { return '<span class="tag grey">' + esc(n) + '</span>'; }).join(' ') + '</p></div>' +
          '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn primary" data-act="rosters:remindnow">' + H.icon(BELL, 16) + T('Send reminders') + '</button></div>', T('Remind those who haven’t replied'));
      },
      remindnow: function () {
        var people = state.remind || []; state.remind = null; H.closeModal();
        var list = []; people.forEach(function (x) { x.ids.forEach(function (id) { var a = S.get('assignments', id); if (a && a.status === 'pending') list.push(a); }); });
        var told = toldText(tell(list, 'remind')); H.render(); H.toast(told || T('Messages are switched off (Settings → Apps)'));
      },
      group: function (el) { groupDialog(el.dataset.id ? S.get('groups', el.dataset.id) : null, el.dataset.kind); },
      savegroup: function () {
        var id = document.getElementById('gr-id').value, kind = document.getElementById('gr-kind').value;
        var ids = Array.prototype.map.call(document.querySelectorAll('.gr-m:checked'), function (b) { return b.value; });
        var nm = document.getElementById('gr-name').value.trim(), err = document.getElementById('gr-err');
        if (ids.length < 2) { err.textContent = T('Choose at least two people.'); err.hidden = false; return; }
        if (!manager() && ids.indexOf(H.user().id) < 0) ids.push(H.user().id);
        var str = document.querySelector('input[name=gr-str]:checked');
        var g = id ? S.get('groups', id) : {};
        Object.assign(g, { name: nm || ids.map(function (i) { return person(i).firstName; }).join(' & '), kind: kind, strength: kind === 'apart' ? 'must' : (str ? str.value : 'prefer'), memberIds: ids, note: document.getElementById('gr-note').value.trim() });
        S.put('groups', g, (id ? 'Updated' : 'Created') + ' serving group ' + g.name); H.closeModal(); H.render(); H.toast(T('Saved – the roster will follow this from now on'));
      },
      delgroup: function (el) { if (!H.confirmBtn(el, T('Click again to delete'))) return; S.remove('groups', el.dataset.id, 'Deleted serving group'); H.closeModal(); H.render(); },
      addaway: function () {
        var me = H.user(), people = S.find('people', function (p) { return p.active !== false && p.familyRole !== 'child'; }).sort(function (a, b) { return H.name(a).localeCompare(H.name(b)); });
        // Upcoming service days in the next 3 months, one tick box per day (several services on one day = one box)
        var days = [], end = LeaveCore.iso(LeaveCore.addDays(LeaveCore.parse(H.today()), 92));
        upcoming().forEach(function (sv) { if (sv.date <= end && days.indexOf(sv.date) < 0) days.push(sv.date); });
        H.modal(H.dialogHead(T('Add away dates'), T('Tick every day you can’t serve, and/or add longer stretches. You won’t be rostered on them.')) + '<div class="dlg-body">' +
          (manager() ? '<label class="field req">' + T('Who') + '<select class="findable" id="aw-p">' + people.map(function (p) { return '<option value="' + p.id + '"' + (p.id === me.id ? ' selected' : '') + '>' + esc(H.name(p)) + '</option>'; }).join('') + '</select></label>' : '<input type="hidden" id="aw-p" value="' + me.id + '">') +
          (days.length ? '<fieldset class="field" style="border:0;padding:0;margin:0 0 12px"><legend style="margin-bottom:6px">' + T('Service days') + ' <small>' + T('(tick all that apply)') + '</small></legend><div class="aw-days">' +
            days.map(function (d) { return '<label class="check aw-day"><input type="checkbox" class="aw-d" value="' + d + '"><span>' + esc(H.fmt(d, LeaveCore.parse(d).getFullYear() !== new Date().getFullYear())) + '</span></label>'; }).join('') + '</div></fieldset>' : '') +
          '<p style="margin:4px 0 6px"><b>' + T('Longer stretches') + '</b> <small class="muted">' + T('(e.g. a holiday)') + '</small></p><div id="aw-ranges"></div>' +
          '<button class="btn small" type="button" data-act="rosters:awayrange">' + H.icon(H.ICON.plus, 16) + T('Add a stretch') + '</button>' +
          '<label class="field" style="margin-top:12px">' + T('Reason') + '<input id="aw-r" placeholder="' + T('e.g. holiday') + '"><small>' + T('Only the roster team sees it.') + '</small></label><p id="aw-err" class="note bad" hidden></p></div>' +
          '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn save" data-act="rosters:saveaway">' + T('Save') + '</button></div>', T('Away dates'));
        if (!days.length) MOD.actions.awayrange();
      },
      awayrange: function () {
        var box = document.getElementById('aw-ranges'), row = document.createElement('div');
        row.className = 'two aw-range';
        row.innerHTML = '<label class="field">' + T('From') + '<input type="date" class="aw-f"></label><label class="field">' + T('To') + '<input type="date" class="aw-t"></label>';
        box.appendChild(row);
        var f = row.querySelector('.aw-f'), t = row.querySelector('.aw-t');
        f.addEventListener('change', function () { if (!t.value || t.value < f.value) t.value = f.value; });
        f.focus();
      },
      saveaway: function () {
        var err = document.getElementById('aw-err'), who = document.getElementById('aw-p').value, out = [], bad = false;
        document.querySelectorAll('.aw-d:checked').forEach(function (b) { out.push([b.value, b.value]); });
        document.querySelectorAll('.aw-range').forEach(function (r) {
          var f = r.querySelector('.aw-f').value, t = r.querySelector('.aw-t').value || f;
          if (!f && !r.querySelector('.aw-t').value) return;            // empty row: ignore
          if (!f || t < f) bad = true; else out.push([f, t]);
        });
        if (bad) { err.textContent = T('Each stretch needs a first day, and the last day can’t be before it.'); err.hidden = false; return; }
        if (!out.length) { err.textContent = T('Tick at least one day, or add a stretch.'); err.hidden = false; return; }
        var r = document.getElementById('aw-r').value.trim(), reason = 'Away' + (r ? ': ' + r : '');
        out.forEach(function (x) {
          if (S.find('blockouts', function (b) { return b.personId === who && b.from <= x[0] && b.to >= x[1]; }).length) return;   // already covered
          S.put('blockouts', { personId: who, from: x[0], to: x[1], reason: reason });
        });
        S.audit('Added ' + out.length + ' away date' + (out.length === 1 ? '' : 's') + ' for ' + H.name(person(who)), 'blockouts');
        H.closeModal(); H.render(); H.toast(TN('{n} away date saved – no rostering on those days', '{n} away dates saved – no rostering on those days', out.length));
      },
      delaway: function (el) { S.remove('blockouts', el.dataset.id, 'Removed away dates'); H.render(); },
      newteam: function () { var n = prompt(T('Name of the new team (e.g. Prayer)')); if (n && n.trim()) { S.put('teams', { name: n.trim() }, 'Created team ' + n.trim()); H.render(); } },
      /** How many people a position needs at each service (e.g. 2 on the sound desk): − and + on Teams. */
      needed: function (el) {
        var p = pos(el.dataset.p); if (!p || !manager()) return;
        var n = Math.max(1, Math.min(20, (p.needed || 1) + (+el.dataset.d))); if (n === p.needed) return;
        p = JSON.parse(JSON.stringify(p)); p.needed = n; S.put('positions', p, p.name + ': ' + n + ' needed per service'); H.render();
        var b = document.querySelector('[data-act="rosters:needed"][data-p="' + p.id + '"][data-d="' + el.dataset.d + '"]'); if (b && !b.disabled) b.focus();
      },
      newpos: function (el) { var n = prompt(T('Name of the position (e.g. Camera)')); if (!n || !n.trim()) return; var k = parseInt(prompt(T('How many people are needed per service?'), '1'), 10) || 1; S.put('positions', { teamId: el.dataset.t, name: n.trim(), needed: k }, 'Added position ' + n.trim()); H.render(); },
      addmember: function (el) {
        var po = pos(el.dataset.p), have = S.find('skills', function (k) { return k.positionId === po.id; }).map(function (k) { return k.personId; });
        var people = S.find('people', function (p) { return p.active !== false && have.indexOf(p.id) < 0; }).sort(function (a, b) { return H.name(a).localeCompare(H.name(b)); });
        H.modal(H.dialogHead(T('Add to {position}', { position: po.name })) + '<div class="dlg-body"><label class="field req">' + T('Person') + '<select class="findable" id="am-p">' + people.map(function (p) { return '<option value="' + p.id + '">' + esc(H.name(p)) + (p.familyRole === 'child' ? ' ' + T('(child/teen)') : '') + '</option>'; }).join('') + '</select></label>' +
          '<label class="field">' + T('How often would they like to serve?') + '<select id="am-f">' + FREQ.map(function (f) { return '<option value="' + f[0] + '"' + (f[0] === 'weekly' ? ' selected' : '') + '>' + T(f[1]) + '</option>'; }).join('') + '</select></label></div>' +
          '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn primary" data-act="rosters:savemember" data-p="' + po.id + '">' + T('Add') + '</button></div>', T('Add team member'));
      },
      savemember: function (el) { S.put('skills', { personId: document.getElementById('am-p').value, positionId: el.dataset.p, frequency: document.getElementById('am-f').value }, 'Added to a team'); H.closeModal(); H.render(); },
      offeryes: function (el) {
        var o = S.get('serveOffers', el.dataset.id); if (!o) return;
        var who = H.name(person(o.personId)), text = offerText(o);
        var have = S.find('skills', function (k) { return k.personId === o.personId && k.positionId === o.positionId; });
        if (o.kind === 'stop') have.forEach(function (k) { S.remove('skills', k.id); });
        else if (have.length) { var k = JSON.parse(JSON.stringify(have[0])); k.frequency = o.frequency || k.frequency; if (o.times) k.times = o.times; S.put('skills', k); }
        else if (pos(o.positionId)) S.put('skills', { personId: o.personId, positionId: o.positionId, frequency: o.frequency || 'fortnightly', times: o.times || [] });
        S.remove('serveOffers', o.id, 'Said yes: ' + who + ' ' + text);
        H.render(); H.toast(T(o.kind === 'stop' ? '{name} is off that team now' : '{name} is on the team – they can now be rostered', { name: who }));
      },
      offerno: function (el) {
        var o = S.get('serveOffers', el.dataset.id); if (!o) return;
        H.modal(H.dialogHead(T('Not now'), H.name(person(o.personId)) + ' ' + offerText(o)) + '<div class="dlg-body"><label class="field">' + T('A short reply for them (they will see it)') + '<textarea id="of-reply" rows="2" maxlength="200" placeholder="' + esc(T('e.g. The team is full for now – we’ll ask you in the new year')) + '"></textarea></label></div>' +
          '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn primary" data-act="rosters:offernosend" data-id="' + esc(o.id) + '">' + T('Send') + '</button></div>', T('Not now'));
      },
      offernosend: function (el) {
        var o = S.get('serveOffers', el.dataset.id); if (!o) return H.closeModal();
        o.status = 'declined'; o.reply = document.getElementById('of-reply').value.trim().slice(0, 200);
        S.put('serveOffers', o, 'Said not now: ' + H.name(person(o.personId)) + ' ' + offerText(o));
        H.closeModal(); H.render(); H.toast(T('Reply sent'));
      },
      unskill: function (el) { S.remove('skills', el.dataset.id, 'Removed from a team'); H.render(); }
    }, serviceActions)
  });
  window.RosterHelpers = { awayList: awayList };
})();
