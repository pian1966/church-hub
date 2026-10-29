/* Church Hub – Privacy (the church's country's law: POPIA, GDPR, … – js/privacy-law.js): Information Officer, checklist, data-subject requests, retention, breaches, audit log. */
(function () {
  'use strict';
  var H = Hub, esc = H.esc, S = Store, T = I18n.t, TN = I18n.tn;
  var KINDS = ['Access (copy of their information)', 'Correction', 'Deletion', 'Objection to processing'];

  function tabs(a) {
    return '<nav class="seg" aria-label="' + esc(T('Privacy')) + '" style="margin-bottom:18px">' + [['', T('Overview')], ['requests', T('Requests')], ['retention', T('Retention')], ['breaches', T('Breaches')], ['audit', T('Audit log')]].map(function (x) {
      return '<a href="#/privacy' + (x[0] ? '/' + x[0] : '') + '" class="' + (x[0] === a ? 'on' : '') + '">' + x[1] + '</a>'; }).join('') + '</nav>';
  }
  /** The privacy law of the church's country (Settings → Country): POPIA in South Africa, GDPR in Europe, … */
  function law() { return PrivacyLaw.forChurch(S.settings()); }
  function head() { var L = law(); return '<div class="page-head"><div><h1>Privacy (' + esc(L.short) + ')</h1><p class="lead">Keeping the church on the right side of the ' + esc(L.name) + ': who is responsible, what people agreed to, and every request and incident.</p></div></div>'; }
  function addDays(iso, n) { return LeaveCore.iso(LeaveCore.addDays(LeaveCore.parse(iso), n)); }
  function openRequests() { return S.find('dsr', function (d) { return d.status !== 'Done'; }); }

  function checks() {
    var st = S.settings(), io = st.informationOfficer || {}, people = S.find('people', function (p) { return p.active !== false; });
    var noConsent = people.filter(function (p) { return !PeopleHelpers.hasConsent(p.id, 'Church records'); });
    var kidsNoMed = people.filter(function (p) { return p.familyRole === 'child' && p.medical && !PeopleHelpers.hasConsent(p.id, 'Children’s medical notes'); });
    var overdue = openRequests().filter(function (d) { return d.due < H.today(); }), L = law();
    return [
      [io.name && !/^\[/.test(io.name), T('{role} named', { role: L.officer }), T('Name the person responsible (usually the senior pastor or church administrator).')],
      L.register ? [!!io.registered, T('Registered with the {regulator}', { regulator: L.regulator }), L.register + ' ' + T('Then tick it here.')] : null,
      [!!(st.privacyNotice && st.privacyNotice.length > 80), T('Privacy notice written'), T('Shown when people are added and in the app.')],
      [noConsent.length === 0, noConsent.length ? TN('{n} person without recorded consent', '{n} people without recorded consent', noConsent.length) : T('Everyone has recorded consent'), T('Record consent from their profile (People).')],
      [kidsNoMed.length === 0, kidsNoMed.length ? TN('{n} child with medical notes but no guardian consent', '{n} children with medical notes but no guardian consent', kidsNoMed.length) : T('Children’s medical notes have guardian consent'), T('Ask a parent or guardian.')],
      [overdue.length === 0, overdue.length ? TN('{n} request overdue', '{n} requests overdue', overdue.length) : T('No overdue requests'), T('Respond within {n} days ({law}).', { n: L.days, law: L.short })]
    ].filter(Boolean);
  }

  function renderOverview() {
    var st = S.settings(), io = st.informationOfficer || {};
    return head() + tabs('') + '<div class="grid2"><section class="panel"><h2>' + T('Checklist') + '</h2><div class="list">' + checks().map(function (c) {
      return '<div class="item"><span style="width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:' + (c[0] ? 'var(--ok-soft);color:var(--ok)' : 'var(--warn-soft);color:var(--warn)') + '">' + (c[0] ? H.icon(H.ICON.check, 16) : '<b aria-hidden="true">!</b>') + '<span class="sr">' + T(c[0] ? 'Done' : 'To do') + '</span></span><span class="grow"><b>' + esc(c[1]) + '</b>' + (c[0] ? '' : '<small>' + esc(c[2]) + '</small>') + '</span></div>';
    }).join('') + '</div></section>' +
      '<section class="panel"><h2>' + esc(law().officer) + '</h2><dl class="kv"><dt>' + T('Name') + '</dt><dd>' + esc(io.name) + '</dd><dt>' + T('Email') + '</dt><dd>' + esc(io.email) + '</dd><dt>' + T('Phone') + '</dt><dd>' + esc(io.phone) + '</dd><dt>' + T('Deputy') + '</dt><dd>' + esc(io.deputy || '—') + '</dd>' + (law().register ? '<dt>' + T('Registered') + '</dt><dd>' + (io.registered ? '<span class="tag ok">' + T('Yes') + '</span>' : '<span class="tag warn">' + T('Not yet') + '</span>') + '</dd>' : '') + '<dt>' + T('Regulator') + '</dt><dd>' + esc(law().regulator) + '</dd></dl>' +
      '<div class="btns" style="margin-top:12px"><button class="btn small" data-act="privacy:io">' + T('Edit') + '</button></div></section>' +
      '<section class="panel"><h2>' + T('Privacy notice') + '</h2><p class="hint" style="margin-top:0">' + T('Plain words: what the church collects, why, how long, and how to ask for it to be corrected or deleted.') + '</p><label class="field"><span class="sr">' + T('Privacy notice') + '</span><textarea id="pv-notice" rows="7">' + esc(st.privacyNotice) + '</textarea></label><button class="btn small" data-act="privacy:notice">' + T('Save notice') + '</button></section>' +
      '<section class="panel"><h2>' + T('How long we keep information') + '</h2><label class="field">' + T('Review people who have left or been inactive after') + '<select id="pv-ret">' + [12, 24, 36, 60].map(function (m) { return '<option value="' + m + '"' + (st.retentionMonths === m ? ' selected' : '') + '>' + m + ' months</option>'; }).join('') + '</select></label><button class="btn small" data-act="privacy:ret">' + T('Save') + '</button><p class="hint">' + T('Staff leave records are kept as employment records.') + '</p></section></div>';
  }

  function renderRequests() {
    var list = S.list('dsr').slice().sort(function (a, b) { return a.received < b.received ? 1 : -1; });
    return head() + tabs('requests') + '<div class="row" style="margin-bottom:12px"><p class="muted grow" style="margin:0">' + T('When someone asks to see, correct or delete their information, or objects to how it’s used.') + '</p><button class="btn primary" data-act="privacy:newreq">' + H.icon(H.ICON.plus, 18) + T('Log a request') + '</button></div>' +
      (list.length ? '<div class="list">' + list.map(function (d) {
        var p = S.get('people', d.personId), late = d.status !== 'Done' && d.due < H.today();
        return '<div class="item" style="align-items:flex-start"><span class="grow"><b>' + esc(H.name(p) || T('Deleted person')) + ' · ' + esc(T(d.kind)) + '</b><small>' + esc(T('Received {date}', { date: H.fmt(d.received, true) })) + ' · ' + esc(T('respond by {date}', { date: H.fmt(d.due, true) })) + (d.notes ? ' · ' + esc(d.notes) : '') + '</small></span>' +
          '<span class="tag ' + (d.status === 'Done' ? 'ok' : late ? 'bad' : 'warn') + '">' + T(d.status === 'Done' ? 'Done' : late ? 'Overdue' : 'Open') + '</span>' +
          (d.status !== 'Done' ? '<span class="btns">' + (p && /^Access/.test(d.kind) ? '<button class="btn small" data-act="privacy:export" data-id="' + p.id + '">' + H.icon(H.ICON.download, 16) + T('Export their data') + '</button>' : '') +
            (p && /^Deletion/.test(d.kind) ? '<button class="btn small" data-act="privacy:erase" data-id="' + p.id + '">' + T('Delete their information') + '</button>' : '') +
            '<button class="btn small ok" data-act="privacy:done" data-id="' + d.id + '">' + T('Mark done') + '</button></span>' : '') + '</div>';
      }).join('') + '</div>' : '<p class="empty">' + T('No requests logged.') + '</p>');
  }

  function renderRetention() {
    var months = S.settings().retentionMonths || 24, cutoff = addDays(H.today(), -Math.round(months * 30.4));
    var left = S.find('people', function (p) { return p.active === false && p.firstName !== 'Deleted'; });
    var stale = S.find('people', function (p) { return p.active !== false && (p.updatedAt || p.createdAt || '9') < cutoff && !S.find('assignments', function (a) { return a.personId === p.id; }).length; });
    var row = function (p, why) { return '<div class="item">' + H.avatar(p, 32) + '<span class="grow"><b>' + esc(H.name(p)) + '</b><small>' + esc(why) + '</small></span><a class="btn small" href="#/people/p/' + p.id + '">' + T('Open') + '</a><button class="btn small" data-act="privacy:erase" data-id="' + p.id + '">' + T('Delete their information') + '</button></div>'; };
    return head() + tabs('retention') + '<p class="muted">' + esc(law().short) + ' says information should not be kept longer than needed. Review these people: delete their information, or keep them if they’re still connected.</p>' +
      '<section class="block"><h2>' + T('People who have left or died') + '</h2>' + (left.length ? '<div class="list">' + left.map(function (p) { return row(p, p.deceasedAt ? T('Died {date}', { date: H.fmt(p.deceasedAt, true) }) : T('Marked as left {date}', { date: p.archivedAt ? H.fmt(p.archivedAt, true) : '' }).trim()); }).join('') + '</div>' : '<p class="empty">' + T('No one has been marked as left.') + '</p>') + '</section>' +
      '<section class="block"><h2>' + T('No activity for {n} months', { n: months }) + '</h2>' + (stale.length ? '<div class="list">' + stale.map(function (p) { return row(p, T('Last updated {date}', { date: (p.updatedAt || '').slice(0, 10) })); }).join('') + '</div>' : '<p class="empty">' + T('No one is overdue for review.') + '</p>') + '</section>';
  }

  function renderBreaches() {
    var list = S.list('breaches');
    return head() + tabs('breaches') + '<div class="row" style="margin-bottom:12px"><p class="muted grow" style="margin:0">If personal information is lost, stolen or seen by someone who shouldn’t (e.g. a lost phone, a wrong email), record it here. ' + esc(law().breach) + '</p><button class="btn primary" data-act="privacy:newbreach">' + H.icon(H.ICON.plus, 18) + T('Record an incident') + '</button></div>' +
      (list.length ? '<div class="list">' + list.map(function (b) { return '<div class="item"><span class="grow"><b>' + esc(H.fmt(b.date, true) + ' · ' + b.what) + '</b><small>' + esc(T('People affected: {n}', { n: b.affected || '?' }) + ' · ' + T('Regulator told: {when}', { when: b.regulator || T('not yet') }) + ' · ' + T('People told: {when}', { when: b.told || T('not yet') })) + '</small></span></div>'; }).join('') + '</div>' : '<p class="empty">' + T('No incidents recorded.') + '</p>');
  }

  function renderAudit() {
    var list = S.list('audit').slice(0, 300);
    return head() + tabs('audit') + '<p class="muted">' + T('Who did what, and when – including every view of pastoral and children’s medical notes.') + '</p>' +
      '<div class="panel table-wrap"><table class="simple"><thead><tr><th>' + T('When') + '</th><th>' + T('Who') + '</th><th>' + T('What') + '</th></tr></thead><tbody>' + list.map(function (a) { return '<tr><td class="small">' + esc(a.at) + '</td><td>' + esc(a.who) + '</td><td>' + esc(a.action) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }

  /** Delete someone's personal information, keeping only anonymous numbers (e.g. how many served). */
  function erase(p) {
    var name = H.name(p);
    S.purge(p.id);                                   // medical and pastoral notes, even though Administrators can't read them
    S.find('guardians', function (l) { return l.childId === p.id || l.adultId === p.id; }).forEach(function (l) { S.remove('guardians', l.id); });
    S.find('noCollect', function (x) { return x.childId === p.id || x.personId === p.id; }).forEach(function (x) { S.remove('noCollect', x.id); });
    S.find('consents', function (c) { return c.personId === p.id; }).forEach(function (c) { S.remove('consents', c.id); });
    S.find('notes', function (n) { return n.personId === p.id; }).forEach(function (n) { S.remove('notes', n.id); });
    S.find('skills', function (k) { return k.personId === p.id; }).forEach(function (k) { S.remove('skills', k.id); });
    S.find('blockouts', function (b) { return b.personId === p.id; }).forEach(function (b) { S.remove('blockouts', b.id); });
    S.find('serveOffers', function (o) { return o.personId === p.id; }).forEach(function (o) { S.remove('serveOffers', o.id); });
    S.find('wordIdeas', function (w) { return w.personId === p.id; }).forEach(function (w) { S.remove('wordIdeas', w.id); });   // translation suggestions
    S.list('groups').forEach(function (g) { if (g.memberIds.indexOf(p.id) >= 0) { g.memberIds = g.memberIds.filter(function (m) { return m !== p.id; }); if (g.memberIds.length < 2) S.remove('groups', g.id); else S.put('groups', g); } });
    S.put('people', { id: p.id, firstName: 'Deleted', lastName: 'person', active: false, appRole: 'member', familyRole: p.familyRole, category: 'Deleted', deletedAt: H.today(), staff: p.staff ? { category: p.staff.category, start: p.staff.start } : undefined },
      'Deleted the personal information of ' + name + ' (kept anonymous serving and leave statistics)');
  }

  H.register({
    id: 'privacy', name: 'Privacy', desc: 'Consent, requests and safeguards', icon: H.ICON.privacy, tint: '#0F766E', roles: ['admin'],
    stat: function () { var c = checks().filter(function (x) { return !x[0]; }).length; return c ? TN('{n} thing to sort out', '{n} things to sort out', c) : T('All in order'); },
    todos: function () {
      var o = openRequests(); if (!H.can('*')) return [];
      return o.length ? [{ text: TN('{n} privacy request to answer', '{n} privacy requests to answer', o.length), href: '#/privacy/requests', tag: law().short }] : [];
    },
    render: function (p) {
      if (!H.can('*')) return '<p class="empty">' + T('Only Administrators can open Privacy.') + '</p>';
      return p[0] === 'requests' ? renderRequests() : p[0] === 'retention' ? renderRetention() : p[0] === 'breaches' ? renderBreaches() : p[0] === 'audit' ? renderAudit() : renderOverview();
    },
    actions: {
      io: function () {
        var io = S.settings().informationOfficer;
        H.modal(H.dialogHead(law().officer, T('The person responsible for {law} at the church.', { law: law().short })) + '<div class="dlg-body"><label class="field req">' + T('Name') + '<input id="io-n" value="' + esc(io.name) + '"></label><div class="two"><label class="field req">' + T('Email') + '<input id="io-e" type="email" value="' + esc(io.email) + '"></label><label class="field">' + T('Phone') + '<input id="io-p" value="' + esc(io.phone) + '"></label></div>' +
          '<label class="field">' + T('Deputy') + '<input id="io-d" value="' + esc(io.deputy || '') + '"></label><label class="check"><input type="checkbox" id="io-r"' + (io.registered ? ' checked' : '') + '>' + esc(T('Registered with the {regulator}', { regulator: law().regulator })) + '</label></div>' +
          '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn primary" data-act="privacy:saveio">' + T('Save') + '</button></div>', law().officer);
      },
      saveio: function () {
        var v = function (id) { return document.getElementById(id).value.trim(); };
        S.setSettings({ informationOfficer: { name: v('io-n'), email: v('io-e'), phone: v('io-p'), deputy: v('io-d'), registered: document.getElementById('io-r').checked } }, 'Updated ' + law().officer + ' details');
        H.closeModal(); H.render(); H.toast(T('Saved'));
      },
      notice: function () { S.setSettings({ privacyNotice: document.getElementById('pv-notice').value.trim() }, 'Updated the privacy notice'); H.toast(T('Privacy notice saved')); H.render(); },
      ret: function () { S.setSettings({ retentionMonths: +document.getElementById('pv-ret').value }, 'Changed the retention period'); H.toast(T('Saved')); H.render(); },
      newreq: function () {
        var people = S.find('people', function (p) { return p.firstName !== 'Deleted'; }).sort(function (a, b) { return H.name(a).localeCompare(H.name(b)); });
        H.modal(H.dialogHead(T('Log a request')) + '<div class="dlg-body"><label class="field req">' + T('From') + '<select class="findable" id="rq-p">' + people.map(function (p) { return '<option value="' + p.id + '">' + esc(H.name(p)) + '</option>'; }).join('') + '</select></label>' +
          '<label class="field req">' + T('They asked for') + '<select id="rq-k">' + KINDS.map(function (k) { return '<option value="' + esc(k) + '">' + esc(T(k)) + '</option>'; }).join('') + '</select></label><label class="field req">' + T('Received') + '<input type="date" id="rq-d" value="' + H.today() + '"></label><label class="field">' + T('Notes') + '<input id="rq-n"></label></div>' +
          '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn primary" data-act="privacy:savereq">' + T('Save') + '</button></div>', T('Log a request'));
      },
      savereq: function () {
        var d = document.getElementById('rq-d').value || H.today();
        S.put('dsr', { personId: document.getElementById('rq-p').value, kind: document.getElementById('rq-k').value.split(' (')[0], received: d, due: addDays(d, law().days), status: 'Open', notes: document.getElementById('rq-n').value.trim() }, 'Logged a privacy request');
        H.closeModal(); H.render(); H.toast('Logged – respond by ' + H.fmt(addDays(d, law().days), true));
      },
      done: function (el) { var d = S.get('dsr', el.dataset.id); d.status = 'Done'; d.doneAt = H.today(); S.put('dsr', d, 'Completed a privacy request'); H.render(); },
      export: function (el) { PeopleHelpers.exportPerson(S.get('people', el.dataset.id)); },
      erase: function (el) {
        if (!H.confirmBtn(el, T('Click again: delete permanently'))) return;
        var p = S.get('people', el.dataset.id); erase(p); H.render(); H.toast(T('Their personal information has been deleted'));
      },
      newbreach: function () {
        H.modal(H.dialogHead(T('Record an incident'), T('What happened to whose information.')) + '<div class="dlg-body"><label class="field req">' + T('Date') + '<input type="date" id="br-d" value="' + H.today() + '"></label><label class="field req">' + T('What happened') + '<textarea id="br-w" rows="3" placeholder="' + esc(T('e.g. A printed roster with phone numbers was left at the coffee shop')) + '"></textarea></label>' +
          '<div class="two"><label class="field">' + T('People affected') + '<input id="br-a" placeholder="' + esc(T('e.g. 14 volunteers')) + '"></label><label class="field">' + T('Regulator told on') + '<input type="date" id="br-r"></label></div><label class="field">' + T('People affected told on') + '<input type="date" id="br-t"></label></div>' +
          '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn primary" data-act="privacy:savebreach">' + T('Save') + '</button></div>', T('Record an incident'));
      },
      savebreach: function () {
        var v = function (id) { return document.getElementById(id).value.trim(); };
        if (!v('br-w')) return;
        S.put('breaches', { date: v('br-d'), what: v('br-w'), affected: v('br-a'), regulator: v('br-r'), told: v('br-t') }, 'Recorded a security incident');
        H.closeModal(); H.render();
      }
    }
  });
})();
