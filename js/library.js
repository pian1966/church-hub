/*
 * Church Hub – the church Library: the books the church owns, and who has borrowed which.
 * An item (a book, DVD, CD…): books/{id} = { kind (KINDS; 'Book' when not set), title, author, cat, copies, acquired (date),
 *   how (Bought | Donated | Other), from (the donor or shop), shelf, isbn, note, out, cover } – out = how many copies are on
 *   loan, kept by the librarian so that everyone can see whether it is in, without seeing who has it; cover = the version
 *   of its cover picture, kept apart in covers/{id} and fetched only when shown.
 * A loan: loans/{id} = { bookId, title, personId ('' for a visitor), name, mobile, visitor (true for someone not on the
 *   church's list), out (date lent), due, back (date returned, '' while out), returnNote, reminded (the last friendly reminder) }.
 * A friendly reminder is due REMIND_DAYS (3 weeks) after an item was borrowed, and again each REMIND_AGAIN days after that. Every loan needs a mobile number so a
 *   book can be traced; the number is cleared when the book comes back.
 * Everyone who signs in sees the items and the library's policy. Loans are seen by the librarians (Administrators, and the
 * people chosen by an Administrator or the Senior Pastor: settings.librarianIds) and each borrower sees
 * their own. Returned loans are kept for a year (KEEP_DAYS), then removed.
 * Tested with node: tests/library.test.js. POPIA: see docs/POPIA.md, "Library".
 */
var Library = (function () {
  'use strict';
  var TX = function (x) { return x; };   // translated where it is shown
  var LOAN_DAYS = 21, REMIND_DAYS = 21, REMIND_AGAIN = 7, KEEP_DAYS = 365, LIBRARIAN_REVIEW_DAYS = 180, POLICY_MAX = 20000;
  var HOW = [TX('Bought'), TX('Donated'), TX('Other')];
  var REASONS = [TX('Lost'), TX('Damaged'), TX('Given away'), TX('Other')];   // why an item left the library
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
    if (b.removed) { out.removed = text(b.removed, 10); out.why = REASONS.indexOf(b.why) >= 0 ? b.why : 'Other'; if (b.whyNote) out.whyNote = text(b.whyNote, 200); }
    if (b.repairing === true) out.repairing = true;
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
  function free(b, loans) { return b && b.repairing ? 0 : Math.max(0, (Math.max(1, +b.copies || 1)) - outCount(b, loans)); }
  /** Mark the whole catalogue item as being repaired, or return it to the shelf. */
  function repair(b, repairing) { var x = copy(b); if (repairing) x.repairing = true; else delete x.repairing; return x; }
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
  function giveBack(loan, b, today, loans, returnNote) {
    var l = copy(loan); l.back = today; l.mobile = '';   // no longer needed once it is back
    returnNote = text(returnNote, 300);
    if (returnNote) l.returnNote = returnNote; else delete l.returnNote;
    var x = b ? copy(b) : null; if (x) x.out = Math.max(0, outCount(b, loans) - (isOut(loan) ? 1 : 0));
    return { loan: l, book: x };
  }
  /** A borrowed item that won't come back: the loan is closed as lost (its mobile number is kept, to trace it), and
   *  the item has one copy fewer – the last copy lost takes the item out of the library (kept for the reports). */
  function lose(loan, b, today, loans) {
    var l = copy(loan); l.back = today; l.lost = true;
    var x = b ? copy(b) : null;
    if (x) {
      x.out = Math.max(0, outCount(b, loans) - (isOut(loan) ? 1 : 0));
      if ((+x.copies || 1) > 1) x.copies = (+x.copies || 1) - 1; else { x.removed = today; x.why = 'Lost'; }
    }
    return { loan: l, book: x };
  }
  /** Take an item out of the library (lost, damaged, given away…): kept, marked removed, for the reports. */
  function removeItem(b, why, note, today) {
    var x = copy(b); delete x.repairing; x.removed = today; x.why = REASONS.indexOf(why) >= 0 ? why : 'Other'; if (note) x.whyNote = text(note, 200); else delete x.whyNote;
    return x;
  }
  /** Put a removed item back on the shelf (found again, or removed by mistake). */
  function restore(b) { var x = copy(b); delete x.removed; delete x.why; delete x.whyNote; delete x.repairing; return x; }
  function inLibrary(b) { return !!b && !b.removed; }
  /** What happened between two dates (yyyy-mm-dd, both included): lent, returned, lost, acquired and removed. */
  function report(books, loans, from, to) {
    var on = function (d) { return !!d && d >= from && d <= to; }, by = function (k) { return function (a, b) { return String(a[k] || '').localeCompare(String(b[k] || '')) || String(a.title || '').localeCompare(String(b.title || '')); }; };
    books = books || []; loans = loans || [];
    var lostLoans = loans.filter(function (l) { return l.lost && on(l.back); }), lostIds = {};
    lostLoans.forEach(function (l) { lostIds[l.bookId] = 1; });
    return {
      lent: loans.filter(function (l) { return on(l.out); }).sort(by('out')),
      returned: loans.filter(function (l) { return !l.lost && on(l.back); }).sort(by('back')),
      lost: lostLoans.sort(by('back')),
      acquired: books.filter(function (b) { return on(b.acquired); }).sort(by('acquired')),
      removed: books.filter(function (b) { return on(b.removed) && !(b.why === 'Lost' && lostIds[b.id]); }).sort(by('removed'))
    };
  }
  /** The report as rows for a spreadsheet (CSV): a heading row, then one row per event. */
  function reportRows(rep, names) {
    names = names || {};
    var rows = [['What', 'Date', 'Title', 'Kind', 'Who', 'Detail']], nm = function (k) { return names[k] || k; };
    rep.lent.forEach(function (l) { rows.push([nm('On Loan'), l.out, l.title, '', l.name + (l.visitor ? ' (' + nm('Visitor') + ')' : ''), l.due ? nm('Due') + ' ' + l.due : '']); });
    rep.returned.forEach(function (l) { rows.push([nm('Returned'), l.back, l.title, '', l.name, [nm('Lent') + ' ' + l.out, l.returnNote ? nm('Note') + ': ' + l.returnNote : ''].filter(Boolean).join(' · ')]); });
    rep.lost.forEach(function (l) { rows.push([nm('Lost'), l.back, l.title, '', l.name + (l.mobile ? ' ' + l.mobile : ''), nm('Lent') + ' ' + l.out]); });
    rep.acquired.forEach(function (b) { rows.push([nm('Acquired'), b.acquired, b.title, nm(b.kind || 'Book'), b.from || '', [b.how ? nm(b.how) : '', (+b.copies || 1) > 1 ? b.copies + ' ×' : ''].filter(Boolean).join(' ')]); });
    rep.removed.forEach(function (b) { rows.push([nm('Removed'), b.removed, b.title, nm(b.kind || 'Book'), '', nm(b.why || 'Other') + (b.whyNote ? ': ' + b.whyNote : '')]); });
    return rows;
  }
  function csv(rows) { return rows.map(function (r) { return r.map(function (v) { v = String(v == null ? '' : v); return /[",\n\r]/.test(v) || /^[=+\-@]/.test(v) ? '"' + (/^[=+\-@]/.test(v) ? "'" : '') + v.replace(/"/g, '""') + '"' : v; }).join(','); }).join('\r\n'); }

  /* ---------- importing a list of items from a spreadsheet (CSV) ---------- */
  function parseCSV(textIn) {
    var rows = [], row = [], cell = '', q = false, t = String(textIn || '').replace(/^\uFEFF/, ''), sep = ',';
    var first = t.split(/\r?\n/)[0] || ''; if ((first.match(/;/g) || []).length > (first.match(/,/g) || []).length) sep = ';';   // Excel in some countries uses ;
    for (var i = 0; i < t.length; i++) {
      var c = t[i];
      if (q) { if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true;
      else if (c === sep) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some(function (x) { return x.trim(); })) rows.push(row); row = []; }
      else cell += c;
    }
    row.push(cell); if (row.some(function (x) { return x.trim(); })) rows.push(row);
    return rows;
  }
  // Which column holds what, from its heading. Checked in this order; each column used once.
  var COLUMNS = [['isbn', /isbn/i], ['title', /^(title|book|name|item)/i], ['author', /author|writer|^by$/i], ['kind', /kind|type|format|media/i],
    ['cat', /categor|genre|subject|topic/i], ['copies', /cop(y|ies)|qty|quantity|number/i], ['shelf', /shelf|location|place/i],
    ['acquired', /acquired|date|added|received/i], ['how', /^how|source|bought|obtained/i], ['from', /from|donor|donated|giver|supplier|shop/i], ['note', /note|comment|remark|description/i]];
  function columns(head) {
    var m = {}, used = {};
    COLUMNS.forEach(function (c) { var i = (head || []).findIndex(function (h, j) { return !used[j] && c[1].test(String(h || '').trim()); }); if (i >= 0) { m[c[0]] = i; used[i] = 1; } });
    return m;
  }
  function isoDate(s) {
    s = String(s || '').trim(); var m;
    if ((m = /^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/.exec(s))) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
    if ((m = /^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/.exec(s))) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);   // day first, as in South Africa and Europe
    if ((m = /^(\d{4})$/.exec(s))) return m[1] + '-01-01';
    return '';
  }
  function kindOf(s) {
    s = String(s || '').trim().toLowerCase(); if (!s) return 'Book';
    var k = KINDS.filter(function (x) { return x.toLowerCase() === s; })[0]; if (k) return k;
    return /audio ?book/.test(s) ? 'Audiobook' : /book|novel|bible|paperback|hardcover/.test(s) ? 'Book' : /dvd|video|film|movie|blu/.test(s) ? 'DVD' : /cd|music|album/.test(s) ? 'CD' : /magazine|journal|periodical/.test(s) ? 'Magazine' : /game/.test(s) ? 'Game' : 'Other';
  }
  function howOf(s) { s = String(s || '').toLowerCase(); return /bought|purchase|paid/.test(s) ? 'Bought' : /donat|gift|given/.test(s) ? 'Donated' : s.trim() ? 'Other' : ''; }
  function sameItem(a, b) {
    var ia = String(a.isbn || '').replace(/[^\dxX]/g, ''), ib = String(b.isbn || '').replace(/[^\dxX]/g, '');
    if (ia && ib) return ia === ib;
    var k = function (x) { return (String(x.title || '') + '|' + String(x.author || '')).toLowerCase().replace(/[^a-z0-9|]/g, ''); };
    return k(a) === k(b);
  }
  /** What importing a spreadsheet would do: { add: [items ready to save], dup: n already there, noTitle: n, cols }. */
  function importPlan(rows, existing, today) {
    var head = (rows || [])[0] || [], cols = columns(head), add = [], dup = 0, noTitle = 0, have = (existing || []).slice();
    if (cols.title === undefined) return { add: [], dup: 0, noTitle: 0, cols: cols, error: 'title' };
    (rows || []).slice(1).forEach(function (r) {
      var g = function (k) { return cols[k] === undefined ? '' : String(r[cols[k]] || '').trim(); };
      if (!g('title')) { noTitle++; return; }
      var b = book({ kind: kindOf(g('kind')), title: g('title'), author: g('author'), cat: g('cat'), copies: g('copies') || 1, shelf: g('shelf'), isbn: g('isbn'),
        acquired: isoDate(g('acquired')) || today || '', how: howOf(g('how')), from: g('from'), note: g('note'), out: 0 });
      if (have.some(function (x) { return !x.removed && sameItem(x, b); })) { dup++; return; }
      have.push(b); add.push(b);
    });
    return { add: add, dup: dup, noTitle: noTitle, cols: cols };
  }

  /** The policy's words as a tidy page: headings (# or a short line in capitals), numbered and bulleted lists, **bold**,
   *  paragraphs. Everything is escaped first, so nothing typed can become a link or a script. */
  function policyHtml(t) {
    var e = function (x) { return String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
    var inline = function (x) { return e(x).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/__([^_]+)__/g, '<b>$1</b>').replace(/(^|[^*\w])\*(?=\S)([^*]*?\S)\*(?![*\w])/g, '$1<i>$2</i>'); };
    var out = [], para = [], list = null;
    var endPara = function () { if (para.length) { out.push('<p>' + para.map(inline).join('<br>') + '</p>'); para = []; } };
    var endList = function () { if (list) { out.push('<' + list.tag + '>' + list.items.map(function (x) { return '<li>' + inline(x) + '</li>'; }).join('') + '</' + list.tag + '>'); list = null; } };
    String(t || '').replace(/\r\n?/g, '\n').split('\n').forEach(function (raw) {
      var line = raw.trim(), m;
      if (!line) { endPara(); endList(); return; }
      if ((m = /^(#{1,3})\s+(.+)$/.exec(line))) { endPara(); endList(); out.push('<h' + (m[1].length + 2) + '>' + inline(m[2]) + '</h' + (m[1].length + 2) + '>'); return; }
      if (line.length <= 60 && /[A-Z]/.test(line) && line === line.toUpperCase() && !/[.,;]$/.test(line)) { endPara(); endList(); out.push('<h4>' + inline(line) + '</h4>'); return; }
      if ((m = /^[-*\u2022]\s+(.+)$/.exec(line)) || (m = /^\(?\d{1,2}[.)]\s+(.+)$/.exec(line))) {
        var tag = /^[-*\u2022]/.test(line) ? 'ul' : 'ol'; endPara();
        if (!list || list.tag !== tag) { endList(); list = { tag: tag, items: [] }; }
        list.items.push(m[1]); return;
      }
      endList(); para.push(line);
    });
    endPara(); endList();
    return out.join('');
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
  /** Is it time for the Administrator to review the librarians? Missing or invalid dates are due. */
  function librarianReviewDue(reviewedAt, current) {
    var reviewed = Date.parse(reviewedAt || ''), now = current == null ? Date.now() : Date.parse(current);
    return !isFinite(reviewed) || !isFinite(now) || now - reviewed >= LIBRARIAN_REVIEW_DAYS * 86400000;
  }
  /** The library's policy ready to save: pasted text and/or an attached file ({ name, type, data: base64 }). */
  function policy(p) {
    p = p || {};
    var out = { text: String(p.text || '').replace(/\r\n?/g, '\n').trim().slice(0, POLICY_MAX) };
    if (p.data && p.name) { out.name = text(p.name, 120); out.type = text(p.type, 100); out.data = String(p.data); }
    return out;
  }

  return { intl: intl, REMIND_DAYS: REMIND_DAYS, daysOut: daysOut, remindDue: remindDue, REASONS: REASONS, lose: lose, removeItem: removeItem, restore: restore, inLibrary: inLibrary, report: report, reportRows: reportRows, csv: csv,
    parseCSV: parseCSV, columns: columns, isoDate: isoDate, kindOf: kindOf, importPlan: importPlan, sameItem: sameItem, policyHtml: policyHtml, LOAN_DAYS: LOAN_DAYS, KEEP_DAYS: KEEP_DAYS, LIBRARIAN_REVIEW_DAYS: LIBRARIAN_REVIEW_DAYS, POLICY_MAX: POLICY_MAX, HOW: HOW, KINDS: KINDS, phone: phone, borrower: borrower, librarianReviewDue: librarianReviewDue, policy: policy, addDays: addDays, book: book, isOut: isOut, onLoan: onLoan, overdue: overdue, outCount: outCount, free: free, repair: repair, lend: lend, giveBack: giveBack, stale: stale, mine: mine, find: find, cats: cats, isLibrarian: isLibrarian };
})();
if (typeof module !== 'undefined') module.exports = Library;
