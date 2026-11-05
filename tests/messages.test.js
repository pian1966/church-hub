/* Tests for js/messages.js (messages inside the app). Run: node tests/messages.test.js */
'use strict';
const M = require('../js/messages.js');
let fails = 0;
function ok(c, what) { if (!c) { fails++; console.log('  ✗ ' + what); } else console.log('  ✓ ' + what); }

const people = [
  { id: 'a', firstName: 'Ann', lastName: 'Lee', category: 'Staff', staff: { category: 'Pastoral Staff' }, familyRole: 'adult', email: 'ann@example.com', appRole: 'pastor' },
  { id: 'b', firstName: 'Ben', lastName: 'Ngcobo', category: 'Church Partner', staff: { category: 'Support Staff' }, familyRole: 'adult', email: 'ben@example.com', appRole: 'member' },
  { id: 'c', firstName: 'Cara', lastName: 'Smit', category: 'Church Partner', familyRole: 'adult', email: 'cara@example.com', appRole: 'none' },
  { id: 'd', firstName: 'Dan', preferredName: 'Danny', lastName: 'Pike', category: 'Church Partner', familyRole: 'adult', email: '', appRole: 'member' },
  { id: 'e', firstName: 'Eve', lastName: 'Pike', category: 'Church Partner', familyRole: 'child' },
  { id: 'f', firstName: 'Frank', lastName: 'Old', category: 'Deceased', familyRole: 'adult', active: false },
  { id: 'g', firstName: 'Gail', lastName: 'Left', category: 'Church Partner', familyRole: 'adult', active: false, staff: {} },
  { id: 'h', firstName: 'Hope', lastName: 'Visitor', category: 'Attender', familyRole: 'adult' }
];
const careGroups = [{ id: 'cg1', name: 'Hilton', leaderIds: ['c'], memberIds: ['c', 'd'] }];
const msgGroups = [{ id: 'mg1', name: 'Worship leaders', leaderIds: ['b'], memberIds: ['b', 'h'] }, { id: 'mg2', name: 'Alpha team', leaderIds: [], memberIds: ['a'] }];
const d = { people, careGroups, msgGroups };

console.log('Who a message goes to');
ok(M.recipients('staff', '', d).join() === 'a,b', 'staff: everyone with staff details who is still active (a Church Partner on the staff too)');
ok(M.recipients('partners', '', d).join() === 'b,c,d', 'Church Partners: active adults only – not children, people who left or died, or Attenders');
ok(M.recipients('care', 'cg1', d).join() === 'c,d', 'a care group: its carers and members');
ok(M.recipients('group', 'mg1', d).join() === 'b,h', 'a message group: its leaders and members');
ok(M.recipients('group', 'nope', d).length === 0 && M.recipients('odd', '', d).length === 0, 'nobody for a group that doesn’t exist');

console.log('Who may send to whom');
const pastor = { id: 'a', manager: true }, carer = { id: 'c', manager: false }, leader = { id: 'b', manager: false }, member = { id: 'd', manager: false };
ok(M.audiences(pastor, d).map(x => x.kind + ':' + (x.groupId || x.name)).join() === 'staff:Staff,partners:Church Partners,care:cg1,group:mg2,group:mg1', 'Administrators and Pastors: staff, Church Partners, every care group and message group (by name)');
ok(M.audiences(carer, d).map(x => x.groupId).join() === 'cg1', 'a carer: only their own care group');
ok(M.audiences(leader, d).map(x => x.groupId).join() === 'mg1', 'a group leader: only their own group');
ok(M.audiences(member, d).length === 0, 'a member: nobody');
ok(M.maySend(carer, 'care', 'cg1', d) && !M.maySend(carer, 'staff', '', d) && !M.maySend(member, 'care', 'cg1', d) && !M.maySend(leader, 'group', 'mg2', d) && M.maySend(pastor, 'partners', '', d) && !M.maySend(pastor, 'everyone', '', d), 'maySend agrees');

console.log('Writing a message');
const m = M.make({ kind: 'care', groupId: 'cg1', name: 'Hilton' }, '  Tuesday  ', '  Bring a plate, please. ', people[2], d);
ok(m.kind === 'care' && m.audience === 'Hilton' && m.title === 'Tuesday' && m.body === 'Bring a plate, please.' && m.fromId === 'c' && m.fromName === 'Cara Smit' && m.to.join() === 'c,d' && m.readBy.join() === 'c', 'a message: who to, from whom, already read by the sender');
ok(M.make({ kind: 'care', groupId: 'cg1' }, 'x', '  ', people[2], d).error === 'empty', 'an empty message is refused');
ok(M.make({ kind: 'care', groupId: 'cg1' }, '', 'x'.repeat(M.MAX_BODY + 1), people[2], d).error === 'long', 'a very long one is refused');
ok(M.make({ kind: 'group', groupId: 'none' }, '', 'Hi', people[0], d).error === 'nobody', 'and one to nobody');
ok(M.make({ kind: 'staff', name: 'Staff' }, 'x'.repeat(300), 'Hi', people[3], d).title.length === M.MAX_TITLE && M.make({ kind: 'staff' }, '', 'Hi', people[3], d).fromName === 'Danny Pike', 'a long title is shortened; the sender’s known-as name is used');

console.log('Reading');
const msgs = [
  Object.assign({ id: 'm1', createdAt: '2026-11-01 08:00' }, m),
  { id: 'm2', createdAt: '2026-11-03 09:00', fromId: 'a', to: ['a', 'b', 'd'], readBy: ['a', 'b'] },
  { id: 'm3', createdAt: '2026-11-02 09:00', fromId: 'a', to: ['b'], readBy: ['a'] }
];
ok(M.inbox(msgs, 'd').map(x => x.id).join() === 'm2,m1' && M.inbox(msgs, 'h').length === 0, 'the inbox: messages sent to me, newest first');
ok(M.unread(msgs, 'd').map(x => x.id).join() === 'm1,m2' && M.unread(msgs, 'b').map(x => x.id).join() === 'm3' && M.unread(msgs, 'c').length === 0, 'unread: not opened yet, and never my own');
ok(M.sent(msgs, 'a').map(x => x.id).join() === 'm2,m3' && M.sent(msgs, 'x', true).length === 3, 'sent: mine, or everyone’s for Administrators and Pastors');
ok(JSON.stringify(M.seen(msgs[1])) === '{"of":2,"n":1}', 'seen by 1 of 2 (the sender doesn’t count)');
ok(M.inApp(['a', 'b', 'c', 'd', 'x'], people).join() === 'a,b', 'who can open it in the app: signs in, with an email address');
ok(M.mayDelete(msgs[0], carer) && !M.mayDelete(msgs[0], member) && M.mayDelete(msgs[1], pastor), 'the sender, Administrators and Pastors may delete a message');

console.log('Message groups');
let g = M.placeIn(msgGroups[1], 'c', true);
ok(g.memberIds.join() === 'a,c' && g.leaderIds.join() === 'c' && msgGroups[1].memberIds.length === 1, 'adding a leader (the original is untouched)');
ok(M.placeIn(g, 'c', true) === null && M.placeIn(g, 'c', false).leaderIds.length === 0, 'nothing changes when nothing changes; a leader can stop leading');
ok(M.takeOut(g, 'c').memberIds.join() === 'a' && M.takeOut(g, 'c').leaderIds.length === 0 && M.takeOut(g, 'z') === null, 'taking someone out');

if (fails) { console.log('\n' + fails + ' test(s) FAILED'); process.exit(1); }
console.log('\nAll message tests passed');
