/* Church Hub – People: Households (with couples to confirm), Late spouses and Find duplicates (Same person: fix…). */
(function (P) {
  'use strict';
  var H = Hub, esc = H.esc, S = Store, T = I18n.t, TN = I18n.tn;
  var TX = function (s) { return s; };   // a text kept in a list, translated where it is shown (the language test checks it)
  var DUP = P.DUP, HS = P.HS, WEDDING = P.WEDDING, state = P.state;
  // From the other People files (each looked up when called)
  function allCouples() { return P.allCouples.apply(this, arguments); }
  function canCouples() { return P.canCouples.apply(this, arguments); }
  function canDup() { return P.canDup.apply(this, arguments); }
  function coupleTodo() { return P.coupleTodo.apply(this, arguments); }
  function coupleWord() { return P.coupleWord.apply(this, arguments); }
  function couplesToCheck() { return P.couplesToCheck.apply(this, arguments); }
  function dupPeople() { return P.dupPeople.apply(this, arguments); }
  function hasAccess() { return P.hasAccess.apply(this, arguments); }
  function householdNames() { return P.householdNames.apply(this, arguments); }
  function isDead() { return P.isDead.apply(this, arguments); }
  function lateSpouse() { return P.lateSpouse.apply(this, arguments); }
  function members() { return P.members.apply(this, arguments); }
  function notDup() { return P.notDup.apply(this, arguments); }

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
  function lateSuggestions() { return H.can('*') ? HS.lateSpouseSuggestions(S.list('people'), isDead) : []; }
  function renderLate() {
    var back = '<a class="crumb" href="#/people">' + H.icon(H.ICON.back, 16) + T('People') + '</a>';
    if (!H.can('*')) return back + '<p class="empty">' + T('This is for Administrators.') + '</p>';
    var sug = lateSuggestions();
    var open = S.find('people', function (p) { return p.familyRole !== 'child' && !p.mergedInto && !p.binnedAt && p.maritalStatus === 'Widowed' && !isDead(p) && !lateSpouse(p) && !p.lateSpouseName && !sug.some(function (x) { return x.a === p.id; }); });
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
    var found = DUP.find(dupPeople(), notDup(), P.dupSens());
    return back + '<div class="page-head"><div><h1>' + T('Find duplicates') + '</h1><p class="lead">' + T('People who may have been entered twice. Church Hub compares names (including short forms like Doug and Douglas, “known as”, typing slips, swapped and maiden names), email, mobile, birthday and Elvanto ID. Families sharing an email or phone are not counted as duplicates.') + '</p></div></div>' +
      (found.length ? '<p class="muted small">' + TN('{n} pair to check, most likely first. Open each to compare.', '{n} pairs to check, most likely first. Open each to compare.', found.length) + ' <b>' + T('Same person: fix…') + '</b> ' + T('keeps one record, fills in what it’s missing from the other and moves consents, guardians and serving across.') + '</p>' : '<p class="empty">' + T('No duplicates found.') + '</p>') +
      sensPanel() + found.map(function (d) {
        var a = S.get('people', d.a), b = S.get('people', d.b);
        return '<section class="panel" style="margin-bottom:12px"><div class="row" style="flex-wrap:wrap;gap:8px"><h2 class="grow" style="margin:0;font-size:1rem">' + esc(T(DUPWORD[d.level])) + '</h2><span class="tag ' + (d.level === 'possible' ? 'grey' : 'warn') + '">' + T(d.level === 'possible' ? 'Check' : 'Likely') + '</span></div>' +
          '<p class="hint" style="margin:6px 0 0">' + esc(d.reasons.join(' · ')) + '</p>' +
          '<div class="list" style="margin:10px 0">' + dupCard(a) + dupCard(b) + '</div>' +
          '<div class="btns"><button class="btn small primary" data-act="people:fixdup" data-a="' + d.a + '" data-b="' + d.b + '">' + T('Same person: fix…') + '</button><button class="btn small" data-act="people:notdup" data-a="' + d.a + '" data-b="' + d.b + '">' + T('Not the same person') + '</button></div></section>';
      }).join('');
  }
  /** The sliding scale: how readily people are flagged, here and while someone is typed in. Administrators change it (a church setting). */
  function sensPanel() {
    var n = P.dupSens(), admin = H.can('settings.manage');
    return '<section class="panel" style="margin-bottom:12px"><h2 style="margin:0 0 6px;font-size:1rem">' + T('How sensitive is the duplicate check?') + '</h2>' +
      '<div class="row" style="gap:10px;align-items:center"><span class="muted small">' + T('Fewer warnings') + '</span>' +
      '<input type="range" id="dup-sens" min="1" max="5" step="1" value="' + n + '" class="grow" aria-label="' + esc(T('How sensitive is the duplicate check?')) + '"' + (admin ? '' : ' disabled') + '>' +
      '<span class="muted small">' + T('More warnings') + '</span></div>' +
      '<p class="hint" style="margin:6px 0 0"><b>' + T('Level {n} of 5', { n: n }) + (n === 3 ? ' ' + T('(recommended)') : '') + '.</b> ' +
      T('Moves how readily people are flagged, here and while someone is being typed in. A very likely duplicate is always stopped.') +
      (admin ? '' : ' ' + T('Only an Administrator can change this.')) + '</p></section>';
  }
  if (typeof document !== 'undefined') document.addEventListener('change', function (ev) {
    if (!ev.target || ev.target.id !== 'dup-sens' || !H.can('settings.manage')) return;
    var n = +ev.target.value; S.setSettings({ dupSensitivity: n }, 'Duplicate check sensitivity set to ' + n + ' of 5'); H.render();
    var again = document.getElementById('dup-sens'); if (again) again.focus();
  });

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


  Object.assign(P.actions, {
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
          '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn save" data-act="people:saverename" data-id="' + f.id + '">' + T('Save') + '</button></div>', T('Rename household'));
        var inp = document.getElementById('rf-name');
        inp.addEventListener('input', function () { document.querySelector('input[name="rf-mode"][value="own"]').checked = true; });
      },
    saverename: function (el) {
        var f = JSON.parse(JSON.stringify(S.get('families', el.dataset.id))), own = document.querySelector('input[name="rf-mode"]:checked').value === 'own', n = document.getElementById('rf-name').value.trim();
        if (own && !n) { H.toast(T('Type the name, or choose “Name after the adults”'), true); return; }
        if (own) { f.name = n; f.custom = true; } else { f.custom = false; }
        S.put('families', f, 'Renamed a household: ' + (own ? n : 'named after its adults'));
        H.closeModal(); H.render(); H.toast(T('Saved – shown as {name}', { name: H.familyName(f) }));
      }
  });

  Object.assign(P, { DUPWORD: DUPWORD, FIELD_NAMES: FIELD_NAMES, adminOnly: adminOnly, chooseKeep: chooseKeep, couplesPanel: couplesPanel, doFix: doFix, dupCard: dupCard, fieldName: fieldName, fixDialog: fixDialog, lateSuggestions: lateSuggestions, markNotSame: markNotSame, refsOf: refsOf, renderDuplicates: renderDuplicates, renderFamilies: renderFamilies, renderLate: renderLate });
})(PeopleParts);
