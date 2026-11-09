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
const life = Object.assign(JSON.parse(JSON.stringify(groups[0])), { type: 'life' }), lifeRenamed = Object.assign(JSON.parse(JSON.stringify(life)), { name: 'Tuesday Bible study' });
ok(C.leaderMayChange(life, lifeRenamed, 'a') && !C.leaderMayChange(life, lifeRenamed, 'b'), 'a life group\u2019s leader may name the group; a member may not');
ok(!C.leaderMayChange(life, Object.assign({}, lifeRenamed, { name: ' ' }), 'a') && !C.leaderMayChange(life, Object.assign({}, lifeRenamed, { type: 'care' }), 'a'), 'not to a blank name, and not into a care group');
ok(!C.leaderMayChange(groups[0], Object.assign({}, groups[0], { type: 'life', name: 'Mine' }), 'a'), 'a carer can\u2019t turn a care group into a life group to rename it');
ok(C.inSeveral(groups).length === 0 && C.inSeveral(groups.concat([{ id: 'g3', memberIds: ['b'] }])).join() === 'b', 'finds anyone in two or more groups');

console.log('Suggesting groups by where people live');
const P = (id, first, addr, extra) => Object.assign({ id, firstName: first, lastName: 'X', category: 'Church Partner', address: addr }, extra || {});
const A = (street, street2, city, postcode) => ({ street, street2, city, postcode });
const folk = [
  P('g1', 'Gus', A('4 Amber Glen', '', 'Howick', '3290')),                   // in Amber Glen Tuesday
  P('v1', 'Val', A('9 Main Rd', 'Amber Valley', 'Howick', '3290')),          // in Amber Valley
  P('w1', 'Wes', A('3 Oak Rd', '', 'Howick West', '3290')),                  // in Howick West
  P('h1', 'Hil', A('1 Elm Rd', '', 'Hilton', '3245')),                       // in Hilton
  P('n1', 'Ann', A('12 Amber Glen', '', 'Howick', '3290')),                  // estate in the street line
  P('n2', 'Ben', A('Unit 7', 'amber valley', 'HOWICK', '3290')),             // estate in the second line, any capitals
  P('n3', 'Cat', A('8 Pine Rd', '', 'Howick West', '3290')),                 // a part of Howick as the town
  P('n4', 'Dan', A('5 Main Rd', '', 'Howick', '3290')),                      // just "Howick": which part?
  P('n5', 'Eve', A('2 Rose Rd', '', 'Hilton', '3245')),                      // only one group in Hilton
  P('n6', 'Fay', A('6 Hill Rd', '', 'Merrivale', '3291')),                   // Merrivale is typed as an area of the Thursday ladies
  P('s1', 'Sue', A('1 Long Rd', '', 'Pietermaritzburg', '3201')), P('s2', 'Sam', undefined),
  P('f1', 'Fin', undefined, { familyId: 'F' }), P('f2', 'Flo', A('4 Amber Glen', '', 'Howick', '3290'), { familyId: 'F' }),   // Flo is in Amber Glen
  P('k1', 'Kid', A('4 Amber Glen', '', 'Howick', '3290'), { familyRole: 'child' }), P('a1', 'Att', A('4 Amber Glen', '', 'Howick', '3290'), { category: 'Attender' }),
  P('x1', 'Gone', A('4 Amber Glen', '', 'Howick', '3290'), { active: false }),
];
const cg = [
  { id: 'AG', name: 'Amber Glen Tuesday morning', memberIds: ['g1', 'f2'] },
  { id: 'AV', name: 'Amber Valley', memberIds: ['v1'] },
  { id: 'HW', name: 'Howick West (Wednesday)', memberIds: ['w1'] },
  { id: 'HC', name: 'Howick Thursday evening', memberIds: [] },
  { id: 'HI', name: 'Hilton', memberIds: ['h1'] },
  { id: 'TL', name: 'Thursday ladies', areas: ['Merrivale', '3291'], memberIds: [] },
];
const sg = C.suggest(cg, folk), c = id => sg.clear.find(x => x.id === id), u = id => sg.unclear.find(x => x.id === id);
ok(c('n1') && c('n1').groupId === 'AG' && c('n1').why === 'area' && c('n1').place === 'Amber Glen', 'Amber Glen in the street → the Amber Glen group, not the Howick one');
ok(c('n2') && c('n2').groupId === 'AV', 'Amber Valley in the second address line (any capitals) → the Amber Valley group');
ok(c('n3') && c('n3').groupId === 'HW', '“Howick West” as the town → Howick West, not the plain Howick group');
ok(u('n4') && u('n4').why === 'whichPart' && u('n4').groupIds[0] === 'HC' && u('n4').groupIds.includes('AG') && u('n4').place === 'Howick', 'just “Howick” while several groups meet in Howick: not clear – which part?');
ok(c('n5') && c('n5').groupId === 'HI', 'a town with one group: that group');
ok(c('n6') && c('n6').groupId === 'TL', 'the areas typed on a group');
ok(c('f1') && c('f1').groupId === 'AG' && c('f1').why === 'household' && c('f1').with === 'f2', 'someone without an address goes with the person they live with');
ok(u('s1').why === 'noGroup' && u('s1').place === 'Pietermaritzburg 3201' && u('s2').why === 'noAddress', 'no group near them, or no address: not clear');
ok(!c('k1') && !u('k1') && !c('a1') && !u('a1') && !c('x1') && !u('x1') && !c('g1') && !u('g1'), 'children, Attenders, people who left and people already in a group are left alone');
const parts = C.suggest([{ id: 'W', name: 'Howick West', memberIds: [] }, { id: 'E', name: 'Howick Central', memberIds: [] }], [P('z', 'Zoe', A('1 Main Rd', '', 'Howick', '3290'))]);
ok(parts.unclear[0].why === 'whichPart' && parts.unclear[0].groupIds.join() === 'W,E', 'only parts of town have groups (Howick West, Howick Central) and the address says just Howick: which part?');
const est = C.suggest([{ id: 'A', name: 'Tuesday', memberIds: ['m1', 'm2'] }, { id: 'B', name: 'Friday', memberIds: ['m3', 'm4', 'm5'] }],
  [P('m1', 'M', A('3 Amber Glen', '', 'Howick', '')), P('m2', 'N', A('9 Amber Glen', '', 'Howick', '')), P('m3', 'O', A('1 Oak Rd', '', 'Howick', '')), P('m4', 'Q', A('2 Oak Rd', '', 'Howick', '')), P('m5', 'R', A('3 Oak Rd', '', 'Howick', '')),
   P('y', 'Yan', A('20 Amber Glen', '', 'Howick', ''))]);
ok(est.clear[0] && est.clear[0].groupId === 'A' && est.clear[0].why === 'neighbours' && est.clear[0].place === 'Amber Glen', 'groups not named after places: the group with neighbours in the same street or estate, over more people elsewhere in town');
const two = C.suggest([{ id: 'A', name: 'Amber Glen 1', memberIds: [] }, { id: 'B', name: 'Amber Glen 2', memberIds: [] }], [P('y', 'Yan', A('20 Amber Glen', '', 'Howick', ''))]);
ok(two.unclear[0].why === 'several' && two.unclear[0].groupIds.join() === 'A,B', 'two groups named after the same estate: not clear, both offered');
const fam = C.suggest([{ id: 'A', name: 'A', memberIds: ['h1'] }, { id: 'Z', name: 'Z', memberIds: ['h2'] }], [P('h1', 'H', A('', '', 'Hilton', ''), { familyId: 'G' }), P('h2', 'I', A('', '', 'Hilton', ''), { familyId: 'G' }), P('h3', 'J', A('', '', 'Hilton', ''), { familyId: 'G' })]);
ok(fam.unclear[0].id === 'h3' && fam.unclear[0].why === 'households', 'the people they live with are in different groups: not clear');
ok(C.areasOf({ areas: ' Hilton , 3245,, Howick North ' }).towns.join() === 'hilton,howick north' && C.areasOf({ areas: ['3 2 4 5'] }).codes.join() === '3245', 'areas typed with commas: towns and postal codes');
const withAreas = JSON.parse(JSON.stringify(groups[0])); withAreas.areas = ['Hilton'];
ok(!C.leaderMayChange(groups[0], withAreas, 'a'), 'a carer can’t change the group’s areas');


// Addresses as people really type them
const real = C.suggest([{ id: 'AG', name: 'Amber Glen Tuesday', memberIds: [] }, { id: 'GD', name: 'Greendale', memberIds: [] }, { id: 'HO', name: 'Howick Central', memberIds: ['h1'] }],
  [P('s1', 'Selwyn', A('12 Huntley Lane', 'Amberglen', 'Howick', '3290')), P('l1', 'Lizette', A('1 A Link Road, Greendale', '', '', '')),
   P('o1', 'Olga', A('3 Oak Rd, Merrivale', '', '', '')), P('h1', 'Hal', A('5 Oak Rd', '', 'Merrivale', ''))]);
const rc = id => real.clear.filter(x => x.id === id)[0];
ok(rc('s1') && rc('s1').groupId === 'AG' && rc('s1').why === 'area', '“Amberglen” written as one word → the Amber Glen group');
ok(rc('l1') && rc('l1').groupId === 'GD', 'an address all on one line (“1 A Link Road, Greendale”) still finds Greendale');
ok(rc('o1') && rc('o1').groupId === 'HO' && rc('o1').why === 'neighbours', '…and with no town box, the part after the comma counts as the town (a neighbour on Oak Rd, Merrivale)');
const oneWord = C.suggest([{ id: 'AG', name: 'Amberglen', memberIds: [] }], [P('z', 'Zed', A('4 Amber Glen', '', 'Howick', '3290'))]);
ok(oneWord.clear[0] && oneWord.clear[0].groupId === 'AG', 'and the other way round: a group called “Amberglen” finds “Amber Glen”');
ok(C.suggest([{ id: 'AG', name: 'Amber Glen', memberIds: [] }], [P('z', 'Zed', A('4 Amberfield', '', 'Howick', '3290'))]).clear.length === 0, 'Amberfield is not Amber Glen');

const sj = C.suggest([{ id: 'SJ', name: 'Saint Johns Thursday', memberIds: [] }, { id: 'HC', name: 'Howick Central', memberIds: [] }],
  [P('b1', 'Bob', A('18 Meadow Ridge', 'St John’s Village', 'Howick', '')), P('b2', 'Bea', A('2 Meadow Ridge', 'St. John\'s', 'Howick', ''))]);
ok(sj.clear.length === 2 && sj.clear.every(x => x.groupId === 'SJ'), 'St John’s Village = St. John\'s = Saint Johns (apostrophes and “Saint” don’t matter)');

// The church's own groups: St Johns, and the Amber estates written with or without a space, in any capitals
const AMB = ['Amber Glen', 'Amber Field', 'Amber Valley', 'Amber Lakes', 'Amber Ridge', 'Amber Lee'];
const ambG = AMB.map((n, i) => ({ id: 'G' + i, name: n, memberIds: [] })).concat([{ id: 'SJ', name: 'St Johns', memberIds: [] }]);
const ambP = ['AMBERGLEN', 'Amberfield', 'amber valley', 'Amberlakes', 'AmberRidge', 'amberlee'].map((e, i) => P('q' + i, 'Q' + i, A((i + 1) + ' Some Rd', e, 'Howick', '3290')))
  .concat([P('bob', 'Bob', A('18 Meadow Ridge', 'St John\'s Village', 'Howick', ''))]);
const amb = C.suggest(ambG, ambP);
ok(AMB.every((n, i) => { const x = amb.clear.filter(c => c.id === 'q' + i)[0]; return x && x.groupId === 'G' + i; }), 'Amberglen, Amberfield, amber valley, Amberlakes, AmberRidge, amberlee → each its own Amber group');
ok((amb.clear.filter(c => c.id === 'bob')[0] || {}).groupId === 'SJ', 'St John’s Village → the St Johns group');

if (fails) { console.log('\n' + fails + ' care group test(s) FAILED'); process.exit(1); }
console.log('\nAll care group tests passed');
