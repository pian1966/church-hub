/* Church Hub – browser test, part: without the internet. Live mode keeps a copy on the device, is view-only offline and
 * wipes the copy at sign-out; sw.js keeps Church Hub's files so it opens offline.
 * One part of tests/app.test.js, which starts the browser and runs every part in turn: node tests/app.test.js */
'use strict';
module.exports = async function (ctx) {
  const { BASE, browser, check, finish, seedDocs, session } = ctx;
  let s, docs, t;

  console.log('Offline (live mode, Tim – member):');
  s = await session('tim.jacobs@example.com', seedDocs());
  check(await s.page.evaluate(() => window.__fake.kept === 1), 'keeps a copy on this device for offline use');
  check(!(await s.page.$('.offline-bar')), 'online: no offline notice');
  await s.go('me');
  await s.page.context().setOffline(true); await s.page.waitForTimeout(100);
  t = await s.page.textContent('.offline-bar').catch(() => '');
  check(t.includes('view-only'), 'offline: says Church Hub is view-only');
  check((await s.text()).length > 50, 'offline: their page is still shown');
  const before = Object.keys(await s.docsNow()).length;
  await s.page.evaluate(() => Store.put('blockouts', { personId: 'p14', from: '2030-01-01', to: '2030-01-02', note: 'offline' }));
  await s.page.waitForTimeout(100);
  docs = await s.docsNow();
  check(Object.keys(docs).length === before && !(await s.page.evaluate(() => Store.list('blockouts').some(b => b.note === 'offline'))), 'offline: nothing is changed');
  check((await s.page.textContent('#toast')).includes('offline'), 'offline: trying to change something says why');
  await s.page.context().setOffline(false); await s.page.waitForTimeout(100);
  check(!(await s.page.$('.offline-bar')) && (await s.page.textContent('#toast')).includes('Back online'), 'back online: the notice goes and says so');
  await s.page.evaluate(() => Store.put('blockouts', { personId: 'p14', from: '2030-01-01', to: '2030-01-02', note: 'online' })); await s.settle();
  docs = await s.docsNow(); check(Object.values(docs).some(d => d && d.note === 'online'), 'back online: changes are saved again');
  await s.page.click('.side [data-act="hub:signout"]'); await s.page.click('[data-act="hub:signoutyes"]'); await s.settle();
  check(await s.page.evaluate(() => window.__fake.wiped >= 1 && !localStorage.getItem('church_hub_offline_owner')), 'signing out wipes the copy on this device');
  await finish(s);

  console.log('Someone else signs in on the same device:');
  s = await session('tim.jacobs@example.com', seedDocs());
  check(await s.page.evaluate(() => localStorage.getItem('church_hub_offline_owner') === 'tim.jacobs@example.com' && window.__fake.wiped === 0), 'the copy belongs to the person signed in');
  await s.page.evaluate(() => localStorage.setItem('church_hub_offline_owner', 'someone.else@example.com'));
  await s.page.reload(); await s.page.waitForSelector('.app', { timeout: 8000 });
  check(await s.page.evaluate(() => window.__fake.wiped === 1 && localStorage.getItem('church_hub_offline_owner') === 'tim.jacobs@example.com'), 'a copy left by someone else is wiped first');
  await finish(s);

  console.log('Opening Church Hub with no internet (sw.js, demo):');
  const context = await browser.newContext(), page = await context.newPage(), errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await context.route(u => !u.href.startsWith('http://127.0.0.1'), r => r.abort());
  const DEMO = BASE + '?demo';
  await page.goto(DEMO); await page.waitForSelector('#si-any', { timeout: 8000 });
  await page.evaluate(() => navigator.serviceWorker.ready);
  // Wait until sw.js has kept every file this page loaded
  const kept = await page.waitForFunction(async () => {
    const c = await caches.open('church-hub-files'), have = (await c.keys()).map(r => r.url);
    const want = performance.getEntriesByType('resource').filter(r => r.name.startsWith(location.origin) && /^(script|link|css|img)$/.test(r.initiatorType)).map(r => r.name.split('?')[0]);
    return want.length > 40 && want.every(u => have.includes(u)) && have.some(u => /\/index\.html$/.test(u));
  }, null, { timeout: 15000, polling: 200 }).then(() => true, () => false);
  check(kept, 'keeps Church Hub’s files from the first visit');
  await page.waitForTimeout(1500);   // let the first visit's downloads finish (a busy test computer is slow)
  await context.setOffline(true);
  // On a very busy test computer the browser's pretend-offline switch now and then fails the first page load before
  // Church Hub's helper (sw.js) sees it: like a person tapping reload, try once more
  let ok = false;
  for (let i = 0; i < 2 && !ok; i++) {
    await page.goto(DEMO).catch(() => {});
    ok = await page.waitForSelector('#si-any', { timeout: 15000 }).then(() => true, () => false);
  }
  check(ok, 'opens with no internet');
  if (ok) { await page.selectOption('#si-any', 'p14'); await page.click('[data-act="hub:signinany"]'); }
  check(ok && !!(await page.$('.app')) && !(await page.$('.offline-bar')), 'the demo works as usual offline (it is kept in the browser)');
  check(errs.length === 0, 'no errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await context.close();
};
