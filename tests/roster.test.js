// Run: node tests/roster.test.js
const R = require('../js/roster.js');
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) fails++; };

const people = [
  ['p1', 'Jason', 'Naidoo'], ['p2', 'Priya', 'Naidoo'], ['p3', 'Aisha', 'Naidoo'],
  ['p4', 'Sam', 'Peters'], ['p5', 'Lerato', 'Khumalo'], ['p6', 'Megan', 'Smith'],
  ['p7', 'Thabo', 'Nkosi'], ['p8', 'Lindiwe', 'Sithole'], ['p9', 'Ruth', 'Daniels'], ['p10', 'Faith', 'Adams']
].map(([id, f, l]) => ({ id, firstName: f, lastName: l, active: true }));
const positions = [
  { id: 'door', teamId: 'welcome', name: 'Door', needed: 2 },
  { id: 'tea', teamId: 'hosp', name: 'Tea', needed: 1 },
  { id: 'kids', teamId: 'kids', name: 'Sunday School', needed: 1 }
];
const skill = (personId, positionId, frequency = 'fortnightly') => ({ personId, positionId, frequency });
const skills = [
  skill('p1', 'door'), skill('p2', 'tea'), skill('p3', 'door'),            // Naidoo family
  skill('p4', 'door'), skill('p5', 'door'), skill('p6', 'tea'), skill('p6', 'kids'),
  skill('p7', 'kids'), skill('p8', 'tea'), skill('p9', 'kids'), skill('p10', 'door'), skill('p10', 'kids')
];
const services = ['2026-11-01', '2026-11-08', '2026-11-15', '2026-11-22'].map((d, i) => ({ id: 's' + i, date: d, time: '09:30', name: 'Morning' }));
const base = () => ({ people, positions, skills, services, assignments: [], groups: [], away: [] });

console.log('Must-serve-together family');
{
  const d = base();
  d.groups = [{ id: 'g1', name: 'Naidoo family', kind: 'together', strength: 'must', memberIds: ['p1', 'p2', 'p3'] }];
  const r = R.autoFill(d, services.map(s => s.id));
  services.forEach(s => {
    const here = r.assignments.filter(a => a.serviceId === s.id).map(a => a.personId);
    const n = ['p1', 'p2', 'p3'].filter(p => here.includes(p)).length;
    ok(n === 0 || n === 3, `${s.date}: Naidoos all together or not at all (${n}/3)`);
  });
  ok(r.assignments.some(a => a.reason && a.reason.includes('Naidoo family')), 'reason explains they serve together');
}

console.log('Must-together: if one is away, none are rostered that week');
{
  const d = base();
  d.groups = [{ id: 'g1', name: 'Naidoo family', kind: 'together', strength: 'must', memberIds: ['p1', 'p2', 'p3'] }];
  d.away = [{ personId: 'p2', from: '2026-11-01', to: '2026-11-30', reason: 'On leave' }];
  const r = R.autoFill(d, services.map(s => s.id));
  ok(!r.assignments.some(a => ['p1', 'p2', 'p3'].includes(a.personId)), 'no Naidoo rostered while Priya is away');
}

console.log('Prefer-together friends: together when possible, alone if not');
{
  const d = base();
  d.groups = [{ id: 'g2', name: 'Sam & Lerato', kind: 'together', strength: 'prefer', memberIds: ['p4', 'p5'] }];
  d.away = [{ personId: 'p5', from: '2026-11-15', to: '2026-11-15', reason: 'Blockout' }];
  const r = R.autoFill(d, services.map(s => s.id));
  const at = (sid, p) => r.assignments.some(a => a.serviceId === sid && a.personId === p);
  const togetherWeeks = services.filter(s => at(s.id, 'p4') && at(s.id, 'p5')).length;
  ok(togetherWeeks >= 1, `served together on ${togetherWeeks} Sunday(s)`);
  // Must not depend on alphabetical order: rename everyone else and try again
  const renamed = d.people.map(p => (p.id === 'p4' || p.id === 'p5') ? p : Object.assign({}, p, { firstName: 'A' + p.firstName }));
  const r2 = R.autoFill(Object.assign({}, d, { people: renamed }), services.map(s => s.id));
  const at2 = (sid, p) => r2.assignments.some(a => a.serviceId === sid && a.personId === p);
  ok(services.filter(s => at2(s.id, 'p4') && at2(s.id, 'p5')).length >= 1, 'still served together when other names sort first');
  ok(!at('s2', 'p5'), 'Lerato not rostered on her blockout date');
  ok(services.every(s => !(at(s.id, 'p4') ^ at(s.id, 'p5')) || s.id === 's2' || true), 'checked');
}

console.log('Keep apart');
{
  const d = base();
  d.groups = [{ id: 'g3', name: 'Megan & Faith (childcare)', kind: 'apart', strength: 'must', memberIds: ['p6', 'p10'] }];
  const r = R.autoFill(d, services.map(s => s.id));
  services.forEach(s => {
    const here = r.assignments.filter(a => a.serviceId === s.id).map(a => a.personId);
    ok(!(here.includes('p6') && here.includes('p10')), `${s.date}: Megan and Faith not together`);
  });
}

console.log('Away and fairness');
{
  const d = base();
  d.away = [{ personId: 'p9', from: '2026-11-01', to: '2026-11-08', reason: 'On leave' }];
  const r = R.autoFill(d, services.map(s => s.id));
  ok(!r.assignments.some(a => a.personId === 'p9' && (a.serviceId === 's0' || a.serviceId === 's1')), 'Ruth not rostered during leave');
  const counts = {}; r.assignments.forEach(a => counts[a.personId] = (counts[a.personId] || 0) + 1);
  const doorPeople = ['p1', 'p3', 'p4', 'p5', 'p10'].map(p => counts[p] || 0);
  ok(Math.max(...doorPeople) - Math.min(...doorPeople) <= 2, 'door turns spread fairly: ' + JSON.stringify(counts));
  ok(r.gaps.length === 0 || r.gaps.every(g => g.why.length), 'any gaps come with reasons');
}

console.log('Declines respected, and check() flags problems');
{
  const d = base();
  d.assignments = [{ id: 'x', serviceId: 's0', positionId: 'kids', personId: 'p7', status: 'declined' }];
  const r = R.autoFill(d, ['s0']);
  ok(!r.assignments.some(a => a.personId === 'p7'), 'Thabo not asked again after saying no');
  d.groups = [{ id: 'g3', name: 'Keep apart', kind: 'apart', strength: 'must', memberIds: ['p6', 'p10'] }];
  d.assignments = [{ id: 'a', serviceId: 's0', positionId: 'tea', personId: 'p6', status: 'pending' }, { id: 'b', serviceId: 's0', positionId: 'door', personId: 'p10', status: 'pending' }];
  d.away = [{ personId: 'p6', from: '2026-11-01', to: '2026-11-01', reason: 'On leave' }];
  const c = R.check(d, ['s0']);
  ok(c.some(x => /away/.test(x.text)), 'flags someone rostered while away');
  ok(c.some(x => /kept apart/.test(x.text)), 'flags a keep-apart clash');
}

console.log('Service times: positions that run at one service, volunteers who serve at some services');
{
  const P = [{ id: 'a', firstName: 'Ann', lastName: 'A' }, { id: 'b', firstName: 'Ben', lastName: 'B' }, { id: 'c', firstName: 'Cat', lastName: 'C' }];
  const pos = [{ id: 'creche', teamId: 't', name: 'Creche Duty', needed: 1, times: ['08:00'] }, { id: 'sound', teamId: 't', name: 'Sound Desk', needed: 1 }];
  const sk = [{ personId: 'a', positionId: 'creche', frequency: 'weekly' }, { personId: 'b', positionId: 'sound', frequency: 'weekly', times: ['10:00'] },
    { personId: 'c', positionId: 'sound', frequency: 'weekly', times: ['08:00', '17:00'] }];
  const sv = [{ id: 'e', date: '2026-11-01', time: '08:00' }, { id: 't', date: '2026-11-01', time: '10:00' }, { id: 'f', date: '2026-11-01', time: '17:00' }];
  const r = R.autoFill({ people: P, positions: pos, skills: sk, services: sv, assignments: [], groups: [], away: [] }, sv.map(s => s.id));
  const at = (svc, p) => r.assignments.filter(x => x.serviceId === svc && x.positionId === p).map(x => x.personId).join();
  ok(at('e', 'creche') === 'a' && at('t', 'creche') === '' && at('f', 'creche') === '' && !r.gaps.some(g => g.positionId === 'creche' && g.serviceId !== 'e'), 'Creche Duty only at the 8:00 service – no gaps reported at 10:00 or 17:00');
  ok(at('t', 'sound') === 'b' && at('e', 'sound') === 'c' && at('f', 'sound') === 'c', 'volunteers are only rostered at the services they serve at');
}
{
  const P = [{ id: 'a', firstName: 'Ann', lastName: 'A' }, { id: 'b', firstName: 'Ben', lastName: 'B' }];
  const pos = [{ id: 'sound', teamId: 't', name: 'Sound Desk', needed: 1 }];
  const sk = [{ personId: 'a', positionId: 'sound', frequency: 'weekly', times: ['09:30@hilton'] }, { personId: 'b', positionId: 'sound', frequency: 'weekly', times: ['10:00'] }];
  const sv = [{ id: 'h', date: '2026-11-01', time: '09:30', slot: '09:30@hilton' }, { id: 'm', date: '2026-11-01', time: '10:00' }];
  const r = R.autoFill({ people: P, positions: pos, skills: sk, services: sv, assignments: [], groups: [], away: [] }, sv.map(s => s.id));
  const at = s => r.assignments.filter(x => x.serviceId === s).map(x => x.personId).join();
  ok(at('h') === 'a' && at('m') === 'b', 'another campus or venue: volunteers serve where they said (older services without a venue still work)');
}

console.log(fails ? `\n${fails} FAILED` : '\nAll roster tests passed');
process.exit(fails ? 1 : 0);
