/* Church Hub – Leave (Leave Manager built in). Uses LeaveCore, the same rules file as Leave Manager. */
(function () {
  'use strict';
  var H = Hub, esc = H.esc, S = Store, C = LeaveCore;
  var state = { tab: '' };

  /** Leave Manager's data shape, with staff taken from People. */
  function data() {
    var lv = S.leave();
    var staff = S.find('people', function (p) { return p.staff; }).map(function (p) {
      return { id: p.id, name: H.name(p), email: p.email, level: p.staff.category, workDays: p.staff.workDays || '', role: p.appRole === 'admin' ? 'Administrator' : 'Staff', start: p.staff.start, active: p.active !== false };
    });
    return { settings: lv.settings, rules: lv.rules, terms: lv.terms, types: lv.types, levels: lv.levels, holidays: lv.holidays, adjustments: lv.adjustments, requests: lv.requests, staff: staff };
  }
  function actor(d) { return C.staffById(d, H.user().id) || { id: H.user().id, name: H.name(H.user()), role: H.can('*') ? 'Administrator' : 'Staff', level: 'Administrator' }; }
  function isLeaveAdmin() { return H.can('*'); }
  function takesLeave(d) { var st = C.staffById(d, H.user().id); return st && C.tracksLeave(st); }
  function typeOf(d, code) { return C.type(d, code) || { name: code, colour: '#64748B' }; }
  function pill(st) { return '<span class="tag ' + ({ Approved: 'ok', Pending: 'warn', Declined: 'bad', Cancelled: 'grey' }[st] || 'grey') + '">' + esc(st === 'Pending' ? 'Waiting' : st) + '</span>'; }
  function range(r) { return r.start === r.end ? H.fmt(r.start, true) + (r.half && r.half !== 'None' ? ' (' + (r.half === 'AM' ? 'morning' : 'afternoon') + ')' : '') : H.fmt(r.start) + ' – ' + H.fmt(r.end, true); }

  function tabs(d, active) {
    var t = [];
    if (takesLeave(d)) t.push(['', 'My leave']);
    if (isLeaveAdmin()) { t.push(['approvals', 'Approvals']); t.push(['team', 'Team balances']); }
    t.push(['away', 'Who’s away']);
    if (isLeaveAdmin()) t.push(['settings', 'Settings']);
    return t.length > 1 ? '<nav class="seg" aria-label="Leave" style="margin-bottom:18px">' + t.map(function (x) { return '<a href="#/leave' + (x[0] ? '/' + x[0] : '') + '" class="' + (x[0] === active ? 'on' : '') + '">' + x[1] + '</a>'; }).join('') + '</nav>' : '';
  }

  function renderMine(d) {
    var me = H.user(), y = C.lyOf(H.today(), C.ctx(d).S), st = C.staffById(d, me.id);
    var bal = C.balances(d, me.id, y);
    var cards = d.types.filter(function (t) { return t.deducts && C.offered(d, st, t); }).map(function (t) {
      var b = bal[t.code]; if (!b || b.entitled == null) return '';
      var used = b.entitled - b.available, pct = b.entitled ? Math.max(0, Math.min(100, used / b.entitled * 100)) : 0;
      return '<div class="stat" style="--c:' + esc(t.colour) + '"><span>' + esc(t.name) + '</span><b>' + C.fmtDays(b.available) + '</b><span>' + esc(C.unitName(t, b.available)) + ' left of ' + C.fmtDays(b.entitled) + (b.pending ? ' · ' + C.fmtDays(b.pending) + ' waiting' : '') + '</span><div class="bar"><i style="width:' + pct + '%"></i></div></div>';
    }).join('');
    var mine = d.requests.filter(function (r) { return r.staffId === me.id && r.end >= H.today() && (r.status === 'Pending' || r.status === 'Approved'); }).sort(function (a, b) { return a.start < b.start ? -1 : 1; });
    return '<section class="block"><h2>What you have left in ' + esc(C.lyLabel(y, C.ctx(d).S)) + '</h2><div class="bal">' + cards + '</div></section>' +
      '<section class="block"><h2>Your upcoming leave</h2>' + (mine.length ? '<div class="list">' + mine.map(function (r) {
        var t = typeOf(d, r.type);
        return '<div class="item"><span class="dot" style="--c:' + esc(t.colour) + '"></span><span class="grow"><b>' + esc(range(r)) + '</b><small>' + esc(t.name + ' · ' + C.fmtAmount(t, C.amount(r, t, C.ctx(d))) + (r.reason ? ' · ' + r.reason : '')) + '</small></span>' + pill(r.status) +
          (r.status === 'Pending' || r.start > H.today() ? '<button class="btn small" data-act="leave:cancel" data-id="' + r.id + '">Cancel</button>' : '') + '</div>';
      }).join('') + '</div>' : '<p class="empty">No leave booked. Use “Request leave” to book some.</p>') + '</section>';
  }

  function renderApprovals(d) {
    var pend = d.requests.filter(function (r) { return r.status === 'Pending'; }).sort(function (a, b) { return a.start < b.start ? -1 : 1; });
    return '<section class="block"><h2>Waiting for your decision</h2>' + (pend.length ? '<div class="list">' + pend.map(function (r) {
      var st = C.staffById(d, r.staffId), t = typeOf(d, r.type), w = st ? C.requestWarnings(d, st, r, r.id, true) : [];
      return '<div class="item" style="align-items:flex-start"><span class="dot" style="--c:' + esc(t.colour) + ';margin-top:6px"></span><span class="grow"><b>' + esc(st ? st.name : '?') + ' · ' + esc(range(r)) + '</b><small>' + esc(t.name + ' · ' + C.fmtAmount(t, C.amount(r, t, C.ctx(d))) + (r.reason ? ' · “' + r.reason + '”' : '')) + '</small>' +
        (w.length ? '<span class="note warn" style="display:block;margin:8px 0 0;font-size:13px">⚠ ' + w.map(esc).join('<br>⚠ ') + '</span>' : '') + '</span>' +
        '<span class="btns"><button class="btn small" data-act="leave:decide" data-id="' + r.id + '" data-d="Declined">Decline</button><button class="btn small ok" data-act="leave:decide" data-id="' + r.id + '" data-d="Approved"' + (C.allowanceWarning(d, st, r, r.id, true) ? ' data-over="1"' : '') + '>Approve</button></span></div>';
    }).join('') + '</div>' : '<p class="empty">Nothing is waiting for approval.</p>') + '</section>';
  }

  function renderTeam(d) {
    var y = C.lyOf(H.today(), C.ctx(d).S), types = d.types.filter(function (t) { return t.deducts; });
    var staff = d.staff.filter(function (s) { return C.tracksLeave(s) && s.active; });
    return '<section class="block"><h2>Days left in ' + esc(C.lyLabel(y, C.ctx(d).S)) + '</h2><div class="panel table-wrap"><table class="simple"><thead><tr><th>Staff</th>' + types.map(function (t) { return '<th>' + esc(t.code) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      staff.map(function (s) {
        var b = C.balances(d, s.id, y);
        return '<tr><td><b>' + esc(s.name) + '</b><br><span class="muted small">' + esc(s.level) + '</span></td>' + types.map(function (t) { var x = b[t.code]; return '<td>' + (x && x.entitled != null ? C.fmtDays(x.available) : '<span class="muted">–</span>') + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table></div><p class="hint">' + types.map(function (t) { return esc(t.code + ' = ' + t.name); }).join(' · ') + '</p></section>';
  }

  function renderAway(d) {
    var t = H.today(), end = C.iso(C.addDays(C.parse(t), 42));
    var list = d.requests.filter(function (r) { return (r.status === 'Approved' || (isLeaveAdmin() && r.status === 'Pending')) && r.end >= t && r.start <= end; }).sort(function (a, b) { return a.start < b.start ? -1 : 1; });
    return '<section class="block"><h2>Away in the next 6 weeks</h2>' + (list.length ? '<div class="list">' + list.map(function (r) {
      var st = C.staffById(d, r.staffId), tp = typeOf(d, r.type);
      return '<div class="item"><span class="dot" style="--c:' + esc(tp.colour) + '"></span><span class="grow"><b>' + esc(st ? st.name : (H.name(S.get('people', r.staffId)) || 'A staff member')) + '</b><small>' + esc(range(r)) + (isLeaveAdmin() ? ' · ' + esc(tp.name) : '') + '</small></span>' + (r.status === 'Pending' ? pill('Pending') : '') + '</div>';
    }).join('') + '</div>' : '<p class="empty">No one is away.</p>') + '<p class="hint">Approved leave also stops people being rostered on those days.</p></section>';
  }

  /* ---------- settings (Administrators): the same settings as Leave Manager's sheet tabs ---------- */
  var DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function dayBoxes(cls, value, extra) {
    var on = String(value || '').split(/\s*,\s*/);
    return '<span class="daybox">' + DAYS.map(function (d) { return '<label title="' + d + '"><input type="checkbox" class="' + cls + '" value="' + d + '"' + (extra || '') + (on.indexOf(d) >= 0 ? ' checked' : '') + '><span>' + d.slice(0, 2) + '</span></label>'; }).join('') + '</span>';
  }
  function picked(cls, scope) { var out = []; (scope || document).querySelectorAll('.' + cls + ':checked').forEach(function (b) { out.push(b.value); }); return out.join(', '); }

  function renderSettings(d) {
    var lv = S.leave(), st = lv.settings, ded = lv.types.filter(function (t) { return t.deducts; });
    var staffCount = {}; d.staff.forEach(function (s) { staffCount[s.level] = (staffCount[s.level] || 0) + 1; });
    var y = new Date().getFullYear(), years = [y, y + 1];
    var html = '<p class="muted">These work exactly like the tabs in the Leave Manager sheet. Changes apply straight away to everyone’s balances.</p><div class="grid2">';

    // General
    html += '<section class="panel"><h2>General</h2>' +
      '<label class="field">The leave year starts in<select id="ls-start">' + MONTHS.map(function (m, i) { return '<option value="' + (i + 1) + '"' + (Number(st.LeaveYearStartMonth || 1) === i + 1 ? ' selected' : '') + '>' + m + '</option>'; }).join('') + '</select></label>' +
      '<div class="field">Days the church is open<br>' + dayBoxes('ls-open', st.OpenDays) + '<small>Used for anyone without their own working days.</small></div>' +
      '<label class="check"><input type="checkbox" id="ls-prorata"' + (/^false$/i.test(String(st.ProRata)) ? '' : ' checked') + '><span>New staff get a share of the year’s allowance (pro-rata)</span></label>' +
      '<label class="check"><input type="checkbox" id="ls-neg"' + (/^true$/i.test(String(st.AllowNegative)) ? ' checked' : '') + '><span>Staff may ask for more leave than they have left (Administrators can always approve it)</span></label>' +
      '<button class="btn small" data-act="leave:savegeneral">Save</button></section>';

    // Terms
    var terms = lv.terms.slice().sort(function (a, b) { return a.start < b.start ? -1 : 1; });
    html += '<section class="panel"><h2>School terms</h2><p class="hint" style="margin-top:0">Needed for leave limited per term (e.g. one Weekend Off per term).</p><div id="ls-terms">' +
      terms.map(termRow).join('') + '</div><div class="btns" style="margin-top:8px"><button class="btn small" data-act="leave:addterm">' + H.icon(H.ICON.plus, 16) + 'Add a term</button><button class="btn small primary" data-act="leave:saveterms">Save terms</button></div></section>';

    // Categories and allowances
    html += '<section class="panel" style="grid-column:1/-1"><h2>Staff categories and allowances</h2><p class="hint" style="margin-top:0">Days per leave year for each category. Leave a box empty if that category doesn’t get that kind of leave. The “Administrator” category manages leave but doesn’t take it here.</p>' +
      '<div class="table-wrap"><table class="simple" id="ls-levels"><thead><tr><th>Category</th><th>Working days</th>' + ded.map(function (t) { return '<th title="' + esc(t.name) + '">' + esc(t.code) + '</th>'; }).join('') + '<th></th></tr></thead><tbody>' +
      lv.levels.map(function (l, i) {
        return '<tr data-i="' + i + '"><td><b>' + esc(l.label || l.level) + '</b><br><span class="muted small">' + (staffCount[l.level] || 0) + ' staff</span></td><td>' + dayBoxes('ls-wd', l.workDays) + '</td>' +
          ded.map(function (t) { var v = l.ent[t.code]; return '<td><input class="ls-ent" data-code="' + t.code + '" type="number" min="0" step="0.5" style="width:64px" value="' + (v == null ? '' : v) + '" aria-label="' + esc(t.name + ' for ' + l.level) + '"></td>'; }).join('') +
          '<td>' + (staffCount[l.level] ? '' : '<button class="icon-btn ghost" data-act="leave:dellevel" data-i="' + i + '" aria-label="Remove category ' + esc(l.level) + '">' + H.icon(H.ICON.trash, 18) + '</button>') + '</td></tr>';
      }).join('') + '</tbody></table></div><p class="hint">' + ded.map(function (t) { return esc(t.code + ' = ' + t.name); }).join(' · ') + '</p>' +
      '<div class="btns"><button class="btn small" data-act="leave:addlevel">' + H.icon(H.ICON.plus, 16) + 'Add a category</button><button class="btn small primary" data-act="leave:savelevels">Save categories</button></div></section>';

    // Leave types
    html += '<section class="panel"><h2>Kinds of leave</h2><div class="list">' + lv.types.map(function (t, i) {
      return '<div class="item" style="flex-wrap:wrap"><span class="dot" style="--c:' + esc(t.colour) + '"></span><span class="grow" style="min-width:160px"><input class="ls-tname" data-i="' + i + '" value="' + esc(t.name) + '" aria-label="Name" style="width:100%"><small>' + esc(t.code) + ' · ' + (t.deducts ? 'uses an allowance' : 'no allowance') + (t.perTerm ? ' · ' + t.perTerm + ' per term' : '') + '</small></span>' +
        '<label class="check" style="margin:0"><input type="checkbox" class="ls-tappr" data-i="' + i + '"' + (t.needsApproval === false ? '' : ' checked') + '><span>Needs approval</span></label>' +
        '<label class="check" style="margin:0"><input type="checkbox" class="ls-tuse" data-i="' + i + '"' + (t.active === false ? '' : ' checked') + '><span>In use</span></label></div>';
    }).join('') + '</div><div class="btns" style="margin-top:10px"><button class="btn small" data-act="leave:addtype">' + H.icon(H.ICON.plus, 16) + 'Add a kind of leave</button><button class="btn small primary" data-act="leave:savetypes">Save</button></div></section>';

    // Public holidays
    var hol = lv.holidays.filter(function (h) { return +h.date.slice(0, 4) >= y; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var missing = years.filter(function (yy) { return !lv.holidays.some(function (h) { return +h.date.slice(0, 4) === yy && !h.church; }); });
    html += '<section class="panel"><h2>Public holidays and church closures</h2><p class="hint" style="margin-top:0">These days don’t use anyone’s leave.</p>' +
      (missing.length ? '<p class="note warn">' + missing.map(function (yy) { return '<button class="btn small" data-act="leave:addsa" data-y="' + yy + '">Add South African public holidays for ' + yy + '</button>'; }).join(' ') + '</p>' : '') +
      '<div class="list" style="max-height:320px;overflow:auto">' + hol.map(function (h) {
        return '<div class="item"><span class="grow"><b>' + esc(H.fmt(h.date, true)) + '</b><small>' + esc(h.name) + '</small></span><button class="icon-btn ghost" data-act="leave:delhol" data-date="' + h.date + '" aria-label="Remove ' + esc(h.name) + '">' + H.icon(H.ICON.trash, 18) + '</button></div>';
      }).join('') + '</div><div class="two" style="margin-top:10px"><label class="field">Date<input type="date" id="ls-hd"></label><label class="field">Name<input id="ls-hn" placeholder="e.g. Office closed – Christmas week"></label></div>' +
      '<button class="btn small" data-act="leave:addhol">Add this day</button>' +
      (lv.holidays.some(function (h) { return +h.date.slice(0, 4) === y + 2 && !h.church; }) ? '' : ' <button class="link" data-act="leave:addsa" data-y="' + (y + 2) + '">Add public holidays for ' + (y + 2) + '</button>') +
      '</section>';
    return html + '</div>';
  }
  function termRow(t) {
    return '<div class="ls-term"><label class="field" style="margin:0 0 6px">Name<input class="ls-tn" value="' + esc(t.name || '') + '" placeholder="e.g. Term 1 2027"></label>' +
      '<div class="ls-term-dates"><label class="field" style="margin:0">Starts<input type="date" class="ls-ts" value="' + esc(t.start || '') + '"></label><label class="field" style="margin:0">Ends<input type="date" class="ls-te" value="' + esc(t.end || '') + '"></label>' +
      '<button class="icon-btn ghost" data-act="leave:delterm" aria-label="Remove this term">' + H.icon(H.ICON.trash, 18) + '</button></div></div>';
  }

  /* ---------- request form ---------- */
  function requestDialog() {
    var d = data(), me = H.user(), admin = isLeaveAdmin();
    var people = d.staff.filter(function (s) { return C.tracksLeave(s) && s.active && (s.id === me.id || admin); });
    if (!people.length) { H.toast('Leave is for staff members', true); return; }
    var who = people.filter(function (s) { return s.id === me.id; })[0] || people[0];
    H.modal(H.dialogHead(admin && who.id !== me.id ? 'Book leave' : 'Request leave', 'Only your working days are counted.') + '<form class="dlg-body" id="lf" novalidate>' +
      (people.length > 1 ? '<label class="field">For<select id="lf-who">' + people.map(function (s) { return '<option value="' + s.id + '"' + (s.id === who.id ? ' selected' : '') + '>' + esc(s.name) + (s.id === me.id ? ' (you)' : '') + '</option>'; }).join('') + '</select></label>' : '<input type="hidden" id="lf-who" value="' + who.id + '">') +
      '<label class="field">Type of leave<select id="lf-type"></select></label><div id="lf-bal"></div>' +
      '<div class="two"><label class="field">First day<input type="date" id="lf-start"></label><label class="field">Last day<input type="date" id="lf-end"></label></div>' +
      '<label class="field">Note for the Administrator' + (admin ? ' <small>(optional)</small>' : '') + '<textarea id="lf-note" rows="2" placeholder="What is the leave for?"></textarea></label>' +
      '<div id="lf-sum" class="note info" hidden></div><div id="lf-err" class="note bad" hidden></div></form>' +
      '<div class="dlg-foot"><button class="btn" data-act="hub:close">Cancel</button><button class="btn primary" id="lf-go" data-act="leave:send">Send request</button></div>', 'Request leave');
    var $ = function (id) { return document.getElementById(id); };
    function fillTypes() {
      var st = C.staffById(d, $('lf-who').value);
      $('lf-type').innerHTML = '<option value="">Choose…</option>' + d.types.filter(function (t) { return C.offered(d, st, t); }).map(function (t) { return '<option value="' + t.code + '">' + esc(t.name) + (t.deducts ? '' : ' (no allowance)') + '</option>'; }).join('');
    }
    function update() {
      var st = C.staffById(d, $('lf-who').value), t = C.type(d, $('lf-type').value);
      var r = { staffId: st.id, type: $('lf-type').value, start: $('lf-start').value, end: $('lf-end').value || $('lf-start').value, half: 'None', reason: $('lf-note').value };
      if (t && /weekend/i.test(t.unit || '') && r.start) { var x = C.parse(r.start); while (x.getDay() !== 5) x = C.addDays(x, x.getDay() === 6 || x.getDay() === 0 ? -1 : 1); r.start = C.iso(x); r.end = C.iso(C.addDays(x, 2)); $('lf-start').value = r.start; $('lf-end').value = r.end; }
      // balance box once a type is chosen
      var bal = '';
      if (t && t.deducts) {
        var b = C.balances(d, st.id, C.lyOf(r.start || H.today(), C.ctx(d).S))[t.code];
        if (b && b.entitled != null) bal = '<div class="fbal" style="--c:' + esc(t.colour) + '">' + (st.id === me.id ? 'You have' : esc(st.name.split(' ')[0]) + ' has') + ' <b>' + C.fmtDays(b.available) + '</b> ' + esc(C.unitName(t, b.available)) + ' of ' + esc(t.name) + ' left' + (b.pending ? ' · ' + C.fmtDays(b.pending) + ' waiting' : '') + '</div>';
      } else if (t) bal = '<div class="fbal" style="--c:' + esc(t.colour) + '">' + esc(t.name) + ' doesn’t use an allowance.</div>';
      $('lf-bal').innerHTML = bal;
      var errs = [], warn = [];
      if (t && C.isISO(r.start) && C.isISO(r.end)) {
        errs = C.validateAll(d, st, r, undefined, false, admin);
        warn = C.requestWarnings(d, st, r, undefined, false);
        var n = C.countDays(r, C.ctx(d));
        $('lf-sum').hidden = false;
        $('lf-sum').innerHTML = '<b>' + esc(C.fmtAmount(t, C.amount(r, t, C.ctx(d)))) + '</b>' + (C.isDayUnit(t) ? '' : ' (' + n + ' working days)') + (warn.length ? '<br>⚠ ' + warn.map(esc).join('<br>⚠ ') : '');
      } else $('lf-sum').hidden = true;
      $('lf-err').hidden = !errs.length; $('lf-err').innerHTML = errs.map(esc).join('<br>');
      $('lf-go').disabled = !t || !C.isISO(r.start) || errs.length > 0;
      $('lf-go').textContent = admin && st.id !== me.id ? 'Book leave' : 'Send request';
    }
    fillTypes();
    $('lf-who').addEventListener('change', function () { fillTypes(); update(); });
    $('lf-type').addEventListener('change', update);
    $('lf-start').addEventListener('change', function () { if (!$('lf-end').value || $('lf-end').value < $('lf-start').value) $('lf-end').value = $('lf-start').value; update(); });
    $('lf-end').addEventListener('change', update);
    $('lf-note').addEventListener('input', update);
    update();
  }

  H.register({
    id: 'leave', name: 'Leave', desc: 'Staff leave – Leave Manager built in', icon: H.ICON.leave, tint: '#E8590C',
    roles: ['admin', 'pastor', 'rosters', 'kids', 'member'],
    stat: function (u) {
      var d = data();
      if (isLeaveAdmin()) { var n = d.requests.filter(function (r) { return r.status === 'Pending'; }).length; return n ? n + ' waiting for approval' : 'Nothing waiting'; }
      return takesLeave(d) ? 'Your balances and requests' : 'Who’s away';
    },
    todos: function () {
      var d = data(); if (!isLeaveAdmin()) return [];
      var n = d.requests.filter(function (r) { return r.status === 'Pending'; }).length;
      return n ? [{ text: 'Approve or decline ' + n + ' leave request' + (n === 1 ? '' : 's'), href: '#/leave/approvals' }] : [];
    },
    render: function (p) {
      var d = data(), v = p[0] || (takesLeave(d) ? '' : isLeaveAdmin() ? 'approvals' : 'away');
      var body = v === 'settings' && isLeaveAdmin() ? renderSettings(d) : v === 'approvals' && isLeaveAdmin() ? renderApprovals(d) : v === 'team' && isLeaveAdmin() ? renderTeam(d) : v === 'away' ? renderAway(d) : takesLeave(d) ? renderMine(d) : renderAway(d);
      return '<div class="page-head"><div><h1>Leave</h1><p class="lead">Staff leave with the same rules as Leave Manager: only working days count, public holidays are free, and approved leave keeps people off the roster.</p></div>' +
        (takesLeave(d) || isLeaveAdmin() ? '<button class="btn primary" data-act="leave:request">' + H.icon(H.ICON.plus, 18) + (takesLeave(d) ? 'Request leave' : 'Book leave') + '</button>' : '') + '</div>' + tabs(d, v) + body;
    },
    actions: {
      savegeneral: function () {
        var lv = S.leave(), open = picked('ls-open');
        if (!open) { H.toast('Tick at least one day the church is open', true); return; }
        lv.settings.LeaveYearStartMonth = +document.getElementById('ls-start').value; lv.settings.OpenDays = open;
        lv.settings.ProRata = document.getElementById('ls-prorata').checked ? 'TRUE' : 'FALSE';
        lv.settings.AllowNegative = document.getElementById('ls-neg').checked ? 'TRUE' : 'FALSE';
        S.saveLeave('Changed leave settings'); H.render(); H.toast('Saved');
      },
      addterm: function () { var box = document.getElementById('ls-terms'), div = document.createElement('div'); div.innerHTML = termRow({}); box.appendChild(div.firstChild); box.lastChild.querySelector('input').focus(); },
      delterm: function (el) { el.closest('.ls-term').remove(); },
      saveterms: function () {
        var out = [], bad = '';
        document.querySelectorAll('.ls-term').forEach(function (r) {
          var n = r.querySelector('.ls-tn').value.trim(), a = r.querySelector('.ls-ts').value, b = r.querySelector('.ls-te').value;
          if (!n && !a && !b) return;
          if (!n || !a || !b || b < a) bad = 'Each term needs a name, a start and an end date (the end after the start).'; else out.push({ name: n, start: a, end: b });
        });
        if (bad) { H.toast(bad, true); return; }
        S.leave().terms = out.sort(function (x, y) { return x.start < y.start ? -1 : 1; });
        S.saveLeave('Changed school terms'); H.render(); H.toast('Terms saved');
      },
      savelevels: function () {
        var lv = S.leave(), bad = '';
        document.querySelectorAll('#ls-levels tbody tr').forEach(function (tr) {
          var l = lv.levels[+tr.dataset.i], wd = picked('ls-wd', tr);
          if (!wd) bad = 'Tick the working days for ' + l.level + '.';
          l.workDays = wd; l.ent = {};
          tr.querySelectorAll('.ls-ent').forEach(function (inp) { if (inp.value !== '' && !isNaN(inp.value)) l.ent[inp.dataset.code] = Number(inp.value); });
        });
        if (bad) { H.toast(bad, true); return; }
        S.saveLeave('Changed staff categories and allowances'); H.render(); H.toast('Categories saved');
      },
      addlevel: function () {
        var n = (prompt('Name of the new staff category (e.g. Youth Worker)') || '').trim(); if (!n) return;
        var lv = S.leave();
        if (lv.levels.some(function (l) { return l.level.toLowerCase() === n.toLowerCase(); })) { H.toast('There is already a category called ' + n, true); return; }
        lv.levels.push({ level: n, label: n, workDays: lv.settings.OpenDays || 'Mon, Tue, Wed, Thu, Fri', ent: {} });
        S.saveLeave('Added staff category ' + n); H.render(); H.toast('Added – now fill in its days and allowances');
      },
      dellevel: function (el) { if (!H.confirmBtn(el, '✕?')) return; var lv = S.leave(), l = lv.levels.splice(+el.dataset.i, 1)[0]; S.saveLeave('Removed staff category ' + l.level); H.render(); },
      savetypes: function () {
        var lv = S.leave(), bad = '';
        document.querySelectorAll('.ls-tname').forEach(function (inp) { var n = inp.value.trim(); if (!n) bad = 'Every kind of leave needs a name.'; else lv.types[+inp.dataset.i].name = n; });
        if (bad) { H.toast(bad, true); return; }
        document.querySelectorAll('.ls-tappr').forEach(function (b) { lv.types[+b.dataset.i].needsApproval = b.checked; });
        document.querySelectorAll('.ls-tuse').forEach(function (b) { lv.types[+b.dataset.i].active = b.checked; });
        S.saveLeave('Changed kinds of leave'); H.render(); H.toast('Saved');
      },
      addtype: function () {
        H.modal(H.dialogHead('Add a kind of leave') + '<div class="dlg-body"><label class="field">Name<input id="nt-n" placeholder="e.g. Study Leave"></label>' +
          '<label class="check"><input type="checkbox" id="nt-d" checked><span>Uses an allowance (days per year, set per category)</span></label>' +
          '<label class="check"><input type="checkbox" id="nt-h" checked><span>Half days allowed</span></label></div>' +
          '<div class="dlg-foot"><button class="btn" data-act="hub:close">Cancel</button><button class="btn primary" data-act="leave:savetype">Add</button></div>', 'Add a kind of leave');
      },
      savetype: function () {
        var n = document.getElementById('nt-n').value.trim(); if (!n) return;
        var lv = S.leave(), code = n.split(/\s+/).map(function (w) { return w[0]; }).join('').toUpperCase().replace(/[^A-Z]/g, '') || 'X', base = code, i = 2;
        while (lv.types.some(function (t) { return t.code === code; })) code = base + i++;
        var COLS = ['#2F80C0', '#7C3AED', '#0E7490', '#A16207', '#B0527A', '#4C9A6A'];
        lv.types.push({ code: code, name: n, colour: COLS[lv.types.length % COLS.length], deducts: document.getElementById('nt-d').checked, halfDay: document.getElementById('nt-h').checked, proRata: false, needsApproval: true, unit: 'Days' });
        var ded = document.getElementById('nt-d').checked;
        S.saveLeave('Added leave type ' + n); H.closeModal(); H.render(); H.toast('Added' + (ded ? ' – now set the days per category' : ''));
      },
      addsa: function (el) {
        var lv = S.leave(), y = +el.dataset.y, have = {};
        lv.holidays.forEach(function (h) { have[h.date] = 1; });
        C.saPublicHolidays(y).forEach(function (h) { if (!have[h.date]) lv.holidays.push(h); });
        S.saveLeave('Added public holidays for ' + y); H.render(); H.toast('Public holidays for ' + y + ' added');
      },
      addhol: function () {
        var dt = document.getElementById('ls-hd').value, n = document.getElementById('ls-hn').value.trim();
        if (!dt || !n) { H.toast('Choose a date and give it a name', true); return; }
        var lv = S.leave(); if (lv.holidays.some(function (h) { return h.date === dt; })) { H.toast('That day is already listed', true); return; }
        lv.holidays.push({ date: dt, name: n, church: true }); S.saveLeave('Added a church closure: ' + n); H.render(); H.toast('Added');
      },
      delhol: function (el) { var lv = S.leave(); lv.holidays = lv.holidays.filter(function (h) { return h.date !== el.dataset.date; }); S.saveLeave('Removed a holiday'); H.render(); },
      request: function () { requestDialog(); },
      send: function () {
        var d = data(), $ = function (id) { return document.getElementById(id); };
        try {
          var p = C.prepareRequest(d, actor(d), { staffId: $('lf-who').value, type: $('lf-type').value, start: $('lf-start').value, end: $('lf-end').value || $('lf-start').value, half: 'None', reason: $('lf-note').value });
          var r = p.req; r.id = 'L' + Date.now().toString(36).toUpperCase(); r.submitted = H.today(); r.source = 'Hub';
          S.leave().requests.push(r); S.saveLeave((r.status === 'Approved' ? 'Booked ' : 'Requested ') + p.type.name + ' for ' + p.staff.name);
          H.closeModal(); H.render(); H.toast(r.status === 'Approved' ? 'Booked' : 'Sent – the Administrator will approve it');
        } catch (e) { $('lf-err').hidden = false; $('lf-err').textContent = e.message; }
      },
      decide: function (el) {
        if (el.dataset.d === 'Approved' && el.dataset.over && !el.dataset.sure) { H.confirmBtn(el, 'Approve anyway'); H.toast('This is more than their allowance', true); return; }
        var d = data();
        try {
          var p = C.prepareDecision(d, actor(d), el.dataset.id, el.dataset.d);
          p.req.status = el.dataset.d; p.req.decidedBy = H.name(H.user()); p.req.decidedOn = H.today();
          S.saveLeave(el.dataset.d + ' leave for ' + p.staff.name); H.render(); H.toast(el.dataset.d === 'Approved' ? 'Approved' : 'Declined');
        } catch (e) { H.toast(e.message, true); }
      },
      cancel: function (el) {
        if (!H.confirmBtn(el, 'Click again to cancel')) return;
        var d = data();
        try { var p = C.prepareCancel(d, actor(d), el.dataset.id, H.today()); p.req.status = 'Cancelled'; p.req.cancelledBy = H.name(H.user()); S.saveLeave('Cancelled leave'); H.render(); H.toast('Cancelled'); }
        catch (e) { H.toast(e.message, true); }
      }
    }
  });
})();
