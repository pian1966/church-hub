/* Church & Trellis – "Show me" (Help): a guided tour on the real screen. It points at each button an answer names, one after another, with the
 * sentence from the answer, like a short video – but it is always the current screen, in the person's own language, nothing to re-record.
 * The steps come from Help.steps (js/help.js); Help (js/mod-help.js) opens the screen and starts it. Nothing is kept or sent anywhere. */
var HelpTour = (function () {
  'use strict';
  var T = I18n.t, esc = Hub.esc, tour = null;
  var norm = function (s) { return String(s || '').replace(/\s+/g, ' ').trim().toLowerCase(); };
  var shown = function (el) { var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };

  /** The button, tab or heading on this screen that has these words: the exact words first, else one that starts with them. */
  function find(label) {
    var want = norm(label), root = document.getElementById('main') || document, loose = null, hit = null;
    if (!want) return null;
    [].some.call(root.querySelectorAll('button, a, summary, label, legend, h1, h2, h3, h4, [role=tab], .btn, .seg *'), function (el) {
      if (el.closest('.tour-card') || !shown(el)) return false;
      var t = norm(el.textContent);
      if (t === want) { hit = el; return true; }
      if (!loose && t.indexOf(want) === 0 && t.length <= want.length + 14) loose = el;
      return false;
    });
    return hit || loose;
  }

  function place() {
    if (!tour) return;
    var ring = tour.ring, el = tour.el;
    if (!el || !document.body.contains(el)) { ring.hidden = true; return; }
    var r = el.getBoundingClientRect();
    ring.hidden = false;
    ring.style.left = (r.left - 5) + 'px'; ring.style.top = (r.top - 5) + 'px'; ring.style.width = (r.width + 10) + 'px'; ring.style.height = (r.height + 10) + 'px';
  }

  function show(i) {
    var s = tour.steps[i], n = tour.steps.length;
    tour.i = i; tour.el = find(T(s.target));
    if (tour.el) { tour.el.scrollIntoView({ block: 'center' }); }
    place();
    var last = i === n - 1;
    tour.card.innerHTML =
      '<div class="tour-top"><b>' + esc(T('Show me')) + '</b><span>' + esc(T('Step {n} of {total}', { n: i + 1, total: n })) + '</span>' +
      '<button type="button" class="tour-x" data-t="close" aria-label="' + esc(T('Close')) + '">✕</button></div>' +
      '<p class="tour-say">' + esc(s.say) + '</p>' + (tour.el ? '' : '<p class="tour-look">' + esc(T('Look for {name}', { name: T(s.target) })) + '</p>') +
      '<div class="tour-btns"><button type="button" class="btn small" data-t="back"' + (i ? '' : ' disabled') + '>' + esc(T('Back')) + '</button>' +
      '<button type="button" class="btn small" data-t="play">' + esc(T(tour.playing && !last ? 'Pause' : 'Play')) + '</button>' +
      '<button type="button" class="btn small primary" data-t="' + (last ? 'close' : 'next') + '">' + esc(T(last ? 'Done' : 'Next')) + '</button></div>';
    clearTimeout(tour.timer);
    if (tour.playing && !last) tour.timer = setTimeout(function () { if (tour) show(i + 1); }, 5500);
  }

  function stop() {
    if (!tour) return;
    clearTimeout(tour.timer);
    window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place); window.removeEventListener('hashchange', away);
    tour.ring.remove(); tour.card.remove(); tour = null;
  }
  function away() { stop(); }   // the person went somewhere else

  /** Start the tour of these steps (from Help.steps) on the screen that is open now. */
  function start(steps) {
    stop();
    if (!steps || !steps.length) return;
    var ring = document.createElement('div'), card = document.createElement('div');
    ring.className = 'tour-ring'; ring.hidden = true; card.className = 'tour-card'; card.setAttribute('role', 'dialog'); card.setAttribute('aria-live', 'polite');
    document.body.appendChild(ring); document.body.appendChild(card);
    tour = { steps: steps, i: 0, ring: ring, card: card, el: null, playing: true, timer: 0 };
    card.addEventListener('click', function (e) {
      var b = e.target.closest('[data-t]'); if (!b || !tour) return;
      var a = b.getAttribute('data-t');
      if (a === 'close') stop();
      else if (a === 'next') show(Math.min(tour.i + 1, tour.steps.length - 1));
      else if (a === 'back') show(Math.max(tour.i - 1, 0));
      else if (a === 'play') { tour.playing = !tour.playing; show(tour.i); }
    });
    window.addEventListener('scroll', place, true); window.addEventListener('resize', place); window.addEventListener('hashchange', away);
    show(0);
  }
  return { start: start, stop: stop, find: find };
})();
