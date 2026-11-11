/* Church Hub – Life groups: Bible studies, life groups and midweek meetings (the church may call them something else:
 * Settings → Terminology (Church Words)). Off until an Administrator switches them on (Settings → Apps).
 * A life group is a careGroups record with type 'life' (Store hands them out as lifeGroups, their cards as lifeShare), so
 * it works like a care group: leaders and members, a card per member, messages to the group. Differences: each group's
 * leaders name it, and a member's card follows their "Church directory" consent (agreed on becoming a Church Partner),
 * not the "Care group" consent. Administrators and Pastors set up groups and leaders; leaders add and remove members and
 * rename their group. People may be in several life groups. Rules: js/care.js (leaderMayChange), firestore.rules. */
(function () {
  'use strict';
  var H = Hub, esc = H.esc, S = Store, T = I18n.t, TN = I18n.tn;
  var BOOK = 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h7M8 11h5';
  var STAR = 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z';
  var PEN = 'M4 20h4L20 8l-4-4L4 16zM14 6l4 4';
  var CONSENT = 'Church directory';

  function manager() { return H.can('*') || H.can('people.edit'); }   // Administrators and Pastors
  function me() { return H.user(); }
  function on() { return H.isOn('life'); }
  function byName(a, b) { return String(a.name || '').localeCompare(String(b.name || '')); }
  function groups() { return S.list('lifeGroups').slice().sort(byName); }
  function mine(pid) { return Care.groupsOf(S.list('lifeGroups'), pid); }
  function consented(pid) {
    var c = S.find('consents', function (x) { return x.personId === pid && x.purpose === CONSENT && !x.withdrawnAt; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; })[0];
    return !!(c && c.given);
  }
  function thumb(dataUrl) {
    return new Promise(function (ok) {
      if (!dataUrl || typeof document === 'undefined') return ok('');
      var img = new Image();
      img.onload = function () { var cv = document.createElement('canvas'); cv.width = cv.height = 96; cv.getContext('2d').drawImage(img, 0, 0, 96, 96); try { ok(cv.toDataURL('image/jpeg', 0.7)); } catch (e) { ok(''); } };
      img.onerror = function () { ok(''); }; img.src = dataUrl;
    });
  }
  function sameCard(a, b) { return Care.FIELDS.every(function (k) { return k === 'updatedAt' || k === 'createdAt' || JSON.stringify(a[k] === undefined ? null : a[k]) === JSON.stringify(b[k] === undefined ? null : b[k]); }); }
  /** Bring a person's cards up to date – one in each life group they are in (by an Administrator or Pastor, or the person themself). */
  function sync(pid) {
    var u = me(), p = S.get('people', pid); if (!p || !u || !(manager() || u.id === pid) || S.preview()) return Promise.resolve();
    var gs = mine(pid), ids = gs.map(function (g) { return g.id; });
    S.find('lifeShare', function (c) { return c.personId === pid && ids.indexOf(c.groupId) < 0; }).forEach(function (c) { S.careUnshare(c.groupId, pid); });   // groups they have left
    if (!gs.length) return Promise.resolve();
    var ok = consented(pid);
    return (ok && p.photo ? S.photo(pid).then(thumb, function () { return ''; }) : Promise.resolve('')).then(function (ph) {
      gs.forEach(function (g) {
        var card = Object.assign({ id: g.id + ':' + pid, personId: pid, groupId: g.id }, Care.card(p, ok, Care.isLeader(g, pid), ph)), old = S.get('lifeShare', card.id);
        if (!old || !sameCard(old, card)) S.put('lifeShare', card);
      });
    });
  }
  /** Save changed groups, take away the cards in groups they left, write a line in the audit log. */
  function saveChanges(p, changes, why) {
    if (!changes.length) return false;
    changes.forEach(function (g) {
      var was = S.get('lifeGroups', g.id) || {}, wasIn = (was.memberIds || []).indexOf(p.id) >= 0, isIn = g.memberIds.indexOf(p.id) >= 0;
      S.put('lifeGroups', g);
      if (wasIn && !isIn) S.careUnshare(g.id, p.id);
      S.audit((why || '') + (isIn ? (Care.isLeader(g, p.id) ? 'Leader of midweek group ' : 'In midweek group ') + g.name : 'Taken out of midweek group ' + g.name) + ': ' + H.name(p), 'people/' + p.id);
    });
    sync(p.id);
    return true;
  }
  function place(p, gid, leader, why) { return saveChanges(p, Care.place(S.list('lifeGroups'), p, gid, leader), why); }
  var WORDS = { one: '{n} leader', many: '{n} leaders', none: 'No leader yet.' };
  /** A group's people folded away (its leaders' names show), so many groups fit on one page – see CareUI.fold. */
  function openFold(k) { if (window.CareUI && CareUI.openFold) CareUI.openFold(k); }
  function folded(key, g, ids, rowOf, nameOf, extra) {
    var rows = ids.map(rowOf), leads = ids.map(function (id) { return Care.isLeader(g, id); });
    if (window.CareUI && CareUI.fold) return CareUI.fold(key, leads, rows, ids.map(nameOf), extra, WORDS);
    return (rows.length ? '<div class="list" style="margin-top:8px">' + rows.join('') + '</div>' : '<p class="muted small" style="margin:8px 0 0">' + T('No one yet.') + '</p>') + (extra || '');
  }
  /** Everyone who may be added to a midweek group – children too (a youth group, a children's Bible club). */
  function people(exclude) { return S.find('people', function (p) { return p.active !== false && p.firstName !== 'Deleted' && !p.mergedInto && !p.binnedAt && p.category !== 'Deceased' && exclude.indexOf(p.id) < 0; }).sort(function (a, b) { return H.name(a).localeCompare(H.name(b)); }); }
  function pic(c, size) {
    var n = ((c.preferredName || c.firstName || '?').charAt(0) + (c.lastName || '').charAt(0)).toUpperCase();
    return '<span class="av' + (c.photo ? ' pic' : '') + '" style="--s:' + (size || 40) + 'px' + (c.photo ? ';background-image:url(' + c.photo + ')' : '') + '" aria-hidden="true">' + esc(n) + '</span>';
  }
  function birthday(mmdd) { if (!mmdd) return ''; var m = +mmdd.slice(0, 2), d = +mmdd.slice(3, 5); return d + ' ' + I18n.mon()[m - 1]; }
  function leaderTag() { return ' <span class="tag ok">' + T('Group leader') + '</span>'; }

  /* ---------- when and where a group meets, and who does what: g.when = { day, time, freq }, g.venue = { atHost } or
   * { place, address }, g.roles = { personId: 'coleader' | 'host' } (the leaders are leaderIds). Set by Administrators,
   * Pastors and the group's leaders; seen by the group. A host's home address is shown from People to Administrators
   * and Pastors, and to the group only from the host's own card (if they are in the church directory). */
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var FREQ = { weekly: 'Every week', fortnightly: 'Every two weeks', monthly: 'Once a month' };
  function roleOf(g, pid) { return (g.memberIds || []).indexOf(pid) >= 0 ? ((g.roles || {})[pid] || '') : ''; }
  function hostOf(g) { var ids = (g.memberIds || []).filter(function (id) { return roleOf(g, id) === 'host'; }); return ids[0] || ''; }
  function roleTag(g, pid) { var r = roleOf(g, pid); return r === 'coleader' ? ' <span class="tag">' + T('Co-leader') + '</span>' : r === 'host' ? ' <span class="tag">' + T('Host') + '</span>' : ''; }
  /** "Tuesday · 19:00 · Every week" and where, with a map link – for the group's panel. cards: the members' cards (for a member's view). */
  function meets(g, cards) {
    var w = g.when || {}, v = g.venue || {}, bits = [], where = '';
    if (w.day !== undefined && w.day !== '') bits.push(T(DAYS[+w.day] || ''));
    if (w.time) bits.push(esc(w.time));
    if (w.freq && FREQ[w.freq]) bits.push(T(FREQ[w.freq]));
    if (v.atHost) {
      var hid = hostOf(g), hp = hid && S.get('people', hid), hc = hid && cards && cards[hid];
      var name = hp ? H.name(hp) : hid ? ((g.names || {})[hid] || '') : '', adr = '';
      if (hp && manager() && window.PeopleParts) adr = PeopleParts.addressLines(hp).join(', ');
      else if (hc && hc.address) adr = [hc.address.street, hc.address.street2, [hc.address.city, hc.address.postcode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
      where = name ? esc(T('At {name}’s home', { name: name })) + (adr ? ': ' + esc(adr) + ' ' + H.mapLink(adr) : '') : esc(T('At the host’s home'));
    } else if (v.place || v.address) where = esc(v.place || '') + (v.place && v.address ? ': ' : '') + (v.address ? esc(v.address) + ' ' + H.mapLink(v.address) : '');
    if (!bits.length && !where) return '';
    return '<p class="lg-meets small" style="margin:4px 0 0">' + (bits.length ? H.icon('M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 14) + ' ' + bits.join(' · ') : '') + (bits.length && where ? '<br>' : '') + (where ? H.icon('M12 21s-7-6.3-7-11a7 7 0 0 1 14 0c0 4.7-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z', 14) + ' ' + where : '') + '</p>';
  }
  /** Set when and where the group meets, its co-leaders and host (Administrators, Pastors, the group's leaders). */
  function detailsDialog(gid) {
    var g = S.get('lifeGroups', gid); if (!g || !(manager() || leaderOf(gid))) return;
    var w = g.when || {}, v = g.venue || {}, ms = (g.memberIds || []).slice().sort(function (a, b) { return String((g.names || {})[a] || '').localeCompare(String((g.names || {})[b] || '')); });
    var nm = function (id) { var p = S.get('people', id); return p ? H.name(p) : (g.names || {})[id] || T('Someone'); };
    var others = ms.filter(function (id) { return !Care.isLeader(g, id); });
    H.modal(H.dialogHead(T('When and where'), g.name) + '<div class="dlg-body" id="lgd-body">' +
      '<div class="two"><label class="field">' + T('Day') + '<select id="lgd-day"><option value="">–</option>' + DAYS.map(function (d, i) { return '<option value="' + i + '"' + (String(w.day) === String(i) ? ' selected' : '') + '>' + esc(T(d)) + '</option>'; }).join('') + '</select></label>' +
      '<label class="field">' + T('Time') + '<input id="lgd-time" type="time" value="' + esc(w.time || '') + '"></label></div>' +
      '<label class="field">' + T('How often') + '<select id="lgd-freq"><option value="">–</option>' + Object.keys(FREQ).map(function (k) { return '<option value="' + k + '"' + (w.freq === k ? ' selected' : '') + '>' + esc(T(FREQ[k])) + '</option>'; }).join('') + '</select></label>' +
      '<label class="field">' + T('Host') + '<select id="lgd-host"><option value="">' + T('No host') + '</option>' + ms.map(function (id) { return '<option value="' + esc(id) + '"' + (roleOf(g, id) === 'host' ? ' selected' : '') + '>' + esc(nm(id)) + '</option>'; }).join('') + '</select><small>' + T('Someone in the group who welcomes it, usually in their home.') + '</small></label>' +
      '<fieldset class="field"><legend class="field-l">' + T('Venue') + '</legend><label class="check"><input type="radio" name="lgd-where" value="host"' + (v.atHost ? ' checked' : '') + '><span>' + T('At the host’s home') + '</span></label>' +
        '<label class="check"><input type="radio" name="lgd-where" value="other"' + (!v.atHost ? ' checked' : '') + '><span>' + T('Somewhere else') + '</span></label></fieldset>' +
      '<div id="lgd-other"' + (v.atHost ? ' hidden' : '') + '><label class="field">' + T('Place') + '<input id="lgd-place" maxlength="80" value="' + esc(v.place || '') + '" placeholder="' + esc(T('e.g. Church hall, or a coffee shop')) + '"></label>' +
        '<label class="field">' + T('Address') + '<input id="lgd-addr" maxlength="200" value="' + esc(v.address || '') + '"><small>' + T('A map link is shown next to it, so people can find their way.') + '</small></label></div>' +
      (others.length ? '<fieldset class="field"><legend class="field-l">' + T('Co-leaders') + '</legend>' + others.map(function (id) { return '<label class="check"><input type="checkbox" class="lgd-co" value="' + esc(id) + '"' + (roleOf(g, id) === 'coleader' ? ' checked' : '') + '><span>' + esc(nm(id)) + '</span></label>'; }).join('') + '<small>' + T('They help the leaders. Only leaders can add and remove people.') + '</small></fieldset>' : '') +
      '</div><div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn primary" data-act="life:savedetails" data-id="' + esc(g.id) + '">' + T('Save') + '</button></div>', T('When and where'));
    document.getElementById('lgd-body').addEventListener('change', function (ev) { if (ev.target.name === 'lgd-where') document.getElementById('lgd-other').hidden = ev.target.value !== 'other'; });
  }
  function tools(g, canName, canDelete) {
    return '<span class="cg-tools">' +
      (canName ? '<button class="icon-btn ghost" data-act="life:rename" data-id="' + esc(g.id) + '" aria-label="' + esc(T('Rename {name}', { name: g.name })) + '" title="' + esc(T('Rename')) + '">' + H.icon(PEN, 16) + '</button>' +
        '<button class="icon-btn ghost" data-act="life:details" data-id="' + esc(g.id) + '" aria-label="' + esc(T('When and where') + ': ' + g.name) + '" title="' + esc(T('When and where')) + '">' + H.icon('M12 21s-7-6.3-7-11a7 7 0 0 1 14 0c0 4.7-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z', 16) + '</button>' : '') +
      (window.Msg && (canName || canDelete) ? '<a class="icon-btn ghost" href="#/messages/send/life/' + esc(g.id) + '" aria-label="' + esc(T('Send the group a message')) + '" title="' + esc(T('Send the group a message')) + '">' + H.icon('M4 5h16v11H9l-5 4z', 16) + '</a>' : '') +
      (canDelete ? '<button class="icon-btn ghost" data-act="life:delgroup" data-id="' + esc(g.id) + '" aria-label="' + esc(T('Delete {name}', { name: g.name })) + '" title="' + esc(T('Delete the group')) + '">' + H.icon(H.ICON.trash, 16) + '</button>' : '') + '</span>';
  }

  /* ---------- a member's own life groups (Life groups page and their Me page) ---------- */
  function oneGroup(g, u) {
    var lead = Care.isLeader(g, u.id), cards = {};
    S.list('lifeShare').forEach(function (c) { if (c.groupId === g.id) cards[c.personId] = c; });
    var ids = (g.memberIds || []).slice().sort(function (a, b) {
      var la = Care.isLeader(g, a) ? 0 : 1, lb = Care.isLeader(g, b) ? 0 : 1; if (la !== lb) return la - lb;
      return String((g.names || {})[a] || '').localeCompare(String((g.names || {})[b] || ''));
    });
    var rows = ids.map(function (pid) {
      var c = cards[pid] || { firstName: ((g.names || {})[pid] || '').split(' ')[0], lastName: ((g.names || {})[pid] || '').split(' ').slice(1).join(' ') }, isL = Care.isLeader(g, pid), you = pid === u.id;
      var name = ((c.preferredName || c.firstName || '') + ' ' + (c.lastName || '')).trim() || T('A new member'), bits = [];
      if (c.mobile) bits.push('<a href="tel:' + esc(String(c.mobile).replace(/\s/g, '')) + '">' + esc(c.mobile) + '</a>');
      if (c.email) bits.push('<a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a>');
      if (c.address) { var at = [c.address.street, c.address.street2, [c.address.city, c.address.postcode].filter(Boolean).join(' ')].filter(Boolean).join(', '); bits.push(esc(at) + ' ' + H.mapLink([at, c.address.province, c.address.country].filter(Boolean).join(', '))); }
      if (c.birthday) bits.push(T('Birthday') + ' ' + esc(birthday(c.birthday)));
      return '<div class="item" style="align-items:flex-start">' + pic(c, 44) + '<span class="grow"><b>' + esc(name) + (you ? ' <span class="muted">(' + T('you') + ')</span>' : '') + (isL ? leaderTag() : roleTag(g, pid)) + '</b>' +
        '<small>' + (bits.length ? bits.join(' · ') : (cards[pid] ? T('Details not shared') : T('Details appear when they next sign in'))) + '</small></span>' +
        (lead && !you && !isL ? '<button class="icon-btn ghost" data-act="life:mineout" data-g="' + esc(g.id) + '" data-id="' + esc(pid) + '" aria-label="' + esc(T('Take {name} out of the group', { name: name })) + '" title="' + esc(T('Take {name} out of the group', { name: name })) + '">' + H.icon(H.ICON.x, 16) + '</button>' : '') + '</div>';
    });
    return '<section class="panel my-life" id="life-' + esc(g.id) + '" data-g="' + esc(g.id) + '"><div class="row cg-head"><div class="grow"><h2 style="margin:0" data-own-words>' + esc(g.name) + '</h2>' + meets(g, cards) + '</div>' + tools(g, lead, false) + '</div>' +
      '<p class="hint" style="margin:4px 0 10px">' + T('People in your Midweek Group see your details only if you are in the church directory (under Consent).') + '</p>' +
      folded('my-' + g.id, g, ids, function (pid, i) { return rows[ids.indexOf(pid)]; }, function (pid) { return (g.names || {})[pid] || (cards[pid] ? ((cards[pid].preferredName || cards[pid].firstName || '') + ' ' + (cards[pid].lastName || '')).trim() : ''); },
        lead ? '<div class="btns" style="margin-top:12px"><button class="btn" data-act="life:mineadd" data-g="' + esc(g.id) + '">' + H.icon(H.ICON.plus, 16) + T('Add someone to the group') + '</button></div>' : '') + '</section>';
  }
  function minePanels(u) { return mine(u.id).sort(byName).map(function (g) { return oneGroup(g, u); }).join(''); }
  /** On the Me page: their life groups, if they are in any (and life groups are switched on). */
  function mePanel() {
    var u = me(); if (!u || !on() || S.previewCare()) return '';
    var html = minePanels(u); return html ? '<h2 style="margin:22px 0 10px">' + T('My Midweek Groups') + '</h2><div id="my-life">' + html + '</div>' : '';
  }
  /** The tags on a person: Life group or Group leader, with each group's name – for Administrators and Pastors, and on your own page. */
  function tag(p) {
    var u = me(); if (!on() || !p || !(manager() || (u && u.id === p.id))) return '';
    return mine(p.id).sort(byName).map(function (g) { return ' <a class="tag tag-link" href="#/life">' + T(Care.isLeader(g, p.id) ? 'Group leader' : 'Midweek Group') + ' · ' + esc(g.name) + '</a>'; }).join('');
  }

  /* ---------- the Life groups page ---------- */
  function managerPage() {
    var gs = groups(), inAny = {}, finder = window.CareUI && CareUI.finder;
    gs.forEach(function (g) { (g.memberIds || []).forEach(function (m) { (inAny[m] = inAny[m] || []).push(g.name); }); });
    return '<div class="page-head"><div><h1>' + T('Midweek Groups') + '</h1><p class="lead">' + T('Bible studies, life groups, Connect Groups and other Midweek Groups. A person can be in more than one. Members see each other’s photo, phone, email, address and birthday if they are in the church directory. Group leaders can name their group and add and remove members.') + '</p></div></div>' +
      '<section class="panel"><h2>' + T('Add a Midweek Group') + '</h2><div class="row" style="gap:10px;flex-wrap:wrap"><label class="field req grow" style="margin:0">' + T('Name') + '<input id="lg-new" placeholder="' + esc(T('e.g. Tuesday Bible study')) + '"></label><button class="btn primary" data-act="life:addgroup" style="align-self:end">' + H.icon(H.ICON.plus, 16) + T('Add') + '</button></div></section>' +
      (gs.length ? '<div class="grid2">' + gs.map(function (g) {
        var ms = (g.memberIds || []).map(function (id) { return S.get('people', id) || { id: id, firstName: (g.names || {})[id] || T('Someone'), lastName: '' }; }).sort(function (a, b) {
          var la = Care.isLeader(g, a.id) ? 0 : 1, lb = Care.isLeader(g, b.id) ? 0 : 1; return la - lb || H.name(a).localeCompare(H.name(b)); });
        return '<section class="panel lg-panel" data-g="' + esc(g.id) + '"><div class="row cg-head"><div class="grow"><h2 style="margin:0" data-own-words>' + esc(g.name) + '</h2><span class="muted small">' + TN('{n} person', '{n} people', ms.length) + '</span>' + meets(g) + '</div>' + tools(g, true, true) + '</div>' +
          folded('lg-' + g.id, g, ms.map(function (p) { return p.id; }), function (id) {
            var p = ms.filter(function (x) { return x.id === id; })[0], isL = Care.isLeader(g, p.id);
            return '<div class="item">' + H.avatar(p, 32) + '<span class="grow"><a class="name-chip" href="#/people/p/' + esc(p.id) + '">' + esc(H.name(p)) + '</a>' + (isL ? leaderTag() : roleTag(g, p.id)) + (p.familyRole === 'child' ? ' <span class="tag grey">' + T('Child') + '</span>' : '') + '</span>' +
              '<button class="icon-btn ghost cg-lead' + (isL ? ' on' : '') + '" data-act="life:lead" data-g="' + esc(g.id) + '" data-id="' + esc(p.id) + '" aria-pressed="' + isL + '" aria-label="' + esc(T(isL ? 'Not a leader' : 'Make leader') + ': ' + H.name(p)) + '" title="' + esc(T(isL ? 'Not a leader' : 'Make leader')) + '">' + H.icon(STAR, 16) + '</button>' +
              '<button class="icon-btn ghost" data-act="life:out" data-g="' + esc(g.id) + '" data-id="' + esc(p.id) + '" aria-label="' + esc(T('Take {name} out', { name: H.name(p) })) + '" title="' + esc(T('Take out of the group')) + '">' + H.icon(H.ICON.x, 16) + '</button></div>';
          }, function (id) { var p = ms.filter(function (x) { return x.id === id; })[0]; return H.name(p); },
          finder ? '<div style="margin-top:10px">' + finder('lg-' + g.id, people(g.memberIds || []), 'life:add', { g: g.id }, function (p) { return [p.familyRole === 'child' ? T('Child') : ''].concat(inAny[p.id] ? [T('Also in {groups}', { groups: inAny[p.id].join(', ') })] : []).filter(Boolean).join(' · '); }, T('Add someone: type part of their name')) + '</div>' : '') + '</section>';
      }).join('') + '</div>' : '<p class="empty">' + T('No Midweek Groups yet.') + '</p>');
  }
  function memberPage() {
    var u = me(), html = u ? minePanels(u) : '';
    return '<div class="page-head"><div><h1>' + T('Midweek Groups') + '</h1></div></div>' +
      (html ? '<div id="my-life">' + html + '</div>' : '<p class="empty">' + T('You’re not in a Midweek Group yet. Ask the church office or a group leader to add you.') + '</p>');
  }
  function leaderOf(gid) { var u = me(), g = S.get('lifeGroups', gid); return g && u && Care.isLeader(g, u.id) ? g : null; }

  /** A group's leader adds people to their group: the list stays open for the next person. */
  function mineAddDialog(gid) {
    var u = me(), g = leaderOf(gid); if (!g) return;
    var choices = S.find('people', function (p) { return p.active !== false && p.familyRole !== 'child' && (g.memberIds || []).indexOf(p.id) < 0 && (p.inDirectory || p.id === u.id); })
      .sort(function (a, b) { return H.name(a).localeCompare(H.name(b)); });
    H.modal(H.dialogHead(T('Add someone to the group'), g.name) + '<div class="dlg-body">' + (choices.length && window.CareUI ? '<label class="field" style="margin-bottom:6px">' + T('Who') + '</label>' +
      CareUI.finder('lmine', choices, 'life:mineaddsave', { g: g.id }, null, T('Type part of their name')) + '<p class="hint">' + T('People in the church directory.') + '</p>' : '<p class="muted">' + T('No one else in the church directory to add.') + '</p>') +
      '<p id="lg-err" class="note bad" hidden></p></div><div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Close') + '</button></div>', T('Add someone to the group'));
    var q = document.querySelector('.cg-q[data-for="lmine"]'); if (q) q.focus();
  }
  H.register({
    id: 'life', name: 'Midweek Groups', desc: 'Bible studies, life groups, Connect Groups – their leaders name them', icon: BOOK, tint: '#3E7D5A', optIn: true, inGroups: true,
    render: function () { return manager() ? managerPage() : memberPage(); },
    stat: function () { var u = me(); return manager() ? TN('{n} group', '{n} groups', S.list('lifeGroups').length) : u ? TN('{n} group', '{n} groups', mine(u.id).length) : ''; },
    /** After signing in: keep my own cards in my life groups up to date (leaders may have added me). */
    signedIn: function (u) { if (u && on() && !manager() && mine(u.id).length) sync(u.id); },
    actions: {
      addgroup: function () {
        var n = document.getElementById('lg-new').value.trim(); if (!n) { H.toast(T('Give the group a name'), true); return; }
        if (S.list('lifeGroups').some(function (g) { return String(g.name).toLowerCase() === n.toLowerCase(); })) { H.toast(T('There is already a group with that name'), true); return; }
        S.put('lifeGroups', { name: n, leaderIds: [], memberIds: [], names: {} }, 'Added the midweek group ' + n); H.render(); H.toast(T('Midweek Group added'));
      },
      rename: function (el) {
        var g = S.get('lifeGroups', el.dataset.id); if (!g || !(manager() || leaderOf(g.id))) return;
        H.modal(H.dialogHead(T('Rename {name}', { name: g.name })) + '<div class="dlg-body"><label class="field req">' + T('Name') + '<input id="lg-name" maxlength="80" value="' + esc(g.name) + '"></label></div>' +
          '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn save" data-act="life:saverename" data-id="' + esc(g.id) + '">' + T('Save') + '</button></div>', T('Rename'));
        var i = document.getElementById('lg-name'); if (i) { i.focus(); i.select(); }
      },
      saverename: function (el) {
        var g = S.get('lifeGroups', el.dataset.id), n = document.getElementById('lg-name').value.trim().slice(0, 80); if (!g || !n) return;
        if (!(manager() || leaderOf(g.id))) return;
        if (S.list('lifeGroups').some(function (x) { return x.id !== g.id && String(x.name).toLowerCase() === n.toLowerCase(); })) { H.toast(T('There is already a group with that name'), true); return; }
        var x = JSON.parse(JSON.stringify(g)), was = x.name; x.name = n;
        S.put('lifeGroups', x, 'Renamed the midweek group ' + was + ' to ' + n); H.closeModal(); H.render(); H.toast(T('Saved'));
      },
      delgroup: function (el) {
        var g = S.get('lifeGroups', el.dataset.id); if (!g || !manager() || !H.confirmBtn(el, '✕?')) return;
        (g.memberIds || []).forEach(function (pid) { S.careUnshare(g.id, pid); });
        S.remove('lifeGroups', g.id, 'Deleted the midweek group ' + g.name + ' (' + (g.memberIds || []).length + ' people)'); H.render(); H.toast(T('Midweek Group deleted'));
      },
      add: function (el) {
        var p = S.get('people', el.dataset.id); if (!p) { H.toast(T('Choose someone to add'), true); return; }
        place(p, el.dataset.g, false); openFold('lg-' + el.dataset.g + ':m'); H.render(); H.toast(T('{name} added to the group', { name: H.name(p) }));
      },
      lead: function (el) {   // for this group only
        var p = S.get('people', el.dataset.id), g = S.get('lifeGroups', el.dataset.g); if (!p || !g) return;
        if (!Care.isLeader(g, p.id)) openFold('lg-' + g.id + ':c');
        place(p, g.id, !Care.isLeader(g, p.id)); H.render();
      },
      out: function (el) {
        var p = S.get('people', el.dataset.id) || { id: el.dataset.id, firstName: 'Someone', lastName: '' };
        saveChanges(p, Care.takeOut(S.list('lifeGroups'), p.id, el.dataset.g)); H.render(); H.toast(T('Taken out of the group'));
      },
      details: function (el) { detailsDialog(el.dataset.id); },
      savedetails: function (el) {
        var g = S.get('lifeGroups', el.dataset.id); if (!g || !(manager() || leaderOf(g.id))) return;
        var val = function (id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }, x = JSON.parse(JSON.stringify(g));
        var day = val('lgd-day'), time = val('lgd-time'), freq = val('lgd-freq'), host = val('lgd-host'), atHost = (document.querySelector('input[name="lgd-where"]:checked') || {}).value === 'host';
        if (atHost && !host) { H.toast(T('Choose the host first, or choose Somewhere else.'), true); return; }
        if (day !== '' || time || freq) x.when = { day: day === '' ? '' : +day, time: time, freq: freq }; else delete x.when;
        var place = val('lgd-place').slice(0, 80), addr = val('lgd-addr').slice(0, 200);
        if (atHost) x.venue = { atHost: true }; else if (place || addr) x.venue = { place: place, address: addr }; else delete x.venue;
        var roles = {};
        Array.prototype.forEach.call(document.querySelectorAll('.lgd-co:checked'), function (c) { roles[c.value] = 'coleader'; });
        if (host) roles[host] = 'host';
        if (Object.keys(roles).length) x.roles = roles; else delete x.roles;
        S.put('lifeGroups', x, 'Changed when and where the midweek group ' + g.name + ' meets'); H.closeModal(); H.render(); H.toast(T('Saved'));
      },
      /* a group's leader */
      mineadd: function (el) { mineAddDialog(el.dataset.g); },
      mineaddsave: function (el) {
        var g = leaderOf(el.dataset.g), p = S.get('people', el.dataset.id); if (!g) return;
        if (!p) { var e = document.getElementById('lg-err'); e.textContent = T('Choose someone to add.'); e.hidden = false; return; }
        var x = JSON.parse(JSON.stringify(g)); x.memberIds.push(p.id); x.names = x.names || {}; x.names[p.id] = Care.nameOf(p);
        S.put('lifeGroups', x, 'Group leader added ' + H.name(p) + ' to the midweek group ' + g.name); openFold('my-' + g.id + ':m'); H.render(); H.toast(T('{name} added to the group', { name: H.name(p) }));
        mineAddDialog(g.id);   // the same list stays open, for the next person
      },
      mineout: function (el) {
        var g = leaderOf(el.dataset.g), pid = el.dataset.id; if (!g || Care.isLeader(g, pid) || !H.confirmBtn(el, '✕?')) return;
        var x = JSON.parse(JSON.stringify(g)), name = (x.names || {})[pid] || '';
        x.memberIds = x.memberIds.filter(function (m) { return m !== pid; }); if (x.names) delete x.names[pid];
        S.put('lifeGroups', x, 'Group leader took ' + name + ' out of the midweek group ' + g.name);
        S.careUnshare(g.id, pid);
        H.render(); H.toast(T('Taken out of the group'));
      }
    }
  });
  /** leaveAll: after a death, out of every life group. */
  window.LifeUI = { setGroups: function (p, want, why) { return saveChanges(p, Care.setGroups(S.list('lifeGroups'), p, want || {}), why); }, mePanel: mePanel, tag: tag, sync: sync, leaveAll: function (p, why) { return saveChanges(p, Care.setGroups(S.list('lifeGroups'), p, {}), why); } };
})();
