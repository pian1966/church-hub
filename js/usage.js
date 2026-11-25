/* Church & Trellis – Usage: how many people are using the app, who is on right now, which versions, which parts are used most
 * (pure rules, no screens; tested in tests/usage.test.js). The page is js/mod-usage.js.
 *
 * What it reads – one record per person who has opened the app, in the collection `appUse` (the record's id is the person's id):
 *   { id, firstSeen: 'YYYY-MM-DD', lastSeen: 'YYYY-MM-DDTHH:MM:SSZ', version: '0.117.13', platform: 'android' | 'app' | 'browser',
 *     days: { 'YYYY-MM-DD': { n: sessions that day, v: { <part id>: times it was opened } } } }      (the writer keeps the last 35 days)
 * plus the people records (category, active, appFirstSeen, details.appInvited). Who writes the records, and who may read them,
 * is for the senior model: docs/architecture/handover/usage-opus.md.
 *
 * Privacy: every number except `onNow` and `notOn` is a count. The part counts never say who used what.
 * `onNow` and `notOn` carry person ids – the page shows them to Administrators and Pastors only.
 */
var Usage = (function () {
  'use strict';
  var DAY = 864e5, ONLINE_MS = 5 * 60 * 1000, KEEP = 35;

  function iso(ms) { return new Date(ms).toISOString().slice(0, 10); }
  function dayMs(d) { return Date.parse(d + 'T00:00:00Z'); }
  function back(today, n) { return iso(dayMs(today) - n * DAY); }
  function days(r) { return (r && r.days) || {}; }

  /* ---------- who counts ---------- */
  /** Adults still at the church. Children, people who have left or died, and merged duplicates are not counted either way. */
  function eligible(p) {
    return !!p && p.active !== false && !p.binnedAt && !p.deceasedAt && !p.mergedInto && p.category !== 'Deceased' && p.familyRole !== 'child';
  }
  function partner(p) { return p.category === 'Church Partner'; }
  function invited(p) { return !!(p.appInvited || (p.details && p.details.appInvited)); }
  function index(records) { var by = {}; (records || []).forEach(function (r) { if (r && r.id) by[r.id] = r; }); return by; }

  /** 'on' (has opened the app), 'invited' (invited, hasn't yet) or 'none' (not invited yet). */
  function state(p, by) { return by[p.id] || p.appFirstSeen ? 'on' : invited(p) ? 'invited' : 'none'; }

  /** The church's adults, split three ways, for Church Partners and for everyone else. */
  function adoption(people, records) {
    var by = index(records), out = { partners: blank(), others: blank(), all: blank() };
    function blank() { return { total: 0, on: 0, invited: 0, none: 0, pct: 0 }; }
    (people || []).forEach(function (p) {
      if (!eligible(p)) return;
      var s = state(p, by);
      [partner(p) ? out.partners : out.others, out.all].forEach(function (g) { g.total++; g[s]++; });
    });
    Object.keys(out).forEach(function (k) { var g = out[k]; g.pct = g.total ? Math.round(100 * g.on / g.total) : 0; });
    return out;
  }
  /** The people not on the app yet (ids), Church Partners first, those already invited last. For Administrators and Pastors only. */
  function notOn(people, records) {
    var by = index(records), rank = { none: 0, invited: 1 };
    return (people || []).filter(function (p) { return eligible(p) && state(p, by) !== 'on'; })
      .map(function (p) { return { id: p.id, partner: partner(p), state: state(p, by) }; })
      .sort(function (a, b) { return (b.partner - a.partner) || (rank[a.state] - rank[b.state]); });
  }

  /* ---------- right now, today, this week ---------- */
  /** Ids of the people who opened the app in the last 5 minutes (each open app tells the church every few minutes). */
  function onNow(records, nowMs) {
    return (records || []).filter(function (r) { var t = Date.parse(r.lastSeen); return t && nowMs - t <= ONLINE_MS && nowMs >= t - ONLINE_MS; }).map(function (r) { return r.id; });
  }
  /** How many people opened the app on any of the last n days (today included). */
  function active(records, today, n) {
    var from = back(today, n - 1);
    return (records || []).filter(function (r) { return Object.keys(days(r)).some(function (d) { return d >= from && d <= today && (days(r)[d].n || 0) > 0; }); }).length;
  }
  /** [{ date, n }] for each of the last n days, oldest first: how many people opened the app that day. */
  function daily(records, today, n) {
    var out = [], i, d;
    for (i = n - 1; i >= 0; i--) {
      d = back(today, i);
      out.push({ date: d, n: (records || []).filter(function (r) { return (days(r)[d] || {}).n > 0; }).length });
    }
    return out;
  }
  /** How many sessions on each day of the week over the last n days: [Sun … Sat]. */
  function weekdays(records, today, n) {
    var out = [0, 0, 0, 0, 0, 0, 0], from = back(today, n - 1);
    (records || []).forEach(function (r) {
      Object.keys(days(r)).forEach(function (d) { if (d >= from && d <= today) out[new Date(dayMs(d)).getUTCDay()] += days(r)[d].n || 0; });
    });
    return out;
  }

  /* ---------- growth ---------- */
  /** The day a person first opened the app: the earlier of their record and their People record. */
  function startedOn(p, rec) {
    var a = (rec && rec.firstSeen) || '', b = p.appFirstSeen || '';
    return a && b ? (a < b ? a : b) : a || b || '';
  }
  /** [{ date, total }] the last `weeks` weeks (each ending on its date, oldest first): how many adults had started by then. */
  function growth(people, records, today, weeks) {
    var by = index(records), starts = [], out = [], w, end;
    (people || []).forEach(function (p) { if (eligible(p)) { var s = startedOn(p, by[p.id]); if (s) starts.push(s); } });
    for (w = weeks - 1; w >= 0; w--) {
      end = back(today, w * 7);
      out.push({ date: end, total: starts.filter(function (s) { return s <= end; }).length });
    }
    return out;
  }

  /* ---------- versions and platforms ---------- */
  function parse(v) { return String(v || '').split('.').map(function (x) { return parseInt(x, 10) || 0; }); }
  /** -1, 0 or 1, like a version number should be compared (0.9.0 is older than 0.10.0). */
  function compare(a, b) {
    var x = parse(a), y = parse(b), i;
    for (i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0) ? -1 : 1; }
    return 0;
  }
  /** [{ version, n, latest }] newest first. `latest` is the version the website is on; people on it are "up to date". */
  function versions(records, latest) {
    var c = {};
    (records || []).forEach(function (r) { if (r.version) c[r.version] = (c[r.version] || 0) + 1; });
    return Object.keys(c).sort(function (a, b) { return compare(b, a); }).map(function (v) { return { version: v, n: c[v], latest: compare(v, latest) >= 0 }; });
  }
  var PLATFORMS = ['android', 'app', 'browser'];
  /** [{ id, n }] for the Android app, the web app added to the home screen, and a web browser (in that order, all three always there). */
  function platforms(records) {
    var c = { android: 0, app: 0, browser: 0 };
    (records || []).forEach(function (r) { c[PLATFORMS.indexOf(r.platform) >= 0 ? r.platform : 'browser']++; });
    return PLATFORMS.map(function (id) { return { id: id, n: c[id] }; });
  }

  /* ---------- which parts are used ---------- */
  /** [{ id, views, people }] most-opened first, over the last n days: how many times each part was opened and by how many different
   *  people. Only counts – never who. `skip` lists parts that don't count (Home is opened by everyone, every time). */
  function sections(records, today, n, skip) {
    var from = back(today, n - 1), tot = {};
    (records || []).forEach(function (r) {
      var mine = {};
      Object.keys(days(r)).forEach(function (d) {
        if (d < from || d > today) return;
        var v = days(r)[d].v || {};
        Object.keys(v).forEach(function (id) { if ((skip || []).indexOf(id) >= 0 || !(v[id] > 0)) return; tot[id] = tot[id] || { id: id, views: 0, people: 0 }; tot[id].views += v[id]; mine[id] = 1; });
      });
      Object.keys(mine).forEach(function (id) { tot[id].people++; });
    });
    return Object.keys(tot).map(function (k) { return tot[k]; }).sort(function (a, b) { return (b.views - a.views) || (b.people - a.people) || (a.id < b.id ? -1 : 1); });
  }

  /* ---------- everything the page needs ---------- */
  function summary(d) {
    var rec = d.records || [], today = d.today, a = adoption(d.people, rec), act7 = active(rec, today, 7), act30 = active(rec, today, 30);
    return {
      adoption: a, notOn: notOn(d.people, rec), onNow: onNow(rec, d.now),
      activeToday: active(rec, today, 1), active7: act7, active30: act30,
      stickiness: act30 ? Math.round(100 * act7 / act30) : 0,           // of those who used it this month, how many also this week
      daily: daily(rec, today, 14), weekdays: weekdays(rec, today, 28), growth: growth(d.people, rec, today, 12),
      versions: versions(rec, d.latest), platforms: platforms(rec), sections: sections(rec, today, 30, d.skip || ['home']),
      recorded: rec.length
    };
  }

  /* ---------- made-up usage for the demo (so the page can be seen before a church has any) ---------- */
  function hash(s) { var h = 2166136261, i; s = String(s); for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 16; h = Math.imul(h, 2246822507); h ^= h >>> 13; h = Math.imul(h, 3266489909); h ^= h >>> 16;   // mix, so ids that look alike don't land alike
    return (h >>> 0) / 4294967296; }
  var DEMO_PARTS = ['people', 'rosters', 'messages', 'events', 'care', 'life', 'leave', 'library', 'board', 'me'];
  function demo(people, today, nowMs, latest) {
    var out = [], old = ['0.115.2', '0.116.0', '0.117.4'];
    (people || []).forEach(function (p) {
      if (!eligible(p)) return;
      var h = hash(p.id), keen = partner(p) ? 0.68 : 0.3;
      if (h > keen) return;
      var r = { id: p.id, firstSeen: back(today, Math.floor(hash('f' + p.id) * 84)), version: hash('v' + p.id) < 0.7 ? latest : old[Math.floor(hash('o' + p.id) * old.length)],
        platform: hash('p' + p.id) < 0.45 ? 'android' : hash('q' + p.id) < 0.5 ? 'app' : 'browser', days: {}, lastSeen: '' };
      var i, last = '';
      for (i = 0; i < 30; i++) {
        var d = back(today, i), wd = new Date(dayMs(d)).getUTCDay(), chance = (wd === 0 ? 0.7 : wd === 3 ? 0.45 : 0.25) * (0.4 + 1.2 * (h / keen));
        if (d < r.firstSeen || hash(p.id + d) > chance) continue;
        var v = {}; DEMO_PARTS.forEach(function (id, k) { var x = hash(p.id + d + id) * (1 - k * 0.08); if (x > 0.35) v[id] = 1 + Math.floor(x * 4); });
        r.days[d] = { n: 1 + Math.floor(hash('n' + p.id + d) * 3), v: v }; if (!last) last = d;
      }
      r.lastSeen = last === today && hash('now' + p.id) < 0.12 ? new Date(nowMs - Math.floor(hash('m' + p.id) * 240000)).toISOString() : (last || r.firstSeen) + 'T09:00:00Z';
      out.push(r);
    });
    return out;
  }

  return { eligible: eligible, adoption: adoption, notOn: notOn, onNow: onNow, active: active, daily: daily, weekdays: weekdays, growth: growth,
    compare: compare, versions: versions, platforms: platforms, sections: sections, summary: summary, demo: demo, ONLINE_MS: ONLINE_MS, KEEP: KEEP };
})();
if (typeof module !== 'undefined') module.exports = Usage;
