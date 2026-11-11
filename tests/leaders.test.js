/* Tests for js/leaders.js (leadership groups: Council, elders, leaders). Run: node tests/leaders.test.js */
'use strict';
const L = require('../js/leaders.js');
let fails = 0;
function ok(c, what) { if (!c) { fails++; console.log('  ✗ ' + what); } else console.log('  ✓ ' + what); }

const ann = { id: 'a', firstName: 'Ann', lastName: 'Lee' }, ben = { id: 'b', firstName: 'Benjamin', preferredName: 'Ben', lastName: 'Ngcobo' }, cara = { id: 'c', firstName: 'Cara', lastName: 'Smit' };
let council = { id: 'g1', name: 'Church Council', open: true, memberIds: [], names: {}, seats: {} };
const before = JSON.stringify(council);
let x = L.place(council, ben, { role: 'Treasurer', title: 'Churchwarden', portfolios: 'Finance, Buildings ,  finance; Youth', from: '2025-03-01' });
ok(JSON.stringify(council) === before && x.memberIds.join() === 'b' && x.names.b === 'Ben Ngcobo', 'adding someone (the original is untouched; known as “Ben”)');
ok(x.seats.b.role === 'Treasurer' && x.seats.b.title === 'Churchwarden' && x.seats.b.portfolios.join('|') === 'Finance|Buildings|Youth' && x.seats.b.from === '2025-03-01', 'their role, title and portfolios (no portfolio twice)');
x = L.place(x, ann, { role: 'chair' }); x = L.place(x, cara, { role: '', portfolios: ['Missions'] });
ok(L.members(x).map(m => m.personId).join() === 'a,b,c', 'office-bearers first (Chair, then Treasurer), then everyone else by name');
x = L.place(x, cara, { role: 'Secretary', to: '2026-01-31' });
ok(x.memberIds.length === 3 && L.members(x).map(m => m.personId).join() === 'a,c,b' && x.seats.c.portfolios.length === 0, 'changing someone’s role replaces what was there');
ok(L.ended(x, '2026-02-01').map(m => m.personId).join() === 'c' && !L.ended(x, '2026-01-31').length, 'whose time has run out');
let y = L.end(x, 'c', '2026-02-01');
ok(y.memberIds.join() === 'b,a' && !y.seats.c && !y.names.c && y.past.length === 1 && y.past[0].name === 'Cara Smit' && y.past[0].role === 'Secretary' && y.past[0].to === '2026-02-01', 'when their time ends they move to “served before”, with their role and dates');
ok(L.end(x, 'c', '', false).past === undefined && L.end(x, 'zz', '2026-01-01').memberIds.length === 3, 'added by mistake: taken off without a trace; someone not on it changes nothing');
y = L.end(y, 'b', '2025-12-31');
ok(L.past(y).map(p => p.name).join() === 'Cara Smit,Ben Ngcobo' && L.forget(y, 0).past.map(p => p.personId).join() === 'b', 'served before: the most recent first; a line can be taken off');
const elders = L.place({ id: 'g2', name: 'Elders', open: false, memberIds: [] }, ann, { title: 'Elder' });
ok(L.of([x, elders], 'a').map(o => o.body.name + ':' + (o.role || o.title)).join() === 'Church Council:chair,Elders:Elder' && L.of([x, elders], 'zz').length === 0, 'the groups someone serves on');
ok(L.sees(x, 'zz', false) && !L.sees(elders, 'b', false) && L.sees(elders, 'a', false) && L.sees(elders, 'b', true), 'an open group is seen by everyone; a closed one by its members, Administrators and Pastors');
ok(L.portfolios('a,b,c,d,e,f,g,h,i,j').length === 8 && L.seat({ role: '  Vice   chair ' }).role === 'Vice chair' && L.seat().portfolios.length === 0, 'tidy text, at most 8 portfolios');

// more than one role; co-opted
let m = L.place({ id: 'g3', name: 'Council', memberIds: [] }, ann, { roles: 'Treasurer, Chair, treasurer', kind: 'coopted' });
ok(m.seats.a.roles.join() === 'Treasurer,Chair' && m.seats.a.role === 'Treasurer' && m.seats.a.kind === 'coopted', 'more than one role (no repeats); co-opted');
m = L.place(m, ben, { role: 'Secretary' });
ok(L.members(m).map(x => x.personId).join() === 'a,b', 'listed by their highest role (a Treasurer who is also Chair comes first)');
ok(L.seat({ kind: 'boss' }).kind === '' && L.seat({ role: 'Chair' }).roles.join() === 'Chair', 'an unknown kind is a plain member; a single role still works');
// terms of office
let c = { id: 'g4', name: 'Council', termYears: 3, maxTerms: 2, breakYears: 1, memberIds: [] };
c = L.place(c, ann, { from: '2024-01-15' }); c = L.place(c, ben, { from: '2022-01-15', term: 2, termFrom: '2025-01-15' }); c = L.place(c, cara, { from: '2026-01-01' });
let t = L.term(c, c.seats.a, '2026-07-15');
ok(t.n === 1 && t.max === 2 && t.end === '2027-01-15' && t.pct === 83 && !t.soon && t.again, 'a 3-year term: where they are in it, and they may stand again');
ok(L.term(c, c.seats.a, '2026-09-15').soon && !L.term(c, c.seats.a, '2026-09-14').soon, 'four months before the end, the term is ending soon');
t = L.term(c, c.seats.b, '2027-10-01');
ok(t.n === 2 && t.end === '2028-01-15' && t.soon && !t.again && t.rest === '2029-01-15', 'in their last term: may not stand again until their break is over');
ok(L.term({ memberIds: [] }, { from: '2025-01-01' }, '2026-01-01') === null && L.term({}, { from: '2025-01-01', to: '2025-12-31' }, '2026-01-01').over, 'no term length and no end date: no term; past its end: over');
ok(L.ending([c], '2026-10-01').map(x => x.m.personId).join() === 'a' && L.ending([c], '2027-10-01').map(x => x.m.personId).join() === 'a,b', 'whose terms end within four months (or have ended), the soonest first');
let r = L.renew(c, 'a', '2026-10-01');
ok(r.seats.a.term === 2 && r.seats.a.termFrom === '2027-01-15' && r.seats.a.to === '2030-01-15' && r.seats.a.from === '2024-01-15' && L.renew(c, 'b', '2027-10-01') === null, 'a second term starts when the first ends; no third term');
let e = L.end(c, 'b', '2028-01-15');
ok(e.past[0].term === 2 && L.resting(e, 'b', '2028-06-01') === '2029-01-15' && L.resting(e, 'b', '2029-02-01') === '' && L.resting(e, 'a', '2028-06-01') === '', 'someone who served every term allowed rests before they may be added again');
ok(L.terms({ termYears: '3', maxTerms: -1 }).termYears === 3 && L.terms({}).maxTerms === 0 && L.addMonths('2024-01-31', 1) === '2024-02-29', 'tidy term rules; months at the end of a month');

if (fails) { console.log('\n' + fails + ' leadership test(s) FAILED'); process.exit(1); }
console.log('\nAll leadership tests passed');
