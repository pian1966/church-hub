/* Church Hub – Leave: the wallchart, month calendar and year planner (as in Leave Manager). Builds HTML only;
 * mod-leave.js shows it under Who's away and on a person's leave page. Uses LeaveCore for working days and rules. */
var LeaveViews = (function () {
  'use strict';
  var C = LeaveCore, T = I18n.t;
  function esc(s) { return Hub.esc(s); }
  function monthStart(ym) { return C.parse(ym + '-01'); }
  function daysIn(ym) { var d = monthStart(ym); return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); }
  function ymOf(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2); }
  function shift(ym, n) { var d = monthStart(ym); return ymOf(new Date(d.getFullYear(), d.getMonth() + n, 1, 12)); }
  function monthName(ym) { var d = monthStart(ym); return T(['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][d.getMonth()]) + ' ' + d.getFullYear(); }
  function typeOf(d, code) { return C.type(d, code) || { name: T('Away'), colour: '#94A3B8' }; }
  /** { date: [{ r, half }] } for one person's approved (and, for leave managers, waiting) leave in a date range. */
  function byDay(d, from, to, opts) {
    var out = {};
    d.requests.forEach(function (r) {
      if (!(r.status === 'Approved' || (opts.pending && r.status === 'Pending'))) return;
      if (r.end < from || r.start > to) return;
      var x = C.parse(r.start < from ? from : r.start), e = C.parse(r.end > to ? to : r.end), g = 0, one = r.start === r.end;
      while (x <= e && g++ < 400) { var ds = C.iso(x); ((out[r.staffId] = out[r.staffId] || {})[ds] = out[r.staffId][ds] || []).push({ r: r, half: one && r.half && r.half !== 'None' }); x = C.addDays(x, 1); }
    });
    return out;
  }
  function nav(ym, act) {
    return '<div class="lv-nav"><button class="icon-btn ghost" data-act="' + act + '" data-m="' + shift(ym, -1) + '" aria-label="' + esc(T('Previous month')) + '">' + Hub.icon('M15 18l-6-6 6-6', 18) + '</button>' +
      '<b>' + esc(monthName(ym)) + '</b><button class="icon-btn ghost" data-act="' + act + '" data-m="' + shift(ym, 1) + '" aria-label="' + esc(T('Next month')) + '">' + Hub.icon('M9 18l6-6-6-6', 18) + '</button></div>';
  }
  function legend(d, used) {
    var types = d.types.filter(function (t) { return used[t.code]; });
    return '<div class="lv-legend">' + types.map(function (t) { return '<span><i style="--c:' + esc(t.colour) + '"></i>' + esc(t.name) + '</span>'; }).join('') +
      (used[''] ? '<span><i style="--c:#94A3B8"></i>' + esc(T('Away')) + '</span>' : '') +
      '<span><i class="lv-pend" style="--c:#64748B"></i>' + esc(T('Waiting')) + '</span><span><i class="lv-off"></i>' + esc(T('Not a working day')) + '</span>' +
      '<span><i class="lv-block"></i>' + esc(T('No leave')) + '</span></div>';
  }

  /** Everyone on one month grid: a row per person, a column per day, and how many are away each day. */
  function wallchart(d, ym, opts) {
    var n = daysIn(ym), from = ym + '-01', to = ym + '-' + ('0' + n).slice(-2), c = C.ctx(d), today = Hub.today(), used = {};
    var map = byDay(d, from, to, opts), breach = {};
    var staff = d.staff.filter(function (s) { return C.tracksLeave(s) && s.active; });
    // Staff who can't see colleagues' staff records still see a row for everyone away this month (names they may see)
    Object.keys(map).forEach(function (sid) { if (!staff.some(function (s) { return s.id === sid; })) { var p = Store.get('people', sid); staff.push({ id: sid, name: p ? Hub.name(p) : T('A staff member') }); } });
    staff.sort(function (a, b) { return a.name.localeCompare(b.name); });
    C.coverBreaches(d, from, to).forEach(function (b) { breach[b.date] = b; });
    var dates = []; for (var i = 1; i <= n; i++) dates.push(ym + '-' + ('0' + i).slice(-2));
    var count = {};
    var head = '<tr><th class="lv-name"></th>' + dates.map(function (ds) {
      var x = C.parse(ds), wk = I18n.dow()[x.getDay()].slice(0, 2), hol = c.hol[ds];
      return '<th class="' + (ds === today ? 'lv-today' : '') + (C.noLeaveRules(d, ds).length ? ' lv-blockh' : '') + '" title="' + esc(hol || '') + '"><span>' + esc(wk) + '</span><b>' + x.getDate() + '</b></th>';
    }).join('') + '</tr>';
    var rows = staff.map(function (s) {
      return '<tr><th class="lv-name"><a href="#/leave/staff/' + esc(s.id) + '">' + esc(s.name) + '</a></th>' + dates.map(function (ds) {
        var x = C.parse(ds), work = C.isWorking(x, c, s.id), hits = (map[s.id] || {})[ds] || [], cls = [], st = '', tip = [];
        if (!work) cls.push('lv-off');
        if (C.noLeaveRules(d, ds, s).length) cls.push('lv-block');
        if (hits.length) {
          var h = hits[0], t = typeOf(d, h.r.type); used[h.r.type || ''] = 1;
          cls.push('lv-on'); if (h.r.status === 'Pending') cls.push('lv-pend'); if (h.half) cls.push('lv-half');
          st = ' style="--c:' + esc(t.colour) + '"'; tip.push(t.name + (h.r.status === 'Pending' ? ' (' + T('Waiting') + ')' : ''));
          if (work) count[ds] = (count[ds] || 0) + (h.half ? 0.5 : 1);
        }
        if (c.hol[ds]) tip.push(c.hol[ds]);
        return '<td class="' + cls.join(' ') + '"' + st + (tip.length ? ' title="' + esc(s.name + ': ' + tip.join(' · ')) + '"' : '') + '></td>';
      }).join('') + '</tr>';
    }).join('');
    var foot = '<tr class="lv-count"><th class="lv-name">' + esc(T('Away')) + '</th>' + dates.map(function (ds) {
      var b = breach[ds];
      return '<td class="' + (b ? 'lv-bad' : '') + '"' + (b ? ' title="' + esc((b.rule.name || T('Cover')) + ': ' + b.onDuty + ' / ' + b.min) + '"' : '') + '>' + (count[ds] ? C.fmtDays(count[ds]) : '') + '</td>';
    }).join('') + '</tr>';
    return nav(ym, 'leave:month') + (staff.length ? '<div class="lv-wall"><table><thead>' + head + '</thead><tbody>' + rows + foot + '</tbody></table></div>' + legend(d, used) :
      '<p class="empty">' + esc(T('No staff are set up for leave yet.')) + '</p>') +
      '<p class="hint">' + esc(T('Red in the bottom row: a cover rule isn’t met that day.')) + '</p>';
  }

  /** A month calendar with the names of who is away each day. */
  function calendar(d, ym, opts) {
    var n = daysIn(ym), from = ym + '-01', to = ym + '-' + ('0' + n).slice(-2), c = C.ctx(d), today = Hub.today();
    var map = byDay(d, from, to, opts), names = {};
    d.staff.forEach(function (s) { names[s.id] = s.name; });
    Object.keys(map).forEach(function (sid) { if (!names[sid]) { var p = Store.get('people', sid); names[sid] = p ? Hub.name(p) : T('A staff member'); } });
    var first = monthStart(ym).getDay(), lead = (first + 6) % 7, cells = [];
    for (var i = 0; i < lead; i++) cells.push('<div class="lv-cal-cell lv-empty"></div>');
    for (var day = 1; day <= n; day++) {
      var ds = ym + '-' + ('0' + day).slice(-2), who = [];
      Object.keys(map).forEach(function (sid) { (map[sid][ds] || []).forEach(function (h) { var t = typeOf(d, h.r.type); who.push('<span class="lv-chip' + (h.r.status === 'Pending' ? ' lv-pend' : '') + '" style="--c:' + esc(t.colour) + '">' + esc((names[sid] || '').split(' ')[0] + (h.half ? ' ½' : '')) + '</span>'); }); });
      cells.push('<div class="lv-cal-cell' + (ds === today ? ' lv-today' : '') + (C.isOpen(C.parse(ds), c) ? '' : ' lv-off') + (C.noLeaveRules(d, ds).length ? ' lv-block' : '') + '"><b>' + day + '</b>' + (c.hol[ds] ? '<small>' + esc(c.hol[ds]) + '</small>' : '') + who.join('') + '</div>');
    }
    var heads = [1, 2, 3, 4, 5, 6, 0].map(function (w) { return '<div class="lv-cal-h">' + esc(I18n.dow()[w].slice(0, 3)) + '</div>'; }).join('');
    return nav(ym, 'leave:month') + '<div class="lv-cal">' + heads + cells.join('') + '</div>';
  }

  /** One person's leave year, month by month (Leave Manager's year planner). */
  function planner(d, staffId, year) {
    var S = C.ctx(d).S, rg = C.lyRange(year, S), c = C.ctx(d), mine = { requests: d.requests.filter(function (r) { return r.staffId === staffId; }), types: d.types };
    var map = byDay(mine, rg.start, rg.end, { pending: true })[staffId] || {}, today = Hub.today(), used = {};
    var m = rg.start.slice(0, 7), months = [];
    for (var i = 0; i < 12; i++) {
      var ym = shift(m, i), n = daysIn(ym), lead = (monthStart(ym).getDay() + 6) % 7, cells = '';
      for (var k = 0; k < lead; k++) cells += '<i></i>';
      for (var day = 1; day <= n; day++) {
        var ds = ym + '-' + ('0' + day).slice(-2), h = (map[ds] || [])[0], cls = [], st = '';
        if (!C.isWorking(C.parse(ds), c, staffId)) cls.push('lv-off');
        if (h) { var t = typeOf(d, h.r.type); used[h.r.type || ''] = 1; cls.push('lv-on'); if (h.r.status === 'Pending') cls.push('lv-pend'); st = ' style="--c:' + esc(t.colour) + '" title="' + esc(t.name) + '"'; }
        if (ds === today) cls.push('lv-today');
        cells += '<i class="' + cls.join(' ') + '"' + st + '>' + day + '</i>';
      }
      months.push('<div class="lv-pm"><b>' + esc(monthName(ym)) + '</b><div class="lv-pm-grid">' + cells + '</div></div>');
    }
    return '<div class="lv-planner">' + months.join('') + '</div>' + legend(d, used);
  }

  return { wallchart: wallchart, calendar: calendar, planner: planner, ymOf: ymOf };
})();
