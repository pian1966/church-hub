/*
 * Church Hub – the app tested in a real browser, as every role: first the demo, then live mode (Firebase) against
 * tests/fake-firebase.js.
 * Uses the made-up sample people only. Checks that each role sees what it should, that its changes are saved
 * in the right documents, and that the app never asks the database for something the security rules refuse.
 *
 * Run:  npm i -D playwright && npx playwright install chromium   (once)
 *       node tests/app.test.js
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), http = require('http');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');

/* ---------- the sample church, stored the way Store stores it in Firestore ---------- */
function sampleData() {
  const ctx = vm.createContext({ console });
  const src = ['js/leave-core.js', 'js/sample.js'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
  vm.runInContext(src + '\nthis.makeSampleData = makeSampleData;', ctx);
  return ctx.makeSampleData();
}
const CARD = ['firstName', 'lastName', 'preferredName', 'familyId', 'familyRole', 'category', 'email', 'mobile', 'active', 'appRole', 'source', 'createdAt', 'updatedAt', 'archivedAt', 'deletedAt'];
function seedDocs(opts) {
  const d = JSON.parse(JSON.stringify(sampleData())), out = {}, put = (p, v) => { out[p] = JSON.parse(JSON.stringify(v)); };
  const strip = o => { const c = Object.assign({}, o); delete c.id; return c; };
  d.settings.demo = false; put('settings/church', d.settings);
  const lv = d.leave; put('leave/config', { settings: lv.settings, rules: lv.rules, terms: lv.terms, types: lv.types, levels: lv.levels, holidays: lv.holidays, autoApprove: [] });
  lv.requests.forEach(r => { put('leaveRequests/' + r.id, strip(r)); if (r.status === 'Approved') put('away/' + r.id, { personId: r.staffId, from: r.start, to: r.end }); });
  const consentGiven = (pid, pur) => d.consents.some(c => c.personId === pid && c.purpose === pur && c.given && !c.withdrawnAt);
  d.people.forEach(p => {
    const card = {}, det = {};
    Object.keys(p).forEach(k => { if (k === 'id' || k === 'medical') return; (CARD.includes(k) ? card : det)[k] = p[k]; });
    det.familyRole = p.familyRole;
    put('people/' + p.id, card); put('details/' + p.id, det);
    if (p.medical) put('medical/' + p.id, p.medical);
    if (p.familyRole !== 'child' && consentGiven(p.id, 'Church directory')) put('directory/' + p.id, { firstName: p.firstName, lastName: p.lastName, preferredName: p.preferredName, mobile: p.mobile });
    if (p.email && p.familyRole !== 'child') put('roles/' + p.email.toLowerCase(), { role: p.appRole, personId: p.id });
  });
  const notes = {}; d.notes.forEach(n => { (notes[n.personId] = notes[n.personId] || []).push(strip(n)); });
  Object.keys(notes).forEach(pid => put('notes/' + pid, { entries: notes[pid].map(n => { delete n.personId; return n; }) }));
  ['families', 'consents', 'teams', 'positions', 'skills', 'services', 'assignments', 'groups', 'blockouts', 'dsr', 'breaches'].forEach(c => d[c].forEach(x => put(c + '/' + x.id, strip(x))));
  // a turn for Tim (member) to accept
  const future = d.services.filter(s => s.date > new Date().toISOString().slice(0, 10)).sort((a, b) => a.date < b.date ? -1 : 1)[1];
  put('assignments/kTim', { serviceId: future.id, positionId: 'door', personId: 'p14', status: 'pending', source: 'manual' });
  return opts && opts.empty ? { 'roles/first.admin@example.com': { role: 'admin' } } : out;
}

/* ---------- a tiny web server for the app ---------- */
function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' }[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(rsp);
    }).listen(0, '127.0.0.1', () => res(srv));
  });
}

(async () => {
  const srv = await serve(), BASE = 'http://127.0.0.1:' + srv.address().port + '/index.html';
  const browser = await chromium.launch(); let fails = 0;
  const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
  const fake = fs.readFileSync(path.join(__dirname, 'fake-firebase.js'), 'utf8');

  /* ---------- Demo (no Firebase) ---------- */
  async function demo(who, id) {
    const context = await browser.newContext(), page = await context.newPage(), errs = [];
    page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) errs.push(m.text()); });
    await page.route(u => !u.href.startsWith('http://127.0.0.1'), r => r.abort());
    const DEMO = BASE + '?demo';                       // the demo address works even when Firebase is set up
    await page.goto(DEMO); await page.selectOption('#si-any', id); await page.click('[data-act="hub:signinany"]');
    for (const r of ROUTES) { await page.goto(DEMO + '#/' + r); await page.waitForTimeout(20); }
    await page.goto(DEMO + '#/people/p/p12'); const t12 = await page.textContent('main');
    await page.goto(DEMO + '#/people/p/p10'); const t10 = await page.textContent('main');
    check(!!(await page.$('.demo')) && t12.includes('Nuts') === (who === 'kids') && t10.includes('Moved from Durban') === (who === 'pastor'), 'demo as ' + who + ': restricted notes shown only to the right role');
    check(errs.length === 0, 'demo as ' + who + ': no errors on ' + ROUTES.length + ' screens' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
    await context.close();
  }

  async function session(email, docs) {
    const context = await browser.newContext(), page = await context.newPage(), errs = [];
    page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) errs.push(m.text()); });
    await page.route(u => !u.href.startsWith('http://127.0.0.1'), r => r.abort());       // no internet: fonts, Firebase CDN
    await page.addInitScript(([fakeSrc, seed, mail]) => {
      window.CHURCH_HUB_FIREBASE = { apiKey: 'test-only', projectId: 'demo-church-hub', authDomain: 'localhost', appId: 'test' };
      (0, eval)(fakeSrc);
      window.__fake.seed(seed);
      if (mail) window.__fake.setUser({ email: mail, emailVerified: true });
    }, [fake, docs, email]);
    await page.goto(BASE);
    const ready = await page.waitForSelector('.app, .signin-card h1', { timeout: 8000 });
    const docsNow = () => page.evaluate(() => window.__fake.docs);
    const denied = () => page.evaluate(() => window.__fake.denied);
    const go = async r => { await page.goto(BASE + '#/' + r); await page.waitForTimeout(40); };
    const text = async () => (await page.textContent('main')) || '';
    return { page, errs, ready, docsNow, denied, go, text, close: () => context.close() };
  }
  const ROUTES = ['home', 'people', 'people/families', 'people/p/p12', 'people/p/p10', 'people/p/p14', 'rosters', 'rosters/mine', 'rosters/teams', 'rosters/together', 'rosters/away',
    'leave', 'leave/approvals', 'leave/team', 'leave/away', 'privacy', 'privacy/requests', 'privacy/retention', 'privacy/breaches', 'privacy/audit', 'import', 'settings'];
  async function tour(s, who) {
    for (const r of ROUTES) await s.go(r);
    await s.go('people/p/p12'); const t12 = await s.text();
    await s.go('people/p/p10'); const t10 = await s.text();
    check(t12.includes('Nuts') === (who === 'kids'), 'medical notes only for Children’s ministry');
    check(t10.includes('Moved from Durban') === (who === 'pastor'), 'pastoral notes only for Pastors');
  }
  async function finish(s) {
    await s.page.waitForTimeout(400);
    const d = await s.denied();
    check(d.length === 0, 'nothing refused by the security rules' + (d.length ? ': ' + d.slice(0, 4).join(' | ') : ''));
    check(s.errs.length === 0, 'no errors' + (s.errs.length ? ': ' + s.errs.slice(0, 3).join(' | ') : ''));
    await s.close();
  }

  console.log('Demo:');
  for (const [who, id] of [['admin', 'p01'], ['pastor', 'p02'], ['kids', 'p04'], ['rosters', 'p05'], ['member', 'p14']]) await demo(who, id);

  /* ---------- Administrator ---------- */
  console.log('Administrator (Linda):');
  let s = await session('linda.pillay@example.com', seedDocs());
  check(!!(await s.page.$('.app')), 'signs in and sees the app');
  check(!(await s.page.$('.demo')), 'no demo banner when live');
  await tour(s, 'admin');
  await s.go('people/p/p19'); await s.page.click('[data-act="people:edit"]'); await s.page.selectOption('#pf-role', 'rosters'); await s.page.click('[data-act="people:save"]');
  await s.page.waitForTimeout(200);
  let docs = await s.docsNow();
  check(docs['roles/sam.peters@example.com'] && docs['roles/sam.peters@example.com'].role === 'rosters' && docs['roles/sam.peters@example.com'].personId === 'p19', 'giving Sam “Roster coordinator” access writes the access list');
  await s.go('people/p/p27'); await s.page.click('[data-act="people:edit"]'); await s.page.selectOption('#pf-role', 'none'); await s.page.click('[data-act="people:save"]'); await s.page.waitForTimeout(200);
  docs = await s.docsNow(); check(!docs['roles/ruth.daniels@example.com'], 'choosing “No access” removes their sign-in');
  await s.go('leave/approvals'); await s.page.click('[data-act="leave:decide"][data-d="Approved"]'); await s.page.waitForTimeout(200);
  docs = await s.docsNow(); const approved = Object.keys(docs).filter(k => k.startsWith('leaveRequests/') && docs[k].status === 'Approved' && docs[k].decidedOn);
  check(approved.length === 1 && docs['away/' + approved[0].split('/')[1]], 'approving leave saves it and marks the dates as away');
  await s.page.evaluate(() => { const p = Store.get('people', 'p10'); p.active = false; Store.put('people', p); });
  await s.go('privacy/retention'); await s.page.click('[data-act="privacy:erase"][data-id="p10"]'); await s.page.click('[data-act="privacy:erase"][data-id="p10"]'); await s.page.waitForTimeout(300);
  docs = await s.docsNow();
  if (docs['notes/p10'] || docs['directory/p10'] || docs['people/p10'].firstName !== 'Deleted' || docs['roles/jason.naidoo@example.com']) console.log('    debug:', JSON.stringify({ n: docs['notes/p10'], d: docs['directory/p10'], p: docs['people/p10'], r: docs['roles/jason.naidoo@example.com'] }));
  check(!docs['notes/p10'] && !docs['directory/p10'] && docs['people/p10'].firstName === 'Deleted' && !docs['roles/jason.naidoo@example.com'], 'deleting Jason removes his pastoral notes, directory entry and sign-in (Admin can’t read the notes)');
  check(Object.keys(docs).some(k => k.startsWith('audit/') && docs[k].byEmail === 'linda.pillay@example.com' && /Deleted the personal information/.test(docs[k].action)), 'the deletion is in the audit log');
  await s.go('privacy/audit'); check((await s.text()).includes('Signed in'), 'audit log shows sign-ins');
  await finish(s);

  /* ---------- Pastor ---------- */
  console.log('Pastor (Thandi):');
  s = await session('thandi.mokoena@example.com', seedDocs());
  await tour(s, 'pastor');
  await s.go('people/p/p10'); await s.page.fill('#pn-text', 'Visited at home.'); await s.page.click('[data-act="people:note"]'); await s.page.waitForTimeout(200);
  docs = await s.docsNow(); check(docs['notes/p10'] && docs['notes/p10'].entries.length === 2, 'adding a pastoral note saves it');
  await s.go('people/p/p27'); await s.page.click('[data-act="people:consent"]');
  for (const pur of ['Church records', 'Church directory']) await s.page.check(`.cf-p[data-p="${pur}"]`);
  await s.page.click('[data-act="people:saveconsent"]'); await s.page.waitForTimeout(300);
  docs = await s.docsNow(); check(!!docs['directory/p27'] && docs['directory/p27'].mobile && !docs['directory/p27'].email, 'directory consent adds name and phone (not email) to the directory');
  await finish(s);

  /* ---------- Children's ministry ---------- */
  console.log('Children’s ministry (Grace):');
  s = await session('grace.ndlovu@example.com', seedDocs());
  await tour(s, 'kids');
  await s.go('people'); check((await s.text()).includes('Aisha'), 'sees the children');
  await s.go('people/p/p12'); await s.page.click('[data-act="people:medical"]'); await s.page.fill('#md-a', 'Nuts and bee stings'); await s.page.click('[data-act="people:savemedical"]'); await s.page.waitForTimeout(200);
  docs = await s.docsNow(); check(docs['medical/p12'] && docs['medical/p12'].allergies === 'Nuts and bee stings', 'editing medical notes saves them');
  await s.go('people/p/p16'); await s.page.click('[data-act="people:medical"]'); await s.page.fill('#md-a', 'Penicillin'); await s.page.click('[data-act="people:savemedical"]');
  check(await s.page.isVisible('#md-err'), 'can’t add medical notes without a guardian’s consent'); await s.page.click('[data-act="hub:close"]');
  check(await s.page.evaluate(() => Store.get('people', 'p02').birthDate === undefined && Store.get('people', 'p12').birthDate !== ''), 'sees children’s birthdays but not adults’ details');
  await finish(s);

  /* ---------- Roster coordinator ---------- */
  console.log('Roster coordinator (Sipho):');
  s = await session('sipho.dlamini@example.com', seedDocs());
  await tour(s, 'rosters');
  check(await s.page.evaluate(() => !Store.find('consents', () => true).some(c => c.personId !== 'p05')), 'can’t see other people’s consent records');
  await s.page.evaluate(() => Store.put('assignments', { serviceId: Store.list('services')[5].id, positionId: 'door', personId: 'p20', status: 'pending', source: 'manual' }, 'Added to roster'));
  await s.page.waitForTimeout(200); docs = await s.docsNow();
  check(Object.keys(docs).some(k => k.startsWith('assignments/') && docs[k].personId === 'p20' && docs[k].status === 'pending' && docs[k].source === 'manual'), 'adding someone to the roster saves it');
  await finish(s);

  /* ---------- Member ---------- */
  console.log('Member (Tim):');
  s = await session('tim.jacobs@example.com', seedDocs());
  await tour(s, 'member');
  await s.go('people'); const dirText = await s.text();
  check(dirText.includes('Clare Jacobs') && !dirText.includes('Megan Smith') && !dirText.includes('Ruth Daniels') && !dirText.includes('Aisha'), 'directory shows only adults who agreed to be listed');
  await s.go('people/p/p14'); await s.page.click('[data-act="people:edit"]'); await s.page.fill('#pf-mobile', '082 999 0000'); await s.page.click('[data-act="people:save"]'); await s.page.waitForTimeout(200);
  docs = await s.docsNow(); check(docs['people/p14'].mobile === '082 999 0000' && docs['directory/p14'].mobile === '082 999 0000', 'can correct own phone number (directory follows)');
  await s.go('rosters/mine'); await s.page.click('[data-act="rosters:reply"][data-s="accepted"]'); await s.page.waitForTimeout(200);
  docs = await s.docsNow(); check(docs['assignments/kTim'].status === 'accepted', 'can accept a serving turn');
  await s.go('people/p/p14'); await s.page.click('[data-act="people:consent"]'); await s.page.uncheck('.cf-p[data-p="Church directory"]'); await s.page.click('[data-act="people:saveconsent"]'); await s.page.waitForTimeout(300);
  docs = await s.docsNow(); check(!docs['directory/p14'], 'withdrawing directory consent removes them from the directory');
  check(await s.page.evaluate(() => Store.list('people').every(p => !p.birthDate || p.id === 'p14')), 'can’t see anyone else’s private details');
  await finish(s);

  /* ---------- Staff member asking for leave ---------- */
  console.log('Staff member (Lerato):');
  s = await session('lerato.khumalo@example.com', seedDocs());
  await s.go('leave'); await s.page.click('[data-act="leave:request"]'); await s.page.selectOption('#lf-type', 'SSL');
  const day = await s.page.evaluate(() => { let d = LeaveCore.addDays(LeaveCore.parse(Hub.today()), 45); while (d.getDay() !== 3) d = LeaveCore.addDays(d, 1); return LeaveCore.iso(d); });
  await s.page.fill('#lf-start', day); await s.page.dispatchEvent('#lf-start', 'change'); await s.page.fill('#lf-note', 'Dentist');
  await s.page.click('[data-act="leave:send"]'); await s.page.waitForTimeout(250);
  docs = await s.docsNow(); const mine = Object.keys(docs).filter(k => k.startsWith('leaveRequests/') && docs[k].staffId === 'p06' && docs[k].start === day);
  check(mine.length === 1 && docs[mine[0]].status === 'Pending', 'requesting leave saves it as waiting for approval');
  await s.go('leave'); await s.page.click(`[data-act="leave:cancel"][data-id="${mine[0].split('/')[1]}"]`); await s.page.click(`[data-act="leave:cancel"][data-id="${mine[0].split('/')[1]}"]`); await s.page.waitForTimeout(250);
  docs = await s.docsNow(); check(docs[mine[0]].status === 'Cancelled', 'can cancel own leave');
  await s.go('leave/away'); check((await s.text()).includes('Thandi'), '“Who’s away” shows colleagues’ approved leave');
  check(await s.page.evaluate(() => Store.leave().requests.every(r => r.staffId === 'p06' || (!r.reason && !r.type))), 'but not the type of leave or the reason');
  await finish(s);

  /* ---------- Someone without access ---------- */
  console.log('Stranger:');
  s = await session('stranger@example.com', seedDocs());
  check((await s.page.textContent('.signin-card')).includes('No access yet'), 'is told they have no access');
  await finish(s);

  /* ---------- Signed out: sign-in screen ---------- */
  console.log('Sign-in screen:');
  s = await session('', seedDocs());
  const card = await s.page.textContent('.signin-card');
  check(card.includes('Sign in with Google') && card.includes('Email me a link') && card.includes('Try the demo'), 'offers Google, email link and the demo');
  await s.page.fill('#si-email', 'tim.jacobs@example.com'); await s.page.click('[data-act="hub:sendlink"]'); await s.page.waitForTimeout(100);
  check((await s.page.textContent('.signin-card')).includes('Check your email'), 'email link: asks them to check their email');
  await s.page.click('[data-act="hub:restart"]');
  await s.page.evaluate(() => { window.__fake.nextUser = { email: 'Tim.Jacobs@example.com', emailVerified: true }; });
  await s.page.click('[data-act="hub:google"]'); await s.page.waitForSelector('.app', { timeout: 5000 }).catch(() => {});
  check(!!(await s.page.$('.app')), 'Google sign-in works (email in any capitals)');
  await s.page.click('.side [data-act="hub:signout"]'); await s.page.waitForTimeout(150);
  check((await s.page.textContent('.signin-card')).includes('Sign in with Google'), 'signing out returns to the sign-in screen');
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

  await browser.close(); srv.close();
  console.log(fails ? '\n' + fails + ' check(s) FAILED' : '\nLive mode: all checks passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
