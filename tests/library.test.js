/* Tests for js/library.js (the church Library). Run: node tests/library.test.js */
'use strict';
const L = require('../js/library.js');
let fails = 0;
function ok(c, what) { if (!c) { fails++; console.log('  ✗ ' + what); } else console.log('  ✓ ' + what); }

let b = L.book({ id: 'b1', title: '  Knowing   God ', author: 'J. I. Packer', cat: 'Theology', copies: '2', how: 'Donated', from: 'The Pike family', acquired: '2026-05-01', junk: 1 });
ok(b.title === 'Knowing God' && b.copies === 2 && b.how === 'Donated' && b.out === 0 && b.junk === undefined && b.id === 'b1', 'a book is tidied before saving');
ok(L.book({ title: 'X', copies: 0, how: 'Stolen' }).copies === 1 && L.book({ title: 'X', how: 'Stolen' }).how === '' && L.book({ copies: 500 }).copies === 99, 'at least one copy; only known ways of getting a book');
ok(L.addDays('2026-12-20', 21) === '2027-01-10' && L.addDays('2026-03-01', -1) === '2026-02-28', 'dates');

const tim = { id: 'p14', firstName: 'Timothy', preferredName: 'Tim', lastName: 'Jacobs' }, clare = { id: 'p15', firstName: 'Clare', lastName: 'Jacobs' };
let loans = [];
let one = L.lend(b, tim, '2026-11-10', '', loans);
ok(one.loan.name === 'Tim Jacobs' && one.loan.due === '2026-12-01' && one.loan.back === '' && one.loan.title === 'Knowing God' && one.book.out === 1 && b.out === 0, 'lending: three weeks unless another date is chosen (the book given is untouched)');
loans.push(Object.assign({ id: 'l1' }, one.loan)); b = one.book;
let two = L.lend(b, clare, '2026-11-12', '2026-11-20', loans);
ok(two.loan.due === '2026-11-20' && two.book.out === 2, 'a second copy, with a date chosen');
loans.push(Object.assign({ id: 'l2' }, two.loan)); b = two.book;
ok(L.lend(b, clare, '2026-11-12', '', loans) === null && L.free(b, loans) === 0 && L.free(b) === 0, 'no copy left: it can’t be lent');
ok(L.lend(L.book({ id: 'b9', title: 'Y' }), tim, '2026-11-12', '2026-11-01', []).loan.due === '2026-12-03', 'a due date before today becomes three weeks');
ok(L.onLoan(loans).map(l => l.id).join() === 'l2,l1' && L.overdue(loans[1], '2026-11-21') && !L.overdue(loans[1], '2026-11-20') && L.mine(loans, 'p14').length === 1, 'on loan: due soonest first; overdue the day after it was due; my own books');
const back = L.giveBack(loans[1], b, '2026-11-22', loans);
ok(back.loan.back === '2026-11-22' && back.book.out === 1 && loans[1].back === '' && L.giveBack(back.loan, back.book, '2026-11-23', [loans[0], back.loan]).book.out === 1, 'returning: the date is kept and a copy is back on the shelf (not twice)');
ok(L.giveBack(loans[0], null, '2026-11-22', loans).book === null, 'a book since deleted: the loan is still closed');
loans[1] = back.loan;
ok(L.free(back.book, loans) === 1 && L.free({ id: 'b1', copies: 2, out: 1 }) === 1 && L.outCount({ id: 'b1', out: 7 }, loans) === 1, 'copies in: counted from the loans when they can be seen, else the book’s own count');
ok(L.stale(loans, '2027-11-22').length === 0 && L.stale(loans, '2027-11-23').map(l => l.id).join() === 'l2' && L.stale([loans[0]], '2030-01-01').length === 0, 'returned loans are removed after a year; never one still out');
const books = [b, L.book({ id: 'b2', title: 'Mere Christianity', author: 'C. S. Lewis', cat: 'Apologetics', shelf: 'B2' }), L.book({ id: 'b3', title: 'A Grief Observed', author: 'C. S. Lewis' })];
ok(L.find(books, 'lewis').map(x => x.id).join() === 'b3,b2' && L.find(books, 'LEWIS mere').length === 1 && L.find(books, 'b2 apolog').length === 1 && L.find(books, '').length === 3 && L.cats(books).join() === 'Apologetics,Theology', 'finding books by any words; the categories in use');
ok(L.isLibrarian({ librarianIds: ['p14'] }, 'p14') && !L.isLibrarian({ librarianIds: ['p14'] }, 'p15') && L.isLibrarian({}, 'p15', true) && !L.isLibrarian(null, ''), 'librarians: Administrators and the people named');

if (fails) { console.log('\n' + fails + ' library test(s) FAILED'); process.exit(1); }
console.log('\nAll library tests passed');
