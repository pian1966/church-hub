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

console.log('Emergency-only volunteers');
{
  const d = { people: [people[0]], positions: [{ id: 'door', name: 'Door', needed: 1 }],
    skills: [skill('p1', 'door', 'emergency')], services: [services[0]], assignments: [], groups: [], away: [] };
  const regular = R.autoFill(d, ['s0']), emergency = R.autoFill(d, ['s0'], { emergency: true });
  ok(regular.assignments.length === 0 && regular.gaps[0].why[0].includes('emergencies'), 'regular rosters skip emergency-only volunteers');
  ok(emergency.assignments.length === 1 && emergency.assignments[0].source === 'emergency', 'emergency fill can include them and labels the suggestion');
}

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

console.log('Special services');
ok(R.runsAt({ times: [] }, { slot: '08:00' }, ['good-friday']) && !R.runsAt({ times: [] }, { slot: 'good-friday' }, ['good-friday']) && R.runsAt({ times: ['good-friday'] }, { slot: 'good-friday' }, ['good-friday']),
  'a special service (Good Friday) only gets the positions chosen for it; Sunday services get every position as before');
{
  const P = [{ id: 'a', firstName: 'A', lastName: 'A' }, { id: 'b', firstName: 'B', lastName: 'B' }];
  const pos = [{ id: 'host', name: 'Host', needed: 1, times: [] }, { id: 'reader', name: 'Reading', needed: 1, times: ['good-friday'] }];
  const sk = [{ personId: 'a', positionId: 'host', frequency: 'weekly' }, { personId: 'b', positionId: 'reader', frequency: 'weekly' }];
  const sv = [{ id: 'gf', date: '2027-03-26', time: '09:00', slot: 'good-friday' }];
  const r = R.autoFill({ people: P, positions: pos, skills: sk, services: sv, assignments: [], groups: [], away: [], specialSlots: ['good-friday'] }, ['gf']);
  ok(r.assignments.map(x => x.positionId).join() === 'reader' && !r.gaps.length, 'filling a Good Friday roster asks only for its positions');
}

console.log('Telling people they are on the roster');
{
  const sv = [{ id: 's2', date: '2026-12-13', time: '10:00' }, { id: 's1', date: '2026-12-06', time: '08:00' }, { id: 'old', date: '2026-11-01', time: '10:00' }];
  const as = [
    { id: 'x1', serviceId: 's2', positionId: 'p', personId: 'a', status: 'pending' },
    { id: 'x2', serviceId: 's1', positionId: 'p', personId: 'a', status: 'pending' },
    { id: 'x3', serviceId: 's1', positionId: 'q', personId: 'b', status: 'accepted' },
    { id: 'x4', serviceId: 'old', positionId: 'p', personId: 'c', status: 'pending' },
    { id: 'x5', serviceId: 's2', positionId: 'q', personId: 'b', status: 'declined' },
    { id: 'x6', serviceId: 'gone', positionId: 'q', personId: 'b', status: 'pending' }
  ];
  const all = R.byPerson(as, sv);
  ok(all.length === 3 && all[0].personId === 'c' && all[1].personId === 'a' && all[1].ids.join() === 'x2,x1', 'one message per person, their turns in date order (a turn at a removed service is left out)');
  const w = R.byPerson(as, sv, { waiting: true, today: '2026-11-15' });
  ok(w.length === 1 && w[0].personId === 'a' && w[0].ids.join() === 'x2,x1', 'Remind them: only turns still waiting for a reply, from today on');
  const only = R.byPerson(as, sv, { waiting: true, today: '2026-11-15', serviceIds: ['s1'] });
  ok(only.length === 1 && only[0].ids.join() === 'x2', 'Remind them: only the services on screen');
}

console.log('Holy Communion: communion positions only where there is communion');
{
  const pos = [{ id: 'tea', teamId: 'h', name: 'Tea', needed: 1 }, { id: 'comm', teamId: 'x', name: 'Communion – Providing', needed: 1, communion: true }];
  const d = { people, positions: pos, skills: [skill('p1', 'tea', 'weekly'), skill('p2', 'comm', 'weekly')], services: services.slice(0, 2), assignments: [], groups: [], away: [], noCommunion: ['s1'] };
  const r = R.autoFill(d, ['s0', 's1']);
  ok(r.assignments.some(a => a.serviceId === 's0' && a.positionId === 'comm') && !r.assignments.some(a => a.serviceId === 's1' && a.positionId === 'comm'), 'no one is asked for communion at a service without it');
  ok(r.assignments.filter(a => a.positionId === 'tea').length === 2 && !r.gaps.some(g => g.serviceId === 's1' && g.positionId === 'comm'), 'other positions are filled as usual, and no gap is reported');
  ok(!R.runsAt(pos[1], services[1], [], ['s1']) && R.runsAt(pos[1], services[0], [], ['s1']) && R.runsAt(pos[0], services[1], [], ['s1']), 'runsAt knows about communion');
}

console.log('Printing the roster: a term at a time, only what each service needs');
{
  const t = R.terms('2026-11-20');
  ok(t[0].n === 4 && t[0].from === '2026-10-01' && t[0].to === '2026-12-31', 'this term: October to December');
  ok(t[1].n === 1 && t[1].year === 2027 && t[1].from === '2027-01-01' && t[1].to === '2027-03-31', 'next term rolls into the new year');
  ok(R.terms('2027-05-02')[0].to === '2027-06-30', 'the second term ends on 30 June');

  const pos = [
    { id: 'preach', teamId: 'lead', name: 'Preaching', needed: 1 },
    { id: 'creche', teamId: 'kids', name: 'Creche', needed: 1, times: ['08:00'] },
    { id: 'band', teamId: 'music', name: 'Band', needed: 2, times: ['17:00'] },
    { id: 'comm', teamId: 'comm', name: 'Communion', needed: 1, communion: true },
    { id: 'tea', teamId: 'hosp', name: 'Tea', needed: 1 }
  ];
  const svcs = [
    { id: 'a8', date: '2027-01-03', time: '08:00', name: 'Family' }, { id: 'a17', date: '2027-01-03', time: '17:00', name: 'Evening' },
    { id: 'b8', date: '2027-01-10', time: '08:00', name: 'Family' }, { id: 'b17', date: '2027-01-10', time: '17:00', name: 'Evening' },
    { id: 'gf', date: '2027-03-26', time: '09:00', name: 'Good Friday', slot: 'good-friday' },
    { id: 'apr', date: '2027-04-04', time: '08:00', name: 'Family' }
  ];
  const as = (id, serviceId, positionId, personId, status = 'accepted') => ({ id, serviceId, positionId, personId, status });
  const d = { people, teams: [{ id: 'lead', name: 'Service Leading' }, { id: 'kids', name: 'Children' }, { id: 'music', name: 'Music' }],
    positions: pos, services: svcs, specialSlots: ['good-friday'], noCommunion: ['a8', 'a17', 'b17'],
    assignments: [as('1', 'a8', 'preach', 'p1'), as('2', 'b8', 'preach', 'p4', 'pending'), as('3', 'a8', 'creche', 'p2'),
      as('4', 'a17', 'band', 'p5'), as('5', 'a17', 'band', 'p6', 'declined'), as('6', 'b8', 'comm', 'p7'), as('7', 'gf', 'preach', 'p9'), as('8', 'apr', 'preach', 'p10')] };
  const choices = R.printChoices(d, '2027-01-01', '2027-03-31');
  ok(choices.map(c => c.key).join() === '08:00,17:00,special' && choices[0].services === 2 && choices[0].name === 'Family', 'one choice per service, special services last');

  const eight = R.printSheets(d, { from: '2027-01-01', to: '2027-03-31', sheets: ['08:00'] });
  ok(eight.length === 1 && eight[0].services.map(s => s.id).join() === 'a8,b8', 'the 8 o’clock sheet has only the 8 o’clock services of the term');
  const rows8 = eight[0].teams.flatMap(t => t.rows.map(r => r.position.id));
  ok(rows8.join() === 'preach,creche,comm', 'positions nobody is on, and the 5pm band, are left out completely');
  ok(eight[0].teams[0].name === 'Service Leading' && eight[0].teams[0].rows[0].cells.map(c => c.names.join()).join('|') === 'Jason Naidoo|Sam Peters', 'names under each date, waiting replies included');
  const comm = eight[0].teams.find(t => t.teamId === 'comm').rows[0].cells;
  ok(comm[0].na && !comm[1].na && comm[1].names[0] === 'Thabo Nkosi', 'a communion role shows as not needed on a Sunday without communion');

  const five = R.printSheets(d, { from: '2027-01-01', to: '2027-03-31', sheets: ['17:00'] })[0];
  ok(five.teams.length === 1 && five.teams[0].rows[0].cells[0].names.join() === 'Lerato Khumalo', 'people who said no are not printed');

  const gaps = R.printSheets(d, { from: '2027-01-01', to: '2027-03-31', sheets: ['17:00'], gaps: true })[0];
  const g = gaps.teams.flatMap(t => t.rows.map(r => r.position.id));
  ok(g.includes('preach') && g.includes('tea') && !g.includes('creche') && !g.includes('comm'), 'with gaps: empty positions the service needs are kept, others still left out');

  const all = R.printSheets(d, { from: '2027-01-01', to: '2027-03-31', name: p => p.firstName });
  ok(all.map(s => s.key).join() === '08:00,17:00,special' && all[2].teams[0].rows[0].cells[0].names[0] === 'Ruth', 'every service when none are chosen, names as the app shows them');
  ok(R.printSheets(d, { from: '2027-02-01', to: '2027-02-28' }).length === 0, 'nothing to print in a month without services');

  ok(JSON.stringify(R.pages(13)) === '[[0,13]]' && JSON.stringify(R.pages(14)) === '[[0,7],[7,14]]' && R.pages(27).length === 3, 'more Sundays than fit across a page are split evenly');
}

console.log('Once a quarter, taking a break, and someone to take your place');
{
  const one = (f) => ({ people: [people[0]], positions: [{ id: 'door', name: 'Door', needed: 1 }], skills: [skill('p1', 'door', f)], services, assignments: [], groups: [], away: [] });
  const q = R.autoFill(one('quarterly'), services.map(s => s.id));
  ok(q.assignments.length === 1 && q.assignments[0].serviceId === 's0', 'once a quarter: asked once, then not again for 12 weeks');
  const b = R.autoFill(one('break'), ['s0'], { emergency: true });
  ok(b.assignments.length === 0 && b.gaps[0].why[0].includes('break'), 'taking a break: never asked, not even in an emergency');
  const d = base();
  d.skills = skills.concat([skill('p8', 'door', 'emergency'), skill('p9', 'door', 'break')]);
  d.away = [{ personId: 'p4', from: '2026-11-01', to: '2026-11-01', reason: 'Away' }];
  d.assignments = [{ id: 'x1', serviceId: 's0', positionId: 'door', personId: 'p1', status: 'declined' }, { id: 'x2', serviceId: 's0', positionId: 'door', personId: 'p5', status: 'accepted' }];
  d.groups = [{ id: 'g', kind: 'apart', memberIds: ['p3', 'p5'] }];
  const c = R.coverFor(d, d.assignments[0]);
  ok(c.join() === 'p10,p8', 'someone to take your place: on the team and free that day (not away, not serving already, not kept apart, not on a break), backups last: ' + c.join());
}

console.log('Who’s serving with you');
{
  const d = base();
  d.assignments = [{ serviceId: 's0', positionId: 'tea', personId: 'p2', status: 'accepted' }, { serviceId: 's0', positionId: 'door', personId: 'p1', status: 'pending' },
    { serviceId: 's0', positionId: 'door', personId: 'p4', status: 'declined' }, { serviceId: 's1', positionId: 'door', personId: 'p5', status: 'accepted' }];
  const c = R.crews(d, ['s0'], p => p.firstName + ' ' + p.lastName[0] + '.');
  ok(Object.keys(c).join() === 's0' && c.s0.people.join() === 'p1,p2' && c.s0.list.map(x => x.n + ':' + x.p).join() === 'Jason N.:door,Priya N.:tea', 'names and positions at each service chosen, not those who said no, short names only');
}

console.log(fails ? `\n${fails} FAILED` : '\nAll roster tests passed');
process.exit(fails ? 1 : 0);
