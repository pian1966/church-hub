/* Tests for js/badges.js (name badge layouts: the church's A4 sheet, label paper with and without gaps).
 * Run: node tests/badges.test.js */
'use strict';
const B = require('../js/badges.js');

let fails = 0;
function check(ok, what) {
  if (!ok) { fails++; console.log('  ✗ ' + what); }
  else console.log('  ✓ ' + what);
}
const near = (a, b) => Math.abs(a - b) < 0.02;

console.log('Layouts');
const church = B.layout();
check(church.preset === 'church' && church.cols === 2 && church.rows === 5 && church.w === 73.3 && church.h === 41 && church.lines === 'thick', 'nothing saved: the church’s layout (2 × 5 badges of 73.3 × 41 mm with 3 pt lines)');
check(B.layout({ preset: 'l7163' }).rows === 7 && B.layout({ preset: 'l7163' }).lines === 'none', 'a label sheet from its name: Avery L7163, 14 labels, no lines');
const custom = B.layout({ preset: 'custom', page: 'Letter', cols: '3', rows: 10, w: '66,7', h: 25.4, top: 12.7, left: 4.8, gapX: 3.2, gapY: 0, lines: 'thin' });
check(custom.preset === 'custom' && custom.page === 'Letter' && custom.cols === 3 && custom.w === 66.7 && custom.lines === 'thin', 'your own layout: numbers as typed (a comma works as a decimal point), US Letter, thin lines');
check(B.layout({ preset: 'nonsense', lines: 'wavy' }).preset === 'church' && B.layout({ lines: 'wavy' }).lines === 'thick', 'anything unknown falls back to the church’s layout');
Object.keys(B.PRESETS).forEach(k => check(B.problems(B.layout({ preset: k })).length === 0, 'fits on the page: ' + B.PRESETS[k].name));

console.log('Checks');
check(B.problems(Object.assign({}, church, { cols: 3 })).some(x => /Too wide for A4/.test(x)), 'three of the church’s badges across: too wide for A4');
check(B.problems(Object.assign({}, church, { rows: 7 })).some(x => /Too long for A4/.test(x)), 'seven down: too long');
check(B.problems(Object.assign({}, church, { w: 5, gapX: -1 })).length === 2, 'too narrow, and a gap below 0');
check(B.problems(Object.assign({}, church, { cols: 0 })).some(x => /1 to 6/.test(x)), 'labels across: 1 to 6');

console.log('Placing labels');
const l60 = B.layout({ preset: 'l7160' });
let p = B.place(l60, 4);
check(p.page === 0 && p.col === 1 && p.row === 1 && near(p.x, 7.21 + 63.5 + 2.54) && near(p.y, 15.15 + 38.1), 'label 5 on a 3-across sheet: second row, second column, after the gap');
p = B.place(l60, 21);
check(p.page === 1 && p.col === 0 && p.row === 0 && near(p.x, 7.21) && near(p.y, 15.15), 'label 22: top left of the second sheet');
const names = Array.from({ length: 30 }, (x, i) => ({ first: 'Name' + i, last: 'Surname' }));
let html = B.sheets(names.slice(0, 12), church);
check((html.match(/class="sheet a4"/g) || []).length === 2 && (html.match(/class="lab"/g) || []).length === 12, '12 badges on the church’s layout: two A4 sheets');
check(/left:20mm;top:32mm;width:73.3mm;height:41mm;border-width:1.06mm 1.06mm 1.06mm 1.06mm/.test(html) && /left:93.3mm;top:32mm;[^"]*border-width:1.06mm 1.06mm 1.06mm 0mm/.test(html) && /left:20mm;top:73mm;[^"]*border-width:0mm 1.06mm 1.06mm 1.06mm/.test(html),
  'no gaps: neighbours share one line (as the table did)');
html = B.sheets(names.slice(0, 3), l60);
check(!/border-width:[^"]*[1-9]/.test(html), 'label paper: no lines');
html = B.sheets(names.slice(0, 2), B.layout({ preset: 'l7163', lines: 'thin' }));
check(/left:106.25mm;top:15.15mm;[^"]*border-width:0.25mm 0.25mm 0.25mm 0.25mm/.test(html), 'with a gap, each label has all four lines');
html = B.sheets(names.slice(0, 3), l60, { start: 5 });
check((html.match(/class="lab"/g) || []).length === 3 && /left:73.25mm;top:53.25mm/.test(html) && !/left:7.21mm;top:15.15mm/.test(html), 'start at label 5 of a partly used sheet');
html = B.sheets(names.slice(0, 20), l60, { start: 5 });
check((html.match(/class="sheet/g) || []).length === 2, '… and carry on to the next sheet');
html = B.sheets([], l60, { test: true });
check((html.match(/class="lab"/g) || []).length === 21 && />21<\/b>/.test(html) && /border-width:0.25mm/.test(html), 'test page: all 21 labels numbered and outlined');
check(/&lt;b&gt;/.test(B.sheets([{ first: '<b>', last: 'x' }], church)), 'names are made safe');
check(/class="sheet letter" style="width:215.9mm/.test(B.sheets(names.slice(0, 1), custom)), 'US Letter pages');

console.log('Name sizes');
check(B.fontPt('Grace', church) === 35 && B.fontPt('Newcombe', church, true) === 25, 'the church’s badge: first name 35 pt, surname 25 pt (as in the Google Doc)');
check(B.fontPt('Christopher-James', church) < 25 && B.fontPt('Christopher-James', church) >= 12, 'a long first name: smaller, so it fits');
check(B.fontPt('Jo', l60) < B.fontPt('Jo', B.layout({ preset: 'l7165' })), 'a bigger label: bigger names');
check(B.fontPt('Jo', custom) <= 25.4 * 0.38 * 72 / 25.4 + 0.5, 'a small label: both lines still fit');

console.log(fails ? '\n' + fails + ' failed' : '\nAll badge layout tests passed');
process.exit(fails ? 1 : 0);
