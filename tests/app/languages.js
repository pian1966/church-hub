/* Church Hub – browser test, part: away dates (kind of leave and reason), languages, and better wording from the church (Translations).
 * One part of tests/app.test.js, which starts the browser and runs every part in turn: node tests/app.test.js */
'use strict';
module.exports = async function (ctx) {
  const { check, finish, seedDocs, session } = ctx;
  let docs, s;
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

  console.log('Translations (suggesting and checking better wording):');
  s = await session('tim.jacobs@example.com', seedDocs());
  await s.go('rosters/mine'); await s.page.selectOption('.side-lang .lang-sel', 'zu'); await s.page.waitForTimeout(80);
  check(!!(await s.page.$('.improve a')), 'in another language, every page offers to improve its wording');
  await s.page.click('.improve a'); await s.page.waitForTimeout(80);
  const onPage = await s.page.$$eval('#w-list .item small', x => x.map(e => e.textContent));
  check(onPage.length > 3 && onPage.some(x => x.includes('My serving')) && !onPage.some(x => x.includes('Shaded boxes')), '…which lists the texts that were on that page');
  await s.page.fill('#w-q', 'sign out'); await s.page.waitForTimeout(500);
  await s.page.click('#w-list [data-act="words:suggest"]'); await s.page.fill('#w-text', 'Phuma'); await s.page.click('[data-act="words:send"]');
  check((await s.page.textContent('#w-err')).length > 0, 'the same wording as now isn’t sent');
  await s.page.fill('#w-text', 'Phuma {name}'); await s.page.click('[data-act="words:send"]');
  check(await s.page.$eval('#w-err', e => !e.hidden), 'a suggestion that adds or loses a {part} isn’t sent');
  await s.page.fill('#w-text', 'Phuma manje'); await s.page.fill('#w-note', 'shorter'); await s.page.click('[data-act="words:send"]'); await s.settle();
  docs = await s.docsNow();
  let idea = Object.keys(docs).filter(k => k.startsWith('wordIdeas/')).map(k => docs[k]).find(w => w.text === 'Phuma manje');
  check(!!idea && idea.lang === 'zu' && idea.en === 'Sign out' && idea.personId === 'p14' && idea.status === 'waiting' && idea.note === 'shorter', 'a member sends a suggestion, saved as theirs and waiting to be checked');
  check((await s.text()).includes('Phuma manje') && !(await s.page.$('a[href="#/words/check"]')), '…sees it under their suggestions, and has nothing to check');
  await finish(s);

  s = await session('linda.pillay@example.com', seedDocs());
  await s.go('words/checkers'); await s.page.selectOption('#w-who', 'p14'); await s.page.selectOption('#w-l2', 'zu'); await s.page.click('[data-act="words:addchecker"]'); await s.settle();
  docs = await s.docsNow();
  check((docs['roles/tim.jacobs@example.com'].langs || []).join() === 'zu' && docs['roles/tim.jacobs@example.com'].role === 'member' && (docs['people/p14'].reviewLangs || []).join() === 'zu', 'an Administrator makes Tim the isiZulu checker (on his access-list entry)');
  check((await s.text()).includes('Tim Jacobs'), '…and sees who checks which language');
  await finish(s);

  const tDocs = seedDocs();
  tDocs['roles/tim.jacobs@example.com'].langs = ['zu'];
  tDocs['wordIdeas/wC'] = { lang: 'zu', en: 'Sign out', text: 'Phuma manje', personId: 'p15', name: 'Clare Jacobs', status: 'waiting', createdAt: '2026-10-29 10:00' };
  tDocs['wordIdeas/wA'] = { lang: 'af', en: 'Sign out', text: 'Teken uit', personId: 'p15', name: 'Clare Jacobs', status: 'waiting', createdAt: '2026-10-29 10:01' };
  s = await session('tim.jacobs@example.com', tDocs);
  check((await s.text()).includes('1 wording suggestion to check'), 'a checker gets a to-do for suggestions in their language only');
  await s.go('words/check'); let tc = await s.text();
  check(tc.includes('Phuma manje') && !tc.includes('Teken uit') && tc.includes('Clare Jacobs'), '…and sees who suggested what (not the other languages)');
  await s.page.click('[data-act="words:use"]'); await s.settle();
  docs = await s.docsNow();
  check(docs['words/zu'] && docs['words/zu'].words['Sign out'] === 'Phuma manje' && docs['wordIdeas/wC'].status === 'used' && docs['wordIdeas/wC'].reviewedBy === 'Tim Jacobs', '“Use this” puts the wording in use and marks the suggestion');
  await s.page.selectOption('.side-lang .lang-sel', 'zu'); await s.page.waitForTimeout(80);
  check((await s.page.getAttribute('.side [data-act="hub:signout"]', 'title')) === 'Phuma manje', 'everyone now sees the new wording, without a new version of the app');
  await s.go('words/check'); await s.page.click('main details summary'); await s.page.click('[data-act="words:revert"]'); await s.page.click('[data-act="words:revert"]'); await s.settle();
  docs = await s.docsNow();
  check(!docs['words/zu'] && (await s.page.getAttribute('.side [data-act="hub:signout"]', 'title')) === 'Phuma', '“Go back to the original” undoes it');
  await finish(s);

};
