/*
 * Church & Trellis – Midweek Groups online: this week's meeting links (docs/COMMUNITY-PLAN.md part 4).
 * The rules of it (pure: no DOM, no Store), used by js/mod-life.js and js/mod-messages.js. Tested: tests/studies.test.js.
 *
 * A group's leader (or a co-leader) posts the week's links: the meeting link (Google Meet, Zoom, Teams, YouTube Live), the
 * notes link (a Google Doc, a PDF, any link) and, if they like, the topic or passage. The meeting link is remembered from
 * last time (a recurring Meet link stays the same), so most weeks only the notes are new. The members get a message in
 * Messages with Join the meeting and Open the notes – straight away, or on the day (it waits until then: showFrom); on the
 * day a card on Home says "tonight at 19:00", which becomes "Join now" 15 minutes before. Past studies stay on the
 * group's page so anyone who missed a week can catch up. A live-streamed study can be open to the whole church: anyone
 * signed in sees it on Home that day and on the Midweek Groups page.
 *
 * studies/{id} = { groupId, groupName, date: 'YYYY-MM-DD', time: 'HH:MM', meet, notes, topic, open, showFrom (ms),
 *                  to: [the group's members when posted], fromId, fromName, createdAt, updatedAt }
 * The message: messages/{id} with kind 'life', about 'study', aboutId the study's id, showFrom (js/messages.js).
 *
 * Safety: only http(s) links; well-known meeting and document sites show their name; any other link shows its address
 * with a gentle "check this link". Church & Trellis keeps the links only – nobody connects a Google account.
 * POPIA: nothing personal beyond the group, which its members already agreed to share; a study is deleted a year after it.
 */
var Studies = (function () {
  'use strict';
  var TX = function (s) { return s; };   // translated where shown
  var DAY = 864e5, EARLY = 15, LIVE_FOR = 3 * 60, KEEP_DAYS = 365, MAX_URL = 500, MAX_TOPIC = 120;
  // [id, how a link is recognised, its name, what kind of link]
  var SITES = [
    ['meet', /(^|\.)meet\.google\.com$/, 'Google Meet', 'meet'],
    ['zoom', /(^|\.)zoom\.us$/, 'Zoom', 'meet'],
    ['teams', /(^|\.)teams\.(microsoft|live)\.com$/, 'Microsoft Teams', 'meet'],
    ['youtube', /(^|\.)(youtube\.com|youtu\.be)$/, 'YouTube', 'meet'],
    ['facebook', /(^|\.)(facebook\.com|fb\.watch)$/, 'Facebook', 'meet'],
    ['docs', /(^|\.)docs\.google\.com$/, 'Google Docs', 'notes'],
    ['drive', /(^|\.)drive\.google\.com$/, 'Google Drive', 'notes'],
    ['onedrive', /(^|\.)(onedrive\.live\.com|1drv\.ms|sharepoint\.com)$/, 'OneDrive', 'notes'],
    ['dropbox', /(^|\.)dropbox\.com$/, 'Dropbox', 'notes'],
    ['bible', /(^|\.)(bible\.com|biblegateway\.com)$/, 'Bible', 'notes']
  ];

  /** A link as typed (spaces trimmed, "www." given https://) – or '' if it is not a web link. */
  function clean(u) {
    var s = String(u || '').trim();
    if (!s) return '';
    if (/^www\./i.test(s)) s = 'https://' + s;
    if (!/^https?:\/\/[^\s/?#]+\.[^\s/?#]+/i.test(s) || /\s/.test(s) || s.length > MAX_URL) return '';
    return s;
  }
  /** What a link is: { ok, url, host, site: id or '', name, kind: 'meet' | 'notes' | '', pdf } */
  function about(u) {
    var url = clean(u); if (!url) return { ok: false, url: '', host: '', site: '', name: '', kind: '', pdf: false };
    var host = url.replace(/^https?:\/\//i, '').split(/[/?#]/)[0].replace(/:\d+$/, '').toLowerCase();
    var hit = SITES.filter(function (s) { return s[1].test(host); })[0], pdf = /\.pdf($|[?#])/i.test(url);
    return { ok: true, url: url, host: host, site: hit ? hit[0] : '', name: hit ? hit[2] : '', kind: hit ? hit[3] : pdf ? 'notes' : '', pdf: pdf };
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(s) { var b = String(s || '').split('-'); return new Date(+b[0], +b[1] - 1, +b[2]); }
  function okDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && iso(parse(s)) === s; }
  function okTime(s) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || '')); }
  /** The day the group next meets, from today (its meeting day, g.when.day 0–6), or today when it has none. */
  function nextDate(g, today) {
    var t = parse(today), day = g && g.when && g.when.day !== '' && g.when.day !== undefined ? +g.when.day : -1;
    if (day < 0 || day > 6) return today;
    var d = new Date(t); d.setDate(t.getDate() + ((day - t.getDay() + 7) % 7)); return iso(d);
  }
  /** A study's start, in this device's time (milliseconds). */
  function startOf(s) { var d = parse(s.date), t = String(s.time || '00:00').split(':'); d.setHours(+t[0] || 0, +t[1] || 0, 0, 0); return d.getTime(); }

  function byDate(a, b) { return (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')); }
  /** A group's studies, newest first. */
  function ofGroup(list, gid) { return (list || []).filter(function (s) { return s.groupId === gid; }).sort(byDate); }
  /** What to fill the form with: the group's day and time, and last time's meeting link (and whether it was open). */
  function defaults(g, list, today) {
    var last = ofGroup(list, g.id)[0] || {}, w = g.when || {};
    return { date: nextDate(g, today), time: okTime(w.time) ? w.time : okTime(last.time) ? last.time : '19:00', meet: last.meet || '', notes: '', topic: '', open: !!last.open };
  }

  /**
   * A study from the form. input = { date, time, meet, notes, topic, open, when: 'now' | 'day', sendAt: 'HH:MM' },
   * g = the group, u = who is posting, now = ms. Returns the record, or { error: 'date' | 'time' | 'links' | 'meet' | 'notes' | 'past' }.
   */
  function make(input, g, u, now) {
    var i = input || {}, rawMeet = String(i.meet || '').trim(), rawNotes = String(i.notes || '').trim();
    if (!okDate(i.date)) return { error: 'date' };
    if (!okTime(i.time)) return { error: 'time' };
    if (!rawMeet && !rawNotes) return { error: 'links' };
    var meet = clean(rawMeet), notes = clean(rawNotes);
    if (rawMeet && !meet) return { error: 'meet' };
    if (rawNotes && !notes) return { error: 'notes' };
    var s = { groupId: g.id, groupName: String(g.name || '').slice(0, 80), date: i.date, time: i.time, meet: meet, notes: notes,
      topic: String(i.topic || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TOPIC), open: !!i.open,
      to: (g.memberIds || []).slice(), fromId: u.id, fromName: String(((u.preferredName || u.firstName || '') + ' ' + (u.lastName || '')).trim()).slice(0, 100), showFrom: 0 };
    if (i.when === 'day') {
      var at = okTime(i.sendAt) ? i.sendAt : '08:00', d = parse(i.date), t = at.split(':'); d.setHours(+t[0], +t[1], 0, 0);
      if (d.getTime() > now) s.showFrom = d.getTime();
    }
    if (startOf(s) + LIVE_FOR * 60000 < now) return { error: 'past' };
    return s;
  }
  /** Sending it to the group: the message (kind life, about study). Its words are in the sender's language; the inbox shows
   *  Join the meeting / Open the notes from the study itself. tr: the translator (T). */
  function message(s, id, tr, fmtDate) {
    var T = tr || function (x, v) { return String(x).replace(/\{(\w+)\}/g, function (m, k) { return v && v[k] !== undefined ? v[k] : m; }); };
    var when = (fmtDate ? fmtDate(s.date) : s.date) + ' ' + s.time;
    var body = [s.topic, s.meet ? T('Join the meeting') + ': ' + s.meet : '', s.notes ? T('Open the notes') + ': ' + s.notes : ''].filter(Boolean).join('\n');
    var m = { kind: 'life', groupId: s.groupId, audience: s.groupName, about: 'study', aboutId: id, title: (s.groupName + ' – ' + when).slice(0, 120),
      body: body.slice(0, 4000) || when, fromId: s.fromId, fromName: s.fromName, to: s.to.slice(), readBy: [], deliveredBy: [] };
    if (s.showFrom) m.showFrom = s.showFrom;
    return m;
  }

  /** Where a study stands at this moment: 'later' (another day), 'today', 'soon' (within 15 minutes – Join now), 'live'
   *  (it has started, for up to 3 hours) or 'past'. */
  function state(s, now) {
    var st = startOf(s), today = iso(new Date(now));
    if (now >= st + LIVE_FOR * 60000) return 'past';
    if (now >= st) return 'live';
    if (now >= st - EARLY * 60000) return 'soon';
    return s.date === today ? 'today' : 'later';
  }
  /** The studies for Home today: in my groups, or open to the whole church – not yet over, earliest first. */
  function forToday(list, pid, now) {
    var today = iso(new Date(now));
    return (list || []).filter(function (s) { return s.date === today && ((s.to || []).indexOf(pid) >= 0 || s.open) && state(s, now) !== 'past'; })
      .sort(function (a, b) { return a.time.localeCompare(b.time); });
  }
  /** Studies open to the whole church, from today on (for someone not in the group), soonest first. */
  function openSoon(list, now) {
    var today = iso(new Date(now));
    return (list || []).filter(function (s) { return s.open && s.date >= today && state(s, now) !== 'past'; }).sort(function (a, b) { return byDate(b, a); });
  }
  /** Old enough to delete (a year after it took place). */
  function stale(s, now) { return startOf(s) + KEEP_DAYS * DAY < now; }

  /** May this person post a group's links? Its leaders and co-leaders (and Administrators and Pastors: manager). */
  function mayPost(g, pid, manager) {
    if (!g) return false;
    if (manager) return true;
    return (g.memberIds || []).indexOf(pid) >= 0 && ((g.leaderIds || []).indexOf(pid) >= 0 || ((g.roles || {})[pid] === 'coleader'));
  }

  var WORDS = [TX('Join the meeting'), TX('Open the notes')];
  return { about: about, clean: clean, nextDate: nextDate, defaults: defaults, make: make, message: message, state: state, forToday: forToday,
    openSoon: openSoon, ofGroup: ofGroup, stale: stale, startOf: startOf, mayPost: mayPost, okDate: okDate, okTime: okTime, WORDS: WORDS, EARLY: EARLY };
})();
if (typeof module !== 'undefined') module.exports = Studies;
