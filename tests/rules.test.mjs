/*
 * Church Hub – tests for firestore.rules, run against Google's Firestore emulator (made-up people only).
 * They run automatically on GitHub after every push (.github/workflows/tests.yml).
 *
 * To run on a computer with Java 21 and Node 22:
 *   npm i --no-save firebase-tools@15 @firebase/rules-unit-testing@6 firebase@13
 *   npx firebase emulators:exec --only firestore --project demo-church-hub "node tests/rules.test.mjs"
 */
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

const env = await initializeTestEnvironment({
  projectId: 'demo-church-hub',
  firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') }
});

const USERS = {
  admin: ['linda@example.com', 'p01'], pastor: ['thandi@example.com', 'p02'], kids: ['grace@example.com', 'p04'],
  rosters: ['sipho@example.com', 'p05'], member: ['tim@example.com', 'p14']
};
const MED = 'Children’s medical notes';

await env.withSecurityRulesDisabled(async ctx => {
  const db = ctx.firestore(), set = (p, d) => db.doc(p).set(d);
  for (const [role, [email, pid]] of Object.entries(USERS)) await set('roles/' + email, { role, personId: pid });
  await set('settings/church', { churchName: 'Test church' });
  await set('leave/config', { types: [], autoApprove: ['UL'] });
  for (const pid of ['p01', 'p02', 'p04', 'p05', 'p14', 'p15']) await set('people/' + pid, { firstName: 'A', lastName: pid, familyRole: 'adult', email: pid + '@example.com', mobile: '082', familyId: 'f2' });
  await set('people/p12', { firstName: 'Child', lastName: 'One', familyRole: 'child', familyId: 'f1' });
  await set('details/p12', { birthDate: '2019-01-01', familyRole: 'child' });
  await set('details/p15', { birthDate: '1980-01-01', familyRole: 'adult' });
  await set('details/p14', { birthDate: '1981-01-01', familyRole: 'adult' });
  await set('medical/p12', { allergies: 'Nuts' });
  await set('notes/p15', { entries: [{ id: 'n1', text: 'Private', by: 'Thandi', at: '2026-01-01' }] });
  await set('directory/p15', { firstName: 'Clare', lastName: 'Jacobs', preferredName: '', mobile: '082' });
  await set('families/f2', { name: 'Jacobs family' });
  await set('consents/c1', { personId: 'p15', purpose: 'Email', given: true });
  await set('consents/c2', { personId: 'p12', purpose: MED, given: true });
  await set('consents/c3', { personId: 'p14', purpose: 'Church directory', given: true });
  await set('teams/t1', { name: 'Welcome' });
  await set('assignments/a14', { personId: 'p14', serviceId: 's1', positionId: 'door', status: 'pending' });
  await set('assignments/a15', { personId: 'p15', serviceId: 's1', positionId: 'door', status: 'pending' });
  await set('skills/k15', { personId: 'p15', positionId: 'door' });
  await set('groups/g1', { memberIds: ['p14', 'p15'], kind: 'together' });
  await set('groups/g2', { memberIds: ['p15', 'p01'], kind: 'apart' });
  await set('blockouts/b15', { personId: 'p15', from: '2026-01-01', to: '2026-01-01' });
  await set('serveOffers/o15', { personId: 'p15', positionId: 'door', kind: 'join', frequency: 'monthly', note: '', status: 'waiting' });
  await set('leaveRequests/L1', { staffId: 'p05', type: 'SSL', status: 'Approved', start: '2027-01-06', end: '2027-01-06', reason: 'Wedding' });
  await set('leaveRequests/L2', { staffId: 'p02', type: 'SL', status: 'Approved', start: '2027-01-06', end: '2027-01-06', reason: 'Flu' });
  await set('away/L2', { personId: 'p02', from: '2027-01-06', to: '2027-01-06' });
  await set('dsr/d1', { personId: 'p15', kind: 'Access' });
  await set('audit/a1', { action: 'Test', byEmail: 'linda@example.com' });
  await set('guardians/g1', { childId: 'p12', adultId: 'p14', relationship: 'Father', canConsent: true, primary: true, mayCollect: true, confirmed: true });
  await set('guardians/g2', { childId: 'p12', adultId: 'p15', relationship: 'Mother', canConsent: true, primary: true, mayCollect: true, confirmed: true });
  await set('noCollect/n1', { childId: 'p12', personId: '', name: 'Made-up Person', note: 'Court order' });
  await set('roles/robot@example.com', { role: 'robot', uid: 'robot-uid', name: 'Elvanto robot' });
  await set('elvantoSync/L1', { personId: 'p05', name: 'A p05', start: '2027-01-06', end: '2027-01-06', want: 'Unavailable', have: '', haveNote: '', status: 'Waiting', note: '' });
  await set('elvantoSync/L9', { personId: 'p15', name: 'A p15', start: '2027-02-01', end: '2027-02-02', want: 'Unavailable', have: '', haveNote: '', status: 'Done', note: '' });
});

const as = role => { const [email, pid] = USERS[role]; return env.authenticatedContext('uid-' + role, { email, email_verified: true }).firestore(); };
const db = { admin: as('admin'), pastor: as('pastor'), kids: as('kids'), rosters: as('rosters'), member: as('member') };
const stranger = env.authenticatedContext('uid-x', { email: 'stranger@example.com', email_verified: true }).firestore();
const unverified = env.authenticatedContext('uid-u', { email: 'tim@example.com', email_verified: false }).firestore();
const nobody = env.unauthenticatedContext().firestore();
// The robot signs in with a password, so its email isn't verified; its access entry names its account ID
const robotDb = env.authenticatedContext('robot-uid', { email: 'robot@example.com', email_verified: false }).firestore();
const impostor = env.authenticatedContext('someone-else', { email: 'robot@example.com', email_verified: false }).firestore();
const ts = () => firebase.firestore.FieldValue.serverTimestamp();

let passed = 0, failed = 0;
async function t(name, fn) {
  try { await fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n      ' + (e && e.message ? e.message.split('\n')[0] : e)); }
}
const can = p => assertSucceeds(p), cannot = p => assertFails(p);
const read = (d, path) => d.doc(path).get();
const list = (q) => q.get();
const roles = ['admin', 'pastor', 'kids', 'rosters', 'member'];
async function only(path, allowed) {
  for (const r of roles) await (allowed.includes(r) ? can : cannot)(read(db[r], path));
}

console.log('Who may sign in');
await t('people without access, unverified emails and signed-out visitors see nothing', async () => {
  for (const d of [stranger, unverified, nobody]) { await cannot(read(d, 'settings/church')); await cannot(read(d, 'people/p15')); await cannot(read(d, 'directory/p15')); }
});
await t('everyone can read their own access entry, not other people’s', async () => {
  await can(read(stranger, 'roles/stranger@example.com')); await can(read(db.member, 'roles/tim@example.com'));
  await cannot(read(db.member, 'roles/linda@example.com')); await can(read(db.admin, 'roles/tim@example.com'));
});
await t('only Administrators give access, and only known roles', async () => {
  await cannot(db.member.doc('roles/tim@example.com').set({ role: 'admin', personId: 'p14' }));
  await cannot(db.pastor.doc('roles/new@example.com').set({ role: 'pastor', personId: 'p99' }));
  await can(db.admin.doc('roles/new@example.com').set({ role: 'member', personId: 'p99' }));
  await cannot(db.admin.doc('roles/new@example.com').set({ role: 'superuser', personId: 'p99' }));
  await can(db.admin.doc('roles/new@example.com').delete());
});

console.log('Restricted notes (POPIA special personal information)');
await t('children’s medical notes: Children’s ministry only (not even Administrators)', () => only('medical/p12', ['kids']));
await t('pastoral notes: Pastors only (not even Administrators)', () => only('notes/p15', ['pastor']));
await t('only Children’s ministry writes medical notes; Administrators can delete them', async () => {
  await can(db.kids.doc('medical/p12').set({ allergies: 'Nuts, bees' }));
  for (const r of ['admin', 'pastor', 'rosters', 'member']) await cannot(db[r].doc('medical/p12').set({ allergies: 'x' }));
  await can(db.admin.doc('medical/p99').delete());
});
await t('only Pastors write pastoral notes; Administrators can delete them', async () => {
  await can(db.pastor.doc('notes/p14').set({ entries: [{ id: 'n2', text: 'x' }] }));
  for (const r of ['admin', 'kids', 'rosters', 'member']) await cannot(db[r].doc('notes/p14').set({ entries: [] }));
  await can(db.admin.doc('notes/p14').delete());
});

console.log('People');
await t('names and contact details: staff roles, and each member their own', async () => {
  await only('people/p15', ['admin', 'pastor', 'kids', 'rosters']); await can(read(db.member, 'people/p14'));
});
await t('a member can’t list everyone', () => cannot(list(db.member.collection('people'))));
await t('birthdays and staff details: Admin and Pastor; Children’s ministry only for children; members their own', async () => {
  await only('details/p15', ['admin', 'pastor']);
  await can(read(db.kids, 'details/p12')); await can(list(db.kids.collection('details').where('familyRole', '==', 'child')));
  await cannot(list(db.kids.collection('details')));
  await can(read(db.member, 'details/p14')); await cannot(read(db.rosters, 'details/p12'));
});
await t('members may correct their own name and contact details only', async () => {
  await can(db.member.doc('people/p14').update({ mobile: '083 111 2222' }));
  await cannot(db.member.doc('people/p14').update({ category: 'Staff' }));
  await cannot(db.member.doc('people/p15').update({ mobile: '1' }));
  await cannot(db.member.doc('details/p14').update({ birthDate: '2000-01-01' }));
});
await t('Roster coordinators and Children’s ministry can’t change people', async () => {
  await cannot(db.rosters.doc('people/p15').update({ mobile: '1' })); await cannot(db.kids.doc('people/p12').update({ lastName: 'x' }));
  await can(db.pastor.doc('people/p15').update({ mobile: '084' }));
});
console.log('Church office notes and ID numbers');
await t('church office notes: Administrators and Pastors only', async () => {
  await env.withSecurityRulesDisabled(async ctx => { const d = ctx.firestore(); await d.doc('officeNotes/p15').set({ entries: [{ id: 'o1', text: 'From Elvanto', by: 'Elvanto', at: '2026-01-01' }] }); await d.doc('idNumbers/p15').set({ value: '8001015009087', updatedAt: 'x' }); await d.doc('idNumbers/p14').set({ value: '8101015009086', updatedAt: 'x' }); });
  await only('officeNotes/p15', ['admin', 'pastor']);
  await can(db.pastor.doc('officeNotes/p15').set({ entries: [] })); await cannot(db.kids.doc('officeNotes/p15').set({ entries: [] }));
});
await t('ID numbers: Administrators only; a person may see their own but not change it', async () => {
  await only('idNumbers/p15', ['admin']);
  await can(read(db.member, 'idNumbers/p14'));
  await cannot(db.member.doc('idNumbers/p14').set({ value: '1', updatedAt: 'y' }));
  await cannot(db.pastor.doc('idNumbers/p15').set({ value: '1', updatedAt: 'y' }));
  await can(db.admin.doc('idNumbers/p15').set({ value: '8001015009087', updatedAt: 'y' }));
  await cannot(db.admin.doc('idNumbers/p15').set({ value: '8001015009087', updatedAt: 'y', note: 'x' }));
  await cannot(list(db.pastor.collection('idNumbers')));
});

console.log('Photos');
await t('adults’ photos: staff and the person; members only when the adult is in the directory', async () => {
  await env.withSecurityRulesDisabled(async ctx => { const d = ctx.firestore(); await d.doc('photos/p15').set({ data: 'data:image/jpeg;base64,AAA', updatedAt: 'x' }); await d.doc('photos/p01').set({ data: 'data:image/jpeg;base64,AAA', updatedAt: 'x' }); await d.doc('photos/p12').set({ data: 'data:image/jpeg;base64,AAA', updatedAt: 'x' }); });
  await only('photos/p15', ['admin', 'pastor', 'kids', 'rosters', 'member']);   // p15 is in the directory
  await only('photos/p01', ['admin', 'pastor', 'kids', 'rosters']);             // p01 isn't
  await cannot(read(stranger, 'photos/p15')); await cannot(read(nobody, 'photos/p15'));
});
await t('children’s photos: Administrators, Pastors and Children’s ministry only', () => only('photos/p12', ['admin', 'pastor', 'kids']));
await t('who may add photos: Administrators and Pastors; Children’s ministry for children; adults their own', async () => {
  const pic = { data: 'data:image/jpeg;base64,BBB', updatedAt: 'y' };
  await can(db.member.doc('photos/p14').set(pic)); await cannot(db.member.doc('photos/p15').set(pic));
  await can(db.kids.doc('photos/p12').set(pic)); await cannot(db.kids.doc('photos/p15').set(pic));
  await can(db.pastor.doc('photos/p15').set(pic)); await cannot(db.rosters.doc('photos/p15').set(pic));
  await cannot(db.admin.doc('photos/p15').set({ data: 'x'.repeat(200001), updatedAt: 'y' }));
  await cannot(db.admin.doc('photos/p15').set({ data: 'x', updatedAt: 'y', note: 'extra' }));
  await can(db.member.doc('people/p14').update({ photo: 'y' }));
  await can(db.kids.doc('people/p12').update({ photo: 'y' })); await cannot(db.kids.doc('people/p12').update({ lastName: 'X' }));
  await cannot(db.kids.doc('people/p15').update({ photo: 'y' }));
  await can(db.member.doc('photos/p14').delete()); await cannot(db.member.doc('photos/p15').delete());
});
await t('directory: everyone signed in can read; it holds only name and phone', async () => {
  for (const r of roles) await can(list(db[r].collection('directory')));
  await can(db.member.doc('directory/p14').set({ firstName: 'Tim', lastName: 'Jacobs', preferredName: '', mobile: '082' }));
  await cannot(db.member.doc('directory/p14').set({ firstName: 'Tim', lastName: 'Jacobs', email: 'tim@example.com' }));
  await cannot(db.member.doc('directory/p15').set({ firstName: 'X', lastName: 'Y' }));
});
await t('families: staff roles only', () => only('families/f2', ['admin', 'pastor', 'kids', 'rosters']));

console.log('Consent');
await t('consent records: Admin and Pastor; Children’s ministry only medical/photo consent; members their own', async () => {
  await only('consents/c1', ['admin', 'pastor']);
  await can(read(db.kids, 'consents/c2')); await can(list(db.kids.collection('consents').where('purpose', '==', MED)));
  await cannot(list(db.kids.collection('consents')));
  await can(list(db.member.collection('consents').where('personId', '==', 'p14'))); await cannot(list(db.member.collection('consents')));
});
await t('members record their own choices in the app, and can only withdraw', async () => {
  await can(db.member.doc('consents/c9').set({ personId: 'p14', purpose: 'SMS', given: false, method: 'Changed in the app' }));
  await cannot(db.member.doc('consents/c10').set({ personId: 'p15', purpose: 'SMS', given: false, method: 'Changed in the app' }));
  await cannot(db.member.doc('consents/c11').set({ personId: 'p14', purpose: 'SMS', given: true, method: 'Paper connect card' }));
  await can(db.member.doc('consents/c3').update({ withdrawnAt: '2026-10-24' }));
  await cannot(db.member.doc('consents/c3').update({ given: false }));
});

console.log('Rosters');
await t('teams and services: everyone reads; only Admin and Roster coordinators change', async () => {
  for (const r of roles) await can(read(db[r], 'teams/t1'));
  await can(db.rosters.doc('teams/t2').set({ name: 'Prayer' })); await cannot(db.member.doc('teams/t3').set({ name: 'x' })); await cannot(db.pastor.doc('teams/t3').set({ name: 'x' }));
});
await t('members see only their own turns, and may only accept or decline them', async () => {
  await can(list(db.member.collection('assignments').where('personId', '==', 'p14'))); await cannot(list(db.member.collection('assignments')));
  await cannot(read(db.member, 'assignments/a15'));
  await can(db.member.doc('assignments/a14').update({ status: 'accepted' }));
  await cannot(db.member.doc('assignments/a14').update({ positionId: 'keys' }));
  await cannot(db.member.doc('assignments/a14').update({ status: 'pending' }));
  await cannot(db.member.doc('assignments/a15').update({ status: 'declined' }));
  await can(db.rosters.doc('assignments/a16').set({ personId: 'p15', status: 'pending' }));
});
await t('serving groups: members see and change only groups they are in', async () => {
  await can(list(db.member.collection('groups').where('memberIds', 'array-contains', 'p14')));
  await cannot(read(db.member, 'groups/g2'));
  await can(db.member.doc('groups/g3').set({ memberIds: ['p14', 'p15'], kind: 'together' }));
  await cannot(db.member.doc('groups/g4').set({ memberIds: ['p15', 'p01'], kind: 'apart' }));
  await cannot(db.member.doc('groups/g1').update({ memberIds: ['p15', 'p01'] }));
});
await t('away dates: members add their own only', async () => {
  await can(db.member.doc('blockouts/b14').set({ personId: 'p14', from: '2027-02-01', to: '2027-02-01' }));
  await cannot(db.member.doc('blockouts/b16').set({ personId: 'p15', from: '2027-02-01', to: '2027-02-01' }));
  await cannot(read(db.member, 'blockouts/b15'));
});
await t('offers to serve: members ask for themselves; only roster coordinators and Administrators answer', async () => {
  const offer = { personId: 'p14', positionId: 'tea', kind: 'join', frequency: 'monthly', note: 'After the service', status: 'waiting', createdAt: 'x', updatedAt: 'x' };
  await can(db.member.doc('serveOffers/o14').set(offer));
  await can(db.member.doc('serveOffers/o21').set(Object.assign({}, offer, { times: ['08:00', '17:00'] })));   // at which services
  await can(list(db.member.collection('serveOffers').where('personId', '==', 'p14')));
  await cannot(list(db.member.collection('serveOffers')));
  await cannot(read(db.member, 'serveOffers/o15'));
  await cannot(db.member.doc('serveOffers/o16').set(Object.assign({}, offer, { personId: 'p15' })));          // not for someone else
  await cannot(db.member.doc('serveOffers/o17').set(Object.assign({}, offer, { status: 'declined' })));       // can't answer their own
  await cannot(db.member.doc('serveOffers/o18').set(Object.assign({}, offer, { kind: 'boss' })));
  await cannot(db.member.doc('serveOffers/o19').set(Object.assign({}, offer, { reply: 'yes' })));            // only the listed fields
  await cannot(db.member.doc('serveOffers/o14').update({ status: 'declined' }));
  await can(db.pastor.doc('serveOffers/o20').set(Object.assign({}, offer, { personId: 'p02' })));            // staff offer for themselves too
  await cannot(list(db.pastor.collection('serveOffers')));
  await can(list(db.rosters.collection('serveOffers')));
  await can(db.rosters.doc('serveOffers/o15').update({ status: 'declined', reply: 'Team is full' }));
  await can(read(db.member, 'serveOffers/o14')); await can(db.member.doc('serveOffers/o14').delete());       // withdraw
  await cannot(db.member.doc('serveOffers/o15').delete());
  await cannot(db.member.doc('skills/k14').set({ personId: 'p14', positionId: 'tea' }));                     // the team itself stays the coordinator's
});

console.log('Leave');
await t('leave requests: Administrators see all; staff only their own (sick leave stays private)', async () => {
  await can(read(db.admin, 'leaveRequests/L2')); await cannot(read(db.rosters, 'leaveRequests/L2')); await can(read(db.rosters, 'leaveRequests/L1'));
  await cannot(list(db.rosters.collection('leaveRequests'))); await can(list(db.rosters.collection('leaveRequests').where('staffId', '==', 'p05')));
});
await t('everyone sees approved dates away, without the type or reason', async () => {
  for (const r of roles) await can(read(db[r], 'away/L2'));
  await cannot(db.member.doc('away/X').set({ personId: 'p14', from: '2027-01-01', to: '2027-01-01', type: 'SL' }));
});
await t('staff request leave for themselves as waiting; only Administrators approve', async () => {
  await can(db.rosters.doc('leaveRequests/L3').set({ staffId: 'p05', type: 'SSL', status: 'Pending', start: '2027-03-03', end: '2027-03-03' }));
  await cannot(db.rosters.doc('leaveRequests/L4').set({ staffId: 'p05', type: 'SSL', status: 'Approved', start: '2027-03-03', end: '2027-03-03' }));
  await can(db.rosters.doc('leaveRequests/L5').set({ staffId: 'p05', type: 'UL', status: 'Approved', start: '2027-03-03', end: '2027-03-03' }));
  await cannot(db.rosters.doc('leaveRequests/L6').set({ staffId: 'p02', type: 'SSL', status: 'Pending', start: '2027-03-03', end: '2027-03-03' }));
  await cannot(db.rosters.doc('leaveRequests/L3').update({ status: 'Approved' }));
  await can(db.rosters.doc('leaveRequests/L3').update({ status: 'Cancelled', cancelledBy: 'Sipho' }));
  await can(db.admin.doc('leaveRequests/L1').update({ status: 'Approved', decidedBy: 'Linda' }));
  await cannot(db.member.doc('leave/config').set({ types: [] }));
});

console.log('Parents, guardians and collection');
await t('responsible adults: Admin, Pastor and Children’s ministry; an adult sees only the links naming them', async () => {
  for (const r of ['admin', 'pastor', 'kids']) await can(list(db[r].collection('guardians')));
  await cannot(list(db.rosters.collection('guardians'))); await cannot(list(db.member.collection('guardians')));
  await can(list(db.member.collection('guardians').where('adultId', '==', 'p14'))); await cannot(read(db.member, 'guardians/g2'));
  await can(db.kids.doc('guardians/g3').set({ childId: 'p12', adultId: 'p01', relationship: 'Grandparent', canConsent: false, primary: false, mayCollect: true, confirmed: true }));
  await cannot(db.member.doc('guardians/g4').set({ childId: 'p12', adultId: 'p14', relationship: 'Father', canConsent: true }));
  await cannot(db.rosters.doc('guardians/g1').update({ mayCollect: false }));
});
await t('not allowed to collect: Admin, Pastor and Children’s ministry only – never the parents themselves', async () => {
  await only('noCollect/n1', ['admin', 'pastor', 'kids']);
  await can(db.kids.doc('noCollect/n2').set({ childId: 'p12', personId: 'p05', name: '', note: 'x' }));
  await cannot(db.member.doc('noCollect/n3').set({ childId: 'p12', name: 'x' })); await cannot(list(robotDb.collection('noCollect')));
});

console.log('Elvanto robot');
await t('the robot reads the Elvanto list and church settings, and nothing else', async () => {
  await can(list(robotDb.collection('elvantoSync'))); await can(read(robotDb, 'settings/church'));
  for (const p of ['people/p15', 'details/p15', 'directory/p15', 'leaveRequests/L1', 'notes/p15', 'medical/p12', 'roles/linda@example.com', 'away/L2']) await cannot(read(robotDb, p));
});
await t('the robot reports results but can’t change who or when', async () => {
  await can(robotDb.doc('elvantoSync/L1').update({ status: 'Done', note: 'Added.', have: '2027-01-06 to 2027-01-06', doneAt: '2026-10-26T10:00:00Z' }));
  await cannot(robotDb.doc('elvantoSync/L1').update({ start: '2020-01-01' }));
  await cannot(robotDb.doc('elvantoSync/L1').update({ personId: 'p01' }));
  await cannot(robotDb.doc('elvantoSync/L2').set({ personId: 'p01', status: 'Waiting' }));
  await can(robotDb.doc('robotStatus/elvanto').set({ lastRun: '2026-10-26T10:00:00Z', done: 1 }));
});
await t('what the robot reads in Elvanto: it writes names and dates only; only Administrators read or delete it', async () => {
  await can(robotDb.doc('elvantoFound/unavailable').set({ readAt: 'x', entries: [{ name: 'A B', from: '2026-11-03', to: '2026-11-05', fromLeave: false }], rows: 1, unread: 0, pages: 1 }));
  await cannot(robotDb.doc('elvantoFound/unavailable').set({ readAt: 'x', entries: [], reason: 'Hospital' }));
  await cannot(read(robotDb, 'elvantoFound/unavailable'));
  for (const r of ['pastor', 'kids', 'rosters', 'member']) await cannot(read(db[r], 'elvantoFound/unavailable'));
  await can(read(db.admin, 'elvantoFound/unavailable'));
  await cannot(db.admin.doc('elvantoFound/unavailable').set({ readAt: 'y', entries: [] }));
  await can(db.admin.doc('elvantoFound/unavailable').delete());
});
await t('another account using the robot’s email gets nothing', async () => {
  await cannot(list(impostor.collection('elvantoSync'))); await cannot(read(impostor, 'settings/church'));
});
await t('only Administrators give the robot its sign-in', async () => {
  await cannot(db.pastor.doc('roles/robot2@example.com').set({ role: 'robot', uid: 'x' }));
  await can(db.admin.doc('roles/robot2@example.com').set({ role: 'robot', uid: 'x' }));
});
await t('Elvanto list: Administrators see all; staff see and queue only their own', async () => {
  await can(list(db.admin.collection('elvantoSync'))); await cannot(list(db.rosters.collection('elvantoSync')));
  await can(list(db.rosters.collection('elvantoSync').where('personId', '==', 'p05')));
  await can(db.rosters.doc('elvantoSync/L1').update({ want: 'Removed', status: 'Waiting', note: 'Cancelled' }));
  await cannot(db.rosters.doc('elvantoSync/L1').update({ have: '' }));
  await cannot(db.rosters.doc('elvantoSync/L9').update({ want: 'Removed', status: 'Waiting' }));
  await can(db.rosters.doc('elvantoSync/L7').set({ personId: 'p05', name: 'A p05', start: '2027-03-01', end: '2027-03-01', want: 'Unavailable', have: '', haveNote: '', status: 'Waiting', note: '' }));
  await cannot(db.rosters.doc('elvantoSync/L8').set({ personId: 'p05', status: 'Done' }));
  await cannot(read(db.member, 'robotStatus/elvanto')); await can(read(db.admin, 'robotStatus/elvanto'));
});

console.log('POPIA registers and settings');
await t('requests and breaches: Administrators only', async () => { await only('dsr/d1', ['admin']); await cannot(db.pastor.doc('breaches/b1').set({ what: 'x' })); });
await t('settings: everyone reads, Administrators change', async () => {
  for (const r of roles) await can(read(db[r], 'settings/church'));
  await cannot(db.pastor.doc('settings/church').set({ churchName: 'x' })); await can(db.admin.doc('settings/church').set({ churchName: 'Test church' }));
});
await t('audit log: anyone adds entries about themselves; only Administrators read; nobody changes', async () => {
  await can(db.member.doc('audit/m1').set({ action: 'Signed in', byEmail: 'tim@example.com', ts: ts() }));
  await cannot(db.member.doc('audit/m2').set({ action: 'Signed in', byEmail: 'linda@example.com', ts: ts() }));
  await cannot(db.member.doc('audit/m3').set({ action: 'Signed in', byEmail: 'tim@example.com', ts: new Date(2020, 0, 1) }));
  await only('audit/a1', ['admin']);
  await cannot(db.admin.doc('audit/a1').update({ action: 'changed' })); await cannot(db.admin.doc('audit/a1').delete());
});
await t('anything not listed is closed', async () => { await cannot(db.admin.doc('secrets/x').set({ a: 1 })); await cannot(read(db.admin, 'secrets/x')); });

await env.cleanup();
console.log(failed ? `\n${failed} rule test(s) FAILED, ${passed} passed` : `\nAll ${passed} rule tests passed`);
process.exit(failed ? 1 : 0);
