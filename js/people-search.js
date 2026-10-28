/*
 * Church Hub – advanced people search, modelled on Elvanto's (People → Advanced Search).
 * Pure functions, tested with node: tests/people-search.test.js.
 *
 *  - A search is a list of filters { field, op, value, value2, unit } and a match: 'all', 'any' or 'logic'
 *    (your own logic with the filters' numbers, e.g. "(1 AND 2) OR (3 AND NOT 4)").
 *  - The People module turns each person into a record { id, values: { fieldKey: value } } holding only the fields the
 *    signed-in role may see, and describes each field's type: text, choice, list (several values), number, date,
 *    anniv (birthday-style: day and month, every year) or yesno.
 *  - Dates are 'yyyy-mm-dd' (longer timestamps are cut to the day); anniv values may also be 'mm-dd' (no year known).
 */
var PeopleSearch = (function () {
  'use strict';
  var OPS = {
    text: [['eq', 'Equals'], ['ne', 'Does not equal'], ['has', 'Contains'], ['nhas', 'Does not contain'], ['starts', 'Starts with'], ['empty', 'Is empty'], ['nempty', 'Is not empty']],
    choice: [['eq', 'Is'], ['ne', 'Is not'], ['empty', 'Is empty'], ['nempty', 'Is not empty']],
    list: [['inc', 'Includes'], ['ninc', 'Does not include'], ['empty', 'Is empty'], ['nempty', 'Is not empty']],
    number: [['eq', 'Equals'], ['ne', 'Does not equal'], ['gt', 'Is more than'], ['lt', 'Is less than'], ['between', 'Is between'], ['empty', 'Is empty'], ['nempty', 'Is not empty']],
    date: [['eq', 'Equals'], ['ne', 'Does not equal'], ['after', 'Is after'], ['before', 'Is before'], ['last', 'Is in the last'], ['nlast', 'Is not in the last'],
      ['between', 'Is between'], ['next', 'Is in the next'], ['nnext', 'Is not in the next'], ['empty', 'Is empty'], ['nempty', 'Is not empty']],
    anniv: [['next', 'Is in the next'], ['last', 'Was in the last'], ['month', 'Is in the month'], ['eq', 'Is on'], ['empty', 'Is empty'], ['nempty', 'Is not empty']],
    yesno: [['yes', 'Is yes'], ['no', 'Is no']]
  };
  var UNITS = [['days', 'days'], ['weeks', 'weeks'], ['months', 'months'], ['years', 'years']];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var NO_VALUE = { empty: 1, nempty: 1, yes: 1, no: 1 };

  function opsFor(type) { return OPS[type] || OPS.text; }
  function opLabel(type, op) { var o = opsFor(type).filter(function (x) { return x[0] === op; })[0]; return o ? o[1] : op; }
  /** What kind of value box an operator needs: 'none', 'one', 'two' (between), 'span' (number + unit), 'month'. */
  function valueKind(type, op) {
    if (NO_VALUE[op]) return 'none';
    if (op === 'between') return 'two';
    if (op === 'last' || op === 'nlast' || op === 'next' || op === 'nnext') return 'span';
    if (op === 'month') return 'month';
    return 'one';
  }

  /* ---------- dates (all local, no time zones) ---------- */
  function parse(s) { var m = /^(\d{4})-(\d\d)-(\d\d)/.exec(s || ''); return m ? new Date(+m[1], m[2] - 1, +m[3]) : null; }
  function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function day(s) { return String(s || '').slice(0, 10); }
  function shift(d, n, unit, sign) {
    var r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    n = n * sign;
    if (unit === 'weeks') r.setDate(r.getDate() + 7 * n);
    else if (unit === 'months') r.setMonth(r.getMonth() + n);
    else if (unit === 'years') r.setFullYear(r.getFullYear() + n);
    else r.setDate(r.getDate() + n);
    return r;
  }
  function daysBetween(a, b) { return Math.round((b - a) / 86400000); }
  /** mm-dd of a birthday-style value ('yyyy-mm-dd' or 'mm-dd'), or ''. */
  function md(v) { v = String(v || ''); var m = /^(?:\d{4}-)?(\d\d)-(\d\d)$/.exec(v.slice(0, 10)) || /^\d{4}-(\d\d)-(\d\d)/.exec(v); return m ? m[1] + '-' + m[2] : ''; }
  /** The date of this mm-dd in a given year (29 Feb becomes 1 Mar in other years). */
  function onYear(mmdd, y) { var d = new Date(y, +mmdd.slice(0, 2) - 1, +mmdd.slice(3)); return d; }
  function daysUntil(mmdd, t) { var d = onYear(mmdd, t.getFullYear()); if (d < t) d = onYear(mmdd, t.getFullYear() + 1); return daysBetween(t, d); }
  function daysSince(mmdd, t) { var d = onYear(mmdd, t.getFullYear()); if (d > t) d = onYear(mmdd, t.getFullYear() - 1); return daysBetween(d, t); }

  function empty(v) { return v == null || v === '' || (Array.isArray(v) && !v.length); }
  function low(v) { return String(v == null ? '' : v).trim().toLowerCase(); }

  /** Does one record value match one filter? */
  function test(type, f, v, today) {
    var t = parse(today) || new Date();
    if (f.op === 'empty') return empty(v);
    if (f.op === 'nempty') return !empty(v);
    if (type === 'yesno') return f.op === 'yes' ? !!v : !v;
    var want = low(f.value);
    if (type === 'list') {
      var has = (v || []).some(function (x) { return low(x) === want; });
      return f.op === 'inc' ? has : !has;
    }
    if (type === 'text' || type === 'choice') {
      var s = low(Array.isArray(v) ? v.join(', ') : v);
      if (f.op === 'eq') return s === want;
      if (f.op === 'ne') return s !== want;
      if (f.op === 'has') return s.indexOf(want) >= 0;
      if (f.op === 'nhas') return s.indexOf(want) < 0;
      if (f.op === 'starts') return s.indexOf(want) === 0;
      return false;
    }
    if (type === 'number') {
      var n = empty(v) ? NaN : Number(v), a = Number(f.value), b = Number(f.value2);
      if (f.op === 'ne') return isNaN(n) || n !== a;
      if (isNaN(n)) return false;
      if (f.op === 'eq') return n === a;
      if (f.op === 'gt') return n > a;
      if (f.op === 'lt') return n < a;
      if (f.op === 'between') return n >= Math.min(a, b) && n <= Math.max(a, b);
      return false;
    }
    if (type === 'anniv') {
      var m = md(v);
      if (!m) return false;
      if (f.op === 'month') return +m.slice(0, 2) === Number(f.value);
      if (f.op === 'eq') return m === md(f.value);
      var span = daysBetween(t, shift(t, Number(f.value), f.unit, 1));
      if (f.op === 'next') return daysUntil(m, t) <= span;
      if (f.op === 'last') return daysSince(m, t) <= span;
      return false;
    }
    // date
    var d = day(v), x = day(f.value), y = day(f.value2);
    if (f.op === 'ne') return d !== x;
    if (f.op === 'nlast' || f.op === 'nnext') { if (!d) return true; }
    else if (!d) return false;
    if (f.op === 'eq') return d === x;
    if (f.op === 'after') return d > x;
    if (f.op === 'before') return d < x;
    if (f.op === 'between') { var lo = x < y ? x : y, hi = x < y ? y : x; return d >= lo && d <= hi; }
    var ti = iso(t);
    if (f.op === 'last' || f.op === 'nlast') { var from = iso(shift(t, Number(f.value), f.unit, -1)); var inLast = d >= from && d <= ti; return f.op === 'last' ? inLast : !inLast; }
    if (f.op === 'next' || f.op === 'nnext') { var to = iso(shift(t, Number(f.value), f.unit, 1)); var inNext = d >= ti && d <= to; return f.op === 'next' ? inNext : !inNext; }
    return false;
  }

  /* ---------- your own logic: numbers, AND, OR, NOT and brackets ---------- */
  function tokens(s) {
    var out = [], re = /\s*(\d+|\(|\)|and\b|or\b|not\b|&&|\|\||!|&|\||\S+)/gi, m;
    while ((m = re.exec(s)) && m[0].trim()) {
      var w = m[1].toLowerCase();
      out.push(w === '&&' || w === '&' ? 'and' : w === '||' || w === '|' ? 'or' : w === '!' ? 'not' : w);
    }
    return out;
  }
  /**
   * Turn logic like "1 AND (2 OR 3)" into a tree, checking it against the number of filters.
   * Returns { tree } or { error } in plain English. AND is worked out before OR, as in arithmetic.
   */
  function parseLogic(s, count) {
    var tk = tokens(String(s || '')), i = 0, used = {};
    if (!tk.length) return { error: 'Type your own logic, for example 1 AND (2 OR 3).' };
    function fail(msg) { throw new Error(msg); }
    function factor() {
      var t = tk[i];
      if (t === undefined) fail('The logic stops too early – something is missing at the end.');
      if (t === 'not') { i++; return { not: factor() }; }
      if (t === '(') {
        i++; var e = expr();
        if (tk[i] !== ')') fail('A bracket “(” isn’t closed – add a “)”.');
        i++; return e;
      }
      if (/^\d+$/.test(t)) {
        var n = +t; if (n < 1 || n > count) fail('There is no filter ' + n + ' – the filters are numbered 1 to ' + count + '.');
        i++; used[n] = 1; return { n: n };
      }
      if (t === ')') fail('There is a “)” without a matching “(”.');
      if (t === 'and' || t === 'or') fail('“' + t.toUpperCase() + '” needs a filter number before it.');
      fail('“' + t + '” isn’t understood – use filter numbers, AND, OR, NOT and brackets.');
    }
    function term() { var l = factor(); while (tk[i] === 'and') { i++; l = { and: [l, factor()] }; } return l; }
    function expr() { var l = term(); while (tk[i] === 'or') { i++; l = { or: [l, term()] }; } return l; }
    try {
      var tree = expr();
      if (i < tk.length && !/^(\d+|\(|\)|not)$/.test(tk[i])) fail('“' + tk[i] + '” isn’t understood – use filter numbers, AND, OR, NOT and brackets.');
      if (i < tk.length) fail(tk[i] === ')' ? 'There is a “)” without a matching “(”.' : 'Put AND or OR between filter ' + (tk[i - 1] || '') + ' and “' + tk[i] + '”.');
      var unused = []; for (var k = 1; k <= count; k++) if (!used[k]) unused.push(k);
      return { tree: tree, unused: unused };
    } catch (e) { return { error: e.message }; }
  }
  function evalTree(t, hits) {
    if (t.n) return hits[t.n - 1];
    if (t.not) return !evalTree(t.not, hits);
    if (t.and) return evalTree(t.and[0], hits) && evalTree(t.and[1], hits);
    return evalTree(t.or[0], hits) || evalTree(t.or[1], hits);
  }

  /** Is a filter filled in? Returns '' or what is missing, in plain English. */
  function incomplete(f, fields) {
    var def = fields[f.field];
    if (!def) return 'choose what to search on';
    if (!opsFor(def.type).some(function (o) { return o[0] === f.op; })) return 'choose how to compare';
    var k = valueKind(def.type, f.op), has = function (v) { return v != null && String(v).trim() !== ''; };
    if (k === 'one' && !has(f.value)) return 'fill in a value';
    if (k === 'two' && (!has(f.value) || !has(f.value2))) return 'fill in both values';
    if (k === 'span' && (!has(f.value) || isNaN(Number(f.value)) || Number(f.value) < 0)) return 'fill in how many ' + (f.unit || 'days');
    if (k === 'month' && !has(f.value)) return 'choose a month';
    if (def.type === 'number' && k !== 'none' && (isNaN(Number(f.value)) || (k === 'two' && isNaN(Number(f.value2))))) return 'use a number';
    return '';
  }

  /**
   * Run a search. search: { match: 'all'|'any'|'logic', logic, filters }. fields: { key: { type } }.
   * A record may give other ways to write a value in alts: { key: [...] } (e.g. what someone is known as).
   * Returns { ids } (matching record ids, in the records' order) or { error }.
   */
  function run(records, search, fields, today) {
    var fs = search.filters || [];
    for (var i = 0; i < fs.length; i++) { var miss = incomplete(fs[i], fields); if (miss) return { error: 'Filter ' + (i + 1) + ': ' + miss + '.' }; }
    var tree = null;
    if (search.match === 'logic') { var pl = parseLogic(search.logic, fs.length); if (pl.error) return { error: pl.error }; tree = pl.tree; }
    var ids = (records || []).filter(function (r) {
      if (!fs.length) return true;
      var hits = fs.map(function (f) {
        var t = fields[f.field].type, one = test(t, f, r.values[f.field], today), alts = (r.alts && r.alts[f.field]) || [];
        if (!alts.length || f.op === 'empty' || f.op === 'nempty') return one;
        // Other ways to write the same value (e.g. "known as"): any of them may match; "does not" means none of them does
        var each = alts.map(function (a) { return test(t, f, a, today); });
        return f.op === 'ne' || f.op === 'nhas' ? one && each.every(Boolean) : one || each.some(Boolean);
      });
      if (tree) return evalTree(tree, hits);
      return search.match === 'any' ? hits.some(Boolean) : hits.every(Boolean);
    }).map(function (r) { return r.id; });
    return { ids: ids };
  }

  /** A filter in words, e.g. "Age is more than 18" or "Birthday is in the next 2 weeks". */
  function describe(f, def, show) {
    if (!def) return '';
    var k = valueKind(def.type, f.op), v = show ? show(f.value) : f.value, v2 = show ? show(f.value2) : f.value2;
    var tail = k === 'none' ? '' : k === 'two' ? ' ' + v + ' and ' + v2 : k === 'span' ? ' ' + f.value + ' ' + (f.unit || 'days') : k === 'month' ? ' ' + (MONTHS[Number(f.value) - 1] || '') : ' “' + v + '”';
    return def.label + ' ' + opLabel(def.type, f.op).toLowerCase() + tail;
  }

  /** Sort helper for result columns: empty values last; numbers and dates in order; text alphabetically. */
  function compare(a, b) {
    var ea = empty(a), eb = empty(b);
    if (ea || eb) return ea === eb ? 0 : ea ? 1 : -1;
    if (Array.isArray(a)) a = a.join(', ');
    if (Array.isArray(b)) b = b.join(', ');
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    if (typeof a === 'boolean') return (a === b) ? 0 : a ? -1 : 1;
    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
  }

  return { OPS: OPS, UNITS: UNITS, MONTHS: MONTHS, opsFor: opsFor, opLabel: opLabel, valueKind: valueKind, test: test, parseLogic: parseLogic,
    incomplete: incomplete, run: run, describe: describe, compare: compare, md: md };
})();
if (typeof module !== 'undefined') module.exports = PeopleSearch;
