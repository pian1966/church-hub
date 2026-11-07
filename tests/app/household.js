/* Church Hub – browser test, part: one sign-in shared by several people (a couple with one email address).
 * One part of tests/app.test.js, which starts the browser and runs every part in turn: node tests/app.test.js */
'use strict';
module.exports = async function (ctx) {
  const { check, fillHome, finish, seedDocs, session } = ctx;
  let s, docs;
  const JASON = 'jason.naidoo@example.com', PRIYA = 'priya.naidoo@example.com';

  console.log('A couple sharing one email address:');
  // An Administrator gives Priya (Roster coordinator) Jason's email address; Jason already signs in with it as a member
  s = await session('linda.pillay@example.com', seedDocs()); await s.go('people/p/p11');
  await s.page.click('[data-act="people:edit"]'); await fillHome(s);
  await s.page.fill('#pf-email', JASON); await s.page.selectOption('#pf-role', 'rosters');
  await s.page.click('[data-act="people:save"]'); await s.settle(); await s.page.waitForTimeout(200); await s.settle();
  docs = await s.docsNow();
  const r = docs['roles/' + JASON] || {};
  check(r.personId === 'p11' && r.role === 'rosters' && JSON.stringify(r.also) === '["p10"]' && JSON.stringify(r.roles) === '["rosters","member"]'
    && r.people && r.people.p10.role === 'member' && r.people.p11.role === 'rosters', 'one sign-in for both: Priya (Roster coordinator) and Jason (member), each with their own role');
  check(!docs['roles/' + PRIYA], 'her old email address no longer signs in');
  await s.go('people/p/p10'); await s.page.click('[data-act="people:edit"]');
  check((await s.page.textContent('#modal')).includes('Priya Naidoo also signs in with this email address'), 'Jason’s Edit details says he shares the sign-in with Priya');
  await s.page.selectOption('#pf-role', 'none'); await s.page.click('[data-act="people:save"]'); await s.settle(); await s.page.waitForTimeout(200); await s.settle();
  const r2 = (await s.docsNow())['roles/' + JASON] || {};
  check(r2.personId === 'p11' && r2.role === 'rosters' && !r2.also && !r2.roles, 'taking away Jason’s access leaves the sign-in for Priya alone');
  await finish(s);

  // Signing in with the shared address: choose who you are
  const shared = seedDocs();
  shared['people/p11'].email = JASON; shared['people/p11'].appRole = 'rosters'; delete shared['roles/' + PRIYA];
  shared['roles/' + JASON] = r;
  s = await session(JASON, shared);
  check((await s.page.textContent('.signin-card')).includes('Who is using Church Hub?'), 'signing in with the shared address asks who is using Church Hub');
  await s.page.click('[data-act="hub:choose"][data-id="p11"]'); await s.page.waitForSelector('.app'); await s.settle();
  check((await s.page.textContent('.who')).includes('Priya Naidoo') && !!(await s.page.$('[data-act="hub:switchwho"]')), 'Priya chose herself: Church Hub opens as her, with a Switch person button');
  await s.go('rosters'); check(!(await s.text()).includes('No access'), 'as Priya: the rosters (her role)');
  await s.page.click('[data-act="hub:switchwho"]'); await s.page.click('#modal [data-act="hub:choose"][data-id="p10"]');
  await s.page.waitForFunction(() => (document.querySelector('.who') || {}).textContent && document.querySelector('.who').textContent.includes('Jason Naidoo'), null, { timeout: 8000 }); await s.settle();
  await s.go('me'); const me = await s.text();
  check(me.includes('Jason'), 'switching to Jason: his own Me page');
  docs = await s.docsNow();
  check(Object.values(docs).some(d => d.action === 'Switched to someone else sharing this sign-in'), '…the switch is written in the history log');
  await s.page.reload(); await s.page.waitForSelector('.app'); await s.settle();
  check((await s.page.textContent('.who')).includes('Jason Naidoo'), 'this device remembers who chose last');
  await finish(s);

  // A Pastor who gives access can't attach someone to a Pastor's sign-in (only an Administrator can)
  const pastorSeed = seedDocs();
  pastorSeed['roles/thandi.mokoena@example.com'].can = ['access']; pastorSeed['settings/church'].pastorCan = ['access'];
  s = await session('thandi.mokoena@example.com', pastorSeed); await s.go('people/p/p11');
  await s.page.click('[data-act="people:edit"]'); await fillHome(s);
  await s.page.fill('#pf-email', 'pieter.vanwyk@example.com'); await s.page.selectOption('#pf-role', 'member');
  await s.page.click('[data-act="people:save"]'); await s.page.waitForTimeout(300);
  check((await s.page.textContent('#pf-err')).includes('Only an Administrator can give access on an email address shared with a Pastor'), 'a Pastor with “access” is told only an Administrator can share a Pastor’s sign-in');
  check((await s.docsNow())['roles/pieter.vanwyk@example.com'].personId === 'p03', '…and Pieter’s sign-in is untouched');
  await finish(s);
};
