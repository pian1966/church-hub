/* Tests for js/wording.js (the church's own words). Run: node tests/wording.test.js */
'use strict';
const W = require('../js/wording.js');
let fails = 0;
function ok(c, what) { if (!c) { fails++; console.log('  ✗ ' + what); } else console.log('  ✓ ' + what); }

const keys = W.TERMS.map(t => t[0]);
ok(Object.keys(W.SETS).length >= 8 && Object.values(W.SETS).every(s => s.name && Object.keys(s.words).every(k => keys.includes(k) && s.words[k].length === 2)), 'every set names known words, singular and plural');
const g = W.changer({});
ok(g('Only Pastors may see this') === 'Only Pastors may see this', 'General: nothing changes');
const ang = W.changer({ wording: { set: 'anglican' } });
ok(ang('Only Pastors may see this') === 'Only Clergy may see this' && ang('Pastor') === 'Clergy', 'Anglican: Pastors → Clergy');
ok(ang('Pastoral notes') === 'Pastoral notes' && ang('Partner and children') === 'Partner and children', 'whole words only: Pastoral notes and a couple’s Partner stay');
ok(ang('Church Partners: 40') === 'Parishioners: 40' && ang('a Church Partner since 2015') === 'a Parishioner since 2015', 'Church Partner(s) → Parishioner(s)');
ok(ang('Ask the church office') === 'Ask the parish office' && ang('Church office notes') === 'Parish office notes', 'lower and upper case (church office → parish office)');
ok(ang('the Pastor’s notes') === 'the Clergy’s notes' && ang('(Pastors only)') === '(Clergy only)', 'next to punctuation');
const cat = W.changer({ wording: { set: 'catholic' } });
ok(cat('Children’s ministry and Pastors') === 'Children’s catechesis and Priests', 'Catholic: Priests, Children’s catechesis');
const own = W.changer({ wording: { set: 'anglican', custom: { pastor: ['Rector', 'Rectors'], partner: ['Church Partner', ''] } } });
ok(own('Pastors and Church Partners') === 'Rectors and Church Partners' && own('a Pastor') === 'a Rector', 'renamed words win over the set (and the set can be undone word by word)');
ok(W.words({ wording: { set: 'methodist' } }).pastor.join() === 'Minister,Ministers' && W.words({ wording: { set: 'nope' } }).pastor.join() === 'Pastor,Pastors', 'words for a set; an unknown set is General');
ok(W.pairs({ wording: { set: 'anglican' } }).every((p, i, a) => i === 0 || a[i - 1][0].length >= p[0].length), 'longest words are changed first (Visiting Minister before Minister)');

if (fails) { console.log('\n' + fails + ' wording test(s) FAILED'); process.exit(1); }
console.log('\nAll wording tests passed');
