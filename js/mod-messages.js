/* Church Hub – Messages: the church office, Pastors, carers and group leaders send messages to a care group, a message
 * group (e.g. Worship team leaders), the staff or every Church Partner; everyone reads theirs here, on a phone or a computer.
 * Rules (who goes in which audience, who may send, unread): js/messages.js. Data: messages, msgGroups (see that file). */
(function () {
  'use strict';
  var H = Hub, esc = H.esc, S = Store, T = I18n.t, TN = I18n.tn;
  var BUBBLE = 'M4 5h16v11H9l-5 4z';
  var STAR = 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z';

  function me() { return H.user(); }
  function manager() { return H.can('*') || H.can('people.edit'); }   // Administrators and Pastors
  function who() { var u = me(); return { id: u ? u.id : '', manager: manager() }; }
  /** Care groups and life groups only while switched on (Settings → Apps). */
  function data() { return { people: S.list('people'), careGroups: H.isOn('care') ? S.list('careGroups') : [], lifeGroups: H.isOn('life') ? S.list('lifeGroups') : [], msgGroups: S.list('msgGroups') }; }
  function audiences() { return Msg.audiences(who(), data()); }
  function key(a) { return a.kind + (a.groupId ? '/' + a.groupId : ''); }
  /** The audience's name as shown: Staff and Church Partners in the chosen language, groups as they are called. */
  function audName(kind, name) { return kind === 'staff' ? T('Staff') : kind === 'partners' ? T('Church Partners') : kind === 'people' ? name || T('Chosen people') : name || ''; }
  /** Who it went to, as shown: "Care group · Hilton", "Staff · 3 people" (only some of them), "Thandi Mokoena", "4 people". */
  function audLong(m) {
    var n = (m.to || []).length;
    if (m.kind === 'people') return m.audience ? esc(m.audience) : esc(TN('{n} person', '{n} people', n));
    var base = m.kind === 'care' ? T('Care group') + ' · ' + esc(m.audience) : m.kind === 'life' ? T('Midweek group') + ' · ' + esc(m.audience) : m.kind === 'group' ? esc(m.audience) : esc(audName(m.kind));
    return base + (m.some ? ' · ' + esc(TN('{n} person', '{n} people', n)) : '');
  }
  function unreadCount() { var u = me(); return u ? Msg.unread(S.list('messages'), u.id).length : 0; }
  /** "Today 08:15", "Yesterday 19:02" or "Tue 3 Nov 08:15" */
  function when(at) {
    if (!at) return '';
    var day = String(at).slice(0, 10), time = String(at).slice(11, 16), t = H.today();
    var y = new Date(); y.setDate(y.getDate() - 1); var yd = y.getFullYear() + '-' + String(y.getMonth() + 1).padStart(2, '0') + '-' + String(y.getDate()).padStart(2, '0');
    return (day === t ? T('Today') : day === yd ? T('Yesterday') : H.fmt(day, day.slice(0, 4) !== t.slice(0, 4))) + (time ? ' ' + time : '');
  }
  /** The message text, safe to show, with web addresses made into links. */
  function bodyHtml(s) { return esc(s).replace(/\bhttps?:\/\/[^\s<]+[^\s<.,;:!?)'"]/g, function (u) { return '<a href="' + u + '" target="_blank" rel="noopener">' + u + '</a>'; }); }

  function tabs(active) {
    var t = [['', T('Inbox')]];
    if (audiences().length) t.push(['send', T('Write')], ['sent', T('Sent')]);
    if (manager()) t.push(['groups', T('Groups')]);
    if (t.length < 2) return '';
    return '<nav class="seg me-tabs" aria-label="' + esc(T('Messages')) + '">' + t.map(function (x) {
      var on = x[0] === active, n = x[0] === '' ? unreadCount() : 0;
      return '<a href="#/messages' + (x[0] ? '/' + x[0] : '') + '" class="' + (on ? 'on' : '') + '"' + (on ? ' aria-current="page"' : '') + '>' + esc(x[1]) + (n ? ' (' + n + ')' : '') + '</a>';
    }).join('') + '</nav>';
  }
  function head(lead, active) { return '<div class="page-head"><div><h1>' + T('Messages') + '</h1><p class="lead">' + lead + '</p></div></div>' + tabs(active); }

  /* ---------- Inbox: messages sent to me ---------- */
  var justRead = {};   // opened on this visit: still marked as new until the page is left, so people see what came in
  if (typeof window !== 'undefined') window.addEventListener('hashchange', function () { if (!/^#\/messages\/?$/.test(location.hash)) justRead = {}; });
  function renderInbox() {
    var u = me(), list = Msg.inbox(S.list('messages'), u.id);
    var html = head(T('Messages from the church to you and the groups you are in.'), '');
    if (!list.length) return html + '<p class="empty">' + T('No messages yet. Messages from the church office, your care group and other groups you are in will appear here.') + '</p>';
    return html + '<section class="panel" style="padding:0">' + list.map(function (m) {
      var isNew = Msg.isUnread(m, u.id) || justRead[m.id];
      return '<article class="msg' + (isNew ? ' new' : '') + '" data-id="' + esc(m.id) + '"><div class="msg-top"><b>' + esc(m.title || audName(m.kind, m.audience)) + '</b><span class="muted small">' + esc(when(m.createdAt)) + '</span></div>' +
        '<div class="muted small">' + T('From {name}', { name: esc(m.fromName || T('Someone')) }) + ' · ' + T('To {who}', { who: audLong(m) }) + '</div>' +
        '<p class="msg-body">' + bodyHtml(m.body) + '</p></article>';
    }).join('') + '</section>';
  }
  /** Opening the inbox marks what is shown as read (on every device; the sender sees how many have read it). */
  function markShown() {
    if (typeof document !== 'undefined' && document.hidden) return;   // the app is in the background: not seen yet (see below)
    if (!/^#\/messages\/?$/.test(location.hash)) return;
    var u = me(); if (!u) return;
    var ids = Msg.unread(S.list('messages'), u.id).map(function (m) { return m.id; });
    if (!ids.length) return;
    ids.forEach(function (id) { justRead[id] = 1; });
    S.markRead(ids, u.id);
    Array.prototype.forEach.call(document.querySelectorAll('a[href="#/messages"] .badge'), function (b) { b.remove(); });   // the counts on the menu
  }

  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', function () { if (!document.hidden) markShown(); });

  /* ---------- Write a message ---------- */
  // What is being written (kept while the page is redrawn): who to, and – for "Chosen people" or "Only some of them" – who is
  // ticked. pending: the message waiting for "Send" in the confirmation dialog.
  var draft = { to: '', title: '', body: '', some: false, chosen: {} }, pending = null;
  function picking(a) { return a.kind === 'people' || draft.some; }
  function ticked() { return Object.keys(draft.chosen).filter(function (id) { return draft.chosen[id]; }); }
  /** A person's name for the checklist: from their record, or the name the group keeps (carers and leaders who aren't staff). */
  function personName(id, a) {
    var p = S.get('people', id); if (p) return H.name(p);
    var g = a.kind === 'care' ? S.get('careGroups', a.groupId) : a.kind === 'life' ? S.get('lifeGroups', a.groupId) : a.kind === 'group' ? S.get('msgGroups', a.groupId) : null;
    return (g && g.names && g.names[id]) || T('Someone');
  }
  function reach(a) {
    var all = Msg.recipients(a.kind, a.groupId, data()), ids = picking(a) ? ticked().filter(function (id) { return all.indexOf(id) >= 0; }) : all, n = ids.length;
    var txt = TN('Goes to {n} person', 'Goes to {n} people', n);
    if (manager() && n) {
      var app = Msg.inApp(ids, S.list('people')).length;
      if (app < n) txt += ' ' + T('{n} of them can’t sign in to Church Hub yet – reach them by email, WhatsApp or SMS as before.', { n: n - app });
    }
    return txt;
  }
  function renderSend(pre) {
    var as = audiences();
    if (!as.length) return head(T('Messages from the church to you and the groups you are in.'), 'send') + '<p class="empty">' + T('Only Administrators, Pastors, carers and group leaders can send messages.') + '</p>';
    var pp = /^people\/(.+)$/.exec(pre || '');   // #/messages/send/people/<personId>: a message to that one person
    if (pp && as.some(function (a) { return a.kind === 'people'; })) { draft.to = 'people'; draft.chosen = {}; draft.chosen[pp[1]] = true; draft.some = false; }
    else if (pre && as.some(function (a) { return key(a) === pre; }) && pre !== draft.to) { draft.to = pre; draft.chosen = {}; draft.some = false; }
    var cur = as.filter(function (a) { return key(a) === draft.to; })[0] || as[0]; draft.to = key(cur);
    var opt = function (a) { return '<option value="' + esc(key(a)) + '"' + (key(a) === draft.to ? ' selected' : '') + '>' + esc(audName(a.kind, a.name)) + '</option>'; };
    var groupOf = function (k) { return as.filter(function (a) { return a.kind === k; }); };
    var sel = [['', groupOf('people').concat(groupOf('staff'), groupOf('partners'))], [T('Care groups'), groupOf('care')], [T('Midweek groups'), groupOf('life')], [T('Message groups'), groupOf('group')]].map(function (g) {
      if (!g[1].length) return ''; return g[0] ? '<optgroup label="' + esc(g[0]) + '">' + g[1].map(opt).join('') + '</optgroup>' : g[1].map(opt).join('');
    }).join('');
    return head(T('Send a message to a group. Everyone in it sees it here, in Church Hub.'), 'send') +
      '<section class="panel">' + H.reqKey() + '<label class="field req">' + T('To') + '<select id="ms-to">' + sel + '</select></label><p class="hint" id="ms-reach" style="margin:-6px 0 16px">' + esc(reach(cur)) + '</p>' + checklist(cur) +
      '<label class="field">' + T('Subject') + '<input id="ms-title" maxlength="' + Msg.MAX_TITLE + '" value="' + esc(draft.title) + '" placeholder="' + esc(T('e.g. No meeting this Tuesday')) + '"></label>' +
      '<label class="field req">' + T('Message') + '<textarea id="ms-body" maxlength="' + Msg.MAX_BODY + '">' + esc(draft.body) + '</textarea></label>' +
      '<p id="ms-err" class="note bad" hidden></p>' +
      '<div class="btns"><button class="btn primary" data-act="messages:send">' + H.icon(BUBBLE, 16) + T('Send') + '</button></div></section>' +
      '<p class="hint">' + T('Please don’t put private or medical details in a message to a group.') + '</p>';
  }
  /** Ticking who gets it: everyone who may be chosen ("Chosen people"), or a group's people after "Only some of them". */
  function checklist(a) {
    var box = a.kind === 'people' ? '' : '<label class="check" style="margin:-6px 0 12px"><input type="checkbox" id="ms-some"' + (draft.some ? ' checked' : '') + '><span>' + T('Only some of them') + '</span></label>';
    if (!picking(a)) return box;
    var ids = Msg.recipients(a.kind, a.groupId, data()).map(function (id) { return { id: id, name: personName(id, a) }; })
      .sort(function (x, y) { return x.name.localeCompare(y.name); });
    return box + '<div class="panel inset ms-pick-box"><p class="hint" style="margin:0 0 8px">' + T('Tick who should get it.') + '</p>' +
      (ids.length > 8 ? '<input id="ms-find" class="ms-find" autocomplete="off" placeholder="' + esc(T('Type part of their name')) + '" aria-label="' + esc(T('Type part of their name')) + '">' : '') +
      '<div class="btns" style="margin:8px 0"><button type="button" class="btn small" data-act="messages:tick" data-on="1">' + T('Tick all') + '</button><button type="button" class="btn small" data-act="messages:tick" data-on="">' + T('Untick all') + '</button></div>' +
      '<div class="ms-list">' + ids.map(function (x) {
        return '<label class="check ms-row" data-name="' + esc(x.name.toLowerCase()) + '"><input type="checkbox" class="ms-pick" value="' + esc(x.id) + '"' + (draft.chosen[x.id] ? ' checked' : '') + '><span>' + esc(x.name) + '</span></label>';
      }).join('') + '</div></div>';
  }
  function current() { return audiences().filter(function (x) { return key(x) === draft.to; })[0]; }
  function showReach() { var a = current(), el = document.getElementById('ms-reach'); if (a && el) el.textContent = reach(a); }
  function wireSend() {
    var to = document.getElementById('ms-to'), title = document.getElementById('ms-title'), body = document.getElementById('ms-body');
    if (!to) return;
    to.addEventListener('change', function () { draft.to = to.value; draft.some = false; draft.chosen = {}; H.render(); });
    var some = document.getElementById('ms-some');
    if (some) some.addEventListener('change', function () {   // start with everyone ticked, then untick who shouldn't get it
      var a = current(); draft.some = some.checked; draft.chosen = {};
      if (a && some.checked) Msg.recipients(a.kind, a.groupId, data()).forEach(function (id) { draft.chosen[id] = true; });
      H.render();
    });
    Array.prototype.forEach.call(document.querySelectorAll('.ms-pick'), function (c) {
      c.addEventListener('change', function () { draft.chosen[c.value] = c.checked; showReach(); });
    });
    var find = document.getElementById('ms-find');
    if (find) find.addEventListener('input', H.pause(function () {
      Array.prototype.forEach.call(document.querySelectorAll('.ms-row'), function (r) { r.hidden = !H.matches(r.dataset.name, find.value); });
    }, 200));
    title.addEventListener('input', function () { draft.title = title.value; });
    body.addEventListener('input', function () { draft.body = body.value; });
  }

  /* ---------- Sent ---------- */
  function renderSent() {
    var u = me(), all = manager(), list = Msg.sent(S.list('messages'), u.id, all);
    var html = head(all ? T('Every message sent in Church Hub, newest first. You can delete any of them.') : T('Messages you have sent, newest first.'), 'sent');
    if (!list.length) return html + '<p class="empty">' + T('Nothing sent yet.') + '</p>';
    return html + '<section class="panel" style="padding:0">' + list.map(function (m) {
      var s = Msg.seen(m), mine = m.fromId === u.id;
      return '<article class="msg" data-id="' + esc(m.id) + '"><div class="msg-top"><b>' + esc(m.title || audName(m.kind, m.audience)) + '</b><span class="muted small">' + esc(when(m.createdAt)) + '</span></div>' +
        '<div class="muted small">' + (mine ? '' : T('From {name}', { name: esc(m.fromName || T('Someone')) }) + ' · ') + T('To {who}', { who: audLong(m) }) + '</div>' +
        '<p class="msg-body">' + bodyHtml(m.body) + '</p>' +
        '<div class="msg-foot"><span class="grow muted">' + T('Read by {n} of {total}', { n: s.n, total: s.of }) + '</span>' +
        (Msg.mayDelete(m, who()) ? '<button class="icon-btn ghost" data-act="messages:del" data-id="' + esc(m.id) + '" aria-label="' + esc(T('Delete the message')) + '" title="' + esc(T('Delete the message')) + '">' + H.icon(H.ICON.trash, 16) + '</button>' : '') + '</div></article>';
    }).join('') + '</section>';
  }

  /* ---------- Message groups (Administrators and Pastors) ---------- */
  function groups() { return S.list('msgGroups').slice().sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); }); }
  function adults(exclude) {
    return S.find('people', function (p) { return p.active !== false && p.familyRole !== 'child' && p.category !== 'Deceased' && p.firstName !== 'Deleted' && !p.mergedInto && !p.binnedAt && exclude.indexOf(p.id) < 0; })
      .sort(function (a, b) { return H.name(a).localeCompare(H.name(b)); });
  }
  function renderGroups() {
    if (!manager()) return head('', 'groups') + '<p class="empty">' + T('Only Administrators and Pastors can set up message groups.') + '</p>';
    var gs = groups(), finder = window.CareUI && CareUI.finder;
    return head(T('Groups you can send messages to, besides care groups, the staff and Church Partners – for example Worship team leaders or the Alpha team. Leaders can send messages to their own group.'), 'groups') +
      '<section class="panel"><h2>' + T('Add a message group') + '</h2><div class="row" style="gap:10px;flex-wrap:wrap"><label class="field req grow" style="margin:0">' + T('Name') + '<input id="mg-new" placeholder="' + esc(T('e.g. Worship team leaders')) + '"></label><button class="btn primary" data-act="messages:addgroup" style="align-self:end">' + H.icon(H.ICON.plus, 16) + T('Add') + '</button></div></section>' +
      (gs.length ? '<div class="grid2">' + gs.map(function (g) {
        var ms = (g.memberIds || []).map(function (id) { return S.get('people', id) || { id: id, firstName: T('Someone'), lastName: '' }; }).sort(function (a, b) {
          var la = Msg.leads(g, a.id) ? 0 : 1, lb = Msg.leads(g, b.id) ? 0 : 1; return la - lb || H.name(a).localeCompare(H.name(b)); });
        return '<section class="panel"><div class="row cg-head"><div class="grow"><h2 style="margin:0">' + esc(g.name) + '</h2><span class="muted small">' + TN('{n} person', '{n} people', ms.length) + '</span></div><span class="cg-tools">' +
          '<a class="icon-btn ghost" href="#/messages/send/group/' + esc(g.id) + '" aria-label="' + esc(T('Send a message to {name}', { name: g.name })) + '" title="' + esc(T('Send a message')) + '">' + H.icon(BUBBLE, 16) + '</a>' +
          '<button class="icon-btn ghost" data-act="messages:rename" data-id="' + esc(g.id) + '" aria-label="' + esc(T('Rename {name}', { name: g.name })) + '" title="' + esc(T('Rename')) + '">' + H.icon('M4 20h4L20 8l-4-4L4 16zM14 6l4 4', 16) + '</button>' +
          '<button class="icon-btn ghost" data-act="messages:delgroup" data-id="' + esc(g.id) + '" aria-label="' + esc(T('Delete {name}', { name: g.name })) + '" title="' + esc(T('Delete the group')) + '">' + H.icon(H.ICON.trash, 16) + '</button></span></div>' +
          (ms.length ? '<div class="list" style="margin-top:8px">' + ms.map(function (p) {
            var isL = Msg.leads(g, p.id);
            return '<div class="item">' + H.avatar(p, 32) + '<span class="grow"><a class="name-chip" href="#/people/p/' + esc(p.id) + '">' + esc(H.name(p)) + '</a>' + (isL ? ' <span class="tag ok">' + T('Leader') + '</span>' : '') + '</span>' +
              '<button class="icon-btn ghost cg-lead' + (isL ? ' on' : '') + '" data-act="messages:lead" data-g="' + esc(g.id) + '" data-id="' + esc(p.id) + '" aria-pressed="' + isL + '" aria-label="' + esc(T(isL ? 'Not a leader' : 'Make leader') + ': ' + H.name(p)) + '" title="' + esc(T(isL ? 'Not a leader' : 'Make leader')) + '">' + H.icon(STAR, 16) + '</button>' +
              '<button class="icon-btn ghost" data-act="messages:out" data-g="' + esc(g.id) + '" data-id="' + esc(p.id) + '" aria-label="' + esc(T('Take {name} out', { name: H.name(p) })) + '" title="' + esc(T('Take out of the group')) + '">' + H.icon(H.ICON.x, 16) + '</button></div>';
          }).join('') + '</div>' : '<p class="muted">' + T('No one yet.') + '</p>') +
          (finder ? '<div style="margin-top:10px">' + finder('m-' + g.id, adults(g.memberIds || []), 'messages:add', { g: g.id }, null, T('Add someone: type part of their name')) + '</div>' : '') + '</section>';
      }).join('') + '</div>' : '<p class="empty">' + T('No message groups yet.') + '</p>');
  }
  function saveGroup(g, why) { S.put('msgGroups', g, why); H.render(); }

  H.register({
    id: 'messages', name: 'Messages', desc: 'Messages from the church to you and your groups', icon: BUBBLE, tint: '#2F6FB0',
    render: function (p) {
      if (p[0] === 'send') return renderSend(p[1] ? p[1] + (p[2] ? '/' + p[2] : '') : '');
      if (p[0] === 'sent') return renderSent();
      if (p[0] === 'groups') return renderGroups();
      return renderInbox();
    },
    after: function (p) {
      if (p[0] === 'send') wireSend();
      else if (!p[0]) setTimeout(markShown, 300);
    },
    badge: function () { return unreadCount(); },
    stat: function () { var n = unreadCount(); return n ? TN('{n} new message', '{n} new messages', n) : T('Messages from the church to you and your groups'); },
    todos: function () { var n = unreadCount(); return n ? [{ text: TN('{n} new message', '{n} new messages', n), href: '#/messages', tag: 'Messages' }] : []; },
    actions: {
      send: function () {
        var a = audiences().filter(function (x) { return key(x) === (document.getElementById('ms-to') || {}).value; })[0], e = document.getElementById('ms-err');
        var title = document.getElementById('ms-title').value, body = document.getElementById('ms-body').value;
        var m = a ? Msg.make(a, title, body, me(), data(), picking(a) ? ticked() : null) : { error: 'nobody' };
        if (m.error) {
          e.textContent = m.error === 'empty' ? T('Write the message first.') : m.error === 'long' ? T('The message is too long – please shorten it.') : m.error === 'none' ? T('Tick who should get it.') : T('There is no one in that group yet.');
          e.hidden = false; return;
        }
        var n = m.to.filter(function (x) { return x !== m.fromId; }).length;
        H.modal(H.dialogHead(T('Send this message?'), m.kind === 'people' ? audLong(m) : audName(a.kind, a.name)) + '<div class="dlg-body"><p>' + esc(TN('It goes to {n} person.', 'It goes to {n} people.', n)) + '</p>' +
          (m.title ? '<p><b>' + esc(m.title) + '</b></p>' : '') + '<p class="msg-body">' + bodyHtml(m.body) + '</p></div>' +
          '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn primary" data-act="messages:sendnow">' + T('Send') + '</button></div>', T('Send this message?'));
        pending = m;
      },
      sendnow: function () {
        var m = pending; if (!m) return; pending = null;
        S.put('messages', m, 'Sent a message to ' + (m.kind === 'people' ? 'chosen people' : (m.some ? 'some of ' : '') + (m.kind === 'staff' ? 'the staff' : m.kind === 'partners' ? 'the Church Partners' : m.audience)) + ' (' + m.to.length + (m.to.length === 1 ? ' person)' : ' people)'));
        draft = { to: draft.to, title: '', body: '', some: false, chosen: {} };
        H.closeModal(); H.toast(T('Message sent')); H.go('messages/sent');
      },
      tick: function (el) {   // Tick all / Untick all – the people shown (after typing part of a name, only those)
        Array.prototype.forEach.call(document.querySelectorAll('.ms-row'), function (r) {
          if (r.hidden) return; var c = r.querySelector('.ms-pick'); c.checked = !!el.dataset.on; draft.chosen[c.value] = c.checked;
        });
        showReach();
      },
      del: function (el) {
        var m = S.get('messages', el.dataset.id); if (!m || !Msg.mayDelete(m, who()) || !H.confirmBtn(el, '✕?')) return;
        S.remove('messages', m.id, 'Deleted a message sent to ' + (m.audience || m.kind)); H.render(); H.toast(T('Message deleted'));
      },
      addgroup: function () {
        var n = document.getElementById('mg-new').value.trim(); if (!n) { H.toast(T('Give the group a name'), true); return; }
        if (S.list('msgGroups').some(function (g) { return String(g.name).toLowerCase() === n.toLowerCase(); })) { H.toast(T('There is already a group with that name'), true); return; }
        saveGroup({ name: n, memberIds: [], leaderIds: [] }, 'Added the message group ' + n); H.toast(T('Message group added'));
      },
      rename: function (el) {
        var g = S.get('msgGroups', el.dataset.id); if (!g) return;
        H.modal(H.dialogHead(T('Rename {name}', { name: g.name })) + '<div class="dlg-body"><label class="field req">' + T('Name') + '<input id="mg-name" value="' + esc(g.name) + '"></label></div>' +
          '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn save" data-act="messages:saverename" data-id="' + esc(g.id) + '">' + T('Save') + '</button></div>', T('Rename'));
      },
      saverename: function (el) {
        var g = JSON.parse(JSON.stringify(S.get('msgGroups', el.dataset.id) || null)), n = document.getElementById('mg-name').value.trim(); if (!g || !n) return;
        var was = g.name; g.name = n; H.closeModal(); saveGroup(g, 'Renamed the message group ' + was + ' to ' + n);
      },
      delgroup: function (el) {
        var g = S.get('msgGroups', el.dataset.id); if (!g || !H.confirmBtn(el, '✕?')) return;
        S.remove('msgGroups', g.id, 'Deleted the message group ' + g.name + ' (' + (g.memberIds || []).length + ' people)'); H.render(); H.toast(T('Message group deleted'));
      },
      add: function (el) {
        var g = S.get('msgGroups', el.dataset.g), p = S.get('people', el.dataset.id); if (!g || !p) return;
        var x = Msg.placeIn(g, p.id, false, Msg.nameOf(p)); if (x) saveGroup(x, 'Added ' + H.name(p) + ' to the message group ' + g.name);
        H.toast(T('{name} added to the group', { name: H.name(p) }));
        var again = document.querySelector('.cg-q[data-for="m-' + g.id + '"]'); if (again) again.focus();
      },
      lead: function (el) {
        var g = S.get('msgGroups', el.dataset.g), p = S.get('people', el.dataset.id); if (!g || !p) return;
        var x = Msg.placeIn(g, p.id, !Msg.leads(g, p.id), Msg.nameOf(p)); if (x) saveGroup(x, (Msg.leads(x, p.id) ? 'Made ' : 'No longer ') + H.name(p) + ' a leader of the message group ' + g.name);
      },
      out: function (el) {
        var g = S.get('msgGroups', el.dataset.g); if (!g) return;
        var p = S.get('people', el.dataset.id), x = Msg.takeOut(g, el.dataset.id); if (x) saveGroup(x, 'Took ' + (p ? H.name(p) : 'someone') + ' out of the message group ' + g.name);
        H.toast(T('Taken out of the group'));
      }
    }
  });
})();
