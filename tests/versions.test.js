/* Every file in index.html carries the version number from js/version.js (?v=0.4.1), so a new version makes browsers and
 * phones fetch every file again instead of using their old copy. Run: node tests/versions.test.js */
'use strict';
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const vs = fs.readFileSync(path.join(root, 'js/version.js'), 'utf8'), html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const v = (/version:\s*'(\d+\.\d+\.\d+)'/.exec(vs) || [])[1], d = (/date:\s*'(\d{4}-\d\d-\d\d)'/.exec(vs) || [])[1];
let fails = 0;
function ok(c, what) { if (!c) { fails++; console.log('  ✗ ' + what); } else console.log('  ✓ ' + what); }
ok(!!v && !!d, 'js/version.js has a version (' + v + ') and a date (' + d + ')');
const tags = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))(\?v=([^"]*))?"/g)].filter(m => !/^https?:/.test(m[1]));
const wrong = tags.filter(m => m[3] !== v).map(m => m[1] + (m[2] || ' (no ?v=)'));
ok(tags.length > 40, 'found the files index.html loads (' + tags.length + ')');
ok(!wrong.length, 'every file is loaded with ?v=' + v + (wrong.length ? ' – change these: ' + wrong.join(', ') : ''));
// The brochures (brochure.html, opened from About) are read again whenever a feature is added (the middle number goes up).
const bro = fs.readFileSync(path.join(root, 'brochure.html'), 'utf8'), rv = (/name="reviewed-for" content="(\d+\.\d+)"/.exec(bro) || [])[1];
ok(rv === (v || '').split('.').slice(0, 2).join('.'), 'brochure.html was checked for version ' + (v || '').split('.').slice(0, 2).join('.') +
  (rv === (v || '').split('.').slice(0, 2).join('.') ? '' : ' – it says ' + rv + '. Read both brochures, add what this version brings that members or other churches would notice, then change reviewed-for'));
if (fails) { console.log('\n' + fails + ' version test(s) FAILED'); process.exit(1); }
console.log('\nAll version tests passed');
