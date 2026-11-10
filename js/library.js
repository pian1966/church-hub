/*
 * Church Hub – the church Library: the books the church owns, and who has borrowed which.
 * A book: books/{id} = { title, author, cat, copies, acquired (date), how (Bought | Donated | Other), from (the donor or
 *   shop), shelf, isbn, note, out } – out = how many copies are on loan, kept by the librarian so that everyone can see
 *   whether a book is in, without seeing who has it.
 * A loan: loans/{id} = { bookId, title, personId, name, out (date lent), due, back (date returned, '' while out), note }.
 * Everyone who signs in sees the books. Loans are seen by the librarians (Administrators, and the people an
 * Administrator names: settings.librarianIds) and each borrower sees their own. Returned loans are kept for a year
 * (KEEP_DAYS), then removed. Tested with node: tests/library.test.js. POPIA: see docs/POPIA.md, "Library".
 */
var Library = (function () {
  'use strict';
  var TX = function (x) { return x; };   // translated where it is shown
  var LOAN_DAYS = 21, KEEP_DAYS = 365;
  var HOW = [TX('Bought'), TX('Donated'), TX('Other')];
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  function addDays(iso, n) { var p = String(iso).split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n)); return d.toISOString().slice(0, 10); }
  function text(x, max) { return String(x || '').replace(/\s+/g, ' ').trim().slice(0, max || 150); }
  /** A book ready to save. */
  function book(b) {
    b = b || {};
    var out = { title: text(b.title), author: text(b.author), cat: text(b.cat, 60), copies: Math.max(1, Math.min(99, Math.round(+b.copies) || 1)), acquired: text(b.acquired, 10),
      how: HOW.indexOf(b.how) >= 0 ? b.how : '', from: text(b.from), shelf: text(b.shelf, 60), isbn: text(b.isbn, 20), note: text(b.note, 500), out: Math.max(0, Math.round(+b.out) || 0) };
    ['id', 'createdAt', 'updatedAt'].forEach(function (k) { if (b[k]) out[k] = b[k]; });
    return out;
  }
  function isOut(loan) { return !!loan && !loan.back; }
  /** Loans not yet returned, the ones due first at the top. */
  function onLoan(loans) { return (loans || []).filter(isOut).sort(function (a, b) { return String(a.due || '').localeCompare(String(b.due || '')) || String(a.title || '').localeCompare(String(b.title || '')); }); }
  function overdue(loan, today) { return isOut(loan) && !!loan.due && loan.due < today; }
  /** How many copies of a book are on loan: counted from the loans when they can be seen (librarians), else the book's own count. */
  function outCount(b, loans) { return loans ? loans.filter(function (l) { return isOut(l) && l.bookId === b.id; }).length : Math.max(0, +b.out || 0); }
  /** How many copies are on the shelf. */
  function free(b, loans) { return Math.max(0, (Math.max(1, +b.copies || 1)) - outCount(b, loans)); }
  /** Lend a copy: the loan to save and the book with its new count. null when no copy is in. */
  function lend(b, person, today, due, loans) {
    if (free(b, loans) < 1) return null;
    var x = copy(b); x.out = outCount(b, loans) + 1;
    return { book: x, loan: { bookId: b.id, title: b.title, personId: person.id, name: ((person.preferredName || person.firstName || '') + ' ' + (person.lastName || '')).trim(), out: today, due: due && due >= today ? due : addDays(today, LOAN_DAYS), back: '', note: '' } };
  }
  /** A book came back: the loan with its return date, and the book with its new count (null if the book has gone). */
  function giveBack(loan, b, today, loans) {
    var l = copy(loan); l.back = today;
    var x = b ? copy(b) : null; if (x) x.out = Math.max(0, outCount(b, loans) - (isOut(loan) ? 1 : 0));
    return { loan: l, book: x };
  }
  /** Returned loans old enough to remove (returned more than KEEP_DAYS ago). */
  function stale(loans, today) { var before = addDays(today, -KEEP_DAYS); return (loans || []).filter(function (l) { return !!l.back && l.back < before; }); }
  /** The books someone has out now. */
  function mine(loans, pid) { return onLoan(loans).filter(function (l) { return l.personId === pid; }); }
  /** Books by title; `q` = words typed, each found in the title, author, category, shelf or ISBN. */
  function find(books, q) {
    var words = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
    return (books || []).filter(function (b) { var t = [b.title, b.author, b.cat, b.shelf, b.isbn].join(' ').toLowerCase(); return words.every(function (w) { return t.indexOf(w) >= 0; }); })
      .sort(function (a, b) { return String(a.title || '').localeCompare(String(b.title || '')); });
  }
  /** The categories in use, by name. */
  function cats(books) { var c = {}; (books || []).forEach(function (b) { if (b.cat) c[b.cat] = 1; }); return Object.keys(c).sort(function (a, b) { return a.localeCompare(b); }); }
  function isLibrarian(settings, pid, admin) { return !!admin || (!!pid && ((settings || {}).librarianIds || []).indexOf(pid) >= 0); }

  return { LOAN_DAYS: LOAN_DAYS, KEEP_DAYS: KEEP_DAYS, HOW: HOW, addDays: addDays, book: book, isOut: isOut, onLoan: onLoan, overdue: overdue, outCount: outCount, free: free, lend: lend, giveBack: giveBack, stale: stale, mine: mine, find: find, cats: cats, isLibrarian: isLibrarian };
})();
if (typeof module !== 'undefined') module.exports = Library;
