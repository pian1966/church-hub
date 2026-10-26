// Run: node tests/elvanto-sync.test.js – when approved leave needs an Elvanto "Unavailable Volunteers" update.
const S = require('../js/elvanto-sync.js');
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) fails++; };
const o = { name: 'Thandi Mokoena', today: '2026-10-26' };
const req = (x) => Object.assign({ id: 'L1', staffId: 'p02', type: 'PSL', start: '2026-11-02', end: '2026-11-06', status: 'Pending' }, x);

console.log('New leave');
ok(S.job(null, req(), null, o) === null, 'waiting for approval: nothing in Elvanto');
let j = S.job(req(), req({ status: 'Approved' }), null, o);
ok(j && j.want === 'Unavailable' && j.status === 'Waiting' && j.have === '' && j.name === 'Thandi Mokoena' && j.personId === 'p02', 'approved: the robot adds it');
ok(S.job(null, req({ status: 'Approved', start: '2026-10-01', end: '2026-10-03' }), null, o) === null, 'approved leave that is already over: nothing to do');

console.log('Changes after it is in Elvanto');
const inElv = Object.assign({}, j, { status: 'Done', have: '2026-11-02 to 2026-11-06', haveNote: 'Church Hub L1' });
ok(S.job(req({ status: 'Approved' }), req({ status: 'Approved', reason: 'x' }), inElv, o) === null, 'a change that doesn’t touch the dates: nothing to do');
j = S.job(req({ status: 'Approved' }), req({ status: 'Approved', end: '2026-11-09' }), inElv, o);
ok(j && j.want === 'Unavailable' && j.end === '2026-11-09' && j.have === '2026-11-02 to 2026-11-06' && /Dates changed/.test(j.note), 'dates changed: the robot replaces the old entry');
j = S.job(req({ status: 'Approved' }), req({ status: 'Cancelled' }), inElv, o);
ok(j && j.want === 'Removed' && j.have && j.haveNote === 'Church Hub L1', 'cancelled: the robot removes it');
ok(S.job(req({ status: 'Pending' }), req({ status: 'Declined' }), null, o) === null, 'declined before approval: nothing to do');
const removedDone = Object.assign({}, inElv, { want: 'Removed', have: '', status: 'Done' });
ok(S.job(req({ status: 'Cancelled' }), req({ status: 'Cancelled', note: 'x' }), removedDone, o) === null, 'already removed: nothing to do');

console.log('Leave brought in from Leave Manager');
const lm = req({ id: 'L260110-AAAA', status: 'Approved', source: 'Leave Manager' });
ok(S.job(lm, Object.assign({}, lm, { reason: 'changed' }), null, o) === null, 'approved there and unchanged: Leave Manager’s robot already put it in Elvanto');
j = S.job(lm, Object.assign({}, lm, { status: 'Cancelled' }), null, o);
ok(j && j.want === 'Removed' && j.have === '2026-11-02 to 2026-11-06' && j.haveNote === 'Leave Manager L260110-AAAA', 'cancelled in Church Hub: the robot removes Leave Manager’s entry (found by its note)');
j = S.job(lm, Object.assign({}, lm, { end: '2026-11-10' }), null, o);
ok(j && j.want === 'Unavailable' && j.have && j.haveNote.indexOf('Leave Manager') === 0, 'dates changed: Leave Manager’s entry is replaced');

console.log('Problems for the Administrator');
const now = Date.parse('2026-10-26T12:00:00Z');
const list = [{ status: 'Failed' }, { status: 'Check' }, { status: 'Done' }, { status: 'Waiting', updatedAt: '2026-10-26 11:30' }, { status: 'Waiting', updatedAt: '2026-10-26 09:00' }];
ok(S.problems(list, now).length === 3, 'failed, “check by hand” and waiting over 2 hours (times are UTC) – not a fresh waiting entry');

console.log(fails ? '\n' + fails + ' FAILED' : '\nAll Elvanto sync tests passed');
process.exit(fails ? 1 : 0);
