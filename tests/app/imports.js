/* Church Hub – browser test, part: what the robot read in Elvanto, upgrading older data, the Elvanto import and the Leave Manager import.
 * One part of tests/app.test.js, which starts the browser and runs every part in turn: node tests/app.test.js */
'use strict';
module.exports = async function (ctx) {
  const { PNG, TESTS, check, finish, fs, path, seedDocs, session } = ctx;
  let docs, s, t;
  console.log('Unavailable dates the robot read in Elvanto (Administrator):');
  s = await session('linda.pillay@example.com', seedDocs({ found: true }));
  await s.go('import/unavailable'); t = await s.text();
  check(t.includes('Ready to add (2)') && t.includes('Choose who it is (1)') && t.includes('Megan Jacobs') && t.includes('Already in Church Hub (1)') && t.includes('couldn’t read'), 'Import shows what the robot found: ready, choose who, already in Church Hub');
  await s.page.selectOption('.un-pick', 'p14'); await s.page.uncheck('.un-on >> nth=1');
  await s.page.click('[data-act="import:unapply"]'); await s.settle(); docs = await s.docsNow();
  const bo = Object.keys(docs).filter(k => k.startsWith('blockouts/') && docs[k].source === 'elvanto').map(k => docs[k]);
  check(bo.length === 2 && bo.some(b => b.personId === 'p15' && b.from === '2030-11-03' && b.to === '2030-11-05') && bo.some(b => b.personId === 'p14' && b.from === '2030-12-01') && !bo.some(b => b.from === '2030-11-10'),
    'Add makes away dates for the ticked ones (and the chosen person), not for the one left out');
  t = await s.text(); check(t.includes('Ready to add (1)') && t.includes('Already in Church Hub (3)'), 'added ones move to “Already in Church Hub”');
  await s.go('leave/elvanto'); check(await s.page.isChecked('#el-read'), 'Leave → Elvanto has the switch for reading every night');
  await finish(s);

  console.log('Upgrading existing data (first Administrator sign-in):');
  s = await session('linda.pillay@example.com', seedDocs({ legacy: true }));
  await s.settle(); docs = await s.docsNow();
  const gl = Object.keys(docs).filter(k => k.startsWith('guardians/')).map(k => docs[k]);
  check(docs['settings/church'].dataVersion === 5 && !Object.keys(docs).some(k => k.startsWith('people/') && /^(Member|Visitor|Partner)$/.test(docs[k].category)), 'categories renamed to Church Partner / Visiting Minister (once)');
  check(gl.length > 0 && gl.every(l => !l.confirmed) && gl.some(l => l.childId === 'p28' && l.adultId === 'p29'), 'children linked to the adults of every home they live in, to be confirmed');
  await s.go('home'); check((await s.text()).includes('Confirm the parents and guardians of'), 'Home asks someone to confirm them');
  await finish(s);

  console.log('Upgrading "Partner" to "Church Partner" (first Administrator sign-in):');
  s = await session('linda.pillay@example.com', seedDocs({ v2: true }));
  await s.settle(); docs = await s.docsNow();
  const cp = Object.keys(docs).filter(k => k.startsWith('people/') && docs[k].category === 'Church Partner').length;
  check(docs['settings/church'].dataVersion === 5 && cp > 0 && !Object.keys(docs).some(k => k.startsWith('people/') && docs[k].category === 'Partner'), 'every Partner becomes a Church Partner');
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
  const elv = path.join(TESTS, 'fixtures', 'elvanto-people.csv');
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
  const fixDir = path.join(TESTS, 'fixtures', 'leave-manager');
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
    await s.page.setInputFiles('#lm-file', path.join(TESTS, 'fixtures', xl));
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
};
