/* Church Hub – People: the Bin. An Administrator moves a person to the Bin (a test person, someone added by mistake);
 * they disappear from every list and lose app access, but can be restored for 30 days. After that – or with
 * "Delete forever" – they are removed: completely if they never served on a roster or took leave, otherwise their personal
 * information is deleted and an anonymous record is kept so past rosters and leave still add up (as Privacy → Retention does). */
(function (P) {
  'use strict';
  var H = Hub, esc = H.esc, S = Store, T = I18n.t, TN = I18n.tn;
  var DAYS = 30;

  function binned() { return S.find('people', function (p) { return !!p.binnedAt && p.firstName !== 'Deleted'; }).sort(function (a, b) { return a.binnedAt < b.binnedAt ? 1 : -1; }); }
  function addDays(iso, n) { var d = LeaveCore.parse(iso); d.setDate(d.getDate() + n); return LeaveCore.iso(d); }
  function goneOn(p) { return addDays(p.binnedAt, DAYS); }
  /** Served on a roster or took leave: their record is part of the church's history, so only their personal details go. */
  function hasHistory(p) {
    return !!p.staff || S.find('assignments', function (a) { return a.personId === p.id; }).length > 0 ||
      S.find('leaveRequests', function (r) { return r.staffId === p.id; }).length > 0 || S.find('leaveAdjustments', function (r) { return r.staffId === p.id; }).length > 0;
  }

  function moveToBin(p) {
    var x = JSON.parse(JSON.stringify(p));
    x.binPrev = { active: p.active !== false, category: p.category || '' };
    x.active = false; x.binnedAt = H.today(); x.binnedBy = H.name(H.user());
    S.put('people', x, 'Moved to the Bin: ' + H.name(p));
  }
  function restore(p) {
    var x = JSON.parse(JSON.stringify(p)), prev = x.binPrev || {};
    x.active = prev.active !== false; if (prev.category) x.category = prev.category;
    delete x.binnedAt; delete x.binnedBy; delete x.binPrev;
    S.put('people', x, 'Restored from the Bin: ' + H.name(p));
  }
  /** Removed for good: everything about them, or – with roster or leave history – an anonymous record stays. */
  function deleteForever(p, why) {
    var name = H.name(p);
    if (hasHistory(p) && window.PrivacyErase) { window.PrivacyErase(p); S.audit('Emptied from the Bin (' + why + '): ' + name + ' – served or took leave, so an anonymous record is kept', 'people'); return; }
    S.purge(p.id);                                   // pastoral and medical notes, which even Administrators can't read
    ['guardians', 'noCollect'].forEach(function (c) { S.find(c, function (l) { return l.childId === p.id || l.adultId === p.id || l.personId === p.id; }).forEach(function (l) { S.remove(c, l.id); }); });
    ['consents', 'notes', 'skills', 'blockouts', 'serveOffers', 'detailChanges', 'wordIdeas'].forEach(function (c) { S.find(c, function (x) { return x.personId === p.id; }).forEach(function (x) { S.remove(c, x.id); }); });
    S.list('groups').slice().forEach(function (g) { if ((g.memberIds || []).indexOf(p.id) >= 0) { g = JSON.parse(JSON.stringify(g)); g.memberIds = g.memberIds.filter(function (m) { return m !== p.id; }); if (g.memberIds.length < 2) S.remove('groups', g.id); else S.put('groups', g); } });
    S.list('careGroups').slice().forEach(function (g) {
      if ((g.memberIds || []).indexOf(p.id) < 0) return;
      S.find('careShare', function (c) { return c.groupId === g.id && c.personId === p.id; }).forEach(function (c) { S.remove('careShare', c.id); });
      g = JSON.parse(JSON.stringify(g)); g.memberIds = g.memberIds.filter(function (m) { return m !== p.id; }); g.leaderIds = (g.leaderIds || []).filter(function (m) { return m !== p.id; });
      if (g.names) delete g.names[p.id]; S.put('careGroups', g);
    });
    S.remove('people', p.id, 'Deleted forever from the Bin (' + why + '): ' + name);
  }
  /** On an Administrator's sign-in: people in the Bin for more than 30 days are deleted. */
  function emptyOld() {
    if (!H.can('*')) return;
    var today = H.today();
    binned().filter(function (p) { return goneOn(p) <= today; }).forEach(function (p) { deleteForever(p, 'after ' + DAYS + ' days'); });
  }

  function renderBin() {
    if (!H.can('*')) return '<p class="empty">' + T('Only Administrators can use the Bin.') + '</p>';
    var list = binned();
    return '<a class="crumb" href="#/people">' + H.icon(H.ICON.back, 16) + T('People') + '</a><div class="page-head"><div><h1>' + T('Bin') + '</h1>' +
      '<p class="lead">' + T('People moved to the Bin are hidden everywhere and can’t sign in. Restore them within {n} days; after that they are deleted for good.', { n: DAYS }) + '</p></div></div>' +
      (list.length ? '<div class="list">' + list.map(function (p) {
        var hist = hasHistory(p);
        return '<div class="item">' + H.avatar(p) + '<span class="grow"><b>' + esc(H.name(p)) + '</b><small>' +
          esc(T('Moved to the Bin {date} by {name} · deleted on {gone}', { date: H.fmt(p.binnedAt, true), name: p.binnedBy || '—', gone: H.fmt(goneOn(p), true) })) +
          (hist ? ' · ' + esc(T('Served on a roster or took leave: an anonymous record will be kept')) : '') + '</small></span>' +
          '<button class="btn small" data-act="people:binrestore" data-id="' + p.id + '">' + T('Restore') + '</button>' +
          '<button class="btn small" data-act="people:binforever" data-id="' + p.id + '">' + T('Delete forever') + '</button></div>';
      }).join('') + '</div>' : '<p class="empty">' + T('The Bin is empty.') + '</p>');
  }
  function binLink() {
    if (!H.can('*')) return '';
    var n = binned().length;
    return n ? '<a class="btn" href="#/people/bin">' + H.icon(H.ICON.trash, 16) + T('Bin') + ' <span class="count">' + n + '</span></a>' : '';
  }

  Object.assign(P.actions, {
    bin: function (el) {
      var p = S.get('people', el.dataset.id); if (!p || !H.can('*')) return;
      if (H.user() && p.id === H.user().id) { H.toast(T('You can’t move yourself to the Bin'), true); return; }
      if (!H.confirmBtn(el, T('Click again: move to the Bin'))) return;
      moveToBin(p); H.closeModal(); H.go('people');
      H.toast(T('{name} moved to the Bin. Restore them from People → Bin within {n} days.', { name: H.name(p), n: DAYS }));
    },
    binrestore: function (el) {
      var p = S.get('people', el.dataset.id); if (!p) return;
      restore(p); H.render(); H.toast(T('{name} restored', { name: H.name(p) }));
    },
    binforever: function (el) {
      var p = S.get('people', el.dataset.id); if (!p || !H.confirmBtn(el, T('Click again: delete forever'))) return;
      deleteForever(p, 'by hand'); H.render(); H.toast(T('Deleted forever'));
    }
  });

  Object.assign(P, { renderBin: renderBin, binLink: binLink, emptyBin: emptyOld, binned: binned });
})(PeopleParts);
