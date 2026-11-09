/* Church Hub – browser test, part: without the internet. Live mode keeps a copy on the device, is view-only offline and
 * wipes the copy at sign-out; sw.js keeps Church Hub's files so it opens offline.
 * One part of tests/app.test.js, which starts the browser and runs every part in turn: node tests/app.test.js */
'use strict';
module.exports = async function (ctx) {
  const { BASE, check, finish, seedDocs, session } = ctx;
  let s, docs, t;

  console.log('Offline (live mode, Tim – member):');
  s = await session('tim.jacobs@example.com', seedDocs());
  check(await s.page.evaluate(() => window.__fake.kept === 1), 'keeps a copy on this device for offline use');
  check(!(await s.page.$('.offline-bar')), 'online: no offline notice');
  await s.go('me');
  // Wait for what the person would see, never a fixed pause: a busy test computer can take longer than any guess
  const shows = (fn, arg) => s.page.waitForFunction(fn, arg, { timeout: 8000, polling: 50 }).then(() => true, () => false);
  await s.page.context().setOffline(true);
  await shows(() => !!document.querySelector('.offline-bar'));
  t = await s.page.textContent('.offline-bar').catch(() => '');
  check(t.includes('view-only'), 'offline: says Church Hub is view-only');
  check((await s.text()).length > 50, 'offline: their page is still shown');
  const before = Object.keys(await s.docsNow()).length;
  await s.page.evaluate(() => Store.put('blockouts', { personId: 'p14', from: '2030-01-01', to: '2030-01-02', note: 'offline' }));
  await shows(() => (document.querySelector('#toast') || {}).textContent.includes('offline'));
  docs = await s.docsNow();
  check(Object.keys(docs).length === before && !(await s.page.evaluate(() => Store.list('blockouts').some(b => b.note === 'offline'))), 'offline: nothing is changed');
  check((await s.page.textContent('#toast')).includes('offline'), 'offline: trying to change something says why');
  await s.page.context().setOffline(false);
  check(await shows(() => !document.querySelector('.offline-bar') && (document.querySelector('#toast') || {}).textContent.includes('Back online')), 'back online: the notice goes and says so');
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
  // Real "no internet": Church Hub comes from a web server of its own, which is switched off once the files are kept.
  // (The browser's pretend-offline switch doesn't reliably reach sw.js on a busy test computer, which made this flaky.)
  const own = await ctx.serve(), DEMO = 'http://127.0.0.1:' + own.address().port + '/index.html?demo';
  const context = await ctx.browser.newContext(), page = await context.newPage(), errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await context.route(u => !u.href.startsWith('http://127.0.0.1'), r => r.abort());
  await page.goto(DEMO); await page.waitForSelector('#si-any', { timeout: 15000 });
  await page.evaluate(() => navigator.serviceWorker.ready);
  // Wait until sw.js has kept every file this page loaded (each is only put in the copy once fully downloaded).
  // Asked again and again from here: waitForFunction doesn't wait for an async check (a promise counts as "done").
  const allKept = () => page.evaluate(async () => {
    const c = await caches.open('church-hub-files'), have = (await c.keys()).map(r => r.url);
    const want = performance.getEntriesByType('resource').filter(r => r.name.startsWith(location.origin) && /^(script|link|css|img)$/.test(r.initiatorType)).map(r => r.name.split('?')[0]);
    return want.length > 40 && want.every(u => have.includes(u)) && have.some(u => /\/index\.html$/.test(u));
  });
  let kept = false;
  for (const end = Date.now() + 30000; !kept && Date.now() < end;) { kept = await allKept(); if (!kept) await page.waitForTimeout(200); }
  check(kept, 'keeps Church Hub’s files from the first visit');
  await new Promise(r => { own.close(r); own.closeAllConnections(); });   // the internet is gone: every download now fails at once
  await page.goto(DEMO).catch(() => {});
  const ok = await page.waitForSelector('#si-any', { timeout: 15000 }).then(() => true, () => false);
  check(ok, 'opens with no internet');
  if (ok) { await page.selectOption('#si-any', 'p14'); await page.click('[data-act="hub:signinany"]'); }
  check(ok && !!(await page.waitForSelector('.app', { timeout: 8000 }).catch(() => null)) && !(await page.$('.offline-bar')), 'the demo works as usual offline (it is kept in the browser)');
  check(errs.length === 0, 'no errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await context.close();
};
