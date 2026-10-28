/* Tests for js/people-search.js (advanced people search). Run: node tests/people-search.test.js. Made-up people only. */
'use strict';
const PS = require('../js/people-search.js');
let fails = 0;
function check(ok, what) { if (!ok) { fails++; console.log('  ✗ ' + what); } else console.log('  ✓ ' + what); }
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const FIELDS = {
  first: { type: 'text', label: 'First name' }, cat: { type: 'choice', label: 'Category' }, teams: { type: 'list', label: 'Serving' },
  age: { type: 'number', label: 'Age' }, added: { type: 'date', label: 'Date added' }, bday: { type: 'anniv', label: 'Birthday' },
  dir: { type: 'yesno', label: 'In the directory' }
};
const TODAY = '2026-10-27';
const R = [
  { id: 'a', values: { first: 'Anna', cat: 'Partner', teams: ['Sound', 'Welcome'], age: 40, added: '2026-10-20 08:00', bday: '1986-11-02', dir: true } },
  { id: 'b', values: { first: 'Ben', cat: 'Attender', teams: [], age: 17, added: '2025-01-05', bday: '10-25', dir: false } },
  { id: 'c', values: { first: 'Carla', cat: 'Partner', teams: ['Welcome'], age: '', added: '', bday: '', dir: false } },
  { id: 'd', values: { first: 'Dumi', cat: 'Visiting Minister', teams: ['Preaching'], age: 62, added: '2026-12-01', bday: '1964-02-29', dir: true } }
];
const run = (filters, match, logic) => { const r = PS.run(R, { filters, match: match || 'all', logic }, FIELDS, TODAY); return r.error || r.ids.join(''); };
const F = (field, op, value, value2, unit) => ({ field, op, value, value2, unit });

console.log('Known as');
{
  const K = [{ id: 'x', values: { first: 'Douglas' }, alts: { first: ['Doug'] } }, { id: 'y', values: { first: 'Dumi' } }];
  const k = (op, v) => { const r = PS.run(K, { filters: [F('first', op, v)], match: 'all' }, FIELDS, TODAY); return r.error || r.ids.join(''); };
  check(k('has', 'douglas') === 'x' && k('has', 'doug') === 'x', 'finds someone by their first name or what they are known as');
  check(k('eq', 'doug') === 'x' && k('starts', 'dou') === 'x', 'equals and starts with also try the known-as name');
  check(k('nhas', 'doug') === 'y' && k('ne', 'doug') === 'y', '"does not" means neither name matches');
}

console.log('Text and choice');
check(run([F('first', 'eq', 'anna')]) === 'a', 'equals ignores capitals');
check(run([F('first', 'has', 'ar')]) === 'c', 'contains');
check(run([F('first', 'starts', 'b')]) === 'b', 'starts with');
check(run([F('first', 'nhas', 'a')]) === 'bd', 'does not contain');
check(run([F('cat', 'eq', 'Partner')]) === 'ac', 'choice is');
check(run([F('first', 'has', 'ann')]) === 'a' && run([F('first', 'has', 'an n')]) === 'a' && run([F('first', 'has', 'ann x')]) === '', 'contains: every word typed must appear (“an n”), in any order');
check(run([F('cat', 'ne', 'Partner')]) === 'bd', 'choice is not');

console.log('Lists, numbers, yes/no');
check(run([F('teams', 'inc', 'welcome')]) === 'ac', 'list includes');
check(run([F('teams', 'ninc', 'Welcome')]) === 'bd', 'list does not include');
check(run([F('teams', 'empty')]) === 'b', 'list is empty');
check(run([F('age', 'gt', '18')]) === 'ad', 'more than (unknown age left out)');
check(run([F('age', 'lt', '18')]) === 'b', 'less than');
check(run([F('age', 'between', '65', '30')]) === 'ad', 'between, either way round');
check(run([F('age', 'ne', '40')]) === 'bcd', 'does not equal includes unknown');
check(run([F('age', 'empty')]) === 'c', 'number is empty');
check(run([F('dir', 'yes')]) === 'ad' && run([F('dir', 'no')]) === 'bc', 'yes / no');

console.log('Dates');
check(run([F('added', 'eq', '2026-10-20')]) === 'a', 'equals uses the day of a timestamp');
check(run([F('added', 'after', '2026-01-01')]) === 'ad', 'is after');
check(run([F('added', 'before', '2026-01-01')]) === 'b', 'is before (empty left out)');
check(run([F('added', 'last', '2', '', 'weeks')]) === 'a', 'in the last 2 weeks');
check(run([F('added', 'last', '2', '', 'years')]) === 'ab', 'in the last 2 years (future date left out)');
check(run([F('added', 'nlast', '1', '', 'months')]) === 'bcd', 'not in the last month (includes empty)');
check(run([F('added', 'next', '6', '', 'weeks')]) === 'd', 'in the next 6 weeks');
check(run([F('added', 'between', '2026-12-31', '2025-01-01')]) === 'abd', 'between, either way round');
check(run([F('added', 'nempty')]) === 'abd', 'is not empty');

console.log('Birthdays (every year)');
check(run([F('bday', 'next', '7', '', 'days')]) === 'a', 'birthday in the next 7 days (2 Nov)');
check(run([F('bday', 'last', '3', '', 'days')]) === 'b', 'birthday in the last 3 days (25 Oct, no year)');
check(run([F('bday', 'month', '2')]) === 'd', 'birthday in February (29 Feb)');
check(run([F('bday', 'eq', '2000-11-02')]) === 'a', 'birthday on a day and month');
check(PS.run([{ id: 'x', values: { bday: '01-01' } }], { match: 'all', filters: [F('bday', 'next', '10', '', 'days')] }, FIELDS, '2026-12-28').ids.join('') === 'x', 'next birthday runs over New Year');

console.log('Matching all, any, and your own logic');
const fs = [F('cat', 'eq', 'Partner'), F('dir', 'yes'), F('age', 'gt', '50'), F('teams', 'empty')];
check(run(fs.slice(0, 2)) === 'a', 'all of the following');
check(run(fs.slice(0, 2), 'any') === 'acd', 'any of the following');
check(run(fs, 'logic', '(1 AND 2) OR (3 AND 4)') === 'a', '(1 AND 2) OR (3 AND 4)');
check(run(fs, 'logic', '1 and 2 or 3') === 'ad', 'AND before OR, small letters fine');
check(run(fs, 'logic', '1 AND (2 OR 3)') === 'a', 'brackets');
check(run(fs, 'logic', 'NOT 1 AND NOT 4') === 'd', 'NOT');
check(run(fs, 'logic', '(1 OR 4) AND NOT 2') === 'bc', 'NOT with brackets');
check(run([], 'all') === 'abcd', 'no filters finds everyone');

console.log('Plain-English problems');
check(/no filter 5/.test(run(fs, 'logic', '1 AND 5')), 'filter number that doesn’t exist');
check(/isn’t closed/.test(run(fs, 'logic', '(1 AND 2')), 'missing bracket');
check(/without a matching/.test(run(fs, 'logic', '1 AND 2)')), 'extra bracket');
check(/AND or OR between/.test(run(fs, 'logic', '1 2')), 'two numbers without AND/OR');
check(/too early/.test(run(fs, 'logic', '1 AND')), 'ends too early');
check(/Type your own logic/.test(run(fs, 'logic', '  ')), 'empty logic');
check(/isn’t understood/.test(run(fs, 'logic', '1 XOR 2')), 'unknown word');
check(eq(PS.parseLogic('1 OR 3', 4).unused, [2, 4]), 'reports filters the logic leaves out');
check(run([F('first', 'eq', '')]) === 'Filter 1: fill in a value.', 'empty value');
check(run([F('age', 'gt', 'old')]) === 'Filter 1: use a number.', 'number expected');
check(run([F('added', 'last', '', '', 'days')]) === 'Filter 1: fill in how many days.', 'how many');
check(run([F('nope', 'eq', 'x')]) === 'Filter 1: choose what to search on.', 'unknown field');
check(run([F('dir', 'eq', 'x')]) === 'Filter 1: choose how to compare.', 'operator not for this kind of field');

console.log('Words and sorting');
check(PS.describe(F('age', 'gt', '18'), FIELDS.age) === 'Age is more than “18”', 'describe one value');
check(PS.describe(F('bday', 'next', '2', '', 'weeks'), FIELDS.bday) === 'Birthday is in the next 2 weeks', 'describe a span');
check(PS.describe(F('bday', 'month', '2'), FIELDS.bday) === 'Birthday is in the month February', 'describe a month');
check(PS.describe(F('teams', 'empty'), FIELDS.teams) === 'Serving is empty', 'describe no value');
check(eq([3, '', 1, 2].sort(PS.compare), [1, 2, 3, '']), 'numbers sort, empty last');
check(eq(['b10', 'B2', 'a'].sort(PS.compare), ['a', 'B2', 'b10']), 'text sorts naturally');
check(PS.valueKind('date', 'between') === 'two' && PS.valueKind('anniv', 'month') === 'month' && PS.valueKind('yesno', 'yes') === 'none', 'value boxes per operator');

if (fails) { console.log('\n' + fails + ' people search test(s) FAILED'); process.exit(1); }
console.log('\nAll people search tests passed');
