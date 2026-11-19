/* Church & Trellis – Sesotho as written in Lesotho, worked out from the South African spelling in js/lang/st.js, so it is
 * always as complete as that file and needs no file of its own. Pure and tested: node tests/sesotho.test.js
 *
 * The two spellings differ in a few regular ways (South Africa → Lesotho):
 *   tjh → ch   (ntjha → ncha)            tsh → tš  (tshebeletso → tšebeletso)    kg → kh  (kgetha → khetha)
 *   d before i or u → l  (dintlha → lintlha, Modimo → Molimo)
 *   w before a vowel → o  (wa → oa, tswa → tsoa)    y before a vowel → e  (ya → ea, yona → eona)
 * A few things depend on grammar (e.g. "o" for "you" is "u" in Lesotho) and are left as they are, so it is a draft:
 * fluent speakers can improve any wording under Translations. Names and English words (Church & Trellis, Google…) are kept. */
var Sesotho = (function () {
  'use strict';
  var KEEP = /^(Church|Hub|Google|Docs|Books|Search|WhatsApp|Firestore|Firebase|Elvanto|Claude|Gemini|Excel|Word|Android|iPhone|Safari|Chrome|Gmail|Outlook|Microsoft|Notion|Open|Library|Leave|Manager|Howick|Christ|Africa|South|PDF|CSV|ISBN|SMS|POPIA|JPEG|PNG|WebP|DVD|CD|app|email|online|offline|link|admin)$/i;

  function word(w) {
    if (KEEP.test(w) || /[A-Z].*[A-Z]/.test(w)) return w;   // a name or an English word; WhatsApp, PDF…
    var cap = /^[A-Z]/.test(w), s = w.toLowerCase();
    s = s.replace(/tjh/g, 'ch').replace(/tsh/g, 'tš').replace(/kg/g, 'kh')
      .replace(/d(?=[iu])/g, 'l')
      .replace(/w(?=[aeiou])/g, 'o').replace(/y(?=[aeiou])/g, 'e');
    return cap ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }
  /** One text: {parts}, <markup>, web and email addresses stay exactly as they are. */
  function text(x) {
    return String(x).split(/(\{\w+\}|<[^>]*>|\S+@\S+|https?:\/\/\S+|\S+\.(?:js|md|html|com|org|za)\b)/).map(function (piece, i) {
      if (i % 2) return piece;
      return piece.replace(/[A-Za-z]+/g, word);
    }).join('');
  }
  /** A whole language pack: { mon, dow, words: { English: Sesotho } }. */
  function pack(p) {
    var out = { mon: (p.mon || []).map(text), dow: (p.dow || []).map(text), words: {} };
    Object.keys(p.words || {}).forEach(function (en) { out.words[en] = text(p.words[en]); });
    return out;
  }
  return { word: word, text: text, pack: pack };
})();
if (typeof module !== 'undefined') module.exports = Sesotho;
