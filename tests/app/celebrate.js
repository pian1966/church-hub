/* Church & Trellis – browser test, part: birthdays and wedding anniversaries (js/celebrate.js, js/celebrate-ui.js):
 * the card on your own day, 🎂 / 💍 in the church directory for people who agreed to it, Birthdays this week, the Pastors'
 * "May be a hard day", and turning it off on Me. The rules are tested in tests/celebrate.test.js.
 * One part of tests/app.test.js, which starts the browser and runs every part in turn: node tests/app.test.js */
'use strict';
module.exports = async function (ctx) {
  const { check, finish, seedDocs, session } = ctx;
  console.log('Birthdays and anniversaries:');
  const pad = n => String(n).padStart(2, '0');
  const now = new Date(), md = pad(now.getMonth() + 1) + '-' + pad(now.getDate());
  const other = pad(((now.getMonth() + 6) % 12) + 1) + '-15';   // half a year away
  const day = (y, m) => y + '-' + m;
  const docs = over => { const d = seedDocs(); over(d); return d; };

  /* ---------- your own birthday: the card on Home and Me; nothing on another day ---------- */
  let s = await session('tim.jacobs@example.com', docs(d => { d['details/p14'].birthDate = day(1980, md); }));
  await s.go('home'); await s.page.waitForSelector('main h1');
  check(!!(await s.page.$('.cel-card')) && /Happy birthday, Tim!/.test(await s.text()), 'on your birthday Home has a card');
  await s.go('me'); await s.page.waitForSelector('main h1');
  check(!!(await s.page.$('.cel-card')), '…and so does Me');
  // turning it off on Me
  await s.page.click('#me-celebrate'); await s.settle();
  check((await s.docsNow())['people/p14'].noCelebrate === true, 'unticking "Celebrate my birthday and anniversary" saves it on your own record');
  check(!(await s.page.$('.cel-card')), '…and the card goes');
  check(!((await s.docsNow())['directory/p14'] || {}).birthDay, '…and your birthday is not in the church directory');
  await s.page.click('#me-celebrate'); await s.settle();
  check(!(await s.docsNow())['people/p14'].noCelebrate && !!(await s.page.$('.cel-card')), 'ticking it again brings the card back');
  await finish(s);

  s = await session('tim.jacobs@example.com', docs(d => { d['details/p14'].birthDate = day(1980, other); }));
  await s.go('home'); await s.page.waitForSelector('main h1');
  check(!(await s.page.$('.cel-card')), 'on any other day: no card');
  await finish(s);

  /* ---------- a widowed person's wedding anniversary is never celebrated ---------- */
  s = await session('tim.jacobs@example.com', docs(d => { Object.assign(d['details/p14'], { maritalStatus: 'Widowed', keyDates: [{ label: 'Wedding anniversary', date: day(2008, md) }] }); }));
  await s.go('home'); await s.page.waitForSelector('main h1');
  check(!(await s.page.$('.cel-card')) && !/anniversary/i.test(await s.page.textContent('.page-head')), 'widowed: no anniversary card');
  await finish(s);

  /* ---------- the church directory: 🎂 only for people whose entry carries the day ---------- */
  s = await session('tim.jacobs@example.com', docs(d => {
    d['directory/p15'] = { firstName: 'Clare', lastName: 'Jacobs', preferredName: '', birthDay: md };
    d['directory/p17'] = Object.assign({}, d['directory/p17'] || { firstName: 'X', lastName: 'Y', preferredName: '' });
    delete d['directory/p17'].birthDay;
  }));
  await s.go('people'); await s.page.waitForSelector('.pp-row');
  const clare = await s.page.textContent('a.pp-row[href="#/people/p/p15"]').catch(() => '');
  check(/Birthday today/.test(clare), 'a Church Partner sees 🎂 beside someone in the directory on their birthday');
  check(!/\b(19|20)\d\d\b/.test(clare), '…without a year');
  check((await s.page.$$('a.pp-row:has-text("Birthday today")')).length === 1, '…and nobody else has one');
  await s.go('people/p/p15'); await s.page.waitForSelector('main h1');
  check(/Birthday today/.test(await s.page.textContent('.page-head')), '…and on their page');
  await finish(s);

  /* ---------- Pastors: Birthdays this week, nobody who has died, and a hard day ---------- */
  s = await session('thandi.mokoena@example.com', docs(d => {
    d['details/p15'].birthDate = day(1982, md);
    d['details/p17'] = Object.assign({}, d['details/p17'], { birthDate: day(1950, md), deceasedAt: '2025-03-01' });
    d['people/p17'] = Object.assign({}, d['people/p17'], { category: 'Deceased', active: false });
    d['details/p18'] = Object.assign({}, d['details/p18'], { maritalStatus: 'Widowed', lateSpouseId: 'p17' });
    d['details/p17'].deceasedAt = day(2020, md);
  }));
  await s.go('home'); await s.page.waitForSelector('main h1');
  const week = (await s.page.textContent('.cel-week-card').catch(() => '')) || '';
  check(/Birthdays and anniversaries this week/.test(week) && /Clare Jacobs/.test(week), 'a Pastor sees Birthdays and anniversaries this week on Home');
  check(/May be a hard day/.test(week), '…and, as a Pastor, someone whose husband or wife died on this day');
  check(!/Happy/.test(week), '…which is never a celebration');
  await s.settle();
  check(/pastoral reminders/.test(JSON.stringify(await s.docsNow())), '…and seeing it is written in the audit log');
  await s.page.waitForTimeout(1700); await s.settle();
  const dir15 = (await s.docsNow())['directory/p15'] || {};
  check(dir15.birthDay === md && !/\d{4}/.test(JSON.stringify(dir15)), 'a Pastor signing in fills in the directory birthdays – the day only, never the year');
  await s.go('people/p/p17'); await s.page.waitForSelector('main h1');
  check(!/Birthday today/.test(await s.page.textContent('.page-head')), 'nobody who has died gets a 🎂');
  await finish(s);

  /* ---------- members don't get Birthdays this week ---------- */
  s = await session('tim.jacobs@example.com', docs(d => { d['details/p15'].birthDate = day(1982, md); }));
  await s.go('home'); await s.page.waitForSelector('main h1');
  check(!(await s.page.$('.cel-week-card')), 'a member who leads no group: no Birthdays this week');
  await finish(s);
};
