/* Church Hub – People: Advanced search (filters, columns, CSV download) and Change selected… for many people at once. */
(function (P) {
  'use strict';
  var H = Hub, esc = H.esc, S = Store, T = I18n.t, TN = I18n.tn;
  var TX = function (s) { return s; };   // a text kept in a list, translated where it is shown (the language test checks it)
  var CATS = P.CATS, GENDERS = P.GENDERS, HS = P.HS, MARITAL = P.MARITAL, PS = P.PS, PURPOSES = P.PURPOSES, RECEIVE_P = P.RECEIVE_P, SORTS = P.SORTS, state = P.state;
  // From the other People files (each looked up when called)
  function addressLines() { return P.addressLines.apply(this, arguments); }
  function age() { return P.age.apply(this, arguments); }
  function canBasic() { return P.canBasic.apply(this, arguments); }
  function canChildren() { return P.canChildren.apply(this, arguments); }
  function canSeeAll() { return P.canSeeAll.apply(this, arguments); }
  function deceased() { return P.deceased.apply(this, arguments); }
  function first() { return P.first.apply(this, arguments); }
  function hasConsent() { return P.hasConsent.apply(this, arguments); }
  function householdNames() { return P.householdNames.apply(this, arguments); }
  function keyDate() { return P.keyDate.apply(this, arguments); }
  function lateSpouse() { return P.lateSpouse.apply(this, arguments); }
  function linkName() { return P.linkName.apply(this, arguments); }
  function links() { return P.links.apply(this, arguments); }
  function listName() { return P.listName.apply(this, arguments); }
  function serveTimes() { return P.serveTimes.apply(this, arguments); }
  function slotIds() { return P.slotIds.apply(this, arguments); }
  function slotName() { return P.slotName.apply(this, arguments); }
  function sortKey() { return P.sortKey.apply(this, arguments); }
  function sortSwitch() { return P.sortSwitch.apply(this, arguments); }
  function uniq() { return P.uniq.apply(this, arguments); }
  function visiblePeople() { return P.visiblePeople.apply(this, arguments); }

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
  /** What this person may search on, and how to read it. Only what their role may see – never medical or pastoral notes. */
  function searchFields() {
    var all = canSeeAll(), roster = H.can('*') || H.can('rosters.view'), kids = canChildren(), birth = all || H.can('children');
    var serve = roster ? servingInfo() : {}, sv = function (p) { return serve[p.id] || { pos: [], teams: [], last: '', next: '' }; };
    var F = [], add = function (ok, group, key, label, type, get, options, alts, more) { if (ok) F.push(Object.assign({ group: T(group), key: key, label: T(label), en: label, type: type, get: get, options: options, alts: alts }, more)); };
    add(true, TX('Name and contact'), 'name', TX('Name'), 'text', function (p) { return H.name(p); }, null, function (p) { return H.names(p); });   // also finds Douglas when known as Doug
    add(true, TX('Name and contact'), 'firstName', TX('First name'), 'text', function (p) { return p.firstName; }, null, function (p) { return p.preferredName ? [p.preferredName] : []; });
    add(true, TX('Name and contact'), 'lastName', TX('Last name'), 'text', function (p) { return p.lastName; });
    add(true, TX('Name and contact'), 'preferredName', TX('Preferred name'), 'text', function (p) { return p.preferredName; });
    add(P.tierSees('email'), TX('Name and contact'), 'email', TX('Email'), 'text', function (p) { return P.mayShare(p, 'email') ? p.email : ''; });   // only what their role may see
    add(P.tierSees('mobile'), TX('Name and contact'), 'mobile', TX('Mobile'), 'text', function (p) { return P.mayShare(p, 'mobile') ? p.mobile : ''; });
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
    add(all, TX('Privacy'), 'directory', TX('Shares contact details'), 'yesno', function (p) { return hasConsent(p.id, 'Church directory'); });
    add(H.can('access.manage'), TX('Privacy'), 'access', TX('App access'), 'choice', function (p) { return (H.ROLES[p.appRole || 'member'] || {}).label; }, Object.keys(H.ROLES).map(function (r) { return H.ROLES[r].label; }));
    add(all, TX('Staff'), 'staff', TX('Church staff member'), 'yesno', function (p) { return !!p.staff; });
    add(all, TX('Staff'), 'staffCategory', TX('Staff category'), 'text', function (p) { return p.staff ? p.staff.category : ''; });
    add(all, TX('Staff'), 'staffStart', TX('Started working'), 'date', function (p) { return p.staff ? p.staff.start : ''; });
    // Church office notes (Administrators and Pastors). Pastoral and medical notes are never searchable.
    var office = {}; if (H.can('*') || H.can('people.edit')) S.list('officeNotes').forEach(function (n) { (office[n.personId] = office[n.personId] || []).push(n.text); });
    add(H.can('*') || H.can('people.edit'), TX('Notes'), 'officeNotes', TX('Church office notes'), 'text', function (p) { return (office[p.id] || []).join(' · '); });
    add(roster, TX('Serving'), 'volunteer', TX('Volunteer'), 'yesno', function (p) { return sv(p).pos.length > 0; });
    add(roster, TX('Serving'), 'serviceTimes', TX('Volunteers at service'), 'list', function (p) { return serveInfoTimes(p.id); }, slotIds().map(slotName));
    add(roster, TX('Serving'), 'awaySoon', TX('Away in the next 8 weeks'), 'yesno', function (p) { return awaySoon(p.id); });
    // Their spouse or partner (couples worked out from each household, as on their page): "partners whose wives' names begin with A"
    var mate = {};
    if (all) HS.couples(S.list('people'), S.list('families')).forEach(function (c) { var a = S.get('people', c.a), b = S.get('people', c.b); if (a && b) { mate[a.id] = mate[a.id] || b; mate[b.id] = mate[b.id] || a; } });
    add(all, TX('Personal'), 'spouse', TX('Spouse or partner'), 'text', function (p) { return mate[p.id] ? H.name(mate[p.id]) : ''; }, null, function (p) { return mate[p.id] ? H.names(mate[p.id]) : []; });
    add(all, TX('Personal'), 'spouseCategory', TX('Spouse or partner’s category'), 'choice', function (p) { return mate[p.id] ? mate[p.id].category || '' : ''; }, CATS);
    add(all, TX('Personal'), 'spouseGender', TX('Spouse or partner’s gender'), 'choice', function (p) { return mate[p.id] ? mate[p.id].gender || '' : ''; }, GENDERS);
    add(all, TX('Personal'), 'spouseAge', TX('Spouse or partner’s age'), 'number', function (p) { return mate[p.id] ? age(mate[p.id]) : ''; });
    // Their care groups and midweek groups (names), for those who may see the groups: "Church Partners who aren't in a care group"
    var groupsOf = function (kind) {
      var m = {}; S.list(kind).forEach(function (g) { (g.memberIds || []).concat(g.leaderIds || []).forEach(function (id) { var l = m[id] = m[id] || []; if (l.indexOf(g.name) < 0) l.push(g.name); }); });
      return m;
    };
    var seesCare = all || H.can('care.view'), care = seesCare && H.isOn('care') ? groupsOf('careGroups') : null, life = all && H.isOn('life') ? groupsOf('lifeGroups') : null;
    add(!!care, TX('Church'), 'careGroup', TX('Care group'), 'list', function (p) { return care[p.id] || []; }, care ? uniq(S.list('careGroups').map(function (g) { return g.name; })) : []);
    add(!!life, TX('Church'), 'midweekGroup', TX('Midweek group'), 'list', function (p) { return life[p.id] || []; }, life ? uniq(S.list('lifeGroups').map(function (g) { return g.name; })) : []);
    add(all, TX('Personal'), 'lateSpouse', TX('Late spouse'), 'text', function (p) { var l = lateSpouse(p); return l ? H.name(l) : p.lateSpouseName || ''; });
    add(all, TX('Name and contact'), 'postcode', TX('Postcode'), 'text', function (p) { return (p.address || {}).postcode || ''; });
    add(all, TX('Name and contact'), 'province', TX('Province'), 'text', function (p) { return (p.address || {}).province || ''; });
    add(all, TX('Name and contact'), 'country', TX('Country'), 'choice', function (p) { return String((p.address || {}).country || '').trim(); },
      uniq([Countries.church(S.settings()).name].concat(S.list('people').map(function (p) { return String((p.address || {}).country || '').trim(); }).filter(Boolean))).sort());
    add(H.can('*'), TX('Church'), 'elvantoId', TX('Elvanto ID'), 'text', function (p) { return p.elvantoId || ''; });
    // ID numbers (Administrators): a filter only – never a column, a download or on screen. Fetched when Search is pressed.
    add(H.can('idnumbers'), TX('Privacy'), 'idNumber', TX('ID number'), 'text', function (p) { return idNums ? idNums[p.id] || '' : ''; }, null, null, { noCol: true });
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
  /** ID numbers fetched for an advanced search on them ({ personId: value }); only in memory, dropped on Start again. */
  var idNums = null;
  function idFilters() { return state.adv.filters.filter(function (f) { return f.field === 'idNumber'; }); }
  function idTooShort() { return idFilters().some(function (f) { return ['eq', 'ne', 'has', 'nhas', 'starts'].indexOf(f.op) >= 0 && String(f.value || '').replace(/\s+/g, '').length < 4; }); }
  function advRun(F) {
    var A = state.adv, byKey = {}; F.forEach(function (f) { byKey[f.key] = f; });
    if (byKey.idNumber && idFilters().length) {
      if (idTooShort()) return { error: T('Type at least 4 digits of the ID number.') };
      if (!idNums) return { error: T('Press Search to look up ID numbers.') };
    }
    var usesStatus = A.filters.some(function (f) { return f.field === 'status' || f.field === 'died' || f.field === 'diedYear'; });
    var people = canSeeAll() ? S.find('people', function (p) { return !p.deletedAt && p.firstName !== 'Deleted' && !p.binnedAt; }) : visiblePeople();
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
  /* ---------- search in your own words (js/ask.js): typed or spoken, turned into the filters below or into a list of services ---------- */
  // Examples in English: the rules understand English (the church's own words too, e.g. Parishioners)
  var ASK_EX = ['Church Partners who are men, with birthdays in April', 'People without an ID number who are volunteers and have a home address',
    '10am services between 12 November and 2 February that don’t have all positions filled', 'Women over 60 who live in Howick'];
  function canRoster() { return H.can('*') || H.can('rosters.view'); }
  function timeOf(sv) { var id = Serving.slotOf(sv), x = Serving.savedSlots(S.settings()).filter(function (y) { return y.id === id; })[0]; return (x && x.time) || sv.time || ''; }
  function askCtx(F) {
    var st = S.settings(), fields = {}; F.forEach(function (f) { fields[f.key] = true; });
    var roster = canRoster();
    return { today: H.today(), fields: fields, services: roster, words: Wording.words(st), slotLabel: function (id) { return Serving.slotLabel(id, st); },
      slots: Serving.allSlots(st).map(function (x) { return { id: x.id, label: x.label, time: x.time }; }),
      positions: roster ? uniq(S.list('positions').map(function (x) { return x.name; })) : [], teams: roster ? uniq(S.list('teams').map(function (x) { return x.name; })) : [],
      careGroups: fields.careGroup ? uniq(S.list('careGroups').map(function (g) { return g.name; })) : [],
      midweekGroups: fields.midweekGroup ? uniq(S.list('lifeGroups').map(function (g) { return g.name; })) : [],
      towns: fields.town ? uniq(S.list('people').map(function (p) { return String((p.address || {}).city || '').trim(); }).filter(Boolean)) : [],
      people: roster ? S.list('people').filter(function (p) { return !p.deletedAt; }).map(function (p) { return { id: p.id, names: H.names(p) }; }) : [] };
  }
  /** Ask: understand the question, then fill in the filters and search (people) or list the services. */
  function ask(text) {
    text = String(text || '').trim(); if (!text) return;
    var F = searchFields(), r = Ask.parse(text, askCtx(F)), byKey = {}; F.forEach(function (f) { byKey[f.key] = f; });
    state.ask = { text: text, r: r };
    if (r.kind === 'people' && r.filters.length) {
      var A = state.adv = emptyAdv();
      A.filters = r.filters.map(function (f) { return { field: f.field, op: f.op, value: f.value, value2: f.value2 || '', unit: f.unit || '' }; });
      A.match = r.match; A.logic = r.logic || '';
      r.filters.forEach(function (f) { if (f.field !== 'name' && byKey[f.field] && !byKey[f.field].noCol && A.cols.indexOf(f.field) < 0) A.cols.push(f.field); });
      S.audit('Searched in their own words: ' + text, 'people');
      return P.actions.advrun();
    }
    H.render();
    var el = document.getElementById('ask-result'); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  function fieldNames(keys, byKey) { return keys.map(function (k) { return k === 'services' ? T('Rosters') : byKey[k] ? byKey[k].label : T(Ask.THING_LABEL[k] || k); }).join(', '); }
  function askPanel(F, byKey) {
    var a = state.ask, r = a && a.r, mic = askMicOk();
    var html = '<section class="panel ask" id="ask" data-noauto><h2>' + T('Ask in your own words') + '</h2>' +
      '<form class="ask-row" onsubmit="return false"><input type="search" id="ask-q" value="' + esc(a ? a.text : '') + '" placeholder="' + esc('e.g. ' + ASK_EX[0]) + '" autocomplete="off" enterkeyhint="search" aria-label="' + esc(T('Ask in your own words')) + '">' +
        (mic ? '<button type="button" class="icon-btn ask-mic" id="ask-mic" data-act="people:askmic" aria-label="' + esc(T('Speak your question – your phone or browser’s speech service turns it into text')) + '" title="' + esc(T('Speak your question – your phone or browser’s speech service turns it into text')) + '">' +
          H.icon('M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM19 11a7 7 0 0 1-14 0M12 18v3', 20) + '</button>' : '') +
        '<button type="submit" class="btn primary" data-act="people:ask">' + H.icon(H.ICON.search, 18) + T('Ask') + '</button></form>' +
      '<p class="ask-live" id="ask-live" role="status" aria-live="polite" hidden></p>' +
      // The examples: open until something has been asked, then folded away (tap to open again)
      '<details class="ask-exw"' + (a ? '' : ' open') + '><summary class="hint">' + T('Type or say what you’re looking for, in English. Tap an example to try it:') + '</summary><div class="ask-ex">' +
        ASK_EX.filter(function (x, i) { return i !== 2 || canRoster(); }).map(function (x) { return '<button type="button" class="ask-chip" data-act="people:askex">' + esc(x) + '</button>'; }).join('') + '</div></details>';
    if (r) {
      var said = r.kind === 'people' ? state.adv.filters.map(function (f) { return PS.describe(f, byKey[f.field], function (v) { return advShow({ type: byKey[f.field] && byKey[f.field].type === 'date' ? 'date' : 'text' }, v); }); })
        : (r.said || []).map(function (x) { return T(x[0], x[1] || undefined); });
      var none = r.kind === 'people' ? !r.filters.length : false;
      html += '<div class="ask-said" id="ask-said">' + (none ? '<p class="note bad" role="alert">' + T('Nothing in that was understood. Try one of the examples.') + '</p>' :
        '<p><b>' + T('Understood as') + ':</b> ' + said.map(function (x) { return '<span class="tag">' + esc(x) + '</span>'; }).join(r.kind === 'people' && state.adv.match === 'logic' ? ' ' : ' ') +
        (r.kind === 'people' && state.adv.match === 'logic' ? ' <span class="muted small">(' + esc(state.adv.logic) + ')</span>' : '') + '</p>') +
        (r.noPerson ? '<p class="note bad">' + T('No one called “{name}” was found.', { name: esc(r.noPerson) }) + '</p>' : '') +
        (r.refused.length ? '<p class="note bad">' + (r.refused.indexOf('services') >= 0 ? T('You can’t see the rosters, so services can’t be searched.') : T('Your role can’t search on: {fields}', { fields: esc(fieldNames(r.refused, byKey)) })) + '</p>' : '') +
        (r.unknown.length ? '<p class="hint">' + T('Not understood: {words}', { words: esc(r.unknown.join(' ')) }) + '</p>' : '') + '</div>';
      if (r.kind === 'services' && r.q && canRoster() && !r.noPerson) html += servicesResult(r.q);
    }
    return html + '</section>';
  }
  function servicesResult(q) {
    var st = S.settings(), special = Serving.specialSlots(st).map(function (x) { return x.id; });
    var rows = Ask.services({ services: S.list('services'), assignments: S.list('assignments'), positions: S.list('positions'), timeOf: timeOf,
      runsAt: function (p, s) { return RosterCore.runsAt(p, s, special); } }, q);
    return '<div id="ask-result"><h3 style="margin:16px 0 8px">' + TN('{n} service found', '{n} services found', rows.length) + '</h3>' + (rows.length ? '<div class="table-wrap"><table class="simple"><thead><tr><th>' + T('Date') + '</th><th>' + T('Service') + '</th>' +
      (q.personId ? '<th>' + T('Serving') + '</th>' : '') + '<th>' + T('Still needed') + '</th></tr></thead><tbody>' + rows.map(function (x) {
        var s = x.service;
        return '<tr><td><a href="#/rosters">' + esc(H.fmt(s.date)) + '</a></td><td>' + esc(Serving.slotLabel(Serving.slotOf(s), st)) + '</td>' +
          (q.personId ? '<td>' + esc(x.mine.map(function (p) { return p.name; }).join(', ')) + '</td>' : '') +
          '<td>' + (x.gaps.length ? esc(x.gaps.map(function (g) { return g.position.name + (g.missing > 1 ? ' ×' + g.missing : ''); }).join(', ')) : '<span class="muted">' + T('All filled') + '</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="empty">' + T('No services match.') + '</p>') + '</div>';
  }
  /* ---------- the microphone: the browser's own speech-to-text, or the Android app's (ChurchHubApp.listen) ---------- */
  function speechApi() { return typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition); }
  function appListens() { return typeof window !== 'undefined' && window.ChurchHubApp && typeof window.ChurchHubApp.listen === 'function'; }
  function askMicOk() { return !!(appListens() || speechApi()); }
  function speechLang() { return 'en-' + (Countries.church(S.settings()).code || 'ZA'); }
  var rec = null;
  function micState(on, msg) {
    var b = document.getElementById('ask-mic'), live = document.getElementById('ask-live');
    if (b) { b.classList.toggle('on', !!on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); }
    if (live) { live.textContent = msg || ''; live.hidden = !msg; }
  }
  /** What was heard: into the box, then asked (the Android app calls this too, with null when nothing was heard). */
  window.churchHubHeard = function (text, final) {
    var box = document.getElementById('ask-q');
    if (text == null) { micState(false, T('Couldn’t hear that – try again.')); return; }
    if (box) box.value = text;
    if (final !== false) { micState(false, ''); ask(text); }
  };
  function listen() {
    if (rec) { try { rec.stop(); } catch (e) { /* already stopped */ } return; }
    if (appListens()) { micState(true, T('Listening… speak now')); window.ChurchHubApp.listen(speechLang()); return; }
    var SR = speechApi(); if (!SR) return;
    var got = '', r = rec = new SR();
    r.lang = speechLang(); r.interimResults = true; r.maxAlternatives = 1; r.continuous = false;
    r.onresult = function (ev) {
      var t = ''; for (var i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript;
      got = t; window.churchHubHeard(t, false);
    };
    r.onerror = function (ev) { rec = null; micState(false, ev.error === 'not-allowed' || ev.error === 'service-not-allowed' ? T('Allow the microphone for Church Hub in your browser’s settings.') : T('Couldn’t hear that – try again.')); };
    r.onend = function () { var had = rec; rec = null; if (had && got.trim()) window.churchHubHeard(got.trim(), true); else if (had) micState(false, ''); };
    micState(true, T('Listening… speak now'));
    try { r.start(); } catch (e) { rec = null; micState(false, T('Couldn’t hear that – try again.')); }
  }
  function renderSearch() {
    var crumb = '<a class="crumb" href="#/people">' + H.icon(H.ICON.back, 16) + T('People') + '</a>';
    if (!canBasic()) return crumb + '<p class="empty">' + T('Advanced search isn’t available to you.') + '</p>';
    var A = state.adv, F = searchFields(), byKey = {}, groups = [];
    F.forEach(function (f) { byKey[f.key] = f; if (groups.indexOf(f.group) < 0) groups.push(f.group); });
    A.cols = A.cols.filter(function (k) { return byKey[k] && !byKey[k].noCol && k !== 'name'; });
    // like Elvanto: open the list, then type part of a field's name ("marit") to narrow it down. Also for Add a column (i = 'col').
    var fieldSelect = function (f, i, list, label) {
      var cur = byKey[f.field], col = i === 'col', FL = list || F;
      return '<span class="adv-fpick" data-i="' + i + '">' +
        '<button type="button" class="adv-fbtn" data-i="' + i + '" aria-haspopup="listbox" aria-expanded="false" aria-label="' + esc(col ? T('Add a column') : T('Filter {n}: search on {field}', { n: i + 1, field: cur ? cur.label : T('nothing yet') })) + '">' +
          '<span>' + esc(label || (cur ? cur.label : T('Choose a field…'))) + '</span></button>' +
        '<span class="adv-fpop" hidden><input type="search" class="adv-ff" data-i="' + i + '" placeholder="' + esc(T('Type to find a field…')) + '" autocomplete="off" aria-label="' + esc(T('Type to find a field')) + '" aria-controls="adv-fl' + i + '">' +
          '<span class="adv-flist" id="adv-fl' + i + '" role="listbox">' + groups.filter(function (g) { return FL.some(function (x) { return x.group === g; }); }).map(function (g) {
            return '<span class="adv-fg" role="group" aria-label="' + esc(g) + '"><span class="adv-fgh">' + esc(g) + '</span>' + FL.filter(function (x) { return x.group === g; }).map(function (x) {
              return '<button type="button" class="adv-fo' + (x.key === f.field ? ' on' : '') + '" role="option" aria-selected="' + (x.key === f.field) + '" data-i="' + i + '" data-key="' + x.key + '" data-text="' + esc(x.label) + '">' + esc(x.label) + '</button>';
            }).join('') + '</span>';
          }).join('') + '<span class="adv-fnone muted" hidden>' + T('No field matches') + '</span></span></span>' +
        '<select class="' + (col ? '' : 'adv-field ') + 'sr-only"' + (col ? ' id="adv-addcol"' : '') + ' data-i="' + i + '" tabindex="-1" aria-hidden="true">' + (cur ? '' : '<option value="">' + T('Choose…') + '</option>') + groups.map(function (g) {   // the same list, for the tests and screen readers
          return '<optgroup label="' + esc(g) + '">' + FL.filter(function (x) { return x.group === g; }).map(function (x) { return '<option value="' + x.key + '"' + (x.key === f.field ? ' selected' : '') + '>' + esc(x.label) + '</option>'; }).join('') + '</optgroup>';
        }).join('') + '</select></span>';
    };
    var word = A.match === 'any' ? 'OR' : 'AND', logicNote = '';
    if (A.match === 'logic' && A.logic.trim()) { var pl = PS.parseLogic(A.logic, A.filters.length); if (!pl.error && pl.unused.length) logicNote = '<p class="hint">' + T('Not used in your logic: filter {list}.', { list: pl.unused.join(', ') }) + '</p>'; }
    var html = crumb + '<div class="page-head"><div><h1>' + T('Advanced search') + '</h1><p class="lead">' + T('Find people by any mix of details, as in Elvanto. You can only search on what your role may see.') + '</p></div></div>' +
      askPanel(F, byKey) +
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
      '<div class="field adv-addcol-w" style="max-width:320px;margin-top:12px"><span>' + T('Add a column') + '</span>' +
        fieldSelect({ field: '' }, 'col', F.filter(function (x) { return x.key !== 'name' && !x.noCol && A.cols.indexOf(x.key) < 0; }), T('Type or choose a field…')) + '</div></section>' +
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
    var noHome = function (p) { var a = p.address || {}; return !(a.street || a.street2 || a.city || a.postcode); };
    /** One part of the home address. A country or province on its own isn't an address, so people with none are left out of those. */
    function addr(part, label, o) {
      return Object.assign({ key: 'addr-' + part, label: label, keys: ['address'], get: function (p) { return (p.address || {})[part]; },
        set: function (q, v) { var a = Object.assign({}, q.address || {}); if (v) a[part] = v; else delete a[part]; if (Object.keys(a).some(function (k) { return a[k]; })) q.address = a; else delete q.address; },
        skip: o.needs ? function (p) { return noHome(p) && TX('people with no home address'); } : null, note: o.needs ? TX('People with no home address are left out.') : '' }, o);
    }
    return [
      { key: 'maritalStatus', label: TX('Marital status'), options: MARITAL, keys: ['maritalStatus'], set: plain('maritalStatus'), get: function (p) { return p.maritalStatus; },
        skip: function (p) { return p.familyRole === 'child' && TX('children'); }, note: TX('Children are left out: they have no marital status.') },
      { key: 'category', label: TX('Category'), options: CATS.filter(function (c) { return c !== 'Deceased'; }), keys: ['category'], set: plain('category'), get: function (p) { return p.category; },
        skip: function (p) { return dead(p) && TX('people who have died'); } },
      { key: 'gender', label: TX('Gender'), options: GENDERS, blank: TX('Not recorded'), keys: ['gender'], set: plain('gender'), get: function (p) { return p.gender; } },
      { key: 'partnerSince', label: TX('Date accepted as Church Partner'), date: true, keys: ['partnerSince'], set: plain('partnerSince'), get: function (p) { return p.partnerSince; } },
      { key: 'partnerUpdated', label: TX('Partnership last updated'), date: true, keys: ['partnerUpdated'], set: plain('partnerUpdated'), get: function (p) { return p.partnerUpdated; } },
      { key: 'email', label: TX('Email (where it’s missing)'), options: [TX('Unknown')], keys: ['emailUnknown'], set: function (q) { q.emailUnknown = true; },
        skip: function (p) { return p.email ? TX('already have an email address') : p.familyRole === 'child' ? TX('children') : ''; }, note: TX('Only for adults with no email address. Anyone who has one is left alone.') },
      { key: 'mobile', label: TX('Mobile (where it’s missing)'), options: [TX('Unknown')], keys: ['mobileUnknown'], set: function (q) { q.mobileUnknown = true; },
        skip: function (p) { return p.mobile ? TX('already have a mobile number') : p.familyRole === 'child' ? TX('children') : ''; }, note: TX('Only for adults with no mobile number. Anyone who has one is left alone.') },
      addr('city', TX('Town or city'), { text: true }),
      addr('postcode', TX('Postcode'), { text: true }),
      addr('province', TX('Province, state or region'), { text: true, list: (Countries.church(S.settings()).regions || []).slice(), needs: true }),
      addr('country', TX('Country'), { options: [Countries.church(S.settings()).name].concat(Countries.all().map(function (c) { return c.name; }).filter(function (n) { return n !== Countries.church(S.settings()).name; })), raw: true, needs: true }),
      { key: 'household', label: TX('Household (where it’s missing)'), options: [TX('+ New household for each person')], keys: ['familyId'],
        skip: function (p) { return (p.familyId || (p.householdIds || []).length) ? TX('already in a household') : ''; },
        set: function (q, v, made) { var f = S.put('families', { name: q.lastName + ' family', custom: false }); made.push(f.id); q.familyId = f.id; if (!q.familyRole) q.familyRole = 'adult'; },
        note: TX('Each person with no household gets one of their own, named after their surname. People who live together can be moved into one household afterwards.') }
    ].concat(CONSENT_BULK.map(function (pur) {
      // Consent (POPIA): a new record for each person – today's date, how it was given, who recorded it – never a change to an old one
      return { key: 'consent-' + pur, consent: pur, label: 'Consent: ' + pur, show: function () { return T('Consent') + ': ' + T(P.purposeName(pur)); },
        options: [TX('Yes'), TX('No')], keys: [], get: function (p) { var c = P.consentFor(p.id, pur); return c ? (c.given ? 'Yes' : 'No') : ''; },
        skip: function (p) { return p.familyRole === 'child' ? TX('children') : dead(p) ? TX('people who have died') : ''; },
        note: TX('A new consent record for each person, dated today, with how it was given (POPIA). Children are left out: a parent or guardian answers for them on the child’s page.') };
    }));
  }
  /** Consents an Administrator may record for many adults at once (Children's medical notes stay with Children's ministry). */
  var CONSENT_BULK = ['Church records', 'Email', 'SMS', 'Church directory', 'Care group', 'Photos'];
  var CONSENT_HOW = [TX('Paper connect card'), TX('Online form'), TX('In person (verbal)'), TX('Email')];
  function fieldName(x) { return x.show ? x.show() : T(x.label); }
  function bulkUndoNote() {
    var u = state.bulkUndo; if (!u) return '';
    var why = Object.keys(u.skipped || {}).map(function (k) { return u.skipped[k] + ' ' + T(k); });
    return '<div class="note ok" role="status" style="margin-bottom:12px">' + TN('Changed {field} to {value} for {n} person', 'Changed {field} to {value} for {n} people', u.items.length, { field: '<b>' + esc(u.show || T(u.label)) + '</b>', value: '<b>' + esc(u.value ? T(u.value) : T('nothing')) + '</b>' }) +
      (why.length ? ' (' + esc(T('left out: {who}', { who: why.join(', ') })) + ')' : '') + '. <button class="link" data-act="people:bulkundo">' + T('Undo') + '</button></div>';
  }
  function bulkDialog() {
    var ids = Object.keys(state.adv.sel || {}), F = bulkFields(), f = F[0];
    if (!ids.length) return;
    var valueBox = function (fd) {
      return fd.date ? '<input type="date" id="bk-v" max="' + H.today() + '">' :
        fd.text ? '<input id="bk-v" autocomplete="off"' + (fd.list && fd.list.length ? ' list="bk-list"><datalist id="bk-list">' + fd.list.map(function (o) { return '<option value="' + esc(o) + '">'; }).join('') + '</datalist>' : '>') :
        '<select id="bk-v">' + (fd.blank ? '<option value="">' + esc(T(fd.blank)) + '</option>' : '<option value="">' + T('Choose…') + '</option>') + fd.options.map(function (o) { return '<option value="' + esc(o) + '">' + esc(fd.raw ? o : T(o)) + '</option>'; }).join('') + '</select>';
    };
    H.modal(H.dialogHead(TN('Change {n} person', 'Change {n} people', ids.length), T('The same change for everyone you ticked. You can undo it straight after.')) + '<div class="dlg-body">' +
      '<div class="two"><label class="field req">' + T('What to change') + '<select id="bk-f">' + F.map(function (x) { return '<option value="' + x.key + '">' + esc(fieldName(x)) + '</option>'; }).join('') + '</select></label>' +
      '<label class="field req" id="bk-v-f">' + T('New value') + valueBox(f) + '</label></div>' +
      '<label class="field req" id="bk-m-f" hidden>' + T('How it was given') + '<select id="bk-m"><option value="">' + T('Choose…') + '</option>' + CONSENT_HOW.map(function (m) { return '<option value="' + esc(m) + '">' + esc(T(m)) + '</option>'; }).join('') + '</select></label>' +
      '<p class="hint" id="bk-note">' + esc(f.note ? T(f.note) : '') + '</p>' +
      '<label class="check" id="bk-empty-w"' + (f.get ? '' : ' hidden') + '><input type="checkbox" id="bk-empty"><span>' + T('Only where it’s empty – leave anything already filled in') + '</span></label>' +
      '<details><summary class="small">' + T('Who will change ({n})', { n: ids.length }) + '</summary><p class="small muted" style="margin:6px 0 0">' + esc(ids.map(function (id) { return H.name(S.get('people', id)); }).join(', ')) + '</p></details>' +
      '<p id="bk-err" class="note bad" hidden></p></div>' +
      '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn primary" data-act="people:bulksave">' + TN('Change {n} person', 'Change {n} people', ids.length) + '</button></div>', T('Change many people'));
    var fs = document.getElementById('bk-f');
    fs.addEventListener('change', function () {
      var fd = F.filter(function (x) { return x.key === fs.value; })[0], box = document.getElementById('bk-v-f');
      box.innerHTML = T('New value') + valueBox(fd); box.classList.toggle('req', !fd.blank);
      document.getElementById('bk-note').textContent = fd.note ? T(fd.note) : '';
      document.getElementById('bk-empty-w').hidden = !fd.get; if (!fd.get) document.getElementById('bk-empty').checked = false;
      document.getElementById('bk-m-f').hidden = !fd.consent;
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
    var i = o.dataset.i;
    if (i === 'col') { fieldClose(); state.adv.cols.push(o.dataset.key); H.render(); var cb = document.querySelector('.adv-fbtn[data-i="col"]'); if (cb) cb.focus(); return; }
    var sel = document.querySelector('.adv-field[data-i="' + i + '"]'); if (!sel) return;
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


  Object.assign(P.actions, {
    advadd: function (el) { var i = +el.dataset.i, prev = state.adv.filters[i]; state.adv.filters.splice(i + 1, 0, { field: prev ? prev.field : 'name', op: prev ? prev.op : 'has', value: '', value2: '', unit: 'days' }); H.render(); var s2 = document.querySelectorAll('.adv-fbtn')[i + 1]; if (s2) s2.focus(); },
    advdel: function (el) { state.adv.filters.splice(+el.dataset.i, 1); H.render(); },
    advcol: function (el) {
        var c = state.adv.cols, i = c.indexOf(el.dataset.k), m = +el.dataset.m;
        if (i < 0) return;
        if (!m) c.splice(i, 1); else if (c[i + m]) { c[i] = c[i + m]; c[i + m] = el.dataset.k; }
        H.render();
      },
    ask: function () { var b = document.getElementById('ask-q'); if (b) ask(b.value); },
    askex: function (el) { var b = document.getElementById('ask-q'); if (b) b.value = el.textContent; ask(el.textContent); },
    askmic: function () { listen(); },
    advrun: function () {
      var go = function () { state.adv.ran = true; H.render(); var r = document.getElementById('adv-result'); if (r) r.scrollIntoView({ block: 'start', behavior: 'smooth' }); };
      var idf = idFilters(); idf.forEach(function (f) { f.value = String(f.value || '').replace(/\s+/g, ''); });
      if (!idf.length || !H.can('idnumbers') || idTooShort()) return go();
      Store.idNumbers().then(function (all) {   // fresh each time Search is pressed, and logged with who was found
        idNums = all; go();
        var r = advRun(searchFields()); if (r.error) return;
        var names = r.rows.map(function (x) { return H.name(x.p); });
        S.audit('Searched by ID number (advanced search): ' + (names.length ? names.length + ' found – ' + names.slice(0, 10).join(', ') + (names.length > 10 ? ', …' : '') : 'nobody found'), 'people');
      }, function () { H.toast(T('Couldn’t load the ID numbers'), true); });
    },
    advreset: function () { state.adv = emptyAdv(); state.ask = null; idNums = null; H.render(); },
    advsort: function (el) { var A = state.adv; if (A.sort === el.dataset.k) A.dir = -A.dir; else { A.sort = el.dataset.k; A.dir = 1; } H.render(); },
    advcsv: function () { advCsv(); },
    bulk: function () { if (canBulk()) bulkDialog(); },
    bulksave: function (el) {
        if (!canBulk()) return;
        var fd = bulkFields().filter(function (x) { return x.key === document.getElementById('bk-f').value; })[0], v = document.getElementById('bk-v').value.trim(), err = document.getElementById('bk-err');
        var onlyEmpty = !!fd.get && document.getElementById('bk-empty').checked;
        if (fd.key === 'addr-province' && v) v = Countries.region(v, Countries.church(S.settings()).code);   // "kzn" → KwaZulu-Natal
        if (!v && !fd.blank) { err.textContent = T('Choose the new value.'); err.hidden = false; return; }
        var how = fd.consent ? document.getElementById('bk-m').value : '';
        if (fd.consent && !how) { err.textContent = T('Choose how it was given.'); err.hidden = false; return; }
        var ids = Object.keys(state.adv.sel || {}), items = [], skipped = {}, made = [];
        if (!H.confirmBtn(el, TN('Click again to change {n} person', 'Click again to change {n} people', ids.length))) return;
        H.closeModal();
        H.busy('Changing ' + ids.length + (ids.length === 1 ? ' person' : ' people') + '…', function () {
          ids.forEach(function (id) {
            var p = S.get('people', id); if (!p) return;
            var why = (fd.skip && fd.skip(p)) || (onlyEmpty && String(fd.get(p) || '').trim() && TX('already filled in')); if (why) { skipped[why] = (skipped[why] || 0) + 1; return; }
            var before = {}; fd.keys.forEach(function (k) { before[k] = p.hasOwnProperty(k) ? { v: p[k] } : null; });
            if (fd.consent) {   // a new consent record; the old answer is kept, marked as replaced (withdrawnAt), for the audit trail
              var old = P.consentFor(p.id, fd.consent), want = v === 'Yes';
              if (old && !!old.given === want) { skipped[TX('already recorded')] = (skipped[TX('already recorded')] || 0) + 1; return; }
              if (old) { old = JSON.parse(JSON.stringify(old)); old.withdrawnAt = H.today(); S.put('consents', old); }
              var c = S.put('consents', { personId: p.id, purpose: fd.consent, given: want, date: H.today(), method: how, recordedBy: H.name(H.user()), guardianId: '' },
                'Consent ' + fd.consent + ': ' + (want ? 'agreed' : 'declined') + ' – ' + H.name(p) + ' (' + how + ', changing many people at once)');
              items.push({ id: id, newId: c.id, oldId: old ? old.id : '' });
              if (window.CareUI && fd.consent === 'Care group') CareUI.sync(id);   // their care group card follows their consent
              if (window.LifeUI && fd.consent === 'Church directory') LifeUI.sync(id);   // their life group cards follow Contact details
              return;
            }
            var q = JSON.parse(JSON.stringify(p)); fd.set(q, v, made);
            if (fd.keys.every(function (k) { return JSON.stringify(q[k]) === JSON.stringify(p[k]); })) return;   // nothing to change
            items.push({ id: id, before: before });
            S.put('people', q, 'Changed ' + fd.label.toLowerCase() + ' of ' + H.name(q) + ' to ' + (v || 'nothing') + ' (changing many people at once)');
            if (fd.key === 'category') P.partnerAgrees(q, p.category);   // becoming a Church Partner: Contact details agreed
          });
          S.audit('Changed ' + fd.label.toLowerCase() + ' to ' + (v || 'nothing') + ' for ' + items.length + ' people at once (Advanced search)' + (made.length ? '; ' + made.length + ' households created' : ''), 'people');
          state.bulkUndo = { key: fd.key, keys: fd.keys, label: fd.label, show: fieldName(fd), consent: fd.consent || '', value: v, items: items, skipped: skipped, made: made };
          state.adv.sel = {}; H.render(); H.toast(TN('{n} person changed', '{n} people changed', items.length));
        });
      },
    bulkundo: function () {
        var u = state.bulkUndo; if (!u || !canBulk()) return;
        H.busy(T('Undoing…'), function () {
          u.items.forEach(function (it) {
            if (u.consent) {   // take the new record away and bring the old answer back
              S.remove('consents', it.newId, 'Undid consent ' + u.consent + ' for ' + H.name(S.get('people', it.id)));
              var o = it.oldId && S.get('consents', it.oldId); if (o) { o = JSON.parse(JSON.stringify(o)); delete o.withdrawnAt; S.put('consents', o); }
              if (window.CareUI && u.consent === 'Care group') CareUI.sync(it.id);
              if (window.LifeUI && u.consent === 'Church directory') LifeUI.sync(it.id);
              return;
            }
            var p = S.get('people', it.id); if (!p) return;
            var q = JSON.parse(JSON.stringify(p));
            u.keys.forEach(function (k) { if (it.before[k]) q[k] = it.before[k].v; else delete q[k]; });
            S.put('people', q, 'Undid: ' + u.label.toLowerCase() + ' of ' + H.name(q));
          });
          (u.made || []).forEach(function (fid) { if (!S.find('people', function (p) { return p.familyId === fid || (p.householdIds || []).indexOf(fid) >= 0; }).length) S.remove('families', fid); });
          S.audit('Undid changing ' + u.label.toLowerCase() + ' for ' + u.items.length + ' people', 'people');
          state.bulkUndo = null; H.render(); H.toast(T('Undone'));
        });
      }
  });

  Object.assign(P, { advCsv: advCsv, advRun: advRun, advShow: advShow, advSync: advSync, awaySoon: awaySoon, bulkDialog: bulkDialog, bulkFields: bulkFields, bulkUndoNote: bulkUndoNote, canBulk: canBulk, emptyAdv: emptyAdv, fieldActive: fieldActive, fieldClose: fieldClose, fieldFilter: fieldFilter, fieldOpen: fieldOpen, fieldPick: fieldPick, renderSearch: renderSearch, searchFields: searchFields, serveInfoTimes: serveInfoTimes, servingInfo: servingInfo, valueBox: valueBox });
})(PeopleParts);
