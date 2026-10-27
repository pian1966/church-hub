/* Tests for js/i18n.js (languages). Run: node tests/i18n.test.js
 * Every T('…') / TN('…', '…') text in the app must have Afrikaans, isiZulu and isiXhosa, with the same {parts}. */
'use strict';
const fs = require('fs'), path = require('path');
const I18n = require('../js/i18n.js');
let fails = 0;
function check(ok, what) { if (!ok) { fails++; console.log('  ✗ ' + what); } else console.log('  ✓ ' + what); }

const rows = I18n.ROWS, byEn = {};
rows.forEach(r => { byEn[r[0]] = r; });
console.log('The word list');
check(rows.every(r => r.length === 4 && r.every(x => typeof x === 'string' && x.trim())), 'every line has English, Afrikaans, isiZulu and isiXhosa');
const dup = rows.map(r => r[0]).filter((x, i, a) => a.indexOf(x) !== i);
check(!dup.length, 'no English text twice' + (dup.length ? ': ' + dup.join(' | ') : ''));
const parts = s => (s.match(/\{\w+\}/g) || []).sort().join();
const badParts = rows.filter(r => r.slice(1).some(x => parts(x) !== parts(r[0])));
check(!badParts.length, 'every translation keeps the {parts}' + (badParts.length ? ': ' + badParts.map(r => r[0]).join(' | ') : ''));
const badTags = rows.filter(r => r.slice(1).some(x => (x.match(/<\/?\w+/g) || []).join() !== (r[0].match(/<\/?\w+/g) || []).join()));
check(!badTags.length, 'no translation adds or loses markup');

console.log('Texts used in the app');
const dir = path.join(__dirname, '..', 'js'), used = new Set();
for (const f of fs.readdirSync(dir).filter(f => /\.js$/.test(f) && f !== 'i18n.js')) {
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  for (const m of src.matchAll(/\bTN?\(\s*'((?:[^'\\]|\\.)*)'(?:\s*,\s*'((?:[^'\\]|\\.)*)')?/g)) {
    used.add(m[1].replace(/\\'/g, "'"));
    if (/\bTN\(/.test(m[0]) && m[2] !== undefined) used.add(m[2].replace(/\\'/g, "'"));
  }
  for (const m of src.matchAll(/\bT\(\s*[^'()]*\?\s*'((?:[^'\\]|\\.)*)'\s*:\s*(?:[^'()]*\?\s*'((?:[^'\\]|\\.)*)'\s*:\s*)?'((?:[^'\\]|\\.)*)'/g)) [m[1], m[2], m[3]].forEach(x => x !== undefined && used.add(x));
}
const missing = [...used].filter(s => !byEn[s]);
check(used.size > 150, 'found the texts in the app (' + used.size + ')');
check(!missing.length, 'every text in the app is translated' + (missing.length ? ':\n      ' + missing.join('\n      ') : ''));

console.log('Using it');
check(I18n.t('Home') === 'Home', 'English by default');
I18n.set('af'); check(I18n.t('Home') === 'Tuis' && I18n.mon()[2] === 'Mrt', 'Afrikaans words and months');
check(I18n.tn('{n} person', '{n} people', 3) === '3 mense' && I18n.tn('{n} person', '{n} people', 1) === '1 persoon', 'one and many');
check(I18n.t('Edit {name}', { name: 'Thandi' }) === 'Wysig Thandi', 'fills in {parts}');
check(I18n.t('Something not in the list') === 'Something not in the list', 'falls back to English');
I18n.set('zu'); check(I18n.t('Sign out') === 'Phuma' && I18n.dow()[0] === 'Son', 'isiZulu');
I18n.set('xh'); check(I18n.t('Yes') === 'Ewe', 'isiXhosa');
I18n.set('fr'); check(I18n.get() === 'en', 'an unknown language becomes English');

if (fails) { console.log('\n' + fails + ' language test(s) FAILED'); process.exit(1); }
console.log('\nAll language tests passed');
