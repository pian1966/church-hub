/* Church Hub – Messages: the church office, Pastors, carers and group leaders send messages to a care group, a message
 * group (e.g. Worship team leaders), the staff, every Church Partner or the Office; everyone reads theirs here, on a phone or a computer.
 * Rules (who goes in which audience, who may send, unread): js/messages.js. Data: messages, msgGroups (see that file). */
(function () {
  'use strict';
  var H = Hub, esc = H.esc, S = Store, T = I18n.t, TN = I18n.tn;
  var BUBBLE = 'M4 5h16v11H9l-5 4z';
  var STAR = 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z';

  function me() { return H.user(); }
  function manager() { var u = me(); return H.can('*') || H.can('people.edit') || !!(u && u.appRole === 'pastor'); }   // Administrators and Pastors
  /** Who is writing: Administrators and Pastors (manager), and attendees with what Settings → Attendees lets them do. */
  function who() { var u = me(); return { id: u ? u.id : '', manager: manager(), attendee: H.attendee(), can: Msg.attendeeCan(S.settings()) }; }
  /** Care groups and life groups only while switched on (Settings → Apps). */
  function data() { return { ministers: S.ministers(), people: S.list('people'), careGroups: H.isOn('care') ? S.list('careGroups') : [], lifeGroups: H.isOn('life') ? S.list('lifeGroups') : [], msgGroups: S.list('msgGroups'), leaderBodies: H.isOn('leaders') ? S.list('leaderBodies') : [] }; }
  function audiences() { return Msg.audiences(who(), data()); }
  function key(a) { return a.kind === 'direct' ? 'direct/' + a.personId + (a.groupId ? '/' + a.groupId : '') : a.kind + (a.groupId ? '/' + a.groupId : ''); }
  /** The audience's name as shown: Staff and Church Partners in the chosen language, groups as they are called. */
  function audName(kind, name) { return kind === 'direct' ? name || T('Someone') : kind === 'office' ? T('Office') : kind === 'staff' ? T('Staff') : kind === 'partners' ? T('Church Partners') : kind === 'people' ? name || T('Chosen people') : name || ''; }
  /** Who it went to, as shown: "Care group · Hilton", "Staff · 3 people" (only some of them), "Thandi Mokoena", "4 people". */
  function audLong(m) {
    var n = (m.to || []).length;
    if (m.kind === 'people') return m.audience ? esc(m.audience) : esc(TN('{n} person', '{n} people', n));
    if (m.kind === 'direct') { var u = me(); return u && (m.to || []).indexOf(u.id) >= 0 ? T('you') : esc(m.audience || T('Someone')); }
    if (m.kind === 'roster') {
      var v = me(); if (v && (m.to || []).indexOf(v.id) >= 0) return T('you');
      if (m.roster === 'declined') return T('the roster team');
      var p = S.get('people', (m.to || [])[0]); return p ? esc(H.name(p)) : esc(TN('{n} person', '{n} people', n));
    }
    var base = m.kind === 'care' ? T('Care Group') + ' · ' + esc(m.audience) : m.kind === 'life' ? T('Midweek Group') + ' · ' + esc(m.audience) : m.kind === 'leaders' ? T('Leadership') + ' · ' + esc(m.audience) : m.kind === 'group' ? esc(m.audience) : esc(audName(m.kind));
    return base + (m.some ? ' · ' + esc(TN('{n} person', '{n} people', n)) : '');
  }
  function unreadCount() { var u = me(); return u ? Msg.unread(S.list('messages'), u.id, manager()).length : 0; }
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
    if (audiences().length) t.push(['send', T('Write')], ['sent', manager() ? T('All messages') : T('Sent')]);
    if (manager()) t.push(['groups', T('Groups')]);
    if (t.length < 2) return '';
    return '<nav class="seg me-tabs" aria-label="' + esc(T('Messages')) + '">' + t.map(function (x) {
      var on = x[0] === active, n = x[0] === '' ? unreadCount() : 0;
      return '<a href="#/messages' + (x[0] ? '/' + x[0] : '') + '" class="' + (on ? 'on' : '') + '"' + (on ? ' aria-current="page"' : '') + '>' + esc(x[1]) + (n ? ' (' + n + ')' : '') + '</a>';
    }).join('') + '</nav>';
  }
  function head(lead, active) { return '<div class="page-head"><div><h1>' + T('Messages') + '</h1><p class="lead">' + lead + '</p></div></div>' + tabs(active); }

  /** A reply shows a line of what it answers ("Replying to: Sunday – Please bring…"), when that message is still here. */
  function replyContext(m) {
    if (!m.replyTo) return '';
    var o = S.get('messages', m.replyTo); if (!o) return '<p class="msg-re muted small">' + T('A reply') + '</p>';
    var bit = String(o.body || '').replace(/\s+/g, ' ').slice(0, 80) + (String(o.body || '').length > 80 ? '…' : '');
    return '<p class="msg-re muted small">' + T('Replying to: {text}', { text: esc((o.title ? o.title + ' – ' : '') + bit) }) + '</p>';
  }
  /** Reply privately to a message's sender: a small window with the message and a box to write in. */
  function replyDialog(m) {
    H.modal(H.dialogHead(T('Reply to {name}', { name: esc(m.fromName || T('Someone')) }), T('Only {name} will see your reply.', { name: esc(m.fromName || T('Someone')) })) +
      '<div class="dlg-body"><blockquote class="msg-quote">' + (m.title ? '<b>' + esc(m.title) + '</b><br>' : '') + bodyHtml(String(m.body || '').slice(0, 400)) + (String(m.body || '').length > 400 ? '…' : '') + '</blockquote>' +
      '<label class="field req">' + T('Your reply') + '<textarea id="ms-reply" rows="5" maxlength="' + Msg.MAX_BODY + '"></textarea></label>' +
      '<p id="ms-rerr" class="note bad" hidden></p>' +
      '<p class="hint">' + T('Please don’t put private or medical details in a message to a group.') + '</p></div>' +
      '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn primary" data-act="messages:replysend" data-id="' + esc(m.id) + '">' + H.icon(BUBBLE, 16) + T('Send') + '</button></div>', T('Reply'));
    var box = document.getElementById('ms-reply'); if (box) box.focus();
  }

  /* ---------- Inbox: messages sent to me ---------- */
  var justRead = {};   // opened on this visit: still marked as new until the page is left, so people see what came in
  if (typeof window !== 'undefined') window.addEventListener('hashchange', function () { if (!/^#\/messages\/?$/.test(location.hash)) justRead = {}; });
  function renderInbox() {
    var u = me(), list = Msg.inbox(S.list('messages'), u.id, manager());
    var html = head(T('Messages from the church to you and the groups you are in.'), '');
    if (!list.length) return html + '<p class="empty">' + T('No messages yet. Messages from the church office, your Care Group and other groups you are in will appear here.') + '</p>';
    // As on WhatsApp: messages that came in are bubbles on the left; new ones are bold with a dot, under an "unread" marker
    var fresh = list.filter(function (m) { return Msg.isUnread(m, u.id, manager()) || justRead[m.id]; }).length;
    return html + '<section class="msg-chat">' + (fresh ? '<div class="msg-unread-bar">' + esc(TN('{n} unread message', '{n} unread messages', fresh)) + '</div>' : '') + list.map(function (m) {
      var isNew = Msg.isUnread(m, u.id, manager()) || justRead[m.id];
      var reply = Msg.mayReply(m, who(), data()) ? '<button class="btn small" data-act="messages:reply" data-id="' + esc(m.id) + '">' + T('Reply') + '</button>' : '';
      var roster = m.kind === 'roster' ? rosterPart(m) : '';
      return '<article class="msg in' + (isNew ? ' new' : '') + '" data-id="' + esc(m.id) + '"><div class="msg-top"><b>' + esc(roster ? rosterTitle(m) : m.title || audName(m.kind, m.audience)) + '</b></div>' +
        '<div class="msg-who">' + T('From {name}', { name: esc(m.fromName || T('Someone')) }) + ' · ' + T('To {who}', { who: audLong(m) }) + '</div>' +
        replyContext(m) + (roster || '<p class="msg-body">' + bodyHtml(m.body) + '</p>') + '<div class="msg-foot">' + reply + '<span class="msg-time">' + esc(when(m.createdAt)) + '</span></div></article>';
    }).join('') + '</section>';
  }
  /* ---------- Roster messages (sent by Rosters: js/mod-rosters.js) ---------- */
  /** The heading, in the reader's language. */
  function rosterTitle(m) {
    return m.roster === 'remind' ? T('Reminder: please reply about serving') : m.roster === 'declined' ? T('{name} can’t make it', { name: m.fromName || T('Someone') }) : T('You’re on the roster');
  }
  /** The turns it is about, in the reader's language: the volunteer accepts or says they can't make it right here; the
   *  roster team opens the roster. '' when none of the turns can be shown any more (the message's own words are shown). */
  function rosterPart(m) {
    var u = me(), t = H.today(), team = m.roster === 'declined';
    var rows = (m.turns || []).map(function (id) {
      var a = S.get('assignments', id), sv = a && S.get('services', a.serviceId), po = a && S.get('positions', a.positionId);
      if (!sv || !po) return '';
      var line = '<span class="grow"><b>' + esc(po.name) + '</b><small>' + esc(H.fmt(sv.date, true) + ', ' + sv.time + ' · ' + sv.name) + '</small></span>';
      if (team) return '<div class="item">' + line + '<span class="tag ' + (a.status === 'declined' ? 'grey' : 'ok') + '">' + esc(T(a.status === 'declined' ? 'Said no' : a.status === 'accepted' ? 'Accepted' : 'Waiting')) + '</span></div>';
      if (!u || a.personId !== u.id) return '';
      var act = a.status === 'pending' && sv.date >= t ? '<button class="btn small" data-act="rosters:reply" data-id="' + esc(a.id) + '" data-s="declined">' + T('Can’t make it') + '</button><button class="btn small ok" data-act="rosters:reply" data-id="' + esc(a.id) + '" data-s="accepted">' + T('Accept') + '</button>'
        : '<span class="tag ' + (a.status === 'accepted' ? 'ok' : 'grey') + '">' + esc(T(a.status === 'accepted' ? 'Accepted' : a.status === 'declined' ? 'Said no' : 'Waiting')) + '</span>';
      return '<div class="item">' + line + act + '</div>';
    }).filter(Boolean);
    if (!rows.length) return '';
    var lead = team ? T('{name} can’t serve:', { name: m.fromName || T('Someone') }) : m.roster === 'remind' ? T('You haven’t replied yet. Please accept or say you can’t make it:') : T('You’ve been asked to serve. Please accept or say you can’t make it:');
    return '<p class="msg-body">' + esc(lead) + '</p><div class="list msg-turns">' + rows.join('') + '</div>' +
      (team ? '<p style="margin:8px 0 0"><a class="btn small" href="#/rosters">' + T('Open the roster') + '</a></p>' : '');
  }

  /** Opening the inbox marks what is shown as read (on every device; the sender sees how many have read it). */
  function markShown() {
    if (typeof document !== 'undefined' && document.hidden) return;   // the app is in the background: not seen yet (see below)
    if (!/^#\/messages\/?$/.test(location.hash)) return;
    var u = me(); if (!u) return;
    var ids = Msg.unread(S.list('messages'), u.id, manager()).map(function (m) { return m.id; });
    if (!ids.length) return;
    ids.forEach(function (id) { justRead[id] = 1; });
    S.markRead(ids, u.id);
    Array.prototype.forEach.call(document.querySelectorAll('a[href="#/messages"] .badge'), function (b) { b.remove(); });   // the counts on the menu
  }

  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', function () { if (!document.hidden) markShown(); });

  var deliveryQueued = false;
  function markDeliveredAvailable() {
    var u = me(); if (!u) return;
    var ids = S.list('messages').filter(function (m) {
      var intended = (m.to || []).indexOf(u.id) >= 0 || (manager() && m.kind === 'office' && m.fromId !== u.id);
      return intended && (m.deliveredBy || []).indexOf(u.id) < 0;
    }).map(function (m) { return m.id; });
    if (ids.length) S.markDelivered(ids, u.id);
  }
  S.onChange(function () {
    if (deliveryQueued) return;
    deliveryQueued = true;
    setTimeout(function () { deliveryQueued = false; markDeliveredAvailable(); }, 0);
  });

  /* ---------- Write a message ---------- */
  // What is being written (kept while the page is redrawn): who to, and – for "Chosen people" or "Only some of them" – who is
  // ticked. pending: the message waiting for "Send" in the confirmation dialog.
  var draft = { to: '', title: '', body: '', some: false, chosen: {} }, pending = null;
  function picking(a) { return a.kind === 'people' || draft.some; }
  function ticked() { return Object.keys(draft.chosen).filter(function (id) { return draft.chosen[id]; }); }
  /** A person's name for the checklist: from their record, or the name the group keeps (carers and leaders who aren't staff). */
  function personName(id, a) {
    var p = S.get('people', id); if (p) return H.name(p);
    var g = a.kind === 'care' ? S.get('careGroups', a.groupId) : a.kind === 'life' || (a.kind === 'direct' && a.groupId) ? S.get('lifeGroups', a.groupId) : a.kind === 'group' ? S.get('msgGroups', a.groupId) : a.kind === 'leaders' ? S.get('leaderBodies', a.groupId) : null;
    return (g && g.names && g.names[id]) || T('Someone');
  }
  function reach(a) {
    if (a.kind === 'office') return T('Sent to the Office; office staff can read it and reply.');
    if (a.kind === 'direct') return T('Only {name} will see it.', { name: a.name || personName(a.personId, a) });
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
    if (!as.length) return head(T('Messages from the church to you and the groups you are in.'), 'send') + '<p class="empty">' + T('You can read the messages the church sends you here.') + '</p>';
    var pp = /^people\/(.+)$/.exec(pre || '');   // #/messages/send/people/<personId>: a message to that one person
    if (pp && as.some(function (a) { return a.kind === 'people'; })) { draft.to = 'people'; draft.chosen = {}; draft.chosen[pp[1]] = true; draft.some = false; }
    else if (pre && as.some(function (a) { return key(a) === pre; }) && pre !== draft.to) { draft.to = pre; draft.chosen = {}; draft.some = false; }
    var cur = as.filter(function (a) { return key(a) === draft.to; })[0] || as[0]; draft.to = key(cur);
    return head(T('Send a message to a group or the Office. Office staff can read messages to the Office and reply.'), 'send') +
      '<section class="panel">' + H.reqKey() + '<div class="field req">' + T('To') + toButton(cur) + '<input type="hidden" id="ms-to" value="' + esc(key(cur)) + '"></div><p class="hint" id="ms-reach" style="margin:-6px 0 16px">' + esc(reach(cur)) + '</p>' + checklist(cur) +
      '<label class="field">' + T('Subject') + '<input id="ms-title" maxlength="' + Msg.MAX_TITLE + '" value="' + esc(draft.title) + '" placeholder="' + esc(T('e.g. No meeting this Tuesday')) + '"></label>' +
      '<label class="field req">' + T('Message') + '<textarea id="ms-body" maxlength="' + Msg.MAX_BODY + '">' + esc(draft.body) + '</textarea></label>' +
      '<p id="ms-err" class="note bad" hidden></p>' +
      '<div class="btns"><button class="btn primary" data-act="messages:send">' + H.icon(BUBBLE, 16) + T('Send') + '</button></div></section>' +
      '<p class="hint">' + T('Please don’t put private or medical details in a message to a group.') + '</p>';
  }
  /* "Who is this for?": the choices as big cards (the Office, chosen people, the staff, the Church Partners) and short
   * lists with coloured initials (ministers, leaders, each kind of group), each saying how many people it reaches. */
  var AUD_ICON = { office: 'M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 10h.01M15 10h.01', people: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c.6-3.6 3.4-6 7-6s6.4 2.4 7 6M16 3.5a4 4 0 0 1 0 7.5M19 14c1.8.8 2.8 3 3 7',
    staff: 'M3 7h18v13H3zM9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2', partners: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z' };
  var TINTS = [['#E3ECF7', '#2D5A8C'], ['#F6E3E0', '#9A3B2E'], ['#EDE6F5', '#5B3F86'], ['#E2F1EA', '#1F6B4A'], ['#F5ECD9', '#7A5300'], ['#E0EEF0', '#1F5F66'], ['#F7E4EE', '#8C2D5E']];
  function tint(s) { var h = 0; String(s || '').split('').forEach(function (c) { h = (h * 31 + c.charCodeAt(0)) % 997; }); return TINTS[h % TINTS.length]; }
  function initials(s) { var w = String(s || '?').replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/); return ((w[0] || '?').charAt(0) + (w.length > 1 ? w[w.length - 1].charAt(0) : '')).toUpperCase(); }
  function audLabel(a) { return audName(a.kind, a.kind === 'direct' ? a.name || personName(a.personId, a) : a.name); }
  function audSub(a) {
    if (a.kind === 'office') return T('Office staff read it and can reply');
    if (a.kind === 'people') return T('You tick who gets it');
    if (a.kind === 'direct') return a.group || '';
    var n = Msg.recipients(a.kind, a.groupId, data()).length;   // the same count as "Goes to …" under the To box
    return TN('{n} person', '{n} people', n);
  }
  function badge(a, size) {
    if (AUD_ICON[a.kind]) return '<span class="ms-ico k-' + a.kind + '" style="width:' + size + 'px;height:' + size + 'px">' + H.icon(AUD_ICON[a.kind], Math.round(size * 0.55)) + '</span>';
    var t = tint(audLabel(a));
    return '<span class="ms-ini" style="width:' + size + 'px;height:' + size + 'px;background:' + t[0] + ';color:' + t[1] + '" aria-hidden="true">' + esc(initials(audLabel(a))) + '</span>';
  }
  function toButton(a) {
    return '<button type="button" class="ms-to" id="ms-to-btn" data-act="messages:choose" aria-haspopup="dialog">' + badge(a, 36) +
      '<span class="grow"><b>' + esc(audLabel(a)) + '</b><small>' + esc(audSub(a)) + '</small></span><span class="ms-to-change">' + T('Change') + '</span></button>';
  }
  /** The choices in order: big cards first, then the lists under their headings. */
  function audSections() {
    var as = audiences(), of = function (k) { return as.filter(function (a) { return a.kind === k; }); };
    var direct = of('direct'), byGroup = function (g) { return direct.filter(function (a) { return !!a.groupId === g; }); };
    return [['', of('office').concat(of('people'), of('staff'), of('partners'))], [T('Ministers'), byGroup(false)], [T('Midweek Group leaders'), byGroup(true)], [T('Care Groups'), of('care')],
      [T('Midweek Groups'), of('life')], [T('Leadership'), of('leaders')], [T('Message groups'), of('group')]].filter(function (g) { return g[1].length; });
  }
  function chooser() {
    var secs = audSections(), all = secs.reduce(function (n, g) { return n + g[1].length; }, 0);
    var tick = '<span class="ms-tick" aria-hidden="true">' + H.icon(H.ICON.check, 14) + '</span>';
    var html = H.dialogHead(T('Who is this for?')) + '<div class="dlg-body ms-choose">' +
      (all > 4 ? '<label class="ms-find-to">' + H.icon(H.ICON.search, 18) + '<input id="ms-aud-find" type="search" autocomplete="off" placeholder="' + esc(T('Search a name or group')) + '" aria-label="' + esc(T('Search a name or group')) + '"></label>' : '') +
      secs.map(function (g) {
        var on = function (a) { return key(a) === draft.to; };
        var attrs = function (a) { return ' data-act="messages:pickto" data-key="' + esc(key(a)) + '" data-name="' + esc((audLabel(a) + ' ' + (a.group || '')).toLowerCase()) + '" aria-pressed="' + on(a) + '"'; };
        if (!g[0]) return '<div class="ms-cards">' + g[1].map(function (a) {
          return '<button type="button" class="ms-aud ms-card' + (on(a) ? ' on' : '') + '"' + attrs(a) + '>' + badge(a, 38) + '<b>' + esc(audLabel(a)) + '</b><small>' + esc(audSub(a)) + '</small>' + tick + '</button>';
        }).join('') + '</div>';
        return '<section class="ms-sec"><h3>' + esc(g[0]) + ' <span>' + g[1].length + '</span></h3><div class="ms-rows">' + g[1].map(function (a) {
          var sub = audSub(a);
          return '<button type="button" class="ms-aud ms-rowbtn' + (on(a) ? ' on' : '') + '"' + attrs(a) + '>' + badge(a, 36) + '<span class="grow"><b>' + esc(audLabel(a)) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span>' + tick + '</button>';
        }).join('') + '</div></section>';
      }).join('') + '<p class="empty" id="ms-aud-none" hidden>' + T('Nothing matches that.') + '</p></div>';
    H.modal(html, T('Who is this for?'));
    var find = document.getElementById('ms-aud-find');
    if (find) find.addEventListener('input', H.pause(function () {
      var any = false;
      Array.prototype.forEach.call(document.querySelectorAll('.ms-choose .ms-aud'), function (b) { b.hidden = !H.matches(b.dataset.name, find.value); if (!b.hidden) any = true; });
      Array.prototype.forEach.call(document.querySelectorAll('.ms-choose .ms-sec, .ms-choose .ms-cards'), function (s) { s.hidden = !s.querySelector('.ms-aud:not([hidden])'); });
      document.getElementById('ms-aud-none').hidden = any;
    }, 150));
  }
  /** Ticking who gets it: everyone who may be chosen ("Chosen people"), or a group's people after "Only some of them". */
  function checklist(a) {
    if (a.kind === 'direct') return '';
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
  /** "Read by 3 of 5", opening to who has read it and who hasn't yet. */
  /** "Message info", as on WhatsApp: read by, delivered to, and not delivered yet (they haven't opened Church Hub since). */
  function readBy(m, s) {
    if (m.kind === 'office') return '';
    var r = Msg.readers(m), c = Msg.counts(m), a = { kind: m.kind, groupId: m.groupId }, names = function (ids) { return ids.map(function (id) { return personName(id, a); }).sort(function (x, y) { return x.localeCompare(y); }); };
    if (!s.of) return T('Read by {n} of {total}', { n: s.n, total: s.of });
    var got = r.unread.filter(function (id) { return c.waiting.indexOf(id) < 0; });
    var list = function (title, ids, cls) { return ids.length ? '<p class="small" style="margin:6px 0 0"><b>' + esc(title) + '</b> ' + names(ids).map(function (n) { return '<span class="tag ' + cls + '">' + esc(n) + '</span>'; }).join(' ') + '</p>' : ''; };
    return '<details class="msg-read"><summary>' + T('Read by {n} of {total}', { n: s.n, total: s.of }) + '</summary>' +
      list(T('Read'), r.read, 'ok') + list(T('Delivered'), got, 'grey') + list(T('Not delivered yet'), c.waiting, 'grey') + '</details>';
  }
  var TICK = 'M2.5 8.5l3.2 3.2L13 4.4', TICK1 = 'M1 8.5l3.2 3.2L11.5 4.4', TICK2 = 'M7.2 11.2l.5.5L15 4.4';
  var STATE_WORDS = { sent: 'Sent', delivered: 'Delivered', some: 'Read by some', read: 'Read' };
  /** The style chosen on this device (Sent → What the signs mean), otherwise what the church's country is used to. */
  function markStyle() { return Msg.markStyle((S.settings() || {}).country, S.pref('msgMarks')); }
  function svg(w, h, vb, inner, extra) { return '<svg width="' + w + '" height="' + h + '" viewBox="' + vb + '" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (extra || '') + '>' + inner + '</svg>'; }
  /** The drawing for a state in a style. frac: the share of people who have read it (the circle fills up with it). */
  function drawing(state, style, frac) {
    var GREY = 'var(--tick-grey)', BLUE = 'var(--tick-blue)';
    if (style === 'words') return '<span class="msg-word">' + esc(T(STATE_WORDS[state])) + '</span>';
    if (style === 'post') {   // on its way (speed lines) · arrived (closed envelope) · opened by some (grey, blue dot) · opened by everyone (blue)
      var shut = '<rect x="4.5" y="2.5" width="12.5" height="9.5" rx="1.2"/><path d="M4.8 3.2l6 4.6 6-4.6"/>';
      var open = '<path d="M4.5 6.2v6.3h12.5V6.2"/><path d="M4.5 6.2l6.25 4.5 6.25-4.5"/>';
      var flap = '<path d="M4.5 6.2l6.25-4.6 6.25 4.6"/>';
      if (state === 'sent') return svg(19, 14, '0 0 18 14', '<g stroke="' + GREY + '">' + shut + '<path d="M.8 5h2M.8 8.5h2"/></g>');
      if (state === 'delivered') return svg(19, 14, '0 0 18 14', '<g stroke="' + GREY + '">' + shut + '</g>');
      return svg(19, 14, '0 0 18 14', '<g stroke="' + (state === 'read' ? BLUE : GREY) + '">' + open + flap + '</g>' + (state === 'some' ? '<circle cx="15.8" cy="2.6" r="2.2" fill="' + BLUE + '" stroke="none"/>' : ''));
    }
    if (style === 'circle') {   // a dotted ring · a ring · a ring filling up as people read · a full circle with a tick
      if (state === 'sent') return svg(14, 14, '0 0 14 14', '<circle cx="7" cy="7" r="5.5" stroke="' + GREY + '" stroke-dasharray="2 2.3"/>');
      if (state === 'read') return svg(14, 14, '0 0 14 14', '<circle cx="7" cy="7" r="6.2" fill="' + BLUE + '" stroke="none"/><path d="M4.2 7.2l1.9 1.9 3.7-3.9" stroke="#fff"/>');
      var ring = '<circle cx="7" cy="7" r="5.5" stroke="' + GREY + '"/>';
      if (state === 'delivered') return svg(14, 14, '0 0 14 14', ring);
      var f = Math.min(Math.max(frac || 0.5, 0.08), 0.92), a = f * 2 * Math.PI, x = (7 + 5.5 * Math.sin(a)).toFixed(2), y = (7 - 5.5 * Math.cos(a)).toFixed(2);
      return svg(14, 14, '0 0 14 14', ring + '<path d="M7 7V1.5A5.5 5.5 0 0 1 ' + (f > 0.5 ? '7 12.5A5.5 5.5 0 0 1 ' : '') + x + ' ' + y + 'Z" fill="' + BLUE + '" stroke="none"/>');
    }
    // Ticks, as on WhatsApp – with the first tick blue once some (not yet everyone) have read it
    if (state === 'sent') return svg(17, 13, '0 0 16 13', '<path d="' + TICK + '" stroke="' + GREY + '"/>');
    return svg(17, 13, '0 0 16 13', '<path d="' + TICK1 + '" stroke="' + (state === 'delivered' ? GREY : BLUE) + '"/><path d="' + TICK2 + '" stroke="' + (state === 'read' ? BLUE : GREY) + '"/>');
  }
  /** One grey tick: sent · two grey ticks: delivered to everyone · first tick blue: read by some · two blue ticks: read by everyone. */
  function statusMark(m) {
    var state = Msg.status(m, S.list('people')), text = T(STATE_WORDS[state]), c = Msg.counts(m, S.list('people'));
    // A button: tapping it shows what the sign means for a few seconds (a phone has no hover for the title)
    return '<button type="button" class="msg-status ' + state + '" data-act="messages:mark" data-state="' + state + '" aria-label="' + esc(text) + '" title="' + esc(text) + '">' + drawing(state, markStyle(), c.of ? c.read / c.of : 0) + '</button>';
  }
  /** Tapping a sign: a small bubble above it says what it means, then goes away by itself. */
  var markTimer = null;
  function showMark(el) {
    var old = document.querySelector('.msg-mark-tip'); if (old) old.remove();
    clearTimeout(markTimer);
    if (old && old._for === el) return;   // tapping the same sign again just closes it
    var mean = MEANINGS.filter(function (x) { return x[0] === el.dataset.state; })[0]; if (!mean) return;
    var tip = document.createElement('span');
    tip.className = 'msg-mark-tip'; tip.setAttribute('role', 'status'); tip.textContent = T(mean[1]); tip._for = el;
    el.parentNode.appendChild(tip);
    markTimer = setTimeout(function () { tip.remove(); }, 4000);
  }
  /** What the signs mean, folded under the tabs of Sent, with a choice of how they are drawn (kept on this device):
   *  four picture cards showing each style's steps, what it does, and which apps and countries use it. */
  var STYLES = [
    ['ticks', 'Ticks', 'Grey ticks turn blue as people read it', 'Like WhatsApp · used worldwide'],
    ['post', 'Envelopes', 'The envelope opens when it’s read', 'Like the post'],
    ['circle', 'Circles', 'The circle fills up as people read it', 'Like DingTalk · China'],
    ['words', 'Words', 'Says it in words: Sent, Delivered, Read', 'Like iMessage on iPhone, LINE (Japan, Thailand, Taiwan) and QQ (China)']];
  var MEANINGS = [['sent', 'Sent: on its way. Not everyone has opened Church Hub since.'], ['delivered', 'Delivered: it has reached everyone, but no one has read it yet.'],
    ['some', 'Read by some: it has reached everyone, and some have read it.'], ['read', 'Read: everyone has read it.']];
  function styleCard(x, chosen) {
    var steps = x[0] === 'words' ? ['sent', 'read'] : ['sent', 'delivered', 'some', 'read'];
    return '<label class="msg-style' + (chosen ? ' on' : '') + '" data-style="' + x[0] + '"><input type="radio" class="sr-only" name="ms-marks" value="' + x[0] + '"' + (chosen ? ' checked' : '') + '>' +
      (chosen ? '<span class="msg-style-tick" aria-hidden="true">' + svg(12, 12, '0 0 16 13', '<path d="' + TICK + '" stroke="#fff" stroke-width="2.4"/>') + '</span>' : '') +
      '<b>' + esc(T(x[1])) + '</b><span class="msg-style-steps" aria-hidden="true">' + steps.map(function (st) {
        return '<span class="msg-status ' + st + '">' + drawing(st, x[0], 0.5) + '</span>';
      }).join('<span class="msg-style-arrow">›</span>') + '</span><span class="msg-style-what">' + esc(T(x[2])) + '</span><span class="msg-style-like">' + esc(T(x[3])) + '</span></label>';
  }
  function legend() {
    var style = markStyle();
    return '<details class="panel msg-legend"><summary>' + T('What the signs mean') + '</summary><ul class="msg-legend-list">' + MEANINGS.map(function (x) {
      return '<li><span class="msg-status ' + x[0] + '">' + drawing(x[0], style, 0.5) + '</span><span>' + esc(T(x[1])) + '</span></li>';
    }).join('') + '</ul><p class="hint">' + T('A message to the Office counts as read as soon as someone in the office reads it.') + '</p>' +
      '<fieldset class="msg-styles"><legend>' + T('How should the delivery signs look?') + '</legend><div class="msg-style-grid">' +
      STYLES.map(function (x) { return styleCard(x, x[0] === style); }).join('') + '</div></fieldset></details>';
  }
  var legendOpen = false;
  function wireSent() {
    var d = document.querySelector('.msg-legend'); if (!d) return;
    if (legendOpen) d.open = true;
    d.addEventListener('toggle', function () { legendOpen = d.open; });
    Array.prototype.forEach.call(d.querySelectorAll('input[name="ms-marks"]'), function (r) {
      r.addEventListener('change', function () { if (r.checked) { S.pref('msgMarks', r.value); legendOpen = true; H.render(); } });
    });
  }
  function renderSent() {
    var u = me(), all = manager(), list = Msg.sent(S.list('messages'), u.id, all);
    var html = head(all ? T('Every message sent in Church Hub, newest first. You can delete any of them.') : T('Messages you have sent, newest first.'), 'sent');
    if (!list.length) return html + '<p class="empty">' + T('Nothing sent yet.') + '</p>';
    if (list.some(function (m) { return m.fromId === u.id; })) html += legend();   // the signs are only on your own messages
    return html + '<section class="msg-chat">' + list.map(function (m) {
      var s = Msg.seen(m), mine = m.fromId === u.id;
      // Your own messages are bubbles on the right with ticks by the time; others' (Administrators and Pastors see all) on the left
      return '<article class="msg ' + (mine ? 'out' : 'in') + '" data-id="' + esc(m.id) + '"><div class="msg-top"><b>' + esc(m.title || audName(m.kind, m.audience)) + '</b>' +
        (Msg.mayDelete(m, who()) ? H.menu('⋯', ['<button class="menu-danger" data-act="messages:del" data-id="' + esc(m.id) + '">' + H.icon(H.ICON.trash, 16) + T('Delete the message') + '</button>'], 'row-menu', T('Delete the message')) : '') + '</div>' +
        '<div class="msg-who">' + (mine ? '' : T('From {name}', { name: esc(m.fromName || T('Someone')) }) + ' · ') + T('To {who}', { who: audLong(m) }) + '</div>' +
        '<p class="msg-body">' + bodyHtml(m.body) + '</p>' +
        '<div class="msg-foot"><span class="grow">' + (m.kind === 'office' ? '' : readBy(m, s)) + '</span><span class="msg-time">' + esc(when(m.createdAt)) + (mine ? statusMark(m) : '') + '</span></div></article>';
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
    return head(T('Groups you can send messages to, besides Care Groups, the staff and Church Partners – for example Worship team leaders or the Alpha team. Leaders can send messages to their own group.'), 'groups') +
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
      if (p[0] === 'send') return renderSend(p.slice(1).join('/'));
      if (p[0] === 'sent') return renderSent();
      if (p[0] === 'groups') return renderGroups();
      return renderInbox();
    },
    after: function (p) {
      if (p[0] === 'send') wireSend();
      else if (p[0] === 'sent') wireSent();
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
        if (m.kind === 'direct' && !m.audience) m.audience = personName(a.personId, a);
        H.modal(H.dialogHead(T('Send this message?'), m.kind === 'people' || m.kind === 'direct' ? audLong(m) : audName(a.kind, a.name)) + '<div class="dlg-body"><p>' + (m.kind === 'office' ? T('Sent to the Office; office staff can read it and reply.') : m.kind === 'direct' ? esc(T('Only {name} will see it.', { name: m.audience })) : esc(TN('It goes to {n} person.', 'It goes to {n} people.', n))) + '</p>' +
          (m.title ? '<p><b>' + esc(m.title) + '</b></p>' : '') + '<p class="msg-body">' + bodyHtml(m.body) + '</p></div>' +
          '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn primary" data-act="messages:sendnow">' + T('Send') + '</button></div>', T('Send this message?'));
        pending = m;
      },
      sendnow: function () {
        var m = pending; if (!m) return; pending = null;
        var target = m.kind === 'office' ? 'the Office' : m.kind === 'people' ? 'chosen people' : m.kind === 'direct' ? 'one person' : (m.some ? 'some of ' : '') + (m.kind === 'staff' ? 'the staff' : m.kind === 'partners' ? 'the Church Partners' : m.audience);
        S.put('messages', m, 'Sent a message to ' + target + (m.kind === 'office' ? '' : ' (' + m.to.length + (m.to.length === 1 ? ' person)' : ' people)')));
        draft = { to: draft.to, title: '', body: '', some: false, chosen: {} };
        H.closeModal(); H.toast(T('Message sent')); H.go('messages/sent');
      },
      reply: function (el) { var m = S.get('messages', el.dataset.id); if (m && Msg.mayReply(m, who(), data())) replyDialog(m); },
      replysend: function (el) {
        var o = S.get('messages', el.dataset.id), box = document.getElementById('ms-reply'), e = document.getElementById('ms-rerr');
        if (!o || !box || !Msg.mayReply(o, who(), data())) { H.closeModal(); return; }
        var m = Msg.reply(o, box.value, me());
        if (m.error) { e.textContent = m.error === 'empty' ? T('Write the message first.') : m.error === 'long' ? T('The message is too long – please shorten it.') : T('Couldn’t send the reply.'); e.hidden = false; return; }
        S.put('messages', m, 'Replied to a message (to one person)');
        H.closeModal(); H.toast(T('Reply sent')); H.render();
      },
      choose: function () { chooser(); },
      pickto: function (el) {   // a choice in "Who is this for?": it becomes the To, and the page is drawn again
        if (el.dataset.key !== draft.to) { draft.to = el.dataset.key; draft.some = false; draft.chosen = {}; }
        H.closeModal(); H.render();
      },
      mark: function (el) { showMark(el); },   // tapping the ticks (or envelope, circle, words) by a message's time
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
