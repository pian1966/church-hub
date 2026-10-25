// Run: node tests/leave-import.test.js – reading a (made-up) Leave Manager sheet and planning the import.
const fs = require('fs'), path = require('path');
const C = require('../js/leave-core.js'); global.LeaveCore = C;
const LI = require('../js/leave-import.js');
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) fails++; };
const dir = path.join(__dirname, 'fixtures', 'leave-manager');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.csv')).map(f => LI.parseCSV(fs.readFileSync(path.join(dir, f), 'utf8')));
const t = LI.collect(files);

console.log('Recognising the tabs');
ok(['staff', 'requests', 'adjustments', 'levels', 'types', 'terms', 'holidays', 'settings', 'history'].every(k => t[k]), 'every tab recognised from its headings');
ok(t.staff.every(r => !('PIN' in r)), 'PINs are dropped as soon as the Staff tab is read');

console.log('Planning against Church Hub people');
const people = [
  { id: 'p02', firstName: 'Thandi', lastName: 'Mokoena', email: 'thandi.mokoena@example.com', familyRole: 'adult' },
  { id: 'p05', firstName: 'Sipho', lastName: 'Dlamini', email: 'Sipho.Dlamini@example.com', familyRole: 'adult' },
  { id: 'p06', firstName: 'Lerato', lastName: 'Khumalo', email: 'lerato.khumalo@example.com', familyRole: 'adult' },
  { id: 'p01', firstName: 'Linda', lastName: 'Pillay', email: 'linda.pillay@example.com', familyRole: 'adult' }
];
const pl = LI.plan(t, people);
const m = id => pl.matches.find(x => x.lm.id === id);
ok(m('S1').personId === 'p02' && m('S1').by === 'email', 'matched by email (any capitals)');
ok(m('S3').personId === 'p06' && m('S3').by === 'name', 'matched by name when the email differs');
ok(m('S4').personId === null, 'someone not in Church Hub is reported, not guessed');
ok(pl.requests.length === 6 && pl.adjustments.length === 2, '6 requests and 2 adjustments read');
ok(pl.data.types.find(x => x.code === 'WO').perTerm === 1 && pl.data.types.find(x => x.code === 'PSL').useBy === '1 Feb', 'leave types read like Leave Manager does');
ok(pl.data.levels.find(l => l.level === 'Support Staff').ent.SSL === 21 && !('PSL' in pl.data.levels.find(l => l.level === 'Support Staff').ent), 'allowances: blank means not offered');
ok(!('StandInID' in pl.data.settings) && pl.data.settings.LeaveYearStartMonth === '1', 'settings read (stand-in left behind)');
ok(pl.data.staff.find(s => s.id === 'S3').workDays === 'Mon, Wed, Thu', 'own working days kept');

console.log('Applying to Church Hub leave');
const lv = { settings: {}, types: [], levels: [], holidays: [], terms: [], rules: [], requests: [{ id: 'LXYZ', staffId: 'p02', type: 'PSL', start: '2026-11-02', end: '2026-11-02', status: 'Pending' }], adjustments: [] };
const idMap = Object.assign({}, pl.map);
const n = LI.applyLeave(lv, pl, idMap, true);
ok(n.added === 5 && n.skipped === 1, '5 requests added; Nomsa’s skipped until she is added');
ok(lv.requests.some(r => r.id === 'LXYZ') && lv.requests.find(r => r.id === 'L260110-AAAA').staffId === 'p02', 'leave already in Church Hub is kept; staff IDs become Church Hub people');
ok(lv.adjustments.length === 2 && lv.adjustments[0].staffId === 'p02', 'adjustments (carry-over) imported');
ok(lv.terms.length === 4 && lv.types.length === 7, 'settings, terms and leave types replaced by the sheet’s');
idMap.S4 = 'pNEW';
const again = LI.applyLeave(lv, pl, idMap, true);
ok(again.added === 1 && again.updated === 5 && lv.requests.length === 7 && lv.adjustments.length === 2, 'running it again updates instead of duplicating');

console.log('Same balances as Leave Manager');
{
  // What Leave Manager itself works out from the sheet…
  const sheet = LI.sheetData(t); sheet.staff = sheet.staff.map(x => Object.assign({ role: 'Staff' }, x)); sheet.rules = sheet.rules || [];
  // …and what Church Hub works out after importing it (with Nomsa added as a new person)
  const lv2 = { settings: {}, types: [], levels: [], holidays: [], terms: [], rules: [], requests: [], adjustments: [] };
  const map2 = Object.assign({}, pl.map, { S4: 'pNEW' });
  LI.applyLeave(lv2, pl, map2, true);
  const hub = Object.assign({}, lv2, { staff: sheet.staff.map(x => Object.assign({}, x, { id: map2[x.id] })) });
  let same = 0, diff = [];
  sheet.staff.forEach(st => [2025, 2026, 2027].forEach(y => {
    const a = JSON.stringify(C.balances(sheet, st.id, y)), b2 = JSON.stringify(C.balances(hub, map2[st.id], y));
    if (a === b2) same++; else diff.push(st.name + ' ' + y);
  }));
  ok(diff.length === 0, 'every balance (5 staff × 3 leave years, every kind of leave) identical to Leave Manager’s' + (diff.length ? ': differs for ' + diff.join(', ') : ''));
  const th = C.balances(hub, 'p02', 2026).PSL;
  ok(th.entitled === 27 && th.lastYear && th.lastYear.until === '2026-02-01', 'e.g. Thandi: 24 + 3 carried over = 27 for 2026; January leave came out of 2025’s unused days (use by 1 Feb)');
}

console.log('Dates in an Excel download');
ok(LI.isoDate(46032) === '2026-01-10' && LI.isoDate('10/01/2026') === '2026-01-10' && LI.isoDate('2026-01-10') === '2026-01-10', 'Excel day numbers, dd/mm/yyyy and yyyy-mm-dd all understood');

console.log(fails ? '\n' + fails + ' FAILED' : '\nAll leave import tests passed');
process.exit(fails ? 1 : 0);
