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
const tm = (/time:\s*'(\d\d:\d\d)'/.exec(vs) || [])[1];
ok(!!v && !!d && !!tm && +tm.slice(0, 2) < 24 && +tm.slice(3) < 60, 'js/version.js has a version (' + v + '), a date (' + d + ') and a time (' + tm + ', South African time)' +
  (tm ? '' : ' – add time: \'HH:MM\' under the date: when this version is released'));
const stamp = require('../tools/stamp-files.js'), RUN = ' – run: node tools/stamp-files.js';
const tags = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))(\?v=([^"]*))?"/g)].filter(m => !/^https?:/.test(m[1]));
const wrong = tags.filter(m => m[3] !== stamp.code(m[1])).map(m => m[1]);
ok(tags.length > 40, 'found the files index.html loads (' + tags.length + ')');
// Every app file in js/, js/people/, js/i18n/ and css/ must be loaded by index.html. A merge that takes only one side of a
// conflict in index.html drops the other side's new files, and that feature quietly disappears from the app.
// (js/lang/ files are loaded one at a time by js/i18n.js, through js/file-versions.js, so they are not listed.)
const loaded = new Set(tags.map(m => m[1]));
const appFiles = ['js', 'js/people', 'js/i18n', 'css'].flatMap(dir => fs.readdirSync(path.join(root, dir))
  .filter(f => /\.(js|css)$/.test(f)).map(f => dir + '/' + f));
const notLoaded = appFiles.filter(f => !loaded.has(f));
ok(!notLoaded.length, 'index.html loads every file in js/, js/people/, js/i18n/ and css/' + (notLoaded.length ? ' – missing: ' +
  notLoaded.join(', ') + '. If a merge dropped them, put their <script>/<link> lines back (keep both sides of a conflict), then run: node tools/stamp-files.js' : ''));
ok(!wrong.length, 'every file is loaded with its fingerprint' + (wrong.length ? ' – out of date: ' + wrong.join(', ') + RUN : ''));
ok(stamp.stampedHtml(html) === html, 'every other fingerprint in index.html (icons) is up to date' + (stamp.stampedHtml(html) === html ? '' : RUN));
ok(/src="js\/file-versions\.js\?v=[^"]+"[^]*src="js\/i18n\.js/.test(html), 'index.html loads js/file-versions.js before js/i18n.js');
const fv = fs.readFileSync(path.join(root, 'js/file-versions.js'), 'utf8');
ok(fv === stamp.fileVersions(), 'js/file-versions.js has every language file\'s fingerprint' + (fv === stamp.fileVersions() ? '' : RUN));
// The brochures (brochure.html, opened from About) are read again whenever a feature is added (the middle number goes up).
const bro = fs.readFileSync(path.join(root, 'brochure.html'), 'utf8'), rv = (/name="reviewed-for" content="(\d+\.\d+)"/.exec(bro) || [])[1];
ok(rv === (v || '').split('.').slice(0, 2).join('.'), 'brochure.html was checked for version ' + (v || '').split('.').slice(0, 2).join('.') +
  (rv === (v || '').split('.').slice(0, 2).join('.') ? '' : ' – it says ' + rv + '. Read both brochures, add what this version brings that members or other churches would notice, then change reviewed-for'));
// The setup tool (site/setup.html, with its list of everything a church can switch on in site/setup-kit.js) is read again the same way.
const su = fs.readFileSync(path.join(root, 'site/setup.html'), 'utf8'), sv = (/name="reviewed-for" content="(\d+\.\d+)"/.exec(su) || [])[1];
ok(sv === (v || '').split('.').slice(0, 2).join('.'), 'the setup tool was checked for version ' + (v || '').split('.').slice(0, 2).join('.') +
  (sv === (v || '').split('.').slice(0, 2).join('.') ? '' : ' – it says ' + sv + '. Add what this version brings to site/setup-kit.js (a Grow item with its `since`, a changed step, or a Coming item moved up), then change reviewed-for in site/setup.html'));
// What's new on Home (js/tips.js) is kept up to date the same way: each new feature adds its news, then NEWS_FOR follows.
const mm = (v || '').split('.').slice(0, 2).join('.'), nf = (/var NEWS_FOR = '(\d+\.\d+)'/.exec(fs.readFileSync(path.join(root, 'js/tips.js'), 'utf8')) || [])[1];
ok(nf === mm, 'What’s new (js/tips.js) was brought up to date for version ' + mm +
  (nf === mm ? '' : ' – it says ' + nf + '. Add a line to NEWS for what this version brings (for the people it concerns, translated like the others), then change NEWS_FOR'));
if (fails) { console.log('\n' + fails + ' version test(s) FAILED'); process.exit(1); }
console.log('\nAll version tests passed');
