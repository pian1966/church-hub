/* Tests for js/brochure-kit.js (the brochure editor's rules). Run: node tests/brochure-kit.test.js */
'use strict';
const B = require('../js/brochure-kit.js');
let fails = 0;
function ok(c, what) { if (!c) { fails++; console.log('  ✗ ' + what); } else console.log('  ✓ ' + what); }

console.log('Colours from one colour');
let c = B.colours('#E8590C');
ok(c.accent === '#E8590C' && B.contrast(c.ink, '#FFFFFF') >= 4.5, 'the orange: headings and buttons dark enough for white writing (' + c.ink + ')');
ok(/^#F/.test(c.soft) && /^#F/.test(c.paper), 'boxes and paper are light tints');
c = B.colours('#FDC830');
ok(B.contrast(c.ink, '#FFFFFF') >= 4.5 && c.onAccent === '#22201E', 'a light yellow: darker ink, and dark writing on the cover');
ok(B.colours('nonsense').accent === '#E8590C', 'something that isn’t a colour: Church Hub’s orange');

console.log('Fonts');
ok(B.font('Lora') === 'Lora' && B.font('Comic Sans') === 'Nunito', 'only the fonts on the list (otherwise Nunito)');
ok(B.fontHref('Playfair Display').includes('family=Playfair+Display'), 'a font name with a space becomes a Google Fonts address');

console.log('Making typed text safe');
ok(B.clean('Call <b>Sam</b> on 082 000 0000') === 'Call <b>Sam</b> on 082 000 0000', 'bold is kept');
ok(B.clean('Hi <script>alert(1)</script><img src=x onerror=alert(1)>there') === 'Hi alert(1)there', 'scripts and pictures are removed, leaving only text');
ok(B.clean('<a href="javascript:x" onclick="y">link</a>') === 'link', 'links and events are removed');
ok(B.clean('Open <span class="url" data-fill="link" style="color:red">x.org</span> now') === 'Open <span class="url" data-fill="link">x.org</span> now', 'the church’s address (a fill-in) is kept, its style dropped');
ok(B.clean('one<div>two</div><div>three</div>') === 'one<br>two<br>three', 'new lines typed as blocks become line breaks');
ok(B.clean('a &nbsp;b <span>c</span>') === 'a  b c', 'plain spans and spaces are tidied');
ok(B.clean('<b>unclosed').indexOf('<b>') === 0, 'odd markup doesn’t break it');

console.log('Saved settings');
const t = B.tidy({ design: { accent: '#123456', font: 'Lora' }, members: { texts: { 'm:0:3': { o: 'Three  easy steps', h: 'Four <i>easy</i> steps<script>' } }, hidden: { 'm:1:b2': 'Messages' } }, evil: 1 });
ok(t.design.accent === '#123456' && t.design.font === 'Lora' && !t.evil, 'design kept; anything else dropped');
ok(t.members.texts['m:0:3'].o === 'Three easy steps' && t.members.texts['m:0:3'].h === 'Four <i>easy</i> steps', 'a text: original tidied, wording made safe');
ok(t.members.hidden['m:1:b2'] === 'Messages' && JSON.stringify(t.churches) === '{"texts":{},"hidden":{}}', 'hidden blocks kept; the other brochure empty');
ok(B.changed(t) && B.changed(t, 'members') && !B.changed(t, 'churches') && !B.changed({}), 'whether anything is changed, for each brochure');

if (fails) { console.log('\n' + fails + ' failed'); process.exit(1); } else console.log('\nAll brochure editor tests passed');
