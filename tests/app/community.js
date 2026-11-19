/* Church & Trellis – browser test, part: the Community board and the Marketplace, looked after by keepers (js/mod-board.js,
 * js/mod-market.js, js/community-ui.js; the rules are tested in tests/community.test.js and tests/rules.test.mjs).
 * One part of tests/app.test.js, which starts the browser and runs every part in turn: node tests/app.test.js */
'use strict';
module.exports = async function (ctx) {
  const { check, finish, seedDocs, session } = ctx;
  console.log('Community board and Marketplace:');
  const seed = seedDocs();
  // Tim, a Church Partner: sees what is live (not Sam's notice, still waiting), pins one of his own
  let s = await session('tim.jacobs@example.com', seed, { ua: 'Mozilla/5.0 (Linux; Android 14) Mobile' });
  await s.go('board'); let t = await s.text();
  check(/Lost: a blue umbrella/.test(t) && /Lifts to the 10am from Hilton/.test(t) && !/kittens/.test(t), 'a Church Partner sees the live notices on the board, not one still waiting for a keeper');
  check(await s.page.$$eval('.cork .note', n => n.length) === 4, 'four sticky notes on the corkboard');
  await s.page.click('[data-act="board:pin"]'); await s.page.waitForSelector('#bd-title');
  await s.page.click('[data-act="board:pick"][data-k="offer"]');
  check(await s.page.inputValue('#bd-kind') === 'offer' && await s.page.$eval('.bd-preview .note', n => n.className.includes('k-offer')), 'choosing the kind colours the preview note');
  await s.page.click('[data-act="board:save"]');
  check(/Give your notice a title/.test(await s.page.textContent('#bd-err')), 'a notice needs a title');
  await s.page.fill('#bd-title', 'Spare seat to the 8am'); await s.page.fill('#bd-body', 'From Merrivale'); await s.page.click('[data-act="board:save"]'); await s.settle();
  let docs = await s.docsNow(), mine = Object.keys(docs).filter(k => k.startsWith('board/') && docs[k].title === 'Spare seat to the 8am').map(k => docs[k]);
  check(mine.length === 1 && mine[0].status === 'waiting' && mine[0].personId === 'p14' && mine[0].kind === 'offer' && mine[0].name === 'Tim', 'pinned: saved as waiting for a keeper, with his first name');
  check(/Waiting for a keeper/.test(await s.text()), 'his own note shows “Waiting for a keeper”');
  await s.go('home'); t = await s.text();
  check(/Latest on the Community board/.test(t) && await s.page.$$eval('.cm-home .note', n => n.length) === 3, 'Home shows the latest 3 notices');
  await s.go('me'); check(/Latest on the Community board/.test(await s.text()), '…and so does Me');
  await s.go('market'); t = await s.text();
  check(/Pine bookshelf/.test(t) && /R450/.test(t) && /Free/.test(t) && !/Electric kettle/.test(t), 'the Marketplace shows live listings with their prices, not one waiting');
  await s.page.click('[data-act="market:list"]'); await s.page.waitForSelector('#mk-title');
  await s.page.fill('#mk-title', 'Lawnmower'); await s.page.fill('#mk-price', '600'); await s.page.click('[data-act="market:save"]'); await s.page.waitForTimeout(200);
  check(/accept the Marketplace rules/.test(await s.page.textContent('#mk-err')), 'the Marketplace rules must be accepted first');
  await s.page.check('#mk-ok'); await s.page.click('[data-act="market:save"]'); await s.settle();
  docs = await s.docsNow(); const mower = Object.keys(docs).find(k => k.startsWith('market/') && docs[k].title === 'Lawnmower');
  check(!!mower && docs[mower].status === 'waiting' && docs[mower].price === 600 && docs[mower].kind === 'sale', 'listed: waiting for a keeper, R600 for sale');
  await finish(s);

  // Thandi, a Pastor – one of the first keepers: approves Sam's kittens and asks Tim for a change
  s = await session('thandi.mokoena@example.com', seed);
  await s.go('board/waiting'); t = await s.text();
  check(/Free to a good home: kittens/.test(t) && /Notices waiting for a keeper/.test(t), 'a keeper sees what is waiting');
  await s.page.click('[data-act="board:decide"][data-id="bn5"][data-a="approve"]'); await s.settle();
  docs = await s.docsNow();
  check(docs['board/bn5'].status === 'live' && docs['board/bn5'].by === 'Thandi', 'approved: the notice is live');
  const told = Object.keys(docs).filter(k => k.startsWith('messages/') && docs[k].about === 'board' && docs[k].aboutId === 'bn5');
  check(told.length === 1 && docs[told[0]].to.join() === 'p19' && /Your notice is up/.test(docs[told[0]].title), 'Sam is told in Messages that the notice is up');
  await s.go('market/waiting'); await s.page.click('[data-act="market:decide"][data-id="mk5"][data-a="change"]'); await s.page.waitForSelector('#cm-note');
  await s.page.click('[data-act="market:decided"]'); check(/short note/.test(await s.page.textContent('#cm-note-err')), 'asking for a change needs a note');
  await s.page.fill('#cm-note', 'Please add a photo'); await s.page.click('[data-act="market:decided"]'); await s.settle();
  docs = await s.docsNow(); check(docs['market/mk5'].status === 'change' && docs['market/mk5'].note === 'Please add a photo', 'asked for a change, with the note');
  await finish(s);

  // Sipho (Roster coordinator, not a keeper): writes privately to Tim about his notice, and reports one
  s = await session('sipho.dlamini@example.com', seed);
  await s.go('board/waiting'); check(!/Notices waiting for a keeper/.test(await s.text()), 'someone who isn’t a keeper has no “Waiting for approval”');
  await s.go('board'); await s.page.click('.note-in[data-id="bn1"]'); await s.page.waitForSelector('[data-act="board:contact"]');
  await s.page.click('[data-act="board:contact"]'); await s.page.fill('#cm-msg', 'My cousin is a plumber in Howick'); await s.page.click('[data-act="board:send"]'); await s.settle();
  docs = await s.docsNow(); const m = Object.keys(docs).map(k => docs[k]).find(x => x.about === 'board' && x.aboutId === 'bn1');
  check(!!m && m.kind === 'direct' && m.to.join() === 'p14' && m.fromId === 'p05' && /cousin/.test(m.body), '“I can help” is a private message to the person who pinned it');
  await s.page.click('.note-in[data-id="bn4"]'); await s.page.click('.dlg-foot details.menu summary'); await s.page.click('[data-act="board:report"]'); await s.settle();
  docs = await s.docsNow(); check((docs['board/bn4'].reports || []).join() === 'p05', 'a report reaches the keepers');
  await finish(s);

  // Linda (Administrator) chooses the keepers; an attendee never sees either part
  s = await session('linda.pillay@example.com', seed);
  await s.go('board'); await s.page.click('details.menu summary'); await s.page.click('[data-act="board:keepers"]'); await s.page.waitForSelector('#cm-keeper-list');
  check(await s.page.$$eval('#cm-keeper-list .item', n => n.length) >= 3, 'Keepers… lists the first keepers (Administrators and Pastors)');
  await s.page.fill('.cg-q[data-for="cm-keepers"]', 'Megan'); await s.page.waitForSelector('[data-act="board:keeperin"]'); await s.page.click('[data-act="board:keeperin"]'); await s.settle();
  docs = await s.docsNow(); check((docs['settings/church'].keepers || {}).board.includes('p17'), 'adding a keeper saves the church’s own list');
  await finish(s);
  s = await session('jason.naidoo@example.com', seed);
  await s.go('home'); t = (await s.page.textContent('body')) || '';
  check(!/Community board/.test(t) && !/Marketplace/.test(t), 'an attendee sees neither the Community board nor the Marketplace');
  await finish(s);
};
