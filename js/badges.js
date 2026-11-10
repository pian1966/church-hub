/* Church Hub – name badge layouts: the church's own (A4, cut and laminate) and label paper, with or without gaps.
 * Pure (no screen, no data): People → Name badges → Badge layout keeps the choice in settings.badgeLayout,
 * and js/people/apply.js prints with Badges.sheets(). Tested by tests/badges.test.js.
 * Every measurement is in millimetres, from the top-left corner of the page. */
(function (root) {
  'use strict';
  var PAGES = { A4: { w: 210, h: 297, label: 'A4' }, Letter: { w: 215.9, h: 279.4, label: 'US Letter' } };
  var LINES = { thick: 1.06, thin: 0.25, none: 0 };   // 3 pt as in the church's Google Doc, a thin cutting guide, or none (label paper)
  /** Ready-made layouts. Label makers' measurements – check with a test page before printing a whole batch. */
  var PRESETS = {
    church: { name: 'Cut and laminate – 10 on A4 (the church’s layout)', page: 'A4', cols: 2, rows: 5, w: 73.3, h: 41, top: 32, left: 20, gapX: 0, gapY: 0, lines: 'thick' },
    l7160: { name: 'Avery L7160 / J8160 – 21 labels, 63.5 × 38.1 mm', page: 'A4', cols: 3, rows: 7, w: 63.5, h: 38.1, top: 15.15, left: 7.21, gapX: 2.54, gapY: 0, lines: 'none' },
    l7163: { name: 'Avery L7163 / J8163 – 14 labels, 99.1 × 38.1 mm', page: 'A4', cols: 2, rows: 7, w: 99.1, h: 38.1, top: 15.15, left: 4.65, gapX: 2.5, gapY: 0, lines: 'none' },
    l7165: { name: 'Avery L7165 / J8165 – 8 labels, 99.1 × 67.7 mm', page: 'A4', cols: 2, rows: 4, w: 99.1, h: 67.7, top: 13.1, left: 4.65, gapX: 2.5, gapY: 0, lines: 'none' },
    l7173: { name: 'Avery L7173 / J8173 – 10 labels, 99.1 × 57 mm', page: 'A4', cols: 2, rows: 5, w: 99.1, h: 57, top: 6, left: 4.65, gapX: 2.5, gapY: 0, lines: 'none' }
  };
  var NUM = ['cols', 'rows', 'w', 'h', 'top', 'left', 'gapX', 'gapY'];

  function num(v, d) { var n = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) ? n : d; }
  function r2(n) { return Math.round(n * 100) / 100; }
  /** The layout to use: the saved one (settings.badgeLayout), filled in from its preset; the church's layout if none. */
  function layout(saved) {
    saved = saved || {};
    var base = PRESETS[saved.preset] || PRESETS.church, out = { preset: PRESETS[saved.preset] || saved.preset === 'custom' ? saved.preset : 'church' };
    out.page = PAGES[saved.page] ? saved.page : base.page;
    NUM.forEach(function (k) { out[k] = num(saved[k], base[k]); });
    out.cols = Math.round(out.cols); out.rows = Math.round(out.rows);
    out.lines = LINES.hasOwnProperty(saved.lines) ? saved.lines : base.lines;
    return out;
  }
  /** What's wrong with a layout, in plain words (empty when it fits on the page). */
  function problems(L) {
    var out = [], pg = PAGES[L.page] || PAGES.A4;
    if (!(L.cols >= 1 && L.cols <= 6)) out.push('Labels across: 1 to 6.');
    if (!(L.rows >= 1 && L.rows <= 15)) out.push('Labels down: 1 to 15.');
    if (!(L.w >= 20)) out.push('Each label needs to be at least 20 mm wide.');
    if (!(L.h >= 12)) out.push('Each label needs to be at least 12 mm high.');
    ['top', 'left', 'gapX', 'gapY'].forEach(function (k) { if (!(L[k] >= 0)) out.push('Margins and gaps can’t be less than 0.'); });
    if (out.length) return out.filter(function (x, i) { return out.indexOf(x) === i; });
    var across = L.left + L.cols * L.w + (L.cols - 1) * L.gapX, down = L.top + L.rows * L.h + (L.rows - 1) * L.gapY;
    if (across > pg.w + 0.01) out.push('Too wide for ' + pg.label + ': ' + r2(across) + ' mm across, the page is ' + pg.w + ' mm.');
    if (down > pg.h + 0.01) out.push('Too long for ' + pg.label + ': ' + r2(down) + ' mm down, the page is ' + pg.h + ' mm.');
    return out;
  }
  function perPage(L) { return L.cols * L.rows; }
  /** Where label i (0 = top left, then across) sits on its page. */
  function place(L, i) {
    var k = i % perPage(L), c = k % L.cols, r = Math.floor(k / L.cols);
    return { page: Math.floor(i / perPage(L)), col: c, row: r, x: r2(L.left + c * (L.w + L.gapX)), y: r2(L.top + r * (L.h + L.gapY)) };
  }
  /** Font size (pt) for a line of text that fits the label: as big as the church's (35 pt / 25 pt on a 41 mm badge), smaller for long names or small labels. */
  function fontPt(text, L, surname) {
    var maxH = L.h * (surname ? 25 : 35) / 41 * 25.4 / 72, room = L.w - 4 - 2 * (LINES[L.lines] || 0), len = Math.max(String(text || '').length, 1);
    var byWidth = room / (len * (surname ? 0.56 : 0.62)), mm = Math.min(maxH, byWidth);
    if (L.h < 30) mm = Math.min(mm, L.h * (surname ? 0.26 : 0.38));   // a small label: both lines must still fit
    return Math.max(6, Math.round(mm * 72 / 25.4 * 2) / 2);
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  /** The pages to print. names: [{first, last}]. opts.start: the first free label on a partly used sheet (1 = top left);
   * opts.test: a test page – every label numbered and outlined, to hold against the label sheet. */
  function sheets(names, L, opts) {
    opts = opts || {};
    var skip = Math.max(0, Math.min(perPage(L) - 1, Math.round(num(opts.start, 1)) - 1));
    var items = opts.test ? Array.apply(null, Array(perPage(L))).map(function (x, i) { return { test: i + 1 }; }) : names;
    if (!opts.test) items = new Array(skip).concat(items);
    var line = opts.test ? Math.max(LINES[L.lines], 0.25) : LINES[L.lines], pages = [], pg = PAGES[L.page] || PAGES.A4;
    items.forEach(function (n, i) {
      var p = place(L, i); if (!pages[p.page]) pages[p.page] = '';
      if (!n) return;   // a label already used
      var b = line ? [p.row === 0 || L.gapY ? line : 0, line, line, p.col === 0 || L.gapX ? line : 0].map(function (x) { return x + 'mm'; }).join(' ') : '0';   // with no gap, neighbours share one line
      var inner = n.test ? '<b style="font-size:' + Math.min(28, fontPt('00', L)) + 'pt">' + n.test + '</b>' :
        '<b style="font-size:' + fontPt(n.first, L) + 'pt">' + esc(n.first) + '</b><span style="font-size:' + fontPt(n.last, L, true) + 'pt">' + esc(n.last) + '</span>';
      pages[p.page] += '<div class="lab" style="left:' + p.x + 'mm;top:' + p.y + 'mm;width:' + L.w + 'mm;height:' + L.h + 'mm;border-width:' + b + '">' + inner + '</div>';
    });
    return pages.map(function (h) { return '<div class="sheet ' + (L.page === 'Letter' ? 'letter' : 'a4') + '" style="width:' + pg.w + 'mm;height:' + (pg.h - 1) + 'mm">' + h + '</div>'; }).join('');
  }

  var api = { PAGES: PAGES, PRESETS: PRESETS, LINES: LINES, layout: layout, problems: problems, perPage: perPage, place: place, fontPt: fontPt, sheets: sheets };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Badges = api;
})(this);
