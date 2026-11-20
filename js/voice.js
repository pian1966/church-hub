/* Church & Trellis – say a name instead of typing it. A microphone button beside the boxes where people look for someone
 * (People's search, every "find someone" box, lists of names, Add person, the names from a sheet). It uses the phone's or
 * browser's own speech recognition (Chrome sends the sound to Google to be understood, Safari to Apple) – Church & Trellis
 * never records or keeps it. What was heard goes into the box as if it had been typed, and the lists then also show names
 * that *sound like* it (NameList.rank), because names – especially isiZulu, isiXhosa, Sesotho and Afrikaans ones – are
 * often heard a little differently. Shown only where the browser can do it, and not offline. POPIA: docs/POPIA.md "Saying a name".
 *
 *   Voice.can()                        → can this browser listen?
 *   Voice.button(target, opts)         → the button's HTML; target = a CSS selector for the box (opts.mode: 'append' adds a line
 *                                        to a list of names; 'name' fills first and surname: opts.last = the surname box)
 * Any element with class "mic-btn" and data-mic works, wherever it is drawn.
 */
var Voice = (function () {
  'use strict';
  var T = function (s, v) { return window.I18n ? I18n.t(s, v) : s; };
  var MIC = 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3';
  var now = null;   // { rec, btn }

  function Rec() { return typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition); }
  /** The Church & Trellis Android app has no speech recognition in its web view: it listens itself (ChurchHubApp.listen) and
   *  answers through window.churchHubHeard(text) – null when nothing was heard (android/ MainActivity). */
  function app() { return typeof window !== 'undefined' && window.ChurchHubApp && typeof window.ChurchHubApp.listen === 'function'; }
  function can() { return !!(Rec() || app()) && !(window.Store && Store.offline && Store.offline()); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function icon() { return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + MIC + '"/></svg>'; }
  function button(target, opts) {
    if (!can()) return '';
    opts = opts || {};
    var lab = T('Say the name');
    return '<button type="button" class="mic-btn' + (opts.cls ? ' ' + opts.cls : '') + '" data-mic="' + esc(target) + '"' + (opts.mode ? ' data-mic-mode="' + esc(opts.mode) + '"' : '') +
      (opts.last ? ' data-mic-last="' + esc(opts.last) + '"' : '') + ' aria-label="' + esc(lab) + '" title="' + esc(lab) + '">' + icon() + '</button>';
  }
  /** English as spoken in the church's country (as Ask in your own words does): it copes best with names from every language. */
  function lang() { return 'en-' + ((window.Countries && window.Store && Countries.church(Store.settings() || {}).code) || 'ZA'); }
  function stop() { if (now) { try { if (now.rec) now.rec.abort(); } catch (e) { /* already stopped */ } done(); } }
  function done() {
    if (!now) return;
    if (now.was !== undefined) window.churchHubHeard = now.was;
    now.btn.classList.remove('listening'); now.btn.setAttribute('aria-pressed', 'false'); now = null;
  }
  function put(box, text) {
    box.value = text;
    box.dispatchEvent(new Event('input', { bubbles: true }));
    try { box.focus({ preventScroll: true }); var n = box.value.length; box.setSelectionRange(n, n); } catch (e) { /* not every box can */ }
  }
  function listen(btn) {
    var R = Rec(); if (!R && !app()) return;
    if (now) { var same = now.btn === btn; stop(); if (same) return; }
    var scope = btn.closest('.dialog, .find-box, .cg-find, label, .mic-wrap') || document;
    var box = (btn.dataset.mic && (scope.querySelector(btn.dataset.mic) || document.querySelector(btn.dataset.mic))) || (btn.parentNode && btn.parentNode.querySelector('input, textarea'));
    if (!box) return;
    var mode = btn.dataset.micMode || '', before = box.value;
    var heard = function (text) { return mode === 'append' ? (before.trim() ? before.replace(/\s*$/, '\n') : '') + text : text; };
    var final = function (alts) {
      var text = alts[0];
      box.dataset.spoken = alts.join('|');
      if (mode === 'name') {
        var row = window.NameList ? NameList.fromText(text)[0] : null, last = btn.dataset.micLast && document.querySelector(btn.dataset.micLast);
        if (row && last && row.last) { put(box, row.first); put(last, row.last); } else put(box, text);
      } else put(box, heard(text));
    };
    btn.classList.add('listening'); btn.setAttribute('aria-pressed', 'true');
    if (!R) {   // the Android app
      now = { rec: null, btn: btn, was: window.churchHubHeard };
      window.churchHubHeard = function (text) {
        done();
        if (text == null || !String(text).trim()) { window.Hub && Hub.toast(T('Nothing was heard. Tap the microphone and say the name.'), true); return; }
        final([String(text).trim()]);
      };
      window.ChurchHubApp.listen(lang());
      return;
    }
    var rec = new R();
    rec.lang = lang(); rec.interimResults = true; rec.maxAlternatives = 5; rec.continuous = false;
    now = { rec: rec, btn: btn };
    rec.onresult = function (ev) {
      var res = ev.results[ev.results.length - 1], text = String(res[0].transcript || '').trim(); if (!text) return;
      if (!res.isFinal) { if (mode !== 'name') box.value = heard(text); return; }
      var alts = []; for (var i = 0; i < res.length; i++) { var a = String(res[i].transcript || '').trim(); if (a && alts.indexOf(a) < 0) alts.push(a); }
      final(alts);
    };
    rec.onerror = function (ev) {
      var e = ev && ev.error;
      if (e === 'not-allowed' || e === 'service-not-allowed') window.Hub && Hub.toast(T('Allow the microphone for Church & Trellis in your browser’s settings to say names.'), true);
      else if (e === 'no-speech') window.Hub && Hub.toast(T('Nothing was heard. Tap the microphone and say the name.'), true);
      else if (e === 'network') window.Hub && Hub.toast(T('Saying names needs the internet.'), true);
      done();
    };
    rec.onend = done;
    try { rec.start(); } catch (e) { done(); }
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('click', function (ev) {
      var b = ev.target.closest && ev.target.closest('.mic-btn'); if (!b) return;
      ev.preventDefault(); ev.stopPropagation(); listen(b);
    }, true);
    window.addEventListener('hashchange', stop);
  }
  return { can: can, button: button, stop: stop };
})();
