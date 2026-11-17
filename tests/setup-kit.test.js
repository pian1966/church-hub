/* Tests for the setup tool (site/setup-kit.js, used by site/setup.html). Run: node tests/setup-kit.test.js
 * Besides the rules, this keeps the tool up to date as Church Hub grows: every part of the app must be covered. */
'use strict';
const fs = require('fs'), path = require('path');
const K = require('../site/setup-kit.js'), Countries = require('../js/countries.js');
const root = path.join(__dirname, '..');
let fails = 0;
function ok(c, what) { if (!c) { fails++; console.log('  ✗ ' + what); } else console.log('  ✓ ' + what); }

// Every part of the app (Hub.register ids in js/mod-*.js) is in the setup tool, or in NOT_SETUP with a reason.
const mods = new Set();
fs.readdirSync(path.join(root, 'js')).filter(f => /^mod-.*\.js$/.test(f)).forEach(f => {
  const src = fs.readFileSync(path.join(root, 'js', f), 'utf8');
  for (const m of src.matchAll(/register\(\s*(?:\w+\s*=\s*)?\{\s*id:\s*'(\w+)'/g)) mods.add(m[1]);
  for (const m of src.matchAll(/var\s+mod\s*=\s*\{\s*id:\s*'(\w+)'/g)) mods.add(m[1]);
});
const covered = new Set([].concat(...K.GROW.map(x => x.mods || []), ...K.STEPS.map(x => x.mods || []), Object.keys(K.NOT_SETUP)));
const missing = [...mods].filter(m => !covered.has(m));
ok(mods.size >= 15, 'found the app’s parts (' + mods.size + ')');
ok(!missing.length, 'every part of the app is in the setup tool' + (missing.length ? ' – missing: ' + missing.join(', ') +
  '. Add a GROW item (or a STEP) with it in `mods` in site/setup-kit.js, or a NOT_SETUP line saying why there is nothing to set up' : ''));
const unknown = [...covered].filter(m => !mods.has(m));
ok(!unknown.length, 'the setup tool names no part the app doesn’t have' + (unknown.length ? ': ' + unknown.join(', ') : ''));

// Steps and items are complete, and their ids are unique
const ids = K.STEPS.map(s => s.id), gids = K.GROW.map(g => g.id);
ok(new Set(ids).size === ids.length && new Set(gids).size === gids.length, 'step and item ids are unique');
ok(K.STEPS.every(s => s.title && s.why && s.mins > 0 && typeof s.body === 'function' && K.chapterOf(s.chapter)), 'every step has a title, a reason, minutes and a chapter');
ok(K.CHAPTERS.every(c => K.stepsIn(c.id).length), 'every chapter has steps');
ok(K.GROW.every(g => g.title && g.what && typeof g.how === 'function' && K.GROUPS.some(x => x.id === g.group) && /^\d+\.\d+$/.test(g.since)), 'every Grow item has words, a How, a group and the version it arrived in');
const empty = K.ctx({}), full = K.ctx({ name: 'St Mark’s Anglican Church, Durban', country: 'ZA', churchEmail: 'StMarks@gmail.com', gh: 'st-marks', cfg: { projectId: 'church-hub-stm' } }, Countries);
ok([empty, full].every(c => K.STEPS.every(s => typeof s.body(c) === 'string') && K.GROW.every(g => typeof g.how(c) === 'string')), 'every step and item can be shown before and after the details are known');
ok(!K.STEPS.concat(K.GROW).some(s => /undefined|NaN/.test(s.body ? s.body(full) : s.how(full))), 'nothing shows "undefined"');

// Addresses and names
ok(K.emailIdeas('Christ Church Howick')[0] === 'christchurchhowick@gmail.com', 'Gmail idea from the church’s name');
ok(K.emailIdeas('St Mark’s Anglican Church, Durban')[0] === 'stmarksdurban@gmail.com', 'long names leave out the common words');
ok(K.emailIdeas('The Methodist Church of Southern Africa, Pietermaritzburg Central').every(e => e.split('@')[0].length <= 30), 'Gmail ideas fit Gmail’s 30 letters');
ok(K.githubIdea('Christ Church Howick') === 'christ-church-howick' && K.validGithub('christ-church-howick') && !K.validGithub('-x') && !K.validGithub('a--b') && !K.validGithub('a b'), 'GitHub username idea and check');
ok(K.projectName('Christ Church Howick') === 'Church Hub CCH' && K.projectName('A very long church name indeed with many words here').length <= 30, 'Firebase project name (≤ 30 letters)');
ok(full.site === 'https://st-marks.github.io/church-hub/' && full.domain === 'st-marks.github.io' && full.email === 'stmarks@gmail.com', 'the church’s address and email, in small letters');

// Where the information is kept
ok(K.place('ZA', 'Africa') === 'africa-south1' && K.place('KE', 'Africa') === 'africa-south1' && K.place('GB', 'Europe') === 'europe-west2' && K.place('DE', 'Europe') === 'eur3' &&
  K.place('US', 'Americas') === 'nam5' && K.place('BR', 'Americas') === 'southamerica-east1' && K.place('NZ', 'Oceania') === 'australia-southeast1' && K.place('IN', 'Asia') === 'asia-south1', 'the nearest place for a country');
ok(Countries.all().every(c => K.PLACES[K.place(c.code, c.continent)]), 'every country in js/countries.js gets a place, named in words');

// Firebase's settings, pasted
const pasted = 'import { initializeApp } from "firebase/app";\nconst firebaseConfig = {\n  apiKey: "AIzaSyA1234567890abcdefghijklmnopqrstuv",\n  authDomain: "church-hub-stm.firebaseapp.com",\n  projectId: "church-hub-stm",\n  storageBucket: "church-hub-stm.firebasestorage.app",\n  messagingSenderId: "123",\n  appId: "1:123456:web:abc123def"\n};';
const r = K.parseConfig(pasted);
ok(r.ok && r.cfg.projectId === 'church-hub-stm' && r.cfg.appId === '1:123456:web:abc123def', 'reads the four lines from what Firebase shows');
ok(!K.parseConfig('apiKey: "nope"').ok && K.parseConfig('').missing.length === 4, 'says what is missing');
ok(K.parseConfig("{ 'apiKey': 'AIzaSyA1234567890abcdefghijklmnopqrstuv', 'authDomain': 'x-y-z1.firebaseapp.com', 'projectId': 'x-y-z1', 'appId': '1:1:web:f' }").ok, 'single quotes too');
// The settings file has the same shape as the repository's js/firebase-config.js
function cfgOf(src) { const w = {}; new Function('window', src)(w); return w.CHURCH_HUB_FIREBASE; }
const mine = cfgOf(K.configFile(r.cfg, 'St Mark’s')), repo = cfgOf(fs.readFileSync(path.join(root, 'js/firebase-config.js'), 'utf8'));
ok(Object.keys(mine).sort().join() === Object.keys(repo).sort().join(), 'the church’s settings file has every setting js/firebase-config.js has' +
  (Object.keys(mine).sort().join() === Object.keys(repo).sort().join() ? '' : ' – change configFile() in site/setup-kit.js to match'));
ok(mine.projectId === 'church-hub-stm' && mine.appCheckKey === '' && cfgOf(K.configFile(r.cfg, "it's */ odd")).apiKey === r.cfg.apiKey, 'its values are the church’s, and odd names can’t break it');

// Progress
const ch = { done: { church: 1, gmail: 1 }, grow: { sync: { at: '2026-10-01' }, ai: { skip: true }, people: { at: '2026-11-01' } } };
const p = K.progress(ch);
ok(p.done === 2 && p.total === K.STEPS.length && p.next.id === 'safety' && !p.live, 'progress and the next step');
ok(K.growState(ch, K.GROW.find(g => g.id === 'sync'), '2026-11-17') === 'due' && K.growState(ch, K.GROW.find(g => g.id === 'sync'), '2026-10-15') === 'done', 'repeating jobs come round again');
ok(K.growState(ch, K.GROW.find(g => g.id === 'ai'), '2026-11-17') === 'skip' && K.growState(ch, K.GROW.find(g => g.id === 'people'), '2026-11-17') === 'done' && K.growState(ch, K.GROW.find(g => g.id === 'care'), '2026-11-17') === 'todo', 'done, not for us, still to do');
ok(K.isNew({ since: '0.84' }, '0.83') && !K.isNew({ since: '0.83' }, '0.83') && !K.isNew({ since: '0.90' }, '') && K.isNew({ since: '1.0' }, '0.99'), 'marked New only when it arrived after the church last looked');

// The page loads what it needs, and has been read for this version (see tests/versions.test.js)
const html = fs.readFileSync(path.join(root, 'site/setup.html'), 'utf8');
ok(['../js/version.js', '../js/countries.js', '../js/qr.js', 'setup-kit.js', '../firestore.rules'].every(f => html.includes(f)), 'setup.html loads the version, countries, QR codes, this file and the rules');

if (fails) { console.log('\n' + fails + ' setup tool test(s) FAILED'); process.exit(1); }
console.log('\nAll setup tool tests passed');
