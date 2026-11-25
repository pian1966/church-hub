/* Church & Trellis – browser test, part: the Church health card on an Administrator's Home (js/health.js, js/health-ui.js).
 * The rules are tested in tests/health.test.js. One part of tests/app.test.js, which starts the browser and runs every part in turn: node tests/app.test.js */
'use strict';
module.exports = async function (ctx) {
  const { check, finish, seedDocs, session } = ctx;
  console.log('Church health card:');
  // An adult with no email and no mobile, and a group without a leader, are worth a look
  let seed = seedDocs();
  seed['people/p23'].email = ''; seed['people/p23'].mobile = '';
  const gid = Object.keys(seed).find(k => /^careGroups\//.test(k));
  if (gid) seed[gid].leaderIds = [];
  let s = await session('linda.pillay@example.com', seed); await s.go('home'); await s.page.waitForSelector('#health-card');
  let card = await s.page.textContent('#health-card');
  check(card.includes('Church health') && card.includes('adult has no email address or mobile number') && card.includes('Every 2 weeks'), 'an Administrator’s Home has a Church health card showing what needs a look, and how often');
  check(!gid || card.includes('has no leader'), '… including a group with no leader');
  check(card.includes('other check') || card.includes('All clear'), '… and says how many other checks are all clear');
  check(await s.page.getAttribute('#health-card a[href="#/people/p/p23"]', 'href') === '#/people/p/p23', 'the line opens the person to put it right');
  check(!card.includes('Naidoo') && !/@example\.com/.test(card), 'the card shows counts, not names or email addresses');
  await s.page.click('#health-card a[href="#/people/p/p23"]'); await s.settle();
  check((await s.text()).includes('Edit details'), '… and the page opens');
  await finish(s);

  // Put right, the line goes; Pastors do not see the card
  seed = seedDocs(); s = await session('linda.pillay@example.com', seed); await s.go('home'); await s.page.waitForSelector('#health-card');
  card = await s.page.textContent('#health-card'); check(!card.includes('has no email address or mobile number'), 'when nothing is wrong with an item it is not listed'); await finish(s);
  s = await session('thandi.mokoena@example.com', seedDocs()); await s.go('home'); await s.page.waitForSelector('main h1');
  check(!(await s.page.$('#health-card')), 'a Pastor does not see the Church health card');
  await finish(s);
};
