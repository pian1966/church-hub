/* Tests for js/care.js (care groups). Run: node tests/care.test.js */
'use strict';
const C = require('../js/care.js');
let fails = 0;
function ok(c, what) { if (!c) { fails++; console.log('  ✗ ' + what); } else console.log('  ✓ ' + what); }

const groups = [{ id: 'g1', name: 'Hilton', leaderIds: ['a'], memberIds: ['a', 'b'], names: { a: 'Ann Lee', b: 'Ben Ngcobo' } },
  { id: 'g2', name: 'Howick', leaderIds: ['c'], memberIds: ['c'], names: { c: 'Cara Smit' } }];
const dan = { id: 'd', firstName: 'Daniel', preferredName: 'Dan', lastName: 'Pike' };
ok(C.groupOf(groups, 'b').id === 'g1' && C.groupOf(groups, 'x') === null && C.isLeader(groups[0], 'a') && !C.isLeader(groups[0], 'b'), 'which group someone is in, and who the carers are');
let ch = C.place(groups, dan, 'g2', false);
ok(ch.length === 1 && ch[0].id === 'g2' && ch[0].memberIds.join() === 'c,d' && ch[0].names.d === 'Dan Pike' && groups[1].memberIds.length === 1, 'adding someone to a group (the original is untouched)');
ch = C.place(groups, { id: 'b', firstName: 'Ben', lastName: 'Ngcobo' }, 'g2', true);
ok(ch.length === 1 && ch[0].id === 'g2' && ch[0].leaderIds.join() === 'c,b' && ch[0].memberIds.join() === 'c,b', 'joining a second group keeps the first (here as a carer of the second)');
ok(C.groupsOf(groups.map(g => ch.find(x => x.id === g.id) || g), 'b').map(g => g.name).join() === 'Hilton,Howick', 'all the groups someone is in');
ch = C.takeOut(groups, 'b', 'g1');
ok(ch.length === 1 && ch[0].memberIds.join() === 'a' && !ch[0].names.b, 'taken out of one group only');
ch = C.setGroups(groups, { id: 'b', firstName: 'Ben', lastName: 'Ngcobo' }, { g2: false });
ok(ch.length === 2 && ch.find(g => g.id === 'g1').memberIds.join() === 'a' && ch.find(g => g.id === 'g2').memberIds.join() === 'c,b' && !ch.find(g => g.id === 'g2').leaderIds.includes('b'), 'setting someone’s groups: in the ones ticked, out of the rest');
ok(C.setGroups(groups, { id: 'b', firstName: 'Ben', lastName: 'Ngcobo' }, { g1: false }).length === 0, '…and nothing changes when nothing changes');
ch = C.place(groups, { id: 'a', firstName: 'Ann', lastName: 'Lee' }, 'g1', false);
ok(ch.length === 1 && ch[0].leaderIds.length === 0 && ch[0].memberIds.includes('a'), 'no longer a carer, still a member');
ok(C.place(groups, { id: 'a', firstName: 'Ann', lastName: 'Lee' }, '', false).find(g => g.id === 'g1').memberIds.join() === 'b', 'taken out of every group');
ok(C.place(groups, { id: 'b', firstName: 'Ben', lastName: 'Ngcobo' }, 'g1', false).length === 0, 'nothing changes when nothing changes');

const p = { id: 'b', firstName: 'Ben', lastName: 'Ngcobo', mobile: '082 000 1111', email: 'ben@example.com', birthDate: '1980-07-14', address: { street: '1 Main Rd', city: 'Howick' }, medical: 'x', category: 'Church Partner' };
const full = C.card(p, true, false, 'data:image/jpeg;base64,AA'), bare = C.card(p, false, true);
ok(full.mobile && full.email && full.address.city === 'Howick' && full.birthday === '07-14' && full.photo && full.ok, 'with consent: photo, mobile, email, address and birthday (no year)');
ok(Object.keys(full).every(k => C.FIELDS.includes(k)) && !('medical' in full) && !('category' in full), 'nothing else from their record');
ok(!bare.ok && bare.leader && !bare.mobile && !bare.email && !bare.address && !bare.birthday && !bare.photo && bare.firstName === 'Ben', 'without consent: only their name');

const after = JSON.parse(JSON.stringify(groups[0])); after.memberIds.push('d'); after.names.d = 'Dan Pike';
ok(C.leaderMayChange(groups[0], after, 'a') && !C.leaderMayChange(groups[0], after, 'b'), 'a carer may add members; a member may not');
const renamed = JSON.parse(JSON.stringify(after)); renamed.name = 'Mine';
const promoted = JSON.parse(JSON.stringify(after)); promoted.leaderIds.push('d');
const left = JSON.parse(JSON.stringify(after)); left.memberIds = ['b', 'd'];
ok(!C.leaderMayChange(groups[0], renamed, 'a') && !C.leaderMayChange(groups[0], promoted, 'a') && !C.leaderMayChange(groups[0], left, 'a'), 'a carer can’t rename the group, make carers, or take themself out');
ok(C.inSeveral(groups).length === 0 && C.inSeveral(groups.concat([{ id: 'g3', memberIds: ['b'] }])).join() === 'b', 'finds anyone in two or more groups');

console.log('Suggesting groups by where people live');
const P = (id, first, city, code, extra) => Object.assign({ id, firstName: first, lastName: 'X', category: 'Church Partner', address: city || code ? { city, postcode: code } : undefined }, extra || {});
const folk = [
  P('h1', 'Hil', 'Hilton', '3245'), P('h2', 'Hal', 'Hilton', '3245'),                      // in the Hilton group
  P('w1', 'How', 'Howick', '3290'),                                                          // in Howick Tuesday
  P('m1', 'Mer', 'Merrivale', '3291'),                                                       // in Merrivale (areas typed: Merrivale, 3291)
  P('n1', 'Nia', 'Hilton', ''), P('n2', 'Ned', 'howick ', '3290'), P('n3', 'Ora', '', '3291'),
  P('s1', 'Sue', 'Pietermaritzburg', '3201'), P('s2', 'Sam', '', ''),
  P('f1', 'Fay', '', '', { familyId: 'F' }), P('f2', 'Fin', 'Howick', '3290', { familyId: 'F' }),   // Fin is in Hilton; Fay lives with him
  P('k1', 'Kid', 'Hilton', '3245', { familyRole: 'child' }), P('a1', 'Att', 'Hilton', '3245', { category: 'Attender' }),
  P('x1', 'Gone', 'Hilton', '3245', { active: false }), P('t1', 'Tie', 'Balgowan', '3275'), P('t2', 'Tia', 'Hilton', '3245'),
];
const cg = [
  { id: 'H', name: 'Hilton', memberIds: ['h1', 'h2', 'f2', 't2'] },
  { id: 'W', name: 'Howick Tuesday evening', memberIds: ['w1'] },
  { id: 'M', name: 'Thursday ladies', areas: ['Merrivale', '3291'], memberIds: ['m1'] },
  { id: 'B1', name: 'Balgowan A', memberIds: [] }, { id: 'B2', name: 'Balgowan B', memberIds: [] },
];
const sg = C.suggest(cg, folk), c = id => sg.clear.find(x => x.id === id), u = id => sg.unclear.find(x => x.id === id);
ok(c('n1').groupId === 'H' && c('n1').why === 'area', 'a town in the group’s name: Hilton → the Hilton group');
ok(c('n2').groupId === 'W' && c('n2').place === 'howick 3290', '…whatever the capitals and spaces');
ok(c('n3').groupId === 'M' && c('n3').why === 'area', 'the areas typed on a group (here a postal code)');
ok(c('f1').groupId === 'H' && c('f1').why === 'household' && c('f1').with === 'f2', 'someone without an address goes with the person they live with');
ok(u('s1').why === 'noGroup' && u('s1').place === 'Pietermaritzburg 3201', 'no group near them: not clear');
ok(u('s2').why === 'noAddress', 'no address at all: not clear');
ok(u('t1').why === 'several' && u('t1').groupIds.join() === 'B1,B2', 'two groups for the same area: not clear, with both offered');
ok(!c('k1') && !u('k1') && !c('a1') && !u('a1') && !c('x1') && !u('x1') && !c('h1') && !u('h1'), 'children, Attenders, people who left and people already in a group are left alone');
const nb = C.suggest([{ id: 'A', name: 'Tuesday', memberIds: ['h1', 'h2'] }, { id: 'Z', name: 'Friday', memberIds: ['t2'] }, { id: 'Q', name: 'Sunday', memberIds: ['w1'] }], folk);
ok(nb.clear.find(x => x.id === 'n1').groupId === 'A' && nb.clear.find(x => x.id === 'n1').why === 'neighbours', 'without areas: the group where most of their neighbours are (2 to 1)');
ok(nb.unclear.find(x => x.id === 'n1') === undefined && nb.clear.find(x => x.id === 'n2').groupId === 'Q', '…and a single group with neighbours');
const two = C.suggest([{ id: 'A', name: 'Tuesday', memberIds: ['h1'] }, { id: 'Z', name: 'Friday', memberIds: ['t2'] }], folk);
ok(two.unclear.find(x => x.id === 'n1').why === 'several', 'neighbours split evenly between two groups: not clear');
const fam = C.suggest([{ id: 'A', name: 'A', memberIds: ['h1'] }, { id: 'Z', name: 'Z', memberIds: ['h2'] }], [P('h1', 'H', 'Hilton', '', { familyId: 'G' }), P('h2', 'I', 'Hilton', '', { familyId: 'G' }), P('h3', 'J', 'Hilton', '', { familyId: 'G' })]);
ok(fam.unclear[0].id === 'h3' && fam.unclear[0].why === 'households', 'the people they live with are in different groups: not clear');
ok(C.areasOf({ areas: ' Hilton , 3245,, Howick North ' }).towns.join() === 'hilton,howick north' && C.areasOf({ areas: ['3 2 4 5'] }).codes.join() === '3245', 'areas typed with commas: towns and postal codes');
const withAreas = JSON.parse(JSON.stringify(groups[0])); withAreas.areas = ['Hilton'];
ok(!C.leaderMayChange(groups[0], withAreas, 'a'), 'a carer can’t change the group’s areas');

if (fails) { console.log('\n' + fails + ' care group test(s) FAILED'); process.exit(1); }
console.log('\nAll care group tests passed');
