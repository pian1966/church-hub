/* Church Hub – browser test, part: Leadership (Council, elders, leaders), the Archive (church records) and the Library.
 * One part of tests/app.test.js, which starts the browser and runs every part in turn: node tests/app.test.js */
'use strict';
module.exports = async function (ctx) {
  // Some actions sit in a "More ▾" or row "⋯" menu, and the search fields in a folded panel: open it first, as a person would
  const reveal = (s, sel) => s.page.evaluate(sel => { let el = null; try { el = document.querySelector(sel); } catch (e) { return; } let d = el && el.closest('details'); while (d) { d.open = true; d = d.parentElement && d.parentElement.closest('details'); } }, sel);
  const click = async (s, sel, o) => {
    for (let i = 0; i < 3; i++) {   // a background refresh can redraw the page between opening a menu and clicking in it
      await reveal(s, sel);
      try { return await s.page.click(sel, Object.assign({ timeout: i < 2 ? 2500 : 30000 }, o || {})); } catch (e) { if (i === 2) throw e; }
    }
  };
  const fill = async (s, sel, v) => { await reveal(s, sel); return s.page.fill(sel, v); };
  const select = async (s, sel, v) => { await reveal(s, sel); return s.page.selectOption(sel, v); };
  // Care Groups, Midweek Groups and Leadership sit under one Groups entry in the menu, as its tabs
  const inGroups = async (x, id) => !!(await x.page.$('nav a[href="#/groups"]')) && await x.page.evaluate(i => Hub.groupMods().some(m => m.id === i), id);
  const { check, finish, seedDocs, session, PNG } = ctx;
  let docs, s, t, key;
  const find = (d, coll, fn) => Object.keys(d).find(k => new RegExp('^' + coll + '/[^/]+$').test(k) && fn(d[k]));
  const b64 = PNG.buffer.toString('base64');
  const on = seed => { seed['settings/church'].modules = Object.assign({}, seed['settings/church'].modules, { leaders: true, archive: true, library: true }); return seed; };
  const deniedPreview = async (x, id) => {
    const code = await x.page.evaluate(async fileId => {
      try { await Store.loadArchivePreview(fileId, 1); return ''; }
      catch (e) { return e.code || ''; }
    }, id);
    return code === 'permission-denied';
  };

  console.log('Leadership (Administrator):');
  s = await session('linda.pillay@example.com', seedDocs()); await s.go('home');
  check(!(await inGroups(s, 'leaders')) && !(await s.page.$('nav a[href="#/archive"]')) && !(await s.page.$('nav a[href="#/library"]')), 'Leadership and the Library are off until an Administrator switches them on');
  await s.go('settings/apps');
  for (const m of ['leaders', 'library']) { await s.page.check('.st-mod[value="' + m + '"]'); await s.settle(); }
  docs = await s.docsNow();
  check(['leaders', 'archive', 'library'].every(m => docs['settings/church'].modules[m] === true) && !!(await inGroups(s, 'leaders')) && !(await s.page.$('nav a[href="#/archive"]')) && !!(await s.page.$('nav a[href="#/library"]')), 'switched on under Settings → Apps: Library includes Archives without a separate menu entry');
  await s.page.evaluate(() => { const modules = Object.assign({}, Store.settings().modules, { archive: true, library: false }); Store.setSettings({ modules: modules }, 'Test older Archive setting'); });
  await s.settle(); await s.go('library'); t = await s.text();
  check(!!(await s.page.$('[data-act="library:section"][data-section="library"]')) && !!(await s.page.$('[data-act="library:section"][data-section="archives"]')) && t.includes('The church’s library'), 'older Archive-only settings still show the Library and Archives tabs together');
  await s.page.evaluate(() => { const modules = Object.assign({}, Store.settings().modules, { archive: true, library: true }); Store.setSettings({ modules: modules }, 'Restore combined Library setting'); });
  await s.settle();
  await s.go('leaders'); await fill(s, '#lb-new', 'Church Council'); await click(s, '[data-act="leaders:addgroup"]'); await s.settle();
  docs = await s.docsNow(); key = find(docs, 'leaderBodies', d => d.name === 'Church Council'); const lb = key ? key.split('/')[1] : '';
  check(!!key && docs[key].open === true && docs[key].memberIds.length === 0, 'a leadership group is added, seen by everyone until that is changed');
  const add = async (who, role, title, port) => {
    await fill(s, '.cg-q[data-for="lb-' + lb + '"]', who); await s.page.waitForTimeout(400); await click(s, '.cg-hits .cg-pick'); await s.page.waitForSelector('#lb-role');
    await fill(s, '#lb-role', role); await fill(s, '#lb-title', title); await fill(s, '#lb-port', port); await click(s, '[data-act="leaders:saveseat"]'); await s.settle();
  };
  await add('tim jac', 'Chair', 'Churchwarden', 'Finance, Buildings'); await add('clare', 'Secretary', '', '');
  docs = await s.docsNow(); t = await s.text();
  check(docs[key].memberIds.join() === 'p14,p15' && docs[key].seats.p14.role === 'Chair' && docs[key].seats.p14.title === 'Churchwarden' && docs[key].seats.p14.portfolios.join() === 'Finance,Buildings' && docs[key].names.p15 === 'Clare Jacobs',
    'people are added with a role, a title and portfolios');
  check(/Tim Jacobs\s*Chair[\s\S]*Churchwarden · Finance · Buildings[\s\S]*Clare Jacobs\s*Secretary/.test(t), 'the group lists them, office-bearers first');
  await click(s, '[data-act="leaders:group"][data-id="' + lb + '"]'); await s.page.uncheck('#lb-open'); await click(s, '[data-act="leaders:savegroup"]'); await s.settle();
  await click(s, '[data-act="leaders:ending"][data-g="' + lb + '"][data-id="p15"]'); await fill(s, '#lb-end', '2026-10-31'); await click(s, '[data-act="leaders:end"][data-keep="1"]'); await s.settle();
  docs = await s.docsNow(); t = await s.text();
  check(docs[key].open === false && docs[key].memberIds.join() === 'p14' && docs[key].past.length === 1 && docs[key].past[0].name === 'Clare Jacobs' && docs[key].past[0].role === 'Secretary' && docs[key].past[0].to === '2026-10-31' && t.includes('Members only') && t.includes('Served before (1)'),
    'a group can be for its members only; someone whose time has ended moves to “Served before”');

  console.log('Staff and custom groups (Administrator):');
  await s.go('staffgroup'); t = await s.text();
  check(t.includes('Staff') && t.includes('Group settings') && (await s.page.$$eval('main .list .item', rows => rows.length)) >= 1,
    'the Staff Group tab lists staff from People for the Administrator');
  await s.go('groups');
  await click(s, '[data-act="customgroups:create"]'); await fill(s, '#cg-name', 'Church Council helpers');
  await fill(s, '.cg-q[data-for="cg-members"]', 'tim jac'); await s.page.waitForTimeout(400); await click(s, '.cg-hits[data-for="cg-members"] .cg-pick[data-id="p14"]');
  await select(s, '#cg-visibility', 'members'); await click(s, '[data-act="customgroups:save"]'); await s.settle();
  await click(s, '[data-act="customgroups:create"]'); await fill(s, '#cg-name', 'Worship Team'); await fill(s, '#cg-description', 'Music and singing');
  await select(s, '#cg-visibility', 'church'); await click(s, '[data-act="customgroups:save"]'); await s.settle();
  docs = await s.docsNow();
  const privateGroup = find(docs, 'customGroups', g => g.name === 'Church Council helpers'), churchGroup = find(docs, 'customGroups', g => g.name === 'Worship Team');
  const privateId = privateGroup ? privateGroup.split('/')[1] : '', churchId = churchGroup ? churchGroup.split('/')[1] : '';
  check(!!privateGroup && docs[privateGroup].memberIds.join() === 'p14' && docs[privateGroup].visibility === 'members' &&
    !!churchGroup && docs[churchGroup].description === 'Music and singing' && docs[churchGroup].visibility === 'church',
    'the Administrator can create groups, add members, descriptions and choose who can see them');
  await s.close();
  s = await session('tim.jacobs@example.com', docs); await s.go('groups'); t = await s.text();
  check(t.includes('Church Council helpers') && t.includes('Worship Team'), 'a group member sees their private group and everyone can see a church-visible group');
  await s.close();
  s = await session('jason.naidoo@example.com', docs); await s.go('groups'); t = await s.text();
  check(!t.includes('Church Council helpers') && t.includes('Worship Team'), 'a person outside a private group cannot see its name or membership');
  await s.close();
  s = await session('linda.pillay@example.com', docs); await s.go('groups');
  await click(s, '[data-act="customgroups:edit"][data-id="' + privateId + '"]'); await fill(s, '#cg-description', 'Council meeting support');
  await click(s, '[data-act="customgroups:save"]'); await s.settle(); docs = await s.docsNow();
  check(docs[privateGroup].description === 'Council meeting support', 'the Administrator can edit a custom group');
  await click(s, '[data-act="customgroups:delete"][data-id="' + churchId + '"]');
  await click(s, '[data-act="customgroups:delete"][data-id="' + churchId + '"]'); await s.settle(); docs = await s.docsNow();
  check(!docs[churchGroup], 'the Administrator can delete a custom group');

  console.log('Archive (Administrator):');
  await s.go('archive'); t = await s.text();
  check(t.includes('No records yet.'), 'the Archive starts empty');
  await click(s, '[data-act="archive:add"]'); await s.page.waitForSelector('#ar-title');
  check((await s.page.inputValue('#ar-cat')) === 'minutes' && (await s.page.inputValue('#ar-access')) === 'body' && (await s.page.inputValue('#ar-body')) === lb && await s.page.isHidden('#ar-about-wrap'), 'a new record starts as Council minutes, for the Council to see');
  await click(s, '[data-act="archive:save"]');
  check(!(await s.page.isHidden('#ar-err')) && !!(await s.page.$('#ar-title')), 'a record needs a title');
  await fill(s, '#ar-title', 'Council minutes – October'); await fill(s, '#ar-date', '2026-10-13'); await click(s, '[data-act="archive:save"]');
  check(!(await s.page.isHidden('#ar-err')) && !!(await s.page.$('#ar-title')), '… and a file or a link');
  await s.page.setInputFiles('#ar-file', PNG); await click(s, '[data-act="archive:save"]'); await s.settle();
  docs = await s.docsNow(); key = find(docs, 'archive', d => d.cat === 'minutes'); const ar = key ? key.split('/')[1] : '';
  check(!!key && docs[key].access === 'body' && docs[key].bodyId === lb && docs[key].shownTo === '' && docs[key].file.name === 'face.png' && docs[key].file.parts === 1 && docs[key].date === '2026-10-13', 'the minutes are saved for the Council');
  check(!!docs['archive/' + ar + '/parts/0'] && docs['archive/' + ar + '/parts/0'].data === b64, 'the file is kept apart from the record, in parts');
  await click(s, '[data-act="archive:add"]'); await s.page.waitForSelector('#ar-title');
  await select(s, '#ar-cat', 'contracts');
  check((await s.page.inputValue('#ar-access')) === 'private' && await s.page.isHidden('#ar-body-wrap') && !(await s.page.isHidden('#ar-about-wrap')), 'a staff contract starts private, and asks which staff member it is about');
  await fill(s, '#ar-title', 'Contract of employment'); await select(s, '#ar-about', 'p06'); await s.page.setInputFiles('#ar-file', PNG); await click(s, '[data-act="archive:save"]'); await s.settle();
  await click(s, '[data-act="archive:add"]'); await s.page.waitForSelector('#ar-title');
  await select(s, '#ar-cat', 'plans'); await fill(s, '#ar-title', 'Hall extension plans'); await fill(s, '#ar-link', 'drive.google.com/hall-plans'); await click(s, '[data-act="archive:save"]'); await s.settle();
  docs = await s.docsNow(); const con = find(docs, 'archive', d => d.cat === 'contracts'), plan = find(docs, 'archive', d => d.cat === 'plans');
  check(!!con && docs[con].access === 'private' && docs[con].aboutId === 'p06' && docs[con].aboutName === 'Lerato Khumalo' && docs[con].shownTo === 'p06' && docs[con].bodyId === '', 'the contract is private, and shown to the staff member it is about');
  check(!!plan && docs[plan].access === 'office' && docs[plan].link === 'https://drive.google.com/hall-plans' && !docs[plan].file, 'a record can be a link to where the file is kept');
  await click(s, '[data-act="archive:add"]'); await s.page.waitForSelector('#ar-title');
  await select(s, '#ar-cat', 'plans'); await fill(s, '#ar-title', 'Statement of Faith'); await fill(s, '#ar-date', '2026-10-14');
  await fill(s, '#ar-link', 'https://docs.google.com/document/d/AbC123/edit?usp=sharing');
  await s.page.setInputFiles('#ar-file', PNG); await s.page.check('#ar-app-doc'); await click(s, '[data-act="archive:save"]'); await s.settle();
  docs = await s.docsNow(); const statement = find(docs, 'archive', d => d.title === 'Statement of Faith'), statementId = statement ? statement.split('/')[1] : '';
  const pub = docs['applicationDocuments/' + statementId];
  check(!!statement && docs[statement].displayOnApplication === true && !!pub && pub.title === 'Statement of Faith' && pub.parts === 1 &&
    !!pub.fileVersion && docs['applicationDocuments/' + statementId + '/files/' + pub.fileVersion + '/parts/0'].data === b64,
    'an Administrator can publish a limited title, link and separately versioned file copy to the membership form');
  await click(s, '[data-act="archive:linkpreview"][data-id="' + statementId + '"]'); await s.page.waitForSelector('#modal #ar-doc-preview');
  check(await s.page.getAttribute('#ar-doc-preview', 'src') === 'https://docs.google.com/document/d/AbC123/preview?embedded=true' &&
    await s.page.$eval('#ar-doc-loading', e => e.getAttribute('role') === 'status' && e.getAttribute('aria-live') === 'polite') &&
    await s.page.isVisible('#modal .ar-preview-body .hint') && await s.page.getAttribute('#modal .dlg-foot a', 'href') === 'https://docs.google.com/document/d/AbC123/edit?usp=sharing',
    'Google Docs opens in an inline preview with an accessible loading state, sharing guidance and a link to the original');
  await click(s, '#modal [data-act="hub:close"]'); await s.page.waitForFunction(() => !document.querySelector('#modal .overlay'));
  await s.close();
  s = await session('jason.naidoo@example.com', docs); await s.go('people/apply');
  check((await s.text()).includes('Statement of Faith') && await s.page.isVisible('[data-act="people:appdoc"]') &&
    await s.page.getAttribute('#ap-read a', 'href') === 'https://docs.google.com/document/d/AbC123/edit?usp=sharing',
    'the membership form shows the published Archive document and its link to applicants');
  const [publicDownload] = await Promise.all([s.page.waitForEvent('download'), s.page.click('[data-act="people:appdoc"]')]);
  check(publicDownload.suggestedFilename() === 'face.png' && ctx.fs.readFileSync(await publicDownload.path()).equals(PNG.buffer),
    'an applicant can read the deliberately published uploaded document');
  await s.close();
  s = await session('linda.pillay@example.com', docs); await s.go('archive');
  await click(s, '[data-act="archive:edit"][data-id="' + statementId + '"]'); await s.page.uncheck('#ar-app-doc'); await click(s, '[data-act="archive:save"]'); await s.settle();
  docs = await s.docsNow();
  check(!docs['applicationDocuments/' + statementId] && docs['archive/' + statementId].displayOnApplication === false,
    'unpublishing removes the public copy while keeping the Archive record private');
  t = await s.text();
  check(t.includes('Council minutes – October') && t.includes('Church Council') && t.includes('Shown to Lerato Khumalo') && t.includes('Administrators and the Senior Pastor only'), 'each record says who can see it');
  await click(s, '[data-act="archive:storageinfo"]'); await s.page.waitForSelector('#modal .overlay');
  check((await s.page.textContent('#modal')).includes('Uploaded files are stored in the church’s Firestore database in South Africa.') && (await s.page.textContent('#modal')).includes('Linked files stay in their cloud folder:'), 'an Administrator can open the storage information note');
  await click(s, '#modal [data-act="hub:close"]'); await s.page.waitForFunction(() => !document.querySelector('#modal .overlay'));
  const [dl] = await Promise.all([s.page.waitForEvent('download'), s.page.click('[data-act="archive:open"][data-id="' + ar + '"]')]);
  const got = ctx.fs.readFileSync(await dl.path()); await s.settle(); docs = await s.docsNow();
  check(dl.suggestedFilename() === 'face.png' && got.equals(PNG.buffer), 'the file downloads as it was added');
  check(!!docs['archivePreviews/' + ar + '/parts/0'] && docs['archivePreviews/' + ar + '/parts/0'].data === b64, 'the restricted preview copy is saved separately from the normal download');
  check(await s.page.isVisible('[data-act="archive:preview"][data-id="' + ar + '"]'), 'an Administrator can preview an archive file');
  await click(s, '[data-act="archive:preview"][data-id="' + ar + '"]'); await s.page.waitForSelector('#modal .ar-preview-image');
  check(await s.page.isVisible('#modal .ar-preview-image') && (await s.page.getAttribute('#modal .ar-preview-image', 'alt')) === 'Council minutes – October', 'an image opens in the inline preview with the record title');
  await click(s, '#modal [data-act="hub:close"]'); await s.page.waitForFunction(() => !document.querySelector('#modal .overlay')); await s.settle();
  docs = await s.docsNow();
  check(Object.keys(docs).some(k => /^audit\//.test(k) && /Previewed the archive record “Council minutes – October”/.test(docs[k].action)), 'previewing a restricted archive record is written in the audit log');

  const previewFile = async (title, file, selector, text) => {
    await click(s, '[data-act="archive:add"]'); await s.page.waitForSelector('#ar-title');
    await select(s, '#ar-cat', 'plans'); await fill(s, '#ar-title', title); await s.page.setInputFiles('#ar-file', file);
    await click(s, '[data-act="archive:save"]'); await s.settle();
    const stored = await s.docsNow(), k = find(stored, 'archive', d => d.title === title), id = k.split('/')[1];
    await click(s, '[data-act="archive:preview"][data-id="' + id + '"]'); await s.page.waitForSelector('#modal ' + selector);
    const shown = await s.page.textContent('#modal');
    check(shown.includes(text), title + ' uses its inline preview format');
    await click(s, '#modal [data-act="hub:close"]'); await s.page.waitForFunction(() => !document.querySelector('#modal .overlay'));
  };
  await previewFile('Preview PDF', { name: 'plans.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF') }, '.ar-preview-frame', 'Preview PDF');
  await previewFile('Preview notes', { name: 'notes.md', mimeType: 'text/markdown', buffer: Buffer.from('# Readable notes\n\nA short paragraph.') }, '.ar-preview-text.rich', 'Readable notes');
  await previewFile('Preview table', { name: 'table.csv', mimeType: 'text/csv', buffer: Buffer.from('Month,Meeting\nOctober,Council') }, 'pre.ar-preview-text', 'October,Council');
  await previewFile('Preview spreadsheet', { name: 'table.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('not a real workbook') }, '.ar-preview-unsupported', 'Inline preview is not available for this file type');
  docs = await s.docsNow();
  check(Object.keys(docs).some(k => /^audit\//.test(k) && /Opened the archive record “Council minutes – October”/.test(docs[k].action)), 'opening a record that isn’t for everyone is written in the audit log');
  await fill(s, '#ar-q', 'hall'); await s.page.waitForTimeout(100);
  check(await s.page.isVisible('.ar-item:has-text("Hall extension plans")') && await s.page.isHidden('.ar-item:has-text("Contract of employment")'), 'searching the archive');
  await fill(s, '#ar-q', '');
  await click(s, '[data-act="archive:cats"]'); await click(s, '[data-act="archive:catadd"]');
  await fill(s, '.ar-cat:last-child .ar-cn', 'Title deeds'); await select(s, '.ar-cat:last-child .ar-ca', 'private'); await click(s, '[data-act="archive:catsave"]'); await s.settle();
  docs = await s.docsNow(); const acs = docs['settings/church'].archiveCats || [];
  check(acs.length === 6 && acs[5].name === 'Title deeds' && acs[5].access === 'private' && acs[0].name === 'Council minutes', 'the church adds its own categories');
  await click(s, '[data-act="archive:del"][data-id="' + plan.split('/')[1] + '"]'); await click(s, '[data-act="archive:del"][data-id="' + plan.split('/')[1] + '"]'); await s.settle();
  docs = await s.docsNow();
  check(!docs[plan], 'a record can be deleted');
  await s.go('leaders'); await click(s, '[data-act="leaders:delgroup"][data-id="' + lb + '"]'); await click(s, '[data-act="leaders:delgroup"][data-id="' + lb + '"]'); await s.settle();
  docs = await s.docsNow();
  check(!!docs['leaderBodies/' + lb], 'a leadership group with records in the Archive can’t be deleted');

  console.log('Library (Administrator):');
  await s.go('library'); await click(s, '[data-act="library:add"]'); await s.page.waitForSelector('#lib-title');
  await fill(s, '#lib-title', 'Knowing God'); await fill(s, '#lib-author', 'J. I. Packer'); await fill(s, '#lib-cat', 'Theology'); await select(s, '#lib-how', 'Donated'); await fill(s, '#lib-from', 'The Jacobs family');
  await click(s, '[data-act="library:save"]'); await s.settle();
  docs = await s.docsNow(); key = find(docs, 'books', d => d.title === 'Knowing God'); const bk = key ? key.split('/')[1] : '';
  check(!!key && docs[key].author === 'J. I. Packer' && docs[key].how === 'Donated' && docs[key].from === 'The Jacobs family' && docs[key].copies === 1 && docs[key].out === 0 && !!docs[key].acquired, 'a book is added, with how and when it was acquired');
  check((await s.page.$$eval('#lib-controls [data-act="library:tab"]', bs => bs.map(b => b.dataset.tab).join(','))) === 'all,available,onLoan', 'the Library shows its status tabs, leaving out those with nothing in them');
  await click(s, '[data-act="library:lend"][data-id="' + bk + '"]'); await fill(s, '.cg-q[data-for="lib-lend"]', 'tim jac'); await s.page.waitForTimeout(400); await click(s, '.cg-hits .cg-pick'); await s.settle();
  docs = await s.docsNow(); const loan = find(docs, 'loans', d => d.bookId === bk); t = await s.text();
  check(!!loan && docs[loan].personId === 'p14' && docs[loan].name === 'Tim Jacobs' && docs[loan].back === '' && docs[loan].due > docs[loan].out && docs[key].out === 1, 'it is lent to someone, due back in three weeks');
  check(/On loan[\s\S]*Knowing God[\s\S]*Tim Jacobs/.test(t) && await s.page.isDisabled('[data-act="library:lend"][data-id="' + bk + '"]'), 'the librarian sees who has it; the only copy can’t be lent again');
  check(await s.page.$eval('#lib-filter-borrower', el => el.value === '' && el.placeholder === 'All Borrowers') &&
    !!(await s.page.$('#lib-borrowers option[value="Tim Jacobs"]')), 'the borrower filter defaults to All Borrowers and suggests names with books checked out');
  await fill(s, '#lib-filter-borrower', 'JAC');
  check(await s.page.isVisible('.lib-out-loan') && await s.page.isVisible('[data-act="library:filtersclear"]'),
    'typing part of a surname, in any case, keeps that borrower’s checkout visible and offers a clear button');
  await fill(s, '#lib-filter-borrower', 'TIM');
  check(await s.page.isVisible('.lib-out-loan'), 'a partial first-name search also finds the checked-out book');
  await fill(s, '#lib-filter-borrower', 'not a borrower');
  check(await s.page.isHidden('.lib-out-loan') && (await s.page.textContent('#lib-out-count')).includes('0'),
    'a borrower search with no match hides checked-out books and updates the count');
  check(!!(await s.page.$('#lib-filter-borrowed')) && (await s.page.$$('[data-act="library:sort"]')).length === 6,
    'librarians can filter by date borrowed and sort by borrower or date borrowed as well as catalogue details');
  await click(s, '[data-act="library:filtersclear"]');
  await fill(s, '#lib-filter-borrowed', docs[loan].out);
  check(await s.page.isVisible('.lib-out-loan'), 'the borrowed date filters the checkout');
  check(await s.page.isVisible('.lib-book[data-title="Knowing God"]'), 'the borrowed date filters its catalogue item');
  await fill(s, '#lib-filter-borrowed', '2020-01-01');
  check(await s.page.isHidden('.lib-out-loan') && await s.page.isHidden('.lib-book[data-title="Knowing God"]'),
    'a borrowed date with no match hides those records');
  await click(s, '[data-act="library:filtersclear"]');
  check(await s.page.$eval('#lib-filter-borrower', el => el.value) === 'All Borrowers' &&
    await s.page.isVisible('.lib-out-loan'), 'clearing the borrower filter restores all checked-out books');
  check(await s.page.isDisabled('[data-act="library:repair"][data-id="' + bk + '"]'), 'a borrowed item cannot be marked for repair');
  await click(s, '[data-act="library:libs"]'); await fill(s, '.cg-q[data-for="lib-libs"]', 'megan'); await s.page.waitForTimeout(400); await click(s, '.cg-hits .cg-pick'); await s.settle();
  docs = await s.docsNow();
  check((docs['settings/church'].librarianIds || []).join() === 'p17', 'an Administrator names the librarians');
  await s.page.evaluate(() => { const p = JSON.parse(JSON.stringify(Store.get('people', 'p19'))); p.appRole = 'none'; Store.put('people', p, 'test'); }); await s.settle();
  await click(s, '[data-act="hub:close"]'); await click(s, '[data-act="library:libs"]');
  await fill(s, '.cg-q[data-for="lib-libs"]', 'sam pet'); await s.page.waitForTimeout(400);
  check(/Can’t sign in yet – choosing them gives Basic access/.test(await s.page.textContent('.cg-hits')), 'someone who can’t sign in yet can still be chosen – it says they will get Basic access');
  await click(s, '.cg-hits .cg-pick'); await s.settle(); docs = await s.docsNow();
  check((docs['settings/church'].librarianIds || []).join() === 'p17,p19' && docs['people/p19'].appRole === 'member', '… chosen: a librarian, with Basic access to sign in');
  await click(s, '[data-act="library:libout"][data-id="p19"]'); await s.settle();
  await click(s, '[data-act="hub:close"]');
  await click(s, '[data-act="library:add"]'); await s.page.waitForSelector('#lib-title');
  await select(s, '#lib-kind', 'DVD'); await fill(s, '#lib-title', 'The Chosen'); await click(s, '[data-act="library:save"]'); await s.settle();
  docs = await s.docsNow(); const dvd = find(docs, 'books', d => d.title === 'The Chosen'); const dv = dvd ? dvd.split('/')[1] : '';
  check(!!dvd && docs[dvd].kind === 'DVD' && /The Chosen\s*DVD/.test(await s.text()), 'not only books: a DVD is added, and shown as one');
  await click(s, '[data-act="library:repair"][data-id="' + dv + '"]'); await s.settle(); docs = await s.docsNow();
  check(docs[dvd].repairing === true && !(await s.page.$('[data-act="library:lend"][data-id="' + dv + '"]')) && !!(await s.page.$('[data-act="library:repair"][data-id="' + dv + '"]')), 'a librarian can mark an item as being repaired: it can’t be lent, only brought back from repair');
  await click(s, '[data-act="library:tab"][data-tab="repairing"]');
  check(await s.page.isVisible('.lib-book[data-title="The Chosen"]'), 'the repair tab shows items being repaired');
  await click(s, '[data-act="library:repair"][data-id="' + dv + '"]'); await s.settle(); docs = await s.docsNow();
  check(!docs[dvd].repairing && await s.page.isVisible('[data-act="library:tab"][data-tab="repairing"]'), 'a librarian can return a repaired item to the shelf');
  await click(s, '[data-act="library:tab"][data-tab="all"]');
  await click(s, '[data-act="library:lend"][data-id="' + dv + '"]'); await click(s, '#lib-vname >> xpath=ancestor::details/summary');
  await fill(s, '#lib-vname', 'Jane Visitor'); await click(s, '[data-act="library:lendvisitor"]'); await s.page.waitForTimeout(200);
  docs = await s.docsNow();
  check(!find(docs, 'loans', d => d.bookId === dv) && await s.page.isVisible('#lib-err'), 'a visitor can’t borrow without a mobile number');
  await fill(s, '#lib-vmob', '072 555 0101'); await click(s, '[data-act="library:lendvisitor"]'); await s.settle();
  docs = await s.docsNow(); const vl = find(docs, 'loans', d => d.bookId === dv); t = await s.text();
  check(!!vl && docs[vl].personId === '' && docs[vl].visitor === true && docs[vl].name === 'Jane Visitor' && docs[vl].mobile === '072 555 0101' && /Jane Visitor\s*Visitor\s*·\s*072 555 0101/.test(t), 'someone not on the church’s list borrows it with their name and mobile number');
  await s.page.evaluate(async ids => {
    const dates = [Library.addDays(Hub.today(), -3), Library.addDays(Hub.today(), -1)];
    for (let i = 0; i < ids.length; i++) {
      const record = Store.get('loans', ids[i]); record.out = dates[i];
      await Store.put('loans', record, 'Test library sorting');
    }
  }, [loan.split('/')[1], vl.split('/')[1]]);
  await s.settle();
  await click(s, '[data-act="library:sort"][data-k="borrowed"]');
  check(await s.page.$$eval('.lib-out-loan', rows => {
    const dates = rows.map(row => row.dataset.borrowed);
    return dates.length === 2 && dates[0] < dates[1];
  }), 'the borrowed list sorts by date borrowed');
  await click(s, '[data-act="library:sort"][data-k="borrower"]');
  check(await s.page.$$eval('.lib-out-loan', rows => {
    const names = rows.map(row => row.dataset.borrower);
    return names.length === 2 && names[0] < names[1];
  }), 'the borrowed list sorts by borrower');
  check(!!loan && !!docs[loan].mobile && docs[loan].mobile === docs['people/p14'].mobile, 'a church member’s loan carries the mobile number on their record');
  await click(s, '[data-act="library:back"][data-id="' + vl.split('/')[1] + '"]'); await fill(s, '#lib-backnote', 'Case replaced'); await click(s, '[data-act="library:backsave"]'); await s.settle(); docs = await s.docsNow();
  check(docs[vl].back !== '' && docs[vl].mobile === '' && docs[vl].returnNote === 'Case replaced', 'when it comes back, a condition note is kept and the mobile number is cleared');
  await click(s, '[data-act="library:policy"]'); await s.page.waitForSelector('#lib-pol');
  await fill(s, '#lib-pol', 'Items are lent for three weeks. Please return them clean.'); await click(s, '[data-act="library:policysave"]'); await s.settle();
  docs = await s.docsNow();
  check(docs['libraryPolicy/policy'] && docs['libraryPolicy/policy'].text === 'Items are lent for three weeks. Please return them clean.', 'the librarian pastes in the library’s policy');
  // 0.53: lost, taken out, put back, reports, import, the policy as a page
  await click(s, '[data-act="library:lost"][data-id="' + loan.split('/')[1] + '"]'); await click(s, '[data-act="library:lost"][data-id="' + loan.split('/')[1] + '"]'); await s.settle();
  docs = await s.docsNow();
  check(docs[loan].lost === true && !!docs[loan].back && !!docs[loan].mobile && docs[key].removed && docs[key].why === 'Lost' && !/Knowing God\s*(Available|On loan)/.test(await s.text()), 'the only copy marked lost: kept on the loan with the mobile number, and the item leaves the shelf');
  await click(s, '[data-act="library:tab"][data-tab="lost"]');
  check(await s.page.isVisible('.lib-gone-item[data-removed="lost"]'), 'the Lost tab shows lost items');
  await fill(s, '#lib-filter-borrower', 'tim');
  await fill(s, '#lib-filter-borrowed', docs[loan].out);
  check(await s.page.isVisible('.lib-gone-item[data-removed="lost"]'), 'the Lost tab filters by the borrower and original date borrowed');
  await click(s, '[data-act="library:filtersclear"]');
  await click(s, '[data-act="library:putback"][data-id="' + bk + '"]'); await s.settle(); docs = await s.docsNow();
  await click(s, '[data-act="library:tab"][data-tab="all"]');
  check(!docs[key].removed && /Knowing God\s*Available/.test(await s.text()), 'it can be put back if it turns up');
  await click(s, '[data-act="library:remove"][data-id="' + dv + '"]'); await select(s, '#lib-why', 'Damaged'); await fill(s, '#lib-whynote', 'Scratched'); await click(s, '[data-act="library:removesave"]'); await s.settle();
  docs = await s.docsNow();
  check(docs[dvd].removed && docs[dvd].why === 'Damaged' && docs[dvd].whyNote === 'Scratched', 'an item is taken out of the library with why (not deleted)');
  await click(s, '[data-act="library:tab"][data-tab="removed"]');
  check(await s.page.isVisible('.lib-gone-item[data-removed="removed"]'), 'the Permanently Removed tab shows other removed items');
  await click(s, '[data-act="library:tab"][data-tab="all"]');
  await click(s, '[data-act="library:report"]'); await s.page.waitForSelector('#lib-rep'); t = await s.page.textContent('#lib-rep');
  check(/On Loan\s*2/.test(t) && /Returned\s*1/.test(t) && /Lost\s*1/.test(t) && /Acquired\s*2/.test(t) && /Removed from Library by Librarian\s*1/.test(t) && (await s.page.textContent('#modal')).includes('Show library activity between two dates'), 'reports are grouped under clickable activity chips for the date range');
  await click(s, '[data-act="library:reporttab"][data-tab="lost"]');
  check(await s.page.$$eval('#lib-report-items .lib-report-row', rows => rows.length) === 1 && (await s.page.textContent('#lib-report-heading')) === 'Lost', 'a report chip selects its matching items');
  await click(s, '[data-act="library:reporttab"][data-tab="onLoan"]');
  await fill(s, '#lib-report-filter', 'Knowing God');
  check(await s.page.$$eval('#lib-report-items .lib-report-row:not([hidden])', rows => rows.length) === 1, 'report items can be filtered by title');
  await s.page.evaluate(() => { window.print = () => { window.__libPrinted = document.getElementById('print-only').innerText; }; });
  await click(s, '[data-act="library:reportprint"]'); await s.page.waitForFunction(() => !!window.__libPrinted);
  check(/On Loan/.test(await s.page.evaluate(() => window.__libPrinted)) && /Knowing God/.test(await s.page.evaluate(() => window.__libPrinted)) && !/The Chosen/.test(await s.page.evaluate(() => window.__libPrinted)), 'printing includes only the selected, filtered report items');
  await s.page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  const [rdl] = await Promise.all([s.page.waitForEvent('download'), s.page.click('[data-act="library:reportcsv"]')]);
  const rcsv = ctx.fs.readFileSync(await rdl.path(), 'utf8');
  check(/^﻿What,Date,Title/.test(rcsv) && /On Loan,\d{4}-\d\d-\d\d,Knowing God/.test(rcsv) && !/\nLost,/.test(rcsv) && !/\nRemoved,/.test(rcsv), 'the spreadsheet follows the selected report chip and filter');
  await click(s, '[data-act="hub:close"]');
  await click(s, '[data-act="library:import"]');
  await s.page.setInputFiles('#lib-csv', { name: 'books.csv', mimeType: 'text/csv', buffer: Buffer.from('Title,Author,Type,Copies\nMere Christianity,C. S. Lewis,book,2\nKnowing God,J. I. Packer,,\n,Nobody,,\nThe Jesus Storybook Bible,Sally Lloyd-Jones,,1\n') });
  await s.page.waitForSelector('#lib-csv-plan:not([hidden])'); t = await s.page.textContent('#lib-csv-plan');
  check(/2 new items will be added/.test(t) && /1 is already in the library/.test(t) && /1 row has no title/.test(t), 'importing a list: Church Hub says what it will add and what it leaves out');
  await click(s, '[data-act="library:importgo"]'); await s.settle(); docs = await s.docsNow();
  const mc = find(docs, 'books', d => d.title === 'Mere Christianity');
  check(!!mc && docs[mc].copies === 2 && docs[mc].author === 'C. S. Lewis' && !!find(docs, 'books', d => d.title === 'The Jesus Storybook Bible') && Object.keys(docs).filter(k => /^books\//.test(k) && docs[k].title === 'Knowing God').length === 1, 'the new items are added, nothing twice');
  await click(s, '[data-act="library:policy"]'); await s.page.waitForSelector('#lib-pol');
  await fill(s, '#lib-pol', '# Borrowing\nItems are lent for three weeks.\n\n1. Look after them\n2. Return them clean'); await click(s, '[data-act="library:policysave"]'); await s.settle();
  await click(s, '[data-act="library:policyread"]'); await s.page.waitForSelector('article.lib-doc');
  check(await s.page.textContent('article.lib-doc h3') === 'Borrowing' && (await s.page.$$('article.lib-doc ol li')).length === 2, 'the policy is shown as a page: a heading and a numbered list');
  await click(s, '[data-act="hub:close"]');
  // put the policy back as it was, for the checks that follow
  await click(s, '[data-act="library:policy"]'); await s.page.waitForSelector('#lib-pol');
  await fill(s, '#lib-pol', 'Items are lent for three weeks. Please return them clean.'); await click(s, '[data-act="library:policysave"]'); await s.settle();
  // lend Knowing God to Tim again, for the checks that follow (he has it out)
  await click(s, '[data-act="library:lend"][data-id="' + bk + '"]'); await fill(s, '.cg-q[data-for="lib-lend"]', 'tim jac'); await s.page.waitForTimeout(400); await click(s, '.cg-hits .cg-pick'); await s.settle();
  docs = await s.docsNow();
  const activeLoan = find(docs, 'loans', d => d.bookId === bk && !d.back);
  await s.page.evaluate(() => {
    Store.put('books', { id: 'purge-admin-book', title: 'Purge activity test', copies: 2, out: 1 });
    Store.put('loans', { id: 'purge-admin-out', bookId: 'purge-admin-book', title: 'Purge activity test', personId: 'p14', name: 'Tim Jacobs', mobile: '082 000 1518', visitor: false, out: '2026-11-10', due: '2026-12-01', back: '' });
    Store.put('loans', { id: 'purge-admin-returned', bookId: 'purge-admin-book', title: 'Purge activity test', personId: 'p14', name: 'Tim Jacobs', mobile: '082 000 1518', visitor: false, out: '2026-11-09', due: '2026-11-30', back: '2026-11-10' });
    Store.put('books', { id: 'purge-librarian-removed', title: 'Librarian removed book', copies: 1, out: 0, removed: '2026-11-10', why: 'Damaged' });
    Store.put('loans', { id: 'purge-librarian-history', bookId: 'purge-librarian-removed', title: 'Librarian removed book', personId: 'p14', name: 'Tim Jacobs', mobile: '082 000 1518', visitor: false, out: '2026-11-08', due: '2026-11-29', back: '2026-11-09' });
    Hub.render();
  });
  await s.settle();
  check(!!(await s.page.$('[data-act="library:purge"][data-kind="loan"][data-id="purge-admin-out"]')), 'an Administrator sees Purge on an active loan record');
  await click(s, '[data-act="library:purge"][data-kind="loan"][data-id="purge-admin-out"]'); await s.page.waitForSelector('[data-act="library:purgeconfirm"]');
  const activePurgePrompt = await s.page.textContent('#modal');
  check(activePurgePrompt.includes('This cannot be undone.') && !!(await s.page.evaluate(() => Store.get('loans', 'purge-admin-out'))), 'purging asks for confirmation before removing the active loan');
  await click(s, '[data-act="library:purgeconfirm"]'); await s.settle(); docs = await s.docsNow();
  check(!find(docs, 'loans', d => d.id === 'purge-admin-out') && docs['books/purge-admin-book'].out === 0, 'purging an active loan updates the copy count immediately');
  await s.page.evaluate(() => { Store.remove('loans', 'purge-admin-returned'); Store.remove('books', 'purge-admin-book'); });
  await s.settle();
  await click(s, '#lib-out summary');
  check(!!(await s.page.$('[data-act="library:purge"][data-kind="loan"][data-id="' + vl.split('/')[1] + '"]')), 'an Administrator sees Purge on a returned loan');
  await click(s, '[data-act="library:purge"][data-kind="loan"][data-id="' + vl.split('/')[1] + '"]'); await click(s, '[data-act="library:purgeconfirm"]'); await s.settle(); docs = await s.docsNow();
  check(!docs[vl], 'an Administrator can confirm and purge a returned loan');
  await s.page.evaluate(() => Hub.render());
  await s.page.waitForTimeout(100);
  await s.page.evaluate(bookId => {
    Store.put('loans', { id: 'purge-admin-linked-history', bookId, title: 'The Chosen', personId: 'p14', name: 'Tim Jacobs', mobile: '082 000 1518', visitor: false, out: '2026-11-09', due: '2026-11-30', back: '2026-11-10' });
    Hub.render();
  }, dv);
  await s.settle(); await click(s, '[data-act="library:report"]'); await click(s, '[data-act="library:reporttab"][data-tab="removed"]'); await fill(s, '#lib-report-filter', '');
  check(!!(await s.page.$('#modal [data-act="library:purge"][data-kind="book"][data-id="' + dv + '"]')), 'an Administrator sees Purge on a removed book in Reports');
  await click(s, '#modal [data-act="library:purge"][data-kind="book"][data-id="' + dv + '"]'); await s.page.waitForSelector('[data-act="library:purgeconfirm"]');
  check((await s.page.textContent('#modal')).includes('its loan records?'), 'purging a removed book warns that its loan records will also be deleted');
  await click(s, '[data-act="library:purgeconfirm"]'); await s.settle(); docs = await s.docsNow();
  check(!docs[dvd] && !docs['loans/purge-admin-linked-history'], 'purging a removed book also removes its linked returned loan');
  const live = JSON.parse(JSON.stringify(docs));
  live['books/checkout-approve'] = { kind: 'Book', title: 'Checkout approval test', author: 'A Writer', copies: 1, out: 0 };
  live['books/checkout-reject'] = { kind: 'Book', title: 'Checkout rejection test', author: 'A Writer', copies: 1, out: 0 };
  await finish(s);

  console.log('Library cover lookup (Administrator):');
  const coverSeed = on(seedDocs());
  coverSeed['books/cv-a'] = { kind: 'Book', title: 'Alpha Cover', author: 'A Writer', isbn: '9780000000001', copies: 1, out: 0 };
  coverSeed['books/cv-b'] = { kind: 'Book', title: 'Beta Missing', author: 'B Writer', copies: 1, out: 0 };
  coverSeed['books/cv-c'] = { kind: 'Book', title: 'Gamma Limited', author: 'C Writer', isbn: '9780000000003', copies: 1, out: 0 };
  coverSeed['books/cv-d'] = { kind: 'Book', title: 'Delta Skipped', author: 'D Writer', copies: 1, out: 0 };
  coverSeed['books/cv-e'] = { kind: 'Book', title: 'The Alpha-Cover!', author: 'A Writer', copies: 1, out: 0 };
  coverSeed['books/cv-f'] = { kind: 'Book', title: 'Beta Missing', author: 'B Writer', copies: 1, out: 0 };
  coverSeed['books/cv-covered'] = { kind: 'Book', title: 'Already covered', author: 'A Writer', copies: 1, out: 0, cover: 'v1' };
  coverSeed['covers/cv-covered'] = { data: 'data:image/jpeg;base64,' + PNG.buffer.toString('base64') };
  const covers = await session('linda.pillay@example.com', coverSeed);
  await covers.go('library');
  await click(covers, '[data-act="library:add"]'); await covers.page.waitForSelector('#lib-cover-drop');
  await fill(covers, '#lib-title', 'Dropped cover test');
  await covers.page.evaluate(base64 => {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const file = new File([bytes], 'cover.png', { type: 'image/png' });
    const data = new DataTransfer(); data.items.add(file);
    document.getElementById('lib-cover-drop').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: data }));
  }, PNG.buffer.toString('base64'));
  await covers.page.waitForSelector('#lib-cover-now img');
  await click(covers, '#modal [data-act="library:save"]'); await covers.settle(); docs = await covers.docsNow();
  const dropped = find(docs, 'books', d => d.title === 'Dropped cover test');
  check(!!dropped && /^data:image\/jpeg;base64,/.test(docs['covers/' + dropped.split('/')[1]].data), 'a dropped PNG cover is resized and stored with the new catalogue item');
  await click(covers, '[data-act="library:duplicates"]'); await covers.page.waitForSelector('#modal .lib-duplicate-pair');
  check((await covers.page.textContent('#modal')).includes('The Alpha-Cover!') && (await covers.page.textContent('#modal')).includes('Alpha Cover'),
    'Suggested Duplicates groups titles that differ by an article, punctuation and whitespace');
  const alphaPair = await covers.page.getAttribute('#modal [data-act="library:duplicateedit"]', 'data-key');
  await click(covers, '#modal [data-act="library:duplicateedit"]');
  await fill(covers, '#lib-dup-title', 'Alpha Cover'); await fill(covers, '#lib-dup-author', 'A Writer');
  await click(covers, '#modal [data-act="library:duplicatesave"]'); await covers.settle(); docs = await covers.docsNow();
  check(docs['books/cv-a'].title === 'Alpha Cover' && docs['books/cv-e'].title === 'Alpha Cover' && !!alphaPair,
    'a librarian can standardize matched catalogue details without merging their copies');
  await click(covers, '[data-act="library:duplicates"]'); await covers.page.waitForSelector('#modal .lib-duplicate-pair');
  await click(covers, '#modal [data-act="library:duplicateignore"][data-key="cv-b::cv-f"]'); await covers.settle();
  docs = await covers.docsNow();
  check(!!docs['libraryDuplicateIgnores/cv-a::cv-e'] && !!docs['libraryDuplicateIgnores/cv-b::cv-f'] &&
    (await covers.page.textContent('#modal')).includes('No possible duplicates were found.'),
    'a librarian can dismiss a false-positive pair so it no longer returns');
  await click(covers, '#modal [data-act="hub:close"]');
  await covers.page.route('https://www.googleapis.com/books/v1/volumes**', route => {
    const q = new URL(route.request().url()).searchParams.get('q') || '';
    if (q.includes('9780000000003')) return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ error: { message: 'Daily Limit Exceeded', errors: [{ reason: 'dailyLimitExceeded' }] } })
    });
    if (q.includes('Beta Missing')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) });
    const isbn = (q.match(/isbn:([0-9]+)/) || [])[1] || '9780000000001';
    const title = isbn === '9780000000001' ? 'Alpha Cover' : 'Delta Skipped';
    const author = isbn === '9780000000001' ? 'A Writer' : 'D Writer';
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [{
      volumeInfo: { title, authors: [author], industryIdentifiers: [{ type: 'ISBN_13', identifier: isbn }],
        imageLinks: { thumbnail: 'https://books.google.com/books/content?id=test-cover&printsec=frontcover' } }
    }] }) });
  });
  await covers.page.route('https://books.google.com/books/content**', route => route.fulfill({
    status: 200, contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*' }, body: PNG.buffer
  }));
  await click(covers, '[data-act="library:coversselectmissing"]');
  check(await covers.page.isChecked('[data-lib-select="cv-a"]') && !(await covers.page.isChecked('[data-lib-select="cv-covered"]')),
    'the missing-cover filter selects books without disturbing existing covers');
  const selectedIds = await covers.page.$$eval('[data-lib-select]:checked', inputs => inputs.map(input => input.dataset.libSelect).filter(id => id !== 'cv-a'));
  for (const id of selectedIds) await covers.page.uncheck('[data-lib-select="' + id + '"]');
  await covers.page.check('[data-lib-select="cv-a"]');
  await click(covers, '[data-act="library:coversselected"]');
  await covers.page.waitForSelector('#modal [data-act="library:coversave"][data-id="cv-a"]');
  check((await covers.page.textContent('#modal')).includes('Preview each cover before saving it to the library.'), 'a librarian or Administrator previews a selectively fetched cover before saving');
  await click(covers, '#modal [data-act="library:coversave"][data-id="cv-a"]');
  await covers.settle(); docs = await covers.docsNow();
  check(!!docs['books/cv-a'].cover && /^data:image\/jpeg;base64,/.test(docs['covers/cv-a'].data), 'the selected cover is saved as a small image on the book record');
  await click(covers, '#modal [data-act="hub:close"]');
  await click(covers, '[data-act="library:coversall"]');
  await covers.page.waitForFunction(() => document.querySelector('#lib-cover-progress') && document.querySelector('#lib-cover-progress').textContent.includes('Search complete.'), null, { timeout: 10000 });
  t = await covers.page.textContent('#modal');
  check(t.includes('No matching cover found') && t.includes('reached its limit') && t.includes('Alpha Cover'), 'bulk cover lookup reports missing matches and rate limits without losing earlier results');
  await click(covers, '#modal [data-act="library:coverssaveall"]'); await covers.settle(); docs = await covers.docsNow();
  check(!!docs['covers/cv-a'] && !docs['covers/cv-b'] && !docs['covers/cv-c'] && !docs['covers/cv-d'], 'Save all keeps the successful covers and skips missing or rate-limited books');
  await finish(covers);

  // What each person sees of it all, carrying on from what the Administrator set up
  const as = async (email, senior) => { const seed = JSON.parse(JSON.stringify(live)); if (senior) seed['settings/church'].seniorPastorId = senior; const x = await session(email, seed); await x.go('library/archives'); await x.page.waitForTimeout(400); return x; };
  const sees = async x => { const tx = await x.text(); return ['Council minutes – October', 'Contract of employment'].map(n => tx.includes(n) ? 'y' : 'n').join(''); };
  const deniedArchive = async (x, id) => x.page.evaluate(async fileId => {
    let fileDenied = false;
    try { await Store.loadFile(fileId, 0); } catch (e) { fileDenied = e.code === 'permission-denied'; }
    return Store.list('archive').length === 0 && Store.get('archive', fileId) === null && fileDenied;
  }, id);
  console.log('A Council member (Basic access):');
  s = await as('tim.jacobs@example.com');
  check((await sees(s)) === 'yn' && !!(await s.page.$('[data-act="archive:add"]')) && !!(await s.page.$('[data-act="archive:edit"]')), 'sees the Council’s minutes, not the staff contract, and can add or change records');
  check(await s.page.evaluate(id => !!Store.get('archive', id) && Store.list('archive').some(r => r.id === id), ar), 'a Council member can query the archive records allowed to them');
  await click(s, '[data-act="archive:storageinfo"]'); await s.page.waitForSelector('#modal .overlay');
  check((await s.page.textContent('#modal')).includes('Uploaded files are stored in the church’s Firestore database in South Africa.') && (await s.page.textContent('#modal')).includes('Linked files stay in their cloud folder:'), 'a Council member can open the storage information note');
  await click(s, '#modal [data-act="hub:close"]'); await s.page.waitForFunction(() => !document.querySelector('#modal .overlay'));
  check(await s.page.isVisible('[data-act="archive:preview"][data-id="' + ar + '"]'), 'a Council member can preview a record they are allowed to see');
  await click(s, '[data-act="archive:preview"][data-id="' + ar + '"]'); await s.page.waitForSelector('#modal .ar-preview-image');
  await click(s, '#modal [data-act="hub:close"]'); await s.page.waitForFunction(() => !document.querySelector('#modal .overlay'));
  check(await s.page.evaluate(async id => { try { await Store.loadArchivePreview(id, 1); return true; } catch (e) { return false; } }, ar), 'the Council member can request the restricted preview data directly');
  const [dl2] = await Promise.all([s.page.waitForEvent('download'), s.page.click('[data-act="archive:open"][data-id="' + ar + '"]')]);
  check(ctx.fs.readFileSync(await dl2.path()).equals(PNG.buffer), 'and can download them');
  await click(s, '[data-act="archive:add"]'); await s.page.waitForSelector('#ar-title');
  await fill(s, '#ar-title', 'Council filing test'); await fill(s, '#ar-date', '2026-11-13'); await s.page.setInputFiles('#ar-file', PNG);
  await click(s, '[data-act="archive:save"]'); await s.settle(); docs = await s.docsNow();
  const councilFile = find(docs, 'archive', d => d.title === 'Council filing test'), councilFileId = councilFile ? councilFile.split('/')[1] : '';
  check(!!councilFile && !!docs['archive/' + councilFileId + '/parts/0'] && !!docs['archivePreviews/' + councilFileId + '/parts/0'], 'a Council member can add a record and its file and preview copy');
  await s.go('leaders'); t = await s.text();
  check(t.includes('Church Council') && t.includes('Tim Jacobs') && !(await s.page.$('#lb-new')) && !(await s.page.$('[data-act="leaders:seat"]')), 'sees their own leadership group (though it is for members only), and can’t change it');
  await s.go('library'); t = await s.text();
  check(/Items I have borrowed[\s\S]*Knowing God[\s\S]*Due/.test(t) && !(await s.page.$('[data-act="library:add"]')) && !(await s.page.$('#lib-out')) && /Knowing God\s*On loan/.test(t), 'the Library uses the renamed borrowed-items heading and shows the due date – not the librarian’s tools');
  check(!(await s.page.$('#lib-covers-selected')) && !(await s.page.$('[data-act="library:coversall"]')) && !(await s.page.$('[data-lib-select]')), 'regular members cannot run book cover searches or save covers');
  check(!(await s.page.$('[data-act="library:purge"]')), 'a regular member has no Purge controls');
  check(!!(await s.page.$('#lib-filter-kind')) && !!(await s.page.$('#lib-filter-title')) && !!(await s.page.$('#lib-filter-author')) && !!(await s.page.$('#lib-filter-cat')) && !(await s.page.$('#lib-filter-borrower')) && (await s.page.$$('[data-act="library:sort"]')).length === 4, 'everyone can filter and sort the catalogue while the borrower filter stays hidden');
  await select(s, '#lib-filter-kind', 'Book'); await fill(s, '#lib-filter-title', 'Knowing God'); await fill(s, '#lib-filter-author', 'J. I. Packer'); await fill(s, '#lib-filter-cat', 'Theology');
  check(await s.page.isVisible('.lib-book[data-title="Knowing God"]') && await s.page.$$eval('.lib-book:not([hidden])', rows => rows.length) === 1, 'the catalogue filters on all four fields together');
  await select(s, '#lib-filter-kind', ''); await fill(s, '#lib-filter-title', ''); await fill(s, '#lib-filter-author', ''); await fill(s, '#lib-filter-cat', '');
  await click(s, '[data-act="library:sort"][data-k="author"]');
  check(await s.page.$$eval('#lib-books .lib-book', rows => {
    const authors = rows.map(row => row.dataset.author || '');
    return authors.every((author, i) => !i || authors[i - 1].localeCompare(author, undefined, { sensitivity: 'base' }) <= 0);
  }), 'the public catalogue sorts by the selected field');
  check(t.includes('Library policy') && !!(await s.page.$('[data-act="library:policyread"]')) && !(await s.page.$('[data-act="library:policy"]')), 'the policy is available from a compact link; editing stays librarian-only');
  await s.page.route('https://www.googleapis.com/books/v1/volumes**', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ items: [{ volumeInfo: { title: 'Knowing God', authors: ['J. I. Packer'], publisher: 'Test Publisher',
      publishedDate: '1973', description: 'A book information preview.' } }] })
  }));
  await click(s, '[data-act="library:bookinfo"][data-id="' + bk + '"]');
  await s.page.waitForFunction(() => document.querySelector('#lib-info-results h3') && document.querySelector('#lib-info-results').textContent.includes('Test Publisher'));
  check(!!(await s.page.$('#modal a[href*="books.google.com/books?q="]')) && !!(await s.page.$('#modal a[href*="google.com/search?q="]')), 'View / Info shows Google Books details with exact-title search fallbacks');
  await click(s, '#modal [data-act="hub:close"]');
  // Google Books busy (its shared quota used up): the details come from Open Library instead
  await s.page.unroute('https://www.googleapis.com/books/v1/volumes**');
  await s.page.route('https://www.googleapis.com/books/v1/volumes**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Daily Limit Exceeded', errors: [{ reason: 'dailyLimitExceeded' }] } }) }));
  await s.page.route('https://openlibrary.org/search.json**', route => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ docs: [{ key: '/works/OL1W', title: 'Knowing God', author_name: ['J. I. Packer'], publisher: ['Open Publisher'], first_publish_year: 1973 }] }) }));
  await click(s, '[data-act="library:bookinfo"][data-id="' + bk + '"]');
  await s.page.waitForFunction(() => document.querySelector('#lib-info-results h3') && document.querySelector('#lib-info-results').textContent.includes('Open Publisher'));
  check(!!(await s.page.$('#modal a[href="https://openlibrary.org/works/OL1W"]')), 'when Google Books is busy, View / Info shows the details from Open Library');
  await click(s, '#modal [data-act="hub:close"]');
  await click(s, '[data-act="library:policyread"]'); await s.page.waitForSelector('#modal article.lib-doc');
  check((await s.page.textContent('#modal')).includes('Items are lent for three weeks.'), 'the compact policy action opens the complete policy');
  await click(s, '#modal [data-act="hub:close"]');
  await click(s, '[data-act="library:request"][data-id="checkout-approve"]');
  await s.page.waitForSelector('#modal [data-act="library:requestsubmit"]');
  await click(s, '#modal [data-act="library:requestsubmit"]'); await s.settle();
  docs = await s.docsNow();
  const approvalPath = find(docs, 'loans', loan => loan.bookId === 'checkout-approve');
  check(!!approvalPath && docs[approvalPath].status === 'pending' && docs[approvalPath].personId === 'p14' &&
    docs['books/checkout-approve'].out === 1 && (await s.text()).includes('Waiting for approval'),
    'self-service checkout reserves the copy and appears as pending for the borrower');
  const competing = await session('clare.jacobs@example.com', docs);
  const competingResult = await competing.page.evaluate(async () => {
    try {
      await Store.requestLibraryLoan('checkout-approve', { bookId: 'checkout-approve', title: 'Checkout approval test', personId: 'p15',
        name: 'Clare Jacobs', mobile: Store.get('people', 'p15').mobile, visitor: false, out: Hub.today(), due: '2026-12-01', back: '', note: '' });
      return 'claimed';
    } catch (e) { return 'unavailable'; }
  });
  docs = await competing.docsNow();
  check(competingResult === 'unavailable' && docs['books/checkout-approve'].out === 1 &&
    Object.keys(docs).filter(k => /^loans\//.test(k) && docs[k].bookId === 'checkout-approve').length === 1,
    'a second member cannot claim the last copy while the first request awaits verification');
  await competing.close();
  const approveReview = await session('megan.smith@example.com', docs);
  await approveReview.go('home');
  await approveReview.page.waitForFunction(() => document.querySelector('#app').textContent.includes('checkout request needs verification'));
  check((await approveReview.text()).includes('checkout request needs verification'), 'the existing Home reminder notifies librarians of pending requests');
  await approveReview.go('library'); await approveReview.page.waitForSelector('#lib-pending [data-act="library:verify"]');
  await click(approveReview, '#lib-pending [data-act="library:verify"][data-id="' + approvalPath.split('/')[1] + '"]'); await approveReview.settle();
  docs = await approveReview.docsNow();
  check(docs[approvalPath].status === 'approved' && docs['books/checkout-approve'].out === 1, 'librarian approval converts the pending claim to an active loan');
  await approveReview.close();
  await click(s, '[data-act="library:request"][data-id="checkout-reject"]');
  await s.page.waitForSelector('#modal [data-act="library:requestsubmit"]');
  await click(s, '#modal [data-act="library:requestsubmit"]'); await s.settle(); docs = await s.docsNow();
  const rejectionPath = find(docs, 'loans', loan => loan.bookId === 'checkout-reject');
  const rejectReview = await session('megan.smith@example.com', docs);
  await rejectReview.go('library'); await rejectReview.page.waitForSelector('#lib-pending [data-act="library:reject"]');
  const rejectButton = '#lib-pending [data-act="library:reject"][data-id="' + rejectionPath.split('/')[1] + '"]';
  await click(rejectReview, rejectButton); await click(rejectReview, rejectButton); await rejectReview.settle();
  docs = await rejectReview.docsNow();
  check(docs[rejectionPath].status === 'rejected' && docs['books/checkout-reject'].out === 0,
    'librarian rejection cancels the request and releases the reserved copy');
  await rejectReview.close();
  await finish(s);
  console.log('The staff member a contract is about:');
  s = await as('lerato.khumalo@example.com');
  check((await sees(s)) === 'nn' && (await s.text()).includes('Restricted View — Access restricted to Council members and Administrators only.'), 'a standard member sees the restricted notice and no archive records');
  check(!(await s.page.$('[data-act="archive:preview"]')) && await deniedPreview(s, ar) && await deniedArchive(s, ar),
  'a standard member cannot preview, query, or download archive contents directly');
  await s.go('library');
  check(!(await s.page.$('#lib-filter-borrower')) && !(await s.page.$('#lib-filter-borrowed')) && !(await s.page.$('#lib-borrowers')),
    'a regular member does not see borrower or borrowed-date filters or borrower suggestions');
  await s.go('leaders'); t = await s.text();
  check(!t.includes('Church Council') && t.includes('No leadership groups yet.'), 'a members-only leadership group is hidden from everyone else');
  await finish(s);
  console.log('Someone else (Basic access), who is a librarian:');
  s = await as('megan.smith@example.com');
  check((await sees(s)) === 'nn' && !!(await s.page.$('nav a[href="#/library"]')) && !(await s.page.$('nav a[href="#/archive"]')) && (await s.text()).includes('Restricted View — Access restricted to Council members and Administrators only.'), 'a librarian sees the locked Archives tab and restricted notice, not records');
  check(await deniedPreview(s, ar) && await deniedArchive(s, ar),
    'a librarian cannot query, preview, or download archive contents directly');
  await s.go('library'); await s.page.waitForTimeout(400); t = await s.text();
  check(/On loan[\s\S]*Knowing God[\s\S]*Tim Jacobs/.test(t) && !!(await s.page.$('[data-act="library:add"]')) && !(await s.page.$('[data-act="library:libs"]')), 'as a librarian sees who has which book and can add books (but not name librarians)');
  check(!!(await s.page.$('#lib-filter-borrower')) && !!(await s.page.$('#lib-filter-borrowed')),
    'a librarian can search the current borrowers and filter by date borrowed');
  await s.go('me'); t = await s.page.textContent('.me-chips');
  check(t.includes('Librarian'), 'a librarian has a Librarian chip on the Me page');
  await s.go('library'); await s.page.waitForTimeout(400); t = await s.text();
  check(!!(await s.page.$('[data-act="library:purge"][data-kind="loan"][data-id="' + activeLoan.split('/')[1] + '"]')), 'a librarian sees Purge on borrowed records');
  await click(s, '[data-act="library:back"][data-id="' + activeLoan.split('/')[1] + '"]'); await fill(s, '#lib-backnote', 'Cover slightly torn'); await click(s, '[data-act="library:backsave"]'); await s.settle(); docs = await s.docsNow(); t = await s.text();
  check(docs[activeLoan].back !== '' && docs[activeLoan].returnNote === 'Cover slightly torn', 'the return date and condition note are saved');
  check(docs['books/' + bk].out === 0 && /Knowing God\s*Available/.test(t), 'the returned copy is back on the shelf');
  check(t.includes('Nothing on loan.'), 'the librarian no longer sees the loan as outstanding');
  await click(s, '#lib-out summary');
  check(!!(await s.page.$('[data-act="library:purge"][data-kind="loan"][data-id="' + activeLoan.split('/')[1] + '"]')), 'a librarian sees Purge on a returned loan');
  await click(s, '[data-act="library:purge"][data-kind="loan"][data-id="' + activeLoan.split('/')[1] + '"]'); await click(s, '[data-act="library:purgeconfirm"]'); await s.settle(); docs = await s.docsNow();
  check(!docs[activeLoan], 'a librarian can confirm and purge a returned loan');
  await s.page.evaluate(() => {
    Store.put('books', { id: 'purge-librarian-out-book', title: 'Librarian borrowed test', copies: 1, out: 1 });
    Store.put('loans', { id: 'purge-librarian-out', bookId: 'purge-librarian-out-book', title: 'Librarian borrowed test', personId: 'p14', name: 'Tim Jacobs', mobile: '082 000 1518', visitor: false, out: '2026-11-10', due: '2026-12-01', back: '' });
    Hub.render();
  });
  await s.settle(); await click(s, '[data-act="library:purge"][data-kind="loan"][data-id="purge-librarian-out"]'); await click(s, '[data-act="library:purgeconfirm"]'); await s.settle(); docs = await s.docsNow();
  check(!find(docs, 'loans', d => d.id === 'purge-librarian-out') && docs['books/purge-librarian-out-book'].out === 0, 'a librarian can confirm and purge an active loan');
  await s.go('library');
  await click(s, '[data-act="library:purge"][data-kind="book"][data-id="purge-librarian-removed"]'); await click(s, '[data-act="library:purgeconfirm"]'); await s.settle(); docs = await s.docsNow();
  check(!docs['books/purge-librarian-removed'] && !find(docs, 'loans', d => d.id === 'purge-librarian-history'), 'a librarian can purge a removed book and its linked history');
  await finish(s);
  console.log('A Pastor, and the Senior Pastor:');
  s = await as('pieter.vanwyk@example.com');
  check((await sees(s)) === 'nn' && (await s.text()).includes('Restricted View — Access restricted to Council members and Administrators only.'), 'a Pastor who is not a Council member sees only the restricted notice');
  await finish(s);
  s = await as('pieter.vanwyk@example.com', 'p03');
  check((await sees(s)) === 'nn' && (await s.text()).includes('Restricted View — Access restricted to Council members and Administrators only.') && !(await s.page.$('[data-act="archive:add"]')), 'Senior Pastor status alone does not grant Archive access or editing');
  await s.go('library'); await s.page.waitForTimeout(300);
  check(!!(await s.page.$('[data-act="library:libs"]')) && !(await s.page.$('[data-act="library:add"]')) && !!(await s.page.$('[data-act="library:policy"]')), 'the Senior Pastor chooses the librarians and may change the policy, without being a librarian');
  await click(s, '[data-act="library:libs"]'); await fill(s, '.cg-q[data-for="lib-libs"]', 'tim jac'); await s.page.waitForTimeout(400); await click(s, '.cg-hits .cg-pick'); await s.settle();
  docs = await s.docsNow(); t = (await s.page.textContent('body')) || '';
  await fill(s, '.cg-q[data-for="lib-libs"]', 'clare'); await s.page.waitForTimeout(400); await click(s, '.cg-hits .cg-pick'); await s.settle();
  await fill(s, '.cg-q[data-for="lib-libs"]', 'kavi'); await s.page.waitForTimeout(400); await click(s, '.cg-hits .cg-pick'); await s.settle();
  docs = await s.docsNow(); t = (await s.page.textContent('body')) || '';
  check(['p17', 'p14', 'p15', 'p20'].every(id => (docs['settings/church'].librarianIds || []).includes(id)) &&
    (docs['settings/church'].librarianIds || []).length === 4 && !!docs['settings/church'].librarianReviewedAt &&
    !!(await s.page.$('.cg-q[data-for="lib-libs"]')), 'more than two librarians can be appointed and each appointment saves a review date');
  await finish(s);

  console.log('An additional librarian can use the full Library tools:');
  const kaviSeed = JSON.parse(JSON.stringify(live));
  kaviSeed['settings/church'].librarianIds = ['p17', 'p14', 'p15', 'p20'];
  kaviSeed['settings/church'].librarianReviewedAt = new Date().toISOString();
  s = await session('kavi.govender@example.com', kaviSeed); await s.go('library');
  check(!!(await s.page.$('[data-act="library:add"]')) && !!(await s.page.$('[data-act="library:purge"]')) && !!(await s.page.$('[data-act="library:coversselectmissing"]')), 'a fourth librarian gets the same manage, purge and cover lookup controls');
  await s.page.route('https://www.googleapis.com/books/v1/volumes**', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ items: [{
      volumeInfo: { title: 'Knowing God', authors: ['J. I. Packer'], industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780000000004' }],
        imageLinks: { thumbnail: 'https://books.google.com/books/content?id=kavi-cover&printsec=frontcover' } }
    }] })
  }));
  await s.page.route('https://books.google.com/books/content**', route => route.fulfill({
    status: 200, contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*' }, body: PNG.buffer
  }));
  const knowing = find(kaviSeed, 'books', b => b.title === 'Knowing God').split('/')[1];
  await click(s, '[data-act="library:coversselectmissing"]');   // shows the tick boxes
  await s.page.check('[data-lib-select="' + knowing + '"]');
  await click(s, '[data-act="library:coversselected"]');
  await s.page.waitForSelector('#modal [data-act="library:coversave"][data-id="' + knowing + '"]');
  await click(s, '#modal [data-act="library:coversave"][data-id="' + knowing + '"]'); await s.settle();
  check(!!(await s.docsNow())['covers/' + knowing], 'an assigned librarian can selectively find and save a cover');
  await click(s, '#modal [data-act="hub:close"]');
  await click(s, '[data-act="library:coversall"]');
  await s.page.waitForFunction(() => document.querySelector('#lib-cover-progress') && document.querySelector('#lib-cover-progress').textContent.includes('Search complete.'), null, { timeout: 10000 });
  check((await s.page.textContent('#modal')).includes('Knowing God'), 'an assigned librarian can run a cover search for all books');
  await click(s, '#modal [data-act="library:coverssaveall"]'); await s.settle();
  await finish(s);

  console.log('Six-month librarian review prompt (Administrator):');
  const reviewSeed = on(seedDocs());
  reviewSeed['settings/church'].librarianIds = ['p17', 'p14', 'p15'];
  reviewSeed['settings/church'].librarianReviewedAt = new Date(Date.now() - 181 * 86400000).toISOString();
  const reviewer = await session('linda.pillay@example.com', reviewSeed);
  await reviewer.go('home');
  check((await reviewer.text()).includes('Please review who is still a librarian'), 'the Administrator sees the due review reminder on Home');
  await reviewer.go('library');
  check((await reviewer.page.textContent('#modal')).includes('Review the librarians') && (await reviewer.page.textContent('#modal')).includes('Confirm All Still Active'), 'opening the Library prompts the Administrator to review the listed names');
  await click(reviewer, '[data-act="library:reviewconfirm"]'); await reviewer.settle(); docs = await reviewer.docsNow();
  const reviewedAt = Date.parse(docs['settings/church'].librarianReviewedAt);
  check(Number.isFinite(reviewedAt) && Date.now() - reviewedAt < 60000 && !(await reviewer.page.$('#modal [data-act="library:reviewconfirm"]')), 'Confirm All Still Active resets the six-month review timer');
  await reviewer.go('home');
  check(!(await reviewer.text()).includes('Please review who is still a librarian'), 'the review reminder is cleared after confirmation');
  await finish(reviewer);

  console.log('Terms of office, roles, co-opted members, messages to the Council and library reminders:');
  const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const yearsAgo = (y, plusDays) => { const d = new Date(); d.setFullYear(d.getFullYear() - y); d.setDate(d.getDate() + plusDays); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const seed2 = on(seedDocs());
  seed2['settings/church'].modules.messages = true;
  seed2['leaderBodies/lbT'] = { name: 'Church Council', open: true, termYears: 3, maxTerms: 2, breakYears: 1, memberIds: ['p14', 'p15'], names: { p14: 'Tim Jacobs', p15: 'Clare Jacobs' },
    seats: { p14: { role: 'Chair', roles: ['Chair', 'Treasurer'], title: '', portfolios: [], kind: '', from: yearsAgo(3, 60), to: '' }, p15: { role: '', roles: [], title: '', portfolios: [], kind: 'coopted', from: yearsAgo(1, 0), to: '' } }, past: [] };
  seed2['libraryPolicy/policy'] = { text: '# Borrowing\n- Three weeks at a time\n- **Return it clean**' };
  seed2['books/bT'] = { kind: 'Book', title: 'Mere Christianity', author: 'C. S. Lewis', copies: 1, out: 1 };
  seed2['loans/lnT'] = { bookId: 'bT', title: 'Mere Christianity', personId: 'p14', name: 'Tim Jacobs', mobile: '082 000 1414', visitor: false, out: day(-23), due: day(5), back: '', note: '' };
  s = await session('linda.pillay@example.com', seed2); await s.go('leaders'); t = await s.text();
  check(/terms? of office ends? soon[\s\S]*The term of Tim Jacobs on Church Council expires .*in \d+ days · Eligible to stand for another term \(Term 1 of 2\)/.test(t), 'within 120 days of expiry, the Administrator is told the date, time remaining and re-election status');
  await click(s, '.lb-panel details.cg-fold[data-k="lb-lbT:c"] > summary');
  check(/Tim Jacobs\s*Chair\s*Treasurer/.test(t) && /Clare Jacobs\s*Co-opted Member/.test(t) && t.includes('3-year terms, at most 2 terms in a row, then a 1-year break'), 'more than one role on the Council; a co-opted member; the group’s term rules');
  check((await s.page.$$('.lb-panel .term-bar')).length === 2 && /Term 1 of 2 · \d+% through · Ends/.test(t) && !!(await s.page.$('.term.soon')), 'a bar shows how far each leader is through which term');
  await click(s, '[data-act="leaders:renew"][data-id="p14"]'); await s.settle(); docs = await s.docsNow();
  check(docs['leaderBodies/lbT'].seats.p14.term === 2 && !!docs['leaderBodies/lbT'].seats.p14.termFrom && /Term 2 of 2/.test(await s.text()), 'their next term is started (the second of two)');
  await click(s, '.lb-panel details.cg-fold[data-k="lb-lbT:m"] > summary'); await click(s, '[data-act="leaders:seat"][data-id="p15"]'); await s.page.waitForSelector('#lb-role');
  await click(s, '[data-act="leaders:addrole"][data-r="Secretary"]'); await fill(s, '#lb-role', (await s.page.inputValue('#lb-role')) + ', Youth rep');
  await click(s, '[data-act="leaders:saveseat"]'); await s.settle(); docs = await s.docsNow();
  check(docs['leaderBodies/lbT'].seats.p15.roles.join() === 'Secretary,Youth rep' && docs['leaderBodies/lbT'].seats.p15.kind === 'coopted', 'roles are chosen or typed, several at once; co-opted stays');
  await click(s, '[data-act="leaders:seat"][data-id="p15"]'); await s.page.waitForSelector('#lb-kind');
  check((await s.page.locator('#lb-kind option').allTextContents()).join('|') === 'Elected Member|Co-opted Member|Other', 'membership offers elected, co-opted and other');
  await select(s, '#lb-kind', 'other');
  check(await s.page.locator('#lb-kind-other-wrap').isVisible() && await s.page.locator('#lb-kind-other').getAttribute('required') !== null, 'Other opens a required description field');
  await click(s, '[data-act="leaders:saveseat"]'); await s.settle();
  check((await s.docsNow())['leaderBodies/lbT'].seats.p15.kind === 'coopted', 'cannot save Other without its description');
  await fill(s, '#lb-kind-other', 'Community representative');
  await click(s, '[data-act="leaders:saveseat"]'); await s.settle(); docs = await s.docsNow(); t = await s.text();
  check(docs['leaderBodies/lbT'].seats.p15.kind === 'other' && docs['leaderBodies/lbT'].seats.p15.kindOther === 'Community representative' && t.includes('Other: Community representative'), 'Other membership type and its description are saved and shown');
  await s.go('people/p/p14'); t = await s.text();
  check(t.includes('Chair, Treasurer, Elected Member · Church Council') && !!(await s.page.$('a.tag-link[href="#/leaders"]')), 'a person’s page shows their leadership role and membership type as a chip');
  await s.go('library'); t = await s.text();
  check(/Mere Christianity\s*Reminder due/.test(t) && t.includes('had for 23 days'), 'three weeks after it was borrowed, the librarian sees a reminder is due and how long they have had it');
  await click(s, '[data-act="library:remind"][data-id="lnT"]'); await s.page.waitForSelector('#lib-rem');
  check((await s.page.inputValue('#lib-rem')).includes('“Mere Christianity” for 23 days') && !!(await s.page.$('[data-act="library:remindsend"][data-how="wa"]')), 'the reminder names the item and the days, ready to send by WhatsApp or SMS');
  await click(s, '[data-act="library:remindsend"][data-how="app"]'); await s.settle(); docs = await s.docsNow();
  check(docs['loans/lnT'].reminded === day(0) && !/Mere Christianity\s*Reminder due/.test(await s.text()), 'sending it is noted; it isn’t due again for a week');
  await click(s, '[data-act="library:policy"]'); await s.page.waitForSelector('#lib-pol');
  await click(s, '.lib-legend > summary');
  check((await s.page.$$('.lib-legend-t tbody tr')).length === 7 && !!(await s.page.$('.lib-legend-t td.lib-doc h3')) && !!(await s.page.$('.lib-legend-t td.lib-doc i')), 'editing the policy: a legend shows what to type and how it will look');
  await click(s, '#lib-pol-prev-box > summary'); await fill(s, '#lib-pol', '# Rules\n- **One** at a time'); await s.page.waitForTimeout(400);
  check((await s.page.textContent('#lib-pol-prev h3')) === 'Rules' && (await s.page.textContent('#lib-pol-prev b')) === 'One', '…and a preview follows what is typed');
  await click(s, '#modal [data-act="hub:close"]');
  const live2 = JSON.parse(JSON.stringify(docs));
  await finish(s);

  console.log('The Senior Pastor (Rector):');
  const seed3 = JSON.parse(JSON.stringify(seed2)); seed3['settings/church'].seniorPastorId = 'p03';
  s = await session('pieter.vanwyk@example.com', seed3); await s.go('home'); t = await s.text();
  check(/The term of Tim Jacobs on Church Council expires .*in \d+ days · Eligible to stand for another term \(Term 1 of 2\)/.test(t), 'the Rector is told the expiry date, time remaining and re-election status');
  await finish(s);

  console.log('A Council member (Basic access):');
  s = await session('tim.jacobs@example.com', live2); await s.go('me'); await s.page.waitForTimeout(300); t = await s.page.textContent('.me-chips');
  check(t.includes('Chair, Treasurer, Elected Member · Church Council') && t.includes('1 library item borrowed') && !!(await s.page.$('.me-chips a[href="#/library"]')) && !!(await s.page.$('.me-chips a[href="#/leaders"]')), 'the Me page shows their leadership role and membership type and their borrowed books as chips that open those pages');
  await s.go('home'); t = await s.text();
  check(t.includes('Friendly reminder: you have had “Mere Christianity” from the church library for 23 days') && !t.includes('The term of'), 'a friendly reminder on their To do list (terms of office are for the Administrators and the Rector)');
  await s.go('library'); t = await s.text();
  check(/Mere Christianity[\s\S]*had for 23 days[\s\S]*Friendly reminder/.test(t), 'the Library shows how long they have had it');
  check(await s.page.isVisible('[data-act="library:policyread"]') && !(await s.page.$('#lib-policy')), 'everyone can open the compact Library policy link without a prominent policy block');
  await click(s, '[data-act="library:policyread"]'); await s.page.waitForSelector('#modal article.lib-doc');
  check(((await s.page.textContent('#modal')) || '').includes('Three weeks at a time'), '…it opens in a policy view');
  check((await s.page.textContent('#modal article.lib-doc h3')) === 'Borrowing' && (await s.page.$$('#modal article.lib-doc li')).length === 2 &&
    (await s.page.textContent('#modal article.lib-doc b')) === 'Return it clean', 'the policy is formatted: a heading, a list, bold');
  await click(s, '#modal [data-act="hub:close"]');
  await s.go('leaders'); await click(s, 'a[href="#/messages/send/leaders/lbT"]'); await s.page.waitForSelector('#ms-body');
  check((await s.page.inputValue('#ms-to')) === 'leaders/lbT', 'a Council member can message the whole Council');
  await fill(s, '#ms-body', 'Council meets on Thursday.'); await click(s, '[data-act="messages:send"]'); await s.page.waitForTimeout(300);
  const sendBtn = await s.page.$('#modal [data-act="messages:sendnow"]'); if (sendBtn) { await sendBtn.click(); } await s.settle();
  docs = await s.docsNow(); const sentKey = find(docs, 'messages', d => d.body === 'Council meets on Thursday.');
  check(!!sentKey && docs[sentKey].kind === 'leaders' && docs[sentKey].to.join() === 'p14,p15', 'it goes to everyone on the Council');
  await s.go('messages/sent'); await click(s, 'details.msg-read > summary'); t = await s.text();
  check(/Read by 0 of 1[\s\S]*Not delivered yet\s*Clare Jacobs/.test(t), 'the sender sees who has read it and who hasn’t');
  await finish(s);
};
