/* Church Hub – Leadership: the Church Council, the elders, ministry leaders – each church names its own groups.
 * Each person on a group has a role (Chair, Secretary…), a title (Churchwarden, Elder…) and portfolios (Finance, Youth…),
 * with the dates they serve; people whose time has ended are kept under "Served before". Off until an Administrator
 * switches it on (Settings → Apps). Administrators and Pastors set the groups up; everyone else sees the open groups and
 * their own. The Archive uses these groups: a record "for a leadership group" is read by its members.
 * Rules: js/leaders.js (tested), firestore.rules (leaderBodies). */
(function () {
  'use strict';
  var H = Hub, esc = H.esc, S = Store, T = I18n.t, TN = I18n.tn, L = Leaders;
  var TABLE = 'M12 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6.5 20c.5-3.3 2.6-5 5.5-5s5 1.7 5.5 5M5 11a2.2 2.2 0 1 0 0-4.4M19 11a2.2 2.2 0 1 1 0-4.4M2.5 18c.2-1.8 1-3 2.5-3.5M21.5 18c-.2-1.8-1-3-2.5-3.5';
  var PEN = 'M4 20h4L20 8l-4-4L4 16zM14 6l4 4';

  function manager() { return H.can('*') || H.can('people.edit'); }   // Administrators and Pastors
  function me() { return H.user(); }
  function bodies() {
    var u = me(), m = manager();
    return S.list('leaderBodies').filter(function (b) { return L.sees(b, u && u.id, m); }).sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || '')); });
  }
  function adults(exclude) { return S.find('people', function (p) { return p.active !== false && p.familyRole !== 'child' && p.firstName !== 'Deleted' && !p.mergedInto && !p.binnedAt && p.category !== 'Deceased' && exclude.indexOf(p.id) < 0; }).sort(function (a, b) { return H.name(a).localeCompare(H.name(b)); }); }
  function dates(m) {
    var out = [];
    if (m.from) out.push(T('Since {date}', { date: H.fmt(m.from, true) }));
    if (m.to) out.push(T('Until {date}', { date: H.fmt(m.to, true) }));
    return out;
  }
  function about(m) { return [m.title].concat(m.portfolios || []).filter(Boolean).map(esc).concat(dates(m).map(esc)).join(' · '); }
  function row(b, m, edit) {
    var p = S.get('people', m.personId), name = m.name || (p ? H.name(p) : T('Someone'));
    return '<div class="item" style="align-items:flex-start" data-p="' + esc(m.personId) + '">' + (p ? H.avatar(p, 36) : '<span class="av" style="--s:36px" aria-hidden="true">' + esc(name.charAt(0).toUpperCase()) + '</span>') +
      '<span class="grow"><b>' + (edit && p ? '<a class="name-chip" href="#/people/p/' + esc(p.id) + '">' + esc(name) + '</a>' : esc(name)) + (m.role ? ' <span class="tag ok" data-own-words>' + esc(m.role) + '</span>' : '') + '</b>' +
      (about(m) ? '<small data-own-words>' + about(m) + '</small>' : '') + '</span>' +
      (edit ? '<button class="icon-btn ghost" data-act="leaders:seat" data-g="' + esc(b.id) + '" data-id="' + esc(m.personId) + '" aria-label="' + esc(T('Edit {name}', { name: name })) + '" title="' + esc(T('Edit')) + '">' + H.icon(PEN, 16) + '</button>' +
        '<button class="icon-btn ghost" data-act="leaders:ending" data-g="' + esc(b.id) + '" data-id="' + esc(m.personId) + '" aria-label="' + esc(T('Take {name} out', { name: name })) + '" title="' + esc(T('Their time on the group has ended')) + '">' + H.icon(H.ICON.x, 16) + '</button>' : '') + '</div>';
  }
  function panel(b, edit) {
    var ms = L.members(b), past = L.past(b), finder = edit && window.CareUI && CareUI.finder;
    return '<section class="panel lb-panel" data-g="' + esc(b.id) + '"><div class="row cg-head"><div class="grow"><h2 style="margin:0" data-own-words>' + esc(b.name) + (b.open === true ? '' : ' <span class="tag grey">' + T('Members only') + '</span>') + '</h2>' +
      '<span class="muted small">' + TN('{n} person', '{n} people', ms.length) + '</span></div>' +
      (edit ? '<span class="cg-tools"><button class="icon-btn ghost" data-act="leaders:group" data-id="' + esc(b.id) + '" aria-label="' + esc(T('Edit {name}', { name: b.name })) + '" title="' + esc(T('Edit')) + '">' + H.icon(PEN, 16) + '</button>' +
        '<button class="icon-btn ghost" data-act="leaders:delgroup" data-id="' + esc(b.id) + '" aria-label="' + esc(T('Delete {name}', { name: b.name })) + '" title="' + esc(T('Delete the group')) + '">' + H.icon(H.ICON.trash, 16) + '</button></span>' : '') + '</div>' +
      (ms.length ? '<div class="list" style="margin-top:8px">' + ms.map(function (m) { return row(b, m, edit); }).join('') + '</div>' : '<p class="muted small" style="margin:8px 0 0">' + T('No one yet.') + '</p>') +
      (finder ? '<div style="margin-top:10px">' + finder('lb-' + b.id, adults(b.memberIds || []), 'leaders:pick', { g: b.id }, null, T('Add someone: type part of their name')) + '</div>' : '') +
      (past.length ? '<details class="sub" style="margin-top:10px"><summary>' + T('Served before ({n})', { n: past.length }) + '</summary><div class="list">' + past.map(function (p) {
        var span = [p.from ? H.fmt(p.from, true) : '', p.to ? H.fmt(p.to, true) : ''].filter(Boolean).join(' – ');
        return '<div class="item"><span class="grow"><b>' + esc(p.name || T('Someone')) + '</b><small data-own-words>' + [p.role, p.title].concat(p.portfolios || []).filter(Boolean).map(esc).concat(span ? [esc(span)] : []).join(' · ') + '</small></span>' +
          (edit ? '<button class="icon-btn ghost" data-act="leaders:forget" data-g="' + esc(b.id) + '" data-i="' + p.i + '" aria-label="' + esc(T('Delete {name}', { name: p.name || '' })) + '" title="' + esc(T('Delete')) + '">' + H.icon(H.ICON.trash, 16) + '</button>' : '') + '</div>';
      }).join('') + '</div></details>' : '') + '</section>';
  }
  function page() {
    var bs = bodies(), edit = manager();
    return '<div class="page-head"><div><h1>' + T('Leadership') + '</h1><p class="lead">' + T('The church’s leadership groups – who serves on each, with their role, title and portfolios.') + '</p></div></div>' +
      (edit ? '<section class="panel"><h2>' + T('Add a leadership group') + '</h2><div class="row" style="gap:10px;flex-wrap:wrap"><label class="field req grow" style="margin:0">' + T('Name') + '<input id="lb-new" maxlength="80" placeholder="' + esc(T('e.g. Church Council')) + '"></label><button class="btn primary" data-act="leaders:addgroup" style="align-self:end">' + H.icon(H.ICON.plus, 16) + T('Add') + '</button></div></section>' : '') +
      (bs.length ? '<div class="grid2">' + bs.map(function (b) { return panel(b, edit); }).join('') + '</div>' : '<p class="empty">' + T('No leadership groups yet.') + '</p>');
  }
  function val(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }
  function taken(name, but) { return S.list('leaderBodies').some(function (x) { return x.id !== but && String(x.name).toLowerCase() === name.toLowerCase(); }); }
  function seatDialog(b, p, s, isNew) {
    var name = H.name(p) || (b.names || {})[p.id] || '';
    H.modal(H.dialogHead(name, b.name) + '<div class="dlg-body">' +
      '<label class="field">' + T('Role') + '<input id="lb-role" maxlength="80" list="lb-roles" value="' + esc(s.role) + '"><datalist id="lb-roles">' + L.ROLES.map(function (r) { return '<option value="' + esc(T(r)) + '">'; }).join('') + '</datalist></label>' +
      '<label class="field">' + T('Title') + '<input id="lb-title" maxlength="80" value="' + esc(s.title) + '" placeholder="' + esc(T('e.g. Churchwarden')) + '"></label>' +
      '<label class="field">' + T('Portfolios') + '<input id="lb-port" maxlength="400" value="' + esc(s.portfolios.join(', ')) + '" placeholder="' + esc(T('e.g. Finance, Buildings')) + '"><small>' + T('What they look after. Separate with commas.') + '</small></label>' +
      '<div class="two"><label class="field">' + T('From') + '<input type="date" id="lb-from" value="' + esc(s.from) + '"></label><label class="field">' + T('To') + '<input type="date" id="lb-to" value="' + esc(s.to) + '"></label></div></div>' +
      '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn save" data-act="leaders:saveseat" data-g="' + esc(b.id) + '" data-id="' + esc(p.id) + '"' + (isNew ? ' data-new="1"' : '') + '>' + T('Save') + '</button></div>', name);
  }

  H.register({
    id: 'leaders', name: 'Leadership', desc: 'Council, elders and leaders – their roles and portfolios', icon: TABLE, tint: '#5B4B8A', optIn: true,
    render: function () { return page(); },
    stat: function () { return TN('{n} group', '{n} groups', bodies().length); },
    actions: {
      addgroup: function () {
        if (!manager()) return;
        var n = val('lb-new').slice(0, 80); if (!n) { H.toast(T('Give the group a name'), true); return; }
        if (taken(n)) { H.toast(T('There is already a group with that name'), true); return; }
        S.put('leaderBodies', { name: n, open: true, memberIds: [], names: {}, seats: {}, past: [] }, 'Added the leadership group ' + n); H.render(); H.toast(T('Saved'));
      },
      group: function (el) {
        var b = S.get('leaderBodies', el.dataset.id); if (!b || !manager()) return;
        H.modal(H.dialogHead(T('Edit {name}', { name: b.name })) + '<div class="dlg-body"><label class="field req">' + T('Name') + '<input id="lb-name" maxlength="80" value="' + esc(b.name) + '"></label>' +
          '<label class="check"><input type="checkbox" id="lb-open"' + (b.open === true ? ' checked' : '') + '><span>' + T('Everyone who signs in can see this group') + '<br><span class="muted small">' + T('Untick to show it only to its own members, Administrators and Pastors.') + '</span></span></label></div>' +
          '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn save" data-act="leaders:savegroup" data-id="' + esc(b.id) + '">' + T('Save') + '</button></div>', T('Edit'));
      },
      savegroup: function (el) {
        var b = S.get('leaderBodies', el.dataset.id), n = val('lb-name').slice(0, 80); if (!b || !manager()) return;
        if (!n) { H.toast(T('Give the group a name'), true); return; }
        if (taken(n, b.id)) { H.toast(T('There is already a group with that name'), true); return; }
        var x = JSON.parse(JSON.stringify(b)), open = document.getElementById('lb-open').checked, was = x.name;
        x.name = n; x.open = open; x.memberIds = x.memberIds || [];
        S.put('leaderBodies', x, 'Changed the leadership group ' + was + (was !== n ? ' (now ' + n + ')' : '') + (open ? ': everyone can see it' : ': only its members can see it')); H.closeModal(); H.render(); H.toast(T('Saved'));
      },
      delgroup: function (el) {
        var b = S.get('leaderBodies', el.dataset.id); if (!b || !manager() || !H.confirmBtn(el, '✕?')) return;
        if (S.find('archive', function (r) { return r.bodyId === b.id; }).length) { H.toast(T('The Archive has records for this group. Change who can see them first.'), true); return; }
        S.remove('leaderBodies', b.id, 'Deleted the leadership group ' + b.name + ' (' + (b.memberIds || []).length + ' people)'); H.render(); H.toast(T('Deleted'));
      },
      pick: function (el) {
        var b = S.get('leaderBodies', el.dataset.g), p = S.get('people', el.dataset.id); if (!b || !manager()) return;
        if (!p) { H.toast(T('Choose someone to add'), true); return; }
        seatDialog(b, p, L.seat({ from: H.today() }), true);
      },
      seat: function (el) {
        var b = S.get('leaderBodies', el.dataset.g), pid = el.dataset.id; if (!b || !manager()) return;
        seatDialog(b, S.get('people', pid) || { id: pid, firstName: (b.names || {})[pid] || '', lastName: '' }, L.seat((b.seats || {})[pid]), false);
      },
      saveseat: function (el) {
        var b = S.get('leaderBodies', el.dataset.g), pid = el.dataset.id; if (!b || !manager()) return;
        var p = S.get('people', pid) || { id: pid, firstName: (b.names || {})[pid] || '', lastName: '' };
        var info = { role: val('lb-role'), title: val('lb-title'), portfolios: val('lb-port'), from: val('lb-from'), to: val('lb-to') };
        if (info.from && info.to && info.to < info.from) { H.toast(T('The end date is before the start date'), true); return; }
        var x = L.place(b, p, info), s = x.seats[pid];
        S.put('leaderBodies', x, (el.dataset.new ? 'Added ' + H.name(p) + ' to the leadership group ' : 'Changed ' + H.name(p) + ' on the leadership group ') + b.name + (s.role ? ' (' + s.role + ')' : ''));
        H.closeModal(); H.render(); H.toast(T('Saved'));
      },
      ending: function (el) {
        var b = S.get('leaderBodies', el.dataset.g), pid = el.dataset.id; if (!b || !manager()) return;
        var name = (b.names || {})[pid] || '';
        H.modal(H.dialogHead(T('Their time on the group has ended'), name + ' · ' + b.name) + '<div class="dlg-body"><label class="field req">' + T('Ended on') + '<input type="date" id="lb-end" value="' + esc(((b.seats || {})[pid] || {}).to || H.today()) + '"></label>' +
          '<p class="hint">' + T('They stay on the group’s record under “Served before”, with their role and dates.') + '</p></div>' +
          '<div class="dlg-foot"><button class="btn" data-act="leaders:end" data-keep="0" data-g="' + esc(b.id) + '" data-id="' + esc(pid) + '">' + T('Added by mistake – remove') + '</button>' +
          '<button class="btn save" data-act="leaders:end" data-keep="1" data-g="' + esc(b.id) + '" data-id="' + esc(pid) + '">' + T('Move to “Served before”') + '</button></div>', T('Their time on the group has ended'));
      },
      end: function (el) {
        var b = S.get('leaderBodies', el.dataset.g), pid = el.dataset.id; if (!b || !manager()) return;
        var keep = el.dataset.keep === '1', name = (b.names || {})[pid] || '';
        S.put('leaderBodies', L.end(b, pid, val('lb-end') || H.today(), keep), (keep ? 'Ended the time of ' : 'Took ') + name + (keep ? ' on' : ' off') + ' the leadership group ' + b.name);
        H.closeModal(); H.render(); H.toast(T('Saved'));
      },
      forget: function (el) {
        var b = S.get('leaderBodies', el.dataset.g); if (!b || !manager() || !H.confirmBtn(el, '✕?')) return;
        var p = (b.past || [])[+el.dataset.i]; if (!p) return;
        S.put('leaderBodies', L.forget(b, +el.dataset.i), 'Deleted ' + (p.name || '') + ' from “Served before” on the leadership group ' + b.name); H.render();
      }
    }
  });
  /** The leadership groups a person serves on (the Archive asks). */
  window.LeadersUI = { mine: function (pid) { return L.of(S.list('leaderBodies'), pid).map(function (o) { return o.body.id; }); } };
})();
