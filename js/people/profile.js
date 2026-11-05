/* Church Hub – People: a person's page: details, photo, consent, notes, ID number, serving, parents and guardians, homes, a death. */
(function (P) {
  'use strict';
  var H = Hub, esc = H.esc, S = Store, T = I18n.t, TN = I18n.tn;
  var TX = function (s) { return s; };   // a text kept in a list, translated where it is shown (the language test checks it)
  var HS = P.HS, PURPOSES = P.PURPOSES, RECEIVE_P = P.RECEIVE_P, WEDDING = P.WEDDING, state = P.state;
  // From the other People files (each looked up when called)
  function addressLines() { return P.addressLines.apply(this, arguments); }
  function age() { return P.age.apply(this, arguments); }
  function canBasic() { return P.canBasic.apply(this, arguments); }
  function canChildren() { return P.canChildren.apply(this, arguments); }
  function canRecordDeath() { return P.canRecordDeath.apply(this, arguments); }
  function canSeeAll() { return P.canSeeAll.apply(this, arguments); }
  function canVolunteer() { return P.canVolunteer.apply(this, arguments); }
  function catTags() { return P.catTags.apply(this, arguments); }
  function consentFor() { return P.consentFor.apply(this, arguments); }
  function coupleOf() { return P.coupleOf.apply(this, arguments); }
  function deceased() { return P.deceased.apply(this, arguments); }
  function familyOf() { return P.familyOf.apply(this, arguments); }
  function first() { return P.first.apply(this, arguments); }
  function hasConsent() { return P.hasConsent.apply(this, arguments); }
  function isMe() { return P.isMe.apply(this, arguments); }
  function keyDate() { return P.keyDate.apply(this, arguments); }
  function known() { return P.known.apply(this, arguments); }
  function lateSpouse() { return P.lateSpouse.apply(this, arguments); }
  function linkName() { return P.linkName.apply(this, arguments); }
  function links() { return P.links.apply(this, arguments); }
  function members() { return P.members.apply(this, arguments); }
  function serveTimes() { return P.serveTimes.apply(this, arguments); }
  function slotIds() { return P.slotIds.apply(this, arguments); }
  function slotName() { return P.slotName.apply(this, arguments); }
  function survivingSpouses() { return P.survivingSpouses.apply(this, arguments); }
  function visiblePeople() { return P.visiblePeople.apply(this, arguments); }
  function yearsSince() { return P.yearsSince.apply(this, arguments); }

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
    if (!H.can('leave.manage') || !leaveOn || deceased(p) || p.active === false) return '';
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
      // Messages: Administrators and Pastors write to this one person (adults still in the church)
      (window.Msg && (H.can('*') || H.can('people.edit')) && p.familyRole !== 'child' && p.active !== false && p.category !== 'Deceased' && p.id !== (H.user() || {}).id ?
        '<a class="btn" href="#/messages/send/people/' + esc(p.id) + '">' + H.icon('M4 5h16v11H9l-5 4z', 18) + T('Send a message') + '</a>' : '') +
      (H.can('privacy.manage') ? '<button class="btn" data-act="people:export" data-id="' + p.id + '">' + H.icon(H.ICON.download, 18) + T('Export their data') + '</button>' : '') +
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
      (full && addressLines(p).length ? '<dt>' + T('Home address') + '</dt><dd>' + addressLines(p).map(esc).join('<br>') + ' ' + H.mapLink(addressLines(p).join(', ')) + '</dd>' :
        !full && P.contactHtml(p, 'address') ? '<dt>' + T('Home address') + '</dt><dd>' + P.contactHtml(p, 'address') + '</dd>' : '') +
      (!child && (canSeeAll() || me) ? '<dt>' + T('Email') + '</dt><dd>' + (p.email ? P.contactHtml(p, 'email') : '<span class="muted">' + (p.emailUnknown ? T('Unknown') : '—') + '</span>') + '</dd>' +
        '<dt>' + T('Mobile') + '</dt><dd>' + (p.mobile ? P.contactHtml(p, 'mobile') : '<span class="muted">' + (p.mobileUnknown ? T('Unknown') : '—') + '</span>') + '</dd>' : '') +
      // Everyone else: only what Settings shares with their role, of people who agreed (Contact details)
      (!child && !canSeeAll() && !me ? ['email', 'mobile', 'spouse'].map(function (f) { var v = P.contactHtml(p, f); return v ? '<dt>' + T(f === 'email' ? 'Email' : f === 'mobile' ? 'Mobile' : 'Spouse or partner') + '</dt><dd>' + v + '</dd>' : ''; }).join('') : '') +
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
      (H.can('idnumbers') || me ? '<dt>' + T('ID number') + '</dt><dd id="pp-idn"><button class="link" data-act="people:showid" data-id="' + p.id + '">' + T('Show') + '</button>' +
        (H.can('idnumbers') ? ' · <button class="link" data-act="people:editid" data-id="' + p.id + '">' + T('Change') + '</button>' : '') + '<span class="kv-sub">' + (me && !H.can('*') ? T('Only you and the church Administrators can see it.') : T('Administrators only · views are logged')) + '</span></dd>' : '') +
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
      (H.can('access.manage') ? '<dt>' + T('App access') + '</dt><dd>' + esc(H.roleLabel(p.appRole || 'member')) + '</dd>' : '') +
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
          return '<div class="item"><span class="grow"><b>' + esc(T(P.purposeName(pur))) + '</b><small>' + (c ? esc(T(c.given ? 'Agreed {date}' : 'Declined {date}', { date: H.fmt(c.date, true) }) + ' · ' + T(c.method) + (c.guardianId ? ' · ' + T('by {name}', { name: H.name(S.get('people', c.guardianId)) }) : '')) : T('Not asked yet')) + '</small></span>' +
            (c ? (c.given ? '<span class="tag ok">' + T('Yes') + '</span>' : '<span class="tag grey">' + T('No') + '</span>') : '<span class="tag bad">' + T('Missing') + '</span>') + '</div>';
        }).join('') + '</div>' +
        (child ? '' : '<h3 style="margin:16px 0 6px;font-size:.95rem">' + T('Would like to receive') + '</h3><div class="list">' + RECEIVE_P.map(function (pur) {
          var c = consentFor(p.id, pur);
          return '<div class="item"><span class="grow"><b>' + esc(T(P.purposeName(pur))) + '</b>' + (c ? '<small>' + esc(T(c.given ? 'Agreed {date}' : 'Declined {date}', { date: H.fmt(c.date, true) })) + '</small>' : '') + '</span>' +
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
        '<label class="field" style="margin-top:12px">' + T('Add a note') + '<textarea id="on-text" rows="2" placeholder="' + esc(T('Administrators and Pastors can see this. Pastoral matters go in pastoral notes.')) + '"></textarea></label><button class="btn small save" data-act="people:onote" data-id="' + p.id + '">' + T('Save note') + '</button></section>';
    }
    // Pastoral notes
    if (seeNotes && !me) {
      var notes = S.find('notes', function (n) { return n.personId === p.id; });
      html += '<section class="panel"><div class="row"><h2 class="grow" style="margin:0">' + T('Pastoral notes') + '</h2><span class="locked">' + H.icon(H.ICON.lock, 14) + T('Pastors only · views are logged') + '</span></div>' +
        (notes.length ? notes.map(function (n) { return '<div style="margin-top:12px"><p style="margin:0" data-own-words>' + esc(n.text) + '</p><p class="hint">' + esc(n.by + ', ' + H.fmt(n.at, true)) + '</p></div>'; }).join('') : '<p class="muted">' + T('No notes.') + '</p>') +
        '<label class="field" style="margin-top:12px">' + T('Add a note') + '<textarea id="pn-text" rows="2" placeholder="' + esc(T('Only pastors can see this')) + '"></textarea></label><button class="btn small save" data-act="people:note" data-id="' + p.id + '">' + T('Save note') + '</button></section>';
    }
    // Volunteering: services, departments and positions (Rosters teams and positions); roster coordinators and Administrators change it
    html += volunteerPanel(p, me);
    html += '</div>';
    return html;
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
      '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button>' + (teams.length ? '<button class="btn save" data-act="people:savevolunteer" data-id="' + p.id + '">' + T('Save') + '</button>' : '') + '</div>', T('Volunteering'));
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
      responsibleAdults: S.find('guardians', function (l) { return l.childId === p.id || l.adultId === p.id; }), consents: pick('consents'), pastoralNotes: H.can('notes') ? pick('notes') : undefined, serving: { skills: pick('skills'), assignments: pick('assignments'), groups: pick('groups'), awayDates: pick('blockouts'), offersToServe: pick('serveOffers') }, translationSuggestions: pick('wordIdeas'), changesAskedFor: pick('detailChanges'),
      leave: lv ? lv.requests.filter(function (r) { return r.staffId === p.id; }) : [], auditEntries: S.find('audit', function (a) { return a.target === 'people/' + p.id; }) };
    S.audit('Exported all data held about ' + H.name(p), 'people/' + p.id);
    H.download('church-hub-' + (p.firstName + '-' + p.lastName).toLowerCase().replace(/\W+/g, '-') + '.json', JSON.stringify(data, null, 2));
    H.toast(T('Downloaded everything held about {name}', { name: H.name(p) }));
  }


  Object.assign(P.actions, {
    photo: function () { var f = document.getElementById('pp-photo'); if (f) f.click(); },
    nophoto: function (el) {
        var p = S.get('people', el.dataset.id); if (!p) return;
        S.setPhoto(p.id, null, 'Removed the photo of ' + H.name(p)).then(function () { H.render(); H.toast(T('Photo removed')); });
      },
    export: function (el) { exportPerson(S.get('people', el.dataset.id)); },
    tidydeath: function (el) { tidyDeath(el.dataset.id); H.render(); H.toast(T('Taken off rosters, teams, leave and sign-in')); },
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
          '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn save" data-act="people:savemedical" data-id="' + p.id + '">' + T('Save') + '</button></div>', T('Medical notes'));
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
          '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn save" data-act="people:saveid" data-id="' + p.id + '">' + T('Save') + '</button></div>', T('ID number'));
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
    volunteer: function (el) { volunteerDialog(S.get('people', el.dataset.id)); },
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
      }
  });

  Object.assign(P, { adultOptions: adultOptions, canPhoto: canPhoto, coupleLine: coupleLine, coupleTodo: coupleTodo, coupleWord: coupleWord, exportPerson: exportPerson, guardiansPanel: guardiansPanel, homeDialog: homeDialog, leaveButton: leaveButton, linkDialog: linkDialog, ncDialog: ncDialog, needsTidy: needsTidy, renderPerson: renderPerson, tidyDeath: tidyDeath, volunteerDialog: volunteerDialog, volunteerPanel: volunteerPanel, wedOf: wedOf });
})(PeopleParts);
