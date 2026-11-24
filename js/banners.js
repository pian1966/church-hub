/* Church & Trellis – soft watercolour pictures at the top of every page.
 * Banners.decorate(main) turns the page's own heading (.page-head) into a picture banner: the title, the one-line lead and
 * the buttons stay exactly as they were (so nothing about how they work changes); a painted background and a small
 * scene for that part of the app are added behind them. A church can choose "Warm line art" or "Plain" instead (Settings → Colours →
 * Page pictures; settings.look = 'line' | 'plain'). Pure drawing – no data is read or written here. Test: tests/banners.test.js */
var Banners = (function () {
  'use strict';

  /* Which colour and picture each part of the app gets (by the first part of the address, #/library/... → library) */
  var TINT = { library: '#2F7A78', archives: '#8A5A2B', borrowed: '#6A4C93', messages: '#3563A8', market: '#C2571A', board: '#B7791F',
    care: '#BE4560', midweek: '#3F4B94', groups: '#BE4560', people: '#2E7D6B', rosters: '#2F6F9F', leave: '#C98A1B', events: '#B5483A',
    settings: '#5B6770', import: '#6B8E23', words: '#1F8FA8', privacy: '#2F6B4F', support: '#A5532B', home: '#E8590C', me: '#C0527A', about: '#7A5C99', generic: '#2F7A78' };
  var ALIAS = { life: 'midweek', care: 'care', leaders: 'groups' };

  /** The picture for an address like "#/library/archives" ('' when this page has none). */
  function keyOf(hash) {
    var p = String(hash || '').replace(/^#\/?/, '').split('?')[0].split('/'), a = p[0] || 'home';
    if (a === 'library') return p[1] === 'archives' ? 'archives' : p[1] === 'borrowed' ? 'borrowed' : 'library';
    if (own(TINT, a)) return a;
    return own(ALIAS, a) ? ALIAS[a] : a;
  }
  /** A small number made from a page's name, so a page with no picture of its own still gets its own colour and picture (and keeps them). */
  function seed(s) { var h = 7, i; s = String(s || ''); for (i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
  /** The colour of a page: its own, or one made from its name. */
  function tintOf(key) { return own(TINT, key) ? TINT[key] : 'hsl(' + (seed(key) % 360) + ' 42% 40%)'; }
  /** The picture of a page: its own, or one of the four general ones chosen from its name. */
  function sceneOf(key) { return own(SCENE, key) ? SCENE[key] : SCENE['generic' + ((seed(key) >>> 3) % 4)]; }
  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function plain(settings) { return !!settings && settings.look === 'plain'; }
  /** Which look the church chose: 'watercolour' (the default), 'line' (warm line art) or 'plain' (the original). */
  function look(settings) { var l = settings && settings.look; return l === 'plain' || l === 'line' ? l : 'watercolour'; }

  /* ---------- the little drawings (class a/b = main shapes, c = warm touch, w = paper) ---------- */
  function rect(x, y, w, h, c, r) { return '<rect class="' + c + '" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + (r == null ? 3 : r) + '"/>'; }
  function circ(x, y, r, c) { return '<circle class="' + c + '" cx="' + x + '" cy="' + y + '" r="' + r + '"/>'; }
  function path(d, c) { return '<path class="' + c + '" d="' + d + '"/>'; }
  function books(x0, base, spec) {
    var x = x0, out = '';
    spec.forEach(function (s) {
      if (s[0] === 'lean') { out += '<g transform="rotate(-14 ' + (x + 8) + ' ' + base + ')">' + rect(x, base - s[2], s[1], s[2], s[3]) + '</g>'; x += s[2] * 0.28 + 14; return; }
      out += rect(x, base - s[1], s[0], s[1], s[2]) + path('M' + (x + 4) + ' ' + (base - s[1] + 10) + 'h' + (s[0] - 8) + 'M' + (x + 4) + ' ' + (base - 12) + 'h' + (s[0] - 8), 'w');
      x += s[0] + 3;
    });
    return out;
  }
  function figure(x, y, s, c) {
    return path('M' + (x - 20 * s) + ' ' + y + 'v' + (-14 * s) + 'a' + (20 * s) + ' ' + (20 * s) + ' 0 0 1 ' + (40 * s) + ' 0v' + (14 * s) + 'z', c) + circ(x, y - 48 * s, 12 * s, c);
  }
  function heart(x, y, s, c) { return path('M' + x + ' ' + (y + 12 * s) + 'C' + (x - 22 * s) + ' ' + (y - 4 * s) + ' ' + (x - 12 * s) + ' ' + (y - 20 * s) + ' ' + x + ' ' + (y - 8 * s) + 'C' + (x + 12 * s) + ' ' + (y - 20 * s) + ' ' + (x + 22 * s) + ' ' + (y - 4 * s) + ' ' + x + ' ' + (y + 12 * s) + 'z', c); }
  function star(x, y, r, c) { return path('M' + x + ' ' + (y - r) + 'L' + (x + r * .28) + ' ' + (y - r * .28) + 'L' + (x + r) + ' ' + y + 'L' + (x + r * .28) + ' ' + (y + r * .28) + 'L' + x + ' ' + (y + r) + 'L' + (x - r * .28) + ' ' + (y + r * .28) + 'L' + (x - r) + ' ' + y + 'L' + (x - r * .28) + ' ' + (y - r * .28) + 'z', c); }
  function leaf(x, y, rot, s, c) { return '<g transform="translate(' + x + ' ' + y + ') rotate(' + rot + ') scale(' + s + ')">' + path('M0 0C-14 -10 -14 -34 0 -46C14 -34 14 -10 0 0z', c) + '</g>'; }
  function mug(x, y, c) { return rect(x, y - 26, 26, 26, c, 6) + path('M' + (x + 26) + ' ' + (y - 20) + 'h6a6 6 0 0 1 0 14h-6', c) + path('M' + (x + 7) + ' ' + (y - 34) + 'q-4 -6 0 -11M' + (x + 16) + ' ' + (y - 34) + 'q-4 -6 0 -11', 'w'); }
  function calendar(x, y, w, h) {
    var out = rect(x, y, w, h, 'w', 10) + rect(x, y, w, 28, 'c', 10) + circ(x + 26, y - 6, 5, 'a') + circ(x + w - 26, y - 6, 5, 'a');
    for (var r = 0; r < 3; r++) for (var q = 0; q < 4; q++) out += circ(x + 22 + q * ((w - 44) / 3), y + 50 + r * 20, 4, r === 1 && q === 2 ? 'c' : 'b');
    return out;
  }
  function hills() { return path('M0 200V150C80 120 140 130 210 150S330 175 420 140 520 120 560 135V200z', 'b') + path('M0 200V172C90 150 170 168 260 176S420 170 560 160V200z', 'a'); }

  var SCENE = {
    library: function () {
      return rect(120, 28, 7, 154, 'a', 2) + rect(512, 28, 7, 154, 'a', 2) + rect(120, 28, 399, 7, 'a', 2) + rect(120, 98, 399, 7, 'a', 2) + rect(120, 175, 399, 7, 'a', 2) +
        books(136, 98, [[24, 58, 'a'], [18, 66, 'c'], [28, 50, 'b'], [20, 62, 'a'], [16, 46, 'b'], [26, 60, 'a'], ['lean', 22, 58, 'c'], [22, 54, 'b']]) +
        books(150, 175, [[22, 56, 'b'], [26, 66, 'a'], [18, 50, 'c'], [24, 60, 'b'], [20, 44, 'a'], [28, 62, 'b'], [18, 52, 'a'], [24, 58, 'c'], [20, 48, 'b']]) +
        rect(440, 62, 40, 36, 'c', 6) + leaf(460, 64, -30, .75, 'b') + leaf(460, 64, 28, .85, 'a') + leaf(460, 64, 0, 1, 'b') +
        rect(398, 140, 34, 35, 'w', 5) + path('M404 152h22M404 162h14', 'a') + circ(488, 150, 15, 'w') + path('M473 150h30', 'a');
    },
    archives: function () {
      var out = rect(130, 138, 150, 42, 'a', 5) + rect(122, 128, 166, 14, 'b', 4) + rect(190, 152, 30, 14, 'w', 3) +
        rect(140, 90, 130, 38, 'b', 5) + rect(133, 80, 144, 13, 'a', 4) + rect(190, 102, 30, 12, 'w', 3) +
        rect(152, 44, 106, 36, 'a', 5) + rect(145, 35, 120, 12, 'c', 4) + rect(190, 54, 30, 12, 'w', 3) + rect(318, 38, 104, 142, 'a', 8);
      [48, 92, 136].forEach(function (y) { out += rect(328, y, 84, 36, 'b', 5) + rect(352, y + 12, 36, 10, 'w', 3); });
      return out + path('M440 180l16 -112l22 4l-8 108z', 'c') + path('M468 180l18 -126l22 5l-10 121z', 'b') + path('M496 180l22 -112l20 6l-14 106z', 'a') + circ(470, 40, 10, 'w') + path('M470 50v26m0 -10h8m-8 10h6', 'a');
    },
    messages: function () {
      return path('M150 40h196a18 18 0 0 1 18 18v52a18 18 0 0 1 -18 18h-120l-34 28v-28h-42a18 18 0 0 1 -18 -18v-52a18 18 0 0 1 18 -18z', 'a') + path('M168 66h150M168 84h108M168 102h128', 'w') +
        path('M392 88h98a16 16 0 0 1 16 16v38a16 16 0 0 1 -16 16h-8v24l-28 -24h-62a16 16 0 0 1 -16 -16v-38a16 16 0 0 1 16 -16z', 'c') + circ(416, 123, 5, 'w') + circ(436, 123, 5, 'w') + circ(456, 123, 5, 'w') +
        rect(430, 22, 72, 50, 'w', 6) + path('M430 28l36 26l36 -26', 'a') + heart(396, 52, .9, 'c') + heart(528, 100, .55, 'b') + circ(122, 150, 8, 'b') + circ(520, 170, 6, 'a');
    },
    market: function () {
      var out = rect(150, 70, 6, 112, 'a', 2) + rect(464, 70, 6, 112, 'a', 2), i;
      for (i = 0; i < 8; i++) out += path('M' + (140 + i * 42) + ' 34h42l8 40a21 21 0 0 1 -42 0z', i % 2 ? 'w' : 'c');
      return out + rect(140, 26, 336, 12, 'a', 4) + rect(140, 138, 336, 44, 'a', 6) + rect(150, 148, 316, 6, 'b', 3) +
        rect(170, 112, 72, 30, 'b', 5) + circ(188, 106, 11, 'c') + circ(210, 104, 11, 'c') + circ(230, 108, 11, 'c') +
        rect(270, 100, 56, 40, 'a', 5) + path('M282 100q8 -26 16 0q8 -26 16 0', 'b') + circ(298, 120, 8, 'w') +
        rect(360, 108, 90, 32, 'b', 5) + circ(380, 100, 11, 'w') + circ(404, 98, 11, 'c') + circ(428, 102, 11, 'w') +
        path('M500 60l0 40', 'a') + path('M486 98h38l-8 28h-22z', 'c') + circ(500, 62, 4, 'w') + rect(72, 140, 50, 42, 'b', 5) + circ(88, 134, 10, 'c') + circ(108, 132, 10, 'c');
    },
    borrowed: function () {
      return rect(150, 56, 112, 118, 'a', 8) + rect(150, 56, 20, 118, 'b', 6) + path('M190 90h54M190 108h40', 'w') + path('M236 56v44l10 -9l10 9v-44z', 'c') + calendar(318, 46, 118, 112) +
        path('M486 70a40 40 0 1 1 -8 62', 'a') + path('M494 56l-8 20l22 2z', 'c') + path('M476 140l-6 -22l24 6z', 'a') + star(112, 70, 8, 'b') + circ(522, 160, 6, 'c');
    },
    care: function () {
      return figure(150, 190, 1.35, 'b') + figure(236, 186, 1.5, 'a') + figure(322, 182, 1.7, 'c') + figure(408, 186, 1.5, 'a') + figure(494, 190, 1.35, 'b') +
        heart(322, 40, 1.6, 'c') + heart(236, 64, .7, 'b') + heart(408, 60, .7, 'b') + heart(180, 100, .45, 'a') + heart(466, 98, .45, 'a') + star(130, 52, 8, 'b') + star(512, 48, 8, 'b');
    },
    midweek: function () {
      return path('M352 182v-110a56 56 0 0 1 112 0v110z', 'w') + path('M358 182v-108a50 50 0 0 1 100 0v108z', 'b') +
        path('M416 44a22 22 0 1 0 12 40a17 17 0 1 1 -12 -40z', 'c') + star(380, 60, 7, 'c') + star(440, 100, 5, 'c') + star(396, 112, 4, 'c') + path('M355 140h106', 'a') + path('M408 74v108', 'a') +
        figure(150, 152, 1.5, 'a') + figure(235, 146, 1.65, 'b') + figure(320, 152, 1.5, 'a') +
        rect(100, 150, 250, 10, 'c', 5) + rect(122, 160, 8, 22, 'a', 2) + rect(320, 160, 8, 22, 'a', 2) +
        path('M186 148l24 -10l24 10l24 -10l24 10v6l-24 -10l-24 10l-24 -10l-24 10z', 'w') + mug(116, 150, 'w') + mug(300, 150, 'w') +
        path('M480 150h50', 'a') + circ(505, 130, 18, 'c') + rect(498, 148, 14, 28, 'a', 3);
    },
    board: function () {
      return rect(150, 30, 330, 150, 'a', 10) + rect(160, 40, 310, 130, 'w', 6) +
        rect(180, 58, 80, 58, 'c', 3) + path('M192 76h54M192 90h40', 'w') + rect(284, 52, 70, 52, 'b', 3) + path('M296 70h46M296 82h30', 'w') +
        rect(378, 64, 76, 62, 'a', 3) + path('M390 82h50M390 96h36', 'w') + rect(204, 124, 78, 38, 'b', 3) + rect(318, 118, 90, 42, 'c', 3) +
        circ(220, 56, 5, 'a') + circ(319, 50, 5, 'c') + circ(416, 62, 5, 'a') + circ(246, 122, 5, 'c') + circ(364, 116, 5, 'a');
    },
    people: function () {
      return figure(190, 170, 1.4, 'b') + figure(280, 170, 1.7, 'a') + figure(380, 170, 1.4, 'c') + figure(470, 170, 1.2, 'b') + heart(280, 40, .9, 'c') + circ(140, 70, 7, 'b') + star(520, 60, 8, 'b');
    },
    rosters: function () {
      return calendar(180, 42, 150, 130) + rect(368, 54, 120, 22, 'a', 6) + rect(368, 90, 96, 22, 'b', 6) + rect(368, 126, 130, 22, 'c', 6) + circ(350, 66, 6, 'c') + circ(350, 102, 6, 'a') + circ(350, 138, 6, 'b') + star(130, 70, 8, 'b');
    },
    leave: function () {
      return circ(440, 70, 34, 'c') + path('M440 20v-14M440 134v14M390 70h-14M504 70h14', 'c') + hills() + rect(200, 108, 100, 66, 'a', 10) + path('M236 108v-14a14 14 0 0 1 14 -14h0a14 14 0 0 1 14 14v14', 'a') + rect(214, 120, 72, 8, 'w', 3) + star(150, 60, 8, 'b');
    },
    events: function () {
      var out = path('M130 40Q330 90 530 40', 'a'), i;
      for (i = 0; i < 7; i++) { var x = 160 + i * 52; out += path('M' + x + ' ' + (Math.round(48 + 20 * Math.sin(i / 6 * Math.PI))) + 'l14 0l-7 22z', i % 2 ? 'c' : 'b'); }
      return out + calendar(250, 80, 130, 100) + star(430, 110, 12, 'c') + star(480, 150, 8, 'b') + circ(170, 150, 9, 'a');
    },
    settings: function () {
      return rect(170, 66, 300, 8, 'b', 4) + rect(170, 106, 300, 8, 'b', 4) + rect(170, 146, 300, 8, 'b', 4) + circ(250, 70, 14, 'c') + circ(380, 110, 14, 'a') + circ(300, 150, 14, 'c') + circ(450, 56, 6, 'b') + star(150, 40, 8, 'b');
    },
    privacy: function () {
      return path('M320 30l80 28v52c0 36 -30 62 -80 80c-50 -18 -80 -44 -80 -80v-52z', 'a') + path('M320 46l64 22v42c0 28 -22 48 -64 64c-42 -16 -64 -36 -64 -64v-42z', 'w') + path('M290 112l22 22l40 -46', 'c') + star(180, 60, 8, 'b') + circ(470, 50, 7, 'c') + circ(160, 150, 6, 'a');
    },
    support: function () {
      return rect(260, 80, 100, 90, 'a', 16) + path('M360 100h22a22 22 0 0 1 0 44h-22', 'a') + rect(242, 170, 136, 10, 'b', 5) + path('M290 66q-8 -14 0 -26M318 66q-8 -14 0 -26M346 66q-8 -14 0 -26', 'c') + heart(430, 60, 1, 'c') + heart(200, 80, .7, 'b') + star(480, 140, 8, 'b');
    },
    home: function () {
      return circ(430, 70, 36, 'c') + hills() + figure(240, 180, 1.2, 'w') + star(150, 50, 8, 'b') + star(520, 140, 7, 'b');
    },
    me: function () {
      return figure(320, 182, 2.1, 'a') + heart(430, 70, 1.2, 'c') + heart(210, 100, .8, 'b') + star(160, 50, 8, 'b') + star(500, 150, 8, 'b');
    },

    import: function () {
      var out = rect(250, 120, 140, 56, 'a', 8) + rect(240, 106, 160, 18, 'b', 6) + path('M300 106v-8h40v8', 'a');
      out += rect(150, 36, 54, 70, 'w', 5) + path('M160 54h34M160 68h34M160 82h20', 'a') + rect(214, 24, 54, 70, 'c', 5) + path('M224 42h34M224 56h34M224 70h20', 'w');
      out += rect(430, 30, 54, 70, 'w', 5) + path('M440 48h34M440 62h34M440 76h20', 'a');
      out += path('M320 38v46M300 66l20 20l20 -20', 'c') + path('M282 70l-26 -16M358 70l26 -16', 'b') + star(520, 150, 8, 'b') + circ(130, 150, 7, 'a');
      return out;
    },
    settings: function () {
      var out = '', i, a;
      for (i = 0; i < 8; i++) { a = i * 45; out += '<g transform="rotate(' + a + ' 330 100)">' + rect(322, 38, 16, 22, 'a', 3) + '</g>'; }
      out += circ(330, 100, 44, 'a') + circ(330, 100, 18, 'w');
      out += rect(150, 60, 110, 8, 'b', 4) + circ(200, 64, 11, 'c') + rect(150, 110, 110, 8, 'b', 4) + circ(236, 114, 11, 'w') + rect(150, 160, 110, 8, 'b', 4) + circ(176, 164, 11, 'c');
      out += rect(430, 40, 80, 8, 'b', 4) + circ(480, 44, 10, 'a') + rect(430, 140, 80, 8, 'b', 4) + circ(448, 144, 10, 'c') + star(500, 100, 9, 'b');
      return out;
    },
    words: function () {
      return path('M150 40h140a16 16 0 0 1 16 16v54a16 16 0 0 1 -16 16h-90l-30 24v-24h-20a16 16 0 0 1 -16 -16v-54a16 16 0 0 1 16 -16z', 'a') + '<text class="t" x="178" y="98" font-size="52" font-weight="700">Aa</text>' +
        path('M360 70h120a16 16 0 0 1 16 16v50a16 16 0 0 1 -16 16h-14v22l-28 -22h-78a16 16 0 0 1 -16 -16v-50a16 16 0 0 1 16 -16z', 'c') + '<text class="t2" x="382" y="132" font-size="50" font-weight="700">文</text>' +
        path('M300 24h90a14 14 0 0 1 14 14v26a14 14 0 0 1 -14 14h-10v18l-22 -18h-58a14 14 0 0 1 -14 -14v-26a14 14 0 0 1 14 -14z', 'w') + '<text class="t" x="322" y="66" font-size="30" font-weight="700">Я</text>' +
        circ(520, 40, 14, 'b') + path('M512 40h16M520 32v16', 'w') + star(130, 150, 8, 'b') + circ(520, 170, 6, 'a');
    },
    generic0: function () {
      var out = '', i;
      for (i = 0; i < 6; i++) out += path('M' + (190 + i * 60) + ' 20L' + (220 + i * 60) + ' 50L' + (190 + i * 60) + ' 80L' + (160 + i * 60) + ' 50z', i % 2 ? 'b' : 'a');
      for (i = 0; i < 5; i++) out += path('M' + (220 + i * 60) + ' 80L' + (250 + i * 60) + ' 110L' + (220 + i * 60) + ' 140L' + (190 + i * 60) + ' 110z', i % 2 ? 'a' : 'b');
      return out + leaf(250, 180, -20, 1.3, 'c') + leaf(310, 180, 18, 1.1, 'a') + leaf(450, 180, -10, 1.4, 'a') + circ(490, 40, 8, 'c');
    },
    generic1: function () {
      return circ(420, 76, 32, 'c') + hills() + path('M200 50q10 -12 20 0q10 -12 20 0M250 34q8 -9 16 0q8 -9 16 0', 'a') + star(520, 40, 8, 'b') + star(150, 90, 7, 'b');
    },
    generic2: function () {
      return circ(240, 100, 54, 'b') + circ(330, 80, 70, 'a') + circ(430, 118, 46, 'b') + circ(500, 56, 26, 'c') + circ(180, 160, 22, 'a') + star(300, 40, 9, 'w') + star(450, 40, 7, 'w') + circ(366, 150, 14, 'w');
    },
    generic3: function () {
      var out = rect(318, 80, 14, 102, 'a', 5) + circ(325, 66, 46, 'b') + circ(285, 90, 34, 'a') + circ(368, 92, 36, 'a') + circ(325, 40, 28, 'a') + circ(300, 70, 7, 'c') + circ(350, 56, 7, 'c') + circ(340, 100, 7, 'c');
      return out + leaf(210, 182, -18, 1.2, 'b') + leaf(250, 182, 14, 1.0, 'a') + leaf(440, 182, -12, 1.2, 'a') + leaf(480, 182, 18, 1.0, 'b') + star(150, 50, 8, 'b');
    },
    about: function () { return SCENE.generic0(); },
    generic: function () { return SCENE.generic0(); }
  };

  /** The scene as a picture (an <svg> ready to put inside the heading). */
  function svg(key) { return '<svg class="hero-art" viewBox="0 0 560 200" preserveAspectRatio="xMaxYMid meet" aria-hidden="true" focusable="false">' + sceneOf(key)() + '</svg>'; }

  /** Is this heading a page's own title (not a person's page, a form or a message with a "back" link)? */
  function eligible(head) { return !!head && !head.querySelector('.crumb') && !head.classList.contains('hero') && !head.closest('.dialog, dialog, .modal, [role=dialog]'); }

  /** Turn the heading of the page shown in `root` into a picture banner (or put it back to plain). */
  function decorate(root, hash, settings) {
    var head = root && root.querySelector('main .page-head, main .me-who');
    if (!head) return false;
    if (plain(settings) || !eligible(head)) return false;
    var key = keyOf(hash);
    head.classList.add('hero', look(settings) === 'line' ? 'line' : 'wash', 'page-head');
    head.style.setProperty('--tint', tintOf(key));
    head.insertAdjacentHTML('afterbegin', '<span class="hero-bg" aria-hidden="true">' + svg(key) + '</span>');
    return true;
  }

  return { decorate: decorate, keyOf: keyOf, plain: plain, look: look, svg: svg, TINT: TINT, tintOf: tintOf, sceneOf: sceneOf, SCENE: SCENE };
})();
if (typeof module !== 'undefined') module.exports = Banners;
