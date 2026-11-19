/* Church & Trellis – dates that can be typed. A phone's calendar opens on today, so a birthday in 1990 meant tapping back
 * month by month. Every date box (<input type="date">: birthdays, anniversaries, funerals, terms, leave, archives…)
 * gets a box to type in ("12 Aug 1990", "12/08/1990", "1990-08-12") next to a small
 * calendar button. The date box itself stays in the page and keeps the value as YYYY-MM-DD, so the code reading it
 * (and the browser tests filling it) don't change.
 * Typed dates are read day first (South Africa): 03/04/1990 is 3 April. Month names in English, Afrikaans and the
 * language being used. `parse` is a rule only, tested by tests/datebox.test.js. */
(function (global) {
  'use strict';
  var MONTHS = [['jan'], ['feb'], ['mar', 'mrt', 'maa'], ['apr'], ['may', 'mei'], ['jun'], ['jul'], ['aug'], ['sep'], ['oct', 'okt'], ['nov'], ['dec', 'des']];

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function month(word, extra) {
    var w = word.toLowerCase();
    for (var i = 0; i < 12; i++) {
      var names = MONTHS[i].concat(extra && extra[i] ? [String(extra[i]).toLowerCase().replace(/\.$/, '')] : []);
      for (var j = 0; j < names.length; j++) if (names[j].length >= 3 && w.indexOf(names[j]) === 0) return i + 1;
    }
    return 0;
  }
  function build(y, m, d, thisYear) {
    if (y < 100) y += (y <= thisYear % 100 ? 2000 : 1900);
    if (y < 1850 || m < 1 || m > 12 || d < 1) return null;
    var dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCMonth() !== m - 1) return null;   // 31 April, 29 Feb in a common year
    return y + '-' + pad(m) + '-' + pad(d);
  }

  /** What was typed → 'YYYY-MM-DD'; '' for nothing typed; null when it isn't a date.
   *  opts.full: only accept a four-digit year (while the person is still typing "12 aug 19…");
   *  opts.months: the month names of the language in use; opts.year: this year (for "12/08/90"). */
  function parse(text, opts) {
    opts = opts || {};
    var s = String(text == null ? '' : text).trim(), m, thisYear = opts.year || new Date().getFullYear();
    if (!s) return '';
    var yearOk = function (y) { return !opts.full || y.length === 4; };
    if ((m = /^(\d{4})[-\/. ](\d{1,2})[-\/. ](\d{1,2})$/.exec(s))) return build(+m[1], +m[2], +m[3], thisYear);
    if ((m = /^(\d{1,2})[-\/. ]+(\d{1,2})[-\/. ]+(\d{2}|\d{4})$/.exec(s))) return yearOk(m[3]) ? build(+m[3], +m[2], +m[1], thisYear) : null;
    if ((m = /^(\d{2})(\d{2})(\d{4})$/.exec(s))) return build(+m[3], +m[2], +m[1], thisYear);
    var parts = s.split(/[\s,.\/-]+/).filter(Boolean), mon = 0, nums = [];
    for (var i = 0; i < parts.length; i++) {
      if (/^\d+(st|nd|rd|th)?$/i.test(parts[i])) nums.push(parts[i].replace(/\D/g, ''));
      else if (!mon && (mon = month(parts[i], opts.months))) continue;
      else return null;
    }
    if (!mon || nums.length !== 2) return null;
    var yi = nums[0].length > 2 ? 0 : nums[1].length > 2 ? 1 : +nums[0] > 31 ? 0 : 1;
    if (!yearOk(nums[yi])) return null;
    return build(+nums[yi], mon, +nums[1 - yi], thisYear);
  }

  var api = { parse: parse };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  global.DateBox = api;

  /* ---- In the page ---- */
  var T = function (s) { return global.T ? global.T(s) : s; };
  var monNames = function () { try { return global.I18n.mon(); } catch (e) { return null; } };
  var proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

  function shown(iso) {
    if (!iso) return '';
    var p = iso.split('-'), names = monNames() || ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return +p[2] + ' ' + names[+p[1] - 1] + ' ' + p[0];
  }

  function enhance(cal) {
    if (cal.dataset.typed) return;
    cal.dataset.typed = '1';
    var had = document.activeElement === cal;   // focused before this ran (it runs just after the page is drawn)
    var wrap = document.createElement('span'), box = document.createElement('input');
    wrap.className = 'date-typed';
    box.type = 'text'; box.className = 'date-text'; box.autocomplete = 'off';
    box.placeholder = T('e.g. 12 Aug 1990');
    box.value = shown(proto.get.call(cal));
    box.disabled = cal.disabled;
    if (cal.id) box.id = cal.id + '-text';
    if (cal.getAttribute('aria-required')) box.setAttribute('aria-required', 'true');
    cal.parentNode.insertBefore(wrap, cal);
    wrap.appendChild(box); wrap.appendChild(cal);
    cal.classList.add('date-cal');
    cal.title = T('Pick from a calendar');
    cal.setAttribute('aria-label', T('Pick from a calendar'));
    cal.tabIndex = -1;
    cal.focus = function (o) { box.focus(o); };   // "go to the anniversary box" puts the cursor where it can be typed
    if (had) box.focus();

    // Set in code (e.g. a South African ID number fills in the birthday) or by the calendar: show it in the box.
    Object.defineProperty(cal, 'value', { configurable: true,
      get: function () { return proto.get.call(cal); },
      set: function (v) { proto.set.call(cal, v); if (document.activeElement !== box) box.value = shown(proto.get.call(cal)); } });
    cal.addEventListener('input', function () { box.value = shown(proto.get.call(cal)); wrong(false); });
    cal.addEventListener('change', function () { box.value = shown(proto.get.call(cal)); wrong(false); });
    cal.addEventListener('click', function () { try { cal.showPicker(); } catch (e) { /* older browsers open it themselves */ } });

    function fits(iso) { return iso && (!cal.max || iso <= cal.max) && (!cal.min || iso >= cal.min); }
    function put(iso) {
      if (proto.get.call(cal) === iso) return;
      proto.set.call(cal, iso);
      cal.dispatchEvent(new Event('input', { bubbles: true }));
      cal.dispatchEvent(new Event('change', { bubbles: true }));
    }
    function wrong(on) {
      box.classList.toggle('bad', on);
      box.setCustomValidity(on ? T('Type the date like 12 Aug 1990, or pick it from the calendar.') : '');
      if (on) box.reportValidity();
    }
    box.addEventListener('input', function () {
      var iso = parse(box.value, { full: true, months: monNames() });
      if (iso === '') put('');
      else if (iso && fits(iso)) { put(iso); wrong(false); }
    });
    box.addEventListener('change', function () {
      var iso = parse(box.value, { months: monNames() });
      if (iso === '') { put(''); wrong(false); return; }
      if (iso && fits(iso)) { put(iso); box.value = shown(iso); wrong(false); }
      else { put(''); wrong(true); }
    });
  }

  function scan(root) {
    if (!root.querySelectorAll) return;
    if (root.matches && root.matches('input[type=date]')) enhance(root);
    Array.prototype.forEach.call(root.querySelectorAll('input[type=date]'), enhance);
  }
  function start() {
    scan(document.body);
    new MutationObserver(function (list) {
      list.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, scan); });
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})(typeof window !== 'undefined' ? window : this);
