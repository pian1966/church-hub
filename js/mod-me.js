/* Church & Trellis – Me: a person's own details, days away and where they'd like to serve.
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
  var FREQ = ['weekly', 'monthly', 'quarterly', 'emergency'];
  var PURPOSES = ['Church records', 'Email', 'SMS', 'Church directory', 'Care group', 'Photos'];
  var APK = 'https://github.com/pian1966/church-hub/releases/download/android/ChurchHub.apk';   // built by .github/workflows/build-android.yml

  var pickSlot = '';   // the service chosen under Me → Serving (Where would you like to help?)
  function me() { return H.user(); }
  function pos(id) { return S.get('positions', id); }
  function team(id) { return S.get('teams', id); }
  function posName(id) { var p = pos(id); return p ? p.name + ' · ' + ((team(p.teamId) || {}).name || '') : T('A position that has been removed'); }
  function freqText(f) {
    if (f === 'weekly') return T('Whenever necessary (could be every week)');
    if (f === 'monthly') return T('Once a month');
    if (f === 'quarterly') return T('Once a quarter (every 3 months or so)');
    if (f === 'break') return T('Taking a break for now');
    if (f === 'emergency') return T('Only now and then in emergencies');
    return f === 'occasional' ? T('Now and then') : T('Every 2 weeks');
  }
  function myOffers() { var u = me(); return u ? S.find('serveOffers', function (o) { return o.personId === u.id; }) : []; }
  function offerFor(positionId) { return myOffers().filter(function (o) { return o.positionId === positionId; })[0]; }
  function mySkills() { var u = me(); return S.find('skills', function (k) { return k.personId === u.id && pos(k.positionId); }); }
  function service(id) { return S.get('services', id); }
  function upcomingTurns() {
    var u = me(), t = H.today();
    return S.find('assignments', function (a) { var s = service(a.serviceId); return a.personId === u.id && s && s.date >= t; })
      .sort(function (a, b) { return Serving.byWhen(service(a.serviceId), service(b.serviceId)); });
  }
  function myAway() {
    var u = me(), t = H.today(), all = window.RosterHelpers ? RosterHelpers.awayList() : [];
    return all.filter(function (a) { return a.personId === u.id && a.to >= t; }).sort(function (a, b) { return a.from < b.from ? -1 : 1; });
  }
  /** "Away: holiday" → the word Away in the chosen language; what people typed stays as typed. */
  function reasonText(r) { var m = /^(Away|On leave)(.*)$/.exec(r || ''); return m ? (m[1] === 'Away' ? T('Away') : T('On leave')) + m[2] : r; }
  function dates(a) { return H.fmt(a.from, a.to === a.from) + (a.to !== a.from ? ' – ' + H.fmt(a.to, true) : ''); }

  function tabs(active) {
    var t = [['', T('My details')], ['consent', T('Consent')], ['away', T('Days away')], ['serve', T('Serving')]];
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
    // The same chips staff see on their profile: Church Partner, staff, their care group(s) – not where the record came from
    var chips = (window.PeopleParts ? PeopleParts.catTags(p) : '') +
      (window.LibraryUI ? LibraryUI.chip() + LibraryUI.roleChip() : '');
    var html = '<div class="me-who">' + H.avatar(p, 56) + '<div><h1>' + esc(H.name(p)) + '</h1>' + (chips ? '<div class="row me-chips">' + chips + '</div>' : '') +
      '<p class="lead">' + T('Keep your details up to date, so the church can reach you.') + '</p></div></div>' + tabs('');
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
    var wed = !child && window.PeopleParts ? PeopleParts.keyDate(p, PeopleParts.WEDDING) : '';
    if (wed) office += '<dt>' + T('Wedding anniversary') + '</dt><dd>' + esc(H.fmt(wed, true)) + '</dd>';
    var fam = p.familyId ? S.get('families', p.familyId) : null;
    if (fam) office += '<dt>' + T('Household') + '</dt><dd>' + esc(H.familyName(fam)) + '</dd>';
    office += '<dt>' + T('App access') + '</dt><dd>' + esc(H.personRole(p)) + '</dd>';
    html += '<section class="panel"><h2>' + T('Kept by the church office') + '</h2>' + (office ? '<dl class="kv">' + office + '</dl>' : '') +
      '<p class="hint">' + T(child ? 'Something wrong or missing here? Please tell the church office and they will change it.' : 'Something wrong or missing, such as your marriage or children? Ask to change it, and the church office will check it.') + '</p>' +
      (window.PeopleParts ? PeopleParts.changesMePanel() : '') + '</section>';
    html += window.PeopleParts && PeopleParts.applyMePanel ? PeopleParts.applyMePanel() : '';   // apply to become a Church Partner
    if (window.LeaveUI) html += LeaveUI.meCard();   // staff: what they have left this leave year
    if (window.BoardUI) html += BoardUI.card();   // the latest 3 notices on the Community board (js/mod-board.js)
    // Signing out and the language are in the menu (left on a computer, ☰ on a phone); here only notes about this device
    var device = (I18n.isDraft() ? '<p class="hint">' + T('This language was translated by computer and is still being checked. If something reads oddly, please tell the church office.') + '</p>' : '') +
      (window.ChurchHubApp ? '<p class="hint">' + T('Church & Trellis app, version {v}', { v: esc(appVersion()) }) + '</p>' :
        /Android/i.test(navigator.userAgent) ? '<p class="hint"><a href="' + APK + '" target="_blank" rel="noopener">' + T('Get the Church & Trellis app for Android') + '</a></p>' : '');
    if (device) html += '<section class="panel"><h2>' + T('This phone or computer') + '</h2>' + device + '</section>';
    html += '</div>';
    // My details come first; the groups come last, under their own headings, so nothing floats off to the side
    var care = window.CareUI ? CareUI.mePanel() : '';   // their care group, if they are in one
    if (care) html += '<div class="grid2 me-groups" style="margin-top:16px">' + care + '</div>';
    return html + (window.LifeUI ? LifeUI.mePanel() : '');   // their life groups (Bible studies, midweek groups)
  }
  /* ---------- consent (its own tab, so it's easy to find) ---------- */
  function renderConsent() {
    var u = me(), p = S.get('people', u.id) || u, child = p.familyRole === 'child', PP = window.PeopleParts;
    var cf = window.PeopleHelpers ? PeopleHelpers.consentFor : function () { return null; };
    var html = head(T('Consent'), esc(T('What you have agreed to, as {law} requires.', { law: PrivacyLaw.forChurch(S.settings()).short })),
      '<button class="btn primary" data-act="people:consent" data-id="' + esc(p.id) + '">' + T('Change my choices') + '</button>' +
      H.menu(T('More'), ['<button class="btn" data-act="hub:notice">' + T('Privacy notice') + '</button>']), 'consent');
    var purposes = child ? ['Church records', 'Photos', 'Children’s medical notes'] : PURPOSES;
    html += '<div class="list">' + purposes.map(function (pur) {
      var c = cf(p.id, pur), no = c && !c.given;
      return '<div class="item"><span class="grow"><b>' + esc(T(PP ? PP.purposeName(pur) : pur)) + '</b> ' + (PP ? PP.purposeTip(pur) : '') +
        (no && PP ? '<small class="muted">' + esc(PP.purposeWithout(pur)) + '</small>' : '') + '</span>' +
        (c ? (c.given ? '<span class="tag ok">' + T('Yes') + '</span>' : '<span class="tag grey">' + T('No') + '</span>') : '<span class="tag grey">' + T('Not asked yet') + '</span>') + '</div>';
    }).join('') + '</div><p class="hint" style="margin-top:12px">' + T('If you untick something, Church & Trellis tells you what it means before anything is saved.') + '</p>';
    return html;
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

  /* ---------- serving: the one place for a person's own serving ----------
   * 1 Coming up (turns to answer), 2 Where I serve (each position with its services and how often),
   * 3 When I can serve (days away, serving with family or friends), 4 Where would you like to help? (offer somewhere new). */
  function chip(x) { return '<span class="svc-chip" style="' + RosterServices.themeStyle(Serving.themeOf(x)) + '">' + esc(Serving.slotLabel(x.id, S.settings())) + '</span>'; }
  function slotOfTurn(s) { var id = Serving.slotOf(s); return Serving.savedSlots(S.settings()).filter(function (x) { return x.id === id; })[0] || { id: id, label: s.time || id, time: s.time }; }
  function renderServe() {
    var turns = upcomingTurns(), sk = mySkills(), skillPos = sk.map(function (k) { return k.positionId; }), st = S.settings();
    var print = window.RosterHelpers && RosterHelpers.canPrint() ? '<button class="btn" data-act="rosters:print">' + T('Print or download the roster') + '</button>' : '';
    var html = head(T('Serving'), T('Your turns, the positions you fill, and when you can serve.'), print, 'serve');
    // 1 Coming up: each turn says the day, the service and the position, with Yes / Can't make it
    var waiting = turns.filter(function (a) { return a.status === 'pending'; }).length;
    var why = !sk.length ? T('You’re not on a serving team yet. Choose below where you’d like to help.')
      : sk.every(function (k) { return k.frequency === 'emergency'; }) ? T('You’re a backup, so you’ll only be asked when someone is needed.')
      : T('You’re not on the roster in the coming weeks.');
    // Before the roster is made: "Are you away?"; and anyone asking me to take their place
    var RH = window.RosterHelpers, u = me(), td = H.today();
    var asksMe = S.find('serveSwaps', function (x) { var sv = service(x.serviceId); return x.toId === u.id && (x.status === 'asked' || x.status === 'taken') && sv && sv.date >= td; })
      .sort(function (a, b) { return Serving.byWhen(service(a.serviceId), service(b.serviceId)); });
    waiting += asksMe.filter(function (x) { return x.status === 'asked'; }).length;
    if (RH) html += RH.myAsks().map(RH.askCard).join('');
    // My own turns that someone else is now taking (they are theirs now, so they aren't in my list any more)
    var passed = S.find('serveSwaps', function (x) { var sv = service(x.serviceId); return x.fromId === u.id && x.status === 'taken' && sv && sv.date >= td; });
    html += '<section class="block"><h2>' + T('Coming up') + (waiting ? ' <span class="tag warn">' + esc(TN('{n} to answer', '{n} to answer', waiting)) + '</span>' : '') + '</h2>' +
      (waiting ? '<p class="muted" style="margin-top:0">' + T('Please reply so the roster can be planned.') + '</p>' : '') +
      (asksMe.length && RH ? '<div class="list" style="margin-bottom:10px">' + asksMe.map(RH.swapCard).join('') + '</div>' : '') +
      (turns.length || passed.length ? '<div class="list">' + turns.filter(function (a) { return !asksMe.some(function (x) { return x.id === a.id; }); }).map(function (a) {
        var s = service(a.serviceId), x = slotOfTurn(s), p = pos(a.positionId), d = LeaveCore.parse(s.date);
        return '<div class="item svc-tint turn" style="' + RosterServices.svcStyle(s) + '"><span class="me-cal" aria-hidden="true"><b>' + d.getDate() + '</b>' + esc(H.mon()[d.getMonth()]) + '</span>' +
          '<span class="grow"><b>' + esc(p ? p.name : T('A position that has been removed')) + '</b><small>' + esc(H.fmt(s.date, true)) + '</small><span class="svc-chips">' + chip(x) + (p && team(p.teamId) ? '<span class="svc-note">' + esc(team(p.teamId).name) + '</span>' : '') + '</span></span>' +
          (a.status === 'pending' ? '<span class="btns"><button class="btn small" data-act="rosters:reply" data-id="' + esc(a.id) + '" data-s="declined">' + T('Can’t make it') + '</button><button class="btn small ok" data-act="rosters:reply" data-id="' + esc(a.id) + '" data-s="accepted">' + T('Yes, I’ll be there') + '</button></span>' :
            '<span class="tag ' + (a.status === 'accepted' ? 'ok' : 'grey') + '">' + (a.status === 'accepted' ? T('Accepted') : T('Said no')) + '</span>') +
          swapBit(a) + (RH ? RH.crewCard(a) : '') + '</div>';
      }).join('') + passed.map(function (x) {
        var sv = service(x.serviceId), p = pos(x.positionId);
        return '<div class="item svc-tint turn passed" style="' + RosterServices.svcStyle(sv) + '"><span class="grow"><b>' + esc(p ? p.name : '') + '</b><small>' + esc(H.fmt(sv.date, true)) + '</small><small class="me-offer">' + esc(RH.swapLine(x)) + '</small></span><span class="tag ok">' + T('Covered') + '</span></div>';
      }).join('') + '</div>' : asksMe.length ? '' : '<p class="empty">' + esc(why) + '</p>') + '</section>';
    // 2 Where I serve: every position names its services – never a blank that means "all"
    if (sk.length) html += '<section class="block"><h2>' + T('Where I serve') + '</h2><div class="list">' + sk.map(function (k) {
      var o = offerFor(k.positionId), pp = pos(k.positionId), at = Serving.skillSlots(k, pp, st), tm = pp && team(pp.teamId);
      return '<div class="item my-pos"><span class="grow"><b>' + esc(pp.name) + '</b>' + (pp.tooltip ? ' ' + H.tip(pp.tooltip) : '') + (tm ? ' <span class="muted small">' + esc(tm.name) + '</span>' : '') +
        '<span class="svc-chips">' + (at.length ? at.map(chip).join('') : '<span class="tag grey">' + T('Not at any service at the moment') + '</span>') + '<span class="svc-note">' + esc(T(Serving.freqShort(k.frequency))) + '</span></span>' + offerLine(o) + '</span>' +
        (o ? '<button class="btn small" data-act="me:withdraw" data-id="' + esc(o.id) + '">' + (o.status === 'waiting' ? T('Withdraw') : T('OK')) + '</button>' :
          '<button class="btn small" data-act="me:change" data-p="' + esc(k.positionId) + '">' + T('Change') + '</button>') + '</div>';
    }).join('') + '</div><p class="hint">' + T('“Any week” means you could be asked any Sunday; “Backup only” means only when someone is needed.') + '</p></section>';
    // 3 When I can serve: days away and serving with family or friends, side by side
    html += availability();
    // 4 Where would you like to help? First the service, then a department and its positions (in that service's colours)
    var sl = Serving.allSlots(st).map(function (x) { return { x: x, d: Serving.structure(x, S.list('teams'), S.list('positions')) }; }).filter(function (y) { return y.d.length; });
    html += '<section class="block"><h2>' + T('Where would you like to help?') + '</h2><p class="muted" style="margin-top:0">' + T('First choose which Sunday service you come to (or a special service), then tap a position you’d like to help with. The roster coordinator will be in touch before you’re put on the roster.') + '</p>';
    if (!sl.length) return html + '<p class="empty">' + T('Nothing to sign up for yet.') + '</p></section>';
    var cur = sl.filter(function (y) { return y.x.id === pickSlot; })[0] || sl.filter(function (y) { return !y.x.special && sk.some(function (k) { return servesAt(k, y.x); }); })[0] || sl[0];
    pickSlot = cur.x.id;
    function cards(list, label) {
      return list.length ? '<h3 class="svc-kind">' + esc(label) + '</h3><div class="svc-grid" role="group" aria-label="' + esc(label) + '">' + list.map(function (y) {
        var n = sk.filter(function (k) { return servesAt(k, y.x); }).length;
        return RosterServices.serviceCard(y.x, 'data-act="me:slot" data-s="' + esc(y.x.id) + '"', y.x.id === cur.x.id, n ? esc(T('You serve here')) : '');
      }).join('') + '</div>' : '';
    }
    // First which Sunday service (8am, 10am or 5pm); special services (Christmas, Good Friday…) on their own below
    html += cards(sl.filter(function (y) { return !y.x.special; }), T('Which Sunday service?')) + cards(sl.filter(function (y) { return y.x.special; }), T('Special services'));
    html += '<h3 class="svc-kind" style="margin-top:18px">' + esc(T('Where at {service}?', { service: cur.x.label })) + '</h3>';
    html += '<div class="svc-page" style="' + RosterServices.themeStyle(Serving.themeOf(cur.x)) + '"><div class="dept-grid">' + cur.d.map(function (d) {
      return '<div class="dept"><b>' + esc(d.team.name) + '</b><div class="pchips">' + d.positions.map(function (p) {
        var k = sk.filter(function (y) { return y.positionId === p.id; })[0], o = offerFor(p.id), here = k && servesAt(k, cur.x);
        var tag = here ? H.icon(H.ICON.check, 15) : o ? '<span class="tag warn">' + T('Asked') + '</span>' : H.icon(H.ICON.plus, 15);
        var act = here || k ? 'data-act="me:change" data-p="' + esc(p.id) + '" data-s="' + esc(cur.x.id) + '"' : o ? 'data-act="me:asked" data-id="' + esc(o.id) + '"' : 'data-act="me:offer" data-p="' + esc(p.id) + '" data-s="' + esc(cur.x.id) + '"';
        return '<button class="pchip' + (here ? ' on' : '') + '" ' + act + ' title="' + esc(here ? T('You serve here') : o ? T('Waiting for the roster coordinator') : T('I’d like to help')) + '">' + tag + esc(p.name) + '</button>';
      }).join('') + '</div></div>';
    }).join('') + '</div></div>';
    if (sl.length > 1) html += '<p class="hint">' + T('Serve at more than one service? Choose another one above.') + '</p>';
    // Offers to join a team, with the roster coordinator's answer
    var asked = myOffers().filter(function (o) { return skillPos.indexOf(o.positionId) < 0; });
    if (asked.length) html += '<div class="list" style="margin-top:12px">' + asked.map(function (o) {
      return '<div class="item"><span class="grow"><b>' + esc(posName(o.positionId)) + '</b>' + offerLine(o) + '</span><button class="btn small" data-act="me:withdraw" data-id="' + esc(o.id) + '">' + (o.status === 'waiting' ? T('Withdraw') : T('OK')) + '</button></div>';
    }).join('') + '</div>';
    return html + '</section>';
  }
  /** Under a turn I can't make: whom I asked to take my place, and – if they said no – a way to ask someone else. */
  function swapBit(a) {
    var RH = window.RosterHelpers, sw = RH && RH.swapOf(a.id);
    if (a.status !== 'declined') return '';
    if (!sw) return (a.cover || []).length && H.isOn('messages') ? '<span class="turn-more"><button class="link" data-act="rosters:reask" data-id="' + esc(a.id) + '">' + T('Ask someone to take my place') + '</button></span>' : '';
    return '<span class="turn-more"><small class="me-offer">' + esc(RH.swapLine(sw)) + '</small>' + (sw.status === 'declined' && (a.cover || []).length > 1 ? ' <button class="link" data-act="rosters:reask" data-id="' + esc(a.id) + '">' + T('Ask someone else') + '</button>' : '') + '</span>';
  }
  /** When I can serve: my next days away, and who I serve with – with a way to change each. */
  function availability() {
    var u = me(), away = myAway(), gs = S.find('groups', function (g) { return g.kind === 'together' && (g.memberIds || []).indexOf(u.id) >= 0; });
    return '<section class="block"><h2>' + T('When I can serve') + '</h2><div class="grid2">' +
      '<div class="panel" style="margin:0"><h3 style="margin-top:0">' + T('Days away') + '</h3>' + (away.length ? '<div class="list">' + away.slice(0, 3).map(function (a) {
        return '<div class="item"><span class="grow"><b>' + esc(dates(a)) + '</b><small>' + esc(reasonText(a.reason)) + '</small></span></div>';
      }).join('') + '</div>' + (away.length > 3 ? '<p class="hint">' + esc(TN('and {n} more', 'and {n} more', away.length - 3)) + '</p>' : '') : '<p class="muted" style="margin-top:0">' + T('None – you can be asked on any Sunday you serve.') + '</p>') +
      '<p style="margin:10px 0 0"><button class="btn small" data-act="rosters:addaway">' + H.icon(H.ICON.plus, 16) + T('Add days away') + '</button> ' + (away.length ? '<a class="btn small" href="#/me/away">' + T('See all') + '</a>' : '') + '</p></div>' +
      '<div class="panel" style="margin:0"><h3 style="margin-top:0">' + T('Serve with family or friends') + '</h3>' + (gs.length ? '<div class="list">' + gs.map(function (g) {
        return '<div class="item"><span class="grow"><b>' + esc(g.name) + '</b><small>' + esc(g.memberIds.filter(function (m) { return m !== u.id; }).map(function (m) { return H.name(S.get('people', m)); }).filter(Boolean).join(', ')) + '</small></span><span class="tag">' + T(g.strength === 'must' ? 'Always together' : 'Together when possible') + '</span></div>';
      }).join('') + '</div>' : '<p class="muted" style="margin-top:0">' + T('Tell us who you’d like to serve with, and the roster will keep you together.') + '</p>') +
      '<p style="margin:10px 0 0"><a class="btn small" href="#/rosters/together">' + (gs.length ? T('Change') : T('Serving together')) + '</a></p></div></div></section>';
  }
  /** Does this skill include that service? (No services ticked = every service the position runs at.) */
  function servesAt(k, x) { var p = pos(k.positionId); return p && Serving.runsAtSlot(p, x) && (!k.times || !k.times.length || k.times.indexOf(x.id) >= 0); }
  /** Under a position: what the person asked for and what the roster coordinator said. */
  function offerLine(o) {
    if (!o) return '';
    var asked = o.kind === 'stop' ? T('You asked to stop serving here.') : o.frequency === 'break' ? T('You asked for a break here.') : o.kind === 'change' ? T('You asked to serve: {how}.', { how: freqText(o.frequency).toLowerCase() }) : T('You offered to help: {how}.', { how: freqText(o.frequency).toLowerCase() });
    if (o.status === 'declined') return '<small class="me-offer">' + esc(asked) + ' <span class="tag grey">' + T('Not now') + '</span>' + (o.reply ? ' ' + esc(T('The roster coordinator says: “{text}”', { text: o.reply })) : '') + '</small>';
    return '<small class="me-offer">' + esc(asked) + ' <span class="tag warn">' + T('Waiting for the roster coordinator') + '</span></small>';
  }

  /** The services this position runs at (all the church's regular services when it isn't narrowed down). */
  function slotsFor(positionId) {
    var p = pos(positionId);
    return p ? Serving.allSlots(S.settings()).filter(function (x) { return Serving.runsAtSlot(p, x); }) : [];
  }
  function offerDialog(positionId, current, slotId) {
    var title = current ? T('Change how you serve') : T('Offer to help'), sl = slotsFor(positionId);
    var mine = current && current.times && current.times.length ? current.times.slice() : current || !slotId ? sl.map(function (x) { return x.id; }) : [slotId];
    if (current && slotId && mine.indexOf(slotId) < 0) mine.push(slotId);   // chose another service for a position they already serve in
    H.modal(H.dialogHead(title, posName(positionId)) + '<div class="dlg-body">' +
      (sl.length > 1 ? '<fieldset class="field" style="border:0;padding:0;margin:0 0 12px" id="mo-slots"><legend style="margin-bottom:6px">' + T('At which services?') + '</legend>' +
        sl.map(function (x) { return '<label class="check"><input type="checkbox" class="mo-t" value="' + esc(x.id) + '"' + (mine.indexOf(x.id) >= 0 ? ' checked' : '') + '><span>' + esc(Serving.slotLabel(x.id, S.settings())) + '</span></label>'; }).join('') + '</fieldset>' : '') +
      '<fieldset class="field" style="border:0;padding:0;margin:0 0 12px"><legend style="margin-bottom:6px">' + T('How often could you serve?') + '</legend>' +
      (current && FREQ.indexOf(current.frequency) < 0 ? '<label class="check"><input type="radio" name="mo-f" value="' + esc(current.frequency) + '" checked><span>' + T('Keep your current preference: {how}', { how: freqText(current.frequency) }) + '</span></label>' : '') +
      FREQ.map(function (f) {
      return '<label class="check"><input type="radio" name="mo-f" value="' + f + '"' + ((current ? current.frequency : 'weekly') === f ? ' checked' : '') + '><span>' + esc(freqText(f)) + (current && current.frequency === f ? ' <span class="muted small">' + T('(now)') + '</span>' : '') + '</span></label>';
      }).join('') +
      (current && FREQ.indexOf(current.frequency) < 0 ? '<p class="hint">' + T('Your current preference is {how}. Choose a new option only if you want to change it.', { how: freqText(current.frequency) }) + '</p>' : '') +
      '<p class="hint">' + T('Add any days you’re unavailable under Days away. You won’t be asked or scheduled to serve then.') + '</p>' +
      (current && current.frequency !== 'break' ? '<label class="check"><input type="radio" name="mo-f" value="break"><span><b>' + T('I’d like a break for now') + '</b><br><span class="muted small">' + T('You stay on the team, but aren’t asked until you change this back.') + '</span></span></label>' : '') +
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
      if (p[0] === 'consent') return renderConsent();
      if (p[0] === 'away') return renderAway();
      if (p[0] === 'serve') return renderServe();
      return renderDetails();
    },
    actions: {
      offer: function (el) { offerDialog(el.dataset.p, null, el.dataset.s); },
      change: function (el) { offerDialog(el.dataset.p, mySkills().filter(function (k) { return k.positionId === el.dataset.p; })[0] || null, el.dataset.s); },
      slot: function (el) { pickSlot = el.dataset.s; H.render(); },
      asked: function (el) {
        var o = S.get('serveOffers', el.dataset.id); if (!o) return;
        H.modal(H.dialogHead(posName(o.positionId)) + '<div class="dlg-body">' + offerLine(o) + '</div><div class="dlg-foot"><button class="btn" data-act="me:withdraw" data-id="' + esc(o.id) + '">' + (o.status === 'waiting' ? T('Withdraw') : T('OK')) + '</button><button class="btn" data-act="hub:close">' + T('Close') + '</button></div>', posName(o.positionId));
      },
      send: function (el) {
        var u = me(), pid = el.dataset.p, f = document.querySelector('input[name=mo-f]:checked'), err = document.getElementById('mo-err');
        var current = mySkills().filter(function (k) { return k.positionId === pid; })[0];
        if (!f) { err.textContent = T('Please choose how often.'); err.hidden = false; return; }
        var kind = f.value === 'stop' ? 'stop' : el.dataset.k, sl = slotsFor(pid);
        var times = f.value === 'break' ? (current && current.times || []).slice() : sl.length > 1 ? [].map.call(document.querySelectorAll('.mo-t:checked'), function (x) { return x.value; }) : [];
        if (kind !== 'stop' && f.value !== 'break' && sl.length > 1 && !times.length) { err.textContent = T('Please tick at least one service.'); err.hidden = false; return; }
        if (times.length === sl.length) times = [];   // every service
        var sameTimes = current && JSON.stringify((current.times || []).slice().sort()) === JSON.stringify(times.slice().sort());
        if (kind === 'change' && current && current.frequency === f.value && sameTimes) { err.textContent = T('That’s how you serve now. Choose another answer, or Cancel.'); err.hidden = false; return; }
        // One offer per position: an earlier answer is replaced by the new question
        myOffers().filter(function (o) { return o.positionId === pid; }).forEach(function (o) { S.remove('serveOffers', o.id); });
        S.put('serveOffers', { personId: u.id, positionId: pid, kind: kind, frequency: kind === 'stop' ? '' : f.value, times: kind === 'stop' ? [] : times, note: document.getElementById('mo-note').value.trim().slice(0, 300), status: 'waiting' },
          (kind === 'join' ? 'Offered to serve: ' : kind === 'stop' ? 'Asked to stop serving: ' : 'Asked to change how they serve: ') + posName(pid));
        H.closeModal(); H.render();
        H.toast(T('Sent – the roster coordinator will be in touch'));
      },
      withdraw: function (el) { S.remove('serveOffers', el.dataset.id); H.closeModal(); H.render(); }
    }
  });
})();
