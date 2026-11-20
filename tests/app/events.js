/* Church & Trellis – browser test, part: Events – organisers put events up, people sign up, reminders 3 days and 1 day
 * before (js/mod-events.js; the rules are tested in tests/events.test.js and tests/rules.test.mjs, the email robot in
 * tests/event-mail.test.js). One part of tests/app.test.js: node tests/app.test.js */
'use strict';
module.exports = async function (ctx) {
  const { check, finish, seedDocs, session } = ctx;
  console.log('Events:');
  const seed = seedDocs();
  const pad = n => (n < 10 ? '0' : '') + n, inDays = n => { const d = new Date(Date.now() + n * 864e5); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };

  // Thandi, a Pastor – an organiser until the church chooses: sees who's coming, puts up a new event
  let s = await session('thandi.mokoena@example.com', seed);
  await s.go('events'); let t = await s.text();
  check(/Men’s breakfast/.test(t) && /Church Partners’ evening/.test(t) && /Carols by candlelight/.test(t) && await s.page.isVisible('[data-act="events:new"]'), 'an organiser sees the events and New event');
  check(/3 coming/.test(t), 'the card shows how many are coming (Tim, Clare and a guest)');
  await s.go('events/e/ev1'); t = await s.text();
  check(/Who’s coming/.test(t) && /Tim Jacobs, Clare Jacobs/.test(t) && /\+ 1 guest/.test(t), 'Who’s coming lists them, with the guest');
  // The sign-up report: everyone coming, with their cellphone numbers, ready to print or save as a PDF
  await s.page.click('.ev-who-h [data-act="events:report"]'); await s.page.waitForSelector('[data-act="events:repprint"]');
  t = await s.page.textContent('#ev-rep');
  check(/Men’s breakfast/.test(t) && /1 event · 3 coming/.test(t), 'the report starts with this event chosen');
  await s.page.evaluate(() => { window.print = () => { window.__printed = document.getElementById('print-only').innerHTML; }; });
  await s.page.click('[data-act="events:repprint"]'); await s.page.waitForFunction(() => !!window.__printed);
  const tim = (await s.docsNow())['people/p14'], pr = await s.page.evaluate(() => window.__printed);
  check(/Tim Jacobs, Clare Jacobs/.test(pr) && !!tim.mobile && pr.includes(tim.mobile) && /Cellphone/.test(pr) && /shred it after the event/.test(pr), 'printed: who is coming, with their cellphone numbers, and a reminder to keep it safe');
  await s.page.evaluate(() => { document.documentElement.classList.remove('printing'); document.getElementById('print-only').innerHTML = ''; });
  await s.go('events'); await s.page.click('[data-act="events:new"]'); await s.page.waitForSelector('#ev-title');
  await s.page.click('[data-act="events:save"]');
  check(/Give the event a name/.test(await s.page.textContent('#ev-err')), 'an event needs a name');
  await s.page.fill('#ev-title', 'Youth braai'); await s.page.fill('#ev-date', inDays(2)); await s.page.fill('#ev-time', '17:00'); await s.page.fill('#ev-guests', '2');
  await s.page.click('[data-act="events:save"]'); await s.settle();
  let docs = await s.docsNow(), id = Object.keys(docs).find(k => k.startsWith('events/') && docs[k].title === 'Youth braai');
  check(!!id && docs[id].signup === true && docs[id].email === true && docs[id].guests === 2 && docs[id].status === 'live' && docs[id].byName === 'Thandi Mokoena', 'put up: with sign-up, guests and email reminders offered');
  check(new RegExp('#/events/e/').test(s.page.url()) && /Nobody has signed up yet/.test(await s.text()), 'it opens, ready for sign-ups');
  id = id.split('/')[1];
  await finish(s);

  // Tim, a Church Partner: is going to the breakfast; signs up for the braai with two guests and email reminders
  const seed2 = Object.assign({}, seed, await (async () => { const o = {}; Object.keys(docs).filter(k => k.startsWith('events/')).forEach(k => { o[k] = docs[k]; }); return o; })());
  s = await session('tim.jacobs@example.com', seed2, { ua: 'Mozilla/5.0 (Linux; Android 14) Mobile' });
  await s.go('events'); t = await s.text();
  check(/You’re going/.test(t) && /Youth braai/.test(t) && !(await s.page.isVisible('[data-act="events:new"]')), 'he sees he is going to the breakfast; no New event for him');
  await s.go('events/e/' + id); await s.page.click('.page-head [data-act="events:join"]'); await s.page.waitForSelector('.ev-people');
  check(await s.page.$eval('.ev-person.on', b => b.textContent.includes('Tim')) && /count as guests/.test(await s.page.textContent('#modal')), 'he is coming; family members who can’t be shown come as guests');
  await s.page.click('[data-act="events:step"][data-d="1"]'); await s.page.click('[data-act="events:step"][data-d="1"]'); await s.page.click('[data-act="events:step"][data-d="1"]');
  check(await s.page.textContent('#ev-g') === '2', 'no more guests than the event allows');
  await s.page.click('label.ev-switch:has(#ev-mail)'); await s.page.fill('#ev-mail-to', 'tim.jacobs@example.com');
  await s.page.click('[data-act="events:signup"]'); await s.settle();
  docs = await s.docsNow(); const su = docs['eventSignups/' + id + '_p14'];
  check(!!su && su.people.join() === 'p14' && su.guests === 2 && su.email === 'tim.jacobs@example.com' && su.lang === 'en', 'signed up: him and two guests, email reminders to his address');
  check(/You’re going/.test(await s.text()) && /And by email/.test(await s.text()), 'the event says he’s going, with reminders in Messages and by email');
  // The braai is 2 days away: his own Church & Trellis writes the 3-day reminder into his Messages (once)
  await s.page.waitForFunction(i => !!window.__fake.docs['messages/er_' + i + '_p14_3'], id, { timeout: 15000 });
  await s.settle(); docs = await s.docsNow(); const rm = docs['messages/er_' + id + '_p14_3'];
  check(rm.kind === 'event' && rm.about === 'remind' && rm.to.join() === 'p14' && /Reminder: Youth braai/.test(rm.title) && /in 2 days/.test(rm.body), 'the reminder arrives in his Messages: “Youth braai is in 2 days”');
  check(!docs['messages/er_ev1_p14_3'], 'nothing yet for the breakfast, 5 days away');
  await s.go('messages'); t = await s.text();
  check(/Reminder: Youth braai/.test(t) && await s.page.isVisible('a[href="#/events/e/' + id + '"]'), 'Messages shows it, with Open the event');
  await s.go('messages/sent'); check(!/Reminder: Youth braai/.test(await s.text()), 'it isn’t listed as a message he sent');
  await s.page.waitForTimeout(3000);
  docs = await s.docsNow(); check(Object.keys(docs).filter(k => k.startsWith('messages/er_')).length === 1, 'and it is written only once');
  await finish(s);

  // Sipho, a Roster coordinator – on the staff, not an organiser: sees who's coming, and adds Jason and Priya from a paper sheet
  s = await session('sipho.dlamini@example.com', seed2);
  await s.go('events/e/ev1'); t = await s.text();
  check(/Who’s coming/.test(t) && /Tim Jacobs, Clare Jacobs/.test(t) && await s.page.isVisible('[data-act="events:add"]') && !(await s.page.isVisible('.page-head details.menu')), 'staff see who’s coming and Add people (not the organisers’ menu)');
  await s.page.click('[data-act="events:add"]'); await s.page.waitForSelector('#modal .cg-q');
  await s.page.fill('#modal .cg-q', 'Tim'); await s.page.waitForSelector('#modal .cg-pick');
  check(/Already coming/.test(await s.page.textContent('#modal .cg-hits')), 'Tim shows as already coming');
  await s.page.fill('#modal .cg-q', 'Jason'); await s.page.waitForSelector('#modal .cg-pick:has-text("Jason")');
  await s.page.click('#modal .cg-pick:has-text("Jason")'); await s.page.waitForSelector('[data-act="events:addsave"]');
  await s.page.click('.ev-person:has-text("Priya")');
  await s.page.click('[data-act="events:addsave"]'); await s.settle();
  docs = await s.docsNow(); const added = docs['eventSignups/ev1_p10'];
  check(!!added && added.people.join() === 'p10,p11' && added.addedBy === 'p05' && !added.email, 'Jason and Priya are on the list, in Jason’s name, marked as added by Sipho');
  check(await s.page.isVisible('#modal .cg-q'), 'ready for the next name on the sheet');
  await s.page.click('#modal .dlg-foot [data-act="hub:close"]');
  check(/Added by Sipho Dlamini/.test(await s.text()) && /Jason Naidoo, Priya Naidoo/.test(await s.text()), 'the list shows them, and who added them');
  await finish(s);

  // Jason, who only comes to church (an attendee): sees events for everyone, not the Church Partners' evening
  s = await session('jason.naidoo@example.com', seed2);
  await s.go('events'); t = await s.text();
  check(/Men’s breakfast/.test(t) && !/Church Partners’ evening/.test(t), 'an attendee sees the events for everyone only');
  await s.go('events/e/ev1'); await s.page.click('.page-head [data-act="events:join"]'); await s.page.waitForSelector('[data-act="events:signup"]');
  await s.page.click('[data-act="events:signup"]'); await s.settle();
  docs = await s.docsNow(); check(!!docs['eventSignups/ev1_p10'], 'and can sign up');
  await s.page.click('[data-act="events:leave"]'); await s.page.click('[data-act="events:leave"]'); await s.settle();
  docs = await s.docsNow(); check(!docs['eventSignups/ev1_p10'], '“I can’t come after all” takes him off the list');
  await finish(s);

  // Thandi cancels the braai: everyone coming is told
  const seed3 = Object.assign({}, seed2, { ['eventSignups/' + id + '_p14']: su });
  s = await session('thandi.mokoena@example.com', seed3);
  await s.go('events/e/' + id); await s.page.click('.page-head details.menu summary'); await s.page.click('[data-act="events:cancel"]'); await s.page.waitForSelector('#ev-mb');
  await s.page.click('[data-act="events:send"]'); await s.settle();
  docs = await s.docsNow(); const told = Object.keys(docs).map(k => docs[k]).find(m => m.kind === 'event' && m.about === 'event' && m.aboutId === id);
  check(docs['events/' + id].status === 'cancelled' && !!told && told.to.join() === 'p14' && /Cancelled: Youth braai/.test(told.title), 'cancelled, and Tim is told in Messages');
  check(/This event has been cancelled/.test(await s.text()), 'the event says it was cancelled');
  await finish(s);
};
