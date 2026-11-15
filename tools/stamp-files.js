/* Church Hub – gives every file a fingerprint, so phones download only the files that changed.
 *
 * Each file index.html loads carries ?v=<fingerprint>, a short code made from the file's contents. A file that hasn't
 * changed keeps its code, so browsers and phones keep using the copy they already have; a changed file gets a new code
 * and is downloaded again. (Before, every file carried the version number, so every release downloaded everything.)
 * The language files (js/lang/*.js) are loaded later, when someone chooses a language: their codes go in
 * js/file-versions.js, which js/i18n.js reads.
 *
 * Run after changing any file, before committing:   node tools/stamp-files.js
 * node tests/versions.test.js fails if a code is out of date.
 */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.join(__dirname, '..');

/** A file's fingerprint: the first 10 characters of its SHA-256. Text files are read with Windows line endings made plain,
 *  so a checkout on Windows gets the same fingerprints as GitHub. */
function code(rel) {
  let data = fs.readFileSync(path.join(root, rel));
  if (/\.(js|css|html|json|webmanifest|svg)$/.test(rel)) data = Buffer.from(data.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
  return crypto.createHash('sha256').update(data).digest('hex').slice(0, 10);
}

/** js/file-versions.js as it should be (the language files' codes). */
function fileVersions() {
  const langs = fs.readdirSync(path.join(root, 'js/lang')).filter(f => /\.js$/.test(f)).sort();
  const lines = langs.map(f => "  'js/lang/" + f + "': '" + code('js/lang/' + f) + "'");
  return '/* Made by tools/stamp-files.js – don\'t edit by hand. The language files\' fingerprints (see that file): a language\n' +
    ' * file is downloaded again only when its contents change. */\nvar ChurchHubFiles = {\n' + lines.join(',\n') + '\n};\n';
}
/** index.html as it should be: every file of our own with ?v=<its fingerprint>. */
function stampedHtml(html) {
  return html.replace(/((?:src|href)=")([^"?#:]+)\?v=[^"]*"/g, (all, pre, rel) =>
    fs.existsSync(path.join(root, rel)) ? pre + rel + '?v=' + code(rel) + '"' : all);
}

if (require.main === module) {
  // The language list first: js/file-versions.js is itself one of the files index.html stamps
  fs.writeFileSync(path.join(root, 'js/file-versions.js'), fileVersions());
  const file = path.join(root, 'index.html'), html = fs.readFileSync(file, 'utf8'), out = stampedHtml(html);
  fs.writeFileSync(file, out);
  console.log(out === html ? 'Every fingerprint was already up to date.' : 'Fingerprints brought up to date in index.html and js/file-versions.js.');
}
module.exports = { code, fileVersions, stampedHtml };
