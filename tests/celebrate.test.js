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

console.log('No opt-out any more (removed 28 Nov 2026)');
check(C.birthday({ birthDate: '1980-11-24', noCelebrate: true }, TODAY) !== null, 'an old noCelebrate on a record is ignored: the birthday is celebrated');
check(C.anniversary(Object.assign({ noCelebrate: true }, wed), null, TODAY) !== null, '…and so is the anniversary');

console.log('The church directory (day and month only)');
check(JSON.stringify(C.forDirectory(Object.assign({ birthDate: '1975-03-09' }, wed))) === '{"birthDay":"03-09","weddingDay":"11-24"}', 'a married adult: birthday and wedding day, without the years');
check(JSON.stringify(C.forDirectory({ birthDay: '03-09' })) === '{"birthDay":"03-09"}', 'a birthday kept without its year');
check(JSON.stringify(C.forDirectory(Object.assign({ birthDate: '1975-03-09' }, wed, { maritalStatus: 'Widowed' }))) === '{"birthDay":"03-09"}', 'widowed: no wedding day');
check(JSON.stringify(C.forDirectory(Object.assign({ birthDate: '1975-03-09' }, wed), { id: 'late' })) === '{"birthDay":"03-09"}', 'a late spouse on record: no wedding day');
check(JSON.stringify(C.forDirectory({ birthDate: '1975-03-09', noCelebrate: true })) === '{"birthDay":"03-09"}', 'an old noCelebrate is ignored in the directory too');
check(JSON.stringify(C.forDirectory({ birthDate: '2015-03-09', familyRole: 'child' })) === '{}', 'a child: nothing');
check(JSON.stringify(C.forDirectory({ birthDate: '1975-03-09', deceasedAt: '2026-01-01' })) === '{}', 'died: nothing');
check(C.birthday({ birthDay: '11-24' }, TODAY) && C.anniversary({ weddingDay: '11-24' }, null, TODAY), 'what the directory carries is enough to celebrate on the day');

console.log('This week');
check(C.days('2026-12-29', 7).join() === '2026-12-29,2026-12-30,2026-12-31,2027-01-01,2027-01-02,2027-01-03,2027-01-04', 'seven days, over the new year');
const a = { id: 'a', birthDate: '1980-11-26' }, b = { id: 'b', birthDay: '11-24' }, c = { id: 'c', birthDate: '1980-12-25' };
const h1 = Object.assign({ id: 'h1' }, wed), h2 = { id: 'h2', maritalStatus: 'Married' };
const wk = C.week([{ person: a }, { person: b }, { person: c }, { person: h1, spouse: h2 }, { person: h2, spouse: h1 }], TODAY, 7);
check(wk.map(x => x.id + ':' + x.kind + ':' + x.inDays).join() === 'b:birthday:0,h1:anniversary:0,a:birthday:2', 'soonest first, a couple once: ' + wk.map(x => x.id + ':' + x.kind + ':' + x.inDays).join());
check(wk[2].years === 46, '…with the age turning');

console.log('A hard day (Pastors only)');
const widow = { id: 'w', maritalStatus: 'Widowed', keyDates: [{ label: 'Wedding anniversary', date: '1990-06-02' }] }, late = { id: 'l', deceasedAt: '2024-11-24' };
check(C.hardDay(widow, late, TODAY) === 'death', 'the anniversary of the death');
check(C.hardDay(widow, late, '2026-06-02') === 'wedding', 'their wedding anniversary');
check(C.hardDay(widow, late, '2026-06-03') === '', 'any other day: nothing');
check(C.hardDay(widow, late, '2024-11-24') === '', 'not on the day of the death itself');
check(C.hardDay(widow, null, TODAY) === '', 'no late spouse: nothing');
check(C.hardDay(widow, { id: 'l', keyDates: [{ label: 'Died', date: '2020-11-24' }] }, TODAY) === 'death', 'a date of death kept as a key date counts too');
check(C.anniversary(widow, null, '2026-06-02') === null, '…and the widowed person is never wished a happy anniversary');

console.log(fails ? '\n' + fails + ' failed' : '\nAll passed');
process.exit(fails ? 1 : 0);
