/* Church Hub – browser test, part: signing in: strangers, the sign-in screen, email links, the Android app, iPhone, downloads, first-time setup.
 * One part of tests/app.test.js, which starts the browser and runs every part in turn: node tests/app.test.js */
'use strict';
module.exports = async function (ctx) {
  const { BASE, PNG, check, finish, seedDocs, session, tour } = ctx;
  let docs, s, t;
  console.log('Stranger:');
  s = await session('stranger@example.com', seedDocs());
  check((await s.page.textContent('.signin-card')).includes('No access yet'), 'is told they have no access');
  await finish(s);

  /* ---------- Signed out: sign-in screen ---------- */
  console.log('Sign-in screen:');
  s = await session('', seedDocs());
  const card = await s.page.textContent('.signin-card');
  check(card.includes('Sign in with Google') && card.includes('Email me a link') && card.includes('Try the demo'), 'offers Google, email link and the demo');
  await s.page.fill('#si-email', 'tim.jacobs@example.com'); await s.page.click('[data-act="hub:sendlink"]'); await s.settle();
  check((await s.page.textContent('.signin-card')).includes('Check your email'), 'email link: asks them to check their email');
  await s.page.click('[data-act="hub:restart"]');
  await s.page.evaluate(() => { window.__fake.nextUser = { email: 'Tim.Jacobs@example.com', emailVerified: true }; });
  await s.page.click('[data-act="hub:google"]'); await s.page.waitForSelector('.app', { timeout: 5000 }).catch(() => {});
  check(!!(await s.page.$('.app')), 'Google sign-in works (email in any capitals)');
  // Going Back past the first screen asks first
  await s.page.goBack().catch(() => {}); await s.page.waitForSelector('[data-act="hub:stay"]', { timeout: 3000 }).catch(() => {});
  check((await s.page.textContent('#modal').catch(() => '')).includes('Leave Church Hub?'), 'Back past the first screen asks “Leave Church Hub?”');
  await s.page.click('[data-act="hub:stay"]'); await s.settle();
  check(!!(await s.page.$('.app')) && !(await s.page.$('#modal .overlay')), '“Stay” keeps them in Church Hub');
  await s.page.click('.side [data-act="hub:signout"]');
  check((await s.page.textContent('#modal')).includes('Sign out of Church Hub?') && !!(await s.page.$('.app')), 'Sign out asks first');
  await s.page.click('[data-act="hub:signoutyes"]'); await s.settle();
  check((await s.page.textContent('.signin-card')).includes('Sign in with Google'), 'signing out returns to the sign-in screen');
  await finish(s);

  console.log('Email link opened in a different browser (e.g. tapped in Gmail):');
  s = await session('', seedDocs());
  await s.page.goto(BASE + '?apiKey=x&mode=signIn&oobCode=abc'); await s.page.waitForSelector('.signin-card h1'); await s.page.waitForTimeout(300);
  check((await s.page.textContent('.signin-card')).includes('Confirm your email'), 'asks them to confirm their email (and the question stays on screen)');
  await s.page.evaluate(() => { window.__fake.nextUser = { email: 'tim.jacobs@example.com', emailVerified: true }; });
  await s.page.fill('#si-email', 'tim.jacobs@example.com'); await s.page.click('[data-act="hub:finishlink"]'); await s.page.waitForSelector('.app', { timeout: 5000 }).catch(() => {});
  check(!!(await s.page.$('.app')) && await s.page.evaluate(() => window.__fake.linkSignIns[0][0] === 'tim.jacobs@example.com'), 'typing the email signs them in');
  await finish(s);

  console.log('In the Android app:');
  s = await session('', seedDocs(), { app: { clientId: 'web-client.apps.googleusercontent.com' } });
  await s.page.evaluate(() => { window.__fake.nextUser = { email: 'tim.jacobs@example.com', emailVerified: true }; });
  await s.page.click('[data-act="hub:google"]'); await s.page.waitForSelector('.app', { timeout: 5000 }).catch(() => {});
  check(await s.page.evaluate(() => window.__appGoogle === 'web-client.apps.googleusercontent.com' && window.__fake.credentials[0] === 'id-token-for-web-client.apps.googleusercontent.com'), 'Sign in with Google uses Android’s account picker and gives Firebase its ID token');
  check(!!(await s.page.$('.app')) && (await s.page.evaluate(() => location.hash)) === '#/me', 'members open on Me in the app');
  t = await s.text(); check(t.includes('Church Hub app, version 1.0.7'), 'Me shows the app version');
  await s.page.click('[data-act="people:edit"]'); check(await s.page.evaluate(() => window.churchHubBack() === true && !document.querySelector('#modal .overlay')), 'the back button closes an open window first');
  check(await s.page.evaluate(() => window.churchHubBack() === false), '…then lets the app go back a page');
  await finish(s);

  console.log('iPhone: home-screen app and the photo prompt:');
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  s = await session('tim.jacobs@example.com', seedDocs(), { ua: IPHONE });
  await s.go('home'); t = await s.text();
  check(t.includes('Church Hub on your iPhone') && t.includes('Add to Home Screen') && !t.includes('Add a photo of yourself'), 'iPhone in Safari: how to put Church Hub on the home screen (no photo prompt in a browser)');
  await s.page.click('[data-act="hub:later"][data-k="iphone"]'); await s.go('me'); await s.go('home');
  check(!(await s.text()).includes('Church Hub on your iPhone'), '“Not now” puts it away');
  await finish(s);
  s = await session('tim.jacobs@example.com', seedDocs(), { ua: IPHONE, standalone: true });
  await s.go('me'); t = await s.text();
  check(t.includes('Add a photo of yourself') && !t.includes('Church Hub on your iPhone'), 'home-screen app: asks for a photo of yourself on My details');
  await s.page.setInputFiles('#selfie-file', PNG); await s.page.waitForSelector('#crop-ok'); await s.page.click('#crop-ok'); await s.settle(); docs = await s.docsNow();
  check(docs['photos/p14'] && docs['people/p14'].photo && !(await s.text()).includes('Add a photo of yourself'), 'they take or choose one, choose the face, and the prompt goes');
  await finish(s);
  s = await session('clare.jacobs@example.com', seedDocs(), { ua: IPHONE, standalone: true });
  await s.go('me'); await s.page.click('[data-act="hub:later"][data-k="selfie"]'); await s.go('home'); await s.go('me');
  check(!(await s.text()).includes('Add a photo of yourself'), '“Not now” waits (a month)');
  await finish(s);

  console.log('Downloads in the Android app:');
  s = await session('linda.pillay@example.com', seedDocs(), { app: { saveFile: true } });
  await s.go('people/search'); await s.page.fill('input.adv-v[data-i="0"]', 'Jacobs'); await s.page.click('[data-act="people:advrun"]'); await s.page.click('[data-act="people:advcsv"]'); await s.page.waitForTimeout(100);
  const saved = await s.page.evaluate(() => window.__saved);
  check(saved && /^people-search-.*\.csv$/.test(saved.n) && saved.m === 'text/csv' && saved.t.split('\n').length >= 3, 'Download (CSV) goes to the app, which saves it in the phone’s Downloads');
  await finish(s);
  s = await session('linda.pillay@example.com', seedDocs(), { app: {} });
  await s.go('people/search'); await s.page.fill('input.adv-v[data-i="0"]', 'Jacobs'); await s.page.click('[data-act="people:advrun"]'); await s.page.click('[data-act="people:advcsv"]'); await s.page.waitForTimeout(100);
  check((await s.page.textContent('#toast')).includes('update the Church Hub app'), 'an older app version is asked to update instead of nothing happening');
  await finish(s);

  s = await session('', seedDocs(), { app: {} });
  check(!(await s.page.$('[data-act="hub:google"]')), 'app without a Google client ID: only the email link is offered');
  await s.page.fill('#si-email', 'tim.jacobs@example.com'); await s.page.click('[data-act="hub:sendlink"]'); await s.settle();
  check(!!(await s.page.$('#si-link')) && (await s.page.textContent('.signin-card')).includes('Press and hold the sign-in link'), 'after sending the link, the app explains how to paste it');
  await s.page.fill('#si-link', 'https://example.com/not-a-link'); await s.page.click('[data-act="hub:pastelink"]');
  check(await s.page.isVisible('#si-err'), 'a wrong link is refused with an explanation');
  await s.page.evaluate(() => { window.__fake.nextUser = { email: 'tim.jacobs@example.com', emailVerified: true }; });
  const link = 'https://church-hub.firebaseapp.com/__/auth/action?apiKey=x&mode=signIn&oobCode=abc&continueUrl=x';
  await s.page.fill('#si-link', link); await s.page.click('[data-act="hub:pastelink"]'); await s.page.waitForSelector('.app', { timeout: 5000 }).catch(() => {});
  check(!!(await s.page.$('.app')) && await s.page.evaluate(l => JSON.stringify(window.__fake.linkSignIns[0]) === JSON.stringify(['tim.jacobs@example.com', l]), link), 'pasting the link from the email signs them in');
  await finish(s);

  /* ---------- First Administrator on an empty database ---------- */
  console.log('First-time setup:');
  s = await session('first.admin@example.com', seedDocs({ empty: true }));
  check((await s.page.textContent('.signin-card')).includes('Set up Church Hub'), 'first Administrator is asked to set up the church');
  await s.page.fill('#su-first', 'Test'); await s.page.fill('#su-last', 'Admin'); await s.page.click('[data-act="hub:setup"]');
  await s.page.waitForSelector('.app', { timeout: 5000 }).catch(() => {});
  docs = await s.docsNow();
  check(!!(await s.page.$('.app')) && docs['settings/church'] && docs['leave/config'] && docs['roles/first.admin@example.com'].personId, 'setup creates settings, leave rules and their own record, then opens the app');
  await tour(s, 'admin');
  await finish(s);

  console.log('Second Administrator added by hand:');
  const withSecond = seedDocs(); withSecond['roles/second.admin@example.com'] = { role: 'admin' };
  s = await session('second.admin@example.com', withSecond);
  const sc = await s.page.textContent('.signin-card');
  check(sc.includes('Welcome') && !(await s.page.$('#su-church')), 'is only asked for their name, not to set up the church again');
  await s.page.fill('#su-first', 'Second'); await s.page.fill('#su-last', 'Admin'); await s.page.click('[data-act="hub:setup"]');
  await s.page.waitForSelector('.app', { timeout: 5000 }).catch(() => {});
  docs = await s.docsNow();
  check(!!(await s.page.$('.app')) && docs['settings/church'].churchName === 'Christ Church Howick' && Object.keys(docs).some(k => k.startsWith('people/') && docs[k].firstName === 'Second'), 'church settings kept; their own record created');
  await finish(s);


  /* ---------- Members with no email: a sign-in code once, then their number and a PIN ---------- */
  console.log('Sign-in codes and PINs:');
  s = await session('linda.pillay@example.com', seedDocs());
  await s.go('people/p/p17'); await s.page.click('[data-act="people:givecode"]'); await s.page.click('[data-act="people:makecode"]');
  await s.page.waitForSelector('.code-big', { timeout: 5000 });
  const code = (await s.page.textContent('.code-big')).trim(), plain = code.replace('-', '');
  docs = await s.docsNow();
  const audits = JSON.stringify(Object.keys(docs).filter(k => k.startsWith('audit/')).map(k => docs[k]));
  check(/^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/.test(code) && (docs['invites/' + plain] || {}).personId === 'p17' && docs['invites/' + plain].role === 'member' && audits.includes('Gave a sign-in code') && !audits.includes(plain),
    'an Administrator gives a code: a Member invite for that person, audit-logged without the code');
  check((docs['pinLogins/dial'] || {}).dial === '27' && docs['invites/' + plain].dial === '27', 'the church’s calling code is kept for numbers typed the local way (082…)');
  await s.page.click('#modal [data-act="hub:close"]');
  const withCode = await s.docsNow(); await finish(s);
  s = await session('', withCode);
  let card2 = await s.page.textContent('.signin-card');
  check(card2.includes('I have a sign-in code') && card2.includes('Sign in with my number'), 'the sign-in screen offers “Sign in with my number” and “I have a sign-in code”');
  await s.page.click('[data-act="hub:havecode"]'); await s.page.fill('#si-code', 'ZZZZ-ZZZZ'); await s.page.click('[data-act="hub:claimcode"]');
  await s.page.waitForSelector('#si-err:not([hidden])', { timeout: 5000 }).catch(() => {});
  check((await s.page.textContent('.signin-card')).includes('wasn’t found'), 'a wrong code is turned away kindly');
  await s.page.goto(BASE + '?j=' + code); await s.page.waitForSelector('[data-act="hub:codeyes"]', { timeout: 5000 }).catch(() => {});
  check((await s.page.textContent('.signin-card')).includes('Megan S.') && !(await s.page.url()).includes('j='), 'the code’s link asks “Is this you?” with their name (and the code leaves the address)');
  await s.page.click('[data-act="hub:codeyes"]'); await s.page.waitForSelector('#si-pin2', { timeout: 5000 }).catch(() => {});
  check((await s.page.textContent('.signin-card')).includes('Choose your PIN'), '“Yes, that’s me”: they choose a PIN');
  const pinErr = async (num, a, b) => {
    if (num !== null) await s.page.fill('#si-num', num);
    await s.page.fill('#si-pin', a); await s.page.fill('#si-pin2', b); await s.page.click('[data-act="hub:pinset"]');
    return (await s.page.textContent('#si-err')) || '';
  };
  check((await pinErr('082 555 0101', '123456', '123456')).includes('easy to guess') && (await pinErr(null, '111111', '111111')).includes('easy to guess'), 'an easy PIN (123456, 111111) is refused');
  check((await pinErr(null, '480215', '480216')).includes('aren’t the same') && (await pinErr(null, '48021', '48021')).includes('6 numbers'), 'the two PINs must match and have 6 numbers');
  await s.page.fill('#si-pin', '480215'); await s.page.fill('#si-pin2', '480215'); await s.page.click('[data-act="hub:pinset"]');
  await s.page.waitForSelector('.app', { timeout: 8000 }).catch(() => {}); await s.settle();
  docs = await s.docsNow();
  const PIN_DOC = /^roles\/c?\d+-\d+@pin\.church-hub\.invalid$/;
  const dev = 'roles/27825550101-1@pin.church-hub.invalid', uid1 = (docs[dev] || {}).uid;
  check(!!(await s.page.$('.app')) && uid1 && docs[dev].personId === 'p17' && docs[dev].role === 'member' && docs[dev].login === '27825550101' && docs['invites/' + plain].usedBy === uid1
    && JSON.stringify(docs['pinLogins/27825550101']) === JSON.stringify({ v: 1, uid: uid1 }), 'the PIN is set: Member access for that person, their number recorded, the code spent');
  const accounts = await s.page.evaluate(() => window.__fake.accounts);
  check(accounts['27825550101-1@pin.church-hub.invalid'] && accounts['27825550101-1@pin.church-hub.invalid'].uid === uid1, 'their sign-in is the same account, now with the number and PIN');
  await s.page.click('.side [data-act="hub:signout"]');
  check((await s.page.textContent('#modal')).includes('cellphone number and PIN'), 'signing out says they’ll sign in again with their number and PIN');
  await s.page.click('[data-act="hub:signoutyes"]'); await s.settle();
  docs = await s.docsNow();
  check(!!docs[dev], 'signing out leaves the PIN sign-in working');
  await s.page.click('[data-act="hub:pinstart"]'); await s.page.fill('#si-num', '082 555 0101'); await s.page.fill('#si-pin', '999999'); await s.page.click('[data-act="hub:pinsignin"]');
  await s.page.waitForSelector('#si-err:not([hidden])', { timeout: 5000 }).catch(() => {});
  check((await s.page.textContent('.signin-card')).includes('isn’t right'), 'a wrong PIN is turned away');
  await s.page.fill('#si-num', '084 000 0000'); await s.page.fill('#si-pin', '480215'); await s.page.click('[data-act="hub:pinsignin"]');
  await s.page.waitForSelector('#si-err:not([hidden])', { timeout: 5000 }).catch(() => {});
  check((await s.page.textContent('.signin-card')).includes('no Church Hub sign-in for that number'), 'a number with no PIN is told so');
  await s.page.fill('#si-num', '+27 82 555 0101'); await s.page.fill('#si-pin', '480215'); await s.page.click('[data-act="hub:pinsignin"]');
  await s.page.waitForSelector('.app', { timeout: 8000 }).catch(() => {}); await s.settle();
  check(!!(await s.page.$('.app')) && (await s.page.textContent('.side')).includes('Megan'), 'their number (in either form) and PIN sign them in again – as on a new phone');
  await s.page.click('.side [data-act="hub:signout"]'); await s.page.click('[data-act="hub:signoutyes"]'); await s.settle();
  await s.page.click('[data-act="hub:havecode"]'); await s.page.fill('#si-code', code.toLowerCase()); await s.page.click('[data-act="hub:claimcode"]');   // (reloading would start the test data afresh)
  await s.page.waitForSelector('#si-err:not([hidden])', { timeout: 5000 }).catch(() => {});
  check((await s.page.textContent('.signin-card')).includes('already been used'), 'a code works only once');
  await s.page.evaluate(() => { window.__fake.anonFail = 'auth/admin-restricted-operation'; });
  await s.page.click('[data-act="hub:restart"]'); await s.page.click('[data-act="hub:havecode"]'); await s.page.fill('#si-code', code); await s.page.click('[data-act="hub:claimcode"]');
  await s.page.waitForSelector('#si-err:not([hidden])', { timeout: 5000 }).catch(() => {});
  check((await s.page.textContent('.signin-card')).includes('aren’t switched on'), 'when the church hasn’t switched codes on, it says so');
  const afterPin = await s.docsNow(); await finish(s);

  // Forgot the PIN: the office gives a new code, which switches the old PIN off; this time they take a church number
  s = await session('linda.pillay@example.com', afterPin);
  await s.go('people/p/p17'); await s.page.click('[data-act="people:phones"]'); await s.page.waitForSelector('#ph-list .item', { timeout: 5000 }).catch(() => {});
  check((await s.page.textContent('#ph-list')).includes('ending 0101'), 'Cellphone sign-in shows the Administrator how they sign in (the number partly hidden)');
  await s.page.click('#modal [data-act="hub:close"]');
  await s.page.click('[data-act="people:givecode"]');
  check((await s.page.textContent('#modal')).includes('stops working now'), 'a new code warns that an existing PIN stops working');
  await s.page.click('[data-act="people:makecode"]'); await s.page.waitForSelector('.code-big', { timeout: 5000 });
  const code2 = (await s.page.textContent('.code-big')).trim();
  await s.page.click('#modal [data-act="hub:close"]'); await s.settle();
  docs = await s.docsNow();
  check(!docs[dev], 'the new code switches off the old PIN sign-in');
  const withCode2 = docs; await finish(s);
  s = await session('', withCode2);
  await s.page.evaluate(a => { window.__fake.accounts = a; }, accounts);
  await s.page.click('[data-act="hub:pinstart"]'); await s.page.fill('#si-num', '0825550101'); await s.page.fill('#si-pin', '480215'); await s.page.click('[data-act="hub:pinsignin"]');
  await s.page.waitForSelector('.signin-card .note.bad', { timeout: 5000 }).catch(() => {}); await s.page.waitForTimeout(200);
  check((await s.page.textContent('.signin-card')).includes('switched off') && !(await s.page.$('.app')), 'the old PIN no longer opens Church Hub');
  await s.page.click('[data-act="hub:havecode"]'); await s.page.fill('#si-code', code2); await s.page.click('[data-act="hub:claimcode"]');
  await s.page.waitForSelector('[data-act="hub:codeyes"]', { timeout: 5000 }); await s.page.click('[data-act="hub:codeyes"]');
  await s.page.click('[data-act="hub:pinnonumber"]');
  check((await s.page.textContent('.signin-card')).includes('church number'), '“I don’t have my own number”: Church Hub will give them a church number');
  await s.page.fill('#si-pin', '730518'); await s.page.fill('#si-pin2', '730518'); await s.page.click('[data-act="hub:pinset"]');
  await s.page.waitForSelector('[data-act="hub:pinbegin"]', { timeout: 8000 }).catch(() => {});
  const shown = ((await s.page.textContent('.signin-card .code-big').catch(() => '')) || '').trim();
  check(/^[1-9]\d\d \d{3}$/.test(shown), 'their church number is shown to write down (' + shown + ')');
  await s.page.click('[data-act="hub:pinbegin"]'); await s.page.waitForSelector('.app', { timeout: 8000 }).catch(() => {}); await s.settle();
  docs = await s.docsNow();
  const church = 'c' + shown.replace(' ', ''), dev2 = Object.keys(docs).filter(k => PIN_DOC.test(k) && docs[k].login === church)[0];
  check(!!(await s.page.$('.app')) && dev2 && docs[dev2].personId === 'p17' && docs['pinLogins/' + church] && docs['pinLogins/' + church].uid === docs[dev2].uid, 'they’re in, signing in from now on with the church number and PIN');
  await s.page.click('.side [data-act="hub:signout"]');
  check((await s.page.textContent('#modal')).includes(shown), 'signing out reminds them of their church number');
  await s.page.click('[data-act="hub:signoutyes"]'); await s.settle();
  await s.page.click('[data-act="hub:pinstart"]'); await s.page.fill('#si-num', shown); await s.page.fill('#si-pin', '730518'); await s.page.click('[data-act="hub:pinsignin"]');
  await s.page.waitForSelector('.app', { timeout: 8000 }).catch(() => {});
  check(!!(await s.page.$('.app')), 'the church number and PIN sign them in');
  await finish(s);
};
