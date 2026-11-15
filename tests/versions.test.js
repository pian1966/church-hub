/* Every file in index.html carries its fingerprint (?v=3f9a0c1b2e, made from its contents by tools/stamp-files.js), so a
 * release makes browsers and phones fetch again only the files that changed – less data for people paying for every megabyte.
 * Run: node tests/versions.test.js */
'use strict';
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const vs = fs.readFileSync(path.join(root, 'js/version.js'), 'utf8'), html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const v = (/version:\s*'(\d+\.\d+\.\d+)'/.exec(vs) || [])[1], d = (/date:\s*'(\d{4}-\d\d-\d\d)'/.exec(vs) || [])[1];
let fails = 0;
function ok(c, what) { if (!c) { fails++; console.log('  ✗ ' + what); } else console.log('  ✓ ' + what); }
ok(!!v && !!d, 'js/version.js has a version (' + v + ') and a date (' + d + ')');
const stamp = require('../tools/stamp-files.js'), RUN = ' – run: node tools/stamp-files.js';
const tags = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))(\?v=([^"]*))?"/g)].filter(m => !/^https?:/.test(m[1]));
const wrong = tags.filter(m => m[3] !== stamp.code(m[1])).map(m => m[1]);
ok(tags.length > 40, 'found the files index.html loads (' + tags.length + ')');
ok(!wrong.length, 'every file is loaded with its fingerprint' + (wrong.length ? ' – out of date: ' + wrong.join(', ') + RUN : ''));
ok(stamp.stampedHtml(html) === html, 'every other fingerprint in index.html (icons) is up to date' + (stamp.stampedHtml(html) === html ? '' : RUN));
ok(/src="js\/file-versions\.js\?v=[^"]+"[^]*src="js\/i18n\.js/.test(html), 'index.html loads js/file-versions.js before js/i18n.js');
const fv = fs.readFileSync(path.join(root, 'js/file-versions.js'), 'utf8');
ok(fv === stamp.fileVersions(), 'js/file-versions.js has every language file\'s fingerprint' + (fv === stamp.fileVersions() ? '' : RUN));
// The brochures (brochure.html, opened from About) are read again whenever a feature is added (the middle number goes up).
const bro = fs.readFileSync(path.join(root, 'brochure.html'), 'utf8'), rv = (/name="reviewed-for" content="(\d+\.\d+)"/.exec(bro) || [])[1];
ok(rv === (v || '').split('.').slice(0, 2).join('.'), 'brochure.html was checked for version ' + (v || '').split('.').slice(0, 2).join('.') +
  (rv === (v || '').split('.').slice(0, 2).join('.') ? '' : ' – it says ' + rv + '. Read both brochures, add what this version brings that members or other churches would notice, then change reviewed-for'));
// What's new on Home (js/tips.js) is kept up to date the same way: each new feature adds its news, then NEWS_FOR follows.
const mm = (v || '').split('.').slice(0, 2).join('.'), nf = (/var NEWS_FOR = '(\d+\.\d+)'/.exec(fs.readFileSync(path.join(root, 'js/tips.js'), 'utf8')) || [])[1];
ok(nf === mm, 'What’s new (js/tips.js) was brought up to date for version ' + mm +
  (nf === mm ? '' : ' – it says ' + nf + '. Add a line to NEWS for what this version brings (for the people it concerns, translated like the others), then change NEWS_FOR'));
if (fails) { console.log('\n' + fails + ' version test(s) FAILED'); process.exit(1); }
console.log('\nAll version tests passed');
