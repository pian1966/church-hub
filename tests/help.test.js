/* Tests for js/help.js (Help: ask a question about using Church & Trellis): reading the help pages in docs/help/, finding the
 * right answers, what is sent to the AI, and how its reply is checked. Run: node tests/help.test.js */
'use strict';
const fs = require('fs'), path = require('path');
const Help = require('../js/help.js');
let fails = 0;
function ok(c, what) { if (!c) { fails++; console.log('  ✗ ' + what); } else console.log('  ✓ ' + what); }
const dir = path.join(__dirname, '..', 'docs', 'help');

console.log('The help pages');
const files = fs.readdirSync(dir).filter(f => /\.md$/.test(f) && f !== 'README.md').map(f => f.replace(/\.md$/, '')).sort();
ok(JSON.stringify(Help.PAGES.map(p => p[0]).sort()) === JSON.stringify(files), 'every page in docs/help/ is listed in Help.PAGES, and the other way round' +
  ' (add a new page to PAGES in js/help.js and to its table in docs/help/README.md)');
let all = [];
Help.PAGES.forEach(p => {
  const md = fs.readFileSync(path.join(dir, p[0] + '.md'), 'utf8'), got = Help.parse(md, p[0]);
  const heads = (md.match(/^## /gm) || []).length;
  ok(got.length === heads && got.length > 0, p[0] + ': all ' + heads + ' questions are read, each with an answer');
  all = all.concat(got);
});
ok(new Set(all.map(e => e.id)).size === all.length, 'every question has its own id (no two questions worded the same on one page)');
ok(all.every(e => e.who), 'every answer says who it is for (a "For:" line)');
ok(all.every(e => e.tags.length) || all.filter(e => !e.tags.length).length <= 2, 'almost every "For:" is one the app understands (' + all.filter(e => !e.tags.length).map(e => e.who).join('; ') + ')');
const screens = new Set(['home', 'about', 'import', 'me', 'settings', 'privacy', 'people', 'messages', 'events', 'library', 'archive', 'leave', 'rosters', 'care', 'life', 'leaders', 'board', 'market', 'support', 'words']);
ok(Help.PAGES.every(p => !p[2] || screens.has(p[2])) && all.every(e => !e.go || screens.has(e.go)), 'every "Go:" line and page names a screen the app has');
ok(all.some(e => e.go) && all.filter(e => e.go).every(e => Help.goOf(e) === e.go) && Help.goOf({ page: 'library' }) === 'library' && Help.goOf({ page: 'getting-started' }) === '', 'an answer goes to its own Go: screen, else the one its page is about');
ok(all.every(e => !/^Go:/m.test(e.body)), 'the "Go:" line is not part of an answer');
ok(all.every(e => !/^(For|Also asked):/m.test(e.body)), 'the "For:" and "Also asked:" lines are not part of an answer');

console.log('Reading one page');
const sample = '# Title\n\nIntro text.\n\n## How do I swim?\nFor: Members, Pastors\nAlso asked: Float. Dive.\n\nOpen **Pool** and tap **Swim**.\n\n## Empty one\nFor: Everyone\n\n## Second?\nFor: Administrators\n\n1. First\n2. Second\n';
const ps = Help.parse(sample, 'pool');
ok(ps.length === 2 && ps[0].q === 'How do I swim?' && ps[0].who === 'Members, Pastors' && ps[0].also === 'Float. Dive.' && ps[0].body === 'Open **Pool** and tap **Swim**.', 'question, who, also-asked and the answer');
ok(ps[0].tags.join() === 'member,pastor' && ps[1].tags.join() === 'admin', '"For:" becomes the tags the app uses');
ok(ps[0].id === 'pool/how-do-i-swim' && !ps.some(e => e.q === 'Empty one') && !/Intro/.test(ps[0].body), 'a stable id; a question with no answer and the page intro are left out');
const tg = x => Help.tagsOf(x).sort().join();
ok(tg('Roster coordinators, Administrators') === 'admin,rosters' && tg('Group leaders, co-leaders') === 'lifelead' && Help.tagsOf('Administrators, the Senior Pastor').includes('senior') && tg('Everyone, Children\'s ministry') === 'everyone,kids', 'more "For:" lines');

console.log('Finding the right answer');
const top = (q, tags) => (Help.search(all, q, tags)[0] || { entry: {} }).entry.id;
const topN = (q, tags, n) => Help.search(all, q, tags, n).map(r => r.entry.id);
const M = ['everyone', 'member'];
ok(top('how do I change my phone number', M) === 'me/how-do-i-change-my-phone-number-email-or-address', 'a phone number: Me → My details');
const idOf = q => (all.find(e => e.q.startsWith(q)) || {}).id;
ok(top('I am going on holiday, how do I tell the church', M) === idOf("How do I tell the church I'm away"), 'a holiday: Days away');
ok(topN('when am I serving on Sunday', M, 6).includes('me/where-do-i-see-when-i-m-serving'), 'when am I serving: among the best');
ok(top('how do I add a new person', ['everyone', 'pastor']) === 'people/how-do-i-add-a-new-person', 'adding a person');
ok(topN('borrow a book', M, 3).includes('library/how-do-i-borrow-a-book'), 'borrowing a book');
ok(Help.search(all, 'what is the capital of France', M).length === 0 && Help.search(all, '', M).length === 0, 'nothing in the help pages matches an unrelated question, or no question');
const r1 = Help.search(all, 'how do I change my phone number', M), r2 = Help.search(all, 'hoe verander ek my selfoonnommer', M);
ok(Help.clear(r1) && !Help.clear(r2), 'a clear match is told apart from words that matched nothing (another language)');
const staff = Help.search(all, 'how do I approve leave', ['everyone', 'member']), adm = Help.search(all, 'how do I approve leave', ['everyone', 'admin']);
ok(staff[0] && adm[0] && adm[0].score > staff[0].score, 'answers for other people rank lower for a member than for the Administrator they are for');
ok(Help.fits({ tags: ['admin'] }, ['member']) === false && Help.fits({ tags: ['admin'] }, ['admin']) && Help.fits({ tags: ['pastor'] }, ['admin']) && Help.fits({ tags: [] }, ['member']) && Help.fits({ tags: ['everyone'] }, ['member']), 'who an answer fits (Administrators may read all)');

console.log('What goes to the AI');
const few = Help.pick(r1, Help.FEW_CHARS), many = Help.pick(Help.everything(all, r2, M), Help.MANY_CHARS);
ok(few.length > 0 && few.length <= 6, 'a clear question sends only the best few answers (' + few.length + ')');
ok(many.length > 40 && many.reduce((n, x) => n + x.entry.body.length + x.entry.q.length, 0) <= Help.MANY_CHARS, 'an unclear one sends a wide choice, within the limit (' + many.length + ' answers)');
const ctx = { language: 'Afrikaans', role: 'Church Partner', words: { partner: ['Parishioner', 'Parishioners'], pastor: ['Pastor', 'Pastors'], admin: ['Church Administrator'] } };
const body = Help.request('how do I change my phone number?', few.map(r => r.entry), ctx), sent = JSON.stringify(body), user = body.contents[0].parts[0].text;
ok(body.generationConfig.responseMimeType === 'application/json' && /ONLY the help passages/.test(body.systemInstruction.parts[0].text), 'the AI is told to answer only from the passages, and as JSON');
ok(user.includes('how do I change my phone number?') && user.includes('me/how-do-i-change-my-phone-number-email-or-address') && user.includes('Afrikaans') && user.includes('Church Partner'), 'the question, the passages, the language and who is asking are sent');
const own = JSON.parse(user.split('\n')[1]).churchWords;
ok(own.length === 2 && own.includes('"Church Partner" is called "Parishioner" here') && own.includes('"Administrator" is called "Church Administrator" here'), 'the church’s own words are sent, only where they differ');
ok(Help.request('x'.repeat(2000), few.map(r => r.entry), ctx).contents[0].parts[0].text.length < 60000 && !/x{301}/.test(Help.request('x'.repeat(2000), [], ctx).contents[0].parts[0].text), 'a very long question is cut');
ok(!('people' in JSON.parse(user.split('\n')[1])), 'no records field exists in what is sent');

console.log('Checking the AI’s reply');
const sent4 = few.map(r => r.entry), id0 = sent4[0].id, id1 = sent4[1].id;
let c = Help.check({ found: true, answer: 'Open **Me** → **My details**.', sources: [id0, 'made/up-page', id0, id1] }, sent4);
ok(c.found && c.sources.length === 2 && c.sources[0].id === id0 && c.text.includes('**My details**'), 'an answer is shown with the help pages it came from; an invented source is dropped');
ok(!Help.check({ found: true, answer: 'Yes', sources: ['made/up-page'] }, sent4).found, 'an answer that names no page that was sent is not shown');
ok(!Help.check({ found: false, answer: 'I could not find it.', sources: [id0] }, sent4).found && !Help.check(null, sent4).found && !Help.check({ found: 'true', answer: 'x', sources: [id0] }, sent4).found && !Help.check({ found: true, answer: '  ', sources: [id0] }, sent4).found, 'not found, nothing, or an empty answer: not shown');
c = Help.check({ found: true, answer: 'Tap <b onclick="x()">Save</b><script>alert(1)</script>' + 'y'.repeat(3000), sources: [id0] }, sent4);
ok(!/[<>]/.test(c.text) && c.text.length <= 1500, 'markup is taken out and a very long answer is cut');
ok(Help.read({ candidates: [{ content: { parts: [{ text: '```json\n{"found":true,"answer":"a","sources":[]}\n```' }] } }] }).found === true && Help.read({}) === null && Help.read({ candidates: [{ content: { parts: [{ text: 'not json' }] } }] }) === null, 'the reply is read, also in a code fence; rubbish gives nothing');

console.log('A limit, so the free allowance lasts');
let times = [], n = 0, t = 1000000;
while ((times = Help.allow(times, t + n)) && n < 100) n++;
ok(n === Help.MAX_ASKS, 'at most ' + Help.MAX_ASKS + ' questions to the AI in ten minutes (' + n + ')');
ok(Help.allow(Array.from({ length: Help.MAX_ASKS }, (_, i) => t + i), t + 11 * 60 * 1000) !== null, 'and it is allowed again later');

if (fails) { console.log('\n' + fails + ' failed'); process.exit(1); }
console.log('\nAll passed');
