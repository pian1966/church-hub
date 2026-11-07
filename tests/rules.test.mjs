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
  await set('detailChanges/d15', { personId: 'p15', maritalStatus: 'Married', anniversary: '', spouse: '', children: '', note: '', status: 'waiting' });
  await set('serveOffers/o15', { personId: 'p15', positionId: 'door', kind: 'join', frequency: 'monthly', note: '', status: 'waiting' });
  await set('leaveRequests/L1', { staffId: 'p05', type: 'SSL', status: 'Approved', start: '2027-01-06', end: '2027-01-06', reason: 'Wedding' });
  await set('leaveRequests/L2', { staffId: 'p02', type: 'SL', status: 'Approved', start: '2027-01-06', end: '2027-01-06', reason: 'Flu' });
  await set('away/L2', { personId: 'p02', from: '2027-01-06', to: '2027-01-06' });
  await set('dsr/d1', { personId: 'p15', kind: 'Access' });
  await set('emailPrompts/p15_birthday_2026-11-05', { date: '2026-11-05', done: 'sent' });
  await set('audit/a1', { action: 'Test', byEmail: 'linda@example.com' });
  await set('guardians/g1', { childId: 'p12', adultId: 'p14', relationship: 'Father', canConsent: true, primary: true, mayCollect: true, confirmed: true });
  await set('guardians/g2', { childId: 'p12', adultId: 'p15', relationship: 'Mother', canConsent: true, primary: true, mayCollect: true, confirmed: true });
  await set('noCollect/n1', { childId: 'p12', personId: '', name: 'Made-up Person', note: 'Court order' });
  await set('roles/robot@example.com', { role: 'robot', uid: 'robot-uid', name: 'Elvanto robot' });
  await set('elvantoSync/L1', { personId: 'p05', name: 'A p05', start: '2027-01-06', end: '2027-01-06', want: 'Unavailable', have: '', haveNote: '', status: 'Waiting', note: '' });
  await set('careGroups/cg1', { name: 'Hilton', leaderIds: ['p14'], memberIds: ['p14', 'p15'], names: { p14: 'Tim', p15: 'Clare' } });
  await set('careGroups/cg2', { name: 'Howick', leaderIds: ['p05'], memberIds: ['p05', 'p01'], names: {} });
  await set('careGroups/cg3', { name: 'Merrivale', leaderIds: ['p15'], memberIds: ['p15', 'p14'], names: {} });
  await set('careGroups/cg1/share/p15', { firstName: 'Clare', lastName: 'Jacobs', ok: true, mobile: '082', birthday: '07-14' });
  await set('careGroups/cg2/share/p05', { firstName: 'Sipho', lastName: 'Dlamini', ok: false });
  // Messages: a message group Tim leads, one Clare leads; a message to Tim and Clare, and one to Thandi only
  await set('msgGroups/mg1', { name: 'Welcome team', leaderIds: ['p14'], memberIds: ['p14', 'p15'] });
  await set('msgGroups/mg2', { name: 'Alpha team', leaderIds: ['p15'], memberIds: ['p15', 'p02'] });
  await set('messages/ms1', { kind: 'group', groupId: 'mg1', audience: 'Welcome team', title: '', body: 'Hello', fromId: 'p01', fromName: 'Linda', to: ['p14', 'p15'], readBy: ['p01'] });
  await set('messages/ms2', { kind: 'staff', groupId: '', audience: 'Staff', title: '', body: 'Staff only', fromId: 'p01', fromName: 'Linda', to: ['p01', 'p02'], readBy: ['p01'] });
  // Translations: Nomvula (a member) checks isiZulu; a suggestion from Clare (p15) in isiZulu and one in Afrikaans
  await set('roles/nomvula@example.com', { role: 'member', personId: 'p20', langs: ['zu'] });
  await set('wordIdeas/w15', { lang: 'zu', en: 'Home', text: 'Ekhaya', personId: 'p15', name: 'Clare', status: 'waiting', createdAt: 'x' });
  await set('wordIdeas/w16', { lang: 'af', en: 'Home', text: 'Tuiste', personId: 'p15', name: 'Clare', status: 'waiting', createdAt: 'x' });
  await set('words/zu', { words: { Home: 'Ekhaya' }, updatedAt: 'x', by: 'Nomvula' });
  // What Pastors can do: Andile is a Pastor whose church ticked every ability; Thandi (the usual Pastor) has none
  await set('roles/andile@example.com', { role: 'pastor', personId: 'p03', can: ['settings', 'access', 'people', 'idnumbers', 'leave', 'rosters', 'privacy', 'import', 'words'] });
  await set('idNumbers/p15', { value: '8001015009087' });
  await set('people/p40', { firstName: 'Test', lastName: 'Person', familyRole: 'adult' });
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
  // Advanced search on ID number fetches them all at once: Administrators only
  await can(list(db.admin.collection('idNumbers')));
  for (const r of ['pastor', 'rosters', 'kids', 'member']) await cannot(list(db[r].collection('idNumbers')));
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
await t('directory: everyone signed in can read; it holds only the contact details Settings shares', async () => {
  for (const r of roles) await can(list(db[r].collection('directory')));
  await can(db.member.doc('directory/p14').set({ firstName: 'Tim', lastName: 'Jacobs', preferredName: '', mobile: '082', email: 'tim@example.com', shareAddress: '1 Oak St', shareSpouse: 'Clare Jacobs' }));
  await cannot(db.member.doc('directory/p14').set({ firstName: 'Tim', lastName: 'Jacobs', birthDate: '1980-01-01' }));
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
await t('family details: people ask for changes; only Administrators check and make them', async () => {
  const ask = { personId: 'p14', maritalStatus: 'Married', anniversary: '2010-04-17', spouse: 'Clare Jacobs', children: 'Sam, 3 May 2015', note: '', status: 'waiting', createdAt: 'x', updatedAt: 'x' };
  await can(db.member.doc('detailChanges/d14').set(ask));
  await can(list(db.member.collection('detailChanges').where('personId', '==', 'p14')));
  await cannot(list(db.member.collection('detailChanges')));
  await cannot(read(db.member, 'detailChanges/d15'));
  await cannot(db.member.doc('detailChanges/d16').set(Object.assign({}, ask, { personId: 'p15' })));      // not for someone else
  await cannot(db.member.doc('detailChanges/d17').set(Object.assign({}, ask, { status: 'checked' })));    // can't approve their own
  await cannot(db.member.doc('detailChanges/d18').set(Object.assign({}, ask, { reply: 'ok' })));          // only the listed fields
  await cannot(db.member.doc('detailChanges/d14').update({ status: 'checked' }));
  await cannot(db.member.doc('details/p14').update({ maritalStatus: 'Married' }));                         // the record itself stays the office's
  await cannot(list(db.pastor.collection('detailChanges')));
  await can(list(db.admin.collection('detailChanges')));
  await can(db.admin.doc('detailChanges/d15').update({ status: 'declined', reply: 'Please phone the office' }));
  await can(db.member.doc('detailChanges/d14').delete());                                                // withdraw
  await cannot(db.member.doc('detailChanges/d15').delete());
});
await t('contacts (address and spouse for staff and leaders): only staff read them', async () => {
  await can(db.member.doc('contacts/p14').set({ shareAddress: '1 Oak St', shareSpouse: 'Clare Jacobs' }));
  await cannot(db.member.doc('contacts/p14').set({ shareAddress: '1 Oak St', mobile: '082' }));
  await cannot(db.member.doc('contacts/p15').set({ shareAddress: '1 Oak St' }));
  await cannot(read(db.member, 'contacts/p14'));
  for (const r of ['admin', 'pastor', 'rosters', 'kids']) await can(read(db[r], 'contacts/p14'));
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
await t('email prompts (who has a birthday or a bereavement today): Administrators only', async () => { await only('emailPrompts/p15_birthday_2026-11-05', ['admin']); await cannot(db.pastor.doc('emailPrompts/x').set({ date: '2026-11-05' })); });
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
await t('care groups: members see their own group and its cards; carers add and remove members', async () => {
  await can(read(db.member, 'careGroups/cg1')); await cannot(read(db.member, 'careGroups/cg2'));
  await can(list(db.member.collection('careGroups').where('memberIds', 'array-contains', 'p14')));
  await cannot(list(db.member.collection('careGroups')));
  await can(read(db.member, 'careGroups/cg1/share/p15')); await can(list(db.member.collection('careGroups/cg1/share')));
  await cannot(read(db.member, 'careGroups/cg2/share/p05')); await cannot(list(db.member.collection('careGroups/cg2/share')));
  await cannot(read(db.rosters, 'careGroups/cg1')); await cannot(read(db.kids, 'careGroups/cg1/share/p15'));
  await can(read(db.pastor, 'careGroups/cg2/share/p05')); await can(list(db.admin.collection('careGroups')));
  // each person writes only their own card, only in a group they are in, and only the card's fields
  const card = { firstName: 'Tim', lastName: 'Jacobs', ok: true, mobile: '083', updatedAt: 'x', createdAt: 'x' };
  await can(db.member.doc('careGroups/cg1/share/p14').set(card));
  await cannot(db.member.doc('careGroups/cg2/share/p14').set(card));
  await cannot(db.member.doc('careGroups/cg1/share/p15').set(Object.assign({}, card, { firstName: 'Clare' })));
  await cannot(db.member.doc('careGroups/cg1/share/p14').set(Object.assign({}, card, { medical: 'x' })));
  await cannot(db.member.doc('careGroups/cg1/share/p14').set(Object.assign({}, card, { photo: 'x'.repeat(50000) })));
  // a carer (Tim leads cg1) may change who is in the group, not its name or carers; a member of cg3 may not
  await can(db.member.doc('careGroups/cg1').update({ memberIds: ['p14', 'p15', 'p16'], names: { p14: 'Tim', p15: 'Clare', p16: 'Sam' }, updatedAt: 'x' }));
  await cannot(db.member.doc('careGroups/cg1').update({ name: 'Mine' }));
  await cannot(db.member.doc('careGroups/cg1').update({ leaderIds: ['p14', 'p16'] }));
  await cannot(db.member.doc('careGroups/cg1').update({ memberIds: ['p15', 'p16'] }));   // a carer can't take themself out
  await cannot(db.member.doc('careGroups/cg3').update({ memberIds: ['p15', 'p14', 'p16'] }));
  await can(db.member.doc('careGroups/cg1/share/p15').delete());   // a carer removes a card when taking someone out
  await cannot(db.member.doc('careGroups/cg4').set({ name: 'New', leaderIds: ['p14'], memberIds: ['p14'] }));
  await can(db.pastor.doc('careGroups/cg4').set({ name: 'New', leaderIds: [], memberIds: [] })); await can(db.admin.doc('careGroups/cg4').delete());
  await can(db.pastor.doc('careGroups/cg2/share/p01').set({ firstName: 'Linda', lastName: 'Pillay', ok: false }));
});
console.log('Messages');
await t('messages: read by the people they went to, their sender, Administrators and Pastors', async () => {
  await can(read(db.member, 'messages/ms1')); await cannot(read(db.member, 'messages/ms2'));
  await can(list(db.member.collection('messages').where('to', 'array-contains', 'p14')));
  await can(list(db.member.collection('messages').where('fromId', '==', 'p14')));
  await cannot(list(db.member.collection('messages')));
  await can(read(db.pastor, 'messages/ms1')); await can(list(db.admin.collection('messages')));
  await cannot(read(db.rosters, 'messages/ms1')); await cannot(read(stranger, 'messages/ms1'));
});
await t('messages: who may send to whom', async () => {
  const m = (o) => Object.assign({ groupId: '', audience: 'x', title: '', body: 'Hi', fromName: 'x', readBy: [], createdAt: 'x', updatedAt: 'x' }, o);
  await can(db.admin.doc('messages/n1').set(m({ kind: 'staff', fromId: 'p01', to: ['p02', 'p05'], readBy: ['p01'] })));
  await can(db.pastor.doc('messages/n2').set(m({ kind: 'partners', fromId: 'p02', to: ['p14', 'p15'] })));
  await cannot(db.pastor.doc('messages/n3').set(m({ kind: 'partners', fromId: 'p01', to: ['p14'] })));          // not in someone else's name
  await cannot(db.rosters.doc('messages/n4').set(m({ kind: 'staff', fromId: 'p05', to: ['p01'] })));            // staff and Church Partners: Administrators and Pastors only
  await can(db.member.doc('messages/n5').set(m({ kind: 'care', groupId: 'cg1', fromId: 'p14', to: ['p14', 'p15'], readBy: ['p14'] })));   // Tim leads cg1
  await cannot(db.member.doc('messages/n6').set(m({ kind: 'care', groupId: 'cg1', fromId: 'p14', to: ['p14', 'p02'] })));    // someone not in the group
  await cannot(db.member.doc('messages/n7').set(m({ kind: 'care', groupId: 'cg3', fromId: 'p14', to: ['p15'] })));          // a group he doesn't lead
  await can(db.member.doc('messages/n8').set(m({ kind: 'group', groupId: 'mg1', fromId: 'p14', to: ['p15'] })));
  await cannot(db.member.doc('messages/n9').set(m({ kind: 'group', groupId: 'mg2', fromId: 'p14', to: ['p15'] })));
  await cannot(db.member.doc('messages/n10').set(m({ kind: 'group', groupId: 'mg1', fromId: 'p14', to: ['p15'], readBy: ['p15'] })));   // can't mark others as having read it
  await cannot(db.member.doc('messages/n11').set(m({ kind: 'group', groupId: 'mg1', fromId: 'p14', to: ['p15'], extra: 1 })));
  await cannot(db.member.doc('messages/n12').set(m({ kind: 'group', groupId: 'mg1', fromId: 'p14', to: ['p15'], body: '' })));
  await cannot(db.admin.doc('messages/n13').set(m({ kind: 'staff', fromId: 'p01', to: ['p02'], body: 'x'.repeat(4001) })));
  await can(db.pastor.doc('messages/n14').set(m({ kind: 'people', fromId: 'p02', to: ['p15'], audience: 'Clare' })));          // one person, chosen
  await cannot(db.member.doc('messages/n15').set(m({ kind: 'people', fromId: 'p14', to: ['p15'] })));                         // members can't choose people
  await can(db.member.doc('messages/n16').set(m({ kind: 'care', groupId: 'cg1', fromId: 'p14', to: ['p15'], some: true })));   // a carer: some of the group
  await cannot(db.member.doc('messages/n17').set(m({ kind: 'care', groupId: 'cg1', fromId: 'p14', to: ['p15'], some: 'yes' })));
});
await t('messages: people mark what they opened as read, and change nothing else', async () => {
  await can(db.member.doc('messages/ms1').update({ readBy: firebase.firestore.FieldValue.arrayUnion('p14') }));
  await cannot(db.member.doc('messages/ms1').update({ readBy: firebase.firestore.FieldValue.arrayUnion('p15') }));
  await cannot(db.member.doc('messages/ms1').update({ readBy: ['p14'] }));   // taking the sender off
  await cannot(db.member.doc('messages/ms1').update({ body: 'Changed' }));
  await cannot(db.member.doc('messages/ms1').delete());
  await can(db.member.doc('messages/n8').delete());   // their own
  await can(db.pastor.doc('messages/ms1').delete());
});
await t('message groups: Administrators and Pastors set them up; members see their own', async () => {
  await can(read(db.member, 'msgGroups/mg1')); await cannot(read(db.member, 'msgGroups/mg2'));
  await can(list(db.member.collection('msgGroups').where('memberIds', 'array-contains', 'p14'))); await cannot(list(db.member.collection('msgGroups')));
  await cannot(db.member.doc('msgGroups/mg1').update({ memberIds: ['p14', 'p15', 'p20'] }));
  await can(db.pastor.doc('msgGroups/mg3').set({ name: 'New', leaderIds: [], memberIds: [] })); await can(db.admin.doc('msgGroups/mg3').delete());
});
console.log('Translations');
const checker = env.authenticatedContext('uid-nomvula', { email: 'nomvula@example.com', email_verified: true }).firestore();
await t('everyone signed in reads the approved wording; only checkers of that language and Administrators change it', async () => {
  for (const r of roles) await can(read(db[r], 'words/zu'));
  await cannot(read(stranger, 'words/zu'));
  const w = { words: { Home: 'Ekhaya lami' }, updatedAt: 'x', by: 'Nomvula' };
  await can(checker.doc('words/zu').set(w));
  await cannot(checker.doc('words/af').set(w));                                     // not her language
  await cannot(db.member.doc('words/zu').set(w)); await cannot(db.pastor.doc('words/zu').set(w));
  await can(db.admin.doc('words/af').set(w));
  await cannot(checker.doc('words/zu').set(Object.assign({}, w, { extra: 1 })));    // only the listed fields
  await cannot(checker.doc('words/zu').set({ words: 'not a list', updatedAt: 'x' }));
  await can(db.admin.doc('words/af').delete());
});
await t('anyone signed in suggests wording as themselves; checkers see and answer only their language', async () => {
  const idea = { lang: 'zu', en: 'Save', text: 'Gcina', note: 'shorter', personId: 'p14', name: 'Tim', status: 'waiting', createdAt: 'x' };
  await can(db.member.doc('wordIdeas/w14').set(idea));
  await cannot(db.member.doc('wordIdeas/w17').set(Object.assign({}, idea, { personId: 'p15' })));    // not for someone else
  await cannot(db.member.doc('wordIdeas/w18').set(Object.assign({}, idea, { status: 'used' })));     // can't approve their own
  await cannot(db.member.doc('wordIdeas/w19').set(Object.assign({}, idea, { reply: 'x' })));          // only the listed fields
  await cannot(db.member.doc('wordIdeas/w20').set(Object.assign({}, idea, { text: 'x'.repeat(3001) })));
  await cannot(stranger.doc('wordIdeas/w21').set(idea));
  await can(list(db.member.collection('wordIdeas').where('personId', '==', 'p14')));
  await cannot(list(db.member.collection('wordIdeas'))); await cannot(read(db.member, 'wordIdeas/w15'));
  await can(list(checker.collection('wordIdeas').where('lang', '==', 'zu'))); await can(read(checker, 'wordIdeas/w15'));
  await cannot(read(checker, 'wordIdeas/w16')); await cannot(list(checker.collection('wordIdeas').where('lang', '==', 'af')));
  await cannot(read(db.pastor, 'wordIdeas/w15')); await can(list(db.admin.collection('wordIdeas')));
  await can(checker.doc('wordIdeas/w15').update({ status: 'used', reviewedBy: 'Nomvula', reviewedAt: 'x' }));
  await cannot(checker.doc('wordIdeas/w16').update({ status: 'declined' }));
  await cannot(checker.doc('wordIdeas/w14').update({ status: 'used', text: 'Changed' }));             // can't change what was suggested
  await cannot(db.member.doc('wordIdeas/w14').update({ status: 'used' }));
  await can(db.admin.doc('wordIdeas/w16').update({ status: 'declined', reply: 'Thank you', reviewedBy: 'Linda', reviewedAt: 'x' }));
  await can(db.member.doc('wordIdeas/w14').delete());                                                // takes it back
  await cannot(db.member.doc('wordIdeas/w15').delete());
});

console.log('What Pastors can do');
const andile = env.authenticatedContext('uid-andile', { email: 'andile@example.com', email_verified: true }).firestore();
await t('a Pastor without ticks can’t do Administrator things', async () => {
  await cannot(db.pastor.doc('settings/church').update({ churchName: 'x' }));
  await cannot(read(db.pastor, 'idNumbers/p15')); await cannot(read(db.pastor, 'dsr/d1')); await cannot(read(db.pastor, 'audit/a1'));
  await cannot(db.pastor.doc('leaveRequests/L1').update({ status: 'Declined' })); await cannot(db.pastor.doc('teams/t9').set({ name: 'x' }));
  await cannot(db.pastor.doc('people/p40').delete()); await cannot(read(db.pastor, 'elvantoSync/L1'));
});
await t('a Pastor with every tick can do what an Administrator does', async () => {
  await can(andile.doc('settings/church').update({ churchName: 'Renamed' }));
  await can(read(andile, 'idNumbers/p15')); await can(andile.doc('idNumbers/p15').set({ value: '8001015009088' }));
  await can(read(andile, 'dsr/d1')); await can(read(andile, 'audit/a1')); await can(read(andile, 'emailPrompts/p15_birthday_2026-11-05'));
  await can(andile.doc('leaveRequests/L1').update({ status: 'Declined' })); await can(andile.doc('leave/config').update({ note: 'x' }));
  await can(andile.doc('teams/t9').set({ name: 'Sound' })); await can(read(andile, 'serveOffers/o15'));
  await can(read(andile, 'detailChanges/d15')); await can(read(andile, 'elvantoSync/L1')); await can(read(andile, 'wordIdeas/w16'));
  await can(andile.doc('people/p40').delete());
});
await t('…but can’t change what Pastors can do, or give Administrator or Pastor access', async () => {
  await cannot(andile.doc('settings/church').update({ pastorCan: ['settings'] }));
  await cannot(andile.doc('settings/church').update({ seniorCan: ['settings'] }));                  // nor what the Senior Pastor can do
  await cannot(andile.doc('settings/church').update({ seniorPastorId: 'p97' }));                     // nor who the Senior Pastor is
  await cannot(andile.doc('roles/andile@example.com').update({ role: 'admin' }));
  await cannot(andile.doc('roles/new2@example.com').set({ role: 'admin', personId: 'p98' }));
  await cannot(andile.doc('roles/new2@example.com').set({ role: 'pastor', personId: 'p98' }));
  await cannot(andile.doc('roles/new2@example.com').set({ role: 'member', personId: 'p98', can: ['settings'] }));
  await cannot(andile.doc('roles/linda@example.com').delete());
  await can(andile.doc('roles/new2@example.com').set({ role: 'rosters', personId: 'p98', name: 'New' }));
  await can(andile.doc('roles/new2@example.com').delete());
  await cannot(read(andile, 'medical/p12'));                                                        // medical notes stay with Children's ministry
});

console.log('Stand-in leave approver');
await env.withSecurityRulesDisabled(async ctx => {
  const d = ctx.firestore(), now = Date.now();
  await d.doc('roles/sipho@example.com').update({ standInFrom: now - 86400000, standInTo: now + 86400000 });
  await d.doc('leaveRequests/S1').set({ staffId: 'p02', type: 'AL', status: 'Pending', start: '2027-03-01', end: '2027-03-02' });
  await d.doc('leaveRequests/S2').set({ staffId: 'p05', type: 'AL', status: 'Pending', start: '2027-03-01', end: '2027-03-02' });
  await d.doc('leaveRequests/S3').set({ staffId: 'p02', type: 'AL', status: 'Pending', start: '2027-04-01', end: '2027-04-02' });
});
await t('stand-in: reads other people’s leave between their dates', async () => { await can(read(db.rosters, 'leaveRequests/S1')); });
await t('stand-in: approves someone else’s waiting leave', async () => { await can(db.rosters.doc('leaveRequests/S1').update({ status: 'Approved', decidedBy: 'Sipho', decidedOn: '2026-11-05' })); });
await t('stand-in: the approved leave counts as away for rosters', async () => { await can(db.rosters.doc('away/S1').set({ personId: 'p02', from: '2027-03-01', to: '2027-03-02' })); });
await t('stand-in: not their own leave', async () => { await cannot(db.rosters.doc('leaveRequests/S2').update({ status: 'Approved', decidedBy: 'Sipho', decidedOn: '2026-11-05' })); });
await t('stand-in: only the decision, nothing else', async () => { await cannot(db.rosters.doc('leaveRequests/S3').update({ status: 'Approved', type: 'SL', decidedBy: 'Sipho', decidedOn: 'x' })); });
await t('stand-in: not the leave settings', async () => { await cannot(db.rosters.doc('leave/config').update({ note: 'x' })); });
await env.withSecurityRulesDisabled(async ctx => { await ctx.firestore().doc('roles/sipho@example.com').update({ standInFrom: 0, standInTo: Date.now() - 1000 }); });
await t('stand-in: after the last day, no reading others’ leave', async () => {
  const fresh = env.authenticatedContext('uid-rosters-2', { email: 'sipho@example.com', email_verified: true }).firestore();   // a new sign-in, nothing cached
  await cannot(read(fresh, 'leaveRequests/S3'));
});
await t('stand-in: after the last day, no decisions', async () => { await cannot(db.rosters.doc('leaveRequests/S3').update({ status: 'Approved', decidedBy: 'Sipho', decidedOn: '2026-11-05' })); });
await t('a leave manager sets the stand-in’s dates, and nothing else on their access entry', async () => {
  await can(db.admin.doc('roles/sipho@example.com').update({ standInFrom: 1, standInTo: 2 }));
  await can(andile.doc('roles/sipho@example.com').update({ standInFrom: 3, standInTo: 4 }));
  await cannot(db.pastor.doc('roles/sipho@example.com').update({ standInFrom: 5, standInTo: 6 }));
  await cannot(andile.doc('roles/sipho@example.com').update({ standInFrom: 5, standInTo: 6, role: 'admin' }));
});

console.log('One sign-in shared by a couple (one email address)');
await env.withSecurityRulesDisabled(async ctx => {
  const d = ctx.firestore(), set = (p, x) => d.doc(p).set(x);
  // Ben (p30, member) and Ann (p31, Children's ministry) share couple@example.com
  await set('roles/couple@example.com', { role: 'member', personId: 'p30', roles: ['member', 'kids'], also: ['p31'], people: { p30: { role: 'member', name: 'Ben' }, p31: { role: 'kids', name: 'Ann' } } });
  await set('people/p30', { firstName: 'Ben', lastName: 'Made-up', familyRole: 'adult' });
  await set('people/p31', { firstName: 'Ann', lastName: 'Made-up', familyRole: 'adult' });
  await set('details/p31', { familyRole: 'adult' });
  await set('assignments/a31', { personId: 'p31', serviceId: 's1', positionId: 'door', status: 'pending' });
  await set('messages/ms31', { kind: 'staff', groupId: '', audience: 'Staff', title: '', body: 'Hi Ann', fromId: 'p01', fromName: 'Linda', to: ['p31'], readBy: ['p01'] });
  await set('careGroups/cg31', { name: 'Ann’s group', leaderIds: ['p31'], memberIds: ['p31', 'p15'], names: {} });
  // Gus (p32, member) shares a sign-in with Pastor Pam (p33)
  await set('roles/manse@example.com', { role: 'member', personId: 'p32', roles: ['member', 'pastor'], also: ['p33'] });
});
const couple = env.authenticatedContext('uid-couple', { email: 'couple@example.com', email_verified: true }).firestore();
await t('shared sign-in: each person’s own record, serving and messages (the other person in it too)', async () => {
  await can(read(couple, 'details/p31'));
  await can(couple.doc('assignments/a31').update({ status: 'accepted', updatedAt: 'x' }));
  await can(list(couple.collection('assignments').where('personId', '==', 'p31')));
  await can(list(couple.collection('messages').where('to', 'array-contains', 'p31')));
  await can(couple.doc('messages/ms31').update({ readBy: ['p01', 'p31'] }));
  await can(list(couple.collection('careGroups').where('memberIds', 'array-contains', 'p31')));
  await can(list(couple.collection('careGroups/cg31/share')));
});
await t('shared sign-in: what either person’s role allows (Children’s ministry: medical notes), nothing more', async () => {
  await can(read(couple, 'medical/p12'));
  await cannot(read(couple, 'notes/p15'));
  await cannot(read(couple, 'details/p15'));
  await cannot(couple.doc('assignments/a15').update({ status: 'accepted', updatedAt: 'x' }));
});
await t('shared sign-in: Pastors with “access” give and change it for the smaller roles only', async () => {
  await can(andile.doc('roles/two@example.com').set({ role: 'member', personId: 'p34', name: 'C', roles: ['member', 'rosters'], also: ['p35'], people: { p34: { role: 'member', name: 'C' }, p35: { role: 'rosters', name: 'D' } } }));
  await cannot(andile.doc('roles/three@example.com').set({ role: 'member', personId: 'p36', name: 'E', roles: ['member', 'pastor'], also: ['p37'] }));
  await cannot(andile.doc('roles/manse@example.com').update({ also: [] }));
  await cannot(andile.doc('roles/manse@example.com').delete());
  await cannot(andile.doc('roles/four@example.com').set({ role: 'member', personId: 'p38', name: 'F', roles: ['member'], also: ['a', 'b', 'c', 'd'] }));
  await can(db.admin.doc('roles/manse@example.com').update({ also: ['p33'], name: 'Gus' }));
});

await t('anything not listed is closed', async () => { await cannot(db.admin.doc('secrets/x').set({ a: 1 })); await cannot(read(db.admin, 'secrets/x')); });

await env.cleanup();
console.log(failed ? `\n${failed} rule test(s) FAILED, ${passed} passed` : `\nAll ${passed} rule tests passed`);
process.exit(failed ? 1 : 0);
