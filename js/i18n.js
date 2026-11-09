/*
 * Church Hub – languages for the screens members use: English, Afrikaans, isiZulu and isiXhosa.
 * Tested with node: tests/i18n.test.js (every T('…') text in the app has all four languages).
 *
 * How it works: code writes the English text inside T('…'); T looks it up here and returns the chosen language,
 * or the English when there is no translation (Administrator screens stay in English for now). {name} parts are
 * filled in by the code. Each language is remembered on this device (Store.pref), also before signing in.
 *
 * The words are in js/i18n/<area>.js, one file per part of the app (common.js for words used in several).
 * To correct a translation: find the English line there and change the Afrikaans, isiZulu or isiXhosa next to it.
 * Keep the {…} parts and any <b>…</b> exactly as they are. The isiZulu and isiXhosa were drafted by Claude (AI) and
 * should be checked by fluent speakers in the church before members rely on them.
 * Not translated on purpose: the church's own words (category names like Partner, team and service names, kinds of
 * leave, the privacy notice) and messages from the leave rules shared with Leave Manager.
 */
var I18n = (function () {
  'use strict';
  var LANGS = [['en', 'English'], ['af', 'Afrikaans'], ['zu', 'isiZulu'], ['xh', 'isiXhosa']];
  /** More languages, each in its own file (js/lang/<code>.js), loaded only when someone chooses it:
   *  [code, its own name, English name, continents]. Drafted by Claude (AI): fluent speakers should check them. */
  var MORE = [
    ['st', 'Sesotho', 'Sesotho', ['Africa']], ['tn', 'Setswana', 'Setswana', ['Africa']], ['nso', 'Sesotho sa Leboa', 'Sepedi', ['Africa']],
    ['ts', 'Xitsonga', 'Xitsonga', ['Africa']], ['ss', 'siSwati', 'siSwati', ['Africa']], ['ve', 'Tshivenḓa', 'Tshivenda', ['Africa']], ['nr', 'isiNdebele', 'isiNdebele', ['Africa']],
    ['sn', 'chiShona', 'Shona', ['Africa']], ['sw', 'Kiswahili', 'Swahili', ['Africa']], ['am', 'አማርኛ', 'Amharic', ['Africa']], ['yo', 'Yorùbá', 'Yoruba', ['Africa']],
    ['fr', 'Français', 'French', ['Africa', 'Europe', 'Americas']], ['pt', 'Português', 'Portuguese', ['Africa', 'Europe', 'Americas']],
    ['es', 'Español', 'Spanish', ['Europe', 'Americas']], ['de', 'Deutsch', 'German', ['Europe']], ['nl', 'Nederlands', 'Dutch', ['Europe']],
    ['it', 'Italiano', 'Italian', ['Europe']], ['pl', 'Polski', 'Polish', ['Europe']],
    ['en-US', 'American English', 'American English', ['Americas']]
  ];
  /** The word files, one per part of the app (js/i18n/<area>.js); index.html loads each after this file. */
  var AREAS = ['common', 'people', 'profile', 'edit', 'households', 'search', 'rosters', 'leave', 'me', 'care', 'life', 'messages', 'privacy', 'import', 'settings'];
  // Language files are fetched again with every new version of Church Hub (js/version.js), so phones don't keep old words
  var PACK_VERSION = 9, loading = {}, onLoad = [];
  function packV() { return (typeof ChurchHubVersion !== 'undefined' && ChurchHubVersion.version) || PACK_VERSION; }
  var DATES = {
    en: { mon: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] },
    af: { mon: ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des'], dow: ['So', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Sa'] },
    zu: { mon: ['Jan', 'Feb', 'Mas', 'Eph', 'Mey', 'Jun', 'Jul', 'Aga', 'Sep', 'Okt', 'Nov', 'Dis'], dow: ['Son', 'Mso', 'Bil', 'Tha', 'Sin', 'Hla', 'Mgq'] },
    xh: { mon: ['Jan', 'Feb', 'Mat', 'Epr', 'Mey', 'Jun', 'Jul', 'Aga', 'Sep', 'Okt', 'Nov', 'Dis'], dow: ['Caw', 'Mvu', 'Bin', 'Tha', 'Sin', 'Hla', 'Mgq'] }
  };

  // [English, Afrikaans, isiZulu, isiXhosa]
  // The words themselves are in js/i18n/<area>.js (one file per part of the app); each adds itself with I18n.rows([...]).
  var ROWS = [];

  var D = { af: {}, zu: {}, xh: {} };
  /** An area file (js/i18n/<area>.js) adds its lines: [[English, Afrikaans, isiZulu, isiXhosa], …]. */
  function rows(list) { list.forEach(function (r) { ROWS.push(r); D.af[r[0]] = r[1]; D.zu[r[0]] = r[2]; D.xh[r[0]] = r[3]; }); }
  var lang = 'en';
  /** Better wording suggested by the church's own speakers and approved by a checker (words/{code} in the database).
   *  It is used before the wording in this file, so improvements show at once, without a new version of the app. */
  var O = {}, waiters = {};
  /** The texts shown on the page someone was last on (so they can improve exactly those). */
  var seen = {}, seenPage = '', watching = true;

  /** A language file (js/lang/<code>.js) adds itself: { mon, dow, words: { English: translation } }. */
  function add(code, pack) {
    D[code] = pack.words || {}; DATES[code] = { mon: pack.mon || DATES.en.mon, dow: pack.dow || DATES.en.dow };
    if (loading[code] === 'wanted') { lang = code; if (typeof document !== 'undefined') document.documentElement.lang = code; onLoad.forEach(function (fn) { try { fn(code); } catch (e) { console.error(e); } }); }
    loading[code] = 'done';
    (waiters[code] || []).splice(0).forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
  }
  /** Fetch a language's file without switching to it (e.g. to suggest wording in it); cb when it is here. */
  function load(code, cb) {
    if (DATES[code] || !more(code) || typeof document === 'undefined') { if (cb) cb(); return; }
    (waiters[code] = waiters[code] || []).push(cb || function () {});
    if (!loading[code]) { loading[code] = 'asked'; var sc = document.createElement('script'); sc.src = 'js/lang/' + code + '.js?v=' + packV(); sc.onerror = function () { delete loading[code]; }; document.head.appendChild(sc); }
  }
  /** What a suggestion must keep from the English: the same {parts} and the same <b>…</b> markup. '' = fine. */
  function check(en, text) {
    var x = String(text || '').trim();
    if (!x) return 'empty';
    var parts = function (v) { return (String(v).match(/\{\w+\}/g) || []).sort().join(' '); };
    var tags = function (v) { return (String(v).match(/<\/?\w+/g) || []).join(); };
    if (parts(en) !== parts(x)) return 'parts';
    if (tags(en) !== tags(x)) return 'tags';
    return '';
  }
  function more(code) { return MORE.filter(function (m) { return m[0] === code; })[0]; }
  /** The text in the chosen language (or English), with {name} parts filled in. */
  function t(s, vars) {
    if (watching) seen[s] = 1;
    var x = (O[lang] && O[lang][s]) || (D[lang] && D[lang][s]) || s;
    if (vars) x = x.replace(/\{(\w+)\}/g, function (m, k) { return Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m; });
    return x;
  }
  /** One or many: tn('{n} person', '{n} people', 3). */
  function tn(one, many, n, vars) { var v = Object.assign({ n: n }, vars || {}); return t(n === 1 ? one : many, v); }
  function set(code) {
    if (!DATES[code] && more(code) && typeof document !== 'undefined') {   // fetch it; the screen is redrawn when it arrives (onLoad)
      Object.keys(loading).forEach(function (k) { if (loading[k] === 'wanted') loading[k] = 'asked'; });
      if (loading[code] !== 'asked') { var sc = document.createElement('script'); sc.src = 'js/lang/' + code + '.js?v=' + packV(); sc.onerror = function () { delete loading[code]; }; document.head.appendChild(sc); }
      loading[code] = 'wanted';
      return lang;
    }
    Object.keys(loading).forEach(function (k) { if (loading[k] === 'wanted') loading[k] = 'asked'; });
    lang = DATES[code] ? code : 'en';
    if (typeof document !== 'undefined') document.documentElement.lang = lang;
    return lang;
  }
  function picker(id) {
    return '<label class="lang-pick"><span class="sr">' + t('Language') + '</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"></path></svg>' +
      '<select class="lang-sel"' + (id ? ' id="' + id + '"' : '') + ' aria-label="' + t('Language') + '">' + options() + '</select></label>';
  }
  /** English first, then the languages by continent (Africa starts with Afrikaans, isiZulu and isiXhosa). */
  function options() {
    var cur = loading && Object.keys(loading).filter(function (k) { return loading[k] === 'wanted'; })[0] || lang, done = false;
    var opt = function (code, name, en) { var sel = code === cur && !done; if (sel) done = true; return '<option value="' + code + '"' + (sel ? ' selected' : '') + '>' + name + (en && en !== name ? ' (' + en + ')' : '') + '</option>'; };
    var ZA = LANGS.slice(1).map(function (l) { return [l[0], l[1], '', ['Africa']]; });   // Afrikaans, isiZulu, isiXhosa sit with Africa's languages
    return opt('en', 'English') + ['Africa', 'Europe', 'Americas'].map(function (c) {
      return '<optgroup label="' + t(c) + '">' + (c === 'Africa' ? ZA : []).concat(MORE.filter(function (m) { return m[3].indexOf(c) >= 0; })).map(function (m) { return opt(m[0], m[1], m[2]); }).join('') + '</optgroup>';
    }).join('');
  }


  return { LANGS: LANGS, MORE: MORE, ROWS: ROWS, rows: rows, AREAS: AREAS, t: t, tn: tn, set: set, add: add, get: function () { return lang; }, picker: picker,
    /** A language chosen from MORE has arrived (to redraw the screen). */ onLoad: function (fn) { onLoad.push(fn); },
    /** Drafted by Claude (AI) and not yet checked by fluent speakers (all of MORE). */ isDraft: function (code) { return !!more(code || lang); },
    mon: function () { return DATES[lang].mon; }, dow: function () { return DATES[lang].dow; },
    /** Every English text in the app (the first column above). */ english: function () { return ROWS.map(function (r) { return r[0]; }); },
    /** A language's name as people know it ('zu' → isiZulu; MORE also gives the English name). */
    name: function (code) { var l = LANGS.filter(function (x) { return x[0] === code; })[0] || more(code); return l ? l[1] : code; },
    /** The wording in use for one text in a language ('' = none yet, so English shows); builtIn: ignore approved changes. */
    word: function (code, en, builtIn) { return (!builtIn && O[code] && O[code][en]) || (D[code] && D[code][en]) || ''; },
    /** Use the approved wording for a language: { English: better wording }. */ override: function (code, words) { O[code] = words || {}; },
    load: load, check: check,
    /** The router says which page is showing (texts are collected per page); null while on the translations page itself. */
    page: function (id) { if (id === null) { watching = false; return; } watching = true; if (id !== seenPage) { seen = {}; seenPage = id; } },
    /** The texts shown on that page, as English. */ seen: function () { return Object.keys(seen); } };
})();
if (typeof module !== 'undefined') {   // node (tests): load the word files too
  global.I18n = I18n; I18n.AREAS.forEach(function (a) { require('./i18n/' + a + '.js'); });
  module.exports = I18n;
}
