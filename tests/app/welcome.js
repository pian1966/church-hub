/* Church & Trellis – browser test, part: inviting people to start using Church & Trellis (js/people/welcome.js), the welcome
 * on the sign-in screen (js/app.js welcomeCard), the day someone first signs in (appFirstSeen) and People → Invitations.
 * One part of tests/app.test.js, which starts the browser and runs every part in turn: node tests/app.test.js */
'use strict';
module.exports = async function (ctx) {
  const { check, finish, seedDocs, session, BASE } = ctx;
  let s, docs, t;
  console.log('Inviting people to Church & Trellis:');
  const seed = seedDocs(); seed['people/p11'].appRole = 'none';   // Priya can't sign in yet
  s = await session('linda.pillay@example.com', seed); await s.go('people/search'); await s.page.waitForSelector('#adv');
  await s.page.selectOption('.adv-field[data-i="0"]', 'category'); await s.page.selectOption('.adv-v[data-i="0"]', 'Attender');
  await s.page.click('[data-act="people:advrun"]'); await s.page.waitForSelector('[data-act="people:advapp"]');
  check(/Invite everyone found to Church & Trellis/.test(await s.page.textContent('[data-act="people:advapp"]')), 'Advanced search: “Invite everyone found to Church & Trellis”');
  await s.page.click('[data-act="people:advapp"]'); await s.page.waitForSelector('#ia-body');
  t = await s.page.textContent('#modal');
  check(/2 people are left out/.test(t) && await s.page.isChecked('#ia-access') && /Give 1 person Basic access/.test(t), 'the children are left out; Priya can be given Basic access');
  check(/#\/start/.test(await s.page.inputValue('#ia-body')) && /Dear friends,/.test(await s.page.inputValue('#ia-body')), 'the message has the welcome link (#/start)');
  check(await s.page.isVisible('[data-act="people:welqr"]'), 'and a QR code to show');
  await s.page.evaluate(() => { Emails.getMethod = () => 'gmail'; window.open = u => { window.__opened = u; }; });
  await s.page.click('[data-act="people:welsend"]'); await s.settle(); docs = await s.docsNow();
  const opened = await s.page.evaluate(() => window.__opened || '');
  check(docs['people/p11'].appRole === 'member' && docs['details/p10'].appInvited && docs['details/p11'].appInvited, 'Email the invitation: Priya gets Basic access, and both are marked as invited');
  check(/bcc=jason\.naidoo%40example\.com%2Cpriya\.naidoo%40example\.com|bcc=jason\.naidoo@example\.com,priya\.naidoo@example\.com/.test(opened), 'one email, with both in Bcc');
  await s.go('people/p/p11'); t = await s.text();
  check(/Invited to Church & Trellis on .* – not signed in yet/.test(t) && /Remind them/.test(await s.page.textContent('[data-act="people:welinvite"]')), 'her page says she was invited and hasn’t signed in, with Remind them');
  await s.page.click('[data-act="people:welinvite"]'); await s.page.waitForSelector('#ia-body');
  await s.page.evaluate(() => { window.open = u => { window.__wa = u; }; });
  check(/Remind them about Church & Trellis/.test(await s.page.textContent('#modal')), 'Remind them: the same invitation again');
  await s.page.evaluate(() => { document.querySelector('details.ia-wa').open = true; });
  await s.page.click('[data-act="people:welwa"]'); const wa = await s.page.evaluate(() => window.__wa || '');
  check(/^https:\/\/wa\.me\/\d+\?text=/.test(wa) && /Dear%20Priya%2C/.test(wa) && /priya\.naidoo%40example\.com/.test(wa), 'WhatsApp: greets Priya by name and names her email address');
  await s.page.click('[data-act="hub:close"]').catch(() => {});
  await s.go('people/welcome'); t = await s.text();
  check(/Not signed in yet/.test(t) && /Priya/.test(t) && /Jason/.test(t) && await s.page.isVisible('[data-act="people:welremindall"]'), 'People → Invitations: both are waiting, with Remind all');
  await finish(s);

  // Priya signs in for the first time: the day is noted on her record
  const after = JSON.parse(JSON.stringify(docs));
  s = await session('priya.naidoo@example.com', after); await s.settle(); docs = await s.docsNow();
  check(!!docs['people/p11'].appFirstSeen, 'her first sign-in is noted (appFirstSeen)');
  await finish(s);
  s = await session('linda.pillay@example.com', JSON.parse(JSON.stringify(docs))); await s.go('people/welcome'); t = await s.text();
  check(/Started/.test(t) && /Signed in for the first time on/.test(t), 'Invitations: Priya has started');
  await s.go('people/p/p11'); check(/Using Church & Trellis since/.test(await s.text()), 'her page says since when she uses Church & Trellis');
  await finish(s);

  // The link in the invitation, on an Android phone that isn't signed in
  const android = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';
  s = await session(null, seedDocs(), { ua: android }); await s.page.goto(BASE + '#/start'); await s.page.reload(); await s.page.waitForSelector('.signin-card h1');   // opened fresh from the message
  t = await s.page.textContent('.signin-card');
  check(/Welcome!/.test(t) && /has invited you to Church & Trellis/.test(t) && /Get the app for Android/.test(t), 'the welcome link: a welcome and, on Android, Get the app');
  await s.close();
  s = await session('jason.naidoo@example.com', seedDocs(), { ua: android }); await s.go('home');
  check(await s.page.isVisible('#android-ask'), 'Home on an Android phone offers the app');
  await s.page.click('#android-ask [data-act="hub:later"]'); await s.page.waitForTimeout(100);
  check(!(await s.page.$('#android-ask')), '… until Not now');
  await finish(s);
};
