/* Church Hub – People: directory, households, profiles, consent (POPIA), restricted notes.
 * The page is split into js/people/*.js (core, directory, profile, edit, households, search); this file registers it
 * with the Hub (to-do list, upgrades, which part draws which page, events) and loads last. */
(function (P) {
  'use strict';
  var H = Hub, esc = H.esc, S = Store, T = I18n.t, TN = I18n.tn;
  var TX = function (s) { return s; };   // a text kept in a list, translated where it is shown (the language test checks it)
  var CARE_WEEKS = P.CARE_WEEKS, DUP = P.DUP, HS = P.HS, state = P.state;
  // From the other People files (each looked up when called)
  function advSync() { return P.advSync.apply(this, arguments); }
  function age() { return P.age.apply(this, arguments); }
  function canBasic() { return P.canBasic.apply(this, arguments); }
  function canChildren() { return P.canChildren.apply(this, arguments); }
  function canDup() { return P.canDup.apply(this, arguments); }
  function consentFor() { return P.consentFor.apply(this, arguments); }
  function couplesToCheck() { return P.couplesToCheck.apply(this, arguments); }
  function deceased() { return P.deceased.apply(this, arguments); }
  function dupPeople() { return P.dupPeople.apply(this, arguments); }
  function emptyAdv() { return P.emptyAdv.apply(this, arguments); }
  function exportPerson() { return P.exportPerson.apply(this, arguments); }
  function fieldActive() { return P.fieldActive.apply(this, arguments); }
  function fieldClose() { return P.fieldClose.apply(this, arguments); }
  function fieldFilter() { return P.fieldFilter.apply(this, arguments); }
  function fieldOpen() { return P.fieldOpen.apply(this, arguments); }
  function fieldPick() { return P.fieldPick.apply(this, arguments); }
  function hasConsent() { return P.hasConsent.apply(this, arguments); }
  function members() { return P.members.apply(this, arguments); }
  function needsTidy() { return P.needsTidy.apply(this, arguments); }
  function notDup() { return P.notDup.apply(this, arguments); }
  function renderChanges() { return P.renderChanges.apply(this, arguments); }
  function renderDuplicates() { return P.renderDuplicates.apply(this, arguments); }
  function renderFamilies() { return P.renderFamilies.apply(this, arguments); }
  function renderLate() { return P.renderLate.apply(this, arguments); }
  function renderList() { return P.renderList.apply(this, arguments); }
  function renderPerson() { return P.renderPerson.apply(this, arguments); }
  function renderSearch() { return P.renderSearch.apply(this, arguments); }
  function tidyDeathDates() { return P.tidyDeathDates.apply(this, arguments); }
  function tidyIdNames() { return P.tidyIdNames.apply(this, arguments); }
  state.adv = emptyAdv();

  var fieldDocHooked = false;

  H.register({
    id: 'people', name: 'People', desc: 'Directory, households and consent', icon: H.ICON.people, tint: '#7C3AED',
    stat: function () { return canBasic() ? TN('{n} person', '{n} people', S.find('people', function (p) { return p.active !== false; }).length) + ' · ' + TN('{n} household', '{n} households', S.list('families').length) : T('Church directory'); },
    todos: function (u) {
      if (!H.can('*') && !H.can('people.view') && !canChildren()) return [];
      var all = H.can('*') || H.can('people.view');
      var out = [], missing = all ? S.find('people', function (p) { return p.active !== false && !hasConsent(p.id, 'Church records'); }) : [];
      if (missing.length) out.push({ text: TN('{n} person has no recorded consent', '{n} people have no recorded consent', missing.length), href: '#/people/p/' + missing[0].id, tag: PrivacyLaw.forChurch(S.settings()).short });
      if (canChildren()) {
        var nd = HS.needs(S.list('people'), S.list('guardians'));
        if (nd.noConsenter.length) out.push({ text: TN('{n} child has no parent or guardian who can give consent', '{n} children have no parent or guardian who can give consent', nd.noConsenter.length), href: '#/people/p/' + nd.noConsenter[0].id, tag: 'Children' });
        if (nd.unconfirmed.length) out.push({ text: TN('Confirm the parents and guardians of {n} child', 'Confirm the parents and guardians of {n} children', nd.unconfirmed.length), href: '#/people/p/' + nd.unconfirmed[0].id, tag: 'Children' });
      }
      var apps = P.appsWaiting(), badges = P.badgesWaiting();
      if (apps.length) out.push({ text: TN('{n} partnership application to review', '{n} partnership applications to review', apps.length), href: apps.length === 1 ? '#/people/applications/' + apps[0].id : '#/people/applications' });
      if (badges.length) out.push({ text: TN('{n} name badge to print', '{n} name badges to print', badges.length), href: '#/people/badges' });
      var asked = P.changesToCheck();
      if (asked.length) out.push({ text: TN('{n} change to family details to check', '{n} changes to family details to check', asked.length), href: '#/people/changes' });
      var noMarital = all ? S.find('people', function (p) { return p.active !== false && p.familyRole !== 'child' && !p.maritalStatus; }) : [];
      if (canDup()) {
        // Searching everyone for duplicates is the slowest part of Home: kept until something changes
        var dupN = P.memoLater('dupCount', function () { return DUP.find(dupPeople(), notDup(), P.dupSens()).filter(function (d) { return d.level !== 'possible'; }).length; });
        if (dupN) out.push({ text: TN('{n} person looks entered twice', '{n} people look entered twice', dupN), href: '#/people/duplicates' });
      }
      var cpl = couplesToCheck();
      if (cpl.length) out.push({ text: TN('{n} couple to confirm (spouses or partners)', '{n} couples to confirm (spouses or partners)', cpl.length), href: '#/people/families' });
      if (noMarital.length) out.push({ text: TN('{n} adult has no marital status', '{n} adults have no marital status', noMarital.length), href: '#/people/p/' + noMarital[0].id });
      var since = LeaveCore.iso(LeaveCore.addDays(LeaveCore.parse(H.today()), -7 * CARE_WEEKS));
      if (H.can('notes')) S.find('people', function (p) { return deceased(p) && p.deceasedAt >= since; }).forEach(function (p) {
        out.push({ text: T('Care for the family of {name} (died {date})', { name: H.name(p), date: H.fmt(p.deceasedAt) }), href: '#/people/p/' + p.id, tag: 'Pastoral' });
      });
      if (H.can('*')) S.find('people', needsTidy).forEach(function (p) {
        out.push({ text: T('Finish recording the death of {name}: rosters and sign-in', { name: H.name(p) }), href: '#/people/p/' + p.id });
      });
      return out;
    },
    /** Once, when an Administrator signs in: new category names ("Church Partner", so it isn't mixed up with a partner in a couple),
     *  dates of death that were typed in front of a name in Elvanto ("2024-08-22-Mike") moved to the date they died,
     *  and (from before version 2) children linked to their household's adults, to confirm. */
    upgrade: function () {
      P.emptyBin();   // people in the Bin for more than 30 days are deleted
      var st = S.settings(), v = st ? st.dataVersion || 1 : 5; if (v >= 5) return;
      var say = [], linked = 0;
      if (v < 4) {
      if (v < 3) {
        var renamed = 0, MAP = { Member: 'Church Partner', Partner: 'Church Partner', Visitor: 'Visiting Minister' };
        S.list('people').slice().forEach(function (p) { if (MAP[p.category]) { p = JSON.parse(JSON.stringify(p)); p.category = MAP[p.category]; S.put('people', p); renamed++; } });
        say.push(renamed + ' renamed to Church Partner / Visiting Minister', tidyDeathDates() + ' dates of death moved out of names into the date they died');
        if (v < 2) { HS.suggestedLinks(S.list('people'), S.list('guardians')).forEach(function (l) { S.put('guardians', l); linked++; }); say.push(linked + ' parent/guardian links made from households (to confirm)'); }
      }
      say.push(tidyIdNames() + ' ID numbers moved out of names (Administrators only)');
      }
      // Version 5: services became a list the church can add to (times and venues). Someone who served at all three
      // old services now serves at "every service", so new ones include them too.
      var widened = 0;
      S.list('skills').slice().forEach(function (k) {
        var t = k.times || [];
        if (t.length >= 3 && ['08:00', '10:00', '17:00'].every(function (x) { return t.indexOf(x) >= 0; })) { k = JSON.parse(JSON.stringify(k)); k.times = []; S.put('skills', k); widened++; }
      });
      say.push(widened + ' people serving at all three services now serve at every service');
      S.setSettings({ dataVersion: 5 }, 'Upgraded people: ' + say.join('; '));
      if (linked) setTimeout(function () { H.toast(T('Children are now linked to the adults in their household – please confirm them (see Home)')); }, 400);
    },
    render: function (p) {
      if (p[0] === 'p') return renderPerson(p[1]);
      if (p[0] === 'families') return renderFamilies();
      if (p[0] === 'search') return renderSearch();
      if (p[0] === 'duplicates') return renderDuplicates();
      if (p[0] === 'late') return renderLate();
      if (p[0] === 'bin') return P.renderBin();
      if (p[0] === 'changes') return renderChanges();
      if (p[0] === 'apply') return P.renderApplyForm();
      if (p[0] === 'applications') return P.renderApps(p[1]);
      if (p[0] === 'badges') return P.renderBadges();
      return renderList();
    },
    after: function () {
      var fq = document.getElementById('fm-q');
      if (fq) fq.addEventListener('input', H.pause(function () { var f0 = document.getElementById('fm-q'); if (!f0) return; state.fq = f0.value; var pos = f0.selectionStart; H.render(); var n = document.getElementById('fm-q'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }, 350));
      var st = document.getElementById('pp-stats');
      if (st) st.addEventListener('toggle', function () { state.statsOpen = st.open; });
      var ppl = document.getElementById('pp-list');
      if (ppl && state.pick) ppl.addEventListener('change', function (ev) { if (ev.target.classList.contains('pp-sel')) P.pickChanged(ev.target); });
      var res = document.getElementById('adv-result');
      if (res && state.adv) res.addEventListener('change', function (ev) {
        var t = ev.target, sel = state.adv.sel || (state.adv.sel = {});
        if (t.id === 'adv-selall') document.querySelectorAll('.adv-sel').forEach(function (b) { b.checked = t.checked; if (t.checked) sel[b.value] = 1; else delete sel[b.value]; });
        else if (t.classList.contains('adv-sel')) { if (t.checked) sel[t.value] = 1; else delete sel[t.value]; }
        else return;
        var n = Object.keys(sel).length, b = document.getElementById('adv-bulk');
        if (b) { b.disabled = !n; b.classList.toggle('primary', !!n); b.textContent = n ? T('Change {n} selected…', { n: n }) : T('Change selected…'); }
        var nb = document.querySelector('[data-act="people:advbadges"]'), ni = document.querySelector('[data-act="people:advinvite"]');   // for those ticked, or everyone found
        if (nb) nb.textContent = n ? T('Name badges for {n} ticked', { n: n }) : T('Name badges for everyone found');
        if (ni) ni.textContent = n ? T('Invite {n} ticked to apply', { n: n }) : T('Invite everyone found to apply');
        var all = document.getElementById('adv-selall'); if (all) all.checked = n && n === document.querySelectorAll('.adv-sel').length;
      });
      var adv = document.getElementById('adv');
      if (adv) {
        var onEdit = function (ev) {
          var t = ev.target; if (t.classList.contains('adv-ff') || !advSync(t)) return;   // the field finder is handled as it's typed
          H.render();   // the choices changed: show the right boxes, and keep the place
          var b = t.id ? document.getElementById(t.id) : document.querySelector('.' + (t.classList.contains('adv-field') ? 'adv-fbtn' : t.classList[0]) + '[data-i="' + t.dataset.i + '"]');
          if (b) b.focus();
        };
        adv.addEventListener('input', function (ev) {
          var t = ev.target; if (t.tagName === 'SELECT') return;
          if (t.classList.contains('adv-ff')) fieldFilter(t); else advSync(t);   // only remembers what is typed (quick): the search runs on Enter or Search
        });
        // The field list: opens with a box to type in; typing narrows it; arrows and Enter pick; Esc or a click elsewhere closes
        adv.addEventListener('click', function (ev) {
          var b = ev.target.closest('.adv-fbtn'), o = ev.target.closest('.adv-fo');
          if (b) { var open = b.getAttribute('aria-expanded') === 'true'; fieldClose(); if (!open) fieldOpen(b); return; }
          if (o) fieldPick(o);
        });
        adv.addEventListener('keydown', function (ev) {
          var t = ev.target, pop = t.closest && t.closest('.adv-fpop');
          if (t.classList.contains('adv-fbtn') && (ev.key === 'ArrowDown' || ev.key === 'Enter' || ev.key === ' ') && t.getAttribute('aria-expanded') !== 'true') { ev.preventDefault(); fieldOpen(t); return; }
          if (t.classList.contains('adv-fbtn') && ev.key.length === 1 && !ev.ctrlKey && !ev.metaKey && !ev.altKey) { ev.preventDefault(); var inp = fieldOpen(t); inp.value = ev.key; fieldFilter(inp); return; }   // just start typing
          if (!pop) return;
          var vis = [].filter.call(pop.querySelectorAll('.adv-fo'), function (x) { return !x.hidden; }), k = vis.indexOf(pop.querySelector('.adv-fo.act'));
          if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') { ev.preventDefault(); fieldActive(pop, vis[Math.max(0, Math.min(vis.length - 1, k + (ev.key === 'ArrowDown' ? 1 : -1)))]); if (t.classList.contains('adv-fo')) pop.querySelector('.adv-ff').focus(); }
          else if (ev.key === 'Enter') { ev.preventDefault(); if (vis[k]) fieldPick(vis[k]); }
          else if (ev.key === 'Escape') { ev.preventDefault(); var i = pop.closest('.adv-fpick').dataset.i; fieldClose(); var fb = document.querySelector('.adv-fbtn[data-i="' + i + '"]'); if (fb) fb.focus(); }
          else if (ev.key === 'Tab') fieldClose();
        });
        if (!fieldDocHooked) { fieldDocHooked = true; document.addEventListener('mousedown', function (ev) { if (!ev.target.closest || !ev.target.closest('.adv-fpick')) fieldClose(); }); }
        adv.addEventListener('change', onEdit);
        var lg = document.getElementById('adv-logic');
        if (lg) lg.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); state.adv.ran = true; H.render(); } });
      }
      var pf = document.getElementById('pp-photo');
      if (pf) pf.addEventListener('change', function () {
        var p = S.get('people', pf.dataset.id), f = pf.files && pf.files[0]; if (!p || !f) return;
        pf.value = '';   // the same file can be chosen again
        H.cropPhoto(f).then(function (data) {
          return S.setPhoto(p.id, data, (p.photo ? 'Changed the photo of ' : 'Added a photo of ') + H.name(p)).then(function () { H.render(); H.toast(T('Photo saved')); });
        }).catch(function () { H.toast(T('That file isn’t a picture Church Hub can read. Try a JPG or PNG photo.')); });
      });
      var q = document.getElementById('pp-q');
      if (q) q.addEventListener('input', H.pause(function () { var n0 = document.getElementById('pp-q'); if (!n0) return; state.q = n0.value; var pos = n0.selectionStart; H.render(); var n = document.getElementById('pp-q'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }, 350));
    },
    actions: P.actions
  });

  window.PeopleHelpers = { hasConsent: hasConsent, consentFor: consentFor, members: members, age: age, exportPerson: exportPerson };
})(PeopleParts);
