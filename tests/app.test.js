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
const Serving = require('../js/serving.js');
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
// A small made-up picture (8 × 6 pixels, orange) for photo uploads
const PNG2 = { name: 'two.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAGCAIAAABxZ0isAAAAFUlEQVR4nGN4FiUCR3JRJ+CIYSAlADFEPeEZ99sTAAAAAElFTkSuQmCC', 'base64') };   // left half orange, right half blue
const PNG = { name: 'face.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAGCAIAAABxZ0isAAAAEUlEQVR4nGM4UaGBFTEMpAQA5jNDgbfBAhwAAAAASUVORK5CYII=', 'base64') };
const CARD = ['firstName', 'lastName', 'preferredName', 'familyId', 'householdIds', 'familyRole', 'category', 'email', 'mobile', 'active', 'appRole', 'source', 'createdAt', 'updatedAt', 'archivedAt', 'deletedAt'];
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
    if (p.familyRole !== 'child' && consentGiven(p.id, 'Church directory')) put('directory/' + p.id, { firstName: p.firstName, lastName: p.lastName, preferredName: p.preferredName });   // name only (Settings → What others can see)
    if (p.email && p.familyRole !== 'child') put('roles/' + p.email.toLowerCase(), { role: p.appRole, personId: p.id });
  });
  const notes = {}; d.notes.forEach(n => { (notes[n.personId] = notes[n.personId] || []).push(strip(n)); });
  Object.keys(notes).forEach(pid => put('notes/' + pid, { entries: notes[pid].map(n => { delete n.personId; return n; }) }));
  ['families', 'consents', 'teams', 'positions', 'skills', 'services', 'assignments', 'groups', 'blockouts', 'dsr', 'breaches', 'guardians', 'noCollect', 'serveOffers'].forEach(c => d[c].forEach(x => put(c + '/' + x.id, strip(x))));
  // a turn for Tim (member) to accept
  const future = d.services.filter(s => s.date > new Date().toISOString().slice(0, 10)).sort((a, b) => a.date < b.date ? -1 : 1)[1];
  put('assignments/kTim', { serviceId: future.id, positionId: 'door', personId: 'p14', status: 'pending', source: 'manual' });
  if (opts && opts.legacy) {   // data from before households and the new category names
    delete out['settings/church'].dataVersion;
    Object.keys(out).filter(k => k.startsWith('guardians/')).forEach(k => delete out[k]);
    Object.keys(out).filter(k => k.startsWith('people/')).forEach(k => { if (out[k].category === 'Church Partner') out[k].category = 'Member'; if (out[k].category === 'Attender') out[k].category = 'Visitor'; });
  }
  if (opts && opts.v2) {   // data from before "Partner" became "Church Partner"
    out['settings/church'].dataVersion = 2;
    Object.keys(out).filter(k => k.startsWith('people/')).forEach(k => { if (out[k].category === 'Church Partner') out[k].category = 'Partner'; });
    out['details/p17'] = Object.assign({}, out['details/p17'], { maritalStatus: 'Partner' });   // a partner in a couple: not a category
    // Died, imported from Elvanto with the date of death typed in front of the name; the import put the import day as the date
    Object.assign(out['people/p23'], { firstName: '2024-08-22-Johan', category: 'Deceased', active: false, createdAt: '2026-10-26 09:00' });
    out['details/p23'] = Object.assign({}, out['details/p23'], { deceasedAt: '2026-10-26' });
    Object.assign(out['people/p21'], { firstName: '2023-05-01 Thabo', category: 'Deceased', active: false });
    out['details/p21'] = Object.assign({}, out['details/p21'], { deceasedAt: '2023-04-30' });   // recorded on purpose: kept
    out['people/p14'].firstName = '2020-01-01-Tim';   // alive: left alone
    out['people/p19'].lastName = '5710210087085 Peters';   // an ID number typed into a name
  }
  if (opts && opts.found) {   // what the robot read in Elvanto's Unavailable Volunteers (made-up)
    out['settings/church'].elvanto = { on: false, read: true, url: 'https://example.elvanto.eu' };
    out['elvantoFound/unavailable'] = { readAt: '2026-10-29T01:07:00Z', rows: 4, unread: 1, pages: 1, entries: [
      { name: 'Clare Jacobs', from: '2030-11-03', to: '2030-11-05', fromLeave: false }, { name: 'Jacobs, Tim', from: '2030-11-10', to: '2030-11-10', fromLeave: false },
      { name: 'Megan Jacobs', from: '2030-12-01', to: '2030-12-01', fromLeave: false }, { name: 'Lerato Khumalo', from: '2030-12-07', to: '2030-12-08', fromLeave: true }] };
  }
  if (opts && opts.elvanto) {   // Elvanto updating switched on; Lerato's approved leave (L103) already in Elvanto; the robot's sign-in
    out['settings/church'].elvanto = { on: true, url: 'https://example.elvanto.eu', robotEmail: 'robot@example.com' };
    const l = d.leave.requests.find(r => r.id === 'L103');
    put('elvantoSync/L103', { personId: 'p06', name: 'Lerato Khumalo', start: l.start, end: l.end, want: 'Unavailable', have: l.start + ' to ' + l.end, haveNote: 'Church Hub L103', status: 'Done', note: 'Added.', createdAt: '2026-10-01 08:00', updatedAt: '2026-10-01 08:15' });
    put('roles/robot@example.com', { role: 'robot', uid: 'R1', name: 'Elvanto robot' });
  }
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
  const check = (ok, msg) => { if (!ok) { fails++; if (process.env.GITHUB_ACTIONS) console.log('::error title=App test::' + String(msg).replace(/[\r\n]+/g, ' ').slice(0, 300)); } console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
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

  async function session(email, docs, opts) {
    const context = await browser.newContext(opts && opts.ua ? { userAgent: opts.ua, viewport: { width: 390, height: 844 } } : {}), page = await context.newPage(), errs = [];
    page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) errs.push(m.text()); });
    await page.route(u => !u.href.startsWith('http://127.0.0.1'), r => r.abort());       // no internet: fonts, Firebase CDN
    await page.addInitScript(([fakeSrc, seed, mail, app, standalone]) => {
      window.CHURCH_HUB_FIREBASE = { apiKey: 'test-only', projectId: 'demo-church-hub', authDomain: 'localhost', appId: 'test', googleWebClientId: app && app.clientId || '' };
      // Stand-in for the Android app's bridge (android/…/MainActivity.java): Android's account picker returns a Google ID token
      if (app) window.ChurchHubApp = Object.assign({ version: () => '1.0.7', retry: () => {}, googleSignIn: id => { window.__appGoogle = id; setTimeout(() => window.churchHubGoogle('id-token-for-' + id), 0); } },
        app.saveFile ? { saveFile: (n, m, t) => { window.__saved = { n, m, t }; } } : {});
      (0, eval)(fakeSrc);
      window.__fake.seed(seed);
      if (mail) window.__fake.setUser({ email: mail, emailVerified: true });
      if (standalone) Object.defineProperty(window.navigator, 'standalone', { get: () => true });   // opened from an iPhone's home screen
    }, [fake, docs, email, (opts && opts.app) || null, !!(opts && opts.standalone)]);
    await page.goto(BASE);
    const ready = await page.waitForSelector('.app, .signin-card h1', { timeout: 8000 });
    const docsNow = () => page.evaluate(() => window.__fake.docs);
    const denied = () => page.evaluate(() => window.__fake.denied);
    const go = async r => { await page.goto(BASE + '#/' + r); await page.waitForTimeout(40); };
    // Wait until every save has reached the (stand-in) database – robust on slow computers
    const settle = async () => { await page.waitForTimeout(60); await page.waitForFunction(() => window.__fake.pending === 0 && !document.querySelector('#busy:not([hidden])'), null, { timeout: 15000 }); await page.waitForTimeout(60); };
    const text = async () => (await page.textContent('main')) || '';
    return { page, errs, ready, docsNow, denied, go, text, settle, close: () => context.close() };
  }
  const ROUTES = ['home', 'people', 'people/families', 'people/search', 'people/p/p12', 'people/p/p10', 'people/p/p14', 'rosters', 'rosters/mine', 'rosters/teams', 'rosters/together', 'rosters/away', 'me', 'me/away', 'me/serve', 'words', 'words/check', 'words/checkers',
    'leave', 'leave/approvals', 'leave/team', 'leave/staff/p02', 'leave/away', 'leave/settings', 'privacy', 'privacy/requests', 'privacy/retention', 'privacy/breaches', 'privacy/audit', 'import', 'import/leave', 'settings'];
  // Household is compulsory: people in the test data who have none get "+ New household" when edited
  async function fillHome(s) { const f = await s.page.$('#pf-fam'); if (f && (await f.evaluate(e => e.value)) === '') await s.page.selectOption('#pf-fam', '__new'); }
  async function tour(s, who) {
    for (const r of ROUTES) await s.go(r);
    await s.go('people/p/p12'); const t12 = await s.text();
    await s.go('people/p/p10'); const t10 = await s.text();
    check(t12.includes('Nuts') === (who === 'kids'), 'medical notes only for Children’s ministry');
    check(t10.includes('Moved from Durban') === (who === 'pastor'), 'pastoral notes only for Pastors');
    await s.go('people'); const pt = await s.text();
    check(pt.includes('Church at a glance') === (who === 'admin'), '“Church at a glance” statistics only for Administrators');
    if (who === 'admin') check(/Age groups[\s\S]*Marital status[\s\S]*Consent \(POPIA\)[\s\S]*Serving/.test(pt), 'statistics show age groups, marital status, consent and serving');
  }
  async function finish(s) {
    await s.settle();
    const d = await s.denied();
    check(d.length === 0, 'nothing refused by the security rules' + (d.length ? ': ' + d.slice(0, 4).join(' | ') : ''));
    check(s.errs.length === 0, 'no errors' + (s.errs.length ? ': ' + s.errs.slice(0, 3).join(' | ') : ''));
    await s.close();
  }

  const TESTS = __dirname;
  const ctx = { Serving, fs, path, vm, http, chromium, ROOT, sampleData, PNG, PNG2, CARD, seedDocs, serve, srv, BASE, browser, check, fake, demo, session, ROUTES, fillHome, tour, finish, TESTS };
  // The parts, in order (tests/app/*.js); each signs in afresh with the made-up church.
  for (const part of ['admin', 'people', 'care', 'people-details', 'languages', 'imports', 'roles', 'elvanto-leave', 'signin']) await require('./app/' + part + '.js')(ctx);

  await browser.close(); srv.close();
  console.log(fails ? '\n' + fails + ' check(s) FAILED' : '\nLive mode: all checks passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); if (process.env.GITHUB_ACTIONS) console.log('::error title=App test stopped::' + String(e && e.stack || e).replace(/[\r\n]+/g, ' | ').slice(0, 600)); process.exit(1); });
