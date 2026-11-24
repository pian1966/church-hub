/* Tests for js/serving.js (services, special services). Run: node tests/serving.test.js */
'use strict';
const S = require('../js/serving.js');
let fails = 0;
function ok(c, what) { if (!c) { fails++; console.log('  ✗ ' + what); } else console.log('  ✓ ' + what); }

ok(['2024-03-31', '2025-04-20', '2026-04-05', '2027-03-28', '2028-04-16', '2038-04-25'].join() === [2024, 2025, 2026, 2027, 2028, 2038].map(S.easter).join(), 'Easter Sunday is worked out for any year');
const x = Object.fromEntries(S.specials(2027).map(s => [s.name, s.date]));
ok(x['Ash Wednesday'] === '2027-02-10' && x['Palm Sunday'] === '2027-03-21' && x['Maundy Thursday'] === '2027-03-25' && x['Tenebrae'] === '2027-03-25' && x['Good Friday'] === '2027-03-26', 'Lent and Holy Week follow Easter (2027)');
ok(x['Ascension Day'] === '2027-05-06' && x['Pentecost (Whitsunday)'] === '2027-05-16' && x['Trinity Sunday'] === '2027-05-23', 'Ascension and Pentecost follow Easter');
ok(x['Advent Sunday'] === '2027-11-28' && S.specials(2026).find(s => s.name === 'Advent Sunday').date === '2026-11-29' && x['Christmas Day'] === '2027-12-25', 'Advent Sunday and Christmas');
ok(x['Remembrance Sunday'] === '2027-11-14' && x['Mother’s Day'] === '2027-05-09' && x['Christ the King'] === '2027-11-21', 'Sundays fixed by the calendar (Remembrance, Mother’s Day, Christ the King)');
ok(x['Wedding'] === '' && S.specials(2027).every(s => s.name && s.when), 'occasions have no fixed date');
ok(S.specialDate('good friday', '2026-10-29') === '2027-03-26' && S.specialDate('Christmas Day', '2026-10-29') === '2026-12-25' && S.specialDate('Funeral', '2026-10-29') === '', 'the next date for a suggestion (this year, or next year once it has passed)');

console.log('Services: look, mood, and what runs where');
const SP = 'memorial,christmas,maundy-thursday,tenebrae,good-friday,easter-sunday,ascension';
ok(S.slots({}).map(x => x.id).join() === '08:00,10:00,17:00' && S.specialSlots({}).map(x => x.id).join() === SP && S.allSlots({}).length === 10, 'Sunday services (8am, 10am, 5pm) and special services (Memorial, Christmas, Maundy Thursday, Tenebrae, Good Friday, Easter Sunday, Ascension)');
const saved = { serviceSlots: [{ id: '08:00', label: '8am', day: 0, time: '08:00' }, { id: '09:30@hall', label: '9:30am', day: 0, time: '09:30', venue: 'Hall' }] };
ok(S.slots(saved).map(x => x.id).join() === '08:00,09:30@hall' && S.specialSlots(saved).map(x => x.id).join() === SP, 'a church’s own Sunday services keep the special ones too');
const gone = { serviceSlots: S.removeSlot({}, 'tenebrae') };
ok(S.specialSlots(gone).length === 6 && S.savedSlots(gone).length === 10 && S.findSpecial('Tenebrae', gone) === null, 'a church that doesn’t hold Tenebrae can remove it (and it isn’t added back)');
const palm = { serviceSlots: S.addSpecialSlot({}, 'Palm Sunday') };
ok(S.findSpecial('palm sunday', palm).feast === 'Palm Sunday' && S.specialSlots(palm).length === 8 && S.removeSlot(palm, 'palm-sunday').length === 10, 'it can add its own (Palm Sunday, with its date in the church year) and remove it completely');
ok(S.findSpecial('Tenebrae', { serviceSlots: S.addSpecialSlot(gone, 'tenebrae') }).id === 'tenebrae', 'adding a removed one again brings it back');
ok(S.findSpecial('Easter Day', {}).id === 'easter-sunday' && S.findSpecial('Christmas Day', {}).id === 'christmas' && S.findSpecial('Wedding', {}) === null, 'a special service is found by its name or its day (Easter Day → Easter Sunday)');
ok(S.allSlots({}).map(x => S.themeOf(x).id).join() === 'sunrise,morning,sunset,candlelight,christmas,holyweek,candlelight,cross,easter,sky', 'each service’s look: sunrise, morning, sunset; candlelight, Christmas star, bread and wine, candlelight, the cross, Easter morning, sky');
ok(S.themeOf({ id: 'x', time: '12:30' }).id === 'midday' && S.themeOf({ id: 'y', time: '19:00' }).id === 'evening' && S.themeOf({ id: 'z', time: '18:00', theme: 'sunrise' }).id === 'sunrise', 'a new service gets a look from its time, unless one is chosen');
ok(S.moodsOf(S.allSlots({})[0]).includes('Sunday school') && S.moodsOf(S.allSlots({})[1]).includes('Hymns') && S.moodsOf(S.allSlots({})[2]).includes('Band'), 'the usual moods: children at 8am, hymns at 10am, a band at 5pm');
ok(S.moodsOf({ id: '08:00', moods: [] }).length === 0 && S.updateSlot({}, '10:00', { moods: ['Quiet'] }).find(x => x.id === '10:00').moods.join() === 'Quiet', 'a church can change the moods (even to none)');
const [eight, ten, five, mem, xmas] = S.allSlots({});
const host = { id: 'h', teamId: 't', times: [] }, creche = { id: 'c', teamId: 't', times: ['08:00'] }, teas = { id: 'm', teamId: 'u', times: ['memorial'] };
ok(S.runsAtSlot(host, eight) && S.runsAtSlot(host, five) && !S.runsAtSlot(host, mem) && S.runsAtSlot(teas, mem) && !S.runsAtSlot(teas, ten) && !S.runsAtSlot(creche, ten), 'every Sunday service unless narrowed down; Memorial only when named');
ok(!S.runsAtSlot(host, xmas) && S.runsAtSlot({ times: ['christmas'] }, xmas), 'special services have only the positions the Administrator chooses');
ok(S.toggleTimes(host, '17:00', {}).join() === '08:00,10:00', 'switching a position off at 5pm keeps it at 8am and 10am');
ok(S.toggleTimes({ times: ['08:00', '10:00'] }, '17:00', {}).join() === '', 'switching it back on at 5pm means every service again');
ok(S.toggleTimes(host, 'memorial', {}).join() === '08:00,10:00,17:00,memorial', 'adding Memorial names every service it runs at');
ok(S.toggleTimes({ times: ['08:00'] }, 'good-friday', {}).join() === '08:00,good-friday', 'and adding Good Friday keeps 8am');
ok(S.toggleTimes(teas, 'memorial', {}).join() === 'none' && S.allSlots({}).every(x => !S.runsAtSlot({ times: ['none'] }, x)), 'switched off everywhere is not the same as every service');
const st = S.structure(ten, [{ id: 't', name: 'A' }, { id: 'u', name: 'B' }], [host, creche, teas]);
ok(st.length === 1 && st[0].positions.map(p => p.id).join() === 'h', 'what a volunteer sees at 10am: only departments with positions there');
ok(S.structure(mem, [{ id: 't' }, { id: 'u' }], [host, creche, teas]).map(x => x.team.id).join() === 'u', 'and at a memorial only memorial teas');
const m = S.missing([{ id: 'old', name: 'Operational' }], []);
ok(!m.teams.some(t => t.name === 'Service Leading') && m.positions.filter(p => p.teamId === 'old').length === 5, 'the department once called Operational (Elvanto: Service) is now Service Leading – not added twice');

console.log('Holy Communion: which Sundays, one-off changes, and which positions');
const cs = {};   // the usual services: 10am on the 1st Sunday, 8am and 5pm on the 2nd
const svc = (date, slot, more) => Object.assign({ id: date + slot, date, time: slot, slot }, more || {});
ok(S.hasCommunion(svc('2026-12-06', '10:00'), cs) && !S.hasCommunion(svc('2026-12-06', '08:00'), cs) && !S.hasCommunion(svc('2026-12-06', '17:00'), cs), '1st Sunday (6 Dec 2026): communion at 10am only');
ok(!S.hasCommunion(svc('2026-12-13', '10:00'), cs) && S.hasCommunion(svc('2026-12-13', '08:00'), cs) && S.hasCommunion(svc('2026-12-13', '17:00'), cs), '2nd Sunday (13 Dec): communion at 8am and 5pm');
ok(!S.hasCommunion(svc('2026-11-29', '10:00'), cs) && !S.hasCommunion(svc('2026-11-29', '08:00'), cs), 'a 5th Sunday: no communion as usual');
ok(S.hasCommunion(svc('2026-11-29', '10:00', { communion: true }), cs) && !S.hasCommunion(svc('2026-12-06', '10:00', { communion: false }), cs), 'a one-off change for a day wins over the pattern');
ok(S.usualCommunion(svc('2026-12-06', '10:00', { communion: false }), cs) === true, 'what the pattern would have given is still known');
ok(S.hasCommunion(svc('2026-12-25', 'christmas', { special: true }), cs), 'special services: their communion positions decide');
const every = { serviceSlots: [{ id: '09:00', label: '9am', day: 0, time: '09:00', communion: 'every' }, { id: '18:00', label: '6pm', day: 0, time: '18:00', communion: [] }, { id: '07:00', label: '7am', day: 0, time: '07:00', communion: ['last', 3] }] };
ok(S.hasCommunion(svc('2026-12-13', '09:00'), every) && !S.hasCommunion(svc('2026-12-06', '18:00'), every), 'every week, or never');
ok(S.hasCommunion(svc('2026-12-27', '07:00'), every) && S.hasCommunion(svc('2026-12-20', '07:00'), every) && !S.hasCommunion(svc('2026-12-13', '07:00'), every), 'the last Sunday and the 3rd');
ok(S.hasCommunion(svc('2026-12-13', '11:00'), { serviceSlots: [{ id: '11:00', label: '11am', day: 0, time: '11:00' }] }), 'a church’s own new service has communion every week until chosen');
const tenAm = S.slots(cs)[1];
ok(JSON.stringify(S.toggleCommunionWeek(tenAm, 3)) === '[1,3]' && JSON.stringify(S.toggleCommunionWeek(tenAm, 1)) === '[]' && S.toggleCommunionWeek(tenAm, 'every') === 'every' && JSON.stringify(S.toggleCommunionWeek(tenAm, 'never')) === '[]', 'tapping weeks on and off');
ok(S.toggleCommunionWeek({ communion: [1, 2, 3, 4] }, 5) === 'every' && JSON.stringify(S.toggleCommunionWeek({ communion: 'every' }, 2)) === '[2]', 'all five weeks is every week; from every week, one tap picks that week');
ok(S.nextCommunions(tenAm, '2026-11-16', 3).join() === '2026-12-06,2027-01-03,2027-02-07' && S.nextCommunions({ day: 0, communion: [] }, '2026-11-16').length === 0, 'the next communion Sundays');
ok(S.isCommunion({ name: 'Communion – Providing' }) && S.isCommunion({ name: 'Communion Servers' }) && !S.isCommunion({ name: 'Collection Servers' }) && !S.isCommunion({ name: 'Tea Duty' }) && !S.isCommunion({ name: 'Servers (Collection & Communion)', communion: false }) && S.isCommunion({ name: 'Chalice bearers' }) && S.isCommunion({ name: 'Ushers', communion: true }), 'communion positions: by name until ticked or unticked');
const hosp = S.missing([{ id: 'h', name: 'Hospitality' }, { id: 'm', name: 'Music' }], [{ id: 'old-srv', teamId: 'h', name: 'Servers (Collection & Communion)', communion: true }]);
ok(hosp.renames.length === 1 && hosp.renames[0].id === 'old-srv' && hosp.renames[0].to === 'Communion Servers' && !hosp.positions.some(p => p.name === 'Communion Servers')
  && ['Collection Servers', 'Ushers', 'Recorded Music'].every(n => hosp.positions.some(p => p.name === n)), 'the old Servers (Collection & Communion) becomes Communion Servers (people kept); Collection Servers, Ushers and Recorded Music are added');
ok(!hosp.positions.find(p => p.name === 'Collection Servers').communion, 'collection servers are needed with or without communion');
ok(S.missing([{ id: 'h', name: 'Hospitality' }], [{ id: 'x', teamId: 'h', name: 'Communion Servers' }, { id: 'y', teamId: 'h', name: 'Servers (Collection & Communion)' }]).renames.length === 0, 'nothing renamed when Communion Servers is already there');
ok(S.findPosition('Servers (Collection & Communion)', [{ id: 'a', name: 'Communion Servers' }]).id === 'a' && S.findPosition('Servers (Collection & Communion)', [{ id: 'b', name: 'Servers (Collection & Communion)' }]).id === 'b', 'Elvanto’s combined servers: Communion Servers, or the old position if not renamed yet');
ok(S.missing([], []).positions.filter(p => p.communion).map(p => p.id).join() === 'pos-comm-lead,pos-comm-provide,pos-servers', 'the usual communion positions are marked');

console.log('The order of departments, and folding one into another');
const TM = ['Technical', 'Teens', 'Music', 'Creche', 'Hospitality', 'Children', 'Extra Slot', 'Operational', 'Welcome', 'Prayer', 'Memorial Service'].map((n, i) => ({ id: 't' + i, name: n }));
ok(S.orderTeams(TM).map(t => t.name).join() === 'Welcome,Operational,Extra Slot,Hospitality,Music,Creche,Children,Teens,Technical,Memorial Service,Prayer', 'the usual order: welcome, operational, extra slot, hospitality, music, creche, children, teens, technical (then the rest)');
const mv = S.moveTeam(TM, 't0', -1), byId = Object.fromEntries(mv.map(x => [x.id, x.order]));
const moved = S.orderTeams(TM.map(t => Object.assign({}, t, { order: byId[t.id] })));
ok(moved.map(t => t.name).slice(7, 9).join() === 'Technical,Teens' && S.moveTeam(TM, 't8', -1).length === 0, 'a team moves up one place (and the first can’t go higher)');
const MP = [{ id: 'a', teamId: 'm1', name: 'Singers', needed: 2 }, { id: 'b', teamId: 'm2', name: 'singers', needed: 3 }, { id: 'c', teamId: 'm2', name: 'Keyboard', needed: 1 }];
const MK = [{ id: 'k1', positionId: 'a', personId: 'p1' }, { id: 'k2', positionId: 'b', personId: 'p1' }, { id: 'k3', positionId: 'b', personId: 'p2' }];
const mg = S.mergeTeam('m2', 'm1', MP, MK, [{ id: 'x', positionId: 'b', personId: 'p2' }]);
ok(mg.removePositions.join() === 'b' && mg.positions.map(p => p.id + p.teamId + p.needed).join() === 'am13,cm11', 'merging: the same position joins the one already there (keeping the larger number needed), a new one moves across');
ok(mg.removeSkills.join() === 'k2' && mg.skills.map(k => k.id + k.positionId).join() === 'k3a' && mg.assignments.map(a => a.positionId).join() === 'a', 'its people and their turns go with it, nobody twice');

const NP = [{ id: 'd1', teamId: 'w1', name: 'Door', needed: 1, neededBy: { '10:00': 2 } }, { id: 'd2', teamId: 'w2', name: 'Door', needed: 1, neededBy: { '17:00': 3 } }];
const nm = S.mergeTeam('w2', 'w1', NP, [], []), kept = nm.positions[0] || {};
ok(nm.removePositions.join() === 'd2' && kept.id === 'd1' && kept.needed === 1 && kept.neededBy && kept.neededBy['10:00'] === 2 && kept.neededBy['17:00'] === 3, 'merging keeps each service’s own number (2 at the 10am, 3 at the 5pm)');
const nm2 = S.mergeTeam('w2', 'w1', [{ id: 'e1', teamId: 'w1', name: 'Keys', needed: 2, neededBy: { '08:00': 1 } }, { id: 'e2', teamId: 'w2', name: 'Keys', needed: 1 }], [], []);
ok(!nm2.positions.length, '… and changes nothing when the position already there needs as many everywhere');

console.log('Volunteering in plain words');
ok(S.freqShort('quarterly') === 'Once a quarter' && S.freqShort('break') === 'Taking a break' && S.fillCount([{ positionId: 'door', frequency: 'break' }], { id: 'door' }).resting === 1, 'once a quarter, and taking a break (counted apart)');
ok(S.freqShort('weekly') === 'Any week' && S.freqShort('emergency') === 'Backup only' && S.freqShort('monthly') === 'Once a month' && S.freqShort('fortnightly') === 'Every 2 weeks' && S.freqShort('occasional') === 'Now and then', 'how often, in a few words (never a code such as “emergency”)');
const door = { id: 'door', name: 'Door', times: [] }, kids = { id: 'kids', name: 'Creche', times: ['08:00'] }, off = { id: 'off', name: 'Old', times: ['none'] };
ok(S.positionSlots(door, {}).map(x => x.id).join() === '08:00,10:00,17:00' && S.positionSlots(kids, {}).map(x => x.id).join() === '08:00' && !S.positionSlots(off, {}).length, 'a position’s services are always spelt out (no services ticked = every Sunday service)');
ok(S.skillSlots({ times: ['10:00'] }, door, {}).map(x => x.id).join() === '10:00' && S.skillSlots({ times: [] }, door, {}).length === 3 && S.skillSlots({ times: ['10:00'] }, kids, {}).length === 0, 'a volunteer’s services: the ones they chose, where the position runs');
const sk = [{ positionId: 'door', frequency: 'weekly', times: ['10:00'] }, { positionId: 'door', frequency: 'emergency' }, { positionId: 'door', frequency: 'monthly', times: ['08:00'] }, { positionId: 'door', frequency: 'fortnightly' }, { positionId: 'kids', frequency: 'weekly' }];
const c = S.fillCount(sk, door), c10 = S.fillCount(sk, door, S.allSlots({})[1]);
ok(c.all === 4 && c.weekly === 2 && c.monthly === 1 && c.backup === 1, 'who can fill a position, counted by how often (any week, monthly, backup)');
ok(c10.all === 3 && c10.weekly === 2 && c10.backup === 1 && c10.monthly === 0, '… and at one service only');

if (fails) { console.log('\n' + fails + ' serving test(s) FAILED'); process.exit(1); }
console.log('\nAll serving tests passed');
