/* Church Hub – browser test, part: Leadership (Council, elders, leaders), the Archive (church records) and the Library.
 * One part of tests/app.test.js, which starts the browser and runs every part in turn: node tests/app.test.js */
'use strict';
module.exports = async function (ctx) {
  const { check, finish, seedDocs, session, PNG } = ctx;
  let docs, s, t, key;
  const find = (d, coll, fn) => Object.keys(d).find(k => new RegExp('^' + coll + '/[^/]+$').test(k) && fn(d[k]));
  const b64 = PNG.buffer.toString('base64');
  const on = seed => { seed['settings/church'].modules = Object.assign({}, seed['settings/church'].modules, { leaders: true, archive: true, library: true }); return seed; };

  console.log('Leadership (Administrator):');
  s = await session('linda.pillay@example.com', seedDocs()); await s.go('home');
  check(!(await s.page.$('nav a[href="#/leaders"]')) && !(await s.page.$('nav a[href="#/archive"]')) && !(await s.page.$('nav a[href="#/library"]')), 'Leadership, the Archive and the Library are off until an Administrator switches them on');
  await s.go('settings/apps');
  for (const m of ['leaders', 'archive', 'library']) { await s.page.check('.st-mod[value="' + m + '"]'); await s.settle(); }
  docs = await s.docsNow();
  check(['leaders', 'archive', 'library'].every(m => docs['settings/church'].modules[m] === true) && !!(await s.page.$('nav a[href="#/leaders"]')) && !!(await s.page.$('nav a[href="#/archive"]')) && !!(await s.page.$('nav a[href="#/library"]')), 'switched on under Settings → Apps: their pages appear');
  await s.go('leaders'); await s.page.fill('#lb-new', 'Church Council'); await s.page.click('[data-act="leaders:addgroup"]'); await s.settle();
  docs = await s.docsNow(); key = find(docs, 'leaderBodies', d => d.name === 'Church Council'); const lb = key ? key.split('/')[1] : '';
  check(!!key && docs[key].open === true && docs[key].memberIds.length === 0, 'a leadership group is added, seen by everyone until that is changed');
  const add = async (who, role, title, port) => {
    await s.page.fill('.cg-q[data-for="lb-' + lb + '"]', who); await s.page.waitForTimeout(400); await s.page.click('.cg-hits .cg-pick'); await s.page.waitForSelector('#lb-role');
    await s.page.fill('#lb-role', role); await s.page.fill('#lb-title', title); await s.page.fill('#lb-port', port); await s.page.click('[data-act="leaders:saveseat"]'); await s.settle();
  };
  await add('tim jac', 'Chair', 'Churchwarden', 'Finance, Buildings'); await add('clare', 'Secretary', '', '');
  docs = await s.docsNow(); t = await s.text();
  check(docs[key].memberIds.join() === 'p14,p15' && docs[key].seats.p14.role === 'Chair' && docs[key].seats.p14.title === 'Churchwarden' && docs[key].seats.p14.portfolios.join() === 'Finance,Buildings' && docs[key].names.p15 === 'Clare Jacobs',
    'people are added with a role, a title and portfolios');
  check(/Tim Jacobs\s*Chair[\s\S]*Churchwarden · Finance · Buildings[\s\S]*Clare Jacobs\s*Secretary/.test(t), 'the group lists them, office-bearers first');
  await s.page.click('[data-act="leaders:group"][data-id="' + lb + '"]'); await s.page.uncheck('#lb-open'); await s.page.click('[data-act="leaders:savegroup"]'); await s.settle();
  await s.page.click('[data-act="leaders:ending"][data-g="' + lb + '"][data-id="p15"]'); await s.page.fill('#lb-end', '2026-10-31'); await s.page.click('[data-act="leaders:end"][data-keep="1"]'); await s.settle();
  docs = await s.docsNow(); t = await s.text();
  check(docs[key].open === false && docs[key].memberIds.join() === 'p14' && docs[key].past.length === 1 && docs[key].past[0].name === 'Clare Jacobs' && docs[key].past[0].role === 'Secretary' && docs[key].past[0].to === '2026-10-31' && t.includes('Members only') && t.includes('Served before (1)'),
    'a group can be for its members only; someone whose time has ended moves to “Served before”');

  console.log('Archive (Administrator):');
  await s.go('archive'); t = await s.text();
  check(t.includes('No records yet.'), 'the Archive starts empty');
  await s.page.click('[data-act="archive:add"]'); await s.page.waitForSelector('#ar-title');
  check((await s.page.inputValue('#ar-cat')) === 'minutes' && (await s.page.inputValue('#ar-access')) === 'body' && (await s.page.inputValue('#ar-body')) === lb && await s.page.isHidden('#ar-about-wrap'), 'a new record starts as Council minutes, for the Council to see');
  await s.page.click('[data-act="archive:save"]');
  check(!(await s.page.isHidden('#ar-err')) && !!(await s.page.$('#ar-title')), 'a record needs a title');
  await s.page.fill('#ar-title', 'Council minutes – October'); await s.page.fill('#ar-date', '2026-10-13'); await s.page.click('[data-act="archive:save"]');
  check(!(await s.page.isHidden('#ar-err')) && !!(await s.page.$('#ar-title')), '… and a file or a link');
  await s.page.setInputFiles('#ar-file', PNG); await s.page.click('[data-act="archive:save"]'); await s.settle();
  docs = await s.docsNow(); key = find(docs, 'archive', d => d.cat === 'minutes'); const ar = key ? key.split('/')[1] : '';
  check(!!key && docs[key].access === 'body' && docs[key].bodyId === lb && docs[key].shownTo === '' && docs[key].file.name === 'face.png' && docs[key].file.parts === 1 && docs[key].date === '2026-10-13', 'the minutes are saved for the Council');
  check(!!docs['archive/' + ar + '/parts/0'] && docs['archive/' + ar + '/parts/0'].data === b64, 'the file is kept apart from the record, in parts');
  await s.page.click('[data-act="archive:add"]'); await s.page.waitForSelector('#ar-title');
  await s.page.selectOption('#ar-cat', 'contracts');
  check((await s.page.inputValue('#ar-access')) === 'private' && await s.page.isHidden('#ar-body-wrap') && !(await s.page.isHidden('#ar-about-wrap')), 'a staff contract starts private, and asks which staff member it is about');
  await s.page.fill('#ar-title', 'Contract of employment'); await s.page.selectOption('#ar-about', 'p06'); await s.page.setInputFiles('#ar-file', PNG); await s.page.click('[data-act="archive:save"]'); await s.settle();
  await s.page.click('[data-act="archive:add"]'); await s.page.waitForSelector('#ar-title');
  await s.page.selectOption('#ar-cat', 'plans'); await s.page.fill('#ar-title', 'Hall extension plans'); await s.page.fill('#ar-link', 'drive.google.com/hall-plans'); await s.page.click('[data-act="archive:save"]'); await s.settle();
  docs = await s.docsNow(); const con = find(docs, 'archive', d => d.cat === 'contracts'), plan = find(docs, 'archive', d => d.cat === 'plans');
  check(!!con && docs[con].access === 'private' && docs[con].aboutId === 'p06' && docs[con].aboutName === 'Lerato Khumalo' && docs[con].shownTo === 'p06' && docs[con].bodyId === '', 'the contract is private, and shown to the staff member it is about');
  check(!!plan && docs[plan].access === 'office' && docs[plan].link === 'https://drive.google.com/hall-plans' && !docs[plan].file, 'a record can be a link to where the file is kept');
  t = await s.text();
  check(t.includes('Council minutes – October') && t.includes('Church Council') && t.includes('Shown to Lerato Khumalo') && t.includes('Administrators and the Senior Pastor only'), 'each record says who can see it');
  const [dl] = await Promise.all([s.page.waitForEvent('download'), s.page.click('[data-act="archive:open"][data-id="' + ar + '"]')]);
  const got = ctx.fs.readFileSync(await dl.path()); await s.settle(); docs = await s.docsNow();
  check(dl.suggestedFilename() === 'face.png' && got.equals(PNG.buffer), 'the file downloads as it was added');
  check(Object.keys(docs).some(k => /^audit\//.test(k) && /Opened the archive record “Council minutes – October”/.test(docs[k].action)), 'opening a record that isn’t for everyone is written in the audit log');
  await s.page.fill('#ar-q', 'hall'); await s.page.waitForTimeout(100);
  check(await s.page.isVisible('.ar-item:has-text("Hall extension plans")') && await s.page.isHidden('.ar-item:has-text("Contract of employment")'), 'searching the archive');
  await s.page.fill('#ar-q', '');
  await s.page.click('[data-act="archive:cats"]'); await s.page.click('[data-act="archive:catadd"]');
  await s.page.fill('.ar-cat:last-child .ar-cn', 'Title deeds'); await s.page.selectOption('.ar-cat:last-child .ar-ca', 'private'); await s.page.click('[data-act="archive:catsave"]'); await s.settle();
  docs = await s.docsNow(); const acs = docs['settings/church'].archiveCats || [];
  check(acs.length === 6 && acs[5].name === 'Title deeds' && acs[5].access === 'private' && acs[0].name === 'Council minutes', 'the church adds its own categories');
  await s.page.click('[data-act="archive:del"][data-id="' + plan.split('/')[1] + '"]'); await s.page.click('[data-act="archive:del"][data-id="' + plan.split('/')[1] + '"]'); await s.settle();
  docs = await s.docsNow();
  check(!docs[plan], 'a record can be deleted');
  await s.go('leaders'); await s.page.click('[data-act="leaders:delgroup"][data-id="' + lb + '"]'); await s.page.click('[data-act="leaders:delgroup"][data-id="' + lb + '"]'); await s.settle();
  docs = await s.docsNow();
  check(!!docs['leaderBodies/' + lb], 'a leadership group with records in the Archive can’t be deleted');

  console.log('Library (Administrator):');
  await s.go('library'); await s.page.click('[data-act="library:add"]'); await s.page.waitForSelector('#lib-title');
  await s.page.fill('#lib-title', 'Knowing God'); await s.page.fill('#lib-author', 'J. I. Packer'); await s.page.fill('#lib-cat', 'Theology'); await s.page.selectOption('#lib-how', 'Donated'); await s.page.fill('#lib-from', 'The Jacobs family');
  await s.page.click('[data-act="library:save"]'); await s.settle();
  docs = await s.docsNow(); key = find(docs, 'books', d => d.title === 'Knowing God'); const bk = key ? key.split('/')[1] : '';
  check(!!key && docs[key].author === 'J. I. Packer' && docs[key].how === 'Donated' && docs[key].from === 'The Jacobs family' && docs[key].copies === 1 && docs[key].out === 0 && !!docs[key].acquired, 'a book is added, with how and when it was acquired');
  await s.page.click('[data-act="library:lend"][data-id="' + bk + '"]'); await s.page.fill('.cg-q[data-for="lib-lend"]', 'tim jac'); await s.page.waitForTimeout(400); await s.page.click('.cg-hits .cg-pick'); await s.settle();
  docs = await s.docsNow(); const loan = find(docs, 'loans', d => d.bookId === bk); t = await s.text();
  check(!!loan && docs[loan].personId === 'p14' && docs[loan].name === 'Tim Jacobs' && docs[loan].back === '' && docs[loan].due > docs[loan].out && docs[key].out === 1, 'it is lent to someone, due back in three weeks');
  check(/On loan[\s\S]*Knowing God[\s\S]*Tim Jacobs/.test(t) && await s.page.isDisabled('[data-act="library:lend"][data-id="' + bk + '"]'), 'the librarian sees who has it; the only copy can’t be lent again');
  await s.page.click('[data-act="library:libs"]'); await s.page.fill('.cg-q[data-for="lib-libs"]', 'megan'); await s.page.waitForTimeout(400); await s.page.click('.cg-hits .cg-pick'); await s.settle();
  docs = await s.docsNow();
  check((docs['settings/church'].librarianIds || []).join() === 'p17', 'an Administrator names the librarians');
  const live = JSON.parse(JSON.stringify(docs));
  await finish(s);

  // What each person sees of it all, carrying on from what the Administrator set up
  const as = async (email, senior) => { const seed = JSON.parse(JSON.stringify(live)); if (senior) seed['settings/church'].seniorPastorId = senior; const x = await session(email, seed); await x.go('archive'); await x.page.waitForTimeout(400); return x; };
  const sees = async x => { const tx = (await x.page.$('nav a[href="#/archive"]')) ? await x.text() : ''; return ['Council minutes – October', 'Contract of employment'].map(n => tx.includes(n) ? 'y' : 'n').join(''); };
  console.log('A Council member (Basic access):');
  s = await as('tim.jacobs@example.com');
  check((await sees(s)) === 'yn' && !(await s.page.$('[data-act="archive:add"]')) && !(await s.page.$('[data-act="archive:edit"]')), 'sees the Council’s minutes, not the staff contract, and can’t add or change records');
  const [dl2] = await Promise.all([s.page.waitForEvent('download'), s.page.click('[data-act="archive:open"][data-id="' + ar + '"]')]);
  check(ctx.fs.readFileSync(await dl2.path()).equals(PNG.buffer), 'and can download them');
  await s.go('leaders'); t = await s.text();
  check(t.includes('Church Council') && t.includes('Tim Jacobs') && !(await s.page.$('#lb-new')) && !(await s.page.$('[data-act="leaders:seat"]')), 'sees their own leadership group (though it is for members only), and can’t change it');
  await s.go('library'); t = await s.text();
  check(/My books[\s\S]*Knowing God[\s\S]*Due/.test(t) && !(await s.page.$('[data-act="library:add"]')) && !(await s.page.$('#lib-out')) && /Knowing God\s*On loan/.test(t), 'the Library shows the book they have out and when it is due – not the librarian’s tools');
  await finish(s);
  console.log('The staff member a contract is about:');
  s = await as('lerato.khumalo@example.com');
  check((await sees(s)) === 'ny', 'sees their own contract, not the Council’s minutes');
  await s.go('leaders'); t = await s.text();
  check(!t.includes('Church Council') && t.includes('No leadership groups yet.'), 'a members-only leadership group is hidden from everyone else');
  await finish(s);
  console.log('Someone else (Basic access), who is a librarian:');
  s = await as('megan.smith@example.com');
  check((await sees(s)) === 'nn' && !(await s.page.$('nav a[href="#/archive"]')), 'sees no records – the Archive isn’t on their menu at all');
  await s.go('library'); await s.page.waitForTimeout(400); t = await s.text();
  check(/On loan[\s\S]*Knowing God[\s\S]*Tim Jacobs/.test(t) && !!(await s.page.$('[data-act="library:add"]')) && !(await s.page.$('[data-act="library:libs"]')), 'as a librarian sees who has which book and can add books (but not name librarians)');
  await s.page.click('[data-act="library:back"]'); await s.settle(); docs = await s.docsNow(); t = await s.text();
  check(docs[loan].back !== '' && docs['books/' + bk].out === 0 && /Knowing God\s*Available/.test(t) && t.includes('Nothing on loan.'), 'marks the book as returned: it is available again');
  await finish(s);
  console.log('A Pastor, and the Senior Pastor:');
  s = await as('pieter.vanwyk@example.com');
  check((await sees(s)) === 'nn', 'a Pastor doesn’t see private records or a group’s they aren’t on');
  await finish(s);
  s = await as('pieter.vanwyk@example.com', 'p03');
  check((await sees(s)) === 'yy' && !!(await s.page.$('[data-act="archive:add"]')), 'the Senior Pastor sees every record and can add them');
  await finish(s);
};
