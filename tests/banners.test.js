/* Tests for js/banners.js (soft watercolour pictures behind every page's heading). Run: node tests/banners.test.js */
'use strict';
const B = require('../js/banners.js');
let fails = 0;
function ok(c, m) { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; }

console.log('Banners');
ok(B.keyOf('#/library/archives') === 'archives' && B.keyOf('#/library/borrowed') === 'borrowed' && B.keyOf('#/library') === 'library', 'Library, Archives and borrowed items each have their own picture');
ok(B.keyOf('#/life') === 'midweek' && B.keyOf('#/care') === 'care', 'Midweek Groups and Care Groups have their own pictures');
ok(B.keyOf('#/') === 'home' && B.keyOf('') === 'home', 'an empty address is Home');
const own = ['home', 'me', 'import', 'settings', 'words', 'library', 'archives', 'messages', 'market', 'board', 'care', 'midweek', 'people', 'rosters', 'leave', 'events', 'privacy', 'support', 'about'];
ok(own.every(k => B.SCENE[k] && B.TINT[k]), 'every main page has its own scene and colour');
ok(new Set(['me', 'import', 'settings', 'words'].map(k => B.TINT[k] + '|' + B.svg(k))).size === 4, 'Me, Import, Settings and Languages (words) all look different');
ok(own.every(k => /^<svg[^>]*>.+<\/svg>$/.test(B.svg(k))), 'every scene is a complete picture');
const future = ['reports', 'prayer-wall', 'youth', 'camps', 'finance', 'sermons'];
ok(future.every(k => /^<svg/.test(B.svg(k)) && B.tintOf(k)), 'a page added later still gets a picture and a colour');
ok(B.tintOf('reports') === B.tintOf('reports') && B.svg('youth') === B.svg('youth'), 'a new page keeps the same look every time');
ok(new Set(future.map(B.tintOf)).size >= 4, 'new pages are given different colours');
ok(B.plain({ look: 'plain' }) && !B.plain({}) && !B.plain({ look: 'watercolour' }) && !B.plain(null), 'only “plain” turns the pictures off');
console.log(fails ? '\n' + fails + ' banner test(s) FAILED' : '\nAll banner tests passed');
process.exit(fails ? 1 : 0);
