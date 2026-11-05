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
ok(lv({ id: 'a', elvantoId: 'e1', firstName: 'Sam', lastName: 'Peters' }, { id: 'b', elvantoId: 'e2', firstName: 'Sam', lastName: 'Peters' }) === 'possible', 'two different Elvanto IDs: still worth a look (Elvanto has duplicates), never more');
ok(lv({ id: 'a', elvantoId: 'e1', firstName: 'Sam', lastName: 'Peters', mobile: '082 555 1234' }, { id: 'b', elvantoId: 'e2', firstName: 'Sam', lastName: 'Peters', mobile: '082 555 1234' }) === 'possible', 'two Elvanto IDs with the same mobile: “possibly”, not “very likely”');
ok(lv({ id: 'a', firstName: 'And', lastName: 'Pike', mobile: '+27845725244' }, { id: 'b', firstName: 'Andrew', preferredName: 'Andy', lastName: 'Pike', mobile: '084 572 5244' }) === 'likely', 'a first name cut short (“And” for Andy) with the same mobile');
ok(!lv({ id: 'a', firstName: 'Chris', lastName: 'Pike' }, { id: 'b', firstName: 'Christine', lastName: 'Pike', familyRole: 'spouse' }) || D.compare({ id: 'a', firstName: 'Chris', lastName: 'Pike' }, { id: 'b', firstName: 'Christine', lastName: 'Pike' }).reasons.indexOf('One first name is the start of the other (chris / christine)') < 0, 'a cut-off name alone (no shared contact details) adds nothing');
ok(!lv({ id: 'a', firstName: 'Ann', lastName: 'Pike', mobile: '082 111 2222' }, { id: 'b', firstName: 'Megan', lastName: 'Pike', mobile: '082 111 2222' }), 'a different first name with a shared family phone is still not a duplicate');
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

console.log('Names that sound alike or are spelt differently');
const first = (a, b) => D.compare({ id: 'a', firstName: a, lastName: 'Pike' }, { id: 'b', firstName: b, lastName: 'Pike' });
ok(['Stephen|Steven', 'Catherine|Kathryn', 'Jon|John', 'Sean|Shaun', 'Mark|Marco'].every(x => D.level(first(...x.split('|')).score) === 'possible'), 'sound-alike first names: Stephen/Steven, Catherine/Kathryn, Jon/John, Sean/Shaun, Mark/Marco');
ok(['Ruth|Rita', 'Jan|Jon', 'Tim|Tom', 'Liam|Leah', 'Naidoo|Nadia'].every(x => !D.level(first(...x.split('|')).score)), 'but short names that only share consonants stay different (Ruth/Rita, Jan/Jon, Tim/Tom)');
ok(D.compare({ id: 'a', firstName: 'Priya', lastName: 'Pillay' }, { id: 'b', firstName: 'Priya', lastName: 'Pillai' }).score >= 45, 'surnames spelt differently: Pillay / Pillai');
ok(D.compare({ id: 'a', firstName: 'Anne-Marie', lastName: 'Botha' }, { id: 'b', firstName: 'Annemarie', lastName: 'Botha' }).first === 'same', 'Anne-Marie and Annemarie are the same first name');
ok(D.compare({ id: 'a', firstName: 'Elsa', lastName: 'vd Merwe' }, { id: 'b', firstName: 'Elsa', lastName: 'van der Merwe' }).last === 'same', '“vd Merwe” is “van der Merwe”');

console.log('Live check while typing');
const town = [
  { id: 'q1', firstName: 'Douglas', lastName: 'Pike', email: 'doug.pike@gmail.com', mobile: '082 555 1234' },
  { id: 'q2', firstName: 'Tim', lastName: 'Jacobs', email: 'jacobs@x.com', mobile: '0821110000' },
  { id: 'q3', firstName: 'Dawn', lastName: 'Pillay' }, { id: 'q4', firstName: 'Sipho', lastName: 'Nkosi' }, { id: 'q5', firstName: 'Sipho', lastName: 'Dlamini' },
  { id: 'q6', firstName: 'Ann', lastName: 'Old', mobile: '0820000000', mergedInto: 'q1' }
];
let L = D.live({ firstName: 'Do', lastName: 'Pi' }, town);
ok(L.people.length === 1 && L.people[0].id === 'q1' && L.people[0].level === 'similar', 'two letters of each name already point to Douglas Pike (not Dawn Pillay)');
ok(D.live({ firstName: 'Timoth', lastName: 'Jac' }, town).people.some(m => m.id === 'q2'), '“Timoth Jac…” (on the way to Timothy) already points to Tim Jacobs');
L = D.live({ firstName: 'Sipho', lastName: 'Nk' }, town);
ok(L.people.map(m => m.id).join() === 'q4' && L.people[0].level === 'possible', '“Sipho Nk…”: Sipho Nkosi, not every Sipho');
ok(!D.live({ firstName: 'Sipho', lastName: 'N' }, town).people.length && !D.live({ firstName: 'S', lastName: 'Nkosi' }, town).people.length, 'one letter isn’t enough to warn');
L = D.live({ firstName: '', lastName: '', email: 'Doug.Pike+church@GMAIL.com', mobile: '+27 82 111 0000' }, town);
ok(L.email.join() === 'q1' && L.mobile.join() === 'q2', 'an email or mobile already on someone’s record is found on its own, before any name is typed');
ok(!D.live({ mobile: '0820000000' }, town).mobile.length, 'retired (merged) records are left out');
ok(!D.live({ id: 'q1', firstName: 'Douglas', lastName: 'Pike', email: 'doug.pike@gmail.com', mobile: '0825551234' }, town).email.length, 'editing someone doesn’t find their own email');
L = D.live({ firstName: 'Doug', lastName: 'Pike', mobile: '082 555 1234' }, town);
ok(L.people[0].id === 'q1' && L.people[0].level === 'likely', 'name and mobile together: very likely the same person');

console.log('Sensitivity (1 = fewer warnings … 5 = more)');
const bill = [{ id: 'a', firstName: 'William', lastName: 'Botha' }, { id: 'b', firstName: 'Bill', lastName: 'Botha' }];
ok(D.find(bill, [], 3).length === 1 && D.find(bill, [], 1).length === 0, 'William/Bill Botha (nothing else): shown normally, not at the lowest setting');
const tj = [{ id: 'a', firstName: 'Tim', lastName: 'Jacobs', mobile: '0821110000' }, { id: 'b', firstName: 'Timothy', lastName: 'Jacobs', mobile: '0821110000' }];
ok([1, 2, 3, 4, 5].every(n => D.find(tj, [], n)[0] && D.find(tj, [], n)[0].level === 'likely'), '“very likely” (which stops saving) is the same at every setting');
const fam = [{ id: 'a', firstName: 'Tim', lastName: 'Jacobs', email: 'j@x.com' }, { id: 'b', firstName: 'Clare', lastName: 'Jacobs', email: 'j@x.com' }];
ok(!D.find(fam, [], 5).length, 'even at the highest setting a husband and wife sharing an email aren’t called duplicates');
ok(!D.live({ firstName: 'Sipho', lastName: 'N' }, town, [], 3).people.length && D.live({ firstName: 'Sipho', lastName: 'N' }, town, [], 5).people.some(m => m.id === 'q4'), 'at the higher settings one letter of the surname is enough to start');
ok(!D.live({ firstName: 'Do', lastName: 'Pi' }, town, [], 1).people.length, 'at the lowest setting no “similar name” hints');

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

console.log('Partly typed contact details and addresses (live)');
{
  const ppl = [
    { id: 'a', firstName: 'Thandi', lastName: 'Mokoena', email: 'thandi.mokoena@gmail.com', mobile: '082 555 1234', address: { street: '12 Main Road' }, familyId: 'f1' },
    { id: 'b', firstName: 'Sipho', lastName: 'Mokoena', mobile: '+27 83 000 1111', address: { street: '12 Main Road' }, familyId: 'f1' },
    { id: 'c', firstName: 'Ann', lastName: 'Lee', email: 'ann.lee@example.com', mobile: '+44 7700 900123', address: { street: '5 Oak St' }, familyId: 'f2' }];
  const L = p => D.live(Object.assign({ firstName: '', lastName: '' }, p), ppl, [], 3, { dial: '27' });
  ok(L({ mobile: '082 555 1' }).mobileLike.join() === 'a', 'seven digits of a mobile already point to who has a number starting that way');
  ok(L({ mobile: '+27 82 555 1' }).mobileLike.join() === 'a' && L({ mobile: '0027 82 555 1' }).mobileLike.join() === 'a', '“+27 82…” and “0027 82…” are read as “082…”');
  ok(!L({ mobile: '082 555' }).mobileLike.length, 'six digits are not enough yet');
  ok(L({ mobile: '082 555 1234' }).mobile.join() === 'a' && !L({ mobile: '082 555 1234' }).mobileLike.length, 'the whole number is “already used”, not “starts like”');
  ok(!L({ mobile: '+44 7700 9' }).mobileLike.length && L({ mobile: '+44 7700 900123' }).mobile.join() === 'c', 'a number from abroad is only matched once it is complete');
  ok(L({ email: 'thandi' }).emailLike.join() === 'a' && L({ email: 'ann.l@' }).emailLike.length === 0 && L({ email: 'ann.lee@ex' }).emailLike.join() === 'c', 'an email is hinted at from 6 characters, or once the part before the @ is typed');
  ok(!L({ email: 'than' }).emailLike.length && !L({ email: 'a@' }).emailLike.length, 'too little of an email says nothing');
  ok(L({ email: 'Thandi.Mokoena@gmail.com' }).email.join() === 'a' && !L({ email: 'Thandi.Mokoena@gmail.com' }).emailLike.length, 'the whole email is “already used”, not “starts like”');
  ok(L({ address: { street: '12 Mai' } }).addressLike.join() === 'a,b', 'a house number and three letters find addresses starting that way');
  ok(L({ address: { street: '12 Main Rd' } }).address.join() === 'a,b' && L({ address: { street: '5 Oak Street' } }).address.join() === 'c', 'Rd and Road, St and Street are the same address');
  ok(!L({ address: { street: '12 Main Rd' }, familyId: 'f1' }).address.length, 'people in the household chosen for this person are left out');
  ok(!L({ address: { street: 'Main Road' } }).addressLike.length && !L({ address: { street: '12 Ma' } }).addressLike.length, 'without a house number, or with only two letters, nothing is said');
}

console.log(fails ? '\n' + fails + ' FAILED' : '\nAll duplicate tests passed');
process.exit(fails ? 1 : 0);
