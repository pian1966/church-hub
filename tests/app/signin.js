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
  await s.page.click('[data-act="people:consent"]'); check(await s.page.evaluate(() => window.churchHubBack() === true && !document.querySelector('#modal .overlay')), 'the back button closes an open window first');
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

};
