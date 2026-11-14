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
  s = await session('linda.pillay@example.com', seedDocs()); await s.go('settings/pastors');
  check(await s.page.isVisible('#pastor-can'), 'Settings has “What Pastors can do”');
  for (const v of ['settings', 'leave']) await s.page.check('.st-pc[value="' + v + '"]');
  await s.page.waitForTimeout(1200); await s.settle(); await s.page.waitForTimeout(300);
  await s.go('settings/terminology'); await s.page.uncheck('.st-minister-role[value="Seniors Minister"]');
  await s.page.waitForTimeout(1200); await s.settle(); await s.page.waitForTimeout(300);
  docs = await s.docsNow();
  check(JSON.stringify(docs['settings/church'].pastorCan) === '["settings","leave"]' && JSON.stringify(docs['roles/thandi.mokoena@example.com'].can) === '["leave","settings"]',
    'ticking Settings and Leave saves them and copies them onto each Pastor’s access entry');
  check(Array.isArray(docs['settings/church'].ministerRoles) && !docs['settings/church'].ministerRoles.includes('Seniors Minister'),
    'the selected ministry role list (Settings → Terminology) is saved in church settings');
  await finish(s);
  s = await session('thandi.mokoena@example.com', docs); await s.go('settings/pastors');
  check(!!(await s.page.$('nav a[href="#/settings"]')) && await s.page.evaluate(() => Hub.can('leave.manage') && Hub.can('settings.manage') && !Hub.can('privacy.manage')), 'the Pastor now has Settings and Leave approvals – and nothing that wasn’t ticked');
  check(await s.page.$$eval('.st-pc', b => b.every(x => x.disabled)), '…but sees “What Pastors can do” without being able to change it');
  await s.page.evaluate(() => Store.setSettings({ churchName: 'Changed by the Pastor' }, 'x')); await s.settle(); await s.page.waitForTimeout(300);
  docs = await s.docsNow();
  check(docs['settings/church'].churchName === 'Changed by the Pastor', 'a Pastor with the Settings tick can change the church’s settings');
  await s.page.evaluate(() => Store.setSettings({ pastorCan: ['settings', 'leave', 'privacy'] }, 'x')); await s.settle(); await s.page.waitForTimeout(300);
  docs = await s.docsNow();
  check(JSON.stringify(docs['settings/church'].pastorCan) === '["settings","leave"]', '…but not what Pastors can do (the rules refuse it)');
  check((await s.denied()).length === 1, 'that one refused change is the only thing refused'); await s.close();

  console.log('The Senior Pastor (Rector) and the other Pastors:');
  s = await session('linda.pillay@example.com', docs); await s.go('settings/pastors');
  check(!(await s.page.$('.st-sc')), 'until a Senior Pastor is chosen, all Pastors have the same ticks');
  await s.page.selectOption('#st-senior', 'p02');
  await s.page.waitForTimeout(800); await s.settle(); await s.page.waitForSelector('.st-sc'); await s.page.waitForTimeout(300);
  docs = await s.docsNow();
  check(docs['settings/church'].seniorPastorId === 'p02' && JSON.stringify(docs['settings/church'].seniorCan) === '["settings","leave"]',
    'choosing Thandi as Senior Pastor saves it, and she starts with what the Pastors could already do');
  await s.page.check('.st-sc[value="privacy"]'); await s.page.check('.st-sc[value="access"]'); await s.page.uncheck('.st-pc[value="settings"]');
  await s.page.waitForTimeout(1200); await s.settle(); await s.page.waitForTimeout(300);
  docs = await s.docsNow();
  check(JSON.stringify(docs['roles/thandi.mokoena@example.com'].can) === '["access","leave","privacy","settings"]' && JSON.stringify(docs['roles/pieter.vanwyk@example.com'].can) === '["leave"]',
    'the Senior Pastor and the Assistant Pastors each get their own ticks on their access entries');
  await s.go('people/p/p03');
  check((await s.text()).includes('Assistant Pastor'), 'Pieter’s page calls him an Assistant Pastor');
  await s.page.evaluate(() => Store.setSettings({ wording: { set: 'anglican' } }, 'x')); await s.settle(); await s.go('people/p/p02'); await s.page.waitForTimeout(300);
  check((await s.text()).includes('Rector'), 'with Anglican words, Thandi is the Rector');
  await s.go('people/p/p03'); await s.page.waitForTimeout(300);
  check((await s.text()).includes('Assistant Minister'), '…and Pieter an Assistant Minister');
  docs = await s.docsNow(); await finish(s);
  s = await session('thandi.mokoena@example.com', docs); await s.go('home');
  check(await s.page.evaluate(() => Hub.can('privacy.manage') && Hub.can('access.manage') && Hub.can('settings.manage')), 'the Senior Pastor has her own abilities');
  await s.page.evaluate(() => Store.setSettings({ seniorPastorId: 'p03' }, 'x')); await s.settle(); await s.page.waitForTimeout(300);
  await s.page.evaluate(() => Store.setSettings({ seniorCan: ['settings'] }, 'x')); await s.settle(); await s.page.waitForTimeout(300);
  docs = await s.docsNow();
  check(docs['settings/church'].seniorPastorId === 'p02' && docs['settings/church'].seniorCan.length === 4, '…but can’t choose another Senior Pastor or change her own ticks (the rules refuse it)');
  check((await s.denied()).length === 2, 'those two refused changes are the only things refused'); await s.close();
  s = await session('pieter.vanwyk@example.com', docs); await s.go('home');
  check(await s.page.evaluate(() => Hub.can('leave.manage') && !Hub.can('settings.manage') && !Hub.can('privacy.manage')), 'an Assistant Pastor has only the Assistant Pastors’ ticks');
  await finish(s);
  s = await session('linda.pillay@example.com', docs); await s.go('settings/pastors');
  await s.page.selectOption('#st-senior', ''); await s.page.waitForTimeout(800); await s.settle(); await s.page.waitForTimeout(300);
  docs = await s.docsNow();
  check(!docs['settings/church'].seniorPastorId && JSON.stringify(docs['roles/thandi.mokoena@example.com'].can) === '["leave"]' && !(await s.page.$('.st-sc')),
    'choosing nobody makes all Pastors the same again');
  await finish(s);
};
