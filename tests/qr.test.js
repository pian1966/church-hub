/* Tests for js/qr.js (the QR code maker), checked against QR codes made by the segno library
 * (tests/fixtures/qr-reference.json: byte mode, level M, every mask, versions 1–10). Run: node tests/qr.test.js
 * segno adds one extra 0x00 after the terminator in byte mode (allowed: readers stop at the terminator), so the data
 * codewords are compared up to there, and segno's own codewords are used to check our layout and error correction. */
'use strict';
const QR = require('../js/qr.js'), ref = require('./fixtures/qr-reference.json'), _ = QR._;
let fails = 0;
function ok(c, what) { if (!c) { fails++; console.log('  ✗ ' + what); } else console.log('  ✓ ' + what); }
const same = (a, b) => a.length === b.length && a.every((r, i) => r.every((x, j) => x === b[i][j]));
const grid = x => x.rows.map(r => [...r].map(c => c === '1'));
/** Undo the interleaving: [{ data, ec }] per block. */
function blocks(v, words) {
  const [, ecN, groups] = _.blocks[v], list = []; groups.forEach(g => { for (let k = 0; k < g[0]; k++) list.push({ n: g[1], data: [], ec: [] }); });
  let i = 0; const most = Math.max(...list.map(b => b.n));
  for (let j = 0; j < most; j++) list.forEach(b => { if (j < b.n) b.data.push(words[i++]); });
  for (let j = 0; j < ecN; j++) list.forEach(b => b.ec.push(words[i++]));
  return list;
}
/** Read the text back from the data codewords (byte mode). */
function decode(v, data) {
  const bits = data.map(b => b.toString(2).padStart(8, '0')).join(''), cl = v < 10 ? 8 : 16;
  if (bits.slice(0, 4) !== '0100') return null;
  const n = parseInt(bits.slice(4, 4 + cl), 2), bytes = [];
  for (let i = 0; i < n; i++) bytes.push(parseInt(bits.slice(4 + cl + 8 * i, 12 + cl + 8 * i), 2));
  return Buffer.from(bytes).toString('utf8');
}
const res = {};
ref.forEach(x => {
  const key = 'version ' + x.version + (x.text.length > 20 ? ' (' + x.text.length + ' characters)' : ' “' + x.text + '”'), r = res[key] = res[key] || { layout: 0, ec: 0, ours: 0 };
  const theirs = grid(x), words = _.read(x.version, theirs, x.mask);
  if (same(_.build(x.version, words, x.mask), theirs)) r.layout++;                                          // finders, timing, format, version, placement, mask
  if (blocks(x.version, words).every(b => JSON.stringify(_.ecc(b.data, b.ec.length)) === JSON.stringify(b.ec))) r.ec++;   // Reed–Solomon
  const q = QR.matrix(x.text, x.mask), mine = _.read(q.version, q.dark, x.mask), bl = blocks(q.version, mine);
  if (q.version === x.version && decode(q.version, bl.reduce((t, b) => t.concat(b.data), [])) === x.text &&
    bl.every(b => JSON.stringify(_.ecc(b.data, b.ec.length)) === JSON.stringify(b.ec))) r.ours++;      // ours reads back as the text, with valid error correction
});
Object.keys(res).forEach(k => {
  ok(res[k].layout === 8, k + ': segno’s codes, laid out by us, come out exactly the same (all 8 masks)');
  ok(res[k].ec === 8, k + ': our error correction matches segno’s');
  ok(res[k].ours === 8, k + ': our own code reads back as the text, with valid error correction');
});
const best = QR.matrix('https://pian1966.github.io/church-hub/#/people/apply');
ok(best.mask >= 0 && best.mask < 8 && best.size === 17 + 4 * best.version, 'without a mask asked for, it picks one (' + best.mask + '), version ' + best.version);
ok(/^<svg[^>]+viewBox="0 0 41 41"/.test(QR.svg('https://pian1966.github.io/church-hub/#/people/apply', { px: 160 })), 'as a picture: the code plus a white border of 4');
let threw = false; try { QR.matrix('x'.repeat(300)); } catch (e) { threw = true; }
ok(threw, 'too long: it says so');
if (fails) { console.log('\n' + fails + ' failed'); process.exit(1); } else console.log('\nAll QR code tests passed');
