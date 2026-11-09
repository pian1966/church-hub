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
      S.audit((why || '') + (isIn ? (Care.isLeader(g, p.id) ? 'Leader of life group ' : 'In life group ') + g.name : 'Taken out of life group ' + g.name) + ': ' + H.name(p), 'people/' + p.id);
    });
    sync(p.id);
    return true;
  }
  function place(p, gid, leader, why) { return saveChanges(p, Care.place(S.list('lifeGroups'), p, gid, leader), why); }
  function adults(exclude) { return S.find('people', function (p) { return p.active !== false && p.familyRole !== 'child' && p.firstName !== 'Deleted' && !p.mergedInto && !p.binnedAt && p.category !== 'Deceased' && exclude.indexOf(p.id) < 0; }).sort(function (a, b) { return H.name(a).localeCompare(H.name(b)); }); }
  function pic(c, size) {
    var n = ((c.preferredName || c.firstName || '?').charAt(0) + (c.lastName || '').charAt(0)).toUpperCase();
    return '<span class="av' + (c.photo ? ' pic' : '') + '" style="--s:' + (size || 40) + 'px' + (c.photo ? ';background-image:url(' + c.photo + ')' : '') + '" aria-hidden="true">' + esc(n) + '</span>';
  }
  function birthday(mmdd) { if (!mmdd) return ''; var m = +mmdd.slice(0, 2), d = +mmdd.slice(3, 5); return d + ' ' + I18n.mon()[m - 1]; }
  function leaderTag() { return ' <span class="tag ok">' + T('Group leader') + '</span>'; }
  function tools(g, canName, canDelete) {
    return '<span class="cg-tools">' +
      (canName ? '<button class="icon-btn ghost" data-act="life:rename" data-id="' + esc(g.id) + '" aria-label="' + esc(T('Rename {name}', { name: g.name })) + '" title="' + esc(T('Rename')) + '">' + H.icon(PEN, 16) + '</button>' : '') +
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
      return '<div class="item" style="align-items:flex-start">' + pic(c, 44) + '<span class="grow"><b>' + esc(name) + (you ? ' <span class="muted">(' + T('you') + ')</span>' : '') + (isL ? leaderTag() : '') + '</b>' +
        '<small>' + (bits.length ? bits.join(' · ') : (cards[pid] ? T('Details not shared') : T('Details appear when they next sign in'))) + '</small></span>' +
        (lead && !you && !isL ? '<button class="icon-btn ghost" data-act="life:mineout" data-g="' + esc(g.id) + '" data-id="' + esc(pid) + '" aria-label="' + esc(T('Take {name} out of the group', { name: name })) + '" title="' + esc(T('Take {name} out of the group', { name: name })) + '">' + H.icon(H.ICON.x, 16) + '</button>' : '') + '</div>';
    });
    return '<section class="panel my-life" data-g="' + esc(g.id) + '"><div class="row cg-head"><h2 class="grow" style="margin:0" data-own-words>' + esc(g.name) + '</h2>' + tools(g, lead, false) + '</div>' +
      '<p class="hint" style="margin:4px 0 10px">' + T('People in your life group see your details only if you are in the church directory (under Consent).') + '</p>' +
      '<div class="list">' + rows.join('') + '</div>' +
      (lead ? '<div class="btns" style="margin-top:12px"><button class="btn" data-act="life:mineadd" data-g="' + esc(g.id) + '">' + H.icon(H.ICON.plus, 16) + T('Add someone to the group') + '</button></div>' : '') + '</section>';
  }
  function minePanels(u) { return mine(u.id).sort(byName).map(function (g) { return oneGroup(g, u); }).join(''); }
  /** On the Me page: their life groups, if they are in any (and life groups are switched on). */
  function mePanel() {
    var u = me(); if (!u || !on() || S.previewCare()) return '';
    var html = minePanels(u); return html ? '<h2 style="margin:22px 0 10px">' + T('My life groups') + '</h2><div id="my-life">' + html + '</div>' : '';
  }
  /** The tags on a person: Life group or Group leader, with each group's name – for Administrators and Pastors, and on your own page. */
  function tag(p) {
    var u = me(); if (!on() || !p || !(manager() || (u && u.id === p.id))) return '';
    return mine(p.id).sort(byName).map(function (g) { return ' <span class="tag">' + T(Care.isLeader(g, p.id) ? 'Group leader' : 'Life group') + ' · ' + esc(g.name) + '</span>'; }).join('');
  }

  /* ---------- the Life groups page ---------- */
  function managerPage() {
    var gs = groups(), inAny = {}, finder = window.CareUI && CareUI.finder;
    gs.forEach(function (g) { (g.memberIds || []).forEach(function (m) { (inAny[m] = inAny[m] || []).push(g.name); }); });
    return '<div class="page-head"><div><h1>' + T('Life groups') + '</h1><p class="lead">' + T('Bible studies, life groups and midweek meetings. A person can be in more than one. Members see each other’s photo, phone, email, address and birthday if they are in the church directory. Group leaders can name their group and add and remove members.') + '</p></div></div>' +
      '<section class="panel"><h2>' + T('Add a life group') + '</h2><div class="row" style="gap:10px;flex-wrap:wrap"><label class="field req grow" style="margin:0">' + T('Name') + '<input id="lg-new" placeholder="' + esc(T('e.g. Tuesday Bible study')) + '"></label><button class="btn primary" data-act="life:addgroup" style="align-self:end">' + H.icon(H.ICON.plus, 16) + T('Add') + '</button></div></section>' +
      (gs.length ? '<div class="grid2">' + gs.map(function (g) {
        var ms = (g.memberIds || []).map(function (id) { return S.get('people', id) || { id: id, firstName: (g.names || {})[id] || T('Someone'), lastName: '' }; }).sort(function (a, b) {
          var la = Care.isLeader(g, a.id) ? 0 : 1, lb = Care.isLeader(g, b.id) ? 0 : 1; return la - lb || H.name(a).localeCompare(H.name(b)); });
        return '<section class="panel lg-panel" data-g="' + esc(g.id) + '"><div class="row cg-head"><div class="grow"><h2 style="margin:0" data-own-words>' + esc(g.name) + '</h2><span class="muted small">' + TN('{n} person', '{n} people', ms.length) + '</span></div>' + tools(g, true, true) + '</div>' +
          (ms.length ? '<div class="list" style="margin-top:8px">' + ms.map(function (p) {
            var isL = Care.isLeader(g, p.id);
            return '<div class="item">' + H.avatar(p, 32) + '<span class="grow"><a class="name-chip" href="#/people/p/' + esc(p.id) + '">' + esc(H.name(p)) + '</a>' + (isL ? leaderTag() : '') + '</span>' +
              '<button class="icon-btn ghost cg-lead' + (isL ? ' on' : '') + '" data-act="life:lead" data-g="' + esc(g.id) + '" data-id="' + esc(p.id) + '" aria-pressed="' + isL + '" aria-label="' + esc(T(isL ? 'Not a leader' : 'Make leader') + ': ' + H.name(p)) + '" title="' + esc(T(isL ? 'Not a leader' : 'Make leader')) + '">' + H.icon(STAR, 16) + '</button>' +
              '<button class="icon-btn ghost" data-act="life:out" data-g="' + esc(g.id) + '" data-id="' + esc(p.id) + '" aria-label="' + esc(T('Take {name} out', { name: H.name(p) })) + '" title="' + esc(T('Take out of the group')) + '">' + H.icon(H.ICON.x, 16) + '</button></div>';
          }).join('') + '</div>' : '<p class="muted small" style="margin:8px 0 0">' + T('No one yet.') + '</p>') +
          (finder ? '<div style="margin-top:10px">' + finder('lg-' + g.id, adults(g.memberIds || []), 'life:add', { g: g.id }, function (p) { return inAny[p.id] ? T('Also in {groups}', { groups: inAny[p.id].join(', ') }) : ''; }, T('Add someone: type part of their name')) + '</div>' : '') + '</section>';
      }).join('') + '</div>' : '<p class="empty">' + T('No life groups yet.') + '</p>');
  }
  function memberPage() {
    var u = me(), html = u ? minePanels(u) : '';
    return '<div class="page-head"><div><h1>' + T('Life groups') + '</h1></div></div>' +
      (html ? '<div id="my-life">' + html + '</div>' : '<p class="empty">' + T('You’re not in a life group yet. Ask the church office or a group leader to add you.') + '</p>');
  }
  function leaderOf(gid) { var u = me(), g = S.get('lifeGroups', gid); return g && u && Care.isLeader(g, u.id) ? g : null; }

  H.register({
    id: 'life', name: 'Life groups', desc: 'Bible studies, life groups and midweek groups – their leaders name them', icon: BOOK, tint: '#3E7D5A', optIn: true,
    render: function () { return manager() ? managerPage() : memberPage(); },
    stat: function () { var u = me(); return manager() ? TN('{n} group', '{n} groups', S.list('lifeGroups').length) : u ? TN('{n} group', '{n} groups', mine(u.id).length) : ''; },
    /** After signing in: keep my own cards in my life groups up to date (leaders may have added me). */
    signedIn: function (u) { if (u && on() && !manager() && mine(u.id).length) sync(u.id); },
    actions: {
      addgroup: function () {
        var n = document.getElementById('lg-new').value.trim(); if (!n) { H.toast(T('Give the group a name'), true); return; }
        if (S.list('lifeGroups').some(function (g) { return String(g.name).toLowerCase() === n.toLowerCase(); })) { H.toast(T('There is already a group with that name'), true); return; }
        S.put('lifeGroups', { name: n, leaderIds: [], memberIds: [], names: {} }, 'Added the life group ' + n); H.render(); H.toast(T('Life group added'));
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
        S.put('lifeGroups', x, 'Renamed the life group ' + was + ' to ' + n); H.closeModal(); H.render(); H.toast(T('Saved'));
      },
      delgroup: function (el) {
        var g = S.get('lifeGroups', el.dataset.id); if (!g || !manager() || !H.confirmBtn(el, '✕?')) return;
        (g.memberIds || []).forEach(function (pid) { S.careUnshare(g.id, pid); });
        S.remove('lifeGroups', g.id, 'Deleted the life group ' + g.name + ' (' + (g.memberIds || []).length + ' people)'); H.render(); H.toast(T('Life group deleted'));
      },
      add: function (el) {
        var p = S.get('people', el.dataset.id); if (!p) { H.toast(T('Choose someone to add'), true); return; }
        place(p, el.dataset.g, false); H.render(); H.toast(T('{name} added to the group', { name: H.name(p) }));
        var again = document.querySelector('.cg-q[data-for="lg-' + el.dataset.g + '"]'); if (again) again.focus();
      },
      lead: function (el) {   // for this group only
        var p = S.get('people', el.dataset.id), g = S.get('lifeGroups', el.dataset.g); if (!p || !g) return;
        place(p, g.id, !Care.isLeader(g, p.id)); H.render();
      },
      out: function (el) {
        var p = S.get('people', el.dataset.id) || { id: el.dataset.id, firstName: 'Someone', lastName: '' };
        saveChanges(p, Care.takeOut(S.list('lifeGroups'), p.id, el.dataset.g)); H.render(); H.toast(T('Taken out of the group'));
      },
      /* a group's leader */
      mineadd: function (el) {
        var u = me(), g = leaderOf(el.dataset.g); if (!g) return;
        var choices = S.find('people', function (p) { return p.active !== false && p.familyRole !== 'child' && (g.memberIds || []).indexOf(p.id) < 0 && (p.inDirectory || p.id === u.id); })
          .sort(function (a, b) { return H.name(a).localeCompare(H.name(b)); });
        H.modal(H.dialogHead(T('Add someone to the group'), g.name) + '<div class="dlg-body">' + (choices.length && window.CareUI ? '<label class="field" style="margin-bottom:6px">' + T('Who') + '</label>' +
          CareUI.finder('lmine', choices, 'life:mineaddsave', { g: g.id }, null, T('Type part of their name')) + '<p class="hint">' + T('People in the church directory.') + '</p>' : '<p class="muted">' + T('No one else in the church directory to add.') + '</p>') +
          '<p id="lg-err" class="note bad" hidden></p></div><div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button></div>', T('Add someone to the group'));
        var q = document.querySelector('.cg-q[data-for="lmine"]'); if (q) q.focus();
      },
      mineaddsave: function (el) {
        var g = leaderOf(el.dataset.g), p = S.get('people', el.dataset.id); if (!g) return;
        if (!p) { var e = document.getElementById('lg-err'); e.textContent = T('Choose someone to add.'); e.hidden = false; return; }
        var x = JSON.parse(JSON.stringify(g)); x.memberIds.push(p.id); x.names = x.names || {}; x.names[p.id] = Care.nameOf(p);
        S.put('lifeGroups', x, 'Group leader added ' + H.name(p) + ' to the life group ' + g.name); H.closeModal(); H.render(); H.toast(T('Added to the group'));
      },
      mineout: function (el) {
        var g = leaderOf(el.dataset.g), pid = el.dataset.id; if (!g || Care.isLeader(g, pid) || !H.confirmBtn(el, '✕?')) return;
        var x = JSON.parse(JSON.stringify(g)), name = (x.names || {})[pid] || '';
        x.memberIds = x.memberIds.filter(function (m) { return m !== pid; }); if (x.names) delete x.names[pid];
        S.put('lifeGroups', x, 'Group leader took ' + name + ' out of the life group ' + g.name);
        S.careUnshare(g.id, pid);
        H.render(); H.toast(T('Taken out of the group'));
      }
    }
  });
  /** leaveAll: after a death, out of every life group. */
  window.LifeUI = { mePanel: mePanel, tag: tag, sync: sync, leaveAll: function (p, why) { return saveChanges(p, Care.setGroups(S.list('lifeGroups'), p, {}), why); } };
})();
