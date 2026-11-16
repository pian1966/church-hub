/* Church Hub – browser test, part: the Subscription page – a coffee a month, paying, a payment holiday, gifts, the prayer
 * circle and the prayer card (js/mod-support.js; the rules are tested in tests/coffee.test.js).
 * One part of tests/app.test.js, which starts the browser and runs every part in turn: node tests/app.test.js */
'use strict';
module.exports = async function (ctx) {
  const { check, finish, seedDocs, session } = ctx;
  console.log('Subscription:');
  let s = await session('linda.pillay@example.com', seedDocs());
  await s.go('support'); let t = await s.text();
  check(/one coffee a month/i.test(t) && /R50/.test(t) && /Every church, however small/.test(t), 'an Administrator sees the coffee subscription, priced in rand');
  await s.page.click('[data-act="support:cur"][data-c="USD"]'); t = await s.text();
  check(/US\$/.test(t), 'prices can be shown in US dollars');
  await s.page.click('[data-act="support:cur"][data-c="ZAR"]');
  await s.page.click('[data-act="support:plan"][data-p="month"]'); await s.page.click('[data-act="support:cups"][data-n="2"]');
  check(/R150/.test(await s.page.textContent('.sp-total')), 'two gift coffees are added to the month’s coffee (R150)');
  await s.page.click('.sp-total [data-act="support:pay"]'); await s.page.waitForSelector('.sp-bank');
  t = await s.page.textContent('.sp-bank');
  check(/Capitec/.test(t) && /470010/.test(t) && /CH-[0-9A-Z]{6}/.test(t), 'Pay shows the bank details and the church’s own reference');
  await s.page.click('[data-act="support:paid"]'); await s.settle();
  let docs = await s.docsNow(), sup = docs['settings/church'].support || {};
  check(sup.plan === 'month' && !!sup.paidUntil && sup.payments.length === 1 && sup.payments[0].amount === 150, '“We’ve paid” records the payment and starts the monthly plan');
  check(await s.page.isVisible('.sp-status') && /Paid until/.test(await s.page.textContent('.sp-status')), 'the page now shows “Your subscription”');
  // Due soon: Home reminds the Administrator, with one-tap gifts and a payment holiday
  const due = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
  await s.page.evaluate(d => { const st = Store.settings(); Store.setSettings({ support: Object.assign({}, st.support, { paidUntil: d }) }); }, due);
  await s.go('home'); t = await s.page.textContent('main');
  check(/Your next coffee is due in 3 days/.test(t) && await s.page.isVisible('.sp-status [data-act="support:extra"]'), 'Home reminds the Administrator a few days before the coffee is due, with gift coffees to add');
  await s.page.click('.sp-status [data-act="support:holiday"]'); await s.page.waitForSelector('#sp-hol-why');
  await s.page.fill('#sp-hol-why', 'A hard month'); await s.page.click('[data-act="support:takehol"]'); await s.settle();
  docs = await s.docsNow(); sup = docs['settings/church'].support;
  check(sup.holidays.length === 1 && sup.paidUntil > due && sup.holidays[0].reason === 'A hard month', 'a payment holiday moves the due date a month later');
  await s.go('home'); check(!(await s.page.$('.sp-status')), '…and the reminder goes away');
  // The prayer card: hidden when asked, warnings for phone numbers
  await s.go('support/card');
  await s.page.fill('#sp-pt0', 'Rain for our farmers'); await s.page.fill('#sp-pt1', 'Call 082 123 4567');
  check(/phone number/.test(await s.page.textContent('#sp-w1')), 'a phone number in a prayer point is flagged');
  await s.page.click('[data-act="support:savecard"]'); await s.settle();
  docs = await s.docsNow();
  check(docs['settings/church'].prayerCard.points[0] === 'Rain for our farmers', 'the prayer card is saved in the church’s settings');
  await s.page.check('#sp-discreet'); await s.settle(); await s.page.waitForTimeout(200);
  check(/A church in Southern Africa/.test(await s.page.textContent('#sp-prev')) && !/Christ Church Howick|South Africa,/.test(await s.page.textContent('#sp-prev')), '“Keep us hidden” shows only a wide region to other churches');
  // The prayer circle
  await s.go('support/pray'); await s.page.click('main [data-act="support:promise"]'); await s.page.waitForSelector('#sp-vow-ok');
  await s.page.check('#sp-vow-ok'); await s.page.click('[data-act="support:vow"]'); await s.settle();
  docs = await s.docsNow(); sup = docs['settings/church'].support;
  check(sup.pledge && sup.pledge.at && sup.plan === 'month', 'joining the prayer circle records the promise and keeps the church paying');
  check(/Our promise/.test(await s.text()), 'the Pray page shows the promise straight away');
  await finish(s);

  // A member: no Subscription page
  s = await session('grace.ndlovu@example.com', seedDocs());
  await s.go('support'); check(!/Choose your coffee/.test(await s.text()), 'members can’t open the Subscription page');
  await finish(s);
};
