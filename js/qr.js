/*
 * Church Hub – a small QR code maker (no outside library): text as bytes, error correction level M (about 15% of the code
 * can be damaged), versions 1–10 (up to 213 bytes – plenty for a web address). Written from the QR Code standard
 * (ISO/IEC 18004); checked against the segno library's output in tests/qr.test.js.
 *   QR.matrix(text) → { size, dark: [[true|false]] }   QR.svg(text, opts) → '<svg …>' (black on white, with a quiet zone)
 * Used for the "Become a Church Partner" link (People → Partnership applications → Invite).
 */
var QR = (function () {
  'use strict';
  // Version → [total codewords, EC codewords per block, [[blocks, data codewords each], …]] for level M
  var M = { 1: [26, 10, [[1, 16]]], 2: [44, 16, [[1, 28]]], 3: [70, 26, [[1, 44]]], 4: [100, 18, [[2, 32]]], 5: [134, 24, [[2, 43]]],
    6: [172, 16, [[4, 27]]], 7: [196, 18, [[4, 31]]], 8: [242, 22, [[2, 38], [2, 39]]], 9: [292, 22, [[3, 36], [2, 37]]], 10: [346, 26, [[4, 43], [1, 44]]] };
  var ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] };

  /* ---------- arithmetic in GF(256), for Reed–Solomon error correction ---------- */
  var EXP = [], LOG = [];
  (function () { var x = 1; for (var i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11D; } for (i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; })();
  function mul(a, b) { return a && b ? EXP[LOG[a] + LOG[b]] : 0; }
  function generator(n) { var g = [1]; for (var i = 0; i < n; i++) { var next = []; for (var j = 0; j <= g.length; j++) next[j] = (g[j] || 0) ^ mul(g[j - 1] || 0, EXP[i]); g = next; } return g; }
  function ecc(data, n) {
    var g = generator(n), r = data.concat(new Array(n).fill(0));
    for (var i = 0; i < data.length; i++) { var c = r[i]; if (c) for (var j = 0; j < g.length; j++) r[i + j] ^= mul(g[j], c); }
    return r.slice(data.length);
  }

  /* ---------- the text as bytes (UTF-8) ---------- */
  function utf8(s) { var b = [], e = unescape(encodeURIComponent(String(s))); for (var i = 0; i < e.length; i++) b.push(e.charCodeAt(i)); return b; }
  function dataCount(v) { return M[v][2].reduce(function (t, x) { return t + x[0] * x[1]; }, 0); }
  function chooseVersion(n) { for (var v = 1; v <= 10; v++) if (4 + (v < 10 ? 8 : 16) + 8 * n <= 8 * dataCount(v)) return v; return 0; }

  function codewords(bytes, v) {
    var bits = [], put = function (val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); };
    put(4, 4); put(bytes.length, v < 10 ? 8 : 16); bytes.forEach(function (b) { put(b, 8); });
    var cap = dataCount(v) * 8;
    put(0, Math.min(4, cap - bits.length)); while (bits.length % 8) bits.push(0);
    var data = []; for (var i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
    for (var p = 0; data.length < dataCount(v); p++) data.push(p % 2 ? 0x11 : 0xEC);
    // Split into blocks, add each block's error correction, then interleave
    var blocks = [], ecBlocks = [], at = 0;
    M[v][2].forEach(function (g) { for (var k = 0; k < g[0]; k++) { var d = data.slice(at, at + g[1]); at += g[1]; blocks.push(d); ecBlocks.push(ecc(d, M[v][1])); } });
    var out = [], most = Math.max.apply(null, blocks.map(function (b) { return b.length; }));
    for (i = 0; i < most; i++) blocks.forEach(function (b) { if (i < b.length) out.push(b[i]); });
    for (i = 0; i < M[v][1]; i++) ecBlocks.forEach(function (b) { out.push(b[i]); });
    return out;
  }

  /* ---------- the grid ---------- */
  function bch(value, poly, shift) {
    var deg = function (x) { var d = -1; while (x) { d++; x >>>= 1; } return d; }, r = value << shift;
    while (deg(r) >= deg(poly)) r ^= poly << (deg(r) - deg(poly));
    return (value << shift) | r;
  }
  var MASKS = [function (r, c) { return (r + c) % 2 === 0; }, function (r) { return r % 2 === 0; }, function (r, c) { return c % 3 === 0; }, function (r, c) { return (r + c) % 3 === 0; },
    function (r, c) { return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0; }, function (r, c) { return (r * c) % 2 + (r * c) % 3 === 0; },
    function (r, c) { return ((r * c) % 2 + (r * c) % 3) % 2 === 0; }, function (r, c) { return ((r + c) % 2 + (r * c) % 3) % 2 === 0; }];

  function build(v, words, mask) {
    var n = 17 + 4 * v, dark = [], fixed = [], r, c;
    for (r = 0; r < n; r++) { dark.push(new Array(n).fill(false)); fixed.push(new Array(n).fill(false)); }
    var set = function (y, x, on) { if (y < 0 || x < 0 || y >= n || x >= n) return; dark[y][x] = !!on; fixed[y][x] = true; };
    // Finder patterns with their white separators
    [[0, 0], [0, n - 7], [n - 7, 0]].forEach(function (p) {
      for (var y = -1; y <= 7; y++) for (var x = -1; x <= 7; x++) {
        var on = y >= 0 && y <= 6 && x >= 0 && x <= 6 && (y === 0 || y === 6 || x === 0 || x === 6 || (y >= 2 && y <= 4 && x >= 2 && x <= 4));
        set(p[0] + y, p[1] + x, on);
      }
    });
    // Alignment patterns (not over the finders)
    var a = ALIGN[v];
    a.forEach(function (y) { a.forEach(function (x) {
      if (fixed[y][x]) return;
      for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) set(y + dy, x + dx, Math.max(Math.abs(dy), Math.abs(dx)) !== 1);
    }); });
    // Timing patterns
    for (var i = 8; i < n - 8; i++) { if (!fixed[6][i]) set(6, i, i % 2 === 0); if (!fixed[i][6]) set(i, 6, i % 2 === 0); }
    // Reserve the format areas (filled in below), and the dark module
    for (i = 0; i < 9; i++) { if (!fixed[8][i]) set(8, i, false); if (!fixed[i][8]) set(i, 8, false); }
    for (i = 0; i < 8; i++) { set(8, n - 1 - i, false); set(n - 1 - i, 8, false); }
    set(n - 8, 8, true);
    // Version information (version 7 and up): two 6 × 3 blocks
    if (v >= 7) {
      var vb = bch(v, 0x1F25, 12);
      for (i = 0; i < 18; i++) { var on = (vb >> i) & 1; set(Math.floor(i / 3), n - 11 + (i % 3), on); set(n - 11 + (i % 3), Math.floor(i / 3), on); }
    }
    // The data, in two-column zigzags from the bottom right, skipping the timing column
    var bit = 0, total = words.length * 8, up = true;
    for (var col = n - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      for (var k = 0; k < n; k++) {
        var y = up ? n - 1 - k : k;
        for (var j = 0; j < 2; j++) {
          var x = col - j; if (fixed[y][x]) continue;
          var b = bit < total ? (words[bit >> 3] >> (7 - (bit & 7))) & 1 : 0; bit++;
          dark[y][x] = !!b !== MASKS[mask](y, x);
        }
      }
      up = !up;
    }
    // Format information: level M (00) and the mask, with its error correction, twice
    var f = bch(mask, 0x537, 10) ^ 0x5412;   // (00 << 3 | mask) = mask
    for (i = 0; i < 15; i++) {
      var fb = !!((f >> i) & 1);
      // Beside the top-left finder: down column 8 (skipping the timing row), then along row 8 (skipping the timing column)
      if (i < 6) dark[i][8] = fb; else if (i === 6) dark[7][8] = fb; else if (i === 7) dark[8][8] = fb; else if (i === 8) dark[8][7] = fb; else dark[8][14 - i] = fb;
      // The copy: along row 8 under the top-right finder, then down column 8 beside the bottom-left one
      if (i < 8) dark[8][n - 1 - i] = fb; else dark[n - 15 + i][8] = fb;
    }
    dark[n - 8][8] = true;
    return dark;
  }

  /** How hard a grid is to read (the standard's four penalty rules): the mask with the lowest score is used. */
  function penalty(d) {
    var n = d.length, p = 0, r, c, run, i;
    for (r = 0; r < n; r++) for (var dir = 0; dir < 2; dir++) {
      run = 1;
      for (c = 1; c <= n; c++) {
        var same = c < n && (dir ? d[c][r] === d[c - 1][r] : d[r][c] === d[r][c - 1]);
        if (same) run++; else { if (run >= 5) p += run - 2; run = 1; }
      }
    }
    for (r = 0; r < n - 1; r++) for (c = 0; c < n - 1; c++) if (d[r][c] === d[r][c + 1] && d[r][c] === d[r + 1][c] && d[r][c] === d[r + 1][c + 1]) p += 3;
    var pat = [true, false, true, true, true, false, true];
    for (r = 0; r < n; r++) for (c = 0; c + 7 <= n; c++) for (var dir2 = 0; dir2 < 2; dir2++) {
      var ok = true; for (i = 0; i < 7 && ok; i++) ok = (dir2 ? d[c + i][r] : d[r][c + i]) === pat[i];
      if (!ok) continue;
      var light = function (from, to) { for (var k = from; k < to; k++) { if (k < 0 || k >= n) continue; if (dir2 ? d[k][r] : d[r][k]) return false; } return true; };
      if (light(c - 4, c) || light(c + 7, c + 11)) p += 40;
    }
    var darkN = 0; for (r = 0; r < n; r++) for (c = 0; c < n; c++) if (d[r][c]) darkN++;
    p += Math.floor(Math.abs(darkN * 100 / (n * n) - 50) / 5) * 10;
    return p;
  }

  /** The QR code for some text: { size, dark, version, mask }. mask: force one (0–7), else the best. */
  function matrix(text, mask) {
    var bytes = utf8(text), v = chooseVersion(bytes.length); if (!v) throw new Error('Too long for a QR code');
    var words = codewords(bytes, v), best = null;
    for (var m = 0; m < 8; m++) {
      if (mask !== undefined && m !== mask) continue;
      var d = build(v, words, m), s = mask !== undefined ? 0 : penalty(d);
      if (!best || s < best.s) best = { s: s, d: d, m: m };
    }
    return { size: best.d.length, dark: best.d, version: v, mask: best.m };
  }
  /** As a picture (SVG): black squares on white, with a 4-module quiet zone. opts.px: size in pixels (default 200). */
  function svg(text, opts) {
    var q = matrix(text), n = q.size + 8, px = (opts && opts.px) || 200, path = '';
    for (var r = 0; r < q.size; r++) for (var c = 0; c < q.size; c++) if (q.dark[r][c]) path += 'M' + (c + 4) + ' ' + (r + 4) + 'h1v1h-1z';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n + ' ' + n + '" width="' + px + '" height="' + px + '" shape-rendering="crispEdges" role="img" aria-label="QR code">' +
      '<rect width="' + n + '" height="' + n + '" fill="#fff"/><path d="' + path + '" fill="#000"/></svg>';
  }
  /** For tests: the codewords in a grid (unmasked), read in the order build() writes them. */
  function read(v, dark, mask) {
    var n = 17 + 4 * v, ref = build(v, new Array(M[v][0]).fill(0), mask), fixedRef = build(v, new Array(M[v][0]).fill(255), mask), bits = [], up = true;
    // A module is data if writing 0s and 255s gives different results there
    for (var col = n - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      for (var k = 0; k < n; k++) { var y = up ? n - 1 - k : k; for (var j = 0; j < 2; j++) { var x = col - j; if (ref[y][x] === fixedRef[y][x]) continue; bits.push((dark[y][x] !== MASKS[mask](y, x)) ? 1 : 0); } }
      up = !up;
    }
    var out = []; for (var i = 0; i + 8 <= bits.length && out.length < M[v][0]; i += 8) out.push(parseInt(bits.slice(i, i + 8).join(''), 2));
    return out;
  }
  return { matrix: matrix, svg: svg, _: { build: build, read: read, ecc: ecc, blocks: M, codewords: codewords } };
})();
if (typeof module !== 'undefined') module.exports = QR;
