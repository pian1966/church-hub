/* Church Hub – Care groups: Administrators and Pastors set them up (Care groups page, or a person's Edit details); carers
 * may add and remove members of their own group; every member sees their group on their Me page. Rules: js/care.js. */
(function () {
  'use strict';
  var H = Hub, esc = H.esc, S = Store, T = I18n.t, TN = I18n.tn;
  var HEART = 'M12 20s-7-4.4-9.3-8.6A4.8 4.8 0 0 1 12 6.3a4.8 4.8 0 0 1 9.3 5.1C19 15.6 12 20 12 20z';

  function manager() { return H.can('*') || H.can('people.edit'); }   // Administrators and Pastors
  function me() { return H.user(); }
  function groups() { return S.list('careGroups').slice().sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); }); }
  function consented(pid) {
    var c = S.find('consents', function (x) { return x.personId === pid && x.purpose === Care.CONSENT && !x.withdrawnAt; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; })[0];
    return !!(c && c.given);
  }
  /** A small photo (96 × 96) for the card the group sees. */
  function thumb(dataUrl) {
    return new Promise(function (ok) {
      if (!dataUrl || typeof document === 'undefined') return ok('');
      var img = new Image();
      img.onload = function () { var cv = document.createElement('canvas'); cv.width = cv.height = 96; cv.getContext('2d').drawImage(img, 0, 0, 96, 96); try { ok(cv.toDataURL('image/jpeg', 0.7)); } catch (e) { ok(''); } };
      img.onerror = function () { ok(''); }; img.src = dataUrl;
    });
  }
  function sameCard(a, b) { return Care.FIELDS.every(function (k) { return k === 'updatedAt' || k === 'createdAt' || JSON.stringify(a[k] === undefined ? null : a[k]) === JSON.stringify(b[k] === undefined ? null : b[k]); }); }
  /** Bring a person's cards up to date – one in each care group they are in (by an Administrator or Pastor, or the person themself). */
  function sync(pid) {
    var u = me(), p = S.get('people', pid); if (!p || !u || !(manager() || u.id === pid) || S.preview()) return Promise.resolve();
    var gs = Care.groupsOf(S.list('careGroups'), pid), ids = gs.map(function (g) { return g.id; });
    S.find('careShare', function (c) { return c.personId === pid && ids.indexOf(c.groupId) < 0; }).forEach(function (c) { S.careUnshare(c.groupId, pid); });   // groups they have left
    if (!gs.length) return Promise.resolve();
    var ok = consented(pid);
    return (ok && p.photo ? S.photo(pid).then(thumb, function () { return ''; }) : Promise.resolve('')).then(function (ph) {
      gs.forEach(function (g) {
        var card = Object.assign({ id: g.id + ':' + pid, personId: pid, groupId: g.id }, Care.card(p, ok, Care.isLeader(g, pid), ph)), old = S.get('careShare', card.id);
        if (!old || !sameCard(old, card)) S.put('careShare', card);
      });
    });
  }
  /** Save changed groups, take away the cards in groups they left, write a line in the audit log. */
  function saveChanges(p, changes, why) {
    if (!changes.length) return false;
    changes.forEach(function (g) {
      var was = S.get('careGroups', g.id) || {}, wasIn = (was.memberIds || []).indexOf(p.id) >= 0, isIn = g.memberIds.indexOf(p.id) >= 0;
      S.put('careGroups', g);
      if (wasIn && !isIn) S.careUnshare(g.id, p.id);
      S.audit((why || '') + (isIn ? (Care.isLeader(g, p.id) ? 'Carer of ' : 'In care group ') + g.name : 'Taken out of care group ' + g.name) + ': ' + H.name(p), 'people/' + p.id);
    });
    sync(p.id);
    return true;
  }
  /** Put someone in a group (their other groups stay), as a carer or not; gid '' = out of every group. */
  function place(p, gid, leader, why) { return saveChanges(p, Care.place(S.list('careGroups'), p, gid, leader), why); }
  /** Set all of someone's groups at once (Edit details): want = { groupId: carer? }. */
  function setFrom(p, v) { return v && !v.error ? saveChanges(p, Care.setGroups(S.list('careGroups'), p, v.want)) : false; }
  function pic(c, size) {
    var n = ((c.preferredName || c.firstName || '?').charAt(0) + (c.lastName || '').charAt(0)).toUpperCase();
    return '<span class="av' + (c.photo ? ' pic' : '') + '" style="--s:' + (size || 40) + 'px' + (c.photo ? ';background-image:url(' + c.photo + ')' : '') + '" aria-hidden="true">' + esc(n) + '</span>';
  }
  function birthday(mmdd) { if (!mmdd) return ''; var m = +mmdd.slice(0, 2), d = +mmdd.slice(3, 5); return d + ' ' + I18n.mon()[m - 1]; }

  /* ---------- a member's own care group (on their Me page) ---------- */
  function mePanel() {
    var u = me(); if (!u) return '';
    var pc = S.previewCare(), gs = pc ? [S.get('careGroups', pc)].filter(Boolean) : Care.groupsOf(S.list('careGroups'), u.id); if (!gs.length) return '';
    return '<div id="my-care">' + gs.map(function (g) { return oneGroup(g, u, !!pc); }).join('') + '</div>';
  }
  function oneGroup(g, u, asCarer) {
    var lead = asCarer || Care.isLeader(g, u.id), cards = {};   // "View as" a carer: an Administrator sees the group as its carer does
    S.list('careShare').forEach(function (c) { if (c.groupId === g.id) cards[c.personId] = c; });
    var ids = (g.memberIds || []).slice().sort(function (a, b) {
      var la = Care.isLeader(g, a) ? 0 : 1, lb = Care.isLeader(g, b) ? 0 : 1; if (la !== lb) return la - lb;
      return String((g.names || {})[a] || '').localeCompare(String((g.names || {})[b] || ''));
    });
    return '<section class="panel my-care" data-g="' + esc(g.id) + '"><div class="row"><h2 class="grow" style="margin:0">' + T('My care group') + ': ' + esc(g.name) + '</h2>' + H.icon(HEART, 18) + '</div>' +
      '<p class="hint" style="margin:4px 0 10px">' + T('People in your care group see your details only if you agreed (under Consent).') + '</p><div class="list">' +
      ids.map(function (pid) {
        var c = cards[pid] || { firstName: ((g.names || {})[pid] || '').split(' ')[0], lastName: ((g.names || {})[pid] || '').split(' ').slice(1).join(' ') }, isL = Care.isLeader(g, pid), you = pid === u.id;
        var name = ((c.preferredName || c.firstName || '') + ' ' + (c.lastName || '')).trim() || T('A new member');
        var bits = [];
        if (c.mobile) bits.push('<a href="tel:' + esc(String(c.mobile).replace(/\s/g, '')) + '">' + esc(c.mobile) + '</a>');
        if (c.email) bits.push('<a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a>');
        if (c.address) bits.push(esc([c.address.street, c.address.street2, [c.address.city, c.address.postcode].filter(Boolean).join(' ')].filter(Boolean).join(', ')));
        if (c.birthday) bits.push(T('Birthday') + ' ' + esc(birthday(c.birthday)));
        return '<div class="item" style="align-items:flex-start">' + pic(c, 44) + '<span class="grow"><b>' + esc(name) + (you ? ' <span class="muted">(' + T('you') + ')</span>' : '') + (isL ? ' <span class="tag ok">' + T('Carer') + '</span>' : '') + '</b>' +
          '<small>' + (bits.length ? bits.join(' · ') : (cards[pid] ? T('Details not shared') : T('Details appear when they next sign in'))) + '</small></span>' +
          (lead && !you && !isL ? '<button class="icon-btn ghost" data-act="care:mineout" data-g="' + esc(g.id) + '" data-id="' + esc(pid) + '" aria-label="' + esc(T('Take {name} out of the group', { name: name })) + '" title="' + esc(T('Take {name} out of the group', { name: name })) + '">' + H.icon(H.ICON.x, 16) + '</button>' : '') + '</div>';
      }).join('') + '</div>' +
      (lead ? '<div class="btns" style="margin-top:12px"><button class="btn" data-act="care:mineadd" data-g="' + esc(g.id) + '">' + H.icon(H.ICON.plus, 16) + T('Add someone to the group') + '</button></div>' : '') + '</section>';
  }

  /* ---------- Edit details (Administrators and Pastors) ---------- */
  function fields(p) {
    if (!manager() || !p || p.familyRole === 'child') return '';
    var gs = groups(), mine = p.id ? Care.groupsOf(gs, p.id) : [], on = mine.length > 0, inIt = {};
    mine.forEach(function (g) { inIt[g.id] = Care.isLeader(g, p.id); });
    return '<fieldset class="panel" style="padding:12px 14px;margin:6px 0 14px"><label class="check" style="margin:0"><input type="checkbox" id="pf-care"' + (on ? ' checked' : '') + '><span><b>Care group member</b><br><span class="muted small">In one or more of the church’s care groups (tick which).</span></span></label>' +
      '<div id="pf-care-f"' + (on ? '' : ' hidden') + ' style="margin-top:10px">' + (gs.length ? '<div class="field req" style="margin:0"><span>Which care groups</span><div class="list" id="pf-care-gs">' + gs.map(function (x) {
        var has = Object.prototype.hasOwnProperty.call(inIt, x.id);
        return '<div class="item" style="gap:12px;flex-wrap:wrap"><label class="check grow" style="margin:0"><input type="checkbox" class="pf-cg" value="' + esc(x.id) + '"' + (has ? ' checked' : '') + '><span>' + esc(x.name) + '</span></label>' +
          '<label class="check" style="margin:0"><input type="checkbox" class="pf-cgl" data-g="' + esc(x.id) + '"' + (inIt[x.id] ? ' checked' : '') + (has ? '' : ' disabled') + '><span class="small">Carer (leads it)</span></label></div>';
      }).join('') + '</div></div>' : '<p class="hint">There are no care groups yet – add them on the <a href="#/care">Care groups</a> page first.</p>') + '</div></fieldset>';
  }
  function wireFields() {
    var b = document.getElementById('pf-care'), f = document.getElementById('pf-care-f');
    if (b && f) b.addEventListener('change', function () { f.hidden = !b.checked; });
    Array.prototype.forEach.call(document.querySelectorAll('.pf-cg'), function (c) {
      c.addEventListener('change', function () { var l = document.querySelector('.pf-cgl[data-g="' + c.value + '"]'); if (l) { l.disabled = !c.checked; if (!c.checked) l.checked = false; } });
    });
  }
  /** What the form says: { on, want: { groupId: carer? } }, or { error } when no group is ticked. */
  function read() {
    var b = document.getElementById('pf-care'); if (!b) return null;
    var want = {};
    if (b.checked) Array.prototype.forEach.call(document.querySelectorAll('.pf-cg:checked'), function (c) { var l = document.querySelector('.pf-cgl[data-g="' + c.value + '"]'); want[c.value] = !!(l && l.checked); });
    if (b.checked && !Object.keys(want).length) return { error: 'Tick which care group(s) they are in (or untick Care group member).' };
    return { on: b.checked, want: want };
  }
  function apply(p, v) { return setFrom(p, v); }
  /** The tags on a person: Care group member or Carer, with each group's name. */
  function tag(p) {
    if (!manager()) return '';
    return Care.groupsOf(S.list('careGroups'), p.id).map(function (g) { return ' <span class="tag">' + (Care.isLeader(g, p.id) ? 'Carer' : 'Care group member') + ' · ' + esc(g.name) + '</span>'; }).join('');
  }

  /* ---------- finding someone to add: type part of a name ("dar ben" finds Darren Bennett) ---------- */
  var finders = {};
  function finder(key, people, act, data, note, placeholder) {
    finders[key] = { people: people, act: act, data: data || {}, note: note || function () { return ''; } };
    return '<div class="cg-find"><input class="cg-q" data-for="' + esc(key) + '" placeholder="' + esc(placeholder) + '" autocomplete="off" aria-label="' + esc(placeholder) + '">' +
      '<div class="cg-hits list" data-for="' + esc(key) + '" aria-live="polite"></div></div>';
  }
  function showHits(inp) {
    var f = finders[inp.dataset.for], box = document.querySelector('.cg-hits[data-for="' + inp.dataset.for + '"]'); if (!f || !box) return;
    var q = inp.value.trim(); if (!q) { box.innerHTML = ''; return; }
    var hits = f.people.filter(function (p) { return H.matches(H.name(p) + ' ' + (p.firstName || '') + ' ' + (p.preferredName || '') + ' ' + (p.lastName || ''), q); });
    var attrs = Object.keys(f.data).map(function (k) { return ' data-' + k + '="' + esc(f.data[k]) + '"'; }).join('');
    box.innerHTML = hits.length ? hits.slice(0, 8).map(function (p) {
      return '<button type="button" class="item cg-pick" data-act="' + f.act + '" data-id="' + esc(p.id) + '"' + attrs + '>' + H.avatar(p, 28) + '<span class="grow"><b>' + esc(H.name(p)) + '</b>' + (f.note(p) ? '<small>' + esc(f.note(p)) + '</small>' : '') + '</span>' + H.icon(H.ICON.plus, 16) + '</button>';
    }).join('') + (hits.length > 8 ? '<p class="hint" style="margin:4px 0 0">' + T('{n} more – type more of the name', { n: hits.length - 8 }) + '</p>' : '') : '<p class="muted small" style="margin:6px 0 0">' + T('No one matches') + '</p>';
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('input', function (ev) { if (ev.target.classList && ev.target.classList.contains('cg-q')) showHits(ev.target); });
    document.addEventListener('keydown', function (ev) {   // Enter adds the first match
      if (ev.key !== 'Enter' || !ev.target.classList || !ev.target.classList.contains('cg-q')) return;
      ev.preventDefault(); var b = document.querySelector('.cg-hits[data-for="' + ev.target.dataset.for + '"] .cg-pick'); if (b) b.click();
    });
  }

  /* ---------- the Care groups page (Administrators and Pastors) ---------- */
  function adults(exclude) { return S.find('people', function (p) { return p.active !== false && p.familyRole !== 'child' && p.firstName !== 'Deleted' && !p.mergedInto && exclude.indexOf(p.id) < 0; }).sort(function (a, b) { return H.name(a).localeCompare(H.name(b)); }); }
  function render() {
    if (!manager()) return '<p class="empty">Only Administrators and Pastors can set up care groups.</p>';
    var gs = groups(), inAny = {};
    gs.forEach(function (g) { (g.memberIds || []).forEach(function (m) { (inAny[m] = inAny[m] || []).push(g.name); }); });
    return '<div class="page-head"><div><h1>Care groups</h1><p class="lead">Small groups that care for one another. A person can be in more than one group. Members see each other’s photo, phone, email, address and birthday – only if they agreed (consent “Care group”). Carers can add and remove members of their own group.</p></div></div>' +
      '<section class="panel"><h2>Add a care group</h2><div class="row" style="gap:10px;flex-wrap:wrap"><label class="field req grow" style="margin:0">Name<input id="cg-new" placeholder="e.g. Hilton Tuesday evening"></label><button class="btn primary" data-act="care:addgroup" style="align-self:end">' + H.icon(H.ICON.plus, 16) + 'Add</button></div></section>' +
      (gs.length ? '<div class="grid2">' + gs.map(function (g) {
        var ms = (g.memberIds || []).map(function (id) { return S.get('people', id) || { id: id, firstName: (g.names || {})[id] || 'Someone', lastName: '' }; }).sort(function (a, b) {
          var la = Care.isLeader(g, a.id) ? 0 : 1, lb = Care.isLeader(g, b.id) ? 0 : 1; return la - lb || H.name(a).localeCompare(H.name(b)); });
        return '<section class="panel"><div class="row"><h2 class="grow" style="margin:0">' + esc(g.name) + '</h2><span class="muted small">' + TN('{n} person', '{n} people', ms.length) + '</span>' +
          '<button class="icon-btn ghost" data-act="care:rename" data-id="' + g.id + '" aria-label="Rename ' + esc(g.name) + '" title="Rename">' + H.icon('M4 20h4L20 8l-4-4L4 16zM14 6l4 4', 16) + '</button>' +
          '<button class="icon-btn ghost" data-act="care:delgroup" data-id="' + g.id + '" aria-label="Delete ' + esc(g.name) + '" title="Delete the group">' + H.icon(H.ICON.trash, 16) + '</button></div>' +
          (ms.length ? '<div class="list" style="margin-top:8px">' + ms.map(function (p) {
            var isL = Care.isLeader(g, p.id);
            return '<div class="item">' + H.avatar(p, 32) + '<span class="grow"><a href="#/people/p/' + p.id + '">' + esc(H.name(p)) + '</a>' + (isL ? ' <span class="tag ok">Carer</span>' : '') + (consented(p.id) ? '' : ' <small class="muted">details not shared (no consent yet)</small>') + '</span>' +
              '<button class="btn small" data-act="care:lead" data-g="' + g.id + '" data-id="' + p.id + '">' + (isL ? 'Not a carer' : 'Make carer') + '</button>' +
              '<button class="icon-btn ghost" data-act="care:out" data-g="' + g.id + '" data-id="' + p.id + '" aria-label="Take ' + esc(H.name(p)) + ' out" title="Take out of the group">' + H.icon(H.ICON.x, 16) + '</button></div>';
          }).join('') + '</div>' : '<p class="muted">No one yet.</p>') +
          '<div style="margin-top:10px">' + finder('g-' + g.id, adults(g.memberIds || []), 'care:add', { g: g.id }, function (p) { return inAny[p.id] ? 'Also in ' + inAny[p.id].join(', ') : ''; }, 'Add someone: type part of their name') + '</div></section>';
      }).join('') + '</div>' : '<p class="empty">No care groups yet.</p>') +
      (gs.length ? '<p class="hint">Members’ cards update when their details or consent change. <button class="link" data-act="care:syncall">Update everyone’s cards now</button></p>' : '');
  }

  H.register({
    id: 'care', name: 'Care groups', desc: 'Small groups that care for one another', icon: HEART, tint: '#B4436C', roles: ['admin', 'pastor'],
    render: function () { return render(); },
    stat: function () { return manager() ? S.list('careGroups').length + ' groups' : ''; },
    /** After signing in: keep my own card in my care group up to date (carers may have added me). */
    signedIn: function (u) { if (u && !manager() && Care.groupsOf(S.list('careGroups'), u.id).length) sync(u.id); },
    actions: {
      addgroup: function () {
        var n = document.getElementById('cg-new').value.trim(); if (!n) { H.toast('Give the group a name', true); return; }
        if (S.list('careGroups').some(function (g) { return String(g.name).toLowerCase() === n.toLowerCase(); })) { H.toast('There is already a group with that name', true); return; }
        S.put('careGroups', { name: n, leaderIds: [], memberIds: [], names: {} }, 'Added the care group ' + n); H.render(); H.toast('Care group added');
      },
      rename: function (el) {
        var g = S.get('careGroups', el.dataset.id); if (!g) return;
        H.modal(H.dialogHead('Rename ' + g.name) + '<div class="dlg-body"><label class="field req">Name<input id="cg-name" value="' + esc(g.name) + '"></label></div><div class="dlg-foot"><button class="btn" data-act="hub:close">Cancel</button><button class="btn primary" data-act="care:saverename" data-id="' + g.id + '">Save</button></div>', 'Rename');
      },
      saverename: function (el) {
        var g = JSON.parse(JSON.stringify(S.get('careGroups', el.dataset.id))), n = document.getElementById('cg-name').value.trim(); if (!n) return;
        var was = g.name; g.name = n; S.put('careGroups', g, 'Renamed the care group ' + was + ' to ' + n); H.closeModal(); H.render();
      },
      delgroup: function (el) {
        var g = S.get('careGroups', el.dataset.id); if (!g || !H.confirmBtn(el, '✕?')) return;
        (g.memberIds || []).forEach(function (pid) { S.careUnshare(g.id, pid); });
        S.remove('careGroups', g.id, 'Deleted the care group ' + g.name + ' (' + (g.memberIds || []).length + ' people)'); H.render(); H.toast('Care group deleted');
      },
      add: function (el) {
        var p = S.get('people', el.dataset.id); if (!p) { H.toast('Choose someone to add', true); return; }
        place(p, el.dataset.g, false); H.render(); H.toast(H.name(p) + ' added to the group');
        var again = document.querySelector('.cg-q[data-for="g-' + el.dataset.g + '"]'); if (again) again.focus();   // ready for the next name
      },
      lead: function (el) { var p = S.get('people', el.dataset.id), g = S.get('careGroups', el.dataset.g); if (p && g) { place(p, g.id, !Care.isLeader(g, p.id)); H.render(); } },
      out: function (el) { var p = S.get('people', el.dataset.id) || { id: el.dataset.id, firstName: 'Someone', lastName: '' }; saveChanges(p, Care.takeOut(S.list('careGroups'), p.id, el.dataset.g)); H.render(); H.toast('Taken out of the group'); },
      syncall: function () {
        var all = []; S.list('careGroups').forEach(function (g) { (g.memberIds || []).forEach(function (m) { if (all.indexOf(m) < 0) all.push(m); }); });
        H.busy('Updating cards…', function () { return Promise.all(all.map(sync)); }).then(function () { S.audit('Updated the care group cards of ' + all.length + ' people', 'care'); H.toast('Cards updated'); });
      },
      /* a carer, on their Me page */
      mineadd: function (el) {
        var u = me(), g = S.get('careGroups', el.dataset.g); if (!g || !Care.isLeader(g, u.id)) return;
        var choices = S.find('people', function (p) { return p.active !== false && p.familyRole !== 'child' && (g.memberIds || []).indexOf(p.id) < 0 && (p.inDirectory || p.id === u.id); })
          .sort(function (a, b) { return H.name(a).localeCompare(H.name(b)); });
        H.modal(H.dialogHead(T('Add someone to the group'), g.name) + '<div class="dlg-body">' + (choices.length ? '<label class="field" style="margin-bottom:6px">' + T('Who') + '</label>' +
          finder('mine', choices, 'care:mineaddsave', { g: g.id }, null, T('Type part of their name')) + '<p class="hint">' + T('People in the church directory.') + '</p>' : '<p class="muted">' + T('No one else in the church directory to add.') + '</p>') +
          '<p id="cg-err" class="note bad" hidden></p></div><div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button></div>', T('Add someone to the group'));
        var q = document.querySelector('.cg-q[data-for="mine"]'); if (q) q.focus();
      },
      mineaddsave: function (el) {
        var u = me(), g = S.get('careGroups', el.dataset.g), id = el.dataset.id, p = S.get('people', id); if (!g || !Care.isLeader(g, u.id)) return;
        if (!p) { var e = document.getElementById('cg-err'); e.textContent = T('Choose someone to add.'); e.hidden = false; return; }
        var x = JSON.parse(JSON.stringify(g)); x.memberIds.push(p.id); x.names = x.names || {}; x.names[p.id] = Care.nameOf(p);
        S.put('careGroups', x, 'Carer added ' + H.name(p) + ' to the care group ' + g.name); H.closeModal(); H.render(); H.toast(T('Added to the group'));
      },
      mineout: function (el) {
        var u = me(), g = S.get('careGroups', el.dataset.g), pid = el.dataset.id; if (!g || !Care.isLeader(g, u.id) || !H.confirmBtn(el, '✕?')) return;
        var x = JSON.parse(JSON.stringify(g)), name = (x.names || {})[pid] || '';
        x.memberIds = x.memberIds.filter(function (m) { return m !== pid; }); if (x.names) delete x.names[pid];
        S.put('careGroups', x, 'Carer took ' + name + ' out of the care group ' + g.name);
        S.careUnshare(g.id, pid);
        H.render(); H.toast(T('Taken out of the group'));
      }
    }
  });
  window.CareUI = { mePanel: mePanel, fields: fields, wireFields: wireFields, read: read, apply: apply, tag: tag, sync: sync, place: place, setFrom: setFrom };
})();
