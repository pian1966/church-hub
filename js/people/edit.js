/* Church Hub – People: the Add / Edit details window (with its duplicate warning), staff details, consent, recording a death, marking as left. */
(function (P) {
  'use strict';
  var H = Hub, esc = H.esc, S = Store, T = I18n.t, TN = I18n.tn;
  var TX = function (s) { return s; };   // a text kept in a list, translated where it is shown (the language test checks it)
  var CATS = P.CATS, DUP = P.DUP, GENDERS = P.GENDERS, HS = P.HS, MARITAL = P.MARITAL, PURPOSES = P.PURPOSES, RECEIVE = P.RECEIVE, RECEIVE_P = P.RECEIVE_P, WEDDING = P.WEDDING;
  // From the other People files (each looked up when called)
  function canDup() { return P.canDup.apply(this, arguments); }
  function canRecordDeath() { return P.canRecordDeath.apply(this, arguments); }
  function canSeeAll() { return P.canSeeAll.apply(this, arguments); }
  function consentFor() { return P.consentFor.apply(this, arguments); }
  function deceased() { return P.deceased.apply(this, arguments); }
  function dupPeople() { return P.dupPeople.apply(this, arguments); }
  function hasConsent() { return P.hasConsent.apply(this, arguments); }
  function householdNames() { return P.householdNames.apply(this, arguments); }
  function isMe() { return P.isMe.apply(this, arguments); }
  function keyDate() { return P.keyDate.apply(this, arguments); }
  function known() { return P.known.apply(this, arguments); }
  function lateSpouse() { return P.lateSpouse.apply(this, arguments); }
  function markNotSame() { return P.markNotSame.apply(this, arguments); }
  function members() { return P.members.apply(this, arguments); }
  function notDup() { return P.notDup.apply(this, arguments); }
  function tidyDeath() { return P.tidyDeath.apply(this, arguments); }
  function yearsSince() { return P.yearsSince.apply(this, arguments); }

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
  /** Live warning in the Add / Edit window: who this may already be. Blocks saving for very likely duplicates. */
  function typedPerson() {
    var g = function (id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }, un = function (v) { return /^(unknown|not known)$/i.test(v) || v.toLowerCase() === T('unknown').toLowerCase() ? '' : v; };
    var fr = document.getElementById('pf-frole');
    return { id: g('pf-id'), firstName: g('pf-first'), lastName: g('pf-last'), preferredName: g('pf-pref'), email: un(g('pf-email')), mobile: un(g('pf-mobile')),
      birthDate: g('pf-birth'), familyRole: fr ? fr.value : '' };
  }
  function dupMatches() { if (!canSeeAll()) return []; var t = typedPerson(); if (!t.firstName || !t.lastName) return []; var ex = t.id ? S.get('people', t.id) : null; if (ex && ex.elvantoId) t.elvantoId = ex.elvantoId; return DUP.matches(t, dupPeople(), notDup()); }
  /** The live check, as each letter is typed (Duplicates.live): similar names from two letters of each name, and an email or
   *  mobile already on someone else's record – shown right under that box. Only for those who may see everyone (not members). */
  function dupLive() {
    if (!canSeeAll()) return { people: [], email: [], mobile: [] };
    var t = typedPerson(), ex = t.id ? S.get('people', t.id) : null; if (ex && ex.elvantoId) t.elvantoId = ex.elvantoId;
    return DUP.live(t, dupPeople(), notDup(), P.dupSens());
  }
  function personLinks(ids) {
    return ids.slice(0, 3).map(function (id) { var q = S.get('people', id); return q ? '<a href="#/people/p/' + q.id + '" data-act="hub:close">' + esc(H.name(q)) + '</a>' : ''; }).filter(Boolean).join(', ') + (ids.length > 3 ? ' …' : '');
  }
  /** Under the email or mobile box: who else has it already (only when it was typed or changed here, not someone's own saved one). */
  function contactHint(field, ids, norm) {
    var hint = document.getElementById(field + '-dup'), inp = document.getElementById(field); if (!hint || !inp) return;
    var changed = norm(inp.value) !== norm(inp.dataset.was || '');
    hint.hidden = !(ids.length && changed);
    hint.innerHTML = hint.hidden ? '' : (field === 'pf-email' ? T('This email address is already used by {names}.', { names: personLinks(ids) }) : T('This mobile number is already used by {names}.', { names: personLinks(ids) })) +
      ' ' + T('Families often share one – check this isn’t the same person.');
  }
  function dupWarn() {
    var box = document.getElementById('pf-dup'); if (!box) return;
    var live = dupLive();
    contactHint('pf-email', live.email, DUP.email); contactHint('pf-mobile', live.mobile, DUP.phone);
    var ms = live.people.slice(0, 3), stop = ms.some(function (m) { return m.score >= 70; }), similar = ms.every(function (m) { return m.level === 'similar'; });
    box.hidden = !ms.length;
    if (!ms.length) { box.innerHTML = ''; return; }
    var keep = document.getElementById('pf-dup-ok'), was = keep && keep.checked;
    box.className = 'note ' + (stop ? 'bad' : similar ? 'info' : 'warn');
    box.innerHTML = '<b>' + (similar ? T('Similar names already in Church Hub:') : T('This may be someone already in Church Hub:')) + '</b>' + ms.map(function (m) {
      var q = S.get('people', m.id), hs = householdNames(q);
      return '<span style="display:block;margin-top:6px"><a href="#/people/p/' + q.id + '" data-act="hub:close">' + esc(H.name(q)) + '</a>' + (hs.length ? ' · ' + esc(hs[0]) : '') + ' <span class="muted small">(' + esc(m.reasons.join(', ')) + ')</span></span>';
    }).join('') +
      (stop ? (canDup() ? '<label class="check" style="margin-top:8px"><input type="checkbox" id="pf-dup-ok"' + (was ? ' checked' : '') + '><span>' + T('I’ve checked: this is a different person') + '</span></label>'
        : '<span style="display:block;margin-top:6px">' + T('To avoid duplicates this can’t be saved. If it really is a different person, ask an Administrator.') + '</span>') : '');
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
      '<div class="two"><label class="field' + (p.familyRole === 'child' ? '' : ' req') + '" id="pf-email-f">' + T('Email') + '<input id="pf-email" type="email" value="' + esc(p.email || (p.emailUnknown ? T('unknown') : '')) + '" data-was="' + esc(p.email || '') + '" autocomplete="email" placeholder="' + esc(T('Type “{word}” if not known', { word: T('unknown') })) + '"><small id="pf-email-dup" class="dup-hint" role="status" aria-live="polite" hidden></small></label>' +
      '<label class="field' + (p.familyRole === 'child' ? '' : ' req') + '" id="pf-mobile-f">' + T('Mobile') + '<input id="pf-mobile" type="tel" value="' + esc(p.mobile || (p.mobileUnknown ? T('unknown') : '')) + '" data-was="' + esc(p.mobile || '') + '" autocomplete="tel" placeholder="' + esc(T('Type “{word}” if not known', { word: T('unknown') })) + '"><small id="pf-mobile-dup" class="dup-hint" role="status" aria-live="polite" hidden></small></label></div>' +
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
      var e = document.getElementById(id); if (e) e.addEventListener(e.tagName === 'SELECT' || e.type === 'date' ? 'change' : 'input', function () { clearTimeout(dupT); dupT = setTimeout(dupWarn, 150); });
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
        return '<label class="check"><input type="checkbox" class="cf-p" data-p="' + esc(pur) + '"' + (hasConsent(p.id, pur) ? ' checked' : '') + '><span><b>' + esc(T(P.purposeName(pur))) + '</b><br><span class="muted small">' + esc(T({
          'Church records': 'Keep their details on the church database.', 'Email': 'Church news and information by email.', 'SMS': 'Reminders and urgent news by SMS.',
          'Church directory': 'My name, phone, email and home address may be seen by church staff and leaders, and by members as far as the church allows.', 'Care group': 'Photo, phone, email, address and birthday shared with my care group.', 'Photos': 'Photos at church events may be shared.', 'Children’s medical notes': 'Allergies and medical notes kept for safety at children’s church.' }[pur])) + '</span></span></label>';
      }).join('') +
      (child ? '' : '<p class="field-l" style="margin:14px 0 4px">' + T('Would like to receive') + '</p>' + RECEIVE.map(function (r) {
        return '<label class="check"><input type="checkbox" class="cf-p" data-p="' + esc(r[0]) + '"' + (hasConsent(p.id, r[0]) ? ' checked' : '') + '><span><b>' + esc(T(r[0])) + '</b><br><span class="muted small">' + esc(T(r[1])) + '</span></span></label>';
      }).join('')) +
      (!me ? '<div class="two" style="margin-top:8px"><label class="field">' + T('How it was given') + '<select id="cf-method">' + ['Paper connect card', 'Online form', 'In person (verbal)', 'Email'].map(function (m) { return '<option value="' + m + '">' + esc(T(m)) + '</option>'; }).join('') + '</select></label>' +
        (child ? '<label class="field req">' + T('Given by (parent or guardian)') + '<select id="cf-guardian">' + guardians.map(function (g) { return '<option value="' + g.id + '">' + esc(H.name(g)) + '</option>'; }).join('') + '</select></label>' : '') + '</div>' : '') +
      '<p class="hint">' + esc(Store.settings().privacyNotice) + '</p></div>' +
      '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn primary" data-act="people:saveconsent" data-id="' + p.id + '">' + T('Save') + '</button></div>', T('Consent'));
  }


  Object.assign(P.actions, {
    add: function () { editDialog(null); },
    edit: function (el) { editDialog(S.get('people', el.dataset.id)); var f = el.dataset.focus && document.getElementById(el.dataset.focus); if (f) { f.focus(); f.scrollIntoView({ block: 'center' }); } },
    consent: function (el) { consentDialog(S.get('people', el.dataset.id)); },
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
    undodeath: function (el) {
        if (!H.confirmBtn(el, T('Click again: undo the death record'))) return;
        var p = JSON.parse(JSON.stringify(S.get('people', el.dataset.id)));
        p.active = true; p.category = p.staff ? 'Staff' : 'Church Partner'; delete p.deceasedAt; delete p.deathTidied;
        p.keyDates = (p.keyDates || []).filter(function (k) { return k.label !== 'Died' && k.label !== 'Funeral'; });
        S.put('people', p, 'Undid the death record of ' + H.name(p));
        H.render(); H.toast(T('Undone. Give them app access, teams and roster turns again if needed.'));
      },
    archive: function (el) {
        if (!H.confirmBtn(el, T('Click again: mark as left'))) return;
        var p = S.get('people', el.dataset.id); p.active = false; p.category = 'Former member'; p.archivedAt = H.today();
        S.put('people', p, 'Marked as left: ' + H.name(p)); H.closeModal(); H.go('people'); H.toast(T('{name} marked as left. Delete them later under Privacy → Retention.', { name: H.name(p) }));
      }
  });

  Object.assign(P, { consentDialog: consentDialog, countrySelect: countrySelect, dupMatches: dupMatches, dupWarn: dupWarn, editDialog: editDialog, lateSpouseField: lateSpouseField, regionControl: regionControl, staffFields: staffFields, typedPerson: typedPerson, wireCountry: wireCountry });
})(PeopleParts);
