/* Church & Trellis – browser test, part: one sign-in shared by several people (a couple with one email address).
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
  check((await s.page.textContent('.signin-card')).includes('Who is using Church & Trellis?'), 'signing in with the shared address asks who is using Church & Trellis');
  await s.page.click('[data-act="hub:choose"][data-id="p11"]'); await s.page.waitForSelector('.app'); await s.settle();
  check((await s.page.textContent('.who')).includes('Priya Naidoo') && !!(await s.page.$('[data-act="hub:switchwho"]')), 'Priya chose herself: Church & Trellis opens as her, with a Switch person button');
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
  // Married couples and partners share one home address: changing one offers the same to the other; Households lists the ones that differ
  console.log('Spouses and their home address:');
  const addrOf = docs2 => id => Object.assign({}, (docs2['people/' + id] || {}).address, (docs2['details/' + id] || {}).address);
  s = await session('linda.pillay@example.com', seedDocs()); await s.go('people/p/p19');
  await s.page.click('[data-act="people:edit"]'); await fillHome(s); await s.page.selectOption('#pf-marital', 'Married'); await s.page.selectOption('#pf-spouse', 'p27');
  await s.page.fill('#pf-street', '1 Main Road'); await s.page.fill('#pf-city', 'Howick');
  await s.page.click('[data-act="people:save"]'); await s.settle(); await s.page.waitForTimeout(200);
  let dlg = await s.page.textContent('#modal');
  check(dlg.includes('Ruth Daniels’s address too?') && dlg.includes('1 Main Road') && dlg.includes('No address'), 'changing a husband’s address offers it to his wife (who has none)');
  await s.page.click('[data-act="people:addrcopy"]'); await s.settle(); docs = await s.docsNow();
  check(addrOf(docs)('p27').street === '1 Main Road' && addrOf(docs)('p19').street === '1 Main Road', 'Yes: she now has the same address, and his stays');
  await s.go('people/p/p19'); await s.page.click('[data-act="people:edit"]'); await s.page.fill('#pf-street', '2 Oak Street');
  await s.page.click('[data-act="people:save"]'); await s.settle(); await s.page.waitForTimeout(200);
  check((await s.page.textContent('#modal')).includes('1 Main Road'), 'a different address is offered again, showing what she has now');
  await s.page.click('#modal [data-act="hub:close"]:not(.x)'); await s.settle(); docs = await s.docsNow();
  check(addrOf(docs)('p27').street === '1 Main Road', 'No, leave it: her address is not touched');
  await s.go('people/families'); let tt = await s.text();
  check(tt.includes('Couples with different addresses') && tt.includes('2 Oak Street') && tt.includes('1 Main Road'), 'Households lists the couple whose addresses differ');
  await s.page.click('[data-act="people:addrcopy"][data-from="p19"]'); await s.settle(); docs = await s.docsNow();
  check(addrOf(docs)('p27').street === '2 Oak Street' && addrOf(docs)('p19').street === '2 Oak Street', 'one tap makes the couple share one address'); tt = await s.text();
  check(!tt.includes('Couples with different addresses'), '… and they leave the list');
  await s.go('people/p/p19'); await s.page.click('[data-act="people:edit"]'); await s.page.fill('#pf-street', '3 Elm Lane');
  await s.page.click('[data-act="people:save"]'); await s.settle(); await s.page.waitForTimeout(200);
  await s.page.click('#modal [data-act="people:addrapart"]'); await s.settle();
  await s.go('people/p/p19'); await s.page.click('[data-act="people:edit"]'); await s.page.fill('#pf-street', '4 Fir Road');
  await s.page.click('[data-act="people:save"]'); await s.settle(); await s.page.waitForTimeout(200);
  check(!(await s.page.isVisible('#modal')) || !(await s.page.textContent('#modal')).includes('address too?'), 'Keep both addresses: never asked about that couple again');
  await s.go('people/families'); check(!(await s.text()).includes('Couples with different addresses'), '… and not listed either');
  await finish(s);
};
