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

if (fails) { console.log('\n' + fails + ' leadership test(s) FAILED'); process.exit(1); }
console.log('\nAll leadership tests passed');
