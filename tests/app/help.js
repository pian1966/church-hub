/* Church & Trellis – browser test, part: Help – ask a question about using Church & Trellis (js/help.js, js/mod-help.js), typed,
 * with and without AI (Gemini is a stand-in, as in tests/app/ask.js), and browsing the help pages by topic.
 * The rules (finding answers, what is sent, checking the reply) are tested in tests/help.test.js.
 * One part of tests/app.test.js, which starts the browser and runs every part in turn: node tests/app.test.js */
'use strict';
module.exports = async function (ctx) {
  const { check, finish, seedDocs, session } = ctx;
  console.log('Help (ask a question):');
  const ask = async (s, q) => { await s.page.fill('#help-q', q); await s.page.press('#help-q', 'Enter'); await s.page.waitForSelector('.help-answer:not(:has(.help-wait))', { timeout: 8000 }); await s.page.waitForTimeout(80); };
  const tiles = s => s.page.$$eval('.help-topic b', b => b.map(x => x.textContent));
  const phoneId = 'me/how-do-i-change-my-phone-number-email-or-address';

  /* ---------- without AI: the matching help pages ---------- */
  let s = await session('tim.jacobs@example.com', seedDocs());   // a member
  await s.go('help'); await s.page.waitForSelector('.help-tiles');
  check(await s.page.isVisible('#help-q') && (await s.page.$$('.help-chip')).length === 3, 'Help has a box for a question, with three questions to tap');
  check(!/sent to Google’s Gemini AI/.test(await s.text()), 'AI not switched on: nothing about Gemini');
  let t = await tiles(s);
  check(t.includes('Me') && t.includes('Library') && t.includes('Getting started') && !t.includes('Leave'), 'a member sees the topics that have something for members, not Leave: ' + t.join(', '));
  await ask(s, 'how do I change my phone number');
  check(/How do I change my phone number/.test(await s.page.textContent('.help-answer')) && await s.page.$eval('.help-answer details.help-q', d => d.open), 'without AI the matching help page is shown, open');
  check(/Change my details/.test(await s.page.textContent('.help-answer .help-a')) && !!(await s.page.$('.help-answer .help-a .ui-name')), '… with the button names shown as little buttons');
  await ask(s, 'how do I tell the church I am away on holiday');
  const names = await s.page.$$eval('.help-answer .help-a .ui-name', e => e.map(x => x.textContent));
  check(names.includes('Remove away dates') && !/\*\*/.test(await s.page.textContent('.help-answer')), 'a button name that runs over two lines in the help page is still shown as one button, with no ** left over: ' + names.join(' | '));
  await ask(s, 'zzzz qqqq xxxx');
  check(/couldn’t find an answer/.test(await s.page.textContent('.help-answer')) && !!(await s.page.$('.help-answer a[href="#/messages"]')), 'nothing matches: it says so and points to writing to the Office');
  await s.go('home'); await s.go('help'); await s.page.waitForSelector('.help-chip');
  check(await s.page.inputValue('#help-q') === '' && !(await s.page.$('.help-answer')), 'leaving Help forgets the question and its answer');
  await s.page.click('.help-chip >> nth=2'); await s.page.waitForSelector('.help-answer .help-q');
  check(/serving/i.test(await s.page.textContent('.help-answer')) && await s.page.inputValue('#help-q') === 'Where do I see when I’m serving?', 'tapping a question asks it');
  await s.page.click('.help-topic:has-text("Me")'); await s.page.waitForSelector('.help-list');
  const n = (await s.page.$$('.help-list details.help-q')).length;
  check(/#\/help\/me$/.test(s.page.url()) && n >= 5 && (await s.page.textContent('h1')).trim() === 'Me', 'a topic lists its questions (' + n + ')');
  await s.page.click('.help-list details.help-q >> nth=0 >> summary');
  check(await s.page.$eval('.help-list details.help-q', d => d.open), 'tapping a question opens its answer');
  // each answer ends with a button that does what it says: the screen its page is about (only if this person may open it)
  await s.go('help/me'); await s.page.waitForSelector('.help-list details.help-q');
  check(await s.page.$eval('.help-list details.help-q .help-from a.help-go', a => a.getAttribute('href') === '#/me' && /^Do this now/.test(a.textContent)), 'an answer ends with a small "Do this now" link, not the name of its topic');
  check((await s.page.$$('.help-list details.help-q a.ui-go')).length >= 1, 'a screen named in an answer (Me, Library…) can be tapped to go there');
  await s.page.$eval('.help-list details.help-q', d => { d.open = true; }); await s.page.click('.help-list details.help-q >> nth=0 >> .help-go');
  await s.page.waitForFunction(() => location.hash === '#/me');
  check(await s.page.isVisible('h1'), 'tapping it opens that screen');
  await s.go('help/getting-started'); await s.page.waitForSelector('.help-list details.help-q');
  check((await s.page.$$('.help-list .help-from a.help-go')).length >= 2 && (await s.page.$$('.help-list .help-from a:not(.help-go)')).length >= 5, 'where there is no screen to open, the topic link stays');
  await s.go('help/leave'); await s.page.waitForSelector('.help-back');
  check(/Nothing on this topic is for your kind of access/.test(await s.text()), 'a topic only for Administrators says so to a member');
  await finish(s);

  // An Administrator sees every topic
  s = await session('linda.pillay@example.com', seedDocs());
  await s.go('help'); await s.page.waitForSelector('.help-tiles');
  t = await tiles(s);
  const nPages = await s.page.evaluate(() => Help.PAGES.length);   // every page in docs/help/ (the test no longer needs changing when a page is added)
  check(t.length === nPages && nPages >= 18 && t.includes('Settings') && t.includes('Events') && t.includes('Subscription'), 'an Administrator sees all ' + nPages + ' topics');
  await finish(s);

  /* ---------- with AI: an answer written from the help pages ---------- */
  const seed = seedDocs(); seed['settings/church'].ai = { on: true, model: 'gemini-test' };
  const a = await session('tim.jacobs@example.com', seed), sent = [];
  let reply = null;
  await a.page.route(u => u.href.startsWith('https://firebasevertexai.googleapis.com/'), r => {
    sent.push({ url: r.request().url(), headers: r.request().headers(), body: r.request().postData() });
    if (!reply) return r.abort();   // the AI can't be reached
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(reply) }] } }] }) });
  });
  await a.page.evaluate(() => {
    window.CHURCH_HUB_FIREBASE.appCheckKey = 'test-site-key';
    window.firebase.appCheck = function () { return { activate: function () {}, getToken: function () { return Promise.resolve({ token: 'app-check-token' }); } }; };
    window.firebase.appCheck.ReCaptchaV3Provider = function (k) { this.k = k; }; window.firebase.appCheck.ReCaptchaEnterpriseProvider = function (k) { this.k = k; };
  });
  await a.go('help'); await a.page.waitForSelector('.help-tiles');
  check(/sent to Google’s Gemini AI/.test(await a.text()) && /No church records are sent/.test(await a.text()), 'AI on: the page says the question and a few help pages go to Gemini, and no records');

  reply = { found: true, answer: 'Open **Me** → **My details** and tap **Change my details**.\n1. Change what is wrong.\n2. Save.', sources: [phoneId, 'made/up-page'] };
  await ask(a, 'how can I change my cell number?');
  let req = sent[sent.length - 1], body = JSON.parse(req.body), what = JSON.stringify(body);
  check(/\/projects\/demo-church-hub\/models\/gemini-test:generateContent$/.test(req.url) && req.headers['x-firebase-appcheck'] === 'app-check-token', 'sent to Firebase AI Logic with the App Check token and the church’s model');
  check(what.includes('how can I change my cell number?') && what.includes(phoneId) && what.includes('Church Partner'), '… with the question, the matching help page and the kind of access');
  check(!/example\.com|tim\.jacobs|Pillay|Naidoo/.test(what), '… and nothing from the church’s records: no emails or names');
  check(body.contents[0].parts[0].text.length < 25000, '… only a few help pages (a clear match is not sent the whole help)');
  check(await a.page.$$eval('.help-text .ui-name', e => e.map(x => x.textContent).join('|')).then(x => /Me\|My details\|Change my details/.test(x)) && (await a.page.$$('.help-text li')).length === 2, 'the answer is shown with its steps and button names');
  check((await a.page.$$('.help-answer details.help-q')).length === 1 && /How do I change my phone number/.test(await a.page.textContent('.help-answer details.help-q')), '… with the help page it came from underneath – the made-up source is dropped');
  check(/Written by AI/.test(await a.page.textContent('.help-answer')), '… and says it was written by AI, from the pages below');

  reply = { found: false, answer: 'I could not find that.', sources: [] };
  await ask(a, 'how do I make a pizza');
  check(/couldn’t find an exact answer/.test(await a.page.textContent('.help-answer')) && !(await a.page.$('.help-text')), 'the AI says it can’t find it: no answer is shown');
  check(/Afrikaans|English/.test(JSON.parse(sent[sent.length - 1].body).contents[0].parts[0].text) && !/example\.com/.test(sent[sent.length - 1].body), '… and a question that matches nothing still sends no records');

  reply = { found: true, answer: 'Made up.', sources: ['not/a-page'] };
  await ask(a, 'how do I borrow a book');
  check(!(await a.page.$('.help-text')) && /couldn’t find an exact answer/.test(await a.page.textContent('.help-answer')), 'an answer that names no real help page is not shown');

  reply = null;
  await ask(a, 'how do I borrow a book');
  check(/couldn’t be reached/.test(await a.page.textContent('.help-answer')) && /How do I borrow a book/.test(await a.page.textContent('.help-answer')), 'the AI can’t be reached: it says so and shows the matching help pages');

  await a.page.evaluate(() => I18n.set('af'));
  reply = { found: true, answer: 'Maak **Me** oop.', sources: [phoneId] };
  await a.go('home'); await a.go('help'); await a.page.waitForSelector('.help-tiles');
  check(/Hulp/.test(await a.page.textContent('h1')), 'in Afrikaans the page is in Afrikaans');
  await ask(a, 'hoe verander ek my selfoonnommer');
  req = sent[sent.length - 1]; body = JSON.parse(req.body);
  check(/"language":"Afrikaans"/.test(body.contents[0].parts[0].text) && body.contents[0].parts[0].text.length > 25000, 'the language is sent, and a question in another language sends a wider choice of help pages');
  check(await a.page.textContent('.help-text .ui-name') === 'Ek', 'the names of buttons in an answer are shown in the person’s language (Me → Ek)');
  await finish(a);
};
