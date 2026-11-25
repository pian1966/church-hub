/* Church & Trellis – browser test, part: the Usage page for Administrators and Pastors (js/usage.js, js/mod-usage.js).
 * The numbers are tested in tests/usage.test.js. One part of tests/app.test.js, which starts the browser and runs every part in turn: node tests/app.test.js */
'use strict';
module.exports = async function (ctx) {
  const { check, finish, seedDocs, session } = ctx;
  console.log('Usage page:');
  // Two Church Partners have opened the app; nothing has been recorded yet by the app itself (the live church starts with no usage records)
  let seed = seedDocs();
  const partners = Object.keys(seed).filter(k => /^people\//.test(k) && seed[k].category === 'Church Partner' && seed[k].familyRole !== 'child' && !/^(linda\.pillay|thandi\.mokoena)@/.test(seed[k].email || ''));   // not the people signing in below (their own page has no invite line)
  seed[partners[0]].appFirstSeen = '2026-11-02'; seed[partners[1]].appFirstSeen = '2026-11-10';
  let s = await session('linda.pillay@example.com', seed); await s.go('usage'); await s.page.waitForSelector('main h1');
  await s.page.waitForFunction(() => !document.querySelector('main').textContent.includes('Loading…'), null, { timeout: 8000 });
  let text = await s.text();
  check(text.includes('Usage') && text.includes('Who is on the app'), 'an Administrator can open Usage, which shows who is on the app');
  check(/\d+%/.test(text) && text.includes('Church Partners') && text.includes('Not invited yet'), '… with the share of Church Partners on the app, and who is invited or not');
  check(/On right now[\s\S]*Linda/.test(text), '… and shows who is on right now (the Administrator herself)');
  check(text.includes('How often it is used') && text.includes('Which version people have'), 'the records are fetched and the cards fill in');
  check(text.includes('Church Partners not on the app yet') && text.includes('Invite them'), '… and lists the Church Partners not on yet, with a way to invite them');
  check(!!(await s.page.$('.u-nums')), 'each chart has its numbers as a table');
  check(!/@example\.com/.test(text), 'no email addresses are shown');
  check(text.includes('How much people use it') && text.includes('Not on the app yet'), 'the "How much people use it" card shows the levels');
  const pid = partners[0].split('/')[1];
  await s.go('people/p/' + pid); await s.page.waitForSelector('.badge-line .u-lv'); text = await s.text();
  check(text.includes('Using Church & Trellis since') && !!(await s.page.$('.badge-line .u-lv')), 'on a person’s page an Administrator sees how much they use the app');
  await finish(s);

  const seed2 = seedDocs(); seed2[partners[0]].appFirstSeen = '2026-11-02';
  s = await session('thandi.mokoena@example.com', seed2); await s.go('usage'); await s.page.waitForSelector('main h1');
  check((await s.text()).includes('Who is on the app'), 'a Pastor can open Usage too');
  await s.go('people/p/' + partners[0].split('/')[1]); await s.page.waitForSelector('main h1');
  check(!!(await s.page.$('.badge-line .u-lv')), 'a Pastor sees it on a person’s page too');
  await finish(s);

  // A member's own app notes that they opened it (and which parts) – their own record only; they can't open Usage
  const memberSeed = seedDocs(), tim = (memberSeed['roles/tim.jacobs@example.com'] || {}).personId;
  s = await session('tim.jacobs@example.com', memberSeed); await s.page.waitForTimeout(2200); await s.go('rosters'); await s.settle();
  let docs = await s.docsNow(), mine = docs['appUse/' + tim];
  check(!!mine && mine.id === tim && /^\d+\.\d+\.\d+$/.test(mine.version) && mine.platform === 'browser' && Object.values(mine.days || {}).some(d => d.n >= 1),
    'a member’s own app records that they opened it, with the version and how (a browser)');
  check(!!mine && Object.keys(mine).sort().join() === 'days,firstSeen,id,lastSeen,platform,version' && !JSON.stringify(mine).includes('@'), '… only counts – no name, email or anything they typed');
  check(Object.keys(docs).filter(k => /^appUse\//.test(k)).length === 1, '… and nobody else’s record');
  await s.go('usage'); await s.settle();
  check(!(await s.text()).includes('Who is on the app'), 'a member cannot open Usage');
  await finish(s);

  // Administrators' own use counts too
  s = await session('linda.pillay@example.com', seedDocs()); await s.page.waitForTimeout(2200); await s.settle();
  docs = await s.docsNow(); const lindaId = (seedDocs()['roles/linda.pillay@example.com'] || {}).personId;
  check(!!docs['appUse/' + lindaId], 'an Administrator’s own use is recorded too');
  await finish(s);

  // With records: who is on right now, the parts, the versions and each person's level
  const seed3 = seedDocs(), pad = n => String(n).padStart(2, '0'), local = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const p0 = partners[0].split('/')[1], p1 = partners[1].split('/')[1], daysOf = (n, v) => Object.fromEntries(Array.from({ length: n }, (_, i) => [local(new Date(Date.now() - i * 864e5)), { n: 1, v }]));
  seed3[partners[0]].appFirstSeen = '2026-01-10'; seed3[partners[1]].appFirstSeen = '2026-01-10';
  seed3['appUse/' + p0] = { id: p0, firstSeen: '2026-01-10', lastSeen: new Date().toISOString(), version: '0.9.0', platform: 'android', days: daysOf(20, { rosters: 3, people: 1, messages: 2, events: 1 }) };
  seed3['appUse/' + p1] = { id: p1, firstSeen: '2026-01-10', lastSeen: new Date(Date.now() - 40 * 864e5).toISOString(), version: '0.9.0', platform: 'app', days: {} };
  s = await session('thandi.mokoena@example.com', seed3); await s.go('usage'); await s.page.waitForFunction(() => !document.querySelector('main').textContent.includes('Loading…'), null, { timeout: 8000 });
  text = await s.text();
  const nameOf = d => (d.preferredName || d.firstName) + ' ' + d.lastName;
  check(text.includes('On right now') && text.includes(nameOf(seed3[partners[0]])), 'a Pastor sees who is on right now');
  check(/Most used parts[\s\S]*Rosters/.test(text) && text.includes('0.9.0') && text.includes('Android app'), '… the most used parts, the versions and how people open it');
  check(text.includes('Power user') && text.includes('Slipping away') && text.includes('Might need a nudge'), '… and each person’s level, with who might need a nudge');
  await s.go('people/p/' + p0); await s.page.waitForFunction(() => ((document.querySelector('.badge-line .u-lv') || {}).textContent || '').includes('Power'), null, { timeout: 8000 }).catch(() => {});
  const bl = await s.page.textContent('.badge-line .u-lv').catch(() => '');
  check(bl.includes('Power user'), 'the level shows on that person’s page');
  await finish(s);
};
