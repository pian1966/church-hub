/* Church Hub – Care groups: Administrators and Pastors set them up (Care groups page, or a person's Edit details); carers
 * may add and remove members of their own group; every member sees their group on their Me page. Rules: js/care.js. */
(function () {
  'use strict';
  var H = Hub, esc = H.esc, S = Store, T = I18n.t, TN = I18n.tn;
  var HEART = 'M12 20s-7-4.4-9.3-8.6A4.8 4.8 0 0 1 12 6.3a4.8 4.8 0 0 1 9.3 5.1C19 15.6 12 20 12 20z';

  function manager() { return H.can('*') || H.can('people.edit'); }   // Administrators and Pastors
  /** Only looking: Roster coordinators, Children's ministry or Church Partners, when Settings → Who can see what allows it. */
  function viewer() { return !manager() && H.can('care.view'); }
  /** Church Partners (Basic access) see only the people in the church directory, and their groups by name. */
  function partnerView() { return viewer() && !H.can('people.basic'); }
  /** Settings → Who can see what: may members see everyone in their own group? (On unless switched off.) */
  function ownGroupOn() { return (S.settings() || {}).seeCareOwn !== false; }
  /** The groups as a Church Partner may see them: [{ id, name, people: [{ p, carer }] }] – people in the church directory only
   *  (live: their directory entry lists their groups; demo: worked out from the groups). */
  function partnerGroups() {
    var P = window.PeopleParts, people = P ? P.visiblePeople() : [], out = {}, add = function (g, p, carer) {
      var x = out[g.id] = out[g.id] || { id: g.id, name: g.name, people: [] }; x.people.push({ p: p, carer: !!carer });
    };
    if (S.isLive()) people.forEach(function (p) { (p.care || []).forEach(function (c) { add(c, p, c.carer); }); });
    else {
      var vis = {}; people.forEach(function (p) { if (p.familyRole !== 'child') vis[p.id] = p; });
      groups().forEach(function (g) { (g.memberIds || []).forEach(function (id) { if (vis[id]) add(g, vis[id], Care.isLeader(g, id)); }); });
    }
    return Object.keys(out).map(function (k) { return out[k]; }).sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
  }
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

  /* ---------- a group's people, folded away so many groups fit on one page: its carers, then its other members ---------- */
  var opened = {};   // which folds are open (kept while the page is redrawn): key + ':c' carers, key + ':m' members
  /** leads: whether each person is a carer; rows: their lines (carers first); names: their names; extra: what goes at the
   *  foot of the members' fold (the Add someone box). */
  function fold(key, leads, rows, names, extra) {
    if (!rows.length) return '<p class="muted small" style="margin:8px 0 0">' + T('No one yet.') + '</p>' + (extra || '');   // a new group: its Add someone box in view
    var pick = function (want) { return rows.filter(function (r, i) { return leads[i] === want; }); };
    var top = pick(true), rest = pick(false), topNames = names.filter(function (n, i) { return leads[i]; });
    var one = function (k, summary, inner) {
      return '<details class="sub cg-fold" data-k="' + esc(key + k) + '"' + (opened[key + k] ? ' open' : '') + '><summary>' + summary + '</summary>' + inner + '</details>';
    };
    return (top.length ? one(':c', TN('{n} carer', '{n} carers', top.length) + ' <span class="muted cg-names">· ' + esc(topNames.join(', ')) + '</span>', '<div class="list">' + top.join('') + '</div>')
      : '<p class="muted small" style="margin:8px 0 0">' + T('No carer yet.') + '</p>') +
      (rest.length || extra ? one(':m', rest.length ? (top.length ? TN('{n} other member', '{n} other members', rest.length) : TN('{n} member', '{n} members', rest.length)) : T('No other members yet'), (rest.length ? '<div class="list">' + rest.join('') + '</div>' : '') + (extra || '')) : '');
  }
  if (typeof document !== 'undefined') document.addEventListener('toggle', function (ev) {
    var d = ev.target; if (d && d.classList && d.classList.contains('cg-fold') && !d.dataset.so) opened[d.dataset.k] = d.open;   // not folds opened by a search
  }, true);

  /* ---------- a member's own care group (on their Me page) ---------- */
  function mePanel() {
    var u = me(); if (!u || !H.isOn('care')) return '';
    var pc = S.previewCare(), gs = pc ? [S.get('careGroups', pc)].filter(Boolean) : Care.groupsOf(S.list('careGroups'), u.id); if (!gs.length) return '';
    return '<div id="my-care">' + gs.map(function (g) { return oneGroup(g, u, !!pc); }).join('') + '</div>';
  }
  function oneGroup(g, u, asCarer) {
    var lead = asCarer || Care.isLeader(g, u.id), cards = {};   // "View as" a carer: an Administrator sees the group as its carer does
    S.list('careShare').forEach(function (c) { if (c.groupId === g.id) cards[c.personId] = c; });
    var all = lead || ownGroupOn();   // Settings: switched off, members see only their carers (and themselves)
    var ids = (g.memberIds || []).filter(function (pid) { return all || pid === u.id || Care.isLeader(g, pid); }).sort(function (a, b) {
      var la = Care.isLeader(g, a) ? 0 : 1, lb = Care.isLeader(g, b) ? 0 : 1; if (la !== lb) return la - lb;
      return String((g.names || {})[a] || '').localeCompare(String((g.names || {})[b] || ''));
    });
    return '<section class="panel my-care" data-g="' + esc(g.id) + '"><div class="row"><h2 class="grow" style="margin:0">' + T('My care group') + ': ' + esc(g.name) + '</h2>' + H.icon(HEART, 18) + '</div>' +
      '<p class="hint" style="margin:4px 0 10px">' + T('People in your care group see your details only if you agreed (under Consent).') + (all ? '' : ' ' + T('The church shows you your carers here; they can see everyone in the group.')) + '</p>' +
      fold('me-' + g.id, ids.map(function (pid) { return Care.isLeader(g, pid); }), ids.map(function (pid) {
        var c = cards[pid] || { firstName: ((g.names || {})[pid] || '').split(' ')[0], lastName: ((g.names || {})[pid] || '').split(' ').slice(1).join(' ') }, isL = Care.isLeader(g, pid), you = pid === u.id;
        var name = ((c.preferredName || c.firstName || '') + ' ' + (c.lastName || '')).trim() || T('A new member');
        var bits = [];
        if (c.mobile) bits.push('<a href="tel:' + esc(String(c.mobile).replace(/\s/g, '')) + '">' + esc(c.mobile) + '</a>');
        if (c.email) bits.push('<a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a>');
        if (c.address) { var at = [c.address.street, c.address.street2, [c.address.city, c.address.postcode].filter(Boolean).join(' ')].filter(Boolean).join(', '); bits.push(esc(at) + ' ' + H.mapLink([at, c.address.province, c.address.country].filter(Boolean).join(', '))); }
        if (c.birthday) bits.push(T('Birthday') + ' ' + esc(birthday(c.birthday)));
        return '<div class="item" style="align-items:flex-start">' + pic(c, 44) + '<span class="grow"><b>' + esc(name) + (you ? ' <span class="muted">(' + T('you') + ')</span>' : '') + (isL ? ' <span class="tag ok">' + T('Carer') + '</span>' : '') + '</b>' +
          '<small>' + (bits.length ? bits.join(' · ') : (cards[pid] ? T('Details not shared') : T('Details appear when they next sign in'))) + '</small></span>' +
          (lead && !you && !isL ? '<button class="icon-btn ghost" data-act="care:mineout" data-g="' + esc(g.id) + '" data-id="' + esc(pid) + '" aria-label="' + esc(T('Take {name} out of the group', { name: name })) + '" title="' + esc(T('Take {name} out of the group', { name: name })) + '">' + H.icon(H.ICON.x, 16) + '</button>' : '') + '</div>';
      }), ids.map(function (pid) { var c = cards[pid] || {}; return ((c.preferredName || c.firstName || '') + ' ' + (c.lastName || '')).trim() || (g.names || {})[pid] || ''; })) +
      (lead ? '<div class="btns" style="margin-top:12px"><button class="btn" data-act="care:mineadd" data-g="' + esc(g.id) + '">' + H.icon(H.ICON.plus, 16) + T('Add someone to the group') + '</button>' +
        (window.Msg ? '<a class="btn" href="#/messages/send/care/' + esc(g.id) + '">' + H.icon('M4 5h16v11H9l-5 4z', 16) + T('Send the group a message') + '</a>' : '') + '</div>' : '') + '</section>';
  }

  /* ---------- Edit details (Administrators and Pastors) ---------- */
  function fields(p) {
    if (!manager() || !p || p.familyRole === 'child' || !H.isOn('care')) return '';
    var gs = groups(), mine = p.id ? Care.groupsOf(gs, p.id) : [], on = mine.length > 0, inIt = {};
    mine.forEach(function (g) { inIt[g.id] = Care.isLeader(g, p.id); });
    return '<fieldset class="panel" style="padding:12px 14px;margin:6px 0 14px"><label class="check" style="margin:0"><input type="checkbox" id="pf-care"' + (on ? ' checked' : '') + '><span><b>' + T('Care group member') + '</b><br><span class="muted small">' + T('In one or more of the church’s care groups (tick which).') + '</span></span></label>' +
      '<div id="pf-care-f"' + (on ? '' : ' hidden') + ' style="margin-top:10px">' + (gs.length ? '<div class="field req" style="margin:0"><span>' + T('Which care groups') + '</span><div class="list" id="pf-care-gs">' + gs.map(function (x) {
        var has = Object.prototype.hasOwnProperty.call(inIt, x.id);
        return '<div class="item" style="gap:12px;flex-wrap:wrap"><label class="check grow" style="margin:0"><input type="checkbox" class="pf-cg" value="' + esc(x.id) + '"' + (has ? ' checked' : '') + '><span>' + esc(x.name) + '</span></label>' +
          '<label class="check" style="margin:0"><input type="checkbox" class="pf-cgl" data-g="' + esc(x.id) + '"' + (inIt[x.id] ? ' checked' : '') + (has ? '' : ' disabled') + '><span class="small">' + T('Carer (leads it)') + '</span></label></div>';
      }).join('') + '</div></div>' : '<p class="hint">' + T('There are no care groups yet – add them on the {link} page first.', { link: '<a href="#/care">' + T('Care groups') + '</a>' }) + '</p>') + '</div></fieldset>';
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
    if (b.checked && !Object.keys(want).length) return { error: T('Tick which care group(s) they are in (or untick Care group member).') };
    return { on: b.checked, want: want };
  }
  function apply(p, v) { return setFrom(p, v); }
  /** The tags on a person: Care group member or Carer, with each group's name. */
  function tag(p) {
    if (!H.isOn('care')) return '';   // Settings → Apps: care groups switched off
    var u = me(), self = !!(u && p && u.id === p.id), member = !manager() && !H.can('people.basic');
    if (!manager() && !viewer() && !self && !(member && S.careOnPeople())) return '';
    // Your own groups are always yours to see (your Me page, your profile); others' only as Settings allows
    var mine = self && !manager() ? Care.groupsOf(S.list('careGroups'), p.id).map(function (g) { return { name: g.name, carer: Care.isLeader(g, p.id) }; })
      : member ? (!S.careOnPeople() ? [] : S.isLive() ? (p.care || []) : partnerGroups().filter(function (g) { return g.people.some(function (x) { return x.p.id === p.id; }); }).map(function (g) { return { name: g.name, carer: g.people.some(function (x) { return x.p.id === p.id && x.carer; }) }; }))
      : Care.groupsOf(S.list('careGroups'), p.id).map(function (g) { return { name: g.name, carer: Care.isLeader(g, p.id) }; });
    return mine.map(function (g) { return ' <span class="tag">' + T(g.carer ? 'Carer' : 'Care group member') + ' · ' + esc(g.name) + '</span>'; }).join('');
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
    var hitsLater = H.pause(showHits, 250);
    document.addEventListener('input', function (ev) { if (ev.target.classList && ev.target.classList.contains('cg-q')) hitsLater(ev.target); });
    document.addEventListener('keydown', function (ev) {   // Enter adds the first match
      if (ev.key !== 'Enter' || !ev.target.classList || !ev.target.classList.contains('cg-q')) return;
      ev.preventDefault(); showHits(ev.target);   // typed fast and pressed Enter: search now
      var b = document.querySelector('.cg-hits[data-for="' + ev.target.dataset.for + '"] .cg-pick'); if (b) b.click();
    });
  }

  /* ---------- finding a group, or the group someone is in: type part of a group's or a person's name ---------- */
  var cgQ = '';   // kept while the page is redrawn
  function findAttr(p) { return ' data-find="' + esc((H.names ? H.names(p) : []).concat([H.name(p)]).join(' | ')) + '"'; }
  function searchBox() {
    return '<div class="cg-search"><label class="field" style="margin:0">' + T('Find a care group or a person') +
      '<input type="search" id="cg-q" value="' + esc(cgQ) + '" placeholder="' + esc(T('Type part of a group’s name or a person’s name')) + '" autocomplete="off"></label>' +
      '<p class="empty" id="cg-none" hidden>' + T('No care group or person matches what you typed.') + '</p></div>';
  }
  /** Show only the groups whose name matches, or that have someone whose name matches – that person's fold opens, and
   *  their line is marked. Nothing is redrawn, so typing isn't interrupted. */
  function applySearch() {
    var q = cgQ.trim(), shown = 0;
    [].forEach.call(document.querySelectorAll('details[data-so]'), function (d) { d.open = false; delete d.dataset.so; });
    [].forEach.call(document.querySelectorAll('.cg-panel'), function (sec) {
      var gHit = !!q && H.matches(sec.dataset.find, q), any = false;
      [].forEach.call(sec.querySelectorAll('.item[data-find]'), function (it) {
        var hit = !!q && !gHit && H.matches(it.dataset.find, q);
        it.classList.toggle('cg-hit', hit);
        if (hit) { any = true; var d = it.closest('details'); if (d && !d.open) { d.open = true; d.dataset.so = '1'; } }
      });
      var show = !q || gHit || any; sec.style.display = show ? '' : 'none'; if (show) shown++;
    });
    var none = document.getElementById('cg-none'); if (none) none.hidden = !q || shown > 0;
  }
  if (typeof document !== 'undefined') document.addEventListener('input', function (ev) {
    if (ev.target && ev.target.id === 'cg-q') { cgQ = ev.target.value; applySearch(); }
  });

  /* ---------- the Care groups page (Administrators and Pastors) ---------- */
  var STAR = 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z';   // carer on/off, quiet until hovered
  function adults(exclude) { return S.find('people', function (p) { return p.active !== false && p.familyRole !== 'child' && p.firstName !== 'Deleted' && !p.mergedInto && exclude.indexOf(p.id) < 0; }).sort(function (a, b) { return H.name(a).localeCompare(H.name(b)); }); }
  function render() {
    if (!manager()) return '<p class="empty">' + T('Only Administrators and Pastors can set up care groups.') + '</p>';
    var gs = groups(), inAny = {};
    gs.forEach(function (g) { (g.memberIds || []).forEach(function (m) { (inAny[m] = inAny[m] || []).push(g.name); }); });
    return '<div class="page-head"><div><h1>' + T('Care groups') + '</h1><p class="lead">' + T('Small groups that care for one another. A person can be in more than one group. Members see each other’s photo, phone, email, address and birthday – only if they agreed (consent “Care group”). Carers can add and remove members of their own group.') + '</p></div></div>' +
      (gs.length ? (review ? reviewPanel(gs) : '<div class="btns" style="margin:0 0 14px"><button class="btn" data-act="care:suggest">' + H.icon('M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z', 16) + T('Suggest groups by where people live') + (function (n) { return n ? ' <span class="count" title="' + esc(T('Church Partners not in a care group')) + '">' + n + '</span>' : ''; })(waiting()) + '</button></div>') : '') +
      '<section class="panel"><h2>' + T('Add a care group') + '</h2><div class="row" style="gap:10px;flex-wrap:wrap"><label class="field req grow" style="margin:0">' + T('Name') + '<input id="cg-new" placeholder="' + esc(T('e.g. Hilton Tuesday evening')) + '"></label><button class="btn primary" data-act="care:addgroup" style="align-self:end">' + H.icon(H.ICON.plus, 16) + T('Add') + '</button></div></section>' +
      (gs.length ? searchBox() + '<div class="grid2">' + gs.map(function (g) {
        var ms = (g.memberIds || []).map(function (id) { return S.get('people', id) || { id: id, firstName: (g.names || {})[id] || T('Someone'), lastName: '' }; }).sort(function (a, b) {
          var la = Care.isLeader(g, a.id) ? 0 : 1, lb = Care.isLeader(g, b.id) ? 0 : 1; return la - lb || H.name(a).localeCompare(H.name(b)); });
        return '<section class="panel cg-panel" data-find="' + esc([g.name].concat(g.areas || []).join(' | ')) + '"><div class="row cg-head"><div class="grow"><h2 style="margin:0">' + esc(g.name) + '</h2><span class="muted small">' + TN('{n} person', '{n} people', ms.length) + (Care.areasOf(g).towns.length + Care.areasOf(g).codes.length ? ' · ' + esc(T('Areas: {areas}', { areas: [].concat(g.areas || []).join(', ') })) : '') + '</span></div><span class="cg-tools">' +
          '<button class="icon-btn ghost" data-act="care:rename" data-id="' + g.id + '" aria-label="' + esc(T('Rename {name}', { name: g.name })) + '" title="' + esc(T('Rename')) + '">' + H.icon('M4 20h4L20 8l-4-4L4 16zM14 6l4 4', 16) + '</button>' +
          '<button class="icon-btn ghost" data-act="care:copy" data-id="' + g.id + '" aria-label="' + esc(T('Duplicate {name}', { name: g.name })) + '" title="' + esc(T('Duplicate the group, with all its members')) + '">' + H.icon('M9 9h11v11H9zM5 15H4V4h11v1', 16) + '</button>' +
          '<button class="icon-btn ghost" data-act="care:delgroup" data-id="' + g.id + '" aria-label="' + esc(T('Delete {name}', { name: g.name })) + '" title="' + esc(T('Delete the group')) + '">' + H.icon(H.ICON.trash, 16) + '</button></span></div>' +
          fold('g-' + g.id, ms.map(function (p) { return Care.isLeader(g, p.id); }), ms.map(function (p) {
            var isL = Care.isLeader(g, p.id);
            return '<div class="item"' + findAttr(p) + '>' + H.avatar(p, 32) + '<span class="grow"><a class="name-chip" href="#/people/p/' + p.id + '">' + esc(H.name(p)) + '</a>' + (isL ? ' <span class="tag ok">' + T('Carer') + '</span>' : '') + (consented(p.id) ? '' : ' <small class="muted">' + T('details not shared (no consent yet)') + '</small>') + '</span>' +
              '<button class="icon-btn ghost cg-lead' + (isL ? ' on' : '') + '" data-act="care:lead" data-g="' + g.id + '" data-id="' + p.id + '" aria-pressed="' + isL + '" aria-label="' + esc(T(isL ? 'Not a carer' : 'Make carer') + ': ' + H.name(p)) + '" title="' + esc(T(isL ? 'Not a carer' : 'Make carer')) + '">' + H.icon(STAR, 16) + '</button>' +
              '<button class="icon-btn ghost" data-act="care:out" data-g="' + g.id + '" data-id="' + p.id + '" aria-label="' + esc(T('Take {name} out', { name: H.name(p) })) + '" title="' + esc(T('Take out of the group')) + '">' + H.icon(H.ICON.x, 16) + '</button></div>';
          }), ms.map(function (p) { return H.name(p); }),
            '<div style="margin-top:10px">' + finder('g-' + g.id, adults(g.memberIds || []), 'care:add', { g: g.id }, function (p) { return inAny[p.id] ? T('Also in {groups}', { groups: inAny[p.id].join(', ') }) : ''; }, T('Add someone: type part of their name')) + '</div>') + '</section>';
      }).join('') + '</div>' : '<p class="empty">' + T('No care groups yet.') + '</p>') +
      (gs.length ? '<p class="hint">' + T('Members’ cards update when their details or consent change.') + ' <button class="link" data-act="care:syncall">' + T('Update everyone’s cards now') + '</button></p>' : '');
  }

  /** Roster coordinators and Children's ministry (Settings → Who can see what): every group, its carers and members –
   *  names only, nothing to change. The members' cards (phone, address…) stay with their own group. */
  function viewOnly() {
    if (partnerView()) return partnerOnly();
    var gs = groups();
    return '<div class="page-head"><div><h1>' + T('Care groups') + '</h1><p class="lead">' + T('Who is in which care group, and who their carers are. Only Administrators and Pastors can change the groups.') + '</p></div></div>' +
      (gs.length ? searchBox() + '<div class="grid2">' + gs.map(function (g) {
        var ms = (g.memberIds || []).map(function (id) { return S.get('people', id) || { id: id, firstName: (g.names || {})[id] || T('Someone'), lastName: '', missing: true }; }).sort(function (a, b) {
          var la = Care.isLeader(g, a.id) ? 0 : 1, lb = Care.isLeader(g, b.id) ? 0 : 1; return la - lb || H.name(a).localeCompare(H.name(b)); });
        return '<section class="panel cg-view cg-panel" data-find="' + esc(g.name) + '"><h2 style="margin:0">' + esc(g.name) + '</h2><span class="muted small">' + TN('{n} person', '{n} people', ms.length) + '</span>' +
          fold('v-' + g.id, ms.map(function (p) { return Care.isLeader(g, p.id); }), ms.map(function (p) {
            return '<div class="item"' + findAttr(p) + '>' + H.avatar(p, 32) + '<span class="grow">' + (p.missing ? esc(H.name(p)) : '<a class="name-chip" href="#/people/p/' + p.id + '">' + esc(H.name(p)) + '</a>') +
              (Care.isLeader(g, p.id) ? ' <span class="tag ok">' + T('Carer') + '</span>' : '') + '</span></div>';
          }), ms.map(function (p) { return H.name(p); })) + '</section>';
      }).join('') + '</div>' : '<p class="empty">' + T('No care groups yet.') + '</p>');
  }

  /** Church Partners: which care group each person in the church directory is in (names only). */
  /** Settings → All groups for Church Partners (settings.seeCare has 'member'). */
  function seeAllGroups() { return ((S.settings() || {}).seeCare || []).indexOf('member') >= 0; }
  function partnerOnly() {
    var u = me(), mine = u ? Care.groupsOf(S.list('careGroups'), u.id) : [], all = seeAllGroups(), gs = all ? partnerGroups() : [];
    // Their own group(s) first, as on the Me page; then every group when Settings allows it
    var own = mine.length ? '<div id="my-care">' + mine.map(function (g) { return oneGroup(g, u, false); }).join('') + '</div>'
      : '<p class="empty">' + T('You’re not in a care group yet.') + '</p>';
    return '<div class="page-head"><div><h1>' + T('Care groups') + '</h1>' + (all ? '<p class="lead">' + T('Which care group each person in the church directory is in, and who the carers are.') + '</p>' : '') + '</div></div>' +
      own + (!all ? '' : '<h2 style="margin:22px 0 10px">' + T('All care groups') + '</h2>') +
      (!all ? '' : gs.length ? searchBox() + '<div class="grid2">' + gs.map(function (g) {
        var ms = g.people.slice().sort(function (a, b) { return (a.carer ? 0 : 1) - (b.carer ? 0 : 1) || H.name(a.p).localeCompare(H.name(b.p)); });
        return '<section class="panel cg-view cg-panel" data-find="' + esc(g.name) + '"><h2 style="margin:0">' + esc(g.name) + '</h2><span class="muted small">' + TN('{n} person', '{n} people', ms.length) + '</span>' +
          fold('pv-' + g.id, ms.map(function (x) { return x.carer; }), ms.map(function (x) {
            return '<div class="item"' + findAttr(x.p) + '>' + H.avatar(x.p, 32) + '<span class="grow"><a class="name-chip" href="#/people/p/' + esc(x.p.id) + '">' + esc(H.name(x.p)) + '</a>' +
              (x.carer ? ' <span class="tag ok">' + T('Carer') + '</span>' : '') + '</span></div>';
          }), ms.map(function (x) { return H.name(x.p); })) + '</section>';
      }).join('') + '</div>' : '<p class="empty">' + T('No care groups yet.') + '</p>');
  }

  /* ---------- suggestions by where people live: nothing changes until an Administrator or Pastor confirms ---------- */
  var review = null;   // { clear, unclear } from Care.suggest, while the page shows it
  /** How many Church Partners are in no care group yet (the number on the Suggest button). */
  function waiting() { var r = Care.suggest(S.list('careGroups'), S.list('people')); return r.clear.length + r.unclear.length; }
  function whyText(r) {
    var w = r.with && S.get('people', r.with), place = r.place || T('their area');
    if (r.why === 'household') return T('Lives with {name}, who is in this group', { name: w ? H.name(w) : T('Someone') });
    if (r.why === 'area') return T('Lives in {place}, an area of this group', { place: place });
    if (r.why === 'neighbours') return T('Lives in {place}, like others in this group', { place: place });
    if (r.why === 'noAddress') return T('No home address');
    if (r.why === 'noGroup') return T('No care group in {place} yet', { place: place });
    var names0 = (r.groupIds || []).map(function (id) { var g = S.get('careGroups', id); return g ? g.name : ''; }).filter(Boolean).join(', ');
    if (r.why === 'whichPart') return T('Lives in {place} – which part? Closest groups: {groups}', { place: place, groups: names0 });
    var names = (r.groupIds || []).map(function (id) { var g = S.get('careGroups', id); return g ? g.name : ''; }).filter(Boolean).join(', ');
    return T(r.why === 'households' ? 'The people they live with are in different groups: {groups}' : 'Close to more than one group: {groups}', { groups: names });
  }
  function reviewRow(r, gs, sure) {
    var p = S.get('people', r.id); if (!p) return '';
    var opts = (sure ? [] : ['<option value="">' + esc(T('Choose a group')) + '</option>']).concat(gs.map(function (g) {
      var pick = sure ? g.id === r.groupId : false, hint = !sure && (r.groupIds || []).indexOf(g.id) >= 0;
      return '<option value="' + esc(g.id) + '"' + (pick ? ' selected' : '') + '>' + esc(g.name) + (hint ? ' ★' : '') + '</option>';
    }));
    return '<div class="item cgs-row" style="flex-wrap:wrap;gap:8px 12px"><label class="check grow" style="margin:0;min-width:200px"><input type="checkbox" class="cgs-on" data-id="' + esc(p.id) + '"' + (sure ? ' checked' : '') + '><span><a href="#/people/p/' + esc(p.id) + '">' + esc(H.name(p)) + '</a><br><small class="muted">' + esc(whyText(r)) + '</small></span></label>' +
      '<select class="cgs-g" data-id="' + esc(p.id) + '" aria-label="' + esc(T('Care group for {name}', { name: H.name(p) })) + '" style="max-width:240px">' + opts.join('') + '</select></div>';
  }
  function reviewPanel(gs) {
    var r = review;
    return '<section class="panel" id="cg-suggest"><h2>' + T('Suggested care groups') + '</h2><p class="hint">' + T('For Church Partners not yet in a care group, from their home address (or their household’s). Nothing changes until you confirm: check each one, change the group if needed, then put the ticked people in their groups.') + '</p>' +
      (r.clear.length || r.unclear.length ? '' : '<p class="empty">' + T('Every Church Partner is already in a care group.') + '</p>') +
      (r.clear.length ? '<h3>' + TN('{n} suggestion', '{n} suggestions', r.clear.length) + '</h3><div class="list">' + r.clear.map(function (x) { return reviewRow(x, gs, true); }).join('') + '</div>' : '') +
      (r.unclear.length ? '<h3 style="margin-top:18px">' + T('Not clear – choose a group yourself') + ' (' + r.unclear.length + ')</h3><p class="hint">' + T('★ marks the groups that are closest.') + '</p><div class="list">' + r.unclear.map(function (x) { return reviewRow(x, gs, false); }).join('') + '</div>' : '') +
      '<div class="btns" style="margin-top:14px">' + (r.clear.length || r.unclear.length ? '<button class="btn primary" data-act="care:suggestsave">' + T('Put the ticked people in their groups') + '</button>' : '') + '<button class="btn" data-act="care:suggest">' + T('Suggest again') + '</button><button class="btn" data-act="care:suggestclose">' + T('Close') + '</button></div></section>';
  }
  if (typeof document !== 'undefined') document.addEventListener('change', function (ev) {   // choosing a group ticks the person
    var el = ev.target; if (!el.classList || !el.classList.contains('cgs-g')) return;
    var b = document.querySelector('.cgs-on[data-id="' + el.dataset.id + '"]'); if (b) b.checked = !!el.value;
  });

  H.register({
    id: 'care', name: 'Care groups', desc: 'Small groups that care for one another', icon: HEART, tint: '#B4436C', roles: ['admin', 'pastor'], perm: 'care.view',
    render: function () { return viewer() ? viewOnly() : render(); },
    after: function () { applySearch(); },
    stat: function () { return manager() || viewer() ? TN('{n} group', '{n} groups', S.list('careGroups').length) : ''; },
    /** After signing in: keep my own card in my care group up to date (carers may have added me). */
    signedIn: function (u) { if (u && !manager() && Care.groupsOf(S.list('careGroups'), u.id).length) sync(u.id); },
    actions: {
      addgroup: function () {
        var n = document.getElementById('cg-new').value.trim(); if (!n) { H.toast(T('Give the group a name'), true); return; }
        if (S.list('careGroups').some(function (g) { return String(g.name).toLowerCase() === n.toLowerCase(); })) { H.toast(T('There is already a group with that name'), true); return; }
        S.put('careGroups', { name: n, leaderIds: [], memberIds: [], names: {} }, 'Added the care group ' + n); H.render(); H.toast(T('Care group added'));
      },
      rename: function (el) {
        var g = S.get('careGroups', el.dataset.id); if (!g) return;
        H.modal(H.dialogHead(T('Rename {name}', { name: g.name })) + '<div class="dlg-body"><label class="field req">' + T('Name') + '<input id="cg-name" value="' + esc(g.name) + '"></label>' +
          '<label class="field">' + T('Areas it covers') + '<input id="cg-areas" value="' + esc([].concat(g.areas || []).join(', ')) + '" placeholder="' + esc(T('e.g. Hilton, Howick North, 3245')) + '"></label><p class="hint">' + T('Suburbs, towns or postal codes, separated by commas – used to suggest groups by where people live.') + '</p></div><div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn save" data-act="care:saverename" data-id="' + g.id + '">' + T('Save') + '</button></div>', T('Rename'));
      },
      saverename: function (el) {
        var g = JSON.parse(JSON.stringify(S.get('careGroups', el.dataset.id))), n = document.getElementById('cg-name').value.trim(); if (!n) return;
        var was = g.name, ar = (document.getElementById('cg-areas') || { value: '' }).value.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
        var why = was !== n ? 'Renamed the care group ' + was + ' to ' + n : 'Changed the areas of the care group ' + n;
        g.name = n; if (ar.length) g.areas = ar; else delete g.areas;
        S.put('careGroups', g, why); H.closeModal(); H.render();
      },
      copy: function (el) {
        var g = S.get('careGroups', el.dataset.id); if (!g) return;
        H.modal(H.dialogHead(T('Duplicate {name}', { name: g.name }), TN('{n} person will be in the new group too', '{n} people will be in the new group too', (g.memberIds || []).length)) + '<div class="dlg-body"><label class="field req">' + T('Name of the new group') + '<input id="cg-copy" value="' + esc(T('{name} (copy)', { name: g.name })) + '"></label><label class="check"><input type="checkbox" id="cg-copy-l" checked><span>' + T('Keep the same carers') + '</span></label><p id="cg-err" class="note bad" hidden></p></div>' +
          '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn primary" data-act="care:savecopy" data-id="' + g.id + '">' + T('Duplicate') + '</button></div>', T('Duplicate'));
        var i = document.getElementById('cg-copy'); if (i) { i.focus(); i.select(); }
      },
      savecopy: function (el) {
        var g = S.get('careGroups', el.dataset.id), n = document.getElementById('cg-copy').value.trim(), e = document.getElementById('cg-err'); if (!g) return;
        if (!n || S.list('careGroups').some(function (x) { return String(x.name).toLowerCase() === n.toLowerCase(); })) { e.textContent = T(n ? 'There is already a group with that name.' : 'Give the new group a name.'); e.hidden = false; return; }
        var x = { name: n, memberIds: (g.memberIds || []).slice(), leaderIds: document.getElementById('cg-copy-l').checked ? (g.leaderIds || []).slice() : [], names: JSON.parse(JSON.stringify(g.names || {})) };
        S.put('careGroups', x, 'Duplicated the care group ' + g.name + ' as ' + n + ' (' + x.memberIds.length + ' people)');
        H.closeModal(); H.render(); H.toast(T('Care group duplicated'));
        Promise.all(x.memberIds.map(sync));   // each member gets a card in the new group
      },
      delgroup: function (el) {
        var g = S.get('careGroups', el.dataset.id); if (!g || !H.confirmBtn(el, '✕?')) return;
        (g.memberIds || []).forEach(function (pid) { S.careUnshare(g.id, pid); });
        S.remove('careGroups', g.id, 'Deleted the care group ' + g.name + ' (' + (g.memberIds || []).length + ' people)'); H.render(); H.toast(T('Care group deleted'));
      },
      add: function (el) {
        var p = S.get('people', el.dataset.id); if (!p) { H.toast(T('Choose someone to add'), true); return; }
        place(p, el.dataset.g, false); opened['g-' + el.dataset.g + ':m'] = true; H.render(); H.toast(T('{name} added to the group', { name: H.name(p) }));
        var again = document.querySelector('.cg-q[data-for="g-' + el.dataset.g + '"]'); if (again) again.focus();   // ready for the next name
      },
      lead: function (el) {   // "Not a carer" stops them being a carer in every group; "Make carer" is for this group
        var p = S.get('people', el.dataset.id), g = S.get('careGroups', el.dataset.g); if (!p || !g) return;
        if (!Care.isLeader(g, p.id)) { place(p, g.id, true); opened['g-' + g.id + ':c'] = true; H.render(); return; }
        var n = 0; Care.groupsOf(S.list('careGroups'), p.id).forEach(function (x) { if (Care.isLeader(x, p.id) && place(p, x.id, false)) n++; });
        H.render(); if (n > 1) H.toast(T('{name} is no longer a carer in {n} groups', { name: H.name(p), n: n }));
      },
      out: function (el) { var p = S.get('people', el.dataset.id) || { id: el.dataset.id, firstName: 'Someone', lastName: '' }; saveChanges(p, Care.takeOut(S.list('careGroups'), p.id, el.dataset.g)); H.render(); H.toast(T('Taken out of the group')); },
      suggest: function () {
        review = Care.suggest(S.list('careGroups'), S.list('people'));
        S.audit('Looked at suggested care groups by area (' + review.clear.length + ' suggested, ' + review.unclear.length + ' not clear)', 'care');
        H.render(); var el = document.getElementById('cg-suggest'); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start' });
      },
      suggestclose: function () { review = null; H.render(); },
      suggestsave: function () {
        var n = 0;
        Array.prototype.forEach.call(document.querySelectorAll('.cgs-on:checked'), function (b) {
          var sel = document.querySelector('.cgs-g[data-id="' + b.dataset.id + '"]'), p = S.get('people', b.dataset.id);
          if (p && sel && sel.value && place(p, sel.value, false, 'Suggested by area: ')) n++;
        });
        if (!n) { H.toast(T('Tick at least one person and choose their group'), true); return; }
        // suggest again for those still without a group: placing someone can make their household's group clear
        review = Care.suggest(S.list('careGroups'), S.list('people'));
        H.render(); H.toast(TN('{n} person put in a care group', '{n} people put in care groups', n));
      },
      syncall: function () {
        var all = []; S.list('careGroups').forEach(function (g) { (g.memberIds || []).forEach(function (m) { if (all.indexOf(m) < 0) all.push(m); }); });
        H.busy(T('Updating cards…'), function () { return Promise.all(all.map(sync)); }).then(function () { S.audit('Updated the care group cards of ' + all.length + ' people', 'care'); H.toast(T('Cards updated')); });
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
        S.put('careGroups', x, 'Carer added ' + H.name(p) + ' to the care group ' + g.name); opened['me-' + g.id + ':m'] = true; H.closeModal(); H.render(); H.toast(T('Added to the group'));
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
  window.CareUI = { finder: finder, mePanel: mePanel, fields: fields, wireFields: wireFields, read: read, apply: apply, tag: tag, sync: sync, place: place, setFrom: setFrom };
})();
