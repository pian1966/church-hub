/* Church Hub – browser test, part: applying to become a Church Partner, and name badges (js/people/apply.js).
 * One part of tests/app.test.js, which starts the browser and runs every part in turn: node tests/app.test.js */
'use strict';
module.exports = async function (ctx) {
  const { check, fillHome, finish, seedDocs, session } = ctx;
  let s, docs, t;
  console.log('Applying to become a Church Partner:');
  // Jason Naidoo (p10) is an Attender who signs in as a member; he has no ID number on record yet
  const seed = seedDocs(); delete seed['idNumbers/p10'];
  s = await session('jason.naidoo@example.com', seed); await s.go('me'); await s.page.waitForTimeout(300);
  check(await s.page.isVisible('#me-apply') && /Apply to become a Church Partner/.test(await s.page.textContent('#me-apply')), 'an Attender sees “Apply to become a Church Partner” on their own page');
  await s.page.click('#me-apply a.btn'); await s.page.waitForSelector('#app-form');
  check(/Jason Naidoo/.test(await s.page.textContent('#app-form')) && await s.page.isVisible('.decl'), 'the form shows their details from their record, and the declaration to agree to');
  await s.page.click('[data-act="people:appsend"]');
  check(/ID number/.test(await s.page.textContent('#ap-err')), 'nothing is sent until the questions are answered (ID number first)');
  await s.page.fill('#ap-id', '9001015009087'); await s.page.fill('#ap-since', '2025-11');
  await s.page.check('input[name="ap-faith"][value="yes"]'); await s.page.check('input[name="ap-other"][value="no"]'); await s.page.check('input[name="ap-class"][value="yes"]');
  await s.page.fill('#ap-story', 'Grew up in a Christian home and came to faith as a teenager.'); await s.page.fill('#ap-serve', 'Welcome team');
  await s.page.check('#ap-decl'); await s.page.click('[data-act="people:appsend"]');
  check(/directory/.test(await s.page.textContent('#ap-err')), 'Church Partners are in the directory: that box must be ticked too');
  await s.page.check('#ap-dir'); await s.page.click('[data-act="people:appsend"]'); await s.settle();
  docs = await s.docsNow();
  const key = Object.keys(docs).find(k => k.startsWith('partnerApps/')), app = docs[key];
  check(!!app && app.personId === 'p10' && app.status === 'waiting' && app.faith === 'yes' && app.since === '2025-11' && app.directory === true && /Christ/.test(app.declaration) && !('idNumber' in app),
    'sent: the answers are saved as waiting (without the ID number)');
  check(docs['idNumbers/p10'] && docs['idNumbers/p10'].value === '9001015009087', '… the ID number is kept apart, where only Administrators can read it');
  check(/waiting for a Pastor/.test(await s.page.textContent('#me-apply')), 'their page now says it is waiting for a Pastor');
  check((await s.denied()).length === 0, 'nothing refused by the security rules');
  await s.close();
  const after = JSON.parse(JSON.stringify(docs)), appId = key.split('/')[1];

  // A Pastor sees it (to-do and list); a Roster coordinator doesn't
  s = await session('pieter.vanwyk@example.com', JSON.parse(JSON.stringify(after))); await s.go('home');
  check(/1 partnership application to review/.test(await s.text()), 'Pastors: “1 partnership application to review” on Home');
  await s.go('people/applications/' + appId); t = await s.text();
  check(/Grew up in a Christian home/.test(t) && /Welcome team/.test(t) && await s.page.isVisible('[data-act="people:appaccept"]'), 'a Pastor reads the whole application and can accept it');
  await s.close();
  s = await session('sipho.dlamini@example.com', JSON.parse(JSON.stringify(after))); await s.go('people/applications');
  check(/This is for Administrators and Pastors/.test(await s.text()) && !(await s.page.evaluate(() => Store.list('partnerApps').length)), 'a Roster coordinator can’t see applications (not even loaded)');
  await s.close();

  // An Administrator accepts: a Church Partner from the date approved, with Contact details agreed
  s = await session('linda.pillay@example.com', JSON.parse(JSON.stringify(after))); await s.go('people/applications/' + appId);
  await s.page.click('[data-act="people:appaccept"]'); await s.page.fill('#aa-date', '2026-11-08'); await s.page.fill('#aa-by', 'Church Council');
  await s.page.click('[data-act="people:appaccepted"]'); await s.settle(); docs = await s.docsNow();
  const dir = Object.keys(docs).filter(k => k.startsWith('consents/')).map(k => docs[k]).find(c => c.personId === 'p10' && c.purpose === 'Church directory' && c.given && !c.withdrawnAt);
  check(docs['people/p10'].category === 'Church Partner' && docs['details/p10'].partnerSince === '2026-11-08' && docs[key].status === 'accepted' && docs[key].approvedBy === 'Church Council' && !!dir,
    'Accept: Jason is a Church Partner from 8 Nov 2026, approved by the Church Council, with his Contact details consent recorded');
  check(/Approved on/.test(await s.text()) && await s.page.isVisible('[data-act="people:appprint"]'), 'the application shows who approved it, and can be printed');
  check(Object.values(docs).some(d => d && d.action && /Opened the partnership application of Jason Naidoo/.test(d.action)), 'opening an application (faith answers) is in the audit log');
  await s.go('people/applications');
  await s.page.click('[data-act="people:appdecl"][data-k="reach"]');
  check(/REACH South Africa/.test(await s.page.inputValue('#ap-decltext')), 'Administrators can choose the REACH South Africa declaration (or write their own)');
  await finish(s);

  console.log('Name badges:');
  s = await session('linda.pillay@example.com', seedDocs()); await s.go('people');
  await s.page.click('[data-act="people:add"]'); await s.page.fill('#pf-first', 'Grace'); await s.page.fill('#pf-last', 'Newcombe');
  await s.page.fill('#pf-email', 'unknown'); await s.page.fill('#pf-mobile', 'unknown'); await s.page.selectOption('#pf-cat', 'Attender');
  await fillHome(s); await s.page.selectOption('#pf-frole', 'adult'); await s.page.selectOption('#pf-marital', 'Single');
  check(await s.page.isVisible('#pf-badge'), 'Add a person: a box to tick for a name badge');
  await s.page.check('#pf-badge'); await s.page.check('#pf-dup-ok').catch(() => {}); await s.page.click('[data-act="people:save"]'); await s.settle(); docs = await s.docsNow();
  const gk = Object.keys(docs).find(k => k.startsWith('people/') && docs[k].lastName === 'Newcombe'), gid = gk.split('/')[1];
  check(docs['details/' + gid] && docs['details/' + gid].badgeWanted, '… ticked: she waits for a name badge');
  await s.go('home'); check(/1 name badge to print/.test(await s.text()), 'Home: “1 name badge to print”');
  await s.go('people/p/p14'); await s.page.click('[data-act="people:badgeon"]'); await s.settle();
  await s.go('people/badges');
  check(await s.page.$$eval('.badge-prev .badge', b => b.map(x => x.textContent).join('|')) === 'GraceNewcombe|TimJacobs', 'People → Name badges: the badges waiting (first name, surname), one added from Tim’s page');
  // Printing: only the badge sheets, laid out like the church's Google Doc
  await s.page.evaluate(() => { window.print = () => { window.__printed = document.getElementById('print-only').innerHTML; }; });
  await s.page.click('[data-act="people:badgeprint"]'); await s.page.waitForFunction(() => window.__printed, null, { timeout: 4000 }).catch(() => {});
  check(await s.page.evaluate(() => /<b [^>]*>Grace<\/b><span [^>]*>Newcombe<\/span>/.test(window.__printed || '') && document.getElementById('print-only').classList.contains('badges')), 'Print: an A4 sheet with each badge (first name, then surname)');
  await s.page.evaluate(() => { const b = document.getElementById('print-only'); b.className = 'badges'; b.innerHTML = window.__printed; document.documentElement.classList.add('printing'); });
  await s.page.emulateMedia({ media: 'print' });
  const size = await s.page.evaluate(() => { const td = document.querySelector('#print-only .lab'), r = td.getBoundingClientRect(), cs = getComputedStyle(td), b = document.querySelector('#print-only .lab b');
    return { w: r.width / 96 * 25.4, h: r.height / 96 * 25.4, border: cs.borderTopWidth, first: getComputedStyle(b).fontSize, weight: getComputedStyle(b).fontWeight }; });
  check(Math.abs(size.w - 72.8) < 1.5 && Math.abs(size.h - 41) < 1.5 && Math.abs(parseFloat(size.border) - 4) < 0.5 && size.first === '46.6667px' && +size.weight >= 700,
    'badges as in the Google Doc: about 73 × 41 mm with 3 pt lines, first name bold 35 pt (' + size.w.toFixed(1) + ' × ' + size.h.toFixed(1) + ' mm)');
  await s.page.emulateMedia({ media: 'screen' }); await s.page.evaluate(() => { document.documentElement.classList.remove('printing'); document.getElementById('print-only').innerHTML = ''; });
  await s.page.click('[data-act="people:badgedone"]'); await s.settle(); docs = await s.docsNow();
  check(docs['details/' + gid].badgePrinted && docs['details/p14'].badgePrinted && /No name badges waiting/.test(await s.text()), 'Mark as printed: off the list, with the date printed kept');
  await s.go('people/p/' + gid); check(/Name badge printed on/.test(await s.text()), 'her page says when her badge was printed (and can make another)');
  await finish(s);

  console.log('Badge layout (label paper):');
  s = await session('linda.pillay@example.com', seedDocs()); await s.go('people/badges');
  await s.page.click('a[href="#/people/badges/layout"]'); await s.page.waitForSelector('#bl-preset');
  check((await s.page.$$('#bl-prev .lab')).length === 10, 'Badge layout: the church’s sheet of 10 to start with, drawn as a preview');
  await s.page.selectOption('#bl-preset', 'l7163'); await s.page.waitForTimeout(400);
  check(await s.page.inputValue('#bl-rows') === '7' && await s.page.inputValue('#bl-lines') === 'none' && (await s.page.$$('#bl-prev .lab')).length === 14, 'choosing Avery L7163 fills in its measurements: 14 labels, no lines');
  await s.page.fill('#bl-gapY', '5'); await s.page.dispatchEvent('#bl-gapY', 'change'); await s.page.waitForTimeout(400);
  check(await s.page.inputValue('#bl-preset') === 'custom' && /Too long for A4/.test(await s.page.textContent('#bl-err')), 'a gap between rows makes it my own – and too long for A4, so it says so');
  await s.page.fill('#bl-gapY', '0'); await s.page.fill('#bl-rows', '6'); await s.page.dispatchEvent('#bl-rows', 'change'); await s.page.waitForTimeout(400);
  check(await s.page.isHidden('#bl-err') && /12 badges to a sheet/.test(await s.page.textContent('#bl-count')), '6 rows: fits, 12 to a sheet');
  await s.page.evaluate(() => { window.__printed = ''; window.print = () => { window.__printed = document.getElementById('print-only').innerHTML; }; });
  await s.page.click('[data-act="people:layouttest"]'); await s.page.waitForFunction(() => window.__printed, null, { timeout: 4000 }).catch(() => {});
  check(await s.page.evaluate(() => (window.__printed.match(/class="lab"/g) || []).length === 12 && />12<\/b>/.test(window.__printed)), 'Print a test page: every label numbered and outlined');
  await s.page.click('[data-act="people:layoutsave"]'); await s.settle(); docs = await s.docsNow();
  const bl = docs['settings/church'].badgeLayout;
  check(bl && bl.preset === 'custom' && bl.rows === 6 && bl.w === 99.1 && bl.lines === 'none', 'Save: kept for the church');
  check(/Print them on label paper/.test(await s.text()), 'the Name badges page now speaks of label paper');
  await s.go('people/search'); await s.page.waitForSelector('#adv');
  await s.page.selectOption('.adv-field[data-i="0"]', 'category'); await s.page.selectOption('.adv-v[data-i="0"]', 'Attender');
  await s.page.click('[data-act="people:advrun"]'); await s.page.waitForSelector('[data-act="people:advbadges"]');
  await s.page.evaluate(() => { window.__printed = ''; window.print = () => { window.__printed = document.getElementById('print-only').innerHTML; }; });
  await s.page.click('[data-act="people:advbadges"]'); await s.page.waitForSelector('#bp-start');
  check(/12 labels to a sheet/.test(await s.page.textContent('#modal')), 'printing on label paper: asks which label to start at');
  await s.page.fill('#bp-start', '4'); await s.page.click('[data-act="people:badgego"]'); await s.page.waitForFunction(() => window.__printed, null, { timeout: 4000 }).catch(() => {});
  check(await s.page.evaluate(() => (window.__printed.match(/class="lab"/g) || []).length === 4 && /left:106.25mm;top:53.25mm/.test(window.__printed) && !/top:15.15mm/.test(window.__printed)), 'start at label 4: the first row is skipped, the badges begin on the second');
  docs = await s.docsNow();
  check(Object.values(docs).some(d => d && d.action && /Printed name badges from Advanced search: 4/.test(d.action)), 'printing is in the audit log');
  await finish(s);
  s = await session('pieter.vanwyk@example.com', seedDocs()); await s.go('people/badges');
  check(!(await s.page.$('a[href="#/people/badges/layout"]')), 'a Pastor prints badges but doesn’t change the layout');
  await finish(s);

  console.log('Name badges and invitations from Advanced search:');
  const seed2 = seedDocs(); seed2['people/p11'].appRole = 'none';   // Priya can't sign in yet
  s = await session('linda.pillay@example.com', seed2); await s.go('people/search'); await s.page.waitForSelector('#adv');
  await s.page.selectOption('.adv-field[data-i="0"]', 'category'); await s.page.selectOption('.adv-v[data-i="0"]', 'Attender');
  await s.page.click('[data-act="people:advrun"]'); await s.page.waitForSelector('[data-act="people:advbadges"]');
  check(/Name badges for everyone found/.test(await s.page.textContent('[data-act="people:advbadges"]')) && /Invite everyone found to apply/.test(await s.page.textContent('[data-act="people:advinvite"]')), 'search results: “Name badges for everyone found” and “Invite everyone found to apply”');
  await s.page.evaluate(() => { window.__printed = ''; window.print = () => { window.__printed = document.getElementById('print-only').innerHTML; }; });
  await s.page.click('[data-act="people:advbadges"]'); await s.page.waitForFunction(() => window.__printed, null, { timeout: 4000 }).catch(() => {});
  check(await s.page.evaluate(() => (window.__printed.match(/class="lab"/g) || []).length === 4 && window.__printed.indexOf('>Aisha</b>') < window.__printed.indexOf('>Jason</b>')), 'name badges for the 4 found, on an A4 sheet, in first-name order');
  await s.page.check('.adv-sel[value="p10"]'); await s.settle();
  check(/Name badges for 1 ticked/.test(await s.page.textContent('[data-act="people:advbadges"]')), 'tick someone: the buttons are for those ticked');
  await s.page.uncheck('.adv-sel[value="p10"]'); await s.settle();
  await s.page.click('[data-act="people:advinvite"]'); await s.page.waitForSelector('#iv-body');
  t = await s.page.textContent('#modal');
  check(/2 people are left out/.test(t) && await s.page.isChecked('#iv-access') && /Give 1 person Basic access/.test(t), 'Invite: the 2 children are left out; Priya can be given Basic access to sign in');
  check(/#\/people\/apply/.test(await s.page.inputValue('#iv-body')), 'the email has the link to the form');
  await s.page.evaluate(() => { Emails.getMethod = () => 'gmail'; window.open = u => { window.__opened = u; }; });
  await s.page.click('[data-act="people:invitesend"]'); await s.settle(); docs = await s.docsNow();
  const opened = await s.page.evaluate(() => window.__opened || '');
  check(docs['people/p11'].appRole === 'member' && docs['details/p10'].partnerInvited && docs['details/p11'].partnerInvited, 'Email the invitation: Priya gets Basic access, and both are marked as invited');
  check(/bcc=jason\.naidoo%40example\.com%2Cpriya\.naidoo%40example\.com|bcc=jason\.naidoo@example\.com,priya\.naidoo@example\.com/.test(opened), 'one email, with both in Bcc');
  await s.go('people/p/p10'); check(/Invited to become a Church Partner on/.test(await s.text()) && await s.page.isVisible('[data-act="people:invite"]'), 'his page says when he was invited, and can invite him again');
  await s.go('people/applications'); await s.page.waitForSelector('#app-invite svg');
  check(await s.page.isVisible('#app-invite svg') && /#\/people\/apply/.test(await s.page.textContent('#app-invite')), 'Partnership applications: a QR code and the link for the welcome desk');
  await s.page.evaluate(() => { window.__printed = ''; window.print = () => { window.__printed = document.getElementById('print-only').innerHTML; }; });
  await s.page.click('[data-act="people:invitposter"]'); await s.page.waitForFunction(() => window.__printed, null, { timeout: 4000 }).catch(() => {});
  check(await s.page.evaluate(() => /class="sheet poster"/.test(window.__printed) && /<svg/.test(window.__printed)), 'Print a poster: an A4 poster with the QR code');
  await s.page.evaluate(() => { window.__printed = ''; });
  await s.page.click('[data-act="people:invitepaper"]'); await s.page.waitForFunction(() => window.__printed, null, { timeout: 4000 }).catch(() => {});
  check(await s.page.evaluate(() => /paper-form/.test(window.__printed) && /How did you come to faith/.test(window.__printed)), 'Print a paper form: the same questions, with lines to write on');
  await finish(s);

  console.log('Ticking people on the People list:');
  s = await session('linda.pillay@example.com', seedDocs()); await s.go('people');
  await s.page.click('[data-act="people:pickstart"]');
  await s.page.fill('#pp-q', 'Naidoo'); await s.page.waitForTimeout(600);
  await s.page.check('.pp-sel[value="p10"]');
  await s.page.fill('#pp-q', 'Jacobs'); await s.page.waitForTimeout(600);
  await s.page.check('.pp-sel[value="p14"]');
  check(/2 people selected/.test(await s.page.textContent('#pp-pickn')), 'Select people: ticks stay from one search to the next (2 selected)');
  await s.page.evaluate(() => { window.__printed = ''; window.print = () => { window.__printed = document.getElementById('print-only').innerHTML; }; });
  await s.page.click('[data-act="people:pickbadges"]'); await s.page.waitForFunction(() => window.__printed, null, { timeout: 4000 }).catch(() => {});
  check(await s.page.evaluate(() => />Jason<\/b>/.test(window.__printed) && />Tim<\/b>/.test(window.__printed) && (window.__printed.match(/class="lab"/g) || []).length === 2), 'Name badges: just the 2 ticked');
  await s.page.click('[data-act="people:pickinvite"]'); await s.page.waitForSelector('#iv-body');
  check(/1 person is left out/.test(await s.page.textContent('#modal')), 'Invite to apply: Tim (already a Church Partner) is left out');
  await s.page.click('[data-act="hub:close"]').catch(() => s.page.keyboard.press('Escape')); await s.page.waitForTimeout(200);
  await s.page.click('[data-act="people:pickchange"]'); await s.page.waitForSelector('#bk-f');
  check(/Change 2 people/.test(await s.page.textContent('#modal')), 'Change selected…: for the 2 ticked');
  await s.page.keyboard.press('Escape'); await s.page.waitForTimeout(200);
  await s.page.click('[data-act="people:pickdone"]');
  check(!(await s.page.$('.pp-sel')) && await s.page.isVisible('a.pp-row'), 'Done: back to the normal list');
  await finish(s);
  const rSeed = seedDocs(); rSeed['settings/church'].seniorPastorId = 'p03';
  s = await session('pieter.vanwyk@example.com', rSeed); await s.go('people');
  check(await s.page.isVisible('[data-act="people:pickstart"]'), 'the Senior Pastor (Rector) can select people too');
  await s.page.click('[data-act="people:pickstart"]');
  check(await s.page.isVisible('[data-act="people:pickbadges"]') && !(await s.page.$('[data-act="people:pickchange"]')), '… for badges and invitations (changing many at once stays with Administrators)');
  await finish(s);
  s = await session('thandi.mokoena@example.com', seedDocs()); await s.go('people');
  check(!(await s.page.$('[data-act="people:pickstart"]')), 'another Pastor doesn’t get Select people');
  await finish(s);
};
