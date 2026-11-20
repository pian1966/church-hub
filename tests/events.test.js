/* Tests for js/events.js – Events: organising, signing up and reminders (3 days and 1 day before). Made-up people only.
 * Run: node tests/events.test.js */
'use strict';
const E = require('../js/events.js');
let fails = 0;
function ok(c, what) { if (!c) { fails++; console.log('  ✗ ' + what); } else console.log('  ✓ ' + what); }
const at = (y, m, d, h, mi) => new Date(y, m - 1, d, h || 0, mi || 0).getTime();
const NOW = at(2026, 11, 20, 9);   // Friday 20 November 2026, 09:00
const ann = { id: 'p01', firstName: 'Annette', preferredName: 'Ann', lastName: 'Botha' };
const ben = { id: 'p02', firstName: 'Ben', lastName: 'Botha' };
const kid = { id: 'p03', firstName: 'Lily', lastName: 'Botha' };
const T = (s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => v && v[k] !== undefined ? v[k] : m);

console.log('Putting an event up');
const e = Object.assign(E.make({ title: '  Men’s   breakfast ', about: 'Bacon and the Bible', date: '2026-11-28', time: '07:30', end: '09:30', place: 'Church hall', guests: 2, email: true, closes: '2026-11-26' }, ann, NOW), { id: 'ev1' });
ok(!e.error && e.title === 'Men’s breakfast' && e.signup === true && e.guests === 2 && e.email === true && e.status === 'live' && e.who === 'all' && e.byName === 'Ann Botha', 'an event with sign-up, guests and email reminders');
ok(E.make({ title: '', date: '2026-11-28', time: '07:30' }, ann, NOW).error === 'title', 'it needs a name');
ok(E.make({ title: 'X', date: '2026-02-30', time: '07:30' }, ann, NOW).error === 'date' && E.make({ title: 'X', date: '2026-11-28', time: '7.30' }, ann, NOW).error === 'time', 'a real date and time');
ok(E.make({ title: 'X', date: '2026-11-28', time: '07:30', end: '07:00' }, ann, NOW).error === 'end', 'it ends after it starts');
ok(E.make({ title: 'X', date: '2026-11-28', time: '07:30', closes: '2026-11-29' }, ann, NOW).error === 'closes', 'sign-up closes on or before the day');
ok(E.make({ title: 'X', date: '2026-11-19', time: '07:30' }, ann, NOW).error === 'past', 'not in the past');
const noSign = E.make({ title: 'Carols', date: '2026-12-20', time: '18:00', signup: false, guests: 5, email: true }, ann, NOW);
ok(noSign.signup === false && noSign.guests === 0 && noSign.email === false, 'an event without sign-up has no guests or email reminders');
ok(E.make({ title: 'X', date: '2026-11-28', time: '07:30', guests: 99 }, ann, NOW).guests === E.MAX_GUESTS, 'guests are capped');

console.log('Who sees it');
const partners = Object.assign({}, e, { id: 'ev2', who: 'partners', date: '2026-11-29' });
ok(E.sees(e, 'attendee') && !E.sees(partners, 'attendee') && E.sees(partners, 'partner') && E.sees(partners, 'attendee', true), 'attendees only see events for everyone (organisers see all)');
const old = { id: 'ev0', title: 'Fete', date: '2026-11-01', time: '09:00', signup: true };
ok(E.upcoming([old, partners, e], NOW).map(x => x.id).join() === 'ev1,ev2' && E.past([old, e], NOW)[0].id === 'ev0', 'coming up, soonest first; past ones apart');

console.log('Signing up');
ok(E.signupState(e, NOW) === 'open' && E.signupState(e, at(2026, 11, 27, 8)) === 'closed' && E.signupState(Object.assign({}, e, { status: 'cancelled' }), NOW) === 'cancelled' && E.signupState(noSign, NOW) === 'none', 'open until the closing date');
const fam = [ann, ben, kid];
const s = E.signup(e, ann, { people: ['p01', 'p03', 'p03', 'zz'], guests: 1, email: 'ann@example.org', lang: 'af' }, fam, NOW);
ok(!s.error && s.id === 'ev1_p01' && s.people.join() === 'p01,p03' && s.names.join() === 'Ann Botha,Lily Botha' && s.guests === 1 && s.email === 'ann@example.org' && s.lang === 'af', 'Ann signs up herself and Lily, with a guest and email reminders');
ok(E.signup(e, ann, { people: [] }, fam, NOW).error === 'people' && E.signup(e, ann, { people: ['p01'], guests: 3 }, fam, NOW).error === 'guests', 'someone must come; no more guests than allowed');
ok(E.signup(e, ann, { people: ['p01'], email: 'not an email' }, fam, NOW).error === 'email' && E.signup(Object.assign({}, e, { email: false }), ann, { people: ['p01'], email: 'ann@example.org' }, fam, NOW).error === 'email', 'email only when offered, and a real address');
ok(E.signup(e, ann, { people: ['p01'], email: '0821-1234@pin.church-hub.invalid' }, fam, NOW).error === 'email', 'never a made-up number-and-PIN address');
ok(E.signup(e, ann, { people: ['p01'] }, fam, at(2026, 11, 27, 8)).error === 'closed', 'not after it closes');
const s2 = E.signup(e, ben, { people: ['p02'] }, fam, NOW);
ok(E.mine([s, s2], 'ev1', 'p03') === s && E.mine([s], 'ev1', 'p02') === null, 'Lily is signed up by Ann; Ben isn’t until he signs up');
const c = E.count([s, s2, { eventId: 'other', people: ['x'], guests: 4 }], 'ev1');
ok(c.signups === 2 && c.people === 3 && c.guests === 1 && c.total === 4, 'counts: people and guests');
ok(E.coming([s, s2], 'ev1').sort().join() === 'p01,p02,p03', 'everyone coming, for a message');

console.log('Reminders: 3 days and 1 day before');
ok(E.due(e, at(2026, 11, 24, 9)) === 0, '4 days before: nothing yet');
ok(E.due(e, at(2026, 11, 25, 0, 1)) === 3 && E.due(e, at(2026, 11, 26, 20)) === 3, '3 and 2 days before: the 3-day reminder');
ok(E.due(e, at(2026, 11, 27, 6)) === 1 && E.due(e, at(2026, 11, 28, 6)) === 1, 'the day before (and that morning): the 1-day reminder');
ok(E.due(e, at(2026, 11, 28, 7, 30)) === 0 && E.due(Object.assign({}, e, { status: 'cancelled' }), at(2026, 11, 27, 6)) === 0 && E.due(Object.assign({}, noSign, { id: 'x' }), at(2026, 12, 19, 9)) === 0, 'none once it has started, if cancelled, or with no sign-up');
const d3 = at(2026, 11, 25, 9), d1 = at(2026, 11, 27, 9);
ok(E.toRemind([e], [s], 'p01', [], d3).length === 1 && E.toRemind([e], [s], 'p01', [], d3)[0].r === 3, 'Ann gets the 3-day reminder');
ok(E.toRemind([e], [s], 'p03', [], d3).length === 1, 'Lily too (Ann signed her up)');
ok(E.toRemind([e], [s], 'p02', [], d3).length === 0, 'Ben isn’t signed up: no reminder');
ok(E.toRemind([e], [s], 'p01', [E.reminderId('ev1', 'p01', 3)], d3).length === 0, 'never twice');
ok(E.toRemind([e], [s], 'p01', [E.reminderId('ev1', 'p01', 3)], d1)[0].r === 1, 'then the 1-day reminder');
ok(E.toRemind([e], [s], 'p01', [], d1)[0].r === 1 && E.toRemind([e], [s], 'p01', [E.reminderId('ev1', 'p01', 1)], d1).length === 0, 'missed the 3-day one: only the latest comes');
const m = E.reminder(e, 'p01', 3, d3, T);
ok(m.id === 'er_ev1_p01_3' && m.kind === 'event' && m.about === 'remind' && m.aboutId === 'ev1' && m.to.join() === 'p01' && m.fromId === 'p01' && m.fromName === 'Men’s breakfast', 'the reminder goes to her own inbox, from the event');
ok(/in 3 days: 2026-11-28 at 07:30–09:30/.test(m.body) && /Where: Church hall/.test(m.body) && m.title === 'Reminder: Men’s breakfast', 'it says when and where');
ok(/tomorrow/.test(E.reminder(e, 'p01', 1, d1, T).body) && /today/.test(E.reminder(e, 'p01', 1, at(2026, 11, 28, 6), T).body), '“tomorrow”, or “today” on the morning');
const all = E.messageAll(e, [s, s2], ann, '', 'Bring a friend!');
ok(all.kind === 'event' && all.about === 'event' && all.to.sort().join() === 'p02,p03' && all.title === 'Men’s breakfast', 'a message to everyone coming (not the sender)');

console.log('Email reminders (the robot)');
const sNo = Object.assign({}, s2, { email: '' });
ok(E.emailsDue([e], [s, sNo], d3).length === 1 && E.emailsDue([e], [s, sNo], d3)[0].r === 3, 'only those who asked for email');
ok(E.emailsDue([e], [Object.assign({}, s, { mailed: ['3'] })], d3).length === 0 && E.emailsDue([e], [Object.assign({}, s, { mailed: ['3'] })], d1)[0].r === 1, 'each one once: the 3-day one, then the 1-day one');
ok(E.emailsDue([e], [Object.assign({}, s, { mailed: ['1'] })], d1).length === 0, 'not again after the 1-day one');
ok(E.emailsDue([Object.assign({}, e, { email: false })], [s], d3).length === 0 && E.emailsDue([Object.assign({}, e, { status: 'cancelled' })], [s], d3).length === 0, 'not when the organiser switched email off, or the event was cancelled');
ok(E.mailedAfter({ mailed: [] }, 1).join() === '3,1' && E.mailedAfter({ mailed: [] }, 3).join() === '3', 'a skipped 3-day email is marked as done with the 1-day one');
const em = E.email(e, s, d3, T, 'St Example’s');
ok(em.subject === 'Reminder: Men’s breakfast – St Example’s' && /^Dear Ann,/.test(em.text) && /in 3 days/.test(em.text) && /asked for reminders/.test(em.text), 'the email: their name, when, and why they got it');

console.log('Calendar and tidying');
const cal = E.ics(e, 'St Example’s', NOW);
ok(/BEGIN:VEVENT/.test(cal) && /SUMMARY:Men’s breakfast/.test(cal) && /LOCATION:Church hall/.test(cal) && /TRIGGER:-P1D/.test(cal) && /\r\n$/.test(cal), 'an .ics file with a reminder the day before');
ok(E.staleSignup(s, [e], at(2026, 12, 29, 9)) && !E.staleSignup(s, [e], at(2026, 12, 20, 9)) && E.staleSignup(s, [], NOW), 'sign-ups go 30 days after the event');
ok(E.staleEvent(e, at(2027, 12, 1)) && !E.staleEvent(e, at(2027, 6, 1)), 'events go a year after');

console.log(fails ? '\n' + fails + ' FAILED' : '\nAll passed');
process.exit(fails ? 1 : 0);
