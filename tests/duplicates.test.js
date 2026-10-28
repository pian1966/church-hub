/* Tests for js/duplicates.js (finding people entered twice). Run: node tests/duplicates.test.js. Made-up people only. */
'use strict';
const D = require('../js/duplicates.js');
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) fails++; };
const lv = (a, b) => D.level(D.compare(a, b).score);

console.log('Cleaning up before comparing');
ok(D.phone('+27 82 123 4567') === '0821234567' && D.phone('082-123-4567') === '0821234567' && D.phone('821234567') === '0821234567', 'mobile numbers: +27, spaces and dashes');
ok(D.email('Doug.Pike+church@GMAIL.com') === 'dougpike@gmail.com' && D.email('d.pike@church.org') === 'd.pike@church.org', 'emails: capitals, Gmail dots and +labels');
ok(D.plain('Zoë  Müller-Smith') === 'zoe muller smith', 'names: accents, capitals, dashes');

console.log('Very likely the same person');
const doug = { id: 'a', firstName: 'Douglas', lastName: 'Pike', preferredName: 'Doug', email: 'doug.pike@gmail.com', mobile: '082 555 1234' };
ok(lv(doug, { id: 'b', firstName: 'Doug', lastName: 'Pike', mobile: '+27825551234' }) === 'likely', 'Douglas (known as Doug) and Doug, same mobile');
ok(lv({ id: 'a', firstName: 'William', lastName: 'Botha' }, { id: 'b', firstName: 'Bill', lastName: 'Botha', email: 'x@y.com' }) === 'possible', 'William and Bill Botha, nothing else: worth a look');
ok(lv({ id: 'a', firstName: 'William', lastName: 'Botha', birthDate: '1970-02-03' }, { id: 'b', firstName: 'Bill', lastName: 'Botha', birthDate: '1970-02-03' }) === 'likely', '…with the same birthday: very likely');
ok(lv({ id: 'a', firstName: 'Jonh', lastName: 'Smith', email: 'js@x.com' }, { id: 'b', firstName: 'John', lastName: 'Smith', email: 'JS@x.com' }) === 'likely', 'a typing slip in the first name, same email');
ok(lv({ id: 'a', firstName: 'Naidoo', lastName: 'Priya' }, { id: 'b', firstName: 'Priya', lastName: 'Naidoo' }) === 'possible', 'first and last name swapped');
ok(lv({ id: 'a', firstName: 'Elsa', lastName: 'van der Merwe', mobile: '0831112222' }, { id: 'b', firstName: 'Elsa', lastName: 'Merwe', mobile: '083 111 2222' }) === 'likely', 'part of a double-barrelled surname, same mobile');
const maiden = D.compare({ id: 'a', firstName: 'Clare', lastName: 'Jacobs', birthDate: '1980-05-06', email: 'clare@x.com' }, { id: 'b', firstName: 'Clare', lastName: 'Adams', birthDate: '1980-05-06' });
ok(D.level(maiden.score) === 'possible' && maiden.reasons.some(r => /maiden/.test(r)), 'a maiden name: same first name and birthday, different surname');
ok(D.compare({ id: 'a', elvantoId: 'e1', firstName: 'X' }, { id: 'b', elvantoId: 'e1', firstName: 'Y' }).score === 100, 'the same Elvanto ID is certain');

console.log('Not duplicates');
ok(!lv({ id: 'a', firstName: 'Tim', lastName: 'Jacobs', email: 'jacobs@x.com', mobile: '0821110000' }, { id: 'b', firstName: 'Clare', lastName: 'Jacobs', email: 'jacobs@x.com', mobile: '0821110000' }), 'husband and wife sharing an email and phone');
ok(!lv({ id: 'a', firstName: 'Johan', lastName: 'van der Merwe', birthDate: '1955-01-01' }, { id: 'b', firstName: 'Johan', lastName: 'van der Merwe', birthDate: '1985-03-03' }), 'father and son with the same name, different birthdays');
ok(!lv({ id: 'a', firstName: 'Sam', lastName: 'Peters', familyRole: 'adult' }, { id: 'b', firstName: 'Sam', lastName: 'Peters', familyRole: 'child' }), 'an adult and a child with the same name');
ok(!lv({ id: 'a', elvantoId: 'e1', firstName: 'Sam', lastName: 'Peters' }, { id: 'b', elvantoId: 'e2', firstName: 'Sam', lastName: 'Peters' }), 'two different Elvanto IDs');
ok(!lv({ id: 'a', firstName: 'Anna', lastName: 'Smith' }, { id: 'b', firstName: 'Megan', lastName: 'Smith' }), 'different first names, same surname');
ok(!lv({ id: 'a', firstName: 'Sipho', lastName: 'Dlamini' }, { id: 'b', firstName: 'Sipho', lastName: 'Nkosi' }), 'same first name only');

console.log('Searching everyone');
const people = [
  { id: 'p1', firstName: 'Douglas', lastName: 'Pike', mobile: '0825551234' },
  { id: 'p2', firstName: 'Doug', lastName: 'Pike', mobile: '+27 82 555 1234' },
  { id: 'p3', firstName: 'Tim', lastName: 'Jacobs', email: 'j@x.com' }, { id: 'p4', firstName: 'Clare', lastName: 'Jacobs', email: 'j@x.com' },
  { id: 'p5', firstName: 'Thandi', lastName: 'Mokoena', birthDate: '1975-04-04' }, { id: 'p6', firstName: 'Thandiwe', lastName: 'Mokoena', birthDate: '1975-04-04' },
  { id: 'p7', firstName: 'Deleted', lastName: 'Pike', mobile: '0825551234' }
];
const all = D.find(people);
ok(all.length === 2 && all.some(d => D.pair(d.a, d.b) === 'p1|p2') && all.some(d => D.pair(d.a, d.b) === 'p5|p6'), 'finds Doug/Douglas and Thandi/Thandiwe, not the married couple or deleted records');
ok(all.every(d => d.reasons.length), 'every suggestion says why');
ok(D.find(people, ['p1|p2']).length === 1, '“Not the same person” is remembered');
const many = []; for (let i = 0; i < 3000; i++) many.push({ id: 'x' + i, firstName: 'Name' + (i % 50), lastName: 'Surname' + i, mobile: '08' + String(10000000 + i) });
const t0 = Date.now(); D.find(many); ok(Date.now() - t0 < 3000, 'quick with 3000 people (' + (Date.now() - t0) + ' ms)');

console.log('While typing a new person');
const m = D.matches({ firstName: 'Doug', lastName: 'Pike' }, people);
ok(m[0] && m[0].id === 'p2' && m.some(x => x.id === 'p1') && !m.some(x => x.id === 'p7'), 'typing “Doug Pike” warns about Douglas and Doug Pike');
ok(!D.matches({ id: 'p1', firstName: 'Douglas', lastName: 'Pike', mobile: '0825551234' }, people).some(x => x.id === 'p1'), 'editing someone doesn’t match them with themselves');
ok(!D.matches({ id: 'p1', firstName: 'Douglas', lastName: 'Pike' }, people, ['p1|p2']).some(x => x.id === 'p2'), 'pairs marked “not the same person” are not warned about again');

console.log('Fixing a duplicate');
{
  const keep = { id: 'k', firstName: 'Doug', lastName: 'Pike', email: 'doug@x.com', mobile: '', category: 'Partner', createdAt: '2025-03-01', familyId: 'f1',
    keyDates: [{ label: 'Baptised', date: '2001-01-01' }], appRole: 'member' };
  const drop = { id: 'd', firstName: 'Douglas', lastName: 'Pike', email: 'dpike@work.com', mobile: '082 555 1234', birthDate: '1970-02-03', category: 'Attender',
    createdAt: '2019-06-01', familyId: 'f2', householdIds: ['f3'], keyDates: [{ label: 'Wedding anniversary', date: '1995-05-05' }, { label: 'baptised', date: '1999-09-09' }],
    elvantoId: 'e9', appRole: 'admin', medical: { allergies: 'x' }, notSame: ['z'] };
  const m = D.mergeFields(keep, drop), p = m.person;
  ok(p.firstName === 'Douglas' && p.preferredName === 'Doug', 'Doug + Douglas: first name Douglas, known as Doug');
  ok(p.mobile === '082 555 1234' && p.birthDate === '1970-02-03' && p.elvantoId === 'e9', 'gaps filled from the other record (mobile, birthday, Elvanto ID)');
  ok(p.email === 'doug@x.com' && m.differs.some(d => d.field === 'email' && d.value === 'dpike@work.com'), 'nothing overwritten: a different email is listed, not copied');
  ok(p.familyId === 'f1' && p.householdIds.join() === 'f2,f3', 'kept household stays; the other’s households are added as extra homes');
  ok(p.keyDates.length === 2 && p.keyDates.some(k => /Wedding/.test(k.label)) && p.keyDates.find(k => k.label === 'Baptised').date === '2001-01-01', 'key dates: added if missing, never replaced');
  ok(p.category === 'Partner' && p.appRole === 'member' && !p.medical, 'category and app access stay; medical notes aren’t touched');
  ok(p.createdAt === '2019-06-01' && p.notSame.join() === 'z', 'known since the earlier date; “not the same person” carried over');
  ok(D.mergeFields({ id: 'k', firstName: 'Anna', lastName: 'X' }, { id: 'd', firstName: 'Hanna', lastName: 'X' }).differs.some(d => d.field === 'firstName'), 'unrelated first names: listed, not changed');
  ok(!D.mergeFields({ id: 'k', firstName: 'A', lastName: 'B', mobile: '082 555 1234', email: 'A.B@gmail.com' }, { id: 'd', firstName: 'A', lastName: 'B', mobile: '+27825551234', email: 'ab@gmail.com' }).differs.length, 'the same mobile or email written differently isn’t called different');
  ok(D.ignored([{ id: 'a', notSame: ['b'] }, { id: 'b', notSame: ['a'] }]).every(k => k === 'a|b'), '“not the same person” is read from the people themselves');
  ok(!D.find([{ id: 'a', firstName: 'Ann', lastName: 'Lee', mobile: '0821112222' }, { id: 'b', firstName: 'Ann', lastName: 'Lee', mobile: '0821112222', mergedInto: 'a' }]).length, 'a retired (merged) record is never suggested again');
}

console.log(fails ? '\n' + fails + ' FAILED' : '\nAll duplicate tests passed');
process.exit(fails ? 1 : 0);
