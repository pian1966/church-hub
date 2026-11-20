/* Church & Trellis – browser test, part: names from a sheet, a photo or the microphone – Events → From a sheet (typed names,
 * matched and checked), People → From a photo (Gemini a stand-in, as in tests/app/ask.js), saying a name (a stand-in for the
 * browser's speech recognition) in People's search and in Add people, and registering someone who isn't in People yet.
 * The rules are tested in tests/name-list.test.js. One part of tests/app.test.js: node tests/app.test.js */
'use strict';
module.exports = async function (ctx) {
  const { check, finish, seedDocs, session, PNG } = ctx;
  console.log('Names from a sheet, a photo or the microphone:');
  const seed = seedDocs(); seed['settings/church'].ai = { on: true, model: 'gemini-test' };
  // The browser's speech recognition, a stand-in: hears window.__say (what it thought it heard, best first)
  const ears = () => {
    window.SpeechRecognition = function () {
      const me = this; this.abort = function () {};
      this.start = function () { setTimeout(function () { const r = window.__say.map(t => ({ transcript: t })); r.isFinal = true; me.onresult({ results: [r] }); if (me.onend) me.onend(); }, 30); };
    };
  };

  // Thandi, a Pastor: a paper sign-up sheet for the Men's breakfast, typed in (no photo needed)
  let s = await session('thandi.mokoena@example.com', seed);
  await s.go('events/e/ev1');
  check(await s.page.isVisible('[data-act="events:scan"]'), 'Who’s coming has From a sheet');
  await s.page.click('.ev-who [data-act="events:scan"]'); await s.page.waitForSelector('#ns-text', { state: 'attached' });
  check(/Reading photos needs AI/.test(await s.page.textContent('#modal')) && await s.page.isVisible('.ns-tile.off'), 'AI not set up on this device: the photo tiles are off, and typing is offered');
  await s.page.fill('#ns-text', 'Jason & Priya Naidoo\nSam Peterz +1\nMegan\nNomsa Dube\nTim Jacobs');
  await s.page.click('[data-ns="typed"]'); await s.page.waitForSelector('.ns-list');
  const rowText = async i => s.page.textContent('.ns-row[data-row="' + i + '"]');
  check((await s.page.$$('.ns-row')).length === 6, 'six names read (Jason & Priya are two)');
  check(await s.page.$eval('.ns-row[data-row="0"]', li => li.classList.contains('ok') && /Jason Naidoo/.test(li.querySelector('.ns-pill.on').textContent)), 'Jason is found');
  check(await s.page.$eval('.ns-row[data-row="2"]', li => li.classList.contains('ok') && /Sam Peters/.test(li.querySelector('.ns-pill.on').textContent)), 'a slip of the pen (Peterz) still finds Sam Peters');
  check(await s.page.$eval('.ns-row[data-row="3"]', li => li.classList.contains('ask')) && /Who is this\?/.test(await rowText(3)), 'a first name alone is a question, not a guess');
  check(/Not found in People/.test(await rowText(4)), 'Nomsa Dube isn’t in People');
  check(await s.page.$eval('.ns-row[data-row="5"]', li => li.classList.contains('already')), 'Tim is already coming');
  check(/Add 3 people/.test(await s.page.textContent('#ns-go')) && /2 to check/.test(await s.page.textContent('#ns-sum')), 'the button counts who will be added; the summary says what to check');
  await s.page.click('.ns-row[data-row="3"] [data-ns="opt"]');
  await s.page.click('.ns-row[data-row="4"] [data-ns="new"]');
  check(await s.page.inputValue('.ns-row[data-row="4"] [data-ns-f="first"]') === 'Nomsa' && await s.page.inputValue('.ns-row[data-row="4"] [data-ns-f="last"]') === 'Dube', 'New visitor: the name is filled in, ready to correct');
  check(/Add 5 people/.test(await s.page.textContent('#ns-go')), 'now five');
  await s.page.click('#ns-go'); await s.settle();
  let docs = await s.docsNow();
  const nomsa = Object.keys(docs).find(k => k.startsWith('people/') && docs[k].firstName === 'Nomsa');
  check(!!nomsa && docs[nomsa].category === 'Attender' && docs[nomsa].source === 'photo' && docs[nomsa].appRole === 'none', 'Nomsa is added to People as an Attender, with no sign-in');
  const nid = nomsa && nomsa.split('/')[1];
  check(docs['eventSignups/ev1_p10'] && docs['eventSignups/ev1_p10'].people.join() === 'p10,p11' && docs['eventSignups/ev1_p10'].addedBy === 'p02', 'Jason and Priya: one sign-up for their household, added by Thandi');
  check(docs['eventSignups/ev1_p19'] && docs['eventSignups/ev1_p19'].guests === 1 && !!docs['eventSignups/ev1_p17'] && !!docs['eventSignups/ev1_' + nid], 'Sam with his guest, Megan, and Nomsa are on the list');
  check(/5 people are on the list/.test(await s.page.textContent('#toast, .toast').catch(() => '')) || /Nomsa Dube/.test(await s.text()), 'Who’s coming shows them');

  // Saying a name in Add people: what is heard a little wrong still finds them ("Sounds like"); someone new is registered there and then
  await s.page.evaluate(ears); await s.page.evaluate(() => Hub.render());
  await s.page.click('.ev-who [data-act="events:add"]'); await s.page.waitForSelector('#modal .cg-find .mic-btn');
  await s.page.evaluate(() => { window.__say = ['Kavi Govendor', 'cavy go vendor']; });
  await s.page.click('#modal .cg-find .mic-btn'); await s.page.waitForSelector('#modal .cg-like');
  check(await s.page.inputValue('#modal .cg-q') === 'Kavi Govendor' && /Kavi Govender/.test(await s.page.textContent('#modal .cg-like')) && /Sounds like/.test(await s.page.textContent('#modal .cg-like')), 'said “Kavi Govendor”: Kavi Govender comes up, marked Sounds like');
  await s.page.fill('#modal .cg-q', 'Zanele Xaba'); await s.page.waitForSelector('#modal [data-act="events:newp"][data-q="Zanele Xaba"]');
  await s.page.click('#modal [data-act="events:newp"][data-q="Zanele Xaba"]'); await s.page.waitForSelector('#ev-nf');
  check(await s.page.inputValue('#ev-nf') === 'Zanele' && await s.page.inputValue('#ev-nl') === 'Xaba', 'Add “Zanele Xaba” as someone new: the name is filled in');
  await s.page.fill('#ev-nm', '082 555 0199');
  await s.page.click('[data-act="events:newsave"]'); await s.page.waitForSelector('[data-act="events:addsave"]');
  await s.page.click('[data-act="events:addsave"]'); await s.settle();
  docs = await s.docsNow();
  const zan = Object.keys(docs).find(k => k.startsWith('people/') && docs[k].firstName === 'Zanele'), zid = zan && zan.split('/')[1];
  check(!!zan && docs[zan].mobile === '082 555 0199' && !!docs['eventSignups/ev1_' + zid] && docs['eventSignups/ev1_' + zid].addedBy === 'p02', 'Zanele is in People and on the list');
  await s.page.click('#modal .dlg-foot [data-act="hub:close"]');

  // People's search: say a name
  await s.go('people'); await s.page.evaluate(() => { window.__say = ['Tabo Kosi']; });
  await s.page.click('.search .mic-btn'); await s.page.waitForSelector('.pp-like', { timeout: 5000 });
  check(await s.page.inputValue('#pp-q') === 'Tabo Kosi' && /Thabo Nkosi/.test(await s.page.textContent('.pp-like')), 'said “Tabo Kosi”: Sounds like Thabo Nkosi');
  await s.page.click('.pp-like-p:has-text("Thabo Nkosi")');
  check(/#\/people\/p\/p21/.test(s.page.url()), 'tapping the name opens Thabo');
  await finish(s);

  // Visitor cards from a photo: Gemini (a stand-in) reads them; names already in People are left out
  s = await session('thandi.mokoena@example.com', seed);
  const sent = [];
  await s.page.route(u => u.href.startsWith('https://firebasevertexai.googleapis.com/'), r => {
    sent.push(r.request().postData());
    const reply = { names: [{ written: 'Lindiwe Zungu 082 123 4567', first: 'Lindiwe', last: 'Zungu', mobile: '082 123 4567', email: 'lindiwe@example.com' }, { written: 'Faith Adams', first: 'Faith', last: 'Adams' }, { written: 'Bob Bloggs', first: 'Bob', last: 'Bloggs', crossed: true }] };
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(reply) }] } }] }) });
  });
  await s.page.evaluate(() => {
    window.CHURCH_HUB_FIREBASE.appCheckKey = 'test-site-key';
    window.firebase.appCheck = function () { return { activate: function () {}, getToken: function () { return Promise.resolve({ token: 'app-check-token' }); } }; };
    window.firebase.appCheck.ReCaptchaV3Provider = function (k) { this.k = k; }; window.firebase.appCheck.ReCaptchaEnterpriseProvider = function (k) { this.k = k; };
  });
  await s.go('people');
  await s.page.click('[data-act="people:scan"]'); await s.page.waitForSelector('.ns-file', { state: 'attached' });
  check(/goes to Google’s Gemini AI to read the handwriting\. Church & Trellis doesn’t keep it/.test(await s.page.textContent('#modal')), 'it says where the photo goes, and that Church & Trellis doesn’t keep it');
  await s.page.setInputFiles('.ns-file >> nth=0', PNG); await s.page.waitForSelector('.ns-list', { timeout: 10000 });
  const body = JSON.parse(sent[0] || '{}'), text = JSON.stringify(body);
  check(!!(body.contents && body.contents[0].parts[0].inlineData) && /mobile and email/.test(text) && !/Thabo|Govender|Mokoena/.test(text), 'the photo goes to Gemini with the rules – nothing about anyone at church');
  check((await s.page.$$('.ns-row')).length === 2, 'a crossed-out name is left out');
  check(await s.page.$eval('.ns-row[data-row="1"]', li => li.classList.contains('skip')) && /In People/.test(await s.page.textContent('.ns-row[data-row="1"]')), 'Faith Adams is already in People: left out');
  check(await s.page.inputValue('.ns-row[data-row="0"] [data-ns-f="mobile"]') === '082 123 4567' && /Add 1 person/.test(await s.page.textContent('#ns-go')), 'Lindiwe is new, with the mobile number from the card');
  await s.page.click('#ns-go'); await s.settle();
  docs = await s.docsNow();
  const lin = Object.keys(docs).find(k => k.startsWith('people/') && docs[k].firstName === 'Lindiwe');
  const det = lin && docs['details/' + lin.split('/')[1]];
  check(!!lin && docs[lin].email === 'lindiwe@example.com' && docs[lin].category === 'Attender' && !!det && (det.keyDates || []).some(k => k.label === 'First visit'), 'Lindiwe is added, with her first visit today');
  await finish(s);

  // Sipho, a Roster coordinator: may add people from a sheet to an event, but not add new people to People
  s = await session('sipho.dlamini@example.com', seed);
  await s.go('events/e/ev1'); await s.page.click('.ev-who [data-act="events:add"]'); await s.page.waitForSelector('#modal .cg-q');
  check(!(await s.page.isVisible('#modal [data-act="events:newp"]')), 'no “someone new” for him');
  await s.page.click('#modal [data-act="events:scan"]'); await s.page.waitForSelector('#ns-text', { state: 'attached' });
  await s.page.fill('#ns-text', 'Nomsa Dube'); await s.page.click('[data-ns="typed"]'); await s.page.waitForSelector('.ns-list');
  check(!(await s.page.isVisible('[data-ns="new"]')) && await s.page.isVisible('[data-ns="other"]'), 'not found: he can choose someone else, not add them to People');
  await s.go('people'); check(!(await s.page.isVisible('[data-act="people:scan"]')), 'no From a photo in People for him');
  await finish(s);
};
