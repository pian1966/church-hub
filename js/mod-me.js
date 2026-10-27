/* Church Hub – Me: a person's own details, days away and where they'd like to serve.
 * The members' part of the Android app (and of the website on a phone). It reuses the People and Rosters dialogs
 * (edit my details, consent, add away dates, accept a turn), so those rules stay in one place.
 *
 * Serving offers (collection serveOffers): a person asks to join a position, to serve more or less often, or to stop.
 * The roster coordinator answers under Rosters → Teams: Yes changes the team; "Not now" sends a short reply back.
 *   { personId, positionId, kind: join|change|stop, frequency, note, status: waiting|declined, reply }
 */
(function () {
  'use strict';
  var H = Hub, esc = H.esc, S = Store, T = I18n.t, TN = I18n.tn;
  var FREQ = ['weekly', 'fortnightly', 'monthly', 'occasional'];
  var PURPOSES = ['Church records', 'Email', 'SMS', 'Church directory', 'Photos'];
  var APK = 'https://github.com/pian1966/church-hub/releases/download/android/ChurchHub.apk';   // built by .github/workflows/build-android.yml

  function me() { return H.user(); }
  function pos(id) { return S.get('positions', id); }
  function team(id) { return S.get('teams', id); }
  function posName(id) { var p = pos(id); return p ? p.name + ' · ' + ((team(p.teamId) || {}).name || '') : T('A position that has been removed'); }
  function freqText(f) { return f === 'weekly' ? T('Every week') : f === 'monthly' ? T('Once a month') : f === 'occasional' ? T('Now and then') : T('Every 2 weeks'); }
  function myOffers() { var u = me(); return u ? S.find('serveOffers', function (o) { return o.personId === u.id; }) : []; }
  function offerFor(positionId) { return myOffers().filter(function (o) { return o.positionId === positionId; })[0]; }
  function mySkills() { var u = me(); return S.find('skills', function (k) { return k.personId === u.id && pos(k.positionId); }); }
  function service(id) { return S.get('services', id); }
  function upcomingTurns() {
    var u = me(), t = H.today();
    return S.find('assignments', function (a) { var s = service(a.serviceId); return a.personId === u.id && s && s.date >= t; })
      .sort(function (a, b) { return service(a.serviceId).date < service(b.serviceId).date ? -1 : 1; });
  }
  function myAway() {
    var u = me(), t = H.today(), all = window.RosterHelpers ? RosterHelpers.awayList() : [];
    return all.filter(function (a) { return a.personId === u.id && a.to >= t; }).sort(function (a, b) { return a.from < b.from ? -1 : 1; });
  }
  /** "Away: holiday" → the word Away in the chosen language; what people typed stays as typed. */
  function reasonText(r) { var m = /^(Away|On leave)(.*)$/.exec(r || ''); return m ? (m[1] === 'Away' ? T('Away') : T('On leave')) + m[2] : r; }
  function dates(a) { return H.fmt(a.from, a.to === a.from) + (a.to !== a.from ? ' – ' + H.fmt(a.to, true) : ''); }

  function tabs(active) {
    var t = [['', T('My details')], ['away', T('Days away')], ['serve', T('Serving')]];
    return '<nav class="seg me-tabs" aria-label="' + T('Me') + '">' + t.map(function (x) {
      var on = x[0] === active;
      return '<a href="#/me' + (x[0] ? '/' + x[0] : '') + '" class="' + (on ? 'on' : '') + '"' + (on ? ' aria-current="page"' : '') + '>' + esc(x[1]) + '</a>';
    }).join('') + '</nav>';
  }
  function head(title, lead, btns, active) {
    return '<div class="page-head me-head"><div><h1>' + esc(title) + '</h1><p class="lead">' + lead + '</p></div>' + (btns ? '<div class="btns">' + btns + '</div>' : '') + '</div>' + tabs(active);
  }

  /* ---------- my details ---------- */
  function renderDetails() {
    var u = me(), p = S.get('people', u.id) || u, child = p.familyRole === 'child';
    var none = function (unknown) { return '<span class="muted">' + (unknown ? T('Not known') : '—') + '</span>'; };
    var html = '<div class="me-who">' + H.avatar(p, 56) + '<div><h1>' + esc(H.name(p)) + '</h1><p class="lead">' + T('Keep your details up to date, so the church can reach you.') + '</p></div></div>' + tabs('');
    html += '<div class="grid2">';
    // Contact details: the person can change these themselves (security rules allow name, email and mobile)
    html += '<section class="panel"><h2>' + T('Contact details') + '</h2><dl class="kv">' +
      '<dt>' + T('First name') + '</dt><dd>' + esc(p.firstName) + '</dd><dt>' + T('Last name') + '</dt><dd>' + esc(p.lastName) + '</dd>' +
      '<dt>' + T('Known as') + '</dt><dd>' + (p.preferredName ? esc(p.preferredName) : none()) + '</dd>' +
      (!child ? '<dt>' + T('Email') + '</dt><dd>' + (p.email ? esc(p.email) : none(p.emailUnknown)) + '</dd>' +
        '<dt>' + T('Mobile') + '</dt><dd>' + (p.mobile ? esc(p.mobile) : none(p.mobileUnknown)) + '</dd>' : '') +
      '</dl><div class="btns" style="margin-top:12px"><button class="btn primary" data-act="people:edit" data-id="' + esc(p.id) + '">' + T('Change my details') + '</button></div>' +
      (Store.isLive() ? '<p class="hint">' + T('You sign in with your email address, so if you change it, sign in with the new one next time.') + '</p>' : '') + '</section>';
    // Kept by the church office: shown so people can check them, changed by the office
    var office = '';
    if (p.birthDate) office += '<dt>' + T('Birthday') + '</dt><dd>' + esc(H.fmt(p.birthDate, true)) + '</dd>';
    else if (p.birthDay) office += '<dt>' + T('Birthday') + '</dt><dd>' + esc(+p.birthDay.slice(3) + ' ' + H.mon()[+p.birthDay.slice(0, 2) - 1]) + '</dd>';
    if (!child) office += '<dt>' + T('Marital status') + '</dt><dd>' + (p.maritalStatus ? esc(T(p.maritalStatus)) : '<span class="muted">' + T('Not recorded') + '</span>') + '</dd>';
    var fam = p.familyId ? S.get('families', p.familyId) : null;
    if (fam) office += '<dt>' + T('Household') + '</dt><dd>' + esc(H.familyName(fam)) + '</dd>';
    html += '<section class="panel"><h2>' + T('Kept by the church office') + '</h2>' + (office ? '<dl class="kv">' + office + '</dl>' : '') +
      '<p class="hint">' + T('Something wrong or missing here? Please tell the church office and they will change it.') + '</p></section>';
    // Consent (POPIA): what they agreed to
    var cf = window.PeopleHelpers ? PeopleHelpers.consentFor : function () { return null; };
    html += '<section class="panel"><h2>' + T('Consent') + '</h2><p class="hint" style="margin:0 0 10px">' + T('What you have agreed to, as POPIA requires.') + '</p><div class="list">' +
      PURPOSES.map(function (pur) {
        var c = cf(p.id, pur);
        return '<div class="item"><span class="grow"><b>' + esc(T(pur)) + '</b></span>' + (c ? (c.given ? '<span class="tag ok">' + T('Yes') + '</span>' : '<span class="tag grey">' + T('No') + '</span>') : '<span class="tag grey">' + T('Not asked yet') + '</span>') + '</div>';
      }).join('') + '</div><div class="btns" style="margin-top:12px"><button class="btn" data-act="people:consent" data-id="' + esc(p.id) + '">' + T('Change my choices') + '</button> <button class="btn" data-act="hub:notice">' + T('Privacy notice') + '</button></div></section>';
    // Language and signing out: easy to find on a phone
    html += '<section class="panel"><h2>' + T('This phone or computer') + '</h2><div class="row" style="flex-wrap:wrap;gap:12px">' + I18n.picker('me-lang') +
      '<button class="btn" data-act="hub:signout" style="margin-left:auto">' + H.icon(H.ICON.out, 18) + T('Sign out') + '</button></div>' +
      (window.ChurchHubApp ? '<p class="hint">' + T('Church Hub app, version {v}', { v: esc(appVersion()) }) + '</p>' :
        /Android/i.test(navigator.userAgent) ? '<p class="hint"><a href="' + APK + '" target="_blank" rel="noopener">' + T('Get the Church Hub app for Android') + '</a></p>' : '') + '</section>';
    return html + '</div>';
  }
  function appVersion() { try { return window.ChurchHubApp.version(); } catch (e) { return ''; } }

  /* ---------- days away ---------- */
  function renderAway() {
    var u = me(), list = myAway();
    var clashes = upcomingTurns().filter(function (a) {
      var d = service(a.serviceId).date;
      return a.status !== 'declined' && list.some(function (w) { return w.from <= d && w.to >= d; });
    });
    var html = head(T('Days away'), T('Days you can’t serve. You won’t be put on the roster on them.'),
      '<button class="btn primary" data-act="rosters:addaway">' + H.icon(H.ICON.plus, 18) + T('Add days away') + '</button>', 'away');
    if (clashes.length) html += '<div class="note warn"><b>' + TN('You’re on the roster on {n} day you’re away', 'You’re on the roster on {n} days you’re away', clashes.length) + '</b><div class="list" style="margin-top:8px">' + clashes.map(function (a) {
      var s = service(a.serviceId);
      return '<div class="item"><span class="grow"><b>' + esc(posName(a.positionId)) + '</b><small>' + esc(H.fmt(s.date, true) + ', ' + s.time) + '</small></span><button class="btn small" data-act="rosters:reply" data-id="' + esc(a.id) + '" data-s="declined">' + T('Can’t make it') + '</button></div>';
    }).join('') + '</div></div>';
    html += list.length ? '<div class="list">' + list.map(function (a) {
      return '<div class="item"><span class="me-cal" aria-hidden="true"><b>' + LeaveCore.parse(a.from).getDate() + '</b>' + esc(H.mon()[LeaveCore.parse(a.from).getMonth()]) + '</span>' +
        '<span class="grow"><b>' + esc(dates(a)) + '</b><small>' + esc(reasonText(a.reason)) + '</small></span>' +
        (a.kind === 'leave' ? '<span class="tag" style="--c:#E8590C">' + T('From Leave') + '</span>' :
          '<button class="icon-btn ghost" data-act="rosters:delaway" data-id="' + esc(a.id) + '" aria-label="' + T('Remove away dates') + ': ' + esc(dates(a)) + '">' + H.icon(H.ICON.trash, 18) + '</button>') + '</div>';
    }).join('') + '</div>' : '<p class="empty">' + T('No days away coming up. Going on holiday? Add the dates here so you’re not put on the roster.') + '</p>';
    if (u.staff) html += '<p class="hint" style="margin-top:12px">' + T('Approved leave is added here automatically.') + ' <a href="#/leave">' + T('Leave') + '</a></p>';
    return html;
  }

  /* ---------- serving ---------- */
  function renderServe() {
    var turns = upcomingTurns(), sk = mySkills(), skillPos = sk.map(function (k) { return k.positionId; });
    var html = head(T('Serving'), T('Your turns on the roster, where you serve, and where you’d like to help.'), '', 'serve');
    // Coming up
    html += '<section class="block"><h2>' + T('Coming up') + '</h2>' + (turns.length ? '<div class="list">' + turns.map(function (a) {
      var s = service(a.serviceId);
      return '<div class="item"><span class="grow"><b>' + esc(posName(a.positionId)) + '</b><small>' + esc(H.fmt(s.date, true) + ', ' + s.time + ' · ' + s.name) + '</small></span>' +
        (a.status === 'pending' ? '<span class="btns"><button class="btn small" data-act="rosters:reply" data-id="' + esc(a.id) + '" data-s="declined">' + T('Can’t make it') + '</button><button class="btn small ok" data-act="rosters:reply" data-id="' + esc(a.id) + '" data-s="accepted">' + T('Accept') + '</button></span>' :
          '<span class="tag ' + (a.status === 'accepted' ? 'ok' : 'grey') + '">' + (a.status === 'accepted' ? T('Accepted') : T('Said no')) + '</span>') + '</div>';
    }).join('') + '</div>' : '<p class="empty">' + T('You’re not on the roster in the coming weeks.') + '</p>') + '</section>';
    // Where I serve now
    html += '<section class="block"><h2>' + T('Where I serve') + '</h2>' + (sk.length ? '<div class="list">' + sk.map(function (k) {
      var o = offerFor(k.positionId);
      return '<div class="item"><span class="grow"><b>' + esc(posName(k.positionId)) + '</b><small>' + esc(freqText(k.frequency)) + '</small>' + offerLine(o) + '</span>' +
        (o ? '<button class="btn small" data-act="me:withdraw" data-id="' + esc(o.id) + '">' + (o.status === 'waiting' ? T('Withdraw') : T('OK')) + '</button>' :
          '<button class="btn small" data-act="me:change" data-p="' + esc(k.positionId) + '">' + T('Change') + '</button>') + '</div>';
    }).join('') + '</div>' : '<p class="empty">' + T('You’re not on a serving team yet. Choose below where you’d like to help.') + '</p>') + '</section>';
    // Where I'd like to help
    var teams = S.list('teams').map(function (t) { return { t: t, ps: S.find('positions', function (p) { return p.teamId === t.id && skillPos.indexOf(p.id) < 0; }) }; }).filter(function (x) { return x.ps.length; });
    html += '<section class="block"><h2>' + T('Where would you like to help?') + '</h2><p class="muted" style="margin-top:0">' + T('Choose a place to serve. The roster coordinator will be in touch before you’re put on the roster.') + '</p>' +
      (teams.length ? '<div class="grid2">' + teams.map(function (x) {
        return '<section class="panel"><h3 style="margin:0 0 8px">' + esc(x.t.name) + '</h3><div class="list">' + x.ps.map(function (p) {
          var o = offerFor(p.id);
          return '<div class="item"><span class="grow"><b>' + esc(p.name) + '</b>' + offerLine(o) + '</span>' +
            (!o ? '<button class="btn small" data-act="me:offer" data-p="' + esc(p.id) + '">' + H.icon(H.ICON.plus, 16) + T('I’d like to help') + '</button>' :
              '<button class="btn small" data-act="me:withdraw" data-id="' + esc(o.id) + '">' + (o.status === 'waiting' ? T('Withdraw') : T('OK')) + '</button>') + '</div>';
        }).join('') + '</div></section>';
      }).join('') + '</div>' : '<p class="empty">' + T('You’re already on every team. Thank you!') + '</p>') + '</section>';
    html += '<section class="panel"><h2>' + T('Serve with family or friends') + '</h2><p class="muted" style="margin-top:0">' + T('Tell us who you’d like to serve with, and the roster will keep you together.') + '</p><a class="btn" href="#/rosters/together">' + T('Serving together') + '</a></section>';
    return html;
  }
  /** Under a position: what the person asked for and what the roster coordinator said. */
  function offerLine(o) {
    if (!o) return '';
    var asked = o.kind === 'stop' ? T('You asked to stop serving here.') : o.kind === 'change' ? T('You asked to serve: {how}.', { how: freqText(o.frequency).toLowerCase() }) : T('You offered to help: {how}.', { how: freqText(o.frequency).toLowerCase() });
    if (o.status === 'declined') return '<small class="me-offer">' + esc(asked) + ' <span class="tag grey">' + T('Not now') + '</span>' + (o.reply ? ' ' + esc(T('The roster coordinator says: “{text}”', { text: o.reply })) : '') + '</small>';
    return '<small class="me-offer">' + esc(asked) + ' <span class="tag warn">' + T('Waiting for the roster coordinator') + '</span></small>';
  }

  function offerDialog(positionId, current) {
    var title = current ? T('Change how often you serve') : T('Offer to help');
    H.modal(H.dialogHead(title, posName(positionId)) + '<div class="dlg-body">' +
      '<fieldset class="field" style="border:0;padding:0;margin:0 0 12px"><legend style="margin-bottom:6px">' + T('How often could you serve?') + '</legend>' +
      FREQ.map(function (f) {
        return '<label class="check"><input type="radio" name="mo-f" value="' + f + '"' + ((current ? current.frequency : 'fortnightly') === f ? ' checked' : '') + '><span>' + esc(freqText(f)) + (current && current.frequency === f ? ' <span class="muted small">' + T('(now)') + '</span>' : '') + '</span></label>';
      }).join('') +
      (current ? '<label class="check"><input type="radio" name="mo-f" value="stop"><span><b>' + T('I’d like to stop serving here') + '</b></span></label>' : '') + '</fieldset>' +
      '<label class="field">' + T('Anything the roster coordinator should know?') + '<textarea id="mo-note" rows="2" maxlength="300" placeholder="' + (current ? T('e.g. busy with exams until June') : T('e.g. I’ve helped with this before')) + '"></textarea><small>' + T('Only the roster team sees it.') + '</small></label>' +
      '<p id="mo-err" class="note bad" hidden></p></div>' +
      '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn primary" data-act="me:send" data-p="' + esc(positionId) + '" data-k="' + (current ? 'change' : 'join') + '">' + T('Send to the roster coordinator') + '</button></div>', title);
  }

  /* ---------- module ---------- */
  H.register({
    id: 'me', name: 'Me', desc: 'Your details, days away and serving', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0', tint: '#0F766E',
    stat: function (u) {
      var t = H.today(), next = S.find('assignments', function (a) { var s = service(a.serviceId); return a.personId === u.id && a.status !== 'declined' && s && s.date >= t; })
        .map(function (a) { return service(a.serviceId).date; }).sort()[0];
      return next ? T('Serving next on {date}', { date: H.fmt(next) }) : T('Your details, days away and serving');
    },
    todos: function (u) {
      var n = S.find('serveOffers', function (o) { return o.personId === u.id && o.status === 'declined'; }).length;
      return n ? [{ text: TN('The roster coordinator answered {n} of your serving offers', 'The roster coordinator answered {n} of your serving offers', n), href: '#/me/serve', tag: T('Me') }] : [];
    },
    render: function (p) {
      if (p[0] === 'away') return renderAway();
      if (p[0] === 'serve') return renderServe();
      return renderDetails();
    },
    actions: {
      offer: function (el) { offerDialog(el.dataset.p, null); },
      change: function (el) { offerDialog(el.dataset.p, mySkills().filter(function (k) { return k.positionId === el.dataset.p; })[0] || null); },
      send: function (el) {
        var u = me(), pid = el.dataset.p, f = document.querySelector('input[name=mo-f]:checked'), err = document.getElementById('mo-err');
        var current = mySkills().filter(function (k) { return k.positionId === pid; })[0];
        if (!f) { err.textContent = T('Please choose how often.'); err.hidden = false; return; }
        var kind = f.value === 'stop' ? 'stop' : el.dataset.k;
        if (kind === 'change' && current && current.frequency === f.value) { err.textContent = T('That’s how often you serve now. Choose another answer, or Cancel.'); err.hidden = false; return; }
        // One offer per position: an earlier answer is replaced by the new question
        myOffers().filter(function (o) { return o.positionId === pid; }).forEach(function (o) { S.remove('serveOffers', o.id); });
        S.put('serveOffers', { personId: u.id, positionId: pid, kind: kind, frequency: kind === 'stop' ? '' : f.value, note: document.getElementById('mo-note').value.trim().slice(0, 300), status: 'waiting' },
          (kind === 'join' ? 'Offered to serve: ' : kind === 'stop' ? 'Asked to stop serving: ' : 'Asked to change how often they serve: ') + posName(pid));
        H.closeModal(); H.render();
        H.toast(T('Sent – the roster coordinator will be in touch'));
      },
      withdraw: function (el) { S.remove('serveOffers', el.dataset.id); H.render(); }
    }
  });
})();
