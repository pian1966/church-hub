/* Church Hub – People: the list of people (sort, filters) and Church at a glance (Administrators). */
(function (P) {
  'use strict';
  var H = Hub, esc = H.esc, S = Store, T = I18n.t, TN = I18n.tn;
  var TX = function (s) { return s; };   // a text kept in a list, translated where it is shown (the language test checks it)
  var MARITAL = P.MARITAL, SORTS = P.SORTS, state = P.state;
  // From the other People files (each looked up when called)
  function addressLines() { return P.addressLines.apply(this, arguments); }
  function age() { return P.age.apply(this, arguments); }
  function canBasic() { return P.canBasic.apply(this, arguments); }
  function canDup() { return P.canDup.apply(this, arguments); }
  function canSeeAll() { return P.canSeeAll.apply(this, arguments); }
  function catTags() { return P.catTags.apply(this, arguments); }
  function deceased() { return P.deceased.apply(this, arguments); }
  function familyOf() { return P.familyOf.apply(this, arguments); }
  function hasConsent() { return P.hasConsent.apply(this, arguments); }
  function householdNames() { return P.householdNames.apply(this, arguments); }
  function isMe() { return P.isMe.apply(this, arguments); }
  function known() { return P.known.apply(this, arguments); }
  function lateSuggestions() { return P.lateSuggestions.apply(this, arguments); }
  function visiblePeople() { return P.visiblePeople.apply(this, arguments); }

  /* ---------- church at a glance (Administrators): numbers only, no names ---------- */
  var AGE_BANDS = [[0, 5, '0–5'], [6, 12, '6–12'], [13, 17, '13–17'], [18, 29, '18–29'], [30, 44, '30–44'], [45, 59, '45–59'], [60, 74, '60–74'], [75, 200, '75+']];
  function pct(n, of) { return of ? Math.round(n / of * 100) : 0; }
  /** One bar per row: label, bar (length = share of the largest), number and share written out. */
  function bars(title, rows, total, note) {
    var max = Math.max.apply(null, rows.map(function (r) { return r[1]; }).concat([1]));
    title = T(title);
    return '<section class="panel glance"><h3>' + esc(title) + '</h3><div class="sbars" role="table" aria-label="' + esc(title) + '">' + rows.map(function (r) {
      var w = Math.round(r[1] / max * 100), tip = T(r[0]) + ': ' + r[1] + (total ? ' (' + pct(r[1], total) + '%)' : '');
      return '<div class="sbar" role="row" title="' + esc(tip) + '"><span role="cell" class="sbar-l">' + esc(T(r[0])) + '</span><span role="cell" class="sbar-t" aria-hidden="true"><i style="width:' + (r[1] ? Math.max(w, 2) : 0) + '%"></i></span>' +
        '<span role="cell" class="sbar-v">' + r[1] + (total ? ' <small>' + pct(r[1], total) + '%</small>' : '') + '</span></div>';
    }).join('') + '</div>' + (note ? '<p class="hint">' + note + '</p>' : '') + '</section>';
  }
  function renderStats() {
    var t = H.today(), yearAgo = LeaveCore.iso(LeaveCore.addDays(LeaveCore.parse(t), -365)), weeks8 = LeaveCore.iso(LeaveCore.addDays(LeaveCore.parse(t), -56));
    var all = S.find('people', function (p) { return p.firstName !== 'Deleted'; }), act = all.filter(function (p) { return p.active !== false; });
    var adults = act.filter(function (p) { return p.familyRole !== 'child'; }), kids = act.filter(function (p) { return p.familyRole === 'child'; });
    var count = function (list, fn) { return list.filter(fn).length; };
    // families with at least one active person
    var famSize = {}; act.forEach(function (p) { if (p.familyId) famSize[p.familyId] = (famSize[p.familyId] || 0) + 1; });
    var fams = Object.keys(famSize), withKids = fams.filter(function (f) { return kids.some(function (k) { return k.familyId === f; }); }).length;
    var newPeople = count(act, function (p) { return (p.createdAt || '').slice(0, 10) >= yearAgo; });
    var left = count(all, function (p) { return p.active === false && !p.deceasedAt && !p.binnedAt && (p.archivedAt || '') >= yearAgo; }), died = count(all, function (p) { return (p.deceasedAt || '') >= yearAgo; });
    // ages
    var ages = AGE_BANDS.map(function (b) { return [b[2], 0]; }), noAge = 0;
    act.forEach(function (p) { var a = age(p); if (a === '') { noAge++; return; } AGE_BANDS.forEach(function (b, i) { if (a >= b[0] && a <= b[1]) ages[i][1]++; }); });
    var withAge = act.length - noAge;
    // categories, marital status
    var cats = ['Church Partner', 'Attender', 'Visiting Minister', 'Staff'].map(function (c) { return [c, count(act, function (p) { return p.category === c; })]; });
    var mar = MARITAL.map(function (m) { return [m, count(adults, function (p) { return p.maritalStatus === m; })]; }).filter(function (r) { return r[1] || r[0] === 'Married' || r[0] === 'Single'; });
    mar.push([TX('Not recorded'), count(adults, function (p) { return !p.maritalStatus; })]);
    // family sizes
    var sizes = [[TX('1 person'), 0], ['2', 0], ['3', 0], ['4', 0], [TX('5 or more'), 0]];
    fams.forEach(function (f) { var n = famSize[f]; sizes[Math.min(n, 5) - 1][1]++; });
    var single = count(adults, function (p) { return !p.familyId; });
    // consent (POPIA)
    var cons = ['Church records', 'Email', 'SMS', 'Church directory', 'Photos'].map(function (pur) {
      var who = pur === 'Church records' || pur === 'Photos' ? act : adults;
      return [P.purposeName(pur), count(who, function (p) { return hasConsent(p.id, pur); }), who.length];
    });
    // serving
    var onTeam = {}; S.list('skills').forEach(function (k) { onTeam[k.personId] = 1; });
    var served = {}; S.list('assignments').forEach(function (a) { var sv = S.get('services', a.serviceId); if (sv && sv.date >= weeks8 && sv.date <= t && a.status !== 'declined') served[a.personId] = 1; });
    var serving = [[TX('On a serving team'), count(adults, function (p) { return onTeam[p.id]; })], [TX('Served in the last 8 weeks'), count(adults, function (p) { return served[p.id]; })], [TX('Not on a team'), count(adults, function (p) { return !onTeam[p.id]; })]];

    var tile = function (label, n, sub) { return '<div class="stat"><span>' + esc(T(label)) + '</span><b>' + n + '</b>' + (sub ? '<span>' + esc(sub) + '</span>' : '') + '</div>'; };
    return '<details class="glance-wrap" id="pp-stats"' + (state.statsOpen ? ' open' : '') + '><summary><b>' + T('Church at a glance') + '</b> <span class="muted small">' + T('· Administrators only · numbers, no names') + '</span></summary>' +
      '<div class="stats" style="margin-top:12px">' + tile(TX('People'), act.length, TN('{n} adult', '{n} adults', adults.length) + ' · ' + TN('{n} child', '{n} children', kids.length)) + tile(TX('Households'), fams.length, T('{n} with children', { n: withKids })) +
      tile(TX('Added in the last 12 months'), newPeople, '') + tile(TX('Left or died (12 months)'), left + died, T('{n} left', { n: left }) + ' · ' + T('{n} died', { n: died })) + '</div>' +
      '<div class="glance-grid">' +
      bars(TX('Age groups'), ages, withAge, noAge ? TN('{n} person has no birthday recorded and isn’t counted here.', '{n} people have no birthday recorded and aren’t counted here.', noAge) : '') +
      bars(TX('Church partners, attenders, visiting ministers and staff'), cats, act.length) +
      bars(TX('Marital status (adults)'), mar, adults.length) +
      bars(TX('Household size'), sizes, fams.length, single ? TN('{n} adult isn’t in a household.', '{n} adults aren’t in a household.', single) : '') +
      '<section class="panel glance"><h3>' + esc(T('Consent ({law})', { law: PrivacyLaw.forChurch(S.settings()).short })) + '</h3><div class="sbars">' + cons.map(function (c) {
        var w = pct(c[1], c[2]);
        return '<div class="sbar" title="' + esc(T(c[0]) + ': ' + T('{n} of {total}', { n: c[1], total: c[2] }) + ' (' + w + '%)') + '"><span class="sbar-l">' + esc(T(c[0])) + '</span><span class="sbar-t" aria-hidden="true"><i style="width:' + w + '%"></i></span><span class="sbar-v">' + w + '% <small>' + c[1] + '/' + c[2] + '</small></span></div>';
      }).join('') + '</div><p class="hint">' + T('Share of people who agreed. Email, SMS and directory: adults only.') + '</p></section>' +
      bars(TX('Serving (adults)'), serving, adults.length) +
      '</div><p class="hint" style="margin:4px 0 18px">' + T('Active people only. Counts update as records change.') + '</p></details>';
  }

  /** People who died, with the date typed in front of their name ("2024-08-22-Mike Andrew"): the name is tidied and the date
   *  becomes the date they died – unless a different date of death was already recorded on purpose (not just the import day). */
  function tidyDeathDates() {
    var E = window.ElvantoImport, n = 0;
    if (!E || !E.datedName) return 0;
    S.list('people').slice().forEach(function (p) {
      if (!(deceased(p) || p.category === 'Deceased')) return;
      var q = null, date = '';
      ['firstName', 'preferredName', 'lastName'].forEach(function (k) {
        var dn = E.datedName(p[k]); if (!dn || (!dn.name && k === 'firstName' && !p.lastName)) return;
        q = q || JSON.parse(JSON.stringify(p)); q[k] = dn.name; date = date || dn.date;
      });
      if (!q) return;
      if (!q.firstName && q.lastName) { var parts = q.lastName.split(' '); if (parts.length > 1) { q.firstName = parts.shift(); q.lastName = parts.join(' '); } }
      if (!q.deceasedAt || q.deceasedAt === (q.createdAt || '').slice(0, 10) || q.deceasedAt >= date) q.deceasedAt = date;
      S.put('people', q); n++;
    });
    return n;
  }

  /** ID numbers typed into a name ("5710210087085 Thomson"): taken out of the name (and a household's own name) and kept as the
   *  person's ID number, which only Administrators see. Runs once, when an Administrator signs in. */
  function tidyIdNames() {
    var E = window.ElvantoImport, n = 0;
    if (!E || !E.idInName || !H.can('idnumbers')) return 0;
    S.list('people').slice().forEach(function (p) {
      var q = null, id = '';
      ['firstName', 'preferredName', 'lastName'].forEach(function (k) { var m = E.idInName(p[k]); if (m) { q = q || JSON.parse(JSON.stringify(p)); q[k] = m.name; id = id || m.id; } });
      if (!q) return;
      if (!q.firstName && q.preferredName) q.firstName = q.preferredName;
      Store.setIdNumber(p.id, id); S.put('people', q); n++;
    });
    S.list('families').slice().forEach(function (f) { var m = f.custom && E.idInName(f.name); if (m) { f = JSON.parse(JSON.stringify(f)); f.name = m.name; S.put('families', f); } });
    return n;
  }

  function sortKey() { if (!state.sort) state.sort = SORTS[Store.pref('peopleSort')] ? Store.pref('peopleSort') : 'last'; return state.sort; }
  function sortSwitch() {
    return '<div class="row pp-sort"><span class="muted small" id="pp-sort-l">' + T('Sort by') + '</span><div class="seg small" role="group" aria-labelledby="pp-sort-l">' +
      Object.keys(SORTS).map(function (k) { var on = sortKey() === k; return '<button data-act="people:sort" data-k="' + k + '" class="' + (on ? 'on' : '') + '" aria-pressed="' + on + '">' + T(SORTS[k].label) + '</button>'; }).join('') + '</div></div>';
  }
  /** The name as the list is sorted, with the other first name in brackets when they go by a different one. */
  function listName(p) {
    var other = p.preferredName && p.preferredName.toLowerCase() !== (p.firstName || '').toLowerCase(), k = sortKey();
    var main = k === 'first' ? p.firstName + ' ' + p.lastName : k === 'known' ? known(p) + ' ' + p.lastName : p.lastName + ', ' + known(p);
    return esc(main) + (other ? ' <span class="muted">(' + esc(k === 'first' ? p.preferredName : p.firstName) + ')</span>' : '');
  }
  /** Whether a person matches a search query against names, contact and personal information they may share. */
  function matchesPerson(p, q) {
    if (!q) return true;
    var open = P.seeTier() !== 'member' || isMe(p);
    var parts = H.names(p);
    var mob = (open || P.tierSees('mobile')) && P.mayShare(p, 'mobile') ? (p.mobile || '') : '';
    var em = (open || P.tierSees('email')) && P.mayShare(p, 'email') ? (p.email || '') : '';
    var addr = (open || P.tierSees('address')) && P.mayShare(p, 'address') ? (p.shareAddress || (addressLines(p) || []).join(' ')) : '';
    if (em) parts.push(em);
    if (mob) {
      parts.push(mob);
      var digits = mob.replace(/\D/g, '');
      if (digits && digits !== mob) parts.push(digits);
    }
    if (canBasic()) parts = parts.concat(householdNames(p));
    if (addr) parts.push(addr);
    var text = parts.join(' | ');   // a quoted phrase must sit within one part (a name, the address…)
    if (H.matches(text, q)) return true;
    // A phone number typed with its digits only, and "+27 82…" and "082…" finding each other (the church's own country)
    var qDigits = localDigits(q);
    return !!mob && /^[\d\s()+.\-]+$/.test(String(q).trim()) && qDigits.replace(/^0/, '').length >= 3 && localDigits(mob).indexOf(qDigits) >= 0;
  }
  /** A phone number's digits as written at home: "+27 82 555 1234" → "0825551234" for a church in South Africa. */
  function localDigits(s) {
    var raw = String(s || '').trim(), d = raw.replace(/\D/g, ''), intl = raw.charAt(0) === '+' || /^00/.test(d);
    if (/^00/.test(d)) d = d.slice(2);
    var dial = window.Countries ? String(window.Countries.church(S.settings()).dial || '') : '';
    return intl && dial && d.indexOf(dial) === 0 ? '0' + d.slice(dial.length) : d;
  }
  /** Administrators and the Senior Pastor (Rector) can tick people on the list – across several searches – for name badges,
   * an invitation to apply, or (Administrators) one change for all of them. */
  function canPick() { var me = H.user() && S.get('people', H.user().id); return H.can('*') || (H.can('people.edit') && H.isSenior(me)); }
  function pickBar(shown) {
    var sel = state.pick, n = Object.keys(sel).length, allOn = shown.length && shown.every(function (p) { return sel[p.id]; });
    return '<div class="pick-bar" id="pp-pickbar" role="region" aria-label="' + esc(T('Selected people')) + '"><span class="pick-n" id="pp-pickn">' + TN('{n} person selected', '{n} people selected', n) + '</span>' +
      '<div class="btns">' + (shown.length ? '<button class="btn small" data-act="people:pickall">' + (allOn ? T('Untick the {n} shown', { n: shown.length }) : T('Tick the {n} shown', { n: shown.length })) + '</button>' : '') +
      '<button class="btn small" data-act="people:pickclear"' + (n ? '' : ' disabled') + '>' + T('Clear') + '</button>' +
      '<button class="btn small pick-do" data-act="people:pickbadges"' + (n ? '' : ' disabled') + '>' + T('Name badges') + '</button>' +
      (P.invite && window.QR ? '<button class="btn small pick-do" data-act="people:pickinvite"' + (n ? '' : ' disabled') + '>' + T('Invite to apply') + '</button>' : '') +
      (P.canBulk && P.canBulk() ? '<button class="btn small pick-do" data-act="people:pickchange"' + (n ? '' : ' disabled') + '>' + T('Change selected…') + '</button>' : '') +
      '<button class="btn small primary" data-act="people:pickdone">' + T('Done') + '</button></div>' +
      '<p class="hint" style="margin:6px 0 0;flex-basis:100%">' + T('Tap people to tick them. Ticks stay while you search for someone else.') + '</p></div>';
  }
  function renderList() {
    var filters = [['all', 'Everyone'], ['Church Partner', 'Church Partners'], ['Attender', 'Attenders'], ['Visiting Minister', 'Visiting ministers'], ['Staff', 'Staff'], ['child', 'Children']];
    if (canSeeAll()) filters.push(['deceased', 'Deceased']);   // people who have died are kept for the records, out of the other lists
    if (!canBasic()) filters = [['all', T('Directory')]];
    if (!filters.some(function (f) { return f[0] === state.f; })) state.f = 'all';
    if (state.pick && !canPick()) state.pick = null;
    var dead = state.f === 'deceased', q = state.q.trim().toLowerCase(), pick = state.pick;
    var list = dead ? S.find('people', function (p) { return (deceased(p) || p.category === 'Deceased') && !p.mergedInto && !p.binnedAt; }) : visiblePeople();
    var shown = list.filter(function (p) {
      if (!dead && (state.f === 'child' ? p.familyRole !== 'child' : state.f === 'Staff' ? !(p.staff || p.category === 'Staff') : (state.f !== 'all' && p.category !== state.f))) return false;
      return matchesPerson(p, q);
    }).sort(SORTS[sortKey()].cmp);
    return '<div class="page-head"><div><h1>' + T('People') + '</h1><p class="lead">' + (canBasic() ? T('Everyone connected to the church: partners, attenders, visiting ministers, staff and children.') : T('People who agreed to be in the church directory.')) + '</p></div>' +
      '<div class="btns">' + (canSeeAll() ? '<a class="btn" href="#/people/families">' + T('Households') + '</a>' + (canDup() ? '<a class="btn" href="#/people/duplicates">' + T('Find duplicates') + '</a>' : '') + (H.can('*') ? '<a class="btn" href="#/people/late">' + T('Late spouses') + (function (n) { return n ? ' <span class="count">' + n + '</span>' : ''; })(lateSuggestions().length) + '</a>' : '') + P.binLink() + (H.can('*') || H.can('people.edit') ? '<a class="btn" href="#/people/badges">' + T('Name badges') + (function (n) { return n ? ' <span class="count">' + n + '</span>' : ''; })(P.badgesWaiting().length) + '</a><a class="btn" href="#/people/applications">' + T('Partnership applications') + (function (n) { return n ? ' <span class="count">' + n + '</span>' : ''; })(P.appsWaiting().length) + '</a>' : '') + '<button class="btn primary" data-act="people:add">' + H.icon(H.ICON.plus, 18) + T('Add person') + '</button>' : '<a class="btn" href="#/people/p/' + H.user().id + '">' + T('My details') + '</a>') + '</div></div>' +
      (H.can('*') ? renderStats() : '') +
      '<div class="row pp-searchrow" style="margin-bottom:14px"><div class="pp-searchcol"><label class="search">' + H.icon(H.ICON.search, 18) + '<span class="sr">' + T('Search people') + '</span><input id="pp-q" type="search" placeholder="' + T('Search by name, household, email or phone') + '" value="' + esc(state.q) + '"></label>' +
        (canBasic() ? '<a class="adv-link" href="#/people/search">' + T('Advanced search') + '</a>' : '') + '</div>' +
      (filters.length > 1 ? '<div class="seg" role="group" aria-label="' + T('Show') + '">' + filters.map(function (f) { return '<button data-act="people:filter" data-f="' + f[0] + '" class="' + (state.f === f[0] ? 'on' : '') + '" aria-pressed="' + (state.f === f[0]) + '">' + T(f[1]) + '</button>'; }).join('') + '</div>' : '') + '</div>' +
      '<div class="row pp-sortrow"><p class="muted small" id="pp-count">' + TN('{n} person', '{n} people', shown.length) + '</p>' +
        (canPick() && !pick && !dead ? '<button class="btn small" data-act="people:pickstart">' + T('Select people') + '</button>' : '') + sortSwitch() + '</div>' +
      (pick ? (P.bulkUndoNote ? P.bulkUndoNote() : '') + pickBar(shown) : '') +
      (shown.length ? '<div class="list' + (pick ? ' picking' : '') + '" id="pp-list">' + shown.map(function (p) {
        var fam = familyOf(p), tags = '';
        if (p.familyRole === 'child') tags += '<span class="tag" style="--c:#0E7490">' + T('Child') + (age(p) !== '' ? ', ' + age(p) : '') + '</span>';
        else if (dead) tags += '<span class="tag grey">' + esc(p.deceasedAt ? T('Died {date}', { date: H.fmt(p.deceasedAt, true) }) : T('Deceased')) + '</span>';
        else tags += catTags(p);
        if (canSeeAll() && !hasConsent(p.id, 'Church records')) tags += ' <span class="tag bad">' + T('No consent') + '</span>';
        var inner = H.avatar(p) + '<span class="grow"><b>' + listName(p) + '</b><small>' + esc([canBasic() || isMe(p) ? householdNames(p).join(' + ') : '', (P.seeTier() !== 'member' || isMe(p)) && P.mayShare(p, 'mobile') ? p.mobile : ''].filter(Boolean).join(' · ')) + '</small></span>' + (tags ? '<span class="pp-tags">' + tags + '</span>' : '');
        if (pick) return '<label class="item pp-row pick' + (pick[p.id] ? ' on' : '') + '"><input type="checkbox" class="pp-sel" value="' + p.id + '"' + (pick[p.id] ? ' checked' : '') + ' aria-label="' + esc(T('Tick {name}', { name: H.name(p) })) + '">' + inner + '</label>';
        return '<a class="item pp-row" href="#/people/p/' + p.id + '">' + inner + '</a>';
      }).join('') + '</div>' : '<p class="empty">' + T('No one matches. Try another name, or clear the search.') + '</p>');
  }


  Object.assign(P.actions, {
    filter: function (el) { state.f = el.dataset.f; H.render(); },
    pickstart: function () { if (canPick()) { state.pick = {}; H.render(); } },
    pickdone: function () { state.pick = null; H.render(); },
    pickclear: function () { if (state.pick) { state.pick = {}; H.render(); } },
    pickall: function () {
      var sel = state.pick; if (!sel) return;
      var boxes = [].slice.call(document.querySelectorAll('.pp-sel')), on = !boxes.every(function (b) { return b.checked; });
      boxes.forEach(function (b) { if (on) sel[b.value] = 1; else delete sel[b.value]; });
      H.render();
    },
    pickbadges: function () {
      var list = picked(); if (!list.length) return;
      list.sort(SORTS.first.cmp);
      P.printBadges(list, 'Printed name badges from the People list');
    },
    pickinvite: function () { var list = picked(); if (list.length && P.invite) P.invite(list.map(function (p) { return p.id; })); },
    pickchange: function () { var list = picked(); if (list.length && P.canBulk && P.canBulk()) P.bulkDialog(list.map(function (p) { return p.id; })); },
    sort: function (el) { state.sort = el.dataset.k; Store.pref('peopleSort', state.sort); if (state.adv) { state.adv.sort = 'name'; state.adv.dir = 1; } H.render(); }
  });

  /** The people ticked on the list (still at the church or not – whoever was ticked). */
  function picked() { return Object.keys(state.pick || {}).map(function (id) { return S.get('people', id); }).filter(Boolean); }
  /** A tick on the list: keep it, and update the count and buttons without redrawing (the search box keeps its place). */
  function pickChanged(box) {
    var sel = state.pick; if (!sel) return;
    if (box.checked) sel[box.value] = 1; else delete sel[box.value];
    box.closest('.pp-row').classList.toggle('on', box.checked);
    var n = Object.keys(sel).length, c = document.getElementById('pp-pickn');
    if (c) c.textContent = TN('{n} person selected', '{n} people selected', n);
    document.querySelectorAll('#pp-pickbar .pick-do, [data-act="people:pickclear"]').forEach(function (b) { b.disabled = !n; });
    var boxes = [].slice.call(document.querySelectorAll('.pp-sel')), all = document.querySelector('[data-act="people:pickall"]');
    if (all) all.textContent = boxes.every(function (b) { return b.checked; }) ? T('Untick the {n} shown', { n: boxes.length }) : T('Tick the {n} shown', { n: boxes.length });
  }
  Object.assign(P, { pickChanged: pickChanged, canPick: canPick, AGE_BANDS: AGE_BANDS, bars: bars, listName: listName, matchesPerson: matchesPerson, pct: pct, renderList: renderList, renderStats: renderStats, sortKey: sortKey, sortSwitch: sortSwitch, tidyDeathDates: tidyDeathDates, tidyIdNames: tidyIdNames });
})(PeopleParts);
