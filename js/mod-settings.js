/* Church Hub – Settings: church details, apps on/off, who has access, service times. */
(function () {
  'use strict';
  var H = Hub, esc = H.esc, S = Store, T = I18n.t, TN = I18n.tn;
  var TX = function (s) { return s; };   // a text kept in a list, translated where it is shown (the language test checks it)
  var MODS = [['people', TX('People'), TX('Directory, households and consent')], ['rosters', TX('Rosters'), TX('Serving rosters, teams and serving together')], ['leave', TX('Leave'), TX('Staff leave (Leave Manager built in)')],
    ['care', TX('Care Groups'), TX('Small groups that care for one another')], ['life', TX('Midweek Groups'), TX('Bible studies, life groups, Connect Groups – their leaders name them')], ['leaders', TX('Leadership'), TX('Council, elders and leaders – their roles and portfolios')], ['library', TX('Library'), TX('The church’s library and Archives – books and church records in one place')],
    ['messages', TX('Messages'), TX('Messages from the church to you and your groups')], ['privacy', TX('Privacy'), TX('Privacy law tools (consent, requests, breaches)')], ['import', TX('Import'), TX('Bring data across from Elvanto')],
    ['words', TX('Translations'), TX('Members suggest better wording in their language')]];

  /** The number of people with an access level; point at it (or tap it) to see who they are. Long lists (e.g. "No access") stay a number. */
  function whoHas(ps, role) {
    if (!ps.length || ps.length > 40) return String(ps.length);
    ps = ps.slice().sort(function (a, b) { return (a.lastName + ' ' + a.firstName).localeCompare(b.lastName + ' ' + b.firstName); });
    return '<details class="who-has" data-role="' + role + '"><summary title="' + esc(ps.map(H.name).join(', ')) + '">' + ps.length + '</summary><div class="who-list">' +
      ps.map(function (p) { return '<a href="#/people/p/' + p.id + '">' + esc(H.name(p)) + '</a>'; }).join('') + '</div></details>';
  }

  var DAYS = [TX('Sunday'), TX('Monday'), TX('Tuesday'), TX('Wednesday'), TX('Thursday'), TX('Friday'), TX('Saturday')];
  function slotText(x) { return T(DAYS[x.day || 0]) + ' ' + x.label + (x.venue ? ' · ' + x.venue : ''); }
  /** The church's regular services: times and campuses/venues. Volunteers say which ones they serve at. */
  function renderSlots() {
    var sl = Serving.slots(S.settings()), used = {};
    S.list('skills').forEach(function (k) { (k.times || []).forEach(function (t) { used[t] = (used[t] || 0) + 1; }); });
    return '<section class="panel"><h2>' + T('Church Services and venues') + '</h2><p class="hint" style="margin-top:0">' + T('The church’s regular services. Volunteers say which of these they can serve at, and rostering keeps to it. Add another time, or another campus or venue, when the church starts one.') + '</p>' +
      '<div class="list">' + sl.map(function (x) {
        return '<div class="item"><span class="grow"><b>' + esc(x.label) + '</b><small>' + esc(T(DAYS[x.day || 0]) + ' ' + x.time + (x.venue ? ' · ' + x.venue : '')) + (used[x.id] ? ' · ' + TN('{n} volunteer place', '{n} volunteer places', used[x.id]) : '') + '</small></span>' +
          (sl.length > 1 ? '<button class="icon-btn ghost" data-act="settings:delslot" data-id="' + esc(x.id) + '" aria-label="' + esc(T('Remove {name}', { name: x.label })) + '">' + H.icon(H.ICON.trash, 18) + '</button>' : '') + '</div>';
      }).join('') + '</div>' +
      '<div class="two" style="margin-top:12px"><label class="field">' + T('Day') + '<select id="sl-day">' + DAYS.map(function (d, i) { return '<option value="' + i + '">' + esc(T(d)) + '</option>'; }).join('') + '</select></label>' +
      '<label class="field req">' + T('Time') + '<input id="sl-time" type="time" value="09:30"></label></div>' +
      '<div class="two"><label class="field req">' + T('Name') + '<input id="sl-label" placeholder="' + esc(T('e.g. 9:30am, or Youth service')) + '"></label><label class="field">' + T('Campus or venue') + '<input id="sl-venue" placeholder="' + esc(T('Leave empty for the church itself')) + '"></label></div>' +
      '<button class="btn small" data-act="settings:addslot">' + H.icon(H.ICON.plus, 16) + T('Add a service') + '</button></section>';
  }

  var allSvcs = false;   // show every upcoming service, not just the next few
  /** Services that need a roster: the upcoming ones (remove any you won't hold), regular ones for some weeks, and special ones. */
  function renderServices(st, svcs) {
    var sl = Serving.slots(st), shown = allSvcs ? svcs : svcs.slice(0, 8), year = +H.today().slice(0, 4);
    var specials = Serving.specials(year), groups = [];
    specials.forEach(function (x) { if (groups.indexOf(x.when) < 0) groups.push(x.when); });
    return '<section class="panel"><h2>' + T('Services that need a roster') + '</h2>' +
      (svcs.length ? '<div class="list">' + shown.map(function (s) {
        return '<div class="item"><span class="grow"><b>' + esc(H.fmt(s.date, true)) + (s.special ? ' <span class="tag">' + T('Special') + '</span>' : '') + '</b><small>' + esc(s.time + ' · ' + s.name + (s.venue && s.name.indexOf(s.venue) < 0 ? ' · ' + s.venue : '')) + '</small></span>' +
          '<button class="icon-btn ghost" data-act="settings:delsvc" data-id="' + s.id + '" aria-label="' + esc(T('Remove the service on {date}', { date: H.fmt(s.date, true) })) + '" title="' + esc(T('Remove this service (and its roster)')) + '">' + H.icon(H.ICON.trash, 18) + '</button></div>';
      }).join('') + '</div>' + (svcs.length > 8 ? '<p class="hint"><button class="link" data-act="settings:allsvc">' + (allSvcs ? T('Show fewer') : T('Show all {n}', { n: svcs.length })) + '</button></p>' : '') : '<p class="muted">' + T('None planned.') + '</p>') +
      (svcs.some(function (s) { return !s.special; }) ? '<details class="sub"><summary>' + T('Stop holding a regular service…') + '</summary><p class="hint">' + T('Removes the upcoming ones (and their rosters) from a date. To stop adding it at all, remove it under “Church Services and venues”.') + '</p>' +
        '<div class="two"><label class="field">' + T('Service') + '<select id="sv-stop">' + sl.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(slotText(x)) + '</option>'; }).join('') + '</select></label>' +
        '<label class="field">' + T('From') + '<input type="date" id="sv-stop-from" value="' + H.today() + '"></label></div><button class="btn small" data-act="settings:stopsvc">' + T('Remove these services') + '</button></details>' : '') +
      '<h3 style="margin:16px 0 6px">' + T('Every week') + '</h3><div class="two"><label class="field req">' + T('Service') + '<select id="sv-slot">' + sl.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(slotText(x)) + '</option>'; }).join('') + '</select><small>' + T('Add more times or venues under “Church Services and venues”.') + '</small></label>' +
      '<label class="field">' + T('For the next') + '<select id="sv-n"><option value="4">' + T('4 weeks') + '</option><option value="8" selected>' + T('8 weeks') + '</option><option value="13">' + T('13 weeks') + '</option></select></label></div>' +
      '<button class="btn small" data-act="settings:addsvc">' + T('Add these services') + '</button>' +
      '<h3 style="margin:18px 0 6px">' + T('A special service') + '</h3><p class="hint" style="margin-top:0">' + T('E.g. Maundy Thursday, Good Friday or Christmas Day. Choose one of the suggestions (the date is filled in) or type your own.') + '</p>' +
      '<label class="field req">' + T('Name') + '<input id="sp-name" list="sp-list" autocomplete="off" placeholder="' + esc(T('e.g. Good Friday')) + '"><datalist id="sp-list">' + specials.map(function (x) { return '<option value="' + esc(x.name) + '">' + esc((x.date ? H.fmt(Serving.specialDate(x.name, H.today()), true) + ' · ' : '') + (x.used || x.when)) + '</option>'; }).join('') + '</datalist></label>' +
      '<div class="two"><label class="field req">' + T('Date') + '<input type="date" id="sp-date" min="' + H.today() + '"></label><label class="field req">' + T('Time') + '<input type="time" id="sp-time" value="' + esc((sl[0] || {}).time || '09:00') + '"></label></div>' +
      '<div class="two"><label class="field">' + T('Campus or venue') + '<input id="sp-venue" placeholder="' + esc(T('Leave empty for the church itself')) + '"></label>' +
      '<label class="field">' + T('Teams like') + '<select id="sp-like">' + sl.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(slotText(x)) + '</option>'; }).join('') +
        Serving.specialSlots(st).map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.label) + '</option>'; }).join('') + '</select><small>' + T('Its positions are the ones chosen for this service under Rosters → Services.') + '</small></label></div>' +
      '<button class="btn small" data-act="settings:addspecial">' + H.icon(H.ICON.plus, 16) + T('Add special service') + '</button>' +
      '<details class="sub"><summary>' + T('Ideas by kind of church') + '</summary><div class="hint">' + groups.map(function (g) {
        return '<p style="margin:8px 0 2px"><b>' + esc(g) + '</b></p><p style="margin:0">' + specials.filter(function (x) { return x.when === g; }).map(function (x) { return esc(x.name) + (x.used ? ' <span class="muted">(' + esc(x.used) + ')</span>' : ''); }).join(' · ') + '</p>';
      }).join('') + '</div></details></section>';
  }
  /** Settings is a set of pages, one per topic, with the list of topics (and a search) down the left – on phones a strip
   *  across the top. Each: [id, title, short description, group, icon, extra words the search finds it by]. */
  var GROUPS = [['church', TX('Church')], ['features', TX('Features')], ['access', TX('People and access')], ['comms', TX('Communication')]];
  var SECTIONS = [
    ['general', TX('General'), TX('Name and country'), 'church', 'M3 21h18M5 21V8l7-5 7 5v13M10 21v-6h4v6', 'church name country address province state county privacy law'],
    ['colours', TX('Colours'), TX('The church’s colour'), 'church', 'M12 3a9 9 0 1 0 0 18c1.1 0 1.5-.8 1.5-1.5 0-.9-.7-1.2-.7-2 0-.8.7-1.5 1.5-1.5H17a4 4 0 0 0 4-4c0-5-4-9-9-9zM7.5 11h.01M10 7.5h.01M14 7.5h.01', 'colour color theme brand logo cross buttons'],
    ['terminology', TX('Terminology (Church Words)'), TX('The words your church uses'), 'church', 'M4 7V5h16v2M9 19h6M12 5v14', 'words wording terms names music worship praise leader'],
    ['apps', TX('Apps'), TX('Switch parts of Church Hub on or off'), 'features', 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z', 'modules switch on off people rosters leave care groups messages privacy import translations ai gemini artificial intelligence ask'],
    ['services', TX('Church Services'), TX('Service times, venues and rosters'), 'features', 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4', 'service services times venue campus roster special good friday christmas easter weekly'],
    ['application', TX('Membership application'), TX('Declaration, documents to read, loyalty'), 'features', 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5', 'partner partnership membership member application form declaration constitution statement of faith denomination affiliation loyalty links documents'],
    ['access', TX('Who can see what'), TX('What each access level can see'), 'access', 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'see contact details directory care groups consent roles access level basic church partner roster children'],
    ['pastors', TX('What Pastors can do'), TX('Extra abilities for Pastors'), 'access', 'M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z', 'pastor senior rector assistant minister abilities permissions'],
    ['emails', TX('Email templates'), TX('Birthday, anniversary and welcome emails'), 'comms', 'M3 5h18v14H3zM3 6l9 7 9-7', 'email emails template birthday anniversary welcome newcomer gmail signed sign off']
  ];
  function sectionOf(id) { return SECTIONS.filter(function (x) { return x[0] === id; })[0] || SECTIONS[0]; }
  /** The list of topics: grouped, with a search box that narrows it as you type (Enter opens the first one). */
  function setNav(a) {
    return '<nav class="set-nav" aria-label="' + esc(T('Settings')) + '"><label class="set-q"><span class="sr">' + T('Search settings') + '</span>' + H.icon('M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4', 16) +
      '<input id="set-q" type="search" autocomplete="off" placeholder="' + esc(T('Search settings')) + '"></label>' +
      GROUPS.map(function (g) {
        return '<div class="set-grp"><p class="set-gl">' + esc(T(g[1])) + '</p>' + SECTIONS.filter(function (x) { return x[3] === g[0]; }).map(function (x) {
          var k = [x[1], x[2], T(x[1]), T(x[2]), x[5]].join(' ').toLowerCase();
          return '<a href="#/settings/' + x[0] + '" class="set-link' + (x[0] === a ? ' on' : '') + '"' + (x[0] === a ? ' aria-current="page"' : '') + ' data-k="' + esc(k) + '">' + H.icon(x[4], 18) + '<span>' + esc(T(x[1])) + '</span></a>';
        }).join('') + '</div>';
      }).join('') + '<p class="set-none muted small" hidden>' + T('No settings match that.') + '</p></nav>';
  }
  /** One topic's page: the topic list, then its title, what it's for, and its panels. A topic with one panel shows the
   *  title once (the panel's own heading is dropped). */
  function layout(a, body) {
    var x = sectionOf(a), one = (body.match(/<section class="panel/g) || []).length === 1;
    if (one) body = body.replace(/<h2>[\s\S]*?<\/h2>/, '');
    return '<div class="page-head"><div><h1>' + T('Settings') + '</h1></div></div>' +
      '<div class="set-wrap">' + setNav(x[0]) + '<div class="set-main" id="set-' + x[0] + '"><header class="set-head"><h2>' + esc(T(x[1])) + '</h2><p>' + esc(T(x[2])) + '</p></header>' + body + '</div></div>';
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('input', function (ev) {
      if (!ev.target || ev.target.id !== 'set-q') return;
      var q = ev.target.value.trim().toLowerCase().split(/\s+/).filter(Boolean), any = false;
      [].forEach.call(document.querySelectorAll('.set-grp'), function (g) {
        var shown = 0;
        [].forEach.call(g.querySelectorAll('.set-link'), function (l) { var k = l.dataset.k, hit = q.every(function (w) { return k.indexOf(w) >= 0; }); l.hidden = !hit; if (hit) shown++; });
        g.hidden = !shown; if (shown) any = true;
      });
      var none = document.querySelector('.set-none'); if (none) none.hidden = any;
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter' || !ev.target || ev.target.id !== 'set-q') return;
      var first = document.querySelector('.set-link:not([hidden])'); if (first) { ev.preventDefault(); location.hash = first.getAttribute('href'); }
    });
  }
  /** Terminology (Church Words): a ready-made set for the kind of church, and any word renamed (js/wording.js). Full-width page. */
  function renderTerminology(st) {
    var w = st.wording || {}, cur = Wording.SETS[w.set] ? w.set : 'general', words = Wording.words(st);
    return '<section class="panel" data-own-words><h2>' + T('Terminology (Church Words)') + '</h2><p class="hint" style="margin-top:0">' + T('The words your church uses for people and roles.') + ' ' +
      T('The screens change (in English – the other languages keep their own words); everyone’s records stay as they are.') + '</p>' +
      '<div class="two"><label class="field">' + T('Kind of church') + '<select id="wd-set">' + Object.keys(Wording.SETS).map(function (k) { return '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + esc(Wording.SETS[k].name) + '</option>'; }).join('') + '</select><small>' + T('Choosing one fills in its words below; you can still change any of them.') + '</small></label>' +
      '<label class="field">' + T('Music in services is called') + '<select id="wd-music"><option value="">–</option>' + Object.keys(Wording.MUSIC).map(function (k) {
        return '<option value="' + k + '"' + (Wording.MUSIC[k].worship[0] === words.worship[0] && Wording.MUSIC[k].worshipTeam[0] === words.worshipTeam[0] && Wording.MUSIC[k].worshipLeader[0] === words.worshipLeader[0] ? ' selected' : '') + '>' + esc(k + ' / ' + Wording.MUSIC[k].worshipTeam[0] + ' / ' + Wording.MUSIC[k].worshipLeader[0]) + '</option>';
      }).join('') + '</select><small>' + T('Fills in the three words below; you can still change each one.') + '</small></label></div>' +
      '<div class="two"><label class="field">' + T('The church’s meetings are called') + '<select id="wd-service">' + Object.keys(Wording.SERVICE).map(function (k) {
        return '<option value="' + k + '"' + (Wording.SERVICE[k][0] === words.service[0] ? ' selected' : '') + '>' + esc('Church ' + Wording.SERVICE[k][1]) + '</option>'; }).join('') +
        (Wording.SERVICE[words.service[0]] ? '' : '<option value="" selected>' + esc('Church ' + words.service[1]) + '</option>') + '</select><small>' + T('For example “Church Services” in Settings, and “a service” on the rosters.') + '</small></label></div>' +
      '<div class="table-wrap"><table class="simple"><thead><tr><th>' + T('Church Hub says') + '</th><th>' + T('Your word') + '</th><th>' + T('More than one') + '</th></tr></thead><tbody>' +
      Wording.TERMS.map(function (t) {
        return '<tr><td><b>' + esc(t[1][0]) + '</b><br><span class="muted small">' + esc(T(t[2])) + '</span></td>' +
          '<td><input class="wd-1" data-k="' + t[0] + '" value="' + esc(words[t[0]][0]) + '" aria-label="' + esc(T('Your word for {word}', { word: t[1][0] })) + '"></td>' +
          '<td><input class="wd-2" data-k="' + t[0] + '" value="' + esc(words[t[0]][1]) + '" aria-label="' + esc(T('Your word for {word}', { word: t[1][1] })) + '"></td></tr>';
      }).join('') + '</tbody></table></div><button class="btn small" data-autosave data-act="settings:savewords">' + T('Save wording') + '</button></section>';
  }
  /** Email templates for anniversaries, birthdays, death days of spouses, and welcome messages. */
  /** The choice of how to open emails: the email program (church address) or Gmail in the browser. */
  function methodSelect(id, cur, st) {
    return '<select id="' + id + '"><option value="mail"' + (cur !== 'gmail' ? ' selected' : '') + '>' + esc(T('Your email program ({email})', { email: st.emailOffice || '–' })) + '</option>' +
      '<option value="gmail"' + (cur === 'gmail' ? ' selected' : '') + '>' + esc(T('Gmail in the browser ({email})', { email: st.emailGmail || '–' })) + '</option></select>';
  }
  function renderEmailTemplates(st) {
    var E = window.Emails || (typeof require !== 'undefined' ? require('./emails.js') : null);
    var templates = E ? E.getTemplates(st) : {};
    var curMethod = E ? E.getMethod(st) : 'mail';
    var keys = ['birthday', 'anniversary', 'spouseDeath', 'welcomeFirst', 'welcomeThreeWeeks'];
    var hints = {
      birthday: TX('Sent on a member’s birthday. Placeholders: {firstName}, {lastName}, {fullName}, {churchName}, {yearsText}.'),
      anniversary: TX('Sent on a wedding anniversary. Placeholders: {firstName}, {lastName}, {fullName}, {churchName}, {yearsText}.'),
      spouseDeath: TX('Sent on the death day of a spouse. Placeholders: {firstName}, {lastName}, {fullName}, {spouseName}, {churchName}, {yearsText}.'),
      welcomeFirst: TX('Sent to a newcomer on their first visit. Placeholders: {firstName}, {lastName}, {fullName}, {churchName}.'),
      welcomeThreeWeeks: TX('Sent to a newcomer 3 weeks after their first visit. Placeholders: {firstName}, {lastName}, {fullName}, {churchName}.')
    };

    return '<div data-autoscope><p class="hint set-lead">' + T('Editable email templates for birthdays, anniversaries, late spouse remembrance, and newcomer welcome messages.') + '</p>' +
      '<section class="panel"><h2>' + T('Sending email') + '</h2>' +
      '<p class="hint" style="margin-top:0">' + T('Choose how Church Hub opens emails to send.') + '</p>' +
      '<div class="two"><label class="field">' + T('Church email address') + '<input id="em-office" type="email" value="' + esc(st.emailOffice || '') + '"></label>' +
      '<label class="field">' + T('Church Gmail address') + '<input id="em-gmail" type="email" value="' + esc(st.emailGmail || '') + '"></label></div>' +
      '<div class="two"><label class="field">' + T('Send emails using') + methodSelect('em-method', curMethod, st) +
      '<small>' + T('Your email program opens with the message ready. Gmail opens in the browser: be signed in there with the church’s Gmail account.') + '</small></label>' +
      '<label class="field">' + T('Signed by') + '<input id="em-sign" value="' + esc(st.emailSignOff || '') + '" placeholder="' + esc(st.churchName || '') + '"></label></div>' +
      '<p class="hint">' + T('Only people who agreed to receive email (consent “Email”) are suggested; a married couple gets one anniversary email together. {signOff} in a message is the “Signed by” name.') + '</p>' +
      '</section>' +
      keys.map(function (k) {
        var tmpl = templates[k] || {};
        return '<section class="panel"><h2>' + esc(T(tmpl.name)) + '</h2>' +
          '<p class="hint" style="margin-top:0">' + esc(T(hints[k])) + '</p>' +
          '<label class="field req">' + T('Subject') + '<input id="em-sub-' + k + '" value="' + esc(tmpl.subject) + '"></label>' +
          '<label class="field req">' + T('Message body') + '<textarea id="em-body-' + k + '" rows="5">' + esc(tmpl.body) + '</textarea></label>' +
          '</section>';
      }).join('') +
      '<div class="btns" style="margin-top:16px"><button class="btn primary" data-autosave data-act="settings:saveemails">' + T('Save email templates') + '</button>' +
      '<button class="btn" data-act="settings:resetemails">' + T('Reset to defaults') + '</button></div></div>';
  }

  /** General: the church's name and country, as label-and-box rows. */
  function renderGeneral(st) {
    return '<section class="panel"><h2>' + T('Church') + '</h2><div class="set-rows">' +
      '<div class="set-row"><label class="set-l req" for="st-name"><b>' + T('Church name') + '</b></label><div class="set-c"><input id="st-name" value="' + esc(st.churchName) + '"></div></div>' +
      '<div class="set-row"><label class="set-l req" for="st-country"><b>' + T('Country') + '</b><small>' + T('Sets the usual country for addresses (with its provinces, states or counties) and which privacy law the Privacy pages follow.') + '</small></label>' +
        '<div class="set-c"><select id="st-country">' + Countries.grouped().map(function (g) {
          return '<optgroup label="' + esc(g.continent) + '">' + g.countries.map(function (x) { return '<option value="' + x.code + '"' + (x.code === Countries.church(st).code ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</optgroup>';
        }).join('') + '</select></div></div></div>' +
      '<button class="btn small" data-autosave data-act="settings:name">' + T('Save') + '</button></section>';
  }
  /** Apps: each part of Church Hub with a switch. Switching off hides it for everyone; nothing is deleted. */
  function renderApps(st) {
    return '<section class="panel"><h2>' + T('Apps') + '</h2><p class="hint" style="margin-top:0">' + T('Switch off what you don’t use – its card disappears for everyone. Nothing is deleted.') + '</p><div class="set-rows">' + MODS.map(function (m) {
      return '<label class="set-row"><span class="set-l"><b>' + esc(T(m[1])) + '</b><small>' + esc(T(m[2])) + '</small></span><span class="set-c sw"><input type="checkbox" role="switch" class="st-mod" value="' + m[0] + '"' + (H.isOn(m[0]) ? ' checked' : '') + ' aria-label="' + esc(T(m[1])) + '"></span></label>';
    }).join('') + '</div><p class="hint">' + T('More apps (groups, check-in, messages, calendar) arrive in later phases.') + '</p></section>' + renderAi(st);
  }
  /** Ask in your own words, with AI (Gemini through the church's Firebase project). In English, like other Administrator-only
   *  settings. Needs the one-time setup in docs/AI-SEARCH-SETUP.md (a reCAPTCHA key in js/firebase-config.js). */
  function renderAi(st) {
    var ai = st.ai || {}, cfg = window.CHURCH_HUB_FIREBASE || {}, live = S.isLive(), ready = !!cfg.appCheckKey;
    var guide = 'https://github.com/pian1966/church-hub/blob/main/docs/AI-SEARCH-SETUP.md';
    return '<section class="panel" id="set-ai"><h2>AI for “Ask in your own words”</h2>' +
      '<p class="hint" style="margin-top:0">People → Advanced search understands questions much better with AI: the question (and the list of search fields – never anyone’s records) goes to Google’s Gemini, which turns it into filters. Church Hub checks them and runs the search as usual. If the AI can’t be reached, Church Hub’s own rules are used.</p>' +
      '<div class="set-rows"><label class="set-row"><span class="set-l"><b>Use AI to understand questions</b><small>' +
        (!live ? 'Only when Church Hub is connected to the church’s Firebase project (not in the demo).' : ready ? 'Set up – switch on to use it.' : 'Not set up yet – follow the setup guide first (about 15 minutes).') +
      '</small></span><span class="set-c sw"><input type="checkbox" role="switch" id="st-ai"' + (ai.on ? ' checked' : '') + (live ? '' : ' disabled') + '></span></label>' +
      '<label class="set-row"><span class="set-l"><b>Model</b><small>Change only if Google retires this one (the setup guide says how to check).</small></span><span class="set-c"><input id="st-ai-model" value="' + esc(ai.model || AskAI.MODEL) + '" style="max-width:220px"></span></label></div>' +
      '<p class="hint"><a href="' + guide + '" target="_blank" rel="noopener">Setup guide (docs/AI-SEARCH-SETUP.md)</a> · Before switching on, the Information Officer should agree and the privacy notice should say questions go to Google’s Gemini.</p></section>';
  }

  function render(parts) {
    var st = S.settings(), a = sectionOf((parts && parts[0]) || 'general')[0];
    var body;
    if (a === 'terminology') body = renderTerminology(st);
    else if (a === 'emails') body = renderEmailTemplates(st);
    else if (a === 'colours') body = renderTheme(st);
    else if (a === 'apps') body = renderApps(st);
    else if (a === 'pastors') body = renderPastorCan(st);
    else if (a === 'application') body = window.PeopleParts && PeopleParts.formSettings ? PeopleParts.formSettings() : '';
    else if (a === 'access') {
      var byRole = {}; S.find('people', function (p) { return p.active !== false && p.familyRole !== 'child'; }).forEach(function (p) { (byRole[p.appRole || 'member'] = byRole[p.appRole || 'member'] || []).push(p); });
      body = renderAccess(st, byRole);
    } else if (a === 'services') {
      var svcs = S.list('services').filter(function (s) { return s.date >= H.today(); }).sort(function (x, y) { return x.date < y.date ? -1 : 1; });
      body = renderSlots() + renderServices(st, svcs);
    } else body = renderGeneral(st);
    return layout(a, body);
  }

  /** Who can see what: each access level, what it can use, which of other people's contact details it sees
   *  (only adults who agreed to be in the directory; name only unless ticked), and who has it. Administrators and
   *  Pastors always see everything; No access can't sign in. Saved as settings.seeOthers = { member, rosters, kids }. */
  var ACCESS = [['admin', 'Everything, including Privacy, Import and Settings – except pastoral and medical notes'], ['pastor', 'People, households, pastoral notes, children'], ['rosters', 'Rosters and teams; names and contact details only'], ['kids', 'Children, guardians and medical notes'], ['member', 'Their own details, serving and leave; the church directory'], ['none', 'Can’t sign in (kept on the church records only)']];
  /** The church's colours (settings.theme = { id: 'custom', color } – older choices { id } still work): buttons, links,
   *  the turning cross, the logo and the menu, for everyone. Like Leave Manager's "My colour": a live sample at the top,
   *  round swatches, any colour by its code, and a Save button – nothing changes for anyone until it is saved. */
  // Bright colours that well-known churches use for their buttons and logos (Nov 2026: Alpha, Life.Church, Elevation, The Creek,
  // UCC, Jesus People and others), with Church Hub's own orange first. Light ones get dark writing on buttons (Hub.themeFrom).
  var SWATCHES = ['#E8590C', '#F49A0D', '#F8A91F', '#FDC830', '#E42312', '#A6192E', '#E84A8A', '#6D3FC0', '#27375E',
    '#007EA9', '#00A8D8', '#2ABACC', '#71C5E8', '#9ECDC9', '#598D7F', '#2E7D4F', '#606951', '#1E1F23'];
  var CROSS_SVG = '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="22.6" y="3" width="2.8" height="42" rx="1.4"/><rect x="11" y="15.6" width="26" height="2.8" rx="1.4"/></svg>';
  function themeVars(t) { return '--a:' + t.accent + ';--ao:' + (t.on || '#FFFFFF') + ';--ai:' + t.ink + ';--as:' + t.soft + ';--s:' + t.side + ';--s2:' + t.side2; }
  function renderTheme(st) {
    var t = H.themeOf(st), hex = ((st.theme || {}).id === 'custom' ? st.theme.color : t.accent).toUpperCase(), shown = H.themeFrom(hex), hsv = toHsv(hex);
    pick = { h: hsv.h, s: hsv.s, v: hsv.v };
    return '<section class="panel" id="st-theme" data-noauto><h2>' + T('Colours') + '</h2>' +
      '<p class="hint" style="margin-top:0">' + T('The church’s colour for buttons, links, the turning cross and the menu – everyone sees it.') + '</p>' +
      // The live sample: the menu with the logo, a button, a Save button, a link and the turning cross
      '<div class="th-prev" id="th-prev" style="' + themeVars(shown) + '">' +
        '<div class="th-pside"><span class="th-pmark">' + H.icon('M12 3v18M6 9h12', 18) + '</span><span class="th-pnav"></span><span class="th-pnav on"></span><span class="th-pnav"></span></div>' +
        '<div class="th-pmain"><span class="th-pbtn">' + H.icon(H.ICON.plus, 16) + T('Add') + '</span><span class="th-psave">' + T('Save') + '</span>' +
        '<span class="th-plink">Church Hub</span><span class="th-pcross">' + CROSS_SVG + '</span></div></div>' +
      '<div class="th-sws" role="radiogroup" aria-label="' + esc(T('Colours')) + '">' + SWATCHES.map(function (c) {
        return '<button type="button" class="th-sw' + (c === hex ? ' on' : '') + '" data-c="' + c + '" style="--c:' + c + '" role="radio" aria-checked="' + (c === hex) + '" aria-label="' + c + '"></button>';
      }).join('') + '</div>' +
      // "Or pick any colour": our own picker (the phones' built-in colour windows look rough) – a colour area to drag
      // across, a rainbow bar for the shade, and the colour's code to type in
      '<div class="th-any"><label for="st-th-c">' + T('Or pick any colour') + '</label>' +
        '<div class="th-pick" id="th-pick" style="--h:' + Math.round(hsv.h) + '">' +
          '<div class="th-sv" id="th-sv" tabindex="0" role="slider" aria-label="' + esc(T('Or pick any colour')) + '" aria-valuetext="' + esc(hex) + '">' +
            '<span class="th-svk" id="th-svk" style="left:' + (hsv.s * 100).toFixed(1) + '%;top:' + ((1 - hsv.v) * 100).toFixed(1) + '%;background:' + esc(hex) + '"></span></div>' +
          '<input type="range" class="th-hue" id="th-hue" min="0" max="359" step="1" value="' + Math.round(hsv.h) + '" aria-label="' + esc(T('Colours')) + '">' +
          '<div class="th-hexrow"><span class="th-chip" id="th-chip" style="background:' + esc(hex) + '"></span>' +
            '<input id="st-th-c" class="th-hexin" value="' + esc(hex) + '" maxlength="7" spellcheck="false" autocomplete="off" autocapitalize="characters" inputmode="text"></div>' +
        '</div><code id="th-hex" hidden>' + esc(hex) + '</code></div>' +
      '<p class="hint" id="th-dark"' + (shown.light ? '' : ' hidden') + '>' + T('Writing on buttons will be dark, so it stays easy to read.') + '</p>' +
      '<button class="btn save" data-act="settings:theme">' + T('Save the church’s colour') + '</button></section>';
  }
  /** Colours as hue (0–360), saturation and brightness (0–1), for the picker. */
  function toHsv(hex) {
    var n = parseInt(String(hex).slice(1), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0;
    if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return { h: (h * 60 + 360) % 360, s: mx ? d / mx : 0, v: mx };
  }
  function fromHsv(h, s, v) {
    var f = function (n) { var k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
    return '#' + [f(5), f(3), f(1)].map(function (x) { return ('0' + Math.round(x * 255).toString(16)).slice(-2); }).join('').toUpperCase();
  }
  var pick = { h: 0, s: 0, v: 0 };   // where the picker is (kept, so a grey doesn't lose its hue)
  function cleanHex(v) { v = String(v || '').trim().toUpperCase(); if (v[0] !== '#') v = '#' + v; return /^#[0-9A-F]{6}$/.test(v) ? v : ''; }
  /** Trying a colour: only the sample changes, until Save. from: what was used ('sv', 'hue', 'code'), so it isn't moved under the finger. */
  function themeTry(hex, from) {
    hex = cleanHex(hex); var prev = document.getElementById('th-prev'); if (!hex || !prev) return;
    var t = H.themeFrom(hex);
    prev.setAttribute('style', themeVars(t));
    document.getElementById('th-hex').textContent = hex;
    document.getElementById('th-dark').hidden = !t.light;
    [].forEach.call(document.querySelectorAll('.th-sw'), function (b) { var on = b.dataset.c === hex; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    if (from !== 'sv' && from !== 'hue') { var p = toHsv(hex); pick.s = p.s; pick.v = p.v; if (p.s && p.v) pick.h = p.h; }
    var box = document.getElementById('st-th-c'), area = document.getElementById('th-pick'), knob = document.getElementById('th-svk'), hue = document.getElementById('th-hue');
    if (from !== 'code' && box) box.value = hex;
    if (area) area.style.setProperty('--h', Math.round(pick.h));
    if (hue && from !== 'hue') hue.value = Math.round(pick.h);
    if (knob) { knob.style.left = (pick.s * 100).toFixed(1) + '%'; knob.style.top = ((1 - pick.v) * 100).toFixed(1) + '%'; knob.style.background = hex; }
    var chip = document.getElementById('th-chip'); if (chip) chip.style.background = hex;
    var sv = document.getElementById('th-sv'); if (sv) sv.setAttribute('aria-valuetext', hex);
  }
  function svAt(el, x, y) {
    var r = el.getBoundingClientRect();
    pick.s = Math.max(0, Math.min(1, (x - r.left) / r.width)); pick.v = 1 - Math.max(0, Math.min(1, (y - r.top) / r.height));
    themeTry(fromHsv(pick.h, pick.s, pick.v), 'sv');
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('click', function (ev) { var b = ev.target.closest && ev.target.closest('.th-sw'); if (b) themeTry(b.dataset.c); });
    // The colour area: press and drag (finger or mouse); the page doesn't scroll while dragging (touch-action: none)
    var dragging = null;
    document.addEventListener('pointerdown', function (ev) {
      var el = ev.target.closest && ev.target.closest('#th-sv'); if (!el) return;
      pick.h = +document.getElementById('th-hue').value;
      dragging = el; try { el.setPointerCapture(ev.pointerId); } catch (e) { /* older browsers */ }
      ev.preventDefault(); svAt(el, ev.clientX, ev.clientY);
    });
    document.addEventListener('pointermove', function (ev) { if (dragging) { ev.preventDefault(); svAt(dragging, ev.clientX, ev.clientY); } });
    ['pointerup', 'pointercancel'].forEach(function (k) { document.addEventListener(k, function () { dragging = null; }); });
    document.addEventListener('keydown', function (ev) {   // arrows on the colour area: lighter, darker, softer, stronger
      if (!ev.target || ev.target.id !== 'th-sv') return;
      var d = { ArrowLeft: [-0.05, 0], ArrowRight: [0.05, 0], ArrowUp: [0, 0.05], ArrowDown: [0, -0.05] }[ev.key]; if (!d) return;
      ev.preventDefault(); pick.h = +document.getElementById('th-hue').value;
      pick.s = Math.max(0, Math.min(1, pick.s + d[0])); pick.v = Math.max(0, Math.min(1, pick.v + d[1]));
      themeTry(fromHsv(pick.h, pick.s, pick.v), 'sv');
    });
    ['input', 'change'].forEach(function (k) {
      document.addEventListener(k, function (ev) {
        var t = ev.target; if (!t) return;
        if (t.id === 'th-hue') { pick.h = +t.value; if (!pick.s && !pick.v) pick.v = 1; if (!pick.s) pick.s = 1; themeTry(fromHsv(pick.h, pick.s, pick.v), 'hue'); }
        else if (t.id === 'st-th-c') { var h = cleanHex(t.value); if (h) themeTry(h, k === 'change' ? '' : 'code'); else if (k === 'change') t.value = document.getElementById('th-hex').textContent; }
      });
    });
  }
  function renderAccess(st, byRole) {
    var P = window.PeopleParts, see = st.seeOthers || {}, care = st.seeCare || [];
    var roleHead = function (r) { return '<th scope="col" class="c">' + esc(H.roleLabel(r)) + '</th>'; };
    var always = '<p class="hint" style="margin:6px 0 0">' + T('Administrators and Pastors always see everything.') + '</p>';
    var box = function (cls, val, on, label) { return '<td class="c"><input type="checkbox" class="' + cls + '"' + (val ? ' value="' + val + '"' : '') + (on ? ' checked' : '') + ' aria-label="' + esc(label) + '"></td>'; };
    var none = '<td class="c muted">–</td>';
    // 1. What each kind of access can do, and who has it
    var html = '<section class="panel" id="access-kinds"><h2>' + T('What each kind of access can do') + '</h2>' +
      '<div class="table-wrap"><table class="simple"><thead><tr><th>' + T('Access') + '</th><th>' + T('Can') + '</th><th class="c">' + T('People') + '</th></tr></thead><tbody>' +
      ACCESS.map(function (r) { return '<tr><td><b>' + esc(H.roleLabel(r[0])) + '</b></td><td>' + esc(T(r[1])) + '</td><td class="c">' + whoHas(byRole[r[0]] || [], r[0]) + '</td></tr>'; }).join('') +
      '</tbody></table></div><p class="hint">' + T('Change someone’s access from their profile (People → Edit details).') + '</p></section>';
    if (!P) return html;
    // 2. Contact details of people in the church directory
    html += '<div data-autoscope>' +   // both panels below save together, by themselves
      '<section class="panel" id="see-others"><h2>' + T('Other people’s contact details') + ' ' + H.tip(T('Only people who agreed to “Church directory” are shown to others. People with Basic access see contact details as pictures: they can read them, but can’t tap or copy them.')) + '</h2>' +
      '<p class="hint" style="margin-top:0">' + T('Everyone who signs in sees the name and photo of people in the church directory. Tick which of their contact details each kind of access may also see.') + '</p>' +
      '<div class="table-wrap"><table class="simple see-grid"><thead><tr><th>' + T('Contact detail') + '</th>' + P.TIERS.map(function (t) { return roleHead(t[0]); }).join('') + '</tr></thead><tbody>' +
      P.SHARE.map(function (f) {
        return '<tr><td>' + esc(T(f[1])) + (f[0] === 'spouse' ? ' ' + H.tip(T('The name of their husband, wife or partner, when both are in Church Hub.')) : '') + '</td>' + P.TIERS.map(function (t) {
          return box('st-see" data-t="' + t[0], f[0], (see[t[0]] || []).indexOf(f[0]) >= 0, H.roleLabel(t[0]) + ': ' + T(f[1]));
        }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>' + always +
      (function (n) {   // Church Partners never asked about the church directory: they agreed when they became Church Partners
        return n && H.can('*') ? '<p class="hint">' + TN('{n} Church Partner has no Church directory answer recorded. If they agreed when they became a Church Partner, record it here.', '{n} Church Partners have no Church directory answer recorded. If they agreed when they became Church Partners, record it here.', n) +
          ' <button class="btn small" data-act="settings:partnersagree">' + T('Record that they agreed') + '</button></p>' : '';
      })(P.partnersUnrecorded ? P.partnersUnrecorded().length : 0) + '</section>';
    // 3. Care groups
    var row = function (label, tip, cells) { return '<tr><td>' + esc(label) + ' ' + H.tip(tip) + '</td>' + cells + '</tr>'; };
    html += '<section class="panel" id="see-care"><h2>' + T('Care Groups') + '</h2>' +
      '<p class="hint" style="margin-top:0">' + T('What each kind of access sees of the Care Groups. Carers always see everyone in their own group.') + '</p>' +
      '<div class="table-wrap"><table class="simple see-grid"><thead><tr><th>' + T('They may') + '</th>' + P.TIERS.map(function (t) { return roleHead(t[0]); }).join('') + '</tr></thead><tbody>' +
      row(T('See all Care Groups and who is in each'), T('Names only, on the Care Groups page. Church Partners see only people who are in the church directory.'),
        P.TIERS.map(function (t) { return box('st-care', t[0], care.indexOf(t[0]) >= 0, H.roleLabel(t[0]) + ': ' + T('See all Care Groups and who is in each')); }).join('')) +
      row(T('See which Care Group someone is in, on their page in People'), T('A “Care Group member” or “Carer” tag with the group’s name, on the person’s page and in the directory.'),
        box('st-careppl', '', S.careOnPeople(), H.roleLabel('member') + ': ' + T('See which Care Group someone is in, on their page in People')) + '<td class="c muted" colspan="' + (P.TIERS.length - 1) + '">' + T('when they may see all Care Groups') + '</td>') +
      row(T('See everyone in their own Care Group, not just the carers'), T('Members of a Care Group see each other’s cards (photo, phone, email, address, birthday) if each one agreed to “Care Group”.'),
        box('st-careown', '', st.seeCareOwn !== false, H.roleLabel('member') + ': ' + T('See everyone in their own Care Group, not just the carers')) + '<td class="c muted" colspan="' + (P.TIERS.length - 1) + '">–</td>') +
      '</tbody></table></div>' + always +
      (function (n) {   // "All groups" for Church Partners shows only people in the church directory: say how many are left out
        return n ? '<p class="hint care-hidden">' + TN('{n} person in a Care Group isn’t in the church directory, so Church Partners don’t see them on the Care Groups page.', '{n} people in Care Groups aren’t in the church directory, so Church Partners don’t see them on the Care Groups page.', n) +
          ' <button class="btn small" data-act="settings:carehidden">' + T('Show them') + '</button></p>' : '';
      })((H.can('*') || H.can('settings.manage')) && care.indexOf('member') >= 0 ? careHidden().length : 0) +
      '<button class="btn small" data-autosave data-act="settings:see">' + T('Save') + '</button></section></div>';
    return html;
  }

  /** People in a care group whom Church Partners don't see on the Care groups page (it lists only the church directory),
   *  and why: [{ p, why: 'notAsked' | 'saidNo' | 'inactive' | 'child' }]. */
  function careHidden() {
    var P = window.PeopleParts, ids = {}, out = [];
    S.list('careGroups').forEach(function (g) { (g.memberIds || []).forEach(function (id) { ids[id] = 1; }); });
    Object.keys(ids).forEach(function (id) {
      var p = S.get('people', id); if (!p || p.firstName === 'Deleted' || p.mergedInto) return;
      var c = P.consentFor(p.id, 'Church directory');
      var why = p.familyRole === 'child' ? 'child' : p.active === false ? 'inactive' : !c ? 'notAsked' : !c.given ? 'saidNo' : '';
      if (why) out.push({ p: p, why: why });
    });
    return out.sort(function (a, b) { return H.name(a.p).localeCompare(H.name(b.p)); });
  }

  /** What Pastors can do: an Administrator ticks the Administrator abilities Pastors may have (settings.pastorCan).
   *  They may also choose the Senior Pastor (Rector, settings.seniorPastorId), who gets their own ticks (settings.seniorCan);
   *  the other Pastors are then shown as Assistant Pastors (Assistant Ministers). Church Hub copies the ticks onto each
   *  Pastor's access-list entry, and the database rules check them there. */
  function renderPastorCan(st) {
    var on = st.pastorCan || [], son = st.seniorCan || [], admin = H.can('*'), dis = admin ? '' : ' disabled';
    var pastors = S.find('people', function (p) { return p.appRole === 'pastor' && p.active !== false; }).sort(function (x, y) { return H.name(x) < H.name(y) ? -1 : 1; });
    var sid = st.seniorPastorId || '', senior = sid && pastors.some(function (p) { return p.id === sid; }) ? sid : '';
    var box = function (cls, a, list, label) {
      return '<input type="checkbox" class="' + cls + '" value="' + a[0] + '"' + (list.indexOf(a[0]) >= 0 ? ' checked' : '') + dis + ' aria-label="' + esc(label + ': ' + T(a[1])) + '">';
    };
    var ticks = senior
      ? '<div class="table-wrap"><table class="simple"><thead><tr><th></th><th>' + T('Senior Pastor') + '</th><th>' + T('Assistant Pastors') + '</th></tr></thead><tbody>' +
        H.PASTOR_CAN.map(function (a) {
          return '<tr><td>' + esc(T(a[1])) + '</td><td>' + box('st-sc', a, son, T('Senior Pastor')) + '</td><td>' + box('st-pc', a, on, T('Assistant Pastors')) + '</td></tr>';
        }).join('') + '</tbody></table></div>'
      : '<div class="pc-list">' + H.PASTOR_CAN.map(function (a) {
        return '<label class="check"><input type="checkbox" class="st-pc" value="' + a[0] + '"' + (on.indexOf(a[0]) >= 0 ? ' checked' : '') + dis + '><span>' + esc(T(a[1])) + '</span></label>';
      }).join('') + '</div>';
    return '<section class="panel" id="pastor-can"><h2>' + T('What Pastors can do') + '</h2>' +
      '<p class="hint" style="margin-top:0">' + T('Pastors always see and edit everyone’s details, households, children and pastoral notes. Tick what else they may do – up to everything an Administrator does. Medical notes stay with Children’s ministry.') + '</p>' +
      '<label class="field" style="max-width:420px">' + T('Senior Pastor') + '<select id="st-senior"' + dis + '><option value="">' + T('Nobody – all Pastors the same') + '</option>' +
        pastors.map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === senior ? ' selected' : '') + '>' + esc(H.name(p)) + '</option>'; }).join('') + '</select>' +
        '<small>' + T('The Pastor who leads the church can have more than the others. The other Pastors are then called Assistant Pastors.') + '</small></label>' +
      ticks +
      (admin ? '<div class="btns"><button class="btn small" data-autosave data-act="settings:pastorcan">' + T('Save') + '</button><button class="btn small ghost" data-act="settings:pastorall">' + T('Tick everything') + '</button></div>' +
        '<p class="hint">' + T('Pastors get the change the next time they open Church Hub.') + (Store.isLive() ? ' ' + T('If you have changed the database rules file, publish it again first (FIREBASE-SETUP step 7).') : '') + '</p>'
        : '<p class="hint">' + T('Only an Administrator can change this.') + '</p>') + '</section>';
  }

  /** Today's email suggestions: only people who agreed to email; couples together; late spouses as the People page finds them. */
  function todaysEmails() {
    var E = window.Emails, P = window.PeopleParts; if (!E) return [];
    var today = H.today(), done = {};
    S.list('emailPrompts').forEach(function (r) { if (r.date === today) done[r.id] = true; });
    return E.findEvents(S.list('people'), today, done, {
      canEmail: function (p) { return P ? P.hasConsent(p.id, 'Email') : false; },
      spouseOf: function (p) { var c = P && P.coupleOf(p.id); return c ? S.get('people', c.a === p.id ? c.b : c.a) : null; },
      lateSpouse: function (p) { return P ? P.lateSpouse(p) : null; }
    });
  }
  /** Set a prompt aside for today (sent or not sending); yesterday's are cleared away. */
  function promptDone(evId, why) {
    var E = window.Emails, today = H.today();
    if (E) E.stale(S.list('emailPrompts'), today).forEach(function (r) { S.remove('emailPrompts', r.id); });
    S.put('emailPrompts', { id: evId, date: today, done: why }, why === 'sent' ? 'Opened an email from the day’s prompts' : 'Set aside an email prompt for today');
  }

  function dailyEmailTodos() {
    if (!H.can('settings.manage')) return [];
    var E = window.Emails; if (!E) return [];
    var events = todaysEmails();
    var labels = {
      birthday: TX('Send birthday email to {name}'),
      anniversary: TX('Send wedding anniversary email to {name}'),
      spouseDeath: TX('Send comforting email to {name} (spouse’s death anniversary)'),
      welcomeFirst: TX('Send welcome email to {name} (first visit)'),
      welcomeThreeWeeks: TX('Send 3-week welcome email to {name}')
    };

    return events.map(function (ev) {
      return {
        text: T(labels[ev.type], { name: ev.data.fullName || H.name(ev.person) }),
        href: '#/settings/sendemail/' + encodeURIComponent(ev.id),
        tag: 'Email',
        ev: ev
      };
    });
  }

  function showSendDialog(evId) {
    var E = window.Emails; if (!E) return;
    var st = S.settings();
    var ev = todaysEmails().filter(function (x) { return x.id === evId; })[0];
    if (!ev) {
      H.toast(T('That email prompt is no longer needed or already sent'));
      H.go('home');
      return;
    }

    var templates = E.getTemplates(st);
    var tmpl = templates[ev.type] || {};
    var data = Object.assign({}, ev.data, {
      churchName: st.churchName || '', signOff: st.emailSignOff || st.churchName || ''
    });
    var subject = E.interpolate(tmpl.subject, data);
    var body = E.interpolate(tmpl.body, data);
    var curMethod = E.getMethod(st);

    var html = H.dialogHead(T('Send email to {name}', { name: ev.data.fullName || H.name(ev.person) })) +
      '<div class="dlg-body">' +
      '<div class="two"><label class="field">' + T('To') + '<input id="em-send-to" value="' + esc(ev.recipientEmail) + '" readonly></label>' +
      '<label class="field">' + T('Send using') + methodSelect('em-send-method', curMethod, st) + '</label></div>' +
      '<label class="field req">' + T('Subject') + '<input id="em-send-sub" value="' + esc(subject) + '"></label>' +
      '<label class="field req">' + T('Message') + '<textarea id="em-send-body" rows="10">' + esc(body) + '</textarea></label>' +
      '</div>' +
      '<div class="dlg-foot" style="justify-content:space-between">' +
      '<button class="btn ghost" data-act="settings:dismissemail" data-id="' + esc(ev.id) + '">' + T('Don’t send today') + '</button>' +
      '<div><button class="btn" data-act="hub:close">' + T('Cancel') + '</button> ' +
      '<button class="btn primary" data-act="settings:sendemailnow" data-id="' + esc(ev.id) + '">' + T('Open email') + '</button></div>' +
      '</div>';

    H.modal(html, T('Send email'));
  }

  H.register({
    id: 'settings', name: 'Settings', desc: 'Church details, apps and access', icon: H.ICON.settings, tint: '#6B625A', roles: ['admin'], perm: 'settings.manage',
    todos: function (u) {
      return dailyEmailTodos();
    },
    render: function (parts) {
      if (parts && parts[0] === 'sendemail' && parts[1]) {
        setTimeout(function () { showSendDialog(decodeURIComponent(parts[1])); }, 50);
        return render(['emails']);
      }
      return H.can('settings.manage') ? render(parts) : '<p class="empty">' + T('Only Administrators can change settings.') + '</p>';
    },
    after: function () {
      var on = document.querySelector('.set-link.on');   // phones: the topic strip shows the open topic
      if (on && window.matchMedia && matchMedia('(max-width: 860px)').matches && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'center' });
      var sn = document.getElementById('sp-name'), sd = document.getElementById('sp-date');
      if (sn && sd) sn.addEventListener('input', function () {
        var d = Serving.specialDate(sn.value.trim(), H.today()); if (d) sd.value = d;   // a suggestion fills in its date
        var sp = Serving.findSpecial(sn.value, S.settings()), like = document.getElementById('sp-like'); if (sp && like) like.value = sp.id;   // and its positions (Good Friday → Good Friday)
      });
      var ws = document.getElementById('wd-set');
      if (ws) ws.addEventListener('change', function () {   // fill in the set's words, to save or change
        var w = Wording.words({ wording: { set: ws.value } });
        document.querySelectorAll('.wd-1').forEach(function (i) { i.value = w[i.dataset.k][0]; });
        document.querySelectorAll('.wd-2').forEach(function (i) { i.value = w[i.dataset.k][1]; });
      });
      var wsv = document.getElementById('wd-service');
      if (wsv) wsv.addEventListener('change', function () {   // Service / Meeting / Gathering
        var m = Wording.SERVICE[wsv.value]; if (!m) return;
        var a = document.querySelector('.wd-1[data-k="service"]'), b = document.querySelector('.wd-2[data-k="service"]'); if (a) a.value = m[0]; if (b) b.value = m[1];
      });
      var wm = document.getElementById('wd-music');
      if (wm) wm.addEventListener('change', function () {   // Worship / Music / Praise: fill in the three words
        var m = Wording.MUSIC[wm.value]; if (!m) return;
        Object.keys(m).forEach(function (k) { var a = document.querySelector('.wd-1[data-k="' + k + '"]'), b = document.querySelector('.wd-2[data-k="' + k + '"]'); if (a) a.value = m[k][0]; if (b) b.value = m[k][1]; });
      });
      var aiOn = document.getElementById('st-ai'), aiModel = document.getElementById('st-ai-model');
      var saveAi = function () {
        var m = String(aiModel.value || '').trim(); if (!/^[a-z0-9][a-z0-9.\-]{2,60}$/i.test(m)) { aiModel.value = (S.settings().ai || {}).model || AskAI.MODEL; return; }
        S.setSettings({ ai: { on: aiOn.checked, model: m } }, (aiOn.checked ? 'AI for Ask switched on' : 'AI for Ask switched off') + ' (' + m + ')'); H.toast(aiOn.checked ? 'AI switched on' : 'AI switched off');
      };
      if (aiOn) aiOn.addEventListener('change', saveAi);
      if (aiModel) aiModel.addEventListener('change', saveAi);
      document.querySelectorAll('.st-mod').forEach(function (b) {
        b.addEventListener('change', function () {
          var m = Object.assign({}, S.settings().modules); m[b.value] = b.checked;
          if (b.value === 'library') m.archive = b.checked;
          S.setSettings({ modules: m }, (b.checked ? 'Switched on ' : 'Switched off ') + b.value);
          H.toast(T(b.checked ? 'Switched on' : 'Switched off – its card is hidden')); H.render();
        });
      });
    },
    actions: {
      saveemails: function () {
        var E = window.Emails; if (!E) return;
        var keys = ['birthday', 'anniversary', 'spouseDeath', 'welcomeFirst', 'welcomeThreeWeeks'];
        var templates = {};
        keys.forEach(function (k) {
          var subEl = document.getElementById('em-sub-' + k);
          var bodyEl = document.getElementById('em-body-' + k);
          templates[k] = {
            subject: subEl ? subEl.value.trim() : '',
            body: bodyEl ? bodyEl.value.trim() : ''
          };
        });
        var methEl = document.getElementById('em-method');
        var method = methEl ? methEl.value : 'mail', val = function (id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; };
        S.setSettings({ emailTemplates: templates, emailMethod: method, emailOffice: val('em-office'), emailGmail: val('em-gmail'), emailSignOff: val('em-sign') }, 'Saved email templates');
        H.render(); H.toast(T('Email templates saved'));
      },
      resetemails: function () {
        var E = window.Emails; if (!E) return;
        S.setSettings({ emailTemplates: null }, 'Reset email templates to defaults');
        H.render(); H.toast(T('Reset to defaults'));
      },
      dismissemail: function (el) {
        var evId = el.dataset.id; if (!evId) return;
        promptDone(evId, 'skipped');
        H.closeModal();
        H.render();
        H.toast(T('Prompt dismissed for today'));
      },
      sendemailnow: function (el) {
        var evId = el.dataset.id; if (!evId) return;
        var E = window.Emails; if (!E) return;
        var to = (document.getElementById('em-send-to') || {}).value || '';
        var method = (document.getElementById('em-send-method') || {}).value || 'mail';
        var subject = (document.getElementById('em-send-sub') || {}).value || '';
        var body = (document.getElementById('em-send-body') || {}).value || '';

        var url = E.makeSendUrl(method, {
          to: to,
          subject: subject,
          body: body,
          from: (S.settings() || {}).emailGmail || ''
        });

        promptDone(evId, 'sent');   // the prompt goes for today

        H.closeModal();
        H.render();

        if (method === 'gmail') {
          window.open(url, '_blank', 'noopener,noreferrer');
        } else {
          location.href = url;
        }
        H.toast(T('Opening email…'));
      },
      pastorcan: function () {
        if (!H.can('*')) return;
        var ticked = function (cls) {
          var on = [].slice.call(document.querySelectorAll('.' + cls + ':checked')).map(function (c) { return c.value; });
          return H.PASTOR_CAN.filter(function (a) { return on.indexOf(a[0]) >= 0; }).map(function (a) { return a[0]; });
        };
        var st = S.settings() || {}, sel = document.getElementById('st-senior'), sid = sel ? sel.value : '', names = ticked('st-pc');
        var upd = { pastorCan: names, seniorPastorId: sid }, say = (sid ? 'Assistant Pastors' : 'What Pastors can do') + ': ' + (names.join(', ') || 'nothing extra');
        if (sid) {
          // A Senior Pastor just chosen starts with what the Pastors could already do; after that, their own ticks
          upd.seniorCan = document.querySelector('.st-sc') ? ticked('st-sc') : (st.seniorCan && st.seniorPastorId ? st.seniorCan : names).slice();
          var sp = S.get('people', sid);
          say = 'Senior Pastor: ' + (sp ? H.name(sp) : sid) + ' (' + (upd.seniorCan.join(', ') || 'nothing extra') + '); ' + say;
        } else upd.seniorCan = [];
        S.setSettings(upd, say);
        S.syncPastors(); H.render(); H.toast(T('Saved'));
      },
      pastorall: function () { document.querySelectorAll('.st-pc, .st-sc').forEach(function (c) { c.checked = true; }); var c = document.querySelector('.st-pc'); if (c) c.dispatchEvent(new Event('change', { bubbles: true })); },
      /** Who is in a care group but not in the church directory, by reason, with a link to each. */
      carehidden: function () {
        var all = careHidden();
        var groups = [['notAsked', TX('Church directory not asked yet'), TX('“Record that they agreed” records it for Church Partners; for anyone else, record their answer on their profile (Consent).')],
          ['saidNo', TX('Said no to sharing their contact details'), TX('They stay hidden unless they change their mind (their profile → Consent).')],
          ['inactive', TX('No longer active'), TX('Take them out of their Care Group, or mark them active again.')],
          ['child', TX('Children'), TX('Children are never shown to other members.')]];
        H.modal(H.dialogHead(T('In Care Groups, but not in the church directory'), TN('{n} person', '{n} people', all.length)) + '<div class="dlg-body">' + groups.map(function (gr) {
          var ps = all.filter(function (x) { return x.why === gr[0]; }); if (!ps.length) return '';
          return '<h3 style="margin:14px 0 4px">' + esc(T(gr[1])) + ' (' + ps.length + ')</h3><p class="hint" style="margin:0 0 6px">' + esc(T(gr[2])) + '</p><div class="list">' +
            ps.map(function (x) { return '<a class="item" href="#/people/p/' + esc(x.p.id) + '" data-act="hub:close">' + H.avatar(x.p, 28) + '<span class="grow"><b>' + esc(H.name(x.p)) + '</b>' + (x.p.category ? '<small>' + esc(T(x.p.category)) + '</small>' : '') + '</span></a>'; }).join('') + '</div>';
        }).join('') + '</div>', T('In Care Groups, but not in the church directory'));
      },
      /** Church Partners with no Contact details answer recorded: they agreed when they became Church Partners. */
      partnersagree: function (el) {
        var ps = window.PeopleParts.partnersUnrecorded(); if (!ps.length) return;
        if (!H.confirmBtn(el, T('Click again: record it for them'))) return;
        ps.forEach(function (p) { window.PeopleParts.partnerAgrees(p, ''); });
        H.render(); H.toast(T('Recorded.'));
      },
      see: function () {
        var see = {}; window.PeopleParts.TIERS.forEach(function (t) { see[t[0]] = []; });
        document.querySelectorAll('.st-see').forEach(function (b) { if (b.checked) see[b.dataset.t].push(b.value); });
        var say = window.PeopleParts.TIERS.map(function (t) { return t[0] + ': ' + (see[t[0]].length ? see[t[0]].join(', ') : 'name only'); }).join('; ');
        var care = [].slice.call(document.querySelectorAll('.st-care:checked')).map(function (b) { return b.value; });
        var ownBox = document.querySelector('.st-careown'), own = ownBox ? ownBox.checked : (S.settings() || {}).seeCareOwn !== false;
        var pplBox = document.querySelector('.st-careppl'), ppl = pplBox ? pplBox.checked : S.careOnPeople();
        S.setSettings({ seeOthers: see, seeCare: care, seeCareOwn: own, careOnPeople: ppl }, 'Who can see what (contact details): ' + say + '. Care groups: ' + (care.join(', ') || 'Administrators and Pastors only') +
          '; members see ' + (own ? 'everyone in their own group' : 'only the carers of their own group') + '; members ' + (ppl ? 'see' : 'don’t see') + ' a person’s care group on their page');
        S.resyncDirectory();   // everyone's shared contact details, as now allowed
        H.render(); H.toast(T('Saved'));
      },
      theme: function () {
        var hex = (document.getElementById('th-hex').textContent || '').trim().toUpperCase(); if (!/^#[0-9A-F]{6}$/.test(hex)) return;
        var cur = S.settings().theme || {};
        if (cur.id === 'custom' && String(cur.color).toUpperCase() === hex) { H.toast(T('Saved')); return; }
        S.setSettings({ theme: { id: 'custom', color: hex } }, 'Colours: the church’s colour is now ' + hex);
        H.applyTheme(H.themeOf(S.settings())); H.render(); H.toast(T('Saved'));
      },
      name: function () {
        var st = S.settings(), n = document.getElementById('st-name').value.trim(), c = document.getElementById('st-country').value, say = [];
        if (!n) { H.toast(T('Give the church a name'), true); return; }
        if (n !== st.churchName) say.push('Renamed the church');
        if (c !== Countries.church(st).code) say.push('Country: ' + Countries.find(c).name);
        if (say.length) S.setSettings({ churchName: n, country: c }, say.join('; '));
        H.render(); H.toast(T('Saved'));
      },
      savewords: function () {
        var set = document.getElementById('wd-set').value, base = Wording.words({ wording: { set: set } }), custom = {}, renamed = [];
        document.querySelectorAll('.wd-1').forEach(function (i) {
          var k = i.dataset.k, one = i.value.trim(), many = (document.querySelector('.wd-2[data-k="' + k + '"]').value || '').trim() || one;
          if (!one) { one = base[k][0]; many = base[k][1]; }
          if (one !== base[k][0] || many !== base[k][1]) { custom[k] = [one, many]; renamed.push(one); }
        });
        S.setSettings({ wording: { set: set, custom: custom } }, 'Terminology (Church Words): ' + Wording.SETS[set].name + (renamed.length ? ' (own words: ' + renamed.join(', ') + ')' : ''));
        H.render(); H.toast(T('Wording saved'));
      },
      addslot: function () {
        var sl = Serving.savedSlots(S.settings()), time = document.getElementById('sl-time').value, label = document.getElementById('sl-label').value.trim(), venue = document.getElementById('sl-venue').value.trim(), day = +document.getElementById('sl-day').value;
        if (!time || !label) { H.toast(T('Give the service a time and a name'), true); return; }
        if (sl.some(function (x) { return !x.removed && x.time === time && (x.day || 0) === day && (x.venue || '').toLowerCase() === venue.toLowerCase(); })) { H.toast(T('That service is already there'), true); return; }
        sl.push({ id: Serving.newSlotId(time, venue, sl), label: label, day: day, time: time, venue: venue });
        S.setSettings({ serviceSlots: sl }, 'Added a regular service: ' + label + (venue ? ' at ' + venue : ''));
        H.render(); H.toast(T('Service added'));
      },
      delslot: function (el) {
        var sl = Serving.savedSlots(S.settings()), x = sl.filter(function (y) { return y.id === el.dataset.id; })[0]; if (!x) return;
        if (!H.confirmBtn(el, '✕?')) return;
        S.setSettings({ serviceSlots: sl.filter(function (y) { return y.id !== x.id; }) }, 'Removed the regular service ' + x.label + (x.venue ? ' at ' + x.venue : '') + ' (rosters already made stay)');
        H.render(); H.toast(T('Removed'));
      },
      addsvc: function () {
        var x = Serving.slots(S.settings()).filter(function (y) { return y.id === document.getElementById('sv-slot').value; })[0]; if (!x) return;
        var day = x.day || 0, time = x.time, name = x.label + (x.venue ? ' · ' + x.venue : '') + ' service', n = +document.getElementById('sv-n').value;
        var d = LeaveCore.parse(H.today()); while (d.getDay() !== day) d = LeaveCore.addDays(d, 1);
        var added = 0;
        for (var i = 0; i < n; i++) {
          var iso = LeaveCore.iso(LeaveCore.addDays(d, i * 7));
          if (!S.find('services', function (s) { return s.date === iso && Serving.slotOf(s) === x.id; }).length) { S.put('services', { date: iso, time: time, name: name, slot: x.id, venue: x.venue || '' }); added++; }
        }
        S.audit('Added ' + added + ' services', 'services'); H.render(); H.toast(TN('{n} service added', '{n} services added', added));
      },
      allsvc: function () { allSvcs = !allSvcs; H.render(); },
      stopsvc: function (el) {
        var id = document.getElementById('sv-stop').value, from = document.getElementById('sv-stop-from').value || H.today();
        var gone = S.find('services', function (s) { return !s.special && Serving.slotOf(s) === id && s.date >= from; });
        if (!gone.length) { H.toast(T('There are none of those from that date'), true); return; }
        H.modal(H.dialogHead(TN('Remove {n} service?', 'Remove {n} services?', gone.length), T('{service} from {date}', { service: Serving.slotLabel(id, S.settings()), date: H.fmt(from, true) })) +
          '<div class="dlg-body"><p>' + T('Their rosters go too, and the people on them are no longer expected. This can’t be undone.') + '</p></div>' +
          '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn danger" data-act="settings:stopsvcgo" data-id="' + esc(id) + '" data-from="' + esc(from) + '">' + TN('Remove {n} service', 'Remove {n} services', gone.length) + '</button></div>', T('Remove services'));
      },
      stopsvcgo: function (el) {
        var id = el.dataset.id, from = el.dataset.from;
        var gone = S.find('services', function (s) { return !s.special && Serving.slotOf(s) === id && s.date >= from; });
        H.closeModal();
        gone.forEach(function (sv) { S.find('assignments', function (x) { return x.serviceId === sv.id; }).forEach(function (x) { S.remove('assignments', x.id); }); S.remove('services', sv.id); });
        S.audit('Stopped ' + Serving.slotLabel(id, S.settings()) + ' services from ' + from + ': removed ' + gone.length + ' (with their rosters)', 'services');
        H.render(); H.toast(TN('{n} service removed', '{n} services removed', gone.length));
      },
      addspecial: function () {
        var g = function (id) { return document.getElementById(id).value.trim(); }, name = g('sp-name'), date = g('sp-date'), time = g('sp-time'), venue = g('sp-venue'), like = g('sp-like');
        if (!name || !date || !time) { H.toast(T('Give the service a name, a date and a time'), true); return; }
        if (date < H.today()) { H.toast(T('Choose a date from today on'), true); return; }
        if (S.find('services', function (s) { return s.date === date && s.time === time && (s.venue || '') === venue; }).length) { H.toast(T('There is already a service then'), true); return; }
        S.put('services', { date: date, time: time, name: name, slot: like, venue: venue, special: true }, 'Added a special service: ' + name + ' on ' + date);
        H.render(); H.toast(T('{name} added – make its roster under Rosters', { name: name }));
      },
      delsvc: function (el) { if (!H.confirmBtn(el, '✕?')) return; S.find('assignments', function (x) { return x.serviceId === el.dataset.id; }).forEach(function (x) { S.remove('assignments', x.id); }); S.remove('services', el.dataset.id, 'Removed a service'); H.render(); }
    }
  });
})();
