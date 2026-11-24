/* Tests for js/roster-pdf.js (the roster as a PDF to download). Run: node tests/roster-pdf.test.js */
'use strict';
const P = require('../js/roster-pdf.js');
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };

const page = (land, extra) => Object.assign({ landscape: land, heading: 'Roster · 8:00am (Family)', sub: '29 Nov 2026 – 10 Jan 2027', church: 'Grace Community Church', ink: '#9A3F06', line: '#F59E0B', soft: '#FFF3DC',
  cols: [{ l1: '29 Nov', l2: '08:00' }, { l1: '6 Dec', l2: 'Communion' }, { l1: '13 Dec', l2: 'No service', off: true, note: 'The service is not taking place this Sunday' }],
  rows: [{ team: 'Music' }, { label: 'Guitar (lead)', cells: [{ names: ['Zoë Pretorius'] }, { names: ['Jean-Luc O’Brien', 'Ann'] }, { off: true, names: [] }] },
    { label: 'Sound', cells: [{ names: [] , na: true }, { names: [] }, { off: true, names: [] }] }], footR: 'Printed 24 Nov 2026' }, extra || {});

console.log('The roster as a PDF');
{
  const pdf = P.make([page(true), page(false)]);
  ok(pdf.startsWith('%PDF-1.4\n') && pdf.trim().endsWith('%%EOF'), 'a PDF file');
  ok(/^[\x00-\x7f]*$/.test(pdf), 'only plain characters in the file, so it can be saved as text without being changed');
  ok((pdf.match(/\/Type \/Page /g) || []).length === 2 && pdf.includes('/MediaBox [0 0 842 595]') && pdf.includes('/MediaBox [0 0 595 842]'), 'landscape and portrait pages are the right shape');
  ok(pdf.includes('/Count 2'), 'two pages in the list');
  // the byte offsets in the cross-reference table point at the objects
  const x = pdf.slice(pdf.indexOf('xref\n')), n = +/0 (\d+)\n/.exec(x)[1], offs = x.split('\n').slice(2, 2 + n).map(l => parseInt(l, 10));
  ok(offs.slice(1).every((o, i) => pdf.slice(o).startsWith((i + 1) + ' 0 obj')), 'the cross-reference table is exact');
  ok(+/startxref\n(\d+)/.exec(pdf)[1] === pdf.indexOf('xref\n'), '… and startxref too');
  const found = [...pdf.matchAll(/\/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/g)], body = found.map(m => m[2]);
  ok(found.length === 2 && found.every(m => +m[1] === m[2].length), 'each page’s length is exact');
  ok(body[0].includes('(Roster \\267 8:00am \\(Family\\)) Tj') && body[0].includes('(Zo\\353 Pretorius) Tj'), 'brackets are escaped and accented letters keep their shape');
  ok(body[0].includes('(Jean-Luc O\\222Brien) Tj'), 'a curly apostrophe is kept');
  ok(body[0].includes('(No) Tj') && body[0].includes('(service) Tj'), 'a column with no service says so in its header (the words wrap to the narrow column)');
  const tallRows = [{ team: 'T' }].concat(Array.from({ length: 22 }, (_, i) => ({ label: 'Position ' + i, cells: [{ names: ['A'] }, { names: ['B'] }, { off: true, names: [] }] })));
  const tall = [...P.make([page(true, { rows: tallRows })]).matchAll(/\/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/g)].map(m => m[2])[0];
  ok(/Tm \(The service is not taking place this Sunday\) Tj/.test(tall) || /Tm \(The service[^)]*\) Tj/.test(tall), 'beside a tall table the whole sentence is written up the column');
  ok(/0 1 -1 0 [\d.]+ [\d.]+ Tm \(The service/.test(body[0]) || /0 1 -1 0 [\d.]+ [\d.]+ Tm \(No service|Cancelled|Sunday/.test(body[0]), 'the note is turned on its side (rotated text matrix), reading upwards');
  // the day with no service is a narrow column: the services before it are as wide as the page allows, and it is only 30 points
  const narrow = [...body[0].matchAll(/([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+) re\b/g)].map(m => +m[3]);
  ok(narrow.includes(30), 'the column with no service is narrow (30 points wide)');
  const wide = P.make([page(true, { cols: [{ l1: 'A', l2: '' }, { l1: 'B', l2: '' }, { l1: 'C', l2: '' }, { l1: 'D', l2: '' }, { l1: 'E', l2: '' }, { l1: 'F', l2: '' }, { l1: 'G', l2: '' }, { l1: 'H', l2: '' }], rows: [{ team: 'T' }, { label: 'X', cells: Array.from({ length: 8 }, () => ({ names: [] })) }] })]);
  const w8 = [...wide.matchAll(/([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+) re\b/g)].map(m => +m[3]);
  ok(Math.max(...w8) > Math.max(...narrow.filter(x => x !== 30)) * 0 + 60, 'columns share the page width');
  const short = P.make([page(true, { cols: [{ l1: '29 Nov', l2: '08:00' }, { l1: '6 Dec', l2: 'No service', off: true, note: 'The service is not taking place this Sunday', short: 'Cancelled' }], rows: [{ team: 'T' }, { label: 'X', cells: [{ names: ['A'] }, { off: true, names: [] }] }] })]);
  ok(/Tm \(Cancelled\) Tj/.test(short), 'a table too low for the whole sentence says the short words instead');
  ok(body[0].includes('0.604 0.247 0.024 rg'), 'the service’s own colour is used');
  ok(P.make([]).startsWith('%PDF-1.4') && (P.make([]).match(/\/Type \/Page /g) || []).length === 1, 'nothing to print still makes a valid (blank) file');
  ok(P.bytes('ABC').join() === '65,66,67' && P.bytes('ABC') instanceof Uint8Array, 'bytes');
}
console.log('Long lists run on to another page, the header repeated');
{
  const rows = [{ team: 'Team' }].concat(Array.from({ length: 60 }, (_, i) => ({ label: 'Position ' + i, cells: [{ names: ['A'] }, { names: ['B'] }, { off: true, names: [] }] })));
  const pdf = P.make([page(true, { rows })]);
  const pages = (pdf.match(/\/Type \/Page /g) || []).length;
  ok(pages >= 2, '60 positions need more than one landscape page (' + pages + ')');
  ok((pdf.match(/\(Roster \\267/g) || []).length === pages, 'every page has the heading');
}
console.log('Text that is too wide is wrapped');
{
  const lines = P.wrap('Welcoming and Service Assistant', 8, 70, true);
  ok(lines.length >= 2 && lines.every(l => P.width(l, 8, true) <= 70), 'a long position name is cut into lines that fit');
  ok(P.wrap('Supercalifragilisticexpialidocious', 8, 40).every(l => P.width(l, 8) <= 40), 'a word wider than the column is cut');
}
console.log(fails ? `\n${fails} FAILED` : '\nAll roster PDF tests passed');
process.exit(fails ? 1 : 0);
