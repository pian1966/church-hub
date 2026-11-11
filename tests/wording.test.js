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
const meth = W.changer({ wording: { set: 'methodist' } });
ok(meth('My Care Group · Carer') === 'My Class · Class leader' && meth('Care Group member') === 'Class member', 'Methodist: Care Groups are Classes (a group’s name is a proper noun), carers class leaders');
ok(W.changer({ wording: { set: 'anglican' } })('People in your Care Group') === 'People in your Home Group' && W.changer({ wording: { custom: { life: ['Bible study', 'Bible studies'] } } })('My Midweek Groups') === 'My Bible Studies', 'the church’s own word for a group is shown with capitals too');
ok(W.pairs({ wording: { set: 'anglican' } }).every((p, i, a) => i === 0 || a[i - 1][0].length >= p[0].length), 'longest words are changed first (Visiting Minister before Minister)');

ok(ang('Senior Pastor') === 'Rector' && ang('the Assistant Pastors') === 'the Assistant Ministers' && ang('Pastors') === 'Clergy', 'Anglican: Senior Pastor → Rector, Assistant Pastors → Assistant Ministers');
ok(cat('Senior Pastor and Assistant Pastor') === 'Parish Priest and Assistant Priest', 'Catholic: Parish Priest and Assistant Priest');
ok(meth('Senior Pastor · Assistant Pastors') === 'Senior Minister · Assistant Ministers', 'Methodist: Senior and Assistant follow the word for Pastor');
const ownP = W.changer({ wording: { custom: { pastor: ['Elder', 'Elders'] } } });
ok(ownP('Senior Pastor and Assistant Pastors') === 'Senior Elder and Assistant Elders', '…also when the church renamed Pastor itself');
const ownS = W.changer({ wording: { set: 'methodist', custom: { senior: ['Superintendent', 'Superintendents'] } } });
ok(ownS('Senior Pastor') === 'Superintendent' && ownS('Assistant Pastor') === 'Assistant Minister', 'the Senior Pastor can be renamed on its own');

const mus = W.changer({ wording: { custom: W.MUSIC.Music } });
ok(mus('Worship team') === 'Music team' && mus('Worship Team') === 'Music Team' && mus('the worship leader') === 'the music leader' && mus('Worship') === 'Music', 'Worship → Music, Worship team → Music team, worship leader → music leader');
const pr = W.changer({ wording: { custom: Object.assign({}, W.MUSIC.Praise, { worshipLeader: ['Band leader', 'Band leaders'] }) } });
ok(pr('Worship Leader and Worship team') === 'Band Leader and Praise team' && pr('Sunday worship') === 'Sunday praise', 'Praise, with the leader renamed on its own');
ok(W.changer({})('Worship team') === 'Worship team', 'as Church Hub comes: Worship stays');
const fel = { wording: { custom: { groups: ['Fellowship', 'Fellowships'] } } };
ok(W.words(fel).groups.join() === 'Fellowship,Fellowships' && W.changer(fel)('Message groups · Groups · Care Groups') === 'Message groups · Groups · Care Groups', 'the church’s word for the Groups menu is used by the menu only, not changed in other texts');

if (fails) { console.log('\n' + fails + ' wording test(s) FAILED'); process.exit(1); }
console.log('\nAll wording tests passed');
