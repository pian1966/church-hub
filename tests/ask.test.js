/* Tests for js/ask.js (search in your own words). Run: node tests/ask.test.js */
'use strict';
const A = require('../js/ask.js');
let fails = 0;
function ok(c, what) { if (!c) { fails++; console.log('  ✗ ' + what); } else console.log('  ✓ ' + what); }
const keys = 'name firstName lastName category gender birthday birthDate age idNumber volunteer address email mobile adultChild staff marital positions teams serviceTimes town household directory status added awaySoon wedding';
const ALL = {}; keys.split(' ').forEach(k => { ALL[k] = true; });
const SLOTS = [{ id: '08:00', label: '8am', time: '08:00' }, { id: '10:00', label: '10am', time: '10:00' }, { id: '17:00', label: '5pm', time: '17:00' }, { id: 'memorial', label: 'Memorial', time: '' }];
const ctx = (more) => Object.assign({ today: '2026-11-09', fields: ALL, services: true, words: { partner: ['Church Partner', 'Church Partners'], attender: ['Attender', 'Attenders'] },
  slots: SLOTS, slotLabel: id => (SLOTS.find(s => s.id === id) || {}).label || id, positions: ['Sound desk', 'Door', 'Keys', 'Tea & coffee'], teams: ['Kids', 'Worship'],
  towns: ['Howick', 'Hilton'], people: [{ id: 'p1', names: ['Andy Pike', 'Andrew Pike'] }, { id: 'p2', names: ['Sam Peters'] }] }, more || {});
const f = (q, c) => A.parse(q, ctx(c));
const fl = r => r.filters.map(x => x.field + ' ' + x.op + (x.value !== '' ? ' ' + x.value : '') + (x.value2 ? '–' + x.value2 : '') + (x.unit ? ' ' + x.unit : '')).join(' | ');

console.log('People');
let r = f('show me all people who are official partners, and males, and with birthdays in April');
ok(r.kind === 'people' && fl(r) === 'category eq Church Partner | gender eq Male | birthday month 4' && r.match === 'all' && !r.unknown.length, 'Church Partners, men, birthdays in April: ' + fl(r));
r = f('Show me all people that do not have an ID number, and that are volunteers in any capacity, and that do have a home address');
ok(fl(r) === 'idNumber empty | volunteer yes | address nempty' && !r.unknown.length, 'no ID number, a volunteer, with a home address: ' + fl(r));
r = f('women over 60 who live in Hilton');
ok(fl(r) === 'gender eq Female | age gt 60 | town has Hilton', 'women over 60 living in Hilton: ' + fl(r));
r = f('partners or attenders who are kids');
ok(r.match === 'logic' && r.logic === '(1 OR 2) AND 3' && fl(r) === 'category eq Church Partner | category eq Attender | adultChild eq Child', '“or” between two of the same kind: (1 OR 2) AND 3');
r = f('Parishioners without an email address', { words: { partner: ['Parishioner', 'Parishioners'] } });
ok(fl(r) === 'category eq Church Partner | email empty', 'the church’s own word (Parishioners) and “without an email”');
r = f('men aged 20 to 35 who are not married');
ok(fl(r) === 'gender eq Male | age between 20–35 | marital ne Married', 'an age range and “not married”: ' + fl(r));
r = f('people in their thirties with birthdays in the next 2 weeks');
ok(fl(r) === 'age between 30–39 | birthday next 2 weeks', '“in their thirties”, birthdays in the next 2 weeks: ' + fl(r));
r = f('people on the sound desk and people in the worship team');
ok(fl(r) === 'positions inc Sound desk | teams inc Worship', 'a position and a team: ' + fl(r));
r = f('kids who are not volunteers');
ok(fl(r) === 'adultChild eq Child | volunteer no', '“kids” are children (not the Kids team); “not volunteers”');
r = f('people who volunteer at the 10am service');
ok(r.kind === 'people' && fl(r) === 'serviceTimes inc 10am', 'volunteers at the 10am service are people, not services: ' + fl(r));
r = f('staff born in 1980');
ok(fl(r) === 'staff yes | birthDate between 1980-01-01–1980-12-31', 'staff born in 1980');
r = f('teenagers with wedding anniversaries in June');
ok(fl(r) === 'adultChild eq Child | age between 13–19 | wedding month 6', 'teenagers; wedding anniversaries in June: ' + fl(r));
r = f('people with no mobile, added in the last 3 months');
ok(fl(r) === 'mobile empty | added last 3 months', 'no mobile, added in the last 3 months: ' + fl(r));
r = f('blue-eyed people who are male');
ok(fl(r) === 'gender eq Male' && r.unknown.join() === 'blue-eyed', 'words it doesn’t know are reported, not guessed: ' + r.unknown.join());
r = f('people without an ID number', { fields: { name: true } });
ok(!r.filters.length && r.refused.join() === 'idNumber', 'a field this role may not search on is refused, not used');
r = f('with birthdays in April');
ok(fl(r) === 'birthday month 4', '“with birthdays in April” isn’t read as “has a birthday”');

r = f('all firstnames beginning with m');
ok(fl(r) === 'firstName starts m' && !r.unknown.length, '“all firstnames beginning with m”: ' + fl(r) + ' / left: ' + r.unknown.join());
r = f('women whose surname starts with van der');
ok(fl(r) === 'gender eq Female | lastName starts van der' && !r.unknown.length, 'surname starts with “van der”: ' + fl(r));
r = f('people with first names starting with the letter J who are men');
ok(fl(r) === 'firstName starts j | gender eq Male' && !r.unknown.length, 'first names starting with the letter J, men: ' + fl(r));
r = f('names beginning with a');
ok(fl(r) === 'firstName starts a', '“beginning with a” is the letter a: ' + fl(r));
r = f('people whose last name is Pike');
ok(fl(r) === 'lastName eq pike', 'whose last name is Pike: ' + fl(r));
r = f('members with the first name Andy');
ok(fl(r) === 'category eq Church Partner | firstName eq andy', 'with the first name Andy: ' + fl(r));

console.log('Services');
r = f('Show me all 10am services between 12 November and 2 Feb that do not have all necessary volunteer positions filled');
ok(r.kind === 'services' && r.q.from === '2026-11-12' && r.q.to === '2027-02-02' && r.q.slots.join() === '10:00' && r.q.gaps === 'some' && !r.unknown.length, '10am services, 12 Nov to 2 Feb (next year), not all filled');
ok(r.said.map(s => s[0]).join(' | ') === '{from} to {to} | At {services} | Not all positions filled' && r.said[1][1].services === '10am', 'says what it understood, with the service’s name');
r = f('show me all services where Andy Pike is serving in both a morning and an evening service on the same day');
ok(r.q.personId === 'p1' && r.q.sameDay === 'morning-evening' && r.q.from === '2026-11-09' && !r.unknown.length, 'Andy Pike at a morning and an evening service on the same day (from today)');
r = f('services where Andrew Pike is serving in December');
ok(r.q.personId === 'p1' && r.q.from === '2026-12-01' && r.q.to === '2026-12-31', 'by their other name, in December');
r = f('services where Bob Smith is serving');
ok(!r.q.personId && r.noPerson === 'Bob Smith', 'someone not in the church is said, not ignored');
r = f('evening services next month without a sound desk');
ok(r.q.part === 'evening' && r.q.from === '2026-12-01' && r.q.to === '2026-12-31' && r.q.missingPos.join() === 'Sound desk', 'evening services next month with no one on the sound desk');
r = f('8am services in the next 3 weeks that are fully staffed');
ok(r.q.slots.join() === '08:00' && r.q.from === '2026-11-09' && r.q.to === '2026-11-30' && r.q.gaps === 'none', '8am services in the next 3 weeks, fully staffed');
r = f('services on 15/11');
ok(r.q.from === '2026-11-15' && r.q.to === '2026-11-15', 'a day written 15/11 (day/month)');
r = f('roster for 5pm services from 1 March 2027 until 30 April 2027 with gaps');
ok(r.q.from === '2027-03-01' && r.q.to === '2027-04-30' && r.q.slots.join() === '17:00' && r.q.gaps === 'some', 'dates with years; “with gaps”');
r = f('services with gaps', { services: false });
ok(r.refused.join() === 'services', 'someone who can’t see the roster is told so');

console.log('Running a services search');
const positions = [{ id: 'snd', name: 'Sound desk', needed: 1 }, { id: 'door', name: 'Door', needed: 2 }, { id: 'crech', name: 'Creche', needed: 1, times: ['08:00'] }];
const services = [{ id: 's1', date: '2026-11-15', time: '08:00', slot: '08:00' }, { id: 's2', date: '2026-11-15', time: '10:00', slot: '10:00' }, { id: 's3', date: '2026-11-15', time: '17:00', slot: '17:00' },
  { id: 's4', date: '2026-11-22', time: '10:00', slot: '10:00' }, { id: 's5', date: '2026-11-22', time: '17:00', slot: '17:00' }, { id: 's6', date: '2026-11-01', time: '10:00', slot: '10:00' }];
const asg = (s, p, who, st) => ({ serviceId: s, positionId: p, personId: who, status: st || 'accepted' });
const assignments = [asg('s2', 'snd', 'p1'), asg('s2', 'door', 'x'), asg('s2', 'door', 'y'), asg('s3', 'snd', 'p1'), asg('s4', 'snd', 'z'), asg('s4', 'door', 'x'), asg('s4', 'door', 'y', 'declined'),
  asg('s5', 'door', 'p1'), asg('s1', 'snd', 'p1')];
const data = { services, assignments, positions, runsAt: (p, s) => !(p.times && p.times.indexOf(s.slot) < 0), timeOf: s => s.time };
let rows = A.services(data, f('10am services in November that do not have all positions filled').q);
ok(rows.map(x => x.service.id).join() === 's6,s4' && rows[1].missing === 1 && rows[1].gaps[0].position.name === 'Door', '10am services in November with gaps: 1 Nov (nobody yet) and 22 Nov (a door place, after a decline) – not 15 Nov');
rows = A.services(data, f('services where Andy Pike is serving in both a morning and an evening service on the same day').q);
ok(rows.map(x => x.service.id).join() === 's1,s2,s3' && rows[1].mine[0].name === 'Sound desk', 'Andy Pike: morning and evening on 15 Nov → those services, with what he does');
rows = A.services(data, f('services where Andy Pike is serving').q);
ok(rows.map(x => x.service.id).join() === 's1,s2,s3,s5', 'every service where Andy Pike is serving, from today (not 1 Nov)');
rows = A.services(data, f('8am services without a door').q);
ok(rows.map(x => x.service.id).join() === 's1' && rows[0].gaps.some(g => g.position.id === 'crech'), 'positions only at some services (Creche at 8am) count only there');
rows = A.services(data, f('services fully staffed').q);
ok(rows.map(x => x.service.id).join() === 's2', 'fully staffed services');

if (fails) { console.log('\n' + fails + ' ask test(s) FAILED'); process.exit(1); }
console.log('\nAll ask tests passed');
