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
  var WEDDING = P.WEDDING, state = P.state;
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

  /** What the church asks people to read before applying (its constitution, the denomination's, statements of faith): [{label, url}]. */
  function readLinks() {
    return ((S.settings() || {}).partnerApp || {}).links ? S.settings().partnerApp.links.filter(function (l) { return l && /^https?:\/\/\S+$/i.test(l.url || ''); }) : [];
  }
  function applicationDocuments() { return S.list('applicationDocuments').slice().sort(function (a, b) { return String(a.title || '').localeCompare(String(b.title || '')); }); }
  function applicationDocumentLinks() {
    return '<ul class="ap-links">' + applicationDocuments().map(function (d) {
      var link = /^https?:\/\/\S+$/i.test(d.link || '') ? d.link : '';
      return '<li><b>' + esc(d.title) + '</b>' +
        (d.parts ? ' <button class="btn small" data-act="people:appdoc" data-id="' + esc(d.id) + '">' + T('Read the document') + '</button>' : '') +
        (link ? ' <a href="' + esc(link) + '" target="_blank" rel="noopener noreferrer">' + T('Open the link') + '</a>' : '') + '</li>';
    }).join('') + '</ul>';
  }
  /** The declaration of loyalty to the denomination or affiliation, when the church asks for one ('' if not). */
  function loyalty() {
    var st = S.settings() || {}, d = ((st.partnerApp || {}).loyalty || '').trim();
    return d.replace(/\{church\}/g, st.churchName || '');
  }
  /** The country whose ID numbers give a date of birth: the church's. */
  function idCountry() { return window.Countries ? Countries.church(S.settings()).code : 'ZA'; }

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
        '<div class="two"><label class="field req">' + T('ID number') + '<input id="ap-id" inputmode="numeric" autocomplete="off" maxlength="20"><small>' + T('You need to be 18 or older. Only Administrators can see it.') + '</small></label>' +
        (p.birthDate ? '' : '<label class="field req" id="ap-birth-f">' + T('Birthday') + '<input id="ap-birth" type="date" max="' + H.today() + '"><small id="ap-birth-n" aria-live="polite"></small></label>') + '</div>' +
        '<div class="two"><label class="field">' + T('Spouse’s name') + '<input id="ap-spouse" maxlength="80"></label><label class="field">' + T('Wedding anniversary') + '<input id="ap-wed" type="date" max="' + H.today() + '" value="' + esc(wed) + '"></label></div>' +
        '<label class="field">' + T('Children’s names') + '<input id="ap-kids" maxlength="300"></label>' +
        '<label class="field req">' + T('Coming to the church since') + '<input id="ap-since" type="month" max="' + H.today().slice(0, 7) + '"></label></section>' +
      '<section class="panel"><h2>' + T('Your faith') + '</h2>' + yesNo('ap-faith', T('Have you put your trust in the Lord Jesus Christ for forgiveness and eternal life?'), true) +
        '<label class="field req">' + T('How did you come to faith?') + '<textarea id="ap-story" rows="4" maxlength="2000"></textarea><small>' + T('A few sentences is fine. You’re welcome to talk about this with a Pastor.') + '</small></label></section>' +
      '<section class="panel"><h2>' + T('Other churches') + '</h2>' + yesNo('ap-other', T('Are you a member of another church?'), true) +
        '<label class="field">' + T('If so, which one – and should we contact them about moving your membership?') + '<input id="ap-which" maxlength="200"></label></section>' +
      '<section class="panel"><h2>' + T('You and the church') + '</h2>' + yesNo('ap-class', T('Would you come to a membership class?'), true) +
        '<label class="field">' + T('Do you go to a Bible study or Midweek Group? Which one?') + '<input id="ap-study" maxlength="200"></label>' +
        '<label class="field">' + T('Any questions about the church?') + '<textarea id="ap-q" rows="2" maxlength="1000"></textarea></label>' +
        '<label class="field">' + T('How would you like to serve in the church?') + '<textarea id="ap-serve" rows="2" maxlength="1000"></textarea></label></section>' +
      (readLinks().length || applicationDocuments().length ? '<section class="panel" id="ap-read"><h2>' + T('Please read before you apply') + '</h2>' +
        (applicationDocuments().length ? applicationDocumentLinks() : '') +
        (readLinks().length ? '<ul class="ap-links">' + readLinks().map(function (l) {
          return '<li><a href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer">' + esc(l.label || l.url) + '</a></li>'; }).join('') + '</ul>' : '') + '</section>' : '') +
      '<section class="panel"><h2>' + T('Declaration') + '</h2><blockquote class="decl" data-own-words>' + esc(declaration()) + '</blockquote>' +
        '<label class="check"><input type="checkbox" id="ap-decl"><span>' + T('I agree with the declaration above.') + '</span></label>' +
        (loyalty() ? '<h3 class="ap-loy-h">' + T('Declaration of loyalty') + '</h3><blockquote class="decl" data-own-words>' + esc(loyalty()) + '</blockquote>' +
          '<label class="check"><input type="checkbox" id="ap-loyal"><span>' + T('I make this declaration.') + '</span></label>' : '') +
        '<label class="check"><input type="checkbox" id="ap-dir"><span>' + T('I agree to be in the church directory, so other members can see my contact details.') + '</span></label>' +
        '<p id="ap-err" class="note bad" role="alert" hidden></p>' +
        '<div class="btns" style="margin-top:12px"><button class="btn primary" data-act="people:appsend">' + T('Send my application') + '</button><a class="btn" href="#/me">' + T('Cancel') + '</a></div></section></form>';
  }
  function readApplicationDocument(id) {
    var d = S.get('applicationDocuments', id);
    if (!d || !d.parts) return;
    H.busy(T('Fetching the file…'), function () {
      return S.loadApplicationDocumentFile(id).then(function (parts) {
        var b64 = parts.join(''), type = d.fileType || 'application/octet-stream', name = d.fileName || d.title || 'document';
        if (window.ChurchHubApp && typeof window.ChurchHubApp.saveFileBase64 === 'function') { window.ChurchHubApp.saveFileBase64(name, type, b64); return; }
        if (window.ChurchHubApp) { H.toast(T('Please update the Church Hub app to download files, or use a browser.'), true); return; }
        var bin = atob(b64), bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        var url = URL.createObjectURL(new Blob([bytes], { type: type })), a = document.createElement('a');
        a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      });
    }).catch(function (e) { console.error(e); H.toast(T('Couldn’t fetch the file. Please try again.'), true); });
  }

  /** On the form: an ID number that carries a date of birth (South Africa) fills in the birthday. */
  function formHook() {
    var id = document.getElementById('ap-id'), b = document.getElementById('ap-birth'); if (!id || !b || !window.Countries) return;
    id.addEventListener('input', function () {
      var d = Countries.birthFromId(id.value, idCountry(), H.today()), n = document.getElementById('ap-birth-n');
      if (d && (!b.value || b.dataset.fromId)) { b.value = d; b.dataset.fromId = '1'; if (n) n.textContent = T('Worked out from your ID number.'); }
    });
    b.addEventListener('input', function () { delete b.dataset.fromId; var n = document.getElementById('ap-birth-n'); if (n) n.textContent = ''; });
  }

  /* ---------- Administrators and Pastors: People → Partnership applications ---------- */
  function waiting() { return canReview() ? S.find('partnerApps', function (a) { return a.status === 'waiting'; }) : []; }
  function answers(a) {
    var yn = function (v) { return v === 'yes' ? T('Yes') : v === 'no' ? T('No') : '–'; }, row = function (l, v) { return '<dt>' + esc(l) + '</dt><dd>' + (v ? esc(v).replace(/\n/g, '<br>') : '–') + '</dd>'; };
    return '<dl class="kv app-kv">' + row(T('Spouse’s name'), a.spouse) + row(T('Wedding anniversary'), a.anniversary ? H.fmt(a.anniversary, true) : '') + row(T('Children’s names'), a.children) +
      row(T('Coming to the church since'), a.since ? P.monthYear(a.since) : '') + row(T('Birthday'), a.birthDate ? H.fmt(a.birthDate, true) : '') +
      row(T('Have you put your trust in the Lord Jesus Christ for forgiveness and eternal life?'), yn(a.faith)) + row(T('How did you come to faith?'), a.story) +
      row(T('Are you a member of another church?'), yn(a.otherChurch)) + row(T('If so, which one – and should we contact them about moving your membership?'), a.otherWhich) +
      row(T('Would you come to a membership class?'), yn(a.classOk)) + row(T('Do you go to a Bible study or Midweek Group? Which one?'), a.study) +
      row(T('Any questions about the church?'), a.questions) + row(T('How would you like to serve in the church?'), a.serve) +
      row(T('Declaration'), a.declaration) + (a.loyalty ? row(T('Declaration of loyalty'), a.loyalty) : '') + row(T('I agree to be in the church directory, so other members can see my contact details.'), a.directory ? T('Yes') : T('No')) + '</dl>';
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
      invitePanel() +
      (list.length ? list.map(function (a) { return appCard(a, false); }).join('') : '<p class="empty">' + T('No applications yet.') + '</p>') +
      (H.can('*') ? declPanel() : '');
  }
  var auditedApp = {};
  function declPanel() {
    var st = S.settings() || {}, d = (st.partnerApp || {}).declaration || DECL.general;
    return '<section class="panel" data-noauto><h2>' + T('Declaration on the form') + '</h2><p class="hint" style="margin-top:0">' + T('The words people agree to when they apply. {church} becomes your church’s name.') + '</p>' +
      '<div class="btns" style="margin-bottom:8px"><button class="btn small" data-act="people:appdecl" data-k="general">' + T('General wording') + '</button><button class="btn small" data-act="people:appdecl" data-k="reach">REACH South Africa</button></div>' +
      '<label class="field"><span class="sr">' + T('Declaration on the form') + '</span><textarea id="ap-decltext" rows="6" data-own-words>' + esc(d) + '</textarea></label>' +
      '<button class="btn small save" data-act="people:appdeclsave">' + T('Save') + '</button></section>' + docsPanel();
  }
  /** Administrators: the documents people should read (links), and a declaration of loyalty if the denomination asks for one. Admin-only words. */
  function docsPanel() {
    var pa = (S.settings() || {}).partnerApp || {}, links = (pa.links || []).slice(), eg = ['Constitution of ' + ((S.settings() || {}).churchName || 'the church'), 'Constitution of the denomination', 'Statement of faith'];
    while (links.length < Math.max(3, (pa.links || []).length + 1) && links.length < 8) links.push({ label: '', url: '' });
    return '<section class="panel" id="ap-docs" data-noauto><h2>Documents and loyalty</h2>' +
      '<p class="hint" style="margin-top:0">Links shown on the form under “Please read before you apply”: your church’s constitution, the denomination’s or affiliation’s constitution, statements of faith. Put the documents online first (your website, or Google Drive shared with “Anyone with the link”) and paste the links here.</p>' +
      links.map(function (l, i) {
        return '<div class="two ap-doc"><label class="field">Name of the document<input class="ap-dl" data-i="' + i + '" maxlength="100" value="' + esc(l.label || '') + '" placeholder="' + esc(eg[i] || '') + '"></label>' +
          '<label class="field">Link<input class="ap-du" data-i="' + i + '" type="url" maxlength="500" value="' + esc(l.url || '') + '" placeholder="https://…"></label></div>';
      }).join('') +
      '<label class="field">Declaration of loyalty (leave empty if not needed)<textarea id="ap-loytext" rows="4" maxlength="3000" data-own-words placeholder="e.g. I declare my loyalty to … and accept the authority of its Synod.">' + esc(pa.loyalty || '') + '</textarea>' +
      '<small>If you fill this in, people tick “I make this declaration” on the form. {church} becomes your church’s name.</small></label>' +
      '<p id="ap-docerr" class="note bad" role="alert" hidden></p><button class="btn small save" data-act="people:appdocssave">Save</button></section>';
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
  function renderBadges(sub) {
    if (sub === 'layout') return renderLayout();
    state.badgeDraft = null;
    var back = '<a class="crumb" href="#/people">' + H.icon(H.ICON.back, 16) + T('People') + '</a>';
    if (!canReview()) return back + '<p class="empty">' + T('This is for Administrators and Pastors.') + '</p>';
    var list = badgesWaiting();
    return back + '<div class="page-head"><div><h1>' + T('Name badges') + '</h1><p class="lead">' + (onLabels(badgeLayout()) ? T('Print them on label paper and stick them on.') : T('Print them on A4, cut along the lines and slide them into the laminate pouches.')) + '</p></div>' +
      (list.length ? '<div class="btns"><button class="btn primary" data-act="people:badgeprint">' + H.icon('M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6z', 18) + TN('Print {n} badge', 'Print {n} badges', list.length) + '</button>' +
        '<button class="btn" data-act="people:badgedone">' + T('Mark as printed') + '</button>' : '<div class="btns">') + (H.can('*') ? '<a class="btn" href="#/people/badges/layout">' + T('Badge layout') + '</a>' : '') + '</div></div>' +
      (list.length ? '<div class="badge-prev">' + list.map(function (p) {
        return '<div class="badge"><b>' + esc(p.preferredName || p.firstName) + '</b><span>' + esc(p.lastName) + '</span><button class="icon-btn ghost" data-act="people:badgeoff" data-id="' + p.id + '" aria-label="' + esc(T('Remove') + ': ' + H.name(p)) + '" title="' + esc(T('Remove')) + '">' + H.icon(H.ICON.x, 14) + '</button></div>';
      }).join('') + '</div><p class="hint">' + T('Printing works best from a computer.') + '</p>' : '<p class="empty">' + T('No name badges waiting. Tick “Make a name badge” when you add someone, or use the button on their page.') + '</p>');
  }
  /** The church's badge layout (People → Name badges → Badge layout; js/badges.js): its own A4 sheet, or label paper. */
  function badgeLayout() { return Badges.layout((S.settings() || {}).badgeLayout); }
  function onLabels(L) { return L.lines !== 'thick'; }   // label paper (or a layout of their own): a sheet may be partly used
  /** The sheets to print for these people (first name or the name they go by, then surname). */
  function badgeSheets(list, opts, L) {
    return Badges.sheets(list.map(function (p) { return { first: p.preferredName || p.firstName || '', last: p.lastName || '' }; }), L || badgeLayout(), opts);
  }
  /** Print badges for these people: on label paper, first ask which label to start at (a partly used sheet). why: for the audit log. */
  function printBadges(list, why) {
    if (!list.length) return;
    var L = badgeLayout(), go = function (start) { if (why) S.audit(why + ': ' + list.length, 'people'); printOnly(badgeSheets(list, { start: start }, L), 'badges'); };
    if (!onLabels(L)) return go(1);
    state.badgeQueue = list;
    var n = Badges.perPage(L);
    H.modal(H.dialogHead(TN('Print {n} badge', 'Print {n} badges', list.length), T('On label paper: {n} labels to a sheet.', { n: n })) + '<div class="dlg-body">' +
      '<label class="field">' + T('Start at label') + '<input type="number" id="bp-start" min="1" max="' + n + '" value="1" inputmode="numeric"><small>' + T('1 is the top-left label; they are counted across, then down. Use a later one if some labels on the sheet are used.') + '</small></label>' +
      '</div><div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn primary" data-act="people:badgego" data-why="' + esc(why || '') + '">' + T('Print') + '</button></div>', T('Print'));
  }
  /** People → Name badges → Badge layout (Administrators): the size of each badge and how they sit on the page. */
  var LAYOUT_FIELDS = [['cols', 'Labels across', 1], ['rows', 'Labels down', 1], ['w', 'Label width (mm)', 0.1], ['h', 'Label height (mm)', 0.1],
    ['top', 'Top margin (mm)', 0.01], ['left', 'Left margin (mm)', 0.01], ['gapX', 'Gap between columns (mm)', 0.01], ['gapY', 'Gap between rows (mm)', 0.01]];
  function renderLayout() {
    var back = '<a class="crumb" href="#/people/badges">' + H.icon(H.ICON.back, 16) + T('Name badges') + '</a>';
    if (!H.can('*')) return back + '<p class="empty">This is for Administrators.</p>';
    var L = state.badgeDraft || (state.badgeDraft = badgeLayout());
    var opt = function (v, t, on) { return '<option value="' + esc(v) + '"' + (on ? ' selected' : '') + '>' + esc(t) + '</option>'; };
    return back + '<div class="page-head"><div><h1>Badge layout</h1><p class="lead">The size of each name badge and where it sits on the page: the church’s own sheet to cut and laminate, or sticky label paper (with or without gaps between the labels).</p></div></div>' +
      '<div class="grid2"><section class="panel" id="bl-form" data-noauto>' +
      '<label class="field">Paper<select id="bl-preset">' + Object.keys(Badges.PRESETS).map(function (k) { return opt(k, Badges.PRESETS[k].name, L.preset === k); }).join('') + opt('custom', 'My own measurements', L.preset === 'custom') + '</select>' +
      '<small>For other label paper, choose My own measurements and copy them from the label packet (or measure a sheet with a ruler).</small></label>' +
      '<div class="two">' + LAYOUT_FIELDS.map(function (f) { return '<label class="field">' + f[1] + '<input type="number" id="bl-' + f[0] + '" min="0" step="' + f[2] + '" value="' + L[f[0]] + '" inputmode="decimal"></label>'; }).join('') + '</div>' +
      '<div class="two"><label class="field">Page size<select id="bl-page">' + Object.keys(Badges.PAGES).map(function (k) { return opt(k, Badges.PAGES[k].label + ' (' + Badges.PAGES[k].w + ' × ' + Badges.PAGES[k].h + ' mm)', L.page === k); }).join('') + '</select></label>' +
      '<label class="field">Lines around each badge<select id="bl-lines">' + opt('thick', 'Thick lines to cut along (3 pt)', L.lines === 'thick') + opt('thin', 'Thin lines', L.lines === 'thin') + opt('none', 'No lines (label paper)', L.lines === 'none') + '</select></label></div>' +
      '<div class="note warn" id="bl-err" role="alert"' + (Badges.problems(L).length ? '' : ' hidden') + '>' + esc(Badges.problems(L).join(' ')) + '</div>' +
      '<p class="hint">Before printing a batch on label paper, print a test page on plain paper and hold it against a sheet of labels up to the light.</p>' +
      '<div class="btns"><button class="btn primary" data-act="people:layoutsave">Save</button><button class="btn" data-act="people:layouttest">Print a test page</button>' +
      '<button class="btn" data-act="people:layoutreset">Back to the church’s layout</button></div></section>' +
      '<section class="panel"><h2>How a sheet will look</h2><div class="bl-prev" id="bl-prev">' + layoutPreview(L) + '</div><p class="hint" id="bl-count">' + layoutCount(L) + '</p></section></div>';
  }
  function layoutCount(L) { return Badges.perPage(L) + ' badges to a sheet, each ' + L.w + ' × ' + L.h + ' mm.'; }
  /** A small drawing of one sheet, with example names (dashed outlines where there are no lines: the edges of the labels). */
  function layoutPreview(L) {
    var pg = Badges.PAGES[L.page] || Badges.PAGES.A4, scale = 300 / (pg.w * 96 / 25.4), ex = [['Thandi', 'Mokoena'], ['Pieter', 'van Wyk'], ['Christopher', 'Abrahamse'], ['Jo', 'Smith']];
    if (Badges.problems(L).length) return '<p class="muted">Fix the measurements to see the sheet.</p>';
    var names = []; for (var i = 0; i < Badges.perPage(L); i++) names.push({ first: ex[i % 4][0], last: ex[i % 4][1] });
    var html = Badges.sheets(names, L).replace(/class="lab"/g, 'class="lab' + (L.lines === 'none' ? ' paper' : '') + '"').replace('class="sheet', 'style="transform:scale(' + scale.toFixed(4) + ')" class="sheet');
    return '<div class="bl-page" style="width:' + (pg.w * 96 / 25.4 * scale).toFixed(1) + 'px;height:' + (pg.h * 96 / 25.4 * scale).toFixed(1) + 'px">' + html + '</div>';
  }
  /** The layout as typed in the boxes. */
  function layoutTyped() {
    var g = function (id) { var e = document.getElementById('bl-' + id); return e ? e.value : ''; }, out = { preset: g('preset'), page: g('page'), lines: g('lines') };
    LAYOUT_FIELDS.forEach(function (f) { out[f[0]] = g(f[0]); });
    return Badges.layout(out);
  }
  /** A box changed: choosing a paper fills in its measurements; changing a measurement makes it your own. Redraw the preview. */
  function layoutChanged(t) {
    var L;
    if (t.id === 'bl-preset' && t.value !== 'custom') {
      L = Badges.layout({ preset: t.value });
      LAYOUT_FIELDS.forEach(function (f) { document.getElementById('bl-' + f[0]).value = L[f[0]]; });
      document.getElementById('bl-page').value = L.page; document.getElementById('bl-lines').value = L.lines;
    } else if (t.id !== 'bl-preset' && t.id !== 'bl-lines') {
      var pr = document.getElementById('bl-preset'), base = pr.value !== 'custom' && Badges.layout({ preset: pr.value });
      if (base && t.id !== 'bl-page' ? +t.value !== base[t.id.slice(3)] : base && t.value !== base.page) pr.value = 'custom';
    }
    L = state.badgeDraft = layoutTyped();
    var pb = Badges.problems(L), err = document.getElementById('bl-err');
    err.textContent = pb.join(' '); err.hidden = !pb.length;
    document.getElementById('bl-prev').innerHTML = layoutPreview(L);
    document.getElementById('bl-count').textContent = pb.length ? '' : layoutCount(L);
  }
  /** On a person's page (Administrators and Pastors): their name badge. */
  function badgeLine(p) {
    if (!canReview() || !p || p.active === false || P.deceased(p)) return '';
    var s = p.badgeWanted && !p.badgePrinted ? '<span class="tag warn">' + T('Name badge waiting to be printed') + '</span>' : p.badgePrinted ? '<span class="muted small">' + T('Name badge printed on {date}', { date: esc(H.fmt(p.badgePrinted)) }) + '</span>' : '';
    return '<p class="badge-line">' + s + ' ' + (p.badgeWanted && !p.badgePrinted ? '<a class="btn small" href="#/people/badges">' + T('Name badges') + '</a>' : '<button class="btn small" data-act="people:badgeon" data-id="' + p.id + '">' + T('Make a name badge') + '</button>') + '</p>';
  }
  /** Put these people on the list of name badges to print (People → Name badges), from a search or the People list. How many were added. */
  function addBadges(list, from) {
    var today = H.today(), n = 0;
    list.forEach(function (p) {
      if (!p || p.active === false || P.deceased(p) || (p.badgeWanted && !p.badgePrinted)) return;   // already waiting
      setBadge(p, today, p.badgePrinted || '', ''); n++;
    });
    if (n) S.audit('Added ' + n + ' name badge' + (n === 1 ? '' : 's') + ' to print (' + from + ')', 'people');
    return n;
  }
  function setBadge(p, wanted, printed, why) {
    p = JSON.parse(JSON.stringify(p));
    if (wanted) p.badgeWanted = wanted; else delete p.badgeWanted;
    if (printed) p.badgePrinted = printed; else delete p.badgePrinted;
    S.put('people', p, why);
  }

  /* ---------- inviting people to apply: by email, a QR code to scan, a poster and a paper form ----------
   * The form is on the person's own page, so they need to be able to sign in: inviting someone without access can give them
   * Basic access (Administrators, and Pastors who may give access). Their details get partnerInvited (the date), shown on
   * their page. The link is this Church Hub's address + #/people/apply; it is remembered through signing in (app.js). */
  function applyLink() { return location.origin + location.pathname.replace(/index\.html$/, '') + '#/people/apply'; }
  function canGiveAccess() { return H.can('*') || H.can('access.manage'); }
  function signsIn(p) { return !!(p.email && p.appRole && p.appRole !== 'none'); }
  function partnerWord() { var w = (window.Wording && Wording.words(S.settings() || {}).partner) || []; return w[0] || T('Church Partner'); }
  function inviteText(names) {
    var st = S.settings() || {};
    return T('Dear {name},', { name: names }) + '\n\n' + T('Thank you for being part of {church}. We would love to invite you to become a {partner}: you can vote at church meetings, and lead or teach in the church.', { church: st.churchName || '', partner: partnerWord() }) +
      '\n\n' + T('You can apply in Church Hub, on your phone or computer:') + '\n' + applyLink() + '\n\n' + T('Sign in with your email address, answer a few questions and send it. A Pastor will be in touch.') + '\n\n' + T('With love,') + '\n' + (st.churchName || '');
  }
  /** The invitation for one or more people (ids): who it reaches, Basic access for those who can't sign in yet, the email. */
  function invite(ids) {
    var all = ids.map(function (id) { return S.get('people', id); }).filter(Boolean), can = all.filter(mayApply), skip = all.length - can.length;
    var noEmail = can.filter(function (p) { return !p.email; }), noAccess = can.filter(function (p) { return p.email && !signsIn(p); });
    var to = can.filter(function (p) { return p.email; }), one = to.length === 1;
    var who = one ? (to[0].preferredName || to[0].firstName) : T('friends');
    H.modal(H.dialogHead(T('Invite to become a {partner}', { partner: partnerWord() }), TN('{n} person', '{n} people', can.length)) + '<div class="dlg-body" data-noauto>' +
      (skip ? '<p class="hint" style="margin-top:0">' + TN('{n} person is left out: already a Church Partner, a child, or no longer at the church.', '{n} people are left out: already Church Partners, children, or no longer at the church.', skip) + '</p>' : '') +
      (noEmail.length ? '<p class="note warn" style="margin-top:0">' + TN('{n} has no email address, so can’t get the email or sign in: {names}. Show them the QR code, or give them a paper form.', '{n} have no email address, so can’t get the email or sign in: {names}. Show them the QR code, or give them a paper form.', noEmail.length).replace('{names}', esc(noEmail.map(H.name).join(', '))) + '</p>' : '') +
      (noAccess.length ? (canGiveAccess() ? '<label class="check"><input type="checkbox" id="iv-access" checked><span>' + TN('Give {n} person Basic access, so they can sign in with their email address and apply', 'Give {n} people Basic access, so they can sign in with their email address and apply', noAccess.length) + '</span></label>'
        : '<p class="note warn">' + TN('{n} can’t sign in yet. Ask an Administrator to give them Basic access first.', '{n} can’t sign in yet. Ask an Administrator to give them Basic access first.', noAccess.length) + '</p>') : '') +
      (to.length ? '<label class="field">' + T('Subject') + '<input id="iv-sub" value="' + esc(T('Become a {partner} at {church}', { partner: partnerWord(), church: (S.settings() || {}).churchName || '' })) + '"></label>' +
        '<label class="field">' + T('Message') + '<textarea id="iv-body" rows="9">' + esc(inviteText(who)) + '</textarea>' + (one ? '' : '<small>' + T('Sent as one email, with everyone in Bcc so they don’t see each other’s addresses.') + '</small>') + '</label>' : '') +
      '</div><div class="dlg-foot"><button class="btn" data-act="people:inviteqr">' + T('Show the QR code') + '</button>' +
      (to.length ? '<button class="btn primary" data-act="people:invitesend" data-ids="' + esc(can.map(function (p) { return p.id; }).join(',')) + '">' + T('Email the invitation') + '</button>' : '') + '</div>', T('Invite'));
  }
  /** The QR code for the form (to scan with a phone camera) and the link, with a button to copy it. */
  function qrBlock(px) { return '<div class="qr-box">' + QR.svg(applyLink(), { px: px || 200 }) + '<p class="qr-link">' + esc(applyLink()) + '</p></div>'; }
  function invitePanel() {
    if (!canReview() || !window.QR) return '';
    return '<section class="panel" id="app-invite" data-noauto><h2>' + T('Invite people') + '</h2><p class="hint" style="margin-top:0">' + T('Send the form by email from someone’s page, or tick people in Advanced search and choose Invite. For the welcome desk: the QR code below, a poster, or a paper form. To apply in Church Hub, people need to be able to sign in.') + '</p>' +
      '<div class="row" style="gap:18px;flex-wrap:wrap;align-items:center">' + qrBlock(150) + '<div class="btns" style="flex-direction:column;align-items:stretch">' +
      '<button class="btn" data-act="people:invitecopy">' + T('Copy the link') + '</button><button class="btn" data-act="people:invitposter">' + T('Print a poster') + '</button><button class="btn" data-act="people:invitepaper">' + T('Print a paper form') + '</button></div></div></section>';
  }
  /** On a person's page (Administrators and Pastors): invite them, or when they were invited. */
  function inviteLine(p) {
    if (!canReview() || !mayApply(p) || !window.QR) return '';
    var a = S.find('partnerApps', function (x) { return x.personId === p.id; })[0];
    if (a && a.status === 'waiting') return '';
    return '<p class="badge-line">' + (p.partnerInvited ? '<span class="muted small">' + T('Invited to become a Church Partner on {date}', { date: esc(H.fmt(p.partnerInvited, true)) }) + '</span> ' : '') +
      '<button class="btn small" data-act="people:invite" data-id="' + p.id + '">' + T(p.partnerInvited ? 'Invite again' : 'Invite to become a Church Partner') + '</button></p>';
  }
  /** A4 poster for the welcome desk, and a paper form (the same questions as Church Hub's, with lines to write on). */
  function posterHtml() {
    var st = S.settings() || {};
    return '<div class="sheet poster"><h1>' + esc(T('Become a {partner}', { partner: partnerWord() })) + '</h1><p class="big">' + esc(st.churchName || '') + '</p>' + qrBlock(380) +
      '<ol><li>' + esc(T('Scan the code with your phone’s camera (or type the address).')) + '</li><li>' + esc(T('Sign in with the email address the church office has for you.')) + '</li><li>' + esc(T('Answer a few questions and send it. A Pastor will be in touch.')) + '</li></ol>' +
      '<p class="small">' + esc(T('No email address on file, or rather use paper? Ask the church office for a form.')) + '</p></div>';
  }
  function paperHtml() {
    var st = S.settings() || {}, line = function (l, n) { return '<div class="pf-q"><b>' + esc(l) + '</b>' + new Array((n || 1) + 1).join('<span class="pf-line"></span>') + '</div>'; };
    var yn = function (l) { return '<div class="pf-q"><b>' + esc(l) + '</b> <span class="pf-yn">☐ ' + esc(T('Yes')) + ' &nbsp; ☐ ' + esc(T('No')) + '</span></div>'; };
    return '<div class="sheet paper-form"><div class="pf-head"><div><h1>' + esc(T('Apply to become a {partner}', { partner: partnerWord() })) + '</h1><p>' + esc(st.churchName || '') + '</p></div>' + QR.svg(applyLink(), { px: 90 }) + '</div>' +
      line(T('Name')) + line(T('Home address'), 2) + '<div class="two">' + line(T('Mobile')) + line(T('Email')) + '</div>' + '<div class="two">' + line(T('ID number')) + line(T('Birthday')) + '</div>' + line(T('Coming to the church since')) +
      '<div class="two">' + line(T('Spouse’s name')) + line(T('Wedding anniversary')) + '</div>' + line(T('Children’s names')) +
      yn(T('Have you put your trust in the Lord Jesus Christ for forgiveness and eternal life?')) + line(T('How did you come to faith?'), 3) +
      yn(T('Are you a member of another church?')) + line(T('If so, which one – and should we contact them about moving your membership?')) +
      yn(T('Would you come to a membership class?')) + line(T('Do you go to a Bible study or Midweek Group? Which one?')) + line(T('How would you like to serve in the church?'), 2) +
      (readLinks().length ? '<div class="pf-q"><b>' + esc(T('Please read before you apply')) + '</b><ul class="pf-links">' + readLinks().map(function (l) { return '<li>' + esc(l.label || '') + (l.label ? ': ' : '') + esc(l.url) + '</li>'; }).join('') + '</ul></div>' : '') +
      '<div class="pf-q"><b>' + esc(T('Declaration')) + '</b><p class="decl">' + esc(declaration()) + '</p><p>☐ ' + esc(T('I agree with the declaration above.')) + '<br>☐ ' + esc(T('I agree to be in the church directory, so other members can see my contact details.')) + '</p></div>' +
      (loyalty() ? '<div class="pf-q"><b>' + esc(T('Declaration of loyalty')) + '</b><p class="decl">' + esc(loyalty()) + '</p><p>☐ ' + esc(T('I make this declaration.')) + '</p></div>' : '') +
      '<div class="two">' + line(T('Signed')) + line(T('Date')) + '</div></div>';
  }

  Object.assign(P.actions, {
    invite: function (el) { invite([el.dataset.id]); },
    inviteqr: function () {
      H.modal(H.dialogHead(T('Scan to apply'), T('Point a phone’s camera at the code.')) + '<div class="dlg-body" style="text-align:center">' + qrBlock(260) + '</div>' +
        '<div class="dlg-foot"><button class="btn" data-act="people:invitecopy">' + T('Copy the link') + '</button><button class="btn primary" data-act="hub:close">' + T('Close') + '</button></div>', T('Scan to apply'));
    },
    invitecopy: function () {
      var done = function () { H.toast(T('Link copied')); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(applyLink()).then(done, function () { window.prompt(T('Copy the link'), applyLink()); });
      else window.prompt(T('Copy the link'), applyLink());
    },
    invitposter: function () { printOnly(posterHtml(), 'invite'); },
    invitepaper: function () { printOnly(paperHtml(), 'invite'); },
    invitesend: function (el) {
      var ids = String(el.dataset.ids || '').split(',').filter(Boolean), ppl = ids.map(function (id) { return S.get('people', id); }).filter(Boolean);
      var give = document.getElementById('iv-access'), today = H.today(), granted = 0;
      ppl.forEach(function (p0) {
        var p = JSON.parse(JSON.stringify(p0)), why = [];
        if (give && give.checked && p.email && !signsIn(p) && canGiveAccess()) { p.appRole = 'member'; granted++; why.push('given Basic access'); }
        p.partnerInvited = today;
        S.put('people', p, 'Invited to become a Church Partner' + (why.length ? ' (' + why.join(', ') + ')' : '') + ': ' + H.name(p));
      });
      var mail = ppl.filter(function (p) { return p.email; }).map(function (p) { return p.email; }), st = S.settings() || {}, E = window.Emails, method = E ? E.getMethod(st) : 'mail';
      var opts = { subject: document.getElementById('iv-sub').value, body: document.getElementById('iv-body').value, from: st.emailGmail || '' };
      if (mail.length === 1) opts.to = mail[0]; else { opts.to = st.emailOffice || st.emailGmail || ''; opts.bcc = mail.join(','); }
      var url = E.makeSendUrl(method, opts);
      H.closeModal(); H.render(); H.toast(granted ? TN('{n} given Basic access – now send the email', '{n} given Basic access – now send the email', granted) : T('Now send the email'));
      if (method === 'gmail') window.open(url, '_blank', 'noopener,noreferrer'); else location.href = url;
    },
    appsend: function () {
      var g = function (id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }, r = function (n) { var e = document.querySelector('input[name="' + n + '"]:checked'); return e ? e.value : ''; };
      var err = document.getElementById('ap-err'), u = H.user(), p = S.get('people', u.id), id = g('ap-id').replace(/\s+/g, '');
      var born = p.birthDate || g('ap-birth') || (window.Countries ? Countries.birthFromId(id, idCountry(), H.today()) : '');
      var bad = function (msg) { err.textContent = msg; err.hidden = false; return true; };
      if ((!/^\d{6,20}$/.test(id) && bad(T('Please type your ID number (numbers only).'))) || (!born && bad(T('Please give your date of birth.'))) ||
        (born && H.today().slice(0, 4) - born.slice(0, 4) - (H.today().slice(5) < born.slice(5) ? 1 : 0) < 18 && bad(T('You need to be 18 or older to become a Church Partner.'))) || (!g('ap-since') && bad(T('When did you start coming to the church?'))) ||
        ((!r('ap-faith') || !r('ap-other') || !r('ap-class')) && bad(T('Please answer Yes or No to each question.'))) || (!g('ap-story') && bad(T('Please tell us briefly how you came to faith.'))) ||
        (!document.getElementById('ap-decl').checked && bad(T('Please tick that you agree with the declaration.'))) ||
        (!document.getElementById('ap-dir').checked && bad(T('Church Partners are in the church directory – please tick that you agree.'))) ||
        (document.getElementById('ap-loyal') && !document.getElementById('ap-loyal').checked && bad(T('Please tick that you make the declaration of loyalty.')))) return;
      var a = { personId: p.id, spouse: g('ap-spouse'), anniversary: g('ap-wed'), children: g('ap-kids'), since: g('ap-since'), faith: r('ap-faith'), story: g('ap-story'), otherChurch: r('ap-other'), otherWhich: g('ap-which'),
        classOk: r('ap-class'), study: g('ap-study'), questions: g('ap-q'), serve: g('ap-serve'), declaration: declaration(), directory: true, status: 'waiting' };
      if (!p.birthDate && born) a.birthDate = born;   // copied to their details when accepted
      if (loyalty()) a.loyalty = loyalty();
      S.idNumber(p.id).then(function (have) { return have ? null : S.setIdNumber(p.id, id, 'Gave their ID number when applying to become a Church Partner'); }).catch(function () { /* the church office can add it */ }).then(function () {
        S.put('partnerApps', a, 'Applied to become a Church Partner');
        H.go('me'); H.toast(T('Sent – a Pastor will be in touch'));
      });
    },
    appwithdraw: function () { var a = mine(); if (a) S.remove('partnerApps', a.id, a.status === 'waiting' ? 'Withdrew their partnership application' : ''); H.render(); },
    appdoc: function (el) { readApplicationDocument(el.dataset.id); },
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
      if (a.since && !p.attendingSince) p.attendingSince = a.since;   // from the form
      if (a.birthDate && !p.birthDate) p.birthDate = a.birthDate;
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
    appdocssave: function () {
      if (!H.can('*')) return;
      var labels = document.querySelectorAll('.ap-dl'), urls = document.querySelectorAll('.ap-du'), links = [], err = document.getElementById('ap-docerr'), wrong = '';
      for (var i = 0; i < urls.length; i++) {
        var l = labels[i].value.trim(), u = urls[i].value.trim();
        if (!u && !l) continue;
        if (!/^https?:\/\/\S+$/i.test(u)) { wrong = wrong || (l || u || 'A document') + ': the link must start with https://'; continue; }
        links.push({ label: l || u, url: u });
      }
      if (wrong) { err.textContent = wrong; err.hidden = false; return; }
      var loy = document.getElementById('ap-loytext').value.trim().slice(0, 3000);
      S.setSettings({ partnerApp: Object.assign({}, (S.settings() || {}).partnerApp, { links: links, loyalty: loy }) }, 'Partnership applications: changed the documents to read and the declaration of loyalty');
      H.render(); H.toast(T('Saved'));
    },
    appdecl: function (el) { var t = document.getElementById('ap-decltext'); if (t) t.value = DECL[el.dataset.k]; },
    appdeclsave: function () {
      if (!H.can('*')) return; var v = document.getElementById('ap-decltext').value.trim().slice(0, 3000);
      S.setSettings({ partnerApp: Object.assign({}, (S.settings() || {}).partnerApp, { declaration: v }) }, 'Partnership applications: changed the declaration');
      H.toast(T('Saved'));
    },
    badgeon: function (el) { var p = S.get('people', el.dataset.id); if (p && canReview()) { setBadge(p, H.today(), '', 'Name badge to print: ' + H.name(p)); H.render(); H.toast(T('Added to the name badges to print')); } },
    badgeoff: function (el) { var p = S.get('people', el.dataset.id); if (p && canReview()) { setBadge(p, '', p.badgePrinted || '', 'Name badge taken off the list: ' + H.name(p)); H.render(); } },
    badgeprint: function () { printBadges(badgesWaiting()); },
    badgego: function (el) {
      var list = state.badgeQueue || [], L = badgeLayout(), n = Badges.perPage(L), v = Math.round(+document.getElementById('bp-start').value) || 1;
      v = Math.max(1, Math.min(n, v)); H.closeModal(); state.badgeQueue = null;
      if (el.dataset.why) S.audit(el.dataset.why + ': ' + list.length, 'people');
      if (list.length) printOnly(badgeSheets(list, { start: v }, L), 'badges');
    },
    layoutsave: function () {
      if (!H.can('*')) return;
      var L = layoutTyped(), pb = Badges.problems(L);
      if (pb.length) { H.toast(pb[0], true); return; }
      S.setSettings({ badgeLayout: L }, 'Changed the name badge layout');
      state.badgeDraft = null; H.toast('Saved'); H.go('people/badges');
    },
    layouttest: function () { var L = layoutTyped(); if (Badges.problems(L).length) return; printOnly(Badges.sheets([], L, { test: true }), 'badges'); },
    layoutreset: function () { state.badgeDraft = Badges.layout({ preset: 'church' }); H.render(); },
    badgedone: function () {
      var list = badgesWaiting(); if (!list.length) return;
      list.forEach(function (p) { setBadge(p, p.badgeWanted, H.today(), ''); });
      S.audit('Printed name badges: ' + list.length, 'people');
      H.render(); H.toast(TN('{n} badge marked as printed', '{n} badges marked as printed', list.length));
    }
  });

  Object.assign(P, { invite: invite, inviteLine: inviteLine, invitePanel: invitePanel, appFormHook: formHook, formSettings: function () { return H.can('*') ? declPanel() : ''; }, addBadges: addBadges, layoutChanged: layoutChanged, printBadges: printBadges, printOnly: printOnly, mayApply: mayApply, appsWaiting: waiting, applyMePanel: mePanel, renderApplyForm: renderForm, renderApps: renderApps, renderBadges: renderBadges, badgesWaiting: badgesWaiting, badgeLine: badgeLine, setBadge: setBadge, badgeSheets: badgeSheets, DECL: DECL });
})(PeopleParts);
