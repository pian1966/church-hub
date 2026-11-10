/* Church Hub – browser test, part: wedding anniversaries, leave from a staff page, couples, adding a person, checking before leaving, duplicates.
 * One part of tests/app.test.js, which starts the browser and runs every part in turn: node tests/app.test.js */
'use strict';
module.exports = async function (ctx) {
  const { check, fillHome, finish, seedDocs, session } = ctx;
  let docs, s, t;
  console.log('Wedding anniversary on the profile:');
  s = await session('linda.pillay@example.com', seedDocs()); await s.go('people/p/p15');
  await s.page.click('[data-act="people:edit"]'); await fillHome(s); await s.page.selectOption('#pf-marital', 'Married'); await s.page.fill('#pf-wed', ''); await s.page.click('[data-act="people:save"]'); await s.settle();
  check(/Wedding anniversary\s*Not recorded/.test(await s.text()), 'a married person without a date shows “Wedding anniversary: Not recorded”');
  await s.page.click('button.link[data-focus="pf-wed"]');
  check(await s.page.evaluate(() => document.activeElement && document.activeElement.id === 'pf-wed'), '“Add” opens Edit details at the anniversary box');
  await s.page.fill('#pf-wed', '2000-06-10'); await s.page.click('[data-act="people:save"]'); await s.settle();
  check(/Wedding anniversary\s*\S+ 10 Jun 2000\s*Married \d+ years/.test(await s.text()), 'then it shows the date and years married');
  // Boxes that don't apply are greyed out, with the reason; what was saved stays
  await s.page.click('[data-act="people:edit"]'); await s.page.selectOption('#pf-marital', 'Single');
  check(await s.page.$eval('#pf-wed', e => e.disabled) && /Not needed – marital status is Single/.test(await s.page.textContent('#pf-wed-f')) && await s.page.$eval('#pf-wed-f', e => e.classList.contains('is-off')),
    'Edit details: Single → the wedding anniversary is greyed out, saying why');
  await s.page.selectOption('#pf-marital', 'Widowed');
  check(!(await s.page.$eval('#pf-wed', e => e.disabled)) && await s.page.inputValue('#pf-wed') === '2000-06-10', '… Widowed → it is back, with the date kept');
  await s.page.click('[data-act="hub:close"]');
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

  console.log('Duplicate check while typing (Administrator):');
  s = await session('linda.pillay@example.com', seedDocs()); docs = await s.docsNow();
  await s.go('people'); await s.page.click('[data-act="people:add"]');
  await s.page.fill('#pf-email', docs['people/p14'].email.toUpperCase()); await s.page.waitForTimeout(600);
  check(await s.page.isVisible('#pf-email-dup') && (await s.page.textContent('#pf-email-dup')).includes('Tim Jacobs'), 'an email already on someone’s record is flagged under the box, before any name is typed');
  await s.page.fill('#pf-mobile', docs['people/p15'].mobile); await s.page.waitForTimeout(600);
  check((await s.page.textContent('#pf-mobile-dup')).includes('Clare Jacobs'), '…and so is a mobile number');
  // Partly typed: the start of a mobile number (7 digits), an email (6 characters) or a street address (number and 3 letters)
  const clareMob = docs['people/p15'].mobile.replace(/\D/g, ''), clareLocal = clareMob.startsWith('27') ? '0' + clareMob.slice(2) : clareMob;
  await s.page.fill('#pf-mobile', clareLocal.slice(0, 3) + ' ' + clareLocal.slice(3, 9)); await s.page.waitForTimeout(600);
  check(/starting like this/.test(await s.page.textContent('#pf-mobile-dup')) && (await s.page.textContent('#pf-mobile-dup')).includes('Clare Jacobs'), 'the start of a mobile number already shows whose number starts that way');
  await s.page.fill('#pf-email', docs['people/p14'].email.slice(0, 7)); await s.page.waitForTimeout(600);
  check(/starting like this/.test(await s.page.textContent('#pf-email-dup')) && (await s.page.textContent('#pf-email-dup')).includes('Tim Jacobs'), 'the start of an email shows whose email starts that way');
  await s.page.evaluate(() => { const p = JSON.parse(JSON.stringify(Store.get('people', 'p14'))); p.address = { street: '14 Hilton Road', city: 'Howick' }; Store.put('people', p); }); await s.settle();
  const home = { lastName: 'Jacobs' }, timStreet = '14 Hilton Road', timStart = '14 Hil';
  await s.page.fill('#pf-street', timStart); await s.page.waitForTimeout(600);
  check(!!timStart && await s.page.isVisible('#pf-street-dup') && /starting like this/.test(await s.page.textContent('#pf-street-dup')) && (await s.page.textContent('#pf-street-dup')).includes(home.lastName), 'a house number and three letters of a street show who lives at an address starting that way');
  await s.page.fill('#pf-street', timStreet.replace(/\bRoad\b/, 'Rd').replace(/\bStreet\b/, 'St')); await s.page.waitForTimeout(600);
  check(/This address is already used by/.test(await s.page.textContent('#pf-street-dup')), 'the whole address (Rd for Road, St for Street) is “already used”');
  await s.page.fill('#pf-street', '');
  await s.page.fill('#pf-email', ''); await s.page.fill('#pf-mobile', ''); await s.page.fill('#pf-first', 'Ti'); await s.page.fill('#pf-last', 'Ja'); await s.page.waitForTimeout(600);
  check(await s.page.isVisible('#pf-dup') && (await s.page.textContent('#pf-dup')).includes('Tim Jacobs') && !(await s.page.isVisible('#pf-email-dup')), 'two letters of each name already show similar names');
  await s.page.click('[data-act="hub:close"]');
  await s.go('people/p/p14'); await s.page.click('[data-act="people:edit"]'); await s.page.waitForTimeout(600);
  check(!(await s.page.isVisible('#pf-email-dup')), 'opening someone with a shared family email doesn’t warn until it’s changed');
  await s.page.click('[data-act="hub:close"]');
  await s.go('people/duplicates');
  check(await s.page.$eval('#dup-sens', e => e.value === '3' && !e.disabled), 'Find duplicates has a sensitivity slider (1–5), set to 3');
  await s.page.$eval('#dup-sens', e => { e.value = '5'; e.dispatchEvent(new Event('change', { bubbles: true })); }); await s.settle();
  check((await s.docsNow())['settings/church'].dupSensitivity === 5 && (await s.text()).includes('Level 5 of 5'), 'moving it saves the church’s choice');
  await finish(s);
  s = await session('thandi.mokoena@example.com', seedDocs()); await s.go('people/duplicates');
  check(await s.page.$eval('#dup-sens', e => e.disabled), 'Pastors see the setting but can’t change it');
  await finish(s);

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
  await s.go('people'); await s.page.click('[data-act="people:add"]'); await s.page.fill('#pf-first', 'Tim'); await s.page.fill('#pf-last', 'Jacobs'); await s.page.fill('#pf-mobile', timMobile);
  check(await s.page.waitForSelector('#pf-dup-ok', { timeout: 4000 }).then(() => true, () => false), 'a Pastor can also confirm “a different person” when adding someone');
  await finish(s);


  console.log('A home address from the family:');
  const addrSeed = seedDocs();
  addrSeed['details/p10'].address = { street: '4 Cormorant Close', street2: 'Amberfield', city: 'Howick', postcode: '3290', province: 'KwaZulu-Natal', country: 'South Africa' };
  delete addrSeed['details/p11'].address; delete addrSeed['details/p12'].address;
  addrSeed['families/f1'].couples = ['p10|p11'];
  // A couple sharing one email address: only Jason signs in (as a Pastor); saving Priya must leave his sign-in alone.
  const jEmail = addrSeed['people/p10'].email.toLowerCase(), pEmail = addrSeed['people/p11'].email && addrSeed['people/p11'].email.toLowerCase();
  if (pEmail) delete addrSeed['roles/' + pEmail];
  addrSeed['people/p11'].email = addrSeed['people/p10'].email; addrSeed['people/p11'].appRole = 'none';
  addrSeed['people/p10'].appRole = 'pastor'; addrSeed['roles/' + jEmail] = { role: 'pastor', personId: 'p10' };
  addrSeed['roles/thandi.mokoena@example.com'].can = ['access'];   // a Pastor who gives sign-in access (the rules refuse her removing a Pastor's)
  s = await session('thandi.mokoena@example.com', addrSeed); await s.go('people/p/p11');
  check((await s.text()).includes('Probably the same as Jason Naidoo') && (await s.text()).includes('4 Cormorant Close, Amberfield'), 'a confirmed spouse with no address: their page suggests the spouse’s address');
  await s.page.click('[data-act="people:copyaddress"][data-id="p11"]'); await s.settle(); await s.page.waitForTimeout(300); let dd = await s.docsNow();
  check(dd['details/p11'].address && dd['details/p11'].address.street === '4 Cormorant Close' && !(await s.text()).includes('Probably the same as'), '“Use this address” copies it, and the suggestion goes');
  check(Object.values(dd).some(d => d.action && /Home address of Priya Naidoo copied from Jason Naidoo/.test(d.action)), '…written in the history log');
  check(dd['roles/' + jEmail] && dd['roles/' + jEmail].personId === 'p10' && !(await s.denied()).length, '…and when the couple share an email address, his sign-in stays (nothing refused)');
  await s.go('people/p/p12');
  check((await s.text()).includes('Probably the same as') && (await s.text()).includes('4 Cormorant Close'), 'a child with no address: their parents’ address is suggested (once, though both parents have it)');
  check((await s.page.$$('[data-act="people:copyaddress"][data-id="p12"]')).length === 1, '…one button, as both parents share one address');
  await finish(s);
  s = await session('grace.ndlovu@example.com', addrSeed); await s.go('people/p/p12');
  check(!(await s.page.$('[data-act="people:copyaddress"]')), 'Children’s ministry (who can’t change addresses) isn’t offered it');
  await finish(s);

};
