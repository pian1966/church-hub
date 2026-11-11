/* Tests for js/library.js (the church Library). Run: node tests/library.test.js */
'use strict';
const L = require('../js/library.js');
let fails = 0;
function ok(c, what) { if (!c) { fails++; console.log('  ✗ ' + what); } else console.log('  ✓ ' + what); }

let b = L.book({ id: 'b1', title: '  Knowing   God ', author: 'J. I. Packer', cat: 'Theology', copies: '2', how: 'Donated', from: 'The Pike family', acquired: '2026-05-01', junk: 1 });
ok(b.title === 'Knowing God' && b.copies === 2 && b.how === 'Donated' && b.out === 0 && b.junk === undefined && b.id === 'b1', 'a book is tidied before saving');
ok(L.book({ title: 'X', copies: 0, how: 'Stolen' }).copies === 1 && L.book({ title: 'X', how: 'Stolen' }).how === '' && L.book({ copies: 500 }).copies === 99, 'at least one copy; only known ways of getting a book');
ok(L.addDays('2026-12-20', 21) === '2027-01-10' && L.addDays('2026-03-01', -1) === '2026-02-28', 'dates');

const tim = { id: 'p14', firstName: 'Timothy', preferredName: 'Tim', lastName: 'Jacobs', mobile: '082 000 1518' }, clare = { id: 'p15', firstName: 'Clare', lastName: 'Jacobs', mobile: '+27 82 000 1555' };
let loans = [];
let one = L.lend(b, tim, '2026-11-10', '', loans);
ok(one.loan.name === 'Tim Jacobs' && one.loan.mobile === '082 000 1518' && one.loan.visitor === false && one.loan.due === '2026-12-01' && one.loan.back === '' && one.loan.title === 'Knowing God' && one.book.out === 1 && b.out === 0, 'lending: three weeks unless another date is chosen (the book given is untouched)');
loans.push(Object.assign({ id: 'l1' }, one.loan)); b = one.book;
let two = L.lend(b, clare, '2026-11-12', '2026-11-20', loans);
ok(two.loan.due === '2026-11-20' && two.book.out === 2, 'a second copy, with a date chosen');
loans.push(Object.assign({ id: 'l2' }, two.loan)); b = two.book;
ok(L.lend(b, clare, '2026-11-12', '', loans) === null && L.free(b, loans) === 0 && L.free(b) === 0, 'no copy left: it can’t be lent');
ok(L.lend(L.book({ id: 'b9', title: 'Y' }), tim, '2026-11-12', '2026-11-01', []).loan.due === '2026-12-03', 'a due date before today becomes three weeks');
ok(L.onLoan(loans).map(l => l.id).join() === 'l2,l1' && L.overdue(loans[1], '2026-11-21') && !L.overdue(loans[1], '2026-11-20') && L.mine(loans, 'p14').length === 1, 'on loan: due soonest first; overdue the day after it was due; my own books');
const back = L.giveBack(loans[1], b, '2026-11-22', loans);
ok(back.loan.mobile === '' && back.loan.back === '2026-11-22' && back.book.out === 1 && loans[1].back === '' && L.giveBack(back.loan, back.book, '2026-11-23', [loans[0], back.loan]).book.out === 1, 'returning: the date is kept and a copy is back on the shelf (not twice)');
ok(L.giveBack(loans[0], null, '2026-11-22', loans).book === null, 'a book since deleted: the loan is still closed');
loans[1] = back.loan;
ok(L.free(back.book, loans) === 1 && L.free({ id: 'b1', copies: 2, out: 1 }) === 1 && L.outCount({ id: 'b1', out: 7 }, loans) === 1, 'copies in: counted from the loans when they can be seen, else the book’s own count');
ok(L.stale(loans, '2027-11-22').length === 0 && L.stale(loans, '2027-11-23').map(l => l.id).join() === 'l2' && L.stale([loans[0]], '2030-01-01').length === 0, 'returned loans are removed after a year; never one still out');
const books = [b, L.book({ id: 'b2', title: 'Mere Christianity', author: 'C. S. Lewis', cat: 'Apologetics', shelf: 'B2' }), L.book({ id: 'b3', title: 'A Grief Observed', author: 'C. S. Lewis' })];
ok(L.find(books, 'lewis').map(x => x.id).join() === 'b3,b2' && L.find(books, 'LEWIS mere').length === 1 && L.find(books, 'b2 apolog').length === 1 && L.find(books, '').length === 3 && L.cats(books).join() === 'Apologetics,Theology', 'finding books by any words; the categories in use');
ok(L.isLibrarian({ librarianIds: ['p14'] }, 'p14') && !L.isLibrarian({ librarianIds: ['p14'] }, 'p15') && L.isLibrarian({}, 'p15', true) && !L.isLibrarian(null, ''), 'librarians: Administrators and the people named');

// Items other than books, and their covers
ok(L.book({ title: 'The Chosen', kind: 'DVD' }).kind === 'DVD' && L.book({ title: 'X' }).kind === 'Book' && L.book({ title: 'X', kind: 'Spaceship' }).kind === 'Book', 'an item is a book unless another kind is chosen');
ok(L.book({ title: 'X', cover: '2026-11-11 10:00 ab12' }).cover === '2026-11-11 10:00 ab12' && L.book({ title: 'X' }).cover === undefined, 'a cover picture’s version is kept with the item');
ok(L.find([L.book({ id: 'd1', title: 'The Chosen', kind: 'DVD' }), L.book({ id: 'b1', title: 'Chosen by God' })], 'dvd').map(x => x.id).join() === 'd1', 'items can be found by their kind');

// Mobile numbers: every borrower needs one, so a book can be traced
ok(L.phone(' 082 000 1234 ') === '082 000 1234' && L.phone('+27 (82) 000-1234') === '+27 (82) 000-1234' && L.phone('12345') === '' && L.phone('call me') === '' && L.phone('1234567890123456') === '', 'a mobile number has 7 to 15 digits');
let w = L.borrower(tim);
ok(w.personId === 'p14' && w.name === 'Tim Jacobs' && w.mobile === '082 000 1518' && w.visitor === false, 'someone on the church’s list: their own mobile number');
ok(L.borrower({ id: 'p16', firstName: 'Sam', lastName: 'Ndlovu' }).error === 'mobile', 'someone with no mobile on record can’t borrow until one is given …');
w = L.borrower({ id: 'p16', firstName: 'Sam', lastName: 'Ndlovu' }, { mobile: '072 555 0101' });
ok(w.mobile === '072 555 0101' && w.personId === 'p16', '… and then they can');
ok(L.borrower(tim, { mobile: '071 999 0000' }).mobile === '071 999 0000', 'a number typed at the desk is used instead of the one on record');
ok(L.borrower(null, { name: 'Jane Visitor' }).error === 'mobile' && L.borrower(null, { mobile: '072 555 0101' }).error === 'name', 'a visitor gives a name and a mobile number');
w = L.borrower(null, { name: '  Jane   Visitor ', mobile: '072 555 0101' });
ok(w.personId === '' && w.visitor === true && w.name === 'Jane Visitor', 'a visitor who isn’t on the church’s list');
const vb = L.book({ id: 'b7', title: 'Prayer' }), vl = L.lend(vb, w, '2026-11-11', '', []);
ok(vl.loan.personId === '' && vl.loan.visitor === true && vl.loan.mobile === '072 555 0101' && vl.book.out === 1, 'lending to a visitor');
ok(L.lend(vb, L.borrower(null, { name: 'No Phone' }), '2026-11-11', '', []) === null && L.lend(vb, { id: 'p16', firstName: 'Sam' }, '2026-11-11', '', []) === null, 'never lent without a mobile number');
ok(L.mine([Object.assign({ id: 'v1' }, vl.loan)], '').length === 1 && L.mine([Object.assign({ id: 'v1' }, vl.loan)], 'p14').length === 0, 'a visitor’s loan is nobody’s on the church’s list');

// Librarians: at most two (Administrators always are)
ok(L.MAX_LIBRARIANS === 2 && L.roomForLibrarian({ librarianIds: ['p1'] }) && !L.roomForLibrarian({ librarianIds: ['p1', 'p2'] }) && L.roomForLibrarian(null), 'one or two librarians');

// The library's policy
let pol = L.policy({ text: '  Books are lent for three weeks.\r\nPlease look after them.  ', name: 'Policy.pdf', type: 'application/pdf', data: 'JVBERi0x' });
ok(pol.text === 'Books are lent for three weeks.\nPlease look after them.' && pol.name === 'Policy.pdf' && pol.data === 'JVBERi0x', 'the policy: pasted words and an attached file');
ok(L.policy({ text: 'x'.repeat(30000) }).text.length === L.POLICY_MAX && L.policy({ text: 'Only words', data: 'abc' }).name === undefined, 'a long policy is cut to size; a file needs its name');

// friendly reminders, three weeks after borrowing
const lo = { bookId: 'b1', title: 'Mere Christianity', personId: 'p1', out: '2026-10-01', due: '2026-10-22', back: '' };
ok(L.daysOut(lo, '2026-10-21') === 20 && !L.remindDue(lo, '2026-10-21') && L.remindDue(lo, '2026-10-22'), 'how many days they have had it; a reminder is due after three weeks');
ok(!L.remindDue(Object.assign({}, lo, { reminded: '2026-10-22' }), '2026-10-28') && L.remindDue(Object.assign({}, lo, { reminded: '2026-10-22' }), '2026-10-29'), 'and again a week after the last reminder');
ok(!L.remindDue(Object.assign({}, lo, { back: '2026-11-01' }), '2026-11-20') && L.daysOut(Object.assign({}, lo, { back: '2026-10-05' }), '2026-11-20') === 4, 'not once it is back');
ok(L.intl('082 555 1234', '+27') === '27825551234' && L.intl('+27 82 555 1234', '+27') === '27825551234' && L.intl('0044 7700 900123', '+27') === '447700900123', 'a mobile number for WhatsApp, with the country code');

if (fails) { console.log('\n' + fails + ' library test(s) FAILED'); process.exit(1); }
console.log('\nAll library tests passed');
