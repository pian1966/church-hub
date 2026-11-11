/* Church Hub – browser test, part: Life groups (Bible studies, midweek groups), and switching care groups off.
 * One part of tests/app.test.js, which starts the browser and runs every part in turn: node tests/app.test.js */
'use strict';
module.exports = async function (ctx) {
  // Care Groups, Midweek Groups and Leadership sit under one Groups entry in the menu, as its tabs
  const inGroups = async (x, id) => !!(await x.page.$('nav a[href="#/groups"]')) && await x.page.evaluate(i => Hub.groupMods().some(m => m.id === i), id);
  const { check, finish, seedDocs, session } = ctx;
  let docs, s, t;
  console.log('Life groups (Administrator):');
  s = await session('linda.pillay@example.com', seedDocs()); await s.go('home');
  check(!(await inGroups(s, 'life')), 'Life groups are off until an Administrator switches them on');
  await s.go('settings/apps'); await s.page.check('.st-mod[value="life"]'); await s.settle();
  docs = await s.docsNow();
  check(docs['settings/church'].modules.life === true && !!(await inGroups(s, 'life')), 'switched on under Settings → Apps: the Life groups page appears');
  await s.go('settings/terminology'); t = await s.page.textContent('main');
  check(t.includes('Midweek Group') && t.includes('A Bible Study, Life Group or Connect Group (etc) that meets during the week for teaching and fellowship'), 'Church Words: “Midweek group” – a Bible Study, Life Group or Connect Group (etc) that meets during the week');
  await s.go('life'); await s.page.fill('#lg-new', 'Tuesday Bible study'); await s.page.click('[data-act="life:addgroup"]'); await s.settle();
  docs = await s.docsNow();
  const key = Object.keys(docs).find(k => /^careGroups\/[^/]+$/.test(k) && docs[k].name === 'Tuesday Bible study'), gid = key ? key.split('/')[1] : '';
  check(!!key && docs[key].type === 'life', 'a life group is saved with the care groups, as type “life”');
  await s.page.fill('.cg-q[data-for="lg-' + gid + '"]', 'tim jac'); await s.page.waitForTimeout(400); await s.page.click('.cg-hits .cg-pick'); await s.settle();
  await s.page.click('[data-act="life:lead"][data-g="' + gid + '"][data-id="p14"]'); await s.settle();
  docs = await s.docsNow();
  check(docs[key].memberIds.includes('p14') && docs[key].leaderIds.includes('p14'), 'someone is added and made its group leader');
  // a youth group: children can be added; what was typed stays, so several people are added from the same list
  await s.go('life'); await s.page.fill('.cg-q[data-for="lg-' + gid + '"]', 'jacobs'); await s.page.waitForTimeout(400);
  const kids = await s.page.$$eval('.cg-hits[data-for="lg-' + gid + '"] .cg-pick', b => b.map(x => x.dataset.id));
  check(kids.includes('p16') && !kids.includes('p14'), 'children can be added to a midweek group (e.g. a youth group); people already in it aren’t offered');
  await s.page.click('.cg-pick[data-id="p16"]'); await s.settle();
  check((await s.page.inputValue('.cg-q[data-for="lg-' + gid + '"]')) === 'jacobs' && !!(await s.page.$('.cg-hits[data-for="lg-' + gid + '"] .cg-pick[data-id="p15"]')) && !(await s.page.$('.cg-hits[data-for="lg-' + gid + '"] .cg-pick[data-id="p16"]')),
    'after adding someone the list stays, with what was typed – ready for the next person');
  await s.page.click('.cg-pick[data-id="p15"]'); await s.settle(); docs = await s.docsNow();
  check(['p14', 'p15', 'p16'].every(x => docs[key].memberIds.includes(x)), '…so a whole household is added one after another');
  // When and where it meets; a co-leader and a host
  await s.page.click('[data-act="life:details"][data-id="' + gid + '"]'); await s.page.waitForSelector('#lgd-day');
  await s.page.selectOption('#lgd-day', '2'); await s.page.fill('#lgd-time', '19:00'); await s.page.selectOption('#lgd-freq', 'weekly');
  await s.page.selectOption('#lgd-host', 'p15'); await s.page.check('.lgd-co[value="p15"]'); await s.page.uncheck('.lgd-co[value="p15"]');
  await s.page.check('input[name="lgd-where"][value="other"]'); await s.page.fill('#lgd-place', 'Church hall'); await s.page.fill('#lgd-addr', '1 Main Road, Howick');
  await s.page.click('[data-act="life:savedetails"]'); await s.settle(); docs = await s.docsNow();
  check(docs[key].when.day === 2 && docs[key].when.time === '19:00' && docs[key].when.freq === 'weekly' && docs[key].venue.place === 'Church hall' && docs[key].roles.p15 === 'host', 'When and where: Tuesdays at 19:00, every week, in the church hall; Clare is the host');
  t = await s.page.textContent('.lg-panel[data-g="' + gid + '"]');
  check(/Tuesday · 19:00 · Every week/.test(t) && /Church hall: 1 Main Road, Howick/.test(t) && !!(await s.page.$('.lg-panel[data-g="' + gid + '"] .lg-meets a[href*="google"]')), 'the group shows when and where it meets, with a map link');
  await s.page.click('[data-act="life:details"][data-id="' + gid + '"]'); await s.page.waitForSelector('#lgd-day');
  await s.page.check('input[name="lgd-where"][value="host"]'); await s.page.check('.lgd-co[value="p16"]');
  await s.page.click('[data-act="life:savedetails"]'); await s.settle(); docs = await s.docsNow();
  t = await s.page.textContent('.lg-panel[data-g="' + gid + '"]');
  check(docs[key].venue.atHost === true && docs[key].roles.p16 === 'coleader' && /At Clare Jacobs’s home/.test(t), 'at the host’s home instead; a co-leader too');
  // From a person's page: the groups they are in, ticked on one list
  await s.go('people/p/p19'); await s.page.click('[data-act="people:groups"]'); await s.page.waitForSelector('.pg-in');
  await s.page.check('.pg-in[data-k="life"][value="' + gid + '"]'); await s.page.click('[data-act="people:groupssave"]'); await s.settle(); docs = await s.docsNow();
  check(docs[key].memberIds.includes('p19'), 'a person’s page: Groups puts them in a Midweek Group');
  await s.page.click('[data-act="people:groups"]'); await s.page.waitForSelector('.pg-in');
  check(await s.page.isChecked('.pg-in[data-k="life"][value="' + gid + '"]'), '… and shows the groups they are in');
  await s.page.uncheck('.pg-in[data-k="life"][value="' + gid + '"]'); await s.page.click('[data-act="people:groupssave"]'); await s.settle(); docs = await s.docsNow();
  check(!docs[key].memberIds.includes('p19'), '… and takes them out again');
  await s.go('home'); await s.go('life');
  const sum = await s.page.textContent('.lg-panel[data-g="' + gid + '"] details.cg-fold > summary');
  check(/1 leader\s*·\s*Tim Jacobs/.test(sum) && (await s.page.$$('.lg-panel[data-g="' + gid + '"] details.cg-fold')).length === 2, 'the group folds like a care group: its leaders’ names show, the other members in a second fold');
  check(!(await s.page.$('aside a[href="#/life"]')) && !(await s.page.$('aside a[href="#/care"]')) && !!(await s.page.$('aside a[href="#/groups"]')), 'the menu has one Groups entry instead of one for each kind of group');
  check(await s.page.$$eval('.groups-tabs a', a => a.map(x => x.getAttribute('href')).join()) === '#/groups,#/care,#/life' && !!(await s.page.$('aside a.on[href="#/groups"]')), 'Midweek Groups is a tab under Groups (with My groups and Care Groups), and Groups is lit in the menu');
  await s.go('groups'); t = await s.text();
  check(!!(await s.page.$('.groups-tabs a.on[href="#/groups"]')) && t.includes('My groups'), 'Groups opens on My groups');
  await s.go('care'); t = await s.text();
  check(!t.includes('Tuesday Bible study'), 'a life group isn’t listed with the care groups');
  await s.go('people/p/p14'); t = await s.text();
  check(t.includes('Group leader · Tuesday Bible study') && !!(await s.page.$('a.tag-link[href="#/life"]')), 'a person’s page shows their life group – a chip that opens the Midweek groups page');
  await s.go('settings/apps'); await s.page.uncheck('.st-mod[value="care"]'); await s.settle();
  docs = await s.docsNow();
  check(docs['settings/church'].modules.care === false && !(await inGroups(s, 'care')) && !!(await inGroups(s, 'life')), 'care groups can be switched off on their own, life groups stay');
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
  check(t.includes('My Midweek Groups') && t.includes('Thursday Bible study'), 'their life groups are on their Me page');
  await s.go('groups'); t = await s.text();
  check(t.includes('Thursday Bible study') && t.includes('Hilton'), 'Groups → My groups: their Midweek Group and their Care Group together');
  await s.go('messages/send'); await s.page.waitForTimeout(200);
  const to = await s.page.$$eval('#ms-to option', o => o.map(x => x.value));
  check(to.includes('life/lg1') && to.includes('care/cg1'), 'they can send a message to their life group (and their care group)');
  await finish(s);
};
