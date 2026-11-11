/*
 * Church Hub – simple formatting for documents people read in the app (the Library policy, Archive notes and the like).
 * Typed as plain text, shown formatted – nothing else is allowed through, so it is always safe to show:
 *   # Heading, ## Smaller heading          – a line starting with # or ##
 *   - item  or  * item                      – a bulleted list
 *   1. item                                 – a numbered list
 *   **bold**, *italic*, __underlined__       – within a line
 *   https://…                               – a link
 *   a blank line                            – a new paragraph; a single line break stays a line break
 * Tested with node: tests/richtext.test.js.
 */
var RichText = (function () {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  /** Bold, italic, underline and links within one line (already made safe). */
  function inline(s) {
    var links = [];
    s = esc(s).replace(/\bhttps?:\/\/[^\s<*]+[^\s<.,;:!?)'"&*_]/g, function (u) { links.push(u); return '\u0000' + (links.length - 1) + '\u0000'; });
    s = s.replace(/\*\*(?=\S)([^*]*?\S)\*\*/g, '<b>$1</b>')
      .replace(/__(?=\S)([^_]*?\S)__/g, '<u>$1</u>')
      .replace(/(^|[^*\w])\*(?=\S)([^*]*?\S)\*(?![*\w])/g, '$1<i>$2</i>');
    return s.replace(/\u0000(\d+)\u0000/g, function (m, i) { var u = links[+i]; return '<a href="' + u + '" target="_blank" rel="noopener">' + u + '</a>'; });
  }
  /** Plain text → safe HTML. */
  function html(text) {
    var lines = String(text || '').replace(/\r\n?/g, '\n').split('\n'), out = [], para = [], list = null;
    function flushPara() { if (para.length) out.push('<p>' + para.map(inline).join('<br>') + '</p>'); para = []; }
    function flushList() { if (list) out.push('<' + list.tag + '>' + list.items.map(function (x) { return '<li>' + inline(x) + '</li>'; }).join('') + '</' + list.tag + '>'); list = null; }
    lines.forEach(function (raw) {
      var line = raw.replace(/\s+$/, ''), m;
      if (!line.trim()) { flushPara(); flushList(); return; }
      if ((m = /^\s*(#{1,3})\s+(.+)$/.exec(line))) { flushPara(); flushList(); var h = m[1].length + 2; out.push('<h' + h + '>' + inline(m[2]) + '</h' + h + '>'); return; }
      if ((m = /^\s*[-*•]\s+(.+)$/.exec(line))) { flushPara(); if (list && list.tag !== 'ul') flushList(); list = list || { tag: 'ul', items: [] }; list.items.push(m[1]); return; }
      if ((m = /^\s*\d{1,3}[.)]\s+(.+)$/.exec(line))) { flushPara(); if (list && list.tag !== 'ol') flushList(); list = list || { tag: 'ol', items: [] }; list.items.push(m[1]); return; }
      flushList(); para.push(line.trim());
    });
    flushPara(); flushList();
    return out.join('');
  }
  /** Has the text any formatting marks? (to show the formatted view only when it changes something) */
  function formatted(text) { return /(^|\n)\s*(#{1,3}\s|[-*•]\s|\d{1,3}[.)]\s)|\*\*|__|(^|\W)\*\S/.test(String(text || '')); }
  /* ---------- in the browser: buttons above a text box that add the marks ---------- */
  var TOOLS = [['b', '**', '**', 'B'], ['i', '*', '*', 'I'], ['u', '__', '__', 'U'], ['h', '# ', '', 'H'], ['ul', '- ', '', '•'], ['ol', '1. ', '', '1.']];
  /** The buttons for the text box with this id; labels = { b, i, u, h, ul, ol, hint } in the chosen language. */
  function tools(id, labels) {
    labels = labels || {};
    return '<div class="rt-tools" role="toolbar" aria-label="' + esc(labels.bar || 'Formatting') + '">' + TOOLS.map(function (t) {
      return '<button type="button" class="btn small ghost" data-rt="' + t[0] + '" data-for="' + esc(id) + '" title="' + esc(labels[t[0]] || t[0]) + '" aria-label="' + esc(labels[t[0]] || t[0]) + '">' + (t[0] === 'b' ? '<b>B</b>' : t[0] === 'i' ? '<i>I</i>' : t[0] === 'u' ? '<u>U</u>' : esc(t[3])) + '</button>';
    }).join('') + '</div>' + (labels.hint ? '<small class="muted">' + esc(labels.hint) + '</small>' : '');
  }
  function apply(box, kind) {
    var t = TOOLS.filter(function (x) { return x[0] === kind; })[0]; if (!t || !box) return;
    var a = box.selectionStart, b = box.selectionEnd, v = box.value, sel = v.slice(a, b);
    if (t[2]) {   // around the words chosen
      box.value = v.slice(0, a) + t[1] + (sel || '') + t[2] + v.slice(b);
      box.setSelectionRange(a + t[1].length, a + t[1].length + sel.length);
    } else {      // at the start of each line chosen
      var start = v.lastIndexOf('\n', a - 1) + 1, lines = v.slice(start, b).split('\n'), n = 0;
      var done = lines.map(function (l) { n++; return (kind === 'ol' ? n + '. ' : t[1]) + l.replace(/^(#{1,3}|[-*•]|\d{1,3}[.)])\s+/, ''); }).join('\n');
      box.value = v.slice(0, start) + done + v.slice(b);
      box.setSelectionRange(start, start + done.length);
    }
    box.focus(); box.dispatchEvent(new Event('input', { bubbles: true }));
  }
  if (typeof document !== 'undefined') document.addEventListener('click', function (ev) {
    var btn = ev.target.closest && ev.target.closest('[data-rt]'); if (!btn) return;
    ev.preventDefault(); apply(document.getElementById(btn.dataset.for), btn.dataset.rt);
  });

  return { html: html, inline: inline, formatted: formatted, tools: tools };
})();
if (typeof module !== 'undefined') module.exports = RichText;
