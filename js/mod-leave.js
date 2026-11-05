/* Church Hub – Leave (Leave Manager built in). Uses LeaveCore, the same rules file as Leave Manager. */
(function () {
  'use strict';
  var T = I18n.t, TN = I18n.tn;
  var TX = function (s) { return s; };   // a text kept as it is and translated where it is shown (the language test checks it)
  TX('day'); TX('days'); TX('calendar day'); TX('calendar days');   // LeaveCore.unitName (shared with Leave Manager, so English there)
  /** "6 days", in the chosen language (LeaveCore.fmtAmount gives English). */
  /** "Mon, Wed–Sun" (LeaveCore, English) with the day names in the chosen language. */
  function dayNames(x) { var D = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; return String(x).replace(/\b(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\b/g, function (d) { return I18n.dow()[D.indexOf(d)]; }); }
  function amt(t, n) { return C.fmtDays(n) + ' ' + T(C.unitName(t, n)); }
  var H = Hub, esc = H.esc, S = Store, S2 = Store, C = LeaveCore;
  var state = { tab: '', away: 'wall', month: '' };

  /** Leave Manager's data shape, with staff taken from People. */
  function data() {
    var lv = S.leave();
    var staff = S.find('people', function (p) { return p.staff && !p.binnedAt; }).map(function (p) {
      return { id: p.id, name: H.name(p), email: p.email, level: p.staff.category, workDays: p.staff.workDays || '', role: p.appRole === 'admin' ? 'Administrator' : 'Staff', start: p.staff.start, active: p.active !== false };
    });
    var d = { settings: lv.settings, rules: lv.rules, terms: lv.terms, types: lv.types, levels: lv.levels, holidays: lv.holidays, adjustments: lv.adjustments, requests: lv.requests, staff: staff };
    C.applyStandIn(d, H.today());   // the stand-in approver, while their dates last
    return d;
  }
  /** I approve leave for the Administrator for now (Approvals → Stand-in approver). */
  function amStandIn(d) { return !!H.user() && C.standInId(d, H.today()) === H.user().id; }
  function actor(d) {
    var a = Object.assign({}, C.staffById(d, H.user().id) || { id: H.user().id, name: H.name(H.user()), role: 'Staff', level: 'Administrator' });
    a.standIn = amStandIn(d);
    if (H.can('leave.manage')) a.role = 'Administrator';
    return a;
  }
  function isLeaveAdmin() { return H.can('leave.manage'); }
  /** A Church Partner (Member access) who isn't on the staff: leave isn't theirs to see. */
  function partner() { return !H.can('*') && !H.can('people.view') && !H.can('people.basic') && !H.can('children'); }
  function takesLeave(d) { var st = C.staffById(d, H.user().id); return st && C.tracksLeave(st); }
  function typeOf(d, code) { return C.type(d, code) || { name: code, colour: '#64748B' }; }
  function pill(st) { return '<span class="tag ' + ({ Approved: 'ok', Pending: 'warn', Declined: 'bad', Cancelled: 'grey' }[st] || 'grey') + '">' + esc(T(st === 'Pending' ? 'Waiting' : st)) + '</span>'; }
  function range(r) { return r.start === r.end ? H.fmt(r.start, true) + (r.half && r.half !== 'None' ? ' ' + T(r.half === 'AM' ? '(morning)' : '(afternoon)') : '') : H.fmt(r.start) + ' – ' + H.fmt(r.end, true); }

  function tabs(d, active) {
    var t = [];
    if (isLeaveAdmin()) t.push(['dashboard', T('Dashboard')]);
    if (takesLeave(d)) t.push(['', T('My leave')]);
    if (isLeaveAdmin() || amStandIn(d)) t.push(['approvals', T('Approvals')]);
    if (isLeaveAdmin()) t.push(['team', T('Team balances')]);
    t.push(['away', T('Who’s away')]);
    if (isLeaveAdmin()) { t.push(['settings', T('Settings')]); t.push(['elvanto', 'Elvanto']); }
    return t.length > 1 ? '<nav class="seg" aria-label="' + esc(T('Leave')) + '" style="margin-bottom:18px">' + t.map(function (x) { return '<a href="#/leave' + (x[0] ? '/' + x[0] : '') + '" class="' + (x[0] === active ? 'on' : '') + '">' + x[1] + '</a>'; }).join('') + '</nav>' : '';
  }

  function renderMine(d) {
    var me = H.user(), y = C.lyOf(H.today(), C.ctx(d).S), st = C.staffById(d, me.id);
    var bal = C.balances(d, me.id, y);
    var cards = d.types.filter(function (t) { return t.deducts && C.offered(d, st, t); }).map(function (t) {
      var b = bal[t.code]; if (!b || b.entitled == null) return '';
      var used = b.entitled - b.available, pct = b.entitled ? Math.max(0, Math.min(100, used / b.entitled * 100)) : 0;
      return '<div class="stat" style="--c:' + esc(t.colour) + '"><span>' + esc(t.name) + '</span><b>' + C.fmtDays(b.available) + '</b><span>' + esc(T('{unit} left of {n}', { unit: T(C.unitName(t, b.available)), n: C.fmtDays(b.entitled) })) + (b.pending ? ' · ' + esc(T('{n} waiting', { n: C.fmtDays(b.pending) })) : '') + '</span><div class="bar"><i style="width:' + pct + '%"></i></div></div>';
    }).join('');
    var mine = d.requests.filter(function (r) { return r.staffId === me.id && r.end >= H.today() && (r.status === 'Pending' || r.status === 'Approved'); }).sort(function (a, b) { return a.start < b.start ? -1 : 1; });
    return '<section class="block"><h2>' + esc(T('What you have left in {year}', { year: C.lyLabel(y, C.ctx(d).S) })) + '</h2><div class="bal">' + cards + '</div></section>' +
      '<section class="block"><h2>' + T('Your upcoming leave') + '</h2>' + (mine.length ? '<div class="list">' + mine.map(function (r) {
        var t = typeOf(d, r.type);
        return '<div class="item"><span class="dot" style="--c:' + esc(t.colour) + '"></span><span class="grow"><b>' + esc(range(r)) + '</b><small>' + esc(t.name + ' · ' + amt(t, C.amount(r, t, C.ctx(d))) + (r.reason ? ' · ' + r.reason : '')) + '</small></span>' + pill(r.status) +
          (!C.editBlock(d, actor(d), r, H.today()) ? '<button class="btn small" data-act="leave:change" data-id="' + r.id + '">' + T('Change') + '</button>' : '') +
          (r.status === 'Pending' || r.start > H.today() ? '<button class="btn small" data-act="leave:cancel" data-id="' + r.id + '">' + T('Cancel') + '</button>' : '') + '</div>';
      }).join('') + '</div>' : '<p class="empty">' + T('No leave booked. Use “Request leave” to book some.') + '</p>') + '</section>' +
      '<section class="block"><h2>' + esc(T('Year planner')) + '</h2>' + LeaveViews.planner(d, me.id, y) + '</section>';
  }

  function renderApprovals(d) {
    var me = H.user().id, pend = d.requests.filter(function (r) { return r.status === 'Pending' && (isLeaveAdmin() || r.staffId !== me); }).sort(function (a, b) { return a.start < b.start ? -1 : 1; });
    return '<section class="block"><h2>' + T('Waiting for your decision') + '</h2>' + (pend.length ? '<div class="list">' + pend.map(function (r) {
      var st = C.staffById(d, r.staffId), t = typeOf(d, r.type), w = st ? C.requestWarnings(d, st, r, r.id, true) : [];
      return '<div class="item" style="align-items:flex-start"><span class="dot" style="--c:' + esc(t.colour) + ';margin-top:6px"></span><span class="grow"><b>' + (st ? '<a href="#/leave/staff/' + st.id + '">' + esc(st.name) + '</a>' : '?') + ' · ' + esc(range(r)) + '</b><small>' + esc(t.name + ' · ' + amt(t, C.amount(r, t, C.ctx(d))) + (r.reason ? ' · “' + r.reason + '”' : '')) + '</small>' +
        (w.length ? '<span class="note warn" style="display:block;margin:8px 0 0;font-size:13px">⚠ ' + w.map(esc).join('<br>⚠ ') + '</span>' : '') + '</span>' +
        '<span class="btns"><button class="btn small" data-act="leave:decide" data-id="' + r.id + '" data-d="Declined">' + T('Decline') + '</button><button class="btn small ok" data-act="leave:decide" data-id="' + r.id + '" data-d="Approved"' + (C.allowanceWarning(d, st, r, r.id, true) ? ' data-over="1"' : '') + '>' + T('Approve') + '</button></span></div>';
    }).join('') + '</div>' : '<p class="empty">' + T('Nothing is waiting for approval.') + '</p>') + '</section>' + (isLeaveAdmin() ? renderStandIn(d) : '');
  }

  /** Stand-in approver: someone who approves and declines leave (not their own) between two dates, e.g. while the
   *  Administrator is away. Same settings as Leave Manager (StandInID/From/To); the database rules check the dates too. */
  function renderStandIn(d) {
    var st = d.settings || {}, id = String(st.StandInID || ''), p = id ? S.get('people', id) : null, today = H.today();
    var on = !!p && String(st.StandInTo || '') >= today;
    var choices = S.find('people', function (x) { return x.active !== false && x.email && x.appRole === 'pastor' && x.id !== H.user().id && !x.binnedAt; }).sort(function (a, b) { return H.name(a).localeCompare(H.name(b)); });
    return '<section class="panel" id="standin" style="margin-top:16px"><h2>' + T('Stand-in approver') + '</h2>' +
      '<p class="hint" style="margin-top:0">' + T('Going away? Choose someone to approve or decline leave between two dates. They can’t decide their own leave, and their access ends by itself after the last day.') + ' ' + T('A stand-in must be a Pastor, who can already see staff details.') + '</p>' +
      (on ? '<p class="note info"><b>' + esc(H.name(p)) + '</b> · ' + esc(H.fmt(st.StandInFrom) + ' – ' + H.fmt(st.StandInTo, true)) + ' <button class="btn small" data-act="leave:standinoff">' + T('Remove') + '</button></p>' : '') +
      '<div class="two"><label class="field">' + T('Person') + '<select id="si-who"><option value="">' + T('Choose…') + '</option>' + choices.map(function (x) { return '<option value="' + x.id + '"' + (on && x.id === id ? ' selected' : '') + '>' + esc(H.name(x)) + '</option>'; }).join('') + '</select></label>' +
      '<div class="two"><label class="field">' + T('From') + '<input type="date" id="si-from" value="' + esc(on ? st.StandInFrom : today) + '"></label><label class="field">' + T('To') + '<input type="date" id="si-to" value="' + esc(on ? st.StandInTo : '') + '"></label></div></div>' +
      '<button class="btn small primary" data-act="leave:standin">' + T('Set stand-in') + '</button></section>';
  }

  function renderTeam(d) {
    var y = C.lyOf(H.today(), C.ctx(d).S);
    var staff = d.staff.filter(function (s) { return C.tracksLeave(s) && s.active; });
    var bal = {}; staff.forEach(function (s) { bal[s.id] = C.balances(d, s.id, y); });
    // Only kinds of leave that someone in the list has an allowance for
    var types = d.types.filter(function (t) { return t.deducts && staff.some(function (s) { var x = bal[s.id][t.code]; return x && x.entitled != null; }); });
    return '<section class="block"><h2>' + esc(T('Days left in {year}', { year: C.lyLabel(y, C.ctx(d).S) })) + '</h2><div class="panel table-wrap"><table class="simple"><thead><tr><th>' + T('Staff') + '</th>' + types.map(function (t) { return '<th class="lt">' + esc(t.name) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      staff.map(function (s) {
        var b = bal[s.id];
        return '<tr><td><a href="#/leave/staff/' + s.id + '"><b>' + esc(s.name) + '</b></a><br><span class="muted small">' + esc(s.level) + '</span></td>' + types.map(function (t) { var x = b[t.code]; return '<td class="lt">' + (x && x.entitled != null ? C.fmtDays(x.available) : '<span class="muted">–</span>') + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="btns" style="margin-top:12px"><button class="btn small" data-act="leave:printall">' + T('Print: all staff summary') + '</button><button class="btn small" data-act="leave:printall" data-full="1">' + T('Print: all staff in full') + '</button>' +
      '<button class="btn small" data-act="leave:payroll">' + H.icon(H.ICON.download, 16) + T('Payroll: unpaid leave') + '</button><button class="btn small" data-act="leave:teamcsv">' + H.icon(H.ICON.download, 16) + T('Download team balances') + '</button></div>' +
      '<p class="hint">' + T('Click a name for that person’s leave in detail.') + '</p>' +
      (staff.some(function (s) { return !types.some(function (t) { var x = bal[s.id][t.code]; return x && x.entitled != null; }); }) ? '<p class="hint">' + T('A dash in every column means that person’s staff category has no allowances yet – set them under Leave → Settings.') + '</p>' : '') + '</section>';
  }

  /** Who's away: the wallchart (everyone on one month), a month calendar, or the list of the next 6 weeks. */
  function renderAway(d) {
    var ym = state.month || H.today().slice(0, 7), opts = { pending: isLeaveAdmin() || amStandIn(d) };
    var views = [['wall', T('Wallchart')], ['cal', T('Calendar')], ['list', T('List')]];
    var sw = '<div></div><nav class="seg lv-views" aria-label="' + esc(T('Who’s away')) + '" style="margin-bottom:12px">' + views.map(function (v) { return '<button data-act="leave:awayview" data-v="' + v[0] + '" class="' + (state.away === v[0] ? 'on' : '') + '" aria-pressed="' + (state.away === v[0]) + '">' + v[1] + '</button>'; }).join('') + '</nav>';
    if (state.away === 'wall') return sw + '<section class="block">' + LeaveViews.wallchart(d, ym, opts) + '</section>';
    if (state.away === 'cal') return sw + '<section class="block">' + LeaveViews.calendar(d, ym, opts) + '</section>';
    return sw + renderAwayList(d);
  }
  function renderAwayList(d) {
    var t = H.today(), end = C.iso(C.addDays(C.parse(t), 42));
    var list = d.requests.filter(function (r) { return (r.status === 'Approved' || (isLeaveAdmin() && r.status === 'Pending')) && r.end >= t && r.start <= end; }).sort(function (a, b) { return a.start < b.start ? -1 : 1; });
    return '<section class="block"><h2>' + T('Away in the next 6 weeks') + '</h2>' + (list.length ? '<div class="list">' + list.map(function (r) {
      var st = C.staffById(d, r.staffId), tp = typeOf(d, r.type);
      return '<div class="item"><span class="dot" style="--c:' + esc(tp.colour) + '"></span><span class="grow"><b>' + esc(st ? st.name : (H.name(S.get('people', r.staffId)) || T('A staff member'))) + '</b><small>' + esc(range(r)) + (isLeaveAdmin() ? ' · ' + esc(tp.name) : '') + '</small></span>' + (r.status === 'Pending' ? pill('Pending') : '') + '</div>';
    }).join('') + '</div>' : '<p class="empty">' + T('No one is away.') + '</p>') + '<p class="hint">' + T('Approved leave also stops people being rostered on those days.') + '</p></section>';
  }

  /* ---------- Elvanto: approved leave → Unavailable Volunteers (as Leave Manager did) ---------- */
  function elvSettings() { return (S.settings() && S.settings().elvanto) || {}; }
  function personName(id) { var p = S.get('people', id); return p ? ((p.preferredName || p.firstName) + ' ' + p.lastName).trim() : ''; }
  // Whenever leave is approved, changed or cancelled (by anyone), queue the Elvanto update – once switched on.
  S.onLeaveChange(function (changes) {
    if (!elvSettings().on) return;
    changes.forEach(function (c) {
      var ex = S.get('elvantoSync', c.now.id), doc = ElvantoSync.job(c.prev, c.now, ex, { name: personName(c.now.staffId), today: H.today() });
      if (doc) S.put('elvantoSync', Object.assign(ex ? JSON.parse(JSON.stringify(ex)) : {}, doc));   // keep the robot's own fields
    });
  });
  function utcLocal(s) { if (!s) return ''; var d = new Date(String(s).replace(' ', 'T') + (/Z$|[+-]\d\d:?\d\d$/.test(s) ? '' : 'Z')); return isNaN(d) ? s : H.fmt(LeaveCore.iso(d)) + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  function renderElvanto(d) {
    var el = elvSettings(), list = S.list('elvantoSync').slice(), rs = S.get('robotStatus', 'elvanto') || {};
    var order = { Failed: 0, Check: 1, Waiting: 2, Done: 3 };
    list.sort(function (a, b) { return (order[a.status] - order[b.status]) || (a.start < b.start ? 1 : -1); });
    var probs = ElvantoSync.problems(list, Date.now());
    var h = '<p class="muted" style="margin-top:0">' + T('Approved leave goes into Elvanto’s {list} list, so nobody is rostered in Elvanto while they’re away. Elvanto can’t be updated directly, so a robot logs into Elvanto every 15 minutes and does it, like Leave Manager’s robot.', { list: '<b>Unavailable Volunteers</b>' }) + ' ' + T('Each entry has the note “Church Hub {id}”.', { id: '&lt;' + T('request ID') + '&gt;' }) + '</p>';
    h += '<div class="grid2"><section class="panel"><h2>' + T('Settings') + '</h2>' +
      '<label class="check"><input type="checkbox" id="el-on"' + (el.on ? ' checked' : '') + '><span><b>' + T('Keep Elvanto up to date') + '</b><br><span class="muted small">' + T('Switch on when you stop using Leave Manager (switch Leave Manager’s robot off at the same time), so entries aren’t made twice.') + '</span></span></label>' +
      '<label class="check"><input type="checkbox" id="el-read"' + (el.read ? ' checked' : '') + '><span><b>' + T('Read Elvanto’s unavailable dates every night') + '</b><br><span class="muted small">' + T('Until you switch over, the robot reads who is unavailable in Elvanto (names and dates only). Check and add them to Church Hub under {link}.', { link: '<a href="#/import">' + T('Import') + '</a>' }) + '</span></span></label>' +
      '<label class="field">' + T('Elvanto web address') + '<input id="el-url" value="' + esc(el.url || '') + '" placeholder="https://yourchurch.elvanto.eu"></label>' +
      '<label class="field">' + T('Robot’s Church Hub sign-in (email)') + '<input id="el-remail" value="' + esc(el.robotEmail || '') + '" placeholder="' + esc(T('e.g. robot@yourchurch.org')) + '"><small>' + T('The account you created for the robot in Firebase (see the setup guide).') + '</small></label>' +
      '<label class="field">' + T('Robot’s account ID (User UID)') + '<input id="el-ruid" placeholder="' + esc(T(el.robotEmail ? 'Saved – type a new one to change it' : 'Copy it from Firebase → Authentication → Users')) + '"></label>' +
      '<button class="btn small save" data-act="leave:elsave">' + T('Save') + '</button></section>' +
      '<section class="panel"><h2>' + T('Robot') + '</h2>' + (rs.lastRun ? '<p style="margin-top:0">' + T('Last ran {when}', { when: '<b>' + esc(utcLocal(rs.lastRun)) + '</b>' }) + (rs.done != null ? ' · ' + T('{n} done', { n: rs.done }) : '') + '.' + '</p>' : '<p class="muted" style="margin-top:0">' + T('The robot hasn’t run yet.') + '</p>') +
      (rs.fatal ? '<p class="note bad">It couldn’t finish: ' + esc(rs.fatal) + '</p>' : '') +
      (el.url ? '<p><a href="' + esc(rs.listUrl || el.url) + '" target="_blank" rel="noopener">' + T('Open Elvanto') + '</a> ' + T('→ People → Volunteers → Unavailable Volunteers') + '</p>' : '') +
      '<p class="hint">' + T('Change leave in Church Hub, not in Elvanto – otherwise the robot can’t keep it up to date.') + '</p></section></div>';
    h += '<section class="block"><h2>' + T('Entries') + (probs.length ? ' <span class="tag bad">' + T('{n} to check', { n: probs.length }) + '</span>' : '') + '</h2>' + (list.length ? '<div class="list">' + list.slice(0, 200).map(function (e) {
      var tag = { Waiting: 'warn', Done: 'ok', Failed: 'bad', Check: 'bad' }[e.status] || 'grey';
      return '<div class="item" style="align-items:flex-start;flex-wrap:wrap"><span class="grow" style="min-width:220px"><b>' + esc(e.name || personName(e.personId)) + ' · ' + esc(range({ start: e.start, end: e.end })) + '</b>' +
        '<small>' + esc(T(e.want === 'Unavailable' ? 'Should be: unavailable' : 'Should be: removed')) + ' · ' + esc(T('In Elvanto: {what}', { what: e.have || T('nothing') })) + '</small><small>' + esc(e.note || '') + (e.updatedAt ? ' · ' + esc(utcLocal(e.updatedAt)) : '') + '</small></span>' +
        '<span class="tag ' + tag + '">' + esc(T({ Waiting: 'Waiting for the robot', Check: 'Check by hand', Done: 'Done', Failed: 'Failed' }[e.status] || e.status)) + '</span>' +
        (e.status !== 'Waiting' ? '<button class="btn small" data-act="leave:elretry" data-id="' + e.id + '">' + T('Try again') + '</button>' : '') +
        (e.status !== 'Done' ? '<button class="btn small" data-act="leave:eldone" data-id="' + e.id + '">' + T('Done by hand') + '</button>' : '') + '</div>';
    }).join('') + '</div>' : '<p class="empty">' + T('Nothing yet. Once switched on, approved, changed and cancelled leave appears here.') + '</p>') + '</section>';
    return h;
  }

  /* ---------- one staff member in detail (Administrators) ---------- */
  var auditedStaff = '', auditedDash = false;
  function yearOf(d) { return C.lyOf(H.today(), C.ctx(d).S); }
  function inYear(r, y, S) { var rg = C.lyRange(y, S); return r.end >= rg.start && r.start <= rg.end; }
  function renderStaff(d, id, yy) {
    var st = C.staffById(d, id), S = C.ctx(d).S, p = S2.get('people', id);
    var back = '<a class="crumb" href="#/leave/team">' + H.icon(H.ICON.back, 16) + T('Team balances') + '</a>';
    if (!st) return back + '<p class="empty">' + T('This person isn’t set up as staff. Mark them as staff under People → Edit details.') + '</p>';
    if (auditedStaff !== id) { auditedStaff = id; S2.audit('Viewed the leave of ' + st.name, 'people/' + id); }   // may include sick leave
    var y = yy ? +yy : yearOf(d), rg = C.lyRange(y, S), lv = C.level(d, st), ctx = C.ctx(d);
    var bal = C.balances(d, id, y), mine = d.requests.filter(function (r) { return r.staffId === id && !r.synthetic; });
    var years = {}; mine.forEach(function (r) { years[C.lyOf(r.start, S)] = 1; }); years[yearOf(d)] = 1; years[yearOf(d) + 1] = 1; years[y] = 1;
    var list = mine.filter(function (r) { return inYear(r, y, S); }).sort(function (a, b) { return a.start < b.start ? 1 : -1; });
    var adj = (d.adjustments || []).filter(function (a) { return a.staffId === id && Number(a.year) === y; });
    var h = back + '<div class="page-head"><div class="row">' + H.avatar(p || { id: id, firstName: st.name }, 56) + '<div><h1>' + esc(st.name) + '</h1><p class="lead" style="margin-top:2px">' + esc(st.level) +
      (st.start ? ' · ' + esc(T('started {date}', { date: H.fmt(st.start, true) })) : '') + ' · ' + T('Working days') + ': ' + esc(C.daysLabel ? dayNames(C.daysLabel(ctx.swd[id] || ctx.open)) : (st.workDays || (lv && lv.workDays) || '')) + '</p></div></div>' +
      '<div class="btns"><button class="btn primary" data-act="leave:request" data-who="' + id + '">' + H.icon(H.ICON.plus, 18) + T('Book leave') + '</button>' +
      '<button class="btn" data-act="leave:print" data-id="' + id + '" data-y="' + y + '">' + T('Print report') + '</button>' +
      '<button class="btn" data-act="leave:staffcsv" data-id="' + id + '">' + H.icon(H.ICON.download, 18) + T('Download report') + '</button>' + (p ? '<a class="btn" href="#/people/p/' + id + '">' + T('Profile') + '</a>' : '') + '</div></div>';
    h += '<nav class="seg" aria-label="' + esc(T('Leave year')) + '" style="margin-bottom:16px">' + Object.keys(years).map(Number).sort().map(function (x) {
      return '<a href="#/leave/staff/' + id + '/' + x + '" class="' + (x === y ? 'on' : '') + '">' + esc(C.lyLabel(x, S)) + '</a>';
    }).join('') + '</nav>';
    // Balances, with how each is made up
    var kinds = d.types.filter(function (t) { return bal[t.code] && (bal[t.code].entitled != null || bal[t.code].approved || bal[t.code].pending); });
    h += '<section class="block"><h2>' + esc(C.lyLabel(y, S)) + ': ' + esc(H.fmt(rg.start, true)) + ' – ' + esc(H.fmt(rg.end, true)) + '</h2>' + (kinds.length ? '<div class="panel table-wrap"><table class="simple"><thead><tr><th>' + T('Kind of leave') + '</th><th class="lt">' + T('Allowance') + '</th><th class="lt">' + T('From last year') + '</th><th class="lt">' + T('Taken') + '</th><th class="lt">' + T('Waiting') + '</th><th class="lt">' + T('Left') + '</th></tr></thead><tbody>' +
      kinds.map(function (t) {
        var b = bal[t.code], ly = b.lastYear, u = function (n) { return C.fmtDays(n); };
        var adjN = adj.filter(function (a) { return a.type === t.code; }).reduce(function (s, a) { return s + (Number(a.days) || 0); }, 0);
        return '<tr><td><span class="dot" style="--c:' + esc(t.colour) + '"></span> ' + esc(t.name) + (adjN ? '<br><span class="muted small">' + T('includes {n} adjustment', { n: (adjN > 0 ? '+' : '') + u(adjN) }) + '</span>' : '') + '</td>' +
          '<td class="lt">' + (b.entitled != null ? u(b.entitled) : '<span class="muted">–</span>') + '</td>' +
          '<td class="lt">' + (b.broughtForward ? u(b.broughtForward) : ly && ly.left ? (ly.until < H.today() ? '<span class="muted">' + u(ly.left) + '</span><br><span class="muted small">' + esc(T('unused, ended {date}', { date: H.fmt(ly.until) })) + '</span>' : u(ly.left) + '<br><span class="muted small">' + esc(T('until {date}', { date: H.fmt(ly.until) })) + '</span>') : '<span class="muted">–</span>') + '</td>' +
          '<td class="lt">' + u(b.approved || 0) + '</td><td class="lt">' + (b.pending ? u(b.pending) : '<span class="muted">–</span>') + '</td>' +
          '<td class="lt"><b>' + (b.entitled != null ? u(b.available) : '<span class="muted">–</span>') + '</b></td></tr>';
      }).join('') + '</tbody></table></div><p class="hint">' + T('“Left” takes off approved and waiting leave. Days from last year are used first, until the date shown.') + '</p>' : '<p class="empty">' + esc(T('No allowances for {category} – set them under Leave → Settings.', { category: st.level })) + '</p>') + '</section>';
    h += '<section class="block"><h2>' + esc(T('Year planner')) + '</h2>' + LeaveViews.planner(d, id, y) + '</section>';
    // Every request in the year
    h += '<section class="block"><h2>' + esc(T('Leave in {year}', { year: C.lyLabel(y, S) })) + '</h2>' + (list.length ? '<div class="list">' + list.map(function (r) {
      var t = typeOf(d, r.type), n = C.amount(r, t, ctx);
      return '<div class="item" style="align-items:flex-start"><span class="dot" style="--c:' + esc(t.colour) + ';margin-top:6px"></span><span class="grow"><b>' + esc(range(r)) + '</b><small>' +
        esc(t.name + ' · ' + amt(t, n) + (r.reason ? ' · “' + r.reason + '”' : '')) + '</small><small>' +
        esc([r.submitted ? T('Asked {date}', { date: String(r.submitted).slice(0, 10) }) : '', r.decidedBy ? T(r.status === 'Declined' ? 'Declined by {name}' : 'Approved by {name}', { name: r.decidedBy }) + (r.decidedOn ? ' ' + T('on {date}', { date: String(r.decidedOn).slice(0, 10) }) : '') : '',
          r.cancelledBy ? T('Cancelled by {name}', { name: r.cancelledBy }) : '', r.source === 'Leave Manager' ? T('from Leave Manager') : ''].filter(Boolean).join(' · ')) + '</small></span>' + pill(r.status) +
        (r.status === 'Pending' ? '<span class="btns"><button class="btn small" data-act="leave:decide" data-id="' + r.id + '" data-d="Declined">' + T('Decline') + '</button><button class="btn small ok" data-act="leave:decide" data-id="' + r.id + '" data-d="Approved">' + T('Approve') + '</button></span>' : '') +
        (r.status === 'Approved' || r.status === 'Pending' ? '<button class="btn small" data-act="leave:change" data-id="' + r.id + '">' + T('Change') + '</button>' : '') +
        ((r.status === 'Approved' || r.status === 'Pending') && r.end >= H.today() ? '<button class="btn small" data-act="leave:cancel" data-id="' + r.id + '">' + T('Cancel') + '</button>' : '') + '</div>';
    }).join('') + '</div>' : '<p class="empty">' + T('No leave in this leave year.') + '</p>') + '</section>';
    // Adjustments
    h += '<section class="block"><h2>' + esc(T('Adjustments in {year}', { year: C.lyLabel(y, S) })) + '</h2><p class="muted" style="margin-top:0">' + T('Extra days or corrections (e.g. days carried over by agreement, or a public holiday worked).') + '</p>' +
      (adj.length ? '<div class="list">' + adj.map(function (a) { var t = typeOf(d, a.type); return '<div class="item"><span class="grow"><b>' + (a.days > 0 ? '+' : '') + C.fmtDays(a.days) + ' ' + esc(t.name) + '</b><small>' + esc(a.note || '') + '</small></span></div>'; }).join('') + '</div>' : '') +
      '<div class="row" style="flex-wrap:wrap;gap:8px;align-items:flex-end;margin-top:10px"><label class="field" style="margin:0">' + T('Kind of leave') + '<select id="adj-t">' + d.types.filter(function (t) { return t.deducts && C.offered(d, st, t); }).map(function (t) { return '<option value="' + t.code + '">' + esc(t.name) + '</option>'; }).join('') + '</select></label>' +
      '<label class="field req" style="margin:0">' + T('Days (+ or −)') + '<input id="adj-d" type="number" step="0.5" style="width:100px"></label><label class="field grow" style="margin:0">' + T('Why') + '<input id="adj-n" placeholder="' + esc(T('e.g. Carried over by agreement')) + '"></label>' +
      '<button class="btn" data-act="leave:addadj" data-id="' + id + '" data-y="' + y + '">' + T('Add adjustment') + '</button></div></section>';
    return h;
  }
  function csv(rows) { return rows.map(function (r) { return r.map(function (v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','); }).join('\r\n'); }

  /* ---------- settings (Administrators): the same settings as Leave Manager's sheet tabs ---------- */
  var DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function dayBoxes(cls, value, extra) {
    var on = String(value || '').split(/\s*,\s*/);
    return '<span class="daybox">' + DAYS.map(function (d, i) { var w = I18n.dow()[(i + 1) % 7]; return '<label title="' + esc(w) + '"><input type="checkbox" class="' + cls + '" value="' + d + '"' + (extra || '') + (on.indexOf(d) >= 0 ? ' checked' : '') + '><span>' + esc(w.slice(0, 2)) + '</span></label>'; }).join('') + '</span>';
  }
  function picked(cls, scope) { var out = []; (scope || document).querySelectorAll('.' + cls + ':checked').forEach(function (b) { out.push(b.value); }); return out.join(', '); }

  function renderSettings(d) {
    var lv = S.leave(), st = lv.settings, ded = lv.types.filter(function (t) { return t.deducts; });
    var staffCount = {}; d.staff.forEach(function (s) { staffCount[s.level] = (staffCount[s.level] || 0) + 1; });
    var y = new Date().getFullYear(), years = [y, y + 1];
    var html = '<p class="muted">' + T('These work exactly like the tabs in the Leave Manager sheet. Changes apply straight away to everyone’s balances.') + '</p><div class="grid2">';

    // General
    html += '<section class="panel"><h2>' + T('General') + '</h2>' +
      '<label class="field">' + T('The leave year starts in') + '<select id="ls-start">' + MONTHS.map(function (m, i) { return '<option value="' + (i + 1) + '"' + (Number(st.LeaveYearStartMonth || 1) === i + 1 ? ' selected' : '') + '>' + T(m) + '</option>'; }).join('') + '</select></label>' +
      '<div class="field">' + T('Days the church is open') + '<br>' + dayBoxes('ls-open', st.OpenDays) + '<small>' + T('Used for anyone without their own working days.') + '</small></div>' +
      '<label class="check"><input type="checkbox" id="ls-prorata"' + (/^false$/i.test(String(st.ProRata)) ? '' : ' checked') + '><span>' + T('New staff get a share of the year’s allowance (pro-rata)') + '</span></label>' +
      '<label class="check"><input type="checkbox" id="ls-neg"' + (/^true$/i.test(String(st.AllowNegative)) ? ' checked' : '') + '><span>' + T('Staff may ask for more leave than they have left (Administrators can always approve it)') + '</span></label>' +
      '<button class="btn small" data-autosave data-act="leave:savegeneral">' + T('Save') + '</button></section>';

    // Terms
    var terms = lv.terms.slice().sort(function (a, b) { return a.start < b.start ? -1 : 1; });
    html += '<section class="panel"><h2>' + T('School terms') + '</h2><p class="hint" style="margin-top:0">' + T('Needed for leave limited per term (e.g. one Weekend Off per term).') + '</p><div id="ls-terms">' +
      terms.map(termRow).join('') + '</div><div class="btns" style="margin-top:8px"><button class="btn small" data-act="leave:addterm">' + H.icon(H.ICON.plus, 16) + T('Add a term') + '</button><button class="btn small" data-autosave data-act="leave:saveterms">' + T('Save terms') + '</button></div></section>';

    // Categories and allowances
    html += '<section class="panel" style="grid-column:1/-1"><h2>' + T('Staff categories and allowances') + '</h2><p class="hint" style="margin-top:0">' + T('Days per leave year for each category. Leave a box empty if that category doesn’t get that kind of leave. The “Administrator” category manages leave but doesn’t take it here.') + '</p>' +
      '<div class="table-wrap"><table class="simple" id="ls-levels"><thead><tr><th>' + T('Category') + '</th><th>' + T('Working days') + '</th>' + ded.map(function (t) { return '<th class="lt">' + esc(t.name) + '</th>'; }).join('') + '<th></th></tr></thead><tbody>' +
      lv.levels.map(function (l, i) {
        return '<tr data-i="' + i + '"><td><b>' + esc(l.label || l.level) + '</b><br><span class="muted small">' + TN('{n} staff member', '{n} staff', staffCount[l.level] || 0) + '</span></td><td>' + dayBoxes('ls-wd', l.workDays) + '</td>' +
          ded.map(function (t) { var v = l.ent[t.code]; return '<td class="lt"><input class="ls-ent" data-code="' + t.code + '" type="number" min="0" step="0.5" style="width:64px" value="' + (v == null ? '' : v) + '" aria-label="' + esc(T('{type} for {category}', { type: t.name, category: l.level })) + '"></td>'; }).join('') +
          '<td>' + (staffCount[l.level] ? '' : '<button class="icon-btn ghost" data-act="leave:dellevel" data-i="' + i + '" aria-label="Remove category ' + esc(l.level) + '">' + H.icon(H.ICON.trash, 18) + '</button>') + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="btns"><button class="btn small" data-act="leave:addlevel">' + H.icon(H.ICON.plus, 16) + T('Add a category') + '</button><button class="btn small" data-autosave data-act="leave:savelevels">' + T('Save categories') + '</button></div></section>';

    html += renderRules(lv);

    // Leave types
    html += '<section class="panel"><h2>' + T('Kinds of leave') + '</h2><div class="list">' + lv.types.map(function (t, i) {
      return '<div class="item" style="flex-wrap:wrap"><span class="dot" style="--c:' + esc(t.colour) + '"></span><span class="grow" style="min-width:160px"><input class="ls-tname" data-i="' + i + '" value="' + esc(t.name) + '" aria-label="' + esc(T('Name')) + '" style="width:100%"><small>' + esc(t.code) + ' · ' + T(t.deducts ? 'uses an allowance' : 'no allowance') + (t.perTerm ? ' · ' + T('{n} per term', { n: t.perTerm }) : '') + '</small></span>' +
        '<label class="check" style="margin:0"><input type="checkbox" class="ls-tappr" data-i="' + i + '"' + (t.needsApproval === false ? '' : ' checked') + '><span>' + T('Needs approval') + '</span></label>' +
        '<label class="check" style="margin:0"><input type="checkbox" class="ls-tuse" data-i="' + i + '"' + (t.active === false ? '' : ' checked') + '><span>' + T('In use') + '</span></label></div>';
    }).join('') + '</div><div class="btns" style="margin-top:10px"><button class="btn small" data-act="leave:addtype">' + H.icon(H.ICON.plus, 16) + T('Add a kind of leave') + '</button><button class="btn small" data-autosave data-act="leave:savetypes">' + T('Save') + '</button></div></section>';

    // Public holidays
    var hol = lv.holidays.filter(function (h) { return +h.date.slice(0, 4) >= y; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var missing = years.filter(function (yy) { return !lv.holidays.some(function (h) { return +h.date.slice(0, 4) === yy && !h.church; }); });
    html += '<section class="panel"><h2>' + T('Public holidays and church closures') + '</h2><p class="hint" style="margin-top:0">' + T('These days don’t use anyone’s leave.') + '</p>' +
      (missing.length ? '<p class="note warn">' + missing.map(function (yy) { return '<button class="btn small" data-act="leave:addsa" data-y="' + yy + '">' + T('Add South African public holidays for {year}', { year: yy }) + '</button>'; }).join(' ') + '</p>' : '') +
      '<div class="list" style="max-height:320px;overflow:auto">' + hol.map(function (h) {
        return '<div class="item"><span class="grow"><b>' + esc(H.fmt(h.date, true)) + '</b><small>' + esc(h.name) + '</small></span><button class="icon-btn ghost" data-act="leave:delhol" data-date="' + h.date + '" aria-label="' + esc(T('Remove {name}', { name: h.name })) + '">' + H.icon(H.ICON.trash, 18) + '</button></div>';
      }).join('') + '</div><div class="two" style="margin-top:10px"><label class="field req">' + T('Date') + '<input type="date" id="ls-hd"></label><label class="field req">' + T('Name') + '<input id="ls-hn" placeholder="' + esc(T('e.g. Office closed – Christmas week')) + '"></label></div>' +
      '<button class="btn small" data-act="leave:addhol">' + T('Add this day') + '</button>' +
      (lv.holidays.some(function (h) { return +h.date.slice(0, 4) === y + 2 && !h.church; }) ? '' : ' <button class="link" data-act="leave:addsa" data-y="' + (y + 2) + '">' + T('Add public holidays for {year}', { year: y + 2 }) + '</button>') +
      '</section>';
    return html + '</div>';
  }
  /** Cover rules and blocked days (Leave Manager's Cover Rules tab): "Minimum on duty" (e.g. a pastor every Sunday) or
   *  "No leave" (Christmas, Easter, a camp), for all staff or some categories, set to warn or block. */
  var PRESETS = {
    sunday: { name: 'Sunday cover', kind: 'Minimum on duty', category: 'Pastoral Staff', days: 'Sun', from: '', to: '', min: 1, action: 'Warn', message: '', active: true },
    christmas: { name: 'Christmas services', kind: 'No leave', category: '', days: '', from: '24 Dec', to: '26 Dec', min: 1, action: 'Block', message: '', active: true },
    easter: { name: 'Easter services', kind: 'No leave', category: '', days: '', from: 'Easter-2', to: 'Easter+1', min: 1, action: 'Block', message: '', active: true },
    blank: { name: '', kind: 'No leave', category: '', days: '', from: '', to: '', min: 1, action: 'Warn', message: '', active: true }
  };
  function renderRules(lv) {
    var today = H.today(), cats = lv.levels.map(function (l) { return l.level; });
    return '<section class="panel" id="ls-rules" style="grid-column:1/-1"><h2>' + T('Cover rules and blocked days') + '</h2>' +
      '<p class="hint" style="margin-top:0">' + T('Stop the church being left without the people it needs. “At least … on duty” checks how many are still working; “No leave” blocks days such as Christmas. Warn lets the request through with a warning; Block stops staff sending it. Administrators can always approve anyway.') + '</p>' +
      (lv.rules || []).map(function (r, i) {
        var next = r.from ? C.nextOccurrence(r, today) : null, min = /min/i.test(String(r.kind));
        return '<div class="ls-rule" data-i="' + i + '"><div class="ls-rule-row">' +
          '<label class="field">' + T('Name') + '<input class="lr-name" value="' + esc(r.name || '') + '" placeholder="' + esc(T('e.g. Christmas services')) + '"></label>' +
          '<label class="field">' + T('Rule') + '<select class="lr-kind"><option value="Minimum on duty"' + (min ? ' selected' : '') + '>' + T('At least … on duty') + '</option><option value="No leave"' + (min ? '' : ' selected') + '>' + T('No leave') + '</option></select></label>' +
          '<label class="field">' + T('Who') + '<select class="lr-cat"><option value="">' + T('All staff') + '</option>' + cats.map(function (c) { return '<option' + (String(r.category || '') === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></label>' +
          '<label class="field lr-minf">' + T('How many') + '<input class="lr-min" type="number" min="1" value="' + esc(r.min || 1) + '"></label>' +
          '<label class="field">' + T('If broken') + '<select class="lr-act"><option value="Warn"' + (/block/i.test(String(r.action)) ? '' : ' selected') + '>' + T('Warn') + '</option><option value="Block"' + (/block/i.test(String(r.action)) ? ' selected' : '') + '>' + T('Block') + '</option></select></label></div>' +
          '<div class="ls-rule-row"><div class="field">' + T('Days of the week') + '<br>' + dayBoxes('lr-day', r.days) + '<small>' + T('None ticked = every day.') + '</small></div>' +
          '<label class="field">' + T('From') + '<input class="lr-from" value="' + esc(r.from || '') + '" placeholder="24 Dec"></label>' +
          '<label class="field">' + T('To') + '<input class="lr-to" value="' + esc(r.to || '') + '" placeholder="26 Dec"></label>' +
          '<label class="field grow">' + T('Message for staff') + '<input class="lr-msg" value="' + esc(r.message || '') + '"></label></div>' +
          '<div class="ls-rule-row" style="align-items:center"><label class="check" style="margin:0"><input type="checkbox" class="lr-on"' + (r.active === false ? '' : ' checked') + '><span>' + T('On') + '</span></label>' +
          (next ? '<span class="muted small grow">' + esc(T('Next: {dates}', { dates: next.start === next.end ? H.fmt(next.start, true) : H.fmt(next.start) + ' – ' + H.fmt(next.end, true) })) + '</span>' : '<span class="grow"></span>') +
          '<button class="icon-btn ghost" data-act="leave:delrule" data-i="' + i + '" aria-label="' + esc(T('Remove this rule')) + '">' + H.icon(H.ICON.trash, 18) + '</button></div></div>';
      }).join('') +
      '<p class="hint">' + T('From and To: a date every year (24 Dec), Easter-based (Easter-2 is Good Friday, Easter+1 Family Day), or one date (2026-11-27). Leave both empty for all year.') + '</p>' +
      '<div class="btns"><button class="btn small" data-act="leave:addrule" data-preset="sunday">' + H.icon(H.ICON.plus, 16) + T('A pastor every Sunday') + '</button>' +
      '<button class="btn small" data-act="leave:addrule" data-preset="christmas">' + H.icon(H.ICON.plus, 16) + T('Christmas') + '</button>' +
      '<button class="btn small" data-act="leave:addrule" data-preset="easter">' + H.icon(H.ICON.plus, 16) + T('Easter') + '</button>' +
      '<button class="btn small" data-act="leave:addrule" data-preset="blank">' + H.icon(H.ICON.plus, 16) + T('Another rule') + '</button>' +
      '<button class="btn small" data-autosave data-act="leave:saverules">' + T('Save') + '</button></div></section>';
  }
  /** The rules as typed on the page (so adding or removing one keeps what was typed in the others). */
  function typedRules() {
    var out = [];
    document.querySelectorAll('.ls-rule').forEach(function (row) {
      var v = function (c) { var e = row.querySelector('.' + c); return e ? e.value.trim() : ''; };
      out.push({ name: v('lr-name'), kind: v('lr-kind'), category: v('lr-cat'), days: picked('lr-day', row), from: v('lr-from'), to: v('lr-to'),
        min: Math.max(1, +v('lr-min') || 1), action: v('lr-act'), message: v('lr-msg'), active: !!(row.querySelector('.lr-on') || {}).checked });
    });
    return out;
  }
  function termRow(t) {
    return '<div class="ls-term"><label class="field" style="margin:0 0 6px">' + T('Name') + '<input class="ls-tn" value="' + esc(t.name || '') + '" placeholder="' + esc(T('e.g. Term 1 2027')) + '"></label>' +
      '<div class="ls-term-dates"><label class="field" style="margin:0">' + T('Starts') + '<input type="date" class="ls-ts" value="' + esc(t.start || '') + '"></label><label class="field" style="margin:0">' + T('Ends') + '<input type="date" class="ls-te" value="' + esc(t.end || '') + '"></label>' +
      '<button class="icon-btn ghost" data-act="leave:delterm" aria-label="' + esc(T('Remove this term')) + '">' + H.icon(H.ICON.trash, 18) + '</button></div></div>';
  }

  /* ---------- request form ---------- */
  function requestDialog(whoId, editId) {
    var d = data(), me = H.user(), admin = isLeaveAdmin(), ed = editId ? C.findReq(d, editId) : null;
    if (ed) whoId = ed.staffId;
    var people = d.staff.filter(function (s) { return C.tracksLeave(s) && s.active && (s.id === me.id || admin); });
    if (!people.length) { H.toast(T('Leave is for staff members'), true); return; }
    var who = people.filter(function (s) { return s.id === (whoId || me.id); })[0] || people[0];
    if (ed) people = people.filter(function (s) { return s.id === ed.staffId; });
    if (ed && !people.length) people = [C.staffById(d, ed.staffId)];
    H.modal(H.dialogHead(ed ? T('Change leave') : admin && who.id !== me.id ? T('Book leave') : T('Request leave'), ed && ed.status === 'Approved' && !admin ? T('Changing approved leave sends it back for approval.') : T('Only your working days are counted.')) + '<form class="dlg-body" id="lf" novalidate>' + (ed ? '<input type="hidden" id="lf-edit" value="' + esc(ed.id) + '">' : '') +
      (people.length > 1 ? '<label class="field">' + T('For') + '<select class="findable" id="lf-who">' + people.map(function (s) { return '<option value="' + s.id + '"' + (s.id === who.id ? ' selected' : '') + '>' + esc(s.name) + (s.id === me.id ? ' (you)' : '') + '</option>'; }).join('') + '</select></label>' : '<input type="hidden" id="lf-who" value="' + who.id + '">') +
      '<label class="field req">' + T('Type of leave') + '<select id="lf-type"></select></label><div id="lf-bal"></div>' +
      '<div class="two"><label class="field req">' + T('First day') + '<input type="date" id="lf-start"></label><label class="field req">' + T('Last day') + '<input type="date" id="lf-end"></label></div>' +
      '<label class="field' + (admin ? '' : ' req') + '">' + T('Note for the Administrator') + '<textarea id="lf-note" rows="2" placeholder="' + T('What is the leave for?') + '"></textarea></label>' +
      '<div id="lf-sum" class="note info" hidden></div><div id="lf-err" class="note bad" hidden></div></form>' +
      '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn primary" id="lf-go" data-act="leave:send">' + T('Send request') + '</button></div>', T('Request leave'));
    var $ = function (id) { return document.getElementById(id); };
    function fillTypes() {
      var st = C.staffById(d, $('lf-who').value);
      $('lf-type').innerHTML = '<option value="">' + T('Choose…') + '</option>' + d.types.filter(function (t) { return C.offered(d, st, t); }).map(function (t) { return '<option value="' + t.code + '">' + esc(t.name) + (t.deducts ? '' : ' ' + T('(no allowance)')) + '</option>'; }).join('');
    }
    function update() {
      var st = C.staffById(d, $('lf-who').value), t = C.type(d, $('lf-type').value);
      var r = { staffId: st.id, type: $('lf-type').value, start: $('lf-start').value, end: $('lf-end').value || $('lf-start').value, half: 'None', reason: $('lf-note').value };
      if (t && /weekend/i.test(t.unit || '') && r.start) { var x = C.parse(r.start); while (x.getDay() !== 5) x = C.addDays(x, x.getDay() === 6 || x.getDay() === 0 ? -1 : 1); r.start = C.iso(x); r.end = C.iso(C.addDays(x, 2)); $('lf-start').value = r.start; $('lf-end').value = r.end; }
      // balance box once a type is chosen
      var bal = '';
      if (t && t.deducts) {
        var b = C.balances(d, st.id, C.lyOf(r.start || H.today(), C.ctx(d).S))[t.code];
        if (b && b.entitled != null) bal = '<div class="fbal" style="--c:' + esc(t.colour) + '">' + (st.id === me.id ? T('You have {n} {unit} of {type} left', { n: '<b>' + C.fmtDays(b.available) + '</b>', unit: esc(T(C.unitName(t, b.available))), type: esc(t.name) }) : T('{name} has {n} {unit} of {type} left', { name: esc(st.name.split(' ')[0]), n: '<b>' + C.fmtDays(b.available) + '</b>', unit: esc(T(C.unitName(t, b.available))), type: esc(t.name) })) + (b.pending ? ' · ' + esc(T('{n} waiting', { n: C.fmtDays(b.pending) })) : '') + '</div>';
      } else if (t) bal = '<div class="fbal" style="--c:' + esc(t.colour) + '">' + esc(T('{type} doesn’t use an allowance.', { type: t.name })) + '</div>';
      $('lf-bal').innerHTML = bal;
      var errs = [], warn = [];
      if (t && C.isISO(r.start) && C.isISO(r.end)) {
        errs = C.validateAll(d, st, r, ed ? ed.id : undefined, false, admin);
        warn = C.requestWarnings(d, st, r, ed ? ed.id : undefined, false);
        var n = C.countDays(r, C.ctx(d));
        $('lf-sum').hidden = false;
        $('lf-sum').innerHTML = '<b>' + esc(amt(t, C.amount(r, t, C.ctx(d)))) + '</b>' + (C.isDayUnit(t) ? '' : ' (' + esc(T('{n} working days', { n: n })) + ')') + (warn.length ? '<br>⚠ ' + warn.map(esc).join('<br>⚠ ') : '');
      } else $('lf-sum').hidden = true;
      $('lf-err').hidden = !errs.length; $('lf-err').innerHTML = errs.map(esc).join('<br>');
      $('lf-go').disabled = !t || !C.isISO(r.start) || errs.length > 0;
      $('lf-go').className = 'btn ' + (ed ? 'save' : 'primary'); $('lf-go').textContent = ed ? T('Save change') : admin && st.id !== me.id ? T('Book leave') : T('Send request');
    }
    fillTypes();
    if (ed) { $('lf-type').value = ed.type; $('lf-start').value = ed.start; $('lf-end').value = ed.end; $('lf-note').value = ed.reason || ''; }
    $('lf-who').addEventListener('change', function () { fillTypes(); update(); });
    $('lf-type').addEventListener('change', update);
    $('lf-start').addEventListener('change', function () { if (!$('lf-end').value || $('lf-end').value < $('lf-start').value) $('lf-end').value = $('lf-start').value; update(); });
    $('lf-end').addEventListener('change', update);
    $('lf-note').addEventListener('input', update);
    update();
  }

  /** "Use it or lose it": one email per person with leave about to be lost (Leave Manager sent these on 1 Nov, 1 Dec and 15 Jan). */
  function renderReminders(d) {
    var today = H.today(), list = [];
    d.staff.filter(function (s) { return s.active && C.tracksLeave(s); }).forEach(function (s) { var u = C.useItOrLoseIt(d, s.id, today); if (u.length) list.push({ s: s, u: u }); });
    return '<a class="crumb" href="#/leave/dashboard">' + H.icon(H.ICON.back, 16) + T('Dashboard') + '</a><div class="page-head"><div><h1>' + T('Use it or lose it') + '</h1><p class="lead">' + T('An email to each person with leave they’ll lose if they don’t take it. Open each, check it and send it.') + '</p></div></div>' +
      (list.length ? '<div class="list">' + list.map(function (x) {
        return '<div class="item"><span class="grow"><b>' + esc(x.s.name) + '</b><small>' + esc(x.u.map(function (u) { return C.fmtDays(u.left) + ' ' + u.type.name + ' – ' + H.fmt(u.until, true); }).join(' · ')) + '</small></span>' +
          (personEmail(x.s.id) ? '<button class="btn small" data-act="leave:remind" data-id="' + esc(x.s.id) + '">' + T('Write the email') + '</button>' : '<span class="muted small">' + T('No email address') + '</span>') + '</div>';
      }).join('') + '</div>' : '<p class="empty">' + T('No one has leave about to be lost.') + '</p>') +
      '<div class="btns" style="margin-top:14px"><button class="btn primary" data-act="leave:reminddone">' + T('Done – mark the reminders as sent') + '</button></div>';
  }

  /* ---------- emails about leave (opened ready to send, like the birthday emails; sent automatically later) ---------- */
  function emailTo(to, subject, body, why) {
    var st = S.settings() || {}, E = window.Emails;
    if (!E || !to) return;
    H.modal(H.dialogHead(T('Let them know by email'), why) + '<div class="dlg-body"><label class="field">' + T('To') + '<input id="le-to" value="' + esc(to) + '"></label>' +
      '<label class="field">' + T('Subject') + '<input id="le-sub" value="' + esc(subject) + '"></label><label class="field">' + T('Message') + '<textarea id="le-body" rows="9">' + esc(body) + '</textarea></label></div>' +
      '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Not now') + '</button><button class="btn primary" data-act="leave:mailgo">' + T('Open email') + '</button></div>', T('Email'));
  }
  function signOff() { var st = S.settings() || {}; return st.emailSignOff || st.churchName || ''; }
  function personEmail(id) { var p = S.get('people', id); return p && p.email ? p.email : ''; }
  function officeEmail() {
    var st = S.settings() || {}; if (st.emailOffice) return st.emailOffice;
    return S.find('people', function (p) { return p.appRole === 'admin' && p.active !== false && p.email; }).map(function (p) { return p.email; }).join(', ');
  }
  function firstName(id) { var p = S.get('people', id); return p ? (p.preferredName || p.firstName) : ''; }
  /** The Monday of this week, and whether the weekly "who's away" email / the "use it or lose it" reminders are due. */
  function weekStart() { var x = C.parse(H.today()); while (x.getDay() !== 1) x = C.addDays(x, -1); return C.iso(x); }
  function weeklyDue(d) {
    var st = d.settings || {}, day = st.WeeklyEmail === undefined ? 'Mon' : String(st.WeeklyEmail || '');
    if (!day) return false;
    return String(st.LastWeeklyEmail || '') < weekStart();
  }
  function reminderDue(d) {
    var st = d.settings || {}, spec = st.ReminderDates === undefined ? '1 Nov, 1 Dec, 15 Jan' : String(st.ReminderDates || ''), today = H.today(), last = String(st.LastReminder || ''), due = '';
    spec.split(',').forEach(function (s) { var dt = C.ruleDate(s.trim(), +today.slice(0, 4)); if (dt && dt <= today && dt > last && dt > due) due = dt; });
    return due;
  }
  function weeklyText(d) {
    var from = weekStart(), to = C.iso(C.addDays(C.parse(from), 6));
    var away = d.requests.filter(function (r) { return r.status === 'Approved' && r.start <= to && r.end >= from; }).sort(function (a, b) { return a.start < b.start ? -1 : 1; });
    var lines = away.map(function (r) { var s = C.staffById(d, r.staffId); return '• ' + (s ? s.name : Hub.name(S.get('people', r.staffId))) + ': ' + range(r); });
    return T('Good morning everyone,') + '\n\n' + (lines.length ? T('Away this week ({from} – {to}):', { from: H.fmt(from), to: H.fmt(to, true) }) + '\n' + lines.join('\n') : T('No one is away this week.')) + '\n\n' + signOff();
  }

  H.register({
    id: 'leave', name: 'Leave', desc: 'Staff leave – Leave Manager built in', icon: H.ICON.leave, tint: '#E8590C',
    roles: ['admin', 'pastor', 'rosters', 'kids', 'member'],
    show: function () { return !partner() || !!takesLeave(data()); },   // Church Partners only if they're staff who take leave
    stat: function (u) {
      var d = data();
      if (isLeaveAdmin()) { var n = d.requests.filter(function (r) { return r.status === 'Pending'; }).length; return n ? T('{n} waiting for approval', { n: n }) : T('Nothing waiting'); }
      return T(takesLeave(d) ? 'Your balances and requests' : 'Who’s away');
    },
    todos: function () {
      var d = data(); if (!isLeaveAdmin()) return [];
      var n = d.requests.filter(function (r) { return r.status === 'Pending'; }).length, out = [];
      if (n) out.push({ text: TN('Approve or decline {n} leave request', 'Approve or decline {n} leave requests', n), href: '#/leave/approvals' });
      var probs = ElvantoSync.problems(S.list('elvantoSync'), Date.now());
      if (probs.length) out.push({ text: TN('{n} Elvanto update to check', '{n} Elvanto updates to check', probs.length), href: '#/leave/elvanto', tag: 'Elvanto' });
      if (weeklyDue(d)) out.push({ text: T('Email the staff who is away this week'), href: '#/leave/weekly' });
      if (reminderDue(d)) out.push({ text: T('Send the “use it or lose it” leave reminders'), href: '#/leave/reminders' });
      return out;
    },
    render: function (p) {
      if (partner() && !takesLeave(data())) return '<h1>' + T('Leave') + '</h1><p class="empty">' + T('Leave is for church staff.') + '</p>';
      var d = data(), v = p[0] || (takesLeave(d) ? '' : isLeaveAdmin() ? 'dashboard' : 'away');
      if (v === 'staff' && isLeaveAdmin()) return renderStaff(d, p[1], p[2]);
      if (v === 'weekly' && isLeaveAdmin()) {
        setTimeout(function () {
          var to = d.staff.filter(function (s) { return s.active && C.tracksLeave(s); }).map(function (s) { return personEmail(s.id); }).filter(Boolean).join(', ');
          emailTo(to, T('Who’s away this week'), weeklyText(d), T('Then click “Mark as sent” on the Dashboard so it isn’t suggested again this week.'));
        }, 50);
        v = 'dashboard';
      }
      if (v === 'reminders' && isLeaveAdmin()) return renderReminders(d);
      if (v === 'dashboard' && isLeaveAdmin() && !auditedDash) { auditedDash = true; S2.audit('Opened the leave Dashboard (includes sick leave)', 'leave'); }
      var body = v === 'dashboard' && isLeaveAdmin() ? (weeklyDue(d) ? '<p class="note info">' + T('This week’s “who’s away” email hasn’t been sent yet.') + ' <a href="#/leave/weekly">' + T('Write it') + '</a> · <button class="link" data-act="leave:weeklydone">' + T('Mark as sent') + '</button></p>' : '') + LeaveReports.dashboard(d, { range: range }) : v === 'elvanto' && isLeaveAdmin() ? renderElvanto(d) : v === 'settings' && isLeaveAdmin() ? renderSettings(d) : v === 'approvals' && (isLeaveAdmin() || amStandIn(d)) ? renderApprovals(d) : v === 'team' && isLeaveAdmin() ? renderTeam(d) : v === 'away' ? renderAway(d) : takesLeave(d) ? renderMine(d) : renderAway(d);
      return '<div class="page-head"><div><h1>' + T('Leave') + '</h1><p class="lead">' + T('Staff leave with the same rules as Leave Manager: only working days count, public holidays are free, and approved leave keeps people off the roster.') + '</p></div>' +
        (takesLeave(d) || isLeaveAdmin() ? '<button class="btn primary" data-act="leave:request">' + H.icon(H.ICON.plus, 18) + (takesLeave(d) ? T('Request leave') : T('Book leave')) + '</button>' : '') + '</div>' + tabs(d, v) + body;
    },
    actions: {
      elsave: function () {
        var old = elvSettings(), on = document.getElementById('el-on').checked, rd = document.getElementById('el-read').checked, url = document.getElementById('el-url').value.trim().replace(/\/+$/, '');
        var email = document.getElementById('el-remail').value.trim().toLowerCase(), uid = document.getElementById('el-ruid').value.trim();
        if ((on || rd) && !/^https:\/\/[\w.-]+\.elvanto\.[a-z.]+$/i.test(url)) { H.toast(T('Type your Elvanto web address, e.g. https://yourchurch.elvanto.eu'), true); return; }
        if (email && email !== old.robotEmail && !uid) { H.toast(T('Also paste the robot’s account ID (User UID) from Firebase'), true); return; }
        if (uid || (old.robotEmail && old.robotEmail !== email)) S.setRobot(email, uid, old.robotEmail);
        S.setSettings({ elvanto: { on: on, read: rd, url: url, robotEmail: email } }, (on && !old.on ? 'Switched on' : !on && old.on ? 'Switched off' : 'Changed') + ' keeping Elvanto up to date' + (rd !== !!old.read ? (rd ? '; reading Elvanto’s unavailable dates switched on' : '; reading Elvanto’s unavailable dates switched off') : ''));
        H.render(); H.toast(T('Saved'));
      },
      elretry: function (el) { var e = JSON.parse(JSON.stringify(S.get('elvantoSync', el.dataset.id))); e.status = 'Waiting'; e.note = 'Trying again – the robot will do it on its next run.'; S.put('elvantoSync', e, 'Asked the Elvanto robot to try again'); H.render(); },
      eldone: function (el) {
        if (!H.confirmBtn(el, T('Click again: done in Elvanto'))) return;
        var e = JSON.parse(JSON.stringify(S.get('elvantoSync', el.dataset.id)));
        e.status = 'Done'; e.have = e.want === 'Unavailable' ? e.start + ' to ' + e.end : ''; e.note = 'Done by hand by ' + H.name(H.user()) + '.';
        S.put('elvantoSync', e, 'Marked an Elvanto update as done by hand'); H.render();
      },
      addadj: function (el) {
        var days = Number(document.getElementById('adj-d').value), note = document.getElementById('adj-n').value.trim(), t = document.getElementById('adj-t').value;
        if (!t || !days) { H.toast(T('Choose the kind of leave and the number of days (use − to take days off)'), true); return; }
        var lv = S.leave(), st = C.staffById(data(), el.dataset.id);
        lv.adjustments = lv.adjustments || [];
        lv.adjustments.push({ id: 'ADJ-' + Date.now().toString(36), staffId: el.dataset.id, year: +el.dataset.y, type: t, days: days, note: note });
        S.saveLeave('Adjustment of ' + days + ' days ' + t + ' for ' + (st ? st.name : '')); H.render(); H.toast(T('Adjustment added'));
      },
      staffcsv: function (el) {
        var d = data(), st = C.staffById(d, el.dataset.id), ctx = C.ctx(d);
        var rows = [['Leave year', 'Start', 'End', 'Kind of leave', 'Days', 'Status', 'Reason', 'Asked', 'Decided by', 'Decided on', 'Cancelled by', 'From']];
        d.requests.filter(function (r) { return r.staffId === st.id && !r.synthetic; }).sort(function (a, b) { return a.start < b.start ? -1 : 1; }).forEach(function (r) {
          var t = typeOf(d, r.type); rows.push([C.lyLabel(C.lyOf(r.start, ctx.S), ctx.S), r.start, r.end, t.name, C.amount(r, t, ctx), r.status, r.reason || '', String(r.submitted || '').slice(0, 10), r.decidedBy || '', String(r.decidedOn || '').slice(0, 10), r.cancelledBy || '', r.source || '']);
        });
        rows.push([]); rows.push(['Balances', C.lyLabel(C.lyOf(H.today(), ctx.S), ctx.S)]); rows.push(['Kind of leave', 'Allowance', 'Taken', 'Waiting', 'Left']);
        var b = C.balances(d, st.id, C.lyOf(H.today(), ctx.S));
        d.types.forEach(function (t) { var x = b[t.code]; if (x && x.entitled != null) rows.push([t.name, x.entitled, x.approved || 0, x.pending || 0, x.available]); });
        S.audit('Downloaded the leave report of ' + st.name, 'people/' + st.id);
        H.download('leave-' + st.name.toLowerCase().replace(/\W+/g, '-') + '-' + H.today() + '.csv', csv(rows), 'text/csv');
      },
      teamcsv: function () {
        var d = data(), ctx = C.ctx(d), y = C.lyOf(H.today(), ctx.S), types = d.types.filter(function (t) { return t.deducts; });
        var rows = [['Staff', 'Category'].concat(types.map(function (t) { return t.name + ' – left'; }))];
        d.staff.filter(function (s) { return C.tracksLeave(s) && s.active; }).forEach(function (s) {
          var b = C.balances(d, s.id, y); rows.push([s.name, s.level].concat(types.map(function (t) { var x = b[t.code]; return x && x.entitled != null ? x.available : ''; })));
        });
        S.audit('Downloaded team leave balances', 'leave');
        H.download('leave-balances-' + C.lyLabel(y, ctx.S).replace('/', '-') + '.csv', csv(rows), 'text/csv');
      },
      savegeneral: function () {
        var lv = S.leave(), open = picked('ls-open');
        if (!open) { H.toast(T('Tick at least one day the church is open'), true); return; }
        lv.settings.LeaveYearStartMonth = +document.getElementById('ls-start').value; lv.settings.OpenDays = open;
        lv.settings.ProRata = document.getElementById('ls-prorata').checked ? 'TRUE' : 'FALSE';
        lv.settings.AllowNegative = document.getElementById('ls-neg').checked ? 'TRUE' : 'FALSE';
        S.saveLeave('Changed leave settings'); H.render(); H.toast(T('Saved'));
      },
      addterm: function () { var box = document.getElementById('ls-terms'), div = document.createElement('div'); div.innerHTML = termRow({}); box.appendChild(div.firstChild); box.lastChild.querySelector('input').focus(); },
      delterm: function (el) { el.closest('.ls-term').remove(); var b = document.querySelector('[data-act="leave:saveterms"]'); if (b) b.click(); },
      saveterms: function () {
        var out = [], bad = '';
        document.querySelectorAll('.ls-term').forEach(function (r) {
          var n = r.querySelector('.ls-tn').value.trim(), a = r.querySelector('.ls-ts').value, b = r.querySelector('.ls-te').value;
          if (!n && !a && !b) return;
          if (!n || !a || !b || b < a) bad = T('Each term needs a name, a start and an end date (the end after the start).'); else out.push({ name: n, start: a, end: b });
        });
        if (bad) { H.toast(bad, true); return; }
        S.leave().terms = out.sort(function (x, y) { return x.start < y.start ? -1 : 1; });
        S.saveLeave('Changed school terms'); H.render(); H.toast(T('Terms saved'));
      },
      savelevels: function () {
        var lv = S.leave(), bad = '';
        document.querySelectorAll('#ls-levels tbody tr').forEach(function (tr) {
          var l = lv.levels[+tr.dataset.i], wd = picked('ls-wd', tr);
          if (!wd) bad = T('Tick the working days for {category}.', { category: l.level });
          l.workDays = wd; l.ent = {};
          tr.querySelectorAll('.ls-ent').forEach(function (inp) { if (inp.value !== '' && !isNaN(inp.value)) l.ent[inp.dataset.code] = Number(inp.value); });
        });
        if (bad) { H.toast(bad, true); return; }
        S.saveLeave('Changed staff categories and allowances'); H.render(); H.toast(T('Categories saved'));
      },
      addlevel: function () {
        var n = (prompt(T('Name of the new staff category (e.g. Youth Worker)')) || '').trim(); if (!n) return;
        var lv = S.leave();
        if (lv.levels.some(function (l) { return l.level.toLowerCase() === n.toLowerCase(); })) { H.toast(T('There is already a category called {name}', { name: n }), true); return; }
        lv.levels.push({ level: n, label: n, workDays: lv.settings.OpenDays || 'Mon, Tue, Wed, Thu, Fri', ent: {} });
        S.saveLeave('Added staff category ' + n); H.render(); H.toast(T('Added – now fill in its days and allowances'));
      },
      dellevel: function (el) { if (!H.confirmBtn(el, '✕?')) return; var lv = S.leave(), l = lv.levels.splice(+el.dataset.i, 1)[0]; S.saveLeave('Removed staff category ' + l.level); H.render(); },
      mailgo: function () {
        var st = S.settings() || {}, E = window.Emails, method = E ? E.getMethod(st) : 'mail', $ = function (id) { return document.getElementById(id); };
        var url = E.makeSendUrl(method, { to: $('le-to').value, subject: $('le-sub').value, body: $('le-body').value, from: st.emailGmail || '' });
        H.closeModal(); if (method === 'gmail') window.open(url, '_blank', 'noopener,noreferrer'); else location.href = url;
      },
      weeklydone: function () { var lv = S.leave(); lv.settings.LastWeeklyEmail = H.today(); S.saveLeave('Sent the weekly “who’s away” email'); H.render(); H.toast(T('Saved')); },
      reminddone: function () { var lv = S.leave(); lv.settings.LastReminder = H.today(); S.saveLeave('Sent the “use it or lose it” reminders'); H.go('leave/dashboard'); H.toast(T('Saved')); },
      remind: function (el) {
        var d = data(), s = C.staffById(d, el.dataset.id), u = C.useItOrLoseIt(d, s.id, H.today());
        emailTo(personEmail(s.id), T('Your leave: use it or lose it'), T('Dear {name},', { name: firstName(s.id) }) + '\n\n' + T('A reminder that this leave will be lost if it isn’t taken in time:') + '\n' +
          u.map(function (x) { return '• ' + C.fmtDays(x.left) + ' ' + x.type.name + ' – ' + T('take it by {date}', { date: H.fmt(x.until, true) }); }).join('\n') + '\n\n' + T('You can book it in Church Hub under Leave.') + '\n\n' + signOff(), s.name);
      },
      change: function (el) { requestDialog(null, el.dataset.id); },
      print: function (el) { var d = data(), st = C.staffById(d, el.dataset.id); LeaveReports.printPerson(d, el.dataset.id, +el.dataset.y || yearOf(d)); if (st) S.audit('Printed the leave report of ' + st.name, 'people/' + st.id); },
      printall: function (el) { var d = data(); LeaveReports.printAll(d, yearOf(d), !!el.dataset.full); S.audit('Printed the all-staff leave ' + (el.dataset.full ? 'report' : 'summary'), 'leave'); },
      payroll: function () { var d = data(); H.download('payroll-unpaid-leave-' + H.today() + '.csv', csv(LeaveReports.payrollRows(d, yearOf(d))), 'text/csv'); S.audit('Downloaded the payroll file (unpaid leave)', 'leave'); },
      awayview: function (el) { state.away = el.dataset.v; H.render(); },
      month: function (el) { state.month = el.dataset.m; H.render(); },
      addrule: function (el) {
        var lv = S.leave(); lv.rules = document.querySelector('.ls-rule') ? typedRules() : (lv.rules || []);
        lv.rules.push(JSON.parse(JSON.stringify(PRESETS[el.dataset.preset] || PRESETS.blank)));
        H.render(); var rows = document.querySelectorAll('.ls-rule'); if (rows.length) rows[rows.length - 1].scrollIntoView({ block: 'center' });
        if (el.dataset.preset !== 'blank') { S.saveLeave('Added a cover rule: ' + lv.rules[lv.rules.length - 1].name); H.toast(T('Added')); } else H.toast(T('Added – give it a name'));
      },
      delrule: function (el) { var lv = S.leave(); lv.rules = typedRules(); lv.rules.splice(+el.dataset.i, 1); S.saveLeave('Removed a cover rule'); H.render(); H.toast(T('Removed')); },
      saverules: function () {
        var rules = typedRules(), bad = rules.filter(function (r) { return !r.name || (r.from && !C.ruleDate(r.from, 2026)) || (r.to && !C.ruleDate(r.to, 2026)); })[0];
        if (bad) { H.toast(bad.name ? T('Check the From and To dates of “{name}”', { name: bad.name }) : T('Every rule needs a name.'), true); return; }
        var lv = S.leave(); lv.rules = rules; S.saveLeave('Saved the cover rules (' + rules.length + ')'); H.render(); H.toast(T('Saved'));
      },
      standin: function () {
        var who = document.getElementById('si-who').value, from = document.getElementById('si-from').value, to = document.getElementById('si-to').value;
        if (!who || !from || !to || to < from) { H.toast(T('Choose the person and both dates'), true); return; }
        var lv = S.leave(), was = lv.settings.StandInID;
        if (was && was !== who) S.setStandIn(was, '', '');
        lv.settings.StandInID = who; lv.settings.StandInFrom = from; lv.settings.StandInTo = to;
        S.saveLeave('Stand-in approver: ' + H.name(S.get('people', who)) + ' from ' + from + ' to ' + to);
        S.setStandIn(who, from, to); H.render(); H.toast(T('Stand-in set'));
      },
      standinoff: function () {
        var lv = S.leave(), was = lv.settings.StandInID; if (!was) return;
        lv.settings.StandInID = ''; lv.settings.StandInFrom = ''; lv.settings.StandInTo = '';
        S.saveLeave('Removed the stand-in approver'); S.setStandIn(was, '', ''); H.render(); H.toast(T('Removed'));
      },
      savetypes: function () {
        var lv = S.leave(), bad = '';
        document.querySelectorAll('.ls-tname').forEach(function (inp) { var n = inp.value.trim(); if (!n) bad = T('Every kind of leave needs a name.'); else lv.types[+inp.dataset.i].name = n; });
        if (bad) { H.toast(bad, true); return; }
        document.querySelectorAll('.ls-tappr').forEach(function (b) { lv.types[+b.dataset.i].needsApproval = b.checked; });
        document.querySelectorAll('.ls-tuse').forEach(function (b) { lv.types[+b.dataset.i].active = b.checked; });
        S.saveLeave('Changed kinds of leave'); H.render(); H.toast(T('Saved'));
      },
      addtype: function () {
        H.modal(H.dialogHead(T('Add a kind of leave')) + '<div class="dlg-body"><label class="field req">' + T('Name') + '<input id="nt-n" placeholder="' + esc(T('e.g. Study Leave')) + '"></label>' +
          '<label class="check"><input type="checkbox" id="nt-d" checked><span>' + T('Uses an allowance (days per year, set per category)') + '</span></label>' +
          '<label class="check"><input type="checkbox" id="nt-h" checked><span>' + T('Half days allowed') + '</span></label></div>' +
          '<div class="dlg-foot"><button class="btn" data-act="hub:close">' + T('Cancel') + '</button><button class="btn primary" data-act="leave:savetype">' + T('Add') + '</button></div>', T('Add a kind of leave'));
      },
      savetype: function () {
        var n = document.getElementById('nt-n').value.trim(); if (!n) return;
        var lv = S.leave(), code = n.split(/\s+/).map(function (w) { return w[0]; }).join('').toUpperCase().replace(/[^A-Z]/g, '') || 'X', base = code, i = 2;
        while (lv.types.some(function (t) { return t.code === code; })) code = base + i++;
        var COLS = ['#2F80C0', '#7C3AED', '#0E7490', '#A16207', '#B0527A', '#4C9A6A'];
        lv.types.push({ code: code, name: n, colour: COLS[lv.types.length % COLS.length], deducts: document.getElementById('nt-d').checked, halfDay: document.getElementById('nt-h').checked, proRata: false, needsApproval: true, unit: 'Days' });
        var ded = document.getElementById('nt-d').checked;
        S.saveLeave('Added leave type ' + n); H.closeModal(); H.render(); H.toast(T(ded ? 'Added – now set the days per category' : 'Added'));
      },
      addsa: function (el) {
        var lv = S.leave(), y = +el.dataset.y, have = {};
        lv.holidays.forEach(function (h) { have[h.date] = 1; });
        C.saPublicHolidays(y).forEach(function (h) { if (!have[h.date]) lv.holidays.push(h); });
        S.saveLeave('Added public holidays for ' + y); H.render(); H.toast(T('Public holidays for {year} added', { year: y }));
      },
      addhol: function () {
        var dt = document.getElementById('ls-hd').value, n = document.getElementById('ls-hn').value.trim();
        if (!dt || !n) { H.toast(T('Choose a date and give it a name'), true); return; }
        var lv = S.leave(); if (lv.holidays.some(function (h) { return h.date === dt; })) { H.toast(T('That day is already listed'), true); return; }
        lv.holidays.push({ date: dt, name: n, church: true }); S.saveLeave('Added a church closure: ' + n); H.render(); H.toast(T('Added'));
      },
      delhol: function (el) { var lv = S.leave(); lv.holidays = lv.holidays.filter(function (h) { return h.date !== el.dataset.date; }); S.saveLeave('Removed a holiday'); H.render(); },
      request: function (el) { requestDialog(el && el.dataset ? el.dataset.who : ''); },
      send: function () {
        var d = data(), $ = function (id) { return document.getElementById(id); };
        if ($('lf-edit')) {   // changing a request: type, dates or note (Leave Manager's "Change")
          try {
            var ch = C.prepareEdit(d, actor(d), $('lf-edit').value, { type: $('lf-type').value, start: $('lf-start').value, end: $('lf-end').value || $('lf-start').value, half: 'None', reason: $('lf-note').value }, H.today());
            var rq = ch.req; rq.type = ch.next.type; rq.start = ch.next.start; rq.end = ch.next.end; rq.half = ch.next.half; rq.reason = ch.next.reason; rq.days = ch.next.days; rq.status = ch.status;
            rq.changedBy = H.name(H.user()); rq.changedOn = H.today(); if (ch.reapprove) { delete rq.decidedBy; delete rq.decidedOn; }
            S.saveLeave('Changed leave of ' + ch.staff.name + ': ' + ch.changes.join('; ')); H.closeModal(); H.render();
            H.toast(ch.reapprove ? T('Changed – it goes back to the Administrator for approval') : T('Changed'));
          } catch (e) { $('lf-err').hidden = false; $('lf-err').textContent = e.message; }
          return;
        }
        try {
          var p = C.prepareRequest(d, actor(d), { staffId: $('lf-who').value, type: $('lf-type').value, start: $('lf-start').value, end: $('lf-end').value || $('lf-start').value, half: 'None', reason: $('lf-note').value });
          var r = p.req; r.id = 'L' + Date.now().toString(36).toUpperCase(); r.submitted = H.today(); r.source = 'Hub';
          S.leave().requests.push(r); S.saveLeave((r.status === 'Approved' ? 'Booked ' : 'Requested ') + p.type.name + ' for ' + p.staff.name);
          H.closeModal(); H.render(); H.toast(r.status === 'Approved' ? T('Booked') : T('Sent – the Administrator will approve it'));
          if (r.status === 'Pending' && r.staffId === H.user().id && officeEmail()) emailTo(officeEmail(), T('Leave request: {name}, {dates}', { name: p.staff.name, dates: range(r) }),
            T('Hello,') + '\n\n' + T('I’ve asked for {type} for {dates} in Church Hub.', { type: p.type.name, dates: range(r) }) + (r.reason ? '\n' + r.reason : '') + '\n\n' + p.staff.name, T('The request is saved. You can also let the church office know.'));
        } catch (e) { $('lf-err').hidden = false; $('lf-err').textContent = e.message; }
      },
      decide: function (el) {
        if (el.dataset.d === 'Approved' && el.dataset.over && !el.dataset.sure) { H.confirmBtn(el, T('Approve anyway')); H.toast(T('This is more than their allowance'), true); return; }
        var d = data();
        try {
          var p = C.prepareDecision(d, actor(d), el.dataset.id, el.dataset.d);
          p.req.status = el.dataset.d; p.req.decidedBy = H.name(H.user()); p.req.decidedOn = H.today();
          S.saveLeave(el.dataset.d + ' leave for ' + p.staff.name); H.render(); H.toast(T(el.dataset.d === 'Approved' ? 'Approved' : 'Declined'));
          if (personEmail(p.staff.id)) emailTo(personEmail(p.staff.id), (el.dataset.d === 'Approved' ? T('Your leave is approved') : T('Your leave request was declined')),
            T('Dear {name},', { name: firstName(p.staff.id) }) + '\n\n' + T(el.dataset.d === 'Approved' ? TX('Your {type} for {dates} is approved.') : TX('Your request for {type} for {dates} was declined. Please speak to me if you’d like to talk about it.'), { type: p.type ? p.type.name : '', dates: range(p.req) }) + '\n\n' + H.name(H.user()), p.staff.name);
        } catch (e) { H.toast(e.message, true); }
      },
      cancel: function (el) {
        if (!H.confirmBtn(el, T('Click again to cancel'))) return;
        var d = data();
        try { var p = C.prepareCancel(d, actor(d), el.dataset.id, H.today()); p.req.status = 'Cancelled'; p.req.cancelledBy = H.name(H.user()); S.saveLeave('Cancelled leave'); H.render(); H.toast(T('Cancelled')); }
        catch (e) { H.toast(e.message, true); }
      }
    }
  });
  /** For the Me page: what the person has left this leave year, if they're staff who take leave. */
  window.LeaveUI = {
    meCard: function () {
      var d = data(), me = H.user(), st = me && C.staffById(d, me.id); if (!st || !C.tracksLeave(st)) return '';
      var y = C.lyOf(H.today(), C.ctx(d).S), bal = C.balances(d, me.id, y);
      var rows = d.types.filter(function (t) { return t.deducts && C.offered(d, st, t) && bal[t.code] && bal[t.code].entitled != null; }).map(function (t) {
        return '<dt><span class="dot" style="--c:' + esc(t.colour) + '"></span> ' + esc(t.name) + '</dt><dd><b>' + C.fmtDays(bal[t.code].available) + '</b> ' + esc(T('of {n} left', { n: C.fmtDays(bal[t.code].entitled) })) + '</dd>';
      }).join('');
      return rows ? '<section class="panel"><h2>' + esc(T('Your leave in {year}', { year: C.lyLabel(y, C.ctx(d).S) })) + '</h2><dl class="kv">' + rows + '</dl><div class="btns" style="margin-top:12px"><a class="btn" href="#/leave">' + T('Book or see my leave') + '</a></div></section>' : '';
    }
  };
})();
