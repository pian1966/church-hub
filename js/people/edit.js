/* Church & Trellis – People: the Add / Edit details window (with its duplicate warning), staff details, consent, recording a death, marking as left. */
(function (P) {
  'use strict';
  var H = Hub, esc = H.esc, S = Store, T = I18n.t, TN = I18n.tn;
  var TX = function (s) { return s; };   // a text kept in a list, translated where it is shown (the language test checks it)
  var F = P.F, CATS = P.CATS, DUP = P.DUP, GENDERS = P.GENDERS, HS = P.HS, MARITAL = P.MARITAL, PURPOSES = P.PURPOSES, RECEIVE = P.RECEIVE, RECEIVE_P = P.RECEIVE_P, WEDDING = P.WEDDING;
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
  /** Other people with access who sign in with the same email address as p (a couple often share one): they share a sign-in. */
  function signsInWith(p) {
    var e = (p.email || '').trim().toLowerCase();
    return e ? S.list('people').filter(function (o) { return o.id !== p.id && (o.email || '').trim().toLowerCase() === e && o.appRole && o.appRole !== 'none' && o.active !== false; }) : [];
  }
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
    var g = function (id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }, un = function (v) { return P.isUnknownWord(v) ? '' : v; };
    var fr = document.getElementById('pf-frole'), fam = g('pf-fam');
    return { id: g('pf-id'), firstName: g('pf-first'), lastName: g('pf-last'), preferredName: g('pf-pref'), email: un(g('pf-email')), mobile: un(g('pf-mobile')),
      birthDate: g('pf-birth'), familyRole: fr ? fr.value : '', familyId: fam === '__new' ? '' : fam, address: { street: g('pf-street') } };
  }
  function dupMatches() { if (!canSeeAll()) return []; var t = typedPerson(); if (!t.firstName || !t.lastName) return []; var ex = t.id ? S.get('people', t.id) : null; if (ex && ex.elvantoId) t.elvantoId = ex.elvantoId; return DUP.matches(t, dupPeople(), notDup()); }
  /** The live check, as each letter is typed (Duplicates.live): similar names from two letters of each name, and an email or
   *  mobile already on someone else's record – shown right under that box. Only for those who may see everyone (not members). */
  function dupLive() {
    if (!canSeeAll()) return { people: [], email: [], mobile: [], emailLike: [], mobileLike: [], address: [], addressLike: [] };
    var t = typedPerson(), ex = t.id ? S.get('people', t.id) : null; if (ex && ex.elvantoId) t.elvantoId = ex.elvantoId;
    return DUP.live(t, dupPeople(), notDup(), P.dupSens(), { dial: Countries.church(S.settings()).dial });
  }
  function personLinks(ids) {
    return ids.slice(0, 3).map(function (id) { var q = S.get('people', id); return q ? '<a href="#/people/p/' + q.id + '" data-act="hub:close">' + esc(H.name(q)) + '</a>' : ''; }).filter(Boolean).join(', ') + (ids.length > 3 ? ' …' : '');
  }
  /** Under the email, mobile or street address box: who else has it already, or one starting like what is typed so far
   *  (only when it was typed or changed here, not someone's own saved one). */
  var HINTS = {
    'pf-email': [TX('This email address is already used by {names}.'), TX('An email address starting like this is already used by {names}.')],
    'pf-mobile': [TX('This mobile number is already used by {names}.'), TX('A mobile number starting like this is already used by {names}.')],
    'pf-street': [TX('This address is already used by {names}.'), TX('An address starting like this is already used by {names}.')]
  };
  function contactHint(field, same, like, norm) {
    var hint = document.getElementById(field + '-dup'), inp = document.getElementById(field); if (!hint || !inp) return;
    var changed = norm(inp.value) !== norm(inp.dataset.was || ''), ids = same.length ? same : like;
    hint.hidden = !(ids.length && changed);
    hint.innerHTML = hint.hidden ? '' : T(HINTS[field][same.length ? 0 : 1], { names: personLinks(ids) }) + ' ' + T('Families often share one – check this isn’t the same person.');
  }
  function dupWarn() {
    var box = document.getElementById('pf-dup'); if (!box) return;
    var live = dupLive();
    var low = function (v) { return String(v || '').trim().toLowerCase(); };
    contactHint('pf-email', live.email, live.emailLike, low); contactHint('pf-mobile', live.mobile, live.mobileLike, function (v) { return String(v || '').replace(/\D/g, ''); });
    contactHint('pf-street', live.address, live.addressLike, DUP.street);
    var ms = live.people.slice(0, 3), stop = ms.some(function (m) { return m.score >= 70; }), similar = ms.every(function (m) { return m.level === 'similar'; });
    box.hidden = !ms.length;
    if (!ms.length) { box.innerHTML = ''; return; }
    var keep = document.getElementById('pf-dup-ok'), was = keep && keep.checked;
    box.className = 'note ' + (stop ? 'bad' : similar ? 'info' : 'warn');
    box.innerHTML = '<b>' + (similar ? T('Similar names already in Church & Trellis:') : T('This may be someone already in Church & Trellis:')) + '</b>' + ms.map(function (m) {
      var q = S.get('people', m.id), hs = householdNames(q);
      return '<span style="display:block;margin-top:6px"><a href="#/people/p/' + q.id + '" data-act="hub:close">' + esc(H.name(q)) + '</a>' + (hs.length ? ' · ' + esc(hs[0]) : '') + ' <span class="muted small">(' + esc(m.reasons.join(', ')) + ')</span></span>';
    }).join('') +
      (stop ? (canDup() ? '<label class="check" style="margin-top:8px"><input type="checkbox" id="pf-dup-ok"' + (was ? ' checked' : '') + '><span>' + T('I’ve checked: this is a different person') + '</span></label>'
        : '<span style="display:block;margin-top:6px">' + T('To avoid duplicates this can’t be saved. If it really is a different person, ask an Administrator.') + '</span>') : '');
  }

  var LEFT = 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11';   // a door with an arrow going out
  /** An example number for the box's grey hint: South African style at a South African church, otherwise the country's dialling code. */
  function mobileExample() {
    var c = Countries.church(S.settings());
    return !c || c.code === 'ZA' ? '082 123 4567' : '+' + String(c.dial).replace(/^\+/, '') + ' …';
  }
  /** Email or Mobile in Edit details: the label with a small “Not known” button on its line; when it is not known, the box is
   *  swapped for a calm panel (with “Add it”) and a hidden box holds the answer. The visible box never holds a fake word. */
  function contactField(id, label, type, autocomplete, p, panelWords, example) {
    var flag = id === 'pf-email' ? 'emailUnknown' : 'mobileUnknown', key = id === 'pf-email' ? 'email' : 'mobile';
    var word = P.isUnknownWord(p[key]), unknownNow = !!p[flag] || word, real = word ? '' : (p[key] || '');
    return '<div class="field' + (p.familyRole === 'child' ? '' : ' req') + '" id="' + id + '-f">' +
      '<div class="field-head"><label for="' + id + '">' + F(label) + '</label>' +
      '<button type="button" class="nk-btn" data-act="people:unknown" data-for="' + id + '" aria-controls="' + id + '" aria-pressed="false"' + (unknownNow || real ? ' hidden' : '') + '>' + T('Not known') + '</button></div>' +
      '<input id="' + id + '" type="' + type + '" value="' + esc(real) + '" data-was="' + esc(real) + '" autocomplete="' + autocomplete + '" placeholder="' + esc(example) + '"' + (unknownNow ? ' hidden' : '') + '>' +
      '<div class="nk-panel" id="' + id + '-nk" role="status"' + (unknownNow ? '' : ' hidden') + '><span class="nk-q" aria-hidden="true">?</span><span class="nk-t">' + T(panelWords) + '</span>' +
      '<button type="button" class="link nk-add" data-act="people:known" data-for="' + id + '">' + T('Add it') + '</button></div>' +
      '<input type="hidden" id="' + id + '-unknown" value="' + (unknownNow ? '1' : '') + '">' +
      '<small id="' + id + '-dup" class="dup-hint" role="status" aria-live="polite" hidden></small></div>';
  }
  /** Show or hide the “not known” panel for 'pf-email' / 'pf-mobile'. quietly = while the window opens: no focus move, no event. */
  function nkShow(id, on, quietly) {
    var inp = document.getElementById(id), nk = document.getElementById(id + '-nk'), flag = document.getElementById(id + '-unknown'), btn = document.querySelector('.nk-btn[data-for="' + id + '"]');
    if (!inp || !nk || !flag) return;
    if (on) inp.value = '';
    flag.value = on ? '1' : ''; inp.hidden = on; nk.hidden = !on;
    if (btn) btn.hidden = on || !!inp.value.trim();
    var hint = document.getElementById(id + '-dup'); if (hint && on) { hint.hidden = true; hint.innerHTML = ''; }
    var f = document.getElementById(id + '-f');
    if (f) { f.querySelectorAll('.field-err').forEach(function (n) { n.remove(); }); inp.removeAttribute('aria-invalid'); }
    if (quietly) return;
    var t = on ? nk.querySelector('.nk-add') : inp; if (t) t.focus({ preventScroll: true });   // focus first, then one change (saving as you go puts the cursor back where it was)
    flag.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function editDialog(p) {
    var isNew = !p; p = p || { firstName: '', lastName: '', preferredName: '', email: '', mobile: '', birthDate: '', category: '', familyId: '', familyRole: '', appRole: Store.defaultRole() };
    var admin = H.can('*'), me = isMe(p);
    var fams = S.list('families');
    editSession = { id: p.id || '', audited: false, addr: HS.hasAddress(p) ? HS.addressKey(p.address) : '' };
    var html = H.dialogHead(isNew ? T('Add a person') : T('Edit {name}', { name: H.name(p) }), isNew ? T('Only add what the church needs. Ask for consent when you add someone.') : T('Changes are saved as you go.')) +
      // Someone already on the records: saved as you go (data-autoscope + the hidden data-autosave button). A new person waits for "Add person".
      '<form id="pf" class="dlg-body" novalidate' + (isNew ? '' : ' data-autoscope') + '><input type="hidden" id="pf-id" value="' + esc(p.id || '') + '">' +
      (isNew ? '' : '<button type="button" data-autosave data-act="people:autosave" tabindex="-1">' + T('Save') + '</button>') +
      // Leaving or removing someone: at the top, apart from the details
      (!isNew && (admin || H.can('people.delete')) ? '<div class="pf-top"><button type="button" class="btn small" data-act="people:archive" data-id="' + p.id + '" title="' + esc(T('They’ve left the church: hidden from lists, history kept')) + '">' + H.icon(LEFT, 16) + T('Mark as left') + '</button>' +
        '<button type="button" class="btn small" data-act="people:bin" data-id="' + p.id + '" title="' + esc(T('For a test person or someone added by mistake. They can be restored for 30 days.')) + '">' + H.icon(H.ICON.trash, 16) + T('Move to Bin') + '</button></div>' : '') +
      '<div class="two"><label class="field req">' + F('First name') + '<span class="mic-wrap"><input id="pf-first" required value="' + esc(p.firstName) + '" autocomplete="given-name">' + (!p.id && window.Voice ? Voice.button('#pf-first', { mode: 'name', last: '#pf-last' }) : '') + '</span></label>' +
      '<label class="field req">' + F('Last name') + '<input id="pf-last" required value="' + esc(p.lastName) + '" autocomplete="family-name"></label></div>' +
      '<div id="pf-dup" class="note warn" role="status" aria-live="polite" hidden style="margin:0 0 12px"></div>' +
      '<div class="two"><label class="field">' + F('Known as') + '<input id="pf-pref" value="' + esc(p.preferredName || '') + '"></label>' +
      (!me || admin ? '<label class="field">' + F('Middle name') + '<input id="pf-middle" value="' + esc(p.middleName || '') + '" autocomplete="additional-name"></label>' : '') + '</div>' +
      '<div class="two">' + contactField('pf-email', 'Email', 'email', 'email', p, 'Email not known', 'name@example.com') +
      contactField('pf-mobile', 'Mobile', 'tel', 'tel', p, 'Mobile not known', mobileExample()) + '</div>' +
      (!me || admin ? '<div class="two"><label class="field">' + F('Birthday') + '<input id="pf-birth" type="date" max="' + H.today() + '" value="' + esc(p.birthDate || '') + '"><small id="pf-birth-n" class="live-n" aria-live="polite"></small></label>' +
        '<label class="field req">' + F('Category') + '<select id="pf-cat">' + (p.category ? '' : '<option value="" selected>' + T('Choose…') + '</option>') + CATS.map(function (c) { return '<option value="' + esc(c) + '"' + (p.category === c ? ' selected' : '') + '>' + esc(T(c)) + '</option>'; }).join('') + '</select></label></div>' +
        '<div class="two" id="pf-partner-f"' + (p.category === 'Church Partner' ? '' : ' hidden') + '><label class="field">' + F('Date accepted as Church Partner') + '<input id="pf-psince" type="date" max="' + H.today() + '" value="' + esc(p.partnerSince || '') + '"></label>' +
        '<label class="field">' + F('Partnership last updated') + '<input id="pf-pupd" type="date" max="' + H.today() + '" value="' + esc(/^\d{4}$/.test(p.partnerUpdated || '') ? '' : p.partnerUpdated || '') + '">' +
          (/^\d{4}$/.test(p.partnerUpdated || '') ? '<small>' + esc(T('Elvanto only says {year}. Leave empty to keep that, or choose the date.', { year: p.partnerUpdated })) + '</small>' : '') + '</label></div>' +
        '<div class="two"><label class="field">' + F('Gender') + '<select id="pf-gender"><option value="">' + T('Not recorded') + '</option>' + GENDERS.map(function (g) { return '<option value="' + g + '"' + (p.gender === g ? ' selected' : '') + '>' + esc(T(g)) + '</option>'; }).join('') + '</select></label>' +
        '<label class="field">' + F('Coming to the church since') + '<input id="pf-attsince" type="month" max="' + H.today().slice(0, 7) + '" value="' + esc(String(p.attendingSince || '').slice(0, 7)) + '"></label></div>' +
        '<div class="two"><label class="field req" id="pf-fam-f">' + F('Which household are they in?') + '<select class="findable" id="pf-fam"><option value="">' + T('Choose…') + '</option><option value="__new">' + T('They live on their own (new household)') + '</option>' + fams.slice().sort(function (a, b) { return H.familyName(a).localeCompare(H.familyName(b)); }).map(function (f) { return '<option value="' + f.id + '"' + (p.familyId === f.id ? ' selected' : '') + '>' + esc(H.familyName(f)) + '</option>'; }).join('') + '</select></label>' +
        '<label class="field req">' + F('In the household as') + '<select id="pf-frole">' + (p.familyRole ? '' : '<option value="" selected>' + T('Choose…') + '</option>') + '<option value="adult"' + (p.familyRole === 'adult' ? ' selected' : '') + '>' + T('Adult') + '</option><option value="child"' + (p.familyRole === 'child' ? ' selected' : '') + '>' + T('Child (under 18)') + '</option></select></label></div>' +
        '<label class="field req" id="pf-marital-f"' + (p.familyRole === 'child' ? ' hidden' : '') + '>' + F('Marital status') + '<select id="pf-marital"><option value="">' + T('Choose…') + '</option>' + MARITAL.map(function (m) { return '<option value="' + m + '"' + (p.maritalStatus === m ? ' selected' : '') + '>' + esc(T(m)) + '</option>'; }).join('') + '</select><small>' + T('For pastoral care. Choose “Not known” if you don’t know.') + '</small></label>' +
        // Next to marital status: the wedding anniversary and late spouse, greyed out when they don't apply (offBox)
        '<label class="field" id="pf-wed-f"' + (p.familyRole === 'child' ? ' hidden' : '') + '>' + F('Wedding anniversary') + '<input id="pf-wed" type="date" max="' + H.today() + '" value="' + esc(keyDate(p, WEDDING)) + '"><small id="pf-wed-n" class="live-n" aria-live="polite"></small></label>' +
        (admin ? lateSpouseField(p) : '') +
        (canSeeAll() && (admin || H.can('people.edit')) ? spouseField(p) : '') +
        // Maiden name: for women who are or were married (shown when it applies, or when one is already recorded)
        (!me || admin ? '<div class="two" id="pf-maiden-f"' + (maidenApplies(p.familyRole, p.gender, p.maritalStatus) || p.maidenName ? '' : ' hidden') + '><label class="field">' + F('Maiden name') +
          '<input id="pf-maiden" value="' + esc(p.maidenName || '') + '" autocomplete="off"><small>' + T('Her surname before she married.') + '</small></label></div>' : '') +
        (!isNew && canRecordDeath() && (deceased(p) || p.category === 'Deceased') ? '<div class="two"><label class="field req">' + F('Date of death') + '<input type="date" id="pf-died" max="' + H.today() + '" value="' + esc(p.deceasedAt || '') + '"></label>' +
          '<label class="field">' + F('Funeral or memorial') + '<input type="date" id="pf-funeral" value="' + esc(keyDate(p, /^funeral$/i)) + '"></label></div>' : '') +
        '<fieldset class="panel" style="padding:10px 12px;margin:6px 0 14px"><legend class="field-l" style="padding:0 4px">' + F('Home address') + '</legend>' +
          '<label class="field">' + F('Street address') + '<input id="pf-street" value="' + esc((p.address || {}).street || '') + '" data-was="' + esc((p.address || {}).street || '') + '" autocomplete="address-line1"><small id="pf-street-dup" class="dup-hint" role="status" aria-live="polite" hidden></small></label>' +
          '<label class="field">' + F('Address line 2') + '<input id="pf-street2" value="' + esc((p.address || {}).street2 || '') + '" autocomplete="address-line2"></label>' +
          '<div class="two"><label class="field">' + F('Town or city') + '<input id="pf-city" value="' + esc((p.address || {}).city || '') + '" autocomplete="address-level2"></label>' +
          (function (a) {
            var c = a.country ? Countries.find(a.country) : Countries.church(S.settings());
            return '<label class="field"><span id="pf-postcode-l">' + T(c ? c.postcodeLabel : 'Postal code') + '</span><input id="pf-postcode" value="' + esc(a.postcode || '') + '" autocomplete="postal-code"></label></div>' +
              '<div class="two"><label class="field"><span id="pf-region-l">' + T(c ? c.regionLabel : 'Province, state or region') + '</span><span id="pf-region-w">' + regionControl(c, a.province || '') + '</span></label>' +
              '<label class="field">' + F('Country') + countrySelect(a.country || '') + '</label></div>' +
              '<label class="field">' + F('Latitude and longitude') + ' ' + H.tip(T('Latitude and longitude are two numbers that mark an exact spot on the map, like -29.4833, 30.2333. They work in Google Maps and in Apple Maps. They are ideal where there is no street name or house number – in townships, informal settlements and rural or farming areas – because they take a visitor, a carer or a driver straight to the door or gate. In Google Maps, press and hold on the house (or gate) and tap the numbers at the top to copy them. In Apple Maps, press and hold to drop a pin, swipe up and tap Copy Coordinates. If you are standing there, tap the blue dot first. South of the equator the first number has a minus sign, and west of Greenwich the second one does: in South Africa, for example, the first number starts with a minus and the second does not.')) + '<input id="pf-gps" value="' + esc(a.lat != null && a.lng != null ? Countries.gpsText(a.lat, a.lng) : '') + '" placeholder="' + T('e.g. -29.4833, 30.2333') + '" inputmode="text" autocapitalize="off" autocomplete="off" spellcheck="false"><small>' + T('Copy the two numbers from Google Maps or Apple Maps, e.g. -29.4833, 30.2333. Anyone can then tap them to go straight there.') + '</small></label></fieldset>';
          })(p.address || {}) +
        '' : '') +
      (admin || H.can('leave.manage') ? staffFields(p) : '') + (window.CareUI ? CareUI.fields(p) : '') +
      (roleChoices(p).length ? '<label class="field">' + F('App access') + '<select id="pf-role">' + roleChoices(p).map(function (r) { return '<option value="' + r + '"' + ((p.appRole || 'member') === r ? ' selected' : '') + '>' + esc(T(H.ROLES[r].label)) + '</option>'; }).join('') + '</select><small>' + T('What they can see and do in Church & Trellis.') + (Store.isLive() ? ' ' + T('They sign in with Google or an email link using the email address above.') : '') +
        (Store.isLive() && signsInWith(p).length ? ' <b>' + esc(T('{names} also signs in with this email address: after signing in, they choose who is using Church & Trellis.', { names: signsInWith(p).map(H.name).join(', ') })) + '</b>' : '') + '</small></label>' : '') +
      // A newcomer who would like a name badge (laminated, printed with others under People → Name badges)
      (isNew && (admin || H.can('people.edit')) ? '<label class="check"><input type="checkbox" id="pf-badge"><span>' + T('Make a name badge') + '</span></label>' : '') +
      '<p id="pf-err" class="note bad" hidden></p></form>' +
      '<div class="dlg-foot">' +
      (isNew ? '<button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn save" data-act="people:save">' + T('Add person') + '</button>'
        : '<button class="btn primary save" data-act="people:save">' + T('Done') + '</button>') + '</div>';
    H.modal(html, T(isNew ? 'Add a person' : 'Edit details'));
    if (!isNew && (deceased(p) || p.category === 'Deceased')) {   // someone who has died: only first and last name must be filled in
      document.querySelectorAll('#pf .field.req').forEach(function (f) { if (!f.querySelector('#pf-first, #pf-last, #pf-died')) f.classList.remove('req'); });
      H.markRequired();
    }
    var dupT = null;
    ['pf-first', 'pf-last', 'pf-pref', 'pf-email', 'pf-mobile', 'pf-street', 'pf-birth', 'pf-frole', 'pf-fam'].forEach(function (id) {
      var e = document.getElementById(id); if (e) e.addEventListener(e.tagName === 'SELECT' || e.type === 'date' ? 'change' : 'input', function () { clearTimeout(dupT); dupT = setTimeout(dupWarn, 400); });
    });
    if (p.id) dupWarn();
    var sb = document.getElementById('pf-staff'), sf = document.getElementById('pf-staff-f');
    if (sb && sf) sb.addEventListener('change', function () { sf.hidden = !sb.checked; });
    var sameBox = document.getElementById('pf-sw-same');
    if (sameBox) sameBox.addEventListener('change', function () { document.getElementById('pf-sw-days').hidden = sameBox.checked; });
    ['pf-email', 'pf-mobile'].forEach(function (id) {   // “Not known” shows only while the box is empty; a typed word like “unknown” becomes the panel when they leave the box
      var i = document.getElementById(id), b = document.querySelector('.nk-btn[data-for="' + id + '"]'); if (!i || !b) return;
      i.addEventListener('input', function () { b.hidden = !!i.value.trim(); });
      i.addEventListener('change', function () { if (P.isUnknownWord(i.value)) nkShow(id, true); });
    });
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
    // Boxes that don't apply are greyed out, with the reason: no wedding anniversary for someone single, engaged, living with a
    // partner or divorced; no late spouse for someone single or engaged. What was saved before is kept, not wiped.
    var fit = function () {
      var m = mi ? mi.value : '', child = fr && fr.value === 'child';
      offBox('pf-wed', !child && NO_WEDDING.indexOf(m) >= 0, m);
      if (wi && wi.disabled) { var wn = document.getElementById('pf-wed-n'); if (wn) wn.textContent = ''; } else live();
      offBox('pf-late', !child && NO_LATE.indexOf(m) >= 0, m);
      var sf = document.getElementById('pf-spouse-f'); if (sf) sf.hidden = child;
      offBox('pf-spouse', !child && NO_SPOUSE.indexOf(m) >= 0, m);
      if (mi && ltf && m === 'Widowed') ltf.hidden = false;
      var mf2 = document.getElementById('pf-maiden-f'), gi = document.getElementById('pf-gender'), mv = document.getElementById('pf-maiden');
      if (mf2) mf2.hidden = !maidenApplies(child ? 'child' : 'adult', gi ? gi.value : '', m) && !(mv && mv.value);
    };
    if (mi) mi.addEventListener('change', fit);
    if (fr) fr.addEventListener('change', fit);
    var gsel = document.getElementById('pf-gender'); if (gsel) gsel.addEventListener('change', fit);
    fit();
  }

  var NO_WEDDING = ['Single', 'Engaged', 'Partner', 'Divorced'], NO_LATE = ['Single', 'Engaged'], NO_SPOUSE = ['Single', 'Engaged', 'Divorced', 'Widowed'];
  /** A maiden name applies to an adult woman (or gender not recorded) who is or was married. */
  var EVER_MARRIED = ['Married', 'Separated', 'Divorced', 'Widowed'];
  function maidenApplies(role, gender, marital) { return role !== 'child' && gender !== 'Male' && EVER_MARRIED.indexOf(marital) >= 0; }
  /** Grey a box out (and say why) when it doesn't apply to this person, or bring it back. */
  function offBox(id, off, status) {
    var el = document.getElementById(id), lab = el && el.closest('.field'); if (!lab) return;
    el.disabled = off; lab.classList.toggle('is-off', off);
    var why = lab.querySelector('.off-why');
    if (off && !why) { why = document.createElement('small'); why.className = 'off-why'; lab.appendChild(why); }
    if (why) { why.hidden = !off; why.textContent = off ? T('Not needed – marital status is {status}.', { status: T(status) }) : ''; }
  }
  /** Keep both sides of a hand-chosen couple in step: the one they were linked to lets go, the new one links back (and lets go
   *  of anyone they were linked to before). */
  function linkSpouse(p, oldId, newId) {
    var unlink = function (id, from) {
      var q = id && S.get('people', id); if (!q || q.spouseId !== from) return;
      q = JSON.parse(JSON.stringify(q)); delete q.spouseId; S.put('people', q, 'Spouse or partner: unlinked ' + H.name(q) + ' from ' + H.name(S.get('people', from)));
    };
    if (oldId && oldId !== newId) unlink(oldId, p.id);
    if (!newId) return;
    var r = S.get('people', newId); if (!r || r.spouseId === p.id) return;
    if (r.spouseId) unlink(r.spouseId, r.id);
    r = JSON.parse(JSON.stringify(r)); r.spouseId = p.id;
    S.put('people', r, 'Spouse or partner: linked ' + H.name(r) + ' and ' + H.name(p));
  }
  /** Spouse or partner, chosen by hand (Administrators and Pastors): for a couple who live apart, or to settle it when the
   *  household leaves Church & Trellis guessing. Saved as spouseId on both people (details/, like the rest of the couple's details);
   *  "Going by their household" leaves it to Church & Trellis (Households.couples). */
  /** Under the Spouse or partner box, when none is chosen: the people in the same household (or with the same surname) as buttons – one tap chooses them. */
  function spouseSuggest(p, cur) {
    if (cur) return '';
    var list = HS.spouseSuggestions(p, S.list('people')).map(function (s) { return { x: S.get('people', s.id), why: s.why }; }).filter(function (s) { return s.x; });
    if (!list.length) return '';
    return '<span class="spouse-sug" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:6px"><small>' + T('Suggested:') + '</small>' + list.map(function (s) {
      return '<button type="button" class="btn small" data-act="people:usespouse" data-id="' + s.x.id + '" title="' + esc(s.why === 'household' ? T('In the same household') : T('Same surname')) + '">' + esc(H.name(s.x)) + '</button>';
    }).join('') + '</span>';
  }
  function spouseField(p) {
    var cur = p.spouseId ? S.get('people', p.spouseId) : null;
    var adults = S.find('people', function (x) { return x.id !== p.id && x.familyRole !== 'child' && x.active !== false && !x.mergedInto && !x.binnedAt && !deceased(x) && x.category !== 'Deceased'; })
      .sort(function (a, b) { return ((a.lastName || '') + (a.firstName || '')).localeCompare((b.lastName || '') + (b.firstName || '')); });
    if (cur && adults.indexOf(cur) < 0) adults.unshift(cur);
    return '<div class="two" id="pf-spouse-f"' + (p.familyRole === 'child' ? ' hidden' : '') + '><label class="field">' + F('Spouse or partner') + '<select class="findable" id="pf-spouse" data-was="' + esc(p.spouseId || '') + '">' +
      '<option value="">' + T('Going by their household') + '</option>' +
      adults.map(function (x) { return '<option value="' + x.id + '"' + (cur && cur.id === x.id ? ' selected' : '') + '>' + esc((x.lastName || '') + ', ' + (x.preferredName || x.firstName || '')) + '</option>'; }).join('') +
      '</select><small>' + T('Choose them if they live apart, or to be sure. Otherwise Church & Trellis works it out from the household.') + '</small>' + spouseSuggest(p, cur) + '</label></div>';
  }
  /** Administrators: who a widow or widower was married to – someone in Church & Trellis who has died, or a name. */
  function lateSpouseField(p) {
    var cur = lateSpouse(p), show = p.familyRole !== 'child' && (p.maritalStatus === 'Widowed' || cur || p.lateSpouseName);
    var dead = S.find('people', function (x) { return x.id !== p.id && x.familyRole !== 'child' && !x.mergedInto && (deceased(x) || x.category === 'Deceased'); })
      .sort(function (a, b) { return (a.lastName + a.firstName).localeCompare(b.lastName + b.firstName); });
    if (cur && dead.indexOf(cur) < 0) dead.unshift(cur);
    var sel = cur ? cur.id : p.lateSpouseName ? '__out' : '';
    return '<div id="pf-late-f"' + (show ? '' : ' hidden') + '><label class="field">' + F('Late spouse') + '<select class="findable" id="pf-late"><option value="">' + T('Nobody recorded') + '</option>' +
      dead.map(function (x) { return '<option value="' + x.id + '"' + (sel === x.id ? ' selected' : '') + '>' + esc(x.lastName + ', ' + (x.preferredName || x.firstName)) + (x.deceasedAt ? ' (' + esc(T('died {date}', { date: H.fmt(x.deceasedAt, true) })) + ')' : '') + '</option>'; }).join('') +
      '<option value="__out"' + (sel === '__out' ? ' selected' : '') + '>' + T('Someone not in Church & Trellis…') + '</option></select><small>' + T('Who they were married to. Shown on their record as “Was married to …”.') + '</small></label>' +
      '<label class="field" id="pf-late-n-f"' + (sel === '__out' ? '' : ' hidden') + '>' + F('Their name') + '<input id="pf-late-n" value="' + esc(p.lateSpouseName || '') + '"></label></div>';
  }

  /** Staff details for Leave (Administrators only): category (sets allowances and working days), start date (pro-rata), own working days. */
  /** The app access someone may be given here: any for Administrators; a Pastor with the "access" tick gives the smaller
   *  roles only, and can't change an Administrator's or another Pastor's access (the rules refuse it too). */
  function roleChoices(p) {
    if (H.can('*')) return Object.keys(H.ROLES);
    if (!H.can('access.manage')) return [];
    var small = ['member', 'rosters', 'kids', 'none'];
    return small.indexOf(p.appRole || 'member') >= 0 ? small : [];
  }
  function staffFields(p) {
    var lv = S.leave() || { levels: [] }, st = p.staff || {}, DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    var mine = st.workDays ? st.workDays.split(/\s*,\s*/) : [];
    return '<fieldset class="panel" style="padding:12px 14px;margin:6px 0 14px"><label class="check" style="margin:0"><input type="checkbox" id="pf-staff"' + (p.staff ? ' checked' : '') + '><span><b>' + T('Church staff member') + '</b><br><span class="muted small">' + T('Shows them in Leave, with the allowances of their staff category.') + '</span></span></label>' +
      '<div id="pf-staff-f"' + (p.staff ? '' : ' hidden') + ' style="margin-top:10px"><div class="two"><label class="field req">' + F('Staff category') + '<select id="pf-scat"><option value="">' + T('Choose…') + '</option>' +
      lv.levels.map(function (l) { return '<option value="' + esc(l.level) + '"' + (st.category === l.level ? ' selected' : '') + '>' + esc(l.label || l.level) + '</option>'; }).join('') + '</select><small>' + T('Change categories under Leave → Settings.') + '</small></label>' +
      '<label class="field req">' + F('Started at the church') + '<input type="date" id="pf-sstart" value="' + esc(st.start || '') + '"><small>' + T('Used to work out a first year’s allowance.') + '</small></label></div>' +
      '<label class="check"><input type="checkbox" id="pf-sw-same"' + (mine.length ? '' : ' checked') + '><span>' + T('Works the same days as their category') + '</span></label>' +
      '<div id="pf-sw-days" class="row" style="flex-wrap:wrap;gap:4px 14px"' + (mine.length ? '' : ' hidden') + '>' + DAYS.map(function (d) {
        return '<label class="check" style="margin:0"><input type="checkbox" class="pf-sw" value="' + d + '"' + (mine.indexOf(d) >= 0 ? ' checked' : '') + '><span>' + esc(T(d)) + '</span></label>';
      }).join('') + '</div></div></fieldset>';
  }

  /** The orange "what this means" under a consent that was given: shown as soon as it is unticked (wired below), so people
   * know before saving that, for example, without Email or SMS they might miss reminders of their roster duties. */
  function withoutNote(p, pur) {
    return hasConsent(p.id, pur) ? '<span class="note warn cf-without" data-for="' + esc(pur) + '" hidden>' + esc(P.purposeWithout(pur)) + '</span>' : '';
  }
  if (typeof document !== 'undefined') document.addEventListener('change', function (ev) {
    var box = ev.target; if (!box.classList || !box.classList.contains('cf-p')) return;
    var w = box.closest('label').querySelector('.cf-without'); if (w) w.hidden = box.checked;
    var save = document.querySelector('[data-act="people:saveconsent"]'), c = document.getElementById('cf-confirm');
    if (save && save.dataset.sure) { delete save.dataset.sure; save.textContent = T('Save'); if (c) c.hidden = true; }   // changed again: ask again
  });

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
        return '<label class="check"><input type="checkbox" class="cf-p" data-p="' + esc(pur) + '"' + (hasConsent(p.id, pur) ? ' checked' : '') + '><span><b>' + esc(T(P.purposeName(pur))) + '</b> ' + P.purposeTip(pur) + '<br><span class="muted small">' + esc(T({
          'Church records': 'Keep their details on the church database.', 'Email': 'Church news and information by email.', 'SMS': 'Reminders and urgent news by SMS.',
          'Church directory': 'My name, phone, email and home address may be seen by church staff and leaders, and by members as far as the church allows.', 'Care group': 'Photo, phone, email, address and birthday shared with my Care Group.', 'Photos': 'Photos at church events may be shared.', 'Children’s medical notes': 'Allergies and medical notes kept for safety at children’s church.' }[pur])) + '</span>' + withoutNote(p, pur) + '</span></label>';
      }).join('') +
      (child ? '' : '<p class="field-l" style="margin:14px 0 4px">' + F('Would like to receive') + '</p>' + RECEIVE.map(function (r) {
        return '<label class="check"><input type="checkbox" class="cf-p" data-p="' + esc(r[0]) + '"' + (hasConsent(p.id, r[0]) ? ' checked' : '') + '><span><b>' + esc(T(r[0])) + '</b><br><span class="muted small">' + esc(T(r[1])) + '</span>' + withoutNote(p, r[0]) + '</span></label>';
      }).join('')) +
      (!me ? '<div class="two" style="margin-top:8px"><label class="field">' + F('How it was given') + '<select id="cf-method">' + ['Paper connect card', 'Online form', 'In person (verbal)', 'Email'].map(function (m) { return '<option value="' + m + '">' + esc(T(m)) + '</option>'; }).join('') + '</select></label>' +
        (child ? '<label class="field req">' + F('Given by (parent or guardian)') + '<select id="cf-guardian">' + guardians.map(function (g) { return '<option value="' + g.id + '">' + esc(H.name(g)) + '</option>'; }).join('') + '</select></label>' : '') + '</div>' : '') +
      '<p class="note warn" id="cf-confirm" hidden></p>' +
      '<p class="hint">' + esc(Store.settings().privacyNotice) + '</p></div>' +
      '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn save" data-act="people:saveconsent" data-id="' + p.id + '">' + T('Save') + '</button></div>', T('Consent'));
  }


  Object.assign(P.actions, {
    add: function () { editDialog(null); },
    /** Visitor cards or a welcome sheet: names (and any phone numbers and email addresses) read from a photo, or typed or said,
     *  checked one by one, then added as Attenders (js/name-scan.js). Names already in People are found and left out. */
    scan: function () {
      if (!(H.can('*') || H.can('people.edit')) || S.preview() || !window.NameScan) return;
      NameScan.open({ title: T('Add people from a photo'), sub: T('Visitor cards or a welcome sheet'), mode: 'people', canNew: true,
        people: S.find('people', function (p) { return p.active !== false && !p.binnedAt && !p.mergedInto && p.category !== 'Deceased'; }),
        done: function (r) {
          var made = r.fresh.map(function (f) { return NameScan.addPerson(Object.assign({ firstVisit: true }, f), 'a photo of visitor cards'); });
          return { message: made.length ? TN('{n} person added to People.', '{n} people added to People.', made.length) : T('Nobody new to add.') };
        } });
    },
    usespouse: function (el) {   // a suggested spouse or partner: choose them in the box
      var sel = document.getElementById('pf-spouse'); if (!sel) return;
      sel.value = el.dataset.id; sel.dispatchEvent(new Event('change', { bubbles: true }));
      var row = el.closest('.spouse-sug'); if (row) row.hidden = true;
    },
    unknown: function (el) { nkShow(el.dataset['for'], true); },   // “Not known” beside Email / Mobile (or in the error card)
    known: function (el) { nkShow(el.dataset['for'], false); },    // “Add it”
    edit: function (el) { editDialog(S.get('people', el.dataset.id)); var f = el.dataset.focus && document.getElementById(el.dataset.focus); if (f) { f.focus(); f.scrollIntoView({ block: 'center' }); } },
    consent: function (el) { consentDialog(S.get('people', el.dataset.id)); },
    save: function () { H.autoForget(); savePerson(false); },   // Add person, or Done: everything checked, then the window closes
    autosave: function () { savePerson(true); }
  });
  var editSession = { id: '', audited: false, addr: '' };   // one "Updated details" line in the audit log per time the window is open
  /** Edit details / Add a person. quiet = saving as you go: the window stays open, problems show in a small note. */
  function savePerson(quiet) {
        var g = function (id) { var e = document.getElementById(id); return e ? e.value.trim() : null; };
        var err = document.getElementById('pf-err'), id = g('pf-id');
        if (!err) return;
        if (quiet) {   // every "can't save" below shows in the small red note too
          var box = err;
          err = { set textContent(v) { box.textContent = v; H.toast(v, true); }, get textContent() { return box.textContent; }, set hidden(v) { box.hidden = v; } };
        }
        var p = id ? JSON.parse(JSON.stringify(S.get('people', id))) : { active: true, appRole: Store.defaultRole(), keyDates: [], source: 'manual' };
        // A box that needs attention: say so right under it and put the cursor in it, so it can be fixed at once.
        // (Saving as you go never moves the cursor – someone may be typing elsewhere – so there it stays a note and a toast.)
        document.querySelectorAll('#pf .field-err').forEach(function (n) { n.remove(); });
        document.querySelectorAll('#pf [aria-invalid]').forEach(function (n) { n.removeAttribute('aria-invalid'); });
        var fail = function (fieldId, msg) {
          err.textContent = msg;
          var el = document.getElementById(fieldId), lab = el && el.closest('.field');
          if (quiet || !el || !lab) { err.hidden = false; return true; }
          err.hidden = true;
          for (var d = el.closest('details'); d; d = d.parentElement && d.parentElement.closest('details')) d.open = true;   // a folded-away section opens
          var note = document.createElement('small'); note.className = 'field-err'; note.setAttribute('role', 'alert'); var nt = document.createElement('span'); nt.className = 'fe-t'; nt.textContent = msg; note.appendChild(nt); lab.appendChild(note);
          if (fieldId === 'pf-email' || fieldId === 'pf-mobile') {   // missing: offer “Not known” right there
            var nk = document.createElement('button'); nk.type = 'button'; nk.className = 'fe-act'; nk.textContent = T('Not known'); nk.setAttribute('data-act', 'people:unknown'); nk.setAttribute('data-for', fieldId);
            if (!g(fieldId)) note.appendChild(nk);
          }
          var box = lab.querySelector('.find-in') || el;   // a dropdown is shown as a find box: the cursor goes in that
          el.setAttribute('aria-invalid', 'true'); box.setAttribute('aria-invalid', 'true');
          var clear = function () { note.remove(); el.removeAttribute('aria-invalid'); box.removeAttribute('aria-invalid'); };
          el.addEventListener('input', clear, { once: true }); el.addEventListener('change', clear, { once: true });
          if (box !== el) { box.addEventListener('input', clear, { once: true }); box.addEventListener('change', clear, { once: true }); }
          box.scrollIntoView({ block: 'center', behavior: 'smooth' }); box.focus({ preventScroll: true });
          return true;
        };
        if (!g('pf-first') || !g('pf-last')) { fail(g('pf-first') ? 'pf-last' : 'pf-first', T('Please enter a first and last name.')); return; }
        var dead = !!id && (deceased(p) || p.category === 'Deceased');   // someone who has died: only their name is needed
        var need = function (fieldId, msg) { if (g(fieldId) === '' && !dead) return fail(fieldId, msg); return false; };
        if (need('pf-cat', T('Please choose a category.')) || need('pf-fam', T('Tell us which household they are in, or choose “They live on their own”.')) ||
          need('pf-frole', T('Please choose whether they are an adult or a child in the household.'))) return;
        // Email and mobile must be filled in for adults: the real one, or “Not known” (saved as a flag, never as a word). A typed word counts as Not known; a real value wins over the flag.
        var isChild = (g('pf-frole') !== null ? g('pf-frole') : p.familyRole) === 'child', mine = !!id && isMe(p);
        var em = g('pf-email'), mo = g('pf-mobile'), emWord = P.isUnknownWord(em), moWord = P.isUnknownWord(mo);
        if (emWord) em = ''; if (moWord) mo = '';
        var emU = emWord || (g('pf-email-unknown') === '1' && !em), moU = moWord || (g('pf-mobile-unknown') === '1' && !mo);
        if (!quiet) {   // while saving as you go, a box still waiting for an answer doesn't stop the rest from being saved; Done and closing the window do ask
          if (!isChild && !em && !emU && !dead) { fail('pf-email', T(mine ? 'Add your email address, or choose Not known.' : 'Add their email address, or choose Not known.')); return; }
          if (!isChild && !mo && !moU && !dead) { fail('pf-mobile', T(mine ? 'Add your mobile number, or choose Not known.' : 'Add their mobile number, or choose Not known.')); return; }
        }
        if (em && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { fail('pf-email', T('That email address doesn’t look right.')); return; }
        if (mo && !/\d{3}/.test(mo)) { fail('pf-mobile', T('That mobile number doesn’t look right.')); return; }
        // Duplicates: very likely matches can't be saved, unless an Administrator has checked it's a different person
        var dups = dupMatches().filter(function (m) { return m.score >= 70; }), dupOk = document.getElementById('pf-dup-ok');
        if (dups.length && !(canDup() && dupOk && dupOk.checked)) {
          dupWarn(); err.textContent = T(canDup() ? 'This looks like someone already in Church & Trellis. Open them instead, or tick “I’ve checked: this is a different person”.' : 'This looks like someone already in Church & Trellis, so it can’t be saved. Open them instead, or ask an Administrator.');
          err.hidden = false; return;
        }
        p.firstName = g('pf-first'); p.lastName = g('pf-last'); p.preferredName = g('pf-pref');
        p.email = em; p.mobile = mo;
        if (emU) p.emailUnknown = true; else delete p.emailUnknown;
        if (moU) p.mobileUnknown = true; else delete p.mobileUnknown;
        if (g('pf-birth') !== null) p.birthDate = g('pf-birth');
        if (g('pf-wed') !== null && !document.getElementById('pf-wed').disabled) {   // greyed out (e.g. Single): left as it was
          if (g('pf-wed') > H.today()) { fail('pf-wed', T('The wedding anniversary can’t be in the future.')); return; }
          p.keyDates = (p.keyDates || []).filter(function (k) { return !WEDDING.test(k.label || ''); });
          if (g('pf-wed') && g('pf-frole') !== 'child') p.keyDates.push({ label: 'Wedding anniversary', date: g('pf-wed') });
        }
        var wasCat = id ? p.category : '';
        if (g('pf-cat') !== null) p.category = g('pf-cat');
        if (g('pf-died') !== null) {   // correcting the date someone died (and the funeral)
          var dd = g('pf-died'), fu = g('pf-funeral');
          if (!dd || dd > H.today()) { fail('pf-died', T('Please choose the date they died.')); return; }
          p.deceasedAt = dd;
          p.keyDates = (p.keyDates || []).filter(function (k) { return k.label !== 'Died' && k.label !== 'Funeral'; }).concat([{ label: 'Died', date: dd }]).concat(fu ? [{ label: 'Funeral', date: fu }] : []);
        }
        if (g('pf-gender') !== null) { if (g('pf-gender')) p.gender = g('pf-gender'); else delete p.gender; }
        if (g('pf-middle') !== null) { if (g('pf-middle')) p.middleName = g('pf-middle'); else delete p.middleName; }
        if (g('pf-maiden') !== null) { if (g('pf-maiden')) p.maidenName = g('pf-maiden'); else delete p.maidenName; }
        if (g('pf-street') !== null) {
          var ad = { street: g('pf-street'), street2: g('pf-street2'), city: g('pf-city'), postcode: g('pf-postcode'), province: g('pf-province'), country: g('pf-country') === '__other' ? g('pf-country-o') : g('pf-country') };
          var gpsIn = document.getElementById('pf-gps'), gt = (g('pf-gps') || '').replace(/\s+/g, ' ').trim();
          if (gt) {
            var gp = Countries.parseGps(gt), gc = ad.country ? Countries.find(ad.country) : Countries.church(S.settings()), warn = '';
            if (gp.error) {
              err.textContent = T(gp.error === 'minutes' ? 'Please use decimal numbers, like -29.4833, 30.2333 – not degrees and minutes. In Google Maps, press and hold the spot and tap the numbers to copy them.' :
                gp.error === 'range' ? 'Latitude (the first number) can only be between -90 and 90, and longitude (the second) between -180 and 180.' :
                gp.error === 'swapped' ? 'The two numbers look the wrong way round: latitude (north or south) comes first, then longitude (east or west).' :
                'Please type the latitude and longitude as two numbers, like -29.4833, 30.2333.'); err.hidden = false; return;
            }
            var chk = gc ? Countries.gpsCheck(gp.lat, gp.lng, gc.code) : null;
            if (chk && chk.kind === 'flip') warn = T('That spot isn’t in {country}. Did you mean {fix}? South of the equator and west of Greenwich the number has a minus sign. Tap Save again to keep it as typed.', { country: gc.name, fix: Countries.gpsText(chk.lat, chk.lng) });
            else if (chk) warn = T('That spot isn’t in {country}. Please check the numbers and their minus signs (south and west are negative). Tap Save again to keep it as typed.', { country: gc.name });
            else if (gp.decimals < 3) warn = T('Those numbers only point to somewhere within several kilometres. For an exact spot, copy every digit from the map. Tap Save again to keep it as typed.');
            if (warn && !(gpsIn && gpsIn.getAttribute('data-checked') === gt)) { if (gpsIn) gpsIn.setAttribute('data-checked', gt); err.textContent = warn; err.hidden = false; return; }
            ad.lat = gp.lat; ad.lng = gp.lng;
          }
          if (ad.street || ad.street2 || ad.city || ad.postcode || ad.lat != null) p.address = ad; else delete p.address;
        }
        if (g('pf-psince') !== null) {
          var ps = g('pf-psince'), pu = g('pf-pupd');
          if (ps && pu && pu < ps) { fail('pf-pupd', T('The partnership can’t be updated before the date they were accepted.')); return; }
          if (ps) p.partnerSince = ps; else delete p.partnerSince;
          if (pu) p.partnerUpdated = pu; else if (!/^\d{4}$/.test(p.partnerUpdated || '')) delete p.partnerUpdated;   // keep a year from Elvanto
        }
        if (g('pf-attsince') !== null) { if (g('pf-attsince')) p.attendingSince = g('pf-attsince'); else delete p.attendingSince; }
        if (g('pf-frole') !== null) p.familyRole = g('pf-frole');
        if (g('pf-marital') !== null) {
          if (p.familyRole === 'child') delete p.maritalStatus;
          else if (!g('pf-marital') && !dead) { fail('pf-marital', T('Please choose a marital status (or “Not known”).')); return; }
          else if (!g('pf-marital')) delete p.maritalStatus;
          else p.maritalStatus = g('pf-marital');
        }
        if (g('pf-late') !== null) {
          var was = lateSpouse(S.get('people', p.id) || p), wasName = p.lateSpouseName || '';
          var lv = g('pf-late'), ln = g('pf-late-n') || '';
          if (lv === '__out' && !ln) { fail('pf-late-n', T('Type the name of their late spouse, or choose “Nobody recorded”.')); return; }
          if (lv && lv !== '__out') { p.lateSpouseId = lv; delete p.lateSpouseName; delete p.lateSpouseSet; }
          else { delete p.lateSpouseId; if (lv === '__out') p.lateSpouseName = ln; else delete p.lateSpouseName; if (lv || was || wasName || p.maritalStatus === 'Widowed') p.lateSpouseSet = true; }
        }
        if (g('pf-role') !== null) p.appRole = g('pf-role');
        var sbox = document.getElementById('pf-staff');
        if (sbox) {
          if (sbox.checked) {
            if (!g('pf-scat') || !g('pf-sstart')) { fail(g('pf-scat') ? 'pf-sstart' : 'pf-scat', T('For staff, choose their staff category and the date they started working at the church.')); return; }
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
        if (Store.isLive() && p.appRole && p.appRole !== 'none' && p.appRole !== 'member' && !p.email) {   // members with no email sign in with a code
           err.textContent = T('To give someone access to Church & Trellis, add their email address – that’s how they sign in.'); err.hidden = false; return; }
        var sharers = p.appRole && p.appRole !== 'none' && p.active !== false ? signsInWith(p) : [];
        if (Store.isLive() && sharers.length >= 4) { err.textContent = T('At most 4 people can share one email address to sign in. Give this person an email address of their own.'); err.hidden = false; return; }
        if (Store.isLive() && !(H.can('*')) && sharers.some(function (o) { return o.appRole === 'admin' || o.appRole === 'pastor'; })) {
          err.textContent = T('{names} also signs in with this email address. Only an Administrator can give access on an email address shared with a Pastor or Administrator.', { names: sharers.map(H.name).join(', ') }); err.hidden = false; return;
        }
        var fam = g('pf-fam');
        if (fam === '__new') {
          var f = S.put('families', { name: p.lastName + ' family', custom: false }, 'Created a household for ' + p.firstName + ' ' + p.lastName); fam = f.id;
          var fs = document.getElementById('pf-fam');   // saving as you go: the list now shows the new household, so it isn't made twice
          if (fs) { var o = document.createElement('option'); o.value = f.id; o.textContent = H.familyName(f); fs.appendChild(o); fs.value = f.id; }
        }
        if (fam !== null) p.familyId = fam;
        if (p.familyRole === 'child' && !p.familyId && !dead) { fail('pf-fam', T('Children must be in a household, so the church knows who they live with.')); return; }
        var care = window.CareUI ? CareUI.read() : null;
        if (care && care.error && !dead) { err.textContent = care.error; err.hidden = false; return; }
        // Spouse or partner chosen by hand (left as it was when the box is greyed out or not shown)
        var spEl = document.getElementById('pf-spouse'), spNew = spEl && !spEl.disabled && !isChild ? spEl.value : null, spOld = p.spouseId || '';
        if (spNew !== null) { if (spNew) p.spouseId = spNew; else delete p.spouseId; }
        var wantBadge = document.getElementById('pf-badge');
        if (!id && wantBadge && wantBadge.checked) p.badgeWanted = H.today();
        err.hidden = true;
        var before = id ? S.get('people', id) : null, same = function (a, b) { a = Object.assign({}, a); b = Object.assign({}, b); delete a.updatedAt; delete b.updatedAt; return JSON.stringify(a) === JSON.stringify(b); };
        var changed = !before || !same(before, p);
        if (changed) {
          var say = !id || editSession.id !== id || !editSession.audited;   // saving as you go: one line in the audit log, not one per pause
          S.put('people', p, say ? (id ? 'Updated details of ' : 'Added ') + p.firstName + ' ' + p.lastName + (p.badgeWanted && !id ? ' (name badge to print)' : '') : null);
          if (id) editSession = { id: id, audited: true, addr: editSession.id === id ? editSession.addr : '' };
        }
        if (spNew !== null && spNew !== spOld) linkSpouse(p, spOld, spNew);
        P.partnerAgrees(p, wasCat);   // becoming a Church Partner: Contact details agreed
        if (window.CareUI) { if (!(care && CareUI.setFrom(p, care))) CareUI.sync(p.id); }
        if (window.LifeUI) LifeUI.sync(p.id);   // their life group cards show their details
        dups.forEach(function (m) { markNotSame(p.id, m.id); });
        if (quiet) { H.render(); H.toast(T('Saved')); return; }   // the page behind shows the change; the window stays open
        H.closeModal();
        if (!id) { H.go('people/p/' + p.id); setTimeout(function () { consentDialog(p); }, 50); } else H.render();
        H.toast(T(id ? 'Saved' : 'Added – now record their consent'));
        if (id && P.canCouples() && !dead) spouseAddressOffer(S.get('people', id), editSession.addr);
  }
  /** Their home address was changed: offer the same one to their spouse (only if it is different there; nothing changes until Yes). */
  function spouseAddressOffer(p, before) {
    if (!p || !HS.hasAddress(p) || HS.addressKey(p.address) === before) return;
    var sp = HS.spouseToOffer(p, S.list('people'), S.list('families')); if (!sp) return;
    H.modal(H.dialogHead(T('Change {name}’s address too?', { name: H.name(sp) }), T('Married couples and partners normally share one home address.')) +
      '<div class="dlg-body"><p><b>' + esc(H.name(p)) + ':</b> ' + esc(P.addrText(p)) + '</p><p><b>' + esc(H.name(sp)) + ':</b> ' + esc(P.addrText(sp)) + '</p></div>' +
      '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('No, leave it') + '</button>' +
      '<button class="btn" data-act="people:addrapart" data-a="' + p.id + '" data-b="' + sp.id + '">' + T('Keep both addresses') + '</button>' +
      '<button class="btn primary" data-act="people:addrcopy" data-from="' + p.id + '" data-to="' + sp.id + '">' + esc(T('Yes, change {name}’s address', { name: H.name(sp) })) + '</button></div>', T('Same address for both?'));
  }
  Object.assign(P.actions, {
    saveconsent: function (el) {
        var p = S.get('people', el.dataset.id), me = isMe(p);
        var method = document.getElementById('cf-method'), guardian = document.getElementById('cf-guardian');
        // Withdrawing a consent that was given: warn first, and save only when Save is pressed a second time
        var gone = [].filter.call(document.querySelectorAll('.cf-p'), function (b) { return !b.checked && hasConsent(p.id, b.dataset.p); });
        if (gone.length && !el.dataset.sure) {
          var c = document.getElementById('cf-confirm');
          el.dataset.sure = '1'; el.textContent = T('Withdraw and save');
          c.innerHTML = '<b>' + esc(T(me ? 'You are withdrawing consent for: {list}' : 'They are withdrawing consent for: {list}', { list: gone.map(function (b) { return T(P.purposeName(b.dataset.p)); }).join(', ') })) + '</b><br>' +
            esc(T('Read what this means in orange above. Press “{button}” to go ahead, or tick them again to keep them.', { button: T('Withdraw and save') }));
          c.hidden = false; c.scrollIntoView({ block: 'nearest' }); return;
        }
        document.querySelectorAll('.cf-p').forEach(function (box) {
          var pur = box.dataset.p, had = hasConsent(p.id, pur);
          if (box.checked === had && consentFor(p.id, pur)) return;
          if (!box.checked && !consentFor(p.id, pur) && RECEIVE_P.indexOf(pur) >= 0) return;   // a "would like to receive" never chosen: nothing to record
          var old = consentFor(p.id, pur); if (old) { old.withdrawnAt = H.today(); S.put('consents', old); }
          S.put('consents', { personId: p.id, purpose: pur, given: box.checked, date: H.today(), method: me ? 'Changed in the app' : method.value, recordedBy: H.name(H.user()), guardianId: guardian ? guardian.value : '' },
            (box.checked ? 'Consent given: ' : 'Consent withdrawn: ') + pur + ' for ' + H.name(p));
        });
        if (window.CareUI) CareUI.sync(p.id);   // their care group card follows their consent
        if (window.LifeUI) LifeUI.sync(p.id);   // their life group cards follow their Contact details consent
        H.closeModal(); H.render(); H.toast(T('Consent saved'));
      },
    death: function (el) {
        var p = S.get('people', el.dataset.id);
        var spouses = p.familyId ? members(p.familyId).filter(function (m) { return m.id !== p.id && m.familyRole !== 'child' && m.maritalStatus === 'Married'; }) : [];
        H.modal(H.dialogHead(T('Record the death of {name}', { name: H.name(p) }), T('They stay on the church records, but come off rosters, teams, the directory and messages, and can no longer sign in.')) +
          '<div class="dlg-body"><div class="two"><label class="field req">' + F('Date of death') + '<input type="date" id="dd-date" value="' + H.today() + '" max="' + H.today() + '"></label>' +
          '<label class="field">' + F('Funeral or memorial') + '<input type="date" id="dd-funeral"></label></div>' +
          spouses.map(function (s) { return '<label class="check"><input type="checkbox" class="dd-sp" value="' + s.id + '" checked><span>Change ' + esc(H.name(s)) + '’s marital status to <b>' + T('Widowed') + '</b></span></label>'; }).join('') +
          (H.can('notes') ? '<label class="field">' + F('Pastoral note') + '<textarea id="dd-note" rows="2" placeholder="' + esc(T('e.g. Family would like a visit next week')) + '"></textarea><small>' + T('Only pastors see it.') + '</small></label>' : '') +
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
