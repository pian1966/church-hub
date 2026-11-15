/* Tests for js/datebox.js (dates that can be typed). Run: node tests/datebox.test.js */
'use strict';
const D = require('../js/datebox.js');
let fails = 0;
function ok(c, what) { if (!c) { fails++; console.log('  ✗ ' + what); } else console.log('  ✓ ' + what); }
const p = (s, o) => D.parse(s, Object.assign({ year: 2026 }, o));

console.log('Typed dates');
ok(p('12 aug 1990') === '1990-08-12' && p('12 August 1990') === '1990-08-12' && p('Aug 12, 1990') === '1990-08-12', 'day and month name, either way round');
ok(p('12/08/1990') === '1990-08-12' && p('12-8-1990') === '1990-08-12' && p('12.08.1990') === '1990-08-12' && p('12081990') === '1990-08-12', 'numbers are read day first');
ok(p('1990-08-12') === '1990-08-12' && p('1990/8/12') === '1990-08-12', 'year first');
ok(p('3 Mei 1985') === '1985-05-03' && p('9 Okt 2001') === '2001-10-09' && p('1 Maart 1970') === '1970-03-01' && p('25 Des 1999') === '1999-12-25', 'Afrikaans month names');
ok(p('5 Mas 1980', { months: ['Jan', 'Feb', 'Mas', 'Eph'] }) === '1980-03-05', 'month names of the language in use');
ok(p('12/08/90') === '1990-08-12' && p('12/08/05') === '2005-08-12', 'two-digit years');
ok(p('12 aug 19', { full: true }) === null && p('12/08/19', { full: true }) === null, 'while typing, a short year is not taken yet');
ok(p('31 Apr 1990') === null && p('29 Feb 2023') === null && p('29 Feb 2024') === '2024-02-29', 'days that don’t exist');
ok(p('') === '' && p('  ') === '', 'nothing typed');
ok(p('hello') === null && p('aug 1990') === null && p('12 aug') === null && p('Admin') === null, 'not a date');

if (fails) { console.log(fails + ' failed'); process.exit(1); } else console.log('All passed');
