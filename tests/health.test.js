// Run: node tests/health.test.js – the Church health checks (js/health.js): counts only, never names.
const Health = require('../js/health.js');
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) fails++; };
const today = '2026-11-25';
const P = (id, extra) => Object.assign({ id, firstName: id, familyRole: 'adult', category: 'Church Partner', email: id + '@example.com', mobile: '0821234567' }, extra);

console.log('Rostered but gone');
{
  const people = [P('a'), P('left', { active: false }), P('dead', { deceasedAt: '2026-01-01' }), P('merged', { mergedInto: 'a' })];
  const services = [{ id: 's1', date: '2026-11-29' }, { id: 's2', date: '2026-12-13' }, { id: 's3', date: '2026-12-20' }, { id: 's4', date: '2026-12-06', cancelled: true }, { id: 's0', date: '2026-11-22' }];
  const as = (service, person, status) => ({ serviceId: service, personId: person, status: status || 'accepted' });
  const assignments = [as('s1', 'a'), as('s1', 'left'), as('s2', 'dead', 'pending'), as('s3', 'left'), as('s4', 'left'), as('s0', 'left'), as('s1', 'left', 'declined'), as('s1', 'nobody'), as('s2', 'merged')];
  const g = Health.rosterGone({ today, people, services, assignments });
  ok(g.length === 4, 'turns in the next 3 weeks held by someone who left, died, was merged or is not on the records: 4 (not a cancelled service, a past one, a later one or one already declined)');
  ok(Health.rosterGone({ today, people, services, assignments: [as('s1', 'a')] }).length === 0, 'someone still at the church is fine');
}

console.log('Marriage records that disagree');
{
  const people = [
    P('w', { maritalStatus: 'Widowed', spouseId: 'h' }), P('h', { maritalStatus: 'Married', spouseId: 'w' }),                       // widowed, yet a living spouse is linked (only the widow is flagged)
    P('s', { maritalStatus: 'Single', keyDates: [{ label: 'Wedding anniversary', date: '2010-05-01' }] }),                           // anniversary but single
    P('one', { maritalStatus: 'Married', spouseId: 'two' }), P('two', { maritalStatus: 'Married' }),                                  // link one way only
    P('x', { maritalStatus: 'Married', spouseId: 'y' }), P('y', { maritalStatus: 'Married', spouseId: 'x' }),                        // fine
    P('late', { maritalStatus: 'Widowed', spouseId: 'gone' }), P('gone', { deceasedAt: '2025-01-01', active: false }),               // a late spouse is exactly right
    P('kid', { familyRole: 'child', maritalStatus: 'Single', keyDates: [{ label: 'Wedding anniversary', date: '2010-05-01' }] })
  ];
  const ids = Health.marriage({ people }).map(p => p.id).sort().join();
  ok(ids === 'one,s,w', 'flags: widowed with a living spouse linked, a wedding date on a single person, and a link that goes one way; not a matching pair, a late spouse or a child');
}

console.log('People who cannot be reached');
{
  const people = [P('ok'), P('noMail', { email: '' }), P('none', { email: 'unknown', mobile: '' }), P('child', { familyRole: 'child', email: '', mobile: '' }), P('gone', { active: false, email: '', mobile: '' }), P('visitor', { category: 'Attender', email: '', mobile: ' ' })];
  ok(Health.unreachable({ people }).map(p => p.id).join() === 'none,visitor', 'an adult with neither email nor mobile ("unknown" counts as none); not children, people who left, or anyone with one way to be reached');
}

console.log('Groups with no leader');
ok(Health.noLeader({ careGroups: [{ id: 'g1', leaderIds: ['a'] }, { id: 'g2', leaderIds: [] }, { id: 'g3' }, { id: 'g4', type: 'life', leaderIds: [] }] }).length === 3, 'Care Groups and Midweek Groups with nobody leading');

console.log('Retention');
{
  const people = [
    P('old', { active: false, archivedAt: '2023-01-10' }), P('recent', { active: false, archivedAt: '2026-06-01' }), P('dead', { active: false, deceasedAt: '2020-01-01', archivedAt: '2020-02-01' }),
    P('bin', { active: false, archivedAt: '2022-01-01', binnedAt: '2026-01-01' }), P('del', { active: false, firstName: 'Deleted', archivedAt: '2021-01-01' }), P('here', { archivedAt: '2020-01-01' })
  ];
  ok(Health.retention({ today, people, retentionMonths: 24 }).map(p => p.id).join() === 'old', 'left more than 24 months ago and not yet deleted (not recent leavers, the dead, deleted or binned)');
  ok(Health.retention({ today, people, retentionMonths: 12 }).map(p => p.id).join() === 'old', '12 months: the same here');
  ok(Health.retention({ today, people: [P('r', { active: false, archivedAt: '2025-06-01' })], retentionMonths: 12 }).length === 1 && Health.retention({ today, people: [P('r', { active: false, archivedAt: '2025-06-01' })] }).length === 0, 'the church’s retention period decides (24 months if not chosen)');
}

console.log('The whole list');
{
  const r = Health.run({ today, people: [P('a')], services: [], assignments: [], careGroups: [], addressMismatches: 2 });
  ok(r.map(x => x.id).join() === 'rosterGone,addresses,marriage,unreachable,noLeader,retention', 'always the same checks in the same order');
  ok(r.find(x => x.id === 'addresses').count === 2 && r.every(x => ['weekly', 'fortnightly', 'monthly'].includes(x.cadence)), 'each has a count and how often to look');
  const q = Health.run({ today, people: [P('n1', { email: '', mobile: '' }), P('n2', { email: '', mobile: '' })] });
  const u = q.find(x => x.id === 'unreachable');
  ok(u.count === 2 && u.first === 'n1' && !JSON.stringify(u).includes('firstName'), 'it gives a count and the first person to open, not names');
  ok(Health.run().every(x => x.count === 0), 'no data: nothing flagged, no errors');
}

console.log(fails ? '\n' + fails + ' FAILED' : '\nAll health tests passed');
process.exit(fails ? 1 : 0);
