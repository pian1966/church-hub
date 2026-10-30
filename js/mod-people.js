/* Church Hub – People: directory, families, profiles, consent (POPIA), restricted notes. */
(function () {
  'use strict';
  var H = Hub, esc = H.esc, S = Store, T = I18n.t, TN = I18n.tn;
  var TX = function (s) { return s; };   // a text kept in a list, translated where it is shown (the language test checks it)
  TX('Died'); TX('Funeral'); TX('Baptised'); TX('Confirmed'); TX('First visit');   // key dates Church Hub writes or Elvanto often has, shown translated
  var PURPOSES = [TX('Church records'), TX('Email'), TX('SMS'), TX('Church directory'), TX('Care group'), TX('Photos'), TX('Children’s medical notes')];
  var CATS = [TX('Church Partner'), TX('Attender'), TX('Visiting Minister'), TX('Staff'), TX('Former member'), TX('Deceased')];
  var HS = Households;
  function canChildren() { return H.can('*') || H.can('children'); }       // Administrators, Pastors, Children's ministry
  function links(childId) { return HS.linksOf(childId, S.list('guardians')); }
  function linkName(l) { var a = l.adultId ? S.get('people', l.adultId) : null; return a ? H.name(a) : (l.name || T('Someone')); }
  var GENDERS = [TX('Female'), TX('Male')];
  // What someone would like to receive, kept in the consent register (POPIA: when and how they chose it). Adults only.
  var RECEIVE = [
    [TX('Weekly Church Notices (via Email)'), TX('The weekly notices by email.')],
    [TX('Special things or people to pray for (via WhatsApp)'), TX('Prayer needs, sent on WhatsApp.')],
    [TX('Special things or people to pray for (via Email)'), TX('Prayer needs, sent by email.')],
    [TX('Missionary updates (via WhatsApp)'), TX('News from the church’s missionaries, on WhatsApp.')],
    [TX('Missionary updates (via Email)'), TX('News from the church’s missionaries, by email.')],
    [TX('“Who is Jesus” (via WhatsApp)'), TX('A two minute WhatsApp message from Richard Sturdee, focussing on the person and work of our Lord Jesus Christ.')]
  ];
  var RECEIVE_P = RECEIVE.map(function (r) { return r[0]; });
  var MARITAL = [TX('Single'), TX('Engaged'), TX('Married'), TX('Partner'), TX('Separated'), TX('Divorced'), TX('Widowed'), TX('Not known')];
  var CARE_WEEKS = 8;                         // pastors see "care for the family" on their to-do list this long after a death
  function canRecordDeath() { return H.can('*') || H.can('people.edit'); }
  function deceased(p) { return !!(p && p.deceasedAt); }
  var state = { q: '', f: 'all', audited: '', statsOpen: false, fq: '', ncAudited: '', adv: null };
  state.adv = emptyAdv();

  function canSeeAll() { return H.can('people.view') || H.can('*'); }
  function canBasic() { return canSeeAll() || H.can('people.basic'); }
  function isMe(p) { var u = H.user(); return u && p && u.id === p.id; }
  function consentFor(pid, purpose) {
    return S.find('consents', function (c) { return c.personId === pid && c.purpose === purpose && !c.withdrawnAt; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; })[0];
  }
  function hasConsent(pid, purpose) { var c = consentFor(pid, purpose); return !!(c && c.given); }
  function familyOf(p) { return p && p.familyId ? S.get('families', p.familyId) : null; }
  /** The category, plus "Staff" when they work for the church – a Church Partner can be on the staff too. */
  /** A home address as lines to show ("1 Main Road", "Howick 3290", "KwaZulu-Natal"); the church's own country isn't repeated. */
  function addressLines(p) {
    var a = p && p.address; if (!a) return [];
    var c = a.country && Countries.find(a.country), home = Countries.church(S.settings());
    return [a.street, a.street2, [a.city, a.postcode].filter(Boolean).join(' '), a.province, a.country && !(c && c.code === home.code) ? a.country : ''].filter(function (x) { return x && String(x).trim(); });
  }
  /* ---------- addresses in any country: the country decides the list of provinces, states or counties (js/countries.js) ---------- */
  function countrySelect(cur) {   // cur: the address's country as recorded ('' = the church's)
    var home = Countries.church(S.settings()), c = cur ? Countries.find(cur) : home, other = cur && !c;
    return '<select id="pf-country" autocomplete="country-name">' + Countries.grouped().map(function (g) {
      return '<optgroup label="' + esc(T(g.continent)) + '">' + g.countries.map(function (x) { return '<option value="' + esc(x.name) + '"' + (c && c.code === x.code ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</optgroup>';
    }).join('') + (other ? '<option value="' + esc(cur) + '" selected>' + esc(cur) + '</option>' : '') + '<option value="__other">' + T('Another country…') + '</option></select>' +
      '<input id="pf-country-o" placeholder="' + T('Type the country') + '" hidden>';
  }
  function regionControl(c, cur) {   // a list when the country has one (anything else already recorded is kept), otherwise a box to type in
    if (!c || !c.regions) return '<input id="pf-province" value="' + esc(cur || '') + '" autocomplete="address-level1">';
    return '<select id="pf-province" autocomplete="address-level1"><option value="">' + T('Choose…') + '</option>' + c.regions.map(function (x) { return '<option' + (x === cur ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') +
      (cur && c.regions.indexOf(cur) < 0 ? '<option value="' + esc(cur) + '" selected>' + esc(cur) + '</option>' : '') + '</select>';
  }
  function wireCountry() {
    var sel = document.getElementById('pf-country'); if (!sel) return;
    sel.addEventListener('change', function () {
      var o = document.getElementById('pf-country-o'), other = sel.value === '__other', c = other ? null : Countries.find(sel.value);
      o.hidden = !other; if (other) o.focus();
      document.getElementById('pf-region-l').textContent = T(c ? c.regionLabel : 'Province, state or region');
      document.getElementById('pf-postcode-l').textContent = T(c ? c.postcodeLabel : 'Postal code');
      var w = document.getElementById('pf-region-w'), was = document.getElementById('pf-province').value;
      var v = c ? Countries.region(was, c.code) : '';   // keep it only if the new country has it (e.g. typed "KZN" earlier)
      w.innerHTML = regionControl(c, c && c.regions && c.regions.indexOf(v) >= 0 ? v : '');
    });
  }
  function catTags(p) {
    var t = '<span class="tag grey">' + esc(T(p.category || '')) + '</span>', care = window.CareUI ? CareUI.tag(p) : '';
    if (!p.staff) return t + care;
    return (p.category === 'Staff' ? '<span class="tag grey">' + esc(p.staff.category || T('Staff')) + '</span>' : t + ' <span class="tag grey">' + esc(T('Staff') + (p.staff.category ? ' · ' + p.staff.category : '')) + '</span>') + care;
  }
  /** Someone who died while married to this person: recorded when the death was recorded, or (for older records) the one
   *  person who has died in their household when they are widowed. */
  function lateSpouse(p) {
    if (!p || p.familyRole === 'child') return null;
    if (p.lateSpouseId) return S.get('people', p.lateSpouseId);
    if (p.lateSpouseSet) return null;   // an Administrator chose "nobody" or someone not in Church Hub
    if (p.maritalStatus !== 'Widowed' || deceased(p)) return null;
    var dead = S.find('people', function (x) { return x.id !== p.id && x.familyRole !== 'child' && (deceased(x) || x.category === 'Deceased') && !x.mergedInto && HS.householdsOf(p).some(function (h) { return HS.inHousehold(x, h); }); });
    return dead.length === 1 ? dead[0] : null;
  }
  function survivingSpouses(p) { return deceased(p) || p.category === 'Deceased' ? S.find('people', function (x) { var l = x.id !== p.id && x.id !== p.lateSpouseId && !x.mergedInto && lateSpouse(x); return l && l.id === p.id; }) : []; }
  function members(fid) { return S.find('people', function (p) { return HS.inHousehold(p, fid) && p.active !== false; }); }
  function householdNames(p) { return HS.householdsOf(p).map(function (h) { return H.familyName(S.get('families', h)); }).filter(Boolean); }
  /** Whole years from a yyyy-mm-dd date to today ('' if no date or in the future). */
  function yearsSince(d) { if (!d || !/^\d{4}-\d\d-\d\d/.test(d)) return ''; var b = LeaveCore.parse(d.slice(0, 10)), t = new Date(); var a = t.getFullYear() - b.getFullYear(); if (t < new Date(t.getFullYear(), b.getMonth(), b.getDate())) a--; return a < 0 ? '' : a; }
  var WEDDING = /wedding|anniversary|married/i;
  function age(p) { if (!p.birthDate) return ''; var b = LeaveCore.parse(p.birthDate), t = new Date(); var a = t.getFullYear() - b.getFullYear(); if (t < new Date(t.getFullYear(), b.getMonth(), b.getDate())) a--; return a; }

  /** Who may this user see in the directory? Members only see people who agreed to be in the church directory. */
  function visiblePeople() {
    var all = S.find('people', function (p) { return p.active !== false; });
    if (canBasic()) return H.can('children') || canSeeAll() ? all : all.filter(function (p) { return p.familyRole !== 'child'; });
    return all.filter(function (p) { return isMe(p) || (p.familyRole !== 'child' && (p.inDirectory || hasConsent(p.id, 'Church directory'))); });
  }

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
    var left = count(all, function (p) { return p.active === false && !p.deceasedAt && (p.archivedAt || '') >= yearAgo; }), died = count(all, function (p) { return (p.deceasedAt || '') >= yearAgo; });
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
      return [pur, count(who, function (p) { return hasConsent(p.id, pur); }), who.length];
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
    if (!E || !E.idInName || !H.can('*')) return 0;
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

  /* ---------- list ---------- */
  // How the list is ordered: by first name, by the name they're known as, or by surname. Remembered on this device.
  function cmp(x, y) { return String(x || '').localeCompare(String(y || ''), undefined, { sensitivity: 'base' }); }
  function known(p) { return p.preferredName || p.firstName; }
  var SORTS = {
    first: { label: 'First name', cmp: function (a, b) { return cmp(a.firstName, b.firstName) || cmp(a.lastName, b.lastName); } },
    known: { label: 'Known as', cmp: function (a, b) { return cmp(known(a), known(b)) || cmp(a.lastName, b.lastName); } },
    last: { label: 'Surname', cmp: function (a, b) { return cmp(a.lastName, b.lastName) || cmp(known(a), known(b)) || cmp(a.firstName, b.firstName); } }
  };
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
  function renderList() {
    var filters = [['all', 'Everyone'], ['Church Partner', 'Church Partners'], ['Attender', 'Attenders'], ['Visiting Minister', 'Visiting ministers'], ['Staff', 'Staff'], ['child', 'Children']];
    if (canSeeAll()) filters.push(['deceased', 'Deceased']);   // people who have died are kept for the records, out of the other lists
    if (!canBasic()) filters = [['all', T('Directory')]];
    if (!filters.some(function (f) { return f[0] === state.f; })) state.f = 'all';
    var dead = state.f === 'deceased', q = state.q.trim().toLowerCase();
    var list = dead ? S.find('people', function (p) { return (deceased(p) || p.category === 'Deceased') && !p.mergedInto; }) : visiblePeople();
    var shown = list.filter(function (p) {
      if (!dead && (state.f === 'child' ? p.familyRole !== 'child' : state.f === 'Staff' ? !(p.staff || p.category === 'Staff') : (state.f !== 'all' && p.category !== state.f))) return false;
      return !q || H.matches(H.names(p).join(' | ') + ' ' + p.email + ' ' + (p.mobile || '') + ' ' + (canBasic() ? householdNames(p).join(' ') : ''), q);   // name, contact or family; "andr pi" finds Andrew Pike
    }).sort(SORTS[sortKey()].cmp);
    return '<div class="page-head"><div><h1>' + T('People') + '</h1><p class="lead">' + (canBasic() ? T('Everyone connected to the church: partners, attenders, visiting ministers, staff and children.') : T('People who agreed to be in the church directory.')) + '</p></div>' +
      '<div class="btns">' + (canSeeAll() ? '<a class="btn" href="#/people/families">' + T('Households') + '</a>' + (canDup() ? '<a class="btn" href="#/people/duplicates">' + T('Find duplicates') + '</a>' : '') + (H.can('*') ? '<a class="btn" href="#/people/late">' + T('Late spouses') + (function (n) { return n ? ' <span class="count">' + n + '</span>' : ''; })(lateSuggestions().length) + '</a>' : '') + '<button class="btn primary" data-act="people:add">' + H.icon(H.ICON.plus, 18) + T('Add person') + '</button>' : '<a class="btn" href="#/people/p/' + H.user().id + '">' + T('My details') + '</a>') + '</div></div>' +
      (H.can('*') ? renderStats() : '') +
      '<div class="row pp-searchrow" style="margin-bottom:14px"><div class="pp-searchcol"><label class="search">' + H.icon(H.ICON.search, 18) + '<span class="sr">' + T('Search people') + '</span><input id="pp-q" type="search" placeholder="' + T('Search by name, household, email or phone') + '" value="' + esc(state.q) + '"></label>' +
        (canBasic() ? '<a class="adv-link" href="#/people/search">' + T('Advanced search') + '</a>' : '') + '</div>' +
      (filters.length > 1 ? '<div class="seg" role="group" aria-label="' + T('Show') + '">' + filters.map(function (f) { return '<button data-act="people:filter" data-f="' + f[0] + '" class="' + (state.f === f[0] ? 'on' : '') + '" aria-pressed="' + (state.f === f[0]) + '">' + T(f[1]) + '</button>'; }).join('') + '</div>' : '') + '</div>' +
      '<div class="row pp-sortrow"><p class="muted small" id="pp-count">' + TN('{n} person', '{n} people', shown.length) + '</p>' +
        sortSwitch() + '</div>' +
      (shown.length ? '<div class="list">' + shown.map(function (p) {
        var fam = familyOf(p), tags = '';
        if (p.familyRole === 'child') tags += '<span class="tag" style="--c:#0E7490">' + T('Child') + (age(p) !== '' ? ', ' + age(p) : '') + '</span>';
        else if (dead) tags += '<span class="tag grey">' + esc(p.deceasedAt ? T('Died {date}', { date: H.fmt(p.deceasedAt, true) }) : T('Deceased')) + '</span>';
        else tags += catTags(p);
        if (canSeeAll() && !hasConsent(p.id, 'Church records')) tags += ' <span class="tag bad">' + T('No consent') + '</span>';
        return '<a class="item" href="#/people/p/' + p.id + '">' + H.avatar(p) + '<span class="grow"><b>' + listName(p) + '</b><small>' + esc([canBasic() || isMe(p) ? householdNames(p).join(' + ') : '', canBasic() || isMe(p) ? p.mobile : ''].filter(Boolean).join(' · ')) + '</small></span>' + tags + '</a>';
      }).join('') + '</div>' : '<p class="empty">' + T('No one matches. Try another name, or clear the search.') + '</p>');
  }

  /* ---------- couples: spouses and partners, worked out from each household (rules in js/households.js) ---------- */
  // Marital status and anniversaries are private details: only Administrators and Pastors see and change them.
  function canCouples() { return canSeeAll() && (H.can('*') || H.can('people.edit')); }
  function allCouples() { return canCouples() ? HS.couples(S.list('people'), S.list('families')) : []; }
  function couplesToCheck() { return canCouples() ? HS.couplesToCheck(S.list('people'), S.list('families')) : []; }
  function coupleOf(pid) { return allCouples().filter(function (c) { return c.a === pid || c.b === pid; })[0] || null; }
  function first(id) { var q = S.get('people', id); return q ? (q.preferredName || q.firstName) : ''; }
  /** What a couple needs, in words, and the button that does it. */
  function coupleTodo(c) {
    var lines = [], did = [];
    if (c.copy) { lines.push(esc(T('Wedding anniversary of {a}: {date}. {b} has none recorded.', { a: first(c.copy.from), date: H.fmt(c.copy.date, true), b: first(c.copy.to) }))); did.push(T('add {date} as the anniversary of {name}', { date: H.fmt(c.copy.date, true), name: first(c.copy.to) })); }
    if (c.mark) { lines.push(esc(T('The marital status of {name} isn’t recorded.', { name: first(c.mark.id) }))); did.push(T(c.mark.status === 'Married' ? 'mark {name} as married' : 'mark {name} as a partner', { name: first(c.mark.id) })); }
    if (c.differ) lines.push(esc(T('Their wedding anniversaries differ: {a} and {b}. Open each person to correct the wrong one.', { a: H.fmt(wedOf(c.a), true), b: H.fmt(wedOf(c.b), true) })));
    var who = []; if (c.copy) who.push(first(c.copy.to)); if (c.mark && who.indexOf(first(c.mark.id)) < 0) who.push(first(c.mark.id));
    var label = did.length ? T(c.kind === 'spouse' ? 'Yes, married: update {names}' : 'Yes, partners: update {names}', { names: who.join(' & ') }) : T(c.kind === 'spouse' ? 'Yes, married to each other' : 'Yes, partners');
    var fix = did.length || !c.confirmed ? '<button class="btn small primary" style="white-space:normal" data-act="people:couplefix" data-a="' + c.a + '" data-b="' + c.b + '"' + (did.length ? ' title="' + esc(did.join('; ')) + '"' : '') + '>' + esc(label) + '</button>' : '';
    return { lines: lines, fix: fix };
  }
  function wedOf(id) { var q = S.get('people', id); return q ? keyDate(q, WEDDING) : ''; }
  function coupleWord(c) { return T(c.confirmed ? (c.kind === 'spouse' ? 'Married (confirmed)' : 'Partners (confirmed)') : c.kind === 'spouse' ? (c.sure ? 'Looks married to each other' : 'Probably married to each other') : (c.sure ? 'Look like partners' : 'Probably partners')); }

  /** Person page: "Spouse" or "Partner", going by their household, with any suggested change for this person. */
  function coupleLine(p) {
    var c = coupleOf(p.id); if (!c) return '';
    var o = S.get('people', c.a === p.id ? c.b : c.a), t = coupleTodo(c), mine = (c.copy && c.copy.to === p.id) || (c.mark && c.mark.id === p.id) || c.differ;
    if (!mine) t.lines = [];
    return '<dt>' + T(c.kind === 'spouse' ? 'Spouse' : 'Partner') + '</dt><dd><a href="#/people/p/' + o.id + '">' + esc(H.name(o)) + '</a>' +
      (c.confirmed ? '' : '<span class="kv-sub">' + T(c.sure ? 'Going by their household – not confirmed yet' : 'Probably – going by their household') + '</span>') +
      (mine || !c.confirmed ? '<span class="kv-sub">' + t.lines.join(' ') + '</span>' + (t.fix ? '<span style="display:block;margin-top:6px">' + t.fix + '</span>' : '') : '') + '</dd>';
  }

  /* ---------- photos: Administrators and Pastors for anyone, Children's ministry for children, adults their own ---------- */
  function canPhoto(p) {
    if (!p || p.mergedInto) return false;
    if (H.can('*') || H.can('people.edit')) return true;
    return p.familyRole === 'child' ? H.can('medical') : isMe(p);
  }
  /** Administrators: go straight to a staff member's leave, or set it up if they're marked Staff but not yet in Leave. */
  function leaveButton(p) {
    var leaveOn = ((S.settings() || {}).modules || {}).leave !== false;
    if (!H.can('*') || !leaveOn || deceased(p) || p.active === false) return '';
    if (p.staff) return '<a class="btn" href="#/leave/staff/' + p.id + '">' + T('Leave') + '</a>';
    if (p.category === 'Staff') return '<button class="btn" data-act="people:edit" data-id="' + p.id + '" data-focus="pf-staff">' + T('Set up leave') + '</button>';
    return '';
  }

  /* ---------- profile ---------- */
  function renderPerson(id) {
    var p = S.get('people', id), me = isMe(p);
    if (!p || (!canBasic() && !me && visiblePeople().indexOf(p) < 0)) return '<a class="crumb" href="#/people">' + H.icon(H.ICON.back, 16) + T('People') + '</a><p class="empty">' + T('This person isn’t available to you.') + '</p>';
    var full = canSeeAll() || me, fam = familyOf(p), child = p.familyRole === 'child';
    var seeMedical = child && H.can('medical');     // Children's ministry only (POPIA: special personal information)
    var seeNotes = H.can('notes');                   // Pastors only
    if (state.audited !== id && (seeMedical && p.medical || seeNotes)) {     // POPIA: log who viewed restricted information
      state.audited = id;
      if (seeNotes) S.audit('Viewed pastoral notes of ' + H.name(p), 'people/' + id);
      if (seeMedical && p.medical) S.audit('Viewed children’s medical notes of ' + H.name(p), 'people/' + id);
    }
    var tags = catTags(p) + (child ? ' <span class="tag" style="--c:#0E7490">' + T('Child') + (age(p) !== '' ? ', ' + age(p) : '') + '</span>' : '') +
      (p.source === 'elvanto' ? ' <span class="tag" style="--c:#7C3AED">' + T('From Elvanto') + '</span>' : '') +
      (deceased(p) ? ' <span class="tag grey">' + esc(T('Died {date}', { date: H.fmt(p.deceasedAt, true) })) + '</span>' : '');
    var html = '<a class="crumb" href="#/people">' + H.icon(H.ICON.back, 16) + T('People') + '</a>' +
      '<div class="page-head"><div class="row">' + H.avatar(p, p.photo ? 96 : 64) + '<div><h1>' + esc(H.name(p)) + '</h1><div class="row" style="margin-top:6px">' + tags + '</div></div></div>' +
      '<div class="btns">' + (full || H.can('people.edit') ? '<button class="btn" data-act="people:edit" data-id="' + p.id + '">' + T('Edit details') + '</button>' : '') +
      (canPhoto(p) ? '<button class="btn" data-act="people:photo" data-id="' + p.id + '">' + H.icon(H.ICON.plus, 18) + T(p.photo ? 'Change photo' : 'Add photo') + '</button>' +
        (p.photo ? '<button class="btn" data-act="people:nophoto" data-id="' + p.id + '">' + T('Remove photo') + '</button>' : '') +
        '<input type="file" id="pp-photo" data-id="' + p.id + '" accept="image/*" hidden>' : '') +
      leaveButton(p) +
      (H.can('*') ? '<button class="btn" data-act="people:export" data-id="' + p.id + '">' + H.icon(H.ICON.download, 18) + T('Export their data') + '</button>' : '') +
      (canRecordDeath() && !deceased(p) && !me ? '<button class="btn" data-act="people:death" data-id="' + p.id + '">' + T('Record a death') + '</button>' : '') + '</div></div>';
    if (p.mergedInto && S.get('people', p.mergedInto)) html += '<div class="note info" style="margin-bottom:16px">' + T('This was a duplicate record. It was merged into {link} and is kept only for the church’s records.', { link: '<a href="#/people/p/' + p.mergedInto + '">' + esc(H.name(S.get('people', p.mergedInto))) + '</a>' }) + '</div>';
    if (deceased(p) && canRecordDeath()) {
      html += '<div class="note info" style="margin-bottom:16px"><b>' + esc(T('{name} died on {date}.', { name: p.firstName, date: H.fmt(p.deceasedAt, true) })) + '</b> ' + T(!needsTidy(p) ? 'They are no longer on rosters or teams, in the directory or able to sign in, and won’t receive messages.' : 'They are out of the directory and won’t receive messages.') +
        (!needsTidy(p) ? '' : H.can('*') ? ' <button class="btn small" data-act="people:tidydeath" data-id="' + p.id + '">' + T('Finish: take off rosters, teams, leave and sign-in') + '</button>' : ' ' + T('The church office will finish taking them off rosters and sign-in.')) +
        ' <button class="link" data-act="people:undodeath" data-id="' + p.id + '">' + T('Recorded by mistake?') + '</button></div>';
    }

    html += '<div class="grid2">';
    // Contact (left out when there's nothing this person may see, e.g. a young child for Children's ministry)
    var contact = '<section class="panel"><h2>' + T('Contact and details') + '</h2><dl class="kv">' +
      (p.preferredName ? '<dt>' + T('Known as') + '</dt><dd>' + esc(p.preferredName) + '</dd>' : '') +
      (full && p.middleName ? '<dt>' + T('Middle name') + '</dt><dd>' + esc(p.middleName) + '</dd>' : '') +
      (full && addressLines(p).length ? '<dt>' + T('Home address') + '</dt><dd>' + addressLines(p).map(esc).join('<br>') + '</dd>' : '') +
      (!child ? '<dt>' + T('Email') + '</dt><dd>' + (p.email ? '<a href="mailto:' + esc(p.email) + '" target="_blank" rel="noopener">' + esc(p.email) + '</a>' : '<span class="muted">' + (p.emailUnknown ? T('Unknown') : '—') + '</span>') + '</dd>' +
        '<dt>' + T('Mobile') + '</dt><dd>' + (p.mobile ? '<a href="tel:' + esc(p.mobile.replace(/\s/g, '')) + '">' + esc(p.mobile) + '</a>' : '<span class="muted">' + (p.mobileUnknown ? T('Unknown') : '—') + '</span>') + '</dd>' : '') +
      ((full || (child && canChildren())) && p.birthDate ? '<dt>' + T('Birthday') + '</dt><dd>' + esc(H.fmt(p.birthDate, true)) + (age(p) !== '' && !deceased(p) ? '<span class="kv-sub">' + esc(T('Age {n}', { n: age(p) })) + '</span>' : '') + '</dd>' : '') +
      (full && !p.birthDate && p.birthDay ? '<dt>' + T('Birthday') + '</dt><dd>' + esc(+p.birthDay.slice(3) + ' ' + H.mon()[+p.birthDay.slice(0, 2) - 1]) + ' <span class="muted small">' + T('(year not known)') + '</span></dd>' : '') +
      ((full || (child && canChildren())) ? '<dt>' + T('Gender') + '</dt><dd>' + (p.gender ? esc(T(p.gender)) : '<span class="muted">' + T('Not recorded') + '</span>') + '</dd>' : '') +
      (full && (p.category === 'Church Partner' || p.partnerSince || p.partnerUpdated) ? '<dt>' + T('Church Partner') + '</dt><dd>' +
        (p.partnerSince ? esc(T('Accepted {date}', { date: H.fmt(p.partnerSince, true) })) : '<span class="muted">' + T('Date accepted not recorded') + '</span>') +
        (p.partnerUpdated ? '<span class="kv-sub">' + esc(T('Partnership last updated {date}', { date: /^\d{4}$/.test(p.partnerUpdated) ? p.partnerUpdated : H.fmt(p.partnerUpdated, true) })) + '</span>' : '') + '</dd>' : '') +
      (full && !child ? '<dt>' + T('Marital status') + '</dt><dd>' + (p.maritalStatus ? esc(T(p.maritalStatus)) : '<span class="muted">' + T('Not recorded') + '</span>') + '</dd>' : '') +
      (!child ? coupleLine(p) : '') +
      (!child && lateSpouse(p) ? '<dt>' + T('Late spouse') + '</dt><dd>' + T('Was married to {name}', { name: '<a href="#/people/p/' + lateSpouse(p).id + '">' + esc(H.name(lateSpouse(p))) + '</a>' }) +
        (lateSpouse(p).deceasedAt ? '<span class="kv-sub">' + esc(T('Died {date}', { date: H.fmt(lateSpouse(p).deceasedAt, true) })) + '</span>' : '') + '</dd>' :
        !child && p.lateSpouseName ? '<dt>' + T('Late spouse') + '</dt><dd>' + esc(T('Was married to {name}', { name: p.lateSpouseName })) + '</dd>' : '') +
      (H.can('*') || me ? '<dt>' + T('ID number') + '</dt><dd id="pp-idn"><button class="link" data-act="people:showid" data-id="' + p.id + '">' + T('Show') + '</button>' +
        (H.can('*') ? ' · <button class="link" data-act="people:editid" data-id="' + p.id + '">' + T('Change') + '</button>' : '') + '<span class="kv-sub">' + (me && !H.can('*') ? T('Only you and the church Administrators can see it.') : T('Administrators only · views are logged')) + '</span></dd>' : '') +
      (!child && survivingSpouses(p).length ? '<dt>' + T('Spouse') + '</dt><dd>' + survivingSpouses(p).map(function (s) { return T('Was married to {name}', { name: '<a href="#/people/p/' + s.id + '">' + esc(H.name(s)) + '</a>' }); }).join('<br>') + '</dd>' : '') +
      // Wedding anniversary straight after marital status: the date, or "Not recorded" with an Add link, for anyone ever married
      (full && !child && !keyDate(p, WEDDING) && /^(Married|Separated|Divorced|Widowed)$/.test(p.maritalStatus || '') ? '<dt>' + T('Wedding anniversary') + '</dt><dd><span class="muted">' + T('Not recorded') + '</span>' +
        ((!me || H.can('*')) && (full || H.can('people.edit')) ? ' · <button class="link" data-act="people:edit" data-id="' + p.id + '" data-focus="pf-wed">' + T('Add') + '</button>' : '') + '</dd>' : '') +
      (full ? (p.keyDates || []).slice().sort(function (a, b) { return WEDDING.test(b.label || '') - WEDDING.test(a.label || ''); }).map(function (k) {
        if (!WEDDING.test(k.label || '')) return '<dt>' + esc(T(k.label)) + '</dt><dd>' + esc(H.fmt(k.date, true)) + '</dd>';
        var n = yearsSince(k.date);     // years married: only while still married (not after a death or divorce)
        return '<dt>' + T('Wedding anniversary') + '</dt><dd>' + esc(H.fmt(k.date, true)) + (n !== '' && n > 0 && p.maritalStatus === 'Married' && !deceased(p) ? '<span class="kv-sub">' + esc(TN('Married {n} year', 'Married {n} years', n)) + '</span>' : '') + '</dd>';
      }).join('') : '') +
      (p.staff && full ? '<dt>' + T('Staff') + '</dt><dd>' + esc(p.staff.category) + (p.staff.start ? ', ' + esc(T('since {date}', { date: H.fmt(p.staff.start, true) })) : '') + ' · <a href="#/leave' + (H.can('*') ? '/staff/' + p.id : '') + '">' + T('Leave') + '</a></dd>' : '') +
      (H.can('*') ? '<dt>' + T('App access') + '</dt><dd>' + esc((H.ROLES[p.appRole] || H.ROLES.member).label) + '</dd>' : '') +
      '</dl></section>';
    if (/<dt>/.test(contact)) html += contact;
    // Households (where they live) – a child can live in more than one
    var hs = HS.householdsOf(p), canEditHomes = H.can('*') || H.can('people.edit');
    if ((canBasic() || me) && (hs.length || canEditHomes)) {
      html += '<section class="panel"><h2>' + (hs.length > 1 ? T('Lives in {n} households', { n: hs.length }) : T('Household')) + '</h2>' + hs.map(function (hid, i) {
        var f = S.get('families', hid); if (!f) return '';
        return '<div style="margin-top:' + (i ? 14 : 0) + 'px"><div class="row"><b class="grow">' + esc(H.familyName(f)) + (i === 0 && hs.length > 1 ? ' <span class="muted small">' + T('(main)') + '</span>' : '') + '</b>' +
          (i > 0 && canEditHomes ? '<button class="btn small" data-act="people:unhome" data-id="' + p.id + '" data-f="' + hid + '">' + T('Remove') + '</button>' : '') + '</div><div class="list" style="margin-top:6px">' +
          members(hid).filter(function (m) { return m.id !== p.id; }).map(function (m) {
            return '<a class="item" href="#/people/p/' + m.id + '">' + H.avatar(m, 32) + '<span class="grow"><b>' + esc(H.name(m)) + '</b><small>' + (m.familyRole === 'child' ? T('Child') + (age(m) !== '' ? ', ' + age(m) : '') : T('Adult')) + '</small></span></a>';
          }).join('') + '</div></div>';
      }).join('') + (!hs.length ? '<p class="muted" style="margin-top:0">' + T('Not in a household yet – choose one under Edit details.') + '</p>' : '') +
        (canEditHomes && hs.length ? '<div class="btns" style="margin-top:10px"><button class="btn small" data-act="people:addhome" data-id="' + p.id + '">' + H.icon(H.ICON.plus, 16) + T('Also lives in another household') + '</button></div>' : '') +
        (H.can('rosters.manage') || H.can('*') ? '<p class="hint">' + T('Want them to serve together?') + ' <a href="#/rosters/together">' + T('Set up a serving group') + '</a>.</p>' : '') + '</section>';
    }
    // Adults responsible for a child, and who may not collect them (Administrators, Pastors, Children's ministry)
    if (child && canChildren()) html += guardiansPanel(p);
    if (!child && canChildren()) {
      var resp = HS.childrenOf(p.id, S.list('guardians'));
      if (resp.length) html += '<section class="panel"><h2>' + T('Responsible for') + '</h2><div class="list">' + resp.map(function (l) {
        var c = S.get('people', l.childId); if (!c) return '';
        return '<a class="item" href="#/people/p/' + c.id + '">' + H.avatar(c, 32) + '<span class="grow"><b>' + esc(H.name(c)) + '</b><small>' + esc(T(l.relationship) + (l.canConsent ? ' · ' + T('can give consent') : '') + (l.mayCollect ? ' · ' + T('may collect') : '')) + '</small></span></a>';
      }).join('') + '</div></section>';
    }
    // Consent (POPIA)
    if (full) {
      html += '<section class="panel"><div class="row"><h2 class="grow" style="margin:0">' + T('Consent') + '</h2>' + H.icon(H.ICON.privacy, 18) + '</div><p class="hint" style="margin:4px 0 10px">' + (me ? T('What you have agreed to, as {law} requires.', { law: PrivacyLaw.forChurch(S.settings()).short }) : esc(T('What {name} has agreed to, as {law} requires.', { name: p.firstName, law: PrivacyLaw.forChurch(S.settings()).short }))) + (child ? ' ' + T('A parent or guardian gives consent for children.') : '') + '</p>' +
        '<div class="list">' + PURPOSES.filter(function (x) { return child ? (x === 'Church records' || x === 'Photos' || x === 'Children’s medical notes') : x !== 'Children’s medical notes'; }).map(function (pur) {
          var c = consentFor(p.id, pur);
          return '<div class="item"><span class="grow"><b>' + esc(T(pur)) + '</b><small>' + (c ? esc(T(c.given ? 'Agreed {date}' : 'Declined {date}', { date: H.fmt(c.date, true) }) + ' · ' + T(c.method) + (c.guardianId ? ' · ' + T('by {name}', { name: H.name(S.get('people', c.guardianId)) }) : '')) : T('Not asked yet')) + '</small></span>' +
            (c ? (c.given ? '<span class="tag ok">' + T('Yes') + '</span>' : '<span class="tag grey">' + T('No') + '</span>') : '<span class="tag bad">' + T('Missing') + '</span>') + '</div>';
        }).join('') + '</div>' +
        (child ? '' : '<h3 style="margin:16px 0 6px;font-size:.95rem">' + T('Would like to receive') + '</h3><div class="list">' + RECEIVE_P.map(function (pur) {
          var c = consentFor(p.id, pur);
          return '<div class="item"><span class="grow"><b>' + esc(T(pur)) + '</b>' + (c ? '<small>' + esc(T(c.given ? 'Agreed {date}' : 'Declined {date}', { date: H.fmt(c.date, true) })) + '</small>' : '') + '</span>' +
            (c && c.given ? '<span class="tag ok">' + T('Yes') + '</span>' : c ? '<span class="tag grey">' + T('No') + '</span>' : '<span class="tag grey">' + T('Not asked yet') + '</span>') + '</div>';
        }).join('') + '</div>') +
        '<div class="btns" style="margin-top:12px"><button class="btn small" data-act="people:consent" data-id="' + p.id + '">' + T(me ? 'Change my choices' : 'Record consent') + '</button></div></section>';
    }
    // Medical (children)
    if (seeMedical) {
      html += '<section class="panel"><div class="row"><h2 class="grow" style="margin:0">' + T('Medical and allergies') + '</h2><span class="locked">' + H.icon(H.ICON.lock, 14) + T('Children’s ministry only') + '</span></div>' +
        (p.medical && (p.medical.allergies || p.medical.notes) ? '<dl class="kv" style="margin-top:12px">' + (p.medical.allergies ? '<dt>' + T('Allergies') + '</dt><dd><span class="tag bad">' + esc(p.medical.allergies) + '</span></dd>' : '') + (p.medical.notes ? '<dt>' + T('Notes') + '</dt><dd>' + esc(p.medical.notes) + '</dd>' : '') + '</dl>' : '<p class="muted">' + T('None recorded.') + '</p>') +
        (hasConsent(p.id, 'Children’s medical notes') ? '' : '<p class="note warn" style="margin-top:10px">' + T('No guardian consent for medical notes yet.') + '</p>') +
        '<div class="btns" style="margin-top:10px"><button class="btn small" data-act="people:medical" data-id="' + p.id + '">' + T('Edit medical notes') + '</button></div></section>';
    }
    // Church office notes (Administrators and Pastors), e.g. the notes brought across from Elvanto
    if ((H.can('*') || H.can('people.edit')) && !me) {
      var onotes = S.find('officeNotes', function (n) { return n.personId === p.id; });
      html += '<section class="panel"><div class="row"><h2 class="grow" style="margin:0">' + T('Church office notes') + '</h2><span class="locked">' + H.icon(H.ICON.lock, 14) + T('Administrators and Pastors') + '</span></div>' +
        (onotes.length ? onotes.map(function (n) { return '<div style="margin-top:12px"><p style="margin:0;white-space:pre-line" data-own-words>' + esc(n.text) + '</p><p class="hint">' + esc((n.by === 'Elvanto' ? T('From Elvanto') : n.by) + ', ' + H.fmt(n.at, true)) +
          ' · <button class="link" data-act="people:delonote" data-id="' + n.id + '">' + T('Delete') + '</button></p></div>'; }).join('') : '<p class="muted">' + T('No notes.') + '</p>') +
        '<label class="field" style="margin-top:12px">' + T('Add a note') + '<textarea id="on-text" rows="2" placeholder="' + esc(T('Administrators and Pastors can see this. Pastoral matters go in pastoral notes.')) + '"></textarea></label><button class="btn small" data-act="people:onote" data-id="' + p.id + '">' + T('Save note') + '</button></section>';
    }
    // Pastoral notes
    if (seeNotes && !me) {
      var notes = S.find('notes', function (n) { return n.personId === p.id; });
      html += '<section class="panel"><div class="row"><h2 class="grow" style="margin:0">' + T('Pastoral notes') + '</h2><span class="locked">' + H.icon(H.ICON.lock, 14) + T('Pastors only · views are logged') + '</span></div>' +
        (notes.length ? notes.map(function (n) { return '<div style="margin-top:12px"><p style="margin:0" data-own-words>' + esc(n.text) + '</p><p class="hint">' + esc(n.by + ', ' + H.fmt(n.at, true)) + '</p></div>'; }).join('') : '<p class="muted">' + T('No notes.') + '</p>') +
        '<label class="field" style="margin-top:12px">' + T('Add a note') + '<textarea id="pn-text" rows="2" placeholder="' + esc(T('Only pastors can see this')) + '"></textarea></label><button class="btn small" data-act="people:note" data-id="' + p.id + '">' + T('Save note') + '</button></section>';
    }
    // Volunteering: services, departments and positions (Rosters teams and positions); roster coordinators and Administrators change it
    html += volunteerPanel(p, me);
    html += '</div>';
    return html;
  }

  /* ---------- volunteering ---------- */
  function slotName(id) { return Serving.slotLabel(id, S.settings()); }
  function slotIds() { return Serving.slots(S.settings()).map(function (x) { return x.id; }); }
  function canVolunteer() { return H.can('*') || H.can('rosters.manage'); }
  /** Services someone serves at: from their serving (empty = any service). */
  function serveTimes(sk) {
    var t = {}, any = false;
    sk.forEach(function (k) { if (k.times && k.times.length) k.times.forEach(function (x) { t[x] = 1; }); else any = true; });
    return any || !sk.length ? slotIds() : slotIds().filter(function (x) { return t[x]; });
  }
  function volunteerPanel(p, me) {
    var sk = S.find('skills', function (k) { return k.personId === p.id; }), pos = {};
    S.list('positions').forEach(function (x) { pos[x.id] = x; });
    var gr = S.find('groups', function (g) { return g.memberIds.indexOf(p.id) >= 0; });
    var byTeam = {}; sk.forEach(function (k) { var x = pos[k.positionId]; if (x) (byTeam[x.teamId] = byTeam[x.teamId] || []).push(x.name + (k.frequency ? ' · ' + T(k.frequency) : '')); });
    var teams = S.list('teams').filter(function (t) { return byTeam[t.id]; });
    if (!sk.length && !canVolunteer() && !me) return '';
    return '<section class="panel"><h2>' + T('Volunteering') + '</h2><dl class="kv">' +
      '<dt>' + T('Volunteer') + '</dt><dd>' + (sk.length ? T('Yes') : T('No')) + '</dd>' +
      (sk.length ? '<dt>' + T('Services') + '</dt><dd>' + esc(serveTimes(sk).map(slotName).join(', ')) + '</dd>' +
        teams.map(function (t) { return '<dt>' + esc(t.name) + '</dt><dd>' + esc(byTeam[t.id].join(', ')) + '</dd>'; }).join('') : '') + '</dl>' +
      gr.map(function (g) { var names = esc(g.memberIds.filter(function (m) { return m !== p.id; }).map(function (m) { return H.name(S.get('people', m)); }).join(', ')); return '<p class="hint">' + H.icon(g.kind === 'together' ? H.ICON.link : H.ICON.split, 14) + ' ' + T(g.kind === 'together' ? 'Serves together with {names}' : 'Kept apart from {names}', { names: names }) + ' (' + esc(T(g.strength === 'must' ? 'always' : 'when possible')) + ')</p>'; }).join('') +
      '<div class="btns" style="margin-top:10px">' + (canVolunteer() ? '<button class="btn small" data-act="people:volunteer" data-id="' + p.id + '">' + T('Edit volunteering') + '</button>' : '') +
      (me ? '<a class="btn small" href="#/rosters/mine">' + T('My serving') + '</a>' : canVolunteer() ? '<a class="btn small" href="#/rosters/teams">' + T('Teams') + '</a>' : '') + '</div></section>';
  }
  function volunteerDialog(p) {
    var sk = S.find('skills', function (k) { return k.personId === p.id; }), mine = {}; sk.forEach(function (k) { mine[k.positionId] = k; });
    var teams = S.list('teams'), times = serveTimes(sk);
    var body = !teams.length ? '<p class="note warn">' + T('There are no departments yet. Set them up under {link} first.', { link: '<a href="#/rosters/teams" data-act="hub:close">' + T('Rosters → Teams') + '</a>' }) + '</p>' :
      '<fieldset class="vol-yes"><legend class="field-l">' + T('Volunteer') + '</legend><label class="check" style="display:inline-flex;margin-right:16px"><input type="radio" name="vol" value="yes"' + (sk.length ? ' checked' : '') + '><span>' + T('Yes') + '</span></label>' +
        '<label class="check" style="display:inline-flex"><input type="radio" name="vol" value="no"' + (sk.length ? '' : ' checked') + '><span>' + T('No') + '</span></label></fieldset>' +
      '<div id="vol-f"' + (sk.length ? '' : ' hidden') + '><fieldset><legend class="field-l">' + T('Services') + '</legend><div class="row" style="gap:4px 16px;flex-wrap:wrap">' +
        Serving.slots(S.settings()).map(function (x) { return [x.id, slotName(x.id)]; }).map(function (t) { return '<label class="check" style="margin:0"><input type="checkbox" class="vol-t" value="' + t[0] + '"' + (sk.length && times.indexOf(t[0]) >= 0 ? ' checked' : '') + '><span>' + t[1] + '</span></label>'; }).join('') + '</div></fieldset>' +
        '<p class="field-l" style="margin:14px 0 4px">' + T('Departments and positions') + '</p>' +
        teams.map(function (t) {
          var ps = S.find('positions', function (x) { return x.teamId === t.id; }), on = ps.some(function (x) { return mine[x.id]; });
          return '<fieldset class="panel vol-dept" style="padding:10px 12px;margin:0 0 8px"><label class="check" style="margin:0"><input type="checkbox" class="vol-d" data-t="' + t.id + '"' + (on ? ' checked' : '') + '><span><b>' + esc(t.name) + '</b></span></label>' +
            '<div class="vol-ps" data-t="' + t.id + '"' + (on ? '' : ' hidden') + ' style="margin:6px 0 0 28px">' + ps.map(function (x) {
              var only = x.times && x.times.length && x.times.length < slotIds().length ? ' <span class="muted small">(' + esc(T('{times} only', { times: x.times.map(slotName).join(', ') })) + ')</span>' : '';
              return '<label class="check" style="margin:2px 0"><input type="checkbox" class="vol-p" value="' + x.id + '"' + (mine[x.id] ? ' checked' : '') + '><span>' + esc(x.name) + only + '</span></label>';
            }).join('') + '</div></fieldset>';
        }).join('') +
        '<label class="field" style="margin-top:8px">' + T('How often (for new positions)') + '<select id="vol-freq"><option value="weekly">' + T('weekly') + '</option><option value="fortnightly" selected>' + T('fortnightly') + '</option><option value="monthly">' + T('monthly') + '</option><option value="occasional">' + T('occasional') + '</option></select></label></div>' +
      '<p id="vol-err" class="note bad" hidden></p>';
    H.modal(H.dialogHead(T('Volunteering: {name}', { name: H.name(p) }), T('Which services they serve at, and in which departments and positions. Rostering uses this.')) + '<div class="dlg-body">' + body + '</div>' +
      '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button>' + (teams.length ? '<button class="btn primary" data-act="people:savevolunteer" data-id="' + p.id + '">' + T('Save') + '</button>' : '') + '</div>', T('Volunteering'));
    document.querySelectorAll('input[name="vol"]').forEach(function (r) { r.addEventListener('change', function () { document.getElementById('vol-f').hidden = r.value !== 'yes' || !r.checked; }); });
    document.querySelectorAll('.vol-d').forEach(function (d) { d.addEventListener('change', function () { document.querySelector('.vol-ps[data-t="' + d.dataset.t + '"]').hidden = !d.checked; }); });
  }

  /* ---------- parents, guardians and collection (children) ---------- */
  function guardiansPanel(p) {
    var ls = links(p.id).sort(function (a, b) { return (b.canConsent - a.canConsent) || (b.primary - a.primary); });
    var nc = S.find('noCollect', function (x) { return x.childId === p.id; });
    if (nc.length && state.ncAudited !== p.id) { state.ncAudited = p.id; S.audit('Viewed collection restrictions for ' + H.name(p), 'people/' + p.id); }
    var tag = function (on, text) { return on ? ' <span class="tag ok">' + text + '</span>' : ''; };
    return '<section class="panel"><div class="row"><h2 class="grow" style="margin:0">' + T('Parents, guardians and collection') + '</h2>' + H.icon(H.ICON.lock, 16) + '</div>' +
      '<p class="hint" style="margin:4px 0 10px">' + esc(T('Who is responsible for {name}, who gives consent, who hears from the church, and who may collect {name}.', { name: p.firstName })) + '</p>' +
      (ls.length ? '<div class="list">' + ls.map(function (l) {
        var a = l.adultId ? S.get('people', l.adultId) : null;
        return '<div class="item" style="flex-wrap:wrap">' + (a ? H.avatar(a, 32) : '') + '<span class="grow" style="min-width:160px"><b>' + (a ? '<a href="#/people/p/' + a.id + '">' + esc(H.name(a)) + '</a>' : esc(l.name || '')) + '</b><small>' + esc(T(l.relationship) + (a ? '' : (l.phone ? ' · ' + l.phone : '') + ' · ' + T('not in Church Hub'))) + '</small>' +
          '<span>' + tag(l.canConsent, T('Can give consent')) + tag(l.primary, T('Primary contact')) + tag(l.mayCollect, T('May collect')) + (l.confirmed ? '' : ' <span class="tag warn">' + T('Please confirm') + '</span>') + '</span></span>' +
          '<button class="btn small" data-act="people:link" data-child="' + p.id + '" data-id="' + l.id + '">' + T('Edit') + '</button></div>';
      }).join('') + '</div>' : '<p class="note warn" style="margin:0">' + T('No parent or guardian recorded yet.') + '</p>') +
      (ls.some(function (l) { return !l.confirmed; }) ? '<p class="hint">' + T('These were linked automatically from the household. Check each one and click Edit → Save to confirm.') + '</p>' : '') +
      '<div class="btns" style="margin-top:10px"><button class="btn small" data-act="people:link" data-child="' + p.id + '">' + H.icon(H.ICON.plus, 16) + T('Add a parent, guardian or collector') + '</button></div>' +
      '<h3 style="margin:18px 0 6px;font-size:15px;color:var(--bad)">' + T('Not allowed to collect') + '</h3>' +
      (nc.length ? '<div class="list">' + nc.map(function (x) {
        var who = x.personId ? S.get('people', x.personId) : null;
        return '<div class="item" style="border-left:4px solid var(--bad)"><span class="grow"><b>' + esc(who ? H.name(who) : x.name) + '</b><small>' + esc(x.note || '') + '</small></span><button class="btn small" data-act="people:ncdel" data-id="' + x.id + '">' + T('Remove') + '</button></div>';
      }).join('') + '</div>' : '<p class="muted" style="margin:0">' + T('No one.') + '</p>') +
      '<div class="btns" style="margin-top:8px"><button class="btn small" data-act="people:nc" data-child="' + p.id + '">' + T('Add someone who may not collect') + '</button></div>' +
      '<p class="hint">' + T('Only Administrators, Pastors and Children’s ministry see this. Viewing a collection restriction is logged.') + '</p></section>';
  }
  function adultOptions(sel, exceptId) {
    return S.find('people', function (x) { return x.familyRole !== 'child' && x.active !== false && x.id !== exceptId; }).sort(function (a, b) { return H.name(a).localeCompare(H.name(b)); })
      .map(function (x) { return '<option value="' + x.id + '"' + (x.id === sel ? ' selected' : '') + '>' + esc(H.name(x)) + '</option>'; }).join('');
  }
  function linkDialog(childId, linkId) {
    var c = S.get('people', childId), l = linkId ? S.get('guardians', linkId) : null, isNew = !l;
    l = l || Object.assign({ childId: childId, adultId: '', name: '', phone: '', relationship: 'Mother' }, HS.defaultsFor('Mother'));
    var outside = !l.adultId && !!l.name;
    H.modal(H.dialogHead(isNew ? T('Add a parent, guardian or collector') : T('Edit {name}', { name: linkName(l) }), T('For {name}', { name: H.name(c) })) + '<div class="dlg-body">' +
      '<label class="field req">' + T('Who') + '<select class="findable" id="gl-who"><option value="">' + T('Choose…') + '</option><option value="__out"' + (outside ? ' selected' : '') + '>' + T('Someone not in Church Hub…') + '</option>' + adultOptions(l.adultId, childId) + '</select></label>' +
      '<div id="gl-out" class="two"' + (outside ? '' : ' hidden') + '><label class="field req">' + T('Name') + '<input id="gl-name" value="' + esc(l.name || '') + '"></label><label class="field">' + T('Phone') + '<input id="gl-phone" type="tel" value="' + esc(l.phone || '') + '"></label></div>' +
      '<label class="field req">' + esc(T('Relationship to {name}', { name: c.firstName })) + '<select id="gl-rel">' + HS.RELATIONSHIPS.map(function (r) { return '<option value="' + esc(r) + '"' + (l.relationship === r ? ' selected' : '') + '>' + esc(T(r)) + '</option>'; }).join('') + '</select></label>' +
      '<label class="check"><input type="checkbox" id="gl-consent"' + (l.canConsent ? ' checked' : '') + '><span><b>' + T('Can give consent') + '</b><br><span class="muted small">' + esc(T('A parent or legal guardian ({law}). Not step-parents, grandparents or collectors unless they are legal guardians.', { law: PrivacyLaw.forChurch(S.settings()).short })) + '</span></span></label>' +
      '<label class="check"><input type="checkbox" id="gl-primary"' + (l.primary ? ' checked' : '') + '><span><b>' + T('Primary contact') + '</b><br><span class="muted small">' + esc(T('Gets messages from the church about {name}.', { name: c.firstName })) + '</span></span></label>' +
      '<label class="check"><input type="checkbox" id="gl-collect"' + (l.mayCollect ? ' checked' : '') + '><span><b>' + esc(T('May collect {name}', { name: c.firstName })) + '</b><br><span class="muted small">' + esc(T('Can sign {name} out of children’s church.', { name: c.firstName })) + '</span></span></label>' +
      '<p id="gl-err" class="note bad" hidden></p></div><div class="dlg-foot">' + (isNew ? '' : '<button class="btn" style="margin-right:auto" data-act="people:linkdel" data-id="' + l.id + '">' + T('Remove') + '</button>') +
      '<button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn primary" data-act="people:linksave" data-child="' + childId + '" data-id="' + (l.id || '') + '">' + T(isNew ? 'Add' : 'Save') + '</button></div>', T('Parent or guardian'));
    var who = document.getElementById('gl-who'), rel = document.getElementById('gl-rel');
    who.addEventListener('change', function () { document.getElementById('gl-out').hidden = who.value !== '__out'; });
    rel.addEventListener('change', function () { var d = HS.defaultsFor(rel.value); document.getElementById('gl-consent').checked = d.canConsent; document.getElementById('gl-primary').checked = d.primary; document.getElementById('gl-collect').checked = d.mayCollect; });
  }
  function ncDialog(childId) {
    var c = S.get('people', childId);
    H.modal(H.dialogHead(T('Not allowed to collect {name}', { name: c.firstName }), T('Children’s ministry will see an alert. Keep the note short and factual.')) + '<div class="dlg-body">' +
      '<label class="field req">' + T('Who') + '<select class="findable" id="nc-who"><option value="__out">' + T('Someone not in Church Hub…') + '</option>' + adultOptions('', childId) + '</select></label>' +
      '<label class="field req" id="nc-name-f">' + T('Name') + '<input id="nc-name"></label>' +
      '<label class="field">' + T('Note') + ' <small>' + T('(e.g. “Court order – call Karen”)') + '</small><input id="nc-note"></label><p id="nc-err" class="note bad" hidden></p></div>' +
      '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn primary danger" data-act="people:ncsave" data-child="' + childId + '">' + T('Save') + '</button></div>', T('Not allowed to collect'));
    var who = document.getElementById('nc-who');
    who.addEventListener('change', function () { document.getElementById('nc-name-f').hidden = who.value !== '__out'; });
  }
  function homeDialog(pid) {
    var p = S.get('people', pid), hs = HS.householdsOf(p);
    var fams = S.list('families').filter(function (f) { return hs.indexOf(f.id) < 0; }).sort(function (a, b) { return H.familyName(a).localeCompare(H.familyName(b)); });
    H.modal(H.dialogHead(T('Another household for {name}', { name: p.firstName }), T('For example, the other parent’s home.')) + '<div class="dlg-body"><label class="field req">' + T('Household') + '<select class="findable" id="hm-f">' +
      fams.map(function (f) { return '<option value="' + f.id + '">' + esc(H.familyName(f)) + '</option>'; }).join('') + '</select></label></div>' +
      '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn primary" data-act="people:savehome" data-id="' + pid + '">' + T('Add') + '</button></div>', T('Another household'));
  }

  /* ---------- families ---------- */
  function renderFamilies() {
    var surname = function (f) { var n = H.familyName(f).split(' '); return n[n.length - 1] + ' ' + n.join(' '); };
    var fq = state.fq.trim().toLowerCase(), cps = allCouples();
    var fams = S.list('families').filter(function (f) {
      return !fq || H.matches(H.familyName(f) + ' ' + members(f.id).map(function (m) { return H.names(m).join(' | '); }).join(' | '), fq);
    }).sort(function (a, b) { return surname(a).localeCompare(surname(b)); });
    return '<a class="crumb" href="#/people">' + H.icon(H.ICON.back, 16) + T('People') + '</a><div class="page-head"><div><h1>' + T('Households') + '</h1><p class="lead">' + T('A household is the people who live together – what Elvanto calls a “family”. Each is named after its adults (e.g. “Tim & Clare Jacobs”). A child of separated parents can be in two households. Parents, guardians and who may collect a child are recorded on the child’s profile.') + '</p></div>' +
      '<button class="btn primary" data-act="people:newfam">' + H.icon(H.ICON.plus, 18) + T('New household') + '</button></div>' +
      '<label class="search" style="margin-bottom:14px">' + H.icon(H.ICON.search, 18) + '<span class="sr">' + T('Search households') + '</span><input id="fm-q" type="search" placeholder="' + esc(T('Search by household or anyone in it')) + '" value="' + esc(state.fq) + '"></label>' +
      couplesPanel(fq ? fams.map(function (f) { return f.id; }) : null) +
      '<p class="muted small">' + TN('{n} household', '{n} households', fams.length) + '</p>' +
      (fams.length ? '' : '<p class="empty">' + T('No household matches. Try another name.') + '</p>') +
      '<div class="grid2">' + fams.map(function (f) {
        var ms = members(f.id);
        return '<section class="panel"><div class="row"><h2 class="grow" style="margin:0">' + esc(H.familyName(f)) + '</h2><button class="btn small" data-act="people:renamefam" data-id="' + f.id + '">' + T('Rename') + '</button></div>' +
          (f.custom ? '<p class="hint" style="margin:2px 0 8px">' + T('Own name') + '</p>' : '<p class="hint" style="margin:2px 0 8px">' + T('Named after its adults') + '</p>') +
          cps.filter(function (c) { return c.familyId === f.id; }).map(function (c) { return '<p class="small" style="margin:0 0 8px">' + H.icon(H.ICON.people, 14) + ' ' + esc(T(c.kind === 'spouse' ? 'Spouses' : 'Partners') + ': ' + H.name(S.get('people', c.a)) + ' & ' + H.name(S.get('people', c.b))) + (c.confirmed ? '' : ' <span class="muted">(' + T(c.sure ? 'to confirm' : 'probably') + ')</span>') + '</p>'; }).join('') + (ms.length ? '<div class="list">' + ms.map(function (m) { return '<a class="item" href="#/people/p/' + m.id + '">' + H.avatar(m, 32) + '<span class="grow"><b>' + esc(H.name(m)) + '</b><small>' + (m.familyRole === 'child' ? T('Child') + (HS.householdsOf(m).length > 1 ? ' · ' + T('lives in {n} households', { n: HS.householdsOf(m).length }) : '') : T('Adult')) + '</small></span></a>'; }).join('') + '</div>' : '<p class="muted">' + T('No one in this household yet.') + '</p>') + '</section>';
      }).join('') + '</div>';
  }

  /* ---------- duplicates (Administrators): rules in js/duplicates.js ---------- */
  var DUP = Duplicates;
  // Administrators and Pastors (both may change people's details). "Not the same person" is kept on both people (notSame).
  function canDup() { return canSeeAll() && (H.can('*') || H.can('people.edit')); }
  function dupPeople() { return S.find('people', function (p) { return p.firstName !== 'Deleted' && !p.mergedInto; }); }
  function notDup() { return DUP.ignored(S.list('people')); }
  function markNotSame(aId, bId) {
    [[aId, bId], [bId, aId]].forEach(function (x) {
      var q = S.get('people', x[0]); if (!q || (q.notSame || []).indexOf(x[1]) >= 0) return;
      q = JSON.parse(JSON.stringify(q)); q.notSame = (q.notSame || []).concat([x[1]]); S.put('people', q);
    });
    S.audit('Not the same person: ' + H.name(S.get('people', aId)) + ' and ' + H.name(S.get('people', bId)), 'people/' + aId);
  }
  function dupCard(p) {
    var hs = householdNames(p), bits = [hs.length ? T('Household: {names}', { names: hs.join(', ') }) : '', p.category ? T(p.category) : '', p.familyRole === 'child' ? T('Child') : '',
      p.email ? p.email : '', p.mobile ? p.mobile : '', p.birthDate ? T('Born {date}', { date: H.fmt(p.birthDate, true) }) : '', p.elvantoId ? T('From Elvanto') : '',
      p.active === false ? T('Marked as left') : '', p.createdAt ? T('Added {date}', { date: H.fmt(p.createdAt.slice(0, 10), true) }) : ''].filter(Boolean);
    return '<a class="item" href="#/people/p/' + p.id + '" style="align-items:flex-start">' + H.avatar(p, 32) + '<span class="grow"><b>' + esc(H.name(p)) + (p.preferredName && p.preferredName !== p.firstName ? ' <span class="muted">(' + esc(p.firstName) + ')</span>' : '') + '</b><small>' + esc(bits.join(' · ')) + '</small></span></a>';
  }
  var DUPWORD = { certain: TX('Certainly the same person'), likely: TX('Probably the same person'), possible: TX('Possibly the same person') };
  /* ---------- late spouses: suggestions for Administrators (rules in js/households.js) ---------- */
  function isDead(p) { return deceased(p) || p.category === 'Deceased'; }
  function lateSuggestions() { return H.can('*') ? HS.lateSpouseSuggestions(S.list('people'), isDead) : []; }
  function renderLate() {
    var back = '<a class="crumb" href="#/people">' + H.icon(H.ICON.back, 16) + T('People') + '</a>';
    if (!H.can('*')) return back + '<p class="empty">' + T('This is for Administrators.') + '</p>';
    var sug = lateSuggestions();
    var open = S.find('people', function (p) { return p.familyRole !== 'child' && !p.mergedInto && p.maritalStatus === 'Widowed' && !isDead(p) && !lateSpouse(p) && !p.lateSpouseName && !sug.some(function (x) { return x.a === p.id; }); });
    var died = function (p) { return p.deceasedAt ? T('died {date}', { date: H.fmt(p.deceasedAt, true) }) : T('has died'); };
    var card = function (p, note) { return '<a class="item" href="#/people/p/' + p.id + '">' + H.avatar(p, 32) + '<span class="grow"><b>' + esc(H.name(p)) + '</b><small>' + esc(note) + '</small></span></a>'; };
    return back + '<div class="page-head"><div><h1>' + T('Late spouses') + '</h1><p class="lead">' + T('Widows and widowers – and people who have died – who were probably married to someone who has died. Church Hub compares households, wedding dates, email addresses, phone numbers, surnames and ages. Please check each one: these are only suggestions.') + '</p></div></div>' +
      (sug.length ? '<p class="muted small">' + TN('{n} suggestion, most likely first.', '{n} suggestions, most likely first.', sug.length) + '</p>' : '<p class="empty">' + T('No suggestions. Everyone Church Hub could match has been checked.') + '</p>') +
      sug.map(function (x) {
        var a = S.get('people', x.a), b = S.get('people', x.b);
        return '<section class="panel" style="margin-bottom:12px"><div class="row" style="flex-wrap:wrap;gap:8px"><h2 class="grow" style="margin:0;font-size:1rem">' + T(x.bothDied ? 'Probably married to each other' : 'Probably married') + '</h2><span class="tag ' + (x.score >= 80 ? 'ok' : 'grey') + '">' + T(x.score >= 80 ? 'Likely' : 'Possible') + '</span></div>' +
          '<p class="hint" style="margin:6px 0 0">' + esc(x.reasons.join(' · ')) + '</p>' +
          '<div class="list" style="margin:10px 0">' + card(a, x.bothDied ? (a.maritalStatus ? T(a.maritalStatus) : '') + ' · ' + died(a) : x.stillMarried ? T('Still recorded as Married – Yes changes this to Widowed') : T('Widowed')) + card(b, died(b)) + '</div>' +
          '<div class="btns"><button class="btn small primary" data-act="people:lateyes" data-a="' + x.a + '" data-b="' + x.b + '">' + T('Yes, they were married') + '</button><button class="btn small" data-act="people:lateno" data-a="' + x.a + '" data-b="' + x.b + '">' + T('Not a couple') + '</button></div></section>';
      }).join('') +
      (open.length ? '<section class="panel" style="margin-top:16px"><h2>' + T('Widowed, no match found ({n})', { n: open.length }) + '</h2><p class="hint" style="margin-top:0">' + T('Open each one and use {where} to choose someone, or type the name of someone who isn’t in Church Hub.', { where: '<b>' + T('Edit details → Late spouse') + '</b>' }) + '</p><div class="list">' +
        open.sort(function (a, b) { return (a.lastName + a.firstName).localeCompare(b.lastName + b.firstName); }).map(function (p) { return card(p, T('Widowed')); }).join('') + '</div></section>' : '');
  }

  function renderDuplicates() {
    var back = '<a class="crumb" href="#/people">' + H.icon(H.ICON.back, 16) + T('People') + '</a>';
    if (!canDup()) return back + '<p class="empty">' + T('Finding duplicates is for Administrators and Pastors.') + '</p>';
    var found = DUP.find(dupPeople(), notDup());
    return back + '<div class="page-head"><div><h1>' + T('Find duplicates') + '</h1><p class="lead">' + T('People who may have been entered twice. Church Hub compares names (including short forms like Doug and Douglas, “known as”, typing slips, swapped and maiden names), email, mobile, birthday and Elvanto ID. Families sharing an email or phone are not counted as duplicates.') + '</p></div></div>' +
      (found.length ? '<p class="muted small">' + TN('{n} pair to check, most likely first. Open each to compare.', '{n} pairs to check, most likely first. Open each to compare.', found.length) + ' <b>' + T('Same person: fix…') + '</b> ' + T('keeps one record, fills in what it’s missing from the other and moves consents, guardians and serving across.') + '</p>' : '<p class="empty">' + T('No duplicates found.') + '</p>') +
      found.map(function (d) {
        var a = S.get('people', d.a), b = S.get('people', d.b);
        return '<section class="panel" style="margin-bottom:12px"><div class="row" style="flex-wrap:wrap;gap:8px"><h2 class="grow" style="margin:0;font-size:1rem">' + esc(T(DUPWORD[d.level])) + '</h2><span class="tag ' + (d.level === 'possible' ? 'grey' : 'warn') + '">' + T(d.level === 'possible' ? 'Check' : 'Likely') + '</span></div>' +
          '<p class="hint" style="margin:6px 0 0">' + esc(d.reasons.join(' · ')) + '</p>' +
          '<div class="list" style="margin:10px 0">' + dupCard(a) + dupCard(b) + '</div>' +
          '<div class="btns"><button class="btn small primary" data-act="people:fixdup" data-a="' + d.a + '" data-b="' + d.b + '">' + T('Same person: fix…') + '</button><button class="btn small" data-act="people:notdup" data-a="' + d.a + '" data-b="' + d.b + '">' + T('Not the same person') + '</button></div></section>';
      }).join('');
  }
  /* Fixing a duplicate: keep one record, fill its gaps from the other, move what points at the other, retire the other. */
  var FIELD_NAMES = { email: TX('Email'), mobile: TX('Mobile'), birthDate: TX('Birthday'), maritalStatus: TX('Marital status'), preferredName: TX('Known as'),
    firstName: TX('First name'), lastName: TX('Last name'), elvantoId: TX('Elvanto link'), staff: TX('Staff details'), familyId: TX('Household'), keyDates: TX('Key dates'),
    familyRole: TX('Adult or child'), directory: TX('Directory'), emailUnknown: TX('Email not known'), mobileUnknown: TX('Mobile not known') };
  function fieldName(k) { return FIELD_NAMES[k] ? T(FIELD_NAMES[k]) : k; }
  function refsOf(id) {
    var by = function (c) { return S.find(c, function (x) { return x.personId === id; }); }, lv = S.leave();
    return {
      consents: by('consents'), guardians: S.find('guardians', function (l) { return l.childId === id || l.adultId === id; }),
      noCollect: S.find('noCollect', function (x) { return x.childId === id || x.personId === id; }), notes: H.can('notes') ? by('notes') : [],
      // Only Administrators may change these (rosters and leave)
      skills: by('skills'), assignments: by('assignments'), blockouts: by('blockouts'), serveOffers: by('serveOffers'),
      groups: S.find('groups', function (g) { return (g.memberIds || []).indexOf(id) >= 0; }),
      leave: lv ? (lv.requests || []).filter(function (r) { return r.staffId === id; }).concat((lv.adjustments || []).filter(function (a) { return a.staffId === id; })) : []
    };
  }
  // Sign-in access lives on the access list, which only Administrators change. (The demo gives everyone "Member", with no real list.)
  function hasAccess(p) { return !!p.appRole && p.appRole !== 'none' && (Store.isLive() || p.appRole !== 'member'); }
  /** What only an Administrator can move, in words (empty for Administrators). */
  function adminOnly(drop, r) {
    if (H.can('*')) return [];
    var out = [];
    if (r.assignments.length || r.skills.length || r.blockouts.length || r.serveOffers.length || r.groups.length) out.push(T('rosters and serving'));
    if (r.leave.length || drop.staff) out.push(T('staff leave'));
    if (hasAccess(drop)) out.push(T('sign-in access'));
    return out;
  }
  function chooseKeep(a, b) {
    var filled = function (p) { return Object.keys(p).filter(function (k) { return p[k] !== '' && p[k] != null; }).length; };
    if (a.elvantoId && !b.elvantoId) return a; if (b.elvantoId && !a.elvantoId) return b;
    if (hasAccess(a) !== hasAccess(b)) return hasAccess(a) ? a : b;
    if (filled(a) !== filled(b)) return filled(a) > filled(b) ? a : b;
    return (a.createdAt || '') <= (b.createdAt || '') ? a : b;
  }
  function fixDialog(aId, bId, keepId) {
    if (!canDup()) return;
    var a = S.get('people', aId), b = S.get('people', bId); if (!a || !b) return;
    var keep = keepId ? S.get('people', keepId) : chooseKeep(a, b), drop = keep.id === a.id ? b : a;
    var m = DUP.mergeFields(keep, drop), r = refsOf(drop.id), blocked = adminOnly(drop, r);
    var g = r.guardians.length + r.noCollect.length, aw = r.blockouts.length + r.serveOffers.length;
    var moving = [r.consents.length && TN('{n} consent', '{n} consents', r.consents.length), g && TN('{n} parent / guardian link', '{n} parent / guardian links', g),
      r.notes.length && TN('{n} pastoral note', '{n} pastoral notes', r.notes.length), r.assignments.length && TN('{n} roster turn', '{n} roster turns', r.assignments.length),
      r.skills.length && TN('{n} serving position', '{n} serving positions', r.skills.length), aw && TN('{n} away date or serving offer', '{n} away dates or serving offers', aw),
      r.groups.length && TN('{n} serve together / apart group', '{n} serve together / apart groups', r.groups.length), r.leave.length && TN('{n} leave record', '{n} leave records', r.leave.length)].filter(Boolean);
    var pick = function (p) { return '<button class="btn small' + (p.id === keep.id ? ' primary' : '') + '" data-act="people:fixkeep" data-a="' + aId + '" data-b="' + bId + '" data-keep="' + p.id + '" aria-pressed="' + (p.id === keep.id) + '">' + (p.createdAt ? T('Keep {name} (added {date})', { name: esc(H.name(p)), date: esc(H.fmt(p.createdAt.slice(0, 10), true)) }) : T('Keep {name}', { name: esc(H.name(p)) })) + '</button>'; };
    var html = H.dialogHead(T('Fix a duplicate'), T('Keep one record. The other is kept for the records but taken out of lists and searches.')) + '<div class="dlg-body">' +
      '<p style="margin:0 0 6px"><b>' + T('Which record should stay?') + '</b></p><div class="btns" style="margin-bottom:12px">' + pick(a) + pick(b) + '</div>' +
      '<p class="small" style="margin:0 0 4px"><b>' + T('After fixing:') + '</b></p><div class="list" style="margin-bottom:12px">' + dupCard(m.person).replace(/<a class="item" href="[^"]*"/, '<div class="item"').replace(/<\/a>$/, '</div>') + '</div>' +
      '<p class="small" style="margin:0 0 6px"><b>' + T('Filled in from the other record:') + '</b> ' + (m.filled.length ? esc(m.filled.filter(function (k, i, x) { return x.indexOf(k) === i; }).map(fieldName).join(', ')) : T('nothing – it has nothing extra')) + '</p>' +
      (m.differs.length ? '<p class="small" style="margin:0 0 6px"><b>' + T('Different on the other record, not copied:') + '</b> ' + esc(m.differs.map(function (d) { return fieldName(d.field) + ' ' + (typeof d.value === 'object' ? '' : '“' + d.value + '”'); }).join(', ')) + '. ' + T('Edit the kept record afterwards if one of these is the right one.') + '</p>' : '') +
      '<p class="small" style="margin:0 0 6px"><b>' + T('Moved across:') + '</b> ' + (moving.length ? esc(moving.join(', ')) : T('nothing')) + '.</p>' +
      (!H.can('notes') ? '<p class="hint" style="margin:0 0 6px">' + T('Pastoral notes stay with the old record (only Pastors can read them).') + '</p>' : '') +
      (drop.familyRole === 'child' ? '<p class="hint" style="margin:0 0 6px">' + T('Children’s medical notes stay with the old record – ask Children’s ministry to check them.') + '</p>' : '') +
      (blocked.length ? '<p class="note bad">' + T('The other record has {what}, which only an Administrator can move. Please ask an Administrator to fix this duplicate.', { what: esc(blocked.join(', ')) }) + '</p>' : '') +
      '</div><div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button>' +
      (blocked.length ? '' : '<button class="btn primary" data-act="people:fixdo" data-keep="' + keep.id + '" data-drop="' + drop.id + '">' + T('Fix: keep {name}', { name: esc(H.name(keep)) }) + '</button>') + '</div>';
    H.modal(html, T('Fix a duplicate'));
  }
  function doFix(keepId, dropId) {
    var keep = S.get('people', keepId), drop = S.get('people', dropId);
    if (!canDup() || !keep || !drop || keepId === dropId) return;
    var r = refsOf(dropId); if (adminOnly(drop, r).length) return;
    var m = DUP.mergeFields(keep, drop), kept = m.person, dn = H.name(drop), kn = H.name(keep);
    if (H.can('*') && !hasAccess(keep) && hasAccess(drop)) kept.appRole = drop.appRole;     // they could sign in before: they still can
    // Retire the other record first (so its sign-in entry is removed before the kept record's is written)
    var d = JSON.parse(JSON.stringify(drop)); d.active = false; d.mergedInto = keepId; d.archivedAt = H.today(); if (H.can('*')) d.appRole = 'none';
    S.put('people', d, 'Duplicate: ' + dn + ' merged into ' + kn + ' (kept for the records)');
    S.put('people', kept, 'Duplicate: kept ' + H.name(kept) + ', filled in ' + (m.filled.length ? m.filled.map(fieldName).join(', ') : 'nothing') + ' from the other record');
    var swap = function (v) { return v === dropId ? keepId : v; }, clone = function (x) { return JSON.parse(JSON.stringify(x)); };
    r.consents.forEach(function (c) { c = clone(c); c.personId = keepId; S.put('consents', c); });
    r.guardians.forEach(function (l) {
      var n = clone(l); n.childId = swap(n.childId); n.adultId = swap(n.adultId);
      var twin = S.find('guardians', function (o) { return o.id !== l.id && o.childId === n.childId && o.adultId === n.adultId; })[0];
      if (twin || n.childId === n.adultId) S.remove('guardians', l.id); else S.put('guardians', n);
    });
    r.noCollect.forEach(function (x) { x = clone(x); x.childId = swap(x.childId); if (x.personId) x.personId = swap(x.personId); S.put('noCollect', x); });
    r.notes.forEach(function (n) { var c = clone(n); S.remove('notes', n.id); c.personId = keepId; S.put('notes', c); });
    if (H.can('*')) {
      r.skills.forEach(function (k) { if (S.find('skills', function (o) { return o.personId === keepId && o.positionId === k.positionId; }).length) S.remove('skills', k.id); else { k = clone(k); k.personId = keepId; S.put('skills', k); } });
      r.assignments.forEach(function (a) {
        if (S.find('assignments', function (o) { return o.personId === keepId && o.serviceId === a.serviceId && o.positionId === a.positionId; }).length) S.remove('assignments', a.id);
        else { a = clone(a); a.personId = keepId; S.put('assignments', a); }
      });
      ['blockouts', 'serveOffers'].forEach(function (c) { r[c].forEach(function (x) { x = clone(x); x.personId = keepId; S.put(c, x); }); });
      r.groups.forEach(function (g) {
        g = clone(g); g.memberIds = g.memberIds.map(swap).filter(function (x, i, a) { return a.indexOf(x) === i; });
        if (g.memberIds.length < 2) S.remove('groups', g.id); else S.put('groups', g);
      });
      if (r.leave.length) { r.leave.forEach(function (x) { x.staffId = keepId; }); S.saveLeave('Duplicate: leave of ' + dn + ' moved to ' + kn); }
    }
    H.closeModal(); H.go('people/p/' + keepId); H.toast(T('Fixed: one record for {name}', { name: H.name(kept) }));
  }

  /** Live warning in the Add / Edit window: who this may already be. Blocks saving for very likely duplicates. */
  function typedPerson() {
    var g = function (id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }, un = function (v) { return /^(unknown|not known)$/i.test(v) || v.toLowerCase() === T('unknown').toLowerCase() ? '' : v; };
    var fr = document.getElementById('pf-frole');
    return { id: g('pf-id'), firstName: g('pf-first'), lastName: g('pf-last'), preferredName: g('pf-pref'), email: un(g('pf-email')), mobile: un(g('pf-mobile')),
      birthDate: g('pf-birth'), familyRole: fr ? fr.value : '' };
  }
  function dupMatches() { if (!canSeeAll()) return []; var t = typedPerson(); if (!t.firstName || !t.lastName) return []; var ex = t.id ? S.get('people', t.id) : null; if (ex && ex.elvantoId) t.elvantoId = ex.elvantoId; return DUP.matches(t, dupPeople(), notDup()); }
  function dupWarn() {
    var box = document.getElementById('pf-dup'); if (!box) return;
    var ms = dupMatches().slice(0, 3), stop = ms.some(function (m) { return m.score >= 70; });
    box.hidden = !ms.length;
    if (!ms.length) { box.innerHTML = ''; return; }
    var keep = document.getElementById('pf-dup-ok'), was = keep && keep.checked;
    box.className = 'note ' + (stop ? 'bad' : 'warn');
    box.innerHTML = '<b>' + T('This may be someone already in Church Hub:') + '</b>' + ms.map(function (m) {
      var q = S.get('people', m.id), hs = householdNames(q);
      return '<span style="display:block;margin-top:6px"><a href="#/people/p/' + q.id + '" data-act="hub:close">' + esc(H.name(q)) + '</a>' + (hs.length ? ' · ' + esc(hs[0]) : '') + ' <span class="muted small">(' + esc(m.reasons.join(', ')) + ')</span></span>';
    }).join('') +
      (stop ? (canDup() ? '<label class="check" style="margin-top:8px"><input type="checkbox" id="pf-dup-ok"' + (was ? ' checked' : '') + '><span>' + T('I’ve checked: this is a different person') + '</span></label>'
        : '<span style="display:block;margin-top:6px">' + T('To avoid duplicates this can’t be saved. If it really is a different person, ask an Administrator.') + '</span>') : '');
  }

  /** Households page: couples with an anniversary to copy, a marital status to record, or anniversaries that differ. */
  function couplesPanel(only) {
    var list = couplesToCheck().filter(function (c) { return !only || only.indexOf(c.familyId) >= 0; }); if (!list.length) return '';
    return '<section class="panel" id="couples" style="margin-bottom:16px"><h2 style="margin:0 0 4px">' + T('Couples to confirm') + '</h2>' +
      '<p class="hint" style="margin:0 0 10px">' + T('Worked out from who lives together, their marital status, surname, age and anniversary. Confirming fills in a missing marital status and copies a spouse’s wedding anniversary (partners don’t get one). Nothing changes until you say yes.') + '</p>' +
      '<div class="list">' + list.map(function (c) {
        var t = coupleTodo(c), a = S.get('people', c.a), b = S.get('people', c.b);
        return '<div class="item" style="align-items:flex-start;flex-wrap:wrap;gap:8px"><span class="grow" style="min-width:220px"><b><a href="#/people/p/' + a.id + '">' + esc(H.name(a)) + '</a> & <a href="#/people/p/' + b.id + '">' + esc(H.name(b)) + '</a></b>' +
          '<small>' + esc(coupleWord(c)) + '. ' + t.lines.join(' ') + '</small></span>' +
          '<span class="btns">' + t.fix + '<button class="btn small" data-act="people:notcouple" data-a="' + c.a + '" data-b="' + c.b + '" data-f="' + c.familyId + '">' + T('Not a couple') + '</button></span></div>';
      }).join('') + '</div></section>';
  }

  /* ---------- edit dialogs ---------- */
  /* ---------- advanced search (like Elvanto's People → Advanced Search); rules in js/people-search.js ---------- */
  var PS = PeopleSearch;
  function emptyAdv() { return { match: 'all', logic: '', filters: [{ field: 'name', op: 'has', value: '' }], cols: ['household', 'mobile', 'email', 'category'], ran: false, sort: 'name', dir: 1 }; }
  function servingInfo() {
    var pos = {}, teams = {}, out = {}, t = H.today();
    S.list('teams').forEach(function (x) { teams[x.id] = x.name; });
    S.list('positions').forEach(function (x) { pos[x.id] = x; });
    var o = function (id) { return out[id] || (out[id] = { pos: [], teams: [], last: '', next: '' }); };
    S.list('skills').forEach(function (k) {
      var x = pos[k.positionId]; if (!x) return; var r = o(k.personId);
      if (r.pos.indexOf(x.name) < 0) r.pos.push(x.name);
      if (teams[x.teamId] && r.teams.indexOf(teams[x.teamId]) < 0) r.teams.push(teams[x.teamId]);
    });
    S.list('assignments').forEach(function (a) {
      var sv = a.status === 'declined' ? null : S.get('services', a.serviceId); if (!sv) return; var r = o(a.personId);
      if (sv.date <= t) { if (sv.date > r.last) r.last = sv.date; } else if (!r.next || sv.date < r.next) r.next = sv.date;
    });
    return out;
  }
  function keyDate(p, re) { var k = (p.keyDates || []).filter(function (x) { return re.test(x.label || ''); })[0]; return k ? k.date : ''; }
  function uniq(a) { return a.filter(function (x, i) { return x && a.indexOf(x) === i; }).sort(function (x, y) { return String(x).localeCompare(String(y)); }); }
  /** What this person may search on, and how to read it. Only what their role may see – never medical or pastoral notes. */
  function searchFields() {
    var all = canSeeAll(), roster = H.can('*') || H.can('rosters.view'), kids = canChildren(), birth = all || H.can('children');
    var serve = roster ? servingInfo() : {}, sv = function (p) { return serve[p.id] || { pos: [], teams: [], last: '', next: '' }; };
    var F = [], add = function (ok, group, key, label, type, get, options, alts) { if (ok) F.push({ group: T(group), key: key, label: T(label), en: label, type: type, get: get, options: options, alts: alts }); };
    add(true, TX('Name and contact'), 'name', TX('Name'), 'text', function (p) { return H.name(p); }, null, function (p) { return H.names(p); });   // also finds Douglas when known as Doug
    add(true, TX('Name and contact'), 'firstName', TX('First name'), 'text', function (p) { return p.firstName; }, null, function (p) { return p.preferredName ? [p.preferredName] : []; });
    add(true, TX('Name and contact'), 'lastName', TX('Last name'), 'text', function (p) { return p.lastName; });
    add(true, TX('Name and contact'), 'preferredName', TX('Preferred name'), 'text', function (p) { return p.preferredName; });
    add(true, TX('Name and contact'), 'email', TX('Email'), 'text', function (p) { return p.email; });
    add(true, TX('Name and contact'), 'mobile', TX('Mobile'), 'text', function (p) { return p.mobile; });
    add(true, TX('Church'), 'household', TX('Household'), 'list', function (p) { return householdNames(p); }, uniq(S.list('families').map(function (f) { return H.familyName(f); })));
    add(true, TX('Church'), 'category', TX('Category'), 'choice', function (p) { return p.category; }, CATS);
    add(true, TX('Church'), 'adultChild', TX('Adult or child'), 'choice', function (p) { return p.familyRole === 'child' ? 'Child' : 'Adult'; }, ['Adult', 'Child']);
    add(true, TX('Church'), 'added', TX('Date added'), 'date', function (p) { return p.createdAt; });
    add(true, TX('Church'), 'fromElvanto', TX('Brought in from Elvanto'), 'yesno', function (p) { return p.source === 'elvanto'; });
    add(all, TX('Church'), 'status', TX('Status'), 'choice', function (p) { return p.deceasedAt ? 'Deceased' : p.active === false ? 'Left' : 'Active'; }, [TX('Active'), TX('Left'), TX('Deceased')]);
    add(all, TX('Church'), 'died', TX('Date of death'), 'date', function (p) { return p.deceasedAt; });
    add(all, TX('Church'), 'diedYear', TX('Year of death'), 'number', function (p) { return p.deceasedAt ? Number(p.deceasedAt.slice(0, 4)) : ''; });
    add(birth, TX('Personal'), 'birthDate', TX('Date of birth'), 'date', function (p) { return p.birthDate; });
    add(birth, TX('Personal'), 'birthday', TX('Birthday'), 'anniv', function (p) { return p.birthDate || p.birthDay; });
    add(birth, TX('Personal'), 'age', TX('Age'), 'number', function (p) { return age(p); });
    add(all, TX('Personal'), 'gender', TX('Gender'), 'choice', function (p) { return p.gender || ''; }, GENDERS);
    add(all, TX('Personal'), 'middleName', TX('Middle name'), 'text', function (p) { return p.middleName || ''; });
    add(all, TX('Name and contact'), 'town', TX('Town or city'), 'text', function (p) { return (p.address || {}).city || ''; });
    add(all, TX('Name and contact'), 'address', TX('Home address'), 'text', function (p) { return addressLines(p).join(', '); });
    add(all, TX('Church'), 'partnerSince', TX('Date accepted as Church Partner'), 'date', function (p) { return p.partnerSince || ''; });
    add(all, TX('Church'), 'partnerUpdated', TX('Partnership last updated'), 'date', function (p) { return p.partnerUpdated || ''; });
    add(all, TX('Personal'), 'marital', TX('Marital status'), 'choice', function (p) { return p.familyRole === 'child' ? '' : p.maritalStatus; }, MARITAL);
    add(all, TX('Personal'), 'wedding', TX('Wedding anniversary'), 'anniv', function (p) { return keyDate(p, /wedding/i); });
    add(roster, TX('Serving'), 'positions', TX('Serving position'), 'list', function (p) { return sv(p).pos; }, uniq(S.list('positions').map(function (x) { return x.name; })));
    add(roster, TX('Serving'), 'teams', TX('Serving team'), 'list', function (p) { return sv(p).teams; }, uniq(S.list('teams').map(function (x) { return x.name; })));
    add(roster, TX('Serving'), 'lastServed', TX('Last served'), 'date', function (p) { return sv(p).last; });
    add(roster, TX('Serving'), 'nextServing', TX('Next serving'), 'date', function (p) { return sv(p).next; });
    add(kids, TX('Children'), 'guardians', TX('Parents and guardians'), 'list', function (p) { return links(p.id).map(linkName); });
    add(kids, TX('Children'), 'consenter', TX('Has a parent or guardian who can give consent'), 'yesno', function (p) { return p.familyRole === 'child' && HS.consentAdults(p.id, S.list('guardians')).length > 0; });
    add(all, TX('Privacy'), 'consents', TX('Consent given for'), 'list', function (p) { return PURPOSES.filter(function (x) { return hasConsent(p.id, x); }); }, PURPOSES);
    add(all, TX('Privacy'), 'receive', TX('Would like to receive'), 'list', function (p) { return RECEIVE_P.filter(function (x) { return hasConsent(p.id, x); }); }, RECEIVE_P);
    add(all, TX('Privacy'), 'directory', TX('In the church directory'), 'yesno', function (p) { return hasConsent(p.id, 'Church directory'); });
    add(H.can('*'), TX('Privacy'), 'access', TX('App access'), 'choice', function (p) { return (H.ROLES[p.appRole || 'member'] || {}).label; }, Object.keys(H.ROLES).map(function (r) { return H.ROLES[r].label; }));
    add(all, TX('Staff'), 'staff', TX('Church staff member'), 'yesno', function (p) { return !!p.staff; });
    add(all, TX('Staff'), 'staffCategory', TX('Staff category'), 'text', function (p) { return p.staff ? p.staff.category : ''; });
    add(all, TX('Staff'), 'staffStart', TX('Started working'), 'date', function (p) { return p.staff ? p.staff.start : ''; });
    // Church office notes (Administrators and Pastors). Pastoral and medical notes are never searchable.
    var office = {}; if (H.can('*') || H.can('people.edit')) S.list('officeNotes').forEach(function (n) { (office[n.personId] = office[n.personId] || []).push(n.text); });
    add(H.can('*') || H.can('people.edit'), TX('Notes'), 'officeNotes', TX('Church office notes'), 'text', function (p) { return (office[p.id] || []).join(' · '); });
    add(roster, TX('Serving'), 'volunteer', TX('Volunteer'), 'yesno', function (p) { return sv(p).pos.length > 0; });
    add(roster, TX('Serving'), 'serviceTimes', TX('Volunteers at service'), 'list', function (p) { return serveInfoTimes(p.id); }, slotIds().map(slotName));
    add(roster, TX('Serving'), 'awaySoon', TX('Away in the next 8 weeks'), 'yesno', function (p) { return awaySoon(p.id); });
    add(all, TX('Personal'), 'lateSpouse', TX('Late spouse'), 'text', function (p) { var l = lateSpouse(p); return l ? H.name(l) : p.lateSpouseName || ''; });
    add(all, TX('Name and contact'), 'postcode', TX('Postcode'), 'text', function (p) { return (p.address || {}).postcode || ''; });
    add(all, TX('Name and contact'), 'province', TX('Province'), 'text', function (p) { return (p.address || {}).province || ''; });
    add(H.can('*'), TX('Church'), 'elvantoId', TX('Elvanto ID'), 'text', function (p) { return p.elvantoId || ''; });
    return F;
  }
  /** The services someone volunteers at, as 8am / 10am / 5pm (every service when not narrowed down). */
  function serveInfoTimes(pid) {
    var sk = S.find('skills', function (k) { return k.personId === pid; }); if (!sk.length) return [];
    return serveTimes(sk).map(slotName);
  }
  function awaySoon(pid) {
    var t = H.today(), end = LeaveCore.iso(LeaveCore.addDays(LeaveCore.parse(t), 56));
    return S.find('blockouts', function (b) { return b.personId === pid && (b.to || b.from) >= t && b.from <= end; }).length > 0 ||
      ((S.leave() || {}).requests || []).some(function (r) { return r.staffId === pid && r.status === 'Approved' && r.end >= t && r.start <= end; });
  }
  function advShow(f, v) {
    if (v == null || v === '' || (Array.isArray(v) && !v.length)) return '';
    if (Array.isArray(v)) return v.join(', ');
    if (f.type === 'yesno') return v ? T('Yes') : T('No');
    if (f.type === 'choice') return T(String(v));
    if (f.type === 'date') return H.fmt(String(v).slice(0, 10), true);
    if (f.type === 'anniv') { var m = PS.md(v); return m ? (+m.slice(3)) + ' ' + H.mon()[+m.slice(0, 2) - 1] : ''; }
    return String(v);
  }
  function advRun(F) {
    var A = state.adv, byKey = {}; F.forEach(function (f) { byKey[f.key] = f; });
    var usesStatus = A.filters.some(function (f) { return f.field === 'status' || f.field === 'died' || f.field === 'diedYear'; });
    var people = canSeeAll() ? S.find('people', function (p) { return !p.deletedAt && p.firstName !== 'Deleted'; }) : visiblePeople();
    if (!usesStatus) people = people.filter(function (p) { return p.active !== false; });
    var recs = people.map(function (p) { var v = {}, al = {}; F.forEach(function (f) { v[f.key] = f.get(p); if (f.alts) al[f.key] = f.alts(p); }); return { id: p.id, p: p, values: v, alts: al }; });
    var r = PS.run(recs, A, byKey, H.today());
    if (r.error) return r;
    var hit = {}; r.ids.forEach(function (id) { hit[id] = 1; });
    var rows = recs.filter(function (x) { return hit[x.id]; }), k = byKey[A.sort] ? A.sort : 'name';
    rows.sort(function (a, b) {
      if (k === 'name') return A.dir * SORTS[sortKey()].cmp(a.p, b.p);   // by first name, known as or surname (the switch above the results)
      var c = PS.compare(a.values[k], b.values[k]); if (!c) return SORTS[sortKey()].cmp(a.p, b.p);
      var ea = a.values[k] === '' || a.values[k] == null || (Array.isArray(a.values[k]) && !a.values[k].length), eb = b.values[k] === '' || b.values[k] == null || (Array.isArray(b.values[k]) && !b.values[k].length);
      return ea || eb ? c : A.dir * c;   // empty values stay at the bottom either way
    });
    return { rows: rows, byKey: byKey };
  }
  function valueBox(f, def, i) {
    var kind = PS.valueKind(def.type, f.op), ia = ' class="adv-v" data-i="' + i + '"';
    var one = function (k, v) {
      var lab = ' aria-label="' + esc(T(k === 'value2' ? 'Filter {n} second value' : 'Filter {n} value', { n: i + 1 })) + '"';
      if (def.options && (def.type === 'choice' || def.type === 'list')) return '<select' + ia + ' data-k="' + k + '"' + lab + '><option value="">' + T('Choose…') + '</option>' + def.options.map(function (o) { return '<option value="' + esc(o) + '"' + (String(v) === String(o) ? ' selected' : '') + '>' + esc(T(String(o))) + '</option>'; }).join('') + '</select>';
      var type = def.type === 'number' ? 'number' : def.type === 'date' || def.type === 'anniv' ? 'date' : 'text';
      return '<input type="' + type + '"' + ia + ' data-k="' + k + '"' + lab + ' value="' + esc(v || '') + '"' + (type === 'number' ? ' min="0" inputmode="numeric"' : '') + '>';
    };
    if (kind === 'none') return '<span class="adv-none muted small">' + T('No value needed') + '</span>';
    if (kind === 'two') return '<span class="adv-two">' + one('value', f.value) + '<span class="muted">' + T('and') + '</span>' + one('value2', f.value2) + '</span>';
    if (kind === 'month') return '<select' + ia + ' data-k="value" aria-label="' + esc(T('Month')) + '"><option value="">' + T('Choose a month…') + '</option>' + PS.MONTHS.map(function (m, j) { return '<option value="' + (j + 1) + '"' + (String(f.value) === String(j + 1) ? ' selected' : '') + '>' + esc(T(m)) + '</option>'; }).join('') + '</select>';
    if (kind === 'span') return '<span class="adv-two"><input type="number" min="0" inputmode="numeric"' + ia + ' data-k="value" aria-label="' + esc(T('How many')) + '" value="' + esc(f.value || '') + '">' +
      '<select' + ia + ' data-k="unit" aria-label="' + esc(T('Days, weeks, months or years')) + '">' + PS.UNITS.map(function (u) { return '<option value="' + u[0] + '"' + ((f.unit || 'days') === u[0] ? ' selected' : '') + '>' + esc(T(u[1])) + '</option>'; }).join('') + '</select></span>';
    return one('value', f.value);
  }
  function renderSearch() {
    var crumb = '<a class="crumb" href="#/people">' + H.icon(H.ICON.back, 16) + T('People') + '</a>';
    if (!canBasic()) return crumb + '<p class="empty">' + T('Advanced search isn’t available to you.') + '</p>';
    var A = state.adv, F = searchFields(), byKey = {}, groups = [];
    F.forEach(function (f) { byKey[f.key] = f; if (groups.indexOf(f.group) < 0) groups.push(f.group); });
    A.cols = A.cols.filter(function (k) { return byKey[k] && k !== 'name'; });
    var fieldSelect = function (f, i) {   // like Elvanto: open the list, then type part of a field's name ("marit") to narrow it down
      var cur = byKey[f.field];
      return '<span class="adv-fpick" data-i="' + i + '">' +
        '<button type="button" class="adv-fbtn" data-i="' + i + '" aria-haspopup="listbox" aria-expanded="false" aria-label="' + esc(T('Filter {n}: search on {field}', { n: i + 1, field: cur ? cur.label : T('nothing yet') })) + '">' +
          '<span>' + esc(cur ? cur.label : T('Choose a field…')) + '</span></button>' +
        '<span class="adv-fpop" hidden><input type="search" class="adv-ff" data-i="' + i + '" placeholder="' + esc(T('Type to find a field…')) + '" autocomplete="off" aria-label="' + esc(T('Type to find a field')) + '" aria-controls="adv-fl' + i + '">' +
          '<span class="adv-flist" id="adv-fl' + i + '" role="listbox">' + groups.map(function (g) {
            return '<span class="adv-fg" role="group" aria-label="' + esc(g) + '"><span class="adv-fgh">' + esc(g) + '</span>' + F.filter(function (x) { return x.group === g; }).map(function (x) {
              return '<button type="button" class="adv-fo' + (x.key === f.field ? ' on' : '') + '" role="option" aria-selected="' + (x.key === f.field) + '" data-i="' + i + '" data-key="' + x.key + '" data-text="' + esc(x.label) + '">' + esc(x.label) + '</button>';
            }).join('') + '</span>';
          }).join('') + '<span class="adv-fnone muted" hidden>' + T('No field matches') + '</span></span></span>' +
        '<select class="adv-field sr-only" data-i="' + i + '" tabindex="-1" aria-hidden="true">' + (cur ? '' : '<option value="">' + T('Choose…') + '</option>') + groups.map(function (g) {   // the same list, for the tests and screen readers
          return '<optgroup label="' + esc(g) + '">' + F.filter(function (x) { return x.group === g; }).map(function (x) { return '<option value="' + x.key + '"' + (x.key === f.field ? ' selected' : '') + '>' + esc(x.label) + '</option>'; }).join('') + '</optgroup>';
        }).join('') + '</select></span>';
    };
    var word = A.match === 'any' ? 'OR' : 'AND', logicNote = '';
    if (A.match === 'logic' && A.logic.trim()) { var pl = PS.parseLogic(A.logic, A.filters.length); if (!pl.error && pl.unused.length) logicNote = '<p class="hint">' + T('Not used in your logic: filter {list}.', { list: pl.unused.join(', ') }) + '</p>'; }
    var html = crumb + '<div class="page-head"><div><h1>' + T('Advanced search') + '</h1><p class="lead">' + T('Find people by any mix of details, as in Elvanto. You can only search on what your role may see.') + '</p></div></div>' +
      '<div id="adv"><section class="panel"><h2>' + T('Filters') + '</h2>' +
      '<label class="field" style="max-width:420px">' + T('Match') + '<select id="adv-match">' + [['all', TX('All of the following filters')], ['any', TX('Any of the following filters')], ['logic', TX('Advanced: your own logic')]].map(function (m) {
        return '<option value="' + m[0] + '"' + (A.match === m[0] ? ' selected' : '') + '>' + esc(T(m[1])) + '</option>'; }).join('') + '</select></label>' +
      (A.match === 'logic' ? '<label class="field">' + T('Your own logic') + '<input id="adv-logic" value="' + esc(A.logic) + '" placeholder="' + esc(T('e.g. (1 AND 2) OR (3 AND 4)')) + '" autocomplete="off"><small>' + T('Use the filter numbers with AND, OR, NOT and brackets. AND is worked out before OR, so use brackets to be clear.') + '</small></label>' + logicNote : '') +
      (A.filters.length ? '<div class="adv-rows">' + A.filters.map(function (f, i) {
        var def = byKey[f.field];
        var ops = def ? PS.opsFor(def.type) : [];
        return (i && A.match !== 'logic' ? '<div class="adv-join"><span>' + word + '</span></div>' : '') +
          '<div class="adv-row">' + (A.match === 'logic' ? '<span class="adv-n">' + (i + 1) + '.</span>' : '') + fieldSelect(f, i) +
          '<select class="adv-op" data-i="' + i + '" aria-label="' + esc(T('Filter {n}: how to compare', { n: i + 1 })) + '"' + (def ? '' : ' disabled') + '>' + ops.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === f.op ? ' selected' : '') + '>' + esc(T(o[1])) + '</option>'; }).join('') + '</select>' +
          (def ? valueBox(f, def, i) : '<span></span>') +
          '<span class="adv-btns"><button class="icon-btn ok" data-act="people:advadd" data-i="' + i + '" aria-label="' + esc(T('Add a filter after filter {n}', { n: i + 1 })) + '" title="' + esc(T('Add a filter')) + '">' + H.icon(H.ICON.plus, 18) + '</button>' +
          '<button class="icon-btn bad" data-act="people:advdel" data-i="' + i + '" aria-label="' + esc(T('Remove filter {n}', { n: i + 1 })) + '" title="' + esc(T('Remove this filter')) + '"><span aria-hidden="true" style="font-size:20px;line-height:1">−</span></button></span></div>';
      }).join('') + '</div>' : '<p class="muted">' + T('No filters: Search finds everyone.') + ' <button class="btn small" data-act="people:advadd" data-i="-1">' + H.icon(H.ICON.plus, 16) + T('Add a filter') + '</button></p>') +
      '</section>' +
      '<section class="panel"><h2>' + T('Columns to show') + '</h2><p class="hint" style="margin-top:0">' + T('Name always comes first. Use the arrows to change the order.') + '</p><div class="adv-cols">' +
      '<span class="adv-col fixed">' + T('Name') + '</span>' + A.cols.map(function (k, i) {
        return '<span class="adv-col">' + esc(byKey[k].label) +
          '<button class="icon-btn ghost" data-act="people:advcol" data-k="' + k + '" data-m="-1"' + (i ? '' : ' disabled') + ' aria-label="' + esc(T('Move {column} left', { column: byKey[k].label })) + '">‹</button>' +
          '<button class="icon-btn ghost" data-act="people:advcol" data-k="' + k + '" data-m="1"' + (i < A.cols.length - 1 ? '' : ' disabled') + ' aria-label="' + esc(T('Move {column} right', { column: byKey[k].label })) + '">›</button>' +
          '<button class="icon-btn ghost" data-act="people:advcol" data-k="' + k + '" data-m="0" aria-label="' + esc(T('Remove column {column}', { column: byKey[k].label })) + '">' + H.icon(H.ICON.x, 14) + '</button></span>';
      }).join('') + '</div>' +
      '<label class="field" style="max-width:320px;margin-top:12px">' + T('Add a column') + '<select id="adv-addcol"><option value="">' + T('Choose…') + '</option>' + groups.map(function (g) {
        return '<optgroup label="' + esc(g) + '">' + F.filter(function (x) { return x.group === g && x.key !== 'name' && A.cols.indexOf(x.key) < 0; }).map(function (x) { return '<option value="' + x.key + '">' + esc(x.label) + '</option>'; }).join('') + '</optgroup>';
      }).join('') + '</select></label></section>' +
      '<div class="btns" style="margin:4px 0 18px"><button class="btn primary" data-act="people:advrun">' + H.icon(H.ICON.search, 18) + T('Search') + '</button><button class="btn" data-act="people:advreset">' + T('Start again') + '</button></div></div>';
    if (!A.ran) return html;
    var r = advRun(F);
    if (r.error) return html + '<p class="note bad" role="alert" id="adv-result">' + esc(r.error) + '</p>';
    var cols = ['name'].concat(A.cols), what = A.filters.map(function (f, i) { return (A.match === 'logic' ? (i + 1) + '. ' : '') + PS.describe(f, byKey[f.field], function (v) { return advShow({ type: byKey[f.field].type === 'anniv' ? 'anniv' : byKey[f.field].type === 'date' ? 'date' : 'text' }, v); }); });
    var bulk = canBulk(), sel = A.sel || (A.sel = {}), ids = r.rows.map(function (x) { return x.id; });
    Object.keys(sel).forEach(function (id) { if (ids.indexOf(id) < 0) delete sel[id]; });   // only people in these results can stay ticked
    var nSel = Object.keys(sel).length;
    return html + '<section class="panel" id="adv-result">' + bulkUndoNote() + '<div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px"><h2 style="margin:0">' + TN('{n} person found', '{n} people found', r.rows.length) + '</h2>' +
      '<div class="btns">' + (bulk && r.rows.length ? '<button class="btn small' + (nSel ? ' primary' : '') + '" data-act="people:bulk"' + (nSel ? '' : ' disabled') + ' id="adv-bulk">' + (nSel ? T('Change {n} selected…', { n: nSel }) : T('Change selected…')) + '</button>' : '') +
      (r.rows.length ? '<button class="btn small" data-act="people:advcsv">' + H.icon(H.ICON.download, 16) + T('Download (CSV)') + '</button>' : '') + '</div></div>' +
      (r.rows.length > 1 ? '<div style="margin-top:8px">' + sortSwitch() + '</div>' : '') +
      '<p class="hint">' + (what.length ? esc(what.join(A.match === 'all' ? ' · ' + T('and') + ' ' : A.match === 'any' ? ' · ' + T('or') + ' ' : ' · ')) + (A.match === 'logic' ? ' · ' + esc(T('Logic: {logic}', { logic: A.logic })) : '') : T('Everyone')) +
      (A.filters.some(function (f) { return f.field === 'status' || f.field === 'died' || f.field === 'diedYear'; }) ? '' : ' · ' + T('people who have left or died are left out unless you search on Status')) + '</p>' +
      (r.rows.length ? '<div class="table-wrap"><table class="simple adv-table"><thead><tr>' +
        (bulk ? '<th class="sel"><input type="checkbox" id="adv-selall" aria-label="' + esc(T('Tick everyone found')) + '"' + (nSel && nSel === ids.length ? ' checked' : '') + '></th>' : '') + cols.map(function (k) {
        var on = (A.sort || 'name') === k;
        return '<th' + (on ? ' aria-sort="' + (A.dir > 0 ? 'ascending' : 'descending') + '"' : '') + '><button class="th-sort" data-act="people:advsort" data-k="' + k + '">' + esc(r.byKey[k].label) + (on ? (A.dir > 0 ? ' ▲' : ' ▼') : '') + '</button></th>';
      }).join('') + '</tr></thead><tbody>' + r.rows.map(function (x) {
        return '<tr>' + (bulk ? '<td class="sel"><input type="checkbox" class="adv-sel" value="' + x.id + '" aria-label="' + esc(T('Tick {name}', { name: H.name(x.p) })) + '"' + (sel[x.id] ? ' checked' : '') + '></td>' : '') + cols.map(function (k) { return k === 'name' ? '<td><a href="#/people/p/' + x.id + '">' + listName(x.p) + '</a></td>' : k === 'email' && x.values.email ? '<td><a href="mailto:' + esc(x.values.email) + '" target="_blank" rel="noopener">' + esc(x.values.email) + '</a></td>' : '<td>' + esc(advShow(r.byKey[k], x.values[k])) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table></div><p class="hint">' + T('Downloads hold personal information: keep them on church computers and delete them when you’re done ({law}).', { law: esc(PrivacyLaw.forChurch(S.settings()).short) }) + '</p>' : '<p class="empty">' + T('No one matches these filters.') + '</p>') + '</section>';
  }
  /* ---------- changing many people at once (Administrators): tick people in the results, then one field for all of them ---------- */
  function canBulk() { return H.can('*'); }
  /** What can be changed for many people at once. Things with their own steps (a death, sign-in access, households) can't. */
  /** What can be changed for many people at once. Each says which people it leaves alone (skip) and how it changes a person (set). */
  function bulkFields() {
    var dead = function (p) { return deceased(p) || p.category === 'Deceased'; };
    var plain = function (key) { return function (q, v) { if (v) q[key] = v; else delete q[key]; }; };
    return [
      { key: 'maritalStatus', label: TX('Marital status'), options: MARITAL, keys: ['maritalStatus'], set: plain('maritalStatus'),
        skip: function (p) { return p.familyRole === 'child' && TX('children'); }, note: TX('Children are left out: they have no marital status.') },
      { key: 'category', label: TX('Category'), options: CATS.filter(function (c) { return c !== 'Deceased'; }), keys: ['category'], set: plain('category'),
        skip: function (p) { return dead(p) && TX('people who have died'); } },
      { key: 'gender', label: TX('Gender'), options: GENDERS, blank: TX('Not recorded'), keys: ['gender'], set: plain('gender') },
      { key: 'partnerSince', label: TX('Date accepted as Church Partner'), date: true, keys: ['partnerSince'], set: plain('partnerSince') },
      { key: 'partnerUpdated', label: TX('Partnership last updated'), date: true, keys: ['partnerUpdated'], set: plain('partnerUpdated') },
      { key: 'email', label: TX('Email (where it’s missing)'), options: [TX('Unknown')], keys: ['emailUnknown'], set: function (q) { q.emailUnknown = true; },
        skip: function (p) { return p.email ? TX('already have an email address') : p.familyRole === 'child' ? TX('children') : ''; }, note: TX('Only for adults with no email address. Anyone who has one is left alone.') },
      { key: 'mobile', label: TX('Mobile (where it’s missing)'), options: [TX('Unknown')], keys: ['mobileUnknown'], set: function (q) { q.mobileUnknown = true; },
        skip: function (p) { return p.mobile ? TX('already have a mobile number') : p.familyRole === 'child' ? TX('children') : ''; }, note: TX('Only for adults with no mobile number. Anyone who has one is left alone.') },
      { key: 'household', label: TX('Household (where it’s missing)'), options: [TX('+ New household for each person')], keys: ['familyId'],
        skip: function (p) { return (p.familyId || (p.householdIds || []).length) ? TX('already in a household') : ''; },
        set: function (q, v, made) { var f = S.put('families', { name: q.lastName + ' family', custom: false }); made.push(f.id); q.familyId = f.id; if (!q.familyRole) q.familyRole = 'adult'; },
        note: TX('Each person with no household gets one of their own, named after their surname. People who live together can be moved into one household afterwards.') }
    ];
  }
  function bulkUndoNote() {
    var u = state.bulkUndo; if (!u) return '';
    var why = Object.keys(u.skipped || {}).map(function (k) { return u.skipped[k] + ' ' + T(k); });
    return '<div class="note ok" role="status" style="margin-bottom:12px">' + TN('Changed {field} to {value} for {n} person', 'Changed {field} to {value} for {n} people', u.items.length, { field: '<b>' + esc(T(u.label)) + '</b>', value: '<b>' + esc(u.value ? T(u.value) : T('nothing')) + '</b>' }) +
      (why.length ? ' (' + esc(T('left out: {who}', { who: why.join(', ') })) + ')' : '') + '. <button class="link" data-act="people:bulkundo">' + T('Undo') + '</button></div>';
  }
  function bulkDialog() {
    var ids = Object.keys(state.adv.sel || {}), F = bulkFields(), f = F[0];
    if (!ids.length) return;
    var valueBox = function (fd) {
      return fd.date ? '<input type="date" id="bk-v" max="' + H.today() + '">' :
        '<select id="bk-v">' + (fd.blank ? '<option value="">' + esc(T(fd.blank)) + '</option>' : '<option value="">' + T('Choose…') + '</option>') + fd.options.map(function (o) { return '<option value="' + esc(o) + '">' + esc(T(o)) + '</option>'; }).join('') + '</select>';
    };
    H.modal(H.dialogHead(TN('Change {n} person', 'Change {n} people', ids.length), T('The same change for everyone you ticked. You can undo it straight after.')) + '<div class="dlg-body">' +
      '<div class="two"><label class="field req">' + T('What to change') + '<select id="bk-f">' + F.map(function (x) { return '<option value="' + x.key + '">' + esc(T(x.label)) + '</option>'; }).join('') + '</select></label>' +
      '<label class="field req" id="bk-v-f">' + T('New value') + valueBox(f) + '</label></div>' +
      '<p class="hint" id="bk-note">' + esc(f.note ? T(f.note) : '') + '</p>' +
      '<details><summary class="small">' + T('Who will change ({n})', { n: ids.length }) + '</summary><p class="small muted" style="margin:6px 0 0">' + esc(ids.map(function (id) { return H.name(S.get('people', id)); }).join(', ')) + '</p></details>' +
      '<p id="bk-err" class="note bad" hidden></p></div>' +
      '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn primary" data-act="people:bulksave">' + TN('Change {n} person', 'Change {n} people', ids.length) + '</button></div>', T('Change many people'));
    var fs = document.getElementById('bk-f');
    fs.addEventListener('change', function () {
      var fd = F.filter(function (x) { return x.key === fs.value; })[0], box = document.getElementById('bk-v-f');
      box.innerHTML = T('New value') + valueBox(fd); box.classList.toggle('req', !fd.blank);
      document.getElementById('bk-note').textContent = fd.note ? T(fd.note) : '';
      H.markRequired();
    });
    H.markRequired();
  }
  function advCsv() {
    var F = searchFields(), r = advRun(F); if (r.error) return;
    var cols = ['name'].concat(state.adv.cols);
    var raw = function (f, v) { if (Array.isArray(v)) return v.join('; '); if (f.type === 'yesno') return v ? 'Yes' : 'No'; if (f.type === 'date') return String(v || '').slice(0, 10); if (f.type === 'anniv') return advShow(f, v); return v == null ? '' : v; };
    var rows = [cols.map(function (k) { return r.byKey[k].en || r.byKey[k].label; })].concat(r.rows.map(function (x) { return cols.map(function (k) { return k === 'name' ? H.name(x.p) : raw(r.byKey[k], x.values[k]); }); }));
    var text = rows.map(function (row) { return row.map(function (v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','); }).join('\r\n');
    S.audit('Downloaded an advanced search: ' + r.rows.length + ' people (' + cols.map(function (k) { return r.byKey[k].en || r.byKey[k].label; }).join(', ') + ')', 'people');
    H.download('people-search-' + H.today() + '.csv', text, 'text/csv');
  }
  var fieldDocHooked = false;
  function fieldClose() {
    document.querySelectorAll('.adv-fpop').forEach(function (p) { p.hidden = true; });
    document.querySelectorAll('.adv-fbtn').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
  }
  function fieldActive(pop, o) {
    pop.querySelectorAll('.adv-fo.act').forEach(function (x) { x.classList.remove('act'); });
    if (o) { o.classList.add('act'); try { o.scrollIntoView({ block: 'nearest' }); } catch (e) {} }
  }
  function fieldOpen(b) {   // returns the box to type in
    var pick = b.closest('.adv-fpick'), pop = pick.querySelector('.adv-fpop'), inp = pop.querySelector('.adv-ff');
    pop.hidden = false; b.setAttribute('aria-expanded', 'true'); inp.value = ''; fieldFilter(inp);
    fieldActive(pop, pop.querySelector('.adv-fo.on') || pop.querySelector('.adv-fo')); inp.focus();
    return inp;
  }
  function fieldFilter(inp) {   // narrow the list to the fields whose name has every word typed, even part-words
    var pop = inp.closest('.adv-fpop'), q = inp.value.trim(), first = null;
    pop.querySelectorAll('.adv-fg').forEach(function (g) {
      var any = false;
      g.querySelectorAll('.adv-fo').forEach(function (o) { var ok = !q || H.matches(o.dataset.text, q); o.hidden = !ok; if (ok) { any = true; if (!first) first = o; } });
      g.hidden = !any;
    });
    pop.querySelector('.adv-fnone').hidden = !!first;
    fieldActive(pop, q ? first : pop.querySelector('.adv-fo.on') || first);
  }
  function fieldPick(o) {
    var i = o.dataset.i, sel = document.querySelector('.adv-field[data-i="' + i + '"]'); if (!sel) return;
    fieldClose();
    if (sel.value !== o.dataset.key) { sel.value = o.dataset.key; advSync(sel); H.render(); }
    var b = document.querySelector('.adv-fbtn[data-i="' + i + '"]'); if (b) b.focus();
  }
  function advSync(el) {   // keep what is typed in the state, so a refresh never loses it
    var A = state.adv, i = +el.dataset.i, f = A.filters[i];
    if (el.classList.contains('adv-v') && f) { f[el.dataset.k] = el.value; return false; }
    if (el.classList.contains('adv-field') && f) { f.field = el.value; var d = searchFields().filter(function (x) { return x.key === el.value; })[0]; f.op = d ? (d.type === 'text' ? 'has' : PS.opsFor(d.type)[0][0]) : ''; /* text: "contains" is what people expect */ f.value = f.value2 = ''; f.unit = 'days'; return true; }
    if (el.classList.contains('adv-op') && f) { var k1 = PS.valueKind('', f.op); f.op = el.value; if (PS.valueKind('', f.op) !== k1) { f.value = f.value2 = ''; } f.unit = f.unit || 'days'; return true; }
    if (el.id === 'adv-match') { A.match = el.value; return true; }
    if (el.id === 'adv-logic') { A.logic = el.value; return false; }
    if (el.id === 'adv-addcol' && el.value) { A.cols.push(el.value); return true; }
    return false;
  }

  function editDialog(p) {
    var isNew = !p; p = p || { firstName: '', lastName: '', preferredName: '', email: '', mobile: '', birthDate: '', category: '', familyId: '', familyRole: '', appRole: Store.defaultRole() };
    var admin = H.can('*'), me = isMe(p);
    var fams = S.list('families');
    var html = H.dialogHead(isNew ? T('Add a person') : T('Edit {name}', { name: H.name(p) }), isNew ? T('Only add what the church needs. Ask for consent when you add someone.') : '') +
      '<form id="pf" class="dlg-body" novalidate><input type="hidden" id="pf-id" value="' + esc(p.id || '') + '">' +
      '<div class="two"><label class="field req">' + T('First name') + '<input id="pf-first" required value="' + esc(p.firstName) + '" autocomplete="given-name"></label>' +
      '<label class="field req">' + T('Last name') + '<input id="pf-last" required value="' + esc(p.lastName) + '" autocomplete="family-name"></label></div>' +
      '<div id="pf-dup" class="note warn" role="status" aria-live="polite" hidden style="margin:0 0 12px"></div>' +
      '<div class="two"><label class="field">' + T('Known as') + '<input id="pf-pref" value="' + esc(p.preferredName || '') + '"></label>' +
      (!me || admin ? '<label class="field">' + T('Middle name') + '<input id="pf-middle" value="' + esc(p.middleName || '') + '" autocomplete="additional-name"></label>' : '') + '</div>' +
      '<div class="two"><label class="field' + (p.familyRole === 'child' ? '' : ' req') + '" id="pf-email-f">' + T('Email') + '<input id="pf-email" type="email" value="' + esc(p.email || (p.emailUnknown ? T('unknown') : '')) + '" autocomplete="email" placeholder="' + esc(T('Type “{word}” if not known', { word: T('unknown') })) + '"></label>' +
      '<label class="field' + (p.familyRole === 'child' ? '' : ' req') + '" id="pf-mobile-f">' + T('Mobile') + '<input id="pf-mobile" type="tel" value="' + esc(p.mobile || (p.mobileUnknown ? T('unknown') : '')) + '" autocomplete="tel" placeholder="' + esc(T('Type “{word}” if not known', { word: T('unknown') })) + '"></label></div>' +
      (!me || admin ? '<div class="two"><label class="field">' + T('Birthday') + '<input id="pf-birth" type="date" max="' + H.today() + '" value="' + esc(p.birthDate || '') + '"><small id="pf-birth-n" class="live-n" aria-live="polite"></small></label>' +
        '<label class="field req">' + T('Category') + '<select id="pf-cat">' + (p.category ? '' : '<option value="" selected>' + T('Choose…') + '</option>') + CATS.map(function (c) { return '<option value="' + esc(c) + '"' + (p.category === c ? ' selected' : '') + '>' + esc(T(c)) + '</option>'; }).join('') + '</select></label></div>' +
        '<div class="two" id="pf-partner-f"' + (p.category === 'Church Partner' ? '' : ' hidden') + '><label class="field">' + T('Date accepted as Church Partner') + '<input id="pf-psince" type="date" max="' + H.today() + '" value="' + esc(p.partnerSince || '') + '"></label>' +
        '<label class="field">' + T('Partnership last updated') + '<input id="pf-pupd" type="date" max="' + H.today() + '" value="' + esc(/^\d{4}$/.test(p.partnerUpdated || '') ? '' : p.partnerUpdated || '') + '">' +
          (/^\d{4}$/.test(p.partnerUpdated || '') ? '<small>' + esc(T('Elvanto only says {year}. Leave empty to keep that, or choose the date.', { year: p.partnerUpdated })) + '</small>' : '') + '</label></div>' +
        '<label class="field">' + T('Gender') + '<select id="pf-gender"><option value="">' + T('Not recorded') + '</option>' + GENDERS.map(function (g) { return '<option value="' + g + '"' + (p.gender === g ? ' selected' : '') + '>' + esc(T(g)) + '</option>'; }).join('') + '</select></label>' +
        '<div class="two"><label class="field req" id="pf-fam-f">' + T('Household') + '<select class="findable" id="pf-fam"><option value="">' + T('Choose…') + '</option><option value="__new">' + T('+ New household…') + '</option>' + fams.slice().sort(function (a, b) { return H.familyName(a).localeCompare(H.familyName(b)); }).map(function (f) { return '<option value="' + f.id + '"' + (p.familyId === f.id ? ' selected' : '') + '>' + esc(H.familyName(f)) + '</option>'; }).join('') + '</select></label>' +
        '<label class="field req">' + T('In the household as') + '<select id="pf-frole">' + (p.familyRole ? '' : '<option value="" selected>' + T('Choose…') + '</option>') + '<option value="adult"' + (p.familyRole === 'adult' ? ' selected' : '') + '>' + T('Adult') + '</option><option value="child"' + (p.familyRole === 'child' ? ' selected' : '') + '>' + T('Child (under 18)') + '</option></select></label></div>' +
        '<label class="field req" id="pf-marital-f"' + (p.familyRole === 'child' ? ' hidden' : '') + '>' + T('Marital status') + '<select id="pf-marital"><option value="">' + T('Choose…') + '</option>' + MARITAL.map(function (m) { return '<option value="' + m + '"' + (p.maritalStatus === m ? ' selected' : '') + '>' + esc(T(m)) + '</option>'; }).join('') + '</select><small>' + T('For pastoral care. Choose “Not known” if you don’t know.') + '</small></label>' +
        (admin ? lateSpouseField(p) : '') +
        (!isNew && canRecordDeath() && (deceased(p) || p.category === 'Deceased') ? '<div class="two"><label class="field req">' + T('Date of death') + '<input type="date" id="pf-died" max="' + H.today() + '" value="' + esc(p.deceasedAt || '') + '"></label>' +
          '<label class="field">' + T('Funeral or memorial') + '<input type="date" id="pf-funeral" value="' + esc(keyDate(p, /^funeral$/i)) + '"></label></div>' : '') +
        '<fieldset class="panel" style="padding:10px 12px;margin:6px 0 14px"><legend class="field-l" style="padding:0 4px">' + T('Home address') + '</legend>' +
          '<label class="field">' + T('Street address') + '<input id="pf-street" value="' + esc((p.address || {}).street || '') + '" autocomplete="address-line1"></label>' +
          '<label class="field">' + T('Address line 2') + '<input id="pf-street2" value="' + esc((p.address || {}).street2 || '') + '" autocomplete="address-line2"></label>' +
          '<div class="two"><label class="field">' + T('Town or city') + '<input id="pf-city" value="' + esc((p.address || {}).city || '') + '" autocomplete="address-level2"></label>' +
          (function (a) {
            var c = a.country ? Countries.find(a.country) : Countries.church(S.settings());
            return '<label class="field"><span id="pf-postcode-l">' + T(c ? c.postcodeLabel : 'Postal code') + '</span><input id="pf-postcode" value="' + esc(a.postcode || '') + '" autocomplete="postal-code"></label></div>' +
              '<div class="two"><label class="field"><span id="pf-region-l">' + T(c ? c.regionLabel : 'Province, state or region') + '</span><span id="pf-region-w">' + regionControl(c, a.province || '') + '</span></label>' +
              '<label class="field">' + T('Country') + countrySelect(a.country || '') + '</label></div></fieldset>';
          })(p.address || {}) +
        '<label class="field" id="pf-wed-f"' + (p.familyRole === 'child' ? ' hidden' : '') + '>' + T('Wedding anniversary') + '<input id="pf-wed" type="date" max="' + H.today() + '" value="' + esc(keyDate(p, WEDDING)) + '"><small id="pf-wed-n" class="live-n" aria-live="polite"></small></label>' : '') +
      (admin ? staffFields(p) : '') + (window.CareUI ? CareUI.fields(p) : '') +
      (admin ? '<label class="field">' + T('App access') + '<select id="pf-role">' + Object.keys(H.ROLES).map(function (r) { return '<option value="' + r + '"' + (p.appRole === r ? ' selected' : '') + '>' + esc(T(H.ROLES[r].label)) + '</option>'; }).join('') + '</select><small>' + T('What they can see and do in Church Hub.') + (Store.isLive() ? ' ' + T('They sign in with Google or an email link using the email address above.') : '') + '</small></label>' : '') +
      '<p id="pf-err" class="note bad" hidden></p></form>' +
      '<div class="dlg-foot">' + (!isNew && admin ? '<button class="btn" style="margin-right:auto" data-act="people:archive" data-id="' + p.id + '">' + T('Mark as left') + '</button>' : '') +
      '<button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn primary" data-act="people:save">' + T(isNew ? 'Add person' : 'Save') + '</button></div>';
    H.modal(html, T(isNew ? 'Add a person' : 'Edit details'));
    if (!isNew && (deceased(p) || p.category === 'Deceased')) {   // someone who has died: only first and last name must be filled in
      document.querySelectorAll('#pf .field.req').forEach(function (f) { if (!f.querySelector('#pf-first, #pf-last, #pf-died')) f.classList.remove('req'); });
      H.markRequired();
    }
    var dupT = null;
    ['pf-first', 'pf-last', 'pf-pref', 'pf-email', 'pf-mobile', 'pf-birth', 'pf-frole'].forEach(function (id) {
      var e = document.getElementById(id); if (e) e.addEventListener(e.tagName === 'SELECT' || e.type === 'date' ? 'change' : 'input', function () { clearTimeout(dupT); dupT = setTimeout(dupWarn, 250); });
    });
    if (p.id) dupWarn();
    var sb = document.getElementById('pf-staff'), sf = document.getElementById('pf-staff-f');
    if (sb && sf) sb.addEventListener('change', function () { sf.hidden = !sb.checked; });
    var sameBox = document.getElementById('pf-sw-same');
    if (sameBox) sameBox.addEventListener('change', function () { document.getElementById('pf-sw-days').hidden = sameBox.checked; });
    wireCountry(); if (window.CareUI) CareUI.wireFields();
    var pc = document.getElementById('pf-cat'), pcf = document.getElementById('pf-partner-f');
    if (pc && pcf) pc.addEventListener('change', function () { pcf.hidden = pc.value !== 'Church Partner'; });
    var lt = document.getElementById('pf-late'), ltf = document.getElementById('pf-late-f'), mar = document.getElementById('pf-marital');
    if (lt) lt.addEventListener('change', function () { document.getElementById('pf-late-n-f').hidden = lt.value !== '__out'; });
    if (mar && ltf) mar.addEventListener('change', function () { if (mar.value === 'Widowed') ltf.hidden = false; });
    var fr = document.getElementById('pf-frole'), mf = document.getElementById('pf-marital-f');
    var wf = document.getElementById('pf-wed-f'), ff = document.getElementById('pf-fam-f');
    if (fr && mf) fr.addEventListener('change', function () { mf.hidden = fr.value === 'child'; if (wf) wf.hidden = fr.value === 'child'; 
      ['pf-email-f', 'pf-mobile-f'].forEach(function (id) { var x = document.getElementById(id); if (x) x.classList.toggle('req', fr.value !== 'child'); });
      H.markRequired(); });
    // Age and years married, worked out as the dates are typed
    var bi = document.getElementById('pf-birth'), wi = document.getElementById('pf-wed'), mi = document.getElementById('pf-marital');
    var live = function () {
      var bn = document.getElementById('pf-birth-n'), wn = document.getElementById('pf-wed-n');
      if (bn && bi) { var a = yearsSince(bi.value); bn.textContent = a === '' ? '' : T('Age {n}', { n: a }); }
      if (wn && wi) { var y = yearsSince(wi.value); var ms = mi && mi.value && mi.value !== 'Married' ? ' (' + T('marital status: {status}', { status: T(mi.value) }) + ')' : '';
        wn.textContent = y === '' ? T('The date they married.') : (y < 1 ? T('Married less than a year') : TN('Married {n} year', 'Married {n} years', y)) + ms; }
    };
    [bi, wi, mi].forEach(function (x) { if (x) { x.addEventListener('input', live); x.addEventListener('change', live); } });
    live();
  }

  /** Administrators: who a widow or widower was married to – someone in Church Hub who has died, or a name. */
  function lateSpouseField(p) {
    var cur = lateSpouse(p), show = p.familyRole !== 'child' && (p.maritalStatus === 'Widowed' || cur || p.lateSpouseName);
    var dead = S.find('people', function (x) { return x.id !== p.id && x.familyRole !== 'child' && !x.mergedInto && (deceased(x) || x.category === 'Deceased'); })
      .sort(function (a, b) { return (a.lastName + a.firstName).localeCompare(b.lastName + b.firstName); });
    if (cur && dead.indexOf(cur) < 0) dead.unshift(cur);
    var sel = cur ? cur.id : p.lateSpouseName ? '__out' : '';
    return '<div id="pf-late-f"' + (show ? '' : ' hidden') + '><label class="field">' + T('Late spouse') + '<select class="findable" id="pf-late"><option value="">' + T('Nobody recorded') + '</option>' +
      dead.map(function (x) { return '<option value="' + x.id + '"' + (sel === x.id ? ' selected' : '') + '>' + esc(x.lastName + ', ' + (x.preferredName || x.firstName)) + (x.deceasedAt ? ' (' + esc(T('died {date}', { date: H.fmt(x.deceasedAt, true) })) + ')' : '') + '</option>'; }).join('') +
      '<option value="__out"' + (sel === '__out' ? ' selected' : '') + '>' + T('Someone not in Church Hub…') + '</option></select><small>' + T('Who they were married to. Shown on their record as “Was married to …”.') + '</small></label>' +
      '<label class="field" id="pf-late-n-f"' + (sel === '__out' ? '' : ' hidden') + '>' + T('Their name') + '<input id="pf-late-n" value="' + esc(p.lateSpouseName || '') + '"></label></div>';
  }

  /** Staff details for Leave (Administrators only): category (sets allowances and working days), start date (pro-rata), own working days. */
  function staffFields(p) {
    var lv = S.leave() || { levels: [] }, st = p.staff || {}, DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    var mine = st.workDays ? st.workDays.split(/\s*,\s*/) : [];
    return '<fieldset class="panel" style="padding:12px 14px;margin:6px 0 14px"><label class="check" style="margin:0"><input type="checkbox" id="pf-staff"' + (p.staff ? ' checked' : '') + '><span><b>' + T('Church staff member') + '</b><br><span class="muted small">' + T('Shows them in Leave, with the allowances of their staff category.') + '</span></span></label>' +
      '<div id="pf-staff-f"' + (p.staff ? '' : ' hidden') + ' style="margin-top:10px"><div class="two"><label class="field req">' + T('Staff category') + '<select id="pf-scat"><option value="">' + T('Choose…') + '</option>' +
      lv.levels.map(function (l) { return '<option value="' + esc(l.level) + '"' + (st.category === l.level ? ' selected' : '') + '>' + esc(l.label || l.level) + '</option>'; }).join('') + '</select><small>' + T('Change categories under Leave → Settings.') + '</small></label>' +
      '<label class="field req">' + T('Started at the church') + '<input type="date" id="pf-sstart" value="' + esc(st.start || '') + '"><small>' + T('Used to work out a first year’s allowance.') + '</small></label></div>' +
      '<label class="check"><input type="checkbox" id="pf-sw-same"' + (mine.length ? '' : ' checked') + '><span>' + T('Works the same days as their category') + '</span></label>' +
      '<div id="pf-sw-days" class="row" style="flex-wrap:wrap;gap:4px 14px"' + (mine.length ? '' : ' hidden') + '>' + DAYS.map(function (d) {
        return '<label class="check" style="margin:0"><input type="checkbox" class="pf-sw" value="' + d + '"' + (mine.indexOf(d) >= 0 ? ' checked' : '') + '><span>' + esc(T(d)) + '</span></label>';
      }).join('') + '</div></div></fieldset>';
  }

  function consentDialog(p) {
    var child = p.familyRole === 'child', me = isMe(p);
    var guardians = child ? HS.consentAdults(p.id, S.list('guardians')).map(function (l) { return S.get('people', l.adultId); }).filter(Boolean) : [];
    if (child && !me && !guardians.length) {
      H.modal(H.dialogHead(T('Consent for {name}', { name: H.name(p) })) + '<div class="dlg-body"><p class="note warn" style="margin:0">' + esc(T('No parent or guardian who can give consent is recorded for {name}. Under {law} a parent or legal guardian gives consent for a child.', { name: p.firstName, law: PrivacyLaw.forChurch(S.settings()).short })) + '</p><p>' + T('Add them under {section} on the profile of {name}, then record consent.', { section: '<b>' + T('Parents, guardians and collection') + '</b>', name: esc(p.firstName) }) + '</p></div><div class="dlg-foot"><button class="btn primary" data-act="hub:close">' + T('OK') + '</button></div>', T('Consent'));
      return;
    }
    var purposes = PURPOSES.filter(function (x) { return child ? (x === 'Church records' || x === 'Photos' || x === 'Children’s medical notes') : x !== 'Children’s medical notes'; });
    H.modal(H.dialogHead(me ? T('My privacy choices') : T('Consent for {name}', { name: H.name(p) }), T(me ? 'Tick what you agree to. Unticking withdraws consent from today.' : 'Tick what they agree to. Unticking withdraws consent from today.')) +
      '<div class="dlg-body">' + purposes.map(function (pur, i) {
        return '<label class="check"><input type="checkbox" class="cf-p" data-p="' + esc(pur) + '"' + (hasConsent(p.id, pur) ? ' checked' : '') + '><span><b>' + esc(T(pur)) + '</b><br><span class="muted small">' + esc(T({
          'Church records': 'Keep their details on the church database.', 'Email': 'Church news and information by email.', 'SMS': 'Reminders and urgent news by SMS.',
          'Church directory': 'Name and phone visible to other members.', 'Care group': 'Photo, phone, email, address and birthday shared with my care group.', 'Photos': 'Photos at church events may be shared.', 'Children’s medical notes': 'Allergies and medical notes kept for safety at children’s church.' }[pur])) + '</span></span></label>';
      }).join('') +
      (child ? '' : '<p class="field-l" style="margin:14px 0 4px">' + T('Would like to receive') + '</p>' + RECEIVE.map(function (r) {
        return '<label class="check"><input type="checkbox" class="cf-p" data-p="' + esc(r[0]) + '"' + (hasConsent(p.id, r[0]) ? ' checked' : '') + '><span><b>' + esc(T(r[0])) + '</b><br><span class="muted small">' + esc(T(r[1])) + '</span></span></label>';
      }).join('')) +
      (!me ? '<div class="two" style="margin-top:8px"><label class="field">' + T('How it was given') + '<select id="cf-method">' + ['Paper connect card', 'Online form', 'In person (verbal)', 'Email'].map(function (m) { return '<option value="' + m + '">' + esc(T(m)) + '</option>'; }).join('') + '</select></label>' +
        (child ? '<label class="field req">' + T('Given by (parent or guardian)') + '<select id="cf-guardian">' + guardians.map(function (g) { return '<option value="' + g.id + '">' + esc(H.name(g)) + '</option>'; }).join('') + '</select></label>' : '') + '</div>' : '') +
      '<p class="hint">' + esc(Store.settings().privacyNotice) + '</p></div>' +
      '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn primary" data-act="people:saveconsent" data-id="' + p.id + '">' + T('Save') + '</button></div>', T('Consent'));
  }

  /** After a death (Administrators): off future rosters, teams, serving groups and away dates; future leave cancelled;
   *  sign-in removed (app access set to none). Past serving and leave stay, for the church's records. */
  /** After a death: is anything still to undo (future turns, teams, offers, groups, leave, links to children, sign-in)?
   *  People who died before they came into Church Hub (e.g. from Elvanto) usually have nothing, so they aren't a to-do. */
  function needsTidy(p) {
    if (!p || !deceased(p) || p.deathTidied) return false;
    var id = p.id, d = p.deceasedAt || H.today(), lv = S.leave();
    return (p.appRole && p.appRole !== 'none') ||
      S.find('assignments', function (a) { var s = S.get('services', a.serviceId); return a.personId === id && (!s || s.date >= d); }).length > 0 ||
      S.find('skills', function (k) { return k.personId === id; }).length > 0 || S.find('serveOffers', function (o) { return o.personId === id; }).length > 0 ||
      S.find('blockouts', function (b) { return b.personId === id && b.to >= d; }).length > 0 || S.find('groups', function (g) { return g.memberIds.indexOf(id) >= 0; }).length > 0 ||
      S.find('guardians', function (l) { return l.adultId === id; }).length > 0 || S.find('noCollect', function (x) { return x.personId === id; }).length > 0 ||
      !!(lv && lv.requests.some(function (r) { return r.staffId === id && r.end >= d && (r.status === 'Pending' || r.status === 'Approved') && !r.synthetic; }));
  }
  function tidyDeath(id) {
    var p = S.get('people', id); if (!p) return;
    var d = p.deceasedAt || H.today(), n = 0;
    if (window.CareUI) CareUI.place(p, '', false, 'After a death: ');
    S.find('assignments', function (a) { var s = S.get('services', a.serviceId); return a.personId === id && (!s || s.date >= d); }).forEach(function (a) { S.remove('assignments', a.id); n++; });
    S.find('skills', function (k) { return k.personId === id; }).forEach(function (k) { S.remove('skills', k.id); });
    S.find('serveOffers', function (o) { return o.personId === id; }).forEach(function (o) { S.remove('serveOffers', o.id); });
    S.find('blockouts', function (b) { return b.personId === id && b.to >= d; }).forEach(function (b) { S.remove('blockouts', b.id); });
    S.list('groups').slice().forEach(function (g) {
      if (g.memberIds.indexOf(id) < 0) return;
      g = JSON.parse(JSON.stringify(g)); g.memberIds = g.memberIds.filter(function (m) { return m !== id; });
      if (g.memberIds.length < 2) S.remove('groups', g.id); else S.put('groups', g);
    });
    var lv = S.leave(), cancelled = 0;
    if (lv) lv.requests.forEach(function (r) { if (r.staffId === id && r.end >= d && (r.status === 'Pending' || r.status === 'Approved') && !r.synthetic) { r.status = 'Cancelled'; r.cancelledBy = H.name(H.user()); cancelled++; } });
    if (cancelled) S.saveLeave();
    S.find('guardians', function (l) { return l.adultId === id; }).forEach(function (l) { S.remove('guardians', l.id); });
    S.find('noCollect', function (x) { return x.personId === id; }).forEach(function (x) { S.remove('noCollect', x.id); });
    p = JSON.parse(JSON.stringify(p)); p.appRole = 'none'; p.deathTidied = H.today();
    S.put('people', p, 'Took ' + H.name(p) + ' off rosters (' + n + ' turns), teams and sign-in after their death');
  }

  function exportPerson(p) {
    var pick = function (c) { return S.find(c, function (x) { return x.personId === p.id || (x.memberIds && x.memberIds.indexOf(p.id) >= 0); }); };
    var lv = Store.leave();
    var data = { exportedAt: Store.now(), by: H.name(H.user()), note: 'Everything Church Hub holds about this person (' + PrivacyLaw.forChurch(S.settings()).copyRight + ').',
      restricted: H.can('notes') && H.can('medical') ? '' : 'Pastoral notes and children’s medical notes are kept separately and only Pastors / Children’s ministry can read them. Ask them to add these if the request covers them.',
      person: p, family: familyOf(p), households: HS.householdsOf(p).map(function (h) { return S.get('families', h); }),
      responsibleAdults: S.find('guardians', function (l) { return l.childId === p.id || l.adultId === p.id; }), consents: pick('consents'), pastoralNotes: H.can('notes') ? pick('notes') : undefined, serving: { skills: pick('skills'), assignments: pick('assignments'), groups: pick('groups'), awayDates: pick('blockouts'), offersToServe: pick('serveOffers') }, translationSuggestions: pick('wordIdeas'),
      leave: lv ? lv.requests.filter(function (r) { return r.staffId === p.id; }) : [], auditEntries: S.find('audit', function (a) { return a.target === 'people/' + p.id; }) };
    S.audit('Exported all data held about ' + H.name(p), 'people/' + p.id);
    H.download('church-hub-' + (p.firstName + '-' + p.lastName).toLowerCase().replace(/\W+/g, '-') + '.json', JSON.stringify(data, null, 2));
    H.toast(T('Downloaded everything held about {name}', { name: H.name(p) }));
  }

  H.register({
    id: 'people', name: 'People', desc: 'Directory, households and consent', icon: H.ICON.people, tint: '#7C3AED',
    stat: function () { return canBasic() ? TN('{n} person', '{n} people', S.find('people', function (p) { return p.active !== false; }).length) + ' · ' + TN('{n} household', '{n} households', S.list('families').length) : T('Church directory'); },
    todos: function (u) {
      if (!H.can('*') && !H.can('people.view') && !canChildren()) return [];
      var all = H.can('*') || H.can('people.view');
      var out = [], missing = all ? S.find('people', function (p) { return p.active !== false && !hasConsent(p.id, 'Church records'); }) : [];
      if (missing.length) out.push({ text: TN('{n} person has no recorded consent', '{n} people have no recorded consent', missing.length), href: '#/people/p/' + missing[0].id, tag: PrivacyLaw.forChurch(S.settings()).short });
      if (canChildren()) {
        var nd = HS.needs(S.list('people'), S.list('guardians'));
        if (nd.noConsenter.length) out.push({ text: TN('{n} child has no parent or guardian who can give consent', '{n} children have no parent or guardian who can give consent', nd.noConsenter.length), href: '#/people/p/' + nd.noConsenter[0].id, tag: 'Children' });
        if (nd.unconfirmed.length) out.push({ text: TN('Confirm the parents and guardians of {n} child', 'Confirm the parents and guardians of {n} children', nd.unconfirmed.length), href: '#/people/p/' + nd.unconfirmed[0].id, tag: 'Children' });
      }
      var noMarital = all ? S.find('people', function (p) { return p.active !== false && p.familyRole !== 'child' && !p.maritalStatus; }) : [];
      if (canDup()) {
        var dupN = DUP.find(dupPeople(), notDup()).filter(function (d) { return d.level !== 'possible'; }).length;
        if (dupN) out.push({ text: TN('{n} person looks entered twice', '{n} people look entered twice', dupN), href: '#/people/duplicates' });
      }
      var cpl = couplesToCheck();
      if (cpl.length) out.push({ text: TN('{n} couple to confirm (spouses or partners)', '{n} couples to confirm (spouses or partners)', cpl.length), href: '#/people/families' });
      if (noMarital.length) out.push({ text: TN('{n} adult has no marital status', '{n} adults have no marital status', noMarital.length), href: '#/people/p/' + noMarital[0].id });
      var since = LeaveCore.iso(LeaveCore.addDays(LeaveCore.parse(H.today()), -7 * CARE_WEEKS));
      if (H.can('notes')) S.find('people', function (p) { return deceased(p) && p.deceasedAt >= since; }).forEach(function (p) {
        out.push({ text: T('Care for the family of {name} (died {date})', { name: H.name(p), date: H.fmt(p.deceasedAt) }), href: '#/people/p/' + p.id, tag: 'Pastoral' });
      });
      if (H.can('*')) S.find('people', needsTidy).forEach(function (p) {
        out.push({ text: T('Finish recording the death of {name}: rosters and sign-in', { name: H.name(p) }), href: '#/people/p/' + p.id });
      });
      return out;
    },
    /** Once, when an Administrator signs in: new category names ("Church Partner", so it isn't mixed up with a partner in a couple),
     *  dates of death that were typed in front of a name in Elvanto ("2024-08-22-Mike") moved to the date they died,
     *  and (from before version 2) children linked to their household's adults, to confirm. */
    upgrade: function () {
      var st = S.settings(), v = st ? st.dataVersion || 1 : 5; if (v >= 5) return;
      var say = [], linked = 0;
      if (v < 4) {
      if (v < 3) {
        var renamed = 0, MAP = { Member: 'Church Partner', Partner: 'Church Partner', Visitor: 'Visiting Minister' };
        S.list('people').slice().forEach(function (p) { if (MAP[p.category]) { p = JSON.parse(JSON.stringify(p)); p.category = MAP[p.category]; S.put('people', p); renamed++; } });
        say.push(renamed + ' renamed to Church Partner / Visiting Minister', tidyDeathDates() + ' dates of death moved out of names into the date they died');
        if (v < 2) { HS.suggestedLinks(S.list('people'), S.list('guardians')).forEach(function (l) { S.put('guardians', l); linked++; }); say.push(linked + ' parent/guardian links made from households (to confirm)'); }
      }
      say.push(tidyIdNames() + ' ID numbers moved out of names (Administrators only)');
      }
      // Version 5: services became a list the church can add to (times and venues). Someone who served at all three
      // old services now serves at "every service", so new ones include them too.
      var widened = 0;
      S.list('skills').slice().forEach(function (k) {
        var t = k.times || [];
        if (t.length >= 3 && ['08:00', '10:00', '17:00'].every(function (x) { return t.indexOf(x) >= 0; })) { k = JSON.parse(JSON.stringify(k)); k.times = []; S.put('skills', k); widened++; }
      });
      say.push(widened + ' people serving at all three services now serve at every service');
      S.setSettings({ dataVersion: 5 }, 'Upgraded people: ' + say.join('; '));
      if (linked) setTimeout(function () { H.toast(T('Children are now linked to the adults in their household – please confirm them (see Home)')); }, 400);
    },
    render: function (p) {
      if (p[0] === 'p') return renderPerson(p[1]);
      if (p[0] === 'families') return renderFamilies();
      if (p[0] === 'search') return renderSearch();
      if (p[0] === 'duplicates') return renderDuplicates();
      if (p[0] === 'late') return renderLate();
      return renderList();
    },
    after: function () {
      var fq = document.getElementById('fm-q');
      if (fq) fq.addEventListener('input', function () { state.fq = fq.value; var pos = fq.selectionStart; H.render(); var n = document.getElementById('fm-q'); n.focus(); n.setSelectionRange(pos, pos); });
      var st = document.getElementById('pp-stats');
      if (st) st.addEventListener('toggle', function () { state.statsOpen = st.open; });
      var res = document.getElementById('adv-result');
      if (res && state.adv) res.addEventListener('change', function (ev) {
        var t = ev.target, sel = state.adv.sel || (state.adv.sel = {});
        if (t.id === 'adv-selall') document.querySelectorAll('.adv-sel').forEach(function (b) { b.checked = t.checked; if (t.checked) sel[b.value] = 1; else delete sel[b.value]; });
        else if (t.classList.contains('adv-sel')) { if (t.checked) sel[t.value] = 1; else delete sel[t.value]; }
        else return;
        var n = Object.keys(sel).length, b = document.getElementById('adv-bulk');
        if (b) { b.disabled = !n; b.classList.toggle('primary', !!n); b.textContent = n ? T('Change {n} selected…', { n: n }) : T('Change selected…'); }
        var all = document.getElementById('adv-selall'); if (all) all.checked = n && n === document.querySelectorAll('.adv-sel').length;
      });
      var adv = document.getElementById('adv');
      if (adv) {
        var onEdit = function (ev) {
          var t = ev.target; if (t.classList.contains('adv-ff') || !advSync(t)) return;   // the field finder is handled as it's typed
          H.render();   // the choices changed: show the right boxes, and keep the place
          var b = t.id ? document.getElementById(t.id) : document.querySelector('.' + (t.classList.contains('adv-field') ? 'adv-fbtn' : t.classList[0]) + '[data-i="' + t.dataset.i + '"]');
          if (b) b.focus();
        };
        adv.addEventListener('input', function (ev) {
          var t = ev.target; if (t.tagName === 'SELECT') return;
          if (t.classList.contains('adv-ff')) fieldFilter(t); else advSync(t);
        });
        // The field list: opens with a box to type in; typing narrows it; arrows and Enter pick; Esc or a click elsewhere closes
        adv.addEventListener('click', function (ev) {
          var b = ev.target.closest('.adv-fbtn'), o = ev.target.closest('.adv-fo');
          if (b) { var open = b.getAttribute('aria-expanded') === 'true'; fieldClose(); if (!open) fieldOpen(b); return; }
          if (o) fieldPick(o);
        });
        adv.addEventListener('keydown', function (ev) {
          var t = ev.target, pop = t.closest && t.closest('.adv-fpop');
          if (t.classList.contains('adv-fbtn') && (ev.key === 'ArrowDown' || ev.key === 'Enter' || ev.key === ' ') && t.getAttribute('aria-expanded') !== 'true') { ev.preventDefault(); fieldOpen(t); return; }
          if (t.classList.contains('adv-fbtn') && ev.key.length === 1 && !ev.ctrlKey && !ev.metaKey && !ev.altKey) { ev.preventDefault(); var inp = fieldOpen(t); inp.value = ev.key; fieldFilter(inp); return; }   // just start typing
          if (!pop) return;
          var vis = [].filter.call(pop.querySelectorAll('.adv-fo'), function (x) { return !x.hidden; }), k = vis.indexOf(pop.querySelector('.adv-fo.act'));
          if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') { ev.preventDefault(); fieldActive(pop, vis[Math.max(0, Math.min(vis.length - 1, k + (ev.key === 'ArrowDown' ? 1 : -1)))]); if (t.classList.contains('adv-fo')) pop.querySelector('.adv-ff').focus(); }
          else if (ev.key === 'Enter') { ev.preventDefault(); if (vis[k]) fieldPick(vis[k]); }
          else if (ev.key === 'Escape') { ev.preventDefault(); var i = pop.closest('.adv-fpick').dataset.i; fieldClose(); var fb = document.querySelector('.adv-fbtn[data-i="' + i + '"]'); if (fb) fb.focus(); }
          else if (ev.key === 'Tab') fieldClose();
        });
        if (!fieldDocHooked) { fieldDocHooked = true; document.addEventListener('mousedown', function (ev) { if (!ev.target.closest || !ev.target.closest('.adv-fpick')) fieldClose(); }); }
        adv.addEventListener('change', onEdit);
        var lg = document.getElementById('adv-logic');
        if (lg) lg.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); state.adv.ran = true; H.render(); } });
      }
      var pf = document.getElementById('pp-photo');
      if (pf) pf.addEventListener('change', function () {
        var p = S.get('people', pf.dataset.id), f = pf.files && pf.files[0]; if (!p || !f) return;
        pf.value = '';   // the same file can be chosen again
        H.cropPhoto(f).then(function (data) {
          return S.setPhoto(p.id, data, (p.photo ? 'Changed the photo of ' : 'Added a photo of ') + H.name(p)).then(function () { H.render(); H.toast(T('Photo saved')); });
        }).catch(function () { H.toast(T('That file isn’t a picture Church Hub can read. Try a JPG or PNG photo.')); });
      });
      var q = document.getElementById('pp-q');
      if (q) q.addEventListener('input', function () { state.q = q.value; var pos = q.selectionStart; H.render(); var n = document.getElementById('pp-q'); n.focus(); n.setSelectionRange(pos, pos); });
    },
    actions: {
      filter: function (el) { state.f = el.dataset.f; H.render(); },
      photo: function () { var f = document.getElementById('pp-photo'); if (f) f.click(); },
      nophoto: function (el) {
        var p = S.get('people', el.dataset.id); if (!p) return;
        S.setPhoto(p.id, null, 'Removed the photo of ' + H.name(p)).then(function () { H.render(); H.toast(T('Photo removed')); });
      },
      sort: function (el) { state.sort = el.dataset.k; Store.pref('peopleSort', state.sort); if (state.adv) { state.adv.sort = 'name'; state.adv.dir = 1; } H.render(); },
      advadd: function (el) { var i = +el.dataset.i, prev = state.adv.filters[i]; state.adv.filters.splice(i + 1, 0, { field: prev ? prev.field : 'name', op: prev ? prev.op : 'has', value: '', value2: '', unit: 'days' }); H.render(); var s2 = document.querySelectorAll('.adv-fbtn')[i + 1]; if (s2) s2.focus(); },
      advdel: function (el) { state.adv.filters.splice(+el.dataset.i, 1); H.render(); },
      advcol: function (el) {
        var c = state.adv.cols, i = c.indexOf(el.dataset.k), m = +el.dataset.m;
        if (i < 0) return;
        if (!m) c.splice(i, 1); else if (c[i + m]) { c[i] = c[i + m]; c[i + m] = el.dataset.k; }
        H.render();
      },
      advrun: function () { state.adv.ran = true; H.render(); var r = document.getElementById('adv-result'); if (r) r.scrollIntoView({ block: 'start', behavior: 'smooth' }); },
      advreset: function () { state.adv = emptyAdv(); H.render(); },
      advsort: function (el) { var A = state.adv; if (A.sort === el.dataset.k) A.dir = -A.dir; else { A.sort = el.dataset.k; A.dir = 1; } H.render(); },
      advcsv: function () { advCsv(); },
      add: function () { editDialog(null); },
      edit: function (el) { editDialog(S.get('people', el.dataset.id)); var f = el.dataset.focus && document.getElementById(el.dataset.focus); if (f) { f.focus(); f.scrollIntoView({ block: 'center' }); } },
      consent: function (el) { consentDialog(S.get('people', el.dataset.id)); },
      export: function (el) { exportPerson(S.get('people', el.dataset.id)); },
      save: function () {
        var g = function (id) { var e = document.getElementById(id); return e ? e.value.trim() : null; };
        var err = document.getElementById('pf-err'), id = g('pf-id');
        var p = id ? JSON.parse(JSON.stringify(S.get('people', id))) : { active: true, appRole: Store.defaultRole(), keyDates: [], source: 'manual' };
        if (!g('pf-first') || !g('pf-last')) { err.textContent = T('Please enter a first and last name.'); err.hidden = false; return; }
        var dead = !!id && (deceased(p) || p.category === 'Deceased');   // someone who has died: only their name is needed
        var need = function (v, msg) { if (v === '' && !dead) { err.textContent = msg; err.hidden = false; return true; } return false; };
        if (need(g('pf-cat'), T('Please choose a category.')) || need(g('pf-fam'), T('Please choose their household – or “+ New household…” if they live on their own.')) ||
          need(g('pf-frole'), T('Please choose whether they are an adult or a child in the household.'))) return;
        // Email and mobile must be filled in for adults: the real one, or "unknown" (saved as not known, never as the word)
        var isChild = (g('pf-frole') !== null ? g('pf-frole') : p.familyRole) === 'child';
        var unknown = function (v) { v = (v || '').trim().toLowerCase(); return v === 'unknown' || v === T('unknown').toLowerCase() || v === 'not known'; };
        var em = g('pf-email'), mo = g('pf-mobile');
        if (!isChild && !em && !dead) { err.textContent = T('Please fill in the email address, or type “{word}”.', { word: T('unknown') }); err.hidden = false; return; }
        if (!isChild && !mo && !dead) { err.textContent = T('Please fill in the mobile number, or type “{word}”.', { word: T('unknown') }); err.hidden = false; return; }
        if (em && !unknown(em) && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { err.textContent = T('That email address doesn’t look right.'); err.hidden = false; return; }
        if (mo && !unknown(mo) && !/\d{3}/.test(mo)) { err.textContent = T('That mobile number doesn’t look right.'); err.hidden = false; return; }
        // Duplicates: very likely matches can't be saved, unless an Administrator has checked it's a different person
        var dups = dupMatches().filter(function (m) { return m.score >= 70; }), dupOk = document.getElementById('pf-dup-ok');
        if (dups.length && !(canDup() && dupOk && dupOk.checked)) {
          dupWarn(); err.textContent = T(canDup() ? 'This looks like someone already in Church Hub. Open them instead, or tick “I’ve checked: this is a different person”.' : 'This looks like someone already in Church Hub, so it can’t be saved. Open them instead, or ask an Administrator.');
          err.hidden = false; return;
        }
        p.firstName = g('pf-first'); p.lastName = g('pf-last'); p.preferredName = g('pf-pref');
        p.email = unknown(em) ? '' : em; p.mobile = unknown(mo) ? '' : mo;
        if (unknown(em)) p.emailUnknown = true; else delete p.emailUnknown;
        if (unknown(mo)) p.mobileUnknown = true; else delete p.mobileUnknown;
        if (g('pf-birth') !== null) p.birthDate = g('pf-birth');
        if (g('pf-wed') !== null) {
          if (g('pf-wed') > H.today()) { err.textContent = T('The wedding anniversary can’t be in the future.'); err.hidden = false; return; }
          p.keyDates = (p.keyDates || []).filter(function (k) { return !WEDDING.test(k.label || ''); });
          if (g('pf-wed') && g('pf-frole') !== 'child') p.keyDates.push({ label: 'Wedding anniversary', date: g('pf-wed') });
        }
        if (g('pf-cat') !== null) p.category = g('pf-cat');
        if (g('pf-died') !== null) {   // correcting the date someone died (and the funeral)
          var dd = g('pf-died'), fu = g('pf-funeral');
          if (!dd || dd > H.today()) { err.textContent = T('Please choose the date they died.'); err.hidden = false; return; }
          p.deceasedAt = dd;
          p.keyDates = (p.keyDates || []).filter(function (k) { return k.label !== 'Died' && k.label !== 'Funeral'; }).concat([{ label: 'Died', date: dd }]).concat(fu ? [{ label: 'Funeral', date: fu }] : []);
        }
        if (g('pf-gender') !== null) { if (g('pf-gender')) p.gender = g('pf-gender'); else delete p.gender; }
        if (g('pf-middle') !== null) { if (g('pf-middle')) p.middleName = g('pf-middle'); else delete p.middleName; }
        if (g('pf-street') !== null) {
          var ad = { street: g('pf-street'), street2: g('pf-street2'), city: g('pf-city'), postcode: g('pf-postcode'), province: g('pf-province'), country: g('pf-country') === '__other' ? g('pf-country-o') : g('pf-country') };
          if (ad.street || ad.street2 || ad.city || ad.postcode) p.address = ad; else delete p.address;
        }
        if (g('pf-psince') !== null) {
          var ps = g('pf-psince'), pu = g('pf-pupd');
          if (ps && pu && pu < ps) { err.textContent = T('The partnership can’t be updated before the date they were accepted.'); err.hidden = false; return; }
          if (ps) p.partnerSince = ps; else delete p.partnerSince;
          if (pu) p.partnerUpdated = pu; else if (!/^\d{4}$/.test(p.partnerUpdated || '')) delete p.partnerUpdated;   // keep a year from Elvanto
        }
        if (g('pf-frole') !== null) p.familyRole = g('pf-frole');
        if (g('pf-marital') !== null) {
          if (p.familyRole === 'child') delete p.maritalStatus;
          else if (!g('pf-marital') && !dead) { err.textContent = T('Please choose a marital status (or “Not known”).'); err.hidden = false; return; }
          else if (!g('pf-marital')) delete p.maritalStatus;
          else p.maritalStatus = g('pf-marital');
        }
        if (g('pf-late') !== null) {
          var was = lateSpouse(S.get('people', p.id) || p), wasName = p.lateSpouseName || '';
          var lv = g('pf-late'), ln = g('pf-late-n') || '';
          if (lv === '__out' && !ln) { err.textContent = T('Type the name of their late spouse, or choose “Nobody recorded”.'); err.hidden = false; return; }
          if (lv && lv !== '__out') { p.lateSpouseId = lv; delete p.lateSpouseName; delete p.lateSpouseSet; }
          else { delete p.lateSpouseId; if (lv === '__out') p.lateSpouseName = ln; else delete p.lateSpouseName; if (lv || was || wasName || p.maritalStatus === 'Widowed') p.lateSpouseSet = true; }
        }
        if (g('pf-role') !== null) p.appRole = g('pf-role');
        var sbox = document.getElementById('pf-staff');
        if (sbox) {
          if (sbox.checked) {
            if (!g('pf-scat') || !g('pf-sstart')) { err.textContent = T('For staff, choose their staff category and the date they started working at the church.'); err.hidden = false; return; }
            var same = document.getElementById('pf-sw-same').checked, days = [];
            document.querySelectorAll('.pf-sw:checked').forEach(function (b) { days.push(b.value); });
            if (!same && !days.length) { err.textContent = T('Tick the days they work, or “Same as their category”.'); err.hidden = false; return; }
            p.staff = { category: g('pf-scat'), start: g('pf-sstart'), workDays: same ? '' : days.join(', ') };
            if (!p.category) p.category = 'Staff';   // staff keep their category: a Church Partner can work for the church too
          } else if (p.staff) {
            delete p.staff;
            if (p.category === 'Staff') p.category = 'Church Partner';
          }
        }
        if (Store.isLive() && p.appRole && p.appRole !== 'none' && !p.email) { err.textContent = T('To give someone access to Church Hub, add their email address – that’s how they sign in.'); err.hidden = false; return; }
        var fam = g('pf-fam');
        if (fam === '__new') { var f = S.put('families', { name: p.lastName + ' family', custom: false }, 'Created a household for ' + p.firstName + ' ' + p.lastName); fam = f.id; }
        if (fam !== null) p.familyId = fam;
        if (p.familyRole === 'child' && !p.familyId && !dead) { err.textContent = T('Children must be in a household, so the church knows who they live with.'); err.hidden = false; return; }
        var care = window.CareUI ? CareUI.read() : null;
        if (care && care.error && !dead) { err.textContent = care.error; err.hidden = false; return; }
        S.put('people', p, (id ? 'Updated details of ' : 'Added ') + p.firstName + ' ' + p.lastName);
        if (window.CareUI) { if (!(care && CareUI.setFrom(p, care))) CareUI.sync(p.id); }
        dups.forEach(function (m) { markNotSame(p.id, m.id); });
        H.closeModal();
        if (!id) { H.go('people/p/' + p.id); setTimeout(function () { consentDialog(p); }, 50); } else H.render();
        H.toast(T(id ? 'Saved' : 'Added – now record their consent'));
      },
      saveconsent: function (el) {
        var p = S.get('people', el.dataset.id), me = isMe(p);
        var method = document.getElementById('cf-method'), guardian = document.getElementById('cf-guardian');
        document.querySelectorAll('.cf-p').forEach(function (box) {
          var pur = box.dataset.p, had = hasConsent(p.id, pur);
          if (box.checked === had && consentFor(p.id, pur)) return;
          if (!box.checked && !consentFor(p.id, pur) && RECEIVE_P.indexOf(pur) >= 0) return;   // a "would like to receive" never chosen: nothing to record
          var old = consentFor(p.id, pur); if (old) { old.withdrawnAt = H.today(); S.put('consents', old); }
          S.put('consents', { personId: p.id, purpose: pur, given: box.checked, date: H.today(), method: me ? 'Changed in the app' : method.value, recordedBy: H.name(H.user()), guardianId: guardian ? guardian.value : '' },
            (box.checked ? 'Consent given: ' : 'Consent withdrawn: ') + pur + ' for ' + H.name(p));
        });
        if (window.CareUI) CareUI.sync(p.id);   // their care group card follows their consent
        H.closeModal(); H.render(); H.toast(T('Consent saved'));
      },
      death: function (el) {
        var p = S.get('people', el.dataset.id);
        var spouses = p.familyId ? members(p.familyId).filter(function (m) { return m.id !== p.id && m.familyRole !== 'child' && m.maritalStatus === 'Married'; }) : [];
        H.modal(H.dialogHead(T('Record the death of {name}', { name: H.name(p) }), T('They stay on the church records, but come off rosters, teams, the directory and messages, and can no longer sign in.')) +
          '<div class="dlg-body"><div class="two"><label class="field req">' + T('Date of death') + '<input type="date" id="dd-date" value="' + H.today() + '" max="' + H.today() + '"></label>' +
          '<label class="field">' + T('Funeral or memorial') + '<input type="date" id="dd-funeral"></label></div>' +
          spouses.map(function (s) { return '<label class="check"><input type="checkbox" class="dd-sp" value="' + s.id + '" checked><span>Change ' + esc(H.name(s)) + '’s marital status to <b>' + T('Widowed') + '</b></span></label>'; }).join('') +
          (H.can('notes') ? '<label class="field">' + T('Pastoral note') + '<textarea id="dd-note" rows="2" placeholder="' + esc(T('e.g. Family would like a visit next week')) + '"></textarea><small>' + T('Only pastors see it.') + '</small></label>' : '') +
          '<p id="dd-err" class="note bad" hidden></p></div>' +
          '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn primary" data-act="people:savedeath" data-id="' + p.id + '">' + T('Record') + '</button></div>', T('Record a death'));
      },
      savedeath: function (el) {
        var d = document.getElementById('dd-date').value, fun = document.getElementById('dd-funeral').value, err = document.getElementById('dd-err');
        if (!d || d > H.today()) { err.textContent = T('Please choose the date they died.'); err.hidden = false; return; }
        var p = JSON.parse(JSON.stringify(S.get('people', el.dataset.id))), name = H.name(p);
        p.active = false; p.category = 'Deceased'; p.deceasedAt = d; p.appRole = 'none';
        p.keyDates = (p.keyDates || []).filter(function (k) { return k.label !== 'Died' && k.label !== 'Funeral'; }).concat([{ label: 'Died', date: d }]).concat(fun ? [{ label: 'Funeral', date: fun }] : []);
        S.put('people', p, 'Recorded the death of ' + name);
        document.querySelectorAll('.dd-sp:checked').forEach(function (b) {
          var s = JSON.parse(JSON.stringify(S.get('people', b.value))); s.maritalStatus = 'Widowed'; s.lateSpouseId = p.id; S.put('people', s, 'Marital status changed to Widowed: ' + H.name(s));
        });
        var note = document.getElementById('dd-note');
        if (note && note.value.trim()) S.put('notes', { personId: p.id, text: note.value.trim(), by: H.name(H.user()), at: H.today() }, 'Added a pastoral note');
        if (H.can('*')) tidyDeath(p.id);
        H.closeModal(); H.render(); H.toast(T('Recorded.') + ' ' + T(H.can('*') ? 'Taken off rosters and sign-in.' : 'The church office will finish taking them off rosters and sign-in.'));
      },
      tidydeath: function (el) { tidyDeath(el.dataset.id); H.render(); H.toast(T('Taken off rosters, teams, leave and sign-in')); },
      undodeath: function (el) {
        if (!H.confirmBtn(el, T('Click again: undo the death record'))) return;
        var p = JSON.parse(JSON.stringify(S.get('people', el.dataset.id)));
        p.active = true; p.category = p.staff ? 'Staff' : 'Church Partner'; delete p.deceasedAt; delete p.deathTidied;
        p.keyDates = (p.keyDates || []).filter(function (k) { return k.label !== 'Died' && k.label !== 'Funeral'; });
        S.put('people', p, 'Undid the death record of ' + H.name(p));
        H.render(); H.toast(T('Undone. Give them app access, teams and roster turns again if needed.'));
      },
      addhome: function (el) { homeDialog(el.dataset.id); },
      savehome: function (el) {
        var p = JSON.parse(JSON.stringify(S.get('people', el.dataset.id))), f = document.getElementById('hm-f').value; if (!f) return;
        p.householdIds = (p.householdIds || []).concat([f]);
        S.put('people', p, H.name(p) + ' also lives in ' + H.familyName(S.get('families', f))); H.closeModal(); H.render(); H.toast(T('Added'));
      },
      unhome: function (el) {
        if (!H.confirmBtn(el, T('Click again to remove'))) return;
        var p = JSON.parse(JSON.stringify(S.get('people', el.dataset.id)));
        p.householdIds = (p.householdIds || []).filter(function (h) { return h !== el.dataset.f; });
        S.put('people', p, H.name(p) + ' no longer lives in another household'); H.render();
      },
      link: function (el) { linkDialog(el.dataset.child, el.dataset.id); },
      linksave: function (el) {
        var who = document.getElementById('gl-who').value, err = document.getElementById('gl-err'), name = document.getElementById('gl-name').value.trim();
        if (!who || (who === '__out' && !name)) { err.textContent = T('Choose the person, or type the name of someone not in Church Hub.'); err.hidden = false; return; }
        var childId = el.dataset.child, id = el.dataset.id;
        if (who !== '__out' && links(childId).some(function (l) { return l.adultId === who && l.id !== id; })) { err.textContent = T('That person is already listed for this child.'); err.hidden = false; return; }
        var l = id ? JSON.parse(JSON.stringify(S.get('guardians', id))) : { childId: childId };
        l.adultId = who === '__out' ? '' : who; l.name = who === '__out' ? name : ''; l.phone = who === '__out' ? document.getElementById('gl-phone').value.trim() : '';
        l.relationship = document.getElementById('gl-rel').value; l.canConsent = document.getElementById('gl-consent').checked;
        l.primary = document.getElementById('gl-primary').checked; l.mayCollect = document.getElementById('gl-collect').checked; l.confirmed = true;
        S.put('guardians', l, (id ? 'Updated ' : 'Added ') + l.relationship.toLowerCase() + ' of ' + H.name(S.get('people', childId)));
        H.closeModal(); H.render(); H.toast(T('Saved'));
      },
      linkdel: function (el) {
        if (!H.confirmBtn(el, T('Click again to remove'))) return;
        var l = S.get('guardians', el.dataset.id);
        S.remove('guardians', l.id, 'Removed ' + linkName(l) + ' as ' + l.relationship.toLowerCase() + ' of ' + H.name(S.get('people', l.childId))); H.closeModal(); H.render();
      },
      nc: function (el) { ncDialog(el.dataset.child); },
      ncsave: function (el) {
        var who = document.getElementById('nc-who').value, name = document.getElementById('nc-name').value.trim(), note = document.getElementById('nc-note').value.trim(), err = document.getElementById('nc-err');
        if (who === '__out' && !name) { err.textContent = T('Type their name, or choose them from the list.'); err.hidden = false; return; }
        var childId = el.dataset.child;
        S.put('noCollect', { childId: childId, personId: who === '__out' ? '' : who, name: who === '__out' ? name : '', note: note }, 'Added a collection restriction for ' + H.name(S.get('people', childId)));
        // Someone who may not collect can't also be listed as allowed to collect
        if (who !== '__out') links(childId).filter(function (l) { return l.adultId === who && l.mayCollect; }).forEach(function (l) { l = JSON.parse(JSON.stringify(l)); l.mayCollect = false; S.put('guardians', l); });
        H.closeModal(); H.render(); H.toast(T('Saved – Children’s ministry will see an alert'));
      },
      ncdel: function (el) {
        if (!H.confirmBtn(el, T('Click again to remove'))) return;
        var x = S.get('noCollect', el.dataset.id);
        S.remove('noCollect', x.id, 'Removed a collection restriction for ' + H.name(S.get('people', x.childId))); H.render();
      },
      medical: function (el) {
        var p = S.get('people', el.dataset.id), m = p.medical || {};
        H.modal(H.dialogHead(T('Medical notes for {name}', { name: H.name(p) }), T('Only Children’s ministry can see these. Keep it to what leaders need for safety.')) +
          '<div class="dlg-body"><label class="field">' + T('Allergies') + '<input id="md-a" value="' + esc(m.allergies || '') + '" placeholder="' + esc(T('e.g. Nuts (carries an EpiPen)')) + '"></label>' +
          '<label class="field">' + T('Other notes') + '<textarea id="md-n" rows="3" placeholder="' + esc(T('e.g. Asthma pump in bag')) + '">' + esc(m.notes || '') + '</textarea></label><p id="md-err" class="note bad" hidden></p></div>' +
          '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn primary" data-act="people:savemedical" data-id="' + p.id + '">' + T('Save') + '</button></div>', T('Medical notes'));
      },
      savemedical: function (el) {
        var p = JSON.parse(JSON.stringify(S.get('people', el.dataset.id))), a = document.getElementById('md-a').value.trim(), n = document.getElementById('md-n').value.trim();
        if ((a || n) && !hasConsent(p.id, 'Children’s medical notes')) {
          var e = document.getElementById('md-err'); e.textContent = T('A parent or guardian must agree first ({law}). Ask a Pastor or the church office to record their consent on the profile of {name}.', { law: PrivacyLaw.forChurch(S.settings()).short, name: p.firstName }); e.hidden = false; return;
        }
        if (a || n) p.medical = { allergies: a, notes: n }; else delete p.medical;
        S.put('people', p, 'Updated children’s medical notes of ' + H.name(p));
        H.closeModal(); H.render(); H.toast(T('Medical notes saved'));
      },
      onote: function (el) {
        var t = document.getElementById('on-text').value.trim(); if (!t) return;
        var p = S.get('people', el.dataset.id);
        S.put('officeNotes', { personId: p.id, text: t, by: H.name(H.user()), at: H.today() }, 'Added a church office note for ' + H.name(p));
        H.render(); H.toast(T('Note saved'));
      },
      delonote: function (el) {
        if (!H.confirmBtn(el, T('Click again to delete'))) return;
        var n = S.get('officeNotes', el.dataset.id); if (!n) return;
        S.remove('officeNotes', n.id, 'Deleted a church office note for ' + H.name(S.get('people', n.personId)));
        H.render(); H.toast(T('Note deleted'));
      },
      showid: function (el) {
        var p = S.get('people', el.dataset.id), box = document.getElementById('pp-idn');
        Store.idNumber(p.id).then(function (v) {
          if (!isMe(p)) S.audit('Viewed the ID number of ' + H.name(p), 'people/' + p.id);
          state.idShown = { id: p.id, value: v };
          var b = box && box.querySelector('[data-act="people:showid"]'); if (b) b.outerHTML = '<b class="idn">' + esc(v || T('Not recorded')) + '</b>';
        }, function () { H.toast(T('Couldn’t load the ID number'), true); });
      },
      editid: function (el) {
        var p = S.get('people', el.dataset.id), known = state.idShown && state.idShown.id === p.id ? state.idShown.value : '';
        H.modal(H.dialogHead(T('ID number of {name}', { name: H.name(p) }), T('Administrators only. Keep it only if the church still needs it ({law}).', { law: PrivacyLaw.forChurch(S.settings()).short })) + '<div class="dlg-body">' +
          '<label class="field">' + T('ID number') + '<input id="idn-v" inputmode="numeric" autocomplete="off" value="' + esc(known) + '" placeholder="' + (known ? '' : esc(T('Leave empty to keep the current one'))) + '"><small>' + T('South African ID numbers have 13 digits. Passport numbers are fine too.') + '</small></label>' +
          '<label class="check"><input type="checkbox" id="idn-del"><span>' + T('Remove the ID number') + '</span></label><p id="idn-err" class="note bad" hidden></p></div>' +
          '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn primary" data-act="people:saveid" data-id="' + p.id + '">' + T('Save') + '</button></div>', T('ID number'));
      },
      saveid: function (el) {
        var p = S.get('people', el.dataset.id), v = document.getElementById('idn-v').value.replace(/[\s-]/g, ''), del = document.getElementById('idn-del').checked, err = document.getElementById('idn-err');
        if (!del && !v) { H.closeModal(); return; }
        if (!del && !/^[A-Za-z0-9]{5,20}$/.test(v)) { err.textContent = T('That doesn’t look like an ID or passport number.'); err.hidden = false; return; }
        Store.setIdNumber(p.id, del ? '' : v, (del ? 'Removed the ID number of ' : 'Changed the ID number of ') + H.name(p));
        state.idShown = null; H.closeModal(); H.render(); H.toast(T(del ? 'ID number removed' : 'ID number saved'));
      },
      note: function (el) {
        var t = document.getElementById('pn-text').value.trim(); if (!t) return;
        S.put('notes', { personId: el.dataset.id, text: t, by: H.name(H.user()), at: H.today() }, 'Added a pastoral note');
        H.render(); H.toast(T('Note saved'));
      },
      newfam: function () {
        H.modal(H.dialogHead(T('New household'), T('Then add people to it (Edit details → Household).')) + '<div class="dlg-body"><label class="field req">' + T('Surname') + '<input id="nf-name" placeholder="' + esc(T('e.g. Naidoo')) + '"><small>' + T('Once adults are added, the household is named after them automatically (e.g. “Jason & Priya Naidoo”).') + '</small></label></div><div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn primary" data-act="people:savefam">' + T('Create') + '</button></div>', T('New household'));
      },
      savefam: function () { var n = document.getElementById('nf-name').value.trim(); if (!n) return; n = n.replace(/\s*family$/i, ''); S.put('families', { name: n + ' family', custom: false }, 'Created household ' + n); H.closeModal(); H.render(); },
      notdup: function (el) {
        if (!canDup()) return;
        markNotSame(el.dataset.a, el.dataset.b);
        H.render(); H.toast(T('Won’t be suggested again'));
      },
      fixdup: function (el) { fixDialog(el.dataset.a, el.dataset.b, el.dataset.keep || ''); },
      fixkeep: function (el) { fixDialog(el.dataset.a, el.dataset.b, el.dataset.keep); },
      fixdo: function (el) { doFix(el.dataset.keep, el.dataset.drop); },
      volunteer: function (el) { volunteerDialog(S.get('people', el.dataset.id)); },
      bulk: function () { if (canBulk()) bulkDialog(); },
      bulksave: function (el) {
        if (!canBulk()) return;
        var fd = bulkFields().filter(function (x) { return x.key === document.getElementById('bk-f').value; })[0], v = document.getElementById('bk-v').value, err = document.getElementById('bk-err');
        if (!v && !fd.blank) { err.textContent = T('Choose the new value.'); err.hidden = false; return; }
        var ids = Object.keys(state.adv.sel || {}), items = [], skipped = {}, made = [];
        if (!H.confirmBtn(el, TN('Click again to change {n} person', 'Click again to change {n} people', ids.length))) return;
        H.closeModal();
        H.busy('Changing ' + ids.length + (ids.length === 1 ? ' person' : ' people') + '…', function () {
          ids.forEach(function (id) {
            var p = S.get('people', id); if (!p) return;
            var why = fd.skip && fd.skip(p); if (why) { skipped[why] = (skipped[why] || 0) + 1; return; }
            var before = {}; fd.keys.forEach(function (k) { before[k] = p.hasOwnProperty(k) ? { v: p[k] } : null; });
            var q = JSON.parse(JSON.stringify(p)); fd.set(q, v, made);
            if (fd.keys.every(function (k) { return JSON.stringify(q[k]) === JSON.stringify(p[k]); })) return;   // nothing to change
            items.push({ id: id, before: before });
            S.put('people', q, 'Changed ' + fd.label.toLowerCase() + ' of ' + H.name(q) + ' to ' + (v || 'nothing') + ' (changing many people at once)');
          });
          S.audit('Changed ' + fd.label.toLowerCase() + ' to ' + (v || 'nothing') + ' for ' + items.length + ' people at once (Advanced search)' + (made.length ? '; ' + made.length + ' households created' : ''), 'people');
          state.bulkUndo = { key: fd.key, keys: fd.keys, label: fd.label, value: v, items: items, skipped: skipped, made: made };
          state.adv.sel = {}; H.render(); H.toast(TN('{n} person changed', '{n} people changed', items.length));
        });
      },
      bulkundo: function () {
        var u = state.bulkUndo; if (!u || !canBulk()) return;
        H.busy(T('Undoing…'), function () {
          u.items.forEach(function (it) {
            var p = S.get('people', it.id); if (!p) return;
            var q = JSON.parse(JSON.stringify(p));
            u.keys.forEach(function (k) { if (it.before[k]) q[k] = it.before[k].v; else delete q[k]; });
            S.put('people', q, 'Undid: ' + u.label.toLowerCase() + ' of ' + H.name(q));
          });
          (u.made || []).forEach(function (fid) { if (!S.find('people', function (p) { return p.familyId === fid || (p.householdIds || []).indexOf(fid) >= 0; }).length) S.remove('families', fid); });
          S.audit('Undid changing ' + u.label.toLowerCase() + ' for ' + u.items.length + ' people', 'people');
          state.bulkUndo = null; H.render(); H.toast(T('Undone'));
        });
      },
      savevolunteer: function (el) {
        var p = S.get('people', el.dataset.id), err = document.getElementById('vol-err');
        var yes = (document.querySelector('input[name="vol"]:checked') || {}).value === 'yes';
        var times = [].map.call(document.querySelectorAll('.vol-t:checked'), function (x) { return x.value; });
        var want = [].filter.call(document.querySelectorAll('.vol-p:checked'), function (x) { return !x.closest('.vol-ps').hidden; }).map(function (x) { return x.value; });
        if (yes && !times.length) { err.textContent = T('Tick at least one service they serve at.'); err.hidden = false; return; }
        if (yes && !want.length) { err.textContent = T('Tick at least one department and position.'); err.hidden = false; return; }
        if (!yes) want = [];
        var sk = S.find('skills', function (k) { return k.personId === p.id; }), freq = document.getElementById('vol-freq') ? document.getElementById('vol-freq').value : 'fortnightly';
        var allTimes = times.length === slotIds().length ? [] : times;   // every service: no restriction
        sk.forEach(function (k) { if (want.indexOf(k.positionId) < 0) S.remove('skills', k.id); });
        want.forEach(function (pid) {
          var k = sk.filter(function (x) { return x.positionId === pid; })[0];
          k = k ? JSON.parse(JSON.stringify(k)) : { personId: p.id, positionId: pid, frequency: freq };
          k.times = allTimes; S.put('skills', k);
        });
        var names = want.map(function (id) { return (S.get('positions', id) || {}).name; });
        S.audit(yes ? 'Volunteering for ' + H.name(p) + ': ' + times.map(slotName).join(', ') + ' – ' + names.join(', ') : 'Not volunteering: ' + H.name(p), 'people/' + p.id);
        H.closeModal(); H.render(); H.toast(T('Saved'));
      },
      lateyes: function (el) {
        var a = JSON.parse(JSON.stringify(S.get('people', el.dataset.a))), b = S.get('people', el.dataset.b);
        a.lateSpouseId = b.id; delete a.lateSpouseName; delete a.lateSpouseSet;
        var widowed = a.maritalStatus === 'Married' && !isDead(a); if (widowed) a.maritalStatus = 'Widowed';   // still recorded as Married
        S.put('people', a, 'Late spouse: ' + H.name(a) + ' was married to ' + H.name(b) + (widowed ? ' (marital status changed to Widowed)' : ''));
        H.render(); H.toast(T('Saved: {a} was married to {b}', { a: H.name(a), b: H.name(b) }));
      },
      lateno: function (el) {
        var a = JSON.parse(JSON.stringify(S.get('people', el.dataset.a))), b = S.get('people', el.dataset.b);
        a.notLateSpouse = (a.notLateSpouse || []).concat([b.id]);
        S.put('people', a, 'Not a couple: ' + H.name(a) + ' and ' + H.name(b) + ' (late spouse suggestion)');
        H.render(); H.toast(T('Got it – that suggestion won’t come back'));
      },
      couplefix: function (el) {
        var key = HS.pairKey(el.dataset.a, el.dataset.b), c = HS.couples(S.list('people'), S.list('families')).filter(function (x) { return HS.pairKey(x.a, x.b) === key; })[0];
        if (!c || !canCouples()) return;
        var f = JSON.parse(JSON.stringify(S.get('families', c.familyId)));
        if ((f.couples || []).indexOf(key) < 0) { f.couples = (f.couples || []).concat([key]); S.put('families', f, 'Confirmed ' + (c.kind === 'spouse' ? 'spouses' : 'partners') + ': ' + H.name(S.get('people', c.a)) + ' and ' + H.name(S.get('people', c.b))); }
        var ids = []; if (c.copy) ids.push(c.copy.to); if (c.mark && ids.indexOf(c.mark.id) < 0) ids.push(c.mark.id);
        ids.forEach(function (id) {
          var q = JSON.parse(JSON.stringify(S.get('people', id))), what = [];
          if (c.mark && c.mark.id === id) { q.maritalStatus = c.mark.status; what.push('marital status ' + c.mark.status); }
          if (c.copy && c.copy.to === id) {
            q.keyDates = (q.keyDates || []).filter(function (k) { return !WEDDING.test(k.label || ''); }).concat([{ label: 'Wedding anniversary', date: c.copy.date }]);
            what.push('wedding anniversary from ' + H.name(S.get('people', c.copy.from)));
          }
          S.put('people', q, 'Couple: ' + what.join(', ') + ' for ' + H.name(q));
        });
        H.render(); H.toast(T(c.kind === 'spouse' ? 'Confirmed as married' : 'Confirmed as partners'));
      },
      notcouple: function (el) {
        var f = S.get('families', el.dataset.f); if (!f || !canCouples()) return;
        f = JSON.parse(JSON.stringify(f)); f.notCouples = (f.notCouples || []).concat([HS.pairKey(el.dataset.a, el.dataset.b)]);
        S.put('families', f, 'Not a couple: ' + H.name(S.get('people', el.dataset.a)) + ' and ' + H.name(S.get('people', el.dataset.b)));
        H.render(); H.toast(T('Won’t be suggested again'));
      },
      renamefam: function (el) {
        var f = S.get('families', el.dataset.id);
        H.modal(H.dialogHead(T('Rename {name}', { name: H.familyName(f) })) + '<div class="dlg-body">' +
          '<label class="check"><input type="radio" name="rf-mode" value="auto"' + (f.custom ? '' : ' checked') + '><span><b>' + T('Name after the adults') + '</b> <span class="muted">' + T('(recommended, updates itself)') + '</span></span></label>' +
          '<label class="check"><input type="radio" name="rf-mode" value="own"' + (f.custom ? ' checked' : '') + '><span><b>' + T('Use this name') + '</b></span></label>' +
          '<label class="field"><span class="sr">' + T('Household name') + '</span><input id="rf-name" value="' + esc(f.custom ? f.name : '') + '" placeholder="' + esc(T('e.g. The Jacobs household')) + '"></label></div>' +
          '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn primary" data-act="people:saverename" data-id="' + f.id + '">' + T('Save') + '</button></div>', T('Rename household'));
        var inp = document.getElementById('rf-name');
        inp.addEventListener('input', function () { document.querySelector('input[name="rf-mode"][value="own"]').checked = true; });
      },
      saverename: function (el) {
        var f = JSON.parse(JSON.stringify(S.get('families', el.dataset.id))), own = document.querySelector('input[name="rf-mode"]:checked').value === 'own', n = document.getElementById('rf-name').value.trim();
        if (own && !n) { H.toast(T('Type the name, or choose “Name after the adults”'), true); return; }
        if (own) { f.name = n; f.custom = true; } else { f.custom = false; }
        S.put('families', f, 'Renamed a household: ' + (own ? n : 'named after its adults'));
        H.closeModal(); H.render(); H.toast(T('Saved – shown as {name}', { name: H.familyName(f) }));
      },
      archive: function (el) {
        if (!H.confirmBtn(el, T('Click again: mark as left'))) return;
        var p = S.get('people', el.dataset.id); p.active = false; p.category = 'Former member'; p.archivedAt = H.today();
        S.put('people', p, 'Marked as left: ' + H.name(p)); H.closeModal(); H.go('people'); H.toast(T('{name} marked as left. Delete them later under Privacy → Retention.', { name: H.name(p) }));
      }
    }
  });
  window.PeopleHelpers = { hasConsent: hasConsent, consentFor: consentFor, members: members, age: age, exportPerson: exportPerson };
})();
