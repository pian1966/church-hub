/* Church Hub – browser test, part: Leave – cover rules and blocked days, and the stand-in approver.
 * One part of tests/app.test.js, which starts the browser and runs every part in turn: node tests/app.test.js */
'use strict';
module.exports = async function (ctx) {
  const { check, finish, seedDocs, session } = ctx;
  let docs, s;
  console.log('Leave – cover rules and the stand-in approver:');
  s = await session('linda.pillay@example.com', seedDocs()); await s.go('leave/settings');
  check(await s.page.isVisible('#ls-rules') && (await s.page.$$('.ls-rule')).length === 1, 'Leave → Settings shows the cover rules (the demo’s Sunday cover)');
  await s.page.click('[data-act="leave:addrule"][data-preset="christmas"]'); await s.settle();
  await s.page.click('[data-act="leave:saverules"]'); await s.settle(); await s.page.waitForTimeout(300);
  docs = await s.docsNow();
  check(docs['leave/config'].rules.length === 2 && docs['leave/config'].rules[1].from === '24 Dec' && docs['leave/config'].rules[1].action === 'Block', 'adding “Christmas” saves a blocking rule for 24–26 Dec');
  const today = await s.page.evaluate(() => Hub.today()), later = await s.page.evaluate(() => LeaveCore.iso(LeaveCore.addDays(new Date(), 7)));
  await s.go('leave/approvals');
  check(await s.page.isVisible('#standin'), 'Approvals has a stand-in approver panel');
  await s.page.selectOption('#si-who', 'p02'); await s.page.fill('#si-from', today); await s.page.fill('#si-to', later);
  await s.page.click('[data-act="leave:standin"]'); await s.settle(); await s.page.waitForTimeout(300);
  docs = await s.docsNow();
  const thandi = Object.keys(docs).find(k => k.startsWith('roles/') && docs[k].personId === 'p02');
  check(docs['leave/config'].settings.StandInID === 'p02' && docs[thandi].standInTo > Date.now(), 'setting Thandi (a Pastor) as stand-in saves the dates in the leave settings and on her access entry');
  await finish(s);
  docs['leaveRequests/OWN2'] = { staffId: 'p02', type: 'PSL', status: 'Pending', start: '2027-05-03', end: '2027-05-04', reason: 'Own' };
  s = await session(thandi.slice(6), docs); await s.go('leave/approvals');
  const pending = Object.keys(docs).filter(k => k.startsWith('leaveRequests/') && docs[k].status === 'Pending');
  const theirs = pending.find(k => docs[k].staffId !== 'p02'), own = pending.find(k => docs[k].staffId === 'p02');
  check(!!theirs && !!(await s.page.$('[data-act="leave:decide"][data-id="' + theirs.split('/')[1] + '"]')) && !(await s.page.$('[data-act="leave:decide"][data-id="' + (own || 'x').split('/')[1] + '"]')),
    'the stand-in sees Approvals with other people’s waiting leave – not her own');
  const btn = '[data-act="leave:decide"][data-id="' + theirs.split('/')[1] + '"][data-d="Approved"]';
  await s.page.click(btn); await s.settle(); if (await s.page.$(btn)) { await s.page.click(btn); await s.settle(); }   // "Approve anyway" when over the allowance
  await s.page.waitForTimeout(300);
  docs = await s.docsNow();
  check(docs[theirs].status === 'Approved' && docs[theirs].decidedBy && docs['away/' + theirs.split('/')[1]], 'the stand-in approves it (and it counts as away for rosters)');
  await finish(s);
};
