/* Church & Trellis – browser test, part: Undo and Version history (js/history.js, js/history-ui.js, js/store.js; firestore.rules history).
 * The rules are tested in tests/history.test.js. One part of tests/app.test.js, which starts the browser and runs every part in turn: node tests/app.test.js */
'use strict';
module.exports = async function (ctx) {
  const { check, finish, seedDocs, session, fillHome } = ctx;
  console.log('Undo and Version history:');
  const seed = seedDocs(), was = seed['people/p15'].firstName;
  let s = await session('linda.pillay@example.com', seed); await s.go('people/p/p15'); await s.page.waitForSelector('main h1');

  // A change becomes a version, and Undo takes it back
  await s.page.click('[data-act="people:edit"]'); await fillHome(s);
  await s.page.fill('#pf-first', 'Wrongname'); await s.page.click('[data-act="people:save"]'); await s.settle();
  let docs = await s.docsNow(), vs = Object.keys(docs).filter(k => /^history\//.test(k)).map(k => docs[k]);
  check(docs['people/p15'].firstName === 'Wrongname', 'the change is saved');
  const v = vs.find(x => x.c === 'people' && x.rid === 'p15');
  check(!!v && v.kind === 'edit' && v.before.firstName === was && v.after.firstName === 'Wrongname' && v.fields.indexOf('firstName') >= 0, '… and kept as a version, with before and after');
  check(!!v && !('medical' in (v.before || {})) && !('photo' in (v.before || {})) && v.by === seed['roles/linda.pillay@example.com'].personId, '… without private parts, by the person who changed it');
  await s.page.waitForSelector('#undo-bar:not([hidden]) [data-undo]', { timeout: 6000 });
  check(true, 'the Undo bar appears after the change');
  await s.page.click('#undo-bar [data-undo]'); await s.settle();
  docs = await s.docsNow();
  check(docs['people/p15'].firstName === was, 'Undo puts the name back');
  check(Object.keys(docs).some(k => /^history\//.test(k) && docs[k].kind === 'restore' && docs[k].rid === 'p15'), '… and the history says it was put back');
  check(Object.keys(docs).some(k => /^audit\//.test(k) && /^Undid a change/.test(docs[k].action)), '… and it is in the audit log');

  // Version history on the person's page: put one field back
  await s.page.click('[data-act="people:edit"]'); await fillHome(s);
  await s.page.fill('#pf-last', 'Mistake'); await s.page.click('[data-act="people:save"]'); await s.settle();
  await s.go('people/p/p15'); await s.page.waitForSelector('main h1');
  await s.page.click('[data-history="people"]');
  await s.page.waitForSelector('#modal .hist-list', { timeout: 6000 });
  const htext = await s.page.textContent('#modal');
  check(htext.includes('Version history') && htext.includes('Last name') && htext.includes('Mistake'), 'Version history lists the changes and what changed');
  await s.page.click('#modal .hist-row details summary');
  await s.page.click('#modal [data-hist-field][data-f="lastName"]'); await s.settle();
  docs = await s.docsNow();
  check(docs['people/p15'].lastName === seed['people/p15'].lastName, 'one field can be put back');
  await finish(s);

  // A Pastor sees the history too; a member's own change is kept, but members can't read versions
  s = await session('thandi.mokoena@example.com', await (async () => { const d = seedDocs(); d['history/hv1'] = v; return d; })());
  await s.go('people/p/p15'); await s.page.waitForSelector('main h1');
  check(!!(await s.page.$('[data-history="people"]')), 'a Pastor has Version history on a person’s page');
  await finish(s);

  // A member: no Version history button (they can't read versions)
  s = await session('tim.jacobs@example.com', seedDocs()); await s.go('people/p/' + seedDocs()['roles/tim.jacobs@example.com'].personId); await s.page.waitForSelector('main h1');
  check(!(await s.page.$('[data-history]')), 'a member has no Version history button');
  await finish(s);

  // Versions older than 90 days are cleared out by an Administrator's app (once a day)
  const old = seedDocs();
  old['history/hvOld'] = Object.assign({}, v, { id: 'hvOld', at: '2025-01-01 10:00' });
  old['history/hvNew'] = Object.assign({}, v, { id: 'hvNew', at: new Date().toISOString().slice(0, 16).replace('T', ' ') });
  s = await session('linda.pillay@example.com', old); await s.page.waitForSelector('main h1');
  await s.page.evaluate(() => { try { localStorage.removeItem('church_hub_pref_historyTidy'); } catch (e) {} return Store.historyTidy(); }); await s.settle();
  docs = await s.docsNow();
  check(!docs['history/hvOld'] && !!docs['history/hvNew'], 'versions older than 90 days are cleared out; newer ones stay');
  await finish(s);
};
