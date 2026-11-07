/* Church Hub – browser test, part: the demo as every role, then an Administrator going through every page (settings, leave, people, households, rosters).
 * One part of tests/app.test.js, which starts the browser and runs every part in turn: node tests/app.test.js */
'use strict';
module.exports = async function (ctx) {
  const { check, demo, fillHome, finish, seedDocs, session, tour } = ctx;
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
  await s.page.waitForTimeout(1200); await s.settle();
  docs = await s.docsNow(); check(docs['leave/config'].terms.some(t => t.name === 'Term 1 2027' && t.end === '2027-03-27'), 'school terms can be added');
  const supportRow = await s.page.$('#ls-levels tbody tr:has-text("Support Staff")');
  await (await supportRow.$('.ls-ent[data-code="SSL"]')).fill('22'); await s.page.waitForTimeout(1200); await s.settle();
  docs = await s.docsNow(); check(docs['leave/config'].levels.find(l => l.level === 'Support Staff').ent.SSL === 22, 'allowances per category can be changed');
  const yy = new Date().getFullYear() + 2; await s.page.click(`[data-act="leave:addsa"][data-y="${yy}"]`); await s.settle();
  await s.page.fill('#ls-hd', yy + '-12-28'); await s.page.fill('#ls-hn', 'Office closed'); await s.page.click('[data-act="leave:addhol"]'); await s.settle();
  docs = await s.docsNow();
  check(docs['leave/config'].holidays.some(h => h.date === yy + '-12-25') && docs['leave/config'].holidays.some(h => h.name === 'Office closed'), 'public holidays for another year and church closures can be added');
  await s.page.uncheck('.ls-tappr[data-i="7"]'); await s.page.waitForTimeout(1200); await s.settle();
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
  // Advanced search on ID number (Administrators): a filter only – never a column or shown – fetched on Search and logged
  await s.go('people/search');
  await s.page.selectOption('.adv-field[data-i="0"]', 'idNumber'); await s.settle();
  check(!(await s.page.$('#adv-addcol option[value="idNumber"]')), 'ID number can be searched on, but never added as a column');
  await s.page.fill('input.adv-v[data-i="0"]', '800'); await s.page.click('[data-act="people:advrun"]'); await s.settle();
  check((await s.text()).includes('Type at least 4 digits of the ID number.'), 'a search on ID number needs at least 4 digits');
  await s.page.fill('input.adv-v[data-i="0"]', '8001 0150'); await s.page.click('[data-act="people:advrun"]');
  await s.page.waitForSelector('#adv-result h2'); await s.settle(); docs = await s.docsNow();
  const idRes = await s.page.textContent('#adv-result');
  check(idRes.includes('1 person found') && idRes.includes(docs['people/p15'].lastName) && !idRes.includes('8001015009087'), 'part of an ID number (spaces ignored) finds the person, without showing the number');
  check(Object.keys(docs).some(k => k.startsWith('audit/') && /^Searched by ID number/.test(docs[k].action) && docs[k].action.includes(docs['people/p15'].lastName)), 'a search on ID numbers is in the history log, with who was found');
  await s.page.click('[data-act="people:advreset"]'); await s.go('people/p/p15');
  // Church office notes
  await s.page.fill('#on-text', 'Moved to Durban in 2019.'); await s.page.click('[data-act="people:onote"]'); await s.settle(); docs = await s.docsNow();
  check(docs['officeNotes/p15'] && docs['officeNotes/p15'].entries[0].text === 'Moved to Durban in 2019.' && (await s.text()).includes('Moved to Durban in 2019.'), 'Administrators can add church office notes');
  // Gender and Church Partner dates
  await s.page.click('[data-act="people:edit"]'); await fillHome(s); await s.page.selectOption('#pf-cat', 'Church Partner');
  await s.page.selectOption('#pf-gender', 'Female'); await s.page.fill('#pf-psince', '2015-03-01'); await s.page.fill('#pf-pupd', '2024-02-11');
  await s.page.click('[data-act="people:save"]'); await s.settle(); docs = await s.docsNow(); tt = await s.text();
  check(docs['details/p15'].gender === 'Female' && docs['details/p15'].partnerSince === '2015-03-01' && docs['details/p15'].partnerUpdated === '2024-02-11' && tt.includes('Accepted') && tt.includes('Partnership last updated'), 'gender and the Church Partner dates are saved and shown');
  await s.page.click('[data-act="people:edit"]'); await s.page.fill('#pf-middle', 'Anne'); await s.page.fill('#pf-street', '12 Main Road'); await s.page.fill('#pf-city', 'Howick'); await s.page.fill('#pf-postcode', '3290'); check(JSON.stringify(await s.page.$$eval('#pf-province option', o => o.slice(1).map(x => x.value))) === JSON.stringify(['Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape']), 'Province is a dropdown of South Africa’s nine provinces'); await s.page.selectOption('#pf-province', 'KwaZulu-Natal');
  await s.page.click('[data-act="people:save"]'); await s.settle(); docs = await s.docsNow(); tt = await s.text();
  check(docs['details/p15'].middleName === 'Anne' && docs['details/p15'].address.city === 'Howick' && tt.includes('12 Main Road') && tt.includes('Howick 3290') && !tt.includes('South Africa') && !JSON.stringify(docs['people/p15']).includes('Main Road'), 'middle name and home address saved with the private details and shown');
  await s.page.click('[data-act="people:edit"]');
  check(await s.page.inputValue('#pf-country') === 'South Africa' && (await s.page.textContent('#pf-region-l')) === 'Province', 'the address is in South Africa, with its provinces');
  await s.page.selectOption('#pf-country', 'United States');
  check((await s.page.textContent('#pf-region-l')) === 'State' && (await s.page.textContent('#pf-postcode-l')) === 'ZIP code' && (await s.page.$$eval('#pf-province option', o => o.length)) === 52, 'choosing another country gives its states and wording (State, ZIP code)');
  await s.page.selectOption('#pf-province', 'Texas'); await s.page.selectOption('#pf-country', 'United Kingdom');
  check(await s.page.$eval('#pf-province', e => e.tagName) === 'INPUT' && (await s.page.textContent('#pf-region-l')) === 'County', 'a country without a list gets a box to type the county in');
  await s.page.fill('#pf-province', 'Kent'); await s.page.click('[data-act="people:save"]'); await s.settle(); docs = await s.docsNow(); tt = await s.text();
  check(docs['details/p15'].address.country === 'United Kingdom' && docs['details/p15'].address.province === 'Kent' && tt.includes('United Kingdom') && tt.includes('Kent'), 'an address in another country is saved and shown with its country');
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
  check(docs['teams/dept-operational'] && docs['teams/dept-music'] && docs['teams/dept-creche'] && posDocs.length === 26 && docs['teams/dept-memorial'] && JSON.stringify(docs['positions/pos-creche'].times) === '["08:00"]' && docs['positions/pos-host'].times.length === 0,
    'Rosters → Teams adds the church’s 8 departments and 26 positions (Creche Duty only at 8:00): ' + posDocs.length);
  check(docs['positions/pos-tea'].teamId === 'hosp' && !docs['teams/dept-hospitality'], 'an existing team with the same name (Hospitality) is used, not doubled');
  check(!(await s.page.$('[data-act="rosters:setupdepts"]')) && (await s.text()).includes('8am only'), 'once added, the offer goes, and 8am-only positions say so');
  check(docs['teams/dept-operational'].name === 'Service Leading', 'the department for preaching, hosting, reading and prayer is called Service Leading');
  // Rosters → Services: each service's look, mood, departments and positions
  await s.go('rosters/services'); tt = await s.text();
  check((await s.page.$$('.svc-card')).length === 10 && tt.includes('Sunday services') && tt.includes('Special services') && tt.includes('Good Friday') && tt.includes('Tenebrae') && tt.includes('Memorial') && tt.includes('Sunday school') && tt.includes('Seniors') && tt.includes('Young adults'), 'Rosters → Services: Sunday services (8am, 10am, 5pm) and special services (Memorial, Christmas, Maundy Thursday, Tenebrae, Good Friday, Easter Sunday, Ascension), each with its mood');
  await s.go('rosters/services/08%3A00'); tt = await s.text();
  check(tt.includes('Sunrise') && tt.includes('Service Leading') && (await s.page.$eval('.theme-pick.on', b => b.textContent)).includes('Sunrise'), '8am looks like sunrise to start with');
  await s.page.click('[data-act="rosters:svctheme"][data-t="midday"]'); await s.settle();
  await s.page.click('[data-act="rosters:svcmood"][data-m="Quiet"]'); await s.settle();
  await s.page.fill('#sv-mood', 'Bilingual'); await s.page.click('[data-act="rosters:svcmoodadd"]'); await s.settle(); docs = await s.docsNow();
  const eight = docs['settings/church'].serviceSlots.find(x => x.id === '08:00');
  check(eight.theme === 'midday' && eight.moods.includes('Quiet') && eight.moods.includes('Bilingual') && eight.moods.includes('Sunday school'), 'tapping a look and mood words saves them (and the church can add its own word)');
  await s.go('rosters/services/10%3A00');
  await s.page.click('[data-act="rosters:svcpos"][data-p="pos-creche"]'); await s.settle();
  await s.page.click('[data-act="rosters:svcpos"][data-p="pos-host"]'); await s.settle(); docs = await s.docsNow();
  check(JSON.stringify(docs['positions/pos-creche'].times) === '["08:00","10:00"]' && JSON.stringify(docs['positions/pos-host'].times) === '["08:00","17:00"]', 'tapping a position switches it on or off at that service');
  await s.page.click('[data-act="rosters:svcpos"][data-p="pos-host"]'); await s.settle(); docs = await s.docsNow();
  check(docs['positions/pos-host'].times.length === 0, 'and back on: every service again');
  await s.go('rosters/services/memorial'); tt = await s.text();
  check(tt.includes('Held now and then') && (await s.page.$('[data-act="rosters:svcpos"][data-p="pos-memorial-teas"][aria-pressed="true"]')) && (await s.page.$('[data-act="rosters:svcpos"][data-p="pos-host"][aria-pressed="false"]')), 'Memorial has only memorial teas');
  await s.go('rosters/services/good-friday'); tt = await s.text();
  check(tt.includes('Next:') && !(await s.page.$('[data-act="rosters:svcpos"][aria-pressed="true"]')), 'Good Friday starts with no positions, and says when it is next');
  await s.page.click('[data-act="rosters:svcdept"][data-t="dept-operational"]'); await s.settle(); docs = await s.docsNow();
  check(docs['positions/pos-host'].times.includes('good-friday') && docs['positions/pos-host'].times.includes('08:00') && docs['positions/pos-preaching'].times.includes('good-friday'), 'the Administrator switches on Service Leading for Good Friday (Sunday services stay as they were)');
  await s.go('rosters/services/tenebrae'); await s.page.click('[data-act="rosters:svcremove"]'); await s.page.click('[data-act="rosters:svcremove"]'); await s.settle();
  await s.page.fill('#sv-special', 'Palm Sunday'); await s.page.click('[data-act="rosters:svcadd"]'); await s.settle(); docs = await s.docsNow();
  const sl2 = docs['settings/church'].serviceSlots;
  check(sl2.find(x => x.id === 'tenebrae').removed && sl2.find(x => x.label === 'Palm Sunday' && x.special) && (await s.text()).includes('Palm Sunday'), 'a special service can be removed (Tenebrae) or added (Palm Sunday)');
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
};
