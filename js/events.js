/*
 * Church & Trellis – Events: organising, signing up and reminders (docs/COMMUNITY-PLAN.md part 1).
 * The rules of it (pure: no DOM, no Store), used by js/mod-events.js and by the email robot (robot/event-mail.js).
 * Tested: tests/events.test.js.
 *
 * Organisers (Administrators, Pastors and the church secretary until the church chooses – js/access.js JOBS.organisers)
 * put an event up: what, when, where, who it is for (everyone, or Church Partners only), and whether people sign up.
 * Members tap I'll be there, choose who in their household is coming, add guests if the event allows, and – if the
 * organiser offers it – tick "Email me reminders too".
 *
 * Reminders (asked for by the church, 20 Nov 2026): 3 days and 1 day before the event.
 *  - In Messages, always: each person's own Church & Trellis writes their reminder into their inbox on the day it is due
 *    (kind 'event', about 'remind', a fixed id so it is never written twice). It uses the event as it is then, so a
 *    changed time or place is right, and nobody is reminded of an event that was cancelled or that they left.
 *    If the 3-day reminder was missed (the app wasn't opened), only the latest one comes.
 *  - By email, for those who asked: the email robot (GitHub Actions, robot/event-mail.js) sends them each morning
 *    through the church's Gmail, and notes on the sign-up which ones went (mailed), so none goes twice.
 *
 * events/{id}       = { title, about, date 'YYYY-MM-DD', time 'HH:MM', end 'HH:MM' or '', place, address, who: 'all' | 'partners',
 *                       signup, closes 'YYYY-MM-DD' or '', guests (most guests a sign-up may bring; 0 = none), email (offer
 *                       email reminders), status: 'live' | 'cancelled', byId, byName, createdAt, updatedAt }
 * eventSignups/{eventId_personId} = { eventId, by (who signed up), people: [person ids coming], names: [their names],
 *                       guests, email ('' or the address for reminders), lang (the language for the email), mailed: ['3', '1'],
 *                       addedBy (only when someone on the staff added them, e.g. from a sign-up sheet: their person id),
 *                       createdAt, updatedAt }
 *
 * Adding people (asked for by the church, 20 Nov 2026): anyone on the staff (Administrators, Pastors, Roster coordinators,
 * Children's ministry) and the organisers may put people on the list – for people who put their name down on a paper
 * sheet. The sign-up is made in the person's own name (by = them), so it is theirs: they see "You're going", get the
 * reminders in Messages, and can change it or say they can't come. No email address is kept (they can tick that themselves).
 * Staff may add people after sign-up has closed, but not to a cancelled event or one that has started.
 *
 * POPIA: purpose – organising the church's events; the person signs up themselves, so the organisers (and only they)
 * see who is coming. An email address is kept on the sign-up only when the person ticks "Email me reminders too" (consent),
 * and only for that event. Sign-ups are deleted 30 days after the event; events a year after.
 */
var Events = (function () {
  'use strict';
  var TX = function (s) { return s; };   // translated where shown
  var DAY = 864e5, REMIND = [3, 1], KEEP_SIGNUPS = 30, KEEP_EVENTS = 365, MAX_GUESTS = 10, MAX_PEOPLE = 12;
  var MAX = { title: 80, about: 1500, place: 80, address: 160, name: 100, email: 200 };

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(s) { var b = String(s || '').split('-'); return new Date(+b[0], +b[1] - 1, +b[2]); }
  function okDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && iso(parse(s)) === s; }
  function okTime(s) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || '')); }
  function okEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '')) && String(s).length <= MAX.email && !/@pin\.church-hub\.invalid$/i.test(String(s)); }
  function line(s, n) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n); }
  function text(s, n) { return String(s == null ? '' : s).replace(/[ \t]+\n/g, '\n').trim().slice(0, n); }
  function nameOf(p) { return line(((p.preferredName || p.firstName || '') + ' ' + (p.lastName || '')), MAX.name); }

  /** When it starts, in this device's time (ms). */
  function startOf(e) { var d = parse(e.date), t = String(okTime(e.time) ? e.time : '00:00').split(':'); d.setHours(+t[0], +t[1], 0, 0); return d.getTime(); }
  /** When it is over: its end time, or 3 hours after it starts (ms). */
  function endOf(e) {
    if (okTime(e.end) && e.end > (e.time || '')) { var d = parse(e.date), t = e.end.split(':'); d.setHours(+t[0], +t[1], 0, 0); return d.getTime(); }
    return startOf(e) + 3 * 36e5;
  }
  /** Whole days from today to the event's day (0 = today, 1 = tomorrow; negative once the day has passed). */
  function daysTo(e, now) { var a = parse(iso(new Date(now))), b = parse(e.date); return Math.round((b - a) / DAY); }

  /**
   * An event from the form. input = { title, about, date, time, end, place, address, who, signup, closes, guests, email },
   * u = the organiser. Returns the record, or { error: 'title' | 'date' | 'time' | 'end' | 'closes' | 'past' }.
   */
  function make(input, u, now) {
    var i = input || {}, title = line(i.title, MAX.title);
    if (!title) return { error: 'title' };
    if (!okDate(i.date)) return { error: 'date' };
    if (!okTime(i.time)) return { error: 'time' };
    var end = String(i.end || '');
    if (end && (!okTime(end) || end <= i.time)) return { error: 'end' };
    var signup = i.signup !== false, closes = signup ? String(i.closes || '') : '';
    if (closes && (!okDate(closes) || closes > i.date)) return { error: 'closes' };
    var e = { title: title, about: text(i.about, MAX.about), date: i.date, time: i.time, end: end, place: line(i.place, MAX.place), address: line(i.address, MAX.address),
      who: i.who === 'partners' ? 'partners' : 'all', signup: signup, closes: closes,
      guests: signup ? Math.max(0, Math.min(MAX_GUESTS, Math.floor(+i.guests || 0))) : 0, email: signup && !!i.email, status: 'live',
      byId: (u && u.id) || '', byName: u ? nameOf(u) : '' };
    if (endOf(e) < now) return { error: 'past' };
    return e;
  }

  /** May this kind of person see it? (attendees: only events for everyone; organisers see everything) */
  function sees(e, kind, organiser) { return !!e && (organiser || e.who !== 'partners' || kind !== 'attendee'); }
  /** Not over yet (cancelled ones too, so people see that they were cancelled), soonest first. */
  function upcoming(list, now) { return (list || []).filter(function (e) { return endOf(e) >= now; }).sort(function (a, b) { return startOf(a) - startOf(b); }); }
  /** Over, newest first. */
  function past(list, now) { return (list || []).filter(function (e) { return endOf(e) < now; }).sort(function (a, b) { return startOf(b) - startOf(a); }); }
  /** Can people sign up for it now? 'open', or why not: 'none' (no sign-up), 'cancelled', 'closed' (after the closing date), 'started'. */
  function signupState(e, now) {
    if (!e.signup) return 'none';
    if (e.status === 'cancelled') return 'cancelled';
    if (now >= startOf(e)) return 'started';
    if (e.closes && iso(new Date(now)) > e.closes) return 'closed';
    return 'open';
  }

  /* ---------- signing up ---------- */
  function signupId(eventId, by) { return eventId + '_' + by; }
  /**
   * A sign-up. input = { people: [ids], guests, email: '' or an address (only when they ticked "Email me reminders too"), lang },
   * me = who is signing up, people = everyone they may choose (their household as they see it, with names).
   * Returns the record, or { error: 'people' | 'guests' | 'email' | 'closed' }.
   */
  function signup(e, me, input, people, now) {
    var i = input || {}, known = {}, picked = [];
    if (signupState(e, now) !== 'open') return { error: 'closed' };
    (people || []).forEach(function (p) { known[p.id] = p; });
    (i.people || []).forEach(function (id) { if (known[id] && picked.indexOf(id) < 0) picked.push(id); });
    if (!picked.length || picked.length > MAX_PEOPLE) return { error: 'people' };
    var g = Math.floor(+i.guests || 0);
    if (g < 0 || g > (e.guests || 0)) return { error: 'guests' };
    var email = String(i.email || '').trim();
    if (email && (!e.email || !okEmail(email))) return { error: 'email' };
    return { id: signupId(e.id, me.id), eventId: e.id, by: me.id, people: picked, names: picked.map(function (id) { return nameOf(known[id]); }),
      guests: g, email: email, lang: line(i.lang || 'en', 10), mailed: [] };
  }
  /**
   * Someone on the staff puts a person (and those of their household who are coming) on the list. person = the one whose
   * sign-up it is; input = { people: [ids], guests }; people = that person's household (with names); staff = who is adding.
   * Allowed after sign-up has closed (paper sheets come in late), not once the event is cancelled or has started.
   * Returns the record, or { error: 'people' | 'guests' | 'closed' }.
   */
  function add(e, person, input, people, staff, now) {
    var st = signupState(e, now);
    if (st !== 'open' && st !== 'closed') return { error: 'closed' };
    var x = signup(Object.assign({}, e, { closes: '' }), person, { people: (input || {}).people, guests: (input || {}).guests, email: '', lang: 'en' }, people, now);
    if (x.error) return x;
    x.addedBy = (staff && staff.id) || '';
    return x;
  }
  /** The sign-ups of one event. */
  function of(signups, eventId) { return (signups || []).filter(function (s) { return s.eventId === eventId; }); }
  /** Has this person signed up (themselves, or by someone in their household)? Returns the sign-up or null. */
  function mine(signups, eventId, pid) { return of(signups, eventId).filter(function (s) { return s.by === pid || (s.people || []).indexOf(pid) >= 0; })[0] || null; }
  /** How many are coming: { signups, people, guests, total }. */
  function count(signups, eventId) {
    var list = eventId ? of(signups, eventId) : (signups || []), p = 0, g = 0;
    list.forEach(function (s) { p += (s.people || []).length; g += +s.guests || 0; });
    return { signups: list.length, people: p, guests: g, total: p + g };
  }
  /** Who's coming, by name (A–Z), for the organisers' list and the door. */
  function names(signups, eventId) {
    return of(signups, eventId).slice().sort(function (a, b) { return String((a.names || [])[0] || '').localeCompare(String((b.names || [])[0] || '')); });
  }
  /**
   * The sign-up report (asked for 20 Nov 2026): for each chosen event that takes sign-ups (ids; all when none are given),
   * soonest first: { event, rows: its sign-ups A–Z, count }. The screens add each person's cellphone as the viewer may see it.
   */
  function report(events, signups, ids) {
    return (events || []).filter(function (e) { return e.signup && (!ids || ids.indexOf(e.id) >= 0); })
      .sort(function (a, b) { return startOf(a) - startOf(b); })
      .map(function (e) { return { event: e, rows: names(signups, e.id), count: count(signups, e.id) }; });
  }
  /** Who to phone about a sign-up (person ids): the one who signed up, then the others coming – each once. */
  function contacts(s) { var out = []; [s.by].concat(s.people || []).forEach(function (id) { if (id && out.indexOf(id) < 0) out.push(id); }); return out; }
  /** Everyone coming who can be sent a message (person ids). */
  function coming(signups, eventId) {
    var out = []; of(signups, eventId).forEach(function (s) { (s.people || []).concat([s.by]).forEach(function (id) { if (id && out.indexOf(id) < 0) out.push(id); }); });
    return out;
  }

  /* ---------- reminders: 3 days and 1 day before ---------- */
  /** The reminder due now for this event, or 0: 3 when the event is 3 or 2 days away, 1 when it is tomorrow or later today.
   *  Only for events that people signed up for, still on, and not started. */
  function due(e, now) {
    if (!e || !e.signup || e.status === 'cancelled' || now >= startOf(e)) return 0;
    var d = daysTo(e, now);
    for (var k = REMIND.length - 1; k >= 0; k--) if (d <= REMIND[k]) return REMIND[k];
    return 0;
  }
  /** The fixed id of one person's reminder, so it is only ever written once. */
  function reminderId(eventId, pid, r) { return 'er_' + eventId + '_' + pid + '_' + r; }
  /** The words of a reminder, in the language of tr (T in the app; the robot passes the person's language). */
  function when(e, now, tr, fmtDate) {
    var d = daysTo(e, now), day = fmtDate ? fmtDate(e.date) : e.date;
    var rel = d <= 0 ? tr('today') : d === 1 ? tr('tomorrow') : tr('in {n} days', { n: d });
    return { rel: rel, day: day, at: e.time + (okTime(e.end) ? '–' + e.end : '') };
  }
  function body(e, now, tr, fmtDate) {
    var w = when(e, now, tr, fmtDate);
    return [tr('{title} is {when}: {day} at {time}.', { title: e.title, when: w.rel, day: w.day, time: w.at }),
      e.place || e.address ? tr('Where: {place}', { place: [e.place, e.address].filter(Boolean).join(', ') }) : '',
      tr('We look forward to seeing you. If you can’t come after all, please tap I can’t come after all on the event in Events, so someone else can have your place.')].filter(Boolean).join('\n\n');
  }
  /** The reminder in Messages: from the person to themselves (the database rules allow nothing else without a server), shown as from the event. */
  function reminder(e, pid, r, now, tr, fmtDate) {
    var T = tr || fill;
    return { id: reminderId(e.id, pid, r), kind: 'event', about: 'remind', aboutId: e.id, audience: e.title.slice(0, 80),
      title: T('Reminder: {title}', { title: e.title }).slice(0, 120), body: body(e, now, T, fmtDate).slice(0, 4000),
      fromId: pid, fromName: e.title.slice(0, 100), to: [pid], readBy: [], deliveredBy: [] };
  }
  /**
   * The reminders this person's Church & Trellis should write now: [{ event, r }] – for events they are signed up for (or
   * signed up by someone in their household), when one is due and not already in their messages (have: message ids).
   */
  function toRemind(events, signups, pid, have, now) {
    var got = {}; (have || []).forEach(function (id) { got[id] = 1; });
    return (events || []).map(function (e) {
      var r = due(e, now), s = r && mine(signups, e.id, pid);
      if (!r || !s || (s.people || []).indexOf(pid) < 0) return null;
      var later = REMIND.filter(function (x) { return x <= r; });   // a later one already written means this one is past
      if (later.some(function (x) { return got[reminderId(e.id, pid, x)]; })) return null;
      return { event: e, r: r };
    }).filter(Boolean);
  }
  /** A message from organisers to everyone coming (kind 'event', about 'event'). */
  function messageAll(e, signups, from, title, text, fromName) {
    return { kind: 'event', about: 'event', aboutId: e.id, audience: e.title.slice(0, 80), title: line(title || e.title, 120), body: String(text || '').trim().slice(0, 4000),
      fromId: from.id, fromName: line(fromName || nameOf(from), 100), to: coming(signups, e.id).filter(function (x) { return x !== from.id; }), readBy: [], deliveredBy: [] };
  }

  /* ---------- email reminders (the robot) ---------- */
  /**
   * The emails to send this morning: [{ signup, event, r }] – sign-ups with an email address, for events still on, where a
   * reminder is due and hasn't been emailed (mailed). If both are due (the robot missed a day), only the latest is sent.
   */
  function emailsDue(events, signups, now) {
    var byId = {}; (events || []).forEach(function (e) { byId[e.id] = e; });
    return (signups || []).map(function (s) {
      var e = byId[s.eventId], r = e && e.email ? due(e, now) : 0, sent = (s.mailed || []).map(String);
      if (!r || !okEmail(s.email) || REMIND.some(function (x) { return x <= r && sent.indexOf(String(x)) >= 0; })) return null;
      return { signup: s, event: e, r: r };
    }).filter(Boolean);
  }
  /** What to note on the sign-up once a reminder was emailed: this one, and the earlier one if it was skipped. */
  function mailedAfter(s, r) {
    var m = (s.mailed || []).map(String);
    REMIND.forEach(function (x) { if (x >= r && m.indexOf(String(x)) < 0) m.push(String(x)); });
    return m.sort().reverse();
  }
  /** The email: { subject, text }. tr: the person's language; church: the church's name. */
  function email(e, s, now, tr, church, fmtDate) {
    var T = tr || fill, first = String(((s.names || [])[0] || '').split(' ')[0] || '');
    return { subject: T('Reminder: {title}', { title: e.title }) + (church ? ' – ' + church : ''),
      text: (first ? T('Dear {name},', { name: first }) + '\n\n' : '') + body(e, now, T, fmtDate) + '\n\n' + (church || '') +
        '\n\n' + T('You are getting this email because you asked for reminders when you signed up. Only for this event.') };
  }

  /* ---------- Add to my calendar (.ics: works on every phone) ---------- */
  function icsText(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1'); }
  function stamp(ms) { var d = new Date(ms); return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + '00Z'; }
  function ics(e, church, now) {
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Church & Trellis//Events//EN', 'BEGIN:VEVENT',
      'UID:' + e.id + '@churchandtrellis.com', 'DTSTAMP:' + stamp(now || Date.now()), 'DTSTART:' + stamp(startOf(e)), 'DTEND:' + stamp(endOf(e)),
      'SUMMARY:' + icsText(e.title), 'LOCATION:' + icsText([e.place, e.address].filter(Boolean).join(', ')),
      'DESCRIPTION:' + icsText((e.about || '') + (church ? '\n\n' + church : '')),
      'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsText(e.title), 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'].join('\r\n') + '\r\n';
  }

  /* ---------- tidying (POPIA: kept no longer than needed) ---------- */
  function staleSignup(s, events, now) { var e = (events || []).filter(function (x) { return x.id === s.eventId; })[0]; return !e || endOf(e) + KEEP_SIGNUPS * DAY < now; }
  function staleEvent(e, now) { return endOf(e) + KEEP_EVENTS * DAY < now; }

  function fill(s, v) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return v && v[k] !== undefined ? v[k] : m; }); }
  var WORDS = [TX('today'), TX('tomorrow'), TX('in {n} days')];
  return { REMIND: REMIND, MAX_GUESTS: MAX_GUESTS, okDate: okDate, okTime: okTime, okEmail: okEmail, startOf: startOf, endOf: endOf, daysTo: daysTo,
    make: make, sees: sees, upcoming: upcoming, past: past, signupState: signupState, signupId: signupId, signup: signup, add: add, of: of, mine: mine, count: count,
    names: names, report: report, contacts: contacts, coming: coming, due: due, reminderId: reminderId, when: when, reminder: reminder, toRemind: toRemind, messageAll: messageAll,
    emailsDue: emailsDue, mailedAfter: mailedAfter, email: email, ics: ics, staleSignup: staleSignup, staleEvent: staleEvent, WORDS: WORDS };
})();
if (typeof module !== 'undefined') module.exports = Events;
