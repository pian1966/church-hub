/* Church Hub – browser test, part: Life groups (Bible studies, midweek groups), and switching care groups off.
 * One part of tests/app.test.js, which starts the browser and runs every part in turn: node tests/app.test.js */
'use strict';
module.exports = async function (ctx) {
  const { check, finish, seedDocs, session } = ctx;
  let docs, s, t;
  console.log('Life groups (Administrator):');
  s = await session('linda.pillay@example.com', seedDocs()); await s.go('home');
  check(!(await s.page.$('nav a[href="#/life"]')), 'Life groups are off until an Administrator switches them on');
  await s.go('settings/apps'); await s.page.check('.st-mod[value="life"]'); await s.settle();
  docs = await s.docsNow();
  check(docs['settings/church'].modules.life === true && !!(await s.page.$('nav a[href="#/life"]')), 'switched on under Settings → Apps: the Life groups page appears');
  await s.go('settings/terminology'); t = await s.page.textContent('main');
  check(t.includes('Midweek group') && t.includes('A Bible Study, Life Group or Connect Group (etc) that meets during the week for teaching and fellowship'), 'Church Words: “Midweek group” – a Bible Study, Life Group or Connect Group (etc) that meets during the week');
  await s.go('life'); await s.page.fill('#lg-new', 'Tuesday Bible study'); await s.page.click('[data-act="life:addgroup"]'); await s.settle();
  docs = await s.docsNow();
  const key = Object.keys(docs).find(k => /^careGroups\/[^/]+$/.test(k) && docs[k].name === 'Tuesday Bible study'), gid = key ? key.split('/')[1] : '';
  check(!!key && docs[key].type === 'life', 'a life group is saved with the care groups, as type “life”');
  await s.page.fill('.cg-q[data-for="lg-' + gid + '"]', 'tim jac'); await s.page.waitForTimeout(400); await s.page.click('.cg-hits .cg-pick'); await s.settle();
  await s.page.click('[data-act="life:lead"][data-g="' + gid + '"][data-id="p14"]'); await s.settle();
  docs = await s.docsNow();
  check(docs[key].memberIds.includes('p14') && docs[key].leaderIds.includes('p14'), 'someone is added and made its group leader');
  await s.go('care'); t = await s.text();
  check(!t.includes('Tuesday Bible study'), 'a life group isn’t listed with the care groups');
  await s.go('people/p/p14'); t = await s.text();
  check(t.includes('Group leader · Tuesday Bible study'), 'a person’s page shows their life group');
  await s.go('settings/apps'); await s.page.uncheck('.st-mod[value="care"]'); await s.settle();
  docs = await s.docsNow();
  check(docs['settings/church'].modules.care === false && !(await s.page.$('nav a[href="#/care"]')) && !!(await s.page.$('nav a[href="#/life"]')), 'care groups can be switched off on their own, life groups stay');
  await finish(s);

  console.log('Life groups (a group leader):');
  const seed = seedDocs();
  seed['settings/church'].modules = Object.assign({}, seed['settings/church'].modules, { life: true });
  seed['careGroups/lg1'] = { type: 'life', name: 'Midweek', leaderIds: ['p14'], memberIds: ['p14', 'p15'], names: { p14: 'Tim Jacobs', p15: 'Clare Jacobs' } };
  seed['careGroups/cg1'] = { name: 'Hilton', leaderIds: ['p14'], memberIds: ['p14'], names: { p14: 'Tim Jacobs' } };
  s = await session('tim.jacobs@example.com', seed); await s.go('life'); await s.page.waitForTimeout(400);
  t = await s.text();
  check(t.includes('Midweek') && t.includes('Clare') && !t.includes('Hilton'), 'a leader sees their life group (not their care group) on the Life groups page');
  await s.page.click('[data-act="life:rename"][data-id="lg1"]'); await s.page.fill('#lg-name', 'Thursday Bible study'); await s.page.click('[data-act="life:saverename"]'); await s.settle();
  docs = await s.docsNow();
  check(docs['careGroups/lg1'].name === 'Thursday Bible study' && docs['careGroups/lg1'].type === 'life', 'the leader names their own group');
  await s.go('me'); await s.page.waitForTimeout(300); t = await s.text();
  check(t.includes('My midweek groups') && t.includes('Thursday Bible study'), 'their life groups are on their Me page');
  await s.go('messages/send'); await s.page.waitForTimeout(200);
  const to = await s.page.$$eval('#ms-to option', o => o.map(x => x.value));
  check(to.includes('life/lg1') && to.includes('care/cg1'), 'they can send a message to their life group (and their care group)');
  await finish(s);
};
