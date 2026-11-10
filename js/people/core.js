/* Church Hub – People: shared by every part of the People page: who may see what, consent, households, ages, couples, duplicates.
 * The People page is several files in js/people/ (loaded in this order: core, directory, profile, edit, households, search),
 * put together by js/mod-people.js. Each file adds what it defines to PeopleParts, so the others can use it. */
var PeopleParts = { actions: {} };
(function (P) {
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
  function canSeeAll() { return H.can('people.view') || H.can('*'); }
  function canBasic() { return canSeeAll() || H.can('people.basic'); }
  function isMe(p) { var u = H.user(); return u && p && u.id === p.id; }
  /** Work that takes long with a big church (every couple, everyone's consents) is done once and kept until anything changes
   *  (Store.version()). Without it, Home took seconds for an Administrator with 1,000+ people. */
  var memos = {};
  function memo(key, make) {
    var v = S.version ? S.version() : '', m = memos[key];
    if (m && m.v === v) return m.value;
    var value = make(); memos[key] = { v: v, value: value }; return value;
  }
  /** Like memo, but slow work is done just after the page has appeared: until then it gives null, and once ready the page
   *  is drawn again (unless someone is typing or has a dialog open – then it shows the next time). */
  var later = {};
  function memoLater(key, make) {
    var v = S.version ? S.version() : '', m = memos[key];
    if (m && m.v === v) return m.value;
    if (later[key] === v) return null;
    later[key] = v;
    setTimeout(function () {
      if ((S.version ? S.version() : '') !== v) { delete later[key]; return; }
      memo(key, make); delete later[key];
      var a = document.activeElement;
      if (!document.querySelector('#modal .overlay') && !(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) H.render();
    }, 30);
    return null;
  }
  /** Each person's current answer for each purpose: { personId: { purpose: latest consent record } }. */
  function consentIndex() {
    return memo('consents', function () {
      var ix = {};
      S.list('consents').forEach(function (c) {
        if (c.withdrawnAt) return;
        var m = ix[c.personId] = ix[c.personId] || {}, was = m[c.purpose];
        if (!was || !(c.date < was.date)) m[c.purpose] = c;   // the latest (the last one listed when dates are equal, as before)
      });
      return ix;
    });
  }
  function consentFor(pid, purpose) { return (consentIndex()[pid] || {})[purpose]; }
  function hasConsent(pid, purpose) { var c = consentFor(pid, purpose); return !!(c && c.given); }
  /** Becoming a Church Partner includes agreeing to be in the church directory (consent "Church directory", shown as Contact
   *  details): recorded when someone becomes a Church Partner and hasn't agreed yet. They can still say no later (Consent). */
  var PARTNER_AGREED = TX('Agreed on becoming a Church Partner');
  function partnerAgrees(p, was) {
    if (!p || p.category !== 'Church Partner' || was === 'Church Partner' || p.familyRole === 'child' || p.active === false) return false;
    if (!(H.can('*') || H.can('people.edit')) || hasConsent(p.id, 'Church directory')) return false;
    var old = consentFor(p.id, 'Church directory');
    if (old) { old = JSON.parse(JSON.stringify(old)); old.withdrawnAt = H.today(); S.put('consents', old); }
    S.put('consents', { personId: p.id, purpose: 'Church directory', given: true, date: H.today(), method: PARTNER_AGREED, recordedBy: H.name(H.user()), guardianId: '' },
      'Contact details agreed on becoming a Church Partner: ' + H.name(p));
    return true;
  }
  /** Church Partners with no Contact details answer recorded at all (never asked in Church Hub): an Administrator may record
   *  that they agreed when they became Church Partners (Settings → Who can see what). Someone who said no is left alone. */
  function partnersUnrecorded() {
    return S.find('people', function (p) {
      return p.category === 'Church Partner' && p.active !== false && p.familyRole !== 'child' && !S.find('consents', function (c) { return c.personId === p.id && c.purpose === 'Church directory'; }).length;
    });
  }
  function familyOf(p) { return p && p.familyId ? S.get('families', p.familyId) : null; }
  /** The category, plus "Staff" when they work for the church – a Church Partner can be on the staff too. */
  /** A home address as lines to show ("1 Main Road", "Howick 3290", "KwaZulu-Natal"); the church's own country isn't repeated. */
  function addressLines(p) {
    var a = p && p.address; if (!a) return [];
    var c = a.country && Countries.find(a.country), home = Countries.church(S.settings());
    return [a.street, a.street2, [a.city, a.postcode].filter(Boolean).join(' '), a.province, a.country && !(c && c.code === home.code) ? a.country : ''].filter(function (x) { return x && String(x).trim(); });
  }
  function catTags(p) {
    var t = p.category ? '<span class="tag grey">' + esc(T(p.category)) + '</span>' : '', care = (window.CareUI ? CareUI.tag(p) : '') + (window.LifeUI ? LifeUI.tag(p) : '');
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

  /* ---------- list ---------- */
  // How the list is ordered: by first name, by the name they're known as, or by surname. Remembered on this device.
  // One collator for every comparison: localeCompare with options sets one up each time, which is slow for long lists
  var COLL = typeof Intl !== 'undefined' && Intl.Collator ? new Intl.Collator(undefined, { sensitivity: 'base' }) : null;
  function cmp(x, y) { x = String(x || ''); y = String(y || ''); return COLL ? COLL.compare(x, y) : x.localeCompare(y); }
  function known(p) { return p.preferredName || p.firstName; }
  var SORTS = {
    first: { label: 'First name', cmp: function (a, b) { return cmp(a.firstName, b.firstName) || cmp(a.lastName, b.lastName); } },
    known: { label: 'Known as', cmp: function (a, b) { return cmp(known(a), known(b)) || cmp(a.lastName, b.lastName); } },
    last: { label: 'Surname', cmp: function (a, b) { return cmp(a.lastName, b.lastName) || cmp(known(a), known(b)) || cmp(a.firstName, b.firstName); } }
  };
  /* ---------- couples: spouses and partners, worked out from each household (rules in js/households.js) ---------- */
  // Marital status and anniversaries are private details: only Administrators and Pastors see and change them.
  function canCouples() { return canSeeAll() && (H.can('*') || H.can('people.edit')); }
  function allCouples() { return canCouples() ? memo('couples', function () { return HS.couples(S.list('people'), S.list('families')); }) : []; }
  function couplesToCheck() { return canCouples() ? memo('couplesToCheck', function () { return HS.couplesToCheck(S.list('people'), S.list('families')); }) : []; }
  function coupleOf(pid) {
    if (!canCouples()) return null;
    var by = memo('coupleOf', function () { var m = {}; allCouples().forEach(function (c) { if (!m[c.a]) m[c.a] = c; if (!m[c.b]) m[c.b] = c; }); return m; });
    return by[pid] || null;
  }
  /* ---------- contact details: what each role sees of other people (Settings → Who can see what) ----------
   * Administrators and Pastors see everything; everyone sees their own. Church Partners, Roster coordinators and
   * Children's ministry see a name only, plus what Settings ticks for their role – and only of adults who agreed
   * (consent "Church directory", shown as Contact details). Church Partners can't tap or copy them (drawn as pictures). */
  var SHARE = [['mobile', TX('Mobile')], ['email', TX('Email')], ['address', TX('Home address')], ['spouse', TX('Spouse or partner')]];
  var TIERS = [['member', TX('Church Partners')], ['rosters', TX('Roster coordinator')], ['kids', TX('Children’s ministry')]];
  function seeTier() { return canSeeAll() ? '' : H.can('rosters.manage') ? 'rosters' : H.can('people.basic') ? 'kids' : 'member'; }
  function tierSees(f) { var t = seeTier(); return !t || (((S.settings() || {}).seeOthers || {})[t] || []).indexOf(f) >= 0; }
  function mayShare(p, f) {
    if (!p) return false;
    if (canSeeAll() || isMe(p)) return true;
    return tierSees(f) && p.familyRole !== 'child' && p.active !== false && !!(p.inDirectory || hasConsent(p.id, 'Church directory'));
  }
  function sharedValue(p, f) {
    if (f === 'mobile') return p.mobile || '';
    if (f === 'email') return p.email || '';
    if (f === 'address') return p.shareAddress || addressLines(p).join(', ');
    if (f === 'spouse') {
      if (p.shareSpouse) return p.shareSpouse;
      var c = HS.couples(S.list('people'), S.list('families')).filter(function (x) { return x.a === p.id || x.b === p.id; })[0];
      return c ? H.name(S.get('people', c.a === p.id ? c.b : c.a)) : '';
    }
    return '';
  }
  /** Text drawn as a picture: it can be read, but not tapped, selected or copied (for Church Partners). */
  function textPicture(s) {
    var c = document.createElement('canvas'), x = c.getContext('2d'), r = window.devicePixelRatio || 1;
    var cs = getComputedStyle(document.body), font = '15px ' + (cs.fontFamily || 'sans-serif');
    x.font = font; var w = Math.ceil(x.measureText(s).width) + 4;
    c.width = w * r; c.height = 22 * r; x.scale(r, r); x.font = font; x.fillStyle = cs.color || '#222'; x.textBaseline = 'middle'; x.fillText(s, 2, 11);
    return '<img class="nocopy" src="' + c.toDataURL() + '" width="' + w + '" height="22" alt="' + esc(T('Shown as a picture')) + '" draggable="false" style="vertical-align:middle;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;pointer-events:none;max-width:100%;height:auto">';
  }
  /** One contact detail for this viewer: a link (staff and leaders), a picture (Church Partners) or '' when not shared. */
  function contactHtml(p, f) {
    if (!mayShare(p, f)) return '';
    var v = sharedValue(p, f); if (!v) return '';
    var open = canSeeAll() || isMe(p) || seeTier() !== 'member';
    if (f === 'spouse') return esc(v);
    if (f === 'address') return v.split(/,\s*/).map(function (l) { return open ? esc(l) : textPicture(l); }).join('<br>') + (open ? ' ' + H.mapLink(v) : '');   // no map link for Church Partners: it would give away the address as text
    if (!open) return textPicture(v);
    return f === 'email' ? '<a href="mailto:' + esc(v) + '" target="_blank" rel="noopener">' + esc(v) + '</a>' : '<a href="tel:' + esc(v.replace(/\s/g, '')) + '">' + esc(v) + '</a>';
  }
  /** Consent "Church directory" is shown as Contact details (name, phone, email and address shared with staff and leaders). */
  function purposeName(pur) { return pur === 'Church directory' ? 'Contact details' : pur; }
  function first(id) { var q = S.get('people', id); return q ? (q.preferredName || q.firstName) : ''; }
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
  /* ---------- duplicates (Administrators): rules in js/duplicates.js ---------- */
  var DUP = Duplicates;
  // Administrators and Pastors (both may change people's details). "Not the same person" is kept on both people (notSame).
  function canDup() { return canSeeAll() && (H.can('*') || H.can('people.edit')); }
  function dupPeople() { return S.find('people', function (p) { return p.firstName !== 'Deleted' && !p.mergedInto && !p.binnedAt; }); }
  function notDup() { return DUP.ignored(S.list('people')); }
  /** How sensitive the duplicate check is: 1 (fewer warnings) … 5 (more); the church sets it on Find duplicates. */
  function dupSens() { var n = +((S.settings() || {}).dupSensitivity); return n >= 1 && n <= 5 ? n : 3; }
  /* ---------- late spouses: suggestions for Administrators (rules in js/households.js) ---------- */
  function isDead(p) { return deceased(p) || p.category === 'Deceased'; }
  // Sign-in access lives on the access list, which only Administrators change. (The demo gives everyone "Member", with no real list.)
  function hasAccess(p) { return !!p.appRole && p.appRole !== 'none' && (Store.isLive() || p.appRole !== 'member'); }
  /* ---------- edit dialogs ---------- */
  /* ---------- advanced search (like Elvanto's People → Advanced Search); rules in js/people-search.js ---------- */
  var PS = PeopleSearch;
  function keyDate(p, re) { var k = (p.keyDates || []).filter(function (x) { return re.test(x.label || ''); })[0]; return k ? k.date : ''; }
  function uniq(a) { return a.filter(function (x, i) { return x && a.indexOf(x) === i; }).sort(function (x, y) { return String(x).localeCompare(String(y)); }); }

  Object.assign(P, { memo: memo, memoLater: memoLater, partnerAgrees: partnerAgrees, partnersUnrecorded: partnersUnrecorded, PARTNER_AGREED: PARTNER_AGREED, purposeName: purposeName, SHARE: SHARE, TIERS: TIERS, contactHtml: contactHtml, mayShare: mayShare, seeTier: seeTier, sharedValue: sharedValue, tierSees: tierSees, CARE_WEEKS: CARE_WEEKS, CATS: CATS, DUP: DUP, GENDERS: GENDERS, HS: HS, MARITAL: MARITAL, PS: PS, PURPOSES: PURPOSES, RECEIVE: RECEIVE, RECEIVE_P: RECEIVE_P, SORTS: SORTS, WEDDING: WEDDING, addressLines: addressLines, age: age, allCouples: allCouples, canBasic: canBasic, canChildren: canChildren, canCouples: canCouples, canDup: canDup, canRecordDeath: canRecordDeath, canSeeAll: canSeeAll, canVolunteer: canVolunteer, catTags: catTags, cmp: cmp, consentFor: consentFor, coupleOf: coupleOf, couplesToCheck: couplesToCheck, deceased: deceased, dupPeople: dupPeople, dupSens: dupSens, familyOf: familyOf, first: first, hasAccess: hasAccess, hasConsent: hasConsent, householdNames: householdNames, isDead: isDead, isMe: isMe, keyDate: keyDate, known: known, lateSpouse: lateSpouse, linkName: linkName, links: links, members: members, notDup: notDup, serveTimes: serveTimes, slotIds: slotIds, slotName: slotName, state: state, survivingSpouses: survivingSpouses, uniq: uniq, visiblePeople: visiblePeople, yearsSince: yearsSince });
})(PeopleParts);
