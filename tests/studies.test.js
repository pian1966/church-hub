/* Tests for js/studies.js – Midweek Groups online: this week's meeting links. Made-up people only.
 * Run: node tests/studies.test.js */
'use strict';
const S = require('../js/studies.js');
let fails = 0;
function ok(c, what) { if (!c) { fails++; console.log('  ✗ ' + what); } else console.log('  ✓ ' + what); }
const at = (y, m, d, h, mi) => new Date(y, m - 1, d, h || 0, mi || 0).getTime();
const NOW = at(2026, 11, 19, 10);   // Thursday 19 November 2026, 10:00
const g = { id: 'lg1', name: 'Wednesday Bible study', type: 'life', leaderIds: ['p14'], memberIds: ['p14', 'p02', 'p03'], roles: { p03: 'coleader' }, when: { day: 3, time: '19:00', freq: 'weekly' } };
const tim = { id: 'p14', firstName: 'Timothy', preferredName: 'Tim', lastName: 'Jacobs' };

console.log('Links');
ok(S.about('https://meet.google.com/abc-defg-hij').site === 'meet' && S.about('https://meet.google.com/abc').kind === 'meet', 'Google Meet is recognised as a meeting');
ok(S.about('https://us02web.zoom.us/j/123').name === 'Zoom' && S.about('https://youtu.be/xyz').site === 'youtube' && S.about('https://www.youtube.com/live/x').site === 'youtube', 'Zoom and YouTube too');
ok(S.about('https://docs.google.com/document/d/1x/edit').kind === 'notes' && S.about('https://example.org/notes.pdf').pdf, 'a Google Doc and a PDF are notes');
ok(S.about('www.example.org/x').url === 'https://example.org/x'.replace('example', 'www.example') && S.about('  https://a.org/b  ').ok, 'www. is given https://, spaces trimmed');
ok(!S.about('javascript:alert(1)').ok && !S.about('ftp://a.org/x').ok && !S.about('meet.google.com/abc').ok && !S.about('https://a b.org').ok && !S.about('https://localhost/x').ok, 'only real http(s) web links');
ok(S.about('https://evil-meet.google.com.example.net/x').site === '' && S.about('https://notmeet.google.com.evil.org').site === '', 'a look-alike address is not taken for a known site');

console.log('The form');
ok(S.nextDate(g, '2026-11-19') === '2026-11-25' && S.nextDate(g, '2026-11-18') === '2026-11-18', 'the date is the group’s next meeting day (today if it meets today)');
ok(S.nextDate({ id: 'x' }, '2026-11-19') === '2026-11-19', 'a group with no meeting day: today');
const last = { id: 's0', groupId: 'lg1', date: '2026-11-11', time: '19:00', meet: 'https://meet.google.com/aaa-bbbb-ccc', notes: 'https://docs.google.com/d/old', open: true };
const d = S.defaults(g, [last, { groupId: 'other', date: '2026-11-18', meet: 'https://zoom.us/j/9' }], '2026-11-19');
ok(d.meet === last.meet && d.notes === '' && d.open === true && d.time === '19:00' && d.date === '2026-11-25', 'last week’s meeting link is remembered; the notes start empty');

console.log('Posting');
const s = S.make({ date: '2026-11-25', time: '19:00', meet: last.meet, notes: 'https://docs.google.com/document/d/new', topic: '  Romans   8 ', when: 'now' }, g, tim, NOW);
ok(!s.error && s.topic === 'Romans 8' && s.to.join() === 'p14,p02,p03' && s.fromName === 'Tim Jacobs' && s.showFrom === 0 && s.open === false, 'posted to the group’s members, by name');
ok(S.make({ date: '2026-11-25', time: '19:00' }, g, tim, NOW).error === 'links', 'at least one link');
ok(S.make({ date: '2026-11-25', time: '19:00', meet: 'not a link' }, g, tim, NOW).error === 'meet' && S.make({ date: '2026-11-25', time: '19:00', notes: 'ftp://x.org/a' }, g, tim, NOW).error === 'notes', 'a link that isn’t a web link is refused');
ok(S.make({ date: '2026-02-30', time: '19:00', meet: last.meet }, g, tim, NOW).error === 'date' && S.make({ date: '2026-11-25', time: '25:00', meet: last.meet }, g, tim, NOW).error === 'time', 'a real date and time');
ok(S.make({ date: '2026-11-11', time: '19:00', meet: last.meet }, g, tim, NOW).error === 'past', 'not for a study that is already over');
const later = S.make({ date: '2026-11-25', time: '19:00', meet: last.meet, when: 'day', sendAt: '17:00' }, g, tim, NOW);
ok(later.showFrom === at(2026, 11, 25, 17), 'Send on the day: the message waits until 17:00 that day');
ok(S.make({ date: '2026-11-19', time: '19:00', meet: last.meet, when: 'day', sendAt: '08:00' }, g, tim, NOW).showFrom === 0, 'on the day, after the time chosen: it goes now');
const m = S.message(later, 'st1', null, null);
ok(m.kind === 'life' && m.about === 'study' && m.aboutId === 'st1' && m.groupId === 'lg1' && m.showFrom === later.showFrom && m.to.length === 3 && /Join the meeting: https:\/\/meet/.test(m.body) && m.title === 'Wednesday Bible study – 2026-11-25 19:00', 'the message carries both links and waits with the study');

console.log('On the day');
const st = Object.assign({ id: 's1' }, s, { date: '2026-11-19', time: '19:00' });
ok(S.state(st, at(2026, 11, 19, 10)) === 'today' && S.state(st, at(2026, 11, 19, 18, 50)) === 'soon' && S.state(st, at(2026, 11, 19, 19, 30)) === 'live' && S.state(st, at(2026, 11, 19, 22, 30)) === 'past' && S.state(st, at(2026, 11, 18, 10)) === 'later', 'today → Join now 15 minutes before → live → over');
ok(S.forToday([st], 'p02', NOW).length === 1 && S.forToday([st], 'p99', NOW).length === 0 && S.forToday([Object.assign({}, st, { open: true })], 'p99', NOW).length === 1, 'Home: my group’s study, or one open to the whole church');
ok(S.openSoon([Object.assign({}, st, { open: true }), Object.assign({}, st, { date: '2026-11-12', open: true }), s], NOW).length === 1, 'open to everyone, not yet over');
ok(S.ofGroup([last, s, { groupId: 'x', date: '2026-12-01' }], 'lg1')[0] === s, 'past studies, newest first');
ok(S.stale(last, at(2027, 11, 12)) && !S.stale(last, at(2027, 11, 10)), 'deleted a year after');

console.log('Who may post');
ok(S.mayPost(g, 'p14') && S.mayPost(g, 'p03') && !S.mayPost(g, 'p02') && S.mayPost(g, 'p99', true) && !S.mayPost(null, 'p14', true), 'leaders and co-leaders (and Administrators and Pastors), not other members');

if (fails) { console.log(fails + ' failed'); process.exit(1); } else console.log('All passed');
