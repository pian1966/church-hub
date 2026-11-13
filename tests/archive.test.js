/* Tests for js/archive.js (the Archive: church records). Run: node tests/archive.test.js */
'use strict';
const A = require('../js/archive.js');
let fails = 0;
function ok(c, what) { if (!c) { fails++; console.log('  ✗ ' + what); } else console.log('  ✓ ' + what); }

ok(A.cats(null).map(c => c.id).join() === 'minutes,plans,contracts,appraisals,other' && A.cat(null, 'contracts').access === 'private' && A.cat(null, 'contracts').person && A.cat(null, 'minutes').access === 'body', 'the starting categories: minutes for a leadership group, contracts and appraisals private');
ok(A.cats({ archiveCats: [{ id: 'x1', name: 'Title deeds', access: 'nonsense' }] })[0].access === 'office' && A.cat({ archiveCats: [{ id: 'x1', name: 'Title deeds' }] }, 'minutes') === null, 'the church’s own categories replace them (an unknown “who can see” becomes Administrators and Pastors)');

let r = A.clean({ title: '  October minutes ', cat: 'minutes', date: '2026-10-14T00:00', access: 'body', bodyId: 'g1', aboutId: '', aboutName: 'Nobody', shownTo: true, junk: 1, link: ' https://example.org/a ' });
ok(r.title === 'October minutes' && r.date === '2026-10-14' && r.bodyId === 'g1' && r.aboutName === '' && r.shownTo === '' && r.junk === undefined && r.link === 'https://example.org/a', 'a record is tidied before saving');
ok(A.clean({ access: 'body' }).access === 'office' && A.clean({ access: 'office', bodyId: 'g1' }).bodyId === '' && A.clean({}).access === 'private', 'no group chosen: Administrators and Pastors, never wider; a group only with “leadership group”; nothing chosen: private');
r = A.clean({ title: 'Contract', cat: 'contracts', access: 'private', aboutId: 'p5', aboutName: 'Sam', shownTo: true, file: { name: 'c.pdf', type: 'application/pdf', size: 2048, parts: 1, extra: 1 } });
ok(r.shownTo === 'p5' && r.file.parts === 1 && r.file.extra === undefined && A.clean({ aboutId: 'p5', shownTo: false }).shownTo === '', 'shown to the person it is about only when ticked');

const minutes = { access: 'body', bodyId: 'g1' }, plans = { access: 'office' }, contract = { access: 'private', aboutId: 'p5', shownTo: 'p5' }, notice = { access: 'all' }, appraisal = { access: 'private', aboutId: 'p5', shownTo: '' };
const member = { ids: ['p9'] }, councillor = { council: true, ids: ['p8'], bodies: ['g1'] }, pastor = { pastor: true, ids: ['p3'] }, sam = { council: true, ids: ['p5', 'p6'] };
ok([minutes, plans, contract, notice, appraisal].every(x => A.sees(x, { admin: true })) && !A.sees(appraisal, { senior: true, pastor: true }), 'Administrators see every record; a Senior Pastor without Council membership does not');
ok(!A.sees(notice, member) && !A.sees(minutes, member) && !A.sees(plans, member) && !A.sees(contract, member), 'a member who is not on the Council cannot see Archive records, even those marked for everyone');
ok(A.sees(minutes, councillor) && !A.sees(plans, councillor) && !A.sees(contract, councillor) && !A.sees({ access: 'body', bodyId: 'g2' }, councillor), 'a Council member also sees the Council’s records – not another group’s');
ok(!A.sees(plans, pastor) && !A.sees(minutes, pastor) && !A.sees(contract, pastor) && !A.sees(appraisal, pastor), 'a Pastor who is not on the Council cannot see Archive records');
ok(A.sees(contract, sam) && !A.sees(appraisal, sam), 'a Council member sees a record about them only when it is shown to them');

const b64 = 'A'.repeat(2500), parts = A.split(b64, 1000);
ok(parts.length === 3 && parts[2].length === 500 && A.join(parts) === b64 && A.split('', 10).length === 0 && A.PART <= 950000, 'a file is cut into parts that each fit a database document, and put together again');
ok(A.sizeText(300) === '1 KB' && A.sizeText(317440) === '310 KB' && A.sizeText(2516582) === '2.4 MB', 'file sizes in plain words');
ok(A.link('drive.google.com/x') === 'https://drive.google.com/x' && A.link('http://a.b/c') === 'http://a.b/c' && A.link('javascript:alert(1)') === '' && A.link('https://a.b/"onclick') === '' && A.link('') === '', 'only ordinary web links are kept');
const recs = [{ cat: 'minutes', date: '2026-01-20', title: 'Jan' }, { cat: 'minutes', date: '2026-03-17', title: 'Mar' }, { cat: 'minutes', date: '2025-11-18', title: 'Nov' }, { cat: 'plans', date: '2026-03-01', title: 'Hall' }];
ok(A.years(recs).join() === '2026,2025' && A.list(recs, 'minutes', '2026').map(x => x.title).join() === 'Mar,Jan' && A.list(recs, '', '').length === 4, 'records by category and year, newest first');
ok(A.missingMonths(recs, 'minutes', '2026', '2026-04').join() === '2,4' && A.missingMonths(recs, 'minutes', '2026').length === 10, 'months with no minutes yet');
ok(A.missingMonths(recs, 'minutes', '2025').join() === '12' && A.missingMonths(recs, 'plans', '2025').length === 0 && A.missingMonths([], 'minutes', '2026').length === 0, '… counted only after the first minutes ever filed');

if (fails) { console.log('\n' + fails + ' archive test(s) FAILED'); process.exit(1); }
console.log('\nAll archive tests passed');
