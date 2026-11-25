/* Church & Trellis – browser test, part: the Usage page for Administrators and Pastors (js/usage.js, js/mod-usage.js).
 * The numbers are tested in tests/usage.test.js. One part of tests/app.test.js, which starts the browser and runs every part in turn: node tests/app.test.js */
'use strict';
module.exports = async function (ctx) {
  const { check, finish, seedDocs, session } = ctx;
  console.log('Usage page:');
  // Two Church Partners have opened the app; nothing has been recorded yet by the app itself (the live church starts with no usage records)
  let seed = seedDocs();
  const partners = Object.keys(seed).filter(k => /^people\//.test(k) && seed[k].category === 'Church Partner' && seed[k].familyRole !== 'child');
  seed[partners[0]].appFirstSeen = '2026-11-02'; seed[partners[1]].appFirstSeen = '2026-11-10';
  let s = await session('linda.pillay@example.com', seed); await s.go('usage'); await s.page.waitForSelector('main h1');
  let text = await s.text();
  check(text.includes('Usage') && text.includes('Who is on the app'), 'an Administrator can open Usage, which shows who is on the app');
  check(/\d+%/.test(text) && text.includes('Church Partners') && text.includes('Not invited yet'), '… with the share of Church Partners on the app, and who is invited or not');
  check(text.includes('Nobody is on right now.'), '… and says when nobody is on right now');
  check(text.includes('Nothing recorded yet'), 'before the app has recorded anything, the other cards say so instead of showing zeros');
  check(text.includes('Church Partners not on the app yet') && text.includes('Invite them'), '… and lists the Church Partners not on yet, with a way to invite them');
  check(!!(await s.page.$('.u-nums')), 'each chart has its numbers as a table');
  check(!/@example\.com/.test(text), 'no email addresses are shown');
  await finish(s);

  s = await session('thandi.mokoena@example.com', seedDocs()); await s.go('usage'); await s.page.waitForSelector('main h1');
  check((await s.text()).includes('Who is on the app'), 'a Pastor can open Usage too');
  await finish(s);

  s = await session('tim.jacobs@example.com', seedDocs()); await s.go('usage'); await s.settle();
  check(!(await s.text()).includes('Who is on the app'), 'a member cannot open Usage');
  await finish(s);
};
