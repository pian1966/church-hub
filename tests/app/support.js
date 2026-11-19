/* Church & Trellis – browser test, part: the Subscription page – a coffee a month, paying, a payment holiday, gifts, the prayer
 * circle and the prayer card (js/mod-support.js; the rules are tested in tests/coffee.test.js).
 * One part of tests/app.test.js, which starts the browser and runs every part in turn: node tests/app.test.js */
'use strict';
module.exports = async function (ctx) {
  const { check, finish, seedDocs, session } = ctx;
  console.log('Subscription:');
  let s = await session('linda.pillay@example.com', seedDocs());
  await s.go('support'); let t = await s.text();
  check(/What does one cup cost where you live/.test(t) && /About R50/.test(t) && /Every church, however small/.test(t), 'an Administrator sees “one cup where you live”, in rand, starting at R50');
  check(/per church, not per person/.test(t) && /competes with the best church management systems/.test(t), 'the Subscription page says the price is per church, and that a low price is not a lesser product');
  check(await s.page.inputValue('#sp-cup') === '50' && /Who are you paying for/.test(t), 'the price box holds R50, and step 4 asks who you are paying for');
  await s.page.click('[data-act="support:kind"][data-k="street"]'); await s.page.fill('#sp-cup', '20'); await s.page.waitForTimeout(700);
  check(/R200/.test(await s.page.textContent('.sp-plans')), 'a church can choose a street-stall cup and type its own price (R20 → R200 a year)');
  await s.page.click('[data-act="support:kind"][data-k="chain"]'); await s.page.waitForTimeout(100);
  check(await s.page.inputValue('#sp-cup') === '50', 'choosing the coffee-chain cup puts back the price we know (R50)');
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
  // Every church must have a prayer card: Home asks the Administrator until there is one
  check(/Make your church’s prayer card/.test(await s.page.textContent('main')), 'Home asks the Administrator to make the church’s prayer card');
  // The prayer card: hidden when asked, warnings for phone numbers
  await s.go('support/card');
  check(/Take a photo/.test(await s.text()) && await s.page.getAttribute('.sp-photo-in[capture]', 'capture') === 'environment', 'the prayer card offers “Take a photo” (the phone’s camera) as well as “Choose a photo”');
  await s.page.fill('#sp-pt0', 'Rain for our farmers'); await s.page.fill('#sp-pt1', 'Call 082 123 4567');
  check(/phone number/.test(await s.page.textContent('#sp-w1')), 'a phone number in a prayer point is flagged');
  await s.page.click('[data-act="support:savecard"]'); await s.settle();
  docs = await s.docsNow();
  check(docs['settings/church'].prayerCard.points[0] === 'Rain for our farmers', 'the prayer card is saved in the church’s settings');
  await s.page.check('#sp-discreet'); await s.settle(); await s.page.waitForTimeout(200);
  check(/A church in Southern Africa/.test(await s.page.textContent('#sp-prev')) && !/Christ Church Howick|South Africa,/.test(await s.page.textContent('#sp-prev')), '“Keep us hidden” shows only a wide region to other churches');
  await s.go('home'); check(!/Make your church’s prayer card/.test(await s.page.textContent('main')), '…and stops once the card is made');
  // Once a month: look at the card again (change it, or keep it as it is)
  await s.page.evaluate(() => { const st = Store.settings(); Store.setSettings({ prayerCard: Object.assign({}, st.prayerCard, { updated: '2020-01-01' }) }); });
  await s.go('support'); await s.go('home'); check(/Time to look at your prayer card/.test(await s.page.textContent('main')), 'a month later, Home asks the Administrator to look at the prayer card again');
  await s.page.click('main [data-act="support:keepcard"]'); await s.settle();
  docs = await s.docsNow();
  check(docs['settings/church'].prayerCard.updated > '2020-01-01' && !/Time to look at your prayer card/.test(await s.page.textContent('main')), '“Keep it as it is” counts as looking at it, and the reminder goes');
  // The weekly prayer card: a paying church's Administrator may turn it off; a church that prays instead may not
  await s.go('support/pray');
  check(await s.page.isChecked('#sp-cardson') && !(await s.page.isDisabled('#sp-cardson')), 'a paying church’s Administrator sees the weekly prayer card switched on, and may turn it off');
  await s.page.click('#sp-cardson'); await s.settle();
  docs = await s.docsNow();
  check(docs['settings/church'].support.cardsOff === true && /turned off the weekly prayer card/.test(await s.text()), 'turning it off is saved, and the page says so');
  await s.page.click('main [data-act="support:cardson"]'); await s.settle();
  docs = await s.docsNow(); check(docs['settings/church'].support.cardsOff === false, '…and it can be turned on again');
  await s.page.evaluate(() => { const st = Store.settings(); Store.setSettings({ support: Object.assign({}, st.support, { plan: 'pray', cardsOff: true }) }); });
  await s.go('home'); await s.go('support/pray');
  check(await s.page.isChecked('#sp-cardson') && await s.page.isDisabled('#sp-cardson') && /stays on/.test(await s.text()), 'a church that prays instead of paying can’t turn the weekly prayer card off');
  await finish(s);

  // A member: no Subscription page
  s = await session('grace.ndlovu@example.com', seedDocs());
  await s.go('support'); check(!/Choose your coffee/.test(await s.text()), 'members can’t open the Subscription page');
  await finish(s);
};
