/* Church & Trellis – browser test, part: Pray for the nations (js/mod-prayer.js) – Operation World's widget, shown only when a person asks.
 * The internet is switched off in this test, so the script itself can't load: we check that nothing is asked for before the tap,
 * and that the box and the script are put in place after it. One part of tests/app.test.js: node tests/app.test.js */
'use strict';
module.exports = async function (ctx) {
  const { check, finish, seedDocs, session } = ctx;
  console.log('Pray for the nations:');
  // Off until an Administrator switches it on (Settings → Apps)
  let s = await session('linda.pillay@example.com', seedDocs());
  await s.go('home'); check(!(await s.page.$('nav a[href="#/prayer"]')), 'Pray for the nations is off until it is switched on');
  await finish(s);

  const seed = seedDocs(); seed['settings/church'].modules = Object.assign({}, seed['settings/church'].modules, { prayer: true });
  // A church member (Basic access) can use it too
  s = await session('tim.jacobs@example.com', seed);
  const asked = []; s.page.on('request', r => { if (/operationworld/.test(r.url())) asked.push(r.url()); });
  await s.go('prayer'); let t = await s.text();
  check(/Today’s prayer for the nations/.test(t) && await s.page.isVisible('[data-act="prayer:show"]'), 'it asks first, and says who shows the prayer');
  check(/Operation World’s own website/.test(t) && !(await s.page.$('.ow-web-widget')) && !asked.length, 'before the tap nothing is loaded from Operation World');
  await s.page.click('[data-act="prayer:show"]'); await s.page.waitForSelector('.ow-web-widget');
  await s.page.waitForTimeout(150);
  check(asked.some(u => u === 'https://widget.operationworld.org/js/widget.js') && (await s.page.getAttribute('#ow-script', 'src')) === 'https://widget.operationworld.org/js/widget.js', 'after the tap the widget box and Operation World’s script are put in place');
  check(/Prayer content from Operation World/.test(await s.text()) && await s.page.isVisible('[data-act="prayer:hide"]'), 'the page thanks Operation World, with Stop showing');
  await s.page.click('[data-act="prayer:hide"]'); await s.page.waitForSelector('[data-act="prayer:show"]');
  check(!(await s.page.$('.ow-web-widget')), 'Stop showing takes the widget away again');
  await finish(s);
};
