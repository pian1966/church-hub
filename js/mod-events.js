/* Church & Trellis – Events: what's coming up at church, signing up, and reminders 3 days and 1 day before.
 * The rules: js/events.js; the look: css/events.css. Plan: docs/COMMUNITY-PLAN.md part 1. Switched on in Settings → Apps.
 * Routes: #/events (coming up), #/events/mine (what I signed up for), #/events/past (organisers), #/events/e/<id> (one event).
 * Organisers (js/access.js JOBS.organisers: Administrators, Pastors and the church secretary until the church chooses) put
 * events up, see who's coming, write to everyone coming and cancel an event (everyone coming is told).
 * Anyone on the staff (and the organisers) may also see who's coming and add people – e.g. those who put their name down on a
 * paper sheet (Add people; js/events.js add). The sign-up is in that person's name, so they see it and get the reminders.
 * Reminders: in Messages always – each person's own Church & Trellis writes theirs on the day it is due (remind() below);
 * by email for those who ticked "Email me reminders too" – the email robot sends those (robot/event-mail.js).
 * POPIA: docs/POPIA.md "Events". */
(function () {
  'use strict';
  var H = Hub, S = Store, E = Events, T = I18n.t, TN = I18n.tn, esc = H.esc;
  var CAL = 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4';
  var PRINTER = 'M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6z';
  var state = { tab: '', tidied: false, written: {}, timer: null, pick: {}, rep: null };
  var ERR = { title: 'Give the event a name.', date: 'Choose the day.', time: 'Choose the time it starts.', end: 'It must end after it starts.',
    closes: 'Sign-up must close on or before the day of the event.', past: 'That is in the past.', people: 'Choose who is coming.',
    guests: 'That is more guests than this event allows.', email: 'Check the email address.', closed: 'Sign-up for this event has closed.' };

  function now() { return Date.now(); }
  function me() { return H.user(); }
  function organiser() { return !S.preview() && H.can('events.organise'); }
  function manager() { return !S.preview() && H.can('settings.manage'); }
  function adder() { return !S.preview() && H.can('events.add'); }
  /** May people be added to this event now? (after the closing date too – paper sheets come in late) */
  function addable(e) { var st = E.signupState(e, now()); return adder() && (st === 'open' || st === 'closed'); }
  function kind() { var u = me(); return u ? Access.kindOf(u.appRole || 'member', H.attendee()) : 'attendee'; }
  function events() { var org = organiser(), k = kind(); return S.list('events').filter(function (e) { return E.sees(e, k, org); }); }
  function signups() { return S.list('eventSignups'); }
  function mySignup(e) { var u = me(); return u ? E.mine(signups(), e.id, u.id) : null; }
  function alive(p) { return p && p.active !== false && !p.binnedAt && !p.mergedInto && p.category !== 'Deceased'; }
  /** Who I may sign up: me, and the people in my household I can see. */
  function household() {
    var u = me(); if (!u) return [];
    var mine = S.get('people', u.id) || u;
    var fam = mine.familyId ? S.find('people', function (p) { return p.id !== mine.id && p.familyId === mine.familyId && alive(p); }) : [];
    return [mine].concat(fam.sort(function (a, b) { return (a.familyRole === 'child') - (b.familyRole === 'child') || H.byName(a, b); }));
  }
  function church() { return ((S.settings() || {}).churchName) || ''; }
  /** A soft colour for each event, always the same for the same event (its id). */
  function hue(e) { var h = 0, s = String(e.id || e.title || ''); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return [18, 152, 206, 262, 330, 42, 190][h % 7]; }
  function timeText(e) { return e.time + (e.end ? '–' + e.end : ''); }
  function where(e) { return [e.place, e.address].filter(Boolean).join(', '); }
  function audit(what) { return 'Events: ' + what; }

  /* ---------- one card ---------- */
  function tile(e) {
    var d = new Date(E.startOf(e));
    return '<div class="ev-date" aria-hidden="true"><span>' + esc(I18n.mon()[d.getMonth()]) + '</span><b>' + d.getDate() + '</b><span>' + esc(I18n.dow()[d.getDay()]) + '</span></div>';
  }
  function tags(e, s) {
    var t = [], st = E.signupState(e, now());
    if (e.status === 'cancelled') t.push('<span class="tag bad">' + T('Cancelled') + '</span>');
    else if (s) t.push('<span class="tag good">' + T('You’re going') + ' ✓</span>');
    else if (st === 'closed') t.push('<span class="tag grey">' + T('Sign-up closed') + '</span>');
    if (e.who === 'partners') t.push('<span class="tag grey">' + T('Church Partners') + '</span>');
    if ((organiser() || adder()) && e.signup) { var c = E.count(signups(), e.id); t.push('<span class="tag">' + esc(TN('{n} coming', '{n} coming', c.total)) + '</span>'); }
    return t.length ? '<p class="ev-tags">' + t.join(' ') + '</p>' : '';
  }
  function card(e) {
    var s = mySignup(e), open = E.signupState(e, now()) === 'open';
    var act = !s && open ? '<button class="btn primary ev-go" data-act="events:join" data-id="' + esc(e.id) + '">' + T('I’ll be there') + '</button>' : '';
    return '<article class="ev-card' + (e.status === 'cancelled' ? ' off' : '') + '" style="--ev:' + hue(e) + '"><a class="ev-hit" href="#/events/e/' + encodeURIComponent(e.id) + '">' + tile(e) +
      '<div class="ev-main"><h3>' + esc(e.title) + '</h3><p class="ev-meta">' + esc(timeText(e)) + (where(e) ? ' · ' + esc(e.place || e.address) : '') + '</p>' + tags(e, s) + '</div></a>' +
      (act ? '<div class="ev-act">' + act + '</div>' : '') + '</article>';
  }
  function grid(list) { return '<div class="ev-grid">' + list.map(card).join('') + '</div>'; }

  /* ---------- the page ---------- */
  function render(parts) {
    var tab = (parts && parts[0]) || '', org = organiser(), t = now();
    if (org && !state.tidied) { state.tidied = true; setTimeout(tidy, 1200); }
    remindSoon();
    if (tab === 'e' && parts[1]) return eventPage(parts[1]);
    var all = events(), up = E.upcoming(all, t), mine = up.filter(function (e) { return mySignup(e); }), past = org ? E.past(all, t) : [];
    if (tab === 'mine' && !mine.length) tab = '';
    if (tab === 'past' && !past.length) tab = '';
    var moreItems = [adder() && all.some(function (e) { return e.signup; }) ? '<button class="btn ghost" data-act="events:report">' + H.icon(PRINTER, 16) + ' ' + T('Sign-up report…') + '</button>' : '',
      manager() ? '<button class="btn ghost" data-act="events:organisers">' + T('Event organisers…') + '</button>' : ''].filter(Boolean);
    var more = moreItems.length ? H.menu(T('More'), moreItems) : '';
    var html = '<div class="page-head"><div><h1>' + T('Events') + '</h1><p class="lead">' + T('What’s coming up at church. Tap I’ll be there – we’ll remind you 3 days and 1 day before.') + '</p></div>' +
      '<div class="btns">' + more + (org ? '<button class="btn primary" data-act="events:new">' + H.icon('M12 5v14M5 12h14', 16) + ' ' + T('New event') + '</button>' : '') + '</div></div>';
    if (mine.length || past.length) html += '<nav class="seg"><a href="#/events"' + (tab === '' ? ' class="on"' : '') + '>' + T('Coming up') + '</a>' +
      (mine.length ? '<a href="#/events/mine"' + (tab === 'mine' ? ' class="on"' : '') + '>' + T('My events') + '</a>' : '') +
      (past.length ? '<a href="#/events/past"' + (tab === 'past' ? ' class="on"' : '') + '>' + T('Past') + '</a>' : '') + '</nav>';
    if (tab === 'mine') return html + grid(mine);
    if (tab === 'past') return html + grid(past);
    if (!up.length) return html + '<div class="ev-empty">' + H.icon(CAL, 40) + '<p><b>' + T('Nothing planned yet.') + '</b></p><p class="muted">' +
      (org ? T('Put up the first event – people sign up with one tap and get reminders.') : T('When the church plans an event, it shows here.')) + '</p>' +
      (org ? '<button class="btn primary" data-act="events:new">' + T('New event') + '</button>' : '') + '</div>';
    return html + grid(up);
  }

  /* ---------- one event ---------- */
  function eventPage(id) {
    var e = S.get('events', id), org = organiser();
    if (!e || !E.sees(e, kind(), org)) return '<div class="page-head"><div><h1>' + T('Events') + '</h1></div></div><p class="empty">' + T('This event isn’t here any more.') + ' <a href="#/events">' + T('See what’s coming up') + '</a></p>';
    var s = mySignup(e), st = E.signupState(e, now()), u = me();
    var menu = org ? H.menu(T('More'), [
      '<button class="btn ghost" data-act="events:edit" data-id="' + esc(e.id) + '">' + T('Change the event') + '</button>',
      e.signup ? '<button class="btn ghost" data-act="events:write" data-id="' + esc(e.id) + '">' + T('Message everyone coming') + '</button>' : '',
      e.signup ? '<button class="btn ghost" data-act="events:report" data-id="' + esc(e.id) + '">' + H.icon(PRINTER, 16) + ' ' + T('Sign-up report…') + '</button>' : '',
      e.status === 'cancelled' ? '<button class="btn ghost" data-act="events:restore" data-id="' + esc(e.id) + '">' + T('It’s on again') + '</button>' : '<button class="btn ghost" data-act="events:cancel" data-id="' + esc(e.id) + '">' + T('Cancel the event…') + '</button>',
      '<button class="btn ghost danger" data-act="events:del" data-id="' + esc(e.id) + '">' + T('Delete') + '</button>'].filter(Boolean)) : '';
    var main = !s && st === 'open' ? '<button class="btn primary" data-act="events:join" data-id="' + esc(e.id) + '">' + T('I’ll be there') + '</button>' : '';
    var html = '<p class="ev-back"><a href="#/events">← ' + T('Events') + '</a></p><div class="page-head"><div><h1>' + esc(e.title) + '</h1><p class="lead">' + esc(H.fmt(e.date, true) + ' · ' + timeText(e)) + '</p></div>' +
      '<div class="btns">' + menu + main + '</div></div>';
    html += '<section class="panel ev-hero" style="--ev:' + hue(e) + '">' + tile(e) + '<div class="ev-main">' +
      (e.status === 'cancelled' ? '<p class="ev-cancelled">' + T('This event has been cancelled.') + '</p>' : '') +
      (where(e) ? '<p class="ev-where">' + H.icon('M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z', 16) + ' ' + esc(where(e)) + (e.address ? ' ' + H.mapLink(e.address) : '') + '</p>' : '') +
      (e.about ? '<div class="ev-about">' + e.about.split(/\n{2,}/).map(function (p) { return '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>'; }).join('') + '</div>' : '') +
      tags(e, null) + '</div></section>';
    if (s) html += mine(e, s);
    else if (e.signup && e.status !== 'cancelled' && (st === 'open' || st === 'closed')) html += '<p class="ev-note">' + H.icon('M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0', 16) + '<span>' +
      (st === 'open' ? T('Signed up? We’ll remind you in Messages 3 days and 1 day before.') + (e.email ? ' ' + T('By email too, if you like.') : '') : T('Sign-up for this event has closed.')) + '</span></p>';
    else if (!e.signup) html += '<p class="ev-note">' + H.icon(CAL, 16) + '<span>' + T('No need to sign up – just come.') + ' <button class="link" data-act="events:ics" data-id="' + esc(e.id) + '">' + T('Add to my calendar') + '</button></span></p>';
    if ((org || adder()) && e.signup) html += whoComing(e);
    return html;
  }
  /** My sign-up: who's coming, and what I can do about it. */
  function mine(e, s) {
    var who = (s.names || []).join(', ') + (s.guests ? ' + ' + TN('{n} guest', '{n} guests', s.guests) : ''), mineToChange = s.by === (me() || {}).id;
    var open = E.signupState(e, now()) === 'open';
    return '<section class="panel ev-mine"><div class="ev-yes">' + H.icon('M20 6 9 17l-5-5', 22) + '<div><b>' + T('You’re going') + '</b><p>' + esc(who) + '</p>' +
      '<p class="muted small">' + T('We’ll remind you in Messages 3 days and 1 day before.') + (s.email ? ' ' + esc(T('And by email, to {email}.', { email: s.email })) : '') + '</p></div></div>' +
      '<div class="btns"><button class="btn" data-act="events:ics" data-id="' + esc(e.id) + '">' + H.icon(CAL, 16) + ' ' + T('Add to my calendar') + '</button>' +
      (mineToChange && open ? '<button class="btn ghost" data-act="events:join" data-id="' + esc(e.id) + '">' + T('Change') + '</button>' : '') +
      (mineToChange && e.status !== 'cancelled' && now() < E.startOf(e) ? '<button class="btn ghost" data-act="events:leave" data-id="' + esc(e.id) + '">' + T('I can’t come after all') + '</button>' : '') + '</div></section>';
  }
  /** Organisers and staff: who's coming (staff may add people, and take off those they added). */
  function whoComing(e) {
    var list = E.names(signups(), e.id), c = E.count(signups(), e.id), u = me() || {};
    var addBtn = addable(e) ? '<button class="btn small" data-act="events:add" data-id="' + esc(e.id) + '">' + H.icon('M12 5v14M5 12h14', 14) + ' ' + T('Add people') + '</button>' : '';
    var repBtn = list.length ? '<button class="btn small ghost" data-act="events:report" data-id="' + esc(e.id) + '">' + H.icon(PRINTER, 14) + ' ' + T('Print') + '</button>' : '';
    var h2 = '<div class="ev-who-h"><h2>' + T('Who’s coming') + '</h2><div class="btns">' + repBtn + addBtn + '</div></div>';
    var head = '<div class="ev-count"><b>' + c.total + '</b><span>' + esc(TN('{n} coming', '{n} coming', c.total).replace(/^\d+\s*/, '')) + '</span>' +
      (c.guests ? '<small>' + esc(TN('{n} person', '{n} people', c.people)) + ' + ' + esc(TN('{n} guest', '{n} guests', c.guests)) + '</small>' : '') + '</div>';
    if (!list.length) return '<section class="panel ev-who">' + h2 + '<p class="muted">' + T('Nobody has signed up yet.') + '</p></section>';
    return '<section class="panel ev-who print-list">' + h2 + head + '<ul class="ev-list">' + list.map(function (s) {
      var by = s.addedBy ? S.get('people', s.addedBy) : null, mayOut = organiser() || (s.addedBy && s.addedBy === u.id);
      return '<li><span class="grow"><b>' + esc((s.names || []).join(', ')) + '</b>' + (s.guests ? ' <small>+ ' + esc(TN('{n} guest', '{n} guests', s.guests)) + '</small>' : '') +
        (by ? '<small class="ev-added">' + esc(T('Added by {name}', { name: H.name(by) })) + '</small>' : '') + '</span>' +
        (s.email ? '<span class="tag grey" title="' + esc(T('Email reminders')) + '">✉</span>' : '') +
        (mayOut ? H.menu('⋯', ['<button class="btn ghost danger" data-act="events:out" data-id="' + esc(s.id) + '">' + T('Take off the list') + '</button>'], 'row-menu', T('More')) : '') + '</li>';
    }).join('') + '</ul></section>';
  }

  /* ---------- putting an event up (or changing it) ---------- */
  function eventDialog(id) {
    if (!organiser()) return;
    var e = id ? S.get('events', id) : null, d = e || { title: '', about: '', date: '', time: '10:00', end: '', place: '', address: '', who: 'all', signup: true, closes: '', guests: 4, email: true };
    H.modal(H.dialogHead(e ? T('Change the event') : T('New event'), T('People see it under Events, and can sign up with one tap.')) + '<div class="dlg-body ev-form">' +
      '<label class="field req">' + T('Name') + '<input id="ev-title" maxlength="80" value="' + esc(d.title) + '" placeholder="' + esc(T('e.g. Men’s breakfast')) + '"></label>' +
      '<div class="two"><label class="field req">' + T('Date') + '<input id="ev-date" type="date" value="' + esc(d.date) + '"></label>' +
      '<div class="two ev-times"><label class="field req">' + T('Starts') + '<input id="ev-time" type="time" value="' + esc(d.time) + '"></label>' +
      '<label class="field">' + T('Ends') + '<input id="ev-end" type="time" value="' + esc(d.end || '') + '"></label></div></div>' +
      '<div class="two"><label class="field">' + T('Place') + '<input id="ev-place" maxlength="80" value="' + esc(d.place) + '" placeholder="' + esc(T('e.g. Church hall')) + '"></label>' +
      '<label class="field">' + T('Address') + '<input id="ev-address" maxlength="160" value="' + esc(d.address) + '"><small>' + T('Only if it isn’t at church – a map link is shown.') + '</small></label></div>' +
      '<label class="field">' + T('What it’s about') + '<textarea id="ev-about" rows="4" maxlength="1500">' + esc(d.about) + '</textarea></label>' +
      '<p class="ev-q">' + T('Who it’s for') + '</p><div class="ev-pills" role="radiogroup">' + [['all', T('Everyone')], ['partners', T('Church Partners')]].map(function (w) {
        return '<button type="button" class="ev-pill' + (d.who === w[0] ? ' on' : '') + '" role="radio" aria-checked="' + (d.who === w[0]) + '" data-act="events:who" data-w="' + w[0] + '">' + esc(w[1]) + '</button>';
      }).join('') + '</div><input type="hidden" id="ev-who" value="' + esc(d.who) + '">' +
      sw('ev-signup', T('People sign up'), T('They tap I’ll be there; you see who’s coming. They get reminders 3 days and 1 day before.'), d.signup) +
      '<div class="ev-more" id="ev-more"' + (d.signup ? '' : ' hidden') + '>' +
      '<div class="two"><label class="field">' + T('Sign-up closes') + '<input id="ev-closes" type="date" value="' + esc(d.closes || '') + '"><small>' + T('Leave empty to keep it open until the day.') + '</small></label>' +
      '<label class="field">' + T('Guests each may bring') + '<input id="ev-guests" type="number" min="0" max="' + E.MAX_GUESTS + '" inputmode="numeric" value="' + (+d.guests || 0) + '"><small>' + T('Family members without their own sign-in come as guests, so allow a few.') + '</small></label></div>' +
      sw('ev-email', T('Offer reminders by email too'), T('People who ask get the reminders by email as well as in Messages. Needs the church’s email robot (Settings → Apps → Events).'), d.email !== false) + '</div>' +
      '<p class="cm-err" id="ev-err" role="alert"></p></div>' +
      '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn primary" data-act="events:save"' + (e ? ' data-id="' + esc(e.id) + '"' : '') + '>' + (e ? T('Save') : T('Put it up')) + '</button></div>', T('New event'), true);
    var t = document.getElementById('ev-signup'); if (t) t.addEventListener('change', function () { document.getElementById('ev-more').hidden = !t.checked; });
    var f = document.getElementById('ev-title'); if (f && !e) f.focus();
  }
  function sw(id, label, hint, on) {
    return '<label class="ev-switch"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + '><span class="ev-knob" aria-hidden="true"></span><span><b>' + esc(label) + '</b>' + (hint ? '<small>' + esc(hint) + '</small>' : '') + '</span></label>';
  }
  function val(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  function on(id) { var el = document.getElementById(id); return !!(el && el.checked); }
  function save(el) {
    if (!organiser()) return;
    var old = el.dataset.id ? S.get('events', el.dataset.id) : null, u = S.get('people', (me() || {}).id) || me();
    var x = E.make({ title: val('ev-title'), about: val('ev-about'), date: val('ev-date'), time: val('ev-time'), end: val('ev-end'), place: val('ev-place'), address: val('ev-address'),
      who: val('ev-who'), signup: on('ev-signup'), closes: val('ev-closes'), guests: val('ev-guests'), email: on('ev-email') }, u, now());
    if (x.error) { document.getElementById('ev-err').textContent = T(ERR[x.error]); return; }
    if (old) { x.id = old.id; x.status = old.status; x.byId = old.byId; x.byName = old.byName; x.createdAt = old.createdAt; }
    x = S.put('events', x, audit((old ? 'changed ' : 'put up ') + x.title + ' (' + x.date + ')'));
    H.closeModal();
    if (old) H.render(); else H.go('events/e/' + x.id);
    H.toast(old ? T('Saved') : T('It’s up. People can see it under Events.'));
  }

  /* ---------- signing up ---------- */
  function joinDialog(id) {
    var e = S.get('events', id), u = me(); if (!e || !u) return;
    if (E.signupState(e, now()) !== 'open') { H.toast(T(ERR.closed), true); return; }
    var s = mySignup(e), fam = household(), picked = s ? (s.people || []).slice() : [u.id];
    state.pick = {}; picked.forEach(function (x) { state.pick[x] = 1; });
    var email = s && s.email ? s.email : E.okEmail(u.email) ? u.email : '';
    H.modal(H.dialogHead(e.title, H.fmt(e.date, true) + ' · ' + timeText(e)) + '<div class="dlg-body ev-join">' +
      '<p class="ev-q">' + (fam.length > 1 ? T('Who’s coming?') : T('You’re coming')) + '</p><div class="ev-people">' + fam.map(function (p) {
        var onP = !!state.pick[p.id];
        return '<button type="button" class="ev-person' + (onP ? ' on' : '') + '" aria-pressed="' + onP + '" data-act="events:pick" data-id="' + esc(p.id) + '"' + (fam.length === 1 ? ' disabled' : '') + '>' + H.avatar(p, 34) +
          '<span>' + esc(p.preferredName || p.firstName) + '</span><i aria-hidden="true">✓</i></button>';
      }).join('') + '</div>' +
      (e.guests ? '<p class="ev-q">' + T('Bringing guests?') + '</p><div class="ev-step"><button type="button" class="icon-btn" data-act="events:step" data-d="-1" aria-label="' + esc(T('One less')) + '">−</button>' +
        '<output id="ev-g" aria-live="polite">' + (s ? s.guests || 0 : 0) + '</output><button type="button" class="icon-btn" data-act="events:step" data-d="1" data-max="' + e.guests + '" aria-label="' + esc(T('One more')) + '">+</button>' +
        '<small class="muted">' + esc(TN('Up to {n} guest', 'Up to {n} guests', e.guests)) + '</small></div><p class="hint" style="margin:6px 0 0">' + T('Family members who aren’t shown above count as guests.') + '</p>' : '') +
      '<div class="ev-remind">' + H.icon('M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0', 18) + '<span>' + T('We’ll remind you in Messages 3 days and 1 day before.') + '</span></div>' +
      (e.email ? sw('ev-mail', T('Email me reminders too'), T('Only for this event. Your email address is kept with your sign-up and deleted after the event.'), !!(s && s.email)) +
        '<label class="field" id="ev-mail-box"' + (s && s.email ? '' : ' hidden') + '>' + T('Email address') + '<input id="ev-mail-to" type="email" maxlength="200" value="' + esc(email) + '" autocomplete="email"></label>' : '') +
      '<p class="cm-err" id="ev-err" role="alert"></p></div>' +
      '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn primary" data-act="events:signup" data-id="' + esc(e.id) + '">' + (s ? T('Save') : T('I’ll be there')) + '</button></div>', e.title);
    var m = document.getElementById('ev-mail'); if (m) m.addEventListener('change', function () { document.getElementById('ev-mail-box').hidden = !m.checked; if (m.checked) { var i = document.getElementById('ev-mail-to'); if (i && !i.value) i.focus(); } });
  }
  function signup(el) {
    var e = S.get('events', el.dataset.id), u = me(); if (!e || !u) return;
    var old = mySignup(e); if (old && old.by !== u.id) old = null;
    var x = E.signup(e, u, { people: Object.keys(state.pick).filter(function (k) { return state.pick[k]; }), guests: +((document.getElementById('ev-g') || {}).textContent || 0),
      email: on('ev-mail') ? val('ev-mail-to').trim() : '', lang: I18n.get() }, household(), now());
    if (x.error) { document.getElementById('ev-err').textContent = T(ERR[x.error]); return; }
    if (old) { x.mailed = old.mailed || []; x.createdAt = old.createdAt; }
    S.put('eventSignups', x, audit((old ? 'changed a sign-up for ' : 'signed up for ') + e.title));
    H.closeModal(); H.render();
    H.toast(old ? T('Saved') : T('Wonderful – see you there! We’ll remind you 3 days and 1 day before.'));
    remindSoon();
  }
  function leave(el) {
    var e = S.get('events', el.dataset.id), s = e && mySignup(e); if (!s || !H.confirmBtn(el, T('Yes, I can’t come'))) return;
    S.remove('eventSignups', s.id, audit('cancelled a sign-up for ' + e.title));
    H.render(); H.toast(T('Thank you for letting us know. Maybe next time!'));
  }

  /* ---------- organisers: messages, the list, cancelling ---------- */
  function writeDialog(id, cancelling) {
    var e = S.get('events', id); if (!e || !organiser()) return;
    var n = E.coming(signups(), e.id).filter(function (x) { return x !== (me() || {}).id; }).length;
    if (!n && !cancelling) { H.toast(T('Nobody has signed up yet.'), true); return; }
    var title = cancelling ? T('Cancelled: {title}', { title: e.title }) : e.title;
    var text = cancelling ? T('We’re sorry – {title} on {day} has been cancelled.', { title: e.title, day: H.fmt(e.date, true) }) : '';
    H.modal(H.dialogHead(cancelling ? T('Cancel the event') : T('Message everyone coming'), n ? TN('It goes to {n} person.', 'It goes to {n} people.', n) : T('Nobody has signed up yet.')) + '<div class="dlg-body">' +
      (n ? '<label class="field req">' + T('Subject') + '<input id="ev-mt" maxlength="120" value="' + esc(title) + '"></label><label class="field req">' + T('Message') + '<textarea id="ev-mb" rows="5" maxlength="4000">' + esc(text) + '</textarea></label>' : '') +
      (cancelling ? '<p class="hint">' + T('The event stays on the list, marked Cancelled, so people who look for it know.') + '</p>' : '') + '</div>' +
      '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Back') + '</button><button class="btn primary' + (cancelling ? ' danger' : '') + '" data-act="events:send" data-id="' + esc(e.id) + '"' + (cancelling ? ' data-cancel="1"' : '') + '>' +
      (cancelling ? (n ? T('Cancel it and tell them') : T('Cancel the event')) : T('Send')) + '</button></div>', T('Message everyone coming'));
  }
  function send(el) {
    var e = S.get('events', el.dataset.id), u = S.get('people', (me() || {}).id) || me(); if (!e || !u || !organiser()) return;
    var cancelling = !!el.dataset.cancel, body = val('ev-mb').trim(), title = val('ev-mt').trim();
    var m = E.messageAll(e, signups(), u, title, body);
    if (m.to.length && !body) { H.toast(T('Write a message first.'), true); return; }
    if (cancelling) { var x = Object.assign({}, e, { status: 'cancelled' }); S.put('events', x, audit('cancelled ' + e.title + ' (' + e.date + ')')); }
    if (m.to.length && H.isOn('messages')) S.put('messages', m, audit('wrote to everyone coming to ' + e.title + ' (' + m.to.length + (m.to.length === 1 ? ' person)' : ' people)')));
    H.closeModal(); H.render();
    H.toast(cancelling ? T('Cancelled.') + (m.to.length ? ' ' + T('Everyone coming has been told.') : '') : T('Sent'));
  }
  /* ---------- the sign-up report: printed, saved as a PDF, or downloaded (organisers and staff) ---------- */
  var PP = function () { return window.PeopleParts || {}; };
  /** A person's cellphone as this viewer may see it ('' when it isn't shared with them). */
  function phoneOf(p) { var P = PP(); return p && P.mayShare && P.mayShare(p, 'mobile') ? String(p.mobile || '') : ''; }
  function emailOf(p) { var P = PP(); return p && P.mayShare && P.mayShare(p, 'email') && !/@pin\.church-hub\.invalid$/i.test(p.email || '') ? String(p.email || '') : ''; }
  /** May this viewer have contact details as plain text (a print or a download)? Church Partners who organise see them as pictures only. */
  function plainContacts() { var P = PP(); return !P.seeTier || P.seeTier() !== 'member'; }
  /** One sign-up's people to contact: [{ name, phone, email }] (the one who signed up first; children only if nobody else has a number). */
  function contactRows(s) {
    var out = E.contacts(s).map(function (id) { var p = S.get('people', id); return p ? { p: p, name: H.name(p), phone: phoneOf(p), email: emailOf(p) } : null; }).filter(Boolean);
    var adults = out.filter(function (c) { return c.p.familyRole !== 'child'; });
    return adults.length ? adults : out;
  }
  function repEvents() { return E.upcoming(events(), now()).filter(function (e) { return e.signup && e.status !== 'cancelled'; }); }
  function reportDialog(id) {
    if (!adder()) return;
    var choices = repEvents(), one = id ? S.get('events', id) : null;
    if (one && choices.indexOf(one) < 0) choices = [one].concat(choices);
    if (!choices.length) { H.toast(T('No events with sign-ups coming up.'), true); return; }
    if (!state.rep || id) state.rep = { ids: one ? [one.id] : choices.map(function (e) { return e.id; }), email: false };
    H.modal(H.dialogHead(T('Sign-up report'), T('Everyone signed up, with their cellphone numbers. Print it, or choose “Save as PDF” as the printer to make a PDF.')) +
      '<div class="dlg-body"><div id="ev-rep"></div>' +
      '<label class="check" style="margin-top:12px"><input type="checkbox" id="ev-rep-mail"' + (state.rep.email ? ' checked' : '') + '><span>' + T('Also show email addresses') + '</span></label>' +
      '<p class="hint">' + T('It has people’s personal details on it: keep it safe, and shred it after the event.') + '</p></div>' +
      '<div class="dlg-foot"><button class="btn" data-act="events:repcsv">' + T('Download (spreadsheet)') + '</button><button class="btn primary" data-act="events:repprint">' + H.icon(PRINTER, 18) + ' ' + T('Print or save as PDF') + '</button></div>', T('Sign-up report'));
    state.repChoices = choices.map(function (e) { return e.id; });
    var m = document.getElementById('ev-rep-mail'); if (m) m.addEventListener('change', function () { state.rep.email = m.checked; });
    repParts();
  }
  function repParts() {
    var box = document.getElementById('ev-rep'), r = state.rep; if (!box || !r) return;
    var ids = state.repChoices || [], sel = E.report(events(), signups(), r.ids), n = sel.reduce(function (a, x) { return a + x.count.total; }, 0);
    box.innerHTML = '<p style="margin:0 0 6px"><b>' + T('Which events') + '</b></p><div class="pchips">' + ids.map(function (eid) {
      var e = S.get('events', eid); if (!e) return '';
      var o = r.ids.indexOf(eid) >= 0, c = E.count(signups(), eid).total;
      return '<button type="button" class="pchip' + (o ? ' on' : '') + '" aria-pressed="' + o + '" data-act="events:repone" data-id="' + esc(eid) + '">' + (o ? H.icon(H.ICON.check, 15) : '') +
        '<span>' + esc(e.title) + '<small>' + esc(H.fmt(e.date, true)) + ' · ' + esc(TN('{n} coming', '{n} coming', c)) + '</small></span></button>';
    }).join('') + '</div><p class="muted small" style="margin:8px 0 0">' + esc(TN('{n} event', '{n} events', sel.length)) + ' · ' + esc(TN('{n} coming', '{n} coming', n)) + '</p>';
    var go = document.querySelector('[data-act="events:repprint"]'); if (go) go.disabled = !sel.length;
  }
  /** The pages: one event after another, each starting on a new A4 page. */
  function printReport() {
    var r = state.rep; if (!r || !adder()) return;
    var sel = E.report(events(), signups(), r.ids); if (!sel.length) return;
    var st = S.settings() || {}, plain = plainContacts(), mail = r.email;
    var cell = function (v, p, f) { if (!v) return '<span class="er-none">–</span>'; return plain ? esc(v) : (PP().contactHtml ? PP().contactHtml(p, f) : ''); };
    var html = sel.map(function (x) {
      var e = x.event, c = x.count;
      return '<section class="er-sheet"><div class="er-head"><div><h1>' + esc(e.title) + '</h1><p>' + esc(H.fmt(e.date, true) + ' · ' + timeText(e) + (where(e) ? ' · ' + where(e) : '')) + '</p></div>' +
        '<div class="er-count"><b>' + c.total + '</b><span>' + esc(TN('{n} coming', '{n} coming', c.total).replace(/^\d+\s*/, '')) + '</span>' +
        (c.guests ? '<small>' + esc(TN('{n} person', '{n} people', c.people)) + ' + ' + esc(TN('{n} guest', '{n} guests', c.guests)) + '</small>' : '') + '</div></div>' +
        (x.rows.length ? '<table><thead><tr><th class="er-n">#</th><th>' + esc(T('Name')) + '</th><th>' + esc(T('Cellphone')) + '</th>' + (mail ? '<th>' + esc(T('Email')) + '</th>' : '') +
          '<th class="er-g">' + esc(T('Guests')) + '</th><th>' + esc(T('Notes')) + '</th><th class="er-tick">✓</th></tr></thead><tbody>' + x.rows.map(function (s, i) {
            var who = contactRows(s), by = s.addedBy ? S.get('people', s.addedBy) : null, many = who.length > 1;
            var label = function (k) { return many ? '<small>' + esc(k.p.preferredName || k.p.firstName || '') + '</small> ' : ''; };
            var notes = [by ? T('Added by {name}', { name: H.name(by) }) : '', s.email ? T('Email reminders') : ''].filter(Boolean);
            return '<tr><td class="er-n">' + (i + 1) + '</td><td><b>' + esc((s.names || []).join(', ')) + '</b></td>' +
              '<td>' + who.map(function (k) { return '<div>' + (k.phone ? label(k) : '') + cell(k.phone, k.p, 'mobile') + '</div>'; }).filter(function (d, j) { return who[j].phone || j === 0; }).join('') + '</td>' +
              (mail ? '<td>' + who.map(function (k) { return k.email ? '<div>' + cell(k.email, k.p, 'email') + '</div>' : ''; }).join('') + '</td>' : '') +
              '<td class="er-g">' + (s.guests || '') + '</td><td class="er-notes">' + esc(notes.join(' · ')) + '</td><td class="er-tick"><i></i></td></tr>';
          }).join('') + '</tbody></table>' : '<p>' + esc(T('Nobody has signed up yet.')) + '</p>') +
        '<div class="er-foot"><span>' + esc(T('Personal information – keep it safe, and shred it after the event.')) + '</span><span>' + esc(st.churchName || '') + ' · ' +
        esc(T('Printed {date}', { date: H.fmt(H.today(), true) })) + ' · Church &amp; Trellis</span></div></section>';
    }).join('');
    var box = document.getElementById('print-only') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'print-only' }));
    H.closeModal();
    box.className = 'evrep'; box.innerHTML = html; document.documentElement.classList.add('printing');
    var done = function () { document.documentElement.classList.remove('printing'); box.innerHTML = ''; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    S.audit(audit('printed the sign-up report (' + sel.length + (sel.length === 1 ? ' event' : ' events') + ', with cellphone numbers' + (mail ? ' and email addresses' : '') + ')'), 'eventSignups');
    setTimeout(function () { try { window.print(); } catch (err) { done(); H.toast(T('Printing works best from a computer.'), true); } }, 50);
  }
  /** The same as a spreadsheet (.csv, opens in Excel or Google Sheets): one row per sign-up. */
  function reportCsv() {
    var r = state.rep; if (!r || !adder()) return;
    var sel = E.report(events(), signups(), r.ids); if (!sel.length) return;
    var plain = plainContacts(), mail = r.email && plain;
    var q = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    var join = function (who, f) { return who.filter(function (k) { return k[f]; }).map(function (k) { return (who.length > 1 ? (k.p.preferredName || k.p.firstName) + ': ' : '') + k[f]; }).join('; '); };
    var rows = [[T('Event'), T('Date'), T('Name'), T('Cellphone')].concat(mail ? [T('Email')] : []).concat([T('Guests'), T('Notes')])];
    sel.forEach(function (x) {
      x.rows.forEach(function (s) {
        var who = contactRows(s), by = s.addedBy ? S.get('people', s.addedBy) : null;
        rows.push([x.event.title, x.event.date, (s.names || []).join(', '), plain ? join(who, 'phone') : ''].concat(mail ? [join(who, 'email')] : [])
          .concat([s.guests || 0, [by ? T('Added by {name}', { name: H.name(by) }) : '', s.email ? T('Email reminders') : ''].filter(Boolean).join(' · ')]));
      });
    });
    H.download((sel.length === 1 ? sel[0].event.title + ' ' + sel[0].event.date : T('Sign-up report') + ' ' + H.today()).replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-') + '.csv',
      '\ufeff' + rows.map(function (rw) { return rw.map(q).join(','); }).join('\r\n'), 'text/csv');
    S.audit(audit('downloaded the sign-up report (' + sel.length + (sel.length === 1 ? ' event' : ' events') + ')'), 'eventSignups');
  }

  /* ---------- staff: adding people (e.g. from a paper sign-up sheet) ---------- */
  /** The person and the others in their household (as I see them), them first. */
  function familyOf(p) {
    var fam = p.familyId ? S.find('people', function (x) { return x.id !== p.id && x.familyId === p.familyId && alive(x); }) : [];
    return [p].concat(fam.sort(function (a, b) { return (a.familyRole === 'child') - (b.familyRole === 'child') || H.byName(a, b); }));
  }
  function coming(e, pid) { return !!E.mine(signups(), e.id, pid); }
  function addDialog(id, pid) {
    var e = S.get('events', id); if (!e || !addable(e)) return;
    var sub = H.fmt(e.date, true) + ' · ' + timeText(e);
    if (!pid) {
      var pick = S.find('people', alive).sort(H.byName);
      var finder = window.CareUI && CareUI.finder ? CareUI.finder('ev-add', pick, 'events:addpick', { event: e.id }, function (p) { return coming(e, p.id) ? T('Already coming') : ''; },
        T('Find someone: type part of their name'), { keep: false }) : '';
      H.modal(H.dialogHead(T('Add people') + ': ' + e.title, sub) + '<div class="dlg-body"><p class="hint" style="margin-top:0">' +
        T('For people who put their name down on a sheet or told you in person. It is in their name, so they see it under Events and get the reminders.') + '</p>' + finder + '</div>' +
        '<div class="dlg-foot"><button class="btn primary" data-act="hub:close">' + T('Done') + '</button></div>', T('Add people'));
      var q = document.querySelector('#modal .cg-q'); if (q) q.focus();
      return;
    }
    var p = S.get('people', pid); if (!p) return;
    if (coming(e, p.id)) { H.toast(T('{name} is already on the list.', { name: H.name(p) }), true); return; }
    var fam = familyOf(p); state.pick = {}; state.pick[p.id] = 1;
    H.modal(H.dialogHead(T('Add people') + ': ' + e.title, sub) + '<div class="dlg-body ev-join">' +
      '<p class="ev-q">' + (fam.length > 1 ? T('Who’s coming?') : esc(H.name(p))) + '</p><div class="ev-people">' + fam.map(function (x) {
        var already = coming(e, x.id), onP = !!state.pick[x.id];
        return '<button type="button" class="ev-person' + (onP ? ' on' : '') + '" aria-pressed="' + onP + '" data-act="events:pick" data-id="' + esc(x.id) + '"' + (fam.length === 1 || already ? ' disabled' : '') +
          (already ? ' title="' + esc(T('Already coming')) + '"' : '') + '>' + H.avatar(x, 34) + '<span>' + esc(x.preferredName || x.firstName) + (already ? ' <small>' + esc(T('Already coming')) + '</small>' : '') + '</span><i aria-hidden="true">✓</i></button>';
      }).join('') + '</div>' +
      (e.guests ? '<p class="ev-q">' + T('Bringing guests?') + '</p><div class="ev-step"><button type="button" class="icon-btn" data-act="events:step" data-d="-1" aria-label="' + esc(T('One less')) + '">−</button>' +
        '<output id="ev-g" aria-live="polite">0</output><button type="button" class="icon-btn" data-act="events:step" data-d="1" data-max="' + e.guests + '" aria-label="' + esc(T('One more')) + '">+</button>' +
        '<small class="muted">' + esc(TN('Up to {n} guest', 'Up to {n} guests', e.guests)) + '</small></div>' : '') +
      '<p class="cm-err" id="ev-err" role="alert"></p></div>' +
      '<div class="dlg-foot"><button class="btn" data-act="events:add" data-id="' + esc(e.id) + '">' + T('Choose someone else') + '</button>' +
      '<button class="btn primary" data-act="events:addsave" data-id="' + esc(e.id) + '" data-p="' + esc(p.id) + '">' + T('Add to the list') + '</button></div>', T('Add people'));
  }
  function addSave(el) {
    var e = S.get('events', el.dataset.id), p = S.get('people', el.dataset.p), u = S.get('people', (me() || {}).id) || me();
    if (!e || !p || !u || !addable(e)) return;
    var people = Object.keys(state.pick).filter(function (k) { return state.pick[k] && !coming(e, k); });
    var x = E.add(e, p, { people: people, guests: +((document.getElementById('ev-g') || {}).textContent || 0) }, familyOf(p), u, now());
    if (x.error) { document.getElementById('ev-err').textContent = T(ERR[x.error]); return; }
    S.put('eventSignups', x, audit('added ' + x.people.length + (x.people.length === 1 ? ' person' : ' people') + ' to the list for ' + e.title));
    H.render(); addDialog(e.id);
    H.toast(T('{name} is on the list.', { name: (x.names || []).join(', ') }));
  }

  /* ---------- choosing the organisers (Administrators) ---------- */
  function organiserIds() { return Access.jobHolders('organisers', 'events', S.settings(), S.find('people', function (p) { return alive(p) && p.familyRole !== 'child'; })); }
  function organisersDialog() {
    if (!manager()) return;
    var ids = organiserIds(), chosen = Array.isArray(((S.settings() || {}).organisers || {}).events);
    var rows = ids.map(function (id) { return S.get('people', id); }).filter(Boolean).sort(H.byName).map(function (p) {
      return '<div class="item">' + H.avatar(p, 32) + '<span class="grow"><b>' + esc(H.name(p)) + '</b><small>' + esc(H.personRole(p)) + '</small></span>' +
        '<button class="icon-btn ghost" data-act="events:orgout" data-id="' + esc(p.id) + '" aria-label="' + esc(T('Take {name} out', { name: H.name(p) })) + '">' + H.icon(H.ICON.x, 16) + '</button></div>';
    }).join('');
    var pick = S.find('people', function (p) { return alive(p) && p.familyRole !== 'child' && ids.indexOf(p.id) < 0 && (p.category === 'Church Partner' || p.category === 'Staff' || (p.appRole && p.appRole !== 'member' && p.appRole !== 'none')); });
    var finder = window.CareUI && CareUI.finder ? CareUI.finder('ev-orgs', pick, 'events:orgin', {}, null, T('Add an organiser: type part of their name')) : '';
    H.modal(H.dialogHead(T('Event organisers'), T('Events')) + '<div class="dlg-body"><p class="hint" style="margin-top:0">' +
      T('Organisers put events up, see who’s coming and write to them. Until you choose, they are the Administrators, the Pastors and the church secretary.') + '</p>' +
      '<div class="list">' + rows + '</div><div style="margin-top:10px">' + finder + '</div>' +
      (chosen ? '<p><button class="link" data-act="events:orgreset">' + T('Use the first organisers again') + '</button></p>' : '') + '</div>' +
      '<div class="dlg-foot"><button class="btn primary" data-act="hub:close">' + T('Done') + '</button></div>', T('Event organisers'));
  }
  function setOrganisers(ids, what) {
    var o = Object.assign({}, (S.settings() || {}).organisers || {});
    if (ids) o.events = ids; else delete o.events;
    S.setSettings({ organisers: o }, audit(what)); organisersDialog();
  }

  /* ---------- reminders in Messages: 3 days and 1 day before ---------- */
  // Each person's own Church & Trellis writes their reminder into their inbox once it is due (fixed id: never twice). There is
  // no server, so a reminder arrives when the app is next open – on Home, Messages or anywhere – and the menu badge shows it.
  function remind() {
    var u = me();
    if (!u || S.preview() || !H.isOn('events') || !H.isOn('messages') || (S.offline && S.offline())) return;
    var have = S.list('messages').map(function (m) { return m.id; }).concat(Object.keys(state.written));
    E.toRemind(events(), signups(), u.id, have, now()).forEach(function (x) {
      var m = E.reminder(x.event, u.id, x.r, now(), T, function (d) { return H.fmt(d, true); });
      state.written[m.id] = 1;
      S.put('messages', m);
    });
  }
  function remindSoon() { clearTimeout(state.timer); state.timer = setTimeout(remind, 2500); }

  /* ---------- tidying (organisers; POPIA: kept no longer than needed) ---------- */
  function tidy() {
    if (!organiser()) return;
    var all = S.list('events'), t = now();
    signups().filter(function (s) { return E.staleSignup(s, all, t); }).forEach(function (s) { S.remove('eventSignups', s.id); });
    all.filter(function (e) { return E.staleEvent(e, t); }).forEach(function (e) { S.remove('events', e.id, audit('deleted ' + e.title + ' (a year after it)')); });
  }

  /* ---------- Home: what's coming up ---------- */
  function homeCard() {
    if (!H.can('events.view')) return '';
    remindSoon();
    var t = now(), soon = E.upcoming(events(), t).filter(function (e) { return e.status !== 'cancelled' && E.startOf(e) - t < 45 * 864e5; }).slice(0, 2);
    if (!soon.length) return '';
    return '<section class="panel ev-home"><div class="cm-home-h"><h2>' + H.icon(CAL, 18) + ' ' + T('Coming up') + '</h2></div>' + grid(soon) +
      '<p class="cm-home-more"><a href="#/events">' + T('All events') + ' →</a></p></section>';
  }

  H.register({
    id: 'events', name: 'Events', desc: 'Church events people sign up for, with reminders 3 days and 1 day before', tint: '#7A4FD0', optIn: true, roles: [], perm: 'events.view',
    icon: CAL,
    stat: function () { var n = E.upcoming(events(), now()).filter(function (e) { return e.status !== 'cancelled'; }).length; return n ? TN('{n} coming up', '{n} coming up', n) : T('Church events people sign up for, with reminders 3 days and 1 day before'); },
    signedIn: function () { remindSoon(); if (!state.iv) state.iv = setInterval(remind, 15 * 60000); },
    homeCard: homeCard,
    render: render,
    actions: {
      'new': function () { eventDialog(''); },
      edit: function (el) { eventDialog(el.dataset.id); },
      who: function (el) {
        document.querySelectorAll('.ev-pill').forEach(function (b) { var o = b === el; b.classList.toggle('on', o); b.setAttribute('aria-checked', String(o)); });
        document.getElementById('ev-who').value = el.dataset.w;
      },
      save: save,
      join: function (el) { joinDialog(el.dataset.id); },
      pick: function (el) {
        var id = el.dataset.id; state.pick[id] = !state.pick[id];
        el.classList.toggle('on', !!state.pick[id]); el.setAttribute('aria-pressed', String(!!state.pick[id]));
      },
      step: function (el) {
        var o = document.getElementById('ev-g'); if (!o) return;
        var max = +((document.querySelector('[data-act="events:step"][data-max]') || {}).dataset || {}).max || 0;
        o.textContent = String(Math.max(0, Math.min(max, (+o.textContent || 0) + (+el.dataset.d))));
      },
      signup: signup,
      leave: leave,
      ics: function (el) { var e = S.get('events', el.dataset.id); if (e) H.download(e.title.replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-') + '.ics', E.ics(e, church(), now()), 'text/calendar'); },
      write: function (el) { writeDialog(el.dataset.id, false); },
      cancel: function (el) { writeDialog(el.dataset.id, true); },
      send: send,
      restore: function (el) { var e = S.get('events', el.dataset.id); if (!e || !organiser()) return; S.put('events', Object.assign({}, e, { status: 'live' }), audit(e.title + ' is on again')); H.render(); H.toast(T('It’s on again.')); },
      del: function (el) {
        var e = S.get('events', el.dataset.id); if (!e || !organiser() || !H.confirmBtn(el, T('Delete it and its sign-ups?'))) return;
        E.of(signups(), e.id).forEach(function (s) { S.remove('eventSignups', s.id); });
        S.remove('events', e.id, audit('deleted ' + e.title + ' (' + e.date + ')')); H.go('events'); H.toast(T('Deleted'));
      },
      add: function (el) { addDialog(el.dataset.id); },
      addpick: function (el) { addDialog(el.dataset.event, el.dataset.id); },
      addsave: addSave,
      out: function (el) { var s = S.get('eventSignups', el.dataset.id); if (!s || !(organiser() || (s.addedBy && s.addedBy === (me() || {}).id)) || !H.confirmBtn(el, '✕?')) return; S.remove('eventSignups', s.id, audit('took someone off the list for an event')); H.render(); },
      report: function (el) { reportDialog(el.dataset.id || ''); },
      repone: function (el) {
        var r = state.rep, id = el.dataset.id; if (!r) return;
        r.ids = r.ids.indexOf(id) >= 0 ? r.ids.filter(function (x) { return x !== id; }) : r.ids.concat([id]); repParts();
      },
      repprint: printReport,
      repcsv: reportCsv,
      organisers: organisersDialog,
      orgin: function (el) { if (manager()) setOrganisers(organiserIds().concat([el.dataset.id]), 'added an organiser'); },
      orgout: function (el) { if (manager()) setOrganisers(organiserIds().filter(function (x) { return x !== el.dataset.id; }), 'took an organiser out'); },
      orgreset: function () { if (manager()) setOrganisers(null, 'went back to the first organisers'); }
    }
  });
})();
