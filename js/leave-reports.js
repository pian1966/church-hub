/* Church Hub – Leave: the leave managers' Dashboard (as in Leave Manager), printable leave reports and the payroll file.
 * Builds HTML and files only; mod-leave.js shows them. Uses LeaveCore for balances, cover rules and "use it or lose it". */
var LeaveReports = (function () {
  'use strict';
  var C = LeaveCore, T = I18n.t, TN = I18n.tn;
  function esc(s) { return Hub.esc(s); }
  function typeOf(d, code) { return C.type(d, code) || { name: code || T('Away'), colour: '#94A3B8' }; }
  function staffList(d) { return d.staff.filter(function (s) { return C.tracksLeave(s) && s.active; }).sort(function (a, b) { return a.name.localeCompare(b.name); }); }
  function real(d) { return d.requests.filter(function (r) { return !r.synthetic; }); }
  function isSick(t) { return !!t && /sick/i.test(t.name + ' ' + t.code); }
  function isUnpaid(t) { return !!t && /unpaid/i.test(t.name + ' ' + t.code); }
  function amt(d, t, n) { return C.fmtDays(n) + ' ' + T(C.unitName(t, n)); }

  /* ---------- sick-leave patterns ----------
   * South Africa's Basic Conditions of Employment Act lets an employer ask for a medical certificate when someone is off sick
   * for more than 2 days in a row, or more than twice in 8 weeks (Leave Manager flags the same). */
  function sickPatterns(d, y) {
    var c = C.ctx(d), out = [];
    staffList(d).forEach(function (s) {
      var spells = real(d).filter(function (r) { return r.staffId === s.id && r.status === 'Approved' && isSick(typeOf(d, r.type)) && C.lyOf(r.start, c.S) === y; })
        .sort(function (a, b) { return a.start < b.start ? -1 : 1; });
      if (!spells.length) return;
      var days = spells.reduce(function (n, r) { return n + C.countDays(r, c); }, 0), flags = [];
      if (spells.some(function (r) { return C.countDays(r, c) > 2; })) flags.push(T('more than 2 days in a row'));
      for (var i = 2; i < spells.length; i++) {
        if ((C.parse(spells[i].start) - C.parse(spells[i - 2].start)) / 864e5 <= 56) { flags.push(T('more than twice in 8 weeks')); break; }
      }
      out.push({ staff: s, spells: spells.length, days: days, flags: flags });
    });
    return out.sort(function (a, b) { return b.flags.length - a.flags.length || b.days - a.days; });
  }

  /** The Dashboard: four numbers, then waiting requests, cover problems, use it or lose it, busiest months, sick leave. */
  function dashboard(d, h) {
    var today = Hub.today(), c = C.ctx(d), y = C.lyOf(today, c.S), staff = staffList(d), end8 = C.iso(C.addDays(C.parse(today), 56));
    var waiting = d.requests.filter(function (r) { return r.status === 'Pending'; });
    var awayToday = real(d).filter(function (r) { return r.status === 'Approved' && r.start <= today && r.end >= today; });
    var cover = C.coverBreaches(d, today, end8);
    var toTake = 0, lose = [];
    staff.forEach(function (s) {
      var main = d.types.filter(function (t) { return t.deducts && C.offered(d, s, t); })[0], b = main ? C.balances(d, s.id, y)[main.code] : null;
      if (b && b.entitled != null) toTake += Math.max(0, b.available);
      C.useItOrLoseIt(d, s.id, today).forEach(function (u) { lose.push({ staff: s, u: u }); });
    });
    lose.sort(function (a, b) { return a.u.until < b.u.until ? -1 : 1; });
    var stat = function (n, label, warn, href) { return '<a class="stat' + (warn ? ' warn' : '') + '" href="' + href + '"><span>' + esc(label) + '</span><b>' + esc(String(n)) + '</b></a>'; };
    var html = '<div class="stats">' + stat(waiting.length, T('Waiting for approval'), waiting.length > 0, '#/leave/approvals') + stat(awayToday.length, T('Away today'), false, '#/leave/away') +
      stat(C.fmtDays(toTake), T('Staff leave still to take'), false, '#/leave/team') + stat(cover.length, T('Cover problems in the next 8 weeks'), cover.length > 0, '#/leave/dashboard') + '</div>';
    // Waiting
    html += '<section class="block"><h2>' + esc(T('Waiting for approval')) + '</h2>' + (waiting.length ? '<div class="list">' + waiting.map(function (r) {
      var s = C.staffById(d, r.staffId), t = typeOf(d, r.type), w = s ? C.requestWarnings(d, s, r, r.id, true) : [];
      return '<div class="item"><span class="dot" style="--c:' + esc(t.colour) + '"></span><span class="grow"><b>' + esc(s ? s.name : '?') + ' · ' + esc(h.range(r)) + '</b><small>' + esc(t.name + (w.length ? ' · ⚠ ' + w.join(' ⚠ ') : '')) + '</small></span>' +
        '<span class="btns"><button class="btn small" data-act="leave:decide" data-id="' + esc(r.id) + '" data-d="Declined">' + esc(T('Decline')) + '</button><button class="btn small ok" data-act="leave:decide" data-id="' + esc(r.id) + '" data-d="Approved"' + (s && C.allowanceWarning(d, s, r, r.id, true) ? ' data-over="1"' : '') + '>' + esc(T('Approve')) + '</button></span></div>';
    }).join('') + '</div>' : '<p class="empty">' + esc(T('Nothing is waiting for approval.')) + '</p>') + '</section>';
    html += '<div class="grid2">';
    // Cover
    html += '<section class="panel"><h2>' + esc(T('Cover in the next 8 weeks')) + '</h2>' + (cover.length ? '<div class="list">' + cover.slice(0, 20).map(function (b) {
      return '<div class="item"><span class="grow"><b>' + esc(Hub.fmt(b.date, true)) + '</b><small>' + esc((b.rule.name || T('Cover')) + ': ' + T('{n} of {min} on duty', { n: b.onDuty, min: b.min }) + (b.away.length ? ' · ' + T('away: {names}', { names: b.away.join(', ') }) : '')) + '</small></span><span class="tag bad">⚠</span></div>';
    }).join('') + '</div>' : '<p class="empty">' + esc(T('Every day is covered.')) + '</p>') + '</section>';
    // Use it or lose it
    html += '<section class="panel"><h2>' + esc(T('Use it or lose it')) + '</h2>' + (lose.length ? '<div class="list">' + lose.slice(0, 20).map(function (x) {
      return '<a class="item" href="#/leave/staff/' + esc(x.staff.id) + '"><span class="dot" style="--c:' + esc(x.u.type.colour) + '"></span><span class="grow"><b>' + esc(x.staff.name) + '</b><small>' + esc(T('{left} of {type} – lost after {date}', { left: amt(d, x.u.type, x.u.left), type: x.u.type.name, date: Hub.fmt(x.u.until, true) })) + '</small></span></a>';
    }).join('') + '</div>' : '<p class="empty">' + esc(T('No one has leave about to be lost.')) + '</p>') + '</section>';
    // Busiest months
    var rg = C.lyRange(y, c.S), months = {}, max = 0;
    real(d).forEach(function (r) {
      if (r.status !== 'Approved') return; var t = typeOf(d, r.type);
      C.dayList(r, c).forEach(function (x) { if (x.date < rg.start || x.date > rg.end) return; var m = x.date.slice(0, 7); months[m] = months[m] || {}; months[m][r.type] = (months[m][r.type] || 0) + x.amt; });
    });
    var ms = []; for (var i = 0, m = rg.start.slice(0, 7); i < 12; i++) { ms.push(m); var dd = C.parse(m + '-01'); m = C.iso(new Date(dd.getFullYear(), dd.getMonth() + 1, 1, 12)).slice(0, 7); }
    ms.forEach(function (mm) { var tot = Object.keys(months[mm] || {}).reduce(function (n, k) { return n + months[mm][k]; }, 0); if (tot > max) max = tot; });
    html += '<section class="panel"><h2>' + esc(T('Busiest months')) + '</h2><div class="lv-bars">' + ms.map(function (mm) {
      var parts = months[mm] || {}, tot = Object.keys(parts).reduce(function (n, k) { return n + parts[k]; }, 0);
      return '<div class="lv-bar" title="' + esc(Object.keys(parts).map(function (k) { return typeOf(d, k).name + ': ' + C.fmtDays(parts[k]); }).join(' · ') || T('None')) + '"><div class="lv-bar-col" style="height:' + (max ? Math.round(tot / max * 100) : 0) + '%">' +
        Object.keys(parts).map(function (k) { return '<i style="--c:' + esc(typeOf(d, k).colour) + ';flex:' + parts[k] + '"></i>'; }).join('') + '</div><b>' + (tot ? C.fmtDays(tot) : '') + '</b><span>' + esc(I18n.mon()[+mm.slice(5) - 1]) + '</span></div>';
    }).join('') + '</div><p class="hint">' + esc(T('Approved working days off each month, by kind of leave.')) + '</p></section>';
    // Sick leave
    var sick = sickPatterns(d, y);
    html += '<section class="panel"><h2>' + esc(T('Sick leave this year')) + '</h2>' + (sick.length ? '<div class="list">' + sick.map(function (x) {
      return '<a class="item" href="#/leave/staff/' + esc(x.staff.id) + '"><span class="grow"><b>' + esc(x.staff.name) + '</b><small>' + esc(TN('{n} day', '{n} days', x.days) + ' · ' + TN('{n} time', '{n} times', x.spells)) + '</small></span>' +
        (x.flags.length ? '<span class="tag warn" title="' + esc(T('An employer may ask for a medical certificate')) + '">' + esc(x.flags.join(', ')) + '</span>' : '') + '</a>';
    }).join('') + '</div><p class="hint">' + esc(T('South African law lets an employer ask for a medical certificate when someone is off sick for more than 2 days in a row, or more than twice in 8 weeks. Health information: only leave managers see this, and opening the Dashboard is logged.')) + '</p>'
      : '<p class="empty">' + esc(T('No sick leave this year.')) + '</p>') + '</section>';
    return html + '</div>';
  }

  /* ---------- printable reports ---------- */
  function page(title, body) {
    return '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>' +
      'body{font:13px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;color:#1D1B19;margin:28px}h1{font-size:20px;margin:0 0 2px}h2{font-size:15px;margin:22px 0 6px}' +
      'table{border-collapse:collapse;width:100%;margin:6px 0}th,td{border-bottom:1px solid #E7E1DA;padding:5px 6px;text-align:left;vertical-align:top}th{font-size:11.5px;color:#645B53;text-transform:uppercase;letter-spacing:.03em}' +
      'td.n,th.n{text-align:right}.muted{color:#645B53}.sig{display:flex;gap:40px;margin-top:40px}.sig div{flex:1;border-top:1px solid #1D1B19;padding-top:4px;font-size:12px;color:#645B53}' +
      '.person{page-break-after:always}.person:last-child{page-break-after:auto}.dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px}' +
      '@media print{body{margin:12mm}.noprint{display:none}}</style></head><body><p class="noprint"><button onclick="print()">' + esc(T('Print or save as PDF')) + '</button></p>' + body + '</body></html>';
  }
  function personReport(d, s, y) {
    var c = C.ctx(d), rg = C.lyRange(y, c.S), bal = C.balances(d, s.id, y), church = (Store.settings() || {}).churchName || '';
    var list = real(d).filter(function (r) { return r.staffId === s.id && r.end >= rg.start && r.start <= rg.end; }).sort(function (a, b) { return a.start < b.start ? -1 : 1; });
    var kinds = d.types.filter(function (t) { return bal[t.code] && (bal[t.code].entitled != null || bal[t.code].approved || bal[t.code].pending); });
    return '<div class="person"><h1>' + esc(T('Leave report: {name}', { name: s.name })) + '</h1><p class="muted">' + esc([church, s.level, C.lyLabel(y, c.S) + ': ' + Hub.fmt(rg.start, true) + ' – ' + Hub.fmt(rg.end, true), T('printed {date}', { date: Hub.fmt(Hub.today(), true) })].filter(Boolean).join(' · ')) + '</p>' +
      '<h2>' + esc(T('Balances')) + '</h2><table><tr><th>' + esc(T('Kind of leave')) + '</th><th class="n">' + esc(T('Allowance')) + '</th><th class="n">' + esc(T('Taken')) + '</th><th class="n">' + esc(T('Waiting')) + '</th><th class="n">' + esc(T('Left')) + '</th></tr>' +
      kinds.map(function (t) { var b = bal[t.code]; return '<tr><td><span class="dot" style="background:' + esc(t.colour) + '"></span>' + esc(t.name) + '</td><td class="n">' + (b.entitled != null ? C.fmtDays(b.entitled) : '–') + '</td><td class="n">' + C.fmtDays(b.approved || 0) + '</td><td class="n">' + C.fmtDays(b.pending || 0) + '</td><td class="n"><b>' + (b.entitled != null ? C.fmtDays(b.available) : '–') + '</b></td></tr>'; }).join('') + '</table>' +
      '<h2>' + esc(T('Every request')) + '</h2>' + (list.length ? '<table><tr><th>' + esc(T('Dates')) + '</th><th>' + esc(T('Kind of leave')) + '</th><th class="n">' + esc(T('Days')) + '</th><th>' + esc(T('Status')) + '</th><th>' + esc(T('Note')) + '</th><th>' + esc(T('Decided by')) + '</th></tr>' +
        list.map(function (r) { var t = typeOf(d, r.type); return '<tr><td>' + esc(r.start === r.end ? Hub.fmt(r.start, true) : Hub.fmt(r.start) + ' – ' + Hub.fmt(r.end, true)) + '</td><td>' + esc(t.name) + '</td><td class="n">' + C.fmtDays(C.amount(r, t, c)) + '</td><td>' + esc(T(r.status === 'Pending' ? 'Waiting' : r.status)) + '</td><td>' + esc(r.reason || '') + '</td><td>' + esc(r.decidedBy || '') + '</td></tr>'; }).join('') + '</table>' : '<p class="muted">' + esc(T('No leave in this year.')) + '</p>') +
      '<div class="sig"><div>' + esc(T('Staff member')) + '</div><div>' + esc(T('Administrator')) + '</div><div>' + esc(T('Date')) + '</div></div></div>';
  }
  function summary(d, y) {
    var c = C.ctx(d), staff = staffList(d), types = d.types.filter(function (t) { return t.deducts; });
    return '<div class="person"><h1>' + esc(T('All staff – leave summary')) + '</h1><p class="muted">' + esc(C.lyLabel(y, c.S) + ' · ' + T('printed {date}', { date: Hub.fmt(Hub.today(), true) })) + '</p><table><tr><th>' + esc(T('Staff')) + '</th>' +
      types.map(function (t) { return '<th class="n">' + esc(t.name) + '<br>' + esc(T('taken / left')) + '</th>'; }).join('') + '</tr>' +
      staff.map(function (s) { var b = C.balances(d, s.id, y); return '<tr><td><b>' + esc(s.name) + '</b><br><span class="muted">' + esc(s.level) + '</span></td>' + types.map(function (t) { var x = b[t.code]; return '<td class="n">' + (x && x.entitled != null ? C.fmtDays(x.approved || 0) + ' / ' + C.fmtDays(x.available) : '–') + '</td>'; }).join('') + '</tr>'; }).join('') + '</table></div>';
  }
  /** Opens the report in a new tab, ready to print or save as PDF. */
  function open(title, body) {
    var url = URL.createObjectURL(new Blob([page(title, body)], { type: 'text/html' }));
    var w = window.open(url, '_blank'); if (!w) location.href = url;
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }
  function printPerson(d, staffId, y) { var s = C.staffById(d, staffId); if (s) open(T('Leave report: {name}', { name: s.name }), personReport(d, s, y)); }
  function printAll(d, y, full) { open(T('All staff – leave summary'), summary(d, y) + (full ? staffList(d).map(function (s) { return personReport(d, s, y); }).join('') : '')); }

  /** Payroll: working days of unpaid leave per person per month of the leave year, then each booking. */
  function payrollRows(d, y) {
    var c = C.ctx(d), rg = C.lyRange(y, c.S), ms = [];
    for (var i = 0, m = rg.start.slice(0, 7); i < 12; i++) { ms.push(m); var dd = C.parse(m + '-01'); m = C.iso(new Date(dd.getFullYear(), dd.getMonth() + 1, 1, 12)).slice(0, 7); }
    var unpaid = real(d).filter(function (r) { return r.status === 'Approved' && isUnpaid(typeOf(d, r.type)) && r.end >= rg.start && r.start <= rg.end; });
    var rows = [['Unpaid leave (working days)', C.lyLabel(y, c.S)], ['Staff member'].concat(ms).concat(['Total'])];
    staffList(d).forEach(function (s) {
      var per = {}; unpaid.filter(function (r) { return r.staffId === s.id; }).forEach(function (r) { C.dayList(r, c).forEach(function (x) { per[x.date.slice(0, 7)] = (per[x.date.slice(0, 7)] || 0) + x.amt; }); });
      var tot = ms.reduce(function (n, mm) { return n + (per[mm] || 0); }, 0);
      if (tot) rows.push([s.name].concat(ms.map(function (mm) { return per[mm] || ''; })).concat([tot]));
    });
    rows.push([]); rows.push(['Bookings']); rows.push(['Staff member', 'Start', 'End', 'Working days', 'Note']);
    unpaid.sort(function (a, b) { return a.start < b.start ? -1 : 1; }).forEach(function (r) { var s = C.staffById(d, r.staffId); rows.push([s ? s.name : r.staffId, r.start, r.end, C.countDays(r, c), r.reason || '']); });
    return rows;
  }

  return { dashboard: dashboard, printPerson: printPerson, printAll: printAll, payrollRows: payrollRows, sickPatterns: sickPatterns };
})();
