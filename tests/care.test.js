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

if (fails) { console.log('\n' + fails + ' care group test(s) FAILED'); process.exit(1); }
console.log('\nAll care group tests passed');
