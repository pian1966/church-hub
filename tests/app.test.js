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
    if (p.familyRole !== 'child' && consentGiven(p.id, 'Church directory')) put('directory/' + p.id, { firstName: p.firstName, lastName: p.lastName, preferredName: p.preferredName, mobile: p.mobile });
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

  async function session(email, docs, opts) {
    const context = await browser.newContext(), page = await context.newPage(), errs = [];
    page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) errs.push(m.text()); });
    await page.route(u => !u.href.startsWith('http://127.0.0.1'), r => r.abort());       // no internet: fonts, Firebase CDN
    await page.addInitScript(([fakeSrc, seed, mail, app]) => {
      window.CHURCH_HUB_FIREBASE = { apiKey: 'test-only', projectId: 'demo-church-hub', authDomain: 'localhost', appId: 'test', googleWebClientId: app && app.clientId || '' };
      // Stand-in for the Android app's bridge (android/…/MainActivity.java): Android's account picker returns a Google ID token
      if (app) window.ChurchHubApp = { version: () => '1.0.7', retry: () => {}, googleSignIn: id => { window.__appGoogle = id; setTimeout(() => window.churchHubGoogle('id-token-for-' + id), 0); } };
      (0, eval)(fakeSrc);
      window.__fake.seed(seed);
      if (mail) window.__fake.setUser({ email: mail, emailVerified: true });
    }, [fake, docs, email, (opts && opts.app) || null]);
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
  const ROUTES = ['home', 'people', 'people/families', 'people/search', 'people/p/p12', 'people/p/p10', 'people/p/p14', 'rosters', 'rosters/mine', 'rosters/teams', 'rosters/together', 'rosters/away', 'me', 'me/away', 'me/serve',
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

  console.log('Demo:');
  for (const [who, id] of [['admin', 'p01'], ['pastor', 'p02'], ['kids', 'p04'], ['rosters', 'p05'], ['member', 'p14']]) await demo(who, id);

  /* ---------- Administrator ---------- */
  console.log('Administrator (Linda):');
  let s = await session('linda.pillay@example.com', seedDocs());
  check(!!(await s.page.$('.app')), 'signs in and sees the app');
  check(!(await s.page.$('.demo')), 'no demo banner when live');
  await tour(s, 'admin');
  await s.go('people/p/p19'); await s.page.click('[data-act="people:edit"]'); await fillHome(s); await s.page.selectOption('#pf-role', 'rosters'); await s.page.click('[data-act="people:save"]');
  await s.settle();
  let docs = await s.docsNow();
  check(docs['roles/sam.peters@example.com'] && docs['roles/sam.peters@example.com'].role === 'rosters' && docs['roles/sam.peters@example.com'].personId === 'p19', 'giving Sam “Roster coordinator” access writes the access list');
  await s.go('people/p/p27'); await s.page.click('[data-act="people:edit"]'); await fillHome(s); await s.page.selectOption('#pf-role', 'none'); await s.page.click('[data-act="people:save"]');
  check(await s.page.isVisible('#pf-err') && (await s.page.textContent('#pf-err')).includes('marital'), 'marital status must be chosen for adults');
  await s.page.selectOption('#pf-marital', 'Not known'); await s.page.click('[data-act="people:save"]'); await s.settle();
  docs = await s.docsNow(); check(!docs['roles/ruth.daniels@example.com'], 'choosing “No access” removes their sign-in');
  check(docs['details/p27'].maritalStatus === 'Not known' && !docs['people/p27'].maritalStatus, 'marital status is kept with the private details (not the contact card)');
  // Staff details: make Sam a Support Staff member
  await s.go('people/p/p19'); await s.page.click('[data-act="people:edit"]'); await fillHome(s); await s.page.check('#pf-staff'); await s.page.click('[data-act="people:save"]');
  check((await s.page.textContent('#pf-err')).includes('staff category'), 'staff need a category and start date');
  await s.page.selectOption('#pf-scat', 'Support Staff'); await s.page.fill('#pf-sstart', '2026-07-01');
  await s.page.uncheck('#pf-sw-same'); await s.page.check('.pf-sw[value="Mon"]'); await s.page.check('.pf-sw[value="Tue"]');
  await s.page.click('[data-act="people:save"]'); await s.settle();
  docs = await s.docsNow();
  check(docs['details/p19'].staff && docs['details/p19'].staff.category === 'Support Staff' && docs['details/p19'].staff.workDays === 'Mon, Tue' && docs['people/p19'].category === 'Church Partner', 'Administrator can mark someone as staff (category, start date, own working days); they stay a Church Partner');
  await s.go('leave/team'); check((await s.text()).includes('Sam Peters'), 'new staff member appears in Leave team balances');
  // Leave settings
  await s.go('leave/settings');
  await s.page.click('[data-act="leave:addterm"]');
  const tr = (await s.page.$$('.ls-term')).pop();
  await (await tr.$('.ls-tn')).fill('Term 1 2027'); await (await tr.$('.ls-ts')).fill('2027-01-14'); await (await tr.$('.ls-te')).fill('2027-03-27');
  await s.page.click('[data-act="leave:saveterms"]'); await s.settle();
  docs = await s.docsNow(); check(docs['leave/config'].terms.some(t => t.name === 'Term 1 2027' && t.end === '2027-03-27'), 'school terms can be added');
  const supportRow = await s.page.$('#ls-levels tbody tr:has-text("Support Staff")');
  await (await supportRow.$('.ls-ent[data-code="SSL"]')).fill('22'); await s.page.click('[data-act="leave:savelevels"]'); await s.settle();
  docs = await s.docsNow(); check(docs['leave/config'].levels.find(l => l.level === 'Support Staff').ent.SSL === 22, 'allowances per category can be changed');
  const yy = new Date().getFullYear() + 2; await s.page.click(`[data-act="leave:addsa"][data-y="${yy}"]`); await s.settle();
  await s.page.fill('#ls-hd', yy + '-12-28'); await s.page.fill('#ls-hn', 'Office closed'); await s.page.click('[data-act="leave:addhol"]'); await s.settle();
  docs = await s.docsNow();
  check(docs['leave/config'].holidays.some(h => h.date === yy + '-12-25') && docs['leave/config'].holidays.some(h => h.name === 'Office closed'), 'public holidays for another year and church closures can be added');
  await s.page.uncheck('.ls-tappr[data-i="7"]'); await s.page.click('[data-act="leave:savetypes"]'); await s.settle();
  docs = await s.docsNow(); check(docs['leave/config'].autoApprove.includes('UL'), 'a kind of leave can be set to not need approval');
  // Record a death: Johan (married to Elsa, on the Door team)
  await s.go('people/p/p23'); await s.page.click('[data-act="people:death"]');
  check(await s.page.isVisible('.dd-sp[value="p24"]'), 'offers to change the spouse to Widowed');
  await s.page.click('[data-act="people:savedeath"]'); await s.settle();
  docs = await s.docsNow();
  const futureJohan = Object.keys(docs).filter(k => k.startsWith('assignments/') && docs[k].personId === 'p23' && (docs['services/' + docs[k].serviceId] || {}).date >= new Date().toISOString().slice(0, 10));
  check(docs['people/p23'].active === false && docs['people/p23'].category === 'Deceased' && docs['details/p23'].deceasedAt && docs['details/p23'].deathTidied, 'recording a death keeps them on the records as Deceased');
  check(docs['details/p24'].maritalStatus === 'Widowed', 'spouse’s marital status becomes Widowed');
  check(!docs['roles/johan.vandermerwe@example.com'] && !docs['directory/p23'], 'they can’t sign in and leave the directory');
  check(!Object.keys(docs).some(k => k.startsWith('skills/') && docs[k].personId === 'p23') && futureJohan.length === 0, 'they come off teams and future rosters');
  check(Object.keys(docs).some(k => k.startsWith('audit/') && /Recorded the death/.test(docs[k].action)), 'the death is in the audit log');
  let tt;
  await s.go('people/p/p24'); tt = await s.text();
  check(tt.includes('Late spouse') && tt.includes('Was married to Johan van der Merwe') && docs['details/p24'].lateSpouseId === 'p23', 'the surviving spouse’s record says who they were married to');
  await s.go('people/p/p23'); tt = await s.text();
  check(tt.includes('Was married to Elsa van der Merwe'), 'and the record of the one who died names the surviving spouse');
  await s.go('people/p/p24'); await s.page.click('[data-act="people:edit"]'); await fillHome(s);
  await s.page.selectOption('#pf-late', '__out'); await s.page.fill('#pf-late-n', 'Pieter Botha'); await s.page.click('[data-act="people:save"]'); await s.settle();
  docs = await s.docsNow(); tt = await s.text();
  check(tt.includes('Was married to Pieter Botha') && !tt.includes('Was married to Johan') && docs['details/p24'].lateSpouseName === 'Pieter Botha' && !docs['details/p24'].lateSpouseId, 'an Administrator can change who a widow was married to (someone not in Church Hub)');
  await s.page.click('[data-act="people:edit"]'); await s.page.selectOption('#pf-late', 'p23'); await s.page.click('[data-act="people:save"]'); await s.settle();
  docs = await s.docsNow(); tt = await s.text();
  check(tt.includes('Was married to Johan van der Merwe') && docs['details/p24'].lateSpouseId === 'p23' && !docs['details/p24'].lateSpouseName, '… or choose someone in Church Hub who has died');
  await s.page.click('[data-act="people:edit"]'); await s.page.selectOption('#pf-late', ''); await s.page.click('[data-act="people:save"]'); await s.settle();
  tt = await s.text(); check(!tt.includes('Late spouse'), '… or nobody');
  // Late spouse suggestions: clear Elsa's, and Church Hub should suggest Johan again (same household and surname)
  await s.page.click('[data-act="people:edit"]'); await s.page.selectOption('#pf-late', ''); await s.page.click('[data-act="people:save"]'); await s.settle();
  await s.page.evaluate(() => { const e = Store.get('people', 'p24'); delete e.lateSpouseSet; });
  await s.go('people'); check((await s.page.textContent('a[href="#/people/late"]')).includes('1'), 'People shows how many late spouse suggestions there are');
  await s.go('people/late'); tt = await s.text();
  check(tt.includes('Elsa van der Merwe') && tt.includes('Johan van der Merwe') && tt.includes('same household') && tt.includes('same surname'), 'Late spouses suggests Elsa was married to Johan, with the clues');
  await s.page.click('[data-act="people:lateyes"][data-a="p24"][data-b="p23"]'); await s.settle(); docs = await s.docsNow();
  check(docs['details/p24'].lateSpouseId === 'p23' && !(await s.text()).includes('Probably married'), '“Yes, they were married” records it and the suggestion goes');
  await s.go('people/p/p23');
  await s.page.click('[data-act="people:edit"]'); await s.page.fill('#pf-email', ''); await s.page.fill('#pf-mobile', '');
  const reqs = await s.page.$$eval('#pf .field.req input, #pf .field.req select', els => els.map(e => e.id));
  await s.page.click('[data-act="people:save"]'); await s.settle(); docs = await s.docsNow();
  check(reqs.join() === 'pf-first,pf-last,pf-died' && !(await s.page.$('#pf')) && !docs['people/p23'].email, 'for someone who has died only first and last name (and the date they died) must be filled in: ' + reqs.join());
  await s.page.click('[data-act="people:edit"]'); await s.page.fill('#pf-died', '2026-01-15'); await s.page.fill('#pf-funeral', '2026-01-22'); await s.page.click('[data-act="people:save"]'); await s.settle(); docs = await s.docsNow();
  check(docs['details/p23'].deceasedAt === '2026-01-15' && docs['details/p23'].keyDates.some(k => k.label === 'Funeral' && k.date === '2026-01-22') && docs['details/p23'].keyDates.filter(k => k.label === 'Died').length === 1 && (await s.text()).includes('15 Jan 2026'),
    'the date of death (and funeral) can be corrected in Edit details');
  // Staff can be Church Partners too
  await s.go('people/p/p02'); await s.page.click('[data-act="people:edit"]'); await s.page.selectOption('#pf-cat', 'Church Partner'); await s.page.click('[data-act="people:save"]'); await s.settle();
  docs = await s.docsNow(); tt = await s.text();
  check(docs['people/p02'].category === 'Church Partner' && docs['details/p02'].staff && tt.includes('Church Partner') && tt.includes('Staff · '), 'a staff member can be a Church Partner too (both shown)');
  await s.go('people'); await s.page.click('[data-act="people:filter"][data-f="Staff"]'); tt = await s.text();
  check(tt.includes('Mokoena, Thandi'), 'and still appears under Staff');
  await s.page.click('[data-act="people:filter"][data-f="Church Partner"]'); check((await s.text()).includes('Mokoena, Thandi'), 'and under Church Partners');
  await s.page.click('[data-act="people:filter"][data-f="all"]');
  // ID numbers: Administrators only, every view logged
  await s.go('people/p/p15'); await s.page.click('[data-act="people:editid"]'); await s.page.fill('#idn-v', '8001015009087'); await s.page.click('[data-act="people:saveid"]'); await s.settle();
  docs = await s.docsNow();
  check(docs['idNumbers/p15'] && docs['idNumbers/p15'].value === '8001015009087' && !JSON.stringify(docs['people/p15']).includes('8001015009087') && !JSON.stringify(docs['details/p15']).includes('8001015009087'), 'an Administrator can record an ID number, kept apart from the rest');
  check(!(await s.text()).includes('8001015009087'), 'the ID number is hidden until someone asks to see it');
  await s.page.click('[data-act="people:showid"]'); await s.page.waitForSelector('#pp-idn .idn'); await s.settle(); docs = await s.docsNow();
  check((await s.text()).includes('8001015009087') && Object.keys(docs).some(k => k.startsWith('audit/') && /Viewed the ID number of/.test(docs[k].action)), 'Show reveals it, and the view is in the history log');
  // Church office notes
  await s.page.fill('#on-text', 'Moved to Durban in 2019.'); await s.page.click('[data-act="people:onote"]'); await s.settle(); docs = await s.docsNow();
  check(docs['officeNotes/p15'] && docs['officeNotes/p15'].entries[0].text === 'Moved to Durban in 2019.' && (await s.text()).includes('Moved to Durban in 2019.'), 'Administrators can add church office notes');
  // Gender and Church Partner dates
  await s.page.click('[data-act="people:edit"]'); await fillHome(s); await s.page.selectOption('#pf-cat', 'Church Partner');
  await s.page.selectOption('#pf-gender', 'Female'); await s.page.fill('#pf-psince', '2015-03-01'); await s.page.fill('#pf-pupd', '2024-02-11');
  await s.page.click('[data-act="people:save"]'); await s.settle(); docs = await s.docsNow(); tt = await s.text();
  check(docs['details/p15'].gender === 'Female' && docs['details/p15'].partnerSince === '2015-03-01' && docs['details/p15'].partnerUpdated === '2024-02-11' && tt.includes('Accepted') && tt.includes('Partnership last updated'), 'gender and the Church Partner dates are saved and shown');
  await s.page.click('[data-act="people:edit"]'); await s.page.fill('#pf-middle', 'Anne'); await s.page.fill('#pf-street', '12 Main Road'); await s.page.fill('#pf-city', 'Howick'); await s.page.fill('#pf-postcode', '3290'); await s.page.fill('#pf-province', 'KwaZulu-Natal');
  await s.page.click('[data-act="people:save"]'); await s.settle(); docs = await s.docsNow(); tt = await s.text();
  check(docs['details/p15'].middleName === 'Anne' && docs['details/p15'].address.city === 'Howick' && tt.includes('12 Main Road') && tt.includes('Howick 3290') && !tt.includes('South Africa') && !JSON.stringify(docs['people/p15']).includes('Main Road'), 'middle name and home address saved with the private details and shown');
  await s.page.evaluate(() => { const p = JSON.parse(JSON.stringify(Store.get('people', 'p15'))); p.partnerUpdated = '2026'; Store.put('people', p); }); await s.settle();
  await s.go('people'); await s.go('people/p/p15'); const yrT = await s.text(); check(yrT.includes('Partnership last updated 2026'), 'a renewal year from Elvanto shows as the year: ' + (yrT.match(/Accepted.{0,80}/) || [yrT.slice(yrT.indexOf('Gender'), yrT.indexOf('Gender') + 200)])[0]);
  await s.page.click('[data-act="people:edit"]'); await s.page.click('[data-act="people:save"]'); await s.settle(); docs = await s.docsNow();
  check(docs['details/p15'].partnerUpdated === '2026', 'saving without a date keeps the year from Elvanto');
  await s.page.click('[data-act="people:edit"]'); await s.page.selectOption('#pf-cat', 'Attender');
  check(await s.page.isHidden('#pf-partner-f'), 'the partnership dates only show for Church Partners');
  check((await s.page.$$eval('#pf-fam option', o => o.map(x => x.value)))[1] === '__new', '“+ New household…” is at the top of the list');
  await s.page.click('[data-act="hub:close"]');
  // Departments and positions, then volunteering
  await s.go('rosters/teams'); await s.page.click('[data-act="rosters:setupdepts"]'); await s.settle(); docs = await s.docsNow();
  const posDocs = Object.keys(docs).filter(k => k.startsWith('positions/pos-'));
  check(docs['teams/dept-operational'] && docs['teams/dept-music'] && docs['teams/dept-creche'] && posDocs.length === 26 && docs['teams/dept-memorial'] && JSON.stringify(docs['positions/pos-creche'].times) === '["08:00"]' && docs['positions/pos-host'].times.length === 3,
    'Rosters → Teams adds the church’s 8 departments and 26 positions (Creche Duty only at 8:00): ' + posDocs.length);
  check(docs['positions/pos-tea'].teamId === 'hosp' && !docs['teams/dept-hospitality'], 'an existing team with the same name (Hospitality) is used, not doubled');
  check(!(await s.page.$('[data-act="rosters:setupdepts"]')) && (await s.text()).includes('8am only'), 'once added, the offer goes, and 8am-only positions say so');
  await s.go('people/p/p15'); await s.page.click('[data-act="people:volunteer"]');
  await s.page.check('input[name="vol"][value="yes"]'); await s.page.check('.vol-t[value="08:00"]'); await s.page.check('.vol-t[value="10:00"]'); await s.page.uncheck('.vol-t[value="17:00"]');
  await s.page.check('.vol-d[data-t="dept-music"]'); await s.page.check('.vol-p[value="pos-sound"]'); await s.page.check('.vol-p[value="pos-drums"]');
  await s.page.click('[data-act="people:savevolunteer"]'); await s.settle(); docs = await s.docsNow(); tt = await s.text();
  const vsk = Object.keys(docs).filter(k => k.startsWith('skills/') && docs[k].personId === 'p15').map(k => docs[k]);
  check(vsk.some(k => k.positionId === 'pos-sound' && JSON.stringify(k.times) === '["08:00","10:00"]') && vsk.some(k => k.positionId === 'pos-drums') && tt.includes('8am, 10am') && tt.includes('Sound Desk'),
    'volunteering: services, department and positions are saved as their serving, and shown');
  await s.page.click('[data-act="people:volunteer"]'); await s.page.check('input[name="vol"][value="no"]'); await s.page.click('[data-act="people:savevolunteer"]'); await s.settle(); docs = await s.docsNow();
  check(!Object.keys(docs).some(k => k.startsWith('skills/') && docs[k].personId === 'p15') && (await s.text()).includes('Volunteer'), '“No” takes them off all positions (an offer to serve they made stays)');
  await s.go('people'); let tDead = await s.text();
  check(!tDead.includes('Merwe, Johan'), 'someone who has died is not in the Everyone list');
  await s.page.click('[data-act="people:filter"][data-f="deceased"]'); tDead = await s.text();
  check(tDead.includes('van der Merwe, Johan') && tDead.includes('Died ') && !tDead.includes('Jacobs, Tim'), 'the Deceased button lists people who have died, with the date');
  await s.page.click('[data-act="people:filter"][data-f="all"]');
  // Family names: named after the adults, follow changes, can be given an own name
  await s.go('people/families'); let famText = await s.text();
  check(famText.includes('Tim & Clare Jacobs') && famText.includes('Jason & Priya Naidoo') && famText.includes('Thandi Mokoena'), 'families are named after their adults');
  check(famText.includes('Elsa van der Merwe') && !famText.includes('Johan & Elsa'), 'a family’s name follows a death by itself');
  await s.page.click('[data-act="people:renamefam"][data-id="f2"]'); await s.page.fill('#rf-name', 'The Jacobs household'); await s.page.click('[data-act="people:saverename"]'); await s.settle();
  docs = await s.docsNow(); famText = await s.text();
  check(docs['families/f2'].custom === true && famText.includes('The Jacobs household'), 'a family can be given its own name');
  await s.page.click('[data-act="people:renamefam"][data-id="f2"]'); await s.page.check('input[name="rf-mode"][value="auto"]'); await s.page.click('[data-act="people:saverename"]'); await s.settle();
  check((await s.text()).includes('Tim & Clare Jacobs'), 'and switched back to being named after its adults');
  await s.go('people/p/p14'); check((await s.text()).includes('Tim & Clare Jacobs'), 'profiles show the family name');
  {
    await s.go('people/p/p25'); await s.page.click('[data-act="people:edit"]');
    check(!!(await s.page.$('label.req #pf-cat')) && !!(await s.page.$('label.req #pf-fam')) && !!(await s.page.$('label.req #pf-frole')), 'category, household and “in the household as” are shaded as must-fill');
    await s.page.click('[data-act="people:save"]');
    check((await s.page.textContent('#pf-err')).includes('choose their household'), 'someone can’t be saved without a household');
    await fillHome(s);
    check((await s.page.getAttribute('#pf-email', 'placeholder')).includes('unknown') && !!(await s.page.$('#pf-email-f.req')) && !!(await s.page.$('#pf-mobile-f.req')), 'email and mobile are shaded as must-fill, with a grey hint to type “unknown”');
    await s.page.fill('#pf-email', ''); await s.page.click('[data-act="people:save"]');
    check((await s.page.textContent('#pf-err')).includes('email address, or type'), 'an adult can’t be saved without an email (or “unknown”)');
    await s.page.fill('#pf-email', 'Unknown'); await s.page.selectOption('#pf-role', 'none'); await s.page.click('[data-act="people:save"]'); await s.settle();
    const d25 = await s.docsNow();
    check(d25['people/p25'].email === '' && (d25['details/p25'] || {}).emailUnknown === true, '“unknown” is saved as not known, never as the word');
    check((await s.text()).includes('Unknown'), 'the profile shows “Unknown”');
  }
  {
    const y = new Date().getFullYear() - 12, wed = y + '-01-01';
    await s.go('people/p/p14'); await s.page.click('[data-act="people:edit"]'); await fillHome(s); await s.page.fill('#pf-birth', (y - 20) + '-01-01'); await s.page.selectOption('#pf-marital', 'Married'); await s.page.fill('#pf-wed', wed);
    await s.page.click('[data-act="people:save"]'); await s.settle();
    const tw = await s.text();
    check(/Age 32/.test(tw) && /Wedding anniversary/.test(tw) && /Married 12 years/.test(tw), 'profile shows age under the birthday, and the wedding anniversary with years married');
    const dd = await s.docsNow(); const kd = (dd['details/p14'] || dd['people/p14'] || {}).keyDates || [];
    check(kd.filter(k => /wedding/i.test(k.label)).length === 1 && kd.some(k => k.date === wed), 'the anniversary is saved once, as a key date');
  }
  await s.go('leave/approvals'); await s.page.click('[data-act="leave:decide"][data-d="Approved"]'); await s.settle();
  docs = await s.docsNow(); const approved = Object.keys(docs).filter(k => k.startsWith('leaveRequests/') && docs[k].status === 'Approved' && docs[k].decidedOn);
  check(approved.length === 1 && docs['away/' + approved[0].split('/')[1]], 'approving leave saves it and marks the dates as away');
  await s.page.evaluate(() => { const p = Store.get('people', 'p10'); p.active = false; Store.put('people', p); });
  await s.go('privacy/retention'); await s.page.click('[data-act="privacy:erase"][data-id="p10"]'); await s.page.click('[data-act="privacy:erase"][data-id="p10"]'); await s.settle();
  docs = await s.docsNow();
  if (docs['notes/p10'] || docs['directory/p10'] || docs['people/p10'].firstName !== 'Deleted' || docs['roles/jason.naidoo@example.com']) console.log('    debug:', JSON.stringify({ n: docs['notes/p10'], d: docs['directory/p10'], p: docs['people/p10'], r: docs['roles/jason.naidoo@example.com'] }));
  check(!docs['notes/p10'] && !docs['directory/p10'] && docs['people/p10'].firstName === 'Deleted' && !docs['roles/jason.naidoo@example.com'], 'deleting Jason removes his pastoral notes, directory entry and sign-in (Admin can’t read the notes)');
  check(Object.keys(docs).some(k => k.startsWith('audit/') && docs[k].byEmail === 'linda.pillay@example.com' && /Deleted the personal information/.test(docs[k].action)), 'the deletion is in the audit log');
  await s.go('privacy/audit'); check((await s.text()).includes('Signed in'), 'audit log shows sign-ins');
  await finish(s);

  /* ---------- Households, parents and guardians, collection ---------- */
  console.log('Children’s ministry – parents, guardians and collection:');
  s = await session('grace.ndlovu@example.com', seedDocs());
  await s.go('people/p/p12'); let t = await s.text();
  check(t.includes('Parents, guardians and collection') && t.includes('Jason Naidoo') && t.includes('Granny Naidoo') && t.includes('Trusted collector'), 'a child’s parents and a trusted collector (not in Church Hub) are shown');
  await s.go('people/p/p13'); t = await s.text();
  check(t.includes('Not allowed to collect') && t.includes('J. Example') && t.includes('court order'), 'collection restrictions are shown on the child');
  await s.settle(); docs = await s.docsNow();
  check(Object.keys(docs).some(k => k.startsWith('audit/') && docs[k].action === 'Viewed collection restrictions for Ravi Naidoo'), 'viewing a collection restriction is logged');
  await s.go('people/p/p16'); await s.page.click('[data-act="people:link"][data-child="p16"]');
  await s.page.selectOption('#gl-who', 'p24'); await s.page.selectOption('#gl-rel', 'Step-parent');
  check(!(await s.page.isChecked('#gl-consent')) && await s.page.isChecked('#gl-collect'), 'a step-parent can collect but can’t give consent by default');
  await s.page.click('[data-act="people:linksave"]'); await s.settle();
  await s.page.click('[data-act="people:nc"][data-child="p16"]'); await s.page.fill('#nc-name', 'Made-up Person'); await s.page.fill('#nc-note', 'Court order'); await s.page.click('[data-act="people:ncsave"]'); await s.settle();
  docs = await s.docsNow();
  check(Object.keys(docs).some(k => k.startsWith('guardians/') && docs[k].childId === 'p16' && docs[k].adultId === 'p24' && docs[k].relationship === 'Step-parent' && docs[k].confirmed) &&
    Object.keys(docs).some(k => k.startsWith('noCollect/') && docs[k].childId === 'p16' && docs[k].name === 'Made-up Person'), 'Children’s ministry can add a responsible adult and a collection restriction');
  await finish(s);

  console.log('Pastor – consent, households and search by family:');
  s = await session('thandi.mokoena@example.com', seedDocs());
  await s.go('people/p/p28'); t = await s.text();
  check(t.includes('Lives in 2 households') && t.includes('Musa Mokoena'), 'a child of separated parents shows both homes');
  await s.page.click('[data-act="people:consent"][data-id="p28"]');
  const givers = await s.page.$$eval('#cf-guardian option', os => os.map(o => o.textContent));
  check(givers.length === 2 && givers.includes('Thandi Mokoena') && givers.includes('Musa Mokoena'), 'consent for a child can only come from the parents or guardians who can give consent');
  await s.page.click('[data-act="hub:close"]');
  await s.go('people/p/p16'); await s.page.click('[data-act="people:addhome"][data-id="p16"]'); await s.page.selectOption('#hm-f', 'f3'); await s.page.click('[data-act="people:savehome"]'); await s.settle();
  docs = await s.docsNow(); check(JSON.stringify(docs['people/p16'].householdIds) === '["f3"]', 'a child can be added to another household');
  await s.go('people'); await s.page.fill('#pp-q', 'jacobs'); await s.page.waitForTimeout(100); t = await s.text();
  check(t.includes('Jacobs, Tim') && t.includes('Jacobs, Clare') && t.includes('Jacobs, Liam'), 'People search finds everyone in a family by the family’s name');
  await s.page.evaluate(() => { Store.get('people', 'p14').preferredName = 'TJ'; });   // Tim Jacobs, known as TJ
  await s.go('people'); await s.page.fill('#pp-q', 'tim jacobs'); await s.page.waitForTimeout(100); const t1 = await s.text();
  await s.page.fill('#pp-q', 'tj'); await s.page.waitForTimeout(100); const t2 = await s.text();
  check(t1.includes('Jacobs, TJ (Tim)') && t2.includes('Jacobs, TJ (Tim)'), 'People search finds someone by first name and by what they are known as');
  await s.page.fill('#pp-q', 'clar jac'); await s.page.waitForTimeout(100); const t3 = await s.text();
  await s.page.fill('#pp-q', 'jac cla'); await s.page.waitForTimeout(100); const t4 = await s.text();
  check(t3.includes('Jacobs, Clare') && !t3.includes('Naidoo') && t4.includes('Jacobs, Clare'), 'search by parts of words, in any order (“clar jac”, “jac cla”)');
  await s.page.fill('#pp-q', 'jacobs'); await s.page.waitForTimeout(100);
  const order = async () => s.page.$$eval('#main .list .item b', (els) => els.map((e) => e.textContent));
  let o = await order();
  check(o.join('|') === 'Jacobs, Clare|Jacobs, Liam|Jacobs, TJ (Tim)', 'People list is sorted by surname by default: ' + o.join('|'));
  await s.page.click('[data-act="people:sort"][data-k="first"]'); o = await order();
  check(o.join('|') === 'Clare Jacobs|Liam Jacobs|Tim Jacobs (TJ)', 'switching to First name sorts and shows by first name: ' + o.join('|'));
  await s.page.click('[data-act="people:sort"][data-k="known"]'); o = await order();
  check(o.join('|') === 'Clare Jacobs|Liam Jacobs|TJ Jacobs (Tim)', 'switching to Known as sorts and shows by the name they go by: ' + o.join('|'));
  await s.go('people'); await s.page.fill('#pp-q', 'jacobs'); await s.page.waitForTimeout(100);
  check(await s.page.getAttribute('[data-act="people:sort"][data-k="known"]', 'aria-pressed') === 'true', 'the chosen sort order is remembered');
  await s.page.click('[data-act="people:sort"][data-k="last"]');
  await s.go('people/families'); await s.page.fill('#fm-q', 'Tim'); await s.page.waitForTimeout(100);
  check((await s.text()).includes('Jacobs'), 'Households search also finds someone by first name when they have a known-as name');
  await s.page.evaluate(() => { Store.get('people', 'p14').preferredName = ''; });
  await s.go('people');
  await s.page.fill('#pp-q', 'musa'); await s.page.waitForTimeout(100); t = await s.text();
  check(t.includes('Mokoena, Noah'), 'searching a parent’s name also finds the children who live with them');
  await s.go('people/families'); await s.page.fill('#fm-q', 'Liam'); await s.page.waitForTimeout(100); t = await s.text();
  check(t.includes('Tim & Clare Jacobs') && !t.includes('Naidoo'), 'Households page: search by household or anyone in it');
  await s.go('people'); t = await s.text();
  check(t.includes('Church Partners') && t.includes('Visiting ministers') && !/\bMembers\b/.test(t), 'categories are called Church Partner, Attender, Visiting Minister');
  await finish(s);

  console.log('Roster coordinator and member – no access to children’s responsible adults:');
  s = await session('sipho.dlamini@example.com', seedDocs());
  await s.go('people/p/p13'); t = await s.text();
  check(!t.includes('Parents, guardians and collection') && await s.page.evaluate(() => Store.list('guardians').length === 0 && Store.list('noCollect').length === 0), 'a Roster coordinator sees no parents/guardians list or collection restrictions');
  await finish(s);
  s = await session('tim.jacobs@example.com', seedDocs());
  check(await s.page.evaluate(() => Store.list('noCollect').length === 0 && Store.list('guardians').every(l => l.adultId === 'p14') && Store.list('guardians').length === 1), 'a parent (member) sees only the link naming them, never collection restrictions');
  await finish(s);

  console.log('People: statistics hidden at first, advanced search:');
  s = await session('linda.pillay@example.com', seedDocs());
  await s.go('people');
  check(!!(await s.page.$('#pp-stats')) && !(await s.page.$('#pp-stats[open]')), '“Church at a glance” is closed until opened');
  await s.page.click('#pp-stats > summary'); check(!!(await s.page.$('#pp-stats[open]')), 'opens with a click');
  await s.page.click('a[href="#/people/search"]'); await s.page.waitForSelector('#adv');
  await s.page.selectOption('.adv-field[data-i="0"]', 'category'); await s.page.selectOption('.adv-v[data-i="0"]', 'Church Partner');
  await s.page.click('[data-act="people:advadd"][data-i="0"]');
  await s.page.selectOption('.adv-field[data-i="1"]', 'adultChild'); await s.page.selectOption('.adv-v[data-i="1"]', 'Child');
  await s.page.click('[data-act="people:advrun"]');
  let want = await s.page.evaluate(() => Store.find('people', p => p.active !== false && p.category === 'Church Partner' && p.familyRole === 'child').map(p => p.id).sort().join());
  let got = await s.page.$$eval('.adv-table tbody a', as => as.map(a => a.getAttribute('href').split('/').pop()).sort().join());
  check(want && got === want, 'all of: Partner AND child finds exactly the right people');
  await s.page.selectOption('#adv-match', 'any'); await s.page.click('[data-act="people:advrun"]');
  want = await s.page.evaluate(() => Store.find('people', p => p.active !== false && (p.category === 'Church Partner' || p.familyRole === 'child')).length);
  check((await s.page.$$('.adv-table tbody tr')).length === want, 'any of: Partner OR child');
  await s.page.selectOption('#adv-match', 'logic'); await s.page.fill('#adv-logic', '1 AND NOT 2'); await s.page.press('#adv-logic', 'Enter');
  want = await s.page.evaluate(() => Store.find('people', p => p.active !== false && p.category === 'Church Partner' && p.familyRole !== 'child').length);
  check((await s.page.$$('.adv-table tbody tr')).length === want, 'your own logic: 1 AND NOT 2');
  await s.page.click('[data-act="people:sort"][data-k="first"]');
  let names = await s.page.$$eval('.adv-table tbody td a[href^="#/people/p/"]', as => as.map(a => a.textContent));
  check(names.length > 1 && names.every((n, i) => !i || names[i - 1].localeCompare(n, undefined, { sensitivity: 'base' }) <= 0) && !names[0].includes(','), 'Advanced search results can be sorted by first name: ' + names.slice(0, 3).join(' | '));
  await s.page.click('[data-act="people:sort"][data-k="last"]');
  names = await s.page.$$eval('.adv-table tbody td a[href^="#/people/p/"]', as => as.map(a => a.textContent));
  check(names.every(n => n.includes(', ')), 'and by surname, shown as “Surname, Name”');
  await s.page.fill('#adv-logic', '1 AND 3'); await s.page.click('[data-act="people:advrun"]');
  check((await s.text()).includes('There is no filter 3'), 'a mistake in the logic is explained in plain English');
  await s.page.fill('#adv-logic', '1 OR 2'); await s.page.selectOption('#adv-addcol', 'birthday'); await s.page.click('[data-act="people:advrun"]');
  check((await s.page.$$eval('.adv-table th', th => th.map(x => x.textContent))).some(x => x.includes('Birthday')), 'a column can be added');
  const [dl] = await Promise.all([s.page.waitForEvent('download'), s.page.click('[data-act="people:advcsv"]')]);
  check(/people-search-.*\.csv/.test(dl.suggestedFilename()), 'results download as a CSV file');
  await s.settle(); docs = await s.docsNow();
  check(Object.keys(docs).some(k => k.startsWith('audit/') && /Downloaded an advanced search/.test(docs[k].text || docs[k].what || JSON.stringify(docs[k]))), 'downloading search results is in the audit log');
  check(await s.page.$$eval('.adv-field[data-i="0"] option', o => ['marital', 'consents', 'access', 'status'].every(k => o.some(x => x.value === k))), 'Administrators can search marital status, consent, app access and status');
  await s.page.evaluate(() => { const p = Store.get('people', 'p05'); p.deceasedAt = '2019-03-04'; p.active = false; p.category = 'Deceased'; });
  await s.go('people/search'); await s.page.click('[data-act="people:advreset"]');
  await s.page.selectOption('.adv-field[data-i="0"]', 'diedYear');
  await s.page.fill('input.adv-v[data-i="0"]', '2019'); await s.page.click('[data-act="people:advrun"]');
  names = await s.page.$$eval('.adv-table tbody td a[href^="#/people/p/"]', as => as.map(a => a.textContent));
  const p05 = await s.page.evaluate(() => Store.get('people', 'p05').lastName);
  check(names.length === 1 && names[0].includes(p05), 'Advanced search: Year of death finds who died that year: ' + names.join(' | '));
  await s.page.evaluate(() => { const p = Store.get('people', 'p05'); delete p.deceasedAt; p.active = true; p.category = 'Staff'; });
  // Changing many people at once
  await s.go('people'); await s.go('people/search'); await s.page.click('[data-act="people:advreset"]');
  await s.page.fill('input.adv-v[data-i="0"]', 'Jacobs'); await s.page.click('[data-act="people:advrun"]');
  check(await s.page.isDisabled('#adv-bulk'), 'Change selected… waits until someone is ticked');
  await s.page.check('#adv-selall');
  const ticked = await s.page.$$eval('.adv-sel:checked', b => b.map(x => x.value));
  check(ticked.length >= 3 && (await s.page.textContent('#adv-bulk')).includes(ticked.length + ' selected'), 'tick everyone found: ' + ticked.length);
  await s.page.click('#adv-bulk'); await s.page.selectOption('#bk-f', 'maritalStatus'); await s.page.selectOption('#bk-v', 'Widowed');
  await s.page.click('[data-act="people:bulksave"]'); await s.page.click('[data-act="people:bulksave"]'); await s.settle(); docs = await s.docsNow();
  const kidsT = await s.page.evaluate(ids => ids.filter(id => Store.get('people', id).familyRole === 'child'), ticked);
  check(ticked.filter(id => !kidsT.includes(id)).every(id => docs['details/' + id].maritalStatus === 'Widowed') && kidsT.every(id => !docs['details/' + id].maritalStatus) && kidsT.length > 0,
    'one change for everyone ticked (marital status → Widowed); children are left out');
  check((await s.text()).includes('Changed Marital status to Widowed') && Object.keys(docs).some(k => k.startsWith('audit/') && /at once/.test(docs[k].action)), 'it says what changed and it’s in the history log');
  check(await s.page.evaluate(() => { const b = document.getElementById('busy'); return !!b && b.hidden && !!b.querySelector('.busy-cross'); }), 'a turning cross showed while it worked, and has gone again');
  await s.page.click('[data-act="people:bulkundo"]'); await s.settle(); docs = await s.docsNow();
  check(docs['details/p14'].maritalStatus === 'Married' && docs['details/p15'].maritalStatus === 'Married', 'Undo puts everyone back');
  // Missing email → "not known"; no household → a new one each
  await s.page.evaluate(() => { const p = JSON.parse(JSON.stringify(Store.get('people', 'p15'))); p.email = ''; delete p.emailUnknown; Store.put('people', p);
    const q = JSON.parse(JSON.stringify(Store.get('people', 'p19'))); q.familyId = ''; q.householdIds = []; Store.put('people', q); }); await s.settle();
  await s.go('people'); await s.go('people/search'); await s.page.click('[data-act="people:advreset"]');
  await s.page.fill('input.adv-v[data-i="0"]', 'Jacobs'); await s.page.click('[data-act="people:advrun"]'); await s.page.check('#adv-selall');
  await s.page.click('#adv-bulk'); await s.page.selectOption('#bk-f', 'email'); await s.page.selectOption('#bk-v', 'Unknown');
  await s.page.click('[data-act="people:bulksave"]'); await s.page.click('[data-act="people:bulksave"]'); await s.settle(); docs = await s.docsNow(); tt = await s.text();
  check((docs['details/p15'] || {}).emailUnknown === true && !(docs['details/p14'] || {}).emailUnknown && docs['people/p14'].email && tt.includes('already have an email address'), 'missing email → “Unknown” for those without one (shown as Unknown); anyone with an email is left alone');
  await s.page.fill('input.adv-v[data-i="0"]', 'Peters'); await s.page.click('[data-act="people:advrun"]'); await s.page.check('#adv-selall');
  await s.page.click('#adv-bulk'); await s.page.selectOption('#bk-f', 'household'); await s.page.selectOption('#bk-v', { index: 1 });
  await s.page.click('[data-act="people:bulksave"]'); await s.page.click('[data-act="people:bulksave"]'); await s.settle(); docs = await s.docsNow();
  const newFam = docs['people/p19'].familyId;
  check(newFam && docs['families/' + newFam] && docs['families/' + newFam].name === 'Peters family', 'no household → “+ New household” for each person, named after their surname');
  await s.page.click('[data-act="people:bulkundo"]'); await s.settle(); docs = await s.docsNow();
  check(!docs['people/p19'].familyId && !docs['families/' + newFam], 'Undo takes them out again and removes the new household');
  await s.go('settings');
  const pastors = await s.page.evaluate(() => Store.find('people', p => p.active !== false && p.appRole === 'pastor' && p.familyRole !== 'child').map(p => p.lastName));
  const tip = await s.page.getAttribute('.who[data-role="pastor"] summary', 'title');
  await s.page.click('.who[data-role="pastor"] summary');
  const shown = await s.page.textContent('.who[data-role="pastor"] .who-list');
  check(pastors.length > 0 && pastors.every(n => tip.includes(n) && shown.includes(n)), 'Settings: pointing at (or tapping) the number of Pastors shows their names: ' + tip);
  await finish(s);
  s = await session('sipho.dlamini@example.com', seedDocs());
  await s.go('people/search');
  check(await s.page.$$eval('.adv-field[data-i="0"] option', o => { const v = o.map(x => x.value); return v.includes('positions') && v.includes('lastServed') && !['birthDate', 'birthday', 'age', 'marital', 'consents', 'guardians', 'access', 'status'].some(k => v.includes(k)); }),
    'a Roster coordinator searches names, contact and serving – not birthdays, marital status, consent or children’s adults');
  await finish(s);
  s = await session('tim.jacobs@example.com', seedDocs());
  await s.go('people'); check(!(await s.page.$('a[href="#/people/search"]')), 'members have no advanced search button');
  await s.go('people/search'); check((await s.text()).includes('isn’t available'), 'and can’t open it');
  await finish(s);

  console.log('Wedding anniversary on the profile:');
  s = await session('linda.pillay@example.com', seedDocs()); await s.go('people/p/p15');
  await s.page.click('[data-act="people:edit"]'); await fillHome(s); await s.page.selectOption('#pf-marital', 'Married'); await s.page.fill('#pf-wed', ''); await s.page.click('[data-act="people:save"]'); await s.settle();
  check(/Wedding anniversary\s*Not recorded/.test(await s.text()), 'a married person without a date shows “Wedding anniversary: Not recorded”');
  await s.page.click('button.link[data-focus="pf-wed"]');
  check(await s.page.evaluate(() => document.activeElement && document.activeElement.id === 'pf-wed'), '“Add” opens Edit details at the anniversary box');
  await s.page.fill('#pf-wed', '2000-06-10'); await s.page.click('[data-act="people:save"]'); await s.settle();
  check(/Wedding anniversary\s*\S+ 10 Jun 2000\s*Married \d+ years/.test(await s.text()), 'then it shows the date and years married');
  await finish(s);

  s = await session('linda.pillay@example.com', seedDocs()); await s.go('people/p/p14');
  check(await s.page.$eval('a[href^="mailto:"]', a => a.target === '_blank'), 'email links open in a new tab or window');
  await finish(s);

  console.log('Administrator: leave from a staff member’s page:');
  s = await session('linda.pillay@example.com', seedDocs()); await s.go('people/p/p06');
  await s.page.click('.page-head a.btn[href="#/leave/staff/p06"]'); await s.page.waitForTimeout(100);
  check((await s.page.evaluate(() => location.hash)) === '#/leave/staff/p06' && (await s.text()).includes('Lerato'), 'a staff member’s page has a Leave button that opens their leave');
  await s.go('people/p/p14'); check(!(await s.page.$('.page-head a.btn[href^="#/leave/"]')), 'no Leave button for someone who isn’t staff');
  await s.page.evaluate(() => { Store.get('people', 'p14').category = 'Staff'; }); await s.go('people/p/p15'); await s.go('people/p/p14');
  await s.page.click('.page-head [data-focus="pf-staff"]');
  check(!!(await s.page.$('#pf-staff')) && await s.page.evaluate(() => document.activeElement && document.activeElement.id === 'pf-staff'), 'marked Staff but not in Leave yet: Set up leave opens the staff details');
  await finish(s);

  console.log('Couples: spouses, partners and wedding anniversaries:');
  s = await session('thandi.mokoena@example.com', seedDocs()); await s.go('people/p/p15');
  t = await s.text(); check(t.includes('Spouse') && t.includes('Tim Jacobs') && t.includes('22 Nov 2008'), 'Clare’s page names Tim as her spouse and suggests his anniversary');
  await s.go('people/families'); t = await s.page.textContent('#couples').catch(() => '');
  check(t.includes('Tim Jacobs') && t.includes('Clare Jacobs') && t.includes('married to each other'), 'Households: couples to confirm, worked out from the household');
  check((await s.text()).includes('Spouses: Tim Jacobs & Clare Jacobs'), 'each household shows its couple');
  await s.page.click('#couples [data-act="people:couplefix"][data-a="p14"][data-b="p15"], #couples [data-act="people:couplefix"][data-a="p15"][data-b="p14"]'); await s.settle();
  docs = await s.docsNow();
  check((docs['details/p15'].keyDates || []).some(k => /Wedding/.test(k.label) && k.date === '2008-11-22'), 'one tap copies Tim’s wedding anniversary to Clare');
  check(Object.keys(docs).some(k => k.startsWith('audit/') && /Couple: wedding anniversary from Tim Jacobs/.test(JSON.stringify(docs[k]))), 'the change is in the audit log');
  check(!((await s.page.textContent('#couples').catch(() => '')) || '').includes('Clare Jacobs') && (docs['families/f2'].couples || []).includes('p14|p15'), '…the couple is confirmed and no longer needs checking');
  check((await s.text()).includes('Spouses: Tim Jacobs & Clare Jacobs') && !(await s.text()).includes('Spouses: Tim Jacobs & Clare Jacobs (to confirm)'), 'a confirmed couple shows without “to confirm”');
  await s.page.click('#couples [data-act="people:couplefix"][data-a="p23"][data-b="p24"], #couples [data-act="people:couplefix"][data-a="p24"][data-b="p23"]'); await s.settle();
  check(((await s.docsNow())['families/f6'].couples || []).includes('p23|p24'), 'a couple with nothing to fix can be confirmed with one tap');
  await s.page.evaluate(() => { Store.get('people', 'p17').maritalStatus = 'Partner'; Store.get('people', 'p18').maritalStatus = ''; });
  await s.go('people'); await s.go('people/families'); t = await s.page.textContent('#couples').catch(() => '');
  check(/partners/i.test(t) && t.includes('Megan Smith'), 'partners are suggested too');
  check(!t.includes('anniversary is') || !/Smith[^]*anniversary/.test(t), 'partners get no anniversary');
  await s.page.click('#couples [data-act="people:notcouple"][data-f="f3"]'); await s.settle(); docs = await s.docsNow();
  check((docs['families/f3'].notCouples || []).length === 1 && !((await s.page.textContent('#couples').catch(() => '')) || '').includes('Smith'), '“Not a couple” is remembered and the suggestion goes away');
  await finish(s);
  s = await session('sipho.dlamini@example.com', seedDocs()); await s.go('people/families');
  check(!(await s.page.$('#couples')) && !(await s.text()).includes('Spouses:'), 'a Roster coordinator doesn’t see couples (marital status is private)');
  await finish(s);

  console.log('Adding a person:');
  s = await session('linda.pillay@example.com', seedDocs()); await s.go('people');
  await s.page.click('[data-act="people:add"]'); await s.page.fill('#pf-first', 'Test'); await s.page.fill('#pf-last', 'Person');
  check((await s.page.$eval('#pf-cat', e => e.value)) === '' && (await s.page.$eval('#pf-frole', e => e.value)) === '', 'a new person starts with Category and “in the household as” on Choose…');
  await s.page.click('[data-act="people:save"]'); check((await s.page.textContent('#pf-err')).includes('choose a category'), 'category must be chosen');
  await s.page.selectOption('#pf-cat', 'Attender'); await s.page.selectOption('#pf-fam', '__new'); await s.page.click('[data-act="people:save"]');
  check((await s.page.textContent('#pf-err')).includes('adult or a child'), '“in the household as” must be chosen');
  await finish(s);

  console.log('Checking before leaving:');
  {
    const asks = async (sess) => { let seen = ''; sess.page.once('dialog', d => { seen = d.type(); d.dismiss().catch(() => {}); });
      await sess.page.click('h1'); await sess.page.close({ runBeforeUnload: true }); await new Promise(r => setTimeout(r, 400)); return seen === 'beforeunload'; };
    s = await session('linda.pillay@example.com', seedDocs()); check(await asks(s), 'signed in on a computer: closing the tab asks first'); await s.close();
    s = await session('', seedDocs()); check(!(await asks(s)), 'on the sign-in screen it doesn’t ask'); await s.close();
    s = await session('tim.jacobs@example.com', seedDocs(), { app: {} });
    check(!(await asks(s)), 'in the Android app the browser question is off (the app asks itself)');
    s = await session('tim.jacobs@example.com', seedDocs(), { app: {} });
    const words = await s.page.evaluate(() => { I18n.set('af'); return JSON.parse(window.churchHubLeaveText()); });
    check(words[0] === 'Verlaat Church Hub?' && words[3] === 'Maak Church Hub toe', 'the Android question is in the chosen language');
    await s.close();
  }

  console.log('Duplicates (Administrator):');
  s = await session('linda.pillay@example.com', seedDocs()); await s.go('people');
  check(!!(await s.page.$('a[href="#/people/duplicates"]')), 'People has a Find duplicates button for Administrators');
  const timMobile = (await s.docsNow())['people/p14'].mobile;
  await s.page.click('[data-act="people:add"]'); await s.page.fill('#pf-first', 'Timothy'); await s.page.fill('#pf-last', 'Jacobs'); await s.page.fill('#pf-mobile', timMobile);
  await s.page.waitForTimeout(400);
  check(await s.page.isVisible('#pf-dup') && (await s.page.textContent('#pf-dup')).includes('Tim Jacobs'), 'typing Timothy Jacobs with Tim’s mobile warns straight away');
  await s.page.selectOption('#pf-cat', 'Attender'); await s.page.selectOption('#pf-fam', '__new'); await s.page.selectOption('#pf-frole', 'adult');
  await s.page.fill('#pf-email', 'unknown'); if (await s.page.$('#pf-marital')) await s.page.selectOption('#pf-marital', 'Married');
  const nBefore = Object.keys(await s.docsNow()).filter(k => k.startsWith('people/')).length;
  await s.page.click('[data-act="people:save"]'); await s.page.waitForTimeout(100);
  check((await s.page.textContent('#pf-err')).includes('already in Church Hub') && Object.keys(await s.docsNow()).filter(k => k.startsWith('people/')).length === nBefore, 'a very likely duplicate can’t be saved');
  await s.page.check('#pf-dup-ok'); await s.page.click('[data-act="people:save"]'); await s.settle(); docs = await s.docsNow();
  const newId = Object.keys(docs).filter(k => k.startsWith('people/') && docs[k].firstName === 'Timothy').map(k => k.slice(7))[0];
  check(!!newId && (docs['details/' + newId].notSame || []).includes('p14') && (docs['details/p14'].notSame || []).includes(newId), 'an Administrator can confirm it’s a different person; that is remembered on both');
  await s.go('people/duplicates'); t = await s.text();
  check(t.includes('Find duplicates') && !t.includes('Timothy Jacobs'), 'the confirmed pair isn’t suggested as a duplicate');
  const dupId = await s.page.evaluate(() => Store.put('people', { firstName: 'Clare', lastName: 'Jacobs', email: Store.get('people', 'p15').email, mobile: '', birthDate: '1982-03-04', familyId: '', familyRole: 'adult', category: 'Attender', active: true, appRole: 'none', keyDates: [] }).id);
  await s.page.evaluate(id => { Store.put('consents', { personId: id, purpose: 'Photos', given: true, date: '2026-01-01', how: 'Form' }); Store.put('skills', { personId: id, positionId: 'door', frequency: 'monthly' }); }, dupId);
  await s.go('people'); await s.go('people/duplicates'); t = await s.text();
  check(t.includes('Probably the same person') && t.includes('Same email address'), 'Find duplicates lists a second Clare Jacobs with the reasons');
  await s.page.click('[data-act="people:fixdup"]'); await s.page.waitForSelector('[data-act="people:fixdo"]');
  await s.page.click('[data-act="people:fixkeep"][data-keep="p15"]'); await s.page.waitForTimeout(100);
  t = await s.page.textContent('#modal'); check(t.includes('Birthday') && t.includes('1 consent') && t.includes('1 serving position'), 'Fix shows what will be filled in and moved');
  await s.page.click('[data-act="people:fixdo"]'); await s.settle(); docs = await s.docsNow();
  check(docs['people/' + dupId].active === false && docs['details/' + dupId].mergedInto === 'p15', 'the extra record is retired, pointing to the kept one');
  check(docs['details/p15'].birthDate === '1982-03-04', 'the kept record gets the birthday it was missing');
  check(Object.keys(docs).some(k => k.startsWith('consents/') && docs[k].personId === 'p15' && docs[k].purpose === 'Photos') && Object.keys(docs).some(k => k.startsWith('skills/') && docs[k].personId === 'p15' && docs[k].positionId === 'door'), 'consents and serving moved to the kept record');
  check((await s.page.evaluate(() => location.hash)) === '#/people/p/p15', 'opens the kept record afterwards');
  await s.go('people/p/' + dupId); check((await s.text()).includes('merged into'), 'the old record says where it went');
  await s.go('people/duplicates'); check(!(await s.text()).includes('Probably the same person'), 'nothing left to fix');
  await finish(s);
  s = await session('thandi.mokoena@example.com', seedDocs()); await s.go('people');
  check(!!(await s.page.$('a[href="#/people/duplicates"]')), 'Pastors can find duplicates too');
  const d1 = await s.page.evaluate(() => Store.put('people', { firstName: 'Megan', lastName: 'Smith', email: Store.get('people', 'p17').email, familyId: '', familyRole: 'adult', category: 'Attender', active: true, appRole: 'none', keyDates: [] }).id);
  const d2 = await s.page.evaluate(() => Store.put('people', { firstName: 'Ruth', lastName: 'Daniels', email: Store.get('people', 'p27').email, familyId: '', familyRole: 'adult', category: 'Attender', active: true, appRole: 'none', keyDates: [] }).id);
  await s.page.evaluate(id => { Store.list('skills').push({ id: 'kx', personId: id, positionId: 'door' }); }, d2);
  await s.go('people/duplicates');
  await s.page.click('[data-act="people:fixdup"][data-a="' + d2 + '"], [data-act="people:fixdup"][data-b="' + d2 + '"]'); await s.page.waitForSelector('#modal [data-act="people:fixkeep"]');
  await s.page.click('[data-act="people:fixkeep"][data-keep="p27"]'); await s.page.waitForTimeout(100);
  check((await s.page.textContent('#modal')).includes('only an Administrator can move') && !(await s.page.$('[data-act="people:fixdo"]')), 'a Pastor can’t fix a duplicate that has rosters: ask an Administrator');
  await s.page.click('[data-act="hub:close"]');
  await s.page.click('[data-act="people:fixdup"][data-a="' + d1 + '"], [data-act="people:fixdup"][data-b="' + d1 + '"]'); await s.page.waitForSelector('#modal [data-act="people:fixkeep"]');
  await s.page.click('[data-act="people:fixkeep"][data-keep="p17"]'); await s.page.waitForTimeout(100); await s.page.click('[data-act="people:fixdo"]'); await s.settle();
  check((await s.docsNow())['details/' + d1].mergedInto === 'p17' && !(await s.denied()).length, 'a Pastor can fix a simple duplicate (nothing refused by the security rules)');
  await s.go('people'); await s.page.click('[data-act="people:add"]'); await s.page.fill('#pf-first', 'Tim'); await s.page.fill('#pf-last', 'Jacobs'); await s.page.fill('#pf-mobile', timMobile); await s.page.waitForTimeout(400);
  check(!!(await s.page.$('#pf-dup-ok')), 'a Pastor can also confirm “a different person” when adding someone');
  await finish(s);

  console.log('Away dates – kind of leave and reason:');
  {
    const docs0 = seedDocs(), today = new Date().toISOString().slice(0, 10);
    const lr = Object.keys(docs0).filter(k => k.startsWith('leaveRequests/')).map(k => docs0[k]).filter(r => r.status === 'Approved' && r.end >= today && r.reason && r.staffId !== 'p05')[0];
    s = await session('linda.pillay@example.com', seedDocs()); await s.go('rosters/away');
    check(!!lr && (await s.text()).includes(lr.reason), 'Administrators see the reason for leave on Away dates');
    await finish(s);
    s = await session('sipho.dlamini@example.com', seedDocs()); await s.go('rosters/away');
    const ts = await s.text();
    check(ts.includes('On leave') && !ts.includes(lr.reason), 'a Roster coordinator sees only “On leave” – never the reason');
    await finish(s);
  }

  console.log('Languages:');
  s = await session('tim.jacobs@example.com', seedDocs());
  await s.page.selectOption('.side-lang .lang-sel', 'zu'); await s.page.waitForTimeout(80);
  check((await s.page.textContent('.side nav')).includes('Abantu') && (await s.page.getAttribute('html', 'lang')) === 'zu', 'a member can switch the screens to isiZulu');
  await s.go('rosters/mine'); check((await s.text()).includes('Ukukhonza kwami'), 'My serving in isiZulu');
  await s.page.reload(); await s.page.waitForSelector('.app');
  check((await s.page.textContent('.side nav')).includes('Abantu'), 'the language is remembered on this device');
  await s.page.selectOption('.side-lang .lang-sel', 'af'); await s.go('people/p/p14');
  check((await s.text()).includes('Kontak en besonderhede') && (await s.text()).includes('Toestemming'), 'my details in Afrikaans');
  await s.page.selectOption('.side-lang .lang-sel', 'en'); await s.page.waitForTimeout(80);
  check((await s.page.textContent('.side nav')).includes('People'), 'back to English');
  await finish(s);

  console.log('Upgrading existing data (first Administrator sign-in):');
  s = await session('linda.pillay@example.com', seedDocs({ legacy: true }));
  await s.settle(); docs = await s.docsNow();
  const gl = Object.keys(docs).filter(k => k.startsWith('guardians/')).map(k => docs[k]);
  check(docs['settings/church'].dataVersion === 4 && !Object.keys(docs).some(k => k.startsWith('people/') && /^(Member|Visitor|Partner)$/.test(docs[k].category)), 'categories renamed to Church Partner / Visiting Minister (once)');
  check(gl.length > 0 && gl.every(l => !l.confirmed) && gl.some(l => l.childId === 'p28' && l.adultId === 'p29'), 'children linked to the adults of every home they live in, to be confirmed');
  await s.go('home'); check((await s.text()).includes('Confirm the parents and guardians of'), 'Home asks someone to confirm them');
  await finish(s);

  console.log('Upgrading "Partner" to "Church Partner" (first Administrator sign-in):');
  s = await session('linda.pillay@example.com', seedDocs({ v2: true }));
  await s.settle(); docs = await s.docsNow();
  const cp = Object.keys(docs).filter(k => k.startsWith('people/') && docs[k].category === 'Church Partner').length;
  check(docs['settings/church'].dataVersion === 4 && cp > 0 && !Object.keys(docs).some(k => k.startsWith('people/') && docs[k].category === 'Partner'), 'every Partner becomes a Church Partner');
  check(!Object.keys(docs).some(k => k.startsWith('guardians/') && !docs[k].confirmed && !seedDocs()[k]), 'no guardian links are suggested again');
  check(docs['details/p17'].maritalStatus === 'Partner', 'marital status “Partner” (in a couple) is left alone');
  check(docs['people/p23'].firstName === 'Johan' && docs['details/p23'].deceasedAt === '2024-08-22', '“2024-08-22-Johan” becomes Johan, died 22 Aug 2024 (instead of the import day)');
  check(docs['people/p21'].firstName === 'Thabo' && docs['details/p21'].deceasedAt === '2023-04-30', 'a date of death already recorded on purpose is kept');
  check(docs['people/p14'].firstName === '2020-01-01-Tim', 'names of people who are alive are never changed');
  check(docs['people/p19'].lastName === 'Peters' && docs['idNumbers/p19'] && docs['idNumbers/p19'].value === '5710210087085', 'an ID number typed into a name becomes their ID number (Administrators only)');
  check(Object.keys(docs).some(k => k.startsWith('audit/') && /2 dates of death moved/.test(docs[k].action)), 'the history log says how many names were tidied');
  await s.page.evaluate(() => Store.put('people', { firstName: 'Old', lastName: 'Record', familyRole: 'adult', category: 'Deceased', active: false, deceasedAt: '2019-01-01', appRole: 'none', keyDates: [] }));
  await s.settle(); await s.go('home'); const homeT = await s.text();
  check(homeT.includes('Finish recording the death of Johan') && !homeT.includes('Finish recording the death of Old Record'), 'Home only asks to finish a death record when there’s something to undo (not for people who died long ago)');
  await finish(s);

  /* ---------- Elvanto import ---------- */
  console.log('Elvanto import (Administrator):');
  s = await session('linda.pillay@example.com', seedDocs());
  const elvPics = [];   // stand-in for Elvanto's picture server
  await s.page.route(/^https:\/\/files\.elvanto\.eu\//, r => { elvPics.push(r.request().url()); r.fulfill({ status: 200, contentType: 'image/png', body: PNG.buffer, headers: { 'access-control-allow-origin': '*' } }); });
  const elv = path.join(__dirname, 'fixtures', 'elvanto-people.csv');
  const importElvanto = async () => {
    await s.go('import'); if (await s.page.$('[data-act="import:again"]')) await s.page.click('[data-act="import:again"]');
    await s.page.setInputFiles('#im-file', elv); await s.page.waitForSelector('.im-cat', { timeout: 5000 }).catch(() => {});
    await s.page.click('[data-act="import:go"]'); await s.page.click('[data-act="import:go"]'); await s.settle();
  };
  
  await s.go('import'); await s.page.setInputFiles('#im-file', elv); await s.page.waitForSelector('.im-cat', { timeout: 5000 }).catch(() => {});
  const prevE = await s.text();
  check(/New people\s*9/.test(prevE) && /Already here \(updated\)\s*2/.test(prevE) && /Households\s*2/.test(prevE) && prevE.includes('shared by more than one person'), 'preview: 9 new; Jason (same email and name) and Priya (same name) already here, updated; 2 families; shared emails explained');
  check(await s.page.$eval('.im-cat[data-c="CCH NON Member_Partner"]', e => e.value) === 'Attender', 'Elvanto categories matched (non-members → Attender), changeable');
  await s.page.click('[data-act="import:go"]'); await s.page.click('[data-act="import:go"]'); await s.settle();
  docs = await s.docsNow();
  const elvP = () => Object.keys(docs).filter(k => k.startsWith('people/') && /^aaaa-/.test((docs['details/' + k.split('/')[1]] || {}).elvantoId || '')).map(k => Object.assign({ id: k.split('/')[1] }, docs[k], docs['details/' + k.split('/')[1]] || {}));
  let ep = elvP(); const pe = n => ep.find(x => x.firstName === n); 
  check(ep.length === 11 && pe('Karen') && pe('Mia') && pe('Leo'), 'all 11 people imported – none merged by a shared email');
  check(pe('Brian').familyRole === 'adult' && pe('Mia').familyRole === 'child' && pe('Brian').familyId && pe('Brian').familyId === pe('Leo').familyId, 'parents are adults, children are children, family linked');
  check(pe('Brian').elvantoId === 'aaaa-0001' && pe('Sipho').birthDay === '06-04' && pe('Sipho').category === 'Attender' && pe('Peter').category === 'Deceased', 'Elvanto ID, day-month birthday, category and deceased kept');
  const brianId = pe('Brian').id, others = Object.keys(docs).filter(k => !/^(idNumbers|officeNotes|audit)\//.test(k)).map(k => docs[k]);
  check((docs['idNumbers/' + brianId] || {}).value === '7503125000000' && !JSON.stringify(others).includes('7503125000000'), 'ID numbers come across from Elvanto, kept apart (Administrators only)');
  check(((docs['officeNotes/' + brianId] || {}).entries || []).some(n => n.text === 'Made-up note' && n.by === 'Elvanto') && !JSON.stringify(others).includes('Made-up note'), 'Elvanto notes become church office notes');
  await s.page.waitForSelector('#im-pics.ok', { timeout: 10000 }).catch(() => {}); await s.settle(); docs = await s.docsNow();
  check(docs['people/' + pe('Brian').id].photo && /^data:image\/jpeg/.test((docs['photos/' + pe('Brian').id] || {}).data || '') && (await s.text()).includes('1 brought in from Elvanto'), 'the photo is brought in from Elvanto');
  check(elvPics.length === 1 && !elvPics[0].includes('_thumb_'), 'the full-size picture is used, not the small copy');
  check(Object.keys(docs).some(k => k.startsWith('audit/') && /Imported 1 photos from Elvanto/.test(docs[k].action)), 'photo import is in the history log');
  await importElvanto(); docs = await s.docsNow(); ep = elvP();
  check(ep.length === 11, 'importing the same file again updates – no doubles');
  await s.go('import'); if (await s.page.$('[data-act="import:again"]')) await s.page.click('[data-act="import:again"]'); await s.page.click('[data-act="import:unimport"]'); await s.page.click('[data-act="import:unimport"]'); await s.settle();
  docs = await s.docsNow(); ep = elvP();
  check(ep.length === 2 && pe('Jason') && pe('Priya') && !pe('Brian'), '“Remove everyone brought in from Elvanto” removes those it added (Jason and Priya were already here, so they stay)');
  await importElvanto(); docs = await s.docsNow();
  check(elvP().length === 11, 'and the file imports cleanly again');
  await finish(s);

  /* ---------- Leave Manager import ---------- */
  console.log('Leave Manager import (Administrator):');
  s = await session('linda.pillay@example.com', seedDocs());
  await s.go('import/leave');
  const fixDir = path.join(__dirname, 'fixtures', 'leave-manager');
  await s.page.setInputFiles('#lm-file', fs.readdirSync(fixDir).map(f => path.join(fixDir, f)));
  await s.page.waitForSelector('.lm-who', { timeout: 5000 }).catch(() => {});
  const choice = async id => s.page.$eval(`.lm-who[data-id="${id}"]`, el => el.value).catch(() => null);
  check(await choice('S1') === 'p02' && await choice('S3') === 'p06' && await choice('S4') === '__new', 'staff matched (Thandi by email, Lerato by name); Nomsa offered as a new person');
  const prev = await s.text();
  check(prev.includes('Balances after importing') && prev.includes('Leave requests'), 'shows a preview with balances before importing');
  check(!(await s.page.content()).includes('1234'), 'PINs from the Staff tab never reach the page');
  await s.page.click('[data-act="import:lgo"]'); await s.page.click('[data-act="import:lgo"]'); await s.settle();
  docs = await s.docsNow();
  const nomsa = Object.keys(docs).find(k => k.startsWith('people/') && docs[k].firstName === 'Nomsa');
  check((await s.text()).includes('Imported') && docs['leaveRequests/L260110-AAAA'] && docs['leaveRequests/L260110-AAAA'].staffId === 'p02', 'requests imported for the right Church Hub person');
  check(nomsa && docs[nomsa].appRole === 'none' && docs['details/' + nomsa.split('/')[1]].staff.category === 'Cleaning Staff' && docs['leaveRequests/L260801-EEEE'].staffId === nomsa.split('/')[1], 'Nomsa added as a staff member without app access, with her leave');
  check(docs['away/L260301-BBBB'] && !docs['away/L261020-DDDD'] && !docs['away/L260815-FFFF'], 'approved leave blocks rostering; waiting and cancelled leave don’t');
  check(docs['leave/config'].terms.length === 4 && docs['leave/config'].types.length === 7 && docs['details/p06'].staff.workDays === 'Mon, Wed, Thu', 'settings, terms and staff details taken from the sheet');
  check(Object.keys(docs).filter(k => k.startsWith('leaveAdjustments/')).length === 2, 'carried-over days (adjustments) imported');
  const before = Object.keys(docs).filter(k => k.startsWith('leaveRequests/')).length;
  await s.page.click('[data-act="import:lagain"]');
  await s.page.setInputFiles('#lm-file', fs.readdirSync(fixDir).map(f => path.join(fixDir, f)));
  await s.page.waitForSelector('.lm-who', { timeout: 5000 }).catch(() => {});
  check(await choice('S4') !== '__new', 'second time, Nomsa is matched to the person added the first time');
  await s.page.click('[data-act="import:lgo"]'); await s.page.click('[data-act="import:lgo"]'); await s.settle();
  docs = await s.docsNow();
  check(Object.keys(docs).filter(k => k.startsWith('leaveRequests/')).length === before && Object.keys(docs).filter(k => k.startsWith('people/') && docs[k].firstName === 'Nomsa').length === 1, 'importing again doesn’t double anything');
  await s.go('leave/team'); check((await s.text()).includes('Nomsa Zungu'), 'imported staff appear in Leave team balances');
  await s.go('leave/staff/p02/2026'); const tp = await s.text();
  check(tp.includes('Thandi Mokoena') && tp.includes('Allowance') && tp.includes('Family holiday') && tp.includes('from Leave Manager') && tp.includes('Carried over from 2025'), 'per-person leave page: balances, every request (with reason) and adjustments');
  await s.page.selectOption('#adj-t', 'PSL'); await s.page.fill('#adj-d', '2'); await s.page.fill('#adj-n', 'Worked Easter weekend'); await s.page.click('[data-act="leave:addadj"]'); await s.settle();
  docs = await s.docsNow();
  check(Object.keys(docs).some(k => k.startsWith('leaveAdjustments/') && docs[k].note === 'Worked Easter weekend' && docs[k].staffId === 'p02' && docs[k].days === 2), 'Administrator can add an adjustment');
  check(Object.keys(docs).some(k => k.startsWith('audit/') && docs[k].action === 'Viewed the leave of Thandi Mokoena'), 'viewing someone’s leave is in the audit log');
  await finish(s);

  for (const xl of ['leave-manager.xlsx', 'leave-manager-plain.xlsx']) {
    console.log('Leave Manager import from an Excel download (' + xl + '):');
    s = await session('linda.pillay@example.com', seedDocs());
    await s.go('import/leave');
    await s.page.setInputFiles('#lm-file', path.join(__dirname, 'fixtures', xl));
    await s.page.waitForSelector('.lm-who', { timeout: 5000 }).catch(() => {});
    const ch = async id => s.page.$eval(`.lm-who[data-id="${id}"]`, el => el.value).catch(() => null);
    check(await ch('S1') === 'p02' && await ch('S4') === '__new', 'Excel file read: every tab found, staff matched');
    await s.page.click('[data-act="import:lgo"]'); await s.page.click('[data-act="import:lgo"]'); await s.settle();
    docs = await s.docsNow();
    const reqs = Object.keys(docs).filter(k => k.startsWith('leaveRequests/L26'));
    check(reqs.length === 6 && docs['leaveRequests/L260110-AAAA'].start === '2026-01-12' && docs['leaveRequests/L260110-AAAA'].end === '2026-01-16', 'all 6 requests with the right dates (Excel day numbers converted)');
    check(docs['leave/config'].terms[0].start === '2026-01-14' && docs['leave/config'].types.find(t => t.code === 'PSL').deducts === true && docs['details/p06'].staff.start === '2024-03-01', 'dates, TRUE/FALSE and start dates read correctly');
    check(Object.keys(docs).filter(k => k.startsWith('leaveAdjustments/')).length === 2, 'adjustments read');
    await finish(s);
  }

  /* ---------- Pastor ---------- */
  console.log('Pastor (Thandi):');
  s = await session('thandi.mokoena@example.com', seedDocs());
  await tour(s, 'pastor');
  await s.go('people/p/p10'); await s.page.fill('#pn-text', 'Visited at home.'); await s.page.click('[data-act="people:note"]'); await s.settle();
  docs = await s.docsNow(); check(docs['notes/p10'] && docs['notes/p10'].entries.length === 2, 'adding a pastoral note saves it');
  await s.go('people/p/p10'); t = await s.text();
  check(t.includes('Church office notes') && !t.includes('ID number'), 'Pastors see church office notes but not ID numbers');
  await s.page.click('[data-act="people:edit"]'); check(!(await s.page.$('#pf-late')), 'only Administrators change who someone was married to'); await s.page.click('[data-act="hub:close"]');
  await s.go('people'); check(!(await s.page.$('a[href="#/people/late"]')), 'Late spouses is for Administrators');
  await s.go('people/search'); await s.page.click('[data-act="people:advrun"]'); check(!(await s.page.$('.adv-sel')), 'only Administrators change many people at once');
  await s.go('people/p/p27'); await s.page.click('[data-act="people:consent"]');
  for (const pur of ['Church records', 'Church directory']) await s.page.check(`.cf-p[data-p="${pur}"]`);
  await s.page.click('[data-act="people:saveconsent"]'); await s.settle();
  docs = await s.docsNow(); check(!!docs['directory/p27'] && docs['directory/p27'].mobile && !docs['directory/p27'].email, 'directory consent adds name and phone (not email) to the directory');
  // A Pastor records a death: Thabo (married to Ayanda)
  await s.go('people/p/p21'); await s.page.click('[data-act="people:death"]'); await s.page.fill('#dd-note', 'Family would like a visit.'); await s.page.click('[data-act="people:savedeath"]'); await s.settle();
  docs = await s.docsNow();
  check(docs['people/p21'].category === 'Deceased' && docs['details/p22'].maritalStatus === 'Widowed' && !docs['directory/p21'] && docs['notes/p21'], 'a Pastor can record a death (with a pastoral note); the directory follows');
  check(!docs['details/p21'].deathTidied, 'rosters and sign-in are left for the Administrator to finish');
  await s.go('home'); check((await s.text()).includes('Care for the family of Thabo Nkosi'), 'Pastors get “care for the family” on their to-do list');
  await finish(s);

  /* ---------- Children's ministry ---------- */
  console.log('Children’s ministry (Grace):');
  s = await session('grace.ndlovu@example.com', seedDocs());
  await tour(s, 'kids');
  await s.go('people'); check((await s.text()).includes('Aisha'), 'sees the children');
  await s.go('people/p/p12'); await s.page.click('[data-act="people:medical"]'); await s.page.fill('#md-a', 'Nuts and bee stings'); await s.page.click('[data-act="people:savemedical"]'); await s.settle();
  docs = await s.docsNow(); check(docs['medical/p12'] && docs['medical/p12'].allergies === 'Nuts and bee stings', 'editing medical notes saves them');
  await s.go('people/p/p12'); await s.page.setInputFiles('#pp-photo', PNG); await s.page.waitForSelector('#crop-ok'); await s.page.click('#crop-ok'); await s.page.waitForSelector('[data-act="people:nophoto"]'); await s.settle(); docs = await s.docsNow();
  check(docs['photos/p12'] && docs['people/p12'].photo, 'Children’s ministry can add a child’s photo');
  await s.go('people/p/p15'); check(!(await s.page.$('[data-act="people:photo"]')), 'but not an adult’s');
  await s.go('people/p/p16'); await s.page.click('[data-act="people:medical"]'); await s.page.fill('#md-a', 'Penicillin'); await s.page.click('[data-act="people:savemedical"]');
  check(await s.page.isVisible('#md-err'), 'can’t add medical notes without a guardian’s consent'); await s.page.click('[data-act="hub:close"]');
  check(await s.page.evaluate(() => Store.get('people', 'p02').birthDate === undefined && Store.get('people', 'p12').birthDate !== ''), 'sees children’s birthdays but not adults’ details');
  await finish(s);

  /* ---------- Roster coordinator ---------- */
  console.log('Roster coordinator (Sipho):');
  const offersSeed = seedDocs();
  offersSeed['serveOffers/soTim1'] = { personId: 'p14', positionId: 'door', kind: 'join', frequency: 'monthly', note: '', status: 'waiting', createdAt: '2026-10-21 10:00' };
  offersSeed['serveOffers/soTim2'] = { personId: 'p14', positionId: 'sound', kind: 'change', frequency: 'weekly', note: '', status: 'waiting', createdAt: '2026-10-22 10:00' };
  s = await session('sipho.dlamini@example.com', offersSeed);
  await tour(s, 'rosters');
  check(await s.page.evaluate(() => !Store.find('consents', () => true).some(c => c.personId !== 'p05')), 'can’t see other people’s consent records');
  await s.page.evaluate(() => Store.put('assignments', { serviceId: Store.list('services')[5].id, positionId: 'door', personId: 'p20', status: 'pending', source: 'manual' }, 'Added to roster'));
  await s.settle(); docs = await s.docsNow();
  check(Object.keys(docs).some(k => k.startsWith('assignments/') && docs[k].personId === 'p20' && docs[k].status === 'pending' && docs[k].source === 'manual'), 'adding someone to the roster saves it');
  await s.go('home'); check((await s.text()).includes('offered to serve'), 'Home: a to-do to answer offers to serve');
  await s.go('rosters/teams'); t = await s.text();
  check(t.includes('Offers to serve') && t.includes('Clare Jacobs') && t.includes('Tea & coffee') && t.includes('Happy to help after the service'), 'Teams lists offers to serve, with their note');
  await s.page.click('[data-act="rosters:offeryes"][data-id="so1"]'); await s.settle(); docs = await s.docsNow();
  check(!docs['serveOffers/so1'] && Object.keys(docs).some(k => k.startsWith('skills/') && docs[k].personId === 'p15' && docs[k].positionId === 'tea' && docs[k].frequency === 'monthly'), 'Yes puts them on the team, as often as they asked, and clears the offer');
  await s.page.click('[data-act="rosters:offeryes"][data-id="soTim2"]'); await s.settle(); docs = await s.docsNow();
  check(docs['skills/kp14sound'].frequency === 'weekly', 'Yes to “serve more often” changes how often');
  await s.page.click('[data-act="rosters:offerno"][data-id="soTim1"]'); await s.page.fill('#of-reply', 'The door team is full until January'); await s.page.click('[data-act="rosters:offernosend"]'); await s.settle(); docs = await s.docsNow();
  check(docs['serveOffers/soTim1'].status === 'declined' && docs['serveOffers/soTim1'].reply === 'The door team is full until January' && !Object.keys(docs).some(k => k.startsWith('skills/') && docs[k].personId === 'p14' && docs[k].positionId === 'door'), 'Not now sends a short reply and leaves the team as it was');
  await finish(s);

  /* ---------- Member ---------- */
  console.log('Member (Tim):');
  s = await session('tim.jacobs@example.com', seedDocs());
  await tour(s, 'member');
  await s.go('people'); const dirText = await s.text();
  check(dirText.includes('Jacobs, Clare') && !dirText.includes('Smith, Megan') && !dirText.includes('Daniels, Ruth') && !dirText.includes('Aisha'), 'directory shows only adults who agreed to be listed');
  await s.go('people/p/p14'); await s.page.click('[data-act="people:edit"]'); await fillHome(s); await s.page.fill('#pf-mobile', '082 999 0000'); await s.page.click('[data-act="people:save"]'); await s.settle();
  docs = await s.docsNow(); check(docs['people/p14'].mobile === '082 999 0000' && docs['directory/p14'].mobile === '082 999 0000', 'can correct own phone number (directory follows)');
  await s.go('people/p/p14'); check(!!(await s.page.$('[data-act="people:showid"]')) && !(await s.page.$('[data-act="people:editid"]')), 'a member can see their own ID number but not change it');
  await s.go('people/p/p15'); check(!(await s.page.$('[data-act="people:showid"]')) && !(await s.text()).includes('Church office notes'), 'and never someone else’s, nor church office notes');
  await s.go('people/p/p14'); await s.page.setInputFiles('#pp-photo', PNG); await s.page.waitForSelector('#crop-ok'); await s.page.click('#crop-ok'); await s.page.waitForSelector('[data-act="people:nophoto"]'); await s.settle();
  docs = await s.docsNow();
  check(/^data:image\/jpeg;base64,/.test((docs['photos/p14'] || {}).data || '') && docs['people/p14'].photo && docs['directory/p14'].photo === docs['people/p14'].photo, 'a member can add their own photo (made small, and the directory knows there is one)');
  check(await s.page.$('.page-head .av.pic') !== null, 'their photo shows on their page');
  await s.page.setInputFiles('#pp-photo', PNG2); await s.page.waitForSelector('#crop-c');
  const px = () => s.page.evaluate(() => Array.from(document.getElementById('crop-c').getContext('2d').getImageData(250, 300, 1, 1).data.slice(0, 3)));
  await s.page.click('#crop-in'); await s.page.click('#crop-in'); const z1 = +(await s.page.inputValue('#crop-z')), p1 = await px();
  const box = await s.page.locator('#crop-c').boundingBox();
  await s.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await s.page.mouse.down(); await s.page.mouse.move(box.x + box.width / 2 - box.width / 4, box.y + box.height / 2, { steps: 5 }); await s.page.mouse.up();
  const p2 = await px();
  check(z1 > 1.5 && p1[2] < 100 && p2[2] > 150, 'adding a photo first asks to choose the face: zoom in, and drag to move (orange → blue under the same spot)');
  await s.page.click('[data-act="hub:close"]');
  await s.go('people/p/p15'); check(!(await s.page.$('[data-act="people:photo"]')), 'a member can’t add photos of other people');
  await s.go('people/p/p14'); await s.page.click('[data-act="people:nophoto"]'); await s.settle(); docs = await s.docsNow();
  check(!docs['photos/p14'] && !docs['people/p14'].photo, 'and can remove it');
  await s.go('rosters/away'); await s.page.click('[data-act="rosters:addaway"]');
  const ticks = await s.page.$$('.aw-d'); await ticks[1].check(); await ticks[3].check();
  await s.page.click('[data-act="rosters:awayrange"]'); await s.page.fill('.aw-range .aw-f', '2027-07-01'); await s.page.dispatchEvent('.aw-range .aw-f', 'change'); await s.page.fill('.aw-range .aw-t', '2027-07-14');
  await s.page.click('[data-act="rosters:saveaway"]'); await s.settle();
  docs = await s.docsNow(); const myAway = Object.keys(docs).filter(k => k.startsWith('blockouts/') && docs[k].personId === 'p14');
  check(myAway.length === 3 && myAway.some(k => docs[k].from === '2027-07-01' && docs[k].to === '2027-07-14'), 'can add several away dates at once (2 service days + a holiday)');
  await s.go('rosters/mine'); await s.page.click('[data-act="rosters:reply"][data-s="accepted"]'); await s.settle();
  docs = await s.docsNow(); check(docs['assignments/kTim'].status === 'accepted', 'can accept a serving turn');
  await s.go('people/p/p14'); await s.page.click('[data-act="people:consent"]'); await s.page.uncheck('.cf-p[data-p="Church directory"]'); await s.page.click('[data-act="people:saveconsent"]'); await s.settle();
  docs = await s.docsNow(); check(!docs['directory/p14'], 'withdrawing directory consent removes them from the directory');
  const consentsBefore = Object.keys(docs).filter(k => k.startsWith('consents/')).length;
  await s.page.click('[data-act="people:consent"]'); await s.page.check('.cf-p[data-p="Missionary updates (via WhatsApp)"]'); await s.page.check('.cf-p[data-p="“Who is Jesus” (via WhatsApp)"]');
  await s.page.click('[data-act="people:saveconsent"]'); await s.settle(); docs = await s.docsNow();
  const chosen = Object.values(docs).filter(d => d.personId === 'p14' && /via/.test(d.purpose || ''));
  check(chosen.length === 2 && chosen.every(c => c.given && c.method === 'Changed in the app') && (await s.text()).includes('Would like to receive'), 'a member can choose what they’d like to receive (Missionary updates on WhatsApp, “Who is Jesus”)');
  check(Object.keys(docs).filter(k => k.startsWith('consents/')).length === consentsBefore + 2, 'choices they didn’t tick aren’t recorded as a “no”');
  check(await s.page.evaluate(() => Store.list('people').every(p => !p.birthDate || p.id === 'p14')), 'can’t see anyone else’s private details');
  // Me: details, days away, serving
  await s.go('me'); t = await s.text();
  check(t.includes('Contact details') && t.includes('082 999 0000') && t.includes('Kept by the church office') && t.includes('Married'), 'Me shows their contact details and what the church office keeps');
  check(!!(await s.page.$('.tabbar a[href="#/me"]')), 'Me is in the phone tab bar');
  await s.page.click('[data-act="people:edit"]'); await s.page.fill('#pf-pref', 'Timmy'); await s.page.click('[data-act="people:save"]'); await s.settle();
  docs = await s.docsNow(); check(docs['people/p14'].preferredName === 'Timmy' && (await s.text()).includes('Timmy'), 'Me → Change my details saves (known as)');
  await s.go('me/away'); t = await s.text();
  check(t.includes('14 Jul 2027') && (await s.page.$$('[data-act="rosters:delaway"]')).length === 3, 'Days away lists their own away dates');
  await s.page.click('[data-act="rosters:delaway"]'); await s.settle(); docs = await s.docsNow();
  check(Object.keys(docs).filter(k => k.startsWith('blockouts/') && docs[k].personId === 'p14').length === 2, 'they can remove a day away');
  await s.go('me/serve'); t = await s.text();
  check(t.includes('Sound desk') && t.includes('Every 2 weeks') && t.includes('Where would you like to help?') && t.includes('Tea & coffee'), 'Serving shows where they serve and where they could help');
  await s.page.click('[data-act="me:offer"][data-p="tea"]'); await s.page.check('input[name=mo-f][value=monthly]'); await s.page.fill('#mo-note', 'After the 9:30'); await s.page.click('[data-act="me:send"]'); await s.settle();
  docs = await s.docsNow(); let offs = Object.keys(docs).filter(k => k.startsWith('serveOffers/') && docs[k].personId === 'p14');
  check(offs.length === 1 && docs[offs[0]].kind === 'join' && docs[offs[0]].positionId === 'tea' && docs[offs[0]].frequency === 'monthly' && docs[offs[0]].note === 'After the 9:30' && docs[offs[0]].status === 'waiting', 'offering to help saves an offer for the roster coordinator');
  check((await s.text()).includes('Waiting for the roster coordinator'), 'the offer shows as waiting');
  await s.page.click('[data-act="me:change"][data-p="sound"]'); await s.page.check('input[name=mo-f][value=stop]'); await s.page.click('[data-act="me:send"]'); await s.settle();
  docs = await s.docsNow(); offs = Object.keys(docs).filter(k => k.startsWith('serveOffers/') && docs[k].personId === 'p14');
  check(offs.some(k => docs[k].kind === 'stop' && docs[k].positionId === 'sound') && docs['skills/kp14sound'], 'asking to stop is a request – the team is unchanged until the coordinator says yes');
  await s.page.click('[data-act="me:withdraw"]'); await s.settle(); docs = await s.docsNow();
  check(Object.keys(docs).filter(k => k.startsWith('serveOffers/') && docs[k].personId === 'p14').length === 1, 'they can withdraw an offer');
  check(await s.page.evaluate(() => Store.list('serveOffers').every(o => o.personId === 'p14')), 'they see only their own offers');
  await finish(s);

  console.log('Member: an answer from the roster coordinator');
  const answered = seedDocs(); answered['serveOffers/soA'] = { personId: 'p14', positionId: 'door', kind: 'join', frequency: 'monthly', note: '', status: 'declined', reply: 'The door team is full until January' };
  s = await session('tim.jacobs@example.com', answered);
  await s.go('home'); check((await s.text()).includes('The roster coordinator answered 1 of your serving offers'), 'Home tells them the roster coordinator answered');
  await s.go('me/serve'); t = await s.text(); check(t.includes('Not now') && t.includes('The door team is full until January'), 'they see the reply under the position');
  await s.page.click('[data-act="me:withdraw"][data-id="soA"]'); await s.settle(); docs = await s.docsNow();
  check(!docs['serveOffers/soA'], 'OK clears the answer');
  await finish(s);

  console.log('Pastor offering to serve (staff, not a roster coordinator):');
  s = await session('thandi.mokoena@example.com', seedDocs());
  await s.go('me/serve'); await s.page.click('[data-act="me:offer"][data-p="door"]'); await s.page.click('[data-act="me:send"]'); await s.settle();
  docs = await s.docsNow(); check(Object.keys(docs).some(k => k.startsWith('serveOffers/') && docs[k].personId === 'p02' && docs[k].positionId === 'door'), 'a Pastor can offer to serve too');
  await finish(s);

  /* ---------- Elvanto: approved leave → Unavailable Volunteers ---------- */
  console.log('Elvanto updates (Administrator):');
  s = await session('linda.pillay@example.com', seedDocs());
  await s.go('leave/elvanto');
  check((await s.text()).includes('Unavailable Volunteers'), 'Leave → Elvanto explains what happens');
  await s.page.click('[data-act="leave:approvals"]').catch(() => {});
  await s.go('leave/approvals'); await s.page.click('[data-act="leave:decide"][data-d="Approved"]'); await s.settle();
  docs = await s.docsNow();
  check(!Object.keys(docs).some(k => k.startsWith('elvantoSync/')), 'while switched off, nothing is sent to Elvanto (Leave Manager still does it)');
  await s.go('leave/elvanto');
  await s.page.check('#el-on'); await s.page.fill('#el-url', 'https://example.elvanto.eu/'); await s.page.fill('#el-remail', 'Robot@Example.com'); await s.page.fill('#el-ruid', 'R1');
  await s.page.click('[data-act="leave:elsave"]'); await s.settle();
  docs = await s.docsNow();
  check(docs['settings/church'].elvanto.on === true && docs['settings/church'].elvanto.url === 'https://example.elvanto.eu' && docs['roles/robot@example.com'].role === 'robot' && docs['roles/robot@example.com'].uid === 'R1', 'switching on saves the address and gives the robot its limited sign-in');
  await s.go('leave/approvals'); await s.page.click('[data-act="leave:decide"][data-d="Approved"]'); await s.settle();
  docs = await s.docsNow();
  const ej = Object.keys(docs).filter(k => k.startsWith('elvantoSync/')).map(k => docs[k]);
  check(ej.length === 1 && ej[0].want === 'Unavailable' && ej[0].status === 'Waiting' && ej[0].name && !('reason' in ej[0]) && !('type' in ej[0]), 'approving leave queues it for Elvanto (name and dates only – no kind of leave or reason)');
  await s.go('leave/elvanto'); check((await s.text()).includes('Waiting for the robot'), 'the entry shows as waiting for the robot');
  await finish(s);

  console.log('Elvanto updates (staff member cancelling, and the robot):');
  s = await session('lerato.khumalo@example.com', seedDocs({ elvanto: true }));
  await s.go('leave'); await s.page.click('[data-act="leave:cancel"][data-id="L103"]'); await s.page.click('[data-act="leave:cancel"][data-id="L103"]'); await s.settle();
  docs = await s.docsNow();
  check(docs['leaveRequests/L103'].status === 'Cancelled' && docs['elvantoSync/L103'].want === 'Removed' && docs['elvantoSync/L103'].status === 'Waiting' && docs['elvantoSync/L103'].have, 'cancelling approved leave asks the robot to remove it from Elvanto');
  await finish(s);
  // The robot's access, through the same rules – in a page where the app itself isn't signed in
  s = await session('', seedDocs({ elvanto: true }));
  const robotTry = await s.page.evaluate(async () => {
    window.__fake.setUser({ email: 'robot@example.com', uid: 'R1', emailVerified: false });
    const fs = firebase.firestore(), res = {};
    res.readList = await new Promise(r => { const u = fs.collection('elvantoSync').onSnapshot(sn => { u(); r(sn.docs.length); }, () => r(-1)); });
    res.readSettings = await fs.doc('settings/church').get().then(d => !!d.data().elvanto, () => false);
    res.readPeople = await fs.doc('people/p06').get().then(() => true, () => false);
    const cur = (await fs.doc('elvantoSync/L103').get()).data();
    res.update = await fs.doc('elvantoSync/L103').set(Object.assign({}, cur, { status: 'Done', note: 'Added.' })).then(() => true, () => false);
    res.changeDates = await fs.doc('elvantoSync/L103').set(Object.assign({}, cur, { start: '2020-01-01' })).then(() => true, () => false);
    window.__fake.setUser({ email: 'robot@example.com', uid: 'IMPOSTOR', emailVerified: false });
    res.impostor = await fs.doc('settings/church').get().then(() => true, () => false);
    window.__fake.denied.length = 0;   // the refusals above were expected
    return res;
  });
  check(robotTry.readList === 1 && robotTry.readSettings && robotTry.update, 'the robot can read the Elvanto list and church settings, and report what it did');
  check(!robotTry.readPeople && !robotTry.changeDates && !robotTry.impostor, 'but can’t read people, change dates, or be used by another account with its email');
  await finish(s);

  console.log('Staff member (Lerato):');
  s = await session('lerato.khumalo@example.com', seedDocs());
  await s.go('leave'); await s.page.click('[data-act="leave:request"]'); await s.page.selectOption('#lf-type', 'SSL');
  // A Wednesday about six weeks ahead that isn't a public holiday (the test must not depend on today's date)
  const day = await s.page.evaluate(() => { const hol = {}; (Store.leave().holidays || []).forEach(h => { hol[h.date] = 1; }); let d = LeaveCore.addDays(LeaveCore.parse(Hub.today()), 45); while (d.getDay() !== 3 || hol[LeaveCore.iso(d)]) d = LeaveCore.addDays(d, 1); return LeaveCore.iso(d); });
  await s.page.fill('#lf-start', day); await s.page.dispatchEvent('#lf-start', 'change'); await s.page.fill('#lf-note', 'Dentist');
  await s.page.click('[data-act="leave:send"]'); await s.settle();
  docs = await s.docsNow(); const mine = Object.keys(docs).filter(k => k.startsWith('leaveRequests/') && docs[k].staffId === 'p06' && docs[k].start === day);
  check(mine.length === 1 && docs[mine[0]].status === 'Pending', 'requesting leave saves it as waiting for approval');
  await s.go('leave'); await s.page.click(`[data-act="leave:cancel"][data-id="${mine[0].split('/')[1]}"]`); await s.page.click(`[data-act="leave:cancel"][data-id="${mine[0].split('/')[1]}"]`); await s.settle();
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
  await s.page.fill('#si-email', 'tim.jacobs@example.com'); await s.page.click('[data-act="hub:sendlink"]'); await s.settle();
  check((await s.page.textContent('.signin-card')).includes('Check your email'), 'email link: asks them to check their email');
  await s.page.click('[data-act="hub:restart"]');
  await s.page.evaluate(() => { window.__fake.nextUser = { email: 'Tim.Jacobs@example.com', emailVerified: true }; });
  await s.page.click('[data-act="hub:google"]'); await s.page.waitForSelector('.app', { timeout: 5000 }).catch(() => {});
  check(!!(await s.page.$('.app')), 'Google sign-in works (email in any capitals)');
  await s.page.click('.side [data-act="hub:signout"]'); await s.settle();
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

  await browser.close(); srv.close();
  console.log(fails ? '\n' + fails + ' check(s) FAILED' : '\nLive mode: all checks passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
