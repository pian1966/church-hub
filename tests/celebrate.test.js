/* Tests for js/celebrate.js (a birthday or wedding anniversary worth celebrating today). Run: node tests/celebrate.test.js */
'use strict';
const C = require('../js/celebrate.js');
let fails = 0;
function check(ok, what) { if (!ok) { fails++; console.log('  ✗ ' + what); } else console.log('  ✓ ' + what); }
const TODAY = '2026-11-24';

console.log('Birthdays');
check(C.birthday({ birthDate: '1980-11-24' }, TODAY).years === 46, 'a birthday today, with the age');
check(C.birthday({ birthDay: '11-24' }, TODAY).years === 0, 'a birthday kept without its year still counts, with no age');
check(C.birthday({ birthDate: '1980-11-25' }, TODAY) === null, 'not today');
check(C.birthday({}, TODAY) === null, 'no birthday recorded');
check(C.birthday({ birthDate: '1980-11-24', deceasedAt: '2026-01-02' }, TODAY) === null, 'nothing for someone who has died');
check(C.birthday({ birthDate: '1980-11-24', category: 'Deceased' }, TODAY) === null, '…or is in the Deceased category');
check(C.birthday({ birthDate: '1980-11-24', active: false }, TODAY) === null, '…or has left the church');
check(C.birthday({ birthDate: '1980-11-24', mergedInto: 'x' }, TODAY) === null, '…or is a merged duplicate');
check(C.birthday({ birthDate: '2024-02-29' }, '2026-02-28') !== null && C.birthday({ birthDate: '2024-02-29' }, '2028-02-28') === null && C.birthday({ birthDate: '2024-02-29' }, '2028-02-29') !== null, '29 February is kept on 28 February in years without one');

console.log('Wedding anniversaries');
const wed = { keyDates: [{ label: 'Wedding anniversary', date: '2001-11-24' }], maritalStatus: 'Married' };
check(C.anniversary(wed, null, TODAY).years === 25, 'an anniversary today, with the years');
check(C.anniversary({ keyDates: [], maritalStatus: 'Married' }, { keyDates: [{ label: 'Wedding anniversary', date: '2010-11-24' }], maritalStatus: 'Married' }, TODAY).years === 16, 'the date can be on the spouse’s record');
check(C.anniversary(Object.assign({}, wed, { maritalStatus: 'Widowed' }), null, TODAY) === null, 'never for someone widowed');
check(C.anniversary(Object.assign({}, wed, { maritalStatus: 'Divorced' }), null, TODAY) === null, '…divorced');
check(C.anniversary(Object.assign({}, wed, { maritalStatus: 'Separated' }), null, TODAY) === null, '…or separated');
check(C.anniversary(wed, { maritalStatus: 'Widowed' }, TODAY) === null, '…or when the spouse’s record says they are not married');
check(C.anniversary(wed, { deceasedAt: '2026-03-01', maritalStatus: 'Married' }, TODAY) === null, 'never when the spouse has died');
check(C.anniversary(wed, null, TODAY, { id: 'late' }) === null, '…or there is a late spouse on record');
check(C.anniversary(Object.assign({}, wed, { familyRole: 'child' }), null, TODAY) === null, 'never for a child');
check(C.anniversary(Object.assign({}, wed, { deceasedAt: '2026-01-01' }), null, TODAY) === null, 'never for someone who has died');
check(C.anniversary({ keyDates: [{ label: 'Wedding anniversary', date: '2001-11-25' }], maritalStatus: 'Married' }, null, TODAY) === null, 'not today');

console.log('Both together');
const both = C.today(Object.assign({ birthDate: '1975-11-24' }, wed), null, TODAY);
check(both.any && both.birthday.years === 51 && both.anniversary.years === 25, 'a birthday and an anniversary on the same day');
check(!C.today({ birthDate: '1975-01-01' }, null, TODAY).any, 'nothing special: any is false');

console.log(fails ? '\n' + fails + ' failed' : '\nAll passed');
process.exit(fails ? 1 : 0);
