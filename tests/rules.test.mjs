/*
 * Church & Trellis – tests for firestore.rules, run against Google's Firestore emulator (made-up people only).
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
  rosters: ['sipho@example.com', 'p05'], member: ['tim@example.com', 'p14'], attendee: ['hope@example.com', 'p16']
};
const MED = 'Children’s medical notes';

await env.withSecurityRulesDisabled(async ctx => {
  const db = ctx.firestore(), set = (p, d) => db.doc(p).set(d);
  for (const [role, [email, pid]] of Object.entries(USERS)) await set('roles/' + email, { role: role === 'attendee' ? 'member' : role, personId: pid });
  await set('settings/church', { churchName: 'Test church' });
  await set('leave/config', { types: [], autoApprove: ['UL'] });
  for (const pid of ['p01', 'p02', 'p04', 'p05', 'p14', 'p15']) await set('people/' + pid, { firstName: 'A', lastName: pid, familyRole: 'adult', email: pid + '@example.com', mobile: '082', familyId: 'f2' });
  // Tim and Clare are Church Partners (Church Partner access); Hope only comes to church (an attendee); Thandi is a Pastor
  for (const pid of ['p14', 'p15']) await db.doc('people/' + pid).update({ category: 'Church Partner' });
  await db.doc('people/p02').update({ appRole: 'pastor' });
  await set('people/p16', { firstName: 'Hope', lastName: 'Visitor', familyRole: 'adult', category: 'Attender', email: 'hope@example.com', appRole: 'member' });
  await set('names/p15', { firstName: 'Clare', lastName: 'Jacobs', preferredName: '' });
  await set('careGroups/lg2', { type: 'life', name: 'Thursday study', leaderIds: ['p15'], memberIds: ['p15', 'p16'], names: { p15: 'Clare' } });
  await set('messages/ms4', { kind: 'partners', groupId: '', audience: 'Church Partners', title: 'Sunday', body: 'Bring a friend', fromId: 'p15', fromName: 'Clare', to: ['p14', 'p16'], deliveredBy: ['p15'], readBy: ['p15'] });
  await set('messages/ms5', { kind: 'people', groupId: '', audience: '', title: '', body: 'Welcome', fromId: 'p02', fromName: 'Thandi', to: ['p16'], deliveredBy: ['p02'], readBy: ['p02'] });
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
  await set('careGroups/lg1', { type: 'life', name: 'Tuesday Bible study', leaderIds: ['p14'], memberIds: ['p14', 'p15'], names: {} });
  // Midweek Groups online: Clare leads lg3 and Tim is her co-leader; a study for lg1 (Tim leads it) and one open to everyone
  await set('careGroups/lg3', { type: 'life', name: 'Wednesday study', leaderIds: ['p15'], memberIds: ['p15', 'p14', 'p05'], roles: { p14: 'coleader', p05: 'host' }, names: {} });
  await set('studies/st1', { groupId: 'lg1', groupName: 'Tuesday Bible study', date: '2026-11-24', time: '19:00', meet: 'https://meet.google.com/abc-defg-hij', notes: '', topic: '', open: false, to: ['p14', 'p15'], fromId: 'p14', fromName: 'Tim' });
  await set('studies/st2', { groupId: 'lg2', groupName: 'Thursday study', date: '2026-11-26', time: '19:00', meet: 'https://youtube.com/live/x', notes: '', topic: '', open: true, to: ['p15', 'p16'], fromId: 'p15', fromName: 'Clare' });
  await set('careGroups/cg1/share/p15', { firstName: 'Clare', lastName: 'Jacobs', ok: true, mobile: '082', birthday: '07-14' });
  await set('careGroups/cg2/share/p05', { firstName: 'Sipho', lastName: 'Dlamini', ok: false });
  // Messages: a message group Tim leads, one Clare leads; a message to Tim and Clare, and one to Thandi only
  await set('msgGroups/mg1', { name: 'Welcome team', leaderIds: ['p14'], memberIds: ['p14', 'p15'] });
  await set('msgGroups/mg2', { name: 'Alpha team', leaderIds: ['p15'], memberIds: ['p15', 'p02'] });
  await set('messages/ms1', { kind: 'group', groupId: 'mg1', audience: 'Welcome team', title: '', body: 'Hello', fromId: 'p01', fromName: 'Linda', to: ['p14', 'p15'], deliveredBy: ['p01'], readBy: ['p01'] });
  await set('messages/ms2', { kind: 'staff', groupId: '', audience: 'Staff', title: '', body: 'Staff only', fromId: 'p01', fromName: 'Linda', to: ['p01', 'p02'], deliveredBy: ['p01'], readBy: ['p01'] });
  await set('messages/ms3', { kind: 'office', groupId: '', audience: 'Office', title: '', body: 'Please call me', fromId: 'p14', fromName: 'Tim', to: [], deliveredBy: ['p14'], readBy: ['p14'] });
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
  // Leadership groups: the Council (members only; Tim is on it) and the Wardens (open; Clare)
  await set('leaderBodies/lb1', { name: 'Church Council', open: false, memberIds: ['p14'], names: { p14: 'Tim Jacobs' }, seats: { p14: { role: 'Chair' } } });
  await set('leaderBodies/lb2', { name: 'Wardens', open: true, memberIds: ['p15'], names: { p15: 'Clare Jacobs' }, seats: {} });
  await set('archivePreviewMembers/p14', { personId: 'p14', bodyId: 'lb1' });
  await set('customGroups/cg-private', { name: 'Worship team', description: '', memberIds: ['p14'], visibility: 'members' });
  await set('customGroups/cg-church', { name: 'Welcome team', description: '', memberIds: [], visibility: 'church' });
  // The Archive: the Council's minutes, Sipho's contract (shown to him), plans for the office, a notice for everyone,
  // and an appraisal of Tim that is not shown to him
  await set('archive/ar1', { title: 'Minutes', cat: 'minutes', date: '2026-10-13', access: 'body', bodyId: 'lb1', aboutId: '', shownTo: '', file: { name: 'm.pdf', parts: 1 } });
  await set('archive/ar2', { title: 'Contract', cat: 'contracts', date: '2024-02-01', access: 'private', bodyId: '', aboutId: 'p05', shownTo: 'p05', file: { name: 'c.pdf', parts: 1 } });
  await set('archive/ar3', { title: 'Plans', cat: 'plans', date: '2019-06-20', access: 'office', bodyId: '', aboutId: '', shownTo: '' });
  await set('archive/ar4', { title: 'Constitution', cat: 'other', date: '2001-01-01', access: 'all', bodyId: '', aboutId: '', shownTo: '' });
  await set('archive/ar5', { title: 'Appraisal', cat: 'appraisals', date: '2026-09-01', access: 'private', bodyId: '', aboutId: 'p14', shownTo: '' });
  await set('archive/ar6', { title: 'Membership document', cat: 'other', date: '2026-09-01', access: 'private', bodyId: '', aboutId: '', shownTo: '', displayOnApplication: true });
  await set('archive/ar1/parts/0', { data: 'AAAA' });
  await set('archive/ar2/parts/0', { data: 'BBBB' });
  await set('archivePreviews/ar1/parts/0', { data: 'AAAA' });
  await set('archivePreviews/ar2/parts/0', { data: 'BBBB' });
  await set('archivePreviews/ar4/parts/0', { data: 'CCCC' });
  await set('applicationDocuments/pub1', { title: 'Constitution', date: '2026-01-01', link: 'https://example.org/constitution', fileName: 'constitution.pdf', fileType: 'application/pdf', parts: 1, fileVersion: 'v1' });
  await set('applicationDocuments/pub1/files/v1/parts/0', { data: 'AAAA' });
  await set('applicationDocuments/pub1/files/v2/parts/0', { data: 'BBBB' });
  // The Library: a book, lent to Tim and to Clare
  await set('books/b1', { title: 'Knowing God', author: 'J. I. Packer', copies: 2, out: 2 });
  await set('loans/l14', { bookId: 'b1', title: 'Knowing God', personId: 'p14', name: 'Tim Jacobs', out: '2026-11-01', due: '2026-11-22', back: '' });
  await set('loans/l15', { bookId: 'b1', title: 'Knowing God', personId: 'p15', name: 'Clare Jacobs', out: '2026-11-01', due: '2026-11-22', back: '' });
});

const as = role => { const [email, pid] = USERS[role]; return env.authenticatedContext('uid-' + role, { email, email_verified: true }).firestore(); };
const db = { admin: as('admin'), pastor: as('pastor'), kids: as('kids'), rosters: as('rosters'), member: as('member'), attendee: as('attendee') };
const standardMember = env.authenticatedContext('uid-nomvula', { email: 'nomvula@example.com', email_verified: true }).firestore();
const settingsPastor = env.authenticatedContext('uid-settings-pastor', { email: 'andile@example.com', email_verified: true }).firestore();
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
  await can(read(db.admin, 'settings/not-created-yet'));
});
await t('everyone can read their own access entry, not other people’s', async () => {
  await can(read(stranger, 'roles/stranger@example.com')); await can(read(db.member, 'roles/tim@example.com'));
  await cannot(read(db.member, 'roles/linda@example.com')); await can(read(db.admin, 'roles/tim@example.com'));
});
await t('brochure content is private to Administrators, including for Pastors who can change settings', async () => {
  await env.withSecurityRulesDisabled(async ctx => { await ctx.firestore().doc('brochures/church').set({ design: {}, members: {} }); });
  await can(read(db.admin, 'brochures/church'));
  await cannot(read(db.pastor, 'brochures/church'));
  await cannot(read(db.member, 'brochures/church'));
  await cannot(read(stranger, 'brochures/church'));
  await cannot(read(unverified, 'brochures/church'));
  await cannot(read(nobody, 'brochures/church'));
  await cannot(db.pastor.doc('brochures/church').set({ members: { texts: {} } }));
  await cannot(db.member.doc('brochures/church').set({ members: { texts: {} } }));
  await cannot(db.admin.doc('settings/church').update({ brochures: { members: { texts: {} } } }));
  await cannot(settingsPastor.doc('settings/church').update({ brochures: { members: { texts: {} } } }));
  await can(db.admin.doc('brochures/church').update({ members: { texts: { title: 'Welcome' } } }));
});
await t('legacy brochure settings are private until an Administrator moves them', async () => {
  await env.withSecurityRulesDisabled(async ctx => { await ctx.firestore().doc('settings/church').update({ brochures: { members: { texts: {} } } }); });
  await can(read(db.admin, 'settings/church'));
  await cannot(read(db.member, 'settings/church'));
  await cannot(read(robotDb, 'settings/church'));
  await env.withSecurityRulesDisabled(async ctx => { await ctx.firestore().doc('settings/church').update({ brochures: firebase.firestore.FieldValue.delete() }); });
  await can(read(db.member, 'settings/church'));
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
  await can(db.member.doc('people/p14').update({ appFirstSeen: '2026-11-20' }));   // the day they first signed in (People → Invitations)
  await cannot(db.member.doc('people/p15').update({ appFirstSeen: '2026-11-20' }));
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
await t('partnership applications: people apply themselves; Administrators and Pastors read and answer them', async () => {
  const app = { personId: 'p14', spouse: '', anniversary: '', children: '', since: '2025-11', faith: 'yes', story: 'Grew up in a Christian home', otherChurch: 'no', otherWhich: '',
    classOk: 'yes', study: '', questions: '', serve: 'Tea after church', declaration: 'I declare…', loyalty: 'I declare my loyalty…', birthDate: '1981-01-01', directory: true, status: 'waiting', createdAt: 'x', updatedAt: 'x' };
  await can(db.member.doc('partnerApps/a14').set(app));
  await can(list(db.member.collection('partnerApps').where('personId', '==', 'p14')));
  await cannot(list(db.member.collection('partnerApps')));                                              // not anyone else's
  await cannot(db.member.doc('partnerApps/a15').set(Object.assign({}, app, { personId: 'p15' })));      // not for someone else
  await cannot(db.member.doc('partnerApps/a16').set(Object.assign({}, app, { status: 'accepted' })));   // can't accept their own
  await cannot(db.member.doc('partnerApps/a17').set(Object.assign({}, app, { idNumber: '8101015009086' })));   // ID numbers never in it
  await cannot(db.member.doc('partnerApps/a14').update({ status: 'accepted' }));
  await cannot(list(db.rosters.collection('partnerApps')));                                             // faith answers: not for every role
  await can(list(db.pastor.collection('partnerApps')));
  await can(list(db.admin.collection('partnerApps')));
  await can(db.pastor.doc('partnerApps/a14').update({ status: 'accepted', approvedOn: '2026-11-10', approvedBy: 'Church Council', note: '' }));
  await can(db.member.doc('partnerApps/a14').delete());                                                // withdraw (or OK after "not now")
  // Their own ID number: given once on the form; never changed by them afterwards, and still only Administrators read it
  await env.withSecurityRulesDisabled(async ctx => { await ctx.firestore().doc('idNumbers/p14').delete(); });
  await can(db.member.doc('idNumbers/p14').set({ value: '8101015009086', updatedAt: 'x' }));
  await cannot(db.member.doc('idNumbers/p14').set({ value: '1', updatedAt: 'y' }));
  await cannot(db.member.doc('idNumbers/p15').set({ value: '1', updatedAt: 'y' }));
  await cannot(read(db.pastor, 'idNumbers/p14'));
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
await t('care groups: Roster coordinators and Children\u2019s ministry see every group only when Settings allows it (seeCare), never the cards', async () => {
  await cannot(list(db.rosters.collection('careGroups'))); await cannot(list(db.kids.collection('careGroups')));
  await env.withSecurityRulesDisabled(async ctx => { await ctx.firestore().doc('settings/church').update({ seeCare: ['rosters'] }); });
  await can(list(db.rosters.collection('careGroups'))); await can(read(db.rosters, 'careGroups/cg1'));
  await cannot(read(db.rosters, 'careGroups/cg1/share/p15')); await cannot(list(db.rosters.collection('careGroups/cg1/share')));
  await cannot(db.rosters.doc('careGroups/cg1').update({ name: 'x' }));
  await cannot(list(db.kids.collection('careGroups'))); await cannot(list(db.member.collection('careGroups')));
  await env.withSecurityRulesDisabled(async ctx => { await ctx.firestore().doc('settings/church').update({ seeCare: ['member'] }); });
  await cannot(list(db.member.collection('careGroups')));   // only Roster coordinators and Children's ministry can be allowed
  await env.withSecurityRulesDisabled(async ctx => { await ctx.firestore().doc('settings/church').update({ seeCare: [] }); });
  await cannot(list(db.rosters.collection('careGroups')));
});
await t('care groups: "See everyone in their own care group" switched off - members see only the carers\' cards and their own; carers still see everyone', async () => {
  // cg3: carer p15, members p15 and p14 (Tim, member); cg1: Tim is its carer
  await env.withSecurityRulesDisabled(async ctx => { const d = ctx.firestore(); await d.doc('settings/church').update({ seeCareOwn: false }); await d.doc('careGroups/cg3/share/p15').set({ firstName: 'Clare', ok: true }); await d.doc('careGroups/cg3/share/p14').set({ firstName: 'Tim', ok: true }); });
  await can(read(db.member, 'careGroups/cg3/share/p15')); await can(read(db.member, 'careGroups/cg3/share/p14'));
  await cannot(list(db.member.collection('careGroups/cg3/share')));
  await can(list(db.member.collection('careGroups/cg1/share')));   // Tim leads cg1
  await env.withSecurityRulesDisabled(async ctx => { await ctx.firestore().doc('settings/church').update({ seeCareOwn: true }); });
  await can(list(db.member.collection('careGroups/cg3/share')));
  // the church directory may list someone's care groups (names only)
  await can(db.member.doc('directory/p14').set({ firstName: 'Tim', lastName: 'Jacobs', care: [{ id: 'cg1', name: 'Hilton', carer: true }] }));
  await cannot(db.member.doc('directory/p14').set({ firstName: 'Tim', lastName: 'Jacobs', medical: 'x' }));
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
  // a life group's leader may also name the group (not blank), still not change its leaders or kind
  await can(db.member.doc('careGroups/lg1').update({ name: 'Hilton life group' }));
  await cannot(db.member.doc('careGroups/lg1').update({ name: '' }));
  await can(db.member.doc('careGroups/lg1').update({ when: { day: 2, time: '19:00', freq: 'weekly' }, venue: { place: 'Church hall', address: '1 Main Rd' }, roles: { p15: 'host' } }));   // and when and where it meets
  await cannot(db.member.doc('careGroups/cg1').update({ when: { day: 2 } }));   // not a care group's carers
  await cannot(db.member.doc('careGroups/lg1').update({ type: 'care' }));
  await cannot(db.member.doc('careGroups/lg1').update({ leaderIds: ['p14', 'p15'] }));
  await cannot(db.member.doc('careGroups/cg3').update({ type: 'life', name: 'Mine' }));   // Tim is only a member of cg3
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
  await can(read(db.member, 'messages/ms3')); await can(read(db.admin, 'messages/ms3')); await can(read(db.pastor, 'messages/ms3'));
  await cannot(read(db.kids, 'messages/ms3'));
  await cannot(read(db.rosters, 'messages/ms1')); await cannot(read(stranger, 'messages/ms1'));
});
await t('messages: who may send to whom', async () => {
  const m = (o) => Object.assign({ groupId: '', audience: 'x', title: '', body: 'Hi', fromName: 'x', deliveredBy: [], readBy: [], createdAt: 'x', updatedAt: 'x' }, o);
  await can(db.admin.doc('messages/n1').set(m({ kind: 'staff', fromId: 'p01', to: ['p02', 'p05'], readBy: ['p01'] })));
  await can(db.pastor.doc('messages/n2').set(m({ kind: 'partners', fromId: 'p02', to: ['p14', 'p15'] })));
  await can(db.member.doc('messages/nOffice').set(m({ kind: 'office', fromId: 'p14', audience: 'Office', to: [], deliveredBy: ['p14'], readBy: ['p14'] })));
  await cannot(db.member.doc('messages/nOfficeBad').set(m({ kind: 'office', fromId: 'p14', to: ['p01'] })));
  await cannot(db.pastor.doc('messages/n3').set(m({ kind: 'partners', fromId: 'p01', to: ['p14'] })));          // not in someone else's name
  await cannot(db.rosters.doc('messages/n4').set(m({ kind: 'staff', fromId: 'p05', to: ['p01'] })));            // staff and Church Partners: Administrators and Pastors only
  await can(db.member.doc('messages/n5').set(m({ kind: 'care', groupId: 'cg1', fromId: 'p14', to: ['p14', 'p15'], readBy: ['p14'] })));   // Tim leads cg1
  await cannot(db.member.doc('messages/n6').set(m({ kind: 'care', groupId: 'cg1', fromId: 'p14', to: ['p14', 'p02'] })));    // someone not in the group
  await cannot(db.member.doc('messages/n7').set(m({ kind: 'care', groupId: 'cg3', fromId: 'p14', to: ['p15'] })));          // a group he doesn't lead
  await can(db.member.doc('messages/n7b').set(m({ kind: 'life', groupId: 'lg1', fromId: 'p14', to: ['p14', 'p15'], readBy: ['p14'] })));   // Tim leads life group lg1
  await cannot(db.member.doc('messages/n7c').set(m({ kind: 'life', groupId: 'lg1', fromId: 'p14', to: ['p02'] })));            // someone not in it
  await can(db.member.doc('messages/n8').set(m({ kind: 'group', groupId: 'mg1', fromId: 'p14', to: ['p15'] })));
  await cannot(db.member.doc('messages/n9').set(m({ kind: 'group', groupId: 'mg2', fromId: 'p14', to: ['p15'] })));
  await can(db.member.doc('messages/n9b').set(m({ kind: 'leaders', groupId: 'lb1', fromId: 'p14', to: ['p14'], readBy: ['p14'] })));   // Tim is on the Council (lb1)
  await cannot(db.member.doc('messages/n9c').set(m({ kind: 'leaders', groupId: 'lb1', fromId: 'p14', to: ['p15'] })));           // someone not on it
  await cannot(db.member.doc('messages/n9d').set(m({ kind: 'leaders', groupId: 'lb2', fromId: 'p14', to: ['p15'] })));           // a group he isn't on
  await cannot(db.member.doc('messages/n10').set(m({ kind: 'group', groupId: 'mg1', fromId: 'p14', to: ['p15'], readBy: ['p15'] })));   // can't mark others as having read it
  await cannot(db.member.doc('messages/n11').set(m({ kind: 'group', groupId: 'mg1', fromId: 'p14', to: ['p15'], extra: 1 })));
  await cannot(db.member.doc('messages/n12').set(m({ kind: 'group', groupId: 'mg1', fromId: 'p14', to: ['p15'], body: '' })));
  await cannot(db.admin.doc('messages/n13').set(m({ kind: 'staff', fromId: 'p01', to: ['p02'], body: 'x'.repeat(4001) })));
  await can(db.pastor.doc('messages/n14').set(m({ kind: 'people', fromId: 'p02', to: ['p15'], audience: 'Clare' })));          // one person, chosen
  await cannot(db.member.doc('messages/n15').set(m({ kind: 'people', fromId: 'p14', to: ['p15'] })));                         // members can't choose people
  await can(db.member.doc('messages/n16').set(m({ kind: 'care', groupId: 'cg1', fromId: 'p14', to: ['p15'], some: true })));   // a carer: some of the group
  await cannot(db.member.doc('messages/n17').set(m({ kind: 'care', groupId: 'cg1', fromId: 'p14', to: ['p15'], some: 'yes' })));
});
await t('messages: roster messages – asked to serve, reminders, and someone who can’t make it', async () => {
  await env.withSecurityRulesDisabled(async ctx => { await ctx.firestore().doc('settings/church').set({ rosterTeam: ['p01', 'p05'] }, { merge: true }); });   // kept by Administrators
  const m = (o) => Object.assign({ kind: 'roster', groupId: '', audience: '', title: '', body: 'Reading, 6 Dec', fromName: 'x', deliveredBy: [], readBy: [], createdAt: 'x', updatedAt: 'x' }, o);
  await can(db.rosters.doc('messages/rost1').set(m({ roster: 'ask', turns: ['a1'], fromId: 'p05', to: ['p14'] })));          // the roster coordinator asks
  await can(db.rosters.doc('messages/rost2').set(m({ roster: 'remind', turns: ['a1', 'a2'], fromId: 'p05', to: ['p14'] })));
  await can(db.rosters.doc('messages/rost9').set(m({ roster: 'off', turns: ['a1'], fromId: 'p05', to: ['p14'] })));          // no longer needed
  await cannot(db.member.doc('messages/rost10').set(m({ roster: 'off', turns: ['a1'], fromId: 'p14', to: ['p15'] })));
  await cannot(db.member.doc('messages/rost3').set(m({ roster: 'ask', turns: ['a1'], fromId: 'p14', to: ['p15'] })));        // a member can't ask people to serve
  await can(db.member.doc('messages/rost4').set(m({ roster: 'declined', turns: ['a1'], fromId: 'p14', to: ['p01', 'p05'] })));   // can't make it: to the roster team
  await cannot(db.member.doc('messages/rost5').set(m({ roster: 'declined', turns: ['a1'], fromId: 'p14', to: ['p15'] })));      // only to the roster team
  await cannot(db.member.doc('messages/rost6').set(m({ roster: 'declined', turns: [], fromId: 'p14', to: ['p05'] })));          // about a turn
  await cannot(db.rosters.doc('messages/rost7').set(m({ roster: 'ask', turns: 'a1', fromId: 'p05', to: ['p14'] })));
  await cannot(db.rosters.doc('messages/rost8').set(m({ kind: 'staff', roster: 'ask', turns: ['a1'], fromId: 'p05', to: ['p01'] })));   // roster fields only on roster messages
  await can(read(db.member, 'messages/rost1')); await cannot(read(db.attendee, 'messages/rost1'));
});
await t('messages: people mark what they opened as read, and change nothing else', async () => {
  await can(db.member.doc('messages/ms1').update({ readBy: firebase.firestore.FieldValue.arrayUnion('p14') }));
  await can(db.member.doc('messages/ms1').update({ deliveredBy: firebase.firestore.FieldValue.arrayUnion('p14') }));
  await cannot(db.member.doc('messages/ms1').update({ deliveredBy: firebase.firestore.FieldValue.arrayUnion('p05') }));
  await cannot(db.member.doc('messages/ms1').update({ readBy: firebase.firestore.FieldValue.arrayUnion('p15') }));
  await cannot(db.member.doc('messages/ms1').update({ readBy: ['p14'] }));   // taking the sender off
  await can(db.admin.doc('messages/ms3').update({ deliveredBy: firebase.firestore.FieldValue.arrayUnion('p01') }));
  await can(db.pastor.doc('messages/ms3').update({ readBy: firebase.firestore.FieldValue.arrayUnion('p02') }));
  await cannot(db.member.doc('messages/ms3').update({ deliveredBy: firebase.firestore.FieldValue.arrayUnion('p14') }));
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
console.log('Administrator-managed groups');
await t('custom groups: church-visible groups and a member-only group', async () => {
  await can(read(db.member, 'customGroups/cg-private')); await cannot(read(standardMember, 'customGroups/cg-private'));
  await can(read(standardMember, 'customGroups/cg-church')); await can(list(db.admin.collection('customGroups')));
  await can(list(db.member.collection('customGroups').where('visibility', '==', 'church')));
  await can(list(db.member.collection('customGroups').where('memberIds', 'array-contains', 'p14')));
  await cannot(list(db.member.collection('customGroups')));
  const group = { name: 'New group', description: 'Made-up group', memberIds: ['p14'], visibility: 'members', createdAt: '2026-11-13 10:00', updatedAt: '2026-11-13 10:00' };
  await can(db.admin.doc('customGroups/cg-new').set(group)); await can(db.admin.doc('customGroups/cg-new').update({ visibility: 'church', updatedAt: '2026-11-13 10:01' }));
  await cannot(db.member.doc('customGroups/cg-new').set(group)); await cannot(db.pastor.doc('customGroups/cg-new').delete());
  await cannot(db.admin.doc('customGroups/cg-bad-time').set(Object.assign({}, group, { updatedAt: 1 })));
  await cannot(db.admin.doc('customGroups/cg-bad').set(Object.assign({}, group, { contactDetails: 'private' })));
});
console.log('Leadership groups, the Archive and the Library');
// For these: Andile (a Pastor, p03) is the Senior Pastor, and Sipho (Roster coordinator, p05) is a librarian
await env.withSecurityRulesDisabled(async ctx => { await ctx.firestore().doc('settings/church').set({ seniorPastorId: 'p03', librarianIds: ['p05'] }, { merge: true }); });
const rector = env.authenticatedContext('uid-rector', { email: 'andile@example.com', email_verified: true }).firestore();
await t('brochures: the Rector (Senior Pastor) may read the church’s brochure wording to print it, but not change it; other Pastors may not', async () => {
  await env.withSecurityRulesDisabled(async ctx => { await ctx.firestore().doc('brochures/church').set({ design: {}, members: {} }); });
  await can(read(rector, 'brochures/church')); await cannot(read(db.pastor, 'brochures/church'));
  await cannot(rector.doc('brochures/church').set({ design: { accent: '#000000' } })); await cannot(rector.doc('brochures/other').get());
});
await t('leadership groups: an open one is read by everyone signed in, any other by its members, Administrators and Pastors', async () => {
  await only('leaderBodies/lb2', roles); await cannot(read(stranger, 'leaderBodies/lb2')); await cannot(read(nobody, 'leaderBodies/lb2'));
  await only('leaderBodies/lb1', ['admin', 'pastor', 'member']);
  await can(list(db.member.collection('leaderBodies').where('open', '==', true)));
  await can(list(db.member.collection('leaderBodies').where('memberIds', 'array-contains', 'p14')));
  await cannot(list(db.member.collection('leaderBodies'))); await cannot(list(db.rosters.collection('leaderBodies').where('memberIds', 'array-contains', 'p14')));
  await can(list(db.admin.collection('leaderBodies'))); await can(list(db.pastor.collection('leaderBodies')));
});
await t('leadership groups: only Administrators and Pastors set them up', async () => {
  const g = { name: 'Elders', open: true, memberIds: [], names: {}, seats: {}, past: [] };
  await can(db.pastor.doc('leaderBodies/lb3').set(g)); await can(db.admin.doc('leaderBodies/lb3').update({ open: false, memberIds: ['p15'] }));
  await cannot(db.member.doc('leaderBodies/lb1').update({ memberIds: ['p14', 'p15'] })); await cannot(db.member.doc('leaderBodies/lb1').update({ open: true }));
  await cannot(db.rosters.doc('leaderBodies/lb4').set(g)); await cannot(db.member.doc('leaderBodies/lb2').delete());
  await cannot(db.admin.doc('leaderBodies/lb4').set({ name: '', open: true, memberIds: [] })); await cannot(db.admin.doc('leaderBodies/lb4').set({ name: 'X', memberIds: [] }));
  await can(db.admin.doc('leaderBodies/lb3').delete());
});
await t('archive: only Administrators and Council members read records', async () => {
  for (const id of ['ar1', 'ar2', 'ar3', 'ar4', 'ar5']) await can(read(db.admin, 'archive/' + id));
  await can(list(db.admin.collection('archive')));
  await cannot(read(rector, 'archive/ar4'));                           // Senior Pastor status alone is not Council membership
  await cannot(read(db.rosters, 'archive/ar2'));                       // Librarian status and shownTo do not grant archive access
  await cannot(read(standardMember, 'archive/ar4'));
  await cannot(list(standardMember.collection('archive').where('access', '==', 'all')));
  await cannot(read(standardMember, 'archive/ar1/parts/0'));
  await cannot(read(stranger, 'archive/ar4')); await cannot(read(nobody, 'archive/ar4'));
});
await t('archive: Council members remain limited by each record’s access', async () => {
  await only('archive/ar4', ['admin', 'member']);                      // public to the Council, not every signed-in member
  await only('archive/ar3', ['admin']);                                // the office is not enough without Council membership
  await only('archive/ar1', ['admin', 'member']);                      // the Council's minutes
  await only('archive/ar2', ['admin']);                                // shownTo does not bypass the Council gate
  await only('archive/ar5', ['admin']);                                // nor does being the person in the record
});
await t('archive: Council members can ask only for records allowed by their access', async () => {
  const m = db.member.collection('archive');
  await can(list(m.where('access', '==', 'all'))); await can(list(m.where('bodyId', '==', 'lb1')));
  await cannot(list(m)); await cannot(list(m.where('access', '==', 'office'))); await cannot(list(m.where('access', '==', 'private')));
  await cannot(list(m.where('bodyId', '==', 'lb2'))); await cannot(list(m.where('shownTo', '==', 'p05'))); await cannot(list(m.where('aboutId', '==', 'p14')));
  await cannot(list(db.pastor.collection('archive').where('access', '==', 'office'))); await cannot(list(db.pastor.collection('archive')));
  await cannot(list(db.rosters.collection('archive').where('shownTo', '==', 'p05'))); await cannot(list(db.rosters.collection('archive').where('access', '==', 'office')));
});
await t('archive: a record’s file follows the record', async () => {
  await can(read(db.member, 'archive/ar1/parts/0')); await cannot(read(db.member, 'archive/ar2/parts/0'));
  await cannot(read(db.rosters, 'archive/ar2/parts/0')); await cannot(read(db.rosters, 'archive/ar1/parts/0'));
  await cannot(read(db.pastor, 'archive/ar1/parts/0')); await cannot(read(db.pastor, 'archive/ar2/parts/0'));
  await can(read(db.admin, 'archive/ar2/parts/0')); await cannot(read(rector, 'archive/ar1/parts/0'));
  await cannot(read(db.member, 'archive/nothere/parts/0')); await cannot(read(stranger, 'archive/ar1/parts/0'));
});
await t('archive: inline preview content is only for Administrators and Council members', async () => {
  await can(read(db.admin, 'archivePreviews/ar2/parts/0'));
  await can(read(db.member, 'archivePreviews/ar1/parts/0'));              // Tim is a Council member
  await can(read(db.member, 'archivePreviews/ar4/parts/0'));               // Council can preview any record they may see
  await cannot(read(db.rosters, 'archivePreviews/ar2/parts/0'));          // even though Sipho may download his contract
  await cannot(read(standardMember, 'archivePreviews/ar4/parts/0'));
  await cannot(read(rector, 'archivePreviews/ar1/parts/0'));              // Senior Pastor is not an Administrator or Council member
  await can(db.member.doc('archivePreviews/ar1/parts/0').set({ data: 'AAAA' }));            // an exact copy of the record's own file
  await cannot(db.member.doc('archivePreviews/ar1/parts/0').set({ data: 'different' }));   // … never anything else
  await cannot(db.member.doc('archivePreviews/ar2/parts/0').set({ data: 'BBBB' }));        // nor for a record they may not see
  await cannot(db.member.doc('archivePreviews/ar1/parts/0').set({ data: 'AAAA', extra: true }));
  await can(db.member.doc('archive/council-new/parts/0').set({ data: 'QUJD' }));          // a new file is saved before its record …
  await can(db.member.doc('archivePreviews/council-new/parts/0').set({ data: 'QUJD' }));  // … then its preview copy
  await can(db.member.doc('archivePreviews/council-new/parts/0').delete()); await can(db.member.doc('archive/council-new/parts/0').delete());
  await cannot(db.member.doc('archivePreviews/ar2/parts/0').delete());                     // not a preview of a record they may not see
  await cannot(db.rosters.doc('archivePreviews/ar2/parts/0').set({ data: 'BBBB' }));
  await cannot(standardMember.doc('archivePreviews/ar4/parts/0').set({ data: 'BBBB' }));
  await cannot(db.admin.doc('archivePreviewMembers/p15').set({ personId: 'p15', bodyId: 'lb1' }));   // Clare isn't on the Council
  await cannot(db.admin.doc('archivePreviewMembers/p15').set({ personId: 'p15', bodyId: 'lb2' }));   // the Wardens aren't a Council
  await cannot(db.admin.doc('archivePreviewMembers/p15').set({ personId: 'p15' }));
  await cannot(db.pastor.doc('archivePreviewMembers/p02').set({ personId: 'p02', bodyId: 'lb1' }));  // a Pastor can't add themself …
  await can(db.admin.doc('archivePreviewMembers/p14').set({ personId: 'p14', bodyId: 'lb1' }));      // … only real Council members are listed
  await cannot(db.member.doc('archivePreviewMembers/p15').set({ personId: 'p15', bodyId: 'lb1' }));
});
await t('archive: only Administrators and Council members add, change and delete records', async () => {
  const r = o => Object.assign({ title: 'New', cat: 'other', date: '2026-11-10', note: '', access: 'office', bodyId: '', aboutId: '', aboutName: '', shownTo: '', link: 'https://example.org/x', by: 'x' }, o);
  await can(db.admin.doc('archive/n1').set(r({}))); await can(db.member.doc('archive/n2').set(r({ access: 'body', bodyId: 'lb1' })));
  await can(db.member.doc('archive/n5').set(r({ access: 'all' }))); await can(db.member.doc('archive/n5').delete());
  await can(db.admin.doc('archive/n3').set(r({ access: 'private', aboutId: 'p05', shownTo: 'p05' })));
  await cannot(db.pastor.doc('archive/n4').set(r({}))); await cannot(db.rosters.doc('archive/n4').set(r({})));
  await can(db.member.doc('archive/ar1').update({ title: 'Updated by Council' })); await cannot(db.rosters.doc('archive/ar2').update({ access: 'all' }));
  // A Council member can't change, delete or open up a record they may not see (e.g. a private staff contract)
  await cannot(db.member.doc('archive/ar2').update({ access: 'all', shownTo: '', aboutId: '' })); await cannot(db.member.doc('archive/ar2').delete());
  await cannot(db.member.doc('archive/ar2/parts/0').set({ data: 'XXXX' })); await cannot(db.member.doc('archive/ar2/parts/0').delete());
  await cannot(db.member.doc('archive/ar4').update({ access: 'private' }));                 // … nor hide one from themself
  await cannot(db.member.doc('archive/n6').set(r({ access: 'private' })));
  await cannot(db.admin.doc('archive/n4').set(r({ access: 'body' })));                       // a leadership group's record must name the group
  await cannot(db.admin.doc('archive/n4').set(r({ access: 'office', bodyId: 'lb1' })));      // … and no other record may
  await cannot(db.admin.doc('archive/n4').set(r({ access: 'anyone' }))); await cannot(db.admin.doc('archive/n4').set(r({ title: '' })));
  await cannot(db.admin.doc('archive/n4').set(r({ aboutId: 'p05', shownTo: 'p14' })));       // shown only to the person it is about
  await can(db.admin.doc('archive/n1/parts/0').set({ data: 'QUJD' })); await can(db.member.doc('archive/n2/parts/1').set({ data: 'REVG' }));
  await cannot(db.admin.doc('archive/n1/parts/2').set({ data: 'QUJD', more: 1 })); await cannot(db.admin.doc('archive/n1/parts/2').set({ data: 'A'.repeat(950001) }));
  await cannot(db.pastor.doc('archive/n1/parts/2').set({ data: 'QUJD' })); await cannot(db.rosters.doc('archive/ar1/parts/0').set({ data: 'QUJD' }));
  await cannot(db.pastor.doc('archive/ar3').delete()); await cannot(db.rosters.doc('archive/ar4').delete());
  await can(db.admin.doc('archive/n1/parts/0').delete()); await can(db.member.doc('archive/n2/parts/1').delete());
  for (const id of ['n1', 'n3']) await can(db.admin.doc('archive/' + id).delete());
  await can(db.member.doc('archive/n2').delete());
  await can(db.admin.doc('archive/n6').set(r({ displayOnApplication: true })));
  await cannot(db.member.doc('archive/n1').update({ displayOnApplication: true }));
  await cannot(db.member.doc('archive/ar6').update({ displayOnApplication: false }));
  await can(db.admin.doc('archive/ar6').update({ displayOnApplication: false }));
});
await t('membership application documents: all signed-in applicants can read only the published copy and its active file version', async () => {
  await can(read(db.member, 'applicationDocuments/pub1')); await can(list(db.member.collection('applicationDocuments')));
  await can(read(db.member, 'applicationDocuments/pub1/files/v1/parts/0'));
  await cannot(read(db.member, 'applicationDocuments/pub1/files/v2/parts/0'));
  await cannot(read(stranger, 'applicationDocuments/pub1'));
  await cannot(read(db.member, 'archive/ar2'));
  const publicDoc = { title: 'Statement of faith', date: '2026-01-01', link: 'https://example.org/faith', fileName: 'faith.pdf', fileType: 'application/pdf', parts: 1, fileVersion: 'v3' };
  await cannot(db.member.doc('applicationDocuments/new').set(publicDoc));
  await cannot(db.admin.doc('applicationDocuments/bad').set(Object.assign({}, publicDoc, { note: 'private archive note' })));
  await can(db.admin.doc('applicationDocuments/pub1').update({ fileVersion: 'v2' }));
  await can(read(db.member, 'applicationDocuments/pub1/files/v2/parts/0'));
  await cannot(read(db.member, 'applicationDocuments/pub1/files/v1/parts/0'));
  await can(db.admin.doc('applicationDocuments/pub1').delete());
  await cannot(read(db.member, 'applicationDocuments/pub1/files/v2/parts/0'));
});
await t('library: everyone signed in sees the books; only librarians (Administrators and the people named) change them', async () => {
  await only('books/b1', roles); await can(list(db.member.collection('books'))); await cannot(read(stranger, 'books/b1')); await cannot(read(nobody, 'books/b1'));
  await can(db.admin.doc('books/b2').set({ title: 'Mere Christianity', copies: 1, out: 0 })); await can(db.rosters.doc('books/b2').update({ copies: 2 }));
  await can(db.admin.doc('books/b2').delete());
  await can(db.rosters.doc('books/b3').set({ title: 'Purge test', copies: 1, out: 0 })); await can(db.rosters.doc('books/b3').delete());
  await cannot(db.member.doc('books/b3').set({ title: 'Mine', copies: 1, out: 0 })); await cannot(db.member.doc('books/b1').update({ out: 0 })); await cannot(db.pastor.doc('books/b1').update({ out: 0 }));
  await cannot(db.admin.doc('books/b3').set({ title: '', copies: 1 })); await cannot(db.kids.doc('books/b2').delete());
  await can(db.rosters.doc('books/b2').delete());
});
await t('library: who borrowed what is seen by the librarians and the borrower only', async () => {
  await can(read(db.member, 'loans/l14')); await cannot(read(db.member, 'loans/l15'));
  await can(list(db.member.collection('loans').where('personId', '==', 'p14'))); await cannot(list(db.member.collection('loans'))); await cannot(list(db.member.collection('loans').where('personId', '==', 'p15')));
  await cannot(read(db.pastor, 'loans/l14')); await cannot(read(db.kids, 'loans/l15')); await cannot(list(db.pastor.collection('loans')));
  await can(list(db.admin.collection('loans'))); await can(list(db.rosters.collection('loans'))); await can(read(db.rosters, 'loans/l15'));
  const l = { bookId: 'b1', title: 'Knowing God', personId: 'p14', name: 'Tim Jacobs', mobile: '082 000 1518', visitor: false, out: '2026-11-10', due: '2026-12-01', back: '', note: '' };
  await can(db.rosters.doc('loans/l20').set(l)); await can(db.admin.doc('loans/l20').update({ back: '2026-11-12' }));
  await cannot(db.member.doc('loans/l21').set(l)); await cannot(db.member.doc('loans/l14').update({ back: '2026-11-12' })); await cannot(db.member.doc('loans/l14').delete());
  await cannot(db.admin.doc('loans/l21').set({ title: 'No book or person' }));
  await can(db.admin.doc('loans/l20').delete()); await can(db.rosters.doc('loans/l21').set(l)); await can(db.rosters.doc('loans/l21').delete());
});
await t('library: members reserve one copy atomically; librarians approve or reject the request', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    await ctx.firestore().doc('books/claim1').set({ title: 'Checkout claim', copies: 1, out: 0 });
    await ctx.firestore().doc('books/claim2').set({ title: 'Checkout rejection', copies: 1, out: 0 });
  });
  const pending = { bookId: 'claim1', title: 'Checkout claim', personId: 'p14', name: 'Tim Jacobs', mobile: '082 000 1518',
    visitor: false, out: '2026-11-10', due: '2026-12-01', back: '', note: '', status: 'pending', requestedAt: '2026-11-10T12:00:00.000Z' };
  await can(db.member.runTransaction(async tx => {
    const ref = db.member.doc('books/claim1'), snap = await tx.get(ref);
    tx.set(db.member.doc('loans/claim1'), pending);
    tx.update(ref, { out: snap.data().out + 1, lastClaimId: 'claim1' });
  }));
  await can(read(db.member, 'loans/claim1')); await can(read(db.rosters, 'loans/claim1')); await cannot(read(standardMember, 'loans/claim1'));
  await cannot(db.member.doc('loans/claim2').set(Object.assign({}, pending, { bookId: 'claim1' })));
  await cannot(db.member.runTransaction(async tx => {
    const ref = db.member.doc('books/claim1'), snap = await tx.get(ref);
    tx.set(db.member.doc('loans/claim2'), Object.assign({}, pending, { bookId: 'claim1' }));
    tx.update(ref, { out: snap.data().out + 1, lastClaimId: 'claim2' });
  }));
  await can(db.rosters.doc('loans/claim1').update({ status: 'approved', verifiedAt: '2026-11-10T12:10:00.000Z', verifiedBy: 'p05' }));
  await cannot(db.member.doc('loans/claim1').update({ status: 'approved' }));
  const rejected = Object.assign({}, pending, { bookId: 'claim2', title: 'Checkout rejection' });
  await can(db.member.runTransaction(async tx => {
    const ref = db.member.doc('books/claim2'), snap = await tx.get(ref);
    tx.set(db.member.doc('loans/claim3'), rejected);
    tx.update(ref, { out: snap.data().out + 1, lastClaimId: 'claim3' });
  }));
  await can(db.rosters.runTransaction(async tx => {
    const loanRef = db.rosters.doc('loans/claim3'), bookRef = db.rosters.doc('books/claim2');
    const book = await tx.get(bookRef);
    tx.update(loanRef, { status: 'rejected', verifiedAt: '2026-11-10T12:20:00.000Z', verifiedBy: 'p05', back: '2026-11-10', mobile: '' });
    tx.update(bookRef, { out: book.data().out - 1 });
  }));
  await can(read(db.member, 'loans/claim3'));
  await can(db.rosters.doc('libraryDuplicateIgnores/cv-b::cv-f').set({ pair: 'cv-b::cv-f' }));
  await can(read(db.rosters, 'libraryDuplicateIgnores/cv-b::cv-f'));
  await cannot(read(db.member, 'libraryDuplicateIgnores/cv-b::cv-f'));
  await cannot(db.member.doc('libraryDuplicateIgnores/cv-b::cv-f').set({ pair: 'cv-b::cv-f' }));
  const finalBook = await db.rosters.doc('books/claim2').get();
  if (finalBook.data().out !== 0) throw new Error('Rejected checkout did not release its reserved copy.');
});
await t('library: every new loan has a mobile number; a visitor not on the church’s list has a name and no personId', async () => {
  const base = { bookId: 'b1', title: 'Knowing God', out: '2026-11-10', due: '2026-12-01', back: '', note: '' };
  await cannot(db.admin.doc('loans/l30').set(Object.assign({}, base, { personId: 'p14', name: 'Tim Jacobs' })));
  await cannot(db.admin.doc('loans/l30').set(Object.assign({}, base, { personId: 'p14', name: 'Tim Jacobs', mobile: '123' })));
  await can(db.rosters.doc('loans/l31').set(Object.assign({}, base, { personId: '', name: 'Jane Visitor', mobile: '072 555 0101', visitor: true })));
  await cannot(db.rosters.doc('loans/l32').set(Object.assign({}, base, { personId: '', name: '', mobile: '072 555 0101', visitor: true })));
  await cannot(db.rosters.doc('loans/l32').set(Object.assign({}, base, { personId: '', name: 'No visitor mark', mobile: '072 555 0101' })));
  await can(db.rosters.doc('loans/l31').update({ back: '2026-11-20', mobile: '' }));   // the number is cleared when it comes back
  await cannot(read(db.member, 'loans/l31')); await can(db.rosters.doc('loans/l31').delete());
});
await t('library: covers and the policy are read by everyone signed in; librarians (and the Senior Pastor, for the policy) write them', async () => {
  const pic = { data: 'data:image/jpeg;base64,AAAA', updatedAt: '2026-11-11 10:00' };
  await can(db.rosters.doc('covers/b1').set(pic)); await can(read(db.member, 'covers/b1')); await cannot(read(stranger, 'covers/b1'));
  await cannot(db.member.doc('covers/b1').set(pic)); await cannot(rector.doc('covers/b1').set(pic));
  await cannot(db.admin.doc('covers/b1').set(Object.assign({ extra: 1 }, pic))); await cannot(db.admin.doc('covers/b1').set({ data: 'x'.repeat(200001) }));
  const pol = { text: 'Books are lent for three weeks.', updatedAt: '2026-11-11 10:00', by: 'Sipho' };
  await can(db.rosters.doc('libraryPolicy/policy').set(pol)); await can(rector.doc('libraryPolicy/policy').update({ text: 'Three weeks, then please renew.' }));
  await can(read(db.member, 'libraryPolicy/policy')); await cannot(read(stranger, 'libraryPolicy/policy'));
  await cannot(db.member.doc('libraryPolicy/policy').set(pol)); await cannot(db.pastor.doc('libraryPolicy/policy').set(pol));
  await cannot(db.admin.doc('libraryPolicy/other').set(pol)); await cannot(db.admin.doc('libraryPolicy/policy').set(Object.assign({ secret: 1 }, pol)));
  await can(db.admin.doc('libraryPolicy/policy').set(Object.assign({ name: 'Policy.pdf', type: 'application/pdf', data: 'JVBERi0x' }, pol)));
  await can(db.rosters.doc('covers/b1').delete());
});
await t('library: the Senior Pastor may choose any number of librarians, record the review date, and change nothing else in settings', async () => {
  // (Andile also has the "settings" tick, which allows every change: take it away for this test)
  const roleOf = async can => env.withSecurityRulesDisabled(async ctx => { await ctx.firestore().doc('roles/andile@example.com').update({ can }); });
  await roleOf([]);
  const reviewed = new Date().toISOString();
  await can(rector.doc('settings/church').update({ librarianIds: ['p05', 'p14', 'p15', 'p40'], librarianReviewedAt: reviewed }));
  await can(db.member.doc('books/b1').update({ title: 'Updated by a third librarian' }));
  await can(read(db.member, 'loans/l15'));
  await can(db.member.doc('covers/b2').set({ data: 'data:image/jpeg;base64,AAAA', updatedAt: reviewed }));
  await cannot(rector.doc('settings/church').update({ librarianIds: ['p05'], name: 'Another church' }));
  await cannot(db.pastor.doc('settings/church').update({ librarianIds: ['p02'] }));
  await cannot(db.member.doc('settings/church').update({ librarianIds: ['p14'] }));
  await can(db.admin.doc('settings/church').update({ librarianIds: ['p05'] }));
  await can(db.admin.doc('settings/church').update({ librarianReviewedAt: new Date().toISOString() }));
  await can(rector.doc('settings/church').update({ librarianIds: ['p05'], librarianReviewedAt: new Date().toISOString() }));
  await roleOf(['settings', 'access', 'people', 'idnumbers', 'leave', 'rosters', 'privacy', 'import', 'words']);
});
await t('… and a librarian or Senior Pastor is only one while the settings say so', async () => {
  await env.withSecurityRulesDisabled(async ctx => { await ctx.firestore().doc('settings/church').update({ seniorPastorId: firebase.firestore.FieldValue.delete(), librarianIds: firebase.firestore.FieldValue.delete() }); });
  await cannot(read(rector, 'archive/ar5')); await cannot(list(rector.collection('archive'))); await cannot(read(rector, 'archive/ar3'));
  await cannot(db.rosters.doc('books/b9').set({ title: 'X', copies: 1 })); await cannot(list(db.rosters.collection('loans')));
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

console.log('Attendees (Basic access, not Church Partners) and replies');
await t('attendees: Church Partners’ names but not the directory, unless Settings allows', async () => {
  await cannot(read(db.attendee, 'directory/p15')); await cannot(list(db.attendee.collection('directory')));
  await cannot(read(db.attendee, 'photos/p15'));
  await can(read(db.attendee, 'names/p15')); await can(list(db.attendee.collection('names')));
  await can(read(db.member, 'directory/p15')); await can(read(db.member, 'names/p15'));   // Church Partner access
  await can(read(db.attendee, 'people/p16'));   // their own details
  await cannot(db.attendee.doc('names/p15').set({ firstName: 'X', lastName: 'Y', preferredName: '' }));
  await can(db.admin.doc('names/p14').set({ firstName: 'Tim', lastName: 'Jacobs', preferredName: '' }));
  await cannot(db.admin.doc('names/p14').set({ firstName: 'Tim', lastName: 'Jacobs', mobile: '082' }));   // names only
  await env.withSecurityRulesDisabled(c => c.firestore().doc('settings/church').update({ attendeeCan: ['directory'] }));
  await can(read(db.attendee, 'directory/p15')); await can(read(db.attendee, 'names/p15'));
  await env.withSecurityRulesDisabled(c => c.firestore().doc('settings/church').update({ attendeeCan: [] }));
  await cannot(read(db.attendee, 'names/p15')); await cannot(read(db.attendee, 'directory/p15'));
  await env.withSecurityRulesDisabled(c => c.firestore().doc('settings/church').update({ attendeeCan: firebase.firestore.FieldValue.delete() }));
});
await t('every adult’s name, for Midweek Group leaders adding people (attendees too): names only', async () => {
  await can(db.admin.doc('pickNames/p16').set({ firstName: 'Hope', lastName: 'Visitor', preferredName: '' }));
  await cannot(db.admin.doc('pickNames/p16').set({ firstName: 'Hope', lastName: 'Visitor', mobile: '082' }));   // names only
  await can(db.pastor.doc('pickNames/p15').set({ firstName: 'Clare', lastName: 'Jacobs', preferredName: '' }));
  await cannot(db.member.doc('pickNames/p15').set({ firstName: 'X', lastName: 'Y', preferredName: '' }));
  // Tim isn't a leader yet: no names
  await cannot(read(db.member, 'pickNames/p16')); await cannot(list(db.member.collection('pickNames')));
  await cannot(db.member.doc('lifeLeaders/all').set({ ids: ['p14'] }));   // a member can't make themself a leader
  await cannot(db.admin.doc('lifeLeaders/other').set({ ids: ['p14'] }));
  await cannot(db.admin.doc('lifeLeaders/all').set({ ids: ['p14'], more: 1 }));
  await can(db.admin.doc('lifeLeaders/all').set({ ids: ['p14'] }));
  await can(read(db.member, 'pickNames/p16')); await can(list(db.member.collection('pickNames')));   // Tim leads a Midweek Group
  await cannot(read(db.member, 'lifeLeaders/all'));
  await cannot(read(db.attendee, 'pickNames/p15')); await cannot(read(db.rosters, 'pickNames/p15'));   // not leaders
  await cannot(read(db.member, 'people/p16'));   // still nothing else about Hope (the directory is open to Church Partners anyway, and Hope isn't in it)
  await can(db.pastor.doc('lifeLeaders/all').set({ ids: [] }));
  await cannot(read(db.member, 'pickNames/p16'));   // no longer a leader
});
await t('attendees: write to the Office, a minister and their Midweek Group leader; reply to a minister', async () => {
  const m = x => Object.assign({ groupId: '', audience: '', title: '', body: 'Hello', deliveredBy: ['p16'], readBy: ['p16'], fromId: 'p16', fromName: 'Hope' }, x);
  await can(db.attendee.doc('messages/a1').set(m({ kind: 'office', to: [] })));
  await can(db.attendee.doc('messages/a2').set(m({ kind: 'direct', to: ['p02'] })));                 // Thandi is a Pastor
  await cannot(db.attendee.doc('messages/a3').set(m({ kind: 'direct', to: ['p14'] })));              // not a minister
  await can(db.attendee.doc('messages/a4').set(m({ kind: 'direct', groupId: 'lg2', to: ['p15'] })));   // Clare leads her Midweek Group
  await cannot(db.attendee.doc('messages/a5').set(m({ kind: 'direct', groupId: 'lg1', to: ['p14'] })));  // a group she isn't in
  await cannot(db.attendee.doc('messages/a6').set(m({ kind: 'direct', groupId: 'lg2', to: ['p16'] })));  // not to herself
  await can(db.attendee.doc('messages/a7').set(m({ kind: 'direct', replyTo: 'ms5', to: ['p02'] })));     // a reply to a minister
  await cannot(db.attendee.doc('messages/a8').set(m({ kind: 'direct', replyTo: 'ms4', to: ['p15'] })));  // a reply to anyone else: only with "reply"
  await cannot(db.attendee.doc('messages/a9').set(m({ kind: 'care', groupId: 'cg1', to: ['p15'] })));
  await env.withSecurityRulesDisabled(c => c.firestore().doc('settings/church').update({ attendeeCan: ['reply'] }));
  await can(db.attendee.doc('messages/a10').set(m({ kind: 'direct', replyTo: 'ms4', to: ['p15'] })));
  await cannot(db.attendee.doc('messages/a11').set(m({ kind: 'office', to: [] })));                  // without "write": only receive
  await cannot(db.attendee.doc('messages/a12').set(m({ kind: 'direct', to: ['p02'] })));
  await can(db.attendee.doc('messages/a13').set(m({ kind: 'office', to: [], about: 'partnerApp' })));   // applying to be a Church Partner: the office is told
  await cannot(db.attendee.doc('messages/a14').set(m({ kind: 'direct', to: ['p02'], about: 'partnerApp' })));   // only to the office
  await cannot(db.attendee.doc('messages/a15').set(m({ kind: 'office', to: [], about: 'other' })));
  await env.withSecurityRulesDisabled(c => c.firestore().doc('settings/church').update({ attendeeCan: firebase.firestore.FieldValue.delete() }));
});
await t('replies: privately to the sender of a message that came to you', async () => {
  const m = x => Object.assign({ groupId: '', audience: 'Clare', title: 'Re: Sunday', body: 'Thanks', deliveredBy: ['p14'], readBy: ['p14'], fromId: 'p14', fromName: 'Tim' }, x);
  await can(db.member.doc('messages/r1').set(m({ kind: 'direct', replyTo: 'ms4', to: ['p15'] })));     // a Church Partner replies
  await cannot(db.member.doc('messages/r2').set(m({ kind: 'direct', replyTo: 'ms4', to: ['p01'] })));  // only to the sender
  await cannot(db.member.doc('messages/r3').set(m({ kind: 'direct', replyTo: 'ms5', to: ['p02'] })));  // a message that didn't come to him
  await cannot(db.member.doc('messages/r4').set(m({ kind: 'direct', replyTo: 'nothere', to: ['p15'] })));
  await cannot(db.member.doc('messages/r5').set(m({ kind: 'direct', replyTo: 'ms4', to: ['p15', 'p16'] })));   // one person only
  await can(read(db.member, 'messages/r1')); await cannot(read(db.attendee, 'messages/r1'));   // others in the group don't see it
});
await t('what attendees may do: Administrators and the Senior Pastor set it; requirements to become a Church Partner', async () => {
  await can(db.admin.doc('settings/church').update({ attendeeCan: ['names'] }));
  await cannot(db.pastor.doc('settings/church').update({ attendeeCan: ['names', 'write'] }));
  await env.withSecurityRulesDisabled(c => c.firestore().doc('settings/church').update({ seniorPastorId: 'p02' }));
  await can(db.pastor.doc('settings/church').update({ attendeeCan: ['names', 'write'] }));
  await cannot(db.pastor.doc('settings/church').update({ attendeeCan: ['everything'] }));
  await cannot(db.pastor.doc('settings/church').update({ churchName: 'Mine' }));
  await can(db.pastor.doc('partnerInfo/requirements').set({ text: 'Be 18 or older', link: '', updatedAt: 'x', by: 'Thandi' }));
  await cannot(db.member.doc('partnerInfo/requirements').set({ text: 'x' }));
  await cannot(db.pastor.doc('partnerInfo/other').set({ text: 'x' }));
  await cannot(db.pastor.doc('partnerInfo/requirements').set({ text: 'x', extra: 1 }));
  await can(read(db.attendee, 'partnerInfo/requirements')); await cannot(read(stranger, 'partnerInfo/requirements'));
  await can(db.admin.doc('partnerInfo/requirements').delete());
  await env.withSecurityRulesDisabled(c => c.firestore().doc('settings/church').update({ seniorPastorId: firebase.firestore.FieldValue.delete(), attendeeCan: firebase.firestore.FieldValue.delete() }));
});

console.log('Sign-in codes and PINs (members with no email)');
{
  // A phone using a code (anonymous), and an account with a number-and-PIN address (<login>-<v>@pin.church-hub.invalid),
  // whose access entry is roles/{that address}
  const anon = uid => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } }).firestore();
  const PIN = '@pin.church-hub.invalid', addr = (login, v) => login + '-' + (v || 1) + PIN;
  const pin = (uid, login, v) => env.authenticatedContext(uid, { email: addr(login, v), email_verified: false, firebase: { sign_in_provider: 'password' } }).firestore();
  const DAY = 864e5, inv = (pid, extra) => Object.assign({ personId: pid, name: 'Tim J.', role: 'member', expires: Date.now() + 14 * DAY, by: 'p01', createdAt: 'x' }, extra || {});
  const entry = (uid, pid, code, login, v, extra) => Object.assign({ role: 'member', roles: ['member'], personId: pid, also: [], people: {}, invite: code, name: 'Tim J.', linkedAt: 'x', login, pinV: v, uid }, extra || {});
  // The claim: the access entry, pinLogins/{login} and the spent code, in one write (path = whose entry it writes)
  const link = (d, uid, code, pid, login, v, extra, plExtra, path) => {
    const b = d.batch();
    b.set(d.doc('roles/' + (path || addr(login, v))), entry(uid, pid, code, login, v, extra));
    b.set(d.doc('pinLogins/' + login), Object.assign({ v, uid }, plExtra || {}));
    b.update(d.doc('invites/' + code), { usedBy: uid, usedAt: 'x' });
    return b.commit();
  };
  const seedInvites = codes => env.withSecurityRulesDisabled(async c => { for (const [code, data] of Object.entries(codes)) await c.firestore().doc('invites/' + code).set(data); });
  await t('only an Administrator makes or lists codes, and only for Member access', async () => {
    await can(db.admin.doc('invites/AAAA2222').set(inv('p14', { mobile: '082 555 0101', dial: '27' })));
    await cannot(db.admin.doc('invites/AAAA3333').set(inv('p14', { role: 'admin' })));
    await cannot(db.admin.doc('invites/AAAA3334').set(inv('p14', { usedBy: 'x' })));
    for (const r of ['pastor', 'kids', 'rosters', 'member']) await cannot(db[r].doc('invites/AAAA4444').set(inv('p14')));
    await can(list(db.admin.collection('invites').where('personId', '==', 'p14')));
    await cannot(list(db.pastor.collection('invites'))); await cannot(list(anon('anon-0').collection('invites')));
  });
  await t('the church’s calling code: anyone may read it, only an Administrator writes it', async () => {
    await can(db.admin.doc('pinLogins/dial').set({ dial: '27' }));
    await cannot(db.admin.doc('pinLogins/dial').set({ dial: '27', v: 1 }));
    await cannot(db.pastor.doc('pinLogins/dial').set({ dial: '1' })); await cannot(anon('anon-0').doc('pinLogins/dial').set({ dial: '1' }));
    await can(read(nobody, 'pinLogins/dial'));
  });
  await t('a phone using a code sees nothing but that code (fetched by its exact id) and pinLogins by number', async () => {
    const d = anon('anon-1');
    await can(read(d, 'invites/AAAA2222')); await can(read(d, 'pinLogins/27825550101'));
    for (const path of ['settings/church', 'people/p14', 'directory/p15', 'roles/tim@example.com']) await cannot(read(d, path));
    await cannot(read(nobody, 'invites/AAAA2222')); await cannot(list(nobody.collection('pinLogins')));
    await cannot(link(d, 'anon-1', 'AAAA2222', 'p14', '27825550101', 1));   // a code alone (no PIN) links nothing
  });
  await t('with a PIN the account makes its own Member entry, records its number and spends the code, in one write – then reads what a Member reads', async () => {
    const d = pin('pin-1', '27825550101');
    await cannot(d.doc('roles/' + addr('27825550101')).set(entry('pin-1', 'p14', 'AAAA2222', '27825550101', 1)));   // without spending the code or the number
    await cannot(d.doc('invites/AAAA2222').update({ usedBy: 'pin-1', usedAt: 'x' }));        // spending it without the entry
    await cannot(d.doc('pinLogins/27825550101').set({ v: 1, uid: 'pin-1' }));                // the number without the entry
    await cannot(link(d, 'pin-1', 'AAAA2222', 'p14', '27825550101', 2));                      // a version its address doesn't have
    await cannot(link(d, 'pin-1', 'AAAA2222', 'p14', '27825559999', 1));                      // another number
    await cannot(link(d, 'pin-1', 'AAAA2222', 'p14', '27825550101', 1, {}, {}, 'tim@example.com'));   // someone else's entry
    await can(link(d, 'pin-1', 'AAAA2222', 'p14', '27825550101', 1));
    await can(read(d, 'roles/' + addr('27825550101'))); await can(read(d, 'settings/church')); await can(read(d, 'people/p14'));
    await cannot(read(d, 'details/p15')); await cannot(read(d, 'roles/tim@example.com'));
    await cannot(d.doc('roles/' + addr('27825550101')).update({ role: 'admin' })); await cannot(d.doc('roles/' + addr('27825550101')).delete());
    await cannot(d.doc('pinLogins/27825550101').set({ v: 5, uid: 'pin-1' }));                // only in the write that makes the entry
  });
  await t('a code works once, before it expires, for its own person, and gives only Member access', async () => {
    await cannot(link(pin('pin-3', '27820000003'), 'pin-3', 'AAAA2222', 'p14', '27820000003', 1));   // used already
    await seedInvites({ BBBB2222: inv('p14', { expires: Date.now() - DAY }), CCCC2222: inv('p14'), DDDD2222: inv('p14'), EEEE2222: inv('p14'), FFFF2222: inv('p14'), GGGG2222: inv('p14') });
    await cannot(link(pin('pin-4', '27820000004'), 'pin-4', 'BBBB2222', 'p14', '27820000004', 1));                        // expired
    await cannot(link(pin('pin-5', '27820000005'), 'pin-5', 'CCCC2222', 'p15', '27820000005', 1));                        // another person
    await cannot(link(pin('pin-6', '27820000006'), 'pin-6', 'DDDD2222', 'p14', '27820000006', 1, { role: 'admin' }));     // more than Member
    await cannot(link(pin('pin-7', '27820000007'), 'pin-7', 'EEEE2222', 'p14', '27820000007', 1, { roles: ['member', 'pastor'] }));
    await cannot(link(pin('pin-8', '27820000008'), 'pin-8', 'FFFF2222', 'p14', '27820000008', 1, { also: ['p15'] }));    // sharing with someone else
    await cannot(link(pin('pin-9', '27820000009'), 'pin-9', 'GGGG2222', 'p14', '27820000009', 1, { uid: 'pin-10' }));    // another account's id
    await cannot(link(pin('pin-9', '27820000009'), 'pin-9', 'GGGG2222', 'p14', '27820000009', 1, {}, { uid: 'pin-10' })); // the number for another account
    await cannot(link(as('member'), 'uid-member', 'GGGG2222', 'p14', '27820000011', 1));   // an email sign-in isn't a PIN account
  });
  await t('a number in use moves to a new PIN only for the same person, or once the old one is switched off', async () => {
    await seedInvites({ HHHH2222: inv('p15'), JJJJ2222: inv('p14'), KKKK2222: inv('p14') });
    await cannot(link(pin('pin-12', '27825550101', 2), 'pin-12', 'HHHH2222', 'p15', '27825550101', 2));   // Tim's number, for Clare
    await cannot(link(pin('pin-13', '27825550101', 1), 'pin-13', 'JJJJ2222', 'p14', '27825550101', 1));   // the version must go up
    await can(link(pin('pin-13', '27825550101', 2), 'pin-13', 'JJJJ2222', 'p14', '27825550101', 2));      // Tim again (a forgotten PIN)
    await can(db.admin.doc('roles/' + addr('27825550101', 2)).delete());                                  // switched off by the office
    await can(link(pin('pin-14', '27825550101', 3), 'pin-14', 'HHHH2222', 'p15', '27825550101', 3));      // now free for someone else
    await can(link(pin('pin-15', 'c482913'), 'pin-15', 'KKKK2222', 'p14', 'c482913', 1));                   // a church number
    await can(read(pin('pin-15', 'c482913'), 'settings/church'));
  });
  await t('the audit log takes a PIN account’s entries under its own address', async () => {
    const d = pin('pin-1', '27825550101');
    await can(d.doc('audit/code-1').set({ action: 'Signed in', byEmail: addr('27825550101'), ts: ts() }));
    await cannot(d.doc('audit/code-2').set({ action: 'Signed in', byEmail: 'tim@example.com', ts: ts() }));
  });
  await t('an Administrator sees and switches off PIN sign-ins; then that account sees nothing', async () => {
    await can(list(db.admin.collection('roles').where('personId', '==', 'p14')));
    await cannot(list(db.member.collection('roles').where('personId', '==', 'p14'))); await cannot(read(db.member, 'roles/' + addr('27825550101')));
    await can(db.admin.doc('roles/' + addr('27825550101')).delete());
    await cannot(read(pin('pin-1', '27825550101'), 'settings/church'));
    await cannot(read(pin('pin-99', '27820000099'), 'settings/church'));   // an address of the right shape with no entry
  });
  await t('people who sign in with email are unchanged by PINs', async () => {
    await can(read(db.member, 'roles/tim@example.com')); await cannot(read(db.member, 'roles/linda@example.com'));
    await cannot(read(impostor, 'settings/church'));
  });
}

// ---------- Community board and Marketplace (js/community.js): Church Partners and staff, a keeper approves each one ----------
const DAY = 86400000, NOW = Date.now();
const notice = x => Object.assign({ kind: 'need', title: 'I need a plumber', body: 'Leaking geyser', phone: '', personId: 'p14', name: 'Tim', status: 'waiting', endsAt: NOW + 30 * DAY, renews: 0, note: '', by: '', decidedAt: 0, doneAt: 0, reports: [], createdAt: 'x', updatedAt: 'x' }, x);
const listing = x => Object.assign({ kind: 'sale', title: 'Pine bookshelf', body: '', personId: 'p14', name: 'Tim', status: 'waiting', endsAt: NOW + 30 * DAY, renews: 0, note: '', by: '', decidedAt: 0, doneAt: 0, reports: [],
  price: 450, offer: false, condition: 'good', category: 'furniture', area: 'Hilton', photos: 1, thumb: 'data:image/jpeg;base64,AAAA', createdAt: 'x', updatedAt: 'x' }, x);
const about = (part, id, to, from, fromId) => ({ kind: 'direct', groupId: '', audience: 'Tim', some: false, replyTo: '', about: part, aboutId: id, title: 'About your notice', body: 'I can help', fromId, fromName: from, to: [to], deliveredBy: [fromId], readBy: [fromId] });
await t('Community board: Church Partners pin notices, which wait for a keeper', async () => {
  await can(db.member.doc('board/b1').set(notice()));
  await cannot(db.member.doc('board/b2').set(notice({ status: 'live' })));                 // not put up by themselves
  await cannot(db.member.doc('board/b3').set(notice({ personId: 'p15' })));               // not as someone else
  await cannot(db.attendee.doc('board/b4').set(notice({ personId: 'p16' })));             // attendees: not on the board
  await cannot(db.member.doc('board/b5').set(notice({ endsAt: NOW + 90 * DAY })));        // 30 days at a time
  await cannot(db.member.doc('board/b6').set(notice({ kind: 'advert' })));
  await cannot(db.member.doc('board/b7').set(notice({ secret: 1 })));
  await can(read(db.member, 'board/b1')); await can(read(db.pastor, 'board/b1')); await can(read(db.admin, 'board/b1'));
  await cannot(read(db.rosters, 'board/b1')); await cannot(read(db.attendee, 'board/b1'));    // waiting: only its poster and the keepers
  await cannot(db.rosters.doc('board/b1').update({ status: 'live', by: 'Sipho', decidedAt: NOW, endsAt: NOW + 30 * DAY, updatedAt: 'y' }));   // not a keeper
});
await t('Community board: a keeper approves; everyone else sees what is live', async () => {
  await can(db.pastor.doc('board/b1').update({ status: 'live', by: 'Thandi', decidedAt: NOW, endsAt: NOW + 30 * DAY, updatedAt: 'y' }));
  await can(read(db.rosters, 'board/b1')); await can(read(db.kids, 'board/b1')); await cannot(read(db.attendee, 'board/b1'));
  await can(list(db.rosters.collection('board').where('status', '==', 'live'))); await can(list(db.rosters.collection('board').where('status', '==', 'done')));
  await can(list(db.rosters.collection('board').where('personId', '==', 'p05'))); await cannot(list(db.rosters.collection('board')));
  await can(list(db.pastor.collection('board'))); await cannot(list(db.attendee.collection('board').where('status', '==', 'live')));
  await cannot(db.pastor.doc('board/b1').update({ title: 'Something else', updatedAt: 'y' }));   // keepers decide; they don't rewrite
  await cannot(db.pastor.doc('board/b1').update({ status: 'live', endsAt: NOW + 200 * DAY, updatedAt: 'y' }));
});
await t('Community board: reports, renewing, sorted and taking down', async () => {
  await can(db.rosters.doc('board/b1').update({ reports: ['p05'], updatedAt: 'z' }));
  await cannot(db.rosters.doc('board/b1').update({ reports: ['p05', 'p01'], updatedAt: 'z' }));   // only themselves
  await cannot(db.rosters.doc('board/b1').update({ title: 'Mine now', updatedAt: 'z' }));
  await cannot(db.attendee.doc('board/b1').update({ reports: ['p05', 'p16'], updatedAt: 'z' }));
  await can(db.member.doc('board/b1').update({ renews: 1, endsAt: NOW + 30 * DAY, updatedAt: 'r' }));
  await cannot(db.member.doc('board/b1').update({ renews: 2, endsAt: NOW + 300 * DAY, updatedAt: 'r' }));
  await cannot(db.member.doc('board/b1').update({ title: 'Changed while live', updatedAt: 'r' }));     // a change goes back to the keepers
  await can(db.member.doc('board/b1').update({ title: 'I need a plumber today', status: 'waiting', reports: [], updatedAt: 'r' }));
  await can(db.admin.doc('board/b1').update({ status: 'live', by: 'Linda', decidedAt: NOW, endsAt: NOW + 30 * DAY, updatedAt: 'y' }));
  await can(db.member.doc('board/b1').update({ status: 'done', doneAt: NOW, updatedAt: 'd' }));
  await can(db.member.doc('board/b8').set(notice({ title: 'Lift to church' })));
  await cannot(db.rosters.doc('board/b8').delete()); await can(db.pastor.doc('board/b8').delete());
  await can(db.member.doc('board/b9').set(notice({ title: 'Mine to take down' }))); await can(db.member.doc('board/b9').delete());
});
await t('Community board: the keepers the church chooses (settings keepers.board) replace the first ones', async () => {
  await env.withSecurityRulesDisabled(async ctx => { await ctx.firestore().doc('settings/church').update({ keepers: { board: ['p05'] }, rosterExtra: ['p15'] }); });
  await can(db.member.doc('board/k1').set(notice({ title: 'Choose me' })));
  await can(read(db.rosters, 'board/k1')); await cannot(read(db.pastor, 'board/k1'));
  await cannot(db.pastor.doc('board/k1').update({ status: 'live', by: 'Thandi', decidedAt: NOW, endsAt: NOW + 30 * DAY, updatedAt: 'y' }));
  await can(db.rosters.doc('board/k1').update({ status: 'change', note: 'Please add which suburb', by: 'Sipho', decidedAt: NOW, updatedAt: 'y' }));
  await env.withSecurityRulesDisabled(async ctx => { await ctx.firestore().doc('settings/church').update({ keepers: { market: [] } }); });
  await cannot(read(db.rosters, 'board/k1'));   // back to the first keepers for the board
  await can(read(db.pastor, 'board/k1'));
  await env.withSecurityRulesDisabled(async ctx => { await ctx.firestore().doc('settings/church').update({ keepers: firebase.firestore.FieldValue.delete(), rosterExtra: firebase.firestore.FieldValue.delete() }); });
});
await t('Marketplace: Church Partners only; a keeper approves every listing; photos follow the listing', async () => {
  await can(db.member.doc('market/m1').set(listing()));
  await cannot(db.attendee.doc('market/m2').set(listing({ personId: 'p16' })));
  await cannot(db.member.doc('market/m3').set(listing({ kind: 'auction' })));
  await cannot(db.member.doc('market/m4').set(listing({ price: -5 })));
  await cannot(db.member.doc('market/m5').set(listing({ phone: '082' })));   // contact through Messages, not a phone number
  await can(db.member.doc('marketPhotos/m1').set({ data: ['data:image/jpeg;base64,AAAA'], updatedAt: 'x' }));
  await cannot(db.member.doc('marketPhotos/m1').set({ data: ['a', 'b', 'c', 'd'], updatedAt: 'x' }));
  await cannot(db.rosters.doc('marketPhotos/m1').set({ data: ['a'], updatedAt: 'x' }));
  await cannot(read(db.rosters, 'market/m1')); await cannot(read(db.rosters, 'marketPhotos/m1')); await can(read(db.pastor, 'marketPhotos/m1'));
  await can(db.admin.doc('market/m1').update({ status: 'live', by: 'Linda', decidedAt: NOW, endsAt: NOW + 30 * DAY, updatedAt: 'y' }));
  await can(read(db.rosters, 'market/m1')); await can(read(db.rosters, 'marketPhotos/m1'));
  await cannot(read(db.attendee, 'market/m1')); await cannot(read(db.attendee, 'marketPhotos/m1'));
  await cannot(db.member.doc('marketPhotos/m1').set({ data: ['data:image/jpeg;base64,BBBB'], updatedAt: 'x' }));   // new photos: back to a keeper first
  await can(db.member.doc('market/m1').update({ price: 400, updatedAt: 'p' }));       // a lower price stays up
  await cannot(db.member.doc('market/m1').update({ price: 900, updatedAt: 'p' }));
  await can(db.member.doc('market/m1').update({ status: 'done', doneAt: NOW, updatedAt: 'd' }));
  await cannot(db.rosters.doc('marketPhotos/m1').delete()); await can(db.member.doc('marketPhotos/m1').delete()); await can(db.member.doc('market/m1').delete());
});
await t('Messages about a notice or listing: privately to its poster, while it is live (keepers about their decision)', async () => {
  await env.withSecurityRulesDisabled(async ctx => { await ctx.firestore().doc('board/live1').set(notice({ status: 'live' })); await ctx.firestore().doc('board/wait1').set(notice()); });
  await can(db.rosters.collection('messages').add(about('board', 'live1', 'p14', 'Sipho', 'p05')));
  await cannot(db.rosters.collection('messages').add(about('board', 'wait1', 'p14', 'Sipho', 'p05')));   // not live yet
  await cannot(db.rosters.collection('messages').add(about('board', 'live1', 'p15', 'Sipho', 'p05')));   // only to its poster
  await cannot(db.attendee.collection('messages').add(about('board', 'live1', 'p14', 'Hope', 'p16')));
  await can(db.pastor.collection('messages').add(about('board', 'wait1', 'p14', 'Thandi', 'p02')));     // a keeper about their decision
  await cannot(db.rosters.collection('messages').add(Object.assign(about('board', 'live1', 'p14', 'Sipho', 'p05'), { about: 'secrets' })));
});

await t('Midweek Groups online: this week’s links – posted by leaders and co-leaders, read by the group (or everyone when open)', async () => {
  const st = (o) => Object.assign({ groupId: 'lg3', groupName: 'Wednesday study', date: '2026-11-25', time: '19:00', meet: 'https://meet.google.com/aaa-bbbb-ccc', notes: 'https://docs.google.com/document/d/1', topic: 'Romans 8', open: false, showFrom: 0, to: ['p15', 'p14', 'p05'], fromId: 'p15', fromName: 'Clare', createdAt: 'x', updatedAt: 'x' }, o);
  await can(read(db.member, 'studies/st1')); await cannot(read(db.rosters, 'studies/st1')); await can(read(db.pastor, 'studies/st1'));   // the group, Administrators and Pastors
  await can(read(db.rosters, 'studies/st2')); await can(read(db.attendee, 'studies/st2'));                                            // open to the whole church
  await can(list(db.member.collection('studies').where('to', 'array-contains', 'p14'))); await can(list(db.rosters.collection('studies').where('open', '==', true)));
  await cannot(list(db.rosters.collection('studies')));
  await can(db.member.doc('studies/n1').set(st({ fromId: 'p14', fromName: 'Tim' })));                    // Tim is a co-leader of lg3
  await can(db.member.doc('studies/n2').set(st({ groupId: 'lg1', groupName: 'x', to: ['p14', 'p15'], fromId: 'p14' })));   // and leads lg1
  await cannot(db.rosters.doc('studies/n3').set(st({ fromId: 'p05' })));                                  // Sipho is lg3's host, not a leader
  await cannot(db.attendee.doc('studies/n4').set(st({ groupId: 'lg2', to: ['p15', 'p16'], fromId: 'p16' })));   // Hope is only a member of lg2
  await cannot(db.member.doc('studies/n5').set(st({ fromId: 'p14', to: ['p15', 'p02'] })));              // someone not in the group
  await cannot(db.member.doc('studies/n6').set(st({ fromId: 'p14', meet: 'javascript:alert(1)' })));       // only web links
  await cannot(db.member.doc('studies/n7').set(st({ fromId: 'p14', meet: '', notes: '' })));               // at least one link
  await cannot(db.member.doc('studies/n8').set(st({ fromId: 'p15' })));                                   // not in someone else's name
  await cannot(db.member.doc('studies/n9').set(st({ fromId: 'p14', secret: 1 })));
  await can(db.pastor.doc('studies/n10').set(st({ fromId: 'p02', fromName: 'Thandi' })));                  // Administrators and Pastors
  await can(db.member.doc('studies/n1').update({ notes: 'https://docs.google.com/document/d/2' }));
  await cannot(db.member.doc('studies/n1').update({ groupId: 'lg1' }));
  await can(db.member.doc('studies/n1').delete()); await cannot(db.rosters.doc('studies/n10').delete());
  // The message to the group (kind life, about study), which may wait for the day (showFrom)
  const m = (o) => Object.assign({ kind: 'life', groupId: 'lg3', audience: 'Wednesday study', about: 'study', aboutId: 'n10', title: 'Wednesday study', body: 'Join', fromId: 'p14', fromName: 'Tim', to: ['p15', 'p14', 'p05'], deliveredBy: [], readBy: [], showFrom: 1795000000000, createdAt: 'x', updatedAt: 'x' }, o);
  await can(db.member.doc('messages/st1').set(m({})));                                                     // a co-leader may send it
  await cannot(db.rosters.doc('messages/st2').set(m({ fromId: 'p05' })));
  await cannot(db.member.doc('messages/st3').set(m({ to: ['p02'] })));
  await cannot(db.member.doc('messages/st4').set(m({ kind: 'care' })));
  await cannot(db.member.doc('messages/st5').set(m({ showFrom: 'tomorrow' })));
  await cannot(db.member.doc('messages/st6').set(m({ about: '', kind: 'life' })));                         // without about: only the leaders (mayWriteTo)
});

await t('Events: organisers put them up; people sign up themselves; reminders to their own inbox; the email robot notes what it sent', async () => {
  const ev = (o) => Object.assign({ title: 'Men’s breakfast', about: '', date: '2026-11-28', time: '07:30', end: '', place: 'Hall', address: '', who: 'all', signup: true, closes: '', guests: 2, email: true, status: 'live', byId: 'p02', byName: 'Thandi', createdAt: 'x', updatedAt: 'x' }, o);
  const su = (ev, by, o) => Object.assign({ eventId: ev, by: by, people: [by], names: ['A'], guests: 0, email: '', lang: 'en', mailed: [], createdAt: 'x', updatedAt: 'x' }, o);
  await can(db.pastor.doc('events/e1').set(ev({})));                                                       // Pastors and Administrators organise (until the church chooses)
  await can(db.admin.doc('events/e2').set(ev({ who: 'partners' })));
  await cannot(db.member.doc('events/e3').set(ev({})));                                                    // not a Church Partner who isn't an organiser
  await cannot(db.rosters.doc('events/e3').set(ev({})));
  await cannot(db.pastor.doc('events/e4').set(ev({ secret: 1 }))); await cannot(db.pastor.doc('events/e4').set(ev({ who: 'friends' }))); await cannot(db.pastor.doc('events/e4').set(ev({ guests: 99 })));
  await can(read(db.attendee, 'events/e1')); await cannot(read(db.attendee, 'events/e2')); await can(read(db.member, 'events/e2'));   // attendees: events for everyone only
  await can(list(db.attendee.collection('events').where('who', '==', 'all'))); await cannot(list(db.attendee.collection('events'))); await can(list(db.member.collection('events')));
  // Signing up
  await can(db.member.doc('eventSignups/e1_p14').set(su('e1', 'p14', { people: ['p14', 'p15'], guests: 1, email: 'tim@example.com' })));
  await cannot(db.member.doc('eventSignups/e1_p15').set(su('e1', 'p15')));                                 // not in someone else's name
  await cannot(db.member.doc('eventSignups/x_p14').set(su('e1', 'p14')));                                  // the id is event_person
  await cannot(db.attendee.doc('eventSignups/e2_p16').set(su('e2', 'p16')));                               // an event for Church Partners
  await can(db.attendee.doc('eventSignups/e1_p16').set(su('e1', 'p16')));
  await cannot(db.rosters.doc('eventSignups/e1_p05').set(su('e1', 'p05', { guests: 3 })));                 // more guests than allowed
  await cannot(db.rosters.doc('eventSignups/e1_p05').set(su('e1', 'p05', { mailed: ['3'] })));
  await can(read(db.member, 'eventSignups/e1_p14')); await cannot(read(db.attendee, 'eventSignups/e1_p14')); await can(read(db.pastor, 'eventSignups/e1_p14'));
  await can(list(db.member.collection('eventSignups').where('by', '==', 'p14'))); await cannot(list(db.attendee.collection('eventSignups')));
  await can(db.member.doc('eventSignups/e1_p14').update({ guests: 2 })); await cannot(db.member.doc('eventSignups/e1_p14').update({ mailed: ['3'] }));
  // A reminder: from a person to their own inbox, about an event; the organisers to everyone coming
  const rm = (o) => Object.assign({ kind: 'event', about: 'remind', aboutId: 'e1', audience: 'Men’s breakfast', title: 'Reminder', body: 'In 3 days', fromId: 'p14', fromName: 'Men’s breakfast', to: ['p14'], deliveredBy: [], readBy: [], createdAt: 'x', updatedAt: 'x' }, o);
  await can(db.member.doc('messages/er_e1_p14_3').set(rm({})));
  await cannot(db.member.doc('messages/er_x').set(rm({ to: ['p15'] })));                                  // only to oneself
  await cannot(db.member.doc('messages/er_y').set(rm({ aboutId: 'nope' })));                              // about a real event
  await cannot(db.member.doc('messages/er_z').set(rm({ about: 'event', to: ['p15', 'p16'] })));           // only organisers write to everyone coming
  await can(db.pastor.doc('messages/ev1').set(rm({ about: 'event', fromId: 'p02', to: ['p14', 'p15', 'p16'] })));
  await can(db.member.doc('messages/er_e1_p14_3').update({ readBy: ['p14'] }));
  await cannot(db.member.doc('messages/er_e1_p14_3').set(rm({ body: 'changed' })));                       // never written twice
  // The email robot reads events and sign-ups and notes which reminders went – nothing else
  await can(list(robotDb.collection('events'))); await can(list(robotDb.collection('eventSignups')));
  await can(robotDb.doc('eventSignups/e1_p14').update({ mailed: ['3'], updatedAt: 'y' }));
  await cannot(robotDb.doc('eventSignups/e1_p14').update({ email: 'x@example.com' }));
  await cannot(robotDb.doc('events/e1').update({ title: 'x' }));
  await cannot(db.member.doc('eventSignups/e1_p14').update({ guests: 1, mailed: [] }));                    // what the robot noted stays
  // Cancelling closes sign-up; taking people off the list; deleting
  await can(db.pastor.doc('events/e1').update({ status: 'cancelled' }));
  await cannot(db.rosters.doc('eventSignups/e1_p05').set(su('e1', 'p05')));
  await can(db.pastor.doc('eventSignups/e1_p16').delete()); await can(db.member.doc('eventSignups/e1_p14').delete());
  await cannot(db.member.doc('events/e1').delete()); await can(db.pastor.doc('events/e1').delete());
});

await t('the parts not built yet (Subscription records) are closed to everyone', async () => {
  for (const c of ['subscription/church']) {
    await cannot(db.admin.doc(c).set({ a: 1 })); await cannot(read(db.admin, c)); await cannot(read(db.member, c));
  }
});
await t('anything not listed is closed', async () => { await cannot(db.admin.doc('secrets/x').set({ a: 1 })); await cannot(read(db.admin, 'secrets/x')); });

await env.cleanup();
console.log(failed ? `\n${failed} rule test(s) FAILED, ${passed} passed` : `\nAll ${passed} rule tests passed`);
process.exit(failed ? 1 : 0);
