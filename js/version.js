/* Church Hub – the version everyone sees under About. Change it with every release (and say what changed in docs/CHANGELOG.md),
 * then run node tools/stamp-files.js: it puts each file's fingerprint after its ?v= in index.html, so browsers and phones fetch
 * only the files that changed (tests/versions.test.js checks it).
 * About → Check for updates reads this file again from the website and compares, so keep the same layout:
 * version: three numbers (major.minor.patch), date: YYYY-MM-DD. */
var ChurchHubVersion = {
  version: '0.83.0',
  date: '2026-11-16',
  developer: 'pian1966',
  repo: 'pian1966/church-hub'
};
