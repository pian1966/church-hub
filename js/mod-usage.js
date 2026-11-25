/* Church & Trellis – Usage: how many people use the app, who is on right now, which versions people have, which parts are used most,
 * and how many Church Partners are not on it yet. For Administrators and Pastors. Rules and numbers: js/usage.js (tested in
 * tests/usage.test.js); words: js/i18n/usage.js; look: css/usage.css; the records are in `appUse` (docs/architecture/handover/usage-opus.md).
 * Until a church has records, the page still shows who is on the app from People (appFirstSeen) and says the rest builds up as people
 * open the app. The demo shows made-up usage so the page can be seen. Part counts never say who used what; names are shown only
 * under "On right now" and "Not on the app yet". */
(function () {
  'use strict';
  var H = Hub, esc = H.esc, S = Store, T = I18n.t, TN = I18n.tn;
  var ICON = 'M4 20V10M10 20V4M16 20v-8M22 20H2';
  var NAMES = {   // the parts people open, as the menu names them
    people: T('People'), rosters: T('Rosters'), messages: T('Messages'), events: T('Events'), care: T('Care Groups'), life: T('Midweek Groups'),
    leave: T('Leave'), library: T('Library'), archive: T('Archives'), board: T('Community board'), market: T('Marketplace'), leaders: T('Leadership'),
    me: T('Me'), help: T('Help'), support: T('Subscription'), settings: T('Settings'), words: T('Translations'), privacy: T('Privacy'), import: T('Import'), about: T('About')
  };
  var memo = { v: null, out: null };
  var live = { list: null, at: 0, asking: false, failed: false };   // everyone's records (Administrators and Pastors), fetched when needed

  function partName(id) { return NAMES[id] || id.charAt(0).toUpperCase() + id.slice(1); }
  /** Fetches everyone's records when the page (or a person's page) needs them: at most once a minute, then redraws. */
  function fetch(force) {
    if (live.asking || (!force && live.list && Date.now() - live.at < 60000)) return;
    live.asking = true;
    S.usageAll().then(function (list) {
      live.asking = false; live.at = Date.now(); live.failed = !list; if (list) live.list = list;
      memo = { v: null, out: null };
      if (/^#\/(usage|people\/p\/)/.test(location.hash)) H.render();   // only the pages that show it
    });
  }
  function records(ask) {
    if (!S.isLive()) return Usage.demo(S.list('people'), H.today(), Date.now(), ChurchHubVersion.version);
    if (ask) fetch(false); return live.list || [];
  }
  function data(ask) {
    var v = S.version ? S.version() : '';
    if (memo.out && memo.v === v && Date.now() - memo.at < 60000 && (!S.isLive() || memo.list === live.list)) return memo.out;
    var rec = records(ask), out = { rec: rec, sum: Usage.summary({ people: S.list('people'), records: rec, today: H.today(), now: Date.now(), latest: ChurchHubVersion.version }) };
    memo = { v: v, at: Date.now(), out: out, list: live.list }; return out;
  }

  /* ---------- small pieces ---------- */
  function table(head, rows) {
    return '<details class="u-nums"><summary>' + T('See the numbers') + '</summary><table><thead><tr>' + head.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + r.map(function (c, i) { return (i ? '<td>' : '<th scope="row">') + esc(c) + (i ? '</td>' : '</th>'); }).join('') + '</tr>'; }).join('') + '</tbody></table></details>';
  }
  function card(title, lead, body) {
    return '<section class="panel u-card"><h2>' + esc(title) + '</h2>' + (lead ? '<p class="hint u-lead">' + esc(lead) + '</p>' : '') + body + '</section>';
  }
  function none(text) { return '<p class="empty">' + esc(text) + '</p>'; }
  function waiting() { return none(S.isLive() && !live.list && !live.failed ? T('Loading…') : T('Nothing recorded yet. This fills in as people open Church & Trellis.')); }
  function stat(label, value, hint) { return '<div class="stat"><span>' + esc(label) + '</span><b>' + esc(value) + '</b>' + (hint ? '<small class="muted">' + esc(hint) + '</small>' : '') + '</div>'; }

  /** A horizontal bar for each item: [{ label, n, cls, note }]. The widest bar fills the track. */
  function bars(items, max) {
    max = max || Math.max.apply(null, items.map(function (i) { return i.n; }).concat([1]));
    return '<ul class="u-bars">' + items.map(function (i) {
      return '<li title="' + esc(i.label + ': ' + i.n) + '"><span class="u-name">' + esc(i.label) + '</span><span class="u-track"><i class="' + (i.cls || '') + '" style="width:' + Math.max(i.n ? 2 : 0, Math.round(100 * i.n / max)) + '%"></i></span><b>' + i.n + '</b>' + (i.note ? '<small>' + esc(i.note) + '</small>' : '') + '</li>';
    }).join('') + '</ul>';
  }
  /** Upright columns for a run of days: [{ label, n, hi }]. Only the busiest is labelled with its number. */
  function columns(items, label) {
    var max = Math.max.apply(null, items.map(function (i) { return i.n; }).concat([1])), top = items.reduce(function (b, i) { return i.n > b.n ? i : b; }, { n: 0 });
    return '<div class="u-cols" role="img" aria-label="' + esc(label) + '">' + items.map(function (i) {
      return '<div class="u-col' + (i.hi ? ' hi' : '') + '" title="' + esc(i.title + ': ' + i.n) + '"><span class="u-val">' + (i === top && i.n ? i.n : '') + '</span><i style="height:' + Math.round(100 * i.n / max) + '%"></i><small>' + esc(i.label) + '</small></div>';
    }).join('') + '</div>';
  }
  /** A line for [{ date, total }], with its last value named at the end. */
  function line(points) {
    var W = 320, Hh = 110, pad = 8, max = Math.max.apply(null, points.map(function (p) { return p.total; }).concat([1])), n = points.length;
    var xy = points.map(function (p, i) { return [pad + (W - 2 * pad - 28) * (n > 1 ? i / (n - 1) : 1), Hh - pad - (Hh - 2 * pad) * p.total / max]; });
    var last = xy[xy.length - 1];
    return '<svg class="u-line" viewBox="0 0 ' + W + ' ' + Hh + '" role="img" aria-label="' + esc(T('People on the app, week by week')) + '"><line x1="' + pad + '" y1="' + (Hh - pad) + '" x2="' + (W - pad) + '" y2="' + (Hh - pad) + '" class="u-axis"/>' +
      '<polyline points="' + xy.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + '" class="u-ln"/>' +
      xy.map(function (p, i) { return '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + (i === n - 1 ? 4.5 : 3) + '" class="u-dot"><title>' + esc(H.fmt(points[i].date, true) + ': ' + points[i].total) + '</title></circle>'; }).join('') +
      '<text x="' + (last[0] + 8) + '" y="' + (last[1] + 4) + '" class="u-end">' + points[n - 1].total + '</text></svg>';
  }
  function dayLabel(iso) { return String(parseInt(iso.slice(8), 10)); }

  /* ---------- the cards ---------- */
  function adoptionCard(a) {
    function row(title, g) {
      var w = function (n) { return g.total ? (100 * n / g.total).toFixed(2) : 0; };
      return '<div class="u-adopt"><div class="u-hero"><b>' + g.pct + '%</b><span>' + esc(TN('{a} of {b} is on the app', '{a} of {b} are on the app', g.total, { a: g.on, b: g.total })) + '</span></div><div class="u-stack" role="img" aria-label="' + esc(title) + '">' +
        '<i class="on" style="width:' + w(g.on) + '%"></i><i class="invited" style="width:' + w(g.invited) + '%"></i><i class="none" style="width:' + w(g.none) + '%"></i></div>' +
        '<p class="u-legend"><span class="on">' + T('On the app') + ' <b>' + g.on + '</b></span><span class="invited">' + T('Invited, not on yet') + ' <b>' + g.invited + '</b></span><span class="none">' + T('Not invited yet') + ' <b>' + g.none + '</b></span></p></div>';
    }
    if (!a.all.total) return card(T('Who is on the app'), '', none(T('No adults on the records yet.')));
    return card(T('Who is on the app'), T('Adults at the church. Children are not counted.'),
      '<h3 class="u-sub">' + T('Church Partners') + '</h3>' + (a.partners.total ? row(T('Church Partners'), a.partners) : none(T('No Church Partners on the records yet.'))) +
      (a.others.total ? '<h3 class="u-sub">' + T('Everyone else') + '</h3>' + row(T('Everyone else'), a.others) : '') +
      table([T('Group'), T('On the app'), T('Invited, not on yet'), T('Not invited yet')], [[T('Church Partners'), a.partners.on, a.partners.invited, a.partners.none], [T('Everyone else'), a.others.on, a.others.invited, a.others.none]]));
  }
  function nowCard(s) {
    var by = {}; S.list('people').forEach(function (p) { by[p.id] = p; });
    var list = s.onNow.map(function (id) { return by[id]; }).filter(Boolean);
    return card(T('On right now'), T('Opened Church & Trellis in the last 5 minutes.'), list.length ?
      '<p class="u-big"><b>' + list.length + '</b> ' + esc(TN('person on right now', 'people on right now', list.length)) + '</p><ul class="u-people">' + list.map(function (p) {
        return '<li><a href="#/people/p/' + esc(p.id) + '">' + H.avatar(p, 32) + '<span>' + esc(H.name(p)) + '</span></a></li>'; }).join('') + '</ul>' : none(T('Nobody is on right now.')));
  }
  function activeCard(s) {
    if (!s.recorded) return card(T('How often it is used'), '', waiting());
    var days = s.daily.map(function (d) { var wd = new Date(d.date + 'T00:00:00Z').getUTCDay(); return { label: dayLabel(d.date), n: d.n, title: H.fmt(d.date, true), hi: wd === 0 }; });
    return card(T('How often it is used'), T('People who opened Church & Trellis each day. Sundays are darker.'),
      '<div class="stats u-stats">' + stat(T('Today'), s.activeToday) + stat(T('This week'), s.active7) + stat(T('This month'), s.active30) + '</div><p class="hint">' + esc(T('In the last 7 and 30 days.')) + '</p>' +
      columns(days, T('People who opened the app each day, the last 14 days')) +
      '<p class="hint">' + esc(T('{n}% of this month’s users came back this week.', { n: s.stickiness })) + '</p>' +
      table([T('Day'), T('People')], s.daily.map(function (d) { return [H.fmt(d.date, true), d.n]; })));
  }
  function growthCard(s) {
    var g = s.growth, start = g[0].total, end = g[g.length - 1].total;
    if (!end) return card(T('Growth'), '', none(T('Nobody has signed in yet.')));
    return card(T('Growth'), T('People who have started using the app, week by week (the last 12 weeks).'), line(g) +
      '<p class="hint">' + esc(end - start > 0 ? TN('{n} person started in the last 12 weeks.', '{n} people started in the last 12 weeks.', end - start) : T('No one new in the last 12 weeks.')) + '</p>' +
      table([T('Week ending'), T('On the app')], g.map(function (p) { return [H.fmt(p.date, true), p.total]; })));
  }
  function partsCard(s) {
    var top = s.sections.slice(0, 10);
    if (!top.length) return card(T('Most used parts'), '', waiting());
    return card(T('Most used parts'), T('How often each part was opened in the last 30 days, and by how many different people. It never shows who.'),
      bars(top.map(function (x) { return { label: partName(x.id), n: x.views, note: TN('{n} person', '{n} people', x.people) }; })) +
      table([T('Part'), T('Times opened'), T('People')], s.sections.map(function (x) { return [partName(x.id), x.views, x.people]; })));
  }
  function daysCard(s) {
    var total = s.weekdays.reduce(function (a, b) { return a + b; }, 0);
    if (!total) return '';
    var dow = (I18n.dow && I18n.dow()) || H.DOW || [], cols = s.weekdays.map(function (n, i) { return { label: String(dow[i] || i).slice(0, 3), title: String(dow[i] || i), n: n, hi: i === 0 }; });
    return card(T('Busiest days'), T('Sessions on each day of the week, the last 4 weeks.'), columns(cols, T('Sessions on each day of the week')) +
      table([T('Day'), T('Sessions')], cols.map(function (c) { return [c.title, c.n]; })));
  }
  function versionsCard(s) {
    if (!s.versions.length) return card(T('Which version people have'), '', waiting());
    var old = s.versions.filter(function (v) { return !v.latest; }).reduce(function (a, v) { return a + v.n; }, 0);
    return card(T('Which version people have'), T('The newest version is {v}.', { v: ChurchHubVersion.version }),
      bars(s.versions.slice(0, 8).map(function (v) { return { label: v.version, n: v.n, cls: v.latest ? '' : 'old', note: v.latest ? T('Up to date') : '' }; })) +
      '<p class="hint">' + esc(old ? TN('{n} person is on an older version. Opening the app, or About → Check for updates, brings it up to date.', '{n} people are on an older version. Opening the app, or About → Check for updates, brings them up to date.', old) : T('Everyone is on the newest version.')) + '</p>' +
      table([T('Version'), T('People')], s.versions.map(function (v) { return [v.version, v.n]; })));
  }
  function platformCard(s) {
    if (!s.recorded) return '';
    var name = { android: T('Android app'), app: T('Added to the home screen'), browser: T('In a web browser') };
    return card(T('How people open it'), '', bars(s.platforms.map(function (p) { return { label: name[p.id], n: p.n }; })) + table([T('How'), T('People')], s.platforms.map(function (p) { return [name[p.id], p.n]; })));
  }
  function notOnCard(s) {
    var by = {}; S.list('people').forEach(function (p) { by[p.id] = p; });
    var list = s.notOn.filter(function (x) { return x.partner && by[x.id]; });
    if (!list.length) return '';
    return card(T('Church Partners not on the app yet'), T('Only Administrators and Pastors see these names.'),
      '<ul class="todo u-notOn">' + list.slice(0, 12).map(function (x) {
        return '<li><a href="#/people/p/' + esc(x.id) + '"><span class="grow">' + esc(H.name(by[x.id])) + '</span><span class="tag ' + (x.state === 'invited' ? 'warn' : 'grey') + '">' + esc(x.state === 'invited' ? T('Invited, not on yet') : T('Not invited yet')) + '</span></a></li>'; }).join('') + '</ul>' +
      (list.length > 12 ? '<p class="hint">' + esc(T('and {n} more', { n: list.length - 12 })) + '</p>' : '') +
      '<p><a class="btn primary" href="#/people/welcome">' + T('Invite them') + '</a></p>');
  }

  /* ---------- how much each person uses it (Administrators and Pastors only) ---------- */
  function allowed() { return !!(H.can('*') || H.can('people.view')); }
  /** Five dots and the word: "●●●○○ Regular". The dots are decoration – the word and the sentence carry the meaning. */
  function meter(l) {
    if (!l) return '';
    var label = l.n === null ? T('On the app') : T(Usage.LEVELS[l.n][1]), tip = l.n ? T('Opened on {d} of the last 28 days', { d: l.days }) : label, dots = '';
    for (var i = 1; i <= 5; i++) dots += '<i' + (l.n !== null && i <= l.n ? ' class="f"' : '') + '></i>';
    return '<span class="u-lv l' + (l.n === null ? 'x' : l.n) + '" title="' + esc(tip) + '">' + (l.n === null ? '' : '<span class="u-meter" aria-hidden="true">' + dots + '</span>') + '<span class="u-lbl">' + (l.n === 5 ? '★ ' : '') + esc(label) + '</span>' +
      (l.slipping ? ' <span class="tag warn">' + esc(T('Slipping away')) + '</span>' : '') + '</span>';
  }
  /** For a person's own page: their level, only for Administrators and Pastors, only for adults at the church. */
  function personMeter(p) {
    if (!allowed() || !p || !Usage.eligible(p)) return '';
    var l = data(true).sum.levels[p.id]; return l && l.on ? meter(l) : '';
  }
  function peopleById() { var by = {}; S.list('people').forEach(function (p) { by[p.id] = p; }); return by; }
  function nameSort(by) { return function (a, b) { return H.name(by[a]).localeCompare(H.name(by[b])); }; }
  function levelsCard(s) {
    if (!s.recorded) return card(T('How much people use it'), '', waiting());
    var sp = s.spread, by = peopleById(), ids = Object.keys(s.levels).filter(function (id) { return by[id]; });
    var rows = Usage.LEVELS.map(function (l, i) { return { label: T(l[1]), n: sp.counts[i], cls: i === 0 ? 'old' : '' }; });
    var slip = ids.filter(function (id) { return s.levels[id].slipping; }).sort(nameSort(by));
    var all = ids.filter(function (id) { return s.levels[id].on; }).sort(function (a, b) { return (s.levels[b].n - s.levels[a].n) || nameSort(by)(a, b); });
    function li(id) { return '<li><a href="#/people/p/' + esc(id) + '"><span class="grow">' + esc(H.name(by[id])) + '</span>' + meter(s.levels[id]) + '</a></li>'; }
    return card(T('How much people use it'), T('From how many days in the last 4 weeks each person opened the app, and how many parts they use. Only Administrators and Pastors see this.'),
      bars(rows) + (slip.length ? '<h3 class="u-sub">' + esc(T('Might need a nudge')) + '</h3><p class="hint">' + esc(T('Were using it, but haven’t opened it for 3 weeks or more.')) + '</p><ul class="todo u-notOn">' + slip.slice(0, 12).map(li).join('') + '</ul>' +
        (slip.length > 12 ? '<p class="hint">' + esc(T('and {n} more', { n: slip.length - 12 })) + '</p>' : '') : '') +
      (all.length ? '<details class="u-nums"><summary>' + T('See everyone') + '</summary><ul class="todo u-notOn" style="margin-top:8px">' + all.slice(0, 200).map(li).join('') + '</ul></details>' : ''));
  }

  function render() {
    var d = data(true), s = d.sum;
    return '<div class="page-head"><div><h1>' + T('Usage') + '</h1><p class="lead">' + T('How many people use Church & Trellis, who is on right now, and what they use most.') + '</p></div>' +
      '<div class="btns"><button class="btn" data-act="usage:refresh">' + T('Refresh') + '</button></div></div>' +
      (S.isLive() ? '' : '<p class="note info">' + T('This is made-up usage, to show what the page looks like. A real church sees its own numbers.') + '</p>') +
      '<div class="u-grid">' + adoptionCard(s.adoption) + nowCard(s) + activeCard(s) + levelsCard(s) + growthCard(s) + partsCard(s) + versionsCard(s) + daysCard(s) + platformCard(s) + notOnCard(s) + '</div>' +
      '<p class="hint">' + T('Only counts are kept for each part. Names appear only here, for Administrators and Pastors, to help the church care for people and invite them.') + '</p>';
  }

  window.UsageUI = { meter: personMeter };
  H.register({
    id: 'usage', name: 'Usage', desc: 'Who uses Church & Trellis, how often and what for', icon: ICON, tint: '#0F766E', roles: ['admin', 'pastor'],
    stat: function () { var a = data().sum.adoption.partners; return a.total ? T('{n}% of Church Partners are on the app', { n: a.pct }) : T(this.desc); },
    render: render,
    // Each person's own app notes which parts they open (js/usage-record.js) – everyone, not only those who may see this page
    signedIn: function (u) { if (window.UsageRecord) UsageRecord.start(u); },
    actions: { refresh: function () { memo = { v: null, out: null }; if (S.isLive()) fetch(true); else H.render(); } }
  });
})();
