/* Church Hub – Leadership: the Church Council, the elders, ministry leaders – each church names its own groups.
 * Each person on a group has a role (Chair, Secretary…), a title (Churchwarden, Elder…) and portfolios (Finance, Youth…),
 * with the dates they serve; people whose time has ended are kept under "Served before". Off until an Administrator
 * switches it on (Settings → Apps). Administrators and Pastors set the groups up; everyone else sees the open groups and
 * their own. The Archive uses these groups: a record "for a leadership group" is read by its members.
 * Terms of office: a group may have a term length, a number of terms in a row and a break after them. Each person's
 * place in their term shows as a bar; four months before a term ends, Administrators and the Senior Pastor (Rector) see it
 * on their To do list, with whether the person may stand again. Members of a group can message the whole group.
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
  /** Roles as shown: the suggested ones (Chair, Secretary…) in the chosen language, the church's own as typed. */
  function roleName(r) { return L.ROLES.indexOf(r) >= 0 ? T(r) : r; }
  function roleTags(m) {
    return (m.roles || []).map(function (r) { return ' <span class="tag ok" data-own-words>' + esc(roleName(r)) + '</span>'; }).join('') +
      (m.kind === 'coopted' ? ' <span class="tag">' + T('Co-opted') + '</span>' : '');
  }
  /** Where someone is in their term of office: a bar per term allowed (the current one partly filled), with the dates. */
  function termBar(b, m, edit) {
    var t = L.term(b, m, H.today()); if (!t) return '';
    var count = Math.max(t.max || 1, t.n), segs = '';
    for (var i = 1; i <= count; i++) segs += '<i class="' + (i < t.n ? 'done' : i === t.n ? 'now' : '') + '"' + (i === t.n ? ' style="--w:' + t.pct + '%"' : '') + '></i>';
    var words = (t.max ? T('Term {n} of {max}', { n: t.n, max: t.max }) : T('Term {n}', { n: t.n })) + ' · ' + T('{pct}% through', { pct: t.pct }) + ' · ' + (t.over ? T('Ended {date}', { date: H.fmt(t.end, true) }) : T('Ends {date}', { date: H.fmt(t.end, true) }));
    var note = '';
    if (edit && (t.soon || t.over)) note = '<span class="tag ' + (t.again ? 'warn' : 'bad') + '">' + (t.again ? T('May stand for another term') : t.rest ? T('Last term – a break until {date}', { date: H.fmt(t.rest, true) }) : T('Last term allowed')) + '</span>' +
      (t.again ? ' <button class="btn small" data-act="leaders:renew" data-g="' + esc(b.id) + '" data-id="' + esc(m.personId) + '">' + T('Start their next term') + '</button>' : '');
    return '<span class="term' + (t.soon || t.over ? ' soon' : '') + '" title="' + esc(words) + '"><span class="term-bar" role="img" aria-label="' + esc(words) + '">' + segs + '</span><small>' + esc(words) + '</small>' + (note ? '<span class="term-note">' + note + '</span>' : '') + '</span>';
  }
  function row(b, m, edit) {
    var p = S.get('people', m.personId), name = m.name || (p ? H.name(p) : T('Someone'));
    return '<div class="item" style="align-items:flex-start" data-p="' + esc(m.personId) + '">' + (p ? H.avatar(p, 36) : '<span class="av" style="--s:36px" aria-hidden="true">' + esc(name.charAt(0).toUpperCase()) + '</span>') +
      '<span class="grow"><b>' + (edit && p ? '<a class="name-chip" href="#/people/p/' + esc(p.id) + '">' + esc(name) + '</a>' : esc(name)) + roleTags(m) + '</b>' +
      (about(m) ? '<small data-own-words>' + about(m) + '</small>' : '') + termBar(b, m, edit) + '</span>' +
      (edit ? '<button class="icon-btn ghost" data-act="leaders:seat" data-g="' + esc(b.id) + '" data-id="' + esc(m.personId) + '" aria-label="' + esc(T('Edit {name}', { name: name })) + '" title="' + esc(T('Edit')) + '">' + H.icon(PEN, 16) + '</button>' +
        '<button class="icon-btn ghost" data-act="leaders:ending" data-g="' + esc(b.id) + '" data-id="' + esc(m.personId) + '" aria-label="' + esc(T('Take {name} out', { name: name })) + '" title="' + esc(T('Their time on the group has ended')) + '">' + H.icon(H.ICON.x, 16) + '</button>' : '') + '</div>';
  }
  var WORDS = { one: '{n} office-bearer', many: '{n} office-bearers', none: 'No office-bearers yet.' };
  /** May this person write to the whole group? Administrators, Pastors and anyone on it (the database rules say the same). */
  function writes(b) { var u = me(); return !!window.Msg && H.isOn('messages') && (manager() || (!!u && (b.memberIds || []).indexOf(u.id) >= 0)); }
  function panel(b, edit) {
    var ms = L.members(b), past = L.past(b), finder = edit && window.CareUI && CareUI.finder;
    var rows = ms.map(function (m) { return row(b, m, edit); }), add = finder ? '<div style="margin-top:10px">' + finder('lb-' + b.id, adults(b.memberIds || []), 'leaders:pick', { g: b.id }, null, T('Add someone: type part of their name')) + '</div>' : '';
    var list = window.CareUI && CareUI.fold ? CareUI.fold('lb-' + b.id, ms.map(function (m) { return (m.roles || []).length > 0; }), rows, ms.map(function (m) { return m.name; }), add, WORDS)
      : (ms.length ? '<div class="list" style="margin-top:8px">' + rows.join('') + '</div>' : '<p class="muted small" style="margin:8px 0 0">' + T('No one yet.') + '</p>') + add;
    var r = L.terms(b), rules = r.termYears ? [TN('{n}-year terms', '{n}-year terms', r.termYears)].concat(r.maxTerms ? [TN('at most {n} term in a row', 'at most {n} terms in a row', r.maxTerms)] : []).concat(r.maxTerms && r.breakYears ? [TN('then a {n}-year break', 'then a {n}-year break', r.breakYears)] : []).join(', ') : '';
    return '<section class="panel lb-panel" data-g="' + esc(b.id) + '"><div class="row cg-head"><div class="grow"><h2 style="margin:0" data-own-words>' + esc(b.name) + (b.open === true ? '' : ' <span class="tag grey">' + T('Members only') + '</span>') + '</h2>' +
      '<span class="muted small">' + TN('{n} person', '{n} people', ms.length) + (rules ? ' · ' + esc(rules) : '') + '</span></div><span class="cg-tools">' +
      (writes(b) && ms.length ? '<a class="icon-btn ghost" href="#/messages/send/leaders/' + esc(b.id) + '" aria-label="' + esc(T('Send the group a message')) + '" title="' + esc(T('Send the group a message')) + '">' + H.icon('M4 5h16v11H9l-5 4z', 16) + '</a>' : '') +
      (edit ? '<button class="icon-btn ghost" data-act="leaders:group" data-id="' + esc(b.id) + '" aria-label="' + esc(T('Edit {name}', { name: b.name })) + '" title="' + esc(T('Edit')) + '">' + H.icon(PEN, 16) + '</button>' +
        '<button class="icon-btn ghost" data-act="leaders:delgroup" data-id="' + esc(b.id) + '" aria-label="' + esc(T('Delete {name}', { name: b.name })) + '" title="' + esc(T('Delete the group')) + '">' + H.icon(H.ICON.trash, 16) + '</button>' : '') + '</span></div>' + list +
      (past.length ? '<details class="sub" style="margin-top:10px"><summary>' + T('Served before ({n})', { n: past.length }) + '</summary><div class="list">' + past.map(function (p) {
        var span = [p.from ? H.fmt(p.from, true) : '', p.to ? H.fmt(p.to, true) : ''].filter(Boolean).join(' – ');
        return '<div class="item"><span class="grow"><b>' + esc(p.name || T('Someone')) + '</b><small data-own-words>' + (p.roles && p.roles.length ? p.roles.map(roleName) : [p.role]).concat([p.title, p.kind === 'coopted' ? T('Co-opted') : '', p.term > 1 ? T('Term {n}', { n: p.term }) : '']).concat(p.portfolios || []).filter(Boolean).map(esc).concat(span ? [esc(span)] : []).join(' · ') + '</small></span>' +
          (edit ? '<button class="icon-btn ghost" data-act="leaders:forget" data-g="' + esc(b.id) + '" data-i="' + p.i + '" aria-label="' + esc(T('Delete {name}', { name: p.name || '' })) + '" title="' + esc(T('Delete')) + '">' + H.icon(H.ICON.trash, 16) + '</button>' : '') + '</div>';
      }).join('') + '</div></details>' : '') + '</section>';
  }
  /** Terms ending within four months: for Administrators and the Senior Pastor (Rector). */
  function told() { var u = me(); return !S.preview() && (H.can('*') || (!!u && H.isSenior(S.get('people', u.id) || u))); }
  function endingSoon() { return L.ending(S.list('leaderBodies'), H.today()); }
  function endingLine(x) {
    var t = x.t;
    return T(t.over ? 'The term of {name} on {group} ended {date}.' : 'The term of {name} on {group} ends {date}.', { name: x.m.name, group: x.body.name, date: H.fmt(t.end, true) }) + ' ' +
      (t.max ? T('Term {n} of {max}', { n: t.n, max: t.max }) : T('Term {n}', { n: t.n })) + ' · ' +
      (t.again ? T('May stand for another term') : t.rest ? T('Last term – a break until {date}', { date: H.fmt(t.rest, true) }) : T('Last term allowed'));
  }
  function page() {
    var bs = bodies(), edit = manager(), soon = told() ? endingSoon() : [];
    return (soon.length ? '<div class="note warn"><b>' + TN('{n} term of office ends soon', '{n} terms of office end soon', soon.length) + '</b><ul style="margin:6px 0 0;padding-left:18px">' + soon.map(function (x) { return '<li data-own-words>' + esc(endingLine(x)) + '</li>'; }).join('') + '</ul></div>' : '') +
      '<div class="page-head"><div><h1>' + T('Leadership') + '</h1><p class="lead">' + T('The church’s leadership groups – who serves on each, with their role, title and portfolios.') + '</p></div></div>' +
      (edit ? '<section class="panel"><h2>' + T('Add a leadership group') + '</h2><div class="row" style="gap:10px;flex-wrap:wrap"><label class="field req grow" style="margin:0">' + T('Name') + '<input id="lb-new" maxlength="80" placeholder="' + esc(T('e.g. Church Council')) + '"></label><button class="btn primary" data-act="leaders:addgroup" style="align-self:end">' + H.icon(H.ICON.plus, 16) + T('Add') + '</button></div></section>' : '') +
      (bs.length ? '<div class="grid2">' + bs.map(function (b) { return panel(b, edit); }).join('') + '</div>' : '<p class="empty">' + T('No leadership groups yet.') + '</p>');
  }
  function val(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }
  function taken(name, but) { return S.list('leaderBodies').some(function (x) { return x.id !== but && String(x.name).toLowerCase() === name.toLowerCase(); }); }
  function seatDialog(b, p, s, isNew) {
    var name = H.name(p) || (b.names || {})[p.id] || '', rest = isNew ? L.resting(b, p.id, H.today()) : '', r = L.terms(b);
    H.modal(H.dialogHead(name, b.name) + '<div class="dlg-body">' +
      (rest ? '<p class="note warn">' + esc(T('{name} served the most terms in a row allowed. Their break ends {date}.', { name: name, date: H.fmt(rest, true) })) + '</p>' : '') +
      '<label class="field">' + T('Roles') + '<input id="lb-role" maxlength="200" value="' + esc((s.roles || []).map(roleName).join(', ')) + '"><small>' + T('More than one? Separate with commas.') + '</small></label>' +
      '<div class="btns lb-roles" style="margin:-4px 0 12px">' + L.ROLES.map(function (x) { return '<button type="button" class="btn small ghost" data-act="leaders:addrole" data-r="' + esc(T(x)) + '">+ ' + esc(T(x)) + '</button>'; }).join('') + '</div>' +
      '<label class="field">' + T('Membership') + '<select id="lb-kind"><option value="">' + T('Member') + '</option><option value="coopted"' + (s.kind === 'coopted' ? ' selected' : '') + '>' + T('Co-opted') + '</option></select></label>' +
      '<label class="field">' + T('Title') + '<input id="lb-title" maxlength="80" value="' + esc(s.title) + '" placeholder="' + esc(T('e.g. Churchwarden')) + '"></label>' +
      '<label class="field">' + T('Portfolios') + '<input id="lb-port" maxlength="400" value="' + esc(s.portfolios.join(', ')) + '" placeholder="' + esc(T('e.g. Finance, Buildings')) + '"><small>' + T('What they look after. Separate with commas.') + '</small></label>' +
      '<div class="two"><label class="field">' + T('From') + '<input type="date" id="lb-from" value="' + esc(s.from) + '"></label><label class="field">' + T('To') + '<input type="date" id="lb-to" value="' + esc(s.to) + '">' +
        (r.termYears ? '<small>' + T('Leave empty to end after {n} years.', { n: r.termYears }) + '</small>' : '') + '</label></div>' +
      '<div class="two"><label class="field">' + T('Which term of office') + '<input type="number" id="lb-term" min="1" max="20" value="' + esc(s.term || 1) + '"></label>' +
        '<label class="field">' + T('This term started') + '<input type="date" id="lb-termfrom" value="' + esc(s.termFrom || '') + '"><small>' + T('For a second or later term. Empty: the From date.') + '</small></label></div></div>' +
      '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn save" data-act="leaders:saveseat" data-g="' + esc(b.id) + '" data-id="' + esc(p.id) + '"' + (isNew ? ' data-new="1"' : '') + '>' + T('Save') + '</button></div>', name);
  }
  /** Roles typed in the chosen language go back to their English names when they are one of the suggested ones. */
  function typedRoles(v) { return L.roles(v).map(function (x) { var hit = L.ROLES.filter(function (r) { return T(r).toLowerCase() === x.toLowerCase() || r.toLowerCase() === x.toLowerCase(); })[0]; return hit || x; }); }

  H.register({
    id: 'leaders', name: 'Leadership', desc: 'Council, elders and leaders – their roles and portfolios', icon: TABLE, tint: '#5B4B8A', optIn: true,
    render: function () { return page(); },
    stat: function () { return TN('{n} group', '{n} groups', bodies().length); },
    /** Four months before a term of office ends: Administrators and the Senior Pastor (Rector). */
    todos: function () {
      if (!told()) return [];
      return endingSoon().slice(0, 4).map(function (x) { return { text: endingLine(x), href: '#/leaders', tag: T('Leadership') }; });
    },
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
          '<label class="check"><input type="checkbox" id="lb-open"' + (b.open === true ? ' checked' : '') + '><span>' + T('Everyone who signs in can see this group') + '<br><span class="muted small">' + T('Untick to show it only to its own members, Administrators and Pastors.') + '</span></span></label>' +
          '<h3 style="margin:16px 0 6px">' + T('Terms of office') + '</h3><p class="hint" style="margin:0 0 8px">' + T('Leave at 0 if this group has no fixed terms. Administrators and the Senior Pastor are told four months before a term ends.') + '</p>' +
          '<div class="two"><label class="field">' + T('Years in a term') + '<input type="number" id="lb-years" min="0" max="20" value="' + esc(L.terms(b).termYears) + '"></label>' +
          '<label class="field">' + T('Terms in a row allowed') + '<input type="number" id="lb-max" min="0" max="20" value="' + esc(L.terms(b).maxTerms) + '"></label>' +
          '<label class="field">' + T('Years of break after that') + '<input type="number" id="lb-break" min="0" max="20" value="' + esc(L.terms(b).breakYears) + '"></label></div></div>' +
          '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn save" data-act="leaders:savegroup" data-id="' + esc(b.id) + '">' + T('Save') + '</button></div>', T('Edit'));
      },
      savegroup: function (el) {
        var b = S.get('leaderBodies', el.dataset.id), n = val('lb-name').slice(0, 80); if (!b || !manager()) return;
        if (!n) { H.toast(T('Give the group a name'), true); return; }
        if (taken(n, b.id)) { H.toast(T('There is already a group with that name'), true); return; }
        var x = JSON.parse(JSON.stringify(b)), open = document.getElementById('lb-open').checked, was = x.name;
        x.name = n; x.open = open; x.memberIds = x.memberIds || [];
        var r = L.terms({ termYears: val('lb-years'), maxTerms: val('lb-max'), breakYears: val('lb-break') }); x.termYears = r.termYears; x.maxTerms = r.maxTerms; x.breakYears = r.breakYears;
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
        var info = { roles: typedRoles(val('lb-role')), kind: val('lb-kind'), title: val('lb-title'), portfolios: val('lb-port'), from: val('lb-from'), to: val('lb-to'), term: val('lb-term'), termFrom: val('lb-termfrom') };
        if (info.from && info.to && info.to < info.from) { H.toast(T('The end date is before the start date'), true); return; }
        var x = L.place(b, p, info), s = x.seats[pid];
        S.put('leaderBodies', x, (el.dataset.new ? 'Added ' + H.name(p) + ' to the leadership group ' : 'Changed ' + H.name(p) + ' on the leadership group ') + b.name + (s.roles.length ? ' (' + s.roles.join(', ') + ')' : ''));
        if (el.dataset.new && window.CareUI && CareUI.openFold) { CareUI.openFold('lb-' + b.id + ':m'); if (s.roles.length) CareUI.openFold('lb-' + b.id + ':c'); }   // the Add someone box is in the members' fold
        H.closeModal(); H.render(); H.toast(T('Saved'));
        if (el.dataset.new && window.CareUI && CareUI.again) CareUI.again();   // back to the list typed before, for the next person
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
      addrole: function (el) {
        var i = document.getElementById('lb-role'); if (!i) return;
        var now = L.roles(i.value); if (now.map(function (x) { return x.toLowerCase(); }).indexOf(el.dataset.r.toLowerCase()) < 0) now.push(el.dataset.r);
        i.value = now.join(', ');
      },
      renew: function (el) {
        var b = S.get('leaderBodies', el.dataset.g), pid = el.dataset.id; if (!b || !manager()) return;
        var x = L.renew(b, pid, H.today()), name = (b.names || {})[pid] || '';
        if (!x) { H.toast(T('Last term allowed'), true); return; }
        S.put('leaderBodies', x, 'Started term ' + x.seats[pid].term + ' of ' + name + ' on the leadership group ' + b.name); H.render(); H.toast(T('Saved'));
      },
      forget: function (el) {
        var b = S.get('leaderBodies', el.dataset.g); if (!b || !manager() || !H.confirmBtn(el, '✕?')) return;
        var p = (b.past || [])[+el.dataset.i]; if (!p) return;
        S.put('leaderBodies', L.forget(b, +el.dataset.i), 'Deleted ' + (p.name || '') + ' from “Served before” on the leadership group ' + b.name); H.render();
      }
    }
  });
  /** The leadership groups a person serves on (the Archive asks). */
  /** The chips on a person (their page and the Me page): each leadership group they serve on, with their roles. Shown for the
   *  groups the person looking may see. */
  function tag(p) {
    var u = me(); if (!p || !H.isOn('leaders')) return '';
    return L.of(S.list('leaderBodies'), p.id).filter(function (o) { return L.sees(o.body, u && u.id, manager()); }).map(function (o) {
      var what = (o.roles || []).map(roleName).concat(o.kind === 'coopted' ? [T('Co-opted')] : []);
      return ' <a class="tag tag-link" style="--c:#5B4B8A" href="#/leaders">' + esc((what.length ? what.join(', ') + ' · ' : '') + o.body.name) + '</a>';
    }).join('');
  }
  window.LeadersUI = { tag: tag, mine: function (pid) { return L.of(S.list('leaderBodies'), pid).map(function (o) { return o.body.id; }); } };
})();
