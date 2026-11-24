/*
 * Church & Trellis – the roster as a PDF file to download (Rosters → More → Print or download the roster).
 * A small PDF writer with nothing to load: Helvetica, coloured cells and lines, A4 portrait or landscape. It draws the same
 * pages that are printed (js/mod-rosters.js builds them), so what is downloaded is what is printed.
 *
 * A page: { landscape, heading, sub, church, ink, line, soft,              ink/line/soft = the service's colours (#rrggbb)
 *           cols: [{ l1, l2, off, note, ink, line, soft }],                 the dates across the top; off = the service isn't held that day;
 *                                                                           ink/line/soft = that service's own colours (else the page's)
 *           rows: [{ team: 'Music' } | { label: 'Sound desk', cells: [{ names: [], na, off }] }],
 *           footL, footR }
 * RosterPDF.make(pages) → the file as a string of one-byte characters (RosterPDF.bytes turns it into a Uint8Array).
 * Letters outside Western European writing (WinAnsi) are drawn as "?" – the printed version shows them all.
 */
var RosterPDF = (function () {
  'use strict';

  // Helvetica's width of each character from space (32) to ~ (126), in 1/1000 of the font size
  var W = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
    1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
    333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
  var WIN = { 8211: 0x96, 8212: 0x97, 8216: 0x91, 8217: 0x92, 8220: 0x93, 8221: 0x94, 8226: 0x95, 8230: 0x85, 8364: 0x80 };

  /** A string as WinAnsi character codes (what the PDF fonts use). */
  function codes(s) {
    var out = [];
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      out.push(c >= 32 && c < 127 ? c : c >= 160 && c < 256 ? c : WIN[c] || (c === 9 || c === 160 ? 32 : 63));
    }
    return out;
  }
  function width(s, size, bold) {
    var t = 0, c = codes(s);
    for (var i = 0; i < c.length; i++) t += (c[i] >= 32 && c[i] <= 126 ? W[c[i] - 32] : 556);
    return t * size / 1000 * (bold ? 1.06 : 1);
  }
  /** Text as a PDF string: ( … ) with brackets, backslashes and everything outside plain letters written as octal. */
  function lit(s) {
    return '(' + codes(s).map(function (c) {
      return c === 40 || c === 41 || c === 92 ? '\\' + String.fromCharCode(c) : c < 127 ? String.fromCharCode(c) : '\\' + ('00' + c.toString(8)).slice(-3);
    }).join('') + ')';
  }
  function rgb(hex, fill) {
    var h = /^#?([0-9a-f]{6})$/i.exec(hex || ''), v = h ? h[1] : '000000';
    return [0, 2, 4].map(function (i) { return (parseInt(v.substr(i, 2), 16) / 255).toFixed(3); }).join(' ') + (fill ? ' rg' : ' RG');
  }
  function n(x) { return (Math.round(x * 100) / 100).toString(); }
  /** Cuts text into lines no wider than `max` (a word wider than that is cut where it has to be). */
  function wrap(text, size, max, bold) {
    var lines = [], line = '';
    String(text || '').split(/\s+/).filter(Boolean).forEach(function (word) {
      while (width(word, size, bold) > max && word.length > 1) {
        var k = word.length - 1; while (k > 1 && width(word.slice(0, k), size, bold) > max) k--;
        if (line) { lines.push(line); line = ''; }
        lines.push(word.slice(0, k)); word = word.slice(k);
      }
      var tryLine = line ? line + ' ' + word : word;
      if (line && width(tryLine, size, bold) > max) { lines.push(line); line = word; } else line = tryLine;
    });
    if (line) lines.push(line);
    return lines;
  }

  function layout(pg, A) {
    var land = !!pg.landscape, PW = land ? 842 : 595, PH = land ? 595 : 842, M = 28;
    var labelW = land ? 104 : 92, cols = pg.cols, cw = Math.min(118, (PW - 2 * M - labelW) / Math.max(1, cols.length));
    var tw = labelW + cw * cols.length, ink = pg.ink || '#333333', line = pg.line || ink, soft = pg.soft || '#F2F2F2';
    var pages = [], cur = null, y = 0;
    var FS = land ? 8 : 8, LH = FS * 1.22, PAD = 3;

    // Drawing helpers write into the current page's content
    function out(s) { cur.push(s); }
    function rect(x, top, w, h, fill, stroke) {
      out((fill ? rgb(fill, true) + ' ' : '') + (stroke ? rgb(stroke) + ' 0.5 w ' : '') + n(x) + ' ' + n(PH - top - h) + ' ' + n(w) + ' ' + n(h) + ' re ' + (fill && stroke ? 'B' : fill ? 'f' : 'S'));
    }
    function text(s, x, baseTop, size, bold, color, align, boxW) {
      var w = width(s, size, bold), tx = align === 'c' ? x + (boxW - w) / 2 : align === 'r' ? x + boxW - w : x;
      out('BT ' + rgb(color || '#000000', true) + ' /' + (bold ? 'F2' : 'F1') + ' ' + n(size) + ' Tf ' + n(tx) + ' ' + n(PH - baseTop) + ' Td ' + lit(s) + ' Tj ET');
    }
    function hline(x1, x2, top, color, wd) { out(rgb(color) + ' ' + n(wd) + ' w ' + n(x1) + ' ' + n(PH - top) + ' m ' + n(x2) + ' ' + n(PH - top) + ' l S'); }
    function hatch(x, top, w, h, color) {   // diagonal lines inside a box: "not needed here"
      out('q ' + n(x) + ' ' + n(PH - top - h) + ' ' + n(w) + ' ' + n(h) + ' re W n ' + rgb(color) + ' 0.4 w');
      for (var k = -h; k < w; k += 6) out(n(x + k) + ' ' + n(PH - top - h) + ' m ' + n(x + k + h) + ' ' + n(PH - top) + ' l S');
      out('Q');
    }

    function head(first) {
      var top = M;
      text(pg.heading, M, top + 14, 15, true, ink);
      if (pg.church) text(pg.church, M, top + 12, 9, false, '#444444', 'r', PW - 2 * M);
      if (pg.sub) text(pg.sub, M, top + 27, 9, false, '#333333');
      hline(M, PW - M, top + 33, line, 1.4);
      var hh = 30, t = top + 41;
      rect(M, t, labelW, hh, soft, '#999999');
      cols.forEach(function (c, i) {
        var x = M + labelW + i * cw;
        rect(x, t, cw, hh, c.off ? '#E6E6E6' : c.soft || soft, '#999999');
        if (!c.off) rect(x, t + hh - 3.5, cw, 3.5, c.line || line);   // a bar in the service's colour
        text(c.l1, x, t + 11, 8.5, true, c.off ? '#555555' : c.ink || '#000000', 'c', cw);
        if (c.l2) text(c.l2, x, t + 21, 7, false, c.off ? '#555555' : c.ink || '#333333', 'c', cw);
      });
      return t + hh;
    }
    function newPage(first) {
      cur = []; pages.push(cur); y = head(first);
      pg._start = y;
    }
    function foot() {
      var top = PH - M + 8;
      hline(M, PW - M, top - 8, '#CCCCCC', 0.5);
      if (pg.footL) text(pg.footL, M, top, 7.5, false, '#555555');
      if (pg.footR) text(pg.footR, M, top, 7.5, false, '#555555', 'r', PW - 2 * M);
    }
    // The grey block over a column on which the service is not held: stops where the page's rows stop
    function offBlocks() {
      cols.forEach(function (c, i) {
        if (!c.off) return;
        var x = M + labelW + i * cw, h = y - pg._start;
        if (h <= 0) return;
        rect(x, pg._start, cw, h, '#E6E6E6', '#999999');
        var lines = wrap(c.note || '', 7.5, cw - 8, true), ty = pg._start + 14;
        lines.forEach(function (l) { text(l, x, ty, 7.5, true, '#444444', 'c', cw); ty += 9.5; });
      });
    }

    newPage(true);
    var limit = PH - M - 16;
    rows: for (var r = 0; r < pg.rows.length; r++) {
      var row = pg.rows[r], h;
      if (row.team) {
        h = 13;
        if (y + h + 30 > limit) { offBlocks(); foot(); newPage(false); }
        rect(M, y, tw, h, '#EEEEEE', '#999999');
        text(String(row.team).toUpperCase(), M + PAD, y + 9, 7, true, '#333333');
        y += h; continue rows;
      }
      var labelLines = wrap(row.label, FS, labelW - 2 * PAD, true), most = labelLines.length;
      var cellLines = row.cells.map(function (c) {
        var ls = []; (c.names || []).forEach(function (nm) { wrap(nm, FS, cw - 2 * PAD).forEach(function (l, i) { ls.push(i ? ' ' + l : l); }); });
        if (ls.length > most) most = ls.length; return ls;
      });
      h = most * LH + 2 * PAD - 1;
      if (y + h > limit) { offBlocks(); foot(); newPage(false); }
      rect(M, y, labelW, h, '#FFFFFF', '#999999');
      labelLines.forEach(function (l, i) { text(l, M + PAD, y + PAD + FS + i * LH - 1, FS, true, '#000000'); });
      row.cells.forEach(function (c, i) {
        var x = M + labelW + i * cw;
        if (c.off) return;
        rect(x, y, cw, h, '#FFFFFF', '#999999');
        if (c.na) hatch(x, y, cw, h, '#D5D5D5');
        cellLines[i].forEach(function (l, k) { text(l, x + PAD, y + PAD + FS + k * LH - 1, FS, false, '#000000'); });
      });
      y += h;
    }
    offBlocks(); foot();
    return pages;
  }

  /** The PDF file, as a string of one-byte characters. */
  function make(pageModels) {
    var streams = [];
    pageModels.forEach(function (pg) { layout(pg).forEach(function (cur) { streams.push({ land: !!pg.landscape, body: cur.join('\n') }); }); });
    if (!streams.length) streams.push({ land: false, body: '' });
    var objs = [], add = function (s) { objs.push(s); return objs.length; };
    add('<< /Type /Catalog /Pages 2 0 R >>');                       // 1
    add('');                                                        // 2 (the page list, filled below)
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');        // 3
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');   // 4
    var kids = [];
    streams.forEach(function (s) {
      var content = add('<< /Length ' + s.body.length + ' >>\nstream\n' + s.body + '\nendstream');
      kids.push(add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + (s.land ? '842 595' : '595 842') + '] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' + content + ' 0 R >>'));
    });
    objs[1] = '<< /Type /Pages /Kids [' + kids.map(function (k) { return k + ' 0 R'; }).join(' ') + '] /Count ' + kids.length + ' >>';
    var pdf = '%PDF-1.4\n', at = [];
    objs.forEach(function (o, i) { at.push(pdf.length); pdf += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
    var xref = pdf.length;
    pdf += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + at.map(function (a) { return ('0000000000' + a).slice(-10) + ' 00000 n \n'; }).join('');
    return pdf + 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
  }
  function bytes(str) { var u = new Uint8Array(str.length); for (var i = 0; i < str.length; i++) u[i] = str.charCodeAt(i) & 255; return u; }

  return { make: make, bytes: bytes, width: width, wrap: wrap };
})();
if (typeof module !== 'undefined') module.exports = RosterPDF;
