/* Tests for js/serving.js (services, special services). Run: node tests/serving.test.js */
'use strict';
const S = require('../js/serving.js');
let fails = 0;
function ok(c, what) { if (!c) { fails++; console.log('  ✗ ' + what); } else console.log('  ✓ ' + what); }

ok(['2024-03-31', '2025-04-20', '2026-04-05', '2027-03-28', '2028-04-16', '2038-04-25'].join() === [2024, 2025, 2026, 2027, 2028, 2038].map(S.easter).join(), 'Easter Sunday is worked out for any year');
const x = Object.fromEntries(S.specials(2027).map(s => [s.name, s.date]));
ok(x['Ash Wednesday'] === '2027-02-10' && x['Palm Sunday'] === '2027-03-21' && x['Maundy Thursday'] === '2027-03-25' && x['Tenebrae'] === '2027-03-25' && x['Good Friday'] === '2027-03-26', 'Lent and Holy Week follow Easter (2027)');
ok(x['Ascension Day'] === '2027-05-06' && x['Pentecost (Whitsunday)'] === '2027-05-16' && x['Trinity Sunday'] === '2027-05-23', 'Ascension and Pentecost follow Easter');
ok(x['Advent Sunday'] === '2027-11-28' && S.specials(2026).find(s => s.name === 'Advent Sunday').date === '2026-11-29' && x['Christmas Day'] === '2027-12-25', 'Advent Sunday and Christmas');
ok(x['Remembrance Sunday'] === '2027-11-14' && x['Mother’s Day'] === '2027-05-09' && x['Christ the King'] === '2027-11-21', 'Sundays fixed by the calendar (Remembrance, Mother’s Day, Christ the King)');
ok(x['Wedding'] === '' && S.specials(2027).every(s => s.name && s.when), 'occasions have no fixed date');
ok(S.specialDate('good friday', '2026-10-29') === '2027-03-26' && S.specialDate('Christmas Day', '2026-10-29') === '2026-12-25' && S.specialDate('Funeral', '2026-10-29') === '', 'the next date for a suggestion (this year, or next year once it has passed)');

if (fails) { console.log('\n' + fails + ' serving test(s) FAILED'); process.exit(1); }
console.log('\nAll serving tests passed');
