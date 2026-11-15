/* Tests for js/sesotho.js (Sesotho as written in Lesotho, from the South African spelling). Run: node tests/sesotho.test.js */
'use strict';
const S = require('../js/sesotho.js');
let fails = 0;
function check(ok, what) { if (!ok) { fails++; console.log('  ✗ ' + what); } else console.log('  ✓ ' + what); }
const eq = (a, b, what) => check(S.text(a) === b, what + ' (' + S.text(a) + ')');
console.log('Lesotho spelling');
eq('dintlha', 'lintlha', 'd before i becomes l');
eq('Dihlopha tsa kereke', 'Lihlopha tsa kereke', '…also at the start of a sentence');
eq('Modimo', 'Molimo', 'd before u or i inside a word');
eq('Kgetha', 'Khetha', 'kg becomes kh');
eq('tshebeletso', 'tšebeletso', 'tsh becomes tš');
eq('ntjha', 'ncha', 'tjh becomes ch');
eq('Sehlooho sa Motsamaisi wa yona', 'Sehlooho sa Motsamaisi oa eona', 'w and y before a vowel become o and e');
eq('Bula ho Google Docs', 'Bula ho Google Docs', 'names are kept');
eq('Kopo e {n} ya <b>kadimo</b>', 'Kopo e {n} ea <b>kalimo</b>', '{parts} and markup are kept');
eq('Romela ho WhatsApp kapa PDF', 'Romela ho WhatsApp kapa PDF', 'English words with capitals inside are kept');
const p = S.pack({ mon: ['Phe'], dow: ['Son'], words: { Children: 'Bana', Groups: 'Dihlopha' } });
check(p.words.Groups === 'Lihlopha' && p.words.Children === 'Bana' && p.mon[0] === 'Phe', 'a whole language pack');
if (fails) { console.log('\n' + fails + ' Sesotho test(s) FAILED'); process.exit(1); }
console.log('\nAll Sesotho tests passed');
