/* Church Hub – browser test, part: Advanced search → Ask in your own words (js/ask.js, js/people/search.js), typed and spoken.
 * One part of tests/app.test.js, which starts the browser and runs every part in turn: node tests/app.test.js */
'use strict';
module.exports = async function (ctx) {
  const { check, finish, seedDocs, session } = ctx;
  console.log('Ask in your own words (Advanced search):');
  // Tim Jacobs (p14) on the door at a morning service and on sound at an evening service the same day
  const seed = seedDocs(), svc = Object.keys(seed).filter(k => k.startsWith('services/')).map(k => Object.assign({ id: k.split('/')[1] }, seed[k]))
    .filter(s => s.date > new Date().toISOString().slice(0, 10)).sort((a, b) => a.date < b.date ? -1 : 1)[1];
  seed['services/svEve'] = { date: svc.date, time: '17:00', slot: '17:00', name: 'Evening service' };
  seed['assignments/aEve'] = { serviceId: 'svEve', positionId: 'sound', personId: 'p14', status: 'accepted', source: 'manual' };
  const s = await session('linda.pillay@example.com', seed); await s.go('people/search');
  const ask = async q => { await s.page.fill('#ask-q', q); await s.page.press('#ask-q', 'Enter'); await s.page.waitForTimeout(300); await s.settle(); };
  const said = () => s.page.$$eval('#ask-said .tag', t => t.map(x => x.textContent));

  check(await s.page.isVisible('#ask-q') && (await s.page.$$('.ask-chip')).length >= 3, 'a box to ask in your own words, with examples to tap');
  await ask('show me all people who are official partners, and males, and with birthdays in April');
  let t = await said();
  check(t.length === 3 && /Category is “Church Partner”/.test(t[0]) && /Gender is “Male”/.test(t[1]) && /Birthday is in the month April/.test(t[2]), 'Church Partners, men, birthdays in April → understood as three filters: ' + t.join(' · '));
  check(await s.page.$$eval('.adv-row', r => r.length) === 3 && await s.page.isVisible('#adv-result'), '… which fill in the filters below, and the search runs');
  check(await s.page.$$eval('.adv-col', h => h.map(x => x.textContent).join('|')).then(h => /Gender/.test(h) && /Birthday/.test(h)), '… with Gender and Birthday added as columns');

  await ask('Show me all people that do not have an ID number, and that are volunteers in any capacity, and that do have a home address');
  t = await said();
  check(t.length === 3 && /ID number is empty/.test(t[0]) && /Volunteer is yes/.test(t[1]) && /Home address is not empty/.test(t[2]) && !(await s.page.$('#adv-result.note')), 'no ID number, a volunteer, with a home address: ' + t.join(' · '));
  check((await s.denied()).length === 0, '… the ID numbers are looked up as with the Search button (Administrators)');

  await ask('Show me all 10am services between 12 November and 2 Feb that do not have all necessary volunteer positions filled');
  t = await said();
  check(t.length === 3 && /to/.test(t[0]) && /10am/.test(t[1]) && /Not all positions filled/.test(t[2]) && await s.page.isVisible('#ask-result'), '10am services, a date range, with gaps → a list of services: ' + t.join(' · '));

  await ask('show me all services where Tim Jacobs is serving in both a morning and an evening service on the same day');
  t = await said();
  const rows = await s.page.$$eval('#ask-result tbody tr', r => r.map(x => x.textContent));
  check(/Tim Jacobs serving at a morning and an evening service/.test(t.join()) && rows.length === 2 && rows.some(r => /Door/.test(r)) && rows.some(r => /Sound desk/.test(r)), 'Tim Jacobs at a morning and an evening service the same day → both services, with what he does');
  await ask('services where Bob Nobody is serving');
  check(/No one called “Bob Nobody” was found/.test(await s.page.textContent('#ask')), 'someone not in the church: said plainly');
  await ask('purple elephants');
  check(/Nothing in that was understood/.test(await s.page.textContent('#ask')), 'nonsense: “Nothing in that was understood”');

  // The microphone: the browser's speech-to-text (a stand-in here), then the Android app's
  await s.page.evaluate(() => {
    window.SpeechRecognition = window.webkitSpeechRecognition = function () { const r = this; r.start = () => setTimeout(() => { r.onresult({ results: [[{ transcript: 'women over 60' }]] }); r.onend(); }, 50); r.stop = () => {}; };
    Hub.render();
  });
  check(await s.page.isVisible('#ask-mic'), 'a microphone button where the browser can turn speech into text');
  await s.page.click('#ask-mic'); await s.page.waitForTimeout(400); await s.settle();
  t = await said();
  check(await s.page.inputValue('#ask-q') === 'women over 60' && t.length === 2 && /Gender is “Female”/.test(t[0]) && /Age is more than “60”/.test(t[1]), 'speaking “women over 60”: written in the box and asked');
  await s.page.evaluate(() => { window.SpeechRecognition = window.webkitSpeechRecognition = undefined; window.ChurchHubApp = { listen: lang => { window.__lang = lang; setTimeout(() => window.churchHubHeard('men under 30'), 50); } }; Hub.render(); });
  await s.page.click('#ask-mic'); await s.page.waitForTimeout(400); await s.settle();
  check(await s.page.inputValue('#ask-q') === 'men under 30' && await s.page.evaluate(() => window.__lang) === 'en-ZA', 'in the Android app: its speech window, in South African English');
  await s.page.evaluate(() => window.churchHubHeard(null));
  check(/Couldn’t hear that/.test(await s.page.textContent('#ask-live')), 'nothing heard: “Couldn’t hear that – try again.”');
  await finish(s);

  // With AI (js/ask-ai.js): switched on in Settings, App Check set up; Gemini is a stand-in that answers with filters
  console.log('Ask in your own words, with AI:');
  const seed2 = seedDocs(); seed2['settings/church'].ai = { on: true, model: 'gemini-test' };
  const a = await session('linda.pillay@example.com', seed2), sent = [];
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
  await a.go('people/search');
  const askA = async q => { await a.page.fill('#ask-q', q); await a.page.press('#ask-q', 'Enter'); await a.page.waitForTimeout(500); await a.settle(); };
  const saidA = () => a.page.$$eval('#ask-said .tag', t => t.map(x => x.textContent));
  check(/sent to Google’s Gemini AI/.test(await a.page.textContent('#ask')), 'with AI on: the box says the question goes to Gemini, and no records');
  reply = { kind: 'people', filters: [{ field: 'gender', op: 'eq', value: 'male' }, { field: 'category', op: 'eq', value: 'Church Partner' }, { field: 'age', op: 'gt', value: '60' },
    { field: 'pastoralNotes', op: 'has', value: 'x' }], match: 'all', notUnderstood: [] };
  await askA('church partners who are men older than sixty');
  let ta = await saidA(), req = sent[sent.length - 1], body = JSON.parse(req.body);
  check(/Understood by AI as/.test(await a.page.textContent('#ask-said')) && ta.length === 3 && /Gender is “Male”/.test(ta[0]) && /Age is more than “60”/.test(ta[2]) && await a.page.isVisible('#adv-result'),
    'the AI’s filters are used and the search runs: ' + ta.join(' · '));
  check(/Your role can’t search on/.test(await a.page.textContent('#ask-said')), '… a field the role doesn’t have (pastoral notes) is refused, not used');
  check(/\/projects\/demo-church-hub\/models\/gemini-test:generateContent$/.test(req.url) && req.headers['x-firebase-appcheck'] === 'app-check-token' && req.headers['x-goog-api-key'] === 'test-only',
    'sent to Firebase AI Logic with the App Check token and the church’s model');
  const what = JSON.stringify(body);
  check(what.includes('men older than sixty') && !/Jacobs|Naidoo|Pillay|example\.com/.test(what), '… with the question and the search’s fields – no names, households or emails from the church');
  const audit = Object.values(await a.docsNow()).some(d => d && /Searched in their own words \(AI\): church partners/.test(d.what || d.action || JSON.stringify(d)));
  check(audit, '… and written in the audit log as an AI search');
  reply = null;
  await askA('women over 60');
  ta = await saidA();
  check(/couldn’t be reached/.test(await a.page.textContent('#ask-said')) && ta.length === 2 && /Gender is “Female”/.test(ta[0]), 'the AI can’t be reached: Church Hub’s own rules are used, and it says so');
  await finish(a);
};
