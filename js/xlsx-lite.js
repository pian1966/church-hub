/*
 * Church Hub – a small reader for Excel (.xlsx) files, enough to read a downloaded Google Sheet: every worksheet's cell values
 * (text, numbers, TRUE/FALSE). No outside library: an .xlsx file is a zip of XML files; the browser unzips with
 * DecompressionStream and reads the XML with DOMParser. Dates arrive as Excel day numbers (the reader of each table converts them).
 * Worksheet names are not needed: Leave Manager's tabs are recognised by their column headings.
 *
 * XlsxLite.read(arrayBuffer) → Promise of [rows, rows, …] (one per worksheet; rows = array of arrays).
 */
var XlsxLite = (function () {
  'use strict';

  function u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16)) + b[o + 3] * 16777216; }

  /** The files inside a zip: { name: { method, data (compressed bytes) } }, from the zip's central directory. */
  function entries(bytes) {
    var end = -1;
    for (var i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (u32(bytes, i) === 0x06054b50) { end = i; break; }
    if (end < 0) throw new Error('not a zip file');
    var n = u16(bytes, end + 10), p = u32(bytes, end + 16), out = {}, dec = new TextDecoder();
    for (var k = 0; k < n; k++) {
      if (u32(bytes, p) !== 0x02014b50) throw new Error('damaged zip file');
      var method = u16(bytes, p + 10), size = u32(bytes, p + 20), nameLen = u16(bytes, p + 28), extra = u16(bytes, p + 30), comment = u16(bytes, p + 32);
      var local = u32(bytes, p + 42), name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
      var start = local + 30 + u16(bytes, local + 26) + u16(bytes, local + 28);
      out[name] = { method: method, data: bytes.subarray(start, start + size) };
      p += 46 + nameLen + extra + comment;
    }
    return out;
  }
  function inflate(e) {
    if (e.method === 0) return Promise.resolve(new TextDecoder().decode(e.data));
    if (e.method !== 8) return Promise.reject(new Error('unsupported compression'));
    if (typeof DecompressionStream === 'undefined') return Promise.reject(new Error('This browser can’t open Excel files'));
    var stream = new Blob([e.data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(stream).text();
  }
  function xml(text) { return new DOMParser().parseFromString(text, 'application/xml'); }
  function textOf(el) { var t = el.getElementsByTagName('t'), s = ''; for (var i = 0; i < t.length; i++) s += t[i].textContent; return s; }
  function colIndex(ref) { var m = /^([A-Z]+)/.exec(ref || ''), n = 0; if (!m) return -1; for (var i = 0; i < m[1].length; i++) n = n * 26 + m[1].charCodeAt(i) - 64; return n - 1; }

  function sheetRows(doc, shared) {
    var rows = [], rs = doc.getElementsByTagName('row');
    for (var i = 0; i < rs.length; i++) {
      var r = [], cs = rs[i].getElementsByTagName('c'), ri = (+rs[i].getAttribute('r') || (i + 1)) - 1;
      for (var j = 0; j < cs.length; j++) {
        var c = cs[j], t = c.getAttribute('t'), col = colIndex(c.getAttribute('r'));
        if (col < 0) col = r.length;
        var vEl = c.getElementsByTagName('v')[0], v = vEl ? vEl.textContent : '', val;
        if (t === 's') val = shared[+v] || '';
        else if (t === 'inlineStr') val = textOf(c);
        else if (t === 'b') val = v === '1';
        else if (t === 'str' || t === 'e') val = v;
        else val = v === '' ? '' : Number(v);
        while (r.length < col) r.push('');
        r[col] = val;
      }
      while (rows.length < ri) rows.push([]);
      rows[ri] = r;
    }
    return rows;
  }

  function read(buffer) {
    var files;
    try { files = entries(new Uint8Array(buffer)); } catch (e) { return Promise.reject(new Error('That isn’t an Excel (.xlsx) file')); }
    var sheets = Object.keys(files).filter(function (n) { return /^xl\/worksheets\/sheet\d+\.xml$/.test(n); })
      .sort(function (a, b) { return +a.match(/\d+/)[0] - +b.match(/\d+/)[0]; });
    var sharedP = files['xl/sharedStrings.xml'] ? inflate(files['xl/sharedStrings.xml']).then(function (t) {
      var si = xml(t).getElementsByTagName('si'), out = [];
      for (var i = 0; i < si.length; i++) out.push(textOf(si[i]));
      return out;
    }) : Promise.resolve([]);
    return sharedP.then(function (shared) {
      return Promise.all(sheets.map(function (n) { return inflate(files[n]).then(function (t) { return sheetRows(xml(t), shared); }); }));
    });
  }

  return { read: read };
})();
