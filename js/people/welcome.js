/* Church & Trellis – People: inviting people to start using Church & Trellis, and seeing who has started.
 *
 * Administrators and Pastors invite one person (from their page), the people ticked or found in Advanced search (a Care
 * Group, a Midweek Group, a serving team, everyone…), or anyone on the People list in "Select" mode. The invitation:
 *   - gives Basic access to anyone with an email address who can't sign in yet (Administrators, and Pastors who may give access);
 *   - goes as one email (everyone in Bcc), or by WhatsApp one person at a time (WhatsApp can't send to many by itself);
 *   - for people with no email address: a sign-in code each (Administrators; js/people/profile.js "Give a sign-in code");
 *   - carries the church's own link + #/start: the sign-in screen then welcomes them and shows how to get the app on their
 *     phone (the Android app, or Add to Home Screen on an iPhone) – js/app.js welcomeCard().
 * On the person: details.appInvited (the date, Administrators and Pastors only) and people.appFirstSeen (the day they first
 * signed in – written by their own sign-in, js/app.js firstSeen(); firestore.rules lets a person set it on their own record).
 * People → Invitations (#/people/welcome) lists who was invited but hasn't signed in yet, with Remind; Home has a to-do. */
(function (P) {
  'use strict';
  var H = Hub, esc = H.esc, S = Store, T = I18n.t, TN = I18n.tn;
  var REMIND_AFTER = 7;   // days after an invitation before Home's to-do counts someone as "not started yet"

  function canInvite() { return H.can('*') || H.can('people.edit'); }   // Administrators and Pastors
  function canGiveAccess() { return H.can('*') || H.can('access.manage'); }
  function signsIn(p) { return !!(p.email && p.appRole && p.appRole !== 'none'); }
  function gone(p) { return !p || p.active === false || p.binnedAt || p.mergedInto || p.category === 'Deceased' || P.deceased(p); }
  /** Who can be invited: adults still at the church. */
  function invitable(p) { return !gone(p) && p.familyRole !== 'child'; }
  function started(p) { return !!(p && p.appFirstSeen); }
  function churchName() { return (S.settings() || {}).churchName || ''; }

  /** The church's own link, opening the welcome: this address (with ?c= when this church was opened by its own link). */
  function startLink() {
    var r = window.CHURCH_HUB_CHURCH || {}, q = r.projectId && (r.from === 'link' || r.from === 'device') ? '?c=' + r.projectId : '';
    return location.origin + location.pathname.replace(/index\.html$/, '') + q + '#/start';
  }
  function greeting(name) { return T('Dear {name},', { name: name }); }
  function inviteText(name) {
    var c = churchName();
    return greeting(name) + '\n\n' + T('{church} now uses Church & Trellis, our church’s app. On your phone or computer you can see when you’re on the roster, your Care Group and Midweek Group, messages from the church, and your own details.', { church: c || T('Our church') }) +
      '\n\n' + T('Open this link to start:') + '\n' + startLink() + '\n\n' + T('Sign in with the email address this message came to. There is no password to remember. The link also shows you how to put Church & Trellis on your phone.') +
      '\n\n' + T('With love,') + '\n' + c;
  }
  /** The message for one person on WhatsApp: the message in the box, greeting them by name and naming their email address. */
  function waText(body, p, who) {
    var named = body.split(greeting(who)).join(greeting(P.known(p)));
    return named.split(T('Sign in with the email address this message came to.')).join(T('Sign in with your email address, {email}.', { email: p.email || '' }));
  }
  function waNumber(p) { return p.mobile && window.Library ? Library.intl(p.mobile, ((window.Countries && Countries.church(S.settings())) || {}).dial) : ''; }

  /** Note that these people were invited (and give Basic access to those who can't sign in yet, if asked). → how many got access */
  function markInvited(ppl, give) {
    var today = H.today(), granted = 0;
    ppl.forEach(function (p0) {
      var p = JSON.parse(JSON.stringify(p0)), why = [];
      if (give && p.email && !signsIn(p) && canGiveAccess()) { p.appRole = 'member'; granted++; why.push('given Basic access'); }
      p.appInvited = today;
      S.put('people', p, 'Invited to Church & Trellis' + (why.length ? ' (' + why.join(', ') + ')' : '') + ': ' + H.name(p));
    });
    return granted;
  }

  /** The invitation for one or more people (ids). */
  function inviteApp(ids, remind) {
    if (!canInvite()) return;
    var all = ids.map(function (id) { return S.get('people', id); }).filter(Boolean), can = all.filter(invitable);
    var already = remind ? [] : can.filter(started); can = can.filter(function (p) { return remind || !started(p); });
    var skip = all.length - can.length - already.length;
    var withEmail = can.filter(function (p) { return p.email; }), noEmail = can.filter(function (p) { return !p.email; });
    var noAccess = withEmail.filter(function (p) { return !signsIn(p); }), one = withEmail.length === 1;
    var who = one ? P.known(withEmail[0]) : T('friends'), wa = withEmail.filter(function (p) { return waNumber(p); });
    var title = remind ? T('Remind them about Church & Trellis') : T('Invite to Church & Trellis');
    var body = '';
    if (skip) body += '<p class="hint" style="margin-top:0">' + TN('{n} person is left out: a child, or no longer at the church.', '{n} people are left out: children, or no longer at the church.', skip) + '</p>';
    if (already.length) body += '<p class="hint" style="margin-top:0">' + TN('{n} person already uses Church & Trellis and is left out.', '{n} people already use Church & Trellis and are left out.', already.length) + '</p>';
    if (!can.length) body += '<p class="empty">' + T('There is nobody here to invite.') + '</p>';
    if (noAccess.length) body += canGiveAccess() ? '<label class="check"><input type="checkbox" id="ia-access" checked><span>' + TN('Give {n} person Basic access, so they can sign in with their email address', 'Give {n} people Basic access, so they can sign in with their email address', noAccess.length) + '</span></label>'
      : '<p class="note warn">' + TN('{n} can’t sign in yet. Ask an Administrator to give them Basic access first.', '{n} can’t sign in yet. Ask an Administrator to give them Basic access first.', noAccess.length) + '</p>';
    if (withEmail.length) body += '<label class="field">' + T('Subject') + '<input id="ia-sub" value="' + esc(T('Welcome to Church & Trellis at {church}', { church: churchName() })) + '"></label>' +
      '<label class="field">' + T('Message') + '<textarea id="ia-body" rows="10">' + esc(inviteText(who)) + '</textarea>' + (one ? '' : '<small>' + T('Sent as one email, with everyone in Bcc so they don’t see each other’s addresses.') + '</small>') + '</label>';
    if (wa.length) body += '<details class="ia-wa"' + (one ? ' open' : '') + '><summary>' + TN('Or send it by WhatsApp ({n} person)', 'Or send it by WhatsApp, one at a time ({n} people)', wa.length) + '</summary>' +
      '<p class="hint">' + T('Each button opens WhatsApp with the message ready, greeting them by name. Tap Send there, then come back for the next one.') + '</p><div class="list">' + wa.map(function (p) {
        return '<div class="item"><span class="grow"><b>' + esc(H.name(p)) + '</b><small>' + esc(p.mobile) + '</small></span><button class="btn small" data-act="people:welwa" data-id="' + p.id + '" data-who="' + esc(who) + '">' + T('WhatsApp') + '</button></div>';
      }).join('') + '</div></details>';
    if (noEmail.length) body += '<div class="note" style="margin-top:12px"><b>' + TN('{n} has no email address', '{n} have no email address', noEmail.length) + '</b><p class="small" style="margin:4px 0 8px">' +
      (H.can('*') ? T('Give each a sign-in code instead: they sign in with their cellphone number and a PIN. The code can go by WhatsApp or on a printed slip.') : T('An Administrator can give each a sign-in code, so they can sign in with their cellphone number and a PIN.')) + '</p>' +
      (H.can('*') ? '<div class="list">' + noEmail.map(function (p) {
        return '<div class="item"><span class="grow"><b>' + esc(H.name(p)) + '</b>' + (p.mobile ? '<small>' + esc(p.mobile) + '</small>' : '<small class="muted">' + T('No cellphone number either') + '</small>') + '</span>' +
          (P.codeable && P.codeable(p) ? '<button class="btn small" data-act="people:givecode" data-id="' + p.id + '">' + T('Give a sign-in code') + '</button>' : '<a class="btn small" href="#/people/p/' + p.id + '">' + T('Open') + '</a>') + '</div>';
      }).join('') + '</div>' : esc(noEmail.map(H.name).join(', '))) + '</div>';
    H.modal(H.dialogHead(title, TN('{n} person', '{n} people', can.length)) + '<div class="dlg-body" data-noauto>' + body + '</div>' +
      '<div class="dlg-foot"><button class="btn" data-act="people:welqr">' + T('Show the QR code') + '</button>' +
      (withEmail.length ? '<button class="btn primary" data-act="people:welsend" data-ids="' + esc(withEmail.map(function (p) { return p.id; }).join(',')) + '">' + T('Email the invitation') + '</button>' :
        '<button class="btn primary" data-act="hub:close">' + T('Close') + '</button>') + '</div>', title);
  }

  /** On a person's page: whether they use Church & Trellis yet, and Invite / Remind. */
  function welcomeLine(p) {
    if (!canInvite() || !invitable(p)) return '';
    var u = H.user(); if (u && u.id === p.id) return '';
    if (started(p)) return '<p class="badge-line"><span class="muted small">' + T('Using Church & Trellis since {date}', { date: esc(H.fmt(p.appFirstSeen, true)) }) + '</span></p>';
    return '<p class="badge-line">' + (p.appInvited ? '<span class="muted small">' + T('Invited to Church & Trellis on {date} – not signed in yet', { date: esc(H.fmt(p.appInvited, true)) }) + '</span> ' : '') +
      '<button class="btn small" data-act="people:welinvite" data-id="' + p.id + '">' + T(p.appInvited ? 'Remind them' : 'Invite to Church & Trellis') + '</button></p>';
  }

  /** Invited, but not signed in yet (oldest invitation first). */
  function waiting() {
    return S.find('people', function (p) { return invitable(p) && p.appInvited && !started(p); }).sort(function (a, b) { return a.appInvited < b.appInvited ? -1 : 1; });
  }
  function daysSince(d) { return Math.floor((Date.parse(H.today()) - Date.parse(d)) / 864e5); }
  /** Home's to-do: people invited more than a week ago who haven't signed in yet. */
  function todo() {
    if (!canInvite()) return [];
    var n = waiting().filter(function (p) { return daysSince(p.appInvited) >= REMIND_AFTER; }).length;
    return n ? [{ text: TN('{n} person invited to Church & Trellis hasn’t signed in yet', '{n} people invited to Church & Trellis haven’t signed in yet', n), href: '#/people/welcome' }] : [];
  }

  /** People → Invitations: who has been invited, who hasn't started yet, who has. */
  function renderWelcome() {
    var back = '<a class="crumb" href="#/people">' + H.icon(H.ICON.back, 16) + T('People') + '</a>';
    if (!canInvite()) return back + '<p class="empty">' + T('This is for Administrators and Pastors.') + '</p>';
    var list = waiting(), recent = S.find('people', function (p) { return invitable(p) && started(p) && p.appInvited; })
      .sort(function (a, b) { return a.appFirstSeen < b.appFirstSeen ? 1 : -1; }).slice(0, 30);
    var html = back + '<div class="page-head"><div><h1>' + T('Invitations to Church & Trellis') + '</h1><p class="lead">' + T('Who has been invited, and who has started using it.') + '</p></div>' +
      '<div class="btns">' + (list.length ? '<button class="btn primary" data-act="people:welremindall">' + TN('Remind {n} person', 'Remind all {n}', list.length) + '</button>' : '') +
      '<a class="btn' + (list.length ? '' : ' primary') + '" href="#/people/search">' + T('Invite people') + '</a></div></div>';
    if (!list.length && !recent.length) return html + '<p class="empty">' + T('Nobody has been invited yet. Invite someone from their page, or tick people in Advanced search (for example everyone in a Care Group, a Midweek Group or a serving team) and choose Invite to Church & Trellis.') + '</p>';
    if (list.length) html += '<section class="panel"><h2>' + T('Not signed in yet') + '</h2><div class="list">' + list.map(function (p) {
      return '<div class="item"><span class="grow"><a href="#/people/p/' + p.id + '"><b>' + esc(H.name(p)) + '</b></a><small>' + esc(T('Invited {date}', { date: H.fmt(p.appInvited, true) })) +
        (p.email ? '' : ' · ' + esc(T('No email address'))) + '</small></span><button class="btn small" data-act="people:welinvite" data-id="' + p.id + '">' + T('Remind') + '</button></div>';
    }).join('') + '</div><p class="hint">' + T('Someone counts as started from the first time they sign in. People who signed in before invitations began show up here until they next sign in.') + '</p></section>';
    if (recent.length) html += '<section class="panel"><h2>' + T('Started') + '</h2><div class="list">' + recent.map(function (p) {
      return '<div class="item"><span class="grow"><a href="#/people/p/' + p.id + '"><b>' + esc(H.name(p)) + '</b></a><small>' + esc(T('Signed in for the first time on {date}', { date: H.fmt(p.appFirstSeen, true) })) + '</small></span><span class="tag ok">' + T('Started') + '</span></div>';
    }).join('') + '</div></section>';
    return html;
  }

  /** The QR code for the welcome link (for the welcome desk, a notice slide or a newsletter). */
  function qrDialog() {
    H.modal(H.dialogHead(T('Scan to start'), T('Point a phone’s camera at the code.')) + '<div class="dlg-body" style="text-align:center">' +
      (window.QR ? '<div class="qr-box">' + QR.svg(startLink(), { px: 240 }) + '<p class="qr-link">' + esc(startLink()) + '</p></div>' : '<p>' + esc(startLink()) + '</p>') +
      '<p class="hint">' + T('People still need access to sign in: invite them first, or give them access on their page.') + '</p></div>' +
      '<div class="dlg-foot"><button class="btn" data-act="people:welcopy">' + T('Copy the link') + '</button><button class="btn primary" data-act="hub:close">' + T('Close') + '</button></div>', T('Scan to start'));
  }

  Object.assign(P.actions, {
    welinvite: function (el) { var p = S.get('people', el.dataset.id); inviteApp([el.dataset.id], !!(p && p.appInvited)); },
    welremindall: function () { inviteApp(waiting().map(function (p) { return p.id; }), true); },
    welqr: qrDialog,
    welcopy: function () {
      var l = startLink(), done = function () { H.toast(T('Link copied')); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(l).then(done, function () { window.prompt(T('Copy the link'), l); });
      else window.prompt(T('Copy the link'), l);
    },
    welwa: function (el) {
      var p = S.get('people', el.dataset.id), box = document.getElementById('ia-body'); if (!p) return;
      var give = document.getElementById('ia-access');
      var text = waText(box ? box.value : inviteText(P.known(p)), p, el.dataset.who || '');
      window.open('https://wa.me/' + waNumber(p) + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
      markInvited([p], give && give.checked);
      el.textContent = T('Sent'); el.disabled = true;
    },
    welsend: function (el) {
      var ppl = String(el.dataset.ids || '').split(',').filter(Boolean).map(function (id) { return S.get('people', id); }).filter(Boolean);
      var give = document.getElementById('ia-access'), granted = markInvited(ppl, give && give.checked);
      var mail = ppl.map(function (p) { return p.email; }), st = S.settings() || {}, E = window.Emails, method = E ? E.getMethod(st) : 'mail';
      var opts = { subject: document.getElementById('ia-sub').value, body: document.getElementById('ia-body').value, from: st.emailGmail || '' };
      if (mail.length === 1) opts.to = mail[0]; else { opts.to = st.emailOffice || st.emailGmail || ''; opts.bcc = mail.join(','); }
      var url = E.makeSendUrl(method, opts);
      H.closeModal(); H.render(); H.toast(granted ? TN('{n} given Basic access – now send the email', '{n} given Basic access – now send the email', granted) : T('Now send the email'));
      if (method === 'gmail') window.open(url, '_blank', 'noopener,noreferrer'); else location.href = url;
    }
  });

  Object.assign(P, { inviteApp: inviteApp, welcomeLine: welcomeLine, renderWelcome: renderWelcome, welcomeTodo: todo, appWaiting: waiting, appInvitable: invitable, markAppInvited: markInvited });
})(window.PeopleParts);
