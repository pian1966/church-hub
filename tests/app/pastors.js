/* Church Hub – browser test, part: What Pastors can do (Settings), and what a Pastor then sees and may save.
 * One part of tests/app.test.js, which starts the browser and runs every part in turn: node tests/app.test.js */
'use strict';
module.exports = async function (ctx) {
  const { check, finish, seedDocs, session } = ctx;
  let docs, s;
  console.log('What Pastors can do:');
  s = await session('thandi.mokoena@example.com', seedDocs()); await s.go('home');
  check(!(await s.page.$('nav a[href="#/settings"]')) && await s.page.evaluate(() => !Hub.can('leave.manage')), 'a Pastor without ticks has no Settings and can’t approve leave');
  await finish(s);
  s = await session('linda.pillay@example.com', seedDocs()); await s.go('settings');
  check(await s.page.isVisible('#pastor-can'), 'Settings has “What Pastors can do”');
  for (const v of ['settings', 'leave']) await s.page.check('.st-pc[value="' + v + '"]');
  await s.page.click('[data-act="settings:pastorcan"]'); await s.settle(); await s.page.waitForTimeout(300);
  docs = await s.docsNow();
  check(JSON.stringify(docs['settings/church'].pastorCan) === '["settings","leave"]' && JSON.stringify(docs['roles/thandi.mokoena@example.com'].can) === '["leave","settings"]',
    'ticking Settings and Leave saves them and copies them onto each Pastor’s access entry');
  await finish(s);
  s = await session('thandi.mokoena@example.com', docs); await s.go('settings');
  check(!!(await s.page.$('nav a[href="#/settings"]')) && await s.page.evaluate(() => Hub.can('leave.manage') && Hub.can('settings.manage') && !Hub.can('privacy.manage')), 'the Pastor now has Settings and Leave approvals – and nothing that wasn’t ticked');
  check(await s.page.$$eval('.st-pc', b => b.every(x => x.disabled)), '…but sees “What Pastors can do” without being able to change it');
  await s.page.evaluate(() => Store.setSettings({ churchName: 'Changed by the Pastor' }, 'x')); await s.settle(); await s.page.waitForTimeout(300);
  docs = await s.docsNow();
  check(docs['settings/church'].churchName === 'Changed by the Pastor', 'a Pastor with the Settings tick can change the church’s settings');
  await s.page.evaluate(() => Store.setSettings({ pastorCan: ['settings', 'leave', 'privacy'] }, 'x')); await s.settle(); await s.page.waitForTimeout(300);
  docs = await s.docsNow();
  check(JSON.stringify(docs['settings/church'].pastorCan) === '["settings","leave"]', '…but not what Pastors can do (the rules refuse it)');
  check((await s.denied()).length === 1, 'that one refused change is the only thing refused'); await s.close();
};
