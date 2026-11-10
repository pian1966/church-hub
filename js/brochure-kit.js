/*
 * Church Hub – the brochure editor's rules (About → Brochures → Edit). The brochures themselves are brochure.html; the church's
 * own wording and design are kept in settings.brochures and laid over it when the brochure is shown in Church Hub:
 *   { design: { accent: '#E8590C', font: 'Nunito' },
 *     members:  { texts: { key: { o: original text, h: their wording } }, hidden: { key: original text } },
 *     churches: { … } }
 * A text is found by its place (sheet and position) and is only replaced while the original there is still the same, so when
 * Church Hub's own wording changes in a new version, the church's old edit doesn't land on the wrong line (it is listed instead).
 * Pure functions, tested with node: tests/brochure-kit.test.js. The page part (iframe, editing) is in js/mod-about.js.
 */
var BrochureKit = (function () {
  'use strict';
  var DEFAULT = { accent: '#E8590C', font: 'Nunito' };
  // Friendly fonts from Google Fonts that read well in print; the first is the brochure's own
  var FONTS = [['Nunito', 'Nunito – rounded and friendly'], ['Poppins', 'Poppins – modern'], ['Open Sans', 'Open Sans – plain and clear'],
    ['Lato', 'Lato – light and neat'], ['Merriweather', 'Merriweather – a classic book style'], ['Lora', 'Lora – elegant'], ['Playfair Display', 'Playfair Display – formal headings']];

  function hex(c) { var m = /^#?([0-9a-f]{6})$/i.exec(String(c || '').trim()); return m ? '#' + m[1].toUpperCase() : ''; }
  function rgb(h) { h = hex(h).slice(1); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function toHex(a) { return '#' + a.map(function (x) { return ('0' + Math.max(0, Math.min(255, Math.round(x))).toString(16)).slice(-2); }).join('').toUpperCase(); }
  function mix(a, b, t) { return [0, 1, 2].map(function (i) { return a[i] + (b[i] - a[i]) * t; }); }
  function lum(a) { var c = a.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
  function contrast(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

  /** The brochure's colours from one colour: the cover (accent), a darker shade for headings and buttons (ink) that can carry
   *  white writing, a light tint for boxes (soft) and a very light paper. */
  function colours(accent) {
    var a = rgb(hex(accent) || DEFAULT.accent), ink = a, k = 0;
    while (contrast(ink, [255, 255, 255]) < 4.5 && k < 20) { k++; ink = mix(a, [0, 0, 0], k * 0.05); }
    return { accent: toHex(a), ink: toHex(ink), soft: toHex(mix(a, [255, 255, 255], 0.86)), paper: toHex(mix(a, [255, 255, 255], 0.965)),
      onAccent: contrast(a, [255, 255, 255]) >= 3 ? '#FFFFFF' : '#22201E' };
  }
  function font(name) { return FONTS.some(function (f) { return f[0] === name; }) ? name : DEFAULT.font; }
  function fontHref(name) { return 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(font(name)).replace(/%20/g, '+') + ':wght@400;600;700;800;900&display=swap'; }

  /** Text as compared: spaces tidied, so a line that only moved isn't counted as changed. */
  function norm(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }

  /** What someone typed, made safe to put back into the brochure: words, bold and italic, line breaks, and the church's name and
   *  address (spans with data-fill); everything else is reduced to its text. */
  function clean(html) {
    var out = '', s = String(html || '').replace(/<!--[\s\S]*?-->/g, '').replace(/&nbsp;/g, ' ');
    var re = /<\s*(\/)?\s*([a-z0-9]+)([^>]*)>|([^<]+)/gi, m, open = [];
    while ((m = re.exec(s))) {
      if (m[4] !== undefined) { out += m[4].replace(/[<>"]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); continue; }
      var close = !!m[1], tag = m[2].toLowerCase(), attrs = m[3] || '';
      if (tag === 'br') { out += '<br>'; continue; }
      if (tag === 'div' || tag === 'p') { if (!close && out && !/<br>$/.test(out)) out += '<br>'; continue; }   // a new line typed in some browsers
      var keep = { b: 'b', strong: 'b', i: 'i', em: 'i' }[tag];
      if (tag === 'span') {
        var fill = /data-fill\s*=\s*["']?(church|link)/i.exec(attrs), url = /class\s*=\s*["'][^"']*\burl\b/i.test(attrs);
        if (close) { if (open.length && open[open.length - 1] !== 'x') out += '</span>'; open.pop(); }
        else if (fill || url) { out += '<span' + (url ? ' class="url"' : '') + (fill ? ' data-fill="' + fill[1].toLowerCase() + '"' : '') + '>'; open.push('span'); }
        else open.push('x');
        continue;
      }
      if (keep) out += close ? '</' + keep + '>' : '<' + keep + '>';
    }
    while (open.length) { if (open.pop() === 'span') out += '</span>'; }
    return out.replace(/(<br>)+$/, '').slice(0, 2000);
  }

  /** The saved settings, tidied: only what the editor makes. */
  function tidy(b) {
    b = b || {}; var out = { design: { accent: hex((b.design || {}).accent) || DEFAULT.accent, font: font((b.design || {}).font) } };
    ['members', 'churches'].forEach(function (w) {
      var x = b[w] || {}, t = {}, hd = {};
      Object.keys(x.texts || {}).forEach(function (k) { var v = x.texts[k]; if (v && typeof v.h === 'string' && typeof v.o === 'string') t[k] = { o: norm(v.o), h: clean(v.h) }; });
      Object.keys(x.hidden || {}).forEach(function (k) { if (typeof x.hidden[k] === 'string') hd[k] = norm(x.hidden[k]); });
      out[w] = { texts: t, hidden: hd };
    });
    return out;
  }
  /** Is anything changed from Church Hub's own brochure? */
  function changed(b, who) {
    b = tidy(b);
    if (!who) return b.design.accent !== DEFAULT.accent || b.design.font !== DEFAULT.font || changed(b, 'members') || changed(b, 'churches');
    return !!(Object.keys(b[who].texts).length || Object.keys(b[who].hidden).length);
  }

  return { DEFAULT: DEFAULT, FONTS: FONTS, colours: colours, font: font, fontHref: fontHref, norm: norm, clean: clean, tidy: tidy, changed: changed, contrast: function (a, b) { return contrast(rgb(a), rgb(b)); } };
})();
if (typeof module !== 'undefined') module.exports = BrochureKit;
