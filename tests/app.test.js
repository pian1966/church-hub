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
    // Wait until every save has reached the (stand-in) database – robust on slow computers
    const settle = async () => { await page.waitForTimeout(60); await page.waitForFunction(() => window.__fake.pending === 0, null, { timeout: 10000 }); await page.waitForTimeout(60); };
    const text = async () => (await page.textContent('main')) || '';
    return { page, errs, ready, docsNow, denied, go, text, settle, close: () => context.close() };
  }
  const ROUTES = ['home', 'people', 'people/families', 'people/p/p12', 'people/p/p10', 'people/p/p14', 'rosters', 'rosters/mine', 'rosters/teams', 'rosters/together', 'rosters/away',
    'leave', 'leave/approvals', 'leave/team', 'leave/staff/p02', 'leave/away', 'leave/settings', 'privacy', 'privacy/requests', 'privacy/retention', 'privacy/breaches', 'privacy/audit', 'import', 'import/leave', 'settings'];
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
  await s.go('people/p/p19'); await s.page.click('[data-act="people:edit"]'); await s.page.selectOption('#pf-role', 'rosters'); await s.page.click('[data-act="people:save"]');
  await s.settle();
  let docs = await s.docsNow();
  check(docs['roles/sam.peters@example.com'] && docs['roles/sam.peters@example.com'].role === 'rosters' && docs['roles/sam.peters@example.com'].personId === 'p19', 'giving Sam “Roster coordinator” access writes the access list');
  await s.go('people/p/p27'); await s.page.click('[data-act="people:edit"]'); await s.page.selectOption('#pf-role', 'none'); await s.page.click('[data-act="people:save"]');
  check(await s.page.isVisible('#pf-err') && (await s.page.textContent('#pf-err')).includes('marital'), 'marital status must be chosen for adults');
  await s.page.selectOption('#pf-marital', 'Not known'); await s.page.click('[data-act="people:save"]'); await s.settle();
  docs = await s.docsNow(); check(!docs['roles/ruth.daniels@example.com'], 'choosing “No access” removes their sign-in');
  check(docs['details/p27'].maritalStatus === 'Not known' && !docs['people/p27'].maritalStatus, 'marital status is kept with the private details (not the contact card)');
  // Staff details: make Sam a Support Staff member
  await s.go('people/p/p19'); await s.page.click('[data-act="people:edit"]'); await s.page.check('#pf-staff'); await s.page.click('[data-act="people:save"]');
  check((await s.page.textContent('#pf-err')).includes('staff category'), 'staff need a category and start date');
  await s.page.selectOption('#pf-scat', 'Support Staff'); await s.page.fill('#pf-sstart', '2026-07-01');
  await s.page.uncheck('#pf-sw-same'); await s.page.check('.pf-sw[value="Mon"]'); await s.page.check('.pf-sw[value="Tue"]');
  await s.page.click('[data-act="people:save"]'); await s.settle();
  docs = await s.docsNow();
  check(docs['details/p19'].staff && docs['details/p19'].staff.category === 'Support Staff' && docs['details/p19'].staff.workDays === 'Mon, Tue' && docs['people/p19'].category === 'Staff', 'Administrator can mark someone as staff (category, start date, own working days)');
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

  /* ---------- Elvanto import ---------- */
  console.log('Elvanto import (Administrator):');
  s = await session('linda.pillay@example.com', seedDocs());
  const elv = path.join(__dirname, 'fixtures', 'elvanto-people.csv');
  const importElvanto = async () => {
    await s.go('import'); if (await s.page.$('[data-act="import:again"]')) await s.page.click('[data-act="import:again"]');
    await s.page.setInputFiles('#im-file', elv); await s.page.waitForSelector('.im-cat', { timeout: 5000 }).catch(() => {});
    await s.page.click('[data-act="import:go"]'); await s.page.click('[data-act="import:go"]'); await s.settle();
  };
  
  await s.go('import'); await s.page.setInputFiles('#im-file', elv); await s.page.waitForSelector('.im-cat', { timeout: 5000 }).catch(() => {});
  const prevE = await s.text();
  check(/New people\s*9/.test(prevE) && /Already here \(updated\)\s*2/.test(prevE) && /Families\s*2/.test(prevE) && prevE.includes('shared by more than one person'), 'preview: 9 new; Jason (same email and name) and Priya (same name) already here, updated; 2 families; shared emails explained');
  check(await s.page.$eval('.im-cat[data-c="CCH NON Member_Partner"]', e => e.value) === 'Attender', 'Elvanto categories matched (non-members → Attender), changeable');
  await s.page.click('[data-act="import:go"]'); await s.page.click('[data-act="import:go"]'); await s.settle();
  docs = await s.docsNow();
  const elvP = () => Object.keys(docs).filter(k => k.startsWith('people/') && /^aaaa-/.test((docs['details/' + k.split('/')[1]] || {}).elvantoId || '')).map(k => Object.assign({ id: k.split('/')[1] }, docs[k], docs['details/' + k.split('/')[1]] || {}));
  let ep = elvP(); const pe = n => ep.find(x => x.firstName === n); 
  check(ep.length === 11 && pe('Karen') && pe('Mia') && pe('Leo'), 'all 11 people imported – none merged by a shared email');
  check(pe('Brian').familyRole === 'adult' && pe('Mia').familyRole === 'child' && pe('Brian').familyId && pe('Brian').familyId === pe('Leo').familyId, 'parents are adults, children are children, family linked');
  check(pe('Brian').elvantoId === 'aaaa-0001' && pe('Sipho').birthDay === '06-04' && pe('Sipho').category === 'Attender' && pe('Peter').category === 'Deceased', 'Elvanto ID, day-month birthday, category and deceased kept');
  check(!JSON.stringify(docs).includes('7503125000000') && !JSON.stringify(docs).includes('Made-up note'), 'ID numbers and notes never stored');
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
  await s.settle(); docs = await s.docsNow();
  check(Object.keys(docs).some(k => k.startsWith('assignments/') && docs[k].personId === 'p20' && docs[k].status === 'pending' && docs[k].source === 'manual'), 'adding someone to the roster saves it');
  await finish(s);

  /* ---------- Member ---------- */
  console.log('Member (Tim):');
  s = await session('tim.jacobs@example.com', seedDocs());
  await tour(s, 'member');
  await s.go('people'); const dirText = await s.text();
  check(dirText.includes('Clare Jacobs') && !dirText.includes('Megan Smith') && !dirText.includes('Ruth Daniels') && !dirText.includes('Aisha'), 'directory shows only adults who agreed to be listed');
  await s.go('people/p/p14'); await s.page.click('[data-act="people:edit"]'); await s.page.fill('#pf-mobile', '082 999 0000'); await s.page.click('[data-act="people:save"]'); await s.settle();
  docs = await s.docsNow(); check(docs['people/p14'].mobile === '082 999 0000' && docs['directory/p14'].mobile === '082 999 0000', 'can correct own phone number (directory follows)');
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
  check(await s.page.evaluate(() => Store.list('people').every(p => !p.birthDate || p.id === 'p14')), 'can’t see anyone else’s private details');
  await finish(s);

  /* ---------- Staff member asking for leave ---------- */
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
