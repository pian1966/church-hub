/* Church Hub – People: applying to become a Church Partner (the church's own word: Member, Parishioner…) and name badges.
 *
 * Applications (collection partnerApps, one per person at a time), sent from the person's own page (Me → Apply):
 *   { personId, spouse, anniversary, children, since, faith: yes|no, story, otherChurch: yes|no, otherWhich, classOk: yes|no,
 *     study, questions, serve, declaration (the words they agreed to), directory: true, status: waiting|accepted|declined,
 *     reply, approvedOn, approvedBy, note, createdAt }
 *   The ID number goes to idNumbers (Administrators only), never into the application. Administrators and Pastors read
 *   applications (People → Partnership applications, and a to-do on Home); Accept makes them a Church Partner from the
 *   date approved, which also records their Contact details consent (PeopleParts.partnerAgrees). How they came to faith is
 *   religious information (POPIA: special personal information, kept by the church for its members) – docs/POPIA.md.
 *
 * Name badges (laminated, in little pouches), on the person's details: badgeWanted (date asked) and badgePrinted (date).
 *   "Make a name badge" when adding someone; People → Name badges lays them out like the church's Google Doc (A4, 20 mm
 *   margins, 2 × 5 badges of about 73 × 41 mm with 3 pt lines to cut along; first name bold 35 pt, surname 25 pt, Open Sans). */
(function (P) {
  'use strict';
  var H = Hub, esc = H.esc, S = Store, T = I18n.t, TN = I18n.tn;
  var TX = function (s) { return s; };   // a text kept in a list, translated where it is shown (the language test checks it)
  var WEDDING = P.WEDDING;
  function keyDate() { return P.keyDate.apply(this, arguments); }
  function canReview() { return H.can('*') || H.can('people.edit'); }   // Administrators and Pastors

  /* ---------- the declaration: general wording, or the church's own (Partnership applications → Declaration) ---------- */
  var DECL = {
    general: 'I declare that I have put my trust in the Lord Jesus Christ, that I am eighteen years of age or older, and that I worship regularly at {church}. With God’s help I will do my best to carry out the responsibilities of being a Church Partner, and to show my faith by the way I live.',
    reach: 'I solemnly declare that I am a baptised person, eighteen years of age or older, and have made a personal profession of faith in the Lord Jesus Christ, am a habitual worshipper in this church (for at least 6 months), and that I accept the Constitution and Canons of REACH South Africa [Church of England in South Africa] of 1938 as amended. I further solemnly promise to adhere to the Constitution and Canons of REACH South Africa [Church of England in South Africa], to acknowledge the authority of its Synods and regularly appointed officers. I also promise that I will do my best to carry out the responsibilities of membership of this church and that, the Lord helping me, I will give evidence of my faith in the Lord Jesus Christ by my manner of life. I desire my name to be entered on the Electoral Roll of {church}.'
  };
  function declaration() {
    var st = S.settings() || {}, d = (st.partnerApp || {}).declaration || DECL.general;
    return d.replace(/\{church\}/g, st.churchName || '');
  }

  /* ---------- the person's own page: apply, and where it stands ---------- */
  function mine() { var u = H.user(); return u ? S.find('partnerApps', function (a) { return a.personId === u.id; })[0] || null : null; }
  function mayApply(p) { return p && p.familyRole !== 'child' && p.active !== false && p.category !== 'Church Partner' && p.category !== 'Deceased' && !P.deceased(p); }
  function mePanel() {
    var u = H.user(), p = u && S.get('people', u.id), a = mine();
    if (!p || (!mayApply(p) && !(a && a.status === 'declined'))) return '';
    var body;
    if (a && a.status === 'waiting') body = '<p><span class="tag warn">' + T('Sent on {date} – waiting for a Pastor to reply', { date: esc(H.fmt(String(a.createdAt || H.today()).slice(0, 10))) }) + '</span></p>' +
      '<button class="btn small" data-act="people:appwithdraw">' + T('Withdraw') + '</button>';
    else if (a && a.status === 'declined') body = '<p><span class="tag grey">' + T('Not accepted for now') + '</span>' + (a.reply ? ' ' + esc(T('The church office says: “{text}”', { text: a.reply })) : '') + '</p>' +
      '<button class="btn small" data-act="people:appwithdraw">' + T('OK') + '</button>';
    else body = '<p class="hint" style="margin-top:0">' + T('You can vote at church meetings, and lead or teach in the church.') + '</p><a class="btn primary" href="#/people/apply">' + T('Apply to become a Church Partner') + '</a>';
    return '<section class="panel" id="me-apply"><h2>' + T('Become a Church Partner') + '</h2>' + body + '</section>';
  }

  /* ---------- the form ---------- */
  function yesNo(id, label, req) {
    return '<fieldset class="field' + (req ? ' req' : '') + ' yn" id="' + id + '-f"><legend class="field-l">' + label + '</legend><label class="check inline"><input type="radio" name="' + id + '" value="yes"><span>' + T('Yes') + '</span></label>' +
      '<label class="check inline"><input type="radio" name="' + id + '" value="no"><span>' + T('No') + '</span></label></fieldset>';
  }
  function renderForm() {
    var u = H.user(), p = u && S.get('people', u.id), back = '<a class="crumb" href="#/me">' + H.icon(H.ICON.back, 16) + T('Me') + '</a>';
    if (!p || !mayApply(p)) return back + '<p class="empty">' + T('This is for adults who aren’t Church Partners yet.') + '</p>';
    if (mine() && mine().status === 'waiting') return back + '<p class="empty">' + T('Sent on {date} – waiting for a Pastor to reply', { date: esc(H.fmt(String(mine().createdAt || H.today()).slice(0, 10))) }) + '</p>';
    var adr = P.addressLines(p).join(', '), wed = keyDate(p, WEDDING);
    var kv = '<dl class="kv"><dt>' + T('Name') + '</dt><dd>' + esc(H.name(p)) + '</dd><dt>' + T('Home address') + '</dt><dd>' + esc(adr || '–') + '</dd>' +
      '<dt>' + T('Mobile') + '</dt><dd>' + esc(p.mobile || '–') + '</dd><dt>' + T('Email') + '</dt><dd>' + esc(p.email || '–') + '</dd></dl>';
    return back + '<div class="page-head"><div><h1>' + T('Apply to become a Church Partner') + '</h1><p class="lead">' + T('You’ve been coming to the church for a while. As a Church Partner you join in its life more closely: you can vote at church meetings, and lead or teach.') + '</p></div></div>' +
      '<form id="app-form" onsubmit="return false" data-noauto>' +
      '<section class="panel"><h2>' + T('About you') + '</h2>' + kv + '<p class="hint">' + T('From your details. If anything is wrong, change it under My details first.') + '</p>' +
        '<label class="field req">' + T('ID number') + '<input id="ap-id" inputmode="numeric" autocomplete="off" maxlength="20"><small>' + T('You need to be 18 or older. Only Administrators can see it.') + '</small></label>' +
        '<div class="two"><label class="field">' + T('Spouse’s name') + '<input id="ap-spouse" maxlength="80"></label><label class="field">' + T('Wedding anniversary') + '<input id="ap-wed" type="date" max="' + H.today() + '" value="' + esc(wed) + '"></label></div>' +
        '<label class="field">' + T('Children’s names') + '<input id="ap-kids" maxlength="300"></label>' +
        '<label class="field req">' + T('Coming to the church since') + '<input id="ap-since" type="month" max="' + H.today().slice(0, 7) + '"></label></section>' +
      '<section class="panel"><h2>' + T('Your faith') + '</h2>' + yesNo('ap-faith', T('Have you put your trust in the Lord Jesus Christ for forgiveness and eternal life?'), true) +
        '<label class="field req">' + T('How did you come to faith?') + '<textarea id="ap-story" rows="4" maxlength="2000"></textarea><small>' + T('A few sentences is fine. You’re welcome to talk about this with a Pastor.') + '</small></label></section>' +
      '<section class="panel"><h2>' + T('Other churches') + '</h2>' + yesNo('ap-other', T('Are you a member of another church?'), true) +
        '<label class="field">' + T('If so, which one – and should we contact them about moving your membership?') + '<input id="ap-which" maxlength="200"></label></section>' +
      '<section class="panel"><h2>' + T('You and the church') + '</h2>' + yesNo('ap-class', T('Would you come to a membership class?'), true) +
        '<label class="field">' + T('Do you go to a Bible study or midweek group? Which one?') + '<input id="ap-study" maxlength="200"></label>' +
        '<label class="field">' + T('Any questions about the church?') + '<textarea id="ap-q" rows="2" maxlength="1000"></textarea></label>' +
        '<label class="field">' + T('How would you like to serve in the church?') + '<textarea id="ap-serve" rows="2" maxlength="1000"></textarea></label></section>' +
      '<section class="panel"><h2>' + T('Declaration') + '</h2><blockquote class="decl" data-own-words>' + esc(declaration()) + '</blockquote>' +
        '<label class="check"><input type="checkbox" id="ap-decl"><span>' + T('I agree with the declaration above.') + '</span></label>' +
        '<label class="check"><input type="checkbox" id="ap-dir"><span>' + T('I agree to be in the church directory, so other members can see my contact details.') + '</span></label>' +
        '<p id="ap-err" class="note bad" role="alert" hidden></p>' +
        '<div class="btns" style="margin-top:12px"><button class="btn primary" data-act="people:appsend">' + T('Send my application') + '</button><a class="btn" href="#/me">' + T('Cancel') + '</a></div></section></form>';
  }

  /* ---------- Administrators and Pastors: People → Partnership applications ---------- */
  function waiting() { return canReview() ? S.find('partnerApps', function (a) { return a.status === 'waiting'; }) : []; }
  function answers(a) {
    var yn = function (v) { return v === 'yes' ? T('Yes') : v === 'no' ? T('No') : '–'; }, row = function (l, v) { return '<dt>' + esc(l) + '</dt><dd>' + (v ? esc(v).replace(/\n/g, '<br>') : '–') + '</dd>'; };
    return '<dl class="kv app-kv">' + row(T('Spouse’s name'), a.spouse) + row(T('Wedding anniversary'), a.anniversary ? H.fmt(a.anniversary, true) : '') + row(T('Children’s names'), a.children) +
      row(T('Coming to the church since'), a.since ? H.mon()[+a.since.slice(5, 7) - 1] + ' ' + a.since.slice(0, 4) : '') +
      row(T('Have you put your trust in the Lord Jesus Christ for forgiveness and eternal life?'), yn(a.faith)) + row(T('How did you come to faith?'), a.story) +
      row(T('Are you a member of another church?'), yn(a.otherChurch)) + row(T('If so, which one – and should we contact them about moving your membership?'), a.otherWhich) +
      row(T('Would you come to a membership class?'), yn(a.classOk)) + row(T('Do you go to a Bible study or midweek group? Which one?'), a.study) +
      row(T('Any questions about the church?'), a.questions) + row(T('How would you like to serve in the church?'), a.serve) +
      row(T('Declaration'), a.declaration) + row(T('I agree to be in the church directory, so other members can see my contact details.'), a.directory ? T('Yes') : T('No')) + '</dl>';
  }
  function appCard(a, full) {
    var p = S.get('people', a.personId); if (!p) return '';
    var sent = H.fmt(String(a.createdAt || '').slice(0, 10) || H.today());
    var head = '<div class="row" style="gap:10px">' + H.avatar(p, 36) + '<h2 class="grow" style="margin:0;font-size:1rem"><a href="#/people/p/' + p.id + '">' + esc(H.name(p)) + '</a> <span class="muted small">' + esc(T(p.category || '')) + '</span></h2>' +
      (a.status === 'waiting' ? '<span class="tag warn">' + T('To review') + '</span>' : a.status === 'accepted' ? '<span class="tag ok">' + T('Accepted') + '</span>' : '<span class="tag grey">' + T('Not accepted for now') + '</span>') + '</div>';
    var contact = '<dl class="kv"><dt>' + T('Sent on') + '</dt><dd>' + esc(sent) + '</dd><dt>' + T('Home address') + '</dt><dd>' + esc(P.addressLines(p).join(', ') || '–') + '</dd><dt>' + T('Mobile') + '</dt><dd>' + esc(p.mobile || '–') + '</dd><dt>' + T('Email') + '</dt><dd>' + esc(p.email || '–') + '</dd></dl>';
    var decided = a.status === 'accepted' ? '<p class="note ok">' + T('Approved on {date} by {name}', { date: esc(H.fmt(a.approvedOn || '')), name: esc(a.approvedBy || '–') }) + (a.note ? ' · ' + esc(a.note) : '') + '</p>' : '';
    var btns = '<div class="btns no-print">' + (a.status === 'waiting' ? '<button class="btn small primary" data-act="people:appaccept" data-id="' + a.id + '">' + T('Accept') + '</button><button class="btn small" data-act="people:appdecline" data-id="' + a.id + '">' + T('Not now') + '</button>' : '') +
      (full ? '<button class="btn small" data-act="people:appprint">' + T('Print') + '</button>' : '<a class="btn small" href="#/people/applications/' + a.id + '">' + T('Open') + '</a>') + '</div>';
    return '<section class="panel app-card" style="margin-bottom:12px">' + head + contact + (full ? answers(a) : '') + decided + btns + '</section>';
  }
  function renderApps(id) {
    var back = '<a class="crumb" href="#/people' + (id ? '/applications' : '') + '">' + H.icon(H.ICON.back, 16) + T(id ? 'Partnership applications' : 'People') + '</a>';
    if (!canReview()) return back + '<p class="empty">' + T('This is for Administrators and Pastors.') + '</p>';
    if (id) {
      var a = S.get('partnerApps', id); if (!a) return back + '<p class="empty">' + T('No applications yet.') + '</p>';
      if (!auditedApp[id]) { auditedApp[id] = 1; S.audit('Opened the partnership application of ' + H.name(S.get('people', a.personId)), 'people/' + a.personId); }   // faith: special personal information
      return back + '<div class="page-head"><div><h1>' + T('Partnership application') + '</h1></div></div><div id="app-print">' + appCard(a, true) + '</div>';
    }
    var list = S.list('partnerApps').slice().sort(function (x, y) { return (x.status === 'waiting') !== (y.status === 'waiting') ? (x.status === 'waiting' ? -1 : 1) : (y.createdAt || '') < (x.createdAt || '') ? -1 : 1; });
    return back + '<div class="page-head"><div><h1>' + T('Partnership applications') + '</h1><p class="lead">' + T('Sent from people’s own page. Accepting makes them a Church Partner.') + '</p></div></div>' +
      (list.length ? list.map(function (a) { return appCard(a, false); }).join('') : '<p class="empty">' + T('No applications yet.') + '</p>') +
      (H.can('*') ? declPanel() : '');
  }
  var auditedApp = {};
  function declPanel() {
    var st = S.settings() || {}, d = (st.partnerApp || {}).declaration || DECL.general;
    return '<section class="panel" data-noauto><h2>' + T('Declaration on the form') + '</h2><p class="hint" style="margin-top:0">' + T('The words people agree to when they apply. {church} becomes your church’s name.') + '</p>' +
      '<div class="btns" style="margin-bottom:8px"><button class="btn small" data-act="people:appdecl" data-k="general">' + T('General wording') + '</button><button class="btn small" data-act="people:appdecl" data-k="reach">REACH South Africa</button></div>' +
      '<label class="field"><span class="sr">' + T('Declaration on the form') + '</span><textarea id="ap-decltext" rows="6" data-own-words>' + esc(d) + '</textarea></label>' +
      '<button class="btn small save" data-act="people:appdeclsave">' + T('Save') + '</button></section>';
  }

  /* ---------- printing: only the part asked for, on A4 (an application, or a sheet of name badges) ---------- */
  function printOnly(html, kind) {
    var box = document.getElementById('print-only') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'print-only' }));
    box.className = kind; box.innerHTML = html; document.documentElement.classList.add('printing');
    var done = function () { document.documentElement.classList.remove('printing'); box.innerHTML = ''; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    var go = function () { try { window.print(); } catch (e) { done(); H.toast(T('Printing works best from a computer.'), true); } };
    if (kind === 'badges' && document.fonts && document.fonts.load) {   // Open Sans, as in the church's Google Doc (a usual font if offline)
      if (!document.getElementById('open-sans')) document.head.appendChild(Object.assign(document.createElement('link'), { id: 'open-sans', rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;700&display=swap' }));
      Promise.race([document.fonts.load('700 35pt "Open Sans"'), new Promise(function (r) { setTimeout(r, 1500); })]).then(function () { setTimeout(go, 50); });
    } else setTimeout(go, 50);
  }

  /* ---------- name badges ---------- */
  function badgesWaiting() { return canReview() ? S.find('people', function (p) { return p.badgeWanted && !p.badgePrinted && p.active !== false; }).sort(P.SORTS.first.cmp) : []; }
  function renderBadges() {
    var back = '<a class="crumb" href="#/people">' + H.icon(H.ICON.back, 16) + T('People') + '</a>';
    if (!canReview()) return back + '<p class="empty">' + T('This is for Administrators and Pastors.') + '</p>';
    var list = badgesWaiting();
    return back + '<div class="page-head"><div><h1>' + T('Name badges') + '</h1><p class="lead">' + T('Print them on A4, cut along the lines and slide them into the laminate pouches.') + '</p></div>' +
      (list.length ? '<div class="btns"><button class="btn primary" data-act="people:badgeprint">' + H.icon('M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6z', 18) + TN('Print {n} badge', 'Print {n} badges', list.length) + '</button>' +
        '<button class="btn" data-act="people:badgedone">' + T('Mark as printed') + '</button></div>' : '') + '</div>' +
      (list.length ? '<div class="badge-prev">' + list.map(function (p) {
        return '<div class="badge"><b>' + esc(p.preferredName || p.firstName) + '</b><span>' + esc(p.lastName) + '</span><button class="icon-btn ghost" data-act="people:badgeoff" data-id="' + p.id + '" aria-label="' + esc(T('Remove') + ': ' + H.name(p)) + '" title="' + esc(T('Remove')) + '">' + H.icon(H.ICON.x, 14) + '</button></div>';
      }).join('') + '</div><p class="hint">' + T('Printing works best from a computer.') + '</p>' : '<p class="empty">' + T('No name badges waiting. Tick “Make a name badge” when you add someone, or use the button on their page.') + '</p>');
  }
  /** A4 sheets of 10 badges, as in the church's Google Doc. */
  function badgeSheets(list) {
    var out = '';
    for (var i = 0; i < list.length; i += 10) {
      var cells = list.slice(i, i + 10), rows = '';
      for (var r = 0; r < 5; r++) {
        rows += '<tr>' + [0, 1].map(function (c) { var p = cells[r * 2 + c]; return p ? '<td><b>' + esc(p.preferredName || p.firstName) + '</b><span>' + esc(p.lastName) + '</span></td>' : '<td class="empty"></td>'; }).join('') + '</tr>';
      }
      out += '<div class="sheet"><table>' + rows + '</table></div>';
    }
    return out;
  }
  /** On a person's page (Administrators and Pastors): their name badge. */
  function badgeLine(p) {
    if (!canReview() || !p || p.active === false || P.deceased(p)) return '';
    var s = p.badgeWanted && !p.badgePrinted ? '<span class="tag warn">' + T('Name badge waiting to be printed') + '</span>' : p.badgePrinted ? '<span class="muted small">' + T('Name badge printed on {date}', { date: esc(H.fmt(p.badgePrinted)) }) + '</span>' : '';
    return '<p class="badge-line">' + s + ' ' + (p.badgeWanted && !p.badgePrinted ? '<a class="btn small" href="#/people/badges">' + T('Name badges') + '</a>' : '<button class="btn small" data-act="people:badgeon" data-id="' + p.id + '">' + T('Make a name badge') + '</button>') + '</p>';
  }
  function setBadge(p, wanted, printed, why) {
    p = JSON.parse(JSON.stringify(p));
    if (wanted) p.badgeWanted = wanted; else delete p.badgeWanted;
    if (printed) p.badgePrinted = printed; else delete p.badgePrinted;
    S.put('people', p, why);
  }

  Object.assign(P.actions, {
    appsend: function () {
      var g = function (id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }, r = function (n) { var e = document.querySelector('input[name="' + n + '"]:checked'); return e ? e.value : ''; };
      var err = document.getElementById('ap-err'), u = H.user(), p = S.get('people', u.id), id = g('ap-id').replace(/\s+/g, '');
      var bad = function (msg) { err.textContent = msg; err.hidden = false; return true; };
      if ((!/^\d{6,20}$/.test(id) && bad(T('Please type your ID number (numbers only).'))) || (!g('ap-since') && bad(T('When did you start coming to the church?'))) ||
        ((!r('ap-faith') || !r('ap-other') || !r('ap-class')) && bad(T('Please answer Yes or No to each question.'))) || (!g('ap-story') && bad(T('Please tell us briefly how you came to faith.'))) ||
        (!document.getElementById('ap-decl').checked && bad(T('Please tick that you agree with the declaration.'))) ||
        (!document.getElementById('ap-dir').checked && bad(T('Church Partners are in the church directory – please tick that you agree.')))) return;
      var a = { personId: p.id, spouse: g('ap-spouse'), anniversary: g('ap-wed'), children: g('ap-kids'), since: g('ap-since'), faith: r('ap-faith'), story: g('ap-story'), otherChurch: r('ap-other'), otherWhich: g('ap-which'),
        classOk: r('ap-class'), study: g('ap-study'), questions: g('ap-q'), serve: g('ap-serve'), declaration: declaration(), directory: true, status: 'waiting' };
      S.idNumber(p.id).then(function (have) { return have ? null : S.setIdNumber(p.id, id, 'Gave their ID number when applying to become a Church Partner'); }).catch(function () { /* the church office can add it */ }).then(function () {
        S.put('partnerApps', a, 'Applied to become a Church Partner');
        H.go('me'); H.toast(T('Sent – a Pastor will be in touch'));
      });
    },
    appwithdraw: function () { var a = mine(); if (a) S.remove('partnerApps', a.id, a.status === 'waiting' ? 'Withdrew their partnership application' : ''); H.render(); },
    appaccept: function (el) {
      var a = S.get('partnerApps', el.dataset.id); if (!a || !canReview()) return;
      H.modal(H.dialogHead(T('Accept'), T('They become a Church Partner from this date, and agree to be in the church directory.')) + '<div class="dlg-body">' +
        '<div class="two"><label class="field req">' + T('Date approved') + '<input type="date" id="aa-date" max="' + H.today() + '" value="' + H.today() + '"></label>' +
        '<label class="field">' + T('Approved by') + '<input id="aa-by" maxlength="80" placeholder="' + esc(T('e.g. Church Council')) + '"></label></div>' +
        '<label class="field">' + T('Note') + '<textarea id="aa-note" rows="2" maxlength="300"></textarea></label></div>' +
        '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn primary" data-act="people:appaccepted" data-id="' + a.id + '">' + T('Accept') + '</button></div>', T('Accept'));
    },
    appaccepted: function (el) {
      var a = S.get('partnerApps', el.dataset.id); if (!a || !canReview()) return;
      var d = document.getElementById('aa-date').value || H.today(), was = S.get('people', a.personId); if (!was) return;
      var p = JSON.parse(JSON.stringify(was)), wasCat = p.category;
      p.category = 'Church Partner'; p.partnerSince = d;
      S.put('people', p, 'Accepted as a Church Partner (application): ' + H.name(p));
      P.partnerAgrees(p, wasCat);   // Contact details: agreed on the form
      a = JSON.parse(JSON.stringify(a)); a.status = 'accepted'; a.approvedOn = d; a.approvedBy = document.getElementById('aa-by').value.trim().slice(0, 80); a.note = document.getElementById('aa-note').value.trim().slice(0, 300);
      S.put('partnerApps', a);
      H.closeModal(); H.render(); H.toast(T('{name} is now a Church Partner', { name: H.name(p) }));
    },
    appdecline: function (el) {
      H.modal(H.dialogHead(T('Not now'), T('Say why, so they know what to do.')) + '<div class="dlg-body"><label class="field">' + T('Reply') + '<textarea id="ad-reply" rows="3" maxlength="300"></textarea></label></div>' +
        '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn primary" data-act="people:appdeclined" data-id="' + esc(el.dataset.id) + '">' + T('Send') + '</button></div>', T('Not now'));
    },
    appdeclined: function (el) {
      var a = S.get('partnerApps', el.dataset.id); if (!a || !canReview()) return;
      a = JSON.parse(JSON.stringify(a)); a.status = 'declined'; a.reply = document.getElementById('ad-reply').value.trim().slice(0, 300);
      S.put('partnerApps', a, 'Partnership application not accepted for now: ' + H.name(S.get('people', a.personId)));
      H.closeModal(); H.render();
    },
    appprint: function () { var b = document.getElementById('app-print'); if (b) printOnly('<h1>' + esc(T('Partnership application')) + ' – ' + esc((S.settings() || {}).churchName || '') + '</h1>' + b.innerHTML, 'app'); },
    appdecl: function (el) { var t = document.getElementById('ap-decltext'); if (t) t.value = DECL[el.dataset.k]; },
    appdeclsave: function () {
      if (!H.can('*')) return; var v = document.getElementById('ap-decltext').value.trim().slice(0, 3000);
      S.setSettings({ partnerApp: Object.assign({}, (S.settings() || {}).partnerApp, { declaration: v }) }, 'Partnership applications: changed the declaration');
      H.toast(T('Saved'));
    },
    badgeon: function (el) { var p = S.get('people', el.dataset.id); if (p && canReview()) { setBadge(p, H.today(), '', 'Name badge to print: ' + H.name(p)); H.render(); H.toast(T('Added to the name badges to print')); } },
    badgeoff: function (el) { var p = S.get('people', el.dataset.id); if (p && canReview()) { setBadge(p, '', p.badgePrinted || '', 'Name badge taken off the list: ' + H.name(p)); H.render(); } },
    badgeprint: function () { var list = badgesWaiting(); if (list.length) printOnly(badgeSheets(list), 'badges'); },
    badgedone: function () {
      var list = badgesWaiting(); if (!list.length) return;
      list.forEach(function (p) { setBadge(p, p.badgeWanted, H.today(), ''); });
      S.audit('Printed name badges: ' + list.length, 'people');
      H.render(); H.toast(TN('{n} badge marked as printed', '{n} badges marked as printed', list.length));
    }
  });

  Object.assign(P, { appsWaiting: waiting, applyMePanel: mePanel, renderApplyForm: renderForm, renderApps: renderApps, renderBadges: renderBadges, badgesWaiting: badgesWaiting, badgeLine: badgeLine, setBadge: setBadge, badgeSheets: badgeSheets, DECL: DECL });
})(PeopleParts);
