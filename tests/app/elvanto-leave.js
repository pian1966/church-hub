/* Church Hub – browser test, part: approved leave sent to Elvanto, and a staff member’s leave.
 * One part of tests/app.test.js, which starts the browser and runs every part in turn: node tests/app.test.js */
'use strict';
module.exports = async function (ctx) {
  const { check, finish, seedDocs, session } = ctx;
  let docs, s;
  console.log('Elvanto updates (Administrator):');
  s = await session('linda.pillay@example.com', seedDocs());
  await s.go('leave/elvanto');
  check((await s.text()).includes('Unavailable Volunteers'), 'Leave → Elvanto explains what happens');
  await s.page.click('[data-act="leave:approvals"]').catch(() => {});
  await s.go('leave/approvals'); await s.page.click('[data-act="leave:decide"][data-d="Approved"]'); await s.settle();
  docs = await s.docsNow();
  check(!Object.keys(docs).some(k => k.startsWith('elvantoSync/')), 'while switched off, nothing is sent to Elvanto (Leave Manager still does it)');
  await s.go('leave/elvanto');
  await s.page.check('#el-on'); await s.page.fill('#el-url', 'https://example.elvanto.eu/'); await s.page.fill('#el-remail', 'Robot@Example.com'); await s.page.fill('#el-ruid', 'R1');
  await s.page.click('[data-act="leave:elsave"]'); await s.settle();
  docs = await s.docsNow();
  check(docs['settings/church'].elvanto.on === true && docs['settings/church'].elvanto.url === 'https://example.elvanto.eu' && docs['roles/robot@example.com'].role === 'robot' && docs['roles/robot@example.com'].uid === 'R1', 'switching on saves the address and gives the robot its limited sign-in');
  await s.go('leave/approvals'); await s.page.click('[data-act="leave:decide"][data-d="Approved"]'); await s.settle();
  docs = await s.docsNow();
  const ej = Object.keys(docs).filter(k => k.startsWith('elvantoSync/')).map(k => docs[k]);
  check(ej.length === 1 && ej[0].want === 'Unavailable' && ej[0].status === 'Waiting' && ej[0].name && !('reason' in ej[0]) && !('type' in ej[0]), 'approving leave queues it for Elvanto (name and dates only – no kind of leave or reason)');
  await s.go('leave/elvanto'); check((await s.text()).includes('Waiting for the robot'), 'the entry shows as waiting for the robot');
  await finish(s);

  console.log('Elvanto updates (staff member cancelling, and the robot):');
  s = await session('lerato.khumalo@example.com', seedDocs({ elvanto: true }));
  await s.go('leave'); await s.page.click('[data-act="leave:cancel"][data-id="L103"]'); await s.page.click('[data-act="leave:cancel"][data-id="L103"]'); await s.settle();
  docs = await s.docsNow();
  check(docs['leaveRequests/L103'].status === 'Cancelled' && docs['elvantoSync/L103'].want === 'Removed' && docs['elvantoSync/L103'].status === 'Waiting' && docs['elvantoSync/L103'].have, 'cancelling approved leave asks the robot to remove it from Elvanto');
  await finish(s);
  // The robot's access, through the same rules – in a page where the app itself isn't signed in
  s = await session('', seedDocs({ elvanto: true }));
  const robotTry = await s.page.evaluate(async () => {
    window.__fake.setUser({ email: 'robot@example.com', uid: 'R1', emailVerified: false });
    const fs = firebase.firestore(), res = {};
    res.readList = await new Promise(r => { const u = fs.collection('elvantoSync').onSnapshot(sn => { u(); r(sn.docs.length); }, () => r(-1)); });
    res.readSettings = await fs.doc('settings/church').get().then(d => !!d.data().elvanto, () => false);
    res.readPeople = await fs.doc('people/p06').get().then(() => true, () => false);
    const cur = (await fs.doc('elvantoSync/L103').get()).data();
    res.update = await fs.doc('elvantoSync/L103').set(Object.assign({}, cur, { status: 'Done', note: 'Added.' })).then(() => true, () => false);
    res.changeDates = await fs.doc('elvantoSync/L103').set(Object.assign({}, cur, { start: '2020-01-01' })).then(() => true, () => false);
    window.__fake.setUser({ email: 'robot@example.com', uid: 'IMPOSTOR', emailVerified: false });
    res.impostor = await fs.doc('settings/church').get().then(() => true, () => false);
    window.__fake.denied.length = 0;   // the refusals above were expected
    return res;
  });
  check(robotTry.readList === 1 && robotTry.readSettings && robotTry.update, 'the robot can read the Elvanto list and church settings, and report what it did');
  check(!robotTry.readPeople && !robotTry.changeDates && !robotTry.impostor, 'but can’t read people, change dates, or be used by another account with its email');
  await finish(s);

  console.log('Staff member (Lerato):');
  s = await session('lerato.khumalo@example.com', seedDocs());
  await s.go('leave'); await s.page.click('[data-act="leave:request"]'); await s.page.selectOption('#lf-type', 'SSL');
  // A Wednesday about six weeks ahead that isn't a public holiday (the test must not depend on today's date)
  const day = await s.page.evaluate(() => { const hol = {}; (Store.leave().holidays || []).forEach(h => { hol[h.date] = 1; }); let d = LeaveCore.addDays(LeaveCore.parse(Hub.today()), 45); while (d.getDay() !== 3 || hol[LeaveCore.iso(d)]) d = LeaveCore.addDays(d, 1); return LeaveCore.iso(d); });
  await s.page.fill('#lf-start', day); await s.page.dispatchEvent('#lf-start', 'change'); await s.page.fill('#lf-note', 'Dentist');
  await s.page.click('[data-act="leave:send"]'); await s.settle();
  docs = await s.docsNow(); const mine = Object.keys(docs).filter(k => k.startsWith('leaveRequests/') && docs[k].staffId === 'p06' && docs[k].start === day);
  check(mine.length === 1 && docs[mine[0]].status === 'Pending', 'requesting leave saves it as waiting for approval');
  await s.go('leave'); await s.page.click(`[data-act="leave:cancel"][data-id="${mine[0].split('/')[1]}"]`); await s.page.click(`[data-act="leave:cancel"][data-id="${mine[0].split('/')[1]}"]`); await s.settle();
  docs = await s.docsNow(); check(docs[mine[0]].status === 'Cancelled', 'can cancel own leave');
  await s.go('leave/away'); check((await s.text()).includes('Thandi'), '“Who’s away” shows colleagues’ approved leave');
  check(await s.page.evaluate(() => Store.leave().requests.every(r => r.staffId === 'p06' || (!r.reason && !r.type))), 'but not the type of leave or the reason');
  await finish(s);

  /* ---------- Someone without access ---------- */
};
