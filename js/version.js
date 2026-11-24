/* Church & Trellis – the version everyone sees under About. Change it with every release (and say what changed in docs/CHANGELOG.md),
 * then run node tools/stamp-files.js: it puts each file's fingerprint after its ?v= in index.html, so browsers and phones fetch
 * only the files that changed (tests/versions.test.js checks it).
 * About → Check for updates reads this file again from the website and compares, so keep the same layout:
 * version: three numbers (major.minor.patch), date: YYYY-MM-DD, time: HH:MM in South African time (UTC+2). The date and time are written by
 * node tools/stamp-files.js (the time it runs) – don't type them by hand. About shows them as SAST for everyone. */
var ChurchHubVersion = {
  version: '0.107.12',
  date: '2026-11-24',
  time: '02:09',
  developer: 'pian1966',
  repo: 'pian1966/church-hub'
};
