/*
 * Church Hub – the church Library: the books the church owns, and who has borrowed which.
 * An item (a book, DVD, CD…): books/{id} = { kind (KINDS; 'Book' when not set), title, author, cat, copies, acquired (date),
 *   how (Bought | Donated | Other), from (the donor or shop), shelf, isbn, note, out, cover } – out = how many copies are on
 *   loan, kept by the librarian so that everyone can see whether it is in, without seeing who has it; cover = the version
 *   of its cover picture, kept apart in covers/{id} and fetched only when shown.
 * A loan: loans/{id} = { bookId, title, personId ('' for a visitor), name, mobile, visitor (true for someone not on the
 *   church's list), out (date lent), due, back (date returned, '' while out), note, reminded (the last friendly reminder) }.
 * A friendly reminder is due REMIND_DAYS (3 weeks) after an item was borrowed, and again each REMIND_AGAIN days after that. Every loan needs a mobile number so a
 *   book can be traced; the number is cleared when the book comes back.
 * Everyone who signs in sees the items and the library's policy. Loans are seen by the librarians (Administrators, and up
 * to MAX_LIBRARIANS people chosen by an Administrator or the Senior Pastor: settings.librarianIds) and each borrower sees
 * their own. Returned loans are kept for a year (KEEP_DAYS), then removed.
 * Tested with node: tests/library.test.js. POPIA: see docs/POPIA.md, "Library".
 */
var Library = (function () {
  'use strict';
  var TX = function (x) { return x; };   // translated where it is shown
  var LOAN_DAYS = 21, REMIND_DAYS = 21, REMIND_AGAIN = 7, KEEP_DAYS = 365, MAX_LIBRARIANS = 2, POLICY_MAX = 20000;
  var HOW = [TX('Bought'), TX('Donated'), TX('Other')];
  var KINDS = [TX('Book'), TX('DVD'), TX('CD'), TX('Audiobook'), TX('Magazine'), TX('Game'), TX('Other')];
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  function addDays(iso, n) { var p = String(iso).split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n)); return d.toISOString().slice(0, 10); }
  function text(x, max) { return String(x || '').replace(/\s+/g, ' ').trim().slice(0, max || 150); }
  /** A book ready to save. */
  function book(b) {
    b = b || {};
    var out = { kind: KINDS.indexOf(b.kind) >= 0 ? b.kind : 'Book', title: text(b.title), author: text(b.author), cat: text(b.cat, 60), copies: Math.max(1, Math.min(99, Math.round(+b.copies) || 1)), acquired: text(b.acquired, 10),
      how: HOW.indexOf(b.how) >= 0 ? b.how : '', from: text(b.from), shelf: text(b.shelf, 60), isbn: text(b.isbn, 20), note: text(b.note, 500), out: Math.max(0, Math.round(+b.out) || 0) };
    if (b.cover) out.cover = text(b.cover, 40);
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
  /** A mobile number tidied for saving: digits, spaces, a leading + and ( ) - kept; '' unless it has 7 to 15 digits. */
  function phone(s) {
    var t = String(s || '').replace(/[^\d+()\- ]/g, '').replace(/\s+/g, ' ').trim(), d = t.replace(/\D/g, '');
    return d.length >= 7 && d.length <= 15 ? t.slice(0, 30) : '';
  }
  /** Who is borrowing: someone on the church's list (a person, with the mobile typed if their record has none) or a
   *  visitor ({ name, mobile }). → { personId, name, mobile, visitor } or { error: 'name' | 'mobile' }. */
  function borrower(person, typed) {
    typed = typed || {};
    if (person) {
      var m = phone(typed.mobile) || phone(person.mobile);
      return m ? { personId: person.id, name: ((person.preferredName || person.firstName || '') + ' ' + (person.lastName || '')).trim(), mobile: m, visitor: false } : { error: 'mobile' };
    }
    var n = text(typed.name, 100), mv = phone(typed.mobile);
    return !n ? { error: 'name' } : !mv ? { error: 'mobile' } : { personId: '', name: n, mobile: mv, visitor: true };
  }
  /** Lend a copy: the loan to save and the item with its new count. null when no copy is in.
   *  `who` is from borrower() (a person given straight in is taken as one with the mobile on their record). */
  function lend(b, who, today, due, loans) {
    if (free(b, loans) < 1) return null;
    if (!who || who.error) return null;
    if (who.personId === undefined) who = borrower(who);
    if (who.error) return null;
    var x = copy(b); x.out = outCount(b, loans) + 1;
    return { book: x, loan: { bookId: b.id, title: b.title, personId: who.personId, name: who.name, mobile: who.mobile, visitor: !!who.visitor, out: today, due: due && due >= today ? due : addDays(today, LOAN_DAYS), back: '', note: '' } };
  }
  /** A book came back: the loan with its return date, and the book with its new count (null if the book has gone). */
  function giveBack(loan, b, today, loans) {
    var l = copy(loan); l.back = today; l.mobile = '';   // no longer needed once it is back
    var x = b ? copy(b) : null; if (x) x.out = Math.max(0, outCount(b, loans) - (isOut(loan) ? 1 : 0));
    return { loan: l, book: x };
  }
  /** Returned loans old enough to remove (returned more than KEEP_DAYS ago). */
  function stale(loans, today) { var before = addDays(today, -KEEP_DAYS); return (loans || []).filter(function (l) { return !!l.back && l.back < before; }); }
  /** How many days someone has had an item (to today, or to the day it came back). */
  function daysOut(loan, today) {
    if (!loan || !loan.out) return 0;
    var a = String(loan.out).split('-'), b = String(loan.back || today).split('-');
    return Math.max(0, Math.round((Date.UTC(+b[0], +b[1] - 1, +b[2]) - Date.UTC(+a[0], +a[1] - 1, +a[2])) / 86400000));
  }
  /** Is a friendly reminder due? Three weeks after it was borrowed, then again a week after the last reminder. */
  function remindDue(loan, today) {
    if (!isOut(loan) || daysOut(loan, today) < REMIND_DAYS) return false;
    return !loan.reminded || loan.reminded <= addDays(today, -REMIND_AGAIN);
  }
  /** A mobile number for WhatsApp: digits only, with the country's dialling code (+27) in place of a leading 0. */
  function intl(mobile, dial) {
    var t = String(mobile || '').replace(/[^\d+]/g, ''), code = String(dial || '').replace(/\D/g, '');
    if (/^\+/.test(t)) return t.slice(1); if (/^00/.test(t)) return t.slice(2);
    return code && /^0/.test(t) ? code + t.slice(1) : t;
  }
  /** The books someone has out now. */
  function mine(loans, pid) { return onLoan(loans).filter(function (l) { return l.personId === pid; }); }
  /** Books by title; `q` = words typed, each found in the title, author, category, shelf or ISBN. */
  function find(books, q) {
    var words = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
    return (books || []).filter(function (b) { var t = [b.title, b.author, b.cat, b.shelf, b.isbn, b.kind && b.kind !== 'Book' ? b.kind : ''].join(' ').toLowerCase(); return words.every(function (w) { return t.indexOf(w) >= 0; }); })
      .sort(function (a, b) { return String(a.title || '').localeCompare(String(b.title || '')); });
  }
  /** The categories in use, by name. */
  function cats(books) { var c = {}; (books || []).forEach(function (b) { if (b.cat) c[b.cat] = 1; }); return Object.keys(c).sort(function (a, b) { return a.localeCompare(b); }); }
  function isLibrarian(settings, pid, admin) { return !!admin || (!!pid && ((settings || {}).librarianIds || []).indexOf(pid) >= 0); }
  /** May another librarian be added? At most MAX_LIBRARIANS (Administrators are librarians anyway). */
  function roomForLibrarian(settings) { return ((settings || {}).librarianIds || []).length < MAX_LIBRARIANS; }
  /** The library's policy ready to save: pasted text and/or an attached file ({ name, type, data: base64 }). */
  function policy(p) {
    p = p || {};
    var out = { text: String(p.text || '').replace(/\r\n?/g, '\n').trim().slice(0, POLICY_MAX) };
    if (p.data && p.name) { out.name = text(p.name, 120); out.type = text(p.type, 100); out.data = String(p.data); }
    return out;
  }

  return { intl: intl, REMIND_DAYS: REMIND_DAYS, daysOut: daysOut, remindDue: remindDue, LOAN_DAYS: LOAN_DAYS, KEEP_DAYS: KEEP_DAYS, MAX_LIBRARIANS: MAX_LIBRARIANS, POLICY_MAX: POLICY_MAX, HOW: HOW, KINDS: KINDS, phone: phone, borrower: borrower, roomForLibrarian: roomForLibrarian, policy: policy, addDays: addDays, book: book, isOut: isOut, onLoan: onLoan, overdue: overdue, outCount: outCount, free: free, lend: lend, giveBack: giveBack, stale: stale, mine: mine, find: find, cats: cats, isLibrarian: isLibrarian };
})();
if (typeof module !== 'undefined') module.exports = Library;
